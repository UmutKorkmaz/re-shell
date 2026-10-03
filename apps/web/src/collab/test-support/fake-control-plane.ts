import {
  applyCollabEvent,
  applyOp,
  normalizeOp,
  transformOps,
  type CollabAnalytics,
  type CollabEvent,
  type CollabSnapshot,
  type TextOp,
} from '@re-shell/contracts';

/**
 * A tiny in-memory stand-in for the control plane's collaboration HTTP surface,
 * for jsdom tests of the screen. It speaks the real wire format (envelopes, the
 * SSE stream with `snapshot`/`ready`/ordered events, document ops) and keeps its
 * state with the SAME shared reducer the real clients use. The real server is
 * exercised end to end by the control-plane suites and the Playwright spec.
 */

const TOKENS: Record<string, string> = { 'tok-alice': 'alice', 'tok-bob': 'bob' };
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

export interface FakeOptions {
  /** Pre-existing session (alice owns and drives it). */
  withSession?: boolean;
  analytics?: CollabAnalytics;
}

export class FakeControlPlane {
  state: CollabSnapshot | undefined;
  log: CollabEvent[] = [];
  requests: Array<{ method: string; path: string; user: string | null; body?: unknown }> = [];
  private streams: Array<{ user: string; controller: ReadableStreamDefaultController<Uint8Array> }> = [];
  private encoder = new TextEncoder();
  private docOps: Array<{ rev: number; ops: TextOp }> = [];
  private clock = 1_000;
  private jobCounter = 0;
  analytics: CollabAnalytics;

  constructor(options: FakeOptions = {}) {
    this.analytics = options.analytics ?? FakeControlPlane.emptyAnalytics();
    if (options.withSession) {
      this.emit('session.started', 'alice', {
        sessionId: SESSION_ID,
        tenantId: 'acme',
        workspaceId: 'demo',
        title: 'Pairing on demo',
        ownerId: 'alice',
      });
      this.emit('doc.created', 'alice', { docId: 'notes', title: 'Runbook / notes', kind: 'notes', content: '' });
      this.emit('participant.joined', 'alice', { userId: 'alice' });
    }
  }

  static emptyAnalytics(): CollabAnalytics {
    return {
      tenantId: 'acme',
      window: { from: 0, to: 1 },
      generatedAt: 1,
      commands: { total: 0, succeeded: 0, failed: 0, canceled: 0, active: 0, successRate: null, byUser: [], byWorkspace: [], byCommand: [] },
      sessions: { started: 0, active: 0, ended: 0, totalDurationMs: 0, avgDurationMs: null, maxDurationMs: 0, distinctParticipants: 0, avgParticipants: null, commandsRun: 0, byWorkspace: [] },
      audit: { allowed: 0, denied: 0, authFailures: 0, deniedByCode: [] },
      timeline: { bucketMs: 60_000, buckets: [{ start: 0, commands: 0, failed: 0, sessions: 0 }] },
    };
  }

  /** Append a logged event and push it to every stream. */
  emit<T extends CollabEvent['type']>(type: T, actor: string, data: Extract<CollabEvent, { type: T }>['data']): void {
    this.clock += 1;
    const event = { seq: (this.state?.seq ?? 0) + 1, type, ts: this.clock, actor, data } as CollabEvent;
    this.state = applyCollabEvent(this.state, event);
    this.log.push(event);
    for (const s of this.streams) this.send(s.controller, event.type, event, event.seq);
  }

  private send(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown, id?: number): void {
    try {
      controller.enqueue(this.encoder.encode(`${id !== undefined ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch {
      // stream already closed
    }
  }

  private online(): string[] {
    return Array.from(new Set(this.streams.map((s) => s.user))).sort();
  }

  private snapshot(): CollabSnapshot {
    return { ...(this.state as CollabSnapshot), online: this.online(), rtc: { iceServers: [] } };
  }

  private broadcastPresence(): void {
    for (const s of this.streams) this.send(s.controller, 'presence', { online: this.online() });
  }

  private envelope(data: unknown, status = 200): Response {
    return new Response(JSON.stringify({ ok: true, data, warnings: [] }), { status, headers: { 'Content-Type': 'application/json' } });
  }

  private error(status: number, code: string, message: string): Response {
    return new Response(JSON.stringify({ ok: false, error: { code, message }, warnings: [] }), { status, headers: { 'Content-Type': 'application/json' } });
  }

  /** Simulate a command run by the driver: queued, started, output, finished. */
  runCommand(commandId: string, by: string, output: string[], exitCode = 0): string {
    this.jobCounter += 1;
    const jobId = `job-${this.jobCounter}`;
    this.emit('command.queued', by, { jobId, commandId, params: {}, requestedBy: by });
    this.emit('command.started', 'worker:w1', { jobId });
    output.forEach((data, i) => this.emit('command.output', 'worker:w1', { jobId, chunkSeq: i + 1, stream: 'stdout', data }));
    this.emit('command.finished', 'worker:w1', { jobId, status: exitCode === 0 ? 'succeeded' : 'failed', exitCode, errorCode: null });
    return jobId;
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const auth = new Headers(init?.headers).get('Authorization') ?? '';
    const user = TOKENS[auth.replace(/^Bearer /, '')] ?? null;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    this.requests.push({ method, path: url.pathname + url.search, user, body });
    if (!user) return this.error(401, 'UNAUTHENTICATED', 'Authentication required.');
    const path = url.pathname;

    if (method === 'GET' && path === '/me') {
      return this.envelope({ userId: user, tenants: [{ tenantId: 'acme', role: 'operator' }] });
    }
    if (method === 'GET' && path === '/tenants/acme/workspaces') {
      return this.envelope({ tenantId: 'acme', workspaces: [{ id: 'demo', tenantId: 'acme', name: 'Demo', allowedCommandIds: [] }] });
    }
    if (method === 'GET' && path === '/tenants/acme/policy') {
      return this.envelope({
        policy: { tenantId: 'acme', policyVersion: 1, policyPack: null, allowedCommandIds: [], workspaces: [{ id: 'demo', allowedCommandIds: [], effectiveCommandIds: ['workspace.summary', 'doctor'] }] },
      });
    }
    if (method === 'GET' && path === '/tenants/acme/analytics') return this.envelope({ analytics: this.analytics });
    if (method === 'GET' && path === '/tenants/acme/sessions') {
      const s = this.state;
      return this.envelope({
        sessions: s
          ? [{ ...s.session, participantCount: s.participants.length, onlineCount: this.online().length, runCount: s.runs.length }]
          : [],
      });
    }
    if (method === 'POST' && path === '/tenants/acme/sessions') {
      this.emit('session.started', user, {
        sessionId: SESSION_ID,
        tenantId: 'acme',
        workspaceId: String(body?.workspaceId),
        title: String(body?.title ?? 'Session'),
        ownerId: user,
      });
      this.emit('doc.created', user, { docId: 'notes', title: 'Runbook / notes', kind: 'notes', content: '' });
      this.emit('participant.joined', user, { userId: user });
      return this.envelope({ session: this.snapshot() }, 201);
    }

    const m = /^\/tenants\/acme\/sessions\/([^/]+)(?:\/(.*))?$/.exec(path);
    if (!m || !this.state || m[1] !== SESSION_ID) return this.error(404, 'SESSION_NOT_FOUND', 'Session not found in this tenant.');
    const rest = m[2] ?? '';

    if (method === 'GET' && rest === '') return this.envelope({ session: this.snapshot() });
    if (method === 'POST' && rest === 'join') {
      if (!this.state.participants.some((p) => p.userId === user)) this.emit('participant.joined', user, { userId: user });
      return this.envelope({ session: this.snapshot() });
    }
    if (method === 'POST' && rest === 'leave') {
      this.emit('participant.left', user, { userId: user });
      return this.envelope({ session: this.snapshot() });
    }
    if (method === 'POST' && rest === 'end') {
      this.emit('session.ended', user, { by: user });
      return this.envelope({ session: this.snapshot() });
    }
    if (method === 'POST' && rest === 'handover') {
      if (this.state.session.driverId !== user && this.state.session.ownerId !== user) {
        return this.error(403, 'NOT_SESSION_DRIVER', 'Only the current driver or the session owner can hand over control.');
      }
      this.emit('control.handover', user, { from: this.state.session.driverId, to: String(body?.toUserId), by: user, reason: 'handover' });
      return this.envelope({ session: this.snapshot() });
    }
    if (method === 'POST' && rest === 'run') {
      if (this.state.session.driverId !== user) {
        return this.error(403, 'NOT_SESSION_DRIVER', 'Only the current driver can run commands in this session.');
      }
      const jobId = this.runCommand(String(body?.commandId), user, [`output of ${String(body?.commandId)}\n`]);
      return this.envelope({ job: { id: jobId, status: 'queued', commandId: body?.commandId, requestedBy: user }, session: { seq: this.state.seq } }, 202);
    }
    if (method === 'POST' && rest === 'docs/notes/ops') {
      const baseRev = Number(body?.baseRev);
      let op = body?.ops as TextOp;
      for (const committed of this.docOps.filter((o) => o.rev > baseRev)) op = transformOps(committed.ops, op)[1];
      const doc = this.state.docs[0];
      const normalized = normalizeOp(op);
      applyOp(doc.content, normalized);
      const rev = doc.rev + 1;
      this.docOps.push({ rev, ops: normalized });
      this.emit('doc.op', user, { docId: 'notes', rev, ops: normalized as Array<string | number>, clientId: String(body?.clientId), clientSeq: Number(body?.clientSeq) });
      return this.envelope({ docId: 'notes', rev, ops: normalized, duplicate: false });
    }
    if (method === 'POST' && (rest === 'signal' || rest === 'relay')) {
      return this.envelope(rest === 'signal' ? { delivered: false } : { delivered: 0 });
    }
    if (method === 'GET' && rest === 'stream') {
      const afterSeq = url.searchParams.get('afterSeq');
      let entry: (typeof this.streams)[number] | undefined;
      const stream = new ReadableStream<Uint8Array>({
        start: (controller) => {
          entry = { user, controller };
          this.streams.push(entry);
          if (afterSeq !== null && Number(afterSeq) <= this.state!.seq) {
            for (const e of this.log.filter((x) => x.seq > Number(afterSeq))) this.send(controller, e.type, e, e.seq);
          } else {
            const snap = this.snapshot();
            this.send(controller, 'snapshot', snap, snap.seq);
          }
          this.send(controller, 'ready', { seq: this.state!.seq });
          this.broadcastPresence();
        },
        cancel: () => {
          this.streams = this.streams.filter((s) => s !== entry);
          this.broadcastPresence();
        },
      });
      init?.signal?.addEventListener('abort', () => {
        this.streams = this.streams.filter((s) => s !== entry);
        try {
          entry?.controller.close();
        } catch {
          // closed
        }
        this.broadcastPresence();
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    return this.error(404, 'NOT_FOUND', 'No such route.');
  };

  /** Close every open stream (simulates a server restart / network drop). */
  dropStreams(): void {
    for (const s of this.streams) {
      try {
        s.controller.close();
      } catch {
        // closed
      }
    }
    this.streams = [];
  }
}
