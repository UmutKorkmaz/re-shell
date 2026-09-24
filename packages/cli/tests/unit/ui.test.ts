import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import {
  resolveUiProject,
  resolveBundledDashboard,
  createUiLaunchPlan,
  launchUi,
  type UiLaunchPlan,
} from '../../src/commands/ui';

// Covers src/commands/ui.ts — the `re-shell ui` command (669 lines):
// dashboard project resolution (monorepo / standalone / explicit path),
// launch-plan construction (static bundle vs vite-dev, host/port
// normalization, hub token + env), and the launch flow (dry-run / json /
// static / vite-dev) including signal teardown. Resolution + planning run
// against REAL temp directory trees; process spawning is mocked.

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
    spawnSync: vi.fn(),
  };
});
vi.mock('../../src/utils/ui-static-server', () => ({
  startStaticServer: vi.fn(),
}));

const { spawn, spawnSync } = await import('child_process');
const spawnMock = vi.mocked(spawn);
const spawnSyncMock = vi.mocked(spawnSync);
const { startStaticServer } = await import('../../src/utils/ui-static-server');

class FakeChild extends EventEmitter {
  killed = false;
  exitCode: number | null = null;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill(_signal?: string) {
    this.killed = true;
    this.exitCode = this.exitCode ?? 0;
    this.emit('exit', this.exitCode, _signal);
    return true;
  }
}

/** Queue a fake child for the NEXT spawn call. */
function makeFakeChild(): FakeChild {
  const child = new FakeChild();
  vi.mocked(spawn).mockImplementationOnce(() => child as never);
  return child;
}

/** Queue two fake children: hub first, then the dashboard. */
function makeFakeLaunch(): { hub: FakeChild; dashboard: FakeChild } {
  const hub = makeFakeChild();
  const dashboard = makeFakeChild();
  return { hub, dashboard };
}

let tempRoot: string;
let logs: string[];
let envBackup: Record<string, string | undefined>;

function output(): string {
  return logs.join('\n');
}

/** Stage a monorepo-shaped tree with apps/web as the dashboard app. */
function stageMonorepo(root: string, extra: Record<string, unknown> = {}): string {
  const appDir = path.join(root, 'apps/web');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify({ name: '@re-shell/dashboard', ...extra }, null, 2)
  );
  return appDir;
}

beforeEach(() => {
  vi.clearAllMocks();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-ui-'));
  logs = [];
  envBackup = {
    RE_SHELL_UI_PATH: process.env.RE_SHELL_UI_PATH,
    RE_SHELL_BUNDLED_DASHBOARD_DIR: process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR,
  };
  delete process.env.RE_SHELL_UI_PATH;
  delete process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR;
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.join(' '));
  });
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    logs.push(args.join(' '));
  });
  vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
  // Signal handlers schedule process.exit after a 50ms grace period; without
  // this no-op the real exit would terminate the vitest worker mid-test.
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('ui — command', () => {
  describe('resolveUiProject', () => {
    it('resolves the dashboard under apps/web from the given cwd', () => {
      stageMonorepo(tempRoot);
      const resolved = resolveUiProject(undefined, tempRoot);
      expect(resolved.uiRoot).toBe(tempRoot);
      expect(resolved.appPath).toBe(path.join(tempRoot, 'apps/web'));
    });

    it('resolves apps/dashboard as an alternative relative path', () => {
      const appDir = path.join(tempRoot, 'apps/dashboard');
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, 'package.json'),
        JSON.stringify({ name: '@re-shell/dashboard' })
      );
      const resolved = resolveUiProject(undefined, tempRoot);
      expect(resolved.appPath).toBe(appDir);
    });

    it('resolves a standalone dashboard package by recognized name (parent = uiRoot)', () => {
      // A checkout of the dashboard repo itself: package name matches a
      // recognized UI app name, so uiRoot is two levels up.
      const standalone = path.join(tempRoot, 're-shell-ui');
      fs.mkdirSync(standalone, { recursive: true });
      fs.writeFileSync(
        path.join(standalone, 'package.json'),
        JSON.stringify({ name: '@re-shell/ui-web' })
      );
      const resolved = resolveUiProject(undefined, standalone);
      expect(resolved.appPath).toBe(standalone);
      expect(resolved.uiRoot).toBe(path.dirname(tempRoot));
    });

    it('prefers the explicit uiPath over cwd candidates', () => {
      stageMonorepo(tempRoot); // cwd candidate
      const explicitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-ui-explicit-'));
      stageMonorepo(explicitRoot);
      try {
        const resolved = resolveUiProject(explicitRoot, tempRoot);
        expect(resolved.uiRoot).toBe(explicitRoot);
      } finally {
        fs.rmSync(explicitRoot, { recursive: true, force: true });
      }
    });

    it('throws with actionable guidance when an explicit path has no dashboard', () => {
      const bogus = path.join(tempRoot, 'nowhere');
      expect(() => resolveUiProject(bogus, tempRoot)).toThrow(/Could not locate the Re-Shell dashboard/);
      expect(() => resolveUiProject(bogus, tempRoot)).toThrow(/--ui-path/);
    });
  });

  describe('resolveBundledDashboard', () => {
    it('returns the dashboard dir when index.html and hub-server.js exist', () => {
      const bundleDir = path.join(tempRoot, 'dist-dashboard');
      fs.mkdirSync(bundleDir, { recursive: true });
      fs.writeFileSync(path.join(bundleDir, 'index.html'), '<html></html>');
      fs.writeFileSync(path.join(bundleDir, 'hub-server.js'), '// hub');
      process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = bundleDir;

      const bundled = resolveBundledDashboard();
      expect(bundled).toBeDefined();
      expect(bundled!.dashboardDir).toBe(bundleDir);
      expect(bundled!.hubBundlePath).toBe(path.join(bundleDir, 'hub-server.js'));
    });

    it('returns undefined when the hub bundle is missing', () => {
      const bundleDir = path.join(tempRoot, 'dist-dashboard');
      fs.mkdirSync(bundleDir, { recursive: true });
      fs.writeFileSync(path.join(bundleDir, 'index.html'), '<html></html>');
      process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = bundleDir;

      expect(resolveBundledDashboard()).toBeUndefined();
    });
  });

  describe('createUiLaunchPlan', () => {
    it('builds a static plan when a bundled dashboard is available', () => {
      const bundleDir = path.join(tempRoot, 'dist-dashboard');
      fs.mkdirSync(bundleDir, { recursive: true });
      fs.writeFileSync(path.join(bundleDir, 'index.html'), '<html></html>');
      fs.writeFileSync(path.join(bundleDir, 'hub-server.js'), '// hub');
      process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = bundleDir;

      const plan = createUiLaunchPlan({ workspace: tempRoot });
      expect(plan.mode).toBe('static');
      expect(plan.command).toBe('node');
      expect(plan.packageManager).toBe('node');
      expect(plan.dashboardDir).toBe(bundleDir);
      expect(plan.hubBundlePath).toBe(path.join(bundleDir, 'hub-server.js'));
    });

    it('falls back to vite-dev when no bundle is present', () => {
      stageMonorepo(tempRoot);
      const plan = createUiLaunchPlan({ workspace: tempRoot });
      expect(plan.mode).toBe('vite-dev');
      expect(plan.appPath).toBe(path.join(tempRoot, 'apps/web'));
    });

    it('forces vite-dev when an explicit uiPath is given even with a bundle present', () => {
      stageMonorepo(tempRoot);
      const bundleDir = path.join(tempRoot, 'dist-dashboard');
      fs.mkdirSync(bundleDir, { recursive: true });
      fs.writeFileSync(path.join(bundleDir, 'index.html'), '');
      fs.writeFileSync(path.join(bundleDir, 'hub-server.js'), '');
      process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = bundleDir;

      const plan = createUiLaunchPlan({ uiPath: tempRoot, workspace: tempRoot });
      expect(plan.mode).toBe('vite-dev');
    });

    it('normalizes the default host and port and derives the hub port', () => {
      stageMonorepo(tempRoot);
      const plan = createUiLaunchPlan({ workspace: tempRoot });
      expect(plan.url).toBe('http://127.0.0.1:3333');
      expect(plan.hubPort).toBe('3334');
      expect(plan.hubUrl).toBe('http://127.0.0.1:3334');
    });

    it('applies explicit host and port overrides', () => {
      stageMonorepo(tempRoot);
      const plan = createUiLaunchPlan({ workspace: tempRoot, host: 'localhost', port: '8080' });
      expect(plan.url).toBe('http://localhost:8080');
      expect(plan.hubPort).toBe('8081');
    });

    it('rejects an invalid port', () => {
      stageMonorepo(tempRoot);
      expect(() => createUiLaunchPlan({ workspace: tempRoot, port: '99999' })).toThrow(
        /Invalid UI port/
      );
      expect(() => createUiLaunchPlan({ workspace: tempRoot, port: 'abc' })).toThrow(
        /Invalid UI port/
      );
    });

    it('rejects an unsupported package manager', () => {
      stageMonorepo(tempRoot);
      expect(() =>
        createUiLaunchPlan({ workspace: tempRoot, packageManager: 'choco' })
      ).toThrow(/Unsupported package manager "choco"/);
    });

    it('detects the package manager from workspace lockfiles', () => {
      stageMonorepo(tempRoot);
      fs.writeFileSync(path.join(tempRoot, 'pnpm-lock.yaml'), '');
      expect(createUiLaunchPlan({ workspace: tempRoot }).packageManager).toBe('pnpm');

      fs.rmSync(path.join(tempRoot, 'pnpm-lock.yaml'), { force: true });
      fs.writeFileSync(path.join(tempRoot, 'yarn.lock'), '');
      expect(createUiLaunchPlan({ workspace: tempRoot }).packageManager).toBe('yarn');
    });

    it('accepts every supported package manager and builds per-PM vite args', () => {
      stageMonorepo(tempRoot);
      const pnpm = createUiLaunchPlan({ workspace: tempRoot, packageManager: 'pnpm' });
      expect(pnpm.command).toBe('pnpm');
      expect(pnpm.args).toEqual(['exec', 'vite', '--host', '127.0.0.1', '--port', '3333']);

      const npm = createUiLaunchPlan({ workspace: tempRoot, packageManager: 'npm' });
      expect(npm.args).toEqual(['exec', 'vite', '--', '--host', '127.0.0.1', '--port', '3333']);

      const yarn = createUiLaunchPlan({ workspace: tempRoot, packageManager: 'yarn' });
      expect(yarn.args).toEqual(['vite', '--host', '127.0.0.1', '--port', '3333']);

      const bun = createUiLaunchPlan({ workspace: tempRoot, packageManager: 'bun' });
      expect(bun.args).toEqual(['x', 'vite', '--host', '127.0.0.1', '--port', '3333']);
    });

    it('assembles the dashboard + hub env with workspace, token, and URLs', () => {
      stageMonorepo(tempRoot);
      const plan = createUiLaunchPlan({ workspace: tempRoot });
      expect(plan.env.RE_SHELL_WORKSPACE).toBe(tempRoot);
      expect(plan.env.RE_SHELL_UI_HUB_PORT).toBe('3334');
      expect(plan.env.VITE_RE_SHELL_UI_HUB_URL).toBe('http://127.0.0.1:3334');
      expect(plan.env.VITE_RE_SHELL_UI_HUB_TOKEN).toBe(plan.hubToken);
      expect(plan.env.VITE_RE_SHELL_UI_HUB_TOKEN).toMatch(/^[0-9a-f]{64}$/);
      expect(plan.env.RE_SHELL_UI_HUB_MANAGED).toBe('1');
    });

    it('generates a fresh 256-bit hub token per launch', () => {
      stageMonorepo(tempRoot);
      const a = createUiLaunchPlan({ workspace: tempRoot });
      const b = createUiLaunchPlan({ workspace: tempRoot });
      expect(a.hubToken).toMatch(/^[0-9a-f]{64}$/);
      expect(a.hubToken).not.toBe(b.hubToken);
    });
  });

  describe('launchUi — dry-run and JSON output', () => {
    it('prints the plan summary in dry-run mode without spawning', async () => {
      stageMonorepo(tempRoot);
      await launchUi({ dryRun: true, workspace: tempRoot });
      expect(output()).toContain('Re-Shell UI launch plan');
      expect(output()).toContain('Mode: vite-dev');
      expect(output()).toContain(`UI root: ${tempRoot}`);
      expect(output()).toContain('Dashboard: http://127.0.0.1:3333');
      expect(output()).toContain('Hub: http://127.0.0.1:3334');
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('prints the static-mode plan lines in dry-run', async () => {
      const bundleDir = path.join(tempRoot, 'dist-dashboard');
      fs.mkdirSync(bundleDir, { recursive: true });
      fs.writeFileSync(path.join(bundleDir, 'index.html'), '');
      fs.writeFileSync(path.join(bundleDir, 'hub-server.js'), '');
      process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = bundleDir;

      await launchUi({ dryRun: true, workspace: tempRoot });
      expect(output()).toContain('Mode: static');
      expect(output()).toContain(`Static server: serving ${bundleDir}`);
    });

    it('emits the full plan as JSON with --json', async () => {
      stageMonorepo(tempRoot);
      await launchUi({ json: true, workspace: tempRoot });
      const plan = JSON.parse(logs[logs.length - 1]) as UiLaunchPlan;
      expect(plan.mode).toBe('vite-dev');
      expect(plan.url).toBe('http://127.0.0.1:3333');
      expect(plan.env.RE_SHELL_WORKSPACE).toBe(tempRoot);
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  describe('launchUi — vite-dev flow', () => {
    it('spawns the package-manager command in the dashboard dir and tears down on exit', async () => {
      stageMonorepo(tempRoot);
      fs.mkdirSync(path.join(tempRoot, 'apps/web/dist'), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, 'apps/web/dist/hub-server.js'), '// hub');

      const { hub, dashboard } = makeFakeLaunch();
      const launch = launchUi({ workspace: tempRoot });

      await vi.waitFor(() => {
        expect(spawnMock).toHaveBeenCalledTimes(2);
      });
      // First spawn = hub (plain node), second = the vite dashboard process.
      expect(spawnMock).toHaveBeenNthCalledWith(
        1,
        'node',
        [path.join(tempRoot, 'apps/web/dist/hub-server.js')],
        expect.objectContaining({ cwd: path.join(tempRoot, 'apps/web/dist') })
      );
      expect(spawnMock).toHaveBeenNthCalledWith(
        2,
        'pnpm',
        ['exec', 'vite', '--host', '127.0.0.1', '--port', '3333'],
        expect.objectContaining({ cwd: path.join(tempRoot, 'apps/web') })
      );
      // Hub bundle already built → no build:hub spawnSync.
      expect(spawnSyncMock).not.toHaveBeenCalled();

      dashboard.emit('exit', 0, null);
      hub.emit('exit', 0, null);
      await launch;
    });

    it('builds the hub bundle on demand when it is missing', async () => {
      stageMonorepo(tempRoot);
      const { hub, dashboard } = makeFakeLaunch();

      // The hub bundle appears after the on-demand build "runs".
      const hubPath = path.join(tempRoot, 'apps/web/dist/hub-server.js');
      spawnSyncMock.mockImplementationOnce(() => {
        fs.mkdirSync(path.dirname(hubPath), { recursive: true });
        fs.writeFileSync(hubPath, '// hub');
        return { status: 0 } as never;
      });

      const launch = launchUi({ workspace: tempRoot });
      await vi.waitFor(() => {
        expect(spawnSyncMock).toHaveBeenCalledWith(
          'pnpm',
          ['run', 'build:hub'],
          expect.objectContaining({ cwd: path.join(tempRoot, 'apps/web') }
          )
        );
      });

      dashboard.emit('exit', 0, null);
      hub.emit('exit', 0, null);
      await launch;
    });

    it('launches without the hub when the on-demand build fails', async () => {
      stageMonorepo(tempRoot);
      const child = makeFakeChild();
      spawnSyncMock.mockImplementationOnce(() => ({ status: 1 }) as never);

      const launch = launchUi({ workspace: tempRoot });
      await vi.waitFor(() => {
        expect(output()).toContain('launching dashboard without the hub');
      });
      expect(spawnMock).toHaveBeenCalledTimes(1); // dashboard only, no hub

      child.emit('exit', 0, null);
      await launch;
    });

    it('rejects when the dashboard process exits non-zero', async () => {
      stageMonorepo(tempRoot);
      fs.mkdirSync(path.join(tempRoot, 'apps/web/dist'), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, 'apps/web/dist/hub-server.js'), '// hub');

      const { hub, dashboard } = makeFakeLaunch();
      const launch = launchUi({ workspace: tempRoot });
      await vi.waitFor(() => {
        expect(spawnMock).toHaveBeenCalledTimes(2);
      });

      dashboard.emit('exit', 1, null);
      hub.emit('exit', 0, null);
      await expect(launch).rejects.toThrow('Re-Shell UI exited with code 1');
    });
  });

  describe('launchUi — static flow', () => {
    it('starts the static server with hub injection and tears down on SIGINT', async () => {
      const bundleDir = path.join(tempRoot, 'dist-dashboard');
      fs.mkdirSync(bundleDir, { recursive: true });
      fs.writeFileSync(path.join(bundleDir, 'index.html'), '');
      fs.writeFileSync(path.join(bundleDir, 'hub-server.js'), '');
      process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR = bundleDir;

      const fakeServer = new EventEmitter() as EventEmitter & { close: ReturnType<typeof vi.fn> };
      fakeServer.close = vi.fn();
      vi.mocked(startStaticServer).mockResolvedValueOnce({
        server: fakeServer,
        close: fakeServer.close,
      } as never);
      makeFakeChild(); // hub process

      const launch = launchUi({ workspace: tempRoot });
      await vi.waitFor(() => {
        expect(startStaticServer).toHaveBeenCalledWith(
          expect.objectContaining({
            rootDir: bundleDir,
            host: '127.0.0.1',
            port: 3333,
            hubUrl: 'http://127.0.0.1:3334',
          })
        );
      });

      // Let launchStatic resume past the awaited startStaticServer mock so its
      // signal handlers are attached before we emit.
      await new Promise(resolve => setImmediate(resolve));
      process.emit('SIGINT', 'SIGINT');
      await launch;
      expect(fakeServer.close).toHaveBeenCalled();
    });
  });
});
