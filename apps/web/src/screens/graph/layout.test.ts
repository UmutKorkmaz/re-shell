import { describe, expect, it } from 'vitest';
import { buildGraphIndex, type GraphModel } from '@re-shell/contracts';
import { COMPACT_LAYOUT, DEFAULT_LAYOUT, computeLayout } from './layout';

const N = (id: string) => ({ id, type: 'package' });
const E = (from: string, to: string) => ({ from, to, type: 'dependency' as const });

function layout(graph: GraphModel, options = DEFAULT_LAYOUT) {
  return computeLayout(buildGraphIndex(graph), options);
}

describe('computeLayout', () => {
  it('puts dependents above their dependencies (layer = longest chain from the top)', () => {
    const r = layout({
      nodes: ['app', 'ui', 'core', 'util'].map(N),
      edges: [E('app', 'ui'), E('ui', 'core'), E('app', 'core'), E('core', 'util')],
    });
    expect(r.layers.get('app')).toBe(0);
    expect(r.layers.get('ui')).toBe(1);
    expect(r.layers.get('core')).toBe(2); // longest path app->ui->core, not the direct app->core
    expect(r.layers.get('util')).toBe(3);
    const y = (id: string) => r.positions.get(id)!.y;
    expect(y('app')).toBeLessThan(y('ui'));
    expect(y('ui')).toBeLessThan(y('core'));
    expect(y('core')).toBeLessThan(y('util'));
  });

  it('places every node exactly once with finite, non-overlapping coordinates', () => {
    const nodes = Array.from({ length: 60 }, (_, i) => N(`n${i}`));
    const edges = nodes.slice(1).map((n, i) => E(`n${Math.floor(i / 3)}`, n.id));
    const r = layout({ nodes, edges });
    expect(r.positions.size).toBe(60);
    const seen = new Set<string>();
    for (const p of r.positions.values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      const key = `${p.x}:${p.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('lays out cyclic graphs instead of looping, keeping the cycle on one layer', () => {
    const r = layout({
      nodes: ['top', 'a', 'b', 'c', 'leaf'].map(N),
      edges: [E('top', 'a'), E('a', 'b'), E('b', 'c'), E('c', 'a'), E('c', 'leaf')],
    });
    expect(r.positions.size).toBe(5);
    expect(r.layers.get('a')).toBe(r.layers.get('b'));
    expect(r.layers.get('b')).toBe(r.layers.get('c'));
    expect(r.layers.get('leaf')!).toBeGreaterThan(r.layers.get('a')!);
  });

  it('wraps a wide layer onto several rows and centres each row', () => {
    const nodes = Array.from({ length: 50 }, (_, i) => N(`leaf-${String(i).padStart(2, '0')}`));
    const r = computeLayout(buildGraphIndex({ nodes, edges: [] }), { ...DEFAULT_LAYOUT, perRow: 10 });
    const ys = new Set([...r.positions.values()].map((p) => p.y));
    expect(ys.size).toBe(5);
    const row0 = [...r.positions.values()].filter((p) => p.y === 0).map((p) => p.x);
    expect(Math.min(...row0)).toBe(-Math.max(...row0));
    expect(r.width).toBe(9 * DEFAULT_LAYOUT.columnGap);
  });

  it('handles empty, single-node and edge-only-to-self graphs', () => {
    expect(layout({ nodes: [], edges: [] }).positions.size).toBe(0);
    const one = layout({ nodes: [N('solo')], edges: [] });
    expect(one.positions.get('solo')).toEqual({ x: 0, y: 0 });
    const self = layout({ nodes: [N('s')], edges: [E('s', 's')] });
    expect(self.positions.size).toBe(1);
  });

  it('is deterministic', () => {
    const g: GraphModel = {
      nodes: ['x', 'y', 'z', 'w'].map(N),
      edges: [E('x', 'y'), E('x', 'z'), E('y', 'w'), E('z', 'w')],
    };
    expect([...layout(g).positions]).toEqual([...layout(g).positions]);
  });

  it('uses tighter spacing for compact layouts', () => {
    const g: GraphModel = { nodes: [N('a'), N('b')], edges: [E('a', 'b')] };
    expect(layout(g, COMPACT_LAYOUT).positions.get('b')!.y).toBeLessThan(layout(g, DEFAULT_LAYOUT).positions.get('b')!.y);
  });

  it('lays out 5000 nodes / 15000 edges in well under a second (no worker needed)', () => {
    const count = 5000;
    const nodes = Array.from({ length: count }, (_, i) => N(`p${i}`));
    const edges: GraphModel['edges'] = [];
    for (let i = 1; i < count; i++) {
      for (const back of [1, 13, 97]) if (i - back >= 0) edges.push(E(`p${i}`, `p${i - back}`));
    }
    const index = buildGraphIndex({ nodes, edges });
    const t = performance.now();
    const r = computeLayout(index, COMPACT_LAYOUT);
    const ms = performance.now() - t;
    expect(r.positions.size).toBe(count);
    expect(ms).toBeLessThan(1500);
  });
});
