import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { useHubStream } from './useHubStream';

// Build a mock fetch whose body is an SSE stream of the given `data:` frames.
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

function jsonFrames(payload: unknown): string[] {
  return [
    JSON.stringify({ type: 'stdout', id: 'j1', content: JSON.stringify(payload) }),
    JSON.stringify({ type: 'exit', id: 'j1', code: 0 }),
  ];
}

describe('useHubStream', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts not-loading and produces no data when disabled', () => {
    const { result } = renderHook(() =>
      useHubStream('workspace.summary', undefined, { enabled: false })
    );
    expect(result.current).toEqual({ data: null, loading: false, error: null });
  });

  it('reassembles and validates a single payload', async () => {
    const schema = z.object({ count: z.number() });
    vi.stubGlobal('fetch', mockSseFetch(jsonFrames({ count: 9 })));

    const { result } = renderHook(() =>
      useHubStream('workspace.summary', { cwd: '/repo' }, {
        schema,
        baseUrl: 'http://127.0.0.1:3333',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ count: 9 });
    expect(result.current.error).toBeNull();
  });

  it('returns the raw value when no schema is given', async () => {
    vi.stubGlobal('fetch', mockSseFetch(jsonFrames({ any: 'thing' })));

    const { result } = renderHook(() =>
      useHubStream('commands.list', undefined, { baseUrl: 'http://127.0.0.1:3333' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ any: 'thing' });
  });

  it('surfaces a schema validation failure as an error', async () => {
    const schema = z.object({ count: z.number() });
    vi.stubGlobal('fetch', mockSseFetch(jsonFrames({ count: 'nope' })));

    const { result } = renderHook(() =>
      useHubStream('workspace.summary', undefined, {
        schema,
        baseUrl: 'http://127.0.0.1:3333',
      })
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(/schema validation/i);
    expect(result.current.data).toBeNull();
  });

  it('drops loading when the stream completes without JSON', async () => {
    vi.stubGlobal(
      'fetch',
      mockSseFetch([JSON.stringify({ type: 'exit', id: 'j1', code: 0 })])
    );

    const { result } = renderHook(() =>
      useHubStream('workspace.summary', undefined, { baseUrl: 'http://127.0.0.1:3333' })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });
});
