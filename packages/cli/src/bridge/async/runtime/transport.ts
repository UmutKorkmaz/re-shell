// The transport contract implemented by the in-memory, Redis Streams and Kafka adapters.
//
// Delivery is AT-LEAST-ONCE. A handler that resolves acknowledges the message;
// a handler that rejects leaves it for redelivery. (The MessageBus never rejects
// for business errors: it retries, dead-letters and then acknowledges.)

/** One delivered message. */
export interface TransportMessage {
  channel: string;
  /** Partitioning / ordering key, when the producer set one. */
  key?: string;
  /** The JSON-encoded envelope. */
  body: string;
  /** Transport headers (traceparent, x-correlation-id, ...). */
  headers: Record<string, string>;
  /** 1 on first delivery; higher on redelivery, where the broker can tell. */
  deliveryCount: number;
}

/** Subscription tuning. */
export interface SubscribeOptions {
  /** Where a NEW consumer group starts: its first message is the oldest (`beginning`) or the next one (`latest`, default). */
  startFrom?: 'beginning' | 'latest';
}

/** Handle to stop consuming. */
export interface Subscription {
  stop(): Promise<void>;
}

/** Message handler: resolve = ack, reject = redeliver. */
export type MessageHandler = (message: TransportMessage) => Promise<void>;

/** A message broker adapter. */
export interface Transport {
  readonly name: string;
  publish(channel: string, body: string, headers: Record<string, string>, key?: string): Promise<void>;
  /** Join consumer `group` on `channel`; members of a group share the messages. */
  subscribe(channel: string, group: string, handler: MessageHandler, options?: SubscribeOptions): Promise<Subscription>;
  close(): Promise<void>;
}
