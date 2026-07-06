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

/**
 * Name of the environment variable that holds the HMAC secret used to sign and
 * verify build-cache artifacts. When unset, a stable per-machine default is
 * derived by {@link resolveCacheSecret}.
 */
export const CACHE_SECRET_ENV = 'RE_SHELL_CACHE_SECRET';
/**
 * Name of the environment variable that holds the remote cache base URL.
 * Setting this to a non-empty http(s) URL enables the remote cache backend;
 * leaving it unset keeps the remote backend disabled.
 */
export const REMOTE_CACHE_ENV = 'RE_SHELL_REMOTE_CACHE';
/**
 * Name of the environment variable that holds the optional bearer token used
 * to authenticate against the remote cache backend. Only consulted when
 * {@link REMOTE_CACHE_ENV} is also set.
 */
export const REMOTE_CACHE_TOKEN_ENV = 'RE_SHELL_REMOTE_CACHE_TOKEN';

/**
 * Resolve the cache root directory for a workspace. An explicit `--cache-dir`
 * override always wins; otherwise the workspace-local `<root>/.re-shell/cache`
 * directory is used so caches stay scoped to a checkout. (A global
 * `~/.re-shell/cache` is available via the same override mechanism.)
 *
 * @param workspaceRoot - Absolute (or resolvable) path to the workspace root
 *   used when no override is supplied.
 * @param override - Optional explicit cache directory, typically sourced from
 *   the `--cache-dir` CLI flag. Whitespace-only values are ignored.
 * @returns The absolute path to the resolved cache root directory.
 */
export function resolveCacheRoot(workspaceRoot: string, override?: string): string {
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }
  return path.join(path.resolve(workspaceRoot), '.re-shell', 'cache');
}

/**
 * Resolve the HMAC secret used to sign and verify cache artifacts. Prefers the
 * explicit value from {@link CACHE_SECRET_ENV}; when that is unset or empty,
 * falls back to a stable per-user default derived from the home directory and
 * a fixed salt so local signing is deterministic across runs without any
 * configuration. The default is NOT a security boundary — it only makes
 * single-machine local caching tamper-evident. A shared/remote cache MUST set
 * an explicit secret.
 *
 * @param source - The record (defaults to `process.env`) from which to read the
 *   {@link CACHE_SECRET_ENV} value.
 * @returns The resolved HMAC secret string.
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

/**
 * Resolved remote-cache settings. Returned by {@link resolveRemoteCacheSettings}
 * only when the remote cache backend is enabled; `undefined` is returned
 * otherwise (meaning the remote is OFF).
 */
export interface RemoteCacheSettings {
  /** Base URL of the remote cache backend (trailing slashes removed). */
  baseUrl: string;
  /** Optional bearer token used to authenticate against the remote backend. */
  token?: string;
}

/**
 * Resolve remote-cache settings from the environment. Returns `undefined`
 * (remote backend OFF) unless {@link REMOTE_CACHE_ENV} is set to a non-empty
 * URL. When enabled, the URL must parse successfully and use either the
 * `http:` or `https:` scheme; otherwise a descriptive error is thrown.
 *
 * @param source - The record (defaults to `process.env`) from which to read the
 *   {@link REMOTE_CACHE_ENV} and {@link REMOTE_CACHE_TOKEN_ENV} values.
 * @returns The resolved {@link RemoteCacheSettings} when the remote cache is
 *   enabled, or `undefined` when it is disabled.
 * @throws {Error} When the value of {@link REMOTE_CACHE_ENV} is not a valid URL.
 * @throws {Error} When the URL scheme is something other than `http` or `https`.
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
