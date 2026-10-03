import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  jsonResponseSchema,
  k8sCrdResponseSchema,
  k8sMeshResponseSchema,
  k8sOperatorResponseSchema,
  k8sRollbackResponseSchema,
} from '@re-shell/contracts';

/**
 * Integration conformance for the workspace-driven Kubernetes commands
 * (`k8s generate|crd|mesh|operator|rollback`), driving the BUILT CLI against the
 * k8s fixture workspace. Offline and deterministic: nothing here talks to a
 * cluster (the live behaviour is covered by scripts/k8s-live-check.sh).
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'k8s-workspace');
const MAX_BUFFER = 16 * 1024 * 1024;

function runCli(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {}
): { stdout: string; status: number } {
  const outFile = path.join(
    os.tmpdir(),
    `rs-k8s-${process.pid}-${Math.random().toString(36).slice(2)}.out`
  );
  const fd = fs.openSync(outFile, 'w');
  let status = 0;
  try {
    execFileSync('node', [CLI_PATH, ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', fd, 'ignore'],
      env: { ...process.env, ...env },
    });
  } catch (error: unknown) {
    const e = error as { status?: number };
    status = typeof e.status === 'number' ? e.status : 1;
  } finally {
    fs.closeSync(fd);
  }
  const stdout = fs.readFileSync(outFile, 'utf8');
  fs.rmSync(outFile, { force: true });
  return { stdout, status };
}

function parseSingleLine(stdout: string): Record<string, unknown> {
  const lines = stdout.split('\n').filter(l => l.length > 0);
  expect(lines.length, `expected one JSON line, got: ${stdout}`).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

describe('k8s commands (built CLI)', () => {
  it('k8s generate --json: 10 hardened manifests for the fixture workspace', () => {
    const { stdout, status } = runCli(['k8s', 'generate', '--json', '--dry-run'], FIXTURE);
    expect(status).toBe(0);
    const env = parseSingleLine(stdout) as {
      ok: boolean;
      data: { manifests: Array<{ kind: string; yaml: string }> };
    };
    expect(env.ok).toBe(true);
    expect(env.data.manifests).toHaveLength(10);
    const deployment = env.data.manifests.find(m => m.kind === 'Deployment')!;
    expect(deployment.yaml).toContain('readOnlyRootFilesystem: true');
    expect(deployment.yaml).toContain('revisionHistoryLimit: 10');
  });

  it('k8s crd --json: derived CRD + sample, envelope matches the contract', () => {
    const { stdout, status } = runCli(['k8s', 'crd', '--json'], FIXTURE);
    expect(status).toBe(0);
    const env = parseSingleLine(stdout);
    expect(jsonResponseSchema(k8sCrdResponseSchema).safeParse(env).success).toBe(true);
    const data = (env as { data: { crd: { name: string }; manifests: Array<{ kind: string }> } }).data;
    expect(data.crd.name).toBe('reshellworkspaces.re-shell.io');
    expect(data.manifests.map(m => m.kind)).toEqual(['CustomResourceDefinition', 'ReShellWorkspace']);
  });

  it('k8s mesh --json: Istio and Linkerd, envelopes match the contract', () => {
    for (const mesh of ['istio', 'linkerd']) {
      const { stdout, status } = runCli(['k8s', 'mesh', '--mesh', mesh, '--namespace', 'apps', '--json'], FIXTURE);
      expect(status, mesh).toBe(0);
      const env = parseSingleLine(stdout);
      expect(jsonResponseSchema(k8sMeshResponseSchema).safeParse(env).success, mesh).toBe(true);
      expect((env as { data: { mesh: string } }).data.mesh).toBe(mesh);
    }
  });

  it('k8s mesh keeps the legacy --no-mtls / --no-traffic-management flags', () => {
    const { stdout, status } = runCli(
      ['k8s', 'mesh', '--no-mtls', '--no-traffic-management', '--services', 'api:3000', '--json'],
      FIXTURE
    );
    expect(status).toBe(0);
    const data = (parseSingleLine(stdout) as { data: { mtls: boolean; trafficManagement: boolean } }).data;
    expect(data).toMatchObject({ mtls: false, trafficManagement: false });
  });

  it('k8s operator --json --dry-run: scaffold listing, envelope matches the contract', () => {
    const { stdout, status } = runCli(['k8s', 'operator', '--dry-run', '--json'], FIXTURE);
    expect(status).toBe(0);
    const env = parseSingleLine(stdout);
    expect(jsonResponseSchema(k8sOperatorResponseSchema).safeParse(env).success).toBe(true);
    const paths = (env as { data: { files: Array<{ path: string }> } }).data.files.map(f => f.path);
    expect(paths).toEqual(expect.arrayContaining(['go.mod', 'main.go', 'reconciler.go', 'config/rbac/role.yaml']));
  });

  it('workspace-driven commands fail with their own error code outside a workspace (exit 1)', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-k8s-empty-'));
    try {
      for (const [args, code] of [
        [['k8s', 'crd', '--json'], 'K8S_CRD_ERROR'],
        [['k8s', 'mesh', '--json'], 'K8S_MESH_ERROR'],
        [['k8s', 'operator', '--json'], 'K8S_OPERATOR_ERROR'],
      ] as const) {
        const { stdout, status } = runCli([...args], empty);
        expect(status, args.join(' ')).toBe(1);
        const env = parseSingleLine(stdout) as { ok: boolean; error: { code: string } };
        expect(env.ok).toBe(false);
        expect(env.error.code).toBe(code);
      }
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('k8s rollback without a reachable cluster exits non-zero with ok:false (never a fake success)', () => {
    const { stdout, status } = runCli(
      ['k8s', 'rollback', 'api', '--json', '--timeout', '5'],
      FIXTURE,
      { KUBECONFIG: path.join(os.tmpdir(), 'nonexistent-kubeconfig-for-test') }
    );
    expect(status).toBe(1);
    const env = parseSingleLine(stdout);
    expect(jsonResponseSchema(k8sRollbackResponseSchema).safeParse(env).success).toBe(true);
    const error = (env as { ok: boolean; error: { code: string; details: { reason: string } } });
    expect(error.ok).toBe(false);
    expect(error.error.code).toBe('K8S_ROLLBACK_ERROR');
    expect(['TOOL_MISSING', 'CLUSTER_UNREACHABLE', 'COMMAND_FAILED']).toContain(error.error.details.reason);
  });

  it('k8s rollback validates its arguments (INVALID_ARGUMENT, exit 1)', () => {
    const { stdout, status } = runCli(['k8s', 'rollback', 'api', '--to-revision', 'abc', '--json'], FIXTURE);
    expect(status).toBe(1);
    const env = parseSingleLine(stdout) as { error: { details: { reason: string } } };
    expect(env.error.details.reason).toBe('INVALID_ARGUMENT');
  });

  it('--legacy keeps the old name-only generator scripts for crd, mesh and operator', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-k8s-legacy-'));
    try {
      for (const [sub, dir] of [
        ['crd', 'crd'],
        ['mesh', 'mesh'],
        ['operator', 'operator'],
      ] as const) {
        const target = path.join(out, dir);
        const { status } = runCli(['k8s', sub, 'legacy-app', '--legacy', '-o', target], os.tmpdir());
        expect(status, sub).toBe(0);
        const files = fs.readdirSync(target);
        expect(files.length, `${sub}: ${files.join(',')}`).toBeGreaterThan(0);
        expect(files.some(f => f.endsWith('.ts') || f.endsWith('.md') || f.endsWith('.json'))).toBe(true);
      }
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('lists the rollback command in k8s --help', () => {
    const { stdout, status } = runCli(['k8s', '--help'], FIXTURE);
    expect(status).toBe(0);
    expect(stdout).toMatch(/rollback/);
  });
});
