/**
 * Central audit hook for the CLI command lifecycle.
 *
 * commander's `preAction` hook runs before EVERY command action (groups,
 * standalone commands, plugin-registered commands), so one registration in
 * index.ts covers the whole tree. The entry itself is written from a
 * `process.on('exit')` handler because many commands terminate through
 * `process.exit(n)` / `createAsyncCommand`'s error path, which would skip a
 * `postAction` hook; the exit event is the one place the final exit code is
 * always known.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Command } from 'commander';
import { appendAuditEntry } from './log';
import { classifyCommand, type Classification } from './classify';
import { redactArgs } from './redact';
import { findAuditRoot, readAuditSettings, resolveActor, type AuditSettings } from './settings';

export interface AuditSessionOptions {
  /** argv after node/script. Defaults to process.argv.slice(2). */
  argv?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Injected clock for tests. */
  now?: () => number;
  /** Receives write failures (default: one line on stderr). */
  onError?: (error: Error) => void;
}

interface PendingCommand {
  path: string[];
  rawArgs: string[];
  classification: Classification;
  root: string | null;
  settings: AuditSettings;
  startedAt: number;
}

/** Strip the command-path tokens from argv, leaving only the arguments. */
export function argsAfterPath(argv: readonly string[], commandPath: readonly string[]): string[] {
  const out: string[] = [];
  let next = 0;
  for (const token of argv) {
    if (next < commandPath.length && token === commandPath[next]) {
      next += 1;
      continue;
    }
    out.push(token);
  }
  return out;
}

/** Command path from the root program down to the command whose action runs. */
export function commandPathOf(actionCommand: Command): string[] {
  const names: string[] = [];
  for (let cmd: Command | null = actionCommand; cmd && cmd.parent; cmd = cmd.parent) {
    names.unshift(cmd.name());
  }
  return names;
}

export class AuditSession {
  private pending: PendingCommand | null = null;
  private finished = false;
  private readonly argv: readonly string[];
  private readonly cwd: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => number;
  private readonly onError: (error: Error) => void;

  constructor(options: AuditSessionOptions = {}) {
    this.argv = options.argv ?? process.argv.slice(2);
    this.cwd = options.cwd ?? process.cwd();
    this.env = options.env ?? process.env;
    this.now = options.now ?? Date.now;
    this.onError =
      options.onError ??
      (error => {
        process.stderr.write(`[re-shell] warning: could not write the audit log: ${error.message}\n`);
      });
  }

  /** Called before the command action runs. Returns whether the command is audited. */
  begin(commandPath: readonly string[]): boolean {
    if (this.pending) return true; // nested parse inside one process: first command wins
    const rawArgs = argsAfterPath(this.argv, commandPath);
    const classification = classifyCommand({ path: commandPath, args: rawArgs });
    const root = findAuditRoot(this.cwd);
    const settings = readAuditSettings(root, this.env);

    if (!settings.enabled) return false;
    if (!classification.mutating) return false;
    if (classification.source === 'default' && settings.unknownCommands === 'ignore') return false;

    this.pending = {
      path: [...commandPath],
      rawArgs,
      classification,
      root,
      settings,
      startedAt: this.now(),
    };
    return true;
  }

  /** Whether a command is currently being tracked. */
  get active(): boolean {
    return this.pending !== null && !this.finished;
  }

  /**
   * Write the entry. Idempotent. Never throws: auditing must not change a
   * command's outcome, but failures are reported on stderr.
   */
  finish(exitCode: number): void {
    const pending = this.pending;
    if (!pending || this.finished) return;
    this.finished = true;

    try {
      let root = pending.root;
      let settings = pending.settings;
      const commandName = pending.path.join(' ');

      // `init <name>` creates the workspace it belongs to: it did not exist
      // when the command started, so resolve the root now.
      if (commandName === 'init') {
        const target = pending.rawArgs.find(a => !a.startsWith('-'));
        if (target) {
          const candidate = path.resolve(this.cwd, target);
          const resolved = findAuditRoot(candidate);
          if (resolved === candidate || (resolved === null && fs.existsSync(path.join(candidate, 'package.json')))) {
            root = candidate;
            settings = readAuditSettings(root, this.env);
          }
        }
      }
      if (!root || !settings.enabled) return;

      const { actor, actorSource } = resolveActor(root);
      const rel = path.relative(root, this.cwd).split(path.sep).join('/');
      appendAuditEntry(root, {
        timestamp: new Date(pending.startedAt).toISOString(),
        actor,
        actorSource,
        command: commandName,
        args: redactArgs(pending.rawArgs, pending.path),
        cwd: rel === '' ? '.' : rel,
        exitCode: Number.isInteger(exitCode) ? exitCode : 1,
        durationMs: Math.max(0, this.now() - pending.startedAt),
      });
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

const SIGNALS: Array<[NodeJS.Signals, number]> = [
  ['SIGINT', 2],
  ['SIGTERM', 15],
  ['SIGHUP', 1],
];

/**
 * Wire the audit trail into `program`. Call once from index.ts, before parsing.
 * Returns the session for tests.
 */
export function installAuditHooks(program: Command, options: AuditSessionOptions = {}): AuditSession {
  const session = new AuditSession(options);
  let exitHandlerInstalled = false;

  program.hook('preAction', (_thisCommand, actionCommand) => {
    let tracked = false;
    try {
      tracked = session.begin(commandPathOf(actionCommand));
    } catch (error) {
      process.stderr.write(`[re-shell] warning: audit hook failed: ${(error as Error).message}\n`);
    }
    if (!tracked || exitHandlerInstalled) return;
    exitHandlerInstalled = true;

    process.on('exit', code => session.finish(code));

    // A signal kills the process before 'exit' fires unless a handler exists.
    // Only force the exit when ours is the sole listener, so commands with their
    // own graceful-shutdown handlers keep control.
    for (const [signal, number] of SIGNALS) {
      process.on(signal, () => {
        if (process.listenerCount(signal) <= 1) process.exit(128 + number);
      });
    }
  });

  return session;
}
