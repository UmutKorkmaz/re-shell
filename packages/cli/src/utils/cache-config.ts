// Resolve build-cache configuration from the environment + CLI flags.
//
// Centralises the two settings both `re-shell run` and `re-shell cache` need:
//   - the cache root directory, and
//   - the HMAC secret used to sign/verify artifacts.
//
// The secret is read from RE_SHELL_CACHE_SECRET; when unset a stable per-machine
// default is derived so signing still works locally (a shared/remote cache MUST
// set an explicit secret — a build that trusts foreign artifacts without one is
// the caller's choice). The remote backend is OFF unless RE_SHELL_REMOTE_CACHE
// is set, which the run command turns into an HTTP transport.

import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';

/** Env var holding the HMAC secret for cache artifact signing. */
export const CACHE_SECRET_ENV = 'RE_SHELL_CACHE_SECRET';
/** Env var holding the remote cache base URL (enables the remote backend). */
export const REMOTE_CACHE_ENV = 'RE_SHELL_REMOTE_CACHE';
/** Env var holding the bearer token for the remote cache, if any. */
export const REMOTE_CACHE_TOKEN_ENV = 'RE_SHELL_REMOTE_CACHE_TOKEN';

/**
 * Resolve the cache root for a workspace. An explicit `--cache-dir` wins;
 * otherwise the workspace-local `<root>/.re-shell/cache` is used so caches stay
 * scoped to a checkout. (A global `~/.re-shell/cache` is available via override.)
 */
export function resolveCacheRoot(workspaceRoot: string, override?: string): string {
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }
  return path.join(path.resolve(workspaceRoot), '.re-shell', 'cache');
}

/**
 * Resolve the HMAC secret. Prefers the explicit env var; falls back to a stable
 * per-user default derived from the home dir + a fixed salt so local signing is
 * deterministic across runs without configuration. The default is NOT a
 * security boundary — it only makes single-machine local caching tamper-evident.
 */
export function resolveCacheSecret(
  source: Readonly<Record<string, string | undefined>> = process.env
): string {
  const explicit = source[CACHE_SECRET_ENV];
  if (explicit && explicit.length > 0) return explicit;
  return createHash('sha256')
    .update(`re-shell-cache:${os.homedir()}`)
    .digest('hex');
}

/** The resolved remote-cache settings, or undefined when the remote is off. */
export interface RemoteCacheSettings {
  baseUrl: string;
  token?: string;
}

/**
 * Resolve remote-cache settings from the environment. Returns undefined (remote
 * OFF) unless {@link REMOTE_CACHE_ENV} is set to a non-empty URL.
 * Throws a clear error when the URL scheme is not http or https.
 */
export function resolveRemoteCacheSettings(
  source: Readonly<Record<string, string | undefined>> = process.env
): RemoteCacheSettings | undefined {
  const baseUrl = source[REMOTE_CACHE_ENV];
  if (!baseUrl || baseUrl.trim().length === 0) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(baseUrl.trim());
  } catch {
    throw new Error(
      `RE_SHELL_REMOTE_CACHE is not a valid URL: "${baseUrl}"`
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `RE_SHELL_REMOTE_CACHE scheme must be http or https, got "${parsed.protocol.replace(/:$/, '')}"`
    );
  }

  const token = source[REMOTE_CACHE_TOKEN_ENV];
  return { baseUrl: baseUrl.trim().replace(/\/+$/, ''), token: token || undefined };
}
