import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  computeBackendDryRun,
  isBackendTemplate,
} from '../../src/utils/template-dry-run';

describe('isBackendTemplate', () => {
  it('recognizes registry ids and rejects unknown ones', () => {
    expect(isBackendTemplate('express')).toBe(true);
    expect(isBackendTemplate('fastify')).toBe(true);
    expect(isBackendTemplate('definitely-not-a-template')).toBe(false);
  });
});

describe('computeBackendDryRun', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dryrun-unit-'));
  });

  afterEach(async () => {
    await fs.remove(workDir);
  });

  it('lists the file set a backend scaffold would produce', async () => {
    const result = await computeBackendDryRun('express', { projectName: 'my-svc' });
    expect(result.templateId).toBe('express');
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.every(f => f.action === 'create')).toBe(true);
    expect(result.files.every(f => f.bytes > 0)).toBe(true);
    expect(result.totalBytes).toBeGreaterThan(0);
    // Every listed file should have a preview entry.
    for (const file of result.files) {
      expect(result.previews).toHaveProperty(file.path);
    }
  });

  it('substitutes the project name into placeholders', async () => {
    const result = await computeBackendDryRun('express', { projectName: 'acme-api' });
    const pkg = result.previews['package.json'];
    expect(pkg).toContain('acme-api');
    expect(pkg).not.toContain('{{projectName}}');
  });

  it('writes NOTHING to a caller-owned directory', async () => {
    const before = await fs.readdir(workDir);
    await computeBackendDryRun('express', { projectName: 'my-svc' });
    const after = await fs.readdir(workDir);
    // The directory the caller cares about is untouched.
    expect(after).toEqual(before);
    expect(before).toEqual([]);
    // No scaffold target was created.
    expect(fs.existsSync(path.join(workDir, 'my-svc'))).toBe(false);
    expect(fs.existsSync(path.join(workDir, 'package.json'))).toBe(false);
  });

  it('throws for an unknown template id', async () => {
    await expect(
      computeBackendDryRun('nope-xyz', { projectName: 'x' })
    ).rejects.toThrow(/Template not found/);
  });

  it('returns a sorted, de-duplicated file list', async () => {
    const result = await computeBackendDryRun('express', { projectName: 'my-svc' });
    const paths = result.files.map(f => f.path);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('marks every file added (and the target as absent) for a clean-slate dry run', async () => {
    const result = await computeBackendDryRun('express', { projectName: 'my-svc' });
    expect(result.targetExists).toBe(false);
    expect(result.files.every(f => f.status === 'added' && f.action === 'create')).toBe(true);
    expect(result.summary.added).toBe(result.files.length);
    expect(result.summary.modified + result.summary.unchanged).toBe(0);
  });

  it('flattens nested template file trees instead of printing [object Object]', async () => {
    // django keeps its settings under nested directories; the dry run must list real files.
    const result = await computeBackendDryRun('django', { projectName: 'dj' });
    expect(result.files.some(f => f.path.includes('/'))).toBe(true);
    for (const preview of Object.values(result.previews)) {
      expect(preview).not.toContain('[object Object]');
    }
  });

  it('uses the template port when none is given and honours an explicit one', async () => {
    // grpc-service renders {{port}} into its README / client code (its own port is 5000).
    const read = async (port?: string) => {
      const result = await computeBackendDryRun('grpc-service', {
        projectName: 'p',
        port,
        previewLimit: 10_000_000,
      });
      return Object.values(result.previews).join('\n');
    };
    const byTemplate = await read();
    const explicit = await read('4999');
    expect(byTemplate).toContain('localhost:5000');
    expect(byTemplate).not.toContain('{{port}}');
    expect(explicit).toContain('localhost:4999');
    expect(explicit).not.toContain('{{port}}');
  });

  describe('against an existing target directory', () => {
    it('classifies each file as added, modified or unchanged and diffs the modified ones', async () => {
      const fresh = await computeBackendDryRun('express', { projectName: 'my-svc' });
      const target = path.join(workDir, 'existing');

      // Reproduce the real scaffold on disk: every previewed file is written in full...
      const full = await computeBackendDryRun('express', { projectName: 'my-svc', previewLimit: 10_000_000 });
      for (const file of fresh.files) {
        await fs.outputFile(path.join(target, file.path), full.previews[file.path]);
      }
      // ...then one file is edited and one is removed.
      const pkgPath = path.join(target, 'package.json');
      await fs.writeFile(pkgPath, (await fs.readFile(pkgPath, 'utf8')).replace('my-svc', 'edited-name'));
      const removed = fresh.files.find(f => f.path !== 'package.json')!;
      await fs.remove(path.join(target, removed.path));

      const result = await computeBackendDryRun('express', {
        projectName: 'my-svc',
        targetDir: target,
      });

      expect(result.targetExists).toBe(true);
      const byPath = Object.fromEntries(result.files.map(f => [f.path, f]));
      expect(byPath['package.json']).toMatchObject({ status: 'modified', action: 'overwrite' });
      expect(byPath['package.json'].diff).toContain('-');
      expect(byPath['package.json'].diff).toContain('edited-name');
      expect(byPath['package.json'].diff).toContain('+');
      expect(byPath[removed.path]).toMatchObject({ status: 'added', action: 'create' });
      expect(result.summary).toEqual({
        added: 1,
        modified: 1,
        unchanged: fresh.files.length - 2,
      });
      // Nothing was written by the dry run.
      expect((await fs.readFile(pkgPath, 'utf8'))).toContain('edited-name');
      expect(await fs.pathExists(path.join(target, removed.path))).toBe(false);
    });

    it('treats a missing target directory as a clean slate', async () => {
      const result = await computeBackendDryRun('express', {
        projectName: 'my-svc',
        targetDir: path.join(workDir, 'does-not-exist'),
      });
      expect(result.targetExists).toBe(false);
      expect(result.summary.added).toBe(result.files.length);
    });
  });
});
