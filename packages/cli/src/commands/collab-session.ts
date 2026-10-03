import type { CollabEvent, CollabRun, CollabSnapshot } from '@re-shell/contracts';

import { loadContracts, type ContractsModule } from '../utils/contracts-runtime';
import { resolveTarget, type ControlPlaneFlags } from '../utils/control-plane-config';

/**
 * `re-shell collab session start|join|list|end|run|handover|cancel` — a real client
 * of the hosted control plane (docs/control-plane.md, "Collaboration"). Nothing
 * here is simulated: every command is an authenticated HTTP call, and `join` /
 * `run --wait` consume the live, ordered session stream.
 *
 * Commands return a {@link CommandResult}; the registrar prints it as the
 * standard JSON envelope or as text, and maps a failure to a non-zero exit.
 */

export interface SessionCliContext {
  flags: ControlPlaneFlags;
  json: boolean;
  env: NodeJS.ProcessEnv;
  /** Whether stdout is an interactive terminal. */
  isTTY: boolean;
  out: (text: string) => void;
  err: (text: string) => void;
  fetch?: typeof fetch;
  homedir?: string;
  /** Aborts a long-running command (Ctrl-C). */
  signal?: AbortSignal;
}

export interface CommandSuccess {
  ok: true;
  data: unknown;
  warnings: string[];
  human?: string;
  exitCode?: number;
}
export interface CommandFailure {
  ok: false;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  warnings?: string[];
}
export type CommandResult = CommandSuccess | CommandFailure;

/** (This package compiles without strictNullChecks, where boolean-literal unions do not narrow on their own.) */
export const isCommandFailure = (result: CommandResult): result is CommandFailure => result.ok === false;

const failure = (
  code: string,
  message: string,
  details?: Record<string, unknown>,
  warnings: string[] = []
): CommandFailure => ({ ok: false, code, message, ...(details ? { details } : {}), warnings });

/** Strip terminal control sequences from text that came from a remote command. */
export function sanitizeForTerminal(text: string): string {
  return (
    text
      // OSC (title, hyperlinks, clipboard) and CSI (cursor, erase, colors) sequences, then any other ESC pair.
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\u001b[@-Z\\-_]/g, '')
      // Remaining C0/C1 controls except newline and tab (a bare CR could overwrite earlier lines).
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '')
  );
}

interface Connected {
  contracts: ContractsModule;
  client: InstanceType<ContractsModule['ControlPlaneClient']>;
  tenant: string;
  warnings: string[];
}

async function connect(ctx: SessionCliContext): Promise<Connected | CommandFailure> {
  const resolved = resolveTarget({ flags: ctx.flags, env: ctx.env, homedir: ctx.homedir });
  if (resolved.ok === false) {
    return failure('CONFIG_ERROR', resolved.message, { missing: resolved.missing });
  }
  const contracts = await loadContracts();
  const client = new contracts.ControlPlaneClient({
    baseUrl: resolved.target.url,
    token: resolved.target.token,
    fetch: ctx.fetch,
  });
  let tenant = resolved.target.tenant;
  if (!tenant) {
    try {
      const me = await client.me();
      if (me.tenants.length === 1) {
        tenant = me.tenants[0].tenantId;
      } else {
        return failure(
          'CONFIG_ERROR',
          me.tenants.length === 0
            ? 'This token is not a member of any tenant.'
            : `This token belongs to ${me.tenants.length} tenants (${me.tenants.map((t) => t.tenantId).join(', ')}); choose one with --tenant or RE_SHELL_CONTROL_PLANE_TENANT.`,
          { tenants: me.tenants.map((t) => t.tenantId) }
        );
      }
    } catch (error) {
      return toFailure(error, resolved.warnings);
    }
  }
  return { contracts, client, tenant, warnings: resolved.warnings };
}

function isFailure(value: Connected | CommandResult): value is CommandFailure {
  return 'ok' in value;
}

function toFailure(error: unknown, warnings: string[] = []): CommandFailure {
  if (error && typeof error === 'object' && 'code' in error && 'status' in error) {
    const e = error as { code: string; message: string; status: number; details?: Record<string, unknown> };
    return failure(e.code, e.message, { status: e.status, ...(e.details ?? {}) }, warnings);
  }
  return failure('COLLAB_ERROR', error instanceof Error ? error.message : String(error), undefined, warnings);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function age(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m}m` : `${Math.round(m / 60)}h`;
}

function runLine(run: CollabRun): string {
  const status =
    run.status === 'succeeded'
      ? `succeeded (exit ${run.exitCode ?? 0})`
      : run.status === 'failed'
        ? `failed${run.exitCode !== null ? ` (exit ${run.exitCode})` : run.errorCode ? ` (${run.errorCode})` : ''}`
        : run.status;
  return `${run.commandId} by ${run.requestedBy}: ${status}`;
}

function indent(text: string, by = '    '): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? line : by + line))
    .join('\n');
}

/** A readable text rendering of a session snapshot. */
export function renderSnapshot(s: CollabSnapshot, now: number = Date.now()): string {
  const lines: string[] = [];
  const info = s.session;
  lines.push(`Session ${info.id} [${info.status}]  ${info.title}`);
  lines.push(`  workspace ${info.workspaceId}   owner ${info.ownerId}   driver ${info.driverId ?? '(nobody)'}   started ${age(now - info.createdAt)} ago`);
  lines.push('Participants');
  for (const p of s.participants) {
    lines.push(`  ${p.userId}  ${p.role}${s.online.includes(p.userId) ? '  online' : ''}`);
  }
  if (s.participants.length === 0) lines.push('  (none)');
  lines.push('Console');
  if (s.runs.length === 0) lines.push('  (no commands run yet)');
  s.runs.forEach((run, index) => {
    lines.push(`  #${index + 1} ${runLine(run)}`);
    const text = sanitizeForTerminal(run.output.map((c) => c.data).join(''));
    if (run.outputDropped) lines.push('    [earlier output omitted from this snapshot]');
    if (text.trim() !== '') lines.push(indent(text.replace(/\n$/, '')));
  });
  lines.push('Documents');
  for (const d of s.docs) {
    lines.push(`  ${d.id}  (${d.kind}, rev ${d.rev}, ${d.content.length} chars)`);
  }
  return lines.join('\n');
}

/** One live event as a line of text (null = nothing worth printing). */
export function renderEvent(event: CollabEvent): string | null {
  switch (event.type) {
    case 'participant.joined':
      return `* ${event.data.userId} joined`;
    case 'participant.left':
      return `* ${event.data.userId} left`;
    case 'control.handover':
      return `* ${event.data.to ?? '(nobody)'} is now driving${event.data.from ? ` (was ${event.data.from})` : ''}`;
    case 'command.queued':
      return `$ ${event.data.commandId}  (by ${event.data.requestedBy})`;
    case 'command.started':
      return null;
    case 'command.output':
      return sanitizeForTerminal(event.data.data);
    case 'command.finished':
      return `-- ${event.data.status}${event.data.exitCode !== null ? ` (exit ${event.data.exitCode})` : event.data.errorCode ? ` (${event.data.errorCode})` : ''}`;
    case 'doc.created':
      return `* document "${event.data.docId}" created`;
    case 'session.ended':
      return `* session ended by ${event.data.by}`;
    default:
      return null;
  }
}

function finalStatuses(): string[] {
  return ['succeeded', 'failed', 'canceled'];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function sessionStart(
  ctx: SessionCliContext,
  options: { workspace: string; title?: string }
): Promise<CommandResult> {
  const c = await connect(ctx);
  if (isFailure(c)) return c;
  try {
    const session = await c.client.createSession(c.tenant, { workspaceId: options.workspace, title: options.title });
    return {
      ok: true,
      data: { session },
      warnings: c.warnings,
      human: `Started session ${session.session.id} in workspace ${session.session.workspaceId}.\nShare it: re-shell collab session join ${session.session.id}`,
    };
  } catch (error) {
    return toFailure(error, c.warnings);
  }
}

export async function sessionList(
  ctx: SessionCliContext,
  options: { status?: string; workspace?: string; limit?: number }
): Promise<CommandResult> {
  if (options.status && options.status !== 'active' && options.status !== 'ended') {
    return failure('INVALID_REQUEST', '--status must be "active" or "ended".');
  }
  const c = await connect(ctx);
  if (isFailure(c)) return c;
  try {
    const sessions = await c.client.listSessions(c.tenant, {
      status: options.status as 'active' | 'ended' | undefined,
      workspaceId: options.workspace,
      limit: options.limit,
    });
    const now = Date.now();
    const human =
      sessions.length === 0
        ? 'No sessions.'
        : sessions
            .map(
              (s) =>
                `${s.id}  ${s.status.padEnd(6)}  ${s.workspaceId}  owner ${s.ownerId}  driver ${s.driverId ?? '-'}  ${s.participantCount} participant(s), ${s.onlineCount} online, ${s.runCount} run(s)  ${age(now - s.createdAt)} ago  ${s.title}`
            )
            .join('\n');
    return { ok: true, data: { tenantId: c.tenant, sessions }, warnings: c.warnings, human };
  } catch (error) {
    return toFailure(error, c.warnings);
  }
}

export async function sessionJoin(
  ctx: SessionCliContext,
  options: { sessionId: string; follow?: boolean; snapshot?: boolean }
): Promise<CommandResult> {
  const c = await connect(ctx);
  if (isFailure(c)) return c;
  // JSON mode and non-TTY output get a snapshot; a terminal streams unless told not to.
  const stream = !ctx.json && !options.snapshot && (options.follow === true || ctx.isTTY);
  try {
    let snapshot = await c.client.joinSession(c.tenant, options.sessionId);
    if (!stream) {
      // Presence and ordering come from the stream; the REST snapshot is the current state.
      snapshot = await c.client.getSession(c.tenant, options.sessionId);
      return { ok: true, data: { session: snapshot }, warnings: c.warnings, human: renderSnapshot(snapshot) };
    }

    const conn = c.client.connect(c.tenant, options.sessionId);
    const done = new Promise<void>((resolve) => {
      conn.on('status', (status) => {
        if (status === 'closed') resolve();
      });
      ctx.signal?.addEventListener('abort', () => resolve(), { once: true });
    });
    conn.on('reset', (state) => {
      ctx.out(`${renderSnapshot(state)}\n--- live (Ctrl-C to leave the stream; you stay a participant) ---\n`);
    });
    conn.on('event', (event) => {
      const line = renderEvent(event);
      if (line === null) return;
      ctx.out(event.type === 'command.output' ? line : `${line}\n`);
    });
    conn.on('error', (error) => ctx.err(`stream: ${error.message}\n`));
    await conn.start();
    await done;
    conn.close();
    return { ok: true, data: { session: conn.state }, warnings: c.warnings, human: '' };
  } catch (error) {
    return toFailure(error, c.warnings);
  }
}

export async function sessionEnd(
  ctx: SessionCliContext,
  options: { sessionId: string; reason?: string }
): Promise<CommandResult> {
  const c = await connect(ctx);
  if (isFailure(c)) return c;
  try {
    const session = await c.client.endSession(c.tenant, options.sessionId, options.reason);
    return { ok: true, data: { session }, warnings: c.warnings, human: `Session ${session.session.id} ended.` };
  } catch (error) {
    return toFailure(error, c.warnings);
  }
}

export async function sessionHandover(
  ctx: SessionCliContext,
  options: { sessionId: string; toUserId: string }
): Promise<CommandResult> {
  const c = await connect(ctx);
  if (isFailure(c)) return c;
  try {
    const session = await c.client.handover(c.tenant, options.sessionId, options.toUserId);
    return {
      ok: true,
      data: { session },
      warnings: c.warnings,
      human: `${options.toUserId} is now driving session ${session.session.id}.`,
    };
  } catch (error) {
    return toFailure(error, c.warnings);
  }
}

export async function sessionCancel(ctx: SessionCliContext, options: { sessionId: string }): Promise<CommandResult> {
  const c = await connect(ctx);
  if (isFailure(c)) return c;
  try {
    const { job } = await c.client.cancel(c.tenant, options.sessionId);
    return { ok: true, data: { job }, warnings: c.warnings, human: `Cancel requested for job ${job.id} (${job.status}).` };
  } catch (error) {
    return toFailure(error, c.warnings);
  }
}

/** Parse repeated `--param key=value` flags (values are strings, like the command registry's). */
export function parseParams(
  pairs: string[] | undefined,
  json: string | undefined
): { ok: true; params: Record<string, unknown> } | { ok: false; message: string } {
  let params: Record<string, unknown> = {};
  if (json !== undefined) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { ok: false, message: '--params-json must be a JSON object.' };
      }
      params = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, message: '--params-json is not valid JSON.' };
    }
  }
  for (const pair of pairs ?? []) {
    const eq = pair.indexOf('=');
    if (eq <= 0) {
      return { ok: false, message: `--param expects key=value, got "${pair}".` };
    }
    const key = pair.slice(0, eq);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return { ok: false, message: `--param key "${key}" is not allowed.` };
    }
    params[key] = pair.slice(eq + 1);
  }
  return { ok: true, params };
}

export async function sessionRun(
  ctx: SessionCliContext,
  options: {
    sessionId: string;
    commandId: string;
    params?: string[];
    paramsJson?: string;
    wait?: boolean;
    timeoutMs?: number;
  }
): Promise<CommandResult> {
  const parsed = parseParams(options.params, options.paramsJson);
  if (parsed.ok === false) return failure('INVALID_REQUEST', parsed.message);
  const c = await connect(ctx);
  if (isFailure(c)) return c;
  const wait = options.wait !== false;
  try {
    if (!wait) {
      const queued = await c.client.run(c.tenant, options.sessionId, options.commandId, parsed.params);
      return {
        ok: true,
        data: { job: queued.job, run: null },
        warnings: c.warnings,
        human: `Queued ${options.commandId} as job ${queued.job.id}.`,
      };
    }

    const conn = c.client.connect(c.tenant, options.sessionId);
    await conn.start();
    try {
      const queued = await c.client.run(c.tenant, options.sessionId, options.commandId, parsed.params);
      const jobId = queued.job.id;
      let printed = 0;
      const drain = (state: CollabSnapshot): void => {
        if (ctx.json) return;
        const run = state.runs.find((r) => r.jobId === jobId);
        if (!run) return;
        for (const chunk of run.output) {
          if (chunk.seq > printed) {
            ctx.out(sanitizeForTerminal(chunk.data));
            printed = chunk.seq;
          }
        }
      };
      conn.on('state', drain);
      const aborted = new Promise<never>((_, reject) =>
        ctx.signal?.addEventListener('abort', () => reject(new Error('Interrupted; the command keeps running on the worker.')), { once: true })
      );
      const state = await Promise.race([
        conn.waitFor(
          (s) => s.runs.some((r) => r.jobId === jobId && finalStatuses().includes(r.status)),
          options.timeoutMs ?? 600_000,
          `${options.commandId} to finish`
        ),
        aborted,
      ]);
      drain(state);
      const run = state.runs.find((r) => r.jobId === jobId) as CollabRun;
      const output = run.output.map((chunk) => chunk.data).join('');
      const summary = {
        jobId,
        commandId: run.commandId,
        status: run.status,
        exitCode: run.exitCode,
        errorCode: run.errorCode,
        output,
        outputDropped: run.outputDropped === true,
      };
      if (run.status !== 'succeeded') {
        return failure(
          'COLLAB_ERROR',
          `${run.commandId} ${run.status}${run.exitCode !== null ? ` with exit code ${run.exitCode}` : run.errorCode ? ` (${run.errorCode})` : ''}.`,
          { run: summary },
          c.warnings
        );
      }
      return { ok: true, data: { job: queued.job, run: summary }, warnings: c.warnings, human: '' };
    } finally {
      conn.close();
    }
  } catch (error) {
    return toFailure(error, c.warnings);
  }
}
