import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security privacy` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerPrivacy(security: Command): void {
  security
  .command('privacy')
  .description('Generate data privacy and protection compliance with automated classification')
  .argument('<name>', 'Name of the privacy project')
  .option('--auto-classify', 'Enable automatic data classification')
  .option('--enable-discovery', 'Enable data discovery')
  .option('--enable-dlp', 'Enable data loss prevention')
  .option('--enable-encryption-rest', 'Enable encryption at rest')
  .option('--enable-encryption-transit', 'Enable encryption in transit')
  .option('--enable-anonymization', 'Enable data anonymization')
  .option('--enable-pseudonymization', 'Enable data pseudonymization')
  .option('--enable-consent-mgmt', 'Enable consent management')
  .option('--consent-expiry <days>', 'Consent expiry in days', '365')
  .option('--enable-right-access', 'Enable right of access')
  .option('--enable-right-erasure', 'Enable right to erasure')
  .option('--enable-right-portability', 'Enable right to portability')
  .option('--request-sla <days>', 'Subject request SLA in days', '30')
  .option('--enable-breach-detection', 'Enable breach detection')
  .option('--breach-notification <hours>', 'Breach notification in hours', '72')
  .option('--enable-data-mapping', 'Enable data mapping')
  .option('--enable-cross-border', 'Enable cross-border transfers')
  .option('--require-dpia', 'Require DPIA for high-risk processing')
  .option('--dpia-threshold <threshold>', 'DPIA risk threshold (0-100)', '70')
  .option('--enable-audit-logging', 'Enable privacy audit logging')
  .option('--classification-confidence <confidence>', 'Classification confidence (0-100)', '85')
  .option('--dlp-interval <hours>', 'DLP scan interval in hours', '24')
  .option('--enable-data-lineage', 'Enable data lineage tracking')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './privacy-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writePrivacyFiles, displayPrivacyConfig } = await import('../../utils/data-privacy.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        enableAutoClassification: options.autoClassify || true,
        enableDataDiscovery: options.enableDiscovery || false,
        enableDataLossPrevention: options.enableDlp || false,
        enableEncryptionAtRest: options.enableEncryptionRest || true,
        enableEncryptionInTransit: options.enableEncryptionTransit || true,
        enableAnonymization: options.enableAnonymization || false,
        enablePseudonymization: options.enablePseudonymization || false,
        enableConsentManagement: options.enableConsentMgmt || true,
        consentExpiryDays: parseInt(options.consentExpiry),
        enableRightAccess: options.enableRightAccess || true,
        enableRightErasure: options.enableRightErasure || true,
        enableRightPortability: options.enableRightPortability || true,
        requestSLADays: parseInt(options.requestSla),
        enableBreachDetection: options.enableBreachDetection || true,
        breachNotificationHours: parseInt(options.breachNotification),
        enableDataMapping: options.enableDataMapping || true,
        enableCrossBorderTransfer: options.enableCrossBorder || false,
        defaultDataOwner: 'dpo',
        defaultDataCustodian: 'it-ops',
        defaultRetentionYears: 7,
        requireDPIA: options.requireDpia || false,
        dpiaThresholdRisk: parseInt(options.dpiaThreshold),
        requireRecordsOfProcessing: true,
        enableAuditLogging: options.enableAuditLogging || true,
        enableAutomatedPolicies: true,
        classificationConfidence: parseInt(options.classificationConfidence),
        dlpScanInterval: parseInt(options.dlpInterval),
        enableDataLineage: options.enableDataLineage || false,
      },
      dataInventory: [
        {
          id: 'asset-001',
          name: 'Customer Database',
          description: 'Customer personal information',
          classification: 'confidential' as const,
          dataType: 'customer' as const,
          sensitivity: 75,
          location: 's3://confidential/customer-db',
          format: 'database',
          size: 10737418240,
          recordCount: 50000,
          owner: 'customer-success',
          custodian: 'db-admin',
          tags: ['customer', 'personal', 'gdpr'],
          regulations: ['gdpr' as const, 'ccpa' as const],
          piiFields: [
            { name: 'full_name', type: 'direct' as const, category: 'name' as const, masked: false, encrypted: true, tokenized: false },
            { name: 'email', type: 'direct' as const, category: 'email' as const, masked: false, encrypted: true, tokenized: false },
            { name: 'phone', type: 'direct' as const, category: 'phone' as const, masked: false, encrypted: true, tokenized: false },
            { name: 'address', type: 'direct' as const, category: 'address' as const, masked: false, encrypted: true, tokenized: false },
          ],
          encryptionRequired: true,
          encryptionStatus: 'encrypted' as const,
          accessControls: ['role-customer-support'],
          retentionPolicy: 'policy-001',
          backupEnabled: true,
          disasterRecoveryEnabled: true,
          dataLineage: [],
          discoveryDate: new Date('2024-01-01'),
          lastClassified: new Date(),
          nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          metadata: {
            creator: 'crm-system',
            source: 'web-form',
            purpose: 'customer-management',
            legalBasis: 'contract' as const,
            thirdPartyAccess: false,
            crossBorderTransfer: false,
            countriesInvolved: ['US'],
            automatedDecisionMaking: false,
            profiling: false,
            deidentified: false,
            riskScore: 75,
          },
        },
        {
          id: 'asset-002',
          name: 'Employee Records',
          description: 'Employee HR information',
          classification: 'confidential' as const,
          dataType: 'employee' as const,
          sensitivity: 85,
          location: 's3://confidential/employee-records',
          format: 'database',
          size: 209715200,
          recordCount: 500,
          owner: 'hr-director',
          custodian: 'hr-admin',
          tags: ['employee', 'hr', 'confidential'],
          regulations: ['gdpr' as const],
          piiFields: [
            { name: 'ssn', type: 'direct' as const, category: 'ssn' as const, masked: true, encrypted: true, tokenized: true },
            { name: 'salary', type: 'indirect' as const, category: 'financial' as const, masked: true, encrypted: true, tokenized: false },
            { name: 'performance_review', type: 'quasi' as const, category: 'custom' as const, masked: false, encrypted: true, tokenized: false },
          ],
          encryptionRequired: true,
          encryptionStatus: 'encrypted' as const,
          accessControls: ['role-hr', 'role-management'],
          retentionPolicy: 'policy-002',
          backupEnabled: true,
          disasterRecoveryEnabled: true,
          dataLineage: [],
          discoveryDate: new Date('2024-01-01'),
          lastClassified: new Date(),
          nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          metadata: {
            creator: 'hris',
            source: 'onboarding',
            purpose: 'hr-management',
            legalBasis: 'contract' as const,
            thirdPartyAccess: false,
            crossBorderTransfer: false,
            countriesInvolved: ['US'],
            automatedDecisionMaking: false,
            profiling: false,
            deidentified: false,
            riskScore: 85,
          },
        },
        {
          id: 'asset-003',
          name: 'Web Analytics',
          description: 'Website visitor analytics data',
          classification: 'internal' as const,
          dataType: 'personal' as const,
          sensitivity: 40,
          location: 's3://internal/analytics',
          format: 'parquet',
          size: 53687091200,
          recordCount: 1000000,
          owner: 'marketing',
          custodian: 'data-engineer',
          tags: ['analytics', 'marketing', 'pseudonymized'],
          regulations: ['gdpr' as const],
          piiFields: [
            { name: 'ip_address', type: 'indirect' as const, category: 'ip-address' as const, masked: true, encrypted: false, tokenized: true },
            { name: 'session_id', type: 'indirect' as const, category: 'custom' as const, masked: false, encrypted: false, tokenized: false },
          ],
          encryptionRequired: false,
          encryptionStatus: 'none' as const,
          accessControls: ['role-analytics'],
          backupEnabled: true,
          disasterRecoveryEnabled: false,
          dataLineage: [],
          discoveryDate: new Date('2024-01-01'),
          lastClassified: new Date(),
          nextReviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          metadata: {
            creator: 'analytics-platform',
            source: 'web-tracking',
            purpose: 'analytics',
            legalBasis: 'legitimate-interests' as const,
            legitimateInterest: 'Business analytics and optimization',
            thirdPartyAccess: false,
            crossBorderTransfer: false,
            countriesInvolved: ['US'],
            automatedDecisionMaking: true,
            profiling: true,
            anonymizationMethod: 'k-anonymity' as const,
            deidentified: true,
            riskScore: 40,
          },
        },
      ],
      classificationRules: [
        {
          id: 'rule-001',
          name: 'Detect SSN',
          description: 'Detect Social Security Numbers',
          priority: 1,
          enabled: true,
          conditions: [
            { type: 'pattern' as const, operator: 'regex' as const, value: '\\d{3}-\\d{2}-\\d{4}' },
          ],
          actions: [
            { type: 'classify' as const, classification: 'restricted' as const },
            { type: 'encrypt' as const },
            { type: 'restrict-access' as const, accessLevel: 'role-hr' },
          ],
          confidence: 95,
          falsePositiveRate: 1,
          lastTuned: new Date(),
        },
        {
          id: 'rule-002',
          name: 'Detect Credit Card',
          description: 'Detect Credit Card Numbers',
          priority: 1,
          enabled: true,
          conditions: [
            { type: 'pattern' as const, operator: 'regex' as const, value: '\\d{4}[ -]?\\d{4}[ -]?\\d{4}[ -]?\\d{4}' },
          ],
          actions: [
            { type: 'classify' as const, classification: 'critical' as const },
            { type: 'encrypt' as const },
            { type: 'restrict-access' as const, accessLevel: 'role-finance' },
            { type: 'alert' as const, notification: 'security@company.com' },
          ],
          confidence: 90,
          falsePositiveRate: 2,
          lastTuned: new Date(),
        },
      ],
      processingActivities: [
        {
          id: 'activity-001',
          name: 'Customer Onboarding',
          description: 'Processing new customer data during registration',
          purposes: ['account-creation', 'service-delivery'],
          dataCategories: ['personal', 'contact', 'preferences'],
          dataSubjects: ['subject-001'],
          dataTypes: ['customer' as const],
          legalBasis: 'contract' as const,
          dataSources: ['asset-001'],
          dataDestinations: ['crm-system'],
          thirdParties: [],
          crossBorderTransfer: false,
          transferCountries: [],
          safeguards: [],
          retentionPeriod: '7-years',
          deletionMechanism: 'secure-delete',
          securityMeasures: ['encryption', 'access-controls', 'audit-logging'],
          automatedDecisionMaking: false,
          dpiRequired: false,
          dpiCompleted: false,
          ropaStatus: 'active' as const,
          lastUpdated: new Date(),
          nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      ],
      dataSubjects: [
        {
          id: 'subject-001',
          type: 'customer' as const,
          identifier: 'customer-12345',
          identifiers: { email: 'customer@example.com', customerId: 'C12345' },
          preferences: {
            marketingOptIn: true,
            analyticsOptIn: true,
            thirdPartySharing: false,
            cookiePreferences: ['essential', 'analytics'],
            communicationChannels: ['email'],
          },
          consents: ['consent-001', 'consent-002'],
          requests: [],
          rightsExercised: ['access' as const],
          lastActivity: new Date(),
          created: new Date('2024-01-15'),
          dataLocation: 'asset-001',
          anonymized: false,
          metadata: {
            jurisdiction: 'US',
            primaryRegulation: 'ccpa' as const,
            specialCategory: false,
            childData: false,
            parentalConsent: false,
            employeeData: false,
          },
        },
      ],
      consentRecords: [
        {
          id: 'consent-001',
          subjectId: 'subject-001',
          subjectType: 'customer',
          purpose: 'marketing',
          legalBasis: 'consent' as const,
          consentGiven: true,
          givenAt: new Date('2024-01-15'),
          withdrawnAt: undefined,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          method: 'web-form' as const,
          documents: [
            { type: 'privacy-notice' as const, version: '1.0', acceptedAt: new Date('2024-01-15') },
          ],
          granularity: ['email-marketing', 'personalized-ads'],
          withdrawalMechanism: 'web-portal',
          revocable: true,
        },
      ],
      dataRequests: [],
      breachRecords: [],
      retentionPolicies: [
        {
          id: 'policy-001',
          name: 'Customer Data Retention',
          description: 'Retention policy for customer data',
          dataCategories: ['customer' as const],
          classification: ['confidential' as const],
          retentionPeriod: '7-years',
          retentionBasis: 'legal' as const,
          legalRequirements: ['SOX', 'Tax regulations'],
          archivalRequired: true,
          archivalPeriod: '10-years',
          deletionMethod: 'secure-delete' as const,
          deletionProcess: ['verify-retention', 'backup-archive', 'secure-wipe', 'verify-deletion', 'update-records'],
          exceptions: [],
          approvalRequired: false,
          approvers: [],
          lastReviewed: new Date(),
          nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      ],
      dpiaRecords: [],
      transfers: [],
    };

    displayPrivacyConfig(finalConfig);

    await writePrivacyFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: privacy-${providers.join('.tf, privacy-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'privacy-manager.ts' : 'privacy_manager.py'}`));
    console.log(chalk.green('✅ Generated: DATA_PRIVACY.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: privacy-config.json\n'));

    console.log(chalk.green('✓ Data privacy and protection compliance configured successfully!'));
  }));

}
