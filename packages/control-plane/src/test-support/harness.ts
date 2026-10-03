import { migrate } from '../db/migrations.js';
import { SqliteAuditLog } from '../db/sqlite-audit.js';
import { SqliteCollabStore } from '../db/sqlite-collab.js';
import { SqliteJobStore } from '../db/sqlite-jobs.js';
import { SqliteTenantStore } from '../db/sqlite-store.js';
import { DatabaseSync, openDatabase } from '../db/sqlite.js';
import { EventBus } from '../events.js';
import { issueUserToken, issueWorkerToken } from '../identity.js';
import { JwtKeyRing, generateSecret } from '../jwt.js';
import {
  ControlPlaneServer,
  ControlPlaneServerOptions,
  ServerLimits,
  createControlPlaneServer,
} from '../http/server.js';

/**
 * A real control-plane server on an ephemeral port, backed by an in-memory
 * SQLite database, for HTTP-level tests. Nothing here is mocked: requests go
 * through `node:http`, the real router, the real JWT verifier and the real
 * SQLite store.
 */

export interface HarnessOptions {
  limits?: Partial<ServerLimits>;
  platformAdmins?: string[];
  corsOrigins?: string[];
  trustProxy?: boolean;
  now?: () => number;
  seed?: {
    tenants?: unknown[];
    workspaces?: unknown[];
    members?: unknown[];
  };
  /** Pre-built key ring (to share keys with a second component). */
  keyRing?: JwtKeyRing;
  /** Database path; defaults to an in-memory database. */
  dbFile?: string;
  serverOptions?: Partial<ControlPlaneServerOptions>;
}

export interface ApiResponse {
  status: number;
  headers: Headers;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface Harness {
  db: DatabaseSync;
  store: SqliteTenantStore;
  audit: SqliteAuditLog;
  jobs: SqliteJobStore;
  collab: SqliteCollabStore;
  events: EventBus;
  keyRing: JwtKeyRing;
  server: ControlPlaneServer;
  url: string;
  userToken(userId: string, ttlSeconds?: number): string;
  workerToken(workerId: string, tenantId: string, ttlSeconds?: number): string;
  request(
    method: string,
    path: string,
    options?: { token?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> }
  ): Promise<ApiResponse>;
  close(): Promise<void>;
}

export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  const db = openDatabase(options.dbFile ?? ':memory:');
  migrate(db);
  const store = SqliteTenantStore.fromSnapshot(db, options.seed ?? {});
  const audit = new SqliteAuditLog(db);
  const jobs = new SqliteJobStore(db);
  const collab = new SqliteCollabStore(db);
  const events = new EventBus();
  const keyRing = options.keyRing ?? new JwtKeyRing({ k1: generateSecret() }, 'k1');

  const server = createControlPlaneServer({
    store,
    audit,
    jobs,
    collab,
    events,
    identity: { keyRing, now: options.now },
    platformAdmins: options.platformAdmins,
    corsOrigins: options.corsOrigins,
    trustProxy: options.trustProxy,
    limits: options.limits,
    now: options.now,
    health: () => {
      db.prepare('SELECT 1').get();
    },
    ...options.serverOptions,
  });
  const info = await server.listen(0, '127.0.0.1');

  const request: Harness['request'] = async (method, path, opts = {}) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.token) {
      headers.Authorization = `Bearer ${opts.token}`;
    }
    let body: string | undefined;
    if (opts.rawBody !== undefined) {
      body = opts.rawBody;
    } else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
    }
    if (body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${info.url}${path}`, { method, headers, body });
    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: response.status, headers: response.headers, json };
  };

  return {
    db,
    store,
    audit,
    jobs,
    collab,
    events,
    keyRing,
    server,
    url: info.url,
    userToken: (userId, ttl) =>
      issueUserToken({ keyRing, now: options.now }, { userId, ttlSeconds: ttl }).token,
    workerToken: (workerId, tenantId, ttl) =>
      issueWorkerToken({ keyRing, now: options.now }, { workerId, tenantId, ttlSeconds: ttl }).token,
    request,
    async close() {
      await server.close();
      try {
        db.close();
      } catch {
        // A test may have closed the database on purpose (to simulate an outage).
      }
    },
  };
}

/** Standard two-tenant seed: acme (alice admin, bob operator, vera viewer) and globex (gina admin). */
export const STANDARD_SEED = {
  tenants: [
    { id: 'acme', name: 'Acme', allowedCommandIds: ['workspace.summary', 'doctor', 'scorecard'] },
    { id: 'globex', name: 'Globex', allowedCommandIds: ['workspace.summary'] },
  ],
  workspaces: [
    {
      id: 'main',
      tenantId: 'acme',
      name: 'Main',
      allowedCommandIds: ['workspace.summary', 'doctor'],
    },
    { id: 'secret', tenantId: 'globex', name: 'Secret', allowedCommandIds: ['workspace.summary'] },
  ],
  members: [
    { tenantId: 'acme', userId: 'alice', role: 'admin' },
    { tenantId: 'acme', userId: 'bob', role: 'operator' },
    { tenantId: 'acme', userId: 'vera', role: 'viewer' },
    { tenantId: 'globex', userId: 'gina', role: 'admin' },
  ],
};
