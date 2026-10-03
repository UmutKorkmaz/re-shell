import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * Playwright config for the dashboard <-> hub round-trip E2E and the axe
 * accessibility audit.
 *
 * The `webServer` builds the dashboard (with the hub URL + token baked in, into a
 * throwaway directory, never apps/web/dist), starts the token-protected,
 * loopback-only hub against a fixture monorepo (which spawns the REAL built
 * re-shell CLI), and serves the built dashboard via `vite preview`. The specs
 * then drive the live UI and assert the SSE + WS transports actually round-trip
 * through the secure hub.
 *
 * Two projects share that stack and map to the two CI gates:
 *   - `chromium`: the functional core-flow specs  (`playwright test --project=chromium`)
 *   - `a11y`:     the axe-core WCAG audit         (`playwright test --project=a11y`)
 * A bare `playwright test` runs both.
 */

// Fixed test ports + a per-run token shared by build, hub, and the dashboard
// bundle. Generated once here so the single `webServer` invocation is coherent.
const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4317);
const HUB_PORT = Number(process.env.E2E_HUB_PORT ?? 4318);
const HUB_TOKEN = process.env.E2E_HUB_TOKEN ?? randomBytes(24).toString('hex');

const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Every screen read and job spawns the REAL CLI (a cold node start plus, for
  // the template/command catalogs, a 100-350 KB JSON payload), which takes
  // seconds on a busy runner. Allow generous time without masking genuine hangs.
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/accessibility.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'a11y',
      testMatch: '**/accessibility.spec.ts',
      // axe walks every node of the screen; the Templates screen renders the whole
      // 200+ card catalog, which takes minutes (not seconds) on a loaded runner.
      timeout: 300_000,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node e2e/start-stack.mjs',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      E2E_PREVIEW_PORT: String(PREVIEW_PORT),
      E2E_HUB_PORT: String(HUB_PORT),
      E2E_HUB_TOKEN: HUB_TOKEN,
    },
  },
});
