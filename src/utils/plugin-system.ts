import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync, exec, spawn } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
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
  createHookSystem
} from './plugin-hooks';
import { 
  PluginDependencyResolver,
  createDependencyResolver,
  ResolutionResult
} from './plugin-dependency';

// Plugin interface definitions
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  homepage?: string;
  keywords?: string[];
  main: string;
  bin?: Record<string, string>;
  engines?: {
    'reshell-cli'?: string;
    node?: string;
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  reshell?: {
    compatibility?: string;
    hooks?: string[];
    commands?: string[];
    permissions?: PluginPermission[];
    config?: PluginConfigSchema;
    plugins?: Record<string, string>;
  };
}

export interface PluginPermission {
  type: 'filesystem' | 'network' | 'process' | 'environment' | 'workspace';
  resource?: string;
  access: 'read' | 'write' | 'execute' | 'full';
  description: string;
}

export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface PluginContext {
  cli: {
    version: string;
    rootPath: string;
    configPath: string;
    workspaces: Record<string, any>;
  };
  plugin: {
    name: string;
    version: string;
    config: any;
    dataPath: string;
    cachePath: string;
  };
  logger: PluginLogger;
  hooks: PluginHookSystemInterface;
  utils: PluginUtils;
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface PluginHookSystemInterface {
  register(hookName: string, handler: (...args: any[]) => any, options?: any): string;
  unregister(hookName: string, handlerId: string): boolean;
  execute(hookName: string, data?: any): Promise<any>;
  executeSync(hookName: string, data?: any): any[];
  onCommand(command: string, handler: (...args: any[]) => any, options?: any): string;
  onFileChange(pattern: RegExp | string, handler: (...args: any[]) => any, options?: any): string;
  onWorkspaceBuild(workspace: string, handler: (...args: any[]) => any, options?: any): string;
  getHooks(): any[];
  registerCustomHook(name: string): string;
}

export interface PluginUtils {
  path: typeof path;
  fs: typeof fs;
  chalk: typeof chalk;
  exec(command: string, options?: any): Promise<{ stdout: string; stderr: string }>;
  spawn(command: string, args: string[], options?: any): Promise<number>;
}

export interface Plugin {
  manifest: PluginManifest;
  activate(context: PluginContext): Promise<void> | void;
  deactivate?(context: PluginContext): Promise<void> | void;
  onCommand?(command: string, args: any[], context: PluginContext): Promise<any> | any;
  onHook?(hookName: string, data: any, context: PluginContext): Promise<any> | any;
}

export interface PluginRegistration {
  manifest: PluginManifest;
  pluginPath: string;
  isLoaded: boolean;
  isActive: boolean;
  instance?: Plugin;
  loadError?: Error;
  activationError?: Error;
  lastUsed?: number;
  usageCount: number;
}

export interface PluginDiscoveryResult {
  found: PluginRegistration[];
  errors: Array<{ path: string; error: Error }>;
  skipped: Array<{ path: string; reason: string }>;
}

export type PluginSource = 'local' | 'npm' | 'git' | 'builtin';

export interface PluginDiscoveryOptions {
  sources?: PluginSource[];
  includeDisabled?: boolean;
  includeDev?: boolean;
  maxDepth?: number;
  timeout?: number;
  useCache?: boolean;
  cacheMaxAge?: number;
}

// Plugin Registry and Discovery System
export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, PluginRegistration> = new Map();
  private discoveryCache: Map<string, PluginDiscoveryResult> = new Map();
  private lifecycleManager: PluginLifecycleManager;
  private hookSystem: PluginHookSystem;
  private dependencyResolver: PluginDependencyResolver;
  private rootPath: string;
  private pluginPaths: string[];
  private isInitialized = false;

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

  // Get default plugin discovery paths
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

  // Get global plugin paths based on installation method
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

  // Initialize the plugin registry
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

  // Ensure plugin directories exist
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

  // Discover plugins from all configured sources
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
      if (Date.now() - (cached as any).timestamp < cacheMaxAge) {
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
      (result as any).timestamp = Date.now();
      this.discoveryCache.set(cacheKey, result);
    }

    this.emit('discovery-completed', result);
    
    return result;
  }

  // Discover plugins from a specific source
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

  // Discover local plugins
  private async discoverLocalPlugins(options: any): Promise<PluginDiscoveryResult> {
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

  // Discover npm plugins
  private async discoverNpmPlugins(options: any): Promise<PluginDiscoveryResult> {
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

  // Scan node_modules for plugins
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

  // Check if a package is a Re-Shell plugin
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
                      manifestData.name?.startsWith('@re-shell/');
      
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

  // Discover built-in plugins
  private async discoverBuiltinPlugins(options: any): Promise<PluginDiscoveryResult> {
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

  // Remove duplicate plugins (prefer local over global)
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

  // Validate plugin manifest
  private validateManifest(data: any): PluginManifest {
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
      author: data.author,
      license: data.license,
      homepage: data.homepage,
      keywords: data.keywords || [],
      main: data.main,
      bin: data.bin,
      engines: data.engines,
      dependencies: data.dependencies,
      peerDependencies: data.peerDependencies,
      reshell: data.reshell || {}
    };
  }

  // Register a plugin manually
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

  // Unregister a plugin
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

  // Get all registered plugins
  getPlugins(): PluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  // Get a specific plugin
  getPlugin(name: string): PluginRegistration | undefined {
    return this.plugins.get(name);
  }

  // Check if a plugin is registered
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  // Get plugin count
  getPluginCount(): number {
    return this.plugins.size;
  }

  // Get active plugins
  getActivePlugins(): PluginRegistration[] {
    return Array.from(this.plugins.values()).filter(p => p.isActive);
  }

  // Clear discovery cache
  clearCache(): void {
    this.discoveryCache.clear();
    this.emit('cache-cleared');
  }

  // Plugin lifecycle management methods
  async loadPlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.loadPlugin(pluginName);
  }

  async initializePlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.initializePlugin(pluginName);
  }

  async activatePlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.activatePlugin(pluginName);
  }

  async deactivatePlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.deactivatePlugin(pluginName);
  }

  async unloadPlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.unloadPlugin(pluginName);
  }

  async reloadPlugin(pluginName: string): Promise<void> {
    return await this.lifecycleManager.reloadPlugin(pluginName);
  }

  // Get managed plugin (with lifecycle state)
  getManagedPlugin(name: string): ManagedPluginRegistration | undefined {
    return this.lifecycleManager.getPlugin(name);
  }

  // Get all managed plugins
  getManagedPlugins(): ManagedPluginRegistration[] {
    return this.lifecycleManager.getPlugins();
  }

  // Get plugins by state
  getPluginsByState(state: PluginState): ManagedPluginRegistration[] {
    return this.lifecycleManager.getPluginsByState(state);
  }

  // Get lifecycle statistics
  getLifecycleStats(): any {
    return this.lifecycleManager.getLifecycleStats();
  }

  // Get lifecycle manager
  getLifecycleManager(): PluginLifecycleManager {
    return this.lifecycleManager;
  }

  // Hook system methods
  getHookSystem(): PluginHookSystem {
    return this.hookSystem;
  }

  // Create plugin hook API for a specific plugin
  createPluginHookAPI(pluginName: string): PluginHookAPI {
    return this.hookSystem.createPluginScope(pluginName);
  }

  // Execute hooks
  async executeHooks(hookType: HookType | string, data?: any): Promise<any> {
    return await this.hookSystem.execute(hookType, data);
  }

  // Get hook statistics
  getHookStats(): any {
    return this.hookSystem.getStats();
  }

  // Dependency resolver methods
  getDependencyResolver(): PluginDependencyResolver {
    return this.dependencyResolver;
  }

  // Resolve dependencies for a plugin
  async resolveDependencies(pluginName: string): Promise<ResolutionResult> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new ValidationError(`Plugin '${pluginName}' not found`);
    }

    // Register all plugins with dependency resolver
    this.plugins.forEach(p => this.dependencyResolver.registerPlugin(p));

    return await this.dependencyResolver.resolveDependencies(plugin.manifest);
  }

  // Get dependency statistics
  getDependencyStats(): any {
    return this.dependencyResolver.getStats();
  }

  // Create plugin context for activation
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

  // Create plugin logger
  private createPluginLogger(pluginName: string): PluginLogger {
    const prefix = `[${pluginName}]`;
    
    return {
      debug: (message: string, ...args: any[]) => {
        console.debug(chalk.gray(`${prefix} ${message}`), ...args);
      },
      info: (message: string, ...args: any[]) => {
        console.info(chalk.blue(`${prefix} ${message}`), ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(chalk.yellow(`${prefix} ${message}`), ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(chalk.red(`${prefix} ${message}`), ...args);
      }
    };
  }

  // Create plugin utilities
  private createPluginUtils(): PluginUtils {
    const execAsync = promisify(exec);
    
    return {
      path,
      fs,
      chalk,
      exec: execAsync,
      spawn: (command: string, args: string[], options?: any): Promise<number> => {
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
export function createPluginRegistry(rootPath?: string): PluginRegistry {
  return new PluginRegistry(rootPath);
}

export async function discoverPlugins(
  rootPath?: string,
  options?: PluginDiscoveryOptions
): Promise<PluginDiscoveryResult> {
  const registry = new PluginRegistry(rootPath);
  return await registry.discoverPlugins(options);
}

export function validatePluginManifest(data: any): PluginManifest {
  const registry = new PluginRegistry();
  return (registry as any).validateManifest(data);
}