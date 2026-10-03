import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build @re-shell/mcp once before any test file runs, and make sure the CLI it
 * drives has been built too.
 *
 * Why build here: the entry-point and stdio-handshake tests run the PUBLISHED
 * artifact (`dist/index.js`, through the `bin` symlink). A stale dist would let
 * them pass against old code, and a test that rebuilds in its own `beforeAll`
 * would race the sibling workers that are spawning it.
 */
export default function setup(): void {
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  execFileSync('npm', ['run', 'build', '--silent'], {
    cwd: pkgRoot,
    stdio: 'inherit',
    // npm is a .cmd shim on Windows, which execFile cannot launch without a shell.
    shell: process.platform === 'win32',
  });

  const cliEntry = path.resolve(pkgRoot, '..', 'cli', 'dist', 'index.js');
  if (!fs.existsSync(cliEntry)) {
    throw new Error(
      `The re-shell CLI is not built (${cliEntry} is missing). ` +
        'Run `pnpm -r build` (or `pnpm --filter @re-shell/cli build`) before the MCP tests: ' +
        'they drive the real CLI.'
    );
  }
}
