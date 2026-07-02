import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync, exec, spawn } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { RECOGNIZED_PKG_SCOPES } from './scope';
import { 
  PluginLifecycleManager, 
  PluginState, 
  ManagedPluginRegistration,
  createPluginLifecycleManager
} from './plugin-lifecycle';
import {
  PluginHookSystem,
  PluginHookAPI,
  HookType,
  HookResult,
  createHookSystem
} from './plugin-hooks';
import { 
  PluginDependencyResolver,
  createDependencyResolver,
  ResolutionResult
} from './plugin-dependency';

// Plugin interface definitions

/**
 * Represents the manifest describing a Re-Shell plugin, typically read from a
 * `package.json` or `plugin.json` file.
 */
export interface PluginManifest {
  /** Unique name of the plugin package. */
  name: string;
  /** Semantic version string of the plugin. */
  version: string;
  /** Human-readable summary of what the plugin does. */
  description: string;
  /** Optional author or maintainer of the plugin. */
  author?: string;
  /** Optional SPDX license identifier. */
  license?: string;
  /** Optional URL to the plugin's homepage or repository. */
  homepage?: string;
  /** Optional list of npm keywords used for discovery. */
  keywords?: string[];
  /** Relative path to the plugin's main entry point. */
  main: string;
  /** Optional map of binary command names to executables. */
  bin?: Record<string, string>;
  /** Optional engine compatibility constraints. */
  engines?: {
    /** Required re-shell CLI version range. */
    'reshell-cli'?: string;
    /** Required Node.js version range. */
    node?: string;
  };
  /** Optional runtime dependencies of the plugin. */
  dependencies?: Record<string, string>;
  /** Optional peer dependencies of the plugin. */
  peerDependencies?: Record<string, string>;
  /** Re-Shell-specific configuration block. */
  reshell?: {
    /** CLI version compatibility range. */
    compatibility?: string;
    /** List of hook names the plugin subscribes to. */
    hooks?: string[];
    /** List of CLI commands the plugin provides. */
    commands?: string[];
    /** Permissions required by the plugin. */
    permissions?: PluginPermission[];
    /** Configuration schema for the plugin. */
    config?: PluginConfigSchema;
    /** Optional map of companion plugin dependencies. */
    plugins?: Record<string, string>;
  };
}

/**
 * Describes a single permission grant requested by a plugin.
 */
export interface PluginPermission {
  /** Category of the resource being accessed. */
  type: 'filesystem' | 'network' | 'process' | 'environment' | 'workspace';
  /** Specific resource identifier (e.g. path or hostname), when applicable. */
  resource?: string;
  /** Level of access requested for the resource. */
  access: 'read' | 'write' | 'execute' | 'full';
  /** Human-readable explanation of why the permission is needed. */
  description: string;
}

/**
 * JSON-schema-like definition for a plugin's configuration object.
 */
export interface PluginConfigSchema {
  /** Always set to `'object'` for plugin configuration. */
  type: 'object';
  /** Property definitions keyed by option name. */
  properties: Record<string, unknown>;
  /** Optional list of required property names. */
  required?: string[];
  /** Whether properties not listed in `properties` are allowed. */
  additionalProperties?: boolean;
}

/**
 * Context object passed to a plugin during activation, providing access to the
 * CLI environment, plugin-specific paths, logging, hooks, and utilities.
 */
export interface PluginContext {
  /** Information about the host CLI environment. */
  cli: {
    /** CLI version string. */
    version: string;
    /** Absolute path to the project root. */
    rootPath: string;
    /** Absolute path to the `.re-shell` configuration directory. */
    configPath: string;
    /** Known workspace definitions. */
    workspaces: Record<string, unknown>;
  };
  /** Information about the plugin being activated. */
  plugin: {
    /** Name of the plugin. */
    name: string;
    /** Version of the plugin. */
    version: string;
    /** Plugin-specific configuration values. */
    config: Record<string, unknown>;
    /** Directory where plugin data may be persisted. */
    dataPath: string;
    /** Directory where plugin cache files may be stored. */
    cachePath: string;
  };
  /** Logger scoped to the plugin. */
  logger: PluginLogger;
  /** Hook registration API available to the plugin. */
  hooks: PluginHookSystemInterface;
  /** Shared utility helpers. */
  utils: PluginUtils;
}

/**
 * Logging interface available to plugins for emitting messages at varying
 * severity levels.
 */
export interface PluginLogger {
  /** Log a debug-level message. */
  debug(message: string, ...args: unknown[]): void;
  /** Log an informational message. */
  info(message: string, ...args: unknown[]): void;
  /** Log a warning message. */
  warn(message: string, ...args: unknown[]): void;
  /** Log an error message. */
  error(message: string, ...args: unknown[]): void;
}

/**
 * Subset of the hook system exposed to plugins for registering handlers on
 * CLI lifecycle events.
 */
export interface PluginHookSystemInterface {
  /**
   * Register a handler for a named hook.
   * @param hookName - Name of the hook to subscribe to.
   * @param handler - Function invoked when the hook executes.
   * @param options - Optional registration options.
   * @returns Identifier for the registered handler.
   */
  register(hookName: string, handler: (...args: unknown[]) => unknown, options?: unknown): string;
  /**
   * Remove a previously registered hook handler.
   * @param hookName - Name of the hook.
   * @param handlerId - Identifier returned by `register`.
   * @returns `true` if the handler was removed.
   */
  unregister(hookName: string, handlerId: string): boolean;
  /**
   * Asynchronously execute all handlers for a hook.
   * @param hookName - Name of the hook to execute.
   * @param data - Optional payload passed to each handler.
   * @returns Aggregated result of the hook execution.
   */
  execute(hookName: string, data?: unknown): Promise<unknown>;
  /**
   * Synchronously execute all handlers for a hook.
   * @param hookName - Name of the hook to execute.
   * @param data - Optional payload passed to each handler.
   * @returns Array of handler return values.
   */
  executeSync(hookName: string, data?: unknown): unknown[];
  /**
   * Register a handler invoked when a CLI command is run.
   * @param command - Command name to listen for.
   * @param handler - Function invoked with command arguments.
   * @param options - Optional registration options.
   * @returns Identifier for the registered handler.
   */
  onCommand(command: string, handler: (...args: unknown[]) => unknown, options?: unknown): string;
  /**
   * Register a handler invoked when matching files change.
   * @param pattern - Glob string or RegExp used to match file paths.
   * @param handler - Function invoked on matching file changes.
   * @param options - Optional registration options.
   * @returns Identifier for the registered handler.
   */
  onFileChange(pattern: RegExp | string, handler: (...args: unknown[]) => unknown, options?: unknown): string;
  /**
   * Register a handler invoked during a workspace build.
   * @param workspace - Name of the workspace to listen to.
   * @param handler - Function invoked during the build lifecycle.
   * @param options - Optional registration options.
   * @returns Identifier for the registered handler.
   */
  onWorkspaceBuild(workspace: string, handler: (...args: unknown[]) => unknown, options?: unknown): string;
  /**
   * Return metadata about all registered hooks.
   * @returns Array of hook descriptors.
   */
  getHooks(): unknown[];
  /**
   * Register a new custom hook name so plugins can subscribe to it.
   * @param name - Name of the custom hook.
   * @returns Identifier for the registered custom hook.
   */
  registerCustomHook(name: string): string;
}

/**
 * Collection of utility helpers exposed to plugins for filesystem access,
 * terminal coloring, and process spawning.
 */
export interface PluginUtils {
  /** Reference to Node's `path` module. */
  path: typeof path;
  /** Reference to the `fs-extra` module. */
  fs: typeof fs;
  /** Reference to the `chalk` coloring library. */
  chalk: typeof chalk;
  /**
   * Execute a shell command and return its output.
   * @param command - Command line string to execute.
   * @param options - Optional exec options.
   * @returns Object containing `stdout` and `stderr` strings.
   */
  exec(command: string, options?: unknown): Promise<{ stdout: string; stderr: string }>;
  /**
   * Spawn a child process and resolve with its exit code.
   * @param command - Executable to run.
   * @param args - Arguments to pass to the executable.
   * @param options - Optional spawn options.
   * @returns Exit code of the spawned process.
   */
  spawn(command: string, args: string[], options?: unknown): Promise<number>;
}

/**
 * Contract implemented by a Re-Shell plugin module.
 */
export interface Plugin {
  /** Manifest describing the plugin. */
  manifest: PluginManifest;
  /**
   * Called when the plugin is activated by the registry.
   * @param context - Context providing CLI environment and helpers.
   */
  activate(context: PluginContext): Promise<void> | void;
  /**
   * Optional cleanup hook called when the plugin is deactivated.
   * @param context - Context providing CLI environment and helpers.
   */
  deactivate?(context: PluginContext): Promise<void> | void;
  /**
   * Optional handler invoked when a CLI command is dispatched to the plugin.
   * @param command - Name of the command.
   * @param args - Arguments passed to the command.
   * @param context - Context providing CLI environment and helpers.
   */
  onCommand?(command: string, args: unknown[], context: PluginContext): Promise<unknown> | unknown;
  /**
   * Optional handler invoked when a subscribed hook fires.
   * @param hookName - Name of the hook being executed.
   * @param data - Payload for the hook invocation.
   * @param context - Context providing CLI environment and helpers.
   */
  onHook?(hookName: string, data: unknown, context: PluginContext): Promise<unknown> | unknown;
}

/**
 * Tracks the runtime state of a plugin that has been discovered or registered
 * with the registry.
 */
export interface PluginRegistration {
  /** Manifest describing the plugin. */
  manifest: PluginManifest;
  /** Absolute path to the plugin on disk. */
  pluginPath: string;
  /** Whether the plugin module has been loaded into memory. */
  isLoaded: boolean;
  /** Whether the plugin is currently active. */
  isActive: boolean;
  /** Instantiated plugin instance, if loaded. */
  instance?: Plugin;
  /** Error encountered while loading the plugin, if any. */
  loadError?: Error;
  /** Error encountered while activating the plugin, if any. */
  activationError?: Error;
  /** Timestamp of the last time the plugin was used. */
  lastUsed?: number;
  /** Number of times the plugin has been invoked. */
  usageCount: number;
}

/**
 * Result returned from a plugin discovery operation, aggregating found
 * plugins and any errors or skipped paths encountered.
 */
export interface PluginDiscoveryResult {
  /** Successfully discovered plugin registrations. */
  found: PluginRegistration[];
  /** Errors encountered per path during discovery. */
  errors: Array<{ path: string; error: Error }>;
  /** Paths skipped during discovery and the reason they were skipped. */
  skipped: Array<{ path: string; reason: string }>;
}

/**
 * Identifies the source from which a plugin was discovered.
 */
export type PluginSource = 'local' | 'npm' | 'git' | 'builtin';

/**
 * Options controlling how plugin discovery is performed.
 */
export interface PluginDiscoveryOptions {
  /** Sources to scan during discovery. */
  sources?: PluginSource[];
  /** Whether to include plugins that are currently disabled. */
  includeDisabled?: boolean;
  /** Whether to include dev-only plugins. */
  includeDev?: boolean;
  /** Maximum directory depth to traverse while scanning. */
  maxDepth?: number;
  /** Maximum time in milliseconds before a scan times out. */
  timeout?: number;
  /** Whether to use cached discovery results when available. */
  useCache?: boolean;
  /** Maximum age in milliseconds of a cached result before it is refreshed. */
  cacheMaxAge?: number;
}

/**
 * Central registry and discovery system for Re-Shell plugins. Manages plugin
 * discovery, registration, lifecycle, hooks, and dependency resolution.
 */
export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, PluginRegistration> = new Map();
  private discoveryCache: Map<string, PluginDiscoveryResult> = new Map();
  private lifecycleManager: PluginLifecycleManager;
  private hookSystem: PluginHookSystem;
  private dependencyResolver: PluginDependencyResolver;
  private rootPath: string;
  private pluginPaths: string[];
  private isInitialized = false;

  /**
   * Create a new PluginRegistry.
   * @param rootPath - Project root used for plugin discovery. Defaults to `process.cwd()`.
   */
  constructor(rootPath: string = process.cwd()) {
    super();
    this.rootPath = rootPath;
    this.pluginPaths = this.getDefaultPluginPaths();
    this.lifecycleManager = createPluginLifecycleManager({
      timeout: 30000,
      validateSecurity: true,
      enableHotReload: process.env.NODE_ENV === 'development'
    });
    
    this.hookSystem = createHookSystem({
      debugMode: process.env.NODE_ENV === 'development'
    });
    
    this.dependencyResolver = createDependencyResolver({
      strategy: 'strict',
      allowPrerelease: false,
      preferStable: true,
      maxDepth: 10
    });
    
    // Forward lifecycle events
    this.lifecycleManager.on('state-changed', (event) => {
      this.emit('plugin-state-changed', event);
      
      // Emit hook events for plugin lifecycle changes
      this.hookSystem.execute(HookType.PLUGIN_LOAD, { plugin: event.pluginName, state: event.newState });
    });
    
    // Forward hook system events
    this.hookSystem.on('hook-registered', (event) => {
      this.emit('hook-registered', event);
    });
  }

  /**
   * Build the list of default directories searched for plugins.
   * @returns Array of existing plugin directory paths.
   */
  private getDefaultPluginPaths(): string[] {
    const paths: string[] = [];
    
    // Local project plugins
    paths.push(path.join(this.rootPath, '.re-shell', 'plugins'));
    paths.push(path.join(this.rootPath, 'plugins'));
    
    // Global CLI plugins
    const globalPaths = this.getGlobalPluginPaths();
    paths.push(...globalPaths);
    
    // Built-in plugins
    paths.push(path.join(__dirname, '..', 'plugins'));
    
    return paths.filter(p => fs.existsSync(p));
  }

  /**
   * Determine global plugin search paths based on npm configuration and the
   * host operating system.
   * @returns Array of global plugin directory paths.
   */
  private getGlobalPluginPaths(): string[] {
    const paths: string[] = [];
    
    try {
      // npm global modules
      const npmGlobal = execSync('npm root -g', { encoding: 'utf8' }).trim();
      paths.push(path.join(npmGlobal, '@re-shell'));

      // User's home directory
      const homeDir = os.homedir();
      paths.push(path.join(homeDir, '.re-shell', 'plugins'));
      
      // System-wide plugins (Unix-like systems)
      if (process.platform !== 'win32') {
        paths.push('/usr/local/share/re-shell/plugins');
        paths.push('/usr/share/re-shell/plugins');
      }
      
    } catch (error) {
      // Ignore errors in path detection
    }
    
    return paths;
  }

  /**
   * Initialize the registry by preparing directories, discovering plugins,
   * and registering them with the lifecycle manager. Safe to call multiple
   * times; subsequent calls are no-ops.
   * @returns Resolves once initialization is complete.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize lifecycle manager
      await this.lifecycleManager.initialize();
      
      // Ensure plugin directories exist
      await this.ensurePluginDirectories();
      
      // Discover plugins
      const discoveryResult = await this.discoverPlugins();
      
      // Register discovered plugins with both registry and lifecycle manager
      for (const plugin of discoveryResult.found) {
        this.plugins.set(plugin.manifest.name, plugin);
        await this.lifecycleManager.registerPlugin(plugin);
      }
      
      // Report discovery results
      this.emit('initialized', {
        totalPlugins: this.plugins.size,
        errors: discoveryResult.errors.length,
        skipped: discoveryResult.skipped.length
      });
      
      this.isInitialized = true;
      
    } catch (error) {
      this.emit('error', new ValidationError(
        `Failed to initialize plugin registry: ${error instanceof Error ? error.message : String(error)}`
      ));
      throw error;
    }
  }

  /**
   * Ensure that the local plugin directory and default `plugins.json`
   * configuration file exist, creating them with defaults when missing.
   * @returns Resolves once directories and config are ensured.
   */
  private async ensurePluginDirectories(): Promise<void> {
    const localPluginPath = path.join(this.rootPath, '.re-shell', 'plugins');
    await fs.ensureDir(localPluginPath);
    
    // Create default plugin structure
    const pluginConfigPath = path.join(this.rootPath, '.re-shell', 'plugins.json');
    if (!await fs.pathExists(pluginConfigPath)) {
      await fs.writeJSON(pluginConfigPath, {
        version: '1.0.0',
        plugins: {},
        disabled: [],
        settings: {
          autoUpdate: false,
          security: {
            allowUnverified: false,
            trustedSources: ['npm', 'builtin']
          }
        }
      }, { spaces: 2 });
    }
  }

  /**
   * Discover plugins from all configured sources, optionally using cached
   * results.
   * @param options - Discovery options controlling sources, caching, and scope.
   * @returns Aggregated discovery result including found plugins, errors, and skipped paths.
   */
  async discoverPlugins(options: PluginDiscoveryOptions = {}): Promise<PluginDiscoveryResult> {
    const {
      sources = ['local', 'npm', 'builtin'],
      includeDisabled = false,
      includeDev = true,
      maxDepth = 3,
      timeout = 10000,
      useCache = true,
      cacheMaxAge = 300000 // 5 minutes
    } = options;

    const cacheKey = JSON.stringify({ sources, includeDisabled, includeDev });
    
    // Check cache if enabled
    if (useCache && this.discoveryCache.has(cacheKey)) {
      const cached = this.discoveryCache.get(cacheKey)!;
      if (Date.now() - (cached as PluginDiscoveryResult & { timestamp?: number }).timestamp < cacheMaxAge) {
        return cached;
      }
    }

    const result: PluginDiscoveryResult = {
      found: [],
      errors: [],
      skipped: []
    };

    // Discover from each source
    for (const source of sources) {
      try {
        const sourceResult = await this.discoverFromSource(source, {
          includeDisabled,
          includeDev,
          maxDepth,
          timeout
        });
        
        result.found.push(...sourceResult.found);
        result.errors.push(...sourceResult.errors);
        result.skipped.push(...sourceResult.skipped);
        
      } catch (error) {
        result.errors.push({
          path: source,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    // Remove duplicates (prefer local over global)
    result.found = this.deduplicatePlugins(result.found);

    // Cache result
    if (useCache) {
      (result as PluginDiscoveryResult & { timestamp?: number }).timestamp = Date.now();
      this.discoveryCache.set(cacheKey, result);
    }

    this.emit('discovery-completed', result);
    
    return result;
  }

  /**
   * Dispatch discovery to the handler for a specific plugin source.
   * @param source - Source type to discover from.
   * @param options - Discovery options for this source.
   * @returns Discovery result for the requested source.
   */
  private async discoverFromSource(
    source: PluginSource,
    options: { includeDisabled: boolean; includeDev: boolean; maxDepth: number; timeout: number }
  ): Promise<PluginDiscoveryResult> {
    switch (source) {
      case 'local':
        return this.discoverLocalPlugins(options);
      case 'npm':
        return this.discoverNpmPlugins(options);
      case 'builtin':
        return this.discoverBuiltinPlugins(options);
      default:
        throw new Error(`Unknown plugin source: ${source}`);
    }
  }

  /**
   * Discover plugins located in the project's local plugin directories.
   * @param options - Discovery options.
   * @returns Discovery result for local plugins.
   */
  private async discoverLocalPlugins(options: PluginDiscoveryOptions): Promise<PluginDiscoveryResult> {
    const result: PluginDiscoveryResult = { found: [], errors: [], skipped: [] };
    
    const localPaths = [
      path.join(this.rootPath, '.re-shell', 'plugins'),
      path.join(this.rootPath, 'plugins')
    ];

    for (const basePath of localPaths) {
      if (!await fs.pathExists(basePath)) continue;

      try {
        const entries = await fs.readdir(basePath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          
          const pluginPath = path.join(basePath, entry.name);
          const manifestPath = path.join(pluginPath, 'package.json');
          
          if (!await fs.pathExists(manifestPath)) {
            result.skipped.push({
              path: pluginPath,
              reason: 'No package.json found'
            });
            continue;
          }

          try {
            const manifestData = await fs.readJSON(manifestPath);
            const manifest = this.validateManifest(manifestData);
            
            result.found.push({
              manifest,
              pluginPath,
              isLoaded: false,
              isActive: false,
              usageCount: 0
            });
            
          } catch (error) {
            result.errors.push({
              path: pluginPath,
              error: error instanceof Error ? error : new Error(String(error))
            });
          }
        }
        
      } catch (error) {
        result.errors.push({
          path: basePath,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    return result;
  }

  /**
   * Discover plugins installed via npm in local and global `node_modules`.
   * @param options - Discovery options.
   * @returns Discovery result for npm-installed plugins.
   */
  private async discoverNpmPlugins(options: PluginDiscoveryOptions): Promise<PluginDiscoveryResult> {
    const result: PluginDiscoveryResult = { found: [], errors: [], skipped: [] };

    try {
      // Search for packages with 'reshell-plugin' keyword

      // Check local node_modules first
      const localNodeModules = path.join(this.rootPath, 'node_modules');
      if (await fs.pathExists(localNodeModules)) {
        const localResult = await this.scanNodeModules(localNodeModules);
        result.found.push(...localResult.found);
        result.errors.push(...localResult.errors);
        result.skipped.push(...localResult.skipped);
      }

      // Check global node_modules
      try {
        const globalNodeModules = execSync('npm root -g', { encoding: 'utf8' }).trim();
        if (await fs.pathExists(globalNodeModules)) {
          const globalResult = await this.scanNodeModules(globalNodeModules);
          result.found.push(...globalResult.found);
          result.errors.push(...globalResult.errors);
          result.skipped.push(...globalResult.skipped);
        }
      } catch (error) {
        // Ignore global npm errors
      }

    } catch (error) {
      result.errors.push({
        path: 'npm',
        error: error instanceof Error ? error : new Error(String(error))
      });
    }

    return result;
  }

  /**
   * Scan a `node_modules` directory tree for Re-Shell plugins, including
   * scoped packages.
   * @param nodeModulesPath - Path to the `node_modules` directory to scan.
   * @returns Discovery result for plugins found within the directory.
   */
  private async scanNodeModules(nodeModulesPath: string): Promise<PluginDiscoveryResult> {
    const result: PluginDiscoveryResult = { found: [], errors: [], skipped: [] };

    try {
      const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const packagePath = path.join(nodeModulesPath, entry.name);
        
        // Handle scoped packages
        if (entry.name.startsWith('@')) {
          const scopedEntries = await fs.readdir(packagePath, { withFileTypes: true });
          for (const scopedEntry of scopedEntries) {
            if (!scopedEntry.isDirectory()) continue;
            
            const scopedPackagePath = path.join(packagePath, scopedEntry.name);
            await this.checkPackageForPlugin(scopedPackagePath, result);
          }
        } else {
          await this.checkPackageForPlugin(packagePath, result);
        }
      }
      
    } catch (error) {
      result.errors.push({
        path: nodeModulesPath,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }

    return result;
  }

  /**
   * Inspect a single package directory and, if it is a Re-Shell plugin, add
   * it to the provided discovery result.
   * @param packagePath - Absolute path to the package directory.
   * @param result - Discovery result to append findings to.
   */
  private async checkPackageForPlugin(packagePath: string, result: PluginDiscoveryResult): Promise<void> {
    const manifestPath = path.join(packagePath, 'package.json');
    
    if (!await fs.pathExists(manifestPath)) {
      return;
    }

    try {
      const manifestData = await fs.readJSON(manifestPath);
      
      // Check if it's a Re-Shell plugin
      const isPlugin = manifestData.keywords?.includes('reshell-plugin') ||
                      manifestData.name?.startsWith('reshell-plugin-') ||
                      manifestData.reshell ||
                      // Accept the '@re-shell/' scope
                      RECOGNIZED_PKG_SCOPES.some((scope) => manifestData.name?.startsWith(scope));
      
      if (!isPlugin) {
        return;
      }

      const manifest = this.validateManifest(manifestData);
      
      result.found.push({
        manifest,
        pluginPath: packagePath,
        isLoaded: false,
        isActive: false,
        usageCount: 0
      });
      
    } catch (error) {
      result.errors.push({
        path: packagePath,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  /**
   * Discover plugins bundled with the CLI in its built-in plugins directory.
   * @param options - Discovery options.
   * @returns Discovery result for built-in plugins.
   */
  private async discoverBuiltinPlugins(options: PluginDiscoveryOptions): Promise<PluginDiscoveryResult> {
    const result: PluginDiscoveryResult = { found: [], errors: [], skipped: [] };
    
    const builtinPath = path.join(__dirname, '..', 'plugins');
    
    if (!await fs.pathExists(builtinPath)) {
      return result;
    }

    try {
      const entries = await fs.readdir(builtinPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const pluginPath = path.join(builtinPath, entry.name);
        const manifestPath = path.join(pluginPath, 'plugin.json');
        
        if (!await fs.pathExists(manifestPath)) {
          result.skipped.push({
            path: pluginPath,
            reason: 'No plugin.json found'
          });
          continue;
        }

        try {
          const manifestData = await fs.readJSON(manifestPath);
          const manifest = this.validateManifest(manifestData);
          
          result.found.push({
            manifest,
            pluginPath,
            isLoaded: false,
            isActive: false,
            usageCount: 0
          });
          
        } catch (error) {
          result.errors.push({
            path: pluginPath,
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }
      
    } catch (error) {
      result.errors.push({
        path: builtinPath,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }

    return result;
  }

  /**
   * Remove duplicate plugins, preferring local copies over global ones.
   * @param plugins - List of plugin registrations potentially containing duplicates.
   * @returns De-duplicated list of plugin registrations.
   */
  private deduplicatePlugins(plugins: PluginRegistration[]): PluginRegistration[] {
    const seen = new Map<string, PluginRegistration>();
    
    // Sort by preference: local, npm, builtin
    const sorted = plugins.sort((a, b) => {
      const aIsLocal = a.pluginPath.includes('.re-shell') || a.pluginPath.includes('/plugins');
      const bIsLocal = b.pluginPath.includes('.re-shell') || b.pluginPath.includes('/plugins');
      
      if (aIsLocal && !bIsLocal) return -1;
      if (!aIsLocal && bIsLocal) return 1;
      
      return 0;
    });

    for (const plugin of sorted) {
      const key = plugin.manifest.name;
      if (!seen.has(key)) {
        seen.set(key, plugin);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Validate and normalize raw manifest data into a `PluginManifest`.
   * @param data - Raw manifest object read from disk.
   * @returns Validated plugin manifest.
   */
  private validateManifest(data: Record<string, unknown>): PluginManifest {
    if (!data.name || typeof data.name !== 'string') {
      throw new ValidationError('Plugin manifest must have a valid name');
    }

    if (!data.version || typeof data.version !== 'string') {
      throw new ValidationError('Plugin manifest must have a valid version');
    }

    if (!data.description || typeof data.description !== 'string') {
      throw new ValidationError('Plugin manifest must have a description');
    }

    if (!data.main || typeof data.main !== 'string') {
      throw new ValidationError('Plugin manifest must specify a main entry point');
    }

    return {
      name: data.name,
      version: data.version,
      description: data.description,
      author: data.author as string | undefined,
      license: data.license as string | undefined,
      homepage: data.homepage as string | undefined,
      keywords: (data.keywords as string[] | undefined) || [],
      main: data.main,
      bin: data.bin as Record<string, string> | undefined,
      engines: data.engines as PluginManifest['engines'] | undefined,
      dependencies: data.dependencies as Record<string, string> | undefined,
      peerDependencies: data.peerDependencies as Record<string, string> | undefined,
      reshell: (data.reshell as PluginManifest['reshell']) || {}
    };
  }

  /**
   * Manually register a plugin from a path on disk.
   * @param pluginPath - Absolute path to the plugin directory.
   * @param manifest - Optional pre-parsed manifest. If omitted, the manifest is read from `package.json`.
   * @returns Resolves once the plugin has been registered.
   */
  async registerPlugin(pluginPath: string, manifest?: PluginManifest): Promise<void> {
    try {
      let pluginManifest = manifest;
      
      if (!pluginManifest) {
        const manifestPath = path.join(pluginPath, 'package.json');
        if (!await fs.pathExists(manifestPath)) {
          throw new ValidationError(`No package.json found at ${manifestPath}`);
        }
        
        const manifestData = await fs.readJSON(manifestPath);
        pluginManifest = this.validateManifest(manifestData);
      }

      const registration: PluginRegistration = {
        manifest: pluginManifest,
        pluginPath,
        isLoaded: false,
        isActive: false,
        usageCount: 0
      };

      this.plugins.set(pluginManifest.name, registration);
      this.emit('plugin-registered', registration);
      
    } catch (error) {
      this.emit('error', new ValidationError(
        `Failed to register plugin at ${pluginPath}: ${error instanceof Error ? error.message : String(error)}`
      ));
      throw error;
    }
  }

  /**
   * Unregister a plugin by name, deactivating it first if necessary.
   * @param name - Name of the plugin to unregister.
   * @returns `true` if the plugin was removed, `false` if it was not found.
   */
  async unregisterPlugin(name: string): Promise<boolean> {
    const registration = this.plugins.get(name);
    if (!registration) {
      return false;
    }

    // Deactivate if active
    if (registration.isActive && registration.instance?.deactivate) {
      try {
        await registration.instance.deactivate(this.createPluginContext(registration));
      } catch (error) {
        this.emit('error', error);
      }
    }

    this.plugins.delete(name);
    this.emit('plugin-unregistered', { name, registration });
    
    return true;
  }

  /**
   * Return all currently registered plugins.
   * @returns Array of plugin registrations.
   */
  getPlugins(): PluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Look up a single registered plugin by name.
   * @param name - Name of the plugin to retrieve.
   * @returns The matching registration, or `undefined` if not found.
   */
  getPlugin(name: string): PluginRegistration | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check whether a plugin with the given name is registered.
   * @param name - Name of the plugin to check.
   * @returns `true` if the plugin is registered.
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Return the number of registered plugins.
   * @returns Count of registered plugins.
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Return all currently active plugins.
   * @returns Array of active plugin registrations.
   */
  getActivePlugins(): PluginRegistration[] {
    return Array.from(this.plugins.values()).filter(p => p.isActive);
  }

  /**
   * Clear any cached plugin discovery results.
   */
  clearCache(): void {
    this.discoveryCache.clear();
    this.emit('cache-cleared');
  }

  // Plugin lifecycle management methods

  /**
   * Load a plugin into memory via the lifecycle manager.
   * @param pluginName - Name of the plugin to load.
   * @returns Resolves once the plugin has been loaded.
   */
  async loadPlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.loadPlugin(pluginName);
  }

  /**
   * Initialize a loaded plugin via the lifecycle manager.
   * @param pluginName - Name of the plugin to initialize.
   * @returns Resolves once the plugin has been initialized.
   */
  async initializePlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.initializePlugin(pluginName);
  }

  /**
   * Activate an initialized plugin via the lifecycle manager.
   * @param pluginName - Name of the plugin to activate.
   * @returns Resolves once the plugin has been activated.
   */
  async activatePlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.activatePlugin(pluginName);
  }

  /**
   * Deactivate an active plugin via the lifecycle manager.
   * @param pluginName - Name of the plugin to deactivate.
   * @returns Resolves once the plugin has been deactivated.
   */
  async deactivatePlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.deactivatePlugin(pluginName);
  }

  /**
   * Unload a plugin from memory via the lifecycle manager.
   * @param pluginName - Name of the plugin to unload.
   * @returns Resolves once the plugin has been unloaded.
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.unloadPlugin(pluginName);
  }

  /**
   * Reload a plugin, re-running its full lifecycle via the lifecycle manager.
   * @param pluginName - Name of the plugin to reload.
   * @returns Resolves once the plugin has been reloaded.
   */
  async reloadPlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.reloadPlugin(pluginName);
  }

  /**
   * Return a single managed plugin registration including lifecycle state.
   * @param name - Name of the plugin to retrieve.
   * @returns The managed registration, or `undefined` if not found.
   */
  getManagedPlugin(name: string): ManagedPluginRegistration | undefined {
    return this.lifecycleManager.getPlugin(name);
  }

  /**
   * Return all managed plugin registrations.
   * @returns Array of managed plugin registrations.
   */
  getManagedPlugins(): ManagedPluginRegistration[] {
    return this.lifecycleManager.getPlugins();
  }

  /**
   * Return all managed plugins currently in the given lifecycle state.
   * @param state - Lifecycle state to filter by.
   * @returns Array of managed plugin registrations in the specified state.
   */
  getPluginsByState(state: PluginState): ManagedPluginRegistration[] {
    return this.lifecycleManager.getPluginsByState(state);
  }

  /**
   * Return lifecycle statistics gathered by the lifecycle manager.
   * @returns Statistics describing plugin lifecycle activity.
   */
  getLifecycleStats(): Record<string, unknown> {
    return this.lifecycleManager.getLifecycleStats();
  }

  /**
   * Return the underlying lifecycle manager instance.
   * @returns The plugin lifecycle manager.
   */
  getLifecycleManager(): PluginLifecycleManager {
    return this.lifecycleManager;
  }

  // Hook system methods

  /**
   * Return the registry's hook system.
   * @returns The plugin hook system instance.
   */
  getHookSystem(): PluginHookSystem {
    return this.hookSystem;
  }

  /**
   * Create a scoped hook API for a specific plugin.
   * @param pluginName - Name of the plugin to scope the API to.
   * @returns Hook API scoped to the given plugin.
   */
  createPluginHookAPI(pluginName: string): PluginHookAPI {
    return this.hookSystem.createPluginScope(pluginName);
  }

  /**
   * Execute all handlers registered for a hook type.
   * @param hookType - Hook type or name to execute.
   * @param data - Optional payload passed to each handler.
   * @returns Aggregated result of the hook execution.
   */
  async executeHooks(hookType: HookType | string, data?: Record<string, unknown>): Promise<HookResult> {
    return await this.hookSystem.execute(hookType, data);
  }

  /**
   * Return statistics about hook usage collected by the hook system.
   * @returns Hook statistics.
   */
  getHookStats(): Record<string, unknown> {
    return this.hookSystem.getStats();
  }

  // Dependency resolver methods

  /**
   * Return the registry's dependency resolver.
   * @returns The plugin dependency resolver instance.
   */
  getDependencyResolver(): PluginDependencyResolver {
    return this.dependencyResolver;
  }

  /**
   * Resolve the dependency tree for the named plugin.
   * @param pluginName - Name of the plugin whose dependencies should be resolved.
   * @returns Result of the dependency resolution.
   */
  async resolveDependencies(pluginName: string): Promise<ResolutionResult> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    // Register all plugins with dependency resolver
    this.plugins.forEach(p => this.dependencyResolver.registerPlugin(p));

    return await this.dependencyResolver.resolveDependencies(plugin.manifest);
  }

  /**
   * Return statistics about dependency resolution collected by the resolver.
   * @returns Dependency resolution statistics.
   */
  getDependencyStats(): Record<string, unknown> {
    return this.dependencyResolver.getStats();
  }

  /**
   * Build the activation context for a plugin registration.
   * @param registration - The plugin registration being activated.
   * @returns Plugin context for the registration.
   */
  private createPluginContext(registration: PluginRegistration): PluginContext {
    return {
      cli: {
        version: '0.7.0', // This should come from package.json
        rootPath: this.rootPath,
        configPath: path.join(this.rootPath, '.re-shell'),
        workspaces: {} // This should be loaded from workspace manager
      },
      plugin: {
        name: registration.manifest.name,
        version: registration.manifest.version,
        config: {}, // Plugin-specific configuration
        dataPath: path.join(this.rootPath, '.re-shell', 'data', registration.manifest.name),
        cachePath: path.join(this.rootPath, '.re-shell', 'cache', registration.manifest.name)
      },
      logger: this.createPluginLogger(registration.manifest.name),
      hooks: this.createPluginHookAPI(registration.manifest.name),
      utils: this.createPluginUtils()
    };
  }

  /**
   * Create a prefixed logger instance for a plugin.
   * @param pluginName - Name used to prefix log messages.
   * @returns Logger that prefixes output with the plugin name.
   */
  private createPluginLogger(pluginName: string): PluginLogger {
    const prefix = `[${pluginName}]`;
    
    return {
      debug: (message: string, ...args: unknown[]) => {
        console.debug(chalk.gray(`${prefix} ${message}`), ...args);
      },
      info: (message: string, ...args: unknown[]) => {
        console.info(chalk.blue(`${prefix} ${message}`), ...args);
      },
      warn: (message: string, ...args: unknown[]) => {
        console.warn(chalk.yellow(`${prefix} ${message}`), ...args);
      },
      error: (message: string, ...args: unknown[]) => {
        console.error(chalk.red(`${prefix} ${message}`), ...args);
      }
    };
  }

  /**
   * Build the shared utilities object exposed to plugins.
   * @returns Utilities including `path`, `fs`, `chalk`, `exec`, and `spawn`.
   */
  private createPluginUtils(): PluginUtils {
    const execAsync = promisify(exec);
    
    return {
      path,
      fs,
      chalk,
      exec: execAsync,
      spawn: (command: string, args: string[], options?: unknown): Promise<number> => {
        return new Promise((resolve, reject) => {
          const child = spawn(command, args, options);
          child.on('exit', (code: number | null) => resolve(code || 0));
          child.on('error', reject);
        });
      }
    };
  }
}

// Utility functions

/**
 * Factory that creates a new `PluginRegistry` instance.
 * @param rootPath - Optional project root path. Defaults to `process.cwd()`.
 * @returns A new plugin registry.
 */
export function createPluginRegistry(rootPath?: string): PluginRegistry {
  return new PluginRegistry(rootPath);
}

/**
 * Convenience helper that discovers plugins for the given project root.
 * @param rootPath - Optional project root path. Defaults to `process.cwd()`.
 * @param options - Optional discovery options.
 * @returns Discovery result for the requested root.
 */
export async function discoverPlugins(
  rootPath?: string,
  options?: PluginDiscoveryOptions
): Promise<PluginDiscoveryResult> {
  const registry = new PluginRegistry(rootPath);
  return await registry.discoverPlugins(options);
}

/**
 * Validate raw manifest data against the required plugin manifest schema.
 * @param data - Raw manifest object to validate.
 * @returns The validated and normalized plugin manifest.
 */
export function validatePluginManifest(data: Record<string, unknown>): PluginManifest {
  const registry = new PluginRegistry();
  return (registry as unknown as { validateManifest: (data: Record<string, unknown>) => PluginManifest }).validateManifest(data);
}