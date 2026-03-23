import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import { listWorkspaces, updateWorkspaces, generateWorkspaceGraph, initWorkspace, validateWorkspaceConfig, checkWorkspaceHealth, migrateWorkspace, optimizeWorkspace, manageWorkspaceTemplates } from '../commands/workspace';
import { importFromMonorepo } from '../commands/import-monorepo';
import { manageWorkspaceDefinition } from '../commands/workspace-definition';
import { manageWorkspaceGraph } from '../commands/workspace-graph';
import { manageWorkspaceHealth } from '../commands/workspace-health';
import { manageWorkspaceState } from '../commands/workspace-state';
import { manageWorkspaceTemplate } from '../commands/workspace-template';
import { manageWorkspaceBackup } from '../commands/workspace-backup';
import { manageWorkspaceMigration } from '../commands/workspace-migration';
import { manageWorkspaceConflict } from '../commands/workspace-conflict';
import { manageFileWatcher } from '../commands/file-watcher';
import { manageChangeDetector } from '../commands/change-detector';
import { manageChangeImpact, analyzeWorkspaceImpact } from '../commands/change-impact';
import { manageIncrementalBuild } from '../commands/incremental-build';

export function registerWorkspaceGroup(program: Command): void {
  const workspace = new Command('workspace')
    .description('Workspace health, dependencies, and sync management');

  // === MAIN WORKSPACE SUBCOMMANDS (from original workspaceCommand) ===

  workspace
    .command('init')
    .description('Initialize a new workspace configuration with framework detection')
    .option('--yes', 'Skip prompts and use defaults')
    .action(
      createAsyncCommand(async options => {
        await withTimeout(async () => {
          await initWorkspace({ ...options });
        }, 60000); // 60 second timeout
      })
    );

  workspace
    .command('list')
    .description('List all workspaces')
    .option('--json', 'Output as JSON')
    .option('--type <type>', 'Filter by workspace type (app, package, lib, tool)')
    .option('--framework <framework>', 'Filter by framework')
    .action(
      createAsyncCommand(async options => {
        const spinner = createSpinner('Loading workspaces...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await listWorkspaces({ ...options, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Workspaces listed successfully!'));
        } else {
          spinner.stop();
        }
      })
    );

  workspace
    .command('update')
    .description('Update workspace dependencies')
    .option('--workspace <name>', 'Update specific workspace')
    .option('--dependency <name>', 'Update specific dependency')
    .option('--version <version>', 'Target version for dependency')
    .option('--dev', 'Update dev dependency')
    .action(
      createAsyncCommand(async options => {
        const spinner = createSpinner('Updating workspaces...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await updateWorkspaces({ ...options, spinner });
        }, 300000); // 5 minute timeout for updates

        spinner.succeed(chalk.green('Workspaces updated successfully!'));
      })
    );

  workspace
    .command('validate')
    .description('Validate workspace configuration with detailed error reporting')
    .option('--fix', 'Attempt automatic fixes for common issues')
    .option('--json', 'Output validation results as JSON')
    .option('--watch', 'Watch file for changes and validate in real-time')
    .action(
      createAsyncCommand(async options => {
        // No timeout for watch mode
        if (options.watch) {
          await validateWorkspaceConfig({ ...options });
        } else {
          await withTimeout(async () => {
            await validateWorkspaceConfig({ ...options });
          }, 30000); // 30 second timeout
        }
      })
    );

  workspace
    .command('health')
    .description('Check workspace health with comprehensive diagnostics')
    .option('--json', 'Output health results as JSON')
    .option('--verbose', 'Show detailed health information')
    .action(
      createAsyncCommand(async options => {
        await withTimeout(async () => {
          await checkWorkspaceHealth({ ...options });
        }, 30000); // 30 second timeout
      })
    );

  workspace
    .command('migrate')
    .description('Migrate workspace configuration to new version')
    .option('--from <version>', 'Source version (default: auto-detect)')
    .option('--to <version>', 'Target version (default: 2.0.0)')
    .option('--dry-run', 'Preview changes without applying them')
    .option('--no-backup', 'Skip creating backup before migration')
    .action(
      createAsyncCommand(async options => {
        await withTimeout(async () => {
          await migrateWorkspace({ ...options });
        }, 60000); // 60 second timeout
      })
    );

  workspace
    .command('optimize')
    .description('Optimize workspace configuration for performance and best practices')
    .option('--type <type>', 'Filter by recommendation type (performance, structure, security, maintainability, scalability)')
    .option('--severity <severity>', 'Filter by severity (critical, high, medium, low)')
    .option('--fix', 'Apply automated fixes (experimental)')
    .option('--json', 'Output optimization report as JSON')
    .option('--verbose', 'Show detailed recommendations')
    .action(
      createAsyncCommand(async options => {
        const spinner = options.json ? undefined : createSpinner('Analyzing workspace...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        await withTimeout(async () => {
          await optimizeWorkspace({ ...options, spinner });
        }, 60000); // 60 second timeout
      })
    );

  // Template management subcommands
  const workspaceTemplateSubCommand = workspace.command('template').description('Manage workspace templates');

  workspaceTemplateSubCommand
    .command('list')
    .description('List all workspace templates')
    .action(
      createAsyncCommand(async options => {
        const spinner = createSpinner('Loading templates...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'list' });
        }, 30000); // 30 second timeout
      })
    );

  workspaceTemplateSubCommand
    .command('show <id>')
    .description('Show template details')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner('Loading template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'show', templateId: id });
        }, 30000);
      })
    );

  workspaceTemplateSubCommand
    .command('create')
    .description('Create a new template interactively')
    .action(
      createAsyncCommand(async options => {
        const spinner = createSpinner('Creating template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'create' });
        }, 60000);
      })
    );

  workspaceTemplateSubCommand
    .command('validate <id>')
    .description('Validate a template')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner('Validating template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'validate', templateId: id });
        }, 30000);
      })
    );

  workspaceTemplateSubCommand
    .command('export <id>')
    .description('Export template to file')
    .option('--output <path>', 'Output file path')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner('Exporting template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'export', templateId: id, output: options.output });
        }, 30000);
      })
    );

  workspaceTemplateSubCommand
    .command('import <file>')
    .description('Import template from file')
    .action(
      createAsyncCommand(async (file, options) => {
        const spinner = createSpinner('Importing template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'import', filePath: file });
        }, 30000);
      })
    );

  workspaceTemplateSubCommand
    .command('delete <id>')
    .description('Delete a template')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner('Deleting template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'delete', templateId: id });
        }, 30000);
      })
    );

  workspaceTemplateSubCommand
    .command('chain <id>')
    .description('Show template inheritance chain')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner('Building inheritance chain...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ ...options, spinner, action: 'chain', templateId: id });
        }, 30000);
      })
    );

  workspace
    .command('graph')
    .description('Generate workspace dependency graph')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text, json, mermaid, svg, d3)', 'text')
    .action(
      createAsyncCommand(async options => {
        const spinner = createSpinner('Generating workspace graph...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateWorkspaceGraph({ ...options, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green('Workspace graph generated successfully!'));
      })
    );

  workspace
    .command('import')
    .description('Import workspace from existing monorepo (Nx, Turbo, Lerna, Yarn, PNPM)')
    .option('--source <type>', 'Monorepo type (nx, turbo, lerna, yarn, pnpm, auto)', 'auto')
    .option('--config <path>', 'Path to monorepo config file')
    .option('--output <path>', 'Output path for workspace config')
    .option('--no-dev', 'Exclude dev dependencies')
    .option('--no-detect', 'Skip framework detection')
    .action(
      createAsyncCommand(async options => {
        const spinner = createSpinner('Analyzing monorepo...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await importFromMonorepo({ ...options, includeDev: options.dev !== false, detectFrameworks: options.detect !== false, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green('Workspace imported successfully!'));
      })
    );

  workspace
    .command('docs')
    .description('Generate workspace documentation with architecture diagrams')
    .option('--output <file>', 'Output file path', 'WORKSPACE.md')
    .option('--format <format>', 'Output format (markdown, json, html)', 'markdown')
    .option('--no-diagrams', 'Skip architecture diagrams')
    .option('--no-env', 'Skip environment variables')
    .option('--no-deps', 'Skip dependencies')
    .option('--watch', 'Watch for changes and auto-update documentation')
    .action(
      createAsyncCommand(async options => {
        // No timeout for watch mode
        if (options.watch) {
          const { generateWorkspaceDocs } = await import('../commands/workspace-docs');
          await generateWorkspaceDocs({
            output: options.output,
            format: options.format,
            includeDiagrams: options.diagrams !== false,
            includeEnv: options.env !== false,
            includeDependencies: options.deps !== false,
            watch: true,
          });
        } else {
          await withTimeout(async () => {
            const { generateWorkspaceDocs } = await import('../commands/workspace-docs');
            await generateWorkspaceDocs({
              output: options.output,
              format: options.format,
              includeDiagrams: options.diagrams !== false,
              includeEnv: options.env !== false,
              includeDependencies: options.deps !== false,
            });
          }, 60000); // 1 minute timeout
        }
      })
    );

  workspace
    .command('diff')
    .description('Compare workspace configurations for PR reviews and change impact analysis')
    .option('--from <path>', 'Original configuration (file path or /dev/stdin for git)')
    .option('--to <path>', 'New configuration (defaults to re-shell.workspaces.yaml)')
    .option('--format <format>', 'Output format (text, json, markdown)', 'text')
    .option('--verbose', 'Show detailed changes including values')
    .action(
      createAsyncCommand(async options => {
        await withTimeout(async () => {
          const { diffWorkspace } = await import('../commands/workspace-diff');
          await diffWorkspace({ ...options });
        }, 30000); // 30 second timeout
      })
    );

  // === WORKSPACE-DEF → workspace def ===
  const defGroup = new Command('def')
    .description('Manage workspace definitions and schemas');

  defGroup
    .command('init')
    .description('Initialize workspace definition file')
    .option('--output <file>', 'Output file path', 're-shell.workspaces.yaml')
    .option('--dry-run', 'Preview without creating file')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Initializing workspace definition...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceDefinition({ ...options, init: true, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green('Workspace definition initialized!'));
      })
    );

  defGroup
    .command('validate')
    .description('Validate workspace definition')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--strict', 'Treat warnings as errors')
    .option('--ignore-warnings', 'Ignore validation warnings')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating workspace definition...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceDefinition({ ...options, validate: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Validation completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  defGroup
    .command('structure')
    .description('Validate workspace structure on disk')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--strict', 'Treat warnings as errors')
    .option('--ignore-warnings', 'Ignore validation warnings')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating workspace structure...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceDefinition({ ...options, structure: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Structure validation completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  defGroup
    .command('auto-detect')
    .description('Auto-detect workspaces based on patterns')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--output <file>', 'Output file (defaults to input file)')
    .option('--merge', 'Merge with existing definition')
    .option('--dry-run', 'Preview without making changes')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Auto-detecting workspaces...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceDefinition({ ...options, autoDetect: true, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green('Workspace auto-detection completed!'));
      })
    );

  defGroup
    .command('fix')
    .description('Fix workspace definition issues')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--dry-run', 'Preview fixes without applying')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing workspace definition...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceDefinition({ ...options, fix: true, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green('Fix analysis completed!'));
      })
    );

  defGroup
    .command('interactive')
    .description('Interactive workspace definition management')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading workspace definition interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceDefinition({ ...options, interactive: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(defGroup);

  // === WORKSPACE-GRAPH → workspace graph-analysis ===
  // Note: using 'graph-analysis' to avoid conflict with existing 'workspace graph' subcommand
  const graphGroup = new Command('graph-analysis')
    .description('Analyze workspace dependency graphs and detect cycles');

  graphGroup
    .command('analyze')
    .description('Comprehensive workspace dependency graph analysis')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--detailed', 'Show detailed analysis information')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show verbose information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing workspace dependency graph...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceGraph({ ...options, analyze: true, spinner });
        }, 60000); // 1 minute timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Graph analysis completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  graphGroup
    .command('cycles')
    .description('Detect and analyze dependency cycles')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--detailed', 'Show detailed cycle information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Detecting dependency cycles...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceGraph({ ...options, cycles: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Cycle detection completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  graphGroup
    .command('order')
    .description('Generate optimal build order')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--detailed', 'Show detailed build order information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Generating build order...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceGraph({ ...options, order: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Build order generated!'));
        } else {
          spinner.stop();
        }
      })
    );

  graphGroup
    .command('critical')
    .description('Find critical path through dependency graph')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Finding critical path...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceGraph({ ...options, critical: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Critical path analysis completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  graphGroup
    .command('visualize')
    .description('Generate graph visualization data')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--output <file>', 'Save visualization data to file (JSON format)')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Generating graph visualization...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceGraph({ ...options, visualize: true, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green('Visualization generated!'));
      })
    );

  graphGroup
    .command('interactive')
    .description('Interactive graph analysis interface')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading graph analysis interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceGraph({ ...options, interactive: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(graphGroup);

  // === WORKSPACE-HEALTH → workspace diagnostics ===
  const diagnosticsGroup = new Command('diagnostics')
    .description('Validate workspace topology and perform health checks');

  diagnosticsGroup
    .command('check')
    .description('Perform comprehensive workspace health check')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--category <category>', 'Check specific category (structure, dependencies, build, etc.)')
    .option('--output <file>', 'Save health report to file')
    .option('--detailed', 'Show detailed check information')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Performing workspace health check...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceHealth({ ...options, check: true, spinner });
        }, 120000); // 2 minute timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Health check completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  diagnosticsGroup
    .command('topology')
    .description('Validate workspace topology and structure')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating workspace topology...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceHealth({ ...options, topology: true, spinner });
        }, 60000); // 1 minute timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Topology validation completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  diagnosticsGroup
    .command('quick')
    .description('Quick workspace health check')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Running quick health check...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceHealth({ ...options, quick: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Quick check completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  diagnosticsGroup
    .command('watch')
    .description('Monitor workspace health continuously')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Starting health monitoring...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        // Note: watch command runs indefinitely, no timeout
        await manageWorkspaceHealth({ ...options, watch: true, spinner });
      })
    );

  diagnosticsGroup
    .command('fix')
    .description('Analyze and suggest fixes for health issues')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing fixable health issues...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceHealth({ ...options, fix: true, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green('Fix analysis completed!'));
      })
    );

  diagnosticsGroup
    .command('interactive')
    .description('Interactive workspace health management')
    .option('--file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading health management interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceHealth({ ...options, interactive: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(diagnosticsGroup);

  // === WORKSPACE-STATE → workspace state ===
  const stateGroup = new Command('state')
    .description('Manage workspace state persistence and caching');

  stateGroup
    .command('status')
    .description('Show workspace state and cache status')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading workspace state status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceState({ ...options, status: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('State status loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  stateGroup
    .command('clear')
    .description('Clear workspace state')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Clearing workspace state...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceState({ ...options, clear: true, spinner });
        }, 15000); // 15 second timeout

        spinner.succeed(chalk.green('Workspace state cleared!'));
      })
    );

  stateGroup
    .command('backup')
    .description('Backup workspace state')
    .option('--output <file>', 'Backup file path')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Creating state backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceState({ ...options, backup: true, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green('State backup created!'));
      })
    );

  stateGroup
    .command('restore <file>')
    .description('Restore workspace state from backup')
    .action(
      createAsyncCommand(async (file, options) => {
        const spinner = createSpinner(`Restoring state from ${file}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceState({ ...options, restore: true, file, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green('State restored!'));
      })
    );

  stateGroup
    .command('cache')
    .description('Manage workspace cache')
    .option('--clear', 'Clear all cache')
    .option('--pattern <pattern>', 'Invalidate cache entries matching pattern')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Managing workspace cache...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceState({ ...options, cache: true, spinner });
        }, 30000); // 30 second timeout

        if (options.clear) {
          spinner.succeed(chalk.green('Cache cleared!'));
        } else {
          spinner.succeed(chalk.green('Cache operation completed!'));
        }
      })
    );

  stateGroup
    .command('optimize')
    .description('Optimize workspace storage (remove expired cache entries)')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Optimizing workspace storage...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceState({ ...options, optimize: true, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green('Storage optimized!'));
      })
    );

  stateGroup
    .command('interactive')
    .description('Interactive workspace state management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading state management interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceState({ ...options, interactive: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(stateGroup);

  // === WORKSPACE-TEMPLATE → workspace tpl ===
  const tplGroup = new Command('tpl')
    .description('Manage workspace templates and inheritance');

  tplGroup
    .command('list')
    .description('List available workspace templates')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading templates...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplate({ ...options, list: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Templates loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  tplGroup
    .command('create')
    .description('Create new workspace template')
    .option('--name <name>', 'Template name')
    .option('--extends <template>', 'Parent template to extend')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Creating template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplate({ ...options, create: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  tplGroup
    .command('show <name>')
    .description('Show template details and inheritance chain')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show template content')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Loading template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplate({ ...options, show: true, template: name, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green(`Template '${name}' loaded!`));
        } else {
          spinner.stop();
        }
      })
    );

  tplGroup
    .command('apply <name>')
    .description('Apply template with variable substitution')
    .option('--variables <json>', 'Variables as JSON string')
    .option('--vars-file <file>', 'Load variables from YAML file')
    .option('--output <file>', 'Save result to file')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Applying template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplate({ ...options, apply: true, template: name, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green(`Template '${name}' applied!`));
      })
    );

  tplGroup
    .command('delete <name>')
    .description('Delete workspace template')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Deleting template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplate({ ...options, delete: true, template: name, spinner });
        }, 15000); // 15 second timeout

        spinner.succeed(chalk.green(`Template '${name}' deleted!`));
      })
    );

  tplGroup
    .command('export <name>')
    .description('Export workspace definition as template')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--output <file>', 'Save template to file instead of registry')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner('Exporting workspace as template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplate({ ...options, export: true, name, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green(`Template '${name}' exported!`));
      })
    );

  tplGroup
    .command('interactive')
    .description('Interactive template management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading template management interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplate({ ...options, interactive: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(tplGroup);

  // === WORKSPACE-BACKUP → workspace backup ===
  const backupGroup = new Command('backup')
    .description('Manage workspace backups and restore capabilities');

  backupGroup
    .command('create')
    .description('Create workspace backup')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--name <name>', 'Backup name')
    .option('--description <description>', 'Backup description')
    .option('--include-state', 'Include workspace state', true)
    .option('--include-cache', 'Include cache data')
    .option('--include-templates', 'Include templates', true)
    .option('--include-files', 'Include additional files')
    .option('--file-patterns <patterns>', 'File patterns to include (comma-separated)')
    .option('--tags <tags>', 'Backup tags (comma-separated)')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Creating workspace backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, create: true, spinner });
        }, 60000); // 1 minute timeout

        spinner.succeed(chalk.green('Backup created successfully!'));
      })
    );

  backupGroup
    .command('list')
    .description('List workspace backups')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading backups...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, list: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Backups loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('show <id>')
    .description('Show backup details')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner(`Loading backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, show: true, name: id, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green(`Backup '${id}' loaded!`));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('restore <id>')
    .description('Restore workspace from backup')
    .option('--force', 'Overwrite existing files')
    .option('--selective', 'Selective restoration')
    .option('--restore-state', 'Restore workspace state', true)
    .option('--restore-cache', 'Restore cache data')
    .option('--restore-templates', 'Restore templates', true)
    .option('--restore-files', 'Restore additional files')
    .option('--target-path <path>', 'Target directory for restoration')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner(`Restoring backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, restore: true, name: id, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green('Backup restored successfully!'));
      })
    );

  backupGroup
    .command('delete <id>')
    .description('Delete workspace backup')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner(`Deleting backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, delete: true, name: id, spinner });
        }, 15000); // 15 second timeout

        spinner.succeed(chalk.green(`Backup '${id}' deleted!`));
      })
    );

  backupGroup
    .command('export <id>')
    .description('Export backup to file')
    .option('--output <file>', 'Output file path', true)
    .action(
      createAsyncCommand(async (id, options) => {
        if (!options.output) {
          console.log(chalk.red('Error: --output file path is required'));
          process.exit(1);
        }

        const spinner = createSpinner(`Exporting backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, export: true, name: id, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green('Backup exported successfully!'));
      })
    );

  backupGroup
    .command('import <file>')
    .description('Import backup from file')
    .action(
      createAsyncCommand(async (file, options) => {
        const spinner = createSpinner(`Importing backup from: ${file}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, import: true, file, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green('Backup imported successfully!'));
      })
    );

  backupGroup
    .command('cleanup')
    .description('Clean up old backups')
    .option('--keep-count <count>', 'Number of recent backups to keep', '10')
    .option('--keep-days <days>', 'Keep backups newer than N days', '30')
    .option('--dry-run', 'Preview cleanup without deleting')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing backups for cleanup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({
            ...options,
            cleanup: true,
            keepCount: parseInt(options.keepCount),
            keepDays: parseInt(options.keepDays),
            spinner
          });
        }, 30000); // 30 second timeout

        if (!options.dryRun) {
          spinner.succeed(chalk.green('Backup cleanup completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('compare <id1> <id2>')
    .description('Compare two backups')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed comparison')
    .action(
      createAsyncCommand(async (id1, id2, options) => {
        const spinner = createSpinner('Comparing backups...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({
            ...options,
            compare: true,
            backup1: id1,
            backup2: id2,
            spinner
          });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Comparison completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('interactive')
    .description('Interactive backup management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading backup management interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceBackup({ ...options, interactive: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(backupGroup);

  // === WORKSPACE-MIGRATION → workspace migration ===
  const migrationGroup = new Command('migration')
    .description('Manage workspace migrations and upgrades');

  migrationGroup
    .command('check')
    .description('Check for available workspace upgrades')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking for upgrades...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceMigration({ ...options, check: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Upgrade check completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrationGroup
    .command('plan')
    .description('Create migration plan to target version')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--target-version <version>', 'Target version for migration', true)
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed plan information')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.targetVersion) {
          console.log(chalk.red('Error: --target-version is required'));
          process.exit(1);
        }

        const spinner = createSpinner('Creating migration plan...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceMigration({ ...options, plan: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Migration plan created!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrationGroup
    .command('upgrade')
    .description('Upgrade workspace to target version')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--target-version <version>', 'Target version for upgrade')
    .option('--force', 'Force upgrade without confirmations')
    .option('--dry-run', 'Preview upgrade without making changes')
    .option('--no-backup', 'Skip automatic backup creation')
    .option('--skip-validation', 'Skip pre-migration validation')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.targetVersion) {
          console.log(chalk.red('Error: --target-version is required'));
          process.exit(1);
        }

        const spinner = createSpinner('Upgrading workspace...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceMigration({
            ...options,
            upgrade: true,
            backup: options.backup !== false,
            spinner
          });
        }, 300000); // 5 minute timeout

        if (options.dryRun) {
          spinner.succeed(chalk.green('Dry run completed!'));
        } else {
          spinner.succeed(chalk.green('Upgrade completed!'));
        }
      })
    );

  migrationGroup
    .command('validate')
    .description('Validate workspace definition')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating workspace...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceMigration({ ...options, validate: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('Validation completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrationGroup
    .command('history')
    .description('Show migration history')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading migration history...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceMigration({ ...options, history: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.json) {
          spinner.succeed(chalk.green('History loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrationGroup
    .command('rollback')
    .description('Rollback last migration using backup')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--force', 'Force rollback without confirmation')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Rolling back migration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceMigration({ ...options, rollback: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green('Rollback completed!'));
      })
    );

  migrationGroup
    .command('interactive')
    .description('Interactive migration management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading migration management interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceMigration({ ...options, interactive: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(migrationGroup);

  // === WORKSPACE-CONFLICT → workspace conflict ===
  const conflictGroup = new Command('conflict')
    .description('Detect and resolve workspace conflicts');

  conflictGroup
    .command('detect')
    .description('Detect conflicts in workspace definition')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--include-warnings', 'Include warning-level conflicts')
    .option('--check-dependencies', 'Check dependency conflicts')
    .option('--check-ports', 'Check port collisions')
    .option('--check-paths', 'Check path collisions')
    .option('--check-types', 'Check type mismatches')
    .option('--group-by <type>', 'Group results by type|severity|workspace')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Detecting workspace conflicts...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConflict({ ...options, detect: true, spinner });
        }, 30000); // 30 second timeout

        spinner.succeed(chalk.green('Conflict detection completed!'));
      })
    );

  conflictGroup
    .command('resolve')
    .description('Resolve a specific conflict')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--conflict-id <id>', 'Conflict ID to resolve')
    .option('--resolution-id <id>', 'Resolution ID to apply')
    .option('--force', 'Apply resolution without confirmation')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Resolving workspace conflict...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConflict({ ...options, resolve: true, spinner });
        }, 60000); // 60 second timeout

        spinner.succeed(chalk.green('Conflict resolved!'));
      })
    );

  conflictGroup
    .command('preview')
    .description('Preview resolution changes')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--conflict-id <id>', 'Conflict ID to preview')
    .option('--resolution-id <id>', 'Resolution ID to preview')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Previewing resolution...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConflict({ ...options, preview: true, spinner });
        }, 30000); // 30 second timeout

        spinner.stop();
      })
    );

  conflictGroup
    .command('auto-resolve')
    .description('Automatically resolve all low-risk conflicts')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Auto-resolving conflicts...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConflict({ ...options, autoResolve: true, spinner });
        }, 120000); // 2 minute timeout

        spinner.succeed(chalk.green('Auto-resolution completed!'));
      })
    );

  conflictGroup
    .command('interactive')
    .description('Interactive conflict management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading conflict management interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConflict({ ...options, interactive: true, spinner });
        }, 300000); // 5 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(conflictGroup);

  // === FILE-WATCHER → workspace watch ===
  const watchGroup = new Command('watch')
    .description('Manage real-time file watching and change propagation');

  watchGroup
    .command('start')
    .description('Start file watcher for workspace')
    .option('--workspace-file <file>', 'Workspace definition file', 're-shell.workspaces.yaml')
    .option('--use-polling', 'Use polling instead of native events')
    .option('--interval <ms>', 'Polling interval in milliseconds', '1000')
    .option('--depth <number>', 'Maximum watch depth')
    .option('--ignored <patterns...>', 'Patterns to ignore')
    .option('--follow', 'Follow changes in real-time')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Starting file watcher...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, start: true, spinner });
        }, 30000); // 30 second timeout

        if (!options.follow) {
          spinner.succeed(chalk.green('File watcher started!'));
        }
      })
    );

  watchGroup
    .command('stop')
    .description('Stop active file watcher')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed statistics')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Stopping file watcher...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, stop: true, spinner });
        }, 15000); // 15 second timeout

        spinner.succeed(chalk.green('File watcher stopped!'));
      })
    );

  watchGroup
    .command('status')
    .description('Show file watcher status')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking watcher status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, status: true, spinner });
        }, 10000); // 10 second timeout

        spinner.stop();
      })
    );

  watchGroup
    .command('stats')
    .description('Show file watcher statistics')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Gathering statistics...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, stats: true, spinner });
        }, 10000); // 10 second timeout

        spinner.stop();
      })
    );

  watchGroup
    .command('rules')
    .description('Show change propagation rules')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading propagation rules...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, rules: true, spinner });
        }, 10000); // 10 second timeout

        spinner.stop();
      })
    );

  watchGroup
    .command('add-rule')
    .description('Add change propagation rule')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Adding propagation rule...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, addRule: true, spinner });
        }, 60000); // 60 second timeout

        spinner.stop();
      })
    );

  watchGroup
    .command('remove-rule')
    .description('Remove change propagation rule')
    .option('--rule-id <id>', 'Rule ID to remove')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Removing propagation rule...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, removeRule: options.ruleId, spinner });
        }, 10000); // 10 second timeout

        spinner.succeed(chalk.green('Rule removed!'));
      })
    );

  watchGroup
    .command('interactive')
    .description('Interactive file watcher management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading file watcher interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageFileWatcher({ ...options, interactive: true, spinner });
        }, 300000); // 5 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(watchGroup);

  // === CHANGE-DETECTOR → workspace changes ===
  const changesGroup = new Command('changes')
    .description('Intelligent change detection with content hashing');

  changesGroup
    .command('scan')
    .description('Scan for changes in workspace')
    .option('--path <directory>', 'Directory to scan', process.cwd())
    .option('--use-hashing', 'Use content hashing for detection', true)
    .option('--metadata-only', 'Use metadata-only detection')
    .option('--track-moves', 'Track file moves', true)
    .option('--max-depth <number>', 'Maximum scan depth', '10')
    .option('--max-file-size <bytes>', 'Maximum file size for hashing')
    .option('--algorithm <name>', 'Hashing algorithm', 'sha256')
    .option('--skip-binary', 'Skip binary files')
    .option('--chunk-size <bytes>', 'Chunk size for hashing')
    .option('--enable-cache', 'Enable cache', true)
    .option('--cache-location <path>', 'Cache file location')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Scanning for changes...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, scan: true, spinner });
        }, 60000); // 60 second timeout

        spinner.succeed(chalk.green('Change scan completed!'));
      })
    );

  changesGroup
    .command('status')
    .description('Show change detector status')
    .option('--path <directory>', 'Directory to check', process.cwd())
    .option('--enable-cache', 'Enable cache', true)
    .option('--cache-location <path>', 'Cache file location')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking detector status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, status: true, spinner });
        }, 15000); // 15 second timeout

        spinner.stop();
      })
    );

  changesGroup
    .command('stats')
    .description('Show change detection statistics')
    .option('--path <directory>', 'Directory to analyze', process.cwd())
    .option('--enable-cache', 'Enable cache', true)
    .option('--cache-location <path>', 'Cache file location')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Gathering statistics...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, stats: true, spinner });
        }, 30000); // 30 second timeout

        spinner.stop();
      })
    );

  changesGroup
    .command('check')
    .description('Check if specific file has changed')
    .option('--path <directory>', 'Root directory', process.cwd())
    .option('--file <path>', 'File path to check')
    .option('--use-hashing', 'Use content hashing', true)
    .option('--enable-cache', 'Enable cache', true)
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking file changes...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, check: options.file, spinner });
        }, 15000); // 15 second timeout

        spinner.stop();
      })
    );

  changesGroup
    .command('clear')
    .description('Clear change detection cache')
    .option('--path <directory>', 'Root directory', process.cwd())
    .option('--cache-location <path>', 'Cache file location')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Clearing cache...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, clear: true, spinner });
        }, 10000); // 10 second timeout

        spinner.succeed(chalk.green('Cache cleared!'));
      })
    );

  changesGroup
    .command('watch')
    .description('Watch for changes continuously')
    .option('--path <directory>', 'Directory to watch', process.cwd())
    .option('--use-hashing', 'Use content hashing', true)
    .option('--track-moves', 'Track file moves', true)
    .option('--enable-cache', 'Enable cache', true)
    .option('--verbose', 'Show verbose output')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Starting change monitoring...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, watch: true, spinner });
        }, Infinity); // No timeout for watch mode

        spinner.stop();
      })
    );

  changesGroup
    .command('compare')
    .description('Compare changes over time')
    .option('--path <directory>', 'Directory to compare', process.cwd())
    .option('--use-hashing', 'Use content hashing', true)
    .option('--track-moves', 'Track file moves', true)
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Comparing changes...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, compare: true, spinner });
        }, 30000); // 30 second timeout

        spinner.stop();
      })
    );

  changesGroup
    .command('interactive')
    .description('Interactive change detection management')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading change detection interface...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeDetector({ ...options, interactive: true, spinner });
        }, 300000); // 5 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(changesGroup);

  // === CHANGE-IMPACT → workspace impact ===
  const impactGroup = new Command('impact')
    .description('Analyze change impact across workspace dependencies');

  impactGroup
    .command('analyze')
    .description('Analyze impact of file changes')
    .option('--files <files...>', 'Specific files to analyze')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json|mermaid)', 'text')
    .option('--verbose', 'Show detailed information')
    .option('--max-depth <depth>', 'Maximum dependency depth', '10')
    .option('--include-tests', 'Include test dependencies')
    .option('--include-dev-deps', 'Include dev dependencies')
    .option('--visualization', 'Generate visualization data')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing change impact...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageChangeImpact({
            ...options,
            maxDepth: parseInt(options.maxDepth)
          });
        }, 120000); // 2 minute timeout

        spinner.stop();
      })
    );

  impactGroup
    .command('workspace <name>')
    .description('Analyze impact for specific workspace')
    .option('--verbose', 'Show detailed information')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner('Analyzing workspace impact...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await analyzeWorkspaceImpact(name, options);
        }, 60000); // 1 minute timeout

        spinner.stop();
      })
    );

  impactGroup
    .command('graph')
    .description('Show workspace dependency graph')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json|mermaid)', 'text')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Building dependency graph...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceGraph(options);
        }, 60000); // 1 minute timeout

        spinner.stop();
      })
    );

  workspace.addCommand(impactGroup);

  // === INCREMENTAL-BUILD → workspace ibuild ===
  const ibuildGroup = new Command('ibuild')
    .description('Intelligent incremental building with change detection');

  ibuildGroup
    .command('build')
    .description('Run incremental build')
    .option('--targets <targets...>', 'Specific targets to build')
    .option('--changed-files <files...>', 'Specific changed files to analyze')
    .option('--max-parallel <num>', 'Maximum parallel builds', '4')
    .option('--no-cache', 'Disable build caching')
    .option('--cache-location <path>', 'Build cache location')
    .option('--clean', 'Clean build (ignore cache)')
    .option('--dry-run', 'Show what would be built without building')
    .option('--verbose', 'Show detailed information')
    .option('--skip-tests', 'Skip test execution')
    .option('--no-fail-fast', 'Continue building after failures')
    .option('--build-timeout <ms>', 'Build timeout in milliseconds', '300000')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Running incremental build...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageIncrementalBuild({
            ...options,
            maxParallelBuilds: parseInt(options.maxParallel),
            buildTimeout: parseInt(options.buildTimeout),
            enableCache: options.cache !== false,
            cleanBuild: options.clean,
            dryRun: options.dryRun,
            failFast: options.failFast !== false
          });
        }, 600000); // 10 minute timeout

        spinner.stop();
      })
    );

  ibuildGroup
    .command('plan')
    .description('Show build plan without executing')
    .option('--changed-files <files...>', 'Specific changed files to analyze')
    .option('--verbose', 'Show detailed information')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Creating build plan...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageIncrementalBuild({
            ...options,
            plan: true
          });
        }, 60000); // 1 minute timeout

        spinner.stop();
      })
    );

  ibuildGroup
    .command('stats')
    .description('Show build statistics and performance metrics')
    .option('--output <file>', 'Output file path')
    .option('--format <format>', 'Output format (text|json)', 'text')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Gathering build statistics...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageIncrementalBuild({
            ...options,
            stats: true
          });
        }, 30000); // 30 second timeout

        spinner.stop();
      })
    );

  ibuildGroup
    .command('clear-cache')
    .description('Clear build cache')
    .action(
      createAsyncCommand(async () => {
        const spinner = createSpinner('Clearing build cache...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageIncrementalBuild({
            clearCache: true
          });
        }, 15000); // 15 second timeout

        spinner.succeed(chalk.green('Build cache cleared!'));
      })
    );

  workspace.addCommand(ibuildGroup);

  program.addCommand(workspace);
}
