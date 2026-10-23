import { cpuUsage } from 'node:process';
import { describe, expect, it } from 'vitest';
import { reachableFrom, shortestDependencyPath } from '@re-shell/contracts';
import { buildGraphSpec, describeSpec } from '../../../e2e/fixtures/graph-fixture.mjs';
import type { WorkspaceGraph } from '../shared/feedSchemas';
import { buildGraphData, factsFromModel } from './graphData';
import { matchNodes } from './graphFilters';
import { COMPACT_LAYOUT, computeLayout } from './layout';
import { buildFlow, displayFromData, createFlowCache, type ViewState } from './view';

/**
 * The 2000-node fixture the Playwright spec loads through the real hub, pushed
 * through every O(n) stage the screen runs on a render. Budgets are generous
 * (shared CI machines); they exist to catch O(n^2) regressions, not to benchmark.
 */

function feedFromSpec(count: number): WorkspaceGraph {
  const spec = buildGraphSpec(count);
  const toNode = (w: (typeof spec)[number]) => ({
    name: w.name,
    path: w.dir,
    framework: w.framework.id,
    dependencies: [...w.deps, ...w.devDeps],
    type: w.kind === 'app' ? 'app' : 'package',
    language: w.framework.language,
  });
  return { apps: spec.filter((w) => w.kind === 'app').map(toNode), services: spec.filter((w) => w.kind !== 'app').map(toNode) };
}

describe('2000-node fixture', () => {
  it('generates exactly the promised graph: apps, layered DAG, one deliberate cycle, deterministic', () => {
    const a = buildGraphSpec(2000);
    const b = buildGraphSpec(2000);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const info = describeSpec(a);
    expect(info.nodes).toBe(2000);
    expect(info.apps).toBe(120);
    expect(info.edges).toBeGreaterThan(3000);
    const data = buildGraphData(feedFromSpec(2000));
    expect(data.model.nodes).toHaveLength(2000);
    expect(data.cycles.cycles).toHaveLength(1);
    expect(data.cycles.cycles[0]).toHaveLength(3);
  });

  it('builds the graph, layout, flow, filters and selection for 2000 nodes within budget', () => {
    const feed = feedFromSpec(2000);
    const timings: Record<string, number> = {};
    const time = <T>(label: string, fn: () => T): T => {
      const t = performance.now();
      const out = fn();
      timings[label] = performance.now() - t;
      return out;
    };

    const data = time('buildGraphData', () => buildGraphData(feed));
    const display = displayFromData(data);
    const layout = time('layout', () => computeLayout(display.index, COMPACT_LAYOUT));
    expect(layout.positions.size).toBe(2000);

    const cache = createFlowCache();
    const baseView: ViewState = {
      matches: null,
      hide: false,
      selected: null,
      upstream: new Set(),
      downstream: new Set(),
      path: null,
      showCycles: true,
      statusOf: () => 'unknown',
      reasonOf: () => undefined,
      portOf: () => undefined,
    };
    const first = time('buildFlow(first)', () => buildFlow(display, layout, baseView, cache, () => () => undefined));
    expect(first.nodes).toHaveLength(2000);
    expect(first.edges.length).toBe(data.model.edges.length);
    expect(first.nodes[0].data.compact).toBe(true);

    const facts = factsFromModel(display.model);
    const matches = time('matchNodes', () => matchNodes(facts, { q: 'pkg-01', language: 'typescript', framework: '', type: '', status: '' }, () => 'unknown'));
    expect(matches.size).toBeGreaterThan(0);
    expect(matches.size).toBeLessThan(2000);
    const filtered = time('buildFlow(filter)', () => buildFlow(display, layout, { ...baseView, matches }, cache, () => () => undefined));
    expect(filtered.nodes.filter((n) => n.data.match).length).toBe(matches.size);
    // ...and only those nodes were rebuilt: every non-matching node is the identical object as before.
    const unchanged = filtered.nodes.filter((n, i) => !n.data.match && n === first.nodes[i]).length;
    expect(unchanged).toBe(2000 - matches.size);

    const app = data.nodes.find((n) => n.kind === 'app')!.name;
    const up = time('upstream', () => reachableFrom(display.index, app, 'dependencies'));
    expect(up.size).toBeGreaterThan(0);
    const deepest = [...up][up.size - 1];
    const path = time('shortestPath', () => shortestDependencyPath(display.index, app, deepest));
    expect(path).not.toBeNull();
    const selected = time('buildFlow(selection)', () =>
      buildFlow(display, layout, { ...baseView, selected: app, upstream: up, downstream: new Set(), path }, cache, () => () => undefined)
    );
    expect(selected.nodes.filter((n) => n.data.highlight === 'path' || n.data.highlight === 'path-end').length).toBe(path!.path.length);

    const total = Object.values(timings).reduce((a, b) => a + b, 0);
    // Whole pipeline for 2000 nodes: well under 2 s even on a loaded machine.
    expect(total).toBeLessThan(2000);
    for (const [label, ms] of Object.entries(timings)) expect(ms, label).toBeLessThan(1000);
  });

  it('scales roughly linearly: 8000 nodes costs far less than 16x of 2000', () => {
    // Prepare both inputs before sampling so fixture allocation cannot skew one size.
    const smallGraph = displayFromData(buildGraphData(feedFromSpec(2000)));
    const largeGraph = displayFromData(buildGraphData(feedFromSpec(8000)));
    const measure = (display: ReturnType<typeof displayFromData>): number => {
      const started = cpuUsage();
      const flow = buildFlow(
        display,
        computeLayout(display.index, COMPACT_LAYOUT),
        { matches: null, hide: false, selected: null, upstream: new Set(), downstream: new Set(), path: null, showCycles: true, statusOf: () => 'unknown', reasonOf: () => undefined, portOf: () => undefined },
        createFlowCache(),
        () => () => undefined
      );
      const elapsed = cpuUsage(started);
      expect(flow.nodes).toHaveLength(display.model.nodes.length);
      expect(flow.edges).toHaveLength(display.model.edges.length);
      return (elapsed.user + elapsed.system) / 1000;
    };
    for (let i = 0; i < 2; i++) {
      measure(smallGraph);
      measure(largeGraph);
    }
    const samples = { small: [] as number[], large: [] as number[] };
    for (let i = 0; i < 6; i++) {
      // Alternate which size runs first to balance JIT and garbage-collection effects.
      if (i % 2 === 0) {
        samples.small.push(measure(smallGraph));
        samples.large.push(measure(largeGraph));
      } else {
        samples.large.push(measure(largeGraph));
        samples.small.push(measure(smallGraph));
      }
    }
    const median = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      return (sorted[2] + sorted[3]) / 2;
    };
    const small = Math.max(median(samples.small), 5);
    const large = median(samples.large);
    // CPU time excludes host descheduling; the wall-time budgets above stay unchanged.
    // Every sample still creates a fresh layout/cache. Linear is ~4x; quadratic is 16x.
    expect(large / small, `CPU samples in ms: ${JSON.stringify(samples)}`).toBeLessThan(11);
  });
});
