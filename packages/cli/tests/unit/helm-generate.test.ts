import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { generateChart, type ChartFile } from '../../src/utils/helm-generate';
import { generateManifests } from '../../src/utils/k8s-generate';
import { runHelmGenerate, lintWithHelm } from '../../src/commands/helm-generate';
import {
  hasBinary,
  kubeconformReady,
  runKubeconform,
  workspaceInTmp,
} from '../helpers/k8s-test-utils';
import { spawnSync } from 'child_process';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

/** Copy the k8s fixture into a throwaway tmp dir so tests never touch the repo. */
async function inTmp(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'helm-gen-'));
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

function fileByPath(files: ChartFile[], p: string): ChartFile | undefined {
  return files.find(f => f.path === p);
}

describe('helm-generate: generateChart', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits Chart.yaml, values.yaml, the templates (incl. pdb + networkpolicy) plus _helpers.tpl', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const paths = result.chart.files.map(f => f.path).sort();
    // P9-D2 added templates/pdb.yaml and templates/networkpolicy.yaml
    expect(paths).toEqual([
      'Chart.yaml',
      'templates/_helpers.tpl',
      'templates/deployment.yaml',
      'templates/hpa.yaml',
      'templates/ingress.yaml',
      'templates/networkpolicy.yaml',
      'templates/pdb.yaml',
      'templates/service.yaml',
      'values.yaml',
    ]);
  });

  it('Chart.yaml parses with apiVersion v2 and a name', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const chartFile = fileByPath(result.chart.files, 'Chart.yaml');
    expect(chartFile).toBeDefined();
    const doc = yaml.load((chartFile as ChartFile).content) as Record<string, unknown>;
    expect(doc.apiVersion).toBe('v2');
    expect(typeof doc.name).toBe('string');
    expect((doc.name as string).length).toBeGreaterThan(0);
    expect(doc.version).toBeDefined();
  });

  it('values.yaml parses and carries per-service image/replicas/resources/ingress', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const valuesFile = fileByPath(result.chart.files, 'values.yaml');
    expect(valuesFile).toBeDefined();
    const doc = yaml.load((valuesFile as ChartFile).content) as Record<string, unknown>;
    const services = doc.services as Record<string, Record<string, unknown>>;
    expect(services.api).toBeDefined();
    expect(services.worker).toBeDefined();
    const api = services.api;
    expect((api.image as Record<string, unknown>).repository).toBe('api');
    expect(api.replicas).toBeDefined();
    expect(api.resources).toBeDefined();
    expect((api.ingress as Record<string, unknown>).enabled).toBe(true);
    // Global ingress TLS toggle present for cert-manager wiring.
    const ingress = doc.ingress as Record<string, unknown>;
    expect((ingress.tls as Record<string, unknown>).enabled).toBe(true);
  });

  it('deployment template contains the range directive and Deployment kind', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const tpl = fileByPath(result.chart.files, 'templates/deployment.yaml');
    expect(tpl).toBeDefined();
    const content = (tpl as ChartFile).content;
    expect(content).toContain('kind: Deployment');
    expect(content).toContain('{{- range $name, $svc := .Values.services }}');
    expect(content).toContain('{{ $svc.image.repository }}');
  });

  it('service template contains the Service kind and range directive', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const tpl = fileByPath(result.chart.files, 'templates/service.yaml');
    expect((tpl as ChartFile).content).toContain('kind: Service');
    expect((tpl as ChartFile).content).toContain('range $name, $svc');
  });

  it('hpa template contains the HorizontalPodAutoscaler kind and autoscaling guard', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const tpl = fileByPath(result.chart.files, 'templates/hpa.yaml');
    const content = (tpl as ChartFile).content;
    expect(content).toContain('kind: HorizontalPodAutoscaler');
    expect(content).toContain('autoscaling/v2');
    expect(content).toContain('if $svc.autoscaling.enabled');
  });

  it('ingress template contains TLS + cert-manager annotation directives', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const tpl = fileByPath(result.chart.files, 'templates/ingress.yaml');
    const content = (tpl as ChartFile).content;
    expect(content).toContain('kind: Ingress');
    expect(content).toContain('tls:');
    expect(content).toContain('secretName:');
    expect(content).toContain('cert-manager');
  });

  it('dry-run writes nothing even when out is provided', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'chart-out');
    const result = generateChart({ cwd: tmpDir, out: outDir, dryRun: true });
    expect(result.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--out (non-dry-run) writes one file per chart file', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'chart-out');
    const result = generateChart({ cwd: tmpDir, out: outDir });
    expect(result.written).toHaveLength(result.chart.files.length);
    for (const file of result.written) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('throws when no workspace config is found', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'helm-empty-'));
    expect(() => generateChart({ cwd: tmpDir })).toThrow(/No workspace v2 config/);
  });
});

describe('helm-generate: command layer (envelopes + exit codes)', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('--json emits ok envelope with the chart files and a helm-lint outcome', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{
      ok: boolean;
      data: {
        chart: { name: string; files: ChartFile[] };
        written: string[];
        helm: { ran: boolean; ok?: boolean };
      };
    }>(() => runHelmGenerate({ json: true, cwd: tmpDir }));

    expect(env.ok).toBe(true);
    expect(env.data.chart.files.length).toBe(9);
    // Chart.yaml + values.yaml must parse.
    const chartYaml = env.data.chart.files.find(f => f.path === 'Chart.yaml');
    const valuesYaml = env.data.chart.files.find(f => f.path === 'values.yaml');
    expect(yaml.load((chartYaml as ChartFile).content)).toBeDefined();
    expect(yaml.load((valuesYaml as ChartFile).content)).toBeDefined();
    // helm-lint outcome is reported (ran true/false depending on environment).
    expect(typeof env.data.helm.ran).toBe('boolean');
    expect(process.exitCode).toBe(0);
  });

  it('--json --dry-run writes nothing and reports empty written list', async () => {
    tmpDir = await inTmp();
    const outDir = path.join(tmpDir, 'out');
    const env = await captureEnvelope<{ ok: boolean; data: { written: string[] } }>(() =>
      runHelmGenerate({ json: true, dryRun: true, out: outDir, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(env.data.written).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('--json on a config-less dir emits HELM_GENERATE_ERROR and exit 1', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'helm-empty-'));
    const env = await captureEnvelope<{
      ok: boolean;
      error: { code: string; message: string };
    }>(() => runHelmGenerate({ json: true, cwd: tmpDir }));
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('HELM_GENERATE_ERROR');
    expect(process.exitCode).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// P9-D2: every hardening/rollback setting is a chart value
// ---------------------------------------------------------------------------

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function chartValues(files: ChartFile[]): Doc {
  return yaml.load((fileByPath(files, 'values.yaml') as ChartFile).content) as Doc;
}

describe('helm-generate: values carry the security/resilience/rollback settings', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('values.yaml exposes securityContexts, probes, strategy, history, PDB, HPA and NetworkPolicy per service', async () => {
    tmpDir = await inTmp();
    const api = chartValues(generateChart({ cwd: tmpDir }).chart.files).services.api;
    expect(api.podSecurityContext).toEqual({
      runAsNonRoot: true,
      runAsUser: 10001,
      runAsGroup: 10001,
      fsGroup: 10001,
      seccompProfile: { type: 'RuntimeDefault' },
    });
    expect(api.securityContext).toMatchObject({
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      capabilities: { drop: ['ALL'] },
      seccompProfile: { type: 'RuntimeDefault' },
    });
    expect(api.writablePaths).toEqual(['/tmp']);
    expect(api.resources.requests).toEqual({ cpu: '100m', memory: '128Mi' });
    expect(api.livenessProbe.tcpSocket).toEqual({ port: 'http' });
    expect(api.readinessProbe.tcpSocket).toEqual({ port: 'http' });
    expect(api.strategy).toEqual({ type: 'RollingUpdate', rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } });
    expect(api.revisionHistoryLimit).toBe(10);
    expect(api.progressDeadlineSeconds).toBe(600);
    expect(api.pdb).toEqual({ enabled: true, minAvailable: 1 });
    expect(api.autoscaling).toMatchObject({
      enabled: true,
      minReplicas: 2,
      maxReplicas: 10,
      targetCPUUtilizationPercentage: 70,
      customMetric: { enabled: true, name: 'http_requests_per_second', averageValue: '1k' },
    });
    expect(api.networkPolicy).toEqual({ enabled: true, allowFromNamespaces: ['ingress-nginx'] });
  });

  it('workspace/service configuration flows into values', async () => {
    tmpDir = await workspaceInTmp(`name: cfg
version: 2.0.0
services:
  api:
    name: api
    language: go
    framework: gin
    port: 8080
    healthCheck: { path: /ready }
    kubernetes:
      replicas: 4
      revisionHistoryLimit: 2
      securityContext: { runAsUser: 4242, writablePaths: [/tmp, /data] }
      pdb: { maxUnavailable: 1 }
      strategy: { type: Recreate }
`);
    const api = chartValues(generateChart({ cwd: tmpDir }).chart.files).services.api;
    expect(api.replicas).toBe(4);
    expect(api.revisionHistoryLimit).toBe(2);
    expect(api.podSecurityContext.runAsUser).toBe(4242);
    expect(api.writablePaths).toEqual(['/tmp', '/data']);
    expect(api.pdb).toEqual({ enabled: true, maxUnavailable: 1 });
    expect(api.strategy).toEqual({ type: 'Recreate' });
    expect(api.livenessProbe.httpGet).toEqual({ path: '/ready', port: 'http' });
  });

  it('templates: pdb + networkpolicy kinds, securityContext/probe directives in the deployment', async () => {
    tmpDir = await inTmp();
    const files = generateChart({ cwd: tmpDir }).chart.files;
    const content = (p: string) => (fileByPath(files, p) as ChartFile).content;
    expect(content('templates/pdb.yaml')).toContain('kind: PodDisruptionBudget');
    expect(content('templates/pdb.yaml')).toContain('policy/v1');
    expect(content('templates/networkpolicy.yaml')).toContain('kind: NetworkPolicy');
    const deployment = content('templates/deployment.yaml');
    for (const directive of [
      'revisionHistoryLimit',
      'strategy:',
      '$svc.podSecurityContext',
      '$svc.securityContext',
      '$svc.livenessProbe',
      '$svc.readinessProbe',
      'emptyDir: {}',
    ]) {
      expect(deployment).toContain(directive);
    }
  });

  it('surfaces warnings in the JSON envelope', async () => {
    tmpDir = await workspaceInTmp(`name: warn
version: 2.0.0
deployment: { strategy: blue-green }
services:
  api: { name: api, language: go, framework: gin, port: 8080 }
`);
    process.exitCode = 0;
    const env = await captureEnvelope<{ ok: boolean; warnings: string[] }>(() =>
      runHelmGenerate({ json: true, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(env.warnings.join(' ')).toMatch(/blue-green/);
  });
});

/** Run helm; returns stdout (throws with stderr on a non-zero exit). */
function helm(args: string[]): string {
  const r = spawnSync('helm', args, { encoding: 'utf8', timeout: 120000 });
  if (r.error || r.status !== 0) {
    throw new Error(`helm ${args.join(' ')} failed: ${r.stderr || r.error?.message}`);
  }
  return r.stdout;
}

describe.skipIf(!hasBinary('helm', 'version'))('helm-generate: real helm', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  async function writeChart(): Promise<{ chartDir: string }> {
    tmpDir = await inTmp();
    const out = path.join(tmpDir, 'chart-out');
    const result = generateChart({ cwd: tmpDir, out });
    return { chartDir: path.join(out, result.chart.name) };
  }

  it('helm lint --strict passes', async () => {
    const { chartDir } = await writeChart();
    const lint = spawnSync('helm', ['lint', '--strict', chartDir], { encoding: 'utf8' });
    expect(lint.stderr + lint.stdout).toMatch(/0 chart\(s\) failed/);
    expect(lint.status).toBe(0);
  });

  it('lintWithHelm reports ran:true, ok:true for the generated chart', async () => {
    tmpDir = await inTmp();
    const lint = lintWithHelm(generateChart({ cwd: tmpDir }));
    expect(lint).toMatchObject({ ran: true, ok: true });
  });

  it('helm template renders hardened Deployments, a PDB and a NetworkPolicy per service', async () => {
    const { chartDir } = await writeChart();
    const docs = (yaml.loadAll(helm(['template', 'rel', chartDir, '-n', 'apps'])) as Doc[]).filter(Boolean);
    const byKind = (kind: string) => docs.filter(d => d.kind === kind);
    expect(byKind('Deployment')).toHaveLength(2);
    expect(byKind('PodDisruptionBudget')).toHaveLength(2);
    expect(byKind('NetworkPolicy')).toHaveLength(2);
    expect(byKind('HorizontalPodAutoscaler')).toHaveLength(2);
    const pod = byKind('Deployment').find(d => d.metadata.name === 'api')!.spec.template.spec;
    expect(pod.securityContext.runAsNonRoot).toBe(true);
    expect(pod.containers[0].securityContext).toMatchObject({
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      capabilities: { drop: ['ALL'] },
    });
    expect(pod.volumes).toEqual([{ name: 'tmp', emptyDir: {} }]);
  });

  it('chart output matches the raw manifests (pod spec, rollout, PDB, HPA, NetworkPolicy)', async () => {
    const { chartDir } = await writeChart();
    const chartDocs = (yaml.loadAll(helm(['template', 'rel', chartDir, '-n', 'apps'])) as Doc[]).filter(Boolean);
    const raw = generateManifests({ cwd: tmpDir, namespace: 'apps' });
    const rawDoc = (kind: string, name: string): Doc =>
      yaml.load(raw.manifests.find(m => m.kind === kind && m.name === name)!.yaml) as Doc;
    const chartDoc = (kind: string, name: string): Doc =>
      chartDocs.find(d => d.kind === kind && d.metadata.name === name)!;

    for (const svc of ['api', 'worker']) {
      const r = rawDoc('Deployment', svc).spec;
      const c = chartDoc('Deployment', svc).spec;
      expect(c.template.spec).toEqual(r.template.spec);
      for (const key of ['replicas', 'strategy', 'revisionHistoryLimit', 'progressDeadlineSeconds', 'minReadySeconds', 'selector']) {
        expect(c[key], `${svc} ${key}`).toEqual(r[key]);
      }
      expect(chartDoc('PodDisruptionBudget', svc).spec).toEqual(rawDoc('PodDisruptionBudget', svc).spec);
      expect(chartDoc('HorizontalPodAutoscaler', svc).spec).toEqual(rawDoc('HorizontalPodAutoscaler', svc).spec);
      expect(chartDoc('NetworkPolicy', `${svc}-default-deny-allow-intra`).spec).toEqual(
        rawDoc('NetworkPolicy', `${svc}-default-deny-allow-intra`).spec
      );
      expect(chartDoc('Service', svc).spec).toEqual(rawDoc('Service', svc).spec);
    }
  });

  it('values can be overridden at install time (--set / -f)', async () => {
    const { chartDir } = await writeChart();
    const docs = (
      yaml.loadAll(
        helm([
          'template', 'rel', chartDir, '-n', 'apps',
          '--set', 'services.api.securityContext.readOnlyRootFilesystem=false',
          '--set', 'services.api.revisionHistoryLimit=3',
          '--set', 'services.api.pdb.enabled=false',
          '--set', 'services.api.autoscaling.enabled=false',
          '--set', 'services.api.image.tag=v9',
        ])
      ) as Doc[]
    ).filter(Boolean);
    const dep = docs.find(d => d.kind === 'Deployment' && d.metadata.name === 'api')!;
    expect(dep.spec.template.spec.containers[0].securityContext.readOnlyRootFilesystem).toBe(false);
    expect(dep.spec.template.spec.containers[0].image).toBe('api:v9');
    expect(dep.spec.revisionHistoryLimit).toBe(3);
    expect(docs.some(d => d.kind === 'PodDisruptionBudget' && d.metadata.name === 'api')).toBe(false);
    expect(docs.some(d => d.kind === 'HorizontalPodAutoscaler' && d.metadata.name === 'api')).toBe(false);
    // worker is untouched
    expect(docs.some(d => d.kind === 'PodDisruptionBudget' && d.metadata.name === 'worker')).toBe(true);
  });

  it.skipIf(!kubeconformReady)('helm template output validates with kubeconform', async () => {
    const { chartDir } = await writeChart();
    const verdict = runKubeconform(helm(['template', 'rel', chartDir, '-n', 'apps']));
    expect(verdict.output).toMatch(/Invalid: 0, Errors: 0/);
    expect(verdict.ok).toBe(true);
  });
});
