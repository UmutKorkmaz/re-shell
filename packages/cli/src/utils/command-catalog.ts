import { Command, Option, Argument } from 'commander';

/**
 * A single declared argument for a catalog entry.
 *
 * Represents one positional argument of a CLI command, including whether the
 * argument must be supplied by the user.
 */
export interface CatalogArg {
  /** Human-readable name of the argument as declared by the command. */
  name: string;
  /** Whether the user must provide this argument when invoking the command. */
  required: boolean;
}

/**
 * A single declared flag/option for a catalog entry.
 *
 * Describes one Commander-style option (e.g. `--json`, `--output <file>`) that
 * a command accepts, including whether it consumes a value and any default.
 */
export interface CatalogFlag {
  /** Canonical flag name, preferring the long form (e.g. `--json`). */
  name: string;
  /** Help text describing the flag's purpose. */
  description: string;
  /** Default value applied when the flag is omitted, if any. */
  default?: unknown;
  /** Whether the flag expects a value (as opposed to a boolean switch). */
  takesValue: boolean;
}

/**
 * A flattened, machine-readable description of a single CLI command, suitable
 * for powering a Command Builder UI. One entry is produced per leaf command and
 * per group/subgroup that has its own action — i.e. anything that can be run.
 */
export interface CommandCatalogEntry {
  /** Space-delimited command path from the program root (e.g. `service run`). */
  path: string;
  /** Alternative names the command can be invoked by. */
  aliases: string[];
  /** Human-readable description of what the command does. */
  description: string;
  /** Positional arguments declared by the command. */
  args: CatalogArg[];
  /** Flags/options declared by the command. */
  flags: CatalogFlag[];
  /** Whether the command supports machine-readable JSON output. */
  supportsJson: boolean;
  /** Whether the command supports a dry-run (no side effects) mode. */
  supportsDryRun: boolean;
  /** Whether the command may cause data loss or irreversible side effects. */
  destructive: boolean;
  /**
   * Present (and `true`) only for entries emitted with `includeHidden`: the
   * command is hidden from `--help` (for example a deprecated alias stub).
   */
  hidden?: boolean;
  /** Present only on deprecated alias stubs: the command path that replaces it. */
  replacedBy?: string;
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

/**
 * Replacement path for each deprecated alias stub. Populated by
 * {@link markDeprecatedAlias} (called from `src/aliases.ts`) so the catalog can
 * tell a deprecated stub from a genuinely hidden command without parsing its
 * description.
 */
const deprecatedAliasTargets = new WeakMap<Command, string>();

/**
 * Record that `command` is a deprecated alias stub superseded by `replacement`.
 *
 * @param command - The deprecated stub.
 * @param replacement - The command path that replaces it (e.g. `config diff`).
 */
export function markDeprecatedAlias(command: Command, replacement: string): void {
  deprecatedAliasTargets.set(command, replacement);
}

/**
 * One reachable command in the live Commander tree, as visited by
 * {@link walkCommandTree}.
 */
export interface CommandTreeNode {
  /** Space-delimited command path from the program root (e.g. `workspace graph`). */
  path: string;
  /** The Commander command itself. */
  command: Command;
  /** Hidden from `--help`, directly or because an ancestor is hidden. */
  hidden: boolean;
  /** Whether the command has its own action handler (can actually be run). */
  runnable: boolean;
  /** Replacement path when this is a deprecated alias stub. */
  replacedBy?: string;
}

/** Options for {@link walkCommandTree}. */
export interface WalkCommandTreeOptions {
  /** Also visit commands hidden from `--help`. Defaults to `false`. */
  includeHidden?: boolean;
}

/**
 * Walk every command Commander can actually dispatch to, depth-first, parents
 * before children, in registration order.
 *
 * This is the single traversal behind both the command catalog
 * (`commands list --json`) and shell completion, so the two can never disagree
 * about what the CLI offers.
 *
 * Commander resolves `argv` against the *first* registered sibling matching a
 * name or alias, so a later sibling with an already-claimed name is unreachable
 * (a shadow). Shadows are skipped (and not descended into): listing them would
 * advertise commands the CLI will never run, which is how a deprecated alias
 * registered beside a new command used to appear twice in the catalog.
 *
 * @param program - The root Commander program.
 * @param visit - Called once per reachable command.
 * @param options - Traversal options.
 */
export function walkCommandTree(
  program: Command,
  visit: (node: CommandTreeNode) => void,
  options: WalkCommandTreeOptions = {}
): void {
  const includeHidden = options.includeHidden === true;

  const walk = (parent: Command, parentPath: string, parentHidden: boolean): void => {
    const visible = new Set<Command>(parent.createHelp().visibleCommands(parent));
    const claimed = new Set<string>();

    for (const child of parent.commands) {
      if (isHelpCommand(child)) {
        continue;
      }

      const names = [child.name(), ...child.aliases()];
      if (claimed.has(child.name())) {
        continue; // shadowed by an earlier sibling: unreachable
      }
      names.forEach(name => claimed.add(name));

      const hidden = parentHidden || !visible.has(child);
      if (hidden && !includeHidden) {
        continue;
      }

      const path = parentPath ? `${parentPath} ${child.name()}` : child.name();
      const replacedBy = deprecatedAliasTargets.get(child);
      visit({
        path,
        command: child,
        hidden,
        runnable: isRunnable(child),
        ...(replacedBy ? { replacedBy } : {}),
      });

      if (child.commands.length > 0) {
        walk(child, path, hidden);
      }
    }
  };

  walk(program, '', false);
}

/** Options for {@link buildCommandCatalog}. */
export interface BuildCommandCatalogOptions {
  /**
   * Include commands hidden from `--help` (deprecated alias stubs and the like).
   * They are flagged `hidden: true` (and `replacedBy` when deprecated). Defaults
   * to `false`: hidden commands are not part of the advertised surface.
   */
  includeHidden?: boolean;
}

/**
 * Walk the program's command tree (including nested subgroups) and produce a
 * flat catalog of every runnable command, with accurate args, flags, and
 * derived metadata (JSON/dry-run support, destructiveness).
 *
 * Only commands the CLI can actually dispatch to are listed: shadowed
 * duplicates are dropped and, unless `includeHidden` is set, so are commands
 * hidden from `--help` (the deprecated flat-name aliases).
 *
 * Entries are returned sorted by `path` for stable, diff-friendly output.
 *
 * @param program - The root Commander program to inspect.
 * @param options - Catalog options.
 * @returns A sorted array of catalog entries, one per runnable command.
 */
export function buildCommandCatalog(
  program: Command,
  options: BuildCommandCatalogOptions = {}
): CommandCatalogEntry[] {
  const out: CommandCatalogEntry[] = [];
  walkCommandTree(
    program,
    node => {
      if (!node.runnable) {
        return;
      }
      const entry = buildEntry(node.command, node.path);
      if (node.hidden) {
        entry.hidden = true;
      }
      if (node.replacedBy) {
        entry.replacedBy = node.replacedBy;
      }
      out.push(entry);
    },
    { includeHidden: options.includeHidden }
  );
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
