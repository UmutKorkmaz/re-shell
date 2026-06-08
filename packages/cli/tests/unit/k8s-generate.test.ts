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

  it('emits four manifests per service (Deployment, Service, HPA, NetworkPolicy)', async () => {
    tmpDir = await inTmp();
    const result = generateManifests({ cwd: tmpDir });
    // 2 services × 4 manifests = 8
    expect(result.manifests).toHaveLength(8);
    const kinds = result.manifests.map(m => m.kind).sort();
    expect(kinds).toEqual([
      'Deployment',
      'Deployment',
      'HorizontalPodAutoscaler',
      'HorizontalPodAutoscaler',
      'NetworkPolicy',
      'NetworkPolicy',
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
    expect(result.written).toHaveLength(8);
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
    expect(env.data.manifests).toHaveLength(8);
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
