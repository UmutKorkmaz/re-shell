import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Command } from 'commander';
import { redactArgs, redactValue, REDACTED } from '../../src/audit/redact';
import {
  GENESIS_HASH,
  canonicalJson,
  computeEntryHash,
  sealEntry,
  verifyChain,
  type AuditEntry,
} from '../../src/audit/chain';
import {
  appendAuditEntry,
  auditPaths,
  readAuditEntries,
  verifyAuditLog,
  type NewAuditEntry,
} from '../../src/audit/log';
import { AuditSession, argsAfterPath, commandPathOf, installAuditHooks } from '../../src/audit/session';
import { findAuditRoot, readAuditSettings } from '../../src/audit/settings';

let root: string;

function workspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-trail-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'w', private: true, workspaces: ['packages/*'] }));
  return dir;
}

const entryInput = (n: number): NewAuditEntry => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
  actor: 'dev@example.com',
  actorSource: 'git',
  command: `plugin install`,
  args: [`pkg-${n}`],
  cwd: '.',
  exitCode: 0,
  durationMs: n,
});

function seed(count: number): void {
  for (let i = 1; i <= count; i++) appendAuditEntry(root, entryInput(i));
}

function readLines(): string[] {
  return fs.readFileSync(auditPaths(root).log, 'utf8').split('\n').filter(Boolean);
}
function writeLines(lines: string[]): void {
  fs.writeFileSync(auditPaths(root).log, lines.join('\n') + '\n');
}

beforeEach(() => {
  root = workspace();
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('redaction', () => {
  it('redacts values of secret-looking flags in both `--flag value` and `--flag=value` forms', () => {
    expect(redactArgs(['--api-token', 'abc123', '--name', 'x'])).toEqual(['--api-token', REDACTED, '--name', 'x']);
    expect(redactArgs(['--deploy-token=abc123'])).toEqual([`--deploy-token=${REDACTED}`]);
    expect(redactArgs(['--password', 'hunter2', '--secret=s', '--access-key', 'AK'])).toEqual([
      '--password',
      REDACTED,
      `--secret=${REDACTED}`,
      '--access-key',
      REDACTED,
    ]);
  });

  it('does not swallow a following flag when the secret flag is boolean', () => {
    expect(redactArgs(['--no-token', '--verbose'])).toEqual(['--no-token', '--verbose']);
  });

  it('does not redact innocuous flags that merely contain similar letters', () => {
    expect(redactArgs(['--author', 'jane', '--monkey', 'x', '--keyboard', 'us'])).toEqual([
      '--author',
      'jane',
      '--monkey',
      'x',
      '--keyboard',
      'us',
    ]);
  });

  it('redacts NAME=value positionals and set-style key/value pairs', () => {
    expect(redactArgs(['API_KEY=abc', 'PORT=3000'])).toEqual([`API_KEY=${REDACTED}`, 'PORT=3000']);
    expect(redactArgs(['apiToken', 'abc'], ['config', 'set'])).toEqual(['apiToken', REDACTED]);
    expect(redactArgs(['theme', 'dark'], ['config', 'set'])).toEqual(['theme', 'dark']);
  });

  it('redacts credential-shaped values wherever they appear', () => {
    const gh = 'ghp_' + 'a'.repeat(36);
    const aws = 'AKIA' + 'B'.repeat(16);
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk';
    expect(redactArgs([gh, aws, jwt])).toEqual([REDACTED, REDACTED, REDACTED]);
    expect(redactValue('https://user:pa55w0rd@registry.example.com/x')).toBe(`https://user:${REDACTED}@registry.example.com/x`);
    expect(redactValue('Authorization: Bearer abcdefghijklmnop')).toContain(REDACTED);
    expect(redactArgs(['--registry', 'https://u:p@h.io'])).toEqual(['--registry', `https://u:${REDACTED}@h.io`]);
  });

  it('truncates absurdly long args and arg lists', () => {
    const [long] = redactArgs(['x'.repeat(5000)]);
    expect(long.length).toBeLessThan(600);
    expect(redactArgs(Array.from({ length: 150 }, (_, i) => `a${i}`))).toHaveLength(101);
  });

  it('never writes the secret into the log file (end to end)', () => {
    const session = new AuditSession({ argv: ['plugin', 'install', 'foo', '--api-token', 'TOPSECRET-VALUE-123', '--password=hunter2'], cwd: root });
    expect(session.begin(['plugin', 'install'])).toBe(true);
    session.finish(0);
    const raw = fs.readFileSync(auditPaths(root).log, 'utf8');
    expect(raw).not.toContain('TOPSECRET-VALUE-123');
    expect(raw).not.toContain('hunter2');
    expect(raw).toContain(REDACTED);
  });
});

describe('hash chain', () => {
  it('canonical JSON is key-order independent', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('chains entries: seq is gap-free and prevHash links to the previous hash', () => {
    seed(3);
    const entries = readAuditEntries(root);
    expect(entries.map(e => e.seq)).toEqual([1, 2, 3]);
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[1].prevHash).toBe(entries[0].hash);
    expect(entries[2].prevHash).toBe(entries[1].hash);
    for (const e of entries) expect(computeEntryHash(e)).toBe(e.hash);
    const result = verifyAuditLog(root);
    expect(result).toMatchObject({ valid: true, entries: 3, lastSeq: 3, failures: [] });
  });

  it('records every required field', () => {
    seed(1);
    const [e] = readAuditEntries(root);
    expect(Object.keys(e).sort()).toEqual(
      ['actor', 'actorSource', 'args', 'command', 'cwd', 'durationMs', 'exitCode', 'hash', 'prevHash', 'seq', 'timestamp', 'v'].sort()
    );
  });

  it('an empty / never-written log verifies as valid with zero entries', () => {
    expect(verifyAuditLog(root)).toMatchObject({ valid: true, entries: 0, logExists: false });
  });

  describe('tamper detection', () => {
    it('detects a MODIFIED entry', () => {
      seed(4);
      const lines = readLines();
      const e = JSON.parse(lines[1]) as AuditEntry;
      e.args = ['something-else'];
      lines[1] = JSON.stringify(e);
      writeLines(lines);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures[0]).toMatchObject({ code: 'hash-mismatch', seq: 2, line: 2 });
    });

    it('detects a modified entry even when its hash is recomputed (breaks the next link)', () => {
      seed(4);
      const lines = readLines();
      const e = JSON.parse(lines[1]) as AuditEntry;
      e.exitCode = 0;
      e.args = ['forged'];
      lines[1] = JSON.stringify(sealEntry({ ...e }));
      writeLines(lines);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures.some(f => f.code === 'chain-broken' && f.seq === 3)).toBe(true);
    });

    it('detects a REMOVED entry from the middle', () => {
      seed(5);
      const lines = readLines();
      lines.splice(2, 1);
      writeLines(lines);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      const codes = r.failures.map(f => f.code);
      expect(codes).toContain('sequence-gap');
      expect(codes).toContain('chain-broken');
      expect(r.failures.find(f => f.code === 'sequence-gap')).toMatchObject({ seq: 4, line: 3 });
    });

    it('detects the removal of the FIRST entry', () => {
      seed(3);
      const lines = readLines();
      lines.shift();
      writeLines(lines);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures.map(f => f.code)).toContain('sequence-gap');
    });

    it('detects TRUNCATED trailing entries through the head record', () => {
      seed(5);
      const lines = readLines();
      writeLines(lines.slice(0, 3));
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures).toHaveLength(1);
      expect(r.failures[0]).toMatchObject({ code: 'head-mismatch' });
      expect(r.failures[0].message).toMatch(/trailing entries were removed/);
    });

    it('detects a deleted log file', () => {
      seed(2);
      fs.rmSync(auditPaths(root).log);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures[0].code).toBe('log-missing');
    });

    it('keeps the chain moving from the head after the log was deleted, so the gap stays visible', () => {
      seed(2);
      fs.rmSync(auditPaths(root).log);
      appendAuditEntry(root, entryInput(9));
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures.map(f => f.code)).toContain('sequence-gap');
    });

    it('detects REORDERED entries', () => {
      seed(4);
      const lines = readLines();
      [lines[1], lines[2]] = [lines[2], lines[1]];
      writeLines(lines);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      const codes = r.failures.map(f => f.code);
      expect(codes).toContain('chain-broken');
      expect(codes.some(c => c === 'sequence-reordered' || c === 'sequence-gap')).toBe(true);
    });

    it('detects DUPLICATED entries', () => {
      seed(3);
      const lines = readLines();
      lines.splice(2, 0, lines[1]);
      writeLines(lines);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures.map(f => f.code)).toContain('sequence-reordered');
    });

    it('detects an INSERTED forged entry', () => {
      seed(3);
      const lines = readLines();
      const forged = sealEntry({ ...(JSON.parse(lines[0]) as AuditEntry), seq: 2, command: 'plugin uninstall' } as Omit<AuditEntry, 'hash'>);
      lines.splice(1, 0, JSON.stringify(forged));
      writeLines(lines);
      expect(verifyAuditLog(root).valid).toBe(false);
    });

    it('reports corrupt and blank lines', () => {
      seed(2);
      const lines = readLines();
      lines.splice(1, 0, 'not json at all');
      lines.push('');
      writeLines(lines);
      const r = verifyAuditLog(root);
      expect(r.valid).toBe(false);
      expect(r.failures.map(f => f.code)).toContain('invalid-json');
    });

    it('reports a structurally invalid entry', () => {
      seed(1);
      const lines = readLines();
      lines.push(JSON.stringify({ seq: 2, hello: 'world' }));
      writeLines(lines);
      expect(verifyAuditLog(root).failures.map(f => f.code)).toContain('invalid-entry');
    });

    it('supports an externally anchored head hash', () => {
      seed(3);
      const head = readAuditEntries(root)[2].hash;
      expect(verifyAuditLog(root, { expectHead: head }).valid).toBe(true);
      const bad = verifyAuditLog(root, { expectHead: 'f'.repeat(64) });
      expect(bad.valid).toBe(false);
      expect(bad.failures[0].code).toBe('anchor-mismatch');
    });

    it('verifyChain is pure and reports every problem, not just the first', () => {
      const a = sealEntry({ v: 1, seq: 1, timestamp: 't', actor: 'a', actorSource: 'os', command: 'x', args: [], cwd: '.', exitCode: 0, durationMs: 1, prevHash: GENESIS_HASH });
      const b = sealEntry({ ...a, seq: 2, prevHash: a.hash });
      const c = sealEntry({ ...b, seq: 3, prevHash: b.hash });
      const tampered = { ...a, command: 'evil' };
      const dTampered = { ...c, command: 'evil2' };
      const result = verifyChain([JSON.stringify(tampered), JSON.stringify(b), JSON.stringify(dTampered)]);
      expect(result.failures.filter(f => f.code === 'hash-mismatch').map(f => f.seq)).toEqual([1, 3]);
    });
  });

  it('serializes concurrent writers from separate processes without forking the chain', async () => {
    const { spawn } = await import('child_process');
    const logModule = path.resolve(__dirname, '../../dist/audit/log.js');
    const script = `
      const { appendAuditEntry } = require(${JSON.stringify(logModule)});
      for (let i = 0; i < 6; i++) {
        appendAuditEntry(${JSON.stringify(root)}, {
          timestamp: new Date().toISOString(), actor: 'p' + process.pid, actorSource: 'os',
          command: 'create', args: [String(i)], cwd: '.', exitCode: 0, durationMs: 1,
        });
      }`;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, ['-e', script], { stdio: 'inherit' });
          child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`writer exited ${code}`))));
        })
      )
    );
    const result = verifyAuditLog(root);
    expect(result.entries).toBe(36);
    expect(result.valid).toBe(true);
    expect(readAuditEntries(root).map(e => e.seq)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
  }, 60000);

  it('steals a stale lock left by a crashed writer', () => {
    seed(1);
    const lock = auditPaths(root).lock;
    fs.writeFileSync(lock, '99999 0\n');
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, old, old);
    appendAuditEntry(root, entryInput(2));
    expect(verifyAuditLog(root).valid).toBe(true);
    expect(fs.existsSync(lock)).toBe(false);
  });
});

describe('workspace root and settings', () => {
  it('finds the workspace root from a nested directory and ignores non-workspaces', () => {
    const nested = path.join(root, 'packages', 'a', 'src');
    fs.mkdirSync(nested, { recursive: true });
    expect(findAuditRoot(nested)).toBe(root);
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-plain-'));
    try {
      expect(findAuditRoot(plain)).toBeNull();
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });

  it('prefers an ancestor that already holds an audit log', () => {
    const inner = path.join(root, 'packages', 'x');
    fs.mkdirSync(inner, { recursive: true });
    fs.writeFileSync(path.join(inner, 'package.json'), JSON.stringify({ name: 'x', workspaces: ['y'] }));
    appendAuditEntry(root, entryInput(1));
    expect(findAuditRoot(inner)).toBe(root);
  });

  it('opt-out via environment', () => {
    for (const v of ['0', 'false', 'off', 'no']) {
      expect(readAuditSettings(root, { RE_SHELL_AUDIT: v })).toMatchObject({ enabled: false, disabledBy: 'env' });
    }
    expect(readAuditSettings(root, {}).enabled).toBe(true);
  });

  it('opt-out via config (`config set audit.enabled false` writes this)', () => {
    fs.mkdirSync(path.join(root, '.re-shell'));
    fs.writeFileSync(path.join(root, '.re-shell', 'config.yaml'), 'name: w\naudit:\n  enabled: false\n');
    expect(readAuditSettings(root, {})).toMatchObject({ enabled: false, disabledBy: 'config' });
  });

  it('a broken config never silences the audit trail', () => {
    fs.mkdirSync(path.join(root, '.re-shell'));
    fs.writeFileSync(path.join(root, '.re-shell', 'config.yaml'), 'audit: [unclosed\n  : :');
    expect(readAuditSettings(root, {}).enabled).toBe(true);
  });

  it('unknownCommands: ignore is honoured', () => {
    fs.mkdirSync(path.join(root, '.re-shell'));
    fs.writeFileSync(path.join(root, '.re-shell', 'config.yaml'), 'audit:\n  unknownCommands: ignore\n');
    const session = new AuditSession({ argv: ['frobnicate'], cwd: root });
    expect(session.begin(['frobnicate'])).toBe(false);
    const known = new AuditSession({ argv: ['create', 'x'], cwd: root });
    expect(known.begin(['create'])).toBe(true);
  });
});

describe('audit session (lifecycle)', () => {
  it('writes one entry with exit code, duration, actor, and cwd relative to the root', () => {
    const cwd = path.join(root, 'packages', 'a');
    fs.mkdirSync(cwd, { recursive: true });
    let t = 1_000_000;
    const session = new AuditSession({ argv: ['plugin', 'install', 'foo', '--force'], cwd, now: () => (t += 250) });
    expect(session.begin(['plugin', 'install'])).toBe(true);
    session.finish(3);
    session.finish(0); // idempotent
    const [e] = readAuditEntries(root);
    expect(e).toMatchObject({ command: 'plugin install', args: ['foo', '--force'], cwd: 'packages/a', exitCode: 3, durationMs: 250 });
    expect(e.actor.length).toBeGreaterThan(0);
    expect(['git', 'os']).toContain(e.actorSource);
    expect(readAuditEntries(root)).toHaveLength(1);
  });

  it('records the root as "." when run from the workspace root', () => {
    const session = new AuditSession({ argv: ['create', 'x'], cwd: root });
    session.begin(['create']);
    session.finish(0);
    expect(readAuditEntries(root)[0].cwd).toBe('.');
  });

  it('skips read-only commands, dry runs, and opted-out workspaces', () => {
    expect(new AuditSession({ argv: ['list'], cwd: root }).begin(['list'])).toBe(false);
    expect(new AuditSession({ argv: ['create', 'x', '--dry-run'], cwd: root }).begin(['create'])).toBe(false);
    expect(new AuditSession({ argv: ['create', 'x'], cwd: root, env: { RE_SHELL_AUDIT: '0' } }).begin(['create'])).toBe(false);
    expect(fs.existsSync(auditPaths(root).log)).toBe(false);
  });

  it('writes nothing outside a workspace', () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-plain-'));
    try {
      const session = new AuditSession({ argv: ['create', 'x'], cwd: plain });
      session.begin(['create']);
      session.finish(0);
      expect(fs.existsSync(path.join(plain, '.re-shell'))).toBe(false);
    } finally {
      fs.rmSync(plain, { recursive: true, force: true });
    }
  });

  it('`init <name>` is recorded in the workspace it creates', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-init-'));
    try {
      const session = new AuditSession({ argv: ['init', 'proj', '--yes'], cwd: parent });
      expect(session.begin(['init'])).toBe(true);
      // The command creates the workspace while it runs.
      const proj = path.join(parent, 'proj');
      fs.mkdirSync(path.join(proj, '.re-shell'), { recursive: true });
      fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({ name: 'proj', workspaces: ['packages/*'] }));
      session.finish(0);
      const entries = readAuditEntries(proj);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ command: 'init', cwd: '..' });
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it('reports write failures without throwing', () => {
    const errors: string[] = [];
    fs.mkdirSync(path.join(root, '.re-shell'), { recursive: true });
    fs.writeFileSync(path.join(root, '.re-shell', 'audit'), 'a file where the directory should be');
    const session = new AuditSession({ argv: ['create', 'x'], cwd: root, onError: e => errors.push(e.message) });
    session.begin(['create']);
    expect(() => session.finish(0)).not.toThrow();
    expect(errors).toHaveLength(1);
  });

  it('argsAfterPath strips only the command-path tokens', () => {
    expect(argsAfterPath(['plugin', 'install', 'install', '--x'], ['plugin', 'install'])).toEqual(['install', '--x']);
  });

  it('is hooked into commander centrally: one preAction covers every command', async () => {
    const program = new Command('re-shell');
    program.exitOverride();
    const calls: string[] = [];
    const sub = program.command('plugin').description('g');
    sub.command('install <name>').option('--api-token <t>').action(() => {
      calls.push('ran');
    });
    sub.command('list').action(() => {
      calls.push('list');
    });
    const session = installAuditHooks(program, { argv: ['plugin', 'install', 'foo', '--api-token', 'SEKRET'], cwd: root });
    const exitHandlers = process.listeners('exit').length;
    await program.parseAsync(['node', 're-shell', 'plugin', 'install', 'foo', '--api-token', 'SEKRET']);
    expect(calls).toEqual(['ran']);
    expect(session.active).toBe(true);
    expect(commandPathOf(sub.commands[0])).toEqual(['plugin', 'install']);
    // Simulate process exit (the real handler is registered on `process`).
    session.finish(0);
    const [entry] = readAuditEntries(root);
    expect(entry).toMatchObject({ command: 'plugin install', args: ['foo', '--api-token', REDACTED], exitCode: 0 });
    // Clean up the real exit/signal handlers installed by the hook.
    for (const l of process.listeners('exit').slice(exitHandlers)) process.removeListener('exit', l as () => void);
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.removeAllListeners(sig);
  });
});
