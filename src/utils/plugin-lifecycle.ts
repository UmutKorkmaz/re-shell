import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { 
  createSecurityValidator, 
  SecurityLevel, 
  getDefaultSecurityPolicy 
} from './plugin-security';
import { 
  Plugin, 
  PluginRegistration, 
  PluginContext, 
  PluginManifest,
  PluginPermission 
} from './plugin-system';

// Plugin lifecycle states
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  DEACTIVATED = 'deactivated',
  ERROR = 'error'
}

// Plugin lifecycle events
export interface PluginLifecycleEvent {
  pluginName: string;
  oldState: PluginState;
  newState: PluginState;
  timestamp: number;
  data?: any;
  error?: Error;
}

// Plugin loader configuration
export interface PluginLoaderConfig {
  timeout: number;
  validateSecurity: boolean;
  sandboxed: boolean;
  maxMemory?: number;
  allowedPermissions?: PluginPermission[];
  blockedPermissions?: PluginPermission[];
  enableHotReload?: boolean;
  preloadDependencies?: boolean;
}

// Plugin dependency info
export interface PluginDependency {
  name: string;
  version: string;
  required: boolean;
  resolved?: boolean;
  instance?: Plugin;
}

// Extended plugin registration with lifecycle data
export interface ManagedPluginRegistration extends PluginRegistration {
  state: PluginState;
  dependencies: PluginDependency[];
  dependents: string[];
  loadTime?: number;
  initTime?: number;
  activationTime?: number;
  lastStateChange: number;
  context?: PluginContext;
  stateHistory: PluginLifecycleEvent[];
  errors: Array<{ stage: string; error: Error; timestamp: number }>;
  permissions: PluginPermission[];
  memoryUsage?: NodeJS.MemoryUsage;
  performance: {
    loadDuration: number;
    initDuration: number;
    activationDuration: number;
  };
}

// Plugin lifecycle manager
export class PluginLifecycleManager extends EventEmitter {
  private plugins: Map<string, ManagedPluginRegistration> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private config: PluginLoaderConfig;
  private isInitialized = false;
  private hotReloadWatchers: Map<string, any> = new Map();

  constructor(config: Partial<PluginLoaderConfig> = {}) {
    super();
    this.config = {
      timeout: 30000,
      validateSecurity: true,
      sandboxed: false,
      enableHotReload: false,
      preloadDependencies: true,
      ...config
    };
  }

  // Initialize the lifecycle manager
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.emit('manager-initializing');
    
    try {
      // Initialize dependency tracking
      this.buildDependencyGraph();
      
      this.isInitialized = true;
      this.emit('manager-initialized');
      
    } catch (error) {
      this.emit('manager-error', error);
      throw error;
    }
  }

  // Register a plugin for lifecycle management
  async registerPlugin(registration: PluginRegistration): Promise<void> {
    const managedRegistration: ManagedPluginRegistration = {
      ...registration,
      state: PluginState.UNLOADED,
      dependencies: [],
      dependents: [],
      lastStateChange: Date.now(),
      stateHistory: [],
      errors: [],
      permissions: registration.manifest.reshell?.permissions || [],
      performance: {
        loadDuration: 0,
        initDuration: 0,
        activationDuration: 0
      }
    };

    // Resolve dependencies
    managedRegistration.dependencies = await this.resolveDependencies(registration.manifest);
    
    this.plugins.set(registration.manifest.name, managedRegistration);
    this.updateDependencyGraph(registration.manifest.name, managedRegistration.dependencies);
    
    this.emit('plugin-registered', {
      pluginName: registration.manifest.name,
      registration: managedRegistration
    });
  }

  // Load a plugin
  async loadPlugin(pluginName: string): Promise<void> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      throw new ValidationError(`Plugin '${pluginName}' is not registered`);
    }

    if (registration.state !== PluginState.UNLOADED) {
      throw new ValidationError(
        `Plugin '${pluginName}' cannot be loaded from state '${registration.state}'`
      );
    }

    await this.transitionState(registration, PluginState.LOADING);

    try {
      const startTime = Date.now();
      
      // Validate security permissions
      if (this.config.validateSecurity) {
        await this.validatePluginSecurity(registration);
      }

      // Load dependencies first
      if (this.config.preloadDependencies) {
        await this.loadDependencies(registration);
      }

      // Load the plugin module
      const pluginModule = await this.loadPluginModule(registration);
      
      // Validate plugin interface
      this.validatePluginInterface(pluginModule);
      
      registration.instance = pluginModule;
      registration.loadTime = Date.now();
      registration.performance.loadDuration = registration.loadTime - startTime;

      // Setup hot reload if enabled
      if (this.config.enableHotReload) {
        await this.setupHotReload(registration);
      }

      await this.transitionState(registration, PluginState.LOADED);

    } catch (error) {
      registration.errors.push({
        stage: 'load',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
      
      await this.transitionState(registration, PluginState.ERROR);
      throw error;
    }
  }

  // Initialize a loaded plugin
  async initializePlugin(pluginName: string, context?: PluginContext): Promise<void> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      throw new ValidationError(`Plugin '${pluginName}' is not registered`);
    }

    if (registration.state !== PluginState.LOADED) {
      throw new ValidationError(
        `Plugin '${pluginName}' must be loaded before initialization. Current state: '${registration.state}'`
      );
    }

    await this.transitionState(registration, PluginState.INITIALIZING);

    try {
      const startTime = Date.now();
      
      // Create or use provided context
      const pluginContext = context || this.createPluginContext(registration);
      registration.context = pluginContext;

      // Ensure plugin directories exist
      await this.ensurePluginDirectories(registration);

      // Initialize dependencies
      for (const dep of registration.dependencies) {
        if (dep.required && !dep.resolved) {
          throw new ValidationError(
            `Required dependency '${dep.name}' is not available for plugin '${pluginName}'`
          );
        }
      }

      registration.initTime = Date.now();
      registration.performance.initDuration = registration.initTime - startTime;

      await this.transitionState(registration, PluginState.INITIALIZED);

    } catch (error) {
      registration.errors.push({
        stage: 'initialize',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
      
      await this.transitionState(registration, PluginState.ERROR);
      throw error;
    }
  }

  // Activate an initialized plugin
  async activatePlugin(pluginName: string): Promise<void> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      throw new ValidationError(`Plugin '${pluginName}' is not registered`);
    }

    if (registration.state !== PluginState.INITIALIZED) {
      throw new ValidationError(
        `Plugin '${pluginName}' must be initialized before activation. Current state: '${registration.state}'`
      );
    }

    await this.transitionState(registration, PluginState.ACTIVATING);

    try {
      const startTime = Date.now();
      
      // Activate dependencies first
      await this.activateDependencies(registration);

      // Call plugin activation
      if (registration.instance && registration.context) {
        if (typeof registration.instance.activate === 'function') {
          await Promise.race([
            registration.instance.activate(registration.context),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Plugin activation timeout')), this.config.timeout)
            )
          ]);
        }
      }

      registration.activationTime = Date.now();
      registration.performance.activationDuration = registration.activationTime - startTime;
      registration.isActive = true;

      // Track memory usage
      if (global.gc) {
        global.gc();
        registration.memoryUsage = process.memoryUsage();
      }

      await this.transitionState(registration, PluginState.ACTIVE);

    } catch (error) {
      registration.errors.push({
        stage: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
      
      await this.transitionState(registration, PluginState.ERROR);
      throw error;
    }
  }

  // Deactivate an active plugin
  async deactivatePlugin(pluginName: string): Promise<void> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      throw new ValidationError(`Plugin '${pluginName}' is not registered`);
    }

    if (registration.state !== PluginState.ACTIVE) {
      throw new ValidationError(
        `Plugin '${pluginName}' is not active. Current state: '${registration.state}'`
      );
    }

    await this.transitionState(registration, PluginState.DEACTIVATING);

    try {
      // Deactivate dependents first
      await this.deactivateDependents(registration);

      // Call plugin deactivation
      if (registration.instance && registration.context) {
        if (typeof registration.instance.deactivate === 'function') {
          await Promise.race([
            registration.instance.deactivate(registration.context),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Plugin deactivation timeout')), this.config.timeout)
            )
          ]);
        }
      }

      registration.isActive = false;

      await this.transitionState(registration, PluginState.DEACTIVATED);

    } catch (error) {
      registration.errors.push({
        stage: 'deactivate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
      
      await this.transitionState(registration, PluginState.ERROR);
      throw error;
    }
  }

  // Unload a plugin (deactivate + cleanup)
  async unloadPlugin(pluginName: string): Promise<void> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      throw new ValidationError(`Plugin '${pluginName}' is not registered`);
    }

    // Deactivate if active
    if (registration.state === PluginState.ACTIVE) {
      await this.deactivatePlugin(pluginName);
    }

    try {
      // Cleanup hot reload watcher
      if (this.hotReloadWatchers.has(pluginName)) {
        const watcher = this.hotReloadWatchers.get(pluginName);
        await watcher.close();
        this.hotReloadWatchers.delete(pluginName);
      }

      // Clear instance and context
      registration.instance = undefined;
      registration.context = undefined;
      registration.isLoaded = false;

      await this.transitionState(registration, PluginState.UNLOADED);

    } catch (error) {
      registration.errors.push({
        stage: 'unload',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
      
      await this.transitionState(registration, PluginState.ERROR);
      throw error;
    }
  }

  // Reload a plugin (unload + load + init + activate)
  async reloadPlugin(pluginName: string): Promise<void> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      throw new ValidationError(`Plugin '${pluginName}' is not registered`);
    }

    const wasActive = registration.state === PluginState.ACTIVE;

    await this.unloadPlugin(pluginName);
    await this.loadPlugin(pluginName);
    await this.initializePlugin(pluginName);
    
    if (wasActive) {
      await this.activatePlugin(pluginName);
    }
  }

  // Load plugin module
  private async loadPluginModule(registration: ManagedPluginRegistration): Promise<Plugin> {
    const mainFile = path.resolve(registration.pluginPath, registration.manifest.main);
    
    if (!await fs.pathExists(mainFile)) {
      throw new ValidationError(`Plugin main file not found: ${mainFile}`);
    }

    // Clear require cache for hot reload
    if (require.cache[mainFile]) {
      delete require.cache[mainFile];
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pluginModule = require(mainFile);
      
      // Handle different export patterns
      if (pluginModule.default) {
        return pluginModule.default;
      } else if (typeof pluginModule === 'function') {
        return pluginModule();
      } else if (pluginModule.activate || pluginModule.manifest) {
        return pluginModule;
      } else {
        throw new ValidationError('Invalid plugin export pattern');
      }
      
    } catch (error) {
      throw new ValidationError(
        `Failed to load plugin module: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Validate plugin interface
  private validatePluginInterface(plugin: any): void {
    if (!plugin || typeof plugin !== 'object') {
      throw new ValidationError('Plugin must export an object');
    }

    if (plugin.manifest && !this.isValidManifest(plugin.manifest)) {
      throw new ValidationError('Plugin manifest is invalid');
    }

    if (plugin.activate && typeof plugin.activate !== 'function') {
      throw new ValidationError('Plugin activate must be a function');
    }

    if (plugin.deactivate && typeof plugin.deactivate !== 'function') {
      throw new ValidationError('Plugin deactivate must be a function');
    }
  }

  // Validate plugin security
  private async validatePluginSecurity(registration: ManagedPluginRegistration): Promise<void> {
    try {
      const securityValidator = createSecurityValidator(getDefaultSecurityPolicy());
      const securityResult = await securityValidator.scanPlugin(registration);

      // Check if plugin is blocked
      if (securityResult.securityLevel === SecurityLevel.BLOCKED || !securityResult.approved) {
        const criticalViolations = securityResult.violations.filter(v => v.severity === 'critical' || v.blocked);
        if (criticalViolations.length > 0) {
          const violationDescriptions = criticalViolations.map(v => v.description).join(', ');
          throw new ValidationError(`Plugin blocked due to security violations: ${violationDescriptions}`);
        }
      }

      // Store security result in registration for later use
      (registration as any).securityResult = securityResult;

      // Emit security validation event
      this.emit('security-validated', {
        pluginName: registration.manifest.name,
        securityLevel: securityResult.securityLevel,
        violations: securityResult.violations.length,
        approved: securityResult.approved
      });

    } catch (error) {
      throw new ValidationError(
        `Security validation failed for plugin '${registration.manifest.name}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Resolve plugin dependencies
  private async resolveDependencies(manifest: PluginManifest): Promise<PluginDependency[]> {
    const dependencies: PluginDependency[] = [];

    if (manifest.dependencies) {
      for (const [name, version] of Object.entries(manifest.dependencies)) {
        dependencies.push({
          name,
          version,
          required: true,
          resolved: false
        });
      }
    }

    if (manifest.peerDependencies) {
      for (const [name, version] of Object.entries(manifest.peerDependencies)) {
        dependencies.push({
          name,
          version,
          required: false,
          resolved: false
        });
      }
    }

    // Check which dependencies are available
    for (const dep of dependencies) {
      if (this.plugins.has(dep.name)) {
        dep.resolved = true;
        dep.instance = this.plugins.get(dep.name)?.instance;
      }
    }

    return dependencies;
  }

  // Load plugin dependencies
  private async loadDependencies(registration: ManagedPluginRegistration): Promise<void> {
    for (const dep of registration.dependencies) {
      if (dep.required && !dep.resolved) {
        const depRegistration = this.plugins.get(dep.name);
        if (depRegistration && depRegistration.state === PluginState.UNLOADED) {
          await this.loadPlugin(dep.name);
          dep.resolved = true;
          dep.instance = depRegistration.instance;
        }
      }
    }
  }

  // Activate plugin dependencies
  private async activateDependencies(registration: ManagedPluginRegistration): Promise<void> {
    for (const dep of registration.dependencies) {
      if (dep.resolved) {
        const depRegistration = this.plugins.get(dep.name);
        if (depRegistration && depRegistration.state !== PluginState.ACTIVE) {
          if (depRegistration.state === PluginState.LOADED) {
            await this.initializePlugin(dep.name);
          }
          if (depRegistration.state === PluginState.INITIALIZED) {
            await this.activatePlugin(dep.name);
          }
        }
      }
    }
  }

  // Deactivate plugin dependents
  private async deactivateDependents(registration: ManagedPluginRegistration): Promise<void> {
    for (const dependentName of registration.dependents) {
      const dependent = this.plugins.get(dependentName);
      if (dependent && dependent.state === PluginState.ACTIVE) {
        await this.deactivatePlugin(dependentName);
      }
    }
  }

  // Build dependency graph
  private buildDependencyGraph(): void {
    this.dependencyGraph.clear();
    
    for (const [name, registration] of this.plugins) {
      this.dependencyGraph.set(name, new Set());
      
      for (const dep of registration.dependencies) {
        if (dep.resolved) {
          this.dependencyGraph.get(name)!.add(dep.name);
          
          // Update dependent tracking
          const depRegistration = this.plugins.get(dep.name);
          if (depRegistration) {
            if (!depRegistration.dependents.includes(name)) {
              depRegistration.dependents.push(name);
            }
          }
        }
      }
    }
  }

  // Update dependency graph for a plugin
  private updateDependencyGraph(pluginName: string, dependencies: PluginDependency[]): void {
    if (!this.dependencyGraph.has(pluginName)) {
      this.dependencyGraph.set(pluginName, new Set());
    }

    const deps = this.dependencyGraph.get(pluginName)!;
    deps.clear();

    for (const dep of dependencies) {
      if (dep.resolved) {
        deps.add(dep.name);
        
        // Update dependent tracking
        const depRegistration = this.plugins.get(dep.name);
        if (depRegistration && !depRegistration.dependents.includes(pluginName)) {
          depRegistration.dependents.push(pluginName);
        }
      }
    }
  }

  // Setup hot reload for a plugin
  private async setupHotReload(registration: ManagedPluginRegistration): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const chokidar = require('chokidar');
    const watcher = chokidar.watch(registration.pluginPath, {
      ignored: /node_modules/,
      persistent: true
    });

    watcher.on('change', async (filePath: string) => {
      try {
        this.emit('plugin-file-changed', {
          pluginName: registration.manifest.name,
          filePath
        });

        await this.reloadPlugin(registration.manifest.name);
        
        this.emit('plugin-hot-reloaded', {
          pluginName: registration.manifest.name,
          filePath
        });
      } catch (error) {
        this.emit('plugin-hot-reload-error', {
          pluginName: registration.manifest.name,
          filePath,
          error
        });
      }
    });

    this.hotReloadWatchers.set(registration.manifest.name, watcher);
  }

  // Ensure plugin directories exist
  private async ensurePluginDirectories(registration: ManagedPluginRegistration): Promise<void> {
    if (registration.context) {
      await fs.ensureDir(registration.context.plugin.dataPath);
      await fs.ensureDir(registration.context.plugin.cachePath);
    }
  }

  // Create plugin context
  private createPluginContext(registration: ManagedPluginRegistration): PluginContext {
    // This would typically be injected from the main plugin system
    // For now, create a basic context
    return {
      cli: {
        version: '0.7.0',
        rootPath: process.cwd(),
        configPath: path.join(process.cwd(), '.re-shell'),
        workspaces: {}
      },
      plugin: {
        name: registration.manifest.name,
        version: registration.manifest.version,
        config: {},
        dataPath: path.join(process.cwd(), '.re-shell', 'data', registration.manifest.name),
        cachePath: path.join(process.cwd(), '.re-shell', 'cache', registration.manifest.name)
      },
      logger: this.createLogger(registration.manifest.name),
      hooks: this.createHookSystem(),
      utils: this.createUtils()
    };
  }

  // Create plugin logger
  private createLogger(pluginName: string): any {
    const prefix = `[${pluginName}]`;
    return {
      debug: (msg: string, ...args: any[]) => console.debug(chalk.gray(`${prefix} ${msg}`), ...args),
      info: (msg: string, ...args: any[]) => console.info(chalk.blue(`${prefix} ${msg}`), ...args),
      warn: (msg: string, ...args: any[]) => console.warn(chalk.yellow(`${prefix} ${msg}`), ...args),
      error: (msg: string, ...args: any[]) => console.error(chalk.red(`${prefix} ${msg}`), ...args)
    };
  }

  // Create hook system (placeholder - will be injected from main system)
  private createHookSystem(): any {
    return {
      register: () => 'placeholder',
      unregister: () => false,
      execute: async () => ({ success: true, results: [], errors: [] }),
      executeSync: () => [],
      onCommand: () => 'placeholder',
      onFileChange: () => 'placeholder',
      onWorkspaceBuild: () => 'placeholder',
      getHooks: () => [],
      registerCustomHook: () => 'placeholder'
    };
  }

  // Create utils
  private createUtils(): any {
    return {
      path,
      fs,
      chalk,
      exec: async () => ({ stdout: '', stderr: '' }),
      spawn: async () => 0
    };
  }

  // Transition plugin state
  private async transitionState(
    registration: ManagedPluginRegistration, 
    newState: PluginState
  ): Promise<void> {
    const oldState = registration.state;
    
    const event: PluginLifecycleEvent = {
      pluginName: registration.manifest.name,
      oldState,
      newState,
      timestamp: Date.now()
    };

    registration.state = newState;
    registration.lastStateChange = event.timestamp;
    registration.stateHistory.push(event);

    this.emit('state-changed', event);
    this.emit(`state-${newState}`, event);
  }

  // Validate manifest
  private isValidManifest(manifest: any): boolean {
    return manifest && 
           typeof manifest.name === 'string' && 
           typeof manifest.version === 'string';
  }

  // Get plugin by name
  getPlugin(name: string): ManagedPluginRegistration | undefined {
    return this.plugins.get(name);
  }

  // Get all plugins
  getPlugins(): ManagedPluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  // Get plugins by state
  getPluginsByState(state: PluginState): ManagedPluginRegistration[] {
    return Array.from(this.plugins.values()).filter(p => p.state === state);
  }

  // Get dependency graph
  getDependencyGraph(): Map<string, Set<string>> {
    return new Map(this.dependencyGraph);
  }

  // Get lifecycle statistics
  getLifecycleStats(): any {
    const stats = {
      total: this.plugins.size,
      byState: {} as Record<string, number>,
      totalErrors: 0,
      avgLoadTime: 0,
      avgInitTime: 0,
      avgActivationTime: 0
    };

    let totalLoadTime = 0;
    let totalInitTime = 0; 
    let totalActivationTime = 0;
    let loadedCount = 0;

    for (const plugin of this.plugins.values()) {
      stats.byState[plugin.state] = (stats.byState[plugin.state] || 0) + 1;
      stats.totalErrors += plugin.errors.length;
      
      if (plugin.performance.loadDuration > 0) {
        totalLoadTime += plugin.performance.loadDuration;
        totalInitTime += plugin.performance.initDuration;
        totalActivationTime += plugin.performance.activationDuration;
        loadedCount++;
      }
    }

    if (loadedCount > 0) {
      stats.avgLoadTime = totalLoadTime / loadedCount;
      stats.avgInitTime = totalInitTime / loadedCount;
      stats.avgActivationTime = totalActivationTime / loadedCount;
    }

    return stats;
  }
}

// Utility functions
export function createPluginLifecycleManager(config?: Partial<PluginLoaderConfig>): PluginLifecycleManager {
  return new PluginLifecycleManager(config);
}

