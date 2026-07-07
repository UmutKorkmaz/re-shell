// Auto-generated Incident Response Utility
// Generated at: 2026-01-13T13:50:00.000Z

import chalk from 'chalk';

type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'detected' | 'investigating' | 'mitigating' | 'resolved' | 'postmortem';
type NotificationChannel = 'slack' | 'email' | 'sms' | 'pagerduty' | 'webhook' | 'teams';
type Role = 'incident-commander' | 'communications-lead' | 'technical-lead' | 'scribe' | 'investigator';

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedAt: number;
  resolvedAt?: number;
  assignedTo: { [role: string]: string };
  affectedServices: string[];
  impact: { users: number; regions: string[] };
}

interface TimelineEntry {
  id: string;
  incidentId: string;
  timestamp: number;
  author: string;
  type: 'status-update' | 'action' | 'decision' | 'milestone';
  content: string;
  attachments: string[];
}

interface CommunicationRule {
  id: string;
  name: string;
  trigger: string;
  channels: NotificationChannel[];
  template: string;
  recipients: string[];
}

interface EscalationPolicy {
  id: string;
  name: string;
  levels: {
    level: number;
    wait: number;
    assignTo: string[];
    notify: NotificationChannel[];
  }[];
}

interface IncidentResponseConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  incidents: Incident[];
  timeline: TimelineEntry[];
  communicationRules: CommunicationRule[];
  escalationPolicies: EscalationPolicy[];
  enableAutoDetection: boolean;
  enableAutoEscalation: boolean;
  enablePostmortem: boolean;
}

/**
 * Prints a human-readable summary of the incident response configuration to the
 * console, including project name, providers, counts of incidents, timeline
 * entries, communication rules, escalation policies, and feature toggles.
 *
 * @param config - The incident response configuration to display.
 * @returns No return value; output is written to the console.
 */
export function displayConfig(config: IncidentResponseConfig): void {
  console.log(chalk.cyan('🚨 Collaborative Incident Response'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Incidents:'), config.incidents.length);
  console.log(chalk.yellow('Timeline Entries:'), config.timeline.length);
  console.log(chalk.yellow('Communication Rules:'), config.communicationRules.length);
  console.log(chalk.yellow('Escalation Policies:'), config.escalationPolicies.length);
  console.log(chalk.yellow('Auto Detection:'), config.enableAutoDetection ? 'Yes' : 'No');
  console.log(chalk.yellow('Auto Escalation:'), config.enableAutoEscalation ? 'Yes' : 'No');
  console.log(chalk.yellow('Postmortem:'), config.enablePostmortem ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown document describing the features of the collaborative
 * incident response setup (severity levels, status tracking, roles, timeline,
 * notifications, escalation, impact assessment, etc.).
 *
 * @param config - The incident response configuration used to scope the document.
 * @returns A Markdown string summarizing the incident response features.
 */
export function generateIncidentResponseMD(config: IncidentResponseConfig): string {
  let md = '# Collaborative Incident Response\n\n';
  md += '## Features\n\n';
  md += '- Incident severity levels (low, medium, high, critical)\n';
  md += '- Incident status tracking (detected, investigating, mitigating, resolved, postmortem)\n';
  md += '- Role-based assignment (incident commander, communications lead, technical lead, scribe, investigator)\n';
  md += '- Timeline tracking with status updates, actions, decisions, milestones\n';
  md += '- Multi-channel notifications (Slack, email, SMS, PagerDuty, webhook, Teams)\n';
  md += '- Escalation policies with configurable levels and wait times\n';
  md += '- Impact assessment (users affected, regions)\n';
  md += '- Affected services tracking\n';
  md += '- Automatic incident detection\n';
  md += '- Automatic escalation\n';
  md += '- Postmortem generation\n';
  md += '- Team coordination and communication\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header snippet for the incident response setup,
 * including the project name and the generation timestamp.
 *
 * @param config - The incident response configuration providing the project name.
 * @returns A string containing Terraform code header comments.
 */
export function generateTerraformIncidentResponse(config: IncidentResponseConfig): string {
  let code = '# Auto-generated Incident Response Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript module that defines an `IncidentResponseManager`
 * class extending `EventEmitter`, along with a default exported instance.
 * The module header includes the project name and generation timestamp.
 *
 * @param config - The incident response configuration providing the project name.
 * @returns A string containing the TypeScript source code for the manager.
 */
export function generateTypeScriptIncidentResponse(config: IncidentResponseConfig): string {
  let code = '// Auto-generated Incident Response Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class IncidentResponseManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const incidentResponseManager = new IncidentResponseManager();\n';
  code += 'export default incidentResponseManager;\n';
  return code;
}

/**
 * Generates a Python module that defines an `IncidentResponseManager` class
 * with an `__init__` accepting a project name, along with a module-level
 * instance. The module header includes the project name and timestamp.
 *
 * @param config - The incident response configuration providing the project name.
 * @returns A string containing the Python source code for the manager.
 */
export function generatePythonIncidentResponse(config: IncidentResponseConfig): string {
  let code = '# Auto-generated Incident Response Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class IncidentResponseManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'incident_response_manager = IncidentResponseManager()\n';
  return code;
}

/**
 * Writes the generated incident response artifacts to the specified output
 * directory. Always writes the Terraform file, the Markdown documentation,
 * and a JSON config file. Depending on the chosen language, also writes the
 * TypeScript manager (plus package.json) or the Python manager (plus
 * requirements.txt).
 *
 * @param config - The incident response configuration to serialize and emit.
 * @param outputDir - The target directory where files will be written. It is
 *   created if it does not already exist.
 * @param language - The implementation language to generate; `'typescript'`
 *   emits TypeScript sources, any other value emits Python sources.
 * @returns A promise that resolves once all files have been written.
 * @throws Rejected promise from the underlying `fs-extra` operations if any
 *   file or directory operation fails.
 */
export async function writeFiles(config: IncidentResponseConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformIncidentResponse(config);
  await fs.writeFile(path.join(outputDir, 'incident-response.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptIncidentResponse(config);
    await fs.writeFile(path.join(outputDir, 'incident-response-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-incident-response',
      version: '1.0.0',
      description: 'Collaborative Incident Response',
      main: 'incident-response-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonIncidentResponse(config);
    await fs.writeFile(path.join(outputDir, 'incident_response_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'slack-sdk>=3.0.0', 'pagerduty>=3.0.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateIncidentResponseMD(config);
  await fs.writeFile(path.join(outputDir, 'INCIDENT_RESPONSE.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    incidents: config.incidents,
    timeline: config.timeline,
    communicationRules: config.communicationRules,
    escalationPolicies: config.escalationPolicies,
    enableAutoDetection: config.enableAutoDetection,
    enableAutoEscalation: config.enableAutoEscalation,
    enablePostmortem: config.enablePostmortem,
  };
  await fs.writeFile(path.join(outputDir, 'incident-response-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided incident response configuration unchanged. Acts as an
 * identity passthrough / validation anchor for the configuration.
 *
 * @param config - The incident response configuration to return.
 * @returns The same incident response configuration instance that was passed in.
 */
export function incidentResponse(config: IncidentResponseConfig): IncidentResponseConfig {
  return config;
}
