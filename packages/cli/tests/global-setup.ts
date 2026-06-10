import { execSync } from 'child_process';
import { resolve } from 'path';

/**
 * Build the CLI ONCE before any test file runs.
 *
 * The integration and PTY/black-box suites spawn the compiled dist/index.js.
 * If a test file rebuilds the CLI in its own `beforeAll`, that `tsc` runs
 * concurrently with sibling workers that are spawning the binary — and a spawn
 * that lands mid-rewrite can load an inconsistent module set and misbehave
 * (e.g. a dry-run that should write nothing emitting a stray file). Building
 * here, serially, before the worker pool starts, removes that race.
 */
export default function setup(): void {
  execSync('npm run build', {
    cwd: resolve(__dirname, '..'),
    stdio: 'ignore',
  });
}
