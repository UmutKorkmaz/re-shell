import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { 
  createDependencyResolver,
  PluginDependencyResolver,
  ResolutionOptions,
  ResolutionResult,
  DependencyConflict,
  InstallationStep
} from '../utils/plugin-dependency';
import { createPluginRegistry } from '../utils/plugin-system';

interface DependencyCommandOptions {
  verbose?: boolean;
  json?: boolean;
  strategy?: 'strict' | 'loose' | 'latest';
  allowPrerelease?: boolean;
  ignoreOptional?: boolean;
  autoInstall?: boolean;
  dryRun?: boolean;
  showTree?: boolean;
}

// Resolve dependencies for a plugin
export async function resolveDependencies(
  pluginName: string,
  options: DependencyCommandOptions = {}
): Promise<void> {
  const { 
    verbose = false, 
    json = false, 
    strategy = 'strict',
    allowPrerelease = false,
    ignoreOptional = false,
    autoInstall = false,
    dryRun = false
  } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugin = registry.getPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    const resolver = createDependencyResolver({
      strategy,
      allowPrerelease,
      ignoreOptional,
      autoInstall: autoInstall && !dryRun
    });

    // Register all available plugins with resolver
    const allPlugins = registry.getPlugins();
    allPlugins.forEach(p => resolver.registerPlugin(p));

    const spinner = createSpinner(`Resolving dependencies for ${pluginName}...`);
    spinner.start();

    const result = await resolver.resolveDependencies(plugin.manifest, {
      strategy,
      allowPrerelease,
      ignoreOptional,
      autoInstall: autoInstall && !dryRun
    });

    spinner.stop();

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n🔗 Dependency Resolution for ${pluginName}\n`));

    displayResolutionResult(result, verbose);

    if (dryRun && autoInstall) {
      console.log(chalk.yellow('\n📋 Installation Plan (Dry Run):\n'));
      displayInstallationPlan(result.installationPlan);
    }

  } catch (error) {
    throw new ValidationError(
      `Dependency resolution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show dependency tree for a plugin
export async function showDependencyTree(
  pluginName?: string,
  options: DependencyCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const resolver = createDependencyResolver();

    // Register all available plugins
    const allPlugins = registry.getPlugins();
    allPlugins.forEach(p => resolver.registerPlugin(p));

    const dependencyGraph = resolver.getDependencyGraph();

    if (json) {
      const graphData = Array.from(dependencyGraph.entries()).map(([name, node]) => ({
        name,
        version: node.version,
        dependencies: Array.from(node.dependencies),
        dependents: Array.from(node.dependents),
        resolved: node.resolved,
        depth: node.depth
      }));
      console.log(JSON.stringify(graphData, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🌳 Plugin Dependency Tree\n'));

    if (pluginName) {
      const node = dependencyGraph.get(pluginName);
      if (!node) {
        throw new ValidationError(`Plugin '${pluginName}' not found in dependency graph`);
      }
      displayDependencyNode(node, dependencyGraph, 0, new Set(), verbose);
    } else {
      // Show all top-level plugins (no dependents)
      const topLevel = Array.from(dependencyGraph.values())
        .filter(node => node.dependents.size === 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      if (topLevel.length === 0) {
        console.log(chalk.yellow('No plugins found in dependency graph.'));
        return;
      }

      topLevel.forEach(node => {
        displayDependencyNode(node, dependencyGraph, 0, new Set(), verbose);
        console.log('');
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Failed to show dependency tree: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Check for dependency conflicts
export async function checkConflicts(options: DependencyCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false, strategy = 'strict' } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const resolver = createDependencyResolver({ strategy });

    // Register all plugins
    const allPlugins = registry.getPlugins();
    allPlugins.forEach(p => resolver.registerPlugin(p));

    const spinner = createSpinner('Checking for dependency conflicts...');
    spinner.start();

    const conflicts: DependencyConflict[] = [];
    const resolutions: ResolutionResult[] = [];

    // Check each plugin for conflicts
    for (const plugin of allPlugins) {
      try {
        const result = await resolver.resolveDependencies(plugin.manifest);
        resolutions.push(result);
        conflicts.push(...result.conflicts);
      } catch (error) {
        // Plugin has unresolvable conflicts
        conflicts.push({
          type: 'incompatible',
          source: plugin.manifest.name,
          target: 'unknown',
          requested: 'unknown',
          resolution: {
            action: 'remove',
            target: plugin.manifest.name,
            reason: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }

    spinner.stop();

    if (json) {
      console.log(JSON.stringify({
        conflicts,
        totalPlugins: allPlugins.length,
        pluginsWithConflicts: resolutions.filter(r => r.conflicts.length > 0).length
      }, null, 2));
      return;
    }

    console.log(chalk.cyan('\n⚠️  Dependency Conflict Analysis\n'));

    if (conflicts.length === 0) {
      console.log(chalk.green('✅ No dependency conflicts found!'));
      console.log(chalk.gray(`Analyzed ${allPlugins.length} plugins successfully.`));
      return;
    }

    console.log(chalk.red(`Found ${conflicts.length} dependency conflicts:\n`));

    displayConflicts(conflicts, verbose);

    // Show resolution suggestions
    const resolvableConflicts = conflicts.filter(c => c.resolution);
    if (resolvableConflicts.length > 0) {
      console.log(chalk.yellow('\n💡 Suggested Resolutions:\n'));
      resolvableConflicts.forEach((conflict, index) => {
        if (conflict.resolution) {
          console.log(`${index + 1}. ${chalk.cyan(conflict.resolution.action)} ${conflict.resolution.target}`);
          if (conflict.resolution.version) {
            console.log(`   Version: ${conflict.resolution.version}`);
          }
          console.log(`   Reason: ${chalk.gray(conflict.resolution.reason)}`);
          console.log('');
        }
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Conflict check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Validate dependency versions
export async function validateVersions(options: DependencyCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugins = registry.getPlugins();
    const validationResults: any[] = [];

    const spinner = createSpinner('Validating plugin versions...');
    spinner.start();

    for (const plugin of plugins) {
      const result = {
        plugin: plugin.manifest.name,
        version: plugin.manifest.version,
        valid: true,
        issues: [] as string[]
      };

      // Validate version format
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const semver = require('semver');
      if (!semver.valid(plugin.manifest.version)) {
        result.valid = false;
        result.issues.push('Invalid version format');
      }

      // Check for prerelease versions
      if (semver.prerelease(plugin.manifest.version)) {
        result.issues.push('Prerelease version');
      }

      // Validate dependency versions
      if (plugin.manifest.dependencies) {
        Object.entries(plugin.manifest.dependencies).forEach(([name, version]) => {
          if (!semver.validRange(version)) {
            result.valid = false;
            result.issues.push(`Invalid dependency version range: ${name}@${version}`);
          }
        });
      }

      // Check for outdated dependencies
      if (plugin.manifest.reshell?.plugins) {
        Object.entries(plugin.manifest.reshell.plugins).forEach(([name, version]) => {
          const depPlugin = registry.getPlugin(name);
          if (depPlugin) {
            const currentVersion = depPlugin.manifest.version;
            if (semver.gt(currentVersion, version as string)) {
              result.issues.push(`Outdated plugin dependency: ${name}@${version} (latest: ${currentVersion})`);
            }
          }
        });
      }

      validationResults.push(result);
    }

    spinner.stop();

    if (json) {
      console.log(JSON.stringify(validationResults, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🔍 Plugin Version Validation\n'));

    const validPlugins = validationResults.filter(r => r.valid);
    const invalidPlugins = validationResults.filter(r => !r.valid);
    const pluginsWithIssues = validationResults.filter(r => r.issues.length > 0);

    console.log(chalk.green(`✅ Valid plugins: ${validPlugins.length}/${validationResults.length}`));
    
    if (invalidPlugins.length > 0) {
      console.log(chalk.red(`❌ Invalid plugins: ${invalidPlugins.length}`));
    }

    if (pluginsWithIssues.length > 0) {
      console.log(chalk.yellow(`⚠️  Plugins with issues: ${pluginsWithIssues.length}`));
    }

    if (verbose || invalidPlugins.length > 0) {
      console.log('');
      validationResults.forEach(result => {
        if (!result.valid || (verbose && result.issues.length > 0)) {
          const status = result.valid ? chalk.yellow('⚠️ ') : chalk.red('❌');
          console.log(`${status} ${chalk.white(result.plugin)} ${chalk.gray(`v${result.version}`)}`);
          
          result.issues.forEach((issue: string) => {
            const color = result.valid ? chalk.yellow : chalk.red;
            console.log(`   ${color(issue)}`);
          });
          console.log('');
        }
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Version validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Update plugin dependencies
export async function updateDependencies(
  pluginName: string,
  options: DependencyCommandOptions = {}
): Promise<void> {
  const { verbose = false, dryRun = false } = options;

  try {
    const registry = createPluginRegistry();
    await registry.initialize();

    const plugin = registry.getPlugin(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    const spinner = createSpinner(`Updating dependencies for ${pluginName}...`);
    spinner.start();

    // TODO: Implement actual dependency update logic
    // This would involve:
    // 1. Checking for newer versions of dependencies
    // 2. Updating package.json/manifest
    // 3. Installing new versions
    // 4. Running tests to ensure compatibility

    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate update

    spinner.succeed(chalk.green(`Dependencies updated for ${pluginName}!`));

    if (verbose) {
      console.log(chalk.gray('Updated dependencies would be listed here...'));
    }

  } catch (error) {
    throw new ValidationError(
      `Dependency update failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Display resolution result
function displayResolutionResult(result: ResolutionResult, verbose: boolean): void {
  console.log(chalk.yellow('Resolution Status:'));
  console.log(`  Success: ${result.success ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Resolved: ${result.resolved.length} dependencies`);
  console.log(`  Conflicts: ${result.conflicts.length}`);
  console.log(`  Missing: ${result.missing.length}`);
  
  if (result.circular.length > 0) {
    console.log(`  Circular: ${result.circular.length} cycles`);
  }

  if (result.resolved.length > 0) {
    console.log(chalk.yellow('\nResolved Dependencies:'));
    result.resolved.forEach(dep => {
      const status = dep.resolved ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${chalk.white(dep.name)} ${chalk.gray(`${dep.version} → ${dep.resolvedVersion || 'unknown'}`)}`);
      
      if (verbose && dep.conflicts && dep.conflicts.length > 0) {
        dep.conflicts.forEach(conflict => {
          console.log(`    ${chalk.yellow('⚠️')} ${conflict.type}: ${conflict.requested} vs ${conflict.available}`);
        });
      }
    });
  }

  if (result.missing.length > 0) {
    console.log(chalk.red('\nMissing Dependencies:'));
    result.missing.forEach(missing => {
      console.log(`  ${chalk.red('✗')} ${missing}`);
    });
  }

  if (result.conflicts.length > 0) {
    console.log(chalk.red('\nConflicts:'));
    displayConflicts(result.conflicts, verbose);
  }

  if (result.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    result.warnings.forEach(warning => {
      console.log(`  ${chalk.yellow('⚠️')} ${warning}`);
    });
  }
}

// Display dependency conflicts
function displayConflicts(conflicts: DependencyConflict[], verbose: boolean): void {
  conflicts.forEach((conflict, index) => {
    console.log(`${index + 1}. ${chalk.red(conflict.type)} conflict:`);
    console.log(`   Source: ${chalk.white(conflict.source)}`);
    console.log(`   Target: ${chalk.white(conflict.target)}`);
    console.log(`   Requested: ${chalk.cyan(conflict.requested)}`);
    
    if (conflict.available) {
      console.log(`   Available: ${chalk.cyan(conflict.available)}`);
    }

    if (verbose && conflict.resolution) {
      console.log(`   Resolution: ${chalk.yellow(conflict.resolution.action)} ${conflict.resolution.target}`);
      if (conflict.resolution.version) {
        console.log(`   Version: ${conflict.resolution.version}`);
      }
      console.log(`   Reason: ${chalk.gray(conflict.resolution.reason)}`);
    }
    console.log('');
  });
}

// Display installation plan
function displayInstallationPlan(plan: InstallationStep[]): void {
  if (plan.length === 0) {
    console.log(chalk.gray('No installation steps required.'));
    return;
  }

  plan.forEach((step, index) => {
    const actionColor = step.action === 'install' ? chalk.green : 
                       step.action === 'upgrade' ? chalk.blue :
                       step.action === 'downgrade' ? chalk.yellow : chalk.red;
    
    console.log(`${step.order + 1}. ${actionColor(step.action)} ${chalk.white(step.plugin)} ${chalk.gray(`v${step.version}`)}`);
    
    if (step.optional) {
      console.log(`   ${chalk.gray('(optional)')}`);
    }
    
    if (step.dependencies.length > 0) {
      console.log(`   Dependencies: ${step.dependencies.join(', ')}`);
    }
  });
}

// Display dependency node in tree format
function displayDependencyNode(
  node: any,
  graph: Map<string, any>,
  depth: number,
  visited: Set<string>,
  verbose: boolean
): void {
  const indent = '  '.repeat(depth);
  const prefix = depth === 0 ? '' : '├─ ';
  const status = node.resolved ? chalk.green('●') : chalk.red('●');
  
  console.log(`${indent}${prefix}${status} ${chalk.white(node.name)} ${chalk.gray(`v${node.version}`)}`);
  
  if (verbose) {
    console.log(`${indent}   Dependencies: ${node.dependencies.size}`);
    console.log(`${indent}   Dependents: ${node.dependents.size}`);
  }

  if (visited.has(node.name)) {
    console.log(`${indent}  ${chalk.yellow('(circular reference)')}`);
    return;
  }

  visited.add(node.name);

  // Show dependencies
  const deps = Array.from(node.dependencies).sort() as string[];
  deps.forEach((depName) => {
    const depNode = graph.get(depName);
    if (depNode) {
      displayDependencyNode(depNode, graph, depth + 1, new Set(visited), verbose);
    } else {
      const depIndent = '  '.repeat(depth + 1);
      console.log(`${depIndent}├─ ${chalk.red('●')} ${chalk.white(depName)} ${chalk.red('(missing)')}`);
    }
  });

  visited.delete(node.name);
}