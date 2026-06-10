import { Command } from 'commander';
import chalk from 'chalk';
import { createAsyncCommand, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import type { FindResponse, FindResult, FindResultType } from '@re-shell/contracts';
import { buildFindCorpus } from '../utils/find-corpus';
import { rankDocs } from '../utils/find-index';

/** Default number of results when `--limit` is not supplied. */
const DEFAULT_LIMIT = 10;

/** Accepted values for the `--type` filter. */
const TYPE_FILTERS: ReadonlySet<string> = new Set(['command', 'template', 'all']);

/**
 * Parse and clamp the `--limit` option. Falls back to {@link DEFAULT_LIMIT} for
 * missing/invalid input; never returns < 1.
 */
function parseLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.floor(n);
}

/**
 * `find <query>` group: an OFFLINE, deterministic search over the command
 * catalogue and template registry.
 *
 * The default path is keyword/fuzzy ranking only — no network, no LLM. An
 * optional embedding reranker can reorder the top-K when explicitly enabled via
 * `RE_SHELL_EMBEDDINGS`, but it is OFF by default and never touched in tests/CI.
 */
export function registerFindGroup(program: Command): void {
  program
    .command('find')
    .description('Search commands and templates by keyword (offline, ranked)')
    .argument('<query>', 'Search terms, e.g. "kubernetes manifests"')
    .option('--json', 'Output the ranked results as a JSON envelope')
    .option('--limit <n>', 'Maximum number of results', String(DEFAULT_LIMIT))
    .option('--type <type>', 'Restrict to command|template|all', 'all')
    .action(
      createAsyncCommand(async (query: string, options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner('Searching...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const typeRaw = String(options.type ?? 'all');
          if (!TYPE_FILTERS.has(typeRaw)) {
            if (spinner) spinner.stop();
            const message = `Invalid --type "${typeRaw}". Expected command, template, or all.`;
            if (options.json) {
              fail('FIND_ERROR', message, { type: typeRaw });
            } else {
              console.log(chalk.red(`\n✗ ${message}\n`));
              process.exitCode = 1;
            }
            return;
          }
          const type = typeRaw as FindResultType | 'all';
          const limit = parseLimit(options.limit);

          const corpus = buildFindCorpus(program);
          const results = rankDocs(query, corpus, { limit, type });

          if (options.json) {
            const payload: FindResponse = { query, limit, results };
            ok(payload);
            return;
          }

          if (spinner) spinner.stop();
          renderHuman(query, results);
        } catch (error) {
          if (spinner) spinner.stop();
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (options.json) {
            fail('FIND_ERROR', `Error running search: ${message}`);
          } else {
            console.log(chalk.red(`\n✗ Error running search: ${message}\n`));
            process.exitCode = 1;
          }
        } finally {
          restoreJson();
        }
      })
    );
}

/** Render a clean grouped list of results for the terminal. */
function renderHuman(query: string, results: readonly FindResult[]): void {
  console.log(chalk.cyan.bold(`\n🔎 Results for "${query}" (${results.length})\n`));

  if (results.length === 0) {
    console.log(chalk.yellow('No matches. Try fewer or different keywords.\n'));
    return;
  }

  const commands = results.filter(r => r.type === 'command');
  const templates = results.filter(r => r.type === 'template');

  if (commands.length > 0) {
    console.log(chalk.bold('Commands'));
    for (const r of commands) printResult(r);
    console.log();
  }
  if (templates.length > 0) {
    console.log(chalk.bold('Templates'));
    for (const r of templates) printResult(r);
    console.log();
  }
}

/** Print one ranked hit with its score, usage, and matched terms. */
function printResult(r: FindResult): void {
  const pct = `${Math.round(r.score * 100)}%`;
  console.log(
    `  ${chalk.green('●')} ${chalk.bold(r.title)} ${chalk.gray(`(${pct})`)}`
  );
  if (r.usage) {
    console.log(`    ${chalk.blue(r.usage)}`);
  }
  if (r.matched.length > 0) {
    console.log(`    ${chalk.gray(`matched: ${r.matched.join(', ')}`)}`);
  }
}
