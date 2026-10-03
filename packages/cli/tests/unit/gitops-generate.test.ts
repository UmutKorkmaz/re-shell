import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {
  generateGitOps,
  type RenderedGitOpsManifest,
} from '../../src/utils/gitops-generate';
import { runGitOpsGenerate } from '../../src/commands/gitops-generate';
import {
  kubeconformCrdsReady,
  runKubeconform,
  workspaceInTmp,
} from '../helpers/k8s-test-utils';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

async function inTmp(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitops-gen-'));
  await fs.copy(path.join(FIXTURES, 'k8s-workspace'), tmpDir);
  return tmpDir;
}

async function captureEnvelope<T = unknown>(fn: () => Promise<void>): Promise<T> {
  const chunks: string[] = [];
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    }) as typeof process.stdout.write);
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return JSON.parse(chunks.join('').trim()) as T;
}

function parse(m: RenderedGitOpsManifest): Record<string, unknown> {
  return yaml.load(m.yaml) as Record<string, unknown>;
}

describe('gitops-generate: generateGitOps (argocd)', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits an ArgoCD Application + a cert-manager TLS Ingress', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({ tool: 'argocd', cwd: tmpDir });
    const kinds = result.manifests.map(m => m.kind).sort();
    expect(kinds).toEqual(['Application', 'Ingress']);
  });

  it('Application yaml-parses with the argoproj apiVersion and a source path', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({
      tool: 'argocd',
      cwd: tmpDir,
      repoUrl: 'https://github.com/acme/app.git',
      chartPath: 'charts/myapp',
    });
    const app = result.manifests.find(m => m.kind === 'Application');
    expect(app).toBeDefined();
    const doc = parse(app as RenderedGitOpsManifest);
    expect(doc.apiVersion).toBe('argoproj.io/v1alpha1');
    const spec = doc.spec as Record<string, unknown>;
    const source = spec.source as Record<string, unknown>;
    expect(source.repoURL).toBe('https://github.com/acme/app.git');
    expect(source.path).toBe('charts/myapp');
  });

  it('Ingress yaml-parses with cert-manager TLS annotations + tls block', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({ tool: 'argocd', cwd: tmpDir });
    const ingress = result.manifests.find(m => m.kind === 'Ingress');
    const doc = parse(ingress as RenderedGitOpsManifest);
    expect(doc.apiVersion).toBe('networking.k8s.io/v1');
    const meta = doc.metadata as Record<string, unknown>;
    const annotations = meta.annotations as Record<string, string>;
    expect(annotations['cert-manager.io/cluster-issuer']).toBeDefined();
    const spec = doc.spec as Record<string, unknown>;
    expect((spec.tls as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('gitops-generate: generateGitOps (flux)', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  // P9-D3: a Kustomization cannot render a Helm chart, so the default Flux source is
  // now a HelmRelease; the original GitRepository + Kustomization output is the
  // `source: 'manifests'` mode (raw manifests written by `k8s generate --out`).
  it('emits a Flux GitRepository + Kustomization + cert-manager TLS Ingress', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir, source: 'manifests' });
    const kinds = result.manifests.map(m => m.kind).sort();
    expect(kinds).toEqual(['GitRepository', 'Ingress', 'Kustomization']);
  });

  it('emits a Flux GitRepository + HelmRelease + cert-manager TLS Ingress by default', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir });
    expect(result.source).toBe('helm');
    const kinds = result.manifests.map(m => m.kind).sort();
    expect(kinds).toEqual(['GitRepository', 'HelmRelease', 'Ingress']);
  });

  it('Flux manifests yaml-parse with the toolkit apiVersions', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir, source: 'manifests' });
    const repo = result.manifests.find(m => m.kind === 'GitRepository');
    const kust = result.manifests.find(m => m.kind === 'Kustomization');
    expect((parse(repo as RenderedGitOpsManifest).apiVersion as string)).toContain(
      'source.toolkit.fluxcd.io'
    );
    expect((parse(kust as RenderedGitOpsManifest).apiVersion as string)).toContain(
      'kustomize.toolkit.fluxcd.io'
    );
  });

  it('throws on an unknown tool', async () => {
    tmpDir = await inTmp();
    expect(() =>
      generateGitOps({ tool: 'unknown' as 'argocd', cwd: tmpDir })
    ).toThrow(/Unknown GitOps tool/);
  });

  it('dry-run writes nothing even when out is provided', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'gitops-out');
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir, out: outDir, dryRun: true });
    expect(result.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--out (non-dry-run) writes one file per manifest', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'gitops-out');
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir, out: outDir });
    expect(result.written).toHaveLength(result.manifests.length);
    for (const file of result.written) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });
});

describe('gitops-generate: command layer (envelopes + exit codes)', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('--json --tool argocd emits ok envelope with parseable manifests', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{
      ok: boolean;
      data: { tool: string; manifests: RenderedGitOpsManifest[]; written: string[] };
    }>(() => runGitOpsGenerate({ tool: 'argocd', json: true, cwd: tmpDir }));

    expect(env.ok).toBe(true);
    expect(env.data.tool).toBe('argocd');
    for (const manifest of env.data.manifests) {
      const doc = yaml.load(manifest.yaml) as Record<string, unknown>;
      expect(doc.kind).toBe(manifest.kind);
      expect(typeof doc.apiVersion).toBe('string');
    }
    expect(process.exitCode).toBe(0);
  });

  it('--json --dry-run writes nothing', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'out');
    const env = await captureEnvelope<{ ok: boolean; data: { written: string[] } }>(() =>
      runGitOpsGenerate({ tool: 'flux', json: true, dryRun: true, out: outDir, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(env.data.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--json with an unknown tool emits GITOPS_GENERATE_ERROR and exit 1', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{
      ok: boolean;
      error: { code: string; message: string };
    }>(() => runGitOpsGenerate({ tool: 'bogus', json: true, cwd: tmpDir }));
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('GITOPS_GENERATE_ERROR');
    expect(process.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// P9-D3: rollback-capable GitOps manifests
// ---------------------------------------------------------------------------

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function doc(result: { manifests: RenderedGitOpsManifest[] }, kind: string): Doc {
  const m = result.manifests.find(x => x.kind === kind);
  expect(m, kind).toBeDefined();
  return yaml.load((m as RenderedGitOpsManifest).yaml) as Doc;
}

describe('gitops-generate: Argo CD sync policy and rollback', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('automated sync with prune + selfHeal', async () => {
    tmpDir = await inTmp();
    const app = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir }), 'Application');
    expect(app.spec.syncPolicy.automated).toEqual({ prune: true, selfHeal: true });
    expect(app.spec.syncPolicy.syncOptions).toEqual(
      expect.arrayContaining(['CreateNamespace=true', 'PruneLast=true'])
    );
  });

  it('retries failed syncs with exponential backoff', async () => {
    tmpDir = await inTmp();
    const app = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir }), 'Application');
    expect(app.spec.syncPolicy.retry).toEqual({
      limit: 5,
      backoff: { duration: '5s', factor: 2, maxDuration: '3m' },
    });
  });

  it('keeps a revision history (revisionHistoryLimit) for rollbacks', async () => {
    tmpDir = await inTmp();
    const app = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir }), 'Application');
    expect(app.spec.revisionHistoryLimit).toBe(10);
  });

  it('helm source: releaseName + values that switch the chart ingresses off (the combined Ingress replaces them)', async () => {
    tmpDir = await inTmp();
    const app = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir }), 'Application');
    expect(app.spec.source.helm.releaseName).toBe('k8s-demo');
    expect(app.spec.source.helm.valuesObject).toEqual({
      services: { api: { ingress: { enabled: false } }, worker: { ingress: { enabled: false } } },
    });
  });

  it('ignores HPA-owned Deployment replicas so selfHeal does not fight the autoscaler', async () => {
    tmpDir = await inTmp();
    const app = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir }), 'Application');
    expect(app.spec.ignoreDifferences).toEqual([
      { group: 'apps', kind: 'Deployment', jsonPointers: ['/spec/replicas'] },
    ]);
    expect(app.spec.syncPolicy.syncOptions).toContain('RespectIgnoreDifferences=true');
  });

  it('manifests source: directory recursion instead of a helm block', async () => {
    tmpDir = await inTmp();
    const app = doc(
      generateGitOps({ tool: 'argocd', cwd: tmpDir, source: 'manifests', chartPath: 'k8s' }),
      'Application'
    );
    expect(app.spec.source.directory).toEqual({ recurse: true });
    expect(app.spec.source.helm).toBeUndefined();
    expect(app.spec.source.path).toBe('k8s');
  });
});

describe('gitops-generate: Flux HelmRelease remediation and rollback', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('install and upgrade remediation retry, and upgrades roll back', async () => {
    tmpDir = await inTmp();
    const hr = doc(generateGitOps({ tool: 'flux', cwd: tmpDir }), 'HelmRelease');
    expect(hr.apiVersion).toBe('helm.toolkit.fluxcd.io/v2');
    expect(hr.spec.install.remediation).toEqual({ retries: 3 });
    expect(hr.spec.upgrade.remediation).toEqual({
      retries: 3,
      strategy: 'rollback',
      remediateLastFailure: true,
    });
    expect(hr.spec.upgrade.cleanupOnFail).toBe(true);
    expect(hr.spec.rollback).toEqual({ cleanupOnFail: true, timeout: '5m' });
    expect(hr.spec.maxHistory).toBe(10);
  });

  it('chart comes from the GitRepository at the chart path, into the target namespace', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({
      tool: 'flux',
      cwd: tmpDir,
      namespace: 'apps',
      chartPath: 'charts/k8s-demo',
      repoUrl: 'https://github.com/acme/app.git',
      revision: 'release',
    });
    const hr = doc(result, 'HelmRelease');
    expect(hr.spec.chart.spec).toEqual({
      chart: './charts/k8s-demo',
      reconcileStrategy: 'Revision',
      sourceRef: { kind: 'GitRepository', name: 'k8s-demo', namespace: 'flux-system' },
    });
    expect(hr.spec.targetNamespace).toBe('apps');
    expect(hr.spec.values).toEqual({
      services: { api: { ingress: { enabled: false } }, worker: { ingress: { enabled: false } } },
    });
    const repo = doc(result, 'GitRepository');
    expect(repo.spec).toEqual({
      interval: '1m',
      url: 'https://github.com/acme/app.git',
      ref: { branch: 'release' },
    });
    expect(hr.spec.driftDetection.mode).toBe('enabled');
  });

  it('manifests source: Kustomization with prune, wait and health checks', async () => {
    tmpDir = await inTmp();
    const k = doc(
      generateGitOps({ tool: 'flux', cwd: tmpDir, source: 'manifests', chartPath: 'k8s', namespace: 'apps' }),
      'Kustomization'
    );
    expect(k.spec).toMatchObject({ prune: true, wait: true, path: './k8s', targetNamespace: 'apps' });
    expect(k.spec.healthChecks.map((h: Doc) => h.name)).toEqual(['api', 'worker']);
  });
});

describe('gitops-generate: one TLS Ingress for every exposed service', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('routes each service host to its own Service and port (not a phantom app:80 backend)', async () => {
    tmpDir = await inTmp();
    const ing = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir, namespace: 'apps' }), 'Ingress');
    expect(ing.metadata.namespace).toBe('apps');
    const backends = ing.spec.rules.map((r: Doc) => ({
      host: r.host,
      svc: r.http.paths[0].backend.service,
    }));
    expect(backends).toEqual([
      { host: 'api.example.com', svc: { name: 'api', port: { number: 3000 } } },
      { host: 'worker.example.com', svc: { name: 'worker', port: { number: 8080 } } },
    ]);
  });

  it('TLS covers all hosts through a single cert-manager secret', async () => {
    tmpDir = await inTmp();
    const ing = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir }), 'Ingress');
    expect(ing.spec.tls).toEqual([
      { hosts: ['api.example.com', 'worker.example.com'], secretName: 'k8s-demo-tls' },
    ]);
    expect(ing.metadata.annotations['cert-manager.io/cluster-issuer']).toBe('letsencrypt-prod');
    expect(ing.spec.ingressClassName).toBe('nginx');
  });

  it('honours per-service ingress settings and workspace issuer/class', async () => {
    tmpDir = await workspaceInTmp(`name: shop
version: 2.0.0
kubernetes:
  ingress: { className: traefik, clusterIssuer: letsencrypt-staging }
services:
  web:
    name: web
    language: typescript
    framework: express
    port: 3000
    kubernetes: { ingress: { host: shop.acme.io, path: /app, pathType: Exact } }
  jobs:
    name: jobs
    language: python
    framework: flask
    port: 8000
    kubernetes: { ingress: { enabled: false } }
`);
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir });
    const ing = doc(result, 'Ingress');
    expect(ing.spec.ingressClassName).toBe('traefik');
    expect(ing.metadata.annotations['cert-manager.io/cluster-issuer']).toBe('letsencrypt-staging');
    expect(ing.spec.rules).toHaveLength(1);
    expect(ing.spec.rules[0]).toMatchObject({
      host: 'shop.acme.io',
      http: { paths: [{ path: '/app', pathType: 'Exact', backend: { service: { name: 'web', port: { number: 3000 } } } }] },
    });
    // only exposed services are switched off in the chart values
    expect(doc(result, 'HelmRelease').spec.values).toEqual({ services: { web: { ingress: { enabled: false } } } });
  });

  it('TLS can be disabled (no tls block, no ssl-redirect)', async () => {
    tmpDir = await workspaceInTmp(`name: plain
version: 2.0.0
kubernetes:
  ingress: { tls: false }
services:
  web: { name: web, language: go, framework: gin, port: 8080 }
`);
    const ing = doc(generateGitOps({ tool: 'argocd', cwd: tmpDir }), 'Ingress');
    expect(ing.spec.tls).toBeUndefined();
    expect(ing.metadata.annotations['nginx.ingress.kubernetes.io/ssl-redirect']).toBe('false');
  });

  it('emits no Ingress (and says so) when no service is exposed', async () => {
    tmpDir = await workspaceInTmp(`name: internal
version: 2.0.0
services:
  jobs:
    name: jobs
    language: python
    framework: flask
    port: 8000
    kubernetes: { ingress: { enabled: false } }
`);
    const result = generateGitOps({ tool: 'argocd', cwd: tmpDir });
    expect(result.manifests.map(m => m.kind)).toEqual(['Application']);
    expect(result.warnings.join(' ')).toMatch(/No service has ingress enabled/);
  });

  it('rejects an unknown source', async () => {
    tmpDir = await inTmp();
    expect(() => generateGitOps({ tool: 'argocd', cwd: tmpDir, source: 'oci' as 'helm' })).toThrow(
      /Unknown GitOps source/
    );
  });

  it('command layer reports the source and warnings in the JSON envelope', async () => {
    tmpDir = await inTmp();
    process.exitCode = 0;
    const env = await captureEnvelope<{ ok: boolean; data: { source: string; tool: string } }>(() =>
      runGitOpsGenerate({ json: true, tool: 'flux', source: 'manifests', cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(env.data).toMatchObject({ tool: 'flux', source: 'manifests' });
    const bad = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
      runGitOpsGenerate({ json: true, tool: 'flux', source: 'oci', cwd: tmpDir })
    );
    expect(bad.ok).toBe(false);
    expect(bad.error.code).toBe('GITOPS_GENERATE_ERROR');
    process.exitCode = 0;
  });
});

describe.skipIf(!kubeconformCrdsReady)('gitops-generate: kubeconform validation (CRD catalogue)', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  for (const [tool, source] of [
    ['argocd', 'helm'],
    ['argocd', 'manifests'],
    ['flux', 'helm'],
    ['flux', 'manifests'],
  ] as const) {
    it(`${tool} (${source}) manifests validate against their CRD schemas`, async () => {
      tmpDir = await inTmp();
      const result = generateGitOps({ tool, source, cwd: tmpDir, namespace: 'apps' });
      const verdict = runKubeconform(result.manifests.map(m => m.yaml).join('---\n'), { crds: true });
      expect(verdict.output).toMatch(/Invalid: 0, Errors: 0/);
      expect(verdict.ok).toBe(true);
    });
  }
});
