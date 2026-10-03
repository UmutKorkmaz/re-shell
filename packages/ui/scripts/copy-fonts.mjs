// Ships the (Latin-only) font stylesheet next to the compiled library CSS.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'dist'), { recursive: true });
copyFileSync(resolve(root, 'src/styles/fonts.css'), resolve(root, 'dist/fonts.css'));
console.log('[copy-fonts] dist/fonts.css');
