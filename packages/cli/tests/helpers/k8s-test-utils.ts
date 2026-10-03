// Shared helpers for the Kubernetes/Helm/GitOps generator tests.
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { vi } from 'vitest';

export const FIXTURES = path.join(__dirname, '..', 'fixtures');

/** Copy the k8s fixture into a throwaway tmp dir so tests never touch the repo. */
export async function inTmp(fixture = 'k8s-workspace'): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'k8s-test-'));
  await fs.copy(path.join(FIXTURES, fixture), tmpDir);
  return tmpDir;
}

/** Write a workspace v2 file into a fresh tmp dir. */
export async function workspaceInTmp(yamlText: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'k8s-test-'));
  await fs.writeFile(path.join(tmpDir, 're-shell.workspaces.yaml'), yamlText);
  return tmpDir;
}

/**
 * Capture exactly the single JSON envelope written to stdout while running an
 * async fn that calls ok()/fail() (which patch stdout internally).
 */
export async function captureEnvelope<T = unknown>(fn: () => Promise<void>): Promise<T> {
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

/** True when `binary` runs (`<binary> <versionArg>` exits 0). */
export function hasBinary(binary: string, versionArg = 'version'): boolean {
  const probe = spawnSync(binary, [versionArg], { encoding: 'utf8', timeout: 20000 });
  return !probe.error && probe.status === 0;
}

// ---------------------------------------------------------------------------
// kubeconform
// ---------------------------------------------------------------------------

/** Schema catalogue for CRDs (Argo CD, Flux, Istio, Linkerd, ...). */
export const CRD_SCHEMA_LOCATION =
  'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json';

const KUBECONFORM_CACHE = path.join(os.tmpdir(), 'reshell-kubeconform-cache');
/** Kubernetes version the manifests are validated against. */
export const KUBECONFORM_K8S_VERSION = '1.31.0';

export interface KubeconformResult {
  ok: boolean;
  output: string;
}

/**
 * Validate YAML documents with kubeconform (strict). Throws when kubeconform
 * cannot be started; callers gate on {@link kubeconformReady} first.
 */
export function runKubeconform(
  yamlText: string,
  options: { crds?: boolean } = {}
): KubeconformResult {
  fs.mkdirpSync(KUBECONFORM_CACHE);
  const args = [
    '-strict',
    '-summary',
    '-kubernetes-version',
    KUBECONFORM_K8S_VERSION,
    '-cache',
    KUBECONFORM_CACHE,
    '-schema-location',
    'default',
  ];
  if (options.crds) args.push('-schema-location', CRD_SCHEMA_LOCATION);
  args.push('-');
  const result = spawnSync('kubeconform', args, {
    input: yamlText,
    encoding: 'utf8',
    timeout: 120000,
  });
  if (result.error) throw result.error;
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

const PROBE_MANIFEST = `apiVersion: v1
kind: ConfigMap
metadata:
  name: probe
data:
  k: v
`;

/**
 * Whether kubeconform is installed AND can resolve schemas (it downloads them
 * from GitHub on first use). Evaluated once at module load; a missing binary or
 * an offline machine skips the kubeconform tests instead of failing them. CI
 * installs kubeconform and has network access, so there they always run.
 */
export const kubeconformReady: boolean = (() => {
  if (!hasBinary('kubeconform', '-v')) return false;
  try {
    return runKubeconform(PROBE_MANIFEST).ok;
  } catch {
    return false;
  }
})();

/** Whether the CRD schema catalogue is reachable through kubeconform. */
export const kubeconformCrdsReady: boolean = (() => {
  if (!kubeconformReady) return false;
  try {
    return runKubeconform(
      `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: probe
  namespace: argocd
spec:
  project: default
  source: { repoURL: "https://example.com/r.git", path: ".", targetRevision: main }
  destination: { server: "https://kubernetes.default.svc", namespace: default }
`,
      { crds: true }
    ).ok;
  } catch {
    return false;
  }
})();
