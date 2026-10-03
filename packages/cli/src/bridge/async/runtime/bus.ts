// MessageBus: typed publish/subscribe over any Transport, adding what every
// service needs and nobody should hand-roll:
//   - envelopes with correlationId, schemaVersion and a W3C traceparent
//   - context propagation (a handler's publishes inherit correlation + trace)
//   - schema evolution (upcasting older payloads, validation)
//   - a circuit breaker + retry with backoff around publishing
//   - retries, then a dead-letter channel (`<channel>.dlq`), around handlers

import { CircuitBreaker, type BreakerOptions } from './circuit-breaker';
import { currentContext, runWithContext } from './context';
import { createEnvelope, decodeEnvelope, encodeEnvelope, envelopeHeaders, type Envelope } from './envelope';
import { SchemaVersionError, ValidationError, upcastPayload, validatePayload, type MessageDefinition } from './evolution';
import { retry, type RetryPolicy } from './retry';
import { childOf, formatTraceparent, newCorrelationId, parseTraceparent } from './trace';
import type { SubscribeOptions, Subscription, Transport } from './transport';

/** Bus configuration. */
export interface BusOptions {
  transport: Transport;
  /** Name of this service (stamped as `source`). */
  service: string;
  /** Publish breaker tuning, or `false` to disable. */
  breaker?: BreakerOptions | false;
  /** Publish retry policy. */
  publishRetry?: RetryPolicy;
  /** Handler retry policy before dead-lettering (default 3 attempts). */
  handlerRetry?: RetryPolicy;
  /** Accept messages from newer producers (forward compatibility). */
  acceptNewer?: boolean;
  /** Observability hook for dead-lettered messages and handler errors. */
  onError?: (error: unknown, info: { channel: string; envelope?: Envelope; deadLettered: boolean }) => void;
}

/** Per-publish options. */
export interface PublishOptions {
  /** Override the correlation id (default: current message's, else a new one). */
  correlationId?: string;
  /** Partition / ordering key. */
  key?: string;
  /** Publish as an older schema version (e.g. to test consumers); payload is validated against `schemas` if given. */
  schemaVersion?: number;
}

/** Per-subscription options. */
export interface SubscriptionOptions extends SubscribeOptions {
  acceptNewer?: boolean;
  retry?: RetryPolicy;
}

/** Handler of a typed message. */
export type TypedHandler<T> = (payload: T, envelope: Envelope<T>) => Promise<void> | void;

/** Dead-letter payload (published to `<channel>.dlq`). */
export interface DeadLetter {
  reason: 'handler-failed' | 'invalid-envelope' | 'schema-version' | 'invalid-payload' | 'type-mismatch';
  error: string;
  attempts: number;
  originalChannel: string;
  originalBody: string;
}

/** Name of the dead-letter channel of `channel`. */
export function deadLetterChannel(channel: string): string {
  return `${channel}.dlq`;
}

/** Typed message bus. */
export class MessageBus {
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly subscriptions = new Set<Subscription>();

  constructor(private readonly options: BusOptions) {}

  /** The publish breaker of a channel (created on first use). */
  breakerFor(channel: string): CircuitBreaker | undefined {
    if (this.options.breaker === false) return undefined;
    let b = this.breakers.get(channel);
    if (!b) {
      b = new CircuitBreaker({ name: `publish:${channel}`, ...(this.options.breaker ?? {}) });
      this.breakers.set(channel, b);
    }
    return b;
  }

  /**
   * Publish a typed message.
   * @returns the envelope that was sent (carrying correlationId, schemaVersion, traceparent).
   * @throws ValidationError when the payload does not match the schema; CircuitOpenError /
   *   RetryExhaustedError when the broker is unavailable.
   */
  async publish<T>(def: MessageDefinition<T>, payload: T, options: PublishOptions = {}): Promise<Envelope<T>> {
    const version = options.schemaVersion ?? def.currentVersion;
    if (version === def.currentVersion) {
      const problems = validatePayload(def.schema, payload);
      if (problems.length > 0) throw new ValidationError(def.type, problems);
    }
    const ctx = currentContext();
    const correlationId = options.correlationId ?? ctx?.correlationId ?? newCorrelationId();
    const parent = parseTraceparent(ctx?.traceparent);
    const envelope = createEnvelope<T>({
      type: def.type,
      schemaVersion: version,
      correlationId,
      causationId: ctx?.messageId,
      traceparent: formatTraceparent(childOf(parent)),
      source: this.options.service,
      payload,
    });
    const body = encodeEnvelope(envelope);
    const headers = envelopeHeaders(envelope);
    const send = (): Promise<void> => retry(() => this.options.transport.publish(def.channel, body, headers, options.key), this.options.publishRetry ?? { maxAttempts: 3, baseDelayMs: 50, maxDelayMs: 1000 });
    const breaker = this.breakerFor(def.channel);
    await (breaker ? breaker.execute(send) : send());
    return envelope;
  }

  /**
   * Consume a typed message. Older payloads are upcast, the result validated,
   * the handler retried, and unrecoverable messages dead-lettered (then acked).
   */
  async subscribe<T>(def: MessageDefinition<T>, group: string, handler: TypedHandler<T>, options: SubscriptionOptions = {}): Promise<Subscription> {
    const sub = await this.options.transport.subscribe(
      def.channel,
      group,
      async message => {
        let envelope: Envelope | undefined;
        const deadLetter = async (reason: DeadLetter['reason'], error: unknown, attempts: number): Promise<void> => {
          this.options.onError?.(error, { channel: def.channel, envelope, deadLettered: true });
          const dl = createEnvelope<DeadLetter>({
            type: 'DeadLetter',
            schemaVersion: 1,
            correlationId: envelope?.correlationId ?? message.headers['x-correlation-id'] ?? newCorrelationId(),
            causationId: envelope?.id,
            traceparent: envelope?.traceparent ?? message.headers.traceparent ?? formatTraceparent(childOf(undefined)),
            source: this.options.service,
            payload: {
              reason,
              error: error instanceof Error ? error.message : String(error),
              attempts,
              originalChannel: def.channel,
              originalBody: message.body,
            },
          });
          await this.options.transport.publish(deadLetterChannel(def.channel), encodeEnvelope(dl), envelopeHeaders(dl));
        };

        try {
          envelope = decodeEnvelope(message.body);
        } catch (error) {
          await deadLetter('invalid-envelope', error, message.deliveryCount);
          return;
        }
        if (envelope.type !== def.type) {
          await deadLetter('type-mismatch', new Error(`expected ${def.type}, got ${envelope.type}`), message.deliveryCount);
          return;
        }
        let current: T;
        try {
          current = upcastPayload(def, envelope.payload, envelope.schemaVersion, { acceptNewer: options.acceptNewer ?? this.options.acceptNewer }) as T;
        } catch (error) {
          await deadLetter(error instanceof SchemaVersionError ? 'schema-version' : 'invalid-payload', error, message.deliveryCount);
          return;
        }
        const problems = validatePayload(def.schema, current);
        if (problems.length > 0) {
          await deadLetter('invalid-payload', new ValidationError(def.type, problems), message.deliveryCount);
          return;
        }

        const parent = parseTraceparent(envelope.traceparent);
        const span = formatTraceparent(childOf(parent));
        const delivered: Envelope<T> = { ...(envelope as Envelope<T>), payload: current };
        let attempts = 0;
        try {
          await retry(
            async attempt => {
              attempts = attempt;
              await runWithContext({ correlationId: delivered.correlationId, traceparent: span, messageId: delivered.id }, async () => {
                await handler(current, delivered);
              });
            },
            options.retry ?? this.options.handlerRetry ?? { maxAttempts: 3, baseDelayMs: 50, maxDelayMs: 1000 }
          );
        } catch (error) {
          const cause = (error as { cause?: unknown }).cause ?? error;
          await deadLetter('handler-failed', cause, attempts);
        }
      },
      { startFrom: options.startFrom }
    );
    this.subscriptions.add(sub);
    return {
      stop: async () => {
        this.subscriptions.delete(sub);
        await sub.stop();
      },
    };
  }

  /** Stop all subscriptions and close the transport. */
  async close(): Promise<void> {
    for (const s of [...this.subscriptions]) await s.stop();
    this.subscriptions.clear();
    await this.options.transport.close();
  }
}
