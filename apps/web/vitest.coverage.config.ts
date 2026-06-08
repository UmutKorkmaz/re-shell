import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));

// Coverage decision: SCOPED + FAST.
// - Scoped: coverage is measured only on the live dashboard surface
//   (screens/hub/settings), not on shell/main/bootstrap glue.
// - Fast: the slow, port-binding, process-spawning suites are NOT run here.
//   `tests/e2e-hub-roundtrip.test.ts` and `tests/hub.test.ts` start a real hub
//   and spawn children; they are excluded from the coverage run (they live under
//   `tests/`, while this config only includes `src/**`). The pure
//   `command-registry` allow-list and the React screens are exercised by fast
//   jsdom/unit tests, which earn the coverage.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@umutkorkmaz/contracts': resolve(
        packageRoot,
        '../../packages/contracts/src/index.ts'
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      all: true,
      include: ['src/screens/**', 'src/hub/**', 'src/settings/**'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
