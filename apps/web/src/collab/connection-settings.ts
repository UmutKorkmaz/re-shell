import { iceServerSchema, type IceServerConfig } from '@re-shell/contracts';
import { z } from 'zod';

/**
 * Where the dashboard finds the hosted control plane for collaboration.
 *
 * Separate from the local-hub settings: the hub is a loopback daemon, the control
 * plane is a remote, multi-user service that needs a bearer token.
 *
 * Storage: the URL, tenant and ICE override live in localStorage. The TOKEN is a
 * credential, so by default it lives in sessionStorage (gone when the tab closes);
 * "Remember token on this device" opts into localStorage. Every access is
 * try/catch-wrapped: storage can be unavailable (private windows, blocked site
 * data), and the screen must still work for the current page view.
 */

export const connectionSettingsSchema = z.object({
  url: z.string(),
  tenant: z.string(),
  token: z.string(),
  rememberToken: z.boolean(),
  /** Optional JSON array of WebRTC ICE servers overriding the server-provided ones. */
  iceServers: z.string(),
});

export type ConnectionSettings = z.infer<typeof connectionSettingsSchema>;

export const DEFAULT_CONNECTION: ConnectionSettings = {
  url: '',
  tenant: '',
  token: '',
  rememberToken: false,
  iceServers: '',
};

const META_KEY = 're-shell.dashboard.control-plane.v1';
const TOKEN_KEY = 're-shell.dashboard.control-plane.token.v1';

function store(kind: 'local' | 'session'): Storage | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function read(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: string | null): void {
  try {
    if (!storage) return;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Storage is a convenience; the in-memory settings still apply.
  }
}

export function loadConnectionSettings(): ConnectionSettings {
  let meta: Partial<ConnectionSettings> = {};
  const raw = read(store('local'), META_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) meta = parsed as Partial<ConnectionSettings>;
    } catch {
      meta = {};
    }
  }
  const remembered = meta.rememberToken === true;
  const token = remembered ? read(store('local'), TOKEN_KEY) : read(store('session'), TOKEN_KEY);
  const merged = { ...DEFAULT_CONNECTION, ...meta, token: token ?? '', rememberToken: remembered };
  const result = connectionSettingsSchema.safeParse(merged);
  return result.success ? result.data : { ...DEFAULT_CONNECTION };
}

export function saveConnectionSettings(settings: ConnectionSettings): void {
  const result = connectionSettingsSchema.safeParse(settings);
  if (!result.success) return;
  const { token, ...meta } = result.data;
  write(store('local'), META_KEY, JSON.stringify(meta));
  // A token lives in exactly one place: remove it from the other store when the choice changes.
  if (result.data.rememberToken) {
    write(store('local'), TOKEN_KEY, token || null);
    write(store('session'), TOKEN_KEY, null);
  } else {
    write(store('session'), TOKEN_KEY, token || null);
    write(store('local'), TOKEN_KEY, null);
  }
}

export function clearConnectionToken(): void {
  write(store('local'), TOKEN_KEY, null);
  write(store('session'), TOKEN_KEY, null);
}

export type UrlCheck = { ok: true; url: string; warning?: string } | { ok: false; message: string };

/** Validate and normalize the control-plane base URL typed by the user. */
export function checkControlPlaneUrl(raw: string): UrlCheck {
  const text = raw.trim();
  if (text === '') return { ok: false, message: 'Enter the control plane URL.' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, message: 'That is not a valid URL (for example https://control-plane.example.com).' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: 'The control plane URL must start with http:// or https://.' };
  }
  if (url.username || url.password) {
    return { ok: false, message: 'Put credentials in the token field, not in the URL.' };
  }
  const base = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol === 'http:' && !loopback) {
    return { ok: true, url: base, warning: 'This URL is not https: your token is sent in cleartext.' };
  }
  return { ok: true, url: base };
}

export type IceCheck = { ok: true; servers: IceServerConfig[] } | { ok: false; message: string };

/** Parse the optional ICE-server override. Empty = use the server's configuration (host candidates by default). */
export function parseIceOverride(text: string): IceCheck {
  if (text.trim() === '') return { ok: true, servers: [] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: 'ICE servers must be valid JSON.' };
  }
  const parsed = z.array(iceServerSchema).max(8).safeParse(json);
  if (!parsed.success) {
    return { ok: false, message: 'ICE servers must be an array like [{"urls":"stun:stun.example.org:3478"}].' };
  }
  for (const server of parsed.data) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      if (!/^(stun|stuns|turn|turns):\S+$/i.test(url)) {
        return { ok: false, message: `"${url}" must start with stun:, stuns:, turn: or turns:.` };
      }
    }
  }
  return { ok: true, servers: parsed.data };
}
