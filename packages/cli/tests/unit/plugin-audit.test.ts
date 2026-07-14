import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuditLogger, readAuditLog, filterAuditLog } from '../../src/utils/plugin-audit';

const tempDirs: string[] = [];

function getAuditPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-audit-'));
  tempDirs.push(dir);
  return join(dir, 'plugin-audit.log');
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('AuditLogger', () => {
  it('should create a log entry in JSONL format', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({
      plugin: 'test-plugin',
      action: 'fs.writeFile',
      resource: '/tmp/test.txt',
      allowed: true,
      reason: 'matches filesystem:write permission',
    });
    const content = readFileSync(logPath, 'utf8').trim();
    const entry = JSON.parse(content);
    expect(entry.plugin).toBe('test-plugin');
    expect(entry.action).toBe('fs.writeFile');
    expect(entry.allowed).toBe(true);
  });

  it('should append multiple entries as separate JSON lines', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({ plugin: 'a', action: 'fs.readFile', resource: '/x', allowed: true });
    logger.log({ plugin: 'b', action: 'exec', resource: 'ls', allowed: false, reason: 'no permission' });
    const lines = readFileSync(logPath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).plugin).toBe('a');
    expect(JSON.parse(lines[1]).plugin).toBe('b');
  });

  it('should auto-generate timestamp if not provided', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({ plugin: 'test', action: 'fs.stat', resource: '/x', allowed: true });
    const entry = JSON.parse(readFileSync(logPath, 'utf8').trim());
    expect(entry.ts).toBeDefined();
    expect(typeof entry.ts).toBe('string');
  });
});

describe('readAuditLog', () => {
  it('should return empty array when file does not exist', () => {
    const entries = readAuditLog('/nonexistent/path/audit.log');
    expect(entries).toEqual([]);
  });

  it('should parse JSONL entries into array', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({ plugin: 'x', action: 'fs.copy', resource: '/a', allowed: true });
    logger.log({ plugin: 'y', action: 'spawn', resource: '/b', allowed: false, reason: 'denied' });
    const entries = readAuditLog(logPath);
    expect(entries.length).toBe(2);
    expect(entries[0].plugin).toBe('x');
    expect(entries[1].allowed).toBe(false);
  });

  it('should skip malformed lines gracefully', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({ plugin: 'x', action: 'fs.copy', resource: '/a', allowed: true });
    const { appendFileSync } = require('fs');
    appendFileSync(logPath, 'NOT VALID JSON\n');
    const entries = readAuditLog(logPath);
    expect(entries.length).toBe(1);
  });
});

describe('filterAuditLog', () => {
  it('should filter by plugin name', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({ plugin: 'alpha', action: 'fs.readFile', resource: '/1', allowed: true });
    logger.log({ plugin: 'beta', action: 'fs.readFile', resource: '/2', allowed: true });
    const filtered = filterAuditLog(logPath, { plugin: 'alpha' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].plugin).toBe('alpha');
  });

  it('should filter by allowed status', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({ plugin: 'x', action: 'fs.readFile', resource: '/1', allowed: true });
    logger.log({ plugin: 'x', action: 'exec', resource: 'ls', allowed: false, reason: 'denied' });
    const denied = filterAuditLog(logPath, { allowed: false });
    expect(denied.length).toBe(1);
    expect(denied[0].allowed).toBe(false);
  });

  it('should filter by action prefix', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    logger.log({ plugin: 'x', action: 'fs.readFile', resource: '/1', allowed: true });
    logger.log({ plugin: 'x', action: 'exec', resource: 'ls', allowed: true });
    const fsActions = filterAuditLog(logPath, { actionPrefix: 'fs.' });
    expect(fsActions.length).toBe(1);
    expect(fsActions[0].action).toBe('fs.readFile');
  });

  it('should filter by limit', () => {
    const logPath = getAuditPath();
    const logger = new AuditLogger(logPath);
    for (let i = 0; i < 10; i++) {
      logger.log({ plugin: 'x', action: 'fs.readFile', resource: `/${i}`, allowed: true });
    }
    const limited = filterAuditLog(logPath, { limit: 3 });
    expect(limited.length).toBe(3);
  });
});
