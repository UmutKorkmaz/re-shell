import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));

// Unit tests only (tests/unit): the pure core, SSE/job handling, and the socket
// client against a local protocol server. No VS Code host, no real hub, no built
// CLI. The contracts package resolves to SOURCE so no prebuilt dist is required.
// Integration tests (tests/integration) and host tests (tests/host) have their
// own entry points: `pnpm run test:integration` and `pnpm run test:host`.
export default defineConfig({
  resolve: {
    alias: {
      '@re-shell/contracts': resolve(packageRoot, '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
});
