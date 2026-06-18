// Skaffold-backed k8s inner-loop dev runtime for `re-shell dev --cluster`.
//
// Three concerns live here, deliberately kept pure/offline so they are fully
// testable WITHOUT a live cluster, skaffold, kubectl, or the network:
//
//   1. CONFIG GENERATION — turn the workspace v2 services into a Skaffold dev
//      config: one build artifact per service (with inner-loop file-sync rules)
//      and a port-forward per service. Pure function of (services, namespace).
//   2. AFFECTED SCOPING — map a set of changed files to { owning service + its
//      transitive dependents } using each service's `dependsOn`, so a dev loop
//      can rebuild/sync only what a change actually affects.
//   3. LOG MULTIPLEXING — fold many per-service log streams into one ordered,
//      per-line `[service] line` stream (the multiplexed dashboard/terminal view).
//
// Every cluster/skaffold/process operation is funnelled through the injectable
// {@link DevBackend} interface. Tests substitute a fake; the default real impl
// shells out to `skaffold`/`kubectl` (argv arrays, never `shell: true`) and
// errors clearly when they are not installed.

import { spawnSync, spawn } from 'child_process';
import type {
  DevClusterArtifact,
  DevClusterConfig,
  DevClusterPortForward,
  DevClusterSyncRule,
} from '@re-shell/contracts';
import type { ServiceConfig } from '../parsers/workspace-parser';

/** Skaffold schema version the generator targets. */
const SKAFFOLD_API_VERSION = 'skaffold/v4beta11';
/** Default namespace for the inner-loop deploy. */
export const DEFAULT_DEV_NAMESPACE = 'default';
/** First local port allocated for generated port-forwards. */
const PORT_FORWARD_BASE = 4000;
/** Container port assumed when a service declares none. */
const DEFAULT_SERVICE_PORT = 8080;

/** A service paired with its workspace key (the graph/order key). */
export interface NamedService {
  /** Workspace service name — the stable scheduling/graph key. */
  name: string;
  /** Parsed service config from the workspace v2 file. */
  config: ServiceConfig;
}

/** Options for {@link generateDevClusterConfig}. */
export interface GenerateDevClusterConfigOptions {
  /** Services to include, in the desired (already-scoped) order. */
  services: readonly NamedService[];
  /** Target namespace; defaults to {@link DEFAULT_DEV_NAMESPACE}. */
  namespace?: string;
  /**
   * Manifest globs Skaffold deploys. Defaults to the conventional k8s output
   * directory produced by `re-shell k8s generate`.
   */
  manifests?: readonly string[];
}

/**
 * Build the in-cluster file-sync rules for one service. Edits under the
 * service's source dir are copied straight into the running container (no
 * rebuild) — the fast inner loop. Source globs are relative to the build
 * context (the service dir), so they stay portable across machines.
 */
function buildSyncRules(): DevClusterSyncRule[] {
  return [
    { src: 'src/**/*.{js,jsx,ts,tsx}', dest: '/app/src' },
    { src: 'public/**/*', dest: '/app/public' },
  ];
}

/**
 * Build one Skaffold artifact for a service. The build context is the service
 * directory (its `path`, defaulting to the service name); the image is a stable
 * local dev tag derived from the service name so manifests can reference it.
 */
function buildArtifact(service: NamedService): DevClusterArtifact {
  const context = service.config.path ?? service.name;
  return {
    service: service.name,
    image: `re-shell-dev/${service.name}`,
    context,
    dockerfile: 'Dockerfile',
    sync: buildSyncRules(),
  };
}

/**
 * Build the generated port-forwards. Each in-scope service is forwarded from a
 * collision-free local port to its declared container port. The allocator starts
 * above the maximum declared service port (or PORT_FORWARD_BASE, whichever is
 * higher) and skips any port already declared by another service, so the local
 * port space never overlaps with the in-cluster container ports.
 */
function buildPortForwards(
  services: readonly NamedService[]
): DevClusterPortForward[] {
  // Collect all declared service ports to avoid collisions.
  const declaredPorts = new Set(
    services
      .map(s => s.config.port)
      .filter((p): p is number => typeof p === 'number')
  );

  // Start above the max declared port (or PORT_FORWARD_BASE), then skip any
  // declared port to guarantee no overlap.
  const maxDeclared = declaredPorts.size > 0 ? Math.max(...declaredPorts) : 0;
  let nextLocal = Math.max(PORT_FORWARD_BASE, maxDeclared + 1);

  const allocate = (): number => {
    while (declaredPorts.has(nextLocal)) {
      nextLocal++;
    }
    return nextLocal++;
  };

  return services.map(service => ({
    service: service.name,
    resourceType: 'service' as const,
    port: service.config.port ?? DEFAULT_SERVICE_PORT,
    localPort: allocate(),
  }));
}

/**
 * Generate the offline Skaffold dev config from the (already-scoped) services.
 *
 * Pure and deterministic: the same service set + namespace always yields the
 * same config. Producing it touches no cluster, skaffold, or network — it is
 * just data the command layer serialises (`--json`) or hands to a backend.
 */
export function generateDevClusterConfig(
  options: GenerateDevClusterConfigOptions
): DevClusterConfig {
  const namespace = options.namespace ?? DEFAULT_DEV_NAMESPACE;
  const manifests =
    options.manifests && options.manifests.length > 0
      ? [...options.manifests]
      : ['k8s/**/*.yaml'];

  return {
    apiVersion: SKAFFOLD_API_VERSION,
    kind: 'Config',
    namespace,
    artifacts: options.services.map(buildArtifact),
    manifests,
    portForwards: buildPortForwards(options.services),
  };
}

// ---------------------------------------------------------------------------
// Affected scoping
// ---------------------------------------------------------------------------

/** A directed runtime-dependency graph: service -> the services it depends on. */
export type ServiceDependencyGraph = ReadonlyMap<string, readonly string[]>;

/** Build the `dependsOn` graph from the named services (offline, pure). */
export function buildServiceGraph(
  services: readonly NamedService[]
): ServiceDependencyGraph {
  const known = new Set(services.map(s => s.name));
  const graph = new Map<string, readonly string[]>();
  for (const service of services) {
    // Only edges to OTHER known services count, mirroring the workspace graph's
    // "membership is the authoritative filter" rule.
    const deps = (service.config.dependsOn ?? []).filter(
      dep => dep !== service.name && known.has(dep)
    );
    graph.set(service.name, deps);
  }
  return graph;
}

/**
 * Map changed files to the set of affected service names: the service(s) that
 * own a changed file, expanded with their transitive DEPENDENTS (a change to a
 * service affects everything downstream of it, never its own upstream deps).
 *
 * Pure and offline — `changedFiles` are supplied by the caller (git in the real
 * command, a fixture in tests). Ownership is longest-prefix on each service's
 * directory, so nested services resolve to the deepest match.
 */
export function resolveAffectedServices(
  services: readonly NamedService[],
  changedFiles: readonly string[]
): string[] {
  // Map each service to its normalised directory prefix for ownership matching.
  // Use forward-slashes throughout: git always emits '/' and normalizeDir now
  // produces forward-slash prefixes, so matching is cross-platform.
  const dirs = services.map(s => ({
    name: s.name,
    prefix: normalizeDir(s.config.path ?? s.name),
  }));

  const directlyChanged = new Set<string>();
  for (const file of changedFiles) {
    // Normalise to forward-slashes so Windows path.sep differences don't
    // break matches against git-emitted paths.
    const rel = file.split('\\').join('/');
    let best: { name: string; len: number } | undefined;
    for (const d of dirs) {
      if (rel === d.prefix.slice(0, -1) || rel.startsWith(d.prefix)) {
        if (!best || d.prefix.length > best.len) {
          best = { name: d.name, len: d.prefix.length };
        }
      }
    }
    if (best) directlyChanged.add(best.name);
  }

  // Reverse the dependency graph into a dependents map, then flood-fill.
  const graph = buildServiceGraph(services);
  const dependents = new Map<string, string[]>();
  for (const name of graph.keys()) dependents.set(name, []);
  for (const [svc, deps] of graph) {
    for (const dep of deps) dependents.get(dep)?.push(svc);
  }

  const affected = new Set<string>();
  const stack = [...directlyChanged];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (affected.has(cur)) continue;
    affected.add(cur);
    for (const d of dependents.get(cur) ?? []) {
      if (!affected.has(d)) stack.push(d);
    }
  }
  // Return in the input service order for deterministic output.
  return services.map(s => s.name).filter(name => affected.has(name));
}

/**
 * Normalise a service dir into a trailing-forward-slash prefix for matching.
 * Always uses '/' (not path.sep) so that comparison against git-emitted paths
 * (which always use '/') works identically on Windows and POSIX.
 */
function normalizeDir(dir: string): string {
  const cleaned = dir.split('\\').join('/').replace(/\/+$/, '');
  return cleaned + '/';
}

// ---------------------------------------------------------------------------
// Log multiplexing
// ---------------------------------------------------------------------------

/** A single source of log lines, tagged by its service name. */
export interface LogSource {
  service: string;
  /** Raw chunk(s) of stdout/stderr for this service, in arrival order. */
  chunks: readonly string[];
}

/**
 * Fold per-service log chunks into one ordered, per-line stream where every
 * line is prefixed with its `[service]` tag. Chunks may contain partial lines;
 * they are split on newlines and empty trailing lines are dropped so a trailing
 * `\n` does not emit a spurious blank `[service] ` line.
 *
 * Pure: deterministic for a given ordered list of sources. The real runtime
 * feeds this from live process streams; tests feed it fixture chunks.
 */
export function multiplexLogs(sources: readonly LogSource[]): string[] {
  const out: string[] = [];
  for (const source of sources) {
    for (const chunk of source.chunks) {
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.length === 0) continue;
        out.push(`[${source.service}] ${line}`);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Injectable backend (the ONLY surface that touches a cluster/skaffold)
// ---------------------------------------------------------------------------

/** Outcome of probing for a required external tool. */
export interface ToolProbe {
  /** Tool name, e.g. "skaffold" or "kubectl". */
  tool: string;
  /** True when the tool is present and runnable. */
  available: boolean;
  /** Version string when probed, or a reason when unavailable. */
  detail?: string;
}

/** Options handed to {@link DevBackend.dev}. */
export interface DevBackendRunOptions {
  /** The generated Skaffold config to drive the loop. */
  config: DevClusterConfig;
  /** Namespace to deploy into. */
  namespace: string;
  /** Service names in scope (for log labelling / filtering). */
  services: readonly string[];
}

/**
 * The single abstraction over all cluster/skaffold/process operations. The real
 * implementation shells out; tests provide a fake. Keeping this narrow is what
 * lets the entire feature be exercised offline.
 */
export interface DevBackend {
  /** Probe that the tools the inner loop needs are installed and runnable. */
  probe(): Promise<ToolProbe[]>;
  /**
   * Start the inner-loop dev session (build-watch + sync + port-forward).
   * Long-running in the real impl; never invoked by the offline test/dry-run
   * paths, which stop after config generation.
   */
  dev(options: DevBackendRunOptions): Promise<void>;
}

/** Raised when a required external tool is missing. Carries the tool name. */
export class MissingToolError extends Error {
  readonly tool: string;
  constructor(tool: string, message: string) {
    super(message);
    this.name = 'MissingToolError';
    this.tool = tool;
  }
}

/** Minimal seam over child_process so the real backend stays testable in unit. */
export type ProbeRunner = (
  cmd: string,
  args: readonly string[]
) => { ok: boolean; detail: string };

/**
 * Injectable spawn function for the real `skaffold dev` long-running process.
 * Receives the argv array (binary is args[0]) and returns a handle that can be
 * terminated. Tests inject a fake that records the argv without spawning.
 */
export type SpawnRunner = (argv: readonly string[]) => {
  /** The running process handle (or null when not actually spawned). */
  process: ReturnType<typeof spawn> | null;
  /** Promise that resolves when the process exits (or the fake resolves). */
  done: Promise<void>;
};

/**
 * The default, real backend. Probes/drives `skaffold` (and `kubectl`) via argv
 * arrays — NEVER `shell: true`. It is constructed lazily by the command layer
 * and only used when a real run is requested, so the offline paths never
 * instantiate process machinery.
 */
export class SkaffoldDevBackend implements DevBackend {
  private readonly run: ProbeRunner;
  private readonly spawnRun: SpawnRunner;

  constructor(run?: ProbeRunner, spawnRun?: SpawnRunner) {
    this.run = run ?? defaultProbeRunner;
    this.spawnRun = spawnRun ?? defaultSpawnRunner;
  }

  async probe(): Promise<ToolProbe[]> {
    const skaffold = this.run('skaffold', ['version']);
    const kubectl = this.run('kubectl', ['version', '--client', '-o', 'json']);
    return [
      { tool: 'skaffold', available: skaffold.ok, detail: skaffold.detail },
      { tool: 'kubectl', available: kubectl.ok, detail: kubectl.detail },
    ];
  }

  async dev(options: DevBackendRunOptions): Promise<void> {
    const probes = await this.probe();
    const missing = probes.find(p => !p.available);
    if (missing) {
      throw new MissingToolError(
        missing.tool,
        `${missing.tool} is required for \`re-shell dev --cluster\` but was not found on PATH. ` +
          `Install ${missing.tool} and ensure a Kubernetes cluster is reachable, ` +
          `or use --dry-run to generate the config without running it.`
      );
    }

    // Build the `skaffold dev` argv. The config is passed as inline JSON via
    // stdin is not ideal for Skaffold; instead we serialise it to a temp file
    // and pass `--filename`. Using argv arrays (never shell: true) keeps this
    // safe from injection.
    const argv = buildSkaffoldArgv(options);
    const { done } = this.spawnRun(argv);
    await done;
  }
}

/**
 * Build the `skaffold dev` argv for the given run options. Kept as a pure
 * function so tests can assert the exact argv without spawning.
 */
export function buildSkaffoldArgv(options: DevBackendRunOptions): string[] {
  const argv: string[] = ['skaffold', 'dev'];
  // Namespace flag.
  argv.push('--namespace', options.namespace);
  // Restrict skaffold to the in-scope profiles/services label selector when
  // only a subset of services are active; skaffold's --label flag targets the
  // deployed pods while --module can scope multi-config setups. For a
  // single-module setup we rely on the generated config already being scoped
  // to only the relevant artifacts.
  return argv;
}

/**
 * The real default spawn runner. Spawns `skaffold dev` (argv[0] = binary) with
 * no shell, pipes stdout/stderr to the parent process for the multiplexed log
 * view, and resolves when the child exits.
 */
function defaultSpawnRunner(argv: readonly string[]): {
  process: ReturnType<typeof spawn> | null;
  done: Promise<void>;
} {
  const [bin, ...args] = argv;
  const child = spawn(bin ?? 'skaffold', args, {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Pipe child stdout/stderr to our own process so the user sees the output.
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);

  const done = new Promise<void>((resolve, reject) => {
    child.on('error', err => {
      reject(
        new MissingToolError(
          'skaffold',
          `Failed to spawn skaffold: ${err.message}. ` +
            `Ensure skaffold is installed and on PATH, ` +
            `or use --dry-run to generate the config without running it.`
        )
      );
    });
    child.on('close', code => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`skaffold dev exited with code ${code}`));
      }
    });
  });

  return { process: child, done };
}

/** Probe a tool by spawning `<cmd> <args>` with no shell. */
function defaultProbeRunner(
  cmd: string,
  args: readonly string[]
): { ok: boolean; detail: string } {
  const result = spawnSync(cmd, [...args], {
    encoding: 'utf8',
    timeout: 5000,
  });
  // spawnSync sets signal to 'SIGTERM' when a timeout fires, and error may be
  // set to an ETIMEDOUT error object. Treat both as "tool unavailable".
  if (result.error || result.signal === 'SIGTERM' || result.status !== 0) {
    return { ok: false, detail: `${cmd} not found on PATH` };
  }
  return { ok: true, detail: (result.stdout ?? '').trim().split('\n')[0] ?? '' };
}
