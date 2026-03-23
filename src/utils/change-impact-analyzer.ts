import * as fs from 'fs-extra';
import * as path from 'path';
import { ValidationError } from './error-handler';
import { ChangeDetector, FileHash } from './change-detector';

export interface WorkspaceInfo {
  name: string;
  path: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  dependencies: string[];
  devDependencies: string[];
  framework?: string;
  buildScript?: string;
  testScript?: string;
}

export interface ImpactAnalysisResult {
  changedFiles: string[];
  affectedWorkspaces: WorkspaceInfo[];
  buildOrder: string[];
  testOrder: string[];
  totalImpact: number;
  criticalPath: string[];
  recommendations: string[];
  analysisTime: number;
}

export interface ChangeImpactOptions {
  maxDepth: number;
  includeTests: boolean;
  includeDevDependencies: boolean;
  buildOptimization: boolean;
  parallelAnalysis: boolean;
}

export interface DependencyGraph {
  nodes: Map<string, WorkspaceInfo>;
  edges: Map<string, string[]>;
  reverseEdges: Map<string, string[]>;
}

export interface ImpactRule {
  pattern: RegExp;
  affects: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'rebuild' | 'test' | 'lint' | 'deploy';
  description: string;
}

// Change impact analyzer for workspace dependencies
export class ChangeImpactAnalyzer {
  private rootPath: string;
  private dependencyGraph: DependencyGraph;
  private changeDetector: ChangeDetector;
  private impactRules: ImpactRule[];
  private options: ChangeImpactOptions;

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

  // Initialize the analyzer
  async initialize(): Promise<void> {
    await this.changeDetector.initialize();
    await this.buildDependencyGraph();
  }

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

  // Extract workspace dependencies (filter out external packages)
  private extractWorkspaceDependencies(deps: Record<string, string>): string[] {
    return Object.keys(deps).filter(dep => {
      // Check if it's a workspace dependency (starts with workspace name pattern)
      return this.dependencyGraph.nodes.has(dep) || dep.startsWith('@re-shell/');
    });
  }

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

  // Detect framework from package.json
  private detectFramework(packageJson: any): string | undefined {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.svelte) return 'svelte';
    if (deps['@angular/core']) return 'angular';
    
    return undefined;
  }

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

  // Find workspaces that depend on a given workspace
  private findDependentWorkspaces(workspaceName: string): string[] {
    return this.dependencyGraph.reverseEdges.get(workspaceName) || [];
  }

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

  // Calculate test order (reverse of build order for most cases)
  private calculateTestOrder(workspaces: string[]): string[] {
    const buildOrder = this.calculateBuildOrder(workspaces);
    
    // For testing, we usually want to test dependencies first, then dependents
    // But for integration tests, we might want the reverse
    return this.options.includeTests ? buildOrder : buildOrder.reverse();
  }

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

  // Add custom impact rule
  addImpactRule(rule: ImpactRule): void {
    this.impactRules.push(rule);
  }

  // Get dependency graph information
  getDependencyGraph(): DependencyGraph {
    return this.dependencyGraph;
  }

  // Get workspace information
  getWorkspaceInfo(name: string): WorkspaceInfo | undefined {
    return this.dependencyGraph.nodes.get(name);
  }

  // Get all workspaces
  getAllWorkspaces(): WorkspaceInfo[] {
    return Array.from(this.dependencyGraph.nodes.values());
  }
}

// Utility functions
export async function createChangeImpactAnalyzer(rootPath: string, options?: Partial<ChangeImpactOptions>): Promise<ChangeImpactAnalyzer> {
  const analyzer = new ChangeImpactAnalyzer(rootPath, options);
  await analyzer.initialize();
  return analyzer;
}

export async function analyzeChangeImpact(rootPath: string, changedFiles?: string[], options?: Partial<ChangeImpactOptions>): Promise<ImpactAnalysisResult> {
  const analyzer = await createChangeImpactAnalyzer(rootPath, options);
  return await analyzer.analyzeChangeImpact(changedFiles);
}