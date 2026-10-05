import {
  diffToMermaid,
  toD3Json,
  toMermaid,
  toRawJson,
  type GraphDiffCore,
  type GraphModel,
} from '@re-shell/contracts';
import { DOM_EXPORT_MAX_NODES, sceneToSvg, svgToPngBlob, visibleNodes, type SceneInput } from './exportScene';

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'mermaid' | 'd3' | 'json';

export const EXPORT_FORMATS: ReadonlyArray<{ id: ExportFormat; label: string; hint: string }> = [
  { id: 'png', label: 'PNG image', hint: 'Current view as a raster image' },
  { id: 'svg', label: 'SVG image', hint: 'Current view as a vector image' },
  { id: 'pdf', label: 'PDF', hint: 'Current view embedded in a one-page PDF' },
  { id: 'mermaid', label: 'Mermaid', hint: 'Flowchart text, same as the CLI' },
  { id: 'd3', label: 'D3 JSON', hint: 'Force-graph nodes and links, same as the CLI' },
  { id: 'json', label: 'Raw JSON', hint: 'Nodes and edges, same as the CLI file output' },
];

/** Result handed to {@link downloadBlob}. */
export interface ExportArtifact {
  blob: Blob;
  filename: string;
}

/** Trigger a browser download of `blob` as `filename`. Always cleans up its object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function exportFilename(kind: string, ext: string): string {
  return `workspace-graph-${kind}-${stamp()}.${ext}`;
}

/**
 * Mermaid / D3 / raw JSON from the displayed graph data, via the SAME converters
 * the CLI uses (`@re-shell/contracts`). In diff mode the diff itself is exported.
 */
export function textExport(
  format: 'mermaid' | 'd3' | 'json',
  model: GraphModel,
  diff?: GraphDiffCore | null
): ExportArtifact {
  const kind = diff ? 'diff' : 'graph';
  if (format === 'mermaid') {
    const text = diff ? diffToMermaid(diff) : toMermaid(model);
    return { blob: new Blob([text], { type: 'text/vnd.mermaid;charset=utf-8' }), filename: exportFilename(kind, 'mmd') };
  }
  if (format === 'd3') {
    return {
      blob: new Blob([toD3Json(model)], { type: 'application/json' }),
      filename: exportFilename(`${kind}-d3`, 'json'),
    };
  }
  const text = diff ? JSON.stringify(diff, null, 2) : toRawJson(model);
  return { blob: new Blob([text], { type: 'application/json' }), filename: exportFilename(kind, 'json') };
}

// ---------------------------------------------------------------------------
// Image + PDF export of the rendered canvas
// ---------------------------------------------------------------------------

/** React Flow chrome that must not appear in an exported image. */
const EXCLUDED_CLASSES = ['react-flow__controls', 'react-flow__minimap', 'react-flow__panel', 'react-flow__attribution'];

function includeInImage(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return true;
  return !EXCLUDED_CLASSES.some((cls) => node.classList.contains(cls));
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const mime = /^data:([^;,]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const payload = dataUrl.slice(comma + 1);
  if (/;base64/.test(header)) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

/** Cap the pixel ratio so a huge canvas cannot exceed the browser's canvas area limit. */
export function safePixelRatio(width: number, height: number, wanted = 2): number {
  const MAX_PIXELS = 16_000_000;
  const ratio = Math.min(wanted, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
  return Math.max(0.5, ratio);
}

function backgroundOf(el: HTMLElement): string {
  const bg = getComputedStyle(el).backgroundColor;
  return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : '#0b0d10';
}

/** Raised when the canvas has nothing to capture (not an exception from the image library). */
export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

interface Capture {
  dataUrl: string;
  width: number;
  height: number;
}

async function capture(el: HTMLElement, kind: 'png' | 'svg'): Promise<Capture> {
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (width === 0 || height === 0) {
    throw new ExportError('The graph canvas has no size yet; wait for it to render and try again.');
  }
  const lib = await import('html-to-image');
  const options = {
    width,
    height,
    backgroundColor: backgroundOf(el),
    filter: includeInImage,
    cacheBust: false,
    pixelRatio: kind === 'png' ? safePixelRatio(width, height) : 1,
  };
  const dataUrl = kind === 'png' ? await lib.toPng(el, options) : await lib.toSvg(el, options);
  return { dataUrl, width, height };
}

/** True when the view is too big to serialize from the DOM and the vector renderer is used instead. */
export function usesVectorExport(scene: SceneInput | undefined): scene is SceneInput {
  return scene !== undefined && visibleNodes(scene).length > DOM_EXPORT_MAX_NODES;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image data.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * PNG or SVG of the current view of `el` (the React Flow container).
 *
 * Small views are captured from the DOM with html-to-image, so they look exactly
 * like the screen. When more than {@link DOM_EXPORT_MAX_NODES} nodes are in view,
 * cloning thousands of elements is far too slow, so the scene is drawn straight
 * to SVG from the canvas data instead (see exportScene.ts); `scene` carries it.
 */
export async function exportImage(el: HTMLElement, kind: 'png' | 'svg', scene?: SceneInput): Promise<ExportArtifact> {
  if (usesVectorExport(scene)) {
    const svg = sceneToSvg(scene);
    const blob =
      kind === 'svg'
        ? new Blob([svg], { type: 'image/svg+xml' })
        : await svgToPngBlob(svg, scene.width, scene.height, safePixelRatio(scene.width, scene.height));
    if (blob.size === 0) throw new ExportError(`The ${kind.toUpperCase()} export produced an empty file.`);
    return { blob, filename: exportFilename('view', kind) };
  }
  const { dataUrl } = await capture(el, kind);
  const blob = dataUrlToBlob(dataUrl);
  if (blob.size === 0) throw new ExportError(`The ${kind.toUpperCase()} export produced an empty file.`);
  return { blob, filename: exportFilename('view', kind) };
}

/**
 * One-page PDF with the current view embedded as a PNG (jsPDF, loaded on
 * demand). The page is the canvas size, so nothing is scaled or cropped.
 */
export async function exportPdf(el: HTMLElement, scene?: SceneInput): Promise<ExportArtifact> {
  let dataUrl: string;
  let width: number;
  let height: number;
  if (usesVectorExport(scene)) {
    ({ width, height } = scene);
    dataUrl = await blobToDataUrl(await svgToPngBlob(sceneToSvg(scene), width, height, safePixelRatio(width, height)));
  } else {
    ({ dataUrl, width, height } = await capture(el, 'png'));
  }
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
    hotfixes: ['px_scaling'],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  const blob = pdf.output('blob');
  if (blob.size === 0) throw new ExportError('The PDF export produced an empty file.');
  return { blob, filename: exportFilename('view', 'pdf') };
}
