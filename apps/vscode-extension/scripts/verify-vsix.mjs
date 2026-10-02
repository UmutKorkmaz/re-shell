// Verifies a packaged .vsix instead of trusting that `vsce package` produced a
// usable one. Exits non-zero (listing every problem) when the archive:
//   - is missing a file the editor needs (manifest, bundle, icon, readme, license),
//   - contains sources, tests, tooling, node_modules or another .vsix,
//   - carries a package.json whose identity differs from the source package.json, or
//   - ships a bundle that `require`s anything other than `vscode` and Node built-ins
//     (the vsix is installed without node_modules, so anything else would crash on load).
//
// Usage: node scripts/verify-vsix.mjs [path/to/file.vsix]
// Defaults to <package-root>/<name>-<version>.vsix. Needs the `unzip` CLI.
import { execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vsix = path.resolve(process.argv[2] ?? path.join(root, `${source.name}-${source.version}.vsix`));

const problems = [];
const fail = (message) => problems.push(message);

if (!fs.existsSync(vsix)) {
  console.error(`[verify-vsix] ${vsix} does not exist. Run \`pnpm run package\` first.`);
  process.exit(1);
}

const unzip = (...args) => execFileSync('unzip', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const entries = unzip('-Z1', vsix).split('\n').filter(Boolean);

const required = [
  'extension.vsixmanifest',
  '[Content_Types].xml',
  'extension/package.json',
  'extension/dist/extension.js',
  'extension/readme.md',
  'extension/LICENSE.txt',
  source.icon ? `extension/${source.icon}` : undefined,
].filter(Boolean);
for (const file of required) {
  if (!entries.includes(file)) fail(`missing from the vsix: ${file}`);
}

const forbidden = [
  [/^extension\/src\//, 'sources'],
  [/^extension\/tests\//, 'tests'],
  [/^extension\/scripts\//, 'build scripts'],
  [/^extension\/dist-test\//, 'compiled host tests'],
  [/^extension\/\.vscode-test\//, 'downloaded VS Code'],
  [/node_modules\//, 'node_modules'],
  [/\.vsix$/, 'a nested .vsix'],
  [/\.ts$/, 'TypeScript sources'],
  [/\.map$/, 'source maps'],
];
for (const entry of entries) {
  for (const [pattern, what] of forbidden) {
    if (pattern.test(entry)) fail(`the vsix contains ${what}: ${entry}`);
  }
}

if (entries.includes('extension/package.json')) {
  const packaged = JSON.parse(unzip('-p', vsix, 'extension/package.json'));
  for (const key of ['name', 'publisher', 'version', 'main']) {
    if (packaged[key] !== source[key]) {
      fail(`packaged package.json "${key}" is ${JSON.stringify(packaged[key])}, source has ${JSON.stringify(source[key])}`);
    }
  }
  if (packaged.engines?.vscode !== source.engines?.vscode) {
    fail(`packaged engines.vscode ${packaged.engines?.vscode} differs from source ${source.engines?.vscode}`);
  }
}

if (entries.includes('extension/dist/extension.js')) {
  const bundle = unzip('-p', vsix, 'extension/dist/extension.js');
  const allowed = new Set(['vscode', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
  const requested = new Set([...bundle.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]));
  for (const specifier of requested) {
    if (!allowed.has(specifier)) {
      fail(`the bundle requires "${specifier}", which is neither vscode nor a Node built-in`);
    }
  }
  if (!requested.has('vscode')) {
    fail('the bundle never requires "vscode"; it is not the extension entry point');
  }
}

if (problems.length > 0) {
  console.error(`[verify-vsix] ${path.basename(vsix)} failed verification:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`[verify-vsix] ${path.basename(vsix)} OK (${entries.length} entries)`);
