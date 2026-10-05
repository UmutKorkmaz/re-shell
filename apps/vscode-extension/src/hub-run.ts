import * as http from 'node:http';
import * as https from 'node:https';

import {
  HubJobCollector,
  SseParser,
  buildEventsRequest,
  type HubConfig,
} from './core/hub-client.js';

/**
 * Thin (NOT pure) client that runs one command through the local Re-Shell hub
 * and settles with the job's result. Request shaping, SSE parsing and event
 * folding all live in `core/hub-client.ts`; this file only owns the socket.
 *
 * Every failure is reported explicitly as `{ ok: false, kind, message }`; there
 * is no fallback that pretends a job ran. The hub URL (which carries the token
 * in its query string) is never included in a message.
 */

export type HubRunFailureKind =
  /** Nothing is listening / the connection could not be made. */
  | 'unreachable'
  /** 401: the hub rejected the session token. */
  | 'unauthorized'
  /** 400: the hub refused the request (unknown commandId, bad params, cwd outside its workspace). */
  | 'rejected'
  /** Any other non-200 status. */
  | 'http'
  /** The stream ended without an `exit` event. */
  | 'truncated'
  /** The job did not finish within the timeout; the request was aborted. */
  | 'timeout'
  /** The caller aborted the run. */
  | 'cancelled';

export type HubRunResult =
  | {
      readonly ok: true;
      readonly exitCode: number;
      readonly stdout: string;
      readonly stderr: string;
      readonly protocolProblems: readonly string[];
    }
  | {
      readonly ok: false;
      readonly kind: HubRunFailureKind;
      readonly message: string;
      readonly status?: number;
    };

export interface RunHubJobOptions {
  /** Abort the run (and, via the hub's disconnect handling, the job) after this long. */
  readonly timeoutMs?: number;
  /** Abort the run when this signal fires (e.g. a VS Code progress cancel). */
  readonly signal?: AbortSignal;
  /** Called with each stdout/stderr fragment as it streams in. */
  readonly onOutput?: (stream: 'stdout' | 'stderr', fragment: string) => void;
}

const MAX_ERROR_BODY_BYTES = 8 * 1024;

/**
 * Run `{ commandId, params }` on the hub and resolve with the job result. The
 * hub resolves the pair against its own allow-list registry; a raw command/argv
 * is never sent.
 */
export function runHubJob(
  config: HubConfig,
  commandId: string,
  params: unknown,
  options: RunHubJobOptions = {}
): Promise<HubRunResult> {
  return new Promise<HubRunResult>((resolve) => {
    const descriptor = buildEventsRequest(config, commandId, params);
    const url = new URL(descriptor.url);
    const transport = url.protocol === 'https:' ? https : http;

    const parser = new SseParser();
    const collector = new HubJobCollector();

    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;

    const finish = (result: HubRunResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (abortListener) {
        options.signal?.removeEventListener('abort', abortListener);
      }
      resolve(result);
    };

    const fail = (kind: HubRunFailureKind, message: string, status?: number): void => {
      finish({ ok: false, kind, message, ...(status !== undefined ? { status } : {}) });
      // Destroying the socket makes the hub reap the child process.
      req.destroy();
    };

    const req = transport.request(
      url,
      { method: descriptor.method, headers: { ...descriptor.headers } },
      (res) => {
        const status = res.statusCode ?? 0;
        res.setEncoding('utf8');

        if (status !== 200) {
          let body = '';
          res.on('data', (chunk: string) => {
            if (body.length < MAX_ERROR_BODY_BYTES) {
              body += chunk;
            }
          });
          res.on('end', () => {
            const detail = readHubError(body);
            if (status === 401) {
              fail(
                'unauthorized',
                'The hub rejected the session token (401). Check "reShell.hub.token" / RE_SHELL_UI_HUB_TOKEN.',
                status
              );
            } else if (status === 400) {
              fail('rejected', `The hub refused the request: ${detail}`, status);
            } else {
              fail('http', `The hub answered HTTP ${status}${detail ? `: ${detail}` : ''}`, status);
            }
          });
          return;
        }

        res.on('data', (chunk: string) => {
          for (const payload of parser.push(chunk)) {
            const event = collector.feed(payload);
            if (
              event &&
              options.onOutput &&
              (event.type === 'stdout' || event.type === 'stderr') &&
              event.content !== undefined
            ) {
              options.onOutput(event.type, event.content);
            }
          }
        });
        res.on('end', () => {
          const result = collector.result();
          if (result) {
            finish({ ok: true, ...result, protocolProblems: collector.protocolProblems });
          } else {
            fail('truncated', 'The hub closed the stream before the job reported an exit code.');
          }
        });
        res.on('error', (err) => {
          // `aborted` after a completed exit is not a failure of the job.
          const result = collector.result();
          if (result) {
            finish({ ok: true, ...result, protocolProblems: collector.protocolProblems });
          } else {
            fail('truncated', `The hub stream broke before the job finished: ${err.message}`);
          }
        });
        res.on('close', () => {
          // A socket reset that surfaces only as 'close' (no 'end'/'error').
          const result = collector.result();
          if (!settled) {
            if (result) {
              finish({ ok: true, ...result, protocolProblems: collector.protocolProblems });
            } else {
              fail('truncated', 'The hub connection closed before the job reported an exit code.');
            }
          }
        });
      }
    );

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) {
        return;
      }
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'EHOSTUNREACH') {
        fail('unreachable', `Could not reach the hub (${err.code}). Is \`re-shell ui\` (or the hub server) running?`);
      } else {
        fail('unreachable', `Hub request failed: ${err.message}`);
      }
    });

    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        fail('timeout', `The hub job did not finish within ${options.timeoutMs} ms; the run was aborted.`);
      }, options.timeoutMs);
    }

    if (options.signal) {
      if (options.signal.aborted) {
        fail('cancelled', 'The run was cancelled.');
        return;
      }
      abortListener = () => fail('cancelled', 'The run was cancelled.');
      options.signal.addEventListener('abort', abortListener, { once: true });
    }

    req.end();
  });
}

/** Pull `{ "error": "..." }` out of a hub error body, falling back to raw text. */
function readHubError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // not JSON
  }
  return body.trim().slice(0, 200);
}
