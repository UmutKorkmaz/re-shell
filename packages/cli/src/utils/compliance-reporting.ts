// SOX, GDPR, HIPAA Compliance Reporting and Automation with Evidence Collection

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type ComplianceFramework = 'SOX' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'NIST-800-53' | 'ISO-27001' | 'SOC-2' | 'custom';
export type ReportStatus = 'draft' | 'in-review' | 'approved' | 'rejected' | 'archived';
export type EvidenceType = 'screenshot' | 'log-file' | 'configuration' | 'document' | 'certificate' | 'audit-trail' | 'interview-notes' | 'custom';
export type ControlStatus = 'compliant' | 'non-compliant' | 'partial' | 'not-applicable' | 'pending-review';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type ReportFormat = 'pdf' | 'html' | 'json' | 'xml' | 'csv' | 'custom';
export type EvidenceStatus = 'valid' | 'expired' | 'pending' | 'rejected' | 'superseded';
export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';
export type NotificationType = 'email' | 'slack' | 'teams' | 'webhook' | 'sms' | 'custom';

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

export interface ReportSignoff {
  role: string;
  name: string;
  email: string;
  signedAt: Date;
  signature: string;
  comments: string;
}

export interface ReportAttachment {
  name: string;
  type: string;
  size: number;
  location: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface ReportMetadata {
  version: string;
  lastModified: Date;
  modifiedBy: string;
  reviewCycle: string;
  auditTrail: AuditEntry[];
  tags: string[];
}

export interface AuditEntry {
  timestamp: Date;
  user: string;
  action: string;
  details: string;
}

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

export interface TestProcedure {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  expectedResults: string[];
  tools: string[];
  estimatedTime: number; // minutes
}

export interface TestStep {
  order: number;
  action: string;
  expectedResult: string;
  screenshot: boolean;
}

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

export interface ManualCheck {
  id: string;
  name: string;
  instructions: string;
  checklist: ChecklistItem[];
  frequency: string;
  assignee: string;
  dueDate: Date;
}

export interface ChecklistItem {
  item: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
}

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

export interface ComplianceMapping {
  framework: ComplianceFramework;
  controlId: string;
  mappingType: 'equivalent' | 'partial' | 'custom';
  notes: string;
}

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
  metadata: Record<string, any>;
}

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

export interface AssessmentScope {
  includedAssets: string[];
  excludedAssets: string[];
  locations: string[];
  departments: string[];
  processes: string[];
  thirdParties: string[];
}

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

export interface Milestone {
  id: string;
  name: string;
  description: string;
  targetDate: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'missed';
  tasks: string[];
}

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

export interface NotificationTrigger {
  event: 'report-ready' | 'finding-detected' | 'deadline-approaching' | 'deadline-missed' | 'remediation-complete' | 'custom';
  severity?: RiskLevel;
  threshold?: number;
}

// Markdown Generation
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
