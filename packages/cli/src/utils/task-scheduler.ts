// Dependency-aware task scheduler (pure, no I/O).
//
// Given:
//   - a workspace dependency graph (package -> its UPSTREAM workspace deps),
//   - a task graph config (task -> { dependsOn: [...] }),
//   - a set of root (package, task) targets the user asked to run,
// this module expands the full set of (package, task) nodes that must run,
// wires up edges honouring BOTH intra-package task deps ("build") and
// upstream-package deps ("^build"), detects cycles BEFORE any execution, and
// exposes a ready-set scheduler for bounded parallel execution.
//
// It is deliberately side-effect free: no spawning, no fs, no clock. The
// executor layer drives it. This keeps the ordering logic fully unit-testable
// with trivial in-memory fixtures.

import type { TasksConfig } from '@re-shell/contracts';

/**
 * A workspace dependency graph: every package maps to the list of OTHER
 * packages in the workspace it directly depends on (its upstream deps).
 * Packages with no workspace deps map to an empty array. The map's key set is
 * the authoritative universe of packages.
 */
export type WorkspaceDepGraph = ReadonlyMap<string, readonly string[]>;

/** A single node in the execution DAG: one task on one package. */
export interface TaskNode {
  /** Stable id, `"<package>#<task>"`, used as the edge/adjacency key. */
  id: string;
  package: string;
  task: string;
}

/** The fully-resolved, acyclic execution plan. */
export interface ExecutionPlan {
  /** All nodes that must be considered, keyed by {@link TaskNode.id}. */
  nodes: ReadonlyMap<string, TaskNode>;
  /**
   * Dependency edges: `dependencies.get(id)` is the set of node ids that must
   * finish before `id` may start.
   */
  dependencies: ReadonlyMap<string, ReadonlySet<string>>;
}

/** A detected cycle, reported as the node-id path that closes back on itself. */
export interface SchedulerCycleError {
  kind: 'cycle';
  /** e.g. `["a#build", "b#build", "a#build"]`. */
  cycle: string[];
  message: string;
}

/** Discriminated result of {@link buildExecutionPlan}. */
export type BuildPlanResult =
  | { ok: true; plan: ExecutionPlan }
  | { ok: false; error: SchedulerCycleError };

/** Default task graph applied when the workspace declares no `tasks` section. */
export const DEFAULT_TASKS_CONFIG: TasksConfig = {
  build: { dependsOn: ['^build'] },
  test: { dependsOn: ['build'] },
};

/** Build a stable node id from a package + task pair. */
export function nodeId(pkg: string, task: string): string {
  return `${pkg}#${task}`;
}

/** Prefix marking an upstream-package dependency edge in `dependsOn`. */
const UPSTREAM_PREFIX = '^';

/**
 * Resolve the dependency list for a task from the merged config. Unknown tasks
 * simply have no declared dependencies (they are leaf nodes), which lets a
 * user run any package script even if it is not modelled in `tasks`.
 */
function dependsOnFor(tasks: TasksConfig, task: string): readonly string[] {
  return tasks[task]?.dependsOn ?? [];
}

/**
 * Expand the requested (package, task) targets into the complete node set and
 * dependency edges, then verify acyclicity. Returns a hard cycle error WITHOUT
 * producing a plan when the graph cannot be ordered, so callers can refuse to
 * execute anything.
 *
 * Edge semantics for a task `T` on package `P` whose `dependsOn` contains:
 *   - `"D"`  (sibling): add edge P#T depends-on P#D — but only if P#D is a real
 *             node (P itself participates). The sibling task is itself expanded.
 *   - `"^D"` (upstream): for every upstream workspace dep `U` of `P`, add edge
 *             P#T depends-on U#D, and recurse into U#D.
 *
 * @param graph   workspace dependency graph (package -> upstream deps)
 * @param tasks   merged task config (caller merges defaults + workspace config)
 * @param targets root (package, task) pairs to run
 */
export function buildExecutionPlan(
  graph: WorkspaceDepGraph,
  tasks: TasksConfig,
  targets: ReadonlyArray<{ package: string; task: string }>
): BuildPlanResult {
  const nodes = new Map<string, TaskNode>();
  const dependencies = new Map<string, Set<string>>();

  const ensureNode = (pkg: string, task: string): string => {
    const id = nodeId(pkg, task);
    if (!nodes.has(id)) {
      nodes.set(id, { id, package: pkg, task });
      dependencies.set(id, new Set());
    }
    return id;
  };

  const addEdge = (from: string, to: string): void => {
    // `from` depends on `to`: `to` must finish first.
    dependencies.get(from)!.add(to);
  };

  // Iterative expansion over a worklist so deep graphs never blow the stack.
  const seen = new Set<string>();
  const worklist: Array<{ package: string; task: string }> = [];

  for (const t of targets) {
    if (graph.has(t.package)) {
      worklist.push({ package: t.package, task: t.task });
    }
  }

  while (worklist.length > 0) {
    const { package: pkg, task } = worklist.pop()!;
    const id = ensureNode(pkg, task);
    if (seen.has(id)) continue;
    seen.add(id);

    const upstream = graph.get(pkg) ?? [];

    for (const dep of dependsOnFor(tasks, task)) {
      if (dep.startsWith(UPSTREAM_PREFIX)) {
        const upstreamTask = dep.slice(UPSTREAM_PREFIX.length);
        for (const u of upstream) {
          if (!graph.has(u)) continue; // ignore non-workspace / unknown deps
          const depId = ensureNode(u, upstreamTask);
          addEdge(id, depId);
          worklist.push({ package: u, task: upstreamTask });
        }
      } else {
        const depId = ensureNode(pkg, dep);
        addEdge(id, depId);
        worklist.push({ package: pkg, task: dep });
      }
    }
  }

  const cycle = findCycle(nodes, dependencies);
  if (cycle) {
    return {
      ok: false,
      error: {
        kind: 'cycle',
        cycle,
        message: `Task dependency cycle detected: ${cycle.join(' -> ')}`,
      },
    };
  }

  return { ok: true, plan: { nodes, dependencies } };
}

/**
 * Depth-first cycle search over the (package, task) DAG. Returns the closing
 * path of the first cycle found (e.g. `[a#build, b#build, a#build]`), or null.
 */
function findCycle(
  nodes: ReadonlyMap<string, TaskNode>,
  dependencies: ReadonlyMap<string, ReadonlySet<string>>
): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodes.keys()) color.set(id, WHITE);

  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    color.set(id, GRAY);
    stack.push(id);

    for (const dep of dependencies.get(id) ?? []) {
      const c = color.get(dep) ?? WHITE;
      if (c === GRAY) {
        // Found a back-edge: slice the live stack from `dep` and close it.
        const start = stack.indexOf(dep);
        return [...stack.slice(start), dep];
      }
      if (c === WHITE) {
        const found = visit(dep);
        if (found) return found;
      }
    }

    stack.pop();
    color.set(id, BLACK);
    return null;
  };

  for (const id of nodes.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Stateful, bounded-parallel scheduler over a verified {@link ExecutionPlan}.
 *
 * Usage: repeatedly call {@link ready} to get nodes whose dependencies are all
 * complete and that are not already running/done, mark them in-flight via
 * {@link start}, and report terminal state with {@link complete}. A node whose
 * dependency FAILED is moved to `skipped` and never becomes ready. This keeps
 * the executor a thin driver: it owns the process spawning + concurrency cap,
 * the scheduler owns "what may run next".
 */
export class ReadySetScheduler {
  private readonly plan: ExecutionPlan;
  private readonly continueOnError: boolean;
  private readonly running = new Set<string>();
  private readonly succeeded = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly skipped = new Set<string>();

  /**
   * @param plan           The verified, acyclic execution plan.
   * @param continueOnError When true, only nodes that transitively DEPEND on a
   *   failed node are cascaded to `skipped`; independent branches still run.
   *   When false (default), any failed/skipped dependency blocks the node.
   */
  constructor(plan: ExecutionPlan, continueOnError = false) {
    this.plan = plan;
    this.continueOnError = continueOnError;
  }

  /** All node ids in the plan. */
  get allNodeIds(): string[] {
    return [...this.plan.nodes.keys()];
  }

  /** Look up a node by id (for the executor to read package/task). */
  node(id: string): TaskNode | undefined {
    return this.plan.nodes.get(id);
  }

  /** True once every node has reached a terminal state. */
  isDone(): boolean {
    return (
      this.succeeded.size + this.failed.size + this.skipped.size ===
      this.plan.nodes.size
    );
  }

  /**
   * Nodes that may start now: not yet started, with every dependency already
   * succeeded. Call {@link start} before spawning.
   *
   * When `continueOnError` is false (default): once any node has failed, no new
   * nodes are scheduled (return []); nodes whose deps directly failed/were
   * skipped are cascaded to `skipped` so the plan can drain.
   *
   * When `continueOnError` is true: only nodes that TRANSITIVELY depend on a
   * failed/skipped node are cascaded; independent branches whose deps are all
   * succeeded (or have no deps) become ready and run normally.
   */
  ready(): TaskNode[] {
    // In strict mode (continueOnError=false), stop scheduling any new work once
    // a failure has occurred.  Cascade ALL remaining pending nodes to skipped
    // (including independent ones) so isDone() can converge without a deadlock
    // and no independent branches start after a failure.
    const anyFailed = this.failed.size > 0;
    if (!this.continueOnError && anyFailed) {
      for (const [id] of this.plan.nodes) {
        if (this.isStartedOrTerminal(id)) continue;
        this.skipped.add(id);
      }
      return [];
    }

    const result: TaskNode[] = [];
    for (const [id, node] of this.plan.nodes) {
      if (this.isStartedOrTerminal(id)) continue;
      const deps = this.plan.dependencies.get(id) ?? new Set<string>();

      let blockedByFailure = false;
      let allSucceeded = true;
      for (const dep of deps) {
        if (this.failed.has(dep) || this.skipped.has(dep)) {
          blockedByFailure = true;
          break;
        }
        if (!this.succeeded.has(dep)) {
          allSucceeded = false;
        }
      }

      if (blockedByFailure) {
        // Cascade nodes whose direct deps failed/were skipped.
        this.skipped.add(id);
        continue;
      }
      if (allSucceeded) result.push(node);
    }
    return result;
  }

  /** Mark a node in-flight so it is not handed out again. */
  start(id: string): void {
    this.running.add(id);
  }

  /**
   * Report a node's terminal outcome. `'skipped'` is used by the executor when
   * a package does not actually define the task script.
   */
  complete(id: string, status: 'success' | 'failed' | 'skipped'): void {
    this.running.delete(id);
    if (status === 'success') this.succeeded.add(id);
    else if (status === 'failed') this.failed.add(id);
    else this.skipped.add(id);
  }

  /** Count of nodes currently in flight (for concurrency accounting). */
  get inFlight(): number {
    return this.running.size;
  }

  private isStartedOrTerminal(id: string): boolean {
    return (
      this.running.has(id) ||
      this.succeeded.has(id) ||
      this.failed.has(id) ||
      this.skipped.has(id)
    );
  }
}

/**
 * Merge an optional workspace `tasks` config over the built-in defaults. A task
 * present in the workspace config fully replaces the default for that task name
 * (no deep-merge of `dependsOn`), which keeps overrides predictable.
 */
export function mergeTasksConfig(workspaceTasks?: TasksConfig): TasksConfig {
  return { ...DEFAULT_TASKS_CONFIG, ...(workspaceTasks ?? {}) };
}
