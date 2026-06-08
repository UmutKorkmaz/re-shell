#!/usr/bin/env node
// Authoritative reachability index for re-shell-cli.
// BFS from the single live root (src/index.ts). Resolves static `import`,
// dynamic `import()`, and CommonJS `require()` specifiers. Extension-normalized.
// Emits orphans.json (path list + counts) and prints live-vs-orphan stats.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(CLI_ROOT, 'src');
const ROOT_ENTRY = path.join(SRC_ROOT, 'index.ts');

const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const RESOLVE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

// Collect every source file under src/ (the universe of files we judge).
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SOURCE_EXTS.includes(ext)) acc.push(full);
    }
  }
  return acc;
}

// Resolve a relative specifier to an actual file on disk (extension-normalized).
function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare import => node_modules, skip
  const base = path.resolve(path.dirname(fromFile), spec);

  // 1. Exact file as written.
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;

  // 2. Append known extensions.
  for (const ext of RESOLVE_EXTS) {
    const cand = base + ext;
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }

  // 2b. TS-style: a specifier written with a JS-ish extension (e.g. './x.js')
  // that actually resolves to a TypeScript source on disk ('./x.ts'/'.tsx').
  const writtenExt = path.extname(base);
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(writtenExt)) {
    const stem = base.slice(0, -writtenExt.length);
    for (const ext of ['.ts', '.tsx']) {
      const cand = stem + ext;
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    }
  }

  // 3. Directory index file.
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of RESOLVE_EXTS) {
      const cand = path.join(base, 'index' + ext);
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    }
  }

  return null;
}

// Extract every relative specifier referenced by a file via import/import()/require().
function extractSpecifiers(content) {
  const specs = new Set();

  // static: import ... from '...'  /  export ... from '...'
  const fromRe = /\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  // bare side-effect import: import '...'
  const bareImportRe = /\bimport\s*['"]([^'"]+)['"]/g;
  // dynamic import('...')
  const dynRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  // require('...')
  const reqRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const re of [fromRe, bareImportRe, dynRe, reqRe]) {
    let m;
    while ((m = re.exec(content)) !== null) {
      specs.add(m[1]);
    }
  }
  return [...specs];
}

function countLines(file) {
  try {
    const c = fs.readFileSync(file, 'utf8');
    if (c.length === 0) return 0;
    return c.split('\n').length;
  } catch {
    return 0;
  }
}

// --- BFS from the single root ---
const live = new Set();
const queue = [ROOT_ENTRY];
live.add(ROOT_ENTRY);

while (queue.length) {
  const file = queue.shift();
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  // JSON has no imports.
  if (file.endsWith('.json')) continue;

  for (const spec of extractSpecifiers(content)) {
    const resolved = resolveSpecifier(file, spec);
    if (!resolved) continue;
    if (resolved.endsWith('.json')) continue; // data file, not a code edge to traverse
    if (!resolved.startsWith(SRC_ROOT)) continue; // outside src
    if (!live.has(resolved)) {
      live.add(resolved);
      queue.push(resolved);
    }
  }
}

// --- Classify universe ---
const universe = walk(SRC_ROOT);
const orphans = universe.filter((f) => !live.has(f)).sort();

const orphanLines = orphans.reduce((sum, f) => sum + countLines(f), 0);
const liveFiles = universe.filter((f) => live.has(f));
const liveLines = liveFiles.reduce((sum, f) => sum + countLines(f), 0);

const rel = (f) => path.relative(CLI_ROOT, f);

const report = {
  generatedAt: new Date().toISOString(),
  root: rel(ROOT_ENTRY),
  totals: {
    universeFiles: universe.length,
    liveFiles: liveFiles.length,
    orphanFiles: orphans.length,
    liveLines,
    orphanLines,
  },
  orphans: orphans.map(rel),
};

const outPath = path.join(__dirname, 'orphans.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

console.log('Reachability index (root: %s)', rel(ROOT_ENTRY));
console.log('  universe files : %d', universe.length);
console.log('  live    files  : %d (%d lines)', liveFiles.length, liveLines);
console.log('  orphan  files  : %d (%d lines)', orphans.length, orphanLines);
console.log('  wrote: %s', rel(outPath));
