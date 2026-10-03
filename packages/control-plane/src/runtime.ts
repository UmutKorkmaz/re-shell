import type { ServeConfig } from './config.js';
import { migrate } from './db/migrations.js';
import { SqliteCollabStore } from './db/sqlite-collab.js';
import { SqliteAuditLog } from './db/sqlite-audit.js';
import { SqliteJobStore } from './db/sqlite-jobs.js';
import { SqliteTenantStore } from './db/sqlite-store.js';
import { DatabaseSync, openDatabase } from './db/sqlite.js';
import { ControlPlaneServer, ListenInfo, createControlPlaneServer } from './http/server.js';

/**
 * Wires a {@link ServeConfig} into a running control plane: opens + migrates the
 * database, builds the stores, and starts the HTTP server. Used by the `serve`
 * subcommand and by tests that want the production wiring.
 */

export interface Runtime {
  db: DatabaseSync;
  store: SqliteTenantStore;
  audit: SqliteAuditLog;
  jobs: SqliteJobStore;
  collab: SqliteCollabStore;
  server: ControlPlaneServer;
  listening: ListenInfo;
  close(): Promise<void>;
}

export async function startRuntime(
  config: ServeConfig,
  logger: (entry: Record<string, unknown>) => void = () => undefined
): Promise<Runtime> {
  const db = openDatabase(config.dbPath);
  const report = migrate(db);
  if (report.applied.length > 0) {
    logger({ level: 'info', message: 'applied migrations', versions: report.applied });
  }
  const store = new SqliteTenantStore(db);
  const audit = new SqliteAuditLog(db);
  const jobs = new SqliteJobStore(db);
  const collab = new SqliteCollabStore(db);

  const server = createControlPlaneServer({
    store,
    audit,
    jobs,
    collab,
    iceServers: config.iceServers,
    identity: { keyRing: config.keyRing, issuer: config.issuer, audience: config.audience },
    platformAdmins: config.platformAdmins,
    corsOrigins: config.corsOrigins,
    trustProxy: config.trustProxy,
    hsts: config.hsts,
    limits: config.limits,
    health: () => {
      db.prepare('SELECT 1').get();
    },
    logger,
  });

  let listening: ListenInfo;
  try {
    listening = await server.listen(config.port, config.host);
  } catch (error) {
    db.close();
    throw error;
  }

  return {
    db,
    store,
    audit,
    jobs,
    collab,
    server,
    listening,
    async close() {
      await server.close();
      try {
        db.close();
      } catch {
        // already closed
      }
    },
  };
}
