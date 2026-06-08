import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drive the reads with the SAME client the dashboard ships (SseClient), proving
// the real transport — not a bespoke fetch loop. SseClient uses the global
// `fetch` (present in Node 20) and attaches the session token as a header, so it
// runs unchanged under vitest's node environment.
import { SseClient } from '../../../packages/ui/src/hub/sse-client.js';
import type {
  WsClientMessage,
  WsServerMessage,
} from '@umutkorkmaz/contracts';
import { wsServerMessageSchema } from '@umutkorkmaz/contracts';

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const REAL_CLI_BIN = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');
const DEMO_MONOREPO = path.join(HERE, '..', 'e2e', 'fixtures', 'demo-monorepo');

// A fresh per-run token; the hub refuses to start without one.
const TOKEN = `e2e-${randomBytes(16).toString('hex')}`;

// A fixed dashboard port so the hub's allowed-origin set is deterministic
// regardless of the ephemeral hub port. The WS Origin is built from it.
const DASHBOARD_PORT = 47321;
const ALLOWED_ORIGIN = `http://127.0.0.1:${DASHBOARD_PORT}`;

// Read command ids exercised over SSE, each expected to round-trip a valid
// `{ ok: true, ... }` envelope produced by the LIVE re-shell CLI.
const SSE_READ_COMMAND_IDS = [
  'workspace.summary',
  'workspace.graph',
  'workspace.health',
  'templates.list',
  'commands.list',
] as const;

interface HubHandle {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

/**
 * Boot a fresh hub on an OS-assigned ephemeral port (port: 0 — the OS hands back
 * a real port, never the falsy-zero default) against the demo monorepo, wired to
 * spawn the REAL built re-shell CLI. The module is re-imported per call so the
 * hub's module-level state never leaks across tests.
 */
async function startHub(): Promise<HubHandle> {
  vi.resetModules();
  process.env.RE_SHELL_UI_HUB_TOKEN = TOKEN;
  process.env.RE_SHELL_CLI_BIN = REAL_CLI_BIN;
  process.env.RE_SHELL_WORKSPACE = DEMO_MONOREPO;
  process.env.VITE_RE_SHELL_UI_PORT = String(DASHBOARD_PORT);
  process.env.VITE_RE_SHELL_UI_HOST = '127.0.0.1';
  delete process.env.RE_SHELL_UI_HUB_PORT;

  const mod = await import('../src/hub-server.ts');
  const info = await mod.startHubServer({ port: 0 });
  return {
    port: info.port,
    url: info.url,
    stop: () => mod.stopHubServer(info.server),
  };
}

/**
 * Drive a single read commandId over SSE using the dashboard's SseClient and
 * resolve with the reassembled JSON envelope (or reject on error/timeout). The
 * await is bounded so the test can never hang on a stalled stream.
 */
function readOverSse(
  hubUrl: string,
  commandId: string,
  token: string | undefined,
  timeoutMs = 15_000
): Promise<unknown> {
  const url = `${hubUrl}/events?commandId=${encodeURIComponent(commandId)}`;
  return new Promise<unknown>((resolve, reject) => {
    let settled = false;
    let firstJson: unknown = null;

    const client = new SseClient({
      url,
      token,
      retries: 1,
      onJson: (parsed) => {
        if (firstJson === null) {
          firstJson = parsed;
        }
      },
      onError: (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        client.close();
        reject(err);
      },
      onDone: () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(firstJson);
      },
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      client.close();
      reject(new Error(`SSE read for "${commandId}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    void client.connect();
  });
}

/** Open a raw WS to /jobs, smuggling the token via Sec-WebSocket-Protocol. */
function openWs(port: number, opts: { token?: string; origin?: string } = {}): WebSocket {
  const protocols = opts.token ? [`re-shell-token.${opts.token}`] : undefined;
  return new WebSocket(`ws://127.0.0.1:${port}/jobs`, protocols, {
    headers: {
      Host: '127.0.0.1',
      Origin: opts.origin ?? ALLOWED_ORIGIN,
    },
  });
}

/** Resolve when the WS opens, or report the close code if it is refused first. */
function waitForOpenOrClose(ws: WebSocket): Promise<{ opened: boolean; code?: number }> {
  return new Promise((resolve) => {
    ws.once('open', () => resolve({ opened: true }));
    ws.once('close', (code) => resolve({ opened: false, code }));
    ws.once('error', () => {
      /* error precedes close; let close settle the promise */
    });
  });
}

/**
 * Run an allow-listed job over WS and collect every validated server frame until
 * the job's `exit` frame (or the bounded timeout). Proves CLI -> hub -> client
 * streaming with live stdout frames carrying `content`.
 */
function runJobOverWs(
  port: number,
  job: { id: string; commandId: string; params?: unknown },
  token: string,
  timeoutMs = 20_000
): Promise<WsServerMessage[]> {
  return new Promise<WsServerMessage[]>((resolve, reject) => {
    const frames: WsServerMessage[] = [];
    let settled = false;
    const ws = openWs(port, { token });

    const finish = (err?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.removeAllListeners('message');
      ws.close();
      if (err) {
        reject(err);
      } else {
        resolve(frames);
      }
    };

    const timer = setTimeout(
      () => finish(new Error(`WS job "${job.commandId}" timed out after ${timeoutMs}ms`)),
      timeoutMs
    );

    ws.once('open', () => {
      const start: WsClientMessage = {
        type: 'start',
        id: job.id,
        commandId: job.commandId,
        params: job.params,
      };
      ws.send(JSON.stringify(start));
    });

    ws.on('message', (raw: Buffer) => {
      const parsed = wsServerMessageSchema.safeParse(JSON.parse(raw.toString()));
      if (!parsed.success) return;
      const msg = parsed.data;
      // Heartbeats are connection-level noise; ignore them for the job tally.
      if (msg.type === 'heartbeat') return;
      if (msg.id !== undefined && msg.id !== job.id) return;
      frames.push(msg);
      if (msg.type === 'exit') {
        finish();
      }
    });

    ws.once('error', () => finish(new Error('WS transport error before job completion')));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hub round-trip: dashboard transport -> live CLI -> client', () => {
  let hub: HubHandle | undefined;

  beforeEach(() => {
    // The executable proof requires the built CLI; surface a clear failure if a
    // prior build step did not run rather than a confusing spawn error later.
    if (!fs.existsSync(REAL_CLI_BIN)) {
      throw new Error(`Built re-shell CLI missing at ${REAL_CLI_BIN}; build packages/cli first.`);
    }
    if (!fs.existsSync(path.join(DEMO_MONOREPO, 'package.json'))) {
      throw new Error(`Demo monorepo fixture missing at ${DEMO_MONOREPO}`);
    }
  });

  afterEach(async () => {
    // stopHubServer SIGTERMs every active child and closes every socket, so no
    // CLI process or connection leaks across tests.
    if (hub) {
      await hub.stop();
      hub = undefined;
    }
  });

  it(
    'streams a valid {ok:true} envelope over SSE for every read commandId (live CLI)',
    async () => {
      hub = await startHub();

      for (const commandId of SSE_READ_COMMAND_IDS) {
        const envelope = (await readOverSse(hub.url, commandId, TOKEN)) as {
          ok?: boolean;
          data?: unknown;
        } | null;

        expect(envelope, `no envelope reassembled for ${commandId}`).not.toBeNull();
        expect(envelope?.ok, `envelope.ok !== true for ${commandId}`).toBe(true);
        expect(envelope?.data, `envelope.data missing for ${commandId}`).toBeDefined();
      }

      // Spot-check the structural shapes the dashboard relies on, proving the
      // real CLI feed (not just any JSON) reached the client.
      const summary = (await readOverSse(hub.url, 'workspace.summary', TOKEN)) as {
        data?: { workspaces?: unknown[]; root?: string };
      };
      expect(Array.isArray(summary.data?.workspaces)).toBe(true);
      // The demo fixture defines exactly three workspaces.
      expect(summary.data?.workspaces).toHaveLength(3);

      const health = (await readOverSse(hub.url, 'workspace.health', TOKEN)) as {
        data?: { checks?: unknown[] };
      };
      expect(Array.isArray(health.data?.checks)).toBe(true);

      const templates = (await readOverSse(hub.url, 'templates.list', TOKEN)) as {
        data?: unknown[];
      };
      expect(Array.isArray(templates.data)).toBe(true);
      expect((templates.data ?? []).length).toBeGreaterThan(0);
    },
    30_000
  );

  it(
    'runs an allow-listed job over WS: live stdout frames carry content, then exit (CLI->hub->client)',
    async () => {
      hub = await startHub();

      const frames = await runJobOverWs(
        hub.port,
        { id: 'job-summary-1', commandId: 'workspace.summary' },
        TOKEN
      );

      // At least one stdout frame carried real CLI output content.
      const stdoutFrames = frames.filter((f) => f.type === 'stdout');
      expect(stdoutFrames.length).toBeGreaterThan(0);
      expect(stdoutFrames.every((f) => typeof f.content === 'string' && f.content.length > 0)).toBe(
        true
      );

      // The reassembled stdout is the live CLI's `{ok:true}` summary envelope.
      const combined = stdoutFrames.map((f) => f.content ?? '').join('');
      const parsed = JSON.parse(combined) as { ok?: boolean; data?: { workspaces?: unknown[] } };
      expect(parsed.ok).toBe(true);
      expect(parsed.data?.workspaces).toHaveLength(3);

      // A terminal exit frame closed the job, scoped to this job id.
      const exitFrame = frames.find((f) => f.type === 'exit');
      expect(exitFrame, 'no exit frame received').toBeDefined();
      expect(exitFrame?.id).toBe('job-summary-1');
      expect(typeof exitFrame?.code).toBe('number');
    },
    30_000
  );

  it(
    'rejects an SSE read WITHOUT the token (HTTP 401) before any spawn',
    async () => {
      hub = await startHub();

      // Raw fetch, no token, explicit fetch intent — the hub must 401.
      const res = await fetch(`${hub.url}/events?commandId=workspace.summary`, {
        headers: { Accept: 'text/event-stream' },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe('Unauthorized');
    },
    30_000
  );

  it(
    'rejects a WS job WITHOUT the token (socket closed, no job runs)',
    async () => {
      hub = await startHub();

      // Open without a token. The upgrade may succeed (the token can arrive in
      // the first message), but the first non-auth message closes the socket
      // with the policy-violation code 1008 and never starts a job.
      const ws = openWs(hub.port, { origin: ALLOWED_ORIGIN }); // no token
      await waitForOpenOrClose(ws);

      const closeCode = await new Promise<number>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('WS did not close in time')), 10_000);
        ws.once('close', (code) => {
          clearTimeout(t);
          resolve(code);
        });
        const start: WsClientMessage = {
          type: 'start',
          id: 'unauth-1',
          commandId: 'workspace.summary',
        };
        ws.send(JSON.stringify(start));
      });

      expect(closeCode).toBe(1008);

      // Give any (erroneous) output a moment to NOT arrive: nothing is asserted
      // beyond the close, but this confirms the socket is fully torn down.
      await delay(50);
      expect(ws.readyState).toBe(WebSocket.CLOSED);
    },
    30_000
  );
});
