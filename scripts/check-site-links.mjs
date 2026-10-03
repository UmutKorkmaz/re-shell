#!/usr/bin/env node
/**
 * Checks the internal links of the built docs site: every `/re-shell/...` link in
 * site/src (markdown and astro) must resolve to a page in site/dist, and every
 * `#anchor` must exist as an id in that page.
 *
 *   pnpm --filter @re-shell/site build && node scripts/check-site-links.mjs
 *
 * Exits 1 when a link is broken.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'site', 'dist');
const src = path.join(root, 'site', 'src');
const BASE = '/re-shell';

if (!fs.existsSync(dist)) {
  console.error('site/dist not found: run `pnpm --filter @re-shell/site build` first');
  process.exit(2);
}

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(md|mdx|astro)$/.test(f)) out.push(p);
  }
  return out;
}

const idCache = new Map();
function idsOf(htmlPath) {
  if (!idCache.has(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    idCache.set(htmlPath, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(htmlPath);
}

let checked = 0;
const problems = [];
for (const file of walk(src)) {
  const text = fs.readFileSync(file, 'utf8');
  const links = [...text.matchAll(/\]\((\/re-shell\/[^)\s]*)\)/g)].map((m) => m[1]);
  for (const link of links) {
    checked++;
    const [pathname, anchor] = link.split('#');
    const rel = pathname.slice(BASE.length).replace(/^\/|\/$/g, '');
    const target = rel === '' ? path.join(dist, 'index.html') : path.join(dist, rel, 'index.html');
    const asFile = path.join(dist, rel);
    const exists = fs.existsSync(target) ? target : fs.existsSync(asFile) && fs.statSync(asFile).isFile() ? asFile : null;
    const where = path.relative(root, file);
    if (!exists) {
      problems.push(`${where}: ${link} -> no such page`);
    } else if (anchor && exists.endsWith('.html') && !idsOf(exists).has(anchor)) {
      problems.push(`${where}: ${link} -> page exists but has no #${anchor}`);
    }
  }
}

for (const p of problems) console.log('BROKEN ' + p);
console.log(`checked ${checked} internal links: ${problems.length} broken`);
process.exit(problems.length ? 1 : 0);
