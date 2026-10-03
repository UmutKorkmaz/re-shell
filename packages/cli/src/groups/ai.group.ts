import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { createAsyncCommand, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import { buildCommandCatalog } from '../utils/command-catalog';
import type { IntentCandidate } from '../utils/ai-intent';
import {
  planScaffold,
  sanitizeProposedIntent,
  composePlan,
  plannerFromEnv,
} from '../utils/ai-plan';
import type {
  ErrorCode,
  ScaffoldIntent,
  ScaffoldPlan,
  ScaffoldPlanStep,
} from '@re-shell/contracts';
import { AI_PROVIDER_NAMES, LOW_CONFIDENCE_THRESHOLD } from '../ai/types';
import { registerAiSubcommands } from '../ai/cli';
import type { ResolveOutput } from '../ai/resolver';

/**
 * `ai <prompt...>` group: a natural-language command interface with a
 * pluggable model backend.
 *
 * Providers (see `re-shell ai config show`):
 *  - `anthropic`         : the Anthropic Messages API (cloud LLM),
 *  - `openai-compatible` : any `/v1/chat/completions` server, e.g. Ollama,
 *                          llama.cpp or LM Studio (local LLM),
 *  - `offline`           : the deterministic catalogue parser. Always
 *                          available, and the fallback when a provider fails.
 *
 * Safety model (the whole point of this command):
 *  - It NEVER auto-executes. The default behaviour is to RESOLVE a prompt to a
 *    concrete `re-shell ...` command and print/return it.
 *  - EVERY command, from any provider, the cache or a session, is validated
 *    against the live command catalogue and a shell-inert argv allow-list
 *    before it is shown. Model output that fails validation is discarded and
 *    the offline parser answers instead (with a warning).
 *  - With `--run` it re-validates, shows the exact command and its source,
 *    requires explicit interactive confirmation, and spawns WITHOUT a shell.
 *  - Ambiguous / low-confidence prompts ask a clarifying question (or, in
 *    `--json`, return `{ needsClarification: true, candidates }`); the answer
 *    on the next turn (`--session <id>` / `--continue`) resolves it.
 *  - Injection text in the prompt is treated as DATA: it can never become a
 *    command because only catalogue-declared paths/flags and shell-inert values
 *    are ever emitted.
 */
export function registerAiGroup(program: Command): void {
  const ai = program
    .command('ai')
    .description(
      'Resolve a natural-language prompt to a re-shell command (pluggable LLM or offline; never auto-runs)'
    )
    .argument('<prompt...>', 'Natural-language description of what you want to do')
    .option('--json', 'Output the resolved spec as JSON')
    .option('--explain', 'Include a human explanation of the resolved command')
    .option('--run', 'Execute the resolved command after explicit confirmation')
    .option('--session <id>', 'Use (or create) a multi-turn session so follow-ups can answer questions')
    .option('--continue', 'Continue the most recent session')
    .option('--provider <name>', `Provider for this call: auto, ${AI_PROVIDER_NAMES.join(', ')}`)
    .option('--offline', 'Use only the offline parser (no network)')
    .option('--no-cache', 'Bypass the semantic response cache')
    .option('--no-fallback', 'Fail instead of falling back to the offline parser when the provider errors')
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

          const provider = options.offline ? 'offline' : options.provider;
          if (
            provider !== undefined &&
            String(provider).toLowerCase() !== 'auto' &&
            !(AI_PROVIDER_NAMES as readonly string[]).includes(String(provider).toLowerCase())
          ) {
            if (spinner) spinner.stop();
            emitFailure(
              options.json === true,
              'AI_CONFIG_ERROR',
              `Unknown provider "${provider}". Valid: auto, ${AI_PROVIDER_NAMES.join(', ')}`
            );
            return;
          }
          if (options.session !== undefined && options.continue) {
            if (spinner) spinner.stop();
            emitFailure(
              options.json === true,
              'AI_SESSION_ERROR',
              'Use either --session <id> or --continue, not both.'
            );
            return;
          }

          // Heavy modules (provider SDK, workspace discovery) load only when needed.
          const { resolveIntent, AiResolveError } = await import('../ai/resolver');

          let output: ResolveOutput;
          try {
            output = await resolveIntent(prompt, {
              program,
              session: { id: options.session, continue: options.continue === true },
              overrides: {
                provider:
                  provider === undefined || String(provider).toLowerCase() === 'auto'
                    ? undefined
                    : String(provider),
              },
              useCache: options.cache === false ? false : undefined,
              fallback: options.fallback !== false,
            });
          } catch (error) {
            if (spinner) spinner.stop();
            if (error instanceof AiResolveError) {
              emitFailure(options.json === true, error.code, error.message, error.details);
              return;
            }
            throw error;
          }

          if (spinner) spinner.stop();

          if (options.json) {
            const warnings = [...output.meta.warnings];
            if (options.run) {
              warnings.push('--run is ignored with --json: nothing was executed.');
            }
            emitJsonResult(output, options.explain === true, warnings);
            return;
          }

          await renderHuman(output, program, {
            explain: options.explain === true,
            run: options.run === true,
          });
        } catch (error) {
          if (spinner) spinner.stop();
          emitFailure(
            options.json === true,
            'AI_INTENT_ERROR',
            `Error resolving intent: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          restoreJson();
        }
      })
    );

  registerAiCreate(ai);
  registerAiSubcommands(ai, program);
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
 * Report a failure: a JSON error envelope in `--json` mode, readable text on
 * stderr otherwise. Either way the process exits non-zero.
 */
function emitFailure(
  json: boolean,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): void {
  if (json) {
    fail(code, message, details);
    return;
  }
  console.error(chalk.red(`Error: ${message}`));
  process.exitCode = 1;
}

/**
 * Emit the JSON envelope for a resolution. On the clarify branch we return
 * `{ needsClarification: true, candidates, ... }`; on resolution we return the
 * spec plus confidence (and, with --explain, the explanation), alongside the
 * provenance fields (provider, source, cached, session, ...). No execution:
 * `executed` is always false in machine output.
 */
function emitJsonResult(output: ResolveOutput, explain: boolean, warnings: string[]): void {
  const { result, meta } = output;
  const common = {
    provider: meta.provider,
    requestedProvider: meta.requestedProvider,
    ...(meta.model ? { model: meta.model } : {}),
    source: meta.source,
    cached: meta.cached,
    ...(meta.cache ? { cache: meta.cache } : {}),
    lowConfidence: meta.lowConfidence,
    ...(meta.fallback ? { fallback: meta.fallback } : {}),
    ...(meta.session ? { session: meta.session } : {}),
    workspace: meta.workspace,
    ...(meta.usage ? { usage: meta.usage } : {}),
    // Always make the safety posture explicit in machine output.
    executed: false as const,
  };

  if (result.needsClarification === true) {
    ok(
      {
        needsClarification: true as const,
        reason: result.reason,
        question: result.question,
        candidates: result.candidates,
        ...common,
      },
      warnings
    );
    return;
  }

  ok(
    {
      needsClarification: false as const,
      resolved: result.candidate,
      confidence: result.candidate.confidence,
      alternatives: result.alternatives,
      ...(explain ? { explanation: result.explanation } : {}),
      ...common,
    },
    warnings
  );
}

interface RenderOptions {
  explain: boolean;
  run: boolean;
}

/** One-line provenance for human output. */
function describeSource(output: ResolveOutput): string {
  const { meta } = output;
  switch (meta.source) {
    case 'cache':
      return `cached answer (${Math.round((meta.cache?.similarity ?? 1) * 100)}% similar to an earlier prompt)`;
    case 'llm':
      return `${meta.provider}${meta.model ? ` (${meta.model})` : ''}`;
    case 'clarification':
      return 'your answer to the previous question';
    default:
      return 'offline parser';
  }
}

/** Human-facing rendering for the resolve / clarify branches. */
async function renderHuman(
  output: ResolveOutput,
  program: Command,
  opts: RenderOptions
): Promise<void> {
  const { result, meta } = output;

  for (const warning of meta.warnings) {
    console.log(chalk.yellow(`⚠ ${warning}`));
  }

  if (result.needsClarification === true) {
    console.log(chalk.yellow.bold('\n🤔 Need clarification\n'));
    console.log(chalk.gray(result.question) + '\n');
    if (result.candidates.length > 0) {
      printCandidateList(result.candidates, true);
    }
    if (meta.session && meta.session.pending) {
      console.log(
        `\n${chalk.gray('Answer with')} ${chalk.bold(`re-shell ai --session ${meta.session.id} "<your answer>"`)} ${chalk.gray('(e.g. "the second one"), or pass --continue.')}`
      );
    }
    console.log();
    // Clarification never executes, even with --run.
    return;
  }

  const { candidate } = result;
  console.log(chalk.cyan.bold('\n🧠 Resolved command\n'));
  console.log(
    `  ${chalk.green('●')} ${chalk.bold('re-shell ' + candidate.argv.join(' '))}`
  );
  console.log(
    `    ${chalk.gray('confidence:')} ${formatConfidence(candidate.confidence)}` +
      (meta.lowConfidence ? chalk.yellow('  (low confidence: double-check before running)') : '')
  );
  console.log(`    ${chalk.gray('via:')} ${describeSource(output)}`);
  if (candidate.description) {
    console.log(`    ${chalk.gray(candidate.description)}`);
  }
  if (candidate.nodes && candidate.nodes.length > 0) {
    console.log(
      `    ${chalk.gray('targets:')} ${candidate.nodes.map(n => `${n.name} (${n.path})`).join(', ')}`
    );
  }
  if (candidate.missingArgs && candidate.missingArgs.length > 0) {
    console.log(
      `    ${chalk.yellow('missing required argument(s):')} ${candidate.missingArgs.join(', ')}`
    );
  }

  if (opts.explain) {
    console.log(`\n${chalk.bold('Explanation:')}\n  ${chalk.gray(result.explanation)}`);
  }

  if (result.alternatives.length > 0) {
    console.log(`\n${chalk.bold('Alternatives:')}`);
    printCandidateList(result.alternatives, false);
  }

  if (!opts.run) {
    console.log(
      `\n${chalk.gray('Not executed. Re-run with')} ${chalk.bold('--run')} ${chalk.gray('to execute after confirmation.')}\n`
    );
    return;
  }

  await confirmAndRunResolved(candidate, output, program);
}

function printCandidateList(candidates: IntentCandidate[], numbered: boolean): void {
  candidates.forEach((c, i) => {
    const badge = c.destructive ? chalk.red(' [destructive]') : '';
    const low = c.confidence < LOW_CONFIDENCE_THRESHOLD ? chalk.yellow(' low') : '';
    const lead = numbered ? chalk.bold(`${i + 1}.`) : chalk.blue('-');
    console.log(
      `  ${lead} ${chalk.bold('re-shell ' + c.argv.join(' '))}${badge} ${chalk.gray('(' + formatConfidence(c.confidence) + ')')}${low}`
    );
  });
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Confirm-then-run for `--run`. The shared gate re-vets the argv against the
 * live catalogue, shows the exact command plus its provenance, requires an
 * explicit interactive "yes" (default no), then spawns WITHOUT a shell so no
 * token can ever be re-interpreted as shell syntax.
 */
async function confirmAndRunResolved(
  candidate: IntentCandidate,
  output: ResolveOutput,
  program: Command
): Promise<void> {
  if (!process.stdin.isTTY) {
    // An explicit interactive "yes" is the whole safety contract of --run.
    console.log();
    console.log(chalk.red('Refusing to run: --run needs an interactive terminal to confirm. Nothing was executed.'));
    console.log(chalk.gray(`Run it yourself:  re-shell ${candidate.argv.join(' ')}`));
    process.exitCode = 1;
    return;
  }
  const { confirmAndRun } = await import('../ai/run');
  const { indexCatalog, vetArgv } = await import('../ai/argv-guard');
  const { EXCLUDED_PATH_PREFIXES } = await import('../ai/prompt');
  const index = indexCatalog(buildCommandCatalog(program));

  console.log();
  const outcome = await confirmAndRun(
    candidate,
    { source: output.meta.source, provider: output.meta.provider, model: output.meta.model },
    {
      vet: argv => vetArgv(argv, index, { excludePathPrefixes: EXCLUDED_PATH_PREFIXES }),
      confirm: async message => {
        const { confirmed } = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message,
          initial: false,
        });
        return confirmed === true;
      },
      print: line =>
        console.log(line.startsWith('WARNING') ? chalk.red.bold(line) : chalk.gray(line)),
    }
  );

  if (outcome.executed === true) {
    if (outcome.exitCode !== 0) process.exitCode = outcome.exitCode;
  } else if (outcome.reason === 'spawn-failed') {
    console.error(chalk.red(`Failed to execute: ${outcome.message}`));
    process.exitCode = 1;
  } else if (outcome.reason === 'rejected') {
    process.exitCode = 1;
  }
  console.log();
}
