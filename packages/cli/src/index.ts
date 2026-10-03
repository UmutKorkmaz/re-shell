#!/usr/bin/env node

// Start performance tracking
import { mark, isVersionRequest, getFromCache, setCache } from './startup-optimizer';
import { installEpipeHandler } from './utils/epipe';
mark('startup-begin');

// A reader that closes the pipe early (`re-shell ... --json | head -c 100`) must
// end the process quietly, not with an uncaught EPIPE stack trace.
installEpipeHandler();

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

// Fast path for version requests. stdout carries exactly the version line: the
// ASCII banner is decoration for an interactive terminal and has no place in
// output a script may capture (`VERSION=$(re-shell --version)`).
if (isVersionRequest()) {
  mark('version-fast-path');
  process.stdout.write(`${version}\n`);
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
import { createProject, CreateError } from './commands/create';
import {
  enableJsonMode,
  ok,
  fail,
  failFromError,
  getEmittedEnvelopeCount,
  isJsonModeActive,
} from './utils/json-output';
import { installJsonModeHook, installJsonUsageErrors } from './utils/json-mode-hook';
import { computeBackendDryRun, isBackendTemplate } from './utils/template-dry-run';
import { addMicrofrontend } from './commands/add';
import { removeMicrofrontend } from './commands/remove';
import { listMicrofrontends } from './commands/list';
import { buildMicrofrontend } from './commands/build';
import { serveMicrofrontend } from './commands/serve';
import { launchTUI } from './commands/tui';
import { launchUi } from './commands/ui';
import { runDoctorCheck } from './commands/doctor';
import { runProjectAnalysis } from './commands/analyze';

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
import { registerTemplatesGroup } from './groups/templates.group';
import { registerCommandsGroup } from './groups/commands.group';
import { registerAiGroup } from './groups/ai.group';
import { registerFindGroup } from './groups/find.group';
import { registerAgentsGroup } from './groups/agents.group';
import { registerRunGroup } from './groups/run.group';
import { registerCacheGroup } from './groups/cache.group';
import { registerDevGroup } from './groups/dev.group';
import { registerScorecardGroup } from './groups/scorecard.group';
import { registerReleaseGroup } from './groups/release.group';
import { registerMigrateGroup } from './groups/migrate.group';
import { registerCatalogGroup } from './groups/catalog.group';
import { registerFederationGroup } from './groups/federation.group';
import { registerApiVerifyGroup } from './groups/api-verify.group';
import { registerFixCiGroup } from './groups/fix-ci.group';
import { registerBoundariesGroup } from './groups/boundaries.group';
import { registerEnvGroup } from './groups/env.group';
import { registerUiTestGroup } from './groups/ui-test.group';
import { registerCompletionGroup } from './groups/completion.group';
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

// `--json` hygiene as a property of the command tree: any command run with
// --json gets stdout reserved for exactly one envelope (see json-mode-hook.ts).
installJsonModeHook(program);

checkUpdate();
mark('update-check-deferred');

// Display the banner for the bare command and for --help, but only to an
// interactive terminal: never for --version (stdout is just the version line),
// never alongside --json, and never when stdout is piped or redirected.
if (
  process.stdout.isTTY &&
  !process.argv.includes('--json') &&
  (process.argv.length <= 2 ||
    (process.argv.length === 3 && ['-h', '--help'].includes(process.argv[2])))
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
      const successInfo = (global as typeof globalThis & { __RE_SHELL_INIT_SUCCESS__?: { name?: string; packageManager?: string; submodules?: boolean } }).__RE_SHELL_INIT_SUCCESS__;
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
      delete (global as typeof globalThis & { __RE_SHELL_INIT_SUCCESS__?: { name?: string; packageManager?: string; submodules?: boolean } }).__RE_SHELL_INIT_SUCCESS__;
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
  .option(
    '--template <template>',
    'Backend template id (express, fastapi, ...), frontend framework (react-ts, vue, ...), architecture template (mern, ...) or "blank" for an empty workspace [default: react-ts frontend]'
  )
  .option(
    '--framework <framework>',
    'Frontend framework to use (react|react-ts|vue|vue-ts|svelte|svelte-ts|next|angular|...); see `templates list`'
  )
  .option('--frontend <framework>', 'Frontend framework (alias for --framework)')
  .option(
    '--backend <framework>',
    'Backend framework (express, fastify, nestjs, koa, hapi, etc.)'
  )
  .option(
    '--db <database>',
    'Database ORM (prisma, typeorm, mongoose, none) [default: none]'
  )
  .option('--fullstack', 'Create full-stack project with both frontend and backend (default backend: express)')
  .option(
    '--polyglot',
    'Create polyglot microservices project with services in multiple languages'
  )
  .option('--gateway <framework>', 'Polyglot API gateway (express|fastify|nestjs|traefik|kong) [default: express]')
  .option(
    '--services <list>',
    'Polyglot services as name:framework,name:framework [default: typescript-service-1:express,python-service-2:fastapi]'
  )
  .option(
    '--microfrontend',
    'Create microfrontend project with Module Federation setup'
  )
  .option(
    '--remotes <list>',
    'Microfrontend remotes as name[:framework],... [default: remote-1 (react)]; --framework sets the shell [default: react-ts]'
  )
  .option('--type <type>', 'Workspace type (app|package|lib|tool) - monorepo only')
  .option('--port <port>', 'Development server port [default: 5173]')
  .option('--route <route>', 'Route path (for apps) [default: /<name>]')
  .option('--package-manager <pm>', 'Package manager to use (npm, yarn, pnpm)', 'pnpm')
  .option('--dry-run', 'Preview changes without applying them')
  .option('--verbose', 'Show detailed dry-run output')
  .option(
    '--json',
    'Output as JSON (with --dry-run, emits the exact file set with per-file previews; never prompts)'
  )
  .option('-y, --yes', 'Use defaults and skip prompts (non-interactive; auto-enabled when stdin is not a TTY)')
  .option('--force', 'Overwrite files in an existing target directory and continue past compatibility warnings')
  .addHelpText(
    'after',
    `
Non-interactive use:
  Every prompt has a default that is used with --yes, --json, --dry-run, or when
  stdin is not a TTY, so \`create\` never waits on input. Defaults: frontend
  react-ts, backend express (with --fullstack), route /<name>, port 5173.
  A condition that needs a human decision (an incompatible stack, an existing
  target) fails with a non-zero exit instead; pass --force to proceed.

Examples:
  re-shell create web --frontend react-ts            # frontend app at apps/web
  re-shell create api --backend express              # just the API
  re-shell create shop --fullstack --db prisma       # API + frontend
  re-shell create hub --microfrontend --remotes cart,search:vue
  re-shell create platform --polyglot --services users:fastapi,orders:express
  re-shell create ws --template blank                # empty workspace skeleton
  re-shell create web --frontend react-ts --dry-run --json
`
  )
  .action(
    createAsyncCommand(async (name, options) => {
      const jsonMode = Boolean(options.json);
      // --json reserves stdout for the envelope, so it must never prompt.
      const restoreJson = jsonMode ? enableJsonMode() : () => {};
      const spinner = jsonMode ? undefined : createSpinner('Creating Re-Shell project...').start();

      try {
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        const result = await withTimeout(async () => {
          return createProject(name, {
            ...options,
            yes: options.yes || jsonMode,
            isProject: true,
            spinner,
          });
        }, 180000); // 3 minute timeout

        if (jsonMode) {
          if (result.status === 'cancelled') {
            fail('CREATE_ERROR', 'Cancelled before anything was written.');
          } else {
            ok(result.response);
          }
          return;
        }

        if (!spinner) return;
        if (result.status === 'dry-run') {
          spinner.succeed(chalk.green(`Dry run completed for "${name}"`));
        } else if (result.status === 'created') {
          spinner.succeed(chalk.green(`Re-Shell project "${name}" created successfully!`));
        } else {
          spinner.stop();
        }
      } catch (error) {
        if (spinner) spinner.stop();
        if (jsonMode) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (error instanceof CreateError) {
            fail(error.code, message, error.details);
          } else {
            fail(options.dryRun ? 'TEMPLATE_DRY_RUN_ERROR' : 'CREATE_ERROR', message);
          }
          return;
        }
        throw error; // createAsyncCommand prints it and exits non-zero
      } finally {
        restoreJson();
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
  .description('Launch the interactive Terminal User Interface (Ink, default)')
  .option('--project <path>', 'Project path', process.cwd())
  .option('--mode <mode>', 'TUI mode (dashboard|init|manage|config)', 'dashboard')
  .option('--debug', 'Enable debug output')
  .option('--go', 'Legacy: launch the Go-based TUI instead (requires Go on PATH)')
  .action(
    createAsyncCommand(async (options) => {
      // No spinner for TUI - it has its own interface
      processManager.addCleanup(() => {
        // Cleanup will be handled by TUI process
      });
      flushOutput();

      await withTimeout(async () => {
        await launchTUI({
          project: options.project,
          mode: options.mode,
          debug: options.debug,
          go: options.go
        });
      }, 300000); // 5 minute timeout for TUI session
    })
  );

// UI command - local web dashboard
program
  .command('ui')
  .description('Launch the local Re-Shell UI dashboard')
  .option('--ui-path <path>', 'Path to the standalone re-shell-ui repo or dashboard app')
  .option('--ui-root <path>', 'Alias for --ui-path')
  .option('--workspace <path>', 'Workspace path to inspect', process.cwd())
  .option('--port <port>', 'Dashboard port', '3333')
  .option('--host <host>', 'Dashboard host', '127.0.0.1')
  .option('--package-manager <pm>', 'Package manager to run (pnpm, npm, yarn, bun)')
  .option('--dry-run', 'Print the launch plan without starting the dashboard')
  .option('--json', 'Print the launch plan as JSON without starting the dashboard')
  .option('--no-open', 'Do not open the browser after launching')
  .action(
    createAsyncCommand(async (options) => {
      await launchUi(options);
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

// Doctor command - monorepo health check
program
  .command('doctor')
  .description('Run health checks on the current monorepo and optionally auto-fix issues')
  .option('--explain', 'Explain the cause of each failing/warning check and suggest a fix')
  .option('--fix', 'Compose a remediation plan (dry run by default; requires --yes to apply)')
  .option('--yes', 'With --fix, actually apply the allow-listed fix commands')
  .option('--verbose', 'Show detailed suggestions for each check')
  .option('--json', 'Output results as JSON')
  .action(
    createAsyncCommand(async (options) => {
      const spinner = options.json ? undefined : createSpinner('Running health checks...').start();
      if (spinner) {
        processManager.addCleanup(() => spinner.stop());
        flushOutput();
      }

      await withTimeout(async () => {
        await runDoctorCheck({ ...options, spinner });
      }, 120000); // 2 minute timeout

      if (spinner) {
        spinner.stop();
      }
    })
  );

// Analyze command - project analysis (bundle, dependencies, performance, security)
program
  .command('analyze')
  .description('Analyze project bundles, dependencies, performance, and security')
  .option('--workspace <name>', 'Analyze a specific workspace only')
  .option('--type <type>', 'Analysis type (bundle|dependencies|performance|security|all)', 'all')
  .option('--output <file>', 'Save analysis results to a file')
  .option('--verbose', 'Show detailed breakdown')
  .option('--json', 'Output results as JSON')
  .action(
    createAsyncCommand(async (options) => {
      const spinner = options.json ? undefined : createSpinner('Analyzing project...').start();
      if (spinner) {
        processManager.addCleanup(() => spinner.stop());
        flushOutput();
      }

      await withTimeout(async () => {
        await runProjectAnalysis({ ...options, spinner });
      }, 600000); // 10 minute timeout (analysis may build workspaces)

      if (spinner) {
        spinner.stop();
      }
    })
  );

// Completion command - install/print shell completion scripts generated from
// the live command tree (kept here to preserve its position in --help).
registerCompletionGroup(program);

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
registerTemplatesGroup(program);
registerCommandsGroup(program);
registerAiGroup(program);
registerFindGroup(program);
registerAgentsGroup(program);
registerRunGroup(program);
registerCacheGroup(program);
registerDevGroup(program);
registerScorecardGroup(program);
registerReleaseGroup(program);
registerMigrateGroup(program);
registerCatalogGroup(program);
registerFederationGroup(program);
registerApiVerifyGroup(program);
registerFixCiGroup(program);
registerBoundariesGroup(program);
registerEnvGroup(program);
registerUiTestGroup(program);

// ─── Backward-compatibility aliases (hidden from --help) ──────────────────────

registerAliases(program);

// With --json, Commander's own parse failures (missing option/argument, unknown
// option or command) become a USAGE_ERROR envelope instead of empty stdout.
installJsonUsageErrors(program);

// ─── Parse and execute ────────────────────────────────────────────────────────

/**
 * Exit only after stdout/stderr have fully drained.
 *
 * `process.exit()` terminates synchronously and discards anything still buffered
 * in an async pipe. For large `--json` payloads (e.g. `commands list --json`,
 * which exceeds the OS pipe high-water mark of ~64KB) that truncates the output
 * mid-document, so a consumer like the dashboard hub never receives a complete,
 * parseable envelope. Waiting for both streams to flush guarantees the full
 * payload reaches the reader before the process goes away.
 */
function exitAfterFlush(code: number): void {
  let pending = 0;
  let exited = false;

  const done = (): void => {
    pending -= 1;
    if (pending <= 0 && !exited) {
      exited = true;
      process.exit(code);
    }
  };

  for (const stream of [process.stdout, process.stderr]) {
    // `write('')` returns false when the buffer is above the high-water mark;
    // in that case wait for 'drain' before counting the stream as flushed.
    if (!stream.write('')) {
      pending += 1;
      stream.once('drain', done);
    }
  }

  if (pending === 0) {
    process.exit(code);
  }
}

program.parseAsync(process.argv).then(() => {
  if (!processManager.shouldKeepRunning()) {
    const raw = process.exitCode ?? 0;
    const code = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10) || 0;
    exitAfterFlush(code);
  }
}).catch((err) => {
  console.error(err.message || err);
  // Under --json a failure is an envelope on stdout too (and exit code 1), not
  // only a line on stderr.
  if (isJsonModeActive() && getEmittedEnvelopeCount() === 0) {
    failFromError(err);
  }
  exitAfterFlush(1);
});
