import { z } from 'zod';

import { OtError, applyOp, type TextOp } from './ot.js';

/**
 * Wire contracts for real-time collaboration (P9-N).
 *
 * The hosted control plane owns a SESSION per (tenant, workspace): an ordered,
 * sequence-numbered event log whose fold is the shared state every participant
 * sees — participants and who is driving, the command console (queued/running/
 * finished runs with their streamed output) and the shared text documents.
 *
 *   snapshot(seq N)  ==  fold(events 1..N)
 *
 * A late joiner receives a full snapshot and then incremental events; a
 * reconnecting client resumes with `afterSeq`. {@link applyCollabEvent} is the
 * ONE reducer used by the server tests, the CLI and the dashboard, so all three
 * agree on what an event means.
 *
 * Presence, WebRTC signaling and relayed peer messages are EPHEMERAL: they ride
 * the same stream but carry no sequence number and are never replayed.
 */

export const collabRoleSchema = z.enum(['driver', 'viewer']);
export type CollabRole = z.infer<typeof collabRoleSchema>;

export const collabSessionStatusSchema = z.enum(['active', 'ended']);

export const collabRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'canceled']);
export type CollabRunStatus = z.infer<typeof collabRunStatusSchema>;

export const collabDocKindSchema = z.enum(['notes', 'yaml-draft', 'text']);
export type CollabDocKind = z.infer<typeof collabDocKindSchema>;

export const collabParticipantSchema = z.object({
  userId: z.string(),
  role: collabRoleSchema,
  joinedAt: z.number(),
});
export type CollabParticipant = z.infer<typeof collabParticipantSchema>;

export const collabOutputChunkSchema = z.object({
  /** Position within the job's output (1-based), the same numbering as the job log. */
  seq: z.number().int(),
  stream: z.enum(['stdout', 'stderr']),
  data: z.string(),
});
export type CollabOutputChunk = z.infer<typeof collabOutputChunkSchema>;

export const collabRunSchema = z.object({
  jobId: z.string(),
  commandId: z.string(),
  params: z.record(z.string(), z.unknown()),
  requestedBy: z.string(),
  status: collabRunStatusSchema,
  exitCode: z.number().int().nullable(),
  errorCode: z.string().nullable(),
  queuedAt: z.number(),
  startedAt: z.number().nullable(),
  finishedAt: z.number().nullable(),
  output: z.array(collabOutputChunkSchema),
  /** True when older output was left out of a snapshot to bound its size. */
  outputDropped: z.boolean().optional(),
});
export type CollabRun = z.infer<typeof collabRunSchema>;

export const collabDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: collabDocKindSchema,
  rev: z.number().int().min(0),
  content: z.string(),
});
export type CollabDoc = z.infer<typeof collabDocSchema>;

export const collabSessionInfoSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  ownerId: z.string(),
  driverId: z.string().nullable(),
  status: collabSessionStatusSchema,
  createdAt: z.number(),
  endedAt: z.number().nullable(),
});
export type CollabSessionInfo = z.infer<typeof collabSessionInfoSchema>;

export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServerConfig = z.infer<typeof iceServerSchema>;

export const collabSnapshotSchema = z.object({
  /** Sequence number of the last event folded into this snapshot. */
  seq: z.number().int().min(0),
  session: collabSessionInfoSchema,
  participants: z.array(collabParticipantSchema),
  /** Runs oldest first. */
  runs: z.array(collabRunSchema),
  /** The queued or running job, if any (derived; the reducer keeps it current). */
  currentJobId: z.string().nullable(),
  docs: z.array(collabDocSchema),
  /** Participants with at least one live stream (ephemeral; resent on every connect). */
  online: z.array(z.string()),
  /** WebRTC configuration: empty `iceServers` means host candidates only. */
  rtc: z.object({ iceServers: z.array(iceServerSchema) }),
});
export type CollabSnapshot = z.infer<typeof collabSnapshotSchema>;

/** One entry of the ordered session log. */
const baseEvent = {
  seq: z.number().int().min(1),
  ts: z.number(),
  actor: z.string().nullable(),
};

export const collabEventSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseEvent,
    type: z.literal('session.started'),
    data: z.object({
      sessionId: z.string(),
      tenantId: z.string(),
      workspaceId: z.string(),
      title: z.string(),
      ownerId: z.string(),
    }),
  }),
  z.object({ ...baseEvent, type: z.literal('participant.joined'), data: z.object({ userId: z.string() }) }),
  z.object({ ...baseEvent, type: z.literal('participant.left'), data: z.object({ userId: z.string() }) }),
  z.object({
    ...baseEvent,
    type: z.literal('control.handover'),
    data: z.object({
      from: z.string().nullable(),
      to: z.string().nullable(),
      by: z.string(),
      reason: z.enum(['handover', 'driver-left']).optional(),
    }),
  }),
  z.object({
    ...baseEvent,
    type: z.literal('command.queued'),
    data: z.object({
      jobId: z.string(),
      commandId: z.string(),
      params: z.record(z.string(), z.unknown()),
      requestedBy: z.string(),
    }),
  }),
  z.object({ ...baseEvent, type: z.literal('command.started'), data: z.object({ jobId: z.string() }) }),
  z.object({
    ...baseEvent,
    type: z.literal('command.output'),
    data: z.object({
      jobId: z.string(),
      chunkSeq: z.number().int(),
      stream: z.enum(['stdout', 'stderr']),
      data: z.string(),
    }),
  }),
  z.object({
    ...baseEvent,
    type: z.literal('command.finished'),
    data: z.object({
      jobId: z.string(),
      status: z.enum(['succeeded', 'failed', 'canceled']),
      exitCode: z.number().int().nullable(),
      errorCode: z.string().nullable(),
    }),
  }),
  z.object({
    ...baseEvent,
    type: z.literal('doc.created'),
    data: z.object({
      docId: z.string(),
      title: z.string(),
      kind: collabDocKindSchema,
      content: z.string(),
    }),
  }),
  z.object({
    ...baseEvent,
    type: z.literal('doc.op'),
    data: z.object({
      docId: z.string(),
      /** The revision this op created (the doc was at rev - 1 before it). */
      rev: z.number().int().min(1),
      ops: z.array(z.union([z.number(), z.string()])),
      clientId: z.string(),
      clientSeq: z.number().int(),
    }),
  }),
  z.object({
    ...baseEvent,
    type: z.literal('session.ended'),
    data: z.object({ by: z.string(), reason: z.string().optional() }),
  }),
]);
export type CollabEvent = z.infer<typeof collabEventSchema>;
export type CollabEventType = CollabEvent['type'];

/** Any logged event, including types this build does not know (forward compatible). */
export const collabEventEnvelopeSchema = z.object({
  seq: z.number().int().min(1),
  type: z.string(),
  ts: z.number(),
  actor: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
});
export type CollabEventEnvelope = z.infer<typeof collabEventEnvelopeSchema>;

export const KNOWN_COLLAB_EVENT_TYPES: ReadonlySet<string> = new Set(
  collabEventSchema.options.map((option) => option.shape.type.value)
);

// --- ephemeral messages ------------------------------------------------------

export const rtcSignalKindSchema = z.enum(['offer', 'answer', 'candidate', 'bye']);
export type RtcSignalKind = z.infer<typeof rtcSignalKindSchema>;

/** A signaling message as DELIVERED: `from` is stamped by the server, never trusted from a body. */
export const rtcSignalSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: rtcSignalKindSchema,
  /** Identifies one peer connection attempt between the same two users. */
  connectionId: z.string(),
  payload: z.record(z.string(), z.unknown()),
  ts: z.number(),
});
export type RtcSignal = z.infer<typeof rtcSignalSchema>;

export const peerChannelSchema = z.enum(['presence', 'cursor', 'ping']);
export type PeerChannel = z.infer<typeof peerChannelSchema>;

/** A peer message relayed by the server when a direct data channel is not available. */
export const relayMessageSchema = z.object({
  from: z.string(),
  /** Null = every participant. */
  to: z.string().nullable(),
  channel: peerChannelSchema,
  payload: z.record(z.string(), z.unknown()),
  ts: z.number(),
});
export type RelayMessage = z.infer<typeof relayMessageSchema>;

// --- analytics ---------------------------------------------------------------

const countsSchema = z.object({
  total: z.number().int(),
  succeeded: z.number().int(),
  failed: z.number().int(),
  canceled: z.number().int(),
});

export const collabAnalyticsSchema = z.object({
  tenantId: z.string(),
  window: z.object({ from: z.number(), to: z.number() }),
  generatedAt: z.number(),
  commands: z.object({
    total: z.number().int(),
    succeeded: z.number().int(),
    failed: z.number().int(),
    canceled: z.number().int(),
    /** Queued or running right now. */
    active: z.number().int(),
    /** succeeded / (succeeded + failed); null when nothing finished (canceled runs are excluded). */
    successRate: z.number().nullable(),
    byUser: z.array(countsSchema.extend({ userId: z.string() })),
    byWorkspace: z.array(countsSchema.extend({ workspaceId: z.string() })),
    byCommand: z.array(countsSchema.extend({ commandId: z.string() })),
  }),
  sessions: z.object({
    started: z.number().int(),
    active: z.number().int(),
    ended: z.number().int(),
    totalDurationMs: z.number(),
    avgDurationMs: z.number().nullable(),
    maxDurationMs: z.number(),
    distinctParticipants: z.number().int(),
    avgParticipants: z.number().nullable(),
    /** Commands launched from a shared session (a subset of `commands.total`). */
    commandsRun: z.number().int(),
    byWorkspace: z.array(
      z.object({ workspaceId: z.string(), sessions: z.number().int(), totalDurationMs: z.number() })
    ),
  }),
  audit: z.object({
    allowed: z.number().int(),
    denied: z.number().int(),
    authFailures: z.number().int(),
    deniedByCode: z.array(z.object({ code: z.string(), count: z.number().int() })),
  }),
  timeline: z.object({
    bucketMs: z.number(),
    buckets: z.array(
      z.object({
        start: z.number(),
        commands: z.number().int(),
        failed: z.number().int(),
        sessions: z.number().int(),
      })
    ),
  }),
});
export type CollabAnalytics = z.infer<typeof collabAnalyticsSchema>;

export const collabSessionSummarySchema = collabSessionInfoSchema.extend({
  participantCount: z.number().int(),
  onlineCount: z.number().int(),
  runCount: z.number().int(),
});
export type CollabSessionSummary = z.infer<typeof collabSessionSummarySchema>;

// --- the reducer -------------------------------------------------------------

/** The shared state of a session at some sequence number. */
export type CollabState = CollabSnapshot;

/** The stream is out of step with local state (missed or reordered events): resync with a fresh snapshot. */
export class CollabSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollabSyncError';
  }
}

function currentJobOf(runs: readonly CollabRun[]): string | null {
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const run = runs[i];
    if (run.status === 'queued' || run.status === 'running') return run.jobId;
  }
  return null;
}

function withRoles(
  participants: readonly CollabParticipant[],
  driverId: string | null
): CollabParticipant[] {
  return participants.map((p) => {
    const role: CollabRole = p.userId === driverId ? 'driver' : 'viewer';
    return p.role === role ? p : { ...p, role };
  });
}

function mapRun(
  runs: readonly CollabRun[],
  jobId: string,
  update: (run: CollabRun) => CollabRun
): CollabRun[] {
  const index = runs.findIndex((r) => r.jobId === jobId);
  if (index === -1) {
    throw new CollabSyncError(`Event refers to an unknown run ${jobId}.`);
  }
  const next = runs.slice();
  next[index] = update(runs[index]);
  return next;
}

/**
 * Fold one logged event into the state. Pure and immutable (changed branches are
 * copied; untouched ones are shared, so React memoization works).
 *
 *  - a duplicate (`seq <= state.seq`) is ignored;
 *  - a gap (`seq > state.seq + 1`) throws {@link CollabSyncError};
 *  - `state` may be `undefined` only for the first event (`session.started`).
 *
 * `online` and `rtc` are ephemeral and are never changed by a logged event.
 */
export function applyCollabEvent(state: CollabState | undefined, event: CollabEvent): CollabState {
  if (state === undefined) {
    if (event.type !== 'session.started' || event.seq !== 1) {
      throw new CollabSyncError('The first event of a session must be session.started with seq 1.');
    }
    const d = event.data;
    return {
      seq: 1,
      session: {
        id: d.sessionId,
        tenantId: d.tenantId,
        workspaceId: d.workspaceId,
        title: d.title,
        ownerId: d.ownerId,
        driverId: d.ownerId,
        status: 'active',
        createdAt: event.ts,
        endedAt: null,
      },
      participants: [],
      runs: [],
      currentJobId: null,
      docs: [],
      online: [],
      rtc: { iceServers: [] },
    };
  }
  if (event.seq <= state.seq) {
    return state;
  }
  if (event.seq !== state.seq + 1) {
    throw new CollabSyncError(`Missed events: have ${state.seq}, received ${event.seq}.`);
  }
  const base = { ...state, seq: event.seq };

  switch (event.type) {
    case 'session.started':
      throw new CollabSyncError('Unexpected session.started after the first event.');
    case 'participant.joined': {
      if (state.participants.some((p) => p.userId === event.data.userId)) return base;
      const role: CollabRole = event.data.userId === state.session.driverId ? 'driver' : 'viewer';
      return {
        ...base,
        participants: [...state.participants, { userId: event.data.userId, role, joinedAt: event.ts }],
      };
    }
    case 'participant.left':
      return { ...base, participants: state.participants.filter((p) => p.userId !== event.data.userId) };
    case 'control.handover': {
      const driverId = event.data.to;
      return {
        ...base,
        session: { ...state.session, driverId },
        participants: withRoles(state.participants, driverId),
      };
    }
    case 'command.queued': {
      const d = event.data;
      const run: CollabRun = {
        jobId: d.jobId,
        commandId: d.commandId,
        params: d.params,
        requestedBy: d.requestedBy,
        status: 'queued',
        exitCode: null,
        errorCode: null,
        queuedAt: event.ts,
        startedAt: null,
        finishedAt: null,
        output: [],
      };
      const runs = [...state.runs, run];
      return { ...base, runs, currentJobId: currentJobOf(runs) };
    }
    case 'command.started': {
      const runs = mapRun(state.runs, event.data.jobId, (r) => ({
        ...r,
        status: 'running',
        startedAt: event.ts,
      }));
      return { ...base, runs, currentJobId: currentJobOf(runs) };
    }
    case 'command.output': {
      const d = event.data;
      const runs = mapRun(state.runs, d.jobId, (r) => ({
        ...r,
        output: [...r.output, { seq: d.chunkSeq, stream: d.stream, data: d.data }],
      }));
      return { ...base, runs };
    }
    case 'command.finished': {
      const d = event.data;
      const runs = mapRun(state.runs, d.jobId, (r) => ({
        ...r,
        status: d.status,
        exitCode: d.exitCode,
        errorCode: d.errorCode,
        // A run that finished without a recorded start (failed at claim time) never "started".
        finishedAt: event.ts,
      }));
      return { ...base, runs, currentJobId: currentJobOf(runs) };
    }
    case 'doc.created': {
      const d = event.data;
      if (state.docs.some((doc) => doc.id === d.docId)) {
        throw new CollabSyncError(`Document ${d.docId} already exists.`);
      }
      return {
        ...base,
        docs: [...state.docs, { id: d.docId, title: d.title, kind: d.kind, rev: 0, content: d.content }],
      };
    }
    case 'doc.op': {
      const d = event.data;
      const index = state.docs.findIndex((doc) => doc.id === d.docId);
      if (index === -1) {
        throw new CollabSyncError(`Event refers to an unknown document ${d.docId}.`);
      }
      const doc = state.docs[index];
      if (d.rev !== doc.rev + 1) {
        throw new CollabSyncError(`Document ${d.docId} is at rev ${doc.rev}; received rev ${d.rev}.`);
      }
      let content: string;
      try {
        content = applyOp(doc.content, d.ops as TextOp);
      } catch (error) {
        if (error instanceof OtError) {
          throw new CollabSyncError(`Document ${d.docId} diverged: ${error.message}`);
        }
        throw error;
      }
      const docs = state.docs.slice();
      docs[index] = { ...doc, rev: d.rev, content };
      return { ...base, docs };
    }
    case 'session.ended':
      return {
        ...base,
        session: { ...state.session, status: 'ended', endedAt: event.ts },
      };
  }
}

/**
 * Fold a batch of events. Convenience for tests and the CLI's snapshot mode.
 */
export function foldCollabEvents(events: readonly CollabEvent[], from?: CollabState): CollabState {
  let state = from;
  for (const event of events) {
    state = applyCollabEvent(state, event);
  }
  if (!state) {
    throw new CollabSyncError('No events to fold.');
  }
  return state;
}

/** The currently queued or running run, if any. */
export function currentRun(state: CollabState): CollabRun | undefined {
  return state.runs.find((run) => run.jobId === state.currentJobId);
}

/** Concatenate a run's stdout/stderr chunks in order. */
export function runOutputText(run: CollabRun): string {
  return run.output.map((chunk) => chunk.data).join('');
}

// --- SSE framing (browser + node; used by the CLI and the dashboard) -----------

export interface SseFrame {
  event: string;
  data: string;
  id?: string;
}

/**
 * Incremental SSE frame parser. Feed it decoded text; it returns the complete
 * frames found so far and keeps the remainder. Comment lines (`: ping`) and
 * `retry:` hints are skipped.
 */
export class SseFrameParser {
  private buffer = '';

  feed(text: string): SseFrame[] {
    this.buffer += text;
    const frames: SseFrame[] = [];
    for (;;) {
      const match = /\r?\n\r?\n/.exec(this.buffer);
      if (!match) break;
      const raw = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      const frame = parseSseFrame(raw);
      if (frame) frames.push(frame);
    }
    return frames;
  }
}

function parseSseFrame(raw: string): SseFrame | undefined {
  let event = 'message';
  let id: string | undefined;
  const data: string[] = [];
  let sawField = false;
  for (const line of raw.split(/\r?\n/)) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') {
      event = value;
      sawField = true;
    } else if (field === 'data') {
      data.push(value);
      sawField = true;
    } else if (field === 'id') {
      id = value;
    }
  }
  if (!sawField) return undefined;
  return { event, data: data.join('\n'), ...(id !== undefined ? { id } : {}) };
}

/** Read SSE frames from a fetch response body until it ends. */
export async function* readSseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseFrameParser();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const frame of parser.feed(decoder.decode(value, { stream: true }))) {
        yield frame;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The stream was already torn down.
    }
  }
}
