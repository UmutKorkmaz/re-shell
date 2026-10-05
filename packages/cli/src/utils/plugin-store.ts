import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Persistence for the workspace plugin registry file (`.re-shell/plugins.json`).
 *
 * The installer, uninstaller, updater and pin commands all read and write this
 * one file, so the IO lives here: atomic writes (temp file + rename), a loud
 * failure on a corrupt file (never silently overwritten), and immutable updates
 * that preserve fields written by other commands (pins, signature records, ...).
 *
 * The module is free of CLI/chalk concerns so it is unit-testable directly.
 */

/** How a plugin was installed by the CLI. */
export type PluginInstallSource = 'local' | 'git' | 'npm';

/** Git provenance recorded for plugins installed from a git URL. */
export interface PluginGitRecord {
  /** Clone URL (without the `git+` prefix or `#ref` fragment). */
  url: string;
  /** Requested branch/tag/commit; undefined means the remote's default HEAD. */
  ref?: string;
  /** Resolved commit SHA of the installed checkout. */
  commit?: string;
}

/** Recorded outcome of the (config-gated) registry signature check. */
export interface PluginSignatureRecord {
  verified: boolean;
  gated: boolean;
  keyid?: string;
  reason?: string;
  checkedAt: string;
}

/** One installed plugin as recorded in `.re-shell/plugins.json`. */
export interface PluginRegistryEntry {
  version: string;
  source: PluginInstallSource;
  path: string;
  installedAt: string;
  /** Set whenever the entry is rewritten by an update/reinstall. */
  updatedAt?: string;
  /** The identifier the user passed to `plugin install` (e.g. `foo@^1.2.0`). */
  spec?: string;
  /**
   * Version pin. An exact version (`1.2.3`) holds the plugin at that version, a
   * semver range (`^1.2.0`) bounds updates, a git commit SHA holds a git plugin.
   */
  pin?: string;
  git?: PluginGitRecord;
  /** npm `dist.integrity` of the installed tarball, when known. */
  integrity?: string;
  signature?: PluginSignatureRecord;
}

/** Shape of `.re-shell/plugins.json`. */
export interface PluginsFile {
  version: string;
  plugins: Record<string, PluginRegistryEntry>;
  disabled: string[];
  settings: {
    autoUpdate?: boolean;
    security?: {
      /** When true, plugin/pack signature verification is not required. */
      allowUnverified?: boolean;
      trustedSources?: string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

/** Raised when the registry file exists but cannot be read or parsed. */
export class PluginStoreError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PluginStoreError';
    this.details = details;
  }
}

/**
 * Absolute path of the registry file for a workspace.
 *
 * @param workspaceRoot - Workspace root that owns `.re-shell/`.
 */
export function pluginsFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.re-shell', 'plugins.json');
}

/** Absolute path of the directory plugins are installed into. */
export function pluginsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.re-shell', 'plugins');
}

function defaultFile(): PluginsFile {
  return {
    version: '1.0.0',
    plugins: {},
    disabled: [],
    settings: {
      autoUpdate: false,
      security: { allowUnverified: false, trustedSources: ['npm', 'builtin'] },
    },
  };
}

/**
 * Read the registry file. A missing file yields the default (empty) registry; a
 * corrupt file raises {@link PluginStoreError} instead of being overwritten.
 *
 * @param workspaceRoot - Workspace root that owns `.re-shell/plugins.json`.
 * @returns The parsed, normalized registry.
 */
export async function readPluginsFile(workspaceRoot: string): Promise<PluginsFile> {
  const file = pluginsFilePath(workspaceRoot);
  if (!(await fs.pathExists(file))) return defaultFile();

  let raw: unknown;
  try {
    raw = await fs.readJSON(file);
  } catch (error) {
    throw new PluginStoreError(
      `Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { path: file }
    );
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PluginStoreError(`${file} must contain a JSON object`, { path: file });
  }

  const data = raw as Partial<PluginsFile>;
  const base = defaultFile();
  return {
    ...base,
    ...data,
    version: typeof data.version === 'string' ? data.version : base.version,
    plugins:
      data.plugins && typeof data.plugins === 'object' && !Array.isArray(data.plugins)
        ? (data.plugins as Record<string, PluginRegistryEntry>)
        : {},
    disabled: Array.isArray(data.disabled) ? data.disabled.filter((d) => typeof d === 'string') : [],
    settings:
      data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)
        ? data.settings
        : base.settings,
  };
}

/**
 * Atomically write the registry file (temp file in the same directory, then
 * rename) so a crash mid-write can never leave a truncated plugins.json.
 *
 * @param workspaceRoot - Workspace root that owns `.re-shell/plugins.json`.
 * @param file - The full registry to persist.
 */
export async function writePluginsFile(workspaceRoot: string, file: PluginsFile): Promise<void> {
  const target = pluginsFilePath(workspaceRoot);
  await fs.ensureDir(path.dirname(target));
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeJSON(tmp, file, { spaces: 2 });
    await fs.move(tmp, target, { overwrite: true });
  } catch (error) {
    await fs.remove(tmp).catch(() => {});
    throw error;
  }
}

/**
 * Insert or replace a plugin entry. Fields managed by other commands (`pin`,
 * `installedAt`) survive a reinstall unless the new entry sets them.
 *
 * @param workspaceRoot - Workspace root.
 * @param name - Plugin package name (registry key).
 * @param entry - The new entry fields.
 * @returns The entry as persisted.
 */
export async function upsertPluginEntry(
  workspaceRoot: string,
  name: string,
  entry: Omit<PluginRegistryEntry, 'installedAt'> & { installedAt?: string }
): Promise<PluginRegistryEntry> {
  const file = await readPluginsFile(workspaceRoot);
  const previous = file.plugins[name];
  const now = new Date().toISOString();

  const next: PluginRegistryEntry = {
    ...entry,
    installedAt: entry.installedAt ?? previous?.installedAt ?? now,
    ...(previous ? { updatedAt: now } : {}),
  };
  if (next.pin === undefined && previous?.pin !== undefined) next.pin = previous.pin;

  await writePluginsFile(workspaceRoot, { ...file, plugins: { ...file.plugins, [name]: next } });
  return next;
}

/**
 * Merge fields into an existing entry (used to attach signature/integrity data
 * after an install). Returns the updated entry, or null if the plugin is not
 * recorded.
 */
export async function patchPluginEntry(
  workspaceRoot: string,
  name: string,
  patch: Partial<PluginRegistryEntry>
): Promise<PluginRegistryEntry | null> {
  const file = await readPluginsFile(workspaceRoot);
  const existing = file.plugins[name];
  if (!existing) return null;
  const next = { ...existing, ...patch };
  await writePluginsFile(workspaceRoot, { ...file, plugins: { ...file.plugins, [name]: next } });
  return next;
}

/**
 * Remove a plugin entry (and any `disabled` marker for it).
 *
 * @returns The removed entry, or null when the plugin was not recorded.
 */
export async function removePluginEntry(
  workspaceRoot: string,
  name: string
): Promise<PluginRegistryEntry | null> {
  const file = await readPluginsFile(workspaceRoot);
  const existing = file.plugins[name];
  if (!existing) return null;
  const { [name]: _removed, ...rest } = file.plugins;
  void _removed;
  await writePluginsFile(workspaceRoot, {
    ...file,
    plugins: rest,
    disabled: file.disabled.filter((d) => d !== name),
  });
  return existing;
}

/**
 * Set or clear a plugin's version pin.
 *
 * @param pin - The pin to record, or null to remove it.
 * @returns `{ previous, entry }`, or null when the plugin is not recorded.
 */
export async function setPluginPin(
  workspaceRoot: string,
  name: string,
  pin: string | null
): Promise<{ previous: string | null; entry: PluginRegistryEntry } | null> {
  const file = await readPluginsFile(workspaceRoot);
  const existing = file.plugins[name];
  if (!existing) return null;
  const { pin: previousPin, ...withoutPin } = existing;
  const next: PluginRegistryEntry = pin === null ? withoutPin : { ...withoutPin, pin };
  await writePluginsFile(workspaceRoot, { ...file, plugins: { ...file.plugins, [name]: next } });
  return { previous: previousPin ?? null, entry: next };
}

/**
 * Whether signature verification is required for this workspace, per
 * `settings.security.allowUnverified` (default: required — unverified installs
 * must be allowed explicitly).
 */
export async function isSignatureRequired(workspaceRoot: string): Promise<boolean> {
  const file = await readPluginsFile(workspaceRoot);
  return file.settings?.security?.allowUnverified !== true;
}
