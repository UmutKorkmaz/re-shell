import type { CatalogEntry } from './catalog.js';

/**
 * PURE module. No VS Code, no Node side effects.
 *
 * Turns a {@link CatalogEntry} plus user-supplied parameter values into a vetted
 * argv array. argv is assembled ONLY from:
 *   - the command's catalog path segments,
 *   - catalog-declared flag names (never free-form flags), and
 *   - value slots sanitized to a safe identifier charset.
 *
 * Raw user text is never spliced into a shell string. The result is an array of
 * literal tokens; even if a value contained `; rm -rf ~`, sanitization rejects
 * it (it never becomes a token, let alone shell-interpreted).
 */

/** Sanitizer matching the CLI's AI-intent value slots (single safe token). */
const SAFE_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** User-supplied values for one build: positional args + flag values + bools. */
export interface CommandParams {
  /** Positional argument values keyed by the catalog arg `name`. */
  readonly args?: Readonly<Record<string, string>>;
  /** Flag values keyed by the catalog flag `name` (e.g. `--language`). */
  readonly flags?: Readonly<Record<string, string>>;
  /** Boolean switches to enable, keyed by flag `name` (e.g. `--json`). */
  readonly switches?: readonly string[];
}

/** Result of assembling an argv from a catalog entry + params. */
export type BuildResult =
  | { ok: true; argv: string[]; commandText: string }
  | { ok: false; error: string };

/** Split a catalog `path` ("workspace health") into argv segments. */
export function pathToSegments(path: string): string[] {
  return path.split(' ').filter((seg) => seg.length > 0);
}

/**
 * True when a token is a catalog-declared flag on this entry. Guards against a
 * caller smuggling in an arbitrary `--flag`.
 */
function isDeclaredFlag(entry: CatalogEntry, name: string): boolean {
  return entry.flags.some((f) => f.name === name);
}

function flagTakesValue(entry: CatalogEntry, name: string): boolean {
  const flag = entry.flags.find((f) => f.name === name);
  return flag ? flag.takesValue : false;
}

/**
 * Assemble a vetted argv for `entry` from `params`.
 *
 * Order is deterministic and stable:
 *   1. path segments (e.g. `workspace`, `health`)
 *   2. required then optional positional args, in catalog declaration order
 *   3. value-flags (`--language en`) in catalog declaration order
 *   4. boolean switches (`--json`) in catalog declaration order
 *
 * Every value is sanitized; any rejected value fails the whole build (no spawn).
 */
export function buildCommand(entry: CatalogEntry, params: CommandParams = {}): BuildResult {
  const argv: string[] = [...pathToSegments(entry.path)];
  const argValues = params.args ?? {};
  const flagValues = params.flags ?? {};
  const switches = params.switches ?? [];

  // 1. Positional args, in catalog order. Required must be present + valid.
  for (const arg of entry.args) {
    const raw = argValues[arg.name];
    if (raw === undefined || raw === '') {
      if (arg.required) {
        return { ok: false, error: `Missing required argument "${arg.name}".` };
      }
      continue;
    }
    if (!SAFE_VALUE.test(raw)) {
      return { ok: false, error: `Unsafe value for argument "${arg.name}": ${JSON.stringify(raw)}` };
    }
    argv.push(raw);
  }

  // 2. Value-flags, in catalog declaration order (deterministic).
  for (const flag of entry.flags) {
    if (!flag.takesValue) {
      continue;
    }
    const raw = flagValues[flag.name];
    if (raw === undefined || raw === '') {
      continue;
    }
    if (!SAFE_VALUE.test(raw)) {
      return { ok: false, error: `Unsafe value for flag "${flag.name}": ${JSON.stringify(raw)}` };
    }
    argv.push(flag.name, raw);
  }

  // 3. Boolean switches the caller asked to enable. Each must be a declared,
  //    valueless flag on this entry; unknown flags are rejected.
  for (const name of switches) {
    if (!isDeclaredFlag(entry, name)) {
      return { ok: false, error: `Unknown flag "${name}" for "${entry.path}".` };
    }
    if (flagTakesValue(entry, name)) {
      return {
        ok: false,
        error: `Flag "${name}" expects a value; pass it via "flags", not "switches".`,
      };
    }
    if (!argv.includes(name)) {
      argv.push(name);
    }
  }

  return { ok: true, argv, commandText: ['re-shell', ...argv].join(' ') };
}
