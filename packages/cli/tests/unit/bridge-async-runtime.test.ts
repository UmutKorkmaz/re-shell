import { describe, expect, it, vi } from 'vitest';

import {
  CircuitBreaker,
  CircuitOpenError,
  EnvelopeError,
  MemoryTransport,
  MessageBus,
  RetryExhaustedError,
  SchemaVersionError,
  ServiceDiscovery,
  ServiceNotFoundError,
  ValidationError,
  backoffDelay,
  childOf,
  createEnvelope,
  currentContext,
  decodeEnvelope,
  defineMessage,
  deadLetterChannel,
  encodeEnvelope,
  envName,
  envelopeHeaders,
  formatTraceparent,
  newTraceContext,
  parseTraceparent,
  retry,
  runWithContext,
  upcastPayload,
  validatePayload,
  type DeadLetter,
  type Envelope,
} from '../../src/bridge/async/runtime';

// ---------------------------------------------------------------------------
// W3C trace context
// ---------------------------------------------------------------------------

describe('async runtime: traceparent', () => {
  it('generates spec-conformant traceparents and round-trips them', () => {
    const ctx = newTraceContext();
    const header = formatTraceparent(ctx);
    expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(parseTraceparent(header)).toEqual(ctx);
  });

  it('rejects malformed and all-zero ids instead of throwing', () => {
    expect(parseTraceparent(undefined)).toBeUndefined();
    expect(parseTraceparent('garbage')).toBeUndefined();
    expect(parseTraceparent(`00-${'0'.repeat(32)}-${'a'.repeat(16)}-01`)).toBeUndefined();
    expect(parseTraceparent(`00-${'a'.repeat(32)}-${'0'.repeat(16)}-01`)).toBeUndefined();
    expect(parseTraceparent(`ff-${'a'.repeat(32)}-${'b'.repeat(16)}-01`)).toBeUndefined();
  });

  it('a child keeps the trace-id and gets a new span-id; no parent starts a new trace', () => {
    const root = newTraceContext();
    const child = childOf(root);
    expect(child.traceId).toBe(root.traceId);
    expect(child.spanId).not.toBe(root.spanId);
    expect(childOf(undefined).traceId).not.toBe(root.traceId);
    expect(parseTraceparent(formatTraceparent({ ...root, sampled: false }))?.sampled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

describe('async runtime: envelope', () => {
  const base = { type: 'OrderCreated', schemaVersion: 2, correlationId: 'corr-1', traceparent: formatTraceparent(newTraceContext()), source: 'orders', payload: { orderId: 'o1' } };

  it('round-trips through JSON with all contract fields', () => {
    const env = createEnvelope({ ...base, causationId: 'cause-1' });
    const back = decodeEnvelope(encodeEnvelope(env));
    expect(back).toEqual(env);
    expect(back).toEqual(expect.objectContaining({ type: 'OrderCreated', schemaVersion: 2, correlationId: 'corr-1', causationId: 'cause-1', source: 'orders' }));
    expect(back.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(back.timestamp))).toBe(false);
  });

  it('omits causationId when absent and exposes headers for brokers', () => {
    const env = createEnvelope(base);
    expect('causationId' in env).toBe(false);
    expect(envelopeHeaders(env)).toEqual({
      'x-message-id': env.id,
      'x-message-type': 'OrderCreated',
      'x-schema-version': '2',
      'x-correlation-id': 'corr-1',
      traceparent: env.traceparent,
      'x-source': 'orders',
    });
  });

  it('decode rejects malformed envelopes with EnvelopeError', () => {
    expect(() => decodeEnvelope('not json')).toThrow(EnvelopeError);
    expect(() => decodeEnvelope('[]')).toThrow(/not an object/);
    const ok = createEnvelope(base) as unknown as Record<string, unknown>;
    for (const key of ['id', 'type', 'correlationId', 'traceparent', 'source', 'timestamp']) {
      expect(() => decodeEnvelope(JSON.stringify({ ...ok, [key]: '' }))).toThrow(new RegExp(`envelope.${key}`));
    }
    expect(() => decodeEnvelope(JSON.stringify({ ...ok, schemaVersion: 0 }))).toThrow(/schemaVersion/);
    expect(() => decodeEnvelope(JSON.stringify({ ...ok, schemaVersion: 1.5 }))).toThrow(/schemaVersion/);
    const { payload: _p, ...noPayload } = ok;
    expect(() => decodeEnvelope(JSON.stringify(noPayload))).toThrow(/payload/);
  });
});

// ---------------------------------------------------------------------------
// Schema evolution
// ---------------------------------------------------------------------------

describe('async runtime: schema evolution', () => {
  const OrderCreated = defineMessage<{ orderId: string; total: number; currency: string }>({
    type: 'OrderCreated',
    channel: 'orders.created',
    currentVersion: 3,
    schema: { orderId: 'string', total: 'number', currency: 'enum(USD|EUR)' },
    upcasters: {
      1: (p: { orderId: string; amount: number }) => ({ orderId: p.orderId, total: p.amount }), // rename amount -> total
      2: (p: { orderId: string; total: number }) => ({ ...p, currency: 'USD' }), // add currency with default
    },
  });

  it('upcasts through the whole chain (v1 -> v2 -> v3) and leaves current payloads alone', () => {
    expect(upcastPayload(OrderCreated, { orderId: 'a', amount: 5 }, 1)).toEqual({ orderId: 'a', total: 5, currency: 'USD' });
    expect(upcastPayload(OrderCreated, { orderId: 'a', total: 6 }, 2)).toEqual({ orderId: 'a', total: 6, currency: 'USD' });
    const current = { orderId: 'a', total: 7, currency: 'EUR' };
    expect(upcastPayload(OrderCreated, current, 3)).toBe(current);
  });

  it('rejects versions newer than current unless acceptNewer (forward compatibility)', () => {
    expect(() => upcastPayload(OrderCreated, {}, 4)).toThrow(SchemaVersionError);
    expect(() => upcastPayload(OrderCreated, {}, 4)).toThrow(/newer schema/);
    const future = { orderId: 'a', total: 1, currency: 'USD', extra: true };
    expect(upcastPayload(OrderCreated, future, 4, { acceptNewer: true })).toBe(future);
  });

  it('refuses versions older than minVersion and incomplete chains at definition time', () => {
    const pruned = defineMessage({ ...OrderCreated, minVersion: 2 });
    expect(() => upcastPayload(pruned, {}, 1)).toThrow(/older than the oldest supported version v2/);
    expect(() =>
      defineMessage({ type: 'X', channel: 'x', currentVersion: 3, schema: {}, upcasters: { 1: (p: unknown) => p } })
    ).toThrow(/no upcaster from v2 to v3/);
    expect(() => defineMessage({ type: 'X', channel: 'x', currentVersion: 0, schema: {}, upcasters: {} })).toThrow(/positive integer/);
  });

  it('validates payload structure: required, optional, arrays, nested, enums, datetimes', () => {
    const schema = { id: 'string', n: 'integer', tags: 'string[]', note: 'string?', at: 'datetime', kind: 'enum(a|b)', nested: { x: 'number' }, any: 'any?' };
    const good = { id: 'i', n: 3, tags: ['t'], at: '2024-01-01T00:00:00Z', kind: 'a', nested: { x: 1.5 } };
    expect(validatePayload(schema, good)).toEqual([]);
    expect(validatePayload(schema, { ...good, n: 1.5, tags: [1], at: 'nope', kind: 'z', nested: { x: 'q' } })).toEqual([
      'n must be an integer',
      'tags[0] must be a string',
      'at must be an ISO-8601 datetime string',
      'kind must be one of a|b',
      'nested.x must be a number',
    ]);
    expect(validatePayload(schema, {})).toEqual(expect.arrayContaining(['id is required', 'n is required', 'nested must be an object']));
    expect(validatePayload(schema, 'str')).toEqual(['payload must be an object']);
    expect(validatePayload({ a: 'string' }, { a: 'x', unknownField: 1 })).toEqual([]); // tolerant reader
  });
});

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

describe('async runtime: circuit breaker (closed / open / half-open)', () => {
  function setup(options: Partial<ConstructorParameters<typeof CircuitBreaker>[0]> = {}) {
    let t = 1000;
    const transitions: string[] = [];
    const breaker = new CircuitBreaker({
      name: 'db',
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      now: () => t,
      onStateChange: (to, from) => transitions.push(`${from}->${to}`),
      ...options,
    });
    const fail = () => breaker.execute(async () => { throw new Error('boom'); }).catch(e => e);
    const succeed = () => breaker.execute(async () => 'ok');
    return { breaker, fail, succeed, transitions, advance: (ms: number) => { t += ms; } };
  }

  it('stays closed below the threshold and resets the count on success', async () => {
    const { breaker, fail, succeed } = setup();
    await fail();
    await fail();
    expect(breaker.currentState).toBe('closed');
    expect(breaker.consecutiveFailures).toBe(2);
    await succeed();
    expect(breaker.consecutiveFailures).toBe(0);
    await fail();
    await fail();
    expect(breaker.currentState).toBe('closed');
  });

  it('opens after consecutive failures and then fails fast WITHOUT calling the dependency', async () => {
    const { breaker, fail, transitions } = setup();
    for (let i = 0; i < 3; i++) await fail();
    expect(breaker.currentState).toBe('open');
    expect(transitions).toEqual(['closed->open']);
    const fn = vi.fn(async () => 'never');
    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('goes half-open after resetTimeout; a successful probe closes it', async () => {
    const { breaker, fail, succeed, advance, transitions } = setup();
    for (let i = 0; i < 3; i++) await fail();
    advance(999);
    expect(breaker.currentState).toBe('open');
    advance(1);
    expect(breaker.currentState).toBe('half-open');
    expect(await succeed()).toBe('ok');
    expect(breaker.currentState).toBe('closed');
    expect(breaker.consecutiveFailures).toBe(0);
    expect(transitions).toEqual(['closed->open', 'open->half-open', 'half-open->closed']);
  });

  it('a failed probe re-opens the circuit and restarts the timer', async () => {
    const { breaker, fail, advance, transitions } = setup();
    for (let i = 0; i < 3; i++) await fail();
    advance(1000);
    await fail(); // probe fails
    expect(breaker.currentState).toBe('open');
    advance(500);
    expect(breaker.currentState).toBe('open'); // timer restarted
    advance(500);
    expect(breaker.currentState).toBe('half-open');
    expect(transitions).toEqual(['closed->open', 'open->half-open', 'half-open->open', 'open->half-open']);
  });

  it('limits concurrent half-open probes and honours successThreshold', async () => {
    const { breaker, fail, advance } = setup({ successThreshold: 2, halfOpenMaxCalls: 1 });
    for (let i = 0; i < 3; i++) await fail();
    advance(1000);
    let release!: () => void;
    const slow = breaker.execute(() => new Promise<string>(resolve => { release = () => resolve('slow'); }));
    await expect(breaker.execute(async () => 'second')).rejects.toBeInstanceOf(CircuitOpenError); // probe slot taken
    release();
    await slow;
    expect(breaker.currentState).toBe('half-open'); // 1 of 2 successes
    await breaker.execute(async () => 'ok');
    expect(breaker.currentState).toBe('closed');
  });

  it('isFailure lets non-dependency errors pass without tripping the breaker', async () => {
    const { breaker } = setup({ isFailure: e => !(e instanceof TypeError) });
    for (let i = 0; i < 10; i++) await breaker.execute(async () => { throw new TypeError('caller bug'); }).catch(() => undefined);
    expect(breaker.currentState).toBe('closed');
  });

  it('reset() closes it and validates thresholds', async () => {
    const { breaker, fail } = setup();
    for (let i = 0; i < 3; i++) await fail();
    breaker.reset();
    expect(breaker.currentState).toBe('closed');
    expect(() => new CircuitBreaker({ failureThreshold: 0 })).toThrow(/>= 1/);
  });
});

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

describe('async runtime: retry with backoff', () => {
  it('computes exponential delays capped at maxDelay (no jitter) and full-jitter within bounds', () => {
    const p = { baseDelayMs: 100, factor: 2, maxDelayMs: 500, jitter: 'none' as const };
    expect([1, 2, 3, 4, 5].map(a => backoffDelay(a, p))).toEqual([100, 200, 400, 500, 500]);
    expect(backoffDelay(3, { baseDelayMs: 100, maxDelayMs: 5000, random: () => 0.5 })).toBe(200);
    expect(backoffDelay(3, { baseDelayMs: 100, maxDelayMs: 5000, random: () => 0 })).toBe(0);
  });

  it('retries until success, sleeping the backoff between attempts', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await retry(
      async attempt => {
        calls++;
        if (attempt < 3) throw new Error('flaky');
        return 'done';
      },
      { maxAttempts: 5, baseDelayMs: 10, jitter: 'none', sleep: async ms => { sleeps.push(ms); } }
    );
    expect(result).toBe('done');
    expect(calls).toBe(3);
    expect(sleeps).toEqual([10, 20]);
  });

  it('throws RetryExhaustedError (with the last cause) after maxAttempts', async () => {
    const onRetry = vi.fn();
    const error = await retry(async () => { throw new Error('always'); }, { maxAttempts: 3, sleep: async () => undefined, onRetry }).catch(e => e);
    expect(error).toBeInstanceOf(RetryExhaustedError);
    expect(error.attempts).toBe(3);
    expect(error.cause.message).toBe('always');
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('stops immediately when shouldRetry says no', async () => {
    let calls = 0;
    await expect(
      retry(async () => { calls++; throw new TypeError('fatal'); }, { maxAttempts: 5, sleep: async () => undefined, shouldRetry: e => !(e instanceof TypeError) })
    ).rejects.toBeInstanceOf(TypeError);
    expect(calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

describe('async runtime: service discovery (env, registry file, DNS SRV)', () => {
  const registry = JSON.stringify({
    version: 1,
    services: {
      orders: { url: 'http://orders.internal:9090' },
      payments: { instances: [{ host: 'p1', port: 7001 }, { host: 'p2', port: 7002 }] },
      broker: { url: 'redis://registry-broker:6379' },
    },
  });

  it('prefers environment variables over the registry file', async () => {
    const d = new ServiceDiscovery({ env: { ORDERS_URL: 'http://from-env:1' }, readFile: () => registry });
    expect(await d.resolve('orders')).toEqual({ name: 'orders', url: 'http://from-env:1', source: 'env' });
    const d2 = new ServiceDiscovery({ env: { ORDERS_ADDR: 'h:9' }, readFile: () => registry });
    expect(await d2.resolve('orders')).toEqual(expect.objectContaining({ host: 'h', port: 9, source: 'env' }));
    const d3 = new ServiceDiscovery({ env: { ORDERS_HOST: 'hh', ORDERS_PORT: '10' }, readFile: () => registry });
    expect(await d3.resolve('orders')).toEqual(expect.objectContaining({ host: 'hh', port: 10 }));
    expect(envName('orders-api.v2')).toBe('ORDERS_API_V2');
  });

  it('falls back to the registry file (single entry and multiple instances)', async () => {
    const d = new ServiceDiscovery({ env: {}, readFile: () => registry });
    expect(await d.resolve('orders')).toEqual({ name: 'orders', url: 'http://orders.internal:9090', host: undefined, port: undefined, source: 'registry' });
    const all = await d.resolveAll('payments');
    expect(all.map(e => `${e.host}:${e.port}`)).toEqual(['p1:7001', 'p2:7002']);
  });

  it('reads the registry from SERVICE_REGISTRY / registryPath', async () => {
    const read = vi.fn(() => registry);
    await new ServiceDiscovery({ env: { SERVICE_REGISTRY: '/etc/svc.json' }, readFile: read }).resolve('broker');
    expect(read).toHaveBeenCalledWith('/etc/svc.json');
    const read2 = vi.fn(() => registry);
    await new ServiceDiscovery({ env: {}, registryPath: '/x/y.json', readFile: read2 }).resolve('broker');
    expect(read2).toHaveBeenCalledWith('/x/y.json');
  });

  it('falls back to DNS SRV, ordered by priority then weight', async () => {
    const resolveSrv = vi.fn(async (name: string) => {
      expect(name).toBe('_billing._tcp.svc.example');
      return [
        { name: 'b2', port: 80, priority: 20, weight: 10 },
        { name: 'b1', port: 81, priority: 10, weight: 5 },
        { name: 'b3', port: 82, priority: 10, weight: 50 },
      ];
    });
    const d = new ServiceDiscovery({ env: {}, srvDomain: 'svc.example', readFile: () => { throw new Error('ENOENT'); }, resolveSrv });
    const all = await d.resolveAll('billing');
    expect(all.map(e => e.host)).toEqual(['b3', 'b1', 'b2']);
    expect(all[0]).toEqual(expect.objectContaining({ source: 'dns-srv', port: 82, url: 'tcp://b3:82', priority: 10, weight: 50 }));
  });

  it('throws ServiceNotFoundError listing every source it tried; caches results', async () => {
    const d = new ServiceDiscovery({ env: {}, readFile: () => { throw new Error('ENOENT'); }, resolveSrv: async () => { throw new Error('NXDOMAIN'); }, srvDomain: 'x.test' });
    const err = await d.resolve('ghost').catch(e => e);
    expect(err).toBeInstanceOf(ServiceNotFoundError);
    expect(err.tried.join(' ')).toMatch(/env GHOST_URL.*registry.*dns-srv _ghost\._tcp\.x\.test/);

    let t = 0;
    const read = vi.fn(() => registry);
    const cached = new ServiceDiscovery({ env: {}, readFile: read, cacheTtlMs: 100, now: () => t });
    await cached.resolve('orders');
    await cached.resolve('orders');
    expect(read).toHaveBeenCalledTimes(1);
    t = 101;
    await cached.resolve('orders');
    expect(read).toHaveBeenCalledTimes(2);
    cached.invalidate('orders');
    await cached.resolve('orders');
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('reports a corrupt registry instead of silently ignoring it', async () => {
    const d = new ServiceDiscovery({ env: {}, readFile: () => '{nope' });
    await expect(d.resolve('orders')).rejects.toThrow(/not valid JSON/);
  });
});

// ---------------------------------------------------------------------------
// MessageBus over the in-memory transport
// ---------------------------------------------------------------------------

describe('async runtime: MessageBus (in-memory transport)', () => {
  const OrderCreated = defineMessage<{ orderId: string; total: number; currency: string }>({
    type: 'OrderCreated',
    channel: 'orders.created',
    currentVersion: 2,
    schema: { orderId: 'string', total: 'number', currency: 'string' },
    upcasters: { 1: (p: { orderId: string; amount: number }) => ({ orderId: p.orderId, total: p.amount, currency: 'USD' }) },
  });
  const InvoiceIssued = defineMessage<{ orderId: string; invoiceId: string }>({
    type: 'InvoiceIssued',
    channel: 'billing.invoice',
    currentVersion: 1,
    schema: { orderId: 'string', invoiceId: 'string' },
    upcasters: {},
  });

  const fastRetry = { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => undefined };

  it('round-trips a message with correlationId, schemaVersion and traceparent intact', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'orders' });
    const received: Envelope<{ orderId: string }>[] = [];
    await bus.subscribe(OrderCreated, 'billing', async (_p, env) => { received.push(env); });
    const sent = await bus.publish(OrderCreated, { orderId: 'o1', total: 9.5, currency: 'EUR' }, { correlationId: 'corr-42' });
    await transport.idle();
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(expect.objectContaining({ correlationId: 'corr-42', schemaVersion: 2, type: 'OrderCreated', source: 'orders', id: sent.id }));
    expect(received[0].payload).toEqual({ orderId: 'o1', total: 9.5, currency: 'EUR' });
    expect(parseTraceparent(received[0].traceparent)).toBeDefined();
    // headers mirror the envelope
    const msg = transport.published('orders.created')[0];
    expect(msg.headers['x-correlation-id']).toBe('corr-42');
    expect(msg.headers.traceparent).toBe(sent.traceparent);
    await bus.close();
  });

  it('generates a correlation id when none is given; consumers in different groups both receive it', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'orders' });
    const a: string[] = [];
    const b: string[] = [];
    await bus.subscribe(OrderCreated, 'billing', async (_p, e) => { a.push(e.correlationId); });
    await bus.subscribe(OrderCreated, 'shipping', async (_p, e) => { b.push(e.correlationId); });
    const sent = await bus.publish(OrderCreated, { orderId: 'o1', total: 1, currency: 'USD' });
    await transport.idle();
    expect(sent.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).toEqual([sent.correlationId]);
    expect(b).toEqual([sent.correlationId]);
  });

  it('members of one group share messages (competing consumers)', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'orders' });
    const seen: string[] = [];
    await bus.subscribe(OrderCreated, 'workers', async (_p, e) => { seen.push(`w1:${e.payload.orderId}`); });
    await bus.subscribe(OrderCreated, 'workers', async (_p, e) => { seen.push(`w2:${e.payload.orderId}`); });
    for (const id of ['a', 'b', 'c', 'd']) await bus.publish(OrderCreated, { orderId: id, total: 1, currency: 'USD' });
    await transport.idle();
    expect(seen).toHaveLength(4);
    expect(new Set(seen.map(s => s.split(':')[1]))).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(new Set(seen.map(s => s.split(':')[0]))).toEqual(new Set(['w1', 'w2']));
  });

  it('propagates correlation, causation and trace to messages published from a handler', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'billing' });
    const downstream: Envelope[] = [];
    await bus.subscribe(OrderCreated, 'billing', async p => {
      expect(currentContext()?.correlationId).toBe('flow-7');
      await bus.publish(InvoiceIssued, { orderId: p.orderId, invoiceId: `inv-${p.orderId}` });
    });
    await bus.subscribe(InvoiceIssued, 'audit', async (_p, e) => { downstream.push(e); });
    const first = await bus.publish(OrderCreated, { orderId: 'o9', total: 3, currency: 'USD' }, { correlationId: 'flow-7' });
    await transport.idle();
    await transport.idle();
    expect(downstream).toHaveLength(1);
    const inv = downstream[0];
    expect(inv.correlationId).toBe('flow-7'); // same logical flow
    expect(inv.causationId).toBe(first.id); // caused by the first message
    const t1 = parseTraceparent(first.traceparent)!;
    const t2 = parseTraceparent(inv.traceparent)!;
    expect(t2.traceId).toBe(t1.traceId); // same distributed trace...
    expect(t2.spanId).not.toBe(t1.spanId); // ...different span
    expect(currentContext()).toBeUndefined(); // context does not leak out of the handler
  });

  it('upcasts a v1 message produced by an old service to the current shape', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'consumer' });
    const got: unknown[] = [];
    await bus.subscribe(OrderCreated, 'g', async p => { got.push(p); });
    // an OLD producer: raw v1 envelope straight onto the transport
    const env = createEnvelope({ type: 'OrderCreated', schemaVersion: 1, correlationId: 'c', traceparent: formatTraceparent(newTraceContext()), source: 'legacy', payload: { orderId: 'old', amount: 12 } });
    await transport.publish('orders.created', encodeEnvelope(env), envelopeHeaders(env));
    await transport.idle();
    expect(got).toEqual([{ orderId: 'old', total: 12, currency: 'USD' }]);
  });

  it('dead-letters unreadable messages (newer schema, bad payload, bad envelope, wrong type) with the original body', async () => {
    const transport = new MemoryTransport();
    const errors: string[] = [];
    const bus = new MessageBus({ transport, service: 'consumer', onError: (e, i) => { if (i.deadLettered) errors.push((e as Error).message); } });
    const handled = vi.fn();
    await bus.subscribe(OrderCreated, 'g', async p => { handled(p); });
    const mk = (over: Partial<Envelope>) => createEnvelope({ type: 'OrderCreated', schemaVersion: 2, correlationId: 'cx', traceparent: formatTraceparent(newTraceContext()), source: 's', payload: { orderId: 'o', total: 1, currency: 'USD' }, ...over } as never);
    const send = (body: string) => transport.publish('orders.created', body, {});
    await send(encodeEnvelope(mk({ schemaVersion: 9 }))); // newer than we know
    await send(encodeEnvelope(mk({ payload: { orderId: 5 } as never }))); // invalid payload
    await send('{"garbage":true}'); // invalid envelope
    await send(encodeEnvelope(mk({ type: 'Other' }))); // wrong type
    await transport.idle();
    await transport.idle();
    expect(handled).not.toHaveBeenCalled();
    const dead = transport.published(deadLetterChannel('orders.created')).map(m => decodeEnvelope(m.body) as Envelope<DeadLetter>);
    expect(dead.map(d => d.payload.reason).sort()).toEqual(['invalid-envelope', 'invalid-payload', 'schema-version', 'type-mismatch']);
    expect(dead.every(d => d.type === 'DeadLetter')).toBe(true);
    expect(dead.find(d => d.payload.reason === 'schema-version')!.correlationId).toBe('cx'); // flow id preserved
    expect(dead.find(d => d.payload.reason === 'invalid-envelope')!.payload.originalBody).toBe('{"garbage":true}');
    expect(errors).toHaveLength(4);
  });

  it('retries a failing handler, then dead-letters it; a handler that recovers is not dead-lettered', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'consumer', handlerRetry: fastRetry });
    let flaky = 0;
    let broken = 0;
    const flakyDef = defineMessage<{ k: string }>({ type: 'Flaky', channel: 'flaky', currentVersion: 1, schema: { k: 'string' }, upcasters: {} });
    const brokenDef = defineMessage<{ k: string }>({ type: 'Broken', channel: 'broken', currentVersion: 1, schema: { k: 'string' }, upcasters: {} });
    await bus.subscribe(flakyDef, 'g', async () => { if (++flaky < 3) throw new Error('transient'); });
    await bus.subscribe(brokenDef, 'g', async () => { broken++; throw new Error('permanent'); });
    await bus.publish(flakyDef, { k: 'a' });
    await bus.publish(brokenDef, { k: 'b' });
    await transport.idle();
    await transport.idle();
    expect(flaky).toBe(3);
    expect(transport.published(deadLetterChannel('flaky'))).toHaveLength(0);
    expect(broken).toBe(3);
    const dead = transport.published(deadLetterChannel('broken')).map(m => decodeEnvelope(m.body) as Envelope<DeadLetter>);
    expect(dead).toHaveLength(1);
    expect(dead[0].payload).toEqual(expect.objectContaining({ reason: 'handler-failed', error: 'permanent', attempts: 3, originalChannel: 'broken' }));
  });

  it('validates on publish and refuses an invalid payload before touching the broker', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'orders' });
    await expect(bus.publish(OrderCreated, { orderId: 1, total: 'x', currency: 'USD' } as never)).rejects.toBeInstanceOf(ValidationError);
    expect(transport.published('orders.created')).toHaveLength(0);
  });

  it('acceptNewer lets a consumer read a newer producer (forward compatibility)', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'c', acceptNewer: true });
    const got: unknown[] = [];
    await bus.subscribe(OrderCreated, 'g', async p => { got.push(p); });
    const env = createEnvelope({ type: 'OrderCreated', schemaVersion: 3, correlationId: 'c', traceparent: formatTraceparent(newTraceContext()), source: 'future', payload: { orderId: 'f', total: 1, currency: 'USD', newField: 'ignored' } });
    await transport.publish('orders.created', encodeEnvelope(env), {});
    await transport.idle();
    expect(got).toHaveLength(1);
  });

  it('circuit breaker + retry guard publishing: the broker outage opens the circuit, recovery closes it', async () => {
    const transport = new MemoryTransport();
    let t = 0;
    const transitions: string[] = [];
    const bus = new MessageBus({
      transport,
      service: 'orders',
      breaker: { failureThreshold: 2, resetTimeoutMs: 1000, now: () => t, onStateChange: (to, from) => transitions.push(`${from}->${to}`) },
      publishRetry: { maxAttempts: 2, sleep: async () => undefined },
    });
    const payload = { orderId: 'o', total: 1, currency: 'USD' };
    transport.failPublishWith = new Error('broker down');
    await expect(bus.publish(OrderCreated, payload)).rejects.toBeInstanceOf(RetryExhaustedError); // failure 1 (2 attempts)
    await expect(bus.publish(OrderCreated, payload)).rejects.toBeInstanceOf(RetryExhaustedError); // failure 2 -> open
    expect(bus.breakerFor('orders.created')!.currentState).toBe('open');
    const spy = vi.spyOn(transport, 'publish');
    await expect(bus.publish(OrderCreated, payload)).rejects.toBeInstanceOf(CircuitOpenError); // fail fast
    expect(spy).not.toHaveBeenCalled();
    transport.failPublishWith = undefined;
    t = 1000; // reset timeout elapsed -> half-open probe
    await bus.publish(OrderCreated, payload);
    expect(bus.breakerFor('orders.created')!.currentState).toBe('closed');
    expect(transitions).toEqual(['closed->open', 'open->half-open', 'half-open->closed']);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('breakers are per channel and can be disabled', async () => {
    const bus = new MessageBus({ transport: new MemoryTransport(), service: 's' });
    expect(bus.breakerFor('a')).not.toBe(bus.breakerFor('b'));
    expect(bus.breakerFor('a')).toBe(bus.breakerFor('a'));
    expect(new MessageBus({ transport: new MemoryTransport(), service: 's', breaker: false }).breakerFor('a')).toBeUndefined();
  });

  it('stop() ends delivery; startFrom=beginning replays the backlog to a new group', async () => {
    const transport = new MemoryTransport();
    const bus = new MessageBus({ transport, service: 'orders' });
    await bus.publish(OrderCreated, { orderId: 'early', total: 1, currency: 'USD' });
    const replay: string[] = [];
    const sub = await bus.subscribe(OrderCreated, 'late', async p => { replay.push(p.orderId); }, { startFrom: 'beginning' });
    await transport.idle();
    expect(replay).toEqual(['early']);
    await sub.stop();
    await bus.publish(OrderCreated, { orderId: 'after-stop', total: 1, currency: 'USD' });
    await new Promise(r => setTimeout(r, 20));
    expect(replay).toEqual(['early']);
  });
});
