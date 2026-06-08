import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { GENERATED_PKG_SCOPE, RECOGNIZED_PKG_SCOPES } from '../utils/scope';
import { processManager } from '../utils/error-handler';

// Recognized package names for the standalone UI app. Includes the legacy
// scope so already-installed dashboards still resolve.
const UI_APP_PACKAGE_NAMES = new Set([
  `${GENERATED_PKG_SCOPE}/ui-web`,
  `${GENERATED_PKG_SCOPE}/ui-dashboard`,
  // legacy-compat: build names from the recognized-scopes list to avoid hard-coding the old scope
  ...RECOGNIZED_PKG_SCOPES.filter(s => s !== `${GENERATED_PKG_SCOPE}/`).flatMap(s => [
    `${s}ui-web`,
    `${s}ui-dashboard`
  ])
]);

export interface UiCommandOptions {
  uiPath?: string;
  uiRoot?: string;
  workspace?: string;
  port?: string;
  host?: string;
  packageManager?: string;
  dryRun?: boolean;
  json?: boolean;
  open?: boolean;
}

export interface UiLaunchPlan {
  uiRoot: string;
  appPath: string;
  workspace: string;
  packageManager: string;
  command: string;
  args: string[];
  url: string;
  hubUrl: string;
  hubPort: string;
  hubToken: string;
  open: boolean;
  env: Record<string, string>;
}

/**
 * Generate a per-launch session token used to authenticate every hub request.
 * 32 random bytes (256 bits) rendered as hex.
 */
function generateHubToken(): string {
  return randomBytes(32).toString('hex');
}

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

export function resolveUiProject(uiPath?: string, cwd = process.cwd()): { uiRoot: string; appPath: string } {
  const candidates = uiPath
    ? [uiPath]
    : ([
        process.env.RE_SHELL_UI_PATH,
        cwd,
        path.join(cwd, 're-shell-ui'),
        path.resolve(cwd, '../re-shell-ui'),
        path.resolve(__dirname, '../../../re-shell-ui'),
        path.resolve(__dirname, '../../re-shell-ui')
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
      'Could not locate re-shell-ui.',
      'Pass --ui-path /path/to/re-shell-ui or set RE_SHELL_UI_PATH.',
      'Expected a dashboard app at apps/web/package.json.'
    ].join(' ')
  );
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

export function createUiLaunchPlan(options: UiCommandOptions = {}): UiLaunchPlan {
  ensureSupportedNodeVersion();

  const host = normalizeHost(options.host);
  const port = normalizePort(options.port);
  const hubPort = String(parseInt(port) + 1);
  const workspace = path.resolve(options.workspace || process.cwd());
  const { uiRoot, appPath } = resolveUiProject(options.uiPath || options.uiRoot);
  const packageManager = detectPackageManager(uiRoot, appPath, options.packageManager);
  const args = createPackageManagerArgs(packageManager, host, port);
  const url = `http://${host}:${port}`;
  const hubUrl = `http://${host}:${hubPort}`;
  const cliPath = process.argv[1] ? path.resolve(process.argv[1]) : 're-shell';
  const hubToken = generateHubToken();

  return {
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
    env: {
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
    }
  };
}

// Grace period the hub gets to drain on SIGTERM before we escalate to SIGKILL.
const HUB_DRAIN_MS = 3000;

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
 * Tear down the spawned hub child: SIGTERM for a graceful drain, then SIGKILL
 * if it has not exited within the grace window. Idempotent and safe to call
 * from multiple signal handlers and the normal-exit path.
 */
function teardownHub(hub: ChildProcess | null): void {
  if (!hub || hub.killed || hub.exitCode !== null) {
    return;
  }
  hub.kill('SIGTERM');
  const escalate = setTimeout(() => {
    if (hub.exitCode === null && !hub.killed) {
      hub.kill('SIGKILL');
    }
  }, HUB_DRAIN_MS);
  // Do not keep the event loop alive solely for the escalation timer.
  escalate.unref();
  hub.once('exit', () => clearTimeout(escalate));
}

export async function launchUi(options: UiCommandOptions = {}): Promise<void> {
  const plan = createUiLaunchPlan(options);

  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (options.dryRun) {
    console.log(chalk.cyan('Re-Shell UI launch plan'));
    console.log(`  UI root: ${plan.uiRoot}`);
    console.log(`  Dashboard app: ${plan.appPath}`);
    console.log(`  Workspace: ${plan.workspace}`);
    console.log(`  Command: ${plan.command} ${plan.args.join(' ')}`);
    console.log(`  Dashboard: ${plan.url}`);
    console.log(`  Hub: ${plan.hubUrl} (loopback-only, token-protected)`);
    console.log(`  Hub token: ${plan.hubToken}`);
    return;
  }

  console.log(chalk.cyan('Launching Re-Shell UI'));
  console.log(`  Dashboard: ${plan.url}`);
  console.log(`  Hub: ${plan.hubUrl} (loopback-only, token-protected)`);
  console.log(`  Hub token: ${plan.hubToken}`);
  console.log(`  Workspace: ${plan.workspace}`);
  console.log(`  UI root: ${plan.uiRoot}`);

  if (plan.open) {
    setTimeout(() => openBrowser(plan.url), 1500);
  }

  // Start the hub server as a background process. The hub is a single,
  // dependency-free bundle compiled by esbuild and run with plain `node` — no
  // ts-node/tsx. It is built on demand when missing.
  let hubProcess: ChildProcess | null = null;
  const hubBundlePath = ensureHubBundle(plan.uiRoot, plan.packageManager);

  if (hubBundlePath) {
    // Note: no host override is forwarded. The hub hard-pins itself to
    // 127.0.0.1 and ignores any caller-supplied host.
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

    hubProcess = spawn('node', [hubBundlePath], {
      cwd: path.dirname(hubBundlePath),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: hubEnv
    });

    hubProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(data);
    });

    hubProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });

    hubProcess.on('error', (err) => {
      console.warn(chalk.yellow(`Hub server failed to start: ${err.message}`));
    });
  } else {
    console.log(chalk.yellow('  Hub server bundle unavailable - launching without the hub'));
  }

  // Lifecycle safety: ensure the hub is always torn down, whether the parent
  // exits normally, is interrupted, or terminated. Registered with the CLI's
  // process manager AND directly on SIGINT/SIGTERM so no path leaves an orphan
  // (neither the hub nor the dashboard dev server).
  let dashboardProcess: ChildProcess | null = null;
  const teardown = (): void => {
    if (dashboardProcess && dashboardProcess.exitCode === null && !dashboardProcess.killed) {
      dashboardProcess.kill('SIGTERM');
    }
    teardownHub(hubProcess);
  };
  processManager.addCleanup(teardown);

  const onSignal = (signal: NodeJS.Signals): void => {
    teardown();
    // Re-raise default behaviour after children have been signalled so the CLI
    // itself exits with the conventional 128 + signal number. Defer the exit a
    // tick so the SIGTERMs are delivered before we go.
    setTimeout(() => process.exit(signal === 'SIGINT' ? 130 : 143), 50).unref();
  };
  const sigintHandler = (): void => onSignal('SIGINT');
  const sigtermHandler = (): void => onSignal('SIGTERM');
  process.once('SIGINT', sigintHandler);
  process.once('SIGTERM', sigtermHandler);

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(plan.command, plan.args, {
        cwd: plan.appPath,
        stdio: 'inherit',
        env: {
          ...process.env,
          ...plan.env
        }
      });
      dashboardProcess = child;

      child.on('error', reject);
      child.on('exit', (code, signal) => {
        if (signal) {
          reject(new Error(`Re-Shell UI exited with signal ${signal}`));
          return;
        }
        if (code && code !== 0) {
          reject(new Error(`Re-Shell UI exited with code ${code}`));
          return;
        }
        resolve();
      });
    });
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigtermHandler);
    teardown();
  }
}
