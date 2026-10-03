import chalk from 'chalk';
import type { K8sOperatorResponse, K8sToolCheck } from '@re-shell/contracts';

import {
  generateOperator,
  verifyOperatorBuild,
  type GenerateOperatorResult,
} from '../utils/k8s-operator';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

/**
 * Options accepted by the workspace-driven `k8s operator` command.
 */
export interface K8sOperatorCommandOptions {
  /** Output directory; nothing is written without it. */
  out?: string;
  /** Go module path (default `<group>/operator`). */
  module?: string;
  /** Operator container image referenced by the generated manager Deployment. */
  image?: string;
  /** API group of the reconciled CRD. */
  group?: string;
  /** API version of the reconciled CRD. */
  version?: string;
  /** Namespace of the generated sample CR. */
  namespace?: string;
  /** Run the real `go mod tidy && go build ./... && go vet ./...` on the written scaffold. */
  verify?: boolean;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  spinner?: ProgressSpinner;
}

class OperatorCommandError extends Error {}

function run(options: K8sOperatorCommandOptions): {
  result: GenerateOperatorResult;
  build: K8sToolCheck;
} {
  if (options.verify && (!options.out || options.dryRun)) {
    throw new OperatorCommandError(
      '--verify builds the written scaffold: pass --out <dir> and do not use --dry-run'
    );
  }
  const result = generateOperator({
    cwd: options.cwd,
    configPath: options.configPath,
    module: options.module,
    image: options.image,
    group: options.group,
    version: options.version,
    namespace: options.namespace,
    out: options.out,
    dryRun: options.dryRun,
  });

  let build: K8sToolCheck = { ran: false, detail: 'not requested (use --verify)' };
  if (options.verify && options.out) {
    build = verifyOperatorBuild(options.out);
    if (!build.ran) {
      throw new OperatorCommandError(`--verify requested but go could not run: ${build.detail}`);
    }
    if (!build.ok) {
      throw new OperatorCommandError(`Generated operator failed to build: ${build.detail}`);
    }
  }
  return { result, build };
}

/**
 * `k8s operator` — generate a Go (controller-runtime) operator scaffold that
 * reconciles the ReShellWorkspace CRD into per-service Deployments, Services
 * and PodDisruptionBudgets, together with the CRD, RBAC and a manager
 * Deployment. With `--verify` the scaffold is built for real
 * (`go mod tidy && go build ./... && go vet ./...`); a missing Go toolchain or a
 * failing build is an error, never a silent skip.
 *
 * Errors map to a `K8S_OPERATOR_ERROR` envelope (exit 1).
 *
 * @param options - Command options.
 */
export async function runK8sOperator(options: K8sOperatorCommandOptions = {}): Promise<void> {
  if (options.json) {
    const restore = enableJsonMode();
    try {
      const { result, build } = run(options);
      const payload: K8sOperatorResponse = {
        module: result.module,
        crd: result.identity,
        files: result.files.map(f => ({ path: f.path, bytes: Buffer.byteLength(f.content) })),
        written: result.written,
        build,
      };
      ok(payload, result.warnings);
    } catch (error: unknown) {
      fail('K8S_OPERATOR_ERROR', error instanceof Error ? error.message : 'Unknown k8s operator error');
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();
  try {
    const { result, build } = run(options);
    console.log(chalk.cyan('\n🔧 ReShellWorkspace operator'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`Module: ${chalk.bold(result.module)}  CRD: ${result.identity.name}`);
    for (const file of result.files) console.log(`  ${chalk.green('•')} ${file.path}`);
    if (options.dryRun) console.log(chalk.yellow('\nDry-run: no files written.'));
    else if (result.written.length > 0) {
      console.log(chalk.green(`\nWrote ${result.written.length} file(s).`));
    } else console.log(chalk.yellow('\nNo --out directory provided; nothing written.'));
    if (build.ran) console.log(chalk.green(`\n✓ go build: ok (${build.detail ?? ''})`));
    for (const warning of result.warnings) console.log(chalk.yellow(`warning: ${warning}`));
  } catch (error: unknown) {
    console.error(
      chalk.red(
        `K8s operator failed: ${error instanceof Error ? error.message : 'Unknown k8s operator error'}`
      )
    );
    process.exitCode = 1;
  }
}
