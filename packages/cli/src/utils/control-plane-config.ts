import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Where `re-shell collab session ...` finds the hosted control plane.
 *
 * Each setting resolves, in order, from:
 *   1. a command-line flag        (--url, --token, --token-file, --tenant)
 *   2. the environment            (RE_SHELL_CONTROL_PLANE_URL / _TOKEN / _TOKEN_FILE / _TENANT;
 *                                  CONTROL_PLANE_URL and CONTROL_PLANE_TENANT are also honoured,
 *                                  the names the control-plane worker already uses)
 *   3. the config file            (`$RE_SHELL_CONFIG_DIR/control-plane.json`, else
 *                                  `~/.re-shell/control-plane.json`, or RE_SHELL_CONTROL_PLANE_CONFIG)
 *                                  { "url": "...", "tenant": "...", "token"?: "...", "tokenFile"?: "..." }
 *
 * A token on the command line is visible to other local users in the process
 * list; prefer the environment, a token file, or a 0600 config file. A config
 * file that holds a token and is readable by group/other produces a warning.
 */

export interface ControlPlaneFlags {
  url?: string;
  token?: string;
  tokenFile?: string;
  tenant?: string;
}

export interface ControlPlaneTarget {
  url: string;
  token: string;
  /** May be undefined: the command layer can discover it from the token (one membership). */
  tenant: string | undefined;
}

export type ResolveResult =
  | { ok: true; target: ControlPlaneTarget; warnings: string[] }
  | { ok: false; message: string; missing: string[] };

interface ConfigFile {
  url?: string;
  tenant?: string;
  token?: string;
  tokenFile?: string;
}

export interface ResolveOptions {
  flags: ControlPlaneFlags;
  env: NodeJS.ProcessEnv;
  homedir?: string;
}

export function configFilePath(env: NodeJS.ProcessEnv, homedir: string = os.homedir()): string {
  if (env.RE_SHELL_CONTROL_PLANE_CONFIG) {
    return env.RE_SHELL_CONTROL_PLANE_CONFIG;
  }
  const dir = env.RE_SHELL_CONFIG_DIR || path.join(homedir, '.re-shell');
  return path.join(dir, 'control-plane.json');
}

function readConfigFile(file: string, warnings: string[]): ConfigFile | { error: string } {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    return { error: `Cannot read ${file}: ${(error as Error).message}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: `${file} is not valid JSON.` };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { error: `${file} must contain a JSON object.` };
  }
  const obj = parsed as Record<string, unknown>;
  const out: ConfigFile = {};
  for (const key of ['url', 'tenant', 'token', 'tokenFile'] as const) {
    const value = obj[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim() === '') {
      return { error: `${file}: "${key}" must be a non-empty string.` };
    }
    out[key] = value.trim();
  }
  if (out.token && process.platform !== 'win32') {
    try {
      const mode = fs.statSync(file).mode;
      if ((mode & 0o077) !== 0) {
        warnings.push(`${file} contains a token but is readable by other users; run: chmod 600 ${file}`);
      }
    } catch {
      // The file was just read; a stat failure is not worth failing over.
    }
  }
  return out;
}

function readTokenFile(file: string): { token: string } | { error: string } {
  try {
    const token = fs.readFileSync(file, 'utf8').trim();
    if (token === '') {
      return { error: `The token file ${file} is empty.` };
    }
    return { token };
  } catch (error) {
    return { error: `Cannot read the token file ${file}: ${(error as Error).message}` };
  }
}

/** Validate and normalize a control-plane base URL. */
export function normalizeUrl(raw: string): { url: string; warning?: string } | { error: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: `"${raw}" is not a valid URL (expected e.g. https://control-plane.example.com).` };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: `The control plane URL must be http(s), got "${parsed.protocol}".` };
  }
  if (parsed.username || parsed.password) {
    return { error: 'Put credentials in the token, not in the URL.' };
  }
  const base = `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
  return parsed.protocol === 'http:' && !loopback
    ? { url: base, warning: `${parsed.origin} is not https: your token travels in cleartext.` }
    : { url: base };
}

export function resolveTarget(options: ResolveOptions): ResolveResult {
  const { flags, env } = options;
  const warnings: string[] = [];
  const configPath = configFilePath(env, options.homedir);
  const config = readConfigFile(configPath, warnings);
  if ('error' in config) {
    return { ok: false, message: config.error, missing: [] };
  }

  const rawUrl = flags.url ?? env.RE_SHELL_CONTROL_PLANE_URL ?? env.CONTROL_PLANE_URL ?? config.url;
  const tenant = flags.tenant ?? env.RE_SHELL_CONTROL_PLANE_TENANT ?? env.CONTROL_PLANE_TENANT ?? config.tenant;

  let token = flags.token ?? env.RE_SHELL_CONTROL_PLANE_TOKEN;
  if (!token) {
    const tokenFile = flags.tokenFile ?? env.RE_SHELL_CONTROL_PLANE_TOKEN_FILE ?? config.tokenFile;
    if (tokenFile) {
      const read = readTokenFile(tokenFile);
      if ('error' in read) {
        return { ok: false, message: read.error, missing: [] };
      }
      token = read.token;
    } else {
      token = config.token;
    }
  }
  if (flags.token) {
    warnings.push('--token is visible in the process list; prefer RE_SHELL_CONTROL_PLANE_TOKEN or --token-file.');
  }

  const missing: string[] = [];
  if (!rawUrl) missing.push('url');
  if (!token) missing.push('token');
  if (missing.length > 0) {
    const hints: Record<string, string> = {
      url: '--url or RE_SHELL_CONTROL_PLANE_URL',
      token: 'RE_SHELL_CONTROL_PLANE_TOKEN, --token-file or --token',
    };
    return {
      ok: false,
      message: `No control plane ${missing.join(' / ')} configured. Set ${missing
        .map((m) => hints[m])
        .join('; ')} (or ${configPath}).`,
      missing,
    };
  }
  const normalized = normalizeUrl(rawUrl as string);
  if ('error' in normalized) {
    return { ok: false, message: normalized.error, missing: [] };
  }
  if (normalized.warning) warnings.push(normalized.warning);
  return { ok: true, target: { url: normalized.url, token: token as string, tenant }, warnings };
}
