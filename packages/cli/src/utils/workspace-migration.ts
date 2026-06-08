import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import * as semver from 'semver';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition, WorkspaceEntry, WorkspaceTypeConfig } from './workspace-schema';
import { createWorkspaceBackupManager } from './workspace-backup';

// Migration interfaces
export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  fromVersion: string;
  toVersion: string;
  breaking: boolean;
  execute: (definition: WorkspaceDefinition) => Promise<WorkspaceDefinition>;
  validate?: (definition: WorkspaceDefinition) => Promise<ValidationResult>;
  rollback?: (definition: WorkspaceDefinition) => Promise<WorkspaceDefinition>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface MigrationPlan {
  currentVersion: string;
  targetVersion: string;
  steps: MigrationStep[];
  hasBreakingChanges: boolean;
  backupRequired: boolean;
  estimatedDuration: number; // in seconds
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  stepsExecuted: string[];
  backupId?: string;
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface UpgradeOptions {
  targetVersion?: string;
  force?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  skipValidation?: boolean;
  interactive?: boolean;
}

// Version compatibility matrix
const VERSION_COMPATIBILITY: Record<string, string[]> = {
  '1.0.0': ['1.0.1', '1.0.2', '1.1.0'],
  '1.0.1': ['1.0.2', '1.1.0', '1.1.1'],
  '1.0.2': ['1.1.0', '1.1.1', '1.2.0'],
  '1.1.0': ['1.1.1', '1.1.2', '1.2.0'],
  '1.1.1': ['1.1.2', '1.2.0', '2.0.0'],
  '1.1.2': ['1.2.0', '2.0.0'],
  '1.2.0': ['1.2.1', '2.0.0'],
  '1.2.1': ['2.0.0'],
  '2.0.0': ['2.0.1', '2.1.0'],
  '2.0.1': ['2.1.0', '2.1.1'],
  '2.1.0': ['2.1.1', '2.2.0'],
  '2.1.1': ['2.2.0']
};

// Workspace migration manager
export class WorkspaceMigrationManager {
  private migrationSteps: Map<string, MigrationStep> = new Map();
  private rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
    this.initializeMigrationSteps();
  }

  // Create migration plan
  async createMigrationPlan(
    currentVersion: string,
    targetVersion: string
  ): Promise<MigrationPlan> {
    if (!semver.valid(currentVersion) || !semver.valid(targetVersion)) {
      throw new ValidationError('Invalid version format');
    }

    if (semver.gte(currentVersion, targetVersion)) {
      throw new ValidationError('Target version must be higher than current version');
    }

    const steps = this.findMigrationPath(currentVersion, targetVersion);
    const hasBreakingChanges = steps.some(step => step.breaking);
    const backupRequired = hasBreakingChanges || steps.length > 1;
    const estimatedDuration = steps.length * 30; // 30 seconds per step

    return {
      currentVersion,
      targetVersion,
      steps,
      hasBreakingChanges,
      backupRequired,
      estimatedDuration
    };
  }

  // Execute migration
  async executeMigration(
    workspaceFile: string,
    plan: MigrationPlan,
    options: UpgradeOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      fromVersion: plan.currentVersion,
      toVersion: plan.targetVersion,
      stepsExecuted: [],
      errors: [],
      warnings: [],
      duration: 0
    };

    try {
      // Load workspace definition
      let definition = await this.loadWorkspaceDefinition(workspaceFile);

      // Create backup if required
      if ((plan.backupRequired || options.backup) && !options.dryRun) {
        try {
          const backupManager = await createWorkspaceBackupManager(this.rootPath);
          result.backupId = await backupManager.createBackup(workspaceFile, {
            name: `pre-migration-${plan.currentVersion}-to-${plan.targetVersion}`,
            description: `Automatic backup before migration from ${plan.currentVersion} to ${plan.targetVersion}`,
            includeState: true,
            includeTemplates: true
          });
        } catch (error) {
          result.warnings.push(`Failed to create backup: ${(error as Error).message}`);
        }
      }

      // Execute migration steps
      for (const step of plan.steps) {
        try {
          if (options.dryRun) {
            result.stepsExecuted.push(`[DRY-RUN] ${step.id}`);
            continue;
          }

          // Validate before execution if step has validation
          if (step.validate && !options.skipValidation) {
            const validation = await step.validate(definition);
            if (!validation.valid) {
              throw new ValidationError(
                `Pre-migration validation failed for step ${step.id}: ${validation.errors.join(', ')}`
              );
            }
            result.warnings.push(...validation.warnings);
          }

          // Execute migration step
          definition = await step.execute(definition);
          result.stepsExecuted.push(step.id);

        } catch (error) {
          result.errors.push(`Step ${step.id} failed: ${(error as Error).message}`);
          throw error;
        }
      }

      // Save migrated definition
      if (!options.dryRun) {
        definition.version = plan.targetVersion;
        await this.saveWorkspaceDefinition(workspaceFile, definition);
      }

      result.success = true;
      result.duration = Date.now() - startTime;

    } catch (error) {
      result.errors.push((error as Error).message);
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  // Check for available upgrades
  async checkUpgrades(currentVersion: string): Promise<{
    available: string[];
    recommended: string;
    breaking: string[];
  }> {
    const available = VERSION_COMPATIBILITY[currentVersion] || [];
    const recommended = available.find(v => semver.diff(currentVersion, v) === 'minor') || 
                      available[0];
    const breaking = available.filter(v => semver.major(v) > semver.major(currentVersion));

    return { available, recommended, breaking };
  }

  // Validate workspace definition
  async validateDefinition(definition: WorkspaceDefinition): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check version format
    if (!semver.valid(definition.version)) {
      result.errors.push('Invalid version format');
      result.valid = false;
    }

    // Check required fields
    if (!definition.name) {
      result.errors.push('Workspace name is required');
      result.valid = false;
    }

    if (!definition.workspaces || Object.keys(definition.workspaces).length === 0) {
      result.warnings.push('No workspaces defined');
    }

    // Check workspace consistency
    for (const [name, workspace] of Object.entries(definition.workspaces)) {
      if (!workspace.type) {
        result.errors.push(`Workspace '${name}' missing type`);
        result.valid = false;
      }

      if (!definition.types[workspace.type]) {
        result.errors.push(`Workspace '${name}' references undefined type '${workspace.type}'`);
        result.valid = false;
      }

      if (!workspace.path) {
        result.warnings.push(`Workspace '${name}' missing path`);
      }
    }

    // Check dependency references
    if (definition.dependencies) {
      for (const [workspace, deps] of Object.entries(definition.dependencies)) {
        if (!definition.workspaces[workspace]) {
          result.errors.push(`Dependencies defined for unknown workspace '${workspace}'`);
          result.valid = false;
        }

        for (const dep of deps) {
          if (!definition.workspaces[dep.name]) {
            result.errors.push(`Workspace '${workspace}' depends on unknown workspace '${dep.name}'`);
            result.valid = false;
          }
        }
      }
    }

    // Suggestions for improvements
    if (!definition.description) {
      result.suggestions.push('Consider adding a workspace description');
    }

    if (!definition.scripts || Object.keys(definition.scripts).length === 0) {
      result.suggestions.push('Consider defining common scripts');
    }

    return result;
  }

  // Get migration history
  async getMigrationHistory(workspaceFile: string): Promise<{
    migrations: Array<{
      date: string;
      fromVersion: string;
      toVersion: string;
      backupId?: string;
    }>;
  }> {
    const historyFile = path.join(this.rootPath, '.re-shell', 'migration-history.json');
    
    try {
      if (await fs.pathExists(historyFile)) {
        return await fs.readJson(historyFile);
      }
    } catch (error) {
      // Return empty history if file doesn't exist or is corrupted
    }

    return { migrations: [] };
  }

  // Record migration in history
  async recordMigration(
    fromVersion: string,
    toVersion: string,
    backupId?: string
  ): Promise<void> {
    const historyFile = path.join(this.rootPath, '.re-shell', 'migration-history.json');
    
    let history;
    try {
      history = await fs.readJson(historyFile);
    } catch (error) {
      history = { migrations: [] };
    }

    history.migrations.push({
      date: new Date().toISOString(),
      fromVersion,
      toVersion,
      backupId
    });

    await fs.ensureDir(path.dirname(historyFile));
    await fs.writeJson(historyFile, history, { spaces: 2 });
  }

  // Find migration path between versions
  private findMigrationPath(fromVersion: string, toVersion: string): MigrationStep[] {
    const path: MigrationStep[] = [];
    let currentVersion = fromVersion;

    // Simple version incremental migration
    while (semver.lt(currentVersion, toVersion)) {
      const nextVersion = this.getNextVersion(currentVersion, toVersion);
      const stepId = `${currentVersion}-to-${nextVersion}`;
      
      const step = this.migrationSteps.get(stepId);
      if (step) {
        path.push(step);
      } else {
        // Create generic migration step
        path.push(this.createGenericMigrationStep(currentVersion, nextVersion));
      }
      
      currentVersion = nextVersion;
    }

    return path;
  }

  // Get next version in migration path
  private getNextVersion(currentVersion: string, targetVersion: string): string {
    const compatible = VERSION_COMPATIBILITY[currentVersion];
    if (!compatible) {
      // If no compatibility info, increment minor version
      return semver.inc(currentVersion, 'minor')!;
    }

    // Find the closest version to target
    const candidates = compatible.filter(v => semver.lte(v, targetVersion));
    return candidates.length > 0 ? candidates[0] : compatible[0];
  }

  // Create generic migration step
  private createGenericMigrationStep(fromVersion: string, toVersion: string): MigrationStep {
    return {
      id: `${fromVersion}-to-${toVersion}`,
      name: `Update version from ${fromVersion} to ${toVersion}`,
      description: `Generic version update migration`,
      fromVersion,
      toVersion,
      breaking: semver.major(toVersion) > semver.major(fromVersion),
      execute: async (definition: WorkspaceDefinition) => {
        definition.version = toVersion;
        return definition;
      }
    };
  }

  // Initialize migration steps
  private initializeMigrationSteps(): void {
    // Add specific migration steps here
    
    // Migration from 1.0.0 to 1.1.0 - Add workspace types
    this.migrationSteps.set('1.0.0-to-1.1.0', {
      id: '1.0.0-to-1.1.0',
      name: 'Add workspace types support',
      description: 'Introduces workspace type definitions for better organization',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      breaking: false,
      execute: async (definition: WorkspaceDefinition) => {
        if (!definition.types) {
          definition.types = {
            app: {
              name: 'Application',
              description: 'Frontend application',
              framework: 'react'
            },
            lib: {
              name: 'Library',
              description: 'Shared library',
              framework: 'typescript'
            }
          };
        }

        // Ensure all workspaces have a type
        for (const [name, workspace] of Object.entries(definition.workspaces)) {
          if (!workspace.type) {
            workspace.type = 'app'; // Default type
          }
        }

        return definition;
      },
      validate: async (definition: WorkspaceDefinition) => {
        const result: ValidationResult = {
          valid: true,
          errors: [],
          warnings: [],
          suggestions: []
        };

        if (definition.types) {
          result.warnings.push('Workspace types already exist, migration may overwrite them');
        }

        return result;
      }
    });

    // Migration from 1.1.0 to 1.2.0 - Add build configuration
    this.migrationSteps.set('1.1.0-to-1.2.0', {
      id: '1.1.0-to-1.2.0',
      name: 'Add build configuration',
      description: 'Introduces centralized build configuration',
      fromVersion: '1.1.0',
      toVersion: '1.2.0',
      breaking: false,
      execute: async (definition: WorkspaceDefinition) => {
        if (!definition.build) {
          definition.build = {
            parallel: true,
            cache: true
          };
        }

        return definition;
      }
    });

    // Migration from 1.2.0 to 2.0.0 - Breaking changes
    this.migrationSteps.set('1.2.0-to-2.0.0', {
      id: '1.2.0-to-2.0.0',
      name: 'Migrate to v2 schema',
      description: 'Major schema update with breaking changes',
      fromVersion: '1.2.0',
      toVersion: '2.0.0',
      breaking: true,
      execute: async (definition: WorkspaceDefinition) => {
        // Migrate workspace entries to new format
        for (const [name, workspace] of Object.entries(definition.workspaces)) {
          // Convert old 'port' field to dev.port
          if ('port' in workspace && typeof workspace.port === 'string') {
            if (!workspace.dev) {
              workspace.dev = {};
            }
            workspace.dev.port = parseInt(workspace.port);
            delete (workspace as any).port;
          }

          // Convert old 'framework' field to type config
          if ('framework' in workspace && typeof workspace.framework === 'string') {
            if (definition.types[workspace.type]) {
              definition.types[workspace.type].framework = workspace.framework;
            }
            delete (workspace as any).framework;
          }
        }

        return definition;
      },
      rollback: async (definition: WorkspaceDefinition) => {
        // Rollback v2 changes to v1 format
        for (const [name, workspace] of Object.entries(definition.workspaces)) {
          if (workspace.dev?.port) {
            (workspace as any).port = workspace.dev.port.toString();
          }
        }
        
        definition.version = '1.2.0';
        return definition;
      }
    });
  }

  // Helper methods
  private async loadWorkspaceDefinition(filePath: string): Promise<WorkspaceDefinition> {
    if (!(await fs.pathExists(filePath))) {
      throw new ValidationError(`Workspace file not found: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    return yaml.parse(content) as WorkspaceDefinition;
  }

  private async saveWorkspaceDefinition(
    filePath: string,
    definition: WorkspaceDefinition
  ): Promise<void> {
    const content = yaml.stringify(definition);
    await fs.writeFile(filePath, content, 'utf8');
  }
}

// Utility functions
export async function createWorkspaceMigrationManager(
  rootPath?: string
): Promise<WorkspaceMigrationManager> {
  return new WorkspaceMigrationManager(rootPath);
}

// Quick upgrade check
export async function checkForUpgrades(
  workspaceFile: string
): Promise<{
  currentVersion: string;
  available: string[];
  recommended: string;
  breaking: string[];
}> {
  const manager = new WorkspaceMigrationManager();
  const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
  const upgrades = await manager.checkUpgrades(definition.version);
  
  return {
    currentVersion: definition.version,
    ...upgrades
  };
}

// Validate workspace
export async function validateWorkspace(
  workspaceFile: string
): Promise<ValidationResult> {
  const manager = new WorkspaceMigrationManager();
  const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
  return await manager.validateDefinition(definition);
}