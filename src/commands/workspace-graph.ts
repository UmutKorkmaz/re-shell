import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  WorkspaceDependencyGraph,
  createWorkspaceDependencyGraph,
  GraphAnalysis,
  CycleDetectionResult,
  BuildOrder
} from '../utils/workspace-graph';
import { loadWorkspaceDefinition } from '../utils/workspace-schema';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceGraphCommandOptions {
  analyze?: boolean;
  cycles?: boolean;
  order?: boolean;
  critical?: boolean;
  visualize?: boolean;
  interactive?: boolean;
  
  // File options
  file?: string;
  output?: string;
  
  // Analysis options
  detailed?: boolean;
  includePaths?: boolean;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceGraph(options: WorkspaceGraphCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.analyze) {
      await analyzeWorkspaceGraph(options, spinner);
      return;
    }

    if (options.cycles) {
      await detectWorkspaceCycles(options, spinner);
      return;
    }

    if (options.order) {
      await generateBuildOrder(options, spinner);
      return;
    }

    if (options.critical) {
      await findCriticalPath(options, spinner);
      return;
    }

    if (options.visualize) {
      await visualizeWorkspaceGraph(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveGraphManagement(options, spinner);
      return;
    }

    // Default: show graph summary
    await showGraphSummary(options, spinner);

  } catch (error) {
    if (error instanceof ValidationError) {
      if (spinner) spinner.stop();
      console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
      console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
      process.exit(1);
    }
    if (spinner) spinner.fail(chalk.red('Workspace graph operation failed'));
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      console.error('Make sure you have a valid re-shell workspace. Run "re-shell init" to initialize.');
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

async function analyzeWorkspaceGraph(options: WorkspaceGraphCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Analyzing workspace dependency graph: ${inputFile}`);

  try {
    const definition = await loadWorkspaceDefinition(inputPath);
    const graph = createWorkspaceDependencyGraph(definition);
    const analysis = graph.analyzeGraph();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
      return;
    }

    displayGraphAnalysis(analysis, inputFile, options.detailed || false);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Graph analysis failed'));
    throw error;
  }
}

async function detectWorkspaceCycles(options: WorkspaceGraphCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Detecting dependency cycles: ${inputFile}`);

  try {
    const definition = await loadWorkspaceDefinition(inputPath);
    const graph = createWorkspaceDependencyGraph(definition);
    const cycles = graph.detectCycles();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(cycles, null, 2));
      return;
    }

    displayCycleDetection(cycles, inputFile, options.detailed || false);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Cycle detection failed'));
    throw error;
  }
}

async function generateBuildOrder(options: WorkspaceGraphCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Generating build order: ${inputFile}`);

  try {
    const definition = await loadWorkspaceDefinition(inputPath);
    const graph = createWorkspaceDependencyGraph(definition);
    const buildOrder = graph.generateBuildOrder();

    if (spinner) spinner.stop();

    if (options.json) {
      const output = {
        ...buildOrder,
        dependencies: Object.fromEntries(buildOrder.dependencies)
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    displayBuildOrder(buildOrder, inputFile, options.detailed || false);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Build order generation failed'));
    throw error;
  }
}

async function findCriticalPath(options: WorkspaceGraphCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Finding critical path: ${inputFile}`);

  try {
    const definition = await loadWorkspaceDefinition(inputPath);
    const graph = createWorkspaceDependencyGraph(definition);
    const criticalPath = graph.findCriticalPath();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({ criticalPath }, null, 2));
      return;
    }

    displayCriticalPath(criticalPath, inputFile);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Critical path analysis failed'));
    throw error;
  }
}

async function visualizeWorkspaceGraph(options: WorkspaceGraphCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Generating graph visualization: ${inputFile}`);

  try {
    const definition = await loadWorkspaceDefinition(inputPath);
    const graph = createWorkspaceDependencyGraph(definition);
    const vizData = graph.getVisualizationData();

    if (spinner) spinner.stop();

    if (options.output) {
      // Save visualization data to file
      const outputPath = path.resolve(options.output);
      await fs.writeJson(outputPath, vizData, { spaces: 2 });
      console.log(chalk.green(`Visualization data saved to: ${options.output}`));
    } else {
      // Display text-based visualization
      displayTextVisualization(vizData, inputFile);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Visualization generation failed'));
    throw error;
  }
}

async function showGraphSummary(options: WorkspaceGraphCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (spinner) spinner.setText('Loading workspace dependency graph...');

  try {
    if (!(await fs.pathExists(inputPath))) {
      if (spinner) spinner.stop();
      
      console.log(chalk.yellow('\\n⚠️  No workspace definition found'));
      console.log(chalk.gray(`Expected: ${inputFile}`));
      console.log(chalk.cyan('\\n🚀 Quick start:'));
      console.log('  re-shell workspace-def init');
      return;
    }

    const definition = await loadWorkspaceDefinition(inputPath);
    const graph = createWorkspaceDependencyGraph(definition);
    const analysis = graph.analyzeGraph();

    if (spinner) spinner.stop();

    if (options.json) {
      const summary = {
        file: inputFile,
        workspaces: analysis.nodeCount,
        dependencies: analysis.edgeCount,
        hasCycles: analysis.cycles.hasCycles,
        cycleCount: analysis.cycles.cycles.length,
        maxDepth: analysis.statistics.maxDepth,
        orphaned: analysis.orphanedNodes.length
      };
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log(chalk.cyan('\\n📊 Workspace Dependency Graph Summary'));
    console.log(chalk.gray('═'.repeat(60)));

    console.log(`\\nFile: ${chalk.cyan(inputFile)}`);
    console.log(`Workspaces: ${chalk.yellow(analysis.nodeCount)}`);
    console.log(`Dependencies: ${chalk.yellow(analysis.edgeCount)}`);

    // Cycle status
    const cycleIcon = analysis.cycles.hasCycles ? '❌' : '✅';
    const cycleStatus = analysis.cycles.hasCycles ? 
      chalk.red(`${analysis.cycles.cycles.length} cycles detected`) : 
      chalk.green('No cycles');
    console.log(`\\nDependency Cycles: ${cycleIcon} ${cycleStatus}`);

    // Graph metrics
    console.log(`\\nGraph Metrics:`);
    console.log(`  Max Depth: ${analysis.statistics.maxDepth}`);
    console.log(`  Avg Dependencies: ${analysis.statistics.avgDependencies.toFixed(1)}`);
    console.log(`  Avg Dependents: ${analysis.statistics.avgDependents.toFixed(1)}`);
    
    if (analysis.orphanedNodes.length > 0) {
      console.log(`  Orphaned: ${chalk.yellow(analysis.orphanedNodes.length)}`);
    }

    // Critical path
    if (analysis.criticalPath.length > 0) {
      console.log(`\\nCritical Path: ${analysis.criticalPath.join(' → ')}`);
    }

    console.log(chalk.cyan('\\n🛠️  Available Commands:'));
    console.log('  • re-shell workspace-graph analyze');
    console.log('  • re-shell workspace-graph cycles');
    console.log('  • re-shell workspace-graph order');
    console.log('  • re-shell workspace-graph critical');
    console.log('  • re-shell workspace-graph interactive');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Graph summary failed'));
    throw error;
  }
}

async function interactiveGraphManagement(options: WorkspaceGraphCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);
  const exists = await fs.pathExists(inputPath);

  if (!exists) {
    console.log(chalk.yellow('\\n⚠️  No workspace definition found'));
    console.log(chalk.gray('Create one first with: re-shell workspace-def init'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to analyze?',
      choices: [
        { title: '📊 Complete graph analysis', value: 'analyze' },
        { title: '🔄 Detect dependency cycles', value: 'cycles' },
        { title: '🏗️  Generate build order', value: 'order' },
        { title: '🎯 Find critical path', value: 'critical' },
        { title: '👀 Visualize graph', value: 'visualize' },
        { title: '📋 Show summary', value: 'summary' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'analyze':
      await analyzeWorkspaceGraph({ ...options, interactive: false });
      break;
    case 'cycles':
      await detectWorkspaceCycles({ ...options, interactive: false });
      break;
    case 'order':
      await generateBuildOrder({ ...options, interactive: false });
      break;
    case 'critical':
      await findCriticalPath({ ...options, interactive: false });
      break;
    case 'visualize':
      await visualizeWorkspaceGraph({ ...options, interactive: false });
      break;
    case 'summary':
      await showGraphSummary({ ...options, interactive: false });
      break;
  }
}

// Display functions
function displayGraphAnalysis(analysis: GraphAnalysis, fileName: string, detailed: boolean): void {
  console.log(chalk.cyan(`\\n📊 Workspace Dependency Graph Analysis`));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray('═'.repeat(60)));

  // Basic statistics
  console.log(`\\n📈 Graph Statistics:`);
  console.log(`  Nodes (Workspaces): ${chalk.yellow(analysis.nodeCount)}`);
  console.log(`  Edges (Dependencies): ${chalk.yellow(analysis.edgeCount)}`);
  console.log(`  Maximum Depth: ${chalk.yellow(analysis.statistics.maxDepth)}`);
  console.log(`  Average Dependencies per Workspace: ${chalk.yellow(analysis.statistics.avgDependencies.toFixed(1))}`);
  console.log(`  Average Dependents per Workspace: ${chalk.yellow(analysis.statistics.avgDependents.toFixed(1))}`);

  // Cycle analysis
  console.log(`\\n🔄 Cycle Analysis:`);
  if (analysis.cycles.hasCycles) {
    console.log(chalk.red(`  ❌ ${analysis.cycles.cycles.length} cycles detected`));
    
    if (detailed) {
      for (let i = 0; i < analysis.cycles.cycles.length; i++) {
        const cycle = analysis.cycles.cycles[i];
        const severityColor = cycle.severity === 'error' ? chalk.red : 
                            cycle.severity === 'warning' ? chalk.yellow : chalk.blue;
        
        console.log(`\\n  Cycle ${i + 1}: ${severityColor(cycle.severity.toUpperCase())}`);
        console.log(`    Path: ${cycle.path.join(' → ')}`);
        console.log(`    Type: ${cycle.type}`);
        
        if (cycle.suggestions.length > 0) {
          console.log(`    Suggestions:`);
          for (const suggestion of cycle.suggestions) {
            console.log(`      • ${suggestion}`);
          }
        }
      }
    }
  } else {
    console.log(chalk.green('  ✅ No cycles detected'));
  }

  // Strongly connected components
  if (analysis.cycles.stronglyConnectedComponents.length > 0) {
    console.log(`\\n  Strongly Connected Components: ${analysis.cycles.stronglyConnectedComponents.length}`);
    if (detailed) {
      for (let i = 0; i < analysis.cycles.stronglyConnectedComponents.length; i++) {
        const component = analysis.cycles.stronglyConnectedComponents[i];
        console.log(`    Component ${i + 1}: ${component.join(', ')}`);
      }
    }
  }

  // Build levels
  if (analysis.levels.length > 0) {
    console.log(`\\n🏗️  Build Levels: ${analysis.levels.length}`);
    if (detailed) {
      for (let i = 0; i < analysis.levels.length; i++) {
        const level = analysis.levels[i];
        console.log(`    Level ${i}: ${level.join(', ')}`);
      }
    }
  }

  // Critical path
  if (analysis.criticalPath.length > 0) {
    console.log(`\\n🎯 Critical Path (${analysis.criticalPath.length} workspaces):`);
    console.log(`  ${analysis.criticalPath.join(' → ')}`);
  }

  // Orphaned nodes
  if (analysis.orphanedNodes.length > 0) {
    console.log(`\\n🏝️  Orphaned Workspaces: ${analysis.orphanedNodes.length}`);
    if (detailed) {
      console.log(`  ${analysis.orphanedNodes.join(', ')}`);
    }
  }

  // Topological order
  if (analysis.topologicalOrder.length > 0 && detailed) {
    console.log(`\\n📋 Topological Order:`);
    console.log(`  ${analysis.topologicalOrder.join(' → ')}`);
  }
}

function displayCycleDetection(cycles: CycleDetectionResult, fileName: string, detailed: boolean): void {
  console.log(chalk.cyan(`\\n🔄 Dependency Cycle Detection`));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray('═'.repeat(50)));

  if (!cycles.hasCycles) {
    console.log(chalk.green('\\n✅ No dependency cycles detected'));
    console.log(chalk.gray('Your workspace dependency graph is acyclic.'));
    return;
  }

  console.log(chalk.red(`\\n❌ ${cycles.cycles.length} dependency cycle(s) detected`));

  // Group cycles by severity
  const errorCycles = cycles.cycles.filter(c => c.severity === 'error');
  const warningCycles = cycles.cycles.filter(c => c.severity === 'warning');
  const infoCycles = cycles.cycles.filter(c => c.severity === 'info');

  if (errorCycles.length > 0) {
    console.log(chalk.red(`\\n🚨 Critical Cycles (${errorCycles.length}):`));
    displayCycles(errorCycles, detailed);
  }

  if (warningCycles.length > 0) {
    console.log(chalk.yellow(`\\n⚠️  Warning Cycles (${warningCycles.length}):`));
    displayCycles(warningCycles, detailed);
  }

  if (infoCycles.length > 0) {
    console.log(chalk.blue(`\\nℹ️  Info Cycles (${infoCycles.length}):`));
    displayCycles(infoCycles, detailed);
  }

  // Strongly connected components
  if (cycles.stronglyConnectedComponents.length > 0) {
    console.log(chalk.cyan(`\\n🔗 Strongly Connected Components (${cycles.stronglyConnectedComponents.length}):`));
    for (let i = 0; i < cycles.stronglyConnectedComponents.length; i++) {
      const component = cycles.stronglyConnectedComponents[i];
      console.log(`  ${i + 1}. ${component.join(' ↔ ')}`);
    }
  }
}

function displayCycles(cycles: any[], detailed: boolean): void {
  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    console.log(`\\n  ${i + 1}. ${cycle.path.join(' → ')}`);
    console.log(`     Type: ${cycle.type}`);
    
    if (detailed && cycle.suggestions.length > 0) {
      console.log(`     Suggestions:`);
      for (const suggestion of cycle.suggestions) {
        console.log(`       • ${suggestion}`);
      }
    }
  }
}

function displayBuildOrder(buildOrder: BuildOrder, fileName: string, detailed: boolean): void {
  console.log(chalk.cyan(`\\n🏗️  Workspace Build Order`));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray('═'.repeat(50)));

  console.log(`\\n📊 Build Statistics:`);
  console.log(`  Total Levels: ${chalk.yellow(buildOrder.order.length)}`);
  console.log(`  Parallelizable: ${buildOrder.parallelizable ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`  Max Parallelism: ${chalk.yellow(buildOrder.maxParallelism)}`);
  console.log(`  Estimated Time: ${chalk.yellow(Math.round(buildOrder.estimatedTime / 60))} minutes`);

  console.log(`\\n🔢 Build Order (Level by Level):`);
  for (let i = 0; i < buildOrder.order.length; i++) {
    const level = buildOrder.order[i];
    console.log(`\\n  Level ${i + 1}: ${level.length} workspace(s)`);
    
    if (level.length === 1) {
      console.log(`    • ${level[0]}`);
    } else {
      console.log(`    Parallel execution:`);
      for (const workspace of level) {
        console.log(`    • ${workspace}`);
      }
    }
  }

  if (detailed) {
    console.log(`\\n📋 Dependencies:`);
    for (const [workspace, deps] of buildOrder.dependencies) {
      if (deps.length > 0) {
        console.log(`  ${workspace}: ${deps.join(', ')}`);
      }
    }
  }

  console.log(chalk.cyan('\\n💡 Build Command Example:'));
  console.log('  # Sequential build');
  console.log('  for level in levels; do');
  console.log('    for workspace in $level; do npm run build --workspace=$workspace; done');
  console.log('  done');
  console.log('\\n  # Parallel build (within levels)');
  console.log('  for level in levels; do');
  console.log('    echo $level | xargs -n1 -P0 npm run build --workspace=');
  console.log('  done');
}

function displayCriticalPath(criticalPath: string[], fileName: string): void {
  console.log(chalk.cyan(`\\n🎯 Critical Path Analysis`));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray('═'.repeat(50)));

  if (criticalPath.length === 0) {
    console.log(chalk.yellow('\\n⚠️  Cannot determine critical path'));
    console.log(chalk.gray('This usually indicates dependency cycles in the graph.'));
    console.log(chalk.cyan('\\n💡 Suggestion: Run cycle detection first:'));
    console.log('  re-shell workspace-graph cycles');
    return;
  }

  console.log(`\\n🏁 Critical Path (${criticalPath.length} workspaces):`);
  console.log(chalk.yellow(`  ${criticalPath.join(' → ')}`));

  console.log(`\\n📊 Analysis:`);
  console.log(`  Path Length: ${chalk.yellow(criticalPath.length)} workspaces`);
  console.log(`  Bottleneck: ${chalk.red(criticalPath[criticalPath.length - 1])}`);

  console.log(chalk.cyan('\\n💡 Optimization Tips:'));
  console.log('  • Focus optimization efforts on critical path workspaces');
  console.log('  • Consider breaking up large workspaces on the critical path');
  console.log('  • Parallel execution of non-critical workspaces can happen alongside');
  console.log(`  • The build time is primarily determined by: ${criticalPath.join(' → ')}`);
}

function displayTextVisualization(vizData: any, fileName: string): void {
  console.log(chalk.cyan(`\\n👀 Workspace Graph Visualization`));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray('═'.repeat(50)));

  console.log(`\\n📦 Workspaces (${vizData.nodes.length}):`);
  
  // Group nodes by type
  const nodesByType = vizData.nodes.reduce((acc: any, node: any) => {
    if (!acc[node.group]) acc[node.group] = [];
    acc[node.group].push(node.label);
    return acc;
  }, {});

  for (const [type, nodes] of Object.entries(nodesByType)) {
    const typeIcon = getWorkspaceTypeIcon(type);
    console.log(`\\n  ${typeIcon} ${type} (${(nodes as string[]).length}):`);
    for (const node of nodes as string[]) {
      console.log(`    • ${node}`);
    }
  }

  console.log(`\\n🔗 Dependencies (${vizData.edges.length}):`);
  
  // Group edges by type
  const edgesByType = vizData.edges.reduce((acc: any, edge: any) => {
    if (!acc[edge.label]) acc[edge.label] = [];
    acc[edge.label].push(`${edge.from} → ${edge.to}`);
    return acc;
  }, {});

  for (const [type, edges] of Object.entries(edgesByType)) {
    const typeIcon = getDependencyTypeIcon(type);
    console.log(`\\n  ${typeIcon} ${type} (${(edges as string[]).length}):`);
    for (const edge of (edges as string[]).slice(0, 10)) {
      console.log(`    • ${edge}`);
    }
    if ((edges as string[]).length > 10) {
      console.log(`    ... and ${(edges as string[]).length - 10} more`);
    }
  }

  console.log(chalk.cyan('\\n💾 Export Options:'));
  console.log('  • re-shell workspace-graph visualize --output graph.json');
  console.log('  • Use graph.json with visualization tools like:');
  console.log('    - Graphviz (dot format)');
  console.log('    - D3.js force-directed graphs');
  console.log('    - Cytoscape.js');
  console.log('    - Network visualization libraries');
}

// Utility functions
function getWorkspaceTypeIcon(type: string): string {
  const icons = {
    app: '📱',
    package: '📦',
    lib: '📚',
    tool: '🔧',
    service: '⚙️',
    website: '🌐'
  };
  
  return icons[type as keyof typeof icons] || '📄';
}

function getDependencyTypeIcon(type: string): string {
  const icons = {
    build: '🏗️',
    runtime: '⚡',
    dev: '🔧',
    test: '🧪'
  };
  
  return icons[type as keyof typeof icons] || '🔗';
}