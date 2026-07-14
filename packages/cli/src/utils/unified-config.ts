/**
 * Unified Configuration Management System with Environment Synchronization
 * Provides centralized configuration management with sync across environments
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { EventEmitter } from 'events';

import {
  GlobalConfig,
  ProjectConfig,
} from './config';

/**
 * Represents the result of a configuration synchronization operation.
 */
export interface SyncStatus {
  lastSync: number;
  syncedEnvironments: string[];
  pendingChanges: string[];
  conflicts: ConfigConflict[];
  success: boolean;
  message?: string;
}

/**
 * Describes a conflict detected between two configuration sources during sync.
 */
export interface ConfigConflict {
  key: string;
  source: string;
  target: string;
  sourceValue: unknown;
  targetValue: unknown;
  resolution?: 'merge' | 'overwrite' | 'skip' | 'manual';
}

/**
 * Represents a single layer of configuration with a name, priority, source file, and config values.
 */
export interface ConfigLayer {
  name: string;
  priority: number;
  source: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
}

/**
 * Options for synchronizing configuration from a source environment to target environments.
 */
export interface SyncOptions {
  sourceEnv: string;
  targetEnvs: string[];
  includeSecrets?: boolean;
  dryRun?: boolean;
  mergeStrategy?: 'overwrite' | 'merge' | 'ask';
  excludePatterns?: string[];
  includePatterns?: string[];
}

/**
 * A point-in-time snapshot of an environment's configuration with a checksum and version.
 */
export interface ConfigSnapshot {
  timestamp: number;
  environment: string;
  config: Record<string, unknown>;
  checksum: string;
  version: string;
}

/**
 * Unified configuration manager that layers, merges, syncs, and snapshots configuration
 * across multiple environments. Extends `EventEmitter` to emit lifecycle events.
 */
export class UnifiedConfigManager extends EventEmitter {
  private projectPath: string;
  private configPath: string;
  private envPath: string;
  private layers: Map<string, ConfigLayer> = new Map();
  private snapshots: Map<string, ConfigSnapshot[]> = new Map();
  private globalConfig: GlobalConfig | null = null;
  private projectConfig: ProjectConfig | null = null;
  private envCache: Map<string, Record<string, string>> = new Map();

  constructor(projectPath: string = process.cwd()) {
    super();
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, 're-shell.config.yaml');
    this.envPath = path.join(projectPath, 're-shell.env.yaml');
    this.initializeDefaultLayers();
  }

  // Initialize default configuration layers
  private initializeDefaultLayers(): void {
    // Global config layer (lowest priority)
    this.addLayer({
      name: 'global',
      priority: 0,
      source: path.join(os.homedir(), '.re-shell', 'config.yaml'),
      config: {},
      readOnly: true,
    });

    // Project config layer
    this.addLayer({
      name: 'project',
      priority: 100,
      source: this.configPath,
      config: {},
    });

    // Environment-specific layers
    const environments = ['development', 'staging', 'production', 'test'];
    for (const env of environments) {
      this.addLayer({
        name: `env:${env}`,
        priority: 200,
        source: path.join(this.projectPath, `.re-shell.${env}.yaml`),
        config: {},
      });
    }

    // Local override layer (highest priority)
    this.addLayer({
      name: 'local',
      priority: 1000,
      source: path.join(this.projectPath, '.re-shell.local.yaml'),
      config: {},
    });
  }

  /**
   * Add a configuration layer to the manager.
   * @param layer - The configuration layer to add.
   */
  addLayer(layer: ConfigLayer): void {
    this.layers.set(layer.name, layer);
    this.emit('layer-added', layer);
  }

  /**
   * Remove a configuration layer by name.
   * @param name - The name of the layer to remove.
   */
  removeLayer(name: string): void {
    this.layers.delete(name);
    this.emit('layer-removed', name);
  }

  /**
   * Get a configuration layer by name.
   * @param name - The name of the layer to retrieve.
   * @returns The matching layer, or `undefined` if not found.
   */
  getLayer(name: string): ConfigLayer | undefined {
    return this.layers.get(name);
  }

  /**
   * Load all configuration layers from their source files.
   * @returns Resolves when all layers have been loaded.
   */
  async loadLayers(): Promise<void> {
    for (const [name, layer] of this.layers) {
      try {
        if (await fs.pathExists(layer.source)) {
          const content = await fs.readFile(layer.source, 'utf-8');
          layer.config = yaml.parse(content);
          this.emit('layer-loaded', { name, source: layer.source });
        }
      } catch (error) {
        this.emit('layer-error', { name, error: (error as Error).message });
      }
    }
  }

  /**
   * Get the merged configuration from all layers, optionally filtered by environment.
   * @param environment - Optional environment name to filter environment-specific layers.
   * @returns The merged configuration object.
   */
  getMergedConfig(environment?: string): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    // Sort layers by priority (lowest first)
    const sortedLayers = Array.from(this.layers.values()).sort((a, b) => a.priority - b.priority);

    for (const layer of sortedLayers) {
      // Filter layers by environment if specified
      if (environment && layer.name.startsWith('env:') && !layer.name.includes(environment)) {
        continue;
      }

      // Deep merge the config
      this.deepMerge(merged, layer.config);
    }

    return merged;
  }

  // Deep merge two objects
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const key of Object.keys(source)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue === null || sourceValue === undefined) {
        continue;
      }

      if (
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        target[key] = targetValue || {};
        this.deepMerge(target[key] as Record<string, unknown>, sourceValue as Record<string, unknown>);
      } else {
        target[key] = sourceValue;
      }
    }
  }

  /**
   * Get a configuration value by dot-notation key path.
   * @param keyPath - Dot-separated path to the value (e.g. `"database.host"`).
   * @param environment - Optional environment name to scope the lookup.
   * @returns The value at the path, or `undefined` if not found.
   */
  getValue(keyPath: string, environment?: string): unknown {
    const config = this.getMergedConfig(environment);
    const keys = keyPath.split('.');
    let value: unknown = config;

    for (const key of keys) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a configuration value by dot-notation key path within a specific layer.
   * @param keyPath - Dot-separated path to the value.
   * @param value - The value to set.
   * @param layer - The name of the layer to update (defaults to `"project"`).
   * @throws When the specified layer does not exist.
   */
  setValue(keyPath: string, value: unknown, layer = 'project'): void {
    const layerObj = this.layers.get(layer);
    if (!layerObj) {
      throw new Error(`Layer not found: ${layer}`);
    }

    const keys = keyPath.split('.');
    let config = layerObj.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in config) || typeof config[key] !== 'object') {
        config[key] = {};
      }
      config = config[key] as Record<string, unknown>;
    }

    config[keys[keys.length - 1]] = value;
    this.emit('value-changed', { layer, keyPath, value });
  }

  /**
   * Persist a specific layer's configuration to its source file.
   * @param layerName - The name of the layer to save.
   * @throws When the layer is not found or is read-only.
   */
  async saveLayer(layerName: string): Promise<void> {
    const layer = this.layers.get(layerName);
    if (!layer) {
      throw new Error(`Layer not found: ${layerName}`);
    }

    if (layer.readOnly) {
      throw new Error(`Cannot save read-only layer: ${layerName}`);
    }

    await fs.ensureDir(path.dirname(layer.source));
    const content = yaml.stringify(layer.config);
    await fs.writeFile(layer.source, content, 'utf-8');

    this.emit('layer-saved', { name: layerName, source: layer.source });
  }

  /**
   * Save all writable (non-read-only) layers to their source files.
   * @returns Resolves when all layers have been saved.
   */
  async saveAll(): Promise<void> {
    for (const [name, layer] of this.layers) {
      if (!layer.readOnly) {
        await this.saveLayer(name);
      }
    }
  }

  /**
   * Synchronize configuration from a source environment to one or more target environments.
   * @param options - Sync options including source, targets, merge strategy, and filters.
   * @returns The status of the synchronization operation.
   */
  async syncConfigurations(options: SyncOptions): Promise<SyncStatus> {
    const { sourceEnv, targetEnvs, includeSecrets = false, dryRun = false, mergeStrategy = 'merge', excludePatterns = [], includePatterns = [] } = options;

    const status: SyncStatus = {
      lastSync: Date.now(),
      syncedEnvironments: [],
      pendingChanges: [],
      conflicts: [],
      success: true,
    };

    try {
      // Get source environment config
      const sourceLayer = this.layers.get(`env:${sourceEnv}`);
      if (!sourceLayer) {
        throw new Error(`Source environment not found: ${sourceEnv}`);
      }

      const sourceConfig = { ...sourceLayer.config };

      // Filter config based on patterns
      const filteredConfig = this.filterConfig(sourceConfig, includePatterns, excludePatterns, includeSecrets);

      // Sync to each target environment
      for (const targetEnv of targetEnvs) {
        const targetLayer = this.layers.get(`env:${targetEnv}`);
        if (!targetLayer) {
          status.pendingChanges.push(`Target environment not found: ${targetEnv}`);
          continue;
        }

        // Detect conflicts
        const conflicts = this.detectConflicts(filteredConfig, targetLayer.config, sourceEnv, targetEnv);
        if (conflicts.length > 0) {
          status.conflicts.push(...conflicts);
        }

        // Apply merge strategy
        if (mergeStrategy === 'overwrite') {
          targetLayer.config = { ...filteredConfig, ...targetLayer.config };
        } else if (mergeStrategy === 'merge') {
          this.deepMerge(targetLayer.config, filteredConfig);
        } else {
          // Ask mode - collect conflicts for manual resolution
          continue;
        }

        if (!dryRun) {
          await this.saveLayer(`env:${targetEnv}`);
        }

        status.syncedEnvironments.push(targetEnv);
      }

      this.emit('sync-complete', status);

    } catch (error) {
      status.success = false;
      status.message = (error as Error).message;
      this.emit('sync-error', status);
    }

    return status;
  }

  // Filter configuration based on patterns
  private filterConfig(
    config: Record<string, unknown>,
    includePatterns: string[],
    excludePatterns: string[],
    includeSecrets: boolean
  ): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      // Check exclude patterns
      if (excludePatterns.some(pattern => key.match(pattern))) {
        continue;
      }

      // Check include patterns
      if (includePatterns.length > 0 && !includePatterns.some(pattern => key.match(pattern))) {
        continue;
      }

      // Filter secrets
      if (!includeSecrets && (key.includes('secret') || key.includes('password') || key.includes('token') || key.includes('api_key'))) {
        continue;
      }

      // Recursively filter nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        filtered[key] = this.filterConfig(
          value as Record<string, unknown>,
          includePatterns,
          excludePatterns,
          includeSecrets
        );
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  // Detect configuration conflicts
  private detectConflicts(
    source: Record<string, unknown>,
    target: Record<string, unknown>,
    sourceEnv: string,
    targetEnv: string
  ): ConfigConflict[] {
    const conflicts: ConfigConflict[] = [];

    for (const [key, sourceValue] of Object.entries(source)) {
      if (key in target) {
        const targetValue = target[key];
        if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
          conflicts.push({
            key,
            source: sourceEnv,
            target: targetEnv,
            sourceValue,
            targetValue,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a configuration conflict by applying the given resolution strategy.
   * @param conflict - The conflict to resolve.
   * @param resolution - The resolution strategy (`merge`, `overwrite`, `skip`, or `manual`).
   * @param targetEnv - The target environment whose layer will be updated.
   * @throws When the target environment layer is not found.
   */
  resolveConflict(conflict: ConfigConflict, resolution: ConfigConflict['resolution'], targetEnv: string): void {
    const targetLayer = this.layers.get(`env:${targetEnv}`);
    if (!targetLayer) {
      throw new Error(`Target environment not found: ${targetEnv}`);
    }

    if (resolution === 'overwrite') {
      this.setNestedValue(targetLayer.config, conflict.key, conflict.sourceValue);
    } else if (resolution === 'skip') {
      // Keep target value, do nothing
    } else if (resolution === 'merge') {
      const targetValue = this.getNestedValue(targetLayer.config, conflict.key);
      const merged = this.mergeValues(conflict.sourceValue, targetValue);
      this.setNestedValue(targetLayer.config, conflict.key, merged);
    }
  }

  // Get nested value from object
  private getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
    const keys = keyPath.split('.');
    let value: unknown = obj;
    for (const key of keys) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  // Set nested value in object
  private setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
    const keys = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }

  // Merge two values
  private mergeValues(source: unknown, target: unknown): unknown {
    if (typeof source === 'object' && typeof target === 'object' && source !== null && target !== null) {
      if (Array.isArray(source) && Array.isArray(target)) {
        return [...new Set([...source, ...target])];
      }
      if (!Array.isArray(source) && !Array.isArray(target)) {
        const merged = { ...target as Record<string, unknown> };
        for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
          if (key in merged) {
            merged[key] = this.mergeValues(value, merged[key]);
          } else {
            merged[key] = value;
          }
        }
        return merged;
      }
    }
    return target !== undefined ? target : source;
  }

  /**
   * Create and store a configuration snapshot for the given environment.
   * @param environment - The environment to snapshot.
   * @param version - Optional version label; auto-generated if omitted.
   * @returns The created snapshot.
   * @throws When the environment layer is not found.
   */
  async createSnapshot(environment: string, version?: string): Promise<ConfigSnapshot> {
    const layer = this.layers.get(`env:${environment}`);
    if (!layer) {
      throw new Error(`Environment not found: ${environment}`);
    }

    const checksum = this.generateChecksum(layer.config);
    const snapshot: ConfigSnapshot = {
      timestamp: Date.now(),
      environment,
      config: JSON.parse(JSON.stringify(layer.config)),
      checksum,
      version: version || this.generateVersion(),
    };

    if (!this.snapshots.has(environment)) {
      this.snapshots.set(environment, []);
    }

    this.snapshots.get(environment)!.push(snapshot);
    this.emit('snapshot-created', { environment, version: snapshot.version });

    return snapshot;
  }

  // Generate checksum for config
  private generateChecksum(config: Record<string, unknown>): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex').slice(0, 16);
  }

  // Generate version string
  private generateVersion(): string {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  }

  /**
   * List all stored snapshots for the given environment.
   * @param environment - The environment to list snapshots for.
   * @returns An array of snapshots, or an empty array if none exist.
   */
  listSnapshots(environment: string): ConfigSnapshot[] {
    return this.snapshots.get(environment) || [];
  }

  /**
   * Restore an environment's configuration from a previously created snapshot.
   * @param environment - The environment to restore.
   * @param version - The version label of the snapshot to restore.
   * @throws When the snapshot or environment layer is not found.
   */
  async restoreSnapshot(environment: string, version: string): Promise<void> {
    const snapshots = this.listSnapshots(environment);
    const snapshot = snapshots.find(s => s.version === version);

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${version}`);
    }

    const layer = this.layers.get(`env:${environment}`);
    if (!layer) {
      throw new Error(`Environment not found: ${environment}`);
    }

    layer.config = JSON.parse(JSON.stringify(snapshot.config));
    await this.saveLayer(`env:${environment}`);

    this.emit('snapshot-restored', { environment, version });
  }

  /**
   * Export the merged configuration to a JSON or YAML file.
   * @param outputPath - Destination file path.
   * @param environment - Optional environment to export.
   */
  async exportConfig(outputPath: string, environment?: string): Promise<void> {
    const config = this.getMergedConfig(environment);
    const ext = path.extname(outputPath);

    let content: string;
    if (ext === '.json') {
      content = JSON.stringify(config, null, 2);
    } else if (ext === '.yaml' || ext === '.yml') {
      content = yaml.stringify(config);
    } else {
      content = yaml.stringify(config);
    }

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, content, 'utf-8');

    this.emit('config-exported', { path: outputPath, environment });
  }

  /**
   * Import configuration from a JSON or YAML file into a specific layer.
   * @param inputPath - Source file path to import.
   * @param layer - Target layer name (defaults to `"project"`).
   * @param merge - Whether to merge with existing config (`true`) or replace it (`false`).
   * @throws When the target layer is not found.
   */
  async importConfig(inputPath: string, layer = 'project', merge = true): Promise<void> {
    const content = await fs.readFile(inputPath, 'utf-8');
    let config: Record<string, unknown>;

    const ext = path.extname(inputPath);
    if (ext === '.json') {
      config = JSON.parse(content);
    } else {
      config = yaml.parse(content);
    }

    const layerObj = this.layers.get(layer);
    if (!layerObj) {
      throw new Error(`Layer not found: ${layer}`);
    }

    if (merge) {
      this.deepMerge(layerObj.config, config);
    } else {
      layerObj.config = config;
    }

    await this.saveLayer(layer);
    this.emit('config-imported', { path: inputPath, layer, merge });
  }

  /**
   * Validate the merged configuration for required fields and valid values.
   * @param environment - Optional environment to validate against.
   * @returns An object with a `valid` flag and an array of error messages.
   */
  validateConfig(environment?: string): { valid: boolean; errors: string[] } {
    const config = this.getMergedConfig(environment);
    const errors: string[] = [];

    // Check for required fields
    if (!config.name && !config.project) {
      errors.push('Missing required field: name or project');
    }

    // Check for invalid types
    if (config.packageManager && !['npm', 'yarn', 'pnpm', 'bun'].includes(config.packageManager as string)) {
      errors.push(`Invalid packageManager: ${config.packageManager}`);
    }

    if (config.theme && !['auto', 'light', 'dark'].includes(config.theme as string)) {
      errors.push(`Invalid theme: ${config.theme}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get all configuration layers sorted by priority (lowest first).
   * @returns An array of all layers.
   */
  getAllLayers(): ConfigLayer[] {
    return Array.from(this.layers.values()).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get the environment variables for a given environment from the merged config.
   * @param environment - The environment name.
   * @returns A record of environment variable key-value pairs.
   */
  getEnvironmentVariables(environment: string): Record<string, string> {
    if (this.envCache.has(environment)) {
      return this.envCache.get(environment)!;
    }

    const config = this.getMergedConfig(environment);
    const envVars: Record<string, string> = {};

    // Extract variables from config
    if (config.variables && typeof config.variables === 'object') {
      Object.assign(envVars, config.variables as Record<string, string>);
    }

    // Extract from environment config section
    if (config.environments && typeof config.environments === 'object') {
      const envConfig = (config.environments as Record<string, unknown>)[environment];
      if (envConfig && typeof envConfig === 'object' && (envConfig as Record<string, unknown>).variables) {
        Object.assign(envVars, (envConfig as Record<string, unknown>).variables as Record<string, string>);
      }
    }

    this.envCache.set(environment, envVars);
    return envVars;
  }

  /**
   * Write environment variables to a `.env` file for the given environment.
   * @param environment - The environment name.
   * @param outputPath - Optional custom output path; defaults to `.env.<environment>`.
   */
  async writeEnvFile(environment: string, outputPath?: string): Promise<void> {
    const envVars = this.getEnvironmentVariables(environment);
    const lines: string[] = [];

    for (const [key, value] of Object.entries(envVars)) {
      lines.push(`${key}=${value}`);
    }

    const targetPath = outputPath || path.join(this.projectPath, `.env.${environment}`);
    await fs.writeFile(targetPath, lines.join('\n'), 'utf-8');

    this.emit('env-file-written', { environment, path: targetPath });
  }

  /**
   * Clear the cached environment variables.
   */
  clearCache(): void {
    this.envCache.clear();
  }
}

// Factory functions

/**
 * Create a unified config manager and load all its layers.
 * @param projectPath - Path to the project root (defaults to `process.cwd()`).
 * @returns A loaded `UnifiedConfigManager` instance.
 */
export async function createUnifiedConfig(projectPath?: string): Promise<UnifiedConfigManager> {
  const manager = new UnifiedConfigManager(projectPath);
  await manager.loadLayers();
  return manager;
}

/**
 * Get a configuration value using a temporary manager instance.
 * @param keyPath - Dot-separated path to the value.
 * @param projectPath - Path to the project root (defaults to `process.cwd()`).
 * @param environment - Optional environment name to scope the lookup.
 * @returns The value at the given path, or `undefined`.
 */
export async function getConfigValue(keyPath: string, projectPath = process.cwd(), environment?: string): Promise<unknown> {
  const manager = new UnifiedConfigManager(projectPath);
  await manager.loadLayers();
  return manager.getValue(keyPath, environment);
}

/**
 * Set a configuration value and persist all writable layers using a temporary manager.
 * @param keyPath - Dot-separated path to the value.
 * @param value - The value to set.
 * @param projectPath - Path to the project root (defaults to `process.cwd()`).
 * @param layer - Target layer name (defaults to `"project"`).
 */
export async function setConfigValue(keyPath: string, value: unknown, projectPath = process.cwd(), layer = 'project'): Promise<void> {
  const manager = new UnifiedConfigManager(projectPath);
  await manager.loadLayers();
  manager.setValue(keyPath, value, layer);
  await manager.saveAll();
}

/**
 * List all supported environment names.
 * @returns An array of environment name strings.
 */
export function listEnvironments(): string[] {
  return ['development', 'staging', 'production', 'test'];
}

/**
 * Compare two configuration objects and report added, removed, changed, and unchanged keys.
 * @param config1 - The first (source) configuration.
 * @param config2 - The second (target) configuration.
 * @returns An object with `added`, `removed`, `changed`, and `unchanged` keys describing the differences.
 */
export function compareConfigs(config1: Record<string, unknown>, config2: Record<string, unknown>): {
  added: string[];
  removed: string[];
  changed: Record<string, { from: unknown; to: unknown }>;
  unchanged: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const unchanged: string[] = [];

  const allKeys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

  for (const key of allKeys) {
    const value1 = config1[key];
    const value2 = config2[key];

    if (!(key in config1)) {
      added.push(key);
    } else if (!(key in config2)) {
      removed.push(key);
    } else if (JSON.stringify(value1) !== JSON.stringify(value2)) {
      changed[key] = { from: value1, to: value2 };
    } else {
      unchanged.push(key);
    }
  }

  return { added, removed, changed, unchanged };
}
