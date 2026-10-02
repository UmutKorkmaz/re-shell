/**
 * PURE module. No VS Code, no Node side effects.
 *
 * Decides HOW the configured Re-Shell CLI is launched. `reShell.cliBin` (or the
 * `RE_SHELL_CLI_BIN` environment variable) is either
 *
 *   - a native launcher / bare command name (`re-shell`, `/usr/local/bin/re-shell`),
 *     which is executed directly, or
 *   - a JavaScript entry (`packages/cli/dist/index.js` in a checkout, which has
 *     no executable bit), which must be run under a Node runtime.
 *
 * Inside the VS Code extension host `process.execPath` is the editor's Electron
 * binary, not `node`. Running `electron script.js` would start ANOTHER editor
 * window, so a JS entry is launched with `ELECTRON_RUN_AS_NODE=1`, which makes
 * the same binary behave as a plain Node runtime (it is ignored by real Node).
 */

const JS_ENTRY = /\.[cm]?js$/i;

/** True when `cliBin` names a JavaScript entry that has to be run via Node. */
export function isJsEntry(cliBin: string): boolean {
  return JS_ENTRY.test(cliBin);
}

/** A spawn plan for the CLI: the process to start, leading args and extra env. */
export interface CliInvocation {
  /** Executable to spawn. */
  readonly command: string;
  /** Args placed BEFORE the CLI's own argv (the script path for a JS entry). */
  readonly prefixArgs: readonly string[];
  /** Extra environment variables merged over the parent environment. */
  readonly env: Readonly<Record<string, string>>;
}

/**
 * Build the spawn plan for `cliBin`. `execPath` is the current runtime
 * (`process.execPath`), injected so the function stays pure and testable.
 */
export function toCliInvocation(cliBin: string, execPath: string): CliInvocation {
  if (isJsEntry(cliBin)) {
    return { command: execPath, prefixArgs: [cliBin], env: { ELECTRON_RUN_AS_NODE: '1' } };
  }
  return { command: cliBin, prefixArgs: [], env: {} };
}

/**
 * The text to put in front of a vetted argv when the command is typed into an
 * integrated terminal. A JS entry is run with `node`; a path containing
 * whitespace is double-quoted. The result is only ever followed by argv tokens
 * that are catalog path segments or sanitized values.
 */
export function toTerminalPrefix(cliBin: string): string {
  const quoted = cliBin.includes(' ') ? `"${cliBin}"` : cliBin;
  return isJsEntry(cliBin) ? `node ${quoted}` : quoted;
}
