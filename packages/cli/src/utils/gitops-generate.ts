// GitOps manifest generation from a workspace.yaml v2 config (W9c-2, P9-D3).
//
// Emit GitOps wiring that points a continuous-reconciliation tool at the chart
// (or raw manifests) path in a git repo:
//   - argocd: an Application (argoproj.io/v1alpha1) targeting the path, with
//             automated prune/selfHeal sync, retry/backoff and a revision
//             history for rollbacks.
//   - flux:   a GitRepository plus either a HelmRelease (default; install and
//             upgrade remediation with retries and a rollback strategy) or a
//             Kustomization (raw manifests).
// In both cases we also emit ONE Ingress covering every service with
// cert-manager TLS annotations, so the deployed app terminates TLS via an
// issued certificate. When the source is a Helm chart, the chart's own
// per-service Ingresses are switched off through values so the two do not
// fight over the same host.
//
// All emitted documents are plain YAML (rendered via js-yaml) so callers verify
// them by yaml-parsing and asserting kind/apiVersion.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { loadWorkspace, resolveK8sWorkspace, type ResolvedK8sWorkspace } from './k8s-config';

/**
 * Supported GitOps tools that can be targeted by manifest generation.
 *
 * - `argocd`: emits an ArgoCD Application resource.
 * - `flux`:   emits a Flux GitRepository + HelmRelease (or Kustomization) pair.
 */
export type GitOpsTool = 'argocd' | 'flux';

/**
 * What the GitOps controller reconciles.
 *
 * - `helm`:      the chart written by `k8s helm generate` (default).
 * - `manifests`: the plain manifests written by `k8s generate --out`.
 */
export type GitOpsSource = 'helm' | 'manifests';

/**
 * A single rendered GitOps manifest entry.
 *
 * Produced by rendering a manifest object to YAML; each entry corresponds to
 * one Kubernetes resource (e.g. an ArgoCD Application or a Flux HelmRelease).
 */
export interface RenderedGitOpsManifest {
  /** Kubernetes resource kind (e.g. `Application`, `GitRepository`, `Ingress`). */
  kind: string;
  /** Metadata name of the rendered resource. */
  name: string;
  /** The resource serialized as a YAML string. */
  yaml: string;
}

/**
 * Result returned by a GitOps-generation run.
 *
 * Contains the targeted tool, the rendered manifests, and the list of files
 * actually written to disk (if any).
 */
export interface GenerateGitOpsResult {
  /** The GitOps tool the manifests were generated for. */
  tool: GitOpsTool;
  /** What the controller reconciles (helm chart or raw manifests). */
  source: GitOpsSource;
  /** Rendered manifest entries (always populated, even on dry-run). */
  manifests: RenderedGitOpsManifest[];
  /** Files written to disk (absolute paths); empty for dry-run / no out. */
  written: string[];
  /** Non-fatal notes surfaced while generating. */
  warnings: string[];
}

/**
 * Options accepted by {@link generateGitOps}.
 *
 * Controls which GitOps tool to target, where to find the workspace config,
 * how to address the chart in git, and whether to write files to disk.
 */
export interface GenerateGitOpsOptions {
  /** Which GitOps tool to target. */
  tool: GitOpsTool;
  /** Directory containing the workspace v2 config (default: cwd). */
  cwd?: string;
  /** Explicit path to the workspace yaml; overrides cwd discovery. */
  configPath?: string;
  /** Target namespace for the deployed app. */
  namespace?: string;
  /** Git repo URL the GitOps tool reconciles from. */
  repoUrl?: string;
  /** Git revision/branch to track. */
  revision?: string;
  /** Path within the repo to the chart/manifests. */
  chartPath?: string;
  /** What to reconcile: the Helm chart (default) or raw manifests. */
  source?: GitOpsSource;
  /** Output directory to write files into; omitted/dry-run writes nothing. */
  out?: string;
  /** When true, do not write files regardless of `out`. */
  dryRun?: boolean;
}

const DEFAULT_NAMESPACE = 'default';
const DEFAULT_REPO_URL = 'https://github.com/example/app.git';
const DEFAULT_REVISION = 'main';
const DEFAULT_CHART_PATH = 'charts/app';

/** Releases/syncs kept for rollback. */
const REVISION_HISTORY_LIMIT = 10;
/** Argo CD automated-sync retry budget before a failed sync is surfaced. */
const RETRY_LIMIT = 5;
/** Flux Helm install/upgrade remediation retries before giving up (or rolling back). */
const FLUX_REMEDIATION_RETRIES = 3;

/** Loosely-typed structural view of a rendered manifest object. */
interface ManifestObject {
  apiVersion: string;
  kind: string;
  metadata: { name: string; namespace?: string } & Record<string, unknown>;
  spec?: Record<string, unknown>;
}

function render(manifest: ManifestObject): RenderedGitOpsManifest {
  return {
    kind: manifest.kind,
    name: manifest.metadata.name,
    yaml: yaml.dump(manifest, { lineWidth: 120, noRefs: true }),
  };
}

/**
 * Helm values that switch the chart's own per-service Ingress off, used when
 * this generator emits the single combined Ingress instead.
 */
function chartIngressOffValues(
  resolved: ResolvedK8sWorkspace
): Record<string, unknown> | undefined {
  const services: Record<string, unknown> = {};
  for (const svc of resolved.services) {
    if (svc.ingress.enabled) services[svc.name] = { ingress: { enabled: false } };
  }
  return Object.keys(services).length > 0 ? { services } : undefined;
}

/** True when any service is autoscaled (so Deployment replicas are HPA-owned). */
function anyAutoscaled(resolved: ResolvedK8sWorkspace): boolean {
  return resolved.services.some(s => s.autoscaling.enabled);
}

/**
 * ArgoCD Application targeting the chart/manifests path in the repo.
 *
 * Rollback-oriented sync policy: automated sync with prune + selfHeal (drift is
 * reverted), retry with exponential backoff (transient failures heal without
 * manual intervention), and `revisionHistoryLimit` sync records kept so
 * `argocd app rollback` has revisions to return to.
 */
function buildArgoApplication(
  appName: string,
  namespace: string,
  repoUrl: string,
  revision: string,
  chartPath: string,
  source: GitOpsSource,
  resolved: ResolvedK8sWorkspace,
  chartValues: Record<string, unknown> | undefined
): ManifestObject {
  const syncOptions = ['CreateNamespace=true', 'PruneLast=true'];
  const autoscaled = anyAutoscaled(resolved);
  if (autoscaled) syncOptions.push('RespectIgnoreDifferences=true');

  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: appName,
      namespace: 'argocd',
    },
    spec: {
      project: 'default',
      revisionHistoryLimit: REVISION_HISTORY_LIMIT,
      source: {
        repoURL: repoUrl,
        targetRevision: revision,
        path: chartPath,
        ...(source === 'helm'
          ? {
              helm: {
                releaseName: appName,
                ...(chartValues ? { valuesObject: chartValues } : {}),
              },
            }
          : { directory: { recurse: true } }),
      },
      destination: {
        server: 'https://kubernetes.default.svc',
        namespace,
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions,
        retry: {
          limit: RETRY_LIMIT,
          backoff: { duration: '5s', factor: 2, maxDuration: '3m' },
        },
      },
      // Replica counts of autoscaled Deployments belong to the HPA, not git.
      ...(autoscaled
        ? {
            ignoreDifferences: [
              { group: 'apps', kind: 'Deployment', jsonPointers: ['/spec/replicas'] },
            ],
          }
        : {}),
    },
  };
}

/** Flux GitRepository source. */
function buildFluxGitRepository(
  appName: string,
  repoUrl: string,
  revision: string
): ManifestObject {
  return {
    apiVersion: 'source.toolkit.fluxcd.io/v1',
    kind: 'GitRepository',
    metadata: { name: appName, namespace: 'flux-system' },
    spec: {
      interval: '1m',
      url: repoUrl,
      ref: { branch: revision },
    },
  };
}

/**
 * Flux HelmRelease installing the chart from the GitRepository.
 *
 * Rollback-oriented: install and upgrade remediation retry up to
 * {@link FLUX_REMEDIATION_RETRIES} times; a failed upgrade is remediated with
 * `strategy: rollback` (Helm rolls back to the last good release) and
 * `remediateLastFailure` makes the final failure roll back too. Drift detection
 * reverts out-of-band changes.
 */
function buildFluxHelmRelease(
  appName: string,
  namespace: string,
  chartPath: string,
  resolved: ResolvedK8sWorkspace,
  chartValues: Record<string, unknown> | undefined
): ManifestObject {
  return {
    apiVersion: 'helm.toolkit.fluxcd.io/v2',
    kind: 'HelmRelease',
    metadata: { name: appName, namespace: 'flux-system' },
    spec: {
      interval: '5m',
      timeout: '5m',
      releaseName: appName,
      targetNamespace: namespace,
      storageNamespace: namespace,
      maxHistory: REVISION_HISTORY_LIMIT,
      chart: {
        spec: {
          chart: `./${chartPath}`,
          reconcileStrategy: 'Revision',
          sourceRef: { kind: 'GitRepository', name: appName, namespace: 'flux-system' },
        },
      },
      install: {
        createNamespace: true,
        remediation: { retries: FLUX_REMEDIATION_RETRIES },
      },
      upgrade: {
        cleanupOnFail: true,
        remediation: {
          retries: FLUX_REMEDIATION_RETRIES,
          strategy: 'rollback',
          remediateLastFailure: true,
        },
      },
      rollback: { cleanupOnFail: true, timeout: '5m' },
      driftDetection: {
        mode: 'enabled',
        ...(anyAutoscaled(resolved)
          ? {
              ignore: [
                { paths: ['/spec/replicas'], target: { kind: 'Deployment' } },
              ],
            }
          : {}),
      },
      ...(chartValues ? { values: chartValues } : {}),
    },
  };
}

/** Flux Kustomization reconciling a path of raw manifests from the GitRepository. */
function buildFluxKustomization(
  appName: string,
  namespace: string,
  chartPath: string,
  resolved: ResolvedK8sWorkspace
): ManifestObject {
  return {
    apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
    kind: 'Kustomization',
    metadata: { name: appName, namespace: 'flux-system' },
    spec: {
      interval: '5m',
      retryInterval: '1m',
      timeout: '5m',
      wait: true,
      targetNamespace: namespace,
      sourceRef: { kind: 'GitRepository', name: appName },
      path: `./${chartPath}`,
      prune: true,
      healthChecks: resolved.services.map(s => ({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: s.name,
        namespace,
      })),
    },
  };
}

/**
 * One Ingress with cert-manager TLS automation covering every service whose
 * ingress is enabled. Shared by both tools so the reconciled app terminates TLS
 * via an issued certificate.
 */
function buildIngressWithTls(
  appName: string,
  namespace: string,
  resolved: ResolvedK8sWorkspace
): ManifestObject | undefined {
  const exposed = resolved.services.filter(s => s.ingress.enabled);
  if (exposed.length === 0) return undefined;
  const { className, clusterIssuer, tlsEnabled } = resolved.ingress;
  const hosts = Array.from(new Set(exposed.map(s => s.ingress.host)));

  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: appName,
      namespace,
      annotations: {
        'cert-manager.io/cluster-issuer': clusterIssuer,
        'nginx.ingress.kubernetes.io/ssl-redirect': String(tlsEnabled),
      },
    },
    spec: {
      ingressClassName: className,
      ...(tlsEnabled ? { tls: [{ hosts, secretName: `${appName}-tls` }] } : {}),
      rules: exposed.map(s => ({
        host: s.ingress.host,
        http: {
          paths: [
            {
              path: s.ingress.path,
              pathType: s.ingress.pathType,
              backend: { service: { name: s.name, port: { number: s.port } } },
            },
          ],
        },
      })),
    },
  };
}

/**
 * Generate GitOps manifests for the chosen tool from a workspace v2 config.
 *
 * The workspace config is read + validated for its name and services; the
 * emitted manifests point a GitOps controller at the chart path in the repo and
 * include an Ingress with cert-manager TLS. When `options.out` is set and the
 * run is not a dry-run, each manifest is written to a file named
 * `<tool>-<kind>-<name>.yaml` inside the output directory.
 *
 * @param options - Generation inputs; see {@link GenerateGitOpsOptions}.
 * @returns The targeted tool, rendered manifests, and any written file paths.
 * @throws Error when the config cannot be found/parsed or the tool is unknown.
 *   The command layer maps these to a `GITOPS_GENERATE_ERROR` envelope.
 */
export function generateGitOps(
  options: GenerateGitOpsOptions
): GenerateGitOpsResult {
  const tool = options.tool;
  if (tool !== 'argocd' && tool !== 'flux') {
    throw new Error(`Unknown GitOps tool "${String(tool)}" (expected argocd|flux)`);
  }
  const source: GitOpsSource = options.source ?? 'helm';
  if (source !== 'helm' && source !== 'manifests') {
    throw new Error(`Unknown GitOps source "${String(source)}" (expected helm|manifests)`);
  }

  const { config } = loadWorkspace({ cwd: options.cwd, configPath: options.configPath });
  const resolved = resolveK8sWorkspace(config);

  const appName = resolved.name;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const repoUrl = options.repoUrl ?? DEFAULT_REPO_URL;
  const revision = options.revision ?? DEFAULT_REVISION;
  const chartPath = options.chartPath ?? DEFAULT_CHART_PATH;

  const warnings = [...resolved.warnings];
  const ingress = buildIngressWithTls(appName, namespace, resolved);
  if (!ingress) {
    warnings.push('No service has ingress enabled; no Ingress was generated');
  }
  // The combined Ingress replaces the chart's per-service Ingresses.
  const chartValues = ingress && source === 'helm' ? chartIngressOffValues(resolved) : undefined;

  const manifests: RenderedGitOpsManifest[] = [];
  if (tool === 'argocd') {
    manifests.push(
      render(
        buildArgoApplication(
          appName,
          namespace,
          repoUrl,
          revision,
          chartPath,
          source,
          resolved,
          chartValues
        )
      )
    );
  } else {
    manifests.push(render(buildFluxGitRepository(appName, repoUrl, revision)));
    manifests.push(
      render(
        source === 'helm'
          ? buildFluxHelmRelease(appName, namespace, chartPath, resolved, chartValues)
          : buildFluxKustomization(appName, namespace, chartPath, resolved)
      )
    );
  }
  if (ingress) manifests.push(render(ingress));

  const written: string[] = [];
  const shouldWrite = Boolean(options.out) && options.dryRun !== true;
  if (shouldWrite && options.out) {
    fs.mkdirSync(options.out, { recursive: true });
    for (const manifest of manifests) {
      const fileName = `${tool}-${manifest.kind.toLowerCase()}-${manifest.name}.yaml`;
      const filePath = path.join(options.out, fileName);
      fs.writeFileSync(filePath, manifest.yaml);
      written.push(filePath);
    }
  }

  return { tool, source, manifests, written, warnings };
}
