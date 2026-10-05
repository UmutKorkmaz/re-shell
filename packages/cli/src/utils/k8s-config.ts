// Shared Kubernetes settings resolver for the workspace-driven generators
// (P9-D): `k8s generate`, `k8s helm generate`, `k8s gitops generate`,
// `k8s crd|operator|mesh`.
//
// One place turns a workspace v2 config into the fully-resolved, Kubernetes
// shaped settings for every service (security contexts, probes, rollout
// strategy, PDB, autoscaling, ingress). The raw-manifest generator and the Helm
// chart generator both consume the SAME resolved objects so the two outputs can
// never drift apart.
//
// Resolution order (later wins):
//   built-in defaults
//   < workspace `deployment` (replicas / strategy)
//   < workspace `kubernetes`
//   < service `resources` / `healthCheck` / `scaling` / `env` / `port`
//   < service `kubernetes`

import * as fs from 'fs';
import * as path from 'path';

import {
  WorkspaceParser,
  type ServiceConfig,
  type WorkspaceConfig,
} from '../parsers/workspace-parser';

/** Candidate filenames for a workspace v2 config, in discovery order. */
export const CONFIG_CANDIDATES = [
  're-shell.workspaces.yaml',
  're-shell.workspaces.yml',
  'workspace.yaml',
  'workspace.yml',
];

/**
 * Discover the workspace v2 config path under `cwd`.
 *
 * If `explicit` is provided and the file exists, it is returned as-is. Otherwise
 * the directory is scanned for the well-known candidate filenames and the first
 * match is returned.
 *
 * @param cwd - Directory to search when `explicit` is not supplied.
 * @param explicit - Optional explicit config path; overrides discovery.
 * @returns The resolved config path, or `undefined` when no candidate exists.
 */
export function resolveWorkspaceConfigPath(
  cwd: string,
  explicit?: string
): string | undefined {
  if (explicit) {
    return fs.existsSync(explicit) ? explicit : undefined;
  }
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.join(cwd, candidate);
    if (fs.existsSync(full)) return full;
  }
  return undefined;
}

/** A loaded + validated workspace config together with where it came from. */
export interface LoadedWorkspace {
  /** Absolute or caller-relative path of the config file that was read. */
  configPath: string;
  /** The validated workspace config. */
  config: WorkspaceConfig;
  /** Non-blocking validation warnings, formatted `path: message`. */
  warnings: string[];
}

/**
 * Locate, parse and validate the workspace v2 config.
 *
 * @param options - `cwd` (default: process cwd) and an optional explicit `configPath`.
 * @returns The validated config and its path.
 * @throws Error when no config is found, it fails validation, or it defines no services.
 */
export function loadWorkspace(
  options: { cwd?: string; configPath?: string } = {}
): LoadedWorkspace {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolveWorkspaceConfigPath(cwd, options.configPath);
  if (!configPath) {
    throw new Error(
      `No workspace v2 config found (looked for ${CONFIG_CANDIDATES.join(', ')} in ${cwd})`
    );
  }

  const parsed = new WorkspaceParser().parse(configPath);
  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid workspace config: ${detail || 'unknown error'}`);
  }

  if (Object.keys(parsed.config.services ?? {}).length === 0) {
    throw new Error('Workspace config defines no services');
  }

  return {
    configPath,
    config: parsed.config,
    warnings: parsed.warnings.map(w => `${w.path}: ${w.message}`),
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** int-or-string, as used by maxSurge / maxUnavailable / minAvailable. */
export type IntOrString = number | string;

/** A fully-resolved Kubernetes probe. */
export interface K8sProbe {
  httpGet?: { path: string; port: string | number };
  tcpSocket?: { port: string | number };
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
  successThreshold?: number;
}

/** Loose JSON-object alias used for Kubernetes-shaped fragments. */
export type JsonObject = Record<string, unknown>;

/** Everything the generators need to know about one service. */
export interface ResolvedK8sService {
  name: string;
  port: number;
  image: { repository: string; tag: string; pullPolicy: string };
  replicas: number;
  env: Record<string, string>;
  resources: {
    requests: Record<string, string>;
    limits: Record<string, string>;
  };
  /** Pod-level securityContext (runAsNonRoot/runAsUser/runAsGroup/fsGroup/seccompProfile). */
  podSecurityContext: JsonObject;
  /** Container-level securityContext (rofs, no privilege escalation, drop ALL, ...). */
  securityContext: JsonObject;
  /** emptyDir mount paths that keep a read-only root filesystem usable. */
  writablePaths: string[];
  automountServiceAccountToken: boolean;
  livenessProbe?: K8sProbe;
  readinessProbe?: K8sProbe;
  startupProbe?: K8sProbe;
  strategy: {
    type: 'RollingUpdate' | 'Recreate';
    rollingUpdate?: { maxSurge: IntOrString; maxUnavailable: IntOrString };
  };
  revisionHistoryLimit: number;
  progressDeadlineSeconds: number;
  minReadySeconds: number;
  terminationGracePeriodSeconds?: number;
  pdb: {
    enabled: boolean;
    minAvailable?: IntOrString;
    maxUnavailable?: IntOrString;
  };
  autoscaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilizationPercentage: number;
    targetMemoryUtilizationPercentage?: number;
    customMetric: { enabled: boolean; name: string; averageValue: string };
  };
  ingress: { enabled: boolean; host: string; path: string; pathType: string };
  networkPolicy: {
    enabled: boolean;
    /** Extra namespaces allowed to reach the service (e.g. the ingress controller's). */
    allowFromNamespaces: string[];
  };
  /** Health path the probes were derived from, when one was declared. */
  healthPath?: string;
  dependsOn: string[];
  /** Declared routes (used by the mesh generator). */
  routes: Array<{ path: string; method?: string; target?: string }>;
}

/** Workspace-wide ingress settings shared by every service. */
export interface ResolvedIngressDefaults {
  className: string;
  clusterIssuer: string;
  tlsEnabled: boolean;
}

/** The whole workspace, resolved. */
export interface ResolvedK8sWorkspace {
  name: string;
  description: string;
  services: ResolvedK8sService[];
  ingress: ResolvedIngressDefaults;
  /** Non-fatal notes (e.g. an unsupported strategy was mapped). */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default container port when a service declares none. */
export const DEFAULT_PORT = 8080;
/** Non-root uid/gid used when the workspace does not pick one. */
export const DEFAULT_RUN_AS = 10001;

const DEFAULT_RESOURCES = {
  requests: { cpu: '100m', memory: '128Mi' },
  limits: { cpu: '500m', memory: '512Mi' },
};

const HPA_MIN_REPLICAS = 2;
const HPA_MAX_REPLICAS = 10;
const HPA_CPU_TARGET_UTILIZATION = 70;
// Custom-metric default: requests-per-second per pod. Needs a metrics adapter
// (e.g. Prometheus Adapter) in-cluster to resolve.
const HPA_CUSTOM_METRIC_NAME = 'http_requests_per_second';
const HPA_CUSTOM_METRIC_TARGET = '1k';

const DEFAULT_LIVENESS = {
  initialDelaySeconds: 10,
  periodSeconds: 10,
  timeoutSeconds: 3,
  failureThreshold: 3,
};
const DEFAULT_READINESS = {
  initialDelaySeconds: 3,
  periodSeconds: 5,
  timeoutSeconds: 3,
  failureThreshold: 3,
  successThreshold: 1,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-merge `source` into a copy of `target`; arrays and scalars are replaced. */
export function deepMerge<T extends JsonObject>(target: T, source: unknown): T {
  const out: JsonObject = { ...target };
  if (!isPlainObject(source)) return out as T;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = out[key];
    out[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMerge(existing, value)
        : value;
  }
  return out as T;
}

function asObject(value: unknown): JsonObject {
  return isPlainObject(value) ? value : {};
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Parse a CPU quantity ("500m" / "1" / "0.5") into millicores. */
function cpuMillis(value: string): number | undefined {
  const m = /^([0-9]+(?:\.[0-9]+)?)(m?)$/.exec(value);
  if (!m) return undefined;
  return m[2] === 'm' ? Number(m[1]) : Number(m[1]) * 1000;
}

const MEMORY_UNITS: Record<string, number> = {
  '': 1,
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

/** Parse a memory quantity ("512Mi", "1Gi", "500M") into bytes. */
function memoryBytes(value: string): number | undefined {
  const m = /^([0-9]+(?:\.[0-9]+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$/.exec(value);
  if (!m) return undefined;
  return Number(m[1]) * MEMORY_UNITS[m[2] ?? ''];
}

/** Derive the emptyDir volume name for a writable path ("/var/cache" -> "var-cache"). */
export function volumeNameForPath(p: string): string {
  const name = p
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
  return name.length > 0 ? name.slice(0, 63) : 'root';
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function resolveResources(
  service: ServiceConfig,
  merged: JsonObject
): ResolvedK8sService['resources'] {
  const requests: Record<string, string> = { ...DEFAULT_RESOURCES.requests };
  const limits: Record<string, string> = { ...DEFAULT_RESOURCES.limits };

  // Legacy per-service `resources` block ({cpu:{request,limit}, memory:{...}}).
  const legacy = asObject(service.resources);
  const cpu = asObject(legacy.cpu);
  const memory = asObject(legacy.memory);
  if (str(cpu.request)) requests.cpu = cpu.request as string;
  if (str(cpu.limit)) limits.cpu = cpu.limit as string;
  if (str(memory.request)) requests.memory = memory.request as string;
  if (str(memory.limit)) limits.memory = memory.limit as string;

  // Kubernetes-shaped override (`kubernetes.resources`).
  const k8s = asObject(merged.resources);
  for (const [k, v] of Object.entries(asObject(k8s.requests))) {
    if (typeof v === 'string') requests[k] = v;
  }
  for (const [k, v] of Object.entries(asObject(k8s.limits))) {
    if (typeof v === 'string') limits[k] = v;
  }
  return { requests, limits };
}

function buildProbe(
  base: { initialDelaySeconds: number; periodSeconds: number; timeoutSeconds: number; failureThreshold: number; successThreshold?: number },
  override: JsonObject,
  healthPath: string | undefined
): K8sProbe | undefined {
  if (override.enabled === false) return undefined;
  const probePath = str(override.path) ?? healthPath;
  const probe: K8sProbe = {
    ...(probePath
      ? { httpGet: { path: probePath, port: 'http' } }
      : { tcpSocket: { port: 'http' } }),
    initialDelaySeconds: num(override.initialDelaySeconds) ?? base.initialDelaySeconds,
    periodSeconds: num(override.periodSeconds) ?? base.periodSeconds,
    timeoutSeconds: num(override.timeoutSeconds) ?? base.timeoutSeconds,
    failureThreshold: num(override.failureThreshold) ?? base.failureThreshold,
  };
  const success = num(override.successThreshold) ?? base.successThreshold;
  if (success !== undefined) probe.successThreshold = success;
  return probe;
}

/**
 * Resolve every service in the workspace into Kubernetes-ready settings.
 *
 * @param config - A validated workspace config.
 * @returns The resolved workspace.
 * @throws Error on contradictory settings that Kubernetes would reject
 *   (request > limit, minAvailable and maxUnavailable both set, min > max
 *   replicas, runAsNonRoot with runAsUser 0).
 */
export function resolveK8sWorkspace(config: WorkspaceConfig): ResolvedK8sWorkspace {
  const warnings: string[] = [];
  const workspaceK8s = asObject((config as unknown as JsonObject).kubernetes);
  const deployment = asObject(config.deployment);

  // Workspace-wide ingress defaults.
  const wsIngress = asObject(workspaceK8s.ingress);
  const ingress: ResolvedIngressDefaults = {
    className: str(wsIngress.className) ?? 'nginx',
    clusterIssuer: str(wsIngress.clusterIssuer) ?? 'letsencrypt-prod',
    tlsEnabled: bool(wsIngress.tls) ?? true,
  };

  // Workspace `deployment.strategy`: rolling -> RollingUpdate; others are not
  // native Deployment strategies.
  const wsStrategy = str(deployment.strategy);
  if (wsStrategy && wsStrategy !== 'rolling') {
    warnings.push(
      `deployment.strategy "${wsStrategy}" is not a native Deployment strategy; generated RollingUpdate. ` +
        'Use a progressive-delivery controller (e.g. Argo Rollouts) for blue-green/canary.'
    );
  }
  const baseK8s: JsonObject = {};
  if (num(deployment.replicas) !== undefined) baseK8s.replicas = deployment.replicas;

  const services: ResolvedK8sService[] = [];
  for (const [serviceName, service] of Object.entries(config.services ?? {})) {
    services.push(
      resolveService(serviceName, service, deepMerge(baseK8s, workspaceK8s), warnings)
    );
  }

  return {
    name: config.name || 'app',
    description:
      config.description || `Helm chart for ${config.name || 'app'} (generated by re-shell)`,
    services,
    ingress,
    warnings,
  };
}

function resolveService(
  name: string,
  service: ServiceConfig,
  workspaceK8s: JsonObject,
  warnings: string[]
): ResolvedK8sService {
  const serviceK8s = asObject((service as unknown as JsonObject).kubernetes);
  const merged = deepMerge(workspaceK8s, serviceK8s);
  const where = `services.${name}`;

  const port = service.port ?? DEFAULT_PORT;
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(service.env ?? {})) env[key] = String(value);

  // --- image ---------------------------------------------------------------
  const image = asObject(merged.image);
  const repoBase = str(image.repository) ?? name;
  const registry = str(image.registry);
  const image_ = {
    repository: registry ? `${registry.replace(/\/+$/, '')}/${repoBase}` : repoBase,
    tag: str(image.tag) ?? 'latest',
    pullPolicy: str(image.pullPolicy) ?? 'IfNotPresent',
  };

  // --- resources -----------------------------------------------------------
  const resources = resolveResources(service, merged);
  for (const key of ['cpu', 'memory'] as const) {
    const req = resources.requests[key];
    const lim = resources.limits[key];
    if (req && lim) {
      const parse = key === 'cpu' ? cpuMillis : memoryBytes;
      const r = parse(req);
      const l = parse(lim);
      if (r !== undefined && l !== undefined && r > l) {
        throw new Error(
          `${where}: ${key} request (${req}) exceeds its limit (${lim}); Kubernetes rejects this`
        );
      }
    }
  }

  // --- security context ----------------------------------------------------
  const sc = asObject(merged.securityContext);
  const runAsNonRoot = bool(sc.runAsNonRoot) ?? true;
  const runAsUser = num(sc.runAsUser) ?? DEFAULT_RUN_AS;
  const runAsGroup = num(sc.runAsGroup) ?? DEFAULT_RUN_AS;
  const fsGroup = num(sc.fsGroup) ?? runAsGroup;
  if (runAsNonRoot && runAsUser === 0) {
    throw new Error(
      `${where}: securityContext.runAsNonRoot is true but runAsUser is 0 (root); pick a non-zero uid or set runAsNonRoot: false`
    );
  }
  const seccompType = str(sc.seccompProfile) ?? 'RuntimeDefault';
  const caps = asObject(sc.capabilities);
  const drop = Array.isArray(caps.drop) ? (caps.drop as string[]) : ['ALL'];
  const add = Array.isArray(caps.add) ? (caps.add as string[]) : [];
  const readOnlyRootFilesystem = bool(sc.readOnlyRootFilesystem) ?? true;
  const writablePaths = Array.isArray(sc.writablePaths)
    ? (sc.writablePaths as string[])
    : ['/tmp'];

  const podSecurityContext: JsonObject = {
    runAsNonRoot,
    runAsUser,
    runAsGroup,
    fsGroup,
    seccompProfile: { type: seccompType },
  };
  const securityContext: JsonObject = {
    allowPrivilegeEscalation: bool(sc.allowPrivilegeEscalation) ?? false,
    readOnlyRootFilesystem,
    runAsNonRoot,
    runAsUser,
    capabilities: { drop, ...(add.length > 0 ? { add } : {}) },
    seccompProfile: { type: seccompType },
  };

  // --- probes --------------------------------------------------------------
  const legacyHealth = asObject(service.healthCheck);
  const probes = asObject(merged.probes);
  const healthPath = str(probes.path) ?? str(legacyHealth.path);
  const legacyOverride: JsonObject = {};
  if (num(legacyHealth.interval) !== undefined) legacyOverride.periodSeconds = legacyHealth.interval;
  if (num(legacyHealth.timeout) !== undefined) legacyOverride.timeoutSeconds = legacyHealth.timeout;
  if (num(legacyHealth.retries) !== undefined && (legacyHealth.retries as number) >= 1) {
    legacyOverride.failureThreshold = legacyHealth.retries;
  }
  const livenessProbe = buildProbe(
    DEFAULT_LIVENESS,
    deepMerge(legacyOverride, asObject(probes.liveness)),
    healthPath
  );
  const readinessProbe = buildProbe(
    DEFAULT_READINESS,
    deepMerge(legacyOverride, asObject(probes.readiness)),
    healthPath
  );
  const startupOverride = asObject(probes.startup);
  const startupProbe =
    startupOverride.enabled === true || Object.keys(startupOverride).length > 0
      ? buildProbe(
          { initialDelaySeconds: 0, periodSeconds: 5, timeoutSeconds: 3, failureThreshold: 30 },
          startupOverride,
          healthPath
        )
      : undefined;

  // --- rollout / rollback --------------------------------------------------
  const strategyCfg = asObject(merged.strategy);
  const strategyType = strategyCfg.type === 'Recreate' ? 'Recreate' : 'RollingUpdate';
  const strategy: ResolvedK8sService['strategy'] =
    strategyType === 'Recreate'
      ? { type: 'Recreate' }
      : {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxSurge: (strategyCfg.maxSurge as IntOrString | undefined) ?? 1,
            maxUnavailable: (strategyCfg.maxUnavailable as IntOrString | undefined) ?? 0,
          },
        };

  // --- autoscaling ---------------------------------------------------------
  const scaling = asObject(service.scaling);
  const asCfg = asObject(merged.autoscaling);
  let minReplicas = num(asCfg.minReplicas) ?? num(scaling.min) ?? HPA_MIN_REPLICAS;
  if (minReplicas < 1) {
    warnings.push(
      `${where}: scaling.min=${minReplicas} (scale-to-zero) is not supported by the stock HorizontalPodAutoscaler; using minReplicas 1`
    );
    minReplicas = 1;
  }
  const maxReplicas = num(asCfg.maxReplicas) ?? num(scaling.max) ?? HPA_MAX_REPLICAS;
  if (minReplicas > maxReplicas) {
    throw new Error(
      `${where}: autoscaling minReplicas (${minReplicas}) exceeds maxReplicas (${maxReplicas})`
    );
  }
  let cpuTarget = num(asCfg.cpuUtilization) ?? HPA_CPU_TARGET_UTILIZATION;
  let memoryTarget = num(asCfg.memoryUtilization);
  const customCfg = asObject(asCfg.customMetric);
  let customName = str(customCfg.name) ?? HPA_CUSTOM_METRIC_NAME;
  let customValue = str(customCfg.averageValue) ?? HPA_CUSTOM_METRIC_TARGET;
  let customEnabled = bool(customCfg.enabled) ?? true;
  // Legacy `scaling.metrics`: cpu/memory utilization + requests/custom Pods metric.
  if (Array.isArray(scaling.metrics) && scaling.metrics.length > 0) {
    customEnabled = false;
    for (const raw of scaling.metrics) {
      const m = asObject(raw);
      const value = num(m.value);
      if (m.type === 'cpu' && value !== undefined && num(asCfg.cpuUtilization) === undefined) cpuTarget = value;
      else if (m.type === 'memory' && value !== undefined && num(asCfg.memoryUtilization) === undefined) memoryTarget = value;
      else if (m.type === 'requests' || m.type === 'custom') {
        if (bool(customCfg.enabled) !== false) customEnabled = true;
        if (str(m.name) && !str(customCfg.name)) customName = m.name as string;
        if (value !== undefined && !str(customCfg.averageValue)) customValue = String(value);
      }
    }
  }
  const replicas =
    num(merged.replicas) ?? (bool(asCfg.enabled) === false ? 2 : minReplicas);

  // --- PDB -----------------------------------------------------------------
  const pdbCfg = asObject(merged.pdb);
  const pdb: ResolvedK8sService['pdb'] = { enabled: bool(pdbCfg.enabled) ?? true };
  const pdbMin = pdbCfg.minAvailable as IntOrString | undefined;
  const pdbMax = pdbCfg.maxUnavailable as IntOrString | undefined;
  if (pdbMin !== undefined && pdbMax !== undefined) {
    throw new Error(
      `${where}: pdb.minAvailable and pdb.maxUnavailable are mutually exclusive`
    );
  }
  if (pdbMin !== undefined) pdb.minAvailable = pdbMin;
  else if (pdbMax !== undefined) pdb.maxUnavailable = pdbMax;
  else if (replicas >= 2) pdb.minAvailable = 1;
  else pdb.maxUnavailable = 1; // a single replica must stay evictable for node drains

  // --- ingress / network policy -------------------------------------------
  const ing = asObject(merged.ingress);
  const np = asObject(merged.networkPolicy);
  const ingressClassName = str(ing.className) ?? 'nginx';

  return {
    name,
    port,
    image: image_,
    replicas,
    env,
    resources,
    podSecurityContext,
    securityContext,
    writablePaths: readOnlyRootFilesystem ? writablePaths : [],
    automountServiceAccountToken: bool(merged.automountServiceAccountToken) ?? false,
    livenessProbe,
    readinessProbe,
    startupProbe,
    strategy,
    revisionHistoryLimit: num(merged.revisionHistoryLimit) ?? 10,
    progressDeadlineSeconds: num(merged.progressDeadlineSeconds) ?? 600,
    minReadySeconds: num(merged.minReadySeconds) ?? 0,
    terminationGracePeriodSeconds: num(merged.terminationGracePeriodSeconds),
    pdb,
    autoscaling: {
      enabled: bool(asCfg.enabled) ?? true,
      minReplicas,
      maxReplicas,
      targetCPUUtilizationPercentage: cpuTarget,
      ...(memoryTarget !== undefined
        ? { targetMemoryUtilizationPercentage: memoryTarget }
        : {}),
      customMetric: { enabled: customEnabled, name: customName, averageValue: customValue },
    },
    ingress: {
      enabled: bool(ing.enabled) ?? true,
      host: str(ing.host) ?? `${name}.example.com`,
      path: str(ing.path) ?? '/',
      pathType: str(ing.pathType) ?? 'Prefix',
    },
    networkPolicy: {
      enabled: bool(np.enabled) ?? true,
      allowFromNamespaces: Array.isArray(np.allowFromNamespaces)
        ? (np.allowFromNamespaces as string[])
        : (bool(ing.enabled) ?? true) && ingressClassName === 'nginx'
          ? ['ingress-nginx']
          : [],
    },
    healthPath,
    dependsOn: Array.isArray(service.dependsOn) ? [...service.dependsOn] : [],
    routes: Array.isArray(service.routes)
      ? service.routes.map(r => {
          const route = asObject(r);
          return {
            path: String(route.path ?? '/'),
            method: str(route.method),
            target: str(route.target),
          };
        })
      : [],
  };
}
