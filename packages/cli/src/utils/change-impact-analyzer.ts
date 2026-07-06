import * as fs from 'fs-extra';
import * as path from 'path';
import { ValidationError } from './error-handler';
import { ChangeDetector} from './change-detector';
import { RECOGNIZED_PKG_SCOPES } from './scope';

/**
 * Describes a single workspace discovered in the monorepo.
 */
export interface WorkspaceInfo {
  /** The workspace name, typically derived from its directory name. */
  name: string;
  /** Absolute filesystem path to the workspace root. */
  path: string;
  /** Category of the workspace, inferred from the parent directory. */
  type: 'app' | 'package' | 'lib' | 'tool';
  /** List of internal workspace dependency names from the `dependencies` map. */
  dependencies: string[];
  /** List of internal workspace dependency names from the `devDependencies` map. */
  devDependencies: string[];
  /** Detected frontend framework, if any (e.g. `react`, `vue`). */
  framework?: string;
  /** The `build` script defined in the workspace package.json, if present. */
  buildScript?: string;
  /** The `test` script defined in the workspace package.json, if present. */
  testScript?: string;
}

/**
 * Result returned from analyzing the impact of file changes across workspaces.
 */
export interface ImpactAnalysisResult {
  /** The list of files that were considered changed. */
  changedFiles: string[];
  /** Workspaces that are affected by the changed files. */
  affectedWorkspaces: WorkspaceInfo[];
  /** Workspace names ordered for an optimal build sequence. */
  buildOrder: string[];
  /** Workspace names ordered for an optimal test sequence. */
  testOrder: string[];
  /** Total number of impacted workspaces. */
  totalImpact: number;
  /** Critical dependency chain most relevant to the changes. */
  criticalPath: string[];
  /** Human-readable recommendations for handling the changes. */
  recommendations: string[];
  /** Total analysis duration in milliseconds. */
  analysisTime: number;
}

/**
 * Options that control how the {@link ChangeImpactAnalyzer} performs its analysis.
 */
export interface ChangeImpactOptions {
  /** Maximum traversal depth when walking the dependency graph. */
  maxDepth: number;
  /** Whether test ordering and test-aware recommendations should be included. */
  includeTests: boolean;
  /** Whether dev dependencies should be treated as edges in the dependency graph. */
  includeDevDependencies: boolean;
  /** Whether build order optimizations should be applied. */
  buildOptimization: boolean;
  /** Whether parallel analysis is enabled. */
  parallelAnalysis: boolean;
}

/**
 * Represents the internal dependency graph used by the analyzer.
 */
export interface DependencyGraph {
  /** Map of workspace name to its {@link WorkspaceInfo}. */
  nodes: Map<string, WorkspaceInfo>;
  /** Map of workspace name to the list of workspaces it depends on. */
  edges: Map<string, string[]>;
  /** Map of workspace name to the list of workspaces that depend on it. */
  reverseEdges: Map<string, string[]>;
}

/**
 * A rule that maps a file path pattern to its impact on workspaces.
 */
export interface ImpactRule {
  /** Regular expression tested against changed file paths. */
  pattern: RegExp;
  /** List of workspace names affected when the pattern matches. A wildcard entry affects all workspaces. */
  affects: string[];
  /** Severity level assigned when this rule matches. */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Suggested action to take when the rule matches. */
  action: 'rebuild' | 'test' | 'lint' | 'deploy';
  /** Human-readable description of what the rule represents. */
  description: string;
}

/**
 * Analyzes the impact of file changes across a monorepo's workspace dependencies.
 *
 * The analyzer builds an internal dependency graph of discovered workspaces and
 * applies configurable impact rules to determine which workspaces, build orders,
 * and critical paths are affected by a set of changed files.
 */
// Change impact analyzer for workspace dependencies
export class ChangeImpactAnalyzer {
  private rootPath: string;
  private dependencyGraph: DependencyGraph;
  private changeDetector: ChangeDetector;
  private impactRules: ImpactRule[];
  private options: ChangeImpactOptions;

  /**
   * Creates a new analyzer for the given monorepo root.
   *
   * @param rootPath - Path to the monorepo root directory.
   * @param options - Optional partial overrides for {@link ChangeImpactOptions}.
   *   Missing values are filled in with defaults.
   */
  constructor(rootPath: string, options: Partial<ChangeImpactOptions> = {}) {
    this.rootPath = path.resolve(rootPath);
    this.dependencyGraph = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map()
    };
    this.changeDetector = new ChangeDetector(rootPath);
    this.impactRules = this.getDefaultImpactRules();
    this.options = {
      maxDepth: 10,
      includeTests: true,
      includeDevDependencies: false,
      buildOptimization: true,
      parallelAnalysis: true,
      ...options
    };
  }

  /**
   * Initializes the analyzer by preparing the change detector and building the
   * workspace dependency graph. Must be called before performing analysis.
   *
   * @returns A promise that resolves once initialization is complete.
   */
  // Initialize the analyzer
  async initialize(): Promise<void> {
    await this.changeDetector.initialize();
    await this.buildDependencyGraph();
  }

  /**
   * Analyzes the impact of the given changed files across all workspaces.
   *
   * If `changedFiles` is omitted, the change detector is queried for the current
   * set of added and modified files.
   *
   * @param changedFiles - Optional explicit list of changed file paths.
   * @returns A promise resolving to an {@link ImpactAnalysisResult} describing
   *   affected workspaces, build/test order, critical path, and recommendations.
   */
  // Analyze impact of file changes across workspace dependencies
  async analyzeChangeImpact(changedFiles?: string[]): Promise<ImpactAnalysisResult> {
    const startTime = Date.now();

    // Get changed files if not provided
    let files = changedFiles;
    if (!files) {
      const changeResult = await this.changeDetector.detectChanges();
      files = [...changeResult.added, ...changeResult.modified];
    }

    if (files.length === 0) {
      return {
        changedFiles: [],
        affectedWorkspaces: [],
        buildOrder: [],
        testOrder: [],
        totalImpact: 0,
        criticalPath: [],
        recommendations: ['No changes detected'],
        analysisTime: Date.now() - startTime
      };
    }

    // Analyze impact for each changed file
    const impactedWorkspaces = new Set<string>();
    const criticalChanges: string[] = [];
    
    for (const file of files) {
      const impact = await this.analyzeFileImpact(file);
      impact.workspaces.forEach(ws => impactedWorkspaces.add(ws));
      
      if (impact.severity === 'critical') {
        criticalChanges.push(file);
      }
    }

    // Get affected workspace info
    const affectedWorkspaces = Array.from(impactedWorkspaces)
      .map(name => this.dependencyGraph.nodes.get(name))
      .filter(ws => ws !== undefined) as WorkspaceInfo[];

    // Calculate build and test order
    const buildOrder = this.calculateBuildOrder(Array.from(impactedWorkspaces));
    const testOrder = this.calculateTestOrder(Array.from(impactedWorkspaces));

    // Find critical path
    const criticalPath = this.findCriticalPath(Array.from(impactedWorkspaces));

    // Generate recommendations
    const recommendations = this.generateRecommendations(files, affectedWorkspaces, criticalChanges);

    const analysisTime = Date.now() - startTime;

    return {
      changedFiles: files,
      affectedWorkspaces,
      buildOrder,
      testOrder,
      totalImpact: impactedWorkspaces.size,
      criticalPath,
      recommendations,
      analysisTime
    };
  }

  /**
   * Analyzes the impact of a single changed file.
   *
   * Determines which workspace owns the file, applies all matching impact rules,
   * and resolves the transitive set of dependent workspaces.
   *
   * @param filePath - Path of the changed file to analyze.
   * @returns A promise resolving to an object containing the affected workspace
   *   names, the highest matching severity, and the list of matched rules.
   */
  // Analyze impact of a specific file change
  async analyzeFileImpact(filePath: string): Promise<{
    file: string;
    workspaces: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    rules: ImpactRule[];
  }> {
    const workspaces = new Set<string>();
    const matchedRules: ImpactRule[] = [];
    let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Find which workspace the file belongs to
    const ownerWorkspace = this.findFileOwnerWorkspace(filePath);
    if (ownerWorkspace) {
      workspaces.add(ownerWorkspace);
    }

    // Apply impact rules
    for (const rule of this.impactRules) {
      if (rule.pattern.test(filePath)) {
        matchedRules.push(rule);
        rule.affects.forEach(ws => workspaces.add(ws));
        
        // Update severity
        if (this.severityLevel(rule.severity) > this.severityLevel(maxSeverity)) {
          maxSeverity = rule.severity;
        }
      }
    }

    // Analyze dependency impact
    if (ownerWorkspace) {
      const dependentWorkspaces = this.findDependentWorkspaces(ownerWorkspace);
      dependentWorkspaces.forEach(ws => workspaces.add(ws));
    }

    return {
      file: filePath,
      workspaces: Array.from(workspaces),
      severity: maxSeverity,
      rules: matchedRules
    };
  }

  /**
   * Builds visualization-ready data representing the dependency graph and the
   * workspaces affected by the given changed files.
   *
   * @param changedFiles - List of changed file paths to analyze.
   * @returns A promise resolving to nodes, edges, and a legend describing the
   *   graph for rendering purposes.
   */
  // Get impact visualization data
  async getImpactVisualization(changedFiles: string[]): Promise<{
    nodes: Array<{ id: string; label: string; type: string; affected: boolean }>;
    edges: Array<{ from: string; to: string; type: string }>;
    legend: Record<string, string>;
  }> {
    const impact = await this.analyzeChangeImpact(changedFiles);
    const affectedNames = new Set(impact.affectedWorkspaces.map(ws => ws.name));

    const nodes = Array.from(this.dependencyGraph.nodes.values()).map(ws => ({
      id: ws.name,
      label: ws.name,
      type: ws.type,
      affected: affectedNames.has(ws.name)
    }));

    const edges: Array<{ from: string; to: string; type: string }> = [];
    for (const [from, targets] of this.dependencyGraph.edges) {
      for (const to of targets) {
        edges.push({ from, to, type: 'dependency' });
      }
    }

    const legend = {
      app: 'Application',
      package: 'NPM Package',
      lib: 'Library',
      tool: 'Tool/Script',
      dependency: 'Depends on'
    };

    return { nodes, edges, legend };
  }

  /**
   * Builds the workspace dependency graph by discovering workspaces and
   * populating forward and reverse edges based on their dependencies.
   *
   * @returns A promise that resolves once the graph has been built.
   */
  // Build workspace dependency graph
  private async buildDependencyGraph(): Promise<void> {
    const workspaces = await this.discoverWorkspaces();
    
    // Add nodes
    for (const workspace of workspaces) {
      this.dependencyGraph.nodes.set(workspace.name, workspace);
      this.dependencyGraph.edges.set(workspace.name, []);
      this.dependencyGraph.reverseEdges.set(workspace.name, []);
    }

    // Add edges based on dependencies
    for (const workspace of workspaces) {
      const deps = this.options.includeDevDependencies 
        ? [...workspace.dependencies, ...workspace.devDependencies]
        : workspace.dependencies;

      for (const dep of deps) {
        if (this.dependencyGraph.nodes.has(dep)) {
          // Add edge: workspace depends on dep
          this.dependencyGraph.edges.get(workspace.name)!.push(dep);
          this.dependencyGraph.reverseEdges.get(dep)!.push(workspace.name);
        }
      }
    }
  }

  /**
   * Discovers all workspaces under the conventional monorepo directories
   * (`apps`, `packages`, `libs`, `tools`) by reading each workspace's
   * `package.json`.
   *
   * @returns A promise resolving to the list of discovered {@link WorkspaceInfo}.
   */
  // Discover all workspaces in the monorepo
  private async discoverWorkspaces(): Promise<WorkspaceInfo[]> {
    const workspaces: WorkspaceInfo[] = [];
    const workspaceDirs = ['apps', 'packages', 'libs', 'tools'];

    for (const dir of workspaceDirs) {
      const dirPath = path.join(this.rootPath, dir);
      if (await fs.pathExists(dirPath)) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const workspacePath = path.join(dirPath, entry.name);
            const packageJsonPath = path.join(workspacePath, 'package.json');
            
            if (await fs.pathExists(packageJsonPath)) {
              try {
                const packageJson = await fs.readJson(packageJsonPath);
                const workspace: WorkspaceInfo = {
                  name: entry.name,
                  path: workspacePath,
                  type: this.inferWorkspaceType(dir),
                  dependencies: this.extractWorkspaceDependencies(packageJson.dependencies || {}),
                  devDependencies: this.extractWorkspaceDependencies(packageJson.devDependencies || {}),
                  framework: this.detectFramework(packageJson),
                  buildScript: packageJson.scripts?.build,
                  testScript: packageJson.scripts?.test
                };
                workspaces.push(workspace);
              } catch (error) {
                console.warn(`Failed to read package.json for ${entry.name}: ${error}`);
              }
            }
          }
        }
      }
    }

    return workspaces;
  }

  /**
   * Filters a dependencies map, keeping only entries that refer to known
   * internal workspaces or recognized package scopes.
   *
   * @param deps - Raw dependency name-to-version mapping from package.json.
   * @returns The list of dependency names considered internal.
   */
  // Extract workspace dependencies (filter out external packages)
  private extractWorkspaceDependencies(deps: Record<string, string>): string[] {
    return Object.keys(deps).filter(dep => {
      // Check if it's a workspace dependency (starts with workspace name pattern)
      // Accept the '@re-shell/' scope
      return this.dependencyGraph.nodes.has(dep) || RECOGNIZED_PKG_SCOPES.some((scope) => dep.startsWith(scope));
    });
  }

  /**
   * Maps a parent directory name to the corresponding workspace type.
   *
   * @param dir - Parent directory name (e.g. `apps`, `packages`).
   * @returns The inferred workspace type, defaulting to `package`.
   */
  // Infer workspace type from directory
  private inferWorkspaceType(dir: string): 'app' | 'package' | 'lib' | 'tool' {
    switch (dir) {
      case 'apps': return 'app';
      case 'packages': return 'package';
      case 'libs': return 'lib';
      case 'tools': return 'tool';
      default: return 'package';
    }
  }

  /**
   * Inspects a workspace's package.json dependencies to detect a known
   * frontend framework.
   *
   * @param packageJson - Parsed contents of a workspace package.json.
   * @returns The detected framework name, or `undefined` if none is recognized.
   */
  // Detect framework from package.json
  private detectFramework(packageJson: any): string | undefined {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.svelte) return 'svelte';
    if (deps['@angular/core']) return 'angular';
    
    return undefined;
  }

  /**
   * Finds the name of the workspace that owns the given file path.
   *
   * @param filePath - File path to resolve against the monorepo root.
   * @returns The owning workspace name, or `undefined` if none matches.
   */
  // Find which workspace owns a file
  private findFileOwnerWorkspace(filePath: string): string | undefined {
    const absolutePath = path.resolve(this.rootPath, filePath);
    
    for (const [name, workspace] of this.dependencyGraph.nodes) {
      if (absolutePath.startsWith(workspace.path)) {
        return name;
      }
    }
    
    return undefined;
  }

  /**
   * Returns the workspaces that directly depend on the given workspace.
   *
   * @param workspaceName - Name of the dependency workspace.
   * @returns List of workspace names that depend on `workspaceName`.
   */
  // Find workspaces that depend on a given workspace
  private findDependentWorkspaces(workspaceName: string): string[] {
    return this.dependencyGraph.reverseEdges.get(workspaceName) || [];
  }

  /**
   * Computes an optimal build order for the given workspaces using a
   * topological sort over the dependency graph.
   *
   * @param workspaces - Workspace names to include in the ordering.
   * @returns Workspace names ordered so dependencies appear before dependents.
   * @throws {ValidationError} If a circular dependency is detected.
   */
  // Calculate optimal build order using topological sort
  private calculateBuildOrder(workspaces: string[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (workspace: string) => {
      if (visiting.has(workspace)) {
        throw new ValidationError(`Circular dependency detected involving ${workspace}`);
      }
      if (visited.has(workspace)) {
        return;
      }

      visiting.add(workspace);
      
      // Visit dependencies first
      const deps = this.dependencyGraph.edges.get(workspace) || [];
      for (const dep of deps) {
        if (workspaces.includes(dep)) {
          visit(dep);
        }
      }

      visiting.delete(workspace);
      visited.add(workspace);
      result.push(workspace);
    };

    for (const workspace of workspaces) {
      if (!visited.has(workspace)) {
        visit(workspace);
      }
    }

    return result;
  }

  /**
   * Computes the recommended test order for the given workspaces.
   *
   * When tests are enabled, the order matches the build order so dependencies
   * are tested first; otherwise the reverse is returned.
   *
   * @param workspaces - Workspace names to include in the ordering.
   * @returns Workspace names in the recommended test order.
   */
  // Calculate test order (reverse of build order for most cases)
  private calculateTestOrder(workspaces: string[]): string[] {
    const buildOrder = this.calculateBuildOrder(workspaces);
    
    // For testing, we usually want to test dependencies first, then dependents
    // But for integration tests, we might want the reverse
    return this.options.includeTests ? buildOrder : buildOrder.reverse();
  }

  /**
   * Identifies the critical dependency chain among the impacted workspaces by
   * selecting the workspace with the most dependents and following its
   * dependency chain.
   *
   * @param workspaces - Impacted workspace names.
   * @returns Ordered list of workspace names forming the critical path.
   */
  // Find critical path in dependency graph
  private findCriticalPath(workspaces: string[]): string[] {
    // Find the workspace with the most dependents
    let maxDependents = 0;
    let criticalWorkspace = '';

    for (const workspace of workspaces) {
      const dependents = this.findDependentWorkspaces(workspace);
      if (dependents.length > maxDependents) {
        maxDependents = dependents.length;
        criticalWorkspace = workspace;
      }
    }

    if (!criticalWorkspace) {
      return workspaces.slice(0, 1); // Return first workspace if no clear critical path
    }

    // Build path from critical workspace
    const path: string[] = [criticalWorkspace];
    const visited = new Set([criticalWorkspace]);

    // Follow dependency chain
    let current = criticalWorkspace;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const deps = this.dependencyGraph.edges.get(current) || [];
      const nextDep = deps.find(dep => workspaces.includes(dep) && !visited.has(dep));

      if (!nextDep) break;

      path.unshift(nextDep); // Add to beginning to maintain dependency order
      visited.add(nextDep);
      current = nextDep;
    }

    return path;
  }

  /**
   * Produces actionable, human-readable recommendations based on the changed
   * files, affected workspaces, and critical changes.
   *
   * @param changedFiles - List of changed file paths.
   * @param affectedWorkspaces - Workspaces impacted by the changes.
   * @param criticalChanges - Files whose changes were classified as critical.
   * @returns List of recommendation strings.
   */
  // Generate actionable recommendations
  private generateRecommendations(changedFiles: string[], affectedWorkspaces: WorkspaceInfo[], criticalChanges: string[]): string[] {
    const recommendations: string[] = [];

    if (changedFiles.length === 0) {
      recommendations.push('No changes detected - no action required');
      return recommendations;
    }

    if (affectedWorkspaces.length === 0) {
      recommendations.push('Changes detected but no workspace impact - verify file locations');
      return recommendations;
    }

    // Critical changes
    if (criticalChanges.length > 0) {
      recommendations.push(`🚨 Critical changes detected in ${criticalChanges.length} files - full rebuild recommended`);
    }

    // Build recommendations
    const appsAffected = affectedWorkspaces.filter(ws => ws.type === 'app').length;
    const packagesAffected = affectedWorkspaces.filter(ws => ws.type === 'package').length;

    if (packagesAffected > 0) {
      recommendations.push(`📦 ${packagesAffected} package(s) affected - rebuild and test packages first`);
    }

    if (appsAffected > 0) {
      recommendations.push(`🔧 ${appsAffected} app(s) affected - rebuild applications after packages`);
    }

    // Performance recommendations
    if (affectedWorkspaces.length > 5) {
      recommendations.push('⚡ Consider parallel builds for better performance with many affected workspaces');
    }

    // Test recommendations
    if (this.options.includeTests) {
      const hasTests = affectedWorkspaces.some(ws => ws.testScript);
      if (hasTests) {
        recommendations.push('🧪 Run tests in dependency order to catch issues early');
      }
    }

    // Framework-specific recommendations
    const frameworks = new Set(affectedWorkspaces.map(ws => ws.framework).filter(Boolean));
    if (frameworks.size > 1) {
      recommendations.push('🔄 Multiple frameworks affected - consider framework-specific optimization');
    }

    return recommendations;
  }

  /**
   * Returns the default set of impact rules used when no custom rules are
   * provided. The rules cover package.json, TypeScript and bundler config
   * files, shared package and library sources, application sources, test
   * files, and documentation.
   *
   * @returns The default list of {@link ImpactRule}.
   */
  // Get default impact rules
  private getDefaultImpactRules(): ImpactRule[] {
    return [
      {
        pattern: /package\.json$/,
        affects: ['*'],
        severity: 'critical',
        action: 'rebuild',
        description: 'Package.json changes affect all workspaces'
      },
      {
        pattern: /tsconfig.*\.json$/,
        affects: ['*'],
        severity: 'high',
        action: 'rebuild',
        description: 'TypeScript configuration changes require rebuild'
      },
      {
        pattern: /\.config\.(js|ts)$/,
        affects: ['*'],
        severity: 'high',
        action: 'rebuild',
        description: 'Configuration file changes require rebuild'
      },
      {
        pattern: /packages\/.*\/src\//,
        affects: ['*'],
        severity: 'high',
        action: 'rebuild',
        description: 'Shared package changes affect all consumers'
      },
      {
        pattern: /libs\/.*\/src\//,
        affects: ['*'],
        severity: 'medium',
        action: 'rebuild',
        description: 'Library changes affect dependent workspaces'
      },
      {
        pattern: /apps\/.*\/src\//,
        affects: [],
        severity: 'low',
        action: 'rebuild',
        description: 'App-specific changes have isolated impact'
      },
      {
        pattern: /\.test\.(js|ts|jsx|tsx)$/,
        affects: [],
        severity: 'low',
        action: 'test',
        description: 'Test file changes only require test runs'
      },
      {
        pattern: /README\.md$/,
        affects: [],
        severity: 'low',
        action: 'lint',
        description: 'Documentation changes require minimal action'
      }
    ];
  }

  /**
   * Converts a severity label to a numeric level so severities can be compared.
   *
   * @param severity - The severity label to convert.
   * @returns Numeric severity value, where higher means more severe.
   */
  // Convert severity to numeric level for comparison
  private severityLevel(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      case 'critical': return 4;
      default: return 0;
    }
  }

  /**
   * Appends a custom impact rule to the analyzer's rule set.
   *
   * @param rule - The {@link ImpactRule} to add.
   */
  // Add custom impact rule
  addImpactRule(rule: ImpactRule): void {
    this.impactRules.push(rule);
  }

  /**
   * Returns the current dependency graph used by the analyzer.
   *
   * @returns The internal {@link DependencyGraph}.
   */
  // Get dependency graph information
  getDependencyGraph(): DependencyGraph {
    return this.dependencyGraph;
  }

  /**
   * Looks up workspace information by name.
   *
   * @param name - Workspace name to look up.
   * @returns The matching {@link WorkspaceInfo}, or `undefined` if not found.
   */
  // Get workspace information
  getWorkspaceInfo(name: string): WorkspaceInfo | undefined {
    return this.dependencyGraph.nodes.get(name);
  }

  /**
   * Returns information for all discovered workspaces.
   *
   * @returns Array of all {@link WorkspaceInfo} known to the analyzer.
   */
  // Get all workspaces
  getAllWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.dependencyGraph.nodes.values());
  }
}

/**
 * Creates and initializes a {@link ChangeImpactAnalyzer} for the given monorepo
 * root, resolving once the analyzer is ready to perform impact analysis.
 *
 * @param rootPath - Path to the monorepo root directory.
 * @param options - Optional partial overrides for {@link ChangeImpactOptions}.
 * @returns A promise resolving to the initialized analyzer.
 */
// Utility functions
export async function createChangeImpactAnalyzer(rootPath: string, options?: Partial<ChangeImpactOptions>): Promise<ChangeImpactAnalyzer> {
  const analyzer = new ChangeImpactAnalyzer(rootPath, options);
  await analyzer.initialize();
  return analyzer;
}

/**
 * Convenience wrapper that creates an analyzer for the given monorepo root and
 * immediately runs {@link ChangeImpactAnalyzer.analyzeChangeImpact} for the
 * provided changed files.
 *
 * @param rootPath - Path to the monorepo root directory.
 * @param changedFiles - Optional list of changed file paths. When omitted, the
 *   analyzer detects changes automatically.
 * @param options - Optional partial overrides for {@link ChangeImpactOptions}.
 * @returns A promise resolving to the {@link ImpactAnalysisResult}.
 */
export async function analyzeChangeImpact(rootPath: string, changedFiles?: string[], options?: Partial<ChangeImpactOptions>): Promise<ImpactAnalysisResult> {
  const analyzer = await createChangeImpactAnalyzer(rootPath, options);
  return await analyzer.analyzeChangeImpact(changedFiles);
}