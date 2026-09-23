import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { exec } from 'child_process';
import { serveMicrofrontend } from '../../src/commands/serve';
import { processManager } from '../../src/utils/error-handler';

// Covers src/commands/serve.ts — the `re-shell serve` command. serve spawns a
// real dev-server child process and calls process.stdin.resume()/keepRunning(),
// which would hang a unit test forever, and vitest workers forbid process.chdir
// (which serve uses to enter apps/<name>). So: fs-extra is replaced with a
// virtual FS (the list.test.ts pattern) so project detection works without a
// real cwd; child_process.exec is mocked so nothing actually spawns.

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  exists: new Set<string>(),
  spinner: {
    setText: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('fs-extra', () => ({
  existsSync: (p: string) => mocks.exists.has(p),
}));

vi.mocked(exec).mockImplementation(mocks.exec as never);

const PROJECT = '/mock-project';

function addFile(relPath: string): void {
  mocks.exists.add(path.join(PROJECT, relPath));
}

/** Root checks use bare relative paths ('apps'), MF checks use absolute ones. */
function addRootEntry(name: string): void {
  mocks.exists.add(name);
}

interface FakeChild {
  stdout: { on: vi.Mock };
  stderr: { on: vi.Mock };
  on: vi.Mock;
}

function makeChild(): FakeChild {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  };
}

describe('serve — command', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let chdirSpy: ReturnType<typeof vi.spyOn>;
  let resumeSpy: ReturnType<typeof vi.spyOn>;
  let keepRunningSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // A minimal Re-Shell project root in the virtual FS. serve's root checks
    // use bare relative paths (fs.existsSync('package.json') etc.), so those
    // keys are stored as-is; microfrontend checks use path.resolve'd absolute
    // paths (see the specific-MF describe block).
    mocks.exists.clear();
    addRootEntry('package.json');
    addRootEntry('apps');

    mocks.exec.mockReset();
    mocks.spinner.setText.mockReset();
    mocks.spinner.stop.mockReset();

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(PROJECT);
    chdirSpy = vi
      .spyOn(process, 'chdir')
      .mockImplementation((() => undefined) as never);
    resumeSpy = vi
      .spyOn(process.stdin, 'resume')
      .mockImplementation((() => undefined) as never);
    keepRunningSpy = vi
      .spyOn(processManager, 'keepRunning')
      .mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    keepRunningSpy.mockRestore();
    resumeSpy.mockRestore();
    cwdSpy.mockRestore();
    chdirSpy.mockRestore();
  });

  describe('project detection', () => {
    it('rejects when not in a Re-Shell project', async () => {
      mocks.exists.clear();
      await expect(
        serveMicrofrontend(undefined, { spinner: mocks.spinner as never })
      ).rejects.toThrow('Not in a Re-Shell project');
      expect(mocks.spinner.stop).toHaveBeenCalled();
      expect(mocks.exec).not.toHaveBeenCalled();
    });

    it('rejects when package.json exists but no apps/packages dir', async () => {
      mocks.exists.delete('apps');
      await expect(
        serveMicrofrontend(undefined, { spinner: mocks.spinner as never })
      ).rejects.toThrow('Not in a Re-Shell project');
    });

    it('accepts a packages/ dir without apps/', async () => {
      mocks.exists.delete('apps');
      addRootEntry('packages');
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(mocks.exec).toHaveBeenCalled();
    });
  });

  describe('serve all', () => {
    it('uses npm when no lockfile is present', async () => {
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(mocks.exec).toHaveBeenCalledWith('npm run dev');
      expect(mocks.spinner.stop).toHaveBeenCalled();
      expect(keepRunningSpy).toHaveBeenCalled();
      expect(resumeSpy).toHaveBeenCalled();
      expect(logged()).toContain('Development servers started');
    });

    it('prefers pnpm when pnpm-lock.yaml exists', async () => {
      addRootEntry('pnpm-lock.yaml');
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(mocks.exec).toHaveBeenCalledWith('pnpm run dev');
    });

    it('prefers yarn when yarn.lock exists', async () => {
      addRootEntry('yarn.lock');
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(mocks.exec).toHaveBeenCalledWith('yarn dev');
    });

    it('pipes child stdout/stderr and registers exit handling', async () => {
      const child = makeChild();
      mocks.exec.mockReturnValue(child);
      await serveMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(child.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(child.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(child.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    it('reports a non-zero child exit code on stderr', async () => {
      const child = makeChild();
      mocks.exec.mockReturnValue(child);
      await serveMicrofrontend(undefined, { spinner: mocks.spinner as never });
      const exitHandler = child.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'exit'
      )![1] as (code: number | null) => void;
      exitHandler(1);
      expect(errors()).toContain('exited with code 1');
    });

    it('stays silent on a zero child exit code', async () => {
      const child = makeChild();
      mocks.exec.mockReturnValue(child);
      await serveMicrofrontend(undefined, { spinner: mocks.spinner as never });
      const exitHandler = child.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'exit'
      )![1] as (code: number | null) => void;
      exitHandler(0);
      expect(errors()).toBe('');
    });

    it('wraps a spawn failure as a friendly error', async () => {
      mocks.exec.mockImplementation(() => {
        throw new Error('spawn failed');
      });
      await expect(
        serveMicrofrontend(undefined, { spinner: mocks.spinner as never })
      ).rejects.toThrow('Failed to start development servers: spawn failed');
    });
  });

  describe('serve a specific microfrontend', () => {
    beforeEach(() => {
      addFile('apps/checkout');
      addFile('apps/checkout/package.json');
    });

    it('rejects when the microfrontend directory is missing', async () => {
      await expect(
        serveMicrofrontend('nope', { spinner: mocks.spinner as never })
      ).rejects.toThrow('Microfrontend "nope" not found in apps directory.');
      expect(mocks.exec).not.toHaveBeenCalled();
    });

    it('rejects when the microfrontend has no package.json', async () => {
      addFile('apps/bare');
      await expect(
        serveMicrofrontend('bare', { spinner: mocks.spinner as never })
      ).rejects.toThrow('package.json not found for microfrontend "bare".');
      expect(mocks.exec).not.toHaveBeenCalled();
    });

    it('builds the serve command from defaults', async () => {
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend('checkout', { spinner: mocks.spinner as never });
      expect(mocks.exec).toHaveBeenCalledWith(
        'npm run dev -- --port 3000 --host localhost'
      );
      expect(logged()).toContain(
        'Starting development server for microfrontend "checkout"'
      );
    });

    it('applies custom port and host options', async () => {
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend('checkout', {
        port: '4200',
        host: '0.0.0.0',
        spinner: mocks.spinner as never,
      });
      expect(mocks.exec).toHaveBeenCalledWith(
        'npm run dev -- --port 4200 --host 0.0.0.0'
      );
      expect(logged()).toContain('http://0.0.0.0:4200');
    });

    it('adds --open when the open option is set', async () => {
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend('checkout', {
        open: true,
        spinner: mocks.spinner as never,
      });
      expect(mocks.exec).toHaveBeenCalledWith(
        'npm run dev -- --port 3000 --host localhost --open'
      );
    });

    it('chdirs into the microfrontend directory before serving', async () => {
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend('checkout', { spinner: mocks.spinner as never });
      expect(chdirSpy).toHaveBeenCalledWith(
        path.resolve(PROJECT, 'apps', 'checkout')
      );
    });

    it('keeps the process running and pipes output', async () => {
      const child = makeChild();
      mocks.exec.mockReturnValue(child);
      await serveMicrofrontend('checkout', { spinner: mocks.spinner as never });
      expect(keepRunningSpy).toHaveBeenCalled();
      expect(resumeSpy).toHaveBeenCalled();
      expect(child.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(child.on).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(logged()).toContain('Press Ctrl+C to stop the server');
    });

    it('reports the dev-server URL', async () => {
      mocks.exec.mockReturnValue(makeChild());
      await serveMicrofrontend('checkout', {
        port: '5173',
        host: 'local.test',
        spinner: mocks.spinner as never,
      });
      expect(logged()).toContain('http://local.test:5173');
    });

    it('wraps a spawn failure as a friendly error', async () => {
      mocks.exec.mockImplementation(() => {
        throw new Error('no dev script');
      });
      await expect(
        serveMicrofrontend('checkout', { spinner: mocks.spinner as never })
      ).rejects.toThrow('Failed to start development server: no dev script');
    });
  });

  function logged(): string {
    return logSpy.mock.calls.map((c) => String(c[0])).join('\n');
  }

  function errors(): string {
    return errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
  }
});
