import type { HubConfig } from './hub-client.js';

/**
 * PURE module. No VS Code, no Node side effects (the environment is injected).
 *
 * Resolves the extension's connection settings. Each value can come from the
 * VS Code setting or from an environment variable (handy when the editor is
 * started from a shell that already exports the hub details, and for the
 * integration tests):
 *
 *   setting                 environment fallback
 *   reShell.cliBin          RE_SHELL_CLI_BIN
 *   reShell.hub.url         RE_SHELL_UI_HUB_URL
 *   reShell.hub.token       RE_SHELL_UI_HUB_TOKEN
 *
 * Precedence: an explicitly configured setting (anything other than the
 * contributed default) wins; otherwise the environment variable; otherwise the
 * default.
 */

export const DEFAULT_CLI_BIN = 're-shell';
export const DEFAULT_HUB_URL = 'http://127.0.0.1:3334';
export const DEFAULT_HUB_TIMEOUT_MS = 120_000;

/** Environment variable names read as fallbacks. */
export const ENV_CLI_BIN = 'RE_SHELL_CLI_BIN';
export const ENV_HUB_URL = 'RE_SHELL_UI_HUB_URL';
export const ENV_HUB_TOKEN = 'RE_SHELL_UI_HUB_TOKEN';

export type Env = Readonly<Record<string, string | undefined>>;

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Pick `configured` unless it is empty/default, then `fromEnv`, then the default. */
function pick(configured: string | undefined, defaultValue: string, fromEnv: string | undefined): string {
  const explicit = nonEmpty(configured);
  if (explicit !== undefined && explicit !== defaultValue) {
    return explicit;
  }
  return nonEmpty(fromEnv) ?? explicit ?? defaultValue;
}

/** The CLI binary/entry to launch. */
export function resolveCliBinSetting(configured: string | undefined, env: Env): string {
  return pick(configured, DEFAULT_CLI_BIN, env[ENV_CLI_BIN]);
}

/** Raw hub values as read from VS Code configuration. */
export interface RawHubSettings {
  readonly url?: string;
  readonly token?: string;
  readonly timeoutMs?: number;
}

export type ResolvedHub =
  | { ok: true; config: HubConfig; timeoutMs: number }
  | { ok: false; error: string };

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * Resolve the hub connection. Fails explicitly (never guesses) when:
 *   - no token is available (the hub refuses unauthenticated requests),
 *   - the URL is malformed or not http(s),
 *   - the URL does not point at the loopback interface. The hub only ever binds
 *     127.0.0.1; sending its session token anywhere else would leak it.
 */
export function resolveHubConfig(raw: RawHubSettings, env: Env): ResolvedHub {
  const token = nonEmpty(raw.token) ?? nonEmpty(env[ENV_HUB_TOKEN]);
  if (token === undefined) {
    return {
      ok: false,
      error:
        'No hub token configured. Set "reShell.hub.token" (printed as "Hub token:" by `re-shell ui`) ' +
        `or the ${ENV_HUB_TOKEN} environment variable.`,
    };
  }

  const urlText = pick(raw.url, DEFAULT_HUB_URL, env[ENV_HUB_URL]);
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    return { ok: false, error: `Hub URL "${urlText}" is not a valid URL.` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: `Hub URL must use http or https, got "${url.protocol}".` };
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      error:
        `Hub URL host "${url.hostname}" is not a loopback address. The Re-Shell hub is ` +
        'loopback-only; refusing to send the hub token to another host.',
    };
  }

  const timeoutMs =
    typeof raw.timeoutMs === 'number' && Number.isFinite(raw.timeoutMs) && raw.timeoutMs >= 1000
      ? Math.floor(raw.timeoutMs)
      : DEFAULT_HUB_TIMEOUT_MS;

  return { ok: true, config: { baseUrl: url.origin, token }, timeoutMs };
}
