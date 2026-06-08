import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { createAsyncCommand, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import {
  createOfflineBackend,
  explainCandidate,
  IntentCandidate,
  IntentResult,
  OfflineIntentBackend,
} from '../utils/ai-intent';

/**
 * `ai <prompt...>` group: an OFFLINE, deterministic natural-language command
 * interface.
 *
 * Safety model (the whole point of this command):
 *  - It NEVER auto-executes. The default behaviour is to RESOLVE a prompt to a
 *    concrete `re-shell ...` command and print/return it.
 *  - With `--run` it requires explicit interactive confirmation AND the resolved
 *    command is the catalogue-vetted argv produced by the offline parser — there
 *    is no free-form shell string anywhere in the path.
 *  - Ambiguous / low-confidence prompts ask a clarifying question (or, in
 *    `--json`, return `{ needsClarification: true, candidates }`).
 *  - Injection text in the prompt is treated as DATA: the parser tokenises it
 *    and discards shell metacharacters, so it can never become a command.
 */
export function registerAiGroup(program: Command): void {
  program
    .command('ai')
    .description(
      'Resolve a natural-language prompt to a re-shell command (offline, never auto-runs)'
    )
    .argument('<prompt...>', 'Natural-language description of what you want to do')
    .option('--json', 'Output the resolved spec as JSON')
    .option('--explain', 'Include a human explanation of the resolved command')
    .option('--run', 'Execute the resolved command after explicit confirmation')
    .action(
      createAsyncCommand(async (promptParts: string[], options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner('Resolving intent...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          // The prompt is captured as data only; never interpolated into a shell.
          const prompt = Array.isArray(promptParts)
            ? promptParts.join(' ')
            : String(promptParts ?? '');

          const backend = createOfflineBackend(program);
          const result = backend.parse(prompt);

          if (spinner) spinner.stop();

          if (options.json) {
            emitJsonResult(result, backend, options.explain === true);
            return;
          }

          await renderHuman(result, backend, {
            explain: options.explain === true,
            run: options.run === true,
          });
        } catch (error) {
          if (spinner) spinner.stop();
          fail(
            'AI_INTENT_ERROR',
            `Error resolving intent: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          restoreJson();
        }
      })
    );
}

/**
 * Emit the JSON envelope for an intent result. On the clarify branch we return
 * `{ needsClarification: true, candidates }`; on resolution we return the spec
 * plus confidence (and, with --explain, the explanation). No execution.
 */
function emitJsonResult(
  result: IntentResult,
  backend: OfflineIntentBackend,
  explain: boolean
): void {
  if (result.needsClarification === true) {
    ok({
      needsClarification: true,
      reason: result.reason,
      question: result.question,
      candidates: result.candidates,
    });
    return;
  }

  const resolved = result;
  const entry = backend.entryFor(resolved.candidate.path);
  const explanation = explain
    ? entry
      ? explainCandidate(resolved.candidate, entry)
      : resolved.explanation
    : undefined;

  ok({
    needsClarification: false,
    resolved: resolved.candidate,
    confidence: resolved.candidate.confidence,
    alternatives: resolved.alternatives,
    ...(explain ? { explanation } : {}),
    // Always make the safety posture explicit in machine output.
    executed: false,
  });
}

interface RenderOptions {
  explain: boolean;
  run: boolean;
}

/** Human-facing rendering for the resolve / clarify branches. */
async function renderHuman(
  result: IntentResult,
  backend: OfflineIntentBackend,
  opts: RenderOptions
): Promise<void> {
  if (result.needsClarification === true) {
    console.log(chalk.yellow.bold('\n🤔 Need clarification\n'));
    console.log(chalk.gray(result.question) + '\n');
    if (result.candidates.length > 0) {
      printCandidateList(result.candidates);
    }
    console.log();
    // Clarification never executes, even with --run.
    return;
  }

  const resolved = result;
  const { candidate } = resolved;
  console.log(chalk.cyan.bold('\n🧠 Resolved command\n'));
  console.log(
    `  ${chalk.green('●')} ${chalk.bold('re-shell ' + candidate.argv.join(' '))}`
  );
  console.log(
    `    ${chalk.gray('confidence:')} ${formatConfidence(candidate.confidence)}`
  );
  if (candidate.description) {
    console.log(`    ${chalk.gray(candidate.description)}`);
  }

  if (opts.explain) {
    const entry = backend.entryFor(candidate.path);
    const explanation = entry
      ? explainCandidate(candidate, entry)
      : resolved.explanation;
    console.log(`\n${chalk.bold('Explanation:')}\n  ${chalk.gray(explanation)}`);
  }

  if (resolved.alternatives.length > 0) {
    console.log(`\n${chalk.bold('Alternatives:')}`);
    printCandidateList(resolved.alternatives);
  }

  if (!opts.run) {
    console.log(
      `\n${chalk.gray('Not executed. Re-run with')} ${chalk.bold('--run')} ${chalk.gray('to execute after confirmation.')}\n`
    );
    return;
  }

  await confirmAndRun(candidate);
}

function printCandidateList(candidates: IntentCandidate[]): void {
  for (const c of candidates) {
    const badge = c.destructive ? chalk.red(' [destructive]') : '';
    console.log(
      `  ${chalk.blue('-')} ${chalk.bold('re-shell ' + c.argv.join(' '))}${badge} ${chalk.gray('(' + formatConfidence(c.confidence) + ')')}`
    );
  }
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Confirm-then-run for `--run`. Requires an explicit interactive "yes". The
 * command is the parser's vetted argv; it is spawned WITHOUT a shell so even a
 * (hypothetically) odd token can never be re-interpreted as shell syntax.
 */
async function confirmAndRun(candidate: IntentCandidate): Promise<void> {
  if (candidate.destructive) {
    console.log(
      chalk.red.bold(
        '\n⚠ This command is marked destructive and may cause data loss.'
      )
    );
  }

  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `Run \`re-shell ${candidate.argv.join(' ')}\`?`,
    initial: false,
  });

  if (!confirmed) {
    console.log(chalk.gray('\nAborted. Nothing was executed.\n'));
    return;
  }

  // Spawn WITHOUT a shell: argv is passed element-by-element so no token is ever
  // shell-interpreted. The binary is fixed (`re-shell`); only catalogue-derived
  // + sanitised tokens follow.
  const { spawn } = await import('child_process');
  await new Promise<void>(resolve => {
    const child = spawn('re-shell', candidate.argv, {
      stdio: 'inherit',
      shell: false,
    });
    child.on('close', () => resolve());
    child.on('error', err => {
      console.error(chalk.red(`Failed to execute: ${err.message}`));
      process.exitCode = 1;
      resolve();
    });
  });
}
