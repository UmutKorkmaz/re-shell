import { describe, it, expect, vi } from 'vitest';
import {
  buildPublishCommand,
  execPublish,
  type PublishExecutor,
} from '../../src/utils/release-adapters';
import type { ReleasePlanEntry } from '../../src/utils/release-engine';

function makeEntry(overrides: Partial<ReleasePlanEntry> = {}): ReleasePlanEntry {
  return {
    name: '@re-shell/test-pkg',
    path: '/fake/packages/test-pkg',
    language: 'typescript',
    manifestType: 'package.json',
    currentVersion: '1.0.0',
    nextVersion: '1.1.0',
    bumpLevel: 'minor',
    reason: 'changed',
    changelogEntry: '## 1.1.0\n- update',
    registry: 'npm',
    ...overrides,
  };
}

describe('buildPublishCommand', () => {
  it('builds npm publish command', () => {
    const result = buildPublishCommand(makeEntry({ registry: 'npm' }));
    expect(result.cmd).toBe('npm');
    expect(result.args).toEqual(['publish', '--access', 'public']);
  });

  it('builds cargo publish command for crates.io', () => {
    const result = buildPublishCommand(makeEntry({ registry: 'crates.io' }));
    expect(result.cmd).toBe('cargo');
    expect(result.args).toEqual(['publish']);
  });

  it('builds twine upload command for pypi', () => {
    const result = buildPublishCommand(makeEntry({ registry: 'pypi' }));
    expect(result.cmd).toBe('python');
    expect(result.args).toEqual(['-m', 'twine', 'upload', 'dist/*']);
  });

  it('builds mvn deploy command for maven', () => {
    const result = buildPublishCommand(makeEntry({ registry: 'maven' }));
    expect(result.cmd).toBe('mvn');
    expect(result.args).toEqual(['-B', 'deploy']);
  });

  it('builds dotnet nuget push for nuget', () => {
    const result = buildPublishCommand(makeEntry({ registry: 'nuget' }));
    expect(result.cmd).toBe('dotnet');
    expect(result.args).toEqual(['nuget', 'push']);
  });

  it('builds gem push for rubygems', () => {
    const result = buildPublishCommand(makeEntry({ registry: 'rubygems' }));
    expect(result.cmd).toBe('gem');
    expect(result.args).toEqual(['push']);
  });

  it('throws on unsupported registry', () => {
    expect(() =>
      buildPublishCommand(makeEntry({ registry: 'unknown-registry' }))
    ).toThrow('no publish adapter for registry "unknown-registry"');
  });
});

describe('execPublish', () => {
  it('returns published=false in dry-run without calling executor', async () => {
    const executor: PublishExecutor = vi.fn();
    const result = await execPublish(makeEntry(), executor, true);
    expect(result.published).toBe(false);
    expect(result.warning).toBeUndefined();
    expect(executor).not.toHaveBeenCalled();
  });

  it('returns published=true when executor resolves with exit code 0', async () => {
    const executor: PublishExecutor = vi.fn().mockResolvedValue(0);
    const result = await execPublish(makeEntry(), executor, false);
    expect(result.published).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(executor).toHaveBeenCalledWith(
      'npm',
      ['publish', '--access', 'public'],
      '/fake/packages/test-pkg'
    );
  });

  it('returns published=false with warning on non-zero exit code', async () => {
    const executor: PublishExecutor = vi.fn().mockResolvedValue(1);
    const result = await execPublish(
      makeEntry({ name: 'my-pkg' }),
      executor,
      false
    );
    expect(result.published).toBe(false);
    expect(result.warning).toContain('my-pkg');
    expect(result.warning).toContain('npm exited 1');
  });

  it('returns published=false with warning when executor throws', async () => {
    const executor: PublishExecutor = vi
      .fn()
      .mockRejectedValue(new Error('network timeout'));
    const result = await execPublish(
      makeEntry({ name: 'err-pkg' }),
      executor,
      false
    );
    expect(result.published).toBe(false);
    expect(result.warning).toContain('err-pkg');
    expect(result.warning).toContain('network timeout');
  });

  it('returns published=false with warning when registry is unsupported', async () => {
    const executor: PublishExecutor = vi.fn();
    const result = await execPublish(
      makeEntry({ name: 'bad-pkg', registry: 'galaxy' }),
      executor,
      false
    );
    expect(result.published).toBe(false);
    expect(result.warning).toContain('bad-pkg');
    expect(result.warning).toContain('no publish adapter');
    expect(executor).not.toHaveBeenCalled();
  });

  it('handles non-Error thrown values in messageOf', async () => {
    const executor: PublishExecutor = vi
      .fn()
      .mockRejectedValue('string error');
    const result = await execPublish(makeEntry(), executor, false);
    expect(result.published).toBe(false);
    expect(result.warning).toContain('unknown error');
  });

  it('passes correct cwd to executor from entry.path', async () => {
    const executor: PublishExecutor = vi.fn().mockResolvedValue(0);
    await execPublish(
      makeEntry({ path: '/custom/path', registry: 'crates.io' }),
      executor,
      false
    );
    expect(executor).toHaveBeenCalledWith(
      'cargo',
      ['publish'],
      '/custom/path'
    );
  });
});
