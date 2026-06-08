import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security compliance-reporting` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerComplianceReporting(security: Command): void {
  security
  .command('compliance-reporting')
  .description('Generate SOX, GDPR, HIPAA compliance reporting with evidence collection')
  .argument('<name>', 'Name of the compliance reporting project')
  .option('--auto-generate', 'Enable automatic report generation')
  .option('--frequency <frequency>', 'Report generation frequency (daily, weekly, monthly, quarterly, annual)', 'quarterly')
  .option('--format <format>', 'Report format (pdf, html, json, xml, csv)', 'pdf')
  .option('--include-evidence', 'Include evidence in reports')
  .option('--evidence-retention <days>', 'Evidence retention period in days', '2555')
  .option('--require-approval', 'Require approval for reports')
  .option('--compliance-threshold <percentage>', 'Compliance threshold percentage', '80')
  .option('--frameworks <frameworks>', 'Comma-separated frameworks (SOX, GDPR, HIPAA, PCI-DSS, NIST-800-53, ISO-27001, SOC-2)', 'SOX,GDPR,HIPAA')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './compliance-reporting-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeComplianceReportingFiles, displayComplianceReportingConfig } = await import('../../utils/compliance-reporting.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const frameworks = options.frameworks.split(',').map((f: string) => f.trim()) as ('SOX' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'NIST-800-53' | 'ISO-27001' | 'SOC-2' | 'custom')[];

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoGenerate: options.autoGenerate || true,
        frequency: options.frequency,
        format: options.format,
        includeEvidence: options.includeEvidence || false,
        evidenceRetention: parseInt(options.evidenceRetention),
        requireApproval: options.requireApproval || false,
        approvers: ['compliance-officer', 'ciso', 'legal-counsel'],
        notificationEnabled: true,
        reportDistribution: ['executives', 'audit-committee', 'board'],
        watermarkReports: true,
        archiveReports: true,
        archiveLocation: 's3://compliance-archive',
        complianceThreshold: parseInt(options.complianceThreshold),
        generateGapAnalysis: true,
        includeRecommendations: true,
        signReports: true,
        encryptionEnabled: true,
      },
      frameworks,
      reports: [
        {
          id: 'report-001',
          name: 'Q4 2024 SOX Compliance Report',
          framework: 'SOX' as const,
          reportingPeriod: 'Q4-2024',
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-12-31'),
          generatedAt: new Date(),
          generatedBy: 'compliance-team',
          status: 'approved' as const,
          overallScore: 87,
          complianceStatus: 'partial' as const,
          summary: {
            totalControls: 145,
            compliantControls: 126,
            nonCompliantControls: 8,
            partialControls: 8,
            notApplicableControls: 3,
            totalFindings: 23,
            criticalFindings: 2,
            highFindings: 8,
            mediumFindings: 10,
            lowFindings: 3,
            completionPercentage: 97,
            riskScore: 35,
          },
          controls: [
            {
              controlId: 'SOX-404-001',
              title: 'Access Control Over Financial Reporting',
              description: 'Ensure proper access controls for financial systems',
              status: 'compliant' as const,
              testDate: new Date('2024-12-15'),
              tester: 'internal-audit',
              findings: [],
              evidence: ['ev-001', 'ev-002'],
              riskLevel: 'medium' as const,
              nextReviewDate: new Date('2025-03-15'),
            },
            {
              controlId: 'SOX-302-001',
              title: 'Internal Control Over Financial Reporting',
              description: 'Internal controls for financial reporting processes',
              status: 'non-compliant' as const,
              testDate: new Date('2024-12-10'),
              tester: 'external-auditor',
              findings: ['Missing segregation of duties in AP process'],
              evidence: ['ev-003'],
              riskLevel: 'high' as const,
              nextReviewDate: new Date('2025-01-15'),
            },
          ],
          findings: [
            {
              id: 'find-001',
              control: 'SOX-302-001',
              severity: 'high' as const,
              title: 'Segregation of Duties Issue',
              description: 'AP process lacks proper segregation of duties',
              impact: 'Potential for unauthorized financial transactions',
              recommendation: 'Implement approval workflow and role separation',
              discoveredDate: new Date('2024-12-10'),
              discoveredBy: 'external-auditor',
              status: 'in-progress' as const,
              assignedTo: 'finance-manager',
              dueDate: new Date('2025-01-31'),
              relatedEvidence: ['ev-003'],
            },
          ],
          evidence: [
            {
              id: 'ev-001',
              type: 'configuration' as const,
              title: 'Access Control Configuration',
              description: 'ERP system access control settings screenshot',
              collectedDate: new Date('2024-12-15'),
              collectedBy: 'it-admin',
              status: 'valid' as const,
              fileLocation: 's3://compliance-evidence/ev-001.png',
              hash: 'sha256:abc123...',
              size: 245678,
              format: 'png',
              expiresAt: new Date('2027-12-31'),
              tags: ['SOX', 'access-control', 'Q4-2024'],
            },
          ],
          recommendations: [
            'Implement segregation of duties in AP process by Q1 2025',
            'Con quarterly access reviews for all financial systems',
            'Enhance monitoring of privileged access to financial data',
          ],
          signoffs: [
            {
              role: 'CFO',
              name: 'John Smith',
              email: 'john.smith@example.com',
              signedAt: new Date('2025-01-05'),
              signature: '-----BEGIN SIGNATURE-----...',
              comments: 'Report accurately reflects our compliance position',
            },
          ],
          attachments: [],
          metadata: {
            version: '1.0',
            lastModified: new Date(),
            modifiedBy: 'compliance-admin',
            reviewCycle: '2024-Q4',
            auditTrail: [],
            tags: ['SOX', '2024', 'Q4', 'financial-reporting'],
          },
        },
      ],
      controls: [
        {
          id: 'ctrl-001',
          framework: 'SOX' as const,
          controlId: '404-a1',
          title: 'Access Controls',
          description: 'Access controls over financial reporting systems',
          category: 'IT-General Controls',
          status: 'compliant' as const,
          riskLevel: 'high' as const,
          testingRequired: true,
          testFrequency: 'quarterly' as const,
          lastTested: new Date('2024-12-15'),
          nextTestDue: new Date('2025-03-15'),
          owner: 'it-director',
          tester: 'internal-audit',
          testProcedures: [
            {
              id: 'tp-001',
              name: 'Access Review',
              description: 'Review user access rights',
              steps: [
                { order: 1, action: 'Extract user access list', expectedResult: 'Complete list', screenshot: true },
                { order: 2, action: 'Verify against approvals', expectedResult: 'All access approved', screenshot: true },
              ],
              expectedResults: ['All users have documented approval'],
              tools: ['ERP-Admin-Console'],
              estimatedTime: 120,
            },
          ],
          automatedChecks: [
            {
              id: 'ac-001',
              name: 'Privileged Access Scan',
              type: 'config-scan' as const,
              script: 'scan-privileged-access.sh',
              schedule: '0 2 * * *',
              lastRun: new Date(),
              lastResult: 'pass' as const,
              threshold: '0 violations',
            },
          ],
          manualChecks: [],
          evidenceRequired: [],
          relatedControls: ['ctrl-002'],
          complianceMappings: [
            { framework: 'GDPR' as const, controlId: 'ARTICLE-32', mappingType: 'equivalent' as const, notes: 'Similar access control requirements' },
          ],
        },
      ],
      requirements: [
        {
          id: 'req-001',
          framework: 'GDPR' as const,
          requirementId: 'ARTICLE-15',
          title: 'Right of Access by Data Subject',
          description: 'Data subjects have right to access their personal data',
          category: 'Data Subject Rights',
          obligationType: 'mandatory' as const,
          controls: ['ctrl-gdpr-001'],
          evidenceRequired: ['ev-gdpr-001'],
          dueDate: new Date('2024-05-25'),
          status: 'met' as const,
          assignee: 'dpo',
          risk: 'critical' as const,
          lastAssessed: new Date('2024-05-20'),
          nextAssessment: new Date('2025-05-25'),
        },
        {
          id: 'req-002',
          framework: 'HIPAA' as const,
          requirementId: '164.312-a-2-i',
          title: 'Access Control',
          description: 'Implement technical policies to allow only authorized access',
          category: 'Administrative Safeguards',
          obligationType: 'required' as const,
          controls: ['ctrl-hipaa-001'],
          evidenceRequired: ['ev-hipaa-001'],
          dueDate: new Date('2024-04-14'),
          status: 'partial' as const,
          assignee: 'security-officer',
          risk: 'high' as const,
          lastAssessed: new Date('2024-04-10'),
          nextAssessment: new Date('2025-04-14'),
        },
      ],
      evidence: [
        {
          id: 'ev-001',
          type: 'screenshot' as const,
          title: 'ERP Access Settings',
          description: 'Screenshot of access control configuration',
          framework: 'SOX' as const,
          controlIds: ['ctrl-001'],
          collectedDate: new Date('2024-12-15'),
          collectedBy: 'it-admin',
          status: 'valid' as const,
          fileLocation: 's3://evidence/ev-001.png',
          fileName: 'erp-access.png',
          fileSize: 245678,
          mimeType: 'image/png',
          hash: 'sha256:abc123def456...',
          hashAlgorithm: 'SHA-256' as const,
          expiresAt: new Date('2027-12-31'),
          retentionDate: new Date('2032-12-31'),
          tags: ['SOX', 'access-control', 'Q4-2024'],
          metadata: { system: 'ERP', module: 'security' },
        },
      ],
      assessments: [
        {
          id: 'assess-001',
          name: '2024 SOX Type II Audit',
          framework: 'SOX' as const,
          type: 'external' as const,
          startDate: new Date('2024-08-01'),
          endDate: new Date('2024-12-15'),
          assessor: 'Big 4 Audit Firm',
          assessorOrganization: 'External Auditors LLC',
          status: 'completed' as const,
          scope: {
            includedAssets: ['ERP', 'CRM', 'Financial-DB'],
            excludedAssets: ['Development-Systems'],
            locations: ['US-East', 'US-West', 'EU'],
            departments: ['Finance', 'Accounting', 'IT'],
            processes: ['Financial-Close', 'AP', 'AR', 'Payroll'],
            thirdParties: ['Cloud-Provider', 'Payment-Processor'],
          },
          controls: ['ctrl-001', 'ctrl-002'],
          findings: ['find-001'],
          score: 87,
          reportPath: 's3://audit-reports/2024-sox-type2.pdf',
          nextAssessment: new Date('2025-08-01'),
        },
      ],
      findings: [
        {
          id: 'find-001',
          framework: 'SOX' as const,
          controlId: 'SOX-302-001',
          severity: 'high' as const,
          title: 'Segregation of Duties Gap',
          description: 'Accounts payable process lacks proper segregation - initiator and approver can be same person',
          impact: 'Risk of unauthorized or fraudulent payments',
          rootCause: 'ERP system not configured with proper role separation',
          recommendation: 'Configure role-based approval workflows with conflict detection',
          discoveredDate: new Date('2024-12-10'),
          discoveredBy: 'external-auditor',
          status: 'remediating' as const,
          assignedTo: 'finance-manager',
          dueDate: new Date('2025-01-31'),
          estimatedEffort: 40,
          actualEffort: 20,
          remediationPlan: '1. Define approval roles\\n2. Configure workflow rules\\n3. Test with sample transactions\\n4. Deploy to production',
          verification: 'Independent testing by internal audit',
          relatedFindings: [],
          evidence: ['ev-003'],
        },
      ],
      remediation: [
        {
          id: 'rem-001',
          findingId: 'find-001',
          priority: 1,
          tasks: [
            { id: 'task-001', title: 'Define approval roles', description: 'Document role definitions and conflicts', assignee: 'process-owner', dueDate: new Date('2025-01-15'), status: 'completed' as const, estimatedHours: 8, actualHours: 6, dependencies: [], completedDate: new Date('2025-01-14'), notes: ['Completed with stakeholder review'] },
            { id: 'task-002', title: 'Configure ERP workflow', description: 'Implement approval workflow in ERP system', assignee: 'it-admin', dueDate: new Date('2025-01-25'), status: 'in-progress' as const, estimatedHours: 24, dependencies: ['task-001'], notes: ['Working with ERP vendor'] },
            { id: 'task-003', title: 'Test and validate', description: 'Conduct UAT testing of new workflow', assignee: 'qa-team', dueDate: new Date('2025-01-30'), status: 'not-started' as const, estimatedHours: 8, dependencies: ['task-002'], notes: [] },
          ],
          milestones: [
            { id: 'milestone-001', name: 'Role Definitions Complete', description: 'All roles documented and approved', targetDate: new Date('2025-01-15'), status: 'completed' as const, tasks: ['task-001'] },
            { id: 'milestone-002', name: 'Implementation Complete', description: 'Workflow fully implemented', targetDate: new Date('2025-01-25'), status: 'in-progress' as const, tasks: ['task-002'] },
          ],
          estimatedCompletion: new Date('2025-01-31'),
          status: 'in-progress' as const,
          progress: 60,
          assignedTo: 'remediation-lead',
          budget: 15000,
          blockers: [],
        },
      ],
      notifications: [
        {
          id: 'notif-001',
          type: 'email' as const,
          enabled: true,
          recipients: ['compliance-officer@example.com', 'ciso@example.com'],
          triggers: [
            { event: 'finding-detected' as const, severity: 'critical' as const },
            { event: 'deadline-missed' as const },
            { event: 'remediation-complete' as const },
          ],
          template: 'compliance-alert',
          frequency: 'immediate' as const,
          lastSent: new Date(),
        },
      ],
    };

    displayComplianceReportingConfig(finalConfig);

    await writeComplianceReportingFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: compliance-reporting-${providers.join('.tf, compliance-reporting-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'compliance-reporting-manager.ts' : 'compliance_reporting_manager.py'}`));
    console.log(chalk.green('✅ Generated: COMPLIANCE_REPORTING.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: compliance-reporting-config.json\n'));

    console.log(chalk.green('✓ Compliance reporting and automation configured successfully!'));
  }));

}
