// Ink-based TUI with Interactive Graph Visualization
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { workspaceParser, WorkspaceConfig, ServiceConfig, ValidationResult } from '../parsers/workspace-parser';
import { buildWorkspaceSummary, buildConfigHealth, WorkspaceSummary as MonorepoWorkspaceSummary } from './workspace';
import { CanonicalHealth, CanonicalHealthStatus } from '../utils/health-normalizer';
import { exec } from 'child_process';
import * as chokidar from 'chokidar';

let inkRender: any;
let Box: any;
let Text: any;
let useInput: any;
let useApp: any;
let Spinner: any;

function nativeImport<T = any>(specifier: string): Promise<T> {
  if (process.env.VITEST) {
    return import(specifier) as Promise<T>;
  }
  return new Function('specifier', 'return import(specifier)')(specifier);
}

export async function loadInkRuntime(): Promise<void> {
  if (inkRender && Box && Text && useInput && useApp && Spinner) {
    return;
  }

  const ink = await nativeImport<any>('ink');
  const spinnerModule = await nativeImport<any>('ink-spinner');

  inkRender = ink.render;
  Box = ink.Box;
  Text = ink.Text;
  useInput = ink.useInput;
  useApp = ink.useApp;
  Spinner = spinnerModule.default || spinnerModule;
}

// Helper function to open URL in default browser
function openUrl(url: string): void {
  const command = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' :
                  'xdg-open';
  exec(`${command} ${url}`, (error) => {
    if (error) {
      console.error(`Failed to open URL: ${error.message}`);
    }
  });
}

// Helper function to open file in default editor
function openFile(filePath: string): void {
  const editor = process.env.EDITOR || process.env.VISUAL || 'code';
  exec(`${editor} "${filePath}"`, (error) => {
    if (error) {
      console.error(`Failed to open file: ${error.message}`);
    }
  });
}

// Helper function to get service URLs
function getServiceUrl(service: ServiceConfig): string | null {
  if (service.port) {
    return `http://localhost:${service.port}`;
  }
  return null;
}

// Helper function to get service docs URL
function getServiceDocsUrl(service: ServiceConfig): string | null {
  // Generate docs URL based on framework
  if (service.framework) {
    const docsUrls: Record<string, string> = {
      'react': 'https://react.dev',
      'vue': 'https://vuejs.org',
      'svelte': 'https://svelte.dev',
      'express': 'https://expressjs.com',
      'fastify': 'https://fastify.io',
      'nestjs': 'https://docs.nestjs.com',
      'nextjs': 'https://nextjs.org/docs',
      'nuxt': 'https://nuxt.com/docs',
    };
    const framework = String(service.framework);
    return docsUrls[framework] || null;
  }
  return null;
}

// Types for TUI state
type GraphNodeType =
  | 'frontend'
  | 'backend'
  | 'worker'
  | 'database'
  | 'queue'
  | 'cache'
  | 'function'
  | 'app'
  | 'package'
  | 'lib'
  | 'tool'
  | 'unknown';

interface GraphNode {
  id: string;
  name: string;
  type: GraphNodeType;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  framework?: string;
  language?: string;
  version?: string;
  path?: string;
  dependencies?: string[];
  scripts?: Record<string, string>;
  port?: number;
  x: number;
  y: number;
  // Animation state
  animating?: boolean;
  animationProgress?: number; // 0 to 1
  animationType?: 'deploying' | 'scaling' | 'health-change' | 'appearing' | 'disappearing';
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'dependency' | 'api' | 'event' | 'data';
}

interface TUIState {
  mode: 'graph' | 'details' | 'help' | 'search' | 'bookmarks' | 'analysis';
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: string | null;
  targetNode: string | null; // For dependency path visualization
  scrollOffset: { x: number; y: number };
  zoom: number; // Zoom level (0.1 to 5.0, where 1.0 is 100%)
  workspaceConfig: WorkspaceConfig | null;
  filter: 'all' | GraphNodeType | 'network' | 'services';
  searchQuery: string; // Search query for filtering nodes
  filterLanguage: string; // Filter by language
  filterFramework: string; // Filter by framework
  filterStatus: 'all' | 'healthy' | 'warning' | 'error' | 'unknown'; // Filter by health status
  clusteringEnabled: boolean; // Whether clustering is active
  clusteringBy: 'language' | 'framework' | 'type' | 'team'; // What to cluster by
  layoutMode: 'force-directed' | 'hierarchical' | 'circular' | 'organic'; // Graph layout algorithm
  loading: boolean;
  error: string | null;
  detailsScrollOffset: number; // Scroll offset for details view
  bookmarks: GraphBookmark[]; // Saved graph views
  selectedBookmark: number | null; // Currently selected bookmark index
  workspaceRoot: string;
  workspaceName: string;
  workspaceVersion: string;
  workspaceDescription: string;
  packageManager: string;
  workspaceReloading: boolean; // True when workspace is being reloaded
  lastModifiedTime: number | null; // Last modification time of workspace file
  userName: string; // Current user's name
  tourActive: boolean; // Whether tour mode is active
  tourStep: number; // Current tour step (0-based)
  tourCompleted: boolean; // Whether user has completed the tour
  dependencyAnalysis: DependencyAnalysis | null; // Dependency analysis results
  analysisServiceFilter: string | null; // Filter analysis by service
  workspaceHealth: CanonicalHealth | null; // Real, normalized workspace health
}

interface GraphBookmark {
  name: string;
  timestamp: number;
  zoom: number;
  scrollOffset: { x: number; y: number };
  filter: TUIState['filter'];
  filterLanguage: string;
  filterFramework: string;
  filterStatus: 'all' | 'healthy' | 'warning' | 'error' | 'unknown';
  layoutMode: 'force-directed' | 'hierarchical' | 'circular' | 'organic';
  clusteringEnabled: boolean;
  clusteringBy: 'language' | 'framework' | 'type' | 'team';
  selectedNode: string | null;
}

interface InkTUIProps {
  projectPath?: string;
  mode?: 'dashboard' | 'init' | 'manage' | 'config';
  debug?: boolean;
}

// Tour step definitions for guided onboarding
interface TourStep {
  id: string;
  title: string;
  description: string;
  action?: string; // Optional keyboard shortcut to demonstrate
  highlightArea?: 'header' | 'graph' | 'details' | 'statusbar' | null;
  setupState?: Partial<TUIState>; // Optional state to apply during this step
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Re-Shell TUI',
    description: 'This interactive tour will guide you through the main features of the Re-Shell Terminal User Interface. Press Enter to continue.',
  },
  {
    id: 'graph-overview',
    title: 'Graph Visualization',
    description: 'The main graph shows all your microservices and their dependencies. Each node represents a service with color-coded health status. Use Arrow keys to navigate between nodes.',
    highlightArea: 'graph',
  },
  {
    id: 'selection',
    title: 'Service Selection',
    description: 'Press Enter on a selected node to view detailed information including dependencies and configuration.',
    action: 'Enter',
    highlightArea: 'details',
  },
  {
    id: 'navigation',
    title: 'Navigation Controls',
    description: 'Use Arrow keys to select nodes. Press g to enable mouse dragging. Scroll with mouse wheel or use +/- to zoom in/out.',
    action: 'Arrow Keys / g / +/-',
    highlightArea: 'graph',
  },
  {
    id: 'filters',
    title: 'Filter Services',
    description: 'Press f to cycle through filters: all, frontend, backend, worker, database. Use number keys 1-5 for quick views (services, databases, queues, caches, network).',
    action: 'f or 1-5',
  },
  {
    id: 'layouts',
    title: 'Graph Layouts',
    description: 'Press l to change layout algorithms: force-directed (physics-based), hierarchical (layered), circular (ring), or organic (natural tree).',
    action: 'l',
    highlightArea: 'graph',
  },
  {
    id: 'search',
    title: 'Search Services',
    description: 'Press / to open search and filter services by name. Type your query and press Enter to filter.',
    action: '/',
  },
  {
    id: 'clustering',
    title: 'Clustering',
    description: 'Press c to enable clustering and group services by language, framework, type, or team. Press c again to cycle through clustering options.',
    action: 'c',
  },
  {
    id: 'bookmarks',
    title: 'Bookmarks',
    description: 'Press b to save current view as a bookmark. Press B to view and restore saved bookmarks. Useful for quickly switching between different project views.',
    action: 'b / B',
  },
  {
    id: 'hotlinks',
    title: 'Hot Links',
    description: 'Press o to open service URL in browser, e to open code in editor, or D to open framework documentation.',
    action: 'o / e / D',
  },
  {
    id: 'realtime-updates',
    title: 'Real-time Updates',
    description: 'The TUI automatically watches your workspace file. Changes are detected and the graph reloads with smooth animations.',
  },
  {
    id: 'help',
    title: 'Help & Reference',
    description: 'Press ? or h at any time to view the complete keyboard reference. Press q to quit the TUI.',
    action: '? / h / q',
    highlightArea: 'header',
  },
  {
    id: 'complete',
    title: 'Tour Complete!',
    description: 'You\'ve learned the basics of the Re-Shell TUI. Press Enter to exit tour mode and start exploring. Remember: press ? anytime for help.',
  },
];

// Dependency analysis types and recommendations
interface DependencyIssue {
  type: 'security' | 'performance' | 'outdated' | 'duplicate' | 'missing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  service: string;
  dependency: string;
  currentVersion?: string;
  recommendedVersion?: string;
  description: string;
  recommendation: string;
}

interface DependencyAnalysis {
  totalDependencies: number;
  issues: DependencyIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  servicesAnalyzed: number;
}

// Analyze dependencies for security and performance issues
function analyzeDependencies(state: TUIState): DependencyAnalysis {
  const issues: DependencyIssue[] = [];
  let totalDependencies = 0;
  let servicesAnalyzed = 0;
  const dependencyVersions = new Map<string, Set<string>>();

  state.nodes.forEach(node => {
    if (!node.path || !state.workspaceRoot) {
      return;
    }

    const packageJsonPath = path.join(state.workspaceRoot, node.path, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return;
    }

    servicesAnalyzed++;

    try {
      const packageJson = fs.readJsonSync(packageJsonPath);
      const dependencyGroups = [
        packageJson.dependencies || {},
        packageJson.devDependencies || {},
        packageJson.peerDependencies || {},
        packageJson.optionalDependencies || {},
      ];

      for (const dependencies of dependencyGroups) {
        for (const [dependency, version] of Object.entries(dependencies)) {
          totalDependencies++;
          if (!dependencyVersions.has(dependency)) {
            dependencyVersions.set(dependency, new Set<string>());
          }
          dependencyVersions.get(dependency)!.add(String(version));
        }
      }
    } catch (error: unknown) {
      issues.push({
        type: 'missing',
        severity: 'low',
        service: node.id,
        dependency: 'package.json',
        description: `Could not read dependency manifest: ${(error as Error).message}`,
        recommendation: 'Fix the package.json file so dependency inventory can include this workspace.',
      });
    }
  });

  for (const [dependency, versions] of dependencyVersions.entries()) {
    if (versions.size > 1) {
      issues.push({
        type: 'duplicate',
        severity: 'low',
        service: 'workspace',
        dependency,
        description: `Multiple declared versions found: ${Array.from(versions).join(', ')}`,
        recommendation: 'Review whether the workspace should align this dependency version.',
      });
    }
  }

  const summary = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
  };

  return {
    totalDependencies,
    issues,
    summary,
    servicesAnalyzed,
  };
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'red';
    case 'high': return 'yellow';
    case 'medium': return 'blue';
    case 'low': return 'gray';
    default: return 'white';
  }
}

function getIssueTypeIcon(type: string): string {
  switch (type) {
    case 'security': return '🔒';
    case 'performance': return '⚡';
    case 'outdated': return '📦';
    case 'duplicate': return '🔁';
    case 'missing': return '❓';
    default: return '•';
  }
}

function initialNodePosition(index: number, total: number, width: number, height: number): { x: number; y: number } {
  if (total <= 1) {
    return { x: width / 2, y: height / 2 };
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(4, Math.min(width, height) / 2 - 8);
  const angle = (2 * Math.PI * index) / total;

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
}

// Force-directed graph layout algorithm
function calculateLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  const positionedNodes = [...nodes];
  const iterations = 50;
  const repulsion = 5000;
  const attraction = 0.01;
  const damping = 0.9;

  positionedNodes.forEach((node, index) => {
    const position = initialNodePosition(index, positionedNodes.length, width, height);
    node.x = position.x;
    node.y = position.y;
  });

  // Force-directed layout
  for (let iter = 0; iter < iterations; iter++) {
    const velocities: Record<string, { x: number; y: number }> = {};

    // Initialize velocities
    positionedNodes.forEach(node => {
      velocities[node.id] = { x: 0, y: 0 };
    });

    // Repulsion between all nodes
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const node1 = positionedNodes[i];
        const node2 = positionedNodes[j];
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        velocities[node1.id].x -= fx;
        velocities[node1.id].y -= fy;
        velocities[node2.id].x += fx;
        velocities[node2.id].y += fy;
      }
    }

    // Attraction along edges
    edges.forEach(edge => {
      const node1 = positionedNodes.find(n => n.id === edge.from);
      const node2 = positionedNodes.find(n => n.id === edge.to);
      if (node1 && node2) {
        const dx = node2.x - node1.x;
        const dy = node2.y - node1.y;

        const fx = dx * attraction;
        const fy = dy * attraction;

        velocities[node1.id].x += fx;
        velocities[node1.id].y += fy;
        velocities[node2.id].x -= fx;
        velocities[node2.id].y -= fy;
      }
    });

    // Update positions with damping
    positionedNodes.forEach(node => {
      node.x += velocities[node.id].x * damping;
      node.y += velocities[node.id].y * damping;

      // Constrain to bounds
      node.x = Math.max(5, Math.min(width - 5, node.x));
      node.y = Math.max(5, Math.min(height - 5, node.y));
    });
  }

  return positionedNodes;
}

// Hierarchical (tree) layout algorithm
function calculateHierarchicalLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  const positionedNodes = [...nodes];

  // Build adjacency list and find root nodes (nodes with no incoming edges)
  const incomingEdges: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};

  nodes.forEach(node => {
    incomingEdges[node.id] = 0;
    adjacency[node.id] = [];
  });

  edges.forEach(edge => {
    incomingEdges[edge.to] = (incomingEdges[edge.to] || 0) + 1;
    adjacency[edge.from].push(edge.to);
  });

  // Find root nodes (no incoming edges)
  const roots = nodes.filter(n => incomingEdges[n.id] === 0);
  if (roots.length === 0 && nodes.length > 0) {
    // If no roots found, use first node as root
    roots.push(nodes[0]);
  }

  // Assign levels using BFS
  const levels: Record<number, GraphNode[]> = {};
  const visited = new Set<string>();
  const queue: Array<{ node: GraphNode; level: number }> = [];

  roots.forEach(root => {
    queue.push({ node: root, level: 0 });
    visited.add(root.id);
  });

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;

    if (!levels[level]) levels[level] = [];
    levels[level].push(node);

    adjacency[node.id].forEach(childId => {
      if (!visited.has(childId)) {
        visited.add(childId);
        const childNode = nodes.find(n => n.id === childId);
        if (childNode) {
          queue.push({ node: childNode, level: level + 1 });
        }
      }
    });
  }

  // Position nodes by level
  const levelCount = Object.keys(levels).length;
  const levelHeight = height / (levelCount + 1);

  Object.entries(levels).forEach(([levelStr, levelNodes]) => {
    const level = parseInt(levelStr);
    const y = (level + 1) * levelHeight;
    const levelWidth = width / (levelNodes.length + 1);

    levelNodes.forEach((node, index) => {
      const x = (index + 1) * levelWidth;
      const nodeIndex = positionedNodes.findIndex(n => n.id === node.id);
      if (nodeIndex !== -1) {
        positionedNodes[nodeIndex].x = x;
        positionedNodes[nodeIndex].y = y;
      }
    });
  });

  return positionedNodes;
}

// Circular layout algorithm
function calculateCircularLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  const positionedNodes = [...nodes];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 10;

  // Arrange nodes in a circle
  nodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    const nodeIndex = positionedNodes.findIndex(n => n.id === node.id);
    if (nodeIndex !== -1) {
      positionedNodes[nodeIndex].x = x;
      positionedNodes[nodeIndex].y = y;
    }
  });

  return positionedNodes;
}

// Organic layout algorithm (balanced, natural layout)
function calculateOrganicLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  const positionedNodes = [...nodes];
  const iterations = 100;
  const optimalDistance = Math.sqrt((width * height) / nodes.length);

  positionedNodes.forEach((node, index) => {
    const position = initialNodePosition(index, positionedNodes.length, width, height);
    node.x = position.x;
    node.y = position.y;
  });

  // Cooling layout pass.
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - iter / iterations; // Cooling factor

    positionedNodes.forEach(node => {
      let forceX = 0;
      let forceY = 0;

      // Repulsion from all other nodes
      positionedNodes.forEach(other => {
        if (node.id !== other.id) {
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // Strong repulsion at close range
          const repulsion = (optimalDistance * optimalDistance) / (dist * dist);
          forceX += (dx / dist) * repulsion;
          forceY += (dy / dist) * repulsion;
        }
      });

      // Attraction along edges
      edges.forEach(edge => {
        if (edge.from === node.id || edge.to === node.id) {
          const otherId = edge.from === node.id ? edge.to : edge.from;
          const other = positionedNodes.find(n => n.id === otherId);
          if (other) {
            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Spring attraction toward optimal distance
            const attraction = (dist - optimalDistance) * 0.1;
            forceX += (dx / dist) * attraction;
            forceY += (dy / dist) * attraction;
          }
        }
      });

      // Gravity toward center
      const centerX = width / 2;
      const centerY = height / 2;
      forceX += (centerX - node.x) * 0.01;
      forceY += (centerY - node.y) * 0.01;

      // Apply force with temperature damping
      node.x += forceX * temperature * 0.5;
      node.y += forceY * temperature * 0.5;

      // Constrain to bounds
      node.x = Math.max(10, Math.min(width - 10, node.x));
      node.y = Math.max(10, Math.min(height - 10, node.y));
    });
  }

  return positionedNodes;
}

// Map the canonical, workspace-level health status onto the per-node health
// tri-state used by the graph. Health is computed for the whole workspace (the
// normalizer does not produce per-service scores yet), so every node reflects
// the same real workspace health rather than a fabricated per-node value. When
// no health has been computed, nodes stay 'unknown' (honest empty state).
function nodeStatusFromHealth(
  health: CanonicalHealth | null
): GraphNode['status'] {
  if (!health) {
    return 'unknown';
  }
  const map: Record<CanonicalHealthStatus, GraphNode['status']> = {
    healthy: 'healthy',
    degraded: 'warning',
    critical: 'error',
  };
  return map[health.status];
}

// Apply a single workspace-level health status to every node, returning new
// node objects (no mutation).
function applyHealthToNodes(nodes: GraphNode[], health: CanonicalHealth | null): GraphNode[] {
  const status = nodeStatusFromHealth(health);
  return nodes.map(node => ({ ...node, status }));
}

// Convert workspace config to graph nodes
function workspaceToGraph(config: WorkspaceConfig): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  if (config.services) {
    Object.entries(config.services).forEach(([id, service]: [string, any]) => {
      nodes.push({
        id,
        name: service.name || id,
        type: normalizeNodeType(service.type || 'unknown'),
        status: 'unknown',
        framework: normalizeFramework(service.framework),
        language: service.language,
        path: service.path,
        port: service.port,
        dependencies: findInternalServiceDependencies(service, config.services),
        x: 0,
        y: 0,
      });
    });
  }

  for (const node of nodes) {
    for (const dependency of node.dependencies || []) {
      edges.push({ from: node.id, to: dependency, type: 'dependency' });
    }
  }

  return { nodes, edges };
}

function summaryToGraph(summary: MonorepoWorkspaceSummary): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const workspaceByName = new Map(summary.workspaces.map(workspace => [workspace.name, workspace]));
  const graphEntries = [...summary.graph.apps, ...summary.graph.services];
  const entries = graphEntries.length > 0
    ? graphEntries
    : summary.workspaces.map(workspace => ({
        name: workspace.name,
        path: workspace.path,
        framework: workspace.framework ?? null,
        dependencies: workspace.dependencies.filter(dependency => workspaceByName.has(dependency)),
      }));

  const nodes = entries.map(entry => {
    const workspace = workspaceByName.get(entry.name);
    return {
      id: entry.name,
      name: entry.name,
      type: normalizeNodeType(workspace?.type || 'unknown'),
      status: 'unknown' as const,
      framework: entry.framework || workspace?.framework,
      version: workspace?.version,
      path: entry.path,
      dependencies: entry.dependencies,
      x: 0,
      y: 0,
    };
  });

  const edges = entries.flatMap(entry =>
    entry.dependencies.map(dependency => ({
      from: entry.name,
      to: dependency,
      type: 'dependency' as const,
    }))
  );

  return { nodes, edges };
}

function normalizeFramework(framework: ServiceConfig['framework'] | string | null | undefined): string | undefined {
  if (!framework) {
    return undefined;
  }
  if (typeof framework === 'string') {
    return framework;
  }
  return framework.name;
}

function normalizeNodeType(type: string): GraphNodeType {
  const allowed: GraphNodeType[] = [
    'frontend',
    'backend',
    'worker',
    'database',
    'queue',
    'cache',
    'function',
    'app',
    'package',
    'lib',
    'tool',
    'unknown',
  ];
  return allowed.includes(type as GraphNodeType) ? type as GraphNodeType : 'unknown';
}

function findInternalServiceDependencies(service: ServiceConfig, services: WorkspaceConfig['services']): string[] {
  const declaredDependencies = {
    ...(service.dependencies?.production || {}),
    ...(service.dependencies?.development || {}),
  };
  return Object.keys(declaredDependencies).filter(dependency => Boolean(services[dependency]));
}

async function findWorkspaceConfig(startPath: string): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  try {
    const stats = await fs.stat(currentPath);
    if (!stats.isDirectory()) {
      currentPath = path.dirname(currentPath);
    }
  } catch {
    currentPath = path.dirname(currentPath);
  }

  const rootPath = path.parse(currentPath).root;
  let depth = 0;
  while (currentPath !== rootPath && depth < 20) {
    const candidate = path.join(currentPath, 're-shell.workspaces.yaml');
    if (await fs.pathExists(candidate)) {
      return candidate;
    }
    currentPath = path.dirname(currentPath);
    depth++;
  }

  return null;
}

interface LoadedWorkspaceData {
  root: string;
  name: string;
  version: string;
  description: string;
  packageManager: string;
  config: WorkspaceConfig | null;
  configPath: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  health: CanonicalHealth | null;
}

async function loadWorkspaceData(projectPath: string): Promise<LoadedWorkspaceData> {
  const resolvedProjectPath = path.resolve(projectPath);
  const configPath = await findWorkspaceConfig(resolvedProjectPath);

  if (configPath) {
    const result: ValidationResult = workspaceParser.parse(configPath);
    if (!result.valid || !result.config) {
      throw new Error(result.errors.map(error => error.message).join(', ') || 'Workspace configuration is invalid');
    }

    const { nodes, edges } = workspaceToGraph(result.config);
    // Real health, scoped to this workspace config, via the shared normalizer.
    // Failure here must not block the graph from rendering, so fall back to
    // 'unknown' node status on error.
    let health: CanonicalHealth | null = null;
    try {
      health = await buildConfigHealth(configPath);
    } catch {
      health = null;
    }
    return {
      root: path.dirname(configPath),
      name: result.config.name,
      version: result.config.version,
      description: result.config.description || '',
      packageManager: 'workspace',
      config: result.config,
      configPath,
      nodes: applyHealthToNodes(nodes, health),
      edges,
      health,
    };
  }

  try {
    const summary = await buildWorkspaceSummary(resolvedProjectPath);
    const { nodes, edges } = summaryToGraph(summary);
    return {
      root: summary.root,
      name: path.basename(summary.root),
      version: '',
      description: '',
      packageManager: summary.packageManager,
      config: null,
      configPath: null,
      // summary.health is the normalized, real workspace health.
      nodes: applyHealthToNodes(nodes, summary.health),
      edges,
      health: summary.health,
    };
  } catch {
    throw new Error('NOT_IN_MONOREPO: Not in a monorepo. Run this command from a monorepo root or workspace.');
  }
}

// Get color for health status
function getHealthColor(status: 'healthy' | 'warning' | 'error' | 'unknown'): string {
  switch (status) {
    case 'healthy': return 'green';
    case 'warning': return 'yellow';
    case 'error': return 'red';
    case 'unknown': return 'gray';
  }
}

// Get symbol for health status
function getHealthSymbol(status: 'healthy' | 'warning' | 'error' | 'unknown'): string {
  switch (status) {
    case 'healthy': return '✓';
    case 'warning': return '⚠';
    case 'error': return '✗';
    case 'unknown': return '?';
  }
}

// Find shortest path between two nodes using BFS
function findShortestPath(
  fromId: string,
  toId: string,
  edges: GraphEdge[]
): string[] | null {
  // Build adjacency list
  const adj: Record<string, string[]> = {};
  edges.forEach(edge => {
    if (!adj[edge.from]) adj[edge.from] = [];
    if (!adj[edge.to]) adj[edge.to] = [];
    adj[edge.from].push(edge.to);
  });

  // BFS to find shortest path
  const queue: Array<{ node: string; path: string[] }> = [{ node: fromId, path: [fromId] }];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;

    if (node === toId) {
      return path;
    }

    const neighbors = adj[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return null; // No path found
}

// Get all nodes in the shortest path (for highlighting)
function getPathNodes(
  selectedNode: string | null,
  targetNode: string | null,
  edges: GraphEdge[]
): Set<string> {
  const pathNodes = new Set<string>();

  if (selectedNode && targetNode && selectedNode !== targetNode) {
    const path = findShortestPath(selectedNode, targetNode, edges);
    if (path) {
      path.forEach(nodeId => pathNodes.add(nodeId));
    }
  }

  return pathNodes;
}

// Calculate clustered layout by grouping nodes by criteria
function calculateClusteredLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  clusteringBy: 'language' | 'framework' | 'type' | 'team'
): GraphNode[] {
  // Group nodes by clustering criteria
  const groups: Record<string, GraphNode[]> = {};

  nodes.forEach(node => {
    const key = clusteringBy === 'type' ? node.type :
                 clusteringBy === 'language' ? (node.language || 'unknown') :
                 clusteringBy === 'framework' ? (node.framework || 'unknown') :
                 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(node);
  });

  const groupKeys = Object.keys(groups);
  const positionedNodes: GraphNode[] = [];

  // Position groups in a grid layout
  const cols = Math.ceil(Math.sqrt(groupKeys.length));
  const groupWidth = width / cols;
  const groupHeight = height / Math.ceil(groupKeys.length / cols);

  groupKeys.forEach((groupKey, groupIndex) => {
    const groupNodes = groups[groupKey];
    const groupCenterX = (groupIndex % cols) * groupWidth + groupWidth / 2;
    const groupCenterY = Math.floor(groupIndex / cols) * groupHeight + groupHeight / 2;

    // Apply force-directed layout within each group
    const groupLayout = calculateLayout(
      groupNodes,
      edges.filter(e => groupNodes.some(n => n.id === e.from) && groupNodes.some(n => n.id === e.to)),
      groupWidth - 10,
      groupHeight - 10
    );

    // Offset nodes to their group position
    groupLayout.forEach(node => {
      node.x = node.x + groupCenterX - groupWidth / 2;
      node.y = node.y + groupCenterY - groupHeight / 2;
      positionedNodes.push(node);
    });
  });

  return positionedNodes;
}

// Helper function to apply current layout algorithm
function applyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  layoutMode: 'force-directed' | 'hierarchical' | 'circular' | 'organic',
  width: number,
  height: number
): GraphNode[] {
  switch (layoutMode) {
    case 'force-directed':
      return calculateLayout(nodes, edges, width, height);
    case 'hierarchical':
      return calculateHierarchicalLayout(nodes, edges, width, height);
    case 'circular':
      return calculateCircularLayout(nodes, edges, width, height);
    case 'organic':
      return calculateOrganicLayout(nodes, edges, width, height);
  }
}

const ShortcutLine: React.FC<{ keys: string; label: string }> = ({ keys, label }) => (
  <Box>
    <Text bold>{keys}</Text>
    <Text> - {label}</Text>
  </Box>
);

// Main TUI Component
export const InkTUI: React.FC<InkTUIProps> = ({ projectPath }) => {
  const { exit } = useApp();
  const targetProjectPath = useMemo(() => path.resolve(projectPath || process.cwd()), [projectPath]);
  const [state, setState] = useState<TUIState>({
    mode: 'graph',
    nodes: [],
    edges: [],
    selectedNode: null,
    targetNode: null,
    scrollOffset: { x: 0, y: 0 },
    zoom: 1.0,
    workspaceConfig: null,
    filter: 'all',
    searchQuery: '',
    filterLanguage: '',
    filterFramework: '',
    filterStatus: 'all',
    clusteringEnabled: false,
    clusteringBy: 'language',
    layoutMode: 'force-directed',
    loading: true,
    error: null,
    detailsScrollOffset: 0,
    bookmarks: [],
    selectedBookmark: null,
    workspaceRoot: targetProjectPath,
    workspaceName: '',
    workspaceVersion: '',
    workspaceDescription: '',
    packageManager: '',
    workspaceReloading: false,
    lastModifiedTime: null,
    userName: 'You',
    tourActive: false,
    tourStep: 0,
    tourCompleted: false,
    dependencyAnalysis: null,
    analysisServiceFilter: null,
    workspaceHealth: null,
  });

  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;

  // Load workspace configuration
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const workspaceData = await loadWorkspaceData(targetProjectPath);
        const { nodes, edges } = workspaceData;
        const layoutNodes = calculateLayout(nodes, edges, terminalWidth - 40, terminalHeight - 10);

        setState(prev => ({
          ...prev,
          nodes: layoutNodes,
          edges,
          workspaceConfig: workspaceData.config,
          workspaceRoot: workspaceData.root,
          workspaceName: workspaceData.name,
          workspaceVersion: workspaceData.version,
          workspaceDescription: workspaceData.description,
          packageManager: workspaceData.packageManager,
          workspaceHealth: workspaceData.health,
          loading: false,
          error: null,
        }));
      } catch (error: unknown) {
        setState(prev => ({ ...prev, loading: false, error: (error as Error).message }));
      }
    };

    loadWorkspace();
  }, [targetProjectPath, terminalWidth, terminalHeight]);

  // Watch workspace file for changes and reload automatically
  useEffect(() => {
    let watcher: chokidar.FSWatcher | null = null;
    let cancelled = false;

    const startWatcher = async () => {
      const configPath = await findWorkspaceConfig(targetProjectPath);
      if (!configPath || cancelled || !fs.existsSync(configPath)) {
        return;
      }

      watcher = chokidar.watch(configPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

      watcher.on('change', async () => {
        // Debounce rapid changes
        await new Promise(resolve => setTimeout(resolve, 300));

        // Trigger reload with animation
        setState(prev => ({ ...prev, workspaceReloading: true }));

        // Trigger animation for all nodes
        setState(prev => ({
          ...prev,
          nodes: prev.nodes.map(node => ({
            ...node,
            animating: true,
            animationProgress: 0,
            animationType: 'appearing',
          })),
        }));

        // Reload workspace
        try {
          const workspaceData = await loadWorkspaceData(targetProjectPath);
          const layoutNodes = calculateLayout(workspaceData.nodes, workspaceData.edges, terminalWidth - 40, terminalHeight - 10);

          setTimeout(() => {
            setState(prev => ({
              ...prev,
              nodes: layoutNodes,
              edges: workspaceData.edges,
              workspaceConfig: workspaceData.config,
              workspaceRoot: workspaceData.root,
              workspaceName: workspaceData.name,
              workspaceVersion: workspaceData.version,
              workspaceDescription: workspaceData.description,
              packageManager: workspaceData.packageManager,
              workspaceHealth: workspaceData.health,
              workspaceReloading: false,
              lastModifiedTime: Date.now(),
              error: null,
            }));
          }, 500); // Wait for animation to partially complete
        } catch (error: unknown) {
          setState(prev => ({
            ...prev,
            error: (error as Error).message,
            workspaceReloading: false,
          }));
        }
      });
    };

    startWatcher();

    return () => {
      cancelled = true;
      if (watcher) {
        watcher.close().catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, [targetProjectPath, terminalWidth, terminalHeight]);

  // Animation progress updates
  useEffect(() => {
    const animatingNodes = state.nodes.filter(n => n.animating);
    if (animatingNodes.length === 0) return;

    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(node => {
          if (node.animating && node.animationProgress !== undefined) {
            const newProgress = Math.min(1, node.animationProgress + 0.05); // 20 frames for full animation
            if (newProgress >= 1) {
              // Animation complete
              return { ...node, animating: false, animationProgress: 1 };
            }
            return { ...node, animationProgress: newProgress };
          }
          return node;
        }),
      }));
    }, 50); // Update 20 times per second

    return () => clearInterval(interval);
  }, [state.nodes.some(n => n.animating)]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || key.ctrl && key.name === 'c') {
      exit();
      return;
    }

    if (state.mode === 'graph') {
      if (key.return && state.selectedNode) {
        setState(prev => ({ ...prev, mode: 'details' }));
      } else if (key.tab) {
        const visibleNodes = getFilteredNodes();
        if (visibleNodes.length > 0) {
          const currentIndex = state.selectedNode
            ? visibleNodes.findIndex(n => n.id === state.selectedNode)
            : -1;
          const nextIndex = (currentIndex + 1) % visibleNodes.length;
          setState(prev => ({ ...prev, selectedNode: visibleNodes[nextIndex].id }));
        }
      } else if (key.leftArrow) {
        const panSpeed = 5 / state.zoom;
        setState(prev => ({ ...prev, scrollOffset: { x: Math.max(-1000, prev.scrollOffset.x - panSpeed), y: prev.scrollOffset.y } }));
      } else if (key.rightArrow) {
        const panSpeed = 5 / state.zoom;
        setState(prev => ({ ...prev, scrollOffset: { x: prev.scrollOffset.x + panSpeed, y: prev.scrollOffset.y } }));
      } else if (key.upArrow) {
        const panSpeed = 3 / state.zoom;
        setState(prev => ({ ...prev, scrollOffset: { x: prev.scrollOffset.x, y: Math.max(-1000, prev.scrollOffset.y - panSpeed) } }));
      } else if (key.downArrow) {
        const panSpeed = 3 / state.zoom;
        setState(prev => ({ ...prev, scrollOffset: { x: prev.scrollOffset.x, y: prev.scrollOffset.y + panSpeed } }));
      } else if (input === '+' || input === '=') {
        // Zoom in
        setState(prev => ({ ...prev, zoom: Math.min(5.0, prev.zoom * 1.2) }));
      } else if (input === '-' || input === '_') {
        // Zoom out
        setState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }));
      } else if (input === '0') {
        // Reset zoom
        setState(prev => ({ ...prev, zoom: 1.0, scrollOffset: { x: 0, y: 0 } }));
      } else if (input === 'f') {
        // Cycle through all filter types
        const filters: Array<TUIState['filter']> =
          ['all', 'frontend', 'backend', 'worker', 'database', 'queue', 'cache', 'app', 'package', 'lib', 'tool', 'network', 'services'];
        const currentFilterIndex = filters.indexOf(state.filter as TUIState['filter']);
        const nextFilter = filters[(currentFilterIndex + 1) % filters.length];
        setState(prev => ({ ...prev, filter: nextFilter as TUIState['filter'], selectedNode: null }));
      } else if (input === '1') {
        // Quick view: All services
        setState(prev => ({ ...prev, filter: 'services', selectedNode: null }));
      } else if (input === '2') {
        // Quick view: Databases only
        setState(prev => ({ ...prev, filter: 'database', selectedNode: null }));
      } else if (input === '3') {
        // Quick view: Queues only
        setState(prev => ({ ...prev, filter: 'queue', selectedNode: null }));
      } else if (input === '4') {
        // Quick view: Caches only
        setState(prev => ({ ...prev, filter: 'cache', selectedNode: null }));
      } else if (input === '5') {
        // Quick view: Network view (all infrastructure)
        setState(prev => ({ ...prev, filter: 'network', selectedNode: null }));
      } else if (input === '0' && key.ctrl) {
        // Quick view: Reset to all (Ctrl+0)
        setState(prev => ({ ...prev, filter: 'all', selectedNode: null }));
      } else if (input === 'h') {
        setState(prev => ({ ...prev, mode: 'help' }));
      } else if (input === 'r') {
        // Recalculate layout, preserving the already-loaded real workspace health.
        if (state.workspaceConfig) {
          const { nodes, edges } = workspaceToGraph(state.workspaceConfig);
          const healthyNodes = applyHealthToNodes(nodes, state.workspaceHealth);
          const layoutNodes = applyLayout(healthyNodes, edges, state.layoutMode, terminalWidth - 40, terminalHeight - 10);
          setState(prev => ({ ...prev, nodes: layoutNodes }));
        }
      } else if (input === 'O') {
        // Cycle through layout algorithms
        const layouts: Array<'force-directed' | 'hierarchical' | 'circular' | 'organic'> =
          ['force-directed', 'hierarchical', 'circular', 'organic'];
        const currentIndex = layouts.indexOf(state.layoutMode);
        const nextLayout = layouts[(currentIndex + 1) % layouts.length];
        setState(prev => ({
          ...prev,
          layoutMode: nextLayout,
          nodes: applyLayout(prev.nodes, prev.edges, nextLayout, terminalWidth - 40, terminalHeight - 10),
        }));
      } else if (input === '/') {
        // Enter search mode
        setState(prev => ({ ...prev, mode: 'search', searchQuery: '' }));
      } else if (input === 'l') {
        // Cycle through language filters
        const languages = Array.from(new Set(state.nodes.map(n => n.language).filter(Boolean)));
        const currentIndex = state.filterLanguage ? languages.indexOf(state.filterLanguage) : -1;
        const nextIndex = (currentIndex + 1) % (languages.length + 1);
        setState(prev => ({
          ...prev,
          filterLanguage: nextIndex < languages.length ? languages[nextIndex] : '',
          selectedNode: null,
        }));
      } else if (input === 'w') {
        // Cycle through framework filters
        const frameworks = Array.from(new Set(state.nodes.map(n => n.framework).filter(Boolean)));
        const currentIndex = state.filterFramework ? frameworks.indexOf(state.filterFramework) : -1;
        const nextIndex = (currentIndex + 1) % (frameworks.length + 1);
        setState(prev => ({
          ...prev,
          filterFramework: nextIndex < frameworks.length ? frameworks[nextIndex] : '',
          selectedNode: null,
        }));
      } else if (input === 's') {
        // Cycle through status filters
        const statuses: Array<'all' | 'healthy' | 'warning' | 'error' | 'unknown'> = ['all', 'healthy', 'warning', 'error', 'unknown'];
        const currentIndex = statuses.indexOf(state.filterStatus);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        setState(prev => ({ ...prev, filterStatus: nextStatus, selectedNode: null }));
      } else if (input === 'p' && state.selectedNode) {
        // Set target node for dependency path visualization
        setState(prev => ({
          ...prev,
          targetNode: prev.targetNode === state.selectedNode ? null : state.selectedNode,
        }));
      } else if (input === 'c') {
        // Toggle clustering
        setState(prev => ({
          ...prev,
          clusteringEnabled: !prev.clusteringEnabled,
          // Recalculate layout when toggling clustering
          nodes: prev.clusteringEnabled
            ? calculateLayout(prev.nodes, prev.edges, terminalWidth - 40, terminalHeight - 10)
            : calculateClusteredLayout(prev.nodes, prev.edges, terminalWidth - 40, terminalHeight - 10, prev.clusteringBy),
        }));
      } else if (input === 'm' && state.clusteringEnabled) {
        // Cycle through clustering modes
        const modes: Array<'language' | 'framework' | 'type' | 'team'> = ['language', 'framework', 'type', 'team'];
        const currentIndex = modes.indexOf(state.clusteringBy);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setState(prev => ({
          ...prev,
          clusteringBy: nextMode,
          nodes: calculateClusteredLayout(prev.nodes, prev.edges, terminalWidth - 40, terminalHeight - 10, nextMode),
        }));
      } else if (input === 'j' || input === 'k') {
        // Vim-style j/k navigation for node selection
        const visibleNodes = getFilteredNodes();
        if (visibleNodes.length > 0) {
          const currentIndex = state.selectedNode
            ? visibleNodes.findIndex(n => n.id === state.selectedNode)
            : -1;

          let nextIndex: number;
          if (input === 'j') {
            // Move down/forward
            nextIndex = currentIndex + 1 >= visibleNodes.length ? 0 : currentIndex + 1;
          } else {
            // Move up/backward (k)
            nextIndex = currentIndex <= 0 ? visibleNodes.length - 1 : currentIndex - 1;
          }

          setState(prev => ({ ...prev, selectedNode: visibleNodes[nextIndex].id }));
        }
      } else if (input === 'g') {
        // Vim-style gg - go to first node
        const visibleNodes = getFilteredNodes();
        if (visibleNodes.length > 0) {
          setState(prev => ({ ...prev, selectedNode: visibleNodes[0].id }));
        }
      } else if (input === 'G') {
        // Vim-style G - go to last node (Shift+g)
        const visibleNodes = getFilteredNodes();
        if (visibleNodes.length > 0) {
          setState(prev => ({ ...prev, selectedNode: visibleNodes[visibleNodes.length - 1].id }));
        }
      } else if (input === 'b') {
        // Vim-style b - go to previous node (back)
        const visibleNodes = getFilteredNodes();
        if (visibleNodes.length > 0 && state.selectedNode) {
          const currentIndex = visibleNodes.findIndex(n => n.id === state.selectedNode);
          const prevIndex = currentIndex <= 0 ? visibleNodes.length - 1 : currentIndex - 1;
          setState(prev => ({ ...prev, selectedNode: visibleNodes[prevIndex].id }));
        }
      } else if (input === 'w' && key.ctrl) {
        // Vim-style Ctrl+w - zoom in (like vim window resize)
        setState(prev => ({ ...prev, zoom: Math.min(5.0, prev.zoom * 1.2) }));
      } else if (input === 'z' && key.ctrl) {
        // Vim-style Ctrl+z - zoom out
        setState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }));
      } else if (input === 'd') {
        // Vim-style d - go to details (like entering a directory)
        if (state.selectedNode) {
          setState(prev => ({ ...prev, mode: 'details' }));
        }
      } else if (input === 'u') {
        // Vim-style u - undo zoom (reset zoom)
        setState(prev => ({ ...prev, zoom: 1.0, scrollOffset: { x: 0, y: 0 } }));
      } else if (input === ':') {
        // Vim-style : command mode - open help
        setState(prev => ({ ...prev, mode: 'help' }));
      } else if (input === '?') {
        // Vim-style ? - show help (search backwards in vim, help here)
        setState(prev => ({ ...prev, mode: 'help' }));
      } else if (input === 'n') {
        // Vim-style n - next match (cycle through unhealthy nodes)
        const unhealthyNodes = state.nodes.filter(n => n.status !== 'healthy');
        if (unhealthyNodes.length > 0) {
          const currentIndex = state.selectedNode
            ? unhealthyNodes.findIndex(n => n.id === state.selectedNode)
            : -1;
          const nextIndex = (currentIndex + 1) % unhealthyNodes.length;
          setState(prev => ({ ...prev, selectedNode: unhealthyNodes[nextIndex].id }));
        }
      } else if (input === 'N') {
        // Vim-style N - previous match (Shift+n)
        const unhealthyNodes = state.nodes.filter(n => n.status !== 'healthy');
        if (unhealthyNodes.length > 0) {
          const currentIndex = state.selectedNode
            ? unhealthyNodes.findIndex(n => n.id === state.selectedNode)
            : -1;
          const prevIndex = currentIndex <= 0 ? unhealthyNodes.length - 1 : currentIndex - 1;
          setState(prev => ({ ...prev, selectedNode: unhealthyNodes[prevIndex].id }));
        }
      } else if (input === '*') {
        // Vim-style * - search for next node by name (quick select)
        const visibleNodes = getFilteredNodes();
        if (visibleNodes.length > 0) {
          const currentIndex = state.selectedNode
            ? visibleNodes.findIndex(n => n.id === state.selectedNode)
            : -1;
          const nextIndex = (currentIndex + 1) % visibleNodes.length;
          setState(prev => ({ ...prev, selectedNode: visibleNodes[nextIndex].id }));
        }
      } else if (input === '#') {
        // Vim-style # - search for previous node by name
        const visibleNodes = getFilteredNodes();
        if (visibleNodes.length > 0) {
          const currentIndex = state.selectedNode
            ? visibleNodes.findIndex(n => n.id === state.selectedNode)
            : -1;
          const prevIndex = currentIndex <= 0 ? visibleNodes.length - 1 : currentIndex - 1;
          setState(prev => ({ ...prev, selectedNode: visibleNodes[prevIndex].id }));
        }
      } else if (input === 'v') {
        // Vim-style v - visual mode (toggle clustering visualization)
        setState(prev => ({
          ...prev,
          clusteringEnabled: !prev.clusteringEnabled,
          nodes: prev.clusteringEnabled
            ? calculateLayout(prev.nodes, prev.edges, terminalWidth - 40, terminalHeight - 10)
            : calculateClusteredLayout(prev.nodes, prev.edges, terminalWidth - 40, terminalHeight - 10, prev.clusteringBy),
        }));
      } else if (input === ' ') {
        // Space - toggle selection
        if (state.selectedNode) {
          setState(prev => ({ ...prev, selectedNode: null }));
        } else {
          const visibleNodes = getFilteredNodes();
          if (visibleNodes.length > 0) {
            setState(prev => ({ ...prev, selectedNode: visibleNodes[0].id }));
          }
        }
      } else if (input === 'B') {
        // Open bookmarks view
        setState(prev => ({ ...prev, mode: 'bookmarks' }));
      } else if (input === 'b' && key.ctrl) {
        // Save current view as bookmark
        const bookmark: GraphBookmark = {
          name: `Bookmark ${state.bookmarks.length + 1}`,
          timestamp: Date.now(),
          zoom: state.zoom,
          scrollOffset: state.scrollOffset,
          filter: state.filter,
          filterLanguage: state.filterLanguage,
          filterFramework: state.filterFramework,
          filterStatus: state.filterStatus,
          layoutMode: state.layoutMode,
          clusteringEnabled: state.clusteringEnabled,
          clusteringBy: state.clusteringBy,
          selectedNode: state.selectedNode,
        };
        setState(prev => ({ ...prev, bookmarks: [...prev.bookmarks, bookmark] }));
      } else if (input >= '0' && input <= '9') {
        // Quick load bookmark by number
        const bookmarkIndex = parseInt(input) - 1;
        if (bookmarkIndex >= 0 && bookmarkIndex < state.bookmarks.length) {
          const bookmark = state.bookmarks[bookmarkIndex];
          setState(prev => ({
            ...prev,
            zoom: bookmark.zoom,
            scrollOffset: bookmark.scrollOffset,
            filter: bookmark.filter,
            filterLanguage: bookmark.filterLanguage,
            filterFramework: bookmark.filterFramework,
            filterStatus: bookmark.filterStatus,
            layoutMode: bookmark.layoutMode,
            clusteringEnabled: bookmark.clusteringEnabled,
            clusteringBy: bookmark.clusteringBy,
            selectedNode: bookmark.selectedNode,
            selectedBookmark: bookmarkIndex,
          }));
        }
      } else if (input === 'a' && state.selectedNode) {
        // Trigger animation on selected node
        setState(prev => ({
          ...prev,
          nodes: prev.nodes.map(node => {
            if (node.id === state.selectedNode) {
              return {
                ...node,
                animating: true,
                animationProgress: 0,
                animationType: 'deploying',
              };
            }
            return node;
          }),
        }));
      } else if (input === 'A') {
        // Trigger animation on all visible nodes
        setState(prev => ({
          ...prev,
          nodes: prev.nodes.map(node => ({
            ...node,
            animating: true,
            animationProgress: 0,
            animationType: 'appearing',
          })),
        }));
      } else if (input === 'o' && state.selectedNode) {
        // Open service URL in browser
        const service = state.workspaceConfig?.services?.[state.selectedNode];
        if (service) {
          const url = getServiceUrl(service);
          if (url) {
            openUrl(url);
          } else {
            // Service has no port, show message
            console.log(`\nService ${state.selectedNode} has no URL to open`);
          }
        }
      } else if (input === 'e' && state.selectedNode) {
        // Open service code in editor
        const service = state.workspaceConfig?.services?.[state.selectedNode];
        if (service && service.path) {
          const fullPath = path.join(process.cwd(), service.path);
          if (fs.existsSync(fullPath)) {
            openFile(fullPath);
          } else {
            console.log(`\nPath not found: ${fullPath}`);
          }
        }
      } else if (input === 'D' && state.selectedNode) {
        // Open framework documentation (Shift+d to avoid conflict)
        const service = state.workspaceConfig?.services?.[state.selectedNode];
        if (service) {
          const docsUrl = getServiceDocsUrl(service);
          if (docsUrl) {
            openUrl(docsUrl);
          } else {
            console.log(`\nNo documentation URL available for ${service.framework || 'this service'}`);
          }
        }
      } else if (input === 't') {
        // Start tour mode
        setState(prev => ({
          ...prev,
          tourActive: true,
          tourStep: 0,
          mode: 'graph',
        }));
      } else if (input === 'i') {
        // Run dependency analysis and switch to analysis view
        const analysis = analyzeDependencies(state);
        setState(prev => ({
          ...prev,
          dependencyAnalysis: analysis,
          analysisServiceFilter: null,
          mode: 'analysis',
        }));
      }
    }

    // Tour mode keyboard handling (works across all modes)
    if (state.tourActive) {
      if (key.escape || input === 'q') {
        // Exit tour
        setState(prev => ({ ...prev, tourActive: false, tourStep: 0 }));
      } else if (key.return) {
        // Next step
        setState(prev => {
          const nextStep = prev.tourStep + 1;
          if (nextStep >= tourSteps.length) {
            // Tour complete
            return { ...prev, tourActive: false, tourStep: 0, tourCompleted: true };
          }
          const step = tourSteps[nextStep];

          // Apply any state changes for this step
          let newState: TUIState = {
            ...prev,
            tourStep: nextStep,
          };

          if (step.setupState) {
            newState = { ...newState, ...step.setupState };
          }

          return newState;
        });
      } else if (input === 'n' || key.rightArrow) {
        // Next step (same as Enter)
        setState(prev => {
          const nextStep = Math.min(prev.tourStep + 1, tourSteps.length - 1);
          return { ...prev, tourStep: nextStep };
        });
      } else if (input === 'p' || key.leftArrow) {
        // Previous step
        setState(prev => ({
          ...prev,
          tourStep: Math.max(0, prev.tourStep - 1),
        }));
      }
    }

    if (!state.tourActive) {
      if (state.mode === 'bookmarks') {
        if (key.escape || key.return || input === 'q') {
          setState(prev => ({ ...prev, mode: 'graph' }));
        } else if (input === 'd' && state.selectedBookmark !== null) {
          // Delete selected bookmark
          setState(prev => ({
            ...prev,
            bookmarks: prev.bookmarks.filter((_, i) => i !== prev.selectedBookmark),
            selectedBookmark: null,
          }));
        } else if (input === 'r' && state.selectedBookmark !== null) {
          // Restore selected bookmark
          const bookmark = state.bookmarks[state.selectedBookmark];
          setState(prev => ({
            ...prev,
            zoom: bookmark.zoom,
            scrollOffset: bookmark.scrollOffset,
            filter: bookmark.filter,
            filterLanguage: bookmark.filterLanguage,
            filterFramework: bookmark.filterFramework,
            filterStatus: bookmark.filterStatus,
            layoutMode: bookmark.layoutMode,
            clusteringEnabled: bookmark.clusteringEnabled,
            clusteringBy: bookmark.clusteringBy,
            selectedNode: bookmark.selectedNode,
            mode: 'graph',
          }));
        } else if (key.upArrow) {
          setState(prev => ({
            ...prev,
            selectedBookmark: prev.selectedBookmark === null
              ? (prev.bookmarks.length > 0 ? 0 : null)
              : Math.max(0, prev.selectedBookmark - 1),
          }));
        } else if (key.downArrow) {
          setState(prev => ({
            ...prev,
            selectedBookmark: prev.selectedBookmark === null
              ? 0
              : Math.min(prev.bookmarks.length - 1, prev.selectedBookmark + 1),
          }));
        }
      } else if (state.mode === 'details') {
        if (key.escape || key.return || input === 'q') {
          setState(prev => ({ ...prev, mode: 'graph', detailsScrollOffset: 0 }));
        } else if (key.upArrow) {
          // Scroll up in details
          setState(prev => ({ ...prev, detailsScrollOffset: Math.max(0, prev.detailsScrollOffset - 1) }));
        } else if (key.downArrow) {
          // Scroll down in details
          setState(prev => ({ ...prev, detailsScrollOffset: prev.detailsScrollOffset + 1 }));
        }
      } else if (state.mode === 'help') {
        if (key.escape || key.return || input === 'q') {
          setState(prev => ({ ...prev, mode: 'graph' }));
        }
      } else if (state.mode === 'search') {
        if (key.escape || key.return) {
          setState(prev => ({ ...prev, mode: 'graph' }));
        } else if (key.backspace || key.delete) {
          setState(prev => ({ ...prev, searchQuery: prev.searchQuery.slice(0, -1) }));
        } else if (input.length === 1 && !key.ctrl && !key.meta) {
          // Add character to search query
          setState(prev => ({ ...prev, searchQuery: prev.searchQuery + input }));
        }
      } else if (state.mode === 'analysis') {
        if (key.escape || key.return || input === 'q') {
          setState(prev => ({ ...prev, mode: 'graph' }));
        } else if (input === 'f') {
          // Filter by severity
          const severities: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> =
            ['all', 'critical', 'high', 'medium', 'low'];
          const currentFilter = state.analysisServiceFilter || 'all';
          const currentIndex = severities.indexOf(currentFilter as 'all' | 'critical' | 'high' | 'medium' | 'low');
          const nextFilter = severities[(currentIndex + 1) % severities.length];
          setState(prev => ({ ...prev, analysisServiceFilter: nextFilter === 'all' ? null : nextFilter }));
        } else if (input === 's') {
          // Sort by severity
          if (state.dependencyAnalysis) {
            const sortedIssues = [...state.dependencyAnalysis.issues].sort((a, b) => {
              const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            });
            setState(prev => ({
              ...prev,
              dependencyAnalysis: prev.dependencyAnalysis ? {
                ...prev.dependencyAnalysis,
                issues: sortedIssues,
              } : null,
            }));
          }
        } else if (input === 'r') {
          // Re-run analysis
          const analysis = analyzeDependencies(state);
          setState(prev => ({ ...prev, dependencyAnalysis: analysis }));
        }
      }
    }
  });

  // Get filtered nodes with advanced filtering
  const getFilteredNodes = useCallback(() => {
    return state.nodes.filter(node => {
      // Filter by type (service type)
      if (state.filter === 'all') {
        // Show all
      } else if (state.filter === 'services') {
        // Show product workspaces and services, excluding infrastructure nodes.
        if (!['frontend', 'backend', 'worker', 'function', 'app', 'package', 'lib', 'tool'].includes(node.type)) {
          return false;
        }
      } else if (state.filter === 'network') {
        // Show network infrastructure (databases, queues, caches)
        if (!['database', 'queue', 'cache'].includes(node.type)) {
          return false;
        }
      } else if (node.type !== state.filter) {
        // Exact type match
        return false;
      }

      // Filter by search query (name matching)
      if (state.searchQuery && !node.name.toLowerCase().includes(state.searchQuery.toLowerCase())) {
        return false;
      }

      // Filter by language
      if (state.filterLanguage && node.language !== state.filterLanguage) {
        return false;
      }

      // Filter by framework
      if (state.filterFramework && node.framework !== state.filterFramework) {
        return false;
      }

      // Filter by health status
      if (state.filterStatus !== 'all' && node.status !== state.filterStatus) {
        return false;
      }

      return true;
    });
  }, [state.nodes, state.filter, state.searchQuery, state.filterLanguage, state.filterFramework, state.filterStatus]);

  const visibleNodes = getFilteredNodes();

  // Calculate dependency path nodes for highlighting
  const pathNodes = getPathNodes(state.selectedNode, state.targetNode, state.edges);

  // Render graph view
  if (state.mode === 'graph') {
    if (state.loading) {
      return (
        <Box padding={2}>
          <Text color="cyan">
            <Spinner type="dots" /> Loading workspace configuration...
          </Text>
        </Box>
      );
    }

    if (state.error) {
      const isNotWorkspace = state.error.startsWith('NOT_IN_MONOREPO');

      if (isNotWorkspace) {
        return (
          <Box flexDirection="column" padding={2}>
            <Text color="yellow" bold>
              Not a Re-Shell workspace
            </Text>
            <Text color="gray">{targetProjectPath}</Text>
            <Box marginTop={1} flexDirection="column">
              <Text color="cyan">No re-shell.workspaces.yaml or package.json workspaces found here.</Text>
              <Text color="gray">- cd into an existing Re-Shell workspace, or</Text>
              <Text color="gray">- run `re-shell create &lt;name&gt;` to scaffold a new monorepo, or</Text>
              <Text color="gray">- run `re-shell init` to initialize the current directory.</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="gray">Press Esc or Ctrl+C to exit ({state.error})</Text>
            </Box>
          </Box>
        );
      }

      return (
        <Box flexDirection="column" padding={2}>
          <Text color="red">Error: {state.error}</Text>
          <Text color="gray">Project path: {targetProjectPath}</Text>
          <Text color="gray">Press Esc or Ctrl+C to exit</Text>
        </Box>
      );
    }

    // Create graph visualization
    const graphWidth = terminalWidth - 40;
    const graphHeight = terminalHeight - 10;
    const graphBuffer: string[][] = Array(graphHeight).fill(null).map(() => Array(graphWidth).fill(' '));

    // Draw edges with zoom transformation
    state.edges.forEach(edge => {
      const fromNode = state.nodes.find(n => n.id === edge.from);
      const toNode = state.nodes.find(n => n.id === edge.to);
      if (fromNode && toNode) {
        // Check if this edge is on the dependency path
        const isOnPath = pathNodes.has(edge.from) && pathNodes.has(edge.to);

        // Apply zoom transformation: center the graph and scale
        const centerX = graphWidth / 2;
        const centerY = graphHeight / 2;

        const x1 = Math.floor(centerX + (fromNode.x - centerX - state.scrollOffset.x) * state.zoom);
        const y1 = Math.floor(centerY + (fromNode.y - centerY - state.scrollOffset.y) * state.zoom);
        const x2 = Math.floor(centerX + (toNode.x - centerX - state.scrollOffset.x) * state.zoom);
        const y2 = Math.floor(centerY + (toNode.y - centerY - state.scrollOffset.y) * state.zoom);

        // Simple line drawing with path highlighting
        const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        for (let i = 0; i <= steps; i++) {
          const t = steps === 0 ? 0 : i / steps;
          const x = Math.floor(x1 + (x2 - x1) * t);
          const y = Math.floor(y1 + (y2 - y1) * t);
          if (y >= 0 && y < graphHeight && x >= 0 && x < graphWidth) {
            // Use different symbols for path edges vs regular edges
            graphBuffer[y][x] = isOnPath ? '█' : '·';
          }
        }
      }
    });

    // Draw nodes with zoom transformation and health status
    const visibleNodesWithPositions = visibleNodes
      .map(node => {
        const centerX = graphWidth / 2;
        const centerY = graphHeight / 2;
        const x = Math.floor(centerX + (node.x - centerX - state.scrollOffset.x) * state.zoom);
        const y = Math.floor(centerY + (node.y - centerY - state.scrollOffset.y) * state.zoom);
        return { ...node, displayX: x, displayY: y };
      })
      .filter(node => node.displayY >= 0 && node.displayY < graphHeight && node.displayX >= 0 && node.displayX < graphWidth);

    // Build graph output with health-colored nodes
    const graphLines: React.ReactNode[] = [];
    for (let y = 0; y < graphHeight; y++) {
      const lineCells: React.ReactNode[] = [];
      for (let x = 0; x < graphWidth; x++) {
        // Check if there's a node at this position
        const nodeAtPos = visibleNodesWithPositions.find(n => n.displayX === x && n.displayY === y);
        if (nodeAtPos) {
          const isSelected = nodeAtPos.id === state.selectedNode;
          const healthColor = getHealthColor(nodeAtPos.status);

          // Animation effects
          let symbol = isSelected ? '█' : '●';

          if (nodeAtPos.animating && nodeAtPos.animationProgress !== undefined) {
            const progress = nodeAtPos.animationProgress;

            // Different animations based on type
            switch (nodeAtPos.animationType) {
              case 'deploying':
                // Pulsing size during deployment
                const sizeFrames = ['○', '○', '●', '○', '○'];
                const frameIndex = Math.floor(progress * (sizeFrames.length - 1));
                symbol = sizeFrames[frameIndex];
                break;
              case 'scaling':
                // Growing symbol
                symbol = progress < 0.5 ? '○' : '●';
                break;
              case 'health-change':
                // Blinking effect
                symbol = Math.floor(progress * 10) % 2 === 0 ? '●' : '○';
                break;
              case 'appearing':
                // Fade in effect (size)
                if (progress < 0.3) symbol = '·';
                else if (progress < 0.6) symbol = '○';
                else symbol = '●';
                break;
              case 'disappearing':
                // Fade out effect
                if (progress < 0.3) symbol = '●';
                else if (progress < 0.6) symbol = '○';
                else symbol = '·';
                break;
            }
          }

          lineCells.push(<Text key={`${x}-${y}`} color={healthColor} bold={isSelected}>{symbol}</Text>);
        } else if (graphBuffer[y] && graphBuffer[y][x] !== ' ') {
          lineCells.push(<Text key={`${x}-${y}`} color="blue">{graphBuffer[y][x]}</Text>);
        } else {
          lineCells.push(<Text key={`${x}-${y}`}> </Text>);
        }
      }
      graphLines.push(<Box key={y}>{lineCells}</Box>);
    }

    return (
      <Box flexDirection="column" padding={1}>
        {/* Header */}
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">
            Re-Shell Workspace TUI
          </Text>
        </Box>

        {/* Status bar with zoom level, active filters, and path info */}
        <Box flexDirection="column" marginBottom={1}>
          {state.workspaceReloading ? (
            <Text color="yellow">⟳ Reloading workspace... </Text>
          ) : (
            <Text color="gray">
              Workspace: {state.workspaceName || path.basename(state.workspaceRoot)} | Source: {state.packageManager || 'workspace'}
              {state.workspaceHealth
                ? ` | Health: ${state.workspaceHealth.status} (${state.workspaceHealth.score}/100)`
                : ''}
            </Text>
          )}
          <Text color="gray">
            Nodes: {visibleNodes.length}/{state.nodes.length} | Filter: {state.filter} | Layout: {state.layoutMode} | Zoom: {(state.zoom * 100).toFixed(0)}% | Selected: {state.selectedNode || 'None'}
          </Text>
          {(state.searchQuery || state.filterLanguage || state.filterFramework || state.filterStatus !== 'all' || state.targetNode || state.bookmarks.length > 0) && (
            <Text color="gray">
              {state.searchQuery ? `Search: "${state.searchQuery}" ` : ''}
              {state.filterLanguage ? `Lang: ${state.filterLanguage} ` : ''}
              {state.filterFramework ? `Framework: ${state.filterFramework} ` : ''}
              {state.filterStatus !== 'all' ? `Status: ${state.filterStatus} ` : ''}
              {state.targetNode ? `Path: ${state.selectedNode || '?'} -> ${state.targetNode} (${pathNodes.size - 1 || 0} hops) ` : ''}
              {state.bookmarks.length > 0 ? `Bookmarks: ${state.bookmarks.length}` : ''}
            </Text>
          )}
          {state.lastModifiedTime && !state.workspaceReloading && <Text color="green">Auto-reloaded</Text>}
        </Box>

        {/* Graph area */}
        <Box
          borderStyle="round"
          borderColor="blue"
          padding={1}
          marginBottom={1}
          width={graphWidth + 2}
          height={graphHeight + 2}
        >
          <Box flexDirection="column">
            {graphLines}
          </Box>
        </Box>

        {/* Legend */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray">● Node  · Dependency  █ Selected</Text>
          <Text color="gray">Tab select | Enter details | / search | F filter | O layout | H help | Esc quit</Text>
        </Box>

        {/* Hot-links hint */}
        {state.selectedNode && (
          <Box marginBottom={1}>
            <Text color="cyan">Actions: </Text>
            <Text color="gray">o: Open URL  e: Edit  D: Docs</Text>
          </Box>
        )}

        {/* Node details hint */}
        {state.selectedNode && (
          <Box>
            <Text color="yellow">Press Enter for details</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Render details view
  if (state.mode === 'details') {
    const selectedNode = state.nodes.find(n => n.id === state.selectedNode);
    const service = state.workspaceConfig?.services?.[state.selectedNode || ''];

    if (!selectedNode) {
      return (
        <Box padding={2}>
          <Text color="red">Node not found</Text>
          <Text color="gray">Press Esc or Q to return</Text>
        </Box>
      );
    }

    const serviceName = service?.name || selectedNode.name;
    const serviceType = normalizeNodeType(service?.type || selectedNode.type);
    const serviceFramework = normalizeFramework(service?.framework) || selectedNode.framework || 'N/A';
    const serviceLanguage = service?.language || selectedNode.language || 'N/A';
    const servicePath = service?.path || selectedNode.path || 'N/A';
    const servicePort = service?.port || selectedNode.port;
    const serviceDependencies = selectedNode.dependencies || [];

    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">Service Details: {selectedNode.name}</Text>
        </Box>

        <Box flexDirection="column" marginLeft={2}>
          <Box>
            <Text bold color="white">Name: </Text>
            <Text>{serviceName}</Text>
          </Box>
          {service?.displayName && (
            <Box>
              <Text bold color="white">Display Name: </Text>
              <Text>{service.displayName}</Text>
            </Box>
          )}
          <Box>
            <Text bold color="white">Type: </Text>
            <Text color={getTypeColor(serviceType)}>{serviceType}</Text>
          </Box>
          <Box>
            <Text bold color="white">Health Status: </Text>
            <Text color={getHealthColor(selectedNode.status)}>{getHealthSymbol(selectedNode.status)} {selectedNode.status.charAt(0).toUpperCase() + selectedNode.status.slice(1)}</Text>
          </Box>
          <Box>
            <Text bold color="white">Language: </Text>
            <Text>{serviceLanguage}</Text>
          </Box>
          <Box>
            <Text bold color="white">Framework: </Text>
            <Text>{serviceFramework}</Text>
          </Box>
          {selectedNode.version && (
            <Box>
              <Text bold color="white">Version: </Text>
              <Text>{selectedNode.version}</Text>
            </Box>
          )}
          {servicePort && (
            <Box>
              <Text bold color="white">Port: </Text>
              <Text>{servicePort}</Text>
            </Box>
          )}
          <Box>
            <Text bold color="white">Path: </Text>
            <Text>{servicePath}</Text>
          </Box>
          {serviceDependencies.length > 0 && (
            <Box>
              <Text bold color="white">Internal Dependencies: </Text>
              <Text>{serviceDependencies.join(', ')}</Text>
            </Box>
          )}
        </Box>

        <Box marginTop={2}>
          <Text color="gray">Esc/Q: Return</Text>
        </Box>
      </Box>
    );
  }

  // Render help view
  if (state.mode === 'help') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">Keyboard Shortcuts</Text>
        </Box>

        <Box flexDirection="column" marginLeft={2}>
          <Box><Text bold color="yellow">Navigation:</Text></Box>
          <ShortcutLine keys="Tab / j / k" label="Cycle through nodes" />
          <ShortcutLine keys="Arrow Keys" label="Pan the graph view" />
          <ShortcutLine keys="g" label="Go to first node" />
          <ShortcutLine keys="Shift+G (G)" label="Go to last node" />
          <ShortcutLine keys="b" label="Go to previous node" />
          <ShortcutLine keys="Space" label="Toggle node selection" />
          <ShortcutLine keys="Enter / d" label="View node details" />

          <Box marginTop={1}><Text bold color="yellow">Zoom & View:</Text></Box>
          <ShortcutLine keys="+/-" label="Zoom in/out" />
          <ShortcutLine keys="Ctrl+W / Ctrl+Z" label="Zoom in/out" />
          <ShortcutLine keys="0 / u" label="Reset zoom to 100%" />

          <Box marginTop={1}><Text bold color="yellow">Search & Filter:</Text></Box>
          <ShortcutLine keys="/ / :" label="Search services / Open command mode" />
          <ShortcutLine keys="n / Shift+N (N)" label="Next/previous non-healthy node" />
          <ShortcutLine keys="* / #" label="Next/previous node by name" />
          <ShortcutLine keys="F" label="Cycle filter" />
          <ShortcutLine keys="1-5" label="Quick views" />
          <ShortcutLine keys="Ctrl+0" label="Reset filter to All" />
          <ShortcutLine keys="L" label="Filter by language" />
          <ShortcutLine keys="W" label="Filter by framework" />
          <ShortcutLine keys="S" label="Filter by health status" />

          <Box marginTop={1}><Text bold color="yellow">Bookmarks:</Text></Box>
          <ShortcutLine keys="B" label="Open bookmarks view" />
          <ShortcutLine keys="Ctrl+B" label="Save current view as bookmark" />
          <ShortcutLine keys="1-9" label="Quick load bookmark by number" />

          <Box marginTop={1}><Text bold color="yellow">Hot-Links (requires selection):</Text></Box>
          <ShortcutLine keys="o" label="Open service URL in browser" />
          <ShortcutLine keys="e" label="Open service code in editor" />
          <ShortcutLine keys="Shift+D (D)" label="Open framework documentation" />

          <Box marginTop={1}><Text bold color="yellow">Graph Features:</Text></Box>
          <ShortcutLine keys="P" label="Set target node for dependency path" />
          <ShortcutLine keys="C / v" label="Toggle clustering mode" />
          <ShortcutLine keys="M" label="Cycle clustering mode" />
          <ShortcutLine keys="O" label="Cycle layout algorithms" />
          <ShortcutLine keys="R" label="Recalculate graph layout" />

          <Box marginTop={1}><Text bold color="yellow">Animations:</Text></Box>
          <ShortcutLine keys="a" label="Animate selected node" />
          <ShortcutLine keys="Shift+A (A)" label="Animate all nodes" />

          <Box marginTop={1}><Text bold color="yellow">Analysis:</Text></Box>
          <ShortcutLine keys="I" label="Run dependency inventory" />

          <Box marginTop={1}><Text bold color="yellow">Tour & Help:</Text></Box>
          <ShortcutLine keys="t" label="Start guided tour" />
          <ShortcutLine keys="H / ?" label="Show this help" />

          <Box marginTop={1}><Text bold color="yellow">General:</Text></Box>
          <ShortcutLine keys="Esc / q" label="Exit / Go back" />
          <ShortcutLine keys="Ctrl+C" label="Quit TUI" />
        </Box>

        <Box marginTop={2}>
          <Text color="gray">Press Esc, Q, or Enter to return</Text>
        </Box>
      </Box>
    );
  }

  // Render search view
  if (state.mode === 'search') {
    const searchResults = visibleNodes;

    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">Search Services</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="gray">Search: </Text>
          <Text bold color="cyan">{state.searchQuery || '(type to search)'}</Text>
          <Text color="gray"> | Results: {searchResults.length}</Text>
        </Box>

        {/* Active filters display */}
        <Box marginBottom={1}>
          <Text color="gray">Filters: </Text>
          {state.filter !== 'all' && <Text color="magenta">Type: {state.filter} </Text>}
          {state.filterLanguage && <Text color="magenta">| Lang: {state.filterLanguage} </Text>}
          {state.filterFramework && <Text color="blue">| Framework: {state.filterFramework} </Text>}
          {state.filterStatus !== 'all' && <Text color={getHealthColor(state.filterStatus)}>| Status: {state.filterStatus} </Text>}
        </Box>

        {/* Search results */}
        <Box
          borderStyle="round"
          borderColor="blue"
          padding={1}
          marginBottom={1}
          flexDirection="column"
          height={Math.min(15, searchResults.length + 2)}
        >
          {searchResults.length === 0 ? (
            <Text color="gray">No matching services found</Text>
          ) : (
            searchResults.map(node => (
              <Box key={node.id}>
                <Text
                  color={node.id === state.selectedNode ? 'cyan' : 'white'}
                  bold={node.id === state.selectedNode}
                >
                  {node.id === state.selectedNode ? '► ' : '  '}
                  {node.name}
                </Text>
                <Text color="gray"> - </Text>
                <Text color={getTypeColor(node.type)}>{node.type}</Text>
                {node.language && <Text color="gray"> ({node.language})</Text>}
                <Text color="gray"> - </Text>
                <Text color={getHealthColor(node.status)}>{getHealthSymbol(node.status)}</Text>
              </Box>
            ))
          )}
        </Box>

        <Box>
          <Text color="gray">Type to search | Tab to select | Enter to view details | Esc to exit</Text>
        </Box>
      </Box>
    );
  }

  // Render bookmarks view
  if (state.mode === 'bookmarks') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">Saved Graph Views</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="gray">Bookmarks: {state.bookmarks.length} | </Text>
          <Text color="gray">Press Ctrl+B to save current view</Text>
        </Box>

        {/* Bookmarks list */}
        <Box
          borderStyle="round"
          borderColor="blue"
          padding={1}
          marginBottom={1}
          flexDirection="column"
          height={Math.min(15, state.bookmarks.length + 2)}
        >
          {state.bookmarks.length === 0 ? (
            <Text color="gray">No bookmarks saved yet.</Text>
          ) : (
            state.bookmarks.map((bookmark, index) => (
              <Box key={index}>
                <Text
                  color={index === state.selectedBookmark ? 'cyan' : 'white'}
                  bold={index === state.selectedBookmark}
                >
                  {index === state.selectedBookmark ? '► ' : '  '}
                  {index + 1}. {bookmark.name}
                </Text>
                <Text color="gray"> - </Text>
                <Text color="gray">
                  Zoom: {(bookmark.zoom * 100).toFixed(0)}% |
                  Filter: {bookmark.filter} |
                  Layout: {bookmark.layoutMode}
                </Text>
              </Box>
            ))
          )}
        </Box>

        <Box flexDirection="column">
          <Text color="gray">Actions:</Text>
          <Text color="gray">  ↑↓: Select | R: Restore | D: Delete | 1-9: Quick load</Text>
          <Text color="gray">  Ctrl+B: Save current view | Esc/Q: Return</Text>
        </Box>
      </Box>
    );
  }

  // Render dependency analysis view
  if (state.mode === 'analysis') {
    const analysis = state.dependencyAnalysis;

    if (!analysis) {
      return (
        <Box padding={2}>
          <Text color="cyan">No analysis available. Press 'i' to run analysis.</Text>
        </Box>
      );
    }

    // Filter issues by severity if filter is active
    const filteredIssues = state.analysisServiceFilter
      ? analysis.issues.filter(issue => issue.severity === state.analysisServiceFilter)
      : analysis.issues;

    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">Dependency Analysis Report</Text>
        </Box>

        {/* Summary */}
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text bold color="white">Services Analyzed: </Text>
            <Text color="cyan">{analysis.servicesAnalyzed}</Text>
            <Text color="gray"> | </Text>
            <Text bold color="white">Total Dependencies: </Text>
            <Text color="cyan">{analysis.totalDependencies}</Text>
          </Box>
          <Box>
            <Text bold color="white">Issues Found: </Text>
            <Text color="red"> Critical: {analysis.summary.critical}</Text>
            <Text color="gray"> | </Text>
            <Text color="yellow">High: {analysis.summary.high}</Text>
            <Text color="gray"> | </Text>
            <Text color="blue">Medium: {analysis.summary.medium}</Text>
            <Text color="gray"> | </Text>
            <Text color="gray">Low: {analysis.summary.low}</Text>
          </Box>
        </Box>

        {/* Filter indicator */}
        {state.analysisServiceFilter && (
          <Box marginBottom={1}>
            <Text color="yellow">Filter: {state.analysisServiceFilter} severity only</Text>
          </Box>
        )}

        {/* Issues list */}
        <Box
          borderStyle="single"
          borderColor="blue"
          padding={1}
          marginBottom={1}
          flexDirection="column"
          height={terminalHeight - 15}
        >
          {filteredIssues.length === 0 ? (
            <Box>
              <Text color="green">No issues found matching the current filter.</Text>
            </Box>
          ) : (
            filteredIssues.slice(0, terminalHeight - 17).map((issue, index) => (
              <Box key={index} marginBottom={1}>
                <Text color={getSeverityColor(issue.severity)}>
                  {getIssueTypeIcon(issue.type)} [{issue.severity.toUpperCase()}]
                </Text>
                <Text color="white"> {issue.service} → {issue.dependency}</Text>
                {issue.currentVersion && (
                  <Text color="gray"> ({issue.currentVersion}</Text>
                )}
                {issue.recommendedVersion && (
                  <Text color="gray"> → {issue.recommendedVersion})</Text>
                )}
                <Box marginLeft={2}>
                  <Text color="gray">{issue.description}</Text>
                </Box>
                <Box marginLeft={2}>
                  <Text color="cyan">→ {issue.recommendation}</Text>
                </Box>
              </Box>
            ))
          )}
          {filteredIssues.length > terminalHeight - 17 && (
            <Box>
              <Text color="gray">... and {filteredIssues.length - (terminalHeight - 17)} more issues</Text>
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box flexDirection="column">
          <Text color="gray">Actions:</Text>
          <Text color="gray">  F: Cycle filter (all/critical/high/medium/low)</Text>
          <Text color="gray">  S: Sort by severity | R: Re-run analysis</Text>
          <Text color="gray">  Esc/Q: Return to graph</Text>
        </Box>
      </Box>
    );
  }

  // Render tour overlay if active
  if (state.tourActive) {
    const currentStep = tourSteps[state.tourStep];
    const progress = `${state.tourStep + 1}/${tourSteps.length}`;

    return (
      <Box flexDirection="column" padding={1}>
        {/* Background: current view with reduced visibility */}
        <Box flexGrow={1}>
          {state.mode === 'graph' && (
            <Box flexDirection="column" padding={1}>
              <Text bold color="cyan">Re-Shell Microservices Architecture</Text>
              <Text dimColor>
                Nodes: {state.nodes.length} | Edges: {state.edges.length} | Filter: {state.filter} | Layout: {state.layoutMode}
              </Text>
              <Box marginTop={1}>
                <Text dimColor>(Tour mode - view is dimmed)</Text>
              </Box>
            </Box>
          )}
        </Box>

        {/* Tour overlay box */}
        <Box
          borderStyle="double"
          borderColor="cyan"
          padding={1}
          marginBottom={1}
          width={terminalWidth - 4}
        >
          {/* Progress bar */}
          <Box marginBottom={1}>
            <Text bold color="cyan">
              ╔═ Tour: {progress} ══ {currentStep.title} ═╗
            </Text>
          </Box>

          {/* Description */}
          <Box marginBottom={1}>
            <Text>{currentStep.description}</Text>
          </Box>

          {/* Action hint */}
          {currentStep.action && (
            <Box marginBottom={1}>
              <Text color="yellow" bold>
                Action: {currentStep.action}
              </Text>
            </Box>
          )}

          {/* Highlight area indicator */}
          {currentStep.highlightArea && (
            <Box marginBottom={1}>
              <Text color="green">
                Highlight: {currentStep.highlightArea}
              </Text>
            </Box>
          )}

          {/* Navigation controls */}
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="gray">Controls:</Text>
            <Text color="gray">  Enter/→/n: Next step</Text>
            <Text color="gray">  ←/p: Previous step</Text>
            <Text color="gray">  Esc/q: Exit tour</Text>
          </Box>

          {/* Progress indicator */}
          <Box marginTop={1}>
            <Text color="cyan">
              {'█'.repeat(Math.floor((state.tourStep + 1) / tourSteps.length * 30))}
              {'░'.repeat(30 - Math.floor((state.tourStep + 1) / tourSteps.length * 30))}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return null;
};

// Helper function to get type color
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    frontend: 'green',
    backend: 'blue',
    worker: 'yellow',
    function: 'yellow',
    app: 'green',
    package: 'blue',
    lib: 'magenta',
    tool: 'cyan',
    database: 'red',
    queue: 'magenta',
    cache: 'cyan',
    unknown: 'gray',
  };
  return colors[type] || 'white';
}

// Export function to launch TUI
export async function launchInkTUI(options: InkTUIProps = {}): Promise<void> {
  try {
    await loadInkRuntime();
    const instance = inkRender(<InkTUI {...options} />);
    if (instance?.waitUntilExit) {
      await instance.waitUntilExit();
    }
  } catch (error: unknown) {
    console.error(chalk.red('Failed to launch TUI:', (error as Error).message));
    process.exit(1);
  }
}
