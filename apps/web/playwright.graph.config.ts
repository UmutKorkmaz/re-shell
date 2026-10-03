import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * Playwright config for the large-graph spec (e2e/graph-scale.spec.ts).
 *
 * Separate from playwright.config.ts because it needs a different stack: a
 * generated 2000-workspace monorepo behind the same secure hub, started by
 * e2e/start-graph-stack.mjs on its own ports. Run with:
 *
 *   npx playwright test -c playwright.graph.config.ts
 */
const PREVIEW_PORT = Number(process.env.E2E_GRAPH_PREVIEW_PORT ?? 4417);
const HUB_PORT = Number(process.env.E2E_GRAPH_HUB_PORT ?? 4418);
const HUB_TOKEN = process.env.E2E_HUB_TOKEN ?? randomBytes(24).toString('hex');
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/graph-scale.spec.ts',
  // Building the dashboard, generating + committing 2000 packages and rendering
  // the graph is slow on a cold machine; the spec's own budgets are tighter.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'node e2e/start-graph-stack.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      E2E_GRAPH_PREVIEW_PORT: String(PREVIEW_PORT),
      E2E_GRAPH_HUB_PORT: String(HUB_PORT),
      E2E_HUB_TOKEN: HUB_TOKEN,
    },
  },
});
