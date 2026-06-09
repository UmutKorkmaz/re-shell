import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * BLACK-BOX tests that drive the COMPILED binary (dist/index.js).
 *
 * 1. PTY test (node-pty): spawns `re-shell init` in a real pseudo-terminal in a tmp
 *    dir, types keystrokes (Enter to accept each inquirer default), reads the rendered
 *    prompts, and asserts the monorepo scaffolds. node-pty is a native module; if it
 *    fails to load in this environment the PTY test is skipped (see the report).
 *
 * 2. Non-TTY stdin test: spawns `re-shell create` with piped (non-TTY) stdin to prove
 *    the same binary scaffolds correctly in the non-interactive code path.
 */

const BIN = path.resolve(__dirname, '../../dist/index.js');

function loadNodePty(): typeof import('node-pty') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('node-pty');
  } catch {
    return null;
  }
}

const pty = loadNodePty();
const ptyAvailable = pty !== null;

function mkTmp(prefix: string): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

describe('black-box: compiled binary', () => {
  it('dist/index.js exists (build artifact present)', () => {
    expect(fs.existsSync(BIN)).toBe(true);
  });

  const ptyTest = ptyAvailable ? it : it.skip;

  ptyTest(
    'PTY: `init` scaffolds a monorepo when driven with real keystrokes',
    async () => {
      const cwd = mkTmp('re-shell-pty-init-');
      let output = '';

      await new Promise<void>((resolve, reject) => {
        const term = pty!.spawn(
          'node',
          [
            BIN,
            'init',
            'pty-mono',
            '--skip-install',
            '--no-git',
            '--no-submodules',
            '--package-manager',
            'pnpm',
          ],
          {
            name: 'xterm-256color',
            cols: 100,
            rows: 30,
            cwd,
            env: { ...process.env, FORCE_COLOR: '0' },
          }
        );

        term.onData((d) => {
          output += d;
        });

        // Press Enter through each inquirer prompt to accept defaults:
        // projectType, template, typescript, customStructure, saveAsPreset.
        const keystrokes = ['\r', '\r', '\r', '\r', '\r'];
        let i = 0;
        const interval = setInterval(() => {
          if (i < keystrokes.length) term.write(keystrokes[i++]);
        }, 600);

        const killTimer = setTimeout(() => {
          try {
            term.kill();
          } catch {
            /* noop */
          }
          reject(new Error('PTY init timed out'));
        }, 40000);

        term.onExit(() => {
          clearInterval(interval);
          clearTimeout(killTimer);
          resolve();
        });
      });

      // The binary ran its interactive init in the PTY and produced output.
      // The exact welcome banner can be skipped or scrolled under CI's TTY
      // timing, so assert on the broader init flow here; the on-disk scaffold
      // below is the authoritative proof that the driven run worked.
      const ranInit =
        /Welcome to Re-Shell/i.test(output) ||
        /project type/i.test(output) ||
        /Initializing monorepo/i.test(output);
      expect(ranInit).toBe(true);

      // And the monorepo must have scaffolded.
      const pkgPath = path.join(cwd, 'pty-mono', 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = fs.readJsonSync(pkgPath);
      expect(pkg.name).toBe('pty-mono');

      fs.removeSync(cwd);
    },
    60000
  );

  it('non-TTY stdin: `create` scaffolds via the piped (non-interactive) path', () => {
    const cwd = mkTmp('re-shell-nontty-create-');

    const result = spawnSync(
      'node',
      [BIN, 'create', 'demo-proj', '--template', 'react-ts', '--package-manager', 'npm'],
      {
        cwd,
        input: '\n', // piped (non-TTY) stdin
        encoding: 'utf8',
        env: { ...process.env, FORCE_COLOR: '0' },
        timeout: 60000,
      }
    );

    expect(result.status).toBe(0);

    const pkgPath = path.join(cwd, 'demo-proj', 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = fs.readJsonSync(pkgPath);
    expect(pkg.name).toBe('demo-proj');
    expect(fs.existsSync(path.join(cwd, 'demo-proj', 'apps'))).toBe(true);

    fs.removeSync(cwd);
  }, 70000);
});
