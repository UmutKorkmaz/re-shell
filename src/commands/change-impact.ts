import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { ChangeImpactAnalyzer, createChangeImpactAnalyzer, ImpactAnalysisResult } from '../utils/change-impact-analyzer';

export interface ChangeImpactCommandOptions {
  files?: string[];
  output?: string;
  format?: 'text' | 'json' | 'mermaid';
  verbose?: boolean;
  maxDepth?: number;
  includeTests?: boolean;
  includeDevDeps?: boolean;
  visualization?: boolean;
  workspace?: string;
}

// Main command handler for change impact analysis
export async function manageChangeImpact(options: ChangeImpactCommandOptions = {}): Promise<void> {
  const spinner = new ProgressSpinner({ text: 'Analyzing change impact...' });
  
  try {
    const rootPath = process.cwd();
    
    // Validate that we're in a Re-Shell project
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) {
      throw new ValidationError('Not in a valid project directory (package.json not found)');
    }

    spinner.start();
    
    const analyzer = await createChangeImpactAnalyzer(rootPath, {
      maxDepth: options.maxDepth || 10,
      includeTests: options.includeTests !== false,
      includeDevDependencies: options.includeDevDeps || false,
      buildOptimization: true,
      parallelAnalysis: true
    });

    spinner.setText('Analyzing change impact...');

    let result: ImpactAnalysisResult;
    
    if (options.files && options.files.length > 0) {
      // Analyze specific files
      result = await analyzer.analyzeChangeImpact(options.files);
    } else {
      // Analyze all detected changes
      result = await analyzer.analyzeChangeImpact();
    }

    spinner.stop();

    // Output results based on format
    if (options.format === 'json') {
      await outputJson(result, options.output);
    } else if (options.format === 'mermaid') {
      await outputMermaid(analyzer, result, options.output);
    } else if (options.visualization) {
      await outputVisualization(analyzer, result.changedFiles, options.output);
    } else {
      await outputText(result, options.verbose || false);
    }

    // Save to file if specified
    if (options.output && options.format !== 'json' && options.format !== 'mermaid' && !options.visualization) {
      await saveTextOutput(result, options.output, options.verbose || false);
    }

  } catch (error) {
    spinner.stop();
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Change impact analysis failed: ${error}`);
  }
}

// Analyze specific workspace
export async function analyzeWorkspaceImpact(workspaceName: string, options: ChangeImpactCommandOptions = {}): Promise<void> {
  const spinner = new ProgressSpinner({ text: 'Analyzing change impact...' });
  
  try {
    const rootPath = process.cwd();
    
    spinner.start();
    
    const analyzer = await createChangeImpactAnalyzer(rootPath);
    const workspace = analyzer.getWorkspaceInfo(workspaceName);
    
    if (!workspace) {
      throw new ValidationError(`Workspace '${workspaceName}' not found`);
    }

    // Get files in workspace directory
    const workspaceFiles = await getWorkspaceFiles(workspace.path);
    const result = await analyzer.analyzeChangeImpact(workspaceFiles);

    spinner.stop();

    console.log(chalk.cyan(`\n📊 Impact Analysis for Workspace: ${workspaceName}`));
    console.log(chalk.gray('='.repeat(50)));
    
    await outputText(result, options.verbose || false);

  } catch (error) {
    spinner.stop();
    throw error;
  }
}

// Get dependency graph visualization
export async function showDependencyGraph(options: ChangeImpactCommandOptions = {}): Promise<void> {
  const spinner = new ProgressSpinner({ text: 'Analyzing change impact...' });
  
  try {
    const rootPath = process.cwd();
    
    spinner.start();
    
    const analyzer = await createChangeImpactAnalyzer(rootPath);
    const graph = analyzer.getDependencyGraph();

    spinner.stop();

    if (options.format === 'json') {
      const graphData = {
        nodes: Array.from(graph.nodes.values()),
        edges: Object.fromEntries(graph.edges),
        reverseEdges: Object.fromEntries(graph.reverseEdges)
      };
      
      if (options.output) {
        await fs.writeJson(options.output, graphData, { spaces: 2 });
        console.log(chalk.green(`✓ Dependency graph saved to ${options.output}`));
      } else {
        console.log(JSON.stringify(graphData, null, 2));
      }
    } else if (options.format === 'mermaid') {
      const mermaid = generateMermaidGraph(graph);
      
      if (options.output) {
        await fs.writeFile(options.output, mermaid);
        console.log(chalk.green(`✓ Mermaid diagram saved to ${options.output}`));
      } else {
        console.log(mermaid);
      }
    } else {
      displayTextGraph(graph, options.verbose || false);
    }

  } catch (error) {
    spinner.stop();
    throw error;
  }
}

// Output results as formatted text
async function outputText(result: ImpactAnalysisResult, verbose: boolean): Promise<void> {
  console.log(chalk.cyan('\n🔍 Change Impact Analysis Results'));
  console.log(chalk.gray('='.repeat(40)));

  // Summary
  console.log(chalk.bold('\n📊 Summary:'));
  console.log(`  • Changed files: ${chalk.yellow(result.changedFiles.length)}`);
  console.log(`  • Affected workspaces: ${chalk.yellow(result.affectedWorkspaces.length)}`);
  console.log(`  • Total impact score: ${chalk.yellow(result.totalImpact)}`);
  console.log(`  • Analysis time: ${chalk.gray(result.analysisTime + 'ms')}`);

  // Changed files
  if (result.changedFiles.length > 0) {
    console.log(chalk.bold('\n📝 Changed Files:'));
    result.changedFiles.forEach(file => {
      console.log(`  ${chalk.gray('•')} ${file}`);
    });
  }

  // Affected workspaces
  if (result.affectedWorkspaces.length > 0) {
    console.log(chalk.bold('\n🏗️  Affected Workspaces:'));
    result.affectedWorkspaces.forEach(ws => {
      const typeColor = getWorkspaceTypeColor(ws.type);
      const frameworkBadge = ws.framework ? chalk.gray(`[${ws.framework}]`) : '';
      console.log(`  ${chalk.gray('•')} ${typeColor(ws.name)} ${frameworkBadge}`);
      
      if (verbose) {
        console.log(`    ${chalk.gray('Path:')} ${ws.path}`);
        console.log(`    ${chalk.gray('Type:')} ${ws.type}`);
        if (ws.dependencies.length > 0) {
          console.log(`    ${chalk.gray('Dependencies:')} ${ws.dependencies.join(', ')}`);
        }
      }
    });
  }

  // Build order
  if (result.buildOrder.length > 0) {
    console.log(chalk.bold('\n🔨 Recommended Build Order:'));
    result.buildOrder.forEach((workspace, index) => {
      console.log(`  ${chalk.yellow(index + 1)}. ${workspace}`);
    });
  }

  // Test order
  if (result.testOrder.length > 0) {
    console.log(chalk.bold('\n🧪 Recommended Test Order:'));
    result.testOrder.forEach((workspace, index) => {
      console.log(`  ${chalk.yellow(index + 1)}. ${workspace}`);
    });
  }

  // Critical path
  if (result.criticalPath.length > 0) {
    console.log(chalk.bold('\n🎯 Critical Path:'));
    console.log(`  ${result.criticalPath.join(' → ')}`);
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    console.log(chalk.bold('\n💡 Recommendations:'));
    result.recommendations.forEach(rec => {
      console.log(`  ${chalk.gray('•')} ${rec}`);
    });
  }
}

// Output results as JSON
async function outputJson(result: ImpactAnalysisResult, outputPath?: string): Promise<void> {
  const json = JSON.stringify(result, null, 2);
  
  if (outputPath) {
    await fs.writeFile(outputPath, json);
    console.log(chalk.green(`✓ Impact analysis saved to ${outputPath}`));
  } else {
    console.log(json);
  }
}

// Output as Mermaid diagram
async function outputMermaid(analyzer: ChangeImpactAnalyzer, result: ImpactAnalysisResult, outputPath?: string): Promise<void> {
  const graph = analyzer.getDependencyGraph();
  const affectedNames = new Set(result.affectedWorkspaces.map(ws => ws.name));
  
  let mermaid = 'graph TD\n';
  
  // Add nodes with styling based on impact
  for (const [name, workspace] of graph.nodes) {
    const isAffected = affectedNames.has(name);
    const nodeStyle = isAffected ? ':::affected' : ':::normal';
    const nodeType = getNodeShape(workspace.type);
    
    mermaid += `    ${name}${nodeType}${nodeStyle}\n`;
  }
  
  // Add edges
  for (const [from, targets] of graph.edges) {
    for (const to of targets) {
      mermaid += `    ${from} --> ${to}\n`;
    }
  }
  
  // Add styling
  mermaid += '\n';
  mermaid += '    classDef affected fill:#ff6b6b,stroke:#333,stroke-width:2px;\n';
  mermaid += '    classDef normal fill:#51cf66,stroke:#333,stroke-width:1px;\n';
  
  if (outputPath) {
    await fs.writeFile(outputPath, mermaid);
    console.log(chalk.green(`✓ Mermaid diagram saved to ${outputPath}`));
  } else {
    console.log(mermaid);
  }
}

// Output visualization data
async function outputVisualization(analyzer: ChangeImpactAnalyzer, changedFiles: string[], outputPath?: string): Promise<void> {
  const visualization = await analyzer.getImpactVisualization(changedFiles);
  
  const output = {
    visualization,
    metadata: {
      generated: new Date().toISOString(),
      changedFiles,
      totalNodes: visualization.nodes.length,
      totalEdges: visualization.edges.length,
      affectedNodes: visualization.nodes.filter(n => n.affected).length
    }
  };
  
  if (outputPath) {
    await fs.writeJson(outputPath, output, { spaces: 2 });
    console.log(chalk.green(`✓ Visualization data saved to ${outputPath}`));
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

// Save text output to file
async function saveTextOutput(result: ImpactAnalysisResult, outputPath: string, verbose: boolean): Promise<void> {
  // Capture console output
  let output = '';
  const originalLog = console.log;

  console.log = (...args) => {
    output += args.join(' ') + '\n';
  };

  try {
    await outputText(result, verbose);
  } finally {
    console.log = originalLog;
  }

  await fs.writeFile(outputPath, output);
  console.log(chalk.green(`✓ Impact analysis saved to ${outputPath}`));
}

// Get files in workspace directory
async function getWorkspaceFiles(workspacePath: string): Promise<string[]> {
  const files: string[] = [];
  
  const scanDirectory = async (dirPath: string): Promise<void> => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and build directories
        if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
          await scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };
  
  await scanDirectory(workspacePath);
  return files;
}

// Generate Mermaid graph representation
function generateMermaidGraph(graph: any): string {
  let mermaid = 'graph TD\n';
  
  // Add nodes
  for (const [name, workspace] of graph.nodes) {
    const nodeShape = getNodeShape(workspace.type);
    mermaid += `    ${name}${nodeShape}\n`;
  }
  
  // Add edges
  for (const [from, targets] of graph.edges) {
    for (const to of targets) {
      mermaid += `    ${from} --> ${to}\n`;
    }
  }
  
  return mermaid;
}

// Display text-based dependency graph
function displayTextGraph(graph: any, verbose: boolean): void {
  console.log(chalk.cyan('\n📊 Workspace Dependency Graph'));
  console.log(chalk.gray('='.repeat(35)));
  
  console.log(chalk.bold('\n🏗️  Workspaces:'));
  for (const [name, workspace] of graph.nodes) {
    const typeColor = getWorkspaceTypeColor(workspace.type);
    const frameworkBadge = workspace.framework ? chalk.gray(`[${workspace.framework}]`) : '';
    console.log(`  ${chalk.gray('•')} ${typeColor(name)} ${frameworkBadge}`);
    
    if (verbose) {
      console.log(`    ${chalk.gray('Path:')} ${workspace.path}`);
      console.log(`    ${chalk.gray('Type:')} ${workspace.type}`);
    }
  }
  
  console.log(chalk.bold('\n🔗 Dependencies:'));
  for (const [from, targets] of graph.edges) {
    if (targets.length > 0) {
      console.log(`  ${chalk.yellow(from)} → ${targets.join(', ')}`);
    }
  }
}

// Get workspace type color
function getWorkspaceTypeColor(type: string): (text: string) => string {
  switch (type) {
    case 'app': return chalk.blue;
    case 'package': return chalk.green;
    case 'lib': return chalk.magenta;
    case 'tool': return chalk.cyan;
    default: return chalk.white;
  }
}

// Get node shape for Mermaid diagrams
function getNodeShape(type: string): string {
  switch (type) {
    case 'app': return '[App]';
    case 'package': return '(Package)';
    case 'lib': return '{Library}';
    case 'tool': return '[[Tool]]';
    default: return '[Unknown]';
  }
}

// Register change impact commands
export function registerChangeImpactCommands(program: Command): void {
  const changeImpact = program
    .command('change-impact')
    .alias('impact')
    .description('Analyze change impact across workspace dependencies');

  changeImpact
    .command('analyze')
    .description('Analyze impact of file changes')
    .option('--files <files...>', 'Specific files to analyze')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json|mermaid)', 'text')
    .option('--verbose', 'Show detailed information')
    .option('--max-depth <depth>', 'Maximum dependency depth', '10')
    .option('--include-tests', 'Include test dependencies')
    .option('--include-dev-deps', 'Include dev dependencies')
    .option('--visualization', 'Generate visualization data')
    .action(async (options) => {
      await manageChangeImpact({
        ...options,
        maxDepth: parseInt(options.maxDepth)
      });
    });

  changeImpact
    .command('workspace <name>')
    .description('Analyze impact for specific workspace')
    .option('--verbose', 'Show detailed information')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(async (name, options) => {
      await analyzeWorkspaceImpact(name, options);
    });

  changeImpact
    .command('graph')
    .description('Show workspace dependency graph')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json|mermaid)', 'text')
    .option('--verbose', 'Show detailed information')
    .action(async (options) => {
      await showDependencyGraph(options);
    });
}