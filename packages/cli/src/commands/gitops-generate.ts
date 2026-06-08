import chalk from 'chalk';

import {
  generateGitOps,
  type GenerateGitOpsResult,
  type GitOpsTool,
} from '../utils/gitops-generate';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

export interface GitOpsGenerateCommandOptions {
  tool?: string;
  out?: string;
  namespace?: string;
  repoUrl?: string;
  revision?: string;
  chartPath?: string;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  spinner?: ProgressSpinner;
}

function normalizeTool(tool: string | undefined): GitOpsTool {
  if (tool === 'argocd' || tool === 'flux') return tool;
  throw new Error(`Unknown GitOps tool "${tool ?? ''}" (expected argocd|flux)`);
}

/**
 * `k8s gitops generate --tool argocd|flux` — read the workspace v2 config and
 * emit GitOps manifests (ArgoCD Application or Flux GitRepository+Kustomization)
 * plus an Ingress with cert-manager TLS. In `--json`/`--dry-run` mode nothing is
 * written; the ok envelope carries `{ tool, manifests, written }`. With `--out`
 * (and not dry-run) manifests are written to disk. Errors map to a
 * `GITOPS_GENERATE_ERROR` envelope (exit 1).
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
