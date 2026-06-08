import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { configManager, GlobalConfig, ProjectConfig } from './config';
import { ValidationError } from './error-handler';
import semver from 'semver';

// Migration system for configuration upgrades
export interface Migration {
  version: string;
  description: string;
  up: (config: any) => any;
  down?: (config: any) => any;
  validate?: (config: any) => boolean;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  appliedMigrations: string[];
  errors?: string[];
  warnings?: string[];
}

// Configuration version history and migrations
const CURRENT_CONFIG_VERSION = '1.2.0';

const GLOBAL_CONFIG_MIGRATIONS: Migration[] = [
  {
    version: '1.0.1',
    description: 'Add CLI theme support',
    up: (config) => ({
      ...config,
      cli: {
        ...config.cli,
        theme: config.cli?.theme || 'auto'
      }
    }),
    validate: (config) => config.cli && typeof config.cli.theme === 'string'
  },
  {
    version: '1.1.0',
    description: 'Add plugin marketplace configuration',
    up: (config) => ({
      ...config,
      plugins: {
        ...config.plugins,
        marketplace: {
          registry: 'https://registry.npmjs.org',
          autoUpdate: false,
          ...config.plugins?.marketplace
        }
      }
    }),
    validate: (config) => config.plugins?.marketplace?.registry
  },
  {
    version: '1.2.0',
    description: 'Add user profile and enhanced paths',
    up: (config) => ({
      ...config,
      user: {
        name: undefined,
        email: undefined,
        organization: undefined,
        ...config.user
      },
      paths: {
        ...config.paths,
        workspace: path.join(config.paths?.cache || '~/.re-shell/cache', 'workspaces'),
        logs: path.join(config.paths?.cache || '~/.re-shell/cache', 'logs')
      }
    }),
    validate: (config) => config.user && config.paths?.workspace && config.paths?.logs
  }
];

const PROJECT_CONFIG_MIGRATIONS: Migration[] = [
  {
    version: '1.0.1',
    description: 'Add environment configurations',
    up: (config) => ({
      ...config,
      environments: config.environments || {
        development: {
          name: 'development',
          variables: { NODE_ENV: 'development' },
          build: { mode: 'development', optimization: false, sourcemaps: true },
          deployment: {}
        },
        staging: {
          name: 'staging',
          variables: { NODE_ENV: 'staging' },
          build: { mode: 'staging', optimization: true, sourcemaps: true },
          deployment: {}
        },
        production: {
          name: 'production',
          variables: { NODE_ENV: 'production' },
          build: { mode: 'production', optimization: true, sourcemaps: false },
          deployment: {}
        }
      }
    }),
    validate: (config) => config.environments && Object.keys(config.environments).length > 0
  },
  {
    version: '1.1.0',
    description: 'Enhanced workspace configuration',
    up: (config) => ({
      ...config,
      workspaces: {
        root: '.',
        patterns: ['apps/*', 'packages/*', 'libs/*', 'tools/*'],
        types: ['app', 'package', 'lib', 'tool'],
        ...config.workspaces
      }
    }),
    validate: (config) => config.workspaces?.patterns && Array.isArray(config.workspaces.patterns)
  },
  {
    version: '1.2.0',
    description: 'Add quality and security configurations',
    up: (config) => ({
      ...config,
      quality: {
        linting: true,
        testing: true,
        coverage: { enabled: true, threshold: 80 },
        security: { enabled: true, autoFix: false },
        ...config.quality
      }
    }),
    validate: (config) => config.quality && typeof config.quality.linting === 'boolean'
  }
];

// Migration manager class
export class MigrationManager {
  private migrations: Map<string, Migration[]> = new Map();

  constructor() {
    this.migrations.set('global', GLOBAL_CONFIG_MIGRATIONS);
    this.migrations.set('project', PROJECT_CONFIG_MIGRATIONS);
  }

  // Check if migration is needed
  async needsMigration(configType: 'global' | 'project', currentVersion?: string): Promise<boolean> {
    const version = currentVersion || await this.getCurrentVersion(configType);
    return semver.lt(version, CURRENT_CONFIG_VERSION);
  }

  // Get current configuration version
  async getCurrentVersion(configType: 'global' | 'project', projectPath?: string): Promise<string> {
    try {
      if (configType === 'global') {
        const globalConfig = await configManager.loadGlobalConfig();
        return globalConfig.version || '1.0.0';
      } else {
        const projectConfig = await configManager.loadProjectConfig(projectPath);
        return projectConfig?.version || '1.0.0';
      }
    } catch {
      return '1.0.0';
    }
  }

  // Get available migrations for version range
  getAvailableMigrations(configType: 'global' | 'project', fromVersion: string, toVersion: string = CURRENT_CONFIG_VERSION): Migration[] {
    const migrations = this.migrations.get(configType) || [];
    
    return migrations.filter(migration => {
      return semver.gt(migration.version, fromVersion) && semver.lte(migration.version, toVersion);
    }).sort((a, b) => semver.compare(a.version, b.version));
  }

  // Apply migrations
  async migrate(configType: 'global' | 'project', projectPath?: string): Promise<MigrationResult> {
    const fromVersion = await this.getCurrentVersion(configType, projectPath);
    const toVersion = CURRENT_CONFIG_VERSION;
    
    if (!await this.needsMigration(configType, fromVersion)) {
      return {
        success: true,
        fromVersion,
        toVersion,
        appliedMigrations: [],
        warnings: ['Configuration is already up to date']
      };
    }

    const migrations = this.getAvailableMigrations(configType, fromVersion, toVersion);
    const appliedMigrations: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Load current configuration
      let config: any;
      if (configType === 'global') {
        config = await configManager.loadGlobalConfig();
      } else {
        config = await configManager.loadProjectConfig(projectPath);
        if (!config) {
          throw new ValidationError('No project configuration found');
        }
      }

      // Create backup before migration
      const backupPath = await this.createMigrationBackup(configType, config, projectPath);
      warnings.push(`Backup created at: ${backupPath}`);

      // Apply migrations sequentially
      for (const migration of migrations) {
        try {
          console.log(`Applying migration ${migration.version}: ${migration.description}`);
          
          // Apply the migration
          config = migration.up(config);
          config.version = migration.version;
          
          // Validate the result if validation function exists
          if (migration.validate && !migration.validate(config)) {
            throw new Error(`Migration validation failed for version ${migration.version}`);
          }
          
          appliedMigrations.push(migration.version);
          
        } catch (error) {
          errors.push(`Migration ${migration.version} failed: ${(error as Error).message}`);
          break;
        }
      }

      // Save migrated configuration if no errors
      if (errors.length === 0) {
        config.version = toVersion;
        
        if (configType === 'global') {
          await configManager.saveGlobalConfig(config);
        } else {
          await configManager.saveProjectConfig(config, projectPath);
        }
      }

      return {
        success: errors.length === 0,
        fromVersion,
        toVersion,
        appliedMigrations,
        errors: errors.length > 0 ? errors : undefined,
        warnings
      };

    } catch (error) {
      return {
        success: false,
        fromVersion,
        toVersion,
        appliedMigrations,
        errors: [`Migration failed: ${(error as Error).message}`]
      };
    }
  }

  // Rollback to previous version
  async rollback(configType: 'global' | 'project', targetVersion: string, projectPath?: string): Promise<MigrationResult> {
    const currentVersion = await this.getCurrentVersion(configType, projectPath);
    
    if (semver.gte(targetVersion, currentVersion)) {
      return {
        success: false,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        appliedMigrations: [],
        errors: ['Target version must be lower than current version']
      };
    }

    // Get migrations to rollback (in reverse order)
    const migrations = this.getAvailableMigrations(configType, targetVersion, currentVersion);
    const reversedMigrations = migrations.reverse();
    
    const appliedMigrations: string[] = [];
    const errors: string[] = [];

    try {
      // Load current configuration
      let config: any;
      if (configType === 'global') {
        config = await configManager.loadGlobalConfig();
      } else {
        config = await configManager.loadProjectConfig(projectPath);
      }

      // Apply rollback migrations
      for (const migration of reversedMigrations) {
        if (migration.down) {
          try {
            config = migration.down(config);
            appliedMigrations.push(`rollback-${migration.version}`);
          } catch (error) {
            errors.push(`Rollback ${migration.version} failed: ${(error as Error).message}`);
            break;
          }
        } else {
          errors.push(`No rollback available for migration ${migration.version}`);
          break;
        }
      }

      // Save rolled back configuration
      if (errors.length === 0) {
        config.version = targetVersion;
        
        if (configType === 'global') {
          await configManager.saveGlobalConfig(config);
        } else {
          await configManager.saveProjectConfig(config, projectPath);
        }
      }

      return {
        success: errors.length === 0,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        appliedMigrations,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        appliedMigrations,
        errors: [`Rollback failed: ${(error as Error).message}`]
      };
    }
  }

  // Create migration backup
  private async createMigrationBackup(configType: 'global' | 'project', config: any, projectPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = configType === 'global' 
      ? path.join(process.env.HOME || '~', '.re-shell', 'backups', 'migrations')
      : path.join(projectPath || process.cwd(), '.re-shell', 'backups', 'migrations');
    
    const backupPath = path.join(backupDir, `${configType}-config-${timestamp}.yaml`);
    
    await fs.ensureDir(backupDir);
    const content = yaml.stringify(config);
    await fs.writeFile(backupPath, content, 'utf8');
    
    return backupPath;
  }

  // Check configuration integrity
  async checkIntegrity(configType: 'global' | 'project', projectPath?: string): Promise<{
    valid: boolean;
    version: string;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const version = await this.getCurrentVersion(configType, projectPath);
      
      // Check if migration is needed
      if (await this.needsMigration(configType, version)) {
        issues.push(`Configuration version ${version} is outdated (current: ${CURRENT_CONFIG_VERSION})`);
        recommendations.push('Run migration to update to latest version');
      }

      // Load and validate configuration
      let config: any;
      if (configType === 'global') {
        config = await configManager.loadGlobalConfig();
      } else {
        config = await configManager.loadProjectConfig(projectPath);
        if (!config) {
          issues.push('No project configuration found');
          recommendations.push('Initialize project configuration');
          return { valid: false, version, issues, recommendations };
        }
      }

      // Validate against current schema
      const migrations = this.getAvailableMigrations(configType, '1.0.0', CURRENT_CONFIG_VERSION);
      for (const migration of migrations) {
        if (migration.validate && !migration.validate(config)) {
          issues.push(`Configuration does not satisfy requirements for version ${migration.version}`);
        }
      }

      return {
        valid: issues.length === 0,
        version,
        issues,
        recommendations
      };

    } catch (error) {
      return {
        valid: false,
        version: '1.0.0',
        issues: [`Configuration check failed: ${(error as Error).message}`],
        recommendations: ['Check configuration file syntax and permissions']
      };
    }
  }

  // Auto-migrate on CLI startup if needed
  async autoMigrate(): Promise<{ global: MigrationResult | null; project: MigrationResult | null }> {
    const results = { global: null as MigrationResult | null, project: null as MigrationResult | null };

    // Auto-migrate global configuration
    if (await this.needsMigration('global')) {
      results.global = await this.migrate('global');
    }

    // Auto-migrate project configuration if in a project directory
    try {
      const projectConfig = await configManager.loadProjectConfig();
      if (projectConfig && await this.needsMigration('project')) {
        results.project = await this.migrate('project');
      }
    } catch {
      // Not in a project directory, skip project migration
    }

    return results;
  }

  // Get migration history
  async getMigrationHistory(configType: 'global' | 'project', projectPath?: string): Promise<{
    currentVersion: string;
    availableVersions: string[];
    appliedMigrations: string[];
    pendingMigrations: string[];
  }> {
    const currentVersion = await this.getCurrentVersion(configType, projectPath);
    const allMigrations = this.migrations.get(configType) || [];
    const availableVersions = allMigrations.map(m => m.version);
    
    const appliedMigrations = allMigrations
      .filter(m => semver.lte(m.version, currentVersion))
      .map(m => m.version);
    
    const pendingMigrations = allMigrations
      .filter(m => semver.gt(m.version, currentVersion))
      .map(m => m.version);

    return {
      currentVersion,
      availableVersions,
      appliedMigrations,
      pendingMigrations
    };
  }
}

// Export singleton instance
export const migrationManager = new MigrationManager();

// Helper functions
export async function autoMigrate(): Promise<{ global: MigrationResult | null; project: MigrationResult | null }> {
  return migrationManager.autoMigrate();
}

export async function migrateGlobalConfig(): Promise<MigrationResult> {
  return migrationManager.migrate('global');
}

export async function migrateProjectConfig(projectPath?: string): Promise<MigrationResult> {
  return migrationManager.migrate('project', projectPath);
}

export async function checkConfigIntegrity(configType: 'global' | 'project', projectPath?: string) {
  return migrationManager.checkIntegrity(configType, projectPath);
}