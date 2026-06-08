import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security infrastructure-security` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerInfrastructureSecurity(security: Command): void {
  security
  .command('infrastructure-security')
  .description('Generate infrastructure security scanning and compliance checking with remediation')
  .argument('<name>', 'Name of the infrastructure security project')
  .option('--frequency <frequency>', 'Scan frequency (on-deploy, on-schedule, on-demand, continuous)', 'on-schedule')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low, info)', 'high')
  .option('--targets <targets>', 'Comma-separated scan targets (aws, azure, gcp, kubernetes, terraform, cloudformation, arm)', 'aws,azure,gcp')
  .option('--resource-types <types>', 'Comma-separated resource types (compute, storage, network, database, security, identity)', 'compute,storage,network,security')
  .option('--compliance-standards <standards>', 'Comma-separated compliance standards (cis-benchmark, nist-800-53, pci-dss, hipaa, gdpr, soc2, iso-27001)', 'cis-benchmark,nist-800-53')
  .option('--deep-analysis', 'Enable deep analysis')
  .option('--scan-drift', 'Scan for infrastructure drift')
  .option('--scan-misconfigurations', 'Scan for security misconfigurations')
  .option('--scan-compliance', 'Scan for compliance issues')
  .option('--scan-vulnerabilities', 'Scan for vulnerabilities')
  .option('--auto-remediate', 'Enable automatic remediation')
  .option('--remediation-type <type>', 'Remediation type (automatic, manual, semi-automatic)', 'semi-automatic')
  .option('--notify-on-findings', 'Send notifications on findings')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './infrastructure-security-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeInfrastructureSecurityFiles, displayInfrastructureSecurityConfig } = await import('../../utils/infrastructure-security.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const targets = options.targets.split(',') as ('aws' | 'azure' | 'gcp' | 'kubernetes' | 'terraform' | 'cloudformation' | 'arm')[];
    const resourceTypes = options.resourceTypes.split(',') as ('compute' | 'storage' | 'network' | 'database' | 'security' | 'identity' | 'container' | 'serverless' | 'custom')[];
    const complianceStandards = options.complianceStandards.split(',') as ('cis-benchmark' | 'nist-800-53' | 'pci-dss' | 'hipaa' | 'gdpr' | 'soc2' | 'iso-27001' | 'custom')[];

    const finalConfig = {
      projectName: name,
      providers,
      scanSettings: {
        enabled: true,
        frequency: options.frequency,
        interval: '0 3 * * *', // Daily at 3 AM
        severityThreshold: options.severityThreshold,
        failOnThreshold: options.severityThreshold,
        targets,
        resourceTypes,
        complianceStandards,
        deepAnalysis: options.deepAnalysis || false,
        includeDeprecated: false,
        scanDrift: options.scanDrift || true,
        scanMisconfigurations: options.scanMisconfigurations || true,
        scanCompliance: options.scanCompliance || true,
        scanVulnerabilities: options.scanVulnerabilities || true,
        autoRemediate: options.autoRemediate || false,
        remediationType: options.remediationType,
        notifyOnFindings: options.notifyOnFindings || true,
        generateReports: true,
      },
      resources: [
        {
          id: 'resource-001',
          name: 'my-s3-bucket',
          type: 'storage' as const,
          provider: 'aws' as const,
          region: 'us-east-1',
          account: '123456789012',
          arn: 'arn:aws:s3:::my-s3-bucket',
          tags: {
            Environment: 'production',
            Application: 'webapp',
          },
          metadata: {
            versioning: false,
            encryption: false,
            publicAccess: true,
          },
          createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          lastScanned: new Date(Date.now() - 2 * 60 * 60 * 1000),
          driftDetected: true,
          findings: ['finding-001'],
        },
        {
          id: 'resource-002',
          name: 'web-security-group',
          type: 'network' as const,
          provider: 'aws' as const,
          region: 'us-east-1',
          account: '123456789012',
          resourceId: 'sg-0123456789abcdef0',
          tags: {
            Environment: 'production',
            Tier: 'web',
          },
          metadata: {
            ingressRules: 3,
            egressRules: 0,
            openPorts: ['80', '443'],
          },
          createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          lastScanned: new Date(Date.now() - 2 * 60 * 60 * 1000),
          driftDetected: false,
          findings: ['finding-002'],
        },
      ],
      findings: [
        {
          id: 'finding-001',
          title: 'S3 Bucket Public Access Enabled',
          description: 'S3 bucket my-s3-bucket has public access enabled, which may expose sensitive data to unauthorized users.',
          severity: 'critical' as const,
          status: 'open' as const,
          resource: {
            id: 'resource-001',
            name: 'my-s3-bucket',
            type: 'storage' as const,
            provider: 'aws' as const,
            region: 'us-east-1',
            arn: 'arn:aws:s3:::my-s3-bucket',
          },
          control: {
            id: 'control-001',
            name: 'S3 Bucket Public Access Prohibited',
            category: 'Data Protection',
            framework: 'CIS AWS Benchmark',
            description: 'S3 buckets should not have public access enabled',
            implementation: 'Block public access at bucket level',
            validation: 'Verify BlockPublicAccess is enabled',
          },
          compliance: [
            {
              standard: 'cis-benchmark' as const,
              requirement: '2.1.1',
              control: 'S3.1',
              severity: 'critical' as const,
            },
            {
              standard: 'nist-800-53' as const,
              requirement: 'SC-13',
              control: 'SC-13',
              severity: 'critical' as const,
            },
          ],
          detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          remediation: {
            id: 'remediation-001',
            type: 'automatic' as const,
            status: 'pending' as const,
            estimatedTime: '5min',
            complexity: "low" as const,
            risk: "low" as const,
          },
          confidence: 0.98,
          falsePositive: false,
          businessImpact: 'critical' as const,
          effort: '5min',
          assignee: 'CloudOps Team',
          references: [
            {
              type: 'cwe' as const,
              url: 'https://cwe.mitre.org/data/definitions/732.html',
              title: 'CWE-732: Incorrect Permission Assignment for Critical Resource',
            },
          ],
          metadata: {
            bucketPolicyVersion: '2012-10-17',
            publicAccessBlock: false,
          },
        },
        {
          id: 'finding-002',
          title: 'Security Group Missing Egress Rules',
          description: 'Security group web-security-group is missing egress rules, which may restrict outbound traffic unexpectedly.',
          severity: 'high' as const,
          status: 'open' as const,
          resource: {
            id: 'resource-002',
            name: 'web-security-group',
            type: 'network' as const,
            provider: 'aws' as const,
            region: 'us-east-1',
            resourceId: 'sg-0123456789abcdef0',
          },
          control: {
            id: 'control-002',
            name: 'Security Group Configuration',
            category: 'Network Security',
            framework: 'NIST-800-53',
            description: 'Security groups should have explicit egress rules',
            implementation: 'Configure egress rules for all required traffic',
            validation: 'Verify egress rules exist and are appropriate',
          },
          compliance: [
            {
              standard: 'nist-800-53' as const,
              requirement: 'SC-7',
              control: 'SC-7',
              severity: 'high' as const,
            },
          ],
          detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          remediation: {
            id: 'remediation-002',
            type: 'semi-automatic' as const,
            status: 'pending' as const,
            estimatedTime: '15min',
            complexity: "medium" as const,
            risk: "medium" as const,
          },
          confidence: 0.92,
          falsePositive: false,
          businessImpact: 'high' as const,
          effort: '15min',
          assignee: 'Network Team',
          references: [],
          metadata: {
            groupId: 'sg-0123456789abcdef0',
            vpcId: 'vpc-0123456789abcdef0',
            ingressRulesCount: 3,
            egressRulesCount: 0,
          },
        },
      ],
      remediations: [
        {
          id: 'remediation-001',
          findingId: 'finding-001',
          type: 'automatic' as const,
          status: 'pending' as const,
          title: 'Enable S3 Block Public Access',
          description: 'Enable Block Public Access settings on the S3 bucket',
          steps: [
            {
              id: 'step-1',
              title: 'Block public access',
              description: 'Put bucket configuration to block public access',
              command: 'aws s3api put-public-access-block --bucket my-s3-bucket --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"',
              automated: true,
              order: 1,
              dependencies: [],
            },
            {
              id: 'step-2',
              title: 'Verify configuration',
              description: 'Get public access block configuration to verify',
              command: 'aws s3api get-public-access-block --bucket my-s3-bucket',
              automated: true,
              order: 2,
              dependencies: ['step-1'],
            },
          ],
          preConditions: ['S3 bucket exists', 'User has s3:PutPublicAccessBlock permission'],
          postConditions: ['BlockPublicAccess is enabled', 'Bucket is not publicly accessible'],
          rollbackPlan: 'Disable BlockPublicAccess using aws s3api delete-public-access-block',
          estimatedTime: '5min',
          complexity: "low" as const,
          risk: "low" as const,
          automatedScript: '#!/bin/bash\naws s3api put-public-access-block \\\n  --bucket my-s3-bucket \\\n  --public-access-block-configuration \\\n  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"\n',
        },
        {
          id: 'remediation-002',
          findingId: 'finding-002',
          type: 'semi-automatic' as const,
          status: 'pending' as const,
          title: 'Add Egress Rules to Security Group',
          description: 'Add appropriate egress rules to allow outbound traffic',
          steps: [
            {
              id: 'step-1',
              title: 'Review current rules',
              description: 'Review current ingress rules to determine appropriate egress',
              automated: false,
              order: 1,
              dependencies: [],
            },
            {
              id: 'step-2',
              title: 'Add egress rules',
              description: 'Add egress rules for HTTPS and HTTP traffic',
              command: 'aws ec2 authorize-security-group-egress --group-id sg-0123456789abcdef0 --ip-permissions "IpProtocol=-1,FromPort=-1,ToPort=-1,IpRanges=[{CidrIp=0.0.0.0/0,Description="Allow all outbound traffic"}]"',
              automated: true,
              order: 2,
              dependencies: ['step-1'],
            },
          ],
          preConditions: ['Security group exists', 'User has ec2:AuthorizeSecurityGroupEgress permission'],
          postConditions: ['Egress rules are configured', 'Outbound traffic is allowed'],
          rollbackPlan: 'Remove egress rules using aws ec2 revoke-security-group-egress',
          estimatedTime: '15min',
          complexity: "medium" as const,
          risk: "medium" as const,
          manualInstructions: '1. Review the current security group configuration\n2. Determine appropriate egress rules\n3. Add egress rules to allow necessary outbound traffic\n4. Verify that applications work correctly',
        },
      ],
      complianceReports: [
        {
          id: 'report-001',
          name: 'CIS AWS Benchmark Compliance Report',
          description: 'Quarterly CIS AWS Benchmark compliance assessment',
          standard: 'cis-benchmark' as const,
          version: '1.4.0',
          status: 'non-compliant' as const,
          score: 78,
          passScore: 80,
          requirements: [
            {
              id: '1.1',
              name: 'Avoid the use of the root account',
              description: 'The root account should not be used for daily operations',
              status: 'pass' as const,
              severity: 'critical' as const,
              controls: ['1.1'],
              findings: [],
              implementation: 'MFA is enabled on root account',
              evidence: ['root-mfa-enabled'],
            },
            {
              id: '2.1.1',
              name: 'S3 Bucket Public Access Prohibited',
              description: 'S3 buckets should not have public access enabled',
              status: 'fail' as const,
              severity: 'critical' as const,
              controls: ['2.1.1'],
              findings: ['finding-001'],
              implementation: 'Block public access not enabled',
              evidence: ['s3-bucket-public-access'],
            },
            {
              id: '4.1',
              name: 'Security Group Configuration',
              description: 'Security groups should be configured appropriately',
              status: 'warning' as const,
              severity: 'high' as const,
              controls: ['4.1'],
              findings: ['finding-002'],
            },
          ],
          scannedResources: 15,
          findings: ['finding-001', 'finding-002'],
          recommendations: [
            'Enable Block Public Access on all S3 buckets',
            'Configure egress rules on all security groups',
            'Implement MFA for all IAM users',
          ],
          generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          validUntil: new Date(Date.now() + 83 * 24 * 60 * 60 * 1000),
          frameworks: ['cis-aws-benchmark', 'nist-800-53'],
        },
      ],
      benchmarks: [
        {
          id: 'benchmark-001',
          name: 'CIS AWS Foundations Benchmark',
          description: 'CIS AWS Foundations Benchmark Level 1',
          standard: 'cis-benchmark' as const,
          version: '1.4.0',
          level: '1' as const,
          score: 85,
          maxScore: 100,
          scannedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          duration: 45,
          controls: [
            {
              id: '1.1',
              title: 'Avoid the use of the root account',
              description: 'The root account should not be used for daily operations',
              status: 'pass' as const,
              severity: 'critical' as const,
              code: '1.1',
              references: ['https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html'],
              resources: ['account-001'],
              remediation: 'Use IAM users and roles with appropriate permissions',
              auditCommand: 'aws iam get-account-summary',
              remediationCommand: 'N/A - Root account management is procedural',
            },
            {
              id: '1.2',
              title: 'Ensure MFA is enabled',
              description: 'MFA should be enabled for all IAM users',
              status: 'fail' as const,
              severity: 'critical' as const,
              code: '1.2',
              references: ['https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable.html'],
              resources: ['user-001', 'user-002'],
              remediation: 'Enable MFA for all IAM users using aws iam enable-mfa-device',
              auditCommand: 'aws iam list-virtual-mfa-devices',
              remediationCommand: 'aws iam enable-mfa-device --user-name <username> --serial-number <arn> --authentication-code1 <code1> --authentication-code2 <code2>',
            },
            {
              id: '2.1.1',
              title: 'S3 Bucket Public Access Prohibited',
              description: 'S3 buckets should not have public access enabled',
              status: 'fail' as const,
              severity: 'critical' as const,
              code: '2.1.1',
              references: ['https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html'],
              resources: ['resource-001'],
              remediation: 'Enable Block Public Access on S3 buckets',
              auditCommand: 'aws s3api get-bucket-policy-status --bucket <bucket-name>',
              remediationCommand: 'aws s3api put-public-access-block --bucket <bucket-name> --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true',
            },
          ],
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'Prisma Cloud',
          type: 'prisma-cloud' as const,
          enabled: true,
          config: {
            endpoint: 'https://api.prismacloud.io',
            apiKey: '********',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          id: 'integration-002',
          name: 'Prowler',
          type: 'prowler' as const,
          enabled: true,
          config: {
            region: 'us-east-1',
            outputFormat: 'json',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 10 * 60 * 1000),
        },
      ],
    };

    displayInfrastructureSecurityConfig(finalConfig);

    await writeInfrastructureSecurityFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: infrastructure-security-${providers.join('.tf, infrastructure-security-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'infrastructure-security-manager.ts' : 'infrastructure_security_manager.py'}`));
    console.log(chalk.green('✅ Generated: INFRASTRUCTURE_SECURITY.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: infrastructure-security-config.json\n'));

    console.log(chalk.green('✓ Infrastructure security scanning project configured successfully!'));
  }));

}
