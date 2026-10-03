import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';

/**
 * Behavioural tests for scripts/bundle-dashboard.mjs - the step that puts the
 * dashboard into the published CLI (run by the `prepack` hook).
 *
 * The script is executed for real, inside a throwaway copy of the monorepo
 * layout, with a stand-in `pnpm` executable on PATH. The stand-in is the only
 * test double: it records how it was invoked (arguments + environment) and
 * writes a build output the way `vite build` would, so every property the script
 * promises is observed from the outside:
 *
 *   - the dashboard package is selected by the name in apps/web/package.json
 *   - a `pnpm --filter` that matches nothing (exit 0, builds nothing) FAILS the
 *     script instead of shipping whatever stale apps/web/dist exists
 *   - VITE_* / hub-token variables never reach the build environment
 *   - a bundle with an inlined hub token / URL is rejected and not left behind
 */

const realScript = path.resolve(__dirname, '../../scripts/bundle-dashboard.mjs');
const isWindows = process.platform === 'win32';

/** A `pnpm` stand-in; behaviour is chosen with FAKE_PNPM_MODE. */
const FAKE_PNPM = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.env.FAKE_MONOREPO_ROOT;
const mode = process.env.FAKE_PNPM_MODE || 'build';

fs.writeFileSync(
  path.join(root, 'pnpm-invocation.json'),
  JSON.stringify({
    args: process.argv.slice(2),
    cwd: process.cwd(),
    leakedEnv: Object.keys(process.env).filter(
      (key) => key.startsWith('VITE_') || key.startsWith('RE_SHELL_UI_HUB_') || key.startsWith('E2E_HUB_')
    ),
    staleDistPresentAtBuildStart: fs.existsSync(path.join(root, 'apps/web/dist/index.html')),
  })
);

if (mode === 'noop') {
  console.log('No projects matched the filters in "' + root + '"');
  process.exit(0);
}
if (mode === 'fail') {
  console.error('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL build failed');
  process.exit(1);
}

const dist = path.join(root, 'apps/web/dist');
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>dashboard</title>');
const tokenField = mode === 'bake-token'
  ? 'VITE_RE_SHELL_UI_HUB_TOKEN:"0123456789abcdef0123456789abcdef"'
  : mode === 'bake-url'
    ? 'VITE_RE_SHELL_UI_HUB_URL:"http://127.0.0.1:4318"'
    : 'VITE_RE_SHELL_UI_HUB_TOKEN:void 0,VITE_RE_SHELL_UI_HUB_URL:void 0';
fs.writeFileSync(path.join(dist, 'assets/index-abc.js'), 'function s(){return{' + tokenField + '}}');
fs.writeFileSync(path.join(dist, 'hub-server.js'), 'process.env.RE_SHELL_UI_HUB_TOKEN;');
process.exit(0);
`;

describe.skipIf(isWindows)('bundle-dashboard.mjs', () => {
  let root: string;

  /** Run the copied script inside the fake monorepo. */
  function runScript(
    mode: 'build' | 'noop' | 'fail' | 'bake-token' | 'bake-url',
    extraEnv: Record<string, string> = {}
  ) {
    return spawnSync(process.execPath, [path.join(root, 'packages/cli/scripts/bundle-dashboard.mjs')], {
      cwd: path.join(root, 'packages/cli'),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
        FAKE_MONOREPO_ROOT: root,
        FAKE_PNPM_MODE: mode,
        ...extraEnv,
      },
    });
  }

  function pnpmInvocation(): {
    args: string[];
    cwd: string;
    leakedEnv: string[];
    staleDistPresentAtBuildStart: boolean;
  } {
    return JSON.parse(fs.readFileSync(path.join(root, 'pnpm-invocation.json'), 'utf8'));
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-bundle-dashboard-'));
    fs.mkdirSync(path.join(root, 'packages/cli/scripts'), { recursive: true });
    fs.copyFileSync(realScript, path.join(root, 'packages/cli/scripts/bundle-dashboard.mjs'));
    fs.mkdirSync(path.join(root, 'apps/web'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'apps/web/package.json'),
      JSON.stringify({ name: '@re-shell/dashboard', version: '0.1.0' })
    );
    fs.mkdirSync(path.join(root, 'bin'));
    fs.writeFileSync(path.join(root, 'bin/pnpm'), FAKE_PNPM, { mode: 0o755 });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('builds the dashboard by its real package name and copies the output into dist/dashboard', () => {
    const result = runScript('build');
    expect(result.status, result.stderr).toBe(0);

    const invocation = pnpmInvocation();
    expect(invocation.args).toEqual(['--filter', '@re-shell/dashboard', 'build']);
    expect(fs.realpathSync(invocation.cwd)).toBe(fs.realpathSync(root));

    const target = path.join(root, 'packages/cli/dist/dashboard');
    expect(fs.existsSync(path.join(target, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'hub-server.js'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'assets/index-abc.js'))).toBe(true);
  });

  it('takes the package name from apps/web/package.json instead of hardcoding it', () => {
    fs.writeFileSync(
      path.join(root, 'apps/web/package.json'),
      JSON.stringify({ name: '@acme/renamed-dashboard', version: '1.0.0' })
    );
    const result = runScript('build');
    expect(result.status, result.stderr).toBe(0);
    expect(pnpmInvocation().args).toEqual(['--filter', '@acme/renamed-dashboard', 'build']);
  });

  it('fails (and ships nothing) when the pnpm filter matches no project and exits 0', () => {
    // The original bug: a stale, E2E-built apps/web/dist with a baked test token.
    const staleDist = path.join(root, 'apps/web/dist');
    fs.mkdirSync(path.join(staleDist, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(staleDist, 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(staleDist, 'hub-server.js'), '// stale');
    fs.writeFileSync(
      path.join(staleDist, 'assets/index-stale.js'),
      'VITE_RE_SHELL_UI_HUB_TOKEN:"stale-e2e-token-0000"'
    );

    const result = runScript('noop');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected built SPA');
    // The stale tree was removed before the build, so nothing was copied.
    expect(pnpmInvocation().staleDistPresentAtBuildStart).toBe(false);
    expect(fs.existsSync(path.join(root, 'packages/cli/dist/dashboard'))).toBe(false);
  });

  it('fails when the dashboard build exits non-zero', () => {
    const result = runScript('fail');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Dashboard build failed');
    expect(fs.existsSync(path.join(root, 'packages/cli/dist/dashboard'))).toBe(false);
  });

  it('fails when pnpm cannot be started at all', () => {
    fs.rmSync(path.join(root, 'bin/pnpm'));
    const result = spawnSync(process.execPath, [path.join(root, 'packages/cli/scripts/bundle-dashboard.mjs')], {
      cwd: path.join(root, 'packages/cli'),
      encoding: 'utf8',
      // PATH without any pnpm.
      env: { ...process.env, PATH: path.join(root, 'bin') },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Could not run pnpm|Dashboard build failed/);
  });

  it('never passes VITE_* or hub token variables to the build', () => {
    const result = runScript('build', {
      VITE_RE_SHELL_UI_HUB_TOKEN: 'leaked-test-token',
      VITE_RE_SHELL_UI_HUB_URL: 'http://127.0.0.1:4318',
      RE_SHELL_UI_HUB_TOKEN: 'another-leak',
      E2E_HUB_TOKEN: 'e2e-leak',
      VITE_SOMETHING_ELSE: 'x',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(pnpmInvocation().leakedEnv).toEqual([]);
  });

  it('rejects a bundle with an inlined hub token and removes the copied output', () => {
    // Simulates a developer .env file the environment scrub cannot see.
    const result = runScript('bake-token');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('embeds hub configuration');
    expect(result.stderr).toContain('VITE_RE_SHELL_UI_HUB_TOKEN');
    expect(fs.existsSync(path.join(root, 'packages/cli/dist/dashboard'))).toBe(false);
  });

  it('rejects a bundle with an inlined hub URL', () => {
    const result = runScript('bake-url');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('VITE_RE_SHELL_UI_HUB_URL');
    expect(fs.existsSync(path.join(root, 'packages/cli/dist/dashboard'))).toBe(false);
  });

  describe('helpers', () => {
    async function loadHelpers(): Promise<{
      scrubbedBuildEnv: (env: Record<string, string>) => Record<string, string>;
      findInlinedHubConfig: (dir: string) => string[];
    }> {
      return import(pathToFileURL(realScript).href);
    }

    it('scrubbedBuildEnv drops build-config prefixes and keeps everything else', async () => {
      const { scrubbedBuildEnv } = await loadHelpers();
      const cleaned = scrubbedBuildEnv({
        PATH: '/usr/bin',
        HOME: '/root',
        VITE_X: '1',
        VITE_RE_SHELL_UI_HUB_TOKEN: 't',
        RE_SHELL_UI_HUB_TOKEN: 't',
        E2E_HUB_TOKEN: 't',
        RE_SHELL_WORKSPACE: '/ws',
      });
      expect(cleaned).toEqual({ PATH: '/usr/bin', HOME: '/root', RE_SHELL_WORKSPACE: '/ws' });
    });

    it('findInlinedHubConfig flags string literals but not undefined / empty values', async () => {
      const { findInlinedHubConfig } = await loadHelpers();
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-inline-scan-'));
      try {
        fs.writeFileSync(
          path.join(dir, 'clean.js'),
          'a={VITE_RE_SHELL_UI_HUB_TOKEN:void 0,VITE_RE_SHELL_UI_HUB_URL:undefined};b={VITE_RE_SHELL_UI_HUB_TOKEN:""}'
        );
        expect(findInlinedHubConfig(dir)).toEqual([]);

        fs.writeFileSync(path.join(dir, 'dirty.js'), "x={VITE_RE_SHELL_UI_HUB_TOKEN:'abcdefghij'}");
        fs.mkdirSync(path.join(dir, 'assets'));
        fs.writeFileSync(path.join(dir, 'assets/also.js'), 'y={"VITE_RE_SHELL_UI_HUB_URL":"http://h"}');
        const findings = findInlinedHubConfig(dir);
        expect(findings).toHaveLength(2);
        expect(findings.join('\n')).toContain('dirty.js');
        expect(findings.join('\n')).toContain('also.js');
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
