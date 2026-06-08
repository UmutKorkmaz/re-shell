import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security risk` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerRisk(security: Command): void {
  security
  .command('risk')
  .description('Generate risk assessment and management with continuous monitoring')
  .argument('<name>', 'Name of the risk assessment project')
  .option('--auto-assess', 'Enable automated risk assessment')
  .option('--assessment-frequency <frequency>', 'Assessment frequency', 'quarterly')
  .option('--enable-monitoring', 'Enable continuous monitoring')
  .option('--monitoring-interval <minutes>', 'Monitoring interval in minutes', '60')
  .option('--enable-alerts', 'Enable real-time risk alerts')
  .option('--enable-escalation', 'Enable alert escalation')
  .option('--acceptance-threshold <threshold>', 'Risk acceptance threshold (0-100)', '50')
  .option('--require-approval', 'Require approval for risk acceptance')
  .option('--auto-mitigation', 'Auto-create mitigation plans')
  .option('--enable-heatmap', 'Enable risk heatmap visualization')
  .option('--heatmap-refresh <minutes>', 'Heatmap refresh interval in minutes', '30')
  .option('--enable-trends', 'Enable trend analysis')
  .option('--trend-period <days>', 'Trend analysis period in days', '90')
  .option('--enable-predictive', 'Enable predictive analysis')
  .option('--predictive-model <model>', 'Predictive model name', 'ml-risk-score')
  .option('--enable-dependencies', 'Enable dependency tracking')
  .option('--enable-compliance', 'Enable compliance mapping')
  .option('--compliance-frameworks <frameworks>', 'Compliance frameworks (comma-separated)', 'sox,iso-27001')
  .option('--retention <days>', 'Retention period in days', '2555')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './risk-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeRiskFiles, displayRiskConfig } = await import('../../utils/risk-assessment.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const frameworks = options.complianceFrameworks.split(',').map((f: string) => f.trim()) as Array<'sox' | 'gdpr' | 'hipaa' | 'pci-dss' | 'iso-27001' | 'nist-800-53'>;

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoAssessment: options.autoAssess || true,
        assessmentFrequency: options.assessmentFrequency as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'on-demand',
        enableContinuousMonitoring: options.enableMonitoring || true,
        monitoringInterval: parseInt(options.monitoringInterval),
        enableRealTimeAlerts: options.enableAlerts || true,
        alertEscalationEnabled: options.enableEscalation || true,
        riskAcceptanceThreshold: parseInt(options.acceptanceThreshold),
        requireApprovalForAcceptance: options.requireApproval || true,
        riskApprovers: ['ciso', 'risk-manager', 'compliance-officer'],
        autoCreateMitigation: options.autoMitigation || true,
        mitigationTemplate: 'standard-mitigation',
        enableRiskHeatmap: options.enableHeatmap || true,
        heatmapRefreshInterval: parseInt(options.heatmapRefresh),
        enableTrendAnalysis: options.enableTrends || true,
        trendAnalysisPeriod: parseInt(options.trendPeriod),
        enablePredictiveAnalysis: options.enablePredictive || false,
        predictiveModel: options.predictiveModel,
        enableDependencyTracking: options.enableDependencies || true,
        enableComplianceMapping: options.enableCompliance || true,
        complianceFrameworks: frameworks,
        retentionDays: parseInt(options.retention),
        archiveLocation: '/archive/risk',
        enableReporting: true,
        reportSchedule: '0 0 1 * *',
        stakeholders: ['ciso', 'cto', 'cfo', 'ceo'],
      },
      risks: [
        {
          id: 'risk-001',
          title: 'Data Breach Risk',
          description: 'Unauthorized access to sensitive customer data stored in cloud databases',
          category: 'security' as const,
          status: 'identified' as const,
          level: 'high' as const,
          likelihood: 'medium' as const,
          impact: 'major' as const,
          score: 63,
          calculatedAt: new Date('2024-12-15'),
          source: 'automated-scan',
          owner: 'ciso',
          assignee: 'security-lead',
          mitigation: 'mit-001',
          tags: ['security', 'privacy', 'gdpr'],
          relatedAssets: ['customer-db', 'api-gateway'],
          dependencies: [],
          assessment: 'assess-001',
          findings: [
            {
              id: 'find-001',
              title: 'Unencrypted S3 Bucket',
              description: 'Customer database stored in S3 bucket without encryption',
              severity: 'high' as const,
              confidence: 95,
              discoveredAt: new Date('2024-12-15'),
              discoveredBy: 'security-scanner',
              method: 'automated' as const,
              evidence: ['scan-report-001'],
              recommendations: ['Enable S3 bucket encryption', 'Review access policies'],
            },
          ],
          history: [
            {
              timestamp: new Date('2024-12-15'),
              user: 'security-scanner',
              action: 'created',
              details: 'Risk identified during automated security scan',
            },
          ],
          metadata: {
            created: new Date('2024-12-15'),
            createdBy: 'security-scanner',
            lastModified: new Date('2024-12-15'),
            modifiedBy: 'security-scanner',
            lastAssessed: new Date('2024-12-15'),
            assessedBy: 'risk-analyst',
            nextReview: new Date('2025-03-15'),
            externalReferences: ['CVE-2024-1234'],
            complianceMapping: [
              { framework: 'gdpr', requirement: 'ARTICLE-32', control: 'encryption', mapped: true },
              { framework: 'iso-27001', requirement: 'A.10.1.1', control: 'cryptography', mapped: true },
            ],
            customFields: { ticketId: 'SEC-001', cvssScore: 7.5 },
          },
        },
        {
          id: 'risk-002',
          title: 'Third-Party Dependency Risk',
          description: 'Critical services depend on external APIs with no SLA guarantees',
          category: 'operational' as const,
          status: 'mitigating' as const,
          level: 'critical' as const,
          likelihood: 'high' as const,
          impact: 'catastrophic' as const,
          score: 88,
          calculatedAt: new Date('2024-12-10'),
          source: 'vendor-assessment',
          owner: 'cto',
          assignee: 'architecture-lead',
          mitigation: 'mit-002',
          tags: ['vendor', 'sla', 'operational'],
          relatedAssets: ['payment-api', 'notification-service'],
          dependencies: ['risk-003'],
          assessment: 'assess-001',
          findings: [
            {
              id: 'find-002',
              title: 'No SLA with Payment Gateway',
              description: 'Payment gateway provider has no guaranteed uptime SLA',
              severity: 'critical' as const,
              confidence: 100,
              discoveredAt: new Date('2024-12-10'),
              discoveredBy: 'contract-review',
              method: 'manual' as const,
              evidence: ['contract-001'],
              recommendations: ['Negotiate SLA terms', 'Implement fallback provider'],
            },
          ],
          history: [
            {
              timestamp: new Date('2024-12-10'),
              user: 'contract-manager',
              action: 'created',
              details: 'Identified during vendor contract review',
            },
            {
              timestamp: new Date('2024-12-12'),
              user: 'cto',
              action: 'escalated',
              details: 'Escalated to executive leadership for SLA negotiation',
              newState: { status: 'mitigating' as const },
            },
          ],
          metadata: {
            created: new Date('2024-12-10'),
            createdBy: 'contract-manager',
            lastModified: new Date('2024-12-12'),
            modifiedBy: 'cto',
            lastAssessed: new Date('2024-12-12'),
            assessedBy: 'risk-analyst',
            nextReview: new Date('2025-01-15'),
            externalReferences: ['VENDOR-CONTRACT-001'],
            complianceMapping: [
              { framework: 'sox', requirement: '404', control: 'vendor-oversight', mapped: true },
            ],
            customFields: { vendorTier: 'critical', contractValue: 500000 },
          },
        },
        {
          id: 'risk-003',
          title: 'Compliance Gap Risk',
          description: 'Missing controls for SOX compliance in financial reporting systems',
          category: 'compliance' as const,
          status: 'mitigating' as const,
          level: 'high' as const,
          likelihood: 'medium' as const,
          impact: 'major' as const,
          score: 63,
          calculatedAt: new Date('2024-12-01'),
          source: 'audit-report',
          owner: 'compliance-officer',
          assignee: 'audit-team',
          mitigation: 'mit-003',
          tags: ['sox', 'compliance', 'financial'],
          relatedAssets: ['financial-system', 'reporting-db'],
          dependencies: [],
          assessment: 'assess-002',
          findings: [
            {
              id: 'find-003',
              title: 'Insufficient Access Logging',
              description: 'Financial system lacks detailed access logging for SOX 404 requirements',
              severity: 'high' as const,
              confidence: 85,
              discoveredAt: new Date('2024-12-01'),
              discoveredBy: 'external-auditor',
              method: 'incident' as const,
              evidence: ['audit-findings-001'],
              recommendations: ['Implement detailed audit logging', 'Enable log aggregation for 7-year retention'],
            },
          ],
          history: [
            {
              timestamp: new Date('2024-12-01'),
              user: 'external-auditor',
              action: 'created',
              details: 'Gap identified during Q4 audit',
            },
          ],
          metadata: {
            created: new Date('2024-12-01'),
            createdBy: 'external-auditor',
            lastModified: new Date('2024-12-01'),
            modifiedBy: 'compliance-officer',
            lastAssessed: new Date('2024-12-10'),
            assessedBy: 'compliance-officer',
            nextReview: new Date('2025-01-30'),
            externalReferences: ['SOX-Q4-2024-AUDIT'],
            complianceMapping: [
              { framework: 'sox', requirement: '404', control: 'audit-logging', mapped: false },
              { framework: 'iso-27001', requirement: 'A.12.4.1', control: 'logging', mapped: true },
            ],
            customFields: { auditYear: '2024', auditor: 'Big4' },
          },
        },
      ],
      assessments: [
        {
          id: 'assess-001',
          name: 'Q4 2024 Risk Assessment',
          type: 'periodic' as const,
          status: 'completed' as const,
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-12-15'),
          assessedBy: 'risk-manager',
          reviewers: ['ciso', 'cto', 'cfo'],
          scope: {
            assets: ['customer-db', 'payment-api', 'financial-system'],
            departments: ['engineering', 'finance', 'security'],
            processes: ['payment-processing', 'financial-reporting'],
            thirdParties: ['payment-gateway-provider'],
            locations: ['us-east-1', 'eu-west-1'],
            excludeAssets: [],
          },
          risks: ['risk-001', 'risk-002', 'risk-003'],
          methodology: 'NIST Risk Assessment Framework',
          findings: [],
          overallScore: 71,
          riskDistribution: {
            critical: 1,
            high: 2,
            medium: 0,
            low: 0,
          },
          recommendations: [
            'Prioritize mitigation of critical third-party dependencies',
            'Implement encryption for all customer data storage',
            'Enhance access logging for financial systems',
          ],
          approvedBy: 'cfo',
          approvedAt: new Date('2024-12-20'),
          nextAssessment: new Date('2025-03-15'),
        },
      ],
      mitigations: [
        {
          id: 'mit-001',
          riskId: 'risk-001',
          name: 'Data Breach Mitigation Plan',
          description: 'Implement encryption and access controls for customer data',
          status: 'in-progress' as const,
          priority: 'high' as const,
          assignedTo: 'security-lead',
          createdBy: 'ciso',
          createdAt: new Date('2024-12-15'),
          targetDate: new Date('2025-01-30'),
          tasks: [
            {
              id: 'task-001',
              title: 'Enable S3 Encryption',
              description: 'Enable default encryption for all S3 buckets',
              status: 'completed' as const,
              assignedTo: 'devops-engineer',
              dueDate: new Date('2024-12-20'),
              completedDate: new Date('2024-12-18'),
              estimatedHours: 4,
              actualHours: 3,
              dependencies: [],
              checklist: [
                { item: 'Enable AES-256 encryption', completed: true, completedBy: 'devops-engineer', completedDate: new Date('2024-12-18') },
                { item: 'Verify encryption applied', completed: true, completedBy: 'devops-engineer', completedDate: new Date('2024-12-18') },
              ],
            },
            {
              id: 'task-002',
              title: 'Update Access Policies',
              description: 'Implement least privilege access for customer database',
              status: 'in-progress' as const,
              assignedTo: 'security-engineer',
              dueDate: new Date('2025-01-15'),
              estimatedHours: 16,
              dependencies: [],
              checklist: [],
            },
            {
              id: 'task-003',
              title: 'Deploy DLP Solution',
              description: 'Implement data loss prevention for sensitive data',
              status: 'not-started' as const,
              assignedTo: 'security-architect',
              dueDate: new Date('2025-01-30'),
              estimatedHours: 40,
              dependencies: ['task-002'],
              checklist: [],
            },
          ],
          budget: 50000,
          spent: 12000,
          progress: 40,
          blockers: [],
          dependencies: [],
          effectiveness: 'effective' as const,
        },
        {
          id: 'mit-002',
          riskId: 'risk-002',
          name: 'Third-Party Risk Mitigation',
          description: 'Implement fallback provider and negotiate SLA',
          status: 'in-progress' as const,
          priority: 'critical' as const,
          assignedTo: 'procurement-manager',
          createdBy: 'cto',
          createdAt: new Date('2024-12-10'),
          targetDate: new Date('2025-02-28'),
          tasks: [
            {
              id: 'task-004',
              title: 'Negotiate SLA with Provider',
              description: 'Obtain 99.9% uptime SLA guarantee from payment gateway',
              status: 'in-progress' as const,
              assignedTo: 'procurement-manager',
              dueDate: new Date('2025-01-15'),
              estimatedHours: 20,
              dependencies: [],
              checklist: [],
            },
            {
              id: 'task-005',
              title: 'Implement Fallback Provider',
              description: 'Integrate secondary payment gateway for failover',
              status: 'not-started' as const,
              assignedTo: 'engineering-lead',
              dueDate: new Date('2025-02-28'),
              estimatedHours: 80,
              dependencies: ['task-004'],
              checklist: [],
            },
          ],
          budget: 100000,
          spent: 25000,
          progress: 25,
          blockers: ['Legal review pending'],
          dependencies: [],
          effectiveness: undefined,
        },
        {
          id: 'mit-003',
          riskId: 'risk-003',
          name: 'SOX Compliance Mitigation',
          description: 'Implement required controls for SOX 404 compliance',
          status: 'in-progress' as const,
          priority: 'high' as const,
          assignedTo: 'compliance-officer',
          createdBy: 'compliance-officer',
          createdAt: new Date('2024-12-01'),
          targetDate: new Date('2025-01-31'),
          tasks: [
            {
              id: 'task-006',
              title: 'Implement Detailed Access Logging',
              description: 'Enable detailed audit logging for financial systems',
              status: 'completed' as const,
              assignedTo: 'security-engineer',
              dueDate: new Date('2024-12-15'),
              completedDate: new Date('2024-12-12'),
              estimatedHours: 24,
              actualHours: 20,
              dependencies: [],
              checklist: [
                { item: 'Enable CloudTrail logging', completed: true, completedBy: 'security-engineer', completedDate: new Date('2024-12-10') },
                { item: 'Configure log aggregation', completed: true, completedBy: 'security-engineer', completedDate: new Date('2024-12-12') },
              ],
            },
            {
              id: 'task-007',
              title: 'Implement 7-Year Log Retention',
              description: 'Configure 7-year retention for audit logs per SOX requirements',
              status: 'in-progress' as const,
              assignedTo: 'devops-engineer',
              dueDate: new Date('2025-01-31'),
              estimatedHours: 16,
              dependencies: ['task-006'],
              checklist: [],
            },
          ],
          budget: 75000,
          spent: 45000,
          progress: 60,
          blockers: [],
          dependencies: [],
          effectiveness: 'effective' as const,
        },
      ],
      monitors: [
        {
          id: 'mon-001',
          name: 'High Risk Monitor',
          description: 'Continuous monitoring of high and critical risks',
          status: 'active' as const,
          type: 'automated' as const,
          frequency: 'continuous' as const,
          riskIds: ['risk-001', 'risk-002', 'risk-003'],
          metrics: [
            {
              id: 'metric-001',
              name: 'Risk Score',
              source: 'risk-database',
              query: 'SELECT score FROM risks WHERE id IN (:riskIds)',
              aggregation: 'max' as const,
              threshold: 70,
              operator: 'gte' as const,
              window: 5,
            },
          ],
          conditions: [
            {
              id: 'cond-001',
              metricId: 'metric-001',
              condition: 'risk-score >= 70',
              threshold: 70,
              operator: 'gte' as const,
              severity: 'high' as const,
              action: 'alert' as const,
            },
          ],
          alertRules: [
            {
              id: 'rule-001',
              name: 'High Risk Alert',
              priority: 'critical' as const,
              recipients: ['ciso', 'risk-manager'],
              channels: ['email' as const, 'slack' as const],
              template: 'high-risk-alert',
              throttleMinutes: 30,
            },
          ],
          lastRun: new Date('2024-12-15'),
          nextRun: new Date(Date.now() + 5 * 60 * 1000),
          owner: 'risk-manager',
        },
        {
          id: 'mon-002',
          name: 'Mitigation Progress Monitor',
          description: 'Track mitigation plan progress and overdue tasks',
          status: 'active' as const,
          type: 'hybrid' as const,
          frequency: 'daily' as const,
          riskIds: ['risk-001', 'risk-002', 'risk-003'],
          metrics: [
            {
              id: 'metric-002',
              name: 'Overdue Tasks',
              source: 'mitigation-database',
              query: 'SELECT COUNT(*) FROM tasks WHERE dueDate < NOW() AND status != "completed"',
              aggregation: 'count' as const,
              threshold: 1,
              operator: 'gt' as const,
              window: 1440,
            },
          ],
          conditions: [
            {
              id: 'cond-002',
              metricId: 'metric-002',
              condition: 'overdue-tasks > 1',
              threshold: 1,
              operator: 'gt' as const,
              severity: 'medium' as const,
              action: 'alert' as const,
            },
          ],
          alertRules: [
            {
              id: 'rule-002',
              name: 'Overdue Task Alert',
              priority: 'high' as const,
              recipients: ['project-manager', 'risk-manager'],
              channels: ['email' as const],
              template: 'overdue-task-alert',
              throttleMinutes: 60,
            },
          ],
          lastRun: new Date('2024-12-15'),
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
          owner: 'project-manager',
        },
      ],
      alerts: [
        {
          id: 'alert-001',
          monitorId: 'mon-001',
          riskId: 'risk-001',
          severity: 'critical' as const,
          title: 'Data Breach Risk Score Increased',
          description: 'Risk score for data breach increased above threshold',
          triggeredAt: new Date('2024-12-15'),
          triggeredBy: 'mon-001',
          resolvedAt: new Date('2024-12-15'),
          resolvedBy: 'security-lead',
          status: 'resolved' as const,
          metrics: { riskScore: 75, previousScore: 63 },
          context: { reason: 'New vulnerability discovered' },
          actions: [
            { action: 'Acknowledged by security-lead', performedBy: 'security-lead', performedAt: new Date('2024-12-15') },
            { action: 'Mitigation plan updated', performedBy: 'security-lead', performedAt: new Date('2024-12-15') },
          ],
        },
        {
          id: 'alert-002',
          monitorId: 'mon-002',
          riskId: 'risk-002',
          severity: 'high' as const,
          title: 'Mitigation Task Overdue',
          description: 'SLA negotiation task is overdue',
          triggeredAt: new Date('2024-12-20'),
          triggeredBy: 'mon-002',
          status: 'open' as const,
          metrics: { overdueTasks: 1, daysOverdue: 5 },
          context: { taskId: 'task-004', dueDate: '2025-01-15' },
          actions: [
            { action: 'Escalated to CTO', performedBy: 'risk-manager', performedAt: new Date('2024-12-20') },
          ],
        },
      ],
      controls: [
        {
          id: 'ctrl-001',
          name: 'Data Encryption at Rest',
          description: 'All sensitive data encrypted at rest using AES-256',
          type: 'preventive' as const,
          category: 'security',
          effectiveness: 'high' as const,
          implemented: true,
          implementationDate: new Date('2024-12-18'),
          owner: 'devops-lead',
          cost: 5000,
          frequency: 'continuous' as const,
          lastTested: new Date('2024-12-18'),
          nextTest: new Date('2025-03-18'),
          testResults: [
            {
              id: 'test-001',
              testDate: new Date('2024-12-18'),
              testedBy: 'security-auditor',
              result: 'pass' as const,
              findings: [],
              evidence: ['encryption-verification-001'],
            },
          ],
          relatedRisks: ['risk-001'],
        },
        {
          id: 'ctrl-002',
          name: 'Access Review Process',
          description: 'Quarterly access review for all critical systems',
          type: 'detective' as const,
          category: 'compliance',
          effectiveness: 'medium' as const,
          implemented: true,
          implementationDate: new Date('2024-10-01'),
          owner: 'compliance-officer',
          cost: 25000,
          frequency: 'quarterly' as const,
          lastTested: new Date('2024-10-15'),
          nextTest: new Date('2025-01-15'),
          testResults: [],
          relatedRisks: ['risk-001', 'risk-003'],
        },
        {
          id: 'ctrl-003',
          name: 'Fallback Payment Gateway',
          description: 'Secondary payment provider for failover',
          type: 'compensating' as const,
          category: 'operational',
          effectiveness: 'high' as const,
          implemented: false,
          owner: 'engineering-lead',
          cost: 100000,
          frequency: 'monthly' as const,
          nextTest: new Date('2025-02-28'),
          testResults: [],
          relatedRisks: ['risk-002'],
        },
      ],
      matrices: [
        {
          id: 'matrix-001',
          name: 'Standard Risk Matrix',
          description: '5x5 risk matrix for qualitative risk assessment',
          likelihoods: ['very-high' as const, 'high' as const, 'medium' as const, 'low' as const, 'very-low' as const],
          impacts: ['catastrophic' as const, 'major' as const, 'moderate' as const, 'minor' as const, 'negligible' as const],
          scores: {},
          levels: { 0: 'low' as const, 40: 'medium' as const, 60: 'high' as const, 80: 'critical' as const },
          colors: {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#ca8a04',
            low: '#16a34a',
          },
          enabled: true,
        },
      ],
      reports: [
        {
          id: 'report-001',
          name: 'Q4 2024 Risk Report',
          type: 'executive' as const,
          generatedAt: new Date('2024-12-20'),
          generatedBy: 'risk-manager',
          period: {
            start: new Date('2024-10-01'),
            end: new Date('2024-12-31'),
          },
          summary: {
            totalRisks: 3,
            byLevel: { critical: 1, high: 2, medium: 0, low: 0 },
            byCategory: { security: 1, operational: 1, compliance: 1, financial: 0, reputational: 0, strategic: 0, technology: 0, custom: 0 },
            byStatus: { identified: 0, analyzing: 0, mitigating: 2, mitigated: 0, accepted: 0, transferred: 0, closed: 0, escalated: 0 },
            averageScore: 71,
            mitigated: 0,
            pending: 2,
            overdue: 0,
          },
          topRisks: ['risk-002', 'risk-001', 'risk-003'],
          trends: [
            { riskId: 'risk-001', direction: 'decreasing' as const, change: -15, period: 30 },
            { riskId: 'risk-002', direction: 'increasing' as const, change: 5, period: 30 },
          ],
          recommendations: [
            'Prioritize third-party SLA negotiations',
            'Complete encryption implementation',
            'Enhance access logging controls',
          ],
          charts: [],
          filters: [],
        },
      ],
      thresholds: [
        {
          id: 'thresh-001',
          name: 'Critical Risk Threshold',
          type: 'score' as const,
          metric: 'riskScore',
          condition: '>= 80',
          action: 'require-approval' as const,
          severity: 'critical' as const,
          enabled: true,
        },
        {
          id: 'thresh-002',
          name: 'High Risk Alert Threshold',
          type: 'score' as const,
          metric: 'riskScore',
          condition: '>= 60',
          action: 'alert' as const,
          severity: 'high' as const,
          enabled: true,
        },
      ],
      dependencies: [
        {
          id: 'dep-001',
          sourceRisk: 'risk-002',
          targetRisk: 'risk-003',
          type: 'related-to' as const,
          strength: 'moderate' as const,
          description: 'Both risks relate to financial system dependencies',
        },
      ],
      scenarios: [
        {
          id: 'scenario-001',
          name: 'Payment Gateway Failure',
          description: 'Complete outage of primary payment gateway provider',
          category: 'operational',
          probability: 15,
          impactFactors: [
            { factor: 'Revenue Impact', impact: 'catastrophic' as const, description: 'Complete loss of payment processing' },
            { factor: 'Customer Impact', impact: 'major' as const, description: 'Customers unable to complete purchases' },
          ],
          involvedRisks: ['risk-002'],
          mitigation: 'mit-002',
          lastReviewed: new Date('2024-12-10'),
          nextReview: new Date('2025-03-10'),
        },
        ],
    };

    displayRiskConfig(finalConfig, options.language);

    await writeRiskFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: risk-${providers.join('.tf, risk-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'risk-manager.ts' : 'risk_manager.py'}`));
    console.log(chalk.green('✅ Generated: RISK_ASSESSMENT.md'));
    console.log(chalk.green('✅ Generated: config.example.json\n'));

    console.log(chalk.green('✓ Risk assessment and management configured successfully!'));
  }));

}
