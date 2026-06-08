import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';

/**
 * Registers the `config unified` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerUnifiedGroup(config: Command): void {
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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
        const { createUnifiedConfig } = await import('../../utils/unified-config');
        const { createSpinner } = await import('../../utils/spinner');

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
}
