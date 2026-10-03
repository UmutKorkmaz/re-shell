// W3C Trace Context (traceparent) helpers + correlation ids.
// Format: 00-<32 hex trace-id>-<16 hex parent-id>-<2 hex flags>
// https://www.w3.org/TR/trace-context/#traceparent-header

import { randomBytes, randomUUID } from 'crypto';

/** A parsed traceparent. */
export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

function hex(bytes: number): string {
  // The spec forbids all-zero ids.
  for (;;) {
    const value = randomBytes(bytes).toString('hex');
    if (/[1-9a-f]/.test(value)) return value;
  }
}

/** A fresh root trace (new trace-id and span-id, sampled). */
export function newTraceContext(): TraceContext {
  return { traceId: hex(16), spanId: hex(8), sampled: true };
}

/** Serialize to a `traceparent` header value. */
export function formatTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.sampled ? '01' : '00'}`;
}

/** Parse a `traceparent` header; undefined when absent or malformed (never throws). */
export function parseTraceparent(value: string | undefined | null): TraceContext | undefined {
  if (!value) return undefined;
  const m = TRACEPARENT.exec(value.trim().toLowerCase());
  if (!m) return undefined;
  const [, traceId, spanId, flags] = m;
  if (/^0+$/.test(traceId) || /^0+$/.test(spanId)) return undefined;
  return { traceId, spanId, sampled: (parseInt(flags, 16) & 1) === 1 };
}

/** A child span of `parent` (same trace-id, new span-id), or a new root when there is no parent. */
export function childOf(parent: TraceContext | undefined): TraceContext {
  if (!parent) return newTraceContext();
  return { traceId: parent.traceId, spanId: hex(8), sampled: parent.sampled };
}

/** A new correlation id (UUID v4). */
export function newCorrelationId(): string {
  return randomUUID();
}
