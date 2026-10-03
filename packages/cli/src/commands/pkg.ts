import * as path from 'path';
import chalk from 'chalk';

import { enableJsonMode, fail, ok, type ErrorCode } from '../utils/json-output';
import { loadWorkspace, WorkspaceLoadError } from '../platform/workspace';
import { runPkgOperation, type PkgRunResult } from '../pkg/engine';
import type { Executor } from '../pkg/exec';
import { PkgError, type Ecosystem, type PkgOperation } from '../pkg/types';

/** Options accepted by every `re-shell pkg <operation>` subcommand. */
export interface PkgCommandOptions {
  operation: PkgOperation;
  packages?: string[];
  /** Resolve the target directory from a workspace service. */
  service?: string;
  /** Explicit target directory. */
  path?: string;
  /** Override ecosystem detection. */
  ecosystem?: string;
  dev?: boolean;
  dryRun?: boolean;
  json?: boolean;
  cwd?: string;
  /** Test seam: replaces the process executor. */
  executor?: Executor;
}

class TargetError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

/** Work out which directory the operation targets. */
export function resolveTarget(options: PkgCommandOptions): { dir: string; service: string | null } {
  const cwd = options.cwd ?? process.cwd();
  if (options.service && options.path) {
    throw new TargetError('PKG_INVALID_ARGS', '--service and --path are mutually exclusive');
  }
  if (options.service) {
    let ws;
    try {
      ws = loadWorkspace(cwd);
    } catch (err) {
      if (err instanceof WorkspaceLoadError) {
        throw new TargetError(err.kind === 'not-found' ? 'WORKSPACE_NOT_FOUND' : 'SCHEMA_VALIDATION_ERROR', err.message);
      }
      throw err;
    }
    const svc = ws.services.find(s => s.name === options.service);
    if (!svc) {
      throw new TargetError(
        'PKG_INVALID_ARGS',
        `Unknown service "${options.service}". Available: ${ws.services.map(s => s.name).join(', ') || '(none)'}`,
        { available: ws.services.map(s => s.name) }
      );
    }
    return { dir: svc.dir, service: svc.name };
  }
  return { dir: path.resolve(cwd, options.path ?? '.'), service: null };
}

function formatTable(rows: string[][]): string {
  if (rows.length === 0) return '';
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
  return rows.map(r => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()).join('\n');
}

function render(result: PkgRunResult): void {
  const head = `${result.operation} (${result.ecosystem}) in ${result.dir}`;
  console.log(chalk.cyan(`\nre-shell pkg ${head}`));
  console.log(chalk.gray(`ecosystem detected by: ${result.detectedBy}`));
  if (result.operation === 'list') {
    if (result.dependencies.length === 0) {
      console.log('No dependencies declared.');
      return;
    }
    console.log(
      formatTable([
        ['NAME', 'REQUESTED', 'KIND', 'MANIFEST'],
        ...result.dependencies.map(d => [d.name, d.requested ?? '-', d.kind, d.manifest]),
      ])
    );
    return;
  }
  if (result.operation === 'outdated') {
    if (result.outdated.length === 0) {
      console.log(chalk.green('All dependencies are up to date.'));
      return;
    }
    console.log(
      formatTable([
        ['NAME', 'CURRENT', 'WANTED', 'LATEST', 'KIND'],
        ...result.outdated.map(o => [o.name, o.current ?? '-', o.wanted ?? '-', o.latest, o.kind ?? '-']),
      ])
    );
    return;
  }
  if (result.dryRun) {
    console.log(chalk.yellow('Dry run: nothing executed.'));
    for (const e of result.manifestEdits) {
      console.log(`  edit ${e.file}: ${e.action} ${e.entries.join(', ')}${e.changed ? '' : ' (no change)'}`);
    }
    for (const c of result.commands) console.log(`  $ ${c.argv.join(' ')}   (cwd ${c.cwd})`);
    return;
  }
  for (const e of result.manifestEdits) {
    console.log(chalk.gray(`edited ${e.file}: ${e.action} ${e.entries.join(', ')}${e.changed ? '' : ' (no change)'}`));
  }
  console.log(chalk.green(`✓ ${result.operation} completed (${result.commands.length} command(s))`));
}

/**
 * Entry point shared by every `re-shell pkg` subcommand. Never throws on
 * expected failures: they become `ok:false` envelopes (JSON) or a non-zero exit.
 */
export async function runPkg(options: PkgCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    const target = resolveTarget(options);
    const result = await runPkgOperation({
      operation: options.operation,
      packages: options.packages ?? [],
      dir: target.dir,
      service: target.service,
      ecosystem: options.ecosystem as Ecosystem | undefined,
      dev: options.dev,
      dryRun: options.dryRun,
      stream: !options.json && options.operation !== 'list' && options.operation !== 'outdated',
      executor: options.executor,
    });
    if (options.json) {
      const { warnings, ...data } = result;
      ok(data, warnings);
    } else {
      render(result);
    }
  } catch (err) {
    const code: ErrorCode =
      err instanceof PkgError || err instanceof TargetError ? err.code : 'PKG_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof PkgError || err instanceof TargetError ? err.details : undefined;
    if (options.json) {
      fail(code, message, details);
    } else {
      console.error(chalk.red(`pkg ${options.operation} failed [${code}]: ${message}`));
      if (details && typeof details.stderr === 'string' && details.stderr) {
        console.error(chalk.gray(String(details.stderr).trimEnd()));
      }
      process.exitCode = 1;
    }
  } finally {
    restore();
  }
}
