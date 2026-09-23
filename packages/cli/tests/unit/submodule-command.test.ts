import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addGitSubmodule,
  removeGitSubmodule,
  updateGitSubmodules,
  showSubmoduleStatus,
  initSubmodules,
  manageSubmodules,
} from '../../src/commands/submodule';

// Covers src/commands/submodule.ts — the `submodule add/remove/update/status/
// init/manage` command surface. All git-touching utils (utils/submodule) and
// findMonorepoRoot are mocked; prompts are mocked so interactive flows are
// driven deterministically. Named -command.test.ts because submodule.test.ts
// covers the util layer (PR #266).

const mocks = vi.hoisted(() => ({
  isGitRepository: vi.fn(),
  addSubmodule: vi.fn(),
  removeSubmodule: vi.fn(),
  updateSubmodules: vi.fn(),
  getSubmoduleStatus: vi.fn(),
  createSubmoduleDocumentation: vi.fn(),
  findMonorepoRoot: vi.fn(),
  prompts: vi.fn(),
  spinner: {
    setText: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  },
}));

vi.mock('../../src/utils/submodule', () => ({
  addSubmodule: mocks.addSubmodule,
  removeSubmodule: mocks.removeSubmodule,
  updateSubmodules: mocks.updateSubmodules,
  getSubmoduleStatus: mocks.getSubmoduleStatus,
  createSubmoduleDocumentation: mocks.createSubmoduleDocumentation,
  isGitRepository: mocks.isGitRepository,
}));

vi.mock('../../src/utils/monorepo', () => ({
  findMonorepoRoot: mocks.findMonorepoRoot,
}));

vi.mock('prompts', () => ({ default: mocks.prompts }));

function subFixture(status?: string): Record<string, string> {
  return {
    name: 'shared-lib',
    path: 'libs/shared-lib',
    url: 'git@github.com:org/shared-lib.git',
    branch: 'main',
    commit: 'abcd1234',
    ...(status ? { status } : {}),
  };
}

describe('submodule — command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of Object.keys(mocks) as (keyof typeof mocks)[]) {
      (mocks[key] as { mockReset?: () => void }).mockReset?.();
    }
    mocks.isGitRepository.mockResolvedValue(true);
    mocks.findMonorepoRoot.mockResolvedValue('/mono-root');
    mocks.createSubmoduleDocumentation.mockResolvedValue(undefined);
    mocks.addSubmodule.mockResolvedValue(undefined);
    mocks.removeSubmodule.mockResolvedValue(undefined);
    mocks.updateSubmodules.mockResolvedValue(undefined);
    mocks.getSubmoduleStatus.mockResolvedValue([]);
    mocks.prompts.mockResolvedValue({});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('addGitSubmodule', () => {
    it('rejects when not in a git repository', async () => {
      mocks.isGitRepository.mockResolvedValue(false);
      await expect(
        addGitSubmodule('git@github.com:org/lib.git', { spinner: mocks.spinner as never })
      ).rejects.toThrow('Not in a Git repository. Initialize Git first with: git init');
      expect(mocks.spinner.fail).toHaveBeenCalled();
    });

    it('prompts for missing path and branch, then adds and documents', async () => {
      mocks.prompts.mockResolvedValue({ path: 'libs/lib', branch: 'develop' });
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      await addGitSubmodule('git@github.com:org/lib.git', {
        spinner: mocks.spinner as never,
      });
      expect(mocks.addSubmodule).toHaveBeenCalledWith(
        'libs/lib',
        'git@github.com:org/lib.git',
        'develop'
      );
      expect(mocks.createSubmoduleDocumentation).toHaveBeenCalledWith(
        '/mono-root',
        expect.any(Array)
      );
      expect(mocks.spinner.succeed).toHaveBeenCalled();
      expect(logged()).toContain('Documentation updated in docs/SUBMODULES.md');
    });

    it('uses provided options without prompting for them', async () => {
      await addGitSubmodule('git@github.com:org/lib.git', {
        path: 'libs/custom',
        branch: 'release',
        spinner: mocks.spinner as never,
      });
      // prompts still consulted but its answers are not needed
      expect(mocks.addSubmodule).toHaveBeenCalledWith(
        'libs/custom',
        'git@github.com:org/lib.git',
        'release'
      );
    });

    it('falls back to the main branch when prompting yields nothing', async () => {
      mocks.prompts.mockResolvedValue({ path: 'libs/lib' });
      await addGitSubmodule('git@github.com:org/lib.git');
      expect(mocks.addSubmodule).toHaveBeenCalledWith(
        'libs/lib',
        'git@github.com:org/lib.git',
        'main'
      );
    });

    it('logs success without a spinner', async () => {
      mocks.prompts.mockResolvedValue({ path: 'libs/lib', branch: 'main' });
      await addGitSubmodule('git@github.com:org/lib.git');
      expect(logged()).toContain('Submodule added successfully: libs/lib');
    });

    it('rethrows util failures with an error log', async () => {
      mocks.prompts.mockResolvedValue({ path: 'libs/lib', branch: 'main' });
      mocks.addSubmodule.mockRejectedValue(new Error('clone failed'));
      await expect(addGitSubmodule('git@github.com:org/lib.git')).rejects.toThrow(
        'clone failed'
      );
      expect(errors()).toContain('Error adding submodule:');
    });
  });

  describe('removeGitSubmodule', () => {
    it('rejects when not in a git repository', async () => {
      mocks.isGitRepository.mockResolvedValue(false);
      await expect(removeGitSubmodule('libs/x')).rejects.toThrow('Not in a Git repository.');
    });

    it('rejects when the submodule is unknown', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      await expect(removeGitSubmodule('libs/other')).rejects.toThrow(
        'Submodule not found: libs/other'
      );
      expect(mocks.removeSubmodule).not.toHaveBeenCalled();
    });

    it('matches by name as well as path', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      mocks.prompts.mockResolvedValue({ confirm: true });
      await removeGitSubmodule('shared-lib');
      expect(mocks.removeSubmodule).toHaveBeenCalledWith('libs/shared-lib');
    });

    it('asks for confirmation without --force', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      mocks.prompts.mockResolvedValue({ confirm: true });
      await removeGitSubmodule('libs/shared-lib');
      expect(mocks.prompts).toHaveBeenCalled();
      expect(mocks.removeSubmodule).toHaveBeenCalledWith('libs/shared-lib');
      expect(mocks.createSubmoduleDocumentation).toHaveBeenCalled();
    });

    it('cancels when the confirmation is declined', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      mocks.prompts.mockResolvedValue({ confirm: false });
      await removeGitSubmodule('libs/shared-lib');
      expect(mocks.removeSubmodule).not.toHaveBeenCalled();
      expect(logged()).toContain('Operation cancelled.');
    });

    it('skips the prompt with force', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      await removeGitSubmodule('libs/shared-lib', { force: true });
      expect(mocks.prompts).not.toHaveBeenCalled();
      expect(mocks.removeSubmodule).toHaveBeenCalledWith('libs/shared-lib');
      expect(logged()).toContain('Submodule removed successfully: libs/shared-lib');
    });

    it('rethrows util failures with an error log', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      mocks.removeSubmodule.mockRejectedValue(new Error('deinit failed'));
      await expect(
        removeGitSubmodule('libs/shared-lib', { force: true })
      ).rejects.toThrow('deinit failed');
      expect(errors()).toContain('Error removing submodule:');
    });
  });

  describe('updateGitSubmodules', () => {
    it('rejects when not in a git repository', async () => {
      mocks.isGitRepository.mockResolvedValue(false);
      await expect(updateGitSubmodules()).rejects.toThrow('Not in a Git repository.');
    });

    it('updates a single submodule when a path is given', async () => {
      await updateGitSubmodules({ path: 'libs/shared-lib', spinner: mocks.spinner as never });
      expect(mocks.updateSubmodules).toHaveBeenCalledWith('libs/shared-lib');
      expect(mocks.spinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('libs/shared-lib')
      );
    });

    it('updates all submodules without a path', async () => {
      await updateGitSubmodules({ spinner: mocks.spinner as never });
      expect(mocks.updateSubmodules).toHaveBeenCalledWith();
      expect(mocks.spinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('All submodules updated')
      );
    });

    it('refreshes documentation after updating', async () => {
      await updateGitSubmodules();
      expect(mocks.createSubmoduleDocumentation).toHaveBeenCalledWith(
        '/mono-root',
        expect.any(Array)
      );
    });

    it('falls back to cwd when findMonorepoRoot returns null', async () => {
      mocks.findMonorepoRoot.mockResolvedValue(null);
      await updateGitSubmodules();
      expect(mocks.createSubmoduleDocumentation).toHaveBeenCalledWith(
        process.cwd(),
        expect.any(Array)
      );
    });

    it('rethrows util failures with an error log', async () => {
      mocks.updateSubmodules.mockRejectedValue(new Error('fetch failed'));
      await expect(updateGitSubmodules()).rejects.toThrow('fetch failed');
      expect(errors()).toContain('Error updating submodules:');
    });
  });

  describe('showSubmoduleStatus', () => {
    it('exits when not in a git repository', async () => {
      mocks.isGitRepository.mockResolvedValue(false);
      await showSubmoduleStatus();
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errors()).toContain('Not in a git repository');
    });

    it('treats an isGitRepository timeout as not-a-repo', async () => {
      mocks.isGitRepository.mockImplementation(
        () => new Promise<boolean>(() => undefined) // never settles -> 3s race timeout
      );
      // Real timers: the 3s race would slow the suite; stub the race branch by
      // making the timeout the only settler is what the code does anyway.
      await showSubmoduleStatus();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('reports when there are no submodules', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([]);
      await showSubmoduleStatus();
      expect(logged()).toContain('No submodules found.');
    });

    it('renders each submodule and a total', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([
        subFixture('clean'),
        { ...subFixture('modified'), name: 'other-lib', path: 'libs/other-lib' },
      ]);
      await showSubmoduleStatus();
      expect(logged()).toContain('Submodule Status');
      expect(logged()).toContain('shared-lib');
      expect(logged()).toContain('other-lib');
      expect(logged()).toContain('Total: 2 submodules');
    });

    it('renders a status summary only for mixed statuses', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([
        subFixture('clean'),
        { ...subFixture('modified'), name: 'other-lib', path: 'libs/other-lib' },
      ]);
      await showSubmoduleStatus();
      expect(logged()).toContain('Status Summary:');

      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      await showSubmoduleStatus();
      expect(logged().split('Status Summary:').length - 1).toBe(1); // only the first call's
    });
  });

  describe('initSubmodules', () => {
    it('rejects when not in a git repository', async () => {
      mocks.isGitRepository.mockResolvedValue(false);
      await expect(initSubmodules()).rejects.toThrow('Not in a Git repository.');
    });

    it('updates submodules and reports initialization', async () => {
      await initSubmodules();
      expect(mocks.updateSubmodules).toHaveBeenCalledWith();
      expect(logged()).toContain('Submodules initialized');
    });

    it('rethrows util failures with an error log', async () => {
      mocks.updateSubmodules.mockRejectedValue(new Error('init failed'));
      await expect(initSubmodules()).rejects.toThrow('init failed');
      expect(errors()).toContain('Error initializing submodules:');
    });
  });

  describe('manageSubmodules (interactive)', () => {
    it('rejects when not in a git repository', async () => {
      mocks.isGitRepository.mockResolvedValue(false);
      await expect(manageSubmodules()).rejects.toThrow('Not in a Git repository.');
    });

    it('dispatches to status', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'status' });
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      await manageSubmodules();
      expect(logged()).toContain('Submodule Status');
    });

    it('prompts for a URL and adds on the add action', async () => {
      // Answer by question shape: action menu -> URL text -> add's path/branch pair.
      mocks.prompts.mockImplementation(async (question: unknown) => {
        const q = Array.isArray(question) ? question[0] : question;
        if (q?.name === 'action') return { action: 'add' };
        if (q?.name === 'url') return { url: 'git@github.com:org/lib.git' };
        return { path: 'libs/lib', branch: 'main' };
      });
      await manageSubmodules();
      expect(mocks.addSubmodule).toHaveBeenCalledWith(
        'libs/lib',
        'git@github.com:org/lib.git',
        'main'
      );
    });

    it('reports nothing-to-update for the update action with no submodules', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'update' });
      await manageSubmodules();
      expect(logged()).toContain('No submodules to update.');
      expect(mocks.updateSubmodules).not.toHaveBeenCalled();
    });

    it('updates all submodules when chosen', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      mocks.prompts
        .mockResolvedValueOnce({ action: 'update' })
        .mockResolvedValueOnce({ updateTarget: 'all' });
      await manageSubmodules();
      expect(mocks.updateSubmodules).toHaveBeenCalledWith();
    });

    it('updates one submodule when a specific target is chosen', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      mocks.prompts
        .mockResolvedValueOnce({ action: 'update' })
        .mockResolvedValueOnce({ updateTarget: 'libs/shared-lib' });
      await manageSubmodules();
      expect(mocks.updateSubmodules).toHaveBeenCalledWith('libs/shared-lib');
    });

    it('reports nothing-to-remove for the remove action with no submodules', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'remove' });
      await manageSubmodules();
      expect(logged()).toContain('No submodules to remove.');
      expect(mocks.removeSubmodule).not.toHaveBeenCalled();
    });

    it('prompts a target and removes with confirmation', async () => {
      mocks.getSubmoduleStatus.mockResolvedValue([subFixture('clean')]);
      mocks.prompts
        .mockResolvedValueOnce({ action: 'remove' })
        .mockResolvedValueOnce({ removeTarget: 'libs/shared-lib' })
        .mockResolvedValueOnce({ confirm: true });
      await manageSubmodules();
      expect(mocks.removeSubmodule).toHaveBeenCalledWith('libs/shared-lib');
    });

    it('dispatches to init on the init action', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'init' });
      await manageSubmodules();
      expect(mocks.updateSubmodules).toHaveBeenCalledWith();
    });

    it('does nothing when the action prompt answers nothing', async () => {
      // prompts cancelled -> destructure of undefined throws, caught by the
      // outer catch and rethrown after an error log.
      mocks.prompts.mockResolvedValueOnce(undefined);
      await expect(manageSubmodules()).rejects.toThrow();
      expect(errors()).toContain('Error managing submodules:');
      expect(mocks.addSubmodule).not.toHaveBeenCalled();
    });

    it('rethrows failures with an error log', async () => {
      mocks.prompts.mockRejectedValue(new Error('tty gone'));
      await expect(manageSubmodules()).rejects.toThrow('tty gone');
      expect(errors()).toContain('Error managing submodules:');
    });
  });

  function logged(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  function errors(): string {
    return errorSpy.mock.calls.map(c => String(c[0])).join('\n');
  }
});
