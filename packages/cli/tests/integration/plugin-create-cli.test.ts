import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPluginCommand, validatePublish } from '../../src/commands/plugin-create';

let tmpDir: string;
let origCwd: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
});

afterEach(async () => {
  process.chdir(origCwd);
  await fs.remove(tmpDir);
});

describe('createPluginCommand (non-interactive)', () => {
  it('creates plugin directory with all files', async () => {
    await createPluginCommand('reshell-plugin-test', {
      noInteractive: true,
      description: 'Test plugin',
      author: 'Test',
      license: 'MIT',
      type: 'both',
      hooks: 'build:start,build:end',
      commands: 'db:migrate',
      permissions: 'filesystem:read',
      framework: 'universal',
      tests: true,
      ci: true,
      json: false,
    });

    const pluginDir = path.join(tmpDir, 'reshell-plugin-test');
    expect(await fs.pathExists(pluginDir)).toBe(true);
    expect(await fs.pathExists(path.join(pluginDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(pluginDir, 'src', 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(pluginDir, 'src', 'types.ts'))).toBe(true);
  });

  it('throws on existing directory without force', async () => {
    await createPluginCommand('reshell-plugin-test', {
      noInteractive: true,
      description: 'Test',
      author: 'Test',
      license: 'MIT',
      type: 'hooks',
      hooks: '',
      commands: '',
      permissions: '',
      framework: 'universal',
      tests: false,
      ci: false,
      json: false,
    });

    await expect(
      createPluginCommand('reshell-plugin-test', {
        noInteractive: true,
        description: 'Test',
        author: 'Test',
        license: 'MIT',
        type: 'hooks',
        hooks: '',
        commands: '',
        permissions: '',
        framework: 'universal',
        tests: false,
        ci: false,
        json: false,
      })
    ).rejects.toThrow(/already exists/);
  });

  it('does NOT write files with --dry-run', async () => {
    await createPluginCommand('reshell-plugin-test', {
      noInteractive: true,
      description: 'Test',
      author: 'Test',
      license: 'MIT',
      type: 'hooks',
      hooks: 'build:start',
      commands: '',
      permissions: '',
      framework: 'universal',
      tests: false,
      ci: false,
      json: false,
      dryRun: true,
    });

    const pluginDir = path.join(tmpDir, 'reshell-plugin-test');
    expect(await fs.pathExists(pluginDir)).toBe(false);
  });
});

describe('validatePublish', () => {
  it('returns valid=true for a scaffolded plugin', async () => {
    // First scaffold a plugin
    await createPluginCommand('reshell-plugin-test', {
      noInteractive: true,
      description: 'Test plugin',
      author: 'Test',
      license: 'MIT',
      type: 'both',
      hooks: 'build:start',
      commands: 'db:migrate',
      permissions: 'filesystem:read',
      framework: 'universal',
      tests: true,
      ci: true,
      json: false,
    });

    const pluginDir = path.join(tmpDir, 'reshell-plugin-test');
    const result = await validatePublish(pluginDir, { json: false });
    expect(result.valid).toBe(true);
  });
});
