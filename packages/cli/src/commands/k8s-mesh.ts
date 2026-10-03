import chalk from 'chalk';
import type { K8sMeshResponse } from '@re-shell/contracts';

import { generateMesh, type GenerateMeshResult, type MeshKind } from '../utils/k8s-mesh';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

/**
 * Options accepted by the workspace-driven `k8s mesh` command.
 */
export interface K8sMeshCommandOptions {
  /** `istio` (default) or `linkerd`. */
  mesh?: string;
  /** Namespace the workloads run in (default `default`). */
  namespace?: string;
  /** Enforce mTLS (default true; `--no-mtls` sets false). */
  mtls?: boolean;
  /** Generate per-service traffic management (default true; `--no-traffic-management` sets false). */
  trafficManagement?: boolean;
  /** Comma-separated `name` / `name:port` filter. */
  services?: string;
  /** Output directory; nothing is written without it. */
  out?: string;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  spinner?: ProgressSpinner;
}

function normalizeMesh(mesh: string | undefined): MeshKind {
  if (mesh === undefined) return 'istio';
  if (mesh === 'istio' || mesh === 'linkerd') return mesh;
  throw new Error(`Unknown mesh "${mesh}" (expected istio|linkerd)`);
}

function toPayload(result: GenerateMeshResult): K8sMeshResponse {
  return {
    mesh: result.mesh,
    namespace: result.namespace,
    mtls: result.mtls,
    trafficManagement: result.trafficManagement,
    manifests: result.manifests,
    docs: result.docs,
    written: result.written,
  };
}

/**
 * `k8s mesh` — generate service-mesh resources from the workspace v2 config:
 * Istio (namespace injection label, PeerAuthentication, DestinationRule,
 * VirtualService) or Linkerd (namespace inject annotation, ServiceProfile), plus
 * a README covering sidecar injection and multi-cluster setup.
 *
 * Errors map to a `K8S_MESH_ERROR` envelope (exit 1).
 *
 * @param options - Command options.
 */
export async function runK8sMesh(options: K8sMeshCommandOptions = {}): Promise<void> {
  const generate = (): GenerateMeshResult =>
    generateMesh({
      mesh: normalizeMesh(options.mesh),
      cwd: options.cwd,
      configPath: options.configPath,
      namespace: options.namespace,
      mtls: options.mtls,
      trafficManagement: options.trafficManagement,
      services: options.services
        ? options.services
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : undefined,
      out: options.out,
      dryRun: options.dryRun,
    });

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = generate();
      ok(toPayload(result), result.warnings);
    } catch (error: unknown) {
      fail('K8S_MESH_ERROR', error instanceof Error ? error.message : 'Unknown k8s mesh error');
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();
  try {
    const result = generate();
    console.log(chalk.cyan(`\n🕸️  Service mesh (${result.mesh})`));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`Namespace: ${chalk.bold(result.namespace)}  mTLS: ${result.mtls}  traffic management: ${result.trafficManagement}`);
    for (const m of result.manifests) console.log(`  ${chalk.green('•')} ${m.kind}/${m.name}`);
    for (const d of result.docs) console.log(`  ${chalk.green('•')} ${d.path}`);
    if (options.dryRun) console.log(chalk.yellow('\nDry-run: no files written.'));
    else if (result.written.length > 0) {
      console.log(chalk.green(`\nWrote ${result.written.length} file(s):`));
      for (const file of result.written) console.log(`  ${chalk.gray(file)}`);
    } else console.log(chalk.yellow('\nNo --out directory provided; nothing written.'));
    for (const warning of result.warnings) console.log(chalk.yellow(`warning: ${warning}`));
  } catch (error: unknown) {
    console.error(
      chalk.red(`K8s mesh failed: ${error instanceof Error ? error.message : 'Unknown k8s mesh error'}`)
    );
    process.exitCode = 1;
  }
}
