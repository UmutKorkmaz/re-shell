import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/**
 * Playwright config for the dashboard <-> hub round-trip E2E.
 *
 * The `webServer` builds the dashboard (with the hub URL + token baked in),
 * starts the token-protected, loopback-only hub against a fixture monorepo (which
 * spawns the REAL built re-shell CLI), and serves the built dashboard via
 * `vite preview`. The spec then drives the live UI and asserts the SSE + WS
 * transports actually round-trip through the secure hub.
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
  // The stack build can take a while on a cold cache; jobs stream real CLI
  // output, so allow generous per-test time without masking genuine hangs.
  timeout: 60_000,
  expect: { timeout: 15_000 },
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
