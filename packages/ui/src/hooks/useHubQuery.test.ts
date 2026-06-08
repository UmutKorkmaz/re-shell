import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { useHubQuery } from './useHubQuery';

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

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe('useHubQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves cacheable read data through TanStack Query', async () => {
    const schema = z.object({ total: z.number() });
    vi.stubGlobal('fetch', mockSseFetch(jsonFrames({ total: 3 })));

    const { result } = renderHook(
      () =>
        useHubQuery('templates.list', undefined, {
          schema,
          baseUrl: 'http://127.0.0.1:3333',
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ total: 3 });
  });

  it('surfaces a validation failure as a query error', async () => {
    const schema = z.object({ total: z.number() });
    vi.stubGlobal('fetch', mockSseFetch(jsonFrames({ total: 'x' })));

    const { result } = renderHook(
      () =>
        useHubQuery('templates.list', { language: 'ts' }, {
          schema,
          baseUrl: 'http://127.0.0.1:3333',
        }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/schema validation/i);
  });
});
