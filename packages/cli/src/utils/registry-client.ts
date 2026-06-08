import * as crypto from 'crypto';

/**
 * Thin, typed client for the public npm registry. This is the MVP backing store
 * for the Re-Shell plugin marketplace: plugins are ordinary npm packages tagged
 * with the `reshell-plugin` keyword and/or published under a recognized scope.
 *
 * The module is deliberately free of CLI/chalk concerns and takes an injectable
 * `fetch` so it can be unit-tested with a mocked HTTP layer (NO live network in
 * tests). On any transport/HTTP failure it throws {@link RegistryUnreachableError}
 * so the command layer can map it to a `MARKETPLACE_UNREACHABLE` envelope rather
 * than silently falling back to fixtures.
 */

/** Default public npm registry origin. */
export const DEFAULT_REGISTRY_URL = 'https://registry.npmjs.org';

/** Keyword every Re-Shell plugin is expected to carry on npm. */
export const PLUGIN_KEYWORD = 'reshell-plugin';

/** Minimal global fetch type so we don't depend on DOM lib typings. */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal }
) => Promise<FetchResponse>;

export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}

/** Raised when the registry cannot be reached or returns a non-OK HTTP status. */
export class RegistryUnreachableError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'RegistryUnreachableError';
    this.details = details;
  }
}

/** A single hit from the npm search endpoint, narrowed to what we surface. */
export interface RegistrySearchHit {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  date?: string;
  author?: { name?: string };
  publisher?: { username?: string };
  links?: { homepage?: string; repository?: string; npm?: string };
}

/** A single registry signature entry attached to a published version. */
export interface RegistrySignature {
  keyid: string;
  sig: string;
}

/** The packument "version" object, narrowed to what the marketplace needs. */
export interface RegistryVersion {
  name: string;
  version: string;
  description?: string;
  author?: { name?: string; email?: string } | string;
  license?: string;
  homepage?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  repository?: { url?: string } | string;
  engines?: { node?: string };
  dist: {
    tarball: string;
    integrity?: string;
    shasum?: string;
    fileCount?: number;
    unpackedSize?: number;
    signatures?: RegistrySignature[];
    attestations?: { url?: string; provenance?: { predicateType?: string } };
  };
}

/** The full packument returned by `GET /<name>`. */
export interface RegistryPackument {
  name: string;
  description?: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, RegistryVersion>;
  time?: Record<string, string>;
  keywords?: string[];
  license?: string;
  author?: { name?: string } | string;
  homepage?: string;
  repository?: { url?: string } | string;
}

/** A registry signing key from `GET /-/npm/v1/keys`. */
export interface RegistryKey {
  keyid: string;
  keytype: string;
  /** base64-encoded SPKI public key. */
  key: string;
  expires?: string | null;
}

export interface RegistryClientOptions {
  registryUrl?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

export class RegistryClient {
  private readonly registryUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: RegistryClientOptions = {}) {
    this.registryUrl = (options.registryUrl ?? DEFAULT_REGISTRY_URL).replace(/\/+$/, '');
    const injected = options.fetchImpl;
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    const resolved = injected ?? globalFetch;
    if (!resolved) {
      throw new RegistryUnreachableError(
        'No fetch implementation available in this runtime'
      );
    }
    this.fetchImpl = resolved;
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  /**
   * Search the registry for plugins. We bias the query toward Re-Shell plugins
   * by appending the `keywords:reshell-plugin` qualifier the npm search API
   * understands, so the result set is plugins rather than arbitrary packages.
   */
  async search(query: string | undefined, limit: number): Promise<RegistrySearchHit[]> {
    const text = [query?.trim(), `keywords:${PLUGIN_KEYWORD}`].filter(Boolean).join(' ');
    const size = Math.max(1, Math.min(limit, 250));
    const url = `${this.registryUrl}/-/v1/search?text=${encodeURIComponent(text)}&size=${size}`;

    const body = await this.getJson(url);
    const objects = (body as { objects?: Array<{ package?: RegistrySearchHit }> }).objects;
    if (!Array.isArray(objects)) {
      return [];
    }
    return objects
      .map((o) => o.package)
      .filter((p): p is RegistrySearchHit => !!p && typeof p.name === 'string');
  }

  /** Fetch the full packument for a package. */
  async getPackument(name: string): Promise<RegistryPackument> {
    const url = `${this.registryUrl}/${encodeURIComponent(name).replace('%40', '@')}`;
    const body = await this.getJson(url);
    const packument = body as RegistryPackument;
    if (!packument || typeof packument.name !== 'string' || !packument.versions) {
      throw new RegistryUnreachableError(`Malformed packument for "${name}"`, { name });
    }
    return packument;
  }

  /** Resolve a concrete version object for a package + version/tag (default: latest). */
  async getVersion(name: string, versionOrTag?: string): Promise<RegistryVersion> {
    const packument = await this.getPackument(name);
    const tag = versionOrTag ?? 'latest';
    const resolved =
      packument.versions[tag] !== undefined
        ? tag
        : packument['dist-tags']?.[tag] ?? packument['dist-tags']?.latest;
    if (!resolved || !packument.versions[resolved]) {
      throw new RegistryUnreachableError(
        `Version "${versionOrTag ?? 'latest'}" not found for "${name}"`,
        { name, version: versionOrTag }
      );
    }
    return packument.versions[resolved];
  }

  /** Fetch the registry's published signing keys. */
  async getSigningKeys(): Promise<RegistryKey[]> {
    const url = `${this.registryUrl}/-/npm/v1/keys`;
    const body = await this.getJson(url);
    const keys = (body as { keys?: RegistryKey[] }).keys;
    return Array.isArray(keys) ? keys : [];
  }

  private async getJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: FetchResponse;
    try {
      res = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      throw new RegistryUnreachableError(
        `Failed to reach registry: ${error instanceof Error ? error.message : String(error)}`,
        { url }
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new RegistryUnreachableError(
        `Registry request failed (${res.status} ${res.statusText})`,
        { url, status: res.status }
      );
    }
    try {
      return await res.json();
    } catch (error) {
      throw new RegistryUnreachableError(
        `Failed to parse registry response: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { url }
      );
    }
  }
}

/** Result of an honest signature verification attempt. */
export interface SignatureVerification {
  verified: boolean;
  /** Why verification failed/was skipped, for user-facing messaging. */
  reason?: string;
  /** The keyid that produced a valid signature (when verified). */
  keyid?: string;
}

/**
 * Honest, gated npm registry signature verification.
 *
 * npm signs each published version with Ed25519. The signed message is
 * `"<name>@<version>:<integrity>"`; `dist.signatures[].sig` is the base64
 * signature and the matching public key (base64 SPKI) is published at
 * `/-/npm/v1/keys`. This mirrors what the npm CLI / pacote does.
 *
 * Returns `{ verified: false, reason }` when the version has no signatures, no
 * integrity, or no signature validates against a known, unexpired key. It never
 * returns `verified: true` without a real cryptographic check passing.
 */
export function verifyRegistrySignature(
  version: RegistryVersion,
  keys: RegistryKey[]
): SignatureVerification {
  const signatures = version.dist?.signatures;
  if (!signatures || signatures.length === 0) {
    return {
      verified: false,
      reason: 'package version has no registry signatures (unsigned)',
    };
  }
  const integrity = version.dist?.integrity;
  if (!integrity) {
    return {
      verified: false,
      reason: 'package version has no dist.integrity to verify against',
    };
  }

  const message = Buffer.from(`${version.name}@${version.version}:${integrity}`);
  const now = Date.now();

  for (const signature of signatures) {
    const key = keys.find((k) => k.keyid === signature.keyid);
    if (!key) continue;
    if (key.expires && Date.parse(key.expires) < now) continue;

    try {
      const publicKey = crypto.createPublicKey({
        key: Buffer.from(key.key, 'base64'),
        format: 'der',
        type: 'spki',
      });
      const ok = crypto.verify(
        null,
        message,
        publicKey,
        Buffer.from(signature.sig, 'base64')
      );
      if (ok) {
        return { verified: true, keyid: signature.keyid };
      }
    } catch {
      // Try the next signature/key; a malformed key must not be fatal.
      continue;
    }
  }

  return {
    verified: false,
    reason: 'no registry signature validated against the published signing keys',
  };
}
