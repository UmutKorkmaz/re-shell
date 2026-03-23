#!/usr/bin/env node

// Start performance tracking
import { mark, isVersionRequest, getFromCache, setCache } from './startup-optimizer';
mark('startup-begin');

// Only force color in interactive terminals and never override NO_COLOR.
const shouldForceColor =
  (process.stdout.isTTY || process.stderr.isTTY) &&
  !process.env.NO_COLOR &&
  typeof process.env.FORCE_COLOR === 'undefined';

if (shouldForceColor) {
  process.env.FORCE_COLOR = '1';
}
if (process.stdout.isTTY) {
  process.stdout.setEncoding('utf8');
}
if (process.stderr.isTTY) {
  process.stderr.setEncoding('utf8');
}

mark('env-setup-done');


// Get version from package.json (cached)
let version = ''; // fallback
const packageVersion = getFromCache('package-version');
if (typeof packageVersion === 'string') {
  version = packageVersion;
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodePath = require('path');
    const packageJsonPath = nodePath.resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    version = packageJson.version;
    setCache('package-version', version);
  } catch {
    // Use fallback
  }
}

// Fast path for version requests
if (isVersionRequest()) {
  mark('version-fast-path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chalk = require('chalk');
  console.log(chalk.cyan(`
██████╗ ███████╗           ███████╗██╗  ██╗███████╗██╗     ██╗
██╔══██╗██╔════╝           ██╔════╝██║  ██║██╔════╝██║     ██║
██████╔╝█████╗  ████████╗  ███████╗███████║█████╗  ██║     ██║
██╔══██╗██╔══╝  ╚═══════╝  ╚════██║██╔══██║██╔══╝  ██║     ██║
██║  ██║███████╗           ███████║██║  ██║███████╗███████╗███████╗
╚═╝  ╚═╝╚══════╝           ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
                                v${version}
`));
  console.log(version);
  process.exit(0);
}

mark('version-check-done');

// Enhanced error handling and signal management
import { setupStreamErrorHandlers, processManager, createAsyncCommand, withTimeout } from './utils/error-handler';

// Core imports only
import { Command } from 'commander';
import chalk from 'chalk';

// Utilities
import { createSpinner, flushOutput } from './utils/spinner';

// Standalone command handlers
import { initMonorepo } from './commands/init';
import { createProject } from './commands/create';
import { addMicrofrontend } from './commands/add';
import { removeMicrofrontend } from './commands/remove';
import { listMicrofrontends } from './commands/list';
import { buildMicrofrontend } from './commands/build';
import { serveMicrofrontend } from './commands/serve';
import { launchTUI } from './commands/tui';

// Command group registrations
import { registerWorkspaceGroup } from './groups/workspace.group';
import { registerConfigGroup } from './groups/config.group';
import { registerGenerateGroup } from './groups/generate.group';
import { registerQualityGroup } from './groups/quality.group';
import { registerApiGroup } from './groups/api.group';
import { registerPluginGroup } from './groups/plugin.group';
import { registerServiceGroup } from './groups/service.group';
import { registerToolsGroup } from './groups/tools.group';
import { registerK8sGroup } from './groups/k8s.group';
import { registerCloudGroup } from './groups/cloud.group';
import { registerObserveGroup } from './groups/observe.group';
import { registerSecurityGroup } from './groups/security.group';
import { registerCollabGroup } from './groups/collab.group';
import { registerLearnGroup } from './groups/learn.group';
import { registerDataGroup } from './groups/data.group';
import { registerAliases } from './aliases';

mark('core-imports-done');

// Lazy update check — avoid blocking startup
const checkUpdate = () => {
  setTimeout(async () => {
    if (
      !process.argv.includes('update') &&
      !process.argv.includes('--version') &&
      !process.argv.includes('-V')
    ) {
      try {
        const { checkForUpdates } = await import('./utils/checkUpdate');
        checkForUpdates(version);
      } catch {
        // Ignore update check errors
      }
    }
  }, 100);
};

mark('version-resolved');

// Lazy banner generation
const getBanner = () => {
  return chalk.cyan(`
██████╗ ███████╗           ███████╗██╗  ██╗███████╗██╗     ██╗
██╔══██╗██╔════╝           ██╔════╝██║  ██║██╔════╝██║     ██║
██████╔╝█████╗  ████████╗  ███████╗███████║█████╗  ██║     ██║
██╔══██╗██╔══╝  ╚═══════╝  ╚════██║██╔══██║██╔══╝  ██║     ██║
██║  ██║███████╗           ███████║██║  ██║███████╗███████╗███████╗
╚═╝  ╚═╝╚══════╝           ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
                                v${version}
`);
};

setupStreamErrorHandlers();

const program = new Command();
mark('program-created');

checkUpdate();
mark('update-check-deferred');

// Display banner for main command
if (
  process.argv.length <= 2 ||
  (process.argv.length === 3 && ['-h', '--help', '-V', '--version'].includes(process.argv[2]))
) {
  console.log(getBanner());
}

program
  .name('re-shell')
  .description(
    'Re-Shell CLI - Full-Stack Development Platform with microfrontends, microservices, security, and collaboration tools'
  )
  .enablePositionalOptions()
  .version(version);

// ─── Standalone commands ─────────────────────────────────────────────────────

// Initialize monorepo command
program
  .command('init')
  .description('Initialize a new monorepo workspace (Frontend, Full-Stack, Microservices, Polyglot)')
  .argument('<name>', 'Name of the monorepo')
  .option('--package-manager <pm>', 'Package manager to use (npm, yarn, pnpm, bun)', 'pnpm')
  .option('--template <template>', 'Template to use (blank, ecommerce, dashboard, saas)', 'blank')
  .option('--preset <name>', 'Use saved configuration preset')
  .option('--skip-install', 'Skip dependency installation')
  .option('--no-git', 'Skip Git repository initialization')
  .option('--no-submodules', 'Skip submodule support setup')
  .option('--force', 'Overwrite existing directory')
  .option('--debug', 'Enable debug output')
  .option('-y, --yes', 'Skip interactive prompts and use defaults')
  .action(
    createAsyncCommand(async (name, options) => {
      const spinner = createSpinner('Initializing monorepo...').start();
      processManager.addCleanup(() => spinner.stop());
      flushOutput();

      await withTimeout(async () => {
        await initMonorepo(name, {
          packageManager: options.packageManager,
          template: options.template,
          preset: options.preset,
          skipInstall: options.skipInstall,
          git: options.git !== false,
          submodules: options.submodules !== false,
          force: options.force,
          debug: options.debug,
          yes: options.yes,
          spinner: spinner,
        });
      }, 300000); // 5 minute timeout for init

      // Get success info stored by initMonorepo
      const successInfo = (global as any).__RE_SHELL_INIT_SUCCESS__;
      if (!successInfo) {
        spinner.stop();
        return;
      }
      spinner.succeed(chalk.green(`Monorepo "${name}" initialized successfully!`));

      // Display next steps
      console.log('\nNext steps:');
      console.log(`  1. cd ${successInfo?.name || name}`);
      console.log(`  2. ${successInfo?.packageManager || 'pnpm'} install`);
      console.log('  3. re-shell create my-app --framework react-ts');
      console.log('  4. re-shell workspace list');

      if (successInfo?.submodules) {
        console.log('\nSubmodule commands:');
        console.log('  • re-shell submodule add <url> <path>');
        console.log('  • re-shell submodule status');
      }

      // Clean up global state
      delete (global as any).__RE_SHELL_INIT_SUCCESS__;
    })
  );

// Create project command
program
  .command('create')
  .description('Create a new Re-Shell project with shell application')
  .argument('<name>', 'Name of the project')
  .option('-t, --team <team>', 'Team name')
  .option('-o, --org <organization>', 'Organization name', 're-shell')
  .option('-d, --description <description>', 'Project description')
  .option('--template <template>', 'Template to use (react, react-ts)', 'react-ts')
  .option(
    '--framework <framework>',
    'Frontend framework to use (react|react-ts|vue|vue-ts|svelte|svelte-ts)'
  )
  .option('--frontend <framework>', 'Frontend framework (alias for --framework)')
  .option(
    '--backend <framework>',
    'Backend framework (express, fastify, nestjs, koa, hapi, etc.)'
  )
  .option(
    '--db <database>',
    'Database ORM (prisma, typeorm, mongoose, none)',
    'none'
  )
  .option('--fullstack', 'Create full-stack project with both frontend and backend')
  .option(
    '--polyglot',
    'Create polyglot microservices project with services in multiple languages'
  )
  .option(
    '--microfrontend',
    'Create microfrontend project with Module Federation setup'
  )
  .option('--type <type>', 'Workspace type (app|package|lib|tool) - monorepo only')
  .option('--port <port>', 'Development server port [default: 5173]')
  .option('--route <route>', 'Route path (for apps)')
  .option('--package-manager <pm>', 'Package manager to use (npm, yarn, pnpm)', 'pnpm')
  .option('--dry-run', 'Preview changes without applying them')
  .option('--verbose', 'Show detailed dry-run output')
  .action(
    createAsyncCommand(async (name, options) => {
      // Handle backward compatibility: if template is provided but not framework, map it
      if (options.template && !options.framework && !options.frontend) {
        options.framework = options.template;
      }
      // Handle frontend alias
      if (options.frontend && !options.framework) {
        options.framework = options.frontend;
      }
      // Auto-detect fullstack if both backend and frontend are specified
      if (options.backend && options.framework && !options.fullstack) {
        options.fullstack = true;
      }
      const spinner = createSpinner('Creating Re-Shell project...').start();
      processManager.addCleanup(() => spinner.stop());
      flushOutput();

      await withTimeout(async () => {
        await createProject(name, { ...options, isProject: true, spinner });
      }, 180000); // 3 minute timeout

      if (options.dryRun) {
        spinner.succeed(chalk.green(`Dry run completed for "${name}"`));
      } else {
        spinner.succeed(chalk.green(`Re-Shell project "${name}" created successfully!`));
      }
    })
  );

// Add microfrontend command
program
  .command('add')
  .description('Add a new microfrontend to existing Re-Shell project')
  .argument('<name>', 'Name of the microfrontend')
  .option('-t, --team <team>', 'Team name')
  .option('-o, --org <organization>', 'Organization name', 're-shell')
  .option('-d, --description <description>', 'Microfrontend description')
  .option('--template <template>', 'Template to use (react, react-ts)', 'react-ts')
  .option('--route <route>', 'Route path for the microfrontend')
  .option('--port <port>', 'Dev server port', '5173')
  .action(
    createAsyncCommand(async (name, options) => {
      const spinner = createSpinner('Adding microfrontend...').start();
      processManager.addCleanup(() => spinner.stop());
      flushOutput();

      await withTimeout(async () => {
        await addMicrofrontend(name, { ...options, spinner });
      }, 120000); // 2 minute timeout

      spinner.succeed(chalk.green(`Microfrontend "${name}" added successfully!`));
    })
  );

// Remove microfrontend command
program
  .command('remove')
  .description('Remove a microfrontend from existing Re-Shell project')
  .argument('<name>', 'Name of the microfrontend to remove')
  .option('--force', 'Force removal without confirmation')
  .action(
    createAsyncCommand(async (name, options) => {
      const spinner = createSpinner('Removing microfrontend...').start();
      processManager.addCleanup(() => spinner.stop());
      flushOutput();

      await withTimeout(async () => {
        await removeMicrofrontend(name, { ...options, spinner });
      }, 60000); // 1 minute timeout

      spinner.succeed(chalk.green(`Microfrontend "${name}" removed successfully!`));
    })
  );

// List microfrontends command
program
  .command('list')
  .description('List all microfrontends in the current project')
  .option('--json', 'Output as JSON')
  .action(
    createAsyncCommand(async options => {
      const spinner = options.json ? undefined : createSpinner('Loading microfrontends...').start();
      if (spinner) {
        processManager.addCleanup(() => spinner.stop());
        flushOutput();
      }

      await withTimeout(async () => {
        await listMicrofrontends({ ...options, spinner });
      }, 30000); // 30 second timeout

      if (spinner) {
        spinner.succeed(chalk.green('Microfrontends listed successfully!'));
      }
    })
  );

// TUI command - Interactive Terminal User Interface
program
  .command('tui')
  .description('Launch interactive Terminal User Interface (TUI)')
  .option('--project <path>', 'Project path', process.cwd())
  .option('--mode <mode>', 'TUI mode (dashboard|init|manage|config)', 'dashboard')
  .option('--debug', 'Enable debug output')
  .option('--ink', 'Use Ink-based TUI (React for CLIs)')
  .action(
    createAsyncCommand(async (options) => {
      // No spinner for TUI - it has its own interface
      processManager.addCleanup(() => {
        // Cleanup will be handled by TUI process
      });
      flushOutput();

      if (options.ink) {
        // Use Ink-based TUI
        const { launchInkTUI } = await import('./commands/ink-tui');
        await launchInkTUI();
      } else {
        // Use Go-based TUI (original)
        await withTimeout(async () => {
          await launchTUI({
            project: options.project,
            mode: options.mode,
            debug: options.debug
          });
        }, 300000); // 5 minute timeout for TUI session
      }
    })
  );

// Build command
program
  .command('build')
  .description('Build all or specific microfrontends')
  .argument('[name]', 'Name of the microfrontend to build (builds all if omitted)')
  .option('--production', 'Build for production environment')
  .option('--analyze', 'Analyze bundle size')
  .action(
    createAsyncCommand(async (name, options) => {
      const spinner = createSpinner('Building...').start();
      processManager.addCleanup(() => spinner.stop());
      flushOutput();

      await withTimeout(async () => {
        await buildMicrofrontend(name, { ...options, spinner });
      }, 600000); // 10 minute timeout for builds

      spinner.succeed(
        chalk.green(
          name
            ? `Microfrontend "${name}" built successfully!`
            : 'All microfrontends built successfully!'
        )
      );
    })
  );

// Serve command
program
  .command('serve')
  .description('Start development server')
  .argument('[name]', 'Name of the microfrontend to serve (serves all if omitted)')
  .option('--port <port>', 'Port to serve on', '3000')
  .option('--host <host>', 'Host to serve on', 'localhost')
  .option('--open', 'Open in browser')
  .action(
    createAsyncCommand(async (name, options) => {
      const spinner = createSpinner('Starting development server...').start();
      processManager.addCleanup(() => spinner.stop());
      flushOutput();

      await serveMicrofrontend(name, { ...options, spinner });
    })
  );

// ─── Command groups ───────────────────────────────────────────────────────────

registerWorkspaceGroup(program);
registerConfigGroup(program);
registerGenerateGroup(program);
registerQualityGroup(program);
registerApiGroup(program);
registerPluginGroup(program);
registerServiceGroup(program);
registerToolsGroup(program);
registerK8sGroup(program);
registerCloudGroup(program);
registerObserveGroup(program);
registerSecurityGroup(program);
registerCollabGroup(program);
registerLearnGroup(program);
registerDataGroup(program);

// ─── Backward-compatibility aliases (hidden from --help) ──────────────────────

registerAliases(program);

// ─── Parse and execute ────────────────────────────────────────────────────────

program.parseAsync(process.argv).then(() => {
  if (!processManager.shouldKeepRunning()) {
    process.exit(process.exitCode ?? 0);
  }
}).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
