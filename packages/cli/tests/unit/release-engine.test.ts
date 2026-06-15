import { describe, it, expect, vi } from 'vitest';
import { releaseResponseSchema } from '@re-shell/contracts';
import {
  propagateBumps,
  bumpVersion,
  registryForLanguage,
  buildChangelogEntry,
  computeReleasePlan,
  type BumpLevel,
  type ReleasableUnit,
} from '../../src/utils/release-engine';
import {
  buildPublishCommand,
  execPublish,
  type PublishExecutor,
} from '../../src/utils/release-adapters';

/**
 * Pure-engine conformance for `re-shell release`. Everything here is offline,
 * deterministic, and side-effect free — no git, no filesystem, no network.
 */

/** A small 3-package graph: B depends on A, C depends on B (A → B → C). */
function chainGraph(): Map<string, readonly string[]> {
  return new Map<string, readonly string[]>([
    ['a', []],
    ['b', ['a']],
    ['c', ['b']],
  ]);
}

describe('propagateBumps', () => {
  it('bumps a changed unit at its requested level', () => {
    const result = propagateBumps(
      new Set(['a']),
      new Map<string, BumpLevel>([['a', 'minor']]),
      chainGraph()
    );
    expect(result.get('a')).toEqual({ level: 'minor', reason: 'changed' });
  });

  it('propagates patch to direct dependents with reason dependent', () => {
    const result = propagateBumps(new Set(['a']), new Map(), chainGraph());
    expect(result.get('b')).toEqual({ level: 'patch', reason: 'dependent' });
  });

  it('propagates transitively through the dependency chain', () => {
    const result = propagateBumps(new Set(['a']), new Map(), chainGraph());
    // A changed → B and C are both transitive dependents at patch.
    expect(result.get('b')?.reason).toBe('dependent');
    expect(result.get('c')?.reason).toBe('dependent');
  });

  it('keeps a higher changed bump over an inherited dependent patch', () => {
    // A changed (major) AND C changed (minor): C must stay minor/changed even
    // though it is also a transitive dependent of A.
    const result = propagateBumps(
      new Set(['a', 'c']),
      new Map<string, BumpLevel>([
        ['a', 'major'],
        ['c', 'minor'],
      ]),
      chainGraph()
    );
    expect(result.get('a')).toEqual({ level: 'major', reason: 'changed' });
    expect(result.get('c')).toEqual({ level: 'minor', reason: 'changed' });
    expect(result.get('b')).toEqual({ level: 'patch', reason: 'dependent' });
  });

  it('defaults a changed unit with no requested bump to patch', () => {
    const result = propagateBumps(new Set(['a']), new Map(), chainGraph());
    expect(result.get('a')).toEqual({ level: 'patch', reason: 'changed' });
  });
});

describe('bumpVersion', () => {
  it('applies each level', () => {
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('throws on an invalid current version', () => {
    expect(() => bumpVersion('not-a-version', 'patch')).toThrow(/invalid version/i);
  });
});

describe('registryForLanguage', () => {
  it('maps known languages to registries', () => {
    expect(registryForLanguage('typescript')).toBe('npm');
    expect(registryForLanguage('javascript')).toBe('npm');
    expect(registryForLanguage('rust')).toBe('crates.io');
    expect(registryForLanguage('python')).toBe('pypi');
    expect(registryForLanguage('java')).toBe('maven');
    expect(registryForLanguage('csharp')).toBe('nuget');
    expect(registryForLanguage('php')).toBe('packagist');
    expect(registryForLanguage('ruby')).toBe('rubygems');
  });

  it('returns unknown for unmapped languages', () => {
    expect(registryForLanguage('cobol')).toBe('unknown');
  });
});

describe('buildChangelogEntry', () => {
  it('lists commit subjects for a changed unit', () => {
    const entry = buildChangelogEntry('a', '1.1.0', 'changed', [
      'feat: thing',
      'fix: other',
    ]);
    expect(entry).toContain('## a@1.1.0');
    expect(entry).toContain('- feat: thing');
    expect(entry).toContain('- fix: other');
  });

  it('emits a dependency-bump note for a dependent with no commits', () => {
    const entry = buildChangelogEntry('b', '1.0.1', 'dependent', []);
    expect(entry).toContain('## b@1.0.1');
    expect(entry).toMatch(/dependency bump/i);
  });
});

describe('computeReleasePlan', () => {
  const units: ReleasableUnit[] = [
    { name: 'a', path: 'packages/a', language: 'typescript', manifestType: 'package.json', currentVersion: '1.0.0' },
    { name: 'b', path: 'packages/b', language: 'typescript', manifestType: 'package.json', currentVersion: '1.0.0' },
    { name: 'c', path: 'packages/c', language: 'typescript', manifestType: 'package.json', currentVersion: '1.0.0' },
  ];

  it('bumps A (changed minor) and B,C (dependents patch)', () => {
    const plan = computeReleasePlan(
      units,
      new Set(['a']),
      new Map<string, BumpLevel>([['a', 'minor']]),
      chainGraph(),
      new Map([['a', ['feat: add x']]])
    );
    const byName = new Map(plan.entries.map(e => [e.name, e]));
    expect(byName.get('a')?.nextVersion).toBe('1.1.0');
    expect(byName.get('a')?.reason).toBe('changed');
    expect(byName.get('b')?.nextVersion).toBe('1.0.1');
    expect(byName.get('b')?.reason).toBe('dependent');
    expect(byName.get('c')?.nextVersion).toBe('1.0.1');
    expect(byName.get('c')?.reason).toBe('dependent');
  });

  it('warns and excludes a unit with an unknown registry', () => {
    const weird: ReleasableUnit[] = [
      { name: 'x', path: 'packages/x', language: 'cobol', manifestType: 'unknown', currentVersion: '1.0.0' },
    ];
    const plan = computeReleasePlan(
      weird,
      new Set(['x']),
      new Map(),
      new Map([['x', []]]),
      new Map()
    );
    expect(plan.entries).toHaveLength(0);
    expect(plan.warnings.some(w => /no known registry/.test(w))).toBe(true);
  });
});

describe('buildPublishCommand', () => {
  it('builds npm and crates.io commands', () => {
    const base = {
      name: 'a',
      path: 'packages/a',
      language: 'typescript',
      manifestType: 'package.json',
      currentVersion: '1.0.0',
      nextVersion: '1.0.1',
      bumpLevel: 'patch' as const,
      reason: 'changed' as const,
      changelogEntry: '',
      registry: 'npm',
    };
    expect(buildPublishCommand(base)).toEqual({
      cmd: 'npm',
      args: ['publish', '--access', 'public'],
    });
    expect(buildPublishCommand({ ...base, registry: 'crates.io' })).toEqual({
      cmd: 'cargo',
      args: ['publish'],
    });
  });
});

describe('execPublish', () => {
  const entry = {
    name: 'a',
    path: 'packages/a',
    language: 'typescript',
    manifestType: 'package.json',
    currentVersion: '1.0.0',
    nextVersion: '1.0.1',
    bumpLevel: 'patch' as const,
    reason: 'changed' as const,
    changelogEntry: '',
    registry: 'npm',
  };

  it('does not run the executor in dry-run and is not published', async () => {
    const exec = vi.fn<Parameters<PublishExecutor>, ReturnType<PublishExecutor>>(
      () => Promise.resolve(0)
    );
    const outcome = await execPublish(entry, exec, true);
    expect(exec).not.toHaveBeenCalled();
    expect(outcome.published).toBe(false);
  });

  it('runs once and reports published on exit 0', async () => {
    const exec = vi.fn<Parameters<PublishExecutor>, ReturnType<PublishExecutor>>(
      () => Promise.resolve(0)
    );
    const outcome = await execPublish(entry, exec, false);
    expect(exec).toHaveBeenCalledTimes(1);
    expect(outcome.published).toBe(true);
  });

  it('reports a warning on a non-zero exit', async () => {
    const exec = vi.fn<Parameters<PublishExecutor>, ReturnType<PublishExecutor>>(
      () => Promise.resolve(7)
    );
    const outcome = await execPublish(entry, exec, false);
    expect(outcome.published).toBe(false);
    expect(outcome.warning).toMatch(/exited 7/);
  });
});

describe('releaseResponseSchema', () => {
  it('validates a built ReleaseResponse payload', () => {
    const payload = {
      dryRun: true,
      units: [
        {
          name: 'a',
          path: 'packages/a',
          language: 'typescript',
          manifestType: 'package.json',
          currentVersion: '1.0.0',
          nextVersion: '1.1.0',
          bumpLevel: 'minor',
          reason: 'changed',
          changelogEntry: '## a@1.1.0\n\n- feat\n',
          registry: 'npm',
          published: false,
        },
      ],
      warnings: [],
    };
    const parsed = releaseResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
