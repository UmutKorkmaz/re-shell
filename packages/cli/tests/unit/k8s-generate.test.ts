import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

import {
  generateManifests,
  resolveWorkspaceConfigPath,
  type RenderedManifest,
} from '../../src/utils/k8s-generate';
import { runK8sGenerate } from '../../src/commands/k8s-generate';
import {
  kubeconformReady,
  runKubeconform,
  workspaceInTmp,
} from '../helpers/k8s-test-utils';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

/** Copy the k8s fixture into a throwaway tmp dir so tests never touch the repo. */
async function inTmp(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'k8s-gen-'));
  await fs.copy(path.join(FIXTURES, 'k8s-workspace'), tmpDir);
  return tmpDir;
}

/**
 * Capture exactly the single JSON envelope written to stdout while running an
 * async fn that calls ok()/fail() (which patch stdout internally).
 */
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

function parseYaml(manifest: RenderedManifest): Record<string, unknown> {
  return yaml.load(manifest.yaml) as Record<string, unknown>;
}

function metaName(doc: Record<string, unknown>): string {
  return ((doc.metadata as Record<string, unknown>).name as string) ?? '';
}

describe('k8s-generate: generateManifests', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits five manifests per service (Deployment, Service, HPA, NetworkPolicy, PodDisruptionBudget)', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir });
    // 2 services × 5 manifests = 10 (P9-D1 added the PodDisruptionBudget)
    expect(result.manifests).toHaveLength(10);
    const kinds = result.manifests.map(m => m.kind).sort();
    expect(kinds).toEqual([
      'Deployment',
      'Deployment',
      'HorizontalPodAutoscaler',
      'HorizontalPodAutoscaler',
      'NetworkPolicy',
      'NetworkPolicy',
      'PodDisruptionBudget',
      'PodDisruptionBudget',
      'Service',
      'Service',
    ]);
  });

  it('every manifest YAML parses and carries apiVersion/kind/metadata.name', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir });
    for (const manifest of result.manifests) {
      const doc = parseYaml(manifest);
      expect(typeof doc.apiVersion).toBe('string');
      expect((doc.apiVersion as string).length).toBeGreaterThan(0);
      expect(doc.kind).toBe(manifest.kind);
      expect(metaName(doc)).toBe(manifest.name);
    }
  });

  it('Deployment has expected apiVersion, port, env, and resources', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir });
    const deploy = result.manifests.find(
      m => m.kind === 'Deployment' && m.name === 'api'
    );
    expect(deploy).toBeDefined();
    const doc = parseYaml(deploy as RenderedManifest);
    expect(doc.apiVersion).toBe('apps/v1');
    const container = (
      (((doc.spec as Record<string, unknown>).template as Record<string, unknown>)
        .spec as Record<string, unknown>).containers as Array<Record<string, unknown>>
    )[0];
    expect((container.ports as Array<{ containerPort: number }>)[0].containerPort).toBe(3000);
    expect(container.env).toBeDefined();
    expect(container.resources).toBeDefined();
  });

  it('HPA present with CPU resource metric and a custom-metric (Pods) stub', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir });
    const hpa = result.manifests.find(m => m.kind === 'HorizontalPodAutoscaler');
    expect(hpa).toBeDefined();
    const doc = parseYaml(hpa as RenderedManifest);
    expect(doc.apiVersion).toBe('autoscaling/v2');
    const metrics = (doc.spec as Record<string, unknown>).metrics as Array<
      Record<string, unknown>
    >;
    expect(metrics.some(m => m.type === 'Resource')).toBe(true);
    expect(metrics.some(m => m.type === 'Pods')).toBe(true);
  });

  it('NetworkPolicy present: default-deny baseline + allow intra-namespace ingress', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir, namespace: 'apps' });
    const np = result.manifests.find(m => m.kind === 'NetworkPolicy');
    expect(np).toBeDefined();
    const doc = parseYaml(np as RenderedManifest);
    expect(doc.apiVersion).toBe('networking.k8s.io/v1');
    const spec = doc.spec as Record<string, unknown>;
    expect((spec.policyTypes as string[])).toContain('Ingress');
    const ingress = spec.ingress as Array<{ from: Array<Record<string, unknown>> }>;
    const nsSelector = ingress[0].from[0].namespaceSelector as {
      matchLabels: Record<string, string>;
    };
    expect(nsSelector.matchLabels['kubernetes.io/metadata.name']).toBe('apps');
  });

  it('honors the namespace option on every manifest', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir, namespace: 'staging' });
    for (const manifest of result.manifests) {
      const doc = parseYaml(manifest);
      expect((doc.metadata as Record<string, unknown>).namespace).toBe('staging');
    }
  });

  it('dry-run writes nothing even when out is provided', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'k8s-out');
    const result = generateManifests({ cwd: tmpDir, out: outDir, dryRun: true });
    expect(result.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--out (non-dry-run) writes one file per manifest', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'k8s-out');
    const result = generateManifests({ cwd: tmpDir, out: outDir });
    expect(result.written).toHaveLength(10);
    for (const file of result.written) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('throws when no workspace config is found', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'k8s-empty-'));
    expect(() => generateManifests({ cwd: tmpDir })).toThrow(/No workspace v2 config/);
  });

  it('resolveWorkspaceConfigPath finds the fixture config', async () => {
    tmpDir = await inTmp();
    const found = resolveWorkspaceConfigPath(tmpDir);
    expect(found).toBeDefined();
    expect(found?.endsWith('re-shell.workspaces.yaml')).toBe(true);
  });
});

describe('k8s-generate: command layer (envelopes + exit codes)', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('generate --json emits ok envelope with valid manifests for the fixture', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{
      ok: boolean;
      data: {
        namespace: string;
        manifests: RenderedManifest[];
        written: string[];
        kubectl: { ran: boolean; ok?: boolean };
      };
    }>(() => runK8sGenerate({ json: true, cwd: tmpDir }));

    expect(env.ok).toBe(true);
    expect(env.data.manifests).toHaveLength(10);
    // Each manifest yaml must parse and have apiVersion/kind/metadata.name.
    for (const manifest of env.data.manifests) {
      const doc = yaml.load(manifest.yaml) as Record<string, unknown>;
      expect(typeof doc.apiVersion).toBe('string');
      expect(doc.kind).toBe(manifest.kind);
      expect((doc.metadata as Record<string, unknown>).name).toBe(manifest.name);
    }
    // HPA + NetworkPolicy present.
    expect(env.data.manifests.some(m => m.kind === 'HorizontalPodAutoscaler')).toBe(true);
    expect(env.data.manifests.some(m => m.kind === 'NetworkPolicy')).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('--json --dry-run writes nothing and reports empty written list', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'out');
    const env = await captureEnvelope<{ ok: boolean; data: { written: string[] } }>(() =>
      runK8sGenerate({ json: true, dryRun: true, out: outDir, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(env.data.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--json on a config-less dir emits K8S_GENERATE_ERROR and exit 1', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'k8s-empty-'));
    const env = await captureEnvelope<{
      ok: boolean;
      error: { code: string; message: string };
    }>(() => runK8sGenerate({ json: true, cwd: tmpDir }));
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('K8S_GENERATE_ERROR');
    expect(process.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// P9-D1: security, resilience and rollback settings
// ---------------------------------------------------------------------------

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function find(result: { manifests: RenderedManifest[] }, kind: string, name: string): Doc {
  const m = result.manifests.find(x => x.kind === kind && x.name === name);
  expect(m, `${kind}/${name}`).toBeDefined();
  return yaml.load((m as RenderedManifest).yaml) as Doc;
}

describe('k8s-generate: hardened Deployment (P9-D1)', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('sets pod and container securityContext to the restricted profile', async () => {
    tmpDir = await inTmp();
    const dep = find(generateManifests({ cwd: tmpDir }), 'Deployment', 'api');
    const pod = dep.spec.template.spec;
    expect(pod.securityContext).toEqual({
      runAsNonRoot: true,
      runAsUser: 10001,
      runAsGroup: 10001,
      fsGroup: 10001,
      seccompProfile: { type: 'RuntimeDefault' },
    });
    expect(pod.automountServiceAccountToken).toBe(false);
    const c = pod.containers[0];
    expect(c.securityContext).toMatchObject({
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      runAsNonRoot: true,
      runAsUser: 10001,
      capabilities: { drop: ['ALL'] },
      seccompProfile: { type: 'RuntimeDefault' },
    });
  });

  it('mounts an emptyDir on /tmp so the read-only root filesystem stays usable', async () => {
    tmpDir = await inTmp();
    const pod = find(generateManifests({ cwd: tmpDir }), 'Deployment', 'api').spec.template.spec;
    expect(pod.containers[0].volumeMounts).toEqual([{ name: 'tmp', mountPath: '/tmp' }]);
    expect(pod.volumes).toEqual([{ name: 'tmp', emptyDir: {} }]);
  });

  it('declares resource requests and limits', async () => {
    tmpDir = await inTmp();
    const c = find(generateManifests({ cwd: tmpDir }), 'Deployment', 'api').spec.template.spec.containers[0];
    expect(c.resources.requests).toEqual({ cpu: '100m', memory: '128Mi' });
    expect(c.resources.limits).toEqual({ cpu: '500m', memory: '512Mi' });
  });

  it('derives liveness/readiness probes from healthCheck.path (tcpSocket without one)', async () => {
    tmpDir = await workspaceInTmp(`name: probes
version: 2.0.0
services:
  api:
    name: api
    language: typescript
    framework: express
    port: 3000
    healthCheck: { path: /healthz, interval: 4, timeout: 2, retries: 6 }
  worker:
    name: worker
    language: python
    framework: flask
    port: 8081
`);
    const result = generateManifests({ cwd: tmpDir });
    const api = find(result, 'Deployment', 'api').spec.template.spec.containers[0];
    expect(api.livenessProbe).toMatchObject({
      httpGet: { path: '/healthz', port: 'http' },
      periodSeconds: 4,
      timeoutSeconds: 2,
      failureThreshold: 6,
    });
    expect(api.readinessProbe.httpGet).toEqual({ path: '/healthz', port: 'http' });
    const worker = find(result, 'Deployment', 'worker').spec.template.spec.containers[0];
    expect(worker.livenessProbe.tcpSocket).toEqual({ port: 'http' });
    expect(worker.readinessProbe.tcpSocket).toEqual({ port: 'http' });
  });

  it('configures rollback: RollingUpdate strategy and revisionHistoryLimit', async () => {
    tmpDir = await inTmp();
    const spec = find(generateManifests({ cwd: tmpDir }), 'Deployment', 'api').spec;
    expect(spec.strategy).toEqual({
      type: 'RollingUpdate',
      rollingUpdate: { maxSurge: 1, maxUnavailable: 0 },
    });
    expect(spec.revisionHistoryLimit).toBe(10);
    expect(spec.progressDeadlineSeconds).toBe(600);
  });

  it('honors workspace/service configuration of every setting', async () => {
    tmpDir = await workspaceInTmp(`name: custom
version: 2.0.0
kubernetes:
  revisionHistoryLimit: 4
  securityContext:
    runAsUser: 2000
services:
  api:
    name: api
    language: go
    framework: gin
    port: 8080
    kubernetes:
      replicas: 3
      progressDeadlineSeconds: 90
      strategy: { type: RollingUpdate, maxSurge: "50%", maxUnavailable: 1 }
      securityContext:
        readOnlyRootFilesystem: false
        capabilities: { drop: [ALL], add: [NET_BIND_SERVICE] }
        seccompProfile: Unconfined
      image: { registry: ghcr.io/acme, tag: "1.4.0", pullPolicy: Always }
      pdb: { maxUnavailable: "30%" }
`);
    const result = generateManifests({ cwd: tmpDir });
    const dep = find(result, 'Deployment', 'api');
    expect(dep.spec.replicas).toBe(3);
    expect(dep.spec.revisionHistoryLimit).toBe(4);
    expect(dep.spec.progressDeadlineSeconds).toBe(90);
    expect(dep.spec.strategy.rollingUpdate).toEqual({ maxSurge: '50%', maxUnavailable: 1 });
    const pod = dep.spec.template.spec;
    expect(pod.securityContext.runAsUser).toBe(2000);
    expect(pod.securityContext.seccompProfile).toEqual({ type: 'Unconfined' });
    const c = pod.containers[0];
    expect(c.image).toBe('ghcr.io/acme/api:1.4.0');
    expect(c.imagePullPolicy).toBe('Always');
    expect(c.securityContext.readOnlyRootFilesystem).toBe(false);
    expect(c.securityContext.capabilities).toEqual({ drop: ['ALL'], add: ['NET_BIND_SERVICE'] });
    expect(c.volumeMounts).toBeUndefined(); // no read-only root fs -> no emptyDir needed
    expect(find(result, 'PodDisruptionBudget', 'api').spec).toEqual({
      maxUnavailable: '30%',
      selector: { matchLabels: { app: 'api' } },
    });
  });

  it('fails explicitly on settings Kubernetes would reject', async () => {
    tmpDir = await workspaceInTmp(`name: bad
version: 2.0.0
services:
  api:
    name: api
    language: go
    framework: gin
    port: 8080
    resources: { cpu: { request: 900m, limit: 100m } }
`);
    expect(() => generateManifests({ cwd: tmpDir })).toThrow(/cpu request \(900m\) exceeds its limit/);
  });

  it('PodDisruptionBudget keeps one pod available for multi-replica services', async () => {
    tmpDir = await inTmp();
    const pdb = find(generateManifests({ cwd: tmpDir }), 'PodDisruptionBudget', 'api');
    expect(pdb.apiVersion).toBe('policy/v1');
    expect(pdb.spec).toEqual({ minAvailable: 1, selector: { matchLabels: { app: 'api' } } });
  });

  it('autoscaling/networkPolicy/pdb can each be switched off', async () => {
    tmpDir = await workspaceInTmp(`name: lean
version: 2.0.0
services:
  api:
    name: api
    language: go
    framework: gin
    port: 8080
    kubernetes:
      autoscaling: { enabled: false }
      networkPolicy: { enabled: false }
      pdb: { enabled: false }
`);
    const kinds = generateManifests({ cwd: tmpDir }).manifests.map(m => m.kind).sort();
    expect(kinds).toEqual(['Deployment', 'Service']);
  });

  it('HPA scales on CPU plus the Pods custom metric (and memory when configured)', async () => {
    tmpDir = await workspaceInTmp(`name: hpa
version: 2.0.0
services:
  api:
    name: api
    language: go
    framework: gin
    port: 8080
    kubernetes:
      autoscaling:
        minReplicas: 3
        maxReplicas: 9
        cpuUtilization: 60
        memoryUtilization: 75
        customMetric: { name: queue_depth, averageValue: "30" }
`);
    const hpa = find(generateManifests({ cwd: tmpDir }), 'HorizontalPodAutoscaler', 'api').spec;
    expect(hpa.minReplicas).toBe(3);
    expect(hpa.maxReplicas).toBe(9);
    expect(hpa.metrics).toEqual([
      { type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 60 } } },
      { type: 'Resource', resource: { name: 'memory', target: { type: 'Utilization', averageUtilization: 75 } } },
      {
        type: 'Pods',
        pods: { metric: { name: 'queue_depth' }, target: { type: 'AverageValue', averageValue: '30' } },
      },
    ]);
  });

  it('NetworkPolicy also admits the ingress controller namespace', async () => {
    tmpDir = await inTmp();
    const np = find(generateManifests({ cwd: tmpDir, namespace: 'apps' }), 'NetworkPolicy', 'api-default-deny-allow-intra');
    const sources = np.spec.ingress[0].from.map(
      (f: Doc) => f.namespaceSelector.matchLabels['kubernetes.io/metadata.name']
    );
    expect(sources).toEqual(['apps', 'ingress-nginx']);
  });

  it('surfaces non-fatal warnings (non-native deployment strategy)', async () => {
    tmpDir = await workspaceInTmp(`name: warn
version: 2.0.0
deployment: { strategy: canary }
services:
  api: { name: api, language: go, framework: gin, port: 8080 }
`);
    const result = generateManifests({ cwd: tmpDir });
    expect(result.warnings.join(' ')).toMatch(/canary/);
    // the JSON envelope carries them
    process.exitCode = 0;
    const env = await captureEnvelope<{ ok: boolean; warnings: string[] }>(() =>
      runK8sGenerate({ json: true, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(env.warnings.join(' ')).toMatch(/canary/);
  });
});

describe.skipIf(!kubeconformReady)('k8s-generate: kubeconform schema validation', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('every generated manifest validates against the Kubernetes 1.31 schemas (strict)', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir, namespace: 'apps' });
    const verdict = runKubeconform(result.manifests.map(m => m.yaml).join('---\n'));
    expect(verdict.output).toMatch(/Invalid: 0, Errors: 0/);
    expect(verdict.ok).toBe(true);
  });

  it('a customised workspace (probes, strategy, security overrides, PDB) still validates', async () => {
    tmpDir = await workspaceInTmp(`name: full
version: 2.0.0
kubernetes:
  securityContext: { writablePaths: [/tmp, /var/cache/app] }
services:
  api:
    name: api
    language: typescript
    framework: express
    port: 3000
    healthCheck: { path: /healthz }
    scaling: { min: 2, max: 6, metrics: [{ type: cpu, value: 65 }, { type: custom, name: rps, value: 200 }] }
    kubernetes:
      strategy: { maxSurge: "25%", maxUnavailable: 0 }
      probes: { startup: { failureThreshold: 40 } }
      pdb: { minAvailable: "50%" }
`);
    const result = generateManifests({ cwd: tmpDir });
    const verdict = runKubeconform(result.manifests.map(m => m.yaml).join('---\n'));
    expect(verdict.output).toMatch(/Invalid: 0, Errors: 0/);
    expect(verdict.ok).toBe(true);
  });
});
