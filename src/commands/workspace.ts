import * as fs from 'fs-extra';
import * as path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import * as yaml from 'js-yaml';
import prompts from 'prompts';
import { getWorkspaces, findMonorepoRoot, WorkspaceInfo } from '../utils/monorepo';
import { ProgressSpinner } from '../utils/spinner';

const execAsync = promisify(exec);

interface WorkspaceListOptions {
  json?: boolean;
  type?: 'app' | 'package' | 'lib' | 'tool';
  framework?: string;
  spinner?: ProgressSpinner;
}

interface WorkspaceUpdateOptions {
  workspace?: string;
  dependency?: string;
  version?: string;
  dev?: boolean;
  spinner?: ProgressSpinner;
}

interface WorkspaceGraphOptions {
  output?: string;
  format?: 'text' | 'json' | 'mermaid' | 'svg' | 'd3';
  spinner?: ProgressSpinner;
}

/**
 * List all workspaces in the monorepo
 */
export async function listWorkspaces(options: WorkspaceListOptions = {}): Promise<void> {
  const { spinner } = options;

  try {
    if (spinner) {
      spinner.setText('Finding monorepo root...');
    }

    // Add timeout to prevent hanging
    const monorepoRoot = await Promise.race([
      findMonorepoRoot(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout finding monorepo root')), 5000)
      ),
    ]);

    if (!monorepoRoot) {
      throw new Error('Not in a monorepo. Run this command from a monorepo root or workspace.');
    }

    if (spinner) {
      spinner.setText('Loading workspace information...');
    }

    const workspaces = await getWorkspaces(monorepoRoot);

    // Filter workspaces based on options
    let filteredWorkspaces = workspaces;

    if (options.type) {
      filteredWorkspaces = filteredWorkspaces.filter(ws => ws.type === options.type);
    }

    if (options.framework) {
      filteredWorkspaces = filteredWorkspaces.filter(ws => ws.framework === options.framework);
    }

    if (spinner) {
      spinner.stop();
    }

    if (options.json) {
      console.log(JSON.stringify(filteredWorkspaces, null, 2));
      return;
    }

    // Display workspaces in a formatted table
    console.log(chalk.cyan('\n📦 Workspaces\n'));

    if (filteredWorkspaces.length === 0) {
      console.log(chalk.yellow('No workspaces found.'));
      return;
    }

    // Group by type
    const groupedWorkspaces = filteredWorkspaces.reduce(
      (acc: Record<string, WorkspaceInfo[]>, ws: WorkspaceInfo) => {
        if (!acc[ws.type]) acc[ws.type] = [];
        acc[ws.type].push(ws);
        return acc;
      },
      {} as Record<string, WorkspaceInfo[]>
    );

    for (const [type, workspaceList] of Object.entries(groupedWorkspaces)) {
      console.log(chalk.bold(`\n${type.toUpperCase()}S:`));

      workspaceList.forEach((ws: WorkspaceInfo) => {
        const frameworkBadge = ws.framework ? chalk.blue(`[${ws.framework}]`) : '';
        const versionBadge = chalk.gray(`v${ws.version}`);

        console.log(
          `  ${chalk.green('●')} ${chalk.bold(ws.name)} ${frameworkBadge} ${versionBadge}`
        );
        console.log(`    ${chalk.gray(ws.path)}`);

        if (ws.dependencies.length > 0) {
          const depCount = ws.dependencies.length;
          console.log(`    ${chalk.gray(`${depCount} dependencies`)}`);
        }
      });
    }

    console.log(chalk.gray(`\nTotal: ${filteredWorkspaces.length} workspaces`));
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Error listing workspaces'));
    }
    console.error(chalk.red('Error listing workspaces:'), error);
    throw error;
  }
}

/**
 * Update dependencies across workspaces
 */
export async function updateWorkspaces(options: WorkspaceUpdateOptions = {}): Promise<void> {
  const { spinner } = options;

  try {
    if (spinner) {
      spinner.setText('Finding monorepo root...');
    }

    const monorepoRoot = await findMonorepoRoot();
    if (!monorepoRoot) {
      throw new Error('Not in a monorepo. Run this command from a monorepo root or workspace.');
    }

    if (spinner) {
      spinner.setText('Loading workspace information...');
    }

    const workspaces = await getWorkspaces(monorepoRoot);

    if (options.workspace) {
      // Update specific workspace
      const workspace = workspaces.find(
        (ws: WorkspaceInfo) =>
          ws.name === options.workspace ||
          (options.workspace && ws.path.includes(options.workspace))
      );

      if (!workspace) {
        throw new Error(`Workspace "${options.workspace}" not found.`);
      }

      if (spinner) {
        spinner.setText(`Updating workspace: ${workspace.name}...`);
      }

      await updateSingleWorkspace(monorepoRoot, workspace, options);

      if (spinner) {
        spinner.succeed(chalk.green(`✓ Workspace "${workspace.name}" updated successfully`));
      }
    } else {
      // Update all workspaces
      if (spinner) {
        spinner.setText('Updating all workspaces...');
      }

      for (let i = 0; i < workspaces.length; i++) {
        const workspace = workspaces[i];

        if (spinner) {
          spinner.setText(`Updating ${workspace.name} (${i + 1}/${workspaces.length})...`);
        }

        await updateSingleWorkspace(monorepoRoot, workspace, options);
      }

      if (spinner) {
        spinner.succeed(chalk.green('✓ All workspaces updated'));
      }
    }
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Error updating workspaces'));
    }
    console.error(chalk.red('Error updating workspaces:'), error);
    throw error;
  }
}

async function updateSingleWorkspace(
  monorepoRoot: string,
  workspace: WorkspaceInfo,
  options: WorkspaceUpdateOptions
): Promise<void> {
  const workspacePath = path.join(monorepoRoot, workspace.path);

  if (options.dependency && options.version) {
    // Update specific dependency
    const depFlag = options.dev ? '--save-dev' : '--save';
    const packageManager = await detectPackageManager(monorepoRoot);

    let command: string;
    switch (packageManager) {
      case 'pnpm':
        command = `pnpm add ${depFlag} ${options.dependency}@${options.version}`;
        break;
      case 'yarn':
        command = `yarn add ${depFlag} ${options.dependency}@${options.version}`;
        break;
      default:
        command = `npm install ${depFlag} ${options.dependency}@${options.version}`;
    }

    await execAsync(command, { cwd: workspacePath });
    console.log(
      chalk.green(`✓ Updated ${options.dependency} to ${options.version} in ${workspace.name}`)
    );
  } else {
    // Update all dependencies
    const packageManager = await detectPackageManager(monorepoRoot);

    let command: string;
    switch (packageManager) {
      case 'pnpm':
        command = 'pnpm update';
        break;
      case 'yarn':
        command = 'yarn upgrade';
        break;
      default:
        command = 'npm update';
    }

    await execAsync(command, { cwd: workspacePath });
  }
}

/**
 * Generate workspace dependency graph
 */
export async function generateWorkspaceGraph(options: WorkspaceGraphOptions = {}): Promise<void> {
  const { spinner } = options;

  try {
    if (spinner) {
      spinner.setText('Finding monorepo root...');
    }

    const monorepoRoot = await findMonorepoRoot();
    if (!monorepoRoot) {
      throw new Error('Not in a monorepo. Run this command from a monorepo root or workspace.');
    }

    if (spinner) {
      spinner.setText('Loading workspace information...');
    }

    const workspaces = await getWorkspaces(monorepoRoot);

    if (spinner) {
      spinner.setText('Building dependency graph...');
    }

    const graph = await buildDependencyGraph(workspaces);

    if (spinner) {
      spinner.stop();
    }

    switch (options.format) {
      case 'json': {
        const jsonOutput = JSON.stringify(graph, null, 2);
        if (options.output) {
          await fs.writeFile(options.output, jsonOutput);
          console.log(chalk.green(`Graph saved to ${options.output}`));
        } else {
          console.log(jsonOutput);
        }
        break;
      }

      case 'mermaid': {
        const mermaidOutput = generateMermaidGraph(graph);
        if (options.output) {
          await fs.writeFile(options.output, mermaidOutput);
          console.log(chalk.green(`Mermaid graph saved to ${options.output}`));
        } else {
          console.log(mermaidOutput);
        }
        break;
      }

      case 'svg': {
        const svgOutput = generateSvgGraph(graph);
        if (options.output) {
          await fs.writeFile(options.output, svgOutput);
          console.log(chalk.green(`SVG graph saved to ${options.output}`));
        } else {
          console.log(svgOutput);
        }
        break;
      }

      case 'd3': {
        const d3Output = generateD3Graph(graph);
        if (options.output) {
          await fs.writeFile(options.output, d3Output);
          console.log(chalk.green(`D3.js graph saved to ${options.output}`));
        } else {
          console.log(d3Output);
        }
        break;
      }

      default:
        displayTextGraph(graph);
    }
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Error generating workspace graph'));
    }
    console.error(chalk.red('Error generating workspace graph:'), error);
    throw error;
  }
}

async function buildDependencyGraph(workspaces: WorkspaceInfo[]): Promise<any> {
  const graph = {
    nodes: workspaces.map(ws => ({
      id: ws.name,
      type: ws.type,
      framework: ws.framework,
      path: ws.path,
    })),
    edges: [] as Array<{ from: string; to: string; type: 'dependency' | 'devDependency' }>,
  };

  // Build edges based on package.json dependencies
  for (const workspace of workspaces) {
    const packageJsonPath = path.join(workspace.path, 'package.json');

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const depName of Object.keys(allDeps)) {
        const targetWorkspace = workspaces.find(ws => ws.name === depName);
        if (targetWorkspace) {
          graph.edges.push({
            from: workspace.name,
            to: targetWorkspace.name,
            type: packageJson.dependencies?.[depName] ? 'dependency' : 'devDependency',
          });
        }
      }
    } catch (error) {
      // Skip if package.json is not readable
    }
  }

  return graph;
}

function displayTextGraph(graph: any): void {
  console.log(chalk.cyan('\n🔗 Workspace Dependency Graph\n'));

  for (const node of graph.nodes) {
    const dependencies = graph.edges.filter((edge: any) => edge.from === node.id);
    const dependents = graph.edges.filter((edge: any) => edge.to === node.id);

    console.log(chalk.bold(`${node.id} (${node.type})`));

    if (dependencies.length > 0) {
      console.log(chalk.gray('  Dependencies:'));
      dependencies.forEach((dep: any) => {
        const typeColor = dep.type === 'dependency' ? chalk.green : chalk.yellow;
        console.log(`    ${typeColor('→')} ${dep.to}`);
      });
    }

    if (dependents.length > 0) {
      console.log(chalk.gray('  Dependents:'));
      dependents.forEach((dep: any) => {
        console.log(`    ${chalk.blue('←')} ${dep.from}`);
      });
    }

    console.log();
  }
}

function generateMermaidGraph(graph: any): string {
  let mermaid = 'graph TD\n';

  // Add nodes
  for (const node of graph.nodes) {
    const shape = getNodeShape(node.type);
    mermaid += `  ${node.id}${shape}\n`;
  }

  // Add edges
  for (const edge of graph.edges) {
    const style = edge.type === 'dependency' ? '-->' : '-..->';
    mermaid += `  ${edge.from} ${style} ${edge.to}\n`;
  }

  return mermaid;
}

function getNodeShape(type: string): string {
  switch (type) {
    case 'app':
      return '[App]';
    case 'package':
      return '(Package)';
    case 'lib':
      return '{Library}';
    case 'tool':
      return '[[Tool]]';
    default:
      return '[Unknown]';
  }
}

/**
 * Generate SVG graph
 */
function generateSvgGraph(graph: any): string {
  // Calculate node positions using simple force-directed layout simulation
  const nodePositions = calculateNodePositions(graph.nodes, graph.edges);
  const width = 800;
  const height = 600;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .node { stroke: #333; stroke-width: 2px; cursor: pointer; }
    .node:hover { stroke: #000; stroke-width: 3px; }
    .node-rect-app { fill: #4CAF50; }
    .node-rect-package { fill: #2196F3; }
    .node-rect-lib { fill: #FF9800; }
    .node-rect-tool { fill: #9C27B0; }
    .node-text { font-family: Arial, sans-serif; font-size: 14px; fill: white; text-anchor: middle; dominant-baseline: middle; }
    .edge { stroke: #999; stroke-width: 2px; marker-end: url(#arrowhead); }
    .edge-dev { stroke-dasharray: 5,5; }
    .edge-label { font-family: Arial, sans-serif; font-size: 11px; fill: #666; text-anchor: middle; background: white; }
  </style>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#999" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#f8f9fa" />
`;

  // Add edges
  for (const edge of graph.edges) {
    const fromPos = nodePositions[edge.from];
    const toPos = nodePositions[edge.to];
    if (!fromPos || !toPos) continue;

    const edgeClass = edge.type === 'devDependency' ? 'edge edge-dev' : 'edge';
    svg += `  <line class="${edgeClass}" x1="${fromPos.x}" y1="${fromPos.y}" x2="${toPos.x}" y2="${toPos.y}" />\n`;
  }

  // Add nodes
  for (const node of graph.nodes) {
    const pos = nodePositions[node.id];
    if (!pos) continue;

    const nodeClass = `node node-rect-${node.type}`;
    const rectWidth = 120;
    const rectHeight = 50;

    svg += `  <g transform="translate(${pos.x - rectWidth / 2}, ${pos.y - rectHeight / 2})">\n`;
    svg += `    <rect class="${nodeClass}" width="${rectWidth}" height="${rectHeight}" rx="8" />\n`;
    svg += `    <text class="node-text" x="${rectWidth / 2}" y="${rectHeight / 2}">${node.id}</text>\n`;
    svg += `  </g>\n`;
  }

  // Add legend
  svg += `  <g transform="translate(10, 10)">
    <rect width="130" height="100" fill="white" stroke="#ccc" stroke-width="1" rx="5" />
    <text x="65" y="20" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle">Legend</text>
    <rect x="15" y="35" width="15" height="15" fill="#4CAF50" rx="2" />
    <text x="35" y="47" font-family="Arial, sans-serif" font-size="11">App</text>
    <rect x="15" y="55" width="15" height="15" fill="#2196F3" rx="2" />
    <text x="35" y="67" font-family="Arial, sans-serif" font-size="11">Package</text>
    <rect x="15" y="75" width="15" height="15" fill="#FF9800" rx="2" />
    <text x="35" y="87" font-family="Arial, sans-serif" font-size="11">Library</text>
  </g>
`;

  svg += '</svg>';
  return svg;
}

/**
 * Calculate simple node positions (force-directed layout simulation)
 */
function calculateNodePositions(nodes: any[], edges: any[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const width = 800;
  const height = 600;

  // Initialize with random positions near center
  for (const node of nodes) {
    positions[node.id] = {
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    };
  }

  // Simple force-directed simulation (30 iterations)
  for (let iter = 0; iter < 30; iter++) {
    // Repulsion between all nodes
    for (const node1 of nodes) {
      for (const node2 of nodes) {
        if (node1.id === node2.id) continue;

        const dx = positions[node2.id].x - positions[node1.id].x;
        const dy = positions[node2.id].y - positions[node1.id].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 5000 / (dist * dist);

        positions[node1.id].x -= (dx / dist) * force;
        positions[node1.id].y -= (dy / dist) * force;
        positions[node2.id].x += (dx / dist) * force;
        positions[node2.id].y += (dy / dist) * force;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (!from || !to) continue;

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 150) * 0.05;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      positions[edge.from].x += fx;
      positions[edge.from].y += fy;
      positions[edge.to].x -= fx;
      positions[edge.to].y -= fy;
    }

    // Keep nodes within bounds
    for (const node of nodes) {
      positions[node.id].x = Math.max(100, Math.min(width - 100, positions[node.id].x));
      positions[node.id].y = Math.max(100, Math.min(height - 100, positions[node.id].y));
    }
  }

  return positions;
}

/**
 * Generate D3.js compatible JSON
 */
function generateD3Graph(graph: any): string {
  // Convert to D3 force graph format
  const d3Graph = {
    nodes: graph.nodes.map((node: any) => ({
      id: node.id,
      group: node.type,
      type: node.type,
      framework: node.framework,
    })),
    links: graph.edges.map((edge: any) => ({
      source: edge.from,
      target: edge.to,
      type: edge.type,
    })),
  };

  return JSON.stringify(d3Graph, null, 2);
}

async function detectPackageManager(rootPath: string): Promise<'npm' | 'yarn' | 'pnpm'> {
  if (await fs.pathExists(path.join(rootPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (await fs.pathExists(path.join(rootPath, 'yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

/**
 * Initialize a new workspace configuration
 */
export async function initWorkspace(options: any = {}): Promise<void> {
  const { spinner, yes = false } = options;

  try {
    console.log(chalk.cyan.bold('\n🚀 Re-Shell Workspace Initialization\n'));

    // Check if workspace config already exists
    const configPath = path.join(process.cwd(), 're-shell.workspaces.yaml');
    if (fs.existsSync(configPath)) {
      if (!yes) {
        const { overwrite } = await prompts({
          type: 'confirm',
          name: 'overwrite',
          message: 'Workspace configuration already exists. Overwrite?',
          initial: false,
        });

        if (!overwrite) {
          console.log(chalk.yellow('Initialization cancelled'));
          return;
        }
      }
    }

    // Detect existing project structure
    console.log(chalk.gray('Detecting project structure...\n'));
    const detection = await detectProjectStructureForInit();

    // Interactive wizard
    const responses = await runSetupWizard(detection, yes);

    // Generate workspace config
    const config = generateWorkspaceConfig(responses, detection);

    // Write config file
    await fs.writeFile(configPath, config);

    console.log(chalk.green('\n✓ Workspace configuration created: ' + configPath));

    // Show next steps
    showNextSteps(responses);

  } catch (error: any) {
    if (spinner) spinner.stop();
    console.error(chalk.red('Error: ' + error.message));
    throw error;
  }
}

/**
 * Detect existing project structure and frameworks
 */
async function detectProjectStructureForInit(): Promise<any> {
  const root = process.cwd();
  const detection: any = {
    hasPackageJson: false,
    hasPython: false,
    hasGo: false,
    hasRust: false,
    hasJava: false,
    hasDocker: false,
    frameworks: [] as string[],
    services: [] as any[],
  };

  // Check for package.json
  if (fs.existsSync(path.join(root, 'package.json'))) {
    detection.hasPackageJson = true;
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

    // Detect Node.js/TypeScript frameworks
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.react || deps['@types/react']) detection.frameworks.push('react');
    if (deps.vue || deps['@types/vue']) detection.frameworks.push('vue');
    if (deps.angular) detection.frameworks.push('angular');
    if (deps.svelte) detection.frameworks.push('svelte');
    if (deps.next || deps['next.js']) detection.frameworks.push('next');
    if (deps.nuxt) detection.frameworks.push('nuxt');
    if (deps.express) detection.frameworks.push('express');
    if (deps.nestjs || deps['@nestjs/core']) detection.frameworks.push('nestjs');
    if (deps.fastify) detection.frameworks.push('fastify');
    if (deps.vite) detection.frameworks.push('vite');
    if (deps.webpack) detection.frameworks.push('webpack');
  }

  // Check for Python
  const pythonFiles = ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'];
  for (const file of pythonFiles) {
    if (fs.existsSync(path.join(root, file))) {
      detection.hasPython = true;
      break;
    }
  }

  // Check for Go
  if (fs.existsSync(path.join(root, 'go.mod'))) {
    detection.hasGo = true;
    detection.frameworks.push('go');
  }

  // Check for Rust
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
    detection.hasRust = true;
    detection.frameworks.push('rust');
  }

  // Check for Java/Kotlin
  if (fs.existsSync(path.join(root, 'pom.xml')) || fs.existsSync(path.join(root, 'build.gradle'))) {
    detection.hasJava = true;
    detection.frameworks.push('java');
  }

  // Check for Docker
  if (fs.existsSync(path.join(root, 'Dockerfile'))) {
    detection.hasDocker = true;
  }

  // Scan for services in apps/ and packages/ directories
  for (const dir of ['apps', 'packages', 'services']) {
    const dirPath = path.join(root, dir);
    if (fs.existsSync(dirPath)) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const servicePath = path.join(dirPath, entry.name);
          const serviceType = detectServiceType(servicePath);
          if (serviceType) {
            detection.services.push({
              name: entry.name,
              path: path.join(dir, entry.name),
              type: serviceType.type,
              language: serviceType.language,
              framework: serviceType.framework,
            });
          }
        }
      }
    }
  }

  return detection;
}

/**
 * Detect service type from directory
 */
function detectServiceType(servicePath: string): any {
  const packageJsonPath = path.join(servicePath, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Detect frontend frameworks
    if (deps.react || deps.next || deps.vue || deps.angular || deps.svelte) {
      return {
        type: 'frontend',
        language: deps.typescript ? 'typescript' : 'javascript',
        framework: deps.next ? 'next' : deps.react ? 'react' : deps.vue ? 'vue' : deps.angular ? 'angular' : 'svelte',
      };
    }

    // Detect backend frameworks
    if (deps.nestjs || deps.express || deps.fastify) {
      return {
        type: 'backend',
        language: deps.typescript ? 'typescript' : 'javascript',
        framework: deps.nestjs ? 'nestjs' : deps.express ? 'express' : 'fastify',
      };
    }
  }

  // Check for Python
  if (fs.existsSync(path.join(servicePath, 'requirements.txt')) ||
      fs.existsSync(path.join(servicePath, 'app.py')) ||
      fs.existsSync(path.join(servicePath, 'main.py'))) {
    return { type: 'backend', language: 'python', framework: 'fastapi' };
  }

  return null;
}

/**
 * Run interactive setup wizard
 */
async function runSetupWizard(detection: any, skipPrompts: boolean): Promise<any> {
  if (skipPrompts) {
    return {
      name: 'my-workspace',
      version: '2.0.0',
      description: 'Auto-generated workspace',
      includeServices: detection.services.length > 0,
    };
  }

  // Ask basic questions
  const nameResponse = await prompts({
    type: 'text',
    name: 'name',
    message: 'Workspace name',
    initial: path.basename(process.cwd()),
    validate: (value: string) => value.length > 0 || 'Name is required',
  });

  if (!nameResponse.name) {
    throw new Error('Workspace name is required');
  }

  const descResponse = await prompts({
    type: 'text',
    name: 'description',
    message: 'Description (optional)',
  });

  const versionResponse = await prompts({
    type: 'select',
    name: 'version',
    message: 'Configuration version',
    choices: [
      { title: '2.0.0 (Latest)', value: '2.0.0' },
      { title: '1.0.0 (Legacy)', value: '1.0.0' },
    ],
    initial: 0,
  });

  const responses: any = {
    name: nameResponse.name,
    description: descResponse.description,
    version: versionResponse.version,
  };

  // Ask about detected services
  if (detection.services.length > 0) {
    console.log(chalk.cyan('\nDetected ' + detection.services.length + ' service(s):\n'));
    for (const service of detection.services) {
      console.log(chalk.gray('  • ' + service.name + ' (' + service.type + ', ' + service.language + ')'));
    }
    console.log();

    const includeResponse = await prompts({
      type: 'confirm',
      name: 'includeServices',
      message: 'Include detected services in workspace configuration?',
      initial: true,
    });

    responses.includeServices = includeResponse.includeServices;
  }

  // Add detected frameworks
  if (detection.frameworks.length > 0) {
    console.log(chalk.cyan('\nDetected frameworks: ' + detection.frameworks.join(', ') + '\n'));
  }

  return responses;
}

/**
 * Generate workspace configuration YAML
 */
function generateWorkspaceConfig(responses: any, detection: any): string {
  const services: any = {};

  if (responses.includeServices && detection.services.length > 0) {
    for (const service of detection.services) {
      services[service.name] = {
        name: service.name,
        type: service.type,
        language: service.language,
        framework: service.framework,
        path: service.path,
      };
    }
  }

  const config = {
    name: responses.name,
    version: responses.version,
    description: responses.description,
    services,
  };

  // Convert to YAML (simple implementation)
  let yaml = 'name: ' + config.name + '\n';
  yaml += 'version: ' + config.version + '\n';
  if (config.description) {
    yaml += 'description: ' + config.description + '\n';
  }
  yaml += '\nservices:\n';

  for (const [id, service] of Object.entries(services)) {
    const s = service as any;
    yaml += '  ' + id + ':\n';
    yaml += '    name: ' + s.name + '\n';
    yaml += '    type: ' + s.type + '\n';
    yaml += '    language: ' + s.language + '\n';
    yaml += '    framework: ' + s.framework + '\n';
    if (s.path) {
      yaml += '    path: ' + s.path + '\n';
    }
    yaml += '\n';
  }

  return yaml;
}

/**
 * Show next steps to user
 */
function showNextSteps(responses: any): void {
  console.log(chalk.cyan.bold('\nNext Steps:\n'));
  console.log(chalk.gray('  1. Review and customize re-shell.workspaces.yaml'));
  console.log(chalk.gray('  2. Add service configurations as needed'));
  console.log(chalk.gray('  3. Run: re-shell workspace validate'));
  console.log(chalk.gray('  4. Run: re-shell workspace graph --output workspace-graph.svg\n'));
}

/**
 * Validate workspace configuration
 */
export async function validateWorkspaceConfig(options: any = {}): Promise<void> {
  const { spinner, fix = false, json = false, watch = false } = options;

  try {
    console.log(chalk.cyan.bold('\n🔍 Validating Workspace Configuration\n'));

    const configPath = path.join(process.cwd(), 're-shell.workspaces.yaml');

    // Check if config exists
    if (!fs.existsSync(configPath)) {
      console.log(chalk.red('✗ No workspace configuration found'));
      console.log(chalk.gray('Expected file: re-shell.workspaces.yaml'));
      console.log(chalk.gray('\nTip: Run "re-shell workspace init" to create one\n'));
      process.exit(1);
    }

    // Watch mode for real-time validation
    if (watch) {
      return validateWatchMode(configPath, options);
    }

    if (spinner) {
      spinner.setText('Reading workspace configuration...');
    }

    // Parse and validate workspace
    const { workspaceParser } = await import('../parsers/workspace-parser');
    const { topologyValidator } = await import('../validators/topology-validator');

    const result = workspaceParser.parse(configPath);

    if (spinner) {
      spinner.stop();
    }

    if (!result.valid) {
      console.log(chalk.red('❌ Validation Failed\n'));

      // Show errors with suggestions
      if (result.errors.length > 0) {
        console.log(chalk.red.bold('Errors:\n'));
        for (const error of result.errors) {
          console.log(chalk.red('  ✗ ') + chalk.bold(error.path));
          console.log(chalk.gray('    ' + error.message));

          // Show YAML syntax error snippet if available
          if (error.value?.snippet) {
            console.log(chalk.gray('\n    Code snippet:'));
            console.log(chalk.dim('    ' + error.value.snippet.replace(/\n/g, '\n    ')));
            console.log();
          } else if (error.value !== undefined) {
            console.log(chalk.gray('    Value: ' + JSON.stringify(error.value)));
          }

          // Add actionable suggestions based on error type
          if (error.path.includes('yaml')) {
            console.log(chalk.cyan('    💡 Fix: Check YAML syntax at the indicated line'));
            console.log(chalk.gray('       Common issues:'));
            console.log(chalk.gray('       - Indentation must use spaces, not tabs'));
            console.log(chalk.gray('       - Colons (:) must be followed by a space'));
            console.log(chalk.gray('       - Strings with special characters should be quoted'));
          } else if (error.path.includes('version')) {
            console.log(chalk.cyan('    💡 Fix: Add version field to configuration'));
            console.log(chalk.gray('       Example: version: 2.0.0'));
          } else if (error.path.includes('services') || error.path.includes('name')) {
            console.log(chalk.cyan('    💡 Fix: Ensure service name is defined and uses kebab-case'));
            console.log(chalk.gray('       Example: services: { my-service: { name: my-service } }'));
          } else if (error.path.includes('type')) {
            console.log(chalk.cyan('    💡 Fix: Service type must be one of: frontend, backend, worker, function'));
          } else if (error.path.includes('framework')) {
            console.log(chalk.cyan('    💡 Fix: Specify a valid framework or remove the field'));
          } else if (error.path.includes('port')) {
            console.log(chalk.cyan('    💡 Fix: Port must be a number between 1024 and 65535'));
            console.log(chalk.gray('       Check for port conflicts: re-shell workspace health'));
          }

          console.log();
        }
      }

      console.log(chalk.yellow.bold('💡 Next Steps:\n'));
      console.log(chalk.gray('  1. Fix the errors listed above'));
      console.log(chalk.gray('  2. Run "re-shell workspace validate" again'));
      if (fix) {
        console.log(chalk.gray('  3. Or run: re-shell workspace validate --fix'));
      }
      console.log(chalk.gray('  4. Check documentation: https://re-shell.dev/docs/workspace-config\n'));

      // Show warnings
      if (result.warnings.length > 0) {
        console.log(chalk.yellow.bold('Warnings:\n'));
        for (const warning of result.warnings) {
          console.log(chalk.yellow('  ⚠ ') + chalk.bold(warning.path));
          console.log(chalk.gray('    ' + warning.message));
          console.log();
        }
      }

      // Offer to fix if fix flag is set
      if (fix && result.errors.length > 0) {
        console.log(chalk.cyan('\nAttempting automatic fixes...\n'));
        const fixed = await attemptAutoFix(result, configPath);
        if (fixed) {
          console.log(chalk.green('✓ Some issues were fixed automatically'));
          console.log(chalk.gray('Run validation again to check remaining issues\n'));
        }
      }

      process.exit(1);
    }

    // Additional topology validation
    const config = result.config;
    const topologyResult = topologyValidator.validate(config);

    // Show results
    console.log(chalk.green('✓ Workspace configuration is valid\n'));

    // Show warnings if any
    if (result.warnings.length > 0) {
      console.log(chalk.yellow.bold('Warnings:\n'));
      for (const warning of result.warnings) {
        console.log(chalk.yellow('  ⚠ ') + chalk.bold(warning.path));
        console.log(chalk.gray('    ' + warning.message));
        console.log();
      }
    }

    // Show topology results
    if (topologyResult.conflicts.length > 0) {
      console.log(chalk.yellow.bold('Topology Conflicts:\n'));
      for (const conflict of topologyResult.conflicts) {
        console.log(chalk.yellow('  ⚠ ') + chalk.bold(conflict.type));
        console.log(chalk.gray('    ' + conflict.message));
        console.log(chalk.gray('    Affected: ' + conflict.affectedServices.join(', ')));
        console.log();
      }
    }

    // Show summary
    const stats = topologyValidator.getTopologyStats(config);
    console.log(chalk.bold('Summary:\n'));
    console.log(chalk.gray('  Services: ' + stats.totalServices));
    console.log(chalk.gray('  Dependencies: ' + stats.totalDependencies));
    console.log(chalk.gray('  Layers: ' + stats.totalLayers));
    console.log(chalk.gray('  Circular Dependencies: ' + (stats.hasCircularDependencies ? 'Yes (' + stats.circularDependencies.length + ')' : 'No')));
    console.log(chalk.gray('  Isolated Services: ' + stats.isolatedServices.length));
    console.log();

    if (json) {
      console.log(chalk.bold('JSON Output:\n'));
      console.log(JSON.stringify({ validation: result, topology: topologyResult }, null, 2));
    }

  } catch (error: any) {
    if (spinner) spinner.stop();
    console.error(chalk.red('Error: ' + error.message));
    throw error;
  }
}

/**
 * Watch mode for real-time validation feedback
 */
async function validateWatchMode(configPath: string, options: any): Promise<void> {
  console.log(chalk.cyan('👀 Watching for changes...\n'));
  console.log(chalk.gray('Press Ctrl+C to stop\n'));

  const lastValidation = { valid: false, timestamp: 0 };
  let debounceTimer: NodeJS.Timeout | null = null;

  // Initial validation
  await runValidation(configPath, options);

  // Watch for file changes
  const watcher = fs.watch(configPath, async (eventType, filename) => {
    if (eventType === 'change') {
      // Debounce rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        // Clear screen for fresh output
        console.clear();
        console.log(chalk.cyan.bold('\n🔍 Validating Workspace Configuration'));
        console.log(chalk.gray(`File changed: ${new Date().toLocaleTimeString()}\n`));

        await runValidation(configPath, options);
      }, 300);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\nStopped watching\n'));
    watcher.close();
    process.exit(0);
  });
}

/**
 * Run a single validation and display results
 */
async function runValidation(configPath: string, options: any): Promise<void> {
  try {
    // Parse and validate workspace
    const { workspaceParser } = await import('../parsers/workspace-parser');
    const { topologyValidator } = await import('../validators/topology-validator');

    const result = workspaceParser.parse(configPath);

    if (!result.valid) {
      console.log(chalk.red('❌ Validation Failed\n'));

      // Show errors with syntax highlighting
      if (result.errors.length > 0) {
        console.log(chalk.red.bold('Errors:\n'));
        for (const error of result.errors) {
          // Highlight line numbers in path
          const pathMatch = error.path.match(/:(\d+):(\d+)$/);
          if (pathMatch) {
            const line = pathMatch[1];
            const col = pathMatch[2];
            const cleanPath = error.path.replace(/:\d+:\d+$/, '');
            console.log(chalk.red('  ✗ ') + chalk.bold(cleanPath));
            console.log(chalk.yellow(`    Line ${line}, Column ${col}`));
          } else {
            console.log(chalk.red('  ✗ ') + chalk.bold(error.path));
          }

          console.log(chalk.gray('    ' + error.message));

          // Show YAML syntax error snippet if available
          if (error.value?.snippet) {
            console.log(chalk.gray('\n    Code snippet:'));
            const lines = error.value.snippet.split('\n');
            for (const line of lines) {
              if (line.startsWith('>')) {
                console.log(chalk.red('    ' + line));
              } else if (line.includes('^')) {
                console.log(chalk.yellow('    ' + line));
              } else {
                console.log(chalk.gray('    ' + line));
              }
            }
            console.log();
          } else if (error.value !== undefined) {
            console.log(chalk.gray('    Value: ' + JSON.stringify(error.value)));
          }

          // YAML-specific hints
          if (error.path.includes('yaml')) {
            console.log(chalk.cyan('    💡 Fix: Check YAML syntax at the indicated line'));
            console.log(chalk.gray('       Common issues:'));
            console.log(chalk.gray('       - Indentation must use spaces, not tabs'));
            console.log(chalk.gray('       - Colons (:) must be followed by a space'));
            console.log(chalk.gray('       - Strings with special characters should be quoted'));
          }
          console.log();
        }
      }
      return;
    }

    // Valid configuration
    const config = result.config;
    const topologyResult = topologyValidator.validate(config);

    console.log(chalk.green('✓ Workspace configuration is valid\n'));

    // Show service count
    if (config.services) {
      const serviceCount = Object.keys(config.services).length;
      console.log(chalk.gray(`Services: ${serviceCount}\n`));
    }

    // Show warnings if any
    if (result.warnings.length > 0) {
      console.log(chalk.yellow.bold('Warnings:\n'));
      for (const warning of result.warnings) {
        console.log(chalk.yellow('  ⚠ ') + chalk.bold(warning.path));
        console.log(chalk.gray('    ' + warning.message));
        console.log();
      }
    }

    // Show topology results
    if (topologyResult.conflicts.length > 0) {
      console.log(chalk.yellow.bold('Topology Conflicts:\n'));
      for (const conflict of topologyResult.conflicts) {
        console.log(chalk.yellow('  ⚠ ') + chalk.bold(conflict.type));
        console.log(chalk.gray('    ' + conflict.message));
        console.log(chalk.gray('    Affected: ' + conflict.affectedServices.join(', ')));
        console.log();
      }
    }

    console.log(chalk.gray('─'.repeat(50)));
  } catch (error: any) {
    console.log(chalk.red('✗ Validation error: ' + error.message));
  }
}

/**
 * Attempt automatic fixes for common issues
 */
async function attemptAutoFix(result: any, configPath: string): Promise<boolean> {
  const fixed = false;
  const fixes: string[] = [];

  // Try to fix common issues
  for (const error of result.errors) {
    if (error.path.includes('port')) {
      fixes.push('Port conflicts: Suggest checking service ports');
    }
    if (error.path.includes('framework')) {
      fixes.push('Framework issues: Verify framework names are correct');
    }
  }

  if (fixes.length > 0) {
    console.log(chalk.cyan('Suggested fixes:\n'));
    for (const fix of fixes) {
      console.log(chalk.gray('  • ' + fix));
    }
    console.log();
  }

  return fixed;
}

/**
 * Check workspace health
 */
export async function checkWorkspaceHealth(options: any = {}): Promise<void> {
  const { spinner, json = false, verbose = false } = options;

  try {
    if (!json) {
      console.log(chalk.cyan.bold('\n🏥 Workspace Health Check\n'));
    }

    const configPath = path.join(process.cwd(), 're-shell.workspaces.yaml');

    // Check if workspace config exists
    if (!fs.existsSync(configPath)) {
      console.log(chalk.red('✗ No workspace configuration found'));
      console.log(chalk.gray('Tip: Run "re-shell workspace init" to create one\n'));
      return;
    }

    if (spinner) {
      spinner.setText('Analyzing workspace health...');
    }

    // Perform health checks
    const healthChecks = await runHealthChecks(configPath);

    if (spinner) {
      spinner.stop();
    }

    // Display results
    displayHealthResults(healthChecks, json, verbose);

    // Overall health status
    if (!json) {
      const allHealthy = healthChecks.every(check => check.status === 'healthy' || check.status === 'warning');
      if (allHealthy) {
        console.log(chalk.green('\n✓ Overall workspace health: GOOD\n'));
      } else {
        const hasCritical = healthChecks.some(check => check.status === 'critical');
        if (hasCritical) {
          console.log(chalk.red('\n✗ Overall workspace health: CRITICAL ISSUES\n'));
        } else {
          console.log(chalk.yellow('\n⚠ Overall workspace health: NEEDS ATTENTION\n'));
        }
      }
    }

  } catch (error: any) {
    if (spinner) spinner.stop();
    console.error(chalk.red('Error: ' + error.message));
    throw error;
  }
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: string[];
}

/**
 * Run all health checks
 */
async function runHealthChecks(configPath: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // Check 1: Config file health
  checks.push(await checkConfigFileHealth(configPath));

  // Check 2: Services health
  checks.push(await checkServicesHealth(configPath));

  // Check 3: Dependencies health
  checks.push(await checkDependenciesHealth(configPath));

  // Check 4: File structure health
  checks.push(await checkFileStructureHealth(configPath));

  // Check 5: Git health (if applicable)
  checks.push(await checkGitHealth(configPath));

  // Check 6: Package manager health
  checks.push(await checkPackageManagerHealth(configPath));

  return checks;
}

/**
 * Check config file health
 */
async function checkConfigFileHealth(configPath: string): Promise<HealthCheck> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const lines = content.split('\n');

    const issues: string[] = [];

    // Check for empty lines at end
    if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      issues.push('Trailing whitespace in config file');
    }

    // Check file size
    const stats = await fs.stat(configPath);
    if (stats.size === 0) {
      return {
        name: 'Config File',
        status: 'critical',
        message: 'Configuration file is empty',
        details: ['File has 0 bytes'],
      };
    }

    if (issues.length > 0) {
      return {
        name: 'Config File',
        status: 'warning',
        message: 'Minor config file issues detected',
        details: issues,
      };
    }

    return {
      name: 'Config File',
      status: 'healthy',
      message: 'Configuration file is valid',
    };
  } catch (error: any) {
    return {
      name: 'Config File',
      status: 'critical',
      message: 'Cannot read configuration file',
      details: [error.message],
    };
  }
}

/**
 * Check services health
 */
async function checkServicesHealth(configPath: string): Promise<HealthCheck> {
  try {
    const { workspaceParser } = await import('../parsers/workspace-parser');
    const result = workspaceParser.parse(configPath);

    if (!result.valid) {
      return {
        name: 'Services',
        status: 'critical',
        message: 'Service configuration has errors',
        details: result.errors.map((e: any) => e.path + ': ' + e.message),
      };
    }

    const config = result.config;
    const services = Object.keys(config.services || {});

    if (services.length === 0) {
      return {
        name: 'Services',
        status: 'warning',
        message: 'No services defined in workspace',
        details: ['Add services to make the workspace functional'],
      };
    }

    // Check service directories exist
    const missingServices: string[] = [];
    for (const serviceId of services) {
      const service = config.services[serviceId];
      if (service.path) {
        const servicePath = path.join(process.cwd(), service.path);
        if (!fs.existsSync(servicePath)) {
          missingServices.push(serviceId);
        }
      }
    }

    if (missingServices.length > 0) {
      return {
        name: 'Services',
        status: 'warning',
        message: 'Some service directories are missing',
        details: missingServices.map(s => s + ' directory not found'),
      };
    }

    return {
      name: 'Services',
      status: 'healthy',
      message: `All ${services.length} service(s) are configured`,
    };
  } catch (error: any) {
    return {
      name: 'Services',
      status: 'critical',
      message: 'Cannot validate services',
      details: [error.message],
    };
  }
}

/**
 * Check dependencies health
 */
async function checkDependenciesHealth(configPath: string): Promise<HealthCheck> {
  try {
    const { dependencyGraphEngine } = await import('../graph/dependency-graph-engine');
    const { workspaceParser } = await import('../parsers/workspace-parser');

    const result = workspaceParser.parse(configPath);
    if (!result.valid) {
      return {
        name: 'Dependencies',
        status: 'warning',
        message: 'Cannot check dependencies due to config errors',
      };
    }

    const graph = dependencyGraphEngine.buildFromConfig(result.config);
    const cycles = dependencyGraphEngine.detectCycles();

    if (cycles.length > 0) {
      return {
        name: 'Dependencies',
        status: 'critical',
        message: 'Circular dependencies detected',
        details: cycles.map(c => c.join(' -> ')),
      };
    }

    const nodes = graph.nodes.size;
    const edges = Array.from(graph.edges.values()).reduce((sum, set) => sum + set.size, 0);

    if (nodes === 0) {
      return {
        name: 'Dependencies',
        status: 'warning',
        message: 'No dependency relationships found',
        details: ['Services have no dependencies defined'],
      };
    }

    return {
      name: 'Dependencies',
      status: 'healthy',
      message: `${edges} dependency relationship(s) across ${nodes} service(s)`,
    };
  } catch (error: any) {
    return {
      name: 'Dependencies',
      status: 'warning',
      message: 'Cannot check dependencies',
      details: [error.message],
    };
  }
}

/**
 * Check file structure health
 */
async function checkFileStructureHealth(configPath: string): Promise<HealthCheck> {
  const issues: string[] = [];
  const root = path.dirname(configPath);

  // Check for common workspace files
  const expectedFiles = ['package.json', 'README.md'];
  const missingFiles: string[] = [];

  for (const file of expectedFiles) {
    if (!fs.existsSync(path.join(root, file))) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    issues.push('Missing recommended files: ' + missingFiles.join(', '));
  }

  // Check for .git directory
  if (!fs.existsSync(path.join(root, '.git'))) {
    issues.push('Not a Git repository (version control recommended)');
  }

  if (issues.length > 0) {
    return {
      name: 'File Structure',
      status: 'warning',
      message: 'Workspace structure could be improved',
      details: issues,
    };
  }

  return {
    name: 'File Structure',
    status: 'healthy',
    message: 'Workspace structure is good',
  };
}

/**
 * Check Git health
 */
async function checkGitHealth(configPath: string): Promise<HealthCheck> {
  try {
    const root = path.dirname(configPath);

    // Check if .git exists
    if (!fs.existsSync(path.join(root, '.git'))) {
      return {
        name: 'Git',
        status: 'warning',
        message: 'Not a Git repository',
        details: ['Initialize Git for version control'],
      };
    }

    // Check git status
    try {
      execSync('git status --porcelain', { cwd: root, stdio: 'ignore' });
      return {
        name: 'Git',
        status: 'healthy',
        message: 'Git repository is initialized',
      };
    } catch {
      return {
        name: 'Git',
        status: 'warning',
        message: 'Git repository needs attention',
        details: ['Run git status to check repository state'],
      };
    }
  } catch {
    return {
      name: 'Git',
      status: 'warning',
      message: 'Git health check skipped',
      details: ['Git not available'],
    };
  }
}

/**
 * Check package manager health
 */
async function checkPackageManagerHealth(configPath: string): Promise<HealthCheck> {
  const root = path.dirname(configPath);
  const lockFiles = [
    { name: 'pnpm', file: 'pnpm-lock.yaml' },
    { name: 'yarn', file: 'yarn.lock' },
    { name: 'npm', file: 'package-lock.json' },
  ];

  const detectedManagers: string[] = [];

  for (const manager of lockFiles) {
    if (fs.existsSync(path.join(root, manager.file))) {
      detectedManagers.push(manager.name);
    }
  }

  if (detectedManagers.length === 0) {
    return {
      name: 'Package Manager',
      status: 'warning',
      message: 'No package manager lock file detected',
      details: ['Run package install to generate lock file'],
    };
  }

  if (detectedManagers.length > 1) {
    return {
      name: 'Package Manager',
      status: 'warning',
      message: 'Multiple package managers detected',
      details: ['Detected: ' + detectedManagers.join(' ')],
    };
  }

  return {
    name: 'Package Manager',
    status: 'healthy',
    message: `Using ${detectedManagers[0]}`,
  };
}

/**
 * Display health results
 */
function displayHealthResults(checks: HealthCheck[], json: boolean, verbose: boolean): void {
  if (json) {
    console.log(JSON.stringify(checks, null, 2));
    return;
  }

  for (const check of checks) {
    let icon = chalk.green('✓');
    const label = check.name;

    if (check.status === 'warning') {
      icon = chalk.yellow('⚠');
    } else if (check.status === 'critical') {
      icon = chalk.red('✗');
    }

    console.log(icon + ' ' + chalk.bold(label) + ': ' + check.message);

    if (verbose && check.details) {
      for (const detail of check.details) {
        console.log(chalk.gray('  • ' + detail));
      }
    }
  }

  if (!verbose) {
    console.log(chalk.gray('\nTip: Use --verbose for more details'));
  }
}

/**
 * Migrate workspace configuration
 */
export async function migrateWorkspace(options: any = {}): Promise<void> {
  const { spinner, from, to, dryRun = false, backup = true } = options;

  try {
    console.log(chalk.cyan.bold('\n🔄 Workspace Migration\n'));

    const configPath = path.join(process.cwd(), 're-shell.workspaces.yaml');

    // Check if workspace config exists
    if (!fs.existsSync(configPath)) {
      console.log(chalk.red('✗ No workspace configuration found'));
      console.log(chalk.gray('Tip: Run "re-shell workspace init" to create one\n'));
      return;
    }

    if (spinner) {
      spinner.setText('Analyzing workspace configuration...');
    }

    // Parse current config - for old versions, parse without validation
    let currentConfig: any;
    let currentVersion: string;

    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      currentConfig = yaml.load(configContent);

      // Get version from config or default to 1.0.0
      currentVersion = currentConfig.version || '1.0.0';

      // For 2.0.0+, validate the config
      if (currentVersion !== '1.0.0') {
        const { workspaceParser } = await import('../parsers/workspace-parser');
        const result = workspaceParser.parse(configPath);

        if (!result.valid) {
          if (spinner) spinner.stop();
          console.log(chalk.red('✗ Cannot migrate: Configuration has errors'));
          console.log(chalk.gray('Run "re-shell workspace validate" first\n'));
          return;
        }

        currentConfig = result.config;
      }
    } catch (error: any) {
      if (spinner) spinner.stop();
      console.log(chalk.red('✗ Failed to parse configuration'));
      console.log(chalk.gray('Error: ' + error.message + '\n'));
      return;
    }

    const targetVersion = to || '2.0.0';

    console.log(chalk.gray('Current version: ' + currentVersion));
    console.log(chalk.gray('Target version: ' + targetVersion + '\n'));

    // Check if migration is needed
    if (currentVersion === targetVersion) {
      console.log(chalk.green('✓ Already at target version'));
      return;
    }

    // Create backup if requested
    if (backup) {
      if (spinner) spinner.setText('Creating backup...');
      await createBackup(configPath);
      console.log(chalk.green('✓ Backup created\n'));
    }

    // Perform migration
    if (spinner) spinner.setText('Migrating configuration...');

    const migrationResult = await performMigration(currentConfig, currentVersion, targetVersion, dryRun);

    if (spinner) spinner.stop();

    if (dryRun) {
      console.log(chalk.yellow.bold('\n[DRY RUN] Migration Preview:\n'));
      console.log(chalk.gray('Would apply the following changes:\n'));
      for (const change of migrationResult.changes) {
        console.log(chalk.gray('  • ' + change));
      }
      console.log();
      return;
    }

    // Write migrated config
    await fs.writeFile(configPath, migrationResult.config);

    console.log(chalk.green('✓ Migration completed successfully\n'));

    // Show migration summary
    console.log(chalk.bold('Summary:\n'));
    console.log(chalk.gray('  Changes applied: ' + migrationResult.changes.length));
    console.log(chalk.gray('  Warnings: ' + migrationResult.warnings.length));
    if (migrationResult.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:\n'));
      for (const warning of migrationResult.warnings) {
        console.log(chalk.yellow('  ⚠ ' + warning));
      }
    }
    console.log();

  } catch (error: any) {
    if (spinner) spinner.stop();
    console.error(chalk.red('Error: ' + error.message));
    throw error;
  }
}

/**
 * Create backup before migration
 */
async function createBackup(configPath: string): Promise<void> {
  const backupPath = configPath + '.backup-' + Date.now();
  await fs.copy(configPath, backupPath);
  console.log(chalk.gray('Backup: ' + backupPath));
}

/**
 * Perform migration from one version to another
 */
async function performMigration(
  config: any,
  fromVersion: string,
  toVersion: string,
  dryRun: boolean
): Promise<{ config: string; changes: string[]; warnings: string[] }> {
  const changes: string[] = [];
  const warnings: string[] = [];

  const migratedConfig = { ...config };

  // Migration: 1.0.0 to 2.0.0
  if (fromVersion === '1.0.0' && toVersion === '2.0.0') {
    changes.push('Upgrade to workspace config v2.0.0 schema');

    // Convert old "workspaces" array to new "services" object
    if (migratedConfig.workspaces && Array.isArray(migratedConfig.workspaces)) {
      const oldWorkspaces = migratedConfig.workspaces;
      migratedConfig.services = {};

      for (const ws of oldWorkspaces) {
        const serviceId = ws.name || 'service-' + Math.random().toString(36).substring(7);
        migratedConfig.services[serviceId] = {
          name: ws.name || serviceId,
          displayName: ws.displayName,
          description: ws.description,
          port: ws.port,
          framework: ws.framework,
          path: ws.path,
        };

        // Infer type from framework
        if (ws.framework && ['react', 'vue', 'angular', 'svelte'].includes(ws.framework)) {
          migratedConfig.services[serviceId].type = 'frontend';
        } else if (ws.framework) {
          migratedConfig.services[serviceId].type = 'backend';
        } else {
          migratedConfig.services[serviceId].type = 'service';
        }

        // Add default language
        migratedConfig.services[serviceId].language = 'typescript';

        changes.push('Converted workspace "' + serviceId + '" to service format');
        warnings.push('Verify language and type for service: ' + serviceId);
      }

      delete migratedConfig.workspaces;
      changes.push('Converted workspaces array to services object');
    }

    // Add missing required fields
    if (!migratedConfig.name) {
      migratedConfig.name = 'workspace';
      changes.push('Added workspace name (default: "workspace")');
      warnings.push('Update workspace name with actual name');
    }

    // Always update version to target
    migratedConfig.version = '2.0.0';
    changes.push('Updated version to 2.0.0');

    // Update service structure
    if (migratedConfig.services) {
      for (const [serviceId, service] of Object.entries(migratedConfig.services)) {
        const s = service as any;

        // Ensure type field exists
        if (!s.type) {
          // Try to infer type from framework
          if (s.framework && ['react', 'vue', 'angular', 'svelte'].includes(s.framework)) {
            s.type = 'frontend';
          } else if (s.framework) {
            s.type = 'backend';
          } else {
            s.type = 'service';
          }
          changes.push('Set type for service: ' + serviceId);
        }

        // Ensure language field exists
        if (!s.language) {
          s.language = 'typescript';
          changes.push('Added language to service: ' + serviceId);
          warnings.push('Verify language for service: ' + serviceId);
        }
      }
    }

    // Remove deprecated fields
    const deprecatedFields = ['deprecated', 'legacy'];
    for (const field of deprecatedFields) {
      if (migratedConfig[field]) {
        delete migratedConfig[field];
        changes.push('Removed deprecated field: ' + field);
      }
    }
  }

  // Convert to YAML
  let yaml = 'name: ' + migratedConfig.name + '\n';
  yaml += 'version: ' + migratedConfig.version + '\n';

  if (migratedConfig.description) {
    yaml += 'description: ' + migratedConfig.description + '\n';
  }

  if (migratedConfig.metadata) {
    yaml += 'metadata:\n';
    for (const [key, value] of Object.entries(migratedConfig.metadata)) {
      yaml += '  ' + key + ': ' + JSON.stringify(value) + '\n';
    }
  }

  if (migratedConfig.variables) {
    yaml += 'variables:\n';
    for (const [key, value] of Object.entries(migratedConfig.variables)) {
      yaml += '  ' + key + ': ' + JSON.stringify(value) + '\n';
    }
  }

  yaml += '\nservices:\n';

  if (migratedConfig.services) {
    for (const [id, service] of Object.entries(migratedConfig.services)) {
      const s = service as any;
      yaml += '  ' + id + ':\n';
      yaml += '    name: ' + s.name + '\n';

      if (s.displayName) {
        yaml += '    displayName: ' + s.displayName + '\n';
      }

      if (s.description) {
        yaml += '    description: ' + s.description + '\n';
      }

      if (s.type) {
        yaml += '    type: ' + s.type + '\n';
      }

      yaml += '    language: ' + s.language + '\n';

      if (typeof s.framework === 'string') {
        yaml += '    framework: ' + s.framework + '\n';
      } else if (typeof s.framework === 'object') {
        yaml += '    framework:\n';
        yaml += '      name: ' + s.framework.name + '\n';
        if (s.framework.version) {
          yaml += '      version: ' + s.framework.version + '\n';
        }
        if (s.framework.config) {
          yaml += '      config: ' + JSON.stringify(s.framework.config) + '\n';
        }
      }

      if (s.path) {
        yaml += '    path: ' + s.path + '\n';
      }

      if (s.port) {
        yaml += '    port: ' + s.port + '\n';
      }

      if (s.env && Object.keys(s.env).length > 0) {
        yaml += '    env:\n';
        for (const [key, value] of Object.entries(s.env)) {
          yaml += '      ' + key + ': ' + JSON.stringify(value) + '\n';
        }
      }

      if (s.dependencies) {
        if (s.dependencies.production && Object.keys(s.dependencies.production).length > 0) {
          yaml += '    dependencies:\n';
          yaml += '      production:\n';
          for (const [dep, version] of Object.entries(s.dependencies.production)) {
            yaml += '        ' + dep + ': ' + JSON.stringify(version) + '\n';
          }
        }
      }

      if (s.routes && s.routes.length > 0) {
        yaml += '    routes:\n';
        for (const route of s.routes) {
          yaml += '      - path: ' + route.path + '\n';
          if (route.method) yaml += '        method: ' + route.method + '\n';
          if (route.target) yaml += '        target: ' + route.target + '\n';
        }
      }

      yaml += '\n';
    }
  }

  if (migratedConfig.dependencies) {
    yaml += 'dependencies:\n';
    
    if (migratedConfig.dependencies.databases && migratedConfig.dependencies.databases.length > 0) {
      yaml += '  databases:\n';
      for (const db of migratedConfig.dependencies.databases) {
        yaml += '    - name: ' + db.name + '\n';
        if (db.type) yaml += '      type: ' + db.type + '\n';
        if (db.version) yaml += '      version: ' + db.version + '\n';
      }
    }

    if (migratedConfig.dependencies.caches && migratedConfig.dependencies.caches.length > 0) {
      yaml += '  caches:\n';
      for (const cache of migratedConfig.dependencies.caches) {
        yaml += '    - name: ' + cache.name + '\n';
        if (cache.type) yaml += '      type: ' + cache.type + '\n';
      }
    }
  }

  return { config: yaml, changes, warnings };
}

/**
 * Optimize workspace configuration
 */
export async function optimizeWorkspace(options: any = {}): Promise<void> {
  const { spinner, type, severity, fix = false, json = false, verbose = false } = options;

  try {
    if (!json) {
      console.log(chalk.cyan.bold('\n⚡ Workspace Optimization\n'));
    }

    const configPath = path.join(process.cwd(), 're-shell.workspaces.yaml');

    // Check if workspace config exists
    if (!fs.existsSync(configPath)) {
      console.log(chalk.red('✗ No workspace configuration found'));
      console.log(chalk.gray('Tip: Run "re-shell workspace init" to create one\n'));
      return;
    }

    if (spinner) {
      spinner.setText('Analyzing workspace configuration...');
    }

    // Parse current config
    const { workspaceParser } = await import('../parsers/workspace-parser');
    const result = workspaceParser.parse(configPath);

    if (!result.valid) {
      if (spinner) spinner.stop();
      console.log(chalk.red('✗ Cannot optimize: Configuration has errors'));
      console.log(chalk.gray('Run "re-shell workspace validate" first\n'));
      return;
    }

    // Run optimization analysis
    const { workspaceOptimizer } = await import('../optimization/workspace-optimizer');
    const report = workspaceOptimizer.analyze(result.config);

    if (spinner) spinner.stop();

    // Filter recommendations by type/severity if specified
    let filteredRecs = report.recommendations;
    if (type) {
      filteredRecs = filteredRecs.filter(r => r.type === type);
    }
    if (severity) {
      filteredRecs = filteredRecs.filter(r => r.severity === severity);
    }

    // Create filtered report
    const filteredReport: any = {
      recommendations: filteredRecs,
      summary: {
        total: filteredRecs.length,
        critical: filteredRecs.filter(r => r.severity === 'critical').length,
        high: filteredRecs.filter(r => r.severity === 'high').length,
        medium: filteredRecs.filter(r => r.severity === 'medium').length,
        low: filteredRecs.filter(r => r.severity === 'low').length,
        byType: {} as Record<string, number>,
      },
      estimatedImpact: report.estimatedImpact,
    };

    // Calculate byType for filtered results
    for (const rec of filteredRecs) {
      filteredReport.summary.byType[rec.type] = (filteredReport.summary.byType[rec.type] || 0) + 1;
    }

    // Output JSON if requested
    if (json) {
      console.log(JSON.stringify(filteredReport, null, 2));
      return;
    }

    // Display summary
    console.log(chalk.bold('Analysis Summary:\n'));
    if (type || severity) {
      console.log(chalk.gray('  Filtered recommendations: ' + filteredReport.summary.total + ' of ' + report.summary.total));
      console.log(chalk.red('  Critical: ' + filteredReport.summary.critical));
      console.log(chalk.yellow('  High: ' + filteredReport.summary.high));
      console.log(chalk.yellow('  Medium: ' + filteredReport.summary.medium));
      console.log(chalk.gray('  Low: ' + filteredReport.summary.low));
      if (type) console.log(chalk.gray('  Type filter: ' + type));
      if (severity) console.log(chalk.gray('  Severity filter: ' + severity));
    } else {
      console.log(chalk.gray('  Total recommendations: ' + report.summary.total));
      console.log(chalk.red('  Critical: ' + report.summary.critical));
      console.log(chalk.yellow('  High: ' + report.summary.high));
      console.log(chalk.yellow('  Medium: ' + report.summary.medium));
      console.log(chalk.gray('  Low: ' + report.summary.low));
    }
    console.log();

    // Display estimated impact (show full for unfiltered, filtered message when filtered)
    console.log(chalk.bold('Estimated Impact:\n'));
    if (type || severity) {
      console.log(chalk.gray('  (Based on filtered recommendations only)\n'));
    }
    console.log(chalk.gray('  Performance: ' + filteredReport.estimatedImpact.performance));
    console.log(chalk.gray('  Maintainability: ' + filteredReport.estimatedImpact.maintainability));
    console.log(chalk.gray('  Scalability: ' + filteredReport.estimatedImpact.scalability));
    console.log();

    if (filteredRecs.length === 0) {
      console.log(chalk.green('✓ No optimization recommendations found\n'));
      return;
    }

    // Group recommendations by severity
    const bySeverity: Record<string, typeof filteredRecs> = {
      critical: filteredRecs.filter(r => r.severity === 'critical'),
      high: filteredRecs.filter(r => r.severity === 'high'),
      medium: filteredRecs.filter(r => r.severity === 'medium'),
      low: filteredRecs.filter(r => r.severity === 'low'),
    };

    // Display recommendations
    for (const [sev, recs] of Object.entries(bySeverity)) {
      if (recs.length === 0) continue;

      const color = sev === 'critical' ? chalk.red : sev === 'high' ? chalk.yellow : chalk.gray;
      console.log(color.bold(`${sev.toUpperCase()} Priority:\n`));

      for (const rec of recs) {
        const icon = sev === 'critical' ? '🔴' : sev === 'high' ? '🟡' : '⚪';
        console.log(color(`  ${icon} ${rec.title}`));

        if (verbose || rec.severity !== 'low') {
          console.log(chalk.gray('     ' + rec.description));
          console.log(chalk.gray('     Impact: ' + rec.impact));
          console.log(chalk.gray('     Effort: ' + rec.effort));

          if (rec.automatedFix) {
            console.log(chalk.cyan('     ✨ Automated fix available:'));
            console.log(chalk.cyan('        ' + rec.automatedFix.command));
            console.log(chalk.cyan('        ' + rec.automatedFix.description));
          }

          if (rec.manualFix) {
            console.log(chalk.gray('     📋 Manual steps:'));
            for (const step of rec.manualFix.steps) {
              console.log(chalk.gray('        - ' + step));
            }
          }
        }
        console.log();
      }
    }

    // Apply fixes if requested
    if (fix) {
      const automatedRecs = filteredRecs.filter(r => r.automatedFix);
      if (automatedRecs.length === 0) {
        console.log(chalk.yellow('No automated fixes available\n'));
        return;
      }

      console.log(chalk.yellow.bold('\n⚠ Applying automated fixes...\n'));

      // Note: In a full implementation, this would apply the actual fixes
      for (const rec of automatedRecs) {
        console.log(chalk.gray('  • ' + rec.title));
        console.log(chalk.gray('    Command: ' + rec.automatedFix!.command));
      }

      console.log(chalk.yellow('\n  Note: Automated fix commands are displayed above.'));
      console.log(chalk.yellow('  Run them manually to apply the fixes.\n'));
    } else {
      const automatedRecs = filteredRecs.filter(r => r.automatedFix);
      if (automatedRecs.length > 0) {
        console.log(chalk.cyan.bold('💡 Automated Fixes Available:\n'));
        console.log(chalk.cyan('  Run with --fix to apply ' + automatedRecs.length + ' automated fix(es)\n'));
      }
    }

  } catch (error: any) {
    if (spinner) spinner.stop();
    console.error(chalk.red('Error: ' + error.message));
    throw error;
  }
}

/**
 * Template management subcommands
 */
export async function manageWorkspaceTemplates(options: any = {}): Promise<void> {
  const { spinner, action = 'list', templateId, filePath, output } = options;

  try {
    const templatesDir = path.join(process.cwd(), '.re-shell', 'templates');

    switch (action) {
      case 'list':
        await listTemplates(templatesDir, spinner);
        break;
      case 'show':
        await showTemplate(templatesDir, templateId, spinner);
        break;
      case 'create':
        await createTemplateInteractively(templatesDir, spinner);
        break;
      case 'validate':
        await validateTemplate(templatesDir, templateId, spinner);
        break;
      case 'export':
        await exportTemplateCmd(templatesDir, templateId, output, spinner);
        break;
      case 'import':
        await importTemplateCmd(filePath, templatesDir, spinner);
        break;
      case 'delete':
        await deleteTemplateCmd(templatesDir, templateId, spinner);
        break;
      case 'chain':
        await showInheritanceChain(templatesDir, templateId, spinner);
        break;
      default:
        console.log(chalk.red('✗ Unknown action: ' + action));
        console.log(chalk.gray('Valid actions: list, show, create, validate, export, import, delete, chain\n'));
    }
  } catch (error: any) {
    if (spinner) spinner.stop();
    console.error(chalk.red('Error: ' + error.message));
    throw error;
  }
}

/**
 * List all templates
 */
async function listTemplates(templatesDir: string, spinner?: any): Promise<void> {
  console.log(chalk.cyan.bold('\n📋 Workspace Templates\n'));

  if (spinner) spinner.setText('Loading templates...');

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');

  if (!fs.existsSync(templatesDir)) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('No templates directory found'));
    console.log(chalk.gray('Templates directory: ' + templatesDir));
    console.log(chalk.gray('Create a template with: re-shell workspace template create\n'));
    return;
  }

  const templates = workspaceTemplateManager.listTemplates();

  if (spinner) spinner.stop();

  if (templates.length === 0) {
    console.log(chalk.yellow('No templates found\n'));
    console.log(chalk.gray('Create a template with: re-shell workspace template create\n'));
    return;
  }

  console.log(chalk.bold('Found ' + templates.length + ' template(s):\n'));

  for (const template of templates) {
    console.log(chalk.cyan('  • ' + template.id));
    console.log(chalk.gray('      Name: ' + template.name));
    if (template.description) {
      console.log(chalk.gray('      Description: ' + template.description));
    }
    console.log(chalk.gray('      Version: ' + template.version));

    if (template.extends && template.extends.length > 0) {
      console.log(chalk.gray('      Extends: ' + template.extends.join(', ')));
    }

    if (template.variables && template.variables.length > 0) {
      const varList = template.variables.map(v => v.name + (v.required ? '*' : '')).join(', ');
      console.log(chalk.gray('      Variables: ' + varList));
    }

    console.log();
  }
}

/**
 * Show template details
 */
async function showTemplate(templatesDir: string, templateId: string, spinner?: any): Promise<void> {
  if (!templateId) {
    console.log(chalk.red('✗ Template ID is required'));
    console.log(chalk.gray('Usage: re-shell workspace template show --id <template-id>\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n📄 Template Details: ' + templateId + '\n'));

  if (spinner) spinner.setText('Loading template...');

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');
  const template = workspaceTemplateManager.getTemplate(templateId);

  if (spinner) spinner.stop();

  if (!template) {
    console.log(chalk.red('✗ Template not found: ' + templateId + '\n'));
    return;
  }

  console.log(chalk.bold('ID: ') + chalk.gray(template.id));
  console.log(chalk.bold('Name: ') + chalk.gray(template.name));
  console.log(chalk.bold('Version: ') + chalk.gray(template.version));

  if (template.description) {
    console.log(chalk.bold('Description: ') + chalk.gray(template.description));
  }

  if (template.extends && template.extends.length > 0) {
    console.log(chalk.bold('\nExtends:'));
    for (const parentId of template.extends) {
      console.log(chalk.gray('  • ' + parentId));
    }
  }

  if (template.variables && template.variables.length > 0) {
    console.log(chalk.bold('\nVariables:'));
    for (const v of template.variables) {
      const required = v.required ? chalk.red(' *') : '';
      console.log(chalk.gray('  • ' + v.name + ': ' + v.type + required));
      if (v.description) {
        console.log(chalk.gray('      ' + v.description));
      }
      if (v.default !== undefined) {
        console.log(chalk.gray('      Default: ' + JSON.stringify(v.default)));
      }
    }
  }

  if (template.validations && template.validations.length > 0) {
    console.log(chalk.bold('\nValidations:'));
    for (const v of template.validations) {
      console.log(chalk.gray('  • ' + v.field + ': ' + v.type));
      console.log(chalk.gray('      ' + v.message));
    }
  }

  console.log(chalk.bold('\nConfig Preview:'));
  console.log(chalk.gray(JSON.stringify(template.config, null, 2).split('\n').map(line => '  ' + line).join('\n')));
  console.log();
}

/**
 * Create template interactively
 */
async function createTemplateInteractively(templatesDir: string, spinner?: any): Promise<void> {
  console.log(chalk.cyan.bold('\n📝 Create New Template\n'));

  if (spinner) spinner.stop();

  const responses = await prompts([
    {
      type: 'text',
      name: 'id',
      message: 'Template ID (kebab-case)',
      validate: (value: string) => value ? true : 'Template ID is required',
    },
    {
      type: 'text',
      name: 'name',
      message: 'Template name',
      validate: (value: string) => value ? true : 'Template name is required',
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description (optional)',
    },
    {
      type: 'text',
      name: 'version',
      message: 'Version',
      initial: '1.0.0',
    },
  ]);

  if (!responses.id) {
    console.log(chalk.gray('\nTemplate creation cancelled\n'));
    return;
  }

  if (spinner) spinner.start();

  // Create templates directory
  await fs.ensureDir(templatesDir);

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');

  const newTemplate = {
    id: responses.id,
    name: responses.name,
    description: responses.description,
    version: responses.version,
    config: {},
  };

  await workspaceTemplateManager.createTemplate(newTemplate);

  if (spinner) spinner.stop();

  console.log(chalk.green('\n✓ Template created successfully!'));
  console.log(chalk.gray('ID: ' + responses.id));
  console.log(chalk.gray('Path: ' + path.join(templatesDir, responses.id + '.template.json')));
  console.log();
}

/**
 * Validate template
 */
async function validateTemplate(templatesDir: string, templateId: string, spinner?: any): Promise<void> {
  if (!templateId) {
    console.log(chalk.red('✗ Template ID is required'));
    console.log(chalk.gray('Usage: re-shell workspace template validate --id <template-id>\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n✔️  Validating Template: ' + templateId + '\n'));

  if (spinner) spinner.setText('Validating template...');

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');
  const template = workspaceTemplateManager.getTemplate(templateId);

  if (spinner) spinner.stop();

  if (!template) {
    console.log(chalk.red('✗ Template not found: ' + templateId + '\n'));
    return;
  }

  const validation = workspaceTemplateManager.validateTemplate(template);

  if (validation.valid) {
    console.log(chalk.green('✓ Template is valid\n'));
  } else {
    console.log(chalk.red('✗ Template has errors:\n'));
    for (const error of validation.errors) {
      console.log(chalk.red('  • ' + error));
    }
    console.log();
  }
}

/**
 * Export template
 */
async function exportTemplateCmd(templatesDir: string, templateId: string, outputPath: string, spinner?: any): Promise<void> {
  if (!templateId) {
    console.log(chalk.red('✗ Template ID is required'));
    console.log(chalk.gray('Usage: re-shell workspace template export --id <template-id> --output <path>\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n📤 Exporting Template: ' + templateId + '\n'));

  if (spinner) spinner.setText('Exporting template...');

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');

  const output = outputPath || path.join(process.cwd(), templateId + '.template.json');

  await workspaceTemplateManager.exportTemplate(templateId, output);

  if (spinner) spinner.stop();

  console.log(chalk.green('✓ Template exported successfully!'));
  console.log(chalk.gray('Output: ' + output));
  console.log();
}

/**
 * Import template
 */
async function importTemplateCmd(filePath: string, templatesDir: string, spinner?: any): Promise<void> {
  if (!filePath) {
    console.log(chalk.red('✗ File path is required'));
    console.log(chalk.gray('Usage: re-shell workspace template import --file <path>\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n📥 Importing Template\n'));

  if (spinner) spinner.setText('Importing template...');

  // Create templates directory
  await fs.ensureDir(templatesDir);

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');

  const template = await workspaceTemplateManager.importTemplate(filePath);

  if (spinner) spinner.stop();

  console.log(chalk.green('✓ Template imported successfully!'));
  console.log(chalk.gray('ID: ' + template.id));
  console.log(chalk.gray('Name: ' + template.name));
  console.log();
}

/**
 * Delete template
 */
async function deleteTemplateCmd(templatesDir: string, templateId: string, spinner?: any): Promise<void> {
  if (!templateId) {
    console.log(chalk.red('✗ Template ID is required'));
    console.log(chalk.gray('Usage: re-shell workspace template delete --id <template-id>\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n🗑️  Deleting Template: ' + templateId + '\n'));

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');
  const template = workspaceTemplateManager.getTemplate(templateId);

  if (!template) {
    console.log(chalk.red('✗ Template not found: ' + templateId + '\n'));
    return;
  }

  if (spinner) spinner.stop();

  const confirm = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Are you sure you want to delete this template?',
    initial: false,
  });

  if (!confirm.value) {
    console.log(chalk.gray('\nTemplate deletion cancelled\n'));
    return;
  }

  if (spinner) spinner.start();

  await workspaceTemplateManager.deleteTemplate(templateId);

  if (spinner) spinner.stop();

  console.log(chalk.green('✓ Template deleted successfully\n'));
}

/**
 * Show inheritance chain
 */
async function showInheritanceChain(templatesDir: string, templateId: string, spinner?: any): Promise<void> {
  if (!templateId) {
    console.log(chalk.red('✗ Template ID is required'));
    console.log(chalk.gray('Usage: re-shell workspace template chain --id <template-id>\n'));
    return;
  }

  console.log(chalk.cyan.bold('\n🔗 Template Inheritance Chain: ' + templateId + '\n'));

  if (spinner) spinner.setText('Building inheritance chain...');

  const { workspaceTemplateManager } = await import('../templates/workspace/workspace-templates');
  const chain = workspaceTemplateManager.getInheritanceChain(templateId);

  if (spinner) spinner.stop();

  if (chain.length === 0) {
    console.log(chalk.red('✗ Template not found: ' + templateId + '\n'));
    return;
  }

  for (let i = 0; i < chain.length; i++) {
    const template = chain[i];
    const indent = '  '.repeat(i);
    const isLast = i === chain.length - 1;
    const prefix = isLast ? '└─ ' : '├─ ';

    console.log(chalk.gray(indent + prefix + chalk.cyan(template.id) + ' (' + template.name + ')'));

    if (template.extends && template.extends.length > 0 && i < chain.length - 1) {
      console.log(chalk.gray(indent + '  │  Extends: ' + template.extends.join(', ')));
    }
  }

  console.log();
}
