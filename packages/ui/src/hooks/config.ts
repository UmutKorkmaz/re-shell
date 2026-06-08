/**
 * Shared hub-connection configuration for the React transport hooks.
 *
 * Every hook talks to the allow-listed hub by `{ commandId, params }` only —
 * never a raw command/argv. The hub URL and session token are resolved here so
 * the SSE and WS hooks agree on a single source of truth.
 *
 * Resolution order for both base URL and token is:
 *   1. an explicit per-call option (highest precedence)
 *   2. the RUNTIME global `window.__RE_SHELL_HUB__` injected into the page
 *   3. the Vite build-time env var
 *   4. a localhost default (URL only)
 *
 * The runtime global exists so a PREBUILT static bundle (the published CLI ships
 * a compiled dashboard, not the Vite dev server) can receive a fresh, per-launch
 * hub URL + session token at load time WITHOUT a rebuild. The static server that
 * serves the bundle injects `window.__RE_SHELL_HUB__ = { url, token }` into the
 * page; this module reads it back here.
 */

const DEFAULT_HUB_HOST = '127.0.0.1';
const DEFAULT_HUB_PORT = '3333';

/** Runtime hub config injected into the page by the static server. */
export interface RuntimeHubConfig {
  /** Hub HTTP base URL, e.g. `http://127.0.0.1:3333`. */
  url?: string;
  /** Per-launch session token enforced by the hub on every route. */
  token?: string;
}

declare global {
  interface Window {
    /**
     * Fresh, per-launch hub connection info injected by the static server that
     * serves a prebuilt dashboard bundle. Read via {@link getRuntimeHubConfig}.
     */
    __RE_SHELL_HUB__?: RuntimeHubConfig;
  }
}

/**
 * Read the runtime hub config injected into the page, with no `any`.
 *
 * Safe under non-browser runtimes (vitest/node, library build) where `window`
 * is undefined: returns an empty object. The shape is validated defensively —
 * only string `url`/`token` are honored — so a malformed global never produces
 * a non-string that later breaks URL parsing or header assignment.
 */
export function getRuntimeHubConfig(): RuntimeHubConfig {
  if (typeof window === 'undefined') {
    return {};
  }
  const runtime = window.__RE_SHELL_HUB__;
  if (runtime === undefined || runtime === null) {
    return {};
  }
  const url = typeof runtime.url === 'string' ? runtime.url : undefined;
  const token = typeof runtime.token === 'string' ? runtime.token : undefined;
  return { url, token };
}

interface ViteEnv {
  VITE_RE_SHELL_UI_HUB_TOKEN?: string;
  VITE_RE_SHELL_UI_HUB_URL?: string;
  VITE_RE_SHELL_UI_HOST?: string;
  VITE_RE_SHELL_UI_PORT?: string;
}

/**
 * Read the Vite build-time env without assuming `import.meta.env` exists.
 *
 * Each `VITE_*` value is accessed via a DIRECT `import.meta.env.VITE_*` member
 * expression so Vite statically inlines it at build time. Going through an
 * indirected object (e.g. `const e = import.meta.env; e.VITE_X`) defeats that
 * static replacement and leaves the value `undefined` in the production bundle,
 * which would make every dashboard connect token-less and get a 401 from the
 * hub. The `typeof import.meta` guard keeps this safe under non-Vite runtimes
 * (e.g. the vitest/node test env), where `import.meta.env` may be absent.
 */
function readViteEnv(): ViteEnv {
  // Guard the whole `import.meta.env` object for non-Vite runtimes (vitest/node),
  // where it may be absent. Cast to a possibly-undefined view for the check only.
  const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;
  if (env === undefined) {
    return {};
  }
  // Direct `import.meta.env.VITE_*` accesses so Vite inlines each at build time.
  return {
    VITE_RE_SHELL_UI_HUB_TOKEN: import.meta.env.VITE_RE_SHELL_UI_HUB_TOKEN,
    VITE_RE_SHELL_UI_HUB_URL: import.meta.env.VITE_RE_SHELL_UI_HUB_URL,
    VITE_RE_SHELL_UI_HOST: import.meta.env.VITE_RE_SHELL_UI_HOST,
    VITE_RE_SHELL_UI_PORT: import.meta.env.VITE_RE_SHELL_UI_PORT,
  };
}

/**
 * Resolve the hub session token. Resolution order: explicit option, then the
 * runtime global (`window.__RE_SHELL_HUB__.token`), then the Vite build env.
 * Returns undefined when none is available; the underlying clients then connect
 * without a token and the hub rejects the unauthorized handshake.
 */
export function resolveHubToken(explicit?: string): string | undefined {
  if (explicit) {
    return explicit;
  }
  const runtimeToken = getRuntimeHubConfig().token;
  if (runtimeToken) {
    return runtimeToken;
  }
  return readViteEnv().VITE_RE_SHELL_UI_HUB_TOKEN;
}

/**
 * Resolve the hub HTTP base URL (e.g. `http://127.0.0.1:3333`). Resolution
 * order: explicit value, then the runtime global (`window.__RE_SHELL_HUB__.url`),
 * then `VITE_RE_SHELL_UI_HUB_URL`, then host/port env vars, then the localhost
 * default. The returned value never has a trailing slash.
 */
export function resolveHubBaseUrl(explicit?: string): string {
  const env = readViteEnv();
  const raw = explicit ?? getRuntimeHubConfig().url ?? env.VITE_RE_SHELL_UI_HUB_URL;
  if (raw) {
    return stripTrailingSlash(raw);
  }
  const host = env.VITE_RE_SHELL_UI_HOST ?? DEFAULT_HUB_HOST;
  const port = env.VITE_RE_SHELL_UI_PORT ?? DEFAULT_HUB_PORT;
  return `http://${host}:${port}`;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/** Per-hook connection overrides shared by the SSE and WS hooks. */
export interface HubConnectionOptions {
  /** Override the hub HTTP base URL. Defaults to the resolved value above. */
  baseUrl?: string;
  /** Override the per-launch session token. Defaults to the resolved value. */
  token?: string;
}

/**
 * Build the SSE `/events` URL for a one-shot `--json` command. `commandId` and
 * `params` are passed as query params exactly as the hub expects; the token is
 * NOT placed in the query (the {@link SseClient} sends it as a header instead).
 */
export function buildEventsUrl(
  baseUrl: string,
  commandId: string,
  params?: unknown
): string {
  const url = new URL('/events', `${baseUrl}/`);
  url.searchParams.set('commandId', commandId);
  if (params !== undefined) {
    url.searchParams.set('params', JSON.stringify(params));
  }
  return url.toString();
}

/** Build the WS `/jobs` URL from the resolved HTTP base URL. */
export function buildJobsUrl(baseUrl: string): string {
  const wsBase = baseUrl.replace(/^http/, 'ws');
  return `${stripTrailingSlash(wsBase)}/jobs`;
}
