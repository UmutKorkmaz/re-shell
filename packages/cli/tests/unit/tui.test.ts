import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fsReal from 'fs';
import * as path from 'path';
import * as os from 'os';
import { launchTUI } from '../../src/commands/tui';
import { launchGoTUI } from '../../src/commands/tui-go';

// Covers src/commands/tui.ts + src/commands/tui-go.ts — the TUI launchers.
// launchInkTUI is mocked (it starts a full interactive React session);
// the Go launcher's child_process spawn is mocked so no `go` binary is needed.

vi.mock('../../src/commands/ink-tui', () => ({
  launchInkTUI: vi.fn(async () => undefined),
}));
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
  execSync: vi.fn(),
}));
vi.mock('fs-extra', () => {
  const real = require('fs') as typeof import('fs');
  return {
    existsSync: vi.fn((p: string) => real.existsSync(p)),
  };
});

const { launchInkTUI } = await import('../../src/commands/ink-tui');
const { spawn } = await import('child_process');
const fse = await import('fs-extra');

const inkMock = vi.mocked(launchInkTUI);
const spawnMock = vi.mocked(spawn);
const existsMock = vi.mocked(fse.existsSync);

/** A spawn child stub whose exit the test can trigger. */
function fakeChild(): {
  child: { on: ReturnType<typeof vi.fn> };
  emit: (event: string, arg?: unknown) => void;
} {
  const handlers = new Map<string, Array<(arg?: unknown) => void>>();
  const child = {
    on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
    }),
  };
  return {
    child,
    emit: (event: string, arg?: unknown) => {
      for (const cb of handlers.get(event) ?? []) cb(arg);
    },
  };
}

describe('tui — command', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    inkMock.mockReset();
    inkMock.mockResolvedValue(undefined);
    spawnMock.mockReset();
    delete process.env.RE_SHELL_GO_TUI_DIR;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    delete process.env.RE_SHELL_GO_TUI_DIR;
    vi.restoreAllMocks();
  });

  describe('launchTUI routing', () => {
    it('routes to the Ink TUI by default with mode/project defaults', async () => {
      await launchTUI({ project: '/my/project' });
      expect(inkMock).toHaveBeenCalledWith({
        projectPath: '/my/project',
        mode: 'dashboard',
        debug: false,
      });
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('passes explicit mode and debug flags through to Ink', async () => {
      await launchTUI({ mode: 'init', debug: true, project: '/x' });
      expect(inkMock).toHaveBeenCalledWith({
        projectPath: '/x',
        mode: 'init',
        debug: true,
      });
    });

    it('routes to the Go TUI when --go is set', async () => {
      const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-gotui-'));
      fsReal.writeFileSync(path.join(dir, 'main.go'), 'package main\n');
      process.env.RE_SHELL_GO_TUI_DIR = dir;
      const { child, emit } = fakeChild();
      spawnMock.mockReturnValue(child as never);
      try {
        const pending = launchTUI({ go: true, mode: 'manage', debug: true, project: '/p' });
        await Promise.resolve();
        expect(spawnMock).toHaveBeenCalledWith(
          'go',
          ['run', '.'],
          expect.objectContaining({ cwd: dir, stdio: 'inherit' })
        );
        emit('exit', 0);
        await pending;
        expect(inkMock).not.toHaveBeenCalled();
      } finally {
        fsReal.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('launchGoTUI', () => {
    it('throws an actionable error when the Go source is missing', async () => {
      await expect(launchGoTUI({})).rejects.toThrow('Legacy Go TUI source not found');
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('resolves the env-var dir, passes mode/project/debug env and exits 0', async () => {
      const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-gotui-'));
      fsReal.writeFileSync(path.join(dir, 'main.go'), 'package main\n');
      process.env.RE_SHELL_GO_TUI_DIR = dir;
      const { child, emit } = fakeChild();
      spawnMock.mockReturnValue(child as never);
      try {
        const pending = launchGoTUI({ project: '/proj', mode: 'config', debug: true });
        await Promise.resolve();
        const env = spawnMock.mock.calls[0][2]?.env as Record<string, string>;
        expect(env.RE_SHELL_PROJECT).toBe('/proj');
        expect(env.RE_SHELL_TUI_MODE).toBe('config');
        expect(env.RE_SHELL_DEBUG).toBe('1');
        emit('exit', 0);
        await expect(pending).resolves.toBeUndefined();
      } finally {
        fsReal.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('defaults project to cwd, mode to dashboard, debug to empty', async () => {
      const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-gotui-'));
      fsReal.writeFileSync(path.join(dir, 'main.go'), 'package main\n');
      process.env.RE_SHELL_GO_TUI_DIR = dir;
      const { child, emit } = fakeChild();
      spawnMock.mockReturnValue(child as never);
      try {
        const pending = launchGoTUI({});
        await Promise.resolve();
        const env = spawnMock.mock.calls[0][2]?.env as Record<string, string>;
        expect(env.RE_SHELL_PROJECT).toBe(process.cwd());
        expect(env.RE_SHELL_TUI_MODE).toBe('dashboard');
        expect(env.RE_SHELL_DEBUG).toBe('');
        emit('exit', null);
        await expect(pending).resolves.toBeUndefined();
      } finally {
        fsReal.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects with a PATH hint when go is not installed (ENOENT)', async () => {
      const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-gotui-'));
      fsReal.writeFileSync(path.join(dir, 'main.go'), 'package main\n');
      process.env.RE_SHELL_GO_TUI_DIR = dir;
      const { child, emit } = fakeChild();
      spawnMock.mockReturnValue(child as never);
      try {
        const pending = launchGoTUI({});
        await Promise.resolve();
        const err = new Error('spawn go ENOENT') as Error & { code: string };
        err.code = 'ENOENT';
        emit('error', err);
        await expect(pending).rejects.toThrow('Go toolchain not found on PATH');
      } finally {
        fsReal.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects verbatim on a non-ENOENT spawn error', async () => {
      const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-gotui-'));
      fsReal.writeFileSync(path.join(dir, 'main.go'), 'package main\n');
      process.env.RE_SHELL_GO_TUI_DIR = dir;
      const { child, emit } = fakeChild();
      spawnMock.mockReturnValue(child as never);
      try {
        const pending = launchGoTUI({});
        await Promise.resolve();
        emit('error', new Error('EACCES'));
        await expect(pending).rejects.toThrow('EACCES');
      } finally {
        fsReal.rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects with the exit code when the TUI fails', async () => {
      const dir = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-gotui-'));
      fsReal.writeFileSync(path.join(dir, 'main.go'), 'package main\n');
      process.env.RE_SHELL_GO_TUI_DIR = dir;
      const { child, emit } = fakeChild();
      spawnMock.mockReturnValue(child as never);
      try {
        const pending = launchGoTUI({});
        await Promise.resolve();
        emit('exit', 3);
        await expect(pending).rejects.toThrow('exited with code 3');
      } finally {
        fsReal.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
