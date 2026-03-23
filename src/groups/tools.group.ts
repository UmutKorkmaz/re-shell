import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import * as path from 'path';
import {
  addGitSubmodule, removeGitSubmodule, updateGitSubmodules,
  showSubmoduleStatus, initSubmodules, manageSubmodules,
} from '../commands/submodule';
import { importProject, exportProject, backupProject, restoreProject } from '../commands/migrate';
import { generateCICDConfig, generateDeployConfig } from '../commands/cicd';
import { manageDevMode } from '../commands/dev-mode';

export function registerToolsGroup(program: Command): void {
  const toolsCommand = new Command('tools')
    .description('Development tools, utilities, and environment management');

  // Standalone commands
  toolsCommand
    .command('detect')
    .description('Detect frameworks and analyze project structure for intelligent recommendations')
    .option('--json', 'Output analysis as JSON')
    .action(
      createAsyncCommand(async (options) => {
        await withTimeout(async () => {
          const { showProjectAnalysis, analyzeProject } = await import('../utils/framework-detection');

          if (options.json) {
            const analysis = await analyzeProject();
            console.log(JSON.stringify(analysis, null, 2));
          } else {
            await showProjectAnalysis();
          }
        }, 10000);
      })
    );

  toolsCommand
    .command('dry-run')
    .description('Preview changes without applying them (for testing)')
    .option('--verbose', 'Show detailed file-by-file changes')
    .option('--impact', 'Analyze potential impact of changes')
    .option('--json', 'Output results as JSON')
    .action(
      createAsyncCommand(async (options) => {
        console.log(chalk.cyan.bold('\n🔍 Dry-Run Mode\n'));
        console.log(chalk.gray('This command previews changes without applying them.\n'));
        console.log(chalk.gray('Use with other commands like:'));
        console.log(chalk.gray('  re-shell create test-app --dry-run'));
        console.log(chalk.gray('  re-shell profile create my-profile --dry-run\n'));
        console.log(chalk.cyan('Example:'));
        console.log(chalk.gray('  re-shell create my-app --dry-run --verbose --impact\n'));
      })
    );

  toolsCommand
    .command('di-analyze')
    .description('Analyze services for dependency injection and auto-wiring')
    .option('--json', 'Output dependency graph as JSON')
    .option('--output <file>', 'Write auto-wiring config to file')
    .action(
      createAsyncCommand(async (options) => {
        await withTimeout(async () => {
          const { analyzeServices, generateAutoWiringConfig, showInjectionRecommendations } = await import('../utils/dependency-injection');

          const graph = await analyzeServices();

          if (options.output) {
            await generateAutoWiringConfig(graph, options.output);
          }

          if (!options.json) {
            await showInjectionRecommendations(graph);
          } else {
            const jsonGraph = {
              nodes: Array.from(graph.nodes.entries()).map(([name, service]) => [name, service]),
              edges: Array.from(graph.edges.entries()).map(([service, deps]) => [service, Array.from(deps)]),
              cycles: graph.cycles,
            };
            console.log(JSON.stringify(jsonGraph, null, 2));
          }
        }, 30000);
      })
    );

  toolsCommand
    .command('di-generate')
    .description('Generate dependency injection configuration')
    .option('--output <file>', 'Write auto-wiring config to file')
    .action(
      createAsyncCommand(async (options) => {
        await withTimeout(async () => {
          const { analyzeServices, generateAutoWiringConfig } = await import('../utils/dependency-injection');
          const graph = await analyzeServices();
          await generateAutoWiringConfig(graph, options.output || 'di-config.json');
        }, 30000);
      })
    );

  toolsCommand
    .command('snapshots')
    .description('List available rollback snapshots')
    .action(createAsyncCommand(async () => {
      const { listSnapshots } = await import('../utils/rollback.js');
      await listSnapshots();
    }));

  toolsCommand
    .command('rollback <snapshot-id>')
    .description('Rollback to a specific snapshot (undo failed operation)')
    .option('--keep-backup', 'Keep backup files after rollback')
    .option('--force', 'Skip confirmation prompts')
    .action(createAsyncCommand(async (snapshotId, options) => {
      const { rollbackOperation } = await import('../utils/rollback.js');
      await rollbackOperation(snapshotId, options);
    }));

  toolsCommand
    .command('recover <snapshot-id>')
    .description('Recover state from a specific snapshot')
    .action(createAsyncCommand(async (snapshotId) => {
      const { recoverFromSnapshot } = await import('../utils/rollback.js');
      await recoverFromSnapshot(snapshotId);
    }));

  toolsCommand
    .command('cleanup-snapshots')
    .description('Clean up old rollback snapshots')
    .option('--keep <number>', 'Number of snapshots to keep', '5')
    .action(createAsyncCommand(async (options) => {
      const { cleanupSnapshots } = await import('../utils/rollback.js');
      await cleanupSnapshots(parseInt(options.keep));
    }));

  // Submodule subgroup
  const submoduleCommand = toolsCommand.command('submodule').description('Manage Git submodules');

  submoduleCommand
    .command('add <url>')
    .description('Add a new Git submodule')
    .option('--path <path>', 'Submodule path')
    .option('--branch <branch>', 'Branch to track', 'main')
    .action(
      createAsyncCommand(async (url, options) => {
        const spinner = createSpinner('Adding submodule...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await addGitSubmodule(url, { ...options, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green('Submodule added successfully!'));
      })
    );

  submoduleCommand
    .command('remove <path>')
    .description('Remove a Git submodule')
    .option('--force', 'Force removal without confirmation')
    .action(
      createAsyncCommand(async (submodulePath, options) => {
        const spinner = createSpinner('Removing submodule...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await removeGitSubmodule(submodulePath, { ...options, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green('Submodule removed successfully!'));
      })
    );

  submoduleCommand
    .command('update')
    .description('Update Git submodules')
    .option('--path <path>', 'Update specific submodule')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Updating submodules...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await updateGitSubmodules({ ...options, spinner });
        }, 180000); // 3 minute timeout

        spinner.succeed(chalk.green('Submodules updated successfully!'));
      })
    );

  submoduleCommand
    .command('status')
    .description('Show Git submodule status')
    .action(
      createAsyncCommand(async () => {
        try {
          await withTimeout(async () => {
            await showSubmoduleStatus();
          }, 30000); // 30 second timeout
        } catch (error) {
          const msg = (error as Error).message || String(error);
          if (msg.includes('Not in a Git repository')) {
            console.error(chalk.red('Not in a Git repository. Please run this command from within a Git repository.'));
          } else {
            console.error(chalk.red('Error getting submodule status: ' + msg));
          }
          process.exitCode = 1;
        }
      })
    );

  submoduleCommand
    .command('init')
    .description('Initialize Git submodules')
    .action(
      createAsyncCommand(async () => {
        const spinner = createSpinner('Initializing submodules...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await initSubmodules();
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green('Submodules initialized successfully!'));
      })
    );

  submoduleCommand
    .command('manage')
    .description('Interactive submodule management')
    .action(
      createAsyncCommand(async () => {
        await manageSubmodules();
      })
    );

  // Migrate subgroup
  const migrateCommand = toolsCommand.command('migrate').description('Import/export projects and manage migrations');

  migrateCommand
    .command('import <source>')
    .description('Import existing project into Re-Shell monorepo')
    .option('--dry-run', 'Show what would be imported without making changes')
    .option('--verbose', 'Show detailed information')
    .option('--backup', 'Create backup before import')
    .option('--force', 'Overwrite existing files')
    .action(
      createAsyncCommand(async (source, options) => {
        const spinner = createSpinner('Importing project...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await importProject(source, { ...options, spinner });
        }, 600000); // 10 minute timeout

        spinner.succeed(chalk.green('Project imported successfully!'));
      })
    );

  migrateCommand
    .command('export <target>')
    .description('Export Re-Shell project to external location')
    .option('--force', 'Overwrite target directory if it exists')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (target, options) => {
        const spinner = createSpinner('Exporting project...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await exportProject(target, { ...options, spinner });
        }, 300000); // 5 minute timeout

        spinner.succeed(chalk.green('Project exported successfully!'));
      })
    );

  migrateCommand
    .command('backup')
    .description('Create backup of current project')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Creating backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await backupProject({ ...options, spinner });
        }, 300000); // 5 minute timeout

        spinner.succeed(chalk.green('Backup created successfully!'));
      })
    );

  migrateCommand
    .command('restore <backup> <target>')
    .description('Restore project from backup')
    .option('--force', 'Overwrite target directory if it exists')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (backup, target, options) => {
        const spinner = createSpinner('Restoring from backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await restoreProject(backup, target, { ...options, spinner });
        }, 300000); // 5 minute timeout

        spinner.succeed(chalk.green('Project restored successfully!'));
      })
    );

  // CICD subgroup
  const cicdCommand = toolsCommand.command('cicd').description('Generate CI/CD configurations and deployment scripts');

  cicdCommand
    .command('generate')
    .description('Generate CI/CD configuration files')
    .option('--provider <provider>', 'CI/CD provider (github, gitlab, jenkins, circleci, azure)', 'github')
    .option('--template <template>', 'Configuration template (basic, advanced, custom)', 'basic')
    .option('--force', 'Overwrite existing configuration')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Generating CI/CD configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateCICDConfig({ ...options, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green('CI/CD configuration generated!'));
      })
    );

  cicdCommand
    .command('deploy <environment>')
    .description('Generate deployment configuration for environment')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (environment, options) => {
        const spinner = createSpinner(`Generating deployment config for ${environment}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateDeployConfig(environment, { ...options, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green(`Deployment configuration for ${environment} generated!`));
      })
    );

  // Dev subgroup
  const devCommand = toolsCommand.command('dev').description('Development mode with configuration hot-reloading');

  devCommand
    .command('start')
    .description('Start development mode with hot-reloading')
    .option('--verbose', 'Enable detailed change notifications')
    .option('--debounce <ms>', 'Change detection delay in milliseconds', '500')
    .option('--no-validation', 'Skip configuration validation on changes')
    .option('--no-backup', 'Disable automatic backups before changes')
    .option('--no-restore', 'Disable error recovery from backups')
    .option('--exclude-workspaces', 'Skip workspace configuration watching')
    .option('-p, --profile <profile>', 'Use a specific profile for development')
    .option('-s, --services <services...>', 'Specific services to run (comma-separated)')
    .option('--select-services', 'Interactive service selection')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Starting development mode...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageDevMode({
            ...options,
            start: true,
            noValidation: options.validation === false,
            noBackup: options.backup === false,
            noRestore: options.restore === false,
            spinner,
            services: options.services ? options.services.flat() : undefined,
          });
        }, 30000); // 30 second timeout

        // Don't auto-succeed for dev mode as it stays running
        spinner.stop();
      })
    );

  devCommand
    .command('stop')
    .description('Stop development mode')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Stopping development mode...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageDevMode({ ...options, stop: true, spinner });
        }, 10000); // 10 second timeout

        spinner.succeed(chalk.green('Development mode stopped!'));
      })
    );

  devCommand
    .command('restart')
    .description('Restart development mode')
    .option('--verbose', 'Enable detailed change notifications')
    .option('--debounce <ms>', 'Change detection delay in milliseconds', '500')
    .option('--no-validation', 'Skip configuration validation on changes')
    .option('--no-backup', 'Disable automatic backups before changes')
    .option('--no-restore', 'Disable error recovery from backups')
    .option('--exclude-workspaces', 'Skip workspace configuration watching')
    .option('-p, --profile <profile>', 'Use a specific profile for development')
    .option('-s, --services <services...>', 'Specific services to run (comma-separated)')
    .option('--select-services', 'Interactive service selection')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Restarting development mode...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageDevMode({
            ...options,
            restart: true,
            noValidation: options.validation === false,
            noBackup: options.backup === false,
            noRestore: options.restore === false,
            spinner,
            services: options.services ? options.services.flat() : undefined,
          });
        }, 30000); // 30 second timeout

        spinner.stop();
      })
    );

  devCommand
    .command('status')
    .description('Show development mode status')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking development mode status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageDevMode({ ...options, status: true, spinner });
        }, 10000); // 10 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Status checked!'));
        } else {
          spinner.stop();
        }
      })
    );

  devCommand
    .command('interactive')
    .description('Interactive development mode management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading development mode interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageDevMode({ ...options, interactive: true, spinner });
        }, 60000); // 1 minute timeout

        spinner.stop();
      })
    );

  // Hotreload subgroup
  const hotreloadCommand = toolsCommand.command('hotreload').alias('hr').description('Intelligent hot-reload for all frameworks with file watching');

  hotreloadCommand
    .command('start [path]')
    .description('Start hot-reload with framework auto-detection')
    .option('-f, --framework <framework>', 'Framework (express, nestjs, fastapi, django, etc.)')
    .option('-l, --language <language>', 'Language filter (typescript, python, go, rust, etc.)')
    .option('-w, --watch <patterns...>', 'Additional watch patterns')
    .option('-x, --exclude <patterns...>', 'Exclude patterns')
    .option('-d, --debounce <ms>', 'Debounce delay in milliseconds', '300')
    .option('-p, --port <port>', 'Override default port')
    .option('--verbose', 'Show detailed file changes')
    .option('--detect-only', 'Only detect framework without starting')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { createHotReload, detectProjectFramework, listSupportedFrameworks, getFrameworkPattern } = await import('../utils/hot-reload');
        const { createSpinner } = await import('../utils/spinner');

        const pathToWatch = projectPath || process.cwd();
        const spinner = createSpinner('Detecting framework...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          let framework = options.framework;
          let frameworkPattern = framework ? getFrameworkPattern(framework) : undefined;

          // Auto-detect if not specified
          if (!frameworkPattern) {
            const detected = await detectProjectFramework(pathToWatch);
            if (!detected) {
              spinner.fail(chalk.red('Could not detect framework'));
              console.log(chalk.yellow('\nSupported frameworks:'));
              const frameworks = listSupportedFrameworks();
              for (const f of frameworks) {
                console.log(`  • ${chalk.blue(f.id.padEnd(15))} ${f.language} (${f.reloadStrategy})`);
              }
              console.log(chalk.gray('\nSpecify with: --framework <name>'));
              return;
            }
            framework = detected.framework;
            frameworkPattern = detected.config;
            spinner.succeed(chalk.green(`Detected: ${detected.framework} (${detected.language})`));
          } else {
            spinner.succeed(chalk.green(`Using framework: ${framework}`));
          }

          if (options.detectOnly) {
            console.log(chalk.cyan('\nFramework Details:'));
            console.log(`  ID: ${chalk.blue(frameworkPattern.framework)}`);
            console.log(`  Language: ${chalk.blue(frameworkPattern.language)}`);
            console.log(`  Reload Strategy: ${chalk.blue(frameworkPattern.reloadStrategy)}`);
            console.log(`  Default Port: ${chalk.blue(String(frameworkPattern.port))}`);
            console.log(`  Watch Paths: ${chalk.blue(frameworkPattern.watchPaths.join(', '))}`);
            console.log(`  Dev Command: ${chalk.blue(frameworkPattern.devCommand)}`);
            return;
          }

          spinner.setText('Starting hot-reload...');
          spinner.start();

          const manager = await createHotReload({
            projectPath: pathToWatch,
            framework: options.framework,
            watchPaths: options.watch,
            excludePatterns: options.exclude,
            debounceMs: parseInt(options.debounce),
            verbose: options.verbose,
            onReload: (type) => {
              if (options.verbose) {
                console.log(chalk.green(`\n🔄 Reload triggered: ${type}`));
              }
            },
            onError: (error) => {
              console.error(chalk.red(`\n❌ Reload error: ${error.message}`));
            },
          });

          spinner.stop();

          console.log(chalk.green('\n🔥 Hot-reload started!'));
          console.log(chalk.gray('═'.repeat(50)));
          console.log(`Framework: ${chalk.blue(frameworkPattern.framework)}`);
          console.log(`Strategy: ${chalk.blue(frameworkPattern.reloadStrategy)}`);
          console.log(`Watch paths: ${chalk.blue(frameworkPattern.watchPaths.join(', '))}`);
          console.log(chalk.gray('\nWatching for file changes... (Press Ctrl+C to stop)'));

          // Set up event handlers
          manager.on('ready', () => {
            if (options.verbose) {
              console.log(chalk.green('\n👀 Watcher ready'));
            }
          });

          manager.on('reload', ({ type, filePath, strategy }) => {
            if (strategy === 'restart' || strategy === 'custom') {
              console.log(chalk.yellow(`\n🔄 Restarting dev server (${type}: ${filePath})`));
            }
          });

          // Handle graceful shutdown
          const shutdown = async () => {
            console.log(chalk.yellow('\n\n⏹️  Stopping hot-reload...'));
            await manager.stop();
            process.exit(0);
          };

          process.on('SIGINT', shutdown);
          process.on('SIGTERM', shutdown);

          // Keep process alive
          await new Promise(() => { /* keep alive */ });

        } catch (error) {
          spinner.fail(chalk.red('Failed to start hot-reload'));
          throw error;
        }
      })
    );

  hotreloadCommand
    .command('detect [path]')
    .description('Detect the framework in use')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { detectProjectFramework, listSupportedFrameworks } = await import('../utils/hot-reload');

        const pathToCheck = projectPath || process.cwd();

        const detected = await detectProjectFramework(pathToCheck);

        if (options.json) {
          console.log(JSON.stringify(detected, null, 2));
          return;
        }

        if (!detected) {
          console.log(chalk.yellow('⚠️  Could not detect framework'));
          console.log(chalk.gray('\nSupported frameworks:'));
          const frameworks = listSupportedFrameworks();
          for (const f of frameworks) {
            console.log(`  • ${chalk.blue(f.id.padEnd(15))} ${f.language}`);
          }
          return;
        }

        console.log(chalk.green('✅ Framework detected!'));
        console.log(chalk.gray('═'.repeat(40)));
        console.log(`Framework: ${chalk.blue(detected.framework)}`);
        console.log(`Language: ${chalk.blue(detected.language)}`);
        console.log(`Confidence: ${chalk.blue(detected.confidence + '%')}`);
        console.log(`Strategy: ${chalk.blue(detected.config.reloadStrategy)}`);
        console.log(`Port: ${chalk.blue(String(detected.config.port))}`);
      })
    );

  hotreloadCommand
    .command('list')
    .description('List all supported frameworks')
    .option('--language <language>', 'Filter by language')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const { listSupportedFrameworks } = await import('../utils/hot-reload');

        const frameworks = listSupportedFrameworks();
        const filtered = options.language
          ? frameworks.filter(f => f.language === options.language)
          : frameworks;

        if (options.json) {
          console.log(JSON.stringify(filtered, null, 2));
          return;
        }

        console.log(chalk.cyan('\n🔥 Supported Hot-Reload Frameworks'));
        console.log(chalk.gray('═'.repeat(70)));

        // Group by language
        const byLanguage: Record<string, typeof frameworks> = {};
        for (const f of filtered) {
          if (!byLanguage[f.language]) {
            byLanguage[f.language] = [];
          }
          byLanguage[f.language].push(f);
        }

        for (const [language, langFrameworks] of Object.entries(byLanguage).sort()) {
          console.log(chalk.cyan(`\n${language.charAt(0).toUpperCase() + language.slice(1)}:`));
          for (const f of langFrameworks) {
            const strategyIcon = f.reloadStrategy === 'hmr' ? '⚡' : f.reloadStrategy === 'restart' ? '🔄' : '🔧';
            console.log(`  ${strategyIcon} ${chalk.blue(f.id.padEnd(20))} port: ${String(f.port || '-').padEnd(5)} ${chalk.gray(f.reloadStrategy)}`);
          }
        }

        console.log(chalk.gray(`\n${'═'.repeat(70)}`));
        console.log(chalk.gray('Legend: ⚡ HMR  🔄 Restart  🔧 Custom'));
        console.log(chalk.gray('\nUsage: re-shell hotreload start [--framework <name>]'));
      })
    );

  // Devenv subgroup
  const devenvCommand = toolsCommand.command('devenv').alias('ide').description('Setup integrated development environment with container port forwarding');

  devenvCommand
    .command('setup [path]')
    .description('Setup IDE configuration and port forwarding')
    .option('-i, --ide <ide>', 'IDE type (vscode, jetbrains, vim, emacs)', 'vscode')
    .option('-r, --runtime <runtime>', 'Container runtime (docker, podman)')
    .option('-p, --ports <ports...>', 'Port mappings (local:container:service)')
    .option('-c, --containers <containers...>', 'Container names to forward')
    .option('--no-port-forwarding', 'Disable automatic port forwarding')
    .option('--no-service-discovery', 'Disable automatic service discovery')
    .option('--dry-run', 'Preview without writing files')
    .action(
      createAsyncCommand(async (projectPath, options) => {
        const { createDevEnv, detectContainerRuntime, getServicePorts } = await import('../utils/dev-env-setup');
        const { createSpinner } = await import('../utils/spinner');

        const pathToSetup = projectPath || process.cwd();
        const projectName = path.basename(pathToSetup);
        const spinner = createSpinner('Detecting container runtime...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          // Detect container runtime
          const runtime = options.runtime || await detectContainerRuntime();
          if (!runtime) {
            spinner.fail(chalk.red('No container runtime found (Docker or Podman required)'));
            return;
          }
          spinner.succeed(chalk.green(`Detected runtime: ${runtime}`));

          spinner.setText('Setting up development environment...');
          spinner.start();

          // Parse port mappings
          const ports: Array<{ localPort: number; containerPort: number; service: string; protocol: 'tcp' | 'udp' }> = [];
          const servicePorts = getServicePorts();

          if (options.ports) {
            for (const portSpec of options.ports) {
              const parts = portSpec.split(':');
              if (parts.length >= 3) {
                ports.push({
                  localPort: parseInt(parts[0]),
                  containerPort: parseInt(parts[1]),
                  service: parts[2],
                  protocol: 'tcp',
                });
              }
            }
          }

          // Default ports if none specified
          if (ports.length === 0) {
            ports.push(
              { localPort: 3000, containerPort: 3000, service: 'web', protocol: 'tcp' },
              { localPort: 8000, containerPort: 8000, service: 'api', protocol: 'tcp' },
            );
          }

          const config = {
            projectPath: pathToSetup,
            projectName,
            ports,
            containers: options.containers || [],
            ide: options.ide as 'vscode' | 'jetbrains' | 'vim' | 'emacs' | 'generic',
            containerRuntime: runtime as 'docker' | 'podman',
            enablePortForwarding: options.portForwarding !== false,
            enableServiceDiscovery: options.serviceDiscovery !== false,
            autoStartContainers: false,
          };

          if (options.dryRun) {
            spinner.stop();
            console.log(chalk.cyan('\n📋 Dry-run configuration:'));
            console.log(`  Project: ${chalk.blue(projectName)}`);
            console.log(`  Path: ${chalk.blue(pathToSetup)}`);
            console.log(`  IDE: ${chalk.blue(config.ide)}`);
            console.log(`  Runtime: ${chalk.blue(runtime)}`);
            console.log(`  Port mappings:`);
            for (const p of ports) {
              console.log(`    ${p.localPort}:${p.containerPort} -> ${p.service}`);
            }
            return;
          }

          const manager = await createDevEnv(config);

          // Setup IDE configuration
          const ideConfig = await manager.setupIDE(config.ide);

          spinner.stop();

          console.log(chalk.green('\n🚀 Development environment setup complete!'));
          console.log(chalk.gray('═'.repeat(60)));

          console.log(`\n${chalk.cyan('IDE Configuration:')} ${chalk.blue(config.ide)}`);
          if (ideConfig) {
            console.log(`  ${chalk.gray('Type')}: ${chalk.blue(ideConfig.type)}`);
            console.log(`  ${chalk.gray('Port Forwarding')}: ${ideConfig.portForwardingEnabled ? '✅' : '❌'}`);
            console.log(`  ${chalk.gray('Remote Development')}: ${ideConfig.remoteDevelopment ? '✅' : '❌'}`);
          }

          console.log(`\n${chalk.cyan('Port Mappings:')}`);
          for (const port of ports) {
            console.log(`  ${chalk.blue('localhost:' + port.localPort)} → ${port.service}:${port.containerPort}`);
          }

          console.log(chalk.gray('\nNext steps:'));
          console.log(`  1. Open ${chalk.blue(projectName)} in ${config.ide}`);
          if (config.ide === 'vscode') {
            console.log(`  2. Reopen in ${chalk.blue('Dev Container')} if using containers`);
          }
          console.log(`  3. Services will be available at http://localhost:<port>`);

        } catch (error) {
          spinner.fail(chalk.red('Failed to setup development environment'));
          throw error;
        }
      })
    );

  devenvCommand
    .command('ports [action] [args...]')
    .description('Manage port forwarding (list, forward, unforward)')
    .action(
      createAsyncCommand(async (action, args) => {
        const { DevEnvManager, getServicePorts, detectContainerRuntime } = await import('../utils/dev-env-setup');
        const { createSpinner } = await import('../utils/spinner');

        const projectPath = process.cwd();
        const projectName = path.basename(projectPath);

        if (!action || action === 'list') {
          // List active port forwards
          const servicePorts = getServicePorts();
          console.log(chalk.cyan('\n📋 Common Service Ports:'));
          console.log(chalk.gray('─'.repeat(40)));
          for (const [service, port] of Object.entries(servicePorts)) {
            console.log(`  ${chalk.blue(service.padEnd(15))} port: ${port}`);
          }
          return;
        }

        if (action === 'forward') {
          if (args.length < 2) {
            console.log(chalk.yellow('Usage: re-shell devenv ports forward <container> <port> [local-port]'));
            return;
          }

          const [container, containerPort, localPort] = args as string[];
          const spinner = createSpinner('Setting up port forwarding...').start();
          processManager.addCleanup(() => spinner.stop());
          flushOutput();

          try {
            const runtime = await detectContainerRuntime();
            if (!runtime) {
              spinner.fail(chalk.red('No container runtime found'));
              return;
            }

            const manager = new DevEnvManager({
              projectPath,
              projectName,
              ports: [],
              containers: [],
              containerRuntime: runtime,
              enablePortForwarding: true,
              enableServiceDiscovery: false,
              autoStartContainers: false,
            });

            const status = await manager.setupPortForwarding(
              container,
              parseInt(containerPort),
              localPort ? parseInt(localPort) : undefined
            );

            spinner.stop();

            if (status.active) {
              console.log(chalk.green('\n✅ Port forwarding active!'));
              console.log(`  Container: ${chalk.blue(container)}`);
              console.log(`  ${containerPort} → ${status.localPort}`);
              console.log(`  URL: ${chalk.blue(status.url || `http://localhost:${status.localPort}`)}`);
            } else {
              console.log(chalk.yellow('\n⚠️  Port forwarding setup failed'));
            }
          } catch (error) {
            spinner.fail(chalk.red('Failed to setup port forwarding'));
            throw error;
          }
          return;
        }

        if (action === 'unforward') {
          if (args.length < 2) {
            console.log(chalk.yellow('Usage: re-shell devenv ports unforward <container> <port>'));
            return;
          }

          const [container, port] = args as string[];
          const spinner = createSpinner('Stopping port forwarding...').start();
          processManager.addCleanup(() => spinner.stop());
          flushOutput();

          try {
            const runtime = await detectContainerRuntime();
            if (!runtime) {
              spinner.fail(chalk.red('No container runtime found'));
              return;
            }

            const manager = new DevEnvManager({
              projectPath,
              projectName,
              ports: [],
              containers: [],
              containerRuntime: runtime,
              enablePortForwarding: true,
              enableServiceDiscovery: false,
              autoStartContainers: false,
            });

            await manager.stopPortForwarding(container, parseInt(port));

            spinner.succeed(chalk.green('Port forwarding stopped'));
            console.log(`  ${container}:${port}`);
          } catch (error) {
            spinner.fail(chalk.red('Failed to stop port forwarding'));
            throw error;
          }
          return;
        }

        console.log(chalk.yellow(`Unknown action: ${action}`));
        console.log(chalk.gray('Available actions: list, forward, unforward'));
      })
    );

  devenvCommand
    .command('detect')
    .description('Detect containers and services')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const { DevEnvManager, detectContainerRuntime } = await import('../utils/dev-env-setup');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Detecting environment...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const runtime = await detectContainerRuntime();
          if (!runtime) {
            spinner.fail(chalk.red('No container runtime found'));
            return;
          }

          const manager = new DevEnvManager({
            projectPath: process.cwd(),
            projectName: path.basename(process.cwd()),
            ports: [],
            containers: [],
            containerRuntime: runtime,
            enablePortForwarding: false,
            enableServiceDiscovery: true,
            autoStartContainers: false,
          });

          // Prevent ERR_UNHANDLED_ERROR: DevEnvManager extends EventEmitter and emits
          // 'error' events when Docker commands fail. Without a listener this crashes.
          manager.on('error', () => { /* prevent ERR_UNHANDLED_ERROR crash */ }); // eslint-disable-line @typescript-eslint/no-empty-function

          let containers;
          try {
            containers = await manager.detectContainers();
          } catch {
            spinner.fail(chalk.red('Docker is not available. Please start Docker Desktop and try again.'));
            return;
          }

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(containers, null, 2));
            return;
          }

          console.log(chalk.cyan('\n🔍 Detected Containers and Services'));
          console.log(chalk.gray('═'.repeat(60)));

          if (containers.length === 0) {
            console.log(chalk.yellow('No containers found'));
            return;
          }

          for (const container of containers) {
            const statusIcon = container.status === 'running' ? '🟢' : container.status === 'stopped' ? '⏹️' : '⚠️';
            console.log(`\n${statusIcon} ${chalk.blue(container.name)}`);
            console.log(`  Image: ${chalk.gray(container.image)}`);
            console.log(`  Status: ${chalk.gray(container.status)}`);
            if (container.ports.length > 0) {
              console.log(`  Ports:`);
              for (const port of container.ports) {
                const label = port.host ? `${port.host} → ` : '';
                console.log(`    ${chalk.blue(label + port.container)}/${port.protocol}`);
              }
            }
          }

          console.log(chalk.gray('\n═'.repeat(60)));
          console.log(chalk.gray(`Runtime: ${runtime} | Total: ${containers.length} containers`));

        } catch (error) {
          spinner.stop();
          const msg = (error as Error).message || String(error);
          if (msg.includes('connect') || msg.includes('docker') || msg.includes('ENOENT') || msg.includes('ECONNREFUSED')) {
            console.error(chalk.yellow('Docker is not available. Please ensure Docker is running.'));
          } else {
            console.error(chalk.red('Detection failed: ' + msg));
          }
          process.exitCode = 0;
        }
      })
    );

  // Debug subgroup
  const debugCommand = toolsCommand.command('debug').description('Generate debugging configurations for development environments');

  debugCommand
    .command('generate')
    .description('Generate debug configurations for your project')
    .option('--framework <framework>', 'Backend framework (express, nestjs, fastapi, django, etc.)')
    .option('--language <language>', 'Programming language (typescript, python, go, rust, etc.)')
    .option('--type <type>', 'Project type (backend, frontend, fullstack)', 'backend')
    .option('--entry <path>', 'Entry point file path')
    .option('--port <port>', 'Development server port')
    .option('--force', 'Overwrite existing configuration files')
    .option('--dry-run', 'Preview without writing files')
    .action(
      createAsyncCommand(async (options) => {
        const { writeDebugConfigs, displayDebugConfigInfo } = await import('../utils/debugging');

        const projectPath = process.cwd();
        const name = path.basename(projectPath);

        const project = {
          name,
          type: options.type as 'backend' | 'frontend' | 'fullstack',
          framework: options.framework || 'express',
          language: options.language || 'typescript',
          entryPoint: options.entry,
          port: options.port ? parseInt(options.port) : undefined,
        };

        console.log(chalk.cyan(`\n🐛 Generating debug configurations for ${name}...\n`));

        displayDebugConfigInfo(project);

        if (!options.dryRun) {
          await writeDebugConfigs(projectPath, project, {
            force: options.force,
            verbose: true,
          });

          console.log(chalk.green('\n✅ Debug configurations generated!'));
          console.log(chalk.gray('\nNext steps:'));
          console.log(chalk.gray('  1. Open your project in VS Code'));
          console.log(chalk.gray('  2. Press F5 to start debugging'));
          console.log(chalk.gray('  3. Select a configuration from the dropdown'));
        } else {
          console.log(chalk.yellow('\nDry run - no files written.'));
        }
      })
    );

  debugCommand
    .command('list <language>')
    .description('List available debugging configurations for a language')
    .action(
      createAsyncCommand(async (language, options) => {
        const { displayDebugConfigInfo } = await import('../utils/debugging');

        const project = {
          name: 'example-app',
          type: 'backend' as const,
          framework: language === 'python' ? 'fastapi' : language === 'go' ? 'gin' : 'express',
          language,
          entryPoint: language === 'python' ? 'src/main.py' : 'src/index.js',
          port: 3000,
        };

        displayDebugConfigInfo(project);
      })
    );

  program.addCommand(toolsCommand);
}
