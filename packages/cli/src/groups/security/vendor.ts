import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';
import { buildVendorConfig } from './vendor-config';

/**
 * Registers the `security vendor` subcommand.
 * The large config literal lives in ./vendor-config (+ ./vendor-fixtures) to
 * keep this module small.
 */
export function registerVendor(security: Command): void {
  security
  .command('vendor')
  .description('Generate vendor security assessment and management with scorecards')
  .argument('<name>', 'Name of the vendor assessment project')
  .option('--auto-assess', 'Enable automated vendor assessment')
  .option('--assessment-frequency <frequency>', 'Assessment frequency (monthly, quarterly, semi-annual, annual, on-demand)', 'quarterly')
  .option('--risk-threshold <threshold>', 'Risk threshold 0-100', '60')
  .option('--enable-monitoring', 'Enable continuous monitoring')
  .option('--monitoring-interval <days>', 'Monitoring interval in days', '30')
  .option('--enable-questionnaires', 'Enable security questionnaires')
  .option('--questionnaire-template <template>', 'Questionnaire template', 'sig')
  .option('--enable-scorecards', 'Enable security scorecards')
  .option('--enable-findings', 'Enable finding tracking')
  .option('--finding-retention <days>', 'Finding retention period in days', '2555')
  .option('--require-soc2', 'Require SOC 2 certification')
  .option('--require-iso27001', 'Require ISO 27001 certification')
  .option('--require-hipaa', 'Require HIPAA certification')
  .option('--require-pcidss', 'Require PCI DSS certification')
  .option('--require-gdpr', 'Require GDPR compliance')
  .option('--enable-benchmarking', 'Enable industry benchmarking')
  .option('--benchmark-industry <industry>', 'Benchmark industry', 'technology')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './vendor-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeVendorFiles, displayVendorConfig } = await import('../../utils/vendor-assessment.js');

    const providers: Array<'aws' | 'azure' | 'gcp'> = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = buildVendorConfig(name, providers, options);

    displayVendorConfig(finalConfig, options.language, options.output);

    await writeVendorFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: vendor-${providers.join('.tf, vendor-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'vendor-manager.ts' : 'vendor_manager.py'}`));
    console.log(chalk.green('✅ Generated: VENDOR_ASSESSMENT.md'));
    console.log(chalk.green('✅ Generated: config.example.json\n'));

    console.log(chalk.green('✓ Vendor security assessment configured successfully!'));
  }));
}
