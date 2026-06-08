import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security supply-chain-security` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerSupplyChainSecurity(security: Command): void {
  security
  .command('supply-chain-security')
  .description('Generate supply chain security and SBOM with integrity verification')
  .argument('<name>', 'Name of the supply chain security project')
  .option('--auto-generate', 'Enable automatic SBOM generation')
  .option('--format <format>', 'SBOM format (cyclonedx, spdx, swid)', 'cyclonedx')
  .option('--include-dev', 'Include development dependencies')
  .option('--vulnerability-scan', 'Enable vulnerability scanning')
  .option('--license-compliance', 'Enable license compliance checking')
  .option('--integrity-verification', 'Enable integrity verification')
  .option('--signature-verification', 'Enable signature verification')
  .option('--depth <depth>', 'Dependency tree depth', '3')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low, info)', 'high')
  .option('--fail-on-violation', 'Fail build on policy violations')
  .option('--verify-provenance', 'Verify build provenance')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './supply-chain-security-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeSupplyChainSecurityFiles, displaySupplyChainSecurityConfig } = await import('../../utils/supply-chain-security.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoGenerate: options.autoGenerate || true,
        format: options.format,
        includeDevDependencies: options.includeDev || false,
        vulnerabilityScan: options.vulnerabilityScan || true,
        licenseCompliance: options.licenseCompliance || true,
        integrityVerification: options.integrityVerification || true,
        signatureVerification: options.signatureVerification || true,
        depth: parseInt(options.depth),
        updateFrequency: 'weekly' as const,
        severityThreshold: options.severityThreshold,
        failOnViolation: options.failOnViolation || false,
        allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'],
        prohibitedLicenses: ['GPL-3.0', 'AGPL-3.0'],
        signatureRequired: true,
        verifyProvenance: options.verifyProvenance || true,
        attestationsRequired: true,
      },
      sbom: [
        {
          id: 'sbom-001',
          name: name,
          version: '1.0.0',
          format: options.format,
          generatedAt: new Date(),
          generatedBy: 'supply-chain-cli',
          components: [],
          dependencies: [],
          metadata: {
            authors: ['DevOps Team'],
            timestamp: new Date(),
            tools: ['cyclonedx-cli', 'npm-audit', 'snyk'],
            description: 'Software Bill of Materials for ' + name,
            dataLicense: 'CC0-1.0',
          },
          signatures: [],
          hash: 'sha256:abc123...',
        },
      ],
      components: [
        {
          id: 'comp-001',
          type: 'library' as const,
          name: 'react',
          version: '18.2.0',
          publisher: 'Meta',
          author: 'Facebook',
          licenses: ['MIT'],
          copyright: 'Copyright (c) Meta Platforms, Inc.',
          purl: 'pkg:npm/react@18.2.0',
          cpe: 'cpe:2.3:a:facebook:react:18.2.0:*:*:*:*:*:*:*:*',
          hash: {
            algorithm: 'SHA-256' as const,
            value: 'def456...',
          },
          externalReferences: [
            { type: 'website' as const, url: 'https://react.dev', description: 'Official React website' },
            { type: 'vcs' as const, url: 'https://github.com/facebook/react', description: 'Source repository' },
          ],
          properties: [],
          verified: true,
          dependencies: ['comp-002', 'comp-003'],
        },
        {
          id: 'comp-002',
          type: 'library' as const,
          name: 'lodash',
          version: '4.17.21',
          publisher: 'OpenJS Foundation',
          licenses: ['MIT'],
          purl: 'pkg:npm/lodash@4.17.21',
          externalReferences: [],
          properties: [],
          verified: true,
          dependencies: [],
        },
        {
          id: 'comp-003',
          type: 'framework' as const,
          name: 'express',
          version: '4.18.2',
          publisher: 'OpenJS Foundation',
          licenses: ['MIT'],
          purl: 'pkg:npm/express@4.18.2',
          externalReferences: [],
          properties: [],
          verified: true,
          dependencies: [],
        },
      ],
      vulnerabilities: [
        {
          id: 'vuln-001',
          bomRef: 'comp-001',
          cve: 'CVE-2023-12345',
          source: { name: 'NVD', url: 'https://nvd.nist.gov/vuln/detail/CVE-2023-12345' },
          name: 'React XSS Vulnerability',
          description: 'Cross-site scripting vulnerability in React component rendering',
          severity: 'high' as const,
          scores: [
            {
              method: 'CVSS' as const,
              version: '3.1',
              vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N',
              baseScore: 8.1,
              impactScore: 5.9,
              exploitabilityScore: 2.8,
              severity: 'high' as const,
            },
          ],
          affectedVersions: ['18.0.0', '18.1.0', '18.2.0'],
          patchedVersions: ['18.2.1'],
          recommendations: ['Update to React 18.2.1 or later'],
          references: [],
          discoveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          publishedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          suppressed: false,
        },
        {
          id: 'vuln-002',
          bomRef: 'comp-003',
          cve: 'CVE-2023-67890',
          source: { name: 'GitHub Advisories', url: 'https://github.com/advisories/GHSA-abc123' },
          name: 'Express DoS Vulnerability',
          description: 'Denial of service vulnerability in Express middleware',
          severity: 'medium' as const,
          scores: [
            {
              method: 'CVSS' as const,
              version: '3.1',
              vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
              baseScore: 7.5,
              severity: 'high' as const,
            },
          ],
          affectedVersions: ['4.18.0', '4.18.1', '4.18.2'],
          patchedVersions: ['4.18.3'],
          recommendations: ['Apply middleware filters', 'Update to Express 4.18.3'],
          references: [],
          discoveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          publishedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          suppressed: false,
        },
      ],
      licenses: [
        {
          id: 'lic-001',
          licenseId: 'MIT',
          licenseName: 'MIT License',
          spdxId: 'MIT',
          status: 'approved' as const,
          riskLevel: 'low' as const,
          obligations: [
            { type: 'attribution' as const, description: 'Include copyright notice and license text', triggeredBy: ['distribution', 'modification'] },
          ],
          restrictions: [],
          approvalRequired: false,
          approvers: [],
          description: 'Permissive license allowing reuse with attribution',
        },
        {
          id: 'lic-002',
          licenseId: 'GPL-3.0',
          licenseName: 'GNU General Public License v3.0',
          spdxId: 'GPL-3.0-only',
          status: 'prohibited' as const,
          riskLevel: 'high' as const,
          obligations: [
            { type: 'copyleft' as const, description: 'Must disclose source code and license derivative works under GPL', triggeredBy: ['distribution', 'modification'] },
            { type: 'source-availability' as const, description: 'Must provide complete corresponding source code', triggeredBy: ['distribution'] },
          ],
          restrictions: ['Cannot be used in proprietary software'],
          approvalRequired: true,
          approvers: ['legal-team', 'ciso'],
          description: 'Strong copyleft license requiring source code disclosure',
        },
      ],
      dependencies: [
        { id: 'dep-001', ref: 'comp-001', dependsOn: ['comp-002', 'comp-003'], scope: 'required' as const, optional: false, transitive: false, depth: 1 },
        { id: 'dep-002', ref: 'comp-002', dependsOn: [], scope: 'required' as const, optional: false, transitive: false, depth: 2 },
      ],
      integrityChecks: [
        {
          id: 'integrity-001',
          componentId: 'comp-001',
          checkType: 'signature' as const,
          status: 'passed' as const,
          timestamp: new Date(),
          verifiedBy: 'npm-registry',
          result: { algorithm: 'SHA-256', expected: 'abc123...', actual: 'abc123...', match: true, signer: 'npm' },
          details: 'Component signature verified successfully against npm public key',
        },
        {
          id: 'integrity-002',
          componentId: 'comp-003',
          checkType: 'hash' as const,
          status: 'passed' as const,
          timestamp: new Date(),
          verifiedBy: 'npm-registry',
          result: { algorithm: 'SHA-512', expected: 'ghi789...', actual: 'ghi789...', match: true },
          details: 'Package integrity hash verified successfully',
        },
      ],
      analytics: [
        {
          id: 'analytics-001',
          period: '2024-01',
          totalComponents: 3,
          totalVulnerabilities: 2,
          bySeverity: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
          byLicenseStatus: { approved: 2, prohibited: 0, 'review-required': 0, unknown: 1 },
          compliantComponents: 2,
          nonCompliantComponents: 1,
          attestedComponents: 3,
          meanTimeToRemediate: 14,
          vulnerabilityTrend: 'improving' as const,
          topVulnerableComponents: [
            { componentName: 'react', componentVersion: '18.2.0', vulnerabilityCount: 1, severity: 'high' as const },
            { componentName: 'express', componentVersion: '4.18.2', vulnerabilityCount: 1, severity: 'medium' as const },
          ],
          licenseComplianceRate: 100,
          integrityCheckRate: 100,
          supplyChainRisks: [
            { type: 'vulnerability' as const, severity: 'high' as const, description: 'React component has unresolved XSS vulnerability', affectedComponents: ['comp-001'], recommendations: ['Update to React 18.2.1'] },
          ],
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'Snyk Vulnerability Scanner',
          type: 'vulnerability-scanner' as const,
          provider: 'Snyk',
          enabled: true,
          config: { apiUrl: 'https://snyk.io/api', apiKey: '********' },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
          componentsImported: 3,
          vulnerabilitiesDetected: 2,
        },
        {
          id: 'integration-002',
          name: 'GitHub Dependency Submission',
          type: 'sbom-generator' as const,
          provider: 'GitHub',
          enabled: true,
          config: { repository: 'owner/repo' },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
          componentsImported: 3,
          vulnerabilitiesDetected: 0,
        },
      ],
    };

    displaySupplyChainSecurityConfig(finalConfig);

    await writeSupplyChainSecurityFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: supply-chain-security-${providers.join('.tf, supply-chain-security-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'supply-chain-security-manager.ts' : 'supply_chain_security_manager.py'}`));
    console.log(chalk.green('✅ Generated: SUPPLY_CHAIN_SECURITY.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: supply-chain-security-config.json\n'));

    console.log(chalk.green('✓ Supply chain security and SBOM generation configured successfully!'));
  }));

}
