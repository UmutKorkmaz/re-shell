// Security Incident Management and Forensics with Automated Investigation

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type IncidentType = 'malware' | 'phishing' | 'data-breach' | 'ddos' | 'insider-threat' | 'ransomware' | 'social-engineering' | 'zero-day' | 'misconfiguration' | 'custom';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'containing' | 'eradication' | 'recovery' | 'closed' | 'false-positive';
export type IncidentPhase = 'identification' | 'triage' | 'containment' | 'investigation' | 'eradication' | 'recovery' | 'post-incident' | 'closed';
export type Priority = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
export type InvestigationStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped';
export type ArtifactType = 'log' | 'screenshot' | 'memory-dump' | 'network-capture' | 'disk-image' | 'file' | 'registry' | 'process-list' | 'email' | 'chat' | 'custom';
export type EvidenceType = 'digital' | 'physical' | 'testimony' | 'documentation' | 'custom';
export type PlaybookStatus = 'draft' | 'active' | 'deprecated' | 'archived';

export interface IncidentManagementConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: ManagementSettings;
  incidents: Incident[];
  playbooks: IncidentPlaybook[];
  investigations: Investigation[];
  artifacts: ForensicArtifact[];
  evidence: Evidence[];
  communications: IncidentCommunication[];
  analytics: IncidentAnalytics[];
  integrations: IncidentIntegration[];
}

export interface ManagementSettings {
  autoTriage: boolean;
  autoContainment: boolean;
  autoInvestigation: boolean;
  investigationDepth: 'basic' | 'standard' | 'comprehensive';
  evidenceCollection: 'manual' | 'semi-automated' | 'fully-automated';
  retentionPeriod: number; // days
  slaResponseTime: Record<Priority, number>; // minutes
  slaResolutionTime: Record<Priority, number>; // minutes
  notificationChannels: string[];
  escalationRules: EscalationRule[];
  approvalRequired: boolean;
  approvers: string[];
  forensicImaging: boolean;
  chainOfCustody: boolean;
  legalHold: boolean;
  reportGeneration: boolean;
  postmortemRequired: boolean;
  postmortemTemplate?: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  conditions: EscalationCondition[];
  actions: EscalationAction[];
  escalateTo: string[];
  notifyChannels: string[];
}

export interface EscalationCondition {
  field: 'severity' | 'priority' | 'age' | 'affectedUsers' | 'dataLoss';
  operator: 'equals' | 'greater-than' | 'less-than' | 'contains';
  value: any;
}

export interface EscalationAction {
  type: 'notify' | 'escalate' | 'auto-remediate' | 'declare-incident';
  target: string;
  message?: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  phase: IncidentPhase;
  priority: Priority;
  confidence: number; // 0-1
  detectedAt: Date;
  reportedBy: string;
  assignedTo: string;
  team: string[];
  watchers: string[];
  affectedAssets: AffectedAssetIncident[];
  indicators: IncidentIndicator[];
  timeline: IncidentTimelineEntry[];
  containmentStrategy?: string;
  eradicationPlan?: string;
  recoverySteps: string[];
  rootCause?: string;
  lessonsLearned?: string[];
  tags: string[];
  metadata: Record<string, any>;
  sla?: {
    responseDeadline: Date;
    resolutionDeadline: Date;
    responseMet: boolean;
    resolutionMet: boolean;
  };
}

export interface AffectedAssetIncident {
  id: string;
  name: string;
  type: 'server' | 'workstation' | 'database' | 'application' | 'user' | 'network' | 'storage';
  impact: 'critical' | 'high' | 'medium' | 'low';
  compromiseLevel: 'confirmed' | 'suspected' | 'none';
  isolationStatus: 'isolated' | 'partial' | 'none';
  forensicImage?: boolean;
  evidenceCollected: number;
}

export interface IncidentIndicator {
  id: string;
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'file' | 'certificate' | 'process' | 'registry' | 'custom';
  value: string;
  description: string;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  source: string;
  iocType?: 'file-hash' | 'ip-address' | 'domain-name' | 'url' | 'email-address';
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  phase: IncidentPhase;
  action: string;
  actor: string;
  description: string;
  evidence: string[];
  automated: boolean;
}

export interface IncidentPlaybook {
  id: string;
  name: string;
  description: string;
  incidentTypes: IncidentType[];
  severity: IncidentSeverity[];
  status: PlaybookStatus;
  version: string;
  author: string;
  approvedBy?: string;
  lastUpdated: Date;
  autoExecute: boolean;
  approvalRequired: boolean;
  phases: PlaybookPhase[];
  estimatedDuration: number; // minutes
  successRate: number; // 0-1
  executions: number;
  lastExecuted?: Date;
  variables: PlaybookVariable[];
}

export interface PlaybookPhase {
  id: string;
  name: string;
  order: number;
  description: string;
  duration: number; // minutes
  steps: PlaybookStep[];
  dependencies: string[];
}

export interface PlaybookStep {
  id: string;
  order: number;
  name: string;
  description: string;
  action: string;
  target?: string;
  automated: boolean;
  script?: string;
  parameters: Record<string, any>;
  timeout: number; // seconds
  onSuccess: string;
  onFailure: string;
  dependencies: string[];
}

export interface PlaybookVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  options?: any[];
}

export interface Investigation {
  id: string;
  incidentId: string;
  title: string;
  status: InvestigationStatus;
  priority: Priority;
  assignedTo: string;
  team: string[];
  startedAt: Date;
  completedAt?: Date;
  estimatedDuration: number; // hours
  actualDuration?: number; // hours
  progress: number; // 0-100
  tasks: InvestigationTask[];
  findings: InvestigationFinding[];
  hypotheses: Hypothesis[];
  conclusions: string[];
  recommendations: string[];
  tools: Tool[];
}

export interface InvestigationTask {
  id: string;
  name: string;
  description: string;
  status: InvestigationStatus;
  assignedTo: string;
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  dependencies: string[];
  automated: boolean;
  script?: string;
  artifacts: string[];
  findings: string[];
}

export interface InvestigationFinding {
  id: string;
  category: string;
  severity: IncidentSeverity;
  confidence: number;
  description: string;
  evidence: string[];
  discoveredAt: Date;
  discoveredBy: string;
  verified: boolean;
}

export interface Hypothesis {
  id: string;
  description: string;
  confidence: number;
  status: 'unconfirmed' | 'investigating' | 'confirmed' | 'rejected';
  evidence: string[];
  testedBy: string;
  testedAt?: Date;
}

export interface Tool {
  name: string;
  version: string;
  purpose: string;
  command: string;
  parameters: Record<string, any>;
  output: string;
  executedAt: Date;
  executedBy: string;
}

export interface ForensicArtifact {
  id: string;
  incidentId: string;
  investigationId?: string;
  type: ArtifactType;
  name: string;
  description: string;
  path: string;
  hash?: string;
  size?: number;
  collectedAt: Date;
  collectedBy: string;
  chainOfCustody: ChainOfCustodyEntry[];
  integrityVerified: boolean;
  preservationMethod: string;
  location: string;
  accessLog: AccessLog[];
}

export interface ChainOfCustodyEntry {
  timestamp: Date;
  action: 'collected' | 'transferred' | 'accessed' | 'modified' | 'disposed';
  actor: string;
  location: string;
  purpose: string;
  signature?: string;
}

export interface AccessLog {
  timestamp: Date;
  user: string;
  action: string;
  reason: string;
  authorized: boolean;
}

export interface Evidence {
  id: string;
  incidentId: string;
  investigationId?: string;
  type: EvidenceType;
  category: string;
  description: string;
  source: string;
  collectedAt: Date;
  collectedBy: string;
  hash?: string;
  size?: number;
  location: string;
  chainOfCustody: ChainOfCustodyEntry[];
  admissible: boolean;
  authenticated: boolean;
  reliability: number; // 0-1
  relatedEvidence: string[];
  tags: string[];
}

export interface IncidentCommunication {
  id: string;
  incidentId: string;
  type: 'notification' | 'update' | 'escalation' | 'report';
  channel: string;
  audience: string[];
  subject: string;
  message: string;
  sentAt: Date;
  sentBy: string;
  status: 'draft' | 'sent' | 'failed';
  attachments: string[];
  readReceipt: boolean;
  responses: CommunicationResponse[];
}

export interface CommunicationResponse {
  user: string;
  response: string;
  timestamp: Date;
}

export interface IncidentAnalytics {
  id: string;
  period: string;
  totalIncidents: number;
  byType: Record<IncidentType, number>;
  bySeverity: Record<IncidentSeverity, number>;
  byStatus: Record<IncidentStatus, number>;
  meanTimeToDetect: number; // minutes
  meanTimeToContain: number; // minutes
  meanTimeToEradicate: number; // minutes
  meanTimeToRecover: number; // minutes
  meanTimeToResolution: number; // minutes
  slaCompliance: number; // percentage
  mttd: number; // Mean Time To Detect
  mttr: number; // Mean Time To Resolve
  topIncidentTypes: IncidentTypeData[];
  trends: AnalyticsTrend[];
  rootCauses: RootCauseData[];
  teamPerformance: TeamPerformance[];
}

export interface IncidentTypeData {
  type: IncidentType;
  count: number;
  avgDuration: number; // minutes
  avgCost: number;
}

export interface AnalyticsTrend {
  date: Date;
  count: number;
  severity: IncidentSeverity;
  type: IncidentType;
}

export interface RootCauseData {
  cause: string;
  count: number;
  percentage: number;
}

export interface TeamPerformance {
  team: string;
  incidents: number;
  resolved: number;
  avgResolutionTime: number; // minutes
  slaCompliance: number; // percentage
  satisfaction: number; // 0-10
}

export interface IncidentIntegration {
  id: string;
  name: string;
  type: 'siem' | 'edr' | 'ticketing' | 'communication' | 'forensics' | 'threat-intel' | 'custom';
  provider: string;
  enabled: boolean;
  config: any;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
  incidentsImported: number;
  alertsGenerated: number;
  errorMessage?: string;
}

// Markdown Generation
export function generateIncidentManagementMarkdown(config: IncidentManagementConfig): string {
  return `# Security Incident Management and Forensics

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Auto-Triage**: ${config.settings.autoTriage ? 'Yes' : 'No'}
**Auto-Containment**: ${config.settings.autoContainment ? 'Yes' : 'No'}
**Auto-Investigation**: ${config.settings.autoInvestigation ? 'Yes' : 'No'}
**Investigation Depth**: ${config.settings.investigationDepth}

## Management Settings

- **Auto-Triage**: ${config.settings.autoTriage}
- **Auto-Containment**: ${config.settings.autoContainment}
- **Auto-Investigation**: ${config.settings.autoInvestigation}
- **Investigation Depth**: ${config.settings.investigationDepth}
- **Evidence Collection**: ${config.settings.evidenceCollection}
- **Retention Period**: ${config.settings.retentionPeriod} days
- **Forensic Imaging**: ${config.settings.forensicImaging}
- **Chain of Custody**: ${config.settings.chainOfCustody}
- **Legal Hold**: ${config.settings.legalHold}
- **Postmortem Required**: ${config.settings.postmortemRequired}

## Incidents (${config.incidents.length})

${config.incidents.map(incident => `
### ${incident.title} - ${incident.severity.toUpperCase()}

- **ID**: ${incident.id}
- **Type**: ${incident.type}
- **Status**: ${incident.status}
- **Phase**: ${incident.phase}
- **Priority**: ${incident.priority.toUpperCase()}
- **Confidence**: ${(incident.confidence * 100).toFixed(1)}%
- **Detected**: ${incident.detectedAt.toISOString()}
- **Assigned To**: ${incident.assignedTo}
- **Affected Assets**: ${incident.affectedAssets.length}
- **Indicators**: ${incident.indicators.length}
- **Timeline Entries**: ${incident.timeline.length}

**Description**: ${incident.description}

**Affected Assets**:
${incident.affectedAssets.map(asset => `- ${asset.name} (${asset.type}) - Impact: ${asset.impact}, Compromise: ${asset.compromiseLevel}, Isolation: ${asset.isolationStatus}`).join('\n')}

**Root Cause**: ${incident.rootCause || 'Under investigation'}
`).join('\n')}

## Playbooks (${config.playbooks.length})

${config.playbooks.map(playbook => `
### ${playbook.name}

- **ID**: ${playbook.id}
- **Status**: ${playbook.status}
- **Version**: ${playbook.version}
- **Author**: ${playbook.author}
- **Auto-Execute**: ${playbook.autoExecute}
- **Phases**: ${playbook.phases.length}
- **Success Rate**: ${(playbook.successRate * 100).toFixed(1)}%
- **Executions**: ${playbook.executions}

**Incident Types**: ${playbook.incidentTypes.join(', ')}
**Estimated Duration**: ${playbook.estimatedDuration} minutes
`).join('\n')}

## Investigations (${config.investigations.length})

${config.investigations.map(investigation => `
### ${investigation.title}

- **ID**: ${investigation.id}
- **Status**: ${investigation.status}
- **Priority**: ${investigation.priority.toUpperCase()}
- **Assigned To**: ${investigation.assignedTo}
- **Started**: ${investigation.startedAt.toISOString()}
- **Progress**: ${investigation.progress}%
- **Tasks**: ${investigation.tasks.length}
- **Findings**: ${investigation.findings.length}
- **Hypotheses**: ${investigation.hypotheses.length}

**Conclusions**:
${investigation.conclusions.map(c => `- ${c}`).join('\n')}
`).join('\n')}

## Forensic Artifacts (${config.artifacts.length})

## Evidence (${config.evidence.length})

## Communications (${config.communications.length})

## Analytics (${config.analytics.length})
`;
}

// Terraform Generation
export function generateIncidentManagementTerraform(config: IncidentManagementConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  if (provider === 'aws') {
    return `# AWS Incident Management
# Generated at: ${new Date().toISOString()}

resource "aws_s3_bucket" "forensic_artifacts" {
  bucket = "${config.projectName}-forensic-artifacts"

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  lifecycle_rule {
    enabled = true

    expiration {
      days = ${config.settings.retentionPeriod}
    }
  }
}

resource "aws_sns_topic" "incident_alerts" {
  name = "${config.projectName}-incident-alerts"
}

resource "aws_lambda_function" "incident_automation" {
  filename         = "incident_automation.zip"
  function_name    = "${config.projectName}-incident-automation"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      SNS_TOPIC_ARN = aws_sns_topic.incident_alerts.arn
      S3_BUCKET     = aws_s3_bucket.forensic_artifacts.bucket
    }
  }
}

resource "aws_securityhub_account" "main" {
  enable = true
}

resource "aws_detective_graph" "main" {
  graph_name = "${config.projectName}-investigation-graph"
}

resource "aws_cloudtrail" "forensics" {
  name                          = "${config.projectName}-forensics-trail"
  s3_bucket_name                = aws_s3_bucket.forensic_artifacts.bucket
  include_global_service_events = true
  is_multi_region_trail        = true
}
`;
  } else if (provider === 'azure') {
    return `# Azure Incident Management
# Generated at: ${new Date().toISOString()}

resource "azurerm_storage_account" "forensics" {
  name                     = "${config.projectName.replace(/-/g, '')}forensics"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"

  blob_properties {
    versioning_enabled = true
  }
}

resource "azurerm_sentinel_alert_rule" "incident_automation" {
  name                       = "${config.projectName}-automation"
  resource_group_name        = azurerm_resource_group.main.name
  workspace_id              = azurerm_log_analytics_workspace.main.id
  display_name              = "Incident Automation Rule"
  severity                  = "High"
  status                    = "Enabled"
  alert_rule_template_guid  = "guid"

  incident_configuration {
    create_incident        = true
    grouping_configuration {
      method               = "AllEntities"
      lookback_duration    = "PT5H"
    }
  }
}

resource "azurerm_eventhub" "incident_events" {
  name                = "${config.projectName}-incidents"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  namespace_name      = azurerm_eventhub_namespace.main.name
  partition_count     = 2
  message_retention   = ${config.settings.retentionPeriod}
}
`;
  } else {
    return `# GCP Incident Management
# Generated at: ${new Date().toISOString()}

resource "google_storage_bucket" "forensics" {
  name          = "${config.projectName}-forensic-artifacts"
  location      = "US"
  force_destroy = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = ${config.settings.retentionPeriod}
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_cloud_sheets" "incident_tracking" {
  name = "${config.projectName}-incident-tracker"
}

resource "google_pubsub_topic" "incident_alerts" {
  name = "${config.projectName}-incident-alerts"
}

resource "google_bigquery_dataset" "forensics" {
  dataset_id = "${config.projectName}_forensics"
  location   = "US"
}

resource "google_cloudfunctions_function" "incident_automation" {
  name        = "${config.projectName}-incident-automation"
  location    = "us-central1"
  runtime     = "python39"

  available_memory_mb = 256
  source_archive_bucket = google_storage_bucket.forensics.name
  source_archive_object = "incident_automation.zip"
  trigger_http = true
}
`;
  }
}

// TypeScript Manager Generation
export function generateIncidentManagerTypeScript(config: IncidentManagementConfig): string {
  return `// Auto-generated Incident Management Manager
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';

interface Incident {
  id: string;
  type: string;
  severity: string;
  status: string;
  phase: string;
  priority: string;
  confidence: number;
  description: string;
}

interface Investigation {
  id: string;
  incidentId: string;
  status: string;
  priority: string;
  progress: number;
}

interface Artifact {
  id: string;
  incidentId: string;
  type: string;
  name: string;
  path: string;
}

class IncidentManagementManager extends EventEmitter {
  private incidents: Map<string, Incident> = new Map();
  private investigations: Map<string, Investigation> = new Map();
  private artifacts: Map<string, Artifact> = new Map();

  async createIncident(data: any): Promise<Incident> {
    const incident: Incident = {
      id: \`incident-\${Date.now()}\`,
      type: 'malware',
      severity: 'high',
      status: 'open',
      phase: 'identification',
      priority: 'p2',
      confidence: 0.85,
      description: 'Security incident detected',
    };

    this.incidents.set(incident.id, incident);
    this.emit('incident-created', incident);

    return incident;
  }

  async startInvestigation(incidentId: string): Promise<Investigation> {
    const investigation: Investigation = {
      id: \`investigation-\${Date.now()}\`,
      incidentId,
      status: 'in-progress',
      priority: 'p2',
      progress: 0,
    };

    this.investigations.set(investigation.id, investigation);
    this.emit('investigation-started', investigation);

    return investigation;
  }

  async collectArtifact(incidentId: string, type: string, name: string, path: string): Promise<Artifact> {
    const artifact: Artifact = {
      id: \`artifact-\${Date.now()}\`,
      incidentId,
      type,
      name,
      path,
    };

    this.artifacts.set(artifact.id, artifact);
    this.emit('artifact-collected', artifact);

    return artifact;
  }

  async updateIncidentStatus(incidentId: string, status: string, phase: string): Promise<any> {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error('Incident not found');

    incident.status = status;
    incident.phase = phase;

    return { incidentId, status, phase, timestamp: new Date() };
  }
}

export { IncidentManagementManager };
`;
}

// Python Manager Generation
export function generateIncidentManagerPython(config: IncidentManagementConfig): string {
  return `# Auto-generated Incident Management Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    CONTAINING = "containing"
    ERADICATION = "eradication"
    RECOVERY = "recovery"
    CLOSED = "closed"

class IncidentPhase(str, Enum):
    IDENTIFICATION = "identification"
    TRIAGE = "triage"
    CONTAINMENT = "containment"
    INVESTIGATION = "investigation"
    ERADICATION = "eradication"
    RECOVERY = "recovery"
    POST_INCIDENT = "post-incident"

@dataclass
class Incident:
    id: str
    type: str
    severity: str
    status: str
    phase: str
    priority: str
    confidence: float
    description: str

@dataclass
class Investigation:
    id: str
    incident_id: str
    status: str
    priority: str
    progress: int

@dataclass
class Artifact:
    id: str
    incident_id: str
    type: str
    name: str
    path: str

class IncidentManagementManager:
    def __init__(self):
        self.incidents: Dict[str, Incident] = {}
        self.investigations: Dict[str, Investigation] = {}
        self.artifacts: Dict[str, Artifact] = {}

    async def create_incident(self, data: Dict[str, Any]) -> Incident:
        incident = Incident(
            id=f"incident-{int(datetime.now().timestamp())}",
            type="malware",
            severity="high",
            status=IncidentStatus.OPEN.value,
            phase=IncidentPhase.IDENTIFICATION.value,
            priority="p2",
            confidence=0.85,
            description="Security incident detected",
        )
        self.incidents[incident.id] = incident
        return incident

    async def start_investigation(self, incident_id: str) -> Investigation:
        investigation = Investigation(
            id=f"investigation-{int(datetime.now().timestamp())}",
            incident_id=incident_id,
            status="in-progress",
            priority="p2",
            progress=0,
        )
        self.investigations[investigation.id] = investigation
        return investigation

    async def collect_artifact(self, incident_id: str, artifact_type: str, name: str, path: str) -> Artifact:
        artifact = Artifact(
            id=f"artifact-{int(datetime.now().timestamp())}",
            incident_id=incident_id,
            type=artifact_type,
            name=name,
            path=path,
        )
        self.artifacts[artifact.id] = artifact
        return artifact

    async def update_incident_status(self, incident_id: str, status: str, phase: str) -> Dict[str, Any]:
        if incident_id not in self.incidents:
            raise ValueError("Incident not found")

        incident = self.incidents[incident_id]
        incident.status = status
        incident.phase = phase
        return {"incidentId": incident_id, "status": status, "phase": phase}
`;
}

// Write Files
export async function writeIncidentManagementFiles(
  config: IncidentManagementConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  await fs.writeFile(
    path.join(outputDir, 'INCIDENT_MANAGEMENT.md'),
    generateIncidentManagementMarkdown(config)
  );

  // Write Terraform configs for each provider
  for (const provider of config.providers) {
    const tfContent = generateIncidentManagementTerraform(config, provider);
    await fs.writeFile(
      path.join(outputDir, `incident-management-${provider}.tf`),
      tfContent
    );
  }

  // Write manager code
  if (language === 'typescript') {
    const tsContent = generateIncidentManagerTypeScript(config);
    await fs.writeFile(path.join(outputDir, 'incident-management-manager.ts'), tsContent);

    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'Security Incident Management and Forensics',
      main: 'incident-management-manager.ts',
      scripts: {
        start: 'ts-node incident-management-manager.ts',
      },
      dependencies: {
        '@types/node': '^20.0.0',
        'events': '^3.3.0',
      },
    };
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } else {
    const pyContent = generateIncidentManagerPython(config);
    await fs.writeFile(path.join(outputDir, 'incident_management_manager.py'), pyContent);

    const requirements = ['pydantic>=2.0.0', 'python-dotenv>=1.0.0'];
    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      requirements.join('\n')
    );
  }

  // Write config JSON
  await fs.writeFile(
    path.join(outputDir, 'incident-management-config.json'),
    JSON.stringify(config, null, 2)
  );
}

export function displayIncidentManagementConfig(config: IncidentManagementConfig): void {
  console.log(chalk.cyan('🔍 Security Incident Management and Forensics'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow(`Project Name:`), chalk.white(config.projectName));
  console.log(chalk.yellow(`Providers:`), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow(`Auto-Triage:`), chalk.white(config.settings.autoTriage ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Auto-Containment:`), chalk.white(config.settings.autoContainment ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Auto-Investigation:`), chalk.white(config.settings.autoInvestigation ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Incidents:`), chalk.cyan(config.incidents.length));
  console.log(chalk.yellow(`Playbooks:`), chalk.cyan(config.playbooks.length));
  console.log(chalk.yellow(`Investigations:`), chalk.cyan(config.investigations.length));
  console.log(chalk.yellow(`Forensic Artifacts:`), chalk.cyan(config.artifacts.length));
  console.log(chalk.gray('─'.repeat(60)));
}
