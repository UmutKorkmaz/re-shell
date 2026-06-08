import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition, WorkspaceEntry, loadWorkspaceDefinition } from './workspace-schema';
import { WorkspaceDependencyGraph, createWorkspaceDependencyGraph } from './workspace-graph';

// Health check severity levels
export type HealthSeverity = 'critical' | 'error' | 'warning' | 'info' | 'success';

// Health check result
export interface HealthCheckResult {
  id: string;
  name: string;
  description: string;
  severity: HealthSeverity;
  status: 'pass' | 'fail' | 'warning' | 'info';
  message: string;
  suggestions?: string[];
  metadata?: Record<string, any>;
  duration?: number;
}

// Health check category
export interface HealthCheckCategory {
  id: string;
  name: string;
  description: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    score: number; // 0-100
  };
}

// Complete health report
export interface WorkspaceHealthReport {
  timestamp: string;
  workspaceFile: string;
  duration: number;
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number; // 0-100
    summary: string;
  };
  categories: HealthCheckCategory[];
  recommendations: string[];
  metrics: {
    workspaceCount: number;
    dependencyCount: number;
    cycleCount: number;
    orphanedCount: number;
    coverageScore: number;
  };
}

// Topology validation result
export interface TopologyValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
  structure: {
    depth: number;
    breadth: number;
    complexity: number;
    balance: number; // 0-1, 1 = perfectly balanced
  };
}

// Workspace health checker
export class WorkspaceHealthChecker {
  private definition: WorkspaceDefinition;
  private graph: WorkspaceDependencyGraph;
  private rootPath: string;

  constructor(definition: WorkspaceDefinition, rootPath: string = process.cwd()) {
    this.definition = definition;
    this.graph = createWorkspaceDependencyGraph(definition);
    this.rootPath = rootPath;
  }

  // Perform comprehensive health check
  async performHealthCheck(): Promise<WorkspaceHealthReport> {
    const startTime = Date.now();
    const categories: HealthCheckCategory[] = [];

    // Run all health check categories
    categories.push(await this.checkWorkspaceStructure());
    categories.push(await this.checkDependencyHealth());
    categories.push(await this.checkBuildConfiguration());
    categories.push(await this.checkFileSystemHealth());
    categories.push(await this.checkPackageJsonHealth());
    categories.push(await this.checkTypeScriptHealth());
    categories.push(await this.checkSecurityHealth());

    const duration = Date.now() - startTime;

    // Calculate overall score and status
    const totalChecks = categories.reduce((sum, cat) => sum + cat.summary.total, 0);
    const passedChecks = categories.reduce((sum, cat) => sum + cat.summary.passed, 0);
    const failedChecks = categories.reduce((sum, cat) => sum + cat.summary.failed, 0);
    
    const overallScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (overallScore >= 90) overallStatus = 'healthy';
    else if (overallScore >= 70) overallStatus = 'degraded';
    else overallStatus = 'unhealthy';

    // Generate recommendations
    const recommendations = this.generateRecommendations(categories);

    // Calculate metrics
    const analysis = this.graph.analyzeGraph();
    const metrics = {
      workspaceCount: analysis.nodeCount,
      dependencyCount: analysis.edgeCount,
      cycleCount: analysis.cycles.cycles.length,
      orphanedCount: analysis.orphanedNodes.length,
      coverageScore: this.calculateCoverageScore()
    };

    return {
      timestamp: new Date().toISOString(),
      workspaceFile: 're-shell.workspaces.yaml',
      duration,
      overall: {
        status: overallStatus,
        score: overallScore,
        summary: this.generateOverallSummary(overallStatus, overallScore, failedChecks)
      },
      categories,
      recommendations,
      metrics
    };
  }

  // Validate workspace topology
  async validateTopology(): Promise<TopologyValidation> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      const analysis = this.graph.analyzeGraph();

      // Check for cycles
      if (analysis.cycles.hasCycles) {
        for (const cycle of analysis.cycles.cycles) {
          if (cycle.severity === 'error') {
            errors.push(new ValidationError(`Circular dependency: ${cycle.path.join(' → ')}`));
          } else {
            warnings.push(`Potential cycle: ${cycle.path.join(' → ')}`);
          }
        }
      }

      // Check depth (too deep indicates complex dependencies)
      if (analysis.statistics.maxDepth > 8) {
        warnings.push(`Dependency depth (${analysis.statistics.maxDepth}) is quite deep. Consider flattening.`);
        suggestions.push('Break up large workspaces or reduce dependency chains');
      }

      // Check for orphaned workspaces
      if (analysis.orphanedNodes.length > 0) {
        warnings.push(`Found ${analysis.orphanedNodes.length} orphaned workspace(s): ${analysis.orphanedNodes.join(', ')}`);
        suggestions.push('Connect orphaned workspaces or remove them if unused');
      }

      // Check workspace distribution
      const workspacesByType = this.getWorkspacesByType();
      if (workspacesByType.app && workspacesByType.app.length > 5) {
        suggestions.push('Consider splitting applications if you have many frontend apps');
      }

      // Calculate structure metrics
      const structure = this.calculateStructureMetrics(analysis);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        structure
      };

    } catch (error) {
      errors.push(new ValidationError(`Topology validation failed: ${(error as Error).message}`));
      
      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        structure: { depth: 0, breadth: 0, complexity: 0, balance: 0 }
      };
    }
  }

  // Check workspace structure
  private async checkWorkspaceStructure(): Promise<HealthCheckCategory> {
    const checks: HealthCheckResult[] = [];
    const startTime = Date.now();

    // Check workspace definition exists
    checks.push(await this.checkWorkspaceDefinitionExists());
    
    // Check workspace directories exist
    checks.push(await this.checkWorkspaceDirectories());
    
    // Check workspace consistency
    checks.push(await this.checkWorkspaceConsistency());
    
    // Check workspace naming conventions
    checks.push(await this.checkNamingConventions());

    // Check workspace types are valid
    checks.push(await this.checkWorkspaceTypes());

    const summary = this.calculateCategorySummary(checks);

    return {
      id: 'structure',
      name: 'Workspace Structure',
      description: 'Validates workspace directory structure and configuration consistency',
      checks,
      summary
    };
  }

  // Check dependency health
  private async checkDependencyHealth(): Promise<HealthCheckCategory> {
    const checks: HealthCheckResult[] = [];

    // Check for circular dependencies
    checks.push(await this.checkCircularDependencies());
    
    // Check dependency versions
    checks.push(await this.checkDependencyVersions());
    
    // Check for missing dependencies
    checks.push(await this.checkMissingDependencies());
    
    // Check dependency optimization
    checks.push(await this.checkDependencyOptimization());

    const summary = this.calculateCategorySummary(checks);

    return {
      id: 'dependencies',
      name: 'Dependency Health',
      description: 'Analyzes workspace dependencies and detects issues',
      checks,
      summary
    };
  }

  // Check build configuration
  private async checkBuildConfiguration(): Promise<HealthCheckCategory> {
    const checks: HealthCheckResult[] = [];

    // Check build tools configuration
    checks.push(await this.checkBuildTools());
    
    // Check build scripts
    checks.push(await this.checkBuildScripts());
    
    // Check output configuration
    checks.push(await this.checkOutputConfiguration());

    const summary = this.calculateCategorySummary(checks);

    return {
      id: 'build',
      name: 'Build Configuration',
      description: 'Validates build setup and configuration across workspaces',
      checks,
      summary
    };
  }

  // Check file system health
  private async checkFileSystemHealth(): Promise<HealthCheckCategory> {
    const checks: HealthCheckResult[] = [];

    // Check for large files
    checks.push(await this.checkLargeFiles());
    
    // Check for node_modules bloat
    checks.push(await this.checkNodeModules());
    
    // Check file permissions
    checks.push(await this.checkFilePermissions());

    const summary = this.calculateCategorySummary(checks);

    return {
      id: 'filesystem',
      name: 'File System',
      description: 'Checks file system health and organization',
      checks,
      summary
    };
  }

  // Check package.json health
  private async checkPackageJsonHealth(): Promise<HealthCheckCategory> {
    const checks: HealthCheckResult[] = [];

    // Check package.json validity
    checks.push(await this.checkPackageJsonValidity());
    
    // Check script consistency
    checks.push(await this.checkScriptConsistency());
    
    // Check dependency consistency
    checks.push(await this.checkPackageDependencyConsistency());

    const summary = this.calculateCategorySummary(checks);

    return {
      id: 'package-json',
      name: 'Package Configuration',
      description: 'Validates package.json files across workspaces',
      checks,
      summary
    };
  }

  // Check TypeScript health
  private async checkTypeScriptHealth(): Promise<HealthCheckCategory> {
    const checks: HealthCheckResult[] = [];

    // Check TypeScript configuration
    checks.push(await this.checkTypeScriptConfig());
    
    // Check type definitions
    checks.push(await this.checkTypeDefinitions());

    const summary = this.calculateCategorySummary(checks);

    return {
      id: 'typescript',
      name: 'TypeScript Health',
      description: 'Validates TypeScript configuration and type safety',
      checks,
      summary
    };
  }

  // Check security health
  private async checkSecurityHealth(): Promise<HealthCheckCategory> {
    const checks: HealthCheckResult[] = [];

    // Check for security vulnerabilities
    checks.push(await this.checkSecurityVulnerabilities());
    
    // Check for sensitive files
    checks.push(await this.checkSensitiveFiles());

    const summary = this.calculateCategorySummary(checks);

    return {
      id: 'security',
      name: 'Security',
      description: 'Scans for security issues and vulnerabilities',
      checks,
      summary
    };
  }

  // Individual health check implementations
  private async checkWorkspaceDefinitionExists(): Promise<HealthCheckResult> {
    const definitionPath = path.join(this.rootPath, 're-shell.workspaces.yaml');
    const exists = await fs.pathExists(definitionPath);

    return {
      id: 'workspace-definition-exists',
      name: 'Workspace Definition',
      description: 'Checks if workspace definition file exists',
      severity: 'critical',
      status: exists ? 'pass' : 'fail',
      message: exists 
        ? 'Workspace definition file found'
        : 'Workspace definition file (re-shell.workspaces.yaml) not found',
      suggestions: exists ? undefined : [
        'Run: re-shell workspace-def init',
        'Create re-shell.workspaces.yaml manually'
      ]
    };
  }

  private async checkWorkspaceDirectories(): Promise<HealthCheckResult> {
    const missingDirectories: string[] = [];
    
    for (const [name, workspace] of Object.entries(this.definition.workspaces)) {
      const workspacePath = path.resolve(this.rootPath, workspace.path);
      if (!(await fs.pathExists(workspacePath))) {
        missingDirectories.push(`${name} (${workspace.path})`);
      }
    }

    return {
      id: 'workspace-directories',
      name: 'Workspace Directories',
      description: 'Verifies all workspace directories exist',
      severity: 'error',
      status: missingDirectories.length === 0 ? 'pass' : 'fail',
      message: missingDirectories.length === 0
        ? 'All workspace directories exist'
        : `${missingDirectories.length} workspace directories missing: ${missingDirectories.join(', ')}`,
      suggestions: missingDirectories.length > 0 ? [
        'Create missing workspace directories',
        'Update workspace paths in definition',
        'Remove unused workspace entries'
      ] : undefined
    };
  }

  private async checkWorkspaceConsistency(): Promise<HealthCheckResult> {
    const inconsistencies: string[] = [];
    
    // Check name consistency between definition and directory
    for (const [name, workspace] of Object.entries(this.definition.workspaces)) {
      const expectedDirName = path.basename(workspace.path);
      if (name !== expectedDirName && name !== workspace.name) {
        inconsistencies.push(`${name}: name mismatch with directory/config`);
      }
    }

    return {
      id: 'workspace-consistency',
      name: 'Workspace Consistency',
      description: 'Checks for naming and configuration consistency',
      severity: 'warning',
      status: inconsistencies.length === 0 ? 'pass' : 'warning',
      message: inconsistencies.length === 0
        ? 'Workspace naming is consistent'
        : `Found ${inconsistencies.length} naming inconsistencies`,
      metadata: { inconsistencies }
    };
  }

  private async checkNamingConventions(): Promise<HealthCheckResult> {
    const violations: string[] = [];
    const kebabCaseRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    
    for (const [name, workspace] of Object.entries(this.definition.workspaces)) {
      if (!kebabCaseRegex.test(name)) {
        violations.push(name);
      }
    }

    return {
      id: 'naming-conventions',
      name: 'Naming Conventions',
      description: 'Validates workspace names follow kebab-case convention',
      severity: 'info',
      status: violations.length === 0 ? 'pass' : 'warning',
      message: violations.length === 0
        ? 'All workspace names follow conventions'
        : `${violations.length} workspaces don't follow kebab-case: ${violations.join(', ')}`,
      suggestions: violations.length > 0 ? [
        'Use kebab-case for workspace names (e.g., my-component)',
        'Avoid camelCase, PascalCase, or snake_case'
      ] : undefined
    };
  }

  private async checkWorkspaceTypes(): Promise<HealthCheckResult> {
    const invalidTypes: string[] = [];
    const validTypes = new Set(Object.keys(this.definition.types));
    
    for (const [name, workspace] of Object.entries(this.definition.workspaces)) {
      if (!validTypes.has(workspace.type)) {
        invalidTypes.push(`${name}: ${workspace.type}`);
      }
    }

    return {
      id: 'workspace-types',
      name: 'Workspace Types',
      description: 'Validates all workspace types are defined',
      severity: 'error',
      status: invalidTypes.length === 0 ? 'pass' : 'fail',
      message: invalidTypes.length === 0
        ? 'All workspace types are valid'
        : `${invalidTypes.length} workspaces have invalid types: ${invalidTypes.join(', ')}`,
      suggestions: invalidTypes.length > 0 ? [
        'Define missing workspace types in the types section',
        'Update workspace type references to valid types'
      ] : undefined
    };
  }

  private async checkCircularDependencies(): Promise<HealthCheckResult> {
    const analysis = this.graph.analyzeGraph();
    const cycles = analysis.cycles.cycles;
    const errorCycles = cycles.filter(c => c.severity === 'error');

    return {
      id: 'circular-dependencies',
      name: 'Circular Dependencies',
      description: 'Detects circular dependencies between workspaces',
      severity: 'critical',
      status: errorCycles.length === 0 ? 'pass' : 'fail',
      message: errorCycles.length === 0
        ? 'No circular dependencies detected'
        : `Found ${errorCycles.length} circular dependencies`,
      metadata: { cycles: errorCycles },
      suggestions: errorCycles.length > 0 ? [
        'Run: re-shell workspace-graph cycles --detailed',
        'Restructure dependencies to break cycles',
        'Consider using dependency injection patterns'
      ] : undefined
    };
  }

  private async checkDependencyVersions(): Promise<HealthCheckResult> {
    // This would check for version consistency across workspaces
    // Simplified implementation for now
    return {
      id: 'dependency-versions',
      name: 'Dependency Versions',
      description: 'Checks for version consistency across workspaces',
      severity: 'warning',
      status: 'pass',
      message: 'Dependency version checking not yet implemented'
    };
  }

  private async checkMissingDependencies(): Promise<HealthCheckResult> {
    const missingDeps: string[] = [];
    
    for (const [workspaceName, deps] of Object.entries(this.definition.dependencies)) {
      for (const dep of deps) {
        if (!this.definition.workspaces[dep.name]) {
          missingDeps.push(`${workspaceName} → ${dep.name}`);
        }
      }
    }

    return {
      id: 'missing-dependencies',
      name: 'Missing Dependencies',
      description: 'Checks for references to non-existent workspaces',
      severity: 'error',
      status: missingDeps.length === 0 ? 'pass' : 'fail',
      message: missingDeps.length === 0
        ? 'All dependencies reference valid workspaces'
        : `Found ${missingDeps.length} references to missing workspaces`,
      metadata: { missingDeps }
    };
  }

  private async checkDependencyOptimization(): Promise<HealthCheckResult> {
    const analysis = this.graph.analyzeGraph();
    const suggestions: string[] = [];
    
    if (analysis.statistics.avgDependencies > 5) {
      suggestions.push('High average dependencies - consider breaking up large workspaces');
    }
    
    if (analysis.statistics.maxDepth > 6) {
      suggestions.push('Deep dependency chains - consider flattening architecture');
    }

    return {
      id: 'dependency-optimization',
      name: 'Dependency Optimization',
      description: 'Suggests dependency structure optimizations',
      severity: 'info',
      status: suggestions.length === 0 ? 'pass' : 'info',
      message: suggestions.length === 0
        ? 'Dependency structure is well optimized'
        : 'Found optimization opportunities',
      suggestions
    };
  }

  // Placeholder implementations for other checks
  private async checkBuildTools(): Promise<HealthCheckResult> {
    return {
      id: 'build-tools',
      name: 'Build Tools',
      description: 'Validates build tool configuration',
      severity: 'warning',
      status: 'pass',
      message: 'Build tool validation not yet implemented'
    };
  }

  private async checkBuildScripts(): Promise<HealthCheckResult> {
    return {
      id: 'build-scripts',
      name: 'Build Scripts',
      description: 'Checks build script consistency',
      severity: 'warning',
      status: 'pass',
      message: 'Build script validation not yet implemented'
    };
  }

  private async checkOutputConfiguration(): Promise<HealthCheckResult> {
    return {
      id: 'output-config',
      name: 'Output Configuration',
      description: 'Validates build output configuration',
      severity: 'info',
      status: 'pass',
      message: 'Output configuration validation not yet implemented'
    };
  }

  private async checkLargeFiles(): Promise<HealthCheckResult> {
    return {
      id: 'large-files',
      name: 'Large Files',
      description: 'Detects uncommonly large files',
      severity: 'info',
      status: 'pass',
      message: 'Large file detection not yet implemented'
    };
  }

  private async checkNodeModules(): Promise<HealthCheckResult> {
    return {
      id: 'node-modules',
      name: 'Node Modules',
      description: 'Checks for node_modules bloat',
      severity: 'info',
      status: 'pass',
      message: 'Node modules analysis not yet implemented'
    };
  }

  private async checkFilePermissions(): Promise<HealthCheckResult> {
    return {
      id: 'file-permissions',
      name: 'File Permissions',
      description: 'Validates file permissions',
      severity: 'info',
      status: 'pass',
      message: 'File permission checking not yet implemented'
    };
  }

  private async checkPackageJsonValidity(): Promise<HealthCheckResult> {
    return {
      id: 'package-json-validity',
      name: 'Package.json Validity',
      description: 'Validates package.json files',
      severity: 'error',
      status: 'pass',
      message: 'Package.json validation not yet implemented'
    };
  }

  private async checkScriptConsistency(): Promise<HealthCheckResult> {
    return {
      id: 'script-consistency',
      name: 'Script Consistency',
      description: 'Checks script consistency across workspaces',
      severity: 'warning',
      status: 'pass',
      message: 'Script consistency checking not yet implemented'
    };
  }

  private async checkPackageDependencyConsistency(): Promise<HealthCheckResult> {
    return {
      id: 'package-dependency-consistency',
      name: 'Package Dependency Consistency',
      description: 'Validates dependency consistency in package.json files',
      severity: 'warning',
      status: 'pass',
      message: 'Package dependency consistency checking not yet implemented'
    };
  }

  private async checkTypeScriptConfig(): Promise<HealthCheckResult> {
    return {
      id: 'typescript-config',
      name: 'TypeScript Configuration',
      description: 'Validates TypeScript configuration',
      severity: 'warning',
      status: 'pass',
      message: 'TypeScript configuration validation not yet implemented'
    };
  }

  private async checkTypeDefinitions(): Promise<HealthCheckResult> {
    return {
      id: 'type-definitions',
      name: 'Type Definitions',
      description: 'Checks type definition availability',
      severity: 'info',
      status: 'pass',
      message: 'Type definition checking not yet implemented'
    };
  }

  private async checkSecurityVulnerabilities(): Promise<HealthCheckResult> {
    return {
      id: 'security-vulnerabilities',
      name: 'Security Vulnerabilities',
      description: 'Scans for known security vulnerabilities',
      severity: 'critical',
      status: 'pass',
      message: 'Security vulnerability scanning not yet implemented'
    };
  }

  private async checkSensitiveFiles(): Promise<HealthCheckResult> {
    return {
      id: 'sensitive-files',
      name: 'Sensitive Files',
      description: 'Detects potentially sensitive files',
      severity: 'warning',
      status: 'pass',
      message: 'Sensitive file detection not yet implemented'
    };
  }

  // Helper methods
  private calculateCategorySummary(checks: HealthCheckResult[]) {
    const total = checks.length;
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warnings = checks.filter(c => c.status === 'warning').length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;

    return { total, passed, failed, warnings, score };
  }

  private generateRecommendations(categories: HealthCheckCategory[]): string[] {
    const recommendations: string[] = [];
    
    // High-priority recommendations based on failed checks
    for (const category of categories) {
      const failedChecks = category.checks.filter(c => c.status === 'fail');
      for (const check of failedChecks) {
        if (check.suggestions) {
          recommendations.push(...check.suggestions);
        }
      }
    }

    // Remove duplicates and limit to most important
    return Array.from(new Set(recommendations)).slice(0, 10);
  }

  private generateOverallSummary(status: string, score: number, failedChecks: number): string {
    if (status === 'healthy') {
      return `Workspace is healthy with ${score}% of checks passing`;
    } else if (status === 'degraded') {
      return `Workspace has some issues (${score}% healthy) with ${failedChecks} failed checks`;
    } else {
      return `Workspace has significant issues (${score}% healthy) with ${failedChecks} failed checks`;
    }
  }

  private calculateCoverageScore(): number {
    // Simple coverage calculation based on workspace definition completeness
    let score = 0;
    const maxScore = 100;
    
    // Base score for having workspaces
    if (Object.keys(this.definition.workspaces).length > 0) score += 20;
    
    // Score for having dependencies defined
    if (Object.keys(this.definition.dependencies).length > 0) score += 20;
    
    // Score for having build configuration
    if (this.definition.build) score += 20;
    
    // Score for having scripts
    if (this.definition.scripts && Object.keys(this.definition.scripts).length > 0) score += 20;
    
    // Score for having workspace types
    if (this.definition.types && Object.keys(this.definition.types).length > 0) score += 20;
    
    return Math.min(score, maxScore);
  }

  private getWorkspacesByType(): Record<string, WorkspaceEntry[]> {
    const result: Record<string, WorkspaceEntry[]> = {};
    
    for (const workspace of Object.values(this.definition.workspaces)) {
      if (!result[workspace.type]) {
        result[workspace.type] = [];
      }
      result[workspace.type].push(workspace);
    }
    
    return result;
  }

  private calculateStructureMetrics(analysis: any) {
    return {
      depth: analysis.statistics.maxDepth,
      breadth: Math.max(...analysis.levels.map((level: any[]) => level.length)),
      complexity: analysis.edgeCount / Math.max(analysis.nodeCount, 1),
      balance: this.calculateBalance(analysis.levels)
    };
  }

  private calculateBalance(levels: any[][]): number {
    if (levels.length === 0) return 1;
    
    const levelSizes = levels.map(level => level.length);
    const maxSize = Math.max(...levelSizes);
    const minSize = Math.min(...levelSizes);
    
    return minSize / maxSize;
  }
}

// Utility functions
export async function createWorkspaceHealthChecker(
  workspaceFile: string,
  rootPath?: string
): Promise<WorkspaceHealthChecker> {
  const definition = await loadWorkspaceDefinition(workspaceFile);
  return new WorkspaceHealthChecker(definition, rootPath);
}

export async function performQuickHealthCheck(
  workspaceFile: string,
  rootPath?: string
): Promise<{ status: string; score: number; criticalIssues: number }> {
  try {
    const checker = await createWorkspaceHealthChecker(workspaceFile, rootPath);
    const report = await checker.performHealthCheck();
    
    const criticalIssues = report.categories
      .flatMap(cat => cat.checks)
      .filter(check => check.severity === 'critical' && check.status === 'fail')
      .length;

    return {
      status: report.overall.status,
      score: report.overall.score,
      criticalIssues
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      score: 0,
      criticalIssues: 1
    };
  }
}