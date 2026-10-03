import { createRequire } from 'node:module';

import type { DatabaseSync } from 'node:sqlite';

/**
 * Thin helpers over Node's built-in `node:sqlite` driver (stable enough on the
 * supported Node 22.13+; it prints an ExperimentalWarning once at load).
 *
 * The driver is loaded through `createRequire` rather than a static `import`
 * because some bundlers/test runners do not yet recognise the `node:sqlite`
 * built-in; the type-only import above is erased at compile time.
 */

export type { DatabaseSync, StatementSync } from 'node:sqlite';

const nodeRequire = createRequire(import.meta.url);

type SqliteModule = typeof import('node:sqlite');

let cached: SqliteModule | undefined;

function loadSqlite(): SqliteModule {
  if (!cached) {
    try {
      cached = nodeRequire('node:sqlite') as SqliteModule;
    } catch (error) {
      throw new Error(
        'node:sqlite is not available. The control plane requires Node.js >= 22.13. ' +
          `(${error instanceof Error ? error.message : String(error)})`
      );
    }
  }
  return cached;
}

/**
 * Open (creating if needed) a SQLite database with the pragmas the control plane
 * relies on. Pass `:memory:` for an ephemeral database.
 */
export function openDatabase(file: string): DatabaseSync {
  const { DatabaseSync: Database } = loadSqlite();
  const db = new Database(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (file !== ':memory:') {
    // WAL gives concurrent readers (the SSE/job pollers) while a writer commits.
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
  }
  return db;
}

const depth = new WeakMap<DatabaseSync, number>();

/**
 * Run `fn` atomically. The outermost call opens `BEGIN IMMEDIATE` (taking the
 * write lock up front so read-modify-write sequences cannot interleave across
 * connections); nested calls use SAVEPOINTs so a store method can call another
 * transactional method safely.
 */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  const level = depth.get(db) ?? 0;
  const savepoint = `cp_sp_${level}`;
  db.exec(level === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
  depth.set(db, level + 1);
  try {
    const result = fn();
    depth.set(db, level);
    db.exec(level === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    depth.set(db, level);
    try {
      db.exec(level === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
    } catch {
      // The original error is the one worth surfacing.
    }
    throw error;
  }
}

/** Row shape returned by `StatementSync#get/all` (untyped by the driver). */
export type Row = Record<string, unknown>;
