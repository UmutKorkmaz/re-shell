import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { createAsyncCommand, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import { discoverWorkspace } from '../utils/agents-discovery';
import {
  generateAllAgentsDocs,
  toAgentsDocFile,
  type GeneratedAgentsFile,
} from '../utils/agents-doc';
import type {
  AgentsCheckResponse,
  AgentsDocResponse,
  AgentsDriftFile,
} from '@re-shell/contracts';

/**
 * `agents` group: make a repo "agent-ready by construction".
 *
 * Three subcommands, all offline + deterministic:
 *   - `init`  — write the root + per-package AGENTS.md and the llms.txt index.
 *   - `sync`  — regenerate/update them after a graph change (idempotent: re-runs
 *               produce identical bytes, so it is safe to run repeatedly).
 *   - `check` — DRIFT CHECK for CI: compare on-disk content against freshly
 *               generated content; exit non-zero with a diff summary if stale.
 *
 * All support `--json`. The generator is pure (utils/agents-doc.ts); discovery
 * (utils/agents-discovery.ts) is the only filesystem reader; this layer writes
 * and compares.
 */

/** Resolve the workspace root (cwd; honoured for testability/fixtures). */
function workspaceRoot(): string {
  return process.cwd();
}

/** Generate the full artifact set for the workspace rooted at `root`. */
async function generate(root: string, program: Command): Promise<GeneratedAgentsFile[]> {
  const ws = await discoverWorkspace(root, program);
  return generateAllAgentsDocs(ws);
}

/** Write every generated artifact to disk (creating parent dirs as needed). */
async function writeFiles(root: string, files: GeneratedAgentsFile[]): Promise<void> {
  for (const file of files) {
    const abs = path.join(root, file.path);
    await fs.ensureDir(path.dirname(abs));
    await fs.writeFile(abs, file.content, 'utf8');
  }
}

/**
 * Compare on-disk artifacts against freshly-generated content. Returns the drift
 * entries: a file is `missing` when absent and `stale` when its bytes differ.
 */
async function detectDrift(
  root: string,
  files: GeneratedAgentsFile[]
): Promise<AgentsDriftFile[]> {
  const drift: AgentsDriftFile[] = [];
  for (const file of files) {
    const abs = path.join(root, file.path);
    if (!(await fs.pathExists(abs))) {
      drift.push({ path: file.path, kind: file.kind, reason: 'missing' });
      continue;
    }
    const current = await fs.readFile(abs, 'utf8');
    if (current !== file.content) {
      drift.push({ path: file.path, kind: file.kind, reason: 'stale' });
    }
  }
  return drift;
}

/** Shared init/sync handler: generate, write, then report. */
function makeWriteAction(program: Command, verb: 'init' | 'sync') {
  return createAsyncCommand(async (options) => {
    const restoreJson = options.json ? enableJsonMode() : () => {};
    const spinner = options.json
      ? undefined
      : createSpinner(`Generating AGENTS.md (${verb})...`).start();
    if (spinner) {
      processManager.addCleanup(() => spinner.stop());
      flushOutput();
    }

    try {
      const root = workspaceRoot();
      const files = await generate(root, program);
      await writeFiles(root, files);

      if (options.json) {
        const payload: AgentsDocResponse = {
          written: true,
          files: files.map(toAgentsDocFile),
        };
        ok(payload);
        return;
      }

      if (spinner) spinner.stop();
      console.log(
        chalk.cyan.bold(`\n🤖 agents ${verb}: wrote ${files.length} file(s)\n`)
      );
      for (const file of files) {
        console.log(
          `  ${chalk.green('✓')} ${chalk.bold(file.path)} ${chalk.gray(`[${file.kind}]`)}`
        );
      }
      console.log();
    } catch (error) {
      if (spinner) spinner.stop();
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (options.json) {
        fail('AGENTS_ERROR', `Error during agents ${verb}: ${message}`);
      } else {
        console.log(chalk.red(`\n✗ Error during agents ${verb}: ${message}\n`));
        process.exitCode = 1;
      }
    } finally {
      restoreJson();
    }
  });
}

/**
 * Register the `agents` group on `program`.
 */
export function registerAgentsGroup(program: Command): void {
  const agentsCommand = new Command('agents').description(
    'Generate and verify agent-readiness docs (AGENTS.md + llms.txt)'
  );

  agentsCommand
    .command('init')
    .description('Write root + per-package AGENTS.md and llms.txt to disk')
    .option('--json', 'Output as JSON')
    .action(makeWriteAction(program, 'init'));

  agentsCommand
    .command('sync')
    .description('Regenerate AGENTS.md + llms.txt after a graph change (idempotent)')
    .option('--json', 'Output as JSON')
    .action(makeWriteAction(program, 'sync'));

  agentsCommand
    .command('check')
    .description('Drift check: fail (non-zero) when on-disk docs are stale (for CI)')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner('Checking AGENTS.md drift...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const root = workspaceRoot();
          const files = await generate(root, program);
          const drift = await detectDrift(root, files);
          const hasDrift = drift.length > 0;

          if (options.json) {
            const payload: AgentsCheckResponse = {
              drift: hasDrift,
              checked: files.length,
              files: drift,
            };
            // Drift is a failure for CI: emit an error envelope + non-zero exit.
            if (hasDrift) {
              fail(
                'AGENTS_ERROR',
                `Agent docs are out of date: ${drift.length} of ${files.length} file(s) drifted. Run \`re-shell agents sync\`.`,
                { drift: payload.drift, checked: payload.checked, files: payload.files }
              );
            } else {
              ok(payload);
            }
            return;
          }

          if (spinner) spinner.stop();

          if (!hasDrift) {
            console.log(
              chalk.green.bold(`\n✓ AGENTS docs in sync (${files.length} file(s) checked)\n`)
            );
            return;
          }

          console.log(
            chalk.red.bold(
              `\n✗ AGENTS docs out of date: ${drift.length} of ${files.length} file(s) drifted\n`
            )
          );
          for (const d of drift) {
            const tag = d.reason === 'missing' ? chalk.yellow('missing') : chalk.red('stale');
            console.log(`  ${tag} ${chalk.bold(d.path)} ${chalk.gray(`[${d.kind}]`)}`);
          }
          console.log(chalk.cyan(`\nRun \`re-shell agents sync\` to update.\n`));
          process.exitCode = 1;
        } catch (error) {
          if (spinner) spinner.stop();
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (options.json) {
            fail('AGENTS_ERROR', `Error during agents check: ${message}`);
          } else {
            console.log(chalk.red(`\n✗ Error during agents check: ${message}\n`));
            process.exitCode = 1;
          }
        } finally {
          restoreJson();
        }
      })
    );

  program.addCommand(agentsCommand);
}
