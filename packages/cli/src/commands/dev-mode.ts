import chalk from 'chalk';
import prompts from 'prompts';
import * as fs from 'fs-extra';
import * as path from 'path';
import { configWatcher, setupConfigHotReload, HotReloadOptions } from '../utils/config-watcher';
import { ProgressSpinner, flushOutput } from '../utils/spinner';
import { processManager } from '../utils/error-handler';
import { resolveProfile, EnvironmentProfile } from './profile';
import { ok } from '../utils/json-output';

/** Where users list the available profiles (the real command lives under `config`). */
export const PROFILE_LIST_HINT = 're-shell config profile list';

/**
 * Raised when a requested dev profile cannot be used: it does not exist, its
 * inheritance chain is broken, or it cannot be loaded. Carries the stable JSON
 * error code so `--json` callers can report `DEV_PROFILE_ERROR`.
 */
export class DevProfileError extends Error {
  readonly code = 'DEV_PROFILE_ERROR' as const;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DevProfileError';
    this.details = details;
  }
}

/** A profile with inheritance and overrides applied, plus the environment it injects. */
export interface ResolvedDevProfile {
  name: string;
  /** The profile exactly as resolved by the config profile system. */
  profile: EnvironmentProfile;
  /** Environment variables the dev runtime runs with, keys sorted for determinism. */
  env: Record<string, string>;
  /** Services the profile selects (empty when it selects none). */
  services: string[];
}

/**
 * Compute the environment a profile injects into the dev runtime. Pure and
 * deterministic: the profile's resolved `config.env` (inheritance + overrides
 * already applied), then the `RE_SHELL_*` variables describing the profile and
 * its dev settings, with keys sorted so equal profiles always yield equal output.
 *
 * @param name - The profile name as requested.
 * @param profile - The resolved profile.
 * @returns The environment map to apply.
 */
export function buildProfileEnvironment(
  name: string,
  profile: EnvironmentProfile
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(profile.config?.env ?? {})) {
    env[key] = String(value);
  }

  env.RE_SHELL_PROFILE = name;
  if (profile.environment) {
    env.RE_SHELL_PROFILE_ENV = profile.environment;
  }
  const dev = profile.config?.dev;
  if (dev?.port !== undefined && dev.port !== null) {
    env.RE_SHELL_DEV_PORT = String(dev.port);
  }
  if (dev?.host) {
    env.RE_SHELL_DEV_HOST = dev.host;
  }

  return Object.fromEntries(Object.entries(env).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * Resolve a named profile through the config profile system (`config profile ...`,
 * including `extends` inheritance and overrides) and derive the environment it
 * applies. An unknown or unresolvable profile is an explicit error, never a
 * silent no-op.
 *
 * @param name - Profile name from `re-shell.profiles.yaml`.
 * @returns The resolved profile and its environment.
 * @throws DevProfileError when the profile does not exist or cannot be resolved.
 */
export async function resolveDevProfile(name: string): Promise<ResolvedDevProfile> {
  let profile: EnvironmentProfile | null;
  try {
    profile = await resolveProfile(name);
  } catch (error) {
    throw new DevProfileError(
      `Profile "${name}" could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      { profile: name }
    );
  }

  if (!profile) {
    let available: string[] = [];
    try {
      const mod = await import('./profile');
      available = Object.keys((await mod.loadProfileConfig()).profiles ?? {}).sort();
    } catch {
      // the list is only a courtesy for the error message
    }
    throw new DevProfileError(
      `Profile "${name}" not found.` +
        (available.length > 0 ? ` Available profiles: ${available.join(', ')}.` : ' No profiles are defined.') +
        ` Run "${PROFILE_LIST_HINT}" to see available profiles.`,
      { profile: name, available }
    );
  }

  return {
    name,
    profile,
    env: buildProfileEnvironment(name, profile),
    services: Array.isArray(profile.config?.services) ? [...profile.config.services] : [],
  };
}

/**
 * Apply a profile environment onto `target` (the real process environment by
 * default). Existing keys are overridden; nothing else is touched.
 *
 * @returns The keys that were set, in applied order.
 */
export function applyProfileEnvironment(
  env: Record<string, string>,
  target: NodeJS.ProcessEnv = process.env
): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    target[key] = value;
    applied.push(key);
  }
  return applied;
}

/**
 * Options for the development mode command.
 * Controls start/stop/restart/status behavior, hot-reload settings, and profile selection.
 */
export interface DevModeCommandOptions {
  start?: boolean;
  stop?: boolean;
  status?: boolean;
  restart?: boolean;
  interactive?: boolean;
  verbose?: boolean;
  debounce?: number;
  noValidation?: boolean;
  noBackup?: boolean;
  noRestore?: boolean;
  excludeWorkspaces?: boolean;
  json?: boolean;
  spinner?: ProgressSpinner;
  profile?: string;
  services?: string[];
  selectServices?: boolean;
}

/**
 * Main entry point for the development mode command.
 * Dispatches to start, stop, restart, status, or interactive based on the provided options.
 *
 * @param options - Command options controlling the operation and hot-reload behavior.
 * @returns Resolves when the requested operation completes.
 */
export async function manageDevMode(options: DevModeCommandOptions = {}): Promise<void> {
  const { spinner} = options;

  try {
    if (options.start) {
      await startDevelopmentMode(options, spinner);
      return;
    }

    if (options.stop) {
      await stopDevelopmentMode(options, spinner);
      return;
    }

    if (options.restart) {
      await restartDevelopmentMode(options, spinner);
      return;
    }

    if (options.status) {
      await showDevModeStatus(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveDevMode(options, spinner);
      return;
    }

    // Default: show status if already running, otherwise show help
    if (configWatcher.isActive()) {
      await showDevModeStatus(options, spinner);
    } else {
      await showDevModeHelp();
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Development mode operation failed'));
    throw error;
  }
}

async function startDevelopmentMode(options: DevModeCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (configWatcher.isActive()) {
    if (spinner) spinner.warn(chalk.yellow('Development mode is already running'));
    console.log(chalk.yellow('⚠️  Development mode is already active'));
    return;
  }

  // Handle profile-based development
  let selectedServices: string[] = options.services || [];
  let activeProfile: EnvironmentProfile | null = null;

  if (options.profile) {
    if (spinner) spinner.stop();
    flushOutput();

    // Load and resolve profile (inheritance + overrides). An unknown profile
    // is an error, not a silent success.
    const resolved = await resolveDevProfile(options.profile);
    activeProfile = resolved.profile;

    console.log(chalk.cyan.bold(`\n🔧 Using Profile: ${options.profile}\n`));
    console.log(chalk.gray(`Environment: ${activeProfile.environment}`));
    if (activeProfile.framework) {
      console.log(chalk.gray(`Framework: ${activeProfile.framework}`));
    }
    if (activeProfile.description) {
      console.log(chalk.gray(`${activeProfile.description}\n`));
    }

    // Get available services from workspace
    const workspaceServices = await getWorkspaceServices();

    // Service selection
    if (options.selectServices || (selectedServices.length === 0 && activeProfile.config?.services)) {
      if (workspaceServices.length > 0) {
        const { value: services } = await prompts({
          type: 'multiselect',
          name: 'value',
          message: 'Select services to run in development mode:',
          choices: workspaceServices.map(s => ({
            title: s.name,
            value: s.name,
            description: s.type,
          })),
          instructions: false,
        });

        if (services) {
          selectedServices = services;
        }
      }
    }

    // Apply the profile's resolved environment (inheritance + overrides applied)
    if (Object.keys(resolved.env).length > 0) {
      console.log(chalk.cyan('\n📝 Applying environment variables from profile...'));
      for (const key of applyProfileEnvironment(resolved.env)) {
        console.log(chalk.gray(`   ${key}=${resolved.env[key]}`));
      }
    }

    // Restart spinner
    if (spinner) spinner.start();
  }

  if (spinner) spinner.setText('Starting development mode with hot-reloading...');

  const hotReloadOptions: HotReloadOptions = {
    enabled: true,
    verbose: options.verbose || false,
    debounceMs: options.debounce || 500,
    validateOnChange: !options.noValidation,
    autoBackup: !options.noBackup,
    restoreOnError: !options.noRestore,
    includeWorkspaces: !options.excludeWorkspaces,
    profile: activeProfile,
    services: selectedServices.length > 0 ? selectedServices : undefined,
  };

  try {
    await setupConfigHotReload(hotReloadOptions);

    if (spinner) {
      spinner.succeed(chalk.green('Development mode started with hot-reloading'));
    }

    console.log(chalk.green('🚀 Development mode active'));
    console.log(chalk.cyan('   Configuration files are now being watched for changes'));

    if (activeProfile) {
      console.log(chalk.gray(`   Profile: ${options.profile}`));
      if (selectedServices.length > 0) {
        console.log(chalk.gray(`   Services: ${selectedServices.join(', ')}`));
      }
    }

    if (hotReloadOptions.verbose) {
      console.log(chalk.gray('   Use --verbose for detailed change notifications'));
    }

    console.log(chalk.gray('   Run `re-shell dev stop` to disable hot-reloading\n'));

    // Setup event listeners for development feedback
    setupDevModeListeners(hotReloadOptions.verbose || false);

    // Keep the CLI process running for dev mode
    processManager.keepRunning();

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to start development mode'));
    throw error;
  }
}

/**
 * Get available services from workspace configuration
 */
async function getWorkspaceServices(): Promise<Array<{ name: string; type: string }>> {
  const services: Array<{ name: string; type: string }> = [];

  try {
    const workspaceConfigPath = path.join(process.cwd(), 're-shell.workspaces.yaml');

    if (await fs.pathExists(workspaceConfigPath)) {
      const content = await fs.readFile(workspaceConfigPath, 'utf8');
      const yaml = await import('yaml');
      const config = yaml.parse(content);

      if (config.workspaces) {
        for (const [type, workspaces] of Object.entries(config.workspaces)) {
          if (Array.isArray(workspaces)) {
            for (const workspace of workspaces) {
              if (typeof workspace === 'object' && workspace.name) {
                services.push({
                  name: workspace.name,
                  type: type,
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    // Silently fail if workspace config doesn't exist
  }

  return services;
}

async function stopDevelopmentMode(options: DevModeCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!configWatcher.isActive()) {
    if (spinner) spinner.warn(chalk.yellow('Development mode is not running'));
    console.log(chalk.yellow('⚠️  Development mode is not active'));
    return;
  }

  if (spinner) spinner.setText('Stopping development mode...');

  try {
    await configWatcher.stopWatching();

    if (spinner) {
      spinner.succeed(chalk.green('Development mode stopped'));
    }

    console.log(chalk.green('🛑 Development mode deactivated'));
    console.log(chalk.gray('   Configuration hot-reloading has been disabled\n'));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to stop development mode'));
    throw error;
  }
}

async function restartDevelopmentMode(options: DevModeCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Restarting development mode...');

  try {
    if (configWatcher.isActive()) {
      await configWatcher.stopWatching();
    }

    // Brief pause to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    await startDevelopmentMode(options, spinner);

    if (spinner) {
      spinner.succeed(chalk.green('Development mode restarted'));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to restart development mode'));
    throw error;
  }
}

async function showDevModeStatus(options: DevModeCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Checking development mode status...');

  const status = configWatcher.getStatus();

  if (spinner) spinner.stop();

  if (options.json) {
    ok(status);
    return;
  }

  console.log(chalk.cyan('\\n🔧 Development Mode Status'));
  console.log(chalk.gray('═'.repeat(40)));

  if (status.isWatching) {
    console.log(`\\n✅ ${chalk.green('Active')} - Configuration hot-reloading enabled`);
    
    if (status.watchedPaths.length > 0) {
      console.log(`\\n📁 Watched paths (${status.watchedPaths.length}):`);
      for (const path of status.watchedPaths) {
        console.log(`  • ${chalk.gray(path)}`);
      }
    }

    console.log(`\\n⚙️  Options:`);
    console.log(`   Debounce: ${status.options.debounceMs}ms`);
    console.log(`   Validation: ${status.options.validateOnChange ? '✅' : '❌'}`);
    console.log(`   Auto backup: ${status.options.autoBackup ? '✅' : '❌'}`);
    console.log(`   Error restore: ${status.options.restoreOnError ? '✅' : '❌'}`);
    console.log(`   Include workspaces: ${status.options.includeWorkspaces ? '✅' : '❌'}`);
    console.log(`   Verbose logging: ${status.options.verbose ? '✅' : '❌'}`);
  } else {
    console.log(`\\n❌ ${chalk.red('Inactive')} - Configuration hot-reloading disabled`);
    console.log(chalk.gray('   Run `re-shell dev start` to enable hot-reloading'));
  }

  console.log(chalk.cyan('\\n🛠️  Available Commands:'));
  console.log('  • re-shell dev start [options]');
  console.log('  • re-shell dev stop');
  console.log('  • re-shell dev restart [options]');
  console.log('  • re-shell dev interactive');
}

async function showDevModeHelp(): Promise<void> {
  console.log(chalk.cyan('\\n🔧 Development Mode - Configuration Hot-Reloading'));
  console.log(chalk.gray('═'.repeat(60)));

  console.log('\\nDevelopment mode enables automatic reloading of configuration files');
  console.log('when they change, providing instant feedback during development.');

  console.log(chalk.cyan('\\n🚀 Quick Start:'));
  console.log('  re-shell dev start              # Start with default settings');
  console.log('  re-shell dev start --verbose    # Start with detailed logging');
  console.log('  re-shell dev interactive        # Interactive setup');

  console.log(chalk.cyan('\\n📋 Features:'));
  console.log('  • Real-time configuration file watching');
  console.log('  • Automatic validation on changes');
  console.log('  • Error recovery with backup/restore');
  console.log('  • Debounced change detection');
  console.log('  • Support for global, project, and workspace configs');

  console.log(chalk.cyan('\\n⚙️  Options:'));
  console.log('  --verbose               Enable detailed change notifications');
  console.log('  --debounce <ms>        Change detection delay (default: 500ms)');
  console.log('  --no-validation        Skip configuration validation');
  console.log('  --no-backup            Disable automatic backups');
  console.log('  --no-restore           Disable error recovery');
  console.log('  --exclude-workspaces   Skip workspace configuration watching');
}

async function interactiveDevMode(options: DevModeCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const currentStatus = configWatcher.getStatus();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { 
          title: currentStatus.isWatching ? '🛑 Stop development mode' : '🚀 Start development mode', 
          value: currentStatus.isWatching ? 'stop' : 'start' 
        },
        { title: '🔄 Restart development mode', value: 'restart' },
        { title: '⚙️  Configure hot-reload options', value: 'configure' },
        { title: '📊 Show current status', value: 'status' },
        { title: '🔄 Force reload configurations', value: 'force-reload' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'start':
      await interactiveStart();
      break;
    case 'stop':
      await stopDevelopmentMode(options);
      break;
    case 'restart':
      await restartDevelopmentMode(options);
      break;
    case 'configure':
      await interactiveConfigure();
      break;
    case 'status':
      await showDevModeStatus(options);
      break;
    case 'force-reload':
      await forceReloadConfigs();
      break;
  }
}

async function interactiveStart(): Promise<void> {
  const response = await prompts([
    {
      type: 'toggle',
      name: 'verbose',
      message: 'Enable verbose logging?',
      initial: false,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'number',
      name: 'debounce',
      message: 'Debounce delay (milliseconds):',
      initial: 500,
      min: 100,
      max: 5000
    },
    {
      type: 'toggle',
      name: 'validation',
      message: 'Validate configurations on change?',
      initial: true,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'autoBackup',
      message: 'Create automatic backups before changes?',
      initial: true,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'restoreOnError',
      message: 'Restore from backup on validation errors?',
      initial: true,
      active: 'yes',
      inactive: 'no'
    },
    {
      type: 'toggle',
      name: 'includeWorkspaces',
      message: 'Watch workspace configurations?',
      initial: true,
      active: 'yes',
      inactive: 'no'
    }
  ]);

  const options: DevModeCommandOptions = {
    verbose: response.verbose,
    debounce: response.debounce,
    noValidation: !response.validation,
    noBackup: !response.autoBackup,
    noRestore: !response.restoreOnError,
    excludeWorkspaces: !response.includeWorkspaces
  };

  await startDevelopmentMode(options);
}

async function interactiveConfigure(): Promise<void> {
  const currentOptions = configWatcher.getStatus().options;

  const response = await prompts([
    {
      type: 'toggle',
      name: 'verbose',
      message: 'Verbose logging:',
      initial: currentOptions.verbose,
      active: 'enabled',
      inactive: 'disabled'
    },
    {
      type: 'number',
      name: 'debounceMs',
      message: 'Debounce delay (ms):',
      initial: currentOptions.debounceMs,
      min: 100,
      max: 5000
    },
    {
      type: 'toggle',
      name: 'validateOnChange',
      message: 'Validate on change:',
      initial: currentOptions.validateOnChange,
      active: 'enabled',
      inactive: 'disabled'
    },
    {
      type: 'toggle',
      name: 'autoBackup',
      message: 'Auto backup:',
      initial: currentOptions.autoBackup,
      active: 'enabled',
      inactive: 'disabled'
    },
    {
      type: 'toggle',
      name: 'restoreOnError',
      message: 'Restore on error:',
      initial: currentOptions.restoreOnError,
      active: 'enabled',
      inactive: 'disabled'
    },
    {
      type: 'toggle',
      name: 'includeWorkspaces',
      message: 'Include workspaces:',
      initial: currentOptions.includeWorkspaces,
      active: 'enabled',
      inactive: 'disabled'
    }
  ]);

  configWatcher.updateOptions(response);
  console.log(chalk.green('✅ Configuration updated'));
}

async function forceReloadConfigs(): Promise<void> {
  try {
    await configWatcher.forceReload();
    console.log(chalk.green('✅ Configurations force-reloaded'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to force reload:'), error);
  }
}

function setupDevModeListeners(verbose: boolean): void {
  configWatcher.on('config-changed', (event) => {
    if (verbose) {
      console.log(chalk.green(`🔄 ${event.configType} config updated: ${event.path}`));
    }
  });

  configWatcher.on('config-error', (event) => {
    console.error(chalk.red(`❌ ${event.configType} config error: ${event.error?.message}`));
  });

  configWatcher.on('watching-started', () => {
    if (verbose) {
      console.log(chalk.green('👀 File watching started'));
    }
  });

  configWatcher.on('watching-stopped', () => {
    if (verbose) {
      console.log(chalk.gray('👁️  File watching stopped'));
    }
  });
}