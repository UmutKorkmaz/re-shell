import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import * as crypto from 'crypto';
import chalk from 'chalk';

/**
 * Registers the `security audit` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerAudit(security: Command): void {
  security
  .command('audit')
  .description('Generate comprehensive audit trail and tamper-proof logging system')
  .argument('<name>', 'Name of the audit project')
  .option('--tamper-proof', 'Enable tamper-proof logging')
  .option('--hash-algo <algorithm>', 'Hash algorithm (sha256, sha384, sha512, blake2b, blake2s)', 'sha256')
  .option('--signature-type <type>', 'Signature type (hmac, digital, blockchain, none)', 'hmac')
  .option('--signing-key <key>', 'Signing key for HMAC')
  .option('--enable-blockchain', 'Enable blockchain-based integrity')
  .option('--real-time-signing', 'Enable real-time signing')
  .option('--signing-interval <seconds>', 'Signing interval in seconds', '60')
  .option('--enable-encryption', 'Enable log encryption')
  .option('--enable-compression', 'Enable log compression')
  .option('--compression-level <level>', 'Compression level (0-9)', '6')
  .option('--log-format <format>', 'Log format (json, csv, plaintext, cef)', 'json')
  .option('--retention <period>', 'Retention period (7-days, 30-days, 90-days, 180-days, 365-days, 7-years, permanent)', '365-days')
  .option('--archive-location <path>', 'Archive location', '/archive/logs')
  .option('--enable-indexing', 'Enable log indexing')
  .option('--index-fields <fields>', 'Comma-separated index fields', 'timestamp,eventType,severity,source,userId,resource')
  .option('--enable-search', 'Enable log search')
  .option('--enable-anomaly-detection', 'Enable anomaly detection')
  .option('--anomaly-threshold <threshold>', 'Anomaly threshold (0-100)', '75')
  .option('--enable-backup', 'Enable log backup')
  .option('--backup-location <path>', 'Backup location', '/backup/logs')
  .option('--backup-interval <hours>', 'Backup interval in hours', '24')
  .option('--compliance-level <level>', 'Compliance level (basic, standard, enhanced, sox, hipaa, pci-dss, gdpr)', 'standard')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './audit-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeAuditFiles, displayAuditConfig } = await import('../../utils/audit-trail.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        enableTamperProof: options.tamperProof || true,
        hashAlgorithm: options.hashAlgo,
        signatureType: options.signatureType,
        signatureKey: options.signingKey,
        enableBlockchain: options.enableBlockchain || false,
        blockchainProvider: options.enableBlockchain ? ('ethereum' as const) : undefined,
        enableRealTimeSigning: options.realTimeSigning || true,
        signingInterval: parseInt(options.signingInterval),
        enableEncryption: options.enableEncryption || true,
        encryptionKey: undefined,
        enableCompression: options.enableCompression || false,
        compressionLevel: parseInt(options.compressionLevel),
        logFormat: options.logFormat,
        retentionPeriod: options.retention,
        archiveLocation: options.archiveLocation,
        enableArchiveEncryption: true,
        enableIndexing: options.enableIndexing || false,
        indexFields: options.indexFields.split(','),
        enableSearch: options.enableSearch || false,
        enableAggregation: true,
        aggregationInterval: 15,
        enableAnomalyDetection: options.enableAnomalyDetection || false,
        anomalyThreshold: parseInt(options.anomalyThreshold),
        enableForwarding: false,
        forwardTargets: [],
        enableBackup: options.enableBackup || true,
        backupLocation: options.backupLocation,
        backupInterval: parseInt(options.backupInterval),
      },
      logSources: [
        {
          id: 'source-app',
          name: 'Application Logs',
          type: 'application' as const,
          enabled: true,
          priority: 1,
          source: '/var/log/app',
          format: 'json' as const,
          filters: [],
        },
        {
          id: 'source-system',
          name: 'System Logs',
          type: 'system' as const,
          enabled: true,
          priority: 2,
          source: '/var/log/system',
          format: 'plaintext' as const,
          filters: [
            { field: 'severity', operator: 'equals' as const, value: 'info', caseSensitive: false },
          ],
        },
        {
          id: 'source-network',
          name: 'Network Logs',
          type: 'network' as const,
          enabled: true,
          priority: 3,
          source: '/var/log/network',
          format: 'json' as const,
          filters: [],
        },
        {
          id: 'source-api',
          name: 'API Gateway Logs',
          type: 'api' as const,
          enabled: true,
          priority: 1,
          source: '/var/log/api',
          format: 'json' as const,
          retentionOverride: '7-years' as const,
          filters: [],
        },
        {
          id: 'source-database',
          name: 'Database Audit Logs',
          type: 'database' as const,
          enabled: true,
          priority: 1,
          source: '/var/log/database',
          format: 'json' as const,
          retentionOverride: '7-years' as const,
          filters: [],
        },
      ],
      eventTypes: [
        'user-login' as const,
        'user-logout' as const,
        'permission-granted' as const,
        'permission-revoked' as const,
        'data-access' as const,
        'data-modified' as const,
        'data-deleted' as const,
        'config-change' as const,
        'policy-violation' as const,
        'system-start' as const,
        'system-stop' as const,
        'api-call' as const,
      ],
      retentionPolicies: [
        {
          id: 'policy-security',
          name: 'Security Events Retention',
          description: 'Extended retention for security-related events',
          eventType: 'policy-violation' as const,
          retention: '7-years' as const,
          complianceRequirements: ['SOX', 'HIPAA', 'PCI-DSS'],
          archiveAfter: 30,
          deleteAfter: 2555,
          conditions: [],
          enabled: true,
        },
        {
          id: 'policy-standard',
          name: 'Standard Events Retention',
          description: 'Standard retention for most audit events',
          eventType: 'all' as const,
          retention: '365-days' as const,
          complianceRequirements: ['ISO-27001'],
          archiveAfter: 90,
          deleteAfter: 365,
          conditions: [],
          enabled: true,
        },
      ],
      auditLogs: [
        {
          id: 'audit-001',
          timestamp: new Date(Date.now() - 3600 * 1000),
          eventType: 'user-login' as const,
          severity: 'info' as const,
          source: 'source-app',
          userId: 'user-admin-001',
          userName: 'admin',
          ipAddress: '10.0.1.100',
          userAgent: 'Mozilla/5.0',
          sessionId: 'sess-001',
          resource: '/system/login',
          resourceType: 'endpoint',
          action: 'login',
          outcome: 'success' as const,
          details: { method: 'password', mfa: true },
          complianceTags: ['SOX', 'ISO-27001'],
          correlationId: 'corr-001',
          hash: crypto.createHash('sha256').update('audit-001').digest('hex'),
          signature: crypto.createHmac('sha256', 'default-key').update('audit-001').digest('hex'),
          previousHash: crypto.createHash('sha256').update('genesis').digest('hex'),
          status: 'active' as const,
          retentionDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          archived: false,
        },
        {
          id: 'audit-002',
          timestamp: new Date(Date.now() - 1800 * 1000),
          eventType: 'data-access' as const,
          severity: 'low' as const,
          source: 'source-api',
          userId: 'user-admin-001',
          userName: 'admin',
          ipAddress: '10.0.1.100',
          userAgent: 'Mozilla/5.0',
          sessionId: 'sess-001',
          resource: '/api/users',
          resourceType: 'api',
          action: 'read',
          outcome: 'success' as const,
          details: { recordCount: 10 },
          complianceTags: ['GDPR'],
          correlationId: 'corr-002',
          hash: crypto.createHash('sha256').update('audit-002').digest('hex'),
          signature: crypto.createHmac('sha256', 'default-key').update('audit-002').digest('hex'),
          previousHash: crypto.createHash('sha256').update('audit-001').digest('hex'),
          status: 'active' as const,
          archived: false,
        },
        {
          id: 'audit-003',
          timestamp: new Date(Date.now() - 900 * 1000),
          eventType: 'policy-violation' as const,
          severity: 'high' as const,
          source: 'source-network',
          ipAddress: '192.168.1.50',
          resource: '/admin/config',
          resourceType: 'endpoint',
          action: 'unauthorized-access',
          outcome: 'failure' as const,
          details: { blocked: true, reason: 'IP not in whitelist' },
          complianceTags: ['SOX', 'PCI-DSS'],
          correlationId: 'corr-003',
          hash: crypto.createHash('sha256').update('audit-003').digest('hex'),
          signature: crypto.createHmac('sha256', 'default-key').update('audit-003').digest('hex'),
          previousHash: crypto.createHash('sha256').update('audit-002').digest('hex'),
          status: 'active' as const,
          archived: false,
        },
        {
          id: 'audit-004',
          timestamp: new Date(Date.now() - 300 * 1000),
          eventType: 'permission-granted' as const,
          severity: 'medium' as const,
          source: 'source-app',
          userId: 'user-admin-001',
          userName: 'admin',
          ipAddress: '10.0.1.100',
          resource: '/users/user-dev-001',
          resourceType: 'user',
          action: 'grant-role',
          outcome: 'success' as const,
          details: { role: 'developer', grantedBy: 'admin' },
          complianceTags: ['SOX', 'ISO-27001'],
          correlationId: 'corr-004',
          hash: crypto.createHash('sha256').update('audit-004').digest('hex'),
          signature: crypto.createHmac('sha256', 'default-key').update('audit-004').digest('hex'),
          previousHash: crypto.createHash('sha256').update('audit-003').digest('hex'),
          status: 'active' as const,
          archived: false,
        },
      ],
      integrityChecks: [
        {
          id: 'check-001',
          timestamp: new Date(Date.now() - 300 * 1000),
          logRange: {
            start: new Date(Date.now() - 3600 * 1000),
            end: new Date(),
          },
          hash: crypto.createHash('sha256').update('check-001').digest('hex'),
          previousHash: crypto.createHash('sha256').update('genesis').digest('hex'),
          verified: true,
          discrepancies: [],
          checkedBy: 'system',
          checkMethod: 'hash-verify' as const,
          result: 'passed' as const,
        },
      ],
      alerts: [
        {
          id: 'alert-001',
          name: 'Critical Policy Violation Alert',
          description: 'Alert on critical security policy violations',
          enabled: true,
          conditions: [
            { type: 'event-type' as const, operator: 'equals', value: 'policy-violation' },
            { type: 'severity' as const, field: 'severity', operator: 'equals', value: 'critical' },
          ],
          actions: [
            { type: 'email' as const, target: 'security@company.com', config: {} },
            { type: 'slack' as const, target: '#security-alerts', config: {} },
          ],
          severity: 'critical' as const,
          throttle: 5,
          notificationChannels: ['email' as const, 'slack' as const],
        },
        {
          id: 'alert-002',
          name: 'Multiple Failed Logins Alert',
          description: 'Alert on multiple failed login attempts',
          enabled: true,
          conditions: [
            { type: 'event-type' as const, field: 'eventType', operator: 'equals', value: 'user-login' },
            { type: 'severity' as const, field: 'outcome', operator: 'equals', value: 'failure' },
            { type: 'frequency' as const, field: 'userId', operator: 'count', value: 5, timeWindow: 5 },
          ],
          actions: [
            { type: 'email' as const, target: 'security@company.com', config: {} },
          ],
          severity: 'high' as const,
          throttle: 15,
          notificationChannels: ['email'],
        },
      ],
      compliance: {
        level: options.complianceLevel,
        enabledFrameworks: ['sox' as const, 'hipaa' as const, 'pci-dss' as const, 'iso-27001' as const],
        requireImmutableLogs: true,
        requireChainOfCustody: true,
        requireTamperEvidence: true,
        minimumRetention: 2555,
        requireAuditTrailAccess: true,
        auditTrailAccessLog: true,
        requireLogReview: true,
        reviewInterval: 90,
        lastReviewDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        nextReviewDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        reviewers: ['ciso', 'compliance-officer', 'audit-manager'],
        generateComplianceReport: true,
        reportSchedule: 'quarterly' as const,
      },
    };

    displayAuditConfig(finalConfig);

    await writeAuditFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: audit-${providers.join('.tf, audit-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'audit-manager.ts' : 'audit_manager.py'}`));
    console.log(chalk.green('✅ Generated: AUDIT_TRAIL.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: audit-config.json\n'));

    console.log(chalk.green('✓ Comprehensive audit trail and tamper-proof logging configured successfully!'));
  }));

}
