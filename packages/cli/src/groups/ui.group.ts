import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { enableJsonMode } from '../utils/json-output';
import { runUiComponentNew } from '../commands/ui-component';
import { runUiGenerate } from '../commands/ui-generate';
import {
  runUiThemeInstall,
  runUiThemeList,
  runUiThemeRemove,
  runUiThemeSearch,
} from '../commands/ui-theme';

/** Run `fn` with JSON mode enabled for the duration when `--json` was passed. */
async function withJson(json: boolean, fn: () => Promise<void>): Promise<void> {
  const restore = json ? enableJsonMode() : () => {};
  try {
    await fn();
  } finally {
    restore();
  }
}

/**
 * `re-shell ui component|theme|generate` — design-system tooling around the dashboard UI
 * package: component scaffolding, the theme marketplace, and AI-assisted generation.
 * (`ui test` lives in ui-test.group.ts; the bare `re-shell ui` launches the dashboard.)
 */
export function registerUiGroup(program: Command): void {
  const ui = program.commands.find(command => command.name() === 'ui') ?? program
    .command('ui')
    .description('Launch the local Re-Shell UI dashboard');

  // ---- component ----------------------------------------------------------
  const component = ui.command('component').description('Scaffold UI components following the @re-shell/ui conventions');
  component
    .command('new <name>')
    .description('Scaffold a component, its Storybook story and its vitest + axe test in packages/ui')
    .option('--group <group>', 'Where it lives: ui, re-shell or primitives', 'ui')
    .option('--ui <dir>', 'UI package directory (default: detected)')
    .option('--workspace <path>', 'Workspace root', process.cwd())
    .option('--description <text>', 'One-line description for the doc comment')
    .option('--dry-run', 'Print what would be created without writing')
    .option('--force', 'Overwrite existing files')
    .option('--json', 'Output the result as a JSON envelope')
    .action(
      createAsyncCommand(async (name: string, options) => {
        await withJson(Boolean(options.json), () =>
          runUiComponentNew(name, {
            json: Boolean(options.json),
            group: options.group,
            ui: options.ui,
            workspace: options.workspace,
            description: options.description,
            dryRun: Boolean(options.dryRun),
            force: Boolean(options.force),
          })
        );
      })
    );

  // ---- generate -----------------------------------------------------------
  ui
    .command('generate')
    .description(
      'Generate a component (TSX + story + test) from a description; uses the configured AI provider, falls back to an offline template generator'
    )
    .requiredOption('--prompt <text>', 'What to build, e.g. "a table of services with name, port and status"')
    .option('--name <Name>', 'Component name (PascalCase); default: derived')
    .option('--group <group>', 'Where it lives: ui, re-shell or primitives', 're-shell')
    .option('--ui <dir>', 'UI package directory (default: detected)')
    .option('--workspace <path>', 'Workspace root', process.cwd())
    .option('--offline', 'Do not call an AI provider even if one is configured')
    .option('--dry-run', 'Generate and typecheck, but write nothing (prints the code)')
    .option('--force', 'Overwrite existing files')
    .option('--json', 'Output the result as a JSON envelope')
    .action(
      createAsyncCommand(async options => {
        await withJson(Boolean(options.json), () =>
          runUiGenerate({
            json: Boolean(options.json),
            prompt: options.prompt,
            name: options.name,
            group: options.group,
            ui: options.ui,
            workspace: options.workspace,
            offline: Boolean(options.offline),
            dryRun: Boolean(options.dryRun),
            force: Boolean(options.force),
          })
        );
      })
    );

  // ---- theme --------------------------------------------------------------
  const theme = ui.command('theme').description('Dashboard theme packs (npm keyword: reshell-theme)');
  theme
    .command('search [query]')
    .description('Search the npm registry for theme packs')
    .option('--limit <n>', 'Maximum results', value => Number.parseInt(value, 10), 20)
    .option('--json', 'Output the result as a JSON envelope')
    .action(
      createAsyncCommand(async (query: string | undefined, options) => {
        await withJson(Boolean(options.json), () =>
          runUiThemeSearch(query, { json: Boolean(options.json), limit: options.limit })
        );
      })
    );
  theme
    .command('install <source>')
    .description('Install a theme pack from an npm package, a URL or a local JSON file')
    .option('--workspace <path>', 'Workspace root', process.cwd())
    .option('--force', 'Replace an already installed pack of the same id')
    .option('--dry-run', 'Validate and report without installing')
    .option('--json', 'Output the result as a JSON envelope')
    .action(
      createAsyncCommand(async (source: string, options) => {
        await withJson(Boolean(options.json), () =>
          runUiThemeInstall(source, {
            json: Boolean(options.json),
            workspace: options.workspace,
            force: Boolean(options.force),
            dryRun: Boolean(options.dryRun),
          })
        );
      })
    );
  theme
    .command('list')
    .description('List installed theme packs')
    .option('--workspace <path>', 'Workspace root', process.cwd())
    .option('--json', 'Output the result as a JSON envelope')
    .action(
      createAsyncCommand(async options => {
        await withJson(Boolean(options.json), () =>
          runUiThemeList({ json: Boolean(options.json), workspace: options.workspace })
        );
      })
    );
  theme
    .command('remove <id>')
    .description('Remove an installed theme pack')
    .option('--workspace <path>', 'Workspace root', process.cwd())
    .option('--json', 'Output the result as a JSON envelope')
    .action(
      createAsyncCommand(async (id: string, options) => {
        await withJson(Boolean(options.json), () =>
          runUiThemeRemove(id, { json: Boolean(options.json), workspace: options.workspace })
        );
      })
    );
}
