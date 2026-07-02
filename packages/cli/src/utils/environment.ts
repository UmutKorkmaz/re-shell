/**
 * @file Environment management utilities for the Re-Shell CLI.
 * @description Provides interfaces, a manager class, and helper functions for
 * creating, loading, comparing, and switching between project environment
 * profiles (development, staging, production, etc.) including their variables,
 * build, and deployment configurations.
 */

import * as fs from 'fs-extra';
import * as path from 'path';

import { configManager, EnvironmentConfig } from './config';
import { ValidationError } from './error-handler';

/**
 * Represents a full environment profile, extending the base environment config
 * with runtime metadata such as activation state and inheritance.
 */
export interface EnvironmentProfile extends EnvironmentConfig {
  /** Optional name of a parent environment to inherit configuration from. */
  extends?: string; // For inheritance
  /** Whether this environment is currently the active one. */
  active: boolean;
  /** ISO timestamp of when the environment was last used. */
  lastUsed?: string;
}

/**
 * A map of environment variable names to their primitive values.
 */
export interface EnvironmentVariables {
  /** Key-value pairs where values can be a string, number, or boolean. */
  [key: string]: string | number | boolean;
}

/**
 * Build configuration options for an environment.
 */
export interface BuildConfiguration {
  /** The build mode determining optimization and output characteristics. */
  mode: 'development' | 'staging' | 'production';
  /** Whether build optimizations (e.g. tree-shaking) are enabled. */
  optimization: boolean;
  /** Whether source maps are generated. */
  sourcemaps: boolean;
  /** Whether the output should be minified. */
  minify?: boolean;
  /** Whether bundle analysis is enabled. */
  analyze?: boolean;
  /** The JavaScript/TypeScript compilation target (e.g. 'es2020'). */
  target?: string;
  /** List of modules to treat as externals (not bundled). */
  externals?: string[];
  /** Static values to replace at build time (e.g. process.env). */
  define?: Record<string, string>;
}

/**
 * Deployment configuration options for an environment.
 */
export interface DeploymentConfiguration {
  /** The deployment provider to use. */
  provider?: 'vercel' | 'netlify' | 'aws' | 'azure' | 'gcp' | 'docker' | 'custom';
  /** The deployment target name or identifier. */
  target?: string;
  /** The cloud region to deploy into. */
  region?: string;
  /** The custom domain to associate with the deployment. */
  domain?: string;
  /** Provider-specific configuration options. */
  config?: Record<string, unknown>;
  /** Names of secrets to inject during deployment. */
  secrets?: string[];
  /** Optional pre-deploy and post-deploy hook commands. */
  hooks?: {
    /** Commands to run before deployment. */
    preDeploy?: string[];
    /** Commands to run after deployment. */
    postDeploy?: string[];
  };
}

/**
 * Manages environment profiles for a Re-Shell project, including loading,
 * creating, updating, deleting, comparing, and activating environments.
 */
export class EnvironmentManager {
  private projectPath: string;
  private environments: Map<string, EnvironmentProfile> = new Map();

  /**
   * @param projectPath The absolute path to the project root. Defaults to the current working directory.
   */
  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

  /**
   * @description Loads environment profiles from the project configuration,
   * creating a default project config if none exists and default environments
   * if none are defined.
   * @returns A map of environment names to their profiles.
   */
  // Load environments from project config
  async loadEnvironments(): Promise<Map<string, EnvironmentProfile>> {
    let projectConfig = await configManager.loadProjectConfig(this.projectPath);
    
    if (!projectConfig) {
      // Create a basic project config if none exists
      projectConfig = await configManager.createProjectConfig(
        path.basename(this.projectPath),
        {},
        this.projectPath
      );
    }
    
    if (!projectConfig?.environments) {
      // Create default environments if none exist
      await this.createDefaultEnvironments();
      return this.loadEnvironments();
    }

    this.environments.clear();
    
    for (const [name, env] of Object.entries(projectConfig.environments)) {
      this.environments.set(name, {
        ...env,
        active: false,
        lastUsed: undefined
      });
    }

    return this.environments;
  }

  /**
   * @description Creates the default development, staging, and production
   * environment profiles and persists them to the project configuration.
   * @returns Resolves when the default environments have been saved.
   */
  // Create default environment profiles
  async createDefaultEnvironments(): Promise<void> {
    const defaultEnvironments: Record<string, EnvironmentConfig> = {
      development: {
        name: 'development',
        variables: {
          NODE_ENV: 'development',
          DEBUG: 'true',
          API_URL: 'http://localhost:8080',
          DATABASE_URL: 'sqlite://./dev.db'
        },
        build: {
          mode: 'development',
          optimization: false,
          sourcemaps: true,
          minify: false,
          analyze: false,
          target: 'es2020'
        },
        deployment: {
          provider: 'docker',
          target: 'local',
          config: {
            ports: ['3000:3000'],
            volumes: ['./:/app'],
            environment: 'development'
          }
        }
      },
      staging: {
        name: 'staging',
        variables: {
          NODE_ENV: 'staging',
          DEBUG: 'false',
          API_URL: 'https://api-staging.example.com',
          DATABASE_URL: 'postgresql://staging-db'
        },
        build: {
          mode: 'staging',
          optimization: true,
          sourcemaps: true,
          minify: true,
          analyze: true,
          target: 'es2020'
        },
        deployment: {
          provider: 'vercel',
          target: 'staging',
          region: 'us-east-1',
          config: {
            functions: {
              'api/**': {
                runtime: 'nodejs18.x',
                memory: 1024
              }
            }
          }
        }
      },
      production: {
        name: 'production',
        variables: {
          NODE_ENV: 'production',
          DEBUG: 'false',
          API_URL: 'https://api.example.com',
          DATABASE_URL: 'postgresql://prod-db'
        },
        build: {
          mode: 'production',
          optimization: true,
          sourcemaps: false,
          minify: true,
          analyze: false,
          target: 'es2020',
          externals: ['react', 'react-dom']
        },
        deployment: {
          provider: 'aws',
          target: 'production',
          region: 'us-east-1',
          config: {
            cloudformation: true,
            lambda: {
              runtime: 'nodejs18.x',
              memory: 2048,
              timeout: 30
            },
            s3: {
              bucket: 'my-app-assets',
              cloudfront: true
            }
          },
          hooks: {
            preDeploy: ['npm run test', 'npm run lint'],
            postDeploy: ['npm run smoke-test']
          }
        }
      }
    };

    // Update project config with default environments
    const projectConfig = await configManager.loadProjectConfig(this.projectPath);
    if (!projectConfig) {
      throw new ValidationError('No project configuration found. Initialize a project first.');
    }

    projectConfig.environments = defaultEnvironments;
    await configManager.saveProjectConfig(projectConfig, this.projectPath);
  }

  /**
   * @description Retrieves a specific environment profile by name.
   * @param name The name of the environment to retrieve.
   * @returns The matching environment profile, or null if not found.
   */
  // Get specific environment
  async getEnvironment(name: string): Promise<EnvironmentProfile | null> {
    await this.loadEnvironments();
    return this.environments.get(name) || null;
  }

  /**
   * @description Returns the currently active environment profile, defaulting
   * to the development environment if none is explicitly active.
   * @returns The active environment profile, or null if none exist.
   */
  // Get active environment
  async getActiveEnvironment(): Promise<EnvironmentProfile | null> {
    await this.loadEnvironments();
    
    for (const env of this.environments.values()) {
      if (env.active) {
        return env;
      }
    }
    
    // Default to development if none active
    const devEnv = this.environments.get('development');
    if (devEnv) {
      await this.setActiveEnvironment('development');
      return devEnv;
    }
    
    return null;
  }

  /**
   * @description Sets the specified environment as the active one,
   * deactivating all others, and persists the change.
   * @param name The name of the environment to activate.
   * @returns Resolves when the active environment has been updated and saved.
   */
  // Set active environment
  async setActiveEnvironment(name: string): Promise<void> {
    await this.loadEnvironments();
    
    if (!this.environments.has(name)) {
      throw new ValidationError(`Environment '${name}' not found`);
    }

    // Deactivate all environments
    for (const env of this.environments.values()) {
      env.active = false;
    }

    // Activate the specified environment
    const targetEnv = this.environments.get(name)!;
    targetEnv.active = true;
    targetEnv.lastUsed = new Date().toISOString();

    await this.saveEnvironments();
  }

  /**
   * @description Creates a new environment profile, optionally inheriting
   * configuration from an existing parent environment, and persists it.
   * @param name The unique name for the new environment.
   * @param config Partial environment configuration to apply.
   * @param extendsEnv Optional name of a parent environment to inherit from.
   * @returns Resolves when the new environment has been created and saved.
   */
  // Create new environment
  async createEnvironment(name: string, config: Partial<EnvironmentConfig>, extendsEnv?: string): Promise<void> {
    await this.loadEnvironments();
    
    if (this.environments.has(name)) {
      throw new ValidationError(`Environment '${name}' already exists`);
    }

    let baseConfig: EnvironmentConfig = {
      name,
      variables: {},
      build: {
        mode: 'development',
        optimization: false,
        sourcemaps: true
      },
      deployment: {}
    };

    // Inherit from existing environment if specified
    if (extendsEnv) {
      const parentEnv = this.environments.get(extendsEnv);
      if (!parentEnv) {
        throw new ValidationError(`Parent environment '${extendsEnv}' not found`);
      }
      baseConfig = this.mergeEnvironmentConfig(baseConfig, parentEnv);
    }

    // Apply provided config
    const finalConfig = this.mergeEnvironmentConfig(baseConfig, config);
    
    const profile: EnvironmentProfile = {
      ...finalConfig,
      extends: extendsEnv,
      active: false
    };

    this.environments.set(name, profile);
    await this.saveEnvironments();
  }

  /**
   * @description Updates an existing environment profile by merging the
   * provided configuration into the current one, then persists the change.
   * @param name The name of the environment to update.
   * @param config Partial environment configuration with fields to override.
   * @returns Resolves when the environment has been updated and saved.
   */
  // Update environment
  async updateEnvironment(name: string, config: Partial<EnvironmentConfig>): Promise<void> {
    await this.loadEnvironments();
    
    const env = this.environments.get(name);
    if (!env) {
      throw new ValidationError(`Environment '${name}' not found`);
    }

    const updatedEnv = this.mergeEnvironmentConfig(env, config);
    this.environments.set(name, { ...updatedEnv, active: env.active, extends: env.extends });
    
    await this.saveEnvironments();
  }

  /**
   * @description Deletes an environment profile. Default environments
   * (development, staging, production) cannot be deleted.
   * @param name The name of the environment to delete.
   * @returns Resolves when the environment has been deleted and saved.
   */
  // Delete environment
  async deleteEnvironment(name: string): Promise<void> {
    await this.loadEnvironments();
    
    if (!this.environments.has(name)) {
      throw new ValidationError(`Environment '${name}' not found`);
    }

    // Prevent deletion of default environments
    if (['development', 'staging', 'production'].includes(name)) {
      throw new ValidationError(`Cannot delete default environment '${name}'`);
    }

    this.environments.delete(name);
    await this.saveEnvironments();
  }

  /**
   * @description Lists all environment profiles in the project.
   * @returns An array of all environment profiles.
   */
  // List all environments
  async listEnvironments(): Promise<EnvironmentProfile[]> {
    await this.loadEnvironments();
    return Array.from(this.environments.values());
  }

  /**
   * @description Retrieves the environment variables for a specific
   * environment, or the active environment if no name is provided.
   * @param environmentName Optional name of the environment. Defaults to the active environment.
   * @returns The environment variables map.
   */
  // Get environment variables for current environment
  async getEnvironmentVariables(environmentName?: string): Promise<EnvironmentVariables> {
    const env = environmentName 
      ? await this.getEnvironment(environmentName)
      : await this.getActiveEnvironment();
    
    if (!env) {
      throw new ValidationError('No environment found');
    }

    return env.variables;
  }

  /**
   * @description Retrieves the build configuration for a specific
   * environment, or the active environment if no name is provided.
   * @param environmentName Optional name of the environment. Defaults to the active environment.
   * @returns The build configuration.
   */
  // Get build configuration for current environment
  async getBuildConfiguration(environmentName?: string): Promise<BuildConfiguration> {
    const env = environmentName 
      ? await this.getEnvironment(environmentName)
      : await this.getActiveEnvironment();
    
    if (!env) {
      throw new ValidationError('No environment found');
    }

    return env.build;
  }

  /**
   * @description Retrieves the deployment configuration for a specific
   * environment, or the active environment if no name is provided.
   * @param environmentName Optional name of the environment. Defaults to the active environment.
   * @returns The deployment configuration.
   */
  // Get deployment configuration for current environment
  async getDeploymentConfiguration(environmentName?: string): Promise<DeploymentConfiguration> {
    const env = environmentName 
      ? await this.getEnvironment(environmentName)
      : await this.getActiveEnvironment();
    
    if (!env) {
      throw new ValidationError('No environment found');
    }

    return env.deployment;
  }

  /**
   * @description Generates a `.env` file from the variables of the specified
   * or active environment and writes it to disk.
   * @param environmentName Optional name of the environment. Defaults to the active environment.
   * @param outputPath Optional file path for the generated `.env` file. Defaults to `<projectPath>/.env`.
   * @returns The file path where the `.env` file was written.
   */
  // Generate .env file for environment
  async generateEnvFile(environmentName?: string, outputPath?: string): Promise<string> {
    const variables = await this.getEnvironmentVariables(environmentName);
    
    let content = '# Generated by Re-Shell CLI\n';
    content += `# Environment: ${environmentName || 'active'}\n`;
    content += `# Generated at: ${new Date().toISOString()}\n\n`;
    
    for (const [key, value] of Object.entries(variables)) {
      // Escape values with quotes if they contain spaces or special characters
      const stringValue = String(value);
      const needsQuotes = /[\s"'`$\\]/.test(stringValue);
      const escapedValue = needsQuotes ? `"${stringValue.replace(/"/g, '\\"')}"` : stringValue;
      content += `${key}=${escapedValue}\n`;
    }

    const filePath = outputPath || path.join(this.projectPath, '.env');
    await fs.writeFile(filePath, content, 'utf8');
    
    return filePath;
  }

  /**
   * @description Compares two environments and returns the differences in
   * their variables, build, and deployment configurations.
   * @param env1 The name of the first environment to compare.
   * @param env2 The name of the second environment to compare.
   * @returns An object containing added/removed/changed variables and per-field build/deployment diffs.
   */
  // Compare environments
  async compareEnvironments(env1: string, env2: string): Promise<{
    variables: { added: string[]; removed: string[]; changed: Array<{key: string; from: any; to: any}> };
    build: Record<string, { from: unknown; to: unknown }>;
    deployment: Record<string, { from: unknown; to: unknown }>;
  }> {
    const environment1 = await this.getEnvironment(env1);
    const environment2 = await this.getEnvironment(env2);
    
    if (!environment1 || !environment2) {
      throw new ValidationError('One or both environments not found');
    }

    return {
      variables: this.compareObjects(environment1.variables, environment2.variables),
      build: this.diffObjects(environment1.build, environment2.build),
      deployment: this.diffObjects(environment1.deployment, environment2.deployment)
    };
  }

  // Private helper methods
  private async saveEnvironments(): Promise<void> {
    const projectConfig = await configManager.loadProjectConfig(this.projectPath);
    if (!projectConfig) {
      throw new ValidationError('No project configuration found');
    }

    // Convert environments map to object for storage
    const environmentsObj: Record<string, EnvironmentConfig> = {};
    for (const [name, env] of this.environments) {
      environmentsObj[name] = {
        name: env.name,
        variables: env.variables,
        build: env.build,
        deployment: env.deployment
      };
    }

    projectConfig.environments = environmentsObj;
    await configManager.saveProjectConfig(projectConfig, this.projectPath);
  }

  private mergeEnvironmentConfig(base: EnvironmentConfig, override: Partial<EnvironmentConfig>): EnvironmentConfig {
    return {
      name: override.name || base.name,
      variables: { ...base.variables, ...override.variables },
      build: { ...base.build, ...override.build },
      deployment: { ...base.deployment, ...override.deployment }
    };
  }

  private compareObjects(obj1: any, obj2: any): { added: string[]; removed: string[]; changed: Array<{key: string; from: any; to: any}> } {
    const keys1 = new Set(Object.keys(obj1));
    const keys2 = new Set(Object.keys(obj2));
    
    const added = Array.from(keys2).filter(key => !keys1.has(key));
    const removed = Array.from(keys1).filter(key => !keys2.has(key));
    const changed: Array<{key: string; from: any; to: any}> = [];
    
    for (const key of keys1) {
      if (keys2.has(key) && obj1[key] !== obj2[key]) {
        changed.push({ key, from: obj1[key], to: obj2[key] });
      }
    }
    
    return { added, removed, changed };
  }

  private diffObjects(obj1: any, obj2: any): Record<string, { from: unknown; to: unknown }> {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    for (const key of allKeys) {
      if (obj1[key] !== obj2[key]) {
        diff[key] = { from: obj1[key], to: obj2[key] };
      }
    }
    
    return diff;
  }
}

/** Singleton instance of {@link EnvironmentManager} for the current working directory. */
// Export singleton instance
export const environmentManager = new EnvironmentManager();

/**
 * @description Retrieves the currently active environment profile via the singleton manager.
 * @returns The active environment profile, or null if none exist.
 */
// Helper functions
export async function getActiveEnvironment(): Promise<EnvironmentProfile | null> {
  return environmentManager.getActiveEnvironment();
}

/**
 * @description Sets the active environment via the singleton manager.
 * @param name The name of the environment to activate.
 * @returns Resolves when the active environment has been updated and saved.
 */
export async function setActiveEnvironment(name: string): Promise<void> {
  return environmentManager.setActiveEnvironment(name);
}

/**
 * @description Retrieves environment variables via the singleton manager.
 * @param environmentName Optional name of the environment. Defaults to the active environment.
 * @returns The environment variables map.
 */
export async function getEnvironmentVariables(environmentName?: string): Promise<EnvironmentVariables> {
  return environmentManager.getEnvironmentVariables(environmentName);
}

/**
 * @description Retrieves the build configuration via the singleton manager.
 * @param environmentName Optional name of the environment. Defaults to the active environment.
 * @returns The build configuration.
 */
export async function getBuildConfiguration(environmentName?: string): Promise<BuildConfiguration> {
  return environmentManager.getBuildConfiguration(environmentName);
}

/**
 * @description Generates a `.env` file via the singleton manager.
 * @param environmentName Optional name of the environment. Defaults to the active environment.
 * @param outputPath Optional file path for the generated `.env` file.
 * @returns The file path where the `.env` file was written.
 */
export async function generateEnvFile(environmentName?: string, outputPath?: string): Promise<string> {
  return environmentManager.generateEnvFile(environmentName, outputPath);
}