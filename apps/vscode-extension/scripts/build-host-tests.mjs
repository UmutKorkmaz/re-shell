// Compiles the VS Code HOST tests (tests/host) to CommonJS under dist-test/ so
// they can be loaded by @vscode/test-electron: the launcher (dist-test/host/run.js)
// runs in plain Node and the suite (dist-test/host/suite/*.js) runs inside the
// editor's extension host.
//
// Local test-support code (tests/support) is bundled in; npm packages stay
// external and resolve from this package's node_modules at run time. `vscode`
// is provided by the editor.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

await build({
  entryPoints: {
    'host/run': path.join(root, 'tests/host/run.ts'),
    'host/suite/index': path.join(root, 'tests/host/suite/index.ts'),
    'host/suite/extension.test': path.join(root, 'tests/host/suite/extension.test.ts'),
  },
  outdir: path.join(root, 'dist-test'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  // The host's Node is as old as 18 for the oldest supported editor (1.85).
  target: 'node18',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
});

console.log('[build-host-tests] Wrote dist-test/host/*');
