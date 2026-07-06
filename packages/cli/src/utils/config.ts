import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { ValidationError } from './error-handler';

// Configuration schema definitions

/**
 * Represents the global configuration stored in the user's home directory.
 *
 * Holds CLI-wide preferences such as the default package manager, framework,
 * template, user information, plugin settings, and filesystem paths used by
 * re-shell across all projects.
 */
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

/**
 * Represents the configuration for a single re-shell project.
 *
 * Contains project-level settings including type, package manager, framework,
 * template, environment definitions, workspace layout, git options, build
 * configuration, dev server options, and quality tooling settings.
 */
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

/**
 * Represents the configuration for a specific deployment environment.
 *
 * Defines environment variables, build settings (mode, optimization,
 * sourcemaps), and deployment provider details for environments such as
 * development, staging, and production.
 */
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
    config?: Record<string, unknown>;
    secrets?: string[];
    hooks?: {
      preDeploy?: string[];
      postDeploy?: string[];
    };
  };
}

/**
 * Represents the configuration for an individual workspace within a monorepo.
 *
 * Describes a single workspace's type (app, package, lib, or tool), its
 * framework and template, dependencies, build and dev server settings,
 * quality tooling, and deployment configuration.
 */
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
    config?: Record<string, unknown>;
  };
  environment?: Record<string, unknown>;
}

/**
 * Represents a reusable project configuration preset.
 *
 * Stores a named, partial project configuration along with a description,
 * tags, and timestamps so users can quickly bootstrap new projects from a
 * predefined set of options.
 */
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

/**
 * The default global configuration applied when no global config file exists.
 *
 * Uses pnpm as the package manager, react-ts as the framework, and stores
 * templates, cache, and plugins under the `.re-shell` directory in the
 * user's home folder.
 */
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

/**
 * The default project configuration values used as a base for new projects.
 *
 * Provides sensible defaults for project type, package manager, framework,
 * environments (development, staging, production), workspace patterns, git
 * settings, build targets, dev server, and quality tooling thresholds.
 */
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

/**
 * Standard filesystem paths used by re-shell to locate configuration files.
 *
 * Includes the global configuration directory, the global config file path,
 * and the relative paths for project-level and workspace-level config files.
 */
export const CONFIG_PATHS = {
  GLOBAL_DIR: path.join(os.homedir(), '.re-shell'),
  GLOBAL_CONFIG: path.join(os.homedir(), '.re-shell', 'config.yaml'),
  PROJECT_CONFIG: '.re-shell/config.yaml',
  WORKSPACE_CONFIG: 're-shell.workspaces.yaml',
  WORKSPACE_DIR_CONFIG: '.re-shell/workspace.yaml'
};

// Configuration manager class

/**
 * Manages loading, saving, merging, validating, and migrating re-shell
 * configuration across global, project, and workspace scopes.
 *
 * The manager caches loaded global and project configuration in memory and
 * provides methods for preset management, configuration backup and restore,
 * and deep merging of hierarchical configuration layers.
 */
export class ConfigManager {
  private globalConfig: GlobalConfig | null = null;
  private projectConfig: ProjectConfig | null = null;

  // Global configuration management

  /**
   * Loads the global configuration from disk, creating a default config file
   * if one does not already exist.
   *
   * The loaded config is cached in memory so subsequent calls return the
   * cached value without re-reading from disk.
   *
   * @returns A promise that resolves to the loaded {@link GlobalConfig}.
   * @throws {ValidationError} If the config file exists but cannot be read or
   *   parsed, or if validation fails.
   */
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

  /**
   * Persists the given global configuration to disk after validating it.
   *
   * Ensures the global config directory exists, validates the config, writes
   * it as YAML, and updates the in-memory cache.
   *
   * @param config - The global configuration to save.
   * @returns A promise that resolves when the configuration has been written.
   * @throws {ValidationError} If the directory cannot be created, validation
   *   fails, or the file cannot be written.
   */
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

  /**
   * Deep-merges partial updates into the current global configuration and
   * persists the result.
   *
   * @param updates - A partial global configuration whose values override the
   *   existing configuration.
   * @returns A promise that resolves to the updated {@link GlobalConfig}.
   * @throws {ValidationError} If loading or saving the configuration fails.
   */
  async updateGlobalConfig(updates: Partial<GlobalConfig>): Promise<GlobalConfig> {
    const config = await this.loadGlobalConfig();
    const updatedConfig = this.mergeConfig(config, updates) as GlobalConfig;
    await this.saveGlobalConfig(updatedConfig);
    return updatedConfig;
  }

  // Project configuration management

  /**
   * Loads the project configuration from the `.re-shell/config.yaml` file
   * within the given project path.
   *
   * @param projectPath - The root directory of the project. Defaults to the
   *   current working directory.
   * @returns A promise that resolves to the loaded {@link ProjectConfig}, or
   *   `null` if no project config file exists.
   * @throws {ValidationError} If the config file exists but cannot be read or
   *   parsed, or if validation fails.
   */
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

  /**
   * Persists the given project configuration to the
   * `.re-shell/config.yaml` file within the given project path.
   *
   * Ensures the `.re-shell` directory exists, validates the config, writes it
   * as YAML, and updates the in-memory project config cache.
   *
   * @param config - The project configuration to save.
   * @param projectPath - The root directory of the project. Defaults to the
   *   current working directory.
   * @returns A promise that resolves when the configuration has been written.
   * @throws {ValidationError} If the directory cannot be created, validation
   *   fails, or the file cannot be written.
   */
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

  /**
   * Creates a new project configuration file from defaults, global settings,
   * and the provided options.
   *
   * Merges {@link DEFAULT_PROJECT_CONFIG} with the supplied options, applies
   * global defaults for package manager, framework, and template when not
   * explicitly provided, then persists the result.
   *
   * @param name - The name of the project.
   * @param options - Optional partial project configuration to override defaults.
   * @param projectPath - The root directory where the config will be written.
   *   Defaults to the current working directory.
   * @returns A promise that resolves to the newly created {@link ProjectConfig}.
   * @throws {ValidationError} If saving the configuration fails.
   */
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

  /**
   * Loads the workspace configuration from the `.re-shell/workspace.yaml`
   * file within the given workspace path.
   *
   * @param workspacePath - The root directory of the workspace.
   * @returns A promise that resolves to the loaded {@link WorkspaceConfig},
   *   or `null` if no workspace config file exists.
   * @throws {ValidationError} If the config file exists but cannot be read or
   *   parsed, or if validation fails.
   */
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

  /**
   * Persists the given workspace configuration to the
   * `.re-shell/workspace.yaml` file within the given workspace path.
   *
   * Ensures the `.re-shell` directory exists, validates the config, and
   * writes it as YAML.
   *
   * @param config - The workspace configuration to save.
   * @param workspacePath - The root directory of the workspace.
   * @returns A promise that resolves when the configuration has been written.
   * @throws {ValidationError} If the directory cannot be created, validation
   *   fails, or the file cannot be written.
   */
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

  /**
   * Creates a new workspace configuration file from the provided name, type,
   * and options.
   *
   * @param name - The name of the workspace.
   * @param type - The workspace type (app, package, lib, or tool).
   * @param options - Optional partial workspace configuration to override defaults.
   * @param workspacePath - The root directory where the config will be written.
   * @returns A promise that resolves to the newly created {@link WorkspaceConfig}.
   * @throws {ValidationError} If saving the configuration fails.
   */
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

  // Configuration merging with inheritance (global, then project, then workspace)

  /**
   * Computes the merged project configuration by layering global settings on
   * top of the default project config, then applying project-specific overrides.
   *
   * @param projectPath - The root directory of the project. Defaults to the
   *   current working directory.
   * @returns A promise that resolves to an object containing the global config,
   *   the project config (or null), and the deeply merged result.
   * @throws {ValidationError} If loading or validating configuration fails.
   */
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

  /**
   * Computes the fully merged configuration across global, project, and
   * workspace scopes.
   *
   * Builds on {@link getMergedConfig} and then applies workspace-specific
   * overrides for package manager, framework, template, and deep-merges build,
   * dev, and quality settings.
   *
   * @param workspacePath - The root directory of the workspace.
   * @param projectPath - The root directory of the project. Defaults to the
   *   current working directory.
   * @returns A promise that resolves to an object containing the global config,
   *   project config, workspace config, and the fully merged result.
   * @throws {ValidationError} If loading or validating configuration fails.
   */
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

  /**
   * Saves a reusable project configuration preset to the global configuration.
   *
   * Creates a {@link ProjectPreset} with the given name and partial project
   * config, then persists it within the global config's presets map.
   *
   * @param name - The unique name of the preset.
   * @param config - The partial project configuration to store in the preset.
   * @returns A promise that resolves when the preset has been saved.
   * @throws {ValidationError} If loading or saving the global configuration fails.
   */
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

  /**
   * Loads a previously saved project preset by name from the global
   * configuration.
   *
   * @param name - The name of the preset to load.
   * @returns A promise that resolves to the matching {@link ProjectPreset}, or
   *   `null` if no preset with the given name exists.
   * @throws {ValidationError} If loading the global configuration fails.
   */
  async loadPreset(name: string): Promise<ProjectPreset | null> {
    const globalConfig = await this.loadGlobalConfig();
    return globalConfig.presets[name] || null;
  }

  /**
   * Lists all saved project presets from the global configuration.
   *
   * @returns A promise that resolves to an array of all stored
   *   {@link ProjectPreset} values.
   * @throws {ValidationError} If loading the global configuration fails.
   */
  async listPresets(): Promise<ProjectPreset[]> {
    const globalConfig = await this.loadGlobalConfig();
    return Object.values(globalConfig.presets);
  }

  /**
   * Deletes a project preset by name from the global configuration.
   *
   * @param name - The name of the preset to delete.
   * @returns A promise that resolves when the preset has been removed.
   * @throws {ValidationError} If loading or saving the global configuration fails.
   */
  async deletePreset(name: string): Promise<void> {
    const globalConfig = await this.loadGlobalConfig();
    delete globalConfig.presets[name];
    await this.saveGlobalConfig(globalConfig);
  }

  // Configuration migration

  /**
   * Migrates the configuration schema from one version to another.
   *
   * Currently logs the migration request; this method will be expanded as the
   * configuration schema evolves between releases.
   *
   * @param fromVersion - The semantic version of the current config schema.
   * @param toVersion - The semantic version of the target config schema.
   * @returns A promise that resolves when the migration is complete.
   */
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

  /**
   * Creates a timestamped backup of the current global configuration.
   *
   * Writes a YAML copy of the global config to the `backups` subdirectory of
   * the global config directory.
   *
   * @returns A promise that resolves to the filesystem path of the created
   *   backup file.
   * @throws {ValidationError} If the backup directory cannot be created or the
   *   file cannot be written.
   */
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

  /**
   * Restores the global configuration from a previously created backup file.
   *
   * Reads, parses, and validates the backup YAML, then persists it as the new
   * global configuration.
   *
   * @param backupPath - The filesystem path of the backup file to restore from.
   * @returns A promise that resolves when the configuration has been restored.
   * @throws {ValidationError} If the backup file does not exist or cannot be
   *   read, or if saving the restored configuration fails.
   */
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

/**
 * Shared singleton instance of {@link ConfigManager} used throughout the CLI
 * for consistent configuration access.
 */
export const configManager = new ConfigManager();

// Helper functions for easy access

/**
 * Convenience helper that loads and returns the global configuration via the
 * shared {@link configManager} singleton.
 *
 * @returns A promise that resolves to the loaded {@link GlobalConfig}.
 * @throws {ValidationError} If the global configuration cannot be loaded.
 */
export async function getGlobalConfig(): Promise<GlobalConfig> {
  return configManager.loadGlobalConfig();
}

/**
 * Convenience helper that loads and returns the project configuration for the
 * given path via the shared {@link configManager} singleton.
 *
 * @param projectPath - Optional root directory of the project. Defaults to the
 *   current working directory when omitted.
 * @returns A promise that resolves to the loaded {@link ProjectConfig}, or
 *   `null` if no project config exists.
 * @throws {ValidationError} If the project configuration cannot be loaded.
 */
export async function getProjectConfig(projectPath?: string): Promise<ProjectConfig | null> {
  return configManager.loadProjectConfig(projectPath);
}

/**
 * Convenience helper that computes the merged project configuration (defaults,
 * global, and project overrides) via the shared {@link configManager}
 * singleton.
 *
 * @param projectPath - Optional root directory of the project. Defaults to the
 *   current working directory when omitted.
 * @returns A promise that resolves to the merged configuration result object
 *   containing global, project, and merged fields.
 * @throws {ValidationError} If configuration loading or validation fails.
 */
export async function getMergedConfig(projectPath?: string) {
  return configManager.getMergedConfig(projectPath);
}

/**
 * Initializes the global re-shell configuration directory structure and loads
 * (or creates) the global configuration.
 *
 * Ensures the templates, cache, plugins, and backups subdirectories exist
 * under the global config directory before loading the configuration.
 *
 * @returns A promise that resolves to the loaded {@link GlobalConfig}.
 * @throws {ValidationError} If the directories cannot be created or the
 *   configuration cannot be loaded.
 */
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