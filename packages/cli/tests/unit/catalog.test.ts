import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runCatalog } from '../../src/commands/catalog';
import { catalogResponseSchema } from '@re-shell/contracts';

/**
 * Integration coverage for `re-shell catalog` + `re-shell catalog sync`
 * (issue #11): model emission, schema conformance, sync dry-run/apply, and the
 * CATALOG_ERROR path. Filesystem access is confined to temp dirs torn down
 * after each test.
 */

const WORKSPACE_CONFIG = [
  'name: demo',
  'version: "2.0.0"',
  'services:',
  '  api:',
  '    name: api',
  '    language: typescript',
  '    framework: express',
  '    path: services/api',
  '    port: 3000',
  '    type: backend',
  '    metadata:',
  '      owner: team-payments',
  '      lifecycle: production',
  '  worker:',
  '    name: worker',
  '    language: typescript',
  '    framework: bullmq',
  '    path: services/worker',
  '    type: worker',
  '',
].join('\n');

/** Create a temp dir, write files into it (relative paths), return the dir. */
function makeTempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-catalog-cmd-'));
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

describe('runCatalog', () => {
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

  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  describe('catalog (default view)', () => {
    it('emits a catalog with components, apis, groups, and a system', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG });
      await runCatalog({ json: true, cwd: dir });

      const env = lastJson();
      expect(env['ok']).toBe(true);
      const data = env['data'] as { system: string; counts: Record<string, number>; entities: unknown[]; dryRun: boolean; files: unknown[] };
      // api (port 3000) → 1 component + 1 api; worker → 1 component (no port).
      expect(data.counts.components).toBe(2);
      expect(data.counts.apis).toBe(1);
      expect(data.counts.groups).toBeGreaterThanOrEqual(1);
      expect(data.counts.systems).toBe(1);
      expect(data.system).toBe('demo');
      // Default view is a dry run: no files written.
      expect(data.dryRun).toBe(true);
      expect(data.files).toHaveLength(0);
    });

    it('emits output that validates against catalogResponseSchema', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG });
      await runCatalog({ json: true, cwd: dir });
      const env = lastJson();
      expect(catalogResponseSchema.safeParse(env['data']).success).toBe(true);
    });

    it('maps the declared owner onto the API + Component entities', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG });
      await runCatalog({ json: true, cwd: dir });
      const data = lastJson().data as { entities: Array<{ kind: string; metadata: { name: string }; spec: { owner: string } }> };
      const api = data.entities.find(e => e.kind === 'API')!;
      expect(api.spec.owner).toBe('team-payments');
      const comp = data.entities.find(e => e.metadata.name === 'api')!;
      expect(comp.spec.owner).toBe('team-payments');
    });
  });

  describe('catalog sync', () => {
    it('dry-run lists the files it would write without touching disk', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG });
      await runCatalog({ json: true, cwd: dir, sync: true });

      const data = lastJson().data as { dryRun: boolean; files: Array<{ path: string; written: boolean }> };
      expect(data.dryRun).toBe(true);
      expect(data.files.length).toBeGreaterThan(0);
      expect(data.files.every(f => f.written === false)).toBe(true);
      // Nothing was written to disk.
      expect(fs.existsSync(path.join(dir, 'catalog'))).toBe(false);
    });

    it('--no-dry-run writes catalog-info.yaml files under catalog/', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG });
      await runCatalog({ json: true, cwd: dir, sync: true, noDryRun: true });

      const data = lastJson().data as { dryRun: boolean; files: Array<{ path: string; kind: string; name: string; written: boolean }> };
      expect(data.dryRun).toBe(false);
      expect(data.files.every(f => f.written === true)).toBe(true);

      // Spot-check a Component file landed on disk and is valid YAML.
      const componentFile = data.files.find(f => f.kind === 'Component');
      expect(componentFile).toBeDefined();
      const abs = path.join(dir, componentFile!.path);
      expect(fs.existsSync(abs)).toBe(true);
      const yaml = require('js-yaml');
      const parsed = yaml.load(fs.readFileSync(abs, 'utf8'));
      expect(parsed.apiVersion).toBe('backstage.io/v1alpha1');
      expect(parsed.kind).toBe('Component');
    });

    it('is idempotent: re-running sync produces the same files', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG });
      await runCatalog({ json: true, cwd: dir, sync: true, noDryRun: true });
      const first = (lastJson().data as { files: Array<{ path: string }> }).files.map(f => f.path).sort();

      await runCatalog({ json: true, cwd: dir, sync: true, noDryRun: true });
      const second = (lastJson().data as { files: Array<{ path: string }> }).files.map(f => f.path).sort();

      expect(second).toEqual(first);
    });

    it('prunes orphaned files when a service is removed from the graph', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG });
      // First sync writes the api + worker components + api-api.
      await runCatalog({ json: true, cwd: dir, sync: true, noDryRun: true });

      // Remove the api service (which had a port → an API entity too).
      const reduced = WORKSPACE_CONFIG.replace(/(^|\n)  api:[\s\S]*?(?=\n  worker:)/, '\n');
      fs.writeFileSync(path.join(dir, 're-shell.workspaces.yaml'), reduced, 'utf8');

      await runCatalog({ json: true, cwd: dir, sync: true, noDryRun: true });
      // The api component + api-api files must be pruned from disk.
      expect(fs.existsSync(path.join(dir, 'catalog/components/api.yaml'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'catalog/apis/api-api.yaml'))).toBe(false);
      // The worker component survives.
      expect(fs.existsSync(path.join(dir, 'catalog/components/worker.yaml'))).toBe(true);
    });

    it('degrades gracefully when apps/ is a regular file (no ENOTDIR crash)', async () => {
      const dir = tmp({ 're-shell.workspaces.yaml': WORKSPACE_CONFIG, apps: 'not a directory' });
      // Must not throw; the catalog still builds from services alone.
      await runCatalog({ json: true, cwd: dir });
      const env = lastJson();
      expect(env['ok']).toBe(true);
    });
  });

  describe('missing workspace config', () => {
    it('surfaces a CATALOG_ERROR envelope', async () => {
      const dir = tmp({ 'README.md': 'no config\n' });
      await runCatalog({ json: true, cwd: dir });

      const env = lastJson();
      expect(env['ok']).toBe(false);
      const error = env['error'] as { code: string; message: string };
      expect(error.code).toBe('CATALOG_ERROR');
      expect(error.message).toMatch(/No workspace config found/);
    });
  });
});
