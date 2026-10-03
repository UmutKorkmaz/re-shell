import { Command } from 'commander';

import {
  sessionCancel,
  sessionEnd,
  sessionHandover,
  sessionJoin,
  sessionList,
  sessionRun,
  sessionStart,
  isCommandFailure,
  type CommandResult,
  type SessionCliContext,
} from '../../commands/collab-session';
import { enableJsonMode, emitJson } from '../../utils/json-output';
import type { ErrorCode } from '../../utils/json-output';

/**
 * Registers `re-shell collab session ...`: the REAL real-time collaboration
 * commands. They are a client of the hosted control plane and need its URL and a
 * token (flags, environment or ~/.re-shell/control-plane.json); the other
 * `collab` subcommands are code generators that produce starter projects and do
 * not talk to any server.
 */

const TARGET_HELP = `
Connection (flag > environment > ~/.re-shell/control-plane.json):
  --url        RE_SHELL_CONTROL_PLANE_URL     control plane base URL
  --token-file RE_SHELL_CONTROL_PLANE_TOKEN   bearer token (file / env; --token is visible in 'ps')
  --tenant     RE_SHELL_CONTROL_PLANE_TENANT  tenant id (optional when the token has one tenant)`;

interface CommonOptions {
  url?: string;
  token?: string;
  tokenFile?: string;
  tenant?: string;
  json?: boolean;
}

function withTarget(command: Command): Command {
  return command
    .option('--url <url>', 'Control plane base URL')
    .option('--token <token>', 'Bearer token (prefer --token-file or RE_SHELL_CONTROL_PLANE_TOKEN)')
    .option('--token-file <path>', 'File containing the bearer token')
    .option('--tenant <id>', 'Tenant id')
    .option('--json', 'Output a JSON envelope')
    .addHelpText('after', TARGET_HELP);
}

/** Run one session command: wire up JSON mode and Ctrl-C, print the result, set the exit code. */
async function execute(
  options: CommonOptions,
  run: (ctx: SessionCliContext) => Promise<CommandResult>
): Promise<void> {
  const json = Boolean(options.json);
  const restore = json ? enableJsonMode() : () => undefined;
  const controller = new AbortController();
  const onSigint = (): void => controller.abort();
  process.once('SIGINT', onSigint);
  try {
    const ctx: SessionCliContext = {
      flags: { url: options.url, token: options.token, tokenFile: options.tokenFile, tenant: options.tenant },
      json,
      env: process.env,
      isTTY: Boolean(process.stdout.isTTY),
      out: (text) => {
        process.stdout.write(text);
      },
      err: (text) => {
        process.stderr.write(text);
      },
      signal: controller.signal,
    };
    const result = await run(ctx);
    if (isCommandFailure(result) === false) {
      if (json) {
        emitJson({ ok: true, data: result.data, warnings: result.warnings });
      } else {
        for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`);
        if (result.human) process.stdout.write(`${result.human}\n`);
      }
      if (result.exitCode) process.exitCode = result.exitCode;
    } else if (json) {
      emitJson({
        ok: false,
        error: {
          code: result.code as ErrorCode,
          message: result.message,
          ...(result.details ? { details: result.details } : {}),
        },
        warnings: result.warnings ?? [],
      });
      process.exitCode = 1;
    } else {
      for (const warning of result.warnings ?? []) process.stderr.write(`warning: ${warning}\n`);
      process.stderr.write(`Error [${result.code}]: ${result.message}\n`);
      process.exitCode = 1;
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    restore();
  }
}

function positiveInt(value: string | undefined, flag: string): number | undefined | Error {
  if (value === undefined) return undefined;
  if (!/^\d{1,9}$/.test(value) || Number(value) < 1) {
    return new Error(`${flag} must be a positive integer.`);
  }
  return Number(value);
}

export function registerSession(collab: Command): void {
  const session = collab
    .command('session')
    .description(
      'Real-time shared sessions on the hosted control plane: start, join, list, end, run commands, hand over control'
    );

  withTarget(session.command('start'))
    .description('Start a shared session in a workspace (you own it and drive it)')
    .requiredOption('--workspace <id>', 'Workspace id')
    .option('--title <title>', 'Session title')
    .action((options: CommonOptions & { workspace: string; title?: string }) =>
      execute(options, (ctx) => sessionStart(ctx, { workspace: options.workspace, title: options.title }))
    );

  withTarget(session.command('list'))
    .description('List sessions of the tenant')
    .option('--status <status>', 'Only "active" or "ended" sessions')
    .option('--workspace <id>', 'Only sessions of one workspace')
    .option('--limit <n>', 'Maximum number of sessions')
    .action((options: CommonOptions & { status?: string; workspace?: string; limit?: string }) =>
      execute(options, async (ctx) => {
        const limit = positiveInt(options.limit, '--limit');
        if (limit instanceof Error) {
          return { ok: false, code: 'INVALID_REQUEST', message: limit.message };
        }
        return sessionList(ctx, { status: options.status, workspace: options.workspace, limit });
      })
    );

  withTarget(session.command('join'))
    .description(
      'Join a session. In a terminal this streams the live shared console; with --json or when piped it prints a snapshot'
    )
    .argument('<sessionId>', 'Session id')
    .option('--snapshot', 'Print a snapshot instead of streaming, even in a terminal')
    .option('--follow', 'Stream even when stdout is not a terminal (text only)')
    .action((sessionId: string, options: CommonOptions & { snapshot?: boolean; follow?: boolean }) =>
      execute(options, (ctx) => sessionJoin(ctx, { sessionId, snapshot: options.snapshot, follow: options.follow }))
    );

  withTarget(session.command('end'))
    .description('End a session (the owner or a tenant admin; not while a command is running)')
    .argument('<sessionId>', 'Session id')
    .option('--reason <text>', 'Why the session ended')
    .action((sessionId: string, options: CommonOptions & { reason?: string }) =>
      execute(options, (ctx) => sessionEnd(ctx, { sessionId, reason: options.reason }))
    );

  withTarget(session.command('run'))
    .description(
      'Run an allow-listed command in the session (driver only). It executes on a worker; output is shared with everyone'
    )
    .argument('<sessionId>', 'Session id')
    .argument('<commandId>', 'Command id from the allow-list, e.g. workspace.summary')
    .option('--param <key=value>', 'Command parameter (repeatable)', (value: string, prev: string[] = []) => [...prev, value])
    .option('--params-json <json>', 'Command parameters as a JSON object')
    .option('--no-wait', 'Queue the command and return immediately')
    .option('--timeout <seconds>', 'Give up waiting after this many seconds (default 600)')
    .action((sessionId: string, commandId: string, options: CommonOptions & {
      param?: string[];
      paramsJson?: string;
      wait?: boolean;
      timeout?: string;
    }) =>
      execute(options, async (ctx) => {
        const timeout = positiveInt(options.timeout, '--timeout');
        if (timeout instanceof Error) {
          return { ok: false, code: 'INVALID_REQUEST', message: timeout.message };
        }
        return sessionRun(ctx, {
          sessionId,
          commandId,
          params: options.param,
          paramsJson: options.paramsJson,
          wait: options.wait,
          timeoutMs: timeout === undefined ? undefined : timeout * 1000,
        });
      })
    );

  withTarget(session.command('handover'))
    .description('Hand control to another participant (the driver, or the owner at any time)')
    .argument('<sessionId>', 'Session id')
    .argument('<userId>', 'The participant who becomes the driver (must have joined and hold the operator role)')
    .action((sessionId: string, userId: string, options: CommonOptions) =>
      execute(options, (ctx) => sessionHandover(ctx, { sessionId, toUserId: userId }))
    );

  withTarget(session.command('cancel'))
    .description('Cancel the command that is currently queued or running in the session')
    .argument('<sessionId>', 'Session id')
    .action((sessionId: string, options: CommonOptions) =>
      execute(options, (ctx) => sessionCancel(ctx, { sessionId }))
    );
}
