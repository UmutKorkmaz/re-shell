import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import semver from 'semver';
import { ValidationError } from './error-handler';
import { PluginManifest, PluginRegistration } from './plugin-system';

// Plugin dependency types
export interface PluginDependencySpec {
  name: string;
  version: string;
  required: boolean;
  type: 'plugin' | 'npm' | 'peer';
  source?: string;
  scope?: string;
}

export interface ResolvedDependency extends PluginDependencySpec {
  resolved: boolean;
  resolvedVersion?: string;
  installation?: PluginRegistration;
  conflicts?: DependencyConflict[];
  error?: Error;
}

// Dependency conflict information
export interface DependencyConflict {
  type: 'version' | 'missing' | 'circular' | 'incompatible';
  source: string;
  target: string;
  requested: string;
  available?: string;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  action: 'upgrade' | 'downgrade' | 'install' | 'remove' | 'ignore';
  target: string;
  version?: string;
  reason: string;
}

// Dependency graph node
export interface DependencyNode {
  name: string;
  version: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  resolved: boolean;
  depth: number;
  installation?: PluginRegistration;
}

// Version constraint types
export interface VersionConstraint {
  constraint: string;
  source: string;
  type: 'exact' | 'range' | 'latest' | 'compatible';
}

// Dependency resolution options
export interface ResolutionOptions {
  allowPrerelease?: boolean;
  preferStable?: boolean;
  ignoreOptional?: boolean;
  maxDepth?: number;
  timeout?: number;
  strategy?: 'strict' | 'loose' | 'latest';
  allowConflicts?: boolean;
  autoInstall?: boolean;
}

// Dependency resolution result
export interface ResolutionResult {
  resolved: ResolvedDependency[];
  conflicts: DependencyConflict[];
  missing: string[];
  circular: string[][];
  installationPlan: InstallationStep[];
  success: boolean;
  warnings: string[];
}

// Installation step
export interface InstallationStep {
  action: 'install' | 'upgrade' | 'downgrade' | 'remove';
  plugin: string;
  version: string;
  dependencies: string[];
  order: number;
  optional: boolean;
}

// Plugin dependency resolver
export class PluginDependencyResolver extends EventEmitter {
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private versionCache: Map<string, string[]> = new Map();
  private resolutionCache: Map<string, ResolutionResult> = new Map();
  private plugins: Map<string, PluginRegistration> = new Map();
  
  constructor(private options: Partial<ResolutionOptions> = {}) {
    super();
    this.options = {
      allowPrerelease: false,
      preferStable: true,
      ignoreOptional: false,
      maxDepth: 10,
      timeout: 30000,
      strategy: 'strict',
      allowConflicts: false,
      autoInstall: false,
      ...options
    };
  }

  // Register available plugins
  registerPlugin(registration: PluginRegistration): void {
    this.plugins.set(registration.manifest.name, registration);
    this.updateDependencyGraph(registration);
    this.emit('plugin-registered', registration.manifest.name);
  }

  // Unregister a plugin
  unregisterPlugin(name: string): void {
    this.plugins.delete(name);
    this.dependencyGraph.delete(name);
    this.clearCache();
    this.emit('plugin-unregistered', name);
  }

  // Resolve dependencies for a plugin
  async resolveDependencies(
    manifest: PluginManifest,
    options: Partial<ResolutionOptions> = {}
  ): Promise<ResolutionResult> {
    const resolveOptions = { ...this.options, ...options };
    const cacheKey = this.getCacheKey(manifest, resolveOptions);

    // Check cache
    if (this.resolutionCache.has(cacheKey)) {
      const cached = this.resolutionCache.get(cacheKey)!;
      this.emit('resolution-cache-hit', manifest.name);
      return cached;
    }

    const startTime = Date.now();
    this.emit('resolution-started', manifest.name);

    try {
      const result = await this.performResolution(manifest, resolveOptions);
      
      // Cache result
      this.resolutionCache.set(cacheKey, result);
      
      const duration = Date.now() - startTime;
      this.emit('resolution-completed', {
        plugin: manifest.name,
        success: result.success,
        duration,
        conflicts: result.conflicts.length,
        missing: result.missing.length
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('resolution-failed', {
        plugin: manifest.name,
        error,
        duration
      });
      throw error;
    }
  }

  // Perform actual dependency resolution
  private async performResolution(
    manifest: PluginManifest,
    options: ResolutionOptions
  ): Promise<ResolutionResult> {
    const result: ResolutionResult = {
      resolved: [],
      conflicts: [],
      missing: [],
      circular: [],
      installationPlan: [],
      success: true,
      warnings: []
    };

    // Extract dependency specifications
    const dependencySpecs = this.extractDependencySpecs(manifest);
    
    // Build dependency tree
    const dependencyTree = await this.buildDependencyTree(
      manifest.name,
      dependencySpecs,
      options,
      new Set(),
      0
    );

    // Detect circular dependencies
    result.circular = this.detectCircularDependencies(dependencyTree);
    if (result.circular.length > 0 && options.strategy === 'strict') {
      result.success = false;
      result.conflicts.push(...result.circular.map(cycle => ({
        type: 'circular' as const,
        source: cycle[0],
        target: cycle[cycle.length - 1],
        requested: 'circular',
        resolution: {
          action: 'remove' as const,
          target: cycle[0],
          reason: 'Break circular dependency'
        }
      })));
    }

    // Resolve version constraints
    const constraintResolution = await this.resolveVersionConstraints(
      dependencyTree,
      options
    );

    result.resolved = constraintResolution.resolved;
    result.conflicts.push(...constraintResolution.conflicts);
    result.missing = constraintResolution.missing;

    // Create installation plan
    if (result.success && options.autoInstall) {
      result.installationPlan = this.createInstallationPlan(result.resolved);
    }

    // Generate warnings
    result.warnings = this.generateWarnings(result);

    result.success = result.conflicts.length === 0 && result.missing.length === 0;

    return result;
  }

  // Extract dependency specifications from manifest
  private extractDependencySpecs(manifest: PluginManifest): PluginDependencySpec[] {
    const specs: PluginDependencySpec[] = [];

    // Plugin dependencies
    if (manifest.reshell?.plugins) {
      Object.entries(manifest.reshell.plugins).forEach(([name, version]) => {
        specs.push({
          name,
          version: version as string,
          required: true,
          type: 'plugin'
        });
      });
    }

    // Regular dependencies
    if (manifest.dependencies) {
      Object.entries(manifest.dependencies).forEach(([name, version]) => {
        specs.push({
          name,
          version,
          required: true,
          type: 'npm'
        });
      });
    }

    // Peer dependencies
    if (manifest.peerDependencies) {
      Object.entries(manifest.peerDependencies).forEach(([name, version]) => {
        specs.push({
          name,
          version,
          required: false,
          type: 'peer'
        });
      });
    }

    return specs;
  }

  // Build dependency tree recursively
  private async buildDependencyTree(
    pluginName: string,
    specs: PluginDependencySpec[],
    options: ResolutionOptions,
    visited: Set<string>,
    depth: number
  ): Promise<Map<string, DependencyNode>> {
    const tree = new Map<string, DependencyNode>();

    if (depth > (options.maxDepth || 10)) {
      this.emit('resolution-warning', {
        type: 'max-depth',
        plugin: pluginName,
        depth
      });
      return tree;
    }

    if (visited.has(pluginName)) {
      return tree; // Avoid infinite recursion
    }

    visited.add(pluginName);

    // Create node for current plugin
    const node: DependencyNode = {
      name: pluginName,
      version: '1.0.0', // This would come from manifest
      dependencies: new Set(),
      dependents: new Set(),
      resolved: this.plugins.has(pluginName),
      depth,
      installation: this.plugins.get(pluginName)
    };

    tree.set(pluginName, node);

    // Process dependencies
    for (const spec of specs) {
      if (options.ignoreOptional && !spec.required) {
        continue;
      }

      node.dependencies.add(spec.name);

      // Get dependency manifest if it's a plugin
      if (spec.type === 'plugin' && this.plugins.has(spec.name)) {
        const depPlugin = this.plugins.get(spec.name)!;
        const depSpecs = this.extractDependencySpecs(depPlugin.manifest);
        
        // Recursively build tree for dependency
        const subTree = await this.buildDependencyTree(
          spec.name,
          depSpecs,
          options,
          new Set(visited),
          depth + 1
        );

        // Merge subtree
        subTree.forEach((subNode, subName) => {
          if (!tree.has(subName)) {
            tree.set(subName, subNode);
          }
          // Update dependents
          subNode.dependents.add(pluginName);
        });
      }
    }

    return tree;
  }

  // Detect circular dependencies
  private detectCircularDependencies(
    tree: Map<string, DependencyNode>
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);

      const nodeData = tree.get(node);
      if (nodeData) {
        nodeData.dependencies.forEach(dep => {
          dfs(dep, [...path, node]);
        });
      }

      recursionStack.delete(node);
    };

    tree.forEach((_, nodeName) => {
      if (!visited.has(nodeName)) {
        dfs(nodeName, []);
      }
    });

    return cycles;
  }

  // Resolve version constraints
  private async resolveVersionConstraints(
    tree: Map<string, DependencyNode>,
    options: ResolutionOptions
  ): Promise<{
    resolved: ResolvedDependency[];
    conflicts: DependencyConflict[];
    missing: string[];
  }> {
    const resolved: ResolvedDependency[] = [];
    const conflicts: DependencyConflict[] = [];
    const missing: string[] = [];

    // Collect all version constraints
    const constraints = new Map<string, VersionConstraint[]>();
    
    tree.forEach((node, name) => {
      node.dependencies.forEach(depName => {
        if (!constraints.has(depName)) {
          constraints.set(depName, []);
        }
        
        // This would normally come from the dependency specification
        constraints.get(depName)!.push({
          constraint: '^1.0.0', // Placeholder
          source: name,
          type: 'range'
        });
      });
    });

    // Resolve each dependency
    for (const [depName, depConstraints] of constraints.entries()) {
      const resolution = await this.resolveVersionConstraint(
        depName,
        depConstraints,
        options
      );

      if (resolution.success) {
        resolved.push(resolution.dependency);
      } else {
        if (resolution.missing) {
          missing.push(depName);
        }
        if (resolution.conflicts) {
          conflicts.push(...resolution.conflicts);
        }
      }
    }

    return { resolved, conflicts, missing };
  }

  // Resolve single version constraint
  private async resolveVersionConstraint(
    depName: string,
    constraints: VersionConstraint[],
    options: ResolutionOptions
  ): Promise<{
    success: boolean;
    dependency: ResolvedDependency;
    conflicts?: DependencyConflict[];
    missing?: boolean;
  }> {
    // Check if plugin is available
    const plugin = this.plugins.get(depName);
    if (!plugin) {
      return {
        success: false,
        dependency: {
          name: depName,
          version: 'unknown',
          required: true,
          type: 'plugin',
          resolved: false
        },
        missing: true
      };
    }

    // Get available versions
    const availableVersions = await this.getAvailableVersions(depName);
    
    // Find satisfying version
    const satisfyingVersion = this.findSatisfyingVersion(
      constraints,
      availableVersions,
      options
    );

    if (!satisfyingVersion) {
      return {
        success: false,
        dependency: {
          name: depName,
          version: 'unknown',
          required: true,
          type: 'plugin',
          resolved: false
        },
        conflicts: [{
          type: 'version',
          source: constraints[0].source,
          target: depName,
          requested: constraints[0].constraint,
          available: availableVersions[0],
          resolution: {
            action: 'upgrade',
            target: depName,
            version: availableVersions[0],
            reason: 'No version satisfies all constraints'
          }
        }]
      };
    }

    return {
      success: true,
      dependency: {
        name: depName,
        version: satisfyingVersion,
        required: true,
        type: 'plugin',
        resolved: true,
        resolvedVersion: satisfyingVersion,
        installation: plugin
      }
    };
  }

  // Find version that satisfies all constraints
  private findSatisfyingVersion(
    constraints: VersionConstraint[],
    availableVersions: string[],
    options: ResolutionOptions
  ): string | null {
    // Sort versions in descending order
    const sortedVersions = availableVersions
      .filter(v => semver.valid(v))
      .sort((a, b) => semver.rcompare(a, b));

    if (options.preferStable) {
      // Filter out prerelease versions unless explicitly allowed
      const stableVersions = sortedVersions.filter(v => 
        options.allowPrerelease || !semver.prerelease(v)
      );
      
      if (stableVersions.length > 0) {
        return this.findBestMatch(constraints, stableVersions, options);
      }
    }

    return this.findBestMatch(constraints, sortedVersions, options);
  }

  // Find best matching version
  private findBestMatch(
    constraints: VersionConstraint[],
    versions: string[],
    options: ResolutionOptions
  ): string | null {
    for (const version of versions) {
      if (this.satisfiesAllConstraints(version, constraints)) {
        return version;
      }
    }

    // If strict mode, return null
    if (options.strategy === 'strict') {
      return null;
    }

    // In loose mode, return the latest version
    return versions[0] || null;
  }

  // Check if version satisfies all constraints
  private satisfiesAllConstraints(
    version: string,
    constraints: VersionConstraint[]
  ): boolean {
    return constraints.every(constraint => {
      try {
        return semver.satisfies(version, constraint.constraint);
      } catch (error) {
        return false;
      }
    });
  }

  // Get available versions for a plugin
  private async getAvailableVersions(pluginName: string): Promise<string[]> {
    // Check cache
    if (this.versionCache.has(pluginName)) {
      return this.versionCache.get(pluginName)!;
    }

    // For now, return current version
    // In a real implementation, this would query npm/marketplace
    const plugin = this.plugins.get(pluginName);
    const versions = plugin ? [plugin.manifest.version] : [];
    
    this.versionCache.set(pluginName, versions);
    return versions;
  }

  // Create installation plan
  private createInstallationPlan(dependencies: ResolvedDependency[]): InstallationStep[] {
    const plan: InstallationStep[] = [];
    const processed = new Set<string>();

    // Topological sort for installation order
    const sorted = this.topologicalSort(dependencies);

    sorted.forEach((dep, index) => {
      if (!processed.has(dep.name)) {
        plan.push({
          action: 'install',
          plugin: dep.name,
          version: dep.resolvedVersion || dep.version,
          dependencies: [], // Would be filled with actual dependencies
          order: index,
          optional: !dep.required
        });
        processed.add(dep.name);
      }
    });

    return plan;
  }

  // Topological sort for dependencies
  private topologicalSort(dependencies: ResolvedDependency[]): ResolvedDependency[] {
    // Simple implementation - in practice would use dependency graph
    return [...dependencies].sort((a, b) => {
      // Required dependencies first
      if (a.required !== b.required) {
        return a.required ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  // Generate warnings
  private generateWarnings(result: ResolutionResult): string[] {
    const warnings: string[] = [];

    if (result.conflicts.length > 0) {
      warnings.push(`Found ${result.conflicts.length} dependency conflicts`);
    }

    if (result.missing.length > 0) {
      warnings.push(`Missing ${result.missing.length} required dependencies`);
    }

    if (result.circular.length > 0) {
      warnings.push(`Detected ${result.circular.length} circular dependencies`);
    }

    return warnings;
  }

  // Update dependency graph
  private updateDependencyGraph(registration: PluginRegistration): void {
    const specs = this.extractDependencySpecs(registration.manifest);
    
    const node: DependencyNode = {
      name: registration.manifest.name,
      version: registration.manifest.version,
      dependencies: new Set(specs.map(s => s.name)),
      dependents: new Set(),
      resolved: true,
      depth: 0,
      installation: registration
    };

    this.dependencyGraph.set(registration.manifest.name, node);
  }

  // Clear caches
  clearCache(): void {
    this.resolutionCache.clear();
    this.versionCache.clear();
    this.emit('cache-cleared');
  }

  // Get cache key for resolution result
  private getCacheKey(manifest: PluginManifest, options: ResolutionOptions): string {
    const dependencyHash = JSON.stringify({
      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,
      plugins: manifest.reshell?.plugins
    });
    
    const optionsHash = JSON.stringify(options);
    return `${manifest.name}_${manifest.version}_${dependencyHash}_${optionsHash}`;
  }

  // Get dependency statistics
  getStats(): any {
    return {
      totalPlugins: this.plugins.size,
      dependencyNodes: this.dependencyGraph.size,
      cacheSize: this.resolutionCache.size,
      versionCacheSize: this.versionCache.size
    };
  }

  // Get dependency graph
  getDependencyGraph(): Map<string, DependencyNode> {
    return new Map(this.dependencyGraph);
  }
}

// Utility functions
export function createDependencyResolver(
  options?: Partial<ResolutionOptions>
): PluginDependencyResolver {
  return new PluginDependencyResolver(options);
}

export function validateVersion(version: string): boolean {
  return semver.valid(version) !== null;
}

export function compareVersions(a: string, b: string): number {
  return semver.compare(a, b);
}

export function satisfiesConstraint(version: string, constraint: string): boolean {
  try {
    return semver.satisfies(version, constraint);
  } catch (error) {
    return false;
  }
}