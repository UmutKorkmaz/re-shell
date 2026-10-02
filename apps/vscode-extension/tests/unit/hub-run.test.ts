import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { runHubJob } from '../../src/hub-run.js';

/**
 * Exercises the socket layer against a local HTTP server that speaks the hub's
 * wire protocol (SSE `data:` frames with `stdout`/`stderr`/`exit` events). This
 * checks the client's request shape, framing, and every failure path. The REAL
 * hub is exercised in tests/integration.
 */

const TOKEN = 'unit-test-token';

let server: http.Server | undefined;

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

async function startServer(handler: http.RequestListener): Promise<{ baseUrl: string }> {
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${(server!.address() as AddressInfo).port}` };
}

function frame(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const sse = (res: http.ServerResponse): void => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
};

describe('runHubJob', () => {
  it('sends commandId + params with the token and settles with the job result', async () => {
    let seen: { url: URL; headers: http.IncomingHttpHeaders } | undefined;
    const { baseUrl } = await startServer((req, res) => {
      seen = { url: new URL(req.url ?? '/', 'http://x'), headers: req.headers };
      sse(res);
      res.write(': ping\n\n');
      res.write(frame({ type: 'stdout', content: '{"ok":true,' }));
      res.write(frame({ type: 'stderr', content: 'a warning' }));
      res.write(frame({ type: 'stdout', content: '"data":{"n":1},"warnings":[]}' }));
      res.write(frame({ type: 'exit', code: 0 }));
      res.end();
    });

    const fragments: string[] = [];
    const result = await runHubJob(
      { baseUrl, token: TOKEN },
      'run',
      { subcommand: 'workspace summary', cwd: '/w' },
      { onOutput: (stream, fragment) => fragments.push(`${stream}:${fragment}`) }
    );

    expect(result).toEqual({
      ok: true,
      exitCode: 0,
      stdout: '{"ok":true,"data":{"n":1},"warnings":[]}',
      stderr: 'a warning',
      protocolProblems: [],
    });
    expect(fragments).toEqual([
      'stdout:{"ok":true,',
      'stderr:a warning',
      'stdout:"data":{"n":1},"warnings":[]}',
    ]);

    expect(seen?.url.pathname).toBe('/events');
    expect(seen?.url.searchParams.get('commandId')).toBe('run');
    expect(JSON.parse(seen?.url.searchParams.get('params') ?? '{}')).toEqual({
      subcommand: 'workspace summary',
      cwd: '/w',
    });
    expect(seen?.headers['x-re-shell-ui-hub-token']).toBe(TOKEN);
    expect(seen?.headers['accept']).toBe('text/event-stream');
    expect(seen?.headers['sec-fetch-mode']).toBe('cors');
  });

  it('reports a non-zero exit code as a settled result, not as a transport failure', async () => {
    const { baseUrl } = await startServer((_req, res) => {
      sse(res);
      res.write(frame({ type: 'stdout', content: '{"ok":false}' }));
      res.write(frame({ type: 'exit', code: 1 }));
      res.end();
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok && result.exitCode).toBe(1);
  });

  it('handles a stream delivered one byte at a time', async () => {
    const wire = frame({ type: 'stdout', content: 'x' }) + frame({ type: 'exit', code: 0 });
    const { baseUrl } = await startServer(async (_req, res) => {
      sse(res);
      for (const ch of wire) {
        res.write(ch);
        await new Promise((r) => setTimeout(r, 1));
      }
      res.end();
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok && result.stdout).toBe('x');
  });

  it('maps 401 to an unauthorized failure that never echoes the token', async () => {
    const { baseUrl } = await startServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('unauthorized');
    expect(result.status).toBe(401);
    expect(result.message).not.toContain(TOKEN);
  });

  it('maps 400 to a rejected failure carrying the hub reason', async () => {
    const { baseUrl } = await startServer((_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'cwd is outside the workspace root' }));
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('rejected');
    expect(result.message).toContain('cwd is outside the workspace root');
  });

  it('maps other statuses to an http failure', async () => {
    const { baseUrl } = await startServer((_req, res) => {
      res.writeHead(503);
      res.end('busy');
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('http');
    expect(result.status).toBe(503);
  });

  it('fails as truncated when the stream ends without an exit event', async () => {
    const { baseUrl } = await startServer((_req, res) => {
      sse(res);
      res.write(frame({ type: 'stdout', content: 'partial' }));
      res.end();
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('truncated');
  });

  it('fails as truncated when the connection is dropped mid-stream', async () => {
    const { baseUrl } = await startServer((req, res) => {
      sse(res);
      res.write(frame({ type: 'stdout', content: 'partial' }));
      setTimeout(() => req.socket.destroy(), 20);
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('truncated');
  });

  it('fails as unreachable when nothing is listening', async () => {
    // Bind then release a port so it is known to be closed.
    const probe = http.createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const result = await runHubJob({ baseUrl: `http://127.0.0.1:${port}`, token: TOKEN }, 'run', {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe('unreachable');
    expect(result.message).toMatch(/ECONNREFUSED/);
  });

  it('aborts and reports a timeout when the job never finishes', async () => {
    let clientGone = false;
    const { baseUrl } = await startServer((req, res) => {
      sse(res);
      res.write(': ping\n\n');
      req.on('close', () => {
        clientGone = true;
      });
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {}, { timeoutMs: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('timeout');
    // The socket is destroyed so the hub reaps the child process.
    await new Promise((r) => setTimeout(r, 50));
    expect(clientGone).toBe(true);
  });

  it('aborts when the signal fires, and when it is already aborted', async () => {
    const { baseUrl } = await startServer((_req, res) => {
      sse(res);
      res.write(': ping\n\n');
    });

    const controller = new AbortController();
    const pending = runHubJob({ baseUrl, token: TOKEN }, 'run', {}, { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    const cancelled = await pending;
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) expect(cancelled.kind).toBe('cancelled');

    const already = AbortSignal.abort();
    const immediate = await runHubJob({ baseUrl, token: TOKEN }, 'run', {}, { signal: already });
    expect(immediate.ok).toBe(false);
    if (!immediate.ok) expect(immediate.kind).toBe('cancelled');
  });

  it('records protocol irregularities without failing a job that did exit', async () => {
    const { baseUrl } = await startServer((_req, res) => {
      sse(res);
      res.write('data: this is not json\n\n');
      res.write(frame({ type: 'exit', code: 0 }));
      res.end();
    });
    const result = await runHubJob({ baseUrl, token: TOKEN }, 'run', {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.protocolProblems).toHaveLength(1);
  });
});
