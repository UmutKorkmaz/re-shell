import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { configManager, CONFIG_PATHS } from './config';
import { ValidationError } from './error-handler';

// Configuration change event types
export interface ConfigChangeEvent {
  type: 'changed' | 'added' | 'unlinked';
  path: string;
  configType: 'global' | 'project' | 'workspace';
  timestamp: Date;
  config?: any;
  error?: Error;
}

// Hot reload options
export interface HotReloadOptions {
  enabled?: boolean;
  debounceMs?: number;
  validateOnChange?: boolean;
  autoBackup?: boolean;
  restoreOnError?: boolean;
  verbose?: boolean;
  includeWorkspaces?: boolean;
  excludePatterns?: string[];
  profile?: any;
  services?: string[];
}

// Configuration watcher class
export class ConfigWatcher extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private isWatching = false;
  private options: Required<HotReloadOptions>;
  private lastConfigs: Map<string, any> = new Map();
  private backupIds: Map<string, string> = new Map();

  constructor(options: HotReloadOptions = {}) {
    super();
    this.options = {
      enabled: true,
      debounceMs: 500,
      validateOnChange: true,
      autoBackup: false,
      restoreOnError: false,
      verbose: false,
      includeWorkspaces: true,
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      profile: options.profile || null,
      services: options.services || [],
      ...options
    } as Required<HotReloadOptions>;
  }

  // Start watching configuration files
  async startWatching(): Promise<void> {
    if (this.isWatching) {
      if (this.options.verbose) {
        console.log(chalk.yellow('Configuration watcher is already running'));
      }
      return;
    }

    if (!this.options.enabled) {
      if (this.options.verbose) {
        console.log(chalk.gray('Configuration hot-reloading is disabled'));
      }
      return;
    }

    this.isWatching = true;

    try {
      // Watch global configuration
      await this.watchGlobalConfig();

      // Watch project configuration
      await this.watchProjectConfig();

      // Watch workspace configurations if enabled
      if (this.options.includeWorkspaces) {
        await this.watchWorkspaceConfigs();
      }

      if (this.options.verbose) {
        console.log(chalk.green('🔥 Configuration hot-reloading started'));
        this.logWatchedFiles();
      }

      // Store initial configurations for comparison
      await this.storeInitialConfigs();

      this.emit('watching-started');
    } catch (error) {
      this.isWatching = false;
      if (this.options.verbose) {
        console.error(chalk.red('Failed to start configuration watcher:'), error);
      }
      throw error;
    }
  }

  // Stop watching configuration files
  async stopWatching(): Promise<void> {
    if (!this.isWatching) return;

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    for (const [path, watcher] of this.watchers) {
      await watcher.close();
      if (this.options.verbose) {
        console.log(chalk.gray(`Stopped watching: ${path}`));
      }
    }
    this.watchers.clear();

    this.isWatching = false;
    this.lastConfigs.clear();
    this.backupIds.clear();

    if (this.options.verbose) {
      console.log(chalk.green('🛑 Configuration hot-reloading stopped'));
    }

    this.emit('watching-stopped');
  }

  // Check if watcher is currently active
  isActive(): boolean {
    return this.isWatching;
  }

  // Get current watch status
  getStatus(): {
    isWatching: boolean;
    watchedPaths: string[];
    options: HotReloadOptions;
    lastChanges: ConfigChangeEvent[];
  } {
    return {
      isWatching: this.isWatching,
      watchedPaths: Array.from(this.watchers.keys()),
      options: this.options,
      lastChanges: [] // TODO: Implement change history
    };
  }

  // Update watcher options
  updateOptions(newOptions: Partial<HotReloadOptions>): void {
    const wasWatching = this.isWatching;
    
    if (wasWatching) {
      this.stopWatching();
    }

    this.options = { ...this.options, ...newOptions };

    if (wasWatching && this.options.enabled) {
      this.startWatching();
    }
  }

  // Force reload all configurations
  async forceReload(): Promise<void> {
    if (this.options.verbose) {
      console.log(chalk.cyan('🔄 Force reloading all configurations...'));
    }

    try {
      // Reload global config
      const globalConfig = await configManager.loadGlobalConfig();
      this.emit('config-changed', {
        type: 'changed',
        path: CONFIG_PATHS.GLOBAL_CONFIG,
        configType: 'global',
        timestamp: new Date(),
        config: globalConfig
      } as ConfigChangeEvent);

      // Reload project config
      try {
        const projectConfig = await configManager.loadProjectConfig();
        this.emit('config-changed', {
          type: 'changed',
          path: path.join(process.cwd(), CONFIG_PATHS.PROJECT_CONFIG),
          configType: 'project',
          timestamp: new Date(),
          config: projectConfig
        } as ConfigChangeEvent);
      } catch (error) {
        // Project config might not exist
      }

      if (this.options.verbose) {
        console.log(chalk.green('✅ Force reload completed'));
      }
    } catch (error) {
      if (this.options.verbose) {
        console.error(chalk.red('❌ Force reload failed:'), error);
      }
      throw error;
    }
  }

  // Private methods
  private async watchGlobalConfig(): Promise<void> {
    const globalConfigPath = CONFIG_PATHS.GLOBAL_CONFIG;
    const globalConfigDir = path.dirname(globalConfigPath);

    // Ensure global config directory exists
    await fs.ensureDir(globalConfigDir);

    const watcher = chokidar.watch(globalConfigPath, {
      ignored: this.options.excludePatterns,
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('change', (filePath) => this.handleConfigChange(filePath, 'global', 'changed'))
      .on('add', (filePath) => this.handleConfigChange(filePath, 'global', 'added'))
      .on('unlink', (filePath) => this.handleConfigChange(filePath, 'global', 'unlinked'))
      .on('error', (error) => {
        if (this.options.verbose) {
          console.error(chalk.red(`Global config watcher error: ${error}`));
        }
        this.emit('error', error);
      });

    this.watchers.set(globalConfigPath, watcher);
  }

  private async watchProjectConfig(): Promise<void> {
    const projectConfigPath = path.join(process.cwd(), CONFIG_PATHS.PROJECT_CONFIG);
    const projectConfigDir = path.dirname(projectConfigPath);

    // Only watch if project config directory exists
    if (!(await fs.pathExists(projectConfigDir))) {
      return;
    }

    const watcher = chokidar.watch(projectConfigPath, {
      ignored: this.options.excludePatterns,
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('change', (filePath) => this.handleConfigChange(filePath, 'project', 'changed'))
      .on('add', (filePath) => this.handleConfigChange(filePath, 'project', 'added'))
      .on('unlink', (filePath) => this.handleConfigChange(filePath, 'project', 'unlinked'))
      .on('error', (error) => {
        if (this.options.verbose) {
          console.error(chalk.red(`Project config watcher error: ${error}`));
        }
        this.emit('error', error);
      });

    this.watchers.set(projectConfigPath, watcher);
  }

  private async watchWorkspaceConfigs(): Promise<void> {
    // Find workspace configuration files
    const searchPaths = [
      path.join(process.cwd(), 'apps'),
      path.join(process.cwd(), 'packages'),
      path.join(process.cwd(), 'libs'),
      path.join(process.cwd(), 'tools')
    ];

    for (const searchPath of searchPaths) {
      if (await fs.pathExists(searchPath)) {
        const workspacePattern = path.join(searchPath, '**/.re-shell/config.yaml');
        
        const watcher = chokidar.watch(workspacePattern, {
          ignored: this.options.excludePatterns,
          persistent: true,
          ignoreInitial: true
        });

        watcher
          .on('change', (filePath) => this.handleConfigChange(filePath, 'workspace', 'changed'))
          .on('add', (filePath) => this.handleConfigChange(filePath, 'workspace', 'added'))
          .on('unlink', (filePath) => this.handleConfigChange(filePath, 'workspace', 'unlinked'))
          .on('error', (error) => {
            if (this.options.verbose) {
              console.error(chalk.red(`Workspace config watcher error: ${error}`));
            }
            this.emit('error', error);
          });

        this.watchers.set(workspacePattern, watcher);
      }
    }
  }

  private handleConfigChange(filePath: string, configType: 'global' | 'project' | 'workspace', changeType: 'changed' | 'added' | 'unlinked'): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      await this.processConfigChange(filePath, configType, changeType);
      this.debounceTimers.delete(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private async processConfigChange(filePath: string, configType: 'global' | 'project' | 'workspace', changeType: 'changed' | 'added' | 'unlinked'): Promise<void> {
    const event: ConfigChangeEvent = {
      type: changeType,
      path: filePath,
      configType,
      timestamp: new Date()
    };

    if (this.options.verbose) {
      console.log(chalk.cyan(`🔄 Config ${changeType}: ${path.relative(process.cwd(), filePath)} (${configType})`));
    }

    try {
      if (changeType === 'unlinked') {
        // Handle file deletion
        this.lastConfigs.delete(filePath);
        this.emit('config-changed', event);
        return;
      }

      // Create backup if enabled
      if (this.options.autoBackup && changeType === 'changed') {
        await this.createChangeBackup(filePath, configType);
      }

      // Load and validate the new configuration
      let newConfig: any;
      
      switch (configType) {
        case 'global':
          newConfig = await configManager.loadGlobalConfig();
          break;
        case 'project':
          newConfig = await configManager.loadProjectConfig();
          break;
        case 'workspace':
          {
          const workspacePath = path.dirname(path.dirname(filePath));
          newConfig = await configManager.loadWorkspaceConfig(workspacePath);
          break;
          }
      }

      // Validate configuration if enabled
      if (this.options.validateOnChange) {
        await this.validateConfig(newConfig, configType);
      }

      // Check if configuration actually changed
      const lastConfig = this.lastConfigs.get(filePath);
      const configChanged = !lastConfig || JSON.stringify(lastConfig) !== JSON.stringify(newConfig);

      if (configChanged) {
        this.lastConfigs.set(filePath, newConfig);
        event.config = newConfig;
        this.emit('config-changed', event);

        if (this.options.verbose) {
          console.log(chalk.green(`✅ Configuration reloaded: ${path.basename(filePath)}`));
        }
      } else if (this.options.verbose) {
        console.log(chalk.gray(`⏭️  No changes detected: ${path.basename(filePath)}`));
      }

    } catch (error) {
      event.error = error as Error;
      
      if (this.options.verbose) {
        console.error(chalk.red(`❌ Failed to reload config: ${error}`));
      }

      // Restore from backup if enabled and available
      if (this.options.restoreOnError) {
        await this.restoreFromBackup(filePath, configType);
      }

      this.emit('config-error', event);
    }
  }

  private async validateConfig(config: any, configType: string): Promise<void> {
    // Basic validation - can be extended with schema validation
    if (!config || typeof config !== 'object') {
      throw new ValidationError(`Invalid ${configType} configuration: must be an object`);
    }

    // Type-specific validation
    switch (configType) {
      case 'global':
        if (!config.version) {
          throw new ValidationError('Global configuration missing version field');
        }
        break;
      case 'project':
        if (!config.name) {
          throw new ValidationError('Project configuration missing name field');
        }
        break;
      case 'workspace':
        if (!config.name || !config.type) {
          throw new ValidationError('Workspace configuration missing required fields (name, type)');
        }
        break;
    }
  }

  private async createChangeBackup(filePath: string, configType: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { configBackupManager } = require('./config-backup');
      const backupName = `auto-${configType}-${Date.now()}`;
      const backupId = await configBackupManager.createSelectiveBackup(
        backupName,
        { [configType]: true },
        `Automatic backup before configuration change`,
        ['auto', 'hot-reload', configType]
      );
      this.backupIds.set(filePath, backupId);
    } catch (error) {
      if (this.options.verbose) {
        console.warn(chalk.yellow(`Warning: Failed to create backup: ${error}`));
      }
    }
  }

  private async restoreFromBackup(filePath: string, configType: string): Promise<void> {
    const backupId = this.backupIds.get(filePath);
    if (!backupId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { configBackupManager } = require('./config-backup');
      await configBackupManager.restoreFromBackup(backupId, { force: true });
      
      if (this.options.verbose) {
        console.log(chalk.green(`🔄 Restored configuration from backup: ${backupId}`));
      }
    } catch (error) {
      if (this.options.verbose) {
        console.warn(chalk.yellow(`Warning: Failed to restore from backup: ${error}`));
      }
    }
  }

  private async storeInitialConfigs(): Promise<void> {
    try {
      // Store initial global config
      const globalPath = CONFIG_PATHS.GLOBAL_CONFIG;
      if (await fs.pathExists(globalPath)) {
        const globalConfig = await configManager.loadGlobalConfig();
        this.lastConfigs.set(globalPath, globalConfig);
      }

      // Store initial project config
      const projectPath = path.join(process.cwd(), CONFIG_PATHS.PROJECT_CONFIG);
      if (await fs.pathExists(projectPath)) {
        const projectConfig = await configManager.loadProjectConfig();
        this.lastConfigs.set(projectPath, projectConfig);
      }
    } catch (error) {
      if (this.options.verbose) {
        console.warn(chalk.yellow(`Warning: Failed to store initial configs: ${error}`));
      }
    }
  }

  private logWatchedFiles(): void {
    console.log(chalk.cyan('\n👀 Watching configuration files:'));
    for (const path of this.watchers.keys()) {
      console.log(`  • ${chalk.gray(path)}`);
    }
    console.log();
  }
}

// Export singleton instance
export const configWatcher = new ConfigWatcher();

// Utility function to setup hot reloading with default options
export async function setupConfigHotReload(options: HotReloadOptions = {}): Promise<ConfigWatcher> {
  const watcher = new ConfigWatcher(options);
  
  // Setup default event handlers
  watcher.on('config-changed', (event: ConfigChangeEvent) => {
    if (options.verbose) {
      console.log(chalk.green(`🔄 Configuration updated: ${event.configType}`));
    }
  });

  watcher.on('config-error', (event: ConfigChangeEvent) => {
    if (options.verbose) {
      console.error(chalk.red(`❌ Configuration error: ${event.error?.message}`));
    }
  });

  await watcher.startWatching();
  return watcher;
}

// Utility function for development mode
export async function startDevMode(options: HotReloadOptions = {}): Promise<void> {
  const devOptions: HotReloadOptions = {
    enabled: true,
    verbose: true,
    validateOnChange: true,
    autoBackup: true,
    restoreOnError: true,
    debounceMs: 300,
    ...options
  };

  const watcher = await setupConfigHotReload(devOptions);
  
  console.log(chalk.green('🚀 Development mode started with configuration hot-reloading'));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 Shutting down development mode...'));
    await watcher.stopWatching();
    process.exit(0);
  });

  return Promise.resolve();
}