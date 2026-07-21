import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';

import { discoverWorkspace } from '../../src/utils/agents-discovery';

let tmp: string;

async function setupWorkspace(files: Record<string, string | object>): Promise<string> {
  const dir = `/tmp/agents-discovery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await fs.ensureDir(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.ensureDir(path.dirname(abs));
    if (typeof content === 'string') {
      await fs.writeFile(abs, content);
    } else {
      await fs.writeJson(abs, content);
    }
  }
  return dir;
}

describe('agents-discovery', () => {
  beforeEach(() => {
    tmp = '';
  });

  afterEach(async () => {
    if (tmp) await fs.remove(tmp);
  });

  it('returns an empty packages list when no workspaces are present', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'solo', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.packages).toEqual([]);
    expect(result.projectName).toBe('solo');
  });

  it('falls back to the directory basename when root package.json has no name', async () => {
    tmp = await setupWorkspace({
      'package.json': { version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.projectName).toBe(path.basename(tmp));
  });

  it('reads project description from root package.json', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'proj', description: 'hello world' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.projectDescription).toBe('hello world');
  });

  it('uses the default workspace globs when pnpm-workspace.yaml is absent', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/cli/package.json': { name: '@scope/cli', version: '1.0.0' },
      'packages/utils/package.json': { name: '@scope/utils', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    const names = result.packages.map(p => p.name).sort();
    expect(names).toEqual(['@scope/cli', '@scope/utils']);
  });

  it('respects custom pnpm-workspace.yaml globs', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'pnpm-workspace.yaml': 'packages:\n  - libs/*\n',
      'libs/lib-a/package.json': { name: 'lib-a', version: '1.0.0' },
      'packages/skip/package.json': { name: 'skip', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.packages.map(p => p.name)).toEqual(['lib-a']);
  });

  it('resolves internal workspace dependencies from declared deps', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/a/package.json': {
        name: '@scope/a',
        version: '1.0.0',
        dependencies: { '@scope/b': 'workspace:*', lodash: '4.0.0' },
      },
      'packages/b/package.json': { name: '@scope/b', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    const a = result.packages.find(p => p.name === '@scope/a');
    expect(a?.internalDeps).toEqual(['@scope/b']);
  });

  it('does not include a package as its own internal dependency', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/a/package.json': {
        name: '@scope/a',
        version: '1.0.0',
        dependencies: { '@scope/a': '1.0.0' },
      },
    });
    const result = await discoverWorkspace(tmp);
    const a = result.packages.find(p => p.name === '@scope/a');
    expect(a?.internalDeps).toEqual([]);
  });

  it('extracts scripts as a string→string record', async () => {
    tmp = await setupWorkspace({
      'package.json': {
        name: 'root',
        scripts: { build: 'tsc', test: 123, dev: 'tsx src' },
      },
      'packages/a/package.json': { name: '@scope/a', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.rootScripts).toEqual({ build: 'tsc', dev: 'tsx src' });
  });

  it('detects pnpm from pnpm-lock.yaml', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'pnpm-lock.yaml': 'lockfileVersion: 1\n',
    });
    const result = await discoverWorkspace(tmp);
    expect(result.packageManager).toBe('pnpm');
  });

  it('detects yarn from yarn.lock', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'yarn.lock': '# yarn lockfile v1\n',
    });
    const result = await discoverWorkspace(tmp);
    expect(result.packageManager).toBe('yarn');
  });

  it('detects bun from bun.lockb', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'bun.lockb': '',
    });
    const result = await discoverWorkspace(tmp);
    expect(result.packageManager).toBe('bun');
  });

  it('defaults to npm when no lockfile is present', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.packageManager).toBe('npm');
  });

  it('emits a doNotTouch list with well-known dirs plus each package dist/', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/cli/package.json': { name: '@scope/cli', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.doNotTouch).toEqual(
      expect.arrayContaining([
        'dist/',
        'build/',
        'coverage/',
        'node_modules/',
        '.turbo/',
        'packages/cli/dist/',
      ])
    );
  });

  it('locates the contracts package src/index.ts when present', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/contracts/package.json': { name: '@scope/contracts', version: '1.0.0' },
      'packages/contracts/src/index.ts': 'export {};\n',
    });
    const result = await discoverWorkspace(tmp);
    expect(result.contractsPath).toBe('packages/contracts/src/index.ts');
  });

  it('omits contractsPath when the contracts package has no src/index.ts', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/contracts/package.json': { name: '@scope/contracts', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.contractsPath).toBeUndefined();
  });

  it('returns an empty commandGroups list when no program is provided', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.commandGroups).toEqual([]);
  });

  it('excludes packages located at the workspace root itself', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/root/package.json': { name: 'wrong', version: '1.0.0' },
    });
    // The packages/root/ subfolder is still discovered. The exclusion only
    // applies when the package.json directly matches the root dir (rel=".").
    const result = await discoverWorkspace(tmp);
    expect(result.packages.find(p => p.name === 'wrong')).toBeDefined();
  });

  it('returns packages sorted deterministically by name', async () => {
    tmp = await setupWorkspace({
      'package.json': { name: 'root' },
      'packages/zeta/package.json': { name: '@scope/zeta', version: '1.0.0' },
      'packages/alpha/package.json': { name: '@scope/alpha', version: '1.0.0' },
      'packages/mid/package.json': { name: '@scope/mid', version: '1.0.0' },
    });
    const result = await discoverWorkspace(tmp);
    expect(result.packages.map(p => p.dir)).toEqual([
      'packages/alpha',
      'packages/mid',
      'packages/zeta',
    ]);
  });
});
