// Compiles src/styles/globals.css (Tailwind + design tokens) into dist/index.css
// with the package's PostCSS pipeline (postcss.config.cjs: tailwindcss +
// autoprefixer), minifies it, and ships the Latin-only fonts.css beside it.
//
// This is a separate step from `vite build` on purpose: the stylesheet is not part
// of the JS module graph (so JS stays tree-shakeable and nothing is inlined into
// it), and fonts are NOT inlined into the CSS (see src/styles/fonts.css).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

const input = resolve(root, 'src/styles/globals.css');
const output = resolve(root, 'dist/index.css');

const result = await postcss([tailwindcss({ config: resolve(root, 'tailwind.config.ts') }), autoprefixer()]).process(
  readFileSync(input, 'utf8'),
  { from: input, to: output }
);

// Dependency-free minification: strip comments and collapse whitespace between
// tokens. (A CSS minifier is not a dependency of this package; Vite minifies the
// consuming app's final bundle again anyway.)
const minified = result.css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/:\s+/g, ':')
  .replace(/\s{2,}/g, ' ')
  .trim();

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, minified);
copyFileSync(resolve(root, 'src/styles/fonts.css'), resolve(root, 'dist/fonts.css'));
console.log(`[build-css] dist/index.css ${(minified.length / 1024).toFixed(1)} kB, dist/fonts.css`);
