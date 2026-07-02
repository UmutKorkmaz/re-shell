// Penetration Testing Automation and Reporting with Continuous Assessment

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/** Supported categories of penetration tests (network, web, mobile, API, etc.). */
export type TestType = 'network' | 'web' | 'mobile' | 'api' | 'wireless' | 'social-engineering' | 'physical' | 'cloud' | 'iot' | 'custom';
/** Severity levels for test findings and vulnerabilities. */
export type TestSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
/** Lifecycle status values for a penetration test. */
export type TestStatus = 'planned' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
/** Categories of vulnerabilities aligned with OWASP Top 10 and custom types. */
export type VulnerabilityType = 'injection' | 'broken-authentication' | 'sensitive-data-exposure' | 'xml-external-entities' | 'broken-access-control' | 'security-misconfiguration' | 'cross-site-scripting' | 'insecure-deserialization' | 'using-components-vulnerabilities' | 'insufficient-logging' | 'custom';
/** Whether an assessment is automated, manual, or a combination of both. */
export type AssessmentType = 'automated' | 'manual' | 'hybrid';
/** The level of knowledge about the target: black-box, gray-box, or white-box. */
export type ScanMethod = 'black-box' | 'gray-box' | 'white-box';
/** The intended audience and format for a generated test report. */
export type ReportFormat = 'executive' | 'technical' | 'compliance' | 'remediation' | 'custom';
/** Functional categories for security testing tools. */
export type ToolCategory = 'scanner' | 'exploitation' | 'brute-force' | 'reconnaissance' | 'wireless' | 'web' | 'network' | 'cloud' | 'custom';

/**
 * Top-level configuration object describing a penetration testing program.
 */
export interface PenetrationTestingConfig {
  /** Name of the project being tested. */
  projectName: string;
  /** Cloud providers for which infrastructure is provisioned. */
  providers: Array<'aws' | 'azure' | 'gcp'>;
  /** Global testing settings applied across the program. */
  settings: TestingSettings;
  /** Penetration tests configured for the project. */
  tests: PenetrationTest[];
  /** Known vulnerabilities tracked across tests. */
  vulnerabilities: Vulnerability[];
  /** Scheduled or completed assessments. */
  assessments: Assessment[];
  /** Generated test reports. */
  reports: TestReport[];
  /** Analytics aggregations for reporting periods. */
  analytics: TestingAnalytics[];
  /** External integrations for scanners, ticketing, and notifications. */
  integrations: TestingIntegration[];
}

/**
 * Global settings controlling how penetration tests are scheduled and executed.
 */
export interface TestingSettings {
  /** Whether tests are scheduled automatically. */
  autoScheduling: boolean;
  /** How often tests run automatically. */
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'on-demand';
  /** The scanning method (black-box, gray-box, white-box). */
  scanMethod: ScanMethod;
  /** Whether assessments are automated, manual, or hybrid. */
  assessmentType: AssessmentType;
  /** Maximum number of tests that may run concurrently. */
  concurrentTests: number;
  /** Maximum duration of a single test in hours. */
  maxDuration: number; // hours
  /** Whether production environments may be targeted. */
  allowProduction: boolean;
  /** Whether explicit approval is required before running a test. */
  requireApproval: boolean;
  /** List of user identifiers authorized to approve tests. */
  approvers: string[];
  /** Channels (e.g. Slack, email) used for notifications. */
  notificationChannels: string[];
  /** Minimum severity at which findings trigger alerts. */
  severityThreshold: TestSeverity;
  /** Whether remediation steps are applied automatically. */
  autoRemediation: boolean;
  /** Whether continuous testing is enabled. */
  continuousTesting: boolean;
  /** Time window during which tests are permitted to run. */
  testingWindow: {
    /** Start time in HH:MM format. */
    start: string; // HH:MM
    /** End time in HH:MM format. */
    end: string; // HH:MM
    /** Timezone identifier for the testing window. */
    timezone: string;
  };
  /** Targets explicitly excluded from testing. */
  excludedTargets: string[];
  /** Compliance standards the tests must satisfy. */
  complianceStandards: string[];
  /** How long test artifacts are retained, in days. */
  retentionPeriod: number; // days
}

/**
 * Represents a single penetration test instance with its scope, findings, and metadata.
 */
export interface PenetrationTest {
  /** Unique identifier for the test. */
  id: string;
  /** Human-readable name of the test. */
  name: string;
  /** Description of what the test covers. */
  description: string;
  /** Category of the penetration test. */
  type: TestType;
  /** Current lifecycle status of the test. */
  status: TestStatus;
  /** Overall severity rating of the test. */
  severity: TestSeverity;
  /** Confidence score between 0 and 1. */
  confidence: number; // 0-1
  /** Testing methodology followed (e.g. OWASP, PTES). */
  methodology: string;
  /** When the test started, if applicable. */
  startedAt?: Date;
  /** When the test completed, if applicable. */
  completedAt?: Date;
  /** Estimated duration in hours. */
  estimatedDuration: number; // hours
  /** Actual duration in hours once the test completes. */
  actualDuration?: number; // hours
  /** Completion progress as a percentage (0-100). */
  progress: number; // 0-100
  /** Targets included in the test. */
  targets: Target[];
  /** The defined scope of the test. */
  scope: TestScope;
  /** Security tools used during the test. */
  tools: ToolUsage[];
  /** Findings discovered during the test. */
  findings: TestFinding[];
  /** Identifier of the user who approved the test. */
  approvedBy?: string;
  /** When approval was granted. */
  approvedAt?: Date;
  /** User assigned to lead the test. */
  assignedTo: string;
  /** Team members participating in the test. */
  team: string[];
  /** Tags for categorizing the test. */
  tags: string[];
  /** Arbitrary metadata for extensibility. */
  metadata: Record<string, unknown>;
}

/**
 * A target system or resource that is being tested.
 */
export interface Target {
  /** Unique identifier for the target. */
  id: string;
  /** Human-readable name of the target. */
  name: string;
  /** Kind of target (URL, IP, domain, application, etc.). */
  type: 'url' | 'ip' | 'domain' | 'network' | 'application' | 'api' | 'mobile-app' | 'custom';
  /** Address used to reach the target. */
  address: string;
  /** Description of the target. */
  description: string;
  /** Whether the target is within the agreed testing scope. */
  inScope: boolean;
  /** Priority of testing the target. */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Optional authentication details required to access the target. */
  authentication?: {
    /** Authentication mechanism used. */
    type: 'basic' | 'bearer' | 'api-key' | 'oauth' | 'custom';
    /** Credentials or token value. */
    credentials?: string;
  };
}

/**
 * Defines the boundaries and rules of a penetration test engagement.
 */
export interface TestScope {
  /** Targets or patterns explicitly included in the test. */
  include: string[];
  /** Targets or patterns explicitly excluded from the test. */
  exclude: string[];
  /** Constraints applied during testing. */
  constraints: string[];
  /** Rules of engagement for the test. */
  rules: string[];
  /** Authorization references (e.g. signed contract IDs). */
  authorizations: string[];
}

/**
 * Records how a specific security tool was used during a test.
 */
export interface ToolUsage {
  /** Unique identifier for this tool usage record. */
  id: string;
  /** Name of the security tool. */
  name: string;
  /** Functional category of the tool. */
  category: ToolCategory;
  /** Version of the tool used. */
  version: string;
  /** Command executed to run the tool. */
  command: string;
  /** Parameters passed to the tool. */
  parameters: Record<string, unknown>;
  /** Execution status of the tool invocation. */
  status: 'running' | 'completed' | 'failed' | 'skipped';
  /** When the tool started running. */
  startedAt: Date;
  /** When the tool finished running. */
  completedAt?: Date;
  /** Execution duration in seconds. */
  duration?: number; // seconds
  /** Raw output produced by the tool. */
  output: string;
  /** IDs of findings produced by the tool. */
  findings: string[];
  /** Errors encountered during execution. */
  errors: string[];
}

/**
 * A security issue discovered during a penetration test.
 */
export interface TestFinding {
  /** Unique identifier for the finding. */
  id: string;
  /** Short title summarizing the finding. */
  title: string;
  /** Detailed description of the finding. */
  description: string;
  /** Category of vulnerability identified. */
  type: VulnerabilityType;
  /** Severity rating of the finding. */
  severity: TestSeverity;
  /** Confidence score between 0 and 1. */
  confidence: number; // 0-1
  /** Impact level if the vulnerability is exploited. */
  impact: 'critical' | 'high' | 'medium' | 'low';
  /** Likelihood of exploitation. */
  likelihood: 'certain' | 'likely' | 'possible' | 'unlikely' | 'rare';
  /** CWE identifier referencing the vulnerability class. */
  cwe?: string;
  /** OWASP category reference. */
  owasp?: string;
  /** CVSS base score (0-10). */
  cvssScore?: number;
  /** CVSS vector string describing the scoring. */
  cvssVector?: string;
  /** IDs of targets affected by the finding. */
  affectedTargets: string[];
  /** Steps to reproduce the finding. */
  reproduction: string[];
  /** Evidence collected (screenshots, logs, etc.). */
  evidence: string[];
  /** Proof of concept payload or description. */
  poc?: string;
  /** Recommended remediation for the finding. */
  remediation: Remediation;
  /** External references and documentation links. */
  references: string[];
  /** Tool or tester that discovered the finding. */
  discoveredBy: string;
  /** When the finding was discovered. */
  discoveredAt: Date;
  /** Whether the finding has been verified by a human. */
  verified: boolean;
  /** Whether the finding was determined to be a false positive. */
  falsePositive?: boolean;
}

/**
 * Describes how to fix a vulnerability or finding.
 */
export interface Remediation {
  /** Description of the remediation approach. */
  description: string;
  /** Implementation complexity. */
  complexity: 'easy' | 'medium' | 'hard';
  /** Priority level for scheduling the fix. */
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  /** Estimated time to implement in hours. */
  estimatedTime: number; // hours
  /** Ordered steps to apply the remediation. */
  steps: string[];
  /** Optional code example demonstrating the fix. */
  codeExample?: string;
  /** External references for the remediation. */
  references: string[];
}

/**
 * A tracked vulnerability that may appear across multiple tests.
 */
export interface Vulnerability {
  /** Unique identifier for the vulnerability. */
  id: string;
  /** Short title describing the vulnerability. */
  title: string;
  /** Category of the vulnerability. */
  type: VulnerabilityType;
  /** Severity rating of the vulnerability. */
  severity: TestSeverity;
  /** Detailed description of the vulnerability. */
  description: string;
  /** IDs of tests where the vulnerability was found. */
  affectedTests: string[]; // Test IDs
  /** When the vulnerability was first detected. */
  firstSeen: Date;
  /** When the vulnerability was most recently detected. */
  lastSeen: Date;
  /** Number of times the vulnerability has been observed. */
  occurrences: number;
  /** Current handling status of the vulnerability. */
  status: 'open' | 'in-progress' | 'resolved' | 'false-positive' | 'accepted-risk';
  /** CVSS base score (0-10). */
  cvssScore?: number;
  /** CVSS vector string describing the scoring. */
  cvssVector?: string;
  /** CWE identifier referencing the vulnerability class. */
  cwe?: string;
  /** OWASP category reference. */
  owasp?: string;
  /** Recommended remediation, if any. */
  remediation?: Remediation;
  /** User assigned to address the vulnerability. */
  assignedTo?: string;
  /** When the vulnerability was resolved, if applicable. */
  resolvedAt?: Date;
}

/**
 * A scheduled or completed security assessment of one or more targets.
 */
export interface Assessment {
  /** Unique identifier for the assessment. */
  id: string;
  /** Human-readable name of the assessment. */
  name: string;
  /** Description of the assessment scope and purpose. */
  description: string;
  /** Whether the assessment is automated, manual, or hybrid. */
  type: AssessmentType;
  /** Scanning method used for the assessment. */
  method: ScanMethod;
  /** Current lifecycle status of the assessment. */
  status: TestStatus;
  /** When the assessment is scheduled to run. */
  scheduledFor: Date;
  /** When the assessment actually started. */
  startedAt?: Date;
  /** When the assessment completed. */
  completedAt?: Date;
  /** Duration of the assessment in hours. */
  duration?: number; // hours
  /** Targets covered by the assessment. */
  targets: Target[];
  /** Names of tools used during the assessment. */
  tools: string[];
  /** IDs of findings produced by the assessment. */
  findings: string[];
  /** IDs of vulnerabilities identified by the assessment. */
  vulnerabilities: string[];
  /** Overall risk score from 0 to 100. */
  riskScore: number; // 0-100
  /** Compliance results for applicable standards. */
  compliance: ComplianceResult[];
  /** Recommendations resulting from the assessment. */
  recommendations: string[];
}

/**
 * Compliance evaluation results against a specific standard.
 */
export interface ComplianceResult {
  /** Name of the compliance standard (e.g. PCI-DSS, HIPAA, NIST-800-53). */
  standard: string; // e.g., 'PCI-DSS', 'HIPAA', 'NIST-800-53'
  /** Overall compliance status. */
  status: 'compliant' | 'non-compliant' | 'partial';
  /** Compliance score from 0 to 100. */
  score: number; // 0-100
  /** Individual requirement checks for the standard. */
  requirements: RequirementCheck[];
}

/**
 * The result of evaluating a single compliance requirement.
 */
export interface RequirementCheck {
  /** Identifier of the requirement within its standard. */
  id: string;
  /** Text of the requirement being checked. */
  requirement: string;
  /** Whether the requirement passes, fails, or is partially met. */
  status: 'pass' | 'fail' | 'partial';
  /** Findings related to this requirement check. */
  findings: string[];
}

/**
 * A generated report documenting the results of a penetration test.
 */
export interface TestReport {
  /** Unique identifier for the report. */
  id: string;
  /** Human-readable name of the report. */
  name: string;
  /** Format and audience of the report. */
  type: ReportFormat;
  /** ID of the test this report covers. */
  testId: string;
  /** When the report was generated. */
  generatedAt: Date;
  /** User who generated the report. */
  generatedBy: string;
  /** Aggregated summary of the report findings. */
  summary: ReportSummary;
  /** Findings included in the report. */
  findings: TestFinding[];
  /** Vulnerabilities included in the report. */
  vulnerabilities: Vulnerability[];
  /** Methodology used during testing. */
  methodology: string;
  /** Scope of the test covered by the report. */
  scope: TestScope;
  /** Chronological timeline of events. */
  timeline: ReportTimeline[];
  /** Recommendations included in the report. */
  recommendations: string[];
  /** Supplementary appendices. */
  appendices: ReportAppendix[];
}

/**
 * Aggregated summary statistics for a test report.
 */
export interface ReportSummary {
  /** Total number of findings. */
  totalFindings: number;
  /** Findings broken down by severity level. */
  bySeverity: Record<TestSeverity, number>;
  /** Number of critical issues found. */
  criticalIssues: number;
  /** Number of high-severity issues found. */
  highIssues: number;
  /** Overall risk score from 0 to 100. */
  riskScore: number; // 0-100
  /** Number of tests executed. */
  testsExecuted: number;
  /** Number of distinct tools used. */
  toolsUsed: number;
}

/**
 * A single event in the chronological timeline of a test report.
 */
export interface ReportTimeline {
  /** When the event occurred. */
  timestamp: Date;
  /** Short name of the event. */
  event: string;
  /** Description of what happened. */
  description: string;
  /** User or system that performed the action. */
  actor: string;
}

/**
 * Supplementary material appended to a test report.
 */
export interface ReportAppendix {
  /** Title of the appendix section. */
  title: string;
  /** Type of content contained in the appendix. */
  type: 'code' | 'screenshot' | 'log' | 'evidence' | 'custom';
  /** Raw content of the appendix. */
  content: string;
}

/**
 * Analytics aggregation for penetration testing over a reporting period.
 */
export interface TestingAnalytics {
  /** Unique identifier for the analytics record. */
  id: string;
  /** Reporting period (e.g. "2024-Q1"). */
  period: string;
  /** Total number of tests in the period. */
  totalTests: number;
  /** Number of tests completed in the period. */
  completedTests: number;
  /** Total number of findings in the period. */
  totalFindings: number;
  /** Tests broken down by type. */
  byType: Record<TestType, number>;
  /** Findings broken down by severity. */
  bySeverity: Record<TestSeverity, number>;
  /** Mean time to complete a test, in hours. */
  meanTimeToComplete: number; // hours
  /** Percentage of findings that have been remediated. */
  remediationRate: number; // percentage
  /** Percentage of findings determined to be false positives. */
  falsePositiveRate: number; // percentage
  /** Direction of the overall risk trend. */
  riskTrend: 'improving' | 'stable' | 'degrading';
  /** Most frequently occurring vulnerability types. */
  topVulnerabilities: VulnerabilityStat[];
  /** Compliance scores across standards. */
  complianceScores: ComplianceScore[];
  /** Percentage of targets covered by testing. */
  testingCoverage: number; // percentage
  /** Usage statistics for testing tools. */
  toolsUsage: ToolUsageStat[];
}

/**
 * Statistics for a vulnerability type within an analytics period.
 */
export interface VulnerabilityStat {
  /** Category of vulnerability. */
  type: VulnerabilityType;
  /** Number of occurrences in the period. */
  count: number;
  /** Representative severity for the vulnerability type. */
  severity: TestSeverity;
  /** Direction the occurrence count is trending. */
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Compliance score for a single standard within an analytics period.
 */
export interface ComplianceScore {
  /** Name of the compliance standard. */
  standard: string;
  /** Compliance score from 0 to 100. */
  score: number;
  /** Direction the score is trending. */
  trend: 'improving' | 'stable' | 'degrading';
  /** When the standard was last assessed. */
  lastAssessed: Date;
}

/**
 * Usage statistics for a security tool within an analytics period.
 */
export interface ToolUsageStat {
  /** Name of the tool. */
  tool: string;
  /** Functional category of the tool. */
  category: ToolCategory;
  /** Number of times the tool was used. */
  usage: number; // count
  /** Number of findings the tool produced. */
  findings: number; // count
  /** Average execution duration in minutes. */
  avgDuration: number; // minutes
}

/**
 * Configuration for an external system integrated with the testing program.
 */
export interface TestingIntegration {
  /** Unique identifier for the integration. */
  id: string;
  /** Human-readable name of the integration. */
  name: string;
  /** Purpose of the integration (scanner, ticketing, etc.). */
  type: 'scanner' | 'ticketing' | 'notification' | 'repository' | 'custom';
  /** Name of the integration provider. */
  provider: string;
  /** Whether the integration is currently enabled. */
  enabled: boolean;
  /** Provider-specific configuration object. */
  config: any;
  /** Current connection status of the integration. */
  status: 'connected' | 'disconnected' | 'error';
  /** When the integration last synchronized. */
  lastSync: Date;
  /** Number of tests imported through the integration. */
  testsImported: number;
  /** Number of findings generated by the integration. */
  findingsGenerated: number;
  /** Error message if the integration is in an error state. */
  errorMessage?: string;
}

/**
 * Generate a Markdown documentation string summarizing the penetration testing configuration.
 *
 * @param config - The penetration testing configuration to document.
 * @returns A Markdown string describing tests, vulnerabilities, assessments, reports, and analytics.
 */
// Markdown Generation
export function generatePenetrationTestingMarkdown(config: PenetrationTestingConfig): string {
  return `# Penetration Testing Automation and Reporting

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Auto-Scheduling**: ${config.settings.autoScheduling ? 'Yes' : 'No'}
**Frequency**: ${config.settings.frequency}
**Scan Method**: ${config.settings.scanMethod}
**Assessment Type**: ${config.settings.assessmentType}

## Testing Settings

- **Auto-Scheduling**: ${config.settings.autoScheduling}
- **Frequency**: ${config.settings.frequency}
- **Scan Method**: ${config.settings.scanMethod}
- **Assessment Type**: ${config.settings.assessmentType}
- **Concurrent Tests**: ${config.settings.concurrentTests}
- **Max Duration**: ${config.settings.maxDuration} hours
- **Allow Production**: ${config.settings.allowProduction}
- **Require Approval**: ${config.settings.requireApproval}
- **Severity Threshold**: ${config.settings.severityThreshold}
- **Auto-Remediation**: ${config.settings.autoRemediation}
- **Continuous Testing**: ${config.settings.continuousTesting}
- **Testing Window**: ${config.settings.testingWindow.start} - ${config.settings.testingWindow.end} ${config.settings.testingWindow.timezone}
- **Compliance Standards**: ${config.settings.complianceStandards.join(', ')}

## Penetration Tests (${config.tests.length})

${config.tests.map(test => `
### ${test.name} - ${test.severity.toUpperCase()}

- **ID**: ${test.id}
- **Type**: ${test.type}
- **Status**: ${test.status}
- **Progress**: ${test.progress}%
- **Methodology**: ${test.methodology}
- **Assigned To**: ${test.assignedTo}
- **Targets**: ${test.targets.length}
- **Findings**: ${test.findings.length}
${test.startedAt ? `- **Started**: ${test.startedAt.toISOString()}` : ''}
${test.completedAt ? `- **Completed**: ${test.completedAt.toISOString()}` : ''}

**Description**: ${test.description}

**Top Findings**:
${test.findings.slice(0, 3).map(f => `- ${f.title} (${f.severity}) - CVSS: ${f.cvssScore || 'N/A'}`).join('\n')}
`).join('\n')}

## Vulnerabilities (${config.vulnerabilities.length})

${config.vulnerabilities.map(vuln => `
### ${vuln.title} - ${vuln.severity.toUpperCase()}

- **ID**: ${vuln.id}
- **Type**: ${vuln.type}
- **Status**: ${vuln.status}
- **Occurrences**: ${vuln.occurrences}
- **CVSS Score**: ${vuln.cvssScore || 'N/A'}
${vuln.cwe ? `- **CWE**: ${vuln.cwe}` : ''}
${vuln.owasp ? `- **OWASP**: ${vuln.owasp}` : ''}

**Description**: ${vuln.description}
`).join('\n')}

## Assessments (${config.assessments.length})
## Reports (${config.reports.length})
## Analytics (${config.analytics.length})
`;
}

/**
 * Generate Terraform infrastructure code for penetration testing resources.
 *
 * @param config - The penetration testing configuration to provision infrastructure for.
 * @param provider - The cloud provider (aws, azure, or gcp) to generate resources for.
 * @returns A string containing Terraform code for the specified provider.
 */
// Terraform Generation
export function generatePenetrationTestingTerraform(config: PenetrationTestingConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  if (provider === 'aws') {
    return `# AWS Penetration Testing Infrastructure
# Generated at: ${new Date().toISOString()}

resource "aws_s3_bucket" "pentest_reports" {
  bucket = "${config.projectName}-pentest-reports"

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

resource "aws_iam_role" "pentest_runner" {
  name = "${config.projectName}-pentest-runner"

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

resource "aws_lambda_function" "pentest_orchestrator" {
  filename         = "pentest_orchestrator.zip"
  function_name    = "${config.projectName}-pentest-orchestrator"
  role            = aws_iam_role.pentest_runner.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900

  environment {
    variables = {
      S3_BUCKET     = aws_s3_bucket.pentest_reports.bucket
      SNS_TOPIC_ARN = aws_sns_topic.pentest_alerts.arn
    }
  }
}

resource "aws_sns_topic" "pentest_alerts" {
  name = "${config.projectName}-pentest-alerts"
}

resource "aws_securityhub_member" "main" {
  account_id = var.aws_account_id
}

resource "aws_inspector_assessment_target" "main" {
  name = "${config.projectName}-assessment-target"
}
`;
  } else if (provider === 'azure') {
    return `# Azure Penetration Testing Infrastructure
# Generated at: ${new Date().toISOString()}

resource "azurerm_storage_account" "pentest_artifacts" {
  name                     = "${config.projectName.replace(/-/g, '')}pentest"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
}

resource "azurerm_security_center_assessment" "pentest" {
  name                       = "${config.projectName}-pentest-assessment"
  resource_group_name        = azurerm_resource_group.main.name
  severity                   = "High"
  assessment_type            = "BuiltInAssessment"

  assessment_metadata {
    description = "Automated penetration testing assessment"
    display_name = "Penetration Test"
    severity     = "High"
  }
}

resource "azurerm_logic_app_workflow" "pentest_automation" {
  name                = "${config.projectName}-pentest-automation"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
}
`;
  } else {
    return `# GCP Penetration Testing Infrastructure
# Generated at: ${new Date().toISOString()}

resource "google_storage_bucket" "pentest_results" {
  name          = "${config.projectName}-pentest-results"
  location      = "US"
  force_destroy = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

resource "google_cloud_scc_source" "pentest_findings" {
  display_name = "${config.projectName} Penetration Testing"
  organization = "var.organization_id"
  description  = "Security findings from penetration testing"
}

resource "google_pubsub_topic" "pentest_alerts" {
  name = "${config.projectName}-pentest-alerts"
}

resource "google_cloudfunctions_function" "pentest_runner" {
  name        = "${config.projectName}-pentest-runner"
  location    = "us-central1"
  runtime     = "python39"

  available_memory_mb = 512
  source_archive_bucket = google_storage_bucket.pentest_results.name
  source_archive_object = "pentest_runner.zip"
  trigger_http = true
}
`;
  }
}

/**
 * Generate a TypeScript `PenetrationTestingManager` class as source code.
 *
 * @param config - The penetration testing configuration used to seed the generated manager.
 * @returns A string containing TypeScript source code for the manager class.
 */
// TypeScript Manager Generation
export function generatePenTestManagerTypeScript(config: PenetrationTestingConfig): string {
  return `// Auto-generated Penetration Testing Manager
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';

interface Test {
  id: string;
  type: string;
  severity: string;
  status: string;
  progress: number;
}

interface Finding {
  id: string;
  title: string;
  type: string;
  severity: string;
  cvssScore?: number;
}

interface Vulnerability {
  id: string;
  title: string;
  type: string;
  severity: string;
  occurrences: number;
  status: string;
}

class PenetrationTestingManager extends EventEmitter {
  private tests: Map<string, Test> = new Map();
  private findings: Map<string, Finding> = new Map();
  private vulnerabilities: Map<string, Vulnerability> = new Map();

  async createTest(data: any): Promise<Test> {
    const test: Test = {
      id: \`test-\${Date.now()}\`,
      type: 'web',
      severity: 'high',
      status: 'planned',
      progress: 0,
    };

    this.tests.set(test.id, test);
    this.emit('test-created', test);

    return test;
  }

  async runTest(testId: string): Promise<unknown> {
    const test = this.tests.get(testId);
    if (!test) throw new Error('Test not found');

    test.status = 'running';
    test.progress = 0;

    return { testId, status: 'running', timestamp: new Date() };
  }

  async addFinding(testId: string, finding: any): Promise<Finding> {
    const newFinding: Finding = {
      id: \`finding-\${Date.now()}\`,
      title: finding.title,
      type: finding.type || 'injection',
      severity: finding.severity || 'high',
      cvssScore: finding.cvssScore,
    };

    this.findings.set(newFinding.id, newFinding);
    this.emit('finding-discovered', newFinding);

    return newFinding;
  }

  async getTestResults(testId: string): Promise<unknown> {
    const test = this.tests.get(testId);
    if (!test) throw new Error('Test not found');

    return {
      testId,
      status: test.status,
      progress: test.progress,
      findings: Array.from(this.findings.values()).filter(f => f.id.includes(testId)),
    };
  }
}

export { PenetrationTestingManager };
`;
}

/**
 * Generate a Python `PenetrationTestingManager` class as source code.
 *
 * @param config - The penetration testing configuration used to seed the generated manager.
 * @returns A string containing Python source code for the manager class.
 */
// Python Manager Generation
export function generatePenTestManagerPython(config: PenetrationTestingConfig): string {
  return `# Auto-generated Penetration Testing Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class TestStatus(str, Enum):
    PLANNED = "planned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"

class TestType(str, Enum):
    NETWORK = "network"
    WEB = "web"
    MOBILE = "mobile"
    API = "api"
    WIRELESS = "wireless"

@dataclass
class Test:
    id: str
    type: str
    severity: str
    status: str
    progress: int

@dataclass
class Finding:
    id: str
    title: str
    type: str
    severity: str
    cvss_score: Optional[float]

@dataclass
class Vulnerability:
    id: str
    title: str
    type: str
    severity: str
    occurrences: int
    status: str

class PenetrationTestingManager:
    def __init__(self):
        self.tests: Dict[str, Test] = {}
        self.findings: Dict[str, Finding] = {}
        self.vulnerabilities: Dict[str, Vulnerability] = {}

    async def create_test(self, data: Dict[str, Any]) -> Test:
        test = Test(
            id=f"test-{int(datetime.now().timestamp())}",
            type="web",
            severity="high",
            status=TestStatus.PLANNED.value,
            progress=0,
        )
        self.tests[test.id] = test
        return test

    async def run_test(self, test_id: str) -> Dict[str, Any]:
        if test_id not in self.tests:
            raise ValueError("Test not found")

        test = self.tests[test_id]
        test.status = TestStatus.RUNNING.value
        test.progress = 0
        return {"testId": test_id, "status": "running", "timestamp": datetime.now()}

    async def add_finding(self, test_id: str, finding: Dict[str, Any]) -> Finding:
        new_finding = Finding(
            id=f"finding-{int(datetime.now().timestamp())}",
            title=finding.get("title", "Unknown"),
            type=finding.get("type", "injection"),
            severity=finding.get("severity", "high"),
            cvss_score=finding.get("cvssScore"),
        )
        self.findings[new_finding.id] = new_finding
        return new_finding

    async def get_test_results(self, test_id: str) -> Dict[str, Any]:
        if test_id not in self.tests:
            raise ValueError("Test not found")

        test = self.tests[test_id]
        test_findings = [
            f for f in self.findings.values()
            if test_id in f.id or test_id in str(f.id)
        ]
        return {
            "testId": test_id,
            "status": test.status,
            "progress": test.progress,
            "findings": test_findings,
        }
`;
}

/**
 * Write all penetration testing files (documentation, Terraform, manager code, and config JSON)
 * to the specified output directory.
 *
 * @param config - The penetration testing configuration to write files for.
 * @param outputDir - The directory where files will be written.
 * @param language - The implementation language for the generated manager (typescript or python).
 * @returns A promise that resolves once all files have been written.
 */
// Write Files
export async function writePenetrationTestingFiles(
  config: PenetrationTestingConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  await fs.writeFile(
    path.join(outputDir, 'PENETRATION_TESTING.md'),
    generatePenetrationTestingMarkdown(config)
  );

  // Write Terraform configs for each provider
  for (const provider of config.providers) {
    const tfContent = generatePenetrationTestingTerraform(config, provider);
    await fs.writeFile(
      path.join(outputDir, `penetration-testing-${provider}.tf`),
      tfContent
    );
  }

  // Write manager code
  if (language === 'typescript') {
    const tsContent = generatePenTestManagerTypeScript(config);
    await fs.writeFile(path.join(outputDir, 'penetration-testing-manager.ts'), tsContent);

    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'Penetration Testing Automation and Reporting',
      main: 'penetration-testing-manager.ts',
      scripts: {
        start: 'ts-node penetration-testing-manager.ts',
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
    const pyContent = generatePenTestManagerPython(config);
    await fs.writeFile(path.join(outputDir, 'penetration_testing_manager.py'), pyContent);

    const requirements = ['pydantic>=2.0.0', 'python-dotenv>=1.0.0'];
    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      requirements.join('\n')
    );
  }

  // Write config JSON
  await fs.writeFile(
    path.join(outputDir, 'penetration-testing-config.json'),
    JSON.stringify(config, null, 2)
  );
}

/**
 * Print a human-readable summary of the penetration testing configuration to the console.
 *
 * @param config - The penetration testing configuration to display.
 */
export function displayPenetrationTestingConfig(config: PenetrationTestingConfig): void {
  console.log(chalk.cyan('🎯 Penetration Testing Automation and Reporting'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow(`Project Name:`), chalk.white(config.projectName));
  console.log(chalk.yellow(`Providers:`), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow(`Auto-Scheduling:`), chalk.white(config.settings.autoScheduling ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Frequency:`), chalk.white(config.settings.frequency));
  console.log(chalk.yellow(`Scan Method:`), chalk.white(config.settings.scanMethod));
  console.log(chalk.yellow(`Tests:`), chalk.cyan(config.tests.length));
  console.log(chalk.yellow(`Vulnerabilities:`), chalk.cyan(config.vulnerabilities.length));
  console.log(chalk.yellow(`Assessments:`), chalk.cyan(config.assessments.length));
  console.log(chalk.gray('─'.repeat(60)));
}
