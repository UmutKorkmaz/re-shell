import type { IncomingMessage } from 'node:http';

import { describe, expect, it } from 'vitest';

import { parseSse } from '../sse-client.js';
import { TokenBucketLimiter, bearerToken, clientAddress } from './limits.js';
import { Router } from './router.js';

describe('TokenBucketLimiter', () => {
  it('allows a burst, then refills at the sustained rate', () => {
    const limiter = new TokenBucketLimiter(3, 60); // 1 token per second
    const t0 = 1_000_000;
    expect([1, 2, 3].map(() => limiter.take('k', t0).allowed)).toEqual([true, true, true]);
    const denied = limiter.take('k', t0);
    expect(denied).toMatchObject({ allowed: false });
    expect((denied as { retryAfterMs: number }).retryAfterMs).toBe(1000);
    expect(limiter.take('k', t0 + 500).allowed).toBe(false);
    expect(limiter.take('k', t0 + 1000).allowed).toBe(true);
    // Never refills beyond the burst size.
    expect([1, 2, 3, 4].map(() => limiter.take('k', t0 + 3_600_000).allowed)).toEqual([true, true, true, false]);
  });

  it('keeps keys independent and bounds how many it tracks', () => {
    const limiter = new TokenBucketLimiter(1, 1, 3);
    expect(limiter.take('a', 0).allowed).toBe(true);
    expect(limiter.take('a', 0).allowed).toBe(false);
    expect(limiter.take('b', 0).allowed).toBe(true);
    limiter.take('c', 0);
    limiter.take('d', 0);
    expect(limiter.size).toBeLessThanOrEqual(3);
    // 'a' was the least recently used and was evicted, so it starts fresh.
    expect(limiter.take('a', 0).allowed).toBe(true);
  });
});

describe('bearerToken', () => {
  it('extracts a well-formed bearer token and nothing else', () => {
    expect(bearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(bearerToken('bearer   abc')).toBe('abc');
    for (const bad of [undefined, '', 'Bearer', 'Bearer a b', 'Basic abc', 'abc', ['Bearer a', 'Bearer b']] as const) {
      expect(bearerToken(bad as string | undefined), JSON.stringify(bad)).toBeUndefined();
    }
  });
});

describe('clientAddress', () => {
  const req = (headers: Record<string, string | string[]>, remote = '10.1.1.1') =>
    ({ headers, socket: { remoteAddress: remote } }) as unknown as IncomingMessage;

  it('ignores X-Forwarded-For unless a proxy is trusted, then uses the last entry', () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' });
    expect(clientAddress(r, false)).toBe('10.1.1.1');
    expect(clientAddress(r, true)).toBe('3.3.3.3');
    expect(clientAddress(req({}), true)).toBe('10.1.1.1');
    expect(clientAddress(req({ 'x-forwarded-for': ['a', 'b'] }), true)).toBe('b');
  });
});

describe('Router', () => {
  const router = new Router<string>()
    .add('GET', '/tenants/:tenantId/jobs', 'list')
    .add('POST', '/tenants/:tenantId/jobs', 'create')
    .add('GET', '/tenants/:tenantId/jobs/:jobId', 'get')
    .add('GET', '/healthz', 'health');

  it('matches literals and params, decoding percent-escapes', () => {
    expect(router.lookup('GET', '/tenants/acme/jobs/abc%2D1')).toEqual({
      kind: 'match',
      match: { route: 'get', params: { tenantId: 'acme', jobId: 'abc-1' } },
    });
    expect(router.lookup('GET', '/healthz/')).toMatchObject({ kind: 'match' });
  });

  it('distinguishes wrong method from no route, and never over-matches', () => {
    expect(router.lookup('DELETE', '/tenants/acme/jobs')).toEqual({ kind: 'method-not-allowed', allowed: ['GET', 'POST'] });
    expect(router.lookup('GET', '/tenants/acme')).toEqual({ kind: 'not-found' });
    expect(router.lookup('GET', '/tenants/acme/jobs/1/extra')).toEqual({ kind: 'not-found' });
    expect(router.lookup('GET', '/tenants/acme/other')).toEqual({ kind: 'not-found' });
    expect(router.lookup('GET', '/tenants/%E0%A4%A/jobs')).toEqual({ kind: 'not-found' });
  });
});

describe('parseSse', () => {
  const stream = (...chunks: string[]): ReadableStream<Uint8Array> => {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
  };
  const collect = async (s: ReadableStream<Uint8Array>) => {
    const out = [];
    for await (const m of parseSse(s)) out.push(m);
    return out;
  };

  it('parses events split across chunks, CRLF framing, multi-line data, ids and comments', async () => {
    const messages = await collect(
      stream(
        'retry: 3000\n\n: ping\n\nevent: snap',
        'shot\ndata: {"a":1}\n\n',
        'id: 7\r\nevent: stdout\r\ndata: line1\r\ndata: line2\r\n\r\n',
        'data: no-event-name\n\n'
      )
    );
    expect(messages).toEqual([
      { event: 'snapshot', data: '{"a":1}' },
      { event: 'stdout', data: 'line1\nline2', id: '7' },
      { event: 'message', data: 'no-event-name' },
    ]);
  });

  it('drops an incomplete trailing frame', async () => {
    expect(await collect(stream('event: a\ndata: 1\n\nevent: b\ndata: 2'))).toEqual([{ event: 'a', data: '1' }]);
  });
});
