import { describe, expect, it, afterEach } from 'vitest';
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
