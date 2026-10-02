import { z } from 'zod';
import { jsonResponseSchema } from '@re-shell/contracts';
import type { CatalogEntry } from './catalog.js';

/**
 * PURE module. No VS Code, no network I/O.
 *
 * Shapes requests to the local Re-Shell UI hub. The hub NEVER accepts a raw
 * command/argv from a client; it only accepts a stable `commandId` + opaque
 * `params`, which it resolves against its own allow-list registry
 * (apps/web/src/hub/command-registry.ts). This module mirrors that contract:
 *
 *   - It maps a catalog entry to the hub's `run` allow-list (the only generic
 *     entry the hub exposes), via `subcommand`.
 *   - It builds the exact SSE request descriptor the hub expects:
 *       GET /events?commandId=<id>&params=<json>&cwd=<cwd>
 *     with the token in the `x-re-shell-ui-hub-token` header AND `?token=`.
 *
 * Building the descriptor is side-effect-free; the thin VS Code layer performs
 * the actual fetch. That keeps request shaping fully unit-testable.
 */

/**
 * The hub's `run` allow-list of subcommand paths (kept in sync with
 * RUN_ALLOWED_SUBCOMMANDS in apps/web/src/hub/command-registry.ts). A catalog
 * entry is hub-runnable only if its path is on this list.
 */
export const HUB_RUN_ALLOWED_SUBCOMMANDS = [
  'workspace summary',
  'workspace graph',
  'workspace health',
  'workspace list',
  'workspace validate',
  'templates list',
  'commands list',
  'doctor',
  'analyze',
] as const;

export type HubRunSubcommand = (typeof HUB_RUN_ALLOWED_SUBCOMMANDS)[number];

const hubRunSubcommandSchema = z.enum(HUB_RUN_ALLOWED_SUBCOMMANDS);

/** Connection details for the local hub. */
export interface HubConfig {
  /** Base URL, e.g. `http://127.0.0.1:3334`. */
  readonly baseUrl: string;
  /** Session token presented to the hub. */
  readonly token: string;
}

/** True when a catalog entry maps onto the hub `run` allow-list. */
export function isHubRunnable(entry: CatalogEntry): boolean {
  return hubRunSubcommandSchema.safeParse(entry.path).success;
}

/**
 * Map a catalog entry to the hub `run` request `{ commandId, params }`. Only
 * allow-listed subcommands resolve; everything else is rejected (the editor
 * must fall back to copy/paste rather than execute).
 */
export type HubRunRequest =
  | { ok: true; commandId: 'run'; params: { subcommand: HubRunSubcommand; cwd?: string } }
  | { ok: false; error: string };

export function toHubRunRequest(entry: CatalogEntry, cwd?: string): HubRunRequest {
  const parsed = hubRunSubcommandSchema.safeParse(entry.path);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        `"${entry.path}" is not on the hub run allow-list. ` +
        `Allowed: ${HUB_RUN_ALLOWED_SUBCOMMANDS.join(', ')}.`,
    };
  }
  const params: { subcommand: HubRunSubcommand; cwd?: string } = { subcommand: parsed.data };
  if (cwd !== undefined && cwd !== '') {
    params.cwd = cwd;
  }
  return { ok: true, commandId: 'run', params };
}

/**
 * A fully-described, side-effect-free HTTP request the thin layer can hand to
 * `fetch`. Shaping it here (not firing it) keeps the contract testable.
 */
export interface HubHttpRequest {
  readonly method: 'GET';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Build the SSE `/events` request descriptor for a `{ commandId, params }`
 * pair. Token is sent BOTH as the `x-re-shell-ui-hub-token` header and as a
 * `?token=` query param (the hub accepts either; the header is the canonical
 * fetch path, the query param keeps parity with browser SSE).
 *
 * `Sec-Fetch-Mode: cors` is set so the hub's anti-`<img>`/navigation guard
 * accepts the request as a genuine programmatic fetch.
 */
export function buildEventsRequest(
  config: HubConfig,
  commandId: string,
  params: unknown
): HubHttpRequest {
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/events`);
  url.searchParams.set('commandId', commandId);
  url.searchParams.set('params', JSON.stringify(params ?? {}));
  url.searchParams.set('token', config.token);

  return {
    method: 'GET',
    url: url.toString(),
    headers: {
      'x-re-shell-ui-hub-token': config.token,
      Accept: 'text/event-stream',
      'Sec-Fetch-Mode': 'cors',
    },
  };
}

/** Build the `/health` probe descriptor (used to verify the hub is reachable). */
export function buildHealthRequest(config: HubConfig): HubHttpRequest {
  const base = config.baseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/health`);
  url.searchParams.set('token', config.token);
  return {
    method: 'GET',
    url: url.toString(),
    headers: {
      'x-re-shell-ui-hub-token': config.token,
      Accept: 'application/json',
      'Sec-Fetch-Mode': 'cors',
    },
  };
}

// ---------------------------------------------------------------------------
// SSE response handling
// ---------------------------------------------------------------------------

/**
 * One event on the hub's `/events` stream. This mirrors the hub's `JobResponse`
 * (apps/web/src/hub-server.ts): `stdout`/`stderr` carry a `content` fragment and
 * `exit` carries the numeric exit `code`. `heartbeat` is a WebSocket-only
 * message and is accepted (then ignored) for forward compatibility.
 */
export const hubJobEventSchema = z.object({
  type: z.enum(['stdout', 'stderr', 'exit', 'heartbeat']),
  content: z.string().optional(),
  code: z.number().optional(),
  id: z.string().optional(),
  ts: z.string().optional(),
});
export type HubJobEvent = z.infer<typeof hubJobEventSchema>;

/**
 * Incremental Server-Sent-Events parser. Feed it raw text chunks as they arrive
 * from the socket (chunk boundaries may fall anywhere, including mid-line or
 * between the `\r` and `\n` of a CRLF); it returns the `data` payload of every
 * event completed by that chunk. Comment lines (`: ping` keepalives) and the
 * `event:`/`id:`/`retry:` fields are ignored; multi-line `data:` fields are
 * joined with `\n` as the SSE spec requires.
 */
export class SseParser {
  private buffer = '';
  private data: string[] = [];

  push(chunk: string): string[] {
    this.buffer += chunk;
    const events: string[] = [];

    // A trailing `\r` could be the first half of a CRLF whose `\n` arrives in the
    // next chunk, so hold it back instead of treating it as a line end.
    let rest = this.buffer;
    let carry = '';
    if (rest.endsWith('\r')) {
      carry = '\r';
      rest = rest.slice(0, -1);
    }
    const lines = rest.split(/\r\n|\n|\r/);
    // The last segment is an unterminated line; keep it for the next chunk.
    this.buffer = (lines.pop() ?? '') + carry;

    for (const line of lines) {
      if (line === '') {
        if (this.data.length > 0) {
          events.push(this.data.join('\n'));
          this.data = [];
        }
        continue;
      }
      if (line.startsWith(':')) {
        continue; // comment / keepalive
      }
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
      if (field === 'data') {
        this.data.push(value);
      }
    }
    return events;
  }
}

/** The settled outcome of one hub job. */
export interface HubJobResult {
  /** Process exit code reported by the hub's `exit` event. */
  readonly exitCode: number;
  /** All `stdout` fragments, concatenated (see {@link HubJobCollector}). */
  readonly stdout: string;
  /** All `stderr` fragments, joined with newlines. */
  readonly stderr: string;
}

/**
 * Folds hub job events into a {@link HubJobResult}.
 *
 * The hub forwards child output in pipe-sized chunks and splits each chunk on
 * newlines, dropping blank lines; it does not mark where a chunk ended. Every
 * `--json` command emits ONE JSON document, and JSON never contains a raw
 * newline inside a token, so concatenating `stdout` fragments with no separator
 * reassembles the document exactly (a separator would corrupt a value that a
 * chunk boundary split). `stderr` is diagnostic text, so its fragments are kept
 * on separate lines.
 */
export class HubJobCollector {
  private readonly out: string[] = [];
  private readonly err: string[] = [];
  private exit: number | undefined;
  private readonly problems: string[] = [];

  /**
   * Feed one SSE `data` payload and return the parsed event. Malformed payloads
   * are recorded in {@link protocolProblems} (and return `undefined`), never
   * thrown.
   */
  feed(payload: string): HubJobEvent | undefined {
    let json: unknown;
    try {
      json = JSON.parse(payload);
    } catch {
      this.problems.push(`non-JSON event payload: ${payload.slice(0, 120)}`);
      return undefined;
    }
    const parsed = hubJobEventSchema.safeParse(json);
    if (!parsed.success) {
      this.problems.push(`unrecognised event: ${payload.slice(0, 120)}`);
      return undefined;
    }
    const event = parsed.data;
    if (event.type === 'stdout') {
      this.out.push(event.content ?? '');
    } else if (event.type === 'stderr') {
      this.err.push(event.content ?? '');
    } else if (event.type === 'exit') {
      this.exit = event.code ?? 1;
    }
    return event;
  }

  /** True once the hub has reported the job's exit. */
  get done(): boolean {
    return this.exit !== undefined;
  }

  /** Protocol irregularities seen so far (malformed or unknown events). */
  get protocolProblems(): readonly string[] {
    return this.problems;
  }

  /** The settled result, or `undefined` while the job has not exited. */
  result(): HubJobResult | undefined {
    if (this.exit === undefined) {
      return undefined;
    }
    return { exitCode: this.exit, stdout: this.out.join(''), stderr: this.err.join('\n') };
  }
}

/** Outcome of reading a job's stdout as the CLI's JSON envelope. */
export type ParsedJobEnvelope =
  | { ok: true; data: unknown; warnings: string[] }
  | { ok: false; error: string; code?: string };

const anyEnvelopeSchema = jsonResponseSchema(z.unknown());

/**
 * Validate a job's stdout against the shared `{ ok, data|error, warnings }`
 * envelope from `@re-shell/contracts`. An `ok:false` envelope surfaces the CLI's
 * own error code + message; anything that is not the envelope is an error -
 * output is never trusted just because the exit code was 0.
 */
export function parseJobEnvelope(stdout: string): ParsedJobEnvelope {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'The command produced no output.' };
  }
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'The command output is not valid JSON.' };
  }
  const parsed = anyEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: 'The command output does not match the JSON envelope contract.' };
  }
  if (!parsed.data.ok) {
    return {
      ok: false,
      error: `[${parsed.data.error.code}] ${parsed.data.error.message}`,
      code: parsed.data.error.code,
    };
  }
  return { ok: true, data: parsed.data.data, warnings: parsed.data.warnings };
}
