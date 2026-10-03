import type { Edge, Node } from '@xyflow/react';
import type { GraphNodeData } from './GraphNodeCard';
import { STATUS_HEX } from './GraphNodeCard';

/**
 * Direct SVG/PNG rendering of the CURRENT VIEW for graphs too large to export by
 * serializing the DOM.
 *
 * `html-to-image` clones every element of the canvas and copies its computed
 * style: faithful, but with 2000 nodes and 3700 edges (6000+ elements) that
 * takes minutes. When more than {@link DOM_EXPORT_MAX_NODES} nodes are in view
 * the export instead draws the same scene (viewport, positions, status colours,
 * highlights, diff colours, dimming) straight to SVG from the data the canvas is
 * built from: linear in what is visible, no DOM involved. Smaller views still
 * use html-to-image and so look exactly like the screen.
 */

/** Above this many visible nodes the vector renderer is used instead of DOM capture. */
export const DOM_EXPORT_MAX_NODES = 150;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface SceneInput {
  nodes: readonly Node<GraphNodeData>[];
  edges: readonly Edge[];
  viewport: Viewport;
  width: number;
  height: number;
  /** Dim everything not emphasized (selection/path focus). */
  focus: boolean;
  /** Dim everything not a match (search/facet filter). */
  filtering: boolean;
  /** Dim edges not emphasized (focus or filter). */
  dimEdges: boolean;
  background: string;
  foreground: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL = { w: 224, h: 96 };
const COMPACT = { w: 176, h: 44 };
const LOD = { w: 176, h: 32 };
const LOD_ZOOM = 0.4;

const DIFF_HEX = { added: '#2da44e', removed: '#cf222e', changed: '#bf8700', unchanged: '#64748b' } as const;
const HIGHLIGHT_HEX = {
  selected: '#a3e635',
  upstream: '#38bdf8',
  downstream: '#facc15',
  path: '#c084fc',
  'path-end': '#c084fc',
} as const;
const EDGE_HEX: Record<string, string> = {
  'ge-up': '#38bdf8',
  'ge-down': '#facc15',
  'ge-path': '#c084fc',
  'ge-cycle': '#ef4444',
  'ge-added': '#2da44e',
  'ge-removed': '#cf222e',
  'ge-changed': '#bf8700',
};
const EMPHASIZED_EDGE = new Set(['ge-up', 'ge-down', 'ge-path', 'ge-match', 'ge-added', 'ge-removed', 'ge-changed']);

function sizeOf(data: GraphNodeData, zoom: number): { w: number; h: number } {
  if (data.compact) return zoom < LOD_ZOOM ? LOD : COMPACT;
  return FULL;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Nodes (with their drawn size) whose box intersects the viewport, in flow coordinates. */
export function visibleNodes(
  input: Pick<SceneInput, 'nodes' | 'viewport' | 'width' | 'height'>
): Array<{ node: Node<GraphNodeData>; box: Box }> {
  const { viewport: v, width, height } = input;
  const left = -v.x / v.zoom;
  const top = -v.y / v.zoom;
  const right = left + width / v.zoom;
  const bottom = top + height / v.zoom;
  const out: Array<{ node: Node<GraphNodeData>; box: Box }> = [];
  for (const node of input.nodes) {
    if (node.hidden) continue;
    const { w, h } = sizeOf(node.data, v.zoom);
    const box = { x: node.position.x, y: node.position.y, w, h };
    if (box.x + w < left || box.x > right || box.y + h < top || box.y > bottom) continue;
    out.push({ node, box });
  }
  return out;
}

/** The scene as a standalone SVG document of `width` x `height` (the on-screen canvas size). */
export function sceneToSvg(input: SceneInput): string {
  const { viewport: v, width, height } = input;
  const visible = visibleNodes(input);
  const boxes = new Map(visible.map(({ node, box }) => [node.id, box]));
  const detail = v.zoom >= LOD_ZOOM;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">`
  );
  parts.push(`<rect width="100%" height="100%" fill="${esc(input.background)}"/>`);
  parts.push(`<g transform="translate(${v.x} ${v.y}) scale(${v.zoom})">`);

  // Edges first: an edge is drawn when either end is in view (and not hidden).
  const baseWidth = Math.max(1, 1.5 / Math.max(v.zoom, 0.05));
  for (const edge of input.edges) {
    if (edge.hidden) continue;
    const a = boxes.get(edge.source);
    const b = boxes.get(edge.target);
    if (!a && !b) continue;
    const sa = a ?? findBox(input, edge.source, v.zoom);
    const sb = b ?? findBox(input, edge.target, v.zoom);
    if (!sa || !sb) continue;
    const cls = edge.className ?? '';
    const color = EDGE_HEX[cls] ?? '#64748b';
    const emphasized = EMPHASIZED_EDGE.has(cls);
    const opacity = input.dimEdges && !emphasized ? 0.12 : 0.85;
    const dashed = cls === 'ge-cycle' || cls === 'ge-removed' ? ` stroke-dasharray="${baseWidth * 4} ${baseWidth * 3}"` : '';
    const w = emphasized ? baseWidth * 2 : baseWidth;
    parts.push(
      `<line x1="${r(sa.x + sa.w / 2)}" y1="${r(sa.y + sa.h)}" x2="${r(sb.x + sb.w / 2)}" y2="${r(sb.y)}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${r(w)}"${dashed}/>`
    );
  }

  for (const { node, box } of visible) {
    const d = node.data;
    const status = STATUS_HEX[d.status] ?? STATUS_HEX.unknown;
    const highlighted = d.highlight && d.highlight !== 'none';
    const dimmed = (input.focus && !highlighted) || (input.filtering && !highlighted && !d.match);
    const stroke = d.diff ? DIFF_HEX[d.diff] : highlighted ? HIGHLIGHT_HEX[d.highlight as keyof typeof HIGHLIGHT_HEX] : d.cycle ? '#ef4444' : '#334155';
    const strokeWidth = d.diff || highlighted || d.cycle ? 3 : 1.5;
    const dash = d.diff === 'removed' || d.cycle ? ' stroke-dasharray="6 4"' : '';
    const fill = d.diff ? `${DIFF_HEX[d.diff]}33` : detail ? '#0f172a' : status;
    const opacity = dimmed ? 0.18 : d.diff === 'unchanged' ? 0.6 : 1;
    parts.push(`<g opacity="${opacity}">`);
    parts.push(
      `<rect x="${r(box.x)}" y="${r(box.y)}" width="${box.w}" height="${box.h}" rx="${detail ? 8 : 4}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash}/>`
    );
    if (detail) {
      parts.push(`<circle cx="${r(box.x + box.w - 12)}" cy="${r(box.y + 14)}" r="5" fill="${status}"/>`);
      parts.push(
        `<text x="${r(box.x + 10)}" y="${r(box.y + 19)}" font-size="13" font-weight="600" fill="${esc(input.foreground)}">${esc(truncate(d.label, 20))}</text>`
      );
      if (!d.compact) {
        parts.push(
          `<text x="${r(box.x + 10)}" y="${r(box.y + 44)}" font-size="11" fill="${esc(input.foreground)}" fill-opacity="0.7">${esc(
            [d.kind, d.framework, d.language].filter(Boolean).join(' · ')
          )}</text>`
        );
        parts.push(
          `<text x="${r(box.x + 10)}" y="${r(box.y + 66)}" font-size="11" fill="${status}">${esc(d.status)}</text>`
        );
      }
    }
    parts.push('</g>');
  }

  parts.push('</g>');
  parts.push(
    `<text x="12" y="${height - 12}" font-size="11" fill="${esc(input.foreground)}" fill-opacity="0.6">${visible.length} of ${input.nodes.length} nodes in view · zoom ${v.zoom.toFixed(2)}</text>`
  );
  parts.push('</svg>');
  return parts.join('');
}

/** Box of a node that is outside the viewport (an edge into view may start there). */
function findBox(input: Pick<SceneInput, 'nodes' | 'viewport'>, id: string, zoom: number): Box | undefined {
  // Linear scan only for edges that cross the viewport edge; build the index lazily once.
  let index = boxIndex.get(input.nodes);
  if (!index) {
    index = new Map();
    for (const node of input.nodes) {
      const { w, h } = sizeOf(node.data, zoom);
      index.set(node.id, { x: node.position.x, y: node.position.y, w, h });
    }
    boxIndex.set(input.nodes, index);
  }
  return index.get(id);
}
const boxIndex = new WeakMap<readonly Node<GraphNodeData>[], Map<string, Box>>();

function r(n: number): number {
  return Math.round(n * 10) / 10;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Rasterize an SVG string to a PNG blob at `pixelRatio` (browser only: Image + canvas). */
export async function svgToPngBlob(svg: string, width: number, height: number, pixelRatio: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The browser could not rasterize the graph SVG.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D canvas is not available in this browser.');
    ctx.scale(pixelRatio, pixelRatio);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The canvas produced no PNG data.'))), 'image/png')
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
