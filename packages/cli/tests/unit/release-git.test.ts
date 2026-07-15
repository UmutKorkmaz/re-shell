import { describe, it, expect, vi } from 'vitest';
import {
  isGitRepo,
  lastTag,
  changedFilesSince,
  commitSubjectsSince,
  createAnnotatedTag,
  type GitRunner,
} from '../../src/utils/release-git';

const CWD = '/fake/repo';

describe('isGitRepo', () => {
  it('returns true when git reports inside work tree', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('true');
    const result = await isGitRepo(runner, CWD);
    expect(result).toBe(true);
    expect(runner).toHaveBeenCalledWith(
      ['rev-parse', '--is-inside-work-tree'],
      CWD
    );
  });

  it('returns false when git reports not inside work tree', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('false');
    const result = await isGitRepo(runner, CWD);
    expect(result).toBe(false);
  });

  it('returns false when git throws', async () => {
    const runner: GitRunner = vi.fn().mockRejectedValue(new Error('not a repo'));
    const result = await isGitRepo(runner, CWD);
    expect(result).toBe(false);
  });

  it('returns false on unexpected stdout', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('maybe');
    const result = await isGitRepo(runner, CWD);
    expect(result).toBe(false);
  });
});

describe('lastTag', () => {
  it('returns the tag string when git outputs a tag', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('v1.2.3');
    const result = await lastTag(runner, CWD);
    expect(result).toBe('v1.2.3');
    expect(runner).toHaveBeenCalledWith(
      ['describe', '--tags', '--abbrev=0'],
      CWD
    );
  });

  it('returns null when tag output is empty', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('');
    const result = await lastTag(runner, CWD);
    expect(result).toBeNull();
  });

  it('returns null when git throws', async () => {
    const runner: GitRunner = vi.fn().mockRejectedValue(new Error('no tags'));
    const result = await lastTag(runner, CWD);
    expect(result).toBeNull();
  });

  it('returns tag as-is (trimming is the runner responsibility)', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('v2.0.0');
    const result = await lastTag(runner, CWD);
    expect(result).toBe('v2.0.0');
  });
});

describe('changedFilesSince', () => {
  it('returns tracked + untracked files deduplicated', async () => {
    const runner: GitRunner = vi.fn().mockImplementation(async (args: string[]) => {
      if (args[0] === 'diff') return 'packages/a/src/index.ts\npackages/b/README.md';
      if (args[0] === 'ls-files') return 'packages/c/new.ts\npackages/a/src/index.ts';
      return '';
    });
    const result = await changedFilesSince(runner, CWD, 'v1.0.0');
    expect(result).toEqual([
      'packages/a/src/index.ts',
      'packages/b/README.md',
      'packages/c/new.ts',
    ]);
  });

  it('uses ref..HEAD when ref is provided', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('');
    await changedFilesSince(runner, CWD, 'v1.0.0');
    const diffCall = (runner as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => Array.isArray(c[0]) && c[0][0] === 'diff'
    );
    expect(diffCall![0]).toEqual([
      'diff',
      '--name-only',
      'v1.0.0..HEAD',
    ]);
  });

  it('uses HEAD when ref is null', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('');
    await changedFilesSince(runner, CWD, null);
    const diffCall = (runner as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => Array.isArray(c[0]) && c[0][0] === 'diff'
    );
    expect(diffCall![0]).toEqual(['diff', '--name-only', 'HEAD']);
  });

  it('returns empty array when git throws', async () => {
    const runner: GitRunner = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await changedFilesSince(runner, CWD, 'v1.0.0');
    expect(result).toEqual([]);
  });

  it('handles no changes (empty output)', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('');
    const result = await changedFilesSince(runner, CWD, 'v1.0.0');
    expect(result).toEqual([]);
  });
});

describe('commitSubjectsSince', () => {
  it('returns commit subjects for a ref range', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue(
      'feat: add feature\nfix: patch bug\nrefactor: cleanup'
    );
    const result = await commitSubjectsSince(runner, CWD, 'v1.0.0', 'packages/a');
    expect(result).toEqual(['feat: add feature', 'fix: patch bug', 'refactor: cleanup']);
    expect(runner).toHaveBeenCalledWith(
      ['log', 'v1.0.0..HEAD', '--pretty=format:%s', '--', 'packages/a'],
      CWD
    );
  });

  it('uses HEAD when ref is null', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('chore: something');
    await commitSubjectsSince(runner, CWD, null, 'packages/b');
    expect(runner).toHaveBeenCalledWith(
      ['log', 'HEAD', '--pretty=format:%s', '--', 'packages/b'],
      CWD
    );
  });

  it('returns empty array when git throws', async () => {
    const runner: GitRunner = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await commitSubjectsSince(runner, CWD, 'v1.0.0', 'packages/a');
    expect(result).toEqual([]);
  });

  it('filters empty lines', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('feat: a\n\n\nfix: b');
    const result = await commitSubjectsSince(runner, CWD, 'v1.0.0', 'packages/a');
    expect(result).toEqual(['feat: a', 'fix: b']);
  });
});

describe('createAnnotatedTag', () => {
  it('calls git tag with -a flag, tag name, and message', async () => {
    const runner: GitRunner = vi.fn().mockResolvedValue('');
    await createAnnotatedTag(runner, CWD, 'pkg@1.2.3', 'release 1.2.3');
    expect(runner).toHaveBeenCalledWith(
      ['tag', '-a', 'pkg@1.2.3', '-m', 'release 1.2.3'],
      CWD
    );
  });

  it('propagates error when git tag fails', async () => {
    const runner: GitRunner = vi
      .fn()
      .mockRejectedValue(new Error('tag already exists'));
    await expect(
      createAnnotatedTag(runner, CWD, 'pkg@1.0.0', 'msg')
    ).rejects.toThrow('tag already exists');
  });
});
