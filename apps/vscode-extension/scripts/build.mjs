// Compiles the VS Code extension into a single CommonJS bundle at
// dist/extension.js using esbuild. The `vscode` module is provided by the
// editor host at runtime, so it stays EXTERNAL; everything else (contracts,
// zod, the pure core) is bundled, so the packaged .vsix needs no node_modules.
//
// `@re-shell/contracts` is aliased to its workspace SOURCE so the bundle does
// not depend on contracts having been built first.
//
// Flags:
//   --minify   produce a minified bundle (used by `pnpm run package`).
//
// This is a compile step only. The editor-host tests live in tests/host and are
// built by scripts/build-host-tests.mjs.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const contractsSource = path.resolve(root, '../../packages/contracts/src/index.ts');
const minify = process.argv.includes('--minify');

await build({
  entryPoints: [path.join(root, 'src/extension.ts')],
  outfile: path.join(root, 'dist/extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  // VS Code 1.85 (the oldest supported editor) runs extensions on Node 18.
  target: 'node18',
  // The VS Code API is injected by the host runtime, never bundled.
  external: ['vscode'],
  alias: {
    '@re-shell/contracts': contractsSource,
  },
  minify,
  sourcemap: false,
  logLevel: 'info',
});

console.log(`[build] Wrote dist/extension.js${minify ? ' (minified)' : ''}`);
