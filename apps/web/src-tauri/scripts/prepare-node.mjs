#!/usr/bin/env node
// Reproducible runtime staging. Hashes are from Node's v22.23.3 SHASUMS256.txt.
// No npm, shell interpolations, or user-system runtime is copied into a release.
import { createHash } from 'node:crypto';
import { constants, chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const version = '22.23.3';
const hashes = {
  'darwin-arm64': '23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53',
  'darwin-x64': '8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8',
  'linux-x64': '1084aa36196bba4c3a5e69a1ee388a6e4ff729dad09445fbcd434b28fe3c24af',
  'win-x64': '2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71',
};
const platform = process.platform === 'win32' ? 'win' : process.platform;
const target = process.argv[2] ?? `${platform}-${process.arch}`;
const targets = target === 'darwin-universal' ? ['darwin-arm64', 'darwin-x64'] : [target];
if (targets.some((value) => !Object.hasOwn(hashes, value))) {
  throw new Error(`Unsupported desktop runtime target: ${target}`);
}
const directory = dirname(fileURLToPath(import.meta.url));
const output = resolve(directory, '../runtime');
const binaries = resolve(directory, '../binaries');
const triples = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-universal': 'universal-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'win-x64': 'x86_64-pc-windows-msvc',
};
const scratch = mkdtempSync(join(tmpdir(), 're-shell-node-'));
try {
  const staged = [];
  for (const value of targets) {
    const name = `node-v${version}-${value}`;
    const archiveName = `${name}.${value.startsWith('win-') ? 'zip' : 'tar.gz'}`;
    const response = await fetch(`https://nodejs.org/dist/v${version}/${archiveName}`, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Node download failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== hashes[value]) {
      throw new Error(`Node archive checksum mismatch: ${archiveName}`);
    }
    const archive = join(scratch, archiveName);
    writeFileSync(archive, bytes);
    // Windows ships bsdtar; it also extracts zip archives without shell evaluation.
    execFileSync('tar', ['-xf', archive, '-C', scratch], { stdio: 'inherit' });
    const root = join(scratch, name);
    staged.push(join(root, value.startsWith('win-') ? 'node.exe' : 'bin/node'));
    mkdirSync(output, { recursive: true });
    copyFileSync(join(root, 'LICENSE'), join(output, 'LICENSE.node'));
  }
  mkdirSync(binaries, { recursive: true });
  const executable = join(binaries, `re-shell-node-${triples[target]}${target.startsWith('win-') ? '.exe' : ''}`);
  if (target === 'darwin-universal') {
    if (process.platform !== 'darwin') throw new Error('A universal runtime requires macOS lipo');
    execFileSync('lipo', ['-create', ...staged, '-output', executable], { stdio: 'inherit' });
    // Re-sign the merged executable ad hoc; the release bundler replaces this
    // with Developer ID signing when configured.
    execFileSync('codesign', ['--force', '--sign', '-', executable], { stdio: 'inherit' });
    // Both Rust architecture builds inspect their sidecar before the universal
    // bundle is assembled. The same fat binary serves all three target names.
    for (const architecture of targets) copyFileSync(executable, join(binaries, `re-shell-node-${triples[architecture]}`), constants.COPYFILE_FICLONE);
  } else {
    copyFileSync(staged[0], executable);
  }
  chmodSync(executable, 0o755);
  writeFileSync(join(output, 'version.json'), JSON.stringify({ version, target }, null, 2));
  console.log(`Staged Node ${version} (${target}) at ${executable}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
