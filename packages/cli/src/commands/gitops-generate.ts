import chalk from 'chalk';

import {
  generateGitOps,
  type GenerateGitOpsResult,
  type GitOpsTool,
} from '../utils/gitops-generate';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

/**
 * Options accepted by {@link runGitOpsGenerate}.
 *
 * Mirrors the flags of the `k8s gitops generate` CLI command. All fields are
 * optional; sensible defaults are applied by the underlying generator.
 */
export interface GitOpsGenerateCommandOptions {
  /** GitOps tool to target (`"argocd"` or `"flux"`). */
  tool?: string;
  /** Output directory to write rendered manifests into. When omitted (or with `dryRun`) nothing is written. */
  out?: string;
  /** Kubernetes namespace the deployed app should run in. */
  namespace?: string;
  /** Git repository URL the GitOps tool reconciles manifests from. */
  repoUrl?: string;
  /** Git revision/branch the GitOps tool should track. */
  revision?: string;
  /** Path within the repository that points at the chart or raw manifests. */
  chartPath?: string;
  /** When `true`, emit a machine-readable JSON envelope instead of human-friendly output. */
  json?: boolean;
  /** When `true`, compute and report manifests without writing any files to disk. */
  dryRun?: boolean;
  /** Working directory used to discover the workspace v2 config (defaults to `process.cwd()`). */
  cwd?: string;
  /** Explicit path to a `workspace.yaml`; overrides `cwd`-based discovery. */
  configPath?: string;
  /** Optional progress spinner to stop before printing results. */
  spinner?: ProgressSpinner;
}

function normalizeTool(tool: string | undefined): GitOpsTool {
  if (tool === 'argocd' || tool === 'flux') return tool;
  throw new Error(`Unknown GitOps tool "${tool ?? ''}" (expected argocd|flux)`);
}

/**
 * Run the `k8s gitops generate --tool argocd|flux` command.
 *
 * Reads the workspace v2 config and emits GitOps manifests (an ArgoCD
 * `Application`, or a Flux `GitRepository` + `Kustomization`) plus an `Ingress`
 * with cert-manager TLS annotations. In `--json`/`--dry-run` mode nothing is
 * written; the ok envelope carries `{ tool, manifests, written }`. With `--out`
 * (and not dry-run) manifests are written to disk. Errors map to a
 * `GITOPS_GENERATE_ERROR` envelope (exit 1).
 *
 * @param options - Command-line options (see {@link GitOpsGenerateCommandOptions}). Defaults to `{}`.
 * @returns Resolves once generation (and any disk writes / JSON output) has completed. The promise never rejects — failures are surfaced via `process.exitCode` or a JSON error envelope.
 */
export async function runGitOpsGenerate(
  options: GitOpsGenerateCommandOptions = {}
): Promise<void> {
  const generate = (): GenerateGitOpsResult =>
    generateGitOps({
      tool: normalizeTool(options.tool),
      cwd: options.cwd,
      configPath: options.configPath,
      namespace: options.namespace,
      repoUrl: options.repoUrl,
      revision: options.revision,
      chartPath: options.chartPath,
      out: options.out,
      dryRun: options.dryRun,
    });

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = generate();
      ok({
        tool: result.tool,
        manifests: result.manifests,
        written: result.written,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown gitops generate error';
      fail('GITOPS_GENERATE_ERROR', message);
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();

  try {
    const result = generate();
    displayResult(result, Boolean(options.dryRun));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown gitops generate error';
    console.error(chalk.red(`GitOps generate failed: ${message}`));
    process.exitCode = 1;
  }
}

function displayResult(result: GenerateGitOpsResult, dryRun: boolean): void {
  console.log(chalk.cyan(`\n🔄 GitOps generation (${result.tool})`));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`Manifests: ${chalk.bold(result.manifests.length)}`);
  for (const manifest of result.manifests) {
    console.log(`  ${chalk.green('•')} ${manifest.kind}/${manifest.name}`);
  }

  if (dryRun) {
    console.log(chalk.yellow('\nDry-run: no files written.'));
  } else if (result.written.length > 0) {
    console.log(chalk.green(`\nWrote ${result.written.length} file(s).`));
  } else {
    console.log(chalk.yellow('\nNo --out directory provided; nothing written.'));
  }
}
