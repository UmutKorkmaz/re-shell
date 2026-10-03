// Kafka transport (kafkajs). At-least-once: offsets are committed only after the
// handler resolves; a rejecting handler makes kafkajs redeliver after backoff.

import { Kafka, logLevel, type Consumer, type Producer } from 'kafkajs';

import type { MessageHandler, SubscribeOptions, Subscription, Transport } from './transport';

/** Options for {@link KafkaTransport}. */
export interface KafkaOptions {
  /** Bootstrap brokers, e.g. `['localhost:9092']`. Ignored when `kafka` is given. */
  brokers?: string[];
  clientId?: string;
  /** An existing kafkajs client. */
  kafka?: Kafka;
  /** Partitions for topics this adapter creates (default 1). */
  numPartitions?: number;
  /** Receives non-fatal adapter errors. */
  onError?: (error: unknown) => void;
}

/** Kafka transport. */
export class KafkaTransport implements Transport {
  readonly name = 'kafka';
  private readonly kafka: Kafka;
  private producer?: Producer;
  private readonly consumers = new Set<Consumer>();
  private readonly known = new Set<string>();
  private readonly partitions: number;
  private closed = false;

  constructor(options: KafkaOptions = {}) {
    this.kafka =
      options.kafka ??
      new Kafka({
        clientId: options.clientId ?? 're-shell-bridge',
        brokers: options.brokers ?? ['localhost:9092'],
        logLevel: logLevel.NOTHING,
        retry: { retries: 8, initialRetryTime: 200 },
      });
    this.partitions = options.numPartitions ?? 1;
  }

  private async ensureTopic(topic: string): Promise<void> {
    if (this.known.has(topic)) return;
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      await admin.createTopics({ waitForLeaders: true, topics: [{ topic, numPartitions: this.partitions }] });
    } finally {
      await admin.disconnect();
    }
    this.known.add(topic);
  }

  private async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
      await this.producer.connect();
    }
    return this.producer;
  }

  async publish(channel: string, body: string, headers: Record<string, string>, key?: string): Promise<void> {
    if (this.closed) throw new Error('transport is closed');
    await this.ensureTopic(channel);
    const producer = await this.getProducer();
    await producer.send({ topic: channel, messages: [{ key: key ?? null, value: body, headers }] });
  }

  async subscribe(channel: string, group: string, handler: MessageHandler, options: SubscribeOptions = {}): Promise<Subscription> {
    if (this.closed) throw new Error('transport is closed');
    await this.ensureTopic(channel);
    const consumer = this.kafka.consumer({ groupId: group, allowAutoTopicCreation: true });
    await consumer.connect();
    this.consumers.add(consumer);
    await consumer.subscribe({ topic: channel, fromBeginning: options.startFrom === 'beginning' });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(message.headers ?? {})) {
          if (v !== undefined) headers[k] = Array.isArray(v) ? v.map(String).join(',') : v.toString();
        }
        await handler({
          channel,
          key: message.key ? message.key.toString() : undefined,
          body: message.value ? message.value.toString('utf8') : '',
          headers,
          deliveryCount: 1,
        });
      },
    });
    return {
      stop: async () => {
        this.consumers.delete(consumer);
        await consumer.disconnect();
      },
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.allSettled([...this.consumers].map(c => c.disconnect()));
    this.consumers.clear();
    if (this.producer) await this.producer.disconnect();
  }
}
