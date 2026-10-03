// Real-broker tests: the async runtime against Apache Kafka (KRaft, single node) in Docker.
// Skipped (not failed) when no Docker daemon is available.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Kafka, logLevel } from 'kafkajs';

import {
  MessageBus,
  createEnvelope,
  decodeEnvelope,
  deadLetterChannel,
  defineMessage,
  encodeEnvelope,
  envelopeHeaders,
  formatTraceparent,
  newTraceContext,
  type DeadLetter,
  type Envelope,
} from '../../src/bridge/async/runtime';
import { KafkaTransport } from '../../src/bridge/async/runtime/kafka';
import { dockerAvailable, freePort, startContainer, waitFor, type Container } from '../utils/docker';

describe.skipIf(!dockerAvailable())('async runtime over Kafka (docker apache/kafka:3.9.0)', () => {
  let container: Container;
  let brokers: string[];
  const transports: KafkaTransport[] = [];
  const mk = (): KafkaTransport => {
    const t = new KafkaTransport({ brokers });
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

  async function until(cond: () => boolean, ms = 60000, what = 'condition'): Promise<void> {
    const deadline = Date.now() + ms;
    while (!cond()) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await new Promise(r => setTimeout(r, 100));
    }
  }

  beforeAll(async () => {
    const port = await freePort();
    container = await startContainer({
      image: 'apache/kafka:3.9.0',
      containerPort: 9092,
      hostPort: port,
      env: {
        KAFKA_NODE_ID: '1',
        KAFKA_PROCESS_ROLES: 'broker,controller',
        KAFKA_LISTENERS: 'PLAINTEXT://:9092,CONTROLLER://:9093',
        KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://localhost:${port}`,
        KAFKA_CONTROLLER_LISTENER_NAMES: 'CONTROLLER',
        KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT',
        KAFKA_CONTROLLER_QUORUM_VOTERS: '1@localhost:9093',
        KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
        KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: '1',
        KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: '1',
        KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: '0',
        KAFKA_NUM_PARTITIONS: '1',
      },
    });
    brokers = [`localhost:${port}`];
    await waitFor(async () => {
      const admin = new Kafka({ brokers, logLevel: logLevel.NOTHING, retry: { retries: 0 } }).admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
    }, 120000, 'kafka broker');
  }, 240000);

  afterAll(async () => {
    for (const t of transports) await t.close();
    container?.stop();
  }, 60000);

  it('round-trips a message; correlation id, schemaVersion and traceparent survive in body and Kafka headers', async () => {
    const producer = new MessageBus({ transport: mk(), service: 'orders' });
    const consumer = new MessageBus({ transport: mk(), service: 'billing' });
    const received: Envelope<{ orderId: string }>[] = [];
    await consumer.subscribe(OrderCreated, 'billing-g1', async (_p, env) => { received.push(env); }, { startFrom: 'beginning' });
    const sent = await producer.publish(OrderCreated, { orderId: 'k-1', total: 12.5, currency: 'EUR' }, { correlationId: 'corr-kafka-1', key: 'k-1' });
    await until(() => received.length === 1, 90000, 'kafka delivery');
    expect(received[0].correlationId).toBe('corr-kafka-1');
    expect(received[0].schemaVersion).toBe(2);
    expect(received[0].traceparent).toBe(sent.traceparent);
    expect(received[0].payload).toEqual({ orderId: 'k-1', total: 12.5, currency: 'EUR' });

    // inspect the raw record: Kafka headers mirror the envelope
    const raw = new Kafka({ brokers, logLevel: logLevel.NOTHING }).consumer({ groupId: 'inspector' });
    await raw.connect();
    await raw.subscribe({ topic: 'orders.created', fromBeginning: true });
    const records: { key?: string; headers: Record<string, string>; value: string }[] = [];
    await raw.run({
      eachMessage: async ({ message }) => {
        records.push({
          key: message.key?.toString(),
          value: message.value!.toString(),
          headers: Object.fromEntries(Object.entries(message.headers ?? {}).map(([k, v]) => [k, String(v)])),
        });
      },
    });
    await until(() => records.length >= 1, 60000, 'raw record');
    await raw.disconnect();
    expect(records[0].key).toBe('k-1');
    expect(records[0].headers['x-correlation-id']).toBe('corr-kafka-1');
    expect(records[0].headers.traceparent).toBe(sent.traceparent);
    expect(decodeEnvelope(records[0].value).correlationId).toBe('corr-kafka-1');
  }, 180000);

  it('upcasts an old-schema producer and dead-letters poison messages to <topic>.dlq', async () => {
    const bus = new MessageBus({ transport: mk(), service: 'billing', handlerRetry: { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 10 } });
    const got: unknown[] = [];
    await bus.subscribe(OrderCreated, 'evolve', async p => {
      if ((p as { orderId: string }).orderId === 'bad') throw new Error('cannot process');
      got.push(p);
    }, { startFrom: 'beginning' });

    const legacy = mk();
    const old = createEnvelope({ type: 'OrderCreated', schemaVersion: 1, correlationId: 'legacy-k', traceparent: formatTraceparent(newTraceContext()), source: 'legacy', payload: { orderId: 'old', amount: 3 } });
    await legacy.publish('orders.created', encodeEnvelope(old), envelopeHeaders(old));
    const poison = createEnvelope({ type: 'OrderCreated', schemaVersion: 2, correlationId: 'poison-k', traceparent: formatTraceparent(newTraceContext()), source: 'x', payload: { orderId: 'bad', total: 1, currency: 'USD' } });
    await legacy.publish('orders.created', encodeEnvelope(poison), envelopeHeaders(poison));
    await until(() => got.some(p => (p as { orderId: string }).orderId === 'old'), 90000, 'upcast delivery');
    expect(got.find(p => (p as { orderId: string }).orderId === 'old')).toEqual({ orderId: 'old', total: 3, currency: 'USD' });

    const dead: Envelope<DeadLetter>[] = [];
    const dlqBus = new MessageBus({ transport: mk(), service: 'ops' });
    const dlqDef = defineMessage<DeadLetter>({
      type: 'DeadLetter',
      channel: deadLetterChannel('orders.created'),
      currentVersion: 1,
      schema: { reason: 'string', error: 'string', attempts: 'integer', originalChannel: 'string', originalBody: 'string' },
      upcasters: {},
    });
    await dlqBus.subscribe(dlqDef, 'ops-dlq', async (_p, env) => { dead.push(env as Envelope<DeadLetter>); }, { startFrom: 'beginning' });
    await until(() => dead.length >= 1, 90000, 'dead letter');
    expect(dead[0].payload).toEqual(expect.objectContaining({ reason: 'handler-failed', error: 'cannot process', attempts: 2 }));
    expect(dead[0].correlationId).toBe('poison-k');
  }, 240000);
});
