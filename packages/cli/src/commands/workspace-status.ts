/**
 * `re-shell workspace status [--json]`: live running/stopped/unhealthy/unknown
 * status per workspace (see utils/workspace-status.ts for the rules).
 */

import chalk from 'chalk';
import type { WorkspaceLiveStatus, WorkspaceStatusReport } from '@re-shell/contracts';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import { GraphSourceError, requireMonorepoRoot } from '../utils/graph-source';
import { collectWorkspaceStatus } from '../utils/workspace-status';

export interface WorkspaceStatusCommandOptions {
  json?: boolean;
  allowRemoteProbes?: boolean;
  cwd?: string;
}

const COLORS: Record<WorkspaceLiveStatus, (s: string) => string> = {
  running: chalk.green,
  stopped: chalk.gray,
  unhealthy: chalk.red,
  unknown: chalk.yellow,
};

export function renderWorkspaceStatusText(report: WorkspaceStatusReport): string {
  const lines = [
    chalk.bold(`Workspace status (${report.checkedAt})`),
    chalk.gray(
      `  running ${report.summary.running}  stopped ${report.summary.stopped}  unhealthy ${report.summary.unhealthy}  unknown ${report.summary.unknown}`
    ),
    '',
  ];
  const width = Math.max(4, ...report.nodes.map((n) => n.name.length));
  for (const node of report.nodes) {
    lines.push(`${node.name.padEnd(width)}  ${COLORS[node.status](node.status.padEnd(9))} ${chalk.gray(node.reason)}`);
  }
  return lines.join('\n');
}

export async function runWorkspaceStatus(options: WorkspaceStatusCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    const root = await requireMonorepoRoot(options.cwd ?? process.cwd());
    const report = await collectWorkspaceStatus(root, { allowRemoteProbes: options.allowRemoteProbes });
    if (options.json) {
      ok(report);
    } else {
      console.log(renderWorkspaceStatusText(report));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      fail(error instanceof GraphSourceError && error.code === 'NOT_IN_MONOREPO' ? 'NOT_IN_MONOREPO' : 'WORKSPACE_STATUS_ERROR', message);
    } else {
      console.error(chalk.red(`Error: ${message}`));
      process.exitCode = 1;
    }
  } finally {
    restore();
  }
}
