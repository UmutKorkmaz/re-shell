import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const packageRoot = dirname(fileURLToPath(import.meta.url));

// Integration tests: the REAL built CLI (packages/cli/dist) and the REAL built
// hub server (apps/web/dist/hub-server.js), started as child processes, driven
// through the extension's own client code. No VS Code is involved here; the
// `vscode` module is aliased to a small recording stub so extension.ts's
// activate() can be exercised too. Real-editor coverage is `pnpm run test:host`.
//
// Requires `pnpm -r build` first; missing artifacts fail the run with a clear
// message (they are never skipped).
export default defineConfig({
  resolve: {
    alias: {
      '@re-shell/contracts': resolve(packageRoot, '../../packages/contracts/src/index.ts'),
      vscode: resolve(packageRoot, 'tests/support/vscode-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One real hub + CLI at a time keeps the CLI invocations fast and the logs readable.
    fileParallelism: false,
  },
});
