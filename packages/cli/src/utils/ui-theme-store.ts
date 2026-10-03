// Workspace store for installed dashboard theme packs: `<workspace>/.re-shell/themes/`.
//
//   index.json     which packs are installed, where from, when (and the integrity that was verified)
//   <id>.json      the validated theme pack itself (re-serialised from the parsed value)
//
// Writes are atomic (temp file + rename), a corrupt index fails loudly instead of being
// overwritten, and pack ids are slugs validated by the contracts schema, so an id can never
// escape the themes directory.

import * as fs from 'fs';
import * as path from 'path';
import { parseThemePack, type ThemePack } from '@re-shell/contracts';

/** Where a pack was installed from. */
export type ThemeSource = 'npm' | 'file' | 'url';

/** One installed pack as recorded in `index.json`. */
export interface ThemeIndexEntry {
  id: string;
  name: string;
  version: string;
  source: ThemeSource;
  /** npm spec, file path or URL the pack came from. */
  origin: string;
  installedAt: string;
  /** npm `dist.integrity` that was verified for npm installs. */
  integrity?: string;
  /** Result of the (best-effort, non-gating) registry signature check. */
  signature?: { verified: boolean; reason?: string };
  /** Pack file, relative to the themes directory. */
  file: string;
}

/** Shape of `index.json`. */
export interface ThemeIndex {
  version: 1;
  themes: Record<string, ThemeIndexEntry>;
}

/** Raised for store failures (corrupt index, name conflicts, unknown id). */
export class ThemeStoreError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ThemeStoreError';
    this.details = details;
  }
}

/** The themes directory of a workspace. */
export function themesDir(workspace: string): string {
  return path.join(path.resolve(workspace), '.re-shell', 'themes');
}

function indexPath(workspace: string): string {
  return path.join(themesDir(workspace), 'index.json');
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}

/** Read the index; a missing file is an empty index, a corrupt one is an error. */
export function readThemeIndex(workspace: string): ThemeIndex {
  const file = indexPath(workspace);
  if (!fs.existsSync(file)) return { version: 1, themes: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ThemeStoreError(`${file} is not valid JSON (${(error as Error).message}); fix or delete it`, { file });
  }
  const themes = (parsed as { themes?: unknown } | null)?.themes;
  if (typeof themes !== 'object' || themes === null || Array.isArray(themes)) {
    throw new ThemeStoreError(`${file} has no "themes" object; fix or delete it`, { file });
  }
  return { version: 1, themes: themes as Record<string, ThemeIndexEntry> };
}

/** Installed packs, sorted by id. */
export function listThemes(workspace: string): ThemeIndexEntry[] {
  return Object.values(readThemeIndex(workspace).themes).sort((a, b) => a.id.localeCompare(b.id));
}

/** Load and RE-VALIDATE an installed pack (the file may have been edited by hand). */
export function loadThemePack(workspace: string, id: string): ThemePack {
  const entry = readThemeIndex(workspace).themes[id];
  if (!entry) throw new ThemeStoreError(`theme "${id}" is not installed`, { id });
  const file = path.join(themesDir(workspace), entry.file);
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new ThemeStoreError(`theme "${id}" is listed in the index but ${entry.file} is missing`, { id });
  }
  const result = parseThemePack(text);
  if (!result.ok) {
    const errors = (result as { errors: readonly string[] }).errors;
    throw new ThemeStoreError(`installed theme "${id}" no longer validates: ${errors.join('; ')}`, { id });
  }
  return (result as { pack: ThemePack }).pack;
}

/** Details recorded alongside an install. */
export interface ThemeInstallMeta {
  source: ThemeSource;
  origin: string;
  integrity?: string;
  signature?: { verified: boolean; reason?: string };
}

/**
 * Install a validated pack.
 *
 * @throws {ThemeStoreError} when the id is already installed (and `force` is not set)
 */
export function installThemePack(
  workspace: string,
  pack: ThemePack,
  meta: ThemeInstallMeta,
  options: { force?: boolean; now?: () => Date } = {}
): ThemeIndexEntry {
  const index = readThemeIndex(workspace);
  if (index.themes[pack.id] && !options.force) {
    throw new ThemeStoreError(
      `theme "${pack.id}" is already installed (${index.themes[pack.id].version}); remove it first or pass --force`,
      { id: pack.id }
    );
  }
  const file = `${pack.id}.json`;
  atomicWrite(path.join(themesDir(workspace), file), `${JSON.stringify(pack, null, 2)}\n`);
  const entry: ThemeIndexEntry = {
    id: pack.id,
    name: pack.name,
    version: pack.version,
    source: meta.source,
    origin: meta.origin,
    installedAt: (options.now?.() ?? new Date()).toISOString(),
    ...(meta.integrity ? { integrity: meta.integrity } : {}),
    ...(meta.signature ? { signature: meta.signature } : {}),
    file,
  };
  index.themes[pack.id] = entry;
  atomicWrite(indexPath(workspace), `${JSON.stringify(index, null, 2)}\n`);
  return entry;
}

/** Remove an installed pack. @throws {ThemeStoreError} when it is not installed */
export function removeThemePack(workspace: string, id: string): ThemeIndexEntry {
  const index = readThemeIndex(workspace);
  const entry = index.themes[id];
  if (!entry) throw new ThemeStoreError(`theme "${id}" is not installed`, { id });
  delete index.themes[id];
  atomicWrite(indexPath(workspace), `${JSON.stringify(index, null, 2)}\n`);
  fs.rmSync(path.join(themesDir(workspace), entry.file), { force: true });
  return entry;
}
