import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import {
  WorkspaceDefinition,
  WorkspaceEntry,
  WorkspaceDependency,
  loadWorkspaceDefinition as loadValidatedWorkspaceDefinition,
} from './workspace-schema';

// Conflict detection interfaces
export interface WorkspaceConflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  description: string;
  details: string;
  affectedWorkspaces: string[];
  location?: string;
  suggestions: ConflictResolution[];
}

export type ConflictType = 
  | 'naming'
  | 'dependency-cycle'
  | 'dependency-missing'
  | 'port-collision'
  | 'path-collision'
  | 'version-mismatch'
  | 'configuration'
  | 'template-inheritance'
  | 'build-target'
  | 'type-mismatch';

export type ConflictSeverity = 'error' | 'warning' | 'info';

export interface ConflictResolution {
  id: string;
  description: string;
  action: ResolutionAction;
  automatic: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  preview?: string;
}

export type ResolutionAction = 
  | 'rename-workspace'
  | 'update-dependency'
  | 'remove-dependency'
  | 'change-port'
  | 'change-path'
  | 'update-version'
  | 'merge-configuration'
  | 'split-workspace'
  | 'auto-resolve';

export interface ConflictDetectionOptions {
  includeWarnings?: boolean;
  checkDependencies?: boolean;
  checkPorts?: boolean;
  checkPaths?: boolean;
  checkTypes?: boolean;
  enableResolution?: boolean;
}

export interface ConflictResolutionResult {
  resolved: WorkspaceConflict[];
  unresolved: WorkspaceConflict[];
  changes: ConflictChange[];
  warnings: string[];
}

export interface ConflictChange {
  type: 'workspace' | 'dependency' | 'configuration';
  target: string;
  property: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

// Workspace conflict detector and resolver
export class WorkspaceConflictManager {
  private rootPath: string;
  private conflicts: Map<string, WorkspaceConflict> = new Map();

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
  }

  // Detect all conflicts in workspace definition
  async detectConflicts(
    definition: WorkspaceDefinition,
    options: ConflictDetectionOptions = {}
  ): Promise<WorkspaceConflict[]> {
    this.conflicts.clear();

    const defaultOptions: ConflictDetectionOptions = {
      includeWarnings: true,
      checkDependencies: true,
      checkPorts: true,
      checkPaths: true,
      checkTypes: true,
      enableResolution: true,
      ...options
    };

    // Check for naming conflicts
    await this.detectNamingConflicts(definition);

    // Check for dependency conflicts
    if (defaultOptions.checkDependencies) {
      await this.detectDependencyConflicts(definition);
    }

    // Check for port collisions
    if (defaultOptions.checkPorts) {
      await this.detectPortConflicts(definition);
    }

    // Check for path collisions
    if (defaultOptions.checkPaths) {
      await this.detectPathConflicts(definition);
    }

    // Check for type mismatches
    if (defaultOptions.checkTypes) {
      await this.detectTypeConflicts(definition);
    }

    // Check for configuration conflicts
    await this.detectConfigurationConflicts(definition);

    // Generate resolutions if enabled
    if (defaultOptions.enableResolution) {
      await this.generateResolutions(definition);
    }

    return Array.from(this.conflicts.values());
  }

  // Resolve conflicts automatically or with guidance
  async resolveConflicts(
    definition: WorkspaceDefinition,
    conflicts: WorkspaceConflict[],
    autoResolve = false
  ): Promise<ConflictResolutionResult> {
    const result: ConflictResolutionResult = {
      resolved: [],
      unresolved: [],
      changes: [],
      warnings: []
    };

    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveConflict(definition, conflict, autoResolve);
        
        if (resolution) {
          result.resolved.push(conflict);
          result.changes.push(...resolution.changes);
          result.warnings.push(...resolution.warnings);
        } else {
          result.unresolved.push(conflict);
        }
      } catch (error) {
        result.unresolved.push(conflict);
        result.warnings.push(`Failed to resolve conflict ${conflict.id}: ${(error as Error).message}`);
      }
    }

    return result;
  }

  // Validate resolution preview
  async previewResolution(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    resolutionId: string
  ): Promise<{
    success: boolean;
    changes: ConflictChange[];
    warnings: string[];
    preview: WorkspaceDefinition;
  }> {
    const resolution = conflict.suggestions.find(r => r.id === resolutionId);
    if (!resolution) {
      throw new ValidationError(`Resolution ${resolutionId} not found for conflict ${conflict.id}`);
    }

    // Create a deep copy for preview
    const preview = JSON.parse(JSON.stringify(definition)) as WorkspaceDefinition;
    const changes: ConflictChange[] = [];
    const warnings: string[] = [];

    try {
      await this.applyResolution(preview, conflict, resolution, changes, true);
      
      return {
        success: true,
        changes,
        warnings,
        preview
      };
    } catch (error) {
      return {
        success: false,
        changes: [],
        warnings: [(error as Error).message],
        preview: definition
      };
    }
  }

  // Detect naming conflicts
  private async detectNamingConflicts(definition: WorkspaceDefinition): Promise<void> {
    const workspaceNames = Object.keys(definition.workspaces);
    const duplicates = workspaceNames.filter((name, index) => 
      workspaceNames.indexOf(name) !== index
    );

    for (const duplicate of duplicates) {
      this.conflicts.set(`naming-${duplicate}`, {
        id: `naming-${duplicate}`,
        type: 'naming',
        severity: 'error',
        description: `Duplicate workspace name: ${duplicate}`,
        details: `Multiple workspaces are using the same name '${duplicate}'. Each workspace must have a unique name.`,
        affectedWorkspaces: [duplicate],
        suggestions: [
          {
            id: 'rename-workspace',
            description: `Rename one of the duplicate workspaces`,
            action: 'rename-workspace',
            automatic: false,
            riskLevel: 'low',
            preview: `Rename '${duplicate}' to '${duplicate}-2'`
          }
        ]
      });
    }

    // Check for reserved names
    const reservedNames = ['build', 'test', 'dev', 'prod', 'staging', 'config'];
    for (const [name, workspace] of Object.entries(definition.workspaces)) {
      if (reservedNames.includes(name.toLowerCase())) {
        this.conflicts.set(`reserved-${name}`, {
          id: `reserved-${name}`,
          type: 'naming',
          severity: 'warning',
          description: `Workspace uses reserved name: ${name}`,
          details: `The workspace name '${name}' conflicts with reserved system names.`,
          affectedWorkspaces: [name],
          suggestions: [
            {
              id: 'rename-workspace',
              description: `Rename workspace to avoid reserved name`,
              action: 'rename-workspace',
              automatic: false,
              riskLevel: 'low',
              preview: `Rename '${name}' to '${name}-app'`
            }
          ]
        });
      }
    }
  }

  // Detect dependency conflicts
  private async detectDependencyConflicts(definition: WorkspaceDefinition): Promise<void> {
    // Check for circular dependencies
    const cycles = this.findDependencyCycles(definition);
    
    for (const cycle of cycles) {
      this.conflicts.set(`cycle-${cycle.join('-')}`, {
        id: `cycle-${cycle.join('-')}`,
        type: 'dependency-cycle',
        severity: 'error',
        description: `Circular dependency detected: ${cycle.join(' → ')}`,
        details: `A circular dependency exists between workspaces: ${cycle.join(' → ')} → ${cycle[0]}`,
        affectedWorkspaces: cycle,
        suggestions: [
          {
            id: 'remove-dependency',
            description: `Remove dependency from ${cycle[cycle.length - 1]} to ${cycle[0]}`,
            action: 'remove-dependency',
            automatic: false,
            riskLevel: 'medium',
            preview: `Remove '${cycle[0]}' from ${cycle[cycle.length - 1]} dependencies`
          },
          {
            id: 'extract-common',
            description: `Extract common functionality to a shared library`,
            action: 'split-workspace',
            automatic: false,
            riskLevel: 'high'
          }
        ]
      });
    }

    // Check for missing dependencies
    for (const [workspaceName, deps] of Object.entries(definition.dependencies || {})) {
      if (!definition.workspaces[workspaceName]) {
        this.conflicts.set(`missing-workspace-${workspaceName}`, {
          id: `missing-workspace-${workspaceName}`,
          type: 'dependency-missing',
          severity: 'error',
          description: `Dependencies defined for non-existent workspace: ${workspaceName}`,
          details: `Dependencies are defined for workspace '${workspaceName}' but this workspace doesn't exist.`,
          affectedWorkspaces: [workspaceName],
          suggestions: [
            {
              id: 'remove-dependency',
              description: `Remove dependencies for non-existent workspace`,
              action: 'remove-dependency',
              automatic: true,
              riskLevel: 'low'
            }
          ]
        });
      }

      for (const dep of deps) {
        if (!definition.workspaces[dep.name]) {
          this.conflicts.set(`missing-dep-${workspaceName}-${dep.name}`, {
            id: `missing-dep-${workspaceName}-${dep.name}`,
            type: 'dependency-missing',
            severity: 'error',
            description: `Missing dependency: ${dep.name}`,
            details: `Workspace '${workspaceName}' depends on '${dep.name}' which doesn't exist.`,
            affectedWorkspaces: [workspaceName, dep.name],
            suggestions: [
              {
                id: 'remove-dependency',
                description: `Remove dependency on non-existent workspace`,
                action: 'remove-dependency',
                automatic: true,
                riskLevel: 'low'
              }
            ]
          });
        }
      }
    }
  }

  // Detect port conflicts
  private async detectPortConflicts(definition: WorkspaceDefinition): Promise<void> {
    const portMap = new Map<number, string[]>();

    for (const [name, workspace] of Object.entries(definition.workspaces)) {
      if (workspace.dev?.port) {
        const port = workspace.dev.port;
        if (!portMap.has(port)) {
          portMap.set(port, []);
        }
        portMap.get(port)!.push(name);
      }
    }

    for (const [port, workspaces] of portMap.entries()) {
      if (workspaces.length > 1) {
        this.conflicts.set(`port-${port}`, {
          id: `port-${port}`,
          type: 'port-collision',
          severity: 'error',
          description: `Port collision on ${port}`,
          details: `Multiple workspaces are configured to use port ${port}: ${workspaces.join(', ')}`,
          affectedWorkspaces: workspaces,
          suggestions: [
            {
              id: 'auto-assign-ports',
              description: `Automatically assign different ports`,
              action: 'change-port',
              automatic: true,
              riskLevel: 'low',
              preview: `Assign sequential ports starting from ${port + 1}`
            }
          ]
        });
      }
    }
  }

  // Detect path conflicts
  private async detectPathConflicts(definition: WorkspaceDefinition): Promise<void> {
    const pathMap = new Map<string, string[]>();

    for (const [name, workspace] of Object.entries(definition.workspaces)) {
      if (workspace.path) {
        const normalizedPath = path.normalize(workspace.path);
        if (!pathMap.has(normalizedPath)) {
          pathMap.set(normalizedPath, []);
        }
        pathMap.get(normalizedPath)!.push(name);
      }
    }

    for (const [workspacePath, workspaces] of pathMap.entries()) {
      if (workspaces.length > 1) {
        this.conflicts.set(`path-${workspacePath}`, {
          id: `path-${workspacePath}`,
          type: 'path-collision',
          severity: 'error',
          description: `Path collision: ${workspacePath}`,
          details: `Multiple workspaces are using the same path '${workspacePath}': ${workspaces.join(', ')}`,
          affectedWorkspaces: workspaces,
          suggestions: [
            {
              id: 'change-paths',
              description: `Assign unique paths to each workspace`,
              action: 'change-path',
              automatic: false,
              riskLevel: 'medium',
              preview: `Move workspaces to subdirectories`
            }
          ]
        });
      }
    }
  }

  // Detect type conflicts
  private async detectTypeConflicts(definition: WorkspaceDefinition): Promise<void> {
    for (const [name, workspace] of Object.entries(definition.workspaces)) {
      if (!definition.types[workspace.type]) {
        this.conflicts.set(`type-${name}`, {
          id: `type-${name}`,
          type: 'type-mismatch',
          severity: 'error',
          description: `Undefined workspace type: ${workspace.type}`,
          details: `Workspace '${name}' references type '${workspace.type}' which is not defined.`,
          affectedWorkspaces: [name],
          suggestions: [
            {
              id: 'define-type',
              description: `Define the missing workspace type`,
              action: 'auto-resolve',
              automatic: true,
              riskLevel: 'low',
              preview: `Create type definition for '${workspace.type}'`
            },
            {
              id: 'change-type',
              description: `Change to an existing type`,
              action: 'update-dependency',
              automatic: false,
              riskLevel: 'low'
            }
          ]
        });
      }
    }
  }

  // Detect configuration conflicts
  private async detectConfigurationConflicts(definition: WorkspaceDefinition): Promise<void> {
    // Check for conflicting build commands
    const buildCommands = new Set<string>();
    
    for (const [name, workspace] of Object.entries(definition.workspaces)) {
      const type = definition.types[workspace.type];
      if (type?.build?.command && buildCommands.has(type.build.command)) {
        this.conflicts.set(`build-command-${name}`, {
          id: `build-command-${name}`,
          type: 'build-target',
          severity: 'warning',
          description: `Conflicting build command: ${type.build.command}`,
          details: `Multiple workspaces are using the same build command '${type.build.command}'`,
          affectedWorkspaces: [name],
          suggestions: [
            {
              id: 'unique-build-command',
              description: `Use unique build commands`,
              action: 'auto-resolve',
              automatic: true,
              riskLevel: 'low'
            }
          ]
        });
      }
      
      if (type?.build?.command) {
        buildCommands.add(type.build.command);
      }
    }
  }

  // Generate resolution suggestions
  private async generateResolutions(definition: WorkspaceDefinition): Promise<void> {
    // Enhanced resolution generation based on conflict analysis
    for (const conflict of this.conflicts.values()) {
      if (conflict.suggestions.length === 0) {
        this.generateDefaultResolutions(conflict);
      }
    }
  }

  // Generate default resolutions for conflicts without suggestions
  private generateDefaultResolutions(conflict: WorkspaceConflict): void {
    switch (conflict.type) {
      case 'naming':
        conflict.suggestions.push({
          id: 'auto-rename',
          description: 'Automatically generate unique names',
          action: 'rename-workspace',
          automatic: true,
          riskLevel: 'low'
        });
        break;
      
      case 'port-collision':
        conflict.suggestions.push({
          id: 'sequential-ports',
          description: 'Assign sequential ports',
          action: 'change-port',
          automatic: true,
          riskLevel: 'low'
        });
        break;
      
      case 'dependency-missing':
        conflict.suggestions.push({
          id: 'remove-missing',
          description: 'Remove references to missing dependencies',
          action: 'remove-dependency',
          automatic: true,
          riskLevel: 'low'
        });
        break;
    }
  }

  // Find dependency cycles using DFS
  private findDependencyCycles(definition: WorkspaceDefinition): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (workspace: string): void => {
      if (recursionStack.has(workspace)) {
        // Found a cycle
        const cycleStart = path.indexOf(workspace);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(workspace)) {
        return;
      }

      visited.add(workspace);
      recursionStack.add(workspace);
      path.push(workspace);

      const dependencies = definition.dependencies?.[workspace] || [];
      for (const dep of dependencies) {
        if (definition.workspaces[dep.name]) {
          dfs(dep.name);
        }
      }

      recursionStack.delete(workspace);
      path.pop();
    };

    for (const workspace of Object.keys(definition.workspaces)) {
      if (!visited.has(workspace)) {
        dfs(workspace);
      }
    }

    return cycles;
  }

  // Resolve individual conflict
  private async resolveConflict(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    autoResolve: boolean
  ): Promise<{
    changes: ConflictChange[];
    warnings: string[];
  } | null> {
    const changes: ConflictChange[] = [];
    const warnings: string[] = [];

    // Find automatic resolution if auto-resolve is enabled
    let resolution = conflict.suggestions.find(r => r.automatic && autoResolve);
    
    // Otherwise, use the first low-risk resolution
    if (!resolution) {
      resolution = conflict.suggestions.find(r => r.riskLevel === 'low');
    }

    if (!resolution) {
      return null;
    }

    await this.applyResolution(definition, conflict, resolution, changes);

    return { changes, warnings };
  }

  // Apply a specific resolution
  private async applyResolution(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    resolution: ConflictResolution,
    changes: ConflictChange[],
    preview = false
  ): Promise<void> {
    switch (resolution.action) {
      case 'rename-workspace':
        await this.applyWorkspaceRename(definition, conflict, changes, preview);
        break;
        
      case 'change-port':
        await this.applyPortChange(definition, conflict, changes, preview);
        break;
        
      case 'change-path':
        await this.applyPathChange(definition, conflict, changes, preview);
        break;
        
      case 'remove-dependency':
        await this.applyDependencyRemoval(definition, conflict, changes, preview);
        break;
        
      case 'auto-resolve':
        await this.applyAutoResolve(definition, conflict, changes, preview);
        break;
    }
  }

  // Apply workspace rename resolution
  private async applyWorkspaceRename(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    changes: ConflictChange[],
    preview = false
  ): Promise<void> {
    const affected = conflict.affectedWorkspaces;
    
    for (let i = 1; i < affected.length; i++) {
      const oldName = affected[i];
      const newName = `${oldName}-${i + 1}`;
      
      if (!preview) {
        // Rename workspace
        definition.workspaces[newName] = definition.workspaces[oldName];
        delete definition.workspaces[oldName];
        
        // Update dependencies
        for (const [workspace, deps] of Object.entries(definition.dependencies || {})) {
          for (const dep of deps) {
            if (dep.name === oldName) {
              dep.name = newName;
            }
          }
        }
      }
      
      changes.push({
        type: 'workspace',
        target: oldName,
        property: 'name',
        oldValue: oldName,
        newValue: newName,
        reason: `Resolved naming conflict`
      });
    }
  }

  // Apply port change resolution
  private async applyPortChange(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    changes: ConflictChange[],
    preview = false
  ): Promise<void> {
    const basePort = parseInt(conflict.id.split('-')[1]);
    let currentPort = basePort + 1;
    
    for (let i = 1; i < conflict.affectedWorkspaces.length; i++) {
      const workspaceName = conflict.affectedWorkspaces[i];
      const workspace = definition.workspaces[workspaceName];
      
      if (workspace.dev) {
        const oldPort = workspace.dev.port;
        
        if (!preview) {
          workspace.dev.port = currentPort;
        }
        
        changes.push({
          type: 'workspace',
          target: workspaceName,
          property: 'dev.port',
          oldValue: oldPort,
          newValue: currentPort,
          reason: `Resolved port collision`
        });
        
        currentPort++;
      }
    }
  }

  // Apply path change resolution
  private async applyPathChange(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    changes: ConflictChange[],
    preview = false
  ): Promise<void> {
    const basePath = conflict.id.replace('path-', '');
    
    for (let i = 1; i < conflict.affectedWorkspaces.length; i++) {
      const workspaceName = conflict.affectedWorkspaces[i];
      const workspace = definition.workspaces[workspaceName];
      const oldPath = workspace.path;
      const newPath = path.join(basePath, workspaceName);
      
      if (!preview) {
        workspace.path = newPath;
      }
      
      changes.push({
        type: 'workspace',
        target: workspaceName,
        property: 'path',
        oldValue: oldPath,
        newValue: newPath,
        reason: `Resolved path collision`
      });
    }
  }

  // Apply dependency removal resolution
  private async applyDependencyRemoval(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    changes: ConflictChange[],
    preview = false
  ): Promise<void> {
    if (conflict.type === 'dependency-missing') {
      const [, , workspace, depName] = conflict.id.split('-');
      
      if (definition.dependencies?.[workspace]) {
        const deps = definition.dependencies[workspace];
        const depIndex = deps.findIndex(d => d.name === depName);
        
        if (depIndex !== -1) {
          if (!preview) {
            deps.splice(depIndex, 1);
          }
          
          changes.push({
            type: 'dependency',
            target: workspace,
            property: 'dependencies',
            oldValue: depName,
            newValue: null,
            reason: `Removed missing dependency`
          });
        }
      }
    }
  }

  // Apply auto-resolve resolution
  private async applyAutoResolve(
    definition: WorkspaceDefinition,
    conflict: WorkspaceConflict,
    changes: ConflictChange[],
    preview = false
  ): Promise<void> {
    if (conflict.type === 'type-mismatch') {
      const workspaceName = conflict.affectedWorkspaces[0];
      const workspace = definition.workspaces[workspaceName];
      const typeName = workspace.type;
      
      if (!definition.types[typeName] && !preview) {
        definition.types[typeName] = {
          name: typeName,
          description: `Auto-generated type for ${typeName}`,
          framework: 'react'
        };
      }
      
      changes.push({
        type: 'configuration',
        target: 'types',
        property: typeName,
        oldValue: undefined,
        newValue: definition.types[typeName],
        reason: `Created missing type definition`
      });
    }
  }

  // Helper methods
  private async loadWorkspaceDefinition(filePath: string): Promise<WorkspaceDefinition> {
    return loadValidatedWorkspaceDefinition(filePath);
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
export async function createWorkspaceConflictManager(
  rootPath?: string
): Promise<WorkspaceConflictManager> {
  return new WorkspaceConflictManager(rootPath);
}

// Quick conflict detection
export async function detectWorkspaceConflicts(
  workspaceFile: string,
  options?: ConflictDetectionOptions
): Promise<WorkspaceConflict[]> {
  const manager = new WorkspaceConflictManager();
  const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
  return await manager.detectConflicts(definition, options);
}

// Auto-resolve conflicts
export async function autoResolveConflicts(
  workspaceFile: string,
  conflicts?: WorkspaceConflict[]
): Promise<ConflictResolutionResult> {
  const manager = new WorkspaceConflictManager();
  const definition = await manager['loadWorkspaceDefinition'](workspaceFile);
  
  const conflictsToResolve = conflicts || await manager.detectConflicts(definition);
  const result = await manager.resolveConflicts(definition, conflictsToResolve, true);
  
  if (result.resolved.length > 0) {
    await manager['saveWorkspaceDefinition'](workspaceFile, definition);
  }
  
  return result;
}
