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
});
