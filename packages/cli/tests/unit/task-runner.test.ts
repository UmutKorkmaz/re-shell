import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRunArgv,
  detectPackageManager,
  discoverWorkspace,
  loadTasksConfig,
  parseTasksConfig,
  resolveAffectedPackages,
  runTask,
  type SpawnTask,
} from '../../src/utils/task-runner';
import { runResponseSchema } from '@re-shell/contracts';

let root: string;

/**
 * Build a fixture workspace with packages a <- b (b depends on a), each with
 * the given scripts. Returns the absolute root path.
 */
async function makeWorkspace(opts: {
  aScripts?: Record<string, string>;
  bScripts?: Record<string, string>;
  tasksYaml?: string;
  lockfile?: string;
}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-task-'));
  await fs.writeJson(path.join(dir, 'package.json'), {
    name: 'fixture-root',
    private: true,
  });
  if (opts.lockfile) {
    await fs.writeFile(path.join(dir, opts.lockfile), '');
  }

  const pkgA = path.join(dir, 'packages', 'a');
  const pkgB = path.join(dir, 'packages', 'b');
  await fs.ensureDir(pkgA);
  await fs.ensureDir(pkgB);

  await fs.writeJson(path.join(pkgA, 'package.json'), {
    name: 'a',
    scripts: opts.aScripts ?? { build: 'echo a-build', test: 'echo a-test' },
  });
  await fs.writeJson(path.join(pkgB, 'package.json'), {
    name: 'b',
    scripts: opts.bScripts ?? { build: 'echo b-build', test: 'echo b-test' },
    dependencies: { a: 'workspace:*' },
  });

  if (opts.tasksYaml) {
    await fs.writeFile(
      path.join(dir, 're-shell.workspaces.yaml'),
      opts.tasksYaml
    );
  }
  return dir;
}

/** A spawner that records call order and always succeeds. */
function recordingSpawner(order: string[]): SpawnTask {
  return async ({ pkg, task }) => {
    order.push(`${pkg.name}:${task}`);
    return { exitCode: 0 };
  };
}

/** A spawner that fails for a specific package, succeeds otherwise. */
function failingSpawner(failPkg: string, order: string[]): SpawnTask {
  return async ({ pkg, task }) => {
    order.push(`${pkg.name}:${task}`);
    return { exitCode: pkg.name === failPkg ? 1 : 0 };
  };
}

afterEach(async () => {
  if (root) await fs.remove(root);
});

describe('detectPackageManager', () => {
  it('detects pnpm from a root lockfile when walking up from a package', async () => {
    root = await makeWorkspace({ lockfile: 'pnpm-lock.yaml' });
    const pm = detectPackageManager(path.join(root, 'packages', 'a'), root);
    expect(pm).toBe('pnpm');
  });

  it('defaults to npm when no lockfile is present', async () => {
    root = await makeWorkspace({});
    const pm = detectPackageManager(path.join(root, 'packages', 'a'), root);
    expect(pm).toBe('npm');
  });
});

describe('buildRunArgv', () => {
  it('never returns a shell string; always argv array', () => {
    expect(buildRunArgv('pnpm', 'build')).toEqual({ cmd: 'pnpm', args: ['run', 'build'] });
    expect(buildRunArgv('yarn', 'build')).toEqual({ cmd: 'yarn', args: ['build'] });
    expect(buildRunArgv('npm', 'build')).toEqual({ cmd: 'npm', args: ['run', 'build'] });
  });
});

describe('discoverWorkspace', () => {
  it('builds the upstream dep graph from workspace deps only', async () => {
    root = await makeWorkspace({});
    const { packages, graph } = await discoverWorkspace(root);
    expect([...packages.keys()].sort()).toEqual(['a', 'b']);
    expect(graph.get('a')).toEqual([]);
    expect(graph.get('b')).toEqual(['a']);
  });
});

describe('loadTasksConfig', () => {
  it('returns merged defaults when no workspace file exists', async () => {
    root = await makeWorkspace({});
    const cfg = await loadTasksConfig(root);
    expect(cfg.build).toEqual({ dependsOn: ['^build'] });
    expect(cfg.test).toEqual({ dependsOn: ['build'] });
  });

  it('reads and validates a tasks section from the workspace file', async () => {
    root = await makeWorkspace({
      tasksYaml: 'tasks:\n  build:\n    dependsOn: ["^build"]\n  test:\n    dependsOn: ["build", "lint"]\n',
    });
    const cfg = await loadTasksConfig(root);
    expect(cfg.test).toEqual({ dependsOn: ['build', 'lint'] });
  });
});

describe('parseTasksConfig', () => {
  it('accepts a valid tasks object', () => {
    expect(parseTasksConfig({ build: { dependsOn: ['^build'] }, lint: {} })).toEqual({
      build: { dependsOn: ['^build'] },
      lint: {},
    });
  });

  it('throws when tasks is not an object', () => {
    expect(() => parseTasksConfig([])).toThrow(/expected an object/);
    expect(() => parseTasksConfig('build')).toThrow(/expected an object/);
  });

  it('throws when dependsOn is not an array of strings', () => {
    expect(() => parseTasksConfig({ build: { dependsOn: 'x' } })).toThrow(
      /dependsOn/
    );
    expect(() => parseTasksConfig({ build: { dependsOn: [1] } })).toThrow(
      /dependsOn/
    );
  });
});

describe('resolveAffectedPackages', () => {
  it('scopes to the changed package plus its transitive dependents', async () => {
    root = await makeWorkspace({});
    const discovery = await discoverWorkspace(root);

    // Change a file in package a (b depends on a) -> a and b are affected.
    const affectedA = await resolveAffectedPackages(root, discovery, async () => [
      path.join('packages', 'a', 'src', 'index.ts'),
    ]);
    expect(affectedA.sort()).toEqual(['a', 'b']);

    // Change a file in package b -> only b (nothing depends on b).
    const affectedB = await resolveAffectedPackages(root, discovery, async () => [
      path.join('packages', 'b', 'src', 'index.ts'),
    ]);
    expect(affectedB).toEqual(['b']);
  });

  it('returns an empty set when there are no changes', async () => {
    root = await makeWorkspace({});
    const discovery = await discoverWorkspace(root);
    const affected = await resolveAffectedPackages(root, discovery, async () => []);
    expect(affected).toEqual([]);
  });
});

describe('runTask — affected scoping (test of a downstream package)', () => {
  it('runs the affected package and only the upstream BUILD it needs', async () => {
    root = await makeWorkspace({});
    const discovery = await discoverWorkspace(root);
    const affected = await resolveAffectedPackages(root, discovery, async () => [
      path.join('packages', 'b', 'src', 'index.ts'),
    ]);
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'test',
      affectedPackages: affected,
      concurrency: 1,
      spawnTask: recordingSpawner(order),
    });
    // a:build (upstream dep) + b:build + b:test; never a:test.
    expect(order.sort()).toEqual(['a:build', 'b:build', 'b:test']);
    expect(order).not.toContain('a:test');
    expect(result.affected).toEqual(['b']);
  });
});

describe('runTask — ordering', () => {
  it('builds a before b (upstream dependency order)', async () => {
    root = await makeWorkspace({});
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      spawnTask: recordingSpawner(order),
    });
    expect(result.hadFailure).toBe(false);
    expect(order).toEqual(['a:build', 'b:build']);
    const statuses = Object.fromEntries(
      result.results.map(r => [`${r.package}:${r.task}`, r.status])
    );
    expect(statuses['a:build']).toBe('success');
    expect(statuses['b:build']).toBe('success');
  });

  it('runs the full test chain a:build -> b:build -> b:test for a downstream test', async () => {
    root = await makeWorkspace({});
    const order: string[] = [];
    await runTask({
      rootPath: root,
      task: 'test',
      concurrency: 1,
      filter: ['b'],
      spawnTask: recordingSpawner(order),
    });
    expect(order.indexOf('a:build')).toBeLessThan(order.indexOf('b:build'));
    expect(order.indexOf('b:build')).toBeLessThan(order.indexOf('b:test'));
  });
});

describe('runTask — skipping packages without the script', () => {
  it('marks a package without the task script as skipped (no spawn)', async () => {
    root = await makeWorkspace({ bScripts: { build: 'echo b-build' } }); // b has no test
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'test',
      concurrency: 2,
      spawnTask: recordingSpawner(order),
    });
    const bTest = result.results.find(r => r.package === 'b' && r.task === 'test');
    expect(bTest?.status).toBe('skipped');
    expect(bTest?.exitCode).toBeNull();
    expect(order).not.toContain('b:test');
  });
});

describe('runTask — failure cascades', () => {
  it('reports a failure and cascades dependents to skipped', async () => {
    root = await makeWorkspace({});
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      spawnTask: failingSpawner('a', order),
    });
    expect(result.hadFailure).toBe(true);
    const statuses = Object.fromEntries(
      result.results.map(r => [r.package, r.status])
    );
    expect(statuses['a']).toBe('failed');
    // b#build depends on a#build, so it is never spawned.
    expect(statuses['b']).toBe('skipped');
    expect(order).toEqual(['a:build']);
  });
});

describe('runTask — cycle', () => {
  it('returns a hard cycle error without running anything', async () => {
    root = await makeWorkspace({
      tasksYaml: 'tasks:\n  build:\n    dependsOn: ["test"]\n  test:\n    dependsOn: ["build"]\n',
    });
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'build',
      spawnTask: recordingSpawner(order),
    });
    expect(result.cycleError).toBeDefined();
    expect(result.hadFailure).toBe(true);
    expect(result.results).toEqual([]);
    expect(order).toEqual([]); // nothing spawned
  });
});

describe('runTask — concurrency cap', () => {
  it('never exceeds the configured concurrency', async () => {
    // Independent packages so both build nodes are ready at once.
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-conc-'));
    root = dir;
    await fs.writeJson(path.join(dir, 'package.json'), { name: 'r', private: true });
    for (const name of ['x', 'y', 'z']) {
      const p = path.join(dir, 'packages', name);
      await fs.ensureDir(p);
      await fs.writeJson(path.join(p, 'package.json'), {
        name,
        scripts: { build: 'echo build' },
      });
    }

    let inFlight = 0;
    let maxInFlight = 0;
    const spawnTask: SpawnTask = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight -= 1;
      return { exitCode: 0 };
    };

    const result = await runTask({
      rootPath: dir,
      task: 'build',
      concurrency: 2,
      spawnTask,
    });
    expect(result.hadFailure).toBe(false);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(result.results).toHaveLength(3);
  });
});

describe('runTask — JSON envelope shape', () => {
  it('produces a payload that matches runResponseSchema', async () => {
    root = await makeWorkspace({});
    const result = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 4,
      spawnTask: recordingSpawner([]),
    });
    const payload = {
      task: result.task,
      concurrency: result.concurrency,
      results: result.results,
    };
    expect(runResponseSchema.safeParse(payload).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HIGH fix tests
// ---------------------------------------------------------------------------

describe('runTask — --continue (continueOnError)', () => {
  /**
   * Integration tests for continueOnError via runTask.
   *
   * The scheduler-level semantics (independent c skipped vs. run) are verified
   * directly and deterministically in task-scheduler.test.ts.  Here we check
   * the end-to-end wiring: continueOnError is correctly threaded through from
   * RunTaskOptions to ReadySetScheduler, and the pool drains without deadlock
   * in both modes.
   */

  it('continueOnError=true: a fails, b (dep on a) is skipped, run drains cleanly', async () => {
    root = await makeWorkspace({});
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      continueOnError: true,
      spawnTask: failingSpawner('a', order),
    });
    expect(result.hadFailure).toBe(true);
    const statuses = Object.fromEntries(
      result.results.map(r => [r.package, r.status])
    );
    expect(statuses['a']).toBe('failed');
    // b depends on a → skipped even with continueOnError=true.
    expect(statuses['b']).toBe('skipped');
    // Run must drain without deadlock.
    expect(result.results).toHaveLength(2);
  });

  it('continueOnError=false: a fails, b (dep on a) is skipped, run drains cleanly', async () => {
    root = await makeWorkspace({});
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      continueOnError: false,
      spawnTask: failingSpawner('a', order),
    });
    expect(result.hadFailure).toBe(true);
    const statuses = Object.fromEntries(
      result.results.map(r => [r.package, r.status])
    );
    expect(statuses['a']).toBe('failed');
    expect(statuses['b']).toBe('skipped');
    expect(result.results).toHaveLength(2);
  });

  it('continueOnError=true with independent c: c runs and succeeds while b (dep on a) is skipped', async () => {
    // Workspace: a (leaf, gated — fails after yield), b (dep: a), c (independent).
    // With high concurrency, a and c start simultaneously.  a is gated behind
    // a Promise so c resolves FIRST.  When a fails, b is skipped; c already
    // ran successfully.
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-continue-'));
    root = dir;
    await fs.writeJson(path.join(dir, 'package.json'), {
      name: 'fixture-root', private: true,
    });
    const mkPkg = async (name: string, deps: Record<string, string>) => {
      const p = path.join(dir, 'packages', name);
      await fs.ensureDir(p);
      await fs.writeJson(path.join(p, 'package.json'), {
        name,
        scripts: { build: `echo ${name}` },
        ...(Object.keys(deps).length > 0 ? { dependencies: deps } : {}),
      });
    };
    await mkPkg('a', {});
    await mkPkg('b', { a: 'workspace:*' });
    await mkPkg('c', {});

    const order: string[] = [];
    let releaseA!: () => void;
    const aGate = new Promise<void>(r => { releaseA = r; });

    const spawner: SpawnTask = async ({ pkg }) => {
      if (pkg.name === 'a') {
        await aGate;
        order.push('a:build');
        return { exitCode: 1 };
      }
      order.push(`${pkg.name}:build`);
      return { exitCode: 0 };
    };

    const runPromise = runTask({
      rootPath: dir,
      task: 'build',
      // High concurrency so a and c both launch in the same pump() call.
      concurrency: 4,
      continueOnError: true,
      spawnTask: spawner,
    });

    // Yield to the event loop so both a and c are in-flight, then release a.
    await Promise.resolve();
    releaseA();
    const result = await runPromise;

    expect(result.hadFailure).toBe(true);
    const statuses = Object.fromEntries(
      result.results.map(r => [r.package, r.status])
    );
    expect(statuses['a']).toBe('failed');
    expect(statuses['b']).toBe('skipped');
    // c was launched before a failed → it ran and succeeded.
    expect(statuses['c']).toBe('success');
    expect(order).toContain('c:build');
  });

  it('continueOnError=false: after a failure, at most one task beyond the failing one is spawned', async () => {
    // With continueOnError=false and concurrency=1, once a task fails no new
    // tasks are launched.  Total spawned count must be exactly 1 (only a ran)
    // when a is the FIRST scheduled node, or ≤ 2 if an independent package
    // happened to run first.  b must NEVER run regardless of scheduling order.
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'run-continue-'));
    root = dir;
    await fs.writeJson(path.join(dir, 'package.json'), {
      name: 'fixture-root', private: true,
    });
    const mkPkg = async (name: string, deps: Record<string, string>) => {
      const p = path.join(dir, 'packages', name);
      await fs.ensureDir(p);
      await fs.writeJson(path.join(p, 'package.json'), {
        name,
        scripts: { build: `echo ${name}` },
        ...(Object.keys(deps).length > 0 ? { dependencies: deps } : {}),
      });
    };
    await mkPkg('a', {});
    await mkPkg('b', { a: 'workspace:*' });
    await mkPkg('c', {});

    const order: string[] = [];
    const spawner: SpawnTask = async ({ pkg }) => {
      order.push(`${pkg.name}:build`);
      return { exitCode: pkg.name === 'a' ? 1 : 0 };
    };

    const result = await runTask({
      rootPath: dir,
      task: 'build',
      concurrency: 1,
      continueOnError: false,
      spawnTask: spawner,
    });

    expect(result.hadFailure).toBe(true);
    // b is a dependent of a and must NEVER be spawned.
    expect(order).not.toContain('b:build');
    // At most 2 spawns: one before a (if c ran first) and a itself.
    expect(order.length).toBeLessThanOrEqual(2);
    // The run must drain (no deadlock).
    expect(result.results).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// HIGH fix tests — --filter unknown package
// ---------------------------------------------------------------------------

describe('runTask — filter unknown package (unit-level)', () => {
  /**
   * The filter-unknown error is surfaced by the command layer (run.group.ts),
   * not by runTask itself, so we test the observable: passing a filter name
   * that resolves to zero packages means runTask receives an empty target set
   * and returns results with no entries (the command layer would have already
   * bailed in the real CLI path). The integration-level --filter error is
   * tested in the integration suite.
   */
  it('running with a non-matching filter produces an empty result set', async () => {
    root = await makeWorkspace({});
    const order: string[] = [];
    const result = await runTask({
      rootPath: root,
      task: 'build',
      filter: ['does-not-exist'],
      concurrency: 1,
      spawnTask: recordingSpawner(order),
    });
    expect(result.results).toHaveLength(0);
    expect(order).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// MEDIUM fix tests — bare "^" dep validation
// ---------------------------------------------------------------------------

describe('parseTasksConfig — bare "^" dep validation', () => {
  it('throws a clear error for a bare "^" dependsOn entry', () => {
    expect(() =>
      parseTasksConfig({ build: { dependsOn: ['^'] } })
    ).toThrow(/empty task name/);
  });

  it('throws a clear error for an empty string dependsOn entry', () => {
    expect(() =>
      parseTasksConfig({ build: { dependsOn: [''] } })
    ).toThrow(/empty task name/);
  });

  it('accepts valid entries with a "^" prefix that have a non-empty task name', () => {
    expect(() =>
      parseTasksConfig({ build: { dependsOn: ['^build', 'lint'] } })
    ).not.toThrow();
  });
});
