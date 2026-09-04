import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { detectDependencyDrift } from '../../src/utils/dependency-drift';

async function seedWorkspace(
  root: string,
  wsPath: string,
  pkg: Record<string, unknown>,
): Promise<void> {
  const abs = path.join(root, wsPath);
  await fs.ensureDir(abs);
  await fs.writeJson(path.join(abs, 'package.json'), pkg);
}

async function seedRoot(
  root: string,
  workspaceGlobs: string[],
): Promise<void> {
  await fs.writeJson(path.join(root, 'package.json'), {
    name: 'root',
    private: true,
    workspaces: workspaceGlobs,
  });
}

describe('detectDependencyDrift', () => {
  let dir: string;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), `rs-drift-${Date.now()}-`));
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('returns an empty drift array when there are no workspaces', async () => {
    await fs.writeJson(path.join(dir, 'package.json'), {
      name: 'lonely',
      private: true,
      // no workspaces field
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toEqual([]);
  });

  it('returns an empty drift array when a single workspace exists', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      version: '1.0.0',
      dependencies: { lodash: '^4.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toEqual([]);
  });

  it('returns no drift when all workspaces use the same version range', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { lodash: '^4.0.0', react: '^18.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      dependencies: { lodash: '^4.0.0', react: '^18.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toEqual([]);
  });

  it('reports drift when two workspaces pin different versions', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { lodash: '^4.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      dependencies: { lodash: '^3.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    expect(result.drift[0].dependency).toBe('lodash');
    expect(result.drift[0].versions).toHaveLength(2);
    // versions sorted ascending
    expect(result.drift[0].versions[0].version).toBe('^3.0.0');
    expect(result.drift[0].versions[0].packages).toEqual(['@scope/b']);
    expect(result.drift[0].versions[1].version).toBe('^4.0.0');
    expect(result.drift[0].versions[1].packages).toEqual(['@scope/a']);
  });

  it('counts devDependencies alongside dependencies', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { typescript: '^5.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      devDependencies: { typescript: '^4.9.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    expect(result.drift[0].dependency).toBe('typescript');
    expect(result.drift[0].versions).toHaveLength(2);
  });

  it('counts peerDependencies alongside dependencies', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { react: '^18.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      peerDependencies: { react: '^17.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    expect(result.drift[0].dependency).toBe('react');
  });

  it('counts optionalDependencies alongside dependencies', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { 'fsevents': '^2.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      optionalDependencies: { 'fsevents': '^1.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    expect(result.drift[0].dependency).toBe('fsevents');
  });

  it('skips workspaces whose package.json cannot be read', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { lodash: '^4.0.0' },
    });
    // packages/b is a directory but has no package.json
    await fs.ensureDir(path.join(dir, 'packages', 'b'));
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toEqual([]);
  });

  it('sorts drift entries alphabetically by dependency name', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { zod: '^3.0.0', axios: '^1.0.0', chalk: '^5.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      dependencies: { zod: '^4.0.0', axios: '^2.0.0', chalk: '^4.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift.map((e) => e.dependency)).toEqual([
      'axios',
      'chalk',
      'zod',
    ]);
  });

  it('aggregates multiple packages onto the same version', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { lodash: '^4.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      dependencies: { lodash: '^4.0.0' },
    });
    await seedWorkspace(dir, 'packages/c', {
      name: '@scope/c',
      dependencies: { lodash: '^3.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    const v4 = result.drift[0].versions.find((v) => v.version === '^4.0.0');
    expect(v4).toBeDefined();
    // two packages share ^4.0.0, sorted alphabetically
    expect(v4!.packages).toEqual(['@scope/a', '@scope/b']);
  });

  it('falls back to workspace.name when pkg.name is missing', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/alpha', {
      // no name field
      dependencies: { lodash: '^4.0.0' },
    });
    await seedWorkspace(dir, 'packages/beta', {
      dependencies: { lodash: '^3.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    const allPkgs = result.drift[0].versions.flatMap((v) => v.packages);
    // workspace.name derives from directory basename
    expect(allPkgs).toEqual(expect.arrayContaining(['alpha', 'beta']));
  });

  it('defaults rootPath to process.cwd() when omitted', async () => {
    // The function should not throw when called with no args against the
    // current working directory (the re-shell root, which is a monorepo).
    const result = await detectDependencyDrift();
    expect(result).toHaveProperty('drift');
    expect(Array.isArray(result.drift)).toBe(true);
  });

  it('treats same dependency declared in multiple dep sections of one package as a single version', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { lodash: '^4.0.0' },
      devDependencies: { lodash: '^4.0.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      dependencies: { lodash: '^3.0.0' },
    });
    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    const v4 = result.drift[0].versions.find((v) => v.version === '^4.0.0');
    // The same package declaring ^4.0.0 in deps and devDeps should not be
    // double-counted.
    expect(v4!.packages).toEqual(['@scope/a']);
  });

  it('produces deterministic output ordering (versions sorted, packages sorted)', async () => {
    await seedRoot(dir, ['packages/*']);
    await seedWorkspace(dir, 'packages/a', {
      name: '@scope/a',
      dependencies: { lodash: '^4.17.0' },
    });
    await seedWorkspace(dir, 'packages/b', {
      name: '@scope/b',
      dependencies: { lodash: '^4.17.15' },
    });
    await seedWorkspace(dir, 'packages/c', {
      name: '@scope/c',
      dependencies: { lodash: '^3.0.0' },
    });
    const result = await detectDependencyDrift(dir);

    // Run twice and confirm the output is identical.
    const result2 = await detectDependencyDrift(dir);
    expect(result).toEqual(result2);

    // Sanity: versions are sorted ascending as strings.
    const versions = result.drift[0].versions.map((v) => v.version);
    const sorted = [...versions].sort();
    expect(versions).toEqual(sorted);
  });
});
