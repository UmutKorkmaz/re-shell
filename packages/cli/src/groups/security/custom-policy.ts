import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security custom-policy` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerCustomPolicy(security: Command): void {
  security
  .command('custom-policy')
  .description('Generate custom security policies with automated enforcement and exception handling')
  .argument('<name>', 'Name of the custom policy project')
  .option('--auto-enforce', 'Enable automatic policy enforcement')
  .option('--enforcement-level <level>', 'Default enforcement level (advisory, warning, blocking, critical)', 'advisory')
  .option('--allow-exceptions', 'Allow policy exceptions')
  .option('--require-approval', 'Require approval for exceptions')
  .option('--exception-duration <days>', 'Exception duration in days', '30')
  .option('--auto-expire', 'Auto-expire exceptions')
  .option('--audit-all', 'Audit all policy actions')
  .option('--dry-run', 'Enable dry-run mode')
  .option('--categories <categories>', 'Comma-separated policy categories', 'identity,access-control,data-protection')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './custom-policy-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeCustomPolicyFiles, displayCustomPolicyConfig } = await import('../../utils/custom-policy.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');


    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoEnforce: options.autoEnforce || false,
        defaultEnforcementLevel: options.enforcementLevel,
        allowExceptions: options.allowExceptions || true,
        requireExceptionApproval: options.requireApproval || true,
        exceptionApprovers: ['security-team', 'compliance-officer', 'policy-admin'],
        exceptionDuration: parseInt(options.exceptionDuration),
        autoExpireExceptions: options.autoExpire || true,
        auditAllActions: options.auditAll || true,
        logLevel: 'info' as const,
        notificationChannels: ['security-team', 'policy-admins'],
        defaultRemediation: 'notify' as const,
        dryRun: options.dryRun || false,
        bypassConditions: [],
        policyVersioning: true,
        reviewFrequency: 90,
      },
      policies: [
        {
          id: 'policy-001',
          name: 'MFA Required for Admin Access',
          description: 'Enforces multi-factor authentication for all administrative access',
          category: 'identity' as const,
          version: '1.0.0',
          status: 'active' as const,
          scope: 'organization' as const,
          scopeValues: ['all'],
          priority: 90,
          enforcementLevel: 'critical' as const,
          owner: 'ciso',
          createdBy: 'security-admin',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          lastReviewed: new Date(),
          rules: ['rule-001', 'rule-002'],
          conditions: ['condition-001'],
          exceptions: [],
          metadata: {
            riskScore: 95,
            complianceReferences: ['NIST-800-53 IA-2', 'SOC-2', 'ISO-27001'],
            relatedPolicies: [],
            changeHistory: [
              { timestamp: new Date('2024-01-01'), user: 'security-admin', action: 'created' as const, reason: 'Initial policy creation' },
            ],
            documentation: 'All users with administrative privileges must use MFA when accessing critical systems',
            rationale: 'MFA is a fundamental security control to prevent unauthorized access due to credential theft',
          },
          tags: ['mfa', 'identity', 'admin', 'critical'],
        },
        {
          id: 'policy-002',
          name: 'Data Encryption at Rest',
          description: 'Requires all sensitive data to be encrypted at rest',
          category: 'data-protection' as const,
          version: '1.2.0',
          status: 'active' as const,
          scope: 'organization' as const,
          scopeValues: ['databases', 'storage', 'backups'],
          priority: 85,
          enforcementLevel: 'blocking' as const,
          owner: 'data-protection-officer',
          createdBy: 'security-architect',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date(),
          lastReviewed: new Date(),
          rules: ['rule-003'],
          conditions: ['condition-002'],
          exceptions: ['exception-001'],
          metadata: {
            riskScore: 90,
            complianceReferences: ['GDPR Article 32', 'HIPAA 164.312(a)(2)(iv)', 'NIST-800-53 SC-12'],
            relatedPolicies: ['policy-001'],
            changeHistory: [
              { timestamp: new Date('2024-01-15'), user: 'security-architect', action: 'created' as const, reason: 'Data protection requirement' },
              { timestamp: new Date('2024-03-01'), user: 'security-admin', action: 'updated' as const, reason: 'Added additional cloud storage scope' },
            ],
            documentation: 'All sensitive data must be encrypted using AES-256 or stronger algorithm',
            rationale: 'Encryption protects data at rest from unauthorized access in case of physical theft or storage compromise',
          },
          tags: ['encryption', 'data-protection', 'privacy', 'gdpr', 'hipaa'],
        },
        {
          id: 'policy-003',
          name: 'Network Segmentation',
          description: 'Enforces network segmentation between security zones',
          category: 'network-security' as const,
          version: '2.0.0',
          status: 'active' as const,
          scope: 'global' as const,
          scopeValues: ['all-networks'],
          priority: 75,
          enforcementLevel: 'warning' as const,
          owner: 'network-architect',
          createdBy: 'security-engineer',
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date(),
          lastReviewed: new Date(),
          rules: ['rule-004'],
          conditions: ['condition-003'],
          exceptions: ['exception-002'],
          metadata: {
            riskScore: 70,
            complianceReferences: ['NIST-800-53 SC-7', 'PCI-DSS 1.2.1'],
            relatedPolicies: ['policy-001', 'policy-002'],
            changeHistory: [
              { timestamp: new Date('2024-02-01'), user: 'security-engineer', action: 'created' as const, reason: 'Network security requirement' },
              { timestamp: new Date('2024-06-01'), user: 'network-architect', action: 'updated' as const, reason: 'Added microsegmentation support' },
            ],
            documentation: 'Network must be segmented into security zones with controlled traffic flows between zones',
            rationale: 'Network segmentation limits the blast radius of security incidents and prevents lateral movement',
          },
          tags: ['network', 'segmentation', 'zones', 'firewall'],
        },
      ],
      rules: [
        {
          id: 'rule-001',
          policyId: 'policy-001',
          name: 'MFA Check for Admin Login',
          description: 'Validates MFA status for admin login attempts',
          type: 'require' as const,
          enabled: true,
          priority: 1,
          conditions: [
            { id: 'cond-001', field: 'user.role', operator: 'equals' as const, value: 'admin' },
            { id: 'cond-002', field: 'authentication.mfa', operator: 'not-equals' as const, value: true },
          ],
          actions: [
            { type: 'block', config: { message: 'MFA required for admin access' }, order: 1 },
            { type: 'alert', config: { channels: ['security-team'] }, order: 2 },
          ],
          triggers: ['on-access' as const],
          remediation: ['block' as const, 'notify' as const],
          parameters: [],
        },
        {
          id: 'rule-002',
          policyId: 'policy-001',
          name: 'MFA Enforcement for Sudo',
          description: 'Requires MFA for sudo command execution',
          type: 'require' as const,
          enabled: true,
          priority: 1,
          conditions: [
            { id: 'cond-003', field: 'command', operator: 'equals' as const, value: 'sudo' },
            { id: 'cond-004', field: 'session.mfa_verified', operator: 'not-equals' as const, value: true },
          ],
          actions: [
            { type: 'block', config: { message: 'MFA required for sudo access' }, order: 1 },
            { type: 'log', config: { level: 'warn' }, order: 2 },
          ],
          triggers: ['on-access' as const],
          remediation: ['block' as const],
          parameters: [],
        },
        {
          id: 'rule-003',
          policyId: 'policy-002',
          name: 'Encryption Verification',
          description: 'Verifies encryption status for sensitive data',
          type: 'encrypt' as const,
          enabled: true,
          priority: 1,
          conditions: [
            { id: 'cond-005', field: 'data.sensitivity', operator: 'equals' as const, value: 'confidential' },
            { id: 'cond-006', field: 'data.encrypted', operator: 'not-equals' as const, value: true },
          ],
          actions: [
            { type: 'auto-fix', config: { action: 'enable-encryption' }, order: 1 },
            { type: 'alert', config: { channels: ['data-protection-officer'] }, order: 2 },
          ],
          triggers: ['on-create' as const, 'on-update' as const],
          remediation: ['auto-fix' as const, 'notify' as const],
          parameters: [],
        },
        {
          id: 'rule-004',
          policyId: 'policy-003',
          name: 'Cross-Zone Traffic Check',
          description: 'Monitors and validates cross-zone network traffic',
          type: 'warn' as const,
          enabled: true,
          priority: 2,
          conditions: [
            { id: 'cond-007', field: 'network.source_zone', operator: 'not-equals' as const, value: 'network.destination_zone' },
            { id: 'cond-008', field: 'network.firewall_rule', operator: 'not-equals' as const, value: 'allow' },
          ],
          actions: [
            { type: 'alert', config: { channels: ['security-team', 'network-team'] }, order: 1 },
            { type: 'log', config: { level: 'warn' }, order: 2 },
          ],
          triggers: ['on-access' as const],
          remediation: ['notify' as const, 'quarantine' as const],
          parameters: [],
        },
      ],
      conditions: [
        {
          id: 'condition-001',
          name: 'Admin Access Condition',
          description: 'Matches administrative access attempts',
          type: 'and' as const,
          conditions: [
            { id: 'cond-c-001', field: 'resource.type', operator: 'equals' as const, value: 'system' },
            { id: 'cond-c-002', field: 'access.level', operator: 'greater-than' as const, value: 3 },
          ],
          enabled: true,
        },
        {
          id: 'condition-002',
          name: 'Sensitive Data Condition',
          description: 'Matches sensitive data operations',
          type: 'and' as const,
          conditions: [
            { id: 'cond-c-003', field: 'data.classification', operator: 'in' as const, value: ['confidential', 'restricted', 'secret'] },
          ],
          enabled: true,
        },
        {
          id: 'condition-003',
          name: 'Cross-Zone Traffic Condition',
          description: 'Matches cross-zone network traffic',
          type: 'and' as const,
          conditions: [
            { id: 'cond-c-004', field: 'network.source_zone', operator: 'not-equals' as const, value: 'network.destination_zone' },
          ],
          enabled: true,
        },
      ],
      exceptions: [
        {
          id: 'exception-001',
          policyId: 'policy-002',
          name: 'Legacy System Exception',
          description: 'Exception for legacy systems that cannot support encryption',
          status: 'approved' as const,
          requestedBy: 'it-director',
          approvedBy: 'ciso',
          requestedAt: new Date('2024-06-01'),
          approvedAt: new Date('2024-06-05'),
          expiresAt: new Date('2025-06-01'),
          reason: 'Legacy mainframe system cannot support encryption due to technical limitations',
          justification: 'System is scheduled for retirement in Q2 2025. Risk accepted with compensating controls.',
          conditions: [
            { id: 'exc-cond-001', field: 'resource.name', operator: 'equals' as const, value: 'legacy-mainframe-01' },
            { id: 'exc-cond-002', field: 'resource.type', operator: 'equals' as const, value: 'mainframe' },
          ],
          scope: {
            resources: ['legacy-mainframe-01'],
            users: [],
            groups: [],
            timeWindows: [],
            locations: ['datacenter-legacy'],
          },
          riskScore: 60,
          mitigation: 'Network isolation, dedicated access, enhanced monitoring, scheduled retirement',
          reviewRequired: true,
          nextReviewDate: new Date('2024-12-01'),
          comments: [
            { id: 'comment-001', author: 'ciso', comment: 'Approved with condition that system is retired by Q2 2025', timestamp: new Date('2024-06-05'), type: 'approval' as const },
          ],
          auditTrail: [
            { timestamp: new Date('2024-06-01'), user: 'it-director', action: 'requested', details: 'Exception requested for legacy mainframe' },
            { timestamp: new Date('2024-06-05'), user: 'ciso', action: 'approved', details: 'Approved with 1-year duration and retirement condition' },
          ],
        },
        {
          id: 'exception-002',
          policyId: 'policy-003',
          name: 'Emergency Access Exception',
          description: 'Emergency cross-zone access for incident response',
          status: 'approved' as const,
          requestedBy: 'incident-responder',
          approvedBy: 'security-lead',
          requestedAt: new Date('2024-08-15'),
          approvedAt: new Date('2024-08-15'),
          expiresAt: new Date('2024-08-16'),
          reason: 'Required emergency access during security incident investigation',
          justification: 'Immediate access needed to contain and investigate active security incident',
          conditions: [
            { id: 'exc-cond-003', field: 'incident.active', operator: 'equals' as const, value: true },
            { id: 'exc-cond-004', field: 'user.role', operator: 'in' as const, value: ['incident-responder', 'security-lead'] },
          ],
          scope: {
            resources: ['all'],
            users: ['incident-responder-01', 'security-lead'],
            groups: ['incident-response-team'],
            timeWindows: [
              { start: new Date('2024-08-15T10:00:00Z'), end: new Date('2024-08-16T10:00:00Z'), timezone: 'UTC' },
            ],
            locations: [],
          },
          riskScore: 25,
          mitigation: 'Time-limited exception, audit logging, supervisor approval required',
          reviewRequired: true,
          nextReviewDate: new Date('2024-08-16'),
          comments: [
            { id: 'comment-002', author: 'security-lead', comment: 'Emergency exception approved for incident response', timestamp: new Date('2024-08-15'), type: 'approval' as const },
          ],
          auditTrail: [
            { timestamp: new Date('2024-08-15'), user: 'incident-responder', action: 'requested', details: 'Emergency access requested for incident IR-2024-0815' },
          ],
        },
      ],
      enforcement: [
        {
          id: 'enforce-001',
          policyId: 'policy-001',
          ruleId: 'rule-001',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          triggeredBy: 'system',
          triggerType: 'on-access' as const,
          target: {
            type: 'user' as const,
            id: 'user-123',
            name: 'admin-user',
            location: ' headquarters',
            metadata: { role: 'admin', department: 'IT' },
          },
          conditions: [
            { conditionId: 'cond-001', result: true, evaluatedValue: 'admin', expectedValue: 'admin', matched: true },
            { conditionId: 'cond-002', result: true, evaluatedValue: false, expectedValue: true, matched: true },
          ],
          actionsTaken: [
            { action: 'block' as const, status: 'success' as const, message: 'Access blocked due to missing MFA', duration: 15 },
            { action: 'notify' as const, status: 'success' as const, message: 'Security team notified', duration: 5 },
          ],
          result: {
            status: 'blocked' as const,
            message: 'Admin access blocked - MFA not enabled',
            modifiedResources: [],
            errors: [],
            warnings: [],
          },
          duration: 20,
        },
        {
          id: 'enforce-002',
          policyId: 'policy-003',
          ruleId: 'rule-004',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
          triggeredBy: 'network-monitor',
          triggerType: 'on-access' as const,
          target: {
            type: 'network' as const,
            id: 'net-flow-12345',
            name: 'Cross-zone flow from DMZ to Internal',
            metadata: { source_zone: 'dmz', dest_zone: 'internal', protocol: 'TCP' },
          },
          conditions: [
            { conditionId: 'cond-007', result: true, evaluatedValue: 'dmz', expectedValue: 'internal', matched: true },
            { conditionId: 'cond-008', result: true, evaluatedValue: null, expectedValue: 'allow', matched: true },
          ],
          actionsTaken: [
            { action: 'notify' as const, status: 'success' as const, message: 'Cross-zone traffic detected without firewall rule', duration: 3 },
            { action: 'tag' as const, status: 'success' as const, message: 'Logged for security review', duration: 1 },
          ],
          result: {
            status: 'warning' as const,
            message: 'Cross-zone traffic flagged for review',
            modifiedResources: [],
            errors: [],
            warnings: ['Traffic may require explicit firewall rule approval'],
          },
          duration: 4,
        },
      ],
      templates: [
        {
          id: 'template-001',
          name: 'MFA Policy Template',
          description: 'Template for creating MFA enforcement policies',
          category: 'identity' as const,
          template: {
            name: 'MFA Required',
            description: 'Multi-factor authentication requirement',
            category: 'identity' as const,
            status: 'draft' as const,
            scope: 'organization' as const,
            scopeValues: [],
            priority: 90,
            enforcementLevel: 'critical' as const,
            owner: '',
            createdBy: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastReviewed: new Date(),
            rules: [],
            conditions: [],
            exceptions: [],
            metadata: {
              riskScore: 90,
              complianceReferences: [],
              relatedPolicies: [],
              changeHistory: [],
              documentation: '',
              rationale: '',
            },
            tags: [],
          },
          parameters: [
            { name: 'targetRoles', type: 'array' as const, description: 'Roles that require MFA', defaultValue: ['admin', 'privileged'], required: true },
            { name: 'gracePeriod', type: 'number' as const, description: 'Grace period in days', defaultValue: 0, required: false },
          ],
          requiredPermissions: ['policy-admin', 'security-admin'],
          compatibleWith: ['aws', 'azure', 'gcp'],
          tags: ['mfa', 'template', 'identity'],
        },
      ],
    };

    displayCustomPolicyConfig(finalConfig);

    await writeCustomPolicyFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: custom-policy-${providers.join('.tf, custom-policy-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'custom-policy-manager.ts' : 'custom_policy_manager.py'}`));
    console.log(chalk.green('✅ Generated: CUSTOM_POLICY.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: custom-policy-config.json\n'));

    console.log(chalk.green('✓ Custom security policies and enforcement configured successfully!'));
  }));

}
