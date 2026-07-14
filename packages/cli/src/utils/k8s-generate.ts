// K8s manifest generation from a workspace.yaml v2 config (W9c-1, P9-D1).
//
// Given the parsed workspace v2 services, emit a set of Kubernetes manifests
// per service — Deployment, Service (ClusterIP), HorizontalPodAutoscaler (CPU +
// a custom-metric stub) and a NetworkPolicy (default-deny + allow
// intra-namespace) — rendered to YAML via js-yaml. The output is a structured
// list of {kind, name, yaml} so callers can either return it (dry-run/JSON) or
// write each entry to disk.
//
// These are GENERATION artifacts: correctness is verified by parsing the YAML
// back and asserting required fields, not by deploying to a live cluster.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { WorkspaceParser, type ServiceConfig } from '../parsers/workspace-parser';

/**
 * A single rendered manifest entry.
 *
 * Represents one Kubernetes manifest (e.g. Deployment, Service) after it has
 * been serialized to a YAML string. The `kind` and `name` metadata are kept
 * alongside the YAML so callers can route or name output files without having
 * to re-parse the YAML.
 */
export interface RenderedManifest {
  /** Kubernetes kind of the manifest (e.g. `Deployment`, `Service`). */
  kind: string;
  /** Resource name taken from `metadata.name`. */
  name: string;
  /** The full manifest serialized as a YAML document. */
  yaml: string;
}

/**
 * Result of a manifest-generation run.
 *
 * Returned by {@link generateManifests}. Contains the resolved namespace, all
 * rendered manifests in emission order, and the list of files written to disk
 * (which is empty for dry-run invocations).
 */
export interface GenerateManifestsResult {
  /** Kubernetes namespace the manifests were rendered for. */
  namespace: string;
  /** Ordered list of rendered manifest entries (Deployment, Service, HPA, NetworkPolicy per service). */
  manifests: RenderedManifest[];
  /** Files written to disk (absolute paths); empty for dry-run. */
  written: string[];
}

/**
 * Options accepted by {@link generateManifests}.
 *
 * All fields are optional. The generator falls back to sensible defaults
 * (process cwd, `default` namespace, dry-run-only output) when individual
 * options are omitted.
 */
export interface GenerateManifestsOptions {
  /** Directory containing the workspace v2 config (default: cwd). */
  cwd?: string;
  /** Explicit path to the workspace yaml; overrides cwd discovery. */
  configPath?: string;
  /** Target namespace; falls back to "default". */
  namespace?: string;
  /** Output directory to write files into; omitted/dry-run writes nothing. */
  out?: string;
  /** When true, do not write files regardless of `out`. */
  dryRun?: boolean;
}

const DEFAULT_NAMESPACE = 'default';

// Resource defaults applied to every generated Deployment container. Kept as a
// named constant so the values are not magic numbers scattered through the code.
const DEFAULT_RESOURCES = {
  requests: { cpu: '100m', memory: '128Mi' },
  limits: { cpu: '500m', memory: '512Mi' },
} as const;

// HPA replica + utilization defaults.
const HPA_MIN_REPLICAS = 2;
const HPA_MAX_REPLICAS = 10;
const HPA_CPU_TARGET_UTILIZATION = 70;
// Custom-metric stub: requests-per-second per pod. A placeholder a platform
// team can wire to a real metrics adapter (e.g. Prometheus Adapter).
const HPA_CUSTOM_METRIC_NAME = 'http_requests_per_second';
const HPA_CUSTOM_METRIC_TARGET = '1k';

/** Candidate filenames for a workspace v2 config, in discovery order. */
const CONFIG_CANDIDATES = [
  're-shell.workspaces.yaml',
  're-shell.workspaces.yml',
  'workspace.yaml',
  'workspace.yml',
];

/**
 * A minimal structural view of a Kubernetes manifest. We keep `spec`/`metadata`
 * loosely typed objects (built locally, never from untrusted input) but avoid
 * `any` by using `unknown`-friendly record shapes.
 */
interface K8sManifest {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: Record<string, unknown>;
}

/**
 * Discover the workspace v2 config path under `cwd`.
 *
 * If `explicit` is provided and the file exists, it is returned as-is. Otherwise
 * the directory is scanned for a set of well-known candidate filenames (see
 * {@link CONFIG_CANDIDATES}) and the first match is returned.
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

/** Standard label set applied to every resource for a given service. */
function serviceLabels(serviceName: string): Record<string, string> {
  return {
    app: serviceName,
    'app.kubernetes.io/name': serviceName,
    'app.kubernetes.io/managed-by': 're-shell',
  };
}

/** Build the Deployment manifest for a service. */
function buildDeployment(
  service: ServiceConfig,
  serviceName: string,
  namespace: string
): K8sManifest {
  const port = service.port ?? 8080;
  const env = Object.entries(service.env ?? {}).map(([name, value]) => ({
    name,
    value: String(value),
  }));

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: serviceName,
      namespace,
      labels: serviceLabels(serviceName),
    },
    spec: {
      replicas: HPA_MIN_REPLICAS,
      selector: { matchLabels: { app: serviceName } },
      template: {
        metadata: { labels: serviceLabels(serviceName) },
        spec: {
          containers: [
            {
              name: serviceName,
              // Image placeholder — a CI step replaces this with the built tag.
              image: `${serviceName}:latest`,
              imagePullPolicy: 'IfNotPresent',
              ports: [{ containerPort: port, name: 'http' }],
              ...(env.length > 0 ? { env } : {}),
              resources: DEFAULT_RESOURCES,
            },
          ],
        },
      },
    },
  };
}

/** Build the ClusterIP Service manifest for a service. */
function buildService(
  service: ServiceConfig,
  serviceName: string,
  namespace: string
): K8sManifest {
  const port = service.port ?? 8080;
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: serviceName,
      namespace,
      labels: serviceLabels(serviceName),
    },
    spec: {
      type: 'ClusterIP',
      selector: { app: serviceName },
      ports: [{ name: 'http', protocol: 'TCP', port, targetPort: port }],
    },
  };
}

/** Build the HPA manifest (CPU utilization + a custom-metric stub). */
function buildHpa(serviceName: string, namespace: string): K8sManifest {
  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: serviceName,
      namespace,
      labels: serviceLabels(serviceName),
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: serviceName,
      },
      minReplicas: HPA_MIN_REPLICAS,
      maxReplicas: HPA_MAX_REPLICAS,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: HPA_CPU_TARGET_UTILIZATION,
            },
          },
        },
        {
          // Custom-metric stub: scales on per-pod request rate. Requires a
          // metrics adapter in-cluster to actually resolve this metric.
          type: 'Pods',
          pods: {
            metric: { name: HPA_CUSTOM_METRIC_NAME },
            target: {
              type: 'AverageValue',
              averageValue: HPA_CUSTOM_METRIC_TARGET,
            },
          },
        },
      ],
    },
  };
}

/**
 * Build the NetworkPolicy manifest: default-deny ingress combined with an
 * allow-rule for traffic originating inside the same namespace. Egress is left
 * open so pods can reach DNS and external dependencies without extra rules.
 */
function buildNetworkPolicy(
  serviceName: string,
  namespace: string
): K8sManifest {
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: `${serviceName}-default-deny-allow-intra`,
      namespace,
      labels: serviceLabels(serviceName),
    },
    spec: {
      podSelector: { matchLabels: { app: serviceName } },
      policyTypes: ['Ingress'],
      // Default-deny is expressed by an empty podSelector baseline; the single
      // ingress rule below re-allows only same-namespace sources. Anything not
      // matched (cross-namespace, external) is denied.
      ingress: [
        {
          from: [
            {
              namespaceSelector: {
                matchLabels: { 'kubernetes.io/metadata.name': namespace },
              },
            },
          ],
        },
      ],
    },
  };
}

/** Render a manifest object to a normalized, parseable YAML document. */
function renderManifest(manifest: K8sManifest): RenderedManifest {
  const yamlText = yaml.dump(manifest, { lineWidth: 120, noRefs: true });
  return {
    kind: manifest.kind,
    name: manifest.metadata.name,
    yaml: yamlText,
  };
}

/**
 * Generate the full manifest set from a workspace v2 config.
 *
 * Reads + validates the config via {@link WorkspaceParser}, then emits four
 * manifests per service. When `out` is set and `dryRun` is not, each manifest is
 * written to `<out>/<kind>-<name>.yaml`.
 *
 * @param options - Generator options (cwd, configPath, namespace, out, dryRun). All optional.
 * @returns The resolved namespace, the ordered list of rendered manifests, and the list of files written to disk.
 *
 * @throws Error when the config cannot be found, fails to parse, or defines no
 *   services. The command layer maps these to a `K8S_GENERATE_ERROR` envelope.
 */
export function generateManifests(
  options: GenerateManifestsOptions = {}
): GenerateManifestsResult {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolveWorkspaceConfigPath(cwd, options.configPath);

  if (!configPath) {
    throw new Error(
      `No workspace v2 config found (looked for ${CONFIG_CANDIDATES.join(', ')} in ${cwd})`
    );
  }

  const parser = new WorkspaceParser();
  const parsed = parser.parse(configPath);

  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid workspace config: ${detail || 'unknown error'}`);
  }

  const services = parsed.config.services ?? {};
  const serviceNames = Object.keys(services);
  if (serviceNames.length === 0) {
    throw new Error('Workspace config defines no services to generate manifests for');
  }

  const namespace = options.namespace ?? DEFAULT_NAMESPACE;

  const manifests: RenderedManifest[] = [];
  for (const serviceName of serviceNames) {
    const service = services[serviceName];
    manifests.push(renderManifest(buildDeployment(service, serviceName, namespace)));
    manifests.push(renderManifest(buildService(service, serviceName, namespace)));
    manifests.push(renderManifest(buildHpa(serviceName, namespace)));
    manifests.push(renderManifest(buildNetworkPolicy(serviceName, namespace)));
  }

  const written: string[] = [];
  const shouldWrite = Boolean(options.out) && options.dryRun !== true;
  if (shouldWrite && options.out) {
    fs.mkdirSync(options.out, { recursive: true });
    for (const manifest of manifests) {
      const fileName = `${manifest.kind.toLowerCase()}-${manifest.name}.yaml`;
      const filePath = path.join(options.out, fileName);
      fs.writeFileSync(filePath, manifest.yaml);
      written.push(filePath);
    }
  }

  return { namespace, manifests, written };
}
