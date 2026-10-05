import chalk from 'chalk';

import { enableJsonMode, fail, ok, type ErrorCode } from '../utils/json-output';
import { RefactorError, renameService, type RenameServiceResult } from '../refactor/engine';

export interface RenameServiceCommandOptions {
  oldName: string;
  newName: string;
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
  cwd?: string;
  configPath?: string;
}

function colorDiff(diff: string): string {
  return diff
    .split('\n')
    .map(line => {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) return chalk.bold(line);
      if (line.startsWith('rename ') || line.startsWith('similarity ')) return chalk.cyan(line);
      if (line.startsWith('@@')) return chalk.cyan(line);
      if (line.startsWith('+')) return chalk.green(line);
      if (line.startsWith('-')) return chalk.red(line);
      return line;
    })
    .join('\n');
}

function render(result: RenameServiceResult): void {
  const verb = result.applied ? 'Renamed' : 'Would rename';
  console.log(chalk.cyan(`\n${verb} service ${chalk.bold(result.old)} -> ${chalk.bold(result.new)}`));
  console.log(chalk.gray(`workspace: ${result.root}`));
  if (result.dryRun) console.log(chalk.yellow('Dry run: no files were changed.\n'));
  if (result.diff) console.log(colorDiff(result.diff));
  console.log(
    `\n${result.files.length} file(s) changed, ${result.moves.length} move(s)` +
      (result.applied && result.git.moved !== 'none' ? ` (${result.git.moved})` : '')
  );
  if (result.residualReferences.length > 0) {
    console.log(chalk.yellow(`\nRemaining mentions of "${result.old}" (not rewritten):`));
    for (const r of result.residualReferences.slice(0, 20)) console.log(`  ${r.path}:${r.line}  ${chalk.gray(r.text)}`);
    if (result.residualReferences.length > 20) console.log(chalk.gray(`  ... ${result.residualReferences.length - 20} more`));
  }
  for (const w of result.warnings) console.log(chalk.yellow(`warning: ${w}`));
}

/**
 * `re-shell refactor rename-service <old> <new>`. Expected failures become
 * `ok:false` envelopes (JSON) or a non-zero exit with a message.
 */
export async function runRenameService(options: RenameServiceCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    const result = renameService({
      cwd: options.cwd,
      configPath: options.configPath,
      oldName: options.oldName,
      newName: options.newName,
      dryRun: options.dryRun,
      force: options.force,
    });
    if (options.json) {
      const { warnings, ...data } = result;
      ok({ ...data, warnings }, warnings);
    } else {
      render(result);
    }
  } catch (err) {
    const code: ErrorCode = err instanceof RefactorError ? err.code : 'REFACTOR_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof RefactorError ? err.details : undefined;
    if (options.json) fail(code, message, details);
    else {
      console.error(chalk.red(`refactor rename-service failed [${code}]: ${message}`));
      process.exitCode = 1;
    }
  } finally {
    restore();
  }
}
