import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { EventEmitter } from 'events';
import { ValidationError } from '../utils/error-handler';

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    default?: any;
    required?: boolean;
    description?: string;
    validator?: (value: any) => boolean;
    transformer?: (value: any) => any;
  };
}

export interface ConfigOptions {
  globalPath?: string;
  projectPath?: string;
  schema?: ConfigSchema;
  defaults?: Record<string, any>;
  envPrefix?: string;
  autoSave?: boolean;
  watch?: boolean;
}

export class ConfigManager extends EventEmitter {
  private globalPath: string;
  private projectPath?: string;
  private schema?: ConfigSchema;
  private defaults: Record<string, any>;
  private envPrefix: string;
  private autoSave: boolean;
  private watchEnabled: boolean;
  
  private config: Record<string, any> = {};
  private projectConfig: Record<string, any> = {};
  private envConfig: Record<string, any> = {};
  private runtimeConfig: Record<string, any> = {};
  
  private watchers: Map<string, fs.FSWatcher> = new Map();

  constructor(options: ConfigOptions = {}) {
    super();
    
    this.globalPath = options.globalPath ?? path.join(
      process.env.HOME || process.env.USERPROFILE || '.',
      '.re-shell',
      'config.yaml'
    );
    this.projectPath = options.projectPath;
    this.schema = options.schema;
    this.defaults = options.defaults ?? {};
    this.envPrefix = options.envPrefix ?? 'RESHELL_';
    this.autoSave = options.autoSave ?? true;
    this.watchEnabled = options.watch ?? false;
    
    this.load();
  }

  private load(): void {
    // Load defaults
    this.config = { ...this.defaults };
    
    // Load global config
    if (fs.existsSync(this.globalPath)) {
      try {
        const content = fs.readFileSync(this.globalPath, 'utf8');
        const globalConfig = yaml.parse(content) || {};
        this.mergeConfig(this.config, globalConfig);
        
        if (this.watchEnabled) {
          this.watchFile(this.globalPath, 'global');
        }
      } catch (error: any) {
        this.emit('error', new Error(`Failed to load global config: ${error.message}`));
      }
    }
    
    // Load project config
    if (this.projectPath && fs.existsSync(this.projectPath)) {
      try {
        const content = fs.readFileSync(this.projectPath, 'utf8');
        this.projectConfig = yaml.parse(content) || {};
        this.mergeConfig(this.config, this.projectConfig);
        
        if (this.watchEnabled) {
          this.watchFile(this.projectPath, 'project');
        }
      } catch (error: any) {
        this.emit('error', new Error(`Failed to load project config: ${error.message}`));
      }
    }
    
    // Load environment variables
    this.loadEnvConfig();
    this.mergeConfig(this.config, this.envConfig);
    
    // Apply runtime config last (highest priority)
    this.mergeConfig(this.config, this.runtimeConfig);
    
    // Validate config
    if (this.schema) {
      this.validateConfig();
    }
    
    this.emit('loaded', this.config);
  }

  private loadEnvConfig(): void {
    this.envConfig = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(this.envPrefix)) {
        const configKey = key
          .substring(this.envPrefix.length)
          .toLowerCase()
          .replace(/_/g, '.');
        
        this.setNestedValue(this.envConfig, configKey, this.parseEnvValue(value));
      }
    }
  }

  private parseEnvValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Try to parse as number
      if (/^\d+$/.test(value)) {
        return parseInt(value, 10);
      }
      if (/^\d*\.\d+$/.test(value)) {
        return parseFloat(value);
      }
      // Parse as boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      // Return as string
      return value;
    }
  }

  private mergeConfig(target: Record<string, any>, source: Record<string, any>): void {
    for (const [key, value] of Object.entries(source)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        if (!(key in target) || typeof target[key] !== 'object') {
          target[key] = {};
        }
        this.mergeConfig(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }

  private validateConfig(): void {
    if (!this.schema) return;
    
    for (const [key, schema] of Object.entries(this.schema)) {
      const value = this.get(key);
      
      // Check required
      if (schema.required && value === undefined) {
        throw new ValidationError(`Configuration key '${key}' is required`);
      }
      
      // Check type
      if (value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== schema.type) {
          throw new ValidationError(
            `Configuration key '${key}' must be of type ${schema.type}, got ${actualType}`
          );
        }
      }
      
      // Run validator
      if (schema.validator && value !== undefined) {
        if (!schema.validator(value)) {
          throw new ValidationError(`Configuration key '${key}' failed validation`);
        }
      }
      
      // Apply transformer
      if (schema.transformer && value !== undefined) {
        this.set(key, schema.transformer(value));
      }
    }
  }

  private watchFile(filepath: string, type: 'global' | 'project'): void {
    if (this.watchers.has(filepath)) return;
    
    const watcher = fs.watch(filepath as string, (eventType) => {
      if (eventType === 'change') {
        this.emit('change', { type, path: filepath });
        this.load();
      }
    });
    
    this.watchers.set(filepath, watcher);
  }

  get<T = any>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let value: any = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue as T;
      }
    }
    
    return value as T;
  }

  set(key: string, value: any): void {
    this.setNestedValue(this.runtimeConfig, key, value);
    this.setNestedValue(this.config, key, value);
    
    this.emit('set', { key, value });
    
    if (this.autoSave && this.projectPath) {
      this.save();
    }
  }

  private setNestedValue(obj: Record<string, any>, key: string, value: any): void {
    const keys = key.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        return;
      }
      current = current[k];
    }
    
    delete current[keys[keys.length - 1]];
    
    // Also delete from runtime config
    this.deleteNestedValue(this.runtimeConfig, key);
    
    this.emit('delete', { key });
    
    if (this.autoSave && this.projectPath) {
      this.save();
    }
  }

  private deleteNestedValue(obj: Record<string, any>, key: string): void {
    const keys = key.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        return;
      }
      current = current[k];
    }
    
    delete current[keys[keys.length - 1]];
  }

  getAll(): Record<string, any> {
    return { ...this.config };
  }

  save(filePath?: string): void {
    const savePath = filePath || this.projectPath;
    if (!savePath) {
      throw new Error('No save path specified');
    }
    
    try {
      // Ensure directory exists
      fs.ensureDirSync(path.dirname(savePath));
      
      // Merge project config with runtime config
      const configToSave = { ...this.projectConfig };
      this.mergeConfig(configToSave, this.runtimeConfig);
      
      // Write config
      const content = yaml.stringify(configToSave, {
        indent: 2,
        lineWidth: 0
      });
      
      fs.writeFileSync(savePath, content, 'utf8');
      
      this.emit('saved', { path: savePath });
    } catch (error: any) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  reload(): void {
    this.load();
  }

  reset(): void {
    this.config = { ...this.defaults };
    this.projectConfig = {};
    this.envConfig = {};
    this.runtimeConfig = {};
    
    this.loadEnvConfig();
    this.mergeConfig(this.config, this.envConfig);
    
    this.emit('reset');
  }

  watchFiles(enabled: boolean): void {
    if (enabled === this.watchEnabled) return;
    
    this.watchEnabled = enabled;
    
    if (enabled) {
      if (fs.existsSync(this.globalPath)) {
        this.watchFile(this.globalPath, 'global');
      }
      if (this.projectPath && fs.existsSync(this.projectPath)) {
        this.watchFile(this.projectPath, 'project');
      }
    } else {
      for (const [path, watcher] of this.watchers) {
        watcher.close();
      }
      this.watchers.clear();
    }
  }

  dispose(): void {
    this.watchFiles(false);
    this.removeAllListeners();
  }

  // Utility methods
  getGlobalPath(): string {
    return this.globalPath;
  }

  getProjectPath(): string | undefined {
    return this.projectPath;
  }

  setProjectPath(path: string): void {
    this.projectPath = path;
    this.load();
  }

  getSchema(): ConfigSchema | undefined {
    return this.schema;
  }

  setSchema(schema: ConfigSchema): void {
    this.schema = schema;
    this.validateConfig();
  }
}

// Global config instance
let globalConfig: ConfigManager | null = null;

export function createConfigManager(options?: ConfigOptions): ConfigManager {
  return new ConfigManager(options);
}

export function getGlobalConfig(): ConfigManager {
  if (!globalConfig) {
    const projectPath = path.join(process.cwd(), '.re-shell', 'config.yaml');
    globalConfig = new ConfigManager({
      projectPath: fs.existsSync(projectPath) ? projectPath : undefined
    });
  }
  return globalConfig;
}

export function setGlobalConfig(config: ConfigManager): void {
  if (globalConfig) {
    globalConfig.dispose();
  }
  globalConfig = config;
}