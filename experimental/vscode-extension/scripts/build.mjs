// Compiles the VS Code extension into a single CommonJS bundle at
// dist/extension.js using esbuild. The `vscode` module is provided by the
// editor host at runtime, so it stays EXTERNAL; everything else (contracts,
// zod, the pure core) is bundled.
//
// This intentionally does NOT launch a VS Code host or run
// @vscode/test-electron (which downloads VS Code). It is a pure compile step.
//
// `@re-shell/contracts` is aliased to its workspace SOURCE so the bundle is
// fully self-contained: no prebuilt contracts dist and no pnpm workspace
// install is required to build. (tests do the same via vitest alias.)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const contractsSource = path.resolve(root, '../../packages/contracts/src/index.ts');

await build({
  entryPoints: [path.join(root, 'src/extension.ts')],
  outfile: path.join(root, 'dist/extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  // The VS Code API is injected by the host runtime, never bundled.
  external: ['vscode'],
  alias: {
    '@re-shell/contracts': contractsSource,
  },
  sourcemap: false,
  logLevel: 'info',
});

console.log('[build] Wrote dist/extension.js');
