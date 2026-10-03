import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { jsonResponseSchema, k8sMeshResponseSchema } from '@re-shell/contracts';

import { generateMesh, type GenerateMeshResult } from '../../src/utils/k8s-mesh';
import { runK8sMesh } from '../../src/commands/k8s-mesh';
import {
  captureEnvelope,
  inTmp,
  kubeconformCrdsReady,
  runKubeconform,
  workspaceInTmp,
} from '../helpers/k8s-test-utils';

type Node = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function docs(result: GenerateMeshResult, kind: string): Node[] {
  return result.manifests.filter(m => m.kind === kind).map(m => yaml.load(m.yaml) as Node);
}

const ROUTES_WORKSPACE = `name: shop
version: 2.0.0
services:
  api:
    name: api
    language: typescript
    framework: express
    port: 3000
    healthCheck: { path: /healthz }
    routes:
      - { path: /orders, target: orders, method: GET }
      - { path: /orders, target: orders, method: POST }
      - { path: /static/*, target: assets }
  worker:
    name: worker
    language: python
    framework: flask
    port: 8081
`;

describe('k8s-mesh: Istio', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits the namespace (injection label), PeerAuthentication, and a DestinationRule + VirtualService per service', async () => {
    tmpDir = await inTmp();
    const result = generateMesh({ mesh: 'istio', cwd: tmpDir, namespace: 'apps' });
    expect(result.manifests.map(m => `${m.kind}/${m.name}`)).toEqual([
      'Namespace/apps',
      'PeerAuthentication/default',
      'DestinationRule/api',
      'VirtualService/api',
      'DestinationRule/worker',
      'VirtualService/worker',
    ]);
    const [ns] = docs(result, 'Namespace');
    expect(ns.metadata.labels).toEqual({ 'istio-injection': 'enabled' });
  });

  it('PeerAuthentication is STRICT by default and PERMISSIVE with mtls:false', async () => {
    tmpDir = await inTmp();
    const strict = docs(generateMesh({ cwd: tmpDir, namespace: 'apps' }), 'PeerAuthentication')[0];
    expect(strict.apiVersion).toBe('security.istio.io/v1');
    expect(strict.spec).toEqual({ mtls: { mode: 'STRICT' } });
    expect(strict.metadata).toMatchObject({ name: 'default', namespace: 'apps' });

    const permissive = generateMesh({ cwd: tmpDir, mtls: false });
    expect(docs(permissive, 'PeerAuthentication')[0].spec.mtls.mode).toBe('PERMISSIVE');
    // client-side TLS follows
    expect(docs(permissive, 'DestinationRule')[0].spec.trafficPolicy.tls).toBeUndefined();
  });

  it('DestinationRule targets the service FQDN with ISTIO_MUTUAL TLS, pooling and outlier detection', async () => {
    tmpDir = await inTmp();
    const dr = docs(generateMesh({ cwd: tmpDir, namespace: 'apps' }), 'DestinationRule').find(
      d => d.metadata.name === 'api'
    )!;
    expect(dr.apiVersion).toBe('networking.istio.io/v1');
    expect(dr.spec.host).toBe('api.apps.svc.cluster.local');
    expect(dr.spec.trafficPolicy.tls).toEqual({ mode: 'ISTIO_MUTUAL' });
    expect(dr.spec.trafficPolicy.connectionPool.tcp.maxConnections).toBe(100);
    expect(dr.spec.trafficPolicy.outlierDetection).toMatchObject({ consecutive5xxErrors: 5, maxEjectionPercent: 50 });
  });

  it('VirtualService routes to the workspace port with retries and a timeout', async () => {
    tmpDir = await inTmp();
    const vs = docs(generateMesh({ cwd: tmpDir, namespace: 'apps' }), 'VirtualService').find(
      d => d.metadata.name === 'worker'
    )!;
    expect(vs.spec.hosts).toEqual(['worker.apps.svc.cluster.local']);
    expect(vs.spec.http).toHaveLength(1);
    expect(vs.spec.http[0].route[0].destination).toEqual({
      host: 'worker.apps.svc.cluster.local',
      port: { number: 8080 },
    });
    expect(vs.spec.http[0].retries).toEqual({
      attempts: 3,
      perTryTimeout: '5s',
      retryOn: '5xx,reset,connect-failure',
    });
    expect(vs.spec.http[0].timeout).toBe('15s');
  });

  it('declared routes become matches, followed by a catch-all', async () => {
    tmpDir = await workspaceInTmp(ROUTES_WORKSPACE);
    const vs = docs(generateMesh({ cwd: tmpDir }), 'VirtualService').find(d => d.metadata.name === 'api')!;
    expect(vs.spec.http.map((h: Node) => h.name)).toEqual(['GET /orders', 'POST /orders', 'ANY /static/*', 'default']);
    expect(vs.spec.http[0].match).toEqual([{ uri: { prefix: '/orders' }, method: { exact: 'GET' } }]);
    expect(vs.spec.http[2].match).toEqual([{ uri: { prefix: '/static/*' } }]);
    expect(vs.spec.http[3].match).toBeUndefined();
  });

  it('--no-traffic-management keeps only the namespace and PeerAuthentication', async () => {
    tmpDir = await inTmp();
    const result = generateMesh({ cwd: tmpDir, trafficManagement: false });
    expect(result.manifests.map(m => m.kind)).toEqual(['Namespace', 'PeerAuthentication']);
    expect(result.trafficManagement).toBe(false);
  });

  it('every mesh resource (except the namespace) is labelled so uninstall cannot touch workloads', async () => {
    tmpDir = await inTmp();
    const result = generateMesh({ cwd: tmpDir });
    for (const m of result.manifests.filter(x => x.kind !== 'Namespace')) {
      expect((yaml.load(m.yaml) as Node).metadata.labels).toEqual({ 'app.kubernetes.io/managed-by': 're-shell' });
    }
  });

  it('writes <out>/istio/*.yaml and the README only with --out', async () => {
    tmpDir = await inTmp();
    const out = path.join(tmpDir, 'out');
    expect(generateMesh({ cwd: tmpDir, out, dryRun: true }).written).toEqual([]);
    expect(fs.existsSync(out)).toBe(false);
    const result = generateMesh({ cwd: tmpDir, out, namespace: 'apps' });
    expect(result.written.map(f => path.relative(out, f)).sort()).toEqual(
      [
        'istio/README.md',
        'istio/destinationrule-api.yaml',
        'istio/destinationrule-worker.yaml',
        'istio/namespace-apps.yaml',
        'istio/peerauthentication-default.yaml',
        'istio/virtualservice-api.yaml',
        'istio/virtualservice-worker.yaml',
      ].sort()
    );
  });
});

describe('k8s-mesh: Linkerd', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits the injected namespace and a ServiceProfile per service', async () => {
    tmpDir = await inTmp();
    const result = generateMesh({ mesh: 'linkerd', cwd: tmpDir, namespace: 'apps' });
    expect(result.manifests.map(m => `${m.kind}/${m.name}`)).toEqual([
      'Namespace/apps',
      'ServiceProfile/api.apps.svc.cluster.local',
      'ServiceProfile/worker.apps.svc.cluster.local',
    ]);
    const [ns] = docs(result, 'Namespace');
    expect(ns.metadata.annotations['linkerd.io/inject']).toBe('enabled');
    expect(ns.metadata.annotations['config.linkerd.io/default-inbound-policy']).toBe('all-authenticated');
  });

  it('--no-mtls relaxes the default inbound policy and warns that Linkerd mTLS stays on', async () => {
    tmpDir = await inTmp();
    const result = generateMesh({ mesh: 'linkerd', cwd: tmpDir, mtls: false });
    expect(docs(result, 'Namespace')[0].metadata.annotations['config.linkerd.io/default-inbound-policy']).toBe(
      'all-unauthenticated'
    );
    expect(result.warnings.join(' ')).toMatch(/Linkerd always uses mTLS/);
  });

  it('ServiceProfile routes come from the health path and declared routes, with a retry budget', async () => {
    tmpDir = await workspaceInTmp(ROUTES_WORKSPACE);
    const sp = docs(generateMesh({ mesh: 'linkerd', cwd: tmpDir, namespace: 'shop' }), 'ServiceProfile').find(
      d => d.metadata.name === 'api.shop.svc.cluster.local'
    )!;
    expect(sp.apiVersion).toBe('linkerd.io/v1alpha2');
    expect(sp.spec.routes).toEqual([
      { name: 'GET /healthz', condition: { method: 'GET', pathRegex: '/healthz' }, isRetryable: true, timeout: '5s' },
      { name: 'GET /orders', condition: { method: 'GET', pathRegex: '/orders(/.*)?' }, isRetryable: true, timeout: '15s' },
      { name: 'POST /orders', condition: { method: 'POST', pathRegex: '/orders(/.*)?' }, isRetryable: false, timeout: '15s' },
      { name: 'ANY /static/*', condition: { pathRegex: '/static(/.*)?' }, isRetryable: false, timeout: '15s' },
      { name: 'default', condition: { pathRegex: '/.*' }, isRetryable: false, timeout: '15s' },
    ]);
    expect(sp.spec.retryBudget).toEqual({ retryRatio: 0.2, minRetriesPerSecond: 10, ttl: '10s' });
  });

  it('escapes regex metacharacters in route paths', async () => {
    tmpDir = await workspaceInTmp(`name: x
version: 2.0.0
services:
  api:
    name: api
    language: go
    framework: gin
    port: 8080
    routes: [{ path: /v1.0/items, target: t, method: GET }]
`);
    const sp = docs(generateMesh({ mesh: 'linkerd', cwd: tmpDir }), 'ServiceProfile')[0];
    expect(sp.spec.routes[0].condition.pathRegex).toBe('/v1\\.0/items(/.*)?');
  });

  it('--no-traffic-management skips the ServiceProfiles', async () => {
    tmpDir = await inTmp();
    const result = generateMesh({ mesh: 'linkerd', cwd: tmpDir, trafficManagement: false });
    expect(result.manifests.map(m => m.kind)).toEqual(['Namespace']);
  });
});

describe('k8s-mesh: README documents injection and multi-cluster setup', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('Istio README', async () => {
    tmpDir = await inTmp();
    const readme = generateMesh({ mesh: 'istio', cwd: tmpDir, namespace: 'apps' }).docs[0];
    expect(readme.path).toBe('istio/README.md');
    for (const needle of [
      '## Sidecar injection',
      'istio-injection: enabled',
      'kubectl rollout restart deployment -n apps',
      '2/2',
      'istio.io/rev',
      'Istio CNI',
      '## Multi-cluster',
      'istioctl create-remote-secret',
      'topology.istio.io/network',
      'east-west gateway',
      'root CA',
      'STRICT',
      '## Uninstall',
    ]) {
      expect(readme.content, needle).toContain(needle);
    }
    // never advise deleting the directory that contains the Namespace manifest
    expect(readme.content).toMatch(/Do NOT `kubectl delete -f istio\/`/);
  });

  it('Linkerd README', async () => {
    tmpDir = await inTmp();
    const readme = generateMesh({ mesh: 'linkerd', cwd: tmpDir, namespace: 'apps' }).docs[0];
    expect(readme.path).toBe('linkerd/README.md');
    for (const needle of [
      '## Sidecar injection',
      'linkerd.io/inject: enabled',
      'kubectl rollout restart deployment -n apps',
      'linkerd-proxy',
      'linkerd install-cni',
      '## Multi-cluster',
      'multicluster link --cluster-name',
      'mirror.linkerd.io/exported=true',
      'trust anchor',
      'all-authenticated',
      '## Uninstall',
    ]) {
      expect(readme.content, needle).toContain(needle);
    }
    expect(readme.content).toMatch(/Do NOT `kubectl delete -f linkerd\/`/);
  });

  it('the README reflects --no-mtls', async () => {
    tmpDir = await inTmp();
    const istio = generateMesh({ mesh: 'istio', cwd: tmpDir, mtls: false }).docs[0].content;
    expect(istio).toContain('PERMISSIVE');
    const linkerd = generateMesh({ mesh: 'linkerd', cwd: tmpDir, mtls: false }).docs[0].content;
    expect(linkerd).toContain('all-unauthenticated');
  });
});

describe('k8s-mesh: service filter and errors', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('--services restricts generation and name:port overrides the workspace port', async () => {
    tmpDir = await inTmp();
    const result = generateMesh({ cwd: tmpDir, services: ['api:4000'] });
    expect(result.manifests.map(m => m.name)).toEqual(['default', 'default', 'api', 'api']);
    const vs = docs(result, 'VirtualService')[0];
    expect(vs.spec.http[0].route[0].destination.port.number).toBe(4000);
  });

  it('rejects unknown services, bad ports and unknown meshes', async () => {
    tmpDir = await inTmp();
    expect(() => generateMesh({ cwd: tmpDir, services: ['nope'] })).toThrow(/Unknown service "nope".*api, worker/);
    expect(() => generateMesh({ cwd: tmpDir, services: ['api:99999'] })).toThrow(/Invalid port/);
    expect(() => generateMesh({ cwd: tmpDir, mesh: 'consul' as 'istio' })).toThrow(/Unknown mesh/);
  });

  it('honours a custom cluster domain', async () => {
    tmpDir = await inTmp();
    const dr = docs(generateMesh({ cwd: tmpDir, clusterDomain: 'corp.internal' }), 'DestinationRule')[0];
    expect(dr.spec.host).toBe('api.default.svc.corp.internal');
  });

  it('throws when no workspace config is found', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mesh-empty-'));
    expect(() => generateMesh({ cwd: tmpDir })).toThrow(/No workspace v2 config/);
  });
});

describe.skipIf(!kubeconformCrdsReady)('k8s-mesh: kubeconform (CRD catalogue)', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  for (const mesh of ['istio', 'linkerd'] as const) {
    it(`${mesh} manifests validate against their CRD schemas`, async () => {
      tmpDir = await workspaceInTmp(ROUTES_WORKSPACE);
      const result = generateMesh({ mesh, cwd: tmpDir, namespace: 'shop' });
      const verdict = runKubeconform(result.manifests.map(m => m.yaml).join('---\n'), { crds: true });
      expect(verdict.output).toMatch(/Invalid: 0, Errors: 0/);
      expect(verdict.ok).toBe(true);
    });
  }
});

describe('k8s-mesh: command layer', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  const envelopeSchema = jsonResponseSchema(k8sMeshResponseSchema);

  it('--json emits an ok envelope matching the contract', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{ ok: boolean; data: { mesh: string; manifests: Node[]; docs: Node[]; written: string[] } }>(
      () => runK8sMesh({ json: true, cwd: tmpDir, mesh: 'linkerd', services: 'api', namespace: 'apps' })
    );
    expect(env.ok).toBe(true);
    expect(envelopeSchema.safeParse(env).success).toBe(true);
    expect(env.data.mesh).toBe('linkerd');
    expect(env.data.manifests.map(m => m.kind)).toEqual(['Namespace', 'ServiceProfile']);
    expect(env.data.docs[0].path).toBe('linkerd/README.md');
    expect(env.data.written).toEqual([]);
  });

  it('forwards --no-mtls / --no-traffic-management', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{ ok: boolean; data: { mtls: boolean; trafficManagement: boolean; manifests: Node[] } }>(
      () => runK8sMesh({ json: true, cwd: tmpDir, mtls: false, trafficManagement: false })
    );
    expect(env.data).toMatchObject({ mtls: false, trafficManagement: false });
    expect(env.data.manifests).toHaveLength(2);
  });

  it('an unknown mesh or service is K8S_MESH_ERROR with exit 1', async () => {
    tmpDir = await inTmp();
    for (const options of [{ mesh: 'consul' }, { services: 'ghost' }]) {
      process.exitCode = 0;
      const env = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
        runK8sMesh({ json: true, cwd: tmpDir, ...options })
      );
      expect(env.ok).toBe(false);
      expect(env.error.code).toBe('K8S_MESH_ERROR');
      expect(process.exitCode).toBe(1);
    }
  });

  it('writes with --out', async () => {
    tmpDir = await inTmp();
    const out = path.join(tmpDir, 'out');
    const env = await captureEnvelope<{ ok: boolean; data: { written: string[] } }>(() =>
      runK8sMesh({ json: true, cwd: tmpDir, out })
    );
    expect(env.data.written.length).toBeGreaterThan(5);
    expect(fs.existsSync(path.join(out, 'istio', 'README.md'))).toBe(true);
  });
});
