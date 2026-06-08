// Dependency Graph Engine
// Build, analyze, and resolve service dependency graphs

export interface GraphNode {
  id: string;
  type: 'service' | 'database' | 'cache' | 'queue' | 'storage';
  name: string;
  language?: string;
  dependencies: string[];
  dependents: string[];
}

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, Set<string>>;
}

export interface GraphAnalysis {
  nodes: number;
  edges: number;
  cycles: string[][];
  layers: string[][];
  orphanNodes: string[];
  criticalPath: string[];
}

export interface ResolutionPlan {
  steps: ResolutionStep[];
  canResolve: boolean;
  errors: string[];
}

export interface ResolutionStep {
  order: number;
  service: string;
  action: 'deploy' | 'wait' | 'configure';
  dependencies: string[];
  dependents: string[];
}

export class DependencyGraphEngine {
  private graph: DependencyGraph;

  constructor() {
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
    };
  }

  /**
   * Build dependency graph from workspace configuration
   */
  buildFromConfig(config: any): DependencyGraph {
    // Clear existing graph
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
    };

    // Add service nodes
    if (config.services) {
      for (const [id, service] of Object.entries(config.services)) {
        this.addNode(id, 'service', (service as any).name || id, (service as any).language);
      }
    }

    // Add external dependency nodes
    if (config.dependencies) {
      const { databases, caches, queues, storage } = config.dependencies;

      databases?.forEach((db: any, i: number) => {
        this.addNode(db.name, 'database', db.name, undefined);
      });

      caches?.forEach((cache: any) => {
        this.addNode(cache.name, 'cache', cache.name, undefined);
      });

      queues?.forEach((queue: any) => {
        this.addNode(queue.name, 'queue', queue.name, undefined);
      });

      storage?.forEach((store: any) => {
        this.addNode(store.name, 'storage', store.name, undefined);
      });
    }

    // Add edges based on service routes and dependencies
    if (config.services) {
      for (const [serviceId, service] of Object.entries(config.services)) {
        const serviceConfig = service as any;

        // Add dependencies from routes
        const routes = serviceConfig.routes || [];
        for (const route of routes) {
          if (route.target && route.target.startsWith('service://')) {
            const targetId = route.target.replace('service://', '');
            this.addEdge(serviceId, targetId);
          }
        }

        // Add dependencies from package dependencies
        const deps = serviceConfig.dependencies?.production || {};
        for (const [dep, version] of Object.entries(deps)) {
          // Check if any service provides this dependency
          for (const [otherServiceId, otherService] of Object.entries(config.services)) {
            const otherConfig = otherService as any;
            if (otherConfig.type === 'backend' && otherConfig.name === dep) {
              this.addEdge(serviceId, otherServiceId);
            }
          }
        }
      }
    }

    return this.graph;
  }

  /**
   * Add a node to the graph
   */
  addNode(id: string, type: GraphNode['type'], name: string, language?: string): void {
    if (!this.graph.nodes.has(id)) {
      this.graph.nodes.set(id, {
        id,
        type,
        name,
        language,
        dependencies: [],
        dependents: [],
      });
      this.graph.edges.set(id, new Set());
    }
  }

  /**
   * Add an edge between two nodes
   */
  addEdge(from: string, to: string): void {
    if (!this.graph.nodes.has(from) || !this.graph.nodes.has(to)) {
      return;
    }

    this.graph.edges.get(from)!.add(to);

    // Update node metadata
    const fromNode = this.graph.nodes.get(from)!;
    const toNode = this.graph.nodes.get(to)!;

    if (!fromNode.dependencies.includes(to)) {
      fromNode.dependencies.push(to);
    }

    if (!toNode.dependents.includes(from)) {
      toNode.dependents.push(from);
    }
  }

  /**
   * Detect cycles using DFS
   */
  detectCycles(): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = this.graph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
        } else if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of this.graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Topological sort (Kahn's algorithm)
   */
  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const result: string[] = [];
    const queue: string[] = [];

    // Calculate in-degrees
    for (const [id, node] of this.graph.nodes) {
      inDegree.set(id, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(id);
      }
    }

    // Process nodes with no dependencies
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = this.graph.edges.get(node) || new Set();
      for (const neighbor of neighbors) {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);

        if (degree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycles
    if (result.length !== this.graph.nodes.size) {
      throw new Error('Graph has cycles, cannot perform topological sort');
    }

    return result;
  }

  /**
   * Calculate deployment layers using BFS
   */
  calculateDeploymentLayers(): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();
    const currentLayer: string[] = [];

    // Find all nodes with no dependencies
    for (const [id, node] of this.graph.nodes) {
      if (node.dependencies.length === 0) {
        currentLayer.push(id);
        visited.add(id);
      }
    }

    layers.push(currentLayer);

    // Build subsequent layers
    while (visited.size < this.graph.nodes.size) {
      const nextLayer: string[] = [];

      for (const [id, node] of this.graph.nodes) {
        if (visited.has(id)) continue;

        // Check if all dependencies are visited
        const allDepsVisited = node.dependencies.every(dep => visited.has(dep));
        if (allDepsVisited) {
          nextLayer.push(id);
          visited.add(id);
        }
      }

      if (nextLayer.length === 0) {
        // Cycle detected
        break;
      }

      layers.push(nextLayer);
    }

    return layers;
  }

  /**
   * Find critical path (longest path through graph)
   */
  findCriticalPath(): string[] {
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();

    // Initialize distances
    for (const id of this.graph.nodes.keys()) {
      dist.set(id, 0);
      prev.set(id, null);
    }

    // Process nodes in reverse topological order
    const sorted = this.topologicalSort().reverse();

    for (const node of sorted) {
      for (const dependent of this.graph.nodes.get(node)!.dependents) {
        const newDist = dist.get(node)! + 1;
        if (newDist > (dist.get(dependent) || 0)) {
          dist.set(dependent, newDist);
          prev.set(dependent, node);
        }
      }
    }

    // Find node with maximum distance
    let maxNode = sorted[sorted.length - 1];
    let maxDist = 0;

    for (const [node, distance] of dist) {
      if (distance > maxDist) {
        maxDist = distance;
        maxNode = node;
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current = maxNode;

    while (current) {
      path.unshift(current);
      current = prev.get(current)!;
    }

    return path;
  }

  /**
   * Analyze graph structure
   */
  analyze(): GraphAnalysis {
    const cycles = this.detectCycles();
    const layers = this.calculateDeploymentLayers();
    const criticalPath = this.findCriticalPath();
    const orphanNodes = Array.from(this.graph.nodes.keys()).filter(
      id => this.graph.nodes.get(id)!.dependencies.length === 0 &&
           this.graph.nodes.get(id)!.dependents.length === 0
    );

    let edgeCount = 0;
    for (const edges of this.graph.edges.values()) {
      edgeCount += edges.size;
    }

    return {
      nodes: this.graph.nodes.size,
      edges: edgeCount,
      cycles,
      layers,
      orphanNodes,
      criticalPath,
    };
  }

  /**
   * Generate resolution plan for dependency conflicts
   */
  generateResolutionPlan(): ResolutionPlan {
    const analysis = this.analyze();
    const plan: ResolutionPlan = {
      steps: [],
      canResolve: true,
      errors: [],
    };

    // Check for cycles
    if (analysis.cycles.length > 0) {
      plan.canResolve = false;
      plan.errors.push(`Found ${analysis.cycles.length} circular dependencies`);
      for (const cycle of analysis.cycles) {
        plan.errors.push(`  Cycle: ${cycle.join(' -> ')}`);
      }
      return plan;
    }

    try {
      // Use deployment layers to create plan
      const layers = analysis.layers;
      let order = 1;

      for (const layer of layers) {
        for (const serviceId of layer) {
          const node = this.graph.nodes.get(serviceId);
          if (!node) continue;

          plan.steps.push({
            order: order++,
            service: serviceId,
            action: 'deploy',
            dependencies: node.dependencies,
            dependents: node.dependents,
          });
        }
      }
    } catch (error: any) {
      plan.canResolve = false;
      plan.errors.push(error.message);
    }

    return plan;
  }

  /**
   * Export graph as DOT format for visualization
   */
  exportToDot(): string {
    let dot = 'digraph DependencyGraph {\\n';
    dot += '  rankdir=LR;\\n';
    dot += '  node [shape=box];\\n\\n';

    // Add nodes
    for (const [id, node] of this.graph.nodes) {
      const color = this.getNodeColor(node.type);
      dot += `  "${id}" [label="${node.name}\\n(${node.type})" fillcolor=${color} style=filled];\\n`;
    }

    // Add edges
    for (const [from, edges] of this.graph.edges) {
      for (const to of edges) {
        dot += `  "${from}" -> "${to}";\\n`;
      }
    }

    dot += '}';
    return dot;
  }

  /**
   * Export graph as JSON
   */
  exportToJson(): string {
    const nodes = Array.from(this.graph.nodes.values());
    const edges: { from: string; to: string }[] = [];

    for (const [from, toSet] of this.graph.edges) {
      for (const to of toSet) {
        edges.push({ from, to });
      }
    }

    return JSON.stringify({ nodes, edges }, null, 2);
  }

  private getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      service: 'lightblue',
      database: 'lightgreen',
      cache: 'lightyellow',
      queue: 'lightcoral',
      storage: 'lightgray',
    };
    return colors[type] || 'white';
  }

  /**
   * Get dependency chain for a specific node
   */
  getDependencyChain(nodeId: string): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();

    const dfs = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.graph.nodes.get(id);
      if (!node) return;

      for (const dep of node.dependencies) {
        dfs(dep);
      }

      chain.push(id);
    };

    dfs(nodeId);
    return chain;
  }

  /**
   * Get all dependents (transitive) for a node
   */
  getAllDependents(nodeId: string): string[] {
    const dependents: string[] = [];
    const visited = new Set<string>();

    const dfs = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = this.graph.nodes.get(id);
      if (!node) return;

      for (const dependent of node.dependents) {
        if (!dependents.includes(dependent)) {
          dependents.push(dependent);
        }
        dfs(dependent);
      }
    };

    dfs(nodeId);
    return dependents;
  }
}

export const dependencyGraphEngine = new DependencyGraphEngine();
