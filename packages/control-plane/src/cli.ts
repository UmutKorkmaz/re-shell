import fs from 'node:fs';
import path from 'node:path';

import { ControlPlaneResult, fail, ok } from './errors.js';
import {
  Env,
  loadKeyRing,
  loadServeConfig,
  loadWorkerToken,
  reloadKeyRing,
} from './config.js';
import { migrate } from './db/migrations.js';
import { SqliteTenantStore } from './db/sqlite-store.js';
import { openDatabase } from './db/sqlite.js';
import {
  USER_TOKEN_DEFAULT_TTL,
  WORKER_TOKEN_DEFAULT_TTL,
  issueUserToken,
  issueWorkerToken,
} from './identity.js';
import { generateSecret } from './jwt.js';
import { startRuntime } from './runtime.js';
import { roleSchema } from './auth.js';
import { idSchema } from './tenant.js';
import { Worker } from './worker/worker.js';

/**
 * `re-shell-control-plane` command line.
 *
 *   serve        run the control plane (HTTP/SSE API + SQLite)
 *   worker       run an execution worker for one tenant
 *   issue-token  mint a user token (also the bootstrap path for the first
 *                tenant admin) or a worker token
 *   gen-key      generate a signing key file
 *   migrate      apply database migrations and exit
 *
 * Structured commands print the standard `{ ok, data|error, warnings }` JSON
 * envelope on stdout and exit non-zero with `ok:false` on failure. Long-running
 * commands log JSON lines to stderr. Secrets are only ever read from the
 * environment or files — never from flags (they would leak into `ps`).
 */

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: Env;
  /** Resolves when the process should shut down (a signal). Injected for tests. */
  shutdownSignal?: AbortSignal;
}

interface Parsed {
  command: string | undefined;
  flags: Map<string, string | true>;
  positional: string[];
}

const BOOLEAN_FLAGS = new Set(['raw', 'worker', 'help']);

export function parseArgs(argv: readonly string[]): Parsed {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  let command: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      if (eq !== -1) {
        flags.set(name, arg.slice(eq + 1));
      } else if (BOOLEAN_FLAGS.has(name)) {
        flags.set(name, true);
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) {
          flags.set(name, '');
        } else {
          flags.set(name, next);
          i += 1;
        }
      }
    } else if (command === undefined) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }
  return { command, flags, positional };
}

function str(parsed: Parsed, name: string): string | undefined {
  const v = parsed.flags.get(name);
  return typeof v === 'string' && v !== '' ? v : undefined;
}

const USAGE = `Usage: re-shell-control-plane <command> [options]

Commands:
  serve                       Run the control plane (configure via CONTROL_PLANE_* env)
  worker                      Run an execution worker
      --tenant <id>           Tenant to serve (must match the worker token)
      --workspace-root <dir>  Directory containing one subdirectory per workspace
      --url <url>             Control plane URL (or CONTROL_PLANE_URL)
      --token-file <file>     Worker token file (or CONTROL_PLANE_WORKER_TOKEN[_FILE])
      --cli-bin <path>        re-shell CLI entry (or RE_SHELL_CLI_BIN; default "re-shell")
      --concurrency <n>       Parallel jobs (default 1)
  issue-token                 Mint a token (keys from CONTROL_PLANE_JWT_KEYS[_FILE])
      --user <id>             User token for this user id
      --tenant <id> --role <viewer|operator|admin>
                              BOOTSTRAP: create the tenant if absent and (re)grant the
                              user this role in it (needs CONTROL_PLANE_DB)
      --worker --worker-id <id> --tenant <id>
                              Worker token bound to one tenant
      --ttl <seconds>         Token lifetime
      --raw                   Print only the token
  gen-key                     Generate a signing key file (JSON)
      --kid <id>              Key id (default: key-<date>)
      --raw                   Print only the key file JSON
  migrate                     Apply database migrations (CONTROL_PLANE_DB)
`;

function print(io: CliIo, result: ControlPlaneResult<unknown>): number {
  io.stdout(`${JSON.stringify(result)}\n`);
  return result.ok ? 0 : 1;
}

function configFail(io: CliIo, message: string, details?: Record<string, unknown>): number {
  io.stderr(`${message}\n`);
  return print(io, fail('CONFIG_ERROR', message, details));
}

function logLine(io: CliIo): (entry: Record<string, unknown>) => void {
  return (entry) => io.stderr(`${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);
}

function parseTtl(parsed: Parsed, fallback: number): number | undefined {
  const raw = str(parsed, 'ttl');
  if (raw === undefined) {
    return fallback;
  }
  return /^\d{1,9}$/.test(raw) ? Number(raw) : undefined;
}

// ---------------------------------------------------------------------------

function cmdGenKey(parsed: Parsed, io: CliIo): number {
  const kid = str(parsed, 'kid') ?? `key-${new Date().toISOString().slice(0, 10)}`;
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(kid)) {
    return configFail(io, 'Invalid --kid: use 1-64 characters of A-Z a-z 0-9 . _ -');
  }
  const keyFile = { activeKid: kid, keys: { [kid]: generateSecret() } };
  if (parsed.flags.get('raw') === true) {
    io.stdout(`${JSON.stringify(keyFile, null, 2)}\n`);
    return 0;
  }
  return print(io, ok({ keyFile }, ['Store this file as a secret (mode 0600) and point CONTROL_PLANE_JWT_KEYS_FILE at it.']));
}

function cmdMigrate(io: CliIo): number {
  const dbPath = path.resolve(io.env.CONTROL_PLANE_DB || './control-plane.db');
  try {
    const db = openDatabase(dbPath);
    const report = migrate(db);
    db.close();
    return print(io, ok({ dbPath, ...report }));
  } catch (error) {
    return configFail(io, `Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function cmdIssueToken(parsed: Parsed, io: CliIo): number {
  if (str(parsed, 'token') !== undefined || str(parsed, 'secret') !== undefined) {
    return configFail(io, 'Secrets are never accepted as flags; use the environment or files.');
  }
  const keyRing = loadKeyRing(io.env);
  if (!keyRing.ok) {
    io.stderr(`${keyRing.error.message}\n`);
    return print(io, keyRing);
  }
  const identity = { keyRing: keyRing.data };
  const raw = parsed.flags.get('raw') === true;
  const emit = (data: Record<string, unknown>, token: string, warnings: string[] = []): number => {
    if (raw) {
      io.stdout(`${token}\n`);
      return 0;
    }
    return print(io, ok(data, warnings));
  };

  try {
    if (parsed.flags.get('worker') === true) {
      const tenant = idSchema.safeParse(str(parsed, 'tenant'));
      const workerId = idSchema.safeParse(str(parsed, 'worker-id'));
      const ttl = parseTtl(parsed, WORKER_TOKEN_DEFAULT_TTL);
      if (!tenant.success || !workerId.success || ttl === undefined) {
        return configFail(io, 'A worker token needs --tenant <id> --worker-id <id> and an integer --ttl (seconds).');
      }
      const issued = issueWorkerToken(identity, { workerId: workerId.data, tenantId: tenant.data, ttlSeconds: ttl });
      return emit(
        { kind: 'worker', tenantId: tenant.data, workerId: workerId.data, token: issued.token, expiresAt: issued.expiresAt, kid: issued.kid },
        issued.token
      );
    }

    const user = str(parsed, 'user');
    const ttl = parseTtl(parsed, USER_TOKEN_DEFAULT_TTL);
    if (!user || ttl === undefined) {
      return configFail(io, 'A user token needs --user <id> and (optionally) an integer --ttl (seconds).');
    }

    const tenantArg = str(parsed, 'tenant');
    const roleArg = str(parsed, 'role');
    let bootstrap: Record<string, unknown> | undefined;
    if (tenantArg !== undefined || roleArg !== undefined) {
      const tenant = idSchema.safeParse(tenantArg);
      const role = roleSchema.safeParse(roleArg);
      if (!tenant.success || !role.success) {
        return configFail(io, 'Bootstrap needs both --tenant <id> and --role <viewer|operator|admin>.');
      }
      const dbPath = path.resolve(io.env.CONTROL_PLANE_DB || './control-plane.db');
      const db = openDatabase(dbPath);
      try {
        migrate(db);
        const store = new SqliteTenantStore(db);
        const created = store.createTenant({ id: tenant.data, name: str(parsed, 'tenant-name') ?? tenant.data });
        const member = store.setMember(tenant.data, user, role.data);
        if (!member.ok) {
          return configFail(io, `Could not set the role: ${member.reason}.`);
        }
        bootstrap = { tenantId: tenant.data, tenantCreated: created.ok, role: role.data };
      } finally {
        db.close();
      }
    }

    const issued = issueUserToken(identity, { userId: user, ttlSeconds: ttl });
    return emit(
      { kind: 'user', userId: user, token: issued.token, expiresAt: issued.expiresAt, kid: issued.kid, ...(bootstrap ? { bootstrap } : {}) },
      issued.token,
      bootstrap ? [] : ['A token proves identity only. Tenant access comes from memberships (use --tenant/--role to bootstrap one).']
    );
  } catch (error) {
    return configFail(io, error instanceof Error ? error.message : String(error));
  }
}

async function cmdServe(io: CliIo): Promise<number> {
  const config = loadServeConfig(io.env);
  if (!config.ok) {
    io.stderr(`${config.error.message}\n`);
    return print(io, config);
  }
  const log = logLine(io);
  let runtime;
  try {
    runtime = await startRuntime(config.data, log);
  } catch (error) {
    return configFail(io, `Failed to start: ${error instanceof Error ? error.message : String(error)}`);
  }
  log({ level: 'info', message: 'listening', url: runtime.listening.url, db: config.data.dbPath });

  const onHup = (): void => {
    const reloaded = reloadKeyRing(config.data.keyRing, io.env);
    log(reloaded.ok ? { level: 'info', message: 'reloaded signing keys', kids: reloaded.data } : { level: 'error', message: 'key reload failed; keeping current keys', error: reloaded.error.message });
  };
  process.on('SIGHUP', onHup);

  await waitForShutdown(io);
  process.off('SIGHUP', onHup);
  log({ level: 'info', message: 'shutting down' });
  await runtime.close();
  return 0;
}

async function cmdWorker(parsed: Parsed, io: CliIo): Promise<number> {
  if (str(parsed, 'token') !== undefined) {
    return configFail(io, 'Secrets are never accepted as flags; use CONTROL_PLANE_WORKER_TOKEN or --token-file.');
  }
  const tenant = idSchema.safeParse(str(parsed, 'tenant') ?? io.env.CONTROL_PLANE_TENANT);
  const root = str(parsed, 'workspace-root') ?? io.env.CONTROL_PLANE_WORKSPACE_ROOT;
  const url = str(parsed, 'url') ?? io.env.CONTROL_PLANE_URL;
  if (!tenant.success) {
    return configFail(io, 'The worker needs --tenant <id> (or CONTROL_PLANE_TENANT).');
  }
  if (!root || !fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    return configFail(io, 'The worker needs --workspace-root <dir> (or CONTROL_PLANE_WORKSPACE_ROOT) pointing at an existing directory.');
  }
  if (!url || !/^https?:\/\//.test(url)) {
    return configFail(io, 'The worker needs --url <http(s) url> (or CONTROL_PLANE_URL).');
  }
  const token = loadWorkerToken(io.env, str(parsed, 'token-file'));
  if (!token.ok) {
    io.stderr(`${token.error.message}\n`);
    return print(io, token);
  }
  const concurrencyRaw = str(parsed, 'concurrency') ?? io.env.CONTROL_PLANE_WORKER_CONCURRENCY;
  const concurrency = concurrencyRaw === undefined ? 1 : /^\d{1,2}$/.test(concurrencyRaw) ? Number(concurrencyRaw) : 0;
  if (concurrency < 1) {
    return configFail(io, '--concurrency must be an integer between 1 and 99.');
  }

  const log = logLine(io);
  const worker = new Worker({
    controlPlaneUrl: url,
    token: token.data,
    tenantId: tenant.data,
    workspaceRoot: root,
    cliBin: str(parsed, 'cli-bin') ?? io.env.RE_SHELL_CLI_BIN ?? 're-shell',
    concurrency,
    logger: log,
  });
  worker.start();
  log({ level: 'info', message: 'worker started', tenantId: tenant.data, workspaceRoot: path.resolve(root), concurrency });

  const stopped = worker.done().then(() => 'stopped' as const);
  const signalled = waitForShutdown(io).then(() => 'signal' as const);
  const first = await Promise.race([stopped, signalled]);
  if (first === 'signal') {
    log({ level: 'info', message: 'shutting down' });
    await worker.stop();
  }
  if (worker.fatal) {
    return print(io, fail('UNAUTHENTICATED', worker.fatal));
  }
  return 0;
}

function waitForShutdown(io: CliIo): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      process.off('SIGINT', done);
      process.off('SIGTERM', done);
      resolve();
    };
    if (io.shutdownSignal) {
      if (io.shutdownSignal.aborted) {
        resolve();
        return;
      }
      io.shutdownSignal.addEventListener('abort', done, { once: true });
      return;
    }
    process.on('SIGINT', done);
    process.on('SIGTERM', done);
  });
}

/** Run the CLI. Returns the process exit code. */
export async function main(argv: readonly string[], io: CliIo): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed.command === undefined || parsed.command === 'help' || parsed.flags.get('help') === true) {
    io.stdout(USAGE);
    return parsed.command === undefined ? 2 : 0;
  }
  switch (parsed.command) {
    case 'serve':
      return cmdServe(io);
    case 'worker':
      return cmdWorker(parsed, io);
    case 'issue-token':
      return cmdIssueToken(parsed, io);
    case 'gen-key':
      return cmdGenKey(parsed, io);
    case 'migrate':
      return cmdMigrate(io);
    default:
      io.stderr(`Unknown command "${parsed.command}".\n${USAGE}`);
      print(io, fail('INVALID_REQUEST', `Unknown command "${parsed.command}".`));
      return 2;
  }
}
