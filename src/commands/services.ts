// Services Management Commands
// Provides intelligent service management with dependency resolution

import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, execSync, ChildProcess } from 'child_process';
import chalk from 'chalk';
import { glob } from 'glob';

/**
 * Service configuration from docker-compose.yml
 */
export interface ServiceConfig {
  name: string;
  image?: string;
  build?: string;
  ports?: string[];
  port?: number; // For single port services from npm scripts
  depends_on?: string[];
  environment?: Record<string, string>;
  command?: string;
  working_dir?: string;
  volumes?: string[];
  networks?: string[];
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
  };
}

/**
 * Process information for running services
 */
export interface RunningService {
  name: string;
  pid: number;
  port?: number;
  command: string;
  startTime: Date;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  logFile: string;
  process?: ChildProcess;
}

/**
 * Service dependency graph
 */
export interface ServiceDependencyGraph {
  nodes: Map<string, ServiceConfig>;
  dependencies: Map<string, string[]>;
  levels: string[][]; // Services grouped by startup level
}

/**
 * Options for services up command
 */
export interface ServicesUpOptions {
  detached?: boolean;
  build?: boolean;
  forceRecreate?: boolean;
  noDeps?: boolean;
  scale?: Record<string, number>;
  timeout?: number;
  verbose?: boolean;
  spinner?: any;
}

/**
 * Options for services down command
 */
export interface ServicesDownOptions {
  volumes?: boolean;
  removeOrphans?: boolean;
  timeout?: number;
  verbose?: boolean;
  spinner?: any;
}

/**
 * Options for services health command
 */
export interface ServicesHealthOptions {
  watch?: boolean;
  interval?: number;
  json?: boolean;
  verbose?: boolean;
  spinner?: any;
}

/**
 * Parse docker-compose.yml to extract service configurations
 */
export async function parseDockerCompose(projectPath: string): Promise<ServiceConfig[]> {
  const composeFiles = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'docker-compose.dev.yml',
  ];

  for (const file of composeFiles) {
    const filePath = path.join(projectPath, file);
    try {
      await fs.access(filePath);
      return await parseComposeFile(filePath);
    } catch {
      // File doesn't exist, try next
    }
  }

  // No docker-compose file found, try to detect services from package.json
  return await detectServicesFromPackageJson(projectPath);
}

/**
 * Parse docker-compose YAML file
 */
async function parseComposeFile(filePath: string): Promise<ServiceConfig[]> {
  const yaml = (await import('js-yaml')).default;
  const content = await fs.readFile(filePath, 'utf-8');
  const compose: any = yaml.load(content);

  const services: ServiceConfig[] = [];

  if (compose.services) {
    for (const [name, config] of Object.entries(compose.services)) {
      const serviceConfig = config as any;
      services.push({
        name,
        image: serviceConfig.image,
        build: typeof serviceConfig.build === 'string' ? serviceConfig.build : serviceConfig.build?.context,
        ports: serviceConfig.ports,
        depends_on: serviceConfig.depends_on ? Object.keys(serviceConfig.depends_on) : [],
        environment: serviceConfig.environment,
        command: serviceConfig.command,
        working_dir: serviceConfig.working_dir,
        volumes: serviceConfig.volumes,
        networks: serviceConfig.networks,
        healthcheck: serviceConfig.healthcheck,
      });
    }
  }

  return services;
}

/**
 * Detect services from package.json scripts
 */
async function detectServicesFromPackageJson(projectPath: string): Promise<ServiceConfig[]> {
  const pkgPath = path.join(projectPath, 'package.json');

  try {
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    const services: ServiceConfig[] = [];

    // Detect dev/dev-server scripts
    if (pkg.scripts) {
      const devScripts = Object.entries(pkg.scripts)
        .filter(([name, script]) =>
          name.includes('dev') ||
          name.includes('start') ||
          name.includes('serve')
        );

      for (const [name, script] of devScripts) {
        // Extract port from script
        const scriptStr = String(script);
        const portMatch = scriptStr.match(/-p\s+(\d+)|--port\s+(\d+)|PORT=(\d+)/);
        const port = portMatch ? parseInt(portMatch[1] || portMatch[2] || portMatch[3]) : undefined;

        services.push({
          name: name.replace(/:/g, '-'),
          command: script as string,
          port,
          working_dir: projectPath,
        });
      }
    }

    // Check for workspaces
    if (pkg.workspaces) {
      const workspaceDirs = typeof pkg.workspaces === 'string'
        ? [pkg.workspaces]
        : pkg.workspaces;

      for (const pattern of workspaceDirs) {
        const dirs = await glob(pattern.replace(/\/\*$/, ''), { cwd: projectPath });

        for (const dir of dirs) {
          const dirPath = path.join(projectPath, dir);
          const subServices = await detectServicesFromPackageJson(dirPath);
          services.push(...subServices.map(s => ({
            ...s,
            name: `${dir}-${s.name}`,
          })));
        }
      }
    }

    return services;
  } catch {
    return [];
  }
}

/**
 * Build dependency graph from service configurations
 */
export function buildDependencyGraph(services: ServiceConfig[]): ServiceDependencyGraph {
  const nodes = new Map<string, ServiceConfig>();
  const dependencies = new Map<string, string[]>();

  // Add all nodes
  for (const service of services) {
    nodes.set(service.name, service);
    dependencies.set(service.name, service.depends_on || []);
  }

  // Calculate levels (topological sort for startup order)
  const levels: string[][] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function getLevel(serviceName: string): number {
    if (visited.has(serviceName)) {
      return levels.findIndex(level => level.includes(serviceName));
    }

    if (visiting.has(serviceName)) {
      // Circular dependency detected
      return 0;
    }

    visiting.add(serviceName);

    const deps = dependencies.get(serviceName) || [];
    let maxLevel = 0;

    for (const dep of deps) {
      if (nodes.has(dep)) {
        maxLevel = Math.max(maxLevel, getLevel(dep) + 1);
      }
    }

    visiting.delete(serviceName);
    visited.add(serviceName);

    // Ensure level exists
    while (levels.length <= maxLevel) {
      levels.push([]);
    }

    if (!levels[maxLevel].includes(serviceName)) {
      levels[maxLevel].push(serviceName);
    }

    return maxLevel;
  }

  // Calculate levels for all services
  for (const serviceName of nodes.keys()) {
    getLevel(serviceName);
  }

  return { nodes, dependencies, levels };
}

/**
 * Start services with intelligent dependency resolution
 */
export async function servicesUp(
  projectPath: string,
  options: ServicesUpOptions = {}
): Promise<void> {
  const {
    detached = true,
    build = false,
    forceRecreate = false,
    noDeps = false,
    scale = {},
    timeout = 120000,
    verbose = false,
    spinner,
  } = options;

  // Parse service configurations
  const services = await parseDockerCompose(projectPath);

  if (services.length === 0) {
    console.log(chalk.yellow('No services found in project.'));
    console.log(chalk.gray('Add a docker-compose.yml or package.json with dev scripts.'));
    return;
  }

  // Build dependency graph
  const graph = buildDependencyGraph(services);

  if (verbose) {
    console.log(chalk.blue('\n📊 Service Dependency Graph:'));
    for (let i = 0; i < graph.levels.length; i++) {
      console.log(chalk.gray(`  Level ${i}:`), chalk.cyan(graph.levels[i].join(', ') || '(none)'));
    }
    console.log('');
  }

  // Check if Docker is available
  const hasDocker = await checkDockerAvailable();
  const hasDockerCompose = await checkDockerComposeAvailable();

  if (hasDocker && hasDockerCompose) {
    // Use Docker Compose
    await startWithDockerCompose(projectPath, {
      detached,
      build,
      forceRecreate,
      noDeps,
      scale,
      timeout,
      verbose,
      spinner,
    });
  } else {
    // Use npm scripts fallback
    await startWithNpmScripts(projectPath, graph, {
      timeout,
      verbose,
      spinner,
    });
  }
}

/**
 * Start services using Docker Compose
 */
async function startWithDockerCompose(
  projectPath: string,
  options: {
    detached: boolean;
    build: boolean;
    forceRecreate: boolean;
    noDeps: boolean;
    scale: Record<string, number>;
    timeout: number;
    verbose: boolean;
    spinner?: any;
  }
): Promise<void> {
  const args = ['up', '-d'];

  if (options.build) {
    args.push('--build');
  }

  if (options.forceRecreate) {
    args.push('--force-recreate');
  }

  if (options.noDeps) {
    args.push('--no-deps');
  }

  for (const [service, count] of Object.entries(options.scale)) {
    args.push(`--scale`, `${service}=${count}`);
  }

  if (options.spinner) {
    options.spinner.setText('Starting Docker services...');
  }

  await runCommand('docker-compose', args, {
    cwd: projectPath,
    timeout: options.timeout,
    verbose: options.verbose,
  });

  // Show running services
  await showRunningServices(projectPath);
}

/**
 * Start services using npm scripts
 */
async function startWithNpmScripts(
  projectPath: string,
  graph: ServiceDependencyGraph,
  options: {
    timeout: number;
    verbose: boolean;
    spinner?: any;
  }
): Promise<void> {
  const runningServices: RunningService[] = [];
  const processes: Map<string, ChildProcess> = new Map();

  // Start services level by level
  for (let i = 0; i < graph.levels.length; i++) {
    const levelServices = graph.levels[i];

    if (options.verbose) {
      console.log(chalk.blue(`Starting level ${i} services:`), chalk.cyan(levelServices.join(', ')));
    }

    for (const serviceName of levelServices) {
      const service = graph.nodes.get(serviceName);
      if (!service || !service.command) continue;

      if (options.spinner) {
        options.spinner.setText(`Starting ${serviceName}...`);
      }

      const runningService = await startServiceProcess(service, projectPath);
      runningServices.push(runningService);
      processes.set(serviceName, runningService.process as any);
    }

    // Wait a bit for services to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Show running services
  console.log(chalk.green('\n✅ Services started:'));
  for (const svc of runningServices) {
    console.log(chalk.gray('  •'), chalk.cyan(svc.name), chalk.gray(`(PID: ${svc.pid})`));
  }
}

/**
 * Start a single service as a background process
 */
async function startServiceProcess(
  service: ServiceConfig,
  projectPath: string
): Promise<RunningService> {
  const workingDir = service.working_dir || projectPath;
  const command = service.command || 'npm run dev';

  // Parse command
  const [cmd, ...args] = command.split(/\s+/);

  // Create log file
  const logDir = path.join(projectPath, '.re-shell', 'logs');
  await fs.mkdir(logDir, { recursive: true });
  const logFile = path.join(logDir, `${service.name}.log`);

  const proc = spawn(cmd, args, {
    cwd: workingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    shell: true,
  });

  // Redirect output to log file
  const logStream = await fs.open(logFile, 'w');
  proc.stdout?.pipe(logStream.createWriteStream());
  proc.stderr?.pipe(logStream.createWriteStream());

  // Store PID file
  const pidFile = path.join(projectPath, '.re-shell', 'pids', `${service.name}.pid`);
  await fs.mkdir(path.dirname(pidFile), { recursive: true });
  await fs.writeFile(pidFile, proc.pid.toString());

  proc.unref();

  return {
    name: service.name,
    pid: proc.pid || 0,
    port: service.port,
    command,
    startTime: new Date(),
    healthStatus: 'unknown',
    logFile,
  };
}

/**
 * Stop services with graceful shutdown
 */
export async function servicesDown(
  projectPath: string,
  options: ServicesDownOptions = {}
): Promise<void> {
  const {
    volumes = false,
    removeOrphans = false,
    timeout = 60000,
    verbose = false,
    spinner,
  } = options;

  const hasDockerCompose = await checkDockerComposeAvailable();

  if (hasDockerCompose) {
    // Use Docker Compose
    const args = ['down'];

    if (volumes) {
      args.push('-v');
    }

    if (removeOrphans) {
      args.push('--remove-orphans');
    }

    if (spinner) {
      spinner.setText('Stopping Docker services...');
    }

    await runCommand('docker-compose', args, {
      cwd: projectPath,
      timeout,
      verbose,
    });

    console.log(chalk.green('✅ Services stopped.'));
  } else {
    // Stop npm script processes
    await stopNpmProcesses(projectPath, { timeout, verbose, spinner });
  }
}

/**
 * Stop npm script processes
 */
async function stopNpmProcesses(
  projectPath: string,
  options: { timeout: number; verbose: boolean; spinner?: any }
): Promise<void> {
  const pidDir = path.join(projectPath, '.re-shell', 'pids');

  try {
    const files = await fs.readdir(pidDir);

    for (const file of files) {
      if (!file.endsWith('.pid')) continue;

      const pidPath = path.join(pidDir, file);
      const pid = parseInt(await fs.readFile(pidPath, 'utf-8'));

      try {
        process.kill(pid, 'SIGTERM');
        if (options.verbose) {
          console.log(chalk.gray(`Stopped ${file.replace('.pid', '')} (PID: ${pid})`));
        }
        await fs.unlink(pidPath);
      } catch (err) {
        // Process might not be running
        await fs.unlink(pidPath).catch(() => { /* ignore */ });
      }
    }

    console.log(chalk.green('✅ Services stopped.'));
  } catch {
    console.log(chalk.yellow('No running services found.'));
  }
}

/**
 * Check service health
 */
export async function servicesHealth(
  projectPath: string,
  options: ServicesHealthOptions = {}
): Promise<void> {
  const {
    watch = false,
    interval = 5000,
    json = false,
    verbose = false,
    spinner,
  } = options;

  const hasDockerCompose = await checkDockerComposeAvailable();

  if (hasDockerCompose) {
    if (watch) {
      await watchDockerHealth(projectPath, { interval, json, verbose });
    } else {
      await checkDockerHealth(projectPath, { json, verbose });
    }
  } else {
    await checkNpmProcessHealth(projectPath, { json, verbose });
  }
}

/**
 * Check Docker Compose service health
 */
async function checkDockerHealth(
  projectPath: string,
  options: { json: boolean; verbose: boolean }
): Promise<void> {
  const result = await runCommand('docker-compose', ['ps'], {
    cwd: projectPath,
    capture: true,
  });

  console.log(result.stdout);
}

/**
 * Watch Docker service health
 */
async function watchDockerHealth(
  projectPath: string,
  options: { interval: number; json: boolean; verbose: boolean }
): Promise<void> {
  console.log(chalk.blue('Watching service health...'));
  console.log(chalk.gray('Press Ctrl+C to stop.\n'));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Clear screen
    console.clear();
    console.log(chalk.bold('Service Health Status'));
    console.log(chalk.gray(`Updated: ${new Date().toLocaleTimeString()}\n`));

    await checkDockerHealth(projectPath, options);

    await new Promise(resolve => setTimeout(resolve, options.interval));
  }
}

/**
 * Check npm process health
 */
async function checkNpmProcessHealth(
  projectPath: string,
  options: { json: boolean; verbose: boolean }
): Promise<void> {
  const pidDir = path.join(projectPath, '.re-shell', 'pids');

  try {
    const files = await fs.readdir(pidDir);
    const services: any[] = [];

    for (const file of files) {
      if (!file.endsWith('.pid')) continue;

      const pidPath = path.join(pidDir, file);
      const pid = parseInt(await fs.readFile(pidPath, 'utf-8'));
      const serviceName = file.replace('.pid', '');

      // Check if process is running
      try {
        process.kill(pid, 0); // Signal 0 just checks if process exists
        services.push({
          name: serviceName,
          pid,
          status: 'running',
        });
      } catch {
        services.push({
          name: serviceName,
          pid,
          status: 'stopped',
        });
      }
    }

    if (options.json) {
      console.log(JSON.stringify(services, null, 2));
    } else {
      console.log(chalk.bold('\nService Health Status:\n'));
      for (const svc of services) {
        const icon = svc.status === 'running' ? '✅' : '❌';
        const color = svc.status === 'running' ? chalk.green : chalk.red;
        console.log(`${icon} ${chalk.cyan(svc.name)}: ${color(svc.status)} (PID: ${svc.pid})`);
      }
    }
  } catch {
    console.log(chalk.yellow('No services found.'));
  }
}

/**
 * Check if Docker is available
 */
async function checkDockerAvailable(): Promise<boolean> {
  try {
    await runCommand('docker', ['--version'], { capture: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker Compose is available
 */
async function checkDockerComposeAvailable(): Promise<boolean> {
  try {
    await runCommand('docker-compose', ['--version'], { capture: true });
    return true;
  } catch {
    try {
      await runCommand('docker', ['compose', 'version'], { capture: true });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Show running services
 */
async function showRunningServices(projectPath: string): Promise<void> {
  try {
    const result = await runCommand('docker-compose', ['ps', '--format', 'json'], {
      cwd: projectPath,
      capture: true,
      silent: true,
    });

    const services = JSON.parse(result.stdout);

    console.log(chalk.green('\n✅ Running services:'));
    for (const svc of services) {
      const ports = svc.Ports || '';
      const portMatch = ports.match(/:(\d+)->/);
      const port = portMatch ? portMatch[1] : '';

      console.log(chalk.gray('  •'), chalk.cyan(svc.Service));
      if (port) {
        console.log(chalk.gray(`    Port: ${port}`));
      }
    }
  } catch {
    console.log(chalk.yellow('No running services.'));
  }
}

/**
 * Run a command and return the result
 */
async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    verbose?: boolean;
    capture?: boolean;
    silent?: boolean;
  } = {}
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const { cwd = process.cwd(), timeout = 30000, verbose = false, capture = false, silent = false } = options;

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: capture || silent ? 'pipe' : 'inherit',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    if (capture || proc.stdout) {
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        if (verbose && !capture) {
          process.stdout.write(data);
        }
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        if (verbose) {
          process.stderr.write(data);
        }
      });
    }

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Get service logs
 */
export async function servicesLogs(
  projectPath: string,
  service?: string,
  options: {
    follow?: boolean;
    tail?: number;
    verbose?: boolean;
  } = {}
): Promise<void> {
  const { follow = false, tail = 100, verbose = false } = options;

  const hasDockerCompose = await checkDockerComposeAvailable();

  if (hasDockerCompose) {
    const args = ['logs', '-f', '--tail', tail.toString()];
    if (service) {
      args.push(service);
    }

    await runCommand('docker-compose', args, {
      cwd: projectPath,
      timeout: follow ? 0 : 30000,
      verbose: true,
    });
  } else {
    // Show npm script logs
    const logDir = path.join(projectPath, '.re-shell', 'logs');

    try {
      const logFile = service
        ? path.join(logDir, `${service}.log`)
        : path.join(logDir, '*.log');

      if (service) {
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.split('\n');
        const tailLines = lines.slice(-tail);
        console.log(tailLines.join('\n'));
      } else {
        const files = await fs.readdir(logDir);
        for (const file of files) {
          if (file.endsWith('.log')) {
            console.log(chalk.blue(`\n=== ${file} ===`));
            const content = await fs.readFile(path.join(logDir, file), 'utf-8');
            const lines = content.split('\n');
            const tailLines = lines.slice(-tail);
            console.log(tailLines.join('\n'));
          }
        }
      }
    } catch {
      console.log(chalk.yellow('No logs found.'));
    }
  }
}

/**
 * Restart a service with zero downtime if possible
 */
export async function servicesRestart(
  projectPath: string,
  service: string,
  options: {
    timeout?: number;
    verbose?: boolean;
    spinner?: any;
  } = {}
): Promise<void> {
  const { timeout = 60000, verbose = false, spinner } = options;

  const hasDockerCompose = await checkDockerComposeAvailable();

  if (spinner) {
    spinner.setText(`Restarting ${service}...`);
  }

  if (hasDockerCompose) {
    // Use Docker Compose restart (zero downtime if configured correctly)
    await runCommand('docker-compose', ['restart', service], {
      cwd: projectPath,
      timeout,
      verbose,
    });

    console.log(chalk.green(`✅ Service '${service}' restarted.`));
  } else {
    // Stop and start npm process
    await stopNpmProcesses(projectPath, { timeout, verbose, spinner });

    const services = await parseDockerCompose(projectPath);
    const svcConfig = services.find(s => s.name === service);

    if (svcConfig) {
      await startServiceProcess(svcConfig, projectPath);
      console.log(chalk.green(`✅ Service '${service}' restarted.`));
    }
  }
}

/**
 * Scale services
 */
export async function servicesScale(
  projectPath: string,
  service: string,
  replicas: number,
  options: {
    timeout?: number;
    verbose?: boolean;
    spinner?: any;
  } = {}
): Promise<void> {
  const { timeout = 60000, verbose = false, spinner } = options;

  const hasDockerCompose = await checkDockerComposeAvailable();

  if (spinner) {
    spinner.setText(`Scaling ${service} to ${replicas} instances...`);
  }

  if (hasDockerCompose) {
    await runCommand('docker-compose', ['up', '-d', '--scale', `${service}=${replicas}`], {
      cwd: projectPath,
      timeout,
      verbose,
    });

    console.log(chalk.green(`✅ Service '${service}' scaled to ${replicas} instances.`));
  } else {
    console.log(chalk.yellow('Scaling is only supported with Docker Compose.'));
  }
}

/**
 * Execute command in service container
 */
export async function servicesExec(
  projectPath: string,
  service: string,
  command: string[],
  options: {
    interactive?: boolean;
    verbose?: boolean;
    spinner?: any;
  } = {}
): Promise<void> {
  const { interactive = true, verbose = false } = options;

  const hasDockerCompose = await checkDockerComposeAvailable();

  if (!hasDockerCompose) {
    console.log(chalk.yellow('Service exec is only supported with Docker Compose.'));
    return;
  }

  const args = ['exec'];
  if (!interactive) {
    args.push('-T');
  }
  args.push(service, ...command);

  await runCommand('docker-compose', args, {
    cwd: projectPath,
    timeout: 0,
    verbose: true,
  });
}

/**
 * Service inspection result with detailed metrics
 */
export interface ServiceInspection {
  name: string;
  status: 'running' | 'stopped' | 'unknown';
  type: 'docker' | 'npm-script';
  ports: { container: number; host: number; protocol: string }[];
  environment: Record<string, string>;
  dependencies: string[];
  dependents: string[];
  health: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    checks: { name: string; status: string }[];
  };
  resources: {
    memory?: { usage: number; limit: number };
    cpu?: { usage: number };
  };
  metadata: {
    image?: string;
    command?: string;
    workingDir?: string;
    startTime?: Date;
    pid?: number;
  };
}

/**
 * Inspect service with detailed metrics and dependency information
 */
export async function servicesInspect(
  projectPath: string,
  serviceName: string,
  options: {
    json?: boolean;
    verbose?: boolean;
    spinner?: any;
  } = {}
): Promise<ServiceInspection> {
  const { json = false, verbose = false, spinner } = options;

  // Parse service configurations
  const services = await parseDockerCompose(projectPath);
  const graph = buildDependencyGraph(services);

  const service = services.find(s => s.name === serviceName);
  if (!service) {
    throw new Error(`Service '${serviceName}' not found`);
  }

  const hasDockerCompose = await checkDockerComposeAvailable();
  const inspection: ServiceInspection = {
    name: serviceName,
    status: 'unknown',
    type: hasDockerCompose ? 'docker' : 'npm-script',
    ports: [],
    environment: service.environment || {},
    dependencies: service.depends_on || [],
    dependents: [],
    health: {
      status: 'unknown',
      checks: [],
    },
    resources: {},
    metadata: {
      image: service.image,
      command: service.command,
      workingDir: service.working_dir,
    },
  };

  // Find dependents (services that depend on this one)
  for (const [name, deps] of graph.dependencies) {
    if (deps.includes(serviceName)) {
      inspection.dependents.push(name);
    }
  }

  // Parse ports
  if (service.ports) {
    for (const portMapping of service.ports) {
      const match = portMapping.match(/(\d+):(\d+)\/?(tcp|udp)?/);
      if (match) {
        inspection.ports.push({
          container: parseInt(match[2]),
          host: parseInt(match[1]),
          protocol: match[3] || 'tcp',
        });
      }
    }
  } else if (service.port) {
    inspection.ports.push({
      container: service.port,
      host: service.port,
      protocol: 'tcp',
    });
  }

  // Get detailed info from Docker if available
  if (hasDockerCompose) {
    await inspectDockerService(projectPath, serviceName, inspection, verbose);
  } else {
    await inspectNpmService(projectPath, serviceName, inspection);
  }

  // Display results
  if (json) {
    console.log(JSON.stringify(inspection, null, 2));
  } else {
    displayInspection(inspection);
  }

  return inspection;
}

/**
 * Inspect Docker service
 */
async function inspectDockerService(
  projectPath: string,
  serviceName: string,
  inspection: ServiceInspection,
  verbose: boolean
): Promise<void> {
  try {
    // Get container info
    const psResult = await runCommand('docker-compose', ['ps', '-q', serviceName], {
      cwd: projectPath,
      capture: true,
      silent: true,
    });

    const containerId = psResult.stdout.trim();

    if (containerId) {
      inspection.status = 'running';

      // Get detailed container info
      const inspectResult = await runCommand('docker', ['inspect', containerId], {
        capture: true,
        silent: true,
      });

      try {
        const containers = JSON.parse(inspectResult.stdout);
        if (containers.length > 0) {
          const container = containers[0];

          // Get resource usage
          const statsResult = await runCommand('docker', ['stats', containerId, '--no-stream', '--format', '{{json .}}'], {
            capture: true,
            silent: true,
          });

          try {
            const stats = JSON.parse(statsResult.stdout);
            inspection.resources = {
              memory: {
                usage: parseInt(stats.BlockIO || '0'),
                limit: parseInt(stats.MemPerc || '0'),
              },
              cpu: {
                usage: parseFloat(stats.CPUPerc || '0'),
              },
            };
          } catch {
            // Stats parsing failed
          }

          // Get start time
          inspection.metadata.startTime = new Date(container.State.StartedAt);

          // Get PID
          inspection.metadata.pid = container.State.Pid;

          // Get health status
          if (container.State.Health) {
            inspection.health.status = container.State.Health.Status === 'healthy' ? 'healthy' : 'unhealthy';
            inspection.health.checks = container.State.Health.Log.map((log: any) => ({
              name: log.ExitCode === 0 ? 'healthy' : 'unhealthy',
              status: log.Output,
            }));
          }
        }
      } catch {
        // Container inspect failed
      }
    } else {
      inspection.status = 'stopped';
    }
  } catch {
    inspection.status = 'unknown';
  }
}

/**
 * Inspect npm script service
 */
async function inspectNpmService(
  projectPath: string,
  serviceName: string,
  inspection: ServiceInspection
): Promise<void> {
  const pidFile = path.join(projectPath, '.re-shell', 'pids', `${serviceName}.pid`);

  try {
    const pid = parseInt(await fs.readFile(pidFile, 'utf-8'));

    // Check if process is running
    try {
      process.kill(pid, 0);
      inspection.status = 'running';
      inspection.metadata.pid = pid;
    } catch {
      inspection.status = 'stopped';
    }

    // Get start time from log file
    const logFile = path.join(projectPath, '.re-shell', 'logs', `${serviceName}.log`);
    try {
      const stats = await fs.stat(logFile);
      inspection.metadata.startTime = stats.birthtime;
    } catch {
      // Log file doesn't exist
    }
  } catch {
    inspection.status = 'unknown';
  }
}

/**
 * Display service inspection in readable format
 */
function displayInspection(inspection: ServiceInspection): void {
  console.log(chalk.bold(`\n📊 Service Inspection: ${inspection.name}\n`));

  // Status
  const statusIcon = inspection.status === 'running' ? '✅' : inspection.status === 'stopped' ? '⏹️' : '❓';
  const statusColor = inspection.status === 'running' ? chalk.green : inspection.status === 'stopped' ? chalk.red : chalk.gray;
  console.log(`${statusIcon} Status:`, statusColor(inspection.status));
  console.log(chalk.gray('   Type:'), chalk.cyan(inspection.type));

  // Metadata
  console.log(chalk.gray('\n📋 Metadata:'));
  if (inspection.metadata.image) {
    console.log(chalk.gray('   Image:'), chalk.cyan(inspection.metadata.image));
  }
  if (inspection.metadata.command) {
    console.log(chalk.gray('   Command:'), chalk.cyan(inspection.metadata.command));
  }
  if (inspection.metadata.workingDir) {
    console.log(chalk.gray('   Working Dir:'), chalk.cyan(inspection.metadata.workingDir));
  }
  if (inspection.metadata.pid) {
    console.log(chalk.gray('   PID:'), chalk.cyan(inspection.metadata.pid.toString()));
  }
  if (inspection.metadata.startTime) {
    console.log(chalk.gray('   Started:'), chalk.cyan(inspection.metadata.startTime.toLocaleString()));
  }

  // Ports
  if (inspection.ports.length > 0) {
    console.log(chalk.gray('\n🔌 Ports:'));
    for (const port of inspection.ports) {
      console.log(chalk.gray('   •'), chalk.cyan(`${port.host} -> ${port.container}/${port.protocol}`));
    }
  }

  // Dependencies
  if (inspection.dependencies.length > 0) {
    console.log(chalk.gray('\n📦 Dependencies:'));
    for (const dep of inspection.dependencies) {
      console.log(chalk.gray('   •'), chalk.cyan(dep));
    }
  }

  // Dependents
  if (inspection.dependents.length > 0) {
    console.log(chalk.gray('\n🔗 Dependents (services that depend on this one):'));
    for (const dep of inspection.dependents) {
      console.log(chalk.gray('   •'), chalk.cyan(dep));
    }
  }

  // Health
  console.log(chalk.gray('\n💊 Health:'));
  const healthIcon = inspection.health.status === 'healthy' ? '✅' : inspection.health.status === 'unhealthy' ? '❌' : '❓';
  const healthColor = inspection.health.status === 'healthy' ? chalk.green : inspection.health.status === 'unhealthy' ? chalk.red : chalk.gray;
  console.log(chalk.gray('   Status:'), healthColor(inspection.health.status));

  if (inspection.health.checks.length > 0) {
    for (const check of inspection.health.checks) {
      console.log(chalk.gray('   •'), chalk.gray(check.name), chalk.gray('-'), chalk.gray(check.status));
    }
  }

  // Resources
  if (inspection.resources.memory || inspection.resources.cpu) {
    console.log(chalk.gray('\n📈 Resources:'));
    if (inspection.resources.memory) {
      console.log(chalk.gray('   Memory:'), chalk.cyan(`${inspection.resources.memory.usage} / ${inspection.resources.memory.limit}`));
    }
    if (inspection.resources.cpu) {
      console.log(chalk.gray('   CPU:'), chalk.cyan(`${inspection.resources.cpu.usage.toFixed(2)}%`));
    }
  }

  // Environment variables (subset)
  if (Object.keys(inspection.environment).length > 0) {
    console.log(chalk.gray('\n🔧 Environment (sample):'));
    const keys = Object.keys(inspection.environment).slice(0, 5);
    for (const key of keys) {
      console.log(chalk.gray('   •'), chalk.cyan(key), chalk.gray('='), chalk.gray(inspection.environment[key]));
    }
    if (Object.keys(inspection.environment).length > 5) {
      console.log(chalk.gray('   ...'), chalk.gray(`and ${Object.keys(inspection.environment).length - 5} more`));
    }
  }

  console.log('');
}

/**
 * Migration options
 */
export interface ServiceMigrateOptions {
  sourceFramework: string;
  targetFramework: string;
  dryRun?: boolean;
  backup?: boolean;
  preserveData?: boolean;
  generateTests?: boolean;
  spinner?: any;
}

/**
 * Migration plan with steps
 */
export interface MigrationPlan {
  source: {
    framework: string;
    language: string;
    files: string[];
  };
  target: {
    framework: string;
    language: string;
    templates: string[];
  };
  steps: MigrationStep[];
  estimatedTime: string;
  complexity: 'low' | 'medium' | 'high';
  warnings: string[];
  suggestions: string[];
}

/**
 * Single migration step
 */
export interface MigrationStep {
  id: string;
  title: string;
  description: string;
  files: string[];
  commands: string[];
  manual: boolean;
}

/**
 * Migrate service from one framework to another
 */
export async function servicesMigrate(
  projectPath: string,
  serviceName: string,
  options: ServiceMigrateOptions
): Promise<MigrationPlan> {
  const {
    sourceFramework,
    targetFramework,
    dryRun = false,
    backup = true,
    preserveData = true,
    generateTests = false,
    spinner,
  } = options;

  if (spinner) {
    spinner.setText(`Analyzing ${serviceName} for migration...`);
  }

  // Get backend templates to understand frameworks
  const { listBackendTemplates, getBackendTemplate } = await import('../templates/backend/index');

  const allFrameworks = listBackendTemplates();
  const sourceTemplate = getBackendTemplate(sourceFramework);
  const targetTemplate = getBackendTemplate(targetFramework);

  if (!sourceTemplate) {
    throw new Error(`Source framework '${sourceFramework}' not found`);
  }

  if (!targetTemplate) {
    throw new Error(`Target framework '${targetFramework}' not found`);
  }

  // Build migration plan
  const plan = buildMigrationPlan(serviceName, sourceTemplate, targetTemplate, {
    dryRun,
    backup,
    preserveData,
    generateTests,
  });

  // Display the plan
  displayMigrationPlan(plan);

  // Ask for confirmation if not dry run
  if (!dryRun) {
    const promptsModule = await import('prompts');
    const prompts = (promptsModule as any).default || promptsModule;

    if (backup) {
      if (spinner) spinner.setText('Creating backup...');
      await createMigrationBackup(projectPath, serviceName);
      console.log(chalk.gray('✓ Backup created'));
    }

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with migration?',
      initial: false,
    });

    if (!confirm) {
      console.log(chalk.yellow('\nMigration cancelled.'));
      return plan;
    }

    // Execute migration
    if (spinner) spinner.setText('Executing migration...');
    await executeMigration(projectPath, serviceName, plan);
    console.log(chalk.green('\n✅ Migration completed!'));
  } else {
    console.log(chalk.yellow('\nDry run - no changes made.'));
  }

  return plan;
}

/**
 * Build migration plan between frameworks
 */
function buildMigrationPlan(
  serviceName: string,
  sourceTemplate: any,
  targetTemplate: any,
  options: {
    dryRun: boolean;
    backup: boolean;
    preserveData: boolean;
    generateTests: boolean;
  }
): MigrationPlan {
  const sourceLanguage = sourceTemplate.language;
  const targetLanguage = targetTemplate.language;
  const isLanguageChange = sourceLanguage !== targetLanguage;

  const steps: MigrationStep[] = [];

  // Step 1: Code translation
  if (isLanguageChange) {
    steps.push({
      id: 'translate-code',
      title: `Translate code from ${sourceLanguage} to ${targetLanguage}`,
      description: `Convert source code from ${sourceTemplate.displayName} to ${targetTemplate.displayName}`,
      files: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.py', 'src/**/*.go', 'src/**/*.rs'],
      commands: [],
      manual: true,
    });
  }

  // Step 2: Update dependencies
  steps.push({
    id: 'update-dependencies',
    title: 'Update package dependencies',
    description: `Replace ${sourceTemplate.id} dependencies with ${targetTemplate.id} equivalents`,
    files: ['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml'],
    commands: getDependencyUpdateCommands(sourceTemplate, targetTemplate),
    manual: false,
  });

  // Step 3: Update configuration
  steps.push({
    id: 'update-config',
    title: 'Update configuration files',
    description: 'Update framework-specific configuration files',
    files: [...getConfigFiles(sourceTemplate), ...getConfigFiles(targetTemplate)],
    commands: [],
    manual: true,
  });

  // Step 4: Update Docker setup
  steps.push({
    id: 'update-docker',
    title: 'Update Docker configuration',
    description: 'Update Dockerfile and docker-compose for new framework',
    files: ['Dockerfile', 'docker-compose.yml'],
    commands: [],
    manual: true,
  });

  // Step 5: Update tests
  if (options.generateTests) {
    steps.push({
      id: 'update-tests',
      title: 'Generate/update tests',
      description: `Create tests for ${targetTemplate.displayName}`,
      files: ['**/*.test.ts', '**/*.test.js', '**/*.test.py'],
      commands: getTestGenerationCommands(targetTemplate),
      manual: true,
    });
  }

  // Step 6: Update CI/CD
  steps.push({
    id: 'update-cicd',
    title: 'Update CI/CD pipelines',
    description: 'Update GitHub Actions/GitLab CI for new framework',
    files: ['.github/workflows/*.yml', '.gitlab-ci.yml'],
    commands: [],
    manual: true,
  });

  // Calculate warnings
  const warnings: string[] = [];

  if (isLanguageChange) {
    warnings.push(`Language change from ${sourceLanguage} to ${targetLanguage} requires manual code translation`);
    warnings.push('Database migration may be needed if ORM changes');
  }

  if (sourceTemplate.tags?.includes('async') && !targetTemplate.tags?.includes('async')) {
    warnings.push('Target framework does not have native async support - performance may be affected');
  }

  // Calculate suggestions
  const suggestions: string[] = [];

  if (isLanguageChange) {
    suggestions.push('Consider using a translation tool to speed up code conversion');
    suggestions.push('Run comprehensive tests after migration');
  }

  suggestions.push('Update API documentation to reflect any endpoint changes');
  suggestions.push('Test database connections with new ORM/driver');

  // Calculate complexity
  let complexity: 'low' | 'medium' | 'high' = 'low';
  if (isLanguageChange) {
    complexity = 'high';
  } else if (sourceTemplate.framework !== targetTemplate.framework) {
    complexity = 'medium';
  }

  // Estimate time
  const estimatedTime = complexity === 'low' ? '1-2 hours' : complexity === 'medium' ? '4-8 hours' : '2-5 days';

  return {
    source: {
      framework: sourceTemplate.displayName,
      language: sourceLanguage,
      files: [],
    },
    target: {
      framework: targetTemplate.displayName,
      language: targetLanguage,
      templates: [targetTemplate.id],
    },
    steps,
    estimatedTime,
    complexity,
    warnings,
    suggestions,
  };
}

/**
 * Get dependency update commands
 */
function getDependencyUpdateCommands(sourceTemplate: any, targetTemplate: any): string[] {
  const commands: string[] = [];

  if (targetTemplate.language === 'typescript' || targetTemplate.language === 'javascript') {
    commands.push('npm install <new-packages>');
    commands.push('npm uninstall <old-packages>');
  } else if (targetTemplate.language === 'python') {
    commands.push('pip install <new-packages>');
    commands.push('pip uninstall <old-packages>');
  } else if (targetTemplate.language === 'go') {
    commands.push('go get <new-packages>');
    commands.push('go mod tidy');
  } else if (targetTemplate.language === 'rust') {
    commands.push('cargo add <new-packages>');
    commands.push('cargo remove <old-packages>');
  }

  return commands;
}

/**
 * Get config files for a template
 */
function getConfigFiles(template: any): string[] {
  const files: string[] = [];

  if (template.language === 'typescript' || template.language === 'javascript') {
    files.push('tsconfig.json', '.eslintrc.js', '.prettierrc');
  } else if (template.language === 'python') {
    files.push('pyproject.toml', 'setup.py', '.flake8');
  } else if (template.language === 'go') {
    files.push('.golangci.yml', 'go.mod');
  } else if (template.language === 'rust') {
    files.push('Cargo.toml', 'clippy.toml', 'rustfmt.toml');
  }

  return files;
}

/**
 * Get test generation commands
 */
function getTestGenerationCommands(template: any): string[] {
  const commands: string[] = [];

  if (template.language === 'typescript' || template.language === 'javascript') {
    commands.push('npm test -- --coverage');
  } else if (template.language === 'python') {
    commands.push('pytest --cov');
  } else if (template.language === 'go') {
    commands.push('go test -cover ./...');
  } else if (template.language === 'rust') {
    commands.push('cargo test');
  }

  return commands;
}

/**
 * Create backup before migration
 */
async function createMigrationBackup(projectPath: string, serviceName: string): Promise<void> {
  const backupDir = path.join(projectPath, '.re-shell', 'backups');
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${serviceName}-migrate-${timestamp}.tar.gz`);

  // Create tar.gz backup
  execSync(`tar -czf "${backupPath}" -C "${projectPath}" src package.json 2>/dev/null || true`);
}

/**
 * Display migration plan
 */
function displayMigrationPlan(plan: MigrationPlan): void {
  console.log(chalk.bold(`\n📋 Migration Plan\n`));

  // Source and Target
  console.log(chalk.gray('From:'), chalk.red(plan.source.framework), chalk.gray(`(${plan.source.language})`));
  console.log(chalk.gray('To:'), chalk.green(plan.target.framework), chalk.gray(`(${plan.target.language})`));
  console.log(chalk.gray('Complexity:'), chalk.yellow(plan.complexity.toUpperCase()));
  console.log(chalk.gray('Estimated Time:'), chalk.cyan(plan.estimatedTime));

  // Warnings
  if (plan.warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    for (const warning of plan.warnings) {
      console.log(chalk.yellow('   •'), warning);
    }
  }

  // Suggestions
  if (plan.suggestions.length > 0) {
    console.log(chalk.cyan('\n💡 Suggestions:'));
    for (const suggestion of plan.suggestions) {
      console.log(chalk.cyan('   •'), suggestion);
    }
  }

  // Steps
  console.log(chalk.gray('\n📝 Migration Steps:'));
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const icon = step.manual ? '👤' : '🤖';
    console.log(chalk.gray(`\n${icon} Step ${i + 1}: ${chalk.bold(step.title)}`));
    console.log(chalk.gray('   ' + step.description));
    if (step.files.length > 0) {
      console.log(chalk.gray('   Files:'), chalk.cyan(step.files.slice(0, 3).join(', ') + (step.files.length > 3 ? '...' : '')));
    }
  }

  console.log('');
}

/**
 * Execute migration (placeholder for actual implementation)
 */
async function executeMigration(projectPath: string, serviceName: string, plan: MigrationPlan): Promise<void> {
  console.log(chalk.gray('Executing migration steps...'));

  for (const step of plan.steps) {
    console.log(chalk.gray(`  • ${step.title}`));

    if (step.manual) {
      console.log(chalk.yellow(`    ⚠️  Manual step - please complete: ${step.description}`));
    } else {
      for (const command of step.commands) {
        console.log(chalk.gray(`      Running: ${command}`));
        // In a real implementation, we would execute these commands
      }
    }
  }
}

/**
 * List available framework migrations
 */
export async function listMigrationTargets(sourceFramework?: string): Promise<void> {
  const { listBackendTemplates, getBackendTemplate } = await import('../templates/backend/index');

  const allFrameworks = listBackendTemplates();

  if (sourceFramework) {
    const source = getBackendTemplate(sourceFramework);
    if (!source) {
      console.log(chalk.yellow(`Source framework '${sourceFramework}' not found`));
      return;
    }

    console.log(chalk.bold(`\n🔄 Migration targets from ${source.displayName}:\n`));

    const targets = allFrameworks.filter(f => f.id !== sourceFramework);
    for (const target of targets) {
      const isSameLanguage = target.language === source.language;
      const icon = isSameLanguage ? '✅' : '⚠️';
      const color = isSameLanguage ? chalk.green : chalk.yellow;
      console.log(`${icon} ${color(target.displayName)} (${target.language})`);
    }
  } else {
    console.log(chalk.bold('\n🔄 Available framework migrations:\n'));

    const grouped = new Map<string, any[]>();
    for (const fw of allFrameworks) {
      if (!grouped.has(fw.language)) {
        grouped.set(fw.language, []);
      }
      grouped.get(fw.language)!.push(fw);
    }

    for (const [language, frameworks] of grouped) {
      console.log(chalk.bold(`\n${language}:`));
      for (const fw of frameworks) {
        console.log(chalk.gray('  •'), fw.displayName);
      }
    }
  }

  console.log('');
}

/**
 * Service optimization recommendation
 */
export interface OptimizationRecommendation {
  category: 'performance' | 'memory' | 'cpu' | 'security' | 'scalability';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'hard';
  impact: string;
  commands?: string[];
  files?: string[];
}

/**
 * Optimization analysis result
 */
export interface OptimizationAnalysis {
  serviceName: string;
  framework: string;
  language: string;
  currentMetrics: {
    memory?: number;
    cpu?: number;
    responseTime?: number;
  };
  recommendations: OptimizationRecommendation[];
  estimatedImprovement: string;
}

/**
 * Framework-specific optimization rules
 */
const frameworkOptimizations: Record<string, OptimizationRecommendation[]> = {
  express: [
    {
      category: 'performance',
      title: 'Enable compression middleware',
      description: 'Add compression middleware to reduce response size',
      priority: 'high',
      effort: 'easy',
      impact: '30-50% reduction in bandwidth',
      commands: ['npm install compression'],
      files: ['src/index.ts', 'src/app.ts'],
    },
    {
      category: 'performance',
      title: 'Implement response caching',
      description: 'Add HTTP caching headers for static content',
      priority: 'high',
      effort: 'easy',
      impact: 'Faster load times for returning users',
      files: ['src/middleware/cache.ts'],
    },
    {
      category: 'scalability',
      title: 'Add cluster mode for multi-core',
      description: 'Use Node.js cluster to utilize all CPU cores',
      priority: 'medium',
      effort: 'medium',
      impact: 'Near-linear scaling with CPU cores',
      files: ['src/cluster.ts'],
    },
  ],
  nestjs: [
    {
      category: 'performance',
      title: 'Enable interceptor caching',
      description: 'Use cache interceptors for frequently accessed data',
      priority: 'high',
      effort: 'easy',
      impact: 'Reduced database load',
      files: ['src/common/interceptors/cache.interceptor.ts'],
    },
    {
      category: 'performance',
      title: 'Add query optimization',
      description: 'Implement pagination and selective field queries',
      priority: 'high',
      effort: 'medium',
      impact: 'Faster query responses',
      files: ['src/modules/**/*.module.ts'],
    },
  ],
  fastapi: [
    {
      category: 'performance',
      title: 'Enable async/await patterns',
      description: 'Convert all endpoints to async for better concurrency',
      priority: 'high',
      effort: 'medium',
      impact: 'Better handling of concurrent requests',
      files: ['src/main.py', 'src/app/**/*.py'],
    },
    {
      category: 'performance',
      title: 'Add Redis caching',
      description: 'Implement Redis for session and data caching',
      priority: 'high',
      effort: 'medium',
      impact: 'Significantly faster read operations',
      commands: ['pip install redis aioredis'],
    },
  ],
  django: [
    {
      category: 'performance',
      title: 'Enable database connection pooling',
      description: 'Configure CONN_MAX_AGE for persistent connections',
      priority: 'high',
      effort: 'easy',
      impact: 'Reduced connection overhead',
      files: ['settings.py'],
    },
    {
      category: 'performance',
      title: 'Implement select_related/prefetch_related',
      description: 'Optimize ORM queries to reduce N+1 problems',
      priority: 'high',
      effort: 'medium',
      impact: 'Fewer database queries',
      files: ['**/views.py', '**/serializers.py'],
    },
  ],
  go: [
    {
      category: 'performance',
      title: 'Use sync.Pool for object reuse',
      description: 'Implement object pooling to reduce GC pressure',
      priority: 'medium',
      effort: 'medium',
      impact: 'Reduced memory allocations',
      files: ['**/*.go'],
    },
    {
      category: 'performance',
      title: 'Enable HTTP/2',
      description: 'Configure server to use HTTP/2 with h2c',
      priority: 'medium',
      effort: 'easy',
      impact: 'Better multiplexing and header compression',
      files: ['main.go', 'server.go'],
    },
  ],
  rust: [
    {
      category: 'memory',
      title: 'Use jemalloc allocator',
      description: 'Replace default allocator with jemalloc for better performance',
      priority: 'low',
      effort: 'easy',
      impact: 'Potentially better memory allocation patterns',
      files: ['Cargo.toml'],
    },
    {
      category: 'performance',
      title: 'Enable tokio console',
      description: 'Add tokio-console for runtime instrumentation',
      priority: 'medium',
      effort: 'medium',
      impact: 'Better async runtime visibility',
      files: ['Cargo.toml'],
    },
  ],
};

/**
 * Generic optimization recommendations applicable to all services
 */
const genericOptimizations: OptimizationRecommendation[] = [
  {
    category: 'security',
    title: 'Enable rate limiting',
    description: 'Add rate limiting middleware to prevent abuse',
    priority: 'high',
    effort: 'easy',
    impact: 'Protection against DoS attacks',
  },
  {
    category: 'security',
    title: 'Add security headers',
    description: 'Implement helmet/cors security headers',
    priority: 'high',
    effort: 'easy',
    impact: 'Better security posture',
  },
  {
    category: 'performance',
    title: 'Configure health check endpoints',
    description: 'Add /health and /ready endpoints for load balancers',
    priority: 'medium',
    effort: 'easy',
    impact: 'Better orchestration integration',
  },
  {
    category: 'performance',
    title: 'Implement request logging',
    description: 'Add structured logging for requests/responses',
    priority: 'medium',
    effort: 'easy',
    impact: 'Better observability',
  },
  {
    category: 'scalability',
    title: 'Add horizontal scaling support',
    description: 'Ensure stateless design for scaling',
    priority: 'medium',
    effort: 'hard',
    impact: 'Ability to scale horizontally',
  },
];

/**
 * Analyze and optimize service with performance recommendations
 */
export async function servicesOptimize(
  projectPath: string,
  serviceName: string,
  options: {
    framework?: string;
    apply?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    spinner?: any;
  } = {}
): Promise<OptimizationAnalysis> {
  const { framework, apply = false, dryRun = true, verbose = false, spinner } = options;

  if (spinner) {
    spinner.setText(`Analyzing ${serviceName} for optimization opportunities...`);
  }

  // Detect or use provided framework
  let detectedFramework = framework;
  if (!detectedFramework) {
    const services = await parseDockerCompose(projectPath);
    const service = services.find(s => s.name === serviceName);
    if (service && service.image) {
      // Try to detect from image name
      const imageLower = service.image.toLowerCase();
      if (imageLower.includes('express')) detectedFramework = 'express';
      else if (imageLower.includes('nest')) detectedFramework = 'nestjs';
      else if (imageLower.includes('fastapi')) detectedFramework = 'fastapi';
      else if (imageLower.includes('django')) detectedFramework = 'django';
      else if (imageLower.includes('gin')) detectedFramework = 'gin';
      else if (imageLower.includes('fiber')) detectedFramework = 'fiber';
    }
  }

  // Get framework-specific optimizations
  const frameworkRecommendations = detectedFramework
    ? (frameworkOptimizations[detectedFramework] || [])
    : [];

  // Combine with generic optimizations
  const allRecommendations = [
    ...frameworkRecommendations,
    ...genericOptimizations,
  ];

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  allRecommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const analysis: OptimizationAnalysis = {
    serviceName,
    framework: detectedFramework || 'unknown',
    language: 'unknown',
    currentMetrics: {},
    recommendations: allRecommendations,
    estimatedImprovement: calculateEstimatedImprovement(allRecommendations),
  };

  // Display the analysis
  displayOptimizationAnalysis(analysis);

  // Apply optimizations if requested
  if (apply && !dryRun) {
    if (spinner) spinner.setText('Applying optimizations...');
    await applyOptimizations(projectPath, serviceName, analysis);
    console.log(chalk.green('\n✅ Optimizations applied!'));
  } else if (dryRun) {
    console.log(chalk.yellow('\nDry run - no changes made.'));
  }

  return analysis;
}

/**
 * Calculate estimated improvement from recommendations
 */
function calculateEstimatedImprovement(recommendations: OptimizationRecommendation[]): string {
  const highPriority = recommendations.filter(r => r.priority === 'high').length;
  const mediumPriority = recommendations.filter(r => r.priority === 'medium').length;

  if (highPriority >= 3) {
    return '50-70% improvement possible';
  } else if (highPriority >= 1) {
    return '20-40% improvement possible';
  } else if (mediumPriority >= 2) {
    return '10-20% improvement possible';
  }
  return 'Minor improvements possible';
}

/**
 * Display optimization analysis
 */
function displayOptimizationAnalysis(analysis: OptimizationAnalysis): void {
  console.log(chalk.bold(`\n🔧 Optimization Analysis: ${analysis.serviceName}\n`));

  if (analysis.framework !== 'unknown') {
    console.log(chalk.gray('Framework:'), chalk.cyan(analysis.framework));
  }

  console.log(chalk.gray('Estimated Improvement:'), chalk.green(analysis.estimatedImprovement));
  console.log(chalk.gray('Recommendations:'), chalk.yellow(analysis.recommendations.length.toString()));

  // Group by category
  const byCategory = new Map<string, OptimizationRecommendation[]>();
  for (const rec of analysis.recommendations) {
    if (!byCategory.has(rec.category)) {
      byCategory.set(rec.category, []);
    }
    byCategory.get(rec.category)!.push(rec);
  }

  // Display recommendations by category
  for (const [category, recommendations] of byCategory) {
    const categoryIcon = {
      performance: '⚡',
      memory: '💾',
      cpu: '🔥',
      security: '🔒',
      scalability: '📈',
    }[category] || '📋';

    console.log(chalk.bold(`\n${categoryIcon} ${category.charAt(0).toUpperCase() + category.slice(1)}:`));

    for (const rec of recommendations) {
      const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      const effortIcon = rec.effort === 'easy' ? '✅' : rec.effort === 'medium' ? '⚠️' : '🔧';

      console.log(chalk.gray(`\n  ${priorityIcon} ${chalk.bold(rec.title)}`));
      console.log(chalk.gray(`    ${effortIcon} Effort: ${rec.effort} | Impact: ${rec.impact}`));
      console.log(chalk.gray(`    ${rec.description}`));

      if (rec.commands && rec.commands.length > 0) {
        console.log(chalk.gray('    Commands:'));
        for (const cmd of rec.commands) {
          console.log(chalk.cyan(`      ${cmd}`));
        }
      }

      if (rec.files && rec.files.length > 0) {
        console.log(chalk.gray('    Files:'), chalk.cyan(rec.files.slice(0, 3).join(', ')));
      }
    }
  }

  console.log('');
}

/**
 * Apply optimizations (placeholder for actual implementation)
 */
async function applyOptimizations(
  projectPath: string,
  serviceName: string,
  analysis: OptimizationAnalysis
): Promise<void> {
  console.log(chalk.gray('Applying optimizations...'));

  for (const rec of analysis.recommendations) {
    console.log(chalk.gray(`  • ${rec.title}`));

    // In a real implementation, this would:
    // - Generate code for missing files
    // - Modify existing configurations
    // - Install missing dependencies
    // - Apply framework-specific optimizations
  }
}

/**
 * List all available optimization recommendations
 */
export async function listOptimizationRecommendations(framework?: string): Promise<void> {
  console.log(chalk.bold('\n🔧 Available Optimizations\n'));

  if (framework && frameworkOptimizations[framework]) {
    console.log(chalk.cyan(`Framework-specific optimizations for ${framework}:\n`));

    for (const rec of frameworkOptimizations[framework]) {
      const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`${priorityIcon} ${rec.title}`);
      console.log(chalk.gray(`   ${rec.description}`));
      console.log(chalk.gray(`   Impact: ${rec.impact}\n`));
    }
  }

  console.log(chalk.cyan('\nGeneric optimizations (all frameworks):\n'));

  for (const rec of genericOptimizations) {
    const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
    console.log(`${priorityIcon} ${rec.title}`);
    console.log(chalk.gray(`   ${rec.description}\n`));
  }

  console.log('');
}
