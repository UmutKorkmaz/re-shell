import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security bcp` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerBcp(security: Command): void {
  security
  .command('bcp')
  .description('Generate business continuity and disaster recovery planning with automated testing')
  .argument('<name>', 'Name of the BCP project')
  .option('--organization <name>', 'Organization name', 'Acme Corp')
  .option('--auto-bia', 'Enable automated BIA updates')
  .option('--bia-frequency <frequency>', 'BIA update frequency (monthly, quarterly, semi-annual, annual)', 'quarterly')
  .option('--require-dr-testing', 'Require DR testing')
  .option('--dr-test-frequency <frequency>', 'DR test frequency (monthly, quarterly, semi-annual, annual)', 'quarterly')
  .option('--min-test-score <score>', 'Minimum test score 0-100', '80')
  .option('--enable-automated-testing', 'Enable automated DR testing')
  .option('--test-types <types>', 'Test types (comma-separated: tabletop,simulation,parallel,full-interruption)', 'tabletop,simulation,parallel')
  .option('--require-plan-approval', 'Require plan approval')
  .option('--approvers <emails>', 'Approvers (comma-separated emails)', 'ciso@acme.com,coo@acme.com')
  .option('--rto-variance <percentage>', 'RTO variance threshold percentage', '10')
  .option('--rpo-variance <percentage>', 'RPO variance threshold percentage', '5')
  .option('--enable-risk-monitoring', 'Enable risk monitoring')
  .option('--risk-review-frequency <frequency>', 'Risk review frequency (monthly, quarterly, semi-annual)', 'quarterly')
  .option('--notify-anomalies', 'Notify on anomalies')
  .option('--notification-channels <channels>', 'Notification channels (comma-separated: email,slack,teams,sms)', 'email,slack')
  .option('--enable-compliance-reporting', 'Enable compliance reporting')
  .option('--compliance-frameworks <frameworks>', 'Compliance frameworks (comma-separated: iso-22301,soc-2,pci-dss,hipaa)', 'iso-22301,soc-2')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './bcp-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeBCPFiles, displayBCPConfig, createExampleBCPConfig } = await import('../../utils/business-continuity.js');

    const providers: Array<'aws' | 'azure' | 'gcp'> = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const testTypes = options.testTypes.split(',').map((t: string) => t.trim()) as Array<'tabletop' | 'simulation' | 'parallel' | 'full-interruption'>;
    const notificationChannels = options.notificationChannels.split(',').map((c: string) => c.trim()) as Array<'email' | 'slack' | 'teams' | 'sms'>;
    const complianceFrameworks = options.complianceFrameworks.split(',').map((f: string) => f.trim()) as Array<'iso-22301' | 'soc-2' | 'pci-dss' | 'hipaa' | 'custom'>;
    const approvers = options.approvers.split(',').map((a: string) => a.trim());

    const finalConfig = createExampleBCPConfig();
    finalConfig.projectName = name;
    finalConfig.organization = options.organization;
    finalConfig.providers = providers.length > 0 ? providers : ['aws'];
    finalConfig.settings = {
      autoBIAUpdate: options.autoBia === true,
      biaUpdateFrequency: options.biaFrequency,
      requireDRTesting: options.requireDrTesting !== false,
      drTestFrequency: options.drTestFrequency,
      minTestScore: parseInt(options.minTestScore),
      enableAutomatedTesting: options.enableAutomatedTesting === true,
      testTypes,
      requirePlanApproval: options.requirePlanApproval !== false,
      approvers,
      rtoVarianceThreshold: parseInt(options.rtoVariance),
      rpoVarianceThreshold: parseInt(options.rpoVariance),
      enableRiskMonitoring: options.enableRiskMonitoring === true,
      riskReviewFrequency: options.riskReviewFrequency,
      notifyOnAnomalies: options.notifyAnomalies === true,
      notificationChannels,
      enableComplianceReporting: options.enableComplianceReporting === true,
      complianceFrameworks,
    };

    displayBCPConfig(finalConfig, options.language, options.output);

    await writeBCPFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: terraform/${providers.join('/main.tf, terraform/')}/main.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'bc-manager.ts' : 'bc_manager.py'}`));
    console.log(chalk.green('✅ Generated: BCP_GUIDE.md'));
    console.log(chalk.green('✅ Generated: bcp-config.json\n'));

    console.log(chalk.green('✓ Business continuity planning configured successfully!'));
  }));

}
