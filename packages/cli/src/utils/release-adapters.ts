// Per-registry publish adapters.
//
// Maps a release plan entry to the argv that publishes it, and runs that argv
// through an INJECTABLE executor so tests and the dry-run path never touch the
// network. The executor receives (cmd, args, cwd) and resolves with an exit
// code; the real executor (built by the command layer) uses `execFile` with an
// argv array (no shell interpolation) so package names can never be interpreted
// by a shell.

import type { ReleasePlanEntry } from './release-engine';

/** Runs a publish command and resolves with its exit code. Injectable. */
export type PublishExecutor = (
  cmd: string,
  args: string[],
  cwd: string
) => Promise<number>;

/** Build the publish argv for an entry's target registry. */
export function buildPublishCommand(entry: ReleasePlanEntry): {
  cmd: string;
  args: string[];
} {
  switch (entry.registry) {
    case 'npm':
      return { cmd: 'npm', args: ['publish', '--access', 'public'] };
    case 'crates.io':
      return { cmd: 'cargo', args: ['publish'] };
    case 'pypi':
      return { cmd: 'python', args: ['-m', 'twine', 'upload', 'dist/*'] };
    case 'maven':
      return { cmd: 'mvn', args: ['-B', 'deploy'] };
    case 'nuget':
      return { cmd: 'dotnet', args: ['nuget', 'push'] };
    case 'rubygems':
      return { cmd: 'gem', args: ['push'] };
    default:
      throw new Error(`no publish adapter for registry "${entry.registry}"`);
  }
}

/** Outcome of attempting to publish a single unit. */
export interface PublishOutcome {
  /** True only when the unit was actually published (exit 0). */
  readonly published: boolean;
  /** Set when the publish was skipped or failed, explaining why. */
  readonly warning?: string;
}

/**
 * Publish one entry through the injectable executor. In dry-run nothing runs and
 * `published` is false. Otherwise the executor is invoked once: exit 0 →
 * published, any other code (or a thrown executor error) → not published, with a
 * warning. Errors are surfaced as warnings rather than thrown so one failed
 * publish never aborts the whole release plan.
 */
export async function execPublish(
  entry: ReleasePlanEntry,
  executor: PublishExecutor,
  dryRun: boolean
): Promise<PublishOutcome> {
  if (dryRun) {
    return { published: false };
  }

  let command: { cmd: string; args: string[] };
  try {
    command = buildPublishCommand(entry);
  } catch (error) {
    return {
      published: false,
      warning: `publish skipped for "${entry.name}": ${messageOf(error)}`,
    };
  }

  try {
    const code = await executor(command.cmd, command.args, entry.path);
    if (code === 0) {
      return { published: true };
    }
    return {
      published: false,
      warning: `publish failed for "${entry.name}" (${command.cmd} exited ${code})`,
    };
  } catch (error) {
    return {
      published: false,
      warning: `publish errored for "${entry.name}": ${messageOf(error)}`,
    };
  }
}

/** Extract a human message from an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
