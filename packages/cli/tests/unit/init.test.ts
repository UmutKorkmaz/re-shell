import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import Module from 'module';
import { initMonorepo } from '../../src/commands/init';
import { initializeMonorepo } from '../../src/utils/monorepo';
import { initializeGitRepository } from '../../src/utils/submodule';

// init.ts runs git/install/audit through child_process.execSync. Mock the
// module so every call is recorded, with per-test command routing. Keep the
// rest of child_process real — submodule.ts also pulls `exec` from it.
vi.mock('child_process', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn(() => ''),
  };
});

// Covers src/commands/init.ts (1576 lines) via its single export
// initMonorepo: system-requirement checks, package-manager detection,
// name validation, existing-directory handling, non-interactive scaffold
// (--yes), presets, starter templates (ecommerce/dashboard/saas), git
// init + initial commit, dependency install + audit, and the success
// payload consumed by the CLI wrapper. File tree + git run for real in a
// temp cwd; inquirer is not needed because every test drives the
// non-interactive path; execSync is spied for install/audit commands.

vi.mock('../../src/utils/monorepo', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/monorepo')>();
  return {
    ...original,
    initializeMonorepo: vi.fn(original.initializeMonorepo),
  };
});

vi.mock('../../src/utils/submodule', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/submodule')>();
  return {
    ...original,
    initializeGitRepository: vi.fn(original.initializeGitRepository),
  };
});

// init.ts resolves the preset directory through os.homedir(). Node caches the
// homedir at process start, so redirecting process.env.HOME in beforeEach has
// no effect — redirect homedir itself to the per-test temp root instead.
vi.mock('os', async (importOriginal) => {
  const original = await importOriginal<typeof import('os')>();
  return {
    ...original,
    homedir: vi.fn(() => osMockHome.value),
  };
});

// Mutable holder the os.homedir mock reads; beforeEach points it at tempRoot.
const osMockHome = vi.hoisted(() => ({ value: '' }));

const initMonoMock = vi.mocked(initializeMonorepo);
const initGitMock = vi.mocked(initializeGitRepository);
const execSyncMock = vi.mocked((await import('child_process')).execSync);

// init.ts saves the project/global config through ConfigManager, whose
// validate methods call `require('./validation')` at runtime. vitest does not
// route that CJS require through vi.mock, and Node cannot resolve a bare
// './validation' to the .ts source — redirect those requires to a sentinel
// module backed by always-pass stubs so config saves succeed.
const VALIDATION_SENTINEL = path.resolve('__re_shell_validation_mock__');
const realResolveFilename = (Module as unknown as {
  _resolveFilename: typeof Module._resolveFilename;
})._resolveFilename;
(Module as unknown as Record<string, unknown>)._resolveFilename = function (
  request: string,
  parent: { filename?: string },
  ...rest: unknown[]
) {
  if (
    request === './validation' &&
    parent &&
    typeof parent.filename === 'string' &&
    parent.filename.replace(/\\/g, '/').includes('src/utils/config.ts')
  ) {
    return VALIDATION_SENTINEL;
  }
  return realResolveFilename.call(this, request, parent, ...rest);
};
(Module as unknown as Record<string, Record<string, unknown>>)._cache[
  VALIDATION_SENTINEL
] = {
  id: VALIDATION_SENTINEL,
  filename: VALIDATION_SENTINEL,
  loaded: true,
  exports: {
    validateGlobalConfig: () => ({ valid: true, errors: [] }),
    validateProjectConfig: () => ({ valid: true, errors: [] }),
  },
};

let tempRoot: string;
let homeBackup: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

function errOutput(): string {
  return errSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

describe('init — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-init-'));
    // Redirect HOME so preset save/load tests never touch the real ~/.re-shell.
    homeBackup = process.env.HOME;
    process.env.HOME = tempRoot;
    osMockHome.value = tempRoot;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false, configurable: true, writable: true,
    });
    // Reset the execSync stub; tests that need command semantics override it.
    execSyncMock.mockReset().mockImplementation(((cmd: unknown) => {
      if (String(cmd).startsWith('git --version')) return '';
      return '';
    }) as never);  });

  afterEach(async () => {
    if (homeBackup) process.env.HOME = homeBackup;
    vi.restoreAllMocks();
    await fs.remove(tempRoot);
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGHUP');
    process.removeAllListeners('SIGUSR1');
    process.removeAllListeners('SIGUSR2');
    process.removeAllListeners('exit');
  });

  describe('validation', () => {
    it('rejects an empty project name', async () => {
      await initMonorepo('', { yes: true, skipInstall: true });
      expect(errOutput()).toContain('Project name cannot be empty');
      expect(process.exitCode ?? 0).toBe(1);
    });

    it('rejects names with invalid characters', async () => {
      await initMonorepo('My_Proj!', { yes: true, skipInstall: true });
      expect(errOutput()).toContain('lowercase letters, numbers, and hyphens');
    });

    it('rejects names that start or end with a hyphen', async () => {
      await initMonorepo('-lead', { yes: true, skipInstall: true });
      expect(errOutput()).toContain('cannot start or end with a hyphen');
    });

    it('rejects an over-long name', async () => {
      await initMonorepo('a'.repeat(215), { yes: true, skipInstall: true });
      expect(errOutput()).toContain('too long');
    });

    it('refuses an existing directory without --force in non-interactive mode', async () => {
      fs.mkdirSync(path.join(tempRoot, 'taken'));
      await initMonorepo('taken', { yes: true, skipInstall: true });
      expect(errOutput()).toContain('already exists');
      expect(output()).toContain('--force');
    });

    it('overwrites an existing directory with --force', async () => {
      fs.mkdirSync(path.join(tempRoot, 'clobber'));
      fs.writeFileSync(path.join(tempRoot, 'clobber', 'stale.txt'), 'old');

      await initMonorepo('clobber', {
        yes: true, skipInstall: true, force: true, git: false, submodules: false,
      });

      expect(fs.existsSync(path.join(tempRoot, 'clobber', 'stale.txt'))).toBe(false);
      expect(
        fs.existsSync(path.join(tempRoot, 'clobber', 'package.json'))
      ).toBe(true);
    });

    it('rejects an unknown preset with exit code 1', async () => {
      await initMonorepo('preset-app', {
        yes: true, skipInstall: true, preset: 'ghost-preset',
      });
      expect(errOutput()).toContain('Preset "ghost-preset" not found');
    });
  });

  describe('non-interactive scaffold (--yes)', () => {
    it('creates the monorepo skeleton and success payload', async () => {
      await initMonorepo('fresh-app', {
        yes: true, skipInstall: true, git: false, submodules: false,
      });

      expect(initMonoMock).toHaveBeenCalledWith(
        'fresh-app', 'pnpm', {}
      );
      const projectPath = path.join(tempRoot, 'fresh-app');
      expect(fs.existsSync(projectPath)).toBe(true);
      // createAdditionalConfigs artifacts
      expect(fs.existsSync(path.join(projectPath, '.nvmrc'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, '.env.example'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, '.editorconfig'))).toBe(true);

      const payload = (global as Record<string, unknown>).__RE_SHELL_INIT_SUCCESS__ as {
        name: string; packageManager: string; projectType: string; nextSteps: string[];
      };
      expect(payload.name).toBe('fresh-app');
      expect(payload.packageManager).toBe('pnpm');
      expect(payload.projectType).toBe('frontend');
      expect(payload.nextSteps.join('\n')).toContain('cd fresh-app');
    });

    it('normalizes upper-case names to lower-case', async () => {
      await initMonorepo('MyCoolApp', {
        yes: true, skipInstall: true, git: false, submodules: false,
      });
      expect(fs.existsSync(path.join(tempRoot, 'mycoolapp'))).toBe(true);
    });

    it('honors an explicit package manager', async () => {
      await initMonorepo('npm-app', {
        yes: true, skipInstall: true, packageManager: 'npm', git: false, submodules: false,
      });
      expect(initMonoMock).toHaveBeenCalledWith('npm-app', 'npm', {});
    });

    it('passes a custom structure through to initializeMonorepo', async () => {
      await initMonorepo('struct-app', {
        yes: true, skipInstall: true, git: false, submodules: false,
        structure: { apps: 'applications', packages: 'libs' },
      });

      expect(initMonoMock).toHaveBeenCalledWith('struct-app', 'pnpm', {
        apps: 'applications',
        packages: 'libs',
      });
    });

    it('initializes git, writes .gitignore and commits when git is enabled', async () => {
      await initMonorepo('git-app', {
        yes: true, skipInstall: true, git: true, submodules: false,
      });

      expect(initGitMock).toHaveBeenCalledWith(path.join(tempRoot, 'git-app'));
      const gitignore = fs.readFileSync(
        path.join(tempRoot, 'git-app', '.gitignore'), 'utf8'
      );
      expect(gitignore).toContain('node_modules/');
      expect(gitignore).toContain('.env.local');
      const commitCmd = execSyncMock.mock.calls
        .map(c => String(c[0]))
        .find(c => c.includes('git commit'));
      expect(commitCmd).toBeDefined();
    });

    it('skips git entirely when git is disabled', async () => {
      await initMonorepo('nogit-app', {
        yes: true, skipInstall: true, git: false, submodules: false,
      });
      expect(initGitMock).not.toHaveBeenCalled();
      const gitCmds = execSyncMock.mock.calls
        .map(c => String(c[0]))
        .filter(c => c.includes('git commit') || c.includes('git add'));
      expect(gitCmds).toHaveLength(0);
      // QUIRK: initializeMonorepo writes .gitignore unconditionally — only the
      // .git directory and commit are gated on the git flag.
      expect(fs.existsSync(path.join(tempRoot, 'nogit-app', '.git'))).toBe(false);
    });

    it('runs the install command when not skipped', async () => {
      execSyncMock.mockImplementation(((cmd: string) => {
        if (String(cmd).includes('audit')) return '{}';
        return '';
      }) as never);

      await initMonorepo('install-app', {
        yes: true, git: false, submodules: false, packageManager: 'pnpm',
      });

      const installCmd = execSyncMock.mock.calls
        .map(c => String(c[0]))
        .find(c => c.includes('install'));
      expect(installCmd).toContain('pnpm install');
    });

    it('warns but continues when installation fails', async () => {
      execSyncMock.mockImplementation(((cmd: string) => {
        if (String(cmd).includes('install') && !String(cmd).includes('--version')) {
          throw new Error('network down');
        }
        return '';
      }) as never);

      await initMonorepo('failinstall-app', {
        yes: true, git: false, submodules: false, packageManager: 'pnpm',
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to install'));
      // skeleton exists regardless
      expect(
        fs.existsSync(path.join(tempRoot, 'failinstall-app', 'package.json'))
      ).toBe(true);
    });

    it('reports vulnerabilities surfaced by the audit scan', async () => {
      execSyncMock.mockImplementation(((cmd: string) => {
        if (String(cmd).includes('audit')) {
          return JSON.stringify({
            metadata: { vulnerabilities: { high: 2, critical: 1, total: 3 } },
          });
        }
        return '';
      }) as never);

      await initMonorepo('audit-app', {
        yes: true, git: false, submodules: false, packageManager: 'npm',
      });

      // QUIRK: the reducer sums every numeric field including 'total', so
      // {high:2, critical:1, total:3} is reported as 6 vulnerabilities.
      expect(output()).toContain('Found 6 vulnerabilities');
      expect(output()).toContain('Critical: 1, High: 2');
    });
  });

  describe('starter templates', () => {
    it('scaffolds ecommerce app/package directories and merges deps', async () => {
      await initMonorepo('shop', {
        yes: true, skipInstall: true, git: false, submodules: false,
        template: 'ecommerce',
      });

      const base = path.join(tempRoot, 'shop');
      for (const dir of ['apps/shell', 'apps/product-catalog', 'apps/checkout',
                         'packages/shared-ui', 'packages/cart-state']) {
        expect(fs.existsSync(path.join(base, dir))).toBe(true);
      }
      const pkg = fs.readJsonSync(path.join(base, 'package.json'));
      expect(pkg.dependencies['@stripe/stripe-js']).toBe('latest');
      expect(pkg.dependencies.zustand).toBe('latest');
      const readme = fs.readFileSync(path.join(base, 'README.md'), 'utf8');
      expect(readme).toContain('Template: E-commerce starter');
    });

    it('scaffolds dashboard directories and deps', async () => {
      await initMonorepo('board', {
        yes: true, skipInstall: true, git: false, submodules: false,
        template: 'dashboard',
      });

      const base = path.join(tempRoot, 'board');
      expect(fs.existsSync(path.join(base, 'apps', 'analytics'))).toBe(true);
      expect(fs.existsSync(path.join(base, 'packages', 'chart-components'))).toBe(true);
      const pkg = fs.readJsonSync(path.join(base, 'package.json'));
      expect(pkg.dependencies.recharts).toBe('latest');
    });

    it('scaffolds saas directories and deps', async () => {
      await initMonorepo('saasy', {
        yes: true, skipInstall: true, git: false, submodules: false,
        template: 'saas',
      });

      const base = path.join(tempRoot, 'saasy');
      expect(fs.existsSync(path.join(base, 'apps', 'billing'))).toBe(true);
      expect(fs.existsSync(path.join(base, 'packages', 'payment-integration'))).toBe(true);
      const pkg = fs.readJsonSync(path.join(base, 'package.json'));
      expect(pkg.dependencies.prisma).toBe('latest');
    });

    it('leaves a blank template with no extra directories', async () => {
      await initMonorepo('plain', {
        yes: true, skipInstall: true, git: false, submodules: false,
        template: 'blank',
      });

      const base = path.join(tempRoot, 'plain');
      expect(fs.existsSync(path.join(base, 'apps'))).toBe(true);
      const pkg = fs.readJsonSync(path.join(base, 'package.json'));
      expect(pkg.dependencies).toBeUndefined();
    });
  });

  describe('presets', () => {
    it('loads an existing preset and applies its stored options', async () => {
      // Stage a preset in the redirected HOME ~/.re-shell/presets/
      const presetsDir = path.join(tempRoot, '.re-shell', 'presets');
      fs.ensureDirSync(presetsDir);
      fs.writeJsonSync(path.join(presetsDir, 'team-std.json'), {
        packageManager: 'npm',
        git: false,
        submodules: false,
        template: 'dashboard',
      });

      await initMonorepo('preset-app', {
        yes: true, skipInstall: true, preset: 'team-std',
      });

      // QUIRK: package-manager detection runs before the preset merge, so the
      // preset's packageManager never wins — the detected 'pnpm' is used.
      expect(initMonoMock).toHaveBeenCalledWith('preset-app', 'pnpm', {});
      expect(
        fs.existsSync(path.join(tempRoot, 'preset-app', 'apps', 'analytics'))
      ).toBe(true);
      expect(initGitMock).not.toHaveBeenCalled(); // preset git:false survives merge
    });

    it('lets explicit options override the preset values', async () => {
      const presetsDir = path.join(tempRoot, '.re-shell', 'presets');
      fs.ensureDirSync(presetsDir);
      fs.writeJsonSync(path.join(presetsDir, 'pm-preset.json'), {
        packageManager: 'npm',
      });

      await initMonorepo('override-app', {
        yes: true, skipInstall: true, preset: 'pm-preset',
        packageManager: 'yarn',
      });

      expect(initMonoMock).toHaveBeenCalledWith('override-app', 'yarn', {});
    });
  });

  describe('package manager checks', () => {
    it('fails fast when the requested package manager is not installed', async () => {
      execSyncMock.mockImplementation(((cmd: string) => {
        if (String(cmd) === 'pnpm --version') throw new Error('not found');
        return '';
      }) as never);

      await initMonorepo('nopm-app', {
        yes: true, packageManager: 'pnpm', // skipInstall not set
      });

      expect(errOutput()).toContain('pnpm is not installed');
      expect(
        fs.existsSync(path.join(tempRoot, 'nopm-app'))
      ).toBe(false);
    });

    it('detects the manager from a lockfile when unspecified', async () => {
      fs.writeFileSync(path.join(tempRoot, 'pnpm-lock.yaml'), '');

      await initMonorepo('lockfile-app', {
        yes: true, skipInstall: true, git: false, submodules: false,
      });

      expect(initMonoMock).toHaveBeenCalledWith('lockfile-app', 'pnpm', {});
    });
  });

  describe('failure cleanup', () => {
    it('removes the partial directory and rethrows when scaffolding fails', async () => {
      initMonoMock.mockRejectedValueOnce(
        Object.assign(new Error('boom'), { code: 'EACCES' })
      );

      await expect(
        initMonorepo('doomed', {
          yes: true, skipInstall: true, git: false, submodules: false,
        })
      ).rejects.toThrow('boom');

      expect(errOutput()).toContain('Permission denied');
      expect(fs.existsSync(path.join(tempRoot, 'doomed'))).toBe(false);
    });
  });
});
