import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

/** A single audit log entry in JSONL format. */
export interface AuditEntry {
  /** ISO 8601 timestamp. */
  ts: string;
  /** Plugin name that performed the action. */
  plugin: string;
  /** The intercepted utility call (e.g. `fs.writeFile`, `exec`, `spawn`). */
  action: string;
  /** The resource path or command string. */
  resource: string;
  /** Whether the action was allowed by the permission enforcer. */
  allowed: boolean;
  /** Human-readable explanation of the decision. */
  reason?: string;
}

/** Default audit log path: `~/.re-shell/plugin-audit.log`. */
export const DEFAULT_AUDIT_LOG_PATH = path.join(
  os.homedir(),
  '.re-shell',
  'plugin-audit.log'
);

/**
 * Append-only JSONL audit logger for plugin permission checks.
 * Each `log()` call appends one JSON line to the file.
 */
export class AuditLogger {
  private logPath: string;

  constructor(logPath: string = DEFAULT_AUDIT_LOG_PATH) {
    this.logPath = logPath;
  }

  /** Append an entry to the audit log. Auto-fills `ts` if missing. */
  log(entry: Omit<AuditEntry, 'ts'> & { ts?: string }): void {
    const fullEntry: AuditEntry = {
      ts: entry.ts ?? new Date().toISOString(),
      plugin: entry.plugin,
      action: entry.action,
      resource: entry.resource,
      allowed: entry.allowed,
      ...(entry.reason !== undefined && { reason: entry.reason }),
    };
    const line = JSON.stringify(fullEntry) + '\n';
    fs.ensureDirSync(path.dirname(this.logPath));
    fs.appendFileSync(this.logPath, line, 'utf8');
  }

  /** Read all entries from the log file. */
  read(): AuditEntry[] {
    return readAuditLog(this.logPath);
  }

  /** Clear the audit log file. */
  clear(): void {
    if (fs.pathExistsSync(this.logPath)) {
      fs.removeSync(this.logPath);
    }
  }

  /** Get the log file path. */
  get path(): string {
    return this.logPath;
  }
}

/**
 * Parse a JSONL audit log file into an array of entries.
 * Malformed lines are silently skipped.
 */
export function readAuditLog(logPath: string): AuditEntry[] {
  if (!fs.pathExistsSync(logPath)) return [];
  const content = fs.readFileSync(logPath, 'utf8');
  const entries: AuditEntry[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as AuditEntry);
    } catch {
      // Skip malformed lines
    }
  }
  return entries;
}

/** Filter options for querying the audit log. */
export interface AuditFilterOptions {
  plugin?: string;
  allowed?: boolean;
  actionPrefix?: string;
  limit?: number;
}

/** Filter audit log entries by various criteria. */
export function filterAuditLog(
  logPath: string,
  options: AuditFilterOptions = {}
): AuditEntry[] {
  let entries = readAuditLog(logPath);
  if (options.plugin) {
    entries = entries.filter((e) => e.plugin === options.plugin);
  }
  if (options.allowed !== undefined) {
    entries = entries.filter((e) => e.allowed === options.allowed);
  }
  if (options.actionPrefix) {
    entries = entries.filter((e) => e.action.startsWith(options.actionPrefix!));
  }
  if (options.limit !== undefined && options.limit > 0) {
    entries = entries.slice(-options.limit);
  }
  return entries;
}
