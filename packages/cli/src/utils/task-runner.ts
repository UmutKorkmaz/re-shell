// Task runner executor.
//
// Discovers workspace packages, builds the workspace dependency graph the
// scheduler consumes, optionally scopes the target set to the change-impact
// analyzer's affected packages, then drives the ReadySetScheduler with bounded
// parallelism, spawning each package's `<task>` script via the detected package
// manager. Packages that do not define the task script are recorded as
// `skipped` (their dependents still run). No `shell: true`: arguments are always
// passed as an argv array so package/task names can never be interpreted by a
// shell.

import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
// Only TYPES are imported from contracts so nothing is emitted as a runtime
// `require('@re-shell/contracts')`. The contracts dist is ESM-only (no CJS
// `require`/`default` export condition) and the CLI is compiled to CommonJS,
// so a value import would fail to resolve at runtime. The `tasks` section is
// therefore validated inline below rather than via the zod schema value.
import type { TaskRunResult, TasksConfig } from '@re-shell/contracts';
import {
  ReadySetScheduler,
  buildExecutionPlan,
  mergeTasksConfig,
  nodeId,
  type WorkspaceDepGraph,
} from './task-scheduler';
import { CacheController } from './cache-runner';
import { LocalFsCache, type CacheBackend } from './cache-store';

/** Conventional monorepo workspace roots scanned for packages. */
const WORKSPACE_DIRS = ['apps', 'packages', 'libs', 'tools'] as const;

/** Supported package managers for running scripts. */
export type PackageManager = 'pnpm' | 'yarn' | 'npm';

/** A discovered workspace package. */
export interface DiscoveredPackage {
  /** package.json `name` (the scheduler/graph key). */
  name: string;
  /** Absolute path to the package directory. */
  dir: string;
  /** Script names defined in package.json `scripts`. */
  scripts: ReadonlySet<string>;
  /** Script bodies keyed by name (the command text folded into cache keys). */
  scriptBodies: ReadonlyMap<string, string>;
  /** Names of OTHER discovered packages this one directly depends on. */
  workspaceDeps: string[];
}

/** Result of {@link discoverWorkspace}. */
export interface WorkspaceDiscovery {
  packages: ReadonlyMap<string, DiscoveredPackage>;
  graph: WorkspaceDepGraph;
}

/**
 * Detect the package manager for a directory by walking up to the workspace
 * root looking for a lockfile. Defaults to npm when none is found.
 */
export function detectPackageManager(startDir: string, rootDir: string): PackageManager {
  let dir = path.resolve(startDir);
  const root = path.resolve(rootDir);
  // Walk from the package dir up to (and including) the root.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return 'npm';
}

/** Build the argv (command + args) to run a named script via the given PM. */
export function buildRunArgv(pm: PackageManager, script: string): { cmd: string; args: string[] } {
  switch (pm) {
    case 'pnpm':
      return { cmd: 'pnpm', args: ['run', script] };
    case 'yarn':
      return { cmd: 'yarn', args: [script] };
    case 'npm':
    default:
      return { cmd: 'npm', args: ['run', script] };
  }
}

/**
 * Discover all workspace packages under the conventional roots, reading each
 * package.json `name` + `scripts`, then compute the upstream workspace
 * dependency graph by intersecting every package's deps with the set of
 * discovered package names (a dep only becomes a graph edge when it resolves to
 * another package IN this workspace).
 */
export async function discoverWorkspace(rootPath: string): Promise<WorkspaceDiscovery> {
  const root = path.resolve(rootPath);
  const byName = new Map<
    string,
    { dir: string; scripts: Set<string>; scriptBodies: Map<string, string>; deps: string[] }
  >();

  for (const wsDir of WORKSPACE_DIRS) {
    const dirPath = path.join(root, wsDir);
    if (!(await fs.pathExists(dirPath))) continue;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pkgDir = path.join(dirPath, entry.name);
      const pkgJsonPath = path.join(pkgDir, 'package.json');
      if (!(await fs.pathExists(pkgJsonPath))) continue;
      try {
        const pkgJson = await fs.readJson(pkgJsonPath);
        const name: string = pkgJson.name ?? entry.name;
        const scriptsRecord: Record<string, string> = pkgJson.scripts ?? {};
        const scripts = new Set<string>(Object.keys(scriptsRecord));
        const scriptBodies = new Map<string, string>(
          Object.entries(scriptsRecord).map(([k, v]) => [k, String(v)])
        );
        const deps = [
          ...Object.keys(pkgJson.dependencies ?? {}),
          ...Object.keys(pkgJson.devDependencies ?? {}),
        ];
        byName.set(name, { dir: pkgDir, scripts, scriptBodies, deps });
      } catch {
        // A malformed package.json is skipped rather than aborting discovery.
      }
    }
  }

  const names = new Set(byName.keys());
  const packages = new Map<string, DiscoveredPackage>();
  const graph = new Map<string, readonly string[]>();

  for (const [name, info] of byName) {
    // An edge exists only when the dep resolves to another discovered package.
    // Membership in the discovered name set is the authoritative filter, so
    // non-workspace (registry) deps never become graph edges.
    const workspaceDeps = info.deps.filter(dep => dep !== name && names.has(dep));
    packages.set(name, {
      name,
      dir: info.dir,
      scripts: info.scripts,
      scriptBodies: info.scriptBodies,
      workspaceDeps,
    });
    graph.set(name, workspaceDeps);
  }

  return { packages, graph };
}

/**
 * Resolve the set of affected package NAMES for `--affected`: the packages that
 * directly own a changed file, expanded with their transitive DEPENDENTS (a
 * change to an upstream package affects everything downstream of it, but not
 * its own upstream deps). Changed files are read from the git working tree
 * against HEAD — fully offline and deterministic. Falls back to an empty set
 * (run nothing) when git is unavailable or there are no changes.
 *
 * `getChangedFiles` is injectable for tests so the analysis can be exercised
 * without a real git repository.
 */
export async function resolveAffectedPackages(
  rootPath: string,
  discovery: WorkspaceDiscovery,
  getChangedFiles: (root: string) => Promise<string[]> = gitChangedFiles
): Promise<string[]> {
  const root = path.resolve(rootPath);
  const changed = await getChangedFiles(root);

  // Map each changed file (relative to root) to its owning package by longest
  // matching package directory prefix.
  const dirs = [...discovery.packages.values()].map(p => ({
    name: p.name,
    rel: path.relative(root, path.resolve(p.dir)) + path.sep,
  }));

  const directlyChanged = new Set<string>();
  for (const file of changed) {
    // git always emits '/' separators; normalise to the OS separator before
    // prefix-matching so this works correctly on Windows too.
    const rel = file.split('/').join(path.sep);
    for (const d of dirs) {
      if (rel.startsWith(d.rel)) directlyChanged.add(d.name);
    }
  }

  // Build the reverse (dependents) graph from the upstream graph.
  const dependents = new Map<string, string[]>();
  for (const name of discovery.packages.keys()) dependents.set(name, []);
  for (const [pkg, deps] of discovery.graph) {
    for (const dep of deps) {
      dependents.get(dep)?.push(pkg);
    }
  }

  // Expand changed packages with their transitive dependents.
  const affected = new Set<string>();
  const stack = [...directlyChanged];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (affected.has(cur)) continue;
    affected.add(cur);
    for (const d of dependents.get(cur) ?? []) {
      if (!affected.has(d)) stack.push(d);
    }
  }
  return [...affected];
}

/**
 * Default changed-file source: the union of git-tracked changes vs HEAD and
 * untracked files, as paths relative to the workspace root. Returns an empty
 * list (rather than throwing) when git is unavailable so `--affected` degrades
 * to "nothing affected" instead of failing the whole run.
 */
async function gitChangedFiles(root: string): Promise<string[]> {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(execFile);
  const collect = async (args: string[]): Promise<string[]> => {
    try {
      const { stdout } = await run('git', args, { cwd: root, maxBuffer: 1 << 24 });
      return stdout.split('\n').map(s => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  };
  const [tracked, untracked] = await Promise.all([
    collect(['diff', '--name-only', 'HEAD']),
    collect(['ls-files', '--others', '--exclude-standard']),
  ]);
  return [...new Set([...tracked, ...untracked])];
}

/** Canonical workspace config file name (mirrors config WORKSPACE_CONFIG). */
const WORKSPACE_CONFIG_FILE = 're-shell.workspaces.yaml';

/**
 * Load and validate the optional `tasks` section from `re-shell.workspaces.yaml`
 * at the workspace root, merged over the built-in defaults. Returns the merged
 * defaults when no file or no `tasks` section is present. A malformed `tasks`
 * section throws so the runner can surface it rather than silently mis-ordering.
 */
export async function loadTasksConfig(rootPath: string): Promise<TasksConfig> {
  const configPath = path.join(path.resolve(rootPath), WORKSPACE_CONFIG_FILE);
  if (!(await fs.pathExists(configPath))) {
    return mergeTasksConfig();
  }
  const raw = await fs.readFile(configPath, 'utf8');
  const doc = yaml.load(raw) as { tasks?: unknown } | undefined;
  if (!doc || typeof doc !== 'object' || doc.tasks == null) {
    return mergeTasksConfig();
  }
  return mergeTasksConfig(parseTasksConfig(doc.tasks));
}

/**
 * Validate and narrow an untrusted `tasks` value into a {@link TasksConfig}.
 * Mirrors the shape enforced by the workspace JSON schema + the contracts zod
 * schema, but is inlined so the CLS's CommonJS build never has to `require` the
 * ESM-only contracts package. Throws a clear error on any structural problem.
 */
export function parseTasksConfig(value: unknown): TasksConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(
      `Invalid "tasks" section in ${WORKSPACE_CONFIG_FILE}: expected an object`
    );
  }
  const out: TasksConfig = {};
  for (const [taskName, taskValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof taskValue !== 'object' || taskValue === null || Array.isArray(taskValue)) {
      throw new Error(
        `Invalid "tasks.${taskName}" in ${WORKSPACE_CONFIG_FILE}: expected an object`
      );
    }
    const { dependsOn, inputs, outputs } = taskValue as {
      dependsOn?: unknown;
      inputs?: unknown;
      outputs?: unknown;
    };

    const entry: TasksConfig[string] = {};

    if (dependsOn !== undefined) {
      if (!Array.isArray(dependsOn) || !dependsOn.every(d => typeof d === 'string')) {
        throw new Error(
          `Invalid "tasks.${taskName}.dependsOn" in ${WORKSPACE_CONFIG_FILE}: expected an array of strings`
        );
      }
      for (const dep of dependsOn as string[]) {
        const effectiveName = dep.startsWith('^') ? dep.slice(1) : dep;
        if (effectiveName.length === 0) {
          throw new Error(
            `Invalid "tasks.${taskName}.dependsOn" in ${WORKSPACE_CONFIG_FILE}: ` +
              `dependency entry "${dep}" has an empty task name`
          );
        }
      }
      entry.dependsOn = dependsOn as string[];
    }

    entry.inputs = parseGlobList(inputs, `tasks.${taskName}.inputs`);
    entry.outputs = parseGlobList(outputs, `tasks.${taskName}.outputs`);
    // Drop undefined keys so the merged shape stays minimal/comparable.
    if (entry.inputs === undefined) delete entry.inputs;
    if (entry.outputs === undefined) delete entry.outputs;

    out[taskName] = entry;
  }
  return out;
}

/**
 * Validate an optional globs array (`inputs`/`outputs`). Returns undefined when
 * the value is absent, or a string[] when present and valid. Throws on a
 * non-array or a non-string/empty entry so config errors surface immediately.
 */
function parseGlobList(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
    throw new Error(
      `Invalid "${label}" in ${WORKSPACE_CONFIG_FILE}: expected an array of strings`
    );
  }
  for (const glob of value as string[]) {
    if (glob.trim().length === 0) {
      throw new Error(
        `Invalid "${label}" in ${WORKSPACE_CONFIG_FILE}: glob entries must be non-empty`
      );
    }
  }
  return value as string[];
}

/** Options controlling a single `re-shell run` invocation. */
export interface RunTaskOptions {
  rootPath: string;
  task: string;
  /** Bounded parallelism. Defaults to the CPU count. */
  concurrency?: number;
  /** Restrict targets to these package names (the `--filter` option). */
  filter?: string[];
  /** Scope targets to the change-impact analyzer's affected packages. */
  affectedPackages?: string[];
  /** Continue scheduling unaffected branches after a failure (advisory). */
  continueOnError?: boolean;
  /** Optional sink for streamed, prefixed task output. */
  onOutput?: (line: string) => void;
  /** Injectable spawner for tests; defaults to a real child_process spawn. */
  spawnTask?: SpawnTask;
  /** Merged task config; defaults to workspace `tasks` merged over defaults. */
  tasksConfig?: TasksConfig;
  /**
   * Content-addressed cache controller. When provided, each node is checked
   * against the cache before spawning (HIT -> restore + replay, no spawn) and a
   * successful MISS is stored. When absent, caching is off (the `--no-cache`
   * path and all existing tests). Injectable so tests can supply an in-memory
   * backend and never touch a real cache dir or remote server.
   *
   * Takes precedence over {@link RunTaskOptions.cacheConfig}.
   */
  cache?: CacheController;
  /**
   * Declarative cache configuration. When set (and `cache` is not injected),
   * `runTask` constructs a {@link CacheController} backed by a {@link LocalFsCache}
   * (plus an optional remote) after the plan is built. This is the path the CLI
   * uses; tests typically inject `cache` directly instead.
   */
  cacheConfig?: RunCacheConfig;
}

/** Declarative cache setup the CLI hands to {@link runTask}. */
export interface RunCacheConfig {
  /** Absolute cache root for the local backend. */
  root: string;
  /** HMAC secret for signing/verifying artifacts. */
  secret: string;
  /** Optional remote backend (CI hydration / push). OFF by default. */
  remote?: CacheBackend;
}

/** Outcome of running one (package, task) node. */
export interface SpawnOutcome {
  exitCode: number;
  /**
   * The combined stdout/stderr the child produced, captured so it can be stored
   * in the cache and replayed verbatim on a later cache HIT. Optional so test
   * spawners need not provide it.
   */
  logs?: string;
}

/** Spawns one script and resolves with its exit code. Injectable for tests. */
export type SpawnTask = (args: {
  pkg: DiscoveredPackage;
  task: string;
  pm: PackageManager;
  onOutput?: (line: string) => void;
}) => Promise<SpawnOutcome>;

/** The full result of {@link runTask}. */
export interface RunTaskResult {
  task: string;
  concurrency: number;
  results: TaskRunResult[];
  affected?: string[];
  /** Set when the plan could not be built (cycle); no node was executed. */
  cycleError?: { cycle: string[]; message: string };
  /** True if any node finished `failed`. */
  hadFailure: boolean;
}

/** Default real spawner: argv array, never `shell: true`. */
const defaultSpawnTask: SpawnTask = ({ pkg, task, pm, onOutput }) =>
  new Promise<SpawnOutcome>(resolve => {
    const { cmd, args } = buildRunArgv(pm, task);
    const child = spawn(cmd, args, {
      cwd: pkg.dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    const prefix = `[${pkg.name}:${task}] `;
    let logs = '';
    const emit = (chunk: Buffer): void => {
      const text = chunk.toString();
      logs += text;
      if (!onOutput) return;
      for (const line of text.split('\n')) {
        if (line.length > 0) onOutput(prefix + line);
      }
    };
    child.stdout?.on('data', emit);
    child.stderr?.on('data', emit);
    child.on('error', () => resolve({ exitCode: 1, logs }));
    child.on('close', code => resolve({ exitCode: code ?? 1, logs }));
  });

/**
 * Resolve the requested task across the workspace, build + validate the plan,
 * and execute it with bounded parallelism. Returns a structured result the
 * command layer renders/serialises. Cycles are reported WITHOUT running any
 * node so the caller can fail hard before side effects.
 */
export async function runTask(options: RunTaskOptions): Promise<RunTaskResult> {
  const {
    rootPath,
    task,
    filter,
    affectedPackages,
    onOutput,
    spawnTask = defaultSpawnTask,
    continueOnError = false,
    cache,
  } = options;
  const concurrency =
    options.concurrency && options.concurrency > 0
      ? Math.floor(options.concurrency)
      : Math.max(1, os.cpus().length);

  const { packages, graph } = await discoverWorkspace(rootPath);
  const tasksConfig = options.tasksConfig ?? (await loadTasksConfig(rootPath));

  // Resolve the target package set (root nodes), applying filter/affected.
  let targetNames = [...packages.keys()];
  if (filter && filter.length > 0) {
    const allow = new Set(filter);
    targetNames = targetNames.filter(n => allow.has(n));
  }
  if (affectedPackages) {
    const allow = new Set(affectedPackages);
    targetNames = targetNames.filter(n => allow.has(n));
  }

  const targets = targetNames.map(name => ({ package: name, task }));

  const planResult = buildExecutionPlan(graph, tasksConfig, targets);
  if (planResult.ok === false) {
    return {
      task,
      concurrency,
      results: [],
      affected: affectedPackages,
      cycleError: { cycle: planResult.error.cycle, message: planResult.error.message },
      hadFailure: true,
    };
  }

  const scheduler = new ReadySetScheduler(planResult.plan, continueOnError);
  const results = new Map<string, TaskRunResult>();
  const pmCache = new Map<string, PackageManager>();

  const pmFor = (pkg: DiscoveredPackage): PackageManager => {
    let pm = pmCache.get(pkg.name);
    if (!pm) {
      pm = detectPackageManager(pkg.dir, rootPath);
      pmCache.set(pkg.name, pm);
    }
    return pm;
  };

  // Resolve the active cache controller: an injected one wins; otherwise build
  // one from cacheConfig (the CLI path). When neither is set, caching is off.
  const cacheController: CacheController | undefined =
    cache ??
    (options.cacheConfig
      ? new CacheController({
          workspaceRoot: rootPath,
          packages,
          dependencies: planResult.plan.dependencies,
          tasksConfig,
          pmFor,
          local: new LocalFsCache({
            root: options.cacheConfig.root,
            secret: options.cacheConfig.secret,
          }),
          remote: options.cacheConfig.remote,
          localRoot: options.cacheConfig.root,
        })
      : undefined);

  const recordSkip = (id: string): void => {
    const node = scheduler.node(id)!;
    results.set(id, {
      package: node.package,
      task: node.task,
      status: 'skipped',
      exitCode: null,
      durationMs: 0,
    });
  };

  /**
   * Process one ready node: on a cache HIT, restore + replay logs + record
   * `cached` WITHOUT spawning; on a MISS, spawn, then store the successful
   * result under its key. Cache lookup/store failures degrade gracefully to a
   * normal run rather than failing the node. Returns the scheduler-facing status
   * (`cached` is reported to the scheduler as `success` so dependents proceed).
   */
  const processNode = async (
    pkg: DiscoveredPackage,
    node: { id: string; package: string; task: string }
  ): Promise<'success' | 'failed' | 'cached'> => {
    const startedAt = Date.now();

    if (cacheController) {
      const hit = await tryCacheRestore(cacheController, node);
      if (hit) {
        if (hit.logs && onOutput) {
          for (const line of hit.logs.split('\n')) {
            if (line.length > 0) onOutput(`[${node.package}:${node.task}] ${line}`);
          }
        }
        results.set(node.id, {
          package: node.package,
          task: node.task,
          status: 'cached',
          exitCode: hit.exitCode,
          durationMs: Date.now() - startedAt,
        });
        return 'cached';
      }
    }

    const outcome = await spawnTask({ pkg, task: node.task, pm: pmFor(pkg), onOutput });
    const status = outcome.exitCode === 0 ? 'success' : 'failed';
    results.set(node.id, {
      package: node.package,
      task: node.task,
      status,
      exitCode: outcome.exitCode,
      durationMs: Date.now() - startedAt,
    });
    if (cacheController && status === 'success') {
      await safeCacheStore(cacheController, node, outcome.exitCode, outcome.logs ?? '');
    }
    return status;
  };

  // Event-loop driven worker pool: keep launching ready nodes up to the
  // concurrency cap until the plan is fully drained. `ready()` has the side
  // effect of cascading nodes with a failed/skipped dependency into `skipped`,
  // so a stalled-but-not-done plan converges once nothing is left in flight.
  await new Promise<void>(resolveAll => {
    const pump = (): void => {
      // Launch as many ready nodes as the concurrency budget allows.
      // `ready()` is recomputed each pass so newly-unblocked nodes appear and
      // failed-dependency nodes are cascaded out.
      let ready = scheduler.ready();
      while (ready.length > 0 && scheduler.inFlight < concurrency) {
        const node = ready[0];
        const pkg = packages.get(node.package);
        scheduler.start(node.id);

        // A package that does not define the task script is recorded as skipped
        // immediately (no process spawned); its dependents still proceed.
        if (!pkg || !pkg.scripts.has(node.task)) {
          recordSkip(node.id);
          scheduler.complete(node.id, 'skipped');
          ready = scheduler.ready();
          continue;
        }

        void processNode(pkg, node)
          .then(status => {
            // `cached` satisfies dependents exactly like `success` does.
            scheduler.complete(node.id, status === 'cached' ? 'success' : status);
            pump();
          })
          .catch(() => {
            results.set(node.id, {
              package: node.package,
              task: node.task,
              status: 'failed',
              exitCode: 1,
              durationMs: 0,
            });
            scheduler.complete(node.id, 'failed');
            pump();
          });

        ready = scheduler.ready();
      }

      // No work in flight and nothing newly ready: the only nodes left are ones
      // the cascade left out. Finalise them and resolve.
      if (scheduler.inFlight === 0) {
        for (const id of scheduler.allNodeIds) {
          if (!results.has(id)) recordSkip(id);
        }
        if (scheduler.isDone()) resolveAll();
      }
    };

    pump();
  });

  // Persist cumulative hit/miss telemetry (best-effort; never fails the run).
  if (cacheController) {
    try {
      await cacheController.flushTelemetry();
    } catch {
      // telemetry is advisory
    }
  }

  const ordered = orderResults(planResult.plan.nodes, results);
  const hadFailure = ordered.some(r => r.status === 'failed');

  return {
    task,
    concurrency,
    results: ordered,
    affected: affectedPackages,
    hadFailure,
  };
}

/**
 * Restore a node from the cache, swallowing any controller error as a miss so a
 * broken cache never fails a build (it just falls back to a real run).
 */
async function tryCacheRestore(
  cache: CacheController,
  node: { package: string; task: string }
): Promise<{ exitCode: number; logs: string } | undefined> {
  try {
    return await cache.tryRestore(node);
  } catch {
    return undefined;
  }
}

/** Store a node result, swallowing controller errors (caching is best-effort). */
async function safeCacheStore(
  cache: CacheController,
  node: { package: string; task: string },
  exitCode: number,
  logs: string
): Promise<void> {
  try {
    await cache.store(node, exitCode, logs);
  } catch {
    // A cache write failure must never fail the underlying (successful) task.
  }
}

/**
 * Produce a stable, deterministic alphabetical ordering of results for display.
 * Note: this is NOT a topological sort — it is alphabetical by node id.
 */
function orderResults(
  nodes: ReadonlyMap<string, { id: string; package: string; task: string }>,
  results: ReadonlyMap<string, TaskRunResult>
): TaskRunResult[] {
  const ids = [...nodes.keys()].sort((a, b) => a.localeCompare(b));
  const out: TaskRunResult[] = [];
  for (const id of ids) {
    const r = results.get(id);
    if (r) out.push(r);
  }
  return out;
}

export { nodeId };
