import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jsonResponseSchema, k8sRollbackResponseSchema } from '@re-shell/contracts';

import {
  RollbackError,
  rollbackService,
  spawnRunner,
  type CommandResult,
  type CommandRunner,
} from '../../src/utils/k8s-rollback';
import { runK8sRollback } from '../../src/commands/k8s-rollback';
import { captureEnvelope } from '../helpers/k8s-test-utils';

// ---------------------------------------------------------------------------
// A scripted kubectl/helm: every call is recorded and answered from a table, so
// the tests pin the exact commands issued and how their exit statuses are
// interpreted. (The real binaries are exercised by scripts/k8s-live-check.sh.)
// ---------------------------------------------------------------------------

const REVISION = 'deployment.kubernetes.io/revision';
const okResult = (stdout = ''): CommandResult => ({ status: 0, stdout, stderr: '' });
const failResult = (stderr: string, status = 1): CommandResult => ({ status, stdout: '', stderr });

interface Deploy {
  revision?: number;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

function deploymentJson(d: Deploy = {}): string {
  return JSON.stringify({
    metadata: {
      name: 'api',
      annotations: { ...(d.revision !== undefined ? { [REVISION]: String(d.revision) } : {}), ...d.annotations },
      labels: d.labels ?? {},
    },
    spec: { selector: { matchLabels: { app: 'api' } } },
  });
}

function replicaSetsJson(revisions: number[], owner = 'api'): string {
  return JSON.stringify({
    items: revisions.map(r => ({
      metadata: {
        name: `${owner}-${r}`,
        annotations: { [REVISION]: String(r) },
        ownerReferences: [{ kind: 'Deployment', name: owner }],
      },
    })),
  });
}

interface Script {
  /** Called for every command; return undefined to fall through to the default OK. */
  handler: (cmd: string, args: string[], line: string) => CommandResult | undefined;
}

function scripted(handler: Script['handler']): { runner: CommandRunner; calls: string[] } {
  const calls: string[] = [];
  const runner: CommandRunner = (command, rawArgs) => {
    calls.push(`${command} ${rawArgs.join(' ')}`);
    // Handlers match on the command itself; strip the context selector so they
    // behave the same with and without --context / --kube-context.
    const args = [...rawArgs];
    const at = args.findIndex(a => a === '--context' || a === '--kube-context');
    if (at >= 0) args.splice(at, 2);
    const line = `${command} ${args.join(' ')}`;
    return handler(command, args, line) ?? okResult();
  };
  return { runner, calls };
}

/** kubectl scripted for a plain (non-Helm) Deployment with the given revisions. */
function plainCluster(opts: {
  current: number;
  history: number[];
  after?: number;
  undo?: CommandResult;
  status?: CommandResult;
  deploy?: Deploy;
}) {
  let gets = 0;
  return scripted((cmd, args, line) => {
    if (cmd === 'kubectl' && args[0] === 'version') return okResult('Client Version: v1.31.0');
    if (line.includes('get deployment')) {
      gets += 1;
      const revision = gets === 1 ? opts.current : (opts.after ?? opts.history[0]);
      return okResult(deploymentJson({ revision, ...opts.deploy }));
    }
    if (line.includes('get replicaset')) return okResult(replicaSetsJson(opts.history));
    if (line.includes('rollout undo')) return opts.undo;
    if (line.includes('rollout status')) return opts.status;
    return undefined;
  });
}

describe('k8s-rollback: kubectl rollout undo', () => {
  it('rolls back to the previous revision, waits for readiness and reports the new revision', () => {
    const { runner, calls } = plainCluster({ current: 3, history: [1, 2, 3], after: 4 });
    const result = rollbackService({ service: 'api', namespace: 'apps', runner });

    expect(result).toMatchObject({
      service: 'api',
      namespace: 'apps',
      method: 'kubectl',
      dryRun: false,
      fromRevision: 3,
      toRevision: 2,
      currentRevision: 4,
      rolledBack: true,
    });
    expect(result.command).toEqual([
      'kubectl', 'rollout', 'undo', 'deployment/api', '-n', 'apps', '--to-revision=2',
    ]);
    expect(calls.some(c => c.startsWith('kubectl rollout status deployment/api -n apps --timeout=300s'))).toBe(true);
    // the undo happens before the readiness wait
    const undoAt = calls.findIndex(c => c.includes('rollout undo'));
    const statusAt = calls.findIndex(c => c.includes('rollout status'));
    expect(undoAt).toBeGreaterThan(-1);
    expect(statusAt).toBeGreaterThan(undoAt);
  });

  it('honours --to-revision and a custom timeout', () => {
    const { runner, calls } = plainCluster({ current: 5, history: [1, 2, 3, 4, 5] });
    const result = rollbackService({ service: 'api', toRevision: 2, timeoutSeconds: 90, runner });
    expect(result.toRevision).toBe(2);
    expect(result.namespace).toBe('default');
    expect(calls.some(c => c.includes('--to-revision=2'))).toBe(true);
    expect(calls.some(c => c.includes('--timeout=90s'))).toBe(true);
  });

  it('--dry-run uses the server-side dry-run, never waits for a rollout and does not claim a rollback', () => {
    const { runner, calls } = plainCluster({ current: 3, history: [1, 2, 3] });
    const result = rollbackService({ service: 'api', dryRun: true, runner });
    expect(result.dryRun).toBe(true);
    expect(result.rolledBack).toBe(false);
    expect(result.currentRevision).toBeNull();
    expect(result.command).toContain('--dry-run=server');
    expect(calls.some(c => c.includes('rollout status'))).toBe(false);
  });

  it('passes --context to kubectl', () => {
    const { runner, calls } = plainCluster({ current: 2, history: [1, 2] });
    rollbackService({ service: 'api', context: 'prod', runner });
    expect(calls.every(c => c.startsWith('kubectl --context prod '))).toBe(true);
  });

  it('fails with NO_PREVIOUS_REVISION when there is nothing to return to', () => {
    const { runner, calls } = plainCluster({ current: 1, history: [1] });
    expect(() => rollbackService({ service: 'api', runner })).toThrowError(RollbackError);
    try {
      rollbackService({ service: 'api', runner });
    } catch (error) {
      expect((error as RollbackError).reason).toBe('NO_PREVIOUS_REVISION');
    }
    expect(calls.some(c => c.includes('rollout undo'))).toBe(false);
  });

  it('fails with REVISION_NOT_FOUND for an unknown --to-revision (and lists what exists)', () => {
    const { runner } = plainCluster({ current: 3, history: [1, 2, 3] });
    try {
      rollbackService({ service: 'api', toRevision: 9, runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect(error).toBeInstanceOf(RollbackError);
      expect((error as RollbackError).reason).toBe('REVISION_NOT_FOUND');
      expect((error as RollbackError).details.available).toEqual([1, 2, 3]);
    }
  });

  it('fails with NOT_FOUND when the Deployment does not exist', () => {
    const { runner } = scripted((cmd, args, line) => {
      if (args[0] === 'version') return okResult();
      if (line.includes('get deployment')) {
        return failResult('Error from server (NotFound): deployments.apps "api" not found');
      }
      return undefined;
    });
    try {
      rollbackService({ service: 'api', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('NOT_FOUND');
    }
  });

  it('fails with CLUSTER_UNREACHABLE when the API server cannot be reached', () => {
    const { runner } = scripted((cmd, args, line) => {
      if (args[0] === 'version') return okResult();
      if (line.includes('get deployment')) {
        return failResult('The connection to the server localhost:8080 was refused - did you specify the right host or port? Unable to connect to the server: dial tcp 127.0.0.1:8080: connect: connection refused');
      }
      return undefined;
    });
    try {
      rollbackService({ service: 'api', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('CLUSTER_UNREACHABLE');
    }
  });

  it('fails with TOOL_MISSING when kubectl cannot run', () => {
    const { runner } = scripted(() => ({ status: -1, stdout: '', stderr: '', error: 'spawn kubectl ENOENT' }));
    try {
      rollbackService({ service: 'api', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('TOOL_MISSING');
    }
  });

  it('fails with COMMAND_FAILED (real exit status surfaced) when the undo itself fails', () => {
    const { runner } = plainCluster({
      current: 3,
      history: [1, 2, 3],
      undo: failResult('error: unable to find specified revision 2 in history', 1),
    });
    try {
      rollbackService({ service: 'api', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('COMMAND_FAILED');
      expect((error as RollbackError).details.status).toBe(1);
      expect((error as RollbackError).message).toMatch(/unable to find specified revision/);
    }
  });

  it('fails with ROLLOUT_FAILED when the rolled-back workload does not become ready', () => {
    const { runner } = plainCluster({
      current: 3,
      history: [1, 2, 3],
      status: failResult('error: timed out waiting for the condition', 1),
    });
    try {
      rollbackService({ service: 'api', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('ROLLOUT_FAILED');
      expect((error as RollbackError).details.undoApplied).toBe(true);
    }
  });

  it('ignores ReplicaSets owned by other Deployments when computing history', () => {
    let gets = 0;
    const { runner } = scripted((cmd, args, line) => {
      if (args[0] === 'version') return okResult();
      if (line.includes('get deployment')) {
        gets += 1;
        return okResult(deploymentJson({ revision: gets === 1 ? 4 : 5 }));
      }
      if (line.includes('get replicaset')) {
        return okResult(
          JSON.stringify({
            items: [
              ...JSON.parse(replicaSetsJson([1, 4])).items,
              ...JSON.parse(replicaSetsJson([2, 3], 'other')).items,
            ],
          })
        );
      }
      return undefined;
    });
    expect(rollbackService({ service: 'api', runner }).toRevision).toBe(1);
  });

  it('warns when Argo CD or Flux manage the Deployment (they will revert the rollback)', () => {
    const argo = plainCluster({
      current: 2,
      history: [1, 2],
      deploy: { annotations: { 'argocd.argoproj.io/tracking-id': 'app:apps/Deployment:ns/api' } },
    });
    expect(rollbackService({ service: 'api', runner: argo.runner }).warnings.join(' ')).toMatch(/Argo CD/);

    const flux = plainCluster({
      current: 2,
      history: [1, 2],
      deploy: { labels: { 'helm.toolkit.fluxcd.io/name': 'app' } },
    });
    expect(rollbackService({ service: 'api', runner: flux.runner }).warnings.join(' ')).toMatch(/Flux/);
  });
});

// ---------------------------------------------------------------------------
// Helm
// ---------------------------------------------------------------------------

function helmCluster(opts: {
  history: Array<{ revision: number; status: string }>;
  afterHistory?: Array<{ revision: number; status: string }>;
  rollback?: CommandResult;
  status?: CommandResult;
  helmProbe?: CommandResult;
  annotations?: Record<string, string>;
}) {
  let historyCalls = 0;
  return scripted((cmd, args, line) => {
    if (cmd === 'kubectl' && args[0] === 'version') return okResult();
    if (cmd === 'helm' && args[0] === 'version') return opts.helmProbe ?? okResult('v3.16.0');
    if (line.startsWith('kubectl') && line.includes('get deployment')) {
      return okResult(
        deploymentJson({
          revision: 7,
          annotations: {
            'meta.helm.sh/release-name': 'shop',
            'meta.helm.sh/release-namespace': 'shop-ns',
            ...opts.annotations,
          },
        })
      );
    }
    if (line.startsWith('helm history')) {
      historyCalls += 1;
      const rows = historyCalls === 1 ? opts.history : (opts.afterHistory ?? opts.history);
      return okResult(JSON.stringify(rows));
    }
    if (line.startsWith('helm rollback')) return opts.rollback;
    if (line.includes('rollout status')) return opts.status;
    return undefined;
  });
}

describe('k8s-rollback: helm rollback for Helm-managed services', () => {
  const history = [
    { revision: 1, status: 'superseded' },
    { revision: 2, status: 'superseded' },
    { revision: 3, status: 'deployed' },
  ];

  it('auto-detects the Helm release from the ownership annotations and rolls back with --wait', () => {
    const { runner, calls } = helmCluster({
      history,
      afterHistory: [...history.slice(0, 2), { revision: 3, status: 'superseded' }, { revision: 4, status: 'deployed' }],
    });
    const result = rollbackService({ service: 'api', namespace: 'apps', runner });
    expect(result).toMatchObject({
      method: 'helm',
      release: 'shop',
      fromRevision: 3,
      toRevision: 2,
      currentRevision: 4,
      rolledBack: true,
    });
    expect(result.command).toEqual([
      'helm', 'rollback', 'shop', '2', '-n', 'shop-ns', '--wait', '--timeout', '300s',
    ]);
    expect(calls.some(c => c.startsWith('kubectl rollout status deployment/api -n apps'))).toBe(true);
    expect(calls.some(c => c.includes('rollout undo'))).toBe(false);
  });

  it('after a failed upgrade (newest revision failed, older one still deployed) it returns to the last good revision', () => {
    // `helm upgrade --wait` that times out leaves: 1 deployed, 2 failed
    const { runner } = helmCluster({
      history: [
        { revision: 1, status: 'deployed' },
        { revision: 2, status: 'failed' },
      ],
    });
    const result = rollbackService({ service: 'api', runner });
    expect(result).toMatchObject({ method: 'helm', fromRevision: 2, toRevision: 1, rolledBack: true });
    expect(result.command.slice(0, 4)).toEqual(['helm', 'rollback', 'shop', '1']);
  });

  it('skips failed revisions when choosing the previous one', () => {
    const { runner } = helmCluster({
      history: [
        { revision: 1, status: 'superseded' },
        { revision: 2, status: 'failed' },
        { revision: 3, status: 'failed' },
      ],
    });
    const result = rollbackService({ service: 'api', runner });
    expect(result).toMatchObject({ fromRevision: 3, toRevision: 1 });
  });

  it('reports NO_PREVIOUS_REVISION (with statuses) when only failed revisions precede the latest', () => {
    const { runner } = helmCluster({
      history: [
        { revision: 1, status: 'failed' },
        { revision: 2, status: 'failed' },
      ],
    });
    try {
      rollbackService({ service: 'api', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('NO_PREVIOUS_REVISION');
      expect((error as RollbackError).message).toMatch(/1=failed, 2=failed/);
    }
  });

  it('honours --to-revision and --dry-run (helm --dry-run, no readiness wait)', () => {
    const { runner, calls } = helmCluster({ history });
    const result = rollbackService({ service: 'api', toRevision: 1, dryRun: true, runner });
    expect(result.toRevision).toBe(1);
    expect(result.rolledBack).toBe(false);
    expect(result.command).toContain('--dry-run');
    expect(calls.some(c => c.includes('rollout status'))).toBe(false);
  });

  it('--method helm needs a release when the Deployment is not Helm-managed', () => {
    const { runner } = scripted((cmd, args, line) => {
      if (args[0] === 'version') return okResult();
      if (line.includes('get deployment')) return okResult(deploymentJson({ revision: 2 }));
      return undefined;
    });
    try {
      rollbackService({ service: 'api', method: 'helm', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('NOT_HELM_MANAGED');
    }
  });

  it('--release overrides the detected release and --method kubectl bypasses Helm', () => {
    const viaRelease = helmCluster({ history, annotations: { 'meta.helm.sh/release-name': 'other' } });
    expect(rollbackService({ service: 'api', release: 'chosen', runner: viaRelease.runner }).release).toBe('chosen');

    const plain = scripted((cmd, args, line) => {
      if (args[0] === 'version') return okResult();
      if (line.includes('get deployment')) {
        return okResult(deploymentJson({ revision: 2, annotations: { 'meta.helm.sh/release-name': 'shop' } }));
      }
      if (line.includes('get replicaset')) return okResult(replicaSetsJson([1, 2]));
      return undefined;
    });
    const result = rollbackService({ service: 'api', method: 'kubectl', runner: plain.runner });
    expect(result.method).toBe('kubectl');
    expect(plain.calls.some(c => c.startsWith('helm'))).toBe(false);
  });

  it('fails with NO_PREVIOUS_REVISION / REVISION_NOT_FOUND from the release history', () => {
    const single = helmCluster({ history: [{ revision: 1, status: 'deployed' }] });
    try {
      rollbackService({ service: 'api', runner: single.runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('NO_PREVIOUS_REVISION');
    }
    const multi = helmCluster({ history });
    try {
      rollbackService({ service: 'api', toRevision: 42, runner: multi.runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('REVISION_NOT_FOUND');
    }
  });

  it('helm rollback exit status is surfaced: COMMAND_FAILED, or ROLLOUT_FAILED when --wait times out', () => {
    const failing = helmCluster({ history, rollback: failResult('Error: rollback failed: release shop: not found', 1) });
    try {
      rollbackService({ service: 'api', runner: failing.runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('COMMAND_FAILED');
    }
    const timeout = helmCluster({ history, rollback: failResult('Error: timed out waiting for the condition', 1) });
    try {
      rollbackService({ service: 'api', runner: timeout.runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('ROLLOUT_FAILED');
    }
  });

  it('fails with TOOL_MISSING when helm is not installed', () => {
    const { runner } = helmCluster({ history, helmProbe: { status: -1, stdout: '', stderr: '', error: 'spawn helm ENOENT' } });
    try {
      rollbackService({ service: 'api', runner });
      throw new Error('expected a RollbackError');
    } catch (error) {
      expect((error as RollbackError).reason).toBe('TOOL_MISSING');
      expect((error as RollbackError).message).toMatch(/helm/);
    }
  });

  it('passes --kube-context to helm', () => {
    const { runner, calls } = helmCluster({ history });
    rollbackService({ service: 'api', context: 'prod', runner });
    expect(calls.filter(c => c.startsWith('helm')).every(c => c.startsWith('helm --kube-context prod '))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// spawnRunner (the default runner) against real processes
// ---------------------------------------------------------------------------

describe('k8s-rollback: spawnRunner', () => {
  it('reports real exit statuses and captured output', () => {
    expect(spawnRunner('node', ['-e', 'process.stdout.write("hi")'])).toMatchObject({ status: 0, stdout: 'hi' });
    expect(spawnRunner('node', ['-e', 'process.stderr.write("bad");process.exit(7)'])).toMatchObject({
      status: 7,
      stderr: 'bad',
    });
  });

  it('reports a missing binary as status -1 with an error (never as success)', () => {
    const result = spawnRunner('definitely-not-a-real-binary-xyz', []);
    expect(result.status).toBe(-1);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Command layer: envelopes + exit codes
// ---------------------------------------------------------------------------

describe('k8s-rollback: command layer', () => {
  beforeEach(() => {
    process.exitCode = 0;
  });
  afterEach(() => {
    process.exitCode = 0;
  });

  const envelopeSchema = jsonResponseSchema(k8sRollbackResponseSchema);

  it('--json success: ok envelope matching the contract, exit 0', async () => {
    const { runner } = plainCluster({ current: 3, history: [1, 2, 3], after: 4 });
    const env = await captureEnvelope<{ ok: boolean; data: Record<string, unknown>; warnings: string[] }>(() =>
      runK8sRollback({ service: 'api', namespace: 'apps', json: true, runner })
    );
    expect(env.ok).toBe(true);
    expect(envelopeSchema.safeParse(env).success).toBe(true);
    expect(env.data).toMatchObject({ method: 'kubectl', fromRevision: 3, toRevision: 2, rolledBack: true });
    expect(env.data).not.toHaveProperty('warnings');
    expect(process.exitCode).toBe(0);
  });

  it('--json dry-run: reports the plan and rolledBack:false', async () => {
    const { runner } = plainCluster({ current: 3, history: [1, 2, 3] });
    const env = await captureEnvelope<{ ok: boolean; data: { dryRun: boolean; rolledBack: boolean } }>(() =>
      runK8sRollback({ service: 'api', dryRun: true, json: true, runner })
    );
    expect(env.ok).toBe(true);
    expect(env.data).toMatchObject({ dryRun: true, rolledBack: false });
  });

  it('--json failure: K8S_ROLLBACK_ERROR with the reason in details, exit 1', async () => {
    const { runner } = plainCluster({ current: 1, history: [1] });
    const env = await captureEnvelope<{ ok: boolean; error: { code: string; message: string; details: { reason: string } } }>(
      () => runK8sRollback({ service: 'api', json: true, runner })
    );
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe('K8S_ROLLBACK_ERROR');
    expect(env.error.details.reason).toBe('NO_PREVIOUS_REVISION');
    expect(envelopeSchema.safeParse(env).success).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('a rollout that does not recover is a failure (exit 1), not a success', async () => {
    const { runner } = plainCluster({
      current: 3,
      history: [1, 2, 3],
      status: failResult('error: timed out waiting for the condition'),
    });
    const env = await captureEnvelope<{ ok: boolean; error: { details: { reason: string; undoApplied: boolean } } }>(() =>
      runK8sRollback({ service: 'api', json: true, runner })
    );
    expect(env.ok).toBe(false);
    expect(env.error.details).toMatchObject({ reason: 'ROLLOUT_FAILED', undoApplied: true });
    expect(process.exitCode).toBe(1);
  });

  it('validates arguments: --to-revision, --timeout and --method', async () => {
    const { runner } = plainCluster({ current: 3, history: [1, 2, 3] });
    for (const bad of [
      { toRevision: 'abc' },
      { toRevision: 0 },
      { timeout: '-5' },
      { method: 'flux' },
    ]) {
      process.exitCode = 0;
      const env = await captureEnvelope<{ ok: boolean; error: { code: string; details: { reason: string } } }>(() =>
        runK8sRollback({ service: 'api', json: true, runner, ...bad })
      );
      expect(env.ok).toBe(false);
      expect(env.error.code).toBe('K8S_ROLLBACK_ERROR');
      expect(env.error.details.reason).toBe('INVALID_ARGUMENT');
      expect(process.exitCode).toBe(1);
    }
  });

  it('without a cluster the real kubectl path fails explicitly (no simulated success)', async () => {
    // Default runner against an unreachable API server (or a missing kubectl).
    const previous = process.env.KUBECONFIG;
    process.env.KUBECONFIG = '/nonexistent/kubeconfig-for-test';
    try {
      const env = await captureEnvelope<{ ok: boolean; error: { details: { reason: string } } }>(() =>
        runK8sRollback({ service: 'api', json: true })
      );
      expect(env.ok).toBe(false);
      expect(['TOOL_MISSING', 'CLUSTER_UNREACHABLE', 'COMMAND_FAILED']).toContain(env.error.details.reason);
      expect(process.exitCode).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.KUBECONFIG;
      else process.env.KUBECONFIG = previous;
    }
  });
});
