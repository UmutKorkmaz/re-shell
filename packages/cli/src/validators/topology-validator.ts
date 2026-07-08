/**
 * Represents a conflict detected during service topology validation.
 */
export interface TopologyConflict {
  /**
   * The category of the conflict (e.g. `'missing-dependency'`, `'circular-dependency'`).
   */
  type: string;
  /**
   * A human-readable description of the conflict.
   */
  message: string;
  /**
   * The list of service identifiers involved in the conflict.
   */
  affectedServices: string[];
}

/**
 * The result returned by topology validation, indicating whether the
 * configuration is valid and listing any conflicts found.
 */
export interface TopologyValidationResult {
  /**
   * `true` when no conflicts were detected, otherwise `false`.
   */
  valid: boolean;
  /**
   * The list of conflicts discovered during validation.
   */
  conflicts: TopologyConflict[];
}

/**
 * Aggregated statistics describing the structure of a service topology.
 */
export interface TopologyStats {
  /**
   * The total number of services defined in the configuration.
   */
  totalServices: number;
  /**
   * The total number of dependency relationships across all services.
   */
  totalDependencies: number;
  /**
   * The number of distinct layers (or types) the services belong to.
   */
  totalLayers: number;
  /**
   * `true` if at least one circular dependency exists, otherwise `false`.
   */
  hasCircularDependencies: boolean;
  /**
   * Each inner array is a cycle represented as an ordered list of service identifiers.
   */
  circularDependencies: string[][];
  /**
   * Service identifiers that have no dependencies and are not depended upon.
   */
  isolatedServices: string[];
}

/**
 * Maps a service identifier to the list of services it depends on.
 */
type DependencyMap = Record<string, string[]>;

/**
 * Extracts the services object from a configuration, returning an empty
 * object when the configuration does not define services.
 *
 * @param config - The configuration object to read services from.
 * @returns A record mapping service identifiers to their definitions.
 */
function getServices(config: any): Record<string, any> {
  return config?.services && typeof config.services === 'object' ? config.services : {};
}

/**
 * Builds a dependency map from a configuration by reading per-service
 * `dependencies` arrays and falling back to a top-level `dependencies` object.
 *
 * @param config - The configuration object to extract dependencies from.
 * @returns A map of service identifiers to their list of dependency identifiers.
 */
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

/**
 * Detects all circular dependency chains within the given dependency map
 * using a depth-first search with a visiting/visited coloring scheme.
 *
 * @param dependencies - The map of service identifiers to their dependencies.
 * @returns An array of cycles, each represented as an ordered list of service identifiers.
 */
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

/**
 * Counts the number of distinct layers (or service types) present in a
 * configuration.
 *
 * @param config - The configuration object to inspect.
 * @returns The number of unique non-empty layer/type values among services.
 */
function getLayerCount(config: any): number {
  const services = getServices(config);
  const layers = new Set<string>();

  for (const service of Object.values(services)) {
    const layer = (service as Record<string, unknown>)?.layer || (service as Record<string, unknown>)?.type;
    if (typeof layer === 'string' && layer.length > 0) {
      layers.add(layer);
    }
  }

  return layers.size;
}

/**
 * Provides validation and analysis utilities for a service topology
 * configuration.
 */
export const topologyValidator = {
  /**
   * Validates a topology configuration by detecting missing dependencies
   * and circular dependency chains.
   *
   * @param config - The configuration object to validate.
   * @returns A result indicating whether the configuration is valid and listing any conflicts.
   */
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

  /**
   * Computes aggregate statistics about the service topology, including
   * service count, dependency count, layer count, circular dependencies,
   * and isolated services.
   *
   * @param config - The configuration object to analyze.
   * @returns Statistics describing the structure of the topology.
   */
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
