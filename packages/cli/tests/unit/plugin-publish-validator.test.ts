import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validatePluginForPublish } from '../../src/utils/plugin-publish-validator';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pubval-test-'));
});

afterEach(async () => {
  await fs.remove(tmpDir);
});

async function writePlugin(overrides: Record<string, unknown> = {}): Promise<string> {
  const pkg: Record<string, unknown> = {
    name: 'reshell-plugin-test',
    version: '1.0.0',
    description: 'A test plugin',
    main: 'src/index.ts',
    keywords: ['reshell-plugin'],
    engines: { 'reshell-cli': '>=0.30.0' },
    reshell: {
      hooks: ['build:start'],
      commands: ['db:migrate'],
      permissions: [
        { type: 'filesystem', access: 'read', description: 'Read access' },
      ],
    },
    ...overrides,
  };
  await fs.writeJSON(path.join(tmpDir, 'package.json'), pkg);
  await fs.ensureDir(path.join(tmpDir, 'src'));
  await fs.writeFile(
    path.join(tmpDir, 'src', 'index.ts'),
    'export const plugin = { activate() {}, deactivate() {} };'
  );
  return tmpDir;
}

describe('validatePluginForPublish', () => {
  it('returns valid=true for a complete plugin', async () => {
    const pluginPath = await writePlugin();
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns error when package.json is missing', async () => {
    const result = await validatePluginForPublish(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'manifest:found')).toBe(true);
  });

  it('returns error when name is invalid', async () => {
    const pluginPath = await writePlugin({ name: 'Bad Name' });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'manifest:name-valid')).toBe(true);
  });

  it('returns error when reshell-plugin keyword is missing', async () => {
    const pluginPath = await writePlugin({ keywords: ['other'] });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'manifest:keyword')).toBe(true);
  });

  it('returns error when main entry point file does not exist', async () => {
    const pluginPath = await writePlugin({ main: 'src/nonexistent.ts' });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'entry:exists')).toBe(true);
  });

  it('returns error when entry point does not export activate', async () => {
    const pluginPath = await writePlugin();
    await fs.writeFile(
      path.join(tmpDir, 'src', 'index.ts'),
      'export const something = 42;'
    );
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'entry:activate')).toBe(true);
  });

  it('returns error for invalid hook name', async () => {
    const pluginPath = await writePlugin({
      reshell: { hooks: ['before-build'], permissions: [] },
    });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'hooks:valid')).toBe(true);
  });

  it('passes for valid hook names', async () => {
    const pluginPath = await writePlugin({
      reshell: { hooks: ['build:start', 'command:before'], permissions: [] },
    });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.errors.some(e => e.name === 'hooks:valid')).toBe(false);
  });

  it('returns error for invalid permission type', async () => {
    const pluginPath = await writePlugin({
      reshell: {
        hooks: [],
        permissions: [{ type: 'superuser', access: 'full', description: 'x' }],
      },
    });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'permissions:valid')).toBe(true);
  });

  it('returns error when description is empty', async () => {
    const pluginPath = await writePlugin({ description: '' });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'manifest:description')).toBe(true);
  });

  it('returns error when engines.reshell-cli is missing', async () => {
    const pluginPath = await writePlugin({ engines: {} });
    const result = await validatePluginForPublish(pluginPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.name === 'engines:reshell-cli')).toBe(true);
  });

  it('returns warning when LICENSE is missing', async () => {
    const pluginPath = await writePlugin();
    const result = await validatePluginForPublish(pluginPath);
    expect(result.warnings.some(w => w.name === 'files:license')).toBe(true);
  });

  it('returns warning when README.md is missing', async () => {
    const pluginPath = await writePlugin();
    const result = await validatePluginForPublish(pluginPath);
    expect(result.warnings.some(w => w.name === 'files:readme')).toBe(true);
  });
});
