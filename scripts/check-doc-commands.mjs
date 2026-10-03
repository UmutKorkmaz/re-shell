#!/usr/bin/env node
/**
 * Checks that every `re-shell ...` invocation written in the docs names a real
 * command, and (for flags) a flag that command actually declares.
 *
 * The source of truth is the BUILT CLI: `node packages/cli/dist/index.js commands list --json`.
 * Build first (`pnpm -r build`).
 *
 * What counts as an invocation: text that starts with `re-shell` (or
 * `npx @re-shell/cli`) inside a fenced code block, or inside an inline `code` span.
 * Placeholders (`<name>`, `[options]`, `...`) end the command path.
 *
 * Usage:
 *   node scripts/check-doc-commands.mjs                 # default doc roots
 *   node scripts/check-doc-commands.mjs path/to/a.md    # specific files or directories
 *   node scripts/check-doc-commands.mjs --flags         # also verify --flags (warnings -> errors)
 *   node scripts/check-doc-commands.mjs --json
 *
 * Exits 1 when an unknown command (or, with --flags, an unknown flag) is found.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkFlags = args.includes('--flags');
const asJson = args.includes('--json');
const targets = args.filter((a) => !a.startsWith('--'));

const DEFAULT_ROOTS = [
  'README.md',
  'docs',
  'site/src',
  'packages/cli/README.md',
  'packages/cli/examples',
  'packages/contracts/README.md',
  'packages/mcp/README.md',
  'packages/ui/README.md',
  'packages/control-plane',
  'apps/web/README.md',
  'apps/vscode-extension/README.md',
];
// Historical records and generated listings legitimately mention commands that
// no longer exist (old names, removed commands) or use shorthand.
const SKIP = [
  /docs\/legacy\//,
  /docs\/RE_SHELL_(ULTIMATE|MASTER)_PLAN\.md$/,
  /docs\/superpowers\//,
  /CHANGELOG\.md$/,
  /node_modules/,
  /\/dist\//,
  /packages\/control-plane\/(src|tests|dist)\//,
];

function loadCatalog() {
  const r = spawnSync('node', [path.join(root, 'packages/cli/dist/index.js'), 'commands', 'list', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error('could not run the built CLI (build first: pnpm -r build)\n' + r.stderr);
    process.exit(2);
  }
  return JSON.parse(r.stdout).data;
}

const catalog = loadCatalog();
const byPath = new Map();
const children = new Map(); // path -> Set(child segment)
for (const c of catalog) {
  byPath.set(c.path, c);
  for (const a of c.aliases ?? []) {
    const parts = c.path.split(' ');
    parts[parts.length - 1] = a;
    byPath.set(parts.join(' '), c);
  }
  const parts = c.path.split(' ');
  for (let i = 0; i < parts.length; i++) {
    const parent = parts.slice(0, i).join(' ');
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent).add(parts[i]);
  }
  for (const a of c.aliases ?? []) {
    const parts2 = c.path.split(' ');
    const parent = parts2.slice(0, -1).join(' ');
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent).add(a);
  }
}
// Top-level commands that exist but are hidden from the catalog (help, etc.)
const EXTRA_TOP = new Set(['help']);
const GLOBAL_FLAGS = new Set(['--help', '-h', '--version', '-V', '--json', '--no-color', '--verbose', '--yes', '-y', '--dry-run', '--debug']);

function walk(p, out) {
  const abs = path.resolve(root, p);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(abs)) {
      if (f === 'node_modules' || f === 'dist' || f.startsWith('.')) continue;
      walk(path.join(p, f), out);
    }
  } else if (/\.(md|mdx|astro)$/.test(abs)) {
    const rel = path.relative(root, abs).replaceAll(path.sep, '/');
    if (!SKIP.some((re) => re.test(rel))) out.push(abs);
  }
}

function invocations(text) {
  const found = [];
  const lines = text.split('\n');
  let inFence = false;
  lines.forEach((line, idx) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    const segs = [];
    if (inFence) {
      segs.push(line.replace(/^\s*(\$|>)\s+/, ''));
    } else {
      for (const m of line.matchAll(/`([^`]+)`/g)) segs.push(m[1]);
    }
    for (const seg of segs) {
      // a seg may chain commands: split on && ; |  (but keep `re-shell` starts)
      for (const part of seg.split(/\s*(?:&&|;|\|\||\|)\s*/)) {
        const m = part.match(/^(?:npx\s+@re-shell\/cli|npx\s+re-shell|re-shell)(?:\s+(.*))?$/);
        if (!m) continue;
        found.push({ line: idx + 1, text: part.trim(), rest: (m[1] ?? '').trim() });
      }
    }
  });
  return found;
}

function tokenize(rest) {
  return rest.split(/\s+/).filter(Boolean);
}

function check(inv) {
  const toks = tokenize(inv.rest);
  const words = [];
  let i = 0;
  for (; i < toks.length; i++) {
    const t = toks[i];
    if (!/^[a-z][a-z0-9-]*$/.test(t)) break;
    words.push(t);
  }
  if (words.length === 0) return { ok: true }; // `re-shell --version`, `re-shell <cmd>`, bare `re-shell`
  // Longest matching command path.
  let matched = 0;
  for (let n = words.length; n >= 1; n--) {
    if (byPath.has(words.slice(0, n).join(' ')) || (n === 1 && EXTRA_TOP.has(words[0]))) {
      matched = n;
      break;
    }
  }
  // A group with children but not itself in the catalog (e.g. `config env`).
  if (matched === 0) {
    const first = words[0];
    if (children.get('')?.has(first)) {
      // Longest path that is a known prefix of some command.
      for (let n = words.length; n >= 1; n--) {
        const p = words.slice(0, n).join(' ');
        if (children.has(p)) {
          matched = n;
          break;
        }
      }
      if (matched === 0) matched = 1;
    } else {
      return { ok: false, why: `unknown command "${first}"` };
    }
  }
  const matchedPath = words.slice(0, matched).join(' ');
  const extra = words.slice(matched);
  const cmd = byPath.get(matchedPath);
  const kids = children.get(matchedPath);
  const takesPositional = !!cmd && (cmd.args?.length ?? 0) > 0;
  if (extra.length > 0 && !takesPositional) {
    // The next bare word was not a recognised subcommand and the command takes no
    // positional argument: it is an invented subcommand. (Allow when the command
    // has no children at all and is documented with free text after it.)
    if (kids && kids.size > 0 && !kids.has(extra[0])) {
      return { ok: false, why: `"${matchedPath}" has no subcommand "${extra[0]}" (has: ${[...kids].join(', ')})` };
    }
    if (!kids || kids.size === 0) {
      return { ok: false, why: `"${matchedPath}" takes no argument but is followed by "${extra[0]}"` };
    }
  }
  if (extra.length === 0 && !cmd && kids && kids.size > 0 && matched === words.length) {
    // `re-shell workspace` alone: a group listing; fine.
  }
  const flagProblems = [];
  if (cmd) {
    const declared = new Set((cmd.flags ?? []).map((f) => f.name));
    for (const t of toks) {
      if (!t.startsWith('-') || t === '-' || t === '--') continue;
      const flag = t.split('=')[0];
      if (!/^--?[A-Za-z][A-Za-z0-9-]*$/.test(flag)) continue;
      if (GLOBAL_FLAGS.has(flag)) continue;
      if (declared.has(flag)) continue;
      // --no-x negation of a declared --x
      if (flag.startsWith('--no-') && declared.has('--' + flag.slice(5))) continue;
      flagProblems.push(flag);
    }
  }
  return { ok: true, flagProblems };
}

const files = [];
for (const t of targets.length ? targets : DEFAULT_ROOTS) walk(t, files);

const errors = [];
const warnings = [];
let total = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const inv of invocations(text)) {
    total++;
    const res = check(inv);
    const rel = path.relative(root, f);
    if (!res.ok) errors.push({ file: rel, line: inv.line, text: inv.text, why: res.why });
    else if (res.flagProblems?.length) {
      (checkFlags ? errors : warnings).push({ file: rel, line: inv.line, text: inv.text, why: `undeclared flag(s) ${res.flagProblems.join(', ')}` });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ files: files.length, invocations: total, errors, warnings }, null, 2));
} else {
  for (const e of errors) console.log(`ERROR ${e.file}:${e.line}: ${e.why}\n      ${e.text}`);
  for (const w of warnings) console.log(`warn  ${w.file}:${w.line}: ${w.why}\n      ${w.text}`);
  console.log(`\nchecked ${total} re-shell invocations in ${files.length} files against ${catalog.length} catalog commands: ${errors.length} error(s), ${warnings.length} flag warning(s)`);
}
process.exit(errors.length ? 1 : 0);
