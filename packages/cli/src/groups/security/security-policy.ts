import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security security-policy` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerSecurityPolicy(security: Command): void {
  security
  .command('security-policy')
  .description('Generate security policy as code with automated enforcement and auditing')
  .argument('<name>', 'Name of the security policy project')
  .option('--auto-enforce', 'Enable automatic policy enforcement')
  .option('--enforcement-mode <mode>', 'Enforcement mode (audit-only, warn, block, auto-remediate)', 'audit-only')
  .option('--scan-interval <minutes>', 'Policy scan interval in minutes', '60')
  .option('--auto-remediation', 'Enable automatic remediation')
  .option('--require-approval', 'Require approval for enforcement actions')
  .option('--notification-channels <channels>', 'Comma-separated notification channels', 'email,slack')
  .option('--frameworks <frameworks>', 'Comma-separated compliance frameworks', 'NIST-800-53,ISO-27001')
  .option('--audit-retention <days>', 'Audit log retention period in days', '365')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './security-policy-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeSecurityPolicyFiles, displaySecurityPolicyConfig } = await import('../../utils/security-policy.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const notificationChannels = options.notificationChannels.split(',').map((c: string) => c.trim());

    const frameworks = options.frameworks.split(',').map((f: string) => f.trim()) as ('NIST-800-53' | 'ISO-27001' | 'SOC-2' | 'PCI-DSS' | 'HIPAA' | 'GDPR' | 'CIS' | 'custom')[];

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoEnforce: options.autoEnforce || false,
        enforcementMode: options.enforcementMode,
        scanInterval: parseInt(options.scanInterval),
        notificationEnabled: true,
        notificationChannels,
        autoRemediation: options.autoRemediation || false,
        autoRemediationTimeout: 30,
        requireApproval: options.requireApproval || false,
        approvers: ['security-team', 'compliance-officer'],
        auditRetentionDays: parseInt(options.auditRetention),
        logLevel: 'info' as const,
        enableReporting: true,
        reportFrequency: 'weekly' as const,
        complianceFrameworks: frameworks,
        baselineTemplates: ['nist-csf', 'cis-benchmark'],
      },
      policies: [
        {
          id: 'policy-001',
          name: 'S3 Bucket Encryption Policy',
          type: 'encryption' as const,
          description: 'Ensures all S3 buckets have encryption enabled',
          version: '1.0.0',
          status: 'active' as const,
          framework: 'NIST-800-53' as const,
          severity: 'high' as const,
          enabled: true,
          categories: ['data-protection', 'encryption'],
          controls: [
            {
              id: 'control-001',
              name: 'S3 Encryption Check',
              description: 'Verify S3 bucket has default encryption enabled',
              type: 'preventive' as const,
              automation: 'fully-automated' as const,
              implementation: {
                language: 'terraform' as const,
                code: 'resource "aws_s3_bucket_server_side_encryption_configuration" "example" { rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } } }',
                parameters: { algorithm: 'AES256' },
                dependencies: ['aws_s3_bucket'],
              },
              validation: {
                method: 'automated-test' as const,
                script: 'aws s3api get-bucket-encryption --bucket ${bucket_name}',
                criteria: ['ServerSideEncryptionConfiguration exists'],
                frequency: 'daily' as const,
              },
              remediation: {
                automatic: true,
                steps: [
                  { order: 1, action: 'Enable encryption', target: 's3-bucket', command: 'aws s3api put-bucket-encryption --bucket ${bucket} --server-side-encryption-configuration \'{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}\'', timeout: 60 },
                ],
                rollbackPlan: 'Disable encryption if access issues occur',
                estimatedTime: 5,
                impact: 'low' as const,
              },
            },
          ],
          resources: [
            {
              type: 's3-bucket' as const,
              selector: { pattern: '*', matchType: 'glob' as const, attribute: 'bucket_name' },
              includeTags: { Environment: '*' },
              excludeTags: { Exempt: 'true' },
              resourceIds: [],
            },
          ],
          parameters: [
            { name: 'encryption_algorithm', type: 'string' as const, description: 'Encryption algorithm to use', defaultValue: 'AES256', required: true, allowedValues: ['AES256', 'aws:kms'] },
          ],
          conditions: [],
          enforcement: {
            mode: 'auto-remediate' as const,
            blockOnViolation: true,
            autoRemediate: true,
            notificationChannels: ['security-team'],
            escalationRules: [
              { id: 'escalate-001', name: 'Security Escalation', condition: 'severity == "critical"', action: 'declare-incident' as const, target: 'security-team', threshold: 1 },
            ],
            gracePeriod: 0,
          },
          metadata: {
            author: 'Security Team',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date(),
            lastReviewed: new Date(),
            reviewInterval: 90,
            tags: ['s3', 'encryption', 'data-protection'],
            references: ['NIST-800-53 SC-12', 'NIST-800-53 SC-28'],
            riskScore: 85,
          },
        },
        {
          id: 'policy-002',
          name: 'IAM Role MFA Policy',
          type: 'identity-management' as const,
          description: 'Enforces MFA for all IAM role assumptions',
          version: '1.0.0',
          status: 'active' as const,
          framework: 'NIST-800-53' as const,
          severity: 'critical' as const,
          enabled: true,
          categories: ['iam', 'mfa', 'access-control'],
          controls: [
            {
              id: 'control-002',
              name: 'MFA Condition Check',
              description: 'Verify IAM roles have MFA condition in trust policy',
              type: 'preventive' as const,
              automation: 'fully-automated' as const,
              implementation: {
                language: 'terraform' as const,
                code: 'resource "aws_iam_role" "example" { assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { Bool = { "aws:MultiFactorAuthPresent" = "true" } } }] }) }',
                parameters: { mfa_required: true },
                dependencies: [],
              },
              validation: {
                method: 'automated-test' as const,
                script: 'aws iam get-role --role-name ${role_name} --query "Role.AssumeRolePolicyDocument"',
                criteria: ['aws:MultiFactorAuthPresent condition exists'],
                frequency: 'daily' as const,
              },
              remediation: {
                automatic: false,
                steps: [
                  { order: 1, action: 'Notify role owner', target: 'role-owner', timeout: 0 },
                  { order: 2, action: 'Update trust policy', target: 'iam-role', timeout: 60 },
                ],
                rollbackPlan: 'Restore previous trust policy version',
                estimatedTime: 30,
                impact: 'medium' as const,
              },
            },
          ],
          resources: [
            {
              type: 'iam-role' as const,
              selector: { pattern: '*', matchType: 'glob' as const, attribute: 'role_name' },
              includeTags: {},
              excludeTags: { BypassMFA: 'true' },
              resourceIds: [],
            },
          ],
          parameters: [],
          conditions: [],
          enforcement: {
            mode: 'block' as const,
            blockOnViolation: true,
            autoRemediate: false,
            notificationChannels: ['security-team', 'iam-team'],
            escalationRules: [],
            gracePeriod: 24,
          },
          metadata: {
            author: 'Security Team',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date(),
            lastReviewed: new Date(),
            reviewInterval: 60,
            tags: ['iam', 'mfa', 'access-control'],
            references: ['NIST-800-53 IA-2', 'CIS AWS Benchmark 1.16'],
            riskScore: 95,
          },
        },
        {
          id: 'policy-003',
          name: 'Public Access Block Policy',
          type: 'network-security' as const,
          description: 'Prevents public access to S3 buckets and RDS databases',
          version: '1.0.0',
          status: 'active' as const,
          framework: 'CIS' as const,
          severity: 'critical' as const,
          enabled: true,
          categories: ['network-security', 'data-protection', 'public-access'],
          controls: [
            {
              id: 'control-003',
              name: 'Public Access Block',
              description: 'Block public access configuration for S3 buckets',
              type: 'preventive' as const,
              automation: 'fully-automated' as const,
              implementation: {
                language: 'terraform' as const,
                code: 'resource "aws_s3_bucket_public_access_block" "example" { bucket = aws_s3_bucket.example.id block_public_acls = true block_public_policy = true ignore_public_acls = true restrict_public_buckets = true }',
                parameters: { block_public_acls: true, block_public_policy: true },
                dependencies: ['aws_s3_bucket'],
              },
              validation: {
                method: 'automated-test' as const,
                script: 'aws s3api get-bucket-policy-status --bucket ${bucket_name}',
                criteria: ['IsPublic is false'],
                frequency: 'hourly' as const,
              },
              remediation: {
                automatic: true,
                steps: [
                  { order: 1, action: 'Enable public access block', target: 's3-bucket', command: 'aws s3api put-public-access-block --bucket ${bucket} --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"', timeout: 60 },
                ],
                rollbackPlan: 'Review and selectively enable if required',
                estimatedTime: 2,
                impact: 'low' as const,
              },
            },
          ],
          resources: [
            {
              type: 's3-bucket' as const,
              selector: { pattern: '*', matchType: 'glob' as const, attribute: 'bucket_name' },
              includeTags: {},
              excludeTags: { PublicAllowed: 'true' },
              resourceIds: [],
            },
          ],
          parameters: [],
          conditions: [],
          enforcement: {
            mode: 'auto-remediate' as const,
            blockOnViolation: true,
            autoRemediate: true,
            notificationChannels: ['security-team'],
            escalationRules: [
              { id: 'escalate-003', name: 'Critical Escalation', condition: 'public_access == true', action: 'declare-incident' as const, target: 'ciso', threshold: 1 },
            ],
            gracePeriod: 0,
          },
          metadata: {
            author: 'Security Team',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date(),
            lastReviewed: new Date(),
            reviewInterval: 30,
            tags: ['s3', 'public-access', 'network-security'],
            references: ['CIS AWS Benchmark 2.1.1', 'NIST-800-53 AC-3'],
            riskScore: 100,
          },
        },
      ],
      rules: [
        {
          id: 'rule-001',
          policyId: 'policy-001',
          name: 'S3 Unencrypted Bucket Rule',
          description: 'Detect S3 buckets without encryption',
          severity: 'high' as const,
          enabled: true,
          condition: {
            id: 'condition-001',
            type: 'and' as const,
            conditions: [
              { field: 'resource_type', operator: 'equals' as const, value: 's3-bucket' },
              { field: 'encryption_enabled', operator: 'not-equals' as const, value: true },
            ],
          },
          actions: [
            { type: 'alert' as const, config: { channels: ['security-team'] }, order: 1 },
            { type: 'tag' as const, config: { key: 'ComplianceStatus', value: 'NonCompliant' }, order: 2 },
          ],
          schedule: { type: 'interval' as const, expression: '1h', timezone: 'UTC' },
        },
        {
          id: 'rule-002',
          policyId: 'policy-002',
          name: 'IAM No-MFA Role Rule',
          description: 'Detect IAM roles without MFA requirement',
          severity: 'critical' as const,
          enabled: true,
          condition: {
            id: 'condition-002',
            type: 'and' as const,
            conditions: [
              { field: 'resource_type', operator: 'equals' as const, value: 'iam-role' },
              { field: 'mfa_required', operator: 'not-equals' as const, value: true },
            ],
          },
          actions: [
            { type: 'block' as const, config: { message: 'MFA must be enabled for this role' }, order: 1 },
            { type: 'alert' as const, config: { channels: ['security-team', 'iam-team'] }, order: 2 },
          ],
          schedule: { type: 'interval' as const, expression: '30m', timezone: 'UTC' },
        },
      ],
      violations: [
        {
          id: 'violation-001',
          policyId: 'policy-001',
          policyName: 'S3 Bucket Encryption Policy',
          ruleId: 'rule-001',
          ruleName: 'S3 Unencrypted Bucket Rule',
          resourceId: 's3-bucket-unsecure-data',
          resourceType: 's3-bucket',
          severity: 'high' as const,
          status: 'open' as const,
          detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          description: 'S3 bucket does not have default encryption enabled',
          evidence: {
            snapshot: { encryption_enabled: false, bucket_name: 'unsecure-data' },
            logs: ['GET /bucket-encryption returned 404'],
            screenshots: [],
            metrics: { risk_score: 85 },
            configurationDiff: null,
          },
          affectedResources: ['s3-bucket-unsecure-data'],
          remediation: {
            automatic: true,
            steps: [
              { order: 1, action: 'Enable encryption', target: 's3-bucket-unsecure-data', command: 'aws s3api put-bucket-encryption --bucket unsecure-data --server-side-encryption-configuration...', timeout: 60 },
            ],
            rollbackPlan: 'Disable encryption if issues occur',
            estimatedTime: 5,
            impact: 'low' as const,
          },
          assignedTo: 'security-engineer-1',
          resolvedAt: undefined,
          resolutionNotes: undefined,
          falsePositiveReason: undefined,
          metadata: { detected_by: 'automated-scan', scan_id: 'scan-001' },
        },
      ],
      exceptions: [
        {
          id: 'exception-001',
          policyId: 'policy-001',
          resourceId: 's3-bucket-public-assets',
          requestedBy: 'developer-1',
          reason: 'Public assets bucket requires no encryption for CDN delivery',
          status: 'approved' as const,
          justification: 'Business requirement for public asset delivery via CloudFront',
          riskScore: 30,
          approvedBy: 'security-lead',
          approvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          conditions: {
            id: 'exception-condition-001',
            type: 'and' as const,
            conditions: [
              { field: 'bucket_name', operator: 'equals' as const, value: 'public-assets' },
              { field: 'environment', operator: 'equals' as const, value: 'production' },
            ],
          },
          reviewRequired: true,
          comments: [
            { id: 'comment-001', author: 'security-lead', comment: 'Approved with 30-day expiration. Requires quarterly review.', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ],
        },
      ],
      audits: [
        {
          id: 'audit-001',
          eventType: 'policy-creation' as const,
          policyId: 'policy-001',
          policyName: 'S3 Bucket Encryption Policy',
          performedBy: 'security-admin',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          details: {
            action: 'create_policy',
            previousState: undefined,
            newState: { policy_id: 'policy-001', status: 'active', enforcement_mode: 'auto-remediate' },
            reason: 'Implement NIST-800-53 SC-12 control',
            ipAddress: '10.0.1.100',
            userAgent: 'AWS Console',
            result: 'success' as const,
          },
          metadata: { change_request_id: 'CR-001', reviewed_by: 'security-team-lead' },
        },
        {
          id: 'audit-002',
          eventType: 'violation-detected' as const,
          policyId: 'policy-001',
          policyName: 'S3 Bucket Encryption Policy',
          performedBy: 'automated-scanner',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          details: {
            action: 'detect_violation',
            previousState: undefined,
            newState: { violation_id: 'violation-001', severity: 'high', status: 'open' },
            reason: 'Scheduled security scan detected unencrypted bucket',
            result: 'success' as const,
          },
          metadata: { scan_id: 'scan-001', scan_type: 'automated' },
        },
      ],
      compliance: [
        {
          id: 'compliance-001',
          framework: 'NIST-800-53' as const,
          period: '2024-Q1',
          generatedAt: new Date(),
          overallScore: 87,
          status: 'partial' as const,
          controls: [
            {
              id: 'control-001',
              controlId: 'SC-12',
              title: 'Cryptographic Key Establishment and Management',
              description: 'Implement NIST-approved cryptography',
              status: 'compliant' as const,
              policies: ['policy-001'],
              evidence: ['encryption-config-screenshot', 'audit-log'],
              lastValidated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            },
            {
              id: 'control-002',
              controlId: 'IA-2',
              title: 'Identification and Authentication',
              description: 'Require MFA for privileged access',
              status: 'non-compliant' as const,
              policies: ['policy-002'],
              evidence: ['iam-role-config'],
              lastValidated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            },
            {
              id: 'control-003',
              controlId: 'AC-3',
              title: 'Access Enforcement',
              description: 'Prevent unauthorized access',
              status: 'compliant' as const,
              policies: ['policy-003'],
              evidence: ['public-access-block-config'],
              lastValidated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            },
          ],
          gaps: [
            {
              control: 'IA-2',
              severity: 'high' as const,
              description: '2 IAM roles lack MFA requirement in trust policy',
              remediation: 'Update trust policies to include MFA condition',
              estimatedEffort: 4,
              priority: 1,
            },
          ],
          recommendations: [
            'Implement automatic MFA enforcement for all IAM roles',
            'Enable monthly compliance reviews',
            'Add policy exceptions workflow automation',
          ],
          validatedBy: 'compliance-officer',
          nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
      enforcement: [
        {
          id: 'enforcement-001',
          violationId: 'violation-001',
          type: 'auto-remediate',
          performedBy: 'system',
          timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
          details: { action: 'enable_encryption', bucket: 's3-bucket-unsecure-data', algorithm: 'AES256' },
          status: 'completed' as const,
          result: { encryption_enabled: true, updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000) },
        },
      ],
    };

    displaySecurityPolicyConfig(finalConfig);

    await writeSecurityPolicyFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: security-policy-${providers.join('.tf, security-policy-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'security-policy-manager.ts' : 'security_policy_manager.py'}`));
    console.log(chalk.green('✅ Generated: SECURITY_POLICY.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: security-policy-config.json\n'));

    console.log(chalk.green('✓ Security policy as code configured successfully!'));
  }));

}
