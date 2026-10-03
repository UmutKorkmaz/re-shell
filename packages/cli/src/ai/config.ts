import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  AI_PROVIDER_NAMES,
  type AiProviderConfig,
  type AiProviderName,
  type ConfigSource,
} from './types';

/**
 * Provider configuration for `re-shell ai`.
 *
 * Precedence (highest first): explicit overrides (CLI flags) > environment >
 * the persisted `ai:` section of the global config (`~/.re-shell/config.yaml`)
 * > built-in defaults / auto-detection.
 *
 * Environment variables:
 *   RE_SHELL_AI_PROVIDER    anthropic | openai-compatible | offline | auto
 *   ANTHROPIC_API_KEY       key for the `anthropic` provider
 *   RE_SHELL_AI_API_KEY     key for `openai-compatible` (or `anthropic` as a fallback)
 *   RE_SHELL_AI_MODEL       model id
 *   RE_SHELL_AI_BASE_URL    server base URL for `openai-compatible`
 *   RE_SHELL_AI_TIMEOUT_MS  request timeout
 *
 * SECRETS: the API key is only ever held in {@link AiProviderConfig} for the
 * duration of a request. Every user-facing rendering goes through
 * {@link describeAiConfig}, which reports `set`/`unset` and the SOURCE of the
 * key, never any part of its value. A key from `ANTHROPIC_API_KEY` is never
 * sent to a non-Anthropic server.
 */

/** Default model for the Anthropic provider. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

/** Default request timeouts. Local models may need to load, so they get longer. */
export const DEFAULT_TIMEOUT_MS: Readonly<Record<AiProviderName, number>> = {
  anthropic: 30_000,
  'openai-compatible': 60_000,
  offline: 1_000,
};

const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 600_000;

/** The user-settable keys of the persisted `ai:` config section. */
export const AI_CONFIG_KEYS = [
  'provider',
  'model',
  'baseUrl',
  'apiKey',
  'timeoutMs',
  'cache',
  'cacheTtlSeconds',
] as const;
export type AiConfigKey = (typeof AI_CONFIG_KEYS)[number];

/** Keys whose values are secrets and must never be printed. */
export const SECRET_KEYS: ReadonlySet<AiConfigKey> = new Set(['apiKey']);

/** What is stored under `ai:` in the global config. */
export interface PersistedAiConfig {
  provider?: AiProviderName | 'auto';
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  cache?: boolean;
  cacheTtlSeconds?: number;
}

/** Overrides coming from CLI flags. */
export interface AiConfigOverrides {
  provider?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  cache?: boolean;
}

/** A resolved configuration plus where each value came from. */
export interface ResolvedAiConfig extends AiProviderConfig {
  cache: boolean;
  cacheTtlSeconds: number;
  /** Where each value came from. Never contains values. */
  sources: {
    provider: ConfigSource;
    model: ConfigSource;
    baseUrl: ConfigSource;
    apiKey: ConfigSource | 'unset';
    timeoutMs: ConfigSource;
  };
}

/** Default semantic-cache TTL: one week. */
export const DEFAULT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Validation of user-supplied values
// ---------------------------------------------------------------------------

/** Result of validating one `ai config set` value. */
export type ParsedConfigValue =
  | { ok: true; value: string | number | boolean }
  | { ok: false; message: string };

/**
 * Validate and coerce a raw string for a config key.
 *
 * @param key - The config key.
 * @param raw - The raw string the user supplied.
 * @returns The coerced value, or a human-readable reason it was rejected.
 */
export function parseConfigValue(key: AiConfigKey, raw: string): ParsedConfigValue {
  const value = raw.trim();
  switch (key) {
    case 'provider': {
      const v = value.toLowerCase();
      if (v === 'auto' || (AI_PROVIDER_NAMES as readonly string[]).includes(v)) {
        return { ok: true, value: v };
      }
      return {
        ok: false,
        message: `provider must be one of: auto, ${AI_PROVIDER_NAMES.join(', ')}`,
      };
    }
    case 'model':
      return /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/.test(value)
        ? { ok: true, value }
        : { ok: false, message: 'model must be a model id such as claude-opus-5-5 or llama3.1:8b' };
    case 'baseUrl': {
      try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { ok: false, message: 'baseUrl must be an http(s) URL' };
        }
        return { ok: true, value: value.replace(/\/+$/, '') };
      } catch {
        return { ok: false, message: 'baseUrl must be a valid URL, e.g. http://localhost:11434/v1' };
      }
    }
    case 'apiKey':
      return value.length >= 8 && !/\s/.test(value)
        ? { ok: true, value }
        : { ok: false, message: 'apiKey must be at least 8 characters with no whitespace' };
    case 'timeoutMs': {
      const n = Number(value);
      return Number.isInteger(n) && n >= MIN_TIMEOUT_MS && n <= MAX_TIMEOUT_MS
        ? { ok: true, value: n }
        : { ok: false, message: `timeoutMs must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}` };
    }
    case 'cache': {
      const v = value.toLowerCase();
      if (['true', 'on', 'yes', '1'].includes(v)) return { ok: true, value: true };
      if (['false', 'off', 'no', '0'].includes(v)) return { ok: true, value: false };
      return { ok: false, message: 'cache must be true or false' };
    }
    case 'cacheTtlSeconds': {
      const n = Number(value);
      return Number.isInteger(n) && n >= 1 && n <= 365 * 24 * 3600
        ? { ok: true, value: n }
        : { ok: false, message: 'cacheTtlSeconds must be a positive integer (at most one year)' };
    }
  }
}

/** Type guard for config keys. */
export function isAiConfigKey(key: string): key is AiConfigKey {
  return (AI_CONFIG_KEYS as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// Persistence (the `ai:` section of ~/.re-shell/config.yaml)
// ---------------------------------------------------------------------------

/** Default location of the global config. Resolved lazily so HOME overrides apply. */
export function defaultGlobalConfigPath(): string {
  return path.join(os.homedir(), '.re-shell', 'config.yaml');
}

function readYamlFile(file: string): Record<string, unknown> | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
  const doc = yaml.parse(text) as unknown;
  return doc && typeof doc === 'object' ? (doc as Record<string, unknown>) : undefined;
}

/**
 * Read the persisted `ai:` section. Missing file/section yields `{}`.
 * Unknown keys and wrongly-typed values are dropped, never trusted.
 *
 * @param file - Global config path (defaults to `~/.re-shell/config.yaml`).
 * @returns The sanitised persisted config.
 */
export function readPersistedAiConfig(file: string = defaultGlobalConfigPath()): PersistedAiConfig {
  let doc: Record<string, unknown> | undefined;
  try {
    doc = readYamlFile(file);
  } catch {
    return {}; // an unparseable config reads as "nothing persisted"; writes refuse (see below)
  }
  const raw = doc?.ai;
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: PersistedAiConfig = {};
  if (typeof r.provider === 'string') {
    const v = r.provider.toLowerCase();
    if (v === 'auto' || (AI_PROVIDER_NAMES as readonly string[]).includes(v)) {
      out.provider = v as PersistedAiConfig['provider'];
    }
  }
  if (typeof r.model === 'string') out.model = r.model;
  if (typeof r.baseUrl === 'string') out.baseUrl = r.baseUrl;
  if (typeof r.apiKey === 'string') out.apiKey = r.apiKey;
  if (typeof r.timeoutMs === 'number') out.timeoutMs = r.timeoutMs;
  if (typeof r.cache === 'boolean') out.cache = r.cache;
  if (typeof r.cacheTtlSeconds === 'number') out.cacheTtlSeconds = r.cacheTtlSeconds;
  return out;
}

/**
 * Apply updates to the `ai:` section of the global config (read-modify-write,
 * preserving every other key). A `null` value removes the key. When the file
 * does not exist it is seeded from `seed` so other commands that validate the
 * global config keep working. A file holding an API key is chmod 0600.
 *
 * @param updates - Keys to set (value) or remove (`null`).
 * @param file - Global config path.
 * @param seed - Document used when the file does not exist yet.
 * @returns The new persisted `ai:` section.
 */
export function writePersistedAiConfig(
  updates: Partial<Record<AiConfigKey, string | number | boolean | null>>,
  file: string = defaultGlobalConfigPath(),
  seed?: Record<string, unknown>
): PersistedAiConfig {
  let existing: Record<string, unknown> | undefined;
  try {
    existing = readYamlFile(file);
  } catch (error) {
    // Never overwrite a config we cannot parse: that would destroy the user's values.
    const reason = error instanceof Error ? error.message.split('\n')[0] : 'parse error';
    throw new Error(`the global config at ${file} is not valid YAML (${reason}); fix or remove it first`);
  }
  const doc: Record<string, unknown> = existing ?? { ...(seed ?? {}) };
  const section: Record<string, unknown> =
    doc.ai && typeof doc.ai === 'object' ? { ...(doc.ai as Record<string, unknown>) } : {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) delete section[key];
    else section[key] = value;
  }
  if (Object.keys(section).length === 0) delete doc.ai;
  else doc.ai = section;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  let mode = 0o644;
  try {
    mode = fs.statSync(file).mode & 0o777;
  } catch {
    /* new file */
  }
  // A file holding an API key is owner-only.
  if (typeof section.apiKey === 'string') mode = 0o600;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, yaml.stringify(doc), { encoding: 'utf8', mode });
  fs.renameSync(tmp, file);
  try {
    fs.chmodSync(file, mode);
  } catch {
    /* best effort (e.g. Windows) */
  }
  return readPersistedAiConfig(file);
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

type Env = Readonly<Record<string, string | undefined>>;

function nonEmpty(v: string | undefined): string | undefined {
  return v !== undefined && v.trim() !== '' ? v.trim() : undefined;
}

/**
 * Resolve the effective provider configuration.
 *
 * Provider selection when none is explicit (`auto`):
 *   1. `RE_SHELL_AI_BASE_URL` set (env or persisted)  -> `openai-compatible`
 *   2. an Anthropic key available                     -> `anthropic`
 *   3. otherwise                                      -> `offline`
 * An explicit provider is always honoured, even if it then fails for lack of a
 * key — that failure surfaces as a warning plus an offline fallback.
 *
 * @param env - Process environment (injectable for tests).
 * @param persisted - The persisted `ai:` section.
 * @param overrides - CLI-flag overrides.
 * @returns The resolved config and the source of each value.
 */
export function resolveAiConfig(
  env: Env = process.env,
  persisted: PersistedAiConfig = {},
  overrides: AiConfigOverrides = {}
): ResolvedAiConfig {
  const pick = <T>(
    override: T | undefined,
    fromEnv: T | undefined,
    fromConfig: T | undefined
  ): { value?: T; source: ConfigSource } => {
    if (override !== undefined) return { value: override, source: 'override' };
    if (fromEnv !== undefined) return { value: fromEnv, source: 'env' };
    if (fromConfig !== undefined) return { value: fromConfig, source: 'config' };
    return { source: 'default' };
  };

  const envProvider = nonEmpty(env.RE_SHELL_AI_PROVIDER)?.toLowerCase();
  const baseUrlPick = pick(
    nonEmpty(overrides.baseUrl),
    nonEmpty(env.RE_SHELL_AI_BASE_URL),
    persisted.baseUrl
  );
  const reShellKey = nonEmpty(env.RE_SHELL_AI_API_KEY);
  const anthropicKey = nonEmpty(env.ANTHROPIC_API_KEY);

  // --- provider ---
  const requested = pick<string>(
    nonEmpty(overrides.provider)?.toLowerCase(),
    envProvider,
    persisted.provider
  );
  let provider: AiProviderName;
  let providerSource: ConfigSource = requested.source;
  if (
    requested.value &&
    (AI_PROVIDER_NAMES as readonly string[]).includes(requested.value)
  ) {
    provider = requested.value as AiProviderName;
  } else {
    // `auto`, unset, or an unrecognised value all auto-detect.
    providerSource = 'auto';
    if (baseUrlPick.value) provider = 'openai-compatible';
    else if (anthropicKey) provider = 'anthropic';
    else provider = 'offline';
  }

  // --- model ---
  const modelPick = pick(
    nonEmpty(overrides.model),
    nonEmpty(env.RE_SHELL_AI_MODEL),
    persisted.model
  );
  const model =
    modelPick.value ?? (provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : undefined);

  // --- api key: provider-scoped so a key is never sent to the wrong server ---
  let apiKey: string | undefined;
  let apiKeySource: ResolvedAiConfig['sources']['apiKey'] = 'unset';
  if (provider === 'anthropic') {
    if (anthropicKey) [apiKey, apiKeySource] = [anthropicKey, 'env'];
    else if (reShellKey) [apiKey, apiKeySource] = [reShellKey, 'env'];
    else if (persisted.apiKey) [apiKey, apiKeySource] = [persisted.apiKey, 'config'];
  } else if (provider === 'openai-compatible') {
    // NEVER fall back to ANTHROPIC_API_KEY here.
    if (reShellKey) [apiKey, apiKeySource] = [reShellKey, 'env'];
    else if (persisted.apiKey) [apiKey, apiKeySource] = [persisted.apiKey, 'config'];
  }

  // --- base url: only meaningful for openai-compatible, or an explicit Anthropic gateway ---
  const baseUrl =
    provider === 'openai-compatible' ||
    (provider === 'anthropic' && providerSource !== 'auto' && baseUrlPick.source !== 'default')
      ? baseUrlPick.value
      : undefined;

  // --- timeout ---
  const envTimeout = nonEmpty(env.RE_SHELL_AI_TIMEOUT_MS);
  const parsedEnvTimeout = envTimeout !== undefined ? Number(envTimeout) : undefined;
  const timeoutPick = pick(
    overrides.timeoutMs,
    parsedEnvTimeout !== undefined && Number.isFinite(parsedEnvTimeout) ? parsedEnvTimeout : undefined,
    persisted.timeoutMs
  );
  const timeoutMs = clampTimeout(timeoutPick.value ?? DEFAULT_TIMEOUT_MS[provider]);

  return {
    provider,
    model,
    baseUrl,
    apiKey,
    timeoutMs,
    cache: overrides.cache ?? persisted.cache ?? true,
    cacheTtlSeconds: persisted.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS,
    sources: {
      provider: providerSource,
      model: modelPick.value !== undefined ? modelPick.source : 'default',
      baseUrl: baseUrl !== undefined ? baseUrlPick.source : 'default',
      apiKey: apiKeySource,
      timeoutMs: timeoutPick.value !== undefined ? timeoutPick.source : 'default',
    },
  };
}

function clampTimeout(ms: number): number {
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.round(ms)));
}

// ---------------------------------------------------------------------------
// Redacted rendering
// ---------------------------------------------------------------------------

/** Strip credentials from a URL so it is safe to print. */
export function redactUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '<invalid-url>';
  }
}

/** The printable view of a configuration. Contains NO secret material. */
export interface RedactedAiConfig {
  provider: AiProviderName;
  model?: string;
  baseUrl?: string;
  apiKey: { set: boolean; source: ConfigSource | 'unset' };
  timeoutMs: number;
  cache: boolean;
  cacheTtlSeconds: number;
  sources: ResolvedAiConfig['sources'];
}

/**
 * Render a configuration for display, with the API key reduced to
 * `{ set, source }`.
 *
 * @param config - The resolved configuration.
 * @returns A view that is safe to print or emit as JSON.
 */
export function describeAiConfig(config: ResolvedAiConfig): RedactedAiConfig {
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: redactUrl(config.baseUrl),
    apiKey: { set: config.apiKey !== undefined, source: config.sources.apiKey },
    timeoutMs: config.timeoutMs,
    cache: config.cache,
    cacheTtlSeconds: config.cacheTtlSeconds,
    sources: config.sources,
  };
}

/**
 * Redact any occurrence of known secrets from a message before it is shown.
 *
 * @param message - Arbitrary text (e.g. an upstream error body).
 * @param secrets - Secret strings to scrub.
 * @returns The message with every secret replaced by `[redacted]`.
 */
export function scrubSecrets(message: string, secrets: ReadonlyArray<string | undefined>): string {
  let out = message;
  for (const s of secrets) {
    if (s && s.length >= 6) out = out.split(s).join('[redacted]');
  }
  // Also catch common key shapes in case a different key leaked into a message.
  return out.replace(/\b(sk-[A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{8,})\b/g, '[redacted]');
}
