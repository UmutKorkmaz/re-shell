import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Locations of the real build artifacts the integration and host tests drive:
 * the compiled CLI entry and the compiled, self-contained hub server bundle.
 * Both are produced by `pnpm -r build`. Environment overrides exist so CI (or a
 * developer) can point at other builds.
 */
export interface RepoArtifacts {
  /** `packages/cli/dist/index.js` */
  readonly cliEntry: string;
  /** `apps/web/dist/hub-server.js` */
  readonly hubBundle: string;
}

/**
 * Resolve the artifacts relative to the extension package root. Throws a clear
 * error (never skips) when one is missing, telling the caller how to build it.
 */
export function resolveRepoArtifacts(packageRoot: string): RepoArtifacts {
  const repoRoot = path.resolve(packageRoot, '../..');
  const cliEntry = process.env.RE_SHELL_TEST_CLI ?? path.join(repoRoot, 'packages/cli/dist/index.js');
  const hubBundle =
    process.env.RE_SHELL_TEST_HUB_BUNDLE ?? path.join(repoRoot, 'apps/web/dist/hub-server.js');

  for (const [label, file] of [
    ['CLI entry', cliEntry],
    ['hub server bundle', hubBundle],
  ] as const) {
    if (!fs.existsSync(file)) {
      throw new Error(`${label} not found at ${file}. Run \`pnpm -r build\` from the repository root first.`);
    }
  }
  return { cliEntry, hubBundle };
}

export interface RunningHub {
  /** Base URL, e.g. `http://127.0.0.1:41233`. */
  readonly url: string;
  /** The session token the hub enforces on every route. */
  readonly token: string;
  /** Combined stdout/stderr of the hub process so far (for failure messages). */
  logs(): string;
  /** SIGTERM the hub and wait for it to exit. */
  stop(): Promise<void>;
}

export interface StartHubOptions {
  readonly artifacts: RepoArtifacts;
  /** The hub's workspace root: every job's cwd is contained to it. */
  readonly workspace: string;
  /** Session token; a random one is generated when omitted. */
  readonly token?: string;
  /** How long to wait for the hub to report that it is listening. */
  readonly startTimeoutMs?: number;
}

/**
 * Start the REAL hub (`apps/web/dist/hub-server.js`) as a child process, exactly
 * the way `re-shell ui` does: plain `node`, configured through the
 * `RE_SHELL_UI_HUB_*` / `RE_SHELL_WORKSPACE` / `RE_SHELL_CLI_BIN` environment.
 * Port 0 asks the OS for a free port, which is read back from the hub's own
 * "Running at" log line, so there is no check-then-bind race.
 *
 * Call it from a plain Node process (the host-test launcher or vitest), never
 * from inside the editor's extension host, where `process.execPath` is the
 * editor binary rather than `node`.
 */
export async function startRealHub(options: StartHubOptions): Promise<RunningHub> {
  const token = options.token ?? randomBytes(16).toString('hex');
  const child: ChildProcess = spawn(process.execPath, [options.artifacts.hubBundle], {
    cwd: path.dirname(options.artifacts.hubBundle),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Port 0: let the OS pick; the bound port is read back from the hub's log.
      RE_SHELL_UI_HUB_PORT: '0',
      RE_SHELL_UI_HUB_TOKEN: token,
      RE_SHELL_WORKSPACE: options.workspace,
      RE_SHELL_CLI_BIN: options.artifacts.cliEntry,
    },
  });

  let logs = '';
  const append = (chunk: Buffer): void => {
    logs += chunk.toString();
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);

  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));

  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Hub did not start within ${options.startTimeoutMs ?? 20_000} ms.\n${logs}`));
    }, options.startTimeoutMs ?? 20_000);

    const poll = setInterval(() => {
      const match = /\[hub-server\] Running at (http:\/\/127\.0\.0\.1:\d+)/.exec(logs);
      if (match) {
        clearInterval(poll);
        clearTimeout(timer);
        resolve(match[1]);
      }
    }, 25);

    child.once('exit', (code) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(new Error(`Hub exited early with code ${code}.\n${logs}`));
    });
    child.once('error', (err) => {
      clearInterval(poll);
      clearTimeout(timer);
      reject(err);
    });
  });

  return {
    url,
    token,
    logs: () => logs,
    stop: async () => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGTERM');
      }
      await exited;
    },
  };
}
