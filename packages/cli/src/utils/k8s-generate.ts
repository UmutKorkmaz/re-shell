// K8s manifest generation from a workspace.yaml v2 config (W9c-1, P9-D1).
//
// Given the parsed workspace v2 services, emit a hardened set of Kubernetes
// manifests per service:
//   - Deployment  (securityContext, resources, probes, rollout strategy,
//                  revisionHistoryLimit, emptyDir for writable paths)
//   - Service     (ClusterIP)
//   - HorizontalPodAutoscaler (CPU + a Pods custom metric)
//   - NetworkPolicy (default-deny ingress + allow same-namespace)
//   - PodDisruptionBudget
//
// All values come from the shared resolver in ./k8s-config so the raw manifests
// and the Helm chart are generated from identical settings. Output is a
// structured list of {kind, name, yaml} so callers can either return it
// (dry-run/JSON) or write each entry to disk.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {
  loadWorkspace,
  resolveK8sWorkspace,
  volumeNameForPath,
  resolveWorkspaceConfigPath,
  type ResolvedK8sService,
} from './k8s-config';

// Re-exported for backward compatibility (callers/tests import it from here).
export { resolveWorkspaceConfigPath };

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
  /** Ordered list of rendered manifest entries (per service: Deployment, Service, HPA, NetworkPolicy, PodDisruptionBudget). */
  manifests: RenderedManifest[];
  /** Files written to disk (absolute paths); empty for dry-run. */
  written: string[];
  /** Non-fatal notes surfaced while resolving the workspace (e.g. an unsupported strategy). */
  warnings: string[];
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
    annotations?: Record<string, string>;
  };
  spec?: Record<string, unknown>;
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
function buildDeployment(svc: ResolvedK8sService, namespace: string): K8sManifest {
  // Sorted by name: deterministic output that matches Helm's `range` over the
  // values map, so the chart and the raw manifests render identical pods.
  const env = Object.entries(svc.env)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => ({ name, value }));
  const volumeMounts = svc.writablePaths.map(p => ({
    name: volumeNameForPath(p),
    mountPath: p,
  }));
  const volumes = svc.writablePaths.map(p => ({
    name: volumeNameForPath(p),
    emptyDir: {},
  }));

  const container: Record<string, unknown> = {
    name: svc.name,
    // Image placeholder tag — a CI step replaces it with the built tag.
    image: `${svc.image.repository}:${svc.image.tag}`,
    imagePullPolicy: svc.image.pullPolicy,
    ports: [{ containerPort: svc.port, name: 'http' }],
    ...(env.length > 0 ? { env } : {}),
    resources: svc.resources,
    securityContext: svc.securityContext,
    ...(svc.livenessProbe ? { livenessProbe: svc.livenessProbe } : {}),
    ...(svc.readinessProbe ? { readinessProbe: svc.readinessProbe } : {}),
    ...(svc.startupProbe ? { startupProbe: svc.startupProbe } : {}),
    ...(volumeMounts.length > 0 ? { volumeMounts } : {}),
  };

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: svc.name,
      namespace,
      labels: serviceLabels(svc.name),
    },
    spec: {
      replicas: svc.replicas,
      // Rollback support: keep N old ReplicaSets so `kubectl rollout undo`
      // (re-shell k8s rollback) has revisions to return to.
      revisionHistoryLimit: svc.revisionHistoryLimit,
      progressDeadlineSeconds: svc.progressDeadlineSeconds,
      minReadySeconds: svc.minReadySeconds,
      strategy: svc.strategy,
      selector: { matchLabels: { app: svc.name } },
      template: {
        metadata: { labels: serviceLabels(svc.name) },
        spec: {
          automountServiceAccountToken: svc.automountServiceAccountToken,
          securityContext: svc.podSecurityContext,
          ...(svc.terminationGracePeriodSeconds !== undefined
            ? { terminationGracePeriodSeconds: svc.terminationGracePeriodSeconds }
            : {}),
          containers: [container],
          ...(volumes.length > 0 ? { volumes } : {}),
        },
      },
    },
  };
}

/** Build the ClusterIP Service manifest for a service. */
function buildService(svc: ResolvedK8sService, namespace: string): K8sManifest {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: svc.name,
      namespace,
      labels: serviceLabels(svc.name),
    },
    spec: {
      type: 'ClusterIP',
      selector: { app: svc.name },
      ports: [
        { name: 'http', protocol: 'TCP', port: svc.port, targetPort: svc.port },
      ],
    },
  };
}

/** Build the HPA manifest (CPU/memory utilization + a Pods custom metric). */
function buildHpa(svc: ResolvedK8sService, namespace: string): K8sManifest {
  const metrics: Record<string, unknown>[] = [
    {
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: 'Utilization',
          averageUtilization: svc.autoscaling.targetCPUUtilizationPercentage,
        },
      },
    },
  ];
  if (svc.autoscaling.targetMemoryUtilizationPercentage !== undefined) {
    metrics.push({
      type: 'Resource',
      resource: {
        name: 'memory',
        target: {
          type: 'Utilization',
          averageUtilization: svc.autoscaling.targetMemoryUtilizationPercentage,
        },
      },
    });
  }
  if (svc.autoscaling.customMetric.enabled) {
    metrics.push({
      // Custom metric: scales on a per-pod rate. Requires a metrics adapter
      // in-cluster (e.g. Prometheus Adapter) to actually resolve the metric.
      type: 'Pods',
      pods: {
        metric: { name: svc.autoscaling.customMetric.name },
        target: {
          type: 'AverageValue',
          averageValue: svc.autoscaling.customMetric.averageValue,
        },
      },
    });
  }

  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: svc.name,
      namespace,
      labels: serviceLabels(svc.name),
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: svc.name,
      },
      minReplicas: svc.autoscaling.minReplicas,
      maxReplicas: svc.autoscaling.maxReplicas,
      metrics,
    },
  };
}

/**
 * Build the NetworkPolicy manifest: default-deny ingress combined with an
 * allow-rule for traffic originating inside the same namespace (plus any extra
 * allowed namespaces, e.g. the ingress controller's). Egress is left open so
 * pods can reach DNS and external dependencies without extra rules.
 */
function buildNetworkPolicy(svc: ResolvedK8sService, namespace: string): K8sManifest {
  const sources = [namespace, ...svc.networkPolicy.allowFromNamespaces].filter(
    (ns, i, all) => all.indexOf(ns) === i
  );
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: `${svc.name}-default-deny-allow-intra`,
      namespace,
      labels: serviceLabels(svc.name),
    },
    spec: {
      podSelector: { matchLabels: { app: svc.name } },
      policyTypes: ['Ingress'],
      // Default-deny is expressed by the policy selecting the pods with only
      // the ingress rules below; anything not matched is denied.
      ingress: [
        {
          from: sources.map(ns => ({
            namespaceSelector: {
              matchLabels: { 'kubernetes.io/metadata.name': ns },
            },
          })),
        },
      ],
    },
  };
}

/** Build the PodDisruptionBudget so voluntary disruptions keep capacity up. */
function buildPdb(svc: ResolvedK8sService, namespace: string): K8sManifest {
  return {
    apiVersion: 'policy/v1',
    kind: 'PodDisruptionBudget',
    metadata: {
      name: svc.name,
      namespace,
      labels: serviceLabels(svc.name),
    },
    spec: {
      ...(svc.pdb.minAvailable !== undefined ? { minAvailable: svc.pdb.minAvailable } : {}),
      ...(svc.pdb.maxUnavailable !== undefined
        ? { maxUnavailable: svc.pdb.maxUnavailable }
        : {}),
      selector: { matchLabels: { app: svc.name } },
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
 * Reads + validates the config via {@link loadWorkspace}, resolves the
 * Kubernetes settings, then emits up to five manifests per service. When `out`
 * is set and `dryRun` is not, each manifest is written to
 * `<out>/<kind>-<name>.yaml`.
 *
 * @param options - Generator options (cwd, configPath, namespace, out, dryRun). All optional.
 * @returns The resolved namespace, the ordered list of rendered manifests, the list of files written to disk, and warnings.
 *
 * @throws Error when the config cannot be found, fails to parse, defines no
 *   services, or has contradictory Kubernetes settings. The command layer maps
 *   these to a `K8S_GENERATE_ERROR` envelope.
 */
export function generateManifests(
  options: GenerateManifestsOptions = {}
): GenerateManifestsResult {
  const { config } = loadWorkspace({ cwd: options.cwd, configPath: options.configPath });
  const resolved = resolveK8sWorkspace(config);
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;

  const manifests: RenderedManifest[] = [];
  for (const svc of resolved.services) {
    manifests.push(renderManifest(buildDeployment(svc, namespace)));
    manifests.push(renderManifest(buildService(svc, namespace)));
    if (svc.autoscaling.enabled) {
      manifests.push(renderManifest(buildHpa(svc, namespace)));
    }
    if (svc.networkPolicy.enabled) {
      manifests.push(renderManifest(buildNetworkPolicy(svc, namespace)));
    }
    if (svc.pdb.enabled) {
      manifests.push(renderManifest(buildPdb(svc, namespace)));
    }
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

  return { namespace, manifests, written, warnings: resolved.warnings };
}
