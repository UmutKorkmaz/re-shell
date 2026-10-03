import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import chalk from 'chalk';
import { GENERATED_PKG_SCOPE, RECOGNIZED_PKG_SCOPES } from '../utils/scope';
import { processManager } from '../utils/error-handler';
import { startStaticServer, type StaticServer } from '../utils/ui-static-server';

// Recognized package names for the standalone UI app. Includes the legacy
// scope so already-installed dashboards still resolve.
const UI_APP_PACKAGE_NAMES = new Set([
  `${GENERATED_PKG_SCOPE}/ui-web`,
  `${GENERATED_PKG_SCOPE}/ui-dashboard`,
  // The in-repo dashboard app (apps/web) now publishes under @re-shell/dashboard,
  // so name-based resolution must match it (path-based resolution already does).
  '@re-shell/dashboard',
  // legacy-compat: build names from the recognized-scopes list to avoid hard-coding the old scope
  ...RECOGNIZED_PKG_SCOPES.filter(s => s !== `${GENERATED_PKG_SCOPE}/`).flatMap(s => [
    `${s}ui-web`,
    `${s}ui-dashboard`
  ])
]);

/** Options accepted by the `re-shell ui` command. */
export interface UiCommandOptions {
  /** Explicit path to the dashboard app, forcing vite-dev mode. */
  uiPath?: string;
  /** Explicit UI root directory override (alias for `uiPath`). */
  uiRoot?: string;
  /** Workspace directory the dashboard manages. Defaults to `process.cwd()`. */
  workspace?: string;
  /** Port the dashboard listens on. Defaults to 3333. */
  port?: string;
  /** Host the dashboard binds to. Defaults to 127.0.0.1. */
  host?: string;
  /** Package manager to use for vite-dev launches. */
  packageManager?: string;
  /** When true, print the launch plan and exit without starting servers. */
  dryRun?: boolean;
  /** When true, emit the launch plan as JSON to stdout. */
  json?: boolean;
  /** When true, open the dashboard in the default browser after launch. */
  open?: boolean;
  /** Max ms to wait for the hub's GET /health to succeed. Defaults to 15000. Not a CLI flag. */
  hubReadyTimeoutMs?: number;
}

/**
 * How the dashboard is launched:
 *  - "static": serve the prebuilt SPA bundled into the CLI (dist/dashboard) via
 *    the dependency-light static server, plus the bundled hub. No Vite, no
 *    apps/web source. This is the mode for an npm-installed CLI.
 *  - "vite-dev": run the apps/web Vite dev server from the monorepo source.
 */
export type UiLaunchMode = 'static' | 'vite-dev';

/** Fully-resolved launch configuration produced by {@link createUiLaunchPlan}. */
export interface UiLaunchPlan {
  /** Selected launch mode. */
  mode: UiLaunchMode;
  /** Resolved UI root directory. */
  uiRoot: string;
  /** Resolved dashboard app directory. */
  appPath: string;
  /** In static mode, the bundled dashboard directory (dist/dashboard). */
  dashboardDir?: string;
  /** Path to the hub bundle to spawn with `node` (both modes when available). */
  hubBundlePath?: string;
  /** Workspace directory the dashboard manages. */
  workspace: string;
  /** Package manager used for vite-dev launches ("node" in static mode). */
  packageManager: string;
  /** Executable to spawn for the dashboard process. */
  command: string;
  /** Arguments passed to {@link UiLaunchPlan.command}. */
  args: string[];
  /** Full dashboard URL (host + port). */
  url: string;
  /** Full hub URL. Always loopback (127.0.0.1) + hub port, independent of the dashboard host. */
  hubUrl: string;
  /** Port the hub server listens on. */
  hubPort: string;
  /** Per-launch session token authenticating hub requests. */
  hubToken: string;
  /** Whether to open the dashboard in a browser after launch. */
  open: boolean;
  /** Environment variables for the dashboard and hub child processes. */
  env: Record<string, string>;
}

/**
 * Generate a per-launch session token used to authenticate every hub request.
 * 32 random bytes (256 bits) rendered as hex.
 */
function generateHubToken(): string {
  return randomBytes(32).toString('hex');
}

/** The hub only ever listens on (and accepts Host headers for) the loopback interface. */
const HUB_LOOPBACK_HOST = '127.0.0.1';
const WEB_APP_RELATIVE_PATHS = ['apps/web', 'apps/dashboard'];
const PACKAGE_MANAGERS = new Set(['pnpm', 'npm', 'yarn', 'bun']);

function pathExists(targetPath: string): boolean {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function readPackageName(packageJsonPath: string): string | undefined {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return typeof packageJson.name === 'string' ? packageJson.name : undefined;
  } catch {
    return undefined;
  }
}

function normalizePort(port: string | undefined): string {
  const rawPort = port || '3333';
  const parsedPort = Number(rawPort);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid UI port "${rawPort}". Use a port between 1 and 65535.`);
  }

  return String(parsedPort);
}

function normalizeHost(host: string | undefined): string {
  const normalizedHost = (host || '127.0.0.1').trim();

  if (!normalizedHost) {
    throw new Error('UI host cannot be empty.');
  }

  return normalizedHost;
}

function ensureSupportedNodeVersion(): void {
  const majorVersion = Number(process.versions.node.split('.')[0]);

  if (!Number.isInteger(majorVersion) || majorVersion < 18) {
    throw new Error(
      `Re-Shell UI requires Node.js 18 or newer. Current Node.js version is ${process.versions.node}.`
    );
  }
}

function resolveCandidate(candidate: string): { uiRoot: string; appPath: string } | undefined {
  const resolvedCandidate = path.resolve(candidate);

  for (const relativePath of WEB_APP_RELATIVE_PATHS) {
    const appPath = path.join(resolvedCandidate, relativePath);
    if (pathExists(path.join(appPath, 'package.json'))) {
      return {
        uiRoot: resolvedCandidate,
        appPath
      };
    }
  }

  const packageJsonPath = path.join(resolvedCandidate, 'package.json');
  const packageName = readPackageName(packageJsonPath);
  if (packageName !== undefined && UI_APP_PACKAGE_NAMES.has(packageName)) {
    return {
      uiRoot: path.resolve(resolvedCandidate, '../..'),
      appPath: resolvedCandidate
    };
  }

  return undefined;
}

/**
 * Locate the dashboard app directory across monorepo, standalone-repo, and
 * explicit-path layouts. Throws when no dashboard can be found.
 *
 * @param uiPath - Optional explicit dashboard path override.
 * @param cwd - Working directory used for relative candidate resolution.
 * @returns Resolved `{ uiRoot, appPath }` of the discovered dashboard project.
 */
export function resolveUiProject(uiPath?: string, cwd = process.cwd()): { uiRoot: string; appPath: string } {
  // In the merged monorepo the dashboard lives at <root>/apps/web. The compiled
  // CLI runs from <root>/packages/cli/dist/commands, so the monorepo root is four
  // levels up. We resolve the in-repo dashboard first, then fall back to the
  // legacy standalone-repo layout for backwards compatibility.
  const monorepoRoot = path.resolve(__dirname, '../../../..');
  const candidates = uiPath
    ? [uiPath]
    : ([
        process.env.RE_SHELL_UI_PATH,
        cwd,
        monorepoRoot,
        // legacy 2-repo fallbacks: a standalone re-shell-ui checkout
        path.resolve(cwd, '../re-shell-ui'),
        path.join(cwd, 're-shell-ui')
      ].filter(Boolean) as string[]);

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const resolvedCandidate = path.resolve(candidate);
    if (seen.has(resolvedCandidate)) {
      continue;
    }
    seen.add(resolvedCandidate);

    const resolvedProject = resolveCandidate(resolvedCandidate);
    if (resolvedProject) {
      return resolvedProject;
    }
  }

  throw new Error(
    [
      'Could not locate the Re-Shell dashboard app.',
      'Expected a dashboard at apps/web/package.json in the monorepo root.',
      'Run from the monorepo, pass --ui-path /path/to/dashboard, or set RE_SHELL_UI_PATH.'
    ].join(' ')
  );
}

/**
 * Resolve the dashboard bundle shipped inside the published CLI. The compiled
 * CLI runs from dist/commands, so the bundled dashboard lives one level up at
 * dist/dashboard. Returns the directory only when a built index.html + hub are
 * present (i.e. `bundle:dashboard` ran and it shipped in the tarball).
 */
export function resolveBundledDashboard(): { dashboardDir: string; hubBundlePath: string } | undefined {
  // RE_SHELL_BUNDLED_DASHBOARD_DIR overrides the location (used in tests, and as
  // an escape hatch to point at a custom prebuilt dashboard bundle).
  const override = process.env.RE_SHELL_BUNDLED_DASHBOARD_DIR;
  const dashboardDir = override ? path.resolve(override) : path.resolve(__dirname, '../dashboard');
  const indexHtml = path.join(dashboardDir, 'index.html');
  const hubBundlePath = path.join(dashboardDir, 'hub-server.js');

  if (pathExists(indexHtml) && pathExists(hubBundlePath)) {
    return { dashboardDir, hubBundlePath };
  }

  return undefined;
}

function detectPackageManager(uiRoot: string, appPath: string, explicitPackageManager?: string): string {
  if (explicitPackageManager) {
    if (!PACKAGE_MANAGERS.has(explicitPackageManager)) {
      throw new Error(`Unsupported package manager "${explicitPackageManager}". Use pnpm, npm, yarn, or bun.`);
    }
    return explicitPackageManager;
  }

  if (pathExists(path.join(uiRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (pathExists(path.join(uiRoot, 'yarn.lock'))) {
    return 'yarn';
  }
  if (pathExists(path.join(uiRoot, 'bun.lockb')) || pathExists(path.join(uiRoot, 'bun.lock'))) {
    return 'bun';
  }
  if (pathExists(path.join(uiRoot, 'package-lock.json'))) {
    return 'npm';
  }

  const packageManager = readPackageName(path.join(appPath, 'package.json'));
  return packageManager ? 'pnpm' : 'npm';
}

function createPackageManagerArgs(packageManager: string, host: string, port: string): string[] {
  switch (packageManager) {
    case 'pnpm':
      return ['exec', 'vite', '--host', host, '--port', port];
    case 'yarn':
      return ['vite', '--host', host, '--port', port];
    case 'bun':
      return ['x', 'vite', '--host', host, '--port', port];
    case 'npm':
    default:
      return ['exec', 'vite', '--', '--host', host, '--port', port];
  }
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  try {
    const opener = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    });
    opener.unref();
  } catch {
    // Browser opening is a convenience. The URL is still printed for manual use.
  }
}

/**
 * Build the fully-resolved launch plan for the dashboard + hub. Selects between
 * the bundled static dashboard (installed CLI) and the monorepo vite-dev flow,
 * normalising host/port, generating a hub token, and assembling the child env.
 *
 * @param options - Command-line / programmatic options.
 * @returns A complete {@link UiLaunchPlan}.
 */
export function createUiLaunchPlan(options: UiCommandOptions = {}): UiLaunchPlan {
  ensureSupportedNodeVersion();

  const host = normalizeHost(options.host);
  const port = normalizePort(options.port);
  const hubPort = String(parseInt(port) + 1);
  const workspace = path.resolve(options.workspace || process.cwd());
  const url = `http://${host}:${port}`;
  // The hub binds 127.0.0.1 only and its WebSocket Host check rejects any other
  // name, so the hub URL is pinned to loopback no matter which --host the
  // dashboard itself binds (e.g. 0.0.0.0).
  const hubUrl = `http://${HUB_LOOPBACK_HOST}:${hubPort}`;
  const cliPath = process.argv[1] ? path.resolve(process.argv[1]) : 're-shell';
  const hubToken = generateHubToken();

  // An explicit --ui-path / RE_SHELL_UI_PATH override always selects a source
  // (vite-dev) project; the override is meaningless for a prebuilt bundle.
  const explicitPath = options.uiPath || options.uiRoot || process.env.RE_SHELL_UI_PATH;

  // Shared env for both modes. The dashboard SPA resolves the hub url + token at
  // runtime; in static mode they are injected into index.html, in vite-dev mode
  // they are read from these VITE_* vars at build/serve time.
  const env: Record<string, string> = {
    RE_SHELL_WORKSPACE: workspace,
    RE_SHELL_CLI_BIN: cliPath,
    RE_SHELL_UI_OPEN: options.open === false ? '0' : '1',
    RE_SHELL_UI_HUB_PORT: hubPort,
    // Hub session token: enforced server-side on every route.
    RE_SHELL_UI_HUB_TOKEN: hubToken,
    // Signals to the vite dev plugin that the CLI already owns and runs the
    // hub, so the plugin must NOT start a second in-process hub on the same
    // port (which would EADDRINUSE and create a second lifecycle owner).
    RE_SHELL_UI_HUB_MANAGED: '1',
    VITE_RE_SHELL_WORKSPACE: workspace,
    VITE_RE_SHELL_CLI: cliPath,
    VITE_RE_SHELL_UI_PORT: port,
    VITE_RE_SHELL_UI_HOST: host,
    VITE_RE_SHELL_LAUNCHER: 're-shell ui',
    VITE_RE_SHELL_UI_HUB_PORT: hubPort,
    // Full hub URL so the dashboard health poll has a concrete target and does
    // not short-circuit on a missing URL.
    VITE_RE_SHELL_UI_HUB_URL: hubUrl,
    // Exposed to the dashboard build so the SSE/WS clients can attach it.
    VITE_RE_SHELL_UI_HUB_TOKEN: hubToken
  };

  // Prefer the bundled static dashboard for installed CLIs, unless an explicit
  // source path override was given (which forces vite-dev). Fall back to the
  // monorepo apps/web vite-dev flow when no bundle is present.
  const bundled = explicitPath ? undefined : resolveBundledDashboard();

  if (bundled) {
    return {
      mode: 'static',
      uiRoot: bundled.dashboardDir,
      appPath: bundled.dashboardDir,
      dashboardDir: bundled.dashboardDir,
      hubBundlePath: bundled.hubBundlePath,
      workspace,
      packageManager: 'node',
      command: 'node',
      args: ['<static-server>'],
      url,
      hubUrl,
      hubPort,
      hubToken,
      open: options.open !== false,
      env
    };
  }

  const { uiRoot, appPath } = resolveUiProject(explicitPath);
  const packageManager = detectPackageManager(uiRoot, appPath, options.packageManager);
  const args = createPackageManagerArgs(packageManager, host, port);

  return {
    mode: 'vite-dev',
    uiRoot,
    appPath,
    workspace,
    packageManager,
    command: packageManager,
    args,
    url,
    hubUrl,
    hubPort,
    hubToken,
    open: options.open !== false,
    env
  };
}

// Grace period the hub gets to drain on SIGTERM before we escalate to SIGKILL.
const HUB_DRAIN_MS = 3000;
/** Default time the hub gets to answer GET /health after it is spawned. */
const HUB_READY_TIMEOUT_MS = 15000;
/**
 * A hub exit is only reported as a crash after this delay, so a Ctrl+C that the
 * terminal delivers to the hub and to this CLI at the same moment is handled as
 * the orderly shutdown it is.
 */
const HUB_EXIT_GRACE_MS = 300;
/** Delay before opening the browser on the vite dev server, which has no readiness probe. */
const VITE_OPEN_DELAY_MS = 1500;
const HUB_POLL_INTERVAL_MS = 100;
const HUB_REQUEST_TIMEOUT_MS = 1500;
/** Extra time, after SIGKILL, to observe the hub actually going away. */
const HUB_KILL_WAIT_MS = 2000;
/** Max time to wait for the static dashboard server to release its port. */
const STATIC_CLOSE_WAIT_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** How a spawned child ended. `error` is set when it could not be spawned at all. */
interface ChildExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
}

/** Handle on the spawned hub process with exit tracking independent of ChildProcess flags. */
interface HubHandle {
  child: ChildProcess;
  /** Resolves (never rejects) once the hub has exited or failed to spawn. */
  exited: Promise<ChildExit>;
  hasExited(): boolean;
  /** Recent hub stdout/stderr, for failure diagnostics. */
  output(): string;
  /** Mark the upcoming exit as deliberate so it is not reported as a crash. */
  markStopping(): void;
  isStopping(): boolean;
}

/**
 * Resolve the compiled, dependency-free hub bundle. The CLI spawns this with
 * plain `node` — never ts-node/tsx. When the bundle is missing (a fresh
 * checkout that has not built apps/web yet), build it on demand by invoking the
 * web package's `build:hub` script. Returns the bundle path, or null when the
 * hub cannot be built (in which case the dashboard still launches without it).
 */
function ensureHubBundle(uiRoot: string, packageManager: string): string | null {
  const bundlePath = path.join(uiRoot, 'apps/web/dist/hub-server.js');
  if (pathExists(bundlePath)) {
    return bundlePath;
  }

  const webAppPath = path.join(uiRoot, 'apps/web');
  if (!pathExists(path.join(webAppPath, 'package.json'))) {
    return null;
  }

  console.log(chalk.cyan('Building hub server bundle (first run)...'));
  // pnpm, npm, yarn, and bun all accept `run <script>`.
  const result = spawnSync(packageManager, ['run', 'build:hub'], {
    cwd: webAppPath,
    stdio: 'inherit'
  });

  if (result.status !== 0 || !pathExists(bundlePath)) {
    console.warn(
      chalk.yellow('Could not build the hub server bundle; launching dashboard without the hub.')
    );
    return null;
  }

  return bundlePath;
}

/**
 * Signal the hub to stop: SIGTERM for a graceful drain, then SIGKILL if it has
 * not exited within the grace window. Idempotent, synchronous and safe to call
 * from signal handlers and process-manager cleanup; use {@link stopHub} to also
 * wait for the exit.
 */
function signalHub(hub: HubHandle | null): void {
  if (!hub || hub.hasExited()) {
    return;
  }
  hub.markStopping();
  try {
    hub.child.kill('SIGTERM');
  } catch {
    // already gone
  }
  const escalate = setTimeout(() => {
    if (!hub.hasExited()) {
      try {
        hub.child.kill('SIGKILL');
      } catch {
        // already gone
      }
    }
  }, HUB_DRAIN_MS);
  // Do not keep the event loop alive solely for the escalation timer.
  escalate.unref();
  void hub.exited.then(() => clearTimeout(escalate));
}

/** Stop the hub and wait until it has really exited (so its port is released). */
async function stopHub(hub: HubHandle | null): Promise<void> {
  if (!hub) {
    return;
  }
  signalHub(hub);
  await Promise.race([hub.exited, sleep(HUB_DRAIN_MS + HUB_KILL_WAIT_MS)]);
}

/**
 * Spawn the bundled hub server with plain `node`. The hub hard-pins itself to
 * 127.0.0.1 and reads its port + per-launch token from the environment; no host
 * override is forwarded. Spawn errors and exits are tracked on the returned
 * handle so callers can fail instead of carrying on without a hub.
 */
function spawnHub(plan: UiLaunchPlan, hubBundlePath: string): HubHandle {
  const hubEnv = {
    ...process.env,
    RE_SHELL_WORKSPACE: plan.workspace,
    RE_SHELL_CLI_BIN: plan.env.RE_SHELL_CLI_BIN,
    RE_SHELL_UI_HUB_PORT: plan.hubPort,
    RE_SHELL_UI_HUB_TOKEN: plan.hubToken,
    // Dashboard origin info so the hub can build its exact-origin allowlist.
    VITE_RE_SHELL_UI_HOST: plan.env.VITE_RE_SHELL_UI_HOST,
    VITE_RE_SHELL_UI_PORT: plan.env.VITE_RE_SHELL_UI_PORT
  };

  const child = spawn('node', [hubBundlePath], {
    cwd: path.dirname(hubBundlePath),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: hubEnv
  });

  let recent = '';
  const remember = (data: Buffer | string): void => {
    recent = (recent + data.toString()).slice(-4000);
  };

  child.stdout?.on('data', (data: Buffer) => {
    remember(data);
    process.stdout.write(data);
  });
  child.stderr?.on('data', (data: Buffer) => {
    remember(data);
    process.stderr.write(data);
  });

  let exitInfo: ChildExit | null = null;
  let stopping = false;
  const exited = new Promise<ChildExit>(resolve => {
    child.once('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (!exitInfo) {
        exitInfo = { code, signal };
        resolve(exitInfo);
      }
    });
    child.once('error', (error: Error) => {
      if (!exitInfo) {
        exitInfo = { code: null, signal: null, error };
        resolve(exitInfo);
      }
    });
  });

  return {
    child,
    exited,
    hasExited: () => exitInfo !== null,
    output: () => recent.trim(),
    markStopping: () => {
      stopping = true;
    },
    isStopping: () => stopping
  };
}

function describeExit(exit: ChildExit): string {
  if (exit.error) {
    return `failed to start: ${exit.error.message}`;
  }
  return exit.signal ? `was killed by ${exit.signal}` : `exited with code ${exit.code}`;
}

/**
 * One authenticated probe of the hub: GET /health with the per-launch token.
 * True only for a 200 whose JSON body reports `status: "ok"`, so something else
 * that happens to listen on the port (and does not know the token) never counts.
 */
function probeHub(plan: UiLaunchPlan): Promise<boolean> {
  return new Promise(resolve => {
    const request = http.get(
      {
        host: HUB_LOOPBACK_HOST,
        port: Number(plan.hubPort),
        path: '/health',
        headers: {
          'X-Re-Shell-UI-Hub-Token': plan.hubToken,
          Accept: 'application/json'
        },
        agent: false,
        timeout: HUB_REQUEST_TIMEOUT_MS
      },
      response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve(false);
            return;
          }
          try {
            resolve(JSON.parse(body).status === 'ok');
          } catch {
            resolve(false);
          }
        });
        response.on('error', () => resolve(false));
      }
    );
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

/**
 * Wait until the hub answers `GET /health` with the launch token, failing fast
 * and explicitly if it exits (for example because its port is in use), cannot be
 * spawned, or does not come up in time. Readiness must be seen twice with the
 * hub still alive in between, so a stray listener on the port cannot pass for it.
 */
async function waitForHubReady(
  plan: UiLaunchPlan,
  hub: HubHandle,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let cancelled = false;

  const poll = (async (): Promise<'ready' | 'timeout'> => {
    let confirmed = false;
    while (!cancelled) {
      if (await probeHub(plan)) {
        if (confirmed) {
          return 'ready';
        }
        confirmed = true;
      } else {
        confirmed = false;
        if (Date.now() >= deadline) {
          return 'timeout';
        }
      }
      await sleep(HUB_POLL_INTERVAL_MS);
    }
    return 'timeout';
  })();

  const outcome = await Promise.race([poll, hub.exited]);
  cancelled = true;

  if (outcome === 'ready' && !hub.hasExited()) {
    return;
  }

  const exit = outcome === 'ready' || outcome === 'timeout' ? undefined : outcome;
  const finalExit = exit ?? (hub.hasExited() ? await hub.exited : undefined);

  if (finalExit) {
    const output = hub.output();
    const portHint = /EADDRINUSE|already in use/i.test(output)
      ? ` Port ${plan.hubPort} (the dashboard port + 1) is already in use; choose another --port.`
      : '';
    throw new Error(
      `Hub server ${describeExit(finalExit)} before it became ready on ${plan.hubUrl}.${portHint}` +
        (output ? `\nHub output:\n${output}` : '')
    );
  }

  throw new Error(
    `Hub server did not become ready on ${plan.hubUrl} within ${timeoutMs}ms (GET /health with the session token never succeeded).`
  );
}

/** Why the dashboard + hub are being shut down. */
type StopReason =
  | { kind: 'signal'; signal: NodeJS.Signals }
  | { kind: 'static-closed' }
  | { kind: 'dashboard-exit'; exit: ChildExit }
  | { kind: 'hub-exit'; exit: ChildExit };

/**
 * Wait for the first reason to stop: SIGINT/SIGTERM to this CLI, the dashboard
 * process or static server ending, or the hub dying underneath a running
 * dashboard. Listeners are removed by `dispose`.
 */
function superviseUntilStop(parts: {
  hub: HubHandle | null;
  dashboard?: ChildProcess;
  staticServer?: StaticServer;
}): { promise: Promise<StopReason>; dispose: () => void } {
  let settle: (reason: StopReason) => void = () => undefined;
  const promise = new Promise<StopReason>(resolve => {
    settle = resolve;
  });

  const onSigint = (): void => settle({ kind: 'signal', signal: 'SIGINT' });
  const onSigterm = (): void => settle({ kind: 'signal', signal: 'SIGTERM' });
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  const { hub, dashboard, staticServer } = parts;

  let hubExitTimer: NodeJS.Timeout | undefined;
  if (hub) {
    void hub.exited.then(exit => {
      if (!hub.isStopping()) {
        hubExitTimer = setTimeout(() => settle({ kind: 'hub-exit', exit }), HUB_EXIT_GRACE_MS);
      }
    });
  }
  if (dashboard) {
    dashboard.once('exit', (code: number | null, signal: NodeJS.Signals | null) =>
      settle({ kind: 'dashboard-exit', exit: { code, signal } })
    );
    dashboard.once('error', (error: Error) =>
      settle({ kind: 'dashboard-exit', exit: { code: null, signal: null, error } })
    );
  }
  if (staticServer) {
    staticServer.server.once('close', () => settle({ kind: 'static-closed' }));
  }

  return {
    promise,
    dispose: () => {
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
      if (hubExitTimer) {
        clearTimeout(hubExitTimer);
      }
    }
  };
}

/**
 * Turn the reason the launcher stopped into the command outcome: an orderly
 * stop (signal, dashboard exited 0, server closed) returns - setting the
 * conventional 128+signal exit code for signals - while a dead hub or a failing
 * dashboard throws so the command exits non-zero with a clear message.
 */
function resolveStopReason(reason: StopReason, hub: HubHandle | null): void {
  switch (reason.kind) {
    case 'signal':
      process.exitCode = reason.signal === 'SIGINT' ? 130 : 143;
      return;
    case 'static-closed':
      return;
    case 'hub-exit': {
      const output = hub?.output();
      throw new Error(
        `Hub server ${describeExit(reason.exit)} while the dashboard was running; the dashboard has been shut down.` +
          (output ? `\nHub output:\n${output}` : '')
      );
    }
    case 'dashboard-exit': {
      const { exit } = reason;
      if (exit.error) {
        throw exit.error;
      }
      // The terminal delivers Ctrl+C to the whole foreground group, so the
      // dashboard often exits on the very signal that is stopping us.
      if (exit.signal === 'SIGINT' || exit.signal === 'SIGTERM') {
        process.exitCode = exit.signal === 'SIGINT' ? 130 : 143;
        return;
      }
      if (exit.signal) {
        throw new Error(`Re-Shell UI exited with signal ${exit.signal}`);
      }
      if (exit.code && exit.code !== 0) {
        throw new Error(`Re-Shell UI exited with code ${exit.code}`);
      }
      return;
    }
  }
}

/** Ask a child to terminate (SIGTERM, then SIGKILL) and wait for it to be gone. */
async function stopChild(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode != null || child.signalCode != null) {
    return;
  }
  const gone = new Promise<void>(resolve => {
    child.once('exit', () => resolve());
  });
  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }
  const escalate = setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      // already gone
    }
  }, HUB_DRAIN_MS);
  escalate.unref();
  await Promise.race([gone, sleep(HUB_DRAIN_MS + HUB_KILL_WAIT_MS)]);
  clearTimeout(escalate);
}

/** Close the static dashboard server, dropping keep-alive connections that would hold it open. */
async function closeStaticServer(staticServer: StaticServer | null): Promise<void> {
  if (!staticServer) {
    return;
  }
  const closing = staticServer.close();
  (staticServer.server as http.Server & { closeAllConnections?: () => void }).closeAllConnections?.();
  await Promise.race([closing, sleep(STATIC_CLOSE_WAIT_MS)]);
}

/**
 * Static mode: serve the prebuilt SPA bundled into the CLI (dist/dashboard) via
 * the dependency-light static server, with the per-launch hub url + token
 * injected into index.html at request time, plus the bundled hub. No Vite, no
 * apps/web source.
 *
 * The hub must be answering `GET /health` before the dashboard is served; if it
 * exits early, never becomes ready, or dies later, the dashboard is torn down and
 * the command fails. Resolves only when interrupted/terminated or when the
 * dashboard server closes.
 */
async function launchStatic(plan: UiLaunchPlan, hubReadyTimeoutMs: number): Promise<void> {
  const dashboardDir = plan.dashboardDir;
  if (!dashboardDir) {
    throw new Error('Static launch mode requires a bundled dashboard directory.');
  }

  const hub = plan.hubBundlePath ? spawnHub(plan, plan.hubBundlePath) : null;
  if (!hub) {
    console.log(chalk.yellow('  Hub server bundle unavailable - launching without the hub'));
  }

  let staticServer: StaticServer | null = null;
  // Synchronous last-resort cleanup (uncaught exception / unhandled rejection paths).
  processManager.addCleanup(() => {
    signalHub(hub);
    void staticServer?.close();
  });

  let reason: StopReason;
  try {
    if (hub) {
      await waitForHubReady(plan, hub, hubReadyTimeoutMs);
      console.log(chalk.green(`  Hub ready at ${plan.hubUrl}`));
    }

    staticServer = await startStaticServer({
      rootDir: dashboardDir,
      host: plan.env.VITE_RE_SHELL_UI_HOST,
      port: Number(plan.env.VITE_RE_SHELL_UI_PORT),
      hubUrl: plan.hubUrl,
      hubToken: plan.hubToken
    });

    if (plan.open) {
      openBrowser(plan.url);
    }

    const supervision = superviseUntilStop({ hub, staticServer });
    try {
      reason = await supervision.promise;
    } finally {
      supervision.dispose();
    }
  } finally {
    await closeStaticServer(staticServer);
    await stopHub(hub);
  }

  resolveStopReason(reason, hub);
}

/**
 * Vite-dev mode: run the apps/web Vite dev server from the monorepo source plus
 * the on-demand-built hub bundle. The dashboard SPA reads the hub url + token
 * from VITE_* vars at serve time.
 *
 * As in static mode the hub must be ready before the dashboard starts, and an
 * early or later hub exit tears the dashboard down and fails the command.
 */
async function launchViteDev(plan: UiLaunchPlan, hubReadyTimeoutMs: number): Promise<void> {
  // The hub is a single, dependency-free esbuild bundle run with plain `node`.
  // It is built on demand when missing from the monorepo checkout.
  const hubBundlePath = ensureHubBundle(plan.uiRoot, plan.packageManager);
  const hub = hubBundlePath ? spawnHub(plan, hubBundlePath) : null;
  if (!hub) {
    console.log(chalk.yellow('  Hub server bundle unavailable - launching without the hub'));
  }

  // Lifecycle safety: ensure the hub and dashboard are always torn down,
  // whether the parent exits normally, is interrupted, or terminated.
  let dashboardProcess: ChildProcess | null = null;
  processManager.addCleanup(() => {
    if (dashboardProcess && dashboardProcess.exitCode === null && !dashboardProcess.killed) {
      dashboardProcess.kill('SIGTERM');
    }
    signalHub(hub);
  });

  let reason: StopReason;
  let openTimer: NodeJS.Timeout | undefined;
  try {
    if (hub) {
      await waitForHubReady(plan, hub, hubReadyTimeoutMs);
      console.log(chalk.green(`  Hub ready at ${plan.hubUrl}`));
    }

    dashboardProcess = spawn(plan.command, plan.args, {
      cwd: plan.appPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...plan.env
      }
    });

    if (plan.open) {
      openTimer = setTimeout(() => openBrowser(plan.url), VITE_OPEN_DELAY_MS);
    }

    const supervision = superviseUntilStop({ hub, dashboard: dashboardProcess });
    try {
      reason = await supervision.promise;
    } finally {
      supervision.dispose();
    }
  } finally {
    if (openTimer) {
      clearTimeout(openTimer);
    }
    await stopChild(dashboardProcess);
    await stopHub(hub);
  }

  resolveStopReason(reason, hub);
}

/**
 * Entry point for the `re-shell ui` command. Resolves a launch plan and either
 * prints it (`--dry-run` / `--json`) or starts the dashboard + hub processes.
 *
 * @param options - Command-line / programmatic options.
 * @returns Resolves once the dashboard process has exited.
 */
export async function launchUi(options: UiCommandOptions = {}): Promise<void> {
  const plan = createUiLaunchPlan(options);

  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.cyan('Re-Shell UI launch plan'));
    console.log(`  Mode: ${plan.mode}`);
    console.log(`  UI root: ${plan.uiRoot}`);
    console.log(`  Dashboard app: ${plan.appPath}`);
    console.log(`  Workspace: ${plan.workspace}`);
    if (plan.mode === 'static') {
      console.log(`  Static server: serving ${plan.dashboardDir}`);
    } else {
      console.log(`  Command: ${plan.command} ${plan.args.join(' ')}`);
    }
    console.log(`  Dashboard: ${plan.url}`);
    console.log(`  Hub: ${plan.hubUrl} (loopback-only, token-protected)`);
    console.log(`  Hub token: ${plan.hubToken}`);
    return;
  }

  console.log(chalk.cyan('Launching Re-Shell UI'));
  console.log(`  Mode: ${plan.mode}`);
  console.log(`  Dashboard: ${plan.url}`);
  console.log(`  Hub: ${plan.hubUrl} (loopback-only, token-protected)`);
  console.log(`  Hub token: ${plan.hubToken}`);
  console.log(`  Workspace: ${plan.workspace}`);
  console.log(`  UI root: ${plan.uiRoot}`);

  const hubReadyTimeoutMs = options.hubReadyTimeoutMs ?? HUB_READY_TIMEOUT_MS;

  if (plan.mode === 'static') {
    await launchStatic(plan, hubReadyTimeoutMs);
    return;
  }

  await launchViteDev(plan, hubReadyTimeoutMs);
}
