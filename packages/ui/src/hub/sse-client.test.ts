import { afterEach, describe, expect, it, vi } from 'vitest';

import { SseClient } from './sse-client';

function streamResponse(frames: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('SseClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('attaches the session token header when provided', async () => {
    const fetchSpy = vi.fn(async () => streamResponse([JSON.stringify({ type: 'exit', id: 'j1', code: 0 })]));
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const onDone = vi.fn();
    const client = new SseClient({ url: 'http://h/events', token: 'secret', onDone });
    await client.connect();

    expect(onDone).toHaveBeenCalled();
    const init = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['X-Re-Shell-UI-Hub-Token']).toBe('secret');
  });

  it('reassembles stdout chunks then flushes on exit', async () => {
    const payload = JSON.stringify({ count: 4 });
    const half = Math.ceil(payload.length / 2);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        streamResponse([
          JSON.stringify({ type: 'stdout', id: 'j1', content: payload.slice(0, half) }),
          JSON.stringify({ type: 'stdout', id: 'j1', content: payload.slice(half) }),
          JSON.stringify({ type: 'exit', id: 'j1', code: 0 }),
        ])
      ) as unknown as typeof fetch
    );

    const onJson = vi.fn();
    const onEvent = vi.fn();
    await new SseClient({ url: 'http://h/events', onJson, onEvent }).connect();

    expect(onJson).toHaveBeenCalledWith({ count: 4 });
    expect(onEvent).toHaveBeenCalled();
  });

  it('reports a non-JSON frame via onError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse(['not-json'])) as unknown as typeof fetch
    );

    const onError = vi.fn();
    await new SseClient({ url: 'http://h/events', onError }).connect();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/not valid JSON/i) }));
  });

  it('reports a schema-invalid frame via onError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse([JSON.stringify({ type: 'bogus' })])) as unknown as typeof fetch
    );

    const onError = vi.fn();
    await new SseClient({ url: 'http://h/events', onError }).connect();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/schema validation/i) }));
  });

  it('does not retry or error on an aborted connection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }) as unknown as typeof fetch
    );

    const onError = vi.fn();
    const client = new SseClient({ url: 'http://h/events', onError, retries: 1 });
    await client.connect();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an error after exhausting retries on a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => streamResponse([], 500)) as unknown as typeof fetch
    );

    const onError = vi.fn();
    // retries: 1 means a single attempt, no backoff sleep, then onError.
    await new SseClient({ url: 'http://h/events', onError, retries: 1 }).connect();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/SSE error: 500/) }));
  });

  it('close() aborts the underlying controller', () => {
    const client = new SseClient({ url: 'http://h/events' });
    expect(() => client.close()).not.toThrow();
  });
});
