import fs from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import { ControlPlaneResult, fail, ok } from './errors.js';
import { DEFAULT_AUDIENCE, DEFAULT_ISSUER } from './identity.js';
import { JwtKeyRing } from './jwt.js';
import type { ServerLimits } from './http/server.js';

/**
 * Configuration comes from the ENVIRONMENT (and files the environment points
 * at) only — there are no defaults for secrets and nothing is hardcoded. A
 * misconfiguration is reported as a CONFIG_ERROR envelope; the process never
 * starts in a half-configured state.
 *
 *   CONTROL_PLANE_HOST                  bind address            (default 127.0.0.1)
 *   CONTROL_PLANE_PORT                  listen port             (default 8787)
 *   CONTROL_PLANE_DB                    SQLite file             (default ./control-plane.db)
 *   CONTROL_PLANE_JWT_KEYS              JSON {"activeKid"?, "keys": {kid: base64 secret}}
 *   CONTROL_PLANE_JWT_KEYS_FILE         path to that same JSON (e.g. a mounted secret)
 *   CONTROL_PLANE_JWT_ACTIVE_KID        overrides activeKid
 *   CONTROL_PLANE_JWT_ISSUER/_AUDIENCE  token iss/aud           (defaults: re-shell-control-plane)
 *   CONTROL_PLANE_PLATFORM_ADMINS       comma-separated user ids allowed to create tenants
 *   CONTROL_PLANE_CORS_ORIGINS          comma-separated exact origins (never "*")
 *   CONTROL_PLANE_TRUST_PROXY           "1" when behind a reverse proxy you control
 *   CONTROL_PLANE_HSTS                  "1" when TLS terminates in front of the server
 *   CONTROL_PLANE_BODY_LIMIT_BYTES, CONTROL_PLANE_RATE_LIMIT_PER_MINUTE,
 *   CONTROL_PLANE_MAX_QUEUED_PER_TENANT, CONTROL_PLANE_LEASE_MS   tuning
 */

export type Env = Readonly<Record<string, string | undefined>>;

export interface ServeConfig {
  host: string;
  port: number;
  dbPath: string;
  keyRing: JwtKeyRing;
  issuer: string;
  audience: string;
  platformAdmins: string[];
  corsOrigins: string[];
  trustProxy: boolean;
  hsts: boolean;
  limits: Partial<ServerLimits>;
}

const keyFileSchema = z
  .object({
    activeKid: z.string().optional(),
    keys: z.record(z.string(), z.string()),
  })
  .strict();

export type KeyFile = z.infer<typeof keyFileSchema>;

function configError(message: string, details?: Record<string, unknown>): ControlPlaneResult<never> {
  return fail('CONFIG_ERROR', message, details);
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function flag(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function intVar(
  env: Env,
  name: string,
  min: number,
  max: number
): ControlPlaneResult<number | undefined> {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return ok(undefined);
  }
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) {
    return configError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return ok(Number(raw));
}

/**
 * Load the signing key ring from CONTROL_PLANE_JWT_KEYS (inline JSON) or
 * CONTROL_PLANE_JWT_KEYS_FILE. Exactly one must be set. Used by `serve` and
 * `issue-token`.
 */
export function loadKeyRing(env: Env): ControlPlaneResult<JwtKeyRing> {
  const inline = env.CONTROL_PLANE_JWT_KEYS;
  const file = env.CONTROL_PLANE_JWT_KEYS_FILE;
  if (inline && file) {
    return configError('Set only one of CONTROL_PLANE_JWT_KEYS and CONTROL_PLANE_JWT_KEYS_FILE.');
  }
  if (!inline && !file) {
    return configError(
      'No signing keys configured. Set CONTROL_PLANE_JWT_KEYS_FILE (or CONTROL_PLANE_JWT_KEYS); generate one with `re-shell-control-plane gen-key`.'
    );
  }
  let raw: string;
  if (file) {
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch (error) {
      return configError(`Cannot read CONTROL_PLANE_JWT_KEYS_FILE: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    raw = inline ?? '';
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return configError('The signing key configuration is not valid JSON.');
  }
  const parsed = keyFileSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return configError('The signing key configuration must be {"activeKid"?: string, "keys": {kid: secret}}.');
  }
  try {
    return ok(new JwtKeyRing(parsed.data.keys, env.CONTROL_PLANE_JWT_ACTIVE_KID ?? parsed.data.activeKid));
  } catch (error) {
    return configError(error instanceof Error ? error.message : String(error));
  }
}

/** Reload keys into an existing ring (SIGHUP). On failure the old keys stay active. */
export function reloadKeyRing(ring: JwtKeyRing, env: Env): ControlPlaneResult<string[]> {
  const loaded = loadKeyRing(env);
  if (!loaded.ok) {
    return loaded;
  }
  try {
    const keys: Record<string, Buffer> = {};
    for (const kid of loaded.data.kids) {
      const key = loaded.data.keyFor(kid);
      if (key) keys[kid] = key;
    }
    ring.reload(keys, loaded.data.activeKid);
    return ok(ring.kids);
  } catch (error) {
    return configError(error instanceof Error ? error.message : String(error));
  }
}

export function loadServeConfig(env: Env): ControlPlaneResult<ServeConfig> {
  const keyRing = loadKeyRing(env);
  if (!keyRing.ok) {
    return keyRing;
  }
  const port = intVar(env, 'CONTROL_PLANE_PORT', 0, 65535);
  if (!port.ok) return port;

  const corsOrigins = list(env.CONTROL_PLANE_CORS_ORIGINS);
  for (const origin of corsOrigins) {
    let valid = false;
    try {
      const url = new URL(origin);
      valid = (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === origin;
    } catch {
      valid = false;
    }
    if (!valid) {
      return configError(
        `CONTROL_PLANE_CORS_ORIGINS entry "${origin}" is not an exact origin (e.g. https://dash.example.com). Wildcards are not allowed.`
      );
    }
  }

  const limits: Partial<ServerLimits> = {};
  const body = intVar(env, 'CONTROL_PLANE_BODY_LIMIT_BYTES', 1024, 8 * 1024 * 1024);
  if (!body.ok) return body;
  if (body.data !== undefined) limits.bodyBytes = body.data;
  const rate = intVar(env, 'CONTROL_PLANE_RATE_LIMIT_PER_MINUTE', 1, 100_000);
  if (!rate.ok) return rate;
  if (rate.data !== undefined) {
    limits.userPerMinute = rate.data;
    limits.userBurst = Math.max(1, Math.ceil(rate.data / 2));
  }
  const queued = intVar(env, 'CONTROL_PLANE_MAX_QUEUED_PER_TENANT', 1, 100_000);
  if (!queued.ok) return queued;
  if (queued.data !== undefined) limits.maxQueuedPerTenant = queued.data;
  const lease = intVar(env, 'CONTROL_PLANE_LEASE_MS', 1000, 3_600_000);
  if (!lease.ok) return lease;
  if (lease.data !== undefined) limits.leaseMs = lease.data;

  return ok({
    host: env.CONTROL_PLANE_HOST || '127.0.0.1',
    port: port.data ?? 8787,
    dbPath: path.resolve(env.CONTROL_PLANE_DB || './control-plane.db'),
    keyRing: keyRing.data,
    issuer: env.CONTROL_PLANE_JWT_ISSUER || DEFAULT_ISSUER,
    audience: env.CONTROL_PLANE_JWT_AUDIENCE || DEFAULT_AUDIENCE,
    platformAdmins: list(env.CONTROL_PLANE_PLATFORM_ADMINS),
    corsOrigins,
    trustProxy: flag(env.CONTROL_PLANE_TRUST_PROXY),
    hsts: flag(env.CONTROL_PLANE_HSTS),
    limits,
  });
}

/** Read a worker token from CONTROL_PLANE_WORKER_TOKEN or the file named by `tokenFile`/env. */
export function loadWorkerToken(env: Env, tokenFile?: string): ControlPlaneResult<string> {
  const file = tokenFile ?? env.CONTROL_PLANE_WORKER_TOKEN_FILE;
  const inline = env.CONTROL_PLANE_WORKER_TOKEN;
  if (file && inline) {
    return configError('Set only one of CONTROL_PLANE_WORKER_TOKEN and a worker token file.');
  }
  if (file) {
    try {
      const token = fs.readFileSync(file, 'utf8').trim();
      return token ? ok(token) : configError('The worker token file is empty.');
    } catch (error) {
      return configError(`Cannot read the worker token file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (inline && inline.trim()) {
    return ok(inline.trim());
  }
  return configError(
    'No worker token configured. Set CONTROL_PLANE_WORKER_TOKEN or CONTROL_PLANE_WORKER_TOKEN_FILE (issue one with `re-shell-control-plane issue-token --worker`).'
  );
}
