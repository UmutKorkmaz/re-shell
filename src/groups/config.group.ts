import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';
import { manageConfig } from '../commands/config';
import { manageEnvironment } from '../commands/environment';
import { manageMigration } from '../commands/migration';
import { validateConfiguration } from '../commands/validate';
import { manageProjectConfig } from '../commands/project-config';
import { manageWorkspaceConfig } from '../commands/workspace-config';
import { manageConfigDiff } from '../commands/config-diff';
import { manageBackups } from '../commands/backup';
import { manageWorkspaceTemplates } from '../commands/workspace';

function printTree(node: any, depth: number): void {
  const indent = '  '.repeat(depth);
  const connector = depth > 0 ? '└─ ' : '';
  console.log(`${indent}${connector}${node.name}`);

  if (node.children && node.children.length > 0) {
    node.children.forEach((child: any) => printTree(child, depth + 1));
  }
}

export function registerConfigGroup(program: Command): void {
  const config = new Command('config')
    .description('Manage Re-Shell configuration');

  // --- Direct config subcommands (show, get, set, preset, backup, restore, interactive) ---

  config
    .command('show')
    .description('Show current configuration')
    .option('--global', 'Show only global configuration')
    .option('--project', 'Show only project configuration')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ ...options, list: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration loaded successfully!'));
        } else {
          spinner.stop();
        }
      })
    );

  config
    .command('get <key>')
    .description('Get configuration value')
    .option('--global', 'Get from global configuration')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (key, options) => {
        const spinner = createSpinner(`Getting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ ...options, get: key, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration value retrieved!'));
        } else {
          spinner.stop();
        }
      })
    );

  config
    .command('set <key> <value>')
    .description('Set configuration value')
    .option('--global', 'Set in global configuration')
    .option('--project', 'Set in project configuration')
    .action(
      createAsyncCommand(async (key, value, options) => {
        const spinner = createSpinner(`Setting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ ...options, set: key, value, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Configuration updated: ${key}`));
      })
    );

  config
    .command('preset <action> [name]')
    .description('Manage configuration presets (save|load|list|delete)')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (action, name, options) => {
        const spinner = createSpinner(`Managing preset...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        let presetOptions: Parameters<typeof manageConfig>[0] = { ...options, spinner };

        switch (action) {
          case 'save':
            if (!name) throw new Error('Preset name required for save action');
            presetOptions = { ...presetOptions, save: name };
            break;
          case 'load':
            if (!name) throw new Error('Preset name required for load action');
            presetOptions = { ...presetOptions, load: name };
            break;
          case 'list':
            presetOptions = { ...presetOptions, list: true };
            break;
          case 'delete':
            if (!name) throw new Error('Preset name required for delete action');
            presetOptions = { ...presetOptions, delete: name };
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        await withTimeout(async () => {
          await manageConfig(presetOptions);
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Preset ${action} completed successfully!`));
        } else {
          spinner.stop();
        }
      })
    );

  config
    .command('backup')
    .description('Create configuration backup')
    .action(
      createAsyncCommand(async () => {
        const spinner = createSpinner('Creating backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ backup: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Configuration backup created!'));
      })
    );

  config
    .command('restore <backup>')
    .description('Restore configuration from backup')
    .action(
      createAsyncCommand(async (backup) => {
        const spinner = createSpinner('Restoring configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfig({ restore: backup, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Configuration restored!'));
      })
    );

  config
    .command('interactive')
    .description('Interactive configuration management')
    .action(
      createAsyncCommand(async () => {
        await manageConfig({ interactive: true });
      })
    );

  // --- config schema ---
  const schemaGroup = config.command('schema')
    .description('Manage JSON schemas for IDE autocompletion');

  schemaGroup
    .command('publish')
    .description('Publish JSON schemas to IDE configuration directories')
    .option('--output-dir <dir>', 'Output directory for schema files', 'schemas')
    .option('--vscode-dir <dir>', 'VSCode settings directory')
    .option('--create-extension', 'Create VSCode extension')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Publishing schemas...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { publishSchemas } = await import('../utils/schema-generator');
          await publishSchemas({
            outputDir: options.outputDir,
            vscodeDir: options.vscodeDir,
            createVscodeExtension: options.createExtension,
          });
        }, 15000);

        spinner.succeed(chalk.green('Schemas published successfully!'));
      })
    );

  schemaGroup
    .command('validate <file>')
    .description('Validate workspace YAML file against schema')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (file, options) => {
        const spinner = createSpinner('Validating workspace file...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateWorkspaceFile } = await import('../utils/schema-generator');
          const result = await validateWorkspaceFile(file);

          spinner.stop();

          if (result.valid) {
            console.log(chalk.green('✅ Workspace file is valid!'));
            if (result.warnings.length > 0) {
              console.log(chalk.yellow('\n⚠️  Warnings:'));
              result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
            }
          } else {
            console.log(chalk.red('❌ Validation failed!'));
            console.log(chalk.red('\nErrors:'));
            result.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
            if (result.warnings.length > 0) {
              console.log(chalk.yellow('\n⚠️  Warnings:'));
              result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
            }
          }

          if (options.json) {
            console.log('\n' + JSON.stringify(result, null, 2));
          }
        }, 15000);
      })
    );

  schemaGroup
    .command('generate')
    .description('Generate IDE configuration files')
    .option('--output-dir <dir>', 'Output directory', 'schemas')
    .option('--ide <ide>', 'Target IDE (vscode, intellij, vim, emacs, all)', 'all')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Generating IDE configs...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const {
            generateVSCodeConfig,
            generateIntelliJConfig,
            generateVimConfig,
            generateEmacsConfig,
          } = await import('../utils/schema-generator');

          const outputDir = options.outputDir;
          await fs.ensureDir(outputDir);

          if (options.ide === 'all' || options.ide === 'vscode') {
            const vscodeConfig = generateVSCodeConfig('./schemas/re-shell-workspace.schema.json');
            await fs.writeFile(path.join(outputDir, 'vscode-settings.json'), vscodeConfig);
            console.log(chalk.green('✅ VSCode settings generated'));
          }

          if (options.ide === 'all' || options.ide === 'intellij') {
            const intellijConfig = generateIntelliJConfig();
            await fs.writeFile(path.join(outputDir, 'intellij-config.xml'), intellijConfig);
            console.log(chalk.green('✅ IntelliJ config generated'));
          }

          if (options.ide === 'all' || options.ide === 'vim') {
            const vimConfig = generateVimConfig();
            await fs.writeFile(path.join(outputDir, 'vim-config.vim'), vimConfig);
            console.log(chalk.green('✅ Vim config generated'));
          }

          if (options.ide === 'all' || options.ide === 'emacs') {
            const emacsConfig = generateEmacsConfig();
            await fs.writeFile(path.join(outputDir, 'emacs-config.el'), emacsConfig);
            console.log(chalk.green('✅ Emacs config generated'));
          }
        }, 15000);

        spinner.succeed(chalk.green('IDE configurations generated!'));
      })
    );

  // --- config env ---
  const envGroup = config.command('env')
    .description('Manage environment configurations');

  envGroup
    .command('list')
    .description('List all environments')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading environments...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, list: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Environments loaded successfully!'));
        } else {
          spinner.stop();
        }
      })
    );

  envGroup
    .command('active')
    .description('Show active environment')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Getting active environment...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, active: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Active environment retrieved!'));
        } else {
          spinner.stop();
        }
      })
    );

  envGroup
    .command('set <name>')
    .description('Set active environment')
    .action(
      createAsyncCommand(async (name) => {
        const spinner = createSpinner(`Setting active environment to ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ set: name, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Environment '${name}' activated!`));
      })
    );

  envGroup
    .command('create <name>')
    .description('Create new environment')
    .option('--extends <env>', 'Inherit from existing environment')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Creating environment ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, create: name, spinner });
        }, 30000);

        spinner.succeed(chalk.green(`Environment '${name}' created!`));
      })
    );

  envGroup
    .command('delete <name>')
    .description('Delete environment')
    .action(
      createAsyncCommand(async (name) => {
        const spinner = createSpinner(`Deleting environment ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ delete: name, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Environment '${name}' deleted!`));
      })
    );

  envGroup
    .command('compare <env1> <env2>')
    .description('Compare two environments')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (env1, env2, options) => {
        const spinner = createSpinner(`Comparing ${env1} and ${env2}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, compare: [env1, env2], spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Environment comparison completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  envGroup
    .command('generate <name>')
    .description('Generate .env file for environment')
    .option('--output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Generating .env file for ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageEnvironment({ ...options, generate: name, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Environment file generated for '${name}'!`));
      })
    );

  envGroup
    .command('interactive')
    .description('Interactive environment management')
    .action(
      createAsyncCommand(async () => {
        await manageEnvironment({ interactive: true });
      })
    );

  // --- config unified (uconfig) ---
  const unifiedGroup = config.command('unified').alias('uc')
    .description('Unified configuration management with environment synchronization');

  unifiedGroup
    .command('sync <source> <targets...>')
    .description('Synchronize configuration across environments')
    .option('-s, --strategy <strategy>', 'Merge strategy: overwrite, merge, ask', 'merge')
    .option('--exclude <patterns...>', 'Exclude patterns')
    .option('--include <patterns...>', 'Include patterns')
    .option('--include-secrets', 'Include sensitive values')
    .option('--dry-run', 'Preview without making changes')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (source, targets, options) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Synchronizing configurations...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();

          const syncOptions = {
            sourceEnv: source,
            targetEnvs: targets,
            includeSecrets: options.includeSecrets,
            dryRun: options.dryRun,
            mergeStrategy: options.mergeStrategy as 'overwrite' | 'merge' | 'ask',
            excludePatterns: options.exclude || [],
            includePatterns: options.include || [],
          };

          const status = await manager.syncConfigurations(syncOptions);

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(status, null, 2));
            return;
          }

          if (status.success) {
            console.log(chalk.green('\n✅ Configuration sync complete!'));
            console.log(chalk.gray('═'.repeat(50)));
            console.log(`Source: ${chalk.blue(source)}`);
            console.log(`Synced environments: ${chalk.blue(status.syncedEnvironments.join(', ') || 'none')}`);

            if (status.conflicts.length > 0) {
              console.log(chalk.yellow('\n⚠️  Conflicts detected:'));
              for (const conflict of status.conflicts) {
                console.log(`  ${chalk.gray(conflict.key)}: ${chalk.red(String(conflict.sourceValue))} → ${chalk.blue(String(conflict.targetValue))}`);
              }
            }

            if (options.dryRun) {
              console.log(chalk.yellow('\nDry run - no changes written'));
            }
          } else {
            console.log(chalk.red('\n❌ Sync failed'));
            console.log(chalk.gray(status.message || 'Unknown error'));
          }

        } catch (error) {
          spinner.fail(chalk.red('Configuration sync failed'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('snapshot <environment>')
    .description('Create configuration snapshot')
    .option('-v, --version <version>', 'Snapshot version')
    .action(
      createAsyncCommand(async (environment, options) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner(`Creating snapshot for ${environment}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          const snapshot = await manager.createSnapshot(environment, options.version);

          spinner.succeed(chalk.green(`Snapshot created: ${snapshot.version}`));
          console.log(`  Environment: ${chalk.blue(environment)}`);
          console.log(`  Checksum: ${chalk.gray(snapshot.checksum)}`);

        } catch (error) {
          spinner.fail(chalk.red('Snapshot creation failed'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('restore <environment> <version>')
    .description('Restore configuration from snapshot')
    .action(
      createAsyncCommand(async (environment, version) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner(`Restoring snapshot ${version}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          await manager.restoreSnapshot(environment, version);

          spinner.succeed(chalk.green(`Snapshot restored: ${version}`));
          console.log(`  Environment: ${chalk.blue(environment)}`);

        } catch (error) {
          spinner.fail(chalk.red('Snapshot restore failed'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('list-snapshots <environment>')
    .description('List snapshots for an environment')
    .action(
      createAsyncCommand(async (environment) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Loading snapshots...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          const snapshots = manager.listSnapshots(environment);

          spinner.stop();

          if (snapshots.length === 0) {
            console.log(chalk.yellow(`\nNo snapshots found for ${chalk.blue(environment)}`));
            return;
          }

          console.log(chalk.cyan(`\n📸 Snapshots for ${chalk.blue(environment)}`));
          console.log(chalk.gray('─'.repeat(60)));

          for (const snapshot of snapshots.reverse()) {
            const date = new Date(snapshot.timestamp).toLocaleString();
            console.log(`\n${chalk.blue(snapshot.version)}`);
            console.log(`  Date: ${chalk.gray(date)}`);
            console.log(`  Checksum: ${chalk.gray(snapshot.checksum)}`);
          }

        } catch (error) {
          spinner.fail(chalk.red('Failed to load snapshots'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('export <output>')
    .description('Export configuration to file')
    .option('-e, --env <environment>', 'Environment to export')
    .action(
      createAsyncCommand(async (output, options) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Exporting configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          await manager.exportConfig(output, options.env);

          spinner.succeed(chalk.green('Configuration exported'));
          console.log(`  Output: ${chalk.blue(output)}`);
          if (options.env) {
            console.log(`  Environment: ${chalk.blue(options.env)}`);
          }

        } catch (error) {
          spinner.fail(chalk.red('Export failed'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('import <input>')
    .description('Import configuration from file')
    .option('-l, --layer <layer>', 'Target layer (project, local)', 'project')
    .option('--no-merge', 'Replace instead of merge')
    .action(
      createAsyncCommand(async (input, options) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Importing configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          await manager.importConfig(input, options.layer, options.merge !== false);

          spinner.succeed(chalk.green('Configuration imported'));
          console.log(`  Source: ${chalk.blue(input)}`);
          console.log(`  Layer: ${chalk.blue(options.layer)}`);
          console.log(`  Mode: ${options.merge ? 'merge' : 'replace'}`);

        } catch (error) {
          spinner.fail(chalk.red('Import failed'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('validate [environment]')
    .description('Validate configuration')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (environment, options) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Validating configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          const validation = manager.validateConfig(environment);

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(validation, null, 2));
            return;
          }

          if (validation.valid) {
            console.log(chalk.green('\n✅ Configuration is valid'));
          } else {
            console.log(chalk.red('\n❌ Configuration validation failed'));
            console.log(chalk.gray('═'.repeat(50)));
            for (const error of validation.errors) {
              console.log(`  • ${chalk.yellow(error)}`);
            }
          }

        } catch (error) {
          spinner.fail(chalk.red('Validation failed'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('layers')
    .description('List all configuration layers')
    .action(
      createAsyncCommand(async () => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner('Loading configuration layers...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          const layers = manager.getAllLayers();

          spinner.stop();

          console.log(chalk.cyan('\n📚 Configuration Layers'));
          console.log(chalk.gray('═'.repeat(60)));

          for (const layer of layers) {
            const readOnly = layer.readOnly ? ' (read-only)' : '';
            console.log(`\n${chalk.blue(layer.name.padEnd(20))} priority: ${layer.priority}${readOnly ? chalk.gray(readOnly) : ''}`);
            console.log(`  Source: ${chalk.gray(layer.source)}`);
          }

          console.log(chalk.gray('\n═'.repeat(60)));
          console.log(chalk.gray('Higher priority layers override lower priority ones'));

        } catch (error) {
          spinner.fail(chalk.red('Failed to load layers'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('get <key>')
    .description('Get configuration value by key path')
    .option('-e, --env <environment>', 'Environment')
    .action(
      createAsyncCommand(async (key, options) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner(`Getting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          const manager = await createUnifiedConfig();
          const value = manager.getValue(key, options.env);

          spinner.stop();

          if (value === undefined) {
            console.log(chalk.yellow(`\n⚠️  Key not found: ${chalk.blue(key)}`));
          } else {
            console.log(chalk.cyan(`\n${chalk.blue(key)}:`));
            console.log(chalk.gray(JSON.stringify(value, null, 2)));
          }

        } catch (error) {
          spinner.fail(chalk.red('Failed to get value'));
          throw error;
        }
      })
    );

  unifiedGroup
    .command('set <key> <value>')
    .description('Set configuration value by key path')
    .option('-l, --layer <layer>', 'Target layer', 'project')
    .action(
      createAsyncCommand(async (key, value, options) => {
        const { createUnifiedConfig } = await import('../utils/unified-config');
        const { createSpinner } = await import('../utils/spinner');

        const spinner = createSpinner(`Setting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        try {
          let parsedValue: unknown = value;
          try {
            parsedValue = JSON.parse(value);
          } catch {
            // Keep as string
          }

          const manager = await createUnifiedConfig();
          manager.setValue(key, parsedValue, options.layer);
          await manager.saveAll();

          spinner.succeed(chalk.green(`Value set: ${chalk.blue(key)}`));
          console.log(`  Layer: ${chalk.blue(options.layer)}`);
          console.log(`  Value: ${chalk.gray(String(value).slice(0, 50))}${value.length > 50 ? '...' : ''}`);

        } catch (error) {
          spinner.fail(chalk.red('Failed to set value'));
          throw error;
        }
      })
    );

  // --- config migrate ---
  const migrateGroup = config.command('migrate')
    .description('Manage configuration migrations');

  migrateGroup
    .command('auto')
    .description('Auto-migrate all configurations')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Running auto-migration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, auto: true, spinner });
        }, 60000);

        if (!options.json) {
          spinner.succeed(chalk.green('Auto-migration completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('check')
    .description('Check migration status')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking migration status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, check: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Migration status checked!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('global')
    .description('Migrate global configuration')
    .option('--json', 'Output as JSON')
    .option('--force', 'Force migration without confirmation')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Migrating global configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, global: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Global configuration migrated!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('project')
    .description('Migrate project configuration')
    .option('--json', 'Output as JSON')
    .option('--force', 'Force migration without confirmation')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Migrating project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, project: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Project configuration migrated!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('rollback <version>')
    .description('Rollback to previous version')
    .option('--global', 'Rollback global configuration')
    .option('--project', 'Rollback project configuration')
    .option('--json', 'Output as JSON')
    .option('--force', 'Force rollback without confirmation')
    .action(
      createAsyncCommand(async (version, options) => {
        const configType = options.global ? 'global' : 'project';
        const spinner = createSpinner(`Rolling back ${configType} to ${version}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, rollback: version, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Rollback to ${version} completed!`));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('history')
    .description('Show migration history')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading migration history...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageMigration({ ...options, history: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Migration history loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  migrateGroup
    .command('interactive')
    .description('Interactive migration management')
    .action(
      createAsyncCommand(async () => {
        await manageMigration({ interactive: true });
      })
    );

  // --- config validate ---
  const validateGroup = config.command('validate')
    .description('Validate configurations with detailed error messages');

  validateGroup
    .command('all')
    .description('Validate all configurations')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--fix', 'Auto-fix issues where possible')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating configurations...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration validation completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('global')
    .description('Validate global configuration')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating global configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, global: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Global configuration validated!'));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('project')
    .description('Validate project configuration')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, project: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Project configuration validated!'));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('file <path>')
    .description('Validate specific configuration file')
    .option('--warnings', 'Show warnings')
    .option('--suggestions', 'Show suggestions')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (filePath, options) => {
        const spinner = createSpinner(`Validating ${filePath}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await validateConfiguration({ ...options, file: filePath, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green(`File validation completed: ${filePath}`));
        } else {
          spinner.stop();
        }
      })
    );

  validateGroup
    .command('interactive')
    .description('Interactive configuration validation')
    .action(
      createAsyncCommand(async () => {
        await validateConfiguration({ interactive: true });
      })
    );

  // --- config project ---
  const projectGroup = config.command('project')
    .description('Manage project-level configuration with inheritance');

  projectGroup
    .command('init')
    .description('Initialize project configuration')
    .option('--framework <framework>', 'Default framework')
    .option('--package-manager <pm>', 'Package manager (npm, yarn, pnpm, bun)')
    .option('--interactive', 'Interactive initialization')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Initializing project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, init: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Project configuration initialized!'));
      })
    );

  projectGroup
    .command('show')
    .description('Show project configuration with inheritance')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show merged configuration')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading project configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, show: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Project configuration loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  projectGroup
    .command('get <key>')
    .description('Get project configuration value')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (key, options) => {
        const spinner = createSpinner(`Getting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, get: key, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration value retrieved!'));
        } else {
          spinner.stop();
        }
      })
    );

  projectGroup
    .command('set <key> <value>')
    .description('Set project configuration value')
    .action(
      createAsyncCommand(async (key, value, options) => {
        const spinner = createSpinner(`Setting ${key}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageProjectConfig({ ...options, set: key, value, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Configuration updated: ${key}`));
      })
    );

  projectGroup
    .command('interactive')
    .description('Interactive project configuration management')
    .action(
      createAsyncCommand(async () => {
        await manageProjectConfig({ interactive: true });
      })
    );

  // --- config workspace ---
  const workspaceGroup = config.command('workspace')
    .description('Manage workspace-specific configuration with cascading inheritance');

  workspaceGroup
    .command('init')
    .description('Initialize workspace configuration')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .option('--type <type>', 'Workspace type (app, package, lib, tool)', 'app')
    .option('--framework <framework>', 'Framework override')
    .option('--package-manager <pm>', 'Package manager override')
    .option('--interactive', 'Interactive initialization')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Initializing workspace configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, init: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Workspace configuration initialized!'));
      })
    );

  workspaceGroup
    .command('show')
    .description('Show workspace configuration with inheritance chain')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show final merged configuration')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading workspace configuration...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, show: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Workspace configuration loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  workspaceGroup
    .command('get <key>')
    .description('Get workspace configuration value with inheritance info')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (key, options) => {
        const spinner = createSpinner(`Getting configuration value: ${key}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, get: key, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Configuration value retrieved: ${key}`));
        } else {
          spinner.stop();
        }
      })
    );

  workspaceGroup
    .command('set <key> <value>')
    .description('Set workspace configuration value')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .action(
      createAsyncCommand(async (key, value, options) => {
        const spinner = createSpinner(`Setting configuration: ${key} = ${value}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceConfig({ ...options, set: key, value, spinner });
        }, 15000);

        spinner.succeed(chalk.green(`Configuration updated: ${key}`));
      })
    );

  workspaceGroup
    .command('interactive')
    .description('Interactive workspace configuration management')
    .option('--workspace <path>', 'Workspace path', process.cwd())
    .action(
      createAsyncCommand(async (options) => {
        await manageWorkspaceConfig({ ...options, interactive: true });
      })
    );

  // --- config template ---
  const templateGroup = config.command('template')
    .description('Manage configuration templates with variable substitution');

  templateGroup
    .command('list')
    .description('List available configuration templates')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading templates...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'list', spinner, ...options });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Templates loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  templateGroup
    .command('create')
    .description('Create a new configuration template')
    .option('--interactive', 'Interactive template creation')
    .action(
      createAsyncCommand(async (options) => {
        await manageWorkspaceTemplates({ action: 'create', ...options });
      })
    );

  templateGroup
    .command('show <name>')
    .description('Show template details and variables')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show template structure')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Loading template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'show', templateId: name, spinner, ...options });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green(`Template '${name}' loaded!`));
        } else {
          spinner.stop();
        }
      })
    );

  templateGroup
    .command('apply <name>')
    .description('Apply template to generate configuration')
    .option('--variables <json>', 'Variables as JSON string')
    .option('--output <file>', 'Output file path')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Applying template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'export', templateId: name, output: options.output, spinner, ...options });
        }, 30000);

        spinner.succeed(chalk.green(`Template '${name}' applied successfully!`));
      })
    );

  templateGroup
    .command('delete <name>')
    .description('Delete a configuration template')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Deleting template: ${name}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageWorkspaceTemplates({ action: 'delete', templateId: name, spinner, ...options });
        }, 15000);

        spinner.succeed(chalk.green(`Template '${name}' deleted!`));
      })
    );

  templateGroup
    .command('interactive')
    .description('Interactive template management')
    .action(
      createAsyncCommand(async (options) => {
        await manageWorkspaceTemplates({ action: 'create', ...options });
      })
    );

  // --- config diff ---
  const diffGroup = config.command('diff')
    .description('Compare and merge configurations with advanced diffing capabilities');

  diffGroup
    .command('diff')
    .description('Compare two configurations and show differences')
    .option('--left <source>', 'Left configuration source (file, global, project, workspace:path)')
    .option('--right <source>', 'Right configuration source (file, global, project, workspace:path)')
    .option('--format <format>', 'Output format (text, html, json)', 'text')
    .option('--output <file>', 'Output file for diff report')
    .option('--ignore-order', 'Ignore array order in comparison')
    .option('--ignore-paths <paths>', 'Comma-separated paths to ignore')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.left || !options.right) {
          console.log(chalk.red('Error: Both --left and --right sources are required'));
          process.exit(1);
        }

        const spinner = createSpinner('Comparing configurations...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, diff: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration comparison completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  diffGroup
    .command('merge')
    .description('Merge two configurations with conflict resolution')
    .option('--left <source>', 'Base configuration source')
    .option('--right <source>', 'Incoming configuration source')
    .option('--output <file>', 'Output file for merged configuration')
    .option('--strategy <strategy>', 'Merge strategy (left, right, smart, conservative, interactive)', 'smart')
    .option('--interactive', 'Interactive conflict resolution')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.left || !options.right) {
          console.log(chalk.red('Error: Both --left and --right sources are required'));
          process.exit(1);
        }

        const spinner = createSpinner('Merging configurations...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, merge: true, spinner });
        }, 60000);

        spinner.succeed(chalk.green('Configuration merge completed!'));
      })
    );

  diffGroup
    .command('apply')
    .description('Apply a diff patch to a configuration')
    .option('--left <config>', 'Base configuration file')
    .option('--right <diff>', 'Diff file (JSON format)')
    .option('--output <file>', 'Output file for patched configuration')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        if (!options.left || !options.right) {
          console.log(chalk.red('Error: Both --left (config) and --right (diff) are required'));
          process.exit(1);
        }

        const spinner = createSpinner('Applying diff patch...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, apply: true, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Diff patch applied successfully!'));
      })
    );

  diffGroup
    .command('status')
    .description('Show configuration status and inheritance analysis')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing configuration status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageConfigDiff({ ...options, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Configuration analysis completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  diffGroup
    .command('interactive')
    .description('Interactive configuration diffing and merging')
    .action(
      createAsyncCommand(async (options) => {
        await manageConfigDiff({ ...options, interactive: true });
      })
    );

  // --- config backup ---
  const backupGroup = config.command('backup-mgr')
    .description('Backup and restore configurations with versioning and rollback capabilities');

  backupGroup
    .command('create')
    .description('Create a configuration backup')
    .option('--full', 'Create full backup (all configurations)')
    .option('--selective', 'Create selective backup (choose components)')
    .option('--name <name>', 'Backup name')
    .option('--description <desc>', 'Backup description')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Creating backup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, create: true, spinner });
        }, 60000);

        spinner.succeed(chalk.green('Backup created successfully!'));
      })
    );

  backupGroup
    .command('list')
    .description('List all available backups')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading backups...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, list: true, spinner });
        }, 30000);

        if (!options.json) {
          spinner.succeed(chalk.green('Backups loaded!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('restore <id>')
    .description('Restore configuration from backup')
    .option('--force', 'Skip confirmation prompt')
    .option('--dry-run', 'Preview restoration without making changes')
    .option('--no-pre-backup', 'Skip creating backup before restoration')
    .option('--merge-strategy <strategy>', 'Merge strategy (replace, merge, skip-existing)', 'replace')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner(`Restoring from backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, restore: id, spinner });
        }, 120000);

        if (!options.dryRun) {
          spinner.succeed(chalk.green('Configuration restored successfully!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('delete <id>')
    .description('Delete a backup')
    .option('--force', 'Skip confirmation prompt')
    .action(
      createAsyncCommand(async (id, options) => {
        const spinner = createSpinner(`Deleting backup: ${id}`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, delete: id, spinner });
        }, 15000);

        spinner.succeed(chalk.green('Backup deleted successfully!'));
      })
    );

  backupGroup
    .command('export <id>')
    .description('Export backup to file')
    .option('--output <file>', 'Output file path')
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
          await manageBackups({ ...options, export: id, spinner });
        }, 30000);

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
          await manageBackups({ ...options, import: file, spinner });
        }, 30000);

        spinner.succeed(chalk.green('Backup imported successfully!'));
      })
    );

  backupGroup
    .command('cleanup')
    .description('Clean up old backups')
    .option('--keep-count <count>', 'Number of recent backups to keep', '10')
    .option('--keep-days <days>', 'Keep backups newer than N days', '30')
    .option('--dry-run', 'Preview cleanup without deleting')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Analyzing backups for cleanup...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({
            ...options,
            cleanup: true,
            keepCount: parseInt(options.keepCount),
            keepDays: parseInt(options.keepDays),
            spinner
          });
        }, 30000);

        if (!options.dryRun) {
          spinner.succeed(chalk.green('Backup cleanup completed!'));
        } else {
          spinner.stop();
        }
      })
    );

  backupGroup
    .command('stats')
    .description('Show backup statistics')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Calculating backup statistics...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await manageBackups({ ...options, stats: true, spinner });
        }, 15000);

        if (!options.json) {
          spinner.succeed(chalk.green('Statistics calculated!'));
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
        await manageBackups({ ...options, interactive: true });
      })
    );

  // --- config profile ---
  const profileGroup = config.command('profile')
    .description('Manage environment-specific configuration profiles');

  profileGroup
    .command('list')
    .description('List all available profiles')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Loading profiles...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { manageProfiles } = await import('../commands/profile');
          await manageProfiles({ ...options, spinner });
        }, 10000);

        spinner.stop();
      })
    );

  profileGroup
    .command('create')
    .description('Create a new environment profile')
    .option('--framework <framework>', 'Framework to create profile for')
    .option('--interactive', 'Interactive profile creation')
    .action(
      createAsyncCommand(async (options) => {
        const { manageProfiles } = await import('../commands/profile');
        await manageProfiles({ ...options, create: true });
      })
    );

  profileGroup
    .command('activate <name>')
    .description('Activate a profile')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Activating profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { manageProfiles } = await import('../commands/profile');
          await manageProfiles({ ...options, activate: name, spinner });
        }, 10000);

        spinner.stop();
      })
    );

  profileGroup
    .command('show <name>')
    .description('Show profile details')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Loading profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { manageProfiles } = await import('../commands/profile');
          await manageProfiles({ ...options, show: name, spinner });
        }, 10000);

        spinner.stop();
      })
    );

  profileGroup
    .command('delete <name>')
    .description('Delete a profile')
    .action(
      createAsyncCommand(async (name, options) => {
        const { manageProfiles } = await import('../commands/profile');
        await manageProfiles({ ...options, delete: name });
      })
    );

  profileGroup
    .command('validate <name>')
    .description('Validate profile inheritance and check for conflicts')
    .option('--cross-language', 'Enable cross-language validation')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Validating profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateProfileCrossLanguage } = await import('../commands/profile');
          const result = await validateProfileCrossLanguage(name);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n🔍 Profile Validation: ${name}\n`));

          if (result.language) {
            console.log(chalk.gray(`Language: ${result.language}`));
            console.log('');
          }

          if (result.valid) {
            console.log(chalk.green(`✓ Profile is valid\n`));
          } else {
            console.log(chalk.red(`✗ Profile has validation errors\n`));
          }

          if (result.errors.length > 0) {
            console.log(chalk.red('Errors:'));
            result.errors.forEach(error => {
              console.log(chalk.red(`  ✗ ${error}`));
            });
            console.log('');
          }

          if (result.warnings.length > 0) {
            console.log(chalk.yellow('Warnings:'));
            result.warnings.forEach(warning => {
              console.log(chalk.gray(`  ⚠ ${warning}`));
            });
            console.log('');
          }

          if (result.suggestions.length > 0) {
            console.log(chalk.cyan('Suggestions:'));
            result.suggestions.forEach(suggestion => {
              console.log(chalk.gray(`  → ${suggestion}`));
            });
            console.log('');
          }
        }, 10000);
      })
    );

  profileGroup
    .command('validate-all')
    .description('Validate all profiles for cross-language compatibility')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Validating all profiles...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateAllProfiles } = await import('../commands/profile');
          const { profiles, summary } = await validateAllProfiles();

          spinner.stop();

          console.log(chalk.cyan.bold('\n🔍 Profile Validation Summary\n'));
          console.log(chalk.gray(`Total: ${summary.total} | Valid: ${summary.valid} | Invalid: ${summary.invalid}\n`));

          if (Object.keys(summary.byLanguage).length > 0) {
            console.log(chalk.gray('Profiles by Language:'));
            Object.entries(summary.byLanguage).forEach(([lang, count]) => {
              console.log(chalk.gray(`  ${lang}: ${count}`));
            });
            console.log('');
          }

          Object.entries(profiles).forEach(([name, result]) => {
            const status = result.valid ? chalk.green('✓') : chalk.red('✗');
            const lang = result.language ? chalk.gray(`(${result.language})`) : '';
            console.log(`${status} ${name} ${lang}`);

            if (!result.valid && result.errors.length > 0) {
              result.errors.slice(0, 2).forEach(error => {
                console.log(chalk.red(`    ✗ ${error}`));
              });
              if (result.errors.length > 2) {
                console.log(chalk.gray(`    ... and ${result.errors.length - 2} more errors`));
              }
            }

            if (result.warnings.length > 0) {
              result.warnings.slice(0, 1).forEach(warning => {
                console.log(chalk.yellow(`    ⚠ ${warning}`));
              });
              if (result.warnings.length > 1) {
                console.log(chalk.gray(`    ... and ${result.warnings.length - 1} more warnings`));
              }
            }
          });
          console.log('');
        }, 15000);
      })
    );

  profileGroup
    .command('tree <name>')
    .description('Show profile inheritance tree')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Loading profile tree...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { getProfileTree } = await import('../commands/profile');
          const tree = await getProfileTree(name);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n🌳 Profile Inheritance Tree: ${name}\n`));
          printTree(tree, 0);
          console.log('');
        }, 10000);
      })
    );

  profileGroup
    .command('export <name>')
    .description('Export profile with all inherited properties resolved')
    .option('--output <file>', 'Output file path')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Exporting profile "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { exportProfile } = await import('../commands/profile');
          const exported = await exportProfile(name);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n📤 Exported Profile: ${name}\n`));
          console.log(chalk.gray(`Inherits from: ${exported.inheritedFrom.join(', ') || 'None'}\n`));
          console.log(chalk.gray('Final Configuration:'));
          console.log(chalk.gray(JSON.stringify(exported.finalConfig, null, 2)));
          console.log('');

          if (options.output) {
            const fsExtra = await import('fs-extra');
            const pathMod = await import('path');
            const outputPath = pathMod.join(process.cwd(), options.output);
            await fsExtra.writeFile(outputPath, JSON.stringify(exported, null, 2), 'utf8');
            console.log(chalk.green(`✓ Exported to: ${outputPath}\n`));
          }
        }, 10000);
      })
    );

  profileGroup
    .command('status')
    .description('Show current active profile and context status')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Checking profile status...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { getActiveProfileWithContext, validateCurrentContext } = await import('../commands/profile');
          const { profile, context } = await getActiveProfileWithContext();
          const validation = await validateCurrentContext();

          spinner.stop();

          if (!profile) {
            console.log(chalk.yellow('\n⚠ No active profile\n'));
            return;
          }

          console.log(chalk.cyan.bold('\n📌 Active Profile Status\n'));
          console.log(chalk.white(`Profile: ${profile.name}`));
          console.log(chalk.gray(`Environment: ${profile.environment}`));
          if (profile.framework) {
            console.log(chalk.gray(`Framework: ${profile.framework}`));
          }

          if (context) {
            console.log(chalk.gray(`Activated: ${new Date(context.activatedAt).toLocaleString()}`));
            console.log(chalk.gray(`Validated: ${context.validated ? 'Yes' : 'No'}`));
          }

          console.log('');
          console.log(chalk.gray('Validation:'));
          if (validation.valid) {
            console.log(chalk.green('  ✓ Profile context is valid'));
          } else {
            console.log(chalk.red('  ✗ Profile context has issues'));
          }

          if (validation.warnings.length > 0) {
            validation.warnings.forEach(w => {
              console.log(chalk.yellow(`  ⚠ ${w}`));
            });
          }
          console.log('');
        }, 10000);
      })
    );

  profileGroup
    .command('deactivate')
    .description('Deactivate current profile and restore workspace state')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Deactivating profile...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { getActiveProfileWithContext, deactivateProfile } = await import('../commands/profile');
          const { profile, context } = await getActiveProfileWithContext();

          if (!profile || !context) {
            if (spinner) spinner.stop();
            console.log(chalk.yellow('\n⚠ No active profile to deactivate\n'));
            return;
          }

          await deactivateProfile(profile.name);

          spinner.succeed(chalk.green(`Deactivated profile "${profile.name}"`));
          console.log(chalk.gray('\nWorkspace state restored to pre-profile activation\n'));
        }, 10000);
      })
    );

  // --- config profile env ---
  const profileEnvGroup = profileGroup.command('env')
    .description('Manage encrypted environment variables for profiles');

  profileEnvGroup
    .command('add <profile> <name> <value>')
    .description('Add environment variable to profile (with optional encryption)')
    .option('--no-encrypt', 'Store without encryption')
    .option('--description <desc>', 'Variable description')
    .option('--required', 'Mark as required')
    .action(
      createAsyncCommand(async (profileName, varName, value, options) => {
        const { addEnvVariable } = await import('../commands/profile-env');
        await addEnvVariable(profileName, varName, value, {
          encrypt: options.encrypt !== false,
          description: options.description,
          required: options.required,
        });
      })
    );

  profileEnvGroup
    .command('list <profile>')
    .description('List all environment variables for a profile')
    .action(
      createAsyncCommand(async (profileName, options) => {
        const { listEnvVariables } = await import('../commands/profile-env');
        await listEnvVariables(profileName);
      })
    );

  profileEnvGroup
    .command('remove <profile> <name>')
    .description('Remove environment variable from profile')
    .action(
      createAsyncCommand(async (profileName, varName, options) => {
        const { removeEnvVariable } = await import('../commands/profile-env');
        await removeEnvVariable(profileName, varName);
      })
    );

  profileEnvGroup
    .command('export <profile>')
    .description('Export environment variables to .env file')
    .option('--output <file>', 'Output file path', '.env')
    .option('--no-decrypt', 'Export encrypted values without decrypting')
    .action(
      createAsyncCommand(async (profileName, options) => {
        const spinner = createSpinner('Exporting environment variables...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { exportEnvVariables } = await import('../commands/profile-env');
          await exportEnvVariables(profileName, {
            outputPath: options.output,
            decrypt: options.decrypt !== false,
          });
          spinner.stop();
        }, 10000);
      })
    );

  profileEnvGroup
    .command('validate <profile>')
    .description('Validate required environment variables are set')
    .action(
      createAsyncCommand(async (profileName, options) => {
        const spinner = createSpinner('Validating environment variables...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateRequiredEnvVars } = await import('../commands/profile-env');
          const result = await validateRequiredEnvVars(profileName);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n🔍 Environment Variable Validation: ${profileName}\n`));

          if (result.valid) {
            console.log(chalk.green(`✓ All required variables are set\n`));
            console.log(chalk.gray('Present:'));
            result.present.forEach(v => console.log(chalk.gray(`  ✓ ${v}`)));
          } else {
            console.log(chalk.red(`✗ Missing required variables\n`));
            console.log(chalk.red('Missing:'));
            result.missing.forEach(v => console.log(chalk.red(`  ✗ ${v}`)));
            console.log('');
            console.log(chalk.gray('Present:'));
            result.present.forEach(v => console.log(chalk.gray(`  ✓ ${v}`)));
          }
          console.log('');
        }, 10000);
      })
    );

  profileEnvGroup
    .command('migrate [source]')
    .description('Migrate existing .env file to encrypted storage')
    .option('--profile <name>', 'Target profile name', 'production')
    .action(
      createAsyncCommand(async (source = '.env', options) => {
        const spinner = createSpinner('Migrating environment variables...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { migrateToEncryptedStorage } = await import('../commands/profile-env');
          spinner.stop();
          await migrateToEncryptedStorage(source, options.profile);
        }, 10000);
      })
    );

  // --- config profile template ---
  const profileTemplateGroup = profileGroup.command('template')
    .description('Manage profile templates for common scenarios');

  profileTemplateGroup
    .command('list')
    .description('List all available profile templates')
    .action(
      createAsyncCommand(async (options) => {
        const { listTemplates } = await import('../commands/profile-templates');
        listTemplates();
      })
    );

  profileTemplateGroup
    .command('show <id>')
    .description('Show template details')
    .action(
      createAsyncCommand(async (id, options) => {
        const { showTemplate } = await import('../commands/profile-templates');
        showTemplate(id);
      })
    );

  profileTemplateGroup
    .command('apply <id> [name]')
    .description('Apply template to create a new profile')
    .option('--overwrite', 'Overwrite existing profile')
    .action(
      createAsyncCommand(async (id, name, options) => {
        const spinner = createSpinner('Applying template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { applyTemplate } = await import('../commands/profile-templates');
          await applyTemplate(id, name || id, options);
          spinner.stop();
        }, 10000);
      })
    );

  profileTemplateGroup
    .command('search <keyword>')
    .description('Search templates by keyword')
    .action(
      createAsyncCommand(async (keyword, options) => {
        const { searchTemplates } = await import('../commands/profile-templates');
        searchTemplates(keyword);
      })
    );

  // --- config profile clone/customize ---
  profileGroup
    .command('clone <source> <name>')
    .description('Clone an existing profile')
    .option('-d, --description <description>', 'Description for the cloned profile')
    .option('--extend <profiles...>', 'Profiles to extend (comma-separated)')
    .option('--priority <number>', 'Priority for inheritance order')
    .action(async (source, name, options) => {
      const { cloneProfile } = await import('../commands/profile');
      await cloneProfile(source, name, {
        description: options.description,
        extends: options.extend ? options.extend.split(',') : undefined,
        priority: options.priority ? parseInt(options.priority) : undefined,
      });
    });

  profileGroup
    .command('customize <name>')
    .description('Customize an existing profile (interactive mode)')
    .option('-d, --description <description>', 'New description')
    .option('-f, --framework <framework>', 'Framework')
    .option('-e, --environment <environment>', 'Environment (development|staging|production|custom)')
    .option('--build-target <target>', 'Build target (esnext|es2020|es2015)')
    .option('--build-optimize <boolean>', 'Enable build optimization')
    .option('--build-sourcemap <boolean>', 'Enable sourcemaps')
    .option('--build-minify <boolean>', 'Minify output')
    .option('--dev-port <port>', 'Development server port')
    .option('--dev-host <host>', 'Development server host')
    .option('--dev-hmr <boolean>', 'Enable Hot Module Replacement')
    .option('--dev-cors <boolean>', 'Enable CORS')
    .option('--add-env <vars...>', 'Add environment variables (KEY=VALUE)')
    .option('--remove-env <vars...>', 'Remove environment variables')
    .option('--add-script <scripts...>', 'Add scripts (NAME=COMMAND)')
    .option('--add-dependency <deps...>', 'Add dependencies (name@version)')
    .option('--extend-add <profiles...>', 'Add profiles to extend')
    .option('--extend-remove <profiles...>', 'Remove profiles from extends')
    .option('--priority <number>', 'Priority for inheritance order')
    .action(async (name, options) => {
      const { customizeProfile } = await import('../commands/profile');

      const addEnv: Record<string, string> = {};
      if (options.addEnv) {
        for (const envVar of options.addEnv) {
          const [key, ...valueParts] = envVar.split('=');
          if (key && valueParts.length > 0) {
            addEnv[key] = valueParts.join('=');
          }
        }
      }

      const addScript: Record<string, string> = {};
      if (options.addScript) {
        for (const script of options.addScript) {
          const [key, ...valueParts] = script.split('=');
          if (key && valueParts.length > 0) {
            addScript[key] = valueParts.join('=');
          }
        }
      }

      const addDependency: Record<string, string> = {};
      if (options.addDependency) {
        for (const dep of options.addDependency) {
          const match = dep.match(/^(@?[^@]+)@(.+)$/);
          if (match) {
            addDependency[match[1]] = match[2];
          }
        }
      }

      await customizeProfile(name, {
        description: options.description,
        framework: options.framework,
        environment: options.environment,
        buildTarget: options.buildTarget,
        buildOptimize: options.buildOptimize !== undefined ? options.buildOptimize === 'true' : undefined,
        buildSourcemap: options.buildSourcemap !== undefined ? options.buildSourcemap === 'true' : undefined,
        buildMinify: options.buildMinify !== undefined ? options.buildMinify === 'true' : undefined,
        devPort: options.devPort ? parseInt(options.devPort) : undefined,
        devHost: options.devHost,
        devHmr: options.devHmr !== undefined ? options.devHmr === 'true' : undefined,
        devCors: options.devCors !== undefined ? options.devCors === 'true' : undefined,
        addEnv: Object.keys(addEnv).length > 0 ? addEnv : undefined,
        removeEnv: options.removeEnv,
        addScript: Object.keys(addScript).length > 0 ? addScript : undefined,
        addDependency: Object.keys(addDependency).length > 0 ? addDependency : undefined,
        extendAdd: options.extendAdd,
        extendRemove: options.extendRemove,
        priority: options.priority ? parseInt(options.priority) : undefined,
      });
    });

  // --- config profile sync ---
  profileGroup
    .command('sync')
    .description('Synchronize profiles with team via Git or local storage')
    .option('-m, --method <method>', 'Sync method (git|cloud|local)', 'local')
    .option('-r, --remote <remote>', 'Git remote name', 'origin')
    .option('-b, --branch <branch>', 'Git branch name', 'main')
    .option('--force', 'Force overwrite remote changes')
    .option('--strategy <strategy>', 'Conflict resolution strategy (local|remote|merge|manual)', 'merge')
    .action(async (options) => {
      const { syncProfilesGit, syncProfilesLocal } = await import('../commands/profile-sync');

      if (options.method === 'git') {
        await syncProfilesGit({
          method: 'git',
          remote: options.remote,
          branch: options.branch,
          force: options.force,
          strategy: options.strategy,
        });
      } else {
        await syncProfilesLocal({
          method: 'local',
          strategy: options.strategy,
        });
      }
    });

  profileGroup
    .command('export-profiles [profiles...]')
    .description('Export profiles to sync directory')
    .option('-o, --output <path>', 'Output directory path')
    .option('--include-metadata', 'Include export metadata')
    .action(async (profiles, options) => {
      const { exportProfiles } = await import('../commands/profile-sync');
      await exportProfiles(profiles, {
        outputPath: options.output,
        includeMetadata: options.includeMetadata,
      });
    });

  profileGroup
    .command('import [source]')
    .description('Import profiles from sync directory')
    .option('--overwrite', 'Overwrite existing profiles')
    .option('--merge', 'Merge with existing profiles')
    .option('--strategy <strategy>', 'Conflict resolution strategy (local|remote|merge|manual)', 'manual')
    .action(async (source, options) => {
      const { importProfiles } = await import('../commands/profile-sync');
      await importProfiles(source, {
        overwrite: options.overwrite,
        merge: options.merge,
        strategy: options.strategy,
      });
    });

  profileGroup
    .command('sync-status')
    .description('Show profile synchronization status')
    .action(async () => {
      const { showSyncStatus } = await import('../commands/profile-sync');
      await showSyncStatus();
    });

  profileGroup
    .command('resolve-conflicts')
    .description('Interactively resolve profile synchronization conflicts')
    .action(async () => {
      const { resolveConflicts } = await import('../commands/profile-sync');
      await resolveConflicts();
    });

  // --- config profile analytics ---
  profileGroup
    .command('analytics [profile]')
    .description('Show profile analytics dashboard with insights')
    .option('--json', 'Output as JSON')
    .action(async (profile, options) => {
      const { showAnalyticsDashboard } = await import('../commands/profile-analytics');
      await showAnalyticsDashboard(profile);
    });

  profileGroup
    .command('stats')
    .description('Show profile usage statistics')
    .option('--sort <field>', 'Sort by field (name|usage|duration)', 'usage')
    .option('--limit <number>', 'Limit number of results', '10')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .action(async (options) => {
      const { showUsageStatistics } = await import('../commands/profile-analytics');
      await showUsageStatistics({
        sortBy: options.sort,
        limit: parseInt(options.limit),
        format: options.format,
      });
    });

  profileGroup
    .command('clean-analytics')
    .description('Clean old analytics data')
    .option('--days <number>', 'Days to keep', '90')
    .action(async (options) => {
      const { cleanAnalyticsData } = await import('../commands/profile-analytics');
      await cleanAnalyticsData(parseInt(options.days));
    });

  profileGroup
    .command('insights [profile]')
    .description('Generate insights and recommendations for profiles')
    .action(async (profile) => {
      const { generateProfileInsights } = await import('../commands/profile-analytics');
      const insights = await generateProfileInsights(profile);

      if (insights.length === 0) {
        console.log(chalk.cyan('\n✨ No insights to share\n'));
        return;
      }

      console.log(chalk.cyan.bold('\n💡 Insights & Recommendations\n'));

      for (const insight of insights) {
        const severityColor = {
          info: chalk.blue,
          suggestion: chalk.cyan,
          warning: chalk.yellow,
          critical: chalk.red,
        }[insight.severity];

        const icon = {
          info: 'ℹ️',
          suggestion: '💡',
          warning: '⚠️',
          critical: '🔴',
        }[insight.severity];

        console.log(severityColor(`${icon} ${insight.title}`));
        console.log(chalk.gray(`   ${insight.description}`));

        if (insight.recommendation) {
          console.log(chalk.gray(`   → ${insight.recommendation}`));
        }

        if (insight.impact) {
          console.log(chalk.gray(`   Impact: ${insight.impact}`));
        }

        console.log('');
      }
    });

  // --- config profile versioning ---
  profileGroup
    .command('snapshot <profile>')
    .description('Create a snapshot/version of a profile')
    .option('-m, --message <message>', 'Snapshot message')
    .option('-t, --tags <tags...>', 'Tags for the snapshot')
    .action(async (profile, options) => {
      const { createProfileVersion } = await import('../commands/profile-version');
      await createProfileVersion(profile, {
        message: options.message,
        tags: options.tags,
      });
    });

  profileGroup
    .command('history <profile>')
    .description('Show version history of a profile')
    .action(async (profile) => {
      const { listProfileVersions } = await import('../commands/profile-version');
      await listProfileVersions(profile);
    });

  profileGroup
    .command('rollback <profile> <version>')
    .description('Rollback profile to a specific version')
    .option('-f, --force', 'Skip confirmation')
    .option('--no-backup', 'Don\'t create backup before rollback')
    .action(async (profile, version, options) => {
      const { rollbackProfile } = await import('../commands/profile-version');
      await rollbackProfile(profile, version, {
        force: options.force,
        createBackup: options.backup,
      });
    });

  profileGroup
    .command('diff <profile> <version1> [version2]')
    .description('Compare two versions of a profile')
    .action(async (profile, version1, version2) => {
      const { compareProfileVersions } = await import('../commands/profile-version');
      await compareProfileVersions(profile, version1, version2);
    });

  profileGroup
    .command('cleanup-versions [profile]')
    .description('Clean up old profile versions')
    .option('--keep <number>', 'Number of versions to keep', '10')
    .option('--before <date>', 'Delete versions before this date (ISO format)')
    .option('--auto-only', 'Only delete auto-generated snapshots')
    .action(async (profile, options) => {
      const { cleanupOldVersions } = await import('../commands/profile-version');
      await cleanupOldVersions(profile, {
        keep: parseInt(options.keep),
        before: options.before,
        autoOnly: options.autoOnly,
      });
    });

  // --- config profile optimize ---
  profileGroup
    .command('optimize <profile>')
    .description('Generate optimization recommendations for a profile')
    .option('--apply <ids...>', 'Apply specific recommendations by ID')
    .option('--auto', 'Auto-apply safe optimizations')
    .action(async (profile, options) => {
      const { showOptimizationReport, applyOptimizations, autoOptimizeProfile } = await import('../commands/profile-optimize');

      if (options.auto) {
        await autoOptimizeProfile(profile);
      } else if (options.apply) {
        await applyOptimizations(profile, options.apply);
      } else {
        await showOptimizationReport(profile);
      }
    });

  program.addCommand(config);
}
