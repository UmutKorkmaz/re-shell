import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { ValidationError } from './error-handler';

// Configuration schema definitions
export interface GlobalConfig {
  version: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  defaultFramework: string;
  defaultTemplate: string;
  presets: Record<string, ProjectPreset>;
  user: {
    name?: string;
    email?: string;
    organization?: string;
  };
  cli: {
    autoUpdate: boolean;
    telemetry: boolean;
    verbose: boolean;
    theme: 'auto' | 'light' | 'dark';
  };
  paths: {
    templates: string;
    cache: string;
    plugins: string;
  };
  plugins: {
    enabled: string[];
    marketplace: {
      registry: string;
      autoUpdate: boolean;
    };
  };
}

export interface ProjectConfig {
  name: string;
  version: string;
  type: 'monorepo' | 'standalone';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  framework: string;
  template: string;
  environments: Record<string, EnvironmentConfig>;
  workspaces: {
    root: string;
    patterns: string[];
    types: string[];
  };
  git: {
    submodules: boolean;
    hooks: boolean;
    conventionalCommits: boolean;
  };
  build: {
    target: string;
    optimize: boolean;
    analyze: boolean;
    minify?: boolean;
  };
  dev: {
    port: number;
    host: string;
    open: boolean;
    hmr: boolean;
  };
  quality: {
    linting: boolean;
    testing: boolean;
    coverage: {
      enabled: boolean;
      threshold: number;
    };
    security: {
      enabled: boolean;
      autoFix: boolean;
    };
  };
}

export interface EnvironmentConfig {
  name: string;
  variables: Record<string, string>;
  build: {
    mode: 'development' | 'staging' | 'production';
    optimization: boolean;
    sourcemaps: boolean;
    minify?: boolean;
    analyze?: boolean;
    target?: string;
    externals?: string[];
  };
  deployment: {
    provider?: 'vercel' | 'netlify' | 'aws' | 'azure' | 'gcp' | 'docker' | 'custom';
    target?: string;
    region?: string;
    domain?: string;
    config?: Record<string, any>;
    secrets?: string[];
    hooks?: {
      preDeploy?: string[];
      postDeploy?: string[];
    };
  };
}

export interface WorkspaceConfig {
  name: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  framework?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  template?: string;
  dependencies?: string[];
  devDependencies?: string[];
  build?: {
    target?: string;
    optimize?: boolean;
    analyze?: boolean;
    minify?: boolean;
    outDir?: string;
    sourcemap?: boolean;
  };
  dev?: {
    port?: number;
    host?: string;
    open?: boolean;
    hmr?: boolean;
    proxy?: Record<string, string>;
  };
  quality?: {
    linting?: boolean;
    testing?: boolean;
    coverage?: {
      enabled?: boolean;
      threshold?: number;
    };
    security?: {
      enabled?: boolean;
      autoFix?: boolean;
    };
  };
  deployment?: {
    provider?: string;
    config?: Record<string, any>;
  };
  environment?: Record<string, any>;
}

export interface ProjectPreset {
  name: string;
  description: string;
  config: Partial<ProjectConfig>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Schema validation
const GLOBAL_CONFIG_SCHEMA = {
  version: 'string',
  packageManager: ['npm', 'yarn', 'pnpm', 'bun'],
  defaultFramework: 'string',
  defaultTemplate: 'string',
  presets: 'object',
  user: {
    name: 'string?',
    email: 'string?',
    organization: 'string?'
  },
  cli: {
    autoUpdate: 'boolean',
    telemetry: 'boolean',
    verbose: 'boolean',
    theme: ['auto', 'light', 'dark']
  },
  paths: {
    templates: 'string',
    cache: 'string',
    plugins: 'string'
  },
  plugins: {
    enabled: 'array',
    marketplace: {
      registry: 'string',
      autoUpdate: 'boolean'
    }
  }
};

// Default configurations
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  version: '1.0.0',
  packageManager: 'pnpm',
  defaultFramework: 'react-ts',
  defaultTemplate: 'blank',
  presets: {},
  user: {},
  cli: {
    autoUpdate: true,
    telemetry: true,
    verbose: false,
    theme: 'auto'
  },
  paths: {
    templates: path.join(os.homedir(), '.re-shell', 'templates'),
    cache: path.join(os.homedir(), '.re-shell', 'cache'),
    plugins: path.join(os.homedir(), '.re-shell', 'plugins')
  },
  plugins: {
    enabled: [],
    marketplace: {
      registry: 'https://registry.npmjs.org',
      autoUpdate: false
    }
  }
};

export const DEFAULT_PROJECT_CONFIG: Partial<ProjectConfig> = {
  type: 'monorepo',
  packageManager: 'pnpm',
  framework: 'react-ts',
  template: 'blank',
  environments: {
    development: {
      name: 'development',
      variables: {},
      build: {
        mode: 'development',
        optimization: false,
        sourcemaps: true
      },
      deployment: {}
    },
    staging: {
      name: 'staging',
      variables: {},
      build: {
        mode: 'staging',
        optimization: true,
        sourcemaps: true
      },
      deployment: {}
    },
    production: {
      name: 'production',
      variables: {},
      build: {
        mode: 'production',
        optimization: true,
        sourcemaps: false
      },
      deployment: {}
    }
  },
  workspaces: {
    root: '.',
    patterns: ['apps/*', 'packages/*', 'libs/*', 'tools/*'],
    types: ['app', 'package', 'lib', 'tool']
  },
  git: {
    submodules: true,
    hooks: true,
    conventionalCommits: true
  },
  build: {
    target: 'es2020',
    optimize: true,
    analyze: false
  },
  dev: {
    port: 3000,
    host: 'localhost',
    open: false,
    hmr: true
  },
  quality: {
    linting: true,
    testing: true,
    coverage: {
      enabled: true,
      threshold: 80
    },
    security: {
      enabled: true,
      autoFix: false
    }
  }
};

// Path utilities
export const CONFIG_PATHS = {
  GLOBAL_DIR: path.join(os.homedir(), '.re-shell'),
  GLOBAL_CONFIG: path.join(os.homedir(), '.re-shell', 'config.yaml'),
  PROJECT_CONFIG: '.re-shell/config.yaml',
  WORKSPACE_CONFIG: 're-shell.workspaces.yaml',
  WORKSPACE_DIR_CONFIG: '.re-shell/workspace.yaml'
};

// Configuration manager class
export class ConfigManager {
  private globalConfig: GlobalConfig | null = null;
  private projectConfig: ProjectConfig | null = null;

  // Global configuration management
  async loadGlobalConfig(): Promise<GlobalConfig> {
    if (this.globalConfig) {
      return this.globalConfig;
    }

    try {
      if (await fs.pathExists(CONFIG_PATHS.GLOBAL_CONFIG)) {
        const content = await fs.readFile(CONFIG_PATHS.GLOBAL_CONFIG, 'utf8');
        const config = yaml.parse(content) as GlobalConfig;
        this.validateGlobalConfig(config);
        this.globalConfig = config;
        return config;
      }
    } catch (error) {
      throw new ValidationError(`Failed to load global config: ${(error as Error).message}`);
    }

    // Create default config if none exists
    this.globalConfig = DEFAULT_GLOBAL_CONFIG;
    await this.saveGlobalConfig(this.globalConfig);
    return this.globalConfig;
  }

  async saveGlobalConfig(config: GlobalConfig): Promise<void> {
    try {
      await fs.ensureDir(CONFIG_PATHS.GLOBAL_DIR);
      this.validateGlobalConfig(config);
      const content = yaml.stringify(config);
      await fs.writeFile(CONFIG_PATHS.GLOBAL_CONFIG, content, 'utf8');
      this.globalConfig = config;
    } catch (error) {
      throw new ValidationError(`Failed to save global config: ${(error as Error).message}`);
    }
  }

  async updateGlobalConfig(updates: Partial<GlobalConfig>): Promise<GlobalConfig> {
    const config = await this.loadGlobalConfig();
    const updatedConfig = this.mergeConfig(config, updates) as GlobalConfig;
    await this.saveGlobalConfig(updatedConfig);
    return updatedConfig;
  }

  // Project configuration management
  async loadProjectConfig(projectPath: string = process.cwd()): Promise<ProjectConfig | null> {
    const configPath = path.join(projectPath, CONFIG_PATHS.PROJECT_CONFIG);
    
    try {
      if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf8');
        const config = yaml.parse(content) as ProjectConfig;
        this.validateProjectConfig(config);
        return config;
      }
    } catch (error) {
      throw new ValidationError(`Failed to load project config: ${(error as Error).message}`);
    }

    return null;
  }

  async saveProjectConfig(config: ProjectConfig, projectPath: string = process.cwd()): Promise<void> {
    try {
      const configDir = path.join(projectPath, '.re-shell');
      const configPath = path.join(projectPath, CONFIG_PATHS.PROJECT_CONFIG);
      
      await fs.ensureDir(configDir);
      this.validateProjectConfig(config);
      const content = yaml.stringify(config);
      await fs.writeFile(configPath, content, 'utf8');
      this.projectConfig = config;
    } catch (error) {
      throw new ValidationError(`Failed to save project config: ${(error as Error).message}`);
    }
  }

  async createProjectConfig(
    name: string,
    options: Partial<ProjectConfig> = {},
    projectPath: string = process.cwd()
  ): Promise<ProjectConfig> {
    const globalConfig = await this.loadGlobalConfig();
    
    const config: ProjectConfig = {
      name,
      version: '1.0.0',
      ...DEFAULT_PROJECT_CONFIG,
      ...options
    } as ProjectConfig;

    // Apply global defaults
    config.packageManager = options.packageManager || globalConfig.packageManager;
    config.framework = options.framework || globalConfig.defaultFramework;
    config.template = options.template || globalConfig.defaultTemplate;

    await this.saveProjectConfig(config, projectPath);
    return config;
  }

  // Workspace configuration management
  async loadWorkspaceConfig(workspacePath: string): Promise<WorkspaceConfig | null> {
    const configPath = path.join(workspacePath, CONFIG_PATHS.WORKSPACE_DIR_CONFIG);
    
    try {
      if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf8');
        const config = yaml.parse(content) as WorkspaceConfig;
        this.validateWorkspaceConfig(config);
        return config;
      }
    } catch (error) {
      throw new ValidationError(`Failed to load workspace config: ${(error as Error).message}`);
    }

    return null;
  }

  async saveWorkspaceConfig(config: WorkspaceConfig, workspacePath: string): Promise<void> {
    try {
      const configDir = path.join(workspacePath, '.re-shell');
      const configPath = path.join(workspacePath, CONFIG_PATHS.WORKSPACE_DIR_CONFIG);
      
      await fs.ensureDir(configDir);
      this.validateWorkspaceConfig(config);
      const content = yaml.stringify(config);
      await fs.writeFile(configPath, content, 'utf8');
    } catch (error) {
      throw new ValidationError(`Failed to save workspace config: ${(error as Error).message}`);
    }
  }

  async createWorkspaceConfig(
    name: string, 
    type: 'app' | 'package' | 'lib' | 'tool',
    options: Partial<WorkspaceConfig> = {},
    workspacePath: string
  ): Promise<WorkspaceConfig> {
    const config: WorkspaceConfig = {
      name,
      type,
      ...options
    };

    await this.saveWorkspaceConfig(config, workspacePath);
    return config;
  }

  // Configuration merging with inheritance (global → project → workspace)
  async getMergedConfig(projectPath: string = process.cwd()): Promise<{
    global: GlobalConfig;
    project: ProjectConfig | null;
    merged: Partial<ProjectConfig>;
  }> {
    const globalConfig = await this.loadGlobalConfig();
    const projectConfig = await this.loadProjectConfig(projectPath);

    // Start with defaults
    let merged = { ...DEFAULT_PROJECT_CONFIG };

    // Apply global config inheritance
    if (globalConfig) {
      merged = {
        ...merged,
        packageManager: globalConfig.packageManager,
        framework: globalConfig.defaultFramework,
        template: globalConfig.defaultTemplate,
      };
    }

    // Apply project-specific config (overrides global)
    if (projectConfig) {
      merged = this.mergeConfig(merged, projectConfig);
    }

    return {
      global: globalConfig,
      project: projectConfig,
      merged: merged as Partial<ProjectConfig>
    };
  }

  // Enhanced configuration merging including workspace config
  async getMergedWorkspaceConfig(workspacePath: string, projectPath: string = process.cwd()): Promise<{
    global: GlobalConfig;
    project: ProjectConfig | null;
    workspace: WorkspaceConfig | null;
    merged: any;
  }> {
    const { global, project, merged } = await this.getMergedConfig(projectPath);
    const workspaceConfig = await this.loadWorkspaceConfig(workspacePath);

    const workspaceMerged = { ...merged };

    // Apply workspace-specific config (overrides project and global)
    if (workspaceConfig) {
      // Merge workspace settings into the result
      if (workspaceConfig.packageManager) workspaceMerged.packageManager = workspaceConfig.packageManager;
      if (workspaceConfig.framework) workspaceMerged.framework = workspaceConfig.framework;
      if (workspaceConfig.template) workspaceMerged.template = workspaceConfig.template;
      
      // Deep merge complex objects
      if (workspaceConfig.build) {
        workspaceMerged.build = this.mergeConfig(workspaceMerged.build || {}, workspaceConfig.build);
      }
      if (workspaceConfig.dev) {
        workspaceMerged.dev = this.mergeConfig(workspaceMerged.dev || {}, workspaceConfig.dev);
      }
      if (workspaceConfig.quality) {
        workspaceMerged.quality = this.mergeConfig(workspaceMerged.quality || {}, workspaceConfig.quality);
      }
    }

    return {
      global,
      project,
      workspace: workspaceConfig,
      merged: workspaceMerged
    };
  }

  // Preset management
  async savePreset(name: string, config: Partial<ProjectConfig>): Promise<void> {
    const globalConfig = await this.loadGlobalConfig();
    
    const preset: ProjectPreset = {
      name,
      description: `Preset for ${name}`,
      config,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    globalConfig.presets[name] = preset;
    await this.saveGlobalConfig(globalConfig);
  }

  async loadPreset(name: string): Promise<ProjectPreset | null> {
    const globalConfig = await this.loadGlobalConfig();
    return globalConfig.presets[name] || null;
  }

  async listPresets(): Promise<ProjectPreset[]> {
    const globalConfig = await this.loadGlobalConfig();
    return Object.values(globalConfig.presets);
  }

  async deletePreset(name: string): Promise<void> {
    const globalConfig = await this.loadGlobalConfig();
    delete globalConfig.presets[name];
    await this.saveGlobalConfig(globalConfig);
  }

  // Configuration migration
  async migrateConfig(fromVersion: string, toVersion: string): Promise<void> {
    // Implementation for config migrations between versions
    // This will be expanded as the config schema evolves
    console.log(`Migrating config from ${fromVersion} to ${toVersion}`);
  }

  // Validation methods
  private validateGlobalConfig(config: any): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { validateGlobalConfig } = require('./validation');
    const result = validateGlobalConfig(config);
    
    if (!result.valid) {
      const errorMessages = result.errors
        .filter((e: any) => e.severity === 'error')
        .map((e: any) => `${e.field}: ${e.message}`)
        .join('; ');
      throw new ValidationError(`Global configuration validation failed: ${errorMessages}`);
    }
  }

  private validateProjectConfig(config: any): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { validateProjectConfig } = require('./validation');
    const result = validateProjectConfig(config);
    
    if (!result.valid) {
      const errorMessages = result.errors
        .filter((e: any) => e.severity === 'error')
        .map((e: any) => `${e.field}: ${e.message}`)
        .join('; ');
      throw new ValidationError(`Project configuration validation failed: ${errorMessages}`);
    }
  }

  private validateWorkspaceConfig(config: any): void {
    // Basic workspace config validation
    if (!config.name || typeof config.name !== 'string') {
      throw new ValidationError('Workspace configuration must have a valid name');
    }
    
    if (!config.type || !['app', 'package', 'lib', 'tool'].includes(config.type)) {
      throw new ValidationError('Workspace configuration must have a valid type: app, package, lib, or tool');
    }
    
    if (config.packageManager && !['npm', 'yarn', 'pnpm', 'bun'].includes(config.packageManager)) {
      throw new ValidationError('Invalid package manager specified in workspace configuration');
    }
  }

  private validateSchema(obj: any, schema: any, context: string): void {
    // Basic schema validation - can be expanded with a proper validation library
    for (const [key, type] of Object.entries(schema)) {
      if (typeof type === 'string') {
        const isOptional = type.endsWith('?');
        const expectedType = isOptional ? type.slice(0, -1) : type;
        
        if (!isOptional && !(key in obj)) {
          throw new ValidationError(`${context}: Missing required field '${key}'`);
        }
        
        if (key in obj && typeof obj[key] !== expectedType) {
          throw new ValidationError(`${context}: Field '${key}' must be of type ${expectedType}`);
        }
      } else if (type === 'array') {
        if (key in obj && !Array.isArray(obj[key])) {
          throw new ValidationError(`${context}: Field '${key}' must be of type array`);
        }
      } else if (Array.isArray(type)) {
        if (key in obj && !type.includes(obj[key])) {
          throw new ValidationError(`${context}: Field '${key}' must be one of: ${type.join(', ')}`);
        }
      } else if (typeof type === 'object') {
        if (key in obj) {
          this.validateSchema(obj[key], type, `${context}.${key}`);
        }
      }
    }
  }

  // Deep merge utility
  private mergeConfig(base: any, override: any): any {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfig(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  // Configuration backup and restore
  async backupConfig(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(CONFIG_PATHS.GLOBAL_DIR, 'backups');
    const backupPath = path.join(backupDir, `config-backup-${timestamp}.yaml`);
    
    await fs.ensureDir(backupDir);
    
    const globalConfig = await this.loadGlobalConfig();
    const content = yaml.stringify(globalConfig);
    await fs.writeFile(backupPath, content, 'utf8');
    
    return backupPath;
  }

  async restoreConfig(backupPath: string): Promise<void> {
    if (!await fs.pathExists(backupPath)) {
      throw new ValidationError(`Backup file not found: ${backupPath}`);
    }
    
    const content = await fs.readFile(backupPath, 'utf8');
    const config = yaml.parse(content) as GlobalConfig;
    await this.saveGlobalConfig(config);
  }
}

// Export singleton instance
export const configManager = new ConfigManager();

// Helper functions for easy access
export async function getGlobalConfig(): Promise<GlobalConfig> {
  return configManager.loadGlobalConfig();
}

export async function getProjectConfig(projectPath?: string): Promise<ProjectConfig | null> {
  return configManager.loadProjectConfig(projectPath);
}

export async function getMergedConfig(projectPath?: string) {
  return configManager.getMergedConfig(projectPath);
}

export async function initializeGlobalConfig(): Promise<GlobalConfig> {
  const configDir = CONFIG_PATHS.GLOBAL_DIR;
  
  // Ensure directories exist
  await fs.ensureDir(configDir);
  await fs.ensureDir(path.join(configDir, 'templates'));
  await fs.ensureDir(path.join(configDir, 'cache'));
  await fs.ensureDir(path.join(configDir, 'plugins'));
  await fs.ensureDir(path.join(configDir, 'backups'));
  
  return configManager.loadGlobalConfig();
}