// GitOps manifest generation from a workspace.yaml v2 config (W9c-2, P9-D3).
//
// Emit GitOps wiring that points a continuous-reconciliation tool at the chart
// (or raw manifests) path in a git repo:
//   - argocd: an Application (argoproj.io/v1alpha1) targeting the chart path.
//   - flux:   a GitRepository + Kustomization (or HelmRelease) targeting it.
// In both cases we also emit an Ingress with cert-manager TLS annotations so the
// deployed app terminates TLS via an issued certificate.
//
// All emitted documents are plain YAML (rendered via js-yaml) so callers verify
// them by yaml-parsing and asserting kind/apiVersion — never by deploying.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { WorkspaceParser } from '../parsers/workspace-parser';
import { resolveWorkspaceConfigPath } from './k8s-generate';

/** Supported GitOps tools. */
export type GitOpsTool = 'argocd' | 'flux';

/** A single rendered GitOps manifest entry. */
export interface RenderedGitOpsManifest {
  kind: string;
  name: string;
  yaml: string;
}

/** Result of a GitOps-generation run. */
export interface GenerateGitOpsResult {
  tool: GitOpsTool;
  manifests: RenderedGitOpsManifest[];
  /** Files written to disk (absolute paths); empty for dry-run / no out. */
  written: string[];
}

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
  /** Output directory to write files into; omitted/dry-run writes nothing. */
  out?: string;
  /** When true, do not write files regardless of `out`. */
  dryRun?: boolean;
}

const DEFAULT_NAMESPACE = 'default';
const DEFAULT_REPO_URL = 'https://github.com/example/app.git';
const DEFAULT_REVISION = 'main';
const DEFAULT_CHART_PATH = 'charts/app';
const CLUSTER_ISSUER = 'letsencrypt-prod';

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

/** ArgoCD Application targeting the chart path in the repo. */
function buildArgoApplication(
  appName: string,
  namespace: string,
  repoUrl: string,
  revision: string,
  chartPath: string
): ManifestObject {
  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: appName,
      namespace: 'argocd',
    },
    spec: {
      project: 'default',
      source: {
        repoURL: repoUrl,
        targetRevision: revision,
        path: chartPath,
      },
      destination: {
        server: 'https://kubernetes.default.svc',
        namespace,
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
        syncOptions: ['CreateNamespace=true'],
      },
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

/** Flux Kustomization reconciling the chart path from the GitRepository. */
function buildFluxKustomization(
  appName: string,
  namespace: string,
  chartPath: string
): ManifestObject {
  return {
    apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
    kind: 'Kustomization',
    metadata: { name: appName, namespace: 'flux-system' },
    spec: {
      interval: '5m',
      targetNamespace: namespace,
      sourceRef: { kind: 'GitRepository', name: appName },
      path: `./${chartPath}`,
      prune: true,
    },
  };
}

/**
 * An Ingress with cert-manager TLS automation. Shared by both tools so the
 * reconciled app terminates TLS via an issued certificate.
 */
function buildIngressWithTls(appName: string, namespace: string): ManifestObject {
  const host = `${appName}.example.com`;
  return {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: appName,
      namespace,
      annotations: {
        'cert-manager.io/cluster-issuer': CLUSTER_ISSUER,
        'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
      },
    },
    spec: {
      ingressClassName: 'nginx',
      tls: [{ hosts: [host], secretName: `${appName}-tls` }],
      rules: [
        {
          host,
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: { name: appName, port: { number: 80 } },
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * Generate GitOps manifests for the chosen tool from a workspace v2 config.
 *
 * The workspace config is read + validated for its name; the emitted manifests
 * point a GitOps controller at the chart path in the repo and include an
 * Ingress with cert-manager TLS.
 *
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

  const cwd = options.cwd ?? process.cwd();
  const configPath = resolveWorkspaceConfigPath(cwd, options.configPath);
  if (!configPath) {
    throw new Error(`No workspace v2 config found in ${cwd}`);
  }

  const parser = new WorkspaceParser();
  const parsed = parser.parse(configPath);
  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid workspace config: ${detail || 'unknown error'}`);
  }

  const appName = parsed.config.name || 'app';
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const repoUrl = options.repoUrl ?? DEFAULT_REPO_URL;
  const revision = options.revision ?? DEFAULT_REVISION;
  const chartPath = options.chartPath ?? DEFAULT_CHART_PATH;

  const manifests: RenderedGitOpsManifest[] = [];
  if (tool === 'argocd') {
    manifests.push(
      render(buildArgoApplication(appName, namespace, repoUrl, revision, chartPath))
    );
  } else {
    manifests.push(render(buildFluxGitRepository(appName, repoUrl, revision)));
    manifests.push(render(buildFluxKustomization(appName, namespace, chartPath)));
  }
  manifests.push(render(buildIngressWithTls(appName, namespace)));

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

  return { tool, manifests, written };
}
