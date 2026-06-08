import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { configManager, ProjectConfig, EnvironmentConfig } from './config';
import { ValidationError } from './error-handler';

// Environment management utilities
export interface EnvironmentProfile extends EnvironmentConfig {
  extends?: string; // For inheritance
  active: boolean;
  lastUsed?: string;
}

export interface EnvironmentVariables {
  [key: string]: string | number | boolean;
}

export interface BuildConfiguration {
  mode: 'development' | 'staging' | 'production';
  optimization: boolean;
  sourcemaps: boolean;
  minify?: boolean;
  analyze?: boolean;
  target?: string;
  externals?: string[];
  define?: Record<string, string>;
}

export interface DeploymentConfiguration {
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
}

// Environment manager class
export class EnvironmentManager {
  private projectPath: string;
  private environments: Map<string, EnvironmentProfile> = new Map();

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }

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

  // Get specific environment
  async getEnvironment(name: string): Promise<EnvironmentProfile | null> {
    await this.loadEnvironments();
    return this.environments.get(name) || null;
  }

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

  // List all environments
  async listEnvironments(): Promise<EnvironmentProfile[]> {
    await this.loadEnvironments();
    return Array.from(this.environments.values());
  }

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

  // Compare environments
  async compareEnvironments(env1: string, env2: string): Promise<{
    variables: { added: string[]; removed: string[]; changed: Array<{key: string; from: any; to: any}> };
    build: Record<string, any>;
    deployment: Record<string, any>;
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

  private diffObjects(obj1: any, obj2: any): Record<string, any> {
    const diff: Record<string, any> = {};
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    
    for (const key of allKeys) {
      if (obj1[key] !== obj2[key]) {
        diff[key] = { from: obj1[key], to: obj2[key] };
      }
    }
    
    return diff;
  }
}

// Export singleton instance
export const environmentManager = new EnvironmentManager();

// Helper functions
export async function getActiveEnvironment(): Promise<EnvironmentProfile | null> {
  return environmentManager.getActiveEnvironment();
}

export async function setActiveEnvironment(name: string): Promise<void> {
  return environmentManager.setActiveEnvironment(name);
}

export async function getEnvironmentVariables(environmentName?: string): Promise<EnvironmentVariables> {
  return environmentManager.getEnvironmentVariables(environmentName);
}

export async function getBuildConfiguration(environmentName?: string): Promise<BuildConfiguration> {
  return environmentManager.getBuildConfiguration(environmentName);
}

export async function generateEnvFile(environmentName?: string, outputPath?: string): Promise<string> {
  return environmentManager.generateEnvFile(environmentName, outputPath);
}