import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { jsonResponseSchema, k8sOperatorResponseSchema } from '@re-shell/contracts';

import {
  generateOperator,
  verifyOperatorBuild,
  OPERATOR_NAMESPACE,
} from '../../src/utils/k8s-operator';
import { OPERATOR_DEPENDENCIES } from '../../src/utils/k8s-operator-templates';
import { runK8sOperator } from '../../src/commands/k8s-operator';
import { buildCrd } from '../../src/utils/k8s-crd';
import { captureEnvelope, hasBinary, inTmp } from '../helpers/k8s-test-utils';

type Node = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function file(result: { files: Array<{ path: string; content: string }> }, p: string): string {
  const found = result.files.find(f => f.path === p);
  expect(found, p).toBeDefined();
  return (found as { content: string }).content;
}

describe('k8s-operator: scaffold contents', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('emits a complete controller-runtime project', async () => {
    tmpDir = await inTmp();
    const result = generateOperator({ cwd: tmpDir });
    expect(result.files.map(f => f.path).sort()).toEqual(
      [
        '.gitignore',
        'Dockerfile',
        'Makefile',
        'README.md',
        'builders.go',
        'config/crd/reshellworkspaces.re-shell.io.yaml',
        'config/manager/manager.yaml',
        'config/manager/namespace.yaml',
        'config/rbac/role.yaml',
        'config/rbac/role_binding.yaml',
        'config/rbac/service_account.yaml',
        'config/samples/k8s-demo.yaml',
        'constants.go',
        'go.mod',
        'main.go',
        'reconciler.go',
        'types.go',
      ].sort()
    );
    expect(result.module).toBe('re-shell.io/operator');
  });

  it('go.mod pins controller-runtime and the Kubernetes libraries', async () => {
    tmpDir = await inTmp();
    const goMod = file(generateOperator({ cwd: tmpDir, module: 'example.com/acme/op' }), 'go.mod');
    expect(goMod).toContain('module example.com/acme/op');
    expect(goMod).toContain(`sigs.k8s.io/controller-runtime ${OPERATOR_DEPENDENCIES.controllerRuntime}`);
    expect(goMod).toContain(`k8s.io/api ${OPERATOR_DEPENDENCIES.k8s}`);
    expect(goMod).toContain(`go ${OPERATOR_DEPENDENCIES.go}`);
  });

  it('constants.go carries the CRD identity (configurable group/version)', async () => {
    tmpDir = await inTmp();
    const constants = file(generateOperator({ cwd: tmpDir, group: 'example.com', version: 'v1beta1' }), 'constants.go');
    expect(constants).toContain('Group   = "example.com"');
    expect(constants).toContain('Version = "v1beta1"');
    expect(constants).toContain('Kind    = "ReShellWorkspace"');
    expect(constants).toContain('Plural  = "reshellworkspaces"');
  });

  it('Go sources are complete: no placeholder characters, struct tags use backticks', async () => {
    tmpDir = await inTmp();
    const result = generateOperator({ cwd: tmpDir });
    for (const name of ['types.go', 'builders.go', 'reconciler.go', 'main.go']) {
      const src = file(result, name);
      expect(src, name).not.toContain('§');
      expect(src, name).toMatch(/^package main$/m);
    }
    expect(file(result, 'types.go')).toContain('`json:"services"`');
  });

  it('the controller reconciles Deployments, Services and PodDisruptionBudgets for each service', async () => {
    tmpDir = await inTmp();
    const result = generateOperator({ cwd: tmpDir });
    const reconciler = file(result, 'reconciler.go');
    for (const needle of [
      'func (r *WorkspaceReconciler) Reconcile',
      'Owns(&appsv1.Deployment{})',
      'Owns(&corev1.Service{})',
      'Owns(&policyv1.PodDisruptionBudget{})',
      'client.Apply',
      'buildDeployment(',
      'buildService(',
      'buildPDB(',
      'r.prune(',
      'r.Status().Update',
    ]) {
      expect(reconciler).toContain(needle);
    }
    const builders = file(result, 'builders.go');
    for (const needle of [
      'RunAsNonRoot',
      'ReadOnlyRootFilesystem',
      'AllowPrivilegeEscalation',
      'Drop: ',
      'SeccompProfileTypeRuntimeDefault',
      'RevisionHistoryLimit',
      'RollingUpdateDeploymentStrategyType',
      'EmptyDirVolumeSource',
      'HTTPGetAction',
      'TCPSocketAction',
    ]) {
      expect(builders).toContain(needle);
    }
  });

  it('the CRD in config/crd is the same derived CRD the `k8s crd` command emits', async () => {
    tmpDir = await inTmp();
    const result = generateOperator({ cwd: tmpDir });
    expect(yaml.load(file(result, 'config/crd/reshellworkspaces.re-shell.io.yaml'))).toEqual(
      JSON.parse(JSON.stringify(buildCrd().crd))
    );
  });

  it('RBAC grants what the reconciler needs (and the CRD group follows --group)', async () => {
    tmpDir = await inTmp();
    const role = yaml.load(file(generateOperator({ cwd: tmpDir, group: 'example.com' }), 'config/rbac/role.yaml')) as Node;
    expect(role.kind).toBe('ClusterRole');
    const rule = (group: string, resource: string): Node =>
      role.rules.find((r: Node) => r.apiGroups.includes(group) && r.resources.includes(resource));
    expect(rule('example.com', 'reshellworkspaces').verbs).toEqual(['get', 'list', 'watch']);
    expect(rule('example.com', 'reshellworkspaces/status').verbs).toEqual(['get', 'update', 'patch']);
    for (const [group, resource] of [
      ['apps', 'deployments'],
      ['', 'services'],
      ['policy', 'poddisruptionbudgets'],
    ]) {
      expect(rule(group, resource).verbs).toEqual(
        expect.arrayContaining(['get', 'list', 'watch', 'create', 'patch', 'delete'])
      );
    }
    expect(rule('coordination.k8s.io', 'leases')).toBeDefined();
  });

  it('the manager Deployment is itself hardened and wired to its ServiceAccount', async () => {
    tmpDir = await inTmp();
    const result = generateOperator({ cwd: tmpDir, image: 'ghcr.io/acme/op:1.0' });
    const dep = yaml.load(file(result, 'config/manager/manager.yaml')) as Node;
    expect(dep.metadata.namespace).toBe(OPERATOR_NAMESPACE);
    const pod = dep.spec.template.spec;
    expect(pod.serviceAccountName).toBe('reshell-operator');
    expect(pod.securityContext).toMatchObject({ runAsNonRoot: true, seccompProfile: { type: 'RuntimeDefault' } });
    const c = pod.containers[0];
    expect(c.image).toBe('ghcr.io/acme/op:1.0');
    expect(c.securityContext).toEqual({
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      capabilities: { drop: ['ALL'] },
    });
    expect(c.args).toContain('--leader-elect');
    const binding = yaml.load(file(result, 'config/rbac/role_binding.yaml')) as Node;
    expect(binding.subjects[0]).toEqual({ kind: 'ServiceAccount', name: 'reshell-operator', namespace: OPERATOR_NAMESPACE });
    const ns = yaml.load(file(result, 'config/manager/namespace.yaml')) as Node;
    expect(ns.metadata.labels['pod-security.kubernetes.io/enforce']).toBe('restricted');
  });

  it('every YAML file parses and the sample CR is the workspace', async () => {
    tmpDir = await inTmp();
    const result = generateOperator({ cwd: tmpDir, namespace: 'apps' });
    for (const f of result.files.filter(x => x.path.endsWith('.yaml'))) {
      expect(() => yaml.load(f.content), f.path).not.toThrow();
    }
    const sample = yaml.load(file(result, 'config/samples/k8s-demo.yaml')) as Node;
    expect(sample.kind).toBe('ReShellWorkspace');
    expect(sample.metadata.namespace).toBe('apps');
    expect(sample.spec.services.api.port).toBe(3000);
  });

  it('README documents build, install and the status contract', async () => {
    tmpDir = await inTmp();
    const readme = file(generateOperator({ cwd: tmpDir }), 'README.md');
    for (const needle of ['go mod tidy', 'make install', 'make deploy', 'status.phase', 'restricted']) {
      expect(readme).toContain(needle);
    }
  });

  it('writes files only with --out and not in dry-run', async () => {
    tmpDir = await inTmp();
    const out = path.join(tmpDir, 'op');
    expect(generateOperator({ cwd: tmpDir, out, dryRun: true }).written).toEqual([]);
    expect(fs.existsSync(out)).toBe(false);
    const result = generateOperator({ cwd: tmpDir, out });
    expect(result.written).toHaveLength(result.files.length);
    expect(fs.existsSync(path.join(out, 'main.go'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'config', 'rbac', 'role.yaml'))).toBe(true);
  });

  it('throws when no workspace config is found', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'op-empty-'));
    expect(() => generateOperator({ cwd: tmpDir })).toThrow(/No workspace v2 config/);
  });
});

// ---------------------------------------------------------------------------
// The scaffold must really build. `go mod tidy` downloads modules, so a machine
// without Go (or without network access to the Go module proxy) skips this
// instead of failing; CI has both.
// ---------------------------------------------------------------------------

const NETWORK_FAILURE = /dial tcp|lookup |connection refused|i\/o timeout|proxyconnect|TLS handshake|Forbidden|403|no such host|network is unreachable/i;

describe.skipIf(!hasBinary('go', 'version'))('k8s-operator: go build', () => {
  let tmpDir: string;
  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('the generated operator passes go mod tidy, go build and go vet', async ctx => {
    tmpDir = await inTmp();
    const out = path.join(tmpDir, 'op');
    generateOperator({ cwd: tmpDir, out });
    const build = verifyOperatorBuild(out, 15 * 60 * 1000);
    if (build.ran && !build.ok && NETWORK_FAILURE.test(build.detail ?? '')) {
      console.warn(`skipping go build test: Go module proxy unreachable (${build.detail})`);
      ctx.skip();
      return;
    }
    expect(build.ran).toBe(true);
    expect(build.detail, build.detail).toBeDefined();
    expect(build.ok, build.detail).toBe(true);
    // gofmt-clean output
    const fmt = (await import('child_process')).spawnSync('gofmt', ['-l', '.'], { cwd: out, encoding: 'utf8' });
    if (!fmt.error) expect(fmt.stdout.trim()).toBe('');
  }, 20 * 60 * 1000);
});

describe('k8s-operator: verifyOperatorBuild', () => {
  it('reports a Go build failure instead of succeeding (broken source)', async () => {
    if (!hasBinary('go', 'version')) return; // covered above when Go is present
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'op-broken-'));
    try {
      await fs.writeFile(path.join(dir, 'go.mod'), 'module broken.example/op\n\ngo 1.22\n');
      await fs.writeFile(path.join(dir, 'main.go'), 'package main\n\nfunc main() { undefinedSymbol() }\n');
      const result = verifyOperatorBuild(dir, 120000);
      expect(result.ran).toBe(true);
      expect(result.ok).toBe(false);
      expect(result.detail).toMatch(/undefined: undefinedSymbol/);
    } finally {
      await fs.remove(dir);
    }
  });
});

describe('k8s-operator: command layer', () => {
  let tmpDir: string;
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(async () => {
    process.exitCode = 0;
    if (tmpDir) await fs.remove(tmpDir);
  });

  const envelopeSchema = jsonResponseSchema(k8sOperatorResponseSchema);

  it('--json emits an ok envelope matching the contract (file sizes, no content)', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{ ok: boolean; data: { module: string; files: Node[]; build: Node; written: string[] } }>(
      () => runK8sOperator({ json: true, cwd: tmpDir })
    );
    expect(env.ok).toBe(true);
    expect(envelopeSchema.safeParse(env).success).toBe(true);
    expect(env.data.module).toBe('re-shell.io/operator');
    expect(env.data.files.find(f => f.path === 'reconciler.go')!.bytes).toBeGreaterThan(1000);
    expect(env.data.files.every(f => !('content' in f))).toBe(true);
    expect(env.data.build.ran).toBe(false); // --verify not requested
    expect(env.data.written).toEqual([]);
  });

  it('--verify without --out fails explicitly (nothing to build)', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{ ok: boolean; error: { code: string; message: string } }>(() =>
      runK8sOperator({ json: true, cwd: tmpDir, verify: true })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('K8S_OPERATOR_ERROR');
    expect(env.error.message).toMatch(/--verify/);
    expect(process.exitCode).toBe(1);
  });

  it('--verify with --dry-run fails explicitly', async () => {
    tmpDir = await inTmp();
    const env = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
      runK8sOperator({ json: true, cwd: tmpDir, verify: true, out: path.join(tmpDir, 'o'), dryRun: true })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('K8S_OPERATOR_ERROR');
  });

  it('--json on a config-less dir emits K8S_OPERATOR_ERROR and exit 1', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'op-empty-'));
    const env = await captureEnvelope<{ ok: boolean; error: { code: string } }>(() =>
      runK8sOperator({ json: true, cwd: tmpDir })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('K8S_OPERATOR_ERROR');
    expect(process.exitCode).toBe(1);
  });
});
