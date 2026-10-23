import { createRequire } from 'node:module';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const apolloRequire = createRequire(require.resolve('@apollo/composition'));
const internalsRequire = createRequire(apolloRequire.resolve('@apollo/federation-internals'));
const uuidPath = internalsRequire.resolve('uuid/package.json');
const uuid = JSON.parse(readFileSync(uuidPath, 'utf8'));
if (uuid.version !== '11.1.1') {
  throw new Error(`Apollo bundle requires reviewed uuid 11.1.1; resolved ${uuid.version}`);
}
// Apollo uses only uuid.v1() without options; validate the patched API before
// producing the shipping artifact. Never silently fall back to vulnerable UUID 9.
const { v1, validate, version } = internalsRequire('uuid');
const id = v1();
if (!validate(id) || version(id) !== 1) throw new Error('Patched UUID v1 API is incompatible');

const outdir = resolve(root, 'dist/vendor');
mkdirSync(outdir, { recursive: true });
const result = await build({
  absWorkingDir: root,
  stdin: { contents: "export { composeServices } from '@apollo/composition';", resolveDir: root },
  outfile: resolve(outdir, 'apollo-composition.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['graphql'],
  legalComments: 'eof',
  metafile: true,
});
const inputs = Object.keys(result.metafile.inputs);
const uuidInputs = inputs.filter((input) => /[/\\]uuid[/\\]/.test(input));
if (!uuidInputs.length || uuidInputs.some((input) => !input.includes('uuid@11.1.1'))) {
  throw new Error(`Unexpected bundled UUID inputs: ${uuidInputs.join(', ')}`);
}
// Ship every included package's license, plus an inventory of exact versions.
const packages = new Map();
for (const input of inputs) {
  if (input === '<stdin>') continue;
  let directory = dirname(resolve(root, input));
  while (directory !== dirname(directory)) {
    const manifestPath = resolve(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.name && manifest.version) {
        packages.set(`${manifest.name}@${manifest.version}`, { directory, manifest });
        break;
      }
    }
    directory = dirname(directory);
  }
}
const licenseDirectory = resolve(outdir, 'licenses');
mkdirSync(licenseDirectory, { recursive: true });
for (const [name, { directory, manifest }] of packages) {
  const prefix = name.replace(/[^a-z0-9._-]/gi, '_');
  const legalFiles = readdirSync(directory).filter((file) => /^(licen[sc]e|copying|notice)/i.test(file));
  for (const file of legalFiles) {
    if (statSync(resolve(directory, file)).isFile()) {
      writeFileSync(resolve(licenseDirectory, `${prefix}-${file}`), readFileSync(resolve(directory, file)));
    }
  }
  writeFileSync(resolve(licenseDirectory, `${prefix}.json`), JSON.stringify({
    name: manifest.name, version: manifest.version, license: manifest.license,
    repository: manifest.repository, author: manifest.author,
  }, null, 2) + '\n');
}
const apollo = require('@apollo/composition/package.json');
writeFileSync(resolve(outdir, 'apollo-composition.manifest.json'), JSON.stringify({
  package: '@apollo/composition', version: apollo.version, uuid: uuid.version,
  external: ['graphql'], packages: [...packages.keys()].sort(),
  inputs: inputs.map((input) => relative(root, resolve(root, input))),
}, null, 2) + '\n');
