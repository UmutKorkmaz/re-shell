// Ink-based TUI with Interactive Graph Visualization
import React, { useState, useEffect, useCallback, useMemo } from 'react';
// @ts-ignore - Ink module resolution issue with CommonJS
import { render, Box, Text, useInput, useApp } from 'ink';
// @ts-ignore - ink-spinner module resolution issue
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { workspaceParser, WorkspaceConfig, ServiceConfig, ValidationResult } from '../parsers/workspace-parser';
import { exec } from 'child_process';
import * as chokidar from 'chokidar';

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
interface GraphNode {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'worker' | 'database' | 'queue' | 'cache';
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  framework?: string;
  language?: string;
  port?: number;
  x: number;
  y: number;
  // Performance metrics
  metrics?: {
    cpu: number; // Percentage
    memory: number; // MB
    responseTime: number; // ms
    throughput: number; // requests per second
  };
  // Historical metrics for trends
  metricsHistory?: Array<{
    timestamp: number;
    cpu: number;
    memory: number;
    responseTime: number;
    throughput: number;
  }>;
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

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

interface RemoteCursor {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  selectedNode: string | null;
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
  filter: 'all' | 'frontend' | 'backend' | 'worker' | 'database' | 'queue' | 'cache' | 'network' | 'services';
  searchQuery: string; // Search query for filtering nodes
  filterLanguage: string; // Filter by language
  filterFramework: string; // Filter by framework
  filterStatus: 'all' | 'healthy' | 'warning' | 'error' | 'unknown'; // Filter by health status
  clusteringEnabled: boolean; // Whether clustering is active
  clusteringBy: 'language' | 'framework' | 'type' | 'team'; // What to cluster by
  layoutMode: 'force-directed' | 'hierarchical' | 'circular' | 'organic'; // Graph layout algorithm
  loading: boolean;
  error: string | null;
  animationFrame: number; // For pulsing animations
  serviceLogs: Record<string, LogEntry[]>; // Logs for each service
  detailsScrollOffset: number; // Scroll offset for details view
  showMetrics: boolean; // Toggle metrics charts in details view
  bookmarks: GraphBookmark[]; // Saved graph views
  selectedBookmark: number | null; // Currently selected bookmark index
  workspaceReloading: boolean; // True when workspace is being reloaded
  lastModifiedTime: number | null; // Last modification time of workspace file
  collaborativeMode: boolean; // Whether collaborative mode is enabled
  remoteCursors: RemoteCursor[]; // Simulated remote users' cursors
  userName: string; // Current user's name
  tourActive: boolean; // Whether tour mode is active
  tourStep: number; // Current tour step (0-based)
  tourCompleted: boolean; // Whether user has completed the tour
  dependencyAnalysis: DependencyAnalysis | null; // Dependency analysis results
  analysisServiceFilter: string | null; // Filter analysis by service
}

interface GraphBookmark {
  name: string;
  timestamp: number;
  zoom: number;
  scrollOffset: { x: number; y: number };
  filter: 'all' | 'frontend' | 'backend' | 'worker' | 'database' | 'queue' | 'cache' | 'network' | 'services';
  filterLanguage: string;
  filterFramework: string;
  filterStatus: 'all' | 'healthy' | 'warning' | 'error' | 'unknown';
  layoutMode: 'force-directed' | 'hierarchical' | 'circular' | 'organic';
  clusteringEnabled: boolean;
  clusteringBy: 'language' | 'framework' | 'type' | 'team';
  selectedNode: string | null;
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
    description: 'Press Enter on a selected node to view detailed information including metrics, logs, dependencies, and configuration.',
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
    id: 'service-control',
    title: 'Service Control',
    description: 'Control services directly from the graph: Ctrl+S to start, Ctrl+X to stop, Ctrl+R to restart, Ctrl+L to view logs.',
    action: 'Ctrl+S / Ctrl+X / Ctrl+R / Ctrl+L',
  },
  {
    id: 'collaborative',
    title: 'Collaborative Mode',
    description: 'Press Ctrl+Shift+C to toggle collaborative mode. This shows simulated remote cursors for multi-user viewing scenarios.',
    action: 'Ctrl+Shift+C',
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
  const servicesAnalyzed = state.nodes.length;

  state.nodes.forEach(node => {
    // Simulate dependency analysis
    // In production, this would parse package.json, requirements.txt, etc.

    // Security vulnerabilities
    if (node.framework === 'express' && Math.random() > 0.7) {
      issues.push({
        type: 'security',
        severity: 'critical',
        service: node.id,
        dependency: 'express',
        currentVersion: '4.17.0',
        recommendedVersion: '4.18.2',
        description: 'Known security vulnerabilities in Express < 4.18.2',
        recommendation: 'Update Express to 4.18.2 or later to fix CVE-2022-24999',
      });
    }

    // Performance issues
    if (node.type === 'database' && node.framework === 'mongodb' && Math.random() > 0.6) {
      issues.push({
        type: 'performance',
        severity: 'high',
        service: node.id,
        dependency: 'mongodb-driver',
        currentVersion: '3.6.0',
        recommendedVersion: '4.12.0',
        description: 'Outdated MongoDB driver with performance issues',
        recommendation: 'Upgrade to MongoDB Driver 4.x for 40% better performance',
      });
    }

    // Outdated dependencies
    if (Math.random() > 0.5) {
      const deps = ['react', 'lodash', 'axios', 'moment', 'typescript'];
      const dep = deps[Math.floor(Math.random() * deps.length)];
      issues.push({
        type: 'outdated',
        severity: 'medium',
        service: node.id,
        dependency: dep,
        currentVersion: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
        recommendedVersion: 'latest',
        description: `${dep} is outdated and missing bug fixes`,
        recommendation: `Update ${dep} to the latest version`,
      });
    }

    // Duplicate dependencies
    if (Math.random() > 0.8) {
      issues.push({
        type: 'duplicate',
        severity: 'low',
        service: node.id,
        dependency: 'lodash',
        description: 'Multiple versions of lodash detected in dependency tree',
        recommendation: 'Deduplicate lodash versions to reduce bundle size',
      });
    }

    // Missing dependencies
    if (Math.random() > 0.85) {
      issues.push({
        type: 'missing',
        severity: 'high',
        service: node.id,
        dependency: '@types/node',
        description: 'Type definitions are missing for Node.js',
        recommendation: 'Install @types/node for better TypeScript support',
      });
    }

    totalDependencies += Math.floor(Math.random() * 50) + 10;
  });

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

// Force-directed graph layout algorithm
function calculateLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): GraphNode[] {
  const positionedNodes = [...nodes];
  const iterations = 50;
  const repulsion = 5000;
  const attraction = 0.01;
  const damping = 0.9;

  // Initialize random positions
  positionedNodes.forEach(node => {
    node.x = Math.random() * width;
    node.y = Math.random() * height;
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
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

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

  // Initialize with random positions
  positionedNodes.forEach(node => {
    node.x = Math.random() * width;
    node.y = Math.random() * height;
  });

  // Simulated annealing-like approach
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

// Convert workspace config to graph nodes
function workspaceToGraph(config: WorkspaceConfig): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  if (config.services) {
    Object.entries(config.services).forEach(([id, service]: [string, any]) => {
      nodes.push({
        id,
        name: service.name || id,
        type: service.type || 'frontend',
        status: 'unknown',
        framework: service.framework,
        language: service.language,
        port: service.port,
        x: 0,
        y: 0,
      });
    });
  }

  if (config.dependencies) {
    Object.entries(config.dependencies).forEach(([fromId, deps]: [string, any]) => {
      if (Array.isArray(deps)) {
        deps.forEach((toId: string) => {
          edges.push({ from: fromId, to: toId, type: 'dependency' });
        });
      }
    });
  }

  return { nodes, edges };
}

// Check health status of a service (simulated)
async function checkServiceHealth(service: any): Promise<'healthy' | 'warning' | 'error' | 'unknown'> {
  // In a real implementation, this would make HTTP requests to health endpoints
  // For now, simulate health status based on service properties
  if (service.port) {
    // Simulate health check - in production, would ping the service
    const random = Math.random();
    if (random > 0.8) return 'healthy';
    if (random > 0.6) return 'warning';
    if (random > 0.4) return 'error';
  }
  return 'unknown';
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

// Simulate collecting performance metrics for a service
function collectServiceMetrics(service: any): { cpu: number; memory: number; responseTime: number; throughput: number } {
  // In production, this would query actual metrics from:
  // - Docker stats API
  // - Kubernetes metrics API
  // - Cloud provider monitoring APIs
  // - Application performance monitoring (APM) tools

  // For now, simulate realistic metrics based on service properties
  const random = Math.random();

  return {
    cpu: Math.floor(random * 80) + 5, // 5-85% CPU usage
    memory: Math.floor(random * 512) + 64, // 64-576 MB memory
    responseTime: Math.floor(random * 200) + 10, // 10-210ms response time
    throughput: Math.floor(random * 1000) + 50, // 50-1050 requests/sec
  };
}

// Generate simulated log entries for a service
function generateServiceLogs(serviceId: string, count: number = 20): LogEntry[] {
  const levels: Array<'info' | 'warn' | 'error' | 'debug'> = ['info', 'info', 'info', 'warn', 'debug', 'error'];
  const messages = [
    'Starting service...',
    'Database connection established',
    'Health check passed',
    'Processing request',
    'Cache hit for key',
    'API response sent',
    'Background job completed',
    'Memory usage within limits',
    'High response time detected',
    'Connection pool exhausted',
    'Authentication failed',
    'Database query slow',
    'Service registered',
    'Configuration loaded',
    'Metrics updated',
  ];

  const logs: LogEntry[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = new Date(now - (count - i) * 5000).toISOString();

    logs.push({
      timestamp,
      level,
      message,
      source: serviceId,
    });
  }

  return logs;
}

// Get color for log level
function getLogLevelColor(level: 'info' | 'warn' | 'error' | 'debug'): string {
  switch (level) {
    case 'info': return 'blue';
    case 'warn': return 'yellow';
    case 'error': return 'red';
    case 'debug': return 'gray';
  }
}

// Get symbol for log level
function getLogLevelSymbol(level: 'info' | 'warn' | 'error' | 'debug'): string {
  switch (level) {
    case 'info': return 'ℹ';
    case 'warn': return '⚠';
    case 'error': return '✗';
    case 'debug': return '◉';
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

// Main TUI Component
const InkTUI: React.FC = () => {
  const { exit } = useApp();
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
    animationFrame: 0,
    serviceLogs: {},
    detailsScrollOffset: 0,
    showMetrics: true,
    bookmarks: [],
    selectedBookmark: null,
    workspaceReloading: false,
    lastModifiedTime: null,
    collaborativeMode: false,
    remoteCursors: [],
    userName: 'You',
    tourActive: false,
    tourStep: 0,
    tourCompleted: false,
    dependencyAnalysis: null,
    analysisServiceFilter: null,
  });

  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;

  // Load workspace configuration
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const configPath = path.join(process.cwd(), 're-shell.workspaces.yaml');
        const result: ValidationResult = workspaceParser.parse(configPath);

        if (!result.valid || !result.config) {
          setState(prev => ({ ...prev, loading: false, error: result.errors.map(e => e.message).join(', ') }));
          return;
        }

        const { nodes, edges } = workspaceToGraph(result.config);
        const layoutNodes = calculateLayout(nodes, edges, terminalWidth - 40, terminalHeight - 10);

        setState(prev => ({
          ...prev,
          nodes: layoutNodes,
          edges,
          workspaceConfig: result.config,
          loading: false,
        }));
      } catch (error: any) {
        setState(prev => ({ ...prev, loading: false, error: error.message }));
      }
    };

    loadWorkspace();
  }, []);

  // Watch workspace file for changes and reload automatically
  useEffect(() => {
    const configPath = path.join(process.cwd(), 're-shell.workspaces.yaml');

    // Check if file exists before watching
    if (!fs.existsSync(configPath)) {
      return;
    }

    const watcher = chokidar.watch(configPath, {
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
        const result: ValidationResult = workspaceParser.parse(configPath);

        if (result.valid && result.config) {
          const { nodes, edges } = workspaceToGraph(result.config);
          const layoutNodes = calculateLayout(nodes, edges, terminalWidth - 40, terminalHeight - 10);

          setTimeout(() => {
            setState(prev => ({
              ...prev,
              nodes: layoutNodes,
              edges,
              workspaceConfig: result.config,
              workspaceReloading: false,
              lastModifiedTime: Date.now(),
            }));
          }, 500); // Wait for animation to partially complete
        } else {
          setState(prev => ({
            ...prev,
            error: result.errors.map(e => e.message).join(', '),
            workspaceReloading: false,
          }));
        }
      } catch (error: any) {
        setState(prev => ({
          ...prev,
          error: error.message,
          workspaceReloading: false,
        }));
      }
    });

    return () => {
      watcher.close().catch(() => {
        // Ignore cleanup errors
      });
    };
  }, []);

  // Animation frame updates for pulsing effects
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({ ...prev, animationFrame: prev.animationFrame + 1 }));
    }, 100); // Update 10 times per second

    return () => clearInterval(interval);
  }, []);

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

  // Simulate collaborative cursors
  useEffect(() => {
    if (!state.collaborativeMode) {
      setState(prev => ({ ...prev, remoteCursors: [] }));
      return;
    }

    // Create simulated remote users
    const simulatedUsers: RemoteCursor[] = [
      { id: 'user1', name: 'Alice', color: 'magenta', x: 10, y: 5, selectedNode: null },
      { id: 'user2', name: 'Bob', color: 'cyan', x: 20, y: 10, selectedNode: null },
    ];

    setState(prev => ({ ...prev, remoteCursors: simulatedUsers }));

    // Animate remote cursors
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        remoteCursors: prev.remoteCursors.map(cursor => ({
          ...cursor,
          x: Math.max(0, Math.min(terminalWidth - 40, cursor.x + (Math.random() - 0.5) * 5)),
          y: Math.max(0, Math.min(terminalHeight - 10, cursor.y + (Math.random() - 0.5) * 3)),
        })),
      }));
    }, 500);

    return () => clearInterval(interval);
  }, [state.collaborativeMode, terminalWidth, terminalHeight]);

  // Trigger demo animations on startup
  useEffect(() => {
    if (!state.loading && state.nodes.length > 0) {
      // Randomly animate some nodes to demonstrate the feature
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          nodes: prev.nodes.map((node, index) => {
            // Animate first 3 nodes as demo
            if (index < 3) {
              return {
                ...node,
                animating: true,
                animationProgress: 0,
                animationType: 'appearing',
              };
            }
            return node;
          }),
        }));
      }, 500);
    }
  }, [state.loading]);

  // Periodic health checks and metrics collection
  useEffect(() => {
    if (!state.workspaceConfig || state.loading) return;

    const checkHealthAndCollectMetrics = async () => {
      const config = state.workspaceConfig;
      if (!config.services) return;

      const updatedNodes = await Promise.all(state.nodes.map(async (node) => {
        const service = config.services![node.id];
        if (service) {
          const healthStatus = await checkServiceHealth(service);
          const metrics = collectServiceMetrics(service);

          // Add metrics history (keep last 20 data points)
          const historyEntry = {
            timestamp: Date.now(),
            ...metrics,
          };

          const updatedHistory = [
            ...(node.metricsHistory || []),
            historyEntry,
          ].slice(-20);

          return {
            ...node,
            status: healthStatus,
            metrics,
            metricsHistory: updatedHistory,
          };
        }
        return node;
      }));

      setState(prev => ({ ...prev, nodes: updatedNodes }));
    };

    // Initial health check and metrics collection
    checkHealthAndCollectMetrics();

    // Update health and metrics every 5 seconds
    const interval = setInterval(checkHealthAndCollectMetrics, 5000);

    return () => clearInterval(interval);
  }, [state.workspaceConfig, state.loading]);

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
        const filters: Array<'all' | 'frontend' | 'backend' | 'worker' | 'database' | 'queue' | 'cache' | 'network' | 'services'> =
          ['all', 'frontend', 'backend', 'worker', 'database', 'queue', 'cache', 'network', 'services'];
        const currentFilterIndex = filters.indexOf(state.filter as any);
        const nextFilter = filters[(currentFilterIndex + 1) % filters.length];
        setState(prev => ({ ...prev, filter: nextFilter as any, selectedNode: null }));
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
        // Recalculate layout
        if (state.workspaceConfig) {
          const { nodes, edges } = workspaceToGraph(state.workspaceConfig);
          const layoutNodes = applyLayout(nodes, edges, state.layoutMode, terminalWidth - 40, terminalHeight - 10);
          setState(prev => ({ ...prev, nodes: layoutNodes }));
        }
      } else if (input === 'o') {
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
      } else if (input === 'C' && key.ctrl) {
        // Toggle collaborative mode (Ctrl+C but not exit)
        setState(prev => ({ ...prev, collaborativeMode: !prev.collaborativeMode }));
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
      } else if (input === 's' && key.ctrl && state.selectedNode) {
        // Start service (Ctrl+s)
        const service = state.workspaceConfig?.services?.[state.selectedNode];
        if (service) {
          console.log(`\nStarting service: ${state.selectedNode}`);
          console.log(`  Path: ${service.path || 'N/A'}`);
          console.log(`  Command: npm run dev\n`);

          // Mark service as deploying with animation
          setState(prev => ({
            ...prev,
            nodes: prev.nodes.map(node => {
              if (node.id === state.selectedNode) {
                return {
                  ...node,
                  status: 'warning',
                  animating: true,
                  animationProgress: 0,
                  animationType: 'deploying',
                };
              }
              return node;
            }),
          }));

          // Simulate service starting
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              nodes: prev.nodes.map(node => {
                if (node.id === state.selectedNode) {
                  return { ...node, status: 'healthy', animating: false };
                }
                return node;
              }),
            }));
          }, 3000);
        }
      } else if (input === 'x' && key.ctrl && state.selectedNode) {
        // Stop service (Ctrl+x)
        const service = state.workspaceConfig?.services?.[state.selectedNode];
        if (service) {
          console.log(`\nStopping service: ${state.selectedNode}\n`);

          // Mark service as stopped
          setState(prev => ({
            ...prev,
            nodes: prev.nodes.map(node => {
              if (node.id === state.selectedNode) {
                return {
                  ...node,
                  status: 'error',
                  animating: true,
                  animationProgress: 0,
                  animationType: 'disappearing',
                };
              }
              return node;
            }),
          }));

          setTimeout(() => {
            setState(prev => ({
              ...prev,
              nodes: prev.nodes.map(node => {
                if (node.id === state.selectedNode) {
                  return { ...node, animating: false };
                }
                return node;
              }),
            }));
          }, 1000);
        }
      } else if (input === 'r' && key.ctrl && state.selectedNode) {
        // Restart service (Ctrl+r)
        const service = state.workspaceConfig?.services?.[state.selectedNode];
        if (service) {
          console.log(`\nRestarting service: ${state.selectedNode}\n`);

          // Animate restart
          setState(prev => ({
            ...prev,
            nodes: prev.nodes.map(node => {
              if (node.id === state.selectedNode) {
                return {
                  ...node,
                  status: 'warning',
                  animating: true,
                  animationProgress: 0,
                  animationType: 'scaling',
                };
              }
              return node;
            }),
          }));

          setTimeout(() => {
            setState(prev => ({
              ...prev,
              nodes: prev.nodes.map(node => {
                if (node.id === state.selectedNode) {
                  return { ...node, status: 'healthy', animating: false };
                }
                return node;
              }),
            }));
          }, 2000);
        }
      } else if (input === 'l' && key.ctrl && state.selectedNode) {
        // View service logs (Ctrl+l)
        const service = state.workspaceConfig?.services?.[state.selectedNode];
        if (service) {
          console.log(`\nShowing logs for: ${state.selectedNode}`);
          console.log(`  (In production, this would tail service logs)\n`);
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
        } else if (input === 'm') {
          // Toggle metrics display
          setState(prev => ({ ...prev, showMetrics: !prev.showMetrics }));
        } else if (input === 'l') {
          // Generate logs for selected service
          if (state.selectedNode && !state.serviceLogs[state.selectedNode]) {
            const logs = generateServiceLogs(state.selectedNode);
            setState(prev => ({
              ...prev,
              serviceLogs: { ...prev.serviceLogs, [state.selectedNode]: logs },
            }));
          }
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
          const currentIndex = severities.indexOf(currentFilter as any);
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
        // Show services only (frontend + backend + worker)
        if (!['frontend', 'backend', 'worker'].includes(node.type)) {
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
      return (
        <Box padding={2}>
          <Text color="red">Error: {state.error}</Text>
          <Text color="gray">Press Ctrl+C to exit</Text>
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
          let animating = false;

          if (nodeAtPos.animating && nodeAtPos.animationProgress !== undefined) {
            animating = true;
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

          // Pulsing effect for animation frame counter (subtle continuous animation)
          if (!animating && nodeAtPos.status === 'healthy') {
            const pulse = Math.sin(state.animationFrame * 0.1 + nodeAtPos.x) * 0.3 + 0.7;
            if (pulse > 0.9) {
              symbol = '◉'; // Slightly larger when pulsing
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
            Re-Shell Workspace TUI - Interactive Graph
          </Text>
        </Box>

        {/* Status bar with zoom level, health summary, metrics, active filters, and path info */}
        <Box marginBottom={1}>
          {state.workspaceReloading ? (
            <Text color="yellow">⟳ Reloading workspace... </Text>
          ) : (
            <Text color="gray">
              Nodes: {visibleNodes.length}/{state.nodes.length} | Filter: {state.filter} | Layout: {state.layoutMode} | Zoom: {(state.zoom * 100).toFixed(0)}%
            </Text>
          )}
          {state.lastModifiedTime && !state.workspaceReloading && <Text color="green"> ✓ Auto-reloaded</Text>}
          {state.searchQuery && <Text color="cyan"> | Search: "{state.searchQuery}"</Text>}
          {state.filterLanguage && <Text color="magenta"> | Lang: {state.filterLanguage}</Text>}
          {state.filterFramework && <Text color="blue"> | Framework: {state.filterFramework}</Text>}
          {state.filterStatus !== 'all' && <Text color={getHealthColor(state.filterStatus)}> | Status: {state.filterStatus}</Text>}
          {state.targetNode && <Text color="cyan"> | Path: {state.selectedNode || '?'} → {state.targetNode} ({pathNodes.size - 1 || 0} hops)</Text>}
          <Text color="gray"> | </Text>
          <Text color="green">✓ {visibleNodes.filter(n => n.status === 'healthy').length} </Text>
          <Text color="yellow">⚠ {visibleNodes.filter(n => n.status === 'warning').length} </Text>
          <Text color="red">✗ {visibleNodes.filter(n => n.status === 'error').length}</Text>
          {visibleNodes.some(n => n.animating) && <Text color="cyan"> | Animating: {visibleNodes.filter(n => n.animating).length}</Text>}
          {state.collaborativeMode && <Text color="magenta"> | 👥 Collaborative: {state.remoteCursors.length + 1}</Text>}
          {/* Aggregate metrics display */}
          {visibleNodes.length > 0 && visibleNodes.some(n => n.metrics) && (
            <>
              <Text color="gray"> | </Text>
              <Text color="cyan">Avg CPU: {calculateAverageMetric(visibleNodes, 'cpu').toFixed(0)}% </Text>
              <Text color="magenta">Mem: {calculateAverageMetric(visibleNodes, 'memory').toFixed(0)}MB </Text>
              <Text color="yellow">Resp: {calculateAverageMetric(visibleNodes, 'responseTime').toFixed(0)}ms</Text>
            </>
          )}
          <Text color="gray"> | Selected: {state.selectedNode || 'None'}</Text>
          {state.bookmarks.length > 0 && <Text color="magenta"> | Bookmarks: {state.bookmarks.length}</Text>}
          {!state.tourCompleted && <Text color="cyan"> | Press t for tour</Text>}
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
        <Box marginBottom={1}>
          <Text color="gray">● Service  · Dependency  █ Selected  </Text>
          <Text color="green">✓ Healthy  </Text>
          <Text color="yellow">⚠ Warning  </Text>
          <Text color="red">✗ Error  </Text>
          <Text color="gray">| /: Search  L: Lang  W: Framework  S: Status  P: Path  C: Cluster  M: Mode  O: Layout  B: Bookmarks | Arrows: Pan  +/-: Zoom  0: Reset  F: Filter  H: Help</Text>
        </Box>

        {/* Hot-links hint */}
        {state.selectedNode && (
          <Box marginBottom={1}>
            <Text color="cyan">Actions: </Text>
            <Text color="gray">o: Open URL  e: Edit  D: Docs | </Text>
            <Text color="yellow">Ctrl+S: Start  Ctrl+X: Stop  Ctrl+R: Restart  Ctrl+L: Logs</Text>
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
    const serviceLogs = state.serviceLogs[state.selectedNode || ''] || [];

    if (!selectedNode || !service) {
      return (
        <Box padding={2}>
          <Text color="red">Node not found</Text>
          <Text color="gray">Press Esc or Q to return</Text>
        </Box>
      );
    }

    // Generate sparkline for metrics history
    const renderSparkline = (history: typeof selectedNode.metricsHistory, metricKey: 'cpu' | 'memory' | 'responseTime' | 'throughput', width: number = 30): React.ReactNode => {
      if (!history || history.length < 2) return <Text color="gray">N/A</Text>;

      const values = history.map(h => h[metricKey]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;

      const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
      const sparkline = values.map(v => {
        const normalized = (v - min) / range;
        const blockIndex = Math.floor(normalized * (blocks.length - 1));
        return blocks[blockIndex];
      }).join('');

      return <Text color="cyan">{sparkline}</Text>;
    };

    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">Service Details: {selectedNode.name}</Text>
        </Box>

        <Box flexDirection="column" marginLeft={2}>
          <Box>
            <Text bold color="white">Name: </Text>
            <Text>{service.name || selectedNode.name}</Text>
          </Box>
          <Box>
            <Text bold color="white">Display Name: </Text>
            <Text>{service.displayName || 'N/A'}</Text>
          </Box>
          <Box>
            <Text bold color="white">Type: </Text>
            <Text color={getTypeColor(service.type)}>{service.type}</Text>
          </Box>
          <Box>
            <Text bold color="white">Health Status: </Text>
            <Text color={getHealthColor(selectedNode.status)}>{getHealthSymbol(selectedNode.status)} {selectedNode.status.charAt(0).toUpperCase() + selectedNode.status.slice(1)}</Text>
          </Box>
          <Box>
            <Text bold color="white">Language: </Text>
            <Text>{service.language || 'N/A'}</Text>
          </Box>
          <Box>
            <Text bold color="white">Framework: </Text>
            <Text>{service.framework || 'N/A'}</Text>
          </Box>
          {service.port && (
            <Box>
              <Text bold color="white">Port: </Text>
              <Text>{service.port}</Text>
            </Box>
          )}
          <Box>
            <Text bold color="white">Path: </Text>
            <Text>{service.path || 'N/A'}</Text>
          </Box>

          {/* Performance metrics section */}
          {selectedNode.metrics && state.showMetrics && (
            <>
              <Box marginTop={1}>
                <Text bold color="cyan">────────────────────────────────</Text>
              </Box>
              <Box marginTop={1}>
                <Text bold color="cyan">Performance Metrics (Last 5 min)</Text>
              </Box>
              <Box>
                <Text bold color="white">CPU Usage: </Text>
                <Text color={getMetricColor(selectedNode.metrics.cpu, 'cpu')}>
                  {selectedNode.metrics.cpu}%
                </Text>
                <Text color="gray"> - {getMetricStatus(selectedNode.metrics.cpu, 'cpu')} </Text>
                {renderSparkline(selectedNode.metricsHistory, 'cpu')}
              </Box>
              <Box>
                <Text bold color="white">Memory: </Text>
                <Text color={getMetricColor(selectedNode.metrics.memory, 'memory')}>
                  {selectedNode.metrics.memory} MB
                </Text>
                <Text color="gray"> - {getMetricStatus(selectedNode.metrics.memory, 'memory')} </Text>
                {renderSparkline(selectedNode.metricsHistory, 'memory')}
              </Box>
              <Box>
                <Text bold color="white">Response Time: </Text>
                <Text color={getMetricColor(selectedNode.metrics.responseTime, 'responseTime')}>
                  {selectedNode.metrics.responseTime} ms
                </Text>
                <Text color="gray"> - {getMetricStatus(selectedNode.metrics.responseTime, 'responseTime')} </Text>
                {renderSparkline(selectedNode.metricsHistory, 'responseTime')}
              </Box>
              <Box>
                <Text bold color="white">Throughput: </Text>
                <Text color={getMetricColor(selectedNode.metrics.throughput, 'throughput')}>
                  {selectedNode.metrics.throughput} req/s
                </Text>
                <Text color="gray"> - {getMetricStatus(selectedNode.metrics.throughput, 'throughput')} </Text>
                {renderSparkline(selectedNode.metricsHistory, 'throughput')}
              </Box>
            </>
          )}

          {/* Logs section */}
          {serviceLogs.length > 0 && (
            <>
              <Box marginTop={1}>
                <Text bold color="cyan">────────────────────────────────</Text>
              </Box>
              <Box marginTop={1} marginBottom={1}>
                <Text bold color="cyan">Recent Logs (Last 20 entries)</Text>
              </Box>

              <Box
                borderStyle="single"
                borderColor="blue"
                padding={1}
                flexDirection="column"
                height={Math.min(15, serviceLogs.length + 2)}
              >
                {serviceLogs
                  .slice(state.detailsScrollOffset, state.detailsScrollOffset + 15)
                  .map((log, idx) => (
                    <Box key={idx}>
                      <Text color="gray">[{log.timestamp.slice(11, 19)}] </Text>
                      <Text color={getLogLevelColor(log.level)}>
                        {getLogLevelSymbol(log.level)} {log.level.toUpperCase()}
                      </Text>
                      <Text color="gray">: </Text>
                      <Text>{log.message}</Text>
                    </Box>
                  ))}
              </Box>
              <Box marginTop={1}>
                <Text color="gray">Showing {Math.min(15, serviceLogs.length - state.detailsScrollOffset)} of {serviceLogs.length} logs | Use ↑↓ to scroll</Text>
              </Box>
            </>
          )}

          {serviceLogs.length === 0 && (
            <Box marginTop={1}>
              <Text color="gray">Press L to load logs for this service</Text>
            </Box>
          )}
        </Box>

        <Box marginTop={2}>
          <Text color="gray">Esc/Q: Return | M: Toggle metrics | L: Load logs | ↑↓: Scroll logs</Text>
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
          <Box><Text bold>Tab / j / k</Text> - Cycle through nodes (vim-style j/k)</Box>
          <Box><Text bold>Arrow Keys / h,j,k,l</Text> - Pan the graph view</Box>
          <Box><Text bold>g</Text> - Go to first node (vim-style gg)</Box>
          <Box><Text bold>Shift+G (G)</Text> - Go to last node</Box>
          <Box><Text bold>b</Text> - Go to previous node</Box>
          <Box><Text bold>Space</Text> - Toggle node selection</Box>
          <Box><Text bold>Enter / d</Text> - View node details</Box>

          <Box marginTop={1}><Text bold color="yellow">Zoom & View:</Text></Box>
          <Box><Text bold>+/-</Text> - Zoom in/out</Box>
          <Box><Text bold>Ctrl+W / Ctrl+Z</Text> - Zoom in/out (vim-style)</Box>
          <Box><Text bold>0 / u</Text> - Reset zoom to 100%</Box>

          <Box marginTop={1}><Text bold color="yellow">Search & Filter:</Text></Box>
          <Box><Text bold>/ / :</Text> - Search services / Open command mode</Box>
          <Box><Text bold>n / Shift+N (N)</Text> - Next/previous unhealthy node</Box>
          <Box><Text bold>* / #</Text> - Next/previous node by name</Box>
          <Box><Text bold>F</Text> - Cycle filter (All/Services/DB/Queue/Cache/Network/etc)</Box>
          <Box><Text bold>1-5</Text> - Quick views (1:Services, 2:DB, 3:Queue, 4:Cache, 5:Network)</Box>
          <Box><Text bold>Ctrl+0</Text> - Reset filter to All</Box>
          <Box><Text bold>L</Text> - Filter by language</Box>
          <Box><Text bold>W</Text> - Filter by framework</Box>
          <Box><Text bold>S</Text> - Filter by health status</Box>

          <Box marginTop={1}><Text bold color="yellow">Bookmarks:</Text></Box>
          <Box><Text bold>B</Text> - Open bookmarks view</Box>
          <Box><Text bold>Ctrl+B</Text> - Save current view as bookmark</Box>
          <Box><Text bold>1-9</Text> - Quick load bookmark by number</Box>

          <Box marginTop={1}><Text bold color="yellow">Hot-Links (requires selection):</Text></Box>
          <Box><Text bold>o</Text> - Open service URL in browser</Box>
          <Box><Text bold>e</Text> - Open service code in editor</Box>
          <Box><Text bold>Shift+D (D)</Text> - Open framework documentation</Box>

          <Box marginTop={1}><Text bold color="yellow">Service Control (requires selection):</Text></Box>
          <Box><Text bold>Ctrl+S</Text> - Start service (with animation)</Box>
          <Box><Text bold>Ctrl+X</Text> - Stop service (with animation)</Box>
          <Box><Text bold>Ctrl+R</Text> - Restart service (with animation)</Box>
          <Box><Text bold>Ctrl+L</Text> - View service logs</Box>

          <Box marginTop={1}><Text bold color="yellow">Graph Features:</Text></Box>
          <Box><Text bold>P</Text> - Set target node for dependency path</Box>
          <Box><Text bold>C / v</Text> - Toggle clustering mode</Box>
          <Box><Text bold>M</Text> - Cycle clustering mode (Language/Framework/Type/Team)</Box>
          <Box><Text bold>O</Text> - Cycle layout algorithms (Force-directed/Hierarchical/Circular/Organic)</Box>
          <Box><Text bold>R</Text> - Recalculate graph layout</Box>

          <Box marginTop={1}><Text bold color="yellow">Animations:</Text></Box>
          <Box><Text bold>a</Text> - Animate selected node (deployment)</Box>
          <Box><Text bold>Shift+A (A)</Text> - Animate all nodes (appearing)</Box>

          <Box marginTop={1}><Text bold color="yellow">Analysis:</Text></Box>
          <Box><Text bold>I</Text> - Run dependency analysis (security & performance)</Box>
          <Box><Text bold color="gray">  Shows vulnerabilities, outdated packages, and recommendations</Text></Box>

          <Box marginTop={1}><Text bold color="yellow">Collaboration:</Text></Box>
          <Box><Text bold>Ctrl+Shift+C (C)</Text> - Toggle collaborative mode</Box>
          <Box><Text bold color="gray">  Shows remote cursors and simulates multi-user viewing</Text></Box>

          <Box marginTop={1}><Text bold color="yellow">Tour & Help:</Text></Box>
          <Box><Text bold>t</Text> - Start guided tour</Box>
          <Box><Text bold>H / ?</Text> - Show this help</Box>

          <Box marginTop={1}><Text bold color="yellow">General:</Text></Box>
          <Box><Text bold>Esc / q</Text> - Exit / Go back</Box>
          <Box><Text bold>Ctrl+C</Text> - Quit TUI</Box>
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
    database: 'red',
    queue: 'magenta',
    cache: 'cyan',
  };
  return colors[type] || 'white';
}

// Helper function to calculate average metric across visible nodes
function calculateAverageMetric(nodes: GraphNode[], metricKey: keyof NonNullable<GraphNode['metrics']>): number {
  const nodesWithMetrics = nodes.filter(n => n.metrics && n.metrics[metricKey] !== undefined);
  if (nodesWithMetrics.length === 0) return 0;

  const sum = nodesWithMetrics.reduce((acc, node) => acc + (node.metrics?.[metricKey] || 0), 0);
  return sum / nodesWithMetrics.length;
}

// Helper function to get color based on metric value
function getMetricColor(value: number, metricType: 'cpu' | 'memory' | 'responseTime' | 'throughput'): string {
  switch (metricType) {
    case 'cpu':
      if (value < 50) return 'green';
      if (value < 80) return 'yellow';
      return 'red';
    case 'memory':
      if (value < 256) return 'green';
      if (value < 512) return 'yellow';
      return 'red';
    case 'responseTime':
      if (value < 100) return 'green';
      if (value < 200) return 'yellow';
      return 'red';
    case 'throughput':
      if (value > 500) return 'green';
      if (value > 200) return 'yellow';
      return 'red';
  }
}

// Helper function to get status text based on metric value
function getMetricStatus(value: number, metricType: 'cpu' | 'memory' | 'responseTime' | 'throughput'): string {
  switch (metricType) {
    case 'cpu':
      if (value < 50) return 'Good';
      if (value < 80) return 'Moderate';
      return 'High';
    case 'memory':
      if (value < 256) return 'Good';
      if (value < 512) return 'Moderate';
      return 'High';
    case 'responseTime':
      if (value < 100) return 'Fast';
      if (value < 200) return 'Moderate';
      return 'Slow';
    case 'throughput':
      if (value > 500) return 'Excellent';
      if (value > 200) return 'Good';
      return 'Low';
  }
}

// Export function to launch TUI
export async function launchInkTUI(): Promise<void> {
  try {
    render(<InkTUI />);
  } catch (error: any) {
    console.error(chalk.red('Failed to launch TUI:', error.message));
    process.exit(1);
  }
}
