import type { Command, CommanderError } from 'commander';
import { armJsonContract, enableJsonMode, fail, settleJsonContract } from './json-output';

/**
 * Whether the command about to run was invoked with `--json`.
 *
 * Only a boolean flag counts: a command that happens to declare a value-taking
 * `--json <file>` option is not asking for the machine-readable envelope.
 *
 * @param command - The leaf command whose action is about to run.
 * @returns `true` when the command declares `--json` and it was passed.
 */
export function commandRequestsJson(command: Command): boolean {
  const opts = command.opts() as Record<string, unknown>;
  return opts.json === true;
}

/**
 * Make `--json` hygiene a property of the command tree instead of a per-command
 * opt-in.
 *
 * For every command that declares `--json` and was invoked with it, this hook
 * (registered once on the root program) will, around the action:
 *
 *  1. enable JSON mode, so any incidental stdout (spinners, banners, human text,
 *     `console.log`, third-party libraries) is redirected to stderr and stdout
 *     can only carry the envelope, and
 *  2. arm the single-envelope contract, so a command that ends (normally, via
 *     `process.exit`, or through an error) without emitting an envelope is
 *     turned into an explicit `COMMAND_ERROR` envelope with a non-zero exit
 *     code rather than empty stdout.
 *
 * Commands that call `enableJsonMode()` themselves keep working: it is
 * re-entrant, so their own call is a no-op inside this one.
 *
 * @param program - The root Commander program.
 */
export function installJsonModeHook(program: Command): void {
  const restores: Array<() => void> = [];

  program.hook('preAction', (_thisCommand, actionCommand) => {
    if (!commandRequestsJson(actionCommand)) {
      return;
    }
    armJsonContract();
    restores.push(enableJsonMode());
  });

  program.hook('postAction', (_thisCommand, actionCommand) => {
    if (!commandRequestsJson(actionCommand)) {
      return;
    }
    const restore = restores.pop();
    if (restore) {
      restore();
    }
    settleJsonContract();
  });
}

/**
 * Turn Commander's own parse failures (missing required option or argument,
 * unknown option, unknown command, invalid choice) into an error envelope when
 * the invocation asked for `--json`.
 *
 * These errors happen before any action runs, so the action hook above never
 * sees them: Commander used to print `error: ...` on stderr and exit 1 with
 * empty stdout. Now stdout carries
 * `{ ok: false, error: { code: "USAGE_ERROR", message } }` and the exit code is
 * still 1. Help and version output (exit code 0) are left alone.
 *
 * A no-op unless `--json` appears in `argv`, so ordinary invocations are
 * untouched.
 *
 * @param program - The root Commander program (every subcommand is covered).
 * @param argv - The invocation's argv. Defaults to `process.argv`.
 */
export function installJsonUsageErrors(
  program: Command,
  argv: readonly string[] = process.argv
): void {
  if (!argv.includes('--json')) {
    return;
  }

  const onExit = (error: CommanderError): void => {
    if (error.exitCode === 0) {
      return; // --help / --version: not a failure
    }
    fail('USAGE_ERROR', error.message.replace(/^error:\s*/i, ''), { commanderCode: error.code });
    // Returning lets Commander perform its own process.exit(exitCode), so the
    // exit code stays 1 and nothing else is printed to stdout.
  };

  const apply = (command: Command): void => {
    command.exitOverride(onExit);
    command.commands.forEach(apply);
  };
  apply(program);
}
