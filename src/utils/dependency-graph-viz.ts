/**
 * Enhanced Dependency Graph Visualization
 *
 * Provides superior dependency graph visualization across languages with:
 * - Interactive HTML output with D3.js
 * - Real-time updates via file watching
 * - Cross-language dependency detection
 * - Force-directed graph layout
 * - Multiple export formats
 */

import fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';

export interface DependencyNode {
  id: string;
  label: string;
  type: 'app' | 'package' | 'lib' | 'tool' | 'service';
  language: string;
  framework?: string;
  path: string;
  dependencies: string[];
  dependents: string[];
  size?: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'runtime' | 'build' | 'dev' | 'peer' | 'test';
  strength: number;
}

export interface GraphData {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    languages: string[];
    frameworks: string[];
    generatedAt: string;
  };
}

export interface VisualizationOptions {
  output?: string;
  format?: 'html' | 'json' | 'dot' | 'svg' | 'text';
  watch?: boolean;
  groupBy?: 'type' | 'language' | 'framework';
  layout?: 'force' | 'hierarchical' | 'circular';
  includeOrphans?: boolean;
  maxDepth?: number;
  openBrowser?: boolean;
  port?: number;
}

export interface CrossLanguageDependency {
  sourceLanguage: string;
  targetLanguage: string;
  sourceFile: string;
  targetFile: string;
  type: string;
}

/**
 * Language-specific dependency file patterns
 */
const LANGUAGE_PATTERNS: Record<string, { files: string[]; lockFiles: string[]; parsers: string[] }> = {
  javascript: {
    files: ['package.json'],
    lockFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    parsers: ['import', 'require']
  },
  typescript: {
    files: ['package.json', 'tsconfig.json'],
    lockFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    parsers: ['import', 'require']
  },
  python: {
    files: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'poetry.lock'],
    lockFiles: ['Pipfile.lock', 'poetry.lock'],
    parsers: ['import', 'from']
  },
  go: {
    files: ['go.mod'],
    lockFiles: ['go.sum'],
    parsers: ['import']
  },
  rust: {
    files: ['Cargo.toml'],
    lockFiles: ['Cargo.lock'],
    parsers: ['use', 'extern crate']
  },
  java: {
    files: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    lockFiles: [],
    parsers: ['import', 'maven']
  },
  ruby: {
    files: ['Gemfile'],
    lockFiles: ['Gemfile.lock'],
    parsers: ['require']
  },
  php: {
    files: ['composer.json'],
    lockFiles: ['composer.lock'],
    parsers: ['use', 'require']
  },
  csharp: {
    files: ['*.csproj', 'packages.config'],
    lockFiles: ['packages.lock.json'],
    parsers: ['using']
  }
};

/**
 * Color palette for node types
 */
const NODE_COLORS: Record<string, string> = {
  app: '#4CAF50',
  package: '#2196F3',
  lib: '#FF9800',
  tool: '#9C27B0',
  service: '#F44336',
  unknown: '#9E9E9E'
};

/**
 * Language colors for visualization
 */
const LANGUAGE_COLORS: Record<string, string> = {
  javascript: '#F7DF1E',
  typescript: '#3178C6',
  python: '#3776AB',
  go: '#00ADD8',
  rust: '#DEA584',
  java: '#007396',
  ruby: '#CC342D',
  php: '#777BB4',
  csharp: '#9B4F96',
  unknown: '#9E9E9E'
};

export class EnhancedDependencyGraph extends EventEmitter {
  private nodes: Map<string, DependencyNode> = new Map();
  private edges: DependencyEdge[] = [];
  private watchPaths: Set<string> = new Set();
  private watchers: fs.FSWatcher[] = [];

  constructor(private rootPath: string = process.cwd()) {
    super();
  }

  /**
   * Analyze dependencies for a project
   */
  async analyze(): Promise<GraphData> {
        this.nodes.clear();
    this.edges = [];

    // Detect project structure (use sync to avoid module resolution issues)
    const workspaceFile = path.join(this.rootPath, 'pnpm-workspace.yaml');
        const isMonorepo = existsSync(workspaceFile);
    
    if (isMonorepo) {
      await this.analyzeMonorepo();
    } else {
      await this.analyzeSingleProject();
    }

    // Detect cross-language dependencies
        await this.detectCrossLanguageDependencies();
    
    return this.getGraphData();
  }

  /**
   * Analyze a monorepo workspace
   */
  private async analyzeMonorepo(): Promise<void> {
        const packagesDir = path.join(this.rootPath, 'packages');
    const appsDir = path.join(this.rootPath, 'apps');

    const dirsToScan: string[] = [];
    if (existsSync(packagesDir)) dirsToScan.push(packagesDir);
    if (existsSync(appsDir)) dirsToScan.push(appsDir);
    
    for (const dir of dirsToScan) {
            const subdirs = await fs.readdir(dir);
            for (const subdir of subdirs) {
        const fullPath = path.join(dir, subdir);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await this.analyzePackage(fullPath);
        }
      }
    }

    // Analyze root package.json
    const rootPackageJson = path.join(this.rootPath, 'package.json');
    if (existsSync(rootPackageJson)) {
      await this.analyzePackageFromJson(this.rootPath, rootPackageJson);
    }
      }

  /**
   * Analyze a single project
   */
  private async analyzeSingleProject(): Promise<void> {
    await this.analyzePackage(this.rootPath);
  }

  /**
   * Analyze a package directory
   */
  private async analyzePackage(pkgPath: string): Promise<void> {
    const packageJson = path.join(pkgPath, 'package.json');
    if (existsSync(packageJson)) {
      await this.analyzePackageFromJson(pkgPath, packageJson);
    }

    // Check for Python dependencies
    const requirements = path.join(pkgPath, 'requirements.txt');
    if (existsSync(requirements)) {
      await this.analyzePythonDependencies(pkgPath, requirements);
    }

    // Check for Go dependencies
    const goMod = path.join(pkgPath, 'go.mod');
    if (existsSync(goMod)) {
      await this.analyzeGoDependencies(pkgPath, goMod);
    }

    // Check for Rust dependencies
    const cargoToml = path.join(pkgPath, 'Cargo.toml');
    if (existsSync(cargoToml)) {
      await this.analyzeRustDependencies(pkgPath, cargoToml);
    }

    // Check for Java dependencies
    const pomXml = path.join(pkgPath, 'pom.xml');
    if (existsSync(pomXml)) {
      await this.analyzeMavenDependencies(pkgPath, pomXml);
    }
  }

  /**
   * Analyze Node.js/TypeScript package from package.json
   */
  private async analyzePackageFromJson(pkgPath: string, jsonPath: string): Promise<void> {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    const relativePath = path.relative(this.rootPath, pkgPath);
    const isApp = pkgPath.includes('/apps/') || relativePath === '.';
    const type: DependencyNode['type'] = isApp ? 'app' : 'package';

    const node: DependencyNode = {
      id: pkg.name || relativePath.replace(/\//g, '-'),
      label: pkg.name || relativePath,
      type,
      language: pkg.dependencies?.typescript ? 'typescript' : 'javascript',
      framework: this.detectFramework(pkg),
      path: relativePath,
      dependencies: [],
      dependents: [],
      metadata: {
        version: pkg.version,
        scripts: pkg.scripts ? Object.keys(pkg.scripts) : []
      }
    };

    // Extract dependencies
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies
    };

    node.dependencies = Object.keys(allDeps);

    // Determine node size based on dependency count
    node.size = Math.max(20, Math.min(60, 20 + node.dependencies.length * 2));

    this.nodes.set(node.id, node);

    // Create edges for workspace dependencies
    for (const dep of node.dependencies) {
      if (this.nodes.has(dep)) {
        this.edges.push({
          source: node.id,
          target: dep,
          type: pkg.dependencies?.[dep] ? 'runtime' : 'dev',
          strength: 1
        });
      }
    }
  }

  /**
   * Analyze Python requirements.txt
   */
  private async analyzePythonDependencies(pkgPath: string, reqPath: string): Promise<void> {
    const content = await fs.readFile(reqPath, 'utf-8');
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });

    const relativePath = path.relative(this.rootPath, pkgPath);
    const nodeName = relativePath.replace(/\//g, '-').replace(/requirements\.txt$/, 'py-package');

    const node: DependencyNode = {
      id: nodeName,
      label: path.basename(relativePath),
      type: 'package',
      language: 'python',
      path: relativePath,
      dependencies: [],
      dependents: [],
      size: 30
    };

    const deps: string[] = [];
    for (const line of lines) {
      // Parse requirement: package==version, package>=version, etc.
      const match = line.match(/^([a-zA-Z0-9_-]+)/);
      if (match) {
        deps.push(match[1]);
      }
    }

    node.dependencies = deps;
    this.nodes.set(nodeName, node);
  }

  /**
   * Analyze Go go.mod
   */
  private async analyzeGoDependencies(pkgPath: string, goModPath: string): Promise<void> {
    const content = await fs.readFile(goModPath, 'utf-8');
    const lines = content.split('\n');

    const relativePath = path.relative(this.rootPath, pkgPath);
    const nodeName = relativePath.replace(/\//g, '-').replace(/go\.mod$/, 'go-module');

    const node: DependencyNode = {
      id: nodeName,
      label: path.basename(relativePath),
      type: 'package',
      language: 'go',
      path: relativePath,
      dependencies: [],
      dependents: [],
      size: 30
    };

    const deps: string[] = [];
    let inRequire = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('require (')) {
        inRequire = true;
      } else if (trimmed === ')') {
        inRequire = false;
      } else if (inRequire || trimmed.startsWith('require ')) {
        const match = trimmed.match(/(?:require\s+)?([a-zA-Z0-9_.-/]+)/);
        if (match) {
          deps.push(match[1]);
        }
      }
    }

    node.dependencies = deps;
    this.nodes.set(nodeName, node);
  }

  /**
   * Analyze Rust Cargo.toml
   */
  private async analyzeRustDependencies(pkgPath: string, cargoPath: string): Promise<void> {
    const content = await fs.readFile(cargoPath, 'utf-8');
    const lines = content.split('\n');

    const relativePath = path.relative(this.rootPath, pkgPath);
    const nodeName = relativePath.replace(/\//g, '-').replace(/Cargo\.toml$/, 'rust-crate');

    const node: DependencyNode = {
      id: nodeName,
      label: path.basename(relativePath),
      type: 'package',
      language: 'rust',
      path: relativePath,
      dependencies: [],
      dependents: [],
      size: 30
    };

    const deps: string[] = [];
    let inDeps = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '[dependencies]') {
        inDeps = true;
      } else if (trimmed.startsWith('[')) {
        inDeps = false;
      } else if (inDeps && trimmed) {
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)/);
        if (match) {
          deps.push(match[1]);
        }
      }
    }

    node.dependencies = deps;
    this.nodes.set(nodeName, node);
  }

  /**
   * Analyze Maven pom.xml
   */
  private async analyzeMavenDependencies(pkgPath: string, pomPath: string): Promise<void> {
    const content = await fs.readFile(pomPath, 'utf-8');

    const relativePath = path.relative(this.rootPath, pkgPath);
    const nodeName = relativePath.replace(/\//g, '-').replace(/pom\.xml$/, 'maven-module');

    const node: DependencyNode = {
      id: nodeName,
      label: path.basename(relativePath),
      type: 'package',
      language: 'java',
      path: relativePath,
      dependencies: [],
      dependents: [],
      size: 30
    };

    const deps: string[] = [];
    const depMatches = content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g);

    for (const match of depMatches) {
      const depContent = match[1];
      const artifactId = depContent.match(/<artifactId>(.*?)<\/artifactId>/);
      const groupId = depContent.match(/<groupId>(.*?)<\/groupId>/);

      if (artifactId) {
        const fullDep = groupId ? `${groupId[1]}:${artifactId[1]}` : artifactId[1];
        deps.push(fullDep);
      }
    }

    node.dependencies = deps;
    this.nodes.set(nodeName, node);
  }

  /**
   * Detect cross-language dependencies
   */
  private async detectCrossLanguageDependencies(): Promise<CrossLanguageDependency[]> {
        const crossLangDeps: CrossLanguageDependency[] = [];

    // Group nodes by language
    const nodesByLang = new Map<string, DependencyNode[]>();
    for (const node of this.nodes.values()) {
      if (!nodesByLang.has(node.language)) {
        nodesByLang.set(node.language, []);
      }
      nodesByLang.get(node.language)!.push(node);
    }
    
    // Find cross-language references (skip root directory node)
    let nodeCount = 0;
    for (const node of this.nodes.values()) {
      nodeCount++;
      
      // Skip root directory node (empty path or same as root)
      if (!node.path || node.path === '.' || node.path === '') {
                continue;
      }

      const nodeDir = path.join(this.rootPath, node.path);
      if (existsSync(nodeDir)) {
                const langDeps = await this.scanForLanguageImports(nodeDir, node.language);
                for (const langDep of langDeps) {
          crossLangDeps.push({
            sourceLanguage: node.language,
            targetLanguage: langDep.targetLanguage,
            sourceFile: langDep.sourceFile,
            targetFile: langDep.targetFile,
            type: langDep.type
          });
        }
      }
    }

        return crossLangDeps;
  }

  /**
   * Scan directory for cross-language imports
   */
  private async scanForLanguageImports(dir: string, sourceLang: string): Promise<CrossLanguageDependency[]> {
    const results: CrossLanguageDependency[] = [];

    try {
      const files = await fs.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        if (file.isDirectory()) {
          const subResults = await this.scanForLanguageImports(
            path.join(dir, file.name),
            sourceLang
          );
          results.push(...subResults);
        } else {
          const ext = path.extname(file.name);
          const filePath = path.join(dir, file.name);

          // Check for specific cross-language patterns
          if (sourceLang === 'typescript' || sourceLang === 'javascript') {
            // Python imports in JS
            if (ext === '.ts' || ext === '.tsx' || ext === '.js') {
              const content = await fs.readFile(filePath, 'utf-8');
              if (content.includes('python') || content.includes('execSync')) {
                results.push({
                  sourceLanguage: sourceLang,
                  targetLanguage: 'python',
                  sourceFile: path.relative(this.rootPath, filePath),
                  targetFile: '<python>',
                  type: 'exec'
                });
              }
            }
          }
        }
      }
    } catch (error) {
      // Skip errors
    }

    return results;
  }

  /**
   * Detect framework from package.json
   */
  private detectFramework(pkg: any): string | undefined {
    const deps = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies
    });

    if (deps.includes('react')) return 'react';
    if (deps.includes('vue')) return 'vue';
    if (deps.includes('@angular/core')) return 'angular';
    if (deps.includes('svelte')) return 'svelte';
    if (deps.includes('express')) return 'express';
    if (deps.includes('fastify')) return 'fastify';
    if (deps.includes('@nestjs/core')) return 'nestjs';
    if (deps.includes('next')) return 'next';
    if (deps.includes('remix')) return 'remix';
    if (deps.includes('@tanstack/start')) return 'tanstack-start';

    return undefined;
  }

  /**
   * Get graph data for visualization
   */
  getGraphData(): GraphData {
    const languages = new Set<string>();
    const frameworks = new Set<string>();

    for (const node of this.nodes.values()) {
      languages.add(node.language);
      if (node.framework) frameworks.add(node.framework);
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      metadata: {
        totalNodes: this.nodes.size,
        totalEdges: this.edges.length,
        languages: Array.from(languages),
        frameworks: Array.from(frameworks),
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Generate HTML visualization with D3.js
   */
  async generateHTML(options: VisualizationOptions = {}): Promise<string> {
    const graphData = this.getGraphData();
    const port = options.port || 8080;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Graph Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
        #header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; }
        #header h1 { font-size: 24px; font-weight: 600; color: white; }
        #header .subtitle { font-size: 14px; opacity: 0.9; margin-top: 5px; }
        #controls { background: #1e293b; padding: 15px 20px; display: flex; gap: 15px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid #334155; }
        #controls button { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
        #controls button:hover { background: #2563eb; }
        #controls select { background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 8px 12px; border-radius: 6px; font-size: 14px; }
        #controls label { font-size: 14px; color: #94a3b8; }
        #stats { display: flex; gap: 20px; margin-left: auto; }
        #stats .stat { text-align: center; }
        #stats .stat-value { font-size: 20px; font-weight: 600; color: #60a5fa; }
        #stats .stat-label { font-size: 12px; color: #94a3b8; }
        #graph { width: 100%; height: calc(100vh - 140px); }
        #tooltip { position: absolute; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-width: 300px; z-index: 1000; }
        #tooltip h3 { font-size: 14px; color: #f1f5f9; margin-bottom: 8px; }
        #tooltip .tooltip-row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
        #tooltip .tooltip-label { color: #94a3b8; }
        #tooltip .tooltip-value { color: #e2e8f0; font-weight: 500; }
        #legend { position: fixed; bottom: 20px; right: 20px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 15px; }
        #legend h4 { font-size: 12px; color: #94a3b8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        #legend .legend-item { display: flex; align-items: center; gap: 8px; margin: 5px 0; font-size: 12px; }
        #legend .legend-color { width: 12px; height: 12px; border-radius: 3px; }
        .node { cursor: pointer; transition: filter 0.2s; }
        .node:hover { filter: brightness(1.2); }
        .link { stroke-opacity: 0.6; }
        .node-label { font-size: 10px; fill: #e2e8f0; pointer-events: none; text-anchor: middle; }
        #search-container { position: relative; }
        #search-input { background: #334155; color: #e2e8f0; border: 1px solid #475569; padding: 8px 12px; border-radius: 6px; font-size: 14px; width: 200px; }
        #search-results { position: absolute; top: 100%; left: 0; right: 0; background: #1e293b; border: 1px solid #334155; border-radius: 6px; margin-top: 5px; max-height: 200px; overflow-y: auto; display: none; }
        #search-results.show { display: block; }
        .search-result { padding: 10px; cursor: pointer; border-bottom: 1px solid #334155; }
        .search-result:hover { background: #334155; }
        .search-result:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div id="header">
        <h1>📊 Dependency Graph Visualization</h1>
        <div class="subtitle">Cross-language dependency analysis with real-time updates</div>
    </div>

    <div id="controls">
        <div id="search-container">
            <input type="text" id="search-input" placeholder="Search nodes...">
            <div id="search-results"></div>
        </div>

        <label>Group by:</label>
        <select id="groupBy">
            <option value="type">Type</option>
            <option value="language">Language</option>
            <option value="framework">Framework</option>
        </select>

        <label>Layout:</label>
        <select id="layout">
            <option value="force">Force Directed</option>
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
        </select>

        <button id="resetZoom">Reset Zoom</button>
        <button id="exportJSON">Export JSON</button>

        <div id="stats">
            <div class="stat">
                <div class="stat-value" id="nodeCount">${graphData.metadata.totalNodes}</div>
                <div class="stat-label">Nodes</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="edgeCount">${graphData.metadata.totalEdges}</div>
                <div class="stat-label">Edges</div>
            </div>
            <div class="stat">
                <div class="stat-value" id="langCount">${graphData.metadata.languages.length}</div>
                <div class="stat-label">Languages</div>
            </div>
        </div>
    </div>

    <div id="graph"></div>
    <div id="tooltip"></div>

    <div id="legend">
        <h4>Node Types</h4>
        <div class="legend-item"><div class="legend-color" style="background: #4CAF50;"></div><span>App</span></div>
        <div class="legend-item"><div class="legend-color" style="background: #2196F3;"></div><span>Package</span></div>
        <div class="legend-item"><div class="legend-color" style="background: #FF9800;"></div><span>Library</span></div>
        <div class="legend-item"><div class="legend-color" style="background: #9C27B0;"></div><span>Tool</span></div>
        <div class="legend-item"><div class="legend-color" style="background: #F44336;"></div><span>Service</span></div>
    </div>

    <script>
        const graphData = ${JSON.stringify(graphData, null, 2)};

        // Setup SVG
        const svg = d3.select('#graph')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%');

        const g = svg.append('g');

        // Zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom as any);

        document.getElementById('resetZoom').addEventListener('click', () => {
            svg.transition().duration(500).call(zoom.transform as any, d3.zoomIdentity);
        });

        // Color scales
        const typeColors = {
            app: '#4CAF50',
            package: '#2196F3',
            lib: '#FF9800',
            tool: '#9C27B0',
            service: '#F44336',
            unknown: '#9E9E9E'
        };

        const langColors = {
            javascript: '#F7DF1E',
            typescript: '#3178C6',
            python: '#3776AB',
            go: '#00ADD8',
            rust: '#DEA584',
            java: '#007396',
            ruby: '#CC342D',
            php: '#777BB4',
            csharp: '#9B4F96',
            unknown: '#9E9E9E'
        };

        // Create simulation
        const simulation = d3.forceSimulation(graphData.nodes as any)
            .force('link', d3.forceLink(graphData.edges)
                .id((d: any) => d.id)
                .distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(
                window.innerWidth / 2,
                window.innerHeight / 2
            ))
            .force('collision', d3.forceCollide().radius(30));

        // Create links
        const link = g.append('g')
            .selectAll('line')
            .data(graphData.edges)
            .join('line')
            .attr('class', 'link')
            .attr('stroke', (d: any) => {
                if (d.type === 'runtime') return '#60a5fa';
                if (d.type === 'dev') return '#94a3b8';
                return '#64748b';
            })
            .attr('stroke-width', 2);

        // Create nodes
        const node = g.append('g')
            .selectAll('g')
            .data(graphData.nodes)
            .join('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended) as any);

        // Node circles
        node.append('circle')
            .attr('r', (d: any) => d.size || 20)
            .attr('fill', (d: any) => typeColors[d.type] || typeColors.unknown)
            .attr('stroke', (d: any) => langColors[d.language] || langColors.unknown)
            .attr('stroke-width', 3);

        // Node labels
        node.append('text')
            .attr('class', 'node-label')
            .attr('dy', (d: any) => (d.size || 20) + 15)
            .text((d: any) => d.label);

        // Tooltip
        const tooltip = d3.select('#tooltip');

        node.on('mouseover', function(event, d: any) {
            tooltip.style('opacity', 1);
            tooltip.html(\`
                <h3>\${d.label}</h3>
                <div class="tooltip-row">
                    <span class="tooltip-label">Type:</span>
                    <span class="tooltip-value">\${d.type}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Language:</span>
                    <span class="tooltip-value">\${d.language}</span>
                </div>
                \${d.framework ? \`<div class="tooltip-row">
                    <span class="tooltip-label">Framework:</span>
                    <span class="tooltip-value">\${d.framework}</span>
                </div>\` : ''}
                <div class="tooltip-row">
                    <span class="tooltip-label">Dependencies:</span>
                    <span class="tooltip-value">\${d.dependencies.length}</span>
                </div>
                <div class="tooltip-row">
                    <span class="tooltip-label">Path:</span>
                    <span class="tooltip-value">\${d.path}</span>
                </div>
            \`);
        })
        .on('mousemove', function(event) {
            tooltip
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY + 15) + 'px');
        })
        .on('mouseout', function() {
            tooltip.style('opacity', 0);
        });

        // Update positions on tick
        simulation.on('tick', () => {
            link
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);

            node
                .attr('transform', (d: any) => \`translate(\${d.x},\${d.y})\`);
        });

        // Drag functions
        function dragstarted(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: any, d: any) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event: any, d: any) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        // Group by
        document.getElementById('groupBy').addEventListener('change', function(e: any) {
            const groupBy = e.target.value;
            updateGrouping(groupBy);
        });

        function updateGrouping(groupBy: string) {
            node.select('circle')
                .transition()
                .duration(500)
                .attr('fill', (d: any) => {
                    if (groupBy === 'language') return langColors[d.language] || langColors.unknown;
                    if (groupBy === 'framework') return d.framework ? '#8b5cf6' : typeColors.unknown;
                    return typeColors[d.type] || typeColors.unknown;
                });
        }

        // Layout
        document.getElementById('layout').addEventListener('change', function(e: any) {
            const layout = e.target.value;
            updateLayout(layout);
        });

        function updateLayout(layout: string) {
            if (layout === 'hierarchical') {
                simulation
                    .force('link', d3.forceLink(graphData.edges)
                        .id((d: any) => d.id)
                        .distance(150))
                    .force('charge', d3.forceManyBody().strength(-200))
                    .force('x', d3.forceX().strength(0.1))
                    .force('y', (d: any) => d.depth * 100);
            } else if (layout === 'circular') {
                const angleStep = (2 * Math.PI) / graphData.nodes.length;
                graphData.nodes.forEach((node: any, i) => {
                    node.targetX = Math.cos(i * angleStep) * 300;
                    node.targetY = Math.sin(i * angleStep) * 300;
                });
                simulation
                    .force('link', d3.forceLink(graphData.edges).id((d: any) => d.id).distance(50))
                    .force('charge', d3.forceManyBody().strength(-100))
                    .force('radial', d3.forceRadial(300, window.innerWidth / 2, window.innerHeight / 2));
            } else {
                simulation
                    .force('link', d3.forceLink(graphData.edges)
                        .id((d: any) => d.id)
                        .distance(100))
                    .force('charge', d3.forceManyBody().strength(-300))
                    .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
                    .force('radial', null as any);
            }
            simulation.alpha(1).restart();
        }

        // Export JSON
        document.getElementById('exportJSON').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dependency-graph.json';
            a.click();
            URL.revokeObjectURL(url);
        });

        // Search
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', function(e: any) {
            const query = e.target.value.toLowerCase();
            if (query.length < 2) {
                searchResults.classList.remove('show');
                return;
            }

            const matches = graphData.nodes.filter((n: any) =>
                n.label.toLowerCase().includes(query) ||
                n.path.toLowerCase().includes(query)
            );

            if (matches.length > 0) {
                searchResults.innerHTML = matches.map((n: any) => \`
                    <div class="search-result" data-id="\${n.id}">
                        <strong>\${n.label}</strong><br>
                        <small>\${n.path}</small>
                    </div>
                \`).join('');
                searchResults.classList.add('show');

                // Add click handlers
                searchResults.querySelectorAll('.search-result').forEach((result, i) => {
                    result.addEventListener('click', () => {
                        const node = matches[i];
                        // Focus on node
                        const x = (node as any).x || 0;
                        const y = (node as any).y || 0;
                        const transform = d3.zoomIdentity
                            .translate(window.innerWidth / 2 - x, window.innerHeight / 2 - y)
                            .scale(2);
                        svg.transition().duration(500).call(zoom.transform as any, transform);
                        searchResults.classList.remove('show');
                        searchInput.value = '';
                    });
                });
            } else {
                searchResults.innerHTML = '<div class="search-result">No results found</div>';
                searchResults.classList.add('show');
            }
        });

        // Handle resize
        window.addEventListener('resize', () => {
            simulation
                .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
                .alpha(0.3)
                .restart();
        });
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate DOT format for Graphviz
   */
  async generateDOT(): Promise<string> {
    const data = this.getGraphData();
    const lines: string[] = ['digraph dependencies {', '  rankdir=LR;', '  node [shape=box];', ''];

    // Add nodes with colors
    for (const node of data.nodes) {
      const color = NODE_COLORS[node.type] || NODE_COLORS.unknown;
      lines.push(`  "${node.id}" [label="${node.label}\\n${node.language}" fillcolor="${color}" style="filled"];`);
    }

    lines.push('');

    // Add edges
    for (const edge of data.edges) {
      const style = edge.type === 'runtime' ? 'bold' : 'dashed';
      lines.push(`  "${edge.source}" -> "${edge.target}" [style=${style}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generate SVG format
   */
  async generateSVG(): Promise<string> {
    const data = this.getGraphData();
    const width = 1200;
    const height = 800;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>
        .node { cursor: pointer; }
        .node:hover { opacity: 0.8; }
        .link { stroke-opacity: 0.6; }
        text { font-family: Arial, sans-serif; font-size: 12px; fill: white; }
    </style>
    <rect width="100%" height="100%" fill="#0f172a"/>
    <!-- Nodes and edges would be rendered here -->
    <!-- For full SVG, use the HTML export -->
</svg>`;

    return svg;
  }

  /**
   * Watch for changes and emit updates
   */
  async watch(options: VisualizationOptions = {}): Promise<void> {
    if (this.watchers.length > 0) {
      return; // Already watching
    }

    const watchDirs = [
      path.join(this.rootPath, 'packages'),
      path.join(this.rootPath, 'apps'),
      this.rootPath
    ];

    for (const dir of watchDirs) {
      if (existsSync(dir)) {
        const watcher = fs.watch(dir, { recursive: true }, async (eventType, filename) => {
          if (filename && (filename.includes('package.json') ||
                           filename.includes('requirements.txt') ||
                           filename.includes('go.mod') ||
                           filename.includes('Cargo.toml') ||
                           filename.includes('pom.xml'))) {
            await this.analyze();
            this.emit('update', this.getGraphData());

            if (options.format === 'html') {
              const html = await this.generateHTML(options);
              if (options.output) {
                await fs.writeFile(options.output, html);
              }
            }
          }
        });
        this.watchers.push(watcher);
      }
    }

    this.watchPaths = new Set(watchDirs);
  }

  /**
   * Stop watching
   */
  async unwatch(): Promise<void> {
    for (const watcher of this.watchers) {
      await watcher.close();
    }
    this.watchers = [];
    this.watchPaths.clear();
  }

  /**
   * Export graph data
   */
  async export(format: 'json' | 'html' | 'dot' | 'svg', outputPath: string): Promise<void> {
    await fs.ensureDir(path.dirname(outputPath));

    let content: string;
    switch (format) {
      case 'json':
        content = JSON.stringify(this.getGraphData(), null, 2);
        break;
      case 'html':
        content = await this.generateHTML();
        break;
      case 'dot':
        content = await this.generateDOT();
        break;
      case 'svg':
        content = await this.generateSVG();
        break;
      default:
        throw new Error(`Unknown format: ${format}`);
    }

    await fs.writeFile(outputPath, content);
  }
}

/**
 * Analyze dependencies from a directory
 */
export async function analyzeDependencies(rootPath: string): Promise<GraphData> {
  const graph = new EnhancedDependencyGraph(rootPath);
  return await graph.analyze();
}

/**
 * Generate visualization from path
 */
export async function generateVisualization(
  rootPath: string,
  options: VisualizationOptions = {}
): Promise<{ data: GraphData; output?: string }> {
  const graph = new EnhancedDependencyGraph(rootPath);
  const data = await graph.analyze();

  let output: string | undefined;

  if (options.format === 'html' || !options.format) {
    const html = await graph.generateHTML(options);
    if (options.output) {
      await fs.writeJson(options.output, { data, html });
      output = options.output;
    } else {
      const defaultOutput = path.join(rootPath, 'dependency-graph.html');
      await fs.writeFile(defaultOutput, html);
      output = defaultOutput;
    }
  } else if (options.format === 'json') {
    if (options.output) {
      await fs.writeJson(options.output, data);
      output = options.output;
    }
  } else if (options.format === 'dot') {
    const dot = await graph.generateDOT();
    if (options.output) {
      await fs.writeFile(options.output, dot);
      output = options.output;
    }
  }

  if (options.watch) {
    await graph.watch(options);
  }

  return { data, output };
}
