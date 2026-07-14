/**
 * @file Workspace dependency graph engine for analyzing inter-workspace relationships.
 *
 * Provides graph-based algorithms for cycle detection, topological ordering,
 * build order generation, and critical path analysis across workspaces defined
 * in a workspace definition.
 */

import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition, WorkspaceDependency, WorkspaceEntry } from './workspace-schema';

/**
 * Represents a node in the workspace dependency graph.
 * @description Each node corresponds to a single workspace and tracks its
 * dependencies, dependents, and metadata used by graph algorithms.
 */
export interface WorkspaceNode {
  /** Unique name of the workspace. */
  name: string;
  /** The workspace entry definition. */
  workspace: WorkspaceEntry;
  /** Set of workspace names this node depends on. */
  dependencies: Set<string>;
  /** Set of workspace names that depend on this node. */
  dependents: Set<string>;
  /** Internal metadata used by graph algorithms during traversal. */
  metadata: {
    /** Whether the node has been fully visited during DFS. */
    visited?: boolean;
    /** Whether the node is currently being visited (on the recursion stack). */
    visiting?: boolean;
    /** Assigned topological order index. */
    topologicalOrder?: number;
    /** Assigned level for parallel execution grouping. */
    level?: number;
    /** Whether this node is part of the critical path. */
    criticalPath?: boolean;
  };
}

/**
 * Represents a directed dependency edge between two workspace nodes.
 * @description Carries metadata about the nature and weight of the dependency
 * relationship for use in path optimization and visualization.
 */
export interface DependencyEdge {
  /** Name of the source workspace. */
  from: string;
  /** Name of the target workspace. */
  to: string;
  /** Type of the dependency relationship. */
  type: 'build' | 'dev' | 'test' | 'runtime';
  /** Whether the dependency is optional. */
  optional: boolean;
  /** Optional version constraint for the dependency. */
  version?: string;
  /** Optional conditional expressions under which the dependency applies. */
  conditions?: string[];
  /** Numeric weight used for path optimization algorithms. */
  weight: number;
}

/**
 * Result of cycle detection on the workspace dependency graph.
 * @description Contains whether cycles exist, the cycles found, and any
 * strongly connected components identified.
 */
export interface CycleDetectionResult {
  /** Whether the graph contains at least one cycle. */
  hasCycles: boolean;
  /** List of detected cycles with details. */
  cycles: WorkspaceCycle[];
  /** Strongly connected components found via Tarjan's algorithm. */
  stronglyConnectedComponents: string[][];
}

/**
 * Describes a single detected cycle in the workspace dependency graph.
 * @description Includes the path of the cycle, its type, severity, and
 * suggestions for resolving it.
 */
export interface WorkspaceCycle {
  /** Ordered list of workspace names forming the cycle. */
  path: string[];
  /** Type of dependency edges involved in the cycle. */
  type: 'build' | 'dev' | 'test' | 'runtime' | 'mixed';
  /** Severity level of the cycle. */
  severity: 'error' | 'warning' | 'info';
  /** Suggested actions to resolve the cycle. */
  suggestions: string[];
}

/**
 * Comprehensive analysis result for the workspace dependency graph.
 * @description Aggregates structural metrics, cycle information, ordering,
 * levels, critical path, and orphaned node detection.
 */
export interface GraphAnalysis {
  /** Total number of nodes (workspaces) in the graph. */
  nodeCount: number;
  /** Total number of dependency edges in the graph. */
  edgeCount: number;
  /** Cycle detection results. */
  cycles: CycleDetectionResult;
  /** Topological ordering of workspace names. */
  topologicalOrder: string[];
  /** Workspaces grouped by execution level for parallelism. */
  levels: string[][];
  /** Workspace names along the critical (longest) path. */
  criticalPath: string[];
  /** Workspaces with no dependencies and no dependents. */
  orphanedNodes: string[];
  /** Summary statistics about the graph structure. */
  statistics: {
    /** Maximum depth of the dependency graph. */
    maxDepth: number;
    /** Average number of dependencies per workspace. */
    avgDependencies: number;
    /** Average number of dependents per workspace. */
    avgDependents: number;
    /** Number of isolated strongly connected components. */
    isolatedComponents: number;
  };
}

/**
 * Result of build order generation for the workspace dependency graph.
 * @description Provides ordering of build stages, parallelism info, and
 * dependency mappings for external consumers.
 */
export interface BuildOrder {
  /** Ordered build stages; each stage contains workspaces that can run in parallel. */
  order: string[][];
  /** Whether any build stage has more than one workspace (enabling parallelism). */
  parallelizable: boolean;
  /** Maximum number of workspaces that can be built in parallel in a single stage. */
  maxParallelism: number;
  /** Estimated total build time in seconds. */
  estimatedTime: number;
  /** Map of workspace name to its list of dependency names. */
  dependencies: Map<string, string[]>;
}

/**
 * Workspace dependency graph engine.
 * @description Builds and maintains an in-memory graph of workspace
 * dependencies, providing algorithms for cycle detection, topological
 * ordering, level calculation, critical path finding, and build order
 * generation. The graph is rebuilt from the workspace definition whenever
 * workspaces or dependencies are modified.
 */
export class WorkspaceDependencyGraph {
  private nodes: Map<string, WorkspaceNode> = new Map();
  private edges: Map<string, DependencyEdge[]> = new Map();
  private definition: WorkspaceDefinition;

  /**
   * Creates a new workspace dependency graph from the given definition.
   * @description Stores the definition and immediately builds the in-memory graph.
   * @param definition - The workspace definition to build the graph from.
   */
  constructor(definition: WorkspaceDefinition) {
    this.definition = definition;
    this.buildGraph();
  }

  // Build the dependency graph from workspace definition
  private buildGraph(): void {
    // Clear existing graph
    this.nodes.clear();
    this.edges.clear();

    // Create nodes for all workspaces
    for (const [name, workspace] of Object.entries(this.definition.workspaces)) {
      this.nodes.set(name, {
        name,
        workspace,
        dependencies: new Set(),
        dependents: new Set(),
        metadata: {}
      });
    }

    // Create edges from dependencies
    for (const [workspaceName, dependencies] of Object.entries(this.definition.dependencies)) {
      if (!this.nodes.has(workspaceName)) {
        console.warn(chalk.yellow(`Warning: Dependencies defined for unknown workspace: ${workspaceName}`));
        continue;
      }

      for (const dep of dependencies) {
        if (!this.nodes.has(dep.name)) {
          console.warn(chalk.yellow(`Warning: Unknown dependency '${dep.name}' for workspace '${workspaceName}'`));
          continue;
        }

        this.addEdge(workspaceName, dep);
      }
    }
  }

  // Add a dependency edge
  private addEdge(from: string, dependency: WorkspaceDependency): void {
    const edge: DependencyEdge = {
      from,
      to: dependency.name,
      type: dependency.type,
      optional: dependency.optional || false,
      version: dependency.version,
      conditions: dependency.conditions,
      weight: this.calculateEdgeWeight(dependency)
    };

    // Add to edges map
    if (!this.edges.has(from)) {
      this.edges.set(from, []);
    }
    this.edges.get(from)!.push(edge);

    // Update node dependencies
    const fromNode = this.nodes.get(from)!;
    const toNode = this.nodes.get(dependency.name)!;
    
    fromNode.dependencies.add(dependency.name);
    toNode.dependents.add(from);
  }

  // Calculate edge weight for path optimization
  private calculateEdgeWeight(dependency: WorkspaceDependency): number {
    let weight = 1;
    
    // Higher weight for build dependencies (more critical)
    if (dependency.type === 'build') weight += 3;
    else if (dependency.type === 'runtime') weight += 2;
    else if (dependency.type === 'dev') weight += 1;
    
    // Lower weight for optional dependencies
    if (dependency.optional) weight *= 0.5;
    
    return weight;
  }

  /**
   * Detects cycles in the dependency graph using Depth-First Search.
   * @description Also identifies strongly connected components using
   * Tarjan's algorithm.
   * @returns Cycle detection result containing cycles and strongly connected components.
   */
  detectCycles(): CycleDetectionResult {
    const result: CycleDetectionResult = {
      hasCycles: false,
      cycles: [],
      stronglyConnectedComponents: []
    };

    // Reset metadata
    for (const node of this.nodes.values()) {
      node.metadata.visited = false;
      node.metadata.visiting = false;
    }

    const visiting = new Set<string>();
    const path: string[] = [];

    // DFS from each unvisited node
    for (const nodeName of this.nodes.keys()) {
      if (!this.nodes.get(nodeName)!.metadata.visited) {
        this.detectCyclesDFS(nodeName, visiting, path, result);
      }
    }

    // Find strongly connected components using Tarjan's algorithm
    result.stronglyConnectedComponents = this.findStronglyConnectedComponents();

    return result;
  }

  // DFS helper for cycle detection
  private detectCyclesDFS(
    current: string,
    visiting: Set<string>,
    path: string[],
    result: CycleDetectionResult
  ): void {
    const node = this.nodes.get(current)!;
    
    if (visiting.has(current)) {
      // Found a cycle
      const cycleStart = path.indexOf(current);
      const cyclePath = path.slice(cycleStart).concat([current]);
      
      const cycle = this.analyzeCycle(cyclePath);
      result.cycles.push(cycle);
      result.hasCycles = true;
      return;
    }

    if (node.metadata.visited) {
      return;
    }

    visiting.add(current);
    path.push(current);
    node.metadata.visiting = true;

    // Visit dependencies
    const edges = this.edges.get(current) || [];
    for (const edge of edges) {
      this.detectCyclesDFS(edge.to, visiting, path, result);
    }

    visiting.delete(current);
    path.pop();
    node.metadata.visiting = false;
    node.metadata.visited = true;
  }

  // Analyze a detected cycle to determine type and severity
  private analyzeCycle(cyclePath: string[]): WorkspaceCycle {
    const edgeTypes = new Set<string>();
    const suggestions: string[] = [];

    // Analyze edges in the cycle
    for (let i = 0; i < cyclePath.length - 1; i++) {
      const from = cyclePath[i];
      const to = cyclePath[i + 1];
      const edges = this.edges.get(from) || [];
      const edge = edges.find(e => e.to === to);
      
      if (edge) {
        edgeTypes.add(edge.type);
        
        // Suggest making optional dependencies to break cycle
        if (!edge.optional && edge.type !== 'build') {
          suggestions.push(`Consider making dependency ${from} -> ${to} optional`);
        }
      }
    }

    // Determine cycle type and severity
    let type: WorkspaceCycle['type'] = 'mixed';
    let severity: WorkspaceCycle['severity'] = 'error';

    if (edgeTypes.size === 1) {
      type = Array.from(edgeTypes)[0] as WorkspaceCycle['type'];
    }

    // Build cycles are always errors
    if (edgeTypes.has('build')) {
      severity = 'error';
      suggestions.push('Build cycles must be resolved by restructuring workspace dependencies');
    } 
    // Dev cycles might be warnings
    else if (edgeTypes.has('dev') && !edgeTypes.has('runtime')) {
      severity = 'warning';
      suggestions.push('Development cycles can often be resolved with careful build ordering');
    }
    // Test cycles are usually not critical
    else if (edgeTypes.has('test') && !edgeTypes.has('build') && !edgeTypes.has('runtime')) {
      severity = 'info';
      suggestions.push('Test cycles can be resolved by reorganizing test dependencies');
    }

    return {
      path: cyclePath,
      type,
      severity,
      suggestions
    };
  }

  // Find strongly connected components using Tarjan's algorithm
  private findStronglyConnectedComponents(): string[][] {
    const index = new Map<string, number>();
    const lowLink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const components: string[][] = [];
    let currentIndex = 0;

    const tarjanDFS = (node: string): void => {
      index.set(node, currentIndex);
      lowLink.set(node, currentIndex);
      currentIndex++;
      stack.push(node);
      onStack.add(node);

      // Visit dependencies
      const edges = this.edges.get(node) || [];
      for (const edge of edges) {
        const successor = edge.to;
        
        if (!index.has(successor)) {
          tarjanDFS(successor);
          lowLink.set(node, Math.min(lowLink.get(node)!, lowLink.get(successor)!));
        } else if (onStack.has(successor)) {
          lowLink.set(node, Math.min(lowLink.get(node)!, index.get(successor)!));
        }
      }

      // If node is a root node, pop the stack and create component
      if (lowLink.get(node) === index.get(node)) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== node);
        
        if (component.length > 1) {
          components.push(component);
        }
      }
    };

    // Run Tarjan's algorithm from each unvisited node
    for (const nodeName of this.nodes.keys()) {
      if (!index.has(nodeName)) {
        tarjanDFS(nodeName);
      }
    }

    return components;
  }

  /**
   * Generates a topological ordering of all workspace nodes.
   * @description Uses Kahn's algorithm based on in-degree calculation.
   * @returns Array of workspace names in topological order.
   * @throws {ValidationError} If the graph contains cycles, making a topological order impossible.
   */
  generateTopologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degrees
    for (const nodeName of this.nodes.keys()) {
      inDegree.set(nodeName, 0);
    }

    // Calculate in-degrees
    for (const [_from, edges] of this.edges) {
      for (const edge of edges) {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      }
    }

    // Find nodes with no incoming edges
    for (const [nodeName, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeName);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // Update in-degrees of dependent nodes
      const edges = this.edges.get(current) || [];
      for (const edge of edges) {
        const newDegree = inDegree.get(edge.to)! - 1;
        inDegree.set(edge.to, newDegree);
        
        if (newDegree === 0) {
          queue.push(edge.to);
        }
      }
    }

    // Check if all nodes were processed (no cycles)
    if (result.length !== this.nodes.size) {
      throw new ValidationError('Cannot generate topological order: graph contains cycles');
    }

    return result;
  }

  /**
   * Calculates workspace levels for parallel execution.
   * @description Assigns each workspace to a level based on the longest path
   * from a root node, so that workspaces in the same level can be processed
   * in parallel.
   * @returns Array of levels, each containing the workspace names at that level.
   */
  calculateLevels(): string[][] {
    const levels: string[][] = [];
    const nodeLevel = new Map<string, number>();

    // Reset metadata
    for (const node of this.nodes.values()) {
      node.metadata.level = undefined;
    }

    // Calculate levels using longest path from roots
    const calculateLevel = (nodeName: string): number => {
      const node = this.nodes.get(nodeName)!;
      
      if (node.metadata.level !== undefined) {
        return node.metadata.level;
      }

      let maxDepLevel = -1;
      
      // Find maximum level of dependencies
      for (const depName of node.dependencies) {
        const depLevel = calculateLevel(depName);
        maxDepLevel = Math.max(maxDepLevel, depLevel);
      }

      const level = maxDepLevel + 1;
      node.metadata.level = level;
      nodeLevel.set(nodeName, level);

      return level;
    };

    // Calculate levels for all nodes
    for (const nodeName of this.nodes.keys()) {
      calculateLevel(nodeName);
    }

    // Group nodes by level
    const maxLevel = Math.max(...Array.from(nodeLevel.values()));
    for (let i = 0; i <= maxLevel; i++) {
      levels[i] = [];
    }

    for (const [nodeName, level] of nodeLevel) {
      levels[level].push(nodeName);
    }

    return levels.filter(level => level.length > 0);
  }

  /**
   * Finds the critical path (longest weighted path) through the graph.
   * @description Uses topological ordering and edge weights to determine
   * the longest path, which represents the minimum-time build sequence.
   * @returns Array of workspace names forming the critical path, or an empty
   * array if the graph contains cycles.
   */
  findCriticalPath(): string[] {
    const distances = new Map<string, number>();
    const predecessors = new Map<string, string | null>();
    
    // Initialize distances
    for (const nodeName of this.nodes.keys()) {
      distances.set(nodeName, -Infinity);
      predecessors.set(nodeName, null);
    }

    // Find root nodes (no dependencies)
    const roots = Array.from(this.nodes.keys()).filter(name => 
      this.nodes.get(name)!.dependencies.size === 0
    );

    // Set root distances to 0
    for (const root of roots) {
      distances.set(root, 0);
    }

    // Use topological order to calculate longest paths
    try {
      const topOrder = this.generateTopologicalOrder();
      
      for (const current of topOrder) {
        const currentDist = distances.get(current)!;
        
        if (currentDist === -Infinity) continue;
        
        const edges = this.edges.get(current) || [];
        for (const edge of edges) {
          const newDist = currentDist + edge.weight;
          
          if (newDist > distances.get(edge.to)!) {
            distances.set(edge.to, newDist);
            predecessors.set(edge.to, current);
          }
        }
      }

      // Find the node with maximum distance (end of critical path)
      let maxDist = -Infinity;
      let endNode = '';
      
      for (const [nodeName, dist] of distances) {
        if (dist > maxDist) {
          maxDist = dist;
          endNode = nodeName;
        }
      }

      // Reconstruct path
      const path: string[] = [];
      let current: string | null = endNode;
      
      while (current !== null) {
        path.unshift(current);
        current = predecessors.get(current)!;
      }

      // Mark critical path nodes
      for (const nodeName of path) {
        this.nodes.get(nodeName)!.metadata.criticalPath = true;
      }

      return path;
      
    } catch (error) {
      // Graph has cycles, cannot find critical path
      return [];
    }
  }

  /**
   * Generates an optimal build order based on dependency levels.
   * @description Groups workspaces into parallelizable stages and computes
   * estimated build time and maximum parallelism.
   * @returns Build order result with stages, parallelism info, and dependency map.
   * @throws {ValidationError} If the graph contains cycles or build order cannot be generated.
   */
  generateBuildOrder(): BuildOrder {
    try {
      const levels = this.calculateLevels();
      
      // Calculate estimated build times (simplified)
      const estimatedTime = levels.length * 60; // Assume 1 minute per level
      
      // Build dependency map for external use
      const dependencyMap = new Map<string, string[]>();
      for (const [nodeName, node] of this.nodes) {
        dependencyMap.set(nodeName, Array.from(node.dependencies));
      }

      return {
        order: levels,
        parallelizable: levels.some(level => level.length > 1),
        maxParallelism: Math.max(...levels.map(level => level.length)),
        estimatedTime,
        dependencies: dependencyMap
      };
      
    } catch (error) {
      throw new ValidationError(`Cannot generate build order: ${(error as Error).message}`);
    }
  }

  /**
   * Performs a comprehensive analysis of the dependency graph.
   * @description Combines cycle detection, topological ordering, level
   * calculation, critical path finding, orphaned node detection, and
   * summary statistics into a single result.
   * @returns Full graph analysis including metrics, ordering, and statistics.
   */
  analyzeGraph(): GraphAnalysis {
    const cycles = this.detectCycles();
    let topologicalOrder: string[] = [];
    let levels: string[][] = [];
    let criticalPath: string[] = [];

    try {
      topologicalOrder = this.generateTopologicalOrder();
      levels = this.calculateLevels();
      criticalPath = this.findCriticalPath();
    } catch (error) {
      // Graph has cycles, some analysis cannot be performed
    }

    // Find orphaned nodes (no dependencies and no dependents)
    const orphanedNodes = Array.from(this.nodes.keys()).filter(name => {
      const node = this.nodes.get(name)!;
      return node.dependencies.size === 0 && node.dependents.size === 0;
    });

    // Calculate statistics
    const dependencies = Array.from(this.nodes.values()).map(n => n.dependencies.size);
    const dependents = Array.from(this.nodes.values()).map(n => n.dependents.size);
    
    const statistics = {
      maxDepth: levels.length,
      avgDependencies: dependencies.length > 0 ? dependencies.reduce((a, b) => a + b, 0) / dependencies.length : 0,
      avgDependents: dependents.length > 0 ? dependents.reduce((a, b) => a + b, 0) / dependents.length : 0,
      isolatedComponents: cycles.stronglyConnectedComponents.length
    };

    return {
      nodeCount: this.nodes.size,
      edgeCount: Array.from(this.edges.values()).reduce((total, edges) => total + edges.length, 0),
      cycles,
      topologicalOrder,
      levels,
      criticalPath,
      orphanedNodes,
      statistics
    };
  }

  /**
   * Produces graph visualization data for rendering in UI tools.
   * @description Converts internal nodes and edges into a simplified format
   * with display labels, groups, levels, and edge colors.
   * @returns An object containing arrays of node and edge descriptors suitable for visualization.
   */
  getVisualizationData(): {
    nodes: Array<{ id: string; label: string; group: string; level?: number }>;
    edges: Array<{ from: string; to: string; label: string; color: string }>;
  } {
    const nodes = Array.from(this.nodes.entries()).map(([name, node]) => ({
      id: name,
      label: name,
      group: node.workspace.type,
      level: node.metadata.level
    }));

    const edges: Array<{ from: string; to: string; label: string; color: string }> = [];
    
    for (const [_from, edgeList] of this.edges) {
      for (const edge of edgeList) {
        const color = this.getEdgeColor(edge.type);
        edges.push({
          from: edge.from,
          to: edge.to,
          label: edge.type,
          color
        });
      }
    }

    return { nodes, edges };
  }

  // Get edge color based on dependency type
  private getEdgeColor(type: string): string {
    const colors = {
      build: '#ff4444',    // Red for build dependencies
      runtime: '#4444ff',  // Blue for runtime dependencies
      dev: '#44ff44',      // Green for dev dependencies
      test: '#ffaa44'      // Orange for test dependencies
    };
    
    return colors[type as keyof typeof colors] || '#888888';
  }

  /**
   * Retrieves a workspace node by name.
   * @param name - The name of the workspace to look up.
   * @returns The matching workspace node, or `undefined` if not found.
   */
  getNode(name: string): WorkspaceNode | undefined {
    return this.nodes.get(name);
  }

  /**
   * Returns a copy of all workspace nodes in the graph.
   * @returns A new Map of workspace name to workspace node.
   */
  getAllNodes(): Map<string, WorkspaceNode> {
    return new Map(this.nodes);
  }

  /**
   * Retrieves all dependency edges originating from the given workspace.
   * @param from - The name of the source workspace.
   * @returns Array of dependency edges from the workspace, or an empty array if none exist.
   */
  getEdges(from: string): DependencyEdge[] {
    return this.edges.get(from) || [];
  }

  /**
   * Checks whether a directed path exists between two workspaces.
   * @description Performs a breadth-first search from the source to the target.
   * @param from - The name of the source workspace.
   * @param to - The name of the target workspace.
   * @returns `true` if a path exists from `from` to `to`, otherwise `false`.
   */
  hasPath(from: string, to: string): boolean {
    if (from === to) return true;
    
    const visited = new Set<string>();
    const queue = [from];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current === to) return true;
      if (visited.has(current)) continue;
      
      visited.add(current);
      
      const edges = this.edges.get(current) || [];
      for (const edge of edges) {
        queue.push(edge.to);
      }
    }
    
    return false;
  }

  /**
   * Adds a new workspace to the graph and rebuilds it.
   * @param name - The unique name for the new workspace.
   * @param workspace - The workspace entry definition to add.
   */
  addWorkspace(name: string, workspace: WorkspaceEntry): void {
    this.definition.workspaces[name] = workspace;
    this.buildGraph(); // Rebuild graph
  }

  /**
   * Removes a workspace and all references to it from the graph, then rebuilds.
   * @description Also removes any dependency entries pointing to the removed workspace.
   * @param name - The name of the workspace to remove.
   */
  removeWorkspace(name: string): void {
    delete this.definition.workspaces[name];
    delete this.definition.dependencies[name];
    
    // Remove dependencies to this workspace
    for (const [workspaceName, deps] of Object.entries(this.definition.dependencies)) {
      this.definition.dependencies[workspaceName] = deps.filter(dep => dep.name !== name);
    }
    
    this.buildGraph(); // Rebuild graph
  }

  /**
   * Replaces the dependency list for a workspace and rebuilds the graph.
   * @param workspaceName - The name of the workspace whose dependencies are being updated.
   * @param dependencies - The new list of workspace dependencies.
   */
  updateDependencies(workspaceName: string, dependencies: WorkspaceDependency[]): void {
    this.definition.dependencies[workspaceName] = dependencies;
    this.buildGraph(); // Rebuild graph
  }
}

/**
 * Creates a new workspace dependency graph from a workspace definition.
 * @description Convenience factory for instantiating a `WorkspaceDependencyGraph`.
 * @param definition - The workspace definition to build the graph from.
 * @returns A new `WorkspaceDependencyGraph` instance.
 */
export function createWorkspaceDependencyGraph(definition: WorkspaceDefinition): WorkspaceDependencyGraph {
  return new WorkspaceDependencyGraph(definition);
}

/**
 * Validates workspace dependencies by analyzing the dependency graph.
 * @description Builds a graph from the definition and checks for circular
 * dependencies (reported as errors) and orphaned workspaces (reported as warnings).
 * @param definition - The workspace definition to validate.
 * @returns Array of validation errors for any critical issues found; empty if valid.
 */
export function validateWorkspaceDependencies(definition: WorkspaceDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  
  try {
    const graph = new WorkspaceDependencyGraph(definition);
    const analysis = graph.analyzeGraph();
    
    // Report cycle errors
    for (const cycle of analysis.cycles.cycles) {
      if (cycle.severity === 'error') {
        errors.push(new ValidationError(
          `Circular dependency detected: ${cycle.path.join(' → ')}`
        ));
      }
    }
    
    // Report orphaned nodes as warnings (not errors)
    if (analysis.orphanedNodes.length > 0) {
      console.warn(chalk.yellow(`Warning: Orphaned workspaces found: ${analysis.orphanedNodes.join(', ')}`));
    }
    
  } catch (error) {
    errors.push(new ValidationError(`Dependency validation failed: ${(error as Error).message}`));
  }
  
  return errors;
}