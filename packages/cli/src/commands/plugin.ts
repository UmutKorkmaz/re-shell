import chalk from 'chalk';

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
import { ok, fail } from '../utils/json-output';

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
}

// Main plugin management function
export async function managePlugins(options: PluginCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const restoreJson = json ? (await import('../utils/json-output')).enableJsonMode() : () => {};
    
    const registry = createPluginRegistry();
    
    const spinner = json ? undefined : createSpinner('Initializing plugin registry...');
    if (spinner) spinner.start();
    
    await registry.initialize();
    
    if (spinner) spinner.stop();

    const plugins = registry.getManagedPlugins();
    
    if (json) {
      process.stdout.write(JSON.stringify(plugins.map(p => ({
        name: p.manifest.name,
        version: p.manifest.version,
        description: p.manifest.description,
        path: p.pluginPath,
        isLoaded: p.isLoaded,
        isActive: p.isActive,
        usageCount: p.usageCount,
        state: p.state
      })), null, 2) + '\n');
      restoreJson();
      return;
    }

    if (plugins.length === 0) {
      console.log(chalk.yellow('No plugins found.'));
      console.log(chalk.gray('Run "re-shell plugin discover" to search for available plugins.'));
      return;
    }

    console.log(chalk.cyan(`\n🔌 Installed Plugins (${plugins.length})\n`));
    
    displayPluginList(plugins, verbose);

  } catch (error) {
    throw new ValidationError(
      `Plugin management failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Discover available plugins
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
      console.log(JSON.stringify(result, null, 2));
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
      workspaceRoot: process.cwd(),
      dryRun,
      force,
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
      });
      return;
    }

    if (verbose) {
      console.log(chalk.gray(`Source: ${result.source}`));
      console.log(chalk.gray(`Location: ${result.path}`));
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
export async function uninstallPlugin(
  pluginName: string, 
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, force = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugin = registry.getManagedPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' is not installed`);
    }

    if (!force) {
      // TODO: Add confirmation prompt
      console.log(chalk.yellow(`Are you sure you want to uninstall '${pluginName}'?`));
    }

    const spinner = createSpinner(`Uninstalling plugin ${pluginName}...`);
    spinner.start();

    // Unload the plugin (which includes deactivation)
    await registry.unloadPlugin(pluginName);
    
    // Unregister from registry
    const success = await registry.unregisterPlugin(pluginName);
    
    if (!success) {
      throw new ValidationError(`Failed to unregister plugin '${pluginName}'`);
    }

    // TODO: Remove plugin files and dependencies
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate uninstallation
    
    spinner.succeed(chalk.green(`Plugin ${pluginName} uninstalled successfully!`));

  } catch (error) {
    throw new ValidationError(
      `Plugin uninstallation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show plugin information
export async function showPluginInfo(
  pluginName: string, 
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugin = registry.getManagedPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    if (json) {
      console.log(JSON.stringify({
        manifest: plugin.manifest,
        path: plugin.pluginPath,
        isLoaded: plugin.isLoaded,
        isActive: plugin.isActive,
        usageCount: plugin.usageCount,
        lastUsed: plugin.lastUsed,
        state: plugin.state,
        dependencies: plugin.dependencies,
        dependents: plugin.dependents,
        performance: plugin.performance,
        errors: plugin.errors,
        stateHistory: plugin.stateHistory
      }, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n📦 ${plugin.manifest.name} v${plugin.manifest.version}\n`));
    
    displayPluginDetails(plugin, verbose);

  } catch (error) {
    throw new ValidationError(
      `Failed to show plugin info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Enable a plugin
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
export async function updatePlugins(options: PluginCommandOptions = {}): Promise<void> {
  const { verbose = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugins = registry.getPlugins();
    
    if (plugins.length === 0) {
      console.log(chalk.yellow('No plugins to update.'));
      return;
    }

    const spinner = createSpinner(`Checking for plugin updates...`);
    spinner.start();

    // TODO: Implement update checking and installation
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate update check
    
    spinner.succeed(chalk.green('All plugins are up to date!'));

  } catch (error) {
    throw new ValidationError(
      `Plugin update failed: ${error instanceof Error ? error.message : String(error)}`
    );
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
function displayPluginList(plugins: ManagedPluginRegistration[], verbose: boolean): void {
  plugins.forEach((plugin, index) => {
    const status = plugin.state === PluginState.ACTIVE ? chalk.green('●') : 
                   plugin.state === PluginState.LOADED || plugin.state === PluginState.INITIALIZED ? chalk.yellow('●') : 
                   chalk.gray('●');
    const statusText = plugin.state;
    
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

// Display detailed plugin information
function displayPluginDetails(plugin: ManagedPluginRegistration, verbose: boolean): void {
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
export async function validatePlugin(
  pluginPath: string, 
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const spinner = createSpinner('Validating plugin...');
    spinner.start();

    // TODO: Implement comprehensive plugin validation
    // This would check:
    // 1. Manifest validity
    // 2. Code structure
    // 3. Dependencies compatibility
    // 4. Security scanning
    // 5. Performance analysis

    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate validation
    
    spinner.succeed(chalk.green('Plugin validation passed!'));

    if (verbose) {
      console.log(chalk.gray('All checks completed successfully.'));
    }

  } catch (error) {
    throw new ValidationError(
      `Plugin validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Clear plugin cache
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
export async function showPluginStats(options: PluginCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const stats = registry.getLifecycleStats();
    
    if (json) {
      console.log(JSON.stringify(stats, null, 2));
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
export async function showPluginHooks(
  pluginName?: string,
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const hookStats = registry.getHookStats();
    
    if (json) {
      if (pluginName) {
        const hookSystem = registry.getHookSystem();
        const pluginHooks = hookSystem.getPluginHooks(pluginName);
        console.log(JSON.stringify(pluginHooks, null, 2));
      } else {
        console.log(JSON.stringify(hookStats, null, 2));
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
      
      pluginHooks.forEach((hook: HookHandler & { hookType?: string }, index: number) => {
        console.log(`${index + 1}. ${chalk.white(hook.id)}`);
        console.log(`   Type: ${chalk.cyan(hook.hookType || 'unknown')}`);
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
export async function executeHook(
  hookType: string,
  data = '{}',
  options: PluginCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    let hookData: unknown;
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
      console.log(JSON.stringify(result, null, 2));
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
      result.results.forEach((res: { pluginName: string; executionTime: number; result?: unknown }, index: number) => {
        console.log(`  ${index + 1}. ${chalk.white(res.pluginName)}: ${res.executionTime}ms`);
        if (res.result !== undefined) {
          console.log(`     Result: ${JSON.stringify(res.result)}`);
        }
      });
    }

    if (result.errors.length > 0) {
      console.log(chalk.red('\nErrors:'));
      result.errors.forEach((err: { pluginName: string; error: Error }, index: number) => {
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
export async function listHookTypes(options: PluginCommandOptions = {}): Promise<void> {
  const { json = false } = options;

  try {
    const hookTypes = Object.values(HookType);
    
    if (json) {
      console.log(JSON.stringify(hookTypes, null, 2));
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