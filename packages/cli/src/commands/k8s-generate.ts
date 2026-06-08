import { spawnSync } from 'child_process';
import chalk from 'chalk';

import {
  generateManifests,
  type GenerateManifestsResult,
  type RenderedManifest,
} from '../utils/k8s-generate';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

export interface K8sGenerateCommandOptions {
  out?: string;
  namespace?: string;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  spinner?: ProgressSpinner;
}

/**
 * Best-effort kubectl client-side validation outcome.
 *
 * `ran` is true only when kubectl actually validated the manifests. When
 * kubectl is absent, or present but no API server is reachable (sandbox/CI with
 * no cluster), `ran` is false and `detail` explains why — generation then falls
 * back to the structural js-yaml checks the tests assert on.
 */
export interface KubectlValidation {
  ran: boolean;
  ok?: boolean;
  /** Why kubectl was skipped, or kubectl's stdout/stderr when it ran. */
  detail?: string;
}

/** Heuristic: kubectl could not reach an API server (no live cluster). */
function isClusterUnreachable(stderr: string): boolean {
  return (
    /connection refused/i.test(stderr) ||
    /couldn't get current server API group list/i.test(stderr) ||
    /Unable to connect to the server/i.test(stderr) ||
    /dial tcp/i.test(stderr)
  );
}

/**
 * Detect kubectl and, if present and a cluster is reachable, validate the
 * combined manifest stream with `kubectl apply --dry-run=client`. The client
 * dry-run still maps kinds against the API server, so without a reachable
 * cluster it cannot run — that case is reported as not-run (best-effort), never
 * thrown, so generation stays usable offline.
 */
export function validateWithKubectl(manifests: RenderedManifest[]): KubectlValidation {
  const probe = spawnSync('kubectl', ['version', '--client', '-o', 'json'], {
    encoding: 'utf8',
  });
  if (probe.error || probe.status !== 0) {
    return { ran: false, detail: 'kubectl not found on PATH' };
  }

  const combined = manifests.map(m => m.yaml).join('---\n');
  const result = spawnSync(
    'kubectl',
    ['apply', '--dry-run=client', '-f', '-'],
    { input: combined, encoding: 'utf8' }
  );

  if (result.error) {
    return { ran: false, detail: `kubectl failed to execute: ${result.error.message}` };
  }

  const stderr = (result.stderr ?? '').trim();
  if (result.status !== 0 && isClusterUnreachable(stderr)) {
    return {
      ran: false,
      detail: 'kubectl present but no cluster reachable; validated structurally instead',
    };
  }

  const passed = result.status === 0;
  return {
    ran: true,
    ok: passed,
    detail: (passed ? result.stdout : stderr || result.stdout)?.trim(),
  };
}

/**
 * `k8s generate` — read the workspace v2 config and emit Kubernetes manifests
 * (Deployment, Service, HPA, NetworkPolicy) per service.
 *
 * In `--json`/`--dry-run` mode nothing is written; the ok envelope carries
 * `{ namespace, manifests: [{kind, name, yaml}], kubectl }`. With `--out` (and
 * not dry-run) the manifests are written to disk and the written paths are
 * reported. Errors map to a `K8S_GENERATE_ERROR` envelope (exit 1).
 */
export async function runK8sGenerate(
  options: K8sGenerateCommandOptions = {}
): Promise<void> {
  const generate = (): GenerateManifestsResult =>
    generateManifests({
      cwd: options.cwd,
      configPath: options.configPath,
      namespace: options.namespace,
      out: options.out,
      dryRun: options.dryRun,
    });

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = generate();
      const kubectl = validateWithKubectl(result.manifests);
      const warnings: string[] = [];
      if (!kubectl.ran) {
        warnings.push(`kubectl not run: ${kubectl.detail ?? 'unavailable'}`);
      } else if (kubectl.ok === false) {
        warnings.push(`kubectl dry-run reported issues: ${kubectl.detail ?? ''}`.trim());
      }
      ok(
        {
          namespace: result.namespace,
          manifests: result.manifests,
          written: result.written,
          kubectl,
        },
        warnings
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown k8s generate error';
      fail('K8S_GENERATE_ERROR', message);
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();

  try {
    const result = generate();
    const kubectl = validateWithKubectl(result.manifests);
    displayResult(result, kubectl, Boolean(options.dryRun));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown k8s generate error';
    console.error(chalk.red(`K8s generate failed: ${message}`));
    process.exitCode = 1;
  }
}

function displayResult(
  result: GenerateManifestsResult,
  kubectl: KubectlValidation,
  dryRun: boolean
): void {
  console.log(chalk.cyan('\n☸️  K8s manifest generation'));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`Namespace: ${chalk.bold(result.namespace)}`);
  console.log(`Manifests: ${chalk.bold(result.manifests.length)}`);

  for (const manifest of result.manifests) {
    console.log(`  ${chalk.green('•')} ${manifest.kind}/${manifest.name}`);
  }

  if (dryRun) {
    console.log(chalk.yellow('\nDry-run: no files written.'));
  } else if (result.written.length > 0) {
    console.log(chalk.green(`\nWrote ${result.written.length} file(s):`));
    for (const file of result.written) {
      console.log(`  ${chalk.gray(file)}`);
    }
  } else {
    console.log(chalk.yellow('\nNo --out directory provided; nothing written.'));
  }

  if (kubectl.ran) {
    const icon = kubectl.ok ? chalk.green('✓') : chalk.red('✖');
    console.log(`\n${icon} kubectl apply --dry-run=client: ${kubectl.ok ? 'ok' : 'issues'}`);
    if (!kubectl.ok && kubectl.detail) console.log(chalk.gray(kubectl.detail));
  } else {
    console.log(chalk.gray('\nkubectl not run (not installed); manifests validated structurally.'));
  }
}
