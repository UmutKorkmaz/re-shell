import { describe, it, expect, beforeEach, vi } from 'vitest';

// remove.ts mutates the filesystem (removeSync), reads shell sources for
// references, and prompts for confirmation. We reuse the virtual-filesystem
// mock pattern (vitest workers ban process.chdir) plus a prompts mock.

const ROOT = '/mock-project';

const { vfs, removeSync } = vi.hoisted(() => ({
  vfs: { dirs: new Set<string>(), files: new Map<string, string>() },
  removeSync: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  existsSync: (p: string) => {
    const full = p.startsWith('/') ? p : `${ROOT}/${p}`;
    return vfs.dirs.has(full) || vfs.files.has(full);
  },
  readFileSync: (p: string) => vfs.files.get(p) ?? '',
  removeSync,
}));

vi.mock('prompts', () => ({ default: vi.fn() }));

import { removeMicrofrontend } from '../../src/commands/remove';
import prompts from 'prompts';

const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(ROOT);

beforeEach(() => {
  vfs.dirs.clear();
  vfs.files.clear();
  removeSync.mockClear();
  vi.clearAllMocks();
  cwdSpy.mockReturnValue(ROOT);
});

/** Mark the mock root as a Re-Shell project with an apps/ dir. */
function makeProject(): void {
  vfs.dirs.add(ROOT);
  vfs.files.set(`${ROOT}/package.json`, '{}');
  vfs.dirs.add(`${ROOT}/apps`);
}

describe('removeMicrofrontend — preconditions', () => {
  it('throws when run outside a Re-Shell project', async () => {
    vfs.dirs.add(ROOT); // no package.json, no apps/packages
    await expect(removeMicrofrontend('dashboard', { force: true })).rejects.toThrow(
      'Not in a Re-Shell project',
    );
  });

  it('throws when the named microfrontend does not exist under apps/', async () => {
    makeProject();
    await expect(removeMicrofrontend('ghost', { force: true })).rejects.toThrow(
      'Microfrontend "ghost" not found',
    );
    expect(removeSync).not.toHaveBeenCalled();
  });
});

describe('removeMicrofrontend — name normalization', () => {
  it('lowercases the name and converts whitespace to hyphens', async () => {
    makeProject();
    vfs.dirs.add(`${ROOT}/apps/my-app`);
    await removeMicrofrontend('My App', { force: true });
    expect(removeSync).toHaveBeenCalledWith(`${ROOT}/apps/my-app`);
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('"my-app"');
  });
});

describe('removeMicrofrontend — confirmation flow', () => {
  it('removes without prompting when force is set', async () => {
    makeProject();
    vfs.dirs.add(`${ROOT}/apps/dashboard`);
    await removeMicrofrontend('dashboard', { force: true });
    expect(prompts).not.toHaveBeenCalled();
    expect(removeSync).toHaveBeenCalledWith(`${ROOT}/apps/dashboard`);
    expect(log.mock.calls.some(c => String(c[0]).includes('Successfully removed'))).toBe(true);
  });

  it('removes after the user confirms', async () => {
    makeProject();
    vfs.dirs.add(`${ROOT}/apps/dashboard`);
    vi.mocked(prompts).mockResolvedValue({ confirm: true } as never);
    await removeMicrofrontend('dashboard', {});
    expect(prompts).toHaveBeenCalled();
    expect(removeSync).toHaveBeenCalledWith(`${ROOT}/apps/dashboard`);
  });

  it('cancels and does not remove when the user declines', async () => {
    makeProject();
    vfs.dirs.add(`${ROOT}/apps/dashboard`);
    vi.mocked(prompts).mockResolvedValue({ confirm: false } as never);
    await removeMicrofrontend('dashboard', {});
    expect(removeSync).not.toHaveBeenCalled();
    expect(log.mock.calls.some(c => String(c[0]).includes('Operation cancelled'))).toBe(true);
  });
});

describe('removeMicrofrontend — shell reference detection', () => {
  it('warns when the microfrontend is referenced in a shell source file', async () => {
    makeProject();
    vfs.dirs.add(`${ROOT}/apps/dashboard`);
    vfs.dirs.add(`${ROOT}/apps/shell`);
    vfs.dirs.add(`${ROOT}/apps/shell/src`);
    vfs.files.set(`${ROOT}/apps/shell/src/App.tsx`, 'import dashboard from "dashboard";');
    await removeMicrofrontend('dashboard', { force: true });
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('appears to be referenced');
    // Still removed after the warning.
    expect(removeSync).toHaveBeenCalled();
  });

  it('does not warn when the shell has no references', async () => {
    makeProject();
    vfs.dirs.add(`${ROOT}/apps/dashboard`);
    vfs.dirs.add(`${ROOT}/apps/shell`);
    vfs.dirs.add(`${ROOT}/apps/shell/src`);
    vfs.files.set(`${ROOT}/apps/shell/src/App.tsx`, 'import other from "other";');
    await removeMicrofrontend('dashboard', { force: true });
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).not.toContain('appears to be referenced');
  });

  it('skips the shell check entirely when no shell app exists', async () => {
    makeProject();
    vfs.dirs.add(`${ROOT}/apps/dashboard`);
    // no apps/shell dir
    await removeMicrofrontend('dashboard', { force: true });
    expect(removeSync).toHaveBeenCalled();
  });
});
