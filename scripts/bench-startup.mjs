#!/usr/bin/env node
/**
 * Measures CLI startup: spawns the built CLI N times per case and prints the
 * median and p90 wall-clock time (node process start included).
 *
 *   node scripts/bench-startup.mjs [runs=10] [--cli <path>] [--cwd <dir>] [--with-doctor]
 *
 * Build first (`pnpm -r build`). The numbers depend entirely on the machine and
 * its load: compare runs on the same machine (for example before and after a
 * change), and never quote one as a guarantee. `doctor --json` inspects the
 * whole workspace it runs in, so it is opt-in (`--with-doctor`) and slow in a
 * large repository.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const runs = Number(argv.find((a) => /^\d+$/.test(a)) ?? 10);
const cli = path.resolve(flag('--cli') ?? path.join(root, 'packages/cli/dist/index.js'));
const cwd = path.resolve(flag('--cwd') ?? process.cwd());

const cases = [['--version'], ['--help'], ['workspace', '--help'], ['templates', 'list', '--json']];
if (argv.includes('--with-doctor')) cases.push(['doctor', '--json']);

console.log(`cli: ${cli}\nruns per case: ${runs} (one warm-up run discarded)\n`);
for (const args of cases) {
  const times = [];
  for (let i = 0; i < runs + 1; i++) {
    const start = process.hrtime.bigint();
    spawnSync(process.execPath, [cli, ...args], { cwd, stdio: 'ignore', env: { ...process.env, NO_COLOR: '1' } });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (i > 0) times.push(ms);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p90 = times[Math.floor(times.length * 0.9)];
  console.log(`${args.join(' ').padEnd(24)} median ${median.toFixed(0)}ms  p90 ${p90.toFixed(0)}ms`);
}
