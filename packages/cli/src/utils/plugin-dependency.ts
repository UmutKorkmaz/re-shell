

import { EventEmitter } from 'events';

import semver from 'semver';

import { PluginManifest, PluginRegistration } from './plugin-system';

/**
 * Specification of a single plugin dependency.
 * @description Describes a dependency requirement declared by a plugin manifest.
 */
export interface PluginDependencySpec {
  /** Name of the dependency package or plugin. */
  name: string;
  /** SemVer-compatible version or range string for the dependency. */
  version: string;
  /** Whether the dependency is mandatory (true) or optional (false). */
  required: boolean;
  /** The kind of dependency: a re-shell plugin, an npm package, or a peer dependency. */
  type: 'plugin' | 'npm' | 'peer';
  /** Optional source URL or registry where the dependency can be fetched. */
  source?: string;
  /** Optional scope name (e.g. an organization) that owns the dependency. */
  scope?: string;
}

/**
 * A dependency that has been processed by the resolver.
 * @description Extends {@link PluginDependencySpec} with the outcome of a resolution attempt.
 */
export interface ResolvedDependency extends PluginDependencySpec {
  /** Whether the dependency was successfully resolved. */
  resolved: boolean;
  /** The concrete version selected during resolution, if any. */
  resolvedVersion?: string;
  /** The registered plugin installation that satisfies this dependency, if any. */
  installation?: PluginRegistration;
  /** List of conflicts detected while resolving this dependency. */
  conflicts?: DependencyConflict[];
  /** Error encountered during resolution, if resolution failed. */
  error?: Error;
}

/**
 * Information about a dependency conflict encountered during resolution.
 * @description Describes a mismatch between requested and available dependency state.
 */
export interface DependencyConflict {
  /** The category of conflict: a version mismatch, a missing dependency, a circular reference, or general incompatibility. */
  type: 'version' | 'missing' | 'circular' | 'incompatible';
  /** Name of the plugin or package that declares the conflicting requirement. */
  source: string;
  /** Name of the dependency that is the subject of the conflict. */
  target: string;
  /** The version or constraint originally requested by the source. */
  requested: string;
  /** The version actually available, when applicable. */
  available?: string;
  /** Suggested resolution for the conflict, if one is available. */
  resolution?: ConflictResolution;
}

/**
 * Proposed resolution for a dependency conflict.
 * @description Describes the action needed to resolve a {@link DependencyConflict}.
 */
export interface ConflictResolution {
  /** The kind of action to take: upgrade, downgrade, install, remove, or ignore. */
  action: 'upgrade' | 'downgrade' | 'install' | 'remove' | 'ignore';
  /** Name of the plugin or package that the action targets. */
  target: string;
  /** Version to install or change to, when applicable. */
  version?: string;
  /** Human-readable explanation of why this resolution was chosen. */
  reason: string;
}

/**
 * A node in the dependency graph.
 * @description Represents a single plugin or package within the resolver's dependency graph.
 */
export interface DependencyNode {
  /** Name of the plugin or package represented by this node. */
  name: string;
  /** Version of the plugin or package. */
  version: string;
  /** Set of names this node depends on. */
  dependencies: Set<string>;
  /** Set of names that depend on this node. */
  dependents: Set<string>;
  /** Whether this node has been successfully resolved. */
  resolved: boolean;
  /** Depth of this node in the dependency tree (0 for roots). */
  depth: number;
  /** The registered plugin installation associated with this node, if any. */
  installation?: PluginRegistration;
}

/**
 * A version constraint placed on a dependency.
 * @description Describes how a particular consumer requires a dependency's version.
 */
export interface VersionConstraint {
  /** The SemVer constraint expression (e.g. `^1.2.0`, `~2.0.0`, `latest`). */
  constraint: string;
  /** Name of the plugin or package that declared this constraint. */
  source: string;
  /** The kind of constraint: an exact version, a range, the latest available, or a compatibility range. */
  type: 'exact' | 'range' | 'latest' | 'compatible';
}

/**
 * Options controlling how dependency resolution is performed.
 * @description Configures the behavior of {@link PluginDependencyResolver.resolveDependencies}.
 */
export interface ResolutionOptions {
  /** Whether prerelease versions are allowed during resolution. Defaults to false. */
  allowPrerelease?: boolean;
  /** Whether stable versions are preferred over prereleases. Defaults to true. */
  preferStable?: boolean;
  /** Whether optional dependencies should be skipped. Defaults to false. */
  ignoreOptional?: boolean;
  /** Maximum depth to traverse when building the dependency tree. Defaults to 10. */
  maxDepth?: number;
  /** Timeout in milliseconds for resolution operations. Defaults to 30000. */
  timeout?: number;
  /** Resolution strategy: strict (fail on conflicts), loose (best-effort), or latest (always pick newest). */
  strategy?: 'strict' | 'loose' | 'latest';
  /** Whether to allow resolutions that contain conflicts. Defaults to false. */
  allowConflicts?: boolean;
  /** Whether to generate an installation plan automatically on success. Defaults to false. */
  autoInstall?: boolean;
}

/**
 * The outcome of a dependency resolution run.
 * @description Returned by {@link PluginDependencyResolver.resolveDependencies} summarizing results.
 */
export interface ResolutionResult {
  /** List of dependencies that were successfully resolved. */
  resolved: ResolvedDependency[];
  /** List of conflicts detected during resolution. */
  conflicts: DependencyConflict[];
  /** Names of required dependencies that could not be found. */
  missing: string[];
  /** List of circular dependency chains, each represented as an array of plugin names. */
  circular: string[][];
  /** Ordered steps to install or update the resolved dependencies, when requested. */
  installationPlan: InstallationStep[];
  /** Whether the overall resolution succeeded (no conflicts and no missing dependencies). */
  success: boolean;
  /** Human-readable warning messages produced during resolution. */
  warnings: string[];
}

/**
 * A single step within a dependency installation plan.
 * @description Describes one action to perform when installing or updating resolved plugins.
 */
export interface InstallationStep {
  /** The action to perform: install a new plugin, upgrade, downgrade, or remove. */
  action: 'install' | 'upgrade' | 'downgrade' | 'remove';
  /** Name of the plugin targeted by this step. */
  plugin: string;
  /** Version involved in the action. */
  version: string;
  /** Names of dependencies that must be handled alongside this step. */
  dependencies: string[];
  /** Position of this step in the overall installation sequence (0-based). */
  order: number;
  /** Whether this step is optional (e.g. an optional dependency). */
  optional: boolean;
}

/**
 * Resolves plugin dependencies, detects conflicts, and builds installation plans.
 * @description Maintains a dependency graph and caches resolution results, emitting
 * events for key lifecycle moments (registration, resolution start/complete/fail, cache hits).
 */
export class PluginDependencyResolver extends EventEmitter {
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private versionCache: Map<string, string[]> = new Map();
  private resolutionCache: Map<string, ResolutionResult> = new Map();
  private plugins: Map<string, PluginRegistration> = new Map();
  
  /**
   * Creates a new PluginDependencyResolver.
   * @description Initializes internal caches and merges the provided options with defaults.
   * @param options - Partial resolution options overriding the defaults.
   */
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

  /**
   * Registers a plugin so it can participate in dependency resolution.
   * @description Adds the plugin to the internal registry and updates the dependency graph.
   * @param registration - The plugin registration to add.
   * @returns void
   * @emits plugin-registered
   */
  registerPlugin(registration: PluginRegistration): void {
    this.plugins.set(registration.manifest.name, registration);
    this.updateDependencyGraph(registration);
    this.emit('plugin-registered', registration.manifest.name);
  }

  /**
   * Removes a previously registered plugin from the resolver.
   * @description Deletes the plugin from the registry and dependency graph, then clears caches.
   * @param name - Name of the plugin to unregister.
   * @returns void
   * @emits plugin-unregistered
   */
  unregisterPlugin(name: string): void {
    this.plugins.delete(name);
    this.dependencyGraph.delete(name);
    this.clearCache();
    this.emit('plugin-unregistered', name);
  }

  /**
   * Resolves all dependencies for the given plugin manifest.
   * @description Uses cached results when available; otherwise performs a full resolution.
   * @param manifest - The plugin manifest whose dependencies should be resolved.
   * @param options - Optional overrides merged with the resolver's default options.
   * @returns A {@link ResolutionResult} describing the resolved dependencies, conflicts, and plan.
   * @throws When the underlying resolution encounters an unrecoverable error.
   * @emits resolution-cache-hit when a cached result is used.
   * @emits resolution-started when resolution begins.
   * @emits resolution-completed when resolution finishes successfully.
   * @emits resolution-failed when resolution throws.
   */
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

  /**
   * Performs the full dependency resolution for a manifest.
   * @description Extracts specs, builds the dependency tree, detects cycles, resolves
   * version constraints, optionally creates an installation plan, and generates warnings.
   * @param manifest - The plugin manifest to resolve.
   * @param options - The fully merged resolution options.
   * @returns The complete resolution result.
   */
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

  /**
   * Extracts dependency specifications from a plugin manifest.
   * @description Reads re-shell plugin dependencies, npm dependencies, and peer dependencies
   * into a unified list of {@link PluginDependencySpec} objects.
   * @param manifest - The manifest to extract specifications from.
   * @returns An array of dependency specifications.
   */
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

  /**
   * Recursively builds a dependency tree starting from the given plugin.
   * @description Traverses the dependency specs, creating nodes and merging sub-trees
   * for plugin-type dependencies. Respects max depth and visited sets to avoid infinite recursion.
   * @param pluginName - Name of the plugin currently being processed.
   * @param specs - Dependency specifications declared by the plugin.
   * @param options - Resolution options controlling traversal behavior.
   * @param visited - Set of plugin names already visited on the current path.
   * @param depth - Current depth in the dependency tree.
   * @returns A map of dependency name to {@link DependencyNode}.
   * @emits resolution-warning when the maximum depth is exceeded.
   */
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

  /**
   * Detects circular dependencies within the dependency tree.
   * @description Uses a depth-first search with a recursion stack to identify cycles.
   * @param tree - The dependency tree to analyze.
   * @returns An array of cycles, each represented as a list of plugin names forming the cycle.
   */
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

  /**
   * Resolves version constraints for all nodes in the dependency tree.
   * @description Collects constraints per dependency and delegates to
   * {@link PluginDependencyResolver.resolveVersionConstraint} for each.
   * @param tree - The dependency tree to resolve constraints for.
   * @param options - Resolution options.
   * @returns An object containing resolved dependencies, conflicts, and missing names.
   */
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

  /**
   * Resolves a single dependency against a set of version constraints.
   * @description Checks plugin availability, retrieves available versions, and attempts
   * to find a satisfying version. Returns conflict information when resolution fails.
   * @param depName - Name of the dependency to resolve.
   * @param constraints - Version constraints placed on the dependency.
   * @param options - Resolution options.
   * @returns An object indicating success, the resolved dependency, and optional conflicts/missing flag.
   */
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

  /**
   * Finds the best available version that satisfies the given constraints.
   * @description Sorts available versions descending, optionally filters to stable releases,
   * and delegates final selection to {@link PluginDependencyResolver.findBestMatch}.
   * @param constraints - Version constraints to satisfy.
   * @param availableVersions - Versions available for selection.
   * @param options - Resolution options.
   * @returns The best matching version, or null if none found.
   */
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

  /**
   * Finds the first version that satisfies all constraints.
   * @description Iterates versions in order; in strict strategy returns null when no match
   * exists, while in loose/latest strategies falls back to the first (newest) version.
   * @param constraints - Version constraints to satisfy.
   * @param versions - Candidate versions, ordered by preference.
   * @param options - Resolution options controlling fallback behavior.
   * @returns The matching version, or null.
   */
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

  /**
   * Checks whether a version satisfies every provided constraint.
   * @description Uses semver to evaluate each constraint; invalid constraints are treated as unsatisfied.
   * @param version - The version to test.
   * @param constraints - The constraints to check against.
   * @returns True when the version satisfies all constraints, false otherwise.
   */
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

  /**
   * Retrieves the available versions for a plugin.
   * @description Returns cached versions when present; otherwise derives versions from the
   * registered plugin manifest and caches the result.
   * @param pluginName - Name of the plugin to query.
   * @returns An array of available version strings (may be empty).
   */
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

  /**
   * Creates an ordered installation plan from resolved dependencies.
   * @description Performs a topological sort and emits one {@link InstallationStep} per dependency.
   * @param dependencies - Resolved dependencies to include in the plan.
   * @returns An array of installation steps in execution order.
   */
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

  /**
   * Sorts dependencies into an installation-friendly order.
   * @description Places required dependencies before optional ones and sorts alphabetically within each group.
   * @param dependencies - Dependencies to sort.
   * @returns A new array of dependencies in sorted order.
   */
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

  /**
   * Generates human-readable warning messages from a resolution result.
   * @description Summarizes counts of conflicts, missing dependencies, and circular references.
   * @param result - The resolution result to inspect.
   * @returns An array of warning strings.
   */
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

  /**
   * Updates the dependency graph with a newly registered plugin.
   * @description Extracts specs from the registration and inserts a node into the graph.
   * @param registration - The plugin registration to incorporate.
   * @returns void
   */
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

  /**
   * Clears all cached resolution and version data.
   * @description Removes cached resolution results and version lookups.
   * @returns void
   * @emits cache-cleared
   */
  clearCache(): void {
    this.resolutionCache.clear();
    this.versionCache.clear();
    this.emit('cache-cleared');
  }

  /**
   * Builds a cache key for a resolution request.
   * @description Combines the manifest identity, dependency declarations, and options into a unique key.
   * @param manifest - The plugin manifest being resolved.
   * @param options - The resolution options in effect.
   * @returns A string cache key.
   */
  private getCacheKey(manifest: PluginManifest, options: ResolutionOptions): string {
    const dependencyHash = JSON.stringify({
      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,
      plugins: manifest.reshell?.plugins
    });
    
    const optionsHash = JSON.stringify(options);
    return `${manifest.name}_${manifest.version}_${dependencyHash}_${optionsHash}`;
  }

  /**
   * Returns summary statistics about the resolver's internal state.
   * @description Counts registered plugins, dependency nodes, and cache entries.
   * @returns An object containing totalPlugins, dependencyNodes, cacheSize, and versionCacheSize.
   */
  getStats(): any {
    return {
      totalPlugins: this.plugins.size,
      dependencyNodes: this.dependencyGraph.size,
      cacheSize: this.resolutionCache.size,
      versionCacheSize: this.versionCache.size
    };
  }

  /**
   * Returns a copy of the current dependency graph.
   * @description Provides a snapshot mapping plugin names to their {@link DependencyNode}.
   * @returns A new Map containing the graph entries.
   */
  getDependencyGraph(): Map<string, DependencyNode> {
    return new Map(this.dependencyGraph);
  }
}

/**
 * Factory that creates a new PluginDependencyResolver instance.
 * @description Convenience wrapper around the {@link PluginDependencyResolver} constructor.
 * @param options - Optional partial resolution options to apply.
 * @returns A configured PluginDependencyResolver.
 */
export function createDependencyResolver(
  options?: Partial<ResolutionOptions>
): PluginDependencyResolver {
  return new PluginDependencyResolver(options);
}

/**
 * Validates whether a version string is a well-formed semantic version.
 * @description Uses semver to parse the input.
 * @param version - The version string to validate.
 * @returns True when the version is valid, false otherwise.
 */
export function validateVersion(version: string): boolean {
  return semver.valid(version) !== null;
}

/**
 * Compares two semantic version strings.
 * @description Delegates to semver.compare for ordering.
 * @param a - The first version to compare.
 * @param b - The second version to compare.
 * @returns -1 if a < b, 0 if a == b, or 1 if a > b.
 */
export function compareVersions(a: string, b: string): number {
  return semver.compare(a, b);
}

/**
 * Checks whether a version satisfies a semver constraint.
 * @description Wraps semver.satisfies and returns false on invalid input instead of throwing.
 * @param version - The version to test.
 * @param constraint - The semver constraint expression (e.g. `^1.0.0`).
 * @returns True when the version satisfies the constraint, false otherwise.
 */
export function satisfiesConstraint(version: string, constraint: string): boolean {
  try {
    return semver.satisfies(version, constraint);
  } catch (error) {
    return false;
  }
}