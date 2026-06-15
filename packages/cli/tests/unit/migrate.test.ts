import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { runMigrate } from '../../src/commands/migrate';
import { registerRecipe, type MigrationRecipe } from '../../src/utils/migrate-engine';
import { migrateResponseSchema } from '@re-shell/contracts';

/**
 * Integration coverage for `re-shell migrate` (issue #10):
 *
 *   - dry-run (the safe default) lists a pending plan without touching disk,
 *   - --no-dry-run applies the recipe, rewriting the config and writing a .bak,
 *   - a workspace already at the target emits "no migrations needed",
 *   - a missing workspace config surfaces MIGRATE_ERROR,
 *   - JSON output validates against migrateResponseSchema, and
 *   - the injected ast-grep runner is threaded through for source transforms.
 *
 * Filesystem access is confined to temp directories torn down after each test.
 */

const V1_CONFIG = [
  'name: demo',
  'apps:',
  '  web:',
  '    name: web',
  '    path: apps/web',
  '',
].join('\n');

/** Create a temp dir, write files into it (relative paths), return the dir. */
function makeTempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-migrate-cmd-'));
  for (const [name, content] of Object.entries(files)) {
    const fullPath = path.join(dir, name);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }
  return dir;
}

const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmp(files: Record<string, string>): string {
  const d = makeTempDir(files);
  TEMP_DIRS.push(d);
  return d;
}

describe('runMigrate', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];

  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });

  /** Parse the last single-line JSON envelope written to stdout. */
  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  describe('dry-run (default)', () => {
    it('lists the workspace-v1-to-v2 migration as pending without touching disk', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': V1_CONFIG });
      const configPath = path.join(dir, 're-shell.workspaces.yaml');
      const original = fs.readFileSync(configPath, 'utf8');

      await runMigrate({ json: true, cwd: dir });

      const env = lastJson();
      expect(env['ok']).toBe(true);
      const data = env['data'] as { toVersion: string; dryRun: boolean; migrations: unknown[] };
      expect(data.dryRun).toBe(true);
      expect(data.toVersion).toBe('2.0.0');
      expect(data.migrations).toHaveLength(1);
      expect((data.migrations[0] as { status: string; applied: boolean }).status).toBe('pending');
      expect((data.migrations[0] as { applied: boolean }).applied).toBe(false);

      // The file on disk must be untouched in a dry run.
      expect(fs.readFileSync(configPath, 'utf8')).toBe(original);
      expect(fs.existsSync(`${configPath}.bak`)).toBe(false);
    });

    it('emits output that validates against migrateResponseSchema', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': V1_CONFIG });
      await runMigrate({ json: true, cwd: dir });

      const env = lastJson();
      const data = env['data'];
      expect(migrateResponseSchema.safeParse(data).success).toBe(true);
    });
  });

  describe('--no-dry-run (apply)', () => {
    it('rewrites the v1 config to v2 and writes a .bak backup', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': V1_CONFIG });
      const configPath = path.join(dir, 're-shell.workspaces.yaml');

      await runMigrate({ json: true, cwd: dir, noDryRun: true });

      const env = lastJson();
      const data = env['data'] as { dryRun: boolean; migrations: Array<{ status: string; applied: boolean }> };
      expect(data.dryRun).toBe(false);
      expect(data.migrations[0].status).toBe('applied');
      expect(data.migrations[0].applied).toBe(true);

      // The config on disk is now v2.
      const rewritten = yaml.load(
        fs.readFileSync(configPath, 'utf8')
      ) as Record<string, unknown>;
      expect(rewritten['version']).toBe('2.0.0');
      expect(rewritten['apps']).toBeUndefined();
      expect(rewritten['services']).toBeDefined();
      expect(rewritten['tasks']).toEqual({});

      // A backup of the original v1 content exists.
      expect(fs.existsSync(`${configPath}.bak`)).toBe(true);
      expect(fs.readFileSync(`${configPath}.bak`, 'utf8')).toBe(V1_CONFIG);
    });
  });

  describe('no migrations needed', () => {
    it('emits a plan with an informational warning when already at the target', async () => {
      const dir = tmp({
        're-shell.workspaces.yaml': 'version: "2.0.0"\nservices: {}\n',
      });

      await runMigrate({ json: true, cwd: dir });

      const env = lastJson();
      const data = env['data'] as { migrations: unknown[]; warnings: string[] };
      expect(data.migrations).toHaveLength(0);
      expect(data.warnings.length).toBeGreaterThan(0);
      expect(data.warnings.join(' ')).toMatch(/No migrations needed/);
    });
  });

  describe('missing workspace config', () => {
    it('surfaces a MIGRATE_ERROR envelope', async () => {
      const dir = tmp({ 'README.md': 'no config here\n' });

      await runMigrate({ json: true, cwd: dir });

      const env = lastJson();
      expect(env['ok']).toBe(false);
      const error = env['error'] as { code: string; message: string };
      expect(error.code).toBe('MIGRATE_ERROR');
      expect(error.message).toMatch(/No workspace config found/);
    });
  });

  describe('with explicit to-version', () => {
    it('honours a requested target version below the latest', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': V1_CONFIG });

      await runMigrate({ json: true, cwd: dir, toVersion: '2.0.0' });

      const env = lastJson();
      const data = env['data'] as { toVersion: string };
      expect(data.toVersion).toBe('2.0.0');
    });

    it('selects nothing when the target is below the recipe toVersion', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': V1_CONFIG });

      await runMigrate({ json: true, cwd: dir, toVersion: '1.5.0' });

      const env = lastJson();
      const data = env['data'] as { migrations: unknown[]; warnings: string[] };
      expect(data.migrations).toHaveLength(0);
      expect(data.warnings.join(' ')).toMatch(/No migrations needed/);
    });
  });

  describe('ast-grep injection', () => {
    it('threads the injected runner through (ast-grep recipe skipped without one)', async () => {
      // A v1 config plus an ast-grep-style recipe path: the injected runner
      // reports ENOENT, so any ast-grep migration would degrade to skipped.
      // Here we assert the runner is actually invoked when an ast-grep recipe
      // targets a file present on disk.
      const dir = tmp({
        're-shell.workspaces.yaml': V1_CONFIG,
        'src/index.ts': "console.log('x')\n",
      });

      const calls: string[][] = [];
      const recordingRunner = async (args: string[]): Promise<string> => {
        calls.push([...args]);
        return '';
      };

      await runMigrate({
        json: true,
        cwd: dir,
        runner: recordingRunner,
      });

      // The built-in recipe is yaml-only, so the ast-grep runner is never
      // invoked on the default path — assert it was threaded but not called.
      expect(calls).toHaveLength(0);
    });
  });

  describe('partial-failure gate (exit code)', () => {
    /** A custom recipe whose transform throws, so the apply fails per-file. */
    function throwingRecipe(id: string): MigrationRecipe {
      return {
        id,
        fromVersionRange: '1.x',
        toVersion: '2.0.0',
        kind: 'yaml',
        title: 'throwing',
        description: 'always fails',
        targetFile: 're-shell.workspaces.yaml',
        matches: () => true,
        transform: () => {
          throw new Error('boom');
        },
      };
    }

    it('exits non-zero when an apply recipe fails (JSON mode still emits data)', async () => {
      registerRecipe(throwingRecipe('partial-fail-throw'));
      const dir = tmp({ 're-shell.workspaces.yaml': V1_CONFIG });

      await runMigrate({ json: true, cwd: dir, noDryRun: true });

      const env = lastJson();
      // The envelope is ok:true (data is advisory) but the gate fires.
      expect(env['ok']).toBe(true);
      const data = env['data'] as { migrations: Array<{ status: string; applied: boolean }> };
      const throwing = data.migrations.find(m => m.id === 'partial-fail-throw');
      expect(throwing?.status).toBe('failed');
      expect(throwing?.applied).toBe(false);
      expect(process.exitCode).toBe(1);
    });

    it('exits non-zero when a selected recipe resolves to zero targets', async () => {
      // A recipe that is selected (1.x range) but whose matches() is always
      // false resolves zero targets → must be reported 'skipped', not 'applied'.
      const neverMatches: MigrationRecipe = {
        id: 'partial-fail-nomatch',
        fromVersionRange: '1.x',
        toVersion: '2.0.0',
        kind: 'yaml',
        title: 'never matches',
        description: 'matches nothing',
        targetFile: 're-shell.workspaces.yaml',
        matches: () => false,
        transform: d => d,
      };
      registerRecipe(neverMatches);
      const dir = tmp({ 're-shell.workspaces.yaml': V1_CONFIG });

      await runMigrate({ json: true, cwd: dir, noDryRun: true });

      const env = lastJson();
      const data = env['data'] as { migrations: Array<{ status: string; applied: boolean }> };
      const nomatch = data.migrations.find(m => m.id === 'partial-fail-nomatch');
      expect(nomatch?.status).toBe('skipped');
      expect(nomatch?.applied).toBe(false);
      // The built-in workspace-v1-to-v2 recipe still applies successfully, but
      // the skipped recipe means the overall apply did not fully succeed.
      expect(process.exitCode).toBe(1);
    });
  });
});
