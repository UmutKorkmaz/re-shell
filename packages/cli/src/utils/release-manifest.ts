// Release manifest IO.
//
// Reads and writes per-language manifest versions and updates internal
// dependency ranges, plus prepends rendered fragments to CHANGELOG.md. All
// filesystem access lives here so the engine stays pure. Manifest detection
// mirrors the precedence used by polyglot-build's detectLanguage so a unit's
// manifest type is consistent across the toolchain.

import * as path from 'path';
import * as fs from 'fs-extra';

/** Supported manifest types in detection precedence order. */
export type ManifestType =
  | 'package.json'
  | 'pyproject.toml'
  | 'Cargo.toml'
  | 'pom.xml'
  | 'composer.json'
  | 'Gemfile'
  | 'unknown';

/**
 * Detect a unit's manifest type by file existence, in the same precedence order
 * polyglot-build's detectLanguage uses (Node first, then python/rust/java/php/ruby).
 */
export function detectManifestType(unitDir: string): ManifestType {
  if (fs.existsSync(path.join(unitDir, 'package.json'))) return 'package.json';
  if (fs.existsSync(path.join(unitDir, 'pyproject.toml'))) return 'pyproject.toml';
  if (fs.existsSync(path.join(unitDir, 'Cargo.toml'))) return 'Cargo.toml';
  if (fs.existsSync(path.join(unitDir, 'pom.xml'))) return 'pom.xml';
  if (fs.existsSync(path.join(unitDir, 'composer.json'))) return 'composer.json';
  if (fs.existsSync(path.join(unitDir, 'Gemfile'))) return 'Gemfile';
  return 'unknown';
}

/** Matches a TOML `version = "X"` line (within a section slice), capturing the version value. */
const TOML_VERSION_RE = /(?:^|\n)[ \t]*version[ \t]*=[ \t]*"([^"]*)"/;

/**
 * For Cargo.toml the authoritative version lives in `[package]`.
 * For pyproject.toml it lives in `[project]` or `[tool.poetry]`.
 * Returns the section header to search for, in priority order.
 */
function tomlVersionSection(basename: string): string[] {
  if (basename === 'Cargo.toml') return ['[package]'];
  // pyproject.toml: prefer [project], fall back to [tool.poetry]
  return ['[project]', '[tool.poetry]'];
}

/**
 * Extract the text slice that belongs to the given TOML section header
 * (from the header line up to the next `[` header or EOF).
 * Returns null when the header is not present.
 */
function tomlSectionSlice(raw: string, header: string): string | null {
  const headerIndex = raw.indexOf(header);
  if (headerIndex === -1) return null;
  // Find where the next section begins (a `[` at the start of a line after
  // the header) — that is the boundary of the current section.
  const afterHeader = headerIndex + header.length;
  const nextSection = raw.slice(afterHeader).search(/\n\s*\[/);
  const end = nextSection === -1 ? raw.length : afterHeader + nextSection;
  return raw.slice(headerIndex, end);
}

/**
 * Read the current version for a unit from its manifest, or null when the
 * manifest type carries no version (Gemfile) or the version cannot be parsed.
 */
export function readCurrentVersion(
  unitDir: string,
  manifestType: ManifestType
): string | null {
  switch (manifestType) {
    case 'package.json':
    case 'composer.json':
      return readJsonVersion(path.join(unitDir, manifestType));
    case 'pyproject.toml':
    case 'Cargo.toml':
      return readTomlVersion(path.join(unitDir, manifestType), basename(manifestType));
    case 'pom.xml':
      return readPomVersion(path.join(unitDir, 'pom.xml'));
    case 'Gemfile':
    case 'unknown':
    default:
      return null;
  }
}

/** Thin wrapper — path.basename but without importing a new binding. */
function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

/** Read `.version` from a JSON manifest, or null. */
function readJsonVersion(file: string): string | null {
  try {
    const json = fs.readJsonSync(file) as { version?: unknown };
    return typeof json.version === 'string' ? json.version : null;
  } catch {
    return null;
  }
}

/**
 * Read the `version = "X"` value from the correct section of a TOML manifest.
 * For Cargo.toml this is `[package]`; for pyproject.toml it is `[project]` or
 * `[tool.poetry]` (first one found). Returns null when not found.
 */
function readTomlVersion(file: string, fileBasename: string): string | null {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const header of tomlVersionSection(fileBasename)) {
      const slice = tomlSectionSlice(raw, header);
      if (slice === null) continue;
      const match = TOML_VERSION_RE.exec(slice);
      if (match) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

/** Read the project `<version>` from a Maven POM, skipping `<parent>`. */
function readPomVersion(file: string): string | null {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    // Strip the <parent>...</parent> block so its <version> is invisible.
    const withoutParent = raw.replace(/<parent>[\s\S]*?<\/parent>/g, '');
    const match = /<version>([^<]+)<\/version>/.exec(withoutParent);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Write `nextVersion` into a unit's manifest. JSON manifests are read-modified-
 * written with 2-space formatting; TOML manifests have only the version line
 * replaced (preserving formatting). Other manifest types are best-effort: an
 * unsupported manifest throws so the caller can warn rather than silently no-op.
 */
export function writeManifestVersion(
  unitDir: string,
  manifestType: ManifestType,
  nextVersion: string
): void {
  switch (manifestType) {
    case 'package.json':
    case 'composer.json':
      writeJsonVersion(path.join(unitDir, manifestType), nextVersion);
      return;
    case 'pyproject.toml':
    case 'Cargo.toml':
      writeTomlVersion(path.join(unitDir, manifestType), manifestType, nextVersion);
      return;
    case 'pom.xml':
      writePomVersion(path.join(unitDir, 'pom.xml'), nextVersion);
      return;
    case 'Gemfile':
    case 'unknown':
    default:
      throw new Error(
        `cannot write version to unsupported manifest type "${manifestType}"`
      );
  }
}

/** Read-modify-write a JSON manifest's `.version` with 2-space indentation. */
function writeJsonVersion(file: string, nextVersion: string): void {
  const json = fs.readJsonSync(file) as Record<string, unknown>;
  const updated = { ...json, version: nextVersion };
  fs.writeFileSync(file, JSON.stringify(updated, null, 2) + '\n');
}

/**
 * Replace the `version = "X"` line in the correct TOML section, preserving all
 * other formatting and sections. Throws a clear error if the target section or
 * version line is absent.
 */
function writeTomlVersion(file: string, fileBasename: string, nextVersion: string): void {
  const raw = fs.readFileSync(file, 'utf8');
  const sections = tomlVersionSection(fileBasename);

  for (const header of sections) {
    const headerIndex = raw.indexOf(header);
    if (headerIndex === -1) continue;

    const afterHeader = headerIndex + header.length;
    const rest = raw.slice(afterHeader);
    const nextSectionOffset = rest.search(/\n\s*\[/);
    const sectionEnd = nextSectionOffset === -1 ? rest.length : nextSectionOffset;
    const sectionText = rest.slice(0, sectionEnd);

    // Match version = "..." within the section text, preserving whitespace.
    const versionRe = /([ \t]*version[ \t]*=[ \t]*")([^"]*)(")/;
    if (!versionRe.test(sectionText)) continue;

    const newSection = sectionText.replace(
      versionRe,
      (_m, prefix: string, _old: string, quote: string) =>
        `${prefix}${nextVersion}${quote}`
    );

    const updated =
      raw.slice(0, afterHeader) + newSection + rest.slice(sectionEnd);
    fs.writeFileSync(file, updated);
    return;
  }

  throw new Error(
    `no version line found in the expected section of ${path.basename(file)}`
  );
}

/**
 * Replace the project `<version>` in a Maven POM, skipping any `<parent>`
 * block. Throws a clear error if no project version is found.
 */
function writePomVersion(file: string, nextVersion: string): void {
  const raw = fs.readFileSync(file, 'utf8');

  // Locate the extent of <parent>...</parent> so we can skip it.
  const parentMatch = /<parent>[\s\S]*?<\/parent>/.exec(raw);
  const parentStart = parentMatch ? parentMatch.index : raw.length;
  const parentEnd = parentMatch ? parentMatch.index + parentMatch[0].length : raw.length;

  // Find the first <version> that is NOT inside <parent>.
  const versionRe = /<version>[^<]+<\/version>/g;
  let match: RegExpExecArray | null;
  while ((match = versionRe.exec(raw)) !== null) {
    const idx = match.index;
    // Skip versions that fall within the parent block.
    if (parentMatch && idx >= parentStart && idx < parentEnd) continue;
    // This is the project version — replace it in place.
    const updated =
      raw.slice(0, idx) +
      `<version>${nextVersion}</version>` +
      raw.slice(idx + match[0].length);
    fs.writeFileSync(file, updated);
    return;
  }

  throw new Error('no project <version> element found in pom.xml');
}

/**
 * Update internal dependency ranges in a package.json (only). For each dep or
 * devDep key that names a released internal package, leave a `workspace:` range
 * untouched (pnpm resolves those at publish) and otherwise pin it to
 * `^<newVersion>`. Non-package.json manifests are left untouched.
 */
export function updateDependentRanges(
  unitDir: string,
  depNameToVersion: Map<string, string>
): void {
  const file = path.join(unitDir, 'package.json');
  if (!fs.existsSync(file)) return;

  const json = fs.readJsonSync(file) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };

  let changed = false;
  const updateBlock = (
    block: Record<string, string> | undefined
  ): Record<string, string> | undefined => {
    if (!block) return block;
    const next: Record<string, string> = { ...block };
    for (const [dep, range] of Object.entries(block)) {
      const version = depNameToVersion.get(dep);
      if (version === undefined) continue;
      if (range.startsWith('workspace:')) continue;
      const pinned = `^${version}`;
      if (next[dep] !== pinned) {
        next[dep] = pinned;
        changed = true;
      }
    }
    return next;
  };

  const updated = {
    ...json,
    ...(json.dependencies ? { dependencies: updateBlock(json.dependencies) } : {}),
    ...(json.devDependencies
      ? { devDependencies: updateBlock(json.devDependencies) }
      : {}),
  };

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(updated, null, 2) + '\n');
  }
}

/** Top-of-file changelog header used when creating a new CHANGELOG.md. */
const CHANGELOG_HEADER = '# Changelog';

/**
 * Prepend a rendered changelog fragment to CHANGELOG.md (creating it with a
 * top-level header when absent). New entries are inserted directly after the
 * `# Changelog` header so the file stays newest-first.
 */
export function writeChangelog(unitDir: string, entry: string): void {
  const file = path.join(unitDir, 'CHANGELOG.md');
  const fragment = entry.endsWith('\n') ? entry : `${entry}\n`;

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `${CHANGELOG_HEADER}\n\n${fragment}`);
    return;
  }

  const existing = fs.readFileSync(file, 'utf8');
  if (existing.startsWith(CHANGELOG_HEADER)) {
    const rest = existing.slice(CHANGELOG_HEADER.length).replace(/^\n+/, '');
    fs.writeFileSync(file, `${CHANGELOG_HEADER}\n\n${fragment}\n${rest}`);
    return;
  }

  // No recognised header: prepend a fresh header + fragment above the old body.
  fs.writeFileSync(file, `${CHANGELOG_HEADER}\n\n${fragment}\n${existing}`);
}
