// The contracts package is ESM ("type": "module"). The command-registry subpath
// is additionally emitted as CommonJS under dist/cjs so CommonJS consumers (the
// Vite config loader that bundles apps/web's hub server) can `require` it.
// This marks that directory as CommonJS.
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('dist/cjs', { recursive: true });
writeFileSync('dist/cjs/package.json', '{"type":"commonjs"}\n');
