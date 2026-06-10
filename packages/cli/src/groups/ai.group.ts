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
import {
  planScaffold,
  sanitizeProposedIntent,
  composePlan,
  plannerFromEnv,
} from '../utils/ai-plan';
import type {
  ScaffoldIntent,
  ScaffoldPlan,
  ScaffoldPlanStep,
} from '@re-shell/contracts';

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
  const ai = program
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

  registerAiCreate(ai);
}

/**
 * `ai create "<description>"` — turn a free-text project description into a
 * REVIEWABLE, dry-run-by-default scaffold PLAN of REAL re-shell commands.
 *
 * Safety model:
 *  - Default (no --yes) RESOLVES + COMPOSES the plan and prints/emits it. It
 *    writes NOTHING and runs NOTHING.
 *  - `--yes` executes the plan by invoking the real `re-shell` commands in order,
 *    each spawned WITHOUT a shell (argv passed element-by-element), so no token
 *    can ever be re-interpreted as shell syntax.
 *  - Resolution is OFFLINE + deterministic: the description is parsed against the
 *    real template registry vocabulary and every component is resolved to a REAL
 *    template id via the shared ranker. Unknown mentions are dropped.
 *  - An optional, OFF-by-default LLM planner may PROPOSE an intent, but its output
 *    is sanitised so every referenced id is a REAL one before any plan is built.
 */
function registerAiCreate(ai: Command): void {
  ai.command('create')
    .description(
      'Plan a project scaffold from a description (offline, dry-run by default, writes nothing)'
    )
    .argument('<description...>', 'Natural-language description of the project to scaffold')
    .option('--json', 'Output the plan as a validated JSON envelope')
    .option('--yes', 'Execute the planned commands in order (default: dry-run only)')
    .action(
      createAsyncCommand(async (descriptionParts: string[], options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner('Planning scaffold...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const description = Array.isArray(descriptionParts)
            ? descriptionParts.join(' ')
            : String(descriptionParts ?? '');

          // Default path is fully offline/deterministic. A provider is only ever
          // consulted when explicitly configured, and its proposal is sanitised
          // so the plan can only ever reference REAL ids.
          const { intent, plan } = await resolveIntentAndPlan(description);

          if (spinner) spinner.stop();

          if (plan.steps.length === 0) {
            const message =
              'Could not resolve any real templates/commands from that description. ' +
              'Try naming a frontend framework, a backend, a datastore, or infra (e.g. "react shell + fastapi + postgres on k8s").';
            if (options.json) {
              fail('AI_INTENT_ERROR', message, { description: intent.description });
              return;
            }
            console.log(chalk.yellow.bold('\n🤔 Nothing to plan\n'));
            console.log(chalk.gray(message) + '\n');
            return;
          }

          if (!options.yes) {
            // Dry-run: print/emit the plan and write NOTHING.
            if (options.json) {
              ok({ intent, plan });
              return;
            }
            renderPlan(intent, plan);
            return;
          }

          // --yes: execute the plan in order, then emit/print the applied result.
          const applied = await executePlan(plan);
          if (options.json) {
            ok({ intent, plan: applied });
            return;
          }
          renderPlan(intent, applied);
        } catch (error) {
          if (spinner) spinner.stop();
          fail(
            'AI_INTENT_ERROR',
            `Error planning scaffold: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          restoreJson();
        }
      })
    );
}

/**
 * Resolve the intent + plan for a description. The default path is the pure,
 * offline {@link planScaffold}. If (and only if) a planner provider is configured
 * via the environment, its proposal is sanitised back to REAL ids and composed
 * through the same {@link composePlan}, so the safety contract holds either way.
 */
async function resolveIntentAndPlan(description: string): Promise<{
  intent: ScaffoldIntent;
  plan: ScaffoldPlan;
}> {
  const provider = plannerFromEnv();
  if (!provider) {
    return planScaffold(description);
  }

  try {
    const proposed = await provider.propose(description);
    const intent = sanitizeProposedIntent(proposed);
    return { intent, plan: composePlan(intent) };
  } catch {
    // Any provider failure falls back to the deterministic offline path.
    return planScaffold(description);
  }
}

/** Human-facing rendering of a scaffold plan. */
function renderPlan(intent: ScaffoldIntent, plan: ScaffoldPlan): void {
  const header = plan.applied ? '✅ Executed scaffold plan' : '🧩 Scaffold plan (dry-run)';
  console.log(chalk.cyan.bold(`\n${header}\n`));
  console.log(`  ${chalk.gray('project:')} ${chalk.bold(intent.projectName)}`);
  if (plan.resolved.length > 0) {
    console.log(`  ${chalk.gray('templates:')} ${plan.resolved.join(', ')}`);
  }
  console.log(`\n${chalk.bold('Steps:')}`);
  plan.steps.forEach((step, index) => {
    const marker = step.applied ? chalk.green('✓') : chalk.blue(`${index + 1}.`);
    console.log(`  ${marker} ${chalk.bold('re-shell ' + step.command.join(' '))}`);
    console.log(`     ${chalk.gray(step.description)}`);
    if (step.why) console.log(`     ${chalk.gray(step.why)}`);
  });

  if (!plan.applied) {
    console.log(
      `\n${chalk.gray('Nothing was written. Re-run with')} ${chalk.bold('--yes')} ${chalk.gray('to execute the plan.')}\n`
    );
  } else {
    console.log();
  }
}

/**
 * Execute a plan's steps in order by spawning the real `re-shell` binary. Each
 * step's argv is passed element-by-element WITHOUT a shell, so no token can be
 * re-interpreted as shell syntax. Returns a new plan marked applied with each
 * executed step flagged.
 */
async function executePlan(plan: ScaffoldPlan): Promise<ScaffoldPlan> {
  const { spawn } = await import('child_process');
  const executedSteps: ScaffoldPlanStep[] = [];

  for (const step of plan.steps) {
    const exitCode = await new Promise<number>(resolve => {
      const child = spawn('re-shell', step.command, {
        stdio: 'inherit',
        shell: false,
      });
      child.on('close', code => resolve(code ?? 0));
      child.on('error', () => resolve(1));
    });
    executedSteps.push({ ...step, applied: exitCode === 0 });
    if (exitCode !== 0) {
      process.exitCode = 1;
      // Stop the pipeline on the first failure; remaining steps stay un-applied.
      for (let i = executedSteps.length; i < plan.steps.length; i++) {
        executedSteps.push({ ...plan.steps[i], applied: false });
      }
      break;
    }
  }

  return { ...plan, applied: true, steps: executedSteps };
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
