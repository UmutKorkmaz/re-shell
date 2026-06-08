import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security incident-management` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerIncidentManagement(security: Command): void {
  security
  .command('incident-management')
  .description('Generate security incident management and forensics with automated investigation')
  .argument('<name>', 'Name of the incident management project')
  .option('--auto-triage', 'Enable automatic incident triage')
  .option('--auto-containment', 'Enable automatic incident containment')
  .option('--auto-investigation', 'Enable automated investigation')
  .option('--investigation-depth <depth>', 'Investigation depth (basic, standard, comprehensive)', 'standard')
  .option('--evidence-collection <method>', 'Evidence collection method (manual, semi-automated, fully-automated)', 'semi-automated')
  .option('--retention-period <days>', 'Retention period in days', '2555') // 7 years
  .option('--sla-response-p1 <minutes>', 'SLA response time for P1 in minutes', '15')
  .option('--sla-resolution-p1 <minutes>', 'SLA resolution time for P1 in minutes', '240')
  .option('--forensic-imaging', 'Enable forensic imaging')
  .option('--chain-of-custody', 'Enable chain of custody tracking')
  .option('--legal-hold', 'Enable legal hold process')
  .option('--postmortem-required', 'Require postmortem for all incidents')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './incident-management-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeIncidentManagementFiles, displayIncidentManagementConfig } = await import('../../utils/incident-management.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoTriage: options.autoTriage || true,
        autoContainment: options.autoContainment || false,
        autoInvestigation: options.autoInvestigation || true,
        investigationDepth: options.investigationDepth,
        evidenceCollection: options.evidenceCollection,
        retentionPeriod: parseInt(options.retentionPeriod),
        slaResponseTime: {
          p1: parseInt(options.slaResponseP1),
          p2: 60,
          p3: 240,
          p4: 1440,
          p5: 4320,
        },
        slaResolutionTime: {
          p1: parseInt(options.slaResolutionP1),
          p2: 1440,
          p3: 4320,
          p4: 10080,
          p5: 20160,
        },
        notificationChannels: ['email', 'slack', 'pagerduty'],
        escalationRules: [
          {
            id: 'escalation-001',
            name: 'P1 Critical Escalation',
            conditions: [
              {
                field: 'severity' as const,
                operator: 'equals' as const,
                value: 'critical',
              },
            ],
            actions: [
              {
                type: 'notify' as const,
                target: 'ciso@example.com',
              },
              {
                type: 'escalate' as const,
                target: 'executive-team',
              },
            ],
            escalateTo: ['ciso@example.com', 'cto@example.com'],
            notifyChannels: ['pagerduty', 'slack'],
          },
        ],
        approvalRequired: true,
        approvers: ['security-manager', 'ciso'],
        forensicImaging: options.forensicImaging || true,
        chainOfCustody: options.chainOfCustody || true,
        legalHold: options.legalHold || true,
        reportGeneration: true,
        postmortemRequired: options.postmortemRequired || true,
        postmortemTemplate: 'postmortem-template.md',
      },
      incidents: [
        {
          id: 'incident-001',
          title: 'Ransomware Attack on Finance Server',
          description: 'Detected ransomware infection on primary finance database server with data exfiltration attempts',
          type: 'ransomware' as const,
          severity: 'critical' as const,
          status: 'containing' as const,
          phase: 'containment' as const,
          priority: 'p1' as const,
          confidence: 0.94,
          detectedAt: new Date(Date.now() - 45 * 60 * 1000),
          reportedBy: 'security-monitoring@company.com',
          assignedTo: 'alice@soc.com',
          team: ['SOC Team', 'IT Ops', 'Legal'],
          watchers: ['ciso@company.com', 'cto@company.com'],
          affectedAssets: [
            {
              id: 'asset-001',
              name: 'FINANCE-DB-01',
              type: 'database' as const,
              impact: 'critical' as const,
              compromiseLevel: 'confirmed' as const,
              isolationStatus: 'isolated' as const,
              forensicImage: true,
              evidenceCollected: 5,
            },
            {
              id: 'asset-002',
              name: 'FINANCE-APP-01',
              type: 'server' as const,
              impact: 'high' as const,
              compromiseLevel: 'suspected' as const,
              isolationStatus: 'partial' as const,
              forensicImage: false,
              evidenceCollected: 2,
            },
          ],
          indicators: [
            {
              id: 'indicator-001',
              type: 'hash' as const,
              value: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
              description: 'Ryuk ransomware payload',
              confidence: 0.97,
              firstSeen: new Date(Date.now() - 45 * 60 * 1000),
              lastSeen: new Date(Date.now() - 10 * 60 * 1000),
              source: 'EDR',
              iocType: "file-hash" as const,
            },
            {
              id: 'indicator-002',
              type: 'ip' as const,
              value: '185.141.63.82',
              description: 'Known C2 server for Ryuk',
              confidence: 0.92,
              firstSeen: new Date(Date.now() - 45 * 60 * 1000),
              lastSeen: new Date(Date.now() - 10 * 60 * 1000),
              source: 'Threat Intel',
              iocType: "ip-address" as const,
            },
          ],
          timeline: [
            {
              id: 'timeline-001',
              timestamp: new Date(Date.now() - 45 * 60 * 1000),
              phase: 'identification' as const,
              action: 'Alert triggered by EDR',
              actor: 'EDR System',
              description: 'Ransomware behavior detected on FINANCE-DB-01',
              evidence: ['edr-alert-001.json'],
              automated: true,
            },
            {
              id: 'timeline-002',
              timestamp: new Date(Date.now() - 40 * 60 * 1000),
              phase: 'triage' as const,
              action: 'Incident created and assigned',
              actor: 'SOC Team',
              description: 'Incident escalated to P1 critical',
              evidence: ['incident-ticket-001'],
              automated: false,
            },
            {
              id: 'timeline-003',
              timestamp: new Date(Date.now() - 30 * 60 * 1000),
              phase: 'containment' as const,
              action: 'Assets isolated',
              actor: 'IT Ops',
              description: 'FINANCE-DB-01 isolated from network',
              evidence: ['isolation-log-001'],
              automated: true,
            },
          ],
          containmentStrategy: 'Network isolation of affected systems, blocking C2 communication, suspending compromised accounts',
          eradicationPlan: 'Wipe and rebuild affected systems, restore from clean backups, patch vulnerabilities',
          recoverySteps: [
            'Verify isolation complete',
            'Collect forensic images',
            'Wipe affected systems',
            'Restore from backups',
            'Verify system integrity',
            'Monitor for recurrence',
          ],
          rootCause: 'Phishing email with malicious attachment opened by finance team member',
          lessonsLearned: [],
          tags: ['ransomware', 'finance', 'critical', 'ryuk'],
          sla: {
            responseDeadline: new Date(Date.now() - 45 * 60 * 1000 + 15 * 60 * 1000),
            resolutionDeadline: new Date(Date.now() - 45 * 60 * 1000 + 240 * 60 * 1000),
            responseMet: true,
            resolutionMet: false,
          },
          metadata: {
            ransomwareFamily: 'Ryuk',
            initialAccess: 'Phishing',
            dataExfiltrationAttempted: true,
            dataEncrypted: true,
            ransomDemand: '50 BTC',
          },
        },
      ],
      playbooks: [
        {
          id: 'playbook-001',
          name: 'Ransomware Response Playbook',
          description: 'Standard operating procedure for responding to ransomware incidents',
          incidentTypes: ['ransomware' as const],
          severity: ['critical' as const, 'high' as const],
          status: 'active' as const,
          version: '2.1.0',
          author: 'SOC Team',
          approvedBy: 'CISO',
          lastUpdated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          autoExecute: false,
          approvalRequired: true,
          phases: [
            {
              id: 'phase-001',
              name: 'Identification and Triage',
              order: 1,
              description: 'Initial detection and classification of ransomware incident',
              duration: 15,
              steps: [
                {
                  id: 'step-001',
                  order: 1,
                  name: 'Verify ransomware detection',
                  description: 'Confirm ransomware activity through multiple sources',
                  action: 'verify-detection',
                  automated: true,
                  parameters: {
                    sources: ['EDR', 'SIEM', 'Firewall'],
                  },
                  timeout: 300,
                  onSuccess: 'Proceed to isolation',
                  onFailure: 'Escalate to human analyst',
                  dependencies: [],
                },
              ],
              dependencies: [],
            },
            {
              id: 'phase-002',
              name: 'Containment',
              order: 2,
              description: 'Isolate affected systems to prevent spread',
              duration: 30,
              steps: [
                {
                  id: 'step-002',
                  order: 1,
                  name: 'Isolate affected systems',
                  description: 'Network isolation of compromised assets',
                  action: 'isolate-systems',
                  automated: true,
                  script: 'scripts/isolate-hosts.sh',
                  parameters: {
                    targets: ['FINANCE-DB-01', 'FINANCE-APP-01'],
                  },
                  timeout: 600,
                  onSuccess: 'Proceed to forensic collection',
                  onFailure: 'Manual isolation required',
                  dependencies: [],
                },
              ],
              dependencies: ['phase-001'],
            },
            {
              id: 'phase-003',
              name: 'Investigation and Forensics',
              order: 3,
              description: 'Collect evidence and investigate root cause',
              duration: 240,
              steps: [],
              dependencies: ['phase-002'],
            },
          ],
          estimatedDuration: 285,
          successRate: 0.92,
          executions: 24,
          lastExecuted: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          variables: [
            {
              name: 'isolation_method',
              type: 'string' as const,
              description: 'Method to use for system isolation',
              required: true,
              options: ['network', 'firewall', 'agent'],
            },
            {
              name: 'backup_source',
              type: 'string' as const,
              description: 'Backup location to restore from',
              required: true,
            },
          ],
        },
      ],
      investigations: [
        {
          id: 'investigation-001',
          incidentId: 'incident-001',
          title: 'Ransomware Attack Investigation',
          status: 'in-progress' as const,
          priority: 'p1' as const,
          assignedTo: 'alice@soc.com',
          team: ['SOC Team', 'Digital Forensics Team'],
          startedAt: new Date(Date.now() - 40 * 60 * 1000),
          estimatedDuration: 8,
          progress: 35,
          tasks: [
            {
              id: 'task-001',
              name: 'Collect memory dumps',
              description: 'Capture volatile memory from affected systems',
              status: 'completed' as const,
              assignedTo: 'forensics-team@company.com',
              estimatedDuration: 60,
              actualDuration: 55,
              dependencies: [],
              automated: true,
              script: 'scripts/collect-memory-dump.sh',
              artifacts: ['memory-dump-finance-db-01.mem'],
              findings: ['finding-001'],
            },
            {
              id: 'task-002',
              name: 'Analyze malware payload',
              description: 'Reverse engineer ransomware binary',
              status: 'in-progress' as const,
              assignedTo: 'malware-analyst@company.com',
              estimatedDuration: 240,
              dependencies: [],
              automated: false,
              artifacts: [],
              findings: [],
            },
            {
              id: 'task-003',
              name: 'Identify patient zero',
              description: 'Determine initial infection vector',
              status: 'pending' as const,
              assignedTo: 'soc-analyst@company.com',
              estimatedDuration: 120,
              dependencies: ['task-001', 'task-002'],
              automated: false,
              artifacts: [],
              findings: [],
            },
          ],
          findings: [
            {
              id: 'finding-001',
              category: 'Initial Access',
              severity: 'high' as const,
              confidence: 0.88,
              description: 'Phishing email with malicious Excel macro enabled initial compromise',
              evidence: ['email-headers.eml', 'macro-analysis.pdf'],
              discoveredAt: new Date(Date.now() - 25 * 60 * 1000),
              discoveredBy: 'soc-analyst@company.com',
              verified: true,
            },
          ],
          hypotheses: [
            {
              id: 'hypothesis-001',
              description: 'Attack originated from spear phishing campaign targeting finance department',
              confidence: 0.85,
              status: 'investigating' as const,
              evidence: ['email-001', 'user-access-log'],
              testedBy: 'soc-team',
              testedAt: new Date(Date.now() - 20 * 60 * 1000),
            },
          ],
          conclusions: [],
          recommendations: [
            'Implement email filtering improvements',
            'Conduct security awareness training for finance team',
            'Review and update backup procedures',
          ],
          tools: [
            {
              name: 'Volatility',
              version: '3.0',
              purpose: 'Memory forensics',
              command: 'vol -f memory-dump.mem windows.pslist',
              parameters: {},
              output: 'process-list.txt',
              executedAt: new Date(Date.now() - 35 * 60 * 1000),
              executedBy: 'forensics-team',
            },
          ],
        },
      ],
      artifacts: [
        {
          id: 'artifact-001',
          incidentId: 'incident-001',
          investigationId: 'investigation-001',
          type: 'memory-dump' as const,
          name: 'FINANCE-DB-01 Memory Dump',
          description: 'Full memory capture of affected database server',
          path: '/evidence/finance-db-01/memory-dump.mem',
          hash: 'sha256:abc123def456...',
          size: 17179869184, // 16GB
          collectedAt: new Date(Date.now() - 35 * 60 * 1000),
          collectedBy: 'forensics-team@company.com',
          chainOfCustody: [
            {
              timestamp: new Date(Date.now() - 35 * 60 * 1000),
              action: 'collected' as const,
              actor: 'forensics-team@company.com',
              location: 'FINANCE-DB-01',
              purpose: 'Evidence collection',
              signature: 'digital-signature-001',
            },
          ],
          integrityVerified: true,
          preservationMethod: 'Write-once storage with SHA-256 hashing',
          location: '/secure-storage/evidence/2024-01/incident-001/',
          accessLog: [
            {
              timestamp: new Date(Date.now() - 35 * 60 * 1000),
              user: 'forensics-team@company.com',
              action: 'created',
              reason: 'Initial evidence collection',
              authorized: true,
            },
          ],
        },
      ],
      evidence: [
        {
          id: 'evidence-001',
          incidentId: 'incident-001',
          investigationId: 'investigation-001',
          type: 'digital' as const,
          category: 'Malware Sample',
          description: 'Ransomware executable recovered from affected system',
          source: 'FINANCE-DB-01',
          collectedAt: new Date(Date.now() - 30 * 60 * 1000),
          collectedBy: 'forensics-team@company.com',
          hash: 'sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
          size: 2048576,
          location: '/secure-storage/evidence/2024-01/incident-001/malware-sample.exe',
          chainOfCustody: [
            {
              timestamp: new Date(Date.now() - 30 * 60 * 1000),
              action: 'collected' as const,
              actor: 'forensics-team@company.com',
              location: 'FINANCE-DB-01',
              purpose: 'Malware analysis',
            },
          ],
          admissible: true,
          authenticated: true,
          reliability: 0.98,
          relatedEvidence: [],
          tags: ['malware', 'ransomware', 'ryuk'],
        },
      ],
      communications: [
        {
          id: 'comm-001',
          incidentId: 'incident-001',
          type: 'escalation' as const,
          channel: 'email',
          audience: ['ciso@company.com', 'cto@company.com', 'ceo@company.com'],
          subject: 'CRITICAL: Ransomware Incident - Finance Department',
          message: 'A critical ransomware incident has been detected affecting the finance database server. Immediate containment actions are underway.',
          sentAt: new Date(Date.now() - 40 * 60 * 1000),
          sentBy: 'soc-team@company.com',
          status: 'sent' as const,
          attachments: ['incident-summary.pdf'],
          readReceipt: true,
          responses: [
            {
              user: 'ciso@company.com',
              response: 'Acknowledged. Mobilizing incident response team.',
              timestamp: new Date(Date.now() - 38 * 60 * 1000),
            },
          ],
        },
      ],
      analytics: [
        {
          id: 'analytics-001',
          period: '2024-01',
          totalIncidents: 45,
          byType: {
            malware: 12,
            phishing: 15,
            'data-breach': 5,
            ddos: 3,
            'insider-threat': 2,
            ransomware: 3,
            'social-engineering': 3,
            'zero-day': 1,
            misconfiguration: 1,
            custom: 0,
          },
          bySeverity: {
            critical: 8,
            high: 15,
            medium: 18,
            low: 4,
          },
          byStatus: {
            open: 5,
            investigating: 10,
            containing: 8,
            eradication: 7,
            recovery: 10,
            closed: 5,
            'false-positive': 0,
          },
          meanTimeToDetect: 12.5,
          meanTimeToContain: 35.8,
          meanTimeToEradicate: 180.5,
          meanTimeToRecover: 420.2,
          meanTimeToResolution: 650.0,
          slaCompliance: 87.5,
          mttd: 12.5,
          mttr: 650.0,
          topIncidentTypes: [
            { type: 'phishing' as const, count: 15, avgDuration: 120, avgCost: 5000 },
            { type: 'malware' as const, count: 12, avgDuration: 480, avgCost: 25000 },
            { type: 'data-breach' as const, count: 5, avgDuration: 1440, avgCost: 150000 },
          ],
          trends: [],
          rootCauses: [
            { cause: 'Phishing', count: 18, percentage: 40.0 },
            { cause: 'Unpatched Systems', count: 12, percentage: 26.7 },
            { cause: 'Misconfiguration', count: 8, percentage: 17.8 },
            { cause: 'Weak Authentication', count: 7, percentage: 15.5 },
          ],
          teamPerformance: [
            {
              team: 'SOC Team',
              incidents: 30,
              resolved: 25,
              avgResolutionTime: 480,
              slaCompliance: 92.0,
              satisfaction: 8.5,
            },
            {
              team: 'Incident Response Team',
              incidents: 15,
              resolved: 13,
              avgResolutionTime: 720,
              slaCompliance: 85.0,
              satisfaction: 8.2,
            },
          ],
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'Splunk SIEM',
          type: 'siem' as const,
          provider: 'Splunk',
          enabled: true,
          config: {
            endpoint: 'https://splunk.example.com:8089',
            apiKey: '********',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 5 * 60 * 1000),
          incidentsImported: 450,
          alertsGenerated: 1250,
        },
        {
          id: 'integration-002',
          name: 'ServiceNow Ticketing',
          type: 'ticketing' as const,
          provider: 'ServiceNow',
          enabled: true,
          config: {
            instance: 'company.service-now.com',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 2 * 60 * 1000),
          incidentsImported: 320,
          alertsGenerated: 850,
        },
        {
          id: 'integration-003',
          name: 'Slack Communication',
          type: 'communication' as const,
          provider: 'Slack',
          enabled: true,
          config: {
            webhookUrl: 'https://hooks.slack.com/services/********',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 1 * 60 * 1000),
          incidentsImported: 0,
          alertsGenerated: 1800,
        },
      ],
    };

    displayIncidentManagementConfig(finalConfig);

    await writeIncidentManagementFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: incident-management-${providers.join('.tf, incident-management-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'incident-management-manager.ts' : 'incident_management_manager.py'}`));
    console.log(chalk.green('✅ Generated: INCIDENT_MANAGEMENT.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: incident-management-config.json\n'));

    console.log(chalk.green('✓ Security incident management and forensics configured successfully!'));
  }));

}
