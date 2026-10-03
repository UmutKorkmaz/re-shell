import type { Command, Option } from 'commander';
import { walkCommandTree } from './command-catalog';

/**
 * Shell completion generated from the live Commander tree.
 *
 * The command list is never written down here: it is read from the same
 * traversal ({@link walkCommandTree}) that powers `commands list --json`, so a
 * command added to (or removed from) the CLI shows up in completion with no
 * further change, and hidden/deprecated aliases and shadowed duplicates never do.
 */

/** A flag offered for completion. */
export interface CompletionOption {
  /** Long form (`--json`) when there is one, else the short form. */
  flag: string;
  /** Short form (`-y`) when the option declares both. */
  short?: string;
  description: string;
  /** Allowed values when the option restricts them (`Option.choices`). */
  choices?: string[];
}

/** One command in the completion tree. */
export interface CompletionNode {
  name: string;
  aliases: string[];
  description: string;
  options: CompletionOption[];
  children: CompletionNode[];
}

/** Shells completion scripts can be generated for. */
export const COMPLETION_SHELLS = ['bash', 'zsh'] as const;
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

/** Narrow an arbitrary string to a supported shell. */
export function isCompletionShell(value: string): value is CompletionShell {
  return (COMPLETION_SHELLS as readonly string[]).includes(value);
}

function toCompletionOption(option: Option): CompletionOption {
  const choices = (option as Option & { argChoices?: string[] }).argChoices;
  return {
    flag: option.long || option.short || option.flags,
    ...(option.long && option.short ? { short: option.short } : {}),
    description: (option.description || '').split('\n')[0].trim(),
    ...(choices && choices.length > 0 ? { choices: [...choices] } : {}),
  };
}

function toNode(command: Command, name: string): CompletionNode {
  return {
    name,
    aliases: [...command.aliases()],
    description: (command.description() || '').split('\n')[0].trim(),
    options: command.options.filter(o => !o.hidden).map(toCompletionOption),
    children: [],
  };
}

/**
 * Build the completion tree for the live program: the root plus every command
 * reachable from `--help` (see {@link walkCommandTree}), nested by path.
 *
 * @param program - The root Commander program.
 * @returns The root node; `children` are the top-level commands.
 */
export function buildCompletionTree(program: Command): CompletionNode {
  const root = toNode(program, program.name());
  const byPath = new Map<string, CompletionNode>([['', root]]);

  walkCommandTree(program, node => {
    const segments = node.path.split(' ');
    const name = segments[segments.length - 1];
    const parent = byPath.get(segments.slice(0, -1).join(' '));
    if (!parent) {
      return;
    }
    const completionNode = toNode(node.command, name);
    parent.children.push(completionNode);
    byPath.set(node.path, completionNode);
  });

  return root;
}

/** A command path (`['workspace', 'graph']`) with every spelling (name + aliases) per segment. */
interface PathVariants {
  /** One entry per segment; each is the list of accepted spellings. */
  spellings: string[][];
  node: CompletionNode;
}

function collectPaths(root: CompletionNode): PathVariants[] {
  const out: PathVariants[] = [{ spellings: [], node: root }];
  const visit = (node: CompletionNode, prefix: string[][]): void => {
    for (const child of node.children) {
      const spellings = [...prefix, [child.name, ...child.aliases]];
      out.push({ spellings, node: child });
      visit(child, spellings);
    }
  };
  visit(root, []);
  return out;
}

/** Expand `[[a, b], [c]]` into `['a c', 'b c']`. Bounded so alias chains cannot explode. */
function expandPaths(spellings: string[][]): string[] {
  let acc: string[] = [''];
  for (const options of spellings) {
    const next: string[] = [];
    for (const prefix of acc) {
      for (const option of options) {
        next.push(prefix ? `${prefix} ${option}` : option);
      }
    }
    acc = next;
    if (acc.length > 64) {
      acc = acc.slice(0, 64);
    }
  }
  return acc;
}

function shellWords(node: CompletionNode): string[] {
  return node.children.flatMap(c => [c.name, ...c.aliases]);
}

function flagWords(node: CompletionNode, isRoot: boolean): string[] {
  const words = new Set<string>();
  for (const option of node.options) {
    words.add(option.flag);
    if (option.short) words.add(option.short);
  }
  words.add('--help');
  if (isRoot) words.add('-h');
  return [...words];
}

/** Single-quote a string for POSIX shell, escaping embedded single quotes. */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const BASH_HEADER = (): string =>
  [
    '# re-shell bash completion',
    '# Generated from the live command tree by `re-shell completion --print --shell bash`.',
    '# Re-run `re-shell completion` after upgrading the CLI to pick up new commands.',
  ].join('\n');

/**
 * Render a bash completion script from the live tree.
 *
 * The script embeds every command path and flag as plain `case` tables (no
 * associative arrays, so it works on bash 3.2) and resolves the typed command
 * path at completion time, so nested subcommands (`workspace graph-analysis
 * cycles`) and aliases complete, not just the top level.
 *
 * @param root - Tree from {@link buildCompletionTree}.
 * @returns The script text.
 */
export function renderBashCompletion(root: CompletionNode): string {
  const paths = collectPaths(root);

  const subcommandCases: string[] = [];
  const flagCases: string[] = [];
  const valueCases: string[] = [];

  for (const { spellings, node } of paths) {
    const keys = expandPaths(spellings);
    const pattern = keys.map(k => shQuote(k)).join('|');
    subcommandCases.push(`    ${pattern}) printf '%s\\n' ${shQuote(shellWords(node).join(' '))} ;;`);
    flagCases.push(
      `    ${pattern}) printf '%s\\n' ${shQuote(flagWords(node, spellings.length === 0).join(' '))} ;;`
    );
    for (const option of node.options) {
      if (!option.choices) continue;
      const flags = [option.flag, ...(option.short ? [option.short] : [])];
      for (const key of keys) {
        for (const flag of flags) {
          valueCases.push(
            `    ${shQuote(`${key} ${flag}`.trim())}) printf '%s\\n' ${shQuote(option.choices.join(' '))} ;;`
          );
        }
      }
    }
  }

  return `${BASH_HEADER()}

# Prints the subcommands of command path "$1" (possibly nothing); fails when "$1"
# is not a known command path.
_re_shell_subcommands() {
  case "$1" in
${subcommandCases.join('\n')}
    *) return 1 ;;
  esac
}

# Prints the flags accepted by command path "$1".
_re_shell_flags() {
  case "$1" in
${flagCases.join('\n')}
    *) return 1 ;;
  esac
}

# Prints the allowed values for "<command path> <flag>" when the flag restricts them.
_re_shell_flag_values() {
  case "$1" in
${valueCases.length > 0 ? valueCases.join('\n') + '\n' : ''}    *) return 1 ;;
  esac
}

_re_shell_completions() {
  local cur prev cmdpath="" i w next words
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev=""
  if (( COMP_CWORD > 0 )); then
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
  fi

  # Resolve the command path typed so far: words that continue a known path
  # extend it; flags and flag values are skipped.
  for (( i = 1; i < COMP_CWORD; i++ )); do
    w="\${COMP_WORDS[i]}"
    case "$w" in -*) continue ;; esac
    next="\${cmdpath:+$cmdpath }$w"
    if _re_shell_subcommands "$next" >/dev/null; then
      cmdpath="$next"
    fi
  done

  COMPREPLY=()

  # A flag with a fixed set of values: complete the value.
  if words="$(_re_shell_flag_values "\${cmdpath:+$cmdpath }$prev")"; then
    COMPREPLY=( $(compgen -W "$words" -- "$cur") )
    return 0
  fi

  case "$cur" in
    -*)
      words="$(_re_shell_flags "$cmdpath")"
      COMPREPLY=( $(compgen -W "$words" -- "$cur") )
      ;;
    *)
      words="$(_re_shell_subcommands "$cmdpath")"
      if [[ -n "$words" ]]; then
        COMPREPLY=( $(compgen -W "$words" -- "$cur") )
      else
        COMPREPLY=( $(compgen -f -- "$cur") )
      fi
      ;;
  esac
  return 0
}

complete -F _re_shell_completions re-shell
`;
}

/** Escape a `_describe` entry name (a colon separates name from description). */
function zshName(name: string): string {
  return name.replace(/([:\\])/g, '\\$1');
}

/** Single-quote a zsh `_describe` entry. */
function zshEntry(name: string, description: string): string {
  const text = `${zshName(name)}:${description.replace(/\s+/g, ' ').trim()}`;
  return shQuote(text);
}

/**
 * Render a zsh completion script from the live tree. Same structure as the bash
 * script (path tables resolved at completion time) but presented through
 * `_describe` so command and flag descriptions are shown.
 *
 * @param root - Tree from {@link buildCompletionTree}.
 * @returns The script text.
 */
export function renderZshCompletion(root: CompletionNode): string {
  const paths = collectPaths(root);

  const subcommandCases: string[] = [];
  const flagCases: string[] = [];
  const valueCases: string[] = [];

  for (const { spellings, node } of paths) {
    const keys = expandPaths(spellings);
    const pattern = keys.map(k => shQuote(k)).join('|');

    const subs: string[] = [];
    for (const child of node.children) {
      subs.push(zshEntry(child.name, child.description));
      for (const alias of child.aliases) {
        subs.push(zshEntry(alias, child.description));
      }
    }
    subcommandCases.push(`    ${pattern}) _rs_out=( ${subs.join(' ')} ) ;;`);

    const flags: string[] = [];
    for (const option of node.options) {
      flags.push(zshEntry(option.flag, option.description));
      if (option.short) flags.push(zshEntry(option.short, option.description));
    }
    flags.push(zshEntry('--help', 'Display help'));
    if (spellings.length === 0) flags.push(zshEntry('-h', 'Display help'));
    flagCases.push(`    ${pattern}) _rs_out=( ${flags.join(' ')} ) ;;`);

    for (const option of node.options) {
      if (!option.choices) continue;
      const optionFlags = [option.flag, ...(option.short ? [option.short] : [])];
      for (const key of keys) {
        for (const flag of optionFlags) {
          valueCases.push(
            `    ${shQuote(`${key} ${flag}`.trim())}) _rs_out=( ${option.choices.map(c => shQuote(c)).join(' ')} ) ;;`
          );
        }
      }
    }
  }

  return `#compdef re-shell
# zsh completion for re-shell
# Generated from the live command tree by \`re-shell completion --print --shell zsh\`.
# Re-run \`re-shell completion\` after upgrading the CLI to pick up new commands.

# Sets \`_rs_out\` to the "name:description" subcommands of command path "$1"; fails
# when "$1" is not a known command path.
_re_shell_subcommands() {
  _rs_out=()
  case "$1" in
${subcommandCases.join('\n')}
    *) return 1 ;;
  esac
}

# Sets \`_rs_out\` to the "flag:description" entries accepted by command path "$1".
_re_shell_flags() {
  _rs_out=()
  case "$1" in
${flagCases.join('\n')}
    *) return 1 ;;
  esac
}

# Sets \`_rs_out\` to the allowed values for "<command path> <flag>" when restricted.
_re_shell_flag_values() {
  _rs_out=()
  case "$1" in
${valueCases.length > 0 ? valueCases.join('\n') + '\n' : ''}    *) return 1 ;;
  esac
}

_re_shell() {
  local cmdpath="" next w i
  local -a _rs_out

  # Resolve the command path typed so far; flags and flag values are skipped.
  for (( i = 2; i < CURRENT; i++ )); do
    w="\${words[i]}"
    [[ "$w" == -* ]] && continue
    next="\${cmdpath:+$cmdpath }$w"
    if _re_shell_subcommands "$next"; then
      cmdpath="$next"
    fi
  done

  # A flag with a fixed set of values: complete the value.
  if _re_shell_flag_values "\${cmdpath:+$cmdpath }\${words[CURRENT-1]}"; then
    compadd -- "\${_rs_out[@]}"
    return
  fi

  if [[ "\${words[CURRENT]}" == -* ]]; then
    _re_shell_flags "$cmdpath"
    _describe -t options 'option' _rs_out
    return
  fi

  _re_shell_subcommands "$cmdpath"
  if (( \${#_rs_out} )); then
    _describe -t commands 'command' _rs_out
  else
    _files
  fi
}

if [[ "\$funcstack[1]" == "_re-shell" || "\$funcstack[1]" == "_re_shell" ]]; then
  _re_shell "$@"
else
  compdef _re_shell re-shell
fi
`;
}

/**
 * Generate the completion script for `shell` from the live program.
 *
 * @param program - The root Commander program.
 * @param shell - Target shell.
 * @returns The script text, ending with a newline.
 */
export function generateCompletionScript(program: Command, shell: CompletionShell): string {
  const tree = buildCompletionTree(program);
  return shell === 'zsh' ? renderZshCompletion(tree) : renderBashCompletion(tree);
}
