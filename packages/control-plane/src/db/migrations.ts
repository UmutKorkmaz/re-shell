import { DatabaseSync, transaction } from './sqlite.js';

/**
 * Ordered, forward-only schema migrations. Each runs once, inside a transaction,
 * and is recorded in `schema_migrations`. A database whose recorded version is
 * NEWER than this build knows about is refused rather than silently used (an old
 * binary must not write to a schema it does not understand).
 *
 * Isolation notes (docs/control-plane.md §3):
 *  - `workspaces` is keyed by (tenant_id, id): a workspace id is only unique
 *    WITHIN a tenant and every access path names the tenant first.
 *  - `memberships` is the only source of tenant membership.
 *  - `audit_log` is append-only: BEFORE UPDATE / BEFORE DELETE triggers abort.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'core-tenancy-and-audit',
    sql: `
      CREATE TABLE tenants (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        allowed_command_ids TEXT NOT NULL DEFAULT '[]',
        policy_pack         TEXT,
        policy_version      INTEGER NOT NULL DEFAULT 0 CHECK (policy_version >= 0),
        created_at          INTEGER NOT NULL,
        updated_at          INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE workspaces (
        tenant_id           TEXT NOT NULL REFERENCES tenants(id),
        id                  TEXT NOT NULL,
        name                TEXT NOT NULL,
        allowed_command_ids TEXT NOT NULL DEFAULT '[]',
        created_at          INTEGER NOT NULL,
        updated_at          INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, id)
      ) STRICT;

      CREATE TABLE memberships (
        tenant_id  TEXT NOT NULL REFERENCES tenants(id),
        user_id    TEXT NOT NULL,
        role       TEXT NOT NULL CHECK (role IN ('viewer', 'operator', 'admin')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, user_id)
      ) STRICT;
      CREATE INDEX memberships_user_idx ON memberships (user_id);

      CREATE TABLE audit_log (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ts           INTEGER NOT NULL,
        user_id      TEXT,
        tenant_id    TEXT,
        workspace_id TEXT,
        command_id   TEXT,
        action       TEXT NOT NULL,
        decision     TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
        code         TEXT,
        detail       TEXT
      ) STRICT;
      CREATE INDEX audit_tenant_idx ON audit_log (tenant_id, id);

      CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'audit_log is append-only');
      END;
      CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'audit_log is append-only');
      END;
    `,
  },
  {
    version: 2,
    name: 'jobs',
    sql: `
      CREATE TABLE jobs (
        id               TEXT PRIMARY KEY,
        tenant_id        TEXT NOT NULL,
        workspace_id     TEXT NOT NULL,
        command_id       TEXT NOT NULL,
        params           TEXT NOT NULL DEFAULT '{}',
        requested_by     TEXT NOT NULL,
        status           TEXT NOT NULL
                         CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
        exit_code        INTEGER,
        error_code       TEXT,
        error_message    TEXT,
        worker_id        TEXT,
        lease_expires_at INTEGER,
        cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
        output_bytes     INTEGER NOT NULL DEFAULT 0,
        output_truncated INTEGER NOT NULL DEFAULT 0 CHECK (output_truncated IN (0, 1)),
        created_at       INTEGER NOT NULL,
        started_at       INTEGER,
        finished_at      INTEGER,
        FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces (tenant_id, id)
      ) STRICT;
      CREATE INDEX jobs_tenant_created_idx ON jobs (tenant_id, created_at DESC);
      CREATE INDEX jobs_queue_idx ON jobs (tenant_id, status, created_at);

      CREATE TABLE job_output (
        job_id TEXT NOT NULL REFERENCES jobs(id),
        seq    INTEGER NOT NULL,
        stream TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr')),
        data   TEXT NOT NULL,
        ts     INTEGER NOT NULL,
        PRIMARY KEY (job_id, seq)
      ) STRICT;
    `,
  },
  {
    version: 3,
    name: 'collab-sessions',
    sql: `
      -- A shared session: one per (tenant, workspace) conversation. Every table
      -- below is keyed tenant-first, like the rest of the schema, so a session id
      -- from another tenant is simply absent.
      CREATE TABLE collab_sessions (
        tenant_id    TEXT NOT NULL,
        id           TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        title        TEXT NOT NULL,
        owner_id     TEXT NOT NULL,
        driver_id    TEXT,
        status       TEXT NOT NULL CHECK (status IN ('active', 'ended')),
        seq          INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL,
        ended_at     INTEGER,
        ended_by     TEXT,
        PRIMARY KEY (tenant_id, id),
        FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces (tenant_id, id)
      ) STRICT;
      CREATE INDEX collab_sessions_created_idx ON collab_sessions (tenant_id, created_at DESC);
      CREATE INDEX collab_sessions_workspace_idx ON collab_sessions (tenant_id, workspace_id, created_at DESC);

      -- Everyone who ever joined; left_at IS NULL means currently present.
      CREATE TABLE collab_participants (
        tenant_id  TEXT NOT NULL,
        session_id TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        joined_at  INTEGER NOT NULL,
        left_at    INTEGER,
        PRIMARY KEY (tenant_id, session_id, user_id),
        FOREIGN KEY (tenant_id, session_id) REFERENCES collab_sessions (tenant_id, id)
      ) STRICT;

      -- The ordered, append-only session log. (tenant, session, seq) is the
      -- total order every participant observes. 'ref'/'ref_seq' index the
      -- stream an event belongs to: a document id + revision for doc.* events, a
      -- job id + output chunk number for command.* events.
      CREATE TABLE collab_events (
        tenant_id  TEXT NOT NULL,
        session_id TEXT NOT NULL,
        seq        INTEGER NOT NULL,
        type       TEXT NOT NULL,
        ts         INTEGER NOT NULL,
        actor      TEXT,
        data       TEXT NOT NULL,
        ref        TEXT,
        ref_seq    INTEGER,
        client_id  TEXT,
        client_seq INTEGER,
        PRIMARY KEY (tenant_id, session_id, seq),
        FOREIGN KEY (tenant_id, session_id) REFERENCES collab_sessions (tenant_id, id)
      ) STRICT;
      CREATE INDEX collab_events_ref_idx
        ON collab_events (tenant_id, session_id, type, ref, ref_seq) WHERE ref IS NOT NULL;
      -- A retried document op (same client, same client sequence) is applied once.
      CREATE UNIQUE INDEX collab_events_client_idx
        ON collab_events (tenant_id, session_id, ref, client_id, client_seq) WHERE client_id IS NOT NULL;

      CREATE TABLE collab_docs (
        tenant_id  TEXT NOT NULL,
        session_id TEXT NOT NULL,
        id         TEXT NOT NULL,
        title      TEXT NOT NULL,
        kind       TEXT NOT NULL CHECK (kind IN ('notes', 'yaml-draft', 'text')),
        content    TEXT NOT NULL,
        rev        INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (tenant_id, session_id, id),
        FOREIGN KEY (tenant_id, session_id) REFERENCES collab_sessions (tenant_id, id)
      ) STRICT;

      -- The console: one row per command run in a session, linked to the job
      -- that a worker executes. status/exit_code mirror what has been LOGGED
      -- (collab_events), not the job row, so a snapshot is always consistent
      -- with its sequence number. forwarded_seq is the job_output cursor.
      CREATE TABLE collab_runs (
        tenant_id     TEXT NOT NULL,
        session_id    TEXT NOT NULL,
        job_id        TEXT NOT NULL,
        command_id    TEXT NOT NULL,
        params        TEXT NOT NULL DEFAULT '{}',
        requested_by  TEXT NOT NULL,
        status        TEXT NOT NULL
                      CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
        exit_code     INTEGER,
        error_code    TEXT,
        queued_at     INTEGER NOT NULL,
        started_at    INTEGER,
        finished_at   INTEGER,
        forwarded_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (tenant_id, session_id, job_id),
        FOREIGN KEY (tenant_id, session_id) REFERENCES collab_sessions (tenant_id, id),
        FOREIGN KEY (job_id) REFERENCES jobs (id)
      ) STRICT;
      CREATE INDEX collab_runs_open_idx ON collab_runs (status) WHERE status IN ('queued', 'running');
      CREATE INDEX collab_runs_job_idx ON collab_runs (job_id);
      CREATE INDEX collab_runs_time_idx ON collab_runs (tenant_id, queued_at);
    `,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export interface MigrationReport {
  /** Versions applied by this call (empty when already current). */
  applied: number[];
  /** The schema version after the call. */
  version: number;
}

/**
 * Bring `db` up to the latest schema. Safe to call repeatedly and from several
 * processes at once (each migration re-checks under the write lock).
 */
export function migrate(
  db: DatabaseSync,
  options: { migrations?: readonly Migration[]; clock?: () => number } = {}
): MigrationReport {
  const migrations = options.migrations ?? MIGRATIONS;
  const clock = options.clock ?? Date.now;

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    ) STRICT;
  `);

  const known = new Set(migrations.map((m) => m.version));
  const recorded = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: number }>;
  for (const { version } of recorded) {
    if (!known.has(version)) {
      throw new Error(
        `Database schema version ${version} is newer than this build supports ` +
          `(latest ${migrations[migrations.length - 1]?.version ?? 0}). Upgrade the control plane.`
      );
    }
  }

  const applied: number[] = [];
  for (const migration of migrations) {
    transaction(db, () => {
      const done = db
        .prepare('SELECT 1 AS present FROM schema_migrations WHERE version = ?')
        .get(migration.version);
      if (done) {
        return;
      }
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        clock()
      );
      applied.push(migration.version);
    });
  }

  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
    version: number | null;
  };
  return { applied, version: row.version ?? 0 };
}
