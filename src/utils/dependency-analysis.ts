/**
 * Cross-Language Dependency Analysis
 *
 * Generates dependency analysis utilities for polyglot projects:
 * - Dependency graph visualization
 * - Impact assessment for changes
 * - Circular dependency detection
 * - Multi-language dependency parsing
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type DepAnalysisLanguage = 'typescript' | 'python' | 'go';

export interface DependencyAnalysisConfig {
  projectName: string;
  language: DepAnalysisLanguage;
  outputDir: string;
  scanPaths: string[];
  excludePatterns: string[];
  generateVisualization: boolean;
}

export interface DependencyNode {
  id: string;
  type: 'service' | 'package' | 'module' | 'file';
  path: string;
  language: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'requires' | 'calls' | 'extends';
  strength: 'strong' | 'moderate' | 'weak';
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  metrics: DependencyMetrics;
}

export interface DependencyMetrics {
  totalDependencies: number;
  circularDependencies: number;
  depth: number;
  breadth: number;
  coupling: number;
  cohesion: number;
}

// TypeScript Dependency Analysis
export function generateTypeScriptDependencyAnalysis(config: DependencyAnalysisConfig): string {
  return `// Auto-generated Dependency Analysis for ${config.projectName}
// Generated at: ${new Date().toISOString()}

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface DependencyNode {
  id: string;
  type: 'service' | 'package' | 'module' | 'file';
  path: string;
  language: string;
  dependencies: string[];
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string; type: string }>;
  circularDeps: Array<Array<string>>;
}

class DependencyAnalyzer {
  private projectName: string;
  private scanPaths: string[];
  private excludePatterns: RegExp[];

  constructor(projectName: string, scanPaths: string[], excludePatterns: string[]) {
    this.projectName = projectName;
    this.scanPaths = scanPaths;
    this.excludePatterns = excludePatterns.map(p => new RegExp(p));
  }

  analyze(): DependencyGraph {
    console.log(\`🔍 Analyzing dependencies for \${this.projectName}...\\n\`);

    const nodes = new Map<string, DependencyNode>();
    const edges: Array<{ from: string; to: string; type: string }> = [];

    // Scan TypeScript files
    for (const scanPath of this.scanPaths) {
      this.scanDirectory(scanPath, nodes, edges);
    }

    // Detect circular dependencies
    const circularDeps = this.detectCircularDependencies(nodes, edges);

    console.log(\`  Nodes: \${nodes.size}\`);
    console.log(\`  Edges: \${edges.length}\`);
    console.log(\`  Circular Dependencies: \${circularDeps.length}\`);

    return { nodes, edges, circularDeps };
  }

  private scanDirectory(dir: string, nodes: Map<string, DependencyNode>, edges: Array<{ from: string; to: string; type: string }>): void {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (this.excludePatterns.some(pattern => pattern.test(fullPath))) {
          continue;
        }
        if (file === 'node_modules' || file === '.git' || file.startsWith('.')) {
          continue;
        }
        this.scanDirectory(fullPath, nodes, edges);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        this.analyzeFile(fullPath, nodes, edges);
      }
    }
  }

  private analyzeFile(filePath: string, nodes: Map<string, DependencyNode>, edges: Array<{ from: string; to: string; type: string }>): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);

    // Create node for this file
    const nodeId = relativePath;
    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        type: 'file',
        path: relativePath,
        language: 'typescript',
        dependencies: [],
      });
    }

    // Extract import statements
    const importRegex = /import\\s+(?:(?:\\{[^}]*\\}|\\*\\s+as\\s+\\w+|\\w+)\\s+from\\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Resolve local imports
      if (!importPath.startsWith('@') && !importPath.startsWith('.')) {
        continue;
      }

      const resolvedPath = this.resolveImportPath(importPath, filePath);
      if (resolvedPath) {
        const depNodeId = path.relative(process.cwd(), resolvedPath);

        nodes.get(nodeId)!.dependencies.push(depNodeId);

        edges.push({
          from: nodeId,
          to: depNodeId,
          type: 'imports',
        });
      }
    }
  }

  private resolveImportPath(importPath: string, fromFile: string): string | null {
    try {
      const fromDir = path.dirname(fromFile);
      const resolved = require.resolve(importPath, { paths: [fromDir] });
      return resolved;
    } catch {
      return null;
    }
  }

  detectCircularDependencies(nodes: Map<string, DependencyNode>, edges: Array<{ from: string; to: string; type: string }>): string[][] {
    const adjList = new Map<string, Set<string>>();
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    // Build adjacency list
    for (const node of nodes.keys()) {
      adjList.set(node, new Set());
    }

    for (const edge of edges) {
      if (adjList.has(edge.from)) {
        adjList.get(edge.from)!.add(edge.to);
      }
    }

    // DFS to detect cycles
    const detectCycle = (node: string, path: string[]): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adjList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (detectCycle(neighbor, [...path])) {
            return true;
          }
        } else if (recStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = [...path.slice(cycleStart), neighbor];
          cycles.push(cycle);
          return true;
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of nodes.keys()) {
      if (!visited.has(node)) {
        detectCycle(node, []);
      }
    }

    return cycles;
  }

  generateImpactAnalysis(changedFile: string): {
    directDependents: string[];
    allDependents: string[];
    impactedServices: string[];
  } {
    const graph = this.analyze();
    const directDeps: string[] = [];
    const allDeps: string[] = [];

    // Find direct dependents
    for (const edge of graph.edges) {
      if (edge.to === changedFile || edge.to.includes(changedFile)) {
        directDeps.push(edge.from);
      }
    }

    // Find all transitive dependents
    const visited = new Set<string>();
    const findAllDependents = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);

      for (const edge of graph.edges) {
        if (edge.to === node || edge.to.includes(node)) {
          findAllDependents(edge.from);
        }
      }
    };

    for (const dep of directDeps) {
      findAllDependents(dep);
    }

    allDeps.push(...Array.from(visited));

    return {
      directDependents: directDeps,
      allDependents,
      impactedServices: directDeps.filter(dep => dep.includes('/')),
    };
  }

  exportDotFormat(graph: DependencyGraph): string {
    let dot = 'digraph Dependencies {\\n';
    dot += '  rankdir=TB;\\n';
    dot += '  node [shape=box];\\n\\n';

    // Add nodes
    for (const [id, node] of graph.nodes) {
      const color = node.language === 'typescript' ? 'lightblue' :
                   node.language === 'python' ? 'lightgreen' : 'lightyellow';
      dot += \`  "\${id}" [fillcolor=\${color}, style=filled, label="\${node.path}"];\n\`;
    }

    dot += '\\n';

    // Add edges
    for (const edge of graph.edges) {
      const style = edge.type === 'imports' ? 'solid' : 'dashed';
      dot += \`  "\${edge.from}" -> "\${edge.to}" [style=\${style}];\n\`;
    }

    dot += '}\\n';
    return dot;
  }

  exportMermaidFormat(graph: DependencyGraph): string {
    let mermaid = 'graph TD\\n';

    // Add nodes
    for (const [id, node] of graph.nodes) {
      const shortId = id.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      mermaid += \`  \${shortId}["\${node.path}"]\\n\`;
    }

    mermaid += '\\n';

    // Add edges
    for (const edge of graph.edges) {
      const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
      mermaid += \`  \${fromId} --> \${toId}\\n\`;
    }

    return mermaid;
  }

  generateMetrics(graph: DependencyGraph) {
    const metrics = {
      totalDependencies: graph.edges.length,
      circularDependencies: graph.circularDeps.length,
      depth: this.calculateDepth(graph),
      breadth: this.calculateBreadth(graph),
      coupling: this.calculateCoupling(graph),
      cohesion: this.calculateCohesion(graph),
    };

    return metrics;
  }

  private calculateDepth(graph: DependencyGraph): number {
    const depths = new Map<string, number>();
    const visited = new Set<string>();

    const dfs = (node: string): number => {
      if (visited.has(node)) return 0;
      visited.add(node);

      let maxDepth = 0;
      for (const edge of graph.edges) {
        if (edge.from === node) {
          maxDepth = Math.max(maxDepth, dfs(edge.to));
        }
      }

      depths.set(node, maxDepth + 1);
      return maxDepth + 1;
    };

    for (const node of graph.nodes.keys()) {
      dfs(node);
    }

    return Math.max(...Array.from(depths.values()));
  }

  private calculateBreadth(graph: DependencyGraph): number {
    const inDegrees = new Map<string, number>();

    for (const node of graph.nodes.keys()) {
      inDegrees.set(node, 0);
    }

    for (const edge of graph.edges) {
      inDegrees.set(edge.to, (inDegrees.get(edge.to) || 0) + 1);
    }

    return Math.max(...Array.from(inDegrees.values()));
  }

  private calculateCoupling(graph: DependencyGraph): number {
    const nodeCount = graph.nodes.size;
    const edgeCount = graph.edges.length;
    const maxEdges = nodeCount * (nodeCount - 1) / 2;
    return maxEdges > 0 ? edgeCount / maxEdges : 0;
  }

  private calculateCohesion(graph: DependencyGraph): number {
    // Simplified cohesion calculation
    const componentCount = graph.nodes.size;
    const internalEdges = graph.edges.filter(e =>
      e.from.split('/')[0] === e.to.split('/')[0]
    ).length;
    const totalEdges = graph.edges.length;
    return totalEdges > 0 ? internalEdges / totalEdges : 0;
  }
}

// Export analyzer instance
const analyzer = new DependencyAnalyzer(
  '${config.projectName}',
  ${JSON.stringify(config.scanPaths)},
  ${JSON.stringify(config.excludePatterns)}
);

export default analyzer;
`;
}

// Python Dependency Analysis
export function generatePythonDependencyAnalysis(config: DependencyAnalysisConfig): string {
  return `# Auto-generated Dependency Analysis for ${config.projectName}
# Generated at: ${new Date().toISOString()}

import os
import re
import ast
from typing import Dict, List, Set, Tuple
from collections import defaultdict
from pathlib import Path

class DependencyAnalyzer:
    def __init__(self, project_name: str, scan_paths: List[str], exclude_patterns: List[str]):
        self.project_name = project_name
        self.scan_paths = scan_paths
        self.exclude_patterns = [re.compile(p) for p in exclude_patterns]
        self.nodes = {}
        self.edges = []

    def analyze(self) -> Dict:
        print(f"🔍 Analyzing dependencies for {self.project_name}\\n")

        nodes = {}
        edges = []

        # Scan Python files
        for scan_path in self.scan_paths:
            self.scan_directory(scan_path, nodes, edges)

        # Detect circular dependencies
        circular_deps = self.detect_circular_dependencies(nodes, edges)

        print(f"  Nodes: {len(nodes)}")
        print(f"  Edges: {len(edges)}")
        print(f"  Circular Dependencies: {len(circular_deps)}")

        return {
            'nodes': nodes,
            'edges': edges,
            'circular_deps': circular_deps
        }

    def scan_directory(self, dir_path: str, nodes: Dict, edges: List[Dict]):
        if not os.path.exists(dir_path):
            return

        for root, dirs, files in os.walk(dir_path):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if not any(p.search(d) for p in self.exclude_patterns)]
            if '__pycache__' in dirs:
                dirs.remove('__pycache__')

            for file in files:
                if file.endswith('.py'):
                    file_path = os.path.join(root, file)
                    self.analyze_file(file_path, nodes, edges)

    def analyze_file(self, file_path: str, nodes: Dict, edges: List[Dict]):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            return

        relative_path = os.path.relpath(file_path)
        node_id = relative_path

        if node_id not in nodes:
            nodes[node_id] = {
                'id': node_id,
                'type': 'file',
                'path': relative_path,
                'language': 'python',
                'dependencies': []
            }

        # Extract imports
        tree = ast.parse(content)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    self.add_dependency(node_id, alias.name, nodes, edges)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    self.add_dependency(node_id, node.module, nodes, edges)

    def add_dependency(self, from_node: str, import_path: str, nodes: Dict, edges: List[Dict]):
        # Only track local imports
        if not import_path.startswith('.') and '.' not in import_path:
            return

        nodes[from_node]['dependencies'].append(import_path)
        edges.append({
            'from': from_node,
            'to': import_path,
            'type': 'imports'
        })

    def detect_circular_dependencies(self, nodes: Dict, edges: List[Dict]) -> List[List[str]]:
        adj_list = defaultdict(set)
        visited = set()
        rec_stack = set()
        cycles = []

        # Build adjacency list
        for edge in edges:
            adj_list[edge['from']].add(edge['to'])

        # DFS to detect cycles
        def detect_cycle(node: str, path: List[str]) -> bool:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in adj_list[node]:
                if neighbor not in visited:
                    if detect_cycle(neighbor, path[:]):
                        return True
                elif neighbor in rec_stack:
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    cycles.append(cycle)
                    return True

            rec_stack.remove(node)
            path.pop()
            return False

        for node in nodes:
            if node not in visited:
                detect_cycle(node, [])

        return cycles

    def generate_impact_analysis(self, changed_file: str) -> Dict:
        graph = self.analyze()
        direct_deps = []
        all_deps = set()

        # Find direct dependents
        for edge in graph['edges']:
            if changed_file in edge['to']:
                direct_deps.append(edge['from'])

        # Find all transitive dependents
        visited = set()

        def find_all_dependents(node: str):
            if node in visited:
                return
            visited.add(node)

            for edge in graph['edges']:
                if node in edge['to']:
                    find_all_dependents(edge['from'])

        for dep in direct_deps:
            find_all_dependents(dep)

        all_deps.update(visited)

        return {
            'directDependents': direct_deps,
            'allDependents': list(all_deps),
            'impactedServices': [d for d in direct_deps if '/' in d]
        }

    def export_dot_format(self, graph: Dict) -> str:
        dot = 'digraph Dependencies {\\n'
        dot += '  rankdir=TB;\\n'
        dot += '  node [shape=box];\\n\\n'

        # Add nodes
        for node_id, node in graph['nodes'].items():
            color = 'lightblue' if node['language'] == 'python' else 'lightgray'
            dot += f'  "{node_id}" [fillcolor={color}, style=filled, label="{node["path"]}"];\\n'

        dot += '\\n'

        # Add edges
        for edge in graph['edges']:
            style = 'solid' if edge['type'] == 'imports' else 'dashed'
            dot += f'  "{edge["from"]}" -> "{edge["to"]}" [style={style}];\\n'

        dot += '}\\n'
        return dot

    def export_mermaid_format(self, graph: Dict) -> str:
        mermaid = 'graph TD\\n'

        # Add nodes
        for node_id, node in graph['nodes'].items():
            short_id = re.sub(r'[^a-zA-Z0-9]', '_', node_id)[:20]
            mermaid += f'  {short_id}["{node["path}"]]\\n'

        mermaid += '\\n'

        # Add edges
        for edge in graph['edges']:
            from_id = re.sub(r'[^a-zA-Z0-9]', '_', edge['from'])[:20]
            to_id = re.sub(r'[^a-zA-Z0-9]', '_', edge['to'])[:20]
            mermaid += f'  {from_id} --> {to_id}\\n'

        return mermaid

    def generate_metrics(self, graph: Dict) -> Dict:
        return {
            'totalDependencies': len(graph['edges']),
            'circularDependencies': len(graph['circular_deps']),
            'depth': self._calculate_depth(graph),
            'breadth': self._calculate_breadth(graph),
            'coupling': self._calculate_coupling(graph),
            'cohesion': self._alculate_cohesion(graph)
        }

    def _calculate_depth(self, graph: Dict) -> int:
        depths = {}
        visited = set()

        def dfs(node: str) -> int:
            if node in visited:
                return 0
            visited.add(node)

            max_depth = 0
            for edge in graph['edges']:
                if edge['from'] == node:
                    max_depth = max(max_depth, dfs(edge['to']))

            depths[node] = max_depth + 1
            return max_depth + 1

        for node in graph['nodes']:
            dfs(node)

        return max(depths.values()) if depths else 0

    def _calculate_breadth(self, graph: Dict) -> int:
        in_degrees = defaultdict(int)

        for node in graph['nodes']:
            in_degrees[node] = 0

        for edge in graph['edges']:
            in_degrees[edge['to']] += 1

        return max(in_degrees.values()) if in_degrees else 0

    def _calculate_coupling(self, graph: Dict) -> float:
        node_count = len(graph['nodes'])
        edge_count = len(graph['edges'])
        max_edges = node_count * (node_count - 1) / 2 if node_count > 1 else 1
        return edge_count / max_edges if max_edges > 0 else 0

    def _calculate_cohesion(self, graph: Dict) -> float:
        internal_edges = sum(1 for e in graph['edges']
                           if e['from'].split('/')[0] == e['to'].split('/')[0])
        total_edges = len(graph['edges'])
        return internal_edges / total_edges if total_edges > 0 else 0


# Create analyzer instance
analyzer = DependencyAnalyzer(
    '${config.projectName}',
    ${JSON.stringify(config.scanPaths)},
    ${JSON.stringify(config.excludePatterns)}
)
`;
}

// Display configuration
export function displayConfig(config: DependencyAnalysisConfig): void {
  console.log(chalk.cyan('\n✨ Dependency Analysis Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Scan Paths:'), chalk.white(config.scanPaths.length));
  console.log(chalk.yellow('Exclude Patterns:'), chalk.white(config.excludePatterns.length));
  console.log(chalk.yellow('Generate Visualization:'), chalk.white(config.generateVisualization ? 'Yes' : 'No'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n📂 Scan Paths:\n'));

  config.scanPaths.slice(0, 5).forEach((scanPath, index) => {
    console.log('  ' + chalk.green((index + 1).toString() + '.') + ' ' + chalk.white(scanPath));
  });

  if (config.scanPaths.length > 5) {
    console.log('  ' + chalk.gray('... and ' + (config.scanPaths.length - 5) + ' more'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: DependencyAnalysisConfig): string {
  let content = '# Dependency Analysis for ' + config.projectName + '\n\n';
  content += 'Cross-language dependency analysis and visualization for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Scan Paths**: ' + config.scanPaths.length + '\n';
  content += '- **Exclude Patterns**: ' + config.excludePatterns.length + '\n\n';

  content += '## 🚀 Installation\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += 'npm install\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += 'pip install -r requirements.txt\n';
    content += '```\n\n';
  }

  content += '## 💻 Usage\n\n';

  if (config.language === 'typescript') {
    content += '```typescript\n';
    content += 'import analyzer from \'./dependency-analyzer\';\n\n';
    content += '// Analyze dependencies\n';
    content += 'const graph = analyzer.analyze();\n\n';
    content += '// Generate impact analysis\n';
    content += 'const impact = analyzer.generateImpactAnalysis(\'src/service.ts\');\n';
    content += 'console.log(impact);\n\n';
    content += '// Export visualizations\n';
    content += 'const dot = analyzer.exportDotFormat(graph);\n';
    content += 'const mermaid = analyzer.exportMermaidFormat(graph);\n\n';
    content += '// Get metrics\n';
    content += 'const metrics = analyzer.generateMetrics(graph);\n';
    content += 'console.log(metrics);\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```python\n';
    content += 'from dependency_analyzer import analyzer\n\n';
    content += '# Analyze dependencies\n';
    content += 'graph = analyzer.analyze()\n\n';
    content += '# Generate impact analysis\n';
    content += 'impact = analyzer.generate_impact_analysis(\'src/service.py\')\n';
    content += 'print(impact)\n\n';
    content += '# Export visualizations\n';
    content += 'dot = analyzer.export_dot_format(graph)\n';
    content += 'mermaid = analyzer.export_mermaid_format(graph)\n\n';
    content += '# Get metrics\n';
    content += 'metrics = analyzer.generate_metrics(graph)\n';
    content += 'print(metrics)\n';
    content += '```\n\n';
  }

  content += '## 📚 Features\n\n';
  content += '- **Dependency Graph**: Automatic construction of dependency graphs\n';
  content += '- **Circular Dependency Detection**: Find circular dependencies\n';
  content += '- **Impact Analysis**: Assess impact of changes\n';
  content += '- **Visualization**: Export to DOT and Mermaid formats\n';
  content += '- **Metrics**: Depth, breadth, coupling, cohesion\n\n';

  content += '## 🎯 Metrics Explained\n\n';
  content += '- **Total Dependencies**: Number of dependency relationships\n';
  content += '- **Circular Dependencies**: Number of circular dependency cycles\n';
  content += '- **Depth**: Maximum dependency chain length\n';
  content += '- **Breadth**: Maximum number of dependents\n';
  content += '- **Coupling**: Ratio of actual to possible dependencies (0-1)\n';
  content += '- **Cohesion**: Ratio of internal to total dependencies (0-1)\n\n';

  content += '## 📊 Visualization\n\n';
  content += 'DOT format can be visualized using:\n';
  content += '- Graphviz (http://www.graphviz.org)\n';
  content += '- Online viewers (https://dreampuf.github.io/GraphvizOnline)\n\n';
  content += 'Mermaid format can be visualized using:\n';
  content += '- Mermaid Live Editor (https://mermaid.live)\n';
  content += '- GitHub/GitLab markdown rendering\n\n';

  return content;
}

// Write files
export async function writeDependencyAnalysisFiles(
  config: DependencyAnalysisConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'dependency-analyzer.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptDependencyAnalysis(config);
  } else if (config.language === 'python') {
    content = generatePythonDependencyAnalysis(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config);
  const buildMDPath = path.join(output, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: config.projectName.toLowerCase() + '-dependency-analysis',
      version: '1.0.0',
      description: 'Dependency analysis for ' + config.projectName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    const packageJsonPath = path.join(output, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✅ Generated: package.json'));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [
      'ast>=3.9.0',
    ];

    const requirementsPath = path.join(output, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  // Generate config JSON
  const depConfig = {
    projectName: config.projectName,
    language: config.language,
    scanPaths: config.scanPaths,
    excludePatterns: config.excludePatterns,
    generateVisualization: config.generateVisualization,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const configPath = path.join(output, 'dep-analysis-config.json');
  await fs.writeFile(configPath, JSON.stringify(depConfig, null, 2));
  console.log(chalk.green('✅ Generated: dep-analysis-config.json'));
}
