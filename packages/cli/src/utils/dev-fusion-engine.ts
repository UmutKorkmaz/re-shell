// `re-shell dev` graph-aware fusion engine — PURE.
//
// Fuses the workspace dependency graph with a change event to resolve the
// ordered set of packages that must hot-restart: the changed packages PLUS
// their transitive DEPENDENTS, in dependency order (deps before dependents), so
// a change to a shared lib restarts only its downstream consumers in the right
// sequence. Also provides debounce coalescing so rapid successive saves collapse
// into a single propagation.
//
// This module is intentionally I/O-free and contracts-free: it only transforms
// in-memory graph + change data into an ordered restart plan. The command layer
// (dev-mode) discovers the workspace and feeds events; the Ink TUI renders the
// plan. No mutation of any input is ever performed.

/** The workspace dependency graph (each key → its UPSTREAM deps). */
export type DevFusionGraph = ReadonlyMap<string, readonly string[]>;

/** A single change event: the package names whose files changed. */
export interface DevChangeEvent {
  /** Monotonic event sequence id (used for debounce ordering). */
  readonly seq: number;
  /** Wall-clock-ish timestamp in ms (used for the debounce window). */
  readonly tsMs: number;
  /** Names of the packages whose files changed in this event. */
  readonly packages: readonly string[];
}

/**
 * Build the reverse (dependents) graph from an upstream graph: each name maps to
 * the packages that directly depend on it. Pure.
 */
export function buildDependentsGraph(
  graph: DevFusionGraph
): Map<string, string[]> {
  const dependents = new Map<string, string[]>();
  for (const name of graph.keys()) dependents.set(name, []);
  for (const [name, deps] of graph) {
    for (const dep of deps) {
      if (dep !== name && dependents.has(dep)) {
        dependents.get(dep)!.push(name);
      }
    }
  }
  return dependents;
}

/**
 * Resolve the full set of packages that must restart when `seeds` change: the
 * seeds themselves PLUS every transitive dependent (a change to an upstream
 * package forces a restart of everything downstream of it). Pure BFS over the
 * reverse graph; cycle-tolerant (visited-set). Returns the set including seeds.
 */
export function transitiveDependents(
  dependentsGraph: ReadonlyMap<string, readonly string[]>,
  seeds: readonly string[]
): Set<string> {
  const affected = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (affected.has(current)) continue;
    affected.add(current);
    for (const dependent of dependentsGraph.get(current) ?? []) {
      if (!affected.has(dependent)) queue.push(dependent);
    }
  }
  return affected;
}

/**
 * Kahn's topological sort scoped to a SUBSET of the graph (only the affected
 * nodes), so the restart order is deps-before-dependents within the propagation.
 * Ties broken alphabetically for determinism. Cycle-tolerant: leftover nodes
 * are appended.
 */
export function orderSubgraph(
  graph: DevFusionGraph,
  subset: ReadonlySet<string>
): string[] {
  const inSubset = (n: string) => subset.has(n) && graph.has(n);
  // indegree within the subset: count upstream deps that are ALSO in the subset.
  const indegree = new Map<string, number>();
  for (const name of subset) if (graph.has(name)) indegree.set(name, 0);
  for (const name of indegree.keys()) {
    for (const dep of graph.get(name) ?? []) {
      if (inSubset(dep) && dep !== name) indegree.set(name, (indegree.get(name) ?? 0) + 1);
    }
  }
  const dependents = new Map<string, string[]>();
  for (const name of indegree.keys()) dependents.set(name, []);
  for (const name of indegree.keys()) {
    for (const dep of graph.get(name) ?? []) {
      if (inSubset(dep) && dep !== name) dependents.get(dep)!.push(name);
    }
  }

  const ready = [...indegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([name]) => name)
    .sort();
  const ordered: string[] = [];
  const visited = new Set<string>();
  while (ready.length > 0) {
    const current = ready.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    ordered.push(current);
    const next: string[] = [];
    for (const dependent of dependents.get(current) ?? []) {
      const deg = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, deg);
      if (deg <= 0 && !visited.has(dependent)) next.push(dependent);
    }
    ready.push(...next);
    ready.sort();
  }
  const leftover = [...indegree.keys()].filter(n => !visited.has(n)).sort();
  return [...ordered, ...leftover];
}

/** Why a package is in the restart plan: it changed, or it depends on one that did. */
export type RestartReason = 'changed' | 'dependent';

/** One entry in a restart plan: the package, its reason, and its restart depth. */
export interface RestartTarget {
  readonly name: string;
  readonly reason: RestartReason;
  /** Distance from the nearest changed seed (0 for seeds themselves). */
  readonly depth: number;
}

/** The output of {@link resolveRestartTargets}: the ordered restart plan. */
export interface RestartPlan {
  /** Ordered deps-before-dependents (the order to restart in). */
  readonly ordered: readonly RestartTarget[];
  /** The raw set of affected packages (unordered, for membership checks). */
  readonly affected: readonly string[];
  /** Packages in `seeds` that were unknown to the graph (warned by the caller). */
  readonly unknownSeeds: readonly string[];
}

/**
 * Resolve the restart plan for a set of changed packages against the workspace
 * graph: seeds + transitive dependents, in dependency order, each tagged with
 * its reason and depth. Seeds absent from the graph are returned in
 * `unknownSeeds` (the caller warns) and excluded from the plan.
 */
export function resolveRestartTargets(
  graph: DevFusionGraph,
  seeds: readonly string[]
): RestartPlan {
  const known = seeds.filter(s => graph.has(s));
  const unknownSeeds = seeds.filter(s => !graph.has(s));
  if (known.length === 0) {
    return { ordered: [], affected: [], unknownSeeds };
  }

  const dependentsGraph = buildDependentsGraph(graph);
  const affected = transitiveDependents(dependentsGraph, known);
  const order = orderSubgraph(graph, affected);

  // Depth = shortest reverse-graph distance from any seed (BFS), so the TUI can
  // show propagation waves.
  const depth = new Map<string, number>();
  const queue: Array<{ name: string; d: number }> = known.map(n => ({ name: n, d: 0 }));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const { name, d } = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    if (!depth.has(name) || depth.get(name)! > d) depth.set(name, d);
    for (const dependent of dependentsGraph.get(name) ?? []) {
      if (!seen.has(dependent)) queue.push({ name: dependent, d: d + 1 });
    }
  }
  const seedSet = new Set(known);

  const ordered: RestartTarget[] = order.map(name => ({
    name,
    reason: seedSet.has(name) ? 'changed' : 'dependent',
    depth: depth.get(name) ?? 0,
  }));

  return { ordered, affected: [...affected].sort(), unknownSeeds };
}

/** A coalesced restart plan plus the event window metadata. */
export interface CoalescedPlan {
  /** The events that were coalesced (in seq order). */
  readonly events: readonly DevChangeEvent[];
  /** The merged restart plan across all coalesced events. */
  readonly plan: RestartPlan;
}

/**
 * Coalesce a stream of change events within a debounce window into a single
 * restart plan. Events with `tsMs` within `windowMs` of the first event in a
 * batch are merged; the batch flushes when an event arrives past the window.
 *
 * Returns the flushed batches (each a CoalescedPlan) plus any trailing events
 * that did not yet exceed the window (the caller holds them for the next flush).
 * Pure: given the same events + window, always produces the same batches.
 *
 * `graph` is the workspace graph used to resolve each batch's restart targets.
 */
export function coalesceChangeEvents(
  graph: DevFusionGraph,
  events: readonly DevChangeEvent[],
  windowMs: number
): { batches: CoalescedPlan[]; trailing: readonly DevChangeEvent[] } {
  if (events.length === 0) return { batches: [], trailing: [] };
  const sorted = [...events].sort((a, b) => a.tsMs - b.tsMs || a.seq - b.seq);
  const batches: CoalescedPlan[] = [];
  let current: DevChangeEvent[] = [];
  let windowStart = sorted[0]!.tsMs;

  const flush = (batch: DevChangeEvent[]) => {
    if (batch.length === 0) return;
    const seeds = [...new Set(batch.flatMap(e => e.packages))];
    batches.push({
      events: [...batch],
      plan: resolveRestartTargets(graph, seeds),
    });
  };

  for (const event of sorted) {
    if (event.tsMs - windowStart > windowMs && current.length > 0) {
      flush(current);
      current = [];
    }
    if (current.length === 0) windowStart = event.tsMs;
    current.push(event);
  }

  // Whatever remains within the last window is trailing (not yet flushed).
  const trailing = current;
  return { batches, trailing };
}
