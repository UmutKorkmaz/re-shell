// Bundles the hub server (apps/web/src/hub-server-main.ts) into a single,
// self-contained CommonJS file at apps/web/dist/hub-server.js that runs under
// plain `node` with no ts-node/tsx and no reliance on node_modules being
// resolvable from the bundle's location. `ws`, `zod`, and the contracts
// package are bundled in; only Node built-ins stay external.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const appWebRoot = path.resolve(here, '..');

await build({
  entryPoints: [path.join(appWebRoot, 'src/hub-server-main.ts')],
  outfile: path.join(appWebRoot, 'dist/hub-server.js'),
  bundle: true,
  platform: 'node',
  // CommonJS output avoids ESM resolution quirks when spawned by absolute path.
  format: 'cjs',
  target: 'node18',
  // Node built-ins are provided by the runtime; everything else is bundled so
  // the output is dependency-free at its spawn location.
  packages: undefined,
  external: [],
  sourcemap: false,
  logLevel: 'info',
});

console.log('[build-hub] Wrote dist/hub-server.js');
