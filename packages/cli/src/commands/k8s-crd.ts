import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import type { K8sCrdResponse, K8sToolCheck } from '@re-shell/contracts';

import { generateCrd, type GenerateCrdResult } from '../utils/k8s-crd';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

/**
 * Options accepted by the workspace-driven `k8s crd` command.
 */
export interface K8sCrdCommandOptions {
  /** Output directory; nothing is written without it. */
  out?: string;
  /** Namespace of the generated sample CR. */
  namespace?: string;
  /** API group of the CRD (default `re-shell.io`). */
  group?: string;
  /** API version of the CRD (default `v1alpha1`). */
  version?: string;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  spinner?: ProgressSpinner;
}

/** Heuristic: kubectl could not reach an API server. */
function isClusterUnreachable(text: string): boolean {
  return /connection refused|couldn't get current server API group list|Unable to connect to the server|dial tcp|no such host|i\/o timeout/i.test(
    text
  );
}

/**
 * Validate the CRD with `kubectl apply --dry-run=server`: a real API server
 * checks the structural schema and the CEL rules. Reported as not-run (never
 * thrown) when kubectl is missing or no cluster is reachable.
 */
export function validateCrdWithKubectl(crdYaml: string): K8sToolCheck {
  const probe = spawnSync('kubectl', ['version', '--client'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    return { ran: false, detail: 'kubectl not found on PATH' };
  }
  const result = spawnSync(
    'kubectl',
    ['apply', '--dry-run=server', '--request-timeout=15s', '-f', '-'],
    { input: crdYaml, encoding: 'utf8' }
  );
  if (result.error) {
    return { ran: false, detail: `kubectl failed to execute: ${result.error.message}` };
  }
  const stderr = (result.stderr ?? '').trim();
  if (result.status !== 0 && isClusterUnreachable(stderr)) {
    return { ran: false, detail: 'kubectl present but no cluster reachable' };
  }
  const passed = result.status === 0;
  return { ran: true, ok: passed, detail: (passed ? result.stdout : stderr || result.stdout).trim() };
}

function toPayload(result: GenerateCrdResult, written: string[], kubectl: K8sToolCheck): K8sCrdResponse {
  return {
    crd: result.identity,
    manifests: result.files.map(f => ({ kind: f.kind, name: f.name, path: f.path, yaml: f.yaml })),
    written,
    kubectl,
  };
}

function writeFiles(result: GenerateCrdResult, out: string): string[] {
  const written: string[] = [];
  for (const file of result.files) {
    const target = path.join(out, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.yaml);
    written.push(target);
  }
  return written;
}

/**
 * `k8s crd` — generate the ReShellWorkspace CustomResourceDefinition (its
 * `spec` schema derived from workspace-v2.schema.json, translated to a
 * structural schema) plus a sample custom resource built from the workspace.
 *
 * In `--json`/`--dry-run` mode nothing is written. Errors map to a
 * `K8S_CRD_ERROR` envelope (exit 1).
 *
 * @param options - Command options.
 */
export async function runK8sCrd(options: K8sCrdCommandOptions = {}): Promise<void> {
  const shouldWrite = Boolean(options.out) && options.dryRun !== true;
  const run = (): { result: GenerateCrdResult; written: string[]; kubectl: K8sToolCheck } => {
    const result = generateCrd({
      cwd: options.cwd,
      configPath: options.configPath,
      namespace: options.namespace,
      group: options.group,
      version: options.version,
    });
    const written = shouldWrite && options.out ? writeFiles(result, options.out) : [];
    const crdFile = result.files.find(f => f.kind === 'CustomResourceDefinition');
    const kubectl = crdFile
      ? validateCrdWithKubectl(crdFile.yaml)
      : { ran: false, detail: 'no CRD generated' };
    return { result, written, kubectl };
  };

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const { result, written, kubectl } = run();
      const warnings = [...result.warnings];
      if (!kubectl.ran) warnings.push(`kubectl not run: ${kubectl.detail ?? 'unavailable'}`);
      else if (kubectl.ok === false) {
        warnings.push(`kubectl server dry-run reported issues: ${kubectl.detail ?? ''}`.trim());
      }
      ok(toPayload(result, written, kubectl), warnings);
    } catch (error: unknown) {
      fail('K8S_CRD_ERROR', error instanceof Error ? error.message : 'Unknown k8s crd error');
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();
  try {
    const { result, written, kubectl } = run();
    console.log(chalk.cyan('\n📋 ReShellWorkspace CRD'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`CRD:    ${chalk.bold(result.identity.name)} (${result.identity.version})`);
    for (const file of result.files) console.log(`  ${chalk.green('•')} ${file.kind}/${file.name}`);
    if (options.dryRun) console.log(chalk.yellow('\nDry-run: no files written.'));
    else if (written.length > 0) {
      console.log(chalk.green(`\nWrote ${written.length} file(s):`));
      for (const file of written) console.log(`  ${chalk.gray(file)}`);
    } else console.log(chalk.yellow('\nNo --out directory provided; nothing written.'));
    if (kubectl.ran) {
      console.log(
        `\n${kubectl.ok ? chalk.green('✓') : chalk.red('✖')} kubectl apply --dry-run=server: ${kubectl.ok ? 'ok' : 'issues'}`
      );
      if (!kubectl.ok && kubectl.detail) console.log(chalk.gray(kubectl.detail));
    } else {
      console.log(chalk.gray(`\nkubectl not run: ${kubectl.detail ?? 'unavailable'}`));
    }
    for (const warning of result.warnings) console.log(chalk.yellow(`warning: ${warning}`));
  } catch (error: unknown) {
    console.error(
      chalk.red(`K8s crd failed: ${error instanceof Error ? error.message : 'Unknown k8s crd error'}`)
    );
    process.exitCode = 1;
  }
}
