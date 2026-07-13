import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  scaffold,
  toFunctionName,
  permissionToObject,
  type PluginScaffoldConfig,
} from '../../src/utils/plugin-scaffolder';

function makeConfig(overrides: Partial<PluginScaffoldConfig> = {}): PluginScaffoldConfig {
  return {
    name: 'reshell-plugin-test',
    displayName: 'reshell-plugin-test',
    description: 'Test plugin',
    author: 'Test Author',
    license: 'MIT',
    pluginType: 'both',
    hooks: ['build:start', 'build:end'],
    commands: ['db:migrate'],
    permissions: ['filesystem:read', 'network'],
    frameworkTarget: 'universal',
    includeTests: true,
    includeCI: true,
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
});

afterEach(async () => {
  await fs.remove(tmpDir);
});

describe('toFunctionName', () => {
  it('converts colon-separated to camelCase', () => {
    expect(toFunctionName('db:migrate')).toBe('dbMigrate');
  });
  it('converts hyphen-separated to camelCase', () => {
    expect(toFunctionName('cache:clear-all')).toBe('cacheClearAll');
  });
  it('handles single word', () => {
    expect(toFunctionName('build')).toBe('build');
  });
});

describe('permissionToObject', () => {
  it('converts filesystem:read', () => {
    expect(permissionToObject('filesystem:read')).toEqual({
      type: 'filesystem', access: 'read', description: 'Read access to filesystem',
    });
  });
  it('converts network to full access', () => {
    expect(permissionToObject('network')).toEqual({
      type: 'network', access: 'full', description: 'Full network access',
    });
  });
});

describe('scaffold', () => {
  it('generates all expected files with full config', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir);
    expect(result.dryRun).toBe(false);
    const filePaths = result.files.map(f => f.path);
    expect(filePaths).toContain('package.json');
    expect(filePaths).toContain('src/index.ts');
    expect(filePaths).toContain('src/types.ts');
    expect(filePaths).toContain('src/hooks.ts');
    expect(filePaths).toContain('src/commands.ts');
    expect(filePaths).toContain('tsconfig.json');
    expect(filePaths).toContain('.gitignore');
    expect(filePaths).toContain('.npmignore');
    expect(filePaths).toContain('README.md');
    expect(filePaths).toContain('LICENSE');
    expect(filePaths).toContain('tests/index.test.ts');
    expect(filePaths).toContain('.github/workflows/ci.yml');
  });

  it('does NOT generate hooks.ts when hooks is empty', async () => {
    const config = makeConfig({ hooks: [], pluginType: 'commands' });
    const result = await scaffold(config, tmpDir);
    const filePaths = result.files.map(f => f.path);
    expect(filePaths).not.toContain('src/hooks.ts');
  });

  it('does NOT generate commands.ts when commands is empty', async () => {
    const config = makeConfig({ commands: [], pluginType: 'hooks' });
    const result = await scaffold(config, tmpDir);
    const filePaths = result.files.map(f => f.path);
    expect(filePaths).not.toContain('src/commands.ts');
  });

  it('does NOT generate tests when includeTests is false', async () => {
    const config = makeConfig({ includeTests: false });
    const result = await scaffold(config, tmpDir);
    const filePaths = result.files.map(f => f.path);
    expect(filePaths).not.toContain('tests/index.test.ts');
  });

  it('does NOT generate CI when includeCI is false', async () => {
    const config = makeConfig({ includeCI: false });
    const result = await scaffold(config, tmpDir);
    const filePaths = result.files.map(f => f.path);
    expect(filePaths).not.toContain('.github/workflows/ci.yml');
  });

  it('package.json has reshell-plugin keyword', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir);
    const pkgFile = result.files.find(f => f.path === 'package.json')!;
    const pkg = JSON.parse(pkgFile.content);
    expect(pkg.keywords).toContain('reshell-plugin');
  });

  it('package.json has engines.reshell-cli', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir);
    const pkgFile = result.files.find(f => f.path === 'package.json')!;
    const pkg = JSON.parse(pkgFile.content);
    expect(pkg.engines['reshell-cli']).toBeDefined();
  });

  it('package.json reshell.permissions uses PluginPermission objects', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir);
    const pkgFile = result.files.find(f => f.path === 'package.json')!;
    const pkg = JSON.parse(pkgFile.content);
    expect(pkg.reshell.permissions[0]).toEqual({
      type: 'filesystem', access: 'read', description: 'Read access to filesystem',
    });
  });

  it('package.json reshell.hooks contains selected hooks', async () => {
    const config = makeConfig({ hooks: ['build:start', 'build:end'] });
    const result = await scaffold(config, tmpDir);
    const pkgFile = result.files.find(f => f.path === 'package.json')!;
    const pkg = JSON.parse(pkgFile.content);
    expect(pkg.reshell.hooks).toEqual(['build:start', 'build:end']);
  });

  it('LICENSE contains MIT text for MIT license', async () => {
    const config = makeConfig({ license: 'MIT' });
    const result = await scaffold(config, tmpDir);
    const licenseFile = result.files.find(f => f.path === 'LICENSE')!;
    expect(licenseFile.content).toContain('MIT License');
  });

  it('LICENSE contains Apache for Apache-2.0', async () => {
    const config = makeConfig({ license: 'Apache-2.0' });
    const result = await scaffold(config, tmpDir);
    const licenseFile = result.files.find(f => f.path === 'LICENSE')!;
    expect(licenseFile.content).toContain('Apache License');
  });

  it('src/index.ts has activate and deactivate', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir);
    const indexFile = result.files.find(f => f.path === 'src/index.ts')!;
    expect(indexFile.content).toContain('activate');
    expect(indexFile.content).toContain('deactivate');
  });

  it('src/types.ts is always generated', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir);
    const typesFile = result.files.find(f => f.path === 'src/types.ts')!;
    expect(typesFile.content).toContain('export interface Plugin');
    expect(typesFile.content).toContain('export interface PluginContext');
  });

  it('src/hooks.ts has function stubs for selected hooks', async () => {
    const config = makeConfig({ hooks: ['build:start', 'build:end'] });
    const result = await scaffold(config, tmpDir);
    const hooksFile = result.files.find(f => f.path === 'src/hooks.ts')!;
    expect(hooksFile.content).toContain('buildStart');
    expect(hooksFile.content).toContain('buildEnd');
  });

  it('src/commands.ts has function stubs for commands', async () => {
    const config = makeConfig({ commands: ['db:migrate', 'db:seed'] });
    const result = await scaffold(config, tmpDir);
    const cmdsFile = result.files.find(f => f.path === 'src/commands.ts')!;
    expect(cmdsFile.content).toContain('dbMigrate');
    expect(cmdsFile.content).toContain('dbSeed');
  });

  it('writes files to disk in non-dry-run mode', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir);
    const indexPath = path.join(tmpDir, config.name, 'src', 'index.ts');
    expect(await fs.pathExists(indexPath)).toBe(true);
  });

  it('does NOT write to disk in dry-run mode', async () => {
    const config = makeConfig();
    const result = await scaffold(config, tmpDir, { dryRun: true });
    expect(result.dryRun).toBe(true);
    const indexPath = path.join(tmpDir, config.name, 'src', 'index.ts');
    expect(await fs.pathExists(indexPath)).toBe(false);
  });

  it('throws when directory exists without force', async () => {
    const config = makeConfig();
    await fs.ensureDir(path.join(tmpDir, config.name));
    await expect(scaffold(config, tmpDir)).rejects.toThrow(/already exists/);
  });

  it('overwrites when force is true', async () => {
    const config = makeConfig();
    await fs.ensureDir(path.join(tmpDir, config.name));
    const result = await scaffold(config, tmpDir, { force: true });
    expect(result.files.length).toBeGreaterThan(0);
  });
});
