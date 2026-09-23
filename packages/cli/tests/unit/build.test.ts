import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import { exec } from 'child_process';
import { buildMicrofrontend } from '../../src/commands/build';
import { flushOutput } from '../../src/utils/spinner';

// Covers src/commands/build.ts — the `re-shell build` command. build shells
// out via promisified exec and process.chdir's into apps/<name> (forbidden in
// vitest workers), so: fs-extra is replaced with a virtual FS (the serve/list
// pattern — bare relative keys for root checks, absolute keys for MF checks),
// child_process.exec is mocked (the command under test promisifies it itself),
// and process.chdir is a no-op spy.

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  exists: new Set<string>(),
  files: new Map<string, string>(),
  dirs: new Set<string>(),
  spinner: {
    setText: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('fs-extra', () => ({
  existsSync: (p: string) => mocks.exists.has(p),
  readFileSync: (p: string) => {
    const content = mocks.files.get(p);
    if (content === undefined) throw new Error(`ENOENT: ${p}`);
    return content;
  },
  readdirSync: (p: string, opts?: { withFileTypes: boolean }) => {
    const entries = [...mocks.dirs]
      .filter(d => d.startsWith(`${p}${path.sep}`))
      .map(d => d.slice(p.length + 1).split(path.sep)[0]);
    const unique = [...new Set(entries)];
    if (!opts?.withFileTypes) return unique;
    return unique.map(name => ({ name, isDirectory: () => true }));
  },
}));

// build.ts promisifies exec itself (promisify(exec)), so the mock must accept
// promisify's callback contract: (cmd, options, callback). promisify passes a
// custom __promisify__-unaware callback as the LAST argument and only resolves
// when it fires.
type ExecCallback = (
  error: Error | null,
  result: { stdout: string; stderr: string }
) => void;
let execBehavior: (cmd: string, cb: ExecCallback) => void = () => undefined;

vi.mocked(exec).mockImplementation(((
  cmd: string,
  optsOrCb: unknown,
  maybeCb?: unknown
) => {
  const cb = (typeof optsOrCb === 'function' ? optsOrCb : maybeCb) as ExecCallback;
  execBehavior(cmd, cb);
  return undefined as never;
}) as never);
// flushOutput is called between spinner frames; keep it silent.
vi.mock('../../src/utils/spinner', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/utils/spinner')>();
  return { ...actual, flushOutput: vi.fn() };
});

const PROJECT = '/mock-project';

function addRootEntry(name: string): void {
  mocks.exists.add(name);
}

function addDir(relPath: string): void {
  const abs = path.join(PROJECT, relPath);
  mocks.exists.add(abs);
  mocks.dirs.add(abs);
}

function addFile(relPath: string, content: string): void {
  const abs = path.join(PROJECT, relPath);
  mocks.exists.add(abs);
  mocks.files.set(abs, content);
}

describe('build — command', () => {
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let chdirSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.exists.clear();
    mocks.files.clear();
    mocks.dirs.clear();
    addRootEntry('package.json');
    addRootEntry('apps');
    // Default exec behavior: succeed with empty output. Tests override via
    // succeedWith / failWith helpers.
    execBehavior = (_cmd, cb) => cb(null, { stdout: '', stderr: '' });
    vi.mocked(exec).mockClear();
    mocks.spinner.setText.mockReset();
    mocks.spinner.stop.mockReset();

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(PROJECT);
    chdirSpy = vi
      .spyOn(process, 'chdir')
      .mockImplementation((() => undefined) as never);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    cwdSpy.mockRestore();
    chdirSpy.mockRestore();
    vi.mocked(flushOutput).mockClear();
  });

  describe('project detection', () => {
    it('rejects when not in a Re-Shell project', async () => {
      mocks.exists.clear();
      await expect(
        buildMicrofrontend(undefined, { spinner: mocks.spinner as never })
      ).rejects.toThrow('Not in a Re-Shell project');
      expect(mocks.spinner.stop).toHaveBeenCalled();
      expect(vi.mocked(exec)).not.toHaveBeenCalled();
    });

    it('rejects when package.json exists but no apps/packages dir', async () => {
      mocks.exists.delete('apps');
      await expect(
        buildMicrofrontend(undefined, { spinner: mocks.spinner as never })
      ).rejects.toThrow('Not in a Re-Shell project');
    });
  });

  describe('build a specific microfrontend', () => {
    beforeEach(() => {
      addDir('apps/checkout');
      addFile('apps/checkout/package.json', '{"scripts":{"build":"vite build"}}');
    });

    it('rejects when the microfrontend directory is missing', async () => {
      await expect(
        buildMicrofrontend('nope', { spinner: mocks.spinner as never })
      ).rejects.toThrow('Microfrontend "nope" not found in apps directory.');
      expect(vi.mocked(exec)).not.toHaveBeenCalled();
    });

    it('rejects when the microfrontend has no package.json', async () => {
      addDir('apps/bare');
      await expect(
        buildMicrofrontend('bare', { spinner: mocks.spinner as never })
      ).rejects.toThrow('package.json not found for microfrontend "bare".');
    });

    it('rejects when the microfrontend has no build script', async () => {
      addDir('apps/noscript');
      addFile('apps/noscript/package.json', '{"scripts":{}}');
      await expect(
        buildMicrofrontend('noscript', { spinner: mocks.spinner as never })
      ).rejects.toThrow('No build script found in package.json for microfrontend "noscript".');
    });

    it('runs the npm build command by default', async () => {
      succeedWith('bundled', '');
      await buildMicrofrontend('checkout', { spinner: mocks.spinner as never });
      expect(execCommand()).toBe('npm run build');
      expect(execEnvNodeEnv()).toBe('development');
      expect(logged()).toContain('bundled');
      expect(logged()).toContain('Successfully built microfrontend "checkout"');
      expect(chdirSpy).toHaveBeenCalledWith(path.join(PROJECT, 'apps', 'checkout'));
    });

    it('sets NODE_ENV=production when the production option is set', async () => {
      succeedWith('', '');
      await buildMicrofrontend('checkout', {
        production: true,
        spinner: mocks.spinner as never,
      });
      expect(execCommand()).toBe('npm run build');
      expect(execEnvNodeEnv()).toBe('production');
    });

    it('prefers pnpm when the MF has a pnpm-lock.yaml', async () => {
      addFile('apps/checkout/pnpm-lock.yaml', '');
      succeedWith('', '');
      await buildMicrofrontend('checkout', { spinner: mocks.spinner as never });
      expect(execCommand()).toBe('pnpm build');
    });

    it('prefers yarn when the MF has a yarn.lock', async () => {
      addFile('apps/checkout/yarn.lock', '');
      succeedWith('', '');
      await buildMicrofrontend('checkout', { spinner: mocks.spinner as never });
      expect(execCommand()).toBe('yarn build');
    });

    it('appends --analyze when the analyze option is set', async () => {
      succeedWith('', '');
      await buildMicrofrontend('checkout', {
        analyze: true,
        spinner: mocks.spinner as never,
      });
      expect(execCommand()).toBe('npm run build -- --analyze');
    });

    it('prints build stderr to console.error', async () => {
      succeedWith('out', 'a warning');
      await buildMicrofrontend('checkout', { spinner: mocks.spinner as never });
      expect(errors()).toContain('a warning');
    });

    it('wraps a failed build as a friendly error and restores cwd', async () => {
      failWith('exit 1');
      await expect(
        buildMicrofrontend('checkout', { spinner: mocks.spinner as never })
      ).rejects.toThrow('Failed to build microfrontend "checkout": exit 1');
      // finally-branch chdir back to the original cwd
      expect(chdirSpy).toHaveBeenLastCalledWith(PROJECT);
    });

    it('announces the build without a spinner', async () => {
      succeedWith('', '');
      await buildMicrofrontend('checkout');
      expect(logged()).toContain('Building microfrontend "checkout"...');
    });
  });

  describe('build all microfrontends', () => {
    it('rejects when the apps dir disappears', async () => {
      // packages-only root passes project detection but has no apps dir.
      mocks.exists.delete('apps');
      addRootEntry('packages');
      await expect(
        buildMicrofrontend(undefined, { spinner: mocks.spinner as never })
      ).rejects.toThrow('Apps directory not found. Is this a valid Re-Shell project?');
    });

    it('reports when no buildable microfrontends are found', async () => {
      // apps dir exists (root entry) but contains no MF package.json
      const appsAbs = path.join(PROJECT, 'apps');
      mocks.exists.add(appsAbs);
      mocks.dirs.add(appsAbs);
      await buildMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(logged()).toContain('No microfrontends found to build.');
      expect(vi.mocked(exec)).not.toHaveBeenCalled();
    });

    it('runs the workspace build command via npm by default', async () => {
      seedApps();
      succeedWith('done', '');
      await buildMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(execCommand()).toBe('npm run build');
      expect(mocks.spinner.setText).toHaveBeenCalledWith('Building 2 microfrontends...');
      expect(logged()).toContain('Successfully built all microfrontends');
    });

    it('prefers pnpm for the workspace build when pnpm-lock.yaml exists', async () => {
      seedApps();
      addRootEntry('pnpm-lock.yaml');
      succeedWith('', '');
      await buildMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(execCommand()).toBe('pnpm run build');
    });

    it('prefers yarn for the workspace build when yarn.lock exists', async () => {
      seedApps();
      addRootEntry('yarn.lock');
      succeedWith('', '');
      await buildMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(execCommand()).toBe('yarn build');
    });

    it('uses the singular form when exactly one microfrontend builds', async () => {
      addDir('apps/only');
      addFile('apps/only/package.json', '{"scripts":{"build":"x"}}');
      const appsAbs = path.join(PROJECT, 'apps');
      mocks.exists.add(appsAbs);
      mocks.dirs.add(appsAbs);
      succeedWith('', '');
      await buildMicrofrontend(undefined, { spinner: mocks.spinner as never });
      expect(mocks.spinner.setText).toHaveBeenCalledWith('Building 1 microfrontend...');
    });

    it('wraps a failed workspace build as a friendly error', async () => {
      seedApps();
      const appsAbs = path.join(PROJECT, 'apps');
      mocks.exists.add(appsAbs);
      mocks.dirs.add(appsAbs);
      failWith('oom');
      await expect(
        buildMicrofrontend(undefined, { spinner: mocks.spinner as never })
      ).rejects.toThrow('Failed to build microfrontends: oom');
    });

    it('announces the workspace build without a spinner', async () => {
      seedApps();
      const appsAbs = path.join(PROJECT, 'apps');
      mocks.exists.add(appsAbs);
      mocks.dirs.add(appsAbs);
      succeedWith('', '');
      await buildMicrofrontend(undefined);
      expect(logged()).toContain('Building 2 microfrontends...');
    });
  });

  function seedApps(): void {
    addDir('apps/checkout');
    addFile('apps/checkout/package.json', '{"scripts":{"build":"x"}}');
    addDir('apps/cart');
    addFile('apps/cart/package.json', '{"scripts":{"build":"x"}}');
    // readdirSync walks from the resolved apps dir
    const appsAbs = path.join(PROJECT, 'apps');
    mocks.exists.add(appsAbs);
    mocks.dirs.add(appsAbs);
  }

  /** Make the promisified exec resolve with the given stdout/stderr. */
  function succeedWith(stdout: string, stderr: string): void {
    execBehavior = (_cmd, cb) => cb(null, { stdout, stderr });
  }

  /** Make the promisified exec reject with the given message. */
  function failWith(message: string): void {
    execBehavior = (_cmd, cb) =>
      cb(Object.assign(new Error(message), { code: 1 }), { stdout: '', stderr: '' });
  }

  /** The command string from the (single) exec invocation. */
  function execCommand(): string {
    return vi.mocked(exec).mock.calls[0][0] as string;
  }

  /** NODE_ENV from the env object of ANY exec invocation. */
  function execEnvNodeEnv(): string | undefined {
    for (const call of vi.mocked(exec).mock.calls) {
      const opts = call.find(
        a => a && typeof a === 'object' && 'env' in (a as Record<string, unknown>)
      ) as { env?: Record<string, string | undefined> } | undefined;
      if (opts?.env?.NODE_ENV) return opts.env.NODE_ENV;
    }
    return undefined;
  }

  function logged(): string {
    return logSpy.mock.calls.map(c => String(c[0])).join('\n');
  }

  function errors(): string {
    return errorSpy.mock.calls.map(c => String(c[0])).join('\n');
  }
});
