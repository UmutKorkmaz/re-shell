// The message envelope every async message travels in.

import { randomUUID } from 'crypto';

/** Wire envelope (JSON). Field names are the cross-language contract. */
export interface Envelope<T = unknown> {
  /** Unique message id (UUID). */
  id: string;
  /** Message type name, e.g. `OrderCreated`. */
  type: string;
  /** Schema version of `payload` as produced. */
  schemaVersion: number;
  /** Id shared by every message of one logical request/flow. */
  correlationId: string;
  /** Id of the message that caused this one (absent for flow roots). */
  causationId?: string;
  /** W3C traceparent of the producing span. */
  traceparent: string;
  /** Producing service name. */
  source: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  payload: T;
}

/** Thrown for malformed envelopes. */
export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeError';
  }
}

/** Fields needed to build an envelope. */
export interface NewEnvelope<T> {
  type: string;
  schemaVersion: number;
  correlationId: string;
  causationId?: string;
  traceparent: string;
  source: string;
  payload: T;
  id?: string;
  timestamp?: string;
}

/** Build an envelope (id and timestamp default to fresh values). */
export function createEnvelope<T>(input: NewEnvelope<T>): Envelope<T> {
  const env: Envelope<T> = {
    id: input.id ?? randomUUID(),
    type: input.type,
    schemaVersion: input.schemaVersion,
    correlationId: input.correlationId,
    traceparent: input.traceparent,
    source: input.source,
    timestamp: input.timestamp ?? new Date().toISOString(),
    payload: input.payload,
  };
  if (input.causationId) env.causationId = input.causationId;
  return env;
}

/** Serialize to the JSON wire form. */
export function encodeEnvelope(env: Envelope): string {
  return JSON.stringify(env);
}

/** Parse + structurally validate the JSON wire form. @throws EnvelopeError */
export function decodeEnvelope(raw: string | Buffer): Envelope {
  let value: unknown;
  try {
    value = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch {
    throw new EnvelopeError('message body is not valid JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new EnvelopeError('message body is not an object');
  const e = value as Record<string, unknown>;
  for (const key of ['id', 'type', 'correlationId', 'traceparent', 'source', 'timestamp'] as const) {
    if (typeof e[key] !== 'string' || (e[key] as string) === '') throw new EnvelopeError(`envelope.${key} must be a non-empty string`);
  }
  if (typeof e.schemaVersion !== 'number' || !Number.isInteger(e.schemaVersion) || e.schemaVersion < 1) {
    throw new EnvelopeError('envelope.schemaVersion must be a positive integer');
  }
  if (!('payload' in e)) throw new EnvelopeError('envelope.payload is missing');
  if (e.causationId !== undefined && typeof e.causationId !== 'string') throw new EnvelopeError('envelope.causationId must be a string');
  return e as unknown as Envelope;
}

/** Transport headers mirroring the envelope metadata (for brokers that expose headers). */
export function envelopeHeaders(env: Envelope): Record<string, string> {
  const headers: Record<string, string> = {
    'x-message-id': env.id,
    'x-message-type': env.type,
    'x-schema-version': String(env.schemaVersion),
    'x-correlation-id': env.correlationId,
    traceparent: env.traceparent,
    'x-source': env.source,
  };
  if (env.causationId) headers['x-causation-id'] = env.causationId;
  return headers;
}
