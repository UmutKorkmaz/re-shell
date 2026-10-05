import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { GraphNodeData } from './GraphNodeCard';
import { DOM_EXPORT_MAX_NODES, sceneToSvg, visibleNodes, type SceneInput } from './exportScene';

function node(id: string, x: number, y: number, over: Partial<GraphNodeData> = {}): Node<GraphNodeData> {
  return {
    id,
    type: 'topology',
    position: { x, y },
    data: { label: id, kind: 'service', framework: null, status: 'unknown', compact: true, onOpen: () => undefined, ...over },
  };
}

function scene(nodes: Node<GraphNodeData>[], edges: Edge[] = [], over: Partial<SceneInput> = {}): SceneInput {
  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    width: 800,
    height: 600,
    focus: false,
    filtering: false,
    dimEdges: false,
    background: '#0b0d10',
    foreground: '#e2e8f0',
    ...over,
  };
}

const count = (svg: string, tag: string) => (svg.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;

describe('visibleNodes', () => {
  const nodes = [node('in', 100, 100), node('right', 5000, 100), node('below', 100, 5000), node('hidden', 120, 120)];
  nodes[3].hidden = true;

  it('keeps only nodes whose box intersects the viewport and skips hidden ones', () => {
    expect(visibleNodes(scene(nodes)).map((v) => v.node.id)).toEqual(['in']);
  });

  it('follows pan and zoom', () => {
    // zoomed out 0.1x: a 800x600 canvas covers 8000x6000 flow units
    expect(visibleNodes(scene(nodes, [], { viewport: { x: 0, y: 0, zoom: 0.1 } })).map((v) => v.node.id).sort()).toEqual(['below', 'in', 'right']);
    // panned so only `right` is in view
    expect(visibleNodes(scene(nodes, [], { viewport: { x: -4900, y: 0, zoom: 1 } })).map((v) => v.node.id)).toEqual(['right']);
  });
});

describe('sceneToSvg', () => {
  it('is well-formed XML with the canvas size, background, node labels and edges', () => {
    const svg = sceneToSvg(scene([node('a', 10, 10), node('b', 10, 200)], [{ id: 'a->b', source: 'a', target: 'b' }]));
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('width')).toBe('800');
    expect(doc.documentElement.getAttribute('height')).toBe('600');
    expect(svg).toContain('fill="#0b0d10"');
    expect(svg).toContain('>a</text>');
    expect(svg).toContain('>b</text>');
    expect(count(svg, 'line')).toBe(1);
    expect(svg).toContain('2 of 2 nodes in view');
  });

  it('escapes XML metacharacters in names', () => {
    const svg = sceneToSvg(scene([node('<x & "y">', 10, 10)]));
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
    expect(svg).toContain('&lt;x &amp; &quot;y&quot;&gt;');
  });

  it('colours status, diff, highlight and cycle; dims what is not emphasized', () => {
    const svg = sceneToSvg(
      scene(
        [
          node('run', 0, 0, { status: 'running' }),
          node('added', 0, 100, { diff: 'added' }),
          node('sel', 0, 200, { highlight: 'selected' }),
          node('plain', 0, 300),
          node('cyc', 0, 400, { cycle: true }),
        ],
        [
          { id: 'run->added', source: 'run', target: 'added', className: 'ge-added' },
          { id: 'sel->plain', source: 'sel', target: 'plain' },
        ],
        { focus: true, dimEdges: true }
      )
    );
    expect(svg).toContain('#22c55e'); // running dot
    expect(svg).toContain('stroke="#2da44e"'); // added
    expect(svg).toContain('stroke="#a3e635"'); // selected
    expect(svg).toContain('stroke="#ef4444"'); // cycle
    expect(svg).toContain('stroke-dasharray="6 4"');
    // focus mode: only the highlighted (selected) node stays bright, every other node is dimmed
    expect((svg.match(/<g opacity="0.18">/g) ?? []).length).toBe(4);
    expect((svg.match(/<g opacity="1">/g) ?? []).length).toBe(1);
    // the emphasized edge stays bright, the plain one is dimmed
    expect(svg).toMatch(/stroke="#2da44e" stroke-opacity="0.85"/);
    expect(svg).toMatch(/stroke="#64748b" stroke-opacity="0.12"/);
  });

  it('search filtering keeps matches bright and dims the rest', () => {
    const svg = sceneToSvg(scene([node('hit', 0, 0, { match: true }), node('miss', 0, 100)], [], { filtering: true }));
    expect((svg.match(/<g opacity="0.18">/g) ?? []).length).toBe(1);
    expect((svg.match(/<g opacity="1">/g) ?? []).length).toBe(1);
  });

  it('draws low-detail blocks (no text) when zoomed far out, and full cards when not compact', () => {
    const far = sceneToSvg(scene([node('a', 0, 0)], [], { viewport: { x: 0, y: 0, zoom: 0.2 } }));
    expect(count(far, 'text')).toBe(1); // only the "N of M nodes in view" footer
    const full = sceneToSvg(scene([node('a', 0, 0, { compact: false, kind: 'app', framework: 'react-ts', language: 'typescript', status: 'running' })]));
    expect(full).toContain('app · react-ts · typescript');
    expect(full).toContain('>running</text>');
  });

  it('only draws edges with an end in view, using off-screen end positions', () => {
    const nodes = [node('near', 100, 100), node('far', 9000, 9000), node('alsoFar', 9500, 9500)];
    const svg = sceneToSvg(
      scene(nodes, [
        { id: 'near->far', source: 'near', target: 'far' },
        { id: 'far->alsoFar', source: 'far', target: 'alsoFar' },
      ])
    );
    expect(count(svg, 'line')).toBe(1);
    expect(svg).toContain('1 of 3 nodes in view');
  });

  it('skips hidden nodes and edges', () => {
    const hidden = node('h', 0, 0);
    hidden.hidden = true;
    const svg = sceneToSvg(scene([hidden, node('v', 0, 100)], [{ id: 'h->v', source: 'h', target: 'v', hidden: true }]));
    expect(count(svg, 'line')).toBe(0);
    expect(count(svg, 'rect')).toBe(2); // background + the one visible node
  });

  it('renders thousands of nodes quickly and stays well below the DOM-capture cost', () => {
    const nodes = Array.from({ length: 5000 }, (_, i) => node(`n${i}`, (i % 100) * 200, Math.floor(i / 100) * 70));
    const edges: Edge[] = nodes.slice(1).map((n, i) => ({ id: `${i}`, source: `n${i}`, target: n.id }));
    const input = scene(nodes, edges, { viewport: { x: 0, y: 0, zoom: 0.05 }, width: 1440, height: 900 });
    const t = performance.now();
    const svg = sceneToSvg(input);
    const ms = performance.now() - t;
    expect(visibleNodes(input).length).toBeGreaterThan(DOM_EXPORT_MAX_NODES);
    expect(svg.length).toBeGreaterThan(100_000);
    expect(ms).toBeLessThan(2000);
  });
});
