import { describe, it, expect } from 'vitest';
import {
  errorCodeSchema,
  jsonResponseSchema,
  k8sCrdResponseSchema,
  k8sMeshResponseSchema,
  k8sOperatorResponseSchema,
  k8sRollbackFailureReasonSchema,
  k8sRollbackResponseSchema,
} from './index.js';

/**
 * Wire contracts for the P9-D Kubernetes commands: `k8s rollback`, `k8s crd`,
 * `k8s mesh` and `k8s operator`. The CLI validates its real output against
 * these schemas (tests/integration/k8s-cli.test.ts), so they must accept every
 * legitimate payload and reject malformed ones.
 */

const crd = {
  name: 'reshellworkspaces.re-shell.io',
  group: 're-shell.io',
  version: 'v1alpha1',
  kind: 'ReShellWorkspace',
  plural: 'reshellworkspaces',
  singular: 'reshellworkspace',
  scope: 'Namespaced' as const,
};

describe('k8s error codes', () => {
  it('registers the P9-D error codes', () => {
    for (const code of ['K8S_ROLLBACK_ERROR', 'K8S_CRD_ERROR', 'K8S_MESH_ERROR', 'K8S_OPERATOR_ERROR']) {
      expect(errorCodeSchema.safeParse(code).success, code).toBe(true);
    }
    expect(errorCodeSchema.safeParse('K8S_NOT_A_CODE').success).toBe(false);
  });

  it('error envelopes carry the rollback reason under details', () => {
    const schema = jsonResponseSchema(k8sRollbackResponseSchema);
    const parsed = schema.safeParse({
      ok: false,
      error: {
        code: 'K8S_ROLLBACK_ERROR',
        message: 'no earlier revision',
        details: { reason: 'NO_PREVIOUS_REVISION', available: [1] },
      },
      warnings: [],
    });
    expect(parsed.success).toBe(true);
    expect(k8sRollbackFailureReasonSchema.options).toEqual([
      'INVALID_ARGUMENT',
      'TOOL_MISSING',
      'CLUSTER_UNREACHABLE',
      'NOT_FOUND',
      'NOT_HELM_MANAGED',
      'NO_PREVIOUS_REVISION',
      'REVISION_NOT_FOUND',
      'COMMAND_FAILED',
      'ROLLOUT_FAILED',
    ]);
  });
});

describe('k8sRollbackResponseSchema', () => {
  const base = {
    service: 'api',
    namespace: 'apps',
    method: 'kubectl' as const,
    dryRun: false,
    fromRevision: 3,
    toRevision: 2,
    currentRevision: 4,
    command: ['kubectl', 'rollout', 'undo', 'deployment/api', '-n', 'apps', '--to-revision=2'],
    rolledBack: true,
    output: 'deployment.apps/api rolled back',
    rolloutStatus: 'deployment "api" successfully rolled out',
  };

  it('accepts a kubectl rollback and a helm rollback', () => {
    expect(k8sRollbackResponseSchema.safeParse(base).success).toBe(true);
    expect(
      k8sRollbackResponseSchema.safeParse({ ...base, method: 'helm', release: 'shop' }).success
    ).toBe(true);
  });

  it('accepts a dry-run plan (no current revision, nothing rolled back)', () => {
    expect(
      k8sRollbackResponseSchema.safeParse({
        ...base,
        dryRun: true,
        rolledBack: false,
        currentRevision: null,
        rolloutStatus: undefined,
      }).success
    ).toBe(true);
  });

  it('rejects an unknown method and a missing target revision', () => {
    expect(k8sRollbackResponseSchema.safeParse({ ...base, method: 'flux' }).success).toBe(false);
    const { toRevision: _toRevision, ...withoutTarget } = base;
    expect(k8sRollbackResponseSchema.safeParse(withoutTarget).success).toBe(false);
  });
});

describe('k8sCrdResponseSchema', () => {
  const payload = {
    crd,
    manifests: [
      { kind: 'CustomResourceDefinition', name: crd.name, path: 'crd/x.yaml', yaml: 'a: 1\n' },
      { kind: 'ReShellWorkspace', name: 'demo', path: 'samples/demo.yaml', yaml: 'b: 2\n' },
    ],
    written: [],
    kubectl: { ran: false, detail: 'no cluster reachable' },
  };

  it('accepts a generated CRD payload (kubectl not run)', () => {
    expect(k8sCrdResponseSchema.safeParse(payload).success).toBe(true);
    expect(
      k8sCrdResponseSchema.safeParse({ ...payload, kubectl: { ran: true, ok: true, detail: 'created (server dry run)' } })
        .success
    ).toBe(true);
  });

  it('rejects a cluster-scoped value other than Namespaced/Cluster', () => {
    expect(
      k8sCrdResponseSchema.safeParse({ ...payload, crd: { ...crd, scope: 'Global' } }).success
    ).toBe(false);
  });
});

describe('k8sMeshResponseSchema', () => {
  const payload = {
    mesh: 'istio' as const,
    namespace: 'apps',
    mtls: true,
    trafficManagement: true,
    manifests: [{ kind: 'PeerAuthentication', name: 'default', path: 'istio/p.yaml', yaml: 'x: 1\n' }],
    docs: [{ path: 'istio/README.md', content: '# mesh\n' }],
    written: [],
  };

  it('accepts istio and linkerd payloads', () => {
    expect(k8sMeshResponseSchema.safeParse(payload).success).toBe(true);
    expect(k8sMeshResponseSchema.safeParse({ ...payload, mesh: 'linkerd' }).success).toBe(true);
  });

  it('rejects unknown meshes', () => {
    expect(k8sMeshResponseSchema.safeParse({ ...payload, mesh: 'consul' }).success).toBe(false);
  });
});

describe('k8sOperatorResponseSchema', () => {
  const payload = {
    module: 're-shell.io/operator',
    crd,
    files: [
      { path: 'go.mod', bytes: 167 },
      { path: 'main.go', bytes: 2136 },
    ],
    written: [],
    build: { ran: false, detail: 'not requested (use --verify)' },
  };

  it('accepts a scaffold listing with and without a verified build', () => {
    expect(k8sOperatorResponseSchema.safeParse(payload).success).toBe(true);
    expect(
      k8sOperatorResponseSchema.safeParse({ ...payload, build: { ran: true, ok: true, detail: 'go version go1.24' } })
        .success
    ).toBe(true);
  });

  it('rejects file entries without a byte size', () => {
    expect(
      k8sOperatorResponseSchema.safeParse({ ...payload, files: [{ path: 'go.mod' }] }).success
    ).toBe(false);
  });
});
