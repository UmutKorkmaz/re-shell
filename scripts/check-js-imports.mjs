#!/usr/bin/env node
/**
 * Import-resolution check for plain JavaScript templates.
 *
 * Plain JS has no compiler, so a template can ship `require('some-pkg')` for a
 * package that is not in its package.json, or `require('./missing')` for a file
 * that was never generated, and nothing catches it until the app is started.
 * This script walks every .js/.mjs/.cjs file of an installed app and checks that
 * each static import specifier resolves:
 *
 *   - Node built-ins (`fs`, `node:path`, ...) are accepted,
 *   - relative specifiers must exist (with the usual extension / index lookup),
 *   - bare specifiers must resolve through the app's own node_modules.
 *
 * Every file is also parsed (`node --check` semantics via `vm.Script` /
 * `vm.SourceTextModule`-free syntax check using `new Function` is unreliable for
 * modules, so the caller runs `node --check` separately).
 *
 * Usage: node scripts/check-js-imports.mjs <appDir>
 * Exit code 1 when something does not resolve.
 */
import { createRequire } from 'node:module';
import { builtinModules } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const appDir = resolve(process.argv[2] || '.');
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const EXTS = ['', '.js', '.mjs', '.cjs', '.json', '.node'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (['.js', '.mjs', '.cjs'].includes(extname(entry))) out.push(full);
  }
  return out;
}

/** Strip comments so `// require('x')` in a comment is not treated as an import. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

function specifiers(src) {
  const code = stripComments(src);
  const found = new Set();
  const patterns = [
    /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
    /\bimport\s+(?:[\w*\s{},$]+\s+from\s+)?(['"])([^'"\n]+)\1/g,
    /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+(['"])([^'"\n]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) found.add(m[2]);
  }
  return [...found];
}

function relativeExists(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const ext of EXTS) {
    if (existsSync(base + ext) && statSync(base + ext).isFile()) return true;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    if (existsSync(join(base, 'package.json'))) return true;
    for (const ext of EXTS.slice(1)) if (existsSync(join(base, `index${ext}`))) return true;
  }
  return false;
}

const files = walk(appDir);
const problems = [];
for (const file of files) {
  const req = createRequire(file);
  for (const spec of specifiers(readFileSync(file, 'utf8'))) {
    if (builtins.has(spec)) continue;
    if (spec.startsWith('.') || spec.startsWith('/')) {
      if (!relativeExists(file, spec)) problems.push(`${file.slice(appDir.length + 1)}: relative import '${spec}' does not exist`);
      continue;
    }
    if (spec.startsWith('#')) continue; // package.json "imports" map
    // Resolve the package itself, not a deep path (package.json "exports" may hide subpaths).
    const parts = spec.split('/');
    const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    try {
      req.resolve(`${pkg}/package.json`);
    } catch (e) {
      try {
        req.resolve(spec);
      } catch (e2) {
        problems.push(`${file.slice(appDir.length + 1)}: package '${pkg}' is imported but not installed (missing from package.json?)`);
      }
    }
  }
}

if (files.length === 0) {
  console.log('no JavaScript files found');
  process.exit(1);
}
if (problems.length) {
  console.log(`${problems.length} unresolved import(s) in ${files.length} files:`);
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log(`all imports resolve (${files.length} files)`);
