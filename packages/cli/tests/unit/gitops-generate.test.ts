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

  it('emits a Flux GitRepository + Kustomization + cert-manager TLS Ingress', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir });
    const kinds = result.manifests.map(m => m.kind).sort();
    expect(kinds).toEqual(['GitRepository', 'Ingress', 'Kustomization']);
  });

  it('Flux manifests yaml-parse with the toolkit apiVersions', async () => {
    tmpDir = await inTmp();
    const result = generateGitOps({ tool: 'flux', cwd: tmpDir });
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
