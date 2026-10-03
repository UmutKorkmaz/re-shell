// Enforces the @re-shell/ui size budgets and proves the package is tree-shakeable.
//
//   pnpm --filter @re-shell/ui build && pnpm --filter @re-shell/ui budget
//
// 1. Gzip budgets over dist/ (stylesheet, each ES module, the whole ES graph),
//    via the shared scripts/perf-budget.mjs engine and perf-budgets.json.
// 2. Tree-shaking probes: bundle a tiny app that imports ONE thing from the built
//    package with esbuild (production, minified, third-party deps external, exactly
//    what a consumer's bundler does) and require that
//      - the result stays under `maxGzipBytes`, and
//      - none of the `mustNotContain` symbols from unrelated components leaked in.
//    A regression that adds a top-level side effect (or drops `sideEffects`
//    handling) makes the Button-only probe pull in Sheet/Toast/hooks and fails.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { build } from 'esbuild';

import { evaluateBudgets, formatRows } from '../../../scripts/perf-budget.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'perf-budgets.json'), 'utf8'));
const failures = [];

const { rows, failures: budgetFailures } = evaluateBudgets(config, resolve(root, config.root ?? 'dist'));
console.log(`[ui-budget] dist budgets\n${formatRows(rows)}`);
failures.push(...budgetFailures);

const dist = resolve(root, 'dist');
const probeRows = [];
for (const probe of config.treeShake ?? []) {
  const result = await build({
    stdin: { contents: probe.source, resolveDir: dist, loader: 'js' },
    bundle: true,
    write: false,
    format: 'esm',
    minify: true,
    treeShaking: true,
    platform: 'browser',
    // Third-party packages are the consumer's concern; only our own code is measured.
    external: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query', '@re-shell/contracts', 'zod', '@radix-ui/*', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    logLevel: 'silent'
  });
  const code = result.outputFiles[0].text;
  const size = gzipSync(code, { level: 9 }).length;
  const leaked = (probe.mustNotContain ?? []).filter((symbol) => code.includes(symbol));
  const over = size > probe.maxGzipBytes;
  probeRows.push({ name: `tree-shake · ${probe.name}`, files: 1, size, limit: probe.maxGzipBytes, status: over || leaked.length > 0 ? 'OVER' : 'ok' });
  if (over) failures.push(`tree-shake probe "${probe.name}" is ${size} B gzip, budget ${probe.maxGzipBytes} B`);
  if (leaked.length > 0) failures.push(`tree-shake probe "${probe.name}" pulled in unrelated code: ${leaked.join(', ')}`);
}
if (probeRows.length > 0) console.log(`[ui-budget] tree-shaking probes\n${formatRows(probeRows)}`);

if (failures.length > 0) {
  console.error(`\n[ui-budget] ${failures.length} check(s) FAILED:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('[ui-budget] all budgets met');
