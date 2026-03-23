// Regulatory Reporting Automation with Compliance Dashboards

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions
export type ReportType = 'sox' | 'gdpr' | 'hipaa' | 'pci-dss' | 'nist-800-53' | 'iso-27001' | 'soc-2' | 'custom';
export type ReportStatus = 'draft' | 'in-review' | 'approved' | 'rejected' | 'archived';
export type ReportFormat = 'pdf' | 'html' | 'json' | 'xml' | 'csv' | 'excel';
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partial' | 'pending-review';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type ControlStatus = 'compliant' | 'non-compliant' | 'partial' | 'not-applicable' | 'pending-review';
export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type WorkflowStatus = 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'requires-changes';

export interface RegulatoryConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: ReportingSettings;
  dashboards: ComplianceDashboard[];
  reports: RegulatoryReport[];
  controls: ComplianceControl[];
  frameworks: ComplianceFramework[];
  workflows: ReportWorkflow[];
  alerts: ComplianceAlert[];
  schedules: ReportSchedule[];
  evidence: EvidenceRecord[];
}

export interface ReportingSettings {
  autoGenerate: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'on-demand';
  formats: ReportFormat[];
  includeEvidence: boolean;
  evidenceRetentionDays: number;
  requireApproval: boolean;
  approvers: string[];
  notificationChannels: NotificationChannel[];
  customLogo?: string;
  watermarkReports: boolean;
  archiveLocation: string;
  enableEncryption: boolean;
  complianceThreshold: number; // 0-100
  enableGapAnalysis: boolean;
  includeRecommendations: boolean;
  signReports: boolean;
  enableDashboard: boolean;
  dashboardRefreshInterval: number; // minutes
  enableRealTimeUpdates: boolean;
  enableTrendAnalysis: boolean;
  trendAnalysisPeriod: number; // days
  enableBenchmarking: boolean;
  benchmarkIndustry: string;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'sms' | 'custom';
  enabled: boolean;
  recipients: string[];
  config?: Record<string, any>;
}

export interface ComplianceDashboard {
  id: string;
  name: string;
  description: string;
  period: DashboardPeriod;
  startDate: Date;
  endDate: Date;
  lastRefresh: Date;
  refreshInterval: number; // minutes
  enabled: boolean;
  widgets: DashboardWidget[];
  metrics: DashboardMetric[];
  filters: DashboardFilter[];
  accessControls: string[]; // role IDs
  layout: DashboardLayout;
  theme: DashboardTheme;
  drilling: DrillDownConfig;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'gauge' | 'heatmap' | 'timeline' | 'scorecard' | 'custom';
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  dataSource: DataSource;
  config?: WidgetConfig;
  refreshRate?: number; // seconds
  drillDown?: string; // target dashboard/widget
  thresholds?: MetricThreshold[];
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface DataSource {
  type: 'query' | 'api' | 'static' | 'aggregated' | 'custom';
  query?: string;
  endpoint?: string;
  aggregation?: AggregationConfig;
}

export interface AggregationConfig {
  function: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'percentile' | 'custom';
  field: string;
  groupBy?: string[];
  filter?: string;
}

export interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'bubble' | 'radar' | 'custom';
  axisLabels?: { x?: string; y?: string };
  legend?: boolean;
  colors?: string[];
  showLabels?: boolean;
  showDataPoints?: boolean;
  stacked?: boolean;
  normalized?: boolean;
  customOptions?: Record<string, any>;
}

export interface MetricThreshold {
  label: string;
  value: number;
  color: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
}

export interface DashboardMetric {
  id: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  status: ComplianceStatus;
  lastUpdated: Date;
  target?: number;
  thresholds?: MetricThreshold[];
}

export interface DashboardFilter {
  id: string;
  name: string;
  field: string;
  type: 'dropdown' | 'date-range' | 'text' | 'multi-select' | 'custom';
  options?: FilterOption[];
  defaultValue?: any;
  required: boolean;
}

export interface FilterOption {
  label: string;
  value: any;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  padding: number;
  margin: number;
}

export interface DashboardTheme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  mode: 'light' | 'dark' | 'auto';
}

export interface DrillDownConfig {
  enabled: boolean;
  levels: DrillDownLevel[];
}

export interface DrillDownLevel {
  name: string;
  targetDashboard?: string;
  filters: Record<string, any>;
}

export interface RegulatoryReport {
  id: string;
  name: string;
  reportType: ReportType;
  reportingPeriod: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  status: ReportStatus;
  format: ReportFormat;
  overallScore: number; // 0-100
  complianceStatus: ComplianceStatus;
  summary: ReportSummary;
  controls: ReportControl[];
  findings: ReportFinding[];
  evidence: string[]; // evidence IDs
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
  findingsBySeverity: Record<string, number>;
  completionPercentage: number;
  riskScore: number; // 0-100
}

export interface ReportControl {
  controlId: string;
  title: string;
  description: string;
  status: ControlStatus;
  testDate?: Date;
  tester?: string;
  findings: string[]; // finding IDs
  evidenceIds: string[];
  riskLevel: RiskLevel;
  nextReviewDate: Date;
  framework?: ReportType;
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
  status: 'open' | 'acknowledged' | 'remediating' | 'remediated' | 'accepted-risk' | 'false-positive';
  assignedTo?: string;
  dueDate?: Date;
  relatedEvidence: string[];
  remediationPlan?: string;
  verifiedDate?: Date;
}

export interface ReportSignoff {
  role: string;
  name: string;
  email: string;
  signedAt: Date;
  signature: string;
  comments?: string;
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
  lastModifiedDate: Date;
  lastModifiedBy: string;
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
  framework: ReportType;
  controlId: string;
  title: string;
  description: string;
  category: string;
  status: ControlStatus;
  riskLevel: RiskLevel;
  testingRequired: boolean;
  testFrequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'on-demand';
  lastTestedDate?: Date;
  nextTestDueDate: Date;
  owner: string;
  tester?: string;
  testProcedures: TestProcedure[];
  automatedChecks: AutomatedCheck[];
  manualChecks: ManualCheck[];
  evidenceRequired: EvidenceRequirement[];
  complianceMappings: ComplianceMapping[];
}

export interface TestProcedure {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  expectedResult: string;
  tools?: string[];
  estimatedTime: number; // minutes
}

export interface TestStep {
  order: number;
  action: string;
  expectedResult: string;
  screenshot?: boolean;
  evidenceRequired: boolean;
}

export interface AutomatedCheck {
  id: string;
  name: string;
  type: 'script' | 'api-call' | 'config-scan' | 'log-analysis' | 'custom';
  script?: string;
  endpoint?: string;
  schedule?: string; // cron expression
  lastRunDate?: Date;
  lastResult?: 'pass' | 'fail' | 'warning' | 'error';
  threshold?: number | string;
}

export interface ManualCheck {
  id: string;
  name: string;
  instructions: string;
  checklist: ChecklistItem[];
  frequency: string;
  assignee?: string;
  dueDate?: Date;
  evidenceRequired: boolean;
}

export interface ChecklistItem {
  item: string;
  completed: boolean;
  completedBy?: string;
  completedDate?: Date;
  notes?: string;
}

export interface EvidenceRequirement {
  id: string;
  type: 'screenshot' | 'log-file' | 'configuration' | 'document' | 'certificate' | 'audit-trail' | 'custom';
  description: string;
  required: boolean;
  retentionPeriod: number; // days
  collectionMethod: 'manual' | 'automated' | 'api' | 'custom';
  source?: string;
  frequency?: string;
  relatedControls: string[];
}

export interface ComplianceMapping {
  framework: ReportType;
  controlId: string;
  mappingType: 'equivalent' | 'partial' | 'custom';
  notes?: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  type: ReportType;
  version: string;
  description: string;
  enabled: boolean;
  controls: string[]; // control IDs
  requirements: FrameworkRequirement[];
  mappings: ComplianceMapping[];
  lastAssessmentDate?: Date;
  nextAssessmentDate: Date;
}

export interface FrameworkRequirement {
  id: string;
  requirementId: string;
  title: string;
  description: string;
  category: string;
  obligationType: 'mandatory' | 'required' | 'addressable' | 'custom';
  controls: string[];
  evidenceRequired: string[];
  dueDate?: Date;
  status: 'met' | 'not-met' | 'partial' | 'not-applicable';
  assignee?: string;
  risk?: RiskLevel;
  lastAssessedDate?: Date;
  nextAssessmentDate: Date;
}

export interface ReportWorkflow {
  id: string;
  name: string;
  description: string;
  reportType: ReportType;
  status: WorkflowStatus;
  stages: WorkflowStage[];
  currentStage: number;
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  approvers: WorkflowApprover[];
  notifications: WorkflowNotification[];
  metadata: WorkflowMetadata;
}

export interface WorkflowStage {
  order: number;
  name: string;
  description: string;
  status: WorkflowStatus;
  assignee?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // minutes
  actions: WorkflowAction[];
  dependencies: string[]; // stage IDs
}

export interface WorkflowAction {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'automated' | 'approval' | 'notification' | 'custom';
  script?: string;
  endpoint?: string;
  timeout?: number; // minutes
  successAction?: string;
  failureAction?: string;
  dependencies: string[];
  completed: boolean;
  completedAt?: Date;
  result?: any;
}

export interface WorkflowApprover {
  userId: string;
  name: string;
  email: string;
  role: string;
  stage: number;
  approvalStatus: ApprovalStatus;
  approvedAt?: Date;
  comments?: string;
}

export interface WorkflowNotification {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'custom';
  recipient: string;
  template: string;
  trigger: 'stage-start' | 'stage-complete' | 'workflow-complete' | 'workflow-failed' | 'custom';
  sent?: boolean;
  sentAt?: Date;
}

export interface WorkflowMetadata {
  estimatedDuration: number; // minutes
  actualDuration?: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  version: number;
}

export interface ComplianceAlert {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  throttleMinutes: number;
  lastTriggered?: Date;
  notificationChannels: string[];
  metadata: AlertMetadata;
}

export interface AlertCondition {
  type: 'threshold' | 'trend' | 'pattern' | 'compliance' | 'deadline' | 'custom';
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'regex' | 'in' | 'not-in';
  value: any;
  timeWindow?: number; // minutes
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'slack' | 'teams' | 'pagerduty' | 'custom';
  target: string;
  config?: Record<string, any>;
  template?: string;
}

export interface AlertMetadata {
  category: string;
  source: string;
  createdDate: Date;
  createdBy: string;
  lastModifiedDate?: Date;
  lastModifiedBy?: string;
  tags: string[];
}

export interface ReportSchedule {
  id: string;
  name: string;
  reportType: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';
  enabled: boolean;
  cronExpression?: string;
  timezone: string;
  recipients: string[];
  formats: ReportFormat[];
  includeEvidence: boolean;
  nextRunDate: Date;
  lastRunDate?: Date;
  parameters: ScheduleParameters;
}

export interface ScheduleParameters {
  frameworks: ReportType[];
  scope: ScheduleScope;
  filters?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface ScheduleScope {
  includedAssets: string[];
  excludedAssets: string[];
  departments: string[];
  regions: string[];
}

export interface EvidenceRecord {
  id: string;
  type: 'screenshot' | 'log-file' | 'configuration' | 'document' | 'certificate' | 'audit-trail' | 'interview-notes' | 'custom';
  title: string;
  description: string;
  collectedDate: Date;
  collectedBy: string;
  status: 'valid' | 'expired' | 'pending' | 'rejected' | 'superseded';
  fileLocation: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  hashAlgorithm: 'SHA-256' | 'SHA-512' | 'MD5';
  expiresDate?: Date;
  retentionDate: Date;
  tags: string[];
  relatedControls: string[];
  relatedFindings: string[];
  metadata: EvidenceMetadata;
}

export interface EvidenceMetadata {
  framework?: ReportType;
  source: string;
  collectionMethod: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedDate?: Date;
  uploadDate: Date;
  uploadedBy: string;
  version: number;
  parentEvidence?: string;
}

// Generate markdown documentation
export function generateRegulatoryMarkdown(config: RegulatoryConfig): string {
  const lines: string[] = [];

  lines.push('# Regulatory Reporting and Compliance Dashboard');
  lines.push('');
  lines.push(`**Project**: ${config.projectName}`);
  lines.push(`**Providers**: ${config.providers.join(', ')}`);
  lines.push(`**Auto-Generate**: ${config.settings.autoGenerate}`);
  lines.push(`**Frequency**: ${config.settings.frequency}`);
  lines.push('');

  // Settings
  lines.push('## Reporting Settings');
  lines.push('');
  lines.push(`- **Auto-Generate**: ${config.settings.autoGenerate}`);
  lines.push(`- **Frequency**: ${config.settings.frequency}`);
  lines.push(`- **Formats**: ${config.settings.formats.join(', ')}`);
  lines.push(`- **Include Evidence**: ${config.settings.includeEvidence}`);
  lines.push(`- **Evidence Retention**: ${config.settings.evidenceRetentionDays} days`);
  lines.push(`- **Require Approval**: ${config.settings.requireApproval}`);
  lines.push(`- **Notification Channels**: ${config.settings.notificationChannels.map(n => `${n.type} (${n.enabled ? 'enabled' : 'disabled'})`).join(', ')}`);
  lines.push(`- **Watermark Reports**: ${config.settings.watermarkReports ? 'Yes' : 'No'}`);
  lines.push(`- **Archive Location**: ${config.settings.archiveLocation}`);
  lines.push(`- **Enable Encryption**: ${config.settings.enableEncryption}`);
  lines.push(`- **Compliance Threshold**: ${config.settings.complianceThreshold}%`);
  lines.push(`- **Gap Analysis**: ${config.settings.enableGapAnalysis ? 'Enabled' : 'Disabled'}`);
  lines.push(`- **Include Recommendations**: ${config.settings.includeRecommendations ? 'Yes' : 'No'}`);
  lines.push(`- **Sign Reports**: ${config.settings.signReports ? 'Yes' : 'No'}`);
  lines.push(`- **Enable Dashboard**: ${config.settings.enableDashboard ? 'Yes' : 'No'}`);
  lines.push(`- **Dashboard Refresh**: ${config.settings.dashboardRefreshInterval} min`);
  lines.push(`- **Real-Time Updates**: ${config.settings.enableRealTimeUpdates ? 'Yes' : 'No'}`);
  lines.push(`- **Trend Analysis**: ${config.settings.enableTrendAnalysis ? `Enabled (${config.settings.trendAnalysisPeriod} days)` : 'Disabled'}`);
  lines.push(`- **Benchmarking**: ${config.settings.enableBenchmarking ? `Enabled (${config.settings.benchmarkIndustry})` : 'Disabled'}`);
  lines.push('');

  // Dashboards
  if (config.dashboards.length > 0) {
    lines.push(`## Compliance Dashboards (${config.dashboards.length})`);
    lines.push('');
    for (const dashboard of config.dashboards) {
      lines.push(`### ${dashboard.name}`);
      lines.push('');
      lines.push(`- **ID**: ${dashboard.id}`);
      lines.push(`- **Period**: ${dashboard.period}`);
      lines.push(`- **Date Range**: ${dashboard.startDate.toISOString()} to ${dashboard.endDate.toISOString()}`);
      lines.push(`- **Refresh Interval**: ${dashboard.refreshInterval} min`);
      lines.push(`- **Enabled**: ${dashboard.enabled ? 'Yes' : 'No'}`);
      lines.push(`- **Widgets**: ${dashboard.widgets.length}`);
      lines.push(`- **Metrics**: ${dashboard.metrics.length}`);
      lines.push('');

      if (dashboard.metrics.length > 0) {
        lines.push('**Metrics**:');
        for (const metric of dashboard.metrics) {
          const trendIcon = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→';
          lines.push(`- ${metric.name}: ${metric.value}${metric.unit} ${trendIcon} ${metric.trendPercent}% (${metric.status})`);
        }
        lines.push('');
      }

      if (dashboard.widgets.length > 0) {
        lines.push('**Widgets**:');
        for (const widget of dashboard.widgets) {
          lines.push(`- [${widget.type}] **${widget.title}** (${widget.size.width}x${widget.size.height})`);
        }
        lines.push('');
      }
    }
  }

  // Reports
  if (config.reports.length > 0) {
    lines.push(`## Regulatory Reports (${config.reports.length})`);
    lines.push('');
    for (const report of config.reports) {
      const statusIcon = report.status === 'approved' ? '✓' : report.status === 'in-review' ? '⟳' : report.status === 'rejected' ? '✗' : '○';
      const complianceIcon = report.complianceStatus === 'compliant' ? '✓' : report.complianceStatus === 'non-compliant' ? '✗' : '◐';

      lines.push(`### [${statusIcon}] ${report.name}`);
      lines.push('');
      lines.push(`- **Type**: ${report.reportType.toUpperCase()}`);
      lines.push(`- **Period**: ${report.reportingPeriod.start.toISOString()} to ${report.reportingPeriod.end.toISOString()}`);
      lines.push(`- **Status**: ${report.status}`);
      lines.push(`- **Format**: ${report.format}`);
      lines.push(`- **Score**: ${report.overallScore}/100`);
      lines.push(`- **Compliance**: ${complianceIcon} ${report.complianceStatus}`);
      lines.push(`- **Controls**: ${report.summary.totalControls} (${report.summary.compliantControls} compliant, ${report.summary.nonCompliantControls} non-compliant)`);
      lines.push(`- **Findings**: ${report.summary.totalFindings}`);
      lines.push(`- **Completion**: ${report.summary.completionPercentage}%`);
      lines.push(`- **Risk Score**: ${report.summary.riskScore}/100`);
      lines.push('');

      if (report.findings.length > 0) {
        lines.push('**Findings**:');
        for (const finding of report.findings.slice(0, 5)) {
          lines.push(`- [${finding.severity.toUpperCase()}] ${finding.title} - ${finding.status}`);
        }
        if (report.findings.length > 5) {
          lines.push(`- ... and ${report.findings.length - 5} more`);
        }
        lines.push('');
      }
    }
  }

  // Controls
  if (config.controls.length > 0) {
    lines.push(`## Compliance Controls (${config.controls.length})`);
    lines.push('');
    for (const control of config.controls) {
      const statusIcon = control.status === 'compliant' ? '✓' : control.status === 'non-compliant' ? '✗' : control.status === 'partial' ? '◐' : '○';

      lines.push(`### [${statusIcon}] ${control.controlId}: ${control.title}`);
      lines.push('');
      lines.push(`- **Framework**: ${control.framework.toUpperCase()}`);
      lines.push(`- **Category**: ${control.category}`);
      lines.push(`- **Status**: ${control.status}`);
      lines.push(`- **Risk Level**: ${control.riskLevel}`);
      lines.push(`- **Testing Required**: ${control.testingRequired ? 'Yes' : 'No'}`);
      lines.push(`- **Test Frequency**: ${control.testFrequency}`);
      lines.push(`- **Owner**: ${control.owner}`);
      lines.push(`- **Next Test Due**: ${control.nextTestDueDate.toISOString()}`);
      lines.push('');

      if (control.automatedChecks.length > 0) {
        lines.push('**Automated Checks**:');
        for (const check of control.automatedChecks) {
          lines.push(`- ${check.name} (${check.type}) ${check.lastResult ? `- ${check.lastResult}` : ''}`);
        }
        lines.push('');
      }

      if (control.manualChecks.length > 0) {
        lines.push('**Manual Checks**:');
        for (const check of control.manualChecks) {
          lines.push(`- ${check.name}`);
        }
        lines.push('');
      }
    }
  }

  // Frameworks
  if (config.frameworks.length > 0) {
    lines.push(`## Compliance Frameworks (${config.frameworks.length})`);
    lines.push('');
    for (const framework of config.frameworks) {
      lines.push(`### ${framework.name}`);
      lines.push('');
      lines.push(`- **Type**: ${framework.type.toUpperCase()}`);
      lines.push(`- **Version**: ${framework.version}`);
      lines.push(`- **Enabled**: ${framework.enabled ? 'Yes' : 'No'}`);
      lines.push(`- **Controls**: ${framework.controls.length}`);
      lines.push(`- **Next Assessment**: ${framework.nextAssessmentDate.toISOString()}`);
      lines.push('');

      if (framework.requirements.length > 0) {
        lines.push('**Requirements**:');
        for (const req of framework.requirements) {
          const statusIcon = req.status === 'met' ? '✓' : req.status === 'not-met' ? '✗' : req.status === 'partial' ? '◐' : '○';
          lines.push(`- [${statusIcon}] ${req.requirementId}: ${req.title} (${req.status})`);
        }
        lines.push('');
      }
    }
  }

  // Workflows
  if (config.workflows.length > 0) {
    lines.push(`## Report Workflows (${config.workflows.length})`);
    lines.push('');
    for (const workflow of config.workflows) {
      const statusIcon = workflow.status === 'completed' ? '✓' : workflow.status === 'in-progress' ? '⟳' : workflow.status === 'cancelled' ? '✗' : '○';

      lines.push(`### [${statusIcon}] ${workflow.name}`);
      lines.push('');
      lines.push(`- **Report Type**: ${workflow.reportType.toUpperCase()}`);
      lines.push(`- **Status**: ${workflow.status}`);
      lines.push(`- **Current Stage**: ${workflow.currentStage}/${workflow.stages.length}`);
      lines.push(`- **Initiated By**: ${workflow.initiatedBy}`);
      lines.push(`- **Initiated At**: ${workflow.initiatedAt.toISOString()}`);
      lines.push('');

      if (workflow.stages.length > 0) {
        lines.push('**Stages**:');
        for (const stage of workflow.stages) {
          const stageIcon = stage.status === 'completed' ? '✓' : stage.status === 'in-progress' ? '⟳' : '○';
          lines.push(`- [${stageIcon}] ${stage.order}. ${stage.name} (${stage.status})`);
        }
        lines.push('');
      }
    }
  }

  // Alerts
  if (config.alerts.length > 0) {
    lines.push(`## Compliance Alerts (${config.alerts.length})`);
    lines.push('');
    for (const alert of config.alerts) {
      const enabledIcon = alert.enabled ? '🔔' : '🔕';

      lines.push(`### ${enabledIcon} ${alert.name} (${alert.severity.toUpperCase()})`);
      lines.push('');
      lines.push(`- **Description**: ${alert.description}`);
      lines.push(`- **Enabled**: ${alert.enabled ? 'Yes' : 'No'}`);
      lines.push(`- **Conditions**: ${alert.conditions.length}`);
      lines.push(`- **Actions**: ${alert.actions.length}`);
      lines.push(`- **Throttle**: ${alert.throttleMinutes} min`);
      lines.push(`- **Last Triggered**: ${alert.lastTriggered?.toISOString() || 'Never'}`);
      lines.push('');
    }
  }

  // Schedules
  if (config.schedules.length > 0) {
    lines.push(`## Report Schedules (${config.schedules.length})`);
    lines.push('');
    for (const schedule of config.schedules) {
      lines.push(`### ${schedule.name}`);
      lines.push('');
      lines.push(`- **Report Type**: ${schedule.reportType.toUpperCase()}`);
      lines.push(`- **Frequency**: ${schedule.frequency}`);
      lines.push(`- **Enabled**: ${schedule.enabled ? 'Yes' : 'No'}`);
      lines.push(`- **Timezone**: ${schedule.timezone}`);
      lines.push(`- **Next Run**: ${schedule.nextRunDate.toISOString()}`);
      lines.push(`- **Recipients**: ${schedule.recipients.join(', ')}`);
      lines.push(`- **Formats**: ${schedule.formats.join(', ')}`);
      lines.push('');
    }
  }

  // Evidence
  if (config.evidence.length > 0) {
    lines.push(`## Evidence Records (${config.evidence.length})`);
    lines.push('');
    for (const evidence of config.evidence.slice(0, 5)) {
      const statusIcon = evidence.status === 'valid' ? '✓' : evidence.status === 'expired' ? '✗' : '○';

      lines.push(`- [${statusIcon}] **${evidence.title}** (${evidence.type})`);
      lines.push(`  - Collected: ${evidence.collectedDate.toISOString()} by ${evidence.collectedBy}`);
      lines.push(`  - File: ${evidence.fileName} (${evidence.fileSize} bytes)`);
      lines.push(`  - Hash: ${evidence.hash}`);
    }
    if (config.evidence.length > 5) {
      lines.push(`- ... and ${config.evidence.length - 5} more`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Generate Terraform configuration
export function generateRegulatoryTerraform(config: RegulatoryConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  const lines: string[] = [];

  lines.push('# Regulatory Reporting and Compliance Dashboard Infrastructure');
  lines.push(`# Provider: ${provider.toUpperCase()}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (provider === 'aws') {
    lines.push('# S3 Bucket for compliance reports');
    lines.push(`resource "aws_s3_bucket" "compliance_reports" {`);
    lines.push(`  bucket = "\${var.project-name}-compliance-reports"`);
    lines.push(`  tags = {`);
    lines.push(`    Name = "\${var.project-name}-compliance-reports"`);
    lines.push(`    Purpose = "Regulatory Reporting"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_s3_bucket_versioning" "compliance_reports" {`);
    lines.push(`  bucket = aws_s3_bucket.compliance_reports.id`);
    lines.push(`  versioning_configuration {`);
    lines.push(`    status = "Enabled"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_s3_bucket_server_side_encryption_configuration" "compliance_reports" {`);
    lines.push(`  bucket = aws_s3_bucket.compliance_reports.id`);
    lines.push(`  rule {`);
    lines.push(`    apply_server_side_encryption_by_default {`);
    lines.push(`      sse_algorithm = "AES256"`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_s3_bucket_public_access_block" "compliance_reports" {`);
    lines.push(`  bucket = aws_s3_bucket.compliance_reports.id`);
    lines.push(`  block_public_acls       = true`);
    lines.push(`  block_public_policy     = true`);
    lines.push(`  ignore_public_acls      = true`);
    lines.push(`  restrict_public_buckets = true`);
    lines.push(`}`);
    lines.push('');

    lines.push('# DynamoDB Table for compliance controls');
    lines.push(`resource "aws_dynamodb_table" "compliance_controls" {`);
    lines.push(`  name           = "\${var.project-name}-compliance-controls"`);
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

    lines.push('# DynamoDB Table for report findings');
    lines.push(`resource "aws_dynamodb_table" "report_findings" {`);
    lines.push(`  name           = "\${var.project-name}-report-findings"`);
    lines.push(`  hash_key       = "id"`);
    lines.push(`  range_key      = "reportId"`);
    lines.push(`  billing_mode   = "PAY_PER_REQUEST"`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "id"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "reportId"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  server_side_encryption {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# KMS Key for report encryption');
    lines.push(`resource "aws_kms_key" "compliance_reports" {`);
    lines.push(`  description = "\${var.project-name} Compliance Reports KMS Key"`);
    lines.push(`  key_usage = "ENCRYPT_DECRYPT"`);
    lines.push(`  is_enabled = true`);
    lines.push(`  enable_key_rotation = true`);
    lines.push('');
    lines.push(`  policy = jsonencode({`);
    lines.push(`    Version = "2012-10-17"`);
    lines.push(`    Statement = [`);
    lines.push(`      {`);
    lines.push(`        Sid = "Enable IAM User Permissions"`);
    lines.push(`        Effect = "Allow"`);
    lines.push(`        Principal = {`);
    lines.push(`          AWS = "*"`);
    lines.push(`        }`);
    lines.push(`        Action = "kms:*"`);
    lines.push(`        Resource = "*"`);
    lines.push(`      }`);
    lines.push(`    ]`);
    lines.push(`  })`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_kms_alias" "compliance_reports" {`);
    lines.push(`  name          = "alias/\${var.project-name}-compliance-reports"`);
    lines.push(`  target_key_id = aws_kms_key.compliance_reports.key_id`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Lambda Function for report generation');
    lines.push(`resource "aws_lambda_function" "report_generator" {`);
    lines.push(`  filename      = "report_generator.zip"`);
    lines.push(`  function_name = "\${var.project-name}-report-generator"`);
    lines.push(`  role          = aws_iam_role.report_lambda_role.arn`);
    lines.push(`  handler       = "index.handler"`);
    lines.push('');
    lines.push(`  environment {`);
    lines.push(`    variables = {`);
    lines.push(`      REPORTS_BUCKET = aws_s3_bucket.compliance_reports.id`);
    lines.push(`      CONTROLS_TABLE = aws_dynamodb_table.compliance_controls.id`);
    lines.push(`      FINDINGS_TABLE = aws_dynamodb_table.report_findings.id`);
    lines.push(`      KMS_KEY_ID = aws_kms_key.compliance_reports.arn`);
    lines.push(`      COMPLIANCE_THRESHOLD = tostring(${config.settings.complianceThreshold})`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# IAM Role for Lambda');
    lines.push(`resource "aws_iam_role" "report_lambda_role" {`);
    lines.push(`  name = "\${var.project-name}-report-lambda-role"`);
    lines.push(`  assume_role_policy = jsonencode({`);
    lines.push(`    Version = "2012-10-17"`);
    lines.push(`    Statement = [`);
    lines.push(`      {`);
    lines.push(`        Action = "sts:AssumeRole"`);
    lines.push(`        Effect = "Allow"`);
    lines.push(`        Principal = {`);
    lines.push(`          Service = "lambda.amazonaws.com"`);
    lines.push(`        }`);
    lines.push(`      }`);
    lines.push(`    ]`);
    lines.push(`  })`);
    lines.push(`}`);
    lines.push('');

    lines.push('# EventBridge Schedule Rule for automated reports');
    lines.push(`resource "aws_cloudwatch_event_rule" "report_schedule" {`);
    lines.push(`  name                = "\${var.project-name}-report-schedule"`);
    lines.push(`  schedule_expression = "${getScheduleExpression(config.settings.frequency)}"`);
    lines.push(`  is_enabled          = ${config.settings.autoGenerate ? 'true' : 'false'}`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_cloudwatch_event_target" "report_schedule_target" {`);
    lines.push(`  rule      = aws_cloudwatch_event_rule.report_schedule.name`);
    lines.push(`  target_id = "report_generator"`);
    lines.push(`  arn       = aws_lambda_function.report_generator.arn`);
    lines.push(`}`);
    lines.push('');

    lines.push('# SNS Topic for notifications');
    lines.push(`resource "aws_sns_topic" "compliance_alerts" {`);
    lines.push(`  name = "\${var.project-name}-compliance-alerts"`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_sns_topic_subscription" "email_alerts" {`);
    lines.push(`  topic_arn = aws_sns_topic.compliance_alerts.arn`);
    lines.push(`  protocol  = "email"`);
    lines.push(`  endpoint  = var.notification-email`);
    lines.push(`}`);
    lines.push('');

    lines.push('# CloudWatch Dashboard');
    lines.push(`resource "aws_cloudwatch_dashboard" "compliance_dashboard" {`);
    lines.push(`  dashboard_name = "\${var.project-name}-compliance-dashboard"`);
    lines.push(`  dashboard_body = <<EOF`);
    lines.push(getCloudWatchDashboardJSON(config));
    lines.push(`EOF`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Variables');
    lines.push(`variable "project-name" {`);
    lines.push(`  description = "Project name"`);
    lines.push(`  type = string`);
    lines.push(`}`);
    lines.push('');
    lines.push(`variable "notification-email" {`);
    lines.push(`  description = "Email for compliance notifications"`);
    lines.push(`  type = string`);
    lines.push(`}`);

  } else if (provider === 'azure') {
    lines.push('# Storage Account for compliance reports');
    lines.push(`resource "azurerm_storage_account" "compliance_reports" {`);
    lines.push(`  name                     = "\${var.project-name}compreports"`);
    lines.push(`  resource_group_name      = var.resource-group-name`);
    lines.push(`  location                 = var.location`);
    lines.push(`  account_tier             = "Standard"`);
    lines.push(`  account_replication_type = "GRS"`);
    lines.push(`  enable_https_traffic_only = true`);
    lines.push('');
    lines.push(`  blob_properties {`);
    lines.push(`    versioning_enabled = true`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Storage Container for reports');
    lines.push(`resource "azurerm_storage_container" "reports" {`);
    lines.push(`  name                 = "reports"`);
    lines.push(`  storage_account_name = azurerm_storage_account.compliance_reports.name`);
    lines.push(`  container_access_type = "Private"`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cosmos DB Account for compliance data');
    lines.push(`resource "azurerm_cosmosdb_account" "compliance" {`);
    lines.push(`  name                = "\${var.project-name}-compliance-db"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  offer_type          = "Standard"`);
    lines.push(`  kind                = "GlobalDocumentDB"`);
    lines.push('');
    lines.push(`  enable_automatic_failover = false`);
    lines.push('');
    lines.push(`  consistency_policy {`);
    lines.push(`    consistency_level       = "BoundedStaleness"`);
    lines.push(`    max_interval_in_seconds = 300`);
    lines.push(`    max_staleness_prefix    = 100000`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Key Vault for encryption keys');
    lines.push(`resource "azurerm_key_vault" "compliance" {`);
    lines.push(`  name                = "\${var.project-name}-compliance-kv"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  tenant_id           = var.tenant-id`);
    lines.push(`  sku_name            = "standard"`);
    lines.push('');
    lines.push(`  purge_protection_enabled = true`);
    lines.push(`  soft_delete_retention_days = 90`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Function App for report generation');
    lines.push(`resource "azurerm_function_app" "report_generator" {`);
    lines.push(`  name                = "\${var.project-name}-report-generator"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  app_service_plan_id = azurerm_app_service_plan.compliance.id`);
    lines.push('');
    lines.push(`  app_settings = {`);
    lines.push(`    REPORTS_STORAGE_CONNECTION = azurerm_storage_account.compliance_reports.primary_connection_string`);
    lines.push(`    COSMOSDB_CONNECTION = azurerm_cosmosdb_account.compliance.connection_string`);
    lines.push(`    KEY_VAULT_URI = azurerm_key_vault.compliance.vault_uri`);
    lines.push(`    COMPLIANCE_THRESHOLD = tostring(${config.settings.complianceThreshold})`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Log Analytics Workspace for compliance logging');
    lines.push(`resource "azurerm_log_analytics_workspace" "compliance" {`);
    lines.push(`  name                = "\${var.project-name}-compliance-logs"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  sku                 = "PerGB2018"`);
    lines.push(`  retention_in_days   = ${config.settings.evidenceRetentionDays}`);
    lines.push(`}`);
    lines.push('');

  } else if (provider === 'gcp') {
    lines.push('# GCS Bucket for compliance reports');
    lines.push(`resource "google_storage_bucket" "compliance_reports" {`);
    lines.push(`  name          = "\${var.project-name}-compliance-reports"`);
    lines.push(`  location      = var.location`);
    lines.push(`  force_destroy = false`);
    lines.push(`  uniform_bucket_level_access = true`);
    lines.push('');
    lines.push(`  versioning {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  lifecycle_rule {`);
    lines.push(`    condition {`);
    lines.push(`      age = ${config.settings.evidenceRetentionDays}`);
    lines.push(`    }`);
    lines.push(`    action {`);
    lines.push(`      type = "Delete"`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Firestore for compliance controls');
    lines.push(`resource "google_firestore_database" "compliance_controls" {`);
    lines.push(`  name     = "\${var.project-name}-compliance-controls"`);
    lines.push(`  location = var.location`);
    lines.push(`  type     = "FIRESTORE_NATIVE"`);
    lines.push(`}`);
    lines.push('');

    lines.push('# KMS Key Ring and Key');
    lines.push(`resource "google_kms_key_ring" "compliance" {`);
    lines.push(`  name     = "\${var.project-name}-compliance-keyring"`);
    lines.push(`  location = var.location`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "google_kms_crypto_key" "compliance_reports" {`);
    lines.push(`  name     = "compliance-reports"`);
    lines.push(`  key_ring = google_kms_key_ring.compliance.id`);
    lines.push(`  purpose  = "ENCRYPT_DECRYPT"`);
    lines.push('');
    lines.push(`  version_template {`);
    lines.push(`    protection_level = "SOFTWARE"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  rotation_period = "${config.settings.enableEncryption ? '7776000s' : '0s'}"`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cloud Scheduler for automated reports');
    lines.push(`resource "google_cloud_scheduler_job" "report_schedule" {`);
    lines.push(`  name             = "\${var.project-name}-report-schedule"`);
    lines.push(`  description      = "Automated compliance report generation"`);
    lines.push(`  schedule          = "${getGcpScheduleExpression(config.settings.frequency)}"`);
    lines.push(`  time_zone        = "UTC"`);
    lines.push('');
    lines.push(`  http_target {`);
    lines.push(`    http_method = "POST"`);
    lines.push(`    uri         = google_cloudfunctions_v2_function.report_generator.https_trigger_url`);
    lines.push(`    body        = jsonencode({`);
    lines.push(`      action = "generate_report"`);
    lines.push(`    })`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cloud Functions for report generation');
    lines.push(`resource "google_cloudfunctions_v2_function" "report_generator" {`);
    lines.push(`  name        = "\${var.project-name}-report-generator"`);
    lines.push(`  location    = var.location`);
    lines.push(`  description = "Generate compliance reports"`);
    lines.push('');
    lines.push(`  build_config {`);
    lines.push(`    runtime     = "nodejs20"`);
    lines.push(`    entry_point = "generateReport"`);
    lines.push(`    source {`);
    lines.push(`      storage_source {`);
    lines.push(`        bucket = google_storage_bucket.source_code.name`);
    lines.push(`        object = google_storage_bucket_object.function_source.name`);
    lines.push(`      }`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  environment_variables = {`);
    lines.push(`    REPORTS_BUCKET = google_storage_bucket.compliance_reports.name`);
    lines.push(`    COMPLIANCE_THRESHOLD = tostring(${config.settings.complianceThreshold})`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// Helper functions
function getScheduleExpression(frequency: string): string {
  switch (frequency) {
    case 'daily': return 'rate(1 day)';
    case 'weekly': return 'rate(7 days)';
    case 'monthly': return 'rate(30 days)';
    case 'quarterly': return 'rate(90 days)';
    case 'annual': return 'rate(365 days)';
    default: return 'rate(30 days)';
  }
}

function getGcpScheduleExpression(frequency: string): string {
  switch (frequency) {
    case 'daily': return '0 1 * * *';
    case 'weekly': return '0 1 * * 0';
    case 'monthly': return '0 1 1 * *';
    case 'quarterly': return '0 1 1 */3 *';
    case 'annual': return '0 1 1 1 *';
    default: return '0 1 1 * *';
  }
}

function getCloudWatchDashboardJSON(config: RegulatoryConfig): string {
  const widgets = [];

  // Compliance Score widget
  widgets.push({
    type: 'gauge',
    x: 0,
    y: 0,
    width: 6,
    height: 6,
    properties: {
      metrics: [
        [{ label: 'Compliance Score', expr: `avg(compliance_score{project="${config.projectName}"})` }],
      ],
      view: 'gauge',
      region: 'us-east-1',
      title: 'Overall Compliance Score',
      stat: 'Average',
      period: 300,
      setPeriodToTimeRange: true,
    }
  });

  // Findings by Severity widget
  widgets.push({
    type: 'pie',
    x: 6,
    y: 0,
    width: 6,
    height: 6,
    properties: {
      metrics: [
        [{ label: 'Critical', expr: `sum(findings{project="${config.projectName}",severity="critical"})` }],
        [{ label: 'High', expr: `sum(findings{project="${config.projectName}",severity="high"})` }],
        [{ label: 'Medium', expr: `sum(findings{project="${config.projectName}",severity="medium"})` }],
        [{ label: 'Low', expr: `sum(findings{project="${config.projectName}",severity="low"})` }],
      ],
      region: 'us-east-1',
      title: 'Findings by Severity',
      stat: 'Sum',
      period: 300,
    }
  });

  // Controls Status widget
  widgets.push({
    type: 'bar',
    x: 12,
    y: 0,
    width: 12,
    height: 6,
    properties: {
      metrics: [
        [{ label: 'Compliant', expr: `sum(controls{project="${config.projectName}",status="compliant"})` }],
        [{ label: 'Non-Compliant', expr: `sum(controls{project="${config.projectName}",status="non-compliant"})` }],
        [{ label: 'Partial', expr: `sum(controls{project="${config.projectName}",status="partial"})` }],
      ],
      region: 'us-east-1',
      title: 'Control Status',
      stat: 'Sum',
      period: 300,
    }
  });

  return JSON.stringify({ widgets });
}

// Generate TypeScript manager class
export function generateTypeScriptManager(): string {
  return `// Regulatory Reporting Manager - TypeScript

import { EventEmitter } from 'events';

export type ReportType = 'sox' | 'gdpr' | 'hipaa' | 'pci-dss' | 'nist-800-53' | 'iso-27001' | 'soc-2' | 'custom';
export type ReportStatus = 'draft' | 'in-review' | 'approved' | 'rejected' | 'archived';
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partial' | 'pending-review';
export type ControlStatus = 'compliant' | 'non-compliant' | 'partial' | 'not-applicable' | 'pending-review';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ComplianceControl {
  id: string;
  framework: ReportType;
  controlId: string;
  title: string;
  description: string;
  category: string;
  status: ControlStatus;
  riskLevel: RiskLevel;
  testingRequired: boolean;
  testFrequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  lastTestedDate?: Date;
  nextTestDueDate: Date;
  owner: string;
  tester?: string;
  evidenceIds: string[];
}

export interface RegulatoryReport {
  id: string;
  name: string;
  reportType: ReportType;
  reportingPeriod: { start: Date; end: Date };
  generatedAt: Date;
  generatedBy: string;
  status: ReportStatus;
  overallScore: number;
  complianceStatus: ComplianceStatus;
  controls: ReportControl[];
  findings: ReportFinding[];
  signoffs: ReportSignoff[];
}

export interface ReportControl {
  controlId: string;
  title: string;
  status: ControlStatus;
  riskLevel: RiskLevel;
  testDate?: Date;
  tester?: string;
  findings: string[];
  evidenceIds: string[];
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
  status: 'open' | 'acknowledged' | 'remediating' | 'remediated';
  assignedTo?: string;
  dueDate?: Date;
  discoveredDate: Date;
  discoveredBy: string;
}

export interface ReportSignoff {
  role: string;
  name: string;
  email: string;
  signedAt: Date;
  signature: string;
  comments?: string;
}

export interface ComplianceDashboard {
  id: string;
  name: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  startDate: Date;
  endDate: Date;
  metrics: DashboardMetric[];
  enabled: boolean;
}

export interface DashboardMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: ComplianceStatus;
  lastUpdated: Date;
}

export class RegulatoryReportingManager extends EventEmitter {
  private controls: Map<string, ComplianceControl> = new Map();
  private reports: Map<string, RegulatoryReport> = new Map();
  private dashboards: Map<string, ComplianceDashboard> = new Map();
  private settings: ReportingSettings;

  constructor(settings: ReportingSettings) {
    super();
    this.settings = settings;
  }

  // Control Management
  async createControl(control: Omit<ComplianceControl, 'id'>): Promise<ComplianceControl> {
    const id = this.generateId('ctrl');
    const newControl: ComplianceControl = { ...control, id };
    this.controls.set(id, newControl);
    this.emit('controlCreated', newControl);
    return newControl;
  }

  async updateControl(id: string, updates: Partial<ComplianceControl>): Promise<ComplianceControl | null> {
    const control = this.controls.get(id);
    if (!control) return null;

    const updated = { ...control, ...updates };
    this.controls.set(id, updated);
    this.emit('controlUpdated', updated);
    return updated;
  }

  async deleteControl(id: string): Promise<boolean> {
    const deleted = this.controls.delete(id);
    if (deleted) {
      this.emit('controlDeleted', id);
    }
    return deleted;
  }

  getControl(id: string): ComplianceControl | undefined {
    return this.controls.get(id);
  }

  listControls(filter?: { framework?: ReportType; status?: ControlStatus }): ComplianceControl[] {
    let controls = Array.from(this.controls.values());

    if (filter?.framework) {
      controls = controls.filter(c => c.framework === filter.framework);
    }
    if (filter?.status) {
      controls = controls.filter(c => c.status === filter.status);
    }

    return controls;
  }

  // Report Generation
  async generateReport(params: {
    name: string;
    reportType: ReportType;
    startDate: Date;
    endDate: Date;
    generatedBy: string;
  }): Promise<RegulatoryReport> {
    const controls = this.listControls({ framework: params.reportType });
    const findings = await this.collectFindings(params.reportType, params.startDate, params.endDate);

    const reportControls = controls.map(ctrl => ({
      controlId: ctrl.controlId,
      title: ctrl.title,
      status: ctrl.status,
      riskLevel: ctrl.riskLevel,
      testDate: ctrl.lastTestedDate,
      tester: ctrl.tester,
      findings: findings.filter(f => f.control === ctrl.controlId).map(f => f.id),
      evidenceIds: ctrl.evidenceIds,
      nextReviewDate: ctrl.nextTestDueDate,
    } as ReportControl);

    const score = this.calculateComplianceScore(reportControls);
    const complianceStatus = this.getComplianceStatus(score);

    const report: RegulatoryReport = {
      id: this.generateId('rpt'),
      name: params.name,
      reportType: params.reportType,
      reportingPeriod: { start: params.startDate, end: params.endDate },
      generatedAt: new Date(),
      generatedBy: params.generatedBy,
      status: 'draft',
      overallScore: score,
      complianceStatus,
      controls: reportControls,
      findings,
      signoffs: [],
    };

    this.reports.set(report.id, report);
    this.emit('reportGenerated', report);
    return report;
  }

  async submitForApproval(reportId: string): Promise<RegulatoryReport | null> {
    const report = this.reports.get(reportId);
    if (!report) return null;

    report.status = 'in-review';
    this.emit('reportSubmitted', report);
    return report;
  }

  async approveReport(reportId: string, signoff: ReportSignoff): Promise<RegulatoryReport | null> {
    const report = this.reports.get(reportId);
    if (!report) return null;

    report.signoffs.push(signoff);
    report.status = 'approved';
    this.emit('reportApproved', report);
    return report;
  }

  async rejectReport(reportId: string, reason: string): Promise<RegulatoryReport | null> {
    const report = this.reports.get(reportId);
    if (!report) return null;

    report.status = 'rejected';
    this.emit('reportRejected', { report, reason });
    return report;
  }

  // Dashboard Management
  async createDashboard(dashboard: Omit<ComplianceDashboard, 'id'>): Promise<ComplianceDashboard> {
    const id = this.generateId('dash');
    const newDashboard: ComplianceDashboard = { ...dashboard, id };
    this.dashboards.set(id, newDashboard);
    this.emit('dashboardCreated', newDashboard);
    return newDashboard;
  }

  async refreshDashboard(id: string): Promise<ComplianceDashboard | null> {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) return null;

    const metrics = await this.calculateDashboardMetrics(dashboard);
    const updated = {
      ...dashboard,
      metrics,
      lastRefresh: new Date(),
    };

    this.dashboards.set(id, updated);
    this.emit('dashboardRefreshed', updated);
    return updated;
  }

  // Compliance Calculations
  private calculateComplianceScore(controls: ReportControl[]): number {
    if (controls.length === 0) return 100;

    const compliantCount = controls.filter(c => c.status === 'compliant').length;
    const partialCount = controls.filter(c => c.status === 'partial').length;
    const naCount = controls.filter(c => c.status === 'not-applicable').length;

    const applicableCount = controls.length - naCount;
    if (applicableCount === 0) return 100;

    const weightedScore = ((compliantCount * 100) + (partialCount * 50)) / applicableCount;
    return Math.round(weightedScore);
  }

  private getComplianceStatus(score: number): ComplianceStatus {
    if (score >= 95) return 'compliant';
    if (score >= 80) return 'partial';
    return 'non-compliant';
  }

  private async collectFindings(
    framework: ReportType,
    startDate: Date,
    endDate: Date
  ): Promise<ReportFinding[]> {
    const findings: ReportFinding[] = [];
    const controls = this.listControls({ framework });

    for (const control of controls) {
      if (control.status === 'non-compliant') {
        findings.push({
          id: this.generateId('find'),
          control: control.controlId,
          severity: control.riskLevel,
          title: \`Control \${control.controlId} Non-Compliant\`,
          description: control.description,
          impact: 'Compliance gap identified',
          recommendation: 'Implement required controls',
          status: 'open',
          assignedTo: control.owner,
          discoveredDate: new Date(),
          discoveredBy: 'system',
        });
      }
    }

    return findings;
  }

  private async calculateDashboardMetrics(dashboard: ComplianceDashboard): Promise<DashboardMetric[]> {
    const controls = Array.from(this.controls.values());

    return [
      {
        id: 'total-controls',
        name: 'Total Controls',
        value: controls.length,
        unit: '',
        trend: 'stable',
        status: 'compliant',
        lastUpdated: new Date(),
      },
      {
        id: 'compliance-rate',
        name: 'Compliance Rate',
        value: this.calculateComplianceScore(controls.map(c => ({
          controlId: c.id,
          title: c.title,
          status: c.status,
          riskLevel: c.riskLevel,
          nextReviewDate: c.nextTestDueDate,
        } as ReportControl))),
        unit: '%',
        trend: 'up',
        status: this.getComplianceStatus(this.calculateComplianceScore(controls.map(c => ({
          controlId: c.id,
          title: c.title,
          status: c.status,
          riskLevel: c.riskLevel,
          nextReviewDate: c.nextTestDueDate,
        } as ReportControl)))),
        lastUpdated: new Date(),
      },
      {
        id: 'open-findings',
        name: 'Open Findings',
        value: controls.filter(c => c.status === 'non-compliant').length,
        unit: '',
        trend: 'down',
        status: controls.filter(c => c.status === 'non-compliant').length > 0 ? 'non-compliant' : 'compliant',
        lastUpdated: new Date(),
      },
    ];
  }

  // Utility methods
  private generateId(prefix: string): string {
    return \`\${prefix}-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
  }

  getReport(id: string): RegulatoryReport | undefined {
    return this.reports.get(id);
  }

  listReports(filter?: { reportType?: ReportType; status?: ReportStatus }): RegulatoryReport[] {
    let reports = Array.from(this.reports.values());

    if (filter?.reportType) {
      reports = reports.filter(r => r.reportType === filter.reportType);
    }
    if (filter?.status) {
      reports = reports.filter(r => r.status === filter.status);
    }

    return reports;
  }
}

export interface ReportingSettings {
  autoGenerate: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  formats: string[];
  includeEvidence: boolean;
  requireApproval: boolean;
  approvers: string[];
  complianceThreshold: number;
  enableDashboard: boolean;
  dashboardRefreshInterval: number;
}
`;
}

// Generate Python manager class
export function generatePythonManager(): string {
  return `# Regulatory Reporting Manager - Python

from typing import Dict, List, Set, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
import uuid
import json
from abc import ABC, abstractmethod

class ReportType(Enum):
    SOX = "sox"
    GDPR = "gdpr"
    HIPAA = "hipaa"
    PCI_DSS = "pci-dss"
    NIST_800_53 = "nist-800-53"
    ISO_27001 = "iso-27001"
    SOC_2 = "soc-2"
    CUSTOM = "custom"

class ReportStatus(Enum):
    DRAFT = "draft"
    IN_REVIEW = "in-review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"

class ComplianceStatus(Enum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non-compliant"
    PARTIAL = "partial"
    PENDING_REVIEW = "pending-review"

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
class ComplianceControl:
    id: str
    framework: ReportType
    control_id: str
    title: str
    description: str
    category: str
    status: ControlStatus
    risk_level: RiskLevel
    testing_required: bool
    test_frequency: str  # monthly, quarterly, semi-annual, annual
    last_tested_date: Optional[datetime]
    next_test_due_date: datetime
    owner: str
    tester: Optional[str]
    evidence_ids: List[str]

@dataclass
class ReportFinding:
    id: str
    control: str
    severity: RiskLevel
    title: str
    description: str
    impact: str
    recommendation: str
    status: str  # open, acknowledged, remediating, remediated
    assigned_to: Optional[str]
    due_date: Optional[datetime]
    discovered_date: datetime
    discovered_by: str

@dataclass
class ReportSignoff:
    role: str
    name: str
    email: str
    signed_at: datetime
    signature: str
    comments: Optional[str]

@dataclass
class ReportControl:
    control_id: str
    title: str
    status: ControlStatus
    risk_level: RiskLevel
    test_date: Optional[datetime]
    tester: Optional[str]
    findings: List[str]
    evidence_ids: List[str]
    next_review_date: datetime

@dataclass
class RegulatoryReport:
    id: str
    name: str
    report_type: ReportType
    reporting_period_start: datetime
    reporting_period_end: datetime
    generated_at: datetime
    generated_by: str
    status: ReportStatus
    overall_score: int
    compliance_status: ComplianceStatus
    controls: List[ReportControl]
    findings: List[ReportFinding]
    signoffs: List[ReportSignoff]

@dataclass
class DashboardMetric:
    id: str
    name: str
    value: float
    unit: str
    trend: str  # up, down, stable
    status: ComplianceStatus
    last_updated: datetime

@dataclass
class ComplianceDashboard:
    id: str
    name: str
    period: str  # daily, weekly, monthly, quarterly, annual
    start_date: datetime
    end_date: datetime
    metrics: List[DashboardMetric]
    enabled: bool

@dataclass
class ReportingSettings:
    auto_generate: bool
    frequency: str  # daily, weekly, monthly, quarterly, annual
    formats: List[str]
    include_evidence: bool
    require_approval: bool
    approvers: List[str]
    compliance_threshold: int
    enable_dashboard: bool
    dashboard_refresh_interval: int

class RegulatoryReportingManager:
    def __init__(self, settings: ReportingSettings):
        self.settings = settings
        self.controls: Dict[str, ComplianceControl] = {}
        self.reports: Dict[str, RegulatoryReport] = {}
        self.dashboards: Dict[str, ComplianceDashboard] = {}
        self._event_handlers: Dict[str, List[Callable]] = {}

    def _emit(self, event_name: str, *args, **kwargs):
        for handler in self._event_handlers.get(event_name, []):
            handler(*args, **kwargs)

    def on(self, event_name: str, handler: Callable):
        if event_name not in self._event_handlers:
            self._event_handlers[event_name] = []
        self._event_handlers[event_name].append(handler)

    # Control Management
    async def create_control(self, control: ComplianceControl) -> ComplianceControl:
        control.id = f"ctrl-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        self.controls[control.id] = control
        self._emit('controlCreated', control)
        return control

    async def update_control(
        self,
        control_id: str,
        updates: Dict[str, Any]
    ) -> Optional[ComplianceControl]:
        control = self.controls.get(control_id)
        if not control:
            return None

        for key, value in updates.items():
            if hasattr(control, key):
                setattr(control, key, value)

        self._emit('controlUpdated', control)
        return control

    async def delete_control(self, control_id: str) -> bool:
        if control_id in self.controls:
            del self.controls[control_id]
            self._emit('controlDeleted', control_id)
            return True
        return False

    def get_control(self, control_id: str) -> Optional[ComplianceControl]:
        return self.controls.get(control_id)

    def list_controls(
        self,
        framework: Optional[ReportType] = None,
        status: Optional[ControlStatus] = None
    ) -> List[ComplianceControl]:
        controls = list(self.controls.values())

        if framework:
            controls = [c for c in controls if c.framework == framework]
        if status:
            controls = [c for c in controls if c.status == status]

        return controls

    # Report Generation
    async def generate_report(
        self,
        name: str,
        report_type: ReportType,
        start_date: datetime,
        end_date: datetime,
        generated_by: str
    ) -> RegulatoryReport:
        controls = self.list_controls(framework=report_type)
        findings = await self._collect_findings(report_type, start_date, end_date)

        report_controls = [
            ReportControl(
                control_id=ctrl.control_id,
                title=ctrl.title,
                status=ctrl.status,
                risk_level=ctrl.risk_level,
                test_date=ctrl.last_tested_date,
                tester=ctrl.tester,
                findings=[f.id for f in findings if f.control == ctrl.control_id],
                evidence_ids=ctrl.evidence_ids,
                next_review_date=ctrl.next_test_due_date
            )
            for ctrl in controls
        ]

        score = self._calculate_compliance_score(report_controls)
        compliance_status = self._get_compliance_status(score)

        report = RegulatoryReport(
            id=f"rpt-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}",
            name=name,
            report_type=report_type,
            reporting_period_start=start_date,
            reporting_period_end=end_date,
            generated_at=datetime.utcnow(),
            generated_by=generated_by,
            status=ReportStatus.DRAFT,
            overall_score=score,
            compliance_status=compliance_status,
            controls=report_controls,
            findings=findings,
            signoffs=[]
        )

        self.reports[report.id] = report
        self._emit('reportGenerated', report)
        return report

    async def submit_for_approval(self, report_id: str) -> Optional[RegulatoryReport]:
        report = self.reports.get(report_id)
        if not report:
            return None

        report.status = ReportStatus.IN_REVIEW
        self._emit('reportSubmitted', report)
        return report

    async def approve_report(
        self,
        report_id: str,
        signoff: ReportSignoff
    ) -> Optional[RegulatoryReport]:
        report = self.reports.get(report_id)
        if not report:
            return None

        report.signoffs.append(signoff)
        report.status = ReportStatus.APPROVED
        self._emit('reportApproved', report)
        return report

    async def reject_report(
        self,
        report_id: str,
        reason: str
    ) -> Optional[RegulatoryReport]:
        report = self.reports.get(report_id)
        if not report:
            return None

        report.status = ReportStatus.REJECTED
        self._emit('reportRejected', report, reason)
        return report

    # Dashboard Management
    async def create_dashboard(self, dashboard: ComplianceDashboard) -> ComplianceDashboard:
        dashboard.id = f"dash-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        self.dashboards[dashboard.id] = dashboard
        self._emit('dashboardCreated', dashboard)
        return dashboard

    async def refresh_dashboard(self, dashboard_id: str) -> Optional[ComplianceDashboard]:
        dashboard = self.dashboards.get(dashboard_id)
        if not dashboard:
            return None

        metrics = await self._calculate_dashboard_metrics(dashboard)
        dashboard.metrics = metrics
        dashboard.last_refresh = datetime.utcnow()

        self._emit('dashboardRefreshed', dashboard)
        return dashboard

    # Compliance Calculations
    def _calculate_compliance_score(self, controls: List[ReportControl]) -> int:
        if not controls:
            return 100

        compliant_count = sum(1 for c in controls if c.status == ControlStatus.COMPLIANT)
        partial_count = sum(1 for c in controls if c.status == ControlStatus.PARTIAL)
        na_count = sum(1 for c in controls if c.status == ControlStatus.NOT_APPLICABLE)

        applicable_count = len(controls) - na_count
        if applicable_count == 0:
            return 100

        weighted_score = ((compliant_count * 100) + (partial_count * 50)) / applicable_count
        return round(weighted_score)

    def _get_compliance_status(self, score: int) -> ComplianceStatus:
        if score >= 95:
            return ComplianceStatus.COMPLIANT
        if score >= 80:
            return ComplianceStatus.PARTIAL
        return ComplianceStatus.NON_COMPLIANT

    async def _collect_findings(
        self,
        framework: ReportType,
        start_date: datetime,
        end_date: datetime
    ) -> List[ReportFinding]:
        findings = []
        controls = self.list_controls(framework=framework)

        for control in controls:
            if control.status == ControlStatus.NON_COMPLIANT:
                findings.append(ReportFinding(
                    id=f"find-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}",
                    control=control.control_id,
                    severity=control.risk_level,
                    title=f"Control {control.control_id} Non-Compliant",
                    description=control.description,
                    impact="Compliance gap identified",
                    recommendation="Implement required controls",
                    status="open",
                    assigned_to=control.owner,
                    discovered_date=datetime.utcnow(),
                    discovered_by="system"
                ))

        return findings

    async def _calculate_dashboard_metrics(
        self,
        dashboard: ComplianceDashboard
    ) -> List[DashboardMetric]:
        controls = list(self.controls.values())

        report_controls = [
            ReportControl(
                control_id=c.id,
                title=c.title,
                status=c.status,
                risk_level=c.risk_level,
                test_date=c.last_tested_date,
                tester=c.tester,
                findings=[],
                evidence_ids=[],
                next_review_date=c.next_test_due_date
            )
            for c in controls
        ]

        score = self._calculate_compliance_score(report_controls)
        open_findings = sum(1 for c in controls if c.status == ControlStatus.NON_COMPLIANT)

        return [
            DashboardMetric(
                id="total-controls",
                name="Total Controls",
                value=len(controls),
                unit="",
                trend="stable",
                status=ComplianceStatus.COMPLIANT,
                last_updated=datetime.utcnow()
            ),
            DashboardMetric(
                id="compliance-rate",
                name="Compliance Rate",
                value=score,
                unit="%",
                trend="up",
                status=self._get_compliance_status(score),
                last_updated=datetime.utcnow()
            ),
            DashboardMetric(
                id="open-findings",
                name="Open Findings",
                value=open_findings,
                unit="",
                trend="down",
                status=ComplianceStatus.NON_COMPLIANT if open_findings > 0 else ComplianceStatus.COMPLIANT,
                last_updated=datetime.utcnow()
            )
        ]

    # Utility methods
    def get_report(self, report_id: str) -> Optional[RegulatoryReport]:
        return self.reports.get(report_id)

    def list_reports(
        self,
        report_type: Optional[ReportType] = None,
        status: Optional[ReportStatus] = None
    ) -> List[RegulatoryReport]:
        reports = list(self.reports.values())

        if report_type:
            reports = [r for r in reports if r.report_type == report_type]
        if status:
            reports = [r for r in reports if r.status == status]

        return reports
`;
}

// Write files to output directory
export async function writeRegulatoryFiles(
  config: RegulatoryConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  const markdown = generateRegulatoryMarkdown(config);
  await fs.writeFile(path.join(outputDir, 'REGULATORY_REPORTING.md'), markdown);

  // Write Terraform configurations
  for (const provider of config.providers) {
    const terraform = generateRegulatoryTerraform(config, provider);
    const tfDir = path.join(outputDir, 'terraform', provider);
    await fs.ensureDir(tfDir);
    await fs.writeFile(path.join(tfDir, 'main.tf'), terraform);
  }

  // Write manager class
  const managerFile = language === 'typescript'
    ? 'regulatory-manager.ts'
    : 'regulatory_manager.py';

  const managerCode = language === 'typescript'
    ? generateTypeScriptManager()
    : generatePythonManager();

  await fs.writeFile(path.join(outputDir, managerFile), managerCode);

  // Write example configuration
  const exampleConfig = {
    projectName: config.projectName,
    providers: config.providers,
    settings: config.settings,
    controls: config.controls.slice(0, 3).map(c => ({
      id: c.id,
      framework: c.framework,
      controlId: c.controlId,
      title: c.title,
      status: c.status,
    })),
  };
  await fs.writeFile(
    path.join(outputDir, 'config.example.json'),
    JSON.stringify(exampleConfig, null, 2)
  );
}

// Display configuration summary
export function displayRegulatoryConfig(config: RegulatoryConfig, language: 'typescript' | 'python' = 'typescript'): void {
  console.log(chalk.bold('\n📊 Regulatory Reporting Configuration\n'));

  // Settings
  console.log(chalk.cyan('Reporting Settings:'));
  console.log(`  ${chalk.yellow('Auto-Generate:')} ${chalk.white(config.settings.autoGenerate ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Frequency:')} ${chalk.white(config.settings.frequency)}`);
  console.log(`  ${chalk.yellow('Formats:')} ${chalk.white(config.settings.formats.join(', '))}`);
  console.log(`  ${chalk.yellow('Include Evidence:')} ${chalk.white(config.settings.includeEvidence ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Evidence Retention:')} ${chalk.white(`${config.settings.evidenceRetentionDays} days`)}`);
  console.log(`  ${chalk.yellow('Require Approval:')} ${chalk.white(config.settings.requireApproval ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Notification Channels:')} ${chalk.white(config.settings.notificationChannels.map(n => n.type).join(', '))}`);
  console.log(`  ${chalk.yellow('Compliance Threshold:')} ${chalk.white(`${config.settings.complianceThreshold}%`)}`);
  console.log(`  ${chalk.yellow('Enable Dashboard:')} ${chalk.white(config.settings.enableDashboard ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Dashboard Refresh:')} ${chalk.white(`${config.settings.dashboardRefreshInterval} min`)}`);
  console.log(`  ${chalk.yellow('Real-Time Updates:')} ${chalk.white(config.settings.enableRealTimeUpdates ? 'Yes' : 'No')}`);
  console.log(`  ${chalk.yellow('Trend Analysis:')} ${chalk.white(config.settings.enableTrendAnalysis ? `Yes (${config.settings.trendAnalysisPeriod} days)` : 'No')}`);
  console.log('');

  // Dashboards
  if (config.dashboards.length > 0) {
    console.log(chalk.cyan(`Compliance Dashboards (${config.dashboards.length}):`));
    for (const dashboard of config.dashboards) {
      const status = dashboard.enabled ? chalk.green('enabled') : chalk.gray('disabled');
      console.log(`  ${chalk.white(dashboard.name)} - ${status}`);
      console.log(`    ${chalk.gray(`Period: ${dashboard.period} | Widgets: ${dashboard.widgets.length} | Metrics: ${dashboard.metrics.length}`)}`);
    }
    console.log('');
  }

  // Controls
  if (config.controls.length > 0) {
    const compliantCount = config.controls.filter(c => c.status === 'compliant').length;
    const nonCompliantCount = config.controls.filter(c => c.status === 'non-compliant').length;
    const partialCount = config.controls.filter(c => c.status === 'partial').length;

    console.log(chalk.cyan(`Compliance Controls (${config.controls.length}):`));
    console.log(`  ${chalk.green('✓')} Compliant: ${compliantCount}`);
    console.log(`  ${chalk.red('✗')} Non-Compliant: ${nonCompliantCount}`);
    console.log(`  ${chalk.yellow('◐')} Partial: ${partialCount}`);
    console.log('');
  }

  // Reports
  if (config.reports.length > 0) {
    console.log(chalk.cyan(`Regulatory Reports (${config.reports.length}):`));
    for (const report of config.reports) {
      const statusIcon = report.status === 'approved' ? chalk.green('✓') :
        report.status === 'in-review' ? chalk.yellow('⟳') :
        report.status === 'rejected' ? chalk.red('✗') : chalk.gray('○');
      const complianceIcon = report.complianceStatus === 'compliant' ? chalk.green('✓') :
        report.complianceStatus === 'non-compliant' ? chalk.red('✗') : chalk.yellow('◐');

      console.log(`  ${statusIcon} ${chalk.bold(report.name)} (${report.reportType.toUpperCase()})`);
      console.log(`    ${complianceIcon} ${report.complianceStatus} | Score: ${report.overallScore}/100 | Findings: ${report.findings.length}`);
    }
    console.log('');
  }

  // Frameworks
  if (config.frameworks.length > 0) {
    console.log(chalk.cyan(`Compliance Frameworks (${config.frameworks.length}):`));
    for (const framework of config.frameworks) {
      const status = framework.enabled ? chalk.green('enabled') : chalk.gray('disabled');
      console.log(`  ${chalk.white(framework.name)} (${framework.type.toUpperCase()}) - ${status}`);
      console.log(`    ${chalk.gray(`Controls: ${framework.controls.length} | Next Assessment: ${framework.nextAssessmentDate.toISOString().split('T')[0]}`)}`);
    }
    console.log('');
  }

  // Workflows
  if (config.workflows.length > 0) {
    console.log(chalk.cyan(`Report Workflows (${config.workflows.length}):`));
    for (const workflow of config.workflows) {
      const statusIcon = workflow.status === 'completed' ? chalk.green('✓') :
        workflow.status === 'in-progress' ? chalk.yellow('⟳') :
        workflow.status === 'cancelled' ? chalk.red('✗') : chalk.gray('○');
      console.log(`  ${statusIcon} ${chalk.white(workflow.name)} (${workflow.reportType.toUpperCase()})`);
      console.log(`    ${chalk.gray(`Stage: ${workflow.currentStage}/${workflow.stages.length} | Initiated by: ${workflow.initiatedBy}`)}`);
    }
    console.log('');
  }

  // Alerts
  if (config.alerts.length > 0) {
    console.log(chalk.cyan(`Compliance Alerts (${config.alerts.length}):`));
    for (const alert of config.alerts) {
      const enabledIcon = alert.enabled ? chalk.green('🔔') : chalk.gray('🔕');
      const severityColor = alert.severity === 'critical' ? chalk.red :
        alert.severity === 'high' ? chalk.red :
        alert.severity === 'medium' ? chalk.yellow : chalk.gray;

      console.log(`  ${enabledIcon} ${severityColor(alert.severity.toUpperCase())} ${chalk.white(alert.name)}`);
      console.log(`    ${chalk.gray(`Conditions: ${alert.conditions.length} | Throttle: ${alert.throttleMinutes}min`)}`);
    }
    console.log('');
  }

  // Schedules
  if (config.schedules.length > 0) {
    console.log(chalk.cyan(`Report Schedules (${config.schedules.length}):`));
    for (const schedule of config.schedules) {
      const status = schedule.enabled ? chalk.green('enabled') : chalk.gray('disabled');
      console.log(`  ${chalk.white(schedule.name)} - ${status}`);
      console.log(`    ${chalk.gray(`Frequency: ${schedule.frequency} | Next: ${schedule.nextRunDate.toISOString().split('T')[0]}`)}`);
    }
    console.log('');
  }

  // Files written
  console.log(chalk.cyan('Files Generated:'));
  console.log(`  ${chalk.gray('•')} REGULATORY_REPORTING.md`);
  console.log(`  ${chalk.gray('•')} terraform/{provider}/main.tf`);
  console.log(`  ${chalk.gray('•')} ${language === 'typescript' ? 'regulatory-manager.ts' : 'regulatory_manager.py'}`);
  console.log(`  ${chalk.gray('•')} config.example.json`);
  console.log('');

  console.log(chalk.green(`✓ Regulatory reporting configuration generated successfully!\n`));
}
