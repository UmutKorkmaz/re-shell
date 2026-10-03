// `re-shell ui theme search|install|list|remove`: the theme marketplace.
//
// Packs are discovered through the same npm registry client as plugins (keyword
// `reshell-theme`), validated by the contracts schema (OKLCH tokens, radius, font
// stacks, WCAG AA contrast), and stored under `<workspace>/.re-shell/themes/`.
// The dashboard installs the same packs at runtime (Settings -> Appearance).

import chalk from 'chalk';
import { fail, ok } from '../utils/json-output';
import { RegistryClient, RegistryUnreachableError, type FetchLike } from '../utils/registry-client';
import {
  ThemeRegistryError,
  classifyThemeIdentifier,
  fetchThemeFromNpm,
  fetchThemeUrl,
  readThemeFile,
  searchThemes,
  type ResolvedTheme,
  type ThemeSearchHit,
} from '../utils/ui-theme-registry';
import {
  ThemeStoreError,
  installThemePack,
  listThemes,
  removeThemePack,
  type ThemeIndexEntry,
} from '../utils/ui-theme-store';

/** Shared options. */
export interface UiThemeBaseOptions {
  json?: boolean;
  workspace?: string;
  /** Injected registry client (tests). */
  client?: RegistryClient;
  /** Injected fetch (tests). */
  fetch?: typeof fetch;
}

function workspaceOf(options: UiThemeBaseOptions): string {
  return options.workspace ?? process.cwd();
}

function clientOf(options: UiThemeBaseOptions): RegistryClient {
  return options.client ?? new RegistryClient(options.fetch ? { fetchImpl: options.fetch as unknown as FetchLike } : {});
}

function reportError(json: boolean, error: unknown): void {
  let code: 'UI_THEME_ERROR' | 'MARKETPLACE_UNREACHABLE' = 'UI_THEME_ERROR';
  let message: string;
  let details: Record<string, unknown> | undefined;
  if (error instanceof RegistryUnreachableError) {
    code = 'MARKETPLACE_UNREACHABLE';
    message = error.message;
    details = error.details;
  } else if (error instanceof ThemeRegistryError || error instanceof ThemeStoreError) {
    message = error.message;
    details = error.details;
    if (details?.kind === 'unreachable') code = 'MARKETPLACE_UNREACHABLE';
  } else {
    throw error;
  }
  if (json) {
    fail(code, message, details);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

// --- search ---------------------------------------------------------------

/** Options of `ui theme search`. */
export interface UiThemeSearchOptions extends UiThemeBaseOptions {
  limit?: number;
}

/** Payload of `ui theme search --json`. */
export interface UiThemeSearchResponse {
  keyword: string;
  query: string | null;
  themes: ThemeSearchHit[];
}

export async function runUiThemeSearch(query: string | undefined, options: UiThemeSearchOptions): Promise<void> {
  const json = Boolean(options.json);
  try {
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const themes = await searchThemes(clientOf(options), query, limit);
    const payload: UiThemeSearchResponse = { keyword: 'reshell-theme', query: query ?? null, themes };
    if (json) {
      ok(payload, themes.length === 0 ? ['no theme packages matched'] : []);
      return;
    }
    process.stdout.write(chalk.cyan.bold('\n▶ ui theme search\n\n'));
    if (themes.length === 0) process.stdout.write(chalk.gray('  no theme packages matched\n'));
    for (const theme of themes) {
      process.stdout.write(`  ${chalk.bold(theme.name)} ${chalk.gray(theme.version)}${theme.description ? `  ${theme.description}` : ''}\n`);
    }
    process.stdout.write(chalk.gray('\n  Install one with: re-shell ui theme install <name>\n\n'));
  } catch (error) {
    reportError(json, error);
  }
}

// --- install --------------------------------------------------------------

/** Options of `ui theme install`. */
export interface UiThemeInstallOptions extends UiThemeBaseOptions {
  force?: boolean;
  dryRun?: boolean;
}

/** Payload of `ui theme install --json`. */
export interface UiThemeInstallResponse {
  theme: ThemeIndexEntry | { id: string; name: string; version: string };
  dryRun: boolean;
  schemes: Array<'light' | 'dark'>;
  /** Hint for using the pack in the dashboard. */
  dashboard: string;
}

export async function runUiThemeInstall(identifier: string, options: UiThemeInstallOptions): Promise<void> {
  const json = Boolean(options.json);
  try {
    const kind = classifyThemeIdentifier(identifier);
    let resolved: ResolvedTheme;
    if (kind === 'file') resolved = readThemeFile(identifier);
    else if (kind === 'url') resolved = await fetchThemeUrl(identifier, options.fetch);
    else resolved = await fetchThemeFromNpm(identifier, clientOf(options), options.fetch);

    const { pack, meta } = resolved;
    const schemes = (['light', 'dark'] as const).filter((scheme) => pack.colors[scheme] !== undefined);
    const dryRun = Boolean(options.dryRun);
    const theme = dryRun
      ? { id: pack.id, name: pack.name, version: pack.version }
      : installThemePack(workspaceOf(options), pack, meta, { force: options.force });
    const payload: UiThemeInstallResponse = {
      theme,
      dryRun,
      schemes,
      dashboard: `Import .re-shell/themes/${pack.id}.json in the dashboard: Settings -> Appearance -> Install from file.`,
    };
    const warnings: string[] = [];
    if (!dryRun && 'signature' in theme && theme.signature && !theme.signature.verified) {
      warnings.push(`registry signature not verified: ${theme.signature.reason ?? 'unsigned'} (tarball integrity was verified)`);
    }
    if (json) {
      ok(payload, warnings);
      return;
    }
    process.stdout.write(chalk.cyan.bold(`\n▶ ui theme install ${identifier}\n\n`));
    process.stdout.write(`  ${chalk.green(dryRun ? 'Would install' : 'Installed')}  ${pack.name} ${chalk.gray(`(${pack.id}@${pack.version}, ${schemes.join(' + ')})`)}\n`);
    for (const warning of warnings) process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
    process.stdout.write(chalk.gray(`\n  ${payload.dashboard}\n\n`));
  } catch (error) {
    reportError(json, error);
  }
}

// --- list -----------------------------------------------------------------

/** Payload of `ui theme list --json`. */
export interface UiThemeListResponse {
  directory: string;
  themes: ThemeIndexEntry[];
}

export async function runUiThemeList(options: UiThemeBaseOptions): Promise<void> {
  const json = Boolean(options.json);
  try {
    const themes = listThemes(workspaceOf(options));
    const payload: UiThemeListResponse = { directory: '.re-shell/themes', themes };
    if (json) {
      ok(payload);
      return;
    }
    process.stdout.write(chalk.cyan.bold('\n▶ ui theme list\n\n'));
    if (themes.length === 0) process.stdout.write(chalk.gray('  no themes installed (re-shell ui theme search)\n'));
    for (const theme of themes) {
      process.stdout.write(`  ${chalk.bold(theme.id)} ${chalk.gray(theme.version)}  ${theme.name}  ${chalk.gray(`[${theme.source}: ${theme.origin}]`)}\n`);
    }
    process.stdout.write('\n');
  } catch (error) {
    reportError(json, error);
  }
}

// --- remove ---------------------------------------------------------------

/** Payload of `ui theme remove --json`. */
export interface UiThemeRemoveResponse {
  removed: ThemeIndexEntry;
}

export async function runUiThemeRemove(id: string, options: UiThemeBaseOptions): Promise<void> {
  const json = Boolean(options.json);
  try {
    const removed = removeThemePack(workspaceOf(options), id);
    if (json) {
      ok<UiThemeRemoveResponse>({ removed });
      return;
    }
    process.stdout.write(chalk.cyan.bold(`\n▶ ui theme remove ${id}\n\n`));
    process.stdout.write(`  ${chalk.green('Removed')}  ${removed.name} ${chalk.gray(`(${removed.id}@${removed.version})`)}\n\n`);
  } catch (error) {
    reportError(json, error);
  }
}
