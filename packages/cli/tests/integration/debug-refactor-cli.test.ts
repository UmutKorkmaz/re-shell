import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  debugConfigResponseSchema,
  jsonResponseSchema,
  refactorRenameServiceResponseSchema,
} from '@re-shell/contracts';

/**
 * Drives the BUILT CLI for `debug config` and `refactor rename-service` on a
 * copy of the polyglot fixture workspace (temp dirs only): JSON envelope shape,
 * exit codes, error codes and real on-disk results.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const FIXTURE = path.resolve(process.cwd(), 'tests/fixtures/polyglot-workspace');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-dr-int-'));

interface Run {
  status: number;
  stdout: string;
  stderr: string;
  json: any;
}

function run(args: string[], cwd: string): Run {
  const res = spawnSync(process.execPath, [CLI_PATH, ...args], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let json: any;
  if (args.includes('--json')) {
    const lines = res.stdout.split('\n').filter(l => l.length > 0);
    expect(lines.length, `expected a single JSON line, got:\n${res.stdout}\n${res.stderr}`).toBe(1);
    json = JSON.parse(lines[0]);
  }
  return { status: res.status ?? 1, stdout: res.stdout, stderr: res.stderr, json };
}

function workspace(opts: { git?: boolean } = {}): string {
  const dir = fs.mkdtempSync(path.join(SCRATCH, 'ws-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  if (opts.git) {
    for (const args of [['init', '-q', '-b', 'main'], ['add', '-A'], ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'fixture']]) {
      execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    }
  }
  return dir;
}

beforeAll(() => {
  expect(fs.existsSync(CLI_PATH), 'dist/index.js must be built').toBe(true);
});
afterAll(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

describe('re-shell debug config (built CLI)', () => {
  it('--json --dry-run returns a schema-valid envelope and writes nothing', () => {
    const dir = workspace();
    const r = run(['debug', 'config', '--dry-run', '--json'], dir);
    expect(r.status).toBe(0);
    expect(jsonResponseSchema(debugConfigResponseSchema).safeParse(r.json).success).toBe(true);
    expect(r.json.data.dryRun).toBe(true);
    expect(r.json.data.written).toBe(false);
    expect(r.json.data.services.map((s: any) => s.debugKind).sort()).toEqual(
      ['dotnet', 'go', 'go', 'java', 'node', 'node', 'php', 'python', 'ruby', 'rust', 'rust'].sort()
    );
    expect(fs.existsSync(path.join(dir, '.vscode'))).toBe(false);
  });

  it('writes .vscode/launch.json and docker-compose.debug.yml, then merges into a user file without clobbering', () => {
    const dir = workspace();
    fs.mkdirSync(path.join(dir, '.vscode'));
    const mine = '{\n  // my stuff\n  "version": "0.2.0",\n  "configurations": [\n    { "name": "Mine", "type": "node", "request": "launch", "program": "x.js" }\n  ]\n}\n';
    fs.writeFileSync(path.join(dir, '.vscode', 'launch.json'), mine);
    const r = run(['debug', 'config', '--services', 'api,analytics', '--json'], dir);
    expect(r.status, r.stdout).toBe(0);
    expect(r.json.data.launch).toMatchObject({ created: false, preserved: 1 });
    const text = fs.readFileSync(path.join(dir, '.vscode', 'launch.json'), 'utf8');
    expect(text).toContain('// my stuff');
    expect(text).toContain('{ "name": "Mine", "type": "node", "request": "launch", "program": "x.js" }');
    expect(text).toContain('re-shell: api (attach)');
    expect(text).toContain('re-shell: analytics (attach)');
    expect(fs.readFileSync(path.join(dir, 'docker-compose.debug.yml'), 'utf8')).toContain('NODE_OPTIONS');
  });

  it('DEBUG_CONFIG_ERROR (exit 1) for unknown services and for an unparseable launch.json', () => {
    const dir = workspace();
    const unknown = run(['debug', 'config', '--services', 'nope', '--json'], dir);
    expect(unknown.status).toBe(1);
    expect(unknown.json.ok).toBe(false);
    expect(unknown.json.error.code).toBe('DEBUG_CONFIG_ERROR');
    fs.mkdirSync(path.join(dir, '.vscode'));
    fs.writeFileSync(path.join(dir, '.vscode', 'launch.json'), '{ "configurations": [ {');
    const bad = run(['debug', 'config', '--json'], dir);
    expect(bad.json.error.code).toBe('DEBUG_CONFIG_ERROR');
    expect(fs.readFileSync(path.join(dir, '.vscode', 'launch.json'), 'utf8')).toBe('{ "configurations": [ {');
  });

  it('WORKSPACE_NOT_FOUND outside a workspace', () => {
    const empty = fs.mkdtempSync(path.join(SCRATCH, 'empty-'));
    const r = run(['debug', 'config', '--json'], empty);
    expect(r.status).toBe(1);
    expect(r.json.error.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('human output lists services, ports and the compound', () => {
    const dir = workspace();
    const r = run(['debug', 'config', '--dry-run', '--services', 'api,web'], dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('re-shell: api (attach)');
    expect(r.stdout).toContain('compound: re-shell: web + api');
  });
});

describe('re-shell refactor rename-service (built CLI)', () => {
  it('--dry-run --json: schema-valid envelope with a unified diff, nothing changed', () => {
    const dir = workspace({ git: true });
    const r = run(['refactor', 'rename-service', 'billing', 'payments', '--dry-run', '--json'], dir);
    expect(r.status, r.stdout).toBe(0);
    expect(jsonResponseSchema(refactorRenameServiceResponseSchema).safeParse(r.json).success).toBe(true);
    expect(r.json.data.applied).toBe(false);
    expect(r.json.data.diff).toContain('rename from services/billing');
    expect(r.json.data.diff).toContain('+      PAYMENTS_URL: http://payments:8081');
    expect(fs.existsSync(path.join(dir, 'services/billing'))).toBe(true);
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' })).toBe('');
  });

  it('applies the rename for real (git mv) and the workspace still validates', () => {
    const dir = workspace({ git: true });
    const r = run(['refactor', 'rename-service', 'billing', 'payments', '--json'], dir);
    expect(r.status, r.stdout).toBe(0);
    expect(r.json.data).toMatchObject({ applied: true, git: { inRepo: true, moved: 'git-mv' } });
    expect(fs.existsSync(path.join(dir, 'services/payments/pom.xml'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'services/billing'))).toBe(false);
    expect(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' })).toMatch(/^R/m);
    // the CLI itself can load the renamed workspace
    const dbg = run(['debug', 'config', '--dry-run', '--json', '--services', 'payments'], dir);
    expect(dbg.status, dbg.stdout).toBe(0);
    expect(dbg.json.data.services[0].name).toBe('payments');
  });

  it('REFACTOR_DIRTY_TREE without --force, success with it', () => {
    const dir = workspace({ git: true });
    fs.writeFileSync(path.join(dir, 'wip.txt'), 'x');
    const refused = run(['refactor', 'rename-service', 'billing', 'payments', '--json'], dir);
    expect(refused.status).toBe(1);
    expect(refused.json.error.code).toBe('REFACTOR_DIRTY_TREE');
    expect(fs.existsSync(path.join(dir, 'services/billing'))).toBe(true);
    const forced = run(['refactor', 'rename-service', 'billing', 'payments', '--force', '--json'], dir);
    expect(forced.status).toBe(0);
    expect(forced.json.data.applied).toBe(true);
  });

  it('REFACTOR_NAME_COLLISION / SERVICE_NOT_FOUND / INVALID_NAME codes', () => {
    const dir = workspace();
    expect(run(['refactor', 'rename-service', 'billing', 'api', '--json'], dir).json.error.code).toBe('REFACTOR_NAME_COLLISION');
    expect(run(['refactor', 'rename-service', 'ghost', 'phantom', '--json'], dir).json.error.code).toBe('REFACTOR_SERVICE_NOT_FOUND');
    expect(run(['refactor', 'rename-service', 'billing', 'Not_Valid', '--json'], dir).json.error.code).toBe('REFACTOR_INVALID_NAME');
    const empty = fs.mkdtempSync(path.join(SCRATCH, 'empty-'));
    expect(run(['refactor', 'rename-service', 'a', 'b', '--json'], empty).json.error.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('human dry run prints the diff and exits 0; human errors exit 1', () => {
    const dir = workspace();
    const ok = run(['refactor', 'rename-service', 'analytics', 'insights', '--dry-run'], dir);
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('Dry run: no files were changed.');
    expect(ok.stdout).toContain('+  insights:');
    const bad = run(['refactor', 'rename-service', 'analytics', 'api'], dir);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('REFACTOR_NAME_COLLISION');
  });
});
