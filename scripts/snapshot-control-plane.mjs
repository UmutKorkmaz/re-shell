#!/usr/bin/env node
import { closeSync, existsSync, fsyncSync, openSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// VACUUM INTO copies the logical database, including committed WAL pages. This
// deliberately avoids node:sqlite.backup, which is newer than Node 22.13.
const [sourceArg, destinationArg, ...extra] = process.argv.slice(2);
if (!sourceArg || !destinationArg || extra.length) {
  process.stderr.write('Usage: node scripts/snapshot-control-plane.mjs <source.db> <new-snapshot.db>\n');
  process.exitCode = 2;
} else {
  const source = path.resolve(sourceArg);
  const destination = path.resolve(destinationArg);
  let db;
  let reserved = false;
  try {
    if (!existsSync(source) || !statSync(source).isFile()) throw new Error('Source must be an existing SQLite file.');
    // Exclusive reservation refuses replacement and sets private permissions
    // before SQLite writes sensitive tenant data into the snapshot.
    closeSync(openSync(destination, 'wx', 0o600));
    reserved = true;
    db = new DatabaseSync(source, { readOnly: true });
    db.exec('PRAGMA busy_timeout = 5000');
    db.prepare('VACUUM INTO ?').run(destination);
    db.close();
    db = undefined;
    const check = new DatabaseSync(destination, { readOnly: true });
    try {
      if (check.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || check.prepare('PRAGMA foreign_key_check').all().length) {
        throw new Error('Snapshot integrity validation failed.');
      }
    } finally { check.close(); }
    const fd = openSync(destination, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
    const directory = openSync(path.dirname(destination), 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
    process.stdout.write(`${JSON.stringify({ ok: true, snapshot: destination })}\n`);
  } catch {
    if (reserved) rmSync(destination, { force: true });
    process.stderr.write('Snapshot failed; verify source access, free space, destination and SQLite integrity.\n');
    process.exitCode = 1;
  } finally { db?.close(); }
}
