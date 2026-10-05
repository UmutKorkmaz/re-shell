// Generates the `@supports not (color: oklch(0 0 0))` hex fallback block of
// src/styles/globals.css from the OKLCH tokens, so the two can never drift.
//
//   node scripts/hex-fallback.mjs           # print drift, exit 1 if out of sync
//   node scripts/hex-fallback.mjs --write   # rewrite the fallback block in place
//
// The same functions back the `tokens.test.ts` sync test.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { linearRgbToHex, oklchToLinearRgb, parseOklch } from '@re-shell/contracts';

const here = dirname(fileURLToPath(import.meta.url));
export const GLOBALS_CSS = resolve(here, '../src/styles/globals.css');

const FALLBACK_MARKER = '  /* Hex fallback for engines without OKLCH support */';
const FALLBACK_END = '\n\n  * {\n    @apply border-border;';

/** Matches `--name: oklch(...);` declarations. */
const DECLARATION = /^(\s*)--([a-z0-9-]+):\s*(oklch\([^;]+\));\s*(?:\/\*.*\*\/)?\s*$/;

/** Collect the OKLCH colour tokens declared inside the block opened by `selector`. */
export function readTokens(css, openingLine) {
  const start = css.indexOf(openingLine);
  if (start < 0) throw new Error(`block not found: ${openingLine.trim()}`);
  const end = css.indexOf('\n  }', start);
  const tokens = [];
  for (const line of css.slice(start, end).split('\n')) {
    const match = DECLARATION.exec(line);
    if (match) tokens.push([match[2], match[3]]);
  }
  return tokens;
}

/** `oklch(...)` -> `#rrggbb` or `rgba(r, g, b, a)`. */
export function toFallback(value) {
  const parsed = parseOklch(value);
  if (!parsed) throw new Error(`unparseable colour: ${value}`);
  const hex = linearRgbToHex(oklchToLinearRgb(parsed));
  if (parsed.alpha >= 1) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  const alpha = Number(parsed.alpha.toFixed(3));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function renderBlock(selector, tokens) {
  const lines = tokens.map(([name, value]) => `      --${name}: ${toFallback(value)};`);
  return `    ${selector} {\n${lines.join('\n')}\n    }`;
}

/** Build the full fallback block for the given stylesheet text. */
export function buildFallbackBlock(css) {
  const dark = readTokens(css, '  :root,\n  .dark {');
  const light = readTokens(css, '\n  .light {');
  return [
    FALLBACK_MARKER,
    '  @supports not (color: oklch(0 0 0)) {',
    renderBlock(':root,\n    .dark', dark),
    renderBlock('.light', light),
    '  }',
  ].join('\n');
}

/** Replace the fallback block in a stylesheet. */
export function withFallbackBlock(css) {
  const start = css.indexOf(FALLBACK_MARKER);
  const end = css.indexOf(FALLBACK_END, start);
  if (start < 0 || end < 0) throw new Error('hex fallback block markers not found in globals.css');
  return css.slice(0, start) + buildFallbackBlock(css) + css.slice(end);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const next = withFallbackBlock(css);
  if (process.argv.includes('--write')) {
    writeFileSync(GLOBALS_CSS, next);
    console.log('[hex-fallback] rewrote the fallback block');
  } else if (next !== css) {
    console.error('[hex-fallback] globals.css hex fallback is out of sync; run with --write');
    process.exit(1);
  } else {
    console.log('[hex-fallback] in sync');
  }
}
