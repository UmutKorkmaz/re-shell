import { describe, it, expect } from 'vitest';
import {
  buildDependentsGraph,
  transitiveDependents,
  orderSubgraph,
  resolveRestartTargets,
  coalesceChangeEvents,
  type DevFusionGraph,
  type DevChangeEvent,
} from '../../src/utils/dev-fusion-engine';

/**
 * Pure-engine conformance for the `re-shell dev` graph-aware fusion (issue #14).
 * Everything here is offline, deterministic, and side-effect free.
 */

/** A 4-package graph: shared ← api ← web; shared ← worker. (upstream deps) */
function sampleGraph(): DevFusionGraph {
  return new Map<string, readonly string[]>([
    ['shared', []],
    ['api', ['shared']],
    ['worker', ['shared']],
    ['web', ['api']],
  ]);
}

describe('buildDependentsGraph', () => {
  it('reverses the upstream graph into a dependents map', () => {
    const deps = buildDependentsGraph(sampleGraph());
    expect(deps.get('shared')!.sort()).toEqual(['api', 'worker']);
    expect(deps.get('api')).toEqual(['web']);
    expect(deps.get('web')).toEqual([]);
  });

  it('ignores self-loops', () => {
    const g: DevFusionGraph = new Map([['a', ['a']]]);
    expect(buildDependentsGraph(g).get('a')).toEqual([]);
  });
});

describe('transitiveDependents', () => {
  it('returns seeds + every transitive dependent (BFS)', () => {
    const deps = buildDependentsGraph(sampleGraph());
    const affected = transitiveDependents(deps, ['shared']);
    expect([...affected].sort()).toEqual(['api', 'shared', 'web', 'worker']);
  });

  it('returns only the seed when nothing depends on it', () => {
    const deps = buildDependentsGraph(sampleGraph());
    expect([...transitiveDependents(deps, ['web'])].sort()).toEqual(['web']);
  });

  it('tolerates cycles (visited-set)', () => {
    // a ↔ b cycle
    const g: DevFusionGraph = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    const deps = buildDependentsGraph(g);
    const affected = transitiveDependents(deps, ['a']);
    expect([...affected].sort()).toEqual(['a', 'b']);
  });
});

describe('orderSubgraph', () => {
  it('orders the affected subset deps-before-dependents', () => {
    const g = sampleGraph();
    const order = orderSubgraph(g, new Set(['shared', 'api', 'web', 'worker']));
    const idx = (n: string) => order.indexOf(n);
    expect(idx('shared')).toBeLessThan(idx('api'));
    expect(idx('shared')).toBeLessThan(idx('worker'));
    expect(idx('api')).toBeLessThan(idx('web'));
  });

  it('scopes only to the subset (excludes unrelated nodes)', () => {
    const g = sampleGraph();
    const order = orderSubgraph(g, new Set(['api', 'web']));
    // shared is NOT in the subset, so it is excluded; api before web.
    expect(order).toEqual(['api', 'web']);
  });
});

describe('resolveRestartTargets', () => {
  it('changes to a shared lib restart it + its dependents in dependency order', () => {
    const plan = resolveRestartTargets(sampleGraph(), ['shared']);
    expect(plan.affected.sort()).toEqual(['api', 'shared', 'web', 'worker']);
    const names = plan.ordered.map(t => t.name);
    // shared first, then api/worker, then web.
    expect(names.indexOf('shared')).toBe(0);
    expect(names.indexOf('api')).toBeLessThan(names.indexOf('web'));
  });

  it('tags seeds as changed and downstream as dependent', () => {
    const plan = resolveRestartTargets(sampleGraph(), ['shared']);
    const byName = new Map(plan.ordered.map(t => [t.name, t]));
    expect(byName.get('shared')!.reason).toBe('changed');
    expect(byName.get('api')!.reason).toBe('dependent');
    expect(byName.get('web')!.reason).toBe('dependent');
  });

  it('assigns propagation depth (0 for seeds, increasing downstream)', () => {
    const plan = resolveRestartTargets(sampleGraph(), ['shared']);
    const byName = new Map(plan.ordered.map(t => [t.name, t]));
    expect(byName.get('shared')!.depth).toBe(0);
    expect(byName.get('api')!.depth).toBe(1);
    expect(byName.get('worker')!.depth).toBe(1);
    expect(byName.get('web')!.depth).toBe(2);
  });

  it('does NOT restart unrelated packages', () => {
    // Changing `worker` (nothing depends on it) restarts only worker.
    const plan = resolveRestartTargets(sampleGraph(), ['worker']);
    expect(plan.ordered.map(t => t.name)).toEqual(['worker']);
  });

  it('returns unknown seeds separately and excludes them from the plan', () => {
    const plan = resolveRestartTargets(sampleGraph(), ['shared', 'ghost']);
    expect(plan.unknownSeeds).toEqual(['ghost']);
    expect(plan.ordered.some(t => t.name === 'ghost')).toBe(false);
  });

  it('returns an empty plan when every seed is unknown', () => {
    const plan = resolveRestartTargets(sampleGraph(), ['nope']);
    expect(plan.ordered).toEqual([]);
    expect(plan.affected).toEqual([]);
    expect(plan.unknownSeeds).toEqual(['nope']);
  });

  it('is deterministic (same input → same ordered output)', () => {
    const a = resolveRestartTargets(sampleGraph(), ['shared']);
    const b = resolveRestartTargets(sampleGraph(), ['shared']);
    expect(a.ordered).toEqual(b.ordered);
  });
});

describe('coalesceChangeEvents (debounce)', () => {
  function ev(seq: number, tsMs: number, packages: string[]): DevChangeEvent {
    return { seq, tsMs, packages };
  }

  it('coalesces rapid successive saves within the window into one batch', () => {
    const g = sampleGraph();
    const events = [
      ev(1, 1000, ['shared']),
      ev(2, 1050, ['api']),
      ev(3, 1100, ['web']),
    ];
    const { batches, trailing } = coalesceChangeEvents(g, events, 500);
    expect(batches).toHaveLength(0); // nothing flushed — all within the window
    expect(trailing).toHaveLength(3);
  });

  it('flushes a batch when an event arrives past the window', () => {
    const g = sampleGraph();
    const events = [
      ev(1, 1000, ['shared']),
      ev(2, 1200, ['api']), // 200ms later, within 500ms window
      ev(3, 2000, ['worker']), // 1000ms after window start, past 500ms → flush
    ];
    const { batches, trailing } = coalesceChangeEvents(g, events, 500);
    expect(batches).toHaveLength(1);
    // The flushed batch merges shared + api (and their dependents).
    const batch = batches[0]!;
    expect(batch.events.map(e => e.seq)).toEqual([1, 2]);
    expect(batch.plan.affected).toContain('shared');
    expect(batch.plan.affected).toContain('api');
    // The late event is trailing (next batch).
    expect(trailing.map(e => e.seq)).toEqual([3]);
  });

  it('dedupes packages across coalesced events', () => {
    const g = sampleGraph();
    const events = [ev(1, 1000, ['shared']), ev(2, 1100, ['shared', 'api'])];
    const { trailing } = coalesceChangeEvents(g, events, 500);
    // Both within the window → one trailing batch with shared appearing once.
    expect(trailing).toHaveLength(2);
  });

  it('handles an empty event stream', () => {
    const g = sampleGraph();
    const { batches, trailing } = coalesceChangeEvents(g, [], 500);
    expect(batches).toEqual([]);
    expect(trailing).toEqual([]);
  });

  it('sorts out-of-order events by timestamp before windowing', () => {
    const g = sampleGraph();
    const events = [
      ev(3, 3000, ['web']), // arrives last in array, but latest in time
      ev(1, 1000, ['shared']),
      ev(2, 2000, ['api']),
    ];
    const { trailing } = coalesceChangeEvents(g, events, 5000);
    expect(trailing.map(e => e.seq)).toEqual([1, 2, 3]);
  });
});

describe('immutability', () => {
  it('never mutates the input graph', () => {
    const g = sampleGraph();
    const snapshot = JSON.stringify([...g.entries()]);
    resolveRestartTargets(g, ['shared']);
    transitiveDependents(buildDependentsGraph(g), ['shared']);
    coalesceChangeEvents(g, [{ seq: 1, tsMs: 0, packages: ['shared'] }], 100);
    expect(JSON.stringify([...g.entries()])).toBe(snapshot);
  });
});
