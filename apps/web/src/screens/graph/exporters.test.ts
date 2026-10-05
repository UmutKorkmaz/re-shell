import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diffGraphs, toD3Json, toMermaid, toRawJson, type GraphModel } from '@re-shell/contracts';
import { ExportError, downloadBlob, exportFilename, exportImage, exportPdf, safePixelRatio, textExport, usesVectorExport } from './exporters';
import { DOM_EXPORT_MAX_NODES, type SceneInput } from './exportScene';

const toPngMock = vi.fn();
const toSvgMock = vi.fn();
vi.mock('html-to-image', () => ({
  toPng: (...args: unknown[]) => toPngMock(...args),
  toSvg: (...args: unknown[]) => toSvgMock(...args),
}));

// jsdom has no canvas: stand in for the browser rasterizer (the real one runs in the Playwright spec).
const svgToPng = vi.fn();
vi.mock('./exportScene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./exportScene')>();
  return { ...actual, svgToPngBlob: (...args: unknown[]) => svgToPng(...args) };
});

const addImage = vi.fn();
const output = vi.fn();
const jsPDFCtor = vi.fn();
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor(options: unknown) {
      jsPDFCtor(options);
    }
    addImage(...args: unknown[]) {
      addImage(...args);
    }
    output(kind: string) {
      return output(kind);
    }
  },
}));

const MODEL: GraphModel = {
  nodes: [
    { id: '@acme/web', type: 'app', framework: 'react-ts', language: 'typescript', path: 'apps/web' },
    { id: '@acme/ui', type: 'lib' },
  ],
  edges: [{ from: '@acme/web', to: '@acme/ui', type: 'dependency' }],
};

// 1x1 transparent PNG
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SVG_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')}`;

function canvasEl(width = 800, height = 500): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: width });
  Object.defineProperty(el, 'clientHeight', { value: height });
  document.body.appendChild(el);
  return el;
}

async function blobText(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function bigScene(count: number): SceneInput {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `n${i}`,
    type: 'topology',
    position: { x: (i % 40) * 200, y: Math.floor(i / 40) * 60 },
    data: { label: `n${i}`, kind: 'service' as const, framework: null, status: 'unknown' as const, compact: true, onOpen: () => undefined },
  }));
  return {
    nodes,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.1 },
    width: 1000,
    height: 700,
    focus: false,
    filtering: false,
    dimEdges: false,
    background: '#000',
    foreground: '#fff',
  };
}

beforeEach(() => {
  svgToPng.mockReset().mockResolvedValue(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], { type: 'image/png' }));
  toPngMock.mockReset().mockResolvedValue(PNG_DATA_URL);
  toSvgMock.mockReset().mockResolvedValue(SVG_DATA_URL);
  addImage.mockReset();
  jsPDFCtor.mockReset();
  output.mockReset().mockReturnValue(new Blob(['%PDF-1.3 fake'], { type: 'application/pdf' }));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('text exports share the CLI converters', () => {
  it('mermaid / d3 / raw json equal the contracts converters byte for byte', async () => {
    const mermaid = textExport('mermaid', MODEL);
    expect(await blobText(mermaid.blob)).toBe(toMermaid(MODEL));
    expect(mermaid.filename).toMatch(/^workspace-graph-graph-.*\.mmd$/);
    const d3 = textExport('d3', MODEL);
    expect(await blobText(d3.blob)).toBe(toD3Json(MODEL));
    expect(d3.filename).toMatch(/-d3-.*\.json$/);
    const json = textExport('json', MODEL);
    expect(await blobText(json.blob)).toBe(toRawJson(MODEL));
    expect(json.blob.type).toBe('application/json');
  });

  it('exports the diff itself in diff mode', async () => {
    const diff = diffGraphs(MODEL, { nodes: [...MODEL.nodes, { id: 'new', type: 'package' }], edges: MODEL.edges });
    const mermaid = textExport('mermaid', MODEL, diff);
    expect(await blobText(mermaid.blob)).toContain(':::added');
    expect(mermaid.filename).toContain('-diff-');
    const json = textExport('json', MODEL, diff);
    expect(JSON.parse(await blobText(json.blob)).summary.nodesAdded).toBe(1);
  });
});

describe('downloadBlob', () => {
  it('clicks a temporary download link with the filename and revokes the URL', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicks: Array<{ href: string; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download });
    });
    downloadBlob(new Blob(['x']), 'graph.json');
    expect(clicks).toEqual([{ href: 'blob:fake', download: 'graph.json' }]);
    expect(document.querySelector('a')).toBeNull(); // link removed again
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    vi.useRealTimers();
  });
});

describe('image and PDF export', () => {
  it('PNG: captures the canvas without React Flow chrome and returns the decoded bytes', async () => {
    const el = canvasEl();
    const { blob, filename } = await exportImage(el, 'png');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(50);
    expect(filename).toMatch(/\.png$/);
    const [target, options] = toPngMock.mock.calls[0] as [HTMLElement, { width: number; height: number; filter: (n: Node) => boolean; pixelRatio: number }];
    expect(target).toBe(el);
    expect(options.width).toBe(800);
    expect(options.height).toBe(500);
    expect(options.pixelRatio).toBe(2);
    const controls = document.createElement('div');
    controls.className = 'react-flow__controls';
    const minimap = document.createElement('div');
    minimap.className = 'react-flow__minimap';
    expect(options.filter(controls)).toBe(false);
    expect(options.filter(minimap)).toBe(false);
    expect(options.filter(document.createElement('div'))).toBe(true);
    expect(options.filter(document.createTextNode('t'))).toBe(true);
  });

  it('SVG: decodes the url-encoded svg payload', async () => {
    const { blob, filename } = await exportImage(canvasEl(), 'svg');
    expect(filename).toMatch(/\.svg$/);
    expect(blob.type).toBe('image/svg+xml');
    expect(await blobText(blob)).toContain('<svg');
    expect(toPngMock).not.toHaveBeenCalled();
  });

  it('PDF: embeds the PNG at the canvas size in a landscape page and returns the PDF blob', async () => {
    const { blob, filename } = await exportPdf(canvasEl(800, 500));
    expect(filename).toMatch(/\.pdf$/);
    expect(blob.type).toBe('application/pdf');
    expect(jsPDFCtor).toHaveBeenCalledWith({ orientation: 'landscape', unit: 'px', format: [800, 500], hotfixes: ['px_scaling'] });
    expect(addImage).toHaveBeenCalledWith(PNG_DATA_URL, 'PNG', 0, 0, 800, 500);
    expect(output).toHaveBeenCalledWith('blob');
    await exportPdf(canvasEl(400, 900));
    expect(jsPDFCtor).toHaveBeenLastCalledWith(expect.objectContaining({ orientation: 'portrait' }));
  });

  it('fails explicitly (never a silent empty download) for an unsized canvas, an empty capture or an empty PDF', async () => {
    await expect(exportImage(canvasEl(0, 0), 'png')).rejects.toBeInstanceOf(ExportError);
    toPngMock.mockResolvedValueOnce('data:image/png;base64,');
    await expect(exportImage(canvasEl(), 'png')).rejects.toThrow(/empty/);
    output.mockReturnValueOnce(new Blob([], { type: 'application/pdf' }));
    await expect(exportPdf(canvasEl())).rejects.toThrow(/empty/);
    toPngMock.mockRejectedValueOnce(new Error('tainted canvas'));
    await expect(exportImage(canvasEl(), 'png')).rejects.toThrow('tainted canvas');
  });

  it('big views skip html-to-image entirely and draw the scene straight to SVG / PNG / PDF', async () => {
    const big = bigScene(DOM_EXPORT_MAX_NODES + 50);
    expect(usesVectorExport(big)).toBe(true);
    expect(usesVectorExport(bigScene(DOM_EXPORT_MAX_NODES - 1))).toBe(false);
    expect(usesVectorExport(undefined)).toBe(false);

    const svg = await exportImage(canvasEl(), 'svg', big);
    expect(svg.blob.type).toBe('image/svg+xml');
    expect(await blobText(svg.blob)).toContain(`${DOM_EXPORT_MAX_NODES + 50} of ${DOM_EXPORT_MAX_NODES + 50} nodes in view`);

    const png = await exportImage(canvasEl(), 'png', big);
    expect(png.blob.type).toBe('image/png');
    expect(svgToPng).toHaveBeenCalledWith(expect.stringContaining('<svg'), 1000, 700, 2);

    const pdf = await exportPdf(canvasEl(), big);
    expect(pdf.blob.type).toBe('application/pdf');
    expect(jsPDFCtor).toHaveBeenCalledWith(expect.objectContaining({ format: [1000, 700] }));
    expect(addImage).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/), 'PNG', 0, 0, 1000, 700);

    expect(toPngMock).not.toHaveBeenCalled();
    expect(toSvgMock).not.toHaveBeenCalled();
  });

  it('small views still use DOM capture even when a scene is supplied', async () => {
    await exportImage(canvasEl(), 'png', bigScene(10));
    expect(toPngMock).toHaveBeenCalledTimes(1);
    expect(svgToPng).not.toHaveBeenCalled();
  });

  it('a vector PNG that comes back empty is an error, not a download', async () => {
    svgToPng.mockResolvedValueOnce(new Blob([], { type: 'image/png' }));
    await expect(exportImage(canvasEl(), 'png', bigScene(DOM_EXPORT_MAX_NODES + 1))).rejects.toThrow(/empty/);
  });

  it('caps the pixel ratio so huge canvases stay under the browser canvas limit', () => {
    expect(safePixelRatio(800, 500)).toBe(2);
    expect(safePixelRatio(8000, 6000)).toBeLessThan(1);
    expect(safePixelRatio(100000, 100000)).toBe(0.5);
  });

  it('names files with a timestamp', () => {
    expect(exportFilename('view', 'png')).toMatch(/^workspace-graph-view-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/);
  });
});
