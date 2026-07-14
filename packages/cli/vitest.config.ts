import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The interactive PTY/ink tests are timing-sensitive under CI's slower TTY
    // and can flake on first attempt. Retry only in CI so local runs still
    // surface real flakes (a genuinely broken test fails all attempts).
    retry: process.env.CI ? 2 : 0,
    // Build the CLI once before the worker pool starts so integration/PTY tests
    // never spawn a binary that a sibling test is mid-rebuild of.
    globalSetup: './tests/global-setup.ts',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Interactive tests use process.chdir() into os.tmpdir() workspaces, which is
    // not supported inside worker_threads. Run them in the child_process pool.
    poolMatchGlobs: [
      ['**/tests/interactive/**', 'child_process'],
      ['**/tests/integration/plugin-create-cli.test.ts', 'child_process'],
    ],
    // Coverage decision: SCOPED + FAST.
    // - Scoped: the CLI still carries ~144k lines slated for deletion next wave,
    //   so `include` is restricted to the live/contract surface that the web hub
    //   and JSON-output adapters depend on. Measuring the whole tree would drown
    //   the signal and make 80% meaningless.
    // - Fast: the integration/interactive/e2e suites spawn the built CLI and a
    //   real PTY; they are excluded from the coverage run so it stays one-shot
    //   and never goes silent. Coverage is earned by the unit/contract suites.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      all: true,
      include: [
        'src/utils/json-output.ts',
        'src/utils/cli-adapters.ts',
        'src/utils/command-catalog.ts',
        'src/utils/health-normalizer.ts',
        'src/utils/workspace-definition-adapter.ts',
        'src/utils/scope.ts',
        'src/groups/templates.group.ts',
        'src/groups/commands.group.ts',
        // W9b new files
        'src/utils/plugin-installer.ts',
        'src/utils/plugin-marketplace.ts',
        'src/utils/registry-client.ts',
        'src/utils/dependency-drift.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 120000, // 120 seconds timeout for tests (integration tests need time)
    hookTimeout: 120000, // 120 seconds timeout for hooks (beforeEach/afterEach)
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
