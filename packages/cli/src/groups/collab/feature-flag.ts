import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab feature-flag` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerFeatureFlag(collab: Command): void {
  collab
  .command('feature-flag')
  .description('Generate feature flag management system with A/B testing and gradual rollout')
  .argument('<name>', 'Name of the feature flag project')
  .option('--organization <name>', 'Organization name', 'Acme Corp')
  .option('--description <description>', 'Project description')
  .option('--enable-persistence', 'Enable data persistence')
  .option('--enable-audit-log', 'Enable audit logging')
  .option('--enable-analytics', 'Enable analytics')
  .option('--storage <backend>', 'Storage backend (memory, redis, database)', 'memory')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './feature-flag-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const {
      writeFeatureFlagFiles,
      displayFeatureFlagConfig,
      createExampleFeatureFlagConfig
    } = await import('../../utils/feature-flag.js');

    const config = createExampleFeatureFlagConfig();
    config.organization = options.organization;
    config.description = options.description;
    config.enablePersistence = options.enablePersistence === true;
    config.enableAuditLog = options.enableAuditLog === true;
    config.enableAnalytics = options.enableAnalytics === true;
    config.storageBackend = options.storage;

    displayFeatureFlagConfig(config, options.language, options.output);

    await writeFeatureFlagFiles(config, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'feature-flag-manager.ts' : 'feature_flag_manager.py'}`));
    console.log(chalk.green('✅ Generated: FEATURE_FLAG_GUIDE.md'));
    console.log(chalk.green('✅ Generated: feature-flag-config.json'));
    console.log(chalk.green('✅ Generated: terraform/provider/main.tf\n'));

    console.log(chalk.green('✓ Feature flag management system configured successfully!'));
  }));
}
