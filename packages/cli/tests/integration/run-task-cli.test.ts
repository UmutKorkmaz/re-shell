import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { jsonResponseSchema, runResponseSchema } from '@re-shell/contracts';

/**
 * Integration conformance for `re-shell run <task>`, driving the BUILT CLI
 * (dist/index.js) exactly as a consumer would, inside a throwaway temp
 * workspace. Everything here is offline and deterministic:
 *
 *   - The fixture is two packages, `a` <- `b` (b depends on a), under
 *     `packages/`, with a `package-lock.json` at the root so the runner detects
 *     `npm` and never touches the network.
 *   - Each script is a trivial `node <helper>.cjs <label>` that appends its
 *     `<pkg>:<task>` label to an ORDER_FILE passed via the environment. The CLI
 *     inherits the parent env, so the spawned children see ORDER_FILE. Reading
 *     that file back gives the real, observed execution order — no timing
 *     assertions, just ordered side-effects.
 *
 * Asserted:
 *   1. `run build` executes a:build before b:build (upstream topological order).
 *   2. `run test --affected` after touching only `b` runs b's chain and the
 *      upstream build it needs, and never a:test.
 *   3. A configured task cycle exits non-zero, reports RUN_ERROR, and runs
 *      NOTHING (the ORDER_FILE stays empty).
 *   4. `--json` emits the single-line envelope and validates against the
 *      run response contract.
 *   5. `--concurrency 1` serialises execution.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 16 * 1024 * 1024;

interface RunResult {
  stdout: string;
  status: number;
}

/**
 * Spawn the built CLI in `cwd`, capturing stdout, with `ORDER_FILE` injected so
 * the fixture scripts append their labels there. Never throws on non-zero exit.
 */
function runCli(args: string[], cwd: string, orderFile: string): RunResult {
  const outFile = path.join(
    os.tmpdir(),
    `rs-run-${process.pid}-${Math.random().toString(36).slice(2)}.out`
  );
  const fd = fs.openSync(outFile, 'w');
  let status = 0;
  try {
    execFileSync('node', [CLI_PATH, ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', fd, 'ignore'],
      env: { ...process.env, ORDER_FILE: orderFile },
    });
  } catch (error: unknown) {
    const e = error as { status?: number };
    status = typeof e.status === 'number' ? e.status : 1;
  } finally {
    fs.closeSync(fd);
  }
  const stdout = fs.readFileSync(outFile, 'utf8');
  fs.rmSync(outFile, { force: true });
  return { stdout, status };
}

/** Read the observed `<pkg>:<task>` execution order, or [] if nothing ran. */
function readOrder(orderFile: string): string[] {
  if (!fs.existsSync(orderFile)) return [];
  return fs
    .readFileSync(orderFile, 'utf8')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Body of the per-package helper that appends its label to ORDER_FILE. */
const APPEND_HELPER =
  'const fs = require("fs");\n' +
  'fs.appendFileSync(process.env.ORDER_FILE, process.argv[2] + "\\n");\n';

/**
 * Build a throwaway workspace: `a` <- `b`. Each package gets an `append.cjs`
 * helper and `build`/`test` scripts that record their `<pkg>:<task>` label.
 * `failTask` makes that one script exit non-zero (after recording). A root
 * `package-lock.json` pins the runner to npm. An optional `tasksYaml` writes
 * `re-shell.workspaces.yaml`.
 */
function makeWorkspace(opts: {
  tasksYaml?: string;
  failTask?: { pkg: string; task: string };
}): { root: string; orderFile: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-run-ws-'));
  const orderFile = path.join(root, 'order.txt');

  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture-root', private: true }, null, 2)
  );
  // Presence of a lockfile makes the runner pick npm deterministically.
  fs.writeFileSync(path.join(root, 'package-lock.json'), '');

  const mkPkg = (name: string, deps: Record<string, string>): void => {
    const dir = path.join(root, 'packages', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'append.cjs'), APPEND_HELPER);

    const script = (task: string): string => {
      const record = `node append.cjs ${name}:${task}`;
      const fails =
        opts.failTask &&
        opts.failTask.pkg === name &&
        opts.failTask.task === task;
      // Record first, then fail, so a failure is still observable in the order.
      return fails ? `${record} && node -e "process.exit(1)"` : record;
    };

    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify(
        {
          name,
          scripts: { build: script('build'), test: script('test') },
          ...(Object.keys(deps).length > 0 ? { dependencies: deps } : {}),
        },
        null,
        2
      )
    );
  };

  mkPkg('a', {});
  mkPkg('b', { a: 'workspace:*' });

  if (opts.tasksYaml) {
    fs.writeFileSync(
      path.join(root, 're-shell.workspaces.yaml'),
      opts.tasksYaml
    );
  }
  return { root, orderFile };
}

/** Assert stdout is exactly one JSON line and return the parsed envelope. */
function parseSingleLine(stdout: string): Record<string, unknown> {
  const lines = stdout.split('\n').filter(line => line.length > 0);
  expect(
    lines.length,
    `expected exactly one stdout line, got ${lines.length}: ${stdout}`
  ).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

describe('run <task> (built CLI): topological order, --affected, cycles, --json', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  it('run build executes a:build before b:build (upstream topological order)', () => {
    const { root, orderFile } = makeWorkspace({});
    try {
      const { status } = runCli(['run', 'build'], root, orderFile);
      expect(status).toBe(0);
      const order = readOrder(orderFile);
      expect(order).toEqual(['a:build', 'b:build']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('run test --affected after touching only b runs b chain + upstream build, never a:test', () => {
    const { root, orderFile } = makeWorkspace({});
    // Initialise a git repo so --affected can read the working tree, then commit
    // a baseline and modify ONLY package b so it is the sole changed package.
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@t.t'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'baseline'], { cwd: root });
    fs.writeFileSync(path.join(root, 'packages', 'b', 'changed.txt'), 'x');

    try {
      const { status } = runCli(['run', 'test', '--affected'], root, orderFile);
      expect(status).toBe(0);
      const order = readOrder(orderFile).sort();
      // b is affected: a:build (upstream dep b needs) + b:build + b:test.
      expect(order).toEqual(['a:build', 'b:build', 'b:test']);
      expect(order).not.toContain('a:test');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a configured task cycle exits non-zero, reports RUN_ERROR, and runs nothing', () => {
    const { root, orderFile } = makeWorkspace({
      tasksYaml:
        'tasks:\n' +
        '  build:\n' +
        '    dependsOn: ["test"]\n' +
        '  test:\n' +
        '    dependsOn: ["build"]\n',
    });
    try {
      const { stdout, status } = runCli(
        ['run', 'build', '--json'],
        root,
        orderFile
      );
      expect(status).not.toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe('RUN_ERROR');
      // Nothing was spawned: the order file is empty / absent.
      expect(readOrder(orderFile)).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--json emits a single-line envelope matching the run response contract', () => {
    const { root, orderFile } = makeWorkspace({});
    try {
      const { stdout, status } = runCli(
        ['run', 'build', '--json'],
        root,
        orderFile
      );
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);

      const parsed = jsonResponseSchema(runResponseSchema).safeParse(env);
      expect(
        parsed.success,
        JSON.stringify(
          (parsed as { error?: { issues?: unknown[] } }).error?.issues?.[0]
        )
      ).toBe(true);

      const data = (env as { data: z.infer<typeof runResponseSchema> }).data;
      expect(data.task).toBe('build');
      const statuses = Object.fromEntries(
        data.results.map(r => [r.package, r.status])
      );
      expect(statuses['a']).toBe('success');
      expect(statuses['b']).toBe('success');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a failing task fails the run (non-zero) and cascades its dependent to skipped', () => {
    const { root, orderFile } = makeWorkspace({
      failTask: { pkg: 'a', task: 'build' },
    });
    try {
      const { stdout, status } = runCli(
        ['run', 'build', '--json'],
        root,
        orderFile
      );
      expect(status).not.toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true); // run completed; the FAILURE is in the results
      const data = (env as { data: z.infer<typeof runResponseSchema> }).data;
      const statuses = Object.fromEntries(
        data.results.map(r => [r.package, r.status])
      );
      expect(statuses['a']).toBe('failed');
      // b#build depends on a#build, so it is cascaded to skipped (never spawned).
      expect(statuses['b']).toBe('skipped');
      expect(readOrder(orderFile)).toEqual(['a:build']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--concurrency 1 serialises execution in dependency order', () => {
    const { root, orderFile } = makeWorkspace({});
    try {
      const { status } = runCli(
        ['run', 'test', '--concurrency', '1'],
        root,
        orderFile
      );
      expect(status).toBe(0);
      const order = readOrder(orderFile);
      // The full chain, serialised: every upstream build precedes its dependent.
      expect(order.indexOf('a:build')).toBeLessThan(order.indexOf('b:build'));
      expect(order.indexOf('b:build')).toBeLessThan(order.indexOf('b:test'));
      expect(order.indexOf('a:build')).toBeLessThan(order.indexOf('a:test'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--filter with an unknown package name exits non-zero with RUN_ERROR', () => {
    const { root, orderFile } = makeWorkspace({});
    try {
      const { stdout, status } = runCli(
        ['run', 'build', '--filter', 'no-such-package', '--json'],
        root,
        orderFile
      );
      expect(status).not.toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe('RUN_ERROR');
      // Nothing was spawned.
      expect(readOrder(orderFile)).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
