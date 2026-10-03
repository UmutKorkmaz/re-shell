import type { GraphIndex } from '@re-shell/contracts';

/**
 * Layered layout for the workspace graph, O(V + E + V log V).
 *
 * Edges point from a dependent to its dependency, so dependents (apps) sit at
 * the top and leaf libraries at the bottom: layer = longest dependency chain
 * from any node that nothing depends on. Cycles are collapsed to one component
 * for layering (so a cyclic graph still lays out instead of looping), then one
 * top-down barycentre sweep orders each layer to cut edge crossings. Layers
 * wider than `perRow` wrap onto several rows so a 2000-node graph stays a
 * roughly square canvas instead of a 100 000 px wide strip.
 *
 * Pure and synchronous: measured at a few milliseconds for 2000 nodes / 6000
 * edges, so it runs inline on the main thread (no Web Worker needed).
 */

export interface LayoutOptions {
  /** Horizontal distance between node origins. */
  columnGap: number;
  /** Vertical distance between rows. */
  rowGap: number;
  /** Max nodes per row before a layer wraps. Defaults to ~1.3 * sqrt(n), min 6. */
  perRow?: number;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  /** Layer (depth) per node id. */
  layers: Map<string, number>;
  width: number;
  height: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = { columnGap: 260, rowGap: 150 };
export const COMPACT_LAYOUT: LayoutOptions = { columnGap: 200, rowGap: 72 };

export function computeLayout(index: GraphIndex, options: LayoutOptions = DEFAULT_LAYOUT): LayoutResult {
  const ids = index.nodeIds;
  const n = ids.length;
  const perRow = options.perRow ?? Math.max(6, Math.ceil(Math.sqrt(n) * 1.3));

  // --- strongly connected components (iterative Tarjan) -> component id per node
  const comp = componentsOf(index);

  // --- condensed DAG longest-path layering (Kahn)
  const compMembers = new Map<number, string[]>();
  for (const id of ids) {
    const c = comp.get(id)!;
    const list = compMembers.get(c);
    if (list) list.push(id);
    else compMembers.set(c, [id]);
  }
  const outEdges = new Map<number, Set<number>>(); // dependent comp -> dependency comps
  const indeg = new Map<number, number>();
  for (const c of compMembers.keys()) {
    outEdges.set(c, new Set());
    indeg.set(c, 0);
  }
  for (const edge of index.edges) {
    const a = comp.get(edge.from)!;
    const b = comp.get(edge.to)!;
    if (a === b) continue;
    const set = outEdges.get(a)!;
    if (!set.has(b)) {
      set.add(b);
      indeg.set(b, indeg.get(b)! + 1);
    }
  }
  const layerOfComp = new Map<number, number>();
  const queue: number[] = [];
  for (const [c, d] of indeg) {
    if (d === 0) {
      layerOfComp.set(c, 0);
      queue.push(c);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    const layer = layerOfComp.get(c)!;
    for (const next of outEdges.get(c)!) {
      if ((layerOfComp.get(next) ?? -1) < layer + 1) layerOfComp.set(next, layer + 1);
      const d = indeg.get(next)! - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  const layers = new Map<string, number>();
  const byLayer: string[][] = [];
  for (const id of ids) {
    const layer = layerOfComp.get(comp.get(id)!) ?? 0;
    layers.set(id, layer);
    (byLayer[layer] ??= []).push(id);
  }

  // --- order within each layer: names first, then one barycentre sweep
  const order = new Map<string, number>();
  const sorted: string[][] = [];
  for (let l = 0; l < byLayer.length; l++) {
    const layerNodes = (byLayer[l] ?? []).slice();
    if (l === 0) {
      layerNodes.sort(compareIds);
    } else {
      const bary = new Map<string, number>();
      for (const id of layerNodes) {
        let sum = 0;
        let count = 0;
        for (const parent of index.dependents.get(id) ?? []) {
          const o = order.get(parent);
          if (o !== undefined && layers.get(parent)! < l) {
            sum += o;
            count++;
          }
        }
        bary.set(id, count > 0 ? sum / count : Number.POSITIVE_INFINITY);
      }
      layerNodes.sort((a, b) => {
        const d = bary.get(a)! - bary.get(b)!;
        if (d !== 0 && !Number.isNaN(d)) return d;
        return compareIds(a, b);
      });
    }
    // order = global position index within the (unwrapped) layer scaled to a common width
    layerNodes.forEach((id, i) => order.set(id, layerNodes.length > 1 ? i / (layerNodes.length - 1) : 0.5));
    sorted.push(layerNodes);
  }

  // --- coordinates: wrap wide layers, centre every row on x = 0
  const positions = new Map<string, { x: number; y: number }>();
  let row = 0;
  let maxRowWidth = 0;
  for (const layerNodes of sorted) {
    for (let start = 0; start < layerNodes.length; start += perRow) {
      const slice = layerNodes.slice(start, start + perRow);
      const width = (slice.length - 1) * options.columnGap;
      maxRowWidth = Math.max(maxRowWidth, width);
      slice.forEach((id, i) => positions.set(id, { x: i * options.columnGap - width / 2, y: row * options.rowGap }));
      row++;
    }
  }
  return { positions, layers, width: maxRowWidth, height: Math.max(0, row - 1) * options.rowGap };
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Iterative Tarjan: component number per node (trivial components get their own number). */
function componentsOf(index: GraphIndex): Map<string, number> {
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const comp = new Map<string, number>();
  let counter = 0;
  let compCounter = 0;

  for (const root of index.nodeIds) {
    if (idx.has(root)) continue;
    const work: Array<{ id: string; i: number }> = [{ id: root, i: 0 }];
    idx.set(root, counter);
    low.set(root, counter++);
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1];
      const neighbours = index.dependencies.get(frame.id) ?? [];
      if (frame.i < neighbours.length) {
        const next = neighbours[frame.i++];
        if (!idx.has(next)) {
          idx.set(next, counter);
          low.set(next, counter++);
          stack.push(next);
          onStack.add(next);
          work.push({ id: next, i: 0 });
        } else if (onStack.has(next)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, idx.get(next)!));
        }
      } else {
        if (low.get(frame.id) === idx.get(frame.id)) {
          let member: string;
          do {
            member = stack.pop()!;
            onStack.delete(member);
            comp.set(member, compCounter);
          } while (member !== frame.id);
          compCounter++;
        }
        work.pop();
        const parent = work[work.length - 1];
        if (parent) low.set(parent.id, Math.min(low.get(parent.id)!, low.get(frame.id)!));
      }
    }
  }
  return comp;
}
