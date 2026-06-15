import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  readCurrentVersion,
  writeManifestVersion,
  updateDependentRanges,
} from '../../src/utils/release-manifest';

/** Create a temp directory, write files into it, return the dir path. */
function makeTempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-manifest-test-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8');
  }
  return dir;
}

const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

function tmp(files: Record<string, string>): string {
  const d = makeTempDir(files);
  TEMP_DIRS.push(d);
  return d;
}

// ─── Cargo.toml ──────────────────────────────────────────────────────────────

describe('Cargo.toml – [package] scoping (fix #1)', () => {
  const CARGO_WITH_DEP_FIRST = `[dependencies.serde]
version = "1.0"
features = ["derive"]

[package]
name = "my-crate"
version = "1.0.0"
edition = "2021"
`;

  it('readCurrentVersion returns [package] version, not the dependency version', () => {
    const dir = tmp({ 'Cargo.toml': CARGO_WITH_DEP_FIRST });
    const version = readCurrentVersion(dir, 'Cargo.toml');
    expect(version).toBe('1.0.0');
  });

  it('writeManifestVersion bumps [package] version only, leaving serde version intact', () => {
    const dir = tmp({ 'Cargo.toml': CARGO_WITH_DEP_FIRST });
    writeManifestVersion(dir, 'Cargo.toml', '2.0.0');
    const written = fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf8');
    // [package] version must be updated
    expect(written).toContain('version = "2.0.0"');
    // serde's version must be UNTOUCHED
    expect(written).toContain('[dependencies.serde]');
    expect(written).toContain('version = "1.0"');
  });

  it('readCurrentVersion returns correct version when [package] has no dependency version above it', () => {
    const dir = tmp({
      'Cargo.toml': `[package]\nname = "solo"\nversion = "0.5.3"\n`,
    });
    expect(readCurrentVersion(dir, 'Cargo.toml')).toBe('0.5.3');
  });
});

// ─── pyproject.toml ───────────────────────────────────────────────────────────

describe('pyproject.toml – [project] scoping (fix #1)', () => {
  const PYPROJECT = `[build-system]
requires = ["setuptools"]
build-backend = "setuptools.build_meta"

[project]
name = "my-lib"
version = "1.2.3"
description = "A library"
`;

  it('readCurrentVersion reads the [project] version', () => {
    const dir = tmp({ 'pyproject.toml': PYPROJECT });
    expect(readCurrentVersion(dir, 'pyproject.toml')).toBe('1.2.3');
  });

  it('writeManifestVersion bumps [project] version and leaves other sections intact', () => {
    const dir = tmp({ 'pyproject.toml': PYPROJECT });
    writeManifestVersion(dir, 'pyproject.toml', '1.3.0');
    const written = fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf8');
    expect(written).toContain('version = "1.3.0"');
    expect(written).toContain('[build-system]');
    expect(written).toContain('[project]');
  });

  it('falls back to [tool.poetry] when [project] is absent', () => {
    const poetryProject = `[tool.poetry]
name = "my-pkg"
version = "3.0.0"
`;
    const dir = tmp({ 'pyproject.toml': poetryProject });
    expect(readCurrentVersion(dir, 'pyproject.toml')).toBe('3.0.0');
  });
});

// ─── pom.xml ─────────────────────────────────────────────────────────────────

describe('pom.xml – skip <parent> block (fix #2)', () => {
  const POM_WITH_PARENT = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.example</groupId>
    <artifactId>parent-pom</artifactId>
    <version>2.0.0</version>
  </parent>
  <groupId>com.example</groupId>
  <artifactId>my-module</artifactId>
  <version>1.0.0</version>
</project>
`;

  it('readCurrentVersion returns the project version, not the parent version', () => {
    const dir = tmp({ 'pom.xml': POM_WITH_PARENT });
    expect(readCurrentVersion(dir, 'pom.xml')).toBe('1.0.0');
  });

  it('writeManifestVersion bumps the project version only, parent version untouched', () => {
    const dir = tmp({ 'pom.xml': POM_WITH_PARENT });
    writeManifestVersion(dir, 'pom.xml', '1.1.0');
    const written = fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8');
    // Project version must be updated
    expect(written).toMatch(/<version>1\.1\.0<\/version>/);
    // Parent version must remain 2.0.0
    expect(written).toMatch(/<parent>[\s\S]*?<version>2\.0\.0<\/version>[\s\S]*?<\/parent>/);
    // Old project version must be gone
    expect(written).not.toMatch(/<artifactId>my-module<\/artifactId>[\s\S]*?<version>1\.0\.0<\/version>/);
  });

  it('readCurrentVersion with no parent block still works correctly', () => {
    const simplePom = `<project><version>5.0.0</version></project>`;
    const dir = tmp({ 'pom.xml': simplePom });
    expect(readCurrentVersion(dir, 'pom.xml')).toBe('5.0.0');
  });
});

// ─── updateDependentRanges ────────────────────────────────────────────────────

describe('updateDependentRanges (fix: workspace:* left untouched)', () => {
  it('repins ^0.0.0 to ^0.1.0, leaves workspace:* untouched', () => {
    const pkgJson = JSON.stringify(
      {
        name: 'pkg-b',
        version: '0.0.0',
        dependencies: {
          'pkg-a': '^0.0.0',
          'pkg-ws': 'workspace:*',
        },
      },
      null,
      2
    ) + '\n';

    const dir = tmp({ 'package.json': pkgJson });
    const versions = new Map([
      ['pkg-a', '0.1.0'],
      ['pkg-ws', '9.9.9'], // even if in the released set, workspace:* must not change
    ]);
    updateDependentRanges(dir, versions);

    const updated = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    ) as { dependencies: Record<string, string> };

    expect(updated.dependencies['pkg-a']).toBe('^0.1.0');
    expect(updated.dependencies['pkg-ws']).toBe('workspace:*');
  });

  it('does not write the file when nothing changed', () => {
    const pkgJson =
      JSON.stringify(
        { name: 'pkg-c', version: '1.0.0', dependencies: { 'some-ext': '^2.0.0' } },
        null,
        2
      ) + '\n';
    const dir = tmp({ 'package.json': pkgJson });
    const before = fs.statSync(path.join(dir, 'package.json')).mtimeMs;
    // versions map has no overlap with dependencies
    updateDependentRanges(dir, new Map([['other-pkg', '3.0.0']]));
    const after = fs.statSync(path.join(dir, 'package.json')).mtimeMs;
    expect(after).toBe(before);
  });
});
