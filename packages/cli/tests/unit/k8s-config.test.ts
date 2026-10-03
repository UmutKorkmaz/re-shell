import { describe, expect, it } from 'vitest';

import {
  deepMerge,
  loadWorkspace,
  resolveK8sWorkspace,
  volumeNameForPath,
} from '../../src/utils/k8s-config';
import type { WorkspaceConfig } from '../../src/parsers/workspace-parser';
import { inTmp, workspaceInTmp } from '../helpers/k8s-test-utils';

/** Build a minimal valid-shaped workspace config for resolver tests. */
function config(overrides: Partial<WorkspaceConfig> = {}, svc: Record<string, unknown> = {}): WorkspaceConfig {
  return {
    name: 'demo',
    version: '2.0.0',
    services: {
      api: { name: 'api', language: 'typescript', framework: 'express', port: 3000, ...svc },
    },
    ...overrides,
  } as unknown as WorkspaceConfig;
}

function only(cfg: WorkspaceConfig) {
  const resolved = resolveK8sWorkspace(cfg);
  expect(resolved.services).toHaveLength(1);
  return resolved.services[0];
}

describe('k8s-config: defaults', () => {
  it('applies hardened security defaults (PSS restricted)', () => {
    const svc = only(config());
    expect(svc.podSecurityContext).toEqual({
      runAsNonRoot: true,
      runAsUser: 10001,
      runAsGroup: 10001,
      fsGroup: 10001,
      seccompProfile: { type: 'RuntimeDefault' },
    });
    expect(svc.securityContext).toMatchObject({
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      runAsNonRoot: true,
      capabilities: { drop: ['ALL'] },
      seccompProfile: { type: 'RuntimeDefault' },
    });
    expect(svc.writablePaths).toEqual(['/tmp']);
    expect(svc.automountServiceAccountToken).toBe(false);
  });

  it('defaults resources, rollout strategy, history, PDB and HPA', () => {
    const svc = only(config());
    expect(svc.resources).toEqual({
      requests: { cpu: '100m', memory: '128Mi' },
      limits: { cpu: '500m', memory: '512Mi' },
    });
    expect(svc.strategy).toEqual({
      type: 'RollingUpdate',
      rollingUpdate: { maxSurge: 1, maxUnavailable: 0 },
    });
    expect(svc.revisionHistoryLimit).toBe(10);
    expect(svc.progressDeadlineSeconds).toBe(600);
    expect(svc.replicas).toBe(2);
    expect(svc.pdb).toEqual({ enabled: true, minAvailable: 1 });
    expect(svc.autoscaling).toMatchObject({
      enabled: true,
      minReplicas: 2,
      maxReplicas: 10,
      targetCPUUtilizationPercentage: 70,
      customMetric: { enabled: true, name: 'http_requests_per_second', averageValue: '1k' },
    });
  });

  it('falls back to tcpSocket probes when no health path is declared', () => {
    const svc = only(config());
    expect(svc.livenessProbe?.tcpSocket).toEqual({ port: 'http' });
    expect(svc.livenessProbe?.httpGet).toBeUndefined();
    expect(svc.readinessProbe?.tcpSocket).toEqual({ port: 'http' });
    expect(svc.startupProbe).toBeUndefined();
  });

  it('uses the service healthCheck path (and interval/timeout/retries) for httpGet probes', () => {
    const svc = only(config({}, { healthCheck: { path: '/healthz', interval: 7, timeout: 4, retries: 5 } }));
    expect(svc.livenessProbe).toMatchObject({
      httpGet: { path: '/healthz', port: 'http' },
      periodSeconds: 7,
      timeoutSeconds: 4,
      failureThreshold: 5,
    });
    expect(svc.readinessProbe?.httpGet).toEqual({ path: '/healthz', port: 'http' });
    expect(svc.healthPath).toBe('/healthz');
  });

  it('single-replica services get maxUnavailable (not minAvailable) PDBs so drains stay possible', () => {
    const svc = only(config({}, { scaling: { min: 1, max: 3 } }));
    expect(svc.replicas).toBe(1);
    expect(svc.pdb).toEqual({ enabled: true, maxUnavailable: 1 });
  });

  it('defaults the NetworkPolicy to allow the nginx ingress-controller namespace', () => {
    const svc = only(config());
    expect(svc.networkPolicy).toEqual({ enabled: true, allowFromNamespaces: ['ingress-nginx'] });
  });
});

describe('k8s-config: overrides and precedence', () => {
  it('workspace kubernetes < service kubernetes', () => {
    const cfg = config(
      { kubernetes: { securityContext: { runAsUser: 2000, readOnlyRootFilesystem: false }, revisionHistoryLimit: 3 } } as Partial<WorkspaceConfig>,
      { kubernetes: { securityContext: { runAsUser: 3000 } } }
    );
    const svc = only(cfg);
    expect(svc.podSecurityContext.runAsUser).toBe(3000); // service wins
    expect(svc.securityContext.readOnlyRootFilesystem).toBe(false); // inherited from workspace
    expect(svc.revisionHistoryLimit).toBe(3);
    // no read-only root FS -> no emptyDir mounts needed
    expect(svc.writablePaths).toEqual([]);
  });

  it('every securityContext knob is configurable', () => {
    const svc = only(
      config(
        {},
        {
          kubernetes: {
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1234,
              runAsGroup: 4321,
              fsGroup: 999,
              allowPrivilegeEscalation: false,
              readOnlyRootFilesystem: true,
              capabilities: { drop: ['ALL'], add: ['NET_BIND_SERVICE'] },
              seccompProfile: 'Unconfined',
              writablePaths: ['/tmp', '/var/cache/app'],
            },
          },
        }
      )
    );
    expect(svc.podSecurityContext).toMatchObject({
      runAsUser: 1234,
      runAsGroup: 4321,
      fsGroup: 999,
      seccompProfile: { type: 'Unconfined' },
    });
    expect(svc.securityContext).toMatchObject({
      capabilities: { drop: ['ALL'], add: ['NET_BIND_SERVICE'] },
    });
    expect(svc.writablePaths).toEqual(['/tmp', '/var/cache/app']);
  });

  it('legacy resources/scaling blocks feed requests, limits, replicas and the HPA', () => {
    const svc = only(
      config(
        {},
        {
          resources: { cpu: { request: '200m', limit: '1000m' }, memory: { request: '256Mi', limit: '1Gi' } },
          scaling: { min: 3, max: 8, metrics: [{ type: 'cpu', value: 55 }, { type: 'memory', value: 80 }] },
        }
      )
    );
    expect(svc.resources).toEqual({
      requests: { cpu: '200m', memory: '256Mi' },
      limits: { cpu: '1000m', memory: '1Gi' },
    });
    expect(svc.replicas).toBe(3);
    expect(svc.autoscaling).toMatchObject({
      minReplicas: 3,
      maxReplicas: 8,
      targetCPUUtilizationPercentage: 55,
      targetMemoryUtilizationPercentage: 80,
    });
    // scaling.metrics replaced the default → no custom metric unless requested
    expect(svc.autoscaling.customMetric.enabled).toBe(false);
  });

  it('kubernetes.resources (Kubernetes-shaped) overrides the legacy block', () => {
    const svc = only(
      config(
        {},
        {
          resources: { cpu: { request: '200m' } },
          kubernetes: { resources: { requests: { cpu: '300m' }, limits: { 'ephemeral-storage': '1Gi' } } },
        }
      )
    );
    expect(svc.resources.requests.cpu).toBe('300m');
    expect(svc.resources.limits['ephemeral-storage']).toBe('1Gi');
  });

  it('probes: per-probe overrides, shared path, disabled and startup probes', () => {
    const svc = only(
      config(
        {},
        {
          kubernetes: {
            probes: {
              path: '/status',
              liveness: { initialDelaySeconds: 30, periodSeconds: 20 },
              readiness: { enabled: false },
              startup: { failureThreshold: 60 },
            },
          },
        }
      )
    );
    expect(svc.livenessProbe).toMatchObject({
      httpGet: { path: '/status', port: 'http' },
      initialDelaySeconds: 30,
      periodSeconds: 20,
    });
    expect(svc.readinessProbe).toBeUndefined();
    expect(svc.startupProbe).toMatchObject({ httpGet: { path: '/status' }, failureThreshold: 60 });
  });

  it('strategy: Recreate, int-or-string surge, deployment.replicas fallback', () => {
    const recreate = only(config({}, { kubernetes: { strategy: { type: 'Recreate' } } }));
    expect(recreate.strategy).toEqual({ type: 'Recreate' });

    const rolling = only(
      config({}, { kubernetes: { strategy: { maxSurge: '25%', maxUnavailable: 1 } } })
    );
    expect(rolling.strategy.rollingUpdate).toEqual({ maxSurge: '25%', maxUnavailable: 1 });

    const fromDeployment = only(
      config({ deployment: { replicas: 5 } } as Partial<WorkspaceConfig>, { scaling: { min: 1 } })
    );
    expect(fromDeployment.replicas).toBe(5);
  });

  it('image: registry prefix, tag, pull policy', () => {
    const svc = only(
      config(
        { kubernetes: { image: { registry: 'ghcr.io/acme/', tag: '1.2.3', pullPolicy: 'Always' } } } as Partial<WorkspaceConfig>
      )
    );
    expect(svc.image).toEqual({ repository: 'ghcr.io/acme/api', tag: '1.2.3', pullPolicy: 'Always' });
  });

  it('notes a non-native workspace deployment strategy as a warning', () => {
    const resolved = resolveK8sWorkspace(config({ deployment: { strategy: 'canary' } } as Partial<WorkspaceConfig>));
    expect(resolved.warnings.join(' ')).toMatch(/canary.*not a native Deployment strategy/);
  });

  it('clamps scale-to-zero (scaling.min = 0) to 1 with a warning', () => {
    const resolved = resolveK8sWorkspace(config({}, { scaling: { min: 0, max: 3 } }));
    expect(resolved.services[0].autoscaling.minReplicas).toBe(1);
    expect(resolved.warnings.join(' ')).toMatch(/scale-to-zero/);
  });
});

describe('k8s-config: contradictory settings fail explicitly', () => {
  it('rejects a CPU request above the limit', () => {
    expect(() =>
      resolveK8sWorkspace(config({}, { resources: { cpu: { request: '900m', limit: '500m' } } }))
    ).toThrow(/cpu request \(900m\) exceeds its limit \(500m\)/);
  });

  it('rejects a memory request above the limit', () => {
    expect(() =>
      resolveK8sWorkspace(config({}, { resources: { memory: { request: '2Gi', limit: '512Mi' } } }))
    ).toThrow(/memory request \(2Gi\) exceeds its limit \(512Mi\)/);
  });

  it('rejects runAsNonRoot with runAsUser 0', () => {
    expect(() =>
      resolveK8sWorkspace(config({}, { kubernetes: { securityContext: { runAsUser: 0 } } }))
    ).toThrow(/runAsNonRoot is true but runAsUser is 0/);
  });

  it('allows root only when runAsNonRoot is explicitly disabled', () => {
    const svc = only(
      config({}, { kubernetes: { securityContext: { runAsNonRoot: false, runAsUser: 0 } } })
    );
    expect(svc.podSecurityContext).toMatchObject({ runAsNonRoot: false, runAsUser: 0 });
  });

  it('rejects pdb.minAvailable together with pdb.maxUnavailable', () => {
    expect(() =>
      resolveK8sWorkspace(
        config({}, { kubernetes: { pdb: { minAvailable: 1, maxUnavailable: 1 } } })
      )
    ).toThrow(/mutually exclusive/);
  });

  it('rejects autoscaling min above max', () => {
    expect(() =>
      resolveK8sWorkspace(config({}, { scaling: { min: 5, max: 3 } }))
    ).toThrow(/minReplicas \(5\) exceeds maxReplicas \(3\)/);
  });
});

describe('k8s-config: helpers', () => {
  it('deepMerge merges objects recursively and replaces arrays/scalars', () => {
    expect(
      deepMerge({ a: { b: 1, c: [1, 2] }, d: 1 }, { a: { c: [3], e: 2 }, d: undefined })
    ).toEqual({ a: { b: 1, c: [3], e: 2 }, d: 1 });
  });

  it('volumeNameForPath derives DNS-safe volume names', () => {
    expect(volumeNameForPath('/tmp')).toBe('tmp');
    expect(volumeNameForPath('/var/cache/nginx/')).toBe('var-cache-nginx');
    expect(volumeNameForPath('/var/lib/My_App.d')).toBe('var-lib-my-app-d');
    expect(volumeNameForPath('/')).toBe('root');
  });
});

describe('k8s-config: loadWorkspace', () => {
  it('loads and validates the fixture workspace', async () => {
    const dir = await inTmp();
    const loaded = loadWorkspace({ cwd: dir });
    expect(loaded.config.name).toBe('k8s-demo');
    expect(loaded.configPath.endsWith('re-shell.workspaces.yaml')).toBe(true);
  });

  it('throws when no config exists', async () => {
    const dir = await workspaceInTmp('name: x\n');
    expect(() => loadWorkspace({ cwd: dir })).toThrow(/Invalid workspace config/);
    expect(() => loadWorkspace({ cwd: '/nonexistent-dir-for-k8s-test' })).toThrow(
      /No workspace v2 config found/
    );
  });

  it('throws when the workspace defines no services', async () => {
    const dir = await workspaceInTmp('name: x\nversion: 2.0.0\nservices: {}\n');
    expect(() => loadWorkspace({ cwd: dir })).toThrow(/no services/);
  });
});
