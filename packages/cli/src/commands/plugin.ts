import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Command } from 'commander';
import type {
  PluginInfoResponse,
  PluginListItem,
  PluginOrigin,
  PluginQuality,
  PluginReview,
  PluginValidateResponse,
} from '@re-shell/contracts';

import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import {
  PluginDiscoveryOptions,
  PluginRegistration,
  createPluginRegistry
} from '../utils/plugin-system';
import { PluginState, ManagedPluginRegistration } from '../utils/plugin-lifecycle';
import { HookType, HookHandler } from '../utils/plugin-hooks';
import {
  installPluginFromIdentifier,
  PluginInstallError,
} from '../utils/plugin-installer';
import {
  readPluginsFile,
  pluginsDir,
  PluginStoreError,
  type PluginRegistryEntry,
} from '../utils/plugin-store';
import {
  uninstallPluginFromWorkspace,
  PluginUninstallError,
  isStrictlyInside,
} from '../utils/plugin-uninstaller';
import {
  updateInstalledPlugins,
  pinInstalledPlugin,
  unpinInstalledPlugin,
  PluginUpdateInputError,
} from '../utils/plugin-updater';
import { resolveVerifyPolicy } from '../utils/plugin-signature';
import {
  validatePluginPath,
  PluginValidationInputError,
} from '../utils/plugin-validator';
import {
  addReview,
  listReviews,
  readReviewAggregates,
  aggregateReviews,
  PluginReviewError,
  REVIEWS_RELATIVE_PATH,
} from '../utils/plugin-reviews';
import { fetchPluginQuality, qualityCachePath } from '../utils/plugin-ratings';
import { createPluginCommandRegistry } from '../utils/plugin-command-registry';
import type { FetchLike } from '../utils/registry-client';
import { ok, fail, emitJson, enableJsonMode } from '../utils/json-output';

/**
 * Options for the `re-shell plugin` command.
 */
interface PluginCommandOptions {
  verbose?: boolean;
  json?: boolean;
  source?: string;
  includeDisabled?: boolean;
  includeDev?: boolean;
  global?: boolean;
  local?: boolean;
  force?: boolean;
  dryRun?: boolean;
  timeout?: number;
  /** Workspace root (defaults to `process.cwd()`); programmatic only, not a CLI flag. */
  cwd?: string;
  /** Record a version pin on install. */
  pin?: boolean;
  /** npm registry URL for install/update/validate. */
  registry?: string;
  /** `--verify` / `--no-verify`; undefined defers to the workspace security setting. */
  verify?: boolean;
  /** Update: report only, change nothing. */
  check?: boolean;
  /** Uninstall: also delete the plugin's data directory. */
  purge?: boolean;
  /** Validate: treat warnings as failures. */
  strict?: boolean;
  /** Validate: resolve locally-missing dependencies against the npm registry. */
  checkRegistry?: boolean;
  /** Info: do not hit the network for quality data (cache only). */
  offline?: boolean;
  /** Review: 1-5 rating (string from the command line). */
  rating?: string | number;
  /** Review: free-text comment. */
  comment?: string;
  /** Review: author identity (default: git user). */
  author?: string;
  /** Injected fetch (tests). */
  fetchImpl?: FetchLike;
}

/** Workspace root for a command invocation. */
function rootOf(options: { cwd?: string }): string {
  return options.cwd ?? process.cwd();
}

/**
 * Report a failure in the right mode: a JSON envelope with a non-zero exit in
 * `--json` mode, otherwise a ValidationError the command wrapper turns into a
 * non-zero exit.
 */
function failCommand(
  json: boolean,
  code: Parameters<typeof fail>[0],
  message: string,
  details?: Record<string, unknown>,
  humanPrefix?: string
): void {
  if (json) {
    fail(code, message, details);
    return;
  }
  throw new ValidationError(humanPrefix ? `${humanPrefix}: ${message}` : message);
}

// Main plugin management function
/**
 * Where an installed plugin came from: the recorded install source when the CLI
 * installed it, otherwise inferred from where it lives on disk.
 */
function originOf(
  plugin: { pluginPath: string },
  entry: PluginRegistryEntry | undefined,
  root: string
): PluginOrigin {
  if (entry) return entry.source;
  if (isStrictlyInside(path.join(root, 'node_modules'), plugin.pluginPath)) return 'node_modules';
  if (
    isStrictlyInside(pluginsDir(root), plugin.pluginPath) ||
    isStrictlyInside(path.join(root, 'plugins'), plugin.pluginPath)
  ) {
    return 'workspace';
  }
  if (isStrictlyInside(path.join(__dirname, '..', 'plugins'), plugin.pluginPath)) return 'builtin';
  return 'global';
}

function toListItem(
  plugin: ManagedPluginRegistration,
  entry: PluginRegistryEntry | undefined,
  root: string,
  reviews: Map<string, ReturnType<typeof aggregateReviews>>
): PluginListItem {
  return {
    name: plugin.manifest.name,
    version: plugin.manifest.version,
    description: plugin.manifest.description ?? '',
    path: plugin.pluginPath,
    origin: originOf(plugin, entry, root),
    state: plugin.state,
    isLoaded: plugin.isLoaded,
    isActive: plugin.isActive,
    usageCount: plugin.usageCount,
    pin: entry?.pin ?? null,
    installedAt: entry?.installedAt ?? null,
    managed: entry !== undefined,
    reviews: reviews.get(plugin.manifest.name) ?? aggregateReviews([]),
  };
}

/**
 * Lists all installed plugins managed by the registry.
 *
 * Initializes the plugin registry and displays the managed plugins. With
 * `--json` emits the standard envelope (`{ ok, data: { plugins, total }, warnings }`).
 *
 * @param options - Options controlling output format and verbosity
 * @returns Promise that resolves when the plugin list has been displayed
 */
export async function managePlugins(options: PluginCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;
  const root = rootOf(options);
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const registry = createPluginRegistry(root);

    const spinner = json ? undefined : createSpinner('Initializing plugin registry...');
    if (spinner) spinner.start();

    await registry.initialize();

    if (spinner) spinner.stop();

    const plugins = registry.getManagedPlugins();
    const file = await readPluginsFile(root);
    const warnings: string[] = [];

    let reviews = new Map<string, ReturnType<typeof aggregateReviews>>();
    try {
      reviews = await readReviewAggregates(root);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }

    const known = new Set(plugins.map(p => p.manifest.name));
    for (const [name, entry] of Object.entries(file.plugins)) {
      if (!known.has(name)) {
        warnings.push(
          `plugins.json lists '${name}' but no plugin was found at ${entry.path}; ` +
            `run 're-shell plugin install' again or 're-shell plugin uninstall ${name} --force' to clean up`
        );
      }
    }

    const items = plugins.map(p => toListItem(p, file.plugins[p.manifest.name], root, reviews));

    if (json) {
      ok({ plugins: items, total: items.length }, warnings);
      return;
    }

    warnings.forEach(w => console.log(chalk.yellow(`⚠ ${w}`)));

    if (plugins.length === 0) {
      console.log(chalk.yellow('No plugins found.'));
      console.log(chalk.gray('Run "re-shell plugin discover" to search for available plugins.'));
      return;
    }

    console.log(chalk.cyan(`\n🔌 Installed Plugins (${plugins.length})\n`));

    displayPluginList(plugins, verbose, items);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      fail('PLUGIN_LIST_ERROR', message);
      return;
    }
    throw new ValidationError(`Plugin management failed: ${message}`);
  } finally {
    restoreJson();
  }
}

// Discover available plugins
/**
 * Discovers available plugins from local, npm, and built-in sources.
 *
 * @param options - Options controlling discovery sources, timeouts, and output format
 * @returns Promise that resolves when discovery results have been displayed
 */
export async function discoverPlugins(options: PluginCommandOptions = {}): Promise<void> {
  const { 
    verbose = false, 
    json = false, 
    source, 
    includeDisabled = false, 
    includeDev = true,
    timeout = 10000
  } = options;

  try {
    const registry = createPluginRegistry();
    
    const discoveryOptions: PluginDiscoveryOptions = {
      sources: source ? [source as PluginDiscoveryOptions['sources'][number]] : ['local', 'npm', 'builtin'],
      includeDisabled,
      includeDev,
      timeout,
      useCache: false // Always fresh discovery
    };

    const spinner = createSpinner('Discovering plugins...');
    spinner.start();
    
    const result = await registry.discoverPlugins(discoveryOptions);
    
    spinner.stop();

    if (json) {
      ok(result);
      return;
    }

    console.log(chalk.cyan(`\n🔍 Plugin Discovery Results\n`));
    
    if (result.found.length > 0) {
      console.log(chalk.green(`Found ${result.found.length} plugins:\n`));
      displayDiscoveredPluginList(result.found, verbose);
    } else {
      console.log(chalk.yellow('No plugins found.'));
    }

    if (result.errors.length > 0) {
      console.log(chalk.red(`\n❌ Errors (${result.errors.length}):\n`));
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${chalk.red(error.path)}: ${error.error.message}`);
      });
    }

    if (result.skipped.length > 0 && verbose) {
      console.log(chalk.yellow(`\n⏭️  Skipped (${result.skipped.length}):\n`));
      result.skipped.forEach((skipped, index) => {
        console.log(`${index + 1}. ${chalk.gray(skipped.path)}: ${skipped.reason}`);
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Plugin discovery failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Install a plugin
//
// Real installer: resolves the identifier from a local path/dir, a git URL, or
// an npm package name; validates the plugin manifest (scope-aware, recognizing
// the @re-shell/* scope); copies it into
// <workspace>/.re-shell/plugins/<name>; and registers it in plugins.json.
// Supports --json and --dry-run (resolve + validate, no writes).
/**
 * Installs a plugin from a local path, git URL, or npm package identifier.
 *
 * Resolves and validates the plugin manifest, copies it into the workspace
 * plugins directory, and registers it. Supports dry runs for validation only.
 *
 * @param pluginIdentifier - Local path, git URL, or npm package name of the plugin
 * @param options - Options controlling dry-run, force, JSON output, and verbosity
 * @returns Promise that resolves when the plugin has been installed
 */
export async function installPlugin(
  pluginIdentifier: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, force = false, dryRun = false, json = false } = options;
  const restoreJson = json ? (await import('../utils/json-output')).enableJsonMode() : () => {};

  try {
    const spinner = json
      ? undefined
      : createSpinner(`${dryRun ? 'Resolving' : 'Installing'} plugin ${pluginIdentifier}...`);
    if (spinner) spinner.start();

    const result = await installPluginFromIdentifier(pluginIdentifier, {
      workspaceRoot: rootOf(options),
      dryRun,
      force,
      ...(options.pin ? { pin: true } : {}),
      ...(options.registry ? { registry: options.registry } : {}),
    });

    if (spinner) {
      spinner.succeed(
        chalk.green(
          dryRun
            ? `Plugin ${result.name}@${result.version} resolved and validated (dry run)`
            : `Plugin ${result.name}@${result.version} installed successfully!`
        )
      );
    }

    if (json) {
      ok({
        name: result.name,
        version: result.version,
        source: result.source,
        path: result.path,
        dryRun: result.dryRun,
        ...(result.pin ? { pin: result.pin } : {}),
      });
      return;
    }

    if (verbose) {
      console.log(chalk.gray(`Source: ${result.source}`));
      console.log(chalk.gray(`Location: ${result.path}`));
    }
    if (result.pin) {
      console.log(chalk.gray(`Pinned: ${result.pin}`));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details =
      error instanceof PluginInstallError && error.details ? error.details : undefined;

    if (json) {
      fail('PLUGIN_INSTALL_ERROR', message, details);
      return;
    }

    throw new ValidationError(`Plugin installation failed: ${message}`);
  } finally {
    restoreJson();
  }
}

// Uninstall a plugin
/**
 * Uninstalls a plugin from the workspace.
 *
 * Deactivates and unloads it (calling the plugin's own `deactivate()`),
 * deregisters its hooks and commands, deletes its files under
 * `.re-shell/plugins` (plus its cache; its data directory only with `--purge`)
 * and removes its `plugins.json` entry. Reports exactly what was removed and
 * what was kept. An unknown plugin, or one that was not installed by the CLI
 * (e.g. provided by node_modules), is a failure with a non-zero exit.
 *
 * @param pluginName - Name of the plugin to uninstall
 * @param options - `force` (skip the prompt, ignore dependents), `purge` (also
 *   delete plugin data), `dryRun`, `json`, `verbose`
 * @returns Promise that resolves when the plugin has been uninstalled
 */
export async function uninstallPlugin(
  pluginName: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, force = false, json = false, dryRun = false, purge = false } = options;
  const root = rootOf(options);
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const registry = createPluginRegistry(root);
    await registry.initialize();

    const target = registry.getManagedPlugin(pluginName);
    const entry = (await readPluginsFile(root)).plugins[pluginName];
    if (!target && !entry) {
      failCommand(json, 'PLUGIN_NOT_FOUND', `Plugin '${pluginName}' is not installed`, { name: pluginName });
      return;
    }

    // Only ask when a human is at the keyboard; scripts and --json callers are explicit.
    if (!force && !json && !dryRun && process.stdin.isTTY && process.stdout.isTTY) {
      const { default: prompts } = await import('prompts');
      const answer = await prompts({
        type: 'confirm',
        name: 'confirmed',
        message: `Uninstall '${pluginName}'? This deletes its files from ${pluginsDir(root)}.`,
        initial: false,
      });
      if (!answer.confirmed) {
        console.log(chalk.yellow(`Uninstall of '${pluginName}' cancelled.`));
        return;
      }
    }

    const spinner = json ? undefined : createSpinner(`Uninstalling plugin ${pluginName}...`);
    if (spinner) spinner.start();

    const result = await uninstallPluginFromWorkspace(pluginName, {
      workspaceRoot: root,
      registry,
      commandRegistry: createPluginCommandRegistry(new Command()),
      force,
      purgeData: purge,
      dryRun,
    });

    if (spinner) {
      spinner.succeed(
        chalk.green(
          dryRun
            ? `Plugin ${pluginName} would be uninstalled (dry run)`
            : `Plugin ${pluginName} uninstalled successfully!`
        )
      );
    }

    if (json) {
      const { warnings, ...data } = result;
      ok(data, warnings);
      return;
    }

    const removedLabel = dryRun ? 'Would remove' : 'Removed';
    result.removed.paths.forEach(p => console.log(chalk.gray(`${removedLabel}: ${p}`)));
    if (result.removed.registryEntry) {
      console.log(chalk.gray(`${removedLabel}: plugins.json entry for ${pluginName}`));
    }
    result.kept.forEach(p => console.log(chalk.gray(`Kept: ${p}${p.includes(`${path.sep}data${path.sep}`) ? ' (use --purge to delete)' : ''}`)));
    if (!dryRun && (verbose || result.deregistered.hooks > 0 || result.deregistered.commands > 0)) {
      console.log(
        chalk.gray(
          `Deregistered: ${result.deregistered.hooks} hook(s), ${result.deregistered.commands} command(s)` +
            (result.deregistered.unloaded ? ', plugin unloaded' : '')
        )
      );
    }
    result.warnings.forEach(w => console.log(chalk.yellow(`⚠ ${w}`)));

  } catch (error) {
    if (error instanceof PluginUninstallError) {
      failCommand(
        json,
        error.code === 'not-found' ? 'PLUGIN_NOT_FOUND' : 'PLUGIN_UNINSTALL_ERROR',
        error.message,
        { reason: error.code, ...(error.details ?? {}) },
        'Plugin uninstallation failed'
      );
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    failCommand(json, 'PLUGIN_UNINSTALL_ERROR', message, undefined, 'Plugin uninstallation failed');
  } finally {
    restoreJson();
  }
}

// Show plugin information
/**
 * Displays detailed information about a single installed plugin: manifest,
 * install provenance (source, pin, recorded signature), lifecycle state, team
 * reviews and - for registry plugins - real quality data from npms.io / npm.
 * With `--json` emits the standard envelope.
 *
 * @param pluginName - Name of the plugin to inspect
 * @param options - Options controlling JSON output, verbosity and `offline`
 * @returns Promise that resolves when the plugin details have been displayed
 */
export async function showPluginInfo(
  pluginName: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, offline = false } = options;
  const root = rootOf(options);
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const registry = createPluginRegistry(root);
    await registry.initialize();

    const plugin = registry.getManagedPlugin(pluginName);
    if (!plugin) {
      failCommand(json, 'PLUGIN_NOT_FOUND', `Plugin '${pluginName}' not found`, { name: pluginName });
      return;
    }

    const file = await readPluginsFile(root);
    const entry = file.plugins[pluginName];
    const warnings: string[] = [];

    let reviewData: Awaited<ReturnType<typeof listReviews>> = { reviews: [], aggregate: aggregateReviews([]) };
    try {
      reviewData = await listReviews(root, pluginName);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }

    const origin = originOf(plugin, entry, root);
    let quality: PluginQuality | null = null;
    // Only packages that really came from the npm registry have registry quality data.
    if (entry?.source === 'npm' || origin === 'node_modules') {
      quality = await fetchPluginQuality(pluginName, {
        fetchImpl: options.fetchImpl,
        cacheFile: qualityCachePath(root),
        offline,
      });
      if (quality.source === 'unavailable') {
        warnings.push(`Quality data unavailable: ${quality.error ?? 'unknown error'}`);
      } else if (quality.stale) {
        warnings.push('Quality data is from an expired cache entry (the registry could not be reached)');
      }
    }

    const manifest = plugin.manifest;
    const info: PluginInfoResponse = {
      ...toListItem(plugin, entry, root, new Map([[pluginName, reviewData.aggregate]])),
      manifest: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description ?? '',
        main: manifest.main,
        author: typeof manifest.author === 'string' ? manifest.author : null,
        license: manifest.license ?? null,
        homepage: manifest.homepage ?? null,
        keywords: manifest.keywords ?? [],
        engines: (manifest.engines as Record<string, string> | undefined) ?? null,
        dependencies: manifest.dependencies ?? null,
        peerDependencies: manifest.peerDependencies ?? null,
        reshell: manifest.reshell ?? null,
      },
      install: entry
        ? {
            source: entry.source,
            spec: entry.spec ?? null,
            installedAt: entry.installedAt,
            updatedAt: entry.updatedAt ?? null,
            git: entry.git
              ? { url: entry.git.url, ref: entry.git.ref ?? null, commit: entry.git.commit ?? null }
              : null,
            integrity: entry.integrity ?? null,
            signature: entry.signature
              ? {
                  verified: entry.signature.verified,
                  gated: entry.signature.gated,
                  ...(entry.signature.keyid ? { keyid: entry.signature.keyid } : {}),
                  ...(entry.signature.reason ? { reason: entry.signature.reason } : {}),
                }
              : null,
          }
        : null,
      lifecycle: {
        lastUsed: plugin.lastUsed ?? null,
        loadMs: plugin.performance.loadDuration,
        initMs: plugin.performance.initDuration,
        activationMs: plugin.performance.activationDuration,
        errors: plugin.errors.map(e => ({
          stage: e.stage,
          message: e.error.message,
          timestamp: e.timestamp,
        })),
      },
      dependencies: plugin.dependencies.map(d => ({
        name: d.name,
        version: d.version,
        required: d.required,
        resolved: d.resolved,
      })),
      dependents: plugin.dependents,
      recentReviews: reviewData.reviews.slice(0, 5),
      quality,
    };

    if (json) {
      ok(info, warnings);
      return;
    }

    warnings.forEach(w => console.log(chalk.yellow(`⚠ ${w}`)));
    console.log(chalk.cyan(`\n📦 ${plugin.manifest.name} v${plugin.manifest.version}\n`));

    displayPluginDetails(plugin, verbose, info);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failCommand(json, 'PLUGIN_INFO_ERROR', message, undefined, 'Failed to show plugin info');
  } finally {
    restoreJson();
  }
}

// Enable a plugin
/**
 * Enables a plugin by loading, initializing, and activating it.
 *
 * Progresses the plugin through its lifecycle states until it is active.
 *
 * @param pluginName - Name of the plugin to enable
 * @param options - Options controlling verbosity of lifecycle output
 * @returns Promise that resolves when the plugin is active
 */
export async function enablePlugin(
  pluginName: string, 
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugin = registry.getManagedPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    const spinner = createSpinner(`Enabling plugin ${pluginName}...`);
    spinner.start();

    // Load plugin if not loaded
    if (plugin.state === PluginState.UNLOADED) {
      await registry.loadPlugin(pluginName);
    }

    // Initialize plugin if not initialized
    if (plugin.state === PluginState.LOADED) {
      await registry.initializePlugin(pluginName);
    }

    // Activate plugin if not active
    if (plugin.state === PluginState.INITIALIZED) {
      await registry.activatePlugin(pluginName);
    }

    spinner.succeed(chalk.green(`Plugin ${pluginName} enabled successfully!`));

    if (verbose) {
      console.log(chalk.gray(`Plugin state: ${plugin.state}`));
      console.log(chalk.gray(`Load time: ${plugin.performance.loadDuration}ms`));
      console.log(chalk.gray(`Init time: ${plugin.performance.initDuration}ms`));
      console.log(chalk.gray(`Activation time: ${plugin.performance.activationDuration}ms`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to enable plugin: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Disable a plugin
/**
 * Disables an active plugin by deactivating it.
 *
 * @param pluginName - Name of the plugin to disable
 * @param options - Options controlling verbosity
 * @returns Promise that resolves when the plugin has been deactivated
 */
export async function disablePlugin(
  pluginName: string, 
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugin = registry.getManagedPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    if (plugin.state !== PluginState.ACTIVE) {
      console.log(chalk.yellow(`Plugin ${pluginName} is not active (current state: ${plugin.state})`));
      return;
    }

    const spinner = createSpinner(`Disabling plugin ${pluginName}...`);
    spinner.start();

    await registry.deactivatePlugin(pluginName);

    spinner.succeed(chalk.yellow(`Plugin ${pluginName} disabled successfully!`));

    if (verbose) {
      console.log(chalk.gray(`Plugin state: ${plugin.state}`));
      console.log(chalk.gray(`Dependencies: ${plugin.dependents.join(', ') || 'none'}`));
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to disable plugin: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Update plugins
/**
 * Checks for and applies plugin updates.
 *
 * npm plugins query the registry (dist-tags + versions) and respect a stored pin
 * (an exact version holds the plugin; a range bounds the update); git plugins
 * compare the recorded commit with the remote ref; local plugins are reported as
 * not updatable. Updates reinstall through the installer, with signature
 * verification when configured (`--verify` / `--no-verify`, else the workspace
 * `allowUnverified` setting). `--check` only reports. Any failed plugin makes the
 * command exit non-zero.
 *
 * @param name - Optional plugin to update; all installed plugins when omitted
 * @param options - `check`, `verify`, `registry`, `json`, `verbose`
 * @returns Promise that resolves when all updates have been checked/applied
 */
export async function updatePlugins(
  name?: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { json = false, check = false, verbose = false } = options;
  const root = rootOf(options);
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const verifySignatures = await resolveVerifyPolicy(root, options.verify);
    const spinner = json
      ? undefined
      : createSpinner(check ? 'Checking for plugin updates...' : 'Updating plugins...');
    if (spinner) spinner.start();

    const result = await updateInstalledPlugins({
      workspaceRoot: root,
      names: name ? [name] : [],
      checkOnly: check,
      verifySignatures,
      registryUrl: options.registry,
      fetchImpl: options.fetchImpl,
    });
    if (spinner) spinner.stop();

    const failures = result.plugins.filter(p => p.status === 'failed');
    if (failures.length > 0) {
      const message = `${failures.length} plugin update(s) failed: ${failures
        .map(f => `${f.name} (${f.message ?? 'unknown error'})`)
        .join('; ')}`;
      if (json) {
        fail('PLUGIN_UPDATE_ERROR', message, result as unknown as Record<string, unknown>);
        return;
      }
      displayUpdateResult(result, verbose);
      throw new ValidationError(message);
    }

    if (json) {
      ok(result);
      return;
    }
    displayUpdateResult(result, verbose);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error instanceof PluginUpdateInputError) {
      failCommand(json, 'PLUGIN_NOT_FOUND', error.message, error.details, 'Plugin update failed');
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    failCommand(json, 'PLUGIN_UPDATE_ERROR', message, undefined, 'Plugin update failed');
  } finally {
    restoreJson();
  }
}

/** Human-readable rendering of an update run. */
function displayUpdateResult(
  result: Awaited<ReturnType<typeof updateInstalledPlugins>>,
  verbose: boolean
): void {
  if (result.plugins.length === 0) {
    console.log(chalk.yellow('No plugins installed.'));
    return;
  }
  console.log(chalk.cyan(result.checkOnly ? '\n🔄 Plugin update check\n' : '\n🔄 Plugin updates\n'));
  for (const p of result.plugins) {
    const label =
      p.status === 'updated' ? chalk.green('updated') :
      p.status === 'update-available' ? chalk.yellow('update available') :
      p.status === 'up-to-date' ? chalk.green('up to date') :
      p.status === 'pinned' ? chalk.blue('pinned') :
      p.status === 'not-updatable' ? chalk.gray('not updatable') :
      chalk.red('failed');
    const versions = p.target && p.target !== p.installed ? ` ${p.installed} -> ${p.target}` : ` ${p.installed}`;
    console.log(`${chalk.white(p.name)}${versions}  ${label}`);
    if (p.message && (verbose || p.status === 'failed' || p.status === 'pinned' || p.status === 'not-updatable')) {
      console.log(chalk.gray(`  ${p.message}`));
    }
    if (p.signature?.gated && (verbose || !p.signature.verified)) {
      console.log(chalk.gray(`  signature: ${p.signature.verified ? 'verified' : `NOT verified (${p.signature.reason ?? 'unknown'})`}`));
    }
  }
  const s = result.summary;
  console.log(
    chalk.gray(
      `\n${s.total} plugin(s): ${s.updated} updated, ${s.updateAvailable} update(s) available, ` +
        `${s.upToDate} up to date, ${s.pinned} pinned, ${s.notUpdatable} not updatable, ${s.failed} failed`
    )
  );
}

// Pin / unpin a plugin version
/**
 * Pins an installed plugin: an exact version holds it there, a semver range
 * bounds `plugin update`. With no version, pins what is installed now.
 *
 * @param pluginName - Installed plugin
 * @param version - Exact version or semver range (git plugins: a commit/ref)
 * @param options - `json`
 */
export async function pinPlugin(
  pluginName: string,
  version?: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { json = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};
  try {
    const result = await pinInstalledPlugin(rootOf(options), pluginName, version);
    if (json) {
      ok(result);
      return;
    }
    console.log(chalk.green(`Pinned ${result.name} to ${result.pin}`));
    if (result.previousPin) console.log(chalk.gray(`Previous pin: ${result.previousPin}`));
  } catch (error) {
    reportPinError(error, json);
  } finally {
    restoreJson();
  }
}

/**
 * Removes a plugin's version pin.
 *
 * @param pluginName - Installed plugin
 * @param options - `json`
 */
export async function unpinPlugin(
  pluginName: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { json = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};
  try {
    const result = await unpinInstalledPlugin(rootOf(options), pluginName);
    if (json) {
      ok(result);
      return;
    }
    console.log(
      result.previousPin
        ? chalk.green(`Unpinned ${result.name} (was ${result.previousPin})`)
        : chalk.yellow(`${result.name} had no pin`)
    );
  } catch (error) {
    reportPinError(error, json);
  } finally {
    restoreJson();
  }
}

function reportPinError(error: unknown, json: boolean): void {
  if (error instanceof PluginUpdateInputError) {
    const notFound = error.details?.reason === 'not-found';
    failCommand(json, notFound ? 'PLUGIN_NOT_FOUND' : 'PLUGIN_PIN_ERROR', error.message, error.details, 'Pin failed');
    return;
  }
  failCommand(
    json,
    'PLUGIN_PIN_ERROR',
    error instanceof Error ? error.message : String(error),
    undefined,
    'Pin failed'
  );
}

// Team reviews
/**
 * Adds (or replaces, for the same author) a team review of a plugin in
 * `.re-shell/plugin-reviews.json`, which is meant to be committed and shared.
 *
 * @param pluginName - Plugin being reviewed
 * @param options - `rating` (1-5, required), `comment`, `author`, `json`
 */
export async function addPluginReview(
  pluginName: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { json = false } = options;
  const root = rootOf(options);
  const restoreJson = json ? enableJsonMode() : () => {};
  try {
    const rating = typeof options.rating === 'number' ? options.rating : Number(options.rating);
    const entry = (await readPluginsFile(root)).plugins[pluginName];
    const result = await addReview(root, {
      plugin: pluginName,
      rating,
      comment: options.comment,
      author: options.author,
      version: entry?.version ?? null,
    });
    if (json) {
      ok({ ...result, file: REVIEWS_RELATIVE_PATH });
      return;
    }
    console.log(
      chalk.green(
        `${result.updated ? 'Updated' : 'Added'} review for ${pluginName}: ${result.review.rating}/5 by ${result.review.author}`
      )
    );
    console.log(
      chalk.gray(
        `Team rating: ${result.aggregate.average}/5 from ${result.aggregate.count} review(s). ` +
          `Commit ${REVIEWS_RELATIVE_PATH} to share it.`
      )
    );
  } catch (error) {
    failCommand(
      json,
      'PLUGIN_REVIEW_ERROR',
      error instanceof Error ? error.message : String(error),
      error instanceof PluginReviewError ? error.details : undefined,
      'Review failed'
    );
  } finally {
    restoreJson();
  }
}

/**
 * Lists the team reviews for a plugin with their aggregate.
 *
 * @param pluginName - Plugin to list reviews for
 * @param options - `json`
 */
export async function listPluginReviews(
  pluginName: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { json = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};
  try {
    const { reviews, aggregate } = await listReviews(rootOf(options), pluginName);
    if (json) {
      ok({ plugin: pluginName, reviews, aggregate });
      return;
    }
    if (reviews.length === 0) {
      console.log(chalk.yellow(`No team reviews for ${pluginName}.`));
      return;
    }
    console.log(chalk.cyan(`\n⭐ ${pluginName}: ${aggregate.average}/5 (${aggregate.count} review(s))\n`));
    reviews.forEach((r: PluginReview) => {
      console.log(
        `${chalk.yellow('★'.repeat(r.rating) + '☆'.repeat(5 - r.rating))} ${chalk.white(r.author)}` +
          `${r.version ? chalk.gray(` (v${r.version})`) : ''} ${chalk.gray((r.updatedAt ?? r.createdAt).slice(0, 10))}`
      );
      if (r.comment) console.log(`  ${r.comment}`);
    });
  } catch (error) {
    failCommand(
      json,
      'PLUGIN_REVIEW_ERROR',
      error instanceof Error ? error.message : String(error),
      error instanceof PluginReviewError ? error.details : undefined,
      'Review failed'
    );
  } finally {
    restoreJson();
  }
}

// Display discovered plugin list (without lifecycle info)
function displayDiscoveredPluginList(plugins: PluginRegistration[], verbose: boolean): void {
  plugins.forEach((plugin, index) => {
    const status = plugin.isActive ? chalk.green('●') : plugin.isLoaded ? chalk.yellow('●') : chalk.gray('●');
    const statusText = plugin.isActive ? 'active' : plugin.isLoaded ? 'loaded' : 'inactive';
    
    console.log(`${status} ${chalk.white(plugin.manifest.name)} ${chalk.gray(`v${plugin.manifest.version}`)}`);
    console.log(`  ${chalk.gray(plugin.manifest.description)}`);
    
    if (verbose) {
      console.log(`  ${chalk.gray(`Path: ${plugin.pluginPath}`)}`);
      console.log(`  ${chalk.gray(`Status: ${statusText}`)}`);
      if (plugin.usageCount > 0) {
        console.log(`  ${chalk.gray(`Usage: ${plugin.usageCount} times`)}`);
      }
    }
    
    if (index < plugins.length - 1) {
      console.log('');
    }
  });
}

// Display plugin list with lifecycle info
function displayPluginList(
  plugins: ManagedPluginRegistration[],
  verbose: boolean,
  items: PluginListItem[] = []
): void {
  plugins.forEach((plugin, index) => {
    const item = items.find(i => i.name === plugin.manifest.name);
    const status = plugin.state === PluginState.ACTIVE ? chalk.green('●') : 
                   plugin.state === PluginState.LOADED || plugin.state === PluginState.INITIALIZED ? chalk.yellow('●') : 
                   chalk.gray('●');
    const statusText = plugin.state;
    
    const pinText = item?.pin ? chalk.blue(` [pinned ${item.pin}]`) : '';
    console.log(`${status} ${chalk.white(plugin.manifest.name)} ${chalk.gray(`v${plugin.manifest.version}`)}${pinText}`);
    console.log(`  ${chalk.gray(plugin.manifest.description)}`);
    
    if (verbose) {
      console.log(`  ${chalk.gray(`Path: ${plugin.pluginPath}`)}`);
      console.log(`  ${chalk.gray(`Status: ${statusText}`)}`);
      if (item) {
        console.log(`  ${chalk.gray(`Origin: ${item.origin}`)}`);
        if (item.reviews.count > 0) {
          console.log(`  ${chalk.gray(`Team rating: ${item.reviews.average}/5 (${item.reviews.count})`)}`);
        }
      }
      if (plugin.usageCount > 0) {
        console.log(`  ${chalk.gray(`Usage: ${plugin.usageCount} times`)}`);
      }
    }
    
    if (index < plugins.length - 1) {
      console.log('');
    }
  });
}

// Display detailed plugin information
function displayPluginDetails(
  plugin: ManagedPluginRegistration,
  verbose: boolean,
  info?: PluginInfoResponse
): void {
  const manifest = plugin.manifest;
  
  console.log(chalk.yellow('Description:'));
  console.log(`  ${manifest.description}\n`);
  
  if (manifest.author) {
    console.log(chalk.yellow('Author:'));
    console.log(`  ${manifest.author}\n`);
  }
  
  console.log(chalk.yellow('Version:'));
  console.log(`  ${manifest.version}\n`);
  
  if (manifest.license) {
    console.log(chalk.yellow('License:'));
    console.log(`  ${manifest.license}\n`);
  }
  
  if (manifest.homepage) {
    console.log(chalk.yellow('Homepage:'));
    console.log(`  ${manifest.homepage}\n`);
  }
  
  if (manifest.keywords && manifest.keywords.length > 0) {
    console.log(chalk.yellow('Keywords:'));
    console.log(`  ${manifest.keywords.join(', ')}\n`);
  }
  
  console.log(chalk.yellow('Installation:'));
  console.log(`  Path: ${plugin.pluginPath}`);
  console.log(`  State: ${plugin.state}`);
  console.log(`  Status: ${plugin.isActive ? 'Active' : plugin.isLoaded ? 'Loaded' : 'Inactive'}`);
  if (info) {
    console.log(`  Origin: ${info.origin}`);
    if (info.pin) console.log(`  Pinned: ${info.pin}`);
    if (info.install?.installedAt) console.log(`  Installed: ${new Date(info.install.installedAt).toLocaleString()}`);
    if (info.install?.git?.commit) console.log(`  Commit: ${info.install.git.commit}`);
    if (info.install?.signature) {
      console.log(
        `  Signature: ${
          info.install.signature.verified
            ? 'verified'
            : info.install.signature.gated
              ? 'NOT verified'
              : 'not checked (verification disabled)'
        }`
      );
    }
  }
  
  if (plugin.usageCount > 0) {
    console.log(`  Usage Count: ${plugin.usageCount}`);
  }
  
  if (plugin.lastUsed) {
    console.log(`  Last Used: ${new Date(plugin.lastUsed).toLocaleString()}`);
  }

  console.log(`\n${chalk.yellow('Lifecycle:')}`);
  console.log(`  Load Time: ${plugin.performance.loadDuration}ms`);
  console.log(`  Init Time: ${plugin.performance.initDuration}ms`);
  console.log(`  Activation Time: ${plugin.performance.activationDuration}ms`);
  
  if (plugin.dependencies.length > 0) {
    console.log(`\n${chalk.yellow('Dependencies:')}`);
    plugin.dependencies.forEach(dep => {
      const status = dep.resolved ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${dep.name} (${dep.version}) ${dep.required ? '' : '(optional)'}`);
    });
  }
  
  if (plugin.dependents.length > 0) {
    console.log(`\n${chalk.yellow('Dependents:')}`);
    plugin.dependents.forEach(dep => {
      console.log(`  - ${dep}`);
    });
  }
  
  if (plugin.errors.length > 0) {
    console.log(`\n${chalk.red('Recent Errors:')}`);
    plugin.errors.slice(-3).forEach((error, index) => {
      console.log(`  ${index + 1}. [${error.stage}] ${error.error.message}`);
      console.log(`     ${chalk.gray(new Date(error.timestamp).toLocaleString())}`);
    });
  }
  
  if (info) {
    console.log(`\n${chalk.yellow('Team reviews:')}`);
    if (info.reviews.count === 0) {
      console.log('  none (add one with `re-shell plugin review add`)');
    } else {
      console.log(`  ${info.reviews.average}/5 from ${info.reviews.count} review(s)`);
      info.recentReviews.slice(0, 3).forEach(r => {
        console.log(`  - ${r.rating}/5 ${r.author}${r.comment ? `: ${r.comment}` : ''}`);
      });
    }

    console.log(`\n${chalk.yellow('Registry quality:')}`);
    if (!info.quality) {
      console.log('  not applicable (plugin was not installed from the npm registry)');
    } else if (info.quality.source === 'unavailable') {
      console.log(`  unavailable (${info.quality.error ?? 'unknown error'})`);
    } else {
      console.log(`  Rating: ${info.quality.rating}/5 (${info.quality.source}${info.quality.derived ? ', derived' : ''})`);
      if (info.quality.quality !== null) console.log(`  Quality: ${info.quality.quality}`);
      if (info.quality.popularity !== null) console.log(`  Popularity: ${info.quality.popularity}`);
      if (info.quality.maintenance !== null) console.log(`  Maintenance: ${info.quality.maintenance}`);
      if (info.quality.downloadsLastMonth !== null) console.log(`  Downloads (last month): ${info.quality.downloadsLastMonth}`);
      if (info.quality.cached) console.log(chalk.gray(`  (cached ${info.quality.fetchedAt}${info.quality.stale ? ', expired' : ''})`));
    }
  }

  if (verbose) {
    console.log(`\n${chalk.yellow('Manifest:')}`);
    console.log(`  Main: ${manifest.main}`);
    
    if (manifest.engines) {
      console.log(`  Engines: ${JSON.stringify(manifest.engines)}`);
    }
    
    if (manifest.dependencies) {
      console.log(`  Dependencies: ${Object.keys(manifest.dependencies).length}`);
    }
    
    if (manifest.reshell) {
      console.log(`  Re-Shell Config: ${JSON.stringify(manifest.reshell, null, 2)}`);
    }
    
    if (plugin.loadError) {
      console.log(`\n${chalk.red('Load Error:')}`);
      console.log(`  ${plugin.loadError.message}`);
    }
    
    if (plugin.activationError) {
      console.log(`\n${chalk.red('Activation Error:')}`);
      console.log(`  ${plugin.activationError.message}`);
    }
  }
}

// Validate plugin compatibility
/**
 * Statically validates a plugin directory: manifest schema, entry file,
 * `engines.reshell-cli` / `engines.node` against this CLI and Node, dependency
 * resolvability, a source security scan (child_process, eval/new Function,
 * dynamic require of user input, network calls, writes outside the plugin dir)
 * and package size. Nothing in the plugin is executed.
 *
 * Errors make the command exit non-zero (with `--json`: `ok:false`,
 * `PLUGIN_VALIDATE_ERROR`, the full report under `error.details`); warnings stay
 * in the envelope's `warnings` and the report's findings. `--strict` promotes
 * warnings to failures.
 *
 * @param pluginPath - Path to the plugin directory (or its package.json)
 * @param options - `json`, `strict`, `checkRegistry`, `registry`, `verbose`
 * @returns Promise that resolves once the report has been emitted
 */
export async function validatePlugin(
  pluginPath: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { json = false, verbose = false, strict = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const report = await validatePluginPath(path.resolve(rootOf(options), pluginPath), {
      strict,
      checkRegistry: options.checkRegistry,
      registryUrl: options.registry,
      fetchImpl: options.fetchImpl,
    });

    const warnings = report.findings
      .filter(f => f.severity === 'warning')
      .map(f => `${f.id}: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : ''}`);

    if (json) {
      if (report.valid) {
        ok(report, warnings);
      } else {
        emitJson({
          ok: false,
          error: {
            code: 'PLUGIN_VALIDATE_ERROR',
            message: validationSummary(report),
            details: report as unknown as Record<string, unknown>,
          },
          warnings,
        });
        process.exitCode = 1;
      }
      return;
    }

    displayValidationReport(report, verbose);
    if (!report.valid) {
      throw new ValidationError(validationSummary(report));
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error instanceof PluginValidationInputError) {
      failCommand(json, 'PLUGIN_VALIDATE_ERROR', error.message, error.details, 'Plugin validation failed');
      return;
    }
    failCommand(
      json,
      'PLUGIN_VALIDATE_ERROR',
      error instanceof Error ? error.message : String(error),
      { path: pluginPath },
      'Plugin validation failed'
    );
  } finally {
    restoreJson();
  }
}

function validationSummary(report: PluginValidateResponse): string {
  const { errors, warnings } = report.counts;
  return report.counts.errors > 0
    ? `Plugin validation failed: ${errors} error(s), ${warnings} warning(s)`
    : `Plugin validation failed in strict mode: ${warnings} warning(s)`;
}

function displayValidationReport(report: PluginValidateResponse, verbose: boolean): void {
  console.log(chalk.cyan(`\n🔍 Plugin validation: ${report.name ?? report.path}${report.version ? ` v${report.version}` : ''}\n`));
  const order = ['error', 'warning', 'info'] as const;
  for (const severity of order) {
    const findings = report.findings.filter(f => f.severity === severity);
    if (findings.length === 0 || (severity === 'info' && !verbose)) continue;
    const color = severity === 'error' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.gray;
    findings.forEach(f => {
      const where = f.file ? ` ${chalk.gray(`${f.file}${f.line ? `:${f.line}` : ''}`)}` : '';
      console.log(`${color(severity.toUpperCase().padEnd(7))} ${f.id}: ${f.message}${where}`);
    });
  }
  if (report.findings.every(f => f.severity === 'info') || report.findings.length === 0) {
    console.log(chalk.gray('No errors or warnings.'));
  }
  console.log(
    chalk.gray(
      `\nSize: ${report.size.bytes} bytes in ${report.size.files} file(s) | CLI ${report.cliVersion} | ` +
        `${report.counts.errors} error(s), ${report.counts.warnings} warning(s), ${report.counts.info} note(s)`
    )
  );
  if (report.valid) {
    console.log(chalk.green('\n✓ Plugin is valid'));
  }
}

// Clear plugin cache
/**
 * Clears the plugin discovery cache maintained by the registry.
 *
 * @param options - Options controlling verbosity
 * @returns Promise that resolves when the cache has been cleared
 */
export async function clearPluginCache(options: PluginCommandOptions = {}): Promise<void> {
  const { verbose = false } = options;

  try {
    const registry = createPluginRegistry();
    registry.clearCache();
    
    console.log(chalk.green('Plugin discovery cache cleared!'));

  } catch (error) {
    throw new ValidationError(
      `Failed to clear plugin cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show plugin lifecycle statistics
/**
 * Displays plugin lifecycle statistics including state distribution and performance.
 *
 * @param options - Options controlling JSON output and verbosity
 * @returns Promise that resolves when the statistics have been displayed
 */
export async function showPluginStats(options: PluginCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const stats = registry.getLifecycleStats() as Record<string, number> & {
      total: number;
      totalErrors: number;
      byState: Record<string, number>;
      avgLoadTime?: number;
      avgInitTime?: number;
      avgActivationTime?: number;
    };
    
    if (json) {
      ok(stats);
      return;
    }

    console.log(chalk.cyan('\n📊 Plugin Lifecycle Statistics\n'));
    
    console.log(chalk.yellow('Overview:'));
    console.log(`  Total Plugins: ${stats.total}`);
    console.log(`  Total Errors: ${stats.totalErrors}`);
    
    console.log(chalk.yellow('\nBy State:'));
    Object.entries(stats.byState).forEach(([state, count]) => {
      const stateColor = state === 'active' ? chalk.green : 
                        state === 'loaded' || state === 'initialized' ? chalk.yellow :
                        state === 'error' ? chalk.red : chalk.gray;
      console.log(`  ${stateColor(state)}: ${count}`);
    });
    
    console.log(chalk.yellow('\nPerformance:'));
    console.log(`  Average Load Time: ${Math.round(stats.avgLoadTime)}ms`);
    console.log(`  Average Init Time: ${Math.round(stats.avgInitTime)}ms`);
    console.log(`  Average Activation Time: ${Math.round(stats.avgActivationTime)}ms`);

    if (verbose) {
      const plugins = registry.getManagedPlugins();
      const errorPlugins = plugins.filter(p => p.errors.length > 0);
      
      if (errorPlugins.length > 0) {
        console.log(chalk.red('\nPlugins with Errors:'));
        errorPlugins.forEach(plugin => {
          console.log(`  ${plugin.manifest.name}: ${plugin.errors.length} errors`);
        });
      }
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show plugin statistics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Reload a plugin
/**
 * Reloads a plugin by unloading and loading it again.
 *
 * @param pluginName - Name of the plugin to reload
 * @param options - Options controlling verbosity
 * @returns Promise that resolves when the plugin has been reloaded
 */
export async function reloadPlugin(
  pluginName: string, 
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugin = registry.getManagedPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    const spinner = createSpinner(`Reloading plugin ${pluginName}...`);
    spinner.start();

    await registry.reloadPlugin(pluginName);

    spinner.succeed(chalk.green(`Plugin ${pluginName} reloaded successfully!`));

    if (verbose) {
      const reloadedPlugin = registry.getManagedPlugin(pluginName);
      if (reloadedPlugin) {
        console.log(chalk.gray(`Plugin state: ${reloadedPlugin.state}`));
        console.log(chalk.gray(`Load time: ${reloadedPlugin.performance.loadDuration}ms`));
      }
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to reload plugin: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show plugin hooks
/**
 * Displays registered plugin hooks, optionally filtered to a single plugin.
 *
 * @param pluginName - Optional plugin name to filter hooks by
 * @param options - Options controlling JSON output and verbosity
 * @returns Promise that resolves when the hooks overview has been displayed
 */
export async function showPluginHooks(
  pluginName?: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const hookStats = registry.getHookStats() as {
      totalHooks: number;
      middleware: unknown[];
      hooksByType: Record<string, number>;
      hooksByPlugin: Record<string, number>;
      executionStats: Record<string, number>;
    };
    
    if (json) {
      if (pluginName) {
        const hookSystem = registry.getHookSystem();
        const pluginHooks = hookSystem.getPluginHooks(pluginName);
        ok(pluginHooks);
      } else {
        ok(hookStats);
      }
      return;
    }

    console.log(chalk.cyan('\n🪝 Plugin Hooks Overview\n'));
    
    if (pluginName) {
      const hookSystem = registry.getHookSystem();
      const pluginHooks = hookSystem.getPluginHooks(pluginName);
      
      if (pluginHooks.length === 0) {
        console.log(chalk.yellow(`No hooks registered for plugin '${pluginName}'`));
        return;
      }

      console.log(chalk.green(`Hooks for plugin '${pluginName}' (${pluginHooks.length}):\n`));
      
      pluginHooks.forEach((hook, index) => {
        console.log(`${index + 1}. ${chalk.white(hook.id)}`);
        console.log(`   Type: ${chalk.cyan((hook as HookHandler & { hookType?: string }).hookType || 'unknown')}`);
        console.log(`   Priority: ${hook.priority}`);
        if (hook.description) {
          console.log(`   Description: ${chalk.gray(hook.description)}`);
        }
        if (hook.once) {
          console.log(`   ${chalk.yellow('(one-time)')}`);
        }
        if (index < pluginHooks.length - 1) {
          console.log('');
        }
      });
      
    } else {
      console.log(chalk.yellow('Overview:'));
      console.log(`  Total Hooks: ${hookStats.totalHooks}`);
      console.log(`  Active Middleware: ${hookStats.middleware.length}`);
      
      console.log(chalk.yellow('\nBy Hook Type:'));
      Object.entries(hookStats.hooksByType).forEach(([type, count]) => {
        if ((count as number) > 0) {
          console.log(`  ${chalk.cyan(type)}: ${count}`);
        }
      });
      
      console.log(chalk.yellow('\nBy Plugin:'));
      Object.entries(hookStats.hooksByPlugin).forEach(([plugin, count]) => {
        console.log(`  ${chalk.white(plugin)}: ${count} hooks`);
      });

      if (verbose && Object.keys(hookStats.executionStats).length > 0) {
        console.log(chalk.yellow('\nExecution Time (total ms):'));
        Object.entries(hookStats.executionStats).forEach(([plugin, time]) => {
          console.log(`  ${plugin}: ${time}ms`);
        });
      }
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show plugin hooks: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Execute a hook manually
/**
 * Manually executes a plugin hook with the given JSON data.
 *
 * @param hookType - The type of hook to execute
 * @param data - JSON string payload passed to the hook handlers
 * @param options - Options controlling JSON output and verbosity
 * @returns Promise that resolves when the hook execution result has been displayed
 */
export async function executeHook(
  hookType: string,
  data = '{}',
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    let hookData: Record<string, unknown>;
    try {
      hookData = JSON.parse(data);
    } catch (error) {
      throw new ValidationError('Hook data must be valid JSON');
    }

    const spinner = createSpinner(`Executing hook ${hookType}...`);
    spinner.start();

    const result = await registry.executeHooks(hookType, hookData);
    
    spinner.stop();

    if (json) {
      ok(result);
      return;
    }

    console.log(chalk.cyan(`\n🪝 Hook Execution Result\n`));
    
    console.log(chalk.yellow('Execution:'));
    console.log(`  Hook Type: ${chalk.cyan(hookType)}`);
    console.log(`  Success: ${result.success ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`  Execution Time: ${result.executionTime}ms`);
    console.log(`  Results: ${result.results.length}`);
    console.log(`  Errors: ${result.errors.length}`);
    
    if (result.aborted) {
      console.log(`  ${chalk.yellow('⚠️  Execution was aborted')}`);
    }

    if (result.results.length > 0 && verbose) {
      console.log(chalk.yellow('\nResults:'));
      result.results.forEach((res, index) => {
        console.log(`  ${index + 1}. ${chalk.white(res.pluginName)}: ${res.executionTime}ms`);
        if (res.result !== undefined) {
          console.log(`     Result: ${JSON.stringify(res.result)}`);
        }
      });
    }

    if (result.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      result.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${chalk.red(err.pluginName)}: ${err.error.message}`);
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to execute hook: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// List available hook types
/**
 * Lists all available plugin hook types grouped by category.
 *
 * @param options - Options controlling JSON output
 * @returns Promise that resolves when the hook types have been displayed
 */
export async function listHookTypes(options: PluginCommandOptions = {}): Promise<void> {
  const { json = false } = options;

  try {
    const hookTypes = Object.values(HookType);
    
    if (json) {
      ok(hookTypes);
      return;
    }

    console.log(chalk.cyan('\n🪝 Available Hook Types\n'));
    
    const categories = {
      'CLI Lifecycle': hookTypes.filter(t => t.startsWith('cli:')),
      'Commands': hookTypes.filter(t => t.startsWith('command:')),
      'Workspace': hookTypes.filter(t => t.startsWith('workspace:')),
      'Files': hookTypes.filter(t => t.startsWith('file:')),
      'Build': hookTypes.filter(t => t.startsWith('build:')),
      'Plugins': hookTypes.filter(t => t.startsWith('plugin:')),
      'Configuration': hookTypes.filter(t => t.startsWith('config:')),
      'Other': hookTypes.filter(t => !t.includes(':'))
    };

    Object.entries(categories).forEach(([category, types]) => {
      if (types.length > 0) {
        console.log(chalk.yellow(`${category}:`));
        types.forEach(type => {
          console.log(`  ${chalk.cyan(type)}`);
        });
        console.log('');
      }
    });

  } catch (error) {
    throw new ValidationError(
      `Failed to list hook types: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
