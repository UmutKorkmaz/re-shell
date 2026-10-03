import { Command } from 'commander';
import chalk from 'chalk';
import prompts from 'prompts';
import { createAsyncCommand } from '../utils/error-handler';
import { buildCommandCatalog } from '../utils/command-catalog';
import { enableJsonMode, fail, ok } from '../utils/json-output';
import type { ErrorCode } from '@re-shell/contracts';
import { SemanticCache } from './cache';
import {
  AI_CONFIG_KEYS,
  SECRET_KEYS,
  defaultGlobalConfigPath,
  describeAiConfig,
  isAiConfigKey,
  parseConfigValue,
  readPersistedAiConfig,
  resolveAiConfig,
  writePersistedAiConfig,
  type AiConfigKey,
} from './config';
import {
  SessionError,
  SessionStore,
  collectResolvedHistory,
} from './session';
import { aiStateDir } from './store';
import { suggest } from './suggest';
import {
  buildWorkspaceContext,
  resolveWorkspaceRoot,
} from './workspace-context';

/**
 * Command layer for the `ai` companion subcommands:
 *
 *   ai suggest <partial...>
 *   ai session list | show <id> | clear [id] [--all]
 *   ai cache stats | clear
 *   ai config show | get <key> | set <key> <value> | unset <key>
 *
 * Every subcommand supports `--json` (a validated envelope) and fails with a
 * non-zero exit code and a specific error code when it cannot do its job.
 */

/** Run `body` with JSON mode on when requested, restoring stdout afterwards. */
async function withJson<T>(
  options: { json?: boolean },
  errorCode: ErrorCode,
  body: () => Promise<T>
): Promise<T | undefined> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    return await body();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (options.json) fail(errorCode, message);
    else {
      console.error(chalk.red(`Error: ${message}`));
      process.exitCode = 1;
    }
    return undefined;
  } finally {
    restore();
  }
}

/** Parent options (e.g. a `--json` consumed by the `ai` command) merged with the subcommand's. */
function merged(options: Record<string, unknown>, command: Command): Record<string, unknown> {
  return { ...command.optsWithGlobals(), ...options };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Attach the companion subcommands to the `ai` command.
 *
 * @param ai - The `ai` command.
 * @param program - The root program (its command tree is the catalogue).
 */
export function registerAiSubcommands(ai: Command, program: Command): void {
  registerSuggest(ai, program);
  registerSession(ai);
  registerCache(ai);
  registerConfig(ai);
}

// ---------------------------------------------------------------------------
// ai suggest
// ---------------------------------------------------------------------------

function registerSuggest(ai: Command, program: Command): void {
  ai.command('suggest')
    .description('Confidence-scored autocomplete from commands, session history and workspace nodes')
    .argument('<partial...>', 'The text typed so far')
    .option('--limit <n>', 'Maximum number of suggestions', '8')
    .option('--json', 'Output suggestions as a JSON envelope')
    .action(
      createAsyncCommand(async (parts: string[], options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_SUGGEST_ERROR', async () => {
          const partial = Array.isArray(parts) ? parts.join(' ') : String(parts ?? '');
          const limit = Number.parseInt(String(opts.limit ?? '8'), 10);
          if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            throw new Error('--limit must be an integer between 1 and 50');
          }
          const cwd = process.cwd();
          const workspace = await buildWorkspaceContext(cwd);
          const history = collectResolvedHistory(new SessionStore(aiStateDir(workspace.root)));
          const suggestions = suggest(partial, {
            catalog: buildCommandCatalog(program),
            workspace,
            history,
            limit,
          });

          if (opts.json) {
            ok({ partial, suggestions });
            return;
          }
          if (suggestions.length === 0) {
            console.log(chalk.yellow(`\nNo suggestions for "${partial}".\n`));
            return;
          }
          console.log(chalk.cyan.bold(`\nSuggestions for "${partial}"\n`));
          for (const s of suggestions) {
            const flag = s.lowConfidence ? chalk.yellow(' (low confidence)') : '';
            console.log(
              `  ${chalk.green(pct(s.confidence).padStart(4))}  ${chalk.bold(s.text)}${flag}  ${chalk.gray(`[${s.kind}]`)}`
            );
            console.log(`        ${chalk.gray('re-shell ' + s.argv.join(' '))}`);
          }
          console.log();
        });
      })
    );
}

// ---------------------------------------------------------------------------
// ai session
// ---------------------------------------------------------------------------

function registerSession(ai: Command): void {
  const session = ai.command('session').description('Manage multi-turn AI sessions (.re-shell/ai/sessions)');

  const storeFor = async (): Promise<SessionStore> =>
    new SessionStore(aiStateDir(await resolveWorkspaceRoot(process.cwd())));

  session
    .command('list')
    .description('List sessions, most recent first')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_SESSION_ERROR', async () => {
          const store = await storeFor();
          const sessions = store.list();
          if (opts.json) {
            ok({ directory: store.directory, sessions });
            return;
          }
          if (sessions.length === 0) {
            console.log(chalk.gray('\nNo AI sessions in this workspace.\n'));
            return;
          }
          console.log(chalk.cyan.bold('\nAI sessions\n'));
          for (const s of sessions) {
            const pending = s.pending ? chalk.yellow(' [awaiting your answer]') : '';
            console.log(
              `  ${chalk.bold(s.id)}  ${chalk.gray(s.updatedAt)}  ${s.turns} turn(s)${pending}`
            );
            if (s.lastPrompt) console.log(`    ${chalk.gray('"' + s.lastPrompt + '"')}`);
          }
          console.log();
        });
      })
    );

  session
    .command('show')
    .description('Show one session in full')
    .argument('<id>', 'Session id')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (id: string, options, command: Command) => {
        const opts = merged(options, command);
        const restore = opts.json ? enableJsonMode() : () => {};
        try {
          const store = await storeFor();
          const s = store.load(id);
          if (opts.json) {
            ok({ session: s });
            return;
          }
          console.log(chalk.cyan.bold(`\nSession ${s.id}\n`));
          console.log(chalk.gray(`  created ${s.createdAt}, updated ${s.updatedAt}`));
          s.turns.forEach((t, i) => {
            console.log(`\n  ${chalk.bold(String(i + 1) + '.')} "${t.prompt}"  ${chalk.gray(`[${t.source}/${t.provider}]`)}`);
            if (t.kind === 'resolved') console.log(`     -> re-shell ${(t.argv ?? []).join(' ')}  (${pct(t.confidence ?? 0)})`);
            else if (t.kind === 'clarify') console.log(`     ? ${t.question}`);
            else console.log(`     (cancelled)`);
          });
          if (s.pending) {
            console.log(chalk.yellow(`\n  Awaiting your answer: ${s.pending.question}`));
          }
          console.log();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (opts.json) {
            fail('AI_SESSION_ERROR', message, error instanceof SessionError ? { reason: error.code } : undefined);
          } else {
            console.error(chalk.red(`Error: ${message}`));
            process.exitCode = 1;
          }
        } finally {
          restore();
        }
      })
    );

  session
    .command('clear')
    .description('Delete one session, or all with --all')
    .argument('[id]', 'Session id to delete')
    .option('--all', 'Delete every session in this workspace')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (id: string | undefined, options, command: Command) => {
        const opts = merged(options, command);
        const restore = opts.json ? enableJsonMode() : () => {};
        try {
          if (!id && !opts.all) {
            throw new SessionError('not-found', 'specify a session id, or pass --all to delete every session');
          }
          const store = await storeFor();
          let ids: string[];
          if (opts.all) {
            ids = store.list().map(s => s.id);
            store.removeAll();
          } else if (store.remove(id as string)) {
            ids = [id as string];
          } else {
            throw new SessionError('not-found', `no session "${id}" in this workspace`);
          }
          if (opts.json) ok({ removed: ids.length, ids });
          else console.log(chalk.green(`\nRemoved ${ids.length} session(s).\n`));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (opts.json) {
            fail('AI_SESSION_ERROR', message, error instanceof SessionError ? { reason: error.code } : undefined);
          } else {
            console.error(chalk.red(`Error: ${message}`));
            process.exitCode = 1;
          }
        } finally {
          restore();
        }
      })
    );
}

// ---------------------------------------------------------------------------
// ai cache
// ---------------------------------------------------------------------------

function registerCache(ai: Command): void {
  const cache = ai.command('cache').description('Inspect or clear the semantic response cache');

  const cacheFor = async (): Promise<SemanticCache> => {
    const root = await resolveWorkspaceRoot(process.cwd());
    const persisted = readPersistedAiConfig();
    return new SemanticCache(aiStateDir(root), {
      ttlSeconds: resolveAiConfig(process.env, persisted).cacheTtlSeconds,
    });
  };

  cache
    .command('stats')
    .description('Show cache size, hit rate and limits')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_CACHE_ERROR', async () => {
          const stats = (await cacheFor()).stats();
          if (opts.json) {
            ok(stats);
            return;
          }
          console.log(chalk.cyan.bold('\nAI cache\n'));
          console.log(`  file:     ${stats.path}`);
          console.log(`  entries:  ${stats.entries} (max ${stats.maxEntries}, ${stats.expired} expired)`);
          console.log(`  size:     ${stats.bytes} bytes`);
          console.log(`  lookups:  ${stats.hits} hit(s), ${stats.misses} miss(es) (${pct(stats.hitRate)} hit rate)`);
          console.log(`  ttl:      ${stats.ttlSeconds}s, similarity threshold ${stats.threshold}`);
          console.log();
        });
      })
    );

  cache
    .command('clear')
    .description('Delete every cached response and reset statistics')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_CACHE_ERROR', async () => {
          const { removed } = (await cacheFor()).clear();
          if (opts.json) ok({ removed });
          else console.log(chalk.green(`\nCleared ${removed} cached response(s).\n`));
        });
      })
    );
}

// ---------------------------------------------------------------------------
// ai config
// ---------------------------------------------------------------------------

/** Read a secret from a hidden prompt (TTY) or from piped stdin. */
async function readSecret(json: boolean): Promise<string> {
  if (process.stdin.isTTY && !json) {
    const { value } = await prompts({ type: 'password', name: 'value', message: 'API key' });
    return typeof value === 'string' ? value.trim() : '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

function registerConfig(ai: Command): void {
  const config = ai
    .command('config')
    .description('View or change the AI provider configuration (stored in ~/.re-shell/config.yaml)');

  const keyList = AI_CONFIG_KEYS.join(', ');

  config
    .command('show')
    .description('Show the effective configuration (secrets are never printed)')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_CONFIG_ERROR', async () => {
          const file = defaultGlobalConfigPath();
          const persisted = readPersistedAiConfig(file);
          const view = describeAiConfig(resolveAiConfig(process.env, persisted));
          const persistedKeys = Object.keys(persisted);
          if (opts.json) {
            ok({ config: view, persistedKeys, file });
            return;
          }
          const src = (s: string): string => chalk.gray(`(${s})`);
          console.log(chalk.cyan.bold('\nAI provider configuration\n'));
          console.log(`  provider:  ${chalk.bold(view.provider)} ${src(view.sources.provider)}`);
          console.log(`  model:     ${view.model ?? chalk.gray('-')} ${src(view.sources.model)}`);
          console.log(`  baseUrl:   ${view.baseUrl ?? chalk.gray('-')} ${src(view.sources.baseUrl)}`);
          console.log(
            `  apiKey:    ${view.apiKey.set ? chalk.green('set') : chalk.gray('not set')} ${src(view.apiKey.source)}`
          );
          console.log(`  timeoutMs: ${view.timeoutMs} ${src(view.sources.timeoutMs)}`);
          console.log(`  cache:     ${view.cache ? 'on' : 'off'} (ttl ${view.cacheTtlSeconds}s)`);
          console.log(chalk.gray(`\n  stored in ${file}\n`));
        });
      })
    );

  config
    .command('get')
    .description(`Show one effective value (${keyList}); secrets are redacted`)
    .argument('<key>', 'Config key')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (key: string, options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_CONFIG_ERROR', async () => {
          if (!isAiConfigKey(key)) {
            throw new Error(`unknown key "${key}"; valid keys: ${keyList}`);
          }
          const file = defaultGlobalConfigPath();
          const resolved = resolveAiConfig(process.env, readPersistedAiConfig(file));
          const view = describeAiConfig(resolved);
          const secret = SECRET_KEYS.has(key);
          let value: string | number | boolean | null;
          let source: string;
          if (key === 'apiKey') {
            value = view.apiKey.set ? '<redacted>' : null;
            source = view.apiKey.source;
          } else {
            value = (view[key as Exclude<AiConfigKey, 'apiKey'>] as string | number | boolean | undefined) ?? null;
            source = key === 'cache' || key === 'cacheTtlSeconds' ? 'config' : view.sources[key as 'provider'];
          }
          const payload = { key, value, secret, set: value !== null, source, file };
          if (opts.json) ok(payload);
          else console.log(value === null ? chalk.gray('(not set)') : String(value));
        });
      })
    );

  config
    .command('set')
    .description(`Persist a value (${keyList}). For apiKey, pass "-" to read it from stdin`)
    .argument('<key>', 'Config key')
    .argument('<value>', 'New value')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (key: string, value: string, options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_CONFIG_ERROR', async () => {
          if (!isAiConfigKey(key)) {
            throw new Error(`unknown key "${key}"; valid keys: ${keyList}`);
          }
          const raw = key === 'apiKey' && value === '-' ? await readSecret(Boolean(opts.json)) : value;
          const parsed = parseConfigValue(key, raw);
          if (parsed.ok === false) throw new Error(parsed.message);

          const file = defaultGlobalConfigPath();
          const { DEFAULT_GLOBAL_CONFIG } = await import('../utils/config');
          writePersistedAiConfig({ [key]: parsed.value }, file, { ...DEFAULT_GLOBAL_CONFIG });

          const secret = SECRET_KEYS.has(key);
          const payload = { key, value: secret ? '<redacted>' : parsed.value, secret, set: true, file };
          if (opts.json) {
            ok(payload, secret ? ['The key is stored in plain text in the global config (mode 0600); prefer the ANTHROPIC_API_KEY environment variable.'] : []);
            return;
          }
          console.log(chalk.green(`\nSet ${key}${secret ? '' : ` = ${parsed.value}`} in ${file}`));
          if (secret) {
            console.log(
              chalk.yellow(
                'The key is stored in plain text (file mode 0600). Prefer the ANTHROPIC_API_KEY environment variable.'
              )
            );
          }
          console.log();
        });
      })
    );

  config
    .command('unset')
    .description('Remove a persisted value')
    .argument('<key>', 'Config key')
    .option('--json', 'Output as a JSON envelope')
    .action(
      createAsyncCommand(async (key: string, options, command: Command) => {
        const opts = merged(options, command);
        await withJson(opts as { json?: boolean }, 'AI_CONFIG_ERROR', async () => {
          if (!isAiConfigKey(key)) {
            throw new Error(`unknown key "${key}"; valid keys: ${keyList}`);
          }
          const file = defaultGlobalConfigPath();
          writePersistedAiConfig({ [key]: null }, file);
          const payload = { key, value: null, secret: SECRET_KEYS.has(key), set: false, file };
          if (opts.json) ok(payload);
          else console.log(chalk.green(`\nRemoved ${key} from ${file}\n`));
        });
      })
    );
}
