import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';
import { buildRbacConfig } from './rbac-config';

/**
 * Registers the `security rbac` subcommand.
 * The large config literal lives in ./rbac-config to keep this module small.
 */
export function registerRbac(security: Command): void {
  security
  .command('rbac')
  .description('Generate RBAC and access control management with fine-grained permissions')
  .argument('<name>', 'Name of the RBAC project')
  .option('--fine-grained', 'Enable fine-grained permissions')
  .option('--default-deny', 'Enable default deny all policy')
  .option('--require-mfa', 'Require MFA for admin operations')
  .option('--session-timeout <minutes>', 'Session timeout in minutes', '60')
  .option('--enable-cache', 'Enable permission caching')
  .option('--cache-ttl <minutes>', 'Cache TTL in minutes', '15')
  .option('--enable-audit', 'Enable audit logging')
  .option('--audit-retention <days>', 'Audit log retention in days', '90')
  .option('--enable-hierarchy', 'Enable role hierarchy')
  .option('--max-depth <depth>', 'Maximum role hierarchy depth', '5')
  .option('--enable-temporary', 'Enable temporary access')
  .option('--temp-max-hours <hours>', 'Maximum temporary access hours', '24')
  .option('--enable-ip-restrictions', 'Enable IP-based restrictions')
  .option('--enable-time-restrictions', 'Enable time-based restrictions')
  .option('--enable-context-aware', 'Enable context-aware access')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './rbac-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeRBACFiles, displayRBACConfig } = await import('../../utils/rbac-manager.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = buildRbacConfig(name, providers, options);

    displayRBACConfig(finalConfig);

    await writeRBACFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: rbac-${providers.join('.tf, rbac-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'rbac-manager.ts' : 'rbac_manager.py'}`));
    console.log(chalk.green('✅ Generated: RBAC.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: rbac-config.json\n'));

    console.log(chalk.green('✓ RBAC and access control management configured successfully!'));
  }));
}
