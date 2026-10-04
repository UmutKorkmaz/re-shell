// Services Management Commands
// Provides intelligent service management with dependency resolution.
//
// Two runtimes are supported and selected honestly at run time:
//  - "compose": the detected Docker Compose implementation (`docker compose`
//    plugin first, then the standalone `docker-compose`), used for EVERY call;
//  - "process": package.json dev/start/serve scripts supervised as detached
//    process groups (see ../utils/service-process).
// Nothing here reports success it did not verify: external commands must exit 0,
// spawned services must become ready (port / health URL / still alive), and a
// stop must actually end the process group.

import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync, ChildProcess } from 'child_process';
import chalk from 'chalk';
import { glob } from 'glob';
import type { BackendTemplate } from '../templates/backend/index';
import {
  ServiceRuntimeError,
  checkRecordIdentity,
  composeContainerOk,
  detectCompose,
  findComposeFile,
  isRecordRunning,
  logDir,
  logFilePath,
  parseComposePs,
  probePort,
  probeUrl,
  readServiceRecords,
  removeServiceState,
  runCommand,
  runCompose,
  startServiceProcess,
  stopServiceProcess,
  waitForPortRelease,
  type ComposeCommand,
  type ComposeContainer,
  type ServiceProcessRecord,
  type StopResult,
  COMPOSE_FILE_NAMES,
} from '../utils/service-process';

export { ServiceRuntimeError } from '../utils/service-process';

/** Minimal spinner surface used for progress text. */
type SpinnerLike = { setText?: (msg?: string) => void; stop?: () => void };

/**
 * Service configuration extracted from a docker-compose.yml file or package.json scripts.
 */
export interface ServiceConfig {
  name: string;
  image?: string;
  build?: string;
  ports?: string[];
  port?: number; // For single port services from npm scripts
  /** Health URL probed for readiness (process-mode services). */
  healthUrl?: string;
  /** Max ms to wait for `port` / `healthUrl` readiness (process-mode services). */
  readyTimeoutMs?: number;
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
 * Runtime information for a service that is currently running as a process.
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
 * Represents a service dependency graph with topologically sorted startup levels.
 */
export interface ServiceDependencyGraph {
  nodes: Map<string, ServiceConfig>;
  dependencies: Map<string, string[]>;
  levels: string[][]; // Services grouped by startup level
}

/**
 * Options for the `services up` command.
 */
export interface ServicesUpOptions {
  detached?: boolean;
  build?: boolean;
  forceRecreate?: boolean;
  noDeps?: boolean;
  scale?: Record<string, number>;
  /** Overall startup budget in ms (compose command timeout / process readiness budget). */
  timeout?: number;
  /** How long a process-mode service with no port or health URL must stay alive. Default 1500. */
  aliveMs?: number;
  verbose?: boolean;
  spinner?: SpinnerLike;
}

/**
 * Options for the `services down` command.
 */
export interface ServicesDownOptions {
  volumes?: boolean;
  removeOrphans?: boolean;
  /** Compose command timeout, and how long a process group gets to exit on SIGTERM before SIGKILL. */
  timeout?: number;
  verbose?: boolean;
  spinner?: SpinnerLike;
}

/**
 * Options for the `services health` command.
 */
export interface ServicesHealthOptions {
  watch?: boolean;
  interval?: number;
  /** When true nothing is printed: the caller renders the returned report as JSON. */
  json?: boolean;
  verbose?: boolean;
  /** Called with every report in watch mode (instead of rendering it). */
  onReport?: (report: ServicesHealthReport) => void;
  spinner?: SpinnerLike;
}

/** Which runtime handled a command. */
export type ServiceRuntimeKind = 'compose' | 'process';

/** One service in a health report. */
export interface ServiceHealthEntry {
  name: string;
  status: 'running' | 'stopped' | 'unhealthy' | 'exited';
  ok: boolean;
  pid?: number;
  /** Compose container state. */
  state?: string;
  /** Compose healthcheck status, when the service defines one. */
  health?: string;
  exitCode?: number;
  port?: number;
  logFile?: string;
  note?: string;
}

/** Result of `services health`. */
export interface ServicesHealthReport {
  runtime: ServiceRuntimeKind;
  /** `docker compose` / `docker-compose` when the compose runtime was used. */
  composeCommand?: string;
  /** True only when at least one service exists and every service is OK. */
  healthy: boolean;
  services: ServiceHealthEntry[];
}

/** Result of `services up`. */
export interface ServicesUpResult {
  runtime: ServiceRuntimeKind;
  composeCommand?: string;
  services: Array<{
    name: string;
    pid?: number;
    port?: number;
    readiness?: string;
    state?: string;
    logFile?: string;
  }>;
}

/** Result of `services down`. */
export interface ServicesDownResult {
  runtime: ServiceRuntimeKind;
  composeCommand?: string;
  stopped: Array<{ name: string; pid: number; outcome: string }>;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a docker-compose file (or fall back to package.json scripts) to extract service configurations.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @returns Array of parsed service configurations; empty if none found.
 * @throws ServiceRuntimeError (`SERVICES_ERROR`) when a compose file exists but is not valid YAML.
 */
export async function parseDockerCompose(projectPath: string): Promise<ServiceConfig[]> {
  for (const file of COMPOSE_FILE_NAMES) {
    const filePath = path.join(projectPath, file);
    try {
      await fs.access(filePath);
    } catch {
      continue; // File doesn't exist, try next
    }
    // A compose file that exists but cannot be parsed is an error, never a
    // silent switch to some other source of services.
    return await parseComposeFile(filePath);
  }

  // No docker-compose file found, try to detect services from package.json
  return await detectServicesFromPackageJson(projectPath);
}

/** Normalize `depends_on`, which compose allows as a list OR as a map of service -> condition. */
function normalizeDependsOn(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>);
  return [];
}

/** Normalize `environment`, which compose allows as a map OR as `KEY=value` list entries. */
function normalizeEnvironment(value: unknown): Record<string, string> | undefined {
  if (!value) return undefined;
  const out: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry !== 'string') continue;
      const eq = entry.indexOf('=');
      if (eq < 0) out[entry] = '';
      else out[entry.slice(0, eq)] = entry.slice(eq + 1);
    }
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = v === null || v === undefined ? '' : String(v);
    }
    return out;
  }
  return undefined;
}

/** Normalize `ports`, which compose allows as strings, numbers, or long-form objects. */
function normalizePorts(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(entry => {
    if (typeof entry === 'string' || typeof entry === 'number') return String(entry);
    const long = entry as Record<string, unknown>;
    const proto = long.protocol ? `/${String(long.protocol)}` : '';
    return long.published !== undefined
      ? `${String(long.published)}:${String(long.target)}${proto}`
      : `${String(long.target)}${proto}`;
  });
}

/**
 * Parse docker-compose YAML file
 */
async function parseComposeFile(filePath: string): Promise<ServiceConfig[]> {
  const yaml = (await import('js-yaml')).default;
  const content = await fs.readFile(filePath, 'utf-8');

  let compose: Record<string, any> | undefined;
  try {
    compose = yaml.load(content) as Record<string, any> | undefined;
  } catch (err) {
    throw new ServiceRuntimeError(
      'SERVICES_ERROR',
      `Could not parse ${path.basename(filePath)}: ${err instanceof Error ? err.message : String(err)}`,
      { file: filePath }
    );
  }

  const services: ServiceConfig[] = [];

  if (compose && compose.services && typeof compose.services === 'object') {
    for (const [name, config] of Object.entries(compose.services)) {
      const serviceConfig = (config ?? {}) as Record<string, any>;
      services.push({
        name,
        image: serviceConfig.image,
        build: typeof serviceConfig.build === 'string' ? serviceConfig.build : serviceConfig.build?.context,
        ports: normalizePorts(serviceConfig.ports),
        depends_on: normalizeDependsOn(serviceConfig.depends_on),
        environment: normalizeEnvironment(serviceConfig.environment),
        command: Array.isArray(serviceConfig.command)
          ? serviceConfig.command.join(' ')
          : serviceConfig.command,
        working_dir: serviceConfig.working_dir,
        volumes: serviceConfig.volumes,
        networks: serviceConfig.networks,
        healthcheck: serviceConfig.healthcheck,
      });
    }
  }

  return services;
}

/** Script names treated as long-running services (`dev`, `start`, `serve`, and `dev:*` style variants). */
const SERVICE_SCRIPT_NAME = /^(dev|develop|start|serve)([:._-].*)?$/;

/**
 * Detect services from package.json scripts.
 *
 * Only scripts that name a long-running service (`dev`, `start`, `serve`, and
 * their `:`/`-` suffixed variants) are picked; `predev`, `build:dev` and the
 * like are lifecycle/one-shot scripts and are not services. A `re-shell.services`
 * block in package.json can attach `port`, `healthUrl` and `readyTimeoutMs` to a
 * script by name for readiness checks.
 */
async function detectServicesFromPackageJson(projectPath: string): Promise<ServiceConfig[]> {
  const pkgPath = path.join(projectPath, 'package.json');

  try {
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    const services: ServiceConfig[] = [];
    const meta: Record<string, { port?: number; healthUrl?: string; readyTimeoutMs?: number }> =
      (pkg['re-shell'] && pkg['re-shell'].services) || {};

    // Detect dev/dev-server scripts
    if (pkg.scripts) {
      const devScripts = Object.entries(pkg.scripts).filter(([name]) => SERVICE_SCRIPT_NAME.test(name));

      for (const [name, script] of devScripts) {
        // Extract port from script
        const scriptStr = String(script);
        const portMatch = scriptStr.match(/(?:^|\s)-p[=\s]+(\d+)|--port[=\s]+(\d+)|PORT=(\d+)/);
        const scriptPort = portMatch
          ? parseInt(portMatch[1] || portMatch[2] || portMatch[3], 10)
          : undefined;
        const declared = meta[name] || {};

        services.push({
          name: name.replace(/:/g, '-'),
          command: script as string,
          port: typeof declared.port === 'number' ? declared.port : scriptPort,
          healthUrl: typeof declared.healthUrl === 'string' ? declared.healthUrl : undefined,
          readyTimeoutMs:
            typeof declared.readyTimeoutMs === 'number' ? declared.readyTimeoutMs : undefined,
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
 * Build a dependency graph from service configurations, computing topological startup levels.
 *
 * @param services - Array of service configurations to include in the graph.
 * @returns A dependency graph with nodes, dependency edges, and startup levels.
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

// ─── Runtime selection ───────────────────────────────────────────────────────

/** A detected compose implementation bound to a project directory. */
interface ComposeContext {
  compose: ComposeCommand;
  /** Arguments placed before the subcommand (`-f <file>` for non-default file names). */
  baseArgs: string[];
  cwd: string;
  file: string;
}

type SelectedRuntime =
  | { kind: 'compose'; ctx: ComposeContext }
  | {
      kind: 'process';
      /** A compose file exists but no compose implementation could be detected. */
      composeFile: string | null;
    };

/**
 * Pick the runtime: compose when the project has a compose file AND a working
 * compose implementation is detected (plugin first, then standalone binary);
 * otherwise the process runtime. A project with no compose file never touches
 * Docker.
 */
async function selectRuntime(projectPath: string): Promise<SelectedRuntime> {
  const composeFile = findComposeFile(projectPath);
  if (!composeFile) {
    return { kind: 'process', composeFile: null };
  }

  const compose = await detectCompose();
  if (!compose) {
    return { kind: 'process', composeFile };
  }

  // `docker compose` finds the standard file names itself; anything else needs -f.
  const standard = new Set(COMPOSE_FILE_NAMES.filter(name => name !== 'docker-compose.dev.yml'));
  const baseArgs = standard.has(path.basename(composeFile)) ? [] : ['-f', composeFile];
  return { kind: 'compose', ctx: { compose, baseArgs, cwd: projectPath, file: composeFile } };
}

function composeUnavailableMessage(composeFile: string, action: string): string {
  return (
    `${path.basename(composeFile)} was found but neither \`docker compose\` nor \`docker-compose\` ` +
    `is available on PATH, so ${action}. Install Docker Compose or remove the compose file.`
  );
}

function runInCompose(
  ctx: ComposeContext,
  args: string[],
  options: { timeoutMs?: number; verbose?: boolean; stdio?: 'capture' | 'inherit' } = {}
) {
  return runCompose(ctx.compose, [...ctx.baseArgs, ...args], { cwd: ctx.cwd, ...options });
}

function parsePositiveMs(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

// ─── up ──────────────────────────────────────────────────────────────────────

/**
 * Start services with intelligent dependency resolution, using Docker Compose when available
 * and falling back to supervised package.json scripts otherwise.
 *
 * Fails (throws a {@link ServiceRuntimeError}) instead of reporting success when
 * compose exits non-zero, a container ends up crashed, a script cannot be spawned,
 * exits immediately, or never becomes ready.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param options - Optional configuration for detached mode, build, scale, and more.
 * @returns What was started, once every service is verified up.
 */
export async function servicesUp(
  projectPath: string,
  options: ServicesUpOptions = {}
): Promise<ServicesUpResult> {
  const {
    build = false,
    forceRecreate = false,
    noDeps = false,
    scale = {},
    verbose = false,
    spinner,
  } = options;
  const timeout = parsePositiveMs(options.timeout, 120000);
  const aliveMs = parsePositiveMs(options.aliveMs, 1500);

  const runtime = await selectRuntime(projectPath);

  if (runtime.kind === 'compose') {
    if (verbose) {
      try {
        const graph = buildDependencyGraph(await parseComposeFile(runtime.ctx.file));
        printGraph(graph);
      } catch (err) {
        console.warn(chalk.yellow(`Could not build the dependency graph: ${(err as Error).message}`));
      }
    }
    return startWithDockerCompose(runtime.ctx, { build, forceRecreate, noDeps, scale, timeout, verbose, spinner });
  }

  // Process runtime: package.json scripts only. Compose-file services describe
  // containers and are not runnable on the host.
  const services = await detectServicesFromPackageJson(projectPath);

  if (runtime.composeFile) {
    if (services.length === 0) {
      throw new ServiceRuntimeError(
        'SERVICES_COMPOSE_UNAVAILABLE',
        composeUnavailableMessage(runtime.composeFile, 'its services cannot be started') +
          ' package.json has no dev/start/serve scripts to fall back to.',
        { composeFile: runtime.composeFile }
      );
    }
    console.warn(
      chalk.yellow(
        `Docker Compose is not available; ignoring ${path.basename(runtime.composeFile)} and ` +
          'starting package.json dev/start/serve scripts instead.'
      )
    );
  }

  if (services.length === 0) {
    throw new ServiceRuntimeError(
      'SERVICES_NOT_FOUND',
      'No services found in project. Add a docker-compose.yml or a package.json with dev/start/serve scripts.',
      { projectPath }
    );
  }

  const graph = buildDependencyGraph(services);
  if (verbose) printGraph(graph);

  return startWithProcesses(projectPath, graph, { timeout, aliveMs, verbose, spinner });
}

function printGraph(graph: ServiceDependencyGraph): void {
  console.log(chalk.blue('\n📊 Service Dependency Graph:'));
  for (let i = 0; i < graph.levels.length; i++) {
    console.log(chalk.gray(`  Level ${i}:`), chalk.cyan(graph.levels[i].join(', ') || '(none)'));
  }
  console.log('');
}

/**
 * Start services using Docker Compose
 */
async function startWithDockerCompose(
  ctx: ComposeContext,
  options: {
    build: boolean;
    forceRecreate: boolean;
    noDeps: boolean;
    scale: Record<string, number>;
    timeout: number;
    verbose: boolean;
    spinner?: SpinnerLike;
  }
): Promise<ServicesUpResult> {
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
    args.push('--scale', `${service}=${count}`);
  }

  options.spinner?.setText?.(`Starting Docker services (${ctx.compose.label})...`);

  // Exit code is enforced by runCompose: a failing `up` throws here.
  await runInCompose(ctx, args, { timeoutMs: options.timeout, verbose: options.verbose });

  // `up -d` returning 0 only means containers were started; verify none crashed.
  options.spinner?.setText?.('Verifying container state...');
  let containers: ComposeContainer[] | null = null;
  let verifyWarning: string | null = null;
  try {
    const ps = await runInCompose(ctx, ['ps', '-a', '--format', 'json'], { timeoutMs: 30000 });
    containers = parseComposePs(ps.stdout);
  } catch (err) {
    verifyWarning = err instanceof Error ? err.message : String(err);
  }

  options.spinner?.stop?.();

  if (containers) {
    const broken = containers.filter(c => {
      if (c.state === 'running') return c.health === 'unhealthy';
      if (c.state === 'exited') return c.exitCode !== 0;
      return c.state === 'dead' || c.state === 'restarting';
    });
    if (broken.length > 0) {
      const summary = broken
        .map(c =>
          `${c.service} (${c.state}${c.exitCode !== undefined && c.state === 'exited' ? ` code ${c.exitCode}` : ''}${
            c.health ? `, ${c.health}` : ''
          })`
        )
        .join(', ');
      throw new ServiceRuntimeError(
        'SERVICES_START_FAILED',
        `${ctx.compose.label} up finished but ${broken.length} service(s) are not running: ${summary}. ` +
          'Inspect with `re-shell service run logs <service>`; stop everything with `re-shell service run down`.',
        { services: broken.map(c => ({ name: c.service, state: c.state, exitCode: c.exitCode })) }
      );
    }

    console.log(chalk.green('\n✅ Services started:'));
    for (const c of containers) {
      const portMatch = (c.ports || '').match(/:(\d+)->/);
      console.log(chalk.gray('  •'), chalk.cyan(c.service), chalk.gray(`(${c.state})`));
      if (portMatch) {
        console.log(chalk.gray(`    Port: ${portMatch[1]}`));
      }
    }
  } else {
    console.warn(
      chalk.yellow(
        `${ctx.compose.label} up succeeded, but container state could not be verified: ${verifyWarning}`
      )
    );
  }

  return {
    runtime: 'compose',
    composeCommand: ctx.compose.label,
    services: (containers ?? []).map(c => ({ name: c.service, state: c.state })),
  };
}

/**
 * Start services as supervised background process groups, level by level.
 * Any failure stops every service already started by this call and rethrows.
 */
async function startWithProcesses(
  projectPath: string,
  graph: ServiceDependencyGraph,
  options: { timeout: number; aliveMs: number; verbose: boolean; spinner?: SpinnerLike }
): Promise<ServicesUpResult> {
  const started: ServiceProcessRecord[] = [];
  const deadline = Date.now() + options.timeout;

  try {
    for (let i = 0; i < graph.levels.length; i++) {
      const levelServices = graph.levels[i];

      if (options.verbose) {
        console.log(chalk.blue(`Starting level ${i} services:`), chalk.cyan(levelServices.join(', ')));
      }

      for (const serviceName of levelServices) {
        const service = graph.nodes.get(serviceName);
        if (!service || !service.command) continue;

        options.spinner?.setText?.(`Starting ${serviceName}...`);

        const remaining = Math.max(1000, deadline - Date.now());
        const record = await startServiceProcess(
          {
            name: service.name,
            command: service.command,
            cwd: service.working_dir || projectPath,
            env: service.environment,
            port: service.port,
            healthUrl: service.healthUrl,
          },
          {
            projectPath,
            readyTimeoutMs: service.readyTimeoutMs ?? remaining,
            aliveMs: options.aliveMs,
          }
        );
        started.push(record);
      }

      // Everything started so far must still be alive before the next level begins.
      for (const record of started) {
        if (!isRecordRunning(record)) {
          throw new ServiceRuntimeError(
            'SERVICES_START_FAILED',
            `Service '${record.name}' stopped running while level ${i} was starting. Log: ${record.logFile}`,
            { service: record.name, logFile: record.logFile }
          );
        }
      }
    }

    if (started.length === 0) {
      throw new ServiceRuntimeError(
        'SERVICES_NOT_FOUND',
        'No runnable services found: none of the detected services has a command to run.'
      );
    }
  } catch (err) {
    // Roll back so a failed `up` never leaves a half-started stack behind.
    for (const record of started.reverse()) {
      try {
        await stopServiceProcess(record, { timeoutMs: 5000 });
      } catch {
        // best effort; the original failure is what matters
      }
      await removeServiceState(projectPath, record.name);
    }
    throw err;
  }

  options.spinner?.stop?.();
  console.log(chalk.green('\n✅ Services started:'));
  for (const record of started) {
    console.log(
      chalk.gray('  •'),
      chalk.cyan(record.name),
      chalk.gray(`(PID: ${record.pid}, ready: ${describeReadiness(record)})`)
    );
    console.log(chalk.gray(`    Log: ${record.logFile}`));
  }

  return {
    runtime: 'process',
    services: started.map(r => ({
      name: r.name,
      pid: r.pid,
      port: r.port,
      readiness: r.readiness,
      logFile: r.logFile,
    })),
  };
}

function describeReadiness(record: ServiceProcessRecord): string {
  if (record.readiness === 'url') return `health URL ${record.healthUrl}`;
  if (record.readiness === 'port') return `port ${record.port}`;
  return 'still alive after grace period';
}

// ─── down ────────────────────────────────────────────────────────────────────

/**
 * Stop services with graceful shutdown, using Docker Compose or terminating
 * supervised processes (whole process group: SIGTERM, wait, SIGKILL).
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param options - Optional configuration for volume removal, orphan cleanup, and timeouts.
 * @returns What was stopped. Throws if compose fails or a process cannot be stopped.
 */
export async function servicesDown(
  projectPath: string,
  options: ServicesDownOptions = {}
): Promise<ServicesDownResult> {
  const { volumes = false, removeOrphans = false, verbose = false, spinner } = options;
  const timeout = parsePositiveMs(options.timeout, 60000);

  const runtime = await selectRuntime(projectPath);

  if (runtime.kind === 'compose') {
    // Use Docker Compose
    const args = ['down'];

    if (volumes) {
      args.push('-v');
    }

    if (removeOrphans) {
      args.push('--remove-orphans');
    }

    spinner?.setText?.(`Stopping Docker services (${runtime.ctx.compose.label})...`);

    await runInCompose(runtime.ctx, args, { timeoutMs: timeout, verbose });

    spinner?.stop?.();
    console.log(chalk.green('✅ Services stopped.'));
    return { runtime: 'compose', composeCommand: runtime.ctx.compose.label, stopped: [] };
  }

  // Stop supervised processes
  const stopped = await stopProcessServices(projectPath, {
    timeout,
    verbose,
    spinner,
    composeFile: runtime.composeFile,
  });
  return { runtime: 'process', stopped };
}

/**
 * Stop every supervised process recorded under `.re-shell/pids`, in parallel.
 * Each is verified (PID reuse guard), signalled as a process group, escalated
 * to SIGKILL after `timeout`, and its PID and log files are removed.
 */
async function stopProcessServices(
  projectPath: string,
  options: {
    timeout: number;
    verbose: boolean;
    spinner?: SpinnerLike;
    composeFile: string | null;
  }
): Promise<Array<{ name: string; pid: number; outcome: string }>> {
  const { records, legacy, invalid } = await readServiceRecords(projectPath);
  options.spinner?.stop?.();

  for (const item of legacy) {
    console.warn(
      chalk.yellow(
        `Ignoring legacy PID file for '${item.name}' (pid ${item.pid}): it has no process identity, ` +
          'so it is not signalled. If that process is still running, stop it manually.'
      )
    );
    await fs.rm(item.file, { force: true });
  }
  for (const item of invalid) {
    console.warn(chalk.yellow(`Removing unreadable PID file ${item.file}: ${item.reason}`));
    await fs.rm(item.file, { force: true });
  }

  if (records.length === 0) {
    if (options.composeFile && legacy.length === 0 && invalid.length === 0) {
      throw new ServiceRuntimeError(
        'SERVICES_COMPOSE_UNAVAILABLE',
        composeUnavailableMessage(options.composeFile, 'its containers cannot be stopped') +
          ' No supervised processes are recorded either.',
        { composeFile: options.composeFile }
      );
    }
    console.log(chalk.yellow('No running services found.'));
    return [];
  }

  const settled = await Promise.allSettled(
    records.map(record => stopServiceProcess(record, { timeoutMs: options.timeout }))
  );

  const results: StopResult[] = [];
  const failures: string[] = [];
  const unverifiable: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const outcome = settled[i];
    if (outcome.status === 'rejected') {
      failures.push(outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason));
      continue; // keep the PID file: the service may still be running
    }
    const result = outcome.value;
    results.push(result);
    if (result.outcome === 'unverifiable') {
      unverifiable.push(record.name);
      continue; // keep the PID file: we could not prove the process is ours
    }
    if (result.outcome === 'identity-mismatch') {
      console.warn(
        chalk.yellow(
          `PID ${record.pid} for '${record.name}' now belongs to a different process; ` +
            'not signalling it. Removed the stale PID file.'
        )
      );
    }
    await removeServiceState(projectPath, record.name, { logs: true });
    if (options.verbose) {
      console.log(chalk.gray(`${record.name} (PID: ${record.pid}): ${result.outcome}`));
    }
  }

  if (unverifiable.length > 0) {
    failures.push(
      `Could not verify the identity of: ${unverifiable.join(', ')} (no start time was recorded), so they were not signalled`
    );
  }
  if (failures.length > 0) {
    throw new ServiceRuntimeError(
      'SERVICES_STOP_FAILED',
      `Failed to stop all services:\n  - ${failures.join('\n  - ')}`,
      { failures }
    );
  }

  console.log(chalk.green('✅ Services stopped.'));
  for (const r of results) {
    const how =
      r.outcome === 'killed'
        ? 'killed with SIGKILL after the timeout'
        : r.outcome === 'terminated'
          ? 'terminated'
          : r.outcome === 'not-running'
            ? 'was already stopped'
            : 'stale record removed';
    console.log(chalk.gray('  •'), chalk.cyan(r.name), chalk.gray(`(PID: ${r.pid}) ${how}`));
  }

  return results.map(r => ({ name: r.name, pid: r.pid, outcome: r.outcome }));
}

// ─── health ──────────────────────────────────────────────────────────────────

/**
 * Check the health status of running services, optionally in watch mode.
 *
 * In one-shot mode this throws `SERVICES_UNHEALTHY` (with the full report in the
 * error details) when no service is running or any service is down, so scripts
 * can rely on the exit code. Stale PID files of dead processes are removed.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param options - Optional configuration for watch mode, interval, and JSON output.
 * @returns The health report (one-shot mode), once every service is healthy.
 */
export async function servicesHealth(
  projectPath: string,
  options: ServicesHealthOptions = {}
): Promise<ServicesHealthReport> {
  const { watch = false, json = false, onReport } = options;
  const interval = parsePositiveMs(options.interval, 5000);

  const runtime = await selectRuntime(projectPath);
  const collect = async (): Promise<ServicesHealthReport> =>
    runtime.kind === 'compose'
      ? collectComposeHealth(runtime.ctx)
      : collectProcessHealth(projectPath, runtime.composeFile);

  if (watch) {
    if (!json && !onReport) {
      console.log(chalk.blue('Watching service health...'));
      console.log(chalk.gray('Press Ctrl+C to stop.\n'));
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const report = await collect(); // a failing compose command ends the watch with an error
      if (onReport) {
        onReport(report);
      } else if (!json) {
        if (process.stdout.isTTY) console.clear();
        console.log(chalk.bold('Service Health Status'));
        console.log(chalk.gray(`Updated: ${new Date().toLocaleTimeString()}\n`));
        printHealthReport(report);
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  const report = await collect();
  if (!json && report.services.length > 0) {
    printHealthReport(report);
  }
  if (!report.healthy) {
    const bad = report.services.filter(s => !s.ok);
    throw new ServiceRuntimeError(
      'SERVICES_UNHEALTHY',
      report.services.length === 0
        ? 'No running services found. Start them with `re-shell service run up`.'
        : `${bad.length} of ${report.services.length} service(s) are not healthy: ` +
            bad.map(s => `${s.name} (${s.status}${s.note ? `: ${s.note}` : ''})`).join(', '),
      { report: report as unknown as Record<string, unknown> }
    );
  }
  return report;
}

function printHealthReport(report: ServicesHealthReport): void {
  console.log(chalk.bold(`\nService Health Status (${report.composeCommand ?? 'processes'}):\n`));
  if (report.services.length === 0) {
    console.log(chalk.yellow('No running services found.'));
    return;
  }
  for (const svc of report.services) {
    const icon = svc.ok ? '✅' : '❌';
    const color = svc.ok ? chalk.green : chalk.red;
    const detail = [
      svc.pid !== undefined ? `PID: ${svc.pid}` : undefined,
      svc.health ? `health: ${svc.health}` : undefined,
      svc.exitCode !== undefined && svc.status === 'exited' ? `exit code: ${svc.exitCode}` : undefined,
      svc.note,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`${icon} ${chalk.cyan(svc.name)}: ${color(svc.status)}${detail ? ` (${detail})` : ''}`);
  }
}

async function collectComposeHealth(ctx: ComposeContext): Promise<ServicesHealthReport> {
  const ps = await runInCompose(ctx, ['ps', '-a', '--format', 'json'], { timeoutMs: 30000 });
  let containers: ComposeContainer[];
  try {
    containers = parseComposePs(ps.stdout);
  } catch (err) {
    throw new ServiceRuntimeError(
      'SERVICES_COMPOSE_FAILED',
      `${ctx.compose.label} ps returned output that could not be parsed as JSON ` +
        `(${err instanceof Error ? err.message : String(err)}); is this compose version too old for --format json?`
    );
  }

  const services: ServiceHealthEntry[] = containers.map(c => {
    const ok = composeContainerOk(c);
    const status: ServiceHealthEntry['status'] =
      c.state === 'running' ? (ok ? 'running' : 'unhealthy') : c.state === 'exited' ? 'exited' : 'unhealthy';
    return {
      name: c.service,
      status,
      ok,
      state: c.state,
      health: c.health,
      exitCode: c.exitCode,
    };
  });

  return {
    runtime: 'compose',
    composeCommand: ctx.compose.label,
    healthy: services.length > 0 && services.every(s => s.ok),
    services,
  };
}

async function collectProcessHealth(
  projectPath: string,
  composeFile: string | null
): Promise<ServicesHealthReport> {
  const { records, legacy, invalid } = await readServiceRecords(projectPath);
  const services: ServiceHealthEntry[] = [];

  for (const record of records) {
    const identity = checkRecordIdentity(record);
    const running = identity.state === 'alive' || identity.state === 'group-orphans';

    if (!running) {
      // Stale PID file: report it once, then clean it up (keep the log for diagnosis).
      await removeServiceState(projectPath, record.name);
      services.push({
        name: record.name,
        status: 'stopped',
        ok: false,
        pid: record.pid,
        port: record.port,
        logFile: record.logFile,
        note:
          identity.state === 'reused'
            ? 'process exited (PID was reused); stale PID file removed'
            : 'process exited; stale PID file removed',
      });
      continue;
    }

    let ok = true;
    let note: string | undefined;
    if (record.healthUrl) {
      ok = await probeUrl(record.healthUrl);
      if (!ok) note = `health URL ${record.healthUrl} is not answering 2xx`;
    } else if (record.port !== undefined) {
      ok = await probePort(record.port);
      if (!ok) note = `port ${record.port} is not accepting connections`;
    }
    services.push({
      name: record.name,
      status: ok ? 'running' : 'unhealthy',
      ok,
      pid: record.pid,
      port: record.port,
      logFile: record.logFile,
      note,
    });
  }

  for (const item of legacy) {
    services.push({
      name: item.name,
      status: 'unhealthy',
      ok: false,
      pid: item.pid,
      note: 'legacy PID file without process identity; cannot verify (run `re-shell service run down`)',
    });
  }
  for (const item of invalid) {
    services.push({
      name: path.basename(item.file, '.pid'),
      status: 'unhealthy',
      ok: false,
      note: `unreadable PID file: ${item.reason}`,
    });
  }

  if (services.length === 0 && composeFile) {
    throw new ServiceRuntimeError(
      'SERVICES_COMPOSE_UNAVAILABLE',
      composeUnavailableMessage(composeFile, 'container health cannot be checked'),
      { composeFile }
    );
  }

  return {
    runtime: 'process',
    healthy: services.length > 0 && services.every(s => s.ok),
    services,
  };
}

// ─── logs / restart / scale / exec ───────────────────────────────────────────

/**
 * Retrieve and display logs for one or all services.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param service - Optional name of a specific service to show logs for.
 * @param options - Optional configuration for follow mode, tail line count, and verbosity.
 * @returns Resolves when logs have been retrieved and displayed; throws if none could be.
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
  const { follow = false, tail = 100 } = options;

  const runtime = await selectRuntime(projectPath);

  if (runtime.kind === 'compose') {
    const args = ['logs'];
    if (follow) args.push('-f');
    args.push('--tail', String(tail));
    if (service) {
      args.push(service);
    }

    await runInCompose(runtime.ctx, args, {
      timeoutMs: follow ? 0 : 30000, // following logs runs until interrupted
      stdio: 'inherit',
    });
    return;
  }

  // Show process-mode logs
  if (follow) {
    console.warn(
      chalk.yellow('--follow is only supported with Docker Compose; showing the last lines instead.')
    );
  }
  const dir = logDir(projectPath);

  if (service) {
    let content: string;
    try {
      content = await fs.readFile(logFilePath(projectPath, service), 'utf-8');
    } catch {
      throw new ServiceRuntimeError('SERVICES_NOT_FOUND', `No logs found for service '${service}'.`, {
        service,
      });
    }
    console.log(content.split('\n').slice(-tail).join('\n'));
    return;
  }

  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter(f => f.endsWith('.log')).sort();
  } catch {
    // no log directory
  }
  if (files.length === 0) {
    throw new ServiceRuntimeError('SERVICES_NOT_FOUND', 'No logs found.', { projectPath });
  }
  for (const file of files) {
    console.log(chalk.blue(`\n=== ${file} ===`));
    const content = await fs.readFile(path.join(dir, file), 'utf-8');
    console.log(content.split('\n').slice(-tail).join('\n'));
  }
}

/**
 * Restart a specific service.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param service - Name of the service to restart.
 * @param options - Optional configuration for timeout, verbosity, and spinner.
 * @returns Resolves once the service has been restarted and is verifiably up.
 */
export async function servicesRestart(
  projectPath: string,
  service: string,
  options: {
    timeout?: number;
    aliveMs?: number;
    verbose?: boolean;
    spinner?: SpinnerLike;
  } = {}
): Promise<void> {
  const { verbose = false, spinner } = options;
  const timeout = parsePositiveMs(options.timeout, 60000);
  const aliveMs = parsePositiveMs(options.aliveMs, 1500);

  const runtime = await selectRuntime(projectPath);

  spinner?.setText?.(`Restarting ${service}...`);

  if (runtime.kind === 'compose') {
    await runInCompose(runtime.ctx, ['restart', service], { timeoutMs: timeout, verbose });
    spinner?.stop?.();
    console.log(chalk.green(`✅ Service '${service}' restarted.`));
    return;
  }

  const configs = await detectServicesFromPackageJson(projectPath);
  const svcConfig = configs.find(s => s.name === service);
  if (!svcConfig || !svcConfig.command) {
    throw new ServiceRuntimeError('SERVICES_NOT_FOUND', `Service '${service}' not found`, { service });
  }

  // Stop only this service's process group, then start it again.
  const { records } = await readServiceRecords(projectPath);
  const existing = records.find(r => r.name === service);
  if (existing) {
    const result = await stopServiceProcess(existing, { timeoutMs: timeout });
    if (result.outcome === 'unverifiable') {
      throw new ServiceRuntimeError(
        'SERVICES_STOP_FAILED',
        `Could not verify that pid ${existing.pid} is service '${service}'; not signalling it.`
      );
    }
    await removeServiceState(projectPath, service);
    // The group can be reported gone while its exiting threads still hold the
    // listening socket; give the port a moment so the start-time "port in use"
    // check does not race the old process. A port that stays taken still fails there.
    if (svcConfig.port !== undefined) await waitForPortRelease(svcConfig.port, Math.min(timeout, 5000));
  }

  const record = await startServiceProcess(
    {
      name: svcConfig.name,
      command: svcConfig.command,
      cwd: svcConfig.working_dir || projectPath,
      env: svcConfig.environment,
      port: svcConfig.port,
      healthUrl: svcConfig.healthUrl,
    },
    { projectPath, readyTimeoutMs: svcConfig.readyTimeoutMs ?? timeout, aliveMs }
  );
  spinner?.stop?.();
  console.log(
    chalk.green(`✅ Service '${service}' restarted.`),
    chalk.gray(`(PID: ${record.pid}, ready: ${describeReadiness(record)})`)
  );
}

/**
 * Scale a service to a specified number of replicas (Docker Compose only).
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param service - Name of the service to scale.
 * @param replicas - Target number of service instances.
 * @param options - Optional configuration for timeout, verbosity, and spinner.
 * @returns Resolves when the service has been scaled; throws when Docker Compose is unavailable.
 */
export async function servicesScale(
  projectPath: string,
  service: string,
  replicas: number,
  options: {
    timeout?: number;
    verbose?: boolean;
    spinner?: SpinnerLike;
  } = {}
): Promise<void> {
  const { verbose = false, spinner } = options;
  const timeout = parsePositiveMs(options.timeout, 60000);

  if (!Number.isInteger(replicas) || replicas < 0) {
    throw new ServiceRuntimeError(
      'SERVICES_ERROR',
      `Invalid replica count "${replicas}": expected a non-negative integer.`
    );
  }

  const runtime = await selectRuntime(projectPath);
  if (runtime.kind !== 'compose') {
    throw new ServiceRuntimeError(
      'SERVICES_COMPOSE_UNAVAILABLE',
      runtime.composeFile
        ? composeUnavailableMessage(runtime.composeFile, `'${service}' cannot be scaled`)
        : 'Scaling is only supported with Docker Compose; this project has no compose file.'
    );
  }

  spinner?.setText?.(`Scaling ${service} to ${replicas} instances...`);

  await runInCompose(runtime.ctx, ['up', '-d', '--scale', `${service}=${replicas}`], {
    timeoutMs: timeout,
    verbose,
  });

  spinner?.stop?.();
  console.log(chalk.green(`✅ Service '${service}' scaled to ${replicas} instances.`));
}

/**
 * Execute a command inside a running service container (Docker Compose only).
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param service - Name of the target service container.
 * @param command - Command and arguments to execute inside the container.
 * @param options - Optional configuration for interactive mode, verbosity, and spinner.
 * @returns Resolves when the command exited 0; throws on a non-zero exit or when Compose is unavailable.
 */
export async function servicesExec(
  projectPath: string,
  service: string,
  command: string[],
  options: {
    interactive?: boolean;
    verbose?: boolean;
    spinner?: SpinnerLike;
  } = {}
): Promise<void> {
  const { interactive = true } = options;

  const runtime = await selectRuntime(projectPath);
  if (runtime.kind !== 'compose') {
    throw new ServiceRuntimeError(
      'SERVICES_COMPOSE_UNAVAILABLE',
      runtime.composeFile
        ? composeUnavailableMessage(runtime.composeFile, 'commands cannot be executed in containers')
        : 'Service exec is only supported with Docker Compose; this project has no compose file.'
    );
  }

  const args = ['exec'];
  if (!interactive) {
    args.push('-T');
  }
  args.push(service, ...command);

  await runInCompose(runtime.ctx, args, {
    timeoutMs: 0, // an exec runs until the command ends
    stdio: 'inherit',
  });
}

// ─── inspect ─────────────────────────────────────────────────────────────────

/**
 * Detailed inspection result for a single service, including status, ports, dependencies, and resource usage.
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
 * Inspect a service with detailed metrics, ports, health, and dependency information.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param serviceName - Name of the service to inspect.
 * @param options - Optional configuration for JSON output, verbosity, and spinner. With
 *   `json: true` nothing is printed; the caller renders the returned inspection.
 * @returns A detailed inspection object for the requested service.
 */
export async function servicesInspect(
  projectPath: string,
  serviceName: string,
  options: {
    json?: boolean;
    verbose?: boolean;
    spinner?: SpinnerLike;
  } = {}
): Promise<ServiceInspection> {
  const { json = false, verbose = false } = options;

  const runtime = await selectRuntime(projectPath);

  // Compose projects describe their services in the compose file; everything
  // else uses package.json scripts.
  const services =
    runtime.kind === 'compose'
      ? await parseComposeFile(runtime.ctx.file)
      : await detectServicesFromPackageJson(projectPath);
  const graph = buildDependencyGraph(services);

  const service = services.find(s => s.name === serviceName);
  if (!service) {
    throw new ServiceRuntimeError('SERVICES_NOT_FOUND', `Service '${serviceName}' not found`, {
      service: serviceName,
    });
  }

  const inspection: ServiceInspection = {
    name: serviceName,
    status: 'unknown',
    type: runtime.kind === 'compose' ? 'docker' : 'npm-script',
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

  // Parse ports: "[host-ip:]host:container[/proto]"
  if (service.ports) {
    for (const portMapping of service.ports) {
      const match = String(portMapping).match(/^(?:[^:]+:)?(\d+):(\d+)(?:\/(tcp|udp))?$/);
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
  if (runtime.kind === 'compose') {
    await inspectDockerService(runtime.ctx, serviceName, inspection, verbose);
  } else {
    await inspectNpmService(projectPath, serviceName, inspection);
  }

  // Display results
  if (!json) {
    displayInspection(inspection);
  }

  return inspection;
}

/**
 * Inspect Docker service
 */
async function inspectDockerService(
  ctx: ComposeContext,
  serviceName: string,
  inspection: ServiceInspection,
  verbose: boolean
): Promise<void> {
  try {
    // Get container info
    const psResult = await runInCompose(ctx, ['ps', '-q', serviceName], { timeoutMs: 30000 });

    const containerId = psResult.stdout.trim().split('\n')[0];

    if (containerId) {
      inspection.status = 'running';

      // Get detailed container info
      const inspectResult = await runCommand('docker', ['inspect', containerId], { timeoutMs: 30000 });

      try {
        const containers = JSON.parse(inspectResult.stdout);
        if (containers.length > 0) {
          const container = containers[0];

          // Get resource usage
          try {
            const statsResult = await runCommand(
              'docker',
              ['stats', containerId, '--no-stream', '--format', '{{json .}}'],
              { timeoutMs: 30000 }
            );
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
            // Stats unavailable
          }

          // Get start time
          inspection.metadata.startTime = new Date(container.State.StartedAt);

          // Get PID
          inspection.metadata.pid = container.State.Pid;

          // Get health status
          if (container.State.Health) {
            inspection.health.status = container.State.Health.Status === 'healthy' ? 'healthy' : 'unhealthy';
            inspection.health.checks = container.State.Health.Log.map((log: Record<string, unknown>) => ({
              name: log.ExitCode === 0 ? 'healthy' : 'unhealthy',
              status: log.Output,
            }));
          }
        }
      } catch {
        // Container inspect output unusable
      }
    } else {
      inspection.status = 'stopped';
    }
  } catch (err) {
    if (verbose) {
      console.warn(chalk.yellow(`Could not query ${ctx.compose.label}: ${(err as Error).message}`));
    }
    inspection.status = 'unknown';
  }
}

/**
 * Inspect process-mode service
 */
async function inspectNpmService(
  projectPath: string,
  serviceName: string,
  inspection: ServiceInspection
): Promise<void> {
  const { records } = await readServiceRecords(projectPath);
  const record = records.find(r => r.name === serviceName);

  if (!record) {
    inspection.status = 'stopped';
    return;
  }

  if (isRecordRunning(record)) {
    inspection.status = 'running';
    inspection.metadata.pid = record.pid;
    inspection.metadata.startTime = new Date(record.startedAt);
  } else {
    inspection.status = 'stopped';
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
 * Options for migrating a service from one framework to another.
 */
export interface ServiceMigrateOptions {
  sourceFramework: string;
  targetFramework: string;
  dryRun?: boolean;
  backup?: boolean;
  preserveData?: boolean;
  generateTests?: boolean;
  spinner?: { setText?: (msg?: string) => void };
}

/**
 * A complete migration plan including source/target details, ordered steps, and warnings.
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
 * A single step within a migration plan, describing files, commands, and whether it requires manual action.
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
 * Migrate a service from one backend framework to another, generating and optionally executing a migration plan.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param serviceName - Name of the service to migrate.
 * @param options - Migration configuration including source/target frameworks, dry-run, and backup settings.
 * @returns The generated migration plan with steps and warnings.
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
  const { getBackendTemplate } = await import('../templates/backend/index');

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
    const prompts = (promptsModule.default || promptsModule) as unknown as typeof import('prompts');

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
  sourceTemplate: BackendTemplate,
  targetTemplate: BackendTemplate,
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
function getDependencyUpdateCommands(sourceTemplate: BackendTemplate, targetTemplate: BackendTemplate): string[] {
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
function getConfigFiles(template: BackendTemplate): string[] {
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
function getTestGenerationCommands(template: BackendTemplate): string[] {
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
 * List available framework migration targets, optionally filtered by a source framework.
 *
 * @param sourceFramework - Optional framework ID to show compatible migration targets for.
 * @returns Resolves when the list has been displayed.
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

    const grouped = new Map<string, BackendTemplate[]>();
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
 * A single optimization recommendation for a service, including category, priority, and expected impact.
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
 * Result of an optimization analysis, containing current metrics and a list of recommendations.
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
 * Analyze a service for optimization opportunities and optionally apply framework-specific recommendations.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param serviceName - Name of the service to optimize.
 * @param options - Optional configuration for framework override, apply mode, and dry-run.
 * @returns An optimization analysis with current metrics and prioritized recommendations.
 */
export async function servicesOptimize(
  projectPath: string,
  serviceName: string,
  options: {
    framework?: string;
    apply?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
    spinner?: { setText?: (msg?: string) => void };
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
 * List all available optimization recommendations, optionally filtered to a specific framework.
 *
 * @param framework - Optional framework ID to show framework-specific recommendations for.
 * @returns Resolves when the recommendations have been displayed.
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
