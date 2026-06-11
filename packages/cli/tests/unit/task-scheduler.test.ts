import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TASKS_CONFIG,
  ReadySetScheduler,
  buildExecutionPlan,
  mergeTasksConfig,
  nodeId,
  type WorkspaceDepGraph,
} from '../../src/utils/task-scheduler';
import type { TasksConfig } from '@re-shell/contracts';

// Fixture: a <- b (b depends on a). `graph` maps package -> upstream deps.
const A_B_GRAPH: WorkspaceDepGraph = new Map([
  ['a', []],
  ['b', ['a']],
]);

describe('mergeTasksConfig', () => {
  it('falls back to the defaults when no workspace config is given', () => {
    expect(mergeTasksConfig()).toEqual(DEFAULT_TASKS_CONFIG);
  });

  it('lets a workspace task fully replace the default for that name', () => {
    const merged = mergeTasksConfig({ test: { dependsOn: ['build', 'lint'] } });
    expect(merged.test).toEqual({ dependsOn: ['build', 'lint'] });
    // Untouched default is preserved.
    expect(merged.build).toEqual({ dependsOn: ['^build'] });
  });
});

describe('buildExecutionPlan — upstream (^) edges', () => {
  it('orders build of a before b via the default ^build edge', () => {
    const res = buildExecutionPlan(A_B_GRAPH, mergeTasksConfig(), [
      { package: 'a', task: 'build' },
      { package: 'b', task: 'build' },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // b#build depends on a#build (upstream-package edge).
    const bDeps = res.plan.dependencies.get(nodeId('b', 'build'))!;
    expect([...bDeps]).toContain(nodeId('a', 'build'));

    // a#build has no upstream, so no deps.
    const aDeps = res.plan.dependencies.get(nodeId('a', 'build'))!;
    expect([...aDeps]).toEqual([]);
  });

  it('expands upstream nodes even when only the downstream target is requested', () => {
    const res = buildExecutionPlan(A_B_GRAPH, mergeTasksConfig(), [
      { package: 'b', task: 'build' },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // a#build is pulled in transitively by b's ^build.
    expect(res.plan.nodes.has(nodeId('a', 'build'))).toBe(true);
  });
});

describe('buildExecutionPlan — intra-package edges', () => {
  it('wires test -> build inside the same package (default config)', () => {
    const res = buildExecutionPlan(A_B_GRAPH, mergeTasksConfig(), [
      { package: 'b', task: 'test' },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const bTestDeps = res.plan.dependencies.get(nodeId('b', 'test'))!;
    expect([...bTestDeps]).toContain(nodeId('b', 'build'));
    // build pulls in ^build => a#build, so the full chain a#build -> b#build -> b#test exists.
    expect(res.plan.nodes.has(nodeId('a', 'build'))).toBe(true);
  });
});

describe('buildExecutionPlan — cycle detection', () => {
  it('returns a hard error for an intra-package task cycle (no plan)', () => {
    const cyclic: TasksConfig = {
      build: { dependsOn: ['test'] },
      test: { dependsOn: ['build'] },
    };
    const res = buildExecutionPlan(A_B_GRAPH, cyclic, [
      { package: 'a', task: 'build' },
    ]);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.kind).toBe('cycle');
    expect(res.error.cycle.length).toBeGreaterThan(0);
    // The closing path repeats its first node.
    expect(res.error.cycle[0]).toBe(res.error.cycle[res.error.cycle.length - 1]);
  });

  it('detects a cycle across upstream-package edges', () => {
    // a <-> b cycle in the workspace graph.
    const cyclicGraph: WorkspaceDepGraph = new Map([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    const res = buildExecutionPlan(cyclicGraph, mergeTasksConfig(), [
      { package: 'a', task: 'build' },
    ]);
    expect(res.ok).toBe(false);
  });
});

describe('ReadySetScheduler', () => {
  it('hands out a#build before b#build, then b once a succeeds', () => {
    const res = buildExecutionPlan(A_B_GRAPH, mergeTasksConfig(), [
      { package: 'a', task: 'build' },
      { package: 'b', task: 'build' },
    ]);
    if (!res.ok) throw new Error('expected plan');
    const sched = new ReadySetScheduler(res.plan);

    let ready = sched.ready().map(n => n.id);
    expect(ready).toEqual([nodeId('a', 'build')]);

    sched.start(nodeId('a', 'build'));
    // While a is in flight, b is not ready.
    expect(sched.ready()).toEqual([]);

    sched.complete(nodeId('a', 'build'), 'success');
    ready = sched.ready().map(n => n.id);
    expect(ready).toEqual([nodeId('b', 'build')]);

    sched.start(nodeId('b', 'build'));
    sched.complete(nodeId('b', 'build'), 'success');
    expect(sched.isDone()).toBe(true);
  });

  it('cascades a dependent to skipped when its dependency fails', () => {
    const res = buildExecutionPlan(A_B_GRAPH, mergeTasksConfig(), [
      { package: 'b', task: 'build' },
    ]);
    if (!res.ok) throw new Error('expected plan');
    const sched = new ReadySetScheduler(res.plan);

    sched.start(nodeId('a', 'build'));
    sched.complete(nodeId('a', 'build'), 'failed');

    // b#build must never become ready; ready() cascades it to skipped.
    expect(sched.ready()).toEqual([]);
    expect(sched.isDone()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// continueOnError scheduler unit tests
// ---------------------------------------------------------------------------

describe('ReadySetScheduler — continueOnError', () => {
  // Graph: a (leaf), b (dep: a), c (independent leaf).
  // This is the canonical "independent branch" scenario.
  const A_B_C_GRAPH: WorkspaceDepGraph = new Map([
    ['a', []],
    ['b', ['a']],
    ['c', []],
  ]);

  it('continueOnError=false: after a fails, independent c is cascaded to skipped immediately', () => {
    const res = buildExecutionPlan(A_B_C_GRAPH, mergeTasksConfig(), [
      { package: 'a', task: 'build' },
      { package: 'b', task: 'build' },
      { package: 'c', task: 'build' },
    ]);
    if (!res.ok) throw new Error('expected plan');
    const sched = new ReadySetScheduler(res.plan, false);

    // a is the first ready node; start and fail it.
    sched.start(nodeId('a', 'build'));
    sched.complete(nodeId('a', 'build'), 'failed');

    // With continueOnError=false, ready() must return [] and cascade ALL
    // remaining pending nodes (b and c) to skipped.
    expect(sched.ready()).toEqual([]);
    expect(sched.isDone()).toBe(true);
  });

  it('continueOnError=true: after a fails, b (dep on a) is skipped but c (independent) is still ready', () => {
    const res = buildExecutionPlan(A_B_C_GRAPH, mergeTasksConfig(), [
      { package: 'a', task: 'build' },
      { package: 'b', task: 'build' },
      { package: 'c', task: 'build' },
    ]);
    if (!res.ok) throw new Error('expected plan');
    const sched = new ReadySetScheduler(res.plan, true);

    sched.start(nodeId('a', 'build'));
    sched.complete(nodeId('a', 'build'), 'failed');

    // b depends on a (failed) → cascaded to skipped.
    // c is independent → still ready.
    const ready = sched.ready().map(n => n.id);
    expect(ready).toContain(nodeId('c', 'build'));
    expect(ready).not.toContain(nodeId('b', 'build'));

    // Drain c.
    sched.start(nodeId('c', 'build'));
    sched.complete(nodeId('c', 'build'), 'success');
    expect(sched.isDone()).toBe(true);
  });

  it('continueOnError=true: b (dep on a) is skipped regardless when a fails', () => {
    const res = buildExecutionPlan(A_B_GRAPH, mergeTasksConfig(), [
      { package: 'a', task: 'build' },
      { package: 'b', task: 'build' },
    ]);
    if (!res.ok) throw new Error('expected plan');
    const sched = new ReadySetScheduler(res.plan, true);

    sched.start(nodeId('a', 'build'));
    sched.complete(nodeId('a', 'build'), 'failed');

    // b directly depends on a (failed) → cascaded to skipped.
    expect(sched.ready()).toEqual([]);
    expect(sched.isDone()).toBe(true);
  });
});
