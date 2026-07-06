// SOX, GDPR, HIPAA Compliance Reporting and Automation with Evidence Collection

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Identifies the regulatory or industry compliance framework that a report,
 * control, requirement, finding, or evidence record belongs to.
 */
export type ComplianceFramework = 'SOX' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'NIST-800-53' | 'ISO-27001' | 'SOC-2' | 'custom';

/**
 * Tracks the lifecycle state of a compliance report as it moves through
 * authoring, review, approval, and archival.
 */
export type ReportStatus = 'draft' | 'in-review' | 'approved' | 'rejected' | 'archived';

/**
 * Categorizes the kind of artifact collected as evidence for a compliance
 * control, such as a screenshot, log file, configuration, or certificate.
 */
export type EvidenceType = 'screenshot' | 'log-file' | 'configuration' | 'document' | 'certificate' | 'audit-trail' | 'interview-notes' | 'custom';

/**
 * Represents the assessed compliance posture of an individual control,
 * ranging from fully compliant through non-compliant or pending review.
 */
export type ControlStatus = 'compliant' | 'non-compliant' | 'partial' | 'not-applicable' | 'pending-review';

/**
 * Qualitative severity used to prioritize findings and controls. Critical
 * indicates the highest urgency while low indicates informational risk.
 */
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Output format options for generated compliance reports.
 */
export type ReportFormat = 'pdf' | 'html' | 'json' | 'xml' | 'csv' | 'custom';

/**
 * Lifecycle state of collected evidence, including whether it is currently
 * valid, has expired, is awaiting validation, or has been superseded.
 */
export type EvidenceStatus = 'valid' | 'expired' | 'pending' | 'rejected' | 'superseded';

/**
 * Lifecycle state of a remediation task, from not started through completed
 * or cancelled.
 */
export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';

/**
 * Delivery channel for compliance notifications emitted by the reporting
 * system, such as email, Slack, Microsoft Teams, webhooks, or SMS.
 */
export type NotificationType = 'email' | 'slack' | 'teams' | 'webhook' | 'sms' | 'custom';

/**
 * Root configuration object for the compliance reporting system. Aggregates
 * project-level metadata, cloud provider targets, reporting settings, and the
 * full set of frameworks, reports, controls, requirements, evidence,
 * assessments, findings, remediation plans, and notification definitions that
 * make up the compliance program.
 */
export interface ComplianceReportingConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: ReportingSettings;
  frameworks: ComplianceFramework[];
  reports: ComplianceReport[];
  controls: ComplianceControl[];
  requirements: ComplianceRequirement[];
  evidence: EvidenceRecord[];
  assessments: ComplianceAssessment[];
  findings: ComplianceFinding[];
  remediation: RemediationPlan[];
  notifications: NotificationConfig[];
}

/**
 * Configurable options that govern how compliance reports are generated,
 * distributed, approved, encrypted, and retained.
 */
export interface ReportingSettings {
  autoGenerate: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'on-demand';
  format: ReportFormat;
  includeEvidence: boolean;
  evidenceRetention: number; // days
  requireApproval: boolean;
  approvers: string[];
  notificationEnabled: boolean;
  reportDistribution: string[];
  customLogo?: string;
  watermarkReports: boolean;
  archiveReports: boolean;
  archiveLocation: string;
  complianceThreshold: number; // percentage
  generateGapAnalysis: boolean;
  includeRecommendations: boolean;
  signReports: boolean;
  encryptionEnabled: boolean;
}

/**
 * Represents a single generated compliance report, including the framework it
 * covers, the reporting period, the overall compliance score, summaries of
 * evaluated controls and findings, attached evidence, recommendations,
 * sign-offs, and audit metadata.
 */
export interface ComplianceReport {
  id: string;
  name: string;
  framework: ComplianceFramework;
  reportingPeriod: string;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  generatedBy: string;
  status: ReportStatus;
  overallScore: number; // 0-100
  complianceStatus: 'compliant' | 'non-compliant' | 'partial';
  summary: ReportSummary;
  controls: ReportControl[];
  findings: ReportFinding[];
  evidence: ReportEvidence[];
  recommendations: string[];
  signoffs: ReportSignoff[];
  attachments: ReportAttachment[];
  metadata: ReportMetadata;
}

/**
 * Aggregate metrics for a compliance report, summarizing counts of controls by
 * status, findings by severity, overall completion percentage, and a derived
 * risk score.
 */
export interface ReportSummary {
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  partialControls: number;
  notApplicableControls: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  completionPercentage: number;
  riskScore: number; // 0-100
}

/**
 * Describes the evaluation of a single control within a compliance report,
 * including its status, tester, supporting evidence, risk level, and the date
 * it is next due for review.
 */
export interface ReportControl {
  controlId: string;
  title: string;
  description: string;
  status: ControlStatus;
  testDate: Date;
  tester: string;
  findings: string[];
  evidence: string[]; // evidence IDs
  riskLevel: RiskLevel;
  nextReviewDate: Date;
}

/**
 * A compliance finding captured within a report, describing a defect or gap
 * discovered during testing, its impact and severity, recommended remediation,
 * the current status, the responsible assignee, and the due date.
 */
export interface ReportFinding {
  id: string;
  control: string;
  severity: RiskLevel;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  discoveredDate: Date;
  discoveredBy: string;
  status: 'open' | 'in-progress' | 'remediated' | 'accepted-risk' | 'false-positive';
  assignedTo: string;
  dueDate: Date;
  relatedEvidence: string[];
}

/**
 * Metadata for an evidence artifact referenced by a compliance report, such as
 * its type, collection details, file location and hash, size, format,
 * expiration, and tags.
 */
export interface ReportEvidence {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  collectedDate: Date;
  collectedBy: string;
  status: EvidenceStatus;
  fileLocation: string;
  hash: string;
  size: number;
  format: string;
  expiresAt: Date;
  tags: string[];
}

/**
 * Records an approval signature for a compliance report, capturing the
 * approver's role, name, contact details, signing timestamp, signature value,
 * and any accompanying comments.
 */
export interface ReportSignoff {
  role: string;
  name: string;
  email: string;
  signedAt: Date;
  signature: string;
  comments: string;
}

/**
 * Represents a supplementary file attached to a compliance report, including
 * its name, type, size, storage location, and upload metadata.
 */
export interface ReportAttachment {
  name: string;
  type: string;
  size: number;
  location: string;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Internal metadata for a compliance report, tracking its version, modification
 * history, review cycle, audit trail of changes, and descriptive tags.
 */
export interface ReportMetadata {
  version: string;
  lastModified: Date;
  modifiedBy: string;
  reviewCycle: string;
  auditTrail: AuditEntry[];
  tags: string[];
}

/**
 * A single entry in a report's audit trail, recording who performed an action,
 * when it occurred, the action taken, and any additional details.
 */
export interface AuditEntry {
  timestamp: Date;
  user: string;
  action: string;
  details: string;
}

/**
 * Defines a compliance control within a framework, including its identity,
 * description, category, status, risk level, testing cadence, ownership, the
 * test procedures and automated or manual checks used to validate it, evidence
 * requirements, and mappings to controls in other frameworks.
 */
export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  description: string;
  category: string;
  status: ControlStatus;
  riskLevel: RiskLevel;
  testingRequired: boolean;
  testFrequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  lastTested: Date;
  nextTestDue: Date;
  owner: string;
  tester: string;
  testProcedures: TestProcedure[];
  automatedChecks: AutomatedCheck[];
  manualChecks: ManualCheck[];
  evidenceRequired: EvidenceRequirement[];
  relatedControls: string[];
  complianceMappings: ComplianceMapping[];
}

/**
 * A documented procedure for testing a compliance control, comprising an
 * ordered set of steps, expected results, required tools, and an estimated
 * time to complete.
 */
export interface TestProcedure {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  expectedResults: string[];
  tools: string[];
  estimatedTime: number; // minutes
}

/**
 * A single step within a test procedure, describing the action to perform, the
 * expected result, and whether a screenshot should be captured as evidence.
 */
export interface TestStep {
  order: number;
  action: string;
  expectedResult: string;
  screenshot: boolean;
}

/**
 * An automated compliance check executed via a script, API call, configuration
 * scan, or log analysis, including its schedule, most recent run result, and
 * the pass or fail threshold.
 */
export interface AutomatedCheck {
  id: string;
  name: string;
  type: 'script' | 'api-call' | 'config-scan' | 'log-analysis' | 'custom';
  script: string;
  schedule: string; // cron expression
  lastRun: Date;
  lastResult: 'pass' | 'fail' | 'warning' | 'error';
  threshold: string;
}

/**
 * A manual compliance check performed by a human, consisting of instructions,
 * a checklist of items, the frequency of execution, the responsible assignee,
 * and the due date.
 */
export interface ManualCheck {
  id: string;
  name: string;
  instructions: string;
  checklist: ChecklistItem[];
  frequency: string;
  assignee: string;
  dueDate: Date;
}

/**
 * An individual item in a manual check checklist, tracking whether it has been
 * completed, by whom, when, along with optional notes.
 */
export interface ChecklistItem {
  item: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
}

/**
 * Specifies the evidence that must be collected for a control, including the
 * type of evidence, whether it is mandatory, the retention period, the
 * collection method, the source, and the collection frequency.
 */
export interface EvidenceRequirement {
  id: string;
  type: EvidenceType;
  description: string;
  required: boolean;
  retentionPeriod: number; // days
  collectionMethod: 'manual' | 'automated' | 'api' | 'custom';
  source: string;
  frequency: string;
}

/**
 * Maps a control to an equivalent or related control in another compliance
 * framework, with notes describing the nature of the mapping.
 */
export interface ComplianceMapping {
  framework: ComplianceFramework;
  controlId: string;
  mappingType: 'equivalent' | 'partial' | 'custom';
  notes: string;
}

/**
 * Represents a regulatory or organizational requirement that the compliance
 * program must satisfy, including the related control and evidence IDs, the
 * obligation type, current status, assignee, risk level, and assessment
 * schedule.
 */
export interface ComplianceRequirement {
  id: string;
  framework: ComplianceFramework;
  requirementId: string;
  title: string;
  description: string;
  category: string;
  obligationType: 'mandatory' | 'required' | 'addressable' | 'custom';
  controls: string[]; // control IDs
  evidenceRequired: string[]; // evidence IDs
  dueDate: Date;
  status: 'met' | 'not-met' | 'partial' | 'not-applicable';
  assignee: string;
  risk: RiskLevel;
  lastAssessed: Date;
  nextAssessment: Date;
}

/**
 * A stored record of collected evidence, including its identity, type,
 * associated control IDs, collection details, file metadata, integrity hash
 * and algorithm, expiration and retention dates, tags, and any additional
 * metadata.
 */
export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  framework: ComplianceFramework;
  controlIds: string[];
  collectedDate: Date;
  collectedBy: string;
  status: EvidenceStatus;
  fileLocation: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  hashAlgorithm: 'SHA-256' | 'SHA-512' | 'MD5';
  expiresAt: Date;
  retentionDate: Date;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Describes a compliance assessment event, such as an internal audit, external
 * assessment, self-assessment, or certification, including the scope,
 * evaluated controls and findings, the resulting score, the report path, and
 * the next scheduled assessment date.
 */
export interface ComplianceAssessment {
  id: string;
  name: string;
  framework: ComplianceFramework;
  type: 'internal' | 'external' | 'self-assessment' | 'certification' | 'custom';
  startDate: Date;
  endDate: Date;
  assessor: string;
  assessorOrganization: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
  scope: AssessmentScope;
  controls: string[];
  findings: string[];
  score: number;
  reportPath: string;
  nextAssessment: Date;
}

/**
 * Defines the boundaries of a compliance assessment by listing the assets,
 * locations, departments, processes, and third parties that are included or
 * excluded from the review.
 */
export interface AssessmentScope {
  includedAssets: string[];
  excludedAssets: string[];
  locations: string[];
  departments: string[];
  processes: string[];
  thirdParties: string[];
}

/**
 * A compliance finding raised during an assessment or testing, detailing the
 * severity, impact, root cause, recommended remediation, discovery metadata,
 * current status, assignee, due date, estimated and actual effort, related
 * findings, and supporting evidence.
 */
export interface ComplianceFinding {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  severity: RiskLevel;
  title: string;
  description: string;
  impact: string;
  rootCause: string;
  recommendation: string;
  discoveredDate: Date;
  discoveredBy: string;
  status: 'open' | 'acknowledged' | 'remediating' | 'remediated' | 'accepted-risk' | 'false-positive';
  assignedTo: string;
  dueDate: Date;
  estimatedEffort: number; // hours
  actualEffort?: number;
  remediationPlan: string;
  verification: string;
  relatedFindings: string[];
  evidence: string[];
}

/**
 * A plan to remediate a compliance finding, consisting of prioritized tasks,
 * milestones, estimated and actual completion dates, overall progress, the
 * responsible assignee, optional budget, and any blockers.
 */
export interface RemediationPlan {
  id: string;
  findingId: string;
  priority: number;
  tasks: RemediationTask[];
  milestones: Milestone[];
  estimatedCompletion: Date;
  actualCompletion?: Date;
  status: 'planned' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';
  progress: number; // 0-100
  assignedTo: string;
  budget?: number;
  blockers: string[];
}

/**
 * An individual task within a remediation plan, including its assignee, due
 * date, status, estimated and actual hours, task dependencies, completion
 * date, and notes.
 */
export interface RemediationTask {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: Date;
  status: TaskStatus;
  estimatedHours: number;
  actualHours?: number;
  dependencies: string[];
  completedDate?: Date;
  notes: string[];
}

/**
 * A milestone within a remediation plan, representing a target date for a
 * group of related tasks and tracking whether it has been completed or
 * missed.
 */
export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'missed';
  tasks: string[];
}

/**
 * Configuration for a compliance notification channel, specifying the delivery
 * type, enabled state, recipients, triggering events, message template,
 * delivery frequency, and the timestamp of the last notification sent.
 */
export interface NotificationConfig {
  id: string;
  type: NotificationType;
  enabled: boolean;
  recipients: string[];
  triggers: NotificationTrigger[];
  template: string;
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
  lastSent: Date;
}

/**
 * Defines a condition that causes a compliance notification to fire, such as a
 * report becoming ready, a finding being detected, a deadline approaching or
 * being missed, or remediation completing, optionally filtered by severity or
 * a numeric threshold.
 */
export interface NotificationTrigger {
  event: 'report-ready' | 'finding-detected' | 'deadline-approaching' | 'deadline-missed' | 'remediation-complete' | 'custom';
  severity?: RiskLevel;
  threshold?: number;
}

// Markdown Generation

/**
 * Produces a Markdown document summarizing the compliance reporting
 * configuration, including project metadata, providers, frameworks, reporting
 * settings, and section counts for reports, controls, requirements, evidence,
 * assessments, findings, and remediation plans.
 *
 * @param config - The full compliance reporting configuration to render.
 * @returns A Markdown string representing the compliance reporting overview.
 */
export function generateComplianceReportingMarkdown(config: ComplianceReportingConfig): string {
  return `# SOX, GDPR, HIPAA Compliance Reporting and Automation with Evidence Collection

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Frameworks**: ${config.frameworks.join(', ')}
**Auto-Generate**: ${config.settings.autoGenerate ? 'Yes' : 'No'}
**Frequency**: ${config.settings.frequency}

## Reporting Settings

- **Auto-Generate**: ${config.settings.autoGenerate}
- **Frequency**: ${config.settings.frequency}
- **Format**: ${config.settings.format}
- **Include Evidence**: ${config.settings.includeEvidence}
- **Require Approval**: ${config.settings.requireApproval}
- **Compliance Threshold**: ${config.settings.complianceThreshold}%
- **Generate Gap Analysis**: ${config.settings.generateGapAnalysis}
- **Sign Reports**: ${config.settings.signReports}

## Compliance Frameworks (${config.frameworks.length})

${config.frameworks.map(fw => `
### ${fw}

**Description**: ${fw === 'SOX' ? 'Sarbanes-Oxley Act compliance' : fw === 'GDPR' ? 'General Data Protection Regulation' : fw === 'HIPAA' ? 'Health Insurance Portability and Accountability Act' : 'Custom framework'}
`).join('')}

## Reports (${config.reports.length})
## Controls (${config.controls.length})
## Requirements (${config.requirements.length})
## Evidence Records (${config.evidence.length})
## Assessments (${config.assessments.length})
## Findings (${config.findings.length})
## Remediation Plans (${config.remediation.length})
`;
}

// Terraform Generation

/**
 * Generates Terraform infrastructure-as-code for the compliance reporting
 * system tailored to the specified cloud provider. For AWS this includes an
 * encrypted S3 bucket, an IAM role, a Lambda compliance checker, a CloudWatch
 * schedule, and an SNS alerts topic. For Azure it provisions a storage
 * account, Key Vault, and policy assignment. For GCP it creates a storage
 * bucket, Cloud Scheduler job, Cloud Function scanner, and Pub/Sub alerts
 * topic.
 *
 * @param config - The compliance reporting configuration to provision for.
 * @param provider - The target cloud provider (aws, azure, or gcp).
 * @returns A Terraform configuration string for the selected provider.
 */
export function generateComplianceReportingTerraform(config: ComplianceReportingConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  if (provider === 'aws') {
    return `# AWS Compliance Reporting Infrastructure
# Generated at: ${new Date().toISOString()}

resource "aws_s3_bucket" "compliance_reports" {
  bucket = "${config.projectName}-compliance-reports"

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
}

resource "aws_s3_bucket_public_access_block" "compliance_reports_pab" {
  bucket = aws_s3_bucket.compliance_reports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_role" "compliance_auditor" {
  name = "${config.projectName}-compliance-auditor"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_lambda_function" "compliance_checker" {
  filename         = "compliance_checker.zip"
  function_name    = "${config.projectName}-compliance-checker"
  role            = aws_iam_role.compliance_auditor.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900

  environment {
    variables = {
      COMPLIANCE_THRESHOLD = "${config.settings.complianceThreshold}"
      REPORT_FORMAT       = "${config.settings.format}"
      S3_BUCKET          = aws_s3_bucket.compliance_reports.id
    }
  }
}

resource "aws_cloudwatch_event_rule" "compliance_schedule" {
  name                = "${config.projectName}-compliance-schedule"
  description         = "Trigger compliance report generation"
  schedule_expression = "rate(1 day)"

  targets {
    arn      = aws_lambda_function.compliance_checker.arn
    id       = "compliance-checker"
  }
}

resource "aws_sns_topic" "compliance_alerts" {
  name = "${config.projectName}-compliance-alerts"
}
`;
  } else if (provider === 'azure') {
    return `# Azure Compliance Reporting Infrastructure
# Generated at: ${new Date().toISOString()}

resource "azurerm_storage_account" "compliance_reports" {
  name                     = "${config.projectName.replace(/-/g, '')}compliance"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"

  blob_properties {
    versioning_enabled = true
  }
}

resource "azurerm_key_vault" "compliance_secrets" {
  name                = "${config.projectName.replace(/-/g, '')}-kv"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_user_assigned_identity.compliance_principal.object_id

    key_permissions    = ["Get", "List"]
    secret_permissions = ["Get", "List"]
  }
}

resource "azurerm_policy_assignment" "compliance_policy" {
  name                 = "${config.projectName}-compliance"
  policy_definition_id = azurerm_policy_definition.compliance.id
};
`;
  } else {
    return `# GCP Compliance Reporting Infrastructure
# Generated at: ${new Date().toISOString()}

resource "google_storage_bucket" "compliance_reports" {
  name          = "${config.projectName}-compliance-reports"
  location      = "US"
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 2555 # 7 years
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_cloud_scheduler_job" "compliance_scan" {
  name             = "${config.projectName}-compliance-scan"
  description      = "Scheduled compliance scanning"
  schedule          = "0 2 * * *"
  time_zone        = "America/New_York"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions_function.compliance_scanner.https_trigger_url

    body = base64encode("{"action": "scan"}")
  }
}

resource "google_cloudfunctions_function" "compliance_scanner" {
  name        = "${config.projectName}-compliance-scanner"
  runtime     = "python39"
  source_archive_bucket = google_storage_bucket.compliance_reports.name
  entry_point = "scan_compliance"

  environment_variables = {
    COMPLIANCE_THRESHOLD = "${config.settings.complianceThreshold}"
    REPORT_FORMAT       = "${config.settings.format}"
  }
}

resource "google_pubsub_topic" "compliance_alerts" {
  name = "${config.projectName}-compliance-alerts"
}
`;
  }
}

// TypeScript Manager Generation

/**
 * Generates a TypeScript implementation of a ComplianceReportingManager class
 * that emits events for report generation, evidence collection, finding
 * creation, evidence expiry, and overdue findings. The generated module can be
 * written to disk and used as a starting point for a runtime compliance
 * reporting service.
 *
 * @param config - The compliance reporting configuration used to seed the
 *   generated manager.
 * @returns A string containing the TypeScript source code of the manager.
 */
export function generateComplianceManagerTypeScript(config: ComplianceReportingConfig): string {
  return `// Auto-generated Compliance Reporting Manager
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';

interface Report {
  id: string;
  name: string;
  framework: string;
  status: string;
  score: number;
}

interface Evidence {
  id: string;
  type: string;
  controlIds: string[];
  status: string;
  expiresAt: Date;
}

interface Finding {
  id: string;
  framework: string;
  severity: string;
  status: string;
  assignedTo: string;
  dueDate: Date;
}

class ComplianceReportingManager extends EventEmitter {
  private reports: Map<string, Report> = new Map();
  private evidence: Map<string, Evidence> = new Map();
  private findings: Map<string, Finding> = new Map();

  async generateReport(framework: string, period: string): Promise<Report> {
    const report: Report = {
      id: \`report-\${Date.now()}\`,
      name: \`\${framework} Compliance Report - \${period}\`,
      framework,
      status: 'draft',
      score: 0,
    };

    // Assess compliance
    const findings = this.getFindingsByFramework(framework);
    const controls = await this.assessControls(framework);

    const score = this.calculateScore(controls, findings);
    report.score = score;
    report.status = score >= 80 ? 'compliant' : score >= 60 ? 'partial' : 'non-compliant';

    this.reports.set(report.id, report);
    this.emit('report-generated', report);

    return report;
  }

  private async assessControls(framework: string): Promise<any[]> {
    // Simulate control assessment
    return [
      { id: 'ctrl-001', status: 'compliant' },
      { id: 'ctrl-002', status: 'non-compliant' },
      { id: 'ctrl-003', status: 'partial' },
    ];
  }

  private calculateScore(controls: any[], findings: Finding[]): number {
    const totalControls = controls.length;
    const compliantControls = controls.filter((c: any) => c.status === 'compliant').length;
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;

    let score = (compliantControls / totalControls) * 100;
    score -= criticalFindings * 10;

    return Math.max(0, Math.min(100, score));
  }

  async collectEvidence(evidence: Omit<Evidence, 'status'>): Promise<Evidence> {
    const record: Evidence = {
      ...evidence,
      status: 'valid',
    };

    this.evidence.set(record.id, record);
    this.emit('evidence-collected', record);

    return record;
  }

  async createFinding(finding: Omit<Finding, 'status'>): Promise<Finding> {
    const newFinding: Finding = {
      ...finding,
      status: 'open',
    };

    this.findings.set(newFinding.id, newFinding);
    this.emit('finding-created', newFinding);

    return newFinding;
  }

  getFindingsByFramework(framework: string): Finding[] {
    return Array.from(this.findings.values()).filter(f => f.framework === framework && f.status !== 'remediated');
  }

  async checkEvidenceExpiry(): Promise<Evidence[]> {
    const now = new Date();
    const expired: Evidence[] = [];

    for (const evidence of this.evidence.values()) {
      if (evidence.expiresAt < now && evidence.status === 'valid') {
        evidence.status = 'expired';
        expired.push(evidence);
        this.emit('evidence-expired', evidence);
      }
    }

    return expired;
  }

  async escalateOverdueFindings(): Promise<Finding[]> {
    const now = new Date();
    const overdue: Finding[] = [];

    for (const finding of this.findings.values()) {
      if (finding.dueDate < now && finding.status === 'open') {
        overdue.push(finding);
        this.emit('finding-overdue', finding);
      }
    }

    return overdue;
  }
}

export { ComplianceReportingManager };
`;
}

// Python Manager Generation

/**
 * Generates a Python implementation of a ComplianceReportingManager class,
 * including dataclasses for reports, evidence, and findings, enums for status
 * values, and async methods for report generation, evidence collection,
 * finding creation, evidence expiry checks, and overdue finding escalation.
 *
 * @param config - The compliance reporting configuration used to seed the
 *   generated manager.
 * @returns A string containing the Python source code of the manager.
 */
export function generateComplianceManagerPython(config: ComplianceReportingConfig): string {
  return `# Auto-generated Compliance Reporting Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime, date
from enum import Enum

class ReportStatus(Enum):
    DRAFT = "draft"
    IN_REVIEW = "in-review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"

class ControlStatus(Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non-compliant"
    PARTIAL = "partial"
    NOT_APPLICABLE = "not-applicable"
    PENDING_REVIEW = "pending-review"

class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

@dataclass
class Report:
    id: str
    name: str
    framework: str
    status: str
    score: int

@dataclass
class Evidence:
    id: str
    type: str
    control_ids: List[str]
    status: str
    expires_at: datetime

@dataclass
class Finding:
    id: str
    framework: str
    severity: str
    status: str
    assigned_to: str
    due_date: datetime

class ComplianceReportingManager:
    def __init__(self):
        self.reports: Dict[str, Report] = {}
        self.evidence: Dict[str, Evidence] = {}
        self.findings: Dict[str, Finding] = {}

    async def generate_report(self, framework: str, period: str) -> Report:
        report = Report(
            id=f"report-{int(datetime.now().timestamp())}",
            name=f"{framework} Compliance Report - {period}",
            framework=framework,
            status="draft",
            score=0,
        )

        # Assess compliance
        findings = self._get_findings_by_framework(framework)
        controls = await self._assess_controls(framework)

        score = self._calculate_score(controls, findings)
        report.score = score

        if score >= 80:
            report.status = "compliant"
        elif score >= 60:
            report.status = "partial"
        else:
            report.status = "non-compliant"

        self.reports[report.id] = report
        return report

    async def _assess_controls(self, framework: str) -> List[Dict[str, Any]]:
        # Simulate control assessment
        return [
            {"id": "ctrl-001", "status": "compliant"},
            {"id": "ctrl-002", "status": "non-compliant"},
            {"id": "ctrl-003", "status": "partial"},
        ]

    def _calculate_score(self, controls: List[Dict], findings: List[Finding]) -> int:
        total_controls = len(controls)
        compliant_controls = sum(1 for c in controls if c["status"] == "compliant")
        critical_findings = sum(1 for f in findings if f.severity == "critical")

        score = int((compliant_controls / total_controls) * 100)
        score -= critical_findings * 10

        return max(0, min(100, score))

    async def collect_evidence(self, evidence: Dict[str, Any]) -> Evidence:
        record = Evidence(
            id=evidence["id"],
            type=evidence["type"],
            control_ids=evidence["control_ids"],
            status="valid",
            expires_at=evidence["expires_at"],
        )

        self.evidence[record.id] = record
        return record

    async def create_finding(self, finding: Dict[str, Any]) -> Finding:
        new_finding = Finding(
            id=finding["id"],
            framework=finding["framework"],
            severity=finding["severity"],
            status="open",
            assigned_to=finding["assigned_to"],
            due_date=finding["due_date"],
        )

        self.findings[new_finding.id] = new_finding
        return new_finding

    def _get_findings_by_framework(self, framework: str) -> List[Finding]:
        return [
            f for f in self.findings.values()
            if f.framework == framework and f.status != "remediated"
        ]

    async def check_evidence_expiry(self) -> List[Evidence]:
        now = datetime.now()
        expired = []

        for evidence in self.evidence.values():
            if evidence.expires_at < now and evidence.status == "valid":
                evidence.status = "expired"
                expired.append(evidence)

        return expired

    async def escalate_overdue_findings(self) -> List[Finding]:
        now = datetime.now()
        overdue = []

        for finding in self.findings.values():
            if finding.due_date < now and finding.status == "open":
                overdue.append(finding)

        return overdue
`;
}

// Write Files

/**
 * Writes all compliance reporting artifacts to the specified output directory.
 * This includes the Markdown overview, a Terraform file per configured cloud
 * provider, a TypeScript or Python manager module (along with its package
 * manifest or requirements file) based on the selected language, and a JSON
 * dump of the configuration.
 *
 * @param config - The compliance reporting configuration to render and persist.
 * @param outputDir - The directory to write generated files into. It will be
 *   created if it does not exist.
 * @param language - The implementation language for the generated manager
 *   module, either 'typescript' or 'python'.
 * @returns A promise that resolves when all files have been written.
 * @throws Rejections from the underlying fs-extra file system operations if a
 *   directory cannot be created or a file cannot be written.
 */
export async function writeComplianceReportingFiles(
  config: ComplianceReportingConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  await fs.writeFile(
    path.join(outputDir, 'COMPLIANCE_REPORTING.md'),
    generateComplianceReportingMarkdown(config)
  );

  for (const provider of config.providers) {
    const tfContent = generateComplianceReportingTerraform(config, provider);
    await fs.writeFile(
      path.join(outputDir, `compliance-reporting-${provider}.tf`),
      tfContent
    );
  }

  if (language === 'typescript') {
    const tsContent = generateComplianceManagerTypeScript(config);
    await fs.writeFile(path.join(outputDir, 'compliance-reporting-manager.ts'), tsContent);

    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'SOX, GDPR, HIPAA Compliance Reporting and Automation',
      main: 'compliance-reporting-manager.ts',
      scripts: { start: 'ts-node compliance-reporting-manager.ts' },
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
    const pyContent = generateComplianceManagerPython(config);
    await fs.writeFile(path.join(outputDir, 'compliance_reporting_manager.py'), pyContent);

    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      'pydantic>=2.0.0\npython-dotenv>=1.0.0\n'
    );
  }

  await fs.writeFile(
    path.join(outputDir, 'compliance-reporting-config.json'),
    JSON.stringify(config, null, 2)
  );
}

/**
 * Prints a concise, colorized summary of the compliance reporting
 * configuration to the console, including the project name, providers,
 * frameworks, auto-generation flag, reporting frequency, and counts of
 * reports and controls.
 *
 * @param config - The compliance reporting configuration to display.
 */
export function displayComplianceReportingConfig(config: ComplianceReportingConfig): void {
  console.log(chalk.cyan('📊 SOX, GDPR, HIPAA Compliance Reporting and Automation'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow(`Project Name:`), chalk.white(config.projectName));
  console.log(chalk.yellow(`Providers:`), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow(`Frameworks:`), chalk.white(config.frameworks.join(', ')));
  console.log(chalk.yellow(`Auto-Generate:`), chalk.white(config.settings.autoGenerate ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Frequency:`), chalk.white(config.settings.frequency));
  console.log(chalk.yellow(`Reports:`), chalk.cyan(config.reports.length));
  console.log(chalk.yellow(`Controls:`), chalk.cyan(config.controls.length));
  console.log(chalk.gray('─'.repeat(60)));
}
