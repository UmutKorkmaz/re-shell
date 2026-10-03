import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { buildGraphSpec } from './fixtures/graph-fixture.mjs';

/**
 * Workspace Graph at scale (P9-L), through the REAL stack: the dashboard calls
 * the token-protected hub, which spawns the real built re-shell CLI against a
 * generated monorepo of 2000 workspaces (plus one uncommitted app, so 2001
 * nodes) committed to a git repo. See e2e/start-graph-stack.mjs.
 *
 * Budgets are deliberately generous. They were set on a 4-core box at load
 * average ~20-30, where first render took 17-37 s and a search 2-6 s; on an idle
 * machine it is a few seconds and well under a second. An O(n^2) regression or a
 * non-virtualized canvas still blows through them:
 *   - first render of the 2001-node graph (navigation -> canvas populated): 60 s
 *     (dominated by the hub spawning the CLI for workspace.graph/summary; the
 *     browser needs ~0.2 s from data to painted nodes on an idle machine)
 *   - search / facet filter response (input -> matches updated):              10 s
 *   - path highlight (field input -> shortest path shown):                    12 s
 * Run: npx playwright test -c playwright.graph.config.ts
 */
const FIRST_RENDER_BUDGET_MS = 60_000;
const FILTER_BUDGET_MS = 10_000;
const PATH_BUDGET_MS = 12_000;
const STATUS_BUDGET_MS = 60_000;

const TOTAL_NODES = 2001; // 2000 committed + @fx/app-new in the working tree

// Ground truth from the fixture generator itself, never from the code under test.
const committed = buildGraphSpec(2000);
const goCount = committed.filter((w) => w.marker === 'go.mod').length;
const appsMatching = (needle: string) => committed.filter((w) => w.name.includes(needle)).length;

async function openGraph(page: Page, query = ''): Promise<number> {
  const started = Date.now();
  await page.goto(`/?screen=graph${query}`);
  await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-node-count', String(TOTAL_NODES), {
    timeout: FIRST_RENDER_BUDGET_MS,
  });
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: FIRST_RENDER_BUDGET_MS });
  return Date.now() - started;
}

async function matches(page: Page): Promise<number> {
  return Number(await page.getByTestId('graph-match-count').getAttribute('data-matches'));
}

/** Click a node that is rendered but tiny (fit-to-view of 2000 nodes): dispatch the click straight to it. */
async function clickNode(page: Page, name: string): Promise<void> {
  await page.locator(`[data-node-id="${name}"]`).dispatchEvent('click');
}

async function download(page: Page, trigger: () => Promise<void>): Promise<{ name: string; bytes: Buffer }> {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), trigger()]);
  const file = await dl.path();
  expect(file, 'download must be saved to disk').toBeTruthy();
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(file!) };
}

async function exportAs(page: Page, format: string): Promise<{ name: string; bytes: Buffer }> {
  return download(page, async () => {
    await page.getByTestId('graph-export-menu').click();
    await page.getByTestId(`graph-export-${format}`).click();
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('workspace graph at scale (2001 nodes, real hub stack)', () => {
  test('renders 2000+ nodes within the first-render budget and virtualizes when zoomed in', async ({ page }) => {
    const elapsed = await openGraph(page);
    console.log(`[graph-scale] first render of ${TOTAL_NODES} nodes: ${elapsed} ms (budget ${FIRST_RENDER_BUDGET_MS} ms)`);
    expect(elapsed).toBeLessThan(FIRST_RENDER_BUDGET_MS);

    const canvas = page.getByTestId('graph-canvas');
    await expect(canvas).toHaveAttribute('data-edge-count', /^\d+$/);
    expect(Number(await canvas.getAttribute('data-edge-count'))).toBeGreaterThan(3000);

    // Everything fits in view at first, so (almost) every node is in the DOM...
    const initialDom = await page.locator('.react-flow__node').count();
    expect(initialDom).toBeGreaterThan(1500);

    // ...but zooming into a corner must cull the rest (onlyRenderVisibleElements).
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(40);
    }
    await expect
      .poll(async () => page.locator('.react-flow__node').count(), { timeout: 10_000 })
      .toBeLessThan(initialDom / 3);
    // Zoomed in far enough, cards switch from the low-detail block to the full card with text.
    await expect(page.locator('[data-testid="graph-node"]:not([data-lod])').first()).toBeVisible();

    // The page stays responsive: a status click round-trips in well under a second.
    const t = Date.now();
    await page.getByTestId('graph-hide-nonmatching').check();
    await expect(page).toHaveURL(/g_hide=1/);
    expect(Date.now() - t).toBeLessThan(FILTER_BUDGET_MS);
  });

  test('live status comes from the real CLI probes: running, unhealthy and stopped nodes are coloured', async ({ page }) => {
    await openGraph(page, '&g_poll=5');
    const summary = page.getByTestId('graph-status-summary');
    await expect(summary).toHaveAttribute('data-checked-at', /\d{4}-\d{2}-\d{2}T/, { timeout: STATUS_BUDGET_MS });
    await expect(summary).toHaveAttribute('data-running', '1');
    await expect(summary).toHaveAttribute('data-unhealthy', '1');
    await expect(summary).toHaveAttribute('data-stopped', '2');
    // Every other node has nothing to probe and is honestly `unknown`.
    await expect(summary).toHaveAttribute('data-unknown', String(TOTAL_NODES - 4));
    await expect(page.getByTestId('graph-status-error')).toHaveCount(0);

    // Colours land on the nodes: app-0000 serves 200 on /health, app-0001 answers 500, app-0002/3 are down.
    await expect(page.locator('[data-node-id="@fx/app-0000"]')).toHaveAttribute('data-status', 'running');
    await expect(page.locator('[data-node-id="@fx/app-0001"]')).toHaveAttribute('data-status', 'unhealthy');
    await expect(page.locator('[data-node-id="@fx/app-0002"]')).toHaveAttribute('data-status', 'stopped');
    await expect(page.locator('[data-node-id="@fx/app-0003"]')).toHaveAttribute('data-status', 'stopped');
    await expect(page.locator('[data-node-id="@fx/pkg-0000"]')).toHaveAttribute('data-status', 'unknown');

    // The status filter answers from the same data.
    await page.getByTestId('graph-filter-status').selectOption('running');
    await expect.poll(() => matches(page), { timeout: FILTER_BUDGET_MS }).toBe(1);
  });

  test('search and facet filters respond within the budget and are URL state', async ({ page }) => {
    await openGraph(page);
    expect(await matches(page)).toBe(TOTAL_NODES);

    // Text search over name and path.
    const expectedApps = appsMatching('app-01');
    const t1 = Date.now();
    await page.getByTestId('graph-search').fill('app-01');
    await expect.poll(() => matches(page), { timeout: FILTER_BUDGET_MS }).toBe(expectedApps);
    const searchMs = Date.now() - t1;
    console.log(`[graph-scale] search response: ${searchMs} ms (budget ${FILTER_BUDGET_MS} ms)`);
    expect(searchMs).toBeLessThan(FILTER_BUDGET_MS);
    await expect(page).toHaveURL(/g_q=app-01/);
    // Matching nodes are flagged; the rest are dimmed by the canvas's filtering rule.
    await expect(page.locator('[data-node-id="@fx/app-0100"]')).toHaveAttribute('data-match', 'true');
    await expect(page.locator('[data-node-id="@fx/pkg-0001"]')).not.toHaveAttribute('data-match', 'true');
    await expect(page.locator('.react-flow.gx-filtering')).toHaveCount(1);
    await expect(page.locator('.gn[data-match="true"]')).toHaveCount(expectedApps);
    const dimmed = await page.locator('[data-node-id="@fx/pkg-0001"]').evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(dimmed).toBeLessThan(0.5);

    // Facet: language (from the CLI's marker-file detection).
    await page.getByTestId('graph-clear-filters').click();
    expect(await matches(page)).toBe(TOTAL_NODES);
    const t2 = Date.now();
    await page.getByTestId('graph-filter-language').selectOption('go');
    await expect.poll(() => matches(page), { timeout: FILTER_BUDGET_MS }).toBe(goCount);
    const facetMs = Date.now() - t2;
    console.log(`[graph-scale] language facet response: ${facetMs} ms (budget ${FILTER_BUDGET_MS} ms)`);
    expect(facetMs).toBeLessThan(FILTER_BUDGET_MS);

    // Facets combine with search; type facet narrows further.
    await page.getByTestId('graph-filter-type').selectOption('app');
    await expect.poll(() => matches(page), { timeout: FILTER_BUDGET_MS }).toBe(0);

    // Filters survive a reload (URL state).
    await page.getByTestId('graph-filter-type').selectOption('');
    await page.reload();
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-node-count', String(TOTAL_NODES), {
      timeout: FIRST_RENDER_BUDGET_MS,
    });
    await expect(page.getByTestId('graph-filter-language')).toHaveValue('go');
    expect(await matches(page)).toBe(goCount);

    // Hide mode removes non-matching nodes from the canvas.
    await page.getByTestId('graph-hide-nonmatching').check();
    await expect(page.locator('[data-node-id="@fx/app-0100"]')).toHaveCount(0);
  });

  test('selecting a node highlights its dependency sets; two nodes highlight the shortest path; cycles are flagged', async ({ page }) => {
    await openGraph(page);

    // The generator planted exactly one 3-node cycle.
    await expect(page.getByTestId('graph-cycles')).toHaveAttribute('data-cycle-count', '1');
    await expect(page.getByTestId('graph-cycles')).toContainText('across 3 nodes');
    await expect(page.locator('.gn-cycle')).toHaveCount(3);

    // Click a node (UI path): upstream/downstream sets and highlight classes appear.
    await clickNode(page, '@fx/app-0000');
    await expect(page.getByTestId('graph-selection')).toHaveAttribute('data-selected', '@fx/app-0000');
    const upstream = Number(await page.getByTestId('graph-upstream-count').textContent());
    expect(upstream).toBeGreaterThan(5);
    await expect(page.getByTestId('graph-downstream-count')).toHaveText('0'); // nothing depends on an app
    await expect(page.locator('[data-highlight="upstream"]').first()).toBeVisible();
    await expect(page.locator('[data-highlight="selected"]')).toHaveCount(1);

    // Pick the second node: the shortest path banner and highlight appear.
    const target = committed.find((w) => w.kind === 'package' && w.layer === 2)!.name;
    const t = Date.now();
    await page.getByTestId('graph-path-target').fill(target);
    const path = page.getByTestId('graph-path');
    await expect(path).toBeVisible({ timeout: PATH_BUDGET_MS });
    expect(Date.now() - t).toBeLessThan(PATH_BUDGET_MS);
    const hops = Number(await path.getAttribute('data-hops'));
    expect(hops).toBeGreaterThanOrEqual(1);
    await expect(page.locator('[data-highlight="path-end"]')).toHaveCount(2);
    await expect(page.locator('[data-highlight="path"]')).toHaveCount(hops - 1);
    await expect(page).toHaveURL(/g_sel=.*g_to=/);

    // Unrelated pair: no path in either direction, reported explicitly.
    await page.getByTestId('graph-path-target').fill('@fx/app-0001');
    await expect(page.getByTestId('graph-no-path')).toBeVisible();

    // Clearing the selection removes every highlight.
    await page.getByTestId('graph-clear-selection').click();
    await expect(page.locator('[data-highlight="selected"]')).toHaveCount(0);
  });

  test('graph diff against HEAD shows the working-tree change with added/removed/changed colouring and a legend', async ({ page }) => {
    await openGraph(page);
    await page.getByTestId('graph-diff-toggle').click();
    await page.getByTestId('graph-diff-base').fill('HEAD');
    await page.getByTestId('graph-diff-run').click();

    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-mode', 'diff', { timeout: 60_000 });
    // +1 node (the new app); +3 edges (its two deps + the extra edge on app-0000); nothing removed.
    const summary = page.getByTestId('graph-diff-summary');
    await expect(summary).toContainText('+1');
    await expect(summary).toContainText('edges +3');
    await expect(page.locator('[data-diff="added"]')).toHaveCount(1);
    await expect(page.locator('[data-diff="added"]')).toHaveAttribute('data-node-id', '@fx/app-new');
    await expect(page.locator('[data-diff="removed"]')).toHaveCount(0);
    await expect(page.getByTestId('graph-diff-legend')).toContainText('Added');
    await expect(page.getByTestId('graph-diff-legend')).toContainText('Removed');
    await expect(page.getByTestId('graph-diff-legend')).toContainText('Changed');
    await expect(page.getByTestId('graph-diff-list')).toContainText('+ node @fx/app-new');
    // The diff is URL state too.
    await expect(page).toHaveURL(/g_diffBase=HEAD/);

    // A rejected ref is reported, not turned into an empty diff.
    await page.getByTestId('graph-diff-base').fill('not-a-ref');
    await page.getByTestId('graph-diff-run').click();
    await expect(page.getByTestId('graph-diff-error')).toContainText('GRAPH_DIFF_INVALID_REF', { timeout: 30_000 });

    // Closing the diff restores the live graph.
    await page.getByTestId('graph-diff-close').click();
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-mode', 'live');
  });

  test('the hub refuses an unsafe diff ref before anything runs', async ({ page }) => {
    await page.goto('/?screen=graph&g_diffBase=--upload-pack%3Devil');
    await expect(page.getByTestId('graph-diff-error')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('graph-diff-error')).toContainText('The hub rejected these refs');
    await expect(page.getByTestId('graph-canvas')).toHaveAttribute('data-mode', 'live');
  });

  test('every export downloads a non-empty, well-formed file', async ({ page }) => {
    await openGraph(page);

    const mermaid = await exportAs(page, 'mermaid');
    expect(mermaid.name).toMatch(/\.mmd$/);
    const mermaidText = mermaid.bytes.toString('utf8');
    expect(mermaidText.startsWith('graph TD')).toBe(true);
    expect(mermaidText).toContain('"@fx/app-0000"');
    expect(mermaidText.split('\n').length).toBeGreaterThan(TOTAL_NODES);

    const d3 = await exportAs(page, 'd3');
    const d3Json = JSON.parse(d3.bytes.toString('utf8'));
    expect(d3Json.nodes).toHaveLength(TOTAL_NODES);
    expect(d3Json.links.length).toBeGreaterThan(3000);
    expect(d3Json.nodes[0]).toHaveProperty('group');

    const raw = await exportAs(page, 'json');
    const rawJson = JSON.parse(raw.bytes.toString('utf8'));
    expect(rawJson.nodes).toHaveLength(TOTAL_NODES);
    expect(rawJson.edges).toEqual(expect.arrayContaining([expect.objectContaining({ from: expect.any(String), to: expect.any(String) })]));
    await expect(page.getByTestId('graph-export-status')).toHaveAttribute('data-ok', 'true');

    // Whole graph in view (2001 nodes): too big to serialize from the DOM, so it is drawn straight to SVG/PNG.
    const png = await exportAs(page, 'png');
    expect(png.name).toMatch(/\.png$/);
    expect(png.bytes.length).toBeGreaterThan(5_000);
    expect(png.bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

    const svg = await exportAs(page, 'svg');
    expect(svg.name).toMatch(/\.svg$/);
    expect(svg.bytes.length).toBeGreaterThan(5_000);
    const svgText = svg.bytes.toString('utf8');
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('of 2001 nodes in view');
    expect(svgText).not.toContain('<foreignObject');

    const pdf = await exportAs(page, 'pdf');
    expect(pdf.name).toMatch(/\.pdf$/);
    expect(pdf.bytes.length).toBeGreaterThan(5_000);
    expect(pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    await expect(page.getByTestId('graph-export-status')).toHaveAttribute('data-ok', 'true');
  });

  test('a zoomed-in view is captured from the DOM with html-to-image (what you see is what you export)', async ({ page }) => {
    await openGraph(page);
    const canvas = page.getByTestId('graph-canvas');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 25; i++) {
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(30);
    }
    await expect.poll(async () => page.locator('.react-flow__node').count(), { timeout: 15_000 }).toBeLessThan(100);
    await expect(page.locator('[data-testid="graph-node"]:not([data-lod])').first()).toBeVisible();

    const svg = await exportAs(page, 'svg');
    const svgText = svg.bytes.toString('utf8');
    expect(svgText).toContain('<foreignObject'); // html-to-image serializes the real DOM
    expect(svgText).toContain('data-node-id');
    const png = await exportAs(page, 'png');
    expect(png.bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.bytes.length).toBeGreaterThan(5_000);
    const pdf = await exportAs(page, 'pdf');
    expect(pdf.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
