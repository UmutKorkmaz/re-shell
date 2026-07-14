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

/**
 * Represents the possible lifecycle states a plugin can transition through.
 *
 * The lifecycle moves from UNLOADED -> LOADING -> LOADED -> INITIALIZING ->
 * INITIALIZED -> ACTIVATING -> ACTIVE -> DEACTIVATING -> DEACTIVATED.
 * The ERROR state can be entered from any other state when a failure occurs.
 */
export enum PluginState {
  /** Plugin has not yet been loaded into memory. */
  UNLOADED = 'unloaded',
  /** Plugin is currently being loaded into memory. */
  LOADING = 'loading',
  /** Plugin module has been successfully loaded but not yet initialized. */
  LOADED = 'loaded',
  /** Plugin is currently being initialized (directories ensured, dependencies checked). */
  INITIALIZING = 'initializing',
  /** Plugin has been initialized and is ready for activation. */
  INITIALIZED = 'initialized',
  /** Plugin is currently being activated (running its activate hook). */
  ACTIVATING = 'activating',
  /** Plugin is fully active and running. */
  ACTIVE = 'active',
  /** Plugin is currently being deactivated (running its deactivate hook). */
  DEACTIVATING = 'deactivating',
  /** Plugin has been deactivated and is no longer running. */
  DEACTIVATED = 'deactivated',
  /** Plugin encountered an error during a lifecycle stage. */
  ERROR = 'error'
}

/**
 * Describes an event emitted when a plugin transitions between lifecycle states.
 */
export interface PluginLifecycleEvent {
  /** Name of the plugin whose state changed. */
  pluginName: string;
  /** The plugin's previous lifecycle state. */
  oldState: PluginState;
  /** The plugin's new lifecycle state. */
  newState: PluginState;
  /** Unix timestamp (milliseconds) at which the transition occurred. */
  timestamp: number;
  /** Optional additional data associated with the transition. */
  data?: any;
  /** Optional error associated with the transition, if it failed. */
  error?: Error;
}

/**
 * Configuration options for the plugin loader and lifecycle manager.
 */
export interface PluginLoaderConfig {
  /** Maximum time (ms) to wait for plugin activation/deactivation before timing out. */
  timeout: number;
  /** Whether to run security validation before loading a plugin. */
  validateSecurity: boolean;
  /** Whether to run plugins in a sandboxed environment. */
  sandboxed: boolean;
  /** Optional maximum memory (bytes) a plugin is allowed to use. */
  maxMemory?: number;
  /** Optional list of permissions explicitly allowed for plugins. */
  allowedPermissions?: PluginPermission[];
  /** Optional list of permissions explicitly blocked for plugins. */
  blockedPermissions?: PluginPermission[];
  /** Whether to enable file watching and hot reload for plugins. */
  enableHotReload?: boolean;
  /** Whether to automatically load plugin dependencies before the plugin itself. */
  preloadDependencies?: boolean;
}

/**
 * Represents a single dependency of a plugin.
 */
export interface PluginDependency {
  /** Name of the dependency plugin/package. */
  name: string;
  /** Semver version range required for the dependency. */
  version: string;
  /** Whether the dependency is required (true) or optional (false, e.g. peer deps). */
  required: boolean;
  /** Whether the dependency has been resolved and is currently available. */
  resolved?: boolean;
  /** Resolved plugin instance, if available. */
  instance?: Plugin;
}

/**
 * Extended plugin registration that tracks lifecycle state, dependencies,
 * performance metrics, and error history in addition to base registration data.
 */
export interface ManagedPluginRegistration extends PluginRegistration {
  /** Current lifecycle state of the plugin. */
  state: PluginState;
  /** List of dependencies required by this plugin. */
  dependencies: PluginDependency[];
  /** Names of plugins that depend on this plugin. */
  dependents: string[];
  /** Timestamp (ms) when the plugin was loaded. */
  loadTime?: number;
  /** Timestamp (ms) when the plugin was initialized. */
  initTime?: number;
  /** Timestamp (ms) when the plugin was activated. */
  activationTime?: number;
  /** Timestamp (ms) of the most recent state change. */
  lastStateChange: number;
  /** Plugin context provided during initialization. */
  context?: PluginContext;
  /** Ordered history of all lifecycle transitions the plugin has gone through. */
  stateHistory: PluginLifecycleEvent[];
  /** Errors that occurred during various lifecycle stages. */
  errors: Array<{ stage: string; error: Error; timestamp: number }>;
  /** Permissions requested/declared by the plugin. */
  permissions: PluginPermission[];
  /** Most recent memory usage snapshot for the plugin, if measured. */
  memoryUsage?: NodeJS.MemoryUsage;
  /** Performance timing metrics for the plugin's lifecycle stages. */
  performance: {
    /** Duration (ms) the load stage took. */
    loadDuration: number;
    /** Duration (ms) the initialization stage took. */
    initDuration: number;
    /** Duration (ms) the activation stage took. */
    activationDuration: number;
  };
}

/**
 * Manages the full lifecycle of plugins including registration, loading,
 * initialization, activation, deactivation, and unloading. Emits events
 * for each state transition and tracks dependencies, performance metrics,
 * and errors.
 *
 * @extends EventEmitter
 */
export class PluginLifecycleManager extends EventEmitter {
  private plugins: Map<string, ManagedPluginRegistration> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private config: PluginLoaderConfig;
  private isInitialized = false;
  private hotReloadWatchers: Map<string, any> = new Map();

  /**
   * Creates a new PluginLifecycleManager with the given configuration.
   *
   * @param config - Partial configuration object. Defaults will be used for unspecified fields.
   */
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

  /**
   * Initializes the lifecycle manager by building the dependency graph.
   * Emits `manager-initializing` and `manager-initialized` events, or
   * `manager-error` on failure.
   *
   * @returns A promise that resolves when initialization is complete.
   */
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

  /**
   * Registers a plugin for lifecycle management. Resolves the plugin's
   * dependencies, stores the managed registration, and updates the
   * dependency graph. Emits a `plugin-registered` event.
   *
   * @param registration - The base plugin registration data.
   * @returns A promise that resolves when registration is complete.
   */
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

  /**
   * Loads a registered plugin from the UNLOADED state into the LOADED state.
   * Performs security validation (if enabled), loads dependencies, loads
   * the plugin module, validates its interface, and optionally sets up
   * hot reload watching.
   *
   * @param pluginName - Name of the plugin to load.
   * @returns A promise that resolves when the plugin has been loaded.
   * @throws {ValidationError} If the plugin is not registered or not in UNLOADED state.
   */
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

  /**
   * Initializes a loaded plugin, transitioning it from LOADED to INITIALIZED.
   * Creates or uses the provided plugin context, ensures plugin directories
   * exist, and validates that all required dependencies are resolved.
   *
   * @param pluginName - Name of the plugin to initialize.
   * @param context - Optional plugin context to use instead of the auto-generated one.
   * @returns A promise that resolves when the plugin has been initialized.
   * @throws {ValidationError} If the plugin is not registered or not in LOADED state.
   */
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

  /**
   * Activates an initialized plugin, transitioning it from INITIALIZED to ACTIVE.
   * Activates dependencies first, then calls the plugin's `activate` hook
   * with a timeout guard. Tracks memory usage after activation if available.
   *
   * @param pluginName - Name of the plugin to activate.
   * @returns A promise that resolves when the plugin has been activated.
   * @throws {ValidationError} If the plugin is not registered or not in INITIALIZED state.
   */
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

  /**
   * Deactivates an active plugin, transitioning it from ACTIVE to DEACTIVATED.
   * Deactivates dependent plugins first, then calls the plugin's `deactivate`
   * hook with a timeout guard.
   *
   * @param pluginName - Name of the plugin to deactivate.
   * @returns A promise that resolves when the plugin has been deactivated.
   * @throws {ValidationError} If the plugin is not registered or not in ACTIVE state.
   */
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

  /**
   * Unloads a plugin by deactivating it (if active), closing any hot reload
   * watchers, clearing its instance and context, and transitioning it back
   * to the UNLOADED state.
   *
   * @param pluginName - Name of the plugin to unload.
   * @returns A promise that resolves when the plugin has been unloaded.
   * @throws {ValidationError} If the plugin is not registered.
   */
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

  /**
   * Reloads a plugin by performing a full unload -> load -> initialize cycle,
   * and activating it again if it was previously active.
   *
   * @param pluginName - Name of the plugin to reload.
   * @returns A promise that resolves when the plugin has been reloaded.
   * @throws {ValidationError} If the plugin is not registered.
   */
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

  /**
   * Loads and returns the plugin module from the registration's plugin path.
   * Clears the require cache for hot reload support and handles various
   * CommonJS export patterns (default export, function export, named exports).
   *
   * @param registration - The managed registration of the plugin to load.
   * @returns A promise resolving to the loaded Plugin instance.
   * @throws {ValidationError} If the main file does not exist or has an invalid export pattern.
   */
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

  /**
   * Validates that a loaded plugin object conforms to the expected interface,
   * including optional manifest, activate, and deactivate members.
   *
   * @param plugin - The loaded plugin object to validate.
   * @throws {ValidationError} If the plugin is not an object, has an invalid manifest, or has non-function hooks.
   */
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

  /**
   * Runs security validation against a plugin using the default security policy.
   * Blocks plugins with critical violations and emits a `security-validated`
   * event when validation succeeds.
   *
   * @param registration - The managed registration of the plugin to validate.
   * @returns A promise that resolves when validation completes successfully.
   * @throws {ValidationError} If the plugin is blocked due to security violations or validation fails.
   */
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
      (registration as { securityResult?: unknown }).securityResult = securityResult;

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

  /**
   * Resolves plugin dependencies declared in the manifest (both regular and
   * peer dependencies) and checks which are currently available among
   * registered plugins.
   *
   * @param manifest - The plugin manifest containing dependency declarations.
   * @returns A promise resolving to an array of resolved dependency descriptors.
   */
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

  /**
   * Loads any required dependencies of a plugin that are registered but not
   * yet loaded, marking them as resolved.
   *
   * @param registration - The managed registration whose dependencies should be loaded.
   * @returns A promise that resolves when all loadable dependencies have been loaded.
   */
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

  /**
   * Activates resolved dependencies of a plugin that are not yet active,
   * initializing them first if needed.
   *
   * @param registration - The managed registration whose dependencies should be activated.
   * @returns A promise that resolves when all activatable dependencies are active.
   */
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

  /**
   * Deactivates all plugins that depend on the given plugin (its dependents)
   * before the plugin itself is deactivated.
   *
   * @param registration - The managed registration whose dependents should be deactivated.
   * @returns A promise that resolves when all active dependents have been deactivated.
   */
  private async deactivateDependents(registration: ManagedPluginRegistration): Promise<void> {
    for (const dependentName of registration.dependents) {
      const dependent = this.plugins.get(dependentName);
      if (dependent && dependent.state === PluginState.ACTIVE) {
        await this.deactivatePlugin(dependentName);
      }
    }
  }

  /**
   * Builds the dependency graph by clearing it and rebuilding from all
   * currently registered plugins, updating dependent tracking along the way.
   */
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

  /**
   * Updates the dependency graph entry for a single plugin based on its
   * resolved dependencies and updates dependent tracking on each dependency.
   *
   * @param pluginName - Name of the plugin whose graph entry should be updated.
   * @param dependencies - The resolved dependencies of the plugin.
   */
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

  /**
   * Sets up file watching (using chokidar) on the plugin's directory to
   * automatically reload it when files change.
   *
   * @param registration - The managed registration of the plugin to watch.
   * @returns A promise that resolves when the watcher has been configured.
   */
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

  /**
   * Ensures that the plugin's data and cache directories exist on disk,
   * creating them if necessary.
   *
   * @param registration - The managed registration of the plugin.
   * @returns A promise that resolves when directories have been ensured.
   */
  private async ensurePluginDirectories(registration: ManagedPluginRegistration): Promise<void> {
    if (registration.context) {
      await fs.ensureDir(registration.context.plugin.dataPath);
      await fs.ensureDir(registration.context.plugin.cachePath);
    }
  }

  /**
   * Creates a basic PluginContext for the given plugin, providing CLI info,
   * plugin metadata, a logger, a placeholder hook system, and utilities.
   *
   * @param registration - The managed registration of the plugin.
   * @returns A PluginContext for use during initialization and activation.
   */
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

  /**
   * Creates a prefixed logger for a plugin that writes colorized output to
   * the console via debug, info, warn, and error methods.
   *
   * @param pluginName - Name of the plugin, used as the log prefix.
   * @returns A logger object with debug, info, warn, and error methods.
   */
  private createLogger(pluginName: string): any {
    const prefix = `[${pluginName}]`;
    return {
      debug: (msg: string, ...args: any[]) => console.debug(chalk.gray(`${prefix} ${msg}`), ...args),
      info: (msg: string, ...args: any[]) => console.info(chalk.blue(`${prefix} ${msg}`), ...args),
      warn: (msg: string, ...args: any[]) => console.warn(chalk.yellow(`${prefix} ${msg}`), ...args),
      error: (msg: string, ...args: any[]) => console.error(chalk.red(`${prefix} ${msg}`), ...args)
    };
  }

  /**
   * Creates a placeholder hook system object. In production, this is
   * expected to be replaced by an injected, fully functional hook system.
   *
   * @returns A placeholder hook system object.
   */
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

  /**
   * Creates a utilities object exposed to plugins, including path/fs/chalk
   * helpers and stubbed exec/spawn functions.
   *
   * @returns A utilities object for plugin consumption.
   */
  private createUtils(): any {
    return {
      path,
      fs,
      chalk,
      exec: async () => ({ stdout: '', stderr: '' }),
      spawn: async () => 0
    };
  }

  /**
   * Transitions a plugin from its current state to a new state, recording
   * the transition in state history and emitting state-changed and
   * state-specific events.
   *
   * @param registration - The managed registration whose state should change.
   * @param newState - The target lifecycle state.
   * @returns A promise that resolves when the transition is recorded and emitted.
   */
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

  /**
   * Validates that a manifest object has the required `name` and `version`
   * string fields.
   *
   * @param manifest - The manifest object to validate.
   * @returns `true` if the manifest is valid, `false` otherwise.
   */
  private isValidManifest(manifest: any): boolean {
    return manifest && 
           typeof manifest.name === 'string' && 
           typeof manifest.version === 'string';
  }

  /**
   * Retrieves the managed registration for a plugin by name.
   *
   * @param name - Name of the plugin to retrieve.
   * @returns The managed plugin registration, or `undefined` if not found.
   */
  getPlugin(name: string): ManagedPluginRegistration | undefined {
    return this.plugins.get(name);
  }

  /**
   * Retrieves all currently registered managed plugin registrations.
   *
   * @returns An array of all managed plugin registrations.
   */
  getPlugins(): ManagedPluginRegistration[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Retrieves all plugins that are currently in the specified lifecycle state.
   *
   * @param state - The lifecycle state to filter by.
   * @returns An array of managed plugin registrations matching the given state.
   */
  getPluginsByState(state: PluginState): ManagedPluginRegistration[] {
    return Array.from(this.plugins.values()).filter(p => p.state === state);
  }

  /**
   * Returns a copy of the current dependency graph, mapping each plugin name
   * to the set of dependency names it relies on.
   *
   * @returns A new Map containing the dependency graph.
   */
  getDependencyGraph(): Map<string, Set<string>> {
    return new Map(this.dependencyGraph);
  }

  /**
   * Computes aggregate lifecycle statistics across all registered plugins,
   * including counts by state, total errors, and average load/init/activation times.
   *
   * @returns An object containing total plugin count, per-state counts, total errors, and average timings.
   */
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

/**
 * Factory function that creates a new PluginLifecycleManager instance
 * with the given optional configuration.
 *
 * @param config - Optional partial configuration to override defaults.
 * @returns A new PluginLifecycleManager instance.
 */
export function createPluginLifecycleManager(config?: Partial<PluginLoaderConfig>): PluginLifecycleManager {
  return new PluginLifecycleManager(config);
}

