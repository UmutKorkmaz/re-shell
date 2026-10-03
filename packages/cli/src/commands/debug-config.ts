import chalk from 'chalk';

import { enableJsonMode, fail, ok, type ErrorCode } from '../utils/json-output';
import { DebugConfigError, generateDebugConfig, type DebugConfigResult } from '../debug/engine';

export interface DebugConfigCommandOptions {
  services?: string;
  out?: string;
  dryRun?: boolean;
  json?: boolean;
  compose?: boolean;
  composeOut?: string;
  cwd?: string;
  configPath?: string;
}

function render(result: DebugConfigResult): void {
  console.log(chalk.cyan(`\nre-shell debug config -> ${result.out}`));
  if (result.dryRun) console.log(chalk.yellow('Dry run: nothing written.'));
  for (const s of result.services) {
    const port = s.debugPort === null ? 'pipe' : String(s.debugPort);
    console.log(
      `  ${chalk.bold(s.name.padEnd(14))} ${s.debugKind.padEnd(7)} port ${port.padEnd(6)} ${s.inCompose ? chalk.gray('[compose] ') : ''}${s.configurations.join(', ')}`
    );
  }
  for (const s of result.skipped) console.log(chalk.gray(`  skipped ${s.name}: ${s.reason}`));
  if (result.compound) console.log(`  compound: ${chalk.bold(result.compound.name)}`);
  const l = result.launch;
  console.log(
    `launch.json: ${l.created ? 'created' : 'merged'} (added ${l.added.length}, updated ${l.updated.length}, unchanged ${l.unchanged.length}, user entries preserved ${l.preserved})`
  );
  if (result.dryRun) console.log('\n' + l.content);
  if (result.compose) {
    console.log(`compose override: ${result.compose.path}${result.compose.written ? '' : chalk.yellow(' (not written)')}`);
    if (result.dryRun) console.log('\n' + result.compose.content);
  }
  for (const n of result.notes) console.log(chalk.gray(`note: ${n}`));
  for (const w of result.warnings) console.log(chalk.yellow(`warning: ${w}`));
}

/** `re-shell debug config`. Expected failures become `ok:false` envelopes or a non-zero exit. */
export async function runDebugConfig(options: DebugConfigCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    const result = generateDebugConfig({
      cwd: options.cwd,
      configPath: options.configPath,
      services: options.services ? options.services.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      out: options.out,
      dryRun: options.dryRun,
      noCompose: options.compose === false,
      composeOut: options.composeOut,
    });
    if (options.json) ok(result, result.warnings);
    else render(result);
  } catch (err) {
    const code: ErrorCode = err instanceof DebugConfigError ? err.code : 'DEBUG_CONFIG_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof DebugConfigError ? err.details : undefined;
    if (options.json) fail(code, message, details);
    else {
      console.error(chalk.red(`debug config failed [${code}]: ${message}`));
      process.exitCode = 1;
    }
  } finally {
    restore();
  }
}
