export interface TopologyConflict {
  type: string;
  message: string;
  affectedServices: string[];
}

export interface TopologyValidationResult {
  valid: boolean;
  conflicts: TopologyConflict[];
}

export interface TopologyStats {
  totalServices: number;
  totalDependencies: number;
  totalLayers: number;
  hasCircularDependencies: boolean;
  circularDependencies: string[][];
  isolatedServices: string[];
}

type DependencyMap = Record<string, string[]>;

function getServices(config: any): Record<string, any> {
  return config?.services && typeof config.services === 'object' ? config.services : {};
}

function normalizeDependencies(config: any): DependencyMap {
  const services = getServices(config);
  const dependencies: DependencyMap = {};

  for (const serviceId of Object.keys(services)) {
    const service = services[serviceId] || {};
    const serviceDeps = Array.isArray(service.dependencies) ? service.dependencies : [];
    dependencies[serviceId] = serviceDeps.filter((dependency: unknown): dependency is string => typeof dependency === 'string');
  }

  if (config?.dependencies && typeof config.dependencies === 'object') {
    for (const [serviceId, serviceDeps] of Object.entries(config.dependencies)) {
      dependencies[serviceId] = Array.isArray(serviceDeps)
        ? serviceDeps.filter((dependency: unknown): dependency is string => typeof dependency === 'string')
        : [];
    }
  }

  return dependencies;
}

function findCycles(dependencies: DependencyMap): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(serviceId: string, path: string[]): void {
    if (visiting.has(serviceId)) {
      const cycleStart = path.indexOf(serviceId);
      cycles.push([...path.slice(cycleStart), serviceId]);
      return;
    }

    if (visited.has(serviceId)) {
      return;
    }

    visiting.add(serviceId);
    for (const dependency of dependencies[serviceId] || []) {
      visit(dependency, [...path, serviceId]);
    }
    visiting.delete(serviceId);
    visited.add(serviceId);
  }

  for (const serviceId of Object.keys(dependencies)) {
    visit(serviceId, []);
  }

  return cycles;
}

function getLayerCount(config: any): number {
  const services = getServices(config);
  const layers = new Set<string>();

  for (const service of Object.values(services)) {
    const layer = (service as any)?.layer || (service as any)?.type;
    if (typeof layer === 'string' && layer.length > 0) {
      layers.add(layer);
    }
  }

  return layers.size;
}

export const topologyValidator = {
  validate(config: any): TopologyValidationResult {
    const services = getServices(config);
    const dependencies = normalizeDependencies(config);
    const conflicts: TopologyConflict[] = [];

    for (const [serviceId, serviceDependencies] of Object.entries(dependencies)) {
      const missing = serviceDependencies.filter(dependency => !services[dependency]);
      if (missing.length > 0) {
        conflicts.push({
          type: 'missing-dependency',
          message: `${serviceId} depends on missing service(s): ${missing.join(', ')}`,
          affectedServices: [serviceId, ...missing]
        });
      }
    }

    for (const cycle of findCycles(dependencies)) {
      conflicts.push({
        type: 'circular-dependency',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        affectedServices: Array.from(new Set(cycle))
      });
    }

    return {
      valid: conflicts.length === 0,
      conflicts
    };
  },

  getTopologyStats(config: any): TopologyStats {
    const services = getServices(config);
    const dependencies = normalizeDependencies(config);
    const circularDependencies = findCycles(dependencies);
    const dependencyTargets = new Set<string>();
    let totalDependencies = 0;

    for (const serviceDependencies of Object.values(dependencies)) {
      totalDependencies += serviceDependencies.length;
      serviceDependencies.forEach(dependency => dependencyTargets.add(dependency));
    }

    const isolatedServices = Object.keys(services).filter(serviceId => {
      return (dependencies[serviceId] || []).length === 0 && !dependencyTargets.has(serviceId);
    });

    return {
      totalServices: Object.keys(services).length,
      totalDependencies,
      totalLayers: getLayerCount(config),
      hasCircularDependencies: circularDependencies.length > 0,
      circularDependencies,
      isolatedServices
    };
  }
};
