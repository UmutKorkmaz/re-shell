// Workspace Optimization Recommendations
// Analyze workspace and provide automated optimization suggestions

import { dependencyGraphEngine } from '../graph/dependency-graph-engine';
import { topologyValidator } from '../validators/topology-validator';

export interface OptimizationRecommendation {
  id: string;
  type: 'performance' | 'structure' | 'security' | 'maintainability' | 'scalability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  automatedFix?: {
    command: string;
    description: string;
  };
  manualFix?: {
    steps: string[];
  };
}

export interface OptimizationReport {
  recommendations: OptimizationRecommendation[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byType: Record<string, number>;
  };
  estimatedImpact: {
    performance: string;
    maintainability: string;
    scalability: string;
  };
}

export class WorkspaceOptimizer {
  /**
   * Analyze workspace and generate recommendations
   */
  analyze(config: any): OptimizationReport {
    const recommendations: OptimizationRecommendation[] = [];

    // Check for circular dependencies
    recommendations.push(...this.checkCircularDependencies(config));

    // Check for service isolation
    recommendations.push(...this.checkServiceIsolation(config));

    // Check for resource optimization
    recommendations.push(...this.checkResourceOptimization(config));

    // Check for naming conventions
    recommendations.push(...this.checkNamingConventions(config));

    // Check for unused dependencies
    recommendations.push(...this.checkUnusedDependencies(config));

    // Check for security best practices
    recommendations.push(...this.checkSecurityPractices(config));

    // Check for scalability
    recommendations.push(...this.checkScalability(config));

    // Generate summary
    const summary = this.generateSummary(recommendations);

    // Estimate impact
    const estimatedImpact = this.estimateImpact(recommendations);

    return {
      recommendations: recommendations.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      summary,
      estimatedImpact,
    };
  }

  /**
   * Apply automated fixes
   */
  async applyAutomatedFixes(config: any, recommendationIds: string[]): Promise<any> {
    const result = { ...config };

    for (const id of recommendationIds) {
      // Find recommendation
      // Apply automated fix
      // In production, this would make actual changes to the config
    }

    return result;
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependencies(config: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    try {
      const graph = dependencyGraphEngine.buildFromConfig(config);
      const cycles = dependencyGraphEngine.detectCycles();

      if (cycles.length > 0) {
        recommendations.push({
          id: 'circular-deps',
          type: 'structure',
          severity: 'critical',
          title: 'Circular Dependencies Detected',
          description: `Found ${cycles.length} circular dependency chain(s): ${cycles.map(c => c.join(' -> ')).join('; ')}`,
          impact: 'Breaks deployment and causes runtime issues',
          effort: 'high',
          manualFix: {
            steps: [
              'Review the circular dependency chains',
              'Introduce a new service to break the cycle',
              'Use event-driven architecture to decouple services',
            ],
          },
        });
      }
    } catch (error) {
      // Ignore errors
    }

    return recommendations;
  }

  /**
   * Check for service isolation
   */
  private checkServiceIsolation(config: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const services = config.services || {};
    const sharedDbs = new Set<string>();

    // Check for shared databases
    for (const [serviceId, service] of Object.entries(services)) {
      const routes = (service as any).routes || [];
      for (const route of routes) {
        if (route.target && route.target.includes('database')) {
          const dbName = route.target.split(':')[1] || route.target;
          sharedDbs.add(dbName);
        }
      }
    }

    if (sharedDbs.size > 0 && Object.keys(services).length > 3) {
      recommendations.push({
        id: 'shared-db',
        type: 'scalability',
        severity: 'high',
        title: 'Shared Database Detected',
        description: `Multiple services sharing database(s): ${Array.from(sharedDbs).join(', ')}`,
        impact: 'Creates tight coupling between services',
        effort: 'high',
        manualFix: {
          steps: [
            'Consider database per service pattern',
            'Use API calls instead of direct database access',
            'Implement data replication if needed',
          ],
        },
      });
    }

    return recommendations;
  }

  /**
   * Check for resource optimization
   */
  private checkResourceOptimization(config: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const services = config.services || {};
    let overprovisioned = 0;
    let underprovisioned = 0;

    for (const [serviceId, service] of Object.entries(services)) {
      const resources = (service as any).resources;

      if (resources?.cpu?.request && resources?.cpu?.limit) {
        const request = parseInt(resources.cpu.request);
        const limit = parseInt(resources.cpu.limit);

        if (limit / request > 4) {
          overprovisioned++;
        }
      }

      if (resources?.memory?.request && resources?.memory?.limit) {
        const request = parseInt(resources.memory.request);
        const limit = parseInt(resources.memory.limit);

        if (limit / request < 1.5) {
          underprovisioned++;
        }
      }
    }

    if (overprovisioned > 0) {
      recommendations.push({
        id: 'overprovisioned',
        type: 'performance',
        severity: 'medium',
        title: 'Over-Provisioned Resources',
        description: `${overprovisioned} service(s) have CPU limits > 4x requests`,
        impact: 'Wastes resources and increases costs',
        effort: 'low',
        manualFix: {
          steps: [
            'Monitor actual resource usage',
            'Adjust limits to match actual needs',
            'Consider using horizontal pod autoscaler',
          ],
        },
      });
    }

    if (underprovisioned > 0) {
      recommendations.push({
        id: 'underprovisioned',
        type: 'performance',
        severity: 'medium',
        title: 'Under-Provisioned Memory',
        description: `${underprovisioned} service(s) have memory limits too close to requests`,
        impact: 'May cause OOM kills and service disruptions',
        effort: 'low',
        manualFix: {
          steps: [
            'Monitor memory usage patterns',
            'Increase limits to at least 1.5x requests',
            'Add memory profiling to identify leaks',
          ],
        },
      });
    }

    return recommendations;
  }

  /**
   * Check for naming conventions
   */
  private checkNamingConventions(config: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const services = config.services || {};
    const invalidNames: string[] = [];

    const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

    for (const [serviceId, service] of Object.entries(services)) {
      const name = (service as any).name;

      if (name && !kebabCaseRegex.test(name)) {
        invalidNames.push(name);
      }
    }

    if (invalidNames.length > 0) {
      recommendations.push({
        id: 'naming',
        type: 'maintainability',
        severity: 'low',
        title: 'Naming Convention Issues',
        description: `Service names should use kebab-case: ${invalidNames.join(', ')}`,
        impact: 'Inconsistent naming makes workspace harder to navigate',
        effort: 'low',
        automatedFix: {
          command: 're-shell fix-naming --convention kebab-case',
          description: 'Automatically rename services to kebab-case',
        },
      });
    }

    return recommendations;
  }

  /**
   * Check for unused dependencies
   */
  private checkUnusedDependencies(config: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const services = config.services || {};

    for (const [serviceId, service] of Object.entries(services)) {
      const dependencies = (service as any).dependencies?.production || {};
      const routes = (service as any).routes || [];

      // Check if dependencies are actually used
      const unusedDeps: string[] = [];

      for (const [dep, version] of Object.entries(dependencies)) {
        let used = false;

        // Check if dependency is referenced in routes
        for (const route of routes) {
          if (route.target && route.target.includes(dep)) {
            used = true;
            break;
          }
        }

        if (!used) {
          unusedDeps.push(dep);
        }
      }

      if (unusedDeps.length > 0) {
        recommendations.push({
          id: `unused-deps-${serviceId}`,
          type: 'maintainability',
          severity: 'low',
          title: `Unused Dependencies in ${serviceId}`,
          description: `Unused dependencies found: ${unusedDeps.join(', ')}`,
          impact: 'Increases bundle size and security surface',
          effort: 'low',
          automatedFix: {
            command: `re-shell clean-deps --service ${serviceId}`,
            description: 'Remove unused dependencies',
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Check for security best practices
   */
  private checkSecurityPractices(config: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const services = config.services || {};
    let missingHealthChecks = 0;
    let missingAuth = 0;

    for (const [serviceId, service] of Object.entries(services)) {
      if (!(service as any).healthCheck) {
        missingHealthChecks++;
      }

      const features = (service as any).features || [];
      if (!features.includes('authentication') && !features.includes('security')) {
        missingAuth++;
      }
    }

    if (missingHealthChecks > 0) {
      recommendations.push({
        id: 'missing-health-checks',
        type: 'security',
        severity: 'high',
        title: 'Missing Health Checks',
        description: `${missingHealthChecks} service(s) missing health check configuration`,
        impact: 'Difficult to monitor service health and detect failures',
        effort: 'low',
        automatedFix: {
          command: 're-shell add-health-checks',
          description: 'Add default health check endpoints to all services',
        },
      });
    }

    if (missingAuth > 0) {
      recommendations.push({
        id: 'missing-auth',
        type: 'security',
        severity: 'medium',
        title: 'Missing Authentication',
        description: `${missingAuth} service(s) without authentication or security features`,
        impact: 'Services may be exposed without access control',
        effort: 'medium',
        manualFix: {
          steps: [
            'Add authentication middleware',
            'Implement JWT or OAuth2',
            'Add security headers and CORS configuration',
          ],
        },
      });
    }

    return recommendations;
  }

  /**
   * Check for scalability
   */
  private checkScalability(config: any): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const services = config.services || {};
    let noScaling = 0;

    for (const [serviceId, service] of Object.entries(services)) {
      const scaling = (service as any).scaling;

      if (!scaling || scaling.min === scaling.max) {
        noScaling++;
      }
    }

    if (noScaling > 0 && Object.keys(services).length > 1) {
      recommendations.push({
        id: 'no-scaling',
        type: 'scalability',
        severity: 'medium',
        title: 'No Auto-Scaling Configuration',
        description: `${noScaling} service(s) configured with fixed instance count`,
        impact: 'Cannot automatically scale based on load',
        effort: 'medium',
        manualFix: {
          steps: [
            'Configure horizontal pod autoscaler',
            'Set minimum and maximum replica counts',
            'Define CPU/memory thresholds for scaling',
          ],
        },
      });
    }

    return recommendations;
  }

  /**
   * Generate summary
   */
  private generateSummary(recommendations: OptimizationRecommendation[]): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byType: Record<string, number>;
  } {
    const summary = {
      total: recommendations.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      byType: {} as Record<string, number>,
    };

    for (const rec of recommendations) {
      summary[rec.severity]++;
      summary.byType[rec.type] = (summary.byType[rec.type] || 0) + 1;
    }

    return summary;
  }

  /**
   * Estimate impact
   */
  private estimateImpact(recommendations: OptimizationRecommendation[]): {
    performance: string;
    maintainability: string;
    scalability: string;
  } {
    const perfRecs = recommendations.filter(r => r.type === 'performance');
    const maintainRecs = recommendations.filter(r => r.type === 'maintainability');
    const scaleRecs = recommendations.filter(r => r.type === 'scalability');

    return {
      performance: this.estimateLevel(perfRecs),
      maintainability: this.estimateLevel(maintainRecs),
      scalability: this.estimateLevel(scaleRecs),
    };
  }

  /**
   * Estimate improvement level
   */
  private estimateLevel(recs: OptimizationRecommendation[]): string {
    const criticalAndHigh = recs.filter(r => r.severity === 'critical' || r.severity === 'high').length;

    if (criticalAndHigh >= 3) return 'Significant improvement potential';
    if (criticalAndHigh >= 1) return 'Moderate improvement expected';
    if (recs.length >= 2) return 'Minor improvements available';
    return 'Well optimized';
  }
}

export const workspaceOptimizer = new WorkspaceOptimizer();
