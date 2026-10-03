#!/usr/bin/env node
// Enforced gzip size budgets for built assets.
//
//   node scripts/perf-budget.mjs --config apps/web/perf-budgets.json
//
// Config shape (paths are relative to the config file's directory):
//
//   {
//     "root": "dist",
//     "budgets": [
//       { "name": "entry JS", "match": "assets/index-*.js", "maxGzipBytes": 90000, "each": true },
//       { "name": "all fonts", "match": "assets/*.woff2", "maxGzipBytes": 200000 }
//     ]
//   }
//
// A budget measures the GZIP size of the files its glob (`*`, `**`, `?`, `{a,b}`) matches:
//   - default       the SUM of all matched files must stay under `maxGzipBytes`
//   - "each": true  EVERY matched file must stay under `maxGzipBytes`
//   - "optional": true  a glob that matches nothing is allowed (otherwise it is a
//     failure, so a renamed chunk cannot silently drop out of enforcement)
//
// Exits 1 (printing which budget broke and by how much) when any budget is
// exceeded or a required glob matches nothing, so it can gate CI.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

/** Translate a glob (`*`, `**`, `?`, `{a,b}`) into an anchored RegExp over POSIX paths. */
export function globToRegExp(glob) {
  let source = '';
  let braces = 0;
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '{') {
      braces += 1;
      source += '(?:';
    } else if (ch === '}' && braces > 0) {
      braces -= 1;
      source += ')';
    } else if (ch === ',' && braces > 0) {
      source += '|';
    } else if (ch === '*') {
      if (glob[i + 1] === '*') {
        source += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else {
        source += '[^/]*';
      }
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** Gzip size in bytes (level 9, what a CDN would send). */
export function gzipBytes(buffer) {
  return gzipSync(buffer, { level: 9 }).length;
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

/**
 * Evaluate a parsed budget config. Pure over the filesystem under `rootDir`.
 * @returns {{ rows: object[], failures: string[] }}
 */
export function evaluateBudgets(config, rootDir) {
  const files = walk(rootDir).map((full) => ({
    full,
    rel: relative(rootDir, full).split(sep).join('/')
  }));
  const rows = [];
  const failures = [];

  for (const budget of config.budgets) {
    const matcher = globToRegExp(budget.match);
    const matched = files.filter((file) => matcher.test(file.rel));
    if (matched.length === 0) {
      if (!budget.optional) {
        failures.push(`${budget.name}: "${budget.match}" matched no files under ${rootDir} (renamed? stale budget?)`);
      }
      rows.push({ name: budget.name, files: 0, size: 0, limit: budget.maxGzipBytes, status: budget.optional ? 'skip' : 'MISSING' });
      continue;
    }
    const sized = matched.map((file) => ({ rel: file.rel, size: gzipBytes(readFileSync(file.full)) }));
    if (budget.each) {
      for (const file of sized) {
        const over = file.size > budget.maxGzipBytes;
        rows.push({ name: `${budget.name} · ${file.rel}`, files: 1, size: file.size, limit: budget.maxGzipBytes, status: over ? 'OVER' : 'ok' });
        if (over) {
          failures.push(
            `${budget.name}: ${file.rel} is ${kb(file.size)} gzip, budget ${kb(budget.maxGzipBytes)} (+${kb(file.size - budget.maxGzipBytes)})`
          );
        }
      }
    } else {
      const total = sized.reduce((sum, file) => sum + file.size, 0);
      const over = total > budget.maxGzipBytes;
      rows.push({ name: budget.name, files: sized.length, size: total, limit: budget.maxGzipBytes, status: over ? 'OVER' : 'ok' });
      if (over) {
        failures.push(
          `${budget.name}: ${sized.length} file(s) total ${kb(total)} gzip, budget ${kb(budget.maxGzipBytes)} (+${kb(total - budget.maxGzipBytes)})`
        );
      }
    }
  }
  return { rows, failures };
}

/** Render rows as an aligned table. */
export function formatRows(rows) {
  const width = Math.max(...rows.map((row) => row.name.length), 10);
  return rows
    .map((row) => {
      const pct = row.limit ? `${Math.round((row.size / row.limit) * 100)}%`.padStart(5) : '';
      return `  ${row.status.padEnd(7)} ${row.name.padEnd(width)}  ${kb(row.size).padStart(10)} / ${kb(row.limit).padStart(9)} ${pct}`;
    })
    .join('\n');
}

export function runBudgetConfig(configPath) {
  const absolute = resolve(configPath);
  const config = JSON.parse(readFileSync(absolute, 'utf8'));
  const rootDir = resolve(dirname(absolute), config.root ?? 'dist');
  try {
    statSync(rootDir);
  } catch {
    console.error(`[perf-budget] ${rootDir} does not exist; build first.`);
    return { rows: [], failures: [`build output ${rootDir} is missing`] };
  }
  return evaluateBudgets(config, rootDir);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const index = process.argv.indexOf('--config');
  if (index < 0 || !process.argv[index + 1]) {
    console.error('usage: node scripts/perf-budget.mjs --config <budgets.json>');
    process.exit(2);
  }
  const { rows, failures } = runBudgetConfig(process.argv[index + 1]);
  if (rows.length > 0) console.log(`[perf-budget] ${process.argv[index + 1]}\n${formatRows(rows)}`);
  if (failures.length > 0) {
    console.error(`\n[perf-budget] ${failures.length} budget(s) FAILED:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('[perf-budget] all budgets met');
}
