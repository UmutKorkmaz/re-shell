import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Build dist/ ONCE, before the worker pool starts, so the entry/handshake and
    // tarball tests always exercise the current sources (never a stale build) and
    // no test file races a sibling that is mid-rebuild.
    globalSetup: './tests/global-setup.ts',
    // These tests spawn the real stdio server and the real CLI.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
