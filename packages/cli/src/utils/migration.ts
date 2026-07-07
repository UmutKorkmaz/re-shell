import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { configManager} from './config';
import { ValidationError } from './error-handler';
import semver from 'semver';

// Migration system for configuration upgrades
/**
 * Represents a single configuration migration that upgrades config from one version to another.
 *
 * Each migration describes a version transition and provides functions to apply,
 * optionally revert, and optionally validate the resulting configuration.
 */
export interface Migration {
  /** Semantic version string this migration upgrades the configuration to. */
  version: string;
  /** Human-readable summary describing what the migration changes. */
  description: string;
  /** Applies the migration to the given configuration and returns the upgraded configuration. */
  up: (config: any) => any;
  /** Optional function that reverts the migration, restoring the previous configuration shape. */
  down?: (config: any) => any;
  /** Optional predicate that validates the migrated configuration is well-formed. */
  validate?: (config: any) => boolean;
}

/**
 * Represents the outcome of a migration or rollback operation.
 *
 * Includes the source and target versions, the list of migrations that were
 * applied, and any errors or warnings encountered during the process.
 */
export interface MigrationResult {
  /** Indicates whether the migration operation completed without errors. */
  success: boolean;
  /** The configuration version before the migration was attempted. */
  fromVersion: string;
  /** The configuration version the migration attempted to reach. */
  toVersion: string;
  /** List of migration version identifiers that were successfully applied. */
  appliedMigrations: string[];
  /** Optional list of error messages produced during the migration. */
  errors?: string[];
  /** Optional list of non-fatal warning messages produced during the migration. */
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
/**
 * Manages configuration migrations for both global and project-level configurations.
 *
 * The manager registers the known migrations at construction time and exposes
 * methods to detect when migrations are needed, apply forward migrations,
 * perform rollbacks, validate configuration integrity, and report migration history.
 */
export class MigrationManager {
  private migrations: Map<string, Migration[]> = new Map();

  /**
   * Creates a new `MigrationManager` and registers the built-in global and
   * project configuration migrations.
   */
  constructor() {
    this.migrations.set('global', GLOBAL_CONFIG_MIGRATIONS);
    this.migrations.set('project', PROJECT_CONFIG_MIGRATIONS);
  }

  /**
   * Determines whether the given configuration type requires migration to
   * the latest known config version.
   *
   * @param configType - Whether to inspect the 'global' or 'project' configuration.
   * @param currentVersion - Optional explicit version to compare against. If omitted, the current version is detected automatically.
   * @returns Resolves to `true` when the configuration version is older than the latest supported version.
   */
  // Check if migration is needed
  async needsMigration(configType: 'global' | 'project', currentVersion?: string): Promise<boolean> {
    const version = currentVersion || await this.getCurrentVersion(configType);
    return semver.lt(version, CURRENT_CONFIG_VERSION);
  }

  /**
   * Retrieves the current configuration version for the specified configuration type.
   *
   * Falls back to `'1.0.0'` when the version cannot be determined or the configuration cannot be loaded.
   *
   * @param configType - Whether to inspect the 'global' or 'project' configuration.
   * @param projectPath - Optional path to the project directory, used when `configType` is `'project'`.
   * @returns Resolves to the detected semantic version string of the configuration.
   */
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

  /**
   * Returns the list of migrations applicable between the specified version range,
   * sorted in ascending semantic-version order.
   *
   * @param configType - The configuration type whose migrations should be considered.
   * @param fromVersion - The lower-bound (exclusive) version. Migrations newer than this are included.
   * @param toVersion - The upper-bound (inclusive) version. Defaults to the latest config version.
   * @returns The matching `Migration` objects sorted from oldest to newest applicable version.
   */
  // Get available migrations for version range
  getAvailableMigrations(configType: 'global' | 'project', fromVersion: string, toVersion: string = CURRENT_CONFIG_VERSION): Migration[] {
    const migrations = this.migrations.get(configType) || [];
    
    return migrations.filter(migration => {
      return semver.gt(migration.version, fromVersion) && semver.lte(migration.version, toVersion);
    }).sort((a, b) => semver.compare(a.version, b.version));
  }

  /**
   * Applies all pending forward migrations to bring the specified configuration
   * up to the latest supported version.
   *
   * The method creates a backup before mutating the configuration, applies each
   * applicable migration sequentially, validates the result, and persists the
   * updated configuration. If any migration fails, processing halts and the
   * errors are reported in the result.
   *
   * @param configType - Whether to migrate the 'global' or 'project' configuration.
   * @param projectPath - Optional path to the project directory, required when `configType` is `'project'`.
   * @returns Resolves to a `MigrationResult` describing the outcome of the migration attempt.
   */
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

  /**
   * Rolls the configuration back to a previous version by invoking the `down`
   * function of each applicable migration in reverse order.
   *
   * @param configType - Whether to roll back the 'global' or 'project' configuration.
   * @param targetVersion - The semantic version to roll back to. Must be lower than the current version.
   * @param projectPath - Optional path to the project directory, used when `configType` is `'project'`.
   * @returns Resolves to a `MigrationResult` describing which migrations were reverted and any errors encountered.
   */
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

  /**
   * Writes a timestamped YAML backup of the configuration to disk before applying a migration.
   *
   * Backups are stored under a `backups/migrations` directory within either the global
   * re-shell home directory or the project's `.re-shell` folder, depending on the config type.
   *
   * @param configType - Whether the backup is for the 'global' or 'project' configuration.
   * @param config - The configuration object to persist as a backup.
   * @param projectPath - Optional path to the project directory, used when `configType` is `'project'`.
   * @returns Resolves to the absolute path of the created backup file.
   */
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

  /**
   * Inspects the configuration to verify its integrity against the expected schema.
   *
   * Reports any detected issues (such as an outdated version or failed validation)
   * along with actionable recommendations for resolving them.
   *
   * @param configType - Whether to inspect the 'global' or 'project' configuration.
   * @param projectPath - Optional path to the project directory, used when `configType` is `'project'`.
   * @returns Resolves to an object containing whether the configuration is valid, the detected version, identified issues, and recommended actions.
   */
  // Check configuration integrity
  async checkIntegrity(configType: 'global' | 'project', projectPath?: string): Promise<{
    /** Indicates whether the configuration passed all integrity checks. */
    valid: boolean;
    /** The configuration version detected during inspection. */
    version: string;
    /** List of problems detected in the configuration. */
    issues: string[];
    /** Suggested actions to resolve the reported issues. */
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

  /**
   * Automatically migrates both global and project configurations when needed.
   *
   * Intended to be called on CLI startup. Project migration is only attempted
   * when the current directory contains a project configuration.
   *
   * @returns Resolves to an object containing the optional `MigrationResult` for each of the global and project configurations.
   */
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

  /**
   * Returns a summary of migration state for the specified configuration type,
   * including the current version, all known versions, and which migrations
   * have been applied versus which are still pending.
   *
   * @param configType - Whether to inspect the 'global' or 'project' configuration.
   * @param projectPath - Optional path to the project directory, used when `configType` is `'project'`.
   * @returns Resolves to an object describing the current version and the applied/pending migration versions.
   */
  // Get migration history
  async getMigrationHistory(configType: 'global' | 'project', projectPath?: string): Promise<{
    /** The configuration version currently in use. */
    currentVersion: string;
    /** All migration versions known to the manager for this configuration type. */
    availableVersions: string[];
    /** Migration versions that have already been applied to reach the current version. */
    appliedMigrations: string[];
    /** Migration versions newer than the current version that have not yet been applied. */
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

/** Shared singleton `MigrationManager` instance used by the helper functions below. */
// Export singleton instance
export const migrationManager = new MigrationManager();

// Helper functions
/**
 * Convenience wrapper around `migrationManager.autoMigrate()` that migrates both
 * global and project configurations automatically when outdated versions are detected.
 *
 * @returns Resolves to an object containing the optional `MigrationResult` for each of the global and project configurations.
 */
export async function autoMigrate(): Promise<{ global: MigrationResult | null; project: MigrationResult | null }> {
  return migrationManager.autoMigrate();
}

/**
 * Convenience wrapper that migrates the global configuration to the latest version.
 *
 * @returns Resolves to the `MigrationResult` produced by migrating the global configuration.
 */
export async function migrateGlobalConfig(): Promise<MigrationResult> {
  return migrationManager.migrate('global');
}

/**
 * Convenience wrapper that migrates the project configuration at the given path
 * to the latest version.
 *
 * @param projectPath - Optional path to the project directory to migrate. Defaults to the current working directory's project configuration.
 * @returns Resolves to the `MigrationResult` produced by migrating the project configuration.
 */
export async function migrateProjectConfig(projectPath?: string): Promise<MigrationResult> {
  return migrationManager.migrate('project', projectPath);
}

/**
 * Convenience wrapper that checks the integrity of the specified configuration type.
 *
 * @param configType - Whether to inspect the 'global' or 'project' configuration.
 * @param projectPath - Optional path to the project directory, used when `configType` is `'project'`.
 * @returns Resolves to the integrity report produced by `MigrationManager.checkIntegrity`.
 */
export async function checkConfigIntegrity(configType: 'global' | 'project', projectPath?: string) {
  return migrationManager.checkIntegrity(configType, projectPath);
}