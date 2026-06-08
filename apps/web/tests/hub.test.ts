import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';

import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsonReassembler } from '../../../packages/ui/src/hub/json-reassembler.js';
import type {
  SseEvent,
  WsServerMessage,
  WsClientMessage,
} from 're-shell-contracts';
import { sseEventSchema, wsServerMessageSchema } from 're-shell-contracts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUB_CLI = path.join(HERE, 'fixtures', 'stub-cli.mjs');
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const REAL_CLI_BIN = path.join(REPO_ROOT, 'packages', 'cli', 'dist', 'index.js');

const TOKEN = 'test-session-token-abc123';
// A fixed dashboard port so the hub's allowed-origin set is predictable
// regardless of the ephemeral hub port. The matching Origin is built from it.
const DASHBOARD_PORT = 45999;
const ALLOWED_ORIGIN = `http://127.0.0.1:${DASHBOARD_PORT}`;
const DISALLOWED_ORIGIN = 'http://evil.example.com:1234';

// A path that a shell-injection payload would create if metacharacters were
// ever interpreted. The test asserts it is NEVER created.
const PWNED_MARKER = path.join(os.tmpdir(), `re-shell-pwned-${process.pid}`);

interface HubHandle {
  port: number;
  url: string;
  server: http.Server;
  stop: () => Promise<void>;
}

/**
 * Boot a fresh hub on an OS-assigned ephemeral port (port: 0) with the test
 * token, dashboard origin, and CLI binary wired in via env. The module is
 * re-imported per call so module-level hub state never leaks across tests.
 */
async function startHub(opts: {
  cliBin: string;
  workspaceRoot: string;
}): Promise<HubHandle> {
  vi.resetModules();
  process.env.RE_SHELL_UI_HUB_TOKEN = TOKEN;
  process.env.RE_SHELL_CLI_BIN = opts.cliBin;
  process.env.RE_SHELL_WORKSPACE = opts.workspaceRoot;
  process.env.VITE_RE_SHELL_UI_PORT = String(DASHBOARD_PORT);
  process.env.VITE_RE_SHELL_UI_HOST = '127.0.0.1';
  delete process.env.RE_SHELL_UI_HUB_PORT;

  const mod = await import('../src/hub-server.ts');
  const info = await mod.startHubServer({ port: 0 });
  return {
    port: info.port,
    url: info.url,
    server: info.server,
    stop: () => mod.stopHubServer(info.server),
  };
}

/** Open an authenticated WS connection (token on the handshake protocol). */
function openWs(url: string, opts: { origin?: string; token?: string } = {}): WebSocket {
  const protocols = opts.token ? [`re-shell-token.${opts.token}`] : undefined;
  const headers: Record<string, string> = {
    Host: `127.0.0.1`,
    Origin: opts.origin ?? ALLOWED_ORIGIN,
  };
  return new WebSocket(url, protocols, { headers });
}

function wsUrl(port: number): string {
  return `ws://127.0.0.1:${port}/jobs`;
}

/** Wait for a WS to open or surface the close/error reason. */
function waitForOpenOrClose(ws: WebSocket): Promise<{ opened: boolean; code?: number }> {
  return new Promise((resolve) => {
    ws.once('open', () => resolve({ opened: true }));
    ws.once('close', (code) => resolve({ opened: false, code }));
    ws.once('error', () => {
      /* error precedes close; let close settle the promise */
    });
  });
}

describe('hub-server security + transport', () => {
  let workspaceRoot: string;
  let hub: HubHandle | undefined;

  beforeEach(() => {
    // A real temp workspace so cwd containment has a concrete root to enforce.
    workspaceRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-ws-'))
    );
    if (fs.existsSync(PWNED_MARKER)) {
      fs.rmSync(PWNED_MARKER);
    }
  });

  afterEach(async () => {
    if (hub) {
      await hub.stop();
      hub = undefined;
    }
    if (fs.existsSync(workspaceRoot)) {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    }
    if (fs.existsSync(PWNED_MARKER)) {
      fs.rmSync(PWNED_MARKER);
    }
  });

  it('rejects /events, /status, /jobs without the token', async () => {
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    // SSE/status over HTTP without the token → 401.
    const status = await fetch(`${hub.url}/status`, {
      headers: { Accept: 'application/json' },
    });
    expect(status.status).toBe(401);

    const events = await fetch(
      `${hub.url}/events?commandId=commands.list`,
      { headers: { Accept: 'text/event-stream' } }
    );
    expect(events.status).toBe(401);
    await events.body?.cancel();

    // WS upgrade without the token: the handshake succeeds (token may arrive in
    // the first message), but the first non-auth message closes with policy
    // violation 1008, and no job is ever run.
    const ws = openWs(wsUrl(hub.port), { origin: ALLOWED_ORIGIN }); // no token
    await waitForOpenOrClose(ws);
    const closed = new Promise<number>((resolve) => {
      ws.once('close', (code) => resolve(code));
    });
    ws.send(JSON.stringify({ type: 'start', id: 'x', commandId: 'commands.list' }));
    const code = await closed;
    expect(code).toBe(1008);
  });

  it('accepts /status and /events WITH the token', async () => {
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    const status = await fetch(`${hub.url}/status`, {
      headers: { Accept: 'application/json', 'X-Re-Shell-UI-Hub-Token': TOKEN },
    });
    expect(status.status).toBe(200);
    const body = (await status.json()) as { status: string };
    expect(body.status).toBe('connected');

    // SSE with token (via query param) yields a 200 event-stream.
    const events = await fetch(
      `${hub.url}/events?commandId=commands.list&token=${TOKEN}`,
      { headers: { Accept: 'text/event-stream' } }
    );
    expect(events.status).toBe(200);
    expect(events.headers.get('content-type')).toContain('text/event-stream');
    await events.body?.cancel();
  });

  it('rejects an unregistered commandId with no spawn', async () => {
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    const res = await fetch(
      `${hub.url}/events?commandId=not.a.real.command&token=${TOKEN}`,
      { headers: { Accept: 'text/event-stream' } }
    );
    // Allow-list miss is a 400 with a registry error, never a 200 stream.
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unknown commandId');
  });

  it('treats shell metacharacters in a param as a literal argv element (no injection)', async () => {
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    // `templates.list --language <value>`: the value carries an injection
    // payload. With a no-shell spawn it must arrive as a single literal argv
    // element and the marker file must never be created.
    const injection = `; touch ${PWNED_MARKER}`;
    const params = encodeURIComponent(JSON.stringify({ language: injection }));

    const stdoutLines: string[] = [];
    const reassembler = new JsonReassembler();
    let parsed: unknown = null;

    await consumeSse(
      `${hub.url}/events?commandId=templates.list&params=${params}&token=${TOKEN}`,
      (event) => {
        if (event.type === 'stdout' && event.content) {
          stdoutLines.push(event.content);
          const out = reassembler.append(event.id, event.content);
          if (out !== null) {
            parsed = out;
          }
        }
        if (event.type === 'exit') {
          const flushed = reassembler.flush(event.id);
          if (flushed !== null) {
            parsed = flushed;
          }
        }
      }
    );

    // The marker file was never created → metacharacters were not interpreted.
    expect(fs.existsSync(PWNED_MARKER)).toBe(false);

    // The stub echoed the argv; the injection value is present verbatim as ONE
    // element (not split, not a separate command).
    const echoed = parsed as { data?: { argv?: string[] } } | null;
    expect(echoed?.data?.argv).toBeDefined();
    expect(echoed?.data?.argv).toContain(injection);
  });

  it('rejects a cwd outside the workspace root', async () => {
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    // `commands.list` accepts an optional cwd in its base schema. Point it at a
    // sibling of the workspace root (an escape) → containment rejects with 400.
    const escape = path.join(workspaceRoot, '..', 'definitely-outside');
    const params = encodeURIComponent(JSON.stringify({ cwd: escape }));

    const res = await fetch(
      `${hub.url}/events?commandId=commands.list&params=${params}&token=${TOKEN}`,
      { headers: { Accept: 'text/event-stream' } }
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('workspace root');
  });

  it('reaps a long-running child when its WS socket disconnects', async () => {
    // The hub captures process.env at SPAWN time (when the `start` message is
    // handled), not at startHub() time. STUB_CLI_SLEEP_MS must therefore stay
    // set until after the child has actually spawned, or the stub falls back to
    // one-shot mode and exits immediately. It is cleared once the child PID is
    // captured.
    process.env.STUB_CLI_SLEEP_MS = '60000';
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    let childPid = 0;
    try {
      const ws = openWs(wsUrl(hub.port), {
        origin: ALLOWED_ORIGIN,
        token: TOKEN,
      });
      await waitForOpenOrClose(ws);

      // Snapshot live stub PIDs before, then start a long job and capture its PID.
      const before = listStubPids();
      const startMsg: WsClientMessage = {
        type: 'start',
        id: 'long-1',
        commandId: 'commands.list',
      };
      ws.send(JSON.stringify(startMsg));

      // Wait until exactly one new stub child has appeared.
      childPid = await waitFor(async () => {
        const now = listStubPids();
        const fresh = now.filter((p) => !before.includes(p));
        return fresh.length === 1 ? fresh[0] : undefined;
      });
      expect(childPid).toBeGreaterThan(0);
      expect(isAlive(childPid)).toBe(true);

      // Disconnect the socket → the hub must SIGTERM the child it owns.
      ws.close();
    } finally {
      delete process.env.STUB_CLI_SLEEP_MS;
    }

    const gone = await waitFor(async () =>
      isAlive(childPid) ? undefined : true
    );
    expect(gone).toBe(true);
  });

  it('isolates job output: client B never receives client A job frames', async () => {
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    const a = openWs(wsUrl(hub.port), { origin: ALLOWED_ORIGIN, token: TOKEN });
    const b = openWs(wsUrl(hub.port), { origin: ALLOWED_ORIGIN, token: TOKEN });
    await Promise.all([waitForOpenOrClose(a), waitForOpenOrClose(b)]);

    const aFrames: WsServerMessage[] = [];
    const bFrames: WsServerMessage[] = [];
    a.on('message', (raw) => {
      const msg = wsServerMessageSchema.safeParse(JSON.parse(raw.toString()));
      if (msg.success) aFrames.push(msg.data);
    });
    b.on('message', (raw) => {
      const msg = wsServerMessageSchema.safeParse(JSON.parse(raw.toString()));
      if (msg.success) bFrames.push(msg.data);
    });

    // A starts a job that emits stdout + exit. B starts nothing.
    const aJobId = 'a-job-1';
    a.send(
      JSON.stringify({ type: 'start', id: aJobId, commandId: 'commands.list' })
    );

    // Wait for A's job to finish (its exit frame for aJobId).
    await waitFor(async () =>
      aFrames.some((f) => f.type === 'exit' && f.id === aJobId) ? true : undefined
    );

    // Give any erroneous cross-talk a moment to (not) arrive.
    await delay(100);

    // B must have received nothing carrying A's job id, and no stdout at all.
    expect(bFrames.some((f) => f.id === aJobId)).toBe(false);
    expect(bFrames.some((f) => f.type === 'stdout')).toBe(false);
    // A did receive its own stdout + exit.
    expect(aFrames.some((f) => f.type === 'stdout' && f.id === aJobId)).toBe(true);

    a.close();
    b.close();
  });

  it('refuses a WS upgrade with a disallowed Origin before any spawn', async () => {
    hub = await startHub({ cliBin: STUB_CLI, workspaceRoot });

    const before = listStubPids();
    const ws = openWs(wsUrl(hub.port), {
      origin: DISALLOWED_ORIGIN,
      token: TOKEN,
    });
    const result = await waitForOpenOrClose(ws);

    // The upgrade is refused at the HTTP level (403), so the WS never opens.
    expect(result.opened).toBe(false);

    // No stub child was ever spawned by the refused upgrade.
    await delay(100);
    const after = listStubPids();
    expect(after.filter((p) => !before.includes(p))).toHaveLength(0);
  });

  it('reassembles a chunked --json envelope into one object via the client helper', async () => {
    // Use the REAL CLI so a genuine --json envelope is produced and streamed,
    // then reassembled by the shared JsonReassembler (the client-side helper).
    // `doctor --json` is deterministic regardless of cwd and emits a compact,
    // well-formed envelope; `commands list` is avoided here because the CLI
    // truncates its very large (>64KB) stdout on a fast process.exit (a
    // separate CLI-side flush bug), which would test the CLI, not the helper.
    hub = await startHub({ cliBin: REAL_CLI_BIN, workspaceRoot });

    const reassembler = new JsonReassembler();
    const reassembled: unknown[] = [];

    await consumeSse(
      `${hub.url}/events?commandId=doctor&token=${TOKEN}`,
      (event) => {
        if (event.type === 'stdout' && event.content) {
          const out = reassembler.append(event.id, event.content);
          if (out !== null) {
            reassembled.push(out);
          }
        }
        if (event.type === 'exit') {
          const flushed = reassembler.flush(event.id);
          if (flushed !== null) {
            reassembled.push(flushed);
          }
        }
      }
    );

    // Exactly one valid object reassembled from the (possibly chunked) stream.
    expect(reassembled).toHaveLength(1);
    const envelope = reassembled[0] as {
      ok?: boolean;
      data?: { checks?: unknown };
    };
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data?.checks)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Drive an SSE stream to completion, validating every frame against the
 * contract schema and invoking `onEvent` for each. Resolves when the stream
 * ends (server closes the response after the child exits).
 */
async function consumeSse(
  url: string,
  onEvent: (event: SseEvent) => void
): Promise<void> {
  const res = await fetch(url, { headers: { Accept: 'text/event-stream' } });
  if (res.status !== 200) {
    throw new Error(`SSE request failed: ${res.status}`);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('SSE response has no body');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const parsed = sseEventSchema.safeParse(JSON.parse(line.slice(6)));
      if (parsed.success) {
        onEvent(parsed.data);
      }
    }
  }
}

/**
 * List PIDs of currently-running stub-cli.mjs processes.
 *
 * `ps -A` output on a busy machine easily exceeds execSync's default 1MB
 * buffer, which throws ENOBUFS and would silently report zero stubs; a generous
 * maxBuffer keeps the full listing intact. execFileSync (argv form, no shell)
 * is used so this helper itself never goes through /bin/sh.
 */
function listStubPids(): number[] {
  try {
    const out = execFileSync('ps', ['-A', '-o', 'pid=,command='], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .split('\n')
      .filter((l) => l.includes('stub-cli.mjs'))
      .map((l) => Number.parseInt(l.trim().split(/\s+/)[0], 10))
      .filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

/** True when a PID is still alive (signal 0 probe). */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Poll `fn` until it returns a non-undefined value or the deadline passes.
 * All awaiting happens before assertion so nothing throws post-resolve.
 */
async function waitFor<T>(
  fn: () => Promise<T | undefined>,
  timeoutMs = 8000,
  intervalMs = 50
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result !== undefined) {
      return result;
    }
    if (Date.now() > deadline) {
      throw new Error('waitFor timed out');
    }
    await delay(intervalMs);
  }
}
