// Real-broker tests: the async runtime against Redis 7 in Docker.
// Skipped (not failed) when no Docker daemon is available.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Redis from 'ioredis';

import {
  MessageBus,
  decodeEnvelope,
  deadLetterChannel,
  defineMessage,
  createEnvelope,
  encodeEnvelope,
  envelopeHeaders,
  formatTraceparent,
  newTraceContext,
  parseTraceparent,
  type DeadLetter,
  type Envelope,
} from '../../src/bridge/async/runtime';
import { RedisStreamsTransport } from '../../src/bridge/async/runtime/redis-streams';
import { dockerAvailable, startContainer, waitFor, type Container } from '../utils/docker';

const run = dockerAvailable();

describe.skipIf(!run)('async runtime over Redis Streams (docker redis:7)', () => {
  let container: Container;
  let url: string;
  let admin: Redis;
  const transports: RedisStreamsTransport[] = [];

  const mk = (opts: Partial<ConstructorParameters<typeof RedisStreamsTransport>[0]> = {}): RedisStreamsTransport => {
    const t = new RedisStreamsTransport({ url, blockMs: 200, ...opts });
    transports.push(t);
    return t;
  };

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

  async function until(cond: () => boolean, ms = 15000, what = 'condition'): Promise<void> {
    const deadline = Date.now() + ms;
    while (!cond()) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await new Promise(r => setTimeout(r, 25));
    }
  }

  beforeAll(async () => {
    container = await startContainer({ image: 'redis:7', containerPort: 6379 });
    url = `redis://127.0.0.1:${container.port}`;
    admin = new Redis(url, { maxRetriesPerRequest: null });
    await waitFor(async () => {
      if ((await admin.ping()) !== 'PONG') throw new Error('no pong');
    }, 30000, 'redis');
  }, 180000);

  afterAll(async () => {
    for (const t of transports) await t.close();
    admin?.disconnect();
    container?.stop();
  }, 60000);

  it('round-trips a message and the correlation id, schemaVersion and traceparent survive the broker', async () => {
    const producer = new MessageBus({ transport: mk(), service: 'orders' });
    const consumer = new MessageBus({ transport: mk(), service: 'billing' });
    const received: Envelope<{ orderId: string }>[] = [];
    await consumer.subscribe(OrderCreated, 'billing-g1', async (_p, env) => { received.push(env); });
    const sent = await producer.publish(OrderCreated, { orderId: 'o-1', total: 19.99, currency: 'EUR' }, { correlationId: 'corr-redis-1', key: 'o-1' });
    await until(() => received.length === 1, 15000, 'delivery');

    expect(received[0].correlationId).toBe('corr-redis-1');
    expect(received[0].schemaVersion).toBe(2);
    expect(received[0].id).toBe(sent.id);
    expect(received[0].traceparent).toBe(sent.traceparent);
    expect(received[0].payload).toEqual({ orderId: 'o-1', total: 19.99, currency: 'EUR' });

    // what is actually stored in the stream: body + mirrored headers
    const entries = (await admin.call('XRANGE', 'orders.created', '-', '+')) as [string, string[]][];
    const fields = Object.fromEntries(chunk(entries[0][1]));
    expect(fields['h:x-correlation-id']).toBe('corr-redis-1');
    expect(fields['h:traceparent']).toBe(sent.traceparent);
    expect(fields.key).toBe('o-1');
    expect(decodeEnvelope(fields.body).correlationId).toBe('corr-redis-1');
    // acked: nothing left pending for the group
    await waitForPending('orders.created', 'billing-g1', 0);
  }, 60000);

  it('consumer groups: members of a group share the stream; another group sees everything', async () => {
    const ch = defineMessage<{ n: string }>({ type: 'Tick', channel: 'ticks', currentVersion: 1, schema: { n: 'string' }, upcasters: {} });
    const producer = new MessageBus({ transport: mk(), service: 'p' });
    const a = new MessageBus({ transport: mk(), service: 'a' });
    const b = new MessageBus({ transport: mk(), service: 'b' });
    const other = new MessageBus({ transport: mk(), service: 'o' });
    const seenA: string[] = [];
    const seenB: string[] = [];
    const seenOther: string[] = [];
    await a.subscribe(ch, 'workers', async p => { seenA.push(p.n); });
    await b.subscribe(ch, 'workers', async p => { seenB.push(p.n); });
    await other.subscribe(ch, 'auditors', async p => { seenOther.push(p.n); });
    const ids = Array.from({ length: 20 }, (_v, i) => `m${i}`);
    for (const n of ids) await producer.publish(ch, { n });
    await until(() => seenA.length + seenB.length === 20 && seenOther.length === 20, 20000, 'all deliveries');
    expect([...seenA, ...seenB].sort()).toEqual([...ids].sort()); // each message exactly once within the group
    expect(seenOther.sort()).toEqual([...ids].sort());
    expect(seenA.length).toBeGreaterThan(0);
    expect(seenB.length).toBeGreaterThan(0);
  }, 60000);

  it('a handler that keeps failing is retried then dead-lettered to <channel>.dlq with the flow id', async () => {
    const def = defineMessage<{ k: string }>({ type: 'Poison', channel: 'poison', currentVersion: 1, schema: { k: 'string' }, upcasters: {} });
    const bus = new MessageBus({ transport: mk(), service: 'c', handlerRetry: { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 10 } });
    let attempts = 0;
    await bus.subscribe(def, 'g', async () => { attempts++; throw new Error('cannot process'); });
    await bus.publish(def, { k: 'x' }, { correlationId: 'poison-flow' });
    await until(() => attempts >= 2, 15000, 'retries');
    const dlq = await waitForStreamLength(deadLetterChannel('poison'), 1);
    const env = decodeEnvelope(Object.fromEntries(chunk(dlq[0][1])).body) as Envelope<DeadLetter>;
    expect(env.payload).toEqual(expect.objectContaining({ reason: 'handler-failed', error: 'cannot process', attempts: 2, originalChannel: 'poison' }));
    expect(env.correlationId).toBe('poison-flow');
    await waitForPending('poison', 'g', 0); // dead-lettered messages are acked, not stuck
  }, 60000);

  it('schema evolution across the broker: a v1 producer is upcast for a v2 consumer', async () => {
    const consumer = new MessageBus({ transport: mk(), service: 'billing' });
    const got: unknown[] = [];
    await consumer.subscribe(OrderCreated, 'evolve', async p => { got.push(p); });
    const legacy = mk();
    const env = createEnvelope({ type: 'OrderCreated', schemaVersion: 1, correlationId: 'legacy-1', traceparent: formatTraceparent(newTraceContext()), source: 'legacy-orders', payload: { orderId: 'old', amount: 7 } });
    await legacy.publish('orders.created', encodeEnvelope(env), envelopeHeaders(env));
    await until(() => got.length === 1, 15000, 'upcast delivery');
    expect(got[0]).toEqual({ orderId: 'old', total: 7, currency: 'USD' });
  }, 60000);

  it('propagates correlation + trace through a handler that publishes (a two-hop flow)', async () => {
    const orders = new MessageBus({ transport: mk(), service: 'orders' });
    const billing = new MessageBus({ transport: mk(), service: 'billing' });
    const audit = new MessageBus({ transport: mk(), service: 'audit' });
    const hops: Envelope[] = [];
    await billing.subscribe(OrderCreated, 'billing-flow', async (p, env) => {
      hops.push(env);
      await billing.publish(InvoiceIssued, { orderId: p.orderId, invoiceId: `inv-${p.orderId}` });
    });
    await audit.subscribe(InvoiceIssued, 'audit-flow', async (_p, env) => { hops.push(env); });
    const first = await orders.publish(OrderCreated, { orderId: 'flow-1', total: 5, currency: 'USD' }, { correlationId: 'checkout-77' });
    await until(() => hops.length === 2, 20000, 'two hops');
    const [h1, h2] = hops;
    expect(h1.id).toBe(first.id);
    expect(h2.type).toBe('InvoiceIssued');
    expect(h2.correlationId).toBe('checkout-77');
    expect(h2.causationId).toBe(first.id);
    expect(parseTraceparent(h2.traceparent)!.traceId).toBe(parseTraceparent(first.traceparent)!.traceId);
    expect(h2.source).toBe('billing');
  }, 60000);

  it('at-least-once: an un-acked message is reclaimed from a dead consumer (XAUTOCLAIM) and redelivered', async () => {
    const channel = 'reclaim';
    const failing = mk({ claimIdleMs: 600, consumerName: 'crashy' });
    const attemptsSeen: number[] = [];
    // consumer 1 "crashes": its handler rejects, so the message stays pending
    const sub1 = await failing.subscribe(channel, 'rg', async m => { attemptsSeen.push(m.deliveryCount); throw new Error('crash'); });
    const producer = mk();
    await producer.publish(channel, '{"hello":"world"}', { traceparent: 'x' });
    await until(() => attemptsSeen.length >= 1, 10000, 'first delivery');
    await sub1.stop();

    const delivered: { count: number; body: string }[] = [];
    const rescuer = mk({ claimIdleMs: 600, consumerName: 'rescuer' });
    await rescuer.subscribe(channel, 'rg', async m => { delivered.push({ count: m.deliveryCount, body: m.body }); });
    await until(() => delivered.length >= 1, 20000, 'reclaimed delivery');
    expect(delivered[0].body).toBe('{"hello":"world"}');
    expect(delivered[0].count).toBeGreaterThanOrEqual(2); // redelivery is visible to the handler
    await waitForPending(channel, 'rg', 0);
  }, 60000);

  it('restart recovery: a consumer re-reads its own un-acked backlog on start', async () => {
    const channel = 'restart';
    const first = mk({ consumerName: 'same-name' });
    let boom = true;
    const sub = await first.subscribe(channel, 'rg2', async () => { if (boom) throw new Error('crash before ack'); });
    const producer = mk();
    await producer.publish(channel, 'persist-me', {});
    await waitForPending(channel, 'rg2', 1);
    boom = false;
    await sub.stop();
    const got: string[] = [];
    await mk({ consumerName: 'same-name' }).subscribe(channel, 'rg2', async m => { got.push(m.body); });
    await until(() => got.length === 1, 15000, 'backlog replay');
    expect(got).toEqual(['persist-me']);
    await waitForPending(channel, 'rg2', 0);
  }, 60000);

  it('startFrom=beginning replays history to a brand-new group', async () => {
    const channel = 'history';
    const t = mk();
    for (const n of ['a', 'b', 'c']) await t.publish(channel, n, {});
    const got: string[] = [];
    await mk().subscribe(channel, 'fresh', async m => { got.push(m.body); }, { startFrom: 'beginning' });
    await until(() => got.length === 3, 15000, 'replay');
    expect(got).toEqual(['a', 'b', 'c']);
    const latestOnly: string[] = [];
    await mk().subscribe(channel, 'fresh-latest', async m => { latestOnly.push(m.body); });
    await t.publish(channel, 'd', {});
    await until(() => latestOnly.length === 1, 15000, 'latest');
    expect(latestOnly).toEqual(['d']);
  }, 60000);

  // --- helpers ---------------------------------------------------------------
  function chunk(flat: string[]): [string, string][] {
    const out: [string, string][] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
    return out;
  }

  async function waitForPending(stream: string, group: string, expected: number): Promise<void> {
    await waitFor(async () => {
      const summary = (await admin.call('XPENDING', stream, group)) as [number, ...unknown[]];
      if (Number(summary[0]) !== expected) throw new Error(`pending=${summary[0]}, want ${expected}`);
    }, 20000, `pending ${stream}/${group}=${expected}`);
  }

  async function waitForStreamLength(stream: string, n: number): Promise<[string, string[]][]> {
    let entries: [string, string[]][] = [];
    await waitFor(async () => {
      entries = (await admin.call('XRANGE', stream, '-', '+')) as [string, string[]][];
      if (entries.length < n) throw new Error(`stream ${stream} has ${entries.length} entries`);
    }, 20000, `stream ${stream}`);
    return entries;
  }
});
