import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security governance` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerGovernance(security: Command): void {
  security
  .command('governance')
  .description('Generate governance policy management with workflow automation and approvals')
  .argument('<name>', 'Name of the governance project')
  .option('--organization <name>', 'Organization name', 'Acme Corp')
  .option('--require-approval', 'Require policy approval')
  .option('--required-approvers <number>', 'Number of required approvers', '2')
  .option('--auto-routing', 'Enable automatic routing')
  .option('--enable-escalation', 'Enable escalation')
  .option('--escalation-timeout <hours>', 'Escalation timeout in hours', '48')
  .option('--enable-notifications', 'Enable notifications')
  .option('--notification-channels <channels>', 'Notification channels (comma-separated: email,slack,teams,webhook)', 'email,slack')
  .option('--enable-audit-logging', 'Enable audit logging')
  .option('--audit-retention <days>', 'Audit retention period in days', '2555')
  .option('--enable-compliance-checks', 'Enable automated compliance checks')
  .option('--compliance-frequency <frequency>', 'Compliance check frequency (daily, weekly, monthly)', 'weekly')
  .option('--enable-violation-tracking', 'Enable violation tracking')
  .option('--auto-remediation', 'Enable automatic remediation')
  .option('--policy-versioning', 'Enable policy versioning')
  .option('--require-policy-review', 'Require periodic policy review')
  .option('--review-frequency <frequency>', 'Policy review frequency (monthly, quarterly, semi-annual, annual)', 'annual')
  .option('--enable-workflow-automation', 'Enable workflow automation')
  .option('--workflow-timeout <days>', 'Workflow timeout in days', '14')
  .option('--allow-delegation', 'Allow approval delegation')
  .option('--require-comments', 'Require comments on approvals')
  .option('--enable-reporting', 'Enable reporting')
  .option('--report-frequency <frequency>', 'Report frequency (weekly, monthly, quarterly)', 'monthly')
  .option('--stakeholders <emails>', 'Stakeholder emails (comma-separated)', 'ciso@acme.com,compliance@acme.com,legal@acme.com')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './governance-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeGovernanceFiles, displayGovernanceConfig, createExampleGovernanceConfig } = await import('../../utils/governance-policy.js');

    const providers: Array<'aws' | 'azure' | 'gcp'> = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const notificationChannels = options.notificationChannels.split(',').map((c: string) => c.trim());
    const stakeholders = options.stakeholders.split(',').map((s: string) => s.trim());

    const finalConfig = createExampleGovernanceConfig();
    finalConfig.projectName = name;
    finalConfig.organization = options.organization;
    finalConfig.providers = providers.length > 0 ? providers : ['aws'];
    finalConfig.settings = {
      requireApproval: options.requireApproval !== false,
      requiredApprovers: parseInt(options.requiredApprovers),
      autoRouting: options.autoRouting === true,
      enableEscalation: options.enableEscalation !== false,
      escalationTimeout: parseInt(options.escalationTimeout),
      enableNotifications: options.enableNotifications !== false,
      notificationChannels: notificationChannels as Array<'email' | 'slack' | 'teams' | 'webhook'>,
      enableAuditLogging: options.enableAuditLogging !== false,
      auditRetentionDays: parseInt(options.auditRetention),
      enableComplianceChecks: options.enableComplianceChecks !== false,
      complianceCheckFrequency: options.complianceFrequency,
      enableViolationTracking: options.enableViolationTracking !== false,
      autoRemediation: options.autoRemediation === true,
      policyVersioning: options.policyVersioning !== false,
      requirePolicyReview: options.requirePolicyReview !== false,
      policyReviewFrequency: options.reviewFrequency,
      enableWorkflowAutomation: options.enableWorkflowAutomation !== false,
      workflowTimeout: parseInt(options.workflowTimeout),
      allowDelegation: options.allowDelegation === true,
      requireComments: options.requireComments !== false,
      enableReporting: options.enableReporting !== false,
      reportFrequency: options.reportFrequency,
      stakeholders,
    };

    displayGovernanceConfig(finalConfig, options.language, options.output);

    await writeGovernanceFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: terraform/${providers.join('/main.tf, terraform/')}/main.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'governance-manager.ts' : 'governance_manager.py'}`));
    console.log(chalk.green('✅ Generated: GOVERNANCE_GUIDE.md'));
    console.log(chalk.green('✅ Generated: governance-config.json\n'));

    console.log(chalk.green('✓ Governance policy management configured successfully!'));
  }));

}
