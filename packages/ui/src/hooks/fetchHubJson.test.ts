import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fetchHubJson } from './fetchHubJson';

/**
 * Build a mock `fetch` whose response body is a ReadableStream emitting the
 * given SSE `data:` frames. Splitting one JSON document across multiple frames
 * exercises the Wave-3 JsonReassembler inside SseClient.
 */
function mockSseFetch(frames: string[]): typeof fetch {
  return vi.fn(async () => {
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
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as unknown as typeof fetch;
}

describe('fetchHubJson reassembly path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reassembles chunk-split stdout into exactly one parsed, validated object', async () => {
    const schema = z.object({ ok: z.literal(true), data: z.object({ count: z.number() }) });

    // The hub splits a single --json payload across two stdout frames; the exit
    // frame closes the job. The reassembler must coalesce them into one object.
    const payload = JSON.stringify({ ok: true, data: { count: 7 } });
    const half = Math.ceil(payload.length / 2);
    const frames = [
      JSON.stringify({ type: 'stdout', id: 'j1', content: payload.slice(0, half) }),
      JSON.stringify({ type: 'stdout', id: 'j1', content: payload.slice(half) }),
      JSON.stringify({ type: 'exit', id: 'j1', code: 0 }),
    ];

    vi.stubGlobal('fetch', mockSseFetch(frames));

    const result = await fetchHubJson('workspace.summary', undefined, {
      schema,
      baseUrl: 'http://127.0.0.1:3333',
    });

    expect(result).toEqual({ ok: true, data: { count: 7 } });
  });

  it('rejects when the reassembled object fails schema validation', async () => {
    const schema = z.object({ ok: z.literal(true), data: z.object({ count: z.number() }) });
    const frames = [
      JSON.stringify({ type: 'stdout', id: 'j1', content: '{"ok":true,"data":{"count":"nope"}}' }),
      JSON.stringify({ type: 'exit', id: 'j1', code: 0 }),
    ];

    vi.stubGlobal('fetch', mockSseFetch(frames));

    await expect(
      fetchHubJson('workspace.summary', undefined, { schema, baseUrl: 'http://127.0.0.1:3333' })
    ).rejects.toThrow(/schema validation/i);
  });

  it('resolves the raw parsed value when no schema is supplied', async () => {
    vi.stubGlobal(
      'fetch',
      mockSseFetch([
        JSON.stringify({ type: 'stdout', id: 'j1', content: '{"raw":true}' }),
        JSON.stringify({ type: 'exit', id: 'j1', code: 0 }),
      ])
    );

    const result = await fetchHubJson('commands.list', undefined, {
      baseUrl: 'http://127.0.0.1:3333',
    });
    expect(result).toEqual({ raw: true });
  });

  it('rejects when the stream completes without producing JSON', async () => {
    vi.stubGlobal(
      'fetch',
      mockSseFetch([JSON.stringify({ type: 'exit', id: 'j1', code: 0 })])
    );

    await expect(
      fetchHubJson('workspace.summary', undefined, { baseUrl: 'http://127.0.0.1:3333' })
    ).rejects.toThrow(/without a JSON payload/i);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    vi.stubGlobal('fetch', mockSseFetch([]));
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchHubJson('workspace.summary', undefined, {
        baseUrl: 'http://127.0.0.1:3333',
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects when the signal aborts mid-stream', async () => {
    // A fetch that never resolves keeps the stream pending so the abort wins.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch
    );
    const controller = new AbortController();

    const promise = fetchHubJson('workspace.summary', undefined, {
      baseUrl: 'http://127.0.0.1:3333',
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects with the transport error when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch
    );

    await expect(
      fetchHubJson('workspace.summary', undefined, { baseUrl: 'http://127.0.0.1:3333' })
    ).rejects.toThrow();
  });
});
