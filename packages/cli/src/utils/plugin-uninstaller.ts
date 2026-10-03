import * as fs from 'fs-extra';
import * as path from 'path';
import {
  readPluginsFile,
  removePluginEntry,
  pluginsDir,
  type PluginRegistryEntry,
} from './plugin-store';
import { isValidPackageName } from './plugin-installer';
import type {
  PluginRegistry,
  PluginCommandDeregistrar,
} from './plugin-system';

/**
 * Real plugin uninstaller for `re-shell plugin uninstall`.
 *
 * Removes what the installer put on disk (`<workspace>/.re-shell/plugins/<dir>`,
 * plus an npm-style `node_modules/<name>` entry under the plugins dir when one
 * exists), the plugin's cache (and, with `purgeData`, its data directory), and
 * the `.re-shell/plugins.json` entry; and deregisters the plugin from a running
 * {@link PluginRegistry} (deactivate/unload, hooks, commands).
 *
 * Only paths the CLI manages are ever deleted. A plugin that lives anywhere else
 * (the workspace `plugins/` source folder, `node_modules`, a global install, a
 * built-in) is refused with an explanation rather than deleted.
 */

/** Machine-readable reason an uninstall was refused or failed. */
export type PluginUninstallErrorCode =
  | 'invalid-name'
  | 'not-found'
  | 'not-managed'
  | 'has-dependents'
  | 'io-error';

/** Raised for every uninstall failure; mapped to PLUGIN_UNINSTALL_ERROR / PLUGIN_NOT_FOUND. */
export class PluginUninstallError extends Error {
  readonly code: PluginUninstallErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: PluginUninstallErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PluginUninstallError';
    this.code = code;
    this.details = details;
  }
}

/** Options for {@link uninstallPluginFromWorkspace}. */
export interface PluginUninstallOptions {
  /** Workspace root that owns `.re-shell/`. */
  workspaceRoot: string;
  /**
   * An initialized registry to deregister the plugin from (deactivate, unload,
   * hooks). Optional: without it only the filesystem and plugins.json change.
   */
  registry?: PluginRegistry;
  /** Command registry whose commands for this plugin should be deregistered. */
  commandRegistry?: PluginCommandDeregistrar;
  /** Remove even when other plugins depend on it, or when the recorded path is unmanaged. */
  force?: boolean;
  /** Also delete the plugin's data directory (`.re-shell/data/<name>`). */
  purgeData?: boolean;
  /** Report what would be removed without changing anything. */
  dryRun?: boolean;
}

/** What an uninstall did (or, for a dry run, would do). */
export interface PluginUninstallResult {
  name: string;
  version: string | null;
  dryRun: boolean;
  removed: {
    /** Absolute paths deleted from disk. */
    paths: string[];
    /** True when the plugins.json entry was removed. */
    registryEntry: boolean;
  };
  /** Paths intentionally left in place. */
  kept: string[];
  deregistered: {
    unloaded: boolean;
    hooks: number;
    commands: number;
  };
  /** Non-fatal problems (e.g. a plugin whose deactivate() threw). */
  warnings: string[];
}

/** Whether `target` is strictly inside `base` (lexically). */
export function isStrictlyInside(base: string, target: string): boolean {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Names of other known plugins that declare `name` as a dependency
 * (`dependencies`, `peerDependencies` or `reshell.plugins`).
 *
 * @param registry - An initialized registry.
 * @param name - The plugin being removed.
 */
export function findPluginDependents(registry: PluginRegistry, name: string): string[] {
  const dependents: string[] = [];
  for (const plugin of registry.getManagedPlugins()) {
    const manifest = plugin.manifest;
    if (manifest.name === name) continue;
    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.reshell?.plugins ?? {}),
    ];
    if (declared.includes(name)) dependents.push(manifest.name);
  }
  return dependents.sort();
}

async function lstatOrNull(target: string): Promise<fs.Stats | null> {
  try {
    return await fs.lstat(target);
  } catch {
    return null;
  }
}

/** Remove a path (a symlink is unlinked, never followed); throws if it survives. */
async function removePath(target: string): Promise<void> {
  await fs.remove(target);
  if (await lstatOrNull(target)) {
    throw new PluginUninstallError('io-error', `Failed to remove ${target}`, { path: target });
  }
}

/** Remove a directory chain's now-empty parent (used for `@scope` folders). */
async function removeIfEmpty(dir: string): Promise<void> {
  try {
    if ((await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
  } catch {
    // Parent missing or not empty: nothing to do.
  }
}

/**
 * Uninstall a plugin from a workspace.
 *
 * @param name - Package name of the plugin (as shown by `plugin list`).
 * @param options - See {@link PluginUninstallOptions}.
 * @returns What was removed, kept and deregistered.
 * @throws {PluginUninstallError} If the plugin is unknown, not managed by the
 *   CLI, still required by another plugin, or removal fails.
 */
export async function uninstallPluginFromWorkspace(
  name: string,
  options: PluginUninstallOptions
): Promise<PluginUninstallResult> {
  const { workspaceRoot, registry, force = false, purgeData = false, dryRun = false } = options;

  if (!isValidPackageName(name)) {
    throw new PluginUninstallError('invalid-name', `"${name}" is not a valid plugin name`, { name });
  }

  const file = await readPluginsFile(workspaceRoot);
  const entry: PluginRegistryEntry | undefined = file.plugins[name];
  const discovered = registry?.getManagedPlugin(name);

  if (!entry && !discovered) {
    throw new PluginUninstallError('not-found', `Plugin '${name}' is not installed`, { name });
  }

  const managedRoot = pluginsDir(workspaceRoot);
  const pluginPath = entry?.path ?? discovered?.pluginPath;
  const version = entry?.version ?? discovered?.manifest.version ?? null;
  const warnings: string[] = [];

  // The path must be one the CLI created: strictly inside .re-shell/plugins.
  const managed = pluginPath !== undefined && isStrictlyInside(managedRoot, pluginPath);
  if (!managed && !(force && entry)) {
    throw new PluginUninstallError(
      'not-managed',
      `Plugin '${name}' is provided by ${pluginPath ?? 'an unknown location'}, which re-shell did not ` +
        `install into ${managedRoot}. Remove it with whatever installed it (for example your ` +
        `package manager), or delete the directory yourself.`,
      { name, path: pluginPath ?? null }
    );
  }

  if (registry && !force) {
    const dependents = findPluginDependents(registry, name);
    if (dependents.length > 0) {
      throw new PluginUninstallError(
        'has-dependents',
        `Plugin '${name}' is required by: ${dependents.join(', ')} (use --force to remove anyway)`,
        { name, dependents }
      );
    }
  }

  // Everything we would delete.
  const targets: string[] = [];
  const kept: string[] = [];

  if (managed && pluginPath && (await lstatOrNull(pluginPath))) targets.push(path.resolve(pluginPath));
  else if (!managed && pluginPath) kept.push(path.resolve(pluginPath));

  const npmStyleDir = path.join(managedRoot, 'node_modules', name);
  if (await lstatOrNull(npmStyleDir)) targets.push(npmStyleDir);

  const cacheDir = path.join(workspaceRoot, '.re-shell', 'cache', name);
  if (await lstatOrNull(cacheDir)) targets.push(cacheDir);

  const dataDir = path.join(workspaceRoot, '.re-shell', 'data', name);
  if (await lstatOrNull(dataDir)) {
    if (purgeData) targets.push(dataDir);
    else kept.push(dataDir);
  }

  if (dryRun) {
    return {
      name,
      version,
      dryRun: true,
      removed: { paths: targets, registryEntry: Boolean(entry) },
      kept,
      deregistered: { unloaded: false, hooks: 0, commands: 0 },
      warnings,
    };
  }

  // 1. Deregister from the running registry (deactivate/unload, hooks, commands).
  let deregistered = { unloaded: false, hooks: 0, commands: 0 };
  if (registry) {
    const removal = await registry.removePlugin(name, { commandRegistry: options.commandRegistry });
    deregistered = { unloaded: removal.unloaded, hooks: removal.hooks, commands: removal.commands };
    warnings.push(...removal.warnings);
  }

  // 2. Files. A failure here leaves plugins.json untouched so state stays consistent.
  const removedPaths: string[] = [];
  for (const target of targets) {
    try {
      await removePath(target);
      removedPaths.push(target);
    } catch (error) {
      if (error instanceof PluginUninstallError) throw error;
      throw new PluginUninstallError(
        'io-error',
        `Failed to remove ${target}: ${error instanceof Error ? error.message : String(error)}`,
        { path: target, removedSoFar: removedPaths }
      );
    }
  }
  if (name.startsWith('@')) {
    const scope = name.split('/')[0];
    await removeIfEmpty(path.join(workspaceRoot, '.re-shell', 'cache', scope));
    await removeIfEmpty(path.join(workspaceRoot, '.re-shell', 'data', scope));
    await removeIfEmpty(path.join(managedRoot, 'node_modules', scope));
  }

  // 3. The registry entry.
  let registryEntry = false;
  try {
    registryEntry = (await removePluginEntry(workspaceRoot, name)) !== null;
  } catch (error) {
    throw new PluginUninstallError(
      'io-error',
      `Plugin files were removed but plugins.json could not be updated: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { name, removed: removedPaths }
    );
  }

  return {
    name,
    version,
    dryRun: false,
    removed: { paths: removedPaths, registryEntry },
    kept,
    deregistered,
    warnings,
  };
}
