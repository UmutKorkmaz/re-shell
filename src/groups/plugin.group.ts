import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import {
  managePlugins, discoverPlugins, installPlugin, uninstallPlugin,
  showPluginInfo, enablePlugin, disablePlugin, updatePlugins,
  validatePlugin, clearPluginCache, showPluginStats, reloadPlugin,
  showPluginHooks, executeHook, listHookTypes,
} from '../commands/plugin';
import {
  showCacheStats, configureCacheSettings, clearCache,
  testCachePerformance, optimizeCache, listCachedCommands,
} from '../commands/plugin-cache';
import {
  listPluginCommands, showCommandConflicts, resolveCommandConflicts,
  showCommandStats, registerTestCommand, unregisterCommand, showCommandInfo,
} from '../commands/plugin-command';
import {
  listCommandConflicts, showConflictStrategies, resolveConflict,
  autoResolveConflicts, showConflictStats, setPriorityOverride,
  showResolutionHistory,
} from '../commands/plugin-conflicts';
import {
  resolveDependencies, showDependencyTree, checkConflicts,
  validateVersions, updateDependencies,
} from '../commands/plugin-dependency';
import {
  generatePluginDocumentation, showCommandHelp, listDocumentedCommands,
  searchDocumentation, showDocumentationStats, configureHelpSystem,
  showDocumentationTemplates,
} from '../commands/plugin-docs';
import {
  searchMarketplace, showPluginDetails, installMarketplacePlugin,
  showPluginReviews, showFeaturedPlugins, showPopularPlugins,
  showCategories, clearMarketplaceCache, showMarketplaceStats,
} from '../commands/plugin-marketplace';
import {
  listMiddleware, showMiddlewareStats, testMiddleware,
  clearMiddlewareCache, showMiddlewareChain, createExampleMiddleware,
} from '../commands/plugin-middleware';
import {
  scanPluginSecurity, checkSecurityPolicy, generateSecurityReport,
  fixSecurityIssues,
} from '../commands/plugin-security';
import {
  testCommandValidation, createCommandValidationSchema, listValidationRules,
  listTransformations, showCommandValidationSchema, showValidationStats,
  generateValidationTemplate,
} from '../commands/plugin-validation';

export function registerPluginGroup(program: Command): void {
  const pluginCommand = new Command('plugin')
    .description('Manage CLI plugins and extensions');

  pluginCommand
    .command('list')
    .description('List installed plugins')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await managePlugins(options);
      })
    );

  pluginCommand
    .command('discover')
    .description('Discover available plugins')
    .option('--source <source>', 'Plugin source (local, npm, builtin)')
    .option('--include-disabled', 'Include disabled plugins')
    .option('--include-dev', 'Include development plugins')
    .option('--timeout <ms>', 'Discovery timeout in milliseconds', '10000')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await discoverPlugins(options);
      })
    );

  pluginCommand
    .command('install <plugin>')
    .description('Install a plugin')
    .option('--global', 'Install globally')
    .option('--force', 'Force installation')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await installPlugin(plugin, options);
      })
    );

  pluginCommand
    .command('uninstall <plugin>')
    .description('Uninstall a plugin')
    .option('--force', 'Force uninstallation')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await uninstallPlugin(plugin, options);
      })
    );

  pluginCommand
    .command('info <plugin>')
    .description('Show plugin information')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await showPluginInfo(plugin, options);
      })
    );

  pluginCommand
    .command('enable <plugin>')
    .description('Enable a plugin')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await enablePlugin(plugin, options);
      })
    );

  pluginCommand
    .command('disable <plugin>')
    .description('Disable a plugin')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await disablePlugin(plugin, options);
      })
    );

  pluginCommand
    .command('update')
    .description('Update all plugins')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        await updatePlugins(options);
      })
    );

  pluginCommand
    .command('validate <path>')
    .description('Validate a plugin')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (path, options) => {
        await validatePlugin(path, options);
      })
    );

  pluginCommand
    .command('clear-cache')
    .description('Clear plugin discovery cache')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        await clearPluginCache(options);
      })
    );

  pluginCommand
    .command('stats')
    .description('Show plugin lifecycle statistics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showPluginStats(options);
      })
    );

  pluginCommand
    .command('reload <plugin>')
    .description('Reload a plugin')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await reloadPlugin(plugin, options);
      })
    );

  pluginCommand
    .command('hooks [plugin]')
    .description('Show plugin hooks')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await showPluginHooks(plugin, options);
      })
    );

  pluginCommand
    .command('execute-hook <hook-type> [data]')
    .description('Execute a hook manually')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (hookType, data, options) => {
        await executeHook(hookType, data, options);
      })
    );

  pluginCommand
    .command('hook-types')
    .description('List available hook types')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await listHookTypes(options);
      })
    );

  pluginCommand
    .command('resolve <plugin>')
    .description('Resolve plugin dependencies')
    .option('--strategy <strategy>', 'Resolution strategy (strict, loose, latest)', 'strict')
    .option('--allow-prerelease', 'Allow prerelease versions')
    .option('--ignore-optional', 'Ignore optional dependencies')
    .option('--auto-install', 'Automatically install missing dependencies')
    .option('--dry-run', 'Show what would be installed without installing')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await resolveDependencies(plugin, options);
      })
    );

  pluginCommand
    .command('deps [plugin]')
    .description('Show dependency tree')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await showDependencyTree(plugin, options);
      })
    );

  pluginCommand
    .command('conflicts')
    .description('Check for dependency conflicts')
    .option('--strategy <strategy>', 'Resolution strategy (strict, loose, latest)', 'strict')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await checkConflicts(options);
      })
    );

  pluginCommand
    .command('validate-versions')
    .description('Validate plugin versions')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await validateVersions(options);
      })
    );

  pluginCommand
    .command('update-deps <plugin>')
    .description('Update plugin dependencies')
    .option('--dry-run', 'Show what would be updated without updating')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await updateDependencies(plugin, options);
      })
    );

  pluginCommand
    .command('security-scan [plugin]')
    .description('Scan plugins for security issues')
    .option('--severity <level>', 'Filter by severity (low, medium, high, critical)')
    .option('--include-warnings', 'Include security warnings')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await scanPluginSecurity(plugin, options);
      })
    );

  pluginCommand
    .command('security-policy')
    .description('Check security policy compliance')
    .option('--policy <file>', 'Custom security policy file')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await checkSecurityPolicy(options);
      })
    );

  pluginCommand
    .command('security-report')
    .description('Generate comprehensive security report')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await generateSecurityReport(options);
      })
    );

  pluginCommand
    .command('security-fix [plugin]')
    .description('Analyze and fix security issues')
    .option('--fix', 'Apply automatic fixes')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await fixSecurityIssues(plugin, options);
      })
    );

  // Plugin marketplace commands
  pluginCommand
    .command('search [query]')
    .description('Search plugins in marketplace')
    .option('--category <category>', 'Filter by category')
    .option('--featured', 'Show only featured plugins')
    .option('--verified', 'Show only verified plugins')
    .option('--free', 'Show only free plugins')
    .option('--sort <field>', 'Sort by field (relevance, downloads, rating, updated, created, name)', 'relevance')
    .option('--order <order>', 'Sort order (asc, desc)', 'desc')
    .option('--limit <number>', 'Number of results to show', '10')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (query, options) => {
        await searchMarketplace(query, options);
      })
    );

  pluginCommand
    .command('show <plugin>')
    .description('Show detailed plugin information from marketplace')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await showPluginDetails(plugin, options);
      })
    );

  pluginCommand
    .command('install-marketplace <plugin> [version]')
    .description('Install plugin from marketplace')
    .option('--global', 'Install globally')
    .option('--force', 'Force installation')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, version, options) => {
        await installMarketplacePlugin(plugin, version, options);
      })
    );

  pluginCommand
    .command('reviews <plugin>')
    .description('Show plugin reviews from marketplace')
    .option('--limit <number>', 'Number of reviews to show', '10')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (plugin, options) => {
        await showPluginReviews(plugin, options);
      })
    );

  pluginCommand
    .command('featured')
    .description('Show featured plugins from marketplace')
    .option('--limit <number>', 'Number of plugins to show', '6')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showFeaturedPlugins(options);
      })
    );

  pluginCommand
    .command('popular [category]')
    .description('Show popular plugins from marketplace')
    .option('--limit <number>', 'Number of plugins to show', '10')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (category, options) => {
        await showPopularPlugins(category, options);
      })
    );

  pluginCommand
    .command('categories')
    .description('Show available plugin categories')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showCategories(options);
      })
    );

  pluginCommand
    .command('clear-marketplace-cache')
    .description('Clear marketplace cache')
    .action(
      createAsyncCommand(async () => {
        await clearMarketplaceCache();
      })
    );

  pluginCommand
    .command('marketplace-stats')
    .description('Show marketplace statistics')
    .action(
      createAsyncCommand(async () => {
        await showMarketplaceStats();
      })
    );

  // Plugin command registration commands
  pluginCommand
    .command('commands')
    .description('List registered plugin commands')
    .option('--plugin <name>', 'Filter by plugin name')
    .option('--category <category>', 'Filter by command category')
    .option('--active', 'Show only active commands')
    .option('--conflicts', 'Show only commands with conflicts')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await listPluginCommands(options);
      })
    );

  pluginCommand
    .command('command-conflicts')
    .description('Show command registration conflicts')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showCommandConflicts(options);
      })
    );

  pluginCommand
    .command('resolve-conflicts <command> <resolution>')
    .description('Resolve command conflicts (resolution: disable, priority)')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (commandName, resolution, options) => {
        await resolveCommandConflicts(commandName, resolution, options);
      })
    );

  pluginCommand
    .command('command-stats')
    .description('Show command registry statistics')
    .option('--usage', 'Include usage statistics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showCommandStats(options);
      })
    );

  pluginCommand
    .command('register-command <plugin> <definition>')
    .description('Register a test command from plugin (JSON definition)')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (plugin, definition, options) => {
        await registerTestCommand(plugin, definition, options);
      })
    );

  pluginCommand
    .command('unregister-command <commandId>')
    .description('Unregister a plugin command')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (commandId, options) => {
        await unregisterCommand(commandId, options);
      })
    );

  pluginCommand
    .command('command-info <commandId>')
    .description('Show detailed information about a command')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (commandId, options) => {
        await showCommandInfo(commandId, options);
      })
    );

  // Plugin middleware commands
  pluginCommand
    .command('middleware')
    .description('List registered command middleware')
    .option('--type <type>', 'Filter by middleware type')
    .option('--plugin <name>', 'Filter by plugin name')
    .option('--active', 'Show only active middleware')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await listMiddleware(options);
      })
    );

  pluginCommand
    .command('middleware-stats')
    .description('Show middleware system statistics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showMiddlewareStats(options);
      })
    );

  pluginCommand
    .command('test-middleware <type> <testData>')
    .description('Test middleware execution with sample data (JSON)')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (type, testData, options) => {
        await testMiddleware(type, testData, options);
      })
    );

  pluginCommand
    .command('clear-middleware-cache')
    .description('Clear middleware cache')
    .action(
      createAsyncCommand(async () => {
        await clearMiddlewareCache();
      })
    );

  pluginCommand
    .command('middleware-chain <command>')
    .description('Show middleware execution chain for a command')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (commandName, options) => {
        await showMiddlewareChain(commandName, options);
      })
    );

  pluginCommand
    .command('middleware-example <type>')
    .description('Show example middleware code (types: validation, authorization, rateLimit, cache, logger, transform, custom)')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (type, options) => {
        await createExampleMiddleware(type, options);
      })
    );

  // Plugin conflict resolution commands
  pluginCommand
    .command('list-conflicts')
    .description('List command conflicts and their resolution status')
    .option('--type <type>', 'Filter by conflict type')
    .option('--severity <severity>', 'Filter by conflict severity')
    .option('--auto-resolvable', 'Show only auto-resolvable conflicts')
    .option('--resolved', 'Show only resolved conflicts')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await listCommandConflicts(options);
      })
    );

  pluginCommand
    .command('conflict-strategies')
    .description('Show available conflict resolution strategies')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showConflictStrategies(options);
      })
    );

  pluginCommand
    .command('resolve-conflict <conflictId> <strategy>')
    .description('Resolve a specific conflict using given strategy')
    .option('--dry-run', 'Simulate resolution without applying changes')
    .option('--confirm', 'Skip confirmation prompts')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (conflictId, strategy, options) => {
        await resolveConflict(conflictId, strategy, options);
      })
    );

  pluginCommand
    .command('auto-resolve')
    .description('Automatically resolve all auto-resolvable conflicts')
    .option('--dry-run', 'Simulate resolution without applying changes')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        await autoResolveConflicts(options);
      })
    );

  pluginCommand
    .command('conflict-stats')
    .description('Show conflict resolution statistics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showConflictStats(options);
      })
    );

  pluginCommand
    .command('set-priority <commandId> <priority>')
    .description('Set priority override for a command')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (commandId, priority, options) => {
        await setPriorityOverride(commandId, priority, options);
      })
    );

  pluginCommand
    .command('resolution-history')
    .description('Show conflict resolution history')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showResolutionHistory(options);
      })
    );

  // Plugin documentation commands
  pluginCommand
    .command('generate-docs [commands...]')
    .description('Generate documentation for plugin commands')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .option('--format <format>', 'Documentation format (markdown, html, json, plain-text, man-page)', 'markdown')
    .option('--output <dir>', 'Output directory for generated files')
    .option('--template <template>', 'Documentation template to use', 'markdown')
    .option('--include-private', 'Include private/hidden commands')
    .option('--include-deprecated', 'Include deprecated commands')
    .option('--no-examples', 'Exclude examples from documentation')
    .option('--no-index', 'Skip generating documentation index')
    .action(
      createAsyncCommand(async (commands, options) => {
        await generatePluginDocumentation(commands, options);
      })
    );

  pluginCommand
    .command('help <command>')
    .description('Show detailed help for a specific command')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .option('--mode <mode>', 'Help display mode (compact, detailed, interactive, hierarchical)', 'detailed')
    .action(
      createAsyncCommand(async (command, options) => {
        await showCommandHelp(command, options);
      })
    );

  pluginCommand
    .command('list-docs')
    .description('List all documented commands')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .option('--plugin <plugin>', 'Filter by plugin name')
    .option('--category <category>', 'Filter by command category')
    .option('--complexity <complexity>', 'Filter by complexity (basic, intermediate, advanced)')
    .action(
      createAsyncCommand(async (options) => {
        await listDocumentedCommands(options);
      })
    );

  pluginCommand
    .command('search-docs <query>')
    .description('Search documentation for commands and topics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .option('--plugin <plugin>', 'Filter by plugin name')
    .option('--category <category>', 'Filter by command category')
    .option('--complexity <complexity>', 'Filter by complexity level')
    .action(
      createAsyncCommand(async (query, options) => {
        await searchDocumentation(query, options);
      })
    );

  pluginCommand
    .command('docs-stats')
    .description('Show documentation coverage and statistics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showDocumentationStats(options);
      })
    );

  pluginCommand
    .command('configure-help <setting> <value>')
    .description('Configure help system behavior')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (setting, value, options) => {
        await configureHelpSystem(setting, value, options);
      })
    );

  pluginCommand
    .command('docs-templates')
    .description('Show available documentation templates')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showDocumentationTemplates(options);
      })
    );

  // Plugin validation commands
  pluginCommand
    .command('test-validation <command> <testData>')
    .description('Test command validation with sample data (JSON format)')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .option('--dry-run', 'Simulate validation without applying changes')
    .option('--strict', 'Enable strict validation mode')
    .action(
      createAsyncCommand(async (command, testData, options) => {
        await testCommandValidation(command, testData, options);
      })
    );

  pluginCommand
    .command('create-schema <command> <schemaDefinition>')
    .description('Create validation schema for a command (JSON format)')
    .option('--verbose', 'Show detailed information')
    .option('--dry-run', 'Show what would be created without applying')
    .action(
      createAsyncCommand(async (command, schemaDefinition, options) => {
        await createCommandValidationSchema(command, schemaDefinition, options);
      })
    );

  pluginCommand
    .command('validation-rules')
    .description('List available validation rules')
    .option('--verbose', 'Show detailed information and examples')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await listValidationRules(options);
      })
    );

  pluginCommand
    .command('transformations')
    .description('List available parameter transformations')
    .option('--verbose', 'Show detailed information and examples')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await listTransformations(options);
      })
    );

  pluginCommand
    .command('show-schema <command>')
    .description('Show validation schema for a command')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (command, options) => {
        await showCommandValidationSchema(command, options);
      })
    );

  pluginCommand
    .command('validation-stats')
    .description('Show validation system statistics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showValidationStats(options);
      })
    );

  pluginCommand
    .command('generate-template <command>')
    .description('Generate validation schema template for a command')
    .option('--verbose', 'Show detailed information and usage examples')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (command, options) => {
        await generateValidationTemplate(command, options);
      })
    );

  // Plugin cache commands
  pluginCommand
    .command('cache-stats')
    .description('Show command cache statistics and performance metrics')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await showCacheStats(options);
      })
    );

  pluginCommand
    .command('configure-cache <setting> <value>')
    .description('Configure cache system settings')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (setting, value, options) => {
        await configureCacheSettings(setting, value, options);
      })
    );

  pluginCommand
    .command('clear-command-cache')
    .description('Clear command cache')
    .option('--verbose', 'Show detailed information')
    .option('--command <command>', 'Clear cache for specific command')
    .option('--tags <tags>', 'Clear cache for specific tags (comma-separated)')
    .option('--force', 'Confirm cache clearing operation')
    .action(
      createAsyncCommand(async (options) => {
        await clearCache(options);
      })
    );

  pluginCommand
    .command('test-cache <iterations>')
    .description('Test cache performance with specified number of iterations')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (iterations, options) => {
        await testCachePerformance(iterations, options);
      })
    );

  pluginCommand
    .command('optimize-cache')
    .description('Analyze and optimize cache configuration')
    .option('--verbose', 'Show detailed information')
    .option('--force', 'Apply optimizations automatically')
    .action(
      createAsyncCommand(async (options) => {
        await optimizeCache(options);
      })
    );

  pluginCommand
    .command('list-cached')
    .description('List cached command results')
    .option('--verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .option('--include-errors', 'Include failed command results')
    .action(
      createAsyncCommand(async (options) => {
        await listCachedCommands(options);
      })
    );

  program.addCommand(pluginCommand);
}
