import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security secret-detection` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerSecretDetection(security: Command): void {
  security
  .command('secret-detection')
  .description('Generate secret detection and management with HashiCorp Vault and rotation policies')
  .argument('<name>', 'Name of the secret detection project')
  .option('--frequency <frequency>', 'Detection frequency (on-commit, on-push, on-build, scheduled, on-demand)', 'scheduled')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low)', 'high')
  .option('--scan-history', 'Scan git history')
  .option('--scan-comments', 'Scan code comments')
  .option('--scan-code', 'Scan source code')
  .option('--scan-configs', 'Scan configuration files')
  .option('--scan-env-vars', 'Scan environment variables')
  .option('--scan-dockerfiles', 'Scan Dockerfiles')
  .option('--scan-k8s-manifests', 'Scan Kubernetes manifests')
  .option('--auto-revoke', 'Automatically revoke detected secrets')
  .option('--auto-rotate', 'Automatically rotate secrets based on policies')
  .option('--notify-on-detect', 'Send notifications on secret detection')
  .option('--quarantine-detected', 'Quarantine files with detected secrets')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './secret-detection-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeSecretDetectionFiles, displaySecretDetectionConfig } = await import('../../utils/secret-detection.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      detectionSettings: {
        enabled: true,
        frequency: options.frequency,
        interval: '0 2 * * *', // Daily at 2 AM
        severityThreshold: options.severityThreshold,
        failOnThreshold: options.severityThreshold,
        scanHistory: options.scanHistory || false,
        scanComments: options.scanComments || false,
        scanCode: options.scanCode || true,
        scanConfigs: options.scanConfigs || true,
        scanEnvVars: options.scanEnvVars || true,
        scanDockerfiles: options.scanDockerfiles || true,
        scanKubernetesManifests: options.scanK8sManifests || true,
        entropyThreshold: 4.5,
        minSecretLength: 16,
        autoRevoke: options.autoRevoke || false,
        autoRotate: options.autoRotate || false,
        notifyOnDetection: options.notifyOnDetect || true,
        quarantineDetected: options.quarantineDetected || false,
      },
      secrets: [
        {
          id: 'secret-001',
          name: 'AWS Access Key ID',
          type: 'api-key' as const,
          severity: 'critical' as const,
          status: 'active' as const,
          location: {
            type: 'file' as const,
            path: '/app/config',
            file: 'credentials.yml',
            line: 15,
            repository: 'myapp',
            branch: 'main',
          },
          valueHash: 'AKIAIOSFODNN7EXAMPLE:hash123456789',
          valueMasked: 'AKIAI**************',
          detectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lastRotated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          rotationPolicyId: 'policy-001',
          vaultPath: 'secret/aws/access-key',
          description: 'AWS access key for S3 bucket access',
          tags: ['aws', 's3', 'production'],
          metadata: {
            service: 's3',
            region: 'us-east-1',
            accessLevel: 'read-write',
          },
          owner: 'DevOps Team',
          assignedTo: 'John Doe',
          confidence: 0.95,
          falsePositive: false,
          references: [
            {
              type: 'cwe' as const,
              url: 'https://cwe.mitre.org/data/definitions/798.html',
              title: 'CWE-798: Use of Hard-coded Credentials',
            },
            {
              type: 'owasp' as const,
              url: 'https://owasp.org/www-project-top-ten/A07_2021-Identification_and_Authentication_Failures',
              title: 'OWASP A07: Identification and Authentication Failures',
            },
          ],
          dependencies: [],
        },
        {
          id: 'secret-002',
          name: 'Database Connection String',
          type: 'database-url' as const,
          severity: 'high' as const,
          status: 'active' as const,
          location: {
            type: 'environment' as const,
            path: '.env',
            file: '.env',
            line: 8,
          },
          valueHash: 'postgres://user:pass@host:5432/db:hash987654321',
          valueMasked: 'postgres://user:****@host:5432/db',
          detectedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          lastRotated: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          rotationPolicyId: 'policy-002',
          vaultPath: 'secret/database/connection-string',
          description: 'PostgreSQL database connection string',
          tags: ['database', 'postgresql', 'production'],
          metadata: {
            host: 'db.example.com',
            port: 5432,
            database: 'appdb',
          },
          owner: 'DBA Team',
          confidence: 0.88,
          falsePositive: false,
          references: [
            {
              type: 'cwe' as const,
              url: 'https://cwe.mitre.org/data/definitions/532.html',
              title: 'CWE-532: Insertion of Sensitive Information into Log File',
            },
          ],
          dependencies: [],
        },
      ],
      rotationPolicies: [
        {
          id: 'policy-001',
          name: 'AWS Keys Rotation Policy',
          description: 'Automatic rotation of AWS access keys every 90 days',
          secretTypes: ['api-key' as const, 'token' as const],
          frequency: 'quarterly' as const,
          autoRotate: true,
          notifyBeforeRotation: true,
          notificationDays: 7,
          requireApproval: false,
          approvers: [],
          rotationWindow: {
            start: '02:00',
            end: '04:00',
            timezone: 'UTC',
          },
          maxRotationTime: 30,
          retryOnFailure: true,
          maxRetries: 3,
          retryInterval: 5,
          preRotationScript: '/scripts/validate-aws-access.sh',
          postRotationScript: '/scripts/update-aws-config.sh',
          validationScript: '/scripts/verify-aws-key.sh',
          rollbackOnFailure: true,
          encryptionAtRest: true,
          encryptionInTransit: true,
          algorithm: 'aes256-gcm' as const,
          keyLength: 256,
          isActive: true,
          lastRotated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          nextRotation: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'policy-002',
          name: 'Database Credentials Rotation Policy',
          description: 'Monthly rotation of database passwords',
          secretTypes: ['password' as const, 'database-url' as const],
          frequency: 'monthly' as const,
          autoRotate: true,
          notifyBeforeRotation: true,
          notificationDays: 3,
          requireApproval: true,
          approvers: ['dba-lead', 'security-lead'],
          rotationWindow: {
            start: '03:00',
            end: '05:00',
            timezone: 'UTC',
          },
          maxRotationTime: 15,
          retryOnFailure: true,
          maxRetries: 5,
          retryInterval: 2,
          validationScript: '/scripts/verify-db-connection.sh',
          rollbackOnFailure: true,
          encryptionAtRest: true,
          encryptionInTransit: true,
          algorithm: 'aes256-gcm' as const,
          keyLength: 256,
          isActive: true,
          lastRotated: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          nextRotation: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
      ],
      vaultIntegrations: [
        {
          id: 'vault-001',
          name: 'HashiCorp Vault Production',
          provider: 'hashicorp-vault' as const,
          enabled: true,
          config: {
            endpoint: 'https://vault.example.com',
            namespace: 'production',
            engine: 'kv',
            engineVersion: 'v2' as const,
            maxRetries: 3,
            timeout: 30,
            healthCheck: {
              enabled: true,
              interval: 60,
              unhealthyThreshold: 3,
            },
          },
          auth: {
            method: 'approle' as const,
            roleId: 'role-id-12345',
            secretId: 'secret-id-67890',
            mountPath: 'auth/approle',
            renewToken: true,
            tokenTTL: 3600,
            maxTTL: 7200,
          },
          secrets: [],
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          id: 'vault-002',
          name: 'AWS Secrets Manager',
          provider: 'aws-secrets-manager' as const,
          enabled: true,
          config: {
            endpoint: 'secretsmanager.us-east-1.amazonaws.com',
            engine: 'secretsmanager',
            engineVersion: 'v2' as const,
            maxRetries: 3,
            timeout: 30,
            healthCheck: {
              enabled: true,
              interval: 60,
              unhealthyThreshold: 3,
            },
          },
          auth: {
            method: 'aws' as const,
            renewToken: true,
          },
          secrets: [],
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 10 * 60 * 1000),
        },
      ],
      accessControls: [
        {
          id: 'ac-001',
          secretId: 'secret-001',
          principal: 'devops-team',
          principalType: 'group' as const,
          permissions: [
            { action: 'read' as const, allowed: true },
            { action: 'rotate' as const, allowed: true },
          ],
          conditions: [],
          grantedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          grantedBy: 'admin',
          justification: 'DevOps team needs access to AWS keys for deployment',
        },
      ],
      auditLogs: [
        {
          id: 'log-001',
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          action: 'accessed' as const,
          secretId: 'secret-001',
          principal: 'john.doe',
          principalType: 'user',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          location: 'New York, US',
          result: 'success' as const,
          metadata: {},
        },
        {
          id: 'log-002',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          action: 'rotated' as const,
          secretId: 'secret-002',
          principal: 'system',
          principalType: 'service-account',
          result: 'success' as const,
          metadata: {
            rotationMethod: 'automatic',
          },
        },
      ],
      complianceReports: [
        {
          id: 'report-001',
          name: 'PCI-DSS Compliance Report',
          description: 'Quarterly PCI-DSS compliance assessment for secret management',
          standard: 'pci-dss' as const,
          status: 'compliant' as const,
          score: 95,
          requirements: [
            {
              id: 'req-1',
              name: 'Encryption of secret at rest',
              description: 'All secrets must be encrypted at rest using AES-256 or stronger',
              status: 'pass' as const,
              severity: 'critical' as const,
              controls: ['3.1', '3.2'],
            },
            {
              id: 'req-2',
              name: 'Secret rotation policy',
              description: 'Secrets must be rotated at least quarterly',
              status: 'pass' as const,
              severity: 'high' as const,
              controls: ['8.2.1'],
            },
            {
              id: 'req-3',
              name: 'Access control and authentication',
              description: 'Access to secrets must be controlled and authenticated',
              status: 'warning' as const,
              severity: 'medium' as const,
              controls: ['7.1', '7.2'],
            },
          ],
          scannedSecrets: 2,
          violations: [],
          recommendations: [
            'Implement MFA for all secret access operations',
            'Add additional approvers to database rotation policy',
          ],
          lastScan: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          nextScan: new Date(Date.now() + 83 * 24 * 60 * 60 * 1000),
        },
      ],
    };

    displaySecretDetectionConfig(finalConfig);

    await writeSecretDetectionFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: secret-detection-${providers.join('.tf, secret-detection-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'secret-detection-manager.ts' : 'secret_detection_manager.py'}`));
    console.log(chalk.green('✅ Generated: SECRET_DETECTION.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: secret-detection-config.json\n'));

    console.log(chalk.green('✓ Secret detection and management project configured successfully!'));
  }));

}
