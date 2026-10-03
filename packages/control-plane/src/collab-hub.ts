import type {
  CollabEventEnvelope,
  CollabSnapshot,
  IceServerConfig,
  RelayMessage,
  RtcSignal,
} from '@re-shell/contracts';

import type { SqliteCollabStore } from './db/sqlite-collab.js';
import type { SqliteJobStore } from './db/sqlite-jobs.js';
import type { EventBus, TenantEvent } from './events.js';

/**
 * The live half of collaboration: who is connected to which session, fan-out of
 * logged events to those connections, ephemeral relays (presence, WebRTC
 * signaling, peer messages), and the bridge that turns a worker's job output
 * into ordered console events.
 *
 * It is in-process by design (the control plane is single-node, like the event
 * bus); durable truth always lives in {@link SqliteCollabStore}. Nothing here is
 * ever the only copy of anything a reconnecting client needs: it resumes from
 * the log, and presence is recomputed from live connections.
 */

/** A connected stream, as the HTTP glue (or a test) sees it. */
export interface StreamListener {
  readonly userId: string;
  snapshot(snapshot: CollabSnapshot): void;
  event(event: CollabEventEnvelope): void;
  /** Sent once the initial snapshot / replay is complete. */
  ready(seq: number): void;
  presence(online: string[]): void;
  signal(signal: RtcSignal): void;
  relay(message: RelayMessage): void;
}

export interface CollabHubOptions {
  store: SqliteCollabStore;
  jobs: SqliteJobStore;
  /** The tenant event bus; job output/status events wake the run bridge. */
  events: EventBus;
  now?: () => number;
  iceServers?: readonly IceServerConfig[];
  /** Safety-net poll for a missed wake-up (events are in-process and best effort). */
  pollMs?: number;
  /** A resume further behind than this many events gets a fresh snapshot instead. */
  replayLimit?: number;
  logger?: (entry: Record<string, unknown>) => void;
}

export type ConnectResult = { ok: true; close(): void } | { ok: false; code: 'SESSION_NOT_FOUND' };

const keyOf = (tenantId: string, sessionId: string): string => `${tenantId}\u0000${sessionId}`;

export class CollabHub {
  private readonly listeners = new Map<string, Set<StreamListener>>();
  private readonly tracked = new Map<string, { tenantId: string; sessionId: string; jobId: string }>();
  private readonly tenantSubscriptions = new Map<string, () => void>();
  private poller: NodeJS.Timeout | undefined;
  private closed = false;

  private readonly now: () => number;
  private readonly replayLimit: number;
  private readonly pollMs: number;

  constructor(private readonly options: CollabHubOptions) {
    this.now = options.now ?? Date.now;
    this.replayLimit = options.replayLimit ?? 20_000;
    this.pollMs = options.pollMs ?? 500;
  }

  get iceServers(): IceServerConfig[] {
    return [...(this.options.iceServers ?? [])];
  }

  // ---- connections -------------------------------------------------------------

  /** Distinct users with at least one live stream in the session. */
  online(tenantId: string, sessionId: string): string[] {
    const set = this.listeners.get(keyOf(tenantId, sessionId));
    if (!set) return [];
    return Array.from(new Set(Array.from(set, (l) => l.userId))).sort();
  }

  onlineCount(tenantId: string, sessionId: string): number {
    return this.online(tenantId, sessionId).length;
  }

  /** A full snapshot including ephemeral presence and the WebRTC configuration. */
  snapshot(tenantId: string, sessionId: string): CollabSnapshot | undefined {
    const base = this.options.store.snapshot(tenantId, sessionId);
    if (!base) return undefined;
    return { ...base, online: this.online(tenantId, sessionId), rtc: { iceServers: this.iceServers } };
  }

  /**
   * Attach a stream. With no usable cursor the listener first receives a full
   * snapshot; otherwise it receives exactly the events after `afterSeq`. Both
   * happen synchronously with registration, so no event can fall between the
   * catch-up and the live feed.
   */
  connect(
    tenantId: string,
    sessionId: string,
    listener: StreamListener,
    afterSeq?: number
  ): ConnectResult {
    const { store } = this.options;
    const session = store.getSession(tenantId, sessionId);
    if (!session) {
      return { ok: false, code: 'SESSION_NOT_FOUND' };
    }
    const key = keyOf(tenantId, sessionId);
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);

    const canResume =
      afterSeq !== undefined && afterSeq <= session.seq && session.seq - afterSeq <= this.replayLimit;
    if (canResume) {
      for (const event of store.eventsAfter(tenantId, sessionId, afterSeq, this.replayLimit)) {
        listener.event(event);
      }
    } else {
      const snapshot = this.snapshot(tenantId, sessionId);
      if (snapshot) listener.snapshot(snapshot);
    }
    listener.ready(session.seq);
    this.broadcastPresence(tenantId, sessionId);

    let closed = false;
    return {
      ok: true,
      close: () => {
        if (closed) return;
        closed = true;
        const current = this.listeners.get(key);
        current?.delete(listener);
        if (current && current.size === 0) {
          this.listeners.delete(key);
        }
        this.broadcastPresence(tenantId, sessionId);
      },
    };
  }

  private broadcastPresence(tenantId: string, sessionId: string): void {
    const set = this.listeners.get(keyOf(tenantId, sessionId));
    if (!set) return;
    const online = this.online(tenantId, sessionId);
    for (const listener of Array.from(set)) {
      try {
        listener.presence(online);
      } catch {
        // A broken connection must never stop delivery to the others.
      }
    }
  }

  // ---- fan-out ------------------------------------------------------------------

  /** Deliver committed events, in order, to every live stream of the session. */
  publish(tenantId: string, sessionId: string, events: readonly CollabEventEnvelope[]): void {
    const set = this.listeners.get(keyOf(tenantId, sessionId));
    if (!set || events.length === 0) return;
    for (const listener of Array.from(set)) {
      for (const event of events) {
        try {
          listener.event(event);
        } catch {
          // See broadcastPresence.
        }
      }
    }
  }

  /** Relay a signaling message to the target user's streams ONLY. Returns whether anyone received it. */
  signal(tenantId: string, sessionId: string, signal: RtcSignal): boolean {
    const set = this.listeners.get(keyOf(tenantId, sessionId));
    let delivered = false;
    if (!set) return false;
    for (const listener of Array.from(set)) {
      if (listener.userId !== signal.to) continue;
      try {
        listener.signal(signal);
        delivered = true;
      } catch {
        // See broadcastPresence.
      }
    }
    return delivered;
  }

  /** Relay a peer message to one user's streams, or to everyone but the sender when `to` is null. */
  relay(tenantId: string, sessionId: string, message: RelayMessage): number {
    const set = this.listeners.get(keyOf(tenantId, sessionId));
    let delivered = 0;
    if (!set) return 0;
    for (const listener of Array.from(set)) {
      const wanted = message.to === null ? listener.userId !== message.from : listener.userId === message.to;
      if (!wanted) continue;
      try {
        listener.relay(message);
        delivered += 1;
      } catch {
        // See broadcastPresence.
      }
    }
    return delivered;
  }

  // ---- command bridge -------------------------------------------------------------

  /** Start following a run: its job's status and output become console events. */
  trackRun(tenantId: string, sessionId: string, jobId: string): void {
    if (this.closed) return;
    this.tracked.set(jobId, { tenantId, sessionId, jobId });
    this.ensureTenantSubscription(tenantId);
    this.ensurePoller();
  }

  /** Pick up runs that were in flight when the process last stopped. */
  recover(): number {
    let count = 0;
    for (const run of this.options.store.openRuns()) {
      this.trackRun(run.tenantId, run.sessionId, run.jobId);
      this.pump(run.tenantId, run.sessionId, run.jobId);
      count += 1;
    }
    return count;
  }

  /** Bring one run's console up to date and publish what that logged. */
  pump(tenantId: string, sessionId: string, jobId: string): void {
    let events: CollabEventEnvelope[];
    try {
      events = this.options.store.pumpRun(tenantId, sessionId, jobId, this.options.jobs, this.now());
    } catch (error) {
      this.options.logger?.({
        level: 'error',
        message: 'collab run pump failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    this.publish(tenantId, sessionId, events);
    if (events.some((e) => e.type === 'command.finished')) {
      this.tracked.delete(jobId);
    } else {
      // A run that already finished (or vanished) must not stay tracked forever.
      const run = this.options.store.getRun(tenantId, sessionId, jobId);
      if (!run || run.status === 'succeeded' || run.status === 'failed' || run.status === 'canceled') {
        this.tracked.delete(jobId);
      }
    }
  }

  private ensureTenantSubscription(tenantId: string): void {
    if (this.tenantSubscriptions.has(tenantId)) return;
    const unsubscribe = this.options.events.subscribe(tenantId, (event: TenantEvent) => {
      if (event.type === 'job.output') {
        this.onJobActivity(event.tenantId, event.jobId);
      } else if (event.type === 'job.updated') {
        this.onJobActivity(event.tenantId, event.job.id);
      }
    });
    this.tenantSubscriptions.set(tenantId, unsubscribe);
  }

  private onJobActivity(tenantId: string, jobId: string): void {
    const run = this.tracked.get(jobId);
    if (run && run.tenantId === tenantId) {
      this.pump(run.tenantId, run.sessionId, run.jobId);
    }
  }

  private ensurePoller(): void {
    if (this.poller || this.closed) return;
    this.poller = setInterval(() => {
      if (this.tracked.size === 0) {
        if (this.poller) clearInterval(this.poller);
        this.poller = undefined;
        return;
      }
      for (const run of Array.from(this.tracked.values())) {
        this.pump(run.tenantId, run.sessionId, run.jobId);
      }
    }, this.pollMs);
    this.poller.unref();
  }

  /** Number of runs being followed (diagnostic). */
  get trackedRuns(): number {
    return this.tracked.size;
  }

  close(): void {
    this.closed = true;
    if (this.poller) clearInterval(this.poller);
    this.poller = undefined;
    for (const unsubscribe of this.tenantSubscriptions.values()) unsubscribe();
    this.tenantSubscriptions.clear();
    this.tracked.clear();
  }
}
