import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

/**
 * Minimal, strict HS256 JSON Web Token implementation on `node:crypto`, with
 * `kid`-based key rotation.
 *
 * Deliberately narrow, to remove whole classes of JWT bugs:
 *  - Only `alg: "HS256"` is accepted. `none`, RS/ES/PS and every other value are
 *    rejected before any signature work (no algorithm confusion).
 *  - The header may contain only `alg`, `typ` and `kid`. Anything else (`jwk`,
 *    `jku`, `x5u`, `crit`, ...) is rejected rather than ignored.
 *  - `kid` is REQUIRED and selects the verification key from the key ring; an
 *    unknown `kid` fails exactly like a bad signature.
 *  - Signature comparison is constant-time.
 *  - `exp` is REQUIRED; `nbf`/`iat` are checked against a small clock skew.
 *  - verification never reports WHY it failed to a caller of the API — only the
 *    internal `reason` for logs/tests; the HTTP edge turns every failure into
 *    the same UNAUTHENTICATED response (no token-probing oracle).
 */

const MAX_TOKEN_LENGTH = 4096;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const KID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
/** HS256 keys must carry at least 256 bits of entropy. */
export const MIN_KEY_BYTES = 32;

export function base64urlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input: string): Buffer | undefined {
  if (!BASE64URL.test(input)) {
    return undefined;
  }
  return Buffer.from(input, 'base64url');
}

/**
 * The set of signing/verification keys. The `activeKid` key signs new tokens;
 * every key in the ring verifies, so a retired key keeps validating tokens it
 * already issued until it is removed (rotation: add new key + make it active,
 * wait out the longest token lifetime, remove the old key).
 */
export class JwtKeyRing {
  private keys: ReadonlyMap<string, Buffer>;
  private active: string;

  constructor(keys: Readonly<Record<string, Buffer | string>>, activeKid?: string) {
    const parsed = JwtKeyRing.parse(keys, activeKid);
    this.keys = parsed.keys;
    this.active = parsed.active;
  }

  private static parse(
    keys: Readonly<Record<string, Buffer | string>>,
    activeKid: string | undefined
  ): { keys: ReadonlyMap<string, Buffer>; active: string } {
    const map = new Map<string, Buffer>();
    for (const [kid, secret] of Object.entries(keys)) {
      if (!KID_PATTERN.test(kid)) {
        throw new Error(`Invalid key id "${kid}": use 1-64 characters of A-Z a-z 0-9 . _ -`);
      }
      const bytes = typeof secret === 'string' ? decodeSecret(kid, secret) : Buffer.from(secret);
      if (bytes.length < MIN_KEY_BYTES) {
        throw new Error(`Key "${kid}" is too short: HS256 keys need at least ${MIN_KEY_BYTES} bytes.`);
      }
      map.set(kid, bytes);
    }
    if (map.size === 0) {
      throw new Error('At least one signing key is required.');
    }
    const active = activeKid ?? (map.size === 1 ? Array.from(map.keys())[0] : undefined);
    if (!active) {
      throw new Error('Several keys are configured: name the active key id explicitly.');
    }
    if (!map.has(active)) {
      throw new Error(`Active key id "${active}" is not in the key ring.`);
    }
    return { keys: map, active };
  }

  /** The key id new tokens are signed with. */
  get activeKid(): string {
    return this.active;
  }

  /** The key ids in the ring (never the secrets). */
  get kids(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Atomically replace the ring's contents (key rotation without a restart).
   * The replacement is fully validated first; on any error the current keys stay
   * in force.
   */
  reload(keys: Readonly<Record<string, Buffer | string>>, activeKid?: string): void {
    const parsed = JwtKeyRing.parse(keys, activeKid);
    this.keys = parsed.keys;
    this.active = parsed.active;
  }

  /** @internal key material lookup for sign/verify in this module. */
  keyFor(kid: string): Buffer | undefined {
    return this.keys.get(kid);
  }
}

function decodeSecret(kid: string, secret: string): Buffer {
  // Accept standard base64 and base64url; reject anything else so a raw
  // passphrase pasted by mistake fails loudly instead of being used as-is.
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(secret)) {
    throw new Error(`Key "${kid}" must be base64 or base64url encoded.`);
  }
  return Buffer.from(secret.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Generate a fresh random HS256 secret (base64url) suitable for a key ring entry. */
export function generateSecret(): string {
  return randomBytes(48).toString('base64url');
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export const claimsSchema = z
  .object({
    iss: z.string().min(1),
    aud: z.string().min(1),
    sub: z.string().min(1).max(256),
    iat: z.number().int().nonnegative(),
    nbf: z.number().int().nonnegative().optional(),
    exp: z.number().int().positive(),
    jti: z.string().min(1).max(128),
    /** What the token authenticates: an end user or an execution worker. */
    kind: z.enum(['user', 'worker']),
    /** Worker tokens are bound to exactly one tenant. */
    ten: z.string().min(1).max(128).optional(),
  })
  .strict();

export type JwtClaims = z.infer<typeof claimsSchema>;

export type VerifyFailure =
  | 'malformed'
  | 'bad-header'
  | 'bad-algorithm'
  | 'unknown-key'
  | 'bad-signature'
  | 'bad-claims'
  | 'wrong-issuer'
  | 'wrong-audience'
  | 'expired'
  | 'not-yet-valid';

export type VerifyResult =
  | { ok: true; claims: JwtClaims; kid: string }
  | { ok: false; reason: VerifyFailure };

const HEADER_KEYS = new Set(['alg', 'typ', 'kid']);

function sign(keyRing: JwtKeyRing, kid: string, signingInput: string): Buffer {
  const key = keyRing.keyFor(kid);
  if (!key) {
    throw new Error(`Unknown key id "${kid}"`);
  }
  return createHmac('sha256', key).update(signingInput).digest();
}

/** Sign `claims` with the ring's active key. */
export function signJwt(keyRing: JwtKeyRing, claims: JwtClaims): string {
  const parsed = claimsSchema.parse(claims);
  const header = { alg: 'HS256', typ: 'JWT', kid: keyRing.activeKid };
  const signingInput = `${base64urlEncode(JSON.stringify(header))}.${base64urlEncode(
    JSON.stringify(parsed)
  )}`;
  return `${signingInput}.${sign(keyRing, keyRing.activeKid, signingInput).toString('base64url')}`;
}

export interface VerifyOptions {
  issuer: string;
  audience: string;
  /** Unix ms. */
  now: number;
  /** Tolerance for `nbf`/`iat` in the future, in seconds (default 5). */
  clockSkewSeconds?: number;
}

function parseJsonObject(bytes: Buffer): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return undefined;
}

const DUMMY_KEY = Buffer.alloc(MIN_KEY_BYTES, 1);

/** Verify a compact JWT. Never throws. */
export function verifyJwt(token: unknown, keyRing: JwtKeyRing, options: VerifyOptions): VerifyResult {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: 'malformed' };
  }
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    return { ok: false, reason: 'malformed' };
  }
  const [rawHeader, rawPayload, rawSignature] = parts;
  const headerBytes = base64urlDecode(rawHeader);
  const payloadBytes = base64urlDecode(rawPayload);
  const signature = base64urlDecode(rawSignature);
  if (!headerBytes || !payloadBytes || !signature) {
    return { ok: false, reason: 'malformed' };
  }

  const header = parseJsonObject(headerBytes);
  if (!header) {
    return { ok: false, reason: 'bad-header' };
  }
  for (const key of Object.keys(header)) {
    if (!HEADER_KEYS.has(key)) {
      return { ok: false, reason: 'bad-header' };
    }
  }
  if (header.alg !== 'HS256') {
    return { ok: false, reason: 'bad-algorithm' };
  }
  if (header.typ !== undefined && header.typ !== 'JWT') {
    return { ok: false, reason: 'bad-header' };
  }
  if (typeof header.kid !== 'string' || !KID_PATTERN.test(header.kid)) {
    return { ok: false, reason: 'bad-header' };
  }

  // Always do the HMAC work, even for an unknown kid, so response time does not
  // reveal which key ids exist.
  const key = keyRing.keyFor(header.kid);
  const expected = createHmac('sha256', key ?? DUMMY_KEY)
    .update(`${rawHeader}.${rawPayload}`)
    .digest();
  const signatureOk = signature.length === expected.length && timingSafeEqual(signature, expected);
  if (!key) {
    return { ok: false, reason: 'unknown-key' };
  }
  if (!signatureOk) {
    return { ok: false, reason: 'bad-signature' };
  }

  const payload = parseJsonObject(payloadBytes);
  const claims = payload ? claimsSchema.safeParse(payload) : undefined;
  if (!claims || !claims.success) {
    return { ok: false, reason: 'bad-claims' };
  }
  const c = claims.data;
  if (c.iss !== options.issuer) {
    return { ok: false, reason: 'wrong-issuer' };
  }
  if (c.aud !== options.audience) {
    return { ok: false, reason: 'wrong-audience' };
  }
  const nowSeconds = options.now / 1000;
  const skew = options.clockSkewSeconds ?? 5;
  if (nowSeconds >= c.exp) {
    return { ok: false, reason: 'expired' };
  }
  if (c.nbf !== undefined && nowSeconds + skew < c.nbf) {
    return { ok: false, reason: 'not-yet-valid' };
  }
  if (nowSeconds + skew < c.iat) {
    return { ok: false, reason: 'not-yet-valid' };
  }
  return { ok: true, claims: c, kid: header.kid };
}
