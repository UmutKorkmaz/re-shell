import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab incident-response` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerIncidentResponse(collab: Command): void {
  collab
  .command('incident-response')
  .description('Generate collaborative incident response with team coordination and communication')
  .argument('<name>', 'Name of the incident response setup')
  .option('--enable-auto-detection', 'Enable automatic incident detection')
  .option('--enable-auto-escalation', 'Enable automatic escalation')
  .option('--enable-postmortem', 'Enable postmortem generation')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './incident-response')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/incident-response.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      incidents: [
        {
          id: 'inc1',
          title: 'Database Connection Pool Exhausted',
          description: 'All database connections are exhausted, causing service degradation',
          severity: 'critical' as const,
          status: 'investigating' as const,
          detectedAt: Date.now() - 3600000,
          assignedTo: { 'incident-commander': 'user1', 'technical-lead': 'user2', 'scribe': 'user3' },
          affectedServices: ['api', 'web', 'auth'],
          impact: { users: 50000, regions: ['us-east-1', 'eu-west-1'] },
        },
        {
          id: 'inc2',
          title: 'High API Latency',
          description: 'API response times increased from 100ms to 2s',
          severity: 'high' as const,
          status: 'mitigating' as const,
          detectedAt: Date.now() - 7200000,
          resolvedAt: Date.now() - 1800000,
          assignedTo: { 'incident-commander': 'user4', 'technical-lead': 'user5' },
          affectedServices: ['api'],
          impact: { users: 15000, regions: ['us-west-2'] },
        },
      ],
      timeline: [
        { id: 't1', incidentId: 'inc1', timestamp: Date.now() - 3600000, author: 'user1', type: 'status-update' as const, content: 'Incident detected - database connections exhausted', attachments: [] },
        { id: 't2', incidentId: 'inc1', timestamp: Date.now() - 3000000, author: 'user2', type: 'action' as const, content: 'Restarted database connection pool', attachments: ['logs.txt'] },
        { id: 't3', incidentId: 'inc1', timestamp: Date.now() - 1800000, author: 'user1', type: 'decision' as const, content: 'Decided to increase pool size from 50 to 100', attachments: [] },
      ],
      communicationRules: [
        { id: 'cr1', name: 'Critical Incident Alert', trigger: 'severity == critical', channels: ['slack', 'pagerduty', 'sms'] as ('slack' | 'pagerduty' | 'sms' | 'email' | 'webhook' | 'teams')[], template: 'Critical incident detected: {{title}}', recipients: ['oncall'] },
        { id: 'cr2', name: 'Status Update', trigger: 'status changed', channels: ['slack', 'email'] as ('slack' | 'pagerduty' | 'sms' | 'email' | 'webhook' | 'teams')[], template: 'Incident status updated: {{status}}', recipients: ['stakeholders'] },
      ],
      escalationPolicies: [
        {
          id: 'ep1',
          name: 'Default Escalation',
          levels: [
            { level: 1, wait: 300, assignTo: ['oncall'], notify: ['slack', 'pagerduty'] as ('slack' | 'pagerduty' | 'sms' | 'email' | 'webhook' | 'teams')[] },
            { level: 2, wait: 900, assignTo: ['manager'], notify: ['slack', 'sms'] as ('slack' | 'pagerduty' | 'sms' | 'email' | 'webhook' | 'teams')[] },
            { level: 3, wait: 1800, assignTo: ['vp'], notify: ['slack', 'sms', 'email'] as ('slack' | 'pagerduty' | 'sms' | 'email' | 'webhook' | 'teams')[] },
          ],
        },
      ],
      enableAutoDetection: options.enableAutoDetection || false,
      enableAutoEscalation: options.enableAutoEscalation || false,
      enablePostmortem: options.enablePostmortem || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating incident response configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: incident-response.tf`));
      console.log(chalk.green(`✅ Generated: incident-response-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: INCIDENT_RESPONSE.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: incident-response-config.json\n`));

      console.log(chalk.green('✓ Incident response configuration generated successfully!'));
    }, 30000);
  }));

// Developer productivity commands
}
