import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import { buildAll, generateDeploymentConfig, deployServices, listServices } from '../commands/polyglot';

export function registerServiceGroup(program: Command): void {
  const serviceCommand = new Command('service')
    .description('Manage polyglot services and development service orchestration');

  // Polyglot subgroup
  const polyglotCommand = serviceCommand.command('polyglot').description('Build and deploy polyglot full-stack applications');

  polyglotCommand
    .command('build-all')
    .description('Build all services in the workspace (supports Node.js, Python, Go, Rust, Java, .NET, PHP, Ruby)')
    .option('--production', 'Build for production environment')
    .option('--parallel', 'Build services in parallel', 'true')
    .option('--analyze', 'Analyze bundle size')
    .option('--type <type...>', 'Filter by service type (frontend, backend, fullstack, package, lib, tool)')
    .option('--language <language...>', 'Filter by language (typescript, python, go, rust, java, csharp, php, ruby)')
    .option('--name <name...>', 'Filter by service name')
    .option('--verbose', 'Show detailed build output')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Building all services...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await buildAll({ ...options, spinner });
        }, 600000); // 10 minute timeout

        spinner.succeed(chalk.green('All services built successfully!'));
      })
    );

  polyglotCommand
    .command('list')
    .description('List all services in the workspace')
    .option('--json', 'Output as JSON')
    .option('--type <type>', 'Filter by service type')
    .option('--language <language>', 'Filter by language')
    .action(
      createAsyncCommand(async (options) => {
        await withTimeout(async () => {
          await listServices(options);
        }, 30000); // 30 second timeout
      })
    );

  polyglotCommand
    .command('generate-deployment <target> <environment>')
    .description('Generate deployment configuration for all services')
    .option('--type <type...>', 'Filter by service type')
    .option('--language <language...>', 'Filter by language')
    .option('--name <name...>', 'Filter by service name')
    .option('--region <region>', 'Deployment region (e.g., us-east-1)')
    .option('--domain <domain>', 'Custom domain name')
    .option('--env <path>', 'Path to environment variables file')
    .option('--resources <json>', 'Resource limits as JSON (e.g., \'{"cpu":"1","memory":"512M"}\')')
    .option('--scaling <json>', 'Scaling configuration as JSON')
    .option('--verbose', 'Show detailed output')
    .action(
      createAsyncCommand(async (target, environment, options) => {
        const spinner = createSpinner(`Generating deployment config for ${target}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateDeploymentConfig(target, environment, { ...options, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green(`Deployment configuration generated for ${target} (${environment})!`));
      })
    );

  polyglotCommand
    .command('deploy <target> <environment>')
    .description('Deploy all services to the specified target')
    .option('--type <type...>', 'Filter by service type')
    .option('--language <language...>', 'Filter by language')
    .option('--name <name...>', 'Filter by service name')
    .option('--skip-build', 'Skip building before deployment')
    .option('--dry-run', 'Simulate deployment without actually deploying')
    .option('--verbose', 'Show detailed output')
    .action(
      createAsyncCommand(async (target, environment, options) => {
        const spinner = createSpinner(`Deploying to ${target} (${environment})...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await deployServices(target, environment, { ...options, spinner });
        }, 600000); // 10 minute timeout

        spinner.succeed(chalk.green(`Services deployed to ${target} (${environment})!`));
      })
    );

  // Services run subgroup
  const runCommand = serviceCommand.command('run').alias('svc').description('Manage development services');

  runCommand
    .command('up')
    .description('Start services with intelligent dependency resolution')
    .option('-d, --detached', 'Run services in background', true)
    .option('--build', 'Build images before starting')
    .option('--force-recreate', 'Recreate containers even if configuration unchanged')
    .option('--no-deps', 'Do not start dependent services')
    .option('--scale <service=count...>', 'Scale services (e.g., web=3,worker=2)')
    .option('--timeout <ms>', 'Startup timeout in milliseconds', '120000')
    .option('--verbose', 'Show detailed output')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Starting services...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        const { servicesUp } = await import('../commands/services');

        await withTimeout(async () => {
          const scale: Record<string, number> = {};
          if (options.scale) {
            for (const s of options.scale) {
              const [service, count] = s.split('=');
              scale[service] = parseInt(count);
            }
          }

          await servicesUp(process.cwd(), {
            detached: options.detached,
            build: options.build,
            forceRecreate: options.forceRecreate,
            noDeps: options.deps === false,
            scale,
            timeout: parseInt(options.timeout),
            verbose: options.verbose,
            spinner,
          });
        }, parseInt(options.timeout) + 10000);

        spinner.stop();
      })
    );

  runCommand
    .command('down')
    .description('Stop and remove services with graceful shutdown')
    .option('-v, --volumes', 'Remove volumes as well')
    .option('--remove-orphans', 'Remove containers for services not in compose file')
    .option('--timeout <ms>', 'Shutdown timeout in milliseconds', '60000')
    .option('--verbose', 'Show detailed output')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Stopping services...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        const { servicesDown } = await import('../commands/services');

        await withTimeout(async () => {
          await servicesDown(process.cwd(), {
            volumes: options.volumes,
            removeOrphans: options.removeOrphans,
            timeout: parseInt(options.timeout),
            verbose: options.verbose,
            spinner,
          });
        }, parseInt(options.timeout) + 10000);

        spinner.stop();
      })
    );

  runCommand
    .command('health')
    .description('Check service health with comprehensive monitoring')
    .option('-w, --watch', 'Watch health status continuously')
    .option('--interval <ms>', 'Watch interval in milliseconds', '5000')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const { servicesHealth } = await import('../commands/services');

        await servicesHealth(process.cwd(), {
          watch: options.watch,
          interval: parseInt(options.interval),
          json: options.json,
          verbose: options.verbose,
        });
      })
    );

  runCommand
    .command('logs [service]')
    .description('View service logs with filtering and following')
    .option('-f, --follow', 'Follow log output')
    .option('--tail <lines>', 'Number of lines to show', '100')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (service, options) => {
        const { servicesLogs } = await import('../commands/services');

        await servicesLogs(process.cwd(), service, {
          follow: options.follow,
          tail: parseInt(options.tail),
          verbose: options.verbose,
        });
      })
    );

  runCommand
    .command('restart <service>')
    .description('Restart service with zero-downtime if possible')
    .option('--timeout <ms>', 'Restart timeout in milliseconds', '60000')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (service, options) => {
        const spinner = createSpinner(`Restarting ${service}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        const { servicesRestart } = await import('../commands/services');

        await withTimeout(async () => {
          await servicesRestart(process.cwd(), service, {
            timeout: parseInt(options.timeout),
            verbose: options.verbose,
            spinner,
          });
        }, parseInt(options.timeout) + 10000);

        spinner.stop();
      })
    );

  runCommand
    .command('scale <service> <replicas>')
    .description('Scale service to specified number of instances')
    .option('--timeout <ms>', 'Scale timeout in milliseconds', '60000')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (service, replicas, options) => {
        const spinner = createSpinner(`Scaling ${service}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        const { servicesScale } = await import('../commands/services');

        await withTimeout(async () => {
          await servicesScale(process.cwd(), service, parseInt(replicas), {
            timeout: parseInt(options.timeout),
            verbose: options.verbose,
            spinner,
          });
        }, parseInt(options.timeout) + 10000);

        spinner.stop();
      })
    );

  runCommand
    .command('exec <service> <command...>')
    .description('Execute command in service container')
    .option('-T, --no-tty', 'Disable pseudo-TTY allocation')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (service, command, options) => {
        const { servicesExec } = await import('../commands/services');

        await servicesExec(process.cwd(), service, command, {
          interactive: options.tty !== false,
          verbose: options.verbose,
        });
      })
    );

  runCommand
    .command('inspect <service>')
    .description('Inspect service with detailed metrics and dependency information')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (service, options) => {
        const { servicesInspect } = await import('../commands/services');

        await servicesInspect(process.cwd(), service, {
          json: options.json,
          verbose: options.verbose,
        });
      })
    );

  runCommand
    .command('migrate <service> <target-framework>')
    .description('Migrate service to a different framework/language')
    .option('--source <framework>', 'Source framework (auto-detected if not specified)')
    .option('--dry-run', 'Preview migration without making changes')
    .option('--no-backup', 'Skip creating backup before migration')
    .option('--generate-tests', 'Generate tests for target framework')
    .option('--list-targets', 'List available migration targets')
    .action(
      createAsyncCommand(async (service, targetFramework, options) => {
        const { servicesMigrate, listMigrationTargets } = await import('../commands/services');

        if (options.listTargets) {
          await listMigrationTargets(options.source);
          return;
        }

        const spinner = createSpinner('Planning migration...').start();
        processManager.addCleanup(() => spinner.stop());

        await servicesMigrate(process.cwd(), service, {
          sourceFramework: options.source || 'express',
          targetFramework,
          dryRun: options.dryRun,
          backup: options.backup !== false,
          generateTests: options.generateTests,
          spinner,
        });

        spinner.stop();
      })
    );

  runCommand
    .command('optimize <service>')
    .description('Analyze and optimize service with performance recommendations')
    .option('--framework <framework>', 'Framework to analyze (auto-detected if not specified)')
    .option('--apply', 'Apply recommended optimizations')
    .option('--dry-run', 'Preview optimizations without making changes (default)')
    .option('--list-all', 'List all available optimization recommendations')
    .action(
      createAsyncCommand(async (service, options) => {
        const { servicesOptimize, listOptimizationRecommendations } = await import('../commands/services');

        if (options.listAll) {
          await listOptimizationRecommendations(options.framework);
          return;
        }

        const spinner = createSpinner('Analyzing service...').start();
        processManager.addCleanup(() => spinner.stop());

        await servicesOptimize(process.cwd(), service, {
          framework: options.framework,
          apply: options.apply,
          dryRun: !options.apply,
          spinner,
        });

        spinner.stop();
      })
    );

  program.addCommand(serviceCommand);
}
