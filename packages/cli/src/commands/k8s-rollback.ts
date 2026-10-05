import chalk from 'chalk';
import type { K8sRollbackResponse } from '@re-shell/contracts';

import {
  RollbackError,
  rollbackService,
  type CommandRunner,
  type RollbackResult,
} from '../utils/k8s-rollback';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

/**
 * Options accepted by the `k8s rollback` command.
 */
export interface K8sRollbackCommandOptions {
  /** Deployment (workspace service) to roll back. */
  service: string;
  /** Kubernetes namespace (default "default"). */
  namespace?: string;
  /** Revision to return to; defaults to the previous revision. */
  toRevision?: string | number;
  /** Plan the rollback with the tool's own dry-run instead of applying it. */
  dryRun?: boolean;
  /** `auto` (default), `kubectl` or `helm`. */
  method?: string;
  /** Helm release name override. */
  release?: string;
  /** Seconds to wait for the rolled-back workload to become ready. */
  timeout?: string | number;
  /** kubeconfig context. */
  context?: string;
  /** Emit a machine-readable JSON envelope. */
  json?: boolean;
  /** Optional spinner stopped before output. */
  spinner?: ProgressSpinner;
  /** Injected runner (tests). */
  runner?: CommandRunner;
}

function positiveInt(value: string | number | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new RollbackError('INVALID_ARGUMENT', `${name} must be a positive integer (got "${value}")`);
  }
  return n;
}

function toPayload(result: RollbackResult): K8sRollbackResponse {
  const { warnings: _warnings, ...payload } = result;
  return payload;
}

/**
 * `k8s rollback <service>` — roll a service back with `kubectl rollout undo`,
 * or `helm rollback` when the Deployment was installed by Helm.
 *
 * The exit status is real: exit code 1 (and `ok:false` in JSON mode) whenever
 * the tool is missing, the cluster is unreachable, the service/revision does not
 * exist, the rollback command fails, or the workload does not become ready
 * again. `--dry-run` runs the tool's own dry-run and never changes the cluster.
 *
 * @param options - Command options.
 * @returns Resolves once the rollback finished and the outcome was reported.
 */
export async function runK8sRollback(options: K8sRollbackCommandOptions): Promise<void> {
  const execute = (): RollbackResult => {
    const method = options.method ?? 'auto';
    if (method !== 'auto' && method !== 'kubectl' && method !== 'helm') {
      throw new RollbackError(
        'INVALID_ARGUMENT',
        `--method must be auto, kubectl or helm (got "${method}")`
      );
    }
    return rollbackService({
      service: options.service,
      namespace: options.namespace,
      toRevision: positiveInt(options.toRevision, '--to-revision'),
      dryRun: options.dryRun,
      method,
      release: options.release,
      timeoutSeconds: positiveInt(options.timeout, '--timeout'),
      context: options.context,
      runner: options.runner,
    });
  };

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = execute();
      ok(toPayload(result), result.warnings);
    } catch (error: unknown) {
      emitFailure(error);
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();
  try {
    const result = execute();
    display(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown k8s rollback error';
    console.error(chalk.red(`K8s rollback failed: ${message}`));
    if (error instanceof RollbackError) {
      console.error(chalk.gray(`reason: ${error.reason}`));
    }
    process.exitCode = 1;
  }
}

function emitFailure(error: unknown): void {
  if (error instanceof RollbackError) {
    fail('K8S_ROLLBACK_ERROR', error.message, { reason: error.reason, ...error.details });
    return;
  }
  fail('K8S_ROLLBACK_ERROR', error instanceof Error ? error.message : 'Unknown k8s rollback error', {
    reason: 'COMMAND_FAILED',
  });
}

function display(result: RollbackResult): void {
  console.log(chalk.cyan('\n↩️  K8s rollback'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`Service:   ${chalk.bold(result.service)} (namespace ${result.namespace})`);
  console.log(
    `Method:    ${chalk.bold(result.method)}${result.release ? ` (release ${result.release})` : ''}`
  );
  console.log(`Revision:  ${result.fromRevision ?? '?'} -> ${chalk.bold(result.toRevision)}`);
  console.log(`Command:   ${chalk.gray(result.command.join(' '))}`);
  if (result.output) console.log(chalk.gray(result.output));
  for (const warning of result.warnings) console.log(chalk.yellow(`warning: ${warning}`));
  if (result.dryRun) {
    console.log(chalk.yellow('\nDry-run: the cluster was not changed.'));
  } else if (result.rolledBack) {
    console.log(
      chalk.green(
        `\n✓ Rolled back; workload is ready (current revision ${result.currentRevision ?? '?'}).`
      )
    );
  }
}
