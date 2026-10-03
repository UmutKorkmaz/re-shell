// Real rollback helper for `re-shell k8s rollback <service>` (P9-D).
//
// Wraps `kubectl rollout undo` for plain Deployments, or `helm rollback` when
// the Deployment was installed by Helm (detected from Helm's own ownership
// annotations). Every step talks to the real cluster through kubectl/helm and
// the outcome is derived from their exit statuses and from re-reading the
// cluster afterwards — there is no simulated success path: a missing tool, an
// unreachable cluster, an unknown service/revision or a rollout that does not
// become ready all surface as a RollbackError (non-zero exit / JSON ok:false).

import { spawnSync } from 'child_process';

/** Result of running one external command. */
export interface CommandResult {
  /** Exit status; -1 when the process could not be started or timed out. */
  status: number;
  stdout: string;
  stderr: string;
  /** Spawn-level error message (ENOENT, timeout, ...). */
  error?: string;
}

/** Injectable command runner (tests substitute a recording fake). */
export type CommandRunner = (
  command: string,
  args: string[],
  options?: { timeoutMs?: number }
) => CommandResult;

/** Default runner: spawnSync with captured UTF-8 output. */
export const spawnRunner: CommandRunner = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: options.timeoutMs,
  });
  if (result.error) {
    return {
      status: -1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      error: result.error.message,
    };
  }
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
};

/** Why a rollback failed (stable, machine-readable). */
export type RollbackFailureReason =
  | 'INVALID_ARGUMENT'
  | 'TOOL_MISSING'
  | 'CLUSTER_UNREACHABLE'
  | 'NOT_FOUND'
  | 'NOT_HELM_MANAGED'
  | 'NO_PREVIOUS_REVISION'
  | 'REVISION_NOT_FOUND'
  | 'COMMAND_FAILED'
  | 'ROLLOUT_FAILED';

/** Thrown for every rollback failure; carries a stable reason and any partial result. */
export class RollbackError extends Error {
  constructor(
    public readonly reason: RollbackFailureReason,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'RollbackError';
  }
}

/** How the workload is rolled back. */
export type RollbackMethod = 'kubectl' | 'helm';

/** Options for {@link rollbackService}. */
export interface RollbackOptions {
  /** Deployment name (the workspace service name). */
  service: string;
  /** Kubernetes namespace (default: "default"). */
  namespace?: string;
  /** Revision to return to; defaults to the previous revision. */
  toRevision?: number;
  /** Plan the rollback with the tool's own dry-run instead of applying it. */
  dryRun?: boolean;
  /** `auto` picks helm when the Deployment is Helm-managed, kubectl otherwise. */
  method?: 'auto' | RollbackMethod;
  /** Helm release name override (default: Helm's release annotation). */
  release?: string;
  /** Seconds to wait for the rolled-back workload to become ready (default 300). */
  timeoutSeconds?: number;
  /** kubeconfig context to use. */
  context?: string;
  /** Injected runner (tests). */
  runner?: CommandRunner;
}

/** Outcome of a successful rollback (or dry-run plan). */
export interface RollbackResult {
  service: string;
  namespace: string;
  method: RollbackMethod;
  /** Helm release name when `method` is `helm`. */
  release?: string;
  dryRun: boolean;
  /** Revision that was live before the rollback. */
  fromRevision: number | null;
  /** Revision the rollback returns to. */
  toRevision: number;
  /** Revision live after the rollback (null for dry-run). */
  currentRevision: number | null;
  /** The mutating command that was (or, for dry-run, would have been) run. */
  command: string[];
  /** True only when the rollback was applied and the workload became ready. */
  rolledBack: boolean;
  /** Combined output of the rollback command. */
  output: string;
  /** Output of the readiness wait (absent for dry-run). */
  rolloutStatus?: string;
  warnings: string[];
}

const DEFAULT_NAMESPACE = 'default';
const DEFAULT_TIMEOUT_SECONDS = 300;
const REVISION_ANNOTATION = 'deployment.kubernetes.io/revision';
const HELM_RELEASE_ANNOTATION = 'meta.helm.sh/release-name';
const HELM_NAMESPACE_ANNOTATION = 'meta.helm.sh/release-namespace';

interface K8sObject {
  metadata?: {
    name?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
    ownerReferences?: Array<{ kind?: string; name?: string }>;
  };
  spec?: { selector?: { matchLabels?: Record<string, string> } };
}

function combined(result: CommandResult): string {
  return [result.stdout, result.stderr, result.error]
    .filter(part => part && part.trim().length > 0)
    .join('\n')
    .trim();
}

function classifyFailure(result: CommandResult, what: string): RollbackError {
  const text = combined(result);
  if (/NotFound|not found/i.test(text)) {
    return new RollbackError('NOT_FOUND', `${what}: ${text}`, { output: text });
  }
  if (
    /connection refused|Unable to connect to the server|couldn't get current server API group list|dial tcp|no such host|i\/o timeout|Kubernetes cluster unreachable/i.test(
      text
    )
  ) {
    return new RollbackError('CLUSTER_UNREACHABLE', `${what}: cluster unreachable (${text})`, {
      output: text,
    });
  }
  return new RollbackError('COMMAND_FAILED', `${what}: ${text || `exit status ${result.status}`}`, {
    status: result.status,
    output: text,
  });
}

function parseRevision(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/** Detect Argo CD / Flux ownership, which will revert an out-of-band rollback. */
function gitopsWarnings(deployment: K8sObject): string[] {
  const annotations = deployment.metadata?.annotations ?? {};
  const labels = deployment.metadata?.labels ?? {};
  const warnings: string[] = [];
  if (annotations['argocd.argoproj.io/tracking-id'] || labels['argocd.argoproj.io/instance']) {
    warnings.push(
      'Deployment is managed by Argo CD: with automated selfHeal the rollback will be reverted to the git revision. ' +
        'Roll back by reverting the git commit (or `argocd app rollback` with auto-sync disabled).'
    );
  }
  if (labels['kustomize.toolkit.fluxcd.io/name'] || labels['helm.toolkit.fluxcd.io/name']) {
    warnings.push(
      'Deployment is managed by Flux: the rollback will be reverted on the next reconcile. ' +
        'Roll back by reverting the git commit, or suspend the Kustomization/HelmRelease first.'
    );
  }
  return warnings;
}

/** Revisions (with the owning ReplicaSet) recorded for a Deployment. */
function deploymentRevisions(
  run: (args: string[]) => CommandResult,
  namespace: string,
  deployment: K8sObject
): number[] {
  const selector = Object.entries(deployment.spec?.selector?.matchLabels ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  const args = ['get', 'replicaset', '-n', namespace, '-o', 'json', '--request-timeout=30s'];
  if (selector) args.push('-l', selector);
  const result = run(args);
  if (result.status !== 0) throw classifyFailure(result, 'Listing ReplicaSets');

  let items: K8sObject[] = [];
  try {
    items = (JSON.parse(result.stdout) as { items?: K8sObject[] }).items ?? [];
  } catch {
    throw new RollbackError('COMMAND_FAILED', 'Listing ReplicaSets: kubectl returned invalid JSON');
  }
  const name = deployment.metadata?.name;
  const revisions: number[] = [];
  for (const rs of items) {
    const owned = (rs.metadata?.ownerReferences ?? []).some(
      o => o.kind === 'Deployment' && o.name === name
    );
    const revision = parseRevision(rs.metadata?.annotations?.[REVISION_ANNOTATION]);
    if (owned && revision !== null) revisions.push(revision);
  }
  return Array.from(new Set(revisions)).sort((a, b) => a - b);
}

interface HelmRevision {
  revision: number;
  status: string;
}

/** Helm release states that mean "this revision was installed successfully at some point". */
const HELM_GOOD_STATUSES = new Set(['deployed', 'superseded']);

function helmHistory(
  run: (args: string[]) => CommandResult,
  release: string,
  namespace: string
): HelmRevision[] {
  const result = run(['history', release, '-n', namespace, '-o', 'json']);
  if (result.status !== 0) throw classifyFailure(result, `helm history ${release}`);
  try {
    const rows = JSON.parse(result.stdout) as Array<{ revision: number; status: string }>;
    return rows.map(r => ({ revision: Number(r.revision), status: String(r.status) }));
  } catch {
    throw new RollbackError('COMMAND_FAILED', 'helm history returned invalid JSON');
  }
}

/**
 * Roll a service back to its previous (or a chosen) revision.
 *
 * @param options - See {@link RollbackOptions}.
 * @returns The rollback outcome; `rolledBack` is true only when the undo was
 *   applied AND the workload became ready again.
 * @throws RollbackError for a missing tool, unreachable cluster, unknown
 *   service/revision, a failing rollback command, or a rollout that does not
 *   become ready within the timeout.
 */
export function rollbackService(options: RollbackOptions): RollbackResult {
  const runner = options.runner ?? spawnRunner;
  const service = options.service;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const dryRun = options.dryRun === true;
  const timeoutSeconds = options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
  const timeoutMs = (timeoutSeconds + 60) * 1000;

  const kubectlArgs = (args: string[]): string[] =>
    options.context ? ['--context', options.context, ...args] : args;
  const kubectl = (args: string[], t?: number): CommandResult =>
    runner('kubectl', kubectlArgs(args), { timeoutMs: t });
  const helm = (args: string[], t?: number): CommandResult =>
    runner('helm', options.context ? ['--kube-context', options.context, ...args] : args, {
      timeoutMs: t,
    });

  const probe = kubectl(['version', '--client']);
  if (probe.status !== 0) {
    throw new RollbackError('TOOL_MISSING', 'kubectl was not found on PATH (or failed to run)', {
      output: combined(probe),
    });
  }

  // 1. Read the live Deployment.
  const get = kubectl([
    'get',
    'deployment',
    service,
    '-n',
    namespace,
    '-o',
    'json',
    '--request-timeout=30s',
  ]);
  if (get.status !== 0) {
    const err = classifyFailure(get, `Reading deployment/${service} in namespace ${namespace}`);
    throw err;
  }
  let deployment: K8sObject;
  try {
    deployment = JSON.parse(get.stdout) as K8sObject;
  } catch {
    throw new RollbackError('COMMAND_FAILED', 'kubectl returned invalid JSON for the Deployment');
  }
  const warnings = gitopsWarnings(deployment);
  const currentRevision = parseRevision(deployment.metadata?.annotations?.[REVISION_ANNOTATION]);

  // 2. Pick the mechanism.
  const annotatedRelease = deployment.metadata?.annotations?.[HELM_RELEASE_ANNOTATION];
  const annotatedNamespace =
    deployment.metadata?.annotations?.[HELM_NAMESPACE_ANNOTATION] ?? namespace;
  const requested = options.method ?? 'auto';
  const release = options.release ?? annotatedRelease;
  const method: RollbackMethod =
    requested === 'auto' ? (release ? 'helm' : 'kubectl') : requested;

  if (method === 'helm') {
    if (!release) {
      throw new RollbackError(
        'NOT_HELM_MANAGED',
        `deployment/${service} carries no Helm release annotation; pass --release <name> or use --method kubectl`
      );
    }
    return rollbackWithHelm({
      helm,
      kubectl,
      service,
      namespace,
      releaseNamespace: annotatedNamespace,
      release,
      toRevision: options.toRevision,
      dryRun,
      timeoutSeconds,
      timeoutMs,
      currentRevision,
      warnings,
    });
  }

  // kubectl path -------------------------------------------------------------
  const revisions = deploymentRevisions(kubectl, namespace, deployment);
  let target: number;
  if (options.toRevision !== undefined) {
    if (!revisions.includes(options.toRevision)) {
      throw new RollbackError(
        'REVISION_NOT_FOUND',
        `deployment/${service} has no revision ${options.toRevision} (available: ${revisions.join(', ') || 'none'})`,
        { available: revisions }
      );
    }
    target = options.toRevision;
  } else {
    const previous = revisions.filter(r => currentRevision === null || r < currentRevision);
    if (previous.length === 0) {
      throw new RollbackError(
        'NO_PREVIOUS_REVISION',
        `deployment/${service} has no earlier revision to roll back to (history: ${revisions.join(', ') || 'none'})`,
        { available: revisions }
      );
    }
    target = previous[previous.length - 1];
  }

  const undoArgs = [
    'rollout',
    'undo',
    `deployment/${service}`,
    '-n',
    namespace,
    `--to-revision=${target}`,
  ];
  if (dryRun) undoArgs.push('--dry-run=server');
  const undo = kubectl(undoArgs, timeoutMs);
  if (undo.status !== 0) throw classifyFailure(undo, `kubectl rollout undo deployment/${service}`);

  const base: RollbackResult = {
    service,
    namespace,
    method: 'kubectl',
    dryRun,
    fromRevision: currentRevision,
    toRevision: target,
    currentRevision: null,
    command: ['kubectl', ...kubectlArgs(undoArgs)],
    rolledBack: false,
    output: combined(undo),
    warnings,
  };
  if (dryRun) return base;

  const status = kubectl(
    ['rollout', 'status', `deployment/${service}`, '-n', namespace, `--timeout=${timeoutSeconds}s`],
    timeoutMs
  );
  if (status.status !== 0) {
    throw new RollbackError(
      'ROLLOUT_FAILED',
      `Rolled deployment/${service} back to revision ${target} but it did not become ready within ${timeoutSeconds}s: ${combined(status)}`,
      { undoApplied: true, result: { ...base, rolloutStatus: combined(status) } }
    );
  }

  const after = kubectl(['get', 'deployment', service, '-n', namespace, '-o', 'json']);
  let afterRevision: number | null = null;
  if (after.status === 0) {
    try {
      afterRevision = parseRevision(
        (JSON.parse(after.stdout) as K8sObject).metadata?.annotations?.[REVISION_ANNOTATION]
      );
    } catch {
      afterRevision = null;
    }
  }
  return {
    ...base,
    currentRevision: afterRevision,
    rolledBack: true,
    rolloutStatus: combined(status),
  };
}

interface HelmRollbackInput {
  helm: (args: string[], t?: number) => CommandResult;
  kubectl: (args: string[], t?: number) => CommandResult;
  service: string;
  namespace: string;
  releaseNamespace: string;
  release: string;
  toRevision?: number;
  dryRun: boolean;
  timeoutSeconds: number;
  timeoutMs: number;
  currentRevision: number | null;
  warnings: string[];
}

function rollbackWithHelm(input: HelmRollbackInput): RollbackResult {
  const { helm, release, releaseNamespace, dryRun, timeoutSeconds, timeoutMs } = input;

  const probe = helm(['version', '--short']);
  if (probe.status !== 0) {
    throw new RollbackError('TOOL_MISSING', 'helm was not found on PATH (or failed to run)', {
      output: combined(probe),
    });
  }

  const history = helmHistory(helm, release, releaseNamespace);
  const known = history.map(h => h.revision);
  // The live revision is the newest one, whatever its status: a failed upgrade
  // (`helm upgrade --wait` that timed out) is recorded as a newer revision in
  // state `failed` while the previous good one is still `deployed`/`superseded`.
  const current = known.length > 0 ? Math.max(...known) : null;

  let target: number;
  if (input.toRevision !== undefined) {
    if (!known.includes(input.toRevision)) {
      throw new RollbackError(
        'REVISION_NOT_FOUND',
        `helm release ${release} has no revision ${input.toRevision} (available: ${known.join(', ') || 'none'})`,
        { available: known }
      );
    }
    target = input.toRevision;
  } else {
    // Return to the most recent earlier revision that once succeeded; revisions
    // that failed (or never finished) are not a safe place to roll back to.
    const good = history
      .filter(h => current !== null && h.revision < current && HELM_GOOD_STATUSES.has(h.status))
      .map(h => h.revision);
    if (good.length === 0) {
      throw new RollbackError(
        'NO_PREVIOUS_REVISION',
        `helm release ${release} has no earlier successful revision to roll back to (history: ${
          history.map(h => `${h.revision}=${h.status}`).join(', ') || 'none'
        })`,
        { available: known }
      );
    }
    target = Math.max(...good);
  }

  const args = [
    'rollback',
    release,
    String(target),
    '-n',
    releaseNamespace,
    '--wait',
    '--timeout',
    `${timeoutSeconds}s`,
  ];
  if (dryRun) args.push('--dry-run');
  const rollback = helm(args, timeoutMs);

  const base: RollbackResult = {
    service: input.service,
    namespace: input.namespace,
    method: 'helm',
    release,
    dryRun,
    fromRevision: current,
    toRevision: target,
    currentRevision: null,
    command: ['helm', ...args],
    rolledBack: false,
    output: combined(rollback),
    warnings: input.warnings,
  };
  if (rollback.status !== 0) {
    // With --wait, helm exits non-zero when the rolled-back release is not ready in time.
    const waitFailure = /timed out|context deadline exceeded|not ready/i.test(combined(rollback));
    throw new RollbackError(
      waitFailure ? 'ROLLOUT_FAILED' : 'COMMAND_FAILED',
      `helm rollback ${release} ${target} failed: ${combined(rollback) || `exit status ${rollback.status}`}`,
      { undoApplied: waitFailure, result: base }
    );
  }
  if (dryRun) return base;

  const status = input.kubectl(
    [
      'rollout',
      'status',
      `deployment/${input.service}`,
      '-n',
      input.namespace,
      `--timeout=${timeoutSeconds}s`,
    ],
    timeoutMs
  );
  if (status.status !== 0) {
    throw new RollbackError(
      'ROLLOUT_FAILED',
      `helm rolled ${release} back to revision ${target} but deployment/${input.service} did not become ready: ${combined(status)}`,
      { undoApplied: true, result: { ...base, rolloutStatus: combined(status) } }
    );
  }

  const after = helmHistory(helm, release, releaseNamespace).map(h => h.revision);
  const afterRevision = after.length > 0 ? Math.max(...after) : null;
  return {
    ...base,
    currentRevision: afterRevision,
    rolledBack: true,
    rolloutStatus: combined(status),
  };
}
