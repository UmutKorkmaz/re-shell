import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));

// Pure-core unit tests only. No VS Code host, no @vscode/test-electron, no
// network. The contracts package resolves to SOURCE so no prebuilt dist is
// required for the test run.
export default defineConfig({
  resolve: {
    alias: {
      '@re-shell/contracts': resolve(packageRoot, '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
