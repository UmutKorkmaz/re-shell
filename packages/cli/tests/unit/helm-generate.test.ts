import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';

import { generateChart, type ChartFile } from '../../src/utils/helm-generate';
import { runHelmGenerate } from '../../src/commands/helm-generate';

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

  it('emits Chart.yaml, values.yaml, and the four templates plus _helpers.tpl', async () => {
    tmpDir = await inTmp();
    const result = generateChart({ cwd: tmpDir });
    const paths = result.chart.files.map(f => f.path).sort();
    expect(paths).toEqual([
      'Chart.yaml',
      'templates/_helpers.tpl',
      'templates/deployment.yaml',
      'templates/hpa.yaml',
      'templates/ingress.yaml',
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
    expect(env.data.chart.files.length).toBe(7);
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
