// Workspace file scanning for refactors: walks the tree (skipping dependency
// and build directories) and loads text files into memory.

import * as fs from 'fs';
import * as path from 'path';

export interface ScannedFile {
  /** POSIX-style path relative to the scan root. */
  rel: string;
  abs: string;
  content: string;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.next',
  '.nuxt',
  '.gradle',
  '.idea',
  'bin',
  'obj',
  'coverage',
  '.terraform',
  '.re-shell',
  '.turbo',
  '.pytest_cache',
  '.mypy_cache',
]);

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.pdf', '.zip', '.gz', '.tgz', '.tar', '.jar',
  '.war', '.class', '.so', '.dll', '.exe', '.dylib', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp4',
  '.mov', '.wasm', '.pyc', '.o', '.a', '.lib', '.svg',
]);

/** Lockfiles are generated; rewriting them by hand would corrupt integrity data. */
const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'uv.lock',
  'composer.lock',
  'Gemfile.lock',
  'packages.lock.json',
]);

const MAX_FILE_BYTES = 1024 * 1024;

export function isLockfile(rel: string): boolean {
  return LOCKFILES.has(path.posix.basename(rel));
}

export interface ScanResult {
  files: ScannedFile[];
  /** Lockfiles that exist (not loaded), relative paths. */
  lockfiles: string[];
  /** Directory paths (relative, POSIX) seen during the walk. */
  dirs: string[];
}

/**
 * Walk `root` and load every text file.
 *
 * @param root - Directory to scan.
 */
export function scanWorkspace(root: string): ScanResult {
  const files: ScannedFile[] = [];
  const lockfiles: string[] = [];
  const dirs: string[] = [];

  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        dirs.push(rel);
        walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (LOCKFILES.has(entry.name)) {
        lockfiles.push(rel);
        continue;
      }
      if (BINARY_EXT.has(path.extname(entry.name).toLowerCase())) continue;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_BYTES) continue;
      let buf: Buffer;
      try {
        buf = fs.readFileSync(abs);
      } catch {
        continue;
      }
      if (buf.includes(0)) continue;
      files.push({ rel, abs, content: buf.toString('utf8') });
    }
  };
  walk(root);
  return { files, lockfiles, dirs };
}
