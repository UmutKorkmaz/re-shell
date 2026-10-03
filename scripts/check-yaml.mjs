#!/usr/bin/env node
/**
 * Syntax check for the YAML files of a generated app.
 *
 * Used by scripts/scaffold-test-templates.sh for the configuration-only
 * backend templates (service meshes, ingress/proxy configs, docker-compose
 * bundles, ...) that have no language toolchain to build with. Every
 * .yaml/.yml file must parse (all documents of multi-document files).
 *
 * Usage: node scripts/check-yaml.mjs <dir>
 * Exit codes: 0 all files parse, 1 a file failed to parse, 2 no YAML files.
 */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
// `yaml` is a dependency of packages/cli, which is where the repo installs it.
const require = createRequire(join(scriptDir, '../packages/cli/package.json'));
const { parseAllDocuments } = require('yaml');

const root = resolve(process.argv[2] || '.');
const SKIP = new Set(['node_modules', '.git', 'vendor', '.venv', 'target']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.ya?ml$/.test(entry.name)) yield full;
  }
}

let count = 0;
let failed = 0;
for (const file of walk(root)) {
  count += 1;
  const docs = parseAllDocuments(readFileSync(file, 'utf8'));
  const errors = docs.flatMap((doc) => doc.errors);
  if (errors.length > 0) {
    failed += 1;
    console.error(`${relative(root, file)}: ${errors[0].message.split('\n')[0]}`);
  }
}

if (count === 0) {
  console.error('no YAML files found');
  process.exit(2);
}
if (failed > 0) {
  console.error(`${failed} of ${count} YAML files failed to parse`);
  process.exit(1);
}
console.log(`${count} YAML files parsed`);
