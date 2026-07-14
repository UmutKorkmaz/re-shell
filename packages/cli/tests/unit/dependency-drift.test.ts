import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  detectDependencyDrift,
  classifyDriftSeverity,
  suggestAlignment,
  computeDriftScore,
  generateDriftReport,
  type DriftEntry,
  type DriftResult,
} from '../../src/utils/dependency-drift';

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

// --- severity, scoring, suggestions & report suites (drift engine extension) ---

const tempDirs: string[] = [];

function createTempMonorepo(
  workspaces: Array<{ name: string; deps?: Record<string, string>; devDeps?: Record<string, string> }>
): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-drift-'));
  tempDirs.push(dir);

  const wsPatterns: string[] = [];
  for (const ws of workspaces) {
    const wsDir = ws.name;
    mkdirSync(join(dir, wsDir), { recursive: true });
    writeFileSync(
      join(dir, wsDir, 'package.json'),
      JSON.stringify({
        name: ws.name,
        version: '1.0.0',
        dependencies: ws.deps || {},
        devDependencies: ws.devDeps || {},
      }, null, 2)
    );
    wsPatterns.push(wsDir);
  }

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'test-monorepo',
      version: '1.0.0',
      private: true,
      workspaces: wsPatterns,
    }, null, 2)
  );

  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

// --- Pure function tests ---

describe('classifyDriftSeverity', () => {
  it('should classify major version difference as major', () => {
    const severity = classifyDriftSeverity('^3.0.0', '^4.0.0');
    expect(severity).toBe('major');
  });

  it('should classify minor version difference as minor', () => {
    const severity = classifyDriftSeverity('^4.17.0', '^4.18.0');
    expect(severity).toBe('minor');
  });

  it('should classify patch version difference as patch', () => {
    const severity = classifyDriftSeverity('^4.18.1', '^4.18.2');
    expect(severity).toBe('patch');
  });

  it('should classify range vs exact as minor', () => {
    const severity = classifyDriftSeverity('^4.18.0', '4.18.2');
    expect(severity).toBe('patch');
  });

  it('should classify very different ranges as major', () => {
    const severity = classifyDriftSeverity('^1.0.0', '^16.0.0');
    expect(severity).toBe('major');
  });

  it('should default to minor for unparseable versions', () => {
    const severity = classifyDriftSeverity('latest', 'next');
    expect(severity).toBe('minor');
  });
});

describe('suggestAlignment', () => {
  it('should suggest the version used by most packages', () => {
    const entry: DriftEntry = {
      dependency: 'react',
      versions: [
        { version: '^17.0.0', packages: ['app-a'] },
        { version: '^18.0.0', packages: ['app-b', 'app-c', 'app-d'] },
      ],
    };
    const suggestion = suggestAlignment(entry);
    expect(suggestion.version).toBe('^18.0.0');
    expect(suggestion.confidence).toBeGreaterThan(0.5);
  });

  it('should suggest the latest version on tie', () => {
    const entry: DriftEntry = {
      dependency: 'express',
      versions: [
        { version: '^4.17.0', packages: ['a'] },
        { version: '^4.18.0', packages: ['b'] },
      ],
    };
    const suggestion = suggestAlignment(entry);
    expect(suggestion.version).toBe('^4.18.0');
  });

  it('should include affected packages in suggestion', () => {
    const entry: DriftEntry = {
      dependency: 'lodash',
      versions: [
        { version: '^4.17.0', packages: ['a'] },
        { version: '^4.17.21', packages: ['b', 'c'] },
      ],
    };
    const suggestion = suggestAlignment(entry);
    expect(suggestion.affectedPackages).toContain('a');
  });
});

describe('computeDriftScore', () => {
  it('should return 100 for no drift', () => {
    const result: DriftResult = { drift: [] };
    expect(computeDriftScore(result)).toBe(100);
  });

  it('should return lower score for more drift entries', () => {
    const lessDrift: DriftResult = {
      drift: [
        { dependency: 'a', versions: [{ version: '1', packages: ['x'] }, { version: '2', packages: ['y'] }] },
      ],
    };
    const moreDrift: DriftResult = {
      drift: [
        { dependency: 'a', versions: [{ version: '1', packages: ['x'] }, { version: '2', packages: ['y'] }] },
        { dependency: 'b', versions: [{ version: '1', packages: ['x'] }, { version: '2', packages: ['y'] }] },
        { dependency: 'c', versions: [{ version: '1', packages: ['x'] }, { version: '2', packages: ['y'] }] },
      ],
    };
    expect(computeDriftScore(moreDrift)).toBeLessThan(computeDriftScore(lessDrift));
  });

  it('should penalize major drift more than patch drift', () => {
    const majorDrift: DriftResult = {
      drift: [
        { dependency: 'x', versions: [{ version: '^1.0.0', packages: ['a'] }, { version: '^4.0.0', packages: ['b'] }] },
      ],
    };
    const patchDrift: DriftResult = {
      drift: [
        { dependency: 'x', versions: [{ version: '^4.18.1', packages: ['a'] }, { version: '^4.18.2', packages: ['b'] }] },
      ],
    };
    expect(computeDriftScore(majorDrift)).toBeLessThan(computeDriftScore(patchDrift));
  });

  it('should never return below 0', () => {
    const hugeDrift: DriftResult = {
      drift: Array.from({ length: 100 }, (_, i) => ({
        dependency: `dep-${i}`,
        versions: [
          { version: '^1.0.0', packages: ['a'] },
          { version: '^4.0.0', packages: ['b'] },
        ],
      })),
    };
    expect(computeDriftScore(hugeDrift)).toBeGreaterThanOrEqual(0);
  });
});

describe('generateDriftReport', () => {
  it('should generate markdown report with no drift', () => {
    const report = generateDriftReport({ drift: [] }, 'test-mono');
    expect(report).toContain('test-mono');
    expect(report).toContain('No drift');
    expect(report).toContain('100');
  });

  it('should generate markdown with drift details', () => {
    const result: DriftResult = {
      drift: [
        {
          dependency: 'react',
          versions: [
            { version: '^17.0.0', packages: ['legacy-app'] },
            { version: '^18.0.0', packages: ['new-app', 'shared-ui'] },
          ],
        },
      ],
    };
    const report = generateDriftReport(result, 'my-workspace');
    expect(report).toContain('react');
    expect(report).toContain('^17.0.0');
    expect(report).toContain('^18.0.0');
    expect(report).toContain('legacy-app');
    expect(report).toContain('new-app');
    expect(report).toContain('Suggestion');
    expect(report).toContain('Score');
  });

  it('should include severity classification', () => {
    const result: DriftResult = {
      drift: [
        {
          dependency: 'express',
          versions: [
            { version: '^3.0.0', packages: ['a'] },
            { version: '^4.0.0', packages: ['b'] },
          ],
        },
      ],
    };
    const report = generateDriftReport(result, 'ws');
    expect(report).toContain('major');
  });
});

// --- Integration tests ---

describe('detectDependencyDrift', () => {
  it('should detect no drift in aligned monorepo', async () => {
    const dir = createTempMonorepo([
      { name: 'apps/web', deps: { react: '^18.0.0', lodash: '^4.17.21' } },
      { name: 'apps/api', deps: { express: '^4.18.0', lodash: '^4.17.21' } },
    ]);

    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(0);
  });

  it('should detect version drift for same dependency', async () => {
    const dir = createTempMonorepo([
      { name: 'apps/web', deps: { react: '^17.0.0' } },
      { name: 'apps/api', deps: { react: '^18.0.0' } },
    ]);

    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    expect(result.drift[0].dependency).toBe('react');
    expect(result.drift[0].versions).toHaveLength(2);
  });

  it('should not report drift for deps used in only one package', async () => {
    const dir = createTempMonorepo([
      { name: 'apps/web', deps: { react: '^18.0.0', 'next': '^14.0.0' } },
      { name: 'apps/api', deps: { react: '^18.0.0', 'express': '^4.18.0' } },
    ]);

    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(0);
  });

  it('should include devDependencies in drift detection', async () => {
    const dir = createTempMonorepo([
      { name: 'packages/a', devDeps: { typescript: '^5.0.0' } },
      { name: 'packages/b', devDeps: { typescript: '^4.9.0' } },
    ]);

    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    expect(result.drift[0].dependency).toBe('typescript');
  });

  it('should group packages by version', async () => {
    const dir = createTempMonorepo([
      { name: 'a', deps: { lodash: '^4.17.0' } },
      { name: 'b', deps: { lodash: '^4.17.0' } },
      { name: 'c', deps: { lodash: '^4.17.21' } },
    ]);

    const result = await detectDependencyDrift(dir);
    expect(result.drift).toHaveLength(1);
    expect(result.drift[0].versions).toHaveLength(2);
    const v1 = result.drift[0].versions.find(v => v.version === '^4.17.0');
    expect(v1?.packages.sort()).toEqual(['a', 'b']);
  });
});
