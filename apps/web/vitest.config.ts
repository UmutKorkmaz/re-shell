import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));

// The hub server is pure Node (http/ws/child_process), so it runs in the node
// environment. Source aliases mirror tsconfig.json so the hub's import of the
// contracts package resolves to source (no prebuilt dist required).
export default defineConfig({
  resolve: {
    alias: {
      '@umutkorkmaz/contracts': resolve(
        packageRoot,
        '../../packages/contracts/src/index.ts'
      ),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Hub tests bind real ephemeral ports and spawn real children; keep them
    // serial and give each ample room to drain.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
