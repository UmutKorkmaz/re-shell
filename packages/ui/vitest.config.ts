import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(packageRoot, 'src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Coverage decision: SCOPED + FAST. The UI package is all live surface, so
    // coverage is scoped to the component/hook/hub/lib modules that ship. All
    // UI suites are fast jsdom/unit tests; there is nothing slow to exclude.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      all: true,
      include: [
        'src/assistant/**',
        'src/components/**',
        'src/hooks/**',
        'src/hub/**',
        'src/lib/**'
      ],
      // Barrel files are pure re-exports with no logic; excluding them keeps the
      // scoped 80% bar meaningful (it measures behavior, not export plumbing).
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts', '**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
