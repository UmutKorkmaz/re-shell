import * as fs from 'fs';
import * as path from 'path';
import { spawn as nodeSpawn, type SpawnOptions } from 'child_process';
import type { IntentCandidate } from '../utils/ai-intent';
import type { VetResult } from './argv-guard';

/**
 * Preview -> confirm -> execute for `ai --run`.
 *
 * This is the safety gate for BOTH the offline and the LLM paths:
 *
 *  1. The candidate argv is vetted AGAIN immediately before it can run
 *     ({@link RunDeps.vet}) — even though resolution already vetted it — so
 *     nothing that reached this point by any route (cache, session, provider)
 *     can execute unless it is still a real catalogue command with shell-inert
 *     values.
 *  2. The exact command and where it came from are shown, with a destructive
 *     warning, and an explicit interactive "yes" is required (default no).
 *  3. The command is spawned with `shell: false`, argv element by element.
 */

/** Injectable collaborators (tests). */
export interface RunDeps {
  /** Ask the user to confirm. Resolves `true` only on an explicit yes. */
  confirm: (message: string) => Promise<boolean>;
  /** Re-vet an argv; must reject anything not in the live catalogue / allow-list. */
  vet: (argv: string[]) => VetResult;
  /** Print a line to the user. */
  print: (line: string) => void;
  /** Process spawner. Defaults to `child_process.spawn`. */
  spawn?: (command: string, args: string[], options: SpawnOptions) => ReturnType<typeof nodeSpawn>;
  /** How to invoke re-shell. Defaults to {@link resolveSelfCommand}. */
  self?: SelfCommand;
}

/** How to launch the CLI. */
export interface SelfCommand {
  command: string;
  prefixArgs: string[];
}

/** Provenance shown next to the command. */
export interface RunProvenance {
  /** offline | llm | cache | clarification */
  source: string;
  provider: string;
  model?: string;
}

/** Outcome of {@link confirmAndRun}. */
export type RunOutcome =
  | { executed: true; exitCode: number }
  | { executed: false; reason: 'declined' | 'rejected' | 'spawn-failed'; message?: string };

/**
 * Locate the currently running re-shell CLI so `--run` re-invokes the SAME
 * build rather than whatever `re-shell` happens to be first on PATH. The entry
 * is trusted only when it resolves to a file inside a `@re-shell/cli` package;
 * otherwise this falls back to the `re-shell` binary on PATH.
 *
 * @param entry - Candidate entry script (defaults to `process.argv[1]`).
 * @returns The command and its fixed prefix arguments.
 */
export function resolveSelfCommand(entry: string | undefined = process.argv[1]): SelfCommand {
  const fallback: SelfCommand = { command: 're-shell', prefixArgs: [] };
  if (!entry) return fallback;
  try {
    const real = fs.realpathSync(entry);
    let dir = path.dirname(real);
    for (let i = 0; i < 3; i++) {
      const pkgFile = path.join(dir, 'package.json');
      if (fs.existsSync(pkgFile)) {
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) as { name?: string };
        return pkg.name === '@re-shell/cli'
          ? { command: process.execPath, prefixArgs: [real] }
          : fallback;
      }
      dir = path.dirname(dir);
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * Preview a candidate, ask for confirmation, then run it.
 *
 * @param candidate - The resolved candidate.
 * @param provenance - Where the candidate came from.
 * @param deps - Confirmation, vetting, output and spawning.
 * @returns Whether it ran (and its exit code) or why it did not.
 */
export async function confirmAndRun(
  candidate: IntentCandidate,
  provenance: RunProvenance,
  deps: RunDeps
): Promise<RunOutcome> {
  const vetted = deps.vet(candidate.argv);
  if (vetted.ok === false) {
    const message = `Refusing to run: ${vetted.message}.`;
    deps.print(message);
    return { executed: false, reason: 'rejected', message };
  }

  const via =
    provenance.source === 'llm'
      ? `${provenance.provider}${provenance.model ? ` (${provenance.model})` : ''}`
      : provenance.source;
  deps.print(`About to run: re-shell ${vetted.argv.join(' ')}`);
  deps.print(`Resolved by: ${via}`);
  if (candidate.destructive || vetted.entry.destructive) {
    deps.print('WARNING: this command is marked destructive and may cause data loss.');
  }

  const confirmed = await deps.confirm(`Run \`re-shell ${vetted.argv.join(' ')}\`?`);
  if (!confirmed) {
    deps.print('Aborted. Nothing was executed.');
    return { executed: false, reason: 'declined' };
  }

  const self = deps.self ?? resolveSelfCommand();
  const doSpawn = deps.spawn ?? nodeSpawn;
  return new Promise<RunOutcome>(resolve => {
    const child = doSpawn(self.command, [...self.prefixArgs, ...vetted.argv], {
      stdio: 'inherit',
      shell: false,
    });
    child.on('error', err => {
      resolve({ executed: false, reason: 'spawn-failed', message: err.message });
    });
    child.on('close', code => resolve({ executed: true, exitCode: code ?? 0 }));
  });
}
