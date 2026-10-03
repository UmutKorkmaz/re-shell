/**
 * Lazy registrar for command groups.
 *
 * Registers a lightweight stub (name, description, positional args, `[options]`
 * marker) for every entry of the static {@link GROUP_MANIFEST}, and loads the
 * real group module only when argv selects that command. This keeps
 * `--help`, `--version` and any single-group invocation from importing the
 * ~30 heavy `groups/*.group.ts` modules.
 *
 * Consumers that need the whole command tree (the command catalog behind
 * `commands list`, `find`, `ai`, `agents`) call {@link ensureFullCommandTree};
 * `buildCommandCatalog` does this itself, so new introspection features are
 * covered automatically.
 */
import { Command, Option } from 'commander';
import { GROUP_MANIFEST, type GroupManifestEntry } from './command-manifest';

type RegisterFn = (program: Command) => void;

export interface LazyGroupOptions {
  /** Override the manifest (tests). */
  manifest?: readonly GroupManifestEntry[];
  /** Override how a group module is resolved (tests run TS sources through vite). */
  loadRegister?: (entry: GroupManifestEntry) => RegisterFn;
  /** Load every group up front (also enabled by RE_SHELL_EAGER_COMMANDS=1). */
  eager?: boolean;
}

interface LazyState {
  manifest: readonly GroupManifestEntry[];
  loadRegister: (entry: GroupManifestEntry) => RegisterFn;
  stubs: Map<GroupManifestEntry, Command>;
  loaded: Set<GroupManifestEntry>;
}

const states = new WeakMap<Command, LazyState>();

function defaultLoadRegister(entry: GroupManifestEntry): RegisterFn {
  // Resolved relative to this file (src/ or dist/), so `./groups/x.group` works
  // for both ts-compiled output and the published package.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(entry.module);
  const fn = mod[entry.register];
  if (typeof fn !== 'function') {
    throw new Error(
      `command-manifest: ${entry.module} does not export a function named "${entry.register}"`
    );
  }
  return fn as RegisterFn;
}

/**
 * Work out which top-level command argv will dispatch to. Mirrors commander's
 * behaviour for this CLI (only `-h/-V`-style global flags precede the command;
 * `help <cmd>` targets `<cmd>`). Returns undefined for bare/flag-only argv.
 */
export function resolveSelectedCommand(args: readonly string[]): string | undefined {
  // Stop at `--`: anything after is not a command selector.
  const dashDash = args.indexOf('--');
  const scanned = dashDash === -1 ? args : args.slice(0, dashDash);
  const candidates = scanned.filter(a => !a.startsWith('-'));
  if (candidates.length === 0) return undefined;
  if (candidates[0] === 'help') return candidates[1];
  return candidates[0];
}

function makeStub(entry: GroupManifestEntry): Command {
  const stub = new Command(entry.name).description(entry.description ?? '');
  for (const arg of entry.args ?? []) stub.argument(arg);
  if (entry.hasOptions) stub.addOption(new Option('--lazy-stub').hideHelp());
  stub.allowUnknownOption().allowExcessArguments();
  stub.action(() => {
    throw new Error(
      `internal error: lazy stub for "${entry.name}" was dispatched without loading ${entry.module}. ` +
        'Set RE_SHELL_EAGER_COMMANDS=1 as a workaround and report this.'
    );
  });
  return stub;
}

function replaceCommands(program: Command, ordered: Command[]): void {
  (program.commands as Command[]).splice(0, program.commands.length, ...ordered);
}

function loadEntry(program: Command, state: LazyState, entry: GroupManifestEntry): void {
  if (state.loaded.has(entry)) return;
  state.loaded.add(entry);

  const before = [...program.commands];
  const stub = state.stubs.get(entry);
  if (stub) {
    (program.commands as Command[]).splice(program.commands.indexOf(stub), 1);
  }

  state.loadRegister(entry)(program);

  if (stub) {
    // Put the real command(s) exactly where the stub was so help order is stable.
    const added = program.commands.filter(c => !before.includes(c));
    replaceCommands(
      program,
      before.flatMap(c => (c === stub ? added : [c]))
    );
    state.stubs.delete(entry);
  }
}

/**
 * Register all manifest groups on `program` as stubs, loading the groups that
 * `args` (argv without node/script) selects. Call once, after standalone
 * commands are registered and before aliases.
 */
export function registerLazyGroups(
  program: Command,
  args: readonly string[],
  options: LazyGroupOptions = {}
): void {
  const state: LazyState = {
    manifest: options.manifest ?? GROUP_MANIFEST,
    loadRegister: options.loadRegister ?? defaultLoadRegister,
    stubs: new Map(),
    loaded: new Set(),
  };
  states.set(program, state);

  const eager = options.eager ?? process.env.RE_SHELL_EAGER_COMMANDS === '1';
  const selected = resolveSelectedCommand(args);

  for (const entry of state.manifest) {
    const isSelected = eager || (selected !== undefined && (entry.name === selected || entry.attachesTo === selected));
    if (isSelected) {
      loadEntry(program, state, entry);
    } else if (!entry.attachesTo) {
      const stub = makeStub(entry);
      state.stubs.set(entry, stub);
      program.addCommand(stub);
    }
  }
}

/**
 * Replace every remaining stub with its real command (a no-op when the program
 * was not built through {@link registerLazyGroups}). Cheap to call repeatedly.
 */
export function ensureFullCommandTree(program: Command): void {
  const state = states.get(program);
  if (!state) return;
  for (const entry of state.manifest) loadEntry(program, state, entry);
}
