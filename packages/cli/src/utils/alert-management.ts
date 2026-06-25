// Auto-generated Alert Management Utility
// Generated at: 2026-01-13T12:40:00.000Z

import chalk from 'chalk';
type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';
type ChannelType = 'email' | 'slack' | 'pagerduty' | 'sms' | 'webhook';
type IncidentStatus = 'open' | 'acknowledged' | 'resolved' | 'closed';
type EscalationAction = 'notify' | 'page' | 'email' | 'call';

interface AlertConfig {
  enabled: boolean;
  name: string;
  condition: string;
  severity: AlertSeverity;
  cooldown: number;
  threshold: number;
}

interface NotificationChannel {
  name: string;
  type: ChannelType;
  config: { [key: string]: string };
  enabled: boolean;
}

interface EscalationRule {
  name: string;
  trigger: string;
  levels: {
    level: number;
    wait: number;
    action: EscalationAction;
    target: string;
  }[];
}

interface IncidentWorkflow {
  name: string;
  triggers: string[];
  actions: { type: string; params: { [key: string]: unknown } }[];
  autoResolve: boolean;
  resolveAfter: number;
}

interface AlertManagementConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  alerts: AlertConfig[];
  channels: NotificationChannel[];
  escalations: EscalationRule[];
  workflows: IncidentWorkflow[];
  enableAutoRemediation: boolean;
  enableIncidentTracking: boolean;
  enablePostmortem: boolean;
}

export function displayConfig(config: AlertManagementConfig): void {
  console.log(chalk.cyan('🚨 Custom Alerting and Incident Management with Escalation and Automation'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Alerts:'), config.alerts.length);
  console.log(chalk.yellow('Notification Channels:'), config.channels.length);
  console.log(chalk.yellow('Escalation Rules:'), config.escalations.length);
  console.log(chalk.yellow('Incident Workflows:'), config.workflows.length);
  console.log(chalk.yellow('Auto-Remediation:'), config.enableAutoRemediation ? 'Yes' : 'No');
  console.log(chalk.yellow('Incident Tracking:'), config.enableIncidentTracking ? 'Yes' : 'No');
  console.log(chalk.yellow('Postmortem Generation:'), config.enablePostmortem ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

export function generateAlertManagementMD(config: AlertManagementConfig): string {
  let md = '# Custom Alerting and Incident Management\n\n';
  md += '## Features\n\n';
  md += '- Custom alert rules with severity levels\n';
  md += '- Multi-channel notifications (email, Slack, PagerDuty, SMS, webhooks)\n';
  md += '- Escalation policies with multiple levels\n';
  md += '- Incident workflows with automation\n';
  md += '- Auto-remediation actions\n';
  md += '- Incident tracking and status management\n';
  md += '- Postmortem generation\n';
  md += '- Alert deduplication and grouping\n';
  md += '- On-call scheduling\n';
  md += '- Integration with cloud providers\n';
  md += '- Custom action scripts and webhooks\n\n';
  return md;
}

export function generateTerraformAlertManagement(config: AlertManagementConfig): string {
  let code = '# Auto-generated Alert Management Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

export function generateTypeScriptAlertManagement(config: AlertManagementConfig): string {
  let code = '// Auto-generated Alert Management Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class AlertManagementManager extends EventEmitter {\n';
  code += '  constructor(options: unknown = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const alertManagementManager = new AlertManagementManager();\n';
  code += 'export default alertManagementManager;\n';
  return code;
}

export function generatePythonAlertManagement(config: AlertManagementConfig): string {
  let code = '# Auto-generated Alert Management Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class AlertManagementManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'alert_management_manager = AlertManagementManager()\n';
  return code;
}

export async function writeFiles(config: AlertManagementConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformAlertManagement(config);
  await fs.writeFile(path.join(outputDir, 'alert-management.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptAlertManagement(config);
    await fs.writeFile(path.join(outputDir, 'alert-management-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-alert-management',
      version: '1.0.0',
      description: 'Custom Alerting and Incident Management',
      main: 'alert-management-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonAlertManagement(config);
    await fs.writeFile(path.join(outputDir, 'alert_management_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'pagerduty>=2.2.0', 'slack-sdk>=3.0.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateAlertManagementMD(config);
  await fs.writeFile(path.join(outputDir, 'ALERT_MANAGEMENT.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    alerts: config.alerts,
    channels: config.channels,
    escalations: config.escalations,
    workflows: config.workflows,
    enableAutoRemediation: config.enableAutoRemediation,
    enableIncidentTracking: config.enableIncidentTracking,
    enablePostmortem: config.enablePostmortem,
  };
  await fs.writeFile(path.join(outputDir, 'alert-management-config.json'), JSON.stringify(configJson, null, 2));
}

export function alertManagement(config: AlertManagementConfig): AlertManagementConfig {
  return config;
}
