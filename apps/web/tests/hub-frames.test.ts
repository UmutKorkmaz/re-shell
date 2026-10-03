import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  sseEventSchema,
  wsAuthMessageSchema,
  wsClientMessageSchema,
  wsServerMessageSchema,
  type SseEvent,
  type WsClientMessage,
  type WsServerMessage,
} from '@re-shell/contracts';

/**
 * The hub no longer re-declares its wire messages: it validates every inbound
 * WebSocket frame with the @re-shell/contracts client-message schemas and types
 * every outbound frame / SSE event against the server-message schemas. These tests
 * drive the real hub (with the stub CLI) over a real socket to pin that behaviour:
 * the first-message auth handshake, explicit rejection of malformed frames, and
 * contract-conformant output.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUB_CLI = path.join(HERE, 'fixtures', 'stub-cli.mjs');

const TOKEN = 'frames-test-token-9f2c';
const DASHBOARD_PORT = 45998;
const ALLOWED_ORIGIN = `http://127.0.0.1:${DASHBOARD_PORT}`;

interface Hub {
  port: number;
  url: string;
  server: http.Server;
  stop: () => Promise<void>;
}

async function startHub(workspaceRoot: string): Promise<Hub> {
  vi.resetModules();
  process.env.RE_SHELL_UI_HUB_TOKEN = TOKEN;
  process.env.RE_SHELL_CLI_BIN = STUB_CLI;
  process.env.RE_SHELL_WORKSPACE = workspaceRoot;
  process.env.VITE_RE_SHELL_UI_PORT = String(DASHBOARD_PORT);
  process.env.VITE_RE_SHELL_UI_HOST = '127.0.0.1';
  delete process.env.RE_SHELL_UI_HUB_PORT;

  const mod = await import('../src/hub-server.ts');
  const info = await mod.startHubServer({ port: 0 });
  return { port: info.port, url: info.url, server: info.server, stop: () => mod.stopHubServer(info.server) };
}

/** Collects every server frame, validating each against the contract as it arrives. */
class Frames {
  readonly all: WsServerMessage[] = [];
  private waiters: Array<() => void> = [];

  constructor(ws: WebSocket) {
    ws.on('message', (raw) => {
      const parsed = wsServerMessageSchema.safeParse(JSON.parse(raw.toString()));
      // A non-conformant frame is a contract violation by the hub: fail loudly.
      if (!parsed.success) {
        throw new Error(`hub sent a frame that violates wsServerMessageSchema: ${raw.toString()}`);
      }
      this.all.push(parsed.data);
      this.waiters.splice(0).forEach((wake) => wake());
    });
  }

  /** Resolve once `predicate` matches a collected frame (polling on each arrival). */
  async until(predicate: (f: WsServerMessage) => boolean, timeoutMs = 10_000): Promise<WsServerMessage> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.all.find(predicate);
      if (hit) return hit;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`timed out waiting for a frame; got ${JSON.stringify(this.all)}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }
}

function open(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
    ws.once('close', () => resolve());
  });
}

function connect(hub: Hub, opts: { token?: string } = {}): WebSocket {
  const protocols = opts.token ? [`re-shell-token.${opts.token}`] : undefined;
  return new WebSocket(`ws://127.0.0.1:${hub.port}/jobs`, protocols, {
    headers: { Host: '127.0.0.1', Origin: ALLOWED_ORIGIN },
  });
}

function send(ws: WebSocket, message: WsClientMessage | unknown): void {
  ws.send(JSON.stringify(message));
}

describe('hub WebSocket frames are validated against @re-shell/contracts', () => {
  let workspaceRoot: string;
  let hub: Hub | undefined;

  beforeEach(() => {
    workspaceRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-frames-')));
  });

  afterEach(async () => {
    if (hub) {
      await hub.stop();
      hub = undefined;
    }
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  describe('first-message auth handshake', () => {
    it('authenticates with { type: "auth", token } and then runs a job, all frames conformant', async () => {
      hub = await startHub(workspaceRoot);
      const ws = connect(hub); // no token on the handshake
      await open(ws);
      const frames = new Frames(ws);

      const auth: WsClientMessage = { type: 'auth', token: TOKEN };
      expect(wsClientMessageSchema.safeParse(auth).success).toBe(true);
      send(ws, auth);
      // A heartbeat acknowledges the handshake.
      await frames.until((f) => f.type === 'heartbeat');

      send(ws, { type: 'start', id: 'job-auth-1', commandId: 'commands.list' });
      const exit = await frames.until((f) => f.type === 'exit' && f.id === 'job-auth-1');
      expect(exit.code).toBe(0);
      expect(frames.all.some((f) => f.type === 'stdout' && f.id === 'job-auth-1')).toBe(true);
      ws.close();
    });

    it.each([
      ['a wrong token', { type: 'auth', token: 'not-the-token' }],
      ['an auth message without a token', { type: 'auth' }],
      ['a job message before auth', { type: 'start', id: 'x', commandId: 'commands.list' }],
      ['a non-object frame', 'hello'],
    ])('closes with 1008 on %s', async (_label, frame) => {
      hub = await startHub(workspaceRoot);
      const ws = connect(hub);
      await open(ws);
      const closed = new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)));
      send(ws, frame);
      expect(await closed).toBe(1008);
    });
  });

  describe('malformed frames after auth are answered explicitly', () => {
    async function authed(): Promise<{ ws: WebSocket; frames: Frames }> {
      hub = await startHub(workspaceRoot);
      const ws = connect(hub, { token: TOKEN });
      await open(ws);
      return { ws, frames: new Frames(ws) };
    }

    it('a start without an id gets a stderr frame and spawns nothing', async () => {
      const { ws, frames } = await authed();
      send(ws, { type: 'start', commandId: 'commands.list' });
      const reply = await frames.until((f) => f.type === 'stderr');
      expect(reply.content).toBe('Invalid start message: missing id');
      expect(reply.id).toBeUndefined();
      ws.close();
    });

    it('a start with an empty id is the same as a missing id', async () => {
      const { ws, frames } = await authed();
      send(ws, { type: 'start', id: '', commandId: 'commands.list' });
      const reply = await frames.until((f) => f.type === 'stderr');
      expect(reply.content).toBe('Invalid start message: missing id');
      ws.close();
    });

    it('a cancel without an id gets a stderr frame', async () => {
      const { ws, frames } = await authed();
      send(ws, { type: 'cancel' });
      const reply = await frames.until((f) => f.type === 'stderr');
      expect(reply.content).toBe('Invalid cancel message: missing id');
      ws.close();
    });

    it('a start whose commandId is not a string is rejected with stderr + a failing exit for that job', async () => {
      const { ws, frames } = await authed();
      send(ws, { type: 'start', id: 'bad-1', commandId: ['rm', '-rf', '/'] });
      const reply = await frames.until((f) => f.type === 'stderr' && f.id === 'bad-1');
      expect(reply.content).toMatch(/^Invalid start message: /);
      const exit = await frames.until((f) => f.type === 'exit' && f.id === 'bad-1');
      expect(exit.code).toBe(1);
      expect(frames.all.some((f) => f.type === 'stdout')).toBe(false);
      ws.close();
    });

    it('an unregistered commandId is still rejected by the registry (stderr + exit 1)', async () => {
      const { ws, frames } = await authed();
      send(ws, { type: 'start', id: 'unk-1', commandId: 'not.a.command' });
      const reply = await frames.until((f) => f.type === 'stderr' && f.id === 'unk-1');
      expect(reply.content).toContain('Unknown commandId');
      const exit = await frames.until((f) => f.type === 'exit' && f.id === 'unk-1');
      expect(exit.code).toBe(1);
      ws.close();
    });

    it('a non-object frame is reported, and the socket stays usable', async () => {
      const { ws, frames } = await authed();
      send(ws, [1, 2, 3]);
      const reply = await frames.until((f) => f.type === 'stderr');
      expect(reply.content).toBe('Failed to parse message: expected a JSON object');

      send(ws, { type: 'start', id: 'after-1', commandId: 'commands.list' });
      const exit = await frames.until((f) => f.type === 'exit' && f.id === 'after-1');
      expect(exit.code).toBe(0);
      ws.close();
    });

    it('unparseable JSON is reported through the same stderr channel', async () => {
      const { ws, frames } = await authed();
      ws.send('{not json');
      const reply = await frames.until((f) => f.type === 'stderr');
      expect(reply.content).toMatch(/^Failed to parse message: /);
      ws.close();
    });

    it('a frame of an unknown type is ignored (and does not disturb the next one)', async () => {
      const { ws, frames } = await authed();
      send(ws, { type: 'ping', id: 'p-1' });
      send(ws, { type: 'start', id: 'next-1', commandId: 'commands.list' });
      const exit = await frames.until((f) => f.type === 'exit');
      expect(exit.id).toBe('next-1');
      expect(frames.all.some((f) => f.type === 'stderr')).toBe(false);
      ws.close();
    });
  });

  describe('SSE events conform to sseEventSchema', () => {
    it('every event of a streamed job validates, ending in a numeric exit', async () => {
      hub = await startHub(workspaceRoot);
      const res = await fetch(`${hub.url}/events?commandId=commands.list&token=${TOKEN}`, {
        headers: { Accept: 'text/event-stream' },
      });
      expect(res.status).toBe(200);

      const events: SseEvent[] = [];
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const line = block.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue; // ": ping" keepalive comments carry no data line
          const parsed = sseEventSchema.safeParse(JSON.parse(line.slice(6)));
          expect(parsed.success, `non-conformant SSE event: ${line}`).toBe(true);
          if (parsed.success) events.push(parsed.data);
        }
      }

      expect(events.some((e) => e.type === 'stdout')).toBe(true);
      const exit = events.find((e) => e.type === 'exit');
      expect(exit?.code).toBe(0);
    });
  });

  it('the auth message schema the hub validates with is the one in the contract', () => {
    expect(wsAuthMessageSchema.safeParse({ type: 'auth', token: TOKEN }).success).toBe(true);
  });
});
