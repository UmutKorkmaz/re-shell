import {
  collabAnalyticsSchema,
  collabDocSchema,
  collabEventEnvelopeSchema,
  collabEventSchema,
  collabSessionSummarySchema,
  collabSnapshotSchema,
  KNOWN_COLLAB_EVENT_TYPES,
  applyCollabEvent,
  CollabSyncError,
  readSseFrames,
  relayMessageSchema,
  rtcSignalSchema,
  type CollabAnalytics,
  type CollabDoc,
  type CollabEvent,
  type CollabSessionSummary,
  type CollabSnapshot,
  type PeerChannel,
  type RelayMessage,
  type RtcSignal,
  type RtcSignalKind,
} from './collab.js';
import { OtClient, OtError, applyOp, diffToOp, isNoop, type TextOp } from './ot.js';

/**
 * A real client for the control plane's collaboration API (P9-N), shared by the
 * `re-shell collab session ...` CLI, the dashboard and the test suites. It only
 * needs `fetch`, so it runs unchanged in Node 18+ and in the browser.
 *
 *  - {@link ControlPlaneClient}  typed REST calls (envelope unwrapped, errors typed)
 *  - {@link CollabConnection}    the live stream: snapshot, resume with `afterSeq`,
 *                                automatic reconnect, state kept by the shared reducer
 *  - {@link SharedDocSync}       a collaborative text document over OT, on a connection
 */

export class ControlPlaneError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ControlPlaneError';
  }

  /** True for failures worth retrying (network, rate limit, server fault). */
  get transient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export interface ControlPlaneClientOptions {
  /** e.g. `https://cp.example.com` (no trailing path). */
  baseUrl: string;
  /** A bearer token, or a function returning the current one (so a long-lived stream can refresh). */
  token: string | (() => string);
  fetch?: typeof fetch;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

const enc = encodeURIComponent;

export class ControlPlaneClient {
  private readonly doFetch: typeof fetch;

  constructor(readonly options: ControlPlaneClientOptions) {
    this.doFetch = options.fetch ?? ((...args) => fetch(...args));
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  token(): string {
    const t = this.options.token;
    return typeof t === 'function' ? t() : t;
  }

  /** Issue a request and return the envelope's `data`; throws {@link ControlPlaneError} otherwise. */
  async call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await this.doFetch(joinUrl(this.baseUrl, path), {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${this.token()}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ControlPlaneError(
        0,
        'SERVICE_UNAVAILABLE',
        `Cannot reach the control plane at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    const envelope = json as
      | { ok: true; data: T }
      | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } }
      | undefined;
    if (envelope && envelope.ok === true) {
      return envelope.data;
    }
    if (envelope && envelope.ok === false && envelope.error) {
      throw new ControlPlaneError(response.status, envelope.error.code, envelope.error.message, envelope.error.details);
    }
    throw new ControlPlaneError(
      response.status,
      response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'INVALID_REQUEST',
      `Unexpected response (HTTP ${response.status}) from the control plane.`
    );
  }

  me(): Promise<{ userId: string; tenants: Array<{ tenantId: string; role: string }> }> {
    return this.call('GET', '/me');
  }

  listWorkspaces(tenantId: string): Promise<{ workspaces: Array<{ id: string; name: string }> }> {
    return this.call('GET', `/tenants/${enc(tenantId)}/workspaces`);
  }

  async createSession(tenantId: string, input: { workspaceId: string; title?: string }): Promise<CollabSnapshot> {
    const data = await this.call<{ session: unknown }>('POST', `/tenants/${enc(tenantId)}/sessions`, input);
    return collabSnapshotSchema.parse(data.session);
  }

  async listSessions(
    tenantId: string,
    filters: { status?: 'active' | 'ended'; workspaceId?: string; limit?: number } = {}
  ): Promise<CollabSessionSummary[]> {
    const q = new URLSearchParams();
    if (filters.status) q.set('status', filters.status);
    if (filters.workspaceId) q.set('workspaceId', filters.workspaceId);
    if (filters.limit !== undefined) q.set('limit', String(filters.limit));
    const qs = q.toString();
    const data = await this.call<{ sessions: unknown[] }>('GET', `/tenants/${enc(tenantId)}/sessions${qs ? `?${qs}` : ''}`);
    return data.sessions.map((s) => collabSessionSummarySchema.parse(s));
  }

  private async sessionState(method: string, path: string, body?: unknown): Promise<CollabSnapshot> {
    const data = await this.call<{ session: unknown }>(method, path, body);
    return collabSnapshotSchema.parse(data.session);
  }

  getSession(tenantId: string, sessionId: string): Promise<CollabSnapshot> {
    return this.sessionState('GET', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}`);
  }
  joinSession(tenantId: string, sessionId: string): Promise<CollabSnapshot> {
    return this.sessionState('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/join`, {});
  }
  leaveSession(tenantId: string, sessionId: string): Promise<CollabSnapshot> {
    return this.sessionState('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/leave`, {});
  }
  endSession(tenantId: string, sessionId: string, reason?: string): Promise<CollabSnapshot> {
    return this.sessionState('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/end`, reason ? { reason } : {});
  }
  handover(tenantId: string, sessionId: string, toUserId: string): Promise<CollabSnapshot> {
    return this.sessionState('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/handover`, { toUserId });
  }

  /** Run an allow-listed command as the driver. Returns the queued job. */
  run(
    tenantId: string,
    sessionId: string,
    commandId: string,
    params: Record<string, unknown> = {}
  ): Promise<{ job: { id: string; status: string; commandId: string; requestedBy: string }; session: { seq: number } }> {
    return this.call('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/run`, { commandId, params });
  }

  cancel(tenantId: string, sessionId: string): Promise<{ job: { id: string; status: string } }> {
    return this.call('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/cancel`, {});
  }

  async events(tenantId: string, sessionId: string, afterSeq = 0, limit = 200): Promise<{ events: CollabEvent[]; seq: number }> {
    const data = await this.call<{ events: unknown[]; seq: number }>(
      'GET',
      `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/events?afterSeq=${afterSeq}&limit=${limit}`
    );
    return { events: data.events.map((e) => collabEventSchema.parse(e)), seq: data.seq };
  }

  async analytics(
    tenantId: string,
    window: { from?: number; to?: number; workspaceId?: string } = {}
  ): Promise<CollabAnalytics> {
    const q = new URLSearchParams();
    if (window.from !== undefined) q.set('from', String(window.from));
    if (window.to !== undefined) q.set('to', String(window.to));
    if (window.workspaceId) q.set('workspaceId', window.workspaceId);
    const qs = q.toString();
    const data = await this.call<{ analytics: unknown }>('GET', `/tenants/${enc(tenantId)}/analytics${qs ? `?${qs}` : ''}`);
    return collabAnalyticsSchema.parse(data.analytics);
  }

  async listDocs(tenantId: string, sessionId: string): Promise<CollabDoc[]> {
    const data = await this.call<{ docs: unknown[] }>('GET', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/docs`);
    return data.docs.map((d) => collabDocSchema.parse(d));
  }

  async getDoc(tenantId: string, sessionId: string, docId: string): Promise<CollabDoc> {
    const data = await this.call<{ doc: unknown }>('GET', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/docs/${enc(docId)}`);
    return collabDocSchema.parse(data.doc);
  }

  async createDoc(
    tenantId: string,
    sessionId: string,
    input: { docId: string; title: string; kind?: 'notes' | 'yaml-draft' | 'text'; content?: string }
  ): Promise<CollabDoc> {
    const data = await this.call<{ doc: unknown }>('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/docs`, input);
    return collabDocSchema.parse(data.doc);
  }

  sendDocOp(
    tenantId: string,
    sessionId: string,
    docId: string,
    op: { clientId: string; clientSeq: number; baseRev: number; ops: TextOp }
  ): Promise<{ docId: string; rev: number; ops: TextOp; duplicate: boolean }> {
    return this.call('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/docs/${enc(docId)}/ops`, op);
  }

  signal(
    tenantId: string,
    sessionId: string,
    input: { to: string; kind: RtcSignalKind; connectionId: string; payload: Record<string, unknown> }
  ): Promise<{ delivered: boolean }> {
    return this.call('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/signal`, input);
  }

  relay(
    tenantId: string,
    sessionId: string,
    input: { to?: string | null; channel: PeerChannel; payload: Record<string, unknown> }
  ): Promise<{ delivered: number }> {
    return this.call('POST', `/tenants/${enc(tenantId)}/sessions/${enc(sessionId)}/relay`, { to: null, ...input });
  }

  connect(tenantId: string, sessionId: string, options?: CollabConnectionOptions): CollabConnection {
    return new CollabConnection(this, tenantId, sessionId, options);
  }
}

// ---------------------------------------------------------------------------
// Live connection
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface CollabConnectionOptions {
  /** Reconnect (resuming from the last sequence) when the stream drops. Default true. */
  reconnect?: boolean;
  /** Backoff schedule in ms; the last value repeats. */
  backoffMs?: readonly number[];
  /** Give up on the initial connect after this many attempts (default: 5). Later drops retry forever. */
  maxInitialAttempts?: number;
}

type Handlers = {
  state: (state: CollabSnapshot, event?: CollabEvent) => void;
  event: (event: CollabEvent) => void;
  signal: (signal: RtcSignal) => void;
  relay: (message: RelayMessage) => void;
  status: (status: ConnectionStatus, detail?: string) => void;
  /** The state was replaced by a fresh snapshot (first connect, or a resync). `resync` is true for the latter. */
  reset: (state: CollabSnapshot, info: { resync: boolean }) => void;
  ready: (seq: number) => void;
  error: (error: Error) => void;
};

/**
 * The live stream of one session. `state` always equals the server's snapshot at
 * `state.seq`: it starts from a snapshot and folds every event with the shared
 * reducer; after a drop it resumes with `afterSeq` (or takes a fresh snapshot if
 * the server cannot replay), and any inconsistency triggers a resync.
 */
export class CollabConnection {
  state: CollabSnapshot | undefined;
  status: ConnectionStatus = 'idle';
  private handlers: { [K in keyof Handlers]: Set<Handlers[K]> } = {
    state: new Set(),
    event: new Set(),
    signal: new Set(),
    relay: new Set(),
    status: new Set(),
    reset: new Set(),
    ready: new Set(),
    error: new Set(),
  };
  private abort: AbortController | undefined;
  private closedByUser = false;
  private started: Promise<void> | undefined;
  private firstReady: { resolve: () => void; reject: (e: Error) => void } | undefined;
  private everReady = false;
  private everSnapshot = false;

  constructor(
    private readonly client: ControlPlaneClient,
    readonly tenantId: string,
    readonly sessionId: string,
    private readonly options: CollabConnectionOptions = {}
  ) {}

  on<K extends keyof Handlers>(event: K, handler: Handlers[K]): () => void {
    this.handlers[event].add(handler);
    return () => {
      this.handlers[event].delete(handler);
    };
  }

  private emit<K extends keyof Handlers>(event: K, ...args: Parameters<Handlers[K]>): void {
    for (const handler of Array.from(this.handlers[event])) {
      try {
        (handler as (...a: Parameters<Handlers[K]>) => void)(...args);
      } catch {
        // A faulty listener must not break the stream.
      }
    }
  }

  private setStatus(status: ConnectionStatus, detail?: string): void {
    if (this.status === status && detail === undefined) return;
    this.status = status;
    this.emit('status', status, detail);
  }

  /** Open the stream. Resolves once the first snapshot/replay is complete; rejects on a fatal refusal. */
  start(): Promise<void> {
    if (this.started) return this.started;
    this.started = new Promise<void>((resolve, reject) => {
      this.firstReady = { resolve, reject };
    });
    void this.loop();
    return this.started;
  }

  close(): void {
    this.closedByUser = true;
    this.abort?.abort();
    this.setStatus('closed');
    if (this.firstReady && !this.everReady) {
      this.firstReady.reject(new Error('Connection closed.'));
    }
  }

  /** Resolve once the folded state reaches `seq` (rejects after `timeoutMs`). */
  waitForSeq(seq: number, timeoutMs = 10_000): Promise<CollabSnapshot> {
    return this.waitFor((s) => s.seq >= seq, timeoutMs, `seq ${seq}`);
  }

  waitFor(predicate: (state: CollabSnapshot) => boolean, timeoutMs = 10_000, what = 'condition'): Promise<CollabSnapshot> {
    return new Promise((resolve, reject) => {
      if (this.state && predicate(this.state)) {
        resolve(this.state);
        return;
      }
      const off = this.on('state', (state) => {
        if (predicate(state)) {
          clearTimeout(timer);
          off();
          resolve(state);
        }
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${what}.`));
      }, timeoutMs);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async loop(): Promise<void> {
    const backoff = this.options.backoffMs ?? [250, 500, 1000, 2000, 5000];
    const reconnect = this.options.reconnect ?? true;
    const maxInitial = this.options.maxInitialAttempts ?? 5;
    let attempt = 0;
    this.setStatus('connecting');
    while (!this.closedByUser) {
      this.abort = new AbortController();
      try {
        const cursor = this.state ? `?afterSeq=${this.state.seq}` : '';
        const response = await this.openStream(cursor, this.abort.signal);
        attempt = 0;
        await this.consume(response);
        if (this.closedByUser) break;
        if (this.state?.session.status === 'ended') {
          this.finish('session ended');
          return;
        }
      } catch (error) {
        if (this.closedByUser) break;
        const err = error instanceof Error ? error : new Error(String(error));
        if (err instanceof ControlPlaneError && !err.transient) {
          this.emit('error', err);
          this.fail(err);
          return;
        }
        if (err instanceof FatalStreamEnd) {
          this.finish(err.message);
          return;
        }
        if (!(err instanceof CollabSyncError)) {
          this.emit('error', err);
        }
        if (!this.everReady && attempt + 1 >= maxInitial) {
          this.fail(err);
          return;
        }
      }
      if (!reconnect) {
        this.finish('stream ended');
        return;
      }
      this.setStatus('reconnecting');
      await this.delay(backoff[Math.min(attempt, backoff.length - 1)]);
      attempt += 1;
    }
  }

  private finish(detail: string): void {
    this.setStatus('closed', detail);
    if (this.firstReady && !this.everReady) {
      this.firstReady.reject(new Error(`The stream closed before it was ready (${detail}).`));
    }
  }

  private fail(error: Error): void {
    this.setStatus('closed', error.message);
    if (this.firstReady && !this.everReady) {
      this.firstReady.reject(error);
    }
  }

  private async openStream(query: string, signal: AbortSignal): Promise<Response> {
    const url = joinUrl(
      this.client.baseUrl,
      `/tenants/${enc(this.tenantId)}/sessions/${enc(this.sessionId)}/stream${query}`
    );
    let response: Response;
    try {
      response = await (this.client.options.fetch ?? fetch)(url, {
        signal,
        headers: { Authorization: `Bearer ${this.client.token()}`, Accept: 'text/event-stream' },
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ControlPlaneError(0, 'SERVICE_UNAVAILABLE', `Cannot reach the control plane: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      let code = 'INTERNAL_ERROR';
      let message = `The stream was refused (HTTP ${response.status}).`;
      try {
        const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
        if (parsed.error?.code) code = parsed.error.code;
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // keep the defaults
      }
      throw new ControlPlaneError(response.status, code, message);
    }
    return response;
  }

  private async consume(response: Response): Promise<void> {
    const body = response.body as ReadableStream<Uint8Array>;
    for await (const frame of readSseFrames(body)) {
      let payload: unknown;
      try {
        payload = JSON.parse(frame.data);
      } catch {
        continue;
      }
      switch (frame.event) {
        case 'snapshot': {
          const snapshot = collabSnapshotSchema.parse(payload);
          const resync = this.everSnapshot;
          this.everSnapshot = true;
          this.state = snapshot;
          this.emit('reset', snapshot, { resync });
          this.emit('state', snapshot);
          break;
        }
        case 'ready': {
          this.everReady = true;
          this.setStatus('open');
          this.firstReady?.resolve();
          this.emit('ready', (payload as { seq: number }).seq);
          break;
        }
        case 'presence': {
          if (this.state) {
            const online = (payload as { online: string[] }).online;
            this.state = { ...this.state, online };
            this.emit('state', this.state);
          }
          break;
        }
        case 'signal': {
          const parsed = rtcSignalSchema.safeParse(payload);
          if (parsed.success) this.emit('signal', parsed.data);
          break;
        }
        case 'relay': {
          const parsed = relayMessageSchema.safeParse(payload);
          if (parsed.success) this.emit('relay', parsed.data);
          break;
        }
        case 'revoked':
          throw new FatalStreamEnd('access revoked');
        case 'expired':
          // The token behind this stream expired; reconnect (a token function may supply a fresh one).
          return;
        case 'error':
          throw new ControlPlaneError(404, (payload as { code?: string }).code ?? 'INTERNAL_ERROR', 'The session stream failed.');
        default: {
          // A logged event (named by its type).
          const envelope = collabEventEnvelopeSchema.safeParse(payload);
          if (!envelope.success) break;
          try {
            const known = KNOWN_COLLAB_EVENT_TYPES.has(envelope.data.type);
            if (known) {
              const event = collabEventSchema.parse(payload);
              this.state = applyCollabEvent(this.state, event);
              this.emit('event', event);
              this.emit('state', this.state, event);
            } else if (this.state && envelope.data.seq === this.state.seq + 1) {
              // An event type from a newer server: advance the cursor, change nothing.
              this.state = { ...this.state, seq: envelope.data.seq };
            }
          } catch (error) {
            if (error instanceof CollabSyncError) {
              // Local state diverged from the log: drop the cursor and take a fresh snapshot.
              this.state = undefined;
              this.abort?.abort();
              throw error;
            }
            throw error;
          }
        }
      }
    }
  }
}

class FatalStreamEnd extends Error {}

// ---------------------------------------------------------------------------
// Shared document (OT client)
// ---------------------------------------------------------------------------

export interface SharedDocSyncOptions {
  clientId?: string;
  /** Wait this long before sending the first op after an edit, so bursts of typing coalesce. */
  flushDelayMs?: number;
}

type DocHandlers = {
  /** `local` is true for edits made here; `op` is the op applied to the text. */
  change: (text: string, info: { local: boolean; op: TextOp; rev: number }) => void;
  /** The document was replaced from a fresh snapshot (unsent local edits, if any, were dropped). */
  reset: (text: string, info: { lostLocalEdits: boolean }) => void;
  error: (error: Error) => void;
};

function randomId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A text document kept in sync with the server by operational transformation.
 * Local edits are applied immediately; at most one op is in flight, the rest are
 * composed into a buffer (the Jupiter protocol, {@link OtClient}). The author
 * learns its op was committed from the committed op arriving on the stream, so
 * a dropped POST response is harmless; a retry of the same (clientId, clientSeq)
 * is applied once by the server.
 */
export class SharedDocSync {
  text: string;
  readonly clientId: string;
  private ot: OtClient;
  private clientSeq = 0;
  private inFlightSeq: number | undefined;
  private sending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private destroyed = false;
  private idleWaiters: Array<() => void> = [];
  private handlers: { [K in keyof DocHandlers]: Set<DocHandlers[K]> } = {
    change: new Set(),
    reset: new Set(),
    error: new Set(),
  };
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly client: ControlPlaneClient,
    private readonly connection: CollabConnection,
    readonly docId: string,
    private readonly options: SharedDocSyncOptions = {}
  ) {
    this.clientId = options.clientId ?? randomId();
    const doc = this.currentDoc();
    this.text = doc?.content ?? '';
    this.ot = new OtClient(doc?.rev ?? 0);
    this.offs.push(
      connection.on('event', (event) => this.onEvent(event)),
      connection.on('reset', (state, info) => {
        if (info.resync) this.resetFrom(state);
      })
    );
  }

  private currentDoc(): CollabDoc | undefined {
    return this.connection.state?.docs.find((d) => d.id === this.docId);
  }

  on<K extends keyof DocHandlers>(event: K, handler: DocHandlers[K]): () => void {
    this.handlers[event].add(handler);
    return () => {
      this.handlers[event].delete(handler);
    };
  }

  private emit<K extends keyof DocHandlers>(event: K, ...args: Parameters<DocHandlers[K]>): void {
    for (const handler of Array.from(this.handlers[event])) {
      try {
        (handler as (...a: Parameters<DocHandlers[K]>) => void)(...args);
      } catch {
        // listener faults are isolated
      }
    }
  }

  get rev(): number {
    return this.ot.rev;
  }

  /** True while local edits are not yet acknowledged by the server. */
  get dirty(): boolean {
    return this.ot.state !== 'synchronized';
  }

  /** Replace the whole text with `next` (a minimal diff is sent as one op). */
  setText(next: string): void {
    if (next === this.text) return;
    this.applyLocal(diffToOp(this.text, next));
  }

  /** Apply a local edit expressed as an op over the current text. */
  applyLocal(op: TextOp): void {
    if (this.destroyed || isNoop(op)) return;
    this.text = applyOp(this.text, op);
    this.emit('change', this.text, { local: true, op, rev: this.ot.rev });
    const toSend = this.ot.applyLocal(op);
    if (toSend) this.scheduleSend();
  }

  private scheduleSend(): void {
    if (this.timer || this.sending) return;
    const delay = this.options.flushDelayMs ?? 0;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.sendInFlight();
    }, delay);
  }

  private async sendInFlight(): Promise<void> {
    const op = this.ot.inFlight;
    if (!op || this.sending || this.destroyed) return;
    this.sending = true;
    if (this.inFlightSeq === undefined) {
      this.clientSeq += 1;
      this.inFlightSeq = this.clientSeq;
    }
    const seq = this.inFlightSeq;
    let attempt = 0;
    try {
      for (;;) {
        // Always send the CURRENT in-flight op at the CURRENT revision: if a remote op arrived meanwhile the
        // op was rebased locally, and a retry of an already-committed seq is a harmless duplicate.
        const current = this.ot.inFlight;
        if (!current || this.inFlightSeq !== seq || this.destroyed) return;
        try {
          await this.client.sendDocOp(this.connection.tenantId, this.connection.sessionId, this.docId, {
            clientId: this.clientId,
            clientSeq: seq,
            baseRev: this.ot.rev,
            ops: current,
          });
          return; // acknowledged through the stream
        } catch (error) {
          if (error instanceof ControlPlaneError && error.transient && attempt < 8) {
            attempt += 1;
            await new Promise((r) => setTimeout(r, Math.min(2000, 100 * 2 ** attempt)));
            continue;
          }
          this.emit('error', error instanceof Error ? error : new Error(String(error)));
          return;
        }
      }
    } finally {
      this.sending = false;
      // The ack of this op may have arrived on the stream while the POST was still in flight; the next op
      // (already promoted to in-flight by that ack) could not be sent then, so send it now.
      if (this.ot.inFlight && this.inFlightSeq === undefined) {
        this.scheduleSend();
      }
      this.notifyIdle();
    }
  }

  private onEvent(event: CollabEvent): void {
    if (this.destroyed || event.type !== 'doc.op' || event.data.docId !== this.docId) return;
    const d = event.data;
    if (d.rev !== this.ot.rev + 1) {
      this.emit('error', new CollabSyncError(`Document ${this.docId} at rev ${this.ot.rev} received rev ${d.rev}.`));
      return;
    }
    try {
      if (d.clientId === this.clientId && d.clientSeq === this.inFlightSeq && this.ot.inFlight) {
        const next = this.ot.ack();
        this.inFlightSeq = undefined;
        if (next) this.scheduleSend();
        else this.notifyIdle();
        return;
      }
      const op = this.ot.applyRemote(d.ops as TextOp);
      this.text = applyOp(this.text, op);
      this.emit('change', this.text, { local: false, op, rev: this.ot.rev });
    } catch (error) {
      if (error instanceof OtError) {
        this.emit('error', error);
        return;
      }
      throw error;
    }
  }

  private resetFrom(state: CollabSnapshot): void {
    const doc = state.docs.find((x) => x.id === this.docId);
    const lost = this.dirty;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.inFlightSeq = undefined;
    this.text = doc?.content ?? '';
    this.ot = new OtClient(doc?.rev ?? 0);
    this.emit('reset', this.text, { lostLocalEdits: lost });
    this.notifyIdle();
  }

  private notifyIdle(): void {
    if (this.ot.state === 'synchronized') {
      for (const waiter of this.idleWaiters.splice(0)) waiter();
    }
  }

  /** Resolve when every local edit has been acknowledged by the server. */
  flush(timeoutMs = 10_000): Promise<void> {
    if (this.ot.state === 'synchronized') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms waiting for the document to sync.`)), timeoutMs);
      this.idleWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    for (const off of this.offs) off();
  }
}
