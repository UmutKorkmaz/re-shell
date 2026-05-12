import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

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
  open: boolean;
  env: Record<string, string>;
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
  if (packageName === '@re-shell/ui-web' || packageName === '@re-shell/ui-dashboard') {
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
    case 'yarn':
      return ['run', 'dev', '--host', host, '--port', port];
    case 'bun':
      return ['run', 'dev', '--', '--host', host, '--port', port];
    case 'npm':
    case 'pnpm':
    default:
      return ['run', 'dev', '--', '--host', host, '--port', port];
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
  const workspace = path.resolve(options.workspace || process.cwd());
  const { uiRoot, appPath } = resolveUiProject(options.uiPath || options.uiRoot);
  const packageManager = detectPackageManager(uiRoot, appPath, options.packageManager);
  const args = createPackageManagerArgs(packageManager, host, port);
  const url = `http://${host}:${port}`;
  const cliPath = process.argv[1] ? path.resolve(process.argv[1]) : 're-shell';

  return {
    uiRoot,
    appPath,
    workspace,
    packageManager,
    command: packageManager,
    args,
    url,
    open: options.open !== false,
    env: {
      RE_SHELL_WORKSPACE: workspace,
      RE_SHELL_CLI_BIN: cliPath,
      RE_SHELL_UI_OPEN: options.open === false ? '0' : '1',
      VITE_RE_SHELL_WORKSPACE: workspace,
      VITE_RE_SHELL_CLI: cliPath,
      VITE_RE_SHELL_UI_PORT: port,
      VITE_RE_SHELL_UI_HOST: host,
      VITE_RE_SHELL_LAUNCHER: 're-shell ui'
    }
  };
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
    console.log(`  URL: ${plan.url}`);
    return;
  }

  console.log(chalk.cyan('Launching Re-Shell UI'));
  console.log(`  ${plan.url}`);
  console.log(`  Workspace: ${plan.workspace}`);
  console.log(`  UI root: ${plan.uiRoot}`);

  if (plan.open) {
    setTimeout(() => openBrowser(plan.url), 1500);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      cwd: plan.appPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...plan.env
      }
    });

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
}
