import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security zero-trust` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerZeroTrust(security: Command): void {
  security
  .command('zero-trust')
  .description('Generate zero-trust security model with identity verification')
  .argument('<name>', 'Name of the zero-trust project')
  .option('--trust-level <level>', 'Default trust level (zero-trust, low-trust, medium-trust, high-trust)', 'zero-trust')
  .option('--enforce-mfa', 'Enforce multi-factor authentication')
  .option('--require-device-verification', 'Require device verification')
  .option('--session-timeout <minutes>', 'Session timeout in minutes', '60')
  .option('--max-failed-attempts <count>', 'Max failed login attempts', '5')
  .option('--lockout-duration <minutes>', 'Account lockout duration', '30')
  .option('--risk-assessment', 'Enable risk assessment')
  .option('--adaptive-auth', 'Enable adaptive authentication')
  .option('--continuous-verification', 'Enable continuous verification')
  .option('--anomaly-detection', 'Enable anomaly detection')
  .option('--allow-public-networks', 'Allow access from public networks')
  .option('--require-vpn', 'Require VPN for access')
  .option('--geo-policy', 'Enable geolocation policy')
  .option('--velocity-check', 'Enable impossible travel detection')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './zero-trust-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeZeroTrustFiles, displayZeroTrustConfig } = await import('../../utils/zero-trust-security.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      trustSettings: {
        enabled: true,
        defaultTrustLevel: options.trustLevel,
        enforceMFA: options.enforceMfa || true,
        requireDeviceVerification: options.requireDeviceVerification || true,
        sessionTimeout: parseInt(options.sessionTimeout),
        mfaTimeout: 5,
        maxFailedAttempts: parseInt(options.maxFailedAttempts),
        lockoutDuration: parseInt(options.lockoutDuration),
        passwordPolicy: {
          minLength: 12,
          maxLength: 128,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          preventCommonPasswords: true,
          preventUserInfo: true,
          expirationDays: 90,
          historyCount: 12,
          minUniqueChars: 8,
        },
        devicePolicy: {
          requireTrustedDevice: true,
          allowUnregisteredDevices: false,
          deviceRegistrationRequired: true,
          osVersions: {
            windows: '10',
            macos: '10.15',
            ios: '13',
            android: '10',
          },
          requireEncryption: true,
          requireScreenLock: true,
          allowRootedDevices: false,
          allowEmulators: false,
          maxDevicesPerUser: 5,
          deviceCertification: 'managed' as const,
        },
        networkPolicy: {
          allowPublicNetworks: options.allowPublicNetworks || false,
          allowedNetworks: [],
          deniedNetworks: [],
          requireVPN: options.requireVpn || true,
          allowedLocations: [],
          deniedLocations: [],
          ipWhitelist: [],
          ipBlacklist: [],
        },
        geoPolicy: {
          enabled: options.geoPolicy || false,
          allowedCountries: ['US', 'CA', 'GB'],
          deniedCountries: [],
          allowedRegions: [],
          deniedRegions: [],
          velocityCheck: options.velocityCheck || true,
          maxTravelSpeed: 800, // km/h
        },
        riskAssessment: options.riskAssessment || true,
        adaptiveAuthentication: options.adaptiveAuth || true,
        continuousVerification: options.continuousVerification || true,
        anomalyDetection: options.anomalyDetection || true,
        behavioralAnalysis: true,
      },
      identities: [
        {
          id: 'identity-001',
          username: 'john.doe',
          email: 'john.doe@example.com',
          type: 'user' as const,
          provider: 'okta' as const,
          status: 'active' as const,
          trustLevel: 'high-trust' as const,
          mfaEnabled: true,
          mfaMethods: ['mfa' as const, 'push-notification' as const],
          groups: ['developers', 'admins'],
          roles: ['developer', 'code-reviewer'],
          attributes: {
            department: 'Engineering',
            location: 'US',
          },
          devices: [
            {
              id: 'device-001',
              name: 'MacBook Pro',
              type: 'laptop' as const,
              platform: 'macos' as const,
              osVersion: '14.0',
              trusted: true,
              managed: true,
              encrypted: true,
              rooted: false,
              emulator: false,
              lastSeen: new Date(),
              firstSeen: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
              ip: '192.168.1.100',
              location: 'San Francisco, CA',
            },
          ],
          lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastVerified: new Date(Date.now() - 2 * 60 * 60 * 1000),
          failedAttempts: 0,
          createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ],
      policies: [],
      sessions: [
        {
          id: 'session-001',
          identityId: 'identity-001',
          type: 'interactive' as const,
          trustLevel: 'high-trust' as const,
          startTime: new Date(Date.now() - 30 * 60 * 1000),
          lastActivity: new Date(Date.now() - 5 * 60 * 1000),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          ip: '192.168.1.100',
          location: 'San Francisco, CA',
          device: 'device-001',
          userAgent: 'Mozilla/5.0',
          mfaVerified: true,
          continuousVerification: true,
          verificationCount: 3,
          status: 'active' as const,
        },
      ],
      trustScores: [
        {
          id: 'score-001',
          identityId: 'identity-001',
          sessionId: 'session-001',
          score: 85,
          riskLevel: 'low' as const,
          factors: [
            {
              name: 'MFA Enabled',
              weight: 20,
              score: 100,
              description: 'User has MFA enabled',
              mitigated: true,
            },
            {
              name: 'Trusted Device',
              weight: 15,
              score: 100,
              description: 'Using trusted device',
              mitigated: true,
            },
          ],
          calculatedAt: new Date(Date.now() - 5 * 60 * 1000),
          expiresAt: new Date(Date.now() + 55 * 60 * 1000),
        },
      ],
      verifications: [
        {
          id: 'verify-001',
          identityId: 'identity-001',
          sessionId: 'session-001',
          type: 'mfa' as const,
          method: 'push-notification' as const,
          status: 'approved' as const,
          initiatedAt: new Date(Date.now() - 30 * 60 * 1000),
          completedAt: new Date(Date.now() - 30 * 60 * 1000 + 30000),
          expiresAt: new Date(Date.now() - 30 * 60 * 1000 + 300000),
          ipAddress: '192.168.1.100',
          location: 'San Francisco, CA',
          device: 'device-001',
          trustLevel: 'high-trust' as const,
          metadata: {},
        },
      ],
      complianceReports: [
        {
          id: 'report-001',
          name: 'NIST 800-207 Zero Trust Architecture',
          framework: 'nist-800-207' as const,
          status: 'compliant' as const,
          score: 92,
          requirements: [
            {
              id: 'req-1',
              name: 'Identity Verification',
              description: 'Verify identity for all access requests',
              status: 'compliant' as const,
              severity: 'critical' as const,
              controls: ['SC-8', 'IA-2'],
              evidence: ['MFA enabled', 'Identity verification implemented'],
            },
          ],
          gaps: [],
          recommendations: ['Enhance behavioral analysis'],
          generatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'Okta SSO',
          type: 'sso' as const,
          provider: 'okta' as const,
          enabled: true,
          config: {
            domain: 'dev-123456.okta.com',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 5 * 60 * 1000),
        },
      ],
    };

    displayZeroTrustConfig(finalConfig);

    await writeZeroTrustFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: zero-trust-${providers.join('.tf, zero-trust-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'zero-trust-manager.ts' : 'zero_trust_manager.py'}`));
    console.log(chalk.green('✅ Generated: ZERO_TRUST.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: zero-trust-config.json\n'));

    console.log(chalk.green('✓ Zero-trust security model configured successfully!'));
  }));

}
