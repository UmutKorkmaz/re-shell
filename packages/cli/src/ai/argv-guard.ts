import type { CommandCatalogEntry } from '../utils/command-catalog';

/**
 * The argv allow-list / injection filter for MODEL-PROPOSED commands.
 *
 * The offline parser is safe by construction (it only ever assembles argv from
 * catalogue path segments, catalogue flags and sanitised value slots). A model
 * has no such construction guarantee, so everything it proposes passes through
 * {@link vetArgv}, which re-establishes the same invariants token by token:
 *
 *  1. the leading tokens are EXACTLY one runnable catalogue command path,
 *  2. every `--flag` is declared by that command in the live catalogue,
 *  3. every value / positional passes {@link isSafeArgValue} (a strict
 *     shell-inert charset: no spaces, quotes, `;|&$` backticks, `<>`, `~`,
 *     leading `-`, `..`),
 *  4. positional count never exceeds the command's declared arguments.
 *
 * Anything else is rejected with a machine-readable reason — never repaired
 * silently, and never executed.
 */

/** Strict value charset: alphanumeric/`@` start, then a shell-inert alphabet. */
const SAFE_ARG_VALUE = /^[A-Za-z0-9@][A-Za-z0-9@._:/+=,-]*$/;

/** Longest single token we accept. */
const MAX_TOKEN_LENGTH = 200;

/** Longest argv we accept. */
const MAX_ARGV_LENGTH = 40;

/**
 * Whether a value may be placed into argv. Rejects shell metacharacters,
 * whitespace, a leading dash (flag injection through a value), absolute and
 * home-relative paths, and `..` traversal.
 *
 * @param value - Candidate flag value or positional.
 * @returns `true` when the value is safe to splice into argv.
 */
export function isSafeArgValue(value: string): boolean {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_TOKEN_LENGTH &&
    SAFE_ARG_VALUE.test(value) &&
    !value.includes('..') &&
    !value.includes('//')
  );
}

/** Why an argv was rejected. */
export type VetFailureCode =
  | 'not-array'
  | 'empty'
  | 'too-long'
  | 'unsafe-token'
  | 'unknown-command'
  | 'excluded-command'
  | 'unknown-flag'
  | 'flag-value-missing'
  | 'flag-takes-no-value'
  | 'too-many-arguments';

/** Where in the vetted argv a value token sits, and what it is. */
export interface VetSlot {
  /** Index into the vetted `argv`. */
  index: number;
  kind: 'flag-value' | 'positional';
  /** For `flag-value`: the owning flag. */
  flag?: string;
  /** For `positional`: zero-based position and the declared argument name. */
  position?: number;
  argName?: string;
}

/** A successful vet: the parsed, structured form of the argv. */
export interface VetSuccess {
  ok: true;
  entry: CommandCatalogEntry;
  /** The vetted argv (identical tokens, normalised `--flag=value` -> two tokens). */
  argv: string[];
  positionals: string[];
  flags: Array<{ name: string; value?: string }>;
  /** Every value token (flag values and positionals) with its role. */
  slots: VetSlot[];
  /** Required positionals the argv did not supply. */
  missingArgs: string[];
}

/** A failed vet. */
export interface VetFailure {
  ok: false;
  code: VetFailureCode;
  message: string;
}

export type VetResult = VetSuccess | VetFailure;

/** Options for {@link vetArgv}. */
export interface VetOptions {
  /**
   * Command paths (or path prefixes) the model may never target. Used to keep
   * the `ai` command family out of its own proposals.
   */
  excludePathPrefixes?: readonly string[];
}

/** An index over the catalogue for longest-prefix path lookup. */
export interface CatalogIndex {
  byPath: ReadonlyMap<string, CommandCatalogEntry>;
  maxDepth: number;
}

/**
 * Build the lookup index {@link vetArgv} needs. Build it once per catalogue.
 *
 * @param catalog - The live command catalogue.
 * @returns The index.
 */
export function indexCatalog(catalog: readonly CommandCatalogEntry[]): CatalogIndex {
  const byPath = new Map<string, CommandCatalogEntry>();
  let maxDepth = 1;
  for (const entry of catalog) {
    // First entry wins on duplicate paths (the live catalogue has a few).
    if (!byPath.has(entry.path)) byPath.set(entry.path, entry);
    maxDepth = Math.max(maxDepth, entry.path.split(' ').length);
  }
  return { byPath, maxDepth };
}

function isExcluded(path: string, prefixes: readonly string[] | undefined): boolean {
  if (!prefixes) return false;
  return prefixes.some(p => path === p || path.startsWith(`${p} `));
}

/**
 * Vet a model-proposed argv against the live catalogue and the allow-list.
 *
 * @param argv - Untrusted argv (without the `re-shell` binary).
 * @param index - The catalogue index from {@link indexCatalog}.
 * @param options - Vetting options.
 * @returns A structured success, or a precise failure reason.
 */
export function vetArgv(
  argv: unknown,
  index: CatalogIndex,
  options: VetOptions = {}
): VetResult {
  if (!Array.isArray(argv)) {
    return { ok: false, code: 'not-array', message: 'argv must be an array of strings' };
  }
  if (argv.length === 0) {
    return { ok: false, code: 'empty', message: 'argv is empty' };
  }
  if (argv.length > MAX_ARGV_LENGTH) {
    return { ok: false, code: 'too-long', message: `argv has more than ${MAX_ARGV_LENGTH} tokens` };
  }
  for (const token of argv) {
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > MAX_TOKEN_LENGTH ||
      // eslint-disable-next-line no-control-regex
      /[\s\u0000-\u001f\u007f]/.test(token)
    ) {
      return {
        ok: false,
        code: 'unsafe-token',
        message: 'argv contains an empty, over-long, non-string or whitespace-bearing token',
      };
    }
  }
  const tokens = argv as string[];

  // 1. Longest catalogue path prefix.
  let entry: CommandCatalogEntry | undefined;
  let pathLen = 0;
  for (let n = Math.min(tokens.length, index.maxDepth); n >= 1; n--) {
    const candidate = tokens.slice(0, n).join(' ');
    const found = index.byPath.get(candidate);
    if (found) {
      entry = found;
      pathLen = n;
      break;
    }
  }
  if (!entry) {
    return {
      ok: false,
      code: 'unknown-command',
      message: `"${tokens.slice(0, 3).join(' ').slice(0, 60)}" is not a known re-shell command`,
    };
  }
  if (isExcluded(entry.path, options.excludePathPrefixes)) {
    return {
      ok: false,
      code: 'excluded-command',
      message: `"${entry.path}" cannot be proposed by the AI interface`,
    };
  }

  // 2-4. Flags, values, positionals.
  const declared = new Map(entry.flags.map(f => [f.name, f]));
  const positionals: string[] = [];
  const flags: Array<{ name: string; value?: string }> = [];
  const slots: VetSlot[] = [];
  const out: string[] = tokens.slice(0, pathLen);

  for (let i = pathLen; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('-')) {
      if (token === '--' || !token.startsWith('--')) {
        return {
          ok: false,
          code: 'unknown-flag',
          message: `"${token.slice(0, 40)}" is not an allowed flag (only declared long flags are accepted)`,
        };
      }
      const eq = token.indexOf('=');
      const name = eq === -1 ? token : token.slice(0, eq);
      const inline = eq === -1 ? undefined : token.slice(eq + 1);
      const flag = declared.get(name);
      if (!flag) {
        return {
          ok: false,
          code: 'unknown-flag',
          message: `"${name.slice(0, 40)}" is not a flag of "${entry.path}"`,
        };
      }
      if (!flag.takesValue) {
        if (inline !== undefined) {
          return {
            ok: false,
            code: 'flag-takes-no-value',
            message: `${name} does not take a value`,
          };
        }
        flags.push({ name });
        out.push(name);
        continue;
      }
      let value = inline;
      if (value === undefined) {
        const next = tokens[i + 1];
        if (next === undefined || next.startsWith('-')) {
          return {
            ok: false,
            code: 'flag-value-missing',
            message: `${name} requires a value`,
          };
        }
        value = next;
        i++;
      }
      if (!isSafeArgValue(value)) {
        return {
          ok: false,
          code: 'unsafe-token',
          message: `the value for ${name} contains characters that are not allowed`,
        };
      }
      flags.push({ name, value });
      out.push(name, value);
      slots.push({ index: out.length - 1, kind: 'flag-value', flag: name });
      continue;
    }

    if (!isSafeArgValue(token)) {
      return {
        ok: false,
        code: 'unsafe-token',
        message: 'a positional argument contains characters that are not allowed',
      };
    }
    positionals.push(token);
    out.push(token);
    slots.push({
      index: out.length - 1,
      kind: 'positional',
      position: positionals.length - 1,
      argName: entry.args[positionals.length - 1]?.name,
    });
  }

  if (positionals.length > entry.args.length) {
    return {
      ok: false,
      code: 'too-many-arguments',
      message: `"${entry.path}" accepts at most ${entry.args.length} positional argument(s)`,
    };
  }

  const missingArgs = entry.args
    .filter(a => a.required)
    .slice(positionals.length)
    .map(a => a.name);

  return { ok: true, entry, argv: out, positionals, flags, slots, missingArgs };
}
