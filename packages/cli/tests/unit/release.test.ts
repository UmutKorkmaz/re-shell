import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runRelease } from '../../src/commands/release';
import type { GitRunner } from '../../src/utils/release-git';
import * as taskRunner from '../../src/utils/task-runner';
import * as releaseManifest from '../../src/utils/release-manifest';
import {
  isGitRepo,
  lastTag,
  changedFilesSince,
  commitSubjectsSince,
  createAnnotatedTag,
} from '../../src/utils/release-git';
import { execPublish } from '../../src/utils/release-adapters';
import { ok, fail } from '../../src/utils/json-output';

// Covers src/commands/release.ts — the `re-shell release` orchestrator
// (442 lines). The command wires the pure release-engine together with the
// manifest/git/publish adapters and the task-runner workspace discovery; every
// side-effecting collaborator is mocked so tests never touch real git or the
// network. The command's own logic under test: --since validation, repo probe,
// discovery wiring, changed-set resolution, --filter dependent expansion,
// manifest/version resolution, dry-run vs apply, publish gating, error
// envelopes, and the human/JSON renderers.

vi.mock('../../src/utils/task-runner', () => ({
  discoverWorkspace: vi.fn(),
}));
vi.mock('../../src/utils/release-manifest', () => ({
  detectManifestType: vi.fn(),
  readCurrentVersion: vi.fn(),
  writeManifestVersion: vi.fn(),
  updateDependentRanges: vi.fn(),
  writeChangelog: vi.fn(),
}));
vi.mock('../../src/utils/release-git', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/utils/release-git')>();
  return {
    ...actual,
    isGitRepo: vi.fn(),
    lastTag: vi.fn(),
    changedFilesSince: vi.fn(),
    commitSubjectsSince: vi.fn(),
    createAnnotatedTag: vi.fn(),
  };
});
vi.mock('../../src/utils/release-adapters', () => ({
  execPublish: vi.fn(),
}));
vi.mock('../../src/utils/json-output', () => ({
  ok: vi.fn(),
  fail: vi.fn(),
}));

// Fixture versions by package directory basename.
const VERSIONS: Record<string, string> = {
  'ui-kit': '1.0.0',
  checkout: '1.0.0',
  shell: '2.0.0',
};

let stderrSpy: ReturnType<typeof vi.spyOn>;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  process.exitCode = undefined;

  vi.mocked(taskRunner.discoverWorkspace).mockResolvedValue({
    root: '/mock-project',
    packages: new Map([
      ['ui-kit', { name: 'ui-kit', dir: '/mock-project/packages/ui-kit' }],
      ['checkout', { name: 'checkout', dir: '/mock-project/apps/checkout' }],
      ['shell', { name: 'shell', dir: '/mock-project/apps/shell' }],
    ]),
    graph: new Map([
      ['ui-kit', []],
      ['checkout', ['ui-kit']],
      ['shell', ['ui-kit']],
    ]),
  } as unknown as taskRunner.WorkspaceDiscovery);

  // clearAllMocks does not drain pending mockImplementationOnce queues, so a
  // throwing Once-impl from an earlier test would fire here. Reset explicitly.
  vi.mocked(releaseManifest.writeManifestVersion).mockReset();
  vi.mocked(releaseManifest.detectManifestType).mockReturnValue('package.json');
  vi.mocked(releaseManifest.readCurrentVersion).mockImplementation(dir => {
    const name = dir.split('/').pop() ?? '';
    return VERSIONS[name] ?? null;
  });

  vi.mocked(isGitRepo).mockResolvedValue(true);
  vi.mocked(lastTag).mockResolvedValue('v1.0.0');
  vi.mocked(changedFilesSince).mockResolvedValue([
    'packages/ui-kit/src/index.ts',
  ]);
  vi.mocked(commitSubjectsSince).mockResolvedValue(['feat: add button']);
  vi.mocked(execPublish).mockResolvedValue({ published: true, warning: null });
});

/** Extract the ok() payload from the last JSON invocation. */
function okPayload(): {
  dryRun: boolean;
  units: {
    name: string;
    currentVersion: string;
    nextVersion: string;
    bumpLevel: string;
    reason: string;
    registry: string;
    published: boolean;
  }[];
  warnings: string[];
} {
  return vi.mocked(ok).mock.calls[0][0] as never;
}

/** Join stdout spy calls into one string. */
function stdoutText(): string {
  return stdoutSpy.mock.calls.map(c => String(c[0])).join('');
}

describe('release — command', () => {
  describe('input validation', () => {
    it('rejects a --since ref that starts with a dash (json)', async () => {
      await runRelease({ cwd: '/mock-project', json: true, since: '-evil' });
      expect(fail).toHaveBeenCalledWith(
        'RELEASE_ERROR',
        expect.stringContaining("cannot start with '-'")
      );
      expect(vi.mocked(taskRunner.discoverWorkspace)).not.toHaveBeenCalled();
    });

    it('rejects a --since ref that starts with a dash (human stderr)', async () => {
      await runRelease({ cwd: '/mock-project', since: '-evil' });
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("cannot start with '-'")
      );
      expect(process.exitCode).toBe(1);
    });

    it('does not reject a --since ref that is just a normal tag', async () => {
      await runRelease({ cwd: '/mock-project', json: true, since: 'v1.2.3' });
      expect(vi.mocked(taskRunner.discoverWorkspace)).toHaveBeenCalled();
    });

    it('rejects when not a git repository', async () => {
      vi.mocked(isGitRepo).mockResolvedValueOnce(false);
      await runRelease({ cwd: '/mock-project', json: true });
      expect(fail).toHaveBeenCalledWith(
        'RELEASE_ERROR',
        expect.stringContaining('Not a git repository')
      );
    });

    it('rejects when the workspace has no packages', async () => {
      vi.mocked(taskRunner.discoverWorkspace).mockResolvedValueOnce({
        root: '/mock-project',
        packages: new Map(),
        graph: new Map(),
      } as unknown as taskRunner.WorkspaceDiscovery);
      await runRelease({ cwd: '/mock-project', json: true });
      expect(fail).toHaveBeenCalledWith(
        'RELEASE_ERROR',
        expect.stringContaining('No workspace packages found')
      );
    });
  });

  describe('changed-set resolution', () => {
    it('treats all packages as changed when no tag exists', async () => {
      vi.mocked(lastTag).mockResolvedValueOnce(null);
      await runRelease({ cwd: '/mock-project', json: true });
      const payload = okPayload();
      expect(payload.units.map(u => u.name)).toEqual(
        expect.arrayContaining(['ui-kit', 'checkout', 'shell'])
      );
      expect(payload.warnings).toContain(
        'No base ref/tag found: treating ALL discovered packages as changed.'
      );
      expect(changedFilesSince).not.toHaveBeenCalled();
    });

    it('maps changed files to their owning packages by directory prefix', async () => {
      await runRelease({ cwd: '/mock-project', json: true, bump: 'patch' });
      const payload = okPayload();
      // ui-kit changed → checkout + shell depend on it → all three released.
      expect(payload.units.map(u => u.name).sort()).toEqual([
        'checkout',
        'shell',
        'ui-kit',
      ]);
    });

    it('maps backslash-separated files to owners (windows normalisation)', async () => {
      vi.mocked(changedFilesSince).mockResolvedValueOnce([
        'packages\\ui-kit\\src\\index.ts',
      ]);
      await runRelease({ cwd: '/mock-project', json: true, bump: 'patch' });
      const payload = okPayload();
      expect(payload.units.map(u => u.name)).toContain('ui-kit');
    });
  });

  describe('--filter dependent expansion', () => {
    it('expands the filter to transitive dependents', async () => {
      await runRelease({ cwd: '/mock-project', json: true, filter: ['ui-kit'], bump: 'patch' });
      const payload = okPayload();
      expect(payload.units.map(u => u.name).sort()).toEqual([
        'checkout',
        'shell',
        'ui-kit',
      ]);
    });

    it('warns when a filter name matches no discovered package', async () => {
      await runRelease({ cwd: '/mock-project', json: true, filter: ['nope'], bump: 'patch' });
      const payload = okPayload();
      expect(
        payload.warnings.some(w => w.includes('--filter "nope"'))
      ).toBe(true);
    });
  });

  describe('manifest/version resolution', () => {
    it('skips units with unreleasable manifests and warns when filtered-in', async () => {
      vi.mocked(releaseManifest.detectManifestType)
        .mockReturnValueOnce('Gemfile')
        .mockReturnValue('package.json');
      await runRelease({ cwd: '/mock-project', json: true, filter: ['ui-kit'], bump: 'patch' });
      const payload = okPayload();
      expect(
        payload.warnings.some(w => w.includes('unsupported manifest type'))
      ).toBe(true);
    });

    it('skips units with unreadable versions and warns when filtered-in', async () => {
      vi.mocked(releaseManifest.readCurrentVersion).mockReturnValueOnce(null);
      await runRelease({ cwd: '/mock-project', json: true, filter: ['ui-kit'], bump: 'patch' });
      const payload = okPayload();
      expect(payload.warnings.some(w => w.includes('no readable version'))).toBe(
        true
      );
    });
  });

  describe('dry-run vs apply', () => {
    it('writes nothing in dry-run mode (default)', async () => {
      await runRelease({ cwd: '/mock-project', json: true, bump: 'patch' });
      expect(releaseManifest.writeManifestVersion).not.toHaveBeenCalled();
      expect(releaseManifest.updateDependentRanges).not.toHaveBeenCalled();
      expect(releaseManifest.writeChangelog).not.toHaveBeenCalled();
      expect(createAnnotatedTag).not.toHaveBeenCalled();
    });

    it('writes manifest + ranges + changelog + tag per unit when applying', async () => {
      await runRelease({ cwd: '/mock-project', json: true, bump: 'patch', dryRun: false });
      expect(releaseManifest.writeManifestVersion).toHaveBeenCalledTimes(3);
      expect(releaseManifest.updateDependentRanges).toHaveBeenCalledTimes(3);
      expect(releaseManifest.writeChangelog).toHaveBeenCalledTimes(3);
      expect(createAnnotatedTag).toHaveBeenCalledTimes(3);
      expect(createAnnotatedTag).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'ui-kit@1.0.1',
        'Release ui-kit@1.0.1'
      );
    });

    it('does not publish when --publish is absent even while applying', async () => {
      await runRelease({ cwd: '/mock-project', json: true, bump: 'patch', dryRun: false });
      expect(execPublish).not.toHaveBeenCalled();
    });

    it('publishes and marks units published when --publish is given while applying', async () => {
      await runRelease({
      cwd: '/mock-project',
        json: true,
        bump: 'patch',
        dryRun: false,
        publish: true,
      });
      expect(execPublish).toHaveBeenCalledTimes(3);
      const payload = okPayload();
      expect(payload.units.every(u => u.published)).toBe(true);
    });

    it('surfaces publish warnings into the envelope', async () => {
      vi.mocked(execPublish).mockResolvedValueOnce({
        published: false,
        warning: 'registry unreachable',
      });
      await runRelease({
      cwd: '/mock-project',
        json: true,
        bump: 'patch',
        dryRun: false,
        publish: true,
      });
      const payload = okPayload();
      expect(payload.warnings).toContain('registry unreachable');
    });

    it('applies an optional registry override to every unit', async () => {
      await runRelease({
      cwd: '/mock-project',
        json: true,
        bump: 'patch',
        registry: 'https://registry.example.com',
      });
      const payload = okPayload();
      expect(
        payload.units.every(u => u.registry === 'https://registry.example.com')
      ).toBe(true);
    });
  });

  describe('error handling', () => {
    it('emits a RELEASE_ERROR envelope with applied/failed details in JSON mode', async () => {
      vi.mocked(releaseManifest.writeManifestVersion)
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new Error('disk full');
        });
      await runRelease({ cwd: '/mock-project', json: true, bump: 'patch', dryRun: false });
      expect(fail).toHaveBeenCalledWith(
        'RELEASE_ERROR',
        expect.stringContaining('disk full'),
        expect.objectContaining({
          applied: ['checkout'],
          failed: 'shell',
        })
      );
    });

    it('writes red stderr and sets exit code 1 in human mode', async () => {
      vi.mocked(releaseManifest.writeManifestVersion).mockImplementation(() => {
        throw new Error('disk full');
      });
      await runRelease({ cwd: '/mock-project', bump: 'patch', dryRun: false });
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('disk full')
      );
      expect(process.exitCode).toBe(1);
    });
  });

  describe('human renderer', () => {
    it('renders the dry-run banner, per-unit lines and warnings', async () => {
      await runRelease({ cwd: '/mock-project', bump: 'patch' });
      const out = stdoutText();
      expect(out).toContain('release plan — dry-run (no changes written)');
      expect(out).toContain('ui-kit  1.0.0 → 1.0.1');
    });

    it('renders "applied" mode and published markers', async () => {
      await runRelease({ cwd: '/mock-project', bump: 'patch', dryRun: false, publish: true });
      const out = stdoutText();
      expect(out).toContain('release plan — applied');
      expect(out).toContain('[published]');
    });

    it('renders "No units to release." when the plan is empty', async () => {
      vi.mocked(changedFilesSince).mockResolvedValueOnce([]);
      await runRelease({ cwd: '/mock-project', bump: 'patch' });
      const out = stdoutText();
      expect(out).toContain('No units to release.');
    });
  });
});
