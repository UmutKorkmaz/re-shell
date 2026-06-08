import { Command, Option, Argument } from 'commander';

/**
 * A single declared argument for a catalog entry.
 */
export interface CatalogArg {
  name: string;
  required: boolean;
}

/**
 * A single declared flag/option for a catalog entry.
 */
export interface CatalogFlag {
  name: string;
  description: string;
  default?: unknown;
  takesValue: boolean;
}

/**
 * A flattened, machine-readable description of a single CLI command, suitable
 * for powering a Command Builder UI. One entry is produced per leaf command and
 * per group/subgroup that has its own action — i.e. anything that can be run.
 */
export interface CommandCatalogEntry {
  path: string;
  aliases: string[];
  description: string;
  args: CatalogArg[];
  flags: CatalogFlag[];
  supportsJson: boolean;
  supportsDryRun: boolean;
  destructive: boolean;
}

/**
 * Verbs that mark a command as destructive (data loss / irreversible side
 * effects). Matched against the leaf command name. `service down` is matched as
 * a full path suffix because "down" alone is too generic.
 */
const DESTRUCTIVE_VERBS: ReadonlySet<string> = new Set([
  'uninstall',
  'delete',
  'remove',
  'clear',
  'reset',
  'rollback',
  'restore',
  'prune',
]);

/**
 * Destructive commands that cannot be identified by a single leaf verb. The
 * service teardown command (`down`) is only destructive in the service context,
 * so it is matched as a path suffix (covers both `service down` and the actual
 * `service run down` shape) rather than by leaf name.
 */
const DESTRUCTIVE_PATH_SUFFIXES: readonly string[] = ['service down', 'service run down'];

/**
 * Commander auto-registers a `help` command on groups; it carries no real
 * payload for a Command Builder, so we skip it.
 */
function isHelpCommand(command: Command): boolean {
  return command.name() === 'help';
}

/**
 * A flag "takes a value" when its declaration includes a `<value>` / `[value]`
 * placeholder. Commander exposes this via `required` (mandatory value) or
 * `optional` (optional value); plain boolean switches have neither.
 */
function flagTakesValue(option: Option): boolean {
  if (option.required || option.optional) {
    return true;
  }
  // Fallback to inspecting the raw flags string in case the option was built
  // without going through the required/optional setters.
  return /[<[]/.test(option.flags);
}

function toCatalogFlag(option: Option): CatalogFlag {
  const flag: CatalogFlag = {
    name: option.long || option.short || option.flags,
    description: option.description || '',
    takesValue: flagTakesValue(option),
  };
  if (option.defaultValue !== undefined) {
    flag.default = option.defaultValue;
  }
  return flag;
}

function toCatalogArg(argument: Argument): CatalogArg {
  return {
    name: argument.name(),
    required: argument.required,
  };
}

function hasJsonFlag(flags: readonly CatalogFlag[]): boolean {
  return flags.some(f => f.name === '--json' || f.name === '--json-output');
}

function hasDryRunFlag(flags: readonly CatalogFlag[]): boolean {
  return flags.some(f => f.name === '--dry-run');
}

function isDestructive(path: string, leafName: string): boolean {
  if (DESTRUCTIVE_VERBS.has(leafName)) {
    return true;
  }
  return DESTRUCTIVE_PATH_SUFFIXES.some(suffix => path === suffix || path.endsWith(` ${suffix}`));
}

/**
 * A command is "runnable" if it has its own action handler. Pure groups that
 * only namespace subcommands (no `.action(...)`) are walked into but are not
 * emitted as catalog entries themselves.
 */
function isRunnable(command: Command): boolean {
  // Commander stores the registered action callback on a private field.
  return typeof (command as unknown as { _actionHandler?: unknown })._actionHandler === 'function';
}

function buildEntry(command: Command, path: string): CommandCatalogEntry {
  const flags = command.options.map(toCatalogFlag);
  return {
    path,
    aliases: [...command.aliases()],
    description: command.description() || '',
    args: command.registeredArguments.map(toCatalogArg),
    flags,
    supportsJson: hasJsonFlag(flags),
    supportsDryRun: hasDryRunFlag(flags),
    destructive: isDestructive(path, command.name()),
  };
}

function walk(command: Command, parentPath: string, out: CommandCatalogEntry[]): void {
  for (const child of command.commands) {
    if (isHelpCommand(child)) {
      continue;
    }

    const path = parentPath ? `${parentPath} ${child.name()}` : child.name();

    if (isRunnable(child)) {
      out.push(buildEntry(child, path));
    }

    if (child.commands.length > 0) {
      walk(child, path, out);
    }
  }
}

/**
 * Walk the program's command tree (including nested subgroups) and produce a
 * flat catalog of every runnable command, with accurate args, flags, and
 * derived metadata (JSON/dry-run support, destructiveness).
 *
 * Entries are returned sorted by `path` for stable, diff-friendly output.
 */
export function buildCommandCatalog(program: Command): CommandCatalogEntry[] {
  const out: CommandCatalogEntry[] = [];
  walk(program, '', out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
