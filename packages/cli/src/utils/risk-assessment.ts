// Risk Assessment and Management with Continuous Monitoring

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions
export type RiskCategory = 'security' | 'compliance' | 'operational' | 'financial' | 'reputational' | 'strategic' | 'technology' | 'custom';
export type RiskStatus = 'identified' | 'analyzing' | 'mitigating' | 'mitigated' | 'accepted' | 'transferred' | 'closed' | 'escalated';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type Likelihood = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
export type Impact = 'catastrophic' | 'major' | 'moderate' | 'minor' | 'negligible';
export type MitigationStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'overdue' | 'cancelled';
export type MonitorStatus = 'active' | 'inactive' | 'paused' | 'error';
export type AlertPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AssessmentType = 'initial' | 'periodic' | 'event-driven' | 'exception-request' | 'post-incident' | 'custom';

export interface RiskAssessmentConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: RiskSettings;
  risks: IdentifiedRisk[];
  assessments: RiskAssessment[];
  mitigations: MitigationPlan[];
  monitors: RiskMonitor[];
  alerts: RiskAlert[];
  controls: RiskControl[];
  matrices: RiskMatrix[];
  reports: RiskReport[];
  thresholds: RiskThreshold[];
  dependencies: RiskDependency[];
  scenarios: RiskScenario[];
}

export interface RiskSettings {
  autoAssessment: boolean;
  assessmentFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'on-demand';
  enableContinuousMonitoring: boolean;
  monitoringInterval: number; // minutes
  enableRealTimeAlerts: boolean;
  alertEscalationEnabled: boolean;
  riskAcceptanceThreshold: number; // 0-100
  requireApprovalForAcceptance: boolean;
  riskApprovers: string[];
  autoCreateMitigation: boolean;
  mitigationTemplate: string;
  enableRiskHeatmap: boolean;
  heatmapRefreshInterval: number; // minutes
  enableTrendAnalysis: boolean;
  trendAnalysisPeriod: number; // days
  enablePredictiveAnalysis: boolean;
  predictiveModel: string;
  enableDependencyTracking: boolean;
  enableComplianceMapping: boolean;
  complianceFrameworks: Array<'sox' | 'gdpr' | 'hipaa' | 'pci-dss' | 'iso-27001' | 'nist-800-53'>;
  retentionDays: number;
  archiveLocation: string;
  enableReporting: boolean;
  reportSchedule: string;
  stakeholders: string[];
}

export interface IdentifiedRisk {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  status: RiskStatus;
  level: RiskLevel;
  likelihood: Likelihood;
  impact: Impact;
  score: number; // 0-100
  calculatedAt: Date;
  source: string;
  owner: string;
  assignee?: string;
  tags: string[];
  relatedAssets: string[];
  dependencies: string[]; // risk IDs
  mitigation?: string; // mitigation plan ID
  assessment: string; // assessment ID
  findings: RiskFinding[];
  history: RiskHistoryEntry[];
  metadata: RiskMetadata;
}

export interface RiskFinding {
  id: string;
  title: string;
  description: string;
  severity: RiskLevel;
  confidence: number; // 0-100
  discoveredAt: Date;
  discoveredBy: string;
  method: 'automated' | 'manual' | 'third-party' | 'incident';
  evidence: string[]; // evidence IDs
  recommendations: string[];
}

export interface RiskHistoryEntry {
  timestamp: Date;
  user: string;
  action: string;
  details: string;
  previousState?: {
    status?: RiskStatus;
    level?: RiskLevel;
    score?: number;
  };
  newState?: {
    status?: RiskStatus;
    level?: RiskLevel;
    score?: number;
  };
}

export interface RiskMetadata {
  created: Date;
  createdBy: string;
  lastModified: Date;
  modifiedBy: string;
  lastAssessed: Date;
  assessedBy: string;
  nextReview: Date;
  externalReferences: string[];
  complianceMapping: ComplianceMapping[];
  customFields: Record<string, any>;
}

export interface ComplianceMapping {
  framework: string;
  requirement: string;
  control: string;
  mapped: boolean;
}

export interface RiskAssessment {
  id: string;
  name: string;
  type: AssessmentType;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  startDate: Date;
  endDate?: Date;
  assessedBy: string;
  reviewers: string[];
  scope: AssessmentScope;
  risks: string[]; // risk IDs
  methodology: string;
  findings: AssessmentFinding[];
  overallScore: number; // 0-100
  riskDistribution: Record<RiskLevel, number>;
  recommendations: string[];
  approvedBy?: string;
  approvedAt?: Date;
  nextAssessment: Date;
}

export interface AssessmentScope {
  assets: string[];
  departments: string[];
  processes: string[];
  thirdParties: string[];
  locations: string[];
  excludeAssets: string[];
}

export interface AssessmentFinding {
  id: string;
  riskId: string;
  title: string;
  description: string;
  severity: RiskLevel;
  likelihood: Likelihood;
  impact: Impact;
  score: number;
  mitigations: string[];
  priority: number;
}

export interface MitigationPlan {
  id: string;
  riskId: string;
  name: string;
  description: string;
  status: MitigationStatus;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTo: string;
  createdBy: string;
  createdAt: Date;
  targetDate: Date;
  completedDate?: Date;
  tasks: MitigationTask[];
  budget?: number;
  spent?: number;
  progress: number; // 0-100
  blockers: string[];
  dependencies: string[];
  effectiveness?: 'highly-effective' | 'effective' | 'partially-effective' | 'ineffective' | 'unknown';
}

export interface MitigationTask {
  id: string;
  title: string;
  description: string;
  status: MitigationStatus;
  assignedTo: string;
  dueDate: Date;
  completedDate?: Date;
  estimatedHours: number;
  actualHours?: number;
  dependencies: string[];
  checklist: ChecklistItem[];
}

export interface ChecklistItem {
  item: string;
  completed: boolean;
  completedBy?: string;
  completedDate?: Date;
}

export interface RiskMonitor {
  id: string;
  name: string;
  description: string;
  status: MonitorStatus;
  type: 'automated' | 'manual' | 'hybrid';
  frequency: 'continuous' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  riskIds: string[];
  metrics: MonitoredMetric[];
  conditions: MonitorCondition[];
  alertRules: AlertRule[];
  lastRun: Date;
  nextRun: Date;
  owner: string;
}

export interface MonitoredMetric {
  id: string;
  name: string;
  source: string;
  query: string;
  aggregation: 'avg' | 'sum' | 'count' | 'max' | 'min';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  window: number; // minutes
}

export interface MonitorCondition {
  id: string;
  metricId: string;
  condition: string;
  severity: RiskLevel;
  action: 'alert' | 'escalate' | 'auto-mitigate' | 'create-ticket';
}

export interface AlertRule {
  id: string;
  name: string;
  priority: AlertPriority;
  recipients: string[];
  channels: Array<'email' | 'slack' | 'teams' | 'pagerduty' | 'sms'>;
  template: string;
  throttleMinutes: number;
  escalationRules?: EscalationRule[];
}

export interface EscalationRule {
  delay: number; // minutes
  level: number;
  recipients: string[];
  channels: Array<'email' | 'slack' | 'teams' | 'pagerduty' | 'sms'>;
}

export interface RiskAlert {
  id: string;
  monitorId: string;
  riskId: string;
  severity: AlertPriority;
  title: string;
  description: string;
  triggeredAt: Date;
  triggeredBy: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false-positive';
  metrics: Record<string, number>;
  context: Record<string, any>;
  actions: AlertAction[];
}

export interface AlertAction {
  action: string;
  performedBy?: string;
  performedAt?: Date;
  result?: string;
}

export interface RiskControl {
  id: string;
  name: string;
  description: string;
  type: 'preventive' | 'detective' | 'corrective' | 'compensating';
  category: string;
  effectiveness: 'high' | 'medium' | 'low';
  implemented: boolean;
  implementationDate?: Date;
  owner: string;
  cost: number;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  lastTested?: Date;
  nextTest: Date;
  testResults: ControlTestResult[];
  relatedRisks: string[]; // risk IDs
}

export interface ControlTestResult {
  id: string;
  testDate: Date;
  testedBy: string;
  result: 'pass' | 'fail' | 'partial';
  findings: string[];
  evidence: string[];
}

export interface RiskMatrix {
  id: string;
  name: string;
  description: string;
  likelihoods: Likelihood[];
  impacts: Impact[];
  scores: Record<string, Record<string, number>>; // [likelihood][impact] -> score
  levels: Record<number, RiskLevel>; // score -> level
  colors: Record<RiskLevel, string>;
  enabled: boolean;
}

export interface RiskReport {
  id: string;
  name: string;
  type: 'executive' | 'technical' | 'compliance' | 'custom';
  generatedAt: Date;
  generatedBy: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: ReportSummary;
  topRisks: string[]; // risk IDs
  trends: RiskTrend[];
  recommendations: string[];
  charts: ReportChart[];
  filters: ReportFilter[];
}

export interface ReportSummary {
  totalRisks: number;
  byLevel: Record<RiskLevel, number>;
  byCategory: Record<RiskCategory, number>;
  byStatus: Record<RiskStatus, number>;
  averageScore: number;
  mitigated: number;
  pending: number;
  overdue: number;
}

export interface RiskTrend {
  riskId: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  change: number; // percentage
  period: number; // days
}

export interface ReportChart {
  type: 'bar' | 'line' | 'pie' | 'heatmap' | 'scatter';
  title: string;
  data: any;
  config?: Record<string, any>;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'not-in' | 'gt' | 'lt' | 'contains';
  value: any;
}

export interface RiskThreshold {
  id: string;
  name: string;
  type: 'score' | 'likelihood' | 'impact' | 'custom';
  metric: string;
  condition: string;
  action: 'alert' | 'block' | 'require-approval' | 'auto-remediate';
  severity: RiskLevel;
  enabled: boolean;
}

export interface RiskDependency {
  id: string;
  sourceRisk: string; // risk ID
  targetRisk: string; // risk ID
  type: 'causes' | 'increases' | 'mitigated-by' | 'related-to';
  strength: 'strong' | 'moderate' | 'weak';
  description: string;
}

export interface RiskScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  probability: number; // 0-100
  impactFactors: ImpactFactor[];
  involvedRisks: string[]; // risk IDs
  mitigation?: string; // mitigation plan ID
  lastReviewed: Date;
  nextReview: Date;
}

export interface ImpactFactor {
  factor: string;
  impact: Impact;
  description: string;
}

// Generate markdown documentation
export function generateRiskMarkdown(config: RiskAssessmentConfig): string {
  const lines: string[] = [];

  lines.push('# Risk Assessment and Management');
  lines.push('');
  lines.push(`**Project**: ${config.projectName}`);
  lines.push(`**Providers**: ${config.providers.join(', ')}`);
  lines.push(`**Auto-Assessment**: ${config.settings.autoAssessment}`);
  lines.push(`**Continuous Monitoring**: ${config.settings.enableContinuousMonitoring}`);
  lines.push('');

  // Settings
  lines.push('## Risk Management Settings');
  lines.push('');
  lines.push(`- **Auto-Assessment**: ${config.settings.autoAssessment}`);
  lines.push(`- **Assessment Frequency**: ${config.settings.assessmentFrequency}`);
  lines.push(`- **Continuous Monitoring**: ${config.settings.enableContinuousMonitoring}`);
  lines.push(`- **Monitoring Interval**: ${config.settings.monitoringInterval} min`);
  lines.push(`- **Real-Time Alerts**: ${config.settings.enableRealTimeAlerts}`);
  lines.push(`- **Alert Escalation**: ${config.settings.alertEscalationEnabled ? 'Enabled' : 'Disabled'}`);
  lines.push(`- **Risk Acceptance Threshold**: ${config.settings.riskAcceptanceThreshold}/100`);
  lines.push(`- **Require Approval for Acceptance**: ${config.settings.requireApprovalForAcceptance ? 'Yes' : 'No'}`);
  lines.push(`- **Auto-Create Mitigation**: ${config.settings.autoCreateMitigation ? 'Yes' : 'No'}`);
  lines.push(`- **Risk Heatmap**: ${config.settings.enableRiskHeatmap ? 'Enabled' : 'Disabled'}`);
  lines.push(`- **Trend Analysis**: ${config.settings.enableTrendAnalysis ? `Enabled (${config.settings.trendAnalysisPeriod} days)` : 'Disabled'}`);
  lines.push(`- **Predictive Analysis**: ${config.settings.enablePredictiveAnalysis ? `Enabled (${config.settings.predictiveModel})` : 'Disabled'}`);
  lines.push(`- **Dependency Tracking**: ${config.settings.enableDependencyTracking ? 'Enabled' : 'Disabled'}`);
  lines.push(`- **Compliance Mapping**: ${config.settings.enableComplianceMapping ? `Enabled (${config.settings.complianceFrameworks.join(', ')})` : 'Disabled'}`);
  lines.push(`- **Retention**: ${config.settings.retentionDays} days`);
  lines.push('');

  // Identified Risks
  if (config.risks.length > 0) {
    lines.push(`## Identified Risks (${config.risks.length})`);
    lines.push('');

    const levelOrder: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
    for (const level of levelOrder) {
      const levelRisks = config.risks.filter(r => r.level === level);
      if (levelRisks.length > 0) {
        lines.push(`### ${level.toUpperCase()} Risks (${levelRisks.length})`);
        lines.push('');
        for (const risk of levelRisks) {
          const statusIcon = risk.status === 'mitigated' ? '✓' : risk.status === 'mitigating' ? '⟳' : '○';
          lines.push(`#### [${statusIcon}] ${risk.title}`);
          lines.push('');
          lines.push(`- **ID**: ${risk.id}`);
          lines.push(`- **Category**: ${risk.category}`);
          lines.push(`- **Status**: ${risk.status}`);
          lines.push(`- **Score**: ${risk.score}/100`);
          lines.push(`- **Likelihood**: ${risk.likelihood}`);
          lines.push(`- **Impact**: ${risk.impact}`);
          lines.push(`- **Owner**: ${risk.owner}`);
          lines.push(`- **Assignee**: ${risk.assignee || 'Unassigned'}`);
          lines.push(`- **Source**: ${risk.source}`);

          if (risk.findings.length > 0) {
            lines.push(`- **Findings**: ${risk.findings.length}`);
            for (const finding of risk.findings.slice(0, 3)) {
              lines.push(`  - [${finding.severity}] ${finding.title}`);
            }
          }

          if (risk.mitigation) {
            lines.push(`- **Mitigation**: ${risk.mitigation}`);
          }

          lines.push('');
        }
      }
    }
  }

  // Assessments
  if (config.assessments.length > 0) {
    lines.push(`## Risk Assessments (${config.assessments.length})`);
    lines.push('');

    for (const assessment of config.assessments) {
      const statusIcon = assessment.status === 'completed' ? '✓' : assessment.status === 'in-progress' ? '⟳' : '○';
      lines.push(`### [${statusIcon}] ${assessment.name}`);
      lines.push('');
      lines.push(`- **Type**: ${assessment.type}`);
      lines.push(`- **Status**: ${assessment.status}`);
      lines.push(`- **Assessed By**: ${assessment.assessedBy}`);
      lines.push(`- **Period**: ${assessment.startDate.toISOString()} to ${assessment.endDate?.toISOString() || 'Ongoing'}`);
      lines.push(`- **Overall Score**: ${assessment.overallScore}/100`);
      lines.push(`- **Risks Assessed**: ${assessment.risks.length}`);
      lines.push(`- **Next Assessment**: ${assessment.nextAssessment.toISOString().split('T')[0]}`);

      if (assessment.riskDistribution) {
        lines.push(`- **Distribution**:`);
        for (const [level, count] of Object.entries(assessment.riskDistribution)) {
          lines.push(`  - ${level}: ${count}`);
        }
      }

      lines.push('');
    }
  }

  // Mitigations
  if (config.mitigations.length > 0) {
    lines.push(`## Mitigation Plans (${config.mitigations.length})`);
    lines.push('');

    for (const mitigation of config.mitigations) {
      const statusIcon = mitigation.status === 'completed' ? '✓' : mitigation.status === 'in-progress' ? '⟳' : '○';
      lines.push(`### [${statusIcon}] ${mitigation.name}`);
      lines.push('');
      lines.push(`- **Risk**: ${mitigation.riskId}`);
      lines.push(`- **Status**: ${mitigation.status}`);
      lines.push(`- **Priority**: ${mitigation.priority}`);
      lines.push(`- **Assigned To**: ${mitigation.assignedTo}`);
      lines.push(`- **Progress**: ${mitigation.progress}%`);
      lines.push(`- **Target Date**: ${mitigation.targetDate.toISOString().split('T')[0]}`);
      lines.push(`- **Tasks**: ${mitigation.tasks.length}`);

      if (mitigation.blockers.length > 0) {
        lines.push(`- **Blockers**: ${mitigation.blockers.join(', ')}`);
      }

      lines.push('');
    }
  }

  // Monitors
  if (config.monitors.length > 0) {
    lines.push(`## Risk Monitors (${config.monitors.length})`);
    lines.push('');

    for (const monitor of config.monitors) {
      const statusIcon = monitor.status === 'active' ? '🟢' : monitor.status === 'paused' ? '⏸️' : '🔴';
      lines.push(`### ${statusIcon} ${monitor.name}`);
      lines.push('');
      lines.push(`- **Type**: ${monitor.type}`);
      lines.push(`- **Frequency**: ${monitor.frequency}`);
      lines.push(`- **Status**: ${monitor.status}`);
      lines.push(`- **Owner**: ${monitor.owner}`);
      lines.push(`- **Metrics**: ${monitor.metrics.length}`);
      lines.push(`- **Conditions**: ${monitor.conditions.length}`);
      lines.push(`- **Alert Rules**: ${monitor.alertRules.length}`);
      lines.push('');
    }
  }

  // Controls
  if (config.controls.length > 0) {
    lines.push(`## Risk Controls (${config.controls.length})`);
    lines.push('');

    const typeGroups = config.controls.reduce((acc, c) => {
      acc[c.type] = acc[c.type] || [];
      acc[c.type].push(c);
      return acc;
    }, {} as Record<string, typeof config.controls>);

    for (const [type, controls] of Object.entries(typeGroups)) {
      lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)} (${controls.length})`);
      lines.push('');
      for (const control of controls) {
        const implIcon = control.implemented ? '✓' : '○';
        lines.push(`- [${implIcon}] **${control.name}** - ${control.effectiveness} effectiveness - Owner: ${control.owner}`);
      }
      lines.push('');
    }
  }

  // Alerts
  if (config.alerts.length > 0) {
    lines.push(`## Risk Alerts (${config.alerts.length})`);
    lines.push('');

    for (const alert of config.alerts) {
      const statusIcon = alert.status === 'open' ? '🔴' : alert.status === 'investigating' ? '🟡' : '🟢';
      lines.push(`### ${statusIcon} ${alert.title} (${alert.severity.toUpperCase()})`);
      lines.push('');
      lines.push(`- **Risk**: ${alert.riskId}`);
      lines.push(`- **Status**: ${alert.status}`);
      lines.push(`- **Triggered**: ${alert.triggeredAt.toISOString()}`);
      lines.push(`- **Description**: ${alert.description}`);

      if (alert.actions.length > 0) {
        lines.push(`- **Actions**:`);
        for (const action of alert.actions) {
          lines.push(`  - ${action.action}${action.performedBy ? ` by ${action.performedBy}` : ''}`);
        }
      }

      lines.push('');
    }
  }

  // Scenarios
  if (config.scenarios.length > 0) {
    lines.push(`## Risk Scenarios (${config.scenarios.length})`);
    lines.push('');

    for (const scenario of config.scenarios) {
      lines.push(`### ${scenario.name}`);
      lines.push('');
      lines.push(`- **Category**: ${scenario.category}`);
      lines.push(`- **Probability**: ${scenario.probability}%`);
      lines.push(`- **Impact Factors**: ${scenario.impactFactors.length}`);
      lines.push(`- **Involved Risks**: ${scenario.involvedRisks.length}`);
      lines.push(`- **Next Review**: ${scenario.nextReview.toISOString().split('T')[0]}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Generate Terraform configuration
export function generateRiskTerraform(config: RiskAssessmentConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  const lines: string[] = [];

  lines.push('# Risk Assessment and Management Infrastructure');
  lines.push(`# Provider: ${provider.toUpperCase()}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (provider === 'aws') {
    lines.push('# DynamoDB Table for risk records');
    lines.push(`resource "aws_dynamodb_table" "risk_records" {`);
    lines.push(`  name           = "\${var.project-name}-risk-records"`);
    lines.push(`  hash_key       = "id"`);
    lines.push(`  billing_mode   = "PAY_PER_REQUEST"`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "id"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  server_side_encryption {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  point_in_time_recovery {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# DynamoDB Table for risk alerts');
    lines.push(`resource "aws_dynamodb_table" "risk_alerts" {`);
    lines.push(`  name           = "\${var.project-name}-risk-alerts"`);
    lines.push(`  hash_key       = "id"`);
    lines.push(`  range_key      = "severity"`);
    lines.push(`  billing_mode   = "PAY_PER_REQUEST"`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "id"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "severity"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  server_side_encryption {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# S3 Bucket for evidence storage');
    lines.push(`resource "aws_s3_bucket" "risk_evidence" {`);
    lines.push(`  bucket = "\${var.project-name}-risk-evidence"`);
    lines.push(`  tags = {`);
    lines.push(`    Name = "\${var.project-name}-risk-evidence"`);
    lines.push(`    Purpose = "Risk Management"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_s3_bucket_versioning" "risk_evidence" {`);
    lines.push(`  bucket = aws_s3_bucket.risk_evidence.id`);
    lines.push(`  versioning_configuration {`);
    lines.push(`    status = "Enabled"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Lambda Function for risk assessment');
    lines.push(`resource "aws_lambda_function" "risk_assessor" {`);
    lines.push(`  filename      = "risk_assessor.zip"`);
    lines.push(`  function_name = "\${var.project-name}-risk-assessor"`);
    lines.push(`  role          = aws_iam_role.risk_lambda_role.arn`);
    lines.push(`  handler       = "index.handler"`);
    lines.push('');
    lines.push(`  environment {`);
    lines.push(`    variables = {`);
    lines.push(`      RISKS_TABLE = aws_dynamodb_table.risk_records.id`);
    lines.push(`      ALERTS_TABLE = aws_dynamodb_table.risk_alerts.id`);
    lines.push(`      EVIDENCE_BUCKET = aws_s3_bucket.risk_evidence.id`);
    lines.push(`      ACCEPTANCE_THRESHOLD = tostring(${config.settings.riskAcceptanceThreshold})`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# CloudWatch Alarms for risk monitoring');
    lines.push(`resource "aws_cloudwatch_metric_alarm" "risk_score_high" {`);
    lines.push(`  alarm_name          = "\${var.project-name}-risk-score-high"`);
    lines.push(`  comparison_operator = "GreaterThanThreshold"`);
    lines.push(`  evaluation_periods  = "1"`);
    lines.push(`  metric_name         = "RiskScore"`);
    lines.push(`  namespace           = "RiskManagement"`);
    lines.push(`  period              = "300"`);
    lines.push(`  statistic           = "Average"`);
    lines.push(`  threshold           = "70"`);
    lines.push(`  alarm_description   = "This metric monitors risk score"`);
    lines.push(`  alarm_actions       = [aws_sns_topic.risk_alerts.arn]`);
    lines.push(`}`);
    lines.push('');

    lines.push('# SNS Topic for risk alerts');
    lines.push(`resource "aws_sns_topic" "risk_alerts" {`);
    lines.push(`  name = "\${var.project-name}-risk-alerts"`);
    lines.push(`}`);
    lines.push('');

  } else if (provider === 'azure') {
    lines.push('# Storage Account for evidence');
    lines.push(`resource "azurerm_storage_account" "risk_evidence" {`);
    lines.push(`  name                     = "\${var.project-name}risevidence"`);
    lines.push(`  resource_group_name      = var.resource-group-name`);
    lines.push(`  location                 = var.location`);
    lines.push(`  account_tier             = "Standard"`);
    lines.push(`  account_replication_type = "GRS"`);
    lines.push(`  enable_https_traffic_only = true`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cosmos DB for risk records');
    lines.push(`resource "azurerm_cosmosdb_account" "risk_management" {`);
    lines.push(`  name                = "\${var.project-name}-risk-db"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  offer_type          = "Standard"`);
    lines.push(`  kind                = "GlobalDocumentDB"`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Function App for risk assessment');
    lines.push(`resource "azurerm_function_app" "risk_assessor" {`);
    lines.push(`  name                = "\${var.project-name}-risk-assessor"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  app_service_plan_id = azurerm_app_service_plan.risk.id`);
    lines.push('');
    lines.push(`  app_settings = {`);
    lines.push(`    RISKS_CONNECTION = azurerm_cosmosdb_account.risk_management.connection_string`);
    lines.push(`    ACCEPTANCE_THRESHOLD = tostring(${config.settings.riskAcceptanceThreshold})`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

  } else if (provider === 'gcp') {
    lines.push('# GCS Bucket for evidence');
    lines.push(`resource "google_storage_bucket" "risk_evidence" {`);
    lines.push(`  name          = "\${var.project-name}-risk-evidence"`);
    lines.push(`  location      = var.location`);
    lines.push(`  force_destroy = false`);
    lines.push(`  uniform_bucket_level_access = true`);
    lines.push('');
    lines.push(`  versioning {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Firestore for risk records');
    lines.push(`resource "google_firestore_database" "risk_records" {`);
    lines.push(`  name     = "\${var.project-name}-risk-records"`);
    lines.push(`  location = var.location`);
    lines.push(`  type     = "FIRESTORE_NATIVE"`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cloud Functions for risk assessment');
    lines.push(`resource "google_cloudfunctions_v2_function" "risk_assessor" {`);
    lines.push(`  name        = "\${var.project-name}-risk-assessor"`);
    lines.push(`  location    = var.location`);
    lines.push(`  description = "Automated risk assessment"`);
    lines.push('');
    lines.push(`  build_config {`);
    lines.push(`    runtime     = "nodejs20"`);
    lines.push(`    entry_point = "assessRisk"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  environment_variables = {`);
    lines.push(`    ACCEPTANCE_THRESHOLD = tostring(${config.settings.riskAcceptanceThreshold})`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// Generate TypeScript manager class
export function generateTypeScriptManager(): string {
  return `// Risk Assessment Manager - TypeScript

import { EventEmitter } from 'events';

export type RiskCategory = 'security' | 'compliance' | 'operational' | 'financial' | 'reputational' | 'strategic' | 'technology';
export type RiskStatus = 'identified' | 'analyzing' | 'mitigating' | 'mitigated' | 'accepted' | 'transferred' | 'closed';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type Likelihood = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';
export type Impact = 'catastrophic' | 'major' | 'moderate' | 'minor' | 'negligible';
export type MitigationStatus = 'not-started' | 'in-progress' | 'completed' | 'blocked' | 'overdue';

export interface IdentifiedRisk {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  status: RiskStatus;
  level: RiskLevel;
  likelihood: Likelihood;
  impact: Impact;
  score: number;
  calculatedAt: Date;
  source: string;
  owner: string;
  assignee?: string;
  mitigation?: string;
  tags: string[];
  relatedAssets: string[];
}

export interface RiskAssessment {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  startDate: Date;
  endDate?: Date;
  assessedBy: string;
  risks: string[];
  overallScore: number;
  riskDistribution: Record<RiskLevel, number>;
  nextAssessment: Date;
}

export interface MitigationPlan {
  id: string;
  riskId: string;
  name: string;
  status: MitigationStatus;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTo: string;
  targetDate: Date;
  progress: number;
  tasks: MitigationTask[];
}

export interface MitigationTask {
  id: string;
  title: string;
  status: MitigationStatus;
  assignedTo: string;
  dueDate: Date;
  estimatedHours: number;
  completed?: boolean;
}

export interface RiskMonitor {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'paused';
  type: 'automated' | 'manual' | 'hybrid';
  frequency: 'continuous' | 'hourly' | 'daily' | 'weekly';
  riskIds: string[];
  conditions: MonitorCondition[];
  lastRun: Date;
  nextRun: Date;
}

export interface MonitorCondition {
  metricId: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  severity: RiskLevel;
  action: 'alert' | 'escalate' | 'auto-mitigate';
}

export class RiskAssessmentManager extends EventEmitter {
  private risks: Map<string, IdentifiedRisk> = new Map();
  private assessments: Map<string, RiskAssessment> = new Map();
  private mitigations: Map<string, MitigationPlan> = new Map();
  private monitors: Map<string, RiskMonitor> = new Map();
  private riskMatrix: RiskMatrix;

  constructor() {
    super();
    this.riskMatrix = this.initializeRiskMatrix();
  }

  // Risk Management
  async createRisk(risk: Omit<IdentifiedRisk, 'id' | 'calculatedAt' | 'score'>): Promise<IdentifiedRisk> {
    const id = this.generateId('risk');
    const score = this.calculateRiskScore(risk.likelihood, risk.impact);
    const level = this.getRiskLevel(score);

    const newRisk: IdentifiedRisk = {
      ...risk,
      id,
      score,
      level,
      calculatedAt: new Date(),
    };

    this.risks.set(id, newRisk);
    this.emit('riskCreated', newRisk);

    // Auto-create mitigation if enabled
    if (this.shouldAutoCreateMitigation(newRisk)) {
      await this.createMitigationPlan({
        riskId: id,
        name: \`Mitigation for \${risk.title}\`,
        priority: level,
        assignedTo: risk.owner,
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'not-started',
        progress: 0,
        tasks: [],
      });
    }

    return newRisk;
  }

  async updateRisk(id: string, updates: Partial<IdentifiedRisk>): Promise<IdentifiedRisk | null> {
    const risk = this.risks.get(id);
    if (!risk) return null;

    const updated = { ...risk, ...updates };
    this.risks.set(id, updated);
    this.emit('riskUpdated', updated);
    return updated;
  }

  async assessRisk(id: string): Promise<IdentifiedRisk | null> {
    const risk = this.risks.get(id);
    if (!risk) return null;

    const newScore = this.calculateRiskScore(risk.likelihood, risk.impact);
    const newLevel = this.getRiskLevel(newScore);

    return this.updateRisk(id, {
      score: newScore,
      level: newLevel,
      calculatedAt: new Date(),
    });
  }

  getRisk(id: string): IdentifiedRisk | undefined {
    return this.risks.get(id);
  }

  listRisks(filter?: { level?: RiskLevel; status?: RiskStatus; category?: RiskCategory }): IdentifiedRisk[] {
    let risks = Array.from(this.risks.values());

    if (filter?.level) {
      risks = risks.filter(r => r.level === filter.level);
    }
    if (filter?.status) {
      risks = risks.filter(r => r.status === filter.status);
    }
    if (filter?.category) {
      risks = risks.filter(r => r.category === filter.category);
    }

    return risks.sort((a, b) => b.score - a.score);
  }

  // Assessment Management
  async createAssessment(assessment: Omit<RiskAssessment, 'id'>): Promise<RiskAssessment> {
    const id = this.generateId('assessment');
    const risksToAssess = assessment.risks.map(riskId => this.risks.get(riskId)).filter(Boolean) as IdentifiedRisk[];

    const riskDistribution: Record<RiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalScore = 0;
    for (const risk of risksToAssess) {
      await this.assessRisk(risk.id);
      riskDistribution[risk.level]++;
      totalScore += risk.score;
    }

    const overallScore = risksToAssess.length > 0 ? totalScore / risksToAssess.length : 0;

    const newAssessment: RiskAssessment = {
      ...assessment,
      id,
      overallScore,
      riskDistribution,
    };

    this.assessments.set(id, newAssessment);
    this.emit('assessmentCreated', newAssessment);
    return newAssessment;
  }

  // Mitigation Management
  async createMitigationPlan(plan: Omit<MitigationPlan, 'id' | 'tasks'>): Promise<MitigationPlan> {
    const id = this.generateId('mitigation');
    const tasks = this.generateDefaultTasks(plan);

    const newPlan: MitigationPlan = {
      ...plan,
      id,
      tasks,
    };

    this.mitigations.set(id, newPlan);
    this.emit('mitigationCreated', newPlan);
    return newPlan;
  }

  async updateMitigationProgress(id: string, progress: number): Promise<MitigationPlan | null> {
    const plan = this.mitigations.get(id);
    if (!plan) return null;

    plan.progress = progress;
    if (progress >= 100) {
      plan.status = 'completed';
      // Update associated risk status
      const risk = this.risks.get(plan.riskId);
      if (risk) {
        await this.updateRisk(risk.id, { status: 'mitigated' });
      }
    }

    this.mitigations.set(id, plan);
    this.emit('mitigationUpdated', plan);
    return plan;
  }

  // Monitoring
  async createMonitor(monitor: Omit<RiskMonitor, 'id' | 'nextRun'>): Promise<RiskMonitor> {
    const id = this.generateId('monitor');
    const nextRun = this.calculateNextRun(monitor.frequency);

    const newMonitor: RiskMonitor = {
      ...monitor,
      id,
      nextRun,
    };

    this.monitors.set(id, newMonitor);
    this.emit('monitorCreated', newMonitor);
    return newMonitor;
  }

  async runMonitor(id: string): Promise<void> {
    const monitor = this.monitors.get(id);
    if (!monitor || monitor.status !== 'active') return;

    const now = new Date();
    const risks = monitor.riskIds.map(riskId => this.risks.get(riskId)).filter(Boolean) as IdentifiedRisk[];

    for (const condition of monitor.conditions) {
      for (const risk of risks) {
        const value = risk.score;
        const triggered = this.evaluateCondition(value, condition);

        if (triggered) {
          this.emit('riskAlert', {
            monitorId: id,
            riskId: risk.id,
            severity: condition.severity,
            condition: condition,
            value,
            timestamp: now,
          });
        }
      }
    }

    monitor.lastRun = now;
    monitor.nextRun = this.calculateNextRun(monitor.frequency);
    this.monitors.set(id, monitor);
    this.emit('monitorExecuted', monitor);
  }

  // Helper methods
  private calculateRiskScore(likelihood: Likelihood, impact: Impact): number {
    const likelihoodScore: Record<Likelihood, number> = {
      'very-high': 100,
      'high': 75,
      'medium': 50,
      'low': 25,
      'very-low': 10,
    };

    const impactScore: Record<Impact, number> = {
      'catastrophic': 100,
      'major': 75,
      'moderate': 50,
      'minor': 25,
      'negligible': 10,
    };

    return Math.round((likelihoodScore[likelihood] + impactScore[impact]) / 2);
  }

  private getRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private shouldAutoCreateMitigation(risk: IdentifiedRisk): boolean {
    return risk.level === 'critical' || risk.level === 'high';
  }

  private generateDefaultTasks(plan: MitigationPlan): MitigationTask[] {
    return [
      {
        id: this.generateId('task'),
        title: 'Assess and document risk',
        status: 'not-started',
        assignedTo: plan.assignedTo,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        estimatedHours: 8,
      },
      {
        id: this.generateId('task'),
        title: 'Implement mitigation controls',
        status: 'not-started',
        assignedTo: plan.assignedTo,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        estimatedHours: 40,
      },
      {
        id: this.generateId('task'),
        title: 'Verify mitigation effectiveness',
        status: 'not-started',
        assignedTo: plan.assignedTo,
        dueDate: plan.targetDate,
        estimatedHours: 4,
      },
    ];
  }

  private evaluateCondition(value: number, condition: MonitorCondition): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lte': return value <= condition.threshold;
      default: return false;
    }
  }

  private calculateNextRun(frequency: RiskMonitor['frequency']): Date {
    const now = new Date();
    switch (frequency) {
      case 'continuous': return new Date(now.getTime() + 5 * 60 * 1000); // 5 min
      case 'hourly': return new Date(now.getTime() + 60 * 60 * 1000);
      case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private initializeRiskMatrix(): RiskMatrix {
    return {
      likelihoods: ['very-high', 'high', 'medium', 'low', 'very-low'],
      impacts: ['catastrophic', 'major', 'moderate', 'minor', 'negligible'],
      scores: {},
      levels: { 0: 'low', 40: 'medium', 60: 'high', 80: 'critical' },
      colors: {
        critical: '#dc2626',
        high: '#ea580c',
        medium: '#ca8a04',
        low: '#16a34a',
      },
    };
  }

  private generateId(prefix: string): string {
    return \`\${prefix}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  // Analytics
  getRiskSummary() {
    const risks = this.listRisks();
    const byLevel: Record<RiskLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byStatus: Record<RiskStatus, number> = {
      identified: 0,
      analyzing: 0,
      mitigating: 0,
      mitigated: 0,
      accepted: 0,
      transferred: 0,
      closed: 0,
    };

    let totalScore = 0;
    for (const risk of risks) {
      byLevel[risk.level]++;
      byStatus[risk.status]++;
      totalScore += risk.score;
    }

    return {
      total: risks.length,
      byLevel,
      byStatus,
      averageScore: risks.length > 0 ? totalScore / risks.length : 0,
      topRisks: risks.slice(0, 10),
    };
  }
}

interface RiskMatrix {
  likelihoods: Likelihood[];
  impacts: Impact[];
  scores: Record<string, number>;
  levels: Record<number, RiskLevel>;
  colors: Record<RiskLevel, string>;
}
`;
}

// Generate Python manager class
export function generatePythonManager(): string {
  return `# Risk Assessment Manager - Python

from typing import Dict, List, Set, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
import uuid
import json
from abc import ABC, abstractmethod

class RiskCategory(Enum):
    SECURITY = "security"
    COMPLIANCE = "compliance"
    OPERATIONAL = "operational"
    FINANCIAL = "financial"
    REPUTATIONAL = "reputational"
    STRATEGIC = "strategic"
    TECHNOLOGY = "technology"

class RiskStatus(Enum):
    IDENTIFIED = "identified"
    ANALYZING = "analyzing"
    MITIGATING = "mitigating"
    MITIGATED = "mitigated"
    ACCEPTED = "accepted"
    TRANSFERRED = "transferred"
    CLOSED = "closed"

class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Likelihood(Enum):
    VERY_HIGH = "very-high"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    VERY_LOW = "very-low"

class Impact(Enum):
    CATASTROPHIC = "catastrophic"
    MAJOR = "major"
    MODERATE = "moderate"
    MINOR = "minor"
    NEGLIGIBLE = "negligible"

class MitigationStatus(Enum):
    NOT_STARTED = "not-started"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    OVERDUE = "overdue"

@dataclass
class IdentifiedRisk:
    id: str
    title: str
    description: str
    category: RiskCategory
    status: RiskStatus
    level: RiskLevel
    likelihood: Likelihood
    impact: Impact
    score: int
    calculated_at: datetime
    source: str
    owner: str
    assignee: Optional[str]
    mitigation: Optional[str]
    tags: List[str]
    related_assets: List[str]

@dataclass
class MitigationPlan:
    id: str
    risk_id: str
    name: str
    status: MitigationStatus
    priority: str
    assigned_to: str
    target_date: datetime
    progress: int
    tasks: List['MitigationTask']
    blockers: List[str]

@dataclass
class MitigationTask:
    id: str
    title: str
    status: MitigationStatus
    assigned_to: str
    due_date: datetime
    estimated_hours: int
    completed: bool = False

@dataclass
class RiskMonitor:
    id: str
    name: str
    status: str
    type: str
    frequency: str
    risk_ids: List[str]
    conditions: List['MonitorCondition']
    last_run: datetime
    next_run: datetime

@dataclass
class MonitorCondition:
    metric_id: str
    threshold: int
    operator: str
    severity: RiskLevel
    action: str

@dataclass
class RiskAssessment:
    id: str
    name: str
    status: str
    start_date: datetime
    end_date: Optional[datetime]
    assessed_by: str
    risks: List[str]
    overall_score: int
    risk_distribution: Dict[str, int]
    next_assessment: datetime

class RiskAssessmentManager:
    def __init__(self):
        self.risks: Dict[str, IdentifiedRisk] = {}
        self.assessments: Dict[str, RiskAssessment] = {}
        self.mitigations: Dict[str, MitigationPlan] = {}
        self.monitors: Dict[str, RiskMonitor] = {}
        self._event_handlers: Dict[str, List[Callable]] = {}

    def _emit(self, event_name: str, *args, **kwargs):
        for handler in self._event_handlers.get(event_name, []):
            handler(*args, **kwargs)

    def on(self, event_name: str, handler: Callable):
        if event_name not in self._event_handlers:
            self._event_handlers[event_name] = []
        self._event_handlers[event_name].append(handler)

    # Risk Management
    async def create_risk(self, risk: IdentifiedRisk) -> IdentifiedRisk:
        risk.id = f"risk-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        risk.score = self._calculate_risk_score(risk.likelihood, risk.impact)
        risk.level = self._get_risk_level(risk.score)
        risk.calculated_at = datetime.utcnow()

        self.risks[risk.id] = risk
        self._emit('riskCreated', risk)

        # Auto-create mitigation for high/critical risks
        if risk.level in [RiskLevel.CRITICAL, RiskLevel.HIGH]:
            await self.create_mitigation_plan(MitigationPlan(
                id="",  # Will be set in create_mitigation_plan
                risk_id=risk.id,
                name=f"Mitigation for {risk.title}",
                status=MitigationStatus.NOT_STARTED,
                priority=risk.level.value,
                assigned_to=risk.owner,
                target_date=datetime.utcnow() + timedelta(days=30),
                progress=0,
                tasks=[],
                blockers=[],
            ))

        return risk

    async def update_risk(self, risk_id: str, updates: Dict[str, Any]) -> Optional[IdentifiedRisk]:
        risk = self.risks.get(risk_id)
        if not risk:
            return None

        for key, value in updates.items():
            if hasattr(risk, key):
                setattr(risk, key, value)

        self._emit('riskUpdated', risk)
        return risk

    async def assess_risk(self, risk_id: str) -> Optional[IdentifiedRisk]:
        risk = self.risks.get(risk_id)
        if not risk:
            return None

        new_score = self._calculate_risk_score(risk.likelihood, risk.impact)
        new_level = self._get_risk_level(new_score)

        return await self.update_risk(risk_id, {
            'score': new_score,
            'level': new_level,
            'calculated_at': datetime.utcnow()
        })

    def get_risk(self, risk_id: str) -> Optional[IdentifiedRisk]:
        return self.risks.get(risk_id)

    def list_risks(self, level: Optional[RiskLevel] = None, status: Optional[RiskStatus] = None,
                   category: Optional[RiskCategory] = None) -> List[IdentifiedRisk]:
        risks = list(self.risks.values())

        if level:
            risks = [r for r in risks if r.level == level]
        if status:
            risks = [r for r in risks if r.status == status]
        if category:
            risks = [r for r in risks if r.category == category]

        return sorted(risks, key=lambda r: r.score, reverse=True)

    # Assessment Management
    async def create_assessment(self, assessment: RiskAssessment) -> RiskAssessment:
        assessment.id = f"assessment-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"

        risks_to_assess = [self.risks.get(rid) for rid in assessment.risks if rid in self.risks]

        risk_distribution = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}
        total_score = 0

        for risk in risks_to_assess:
            if risk:
                await self.assess_risk(risk.id)
                risk_distribution[risk.level.value] += 1
                total_score += risk.score

        assessment.overall_score = int(total_score / len(risks_to_assess)) if risks_to_assess else 0
        assessment.risk_distribution = risk_distribution

        self.assessments[assessment.id] = assessment
        self._emit('assessmentCreated', assessment)
        return assessment

    # Mitigation Management
    async def create_mitigation_plan(self, plan: MitigationPlan) -> MitigationPlan:
        plan.id = f"mitigation-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        plan.tasks = self._generate_default_tasks(plan)

        self.mitigations[plan.id] = plan
        self._emit('mitigationCreated', plan)
        return plan

    async def update_mitigation_progress(self, plan_id: str, progress: int) -> Optional[MitigationPlan]:
        plan = self.mitigations.get(plan_id)
        if not plan:
            return None

        plan.progress = progress
        if progress >= 100:
            plan.status = MitigationStatus.COMPLETED
            # Update associated risk
            if plan.risk_id in self.risks:
                await self.update_risk(plan.risk_id, {'status': RiskStatus.MITIGATED})

        self._emit('mitigationUpdated', plan)
        return plan

    # Monitoring
    async def create_monitor(self, monitor: RiskMonitor) -> RiskMonitor:
        monitor.id = f"monitor-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        monitor.next_run = self._calculate_next_run(monitor.frequency)

        self.monitors[monitor.id] = monitor
        self._emit('monitorCreated', monitor)
        return monitor

    async def run_monitor(self, monitor_id: str) -> None:
        monitor = self.monitors.get(monitor_id)
        if not monitor or monitor.status != 'active':
            return

        now = datetime.utcnow()
        risks = [self.risks.get(rid) for rid in monitor.risk_ids if rid in self.risks]

        for condition in monitor.conditions:
            for risk in risks:
                if risk and self._evaluate_condition(risk.score, condition):
                    self._emit('riskAlert', {
                        'monitorId': monitor_id,
                        'riskId': risk.id,
                        'severity': condition.severity.value,
                        'condition': condition,
                        'value': risk.score,
                        'timestamp': now,
                    })

        monitor.last_run = now
        monitor.next_run = self._calculate_next_run(monitor.frequency)
        self._emit('monitorExecuted', monitor)

    # Helper methods
    def _calculate_risk_score(self, likelihood: Likelihood, impact: Impact) -> int:
        likelihood_scores = {
            Likelihood.VERY_HIGH: 100,
            Likelihood.HIGH: 75,
            Likelihood.MEDIUM: 50,
            Likelihood.LOW: 25,
            Likelihood.VERY_LOW: 10,
        }

        impact_scores = {
            Impact.CATASTROPHIC: 100,
            Impact.MAJOR: 75,
            Impact.MODERATE: 50,
            Impact.MINOR: 25,
            Impact.NEGLIGIBLE: 10,
        }

        return round((likelihood_scores[likelihood] + impact_scores[impact]) / 2)

    def _get_risk_level(self, score: int) -> RiskLevel:
        if score >= 80:
            return RiskLevel.CRITICAL
        if score >= 60:
            return RiskLevel.HIGH
        if score >= 40:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _generate_default_tasks(self, plan: MitigationPlan) -> List[MitigationTask]:
        now = datetime.utcnow()
        return [
            MitigationTask(
                id=f"task-{now.timestamp()}-{uuid.uuid4().hex[:8]}",
                title="Assess and document risk",
                status=MitigationStatus.NOT_STARTED,
                assigned_to=plan.assigned_to,
                due_date=now + timedelta(days=7),
                estimated_hours=8,
            ),
            MitigationTask(
                id=f"task-{now.timestamp()}-{uuid.uuid4().hex[:8]}",
                title="Implement mitigation controls",
                status=MitigationStatus.NOT_STARTED,
                assigned_to=plan.assigned_to,
                due_date=now + timedelta(days=21),
                estimated_hours=40,
            ),
            MitigationTask(
                id=f"task-{now.timestamp()}-{uuid.uuid4().hex[:8]}",
                title="Verify mitigation effectiveness",
                status=MitigationStatus.NOT_STARTED,
                assigned_to=plan.assigned_to,
                due_date=plan.target_date,
                estimated_hours=4,
            ),
        ]

    def _evaluate_condition(self, value: int, condition: MonitorCondition) -> bool:
        ops = {
            'gt': lambda a, b: a > b,
            'lt': lambda a, b: a < b,
            'eq': lambda a, b: a == b,
            'gte': lambda a, b: a >= b,
            'lte': lambda a, b: a <= b,
        }
        return ops.get(condition.operator, lambda a, b: False)(value, condition.threshold)

    def _calculate_next_run(self, frequency: str) -> datetime:
        now = datetime.utcnow()
        intervals = {
            'continuous': timedelta(minutes=5),
            'hourly': timedelta(hours=1),
            'daily': timedelta(days=1),
            'weekly': timedelta(weeks=1),
        }
        return now + intervals.get(frequency, timedelta(days=1))

    def get_risk_summary(self) -> Dict[str, Any]:
        risks = self.list_risks()

        by_level = {level.value: 0 for level in RiskLevel}
        by_status = {status.value: 0 for status in RiskStatus}

        total_score = 0
        for risk in risks:
            by_level[risk.level.value] += 1
            by_status[risk.status.value] += 1
            total_score += risk.score

        return {
            'total': len(risks),
            'byLevel': by_level,
            'byStatus': by_status,
            'averageScore': total_score / len(risks) if risks else 0,
            'topRisks': risks[:10],
        }
`;
}

// Write files to output directory
export async function writeRiskFiles(
  config: RiskAssessmentConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  const markdown = generateRiskMarkdown(config);
  await fs.writeFile(path.join(outputDir, 'RISK_ASSESSMENT.md'), markdown);

  // Write Terraform configurations
  for (const provider of config.providers) {
    const terraform = generateRiskTerraform(config, provider);
    const tfDir = path.join(outputDir, 'terraform', provider);
    await fs.ensureDir(tfDir);
    await fs.writeFile(path.join(tfDir, 'main.tf'), terraform);
  }

  // Write manager class
  const managerFile = language === 'typescript'
    ? 'risk-manager.ts'
    : 'risk_manager.py';

  const managerCode = language === 'typescript'
    ? generateTypeScriptManager()
    : generatePythonManager();

  await fs.writeFile(path.join(outputDir, managerFile), managerCode);

  // Write example configuration
  const exampleConfig = {
    projectName: config.projectName,
    providers: config.providers,
    settings: config.settings,
    risks: config.risks.slice(0, 3).map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      level: r.level,
      status: r.status,
    })),
  };
  await fs.writeFile(
    path.join(outputDir, 'config.example.json'),
    JSON.stringify(exampleConfig, null, 2)
  );
}

// Display configuration summary
export function displayRiskConfig(config: RiskAssessmentConfig, language: 'typescript' | 'python' = 'typescript'): void {
  console.log(chalk.bold('\n⚠️  Risk Assessment Configuration\n'));

  // Settings
  console.log(chalk.cyan('Risk Settings:'));
  console.log(`  ${chalk.yellow('Auto-Assessment:')} ${chalk.white(config.settings.autoAssessment ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Assessment Frequency:')} ${chalk.white(config.settings.assessmentFrequency)}`);
  console.log(`  ${chalk.yellow('Continuous Monitoring:')} ${chalk.white(config.settings.enableContinuousMonitoring ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Monitoring Interval:')} ${chalk.white(`${config.settings.monitoringInterval} min`)}`);
  console.log(`  ${chalk.yellow('Real-Time Alerts:')} ${chalk.white(config.settings.enableRealTimeAlerts ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Risk Acceptance Threshold:')} ${chalk.white(`${config.settings.riskAcceptanceThreshold}/100`)}`);
  console.log(`  ${chalk.yellow('Risk Heatmap:')} ${chalk.white(config.settings.enableRiskHeatmap ? 'Enabled' : 'Disabled')}`);
  console.log(`  ${chalk.yellow('Trend Analysis:')} ${chalk.white(config.settings.enableTrendAnalysis ? `Enabled (${config.settings.trendAnalysisPeriod} days)` : 'Disabled')}`);
  console.log(`  ${chalk.yellow('Predictive Analysis:')} ${chalk.white(config.settings.enablePredictiveAnalysis ? `Enabled (${config.settings.predictiveModel})` : 'Disabled')}`);
  console.log('');

  // Risk Summary
  if (config.risks.length > 0) {
    const levelCounts = config.risks.reduce((acc, r) => {
      acc[r.level] = (acc[r.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(chalk.cyan(`Identified Risks (${config.risks.length}):`));
    console.log(`  ${chalk.red('Critical:')} ${levelCounts.critical || 0}`);
    console.log(`  ${chalk.red('High:')} ${levelCounts.high || 0}`);
    console.log(`  ${chalk.yellow('Medium:')} ${levelCounts.medium || 0}`);
    console.log(`  ${chalk.green('Low:')} ${levelCounts.low || 0}`);
    console.log('');

    // Top risks
    const topRisks = [...config.risks].sort((a, b) => b.score - a.score).slice(0, 5);
    if (topRisks.length > 0) {
      console.log(chalk.cyan('Top Risks:'));
      for (const risk of topRisks) {
        const statusIcon = risk.status === 'mitigated' ? '✓' : risk.status === 'mitigating' ? '⟳' : '○';
        console.log(`  ${statusIcon} [${risk.level.toUpperCase()}] ${risk.title} - ${risk.score}/100 (${risk.category})`);
      }
      console.log('');
    }
  }

  // Assessments
  if (config.assessments.length > 0) {
    console.log(chalk.cyan(`Risk Assessments (${config.assessments.length}):`));
    for (const assessment of config.assessments) {
      const statusIcon = assessment.status === 'completed' ? '✓' : assessment.status === 'in-progress' ? '⟳' : '○';
      console.log(`  ${statusIcon} ${assessment.name} - Score: ${assessment.overallScore}/100`);
    }
    console.log('');
  }

  // Mitigations
  if (config.mitigations.length > 0) {
    console.log(chalk.cyan(`Mitigation Plans (${config.mitigations.length}):`));
    for (const mitigation of config.mitigations) {
      const statusIcon = mitigation.status === 'completed' ? '✓' : mitigation.status === 'in-progress' ? '⟳' : '○';
      console.log(`  ${statusIcon} ${mitigation.name} - ${mitigation.progress}% (${mitigation.priority})`);
    }
    console.log('');
  }

  // Monitors
  if (config.monitors.length > 0) {
    console.log(chalk.cyan(`Risk Monitors (${config.monitors.length}):`));
    for (const monitor of config.monitors) {
      const statusIcon = monitor.status === 'active' ? '🟢' : monitor.status === 'paused' ? '⏸️' : '🔴';
      console.log(`  ${statusIcon} ${monitor.name} (${monitor.frequency})`);
    }
    console.log('');
  }

  // Controls
  if (config.controls.length > 0) {
    console.log(chalk.cyan(`Risk Controls (${config.controls.length}):`));
    for (const control of config.controls) {
      const implIcon = control.implemented ? '✓' : '○';
      console.log(`  [${implIcon}] ${control.name} (${control.type})`);
    }
    console.log('');
  }

  // Alerts
  if (config.alerts.length > 0) {
    console.log(chalk.cyan(`Risk Alerts (${config.alerts.length}):`));
    for (const alert of config.alerts) {
      const statusIcon = alert.status === 'open' ? '🔴' : alert.status === 'investigating' ? '🟡' : '🟢';
      console.log(`  ${statusIcon} ${alert.title} (${alert.severity.toUpperCase()})`);
    }
    console.log('');
  }

  // Files written
  console.log(chalk.cyan('Files Generated:'));
  console.log(`  ${chalk.gray('•')} RISK_ASSESSMENT.md`);
  console.log(`  ${chalk.gray('•')} terraform/{provider}/main.tf`);
  console.log(`  ${chalk.gray('•')} ${language === 'typescript' ? 'risk-manager.ts' : 'risk_manager.py'}`);
  console.log(`  ${chalk.gray('•')} config.example.json`);
  console.log('');

  console.log(chalk.green(`✓ Risk assessment configuration generated successfully!\n`));
}
