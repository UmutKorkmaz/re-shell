import type { IncomingMessage } from 'node:http';

/**
 * Per-key token-bucket rate limiter. In-memory and single-process (see
 * docs/control-plane.md, "Remaining limits"); the key is a principal id for
 * authenticated traffic or a client address for anonymous traffic.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();

  /**
   * @param capacity   burst size (tokens a full bucket holds)
   * @param perMinute  sustained refill rate
   * @param maxKeys    bound on tracked keys; the least recently used are dropped
   */
  constructor(
    private readonly capacity: number,
    private readonly perMinute: number,
    private readonly maxKeys = 10_000
  ) {}

  /** Try to spend one token for `key`. */
  take(key: string, now: number): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const refillPerMs = this.perMinute / 60_000;
    const existing = this.buckets.get(key);
    let tokens = this.capacity;
    if (existing) {
      tokens = Math.min(this.capacity, existing.tokens + (now - existing.updatedAt) * refillPerMs);
      // Re-insert to mark as most recently used.
      this.buckets.delete(key);
    }
    if (tokens < 1) {
      this.buckets.set(key, { tokens, updatedAt: now });
      return { allowed: false, retryAfterMs: Math.ceil((1 - tokens) / refillPerMs) };
    }
    this.buckets.set(key, { tokens: tokens - 1, updatedAt: now });
    if (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) {
        this.buckets.delete(oldest);
      }
    }
    return { allowed: true };
  }

  /** Number of tracked keys (test helper). */
  get size(): number {
    return this.buckets.size;
  }
}

export type BodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; code: 'PAYLOAD_TOO_LARGE' | 'INVALID_REQUEST' | 'UNSUPPORTED_MEDIA_TYPE'; message: string };

/**
 * Read a JSON object body with a hard byte limit.
 *
 *  - A declared Content-Length above the limit is refused without reading.
 *  - A streamed body is counted as it arrives and aborted once over the limit.
 *  - An empty body is `{}`; a non-empty body must be `application/json` and
 *    parse to a JSON OBJECT (arrays, scalars and `null` are refused).
 */
export function readJsonBody(req: IncomingMessage, limitBytes: number): Promise<BodyResult> {
  return new Promise((resolve) => {
    const declared = req.headers['content-length'];
    if (declared !== undefined) {
      const n = Number(declared);
      if (!Number.isFinite(n) || n < 0) {
        resolve({ ok: false, code: 'INVALID_REQUEST', message: 'Invalid Content-Length.' });
        return;
      }
      if (n > limitBytes) {
        resolve({
          ok: false,
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body exceeds ${limitBytes} bytes.`,
        });
        return;
      }
    }

    const chunks: Buffer[] = [];
    let received = 0;
    let settled = false;
    const settle = (result: BodyResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      received += chunk.length;
      if (received > limitBytes) {
        settle({
          ok: false,
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body exceeds ${limitBytes} bytes.`,
        });
        // Stop buffering; the connection is closed after the response.
        req.pause();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', () =>
      settle({ ok: false, code: 'INVALID_REQUEST', message: 'The request body could not be read.' })
    );
    req.on('aborted', () =>
      settle({ ok: false, code: 'INVALID_REQUEST', message: 'The request was aborted.' })
    );
    req.on('end', () => {
      if (settled) return;
      if (received === 0) {
        settle({ ok: true, value: {} });
        return;
      }
      const type = String(req.headers['content-type'] ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (type !== 'application/json') {
        settle({
          ok: false,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Request bodies must be application/json.',
        });
        return;
      }
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          settle({ ok: false, code: 'INVALID_REQUEST', message: 'The request body must be a JSON object.' });
          return;
        }
        settle({ ok: true, value: parsed as Record<string, unknown> });
      } catch {
        settle({ ok: false, code: 'INVALID_REQUEST', message: 'The request body is not valid JSON.' });
      }
    });
  });
}

/** Extract the token from an `Authorization: Bearer <token>` header. */
export function bearerToken(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') {
    return undefined;
  }
  const match = /^Bearer[ \t]+([^\s]+)$/i.exec(header.trim());
  return match ? match[1] : undefined;
}

/**
 * The address to rate-limit an anonymous caller by. Behind a trusted reverse
 * proxy the LAST `X-Forwarded-For` entry is the address that proxy observed;
 * earlier entries are client-controlled and ignored. Without `trustProxy` the
 * header is never read, so it cannot be used to dodge the limiter.
 */
export function clientAddress(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[forwarded.length - 1] : forwarded;
    if (value) {
      const parts = value.split(',');
      const last = parts[parts.length - 1].trim();
      if (last) {
        return last;
      }
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}
