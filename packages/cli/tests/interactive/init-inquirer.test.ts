import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { makeTmpWorkspace, inWorkspace } from './harness';

/**
 * inquirer-based interactive flow: `init` (monorepo initialization).
 *
 * `initMonorepo` drives its wizard through the `inquirer` library (not `prompts`),
 * so we mock `inquirer.prompt` to feed scripted answers. We also force a TTY so the
 * interactive branch runs (init skips prompts entirely when stdout is not a TTY).
 *
 * `../../src/utils/config` is mocked to a no-op `configManager` because its
 * `validateGlobalConfig` path uses a runtime `require('./validation')` of a TS file
 * that vitest's source loader cannot resolve; that concern is orthogonal to the
 * interactive flow under test (the full config path is covered by the PTY black-box
 * test which runs the compiled binary).
 */

const inquirerAnswers = {
  projectType: 'frontend',
  template: 'blank',
  typescript: true,
  customStructure: false,
  saveAsPreset: false,
};

const promptMock = vi.fn(async () => inquirerAnswers);

vi.mock('inquirer', () => ({
  default: { prompt: promptMock },
}));

vi.mock('../../src/utils/config', () => ({
  configManager: { createProjectConfig: vi.fn(async () => ({})) },
  CONFIG_PATHS: { GLOBAL_DIR: '', GLOBAL_CONFIG: '' },
}));

describe('init via mocked inquirer (interactive branch)', () => {
  it('initializes a monorepo using scripted inquirer answers', async () => {
    const ws = makeTmpWorkspace('re-shell-init-');
    const prevTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    const prevCI = process.env.CI;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    });
    delete process.env.CI;
    promptMock.mockClear();

    try {
      await inWorkspace(ws.dir, async () => {
        const { initMonorepo } = await import('../../src/commands/init');
        await initMonorepo('demo-mono', {
          packageManager: 'pnpm',
          skipInstall: true,
          git: false,
          submodules: false,
        });
      });

      // The interactive inquirer prompt must have been consulted.
      expect(promptMock).toHaveBeenCalled();

      const projDir = path.join(ws.dir, 'demo-mono');
      const pkg = fs.readJsonSync(path.join(projDir, 'package.json'));
      expect(pkg.name).toBe('demo-mono');
      expect(pkg.private).toBe(true);
      expect(Array.isArray(pkg.workspaces)).toBe(true);
      expect(pkg.workspaces).toContain('apps/*');
    } finally {
      if (prevTTY) {
        Object.defineProperty(process.stdout, 'isTTY', prevTTY);
      } else {
        Object.defineProperty(process.stdout, 'isTTY', {
          value: undefined,
          configurable: true,
        });
      }
      if (prevCI !== undefined) process.env.CI = prevCI;
      ws.cleanup();
    }
  });
});
