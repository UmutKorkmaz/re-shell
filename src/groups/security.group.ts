import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import * as crypto from 'crypto';
import chalk from 'chalk';

export function registerSecurityGroup(program: Command): void {
  const security = new Command('security')
    .description('Security, compliance, and governance commands');

  security
  .command('vulnerability-scan')
  .description('Generate dependency vulnerability scanning with Snyk and OWASP')
  .argument('<name>', 'Name of the vulnerability scanning project')
  .option('--frequency <frequency>', 'Scan frequency (on-commit, daily, weekly, monthly, on-demand)', 'weekly')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low, info)', 'medium')
  .option('--languages <languages>', 'Comma-separated languages to scan', 'javascript,typescript,python')
  .option('--package-managers <managers>', 'Comma-separated package managers', 'npm,yarn,pnpm,pip')
  .option('--scanners <scanners>', 'Comma-separated scanner tools (snyk,owasp,trivy,grype,safety,auditjs,npm-audit,yarn-audit)', 'snyk,owasp')
  .option('--auto-remediation', 'Enable automatic remediation')
  .option('--license-check', 'Enable license compliance checking')
  .option('--supply-chain-analysis', 'Enable supply chain analysis')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--fail-on-severity <severity>', 'Fail build on severity threshold', 'high')
  .option('--output <directory>', 'Output directory', './vulnerability-scan-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { dependencyVulnerabilityScanning, writeFiles, displayConfig } = await import('../utils/dependency-vulnerability-scanning.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    if (providers.length === 0) {
      providers.push('aws', 'azure', 'gcp');
    }

    const languages = options.languages.split(',') as ('javascript' | 'typescript' | 'python' | 'java' | 'go' | 'ruby' | 'php' | 'csharp' | 'rust' | 'cpp')[];
    const packageManagers = options.packageManagers.split(',') as ('npm' | 'yarn' | 'pnpm' | 'pip' | 'maven' | 'gradle' | 'go-modules' | 'bundler' | 'composer' | 'cargo' | 'nuget')[];
    const scanners = options.scanners.split(',') as ('snyk' | 'owasp' | 'trivy' | 'grype' | 'safety' | 'auditjs' | 'npm-audit' | 'yarn-audit' | 'custom')[];

    const config = {
      projectName: name,
      providers,
      scanSettings: {
        enabled: true,
        frequency: options.frequency as 'on-commit' | 'daily' | 'weekly' | 'monthly' | 'on-demand',
        languages,
        packageManagers,
        scanners,
        severityThreshold: options.severityThreshold as 'critical' | 'high' | 'medium' | 'low' | 'info',
        failOnThreshold: options.failOnSeverity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        autoRemediation: options.autoRemediation || false,
        devDependencies: true,
        transitiveDependencies: true,
        licenseCheck: options.licenseCheck || false,
        codeQualityCheck: false,
        supplyChainAnalysis: options.supplyChainAnalysis || false,
      },
      dependencies: [
        {
          id: 'dep-001',
          language: 'javascript' as const,
          packageManager: 'npm' as const,
          manifestFile: 'package.json',
          lockFile: 'package-lock.json',
          dependencies: [
            {
              name: 'lodash',
              version: '4.17.20',
              type: 'production' as const,
              transitive: false,
              depth: 0,
              licenses: ['MIT'],
              downloadUrl: 'https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz',
              homepage: 'https://lodash.com/',
              repository: 'https://github.com/lodash/lodash',
              author: 'John-David Dalton',
            },
            {
              name: 'express',
              version: '4.18.2',
              type: 'production' as const,
              transitive: false,
              depth: 0,
              licenses: ['MIT'],
              downloadUrl: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
              homepage: 'https://expressjs.com/',
              repository: 'https://github.com/expressjs/express',
              author: 'TJ Holowaychuk',
            },
          ],
          devDependencies: [
            {
              name: 'jest',
              version: '29.5.0',
              type: 'development' as const,
              transitive: false,
              depth: 0,
              licenses: ['MIT'],
              downloadUrl: 'https://registry.npmjs.org/jest/-/jest-29.5.0.tgz',
              homepage: 'https://jestjs.io/',
              repository: 'https://github.com/jestjs/jest',
              author: 'Facebook',
            },
          ],
          lastScanned: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          scanResults: [
            {
              scanId: 'scan-001',
              timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              scanner: 'snyk' as const,
              status: 'completed' as const,
              duration: 45,
              vulnerabilitiesFound: 2,
              vulnerabilities: [],
              summary: {
                total: 2,
                critical: 0,
                high: 1,
                medium: 1,
                low: 0,
                info: 0,
                score: 72,
                riskLevel: 'high' as const,
              },
              reportPath: './reports/scan-001.json',
            },
          ],
          totalDependencies: 3,
          vulnerableDependencies: 2,
          licenseCompliance: true,
        },
      ],
      vulnerabilities: [
        {
          id: 'vuln-001',
          vulnId: 'CVE-2024-1234',
          title: 'Prototype Pollution in lodash',
          description: 'Lodash versions before 4.17.21 are vulnerable to prototype pollution via the functions merge, mergeWith, and defaultsDeep. This can allow an attacker to modify the prototype of Object.prototype, leading to potential security issues.',
          severity: 'high' as const,
          score: 7.5,
          vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
          affectedPackages: [
            {
              name: 'lodash',
              version: '4.17.20',
              language: 'javascript' as const,
              packageManager: 'npm' as const,
              dependencyPath: ['app'],
              directDependency: true,
              fixAvailable: true,
              fixedVersion: '4.17.21',
            },
          ],
          publishedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          discoveredDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          status: 'detected' as const,
          priority: 'high' as const,
          references: [
            {
              type: 'cve' as const,
              url: 'https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-1234',
              title: 'CVE-2024-1234',
              source: 'MITRE',
            },
            {
              type: 'advisory' as const,
              url: 'https://github.com/lodash/lodash/security/advisories/GHSA-p6mc-m468-83gw',
              title: 'Prototype Pollution in lodash',
              source: 'GitHub',
            },
          ],
          exploitAvailable: true,
          exploitMaturity: 'functional' as const,
          inWild: false,
          patchedVersions: ['4.17.21', '4.17.20'],
          unaffectedVersions: [],
          remediation: [
            {
              type: 'upgrade' as const,
              recommendation: 'Upgrade to version 4.17.21 or later',
              targetVersion: '4.17.21',
              effort: 'trivial' as const,
              breakingChanges: false,
              confidence: 0.95,
            },
          ],
          labels: ['javascript', 'npm', 'prototype-pollution', 'cve'],
          notes: [
            'Low risk for our application as we do not use merge or mergeWith functions',
          ],
          assignedTo: 'Security Team',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          estimatedRemediationTime: 1,
        },
        {
          id: 'vuln-002',
          vulnId: 'CVE-2024-5678',
          title: 'Denial of Service in express',
          description: 'Express prior to 4.19.0 is vulnerable to Denial of Service due to incorrect handling of malformed HTTP headers. An attacker can exploit this vulnerability by sending specially crafted HTTP requests to the server.',
          severity: 'medium' as const,
          score: 5.3,
          vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L',
          affectedPackages: [
            {
              name: 'express',
              version: '4.18.2',
              language: 'javascript' as const,
              packageManager: 'npm' as const,
              dependencyPath: ['app'],
              directDependency: true,
              fixAvailable: true,
              fixedVersion: '4.19.0',
            },
          ],
          publishedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          discoveredDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          status: 'investigating' as const,
          priority: 'medium' as const,
          references: [
            {
              type: 'cve' as const,
              url: 'https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-5678',
              title: 'CVE-2024-5678',
              source: 'MITRE',
            },
          ],
          exploitAvailable: false,
          exploitMaturity: 'none' as const,
          inWild: false,
          patchedVersions: ['4.19.0', '4.18.3'],
          unaffectedVersions: [],
          remediation: [
            {
              type: 'upgrade' as const,
              recommendation: 'Upgrade to version 4.19.0 or later',
              targetVersion: '4.19.0',
              effort: 'easy' as const,
              breakingChanges: false,
              confidence: 0.9,
            },
          ],
          labels: ['javascript', 'npm', 'express', 'dos'],
          notes: [],
          assignedTo: 'Backend Team',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          estimatedRemediationTime: 2,
        },
      ],
      remediationPlans: [
        {
          id: 'plan-001',
          name: 'Fix lodash Prototype Pollution',
          description: 'Upgrade lodash to 4.17.21 to fix prototype pollution vulnerability',
          priority: 'high' as const,
          vulnerabilities: ['vuln-001'],
          dependencies: ['lodash'],
          steps: [
            {
              id: 'step-001',
              order: 1,
              action: 'Upgrade lodash',
              dependency: 'lodash',
              currentVersion: '4.17.20',
              targetVersion: '4.17.21',
              description: 'Update package.json and run npm install',
              commands: ['npm install lodash@4.17.21'],
              status: 'pending' as const,
            },
          ],
          status: 'pending' as const,
          estimatedTime: 1,
          createdBy: 'Security Team',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
      ],
      policies: [
        {
          id: 'policy-001',
          name: 'Critical Vulnerabilities Policy',
          description: 'Block builds with critical vulnerabilities',
          enabled: true,
          rules: [
            {
              id: 'rule-001',
              name: 'No critical vulnerabilities allowed',
              condition: 'severity === "critical"',
              severity: 'critical' as const,
              action: 'fail' as const,
              requireFix: true,
            },
          ],
          exceptions: [],
          enforcementLevel: 'block' as const,
          applyTo: ['**/package.json'],
        },
      ],
      integrations: [
        {
          tool: 'snyk' as const,
          enabled: true,
          apiKey: 'sk-***',
          config: { organization: 'my-org' },
          lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
          status: 'connected' as const,
        },
        {
          tool: 'owasp' as const,
          enabled: true,
          config: {},
          status: 'connected' as const,
        },
      ],
      notifications: [
        {
          type: 'slack' as const,
          enabled: true,
          severity: ['critical' as const, 'high' as const],
          recipients: ['#security-alerts'],
          template: 'vulnerability-alert',
        },
      ],
      reporting: {
        enabled: true,
        frequency: 'weekly' as const,
        formats: ['json' as const, 'html' as const],
        includeDetails: true,
        includeRemediation: true,
        trendAnalysis: true,
        recipients: ['security-team@example.com'],
      },
    };

    const finalConfig = dependencyVulnerabilityScanning(config);
    displayConfig(finalConfig);

    await writeFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: dependency-vulnerability-${providers.join('.tf, dependency-vulnerability-')}.tf`));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'vulnerability-scanner-manager.ts' : 'vulnerability_scanner_manager.py'}`));
    console.log(chalk.green(`✅ Generated: VULNERABILITY_SCANNING.md`));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green(`✅ Generated: dependency-vulnerability-config.json\n`));

    console.log(chalk.green('✓ Dependency vulnerability scanning project configured successfully!'));
  }));

  security
  .command('container-security')
  .description('Generate container security with Trivy and runtime protection')
  .argument('<name>', 'Name of the container security project')
  .option('--frequency <frequency>', 'Scan frequency (on-build, on-push, on-deploy, scheduled, on-demand)', 'scheduled')
  .option('--interval <cron>', 'Scan interval as cron expression', '0 2 * * *')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low, unknown)', 'high')
  .option('--scan-types <types>', 'Comma-separated scan types (image,filesystem,repository,config,runtime)', 'image,runtime')
  .option('--runtime-protection', 'Enable runtime protection')
  .option('--behavioral-analysis', 'Enable behavioral analysis')
  .option('--auto-remediation', 'Enable automatic remediation')
  .option('--quarantine-vulnerable', 'Quarantine vulnerable containers')
  .option('--license-check', 'Enable license checking')
  .option('--secrets-check', 'Enable secrets detection')
  .option('--misconfig-check', 'Enable misconfiguration detection')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './container-security-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { containerSecurity, writeFiles, displayConfig } = await import('../utils/container-security.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    if (providers.length === 0) {
      providers.push('aws', 'azure', 'gcp');
    }

    const scanTypes = options.scanTypes.split(',') as ('image' | 'filesystem' | 'repository' | 'config' | 'runtime')[];

    const config = {
      projectName: name,
      providers,
      scanSettings: {
        enabled: true,
        frequency: options.frequency as 'on-build' | 'on-push' | 'on-deploy' | 'scheduled' | 'on-demand',
        interval: options.interval,
        scanTypes,
        severityThreshold: options.severityThreshold as 'critical' | 'high' | 'medium' | 'low' | 'unknown',
        failOnThreshold: options.severityThreshold as 'critical' | 'high' | 'medium' | 'low' | 'unknown',
        scanBaseImage: true,
        scanLayers: true,
        licenseCheck: options.licenseCheck || false,
        secretsCheck: options.secretsCheck || false,
        misconfigCheck: options.misconfigCheck || false,
        runtimeProtection: options.runtimeProtection || false,
        behavioralAnalysis: options.behavioralAnalysis || false,
        autoRemediation: options.autoRemediation || false,
        quarantineVulnerable: options.quarantineVulnerable || false,
      },
      containers: [
        {
          id: 'container-001',
          name: 'web-app',
          runtime: 'docker' as const,
          orchestration: 'kubernetes' as const,
          namespace: 'production',
          containers: [
            {
              id: 'cont-001',
              name: 'nginx',
              imageId: 'sha256:abc123',
              imageTag: 'nginx:1.21',
              imageDigest: 'sha256:abc123def456',
              state: 'running' as const,
              pid: 1234,
              created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              started: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              resources: {
                cpu: { limit: '2', request: '1', usagePercent: 45, throttling: false },
                memory: { limit: '4Gi', request: '2Gi', usagePercent: 62, oomKills: 0 },
                network: {
                  interfaces: [
                    { name: 'eth0', rxBytes: 1048576, txBytes: 524288, rxPackets: 10000, txPackets: 5000, errors: 0 },
                  ],
                  totalBytesIn: 1048576,
                  totalBytesOut: 524288,
                  connections: 15,
                },
                storage: { size: '10Gi', used: '2Gi', usagePercent: 20, readOnly: false },
              },
              mounts: [],
              ports: [
                { containerPort: 80, hostPort: 80, protocol: 'tcp' as const },
                { containerPort: 443, hostPort: 443, protocol: 'tcp' as const },
              ],
              envVars: { NODE_ENV: 'production', PORT: '80' },
              capabilities: [],
              privileged: false,
              readOnlyRoot: false,
              securityContext: {
                user: 0,
                group: 0,
                fsGroup: 0,
                seLinuxOptions: {},
                runAsNonRoot: false,
                allowPrivilegeEscalation: true,
                readOnlyRootFilesystem: false,
              },
            },
          ],
          labels: { app: 'web', tier: 'frontend' },
          annotations: {},
          lastScanned: new Date(Date.now() - 1 * 60 * 60 * 1000),
          scanResults: [],
          securityPosture: 'secure' as const,
        },
      ],
      images: [
        {
          id: 'image-001',
          name: 'nginx',
          tag: '1.21',
          digest: 'sha256:abc123',
          registry: 'docker.io',
          size: 133727744,
          layers: [
            {
              digest: 'sha256:abc123',
              size: 66758880,
              command: '/bin/sh -c #(nop) ADD file:...',
              vulnerabilities: [],
            },
          ],
          os: 'linux',
          architecture: 'amd64',
          created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          author: 'NGINX Maintainers',
          history: [],
          config: {
            env: {},
            cmd: ['nginx', '-g', 'daemon off;'],
            entrypoint: [],
            workingDir: '/',
            user: '0',
            exposedPorts: [80, 443],
            labels: {},
            volumes: [],
          },
          vulnerabilities: [],
          secrets: [],
          misconfigurations: [],
          lastScanned: new Date(Date.now() - 1 * 60 * 60 * 1000),
          scanScore: 85,
          compliance: {
            cisLevel: 1,
            score: 85,
            passed: 12,
            failed: 2,
            skipped: 1,
            checks: [],
          },
        },
      ],
      vulnerabilities: [],
      behavioralAnalysis: [],
      securityPolicies: [
        {
          id: 'policy-001',
          name: 'Block Critical Vulnerabilities',
          description: 'Block containers with critical vulnerabilities',
          enabled: true,
          scope: [
            { type: 'image' as const, value: '**' },
          ],
          rules: [
            {
              id: 'rule-001',
              name: 'No critical vulnerabilities',
              condition: 'severity === "critical"',
              severity: 'critical' as const,
              action: 'block' as const,
              parameters: {},
            },
          ],
          exceptions: [],
          enforcementLevel: 'block' as const,
        },
      ],
      complianceChecks: [],
      alerts: [],
      integrations: [
        {
          tool: 'trivy' as const,
          enabled: true,
          config: { severity: 'HIGH,CRITICAL' },
          status: 'connected' as const,
        },
        {
          tool: 'falco' as const,
          enabled: true,
          config: {},
          status: 'connected' as const,
        },
      ],
    };

    const finalConfig = containerSecurity(config);
    displayConfig(finalConfig);

    await writeFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: container-security-${providers.join('.tf, container-security-')}.tf`));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'container-security-manager.ts' : 'container_security_manager.py'}`));
    console.log(chalk.green(`✅ Generated: CONTAINER_SECURITY.md`));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green(`✅ Generated: container-security-config.json\n`));

    console.log(chalk.green('✓ Container security project configured successfully!'));
  }));

  security
  .command('code-security')
  .description('Generate code security analysis with SonarQube and AI enhancement')
  .argument('<name>', 'Name of the code security project')
  .option('--frequency <frequency>', 'Analysis frequency (on-commit, on-push, scheduled, manual)', 'scheduled')
  .option('--languages <languages>', 'Comma-separated languages to analyze', 'typescript,javascript,python')
  .option('--severity-threshold <threshold>', 'Severity threshold (blocker, critical, major, minor, info)', 'major')
  .option('--ai-enhanced', 'Enable AI-enhanced analysis')
  .option('--scan-tests', 'Include test files in analysis')
  .option('--analyze-complexity', 'Analyze code complexity')
  .option('--analyze-duplication', 'Analyze code duplication')
  .option('--analyze-hotspots', 'Analyze security hotspots')
  .option('--custom-rules', 'Enable custom rules')
  .option('--auto-fix', 'Enable automatic fixing of issues')
  .option('--parallel-analysis', 'Enable parallel analysis')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './code-security-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { codeSecurityAnalysis, writeFiles, displayConfig } = await import('../utils/code-security-analysis.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    if (providers.length === 0) {
      providers.push('aws', 'azure', 'gcp');
    }

    const languages = options.languages.split(',') as ('typescript' | 'javascript' | 'python' | 'java' | 'go' | 'csharp' | 'cpp' | 'ruby' | 'php' | 'rust' | 'swift')[];

    const config = {
      projectName: name,
      providers,
      analysisSettings: {
        enabled: true,
        frequency: options.frequency as 'on-commit' | 'on-push' | 'scheduled' | 'manual',
        languages,
        severityThreshold: options.severityThreshold as 'blocker' | 'critical' | 'major' | 'minor' | 'info',
        failOnThreshold: options.severityThreshold as 'blocker' | 'critical' | 'major' | 'minor' | 'info',
        scanTests: options.scanTests || false,
        scanTestCoverage: false,
        analyzeComplexity: options.analyzeComplexity || false,
        analyzeDuplication: options.analyzeDuplication || false,
        analyzeSecurityHotspots: options.analyzeHotspots || false,
        customRulesEnabled: options.customRules || false,
        aiEnhancedAnalysis: options.aiEnhanced || false,
        autoFix: options.autoFix || false,
        parallelAnalysis: options.parallelAnalysis || false,
        maxAnalysisTime: 60,
      },
      codebases: [
        {
          id: 'codebase-001',
          name: 'web-application',
          language: 'typescript' as const,
          path: '/src',
          branch: 'main',
          lastCommitSha: 'abc123def456',
          lastScanned: new Date(Date.now() - 1 * 60 * 60 * 1000),
          totalFiles: 125,
          totalLines: 15420,
          codeLines: 11850,
          testLines: 3570,
          coverage: 78.5,
          complexity: 45,
          duplication: 3.2,
          securityRating: 'B' as const,
          reliabilityRating: 'A' as const,
          maintainabilityRating: 'B' as const,
          technicalDebt: 120,
          issues: [],
          hotspots: [],
          metrics: {
            files: [],
            functions: [],
            classes: [],
            complexity: [],
            coverage: [],
            duplication: [],
          },
        },
      ],
      issues: [
        {
          id: 'issue-001',
          ruleId: 'typescript:S2755',
          title: 'Debug statements should not be used in production code',
          description: 'Debug statements should be removed or disabled before deployment to production.',
          severity: 'major' as const,
          type: 'code-smell' as const,
          language: 'typescript' as const,
          file: 'src/app.ts',
          line: 42,
          endLine: 42,
          column: 8,
          endColumn: 18,
          effort: '5min',
          debt: '5',
          status: 'open' as const,
          author: 'John Doe',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          assignee: 'Jane Smith',
          rule: {} as any,
          codeSnippet: 'console.log("Debug info");',
          suggestedFix: '// Remove or use proper logging library',
          aiDetected: false,
          aiConfidence: 0,
          references: [],
          cwe: [],
          owasp: [],
        },
        {
          id: 'issue-002',
          ruleId: 'typescript:S2068',
          title: 'Potential SQL injection vulnerability',
          description: 'Using user input directly in SQL queries can lead to SQL injection attacks. Use parameterized queries instead.',
          severity: 'critical' as const,
          type: 'vulnerability' as const,
          language: 'typescript' as const,
          file: 'src/database.ts',
          line: 15,
          endLine: 15,
          column: 20,
          endColumn: 50,
          effort: '30min',
          debt: '30',
          status: 'open' as const,
          author: 'John Doe',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          assignee: 'Security Team',
          rule: {} as any,
          codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${userId}`;',
          suggestedFix: 'Use parameterized query: db.query("SELECT * FROM users WHERE id = ?", [userId])',
          aiDetected: true,
          aiConfidence: 0.92,
          references: [
            {
              type: 'cwe' as const,
              url: 'https://cwe.mitre.org/data/definitions/89.html',
              title: 'CWE-89: SQL Injection',
            },
            {
              type: 'owasp' as const,
              url: 'https://owasp.org/www-community/attacks/SQL_Injection',
              title: 'OWASP SQL Injection',
            },
          ],
          cwe: ['CWE-89'],
          owasp: ['A1: Injection'],
        },
      ],
      rules: [
        {
          id: 'rule-001',
          key: 'typescript:S2755',
          name: 'Debug statements should not be used in production code',
          type: 'code-smell' as const,
          severity: 'major' as const,
          language: 'typescript' as const,
          description: 'Debug statements should be removed or disabled before deployment.',
          htmlDescription: '<p>Debug statements should be removed...</p>',
          status: 'active' as const,
          tags: ['debug', 'production'],
          params: [],
          isActive: true,
          isTemplate: false,
          isCustom: false,
          createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          author: 'SonarSource',
          aiGenerated: false,
        },
      ],
      qualityGates: [
        {
          id: 'gate-001',
          name: 'Security Quality Gate',
          description: 'Ensure code meets security standards before merge',
          conditions: [
            {
              id: 'condition-001',
              metric: 'vulnerability',
              operator: 'lt' as const,
              threshold: 0,
              status: 'error' as const,
              actualValue: 1,
            },
            {
              id: 'condition-002',
              metric: 'coverage',
              operator: 'gt' as const,
              threshold: 75,
              status: 'ok' as const,
              actualValue: 78.5,
            },
          ],
          status: 'failed' as const,
          lastEvaluation: new Date(),
          evaluatedBy: 'CI/CD Pipeline',
        },
      ],
      aiModels: [
        {
          id: 'model-001',
          name: 'Vulnerability Detection Model',
          type: 'issue-detection' as const,
          language: 'typescript' as const,
          model: 'gpt-4',
          version: '1.0.0',
          accuracy: 0.92,
          precision: 0.89,
          recall: 0.94,
          f1Score: 0.915,
          trainingDataSize: 50000,
          lastTrained: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          status: 'deployed' as const,
          features: ['ast-patterns', 'code-context', 'semantic-analysis'],
          config: { temperature: 0.3, maxTokens: 2000 },
        },
      ],
      integrations: [
        {
          tool: 'sonarqube' as const,
          enabled: true,
          url: 'https://sonarqube.example.com',
          apiKey: 'sk-***',
          organization: 'my-org',
          projectKey: 'web-application',
          lastSync: new Date(Date.now() - 5 * 60 * 1000),
          status: 'connected' as const,
        },
      ],
      reports: [],
    };

    const finalConfig = codeSecurityAnalysis(config);
    displayConfig(finalConfig);

    await writeFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: code-security-${providers.join('.tf, code-security-')}.tf`));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'code-security-manager.ts' : 'code_security_manager.py'}`));
    console.log(chalk.green(`✅ Generated: CODE_SECURITY_ANALYSIS.md`));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green(`✅ Generated: code-security-config.json\n`));

    console.log(chalk.green('✓ Code security analysis project configured successfully!'));
  }));

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
    const { writeSecretDetectionFiles, displaySecretDetectionConfig } = await import('../utils/secret-detection.js');

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
    const { writeInfrastructureSecurityFiles, displayInfrastructureSecurityConfig } = await import('../utils/infrastructure-security.js');

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
    const { writeZeroTrustFiles, displayZeroTrustConfig } = await import('../utils/zero-trust-security.js');

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

  security
  .command('threat-detection')
  .description('Generate advanced threat detection and response with machine learning')
  .argument('<name>', 'Name of the threat detection project')
  .option('--mode <mode>', 'Detection mode (detect-only, detect-and-respond, auto-remediate)', 'detect-and-respond')
  .option('--realtime', 'Enable real-time analysis')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low)', 'high')
  .option('--auto-containment', 'Enable automatic threat containment')
  .option('--auto-quarantine', 'Enable automatic threat quarantine')
  .option('--enable-ml', 'Enable machine learning models')
  .option('--threat-intel', 'Enable threat intelligence integration')
  .option('--behavioral-baseline', 'Enable behavioral baseline')
  .option('--anomaly-threshold <threshold>', 'Anomaly threshold in standard deviations', '3')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './threat-detection-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeThreatDetectionFiles, displayThreatDetectionConfig } = await import('../utils/threat-detection.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      detectionSettings: {
        enabled: true,
        mode: options.mode,
        realtimeAnalysis: options.realtime || false,
        batchAnalysis: true,
        analysisInterval: 15,
        severityThreshold: options.severityThreshold,
        autoContainment: options.autoContainment || false,
        autoQuarantine: options.autoQuarantine || false,
        mlEnabled: options.enableMl || true,
        mlUpdateFrequency: 30,
        threatIntelEnabled: options.threatIntel || true,
        behavioralBaseline: options.behavioralBaseline || true,
        anomalyThreshold: parseFloat(options.anomalyThreshold),
        falsePositiveRate: 0.05,
        recallRate: 0.95,
        dataSource: ['network' as const, 'endpoint' as const, 'application' as const],
      },
      threats: [
        {
          id: 'threat-001',
          type: 'malware' as const,
          severity: 'critical' as const,
          status: 'containing' as const,
          confidence: 0.95,
          source: 'endpoint' as const,
          sourceId: 'endpoint-001',
          description: 'Emotet malware detected on workstation',
          detectedAt: new Date(Date.now() - 30 * 60 * 1000),
          firstSeen: new Date(Date.now() - 30 * 60 * 1000),
          lastSeen: new Date(Date.now() - 5 * 60 * 1000),
          occurrences: 150,
          affectedAssets: [
            {
              id: 'asset-001',
              name: 'WS-DEVELOPER-01',
              type: 'workstation' as const,
              ip: '192.168.1.100',
              hostname: 'ws-developer-01',
              location: 'New York, NY',
              owner: 'john.doe',
              impact: 'high' as const,
              compromised: true,
              isolated: true,
            },
          ],
          indicators: [
            {
              id: 'indicator-001',
              type: 'hash' as const,
              value: '5a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p',
              severity: 'critical' as const,
              description: 'Emotet payload hash',
              confidence: 0.98,
              firstSeen: new Date(Date.now() - 30 * 60 * 1000),
              lastSeen: new Date(Date.now() - 5 * 60 * 1000),
              source: 'VirusTotal',
              iocType: "file-hash" as const,
            },
            {
              id: 'indicator-002',
              type: 'ip' as const,
              value: '45.33.21.89',
              severity: 'high' as const,
              description: 'C2 server IP address',
              confidence: 0.92,
              firstSeen: new Date(Date.now() - 30 * 60 * 1000),
              lastSeen: new Date(Date.now() - 5 * 60 * 1000),
              source: 'Threat Intel',
              iocType: "ip-address" as const,
            },
          ],
          mitreTactics: ['Command and Control', 'Execution'],
          mitreTechniques: ['T1059', 'T1071'],
          responseActions: ['isolate' as const, 'block' as const, 'quarantine' as const],
          assignedTo: 'SOC Team',
          metadata: {
            family: 'Emotet',
            variant: 'v2',
            playbook: 'Emotet-Containment',
          },
        },
        {
          id: 'threat-002',
          type: 'phishing' as const,
          severity: 'high' as const,
          status: 'detected' as const,
          confidence: 0.88,
          source: 'network' as const,
          sourceId: 'network-001',
          description: 'Spear phishing email targeting finance team',
          detectedAt: new Date(Date.now() - 60 * 60 * 1000),
          firstSeen: new Date(Date.now() - 60 * 60 * 1000),
          lastSeen: new Date(Date.now() - 60 * 60 * 1000),
          occurrences: 25,
          affectedAssets: [
            {
              id: 'asset-002',
              name: 'EMAIL-SERVER',
              type: 'server' as const,
              ip: '192.168.1.10',
              hostname: 'mail-server-01',
              location: 'San Francisco, CA',
              impact: 'medium' as const,
              compromised: false,
              isolated: false,
            },
          ],
          indicators: [
            {
              id: 'indicator-003',
              type: 'email' as const,
              value: 'ceo-fraud@malicious-domain.com',
              severity: 'high' as const,
              description: 'Fraudulent sender email',
              confidence: 0.85,
              firstSeen: new Date(Date.now() - 60 * 60 * 1000),
              lastSeen: new Date(Date.now() - 60 * 60 * 1000),
              source: 'Email Security Gateway',
              iocType: "email-address" as const,
            },
          ],
          mitreTactics: ['Initial Access', 'Social Engineering'],
          mitreTechniques: ['T1566'],
          responseActions: ['block' as const, 'alert' as const],
          assignedTo: 'Security Team',
          metadata: {
            campaign: 'CEO Fraud',
            target: 'Finance Team',
          },
        },
      ],
      mlModels: [
        {
          id: 'model-001',
          name: 'Malware Classification Model',
          type: 'classification' as const,
          version: '3.2.1',
          status: 'deployed' as const,
          accuracy: 0.94,
          precision: 0.92,
          recall: 0.95,
          f1Score: 0.934,
          falsePositiveRate: 0.03,
          auc: 0.98,
          trainingDataSize: 500000,
          validationDataSize: 100000,
          testDataSize: 50000,
          lastTrained: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          lastEvaluated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          features: [
            {
              name: 'file_entropy',
              type: 'numeric' as const,
              importance: 0.92,
              statistics: {
                mean: 7.2,
                std: 0.8,
                min: 4.5,
                max: 8.0,
              },
            },
            {
              name: 'api_calls',
              type: 'numeric' as const,
              importance: 0.85,
            },
            {
              name: 'network_connections',
              type: 'numeric' as const,
              importance: 0.78,
            },
          ],
          hyperparameters: {
            algorithm: 'Random Forest',
            n_estimators: 100,
            max_depth: 10,
          },
          deploymentStatus: 'production' as const,
          performance: {
            latency: 15,
            throughput: 1000,
            cpuUsage: 45,
            memoryUsage: 512,
            errorRate: 0.001,
            uptime: 99.9,
          },
          driftDetected: false,
          lastDriftCheck: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
      responsePlans: [],
      incidents: [
        {
          id: 'incident-001',
          title: 'Emotet Malware Infection',
          description: 'Emotet malware detected on developer workstation',
          severity: 'critical' as const,
          status: 'containing' as const,
          phase: 'containment' as const,
          threats: ['threat-001'],
          confidence: 0.95,
          detectedAt: new Date(Date.now() - 30 * 60 * 1000),
          assignedTo: 'alice@soc.com',
          team: ['SOC Analyst', 'Incident Responder'],
          timeline: [],
          artifacts: [],
          rootCause: 'Malicious email attachment opened',
          containmentActions: ['Isolated affected workstation', 'Blocked C2 communication'],
          eradicationActions: ['Running malware removal', 'Patching vulnerabilities'],
          recoveryActions: ['Restoring from backup', 'Monitoring for recurrence'],
          lessonsLearned: [],
        },
      ],
      analytics: [
        {
          id: 'analytics-001',
          period: '2024-01',
          threatsDetected: 1250,
          threatsBlocked: 1100,
          threatsRemediated: 950,
          falsePositives: 75,
          meanTimeToDetect: 8.5,
          meanTimeToRespond: 25.3,
          byType: {
            malware: 450,
            phishing: 320,
            ddos: 180,
            'sql-injection': 95,
            xss: 85,
            ransomware: 45,
            'insider-threat': 35,
            'data-exfiltration': 25,
            'zero-day': 15,
            custom: 0,
          },
          bySeverity: {
            critical: 85,
            high: 320,
            medium: 545,
            low: 300,
          },
          trends: [],
          topAssets: [],
          topIndicators: [],
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
            endpoint: 'https://splunk.example.com',
            apiKey: '********',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 5 * 60 * 1000),
          eventsIngested: 5000000,
          threatsDetected: 450,
        },
        {
          id: 'integration-002',
          name: 'CrowdStrike EDR',
          type: 'edr' as const,
          provider: 'CrowdStrike',
          enabled: true,
          config: {
            customerId: 'cust-001',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 2 * 60 * 1000),
          eventsIngested: 2500000,
          threatsDetected: 320,
        },
      ],
    };

    displayThreatDetectionConfig(finalConfig);

    await writeThreatDetectionFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: threat-detection-${providers.join('.tf, threat-detection-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'threat-detection-manager.ts' : 'threat_detection_manager.py'}`));
    console.log(chalk.green('✅ Generated: THREAT_DETECTION.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: threat-detection-config.json\n'));

    console.log(chalk.green('✓ Advanced threat detection and response configured successfully!'));
  }));

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
    const { writeIncidentManagementFiles, displayIncidentManagementConfig } = await import('../utils/incident-management.js');

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

  security
  .command('penetration-testing')
  .description('Generate penetration testing automation and reporting with continuous assessment')
  .argument('<name>', 'Name of the penetration testing project')
  .option('--auto-scheduling', 'Enable automatic test scheduling')
  .option('--frequency <frequency>', 'Test frequency (daily, weekly, monthly, quarterly, on-demand)', 'weekly')
  .option('--scan-method <method>', 'Scan method (black-box, gray-box, white-box)', 'black-box')
  .option('--assessment-type <type>', 'Assessment type (automated, manual, hybrid)', 'automated')
  .option('--max-duration <hours>', 'Maximum test duration in hours', '24')
  .option('--allow-production', 'Allow testing on production environment')
  .option('--severity-threshold <threshold>', 'Severity threshold (critical, high, medium, low, info)', 'high')
  .option('--auto-remediation', 'Enable automatic remediation')
  .option('--continuous-testing', 'Enable continuous testing mode')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './penetration-testing-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writePenetrationTestingFiles, displayPenetrationTestingConfig } = await import('../utils/penetration-testing.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoScheduling: options.autoScheduling || true,
        frequency: options.frequency,
        scanMethod: options.scanMethod,
        assessmentType: options.assessmentType,
        concurrentTests: 5,
        maxDuration: parseInt(options.maxDuration),
        allowProduction: options.allowProduction || false,
        requireApproval: !options.allowProduction,
        approvers: ['security-manager', 'ciso'],
        notificationChannels: ['email', 'slack', 'pagerduty'],
        severityThreshold: options.severityThreshold,
        autoRemediation: options.autoRemediation || false,
        continuousTesting: options.continuousTesting || true,
        testingWindow: {
          start: '22:00',
          end: '06:00',
          timezone: 'UTC',
        },
        excludedTargets: [],
        complianceStandards: ['PCI-DSS', 'OWASP', 'NIST-800-53'],
        retentionPeriod: 2555,
      },
      tests: [
        {
          id: 'test-001',
          name: 'Web Application Penetration Test',
          description: 'Comprehensive security assessment of web application including OWASP Top 10 vulnerabilities',
          type: 'web' as const,
          status: 'completed' as const,
          severity: 'high' as const,
          confidence: 0.92,
          methodology: 'OWASP Testing Guide v4.2, PTES, OSSTMM',
          startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          estimatedDuration: 24,
          actualDuration: 23.5,
          progress: 100,
          targets: [
            {
              id: 'target-001',
              name: 'Primary Web Application',
              type: 'url' as const,
              address: 'https://app.example.com',
              description: 'Main production web application',
              inScope: true,
              priority: 'critical' as const,
              authentication: {
                type: 'bearer' as const,
              },
            },
            {
              id: 'target-002',
              name: 'Admin Panel',
              type: 'url' as const,
              address: 'https://admin.example.com',
              description: 'Administrative interface',
              inScope: true,
              priority: 'high' as const,
            },
            {
              id: 'target-003',
              name: 'API Gateway',
              type: 'api' as const,
              address: 'https://api.example.com',
              description: 'RESTful API endpoints',
              inScope: true,
              priority: 'high' as const,
              authentication: {
                type: 'api-key' as const,
              },
            },
          ],
          scope: {
            include: ['*.example.com', 'app.example.com/*'],
            exclude: ['blog.example.com', 'docs.example.com'],
            constraints: ['No DoS testing', 'No social engineering'],
            rules: ['Report all findings', 'Stop on critical impact'],
            authorizations: ['Client approval #12345', 'Rules of Engagement signed'],
          },
          tools: [
            {
              id: 'tool-001',
              name: 'Burp Suite Professional',
              category: 'web' as const,
              version: '2023.10',
              command: 'burpsuite',
              parameters: {
                project: 'app-pentest',
                target: 'app.example.com',
              },
              status: 'completed' as const,
              startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
              completedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
              duration: 79200,
              output: 'burp-report.html',
              findings: ['finding-001', 'finding-002', 'finding-003'],
              errors: [],
            },
            {
              id: 'tool-002',
              name: 'SQLmap',
              category: 'web' as const,
              version: '1.7',
              command: 'sqlmap -u',
              parameters: {
                url: 'https://app.example.com/search',
                level: '5',
                risk: '3',
              },
              status: 'completed' as const,
              startedAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
              completedAt: new Date(Date.now() - 44 * 60 * 60 * 1000),
              duration: 7200,
              output: 'sqlmap-results.json',
              findings: ['finding-001'],
              errors: [],
            },
          ],
          findings: [
            {
              id: 'finding-001',
              title: 'SQL Injection in Search Functionality',
              description: 'The search parameter is vulnerable to time-based blind SQL injection allowing unauthorized database access',
              type: 'injection' as const,
              severity: 'critical' as const,
              confidence: 0.95,
              impact: 'critical' as const,
              likelihood: 'certain' as const,
              cwe: 'CWE-89',
              owasp: 'A03:2021',
              cvssScore: 9.8,
              cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
              affectedTargets: ['target-001'],
              reproduction: [
                '1. Navigate to https://app.example.com/search',
                '2. Enter payload: test\' OR SLEEP(5)--',
                '3. Observe 5-second delay confirming SQL injection',
              ],
              evidence: ['sqlmap-output.txt', 'burp-request-001.req'],
              poc: "curl 'https://app.example.com/search?q=test\\' OR SLEEP(5)--'",
              remediation: {
                description: 'Implement parameterized queries and input validation',
                complexity: 'easy' as const,
                priority: 'p1' as const,
                estimatedTime: 4,
                steps: [
                  'Replace string concatenation with parameterized queries',
                  'Validate and sanitize all user input',
                  'Implement prepared statements for all database queries',
                  'Add input length restrictions',
                  'Implement Web Application Firewall (WAF) rules',
                ],
                codeExample: '// Before\nconst query = "SELECT * FROM users WHERE name = \'" + input + "\'";\n\n// After\nconst query = "SELECT * FROM users WHERE name = ?";\ndb.execute(query, [input]);',
                references: ['https://owasp.org/www-community/attacks/SQL_Injection', 'CWE-89'],
              },
              references: [
                'https://owasp.org/www-project-top-ten/',
                'https://cwe.mitre.org/data/definitions/89.html',
              ],
              discoveredBy: 'pentester@company.com',
              discoveredAt: new Date(Date.now() - 46 * 60 * 60 * 1000),
              verified: true,
            },
            {
              id: 'finding-002',
              title: 'Stored Cross-Site Scripting (XSS) in User Profile',
              description: 'User profile bio field lacks proper output encoding allowing persistent XSS attacks',
              type: 'cross-site-scripting' as const,
              severity: 'high' as const,
              confidence: 0.88,
              impact: 'high' as const,
              likelihood: 'likely' as const,
              cwe: 'CWE-79',
              owasp: 'A03:2021',
              cvssScore: 8.1,
              cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N',
              affectedTargets: ['target-001'],
              reproduction: [
                '1. Log in as regular user',
                '2. Navigate to profile settings',
                '3. Enter bio: <script>alert(document.cookie)</script>',
                '4. Save profile',
                '5. View profile - XSS executes',
              ],
              evidence: ['xss-screenshot.png', 'burp-response-002.resp'],
              poc: '<img src=x onerror=alert(1)>',
              remediation: {
                description: 'Implement context-aware output encoding',
                complexity: 'medium' as const,
                priority: 'p1' as const,
                estimatedTime: 8,
                steps: [
                  'Encode all user-generated content before rendering',
                  'Implement Content Security Policy (CSP)',
                  'Use HTML sanitization libraries (DOMPurify)',
                  'Validate input on server-side',
                  'Escape HTML entities in output',
                ],
                codeExample: '// Use DOMPurify\nimport DOMPurify from \'dompurify\';\nconst clean = DOMPurify.sanitize(userInput);\nelement.innerHTML = clean;',
                references: ['https://owasp.org/www-community/attacks/xss/', 'CWE-79'],
              },
              references: [
                'https://owasp.org/www-community/attacks/xss/',
                'https://cwe.mitre.org/data/definitions/79.html',
              ],
              discoveredBy: 'pentester@company.com',
              discoveredAt: new Date(Date.now() - 40 * 60 * 60 * 1000),
              verified: true,
            },
            {
              id: 'finding-003',
              title: 'Broken Access Control - IDOR',
              description: 'Direct object reference allows accessing other users\' data by changing URL parameter',
              type: 'broken-access-control' as const,
              severity: 'high' as const,
              confidence: 0.85,
              impact: 'high' as const,
              likelihood: 'likely' as const,
              cwe: 'CWE-639',
              owasp: 'A01:2021',
              cvssScore: 7.5,
              cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
              affectedTargets: ['target-001'],
              reproduction: [
                '1. Log in as user A (ID: 1001)',
                '2. Access profile: /api/users/1001/profile',
                '3. Change ID to 1002: /api/users/1002/profile',
                '4. User B\'s profile data is returned',
              ],
              evidence: ['idor-request-003.req'],
              poc: 'curl -H "Authorization: Bearer TOKEN_A" https://api.example.com/users/1002/profile',
              remediation: {
                description: 'Implement proper access control checks',
                complexity: 'medium' as const,
                priority: 'p2' as const,
                estimatedTime: 12,
                steps: [
                  'Validate user ownership on every resource access',
                  'Implement session-based authorization',
                  'Use UUIDs instead of sequential IDs',
                  'Add access control middleware',
                  'Implement role-based access control (RBAC)',
                ],
                references: ['https://owasp.org/www-project-top-ten/2021/A01_2021-Broken_Access_Control', 'CWE-639'],
              },
              references: [
                'https://owasp.org/www-project-top-ten/',
                'https://cwe.mitre.org/data/definitions/639.html',
              ],
              discoveredBy: 'pentester@company.com',
              discoveredAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
              verified: true,
            },
          ],
          approvedBy: 'ciso@company.com',
          approvedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
          assignedTo: 'lead-pentester@company.com',
          team: ['pentester@company.com', 'security-analyst@company.com'],
          tags: ['web', 'owasp-top-10', 'production', 'quarterly'],
          metadata: {
            testType: 'black-box',
            methodology: 'OWASP',
            compliance: ['PCI-DSS', 'SOC2'],
          },
        },
      ],
      vulnerabilities: [
        {
          id: 'vuln-001',
          title: 'SQL Injection Vulnerability',
          type: 'injection' as const,
          severity: 'critical' as const,
          description: 'Multiple SQL injection vulnerabilities discovered in search and filtering functions',
          affectedTests: ['test-001'],
          firstSeen: new Date(Date.now() - 46 * 60 * 60 * 1000),
          lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
          occurrences: 5,
          status: 'in-progress' as const,
          cvssScore: 9.8,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          cwe: 'CWE-89',
          owasp: 'A03:2021',
          remediation: {
            description: 'Implement parameterized queries and input validation',
            complexity: 'easy' as const,
            priority: 'p1' as const,
            estimatedTime: 4,
            steps: [
              'Replace string concatenation with parameterized queries',
              'Validate all user input',
              'Implement prepared statements',
            ],
            references: ['OWASP SQL Injection Prevention Cheat Sheet'],
          },
          assignedTo: 'dev-team-lead@company.com',
        },
        {
          id: 'vuln-002',
          title: 'Cross-Site Scripting (XSS)',
          type: 'cross-site-scripting' as const,
          severity: 'high' as const,
          description: 'Stored XSS in user profile and comments section',
          affectedTests: ['test-001'],
          firstSeen: new Date(Date.now() - 40 * 60 * 60 * 1000),
          lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
          occurrences: 3,
          status: 'open' as const,
          cvssScore: 8.1,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N',
          cwe: 'CWE-79',
          owasp: 'A03:2021',
          remediation: {
            description: 'Implement output encoding and CSP',
            complexity: 'medium' as const,
            priority: 'p1' as const,
            estimatedTime: 8,
            steps: ['Encode output', 'Implement CSP', 'Use DOMPurify'],
            references: ['OWASP XSS Prevention Cheat Sheet'],
          },
          assignedTo: 'frontend-team-lead@company.com',
        },
        {
          id: 'vuln-003',
          title: 'Broken Access Control',
          type: 'broken-access-control' as const,
          severity: 'high' as const,
          description: 'Insecure direct object references allowing unauthorized data access',
          affectedTests: ['test-001'],
          firstSeen: new Date(Date.now() - 36 * 60 * 60 * 1000),
          lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
          occurrences: 8,
          status: 'open' as const,
          cvssScore: 7.5,
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
          cwe: 'CWE-639',
          owasp: 'A01:2021',
          remediation: {
            description: 'Implement proper access control checks',
            complexity: 'medium' as const,
            priority: 'p2' as const,
            estimatedTime: 12,
            steps: ['Validate ownership', 'Implement RBAC', 'Use UUIDs'],
            references: ['OWASP Access Control Cheat Sheet'],
          },
        },
      ],
      assessments: [
        {
          id: 'assessment-001',
          name: 'Quarterly Security Assessment',
          description: 'Automated security assessment for Q4 2024',
          type: 'automated' as const,
          method: 'black-box' as const,
          status: 'completed' as const,
          scheduledFor: new Date(Date.now() - 48 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          duration: 24,
          targets: [],
          tools: ['Burp Suite', 'SQLmap', 'Nmap', 'Nikto'],
          findings: ['finding-001', 'finding-002', 'finding-003'],
          vulnerabilities: ['vuln-001', 'vuln-002', 'vuln-003'],
          riskScore: 78,
          compliance: [
            {
              standard: 'OWASP Top 10',
              status: 'non-compliant' as const,
              score: 65,
              requirements: [
                {
                  id: 'A01-2021',
                  requirement: 'Broken Access Control',
                  status: 'fail' as const,
                  findings: ['finding-003'],
                },
                {
                  id: 'A03-2021',
                  requirement: 'Injection',
                  status: 'fail' as const,
                  findings: ['finding-001', 'finding-002'],
                },
              ],
            },
            {
              standard: 'PCI-DSS',
              status: 'partial' as const,
              score: 72,
              requirements: [
                {
                  id: '6.5.1',
                  requirement: 'Injection flaws',
                  status: 'fail' as const,
                  findings: ['vuln-001'],
                },
                {
                  id: '6.5.7',
                  requirement: 'XSS',
                  status: 'fail' as const,
                  findings: ['vuln-002'],
                },
              ],
            },
          ],
          recommendations: [
            'Immediately patch SQL injection vulnerabilities (P1)',
            'Implement output encoding for XSS prevention',
            'Add proper access control checks',
            'Implement Web Application Firewall',
            'Conduct regular security training',
          ],
        },
      ],
      reports: [],
      analytics: [
        {
          id: 'analytics-001',
          period: '2024-Q4',
          totalTests: 24,
          completedTests: 22,
          totalFindings: 156,
          byType: {
            network: 35,
            web: 68,
            mobile: 12,
            api: 28,
            wireless: 8,
            'social-engineering': 3,
            physical: 0,
            cloud: 2,
            iot: 0,
            custom: 0,
          },
          bySeverity: {
            critical: 12,
            high: 45,
            medium: 68,
            low: 31,
            info: 0,
          },
          meanTimeToComplete: 18.5,
          remediationRate: 72.5,
          falsePositiveRate: 8.3,
          riskTrend: 'improving' as const,
          topVulnerabilities: [
            { type: 'injection' as const, count: 32, severity: 'high' as const, trend: 'decreasing' as const },
            { type: 'cross-site-scripting' as const, count: 28, severity: 'high' as const, trend: 'stable' as const },
            { type: 'broken-access-control' as const, count: 24, severity: 'high' as const, trend: 'decreasing' as const },
            { type: 'security-misconfiguration' as const, count: 18, severity: 'medium' as const, trend: 'stable' as const },
            { type: 'sensitive-data-exposure' as const, count: 15, severity: 'medium' as const, trend: 'increasing' as const },
          ],
          complianceScores: [
            { standard: 'OWASP Top 10', score: 72, trend: 'improving' as const, lastAssessed: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            { standard: 'PCI-DSS', score: 78, trend: 'stable' as const, lastAssessed: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            { standard: 'NIST-800-53', score: 81, trend: 'improving' as const, lastAssessed: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ],
          testingCoverage: 85,
          toolsUsage: [
            { tool: 'Burp Suite', category: 'web' as const, usage: 45, findings: 98, avgDuration: 180 },
            { tool: 'SQLmap', category: 'web' as const, usage: 38, findings: 32, avgDuration: 45 },
            { tool: 'Nmap', category: 'network' as const, usage: 52, findings: 35, avgDuration: 30 },
          ],
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'Burp Suite Professional',
          type: 'scanner' as const,
          provider: 'PortSwigger',
          enabled: true,
          config: {
            apiUrl: 'https://burp.example.com:8080',
            apiKey: '********',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
          testsImported: 45,
          findingsGenerated: 156,
        },
        {
          id: 'integration-002',
          name: 'Jira Integration',
          type: 'ticketing' as const,
          provider: 'Atlassian',
          enabled: true,
          config: {
            instance: 'company.atlassian.net',
            project: 'SEC',
          },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
          testsImported: 0,
          findingsGenerated: 156,
        },
      ],
    };

    displayPenetrationTestingConfig(finalConfig);

    await writePenetrationTestingFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: penetration-testing-${providers.join('.tf, penetration-testing-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'penetration-testing-manager.ts' : 'penetration_testing_manager.py'}`));
    console.log(chalk.green('✅ Generated: PENETRATION_TESTING.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: penetration-testing-config.json\n'));

    console.log(chalk.green('✓ Penetration testing automation and reporting configured successfully!'));
  }));

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
    const { writeSupplyChainSecurityFiles, displaySupplyChainSecurityConfig } = await import('../utils/supply-chain-security.js');

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

  security
  .command('security-training')
  .description('Generate security training integration and awareness programs with gamification')
  .argument('<name>', 'Name of the security training program')
  .option('--auto-assign', 'Enable automatic training assignment')
  .option('--frequency <frequency>', 'Training frequency (one-time, monthly, quarterly, annual, on-demand)', 'quarterly')
  .option('--duration <minutes>', 'Duration per session (minutes)', '30')
  .option('--passing-score <score>', 'Passing score percentage', '80')
  .option('--max-attempts <attempts>', 'Maximum attempts allowed', '3')
  .option('--gamification', 'Enable gamification features')
  .option('--leaderboard', 'Enable leaderboard')
  .option('--certificates', 'Enable certificate generation')
  .option('--adaptive-difficulty', 'Enable adaptive difficulty')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './security-training-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeSecurityTrainingFiles, displaySecurityTrainingConfig } = await import('../utils/security-training.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoAssign: options.autoAssign || true,
        frequency: options.frequency,
        duration: parseInt(options.duration),
        passingScore: parseInt(options.passingScore),
        maxAttempts: parseInt(options.maxAttempts),
        requiredForAll: true,
        trackingEnabled: true,
        reminderEnabled: true,
        reminderFrequency: 7,
        allowSkip: false,
        showAnswers: true,
        randomizeQuestions: true,
        adaptiveDifficulty: options.adaptiveDifficulty || false,
        gamificationEnabled: options.gamification || true,
        leaderboardEnabled: options.leaderboard || true,
        certificateEnabled: options.certificates || true,
        expiryPeriod: 365,
        mandatoryModules: ['phishing', 'password-security', 'data-handling'] as ('phishing' | 'password-security' | 'data-handling' | 'social-engineering' | 'physical-security' | 'incident-reporting' | 'compliance' | 'secure-coding' | 'mobile-security' | 'cloud-security' | 'custom')[],
        electiveModules: ['secure-coding', 'mobile-security', 'cloud-security'] as ('phishing' | 'password-security' | 'data-handling' | 'social-engineering' | 'physical-security' | 'incident-reporting' | 'compliance' | 'secure-coding' | 'mobile-security' | 'cloud-security' | 'custom')[],
      },
      modules: ['phishing', 'password-security', 'data-handling', 'social-engineering', 'incident-reporting'] as ('phishing' | 'password-security' | 'data-handling' | 'social-engineering' | 'physical-security' | 'incident-reporting' | 'compliance' | 'secure-coding' | 'mobile-security' | 'cloud-security' | 'custom')[],
      moduleData: [
        {
          id: 'module-001',
          name: 'Phishing Awareness',
          type: 'phishing' as const,
          description: 'Learn to identify and avoid phishing attacks',
          difficulty: 'beginner' as const,
          duration: 30,
          status: 'not-started' as const,
          passScore: 80,
          maxAttempts: 3,
          mandatory: true,
          tags: ['email', 'security', 'awareness'],
          content: [],
          questions: [],
          learningObjectives: ['Identify phishing emails', 'Report suspicious messages'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-002',
          name: 'Password Security',
          type: 'password-security' as const,
          description: 'Best practices for creating and managing secure passwords',
          difficulty: 'beginner' as const,
          duration: 20,
          status: 'not-started' as const,
          passScore: 80,
          maxAttempts: 3,
          mandatory: true,
          tags: ['password', 'authentication', 'security'],
          content: [],
          questions: [],
          learningObjectives: ['Create strong passwords', 'Use password managers'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-003',
          name: 'Data Handling',
          type: 'data-handling' as const,
          description: 'Proper handling and protection of sensitive data',
          difficulty: 'intermediate' as const,
          duration: 45,
          status: 'not-started' as const,
          passScore: 85,
          maxAttempts: 3,
          mandatory: true,
          tags: ['data', 'privacy', 'gdpr'],
          content: [],
          questions: [],
          learningObjectives: ['Classify data types', 'Handle sensitive information'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-004',
          name: 'Social Engineering Defense',
          type: 'social-engineering' as const,
          description: 'Recognize and defend against social engineering attacks',
          difficulty: 'intermediate' as const,
          duration: 35,
          status: 'not-started' as const,
          passScore: 80,
          maxAttempts: 3,
          mandatory: false,
          tags: ['social-engineering', 'psychology', 'security'],
          content: [],
          questions: [],
          learningObjectives: ['Identify manipulation tactics', 'Verify identities'],
          prerequisites: ['module-001'],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
        {
          id: 'module-005',
          name: 'Incident Reporting',
          type: 'incident-reporting' as const,
          description: 'How to properly report security incidents',
          difficulty: 'beginner' as const,
          duration: 15,
          status: 'not-started' as const,
          passScore: 100,
          maxAttempts: 3,
          mandatory: true,
          tags: ['incident', 'reporting', 'response'],
          content: [],
          questions: [],
          learningObjectives: ['Recognize security incidents', 'Follow reporting procedures'],
          prerequisites: [],
          targetRoles: ['all'],
          targetDepartments: ['all'],
          lastUpdated: new Date(),
        },
      ],
      users: [
        {
          id: 'user-001',
          name: 'John Doe',
          email: 'john.doe@example.com',
          role: 'Developer',
          department: 'Engineering',
          manager: 'Jane Smith',
          team: 'Platform Team',
          location: 'New York',
          joinDate: new Date('2023-01-15'),
          isActive: true,
        },
        {
          id: 'user-002',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          role: 'Engineering Manager',
          department: 'Engineering',
          team: 'Platform Team',
          location: 'San Francisco',
          joinDate: new Date('2022-06-01'),
          isActive: true,
        },
      ],
      progress: [],
      assessments: [],
      gamification: {
        enabled: true,
        pointsPerCorrectAnswer: 10,
        pointsPerCompletion: 100,
        bonusPoints: [
          { id: 'bonus-001', name: 'First Attempt Perfect', description: 'Complete module with 100% on first attempt', condition: 'first-attempt-perfect', points: 50, maxPerDay: 1 },
          { id: 'bonus-002', name: 'Speed Demon', description: 'Complete module in half the time', condition: 'fast-completion', points: 25 },
        ],
        badges: [
          { id: 'badge-001', name: 'Security Novice', description: 'Complete first training module', type: 'completion' as const, icon: '🎓', rarity: 'common' as const, requirement: 'Complete 1 module', points: 100 },
          { id: 'badge-002', name: 'Security Champion', description: 'Complete all modules', type: 'completion' as const, icon: '🏆', rarity: 'legendary' as const, requirement: 'Complete all modules', points: 1000 },
          { id: 'badge-003', name: 'Quick Learner', description: 'Complete 5 modules in one day', type: 'speed' as const, icon: '⚡', rarity: 'rare' as const, requirement: '5 modules in 1 day', points: 200 },
        ],
        levels: [
          { id: 'level-1', name: 'Novice', number: 1, pointsRequired: 0, privileges: ['Access basic modules'], icon: '🌱' },
          { id: 'level-2', name: 'Aware', number: 2, pointsRequired: 500, privileges: ['Access intermediate modules'], icon: '📚' },
          { id: 'level-3', name: 'Competent', number: 3, pointsRequired: 1500, privileges: ['Access advanced modules', 'Mentor others'], icon: '🎯' },
          { id: 'level-4', name: 'Expert', number: 4, pointsRequired: 3000, privileges: ['All modules', 'Custom challenges'], icon: '👑' },
        ],
        leaderboards: [
          { id: 'lb-001', name: 'Monthly Champions', type: 'individual' as const, period: 'monthly' as const, category: 'points', participants: 150, topScores: [] },
          { id: 'lb-002', name: 'Team Battle', type: 'team' as const, period: 'monthly' as const, category: 'completions', participants: 12, topScores: [] },
        ],
        challenges: [
          {
            id: 'challenge-001',
            name: 'Cybersecurity Month',
            description: 'Complete all phishing modules during October',
            type: 'individual' as const,
            startDate: new Date('2024-10-01'),
            endDate: new Date('2024-10-31'),
            rules: ['Complete all phishing modules', 'Score 90% or higher'],
            reward: { id: 'reward-001', type: 'badge' as const, name: 'Cyber Defender', description: 'October challenge winner', value: 500, icon: '🛡️', unlockThreshold: 0 },
            participants: ['user-001', 'user-002'],
            progress: [],
          },
        ],
        rewards: [
          { id: 'reward-001', type: 'badge' as const, name: 'Cyber Defender', description: 'October challenge winner', value: 500, icon: '🛡️', unlockThreshold: 1000 },
          { id: 'reward-002', type: 'certificate' as const, name: 'Security Certified', description: 'Completion certificate', value: 0, icon: '📜', unlockThreshold: 2000 },
        ],
        teams: [
          { id: 'team-001', name: 'Platform Guardians', description: 'Platform team security champions', members: ['user-001', 'user-002'], score: 2500, rank: 1, avatar: '🦅' },
        ],
      },
      analytics: [
        {
          id: 'analytics-001',
          period: '2024-01',
          totalParticipants: 150,
          completedModules: 420,
          averageScore: 87,
          passRate: 94,
          completionRate: 85,
          byDepartment: {
            Engineering: { participants: 50, completed: 180, averageScore: 90, completionRate: 92 },
            Sales: { participants: 40, completed: 80, averageScore: 82, completionRate: 75 },
            Marketing: { participants: 35, completed: 70, averageScore: 85, completionRate: 80 },
            HR: { participants: 25, completed: 50, averageScore: 88, completionRate: 88 },
          },
          byModule: {
            'module-001': { attempts: 150, completions: 145, averageScore: 88, averageTime: 28, passRate: 97, questionStats: [] },
            'module-002': { attempts: 150, completions: 148, averageScore: 92, averageTime: 18, passRate: 99, questionStats: [] },
          },
          vulnerabilityAreas: [
            { area: 'Phishing Recognition', severity: 'medium' as const, averageScore: 78, participants: 30, improvement: 12 },
            { area: 'Password Management', severity: 'low' as const, averageScore: 92, participants: 15, improvement: 5 },
          ],
          engagementMetrics: {
            activeUsers: 120,
            totalPoints: 125000,
            averageSessionTime: 25,
            returnUsers: 95,
            badgesEarned: 85,
            challengesCompleted: 12,
            leaderboardParticipation: 78,
          },
          trends: [
            { date: new Date('2024-01-01'), participants: 120, completions: 85, averageScore: 85, engagement: 75 },
            { date: new Date('2024-01-15'), participants: 130, completions: 95, averageScore: 87, engagement: 80 },
          ],
        },
      ],
      integrations: [
        {
          id: 'integration-001',
          name: 'SSO Integration',
          type: 'sso' as const,
          provider: 'Okta',
          enabled: true,
          config: { domain: 'company.okta.com', clientId: 'abc123' },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
          usersSynced: 150,
          modulesImported: 5,
        },
        {
          id: 'integration-002',
          name: 'Slack Notifications',
          type: 'notification' as const,
          provider: 'Slack',
          enabled: true,
          config: { channel: '#security-training', webhookUrl: 'https://hooks.slack.com/...' },
          status: 'connected' as const,
          lastSync: new Date(Date.now() - 30 * 60 * 1000),
          usersSynced: 0,
          modulesImported: 0,
        },
      ],
    };

    displaySecurityTrainingConfig(finalConfig);

    await writeSecurityTrainingFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: security-training-${providers.join('.tf, security-training-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'security-training-manager.ts' : 'security_training_manager.py'}`));
    console.log(chalk.green('✅ Generated: SECURITY_TRAINING.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: security-training-config.json\n'));

    console.log(chalk.green('✓ Security training and awareness program configured successfully!'));
  }));

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
    const { writeSecurityPolicyFiles, displaySecurityPolicyConfig } = await import('../utils/security-policy.js');

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
    const { writeComplianceReportingFiles, displayComplianceReportingConfig } = await import('../utils/compliance-reporting.js');

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
    const { writeCustomPolicyFiles, displayCustomPolicyConfig } = await import('../utils/custom-policy.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const categories = options.categories.split(',').map((c: string) => c.trim()) as ('identity' | 'access-control' | 'data-protection' | 'network-security' | 'encryption' | 'monitoring' | 'compliance' | 'custom')[];

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

  security
  .command('rbac')
  .description('Generate RBAC and access control management with fine-grained permissions')
  .argument('<name>', 'Name of the RBAC project')
  .option('--fine-grained', 'Enable fine-grained permissions')
  .option('--default-deny', 'Enable default deny all policy')
  .option('--require-mfa', 'Require MFA for admin operations')
  .option('--session-timeout <minutes>', 'Session timeout in minutes', '60')
  .option('--enable-cache', 'Enable permission caching')
  .option('--cache-ttl <minutes>', 'Cache TTL in minutes', '15')
  .option('--enable-audit', 'Enable audit logging')
  .option('--audit-retention <days>', 'Audit log retention in days', '90')
  .option('--enable-hierarchy', 'Enable role hierarchy')
  .option('--max-depth <depth>', 'Maximum role hierarchy depth', '5')
  .option('--enable-temporary', 'Enable temporary access')
  .option('--temp-max-hours <hours>', 'Maximum temporary access hours', '24')
  .option('--enable-ip-restrictions', 'Enable IP-based restrictions')
  .option('--enable-time-restrictions', 'Enable time-based restrictions')
  .option('--enable-context-aware', 'Enable context-aware access')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './rbac-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeRBACFiles, displayRBACConfig } = await import('../utils/rbac-manager.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        enableFineGrained: options.fineGrained || false,
        defaultDenyAll: options.defaultDeny || true,
        requireMFAForAdmin: options.requireMfa || true,
        enableSessionTimeout: options.sessionTimeout > 0,
        sessionTimeoutMinutes: parseInt(options.sessionTimeout),
        enablePermissionCaching: options.enableCache || true,
        cacheTTLMinutes: parseInt(options.cacheTtl),
        enableAuditLogging: options.enableAudit || true,
        logRetentionDays: parseInt(options.auditRetention),
        enableDynamicPermissions: false,
        enableRoleHierarchy: options.enableHierarchy || false,
        maxRoleDepth: parseInt(options.maxDepth),
        enableTemporaryAccess: options.enableTemporary || false,
        temporaryAccessMaxHours: parseInt(options.tempMaxHours),
        enableIPRestrictions: options.enableIpRestrictions || false,
        enableTimeRestrictions: options.enableTimeRestrictions || false,
        enableContextAwareAccess: options.enableContextAware || false,
      },
      roles: [
        {
          id: 'role-super-admin',
          name: 'Super Administrator',
          description: 'Full system access with all permissions',
          status: 'active' as const,
          isSystemRole: true,
          isCustomizable: false,
          priority: 1,
          inheritsFrom: undefined,
          permissions: ['perm-admin-all', 'perm-users-manage', 'perm-roles-manage', 'perm-policies-manage'],
          scopedPermissions: [],
          conditions: [],
          metadata: {
            category: 'administration',
            riskLevel: 'critical' as const,
            complianceReferences: ['SOC-2', 'ISO-27001'],
            approvalRequired: true,
            approvers: ['ceo', 'ciso'],
            reviewInterval: 90,
            lastReviewed: new Date(),
            nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            version: '1.0.0',
            changeHistory: [
              { timestamp: new Date('2024-01-01'), user: 'system', action: 'created' as const, reason: 'Initial system role creation' },
            ],
            documentation: 'Super administrators have complete access to all system resources and can manage all other users, roles, and permissions.',
            rationale: 'Required for emergency system administration and initial setup.',
          },
          tags: ['admin', 'super', 'critical'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        },
        {
          id: 'role-admin',
          name: 'Administrator',
          description: 'Administrative access for managing users and resources',
          status: 'active' as const,
          isSystemRole: true,
          isCustomizable: true,
          priority: 10,
          inheritsFrom: undefined,
          permissions: ['perm-users-read', 'perm-users-write', 'perm-resources-manage'],
          scopedPermissions: [],
          conditions: [],
          metadata: {
            category: 'administration',
            riskLevel: 'high' as const,
            complianceReferences: ['SOC-2'],
            approvalRequired: false,
            approvers: ['ciso'],
            reviewInterval: 90,
            lastReviewed: new Date(),
            nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            version: '1.0.0',
            changeHistory: [
              { timestamp: new Date('2024-01-01'), user: 'system', action: 'created' as const, reason: 'Initial role creation' },
            ],
            documentation: 'Administrators can manage users and resources but cannot modify system configuration or roles.',
            rationale: 'Day-to-day administrative operations without full system access.',
          },
          tags: ['admin', 'operations'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        },
        {
          id: 'role-operator',
          name: 'Operator',
          description: 'Read and execute access for operational tasks',
          status: 'active' as const,
          isSystemRole: true,
          isCustomizable: true,
          priority: 50,
          inheritsFrom: undefined,
          permissions: ['perm-resources-read', 'perm-services-execute'],
          scopedPermissions: [
            {
              permissionId: 'perm-resources-read',
              scope: { type: 'organization' as const, value: 'production' },
              resourceFilters: [{ field: 'resource.type', operator: 'equals' as const, value: 'service' }],
              conditions: [],
              effect: 'allow' as const,
            },
          ],
          conditions: [],
          metadata: {
            category: 'operations',
            riskLevel: 'medium' as const,
            complianceReferences: [],
            approvalRequired: false,
            approvers: [],
            reviewInterval: 180,
            lastReviewed: new Date(),
            nextReviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            version: '1.0.0',
            changeHistory: [
              { timestamp: new Date('2024-01-15'), user: 'hr-director', action: 'created' as const, reason: 'Operations team role' },
            ],
            documentation: 'Operators can view resources and execute services but cannot modify configurations.',
            rationale: 'Operational visibility and service execution without modification rights.',
          },
          tags: ['operations', 'read-only'],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date(),
        },
        {
          id: 'role-auditor',
          name: 'Security Auditor',
          description: 'Read-only access for security auditing and compliance',
          status: 'active' as const,
          isSystemRole: true,
          isCustomizable: false,
          priority: 20,
          inheritsFrom: undefined,
          permissions: ['perm-audit-read', 'perm-logs-read', 'perm-policies-read'],
          scopedPermissions: [],
          conditions: [],
          metadata: {
            category: 'compliance',
            riskLevel: 'low' as const,
            complianceReferences: ['SOC-2', 'ISO-27001', 'PCI-DSS'],
            approvalRequired: false,
            approvers: [],
            reviewInterval: 90,
            lastReviewed: new Date(),
            nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            version: '1.0.0',
            changeHistory: [
              { timestamp: new Date('2024-01-01'), user: 'system', action: 'created' as const, reason: 'Compliance requirement' },
            ],
            documentation: 'Auditors have read-only access to logs, policies, and audit trails for compliance reporting.',
            rationale: 'Required for regulatory compliance and security audits.',
          },
          tags: ['audit', 'compliance', 'read-only'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        },
        {
          id: 'role-developer',
          name: 'Developer',
          description: 'Development access with resource creation and modification',
          status: 'active' as const,
          isSystemRole: true,
          isCustomizable: true,
          priority: 75,
          inheritsFrom: 'role-operator' as const,
          permissions: ['perm-resources-create', 'perm-resources-update', 'perm-services-deploy'],
          scopedPermissions: [
            {
              permissionId: 'perm-resources-create',
              scope: { type: 'project' as const, value: 'development' },
              resourceFilters: [{ field: 'environment', operator: 'equals' as const, value: 'dev' }],
              conditions: [],
              effect: 'allow' as const,
            },
          ],
          conditions: [],
          metadata: {
            category: 'development',
            riskLevel: 'medium' as const,
            complianceReferences: [],
            approvalRequired: false,
            approvers: [],
            reviewInterval: 180,
            lastReviewed: new Date(),
            nextReviewDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            version: '1.2.0',
            changeHistory: [
              { timestamp: new Date('2024-02-01'), user: 'engineering-manager', action: 'created' as const, reason: 'Development team access' },
              { timestamp: new Date('2024-06-01'), user: 'tech-lead', action: 'permissions-changed' as const, reason: 'Added deployment permissions' },
            ],
            documentation: 'Developers can create and update resources in development environments and deploy services.',
            rationale: 'Enable development workflows while protecting production environments.',
          },
          tags: ['development', 'engineering'],
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-06-01'),
        },
        {
          id: 'role-viewer',
          name: 'Viewer',
          description: 'Read-only access for viewing resources and dashboards',
          status: 'active' as const,
          isSystemRole: true,
          isCustomizable: true,
          priority: 100,
          inheritsFrom: undefined,
          permissions: ['perm-dashboard-read', 'perm-resources-read'],
          scopedPermissions: [],
          conditions: [],
          metadata: {
            category: 'general',
            riskLevel: 'low' as const,
            complianceReferences: [],
            approvalRequired: false,
            approvers: [],
            reviewInterval: 365,
            lastReviewed: new Date(),
            nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            version: '1.0.0',
            changeHistory: [
              { timestamp: new Date('2024-01-01'), user: 'system', action: 'created' as const, reason: 'Basic read-only role' },
            ],
            documentation: 'Viewers have read-only access to dashboards and resources for monitoring purposes.',
            rationale: 'Provide visibility without modification capabilities for stakeholders.',
          },
          tags: ['read-only', 'monitoring'],
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        },
      ],
      permissions: [
        {
          id: 'perm-admin-all',
          name: 'All Administrative Access',
          description: 'Full administrative access to all system resources',
          resource: 'custom' as const,
          actions: ['create' as const, 'read' as const, 'update' as const, 'delete' as const, 'admin' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [
            { type: 'mfa' as const, config: { required: true }, enforce: true },
            { type: 'ip-range' as const, config: { allowedRanges: ['10.0.0.0/8'] }, enforce: true },
          ],
          status: 'granted' as const,
          metadata: {
            category: 'administration',
            sensitivity: 'restricted' as const,
            complianceRequirements: ['SOC-2', 'ISO-27001', 'PCI-DSS'],
            riskScore: 100,
            requiresApproval: true,
            approvers: ['ceo', 'ciso', 'board'],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-users-manage',
          name: 'User Management',
          description: 'Create, read, update, and delete users',
          resource: 'users' as const,
          actions: ['create' as const, 'read' as const, 'update' as const, 'delete' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [
            { type: 'mfa' as const, config: { required: true }, enforce: true },
          ],
          status: 'granted' as const,
          metadata: {
            category: 'administration',
            sensitivity: 'confidential' as const,
            complianceRequirements: ['SOC-2', 'GDPR'],
            riskScore: 85,
            requiresApproval: false,
            approvers: ['ciso'],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-roles-manage',
          name: 'Role Management',
          description: 'Create, read, update, and delete roles',
          resource: 'roles' as const,
          actions: ['create' as const, 'read' as const, 'update' as const, 'delete' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [
            { type: 'mfa' as const, config: { required: true }, enforce: true },
          ],
          status: 'granted' as const,
          metadata: {
            category: 'administration',
            sensitivity: 'confidential' as const,
            complianceRequirements: ['SOC-2', 'ISO-27001'],
            riskScore: 90,
            requiresApproval: true,
            approvers: ['ciso', 'cto'],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-policies-manage',
          name: 'Policy Management',
          description: 'Create, read, update, and delete access policies',
          resource: 'policies' as const,
          actions: ['create' as const, 'read' as const, 'update' as const, 'delete' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [
            { type: 'mfa' as const, config: { required: true }, enforce: true },
          ],
          status: 'granted' as const,
          metadata: {
            category: 'administration',
            sensitivity: 'restricted' as const,
            complianceRequirements: ['SOC-2', 'ISO-27001', 'PCI-DSS'],
            riskScore: 95,
            requiresApproval: true,
            approvers: ['ciso', 'compliance-officer'],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-users-read',
          name: 'Read Users',
          description: 'Read-only access to user information',
          resource: 'users' as const,
          actions: ['read' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'administration',
            sensitivity: 'confidential' as const,
            complianceRequirements: ['GDPR'],
            riskScore: 60,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-users-write',
          name: 'Write Users',
          description: 'Create and update users',
          resource: 'users' as const,
          actions: ['create' as const, 'update' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'administration',
            sensitivity: 'confidential' as const,
            complianceRequirements: ['GDPR'],
            riskScore: 70,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-resources-manage',
          name: 'Manage Resources',
          description: 'Full access to manage system resources',
          resource: 'resources' as const,
          actions: ['create' as const, 'read' as const, 'update' as const, 'delete' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'operations',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 65,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-resources-read',
          name: 'Read Resources',
          description: 'Read-only access to resources',
          resource: 'resources' as const,
          actions: ['read' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'operations',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 30,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-services-execute',
          name: 'Execute Services',
          description: 'Execute and run services',
          resource: 'services' as const,
          actions: ['execute' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'operations',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 50,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-audit-read',
          name: 'Read Audit Logs',
          description: 'Read-only access to audit logs',
          resource: 'audit-logs' as const,
          actions: ['read' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'compliance',
            sensitivity: 'confidential' as const,
            complianceRequirements: ['SOC-2', 'ISO-27001', 'PCI-DSS'],
            riskScore: 40,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-logs-read',
          name: 'Read System Logs',
          description: 'Read-only access to system logs',
          resource: 'audit-logs' as const,
          actions: ['read' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'operations',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 35,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-policies-read',
          name: 'Read Policies',
          description: 'Read-only access to access policies',
          resource: 'policies' as const,
          actions: ['read' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'administration',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 30,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-resources-create',
          name: 'Create Resources',
          description: 'Create new resources',
          resource: 'resources' as const,
          actions: ['create' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'development',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 55,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-resources-update',
          name: 'Update Resources',
          description: 'Update existing resources',
          resource: 'resources' as const,
          actions: ['update' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'development',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 55,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-services-deploy',
          name: 'Deploy Services',
          description: 'Deploy services to environments',
          resource: 'services' as const,
          actions: ['create' as const, 'update' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [
            { type: 'time-window' as const, config: { allowedHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] }, enforce: true },
          ],
          status: 'granted' as const,
          metadata: {
            category: 'development',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 60,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'perm-dashboard-read',
          name: 'Read Dashboards',
          description: 'Read-only access to monitoring dashboards',
          resource: 'resources' as const,
          actions: ['read' as const],
          effect: 'allow' as const,
          isSystemPermission: true,
          constraints: [],
          status: 'granted' as const,
          metadata: {
            category: 'monitoring',
            sensitivity: 'internal' as const,
            complianceRequirements: [],
            riskScore: 20,
            requiresApproval: false,
            approvers: [],
          },
          createdAt: new Date('2024-01-01'),
        },
      ],
      policies: [
        {
          id: 'policy-admin-access',
          name: 'Administrator Access Policy',
          description: 'Policy governing administrator access to system resources',
          status: 'active' as const,
          priority: 1,
          statements: [
            {
              id: 'stmt-admin-allow',
              effect: 'allow' as const,
              principals: [
                { type: 'role' as const, id: 'role-super-admin' },
                { type: 'role' as const, id: 'role-admin' },
              ],
              actions: ['create' as const, 'read' as const, 'update' as const, 'delete' as const, 'admin' as const],
              resources: [
                { type: 'wildcard' as const, pattern: '*' },
              ],
              conditions: [],
              overrideEffect: true,
            },
          ],
          version: '1.0.0',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
          effectiveFrom: new Date('2024-01-01'),
          metadata: {
            description: 'Grants full access to administrators',
            owner: 'ciso',
            tags: ['admin', 'full-access'],
            complianceReferences: ['SOC-2', 'ISO-27001'],
            riskLevel: 'critical' as const,
            changeHistory: [
              { timestamp: new Date('2024-01-01'), user: 'system', action: 'created', reason: 'Initial policy' },
            ],
          },
        },
        {
          id: 'policy-operator-access',
          name: 'Operator Access Policy',
          description: 'Policy for operational access to resources',
          status: 'active' as const,
          priority: 10,
          statements: [
            {
              id: 'stmt-operator-allow',
              effect: 'allow' as const,
              principals: [
                { type: 'role' as const, id: 'role-operator' },
              ],
              actions: ['read' as const, 'execute' as const],
              resources: [
                { type: 'prefix' as const, pattern: '/services/*' },
                { type: 'exact' as const, pattern: '/api/health' },
              ],
              conditions: [
                { type: 'string' as const, operator: 'equals', key: 'environment', value: 'production' },
              ],
            },
          ],
          version: '1.0.0',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date(),
          effectiveFrom: new Date('2024-01-15'),
          metadata: {
            description: 'Grants operational access for service monitoring',
            owner: 'ops-manager',
            tags: ['operations', 'read-only'],
            complianceReferences: [],
            riskLevel: 'low' as const,
            changeHistory: [
              { timestamp: new Date('2024-01-15'), user: 'ops-manager', action: 'created', reason: 'Operations workflow' },
            ],
          },
        },
      ],
      assignments: [
        {
          id: 'assign-001',
          userId: 'user-admin-001',
          roleId: 'role-super-admin',
          status: 'active' as const,
          assignedBy: 'system',
          assignedAt: new Date('2024-01-01'),
          conditions: [],
          context: { source: 'direct' as const, reason: 'Initial super admin' },
          isTemporary: false,
          requiresApproval: true,
          approvedBy: 'ceo',
          approvedAt: new Date('2024-01-01'),
        },
        {
          id: 'assign-002',
          userId: 'user-admin-002',
          roleId: 'role-admin',
          status: 'active' as const,
          assignedBy: 'user-admin-001',
          assignedAt: new Date('2024-01-15'),
          conditions: [],
          context: { source: 'direct' as const, reason: 'IT Administrator' },
          isTemporary: false,
          requiresApproval: false,
        },
        {
          id: 'assign-003',
          userId: 'user-operator-001',
          roleId: 'role-operator',
          status: 'active' as const,
          assignedBy: 'user-admin-002',
          assignedAt: new Date('2024-02-01'),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          conditions: [
            { type: 'time' as const, field: 'hour', operator: 'between', value: [8, 18] },
          ],
          context: { source: 'direct' as const, reason: 'Operations team member' },
          isTemporary: false,
          requiresApproval: false,
        },
        {
          id: 'assign-004',
          userId: 'user-dev-001',
          roleId: 'role-developer',
          status: 'active' as const,
          assignedBy: 'user-admin-002',
          assignedAt: new Date('2024-02-15'),
          conditions: [],
          context: { source: 'direct' as const, reason: 'Development team member', ticketId: 'REQ-12345' },
          isTemporary: false,
          requiresApproval: false,
        },
        {
          id: 'assign-005',
          userId: 'user-viewer-001',
          roleId: 'role-viewer',
          status: 'active' as const,
          assignedBy: 'user-admin-002',
          assignedAt: new Date('2024-03-01'),
          conditions: [],
          context: { source: 'direct' as const, reason: 'Executive dashboard access' },
          isTemporary: false,
          requiresApproval: false,
        },
      ],
      groups: [
        {
          id: 'group-administrators',
          name: 'Administrators',
          description: 'System administrators group',
          type: 'department' as const,
          status: 'active' as const,
          members: ['user-admin-001', 'user-admin-002'],
          roles: ['role-admin'],
          inheritsFrom: [],
          owners: ['user-admin-001'],
          metadata: {
            category: 'administration',
            department: 'IT',
            costCenter: 'CC-001',
            location: 'HQ',
            externalSync: true,
            syncSource: 'LDAP',
            lastSyncedAt: new Date(),
          },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date(),
        },
        {
          id: 'group-operations',
          name: 'Operations Team',
          description: 'Operations and DevOps engineers',
          type: 'team' as const,
          status: 'active' as const,
          members: ['user-operator-001'],
          roles: ['role-operator'],
          inheritsFrom: [],
          owners: ['user-admin-002'],
          metadata: {
            category: 'operations',
            department: 'Operations',
            costCenter: 'CC-002',
            externalSync: false,
          },
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date(),
        },
        {
          id: 'group-development',
          name: 'Development Team',
          description: 'Software developers',
          type: 'team' as const,
          status: 'active' as const,
          members: ['user-dev-001'],
          roles: ['role-developer'],
          inheritsFrom: [],
          owners: ['user-admin-002'],
          metadata: {
            category: 'development',
            department: 'Engineering',
            costCenter: 'CC-003',
            externalSync: true,
            syncSource: 'Okta',
            lastSyncedAt: new Date(),
          },
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date(),
        },
      ],
      resourceHierarchy: [
        {
          id: 'resource-root',
          name: 'System Root',
          type: 'root',
          path: '/',
          permissions: ['perm-admin-all'],
          children: ['resource-organization'],
          metadata: {
            owner: 'system',
            classification: 'restricted' as const,
            tags: ['system', 'root'],
            complianceRequirements: [],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date(),
          },
        },
        {
          id: 'resource-organization',
          name: 'Organization Resources',
          type: 'organization',
          parentId: 'resource-root',
          path: '/org',
          permissions: ['perm-resources-read'],
          children: ['resource-production', 'resource-development'],
          metadata: {
            owner: 'c-level',
            classification: 'confidential' as const,
            tags: ['organization'],
            complianceRequirements: ['SOC-2'],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date(),
          },
        },
        {
          id: 'resource-production',
          name: 'Production Environment',
          type: 'environment',
          parentId: 'resource-organization',
          path: '/org/production',
          permissions: ['perm-admin-all', 'perm-resources-manage'],
          children: ['resource-prod-services'],
          metadata: {
            owner: 'ops-manager',
            classification: 'confidential' as const,
            tags: ['production', 'critical'],
            complianceRequirements: ['SOC-2', 'ISO-27001', 'PCI-DSS'],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date(),
          },
        },
        {
          id: 'resource-development',
          name: 'Development Environment',
          type: 'environment',
          parentId: 'resource-organization',
          path: '/org/development',
          permissions: ['perm-resources-create', 'perm-resources-update', 'perm-services-deploy'],
          children: ['resource-dev-services'],
          metadata: {
            owner: 'engineering-manager',
            classification: 'internal' as const,
            tags: ['development', 'sandbox'],
            complianceRequirements: [],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date(),
          },
        },
      ],
      auditLogs: [
        {
          id: 'audit-001',
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          userId: 'user-admin-001',
          action: 'create',
          resource: '/users/user-operator-001',
          resourceType: 'users',
          outcome: 'allowed' as const,
          reason: 'User creation approved',
          ipAddress: '10.0.1.100',
          userAgent: 'Mozilla/5.0',
          sessionContext: {
            sessionId: 'sess-12345',
            mfaVerified: true,
            sessionAge: 1800,
            loginTime: new Date(Date.now() - 60 * 60 * 1000),
            lastActivity: new Date(),
          },
          policyEvaluated: 'policy-admin-access',
          rolesUsed: ['role-super-admin'],
          permissionsChecked: ['perm-users-write'],
        },
        {
          id: 'audit-002',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          userId: 'user-operator-001',
          action: 'read',
          resource: '/services/api-status',
          resourceType: 'services',
          outcome: 'allowed' as const,
          ipAddress: '10.0.2.50',
          userAgent: 'curl/7.68.0',
          sessionContext: {
            sessionId: 'sess-12346',
            mfaVerified: false,
            sessionAge: 900,
            loginTime: new Date(Date.now() - 30 * 60 * 1000),
            lastActivity: new Date(),
          },
          policyEvaluated: 'policy-operator-access',
          rolesUsed: ['role-operator'],
          permissionsChecked: ['perm-services-execute'],
        },
        {
          id: 'audit-003',
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          userId: 'user-viewer-001',
          action: 'delete',
          resource: '/users/user-dev-001',
          resourceType: 'users',
          outcome: 'denied' as const,
          reason: 'Insufficient permissions for delete action',
          ipAddress: '10.0.3.75',
          userAgent: 'Mozilla/5.0',
          sessionContext: {
            sessionId: 'sess-12347',
            mfaVerified: false,
            sessionAge: 300,
            loginTime: new Date(Date.now() - 15 * 60 * 1000),
            lastActivity: new Date(),
          },
          policyEvaluated: 'policy-admin-access',
          rolesUsed: ['role-viewer'],
          permissionsChecked: ['perm-dashboard-read'],
        },
      ],
    };

    displayRBACConfig(finalConfig);

    await writeRBACFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: rbac-${providers.join('.tf, rbac-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'rbac-manager.ts' : 'rbac_manager.py'}`));
    console.log(chalk.green('✅ Generated: RBAC.md'));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green('✅ Generated: rbac-config.json\n'));

    console.log(chalk.green('✓ RBAC and access control management configured successfully!'));
  }));

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
    const { writeAuditFiles, displayAuditConfig } = await import('../utils/audit-trail.js');

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
    const { writePrivacyFiles, displayPrivacyConfig } = await import('../utils/data-privacy.js');

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

  security
  .command('regulatory')
  .description('Generate regulatory reporting automation with compliance dashboards')
  .argument('<name>', 'Name of the regulatory reporting project')
  .option('--auto-generate', 'Enable automated report generation')
  .option('--frequency <frequency>', 'Report generation frequency', 'quarterly')
  .option('--formats <formats>', 'Report formats (comma-separated)', 'pdf,json')
  .option('--include-evidence', 'Include evidence in reports')
  .option('--evidence-retention <days>', 'Evidence retention period in days', '2555')
  .option('--require-approval', 'Require approval for reports')
  .option('--compliance-threshold <threshold>', 'Compliance threshold (0-100)', '80')
  .option('--enable-gap-analysis', 'Enable gap analysis')
  .option('--include-recommendations', 'Include recommendations in reports')
  .option('--sign-reports', 'Enable report signing')
  .option('--enable-dashboard', 'Enable compliance dashboard')
  .option('--dashboard-refresh <minutes>', 'Dashboard refresh interval in minutes', '5')
  .option('--enable-realtime', 'Enable real-time updates')
  .option('--enable-trends', 'Enable trend analysis')
  .option('--trend-period <days>', 'Trend analysis period in days', '90')
  .option('--enable-benchmarking', 'Enable industry benchmarking')
  .option('--benchmark-industry <industry>', 'Benchmark industry', 'technology')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './regulatory-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeRegulatoryFiles, displayRegulatoryConfig } = await import('../utils/regulatory-reporting.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const formats = options.formats.split(',').map((f: string) => f.trim()) as Array<'pdf' | 'json' | 'html' | 'xml' | 'csv' | 'excel'>;

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoGenerate: options.autoGenerate || true,
        frequency: options.frequency as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'on-demand',
        formats,
        includeEvidence: options.includeEvidence || true,
        evidenceRetentionDays: parseInt(options.evidenceRetention),
        requireApproval: options.requireApproval || true,
        approvers: ['ciso', 'compliance-officer', 'audit-manager'],
        notificationChannels: [
          { type: 'email' as const, enabled: true, recipients: ['compliance@company.com'] },
          { type: 'slack' as const, enabled: true, recipients: ['#compliance'] },
        ],
        customLogo: undefined,
        watermarkReports: true,
        archiveLocation: '/archive/compliance',
        enableEncryption: true,
        complianceThreshold: parseInt(options.complianceThreshold),
        enableGapAnalysis: options.enableGapAnalysis || true,
        includeRecommendations: options.includeRecommendations || true,
        signReports: options.signReports || false,
        enableDashboard: options.enableDashboard || true,
        dashboardRefreshInterval: parseInt(options.dashboardRefresh),
        enableRealTimeUpdates: options.enableRealtime || false,
        enableTrendAnalysis: options.enableTrends || true,
        trendAnalysisPeriod: parseInt(options.trendPeriod),
        enableBenchmarking: options.enableBenchmarking || false,
        benchmarkIndustry: options.benchmarkIndustry,
      },
      dashboards: [
        {
          id: 'dash-001',
          name: 'Executive Compliance Dashboard',
          description: 'High-level compliance overview for executives',
          period: 'monthly' as const,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          lastRefresh: new Date(),
          refreshInterval: parseInt(options.dashboardRefresh),
          enabled: true,
          widgets: [
            {
              id: 'widget-001',
              type: 'metric' as const,
              title: 'Overall Compliance Score',
              position: { x: 0, y: 0 },
              size: { width: 4, height: 3 },
              dataSource: { type: 'aggregated' as const, aggregation: { function: 'avg' as const, field: 'score' } },
              config: { showLabels: true },
              thresholds: [
                { label: 'Excellent', value: 95, color: 'green', operator: 'gte' as const },
                { label: 'Good', value: 80, color: 'yellow', operator: 'gte' as const },
                { label: 'Poor', value: 0, color: 'red', operator: 'gte' as const },
              ],
            },
            {
              id: 'widget-002',
              type: 'chart' as const,
              title: 'Compliance Trend',
              position: { x: 4, y: 0 },
              size: { width: 8, height: 3 },
              dataSource: { type: 'aggregated' as const, aggregation: { function: 'avg' as const, field: 'score' } },
              config: { chartType: 'line' as const, legend: true, showDataPoints: true },
            },
            {
              id: 'widget-003',
              type: 'table' as const,
              title: 'Open Findings',
              position: { x: 0, y: 3 },
              size: { width: 12, height: 4 },
              dataSource: { type: 'query' as const, query: 'SELECT * FROM findings WHERE status="open"' },
            },
          ],
          metrics: [
            {
              id: 'metric-001',
              name: 'Compliance Score',
              description: 'Overall compliance percentage',
              value: 87,
              unit: '%',
              trend: 'up' as const,
              trendPercent: 5.2,
              status: 'partial' as const,
              lastUpdated: new Date(),
              target: 95,
              thresholds: [
                { label: 'Excellent', value: 95, color: 'green', operator: 'gte' as const },
                { label: 'Good', value: 80, color: 'yellow', operator: 'gte' as const },
              ],
            },
            {
              id: 'metric-002',
              name: 'Open Findings',
              description: 'Number of open compliance findings',
              value: 23,
              unit: '',
              trend: 'down' as const,
              trendPercent: -12.5,
              status: 'non-compliant' as const,
              lastUpdated: new Date(),
              target: 0,
              thresholds: [
                { label: 'Critical', value: 50, color: 'red', operator: 'gt' as const },
                { label: 'Warning', value: 20, color: 'yellow', operator: 'gt' as const },
              ],
            },
            {
              id: 'metric-003',
              name: 'Controls Tested',
              description: 'Percentage of controls tested',
              value: 94,
              unit: '%',
              trend: 'stable' as const,
              trendPercent: 0,
              status: 'compliant' as const,
              lastUpdated: new Date(),
              target: 100,
            },
          ],
          filters: [
            {
              id: 'filter-001',
              name: 'Framework',
              field: 'framework',
              type: 'dropdown' as const,
              options: [
                { label: 'All', value: '' },
                { label: 'SOX', value: 'sox' },
                { label: 'GDPR', value: 'gdpr' },
                { label: 'HIPAA', value: 'hipaa' },
                { label: 'PCI-DSS', value: 'pci-dss' },
              ],
              defaultValue: '',
              required: false,
            },
            {
              id: 'filter-002',
              name: 'Date Range',
              field: 'date',
              type: 'date-range' as const,
              required: false,
            },
          ],
          accessControls: ['executive', 'compliance-officer'],
          layout: { columns: 12, rowHeight: 40, padding: 16, margin: 8 },
          theme: {
            primary: '#2563eb',
            secondary: '#64748b',
            background: '#ffffff',
            text: '#0f172a',
            accent: '#3b82f6',
            mode: 'light' as const,
          },
          drilling: {
            enabled: true,
            levels: [
              { name: 'Framework Details', filters: { framework: '$framework' } },
              { name: 'Control Details', filters: { controlId: '$controlId' } },
            ],
          },
        },
      ],
      reports: [
        {
          id: 'rpt-001',
          name: 'Q4 2024 SOX Compliance Report',
          reportType: 'sox' as const,
          reportingPeriod: {
            start: new Date('2024-10-01'),
            end: new Date('2024-12-31'),
          },
          generatedAt: new Date('2024-12-31'),
          generatedBy: 'compliance-officer',
          status: 'approved' as const,
          format: 'pdf' as const,
          overallScore: 87,
          complianceStatus: 'partial' as const,
          summary: {
            totalControls: 145,
            compliantControls: 126,
            nonCompliantControls: 8,
            partialControls: 8,
            notApplicableControls: 3,
            totalFindings: 23,
            findingsBySeverity: { critical: 2, high: 8, medium: 10, low: 3 },
            completionPercentage: 97,
            riskScore: 35,
          },
          controls: [
            {
              controlId: 'SOX-404-001',
              title: 'Access Control',
              description: 'Ensure proper access controls over financial systems',
              status: 'compliant' as const,
              testDate: new Date('2024-12-15'),
              tester: 'audit-team',
              findings: [],
              evidenceIds: ['evg-001', 'evg-002'],
              riskLevel: 'high' as const,
              nextReviewDate: new Date('2025-03-15'),
              framework: 'sox' as const,
            },
            {
              controlId: 'SOX-302-001',
              title: 'Internal Control',
              description: 'Maintain internal controls over financial reporting',
              status: 'non-compliant' as const,
              riskLevel: 'high' as const,
              findings: ['find-001'],
              evidenceIds: ['evg-003'],
              nextReviewDate: new Date('2025-01-31'),
              framework: 'sox' as const,
            },
          ],
          findings: [
            {
              id: 'find-001',
              control: 'SOX-302-001',
              severity: 'high' as const,
              title: 'Segregation of Duties Gap',
              description: 'ERP system lacks proper role separation for financial approvals',
              impact: 'Potential for unauthorized or fraudulent financial transactions',
              recommendation: 'Configure role-based approval workflows in ERP system',
              discoveredDate: new Date('2024-12-10'),
              discoveredBy: 'internal-audit',
              status: 'remediating' as const,
              assignedTo: 'finance-manager',
              dueDate: new Date('2025-01-31'),
              relatedEvidence: ['evg-003'],
              remediationPlan: 'Implement separate approval roles for purchase orders and payments',
            },
            {
              id: 'find-002',
              control: 'SOX-404-003',
              severity: 'critical' as const,
              title: 'Missing Review Documentation',
              description: 'Quarterly review documentation not maintained for Q3',
              impact: 'Unable to demonstrate proper review procedures',
              recommendation: 'Implement automated documentation capture for all reviews',
              discoveredDate: new Date('2024-11-15'),
              discoveredBy: 'external-audit',
              status: 'open' as const,
              assignedTo: 'compliance-officer',
              dueDate: new Date('2025-01-15'),
              relatedEvidence: [],
            },
          ],
          evidence: ['evg-001', 'evg-002', 'evg-003'],
          signoffs: [
            {
              role: 'CFO',
              name: 'John Smith',
              email: 'john.smith@company.com',
              signedAt: new Date('2025-01-05'),
              signature: 'digital-signature-abc123',
            },
            {
              role: 'External Auditor',
              name: 'Big 4 Audit Firm',
              email: 'auditor@big4.com',
              signedAt: new Date('2025-01-08'),
              signature: 'digital-signature-def456',
            },
          ],
          attachments: [
            {
              name: 'detailed-findings.xlsx',
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              size: 245760,
              location: '/s3/compliance/Q4-2024/detailed-findings.xlsx',
              uploadedAt: new Date('2024-12-31'),
              uploadedBy: 'compliance-officer',
            },
          ],
          metadata: {
            version: '1.0',
            lastModifiedDate: new Date('2025-01-08'),
            lastModifiedBy: 'external-auditor',
            reviewCycle: '2024-Q4',
            auditTrail: [
              { timestamp: new Date('2024-12-31'), user: 'compliance-officer', action: 'created', details: 'Initial report creation' },
              { timestamp: new Date('2025-01-05'), user: 'cfo', action: 'approved', details: 'CFO approval obtained' },
              { timestamp: new Date('2025-01-08'), user: 'external-auditor', action: 'approved', details: 'External auditor signoff' },
            ],
            tags: ['sox', 'q4-2024', 'financial-reporting'],
          },
        },
      ],
      controls: [
        {
          id: 'ctrl-001',
          framework: 'sox' as const,
          controlId: 'SOX-404-001',
          title: 'Access Control',
          description: 'Ensure proper access controls over financial systems',
          category: 'IT General Controls',
          status: 'compliant' as const,
          riskLevel: 'high' as const,
          testingRequired: true,
          testFrequency: 'quarterly' as const,
          lastTestedDate: new Date('2024-12-15'),
          nextTestDueDate: new Date('2025-03-15'),
          owner: 'it-director',
          tester: 'audit-team',
          testProcedures: [
            {
              id: 'proc-001',
              name: 'Access Review',
              description: 'Review system access logs for financial systems',
              steps: [
                { order: 1, action: 'Extract access logs', expectedResult: 'Logs retrieved', screenshot: false, evidenceRequired: true },
                { order: 2, action: 'Verify user access levels', expectedResult: 'Access levels appropriate', screenshot: true, evidenceRequired: true },
                { order: 3, action: 'Check for orphaned accounts', expectedResult: 'No orphaned accounts', screenshot: false, evidenceRequired: true },
              ],
              expectedResult: 'All access properly authorized',
              tools: ['AWS CloudTrail', 'Splunk'],
              estimatedTime: 120,
            },
          ],
          automatedChecks: [
            {
              id: 'auto-001',
              name: 'Privileged Access Check',
              type: 'config-scan' as const,
              endpoint: 'arn:aws:lambda:us-east-1:123456789:function:access-check',
              schedule: '0 1 * * *',
              lastRunDate: new Date('2024-12-15'),
              lastResult: 'pass' as const,
              threshold: '0 violations',
            },
          ],
          manualChecks: [
            {
              id: 'manual-001',
              name: 'Manager Review',
              instructions: 'Review access list with system owners',
              checklist: [
                { item: 'Review completed', completed: true, completedBy: 'it-manager', completedDate: new Date('2024-12-10') },
                { item: 'Exceptions documented', completed: true, completedBy: 'it-manager', completedDate: new Date('2024-12-10') },
              ],
              frequency: 'quarterly',
              assignee: 'it-manager',
              dueDate: new Date('2024-12-15'),
              evidenceRequired: true,
            },
          ],
          evidenceRequired: [
            {
              id: 'evg-req-001',
              type: 'log-file' as const,
              description: 'System access logs',
              required: true,
              retentionPeriod: 2555,
              collectionMethod: 'automated' as const,
              source: 'aws-cloudtrail',
              frequency: 'daily',
              relatedControls: ['SOX-404-001'],
            },
          ],
          complianceMappings: [
            { framework: 'iso-27001' as const, controlId: 'A.9.2.1', mappingType: 'equivalent' as const },
            { framework: 'nist-800-53' as const, controlId: 'AC-6', mappingType: 'partial' as const },
          ],
        },
        {
          id: 'ctrl-002',
          framework: 'gdpr' as const,
          controlId: 'ARTICLE-32',
          title: 'Security of Processing',
          description: 'Implement appropriate technical and organizational security measures',
          category: 'Security',
          status: 'partial' as const,
          riskLevel: 'medium' as const,
          testingRequired: true,
          testFrequency: 'semi-annual' as const,
          lastTestedDate: new Date('2024-06-15'),
          nextTestDueDate: new Date('2025-06-15'),
          owner: 'dpo',
          tester: 'security-team',
          testProcedures: [],
          automatedChecks: [],
          manualChecks: [],
          evidenceRequired: [],
          complianceMappings: [
            { framework: 'iso-27001' as const, controlId: 'A.12', mappingType: 'equivalent' as const },
            { framework: 'nist-800-53' as const, controlId: 'SC-12', mappingType: 'equivalent' as const },
          ],
        },
      ],
      frameworks: [
        {
          id: 'fw-001',
          name: 'SOX Compliance Framework',
          type: 'sox' as const,
          version: '2024',
          description: 'Sarbanes-Oxley Act compliance requirements',
          enabled: true,
          controls: ['ctrl-001'],
          requirements: [
            {
              id: 'req-001',
              requirementId: 'SOX-404',
              title: 'Management Assessment of Internal Controls',
              description: 'Management must assess internal controls over financial reporting',
              category: 'Internal Controls',
              obligationType: 'mandatory' as const,
              controls: ['SOX-404-001'],
              evidenceRequired: ['control-documentation', 'test-results', 'management-assertation'],
              dueDate: new Date('2024-12-31'),
              status: 'met' as const,
              assignee: 'cfo',
              risk: 'high' as const,
              lastAssessedDate: new Date('2024-12-15'),
              nextAssessmentDate: new Date('2025-03-31'),
            },
          ],
          mappings: [],
          lastAssessmentDate: new Date('2024-12-15'),
          nextAssessmentDate: new Date('2025-03-31'),
        },
        {
          id: 'fw-002',
          name: 'GDPR Compliance Framework',
          type: 'gdpr' as const,
          version: '2018',
          description: 'General Data Protection Regulation compliance',
          enabled: true,
          controls: ['ctrl-002'],
          requirements: [
            {
              id: 'req-002',
              requirementId: 'ARTICLE-15',
              title: 'Right of Access by Data Subject',
              description: 'Data subjects have right to confirmation and access to personal data',
              category: 'Data Subject Rights',
              obligationType: 'mandatory' as const,
              controls: ['GDPR-ART15-001'],
              evidenceRequired: ['subject-request-logs', 'response-documentation'],
              status: 'met' as const,
              assignee: 'dpo',
              risk: 'critical' as const,
              lastAssessedDate: new Date('2024-11-01'),
              nextAssessmentDate: new Date('2025-05-25'),
            },
          ],
          mappings: [],
          lastAssessmentDate: new Date('2024-11-01'),
          nextAssessmentDate: new Date('2025-05-25'),
        },
      ],
      workflows: [
        {
          id: 'wf-001',
          name: 'SOX Report Approval Workflow',
          description: 'Automated approval workflow for SOX compliance reports',
          reportType: 'sox' as const,
          status: 'in-progress' as const,
          stages: [
            {
              order: 1,
              name: 'Draft Generation',
              description: 'Generate initial report draft',
              status: 'completed' as const,
              assignee: 'compliance-analyst',
              startedAt: new Date('2025-01-02'),
              completedAt: new Date('2025-01-03'),
              duration: 240,
              actions: [
                {
                  id: 'act-001',
                  name: 'Collect Evidence',
                  description: 'Gather evidence from all control owners',
                  type: 'manual' as const,
                  completed: true,
                  completedAt: new Date('2025-01-02'),
                  dependencies: [],
                },
                {
                  id: 'act-002',
                  name: 'Generate Report',
                  description: 'Create report document',
                  type: 'automated' as const,
                  completed: true,
                  completedAt: new Date('2025-01-03'),
                  dependencies: ['act-001'],
                },
              ],
              dependencies: [],
            },
            {
              order: 2,
              name: 'Management Review',
              description: 'Review by management',
              status: 'in-progress' as const,
              assignee: 'cfo',
              startedAt: new Date('2025-01-04'),
              actions: [
                {
                  id: 'act-003',
                  name: 'Review Findings',
                  description: 'Review all findings and remediation plans',
                  type: 'manual' as const,
                  completed: false,
                  dependencies: [],
                },
              ],
              dependencies: ['1'],
            },
            {
              order: 3,
              name: 'External Audit',
              description: 'Review by external auditor',
              status: 'pending' as const,
              actions: [],
              dependencies: ['2'],
            },
          ],
          currentStage: 2,
          initiatedBy: 'compliance-officer',
          initiatedAt: new Date('2025-01-02'),
          approvers: [
            {
              userId: 'user-cfo',
              name: 'John Smith',
              email: 'john.smith@company.com',
              role: 'CFO',
              stage: 2,
              approvalStatus: 'pending' as const,
            },
          ],
          notifications: [
            {
              type: 'email' as const,
              recipient: 'cfo@company.com',
              template: 'report-review-reminder',
              trigger: 'stage-start' as const,
              sent: true,
              sentAt: new Date('2025-01-04'),
            },
          ],
          metadata: {
            estimatedDuration: 720,
            priority: 'high' as const,
            tags: ['sox', 'q4-2024'],
            version: 1,
          },
        },
      ],
      alerts: [
        {
          id: 'alert-001',
          name: 'Compliance Score Drop Alert',
          description: 'Alert when compliance score drops below threshold',
          severity: 'high' as const,
          enabled: true,
          conditions: [
            { type: 'threshold' as const, field: 'complianceScore', operator: 'lt' as const, value: 80 },
          ],
          actions: [
            { type: 'email' as const, target: 'compliance@company.com', template: 'score-drop-alert' },
            { type: 'slack' as const, target: '#compliance', config: { channel: '#compliance' } },
          ],
          throttleMinutes: 60,
          lastTriggered: new Date('2024-12-20'),
          notificationChannels: ['email' as const, 'slack' as const],
          metadata: {
            category: 'compliance-monitoring',
            source: 'dashboard',
            createdDate: new Date('2024-01-01'),
            createdBy: 'admin',
            tags: ['score', 'threshold'],
          },
        },
        {
          id: 'alert-002',
          name: 'Critical Finding Alert',
          description: 'Alert on critical severity findings',
          severity: 'critical' as const,
          enabled: true,
          conditions: [
            { type: 'compliance' as const, field: 'findingSeverity', operator: 'eq' as const, value: 'critical' },
          ],
          actions: [
            { type: 'email' as const, target: 'ciso@company.com,cfo@company.com', template: 'critical-finding-alert' },
            { type: 'pagerduty' as const, target: 'compliance-on-call', config: { severity: 'critical' } },
          ],
          throttleMinutes: 15,
          lastTriggered: new Date('2024-12-15'),
          notificationChannels: ['email', 'pagerduty'],
          metadata: {
            category: 'finding-alerts',
            source: 'reporting',
            createdDate: new Date('2024-01-01'),
            createdBy: 'security-admin',
            tags: ['critical', 'findings'],
          },
        },
      ],
      schedules: [
        {
          id: 'sched-001',
          name: 'Quarterly SOX Report',
          reportType: 'sox' as const,
          frequency: 'quarterly' as const,
          enabled: true,
          cronExpression: '0 0 1 1,4,7,10 *',
          timezone: 'UTC',
          recipients: ['cfo@company.com', 'compliance@company.com'],
          formats: ['pdf' as const, 'json' as const],
          includeEvidence: true,
          nextRunDate: new Date('2025-04-01'),
          lastRunDate: new Date('2025-01-01'),
          parameters: {
            frameworks: ['sox' as const],
            scope: {
              includedAssets: ['financial-system', 'erp'],
              excludedAssets: [],
              departments: ['finance', 'accounting'],
              regions: ['us-east-1', 'us-west-2'],
            },
            filters: { includeDraftControls: false },
          },
        },
        {
          id: 'sched-002',
          name: 'Monthly Dashboard Refresh',
          reportType: 'gdpr' as const,
          frequency: 'monthly' as const,
          enabled: true,
          cronExpression: '0 0 1 * *',
          timezone: 'UTC',
          recipients: ['dpo@company.com'],
          formats: ['html' as const],
          includeEvidence: false,
          nextRunDate: new Date('2025-02-01'),
          lastRunDate: new Date('2025-01-01'),
          parameters: {
            frameworks: ['gdpr' as const],
            scope: {
              includedAssets: [],
              excludedAssets: [],
              departments: [],
              regions: [],
            },
          },
        },
      ],
      evidence: [
        {
          id: 'evg-001',
          type: 'screenshot' as const,
          title: 'ERP Access Settings',
          description: 'Screenshot of ERP access control configuration',
          collectedDate: new Date('2024-12-10'),
          collectedBy: 'it-auditor',
          status: 'valid' as const,
          fileLocation: '/s3/compliance/evidence/evg-001.png',
          fileName: 'erp-access-settings.png',
          fileSize: 245760,
          mimeType: 'image/png',
          hash: 'a1b2c3d4e5f6...',
          hashAlgorithm: 'SHA-256' as const,
          expiresDate: new Date('2027-12-31'),
          retentionDate: new Date('2027-12-31'),
          tags: ['sox', 'access-control', 'erp'],
          relatedControls: ['SOX-404-001'],
          relatedFindings: [],
          metadata: {
            framework: 'sox' as const,
            source: 'manual-collection',
            collectionMethod: 'screenshot',
            verified: true,
            verifiedBy: 'audit-manager',
            verifiedDate: new Date('2024-12-11'),
            uploadDate: new Date('2024-12-10'),
            uploadedBy: 'it-auditor',
            version: 1,
          },
        },
        {
          id: 'evg-002',
          type: 'log-file' as const,
          title: 'Access Review Logs',
          description: 'AWS CloudTrail logs for access review period',
          collectedDate: new Date('2024-12-15'),
          collectedBy: 'system',
          status: 'valid' as const,
          fileLocation: '/s3/compliance/evidence/evg-002.json.gz',
          fileName: 'access-review-logs.json.gz',
          fileSize: 1048576,
          mimeType: 'application/gzip',
          hash: 'f6e5d4c3b2a1...',
          hashAlgorithm: 'SHA-256' as const,
          expiresDate: new Date('2027-12-31'),
          retentionDate: new Date('2027-12-31'),
          tags: ['sox', 'logs', 'cloudtrail'],
          relatedControls: ['SOX-404-001'],
          relatedFindings: [],
          metadata: {
            source: 'aws-cloudtrail',
            collectionMethod: 'automated' as const,
            verified: true,
            verifiedBy: 'system',
            verifiedDate: new Date('2024-12-15'),
            uploadDate: new Date('2024-12-15'),
            uploadedBy: 'lambda-function',
            version: 1,
          },
        },
      ],
    };

    displayRegulatoryConfig(finalConfig, options.language);

    await writeRegulatoryFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: regulatory-${providers.join('.tf, regulatory-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'regulatory-manager.ts' : 'regulatory_manager.py'}`));
    console.log(chalk.green('✅ Generated: REGULATORY_REPORTING.md'));
    console.log(chalk.green('✅ Generated: config.example.json\n'));

    console.log(chalk.green('✓ Regulatory reporting automation configured successfully!'));
  }));

  security
  .command('risk')
  .description('Generate risk assessment and management with continuous monitoring')
  .argument('<name>', 'Name of the risk assessment project')
  .option('--auto-assess', 'Enable automated risk assessment')
  .option('--assessment-frequency <frequency>', 'Assessment frequency', 'quarterly')
  .option('--enable-monitoring', 'Enable continuous monitoring')
  .option('--monitoring-interval <minutes>', 'Monitoring interval in minutes', '60')
  .option('--enable-alerts', 'Enable real-time risk alerts')
  .option('--enable-escalation', 'Enable alert escalation')
  .option('--acceptance-threshold <threshold>', 'Risk acceptance threshold (0-100)', '50')
  .option('--require-approval', 'Require approval for risk acceptance')
  .option('--auto-mitigation', 'Auto-create mitigation plans')
  .option('--enable-heatmap', 'Enable risk heatmap visualization')
  .option('--heatmap-refresh <minutes>', 'Heatmap refresh interval in minutes', '30')
  .option('--enable-trends', 'Enable trend analysis')
  .option('--trend-period <days>', 'Trend analysis period in days', '90')
  .option('--enable-predictive', 'Enable predictive analysis')
  .option('--predictive-model <model>', 'Predictive model name', 'ml-risk-score')
  .option('--enable-dependencies', 'Enable dependency tracking')
  .option('--enable-compliance', 'Enable compliance mapping')
  .option('--compliance-frameworks <frameworks>', 'Compliance frameworks (comma-separated)', 'sox,iso-27001')
  .option('--retention <days>', 'Retention period in days', '2555')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './risk-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeRiskFiles, displayRiskConfig } = await import('../utils/risk-assessment.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const frameworks = options.complianceFrameworks.split(',').map((f: string) => f.trim()) as Array<'sox' | 'gdpr' | 'hipaa' | 'pci-dss' | 'iso-27001' | 'nist-800-53'>;

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoAssessment: options.autoAssess || true,
        assessmentFrequency: options.assessmentFrequency as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'on-demand',
        enableContinuousMonitoring: options.enableMonitoring || true,
        monitoringInterval: parseInt(options.monitoringInterval),
        enableRealTimeAlerts: options.enableAlerts || true,
        alertEscalationEnabled: options.enableEscalation || true,
        riskAcceptanceThreshold: parseInt(options.acceptanceThreshold),
        requireApprovalForAcceptance: options.requireApproval || true,
        riskApprovers: ['ciso', 'risk-manager', 'compliance-officer'],
        autoCreateMitigation: options.autoMitigation || true,
        mitigationTemplate: 'standard-mitigation',
        enableRiskHeatmap: options.enableHeatmap || true,
        heatmapRefreshInterval: parseInt(options.heatmapRefresh),
        enableTrendAnalysis: options.enableTrends || true,
        trendAnalysisPeriod: parseInt(options.trendPeriod),
        enablePredictiveAnalysis: options.enablePredictive || false,
        predictiveModel: options.predictiveModel,
        enableDependencyTracking: options.enableDependencies || true,
        enableComplianceMapping: options.enableCompliance || true,
        complianceFrameworks: frameworks,
        retentionDays: parseInt(options.retention),
        archiveLocation: '/archive/risk',
        enableReporting: true,
        reportSchedule: '0 0 1 * *',
        stakeholders: ['ciso', 'cto', 'cfo', 'ceo'],
      },
      risks: [
        {
          id: 'risk-001',
          title: 'Data Breach Risk',
          description: 'Unauthorized access to sensitive customer data stored in cloud databases',
          category: 'security' as const,
          status: 'identified' as const,
          level: 'high' as const,
          likelihood: 'medium' as const,
          impact: 'major' as const,
          score: 63,
          calculatedAt: new Date('2024-12-15'),
          source: 'automated-scan',
          owner: 'ciso',
          assignee: 'security-lead',
          mitigation: 'mit-001',
          tags: ['security', 'privacy', 'gdpr'],
          relatedAssets: ['customer-db', 'api-gateway'],
          dependencies: [],
          assessment: 'assess-001',
          findings: [
            {
              id: 'find-001',
              title: 'Unencrypted S3 Bucket',
              description: 'Customer database stored in S3 bucket without encryption',
              severity: 'high' as const,
              confidence: 95,
              discoveredAt: new Date('2024-12-15'),
              discoveredBy: 'security-scanner',
              method: 'automated' as const,
              evidence: ['scan-report-001'],
              recommendations: ['Enable S3 bucket encryption', 'Review access policies'],
            },
          ],
          history: [
            {
              timestamp: new Date('2024-12-15'),
              user: 'security-scanner',
              action: 'created',
              details: 'Risk identified during automated security scan',
            },
          ],
          metadata: {
            created: new Date('2024-12-15'),
            createdBy: 'security-scanner',
            lastModified: new Date('2024-12-15'),
            modifiedBy: 'security-scanner',
            lastAssessed: new Date('2024-12-15'),
            assessedBy: 'risk-analyst',
            nextReview: new Date('2025-03-15'),
            externalReferences: ['CVE-2024-1234'],
            complianceMapping: [
              { framework: 'gdpr', requirement: 'ARTICLE-32', control: 'encryption', mapped: true },
              { framework: 'iso-27001', requirement: 'A.10.1.1', control: 'cryptography', mapped: true },
            ],
            customFields: { ticketId: 'SEC-001', cvssScore: 7.5 },
          },
        },
        {
          id: 'risk-002',
          title: 'Third-Party Dependency Risk',
          description: 'Critical services depend on external APIs with no SLA guarantees',
          category: 'operational' as const,
          status: 'mitigating' as const,
          level: 'critical' as const,
          likelihood: 'high' as const,
          impact: 'catastrophic' as const,
          score: 88,
          calculatedAt: new Date('2024-12-10'),
          source: 'vendor-assessment',
          owner: 'cto',
          assignee: 'architecture-lead',
          mitigation: 'mit-002',
          tags: ['vendor', 'sla', 'operational'],
          relatedAssets: ['payment-api', 'notification-service'],
          dependencies: ['risk-003'],
          assessment: 'assess-001',
          findings: [
            {
              id: 'find-002',
              title: 'No SLA with Payment Gateway',
              description: 'Payment gateway provider has no guaranteed uptime SLA',
              severity: 'critical' as const,
              confidence: 100,
              discoveredAt: new Date('2024-12-10'),
              discoveredBy: 'contract-review',
              method: 'manual' as const,
              evidence: ['contract-001'],
              recommendations: ['Negotiate SLA terms', 'Implement fallback provider'],
            },
          ],
          history: [
            {
              timestamp: new Date('2024-12-10'),
              user: 'contract-manager',
              action: 'created',
              details: 'Identified during vendor contract review',
            },
            {
              timestamp: new Date('2024-12-12'),
              user: 'cto',
              action: 'escalated',
              details: 'Escalated to executive leadership for SLA negotiation',
              newState: { status: 'mitigating' as const },
            },
          ],
          metadata: {
            created: new Date('2024-12-10'),
            createdBy: 'contract-manager',
            lastModified: new Date('2024-12-12'),
            modifiedBy: 'cto',
            lastAssessed: new Date('2024-12-12'),
            assessedBy: 'risk-analyst',
            nextReview: new Date('2025-01-15'),
            externalReferences: ['VENDOR-CONTRACT-001'],
            complianceMapping: [
              { framework: 'sox', requirement: '404', control: 'vendor-oversight', mapped: true },
            ],
            customFields: { vendorTier: 'critical', contractValue: 500000 },
          },
        },
        {
          id: 'risk-003',
          title: 'Compliance Gap Risk',
          description: 'Missing controls for SOX compliance in financial reporting systems',
          category: 'compliance' as const,
          status: 'mitigating' as const,
          level: 'high' as const,
          likelihood: 'medium' as const,
          impact: 'major' as const,
          score: 63,
          calculatedAt: new Date('2024-12-01'),
          source: 'audit-report',
          owner: 'compliance-officer',
          assignee: 'audit-team',
          mitigation: 'mit-003',
          tags: ['sox', 'compliance', 'financial'],
          relatedAssets: ['financial-system', 'reporting-db'],
          dependencies: [],
          assessment: 'assess-002',
          findings: [
            {
              id: 'find-003',
              title: 'Insufficient Access Logging',
              description: 'Financial system lacks detailed access logging for SOX 404 requirements',
              severity: 'high' as const,
              confidence: 85,
              discoveredAt: new Date('2024-12-01'),
              discoveredBy: 'external-auditor',
              method: 'incident' as const,
              evidence: ['audit-findings-001'],
              recommendations: ['Implement detailed audit logging', 'Enable log aggregation for 7-year retention'],
            },
          ],
          history: [
            {
              timestamp: new Date('2024-12-01'),
              user: 'external-auditor',
              action: 'created',
              details: 'Gap identified during Q4 audit',
            },
          ],
          metadata: {
            created: new Date('2024-12-01'),
            createdBy: 'external-auditor',
            lastModified: new Date('2024-12-01'),
            modifiedBy: 'compliance-officer',
            lastAssessed: new Date('2024-12-10'),
            assessedBy: 'compliance-officer',
            nextReview: new Date('2025-01-30'),
            externalReferences: ['SOX-Q4-2024-AUDIT'],
            complianceMapping: [
              { framework: 'sox', requirement: '404', control: 'audit-logging', mapped: false },
              { framework: 'iso-27001', requirement: 'A.12.4.1', control: 'logging', mapped: true },
            ],
            customFields: { auditYear: '2024', auditor: 'Big4' },
          },
        },
      ],
      assessments: [
        {
          id: 'assess-001',
          name: 'Q4 2024 Risk Assessment',
          type: 'periodic' as const,
          status: 'completed' as const,
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-12-15'),
          assessedBy: 'risk-manager',
          reviewers: ['ciso', 'cto', 'cfo'],
          scope: {
            assets: ['customer-db', 'payment-api', 'financial-system'],
            departments: ['engineering', 'finance', 'security'],
            processes: ['payment-processing', 'financial-reporting'],
            thirdParties: ['payment-gateway-provider'],
            locations: ['us-east-1', 'eu-west-1'],
            excludeAssets: [],
          },
          risks: ['risk-001', 'risk-002', 'risk-003'],
          methodology: 'NIST Risk Assessment Framework',
          findings: [],
          overallScore: 71,
          riskDistribution: {
            critical: 1,
            high: 2,
            medium: 0,
            low: 0,
          },
          recommendations: [
            'Prioritize mitigation of critical third-party dependencies',
            'Implement encryption for all customer data storage',
            'Enhance access logging for financial systems',
          ],
          approvedBy: 'cfo',
          approvedAt: new Date('2024-12-20'),
          nextAssessment: new Date('2025-03-15'),
        },
      ],
      mitigations: [
        {
          id: 'mit-001',
          riskId: 'risk-001',
          name: 'Data Breach Mitigation Plan',
          description: 'Implement encryption and access controls for customer data',
          status: 'in-progress' as const,
          priority: 'high' as const,
          assignedTo: 'security-lead',
          createdBy: 'ciso',
          createdAt: new Date('2024-12-15'),
          targetDate: new Date('2025-01-30'),
          tasks: [
            {
              id: 'task-001',
              title: 'Enable S3 Encryption',
              description: 'Enable default encryption for all S3 buckets',
              status: 'completed' as const,
              assignedTo: 'devops-engineer',
              dueDate: new Date('2024-12-20'),
              completedDate: new Date('2024-12-18'),
              estimatedHours: 4,
              actualHours: 3,
              dependencies: [],
              checklist: [
                { item: 'Enable AES-256 encryption', completed: true, completedBy: 'devops-engineer', completedDate: new Date('2024-12-18') },
                { item: 'Verify encryption applied', completed: true, completedBy: 'devops-engineer', completedDate: new Date('2024-12-18') },
              ],
            },
            {
              id: 'task-002',
              title: 'Update Access Policies',
              description: 'Implement least privilege access for customer database',
              status: 'in-progress' as const,
              assignedTo: 'security-engineer',
              dueDate: new Date('2025-01-15'),
              estimatedHours: 16,
              dependencies: [],
              checklist: [],
            },
            {
              id: 'task-003',
              title: 'Deploy DLP Solution',
              description: 'Implement data loss prevention for sensitive data',
              status: 'not-started' as const,
              assignedTo: 'security-architect',
              dueDate: new Date('2025-01-30'),
              estimatedHours: 40,
              dependencies: ['task-002'],
              checklist: [],
            },
          ],
          budget: 50000,
          spent: 12000,
          progress: 40,
          blockers: [],
          dependencies: [],
          effectiveness: 'effective' as const,
        },
        {
          id: 'mit-002',
          riskId: 'risk-002',
          name: 'Third-Party Risk Mitigation',
          description: 'Implement fallback provider and negotiate SLA',
          status: 'in-progress' as const,
          priority: 'critical' as const,
          assignedTo: 'procurement-manager',
          createdBy: 'cto',
          createdAt: new Date('2024-12-10'),
          targetDate: new Date('2025-02-28'),
          tasks: [
            {
              id: 'task-004',
              title: 'Negotiate SLA with Provider',
              description: 'Obtain 99.9% uptime SLA guarantee from payment gateway',
              status: 'in-progress' as const,
              assignedTo: 'procurement-manager',
              dueDate: new Date('2025-01-15'),
              estimatedHours: 20,
              dependencies: [],
              checklist: [],
            },
            {
              id: 'task-005',
              title: 'Implement Fallback Provider',
              description: 'Integrate secondary payment gateway for failover',
              status: 'not-started' as const,
              assignedTo: 'engineering-lead',
              dueDate: new Date('2025-02-28'),
              estimatedHours: 80,
              dependencies: ['task-004'],
              checklist: [],
            },
          ],
          budget: 100000,
          spent: 25000,
          progress: 25,
          blockers: ['Legal review pending'],
          dependencies: [],
          effectiveness: undefined,
        },
        {
          id: 'mit-003',
          riskId: 'risk-003',
          name: 'SOX Compliance Mitigation',
          description: 'Implement required controls for SOX 404 compliance',
          status: 'in-progress' as const,
          priority: 'high' as const,
          assignedTo: 'compliance-officer',
          createdBy: 'compliance-officer',
          createdAt: new Date('2024-12-01'),
          targetDate: new Date('2025-01-31'),
          tasks: [
            {
              id: 'task-006',
              title: 'Implement Detailed Access Logging',
              description: 'Enable detailed audit logging for financial systems',
              status: 'completed' as const,
              assignedTo: 'security-engineer',
              dueDate: new Date('2024-12-15'),
              completedDate: new Date('2024-12-12'),
              estimatedHours: 24,
              actualHours: 20,
              dependencies: [],
              checklist: [
                { item: 'Enable CloudTrail logging', completed: true, completedBy: 'security-engineer', completedDate: new Date('2024-12-10') },
                { item: 'Configure log aggregation', completed: true, completedBy: 'security-engineer', completedDate: new Date('2024-12-12') },
              ],
            },
            {
              id: 'task-007',
              title: 'Implement 7-Year Log Retention',
              description: 'Configure 7-year retention for audit logs per SOX requirements',
              status: 'in-progress' as const,
              assignedTo: 'devops-engineer',
              dueDate: new Date('2025-01-31'),
              estimatedHours: 16,
              dependencies: ['task-006'],
              checklist: [],
            },
          ],
          budget: 75000,
          spent: 45000,
          progress: 60,
          blockers: [],
          dependencies: [],
          effectiveness: 'effective' as const,
        },
      ],
      monitors: [
        {
          id: 'mon-001',
          name: 'High Risk Monitor',
          description: 'Continuous monitoring of high and critical risks',
          status: 'active' as const,
          type: 'automated' as const,
          frequency: 'continuous' as const,
          riskIds: ['risk-001', 'risk-002', 'risk-003'],
          metrics: [
            {
              id: 'metric-001',
              name: 'Risk Score',
              source: 'risk-database',
              query: 'SELECT score FROM risks WHERE id IN (:riskIds)',
              aggregation: 'max' as const,
              threshold: 70,
              operator: 'gte' as const,
              window: 5,
            },
          ],
          conditions: [
            {
              id: 'cond-001',
              metricId: 'metric-001',
              condition: 'risk-score >= 70',
              threshold: 70,
              operator: 'gte' as const,
              severity: 'high' as const,
              action: 'alert' as const,
            },
          ],
          alertRules: [
            {
              id: 'rule-001',
              name: 'High Risk Alert',
              priority: 'critical' as const,
              recipients: ['ciso', 'risk-manager'],
              channels: ['email' as const, 'slack' as const],
              template: 'high-risk-alert',
              throttleMinutes: 30,
            },
          ],
          lastRun: new Date('2024-12-15'),
          nextRun: new Date(Date.now() + 5 * 60 * 1000),
          owner: 'risk-manager',
        },
        {
          id: 'mon-002',
          name: 'Mitigation Progress Monitor',
          description: 'Track mitigation plan progress and overdue tasks',
          status: 'active' as const,
          type: 'hybrid' as const,
          frequency: 'daily' as const,
          riskIds: ['risk-001', 'risk-002', 'risk-003'],
          metrics: [
            {
              id: 'metric-002',
              name: 'Overdue Tasks',
              source: 'mitigation-database',
              query: 'SELECT COUNT(*) FROM tasks WHERE dueDate < NOW() AND status != "completed"',
              aggregation: 'count' as const,
              threshold: 1,
              operator: 'gt' as const,
              window: 1440,
            },
          ],
          conditions: [
            {
              id: 'cond-002',
              metricId: 'metric-002',
              condition: 'overdue-tasks > 1',
              threshold: 1,
              operator: 'gt' as const,
              severity: 'medium' as const,
              action: 'alert' as const,
            },
          ],
          alertRules: [
            {
              id: 'rule-002',
              name: 'Overdue Task Alert',
              priority: 'high' as const,
              recipients: ['project-manager', 'risk-manager'],
              channels: ['email' as const],
              template: 'overdue-task-alert',
              throttleMinutes: 60,
            },
          ],
          lastRun: new Date('2024-12-15'),
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
          owner: 'project-manager',
        },
      ],
      alerts: [
        {
          id: 'alert-001',
          monitorId: 'mon-001',
          riskId: 'risk-001',
          severity: 'critical' as const,
          title: 'Data Breach Risk Score Increased',
          description: 'Risk score for data breach increased above threshold',
          triggeredAt: new Date('2024-12-15'),
          triggeredBy: 'mon-001',
          resolvedAt: new Date('2024-12-15'),
          resolvedBy: 'security-lead',
          status: 'resolved' as const,
          metrics: { riskScore: 75, previousScore: 63 },
          context: { reason: 'New vulnerability discovered' },
          actions: [
            { action: 'Acknowledged by security-lead', performedBy: 'security-lead', performedAt: new Date('2024-12-15') },
            { action: 'Mitigation plan updated', performedBy: 'security-lead', performedAt: new Date('2024-12-15') },
          ],
        },
        {
          id: 'alert-002',
          monitorId: 'mon-002',
          riskId: 'risk-002',
          severity: 'high' as const,
          title: 'Mitigation Task Overdue',
          description: 'SLA negotiation task is overdue',
          triggeredAt: new Date('2024-12-20'),
          triggeredBy: 'mon-002',
          status: 'open' as const,
          metrics: { overdueTasks: 1, daysOverdue: 5 },
          context: { taskId: 'task-004', dueDate: '2025-01-15' },
          actions: [
            { action: 'Escalated to CTO', performedBy: 'risk-manager', performedAt: new Date('2024-12-20') },
          ],
        },
      ],
      controls: [
        {
          id: 'ctrl-001',
          name: 'Data Encryption at Rest',
          description: 'All sensitive data encrypted at rest using AES-256',
          type: 'preventive' as const,
          category: 'security',
          effectiveness: 'high' as const,
          implemented: true,
          implementationDate: new Date('2024-12-18'),
          owner: 'devops-lead',
          cost: 5000,
          frequency: 'continuous' as const,
          lastTested: new Date('2024-12-18'),
          nextTest: new Date('2025-03-18'),
          testResults: [
            {
              id: 'test-001',
              testDate: new Date('2024-12-18'),
              testedBy: 'security-auditor',
              result: 'pass' as const,
              findings: [],
              evidence: ['encryption-verification-001'],
            },
          ],
          relatedRisks: ['risk-001'],
        },
        {
          id: 'ctrl-002',
          name: 'Access Review Process',
          description: 'Quarterly access review for all critical systems',
          type: 'detective' as const,
          category: 'compliance',
          effectiveness: 'medium' as const,
          implemented: true,
          implementationDate: new Date('2024-10-01'),
          owner: 'compliance-officer',
          cost: 25000,
          frequency: 'quarterly' as const,
          lastTested: new Date('2024-10-15'),
          nextTest: new Date('2025-01-15'),
          testResults: [],
          relatedRisks: ['risk-001', 'risk-003'],
        },
        {
          id: 'ctrl-003',
          name: 'Fallback Payment Gateway',
          description: 'Secondary payment provider for failover',
          type: 'compensating' as const,
          category: 'operational',
          effectiveness: 'high' as const,
          implemented: false,
          owner: 'engineering-lead',
          cost: 100000,
          frequency: 'monthly' as const,
          nextTest: new Date('2025-02-28'),
          testResults: [],
          relatedRisks: ['risk-002'],
        },
      ],
      matrices: [
        {
          id: 'matrix-001',
          name: 'Standard Risk Matrix',
          description: '5x5 risk matrix for qualitative risk assessment',
          likelihoods: ['very-high' as const, 'high' as const, 'medium' as const, 'low' as const, 'very-low' as const],
          impacts: ['catastrophic' as const, 'major' as const, 'moderate' as const, 'minor' as const, 'negligible' as const],
          scores: {},
          levels: { 0: 'low' as const, 40: 'medium' as const, 60: 'high' as const, 80: 'critical' as const },
          colors: {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#ca8a04',
            low: '#16a34a',
          },
          enabled: true,
        },
      ],
      reports: [
        {
          id: 'report-001',
          name: 'Q4 2024 Risk Report',
          type: 'executive' as const,
          generatedAt: new Date('2024-12-20'),
          generatedBy: 'risk-manager',
          period: {
            start: new Date('2024-10-01'),
            end: new Date('2024-12-31'),
          },
          summary: {
            totalRisks: 3,
            byLevel: { critical: 1, high: 2, medium: 0, low: 0 },
            byCategory: { security: 1, operational: 1, compliance: 1, financial: 0, reputational: 0, strategic: 0, technology: 0, custom: 0 },
            byStatus: { identified: 0, analyzing: 0, mitigating: 2, mitigated: 0, accepted: 0, transferred: 0, closed: 0, escalated: 0 },
            averageScore: 71,
            mitigated: 0,
            pending: 2,
            overdue: 0,
          },
          topRisks: ['risk-002', 'risk-001', 'risk-003'],
          trends: [
            { riskId: 'risk-001', direction: 'decreasing' as const, change: -15, period: 30 },
            { riskId: 'risk-002', direction: 'increasing' as const, change: 5, period: 30 },
          ],
          recommendations: [
            'Prioritize third-party SLA negotiations',
            'Complete encryption implementation',
            'Enhance access logging controls',
          ],
          charts: [],
          filters: [],
        },
      ],
      thresholds: [
        {
          id: 'thresh-001',
          name: 'Critical Risk Threshold',
          type: 'score' as const,
          metric: 'riskScore',
          condition: '>= 80',
          action: 'require-approval' as const,
          severity: 'critical' as const,
          enabled: true,
        },
        {
          id: 'thresh-002',
          name: 'High Risk Alert Threshold',
          type: 'score' as const,
          metric: 'riskScore',
          condition: '>= 60',
          action: 'alert' as const,
          severity: 'high' as const,
          enabled: true,
        },
      ],
      dependencies: [
        {
          id: 'dep-001',
          sourceRisk: 'risk-002',
          targetRisk: 'risk-003',
          type: 'related-to' as const,
          strength: 'moderate' as const,
          description: 'Both risks relate to financial system dependencies',
        },
      ],
      scenarios: [
        {
          id: 'scenario-001',
          name: 'Payment Gateway Failure',
          description: 'Complete outage of primary payment gateway provider',
          category: 'operational',
          probability: 15,
          impactFactors: [
            { factor: 'Revenue Impact', impact: 'catastrophic' as const, description: 'Complete loss of payment processing' },
            { factor: 'Customer Impact', impact: 'major' as const, description: 'Customers unable to complete purchases' },
          ],
          involvedRisks: ['risk-002'],
          mitigation: 'mit-002',
          lastReviewed: new Date('2024-12-10'),
          nextReview: new Date('2025-03-10'),
        },
        ],
    };

    displayRiskConfig(finalConfig, options.language);

    await writeRiskFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: risk-${providers.join('.tf, risk-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'risk-manager.ts' : 'risk_manager.py'}`));
    console.log(chalk.green('✅ Generated: RISK_ASSESSMENT.md'));
    console.log(chalk.green('✅ Generated: config.example.json\n'));

    console.log(chalk.green('✓ Risk assessment and management configured successfully!'));
  }));

  security
  .command('vendor')
  .description('Generate vendor security assessment and management with scorecards')
  .argument('<name>', 'Name of the vendor assessment project')
  .option('--auto-assess', 'Enable automated vendor assessment')
  .option('--assessment-frequency <frequency>', 'Assessment frequency (monthly, quarterly, semi-annual, annual, on-demand)', 'quarterly')
  .option('--risk-threshold <threshold>', 'Risk threshold 0-100', '60')
  .option('--enable-monitoring', 'Enable continuous monitoring')
  .option('--monitoring-interval <days>', 'Monitoring interval in days', '30')
  .option('--enable-questionnaires', 'Enable security questionnaires')
  .option('--questionnaire-template <template>', 'Questionnaire template', 'sig')
  .option('--enable-scorecards', 'Enable security scorecards')
  .option('--enable-findings', 'Enable finding tracking')
  .option('--finding-retention <days>', 'Finding retention period in days', '2555')
  .option('--require-soc2', 'Require SOC 2 certification')
  .option('--require-iso27001', 'Require ISO 27001 certification')
  .option('--require-hipaa', 'Require HIPAA certification')
  .option('--require-pcidss', 'Require PCI DSS certification')
  .option('--require-gdpr', 'Require GDPR compliance')
  .option('--enable-benchmarking', 'Enable industry benchmarking')
  .option('--benchmark-industry <industry>', 'Benchmark industry', 'technology')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './vendor-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeVendorFiles, displayVendorConfig } = await import('../utils/vendor-assessment.js');

    const providers: Array<'aws' | 'azure' | 'gcp'> = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const finalConfig = {
      projectName: name,
      providers,
      settings: {
        autoAssessment: options.autoAssess === true,
        assessmentFrequency: options.assessmentFrequency,
        requireApproval: true,
        approvers: ['ciso', 'procurement-manager', 'legal-counsel'],
        riskThreshold: parseInt(options.riskThreshold),
        enableContinuousMonitoring: options.enableMonitoring === true,
        monitoringInterval: parseInt(options.monitoringInterval),
        enableQuestionnaires: options.enableQuestionnaires === true,
        questionnaireTemplate: options.questionnaireTemplate,
        enableScorecards: options.enableScorecards !== false,
        scorecardWeighting: {
          securityPosture: 30,
          complianceCertifications: 20,
          financialHealth: 15,
          operationalMaturity: 10,
          incidentHistory: 10,
          contractTerms: 5,
          dataProtection: 5,
          serviceLevelAgreement: 5,
        },
        enableFindings: options.enableFindings !== false,
        findingRetentionDays: parseInt(options.findingRetention),
        enableAuditLogging: true,
        notifyFindings: true,
        notificationChannels: ['email' as const, 'slack' as const],
        enableBenchmarking: options.enableBenchmarking === true,
        benchmarkIndustry: options.benchmarkIndustry,
        requireContractReview: true,
        contractReviewFrequency: options.assessmentFrequency,
        enableIncidentTracking: true,
        incidentRetentionDays: 2555,
        requireSoc2: options.requireSoc2 === true,
        requireIso27001: options.requireIso27001 === true,
        requireHipaa: options.requireHipaa === true,
        requirePciDss: options.requirePcidss === true,
        requireGdpr: options.requireGdpr === true,
        customRequirements: [],
      },
      vendors: [
        {
          id: 'vendor-001',
          name: 'CloudInfrastructure Provider',
          description: 'Primary cloud infrastructure provider hosting critical workloads',
          website: 'https://example-cloud.com',
          category: 'cloud-provider' as const,
          tier: 'tier-1' as const,
          status: 'active' as const,
          riskRating: 'low' as const,
          overallScore: 85,
          lastAssessed: new Date('2024-12-01'),
          nextAssessment: new Date('2025-03-01'),
          onboardingDate: new Date('2020-01-15'),
          terminationDate: undefined,
          owner: 'infrastructure-director',
          technicalContact: 'tech-lead@example-cloud.com',
          businessContact: 'account-manager@example-cloud.com',
          escalationContact: 'escalation@example-cloud.com',
          services: ['compute', 'storage', 'database', 'networking', 'monitoring'],
          dataAccess: [
            {
              id: 'data-001',
              dataType: 'Customer Data',
              category: 'personal' as const,
              accessLevel: 'processed' as const,
              purpose: 'Service delivery and support',
              storageLocation: 'us-east-1',
              retentionPeriod: '3-years',
              encryptionRequired: true,
              encryptionVerified: true,
              dataResidency: ['US', 'EU'],
              subProcessors: [],
            },
          ],
          certifications: [
            {
              id: 'cert-001',
              name: 'SOC 2 Type II',
              framework: 'soc-2' as const,
              status: 'valid' as const,
              issueDate: new Date('2024-01-15'),
              expiryDate: new Date('2025-01-15'),
              certificateNumber: 'SOC2-2024-001',
              issuer: 'Independent Auditor',
              scope: 'Security, Availability, Confidentiality',
              verified: true,
              verifiedDate: new Date('2024-01-20'),
              evidenceUrl: 'https://example-cloud.com/soc2',
            },
            {
              id: 'cert-002',
              name: 'ISO 27001',
              framework: 'iso-27001' as const,
              status: 'valid' as const,
              issueDate: new Date('2023-06-01'),
              expiryDate: new Date('2026-06-01'),
              certificateNumber: 'ISO-27001-2023',
              issuer: 'BSI',
              scope: 'Information Security Management',
              verified: true,
              verifiedDate: new Date('2024-01-20'),
            },
          ],
          contracts: ['contract-001'],
          assessments: ['assessment-001'],
          findings: ['finding-001'],
          incidents: [],
          tags: ['critical', 'cloud', 'infrastructure'],
          regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
          sla: {
            availability: 99.99,
            responseTime: 200,
            uptimeGuarantee: 99.9,
            resolutionTime: {
              critical: 4,
              high: 8,
              medium: 24,
              low: 48,
            },
            penaltyClauses: true,
            creditPercentage: 10,
            reporting: true,
            reportingFrequency: 'monthly',
          },
          spending: {
            annual: 1200000,
            currency: 'USD',
            budgetCode: 'INFRA-2024',
          },
          riskFactors: [
            {
              category: 'geopolitical' as const,
              description: 'Data center concentration risk in specific regions',
              severity: 'low' as const,
              mitigation: 'Multi-region deployment strategy',
              lastReviewed: new Date('2024-12-01'),
            },
          ],
          dependencies: [],
          dependents: ['vendor-002', 'vendor-003'],
          metadata: {
            created: new Date('2020-01-15'),
            createdBy: 'procurement-team',
            lastModified: new Date('2024-12-01'),
            modifiedBy: 'infrastructure-director',
            source: 'vendor-registration',
            externalReferences: ['D&B-123456'],
            notes: 'Strategic partner, mission-critical services',
            customFields: {},
          },
        },
        {
          id: 'vendor-002',
          name: 'Payment Gateway Service',
          description: 'Payment processing and transaction management',
          website: 'https://example-payments.com',
          category: 'software' as const,
          tier: 'tier-1' as const,
          status: 'active' as const,
          riskRating: 'medium' as const,
          overallScore: 72,
          lastAssessed: new Date('2024-11-15'),
          nextAssessment: new Date('2025-02-15'),
          onboardingDate: new Date('2021-03-01'),
          terminationDate: undefined,
          owner: 'finance-director',
          technicalContact: 'integration@example-payments.com',
          businessContact: 'account-manager@example-payments.com',
          escalationContact: 'support@example-payments.com',
          services: ['payment-processing', 'fraud-detection', 'reconciliation'],
          dataAccess: [
            {
              id: 'data-002',
              dataType: 'Financial Data',
              category: 'financial' as const,
              accessLevel: 'limited' as const,
              purpose: 'Payment processing',
              storageLocation: 'pci-dss-compliant',
              retentionPeriod: '7-years',
              encryptionRequired: true,
              encryptionVerified: true,
              dataResidency: ['US'],
              subProcessors: [],
            },
          ],
          certifications: [
            {
              id: 'cert-003',
              name: 'PCI DSS Level 1',
              framework: 'pci-dss' as const,
              status: 'valid' as const,
              issueDate: new Date('2024-01-01'),
              expiryDate: new Date('2025-01-01'),
              certificateNumber: 'PCI-DSS-L1-2024',
              issuer: 'Qualified Security Assessor',
              scope: 'Payment Card Data Processing',
              verified: true,
              verifiedDate: new Date('2024-02-01'),
            },
          ],
          contracts: ['contract-002'],
          assessments: ['assessment-002'],
          findings: ['finding-002', 'finding-003'],
          incidents: ['incident-001'],
          tags: ['critical', 'payments', 'pci-dss'],
          regions: ['US', 'CA', 'EU'],
          sla: {
            availability: 99.95,
            responseTime: 500,
            uptimeGuarantee: 99.9,
            resolutionTime: {
              critical: 1,
              high: 4,
              medium: 12,
              low: 24,
            },
            penaltyClauses: true,
            creditPercentage: 25,
            reporting: true,
            reportingFrequency: 'weekly',
          },
          spending: {
            annual: 500000,
            currency: 'USD',
            budgetCode: 'FINANCE-2024',
          },
          riskFactors: [
            {
              category: 'operational' as const,
              description: 'Single point of failure for payment processing',
              severity: 'medium' as const,
              mitigation: 'Implement backup payment provider',
              lastReviewed: new Date('2024-11-15'),
            },
          ],
          dependencies: ['vendor-001'],
          dependents: [],
          metadata: {
            created: new Date('2021-03-01'),
            createdBy: 'procurement-team',
            lastModified: new Date('2024-11-15'),
            modifiedBy: 'finance-director',
            source: 'vendor-registration',
            externalReferences: ['D&B-789012'],
            notes: 'Critical payment infrastructure, fallback provider required',
            customFields: {},
          },
        },
        {
          id: 'vendor-003',
          name: 'Analytics Platform',
          description: 'Data analytics and business intelligence platform',
          website: 'https://example-analytics.com',
          category: 'software' as const,
          tier: 'tier-2' as const,
          status: 'active' as const,
          riskRating: 'low' as const,
          overallScore: 78,
          lastAssessed: new Date('2024-10-01'),
          nextAssessment: new Date('2025-01-01'),
          onboardingDate: new Date('2022-06-15'),
          terminationDate: undefined,
          owner: 'data-director',
          technicalContact: 'support@example-analytics.com',
          businessContact: 'sales@example-analytics.com',
          escalationContact: undefined,
          services: ['data-visualization', 'reporting', 'ml-models'],
          dataAccess: [
            {
              id: 'data-003',
              dataType: 'Operational Metrics',
              category: 'confidential' as const,
              accessLevel: 'read-only' as const,
              purpose: 'Business analytics and reporting',
              storageLocation: 'analytics-platform',
              retentionPeriod: '2-years',
              encryptionRequired: true,
              encryptionVerified: true,
              dataResidency: ['US'],
              subProcessors: [],
            },
          ],
          certifications: [],
          contracts: ['contract-003'],
          assessments: ['assessment-003'],
          findings: [],
          incidents: [],
          tags: ['analytics', 'bi', 'reporting'],
          regions: ['US'],
          sla: {
            availability: 99.5,
            responseTime: 1000,
            uptimeGuarantee: 99.0,
            resolutionTime: {
              critical: 8,
              high: 24,
              medium: 48,
              low: 72,
            },
            penaltyClauses: false,
            creditPercentage: 0,
            reporting: false,
            reportingFrequency: 'monthly',
          },
          spending: {
            annual: 200000,
            currency: 'USD',
            budgetCode: 'DATA-2024',
          },
          riskFactors: [],
          dependencies: ['vendor-001'],
          dependents: [],
          metadata: {
            created: new Date('2022-06-15'),
            createdBy: 'data-team',
            lastModified: new Date('2024-10-01'),
            modifiedBy: 'data-director',
            source: 'vendor-registration',
            externalReferences: [],
            notes: 'Non-critical analytics platform',
            customFields: {},
          },
        },
      ],
      assessments: [
        {
          id: 'assessment-001',
          vendorId: 'vendor-001',
          vendorName: 'CloudInfrastructure Provider',
          assessmentDate: new Date('2024-12-01'),
          assessor: 'security-team',
          reviewers: ['ciso', 'infrastructure-director'],
          status: 'completed' as const,
          type: 'periodic' as const,
          scope: {
            services: ['compute', 'storage', 'database'],
            regions: ['us-east-1', 'eu-west-1'],
            dataTypes: ['Customer Data', 'Application Data'],
            processes: ['data-storage', 'data-processing', 'backup'],
            excludeScope: ['development-environments'],
          },
          securityPosture: {
            overallScore: 88,
            domains: [
              {
                id: 'domain-001',
                name: 'Access Control',
                category: 'access-control' as const,
                score: 92,
                weight: 20,
                findings: [],
                maturityLevel: 'managed' as const,
              },
              {
                id: 'domain-002',
                name: 'Encryption',
                category: 'encryption' as const,
                score: 95,
                weight: 20,
                findings: [],
                maturityLevel: 'optimized' as const,
              },
              {
                id: 'domain-003',
                name: 'Incident Response',
                category: 'incident-response' as const,
                score: 78,
                weight: 15,
                findings: ['finding-001'],
                maturityLevel: 'defined' as const,
              },
            ],
            controls: [
              {
                id: 'ctrl-001',
                name: 'MFA for Admin Access',
                description: 'Multi-factor authentication required for all administrative access',
                type: 'preventive' as const,
                status: 'implemented' as const,
                effectiveness: 'high' as const,
                testingMethod: 'Automated verification',
                lastTested: new Date('2024-11-15'),
                testResult: 'pass' as const,
                evidence: ['test-result-001'],
              },
            ],
            vulnerabilities: [],
            testingPerformed: {
              penetrationTest: true,
              testDate: new Date('2024-10-15'),
              testProvider: 'External Security Firm',
              vulnerabilityScan: true,
              scanDate: new Date('2024-11-01'),
              codeReview: false,
              complianceAudit: true,
              auditDate: new Date('2024-09-01'),
            },
          },
          complianceAssessment: {
            overallScore: 90,
            frameworks: [
              {
                framework: 'SOC 2',
                status: 'compliant' as const,
                score: 95,
                requirements: [
                  {
                    requirementId: 'CC6.1',
                    description: 'Logical and physical access controls',
                    status: 'compliant' as const,
                    gap: undefined,
                    evidence: ['policy-001', 'audit-001'],
                  },
                ],
                lastReviewed: new Date('2024-11-01'),
                nextReview: new Date('2025-02-01'),
              },
              {
                framework: 'ISO 27001',
                status: 'compliant' as const,
                score: 88,
                requirements: [
                  {
                    requirementId: 'A.9.2.1',
                    description: 'User access management',
                    status: 'compliant' as const,
                    gap: undefined,
                    evidence: ['access-policy-001'],
                  },
                ],
                lastReviewed: new Date('2024-10-01'),
                nextReview: new Date('2025-01-01'),
              },
            ],
            gaps: [],
            evidenceRequests: [],
          },
          operationalMaturity: {
            overallScore: 82,
            peopleScore: 80,
            processScore: 85,
            technologyScore: 82,
            metrics: [
              {
                name: 'Response Time',
                value: 85,
                target: 90,
                status: 'on-track' as const,
                trend: 'improving' as const,
              },
            ],
          },
          financialHealth: {
            overallScore: 85,
            revenue: '$10B+',
            profitability: 'Profitable',
            debtToEquity: 'Low',
            yearsInBusiness: 15,
            employeeCount: 100000,
            insuranceCoverage: true,
            insuranceAmount: 50000000,
            dependencies: [],
          },
          riskScore: 15,
          riskRating: 'low' as const,
          findings: ['finding-001'],
          recommendations: [
            'Improve incident response documentation',
            'Consider more frequent penetration testing',
          ],
          approvedBy: 'ciso',
          approvedAt: new Date('2024-12-05'),
          expiryDate: new Date('2025-03-01'),
          nextAssessment: new Date('2025-03-01'),
        },
        {
          id: 'assessment-002',
          vendorId: 'vendor-002',
          vendorName: 'Payment Gateway Service',
          assessmentDate: new Date('2024-11-15'),
          assessor: 'security-team',
          reviewers: ['ciso', 'finance-director'],
          status: 'completed' as const,
          type: 'event-driven' as const,
          scope: {
            services: ['payment-processing'],
            regions: ['US'],
            dataTypes: ['Financial Data'],
            processes: ['payment-authentication', 'settlement'],
            excludeScope: [],
          },
          securityPosture: {
            overallScore: 72,
            domains: [
              {
                id: 'domain-004',
                name: 'Data Protection',
                category: 'data-protection' as const,
                score: 90,
                weight: 25,
                findings: [],
                maturityLevel: 'managed' as const,
              },
              {
                id: 'domain-005',
                name: 'Network Security',
                category: 'network-security' as const,
                score: 65,
                weight: 20,
                findings: ['finding-002'],
                maturityLevel: 'defined' as const,
              },
            ],
            controls: [],
            vulnerabilities: [],
            testingPerformed: {
              penetrationTest: true,
              testDate: new Date('2024-08-01'),
              testProvider: 'PCI QSA',
              vulnerabilityScan: true,
              scanDate: new Date('2024-10-15'),
              codeReview: false,
              complianceAudit: true,
              auditDate: new Date('2024-09-15'),
            },
          },
          complianceAssessment: {
            overallScore: 85,
            frameworks: [
              {
                framework: 'PCI DSS',
                status: 'compliant' as const,
                score: 90,
                requirements: [],
                lastReviewed: new Date('2024-09-15'),
                nextReview: new Date('2025-03-15'),
              },
            ],
            gaps: [],
            evidenceRequests: [],
          },
          operationalMaturity: {
            overallScore: 75,
            peopleScore: 75,
            processScore: 78,
            technologyScore: 72,
            metrics: [],
          },
          financialHealth: {
            overallScore: 70,
            revenue: '$1-5B',
            profitability: 'Profitable',
            debtToEquity: 'Medium',
            yearsInBusiness: 8,
            employeeCount: 2000,
            insuranceCoverage: true,
            insuranceAmount: 10000000,
            dependencies: [],
          },
          riskScore: 28,
          riskRating: 'medium' as const,
          findings: ['finding-002', 'finding-003'],
          recommendations: [
            'Implement backup payment gateway for redundancy',
            'Improve network security controls',
          ],
          approvedBy: 'ciso',
          approvedAt: new Date('2024-11-20'),
          expiryDate: new Date('2025-02-15'),
          nextAssessment: new Date('2025-02-15'),
        },
        {
          id: 'assessment-003',
          vendorId: 'vendor-003',
          vendorName: 'Analytics Platform',
          assessmentDate: new Date('2024-10-01'),
          assessor: 'data-team',
          reviewers: ['data-director'],
          status: 'completed' as const,
          type: 'periodic' as const,
          scope: {
            services: ['data-visualization', 'reporting'],
            regions: ['US'],
            dataTypes: ['Operational Metrics'],
            processes: ['analytics', 'reporting'],
            excludeScope: [],
          },
          securityPosture: {
            overallScore: 75,
            domains: [],
            controls: [],
            vulnerabilities: [],
            testingPerformed: {
              penetrationTest: false,
              vulnerabilityScan: true,
              scanDate: new Date('2024-09-15'),
              codeReview: false,
              complianceAudit: false,
            },
          },
          complianceAssessment: {
            overallScore: 80,
            frameworks: [],
            gaps: [],
            evidenceRequests: [],
          },
          operationalMaturity: {
            overallScore: 78,
            peopleScore: 75,
            processScore: 80,
            technologyScore: 80,
            metrics: [],
          },
          financialHealth: {
            overallScore: 75,
            revenue: '$100M-1B',
            profitability: 'Profitable',
            debtToEquity: 'Low',
            yearsInBusiness: 5,
            employeeCount: 500,
            insuranceCoverage: true,
            insuranceAmount: 5000000,
            dependencies: [],
          },
          riskScore: 22,
          riskRating: 'low' as const,
          findings: [],
          recommendations: [],
          expiryDate: new Date('2025-01-01'),
          nextAssessment: new Date('2025-01-01'),
        },
      ],
      scorecards: [
        {
          id: 'scorecard-001',
          vendorId: 'vendor-001',
          vendorName: 'CloudInfrastructure Provider',
          period: '2024-Q4',
          status: 'approved' as const,
          generatedDate: new Date('2024-12-10'),
          generatedBy: 'vendor-management-team',
          reviewedBy: 'ciso',
          reviewedDate: new Date('2024-12-12'),
          approvedBy: 'ciso',
          approvedDate: new Date('2024-12-15'),
          overallScore: 85,
          rating: 'low' as const,
          categories: [
            {
              name: 'Security Posture',
              weight: 30,
              score: 88,
              weightedScore: 26,
              status: 'good' as const,
              comments: 'Strong security controls with minor improvements needed',
            },
            {
              name: 'Compliance Certifications',
              weight: 20,
              score: 95,
              weightedScore: 19,
              status: 'excellent' as const,
              comments: 'Excellent certification coverage - SOC 2, ISO 27001 valid',
            },
            {
              name: 'Financial Health',
              weight: 15,
              score: 90,
              weightedScore: 14,
              status: 'excellent' as const,
              comments: 'Strong financial position, public company',
            },
            {
              name: 'Operational Maturity',
              weight: 10,
              score: 82,
              weightedScore: 8,
              status: 'good' as const,
              comments: 'Mature processes and procedures',
            },
            {
              name: 'Incident History',
              weight: 10,
              score: 85,
              weightedScore: 9,
              status: 'good' as const,
              comments: 'Few incidents, good response',
            },
            {
              name: 'Contract Terms',
              weight: 5,
              score: 70,
              weightedScore: 4,
              status: 'satisfactory' as const,
              comments: 'Standard terms, some limitations',
            },
            {
              name: 'Data Protection',
              weight: 5,
              score: 90,
              weightedScore: 5,
              status: 'excellent' as const,
              comments: 'Strong data protection controls',
            },
            {
              name: 'Service Level Agreement',
              weight: 5,
              score: 90,
              weightedScore: 5,
              status: 'excellent' as const,
              comments: 'Exceeds SLA commitments consistently',
            },
          ],
          trend: 'stable' as const,
          trendScore: 2,
          benchmarkComparison: {
            industryAverage: 72,
            percentile: 85,
            rank: 'Top 15%',
            peers: 150,
          },
          recommendations: [
            'Continue monitoring incident response capabilities',
            'Review contract terms for next renewal',
          ],
          strengths: [
            'Strong security posture and controls',
            'Comprehensive compliance certifications',
            'Excellent financial health',
            'High availability and performance',
          ],
          weaknesses: [
            'Limited liability caps in contract',
            'Some regions lack data residency options',
          ],
          actionItems: [
            {
              id: 'action-001',
              description: 'Review contract liability terms for next renewal',
              priority: 'medium' as const,
              assignedTo: 'legal-counsel',
              dueDate: new Date('2025-01-15'),
              status: 'pending' as const,
            },
          ],
        },
        {
          id: 'scorecard-002',
          vendorId: 'vendor-002',
          vendorName: 'Payment Gateway Service',
          period: '2024-Q4',
          status: 'approved' as const,
          generatedDate: new Date('2024-11-20'),
          generatedBy: 'vendor-management-team',
          reviewedBy: 'finance-director',
          reviewedDate: new Date('2024-11-25'),
          approvedBy: 'ciso',
          approvedDate: new Date('2024-11-28'),
          overallScore: 68,
          rating: 'medium' as const,
          categories: [
            {
              name: 'Security Posture',
              weight: 30,
              score: 72,
              weightedScore: 22,
              status: 'satisfactory' as const,
              comments: 'Adequate security with room for improvement',
            },
            {
              name: 'Compliance Certifications',
              weight: 20,
              score: 90,
              weightedScore: 18,
              status: 'excellent' as const,
              comments: 'PCI DSS compliant with valid certification',
            },
            {
              name: 'Financial Health',
              weight: 15,
              score: 70,
              weightedScore: 11,
              status: 'satisfactory' as const,
              comments: 'Private company with reasonable financials',
            },
            {
              name: 'Operational Maturity',
              weight: 10,
              score: 75,
              weightedScore: 8,
              status: 'satisfactory' as const,
              comments: 'Developing operational maturity',
            },
            {
              name: 'Incident History',
              weight: 10,
              score: 50,
              weightedScore: 5,
              status: 'needs-improvement' as const,
              comments: 'Recent service outage incident',
            },
            {
              name: 'Contract Terms',
              weight: 5,
              score: 75,
              weightedScore: 4,
              status: 'satisfactory' as const,
              comments: 'Good terms with appropriate penalties',
            },
            {
              name: 'Data Protection',
              weight: 5,
              score: 85,
              weightedScore: 4,
              status: 'good' as const,
              comments: 'Strong PCI DSS compliance',
            },
            {
              name: 'Service Level Agreement',
              weight: 5,
              score: 60,
              weightedScore: 3,
              status: 'needs-improvement' as const,
              comments: 'SLA misses in recent quarter',
            },
          ],
          trend: 'declining' as const,
          trendScore: -5,
          recommendations: [
            'Implement backup payment gateway urgently',
            'Monitor SLA performance closely',
            'Review incident response procedures',
          ],
          strengths: [
            'PCI DSS compliant',
            'Strong data protection',
            'Good contract terms',
          ],
          weaknesses: [
            'Recent service outage',
            'SLA performance degradation',
            'Single point of dependency',
          ],
          actionItems: [
            {
              id: 'action-002',
              description: 'Evaluate and onboard backup payment gateway',
              priority: 'critical' as const,
              assignedTo: 'finance-director',
              dueDate: new Date('2025-01-31'),
              status: 'in-progress' as const,
            },
            {
              id: 'action-003',
              description: 'Review SLA performance penalties',
              priority: 'high' as const,
              assignedTo: 'legal-counsel',
              dueDate: new Date('2024-12-31'),
              status: 'pending' as const,
            },
          ],
        },
      ],
      questionnaires: [],
      findings: [
        {
          id: 'finding-001',
          vendorId: 'vendor-001',
          vendorName: 'CloudInfrastructure Provider',
          assessmentId: 'assessment-001',
          title: 'Incident Response Documentation Gap',
          description: 'Incident response procedures lack detailed documentation for certain scenarios',
          severity: 'low' as const,
          category: 'operational' as const,
          status: 'open' as const,
          discoveredDate: new Date('2024-12-01'),
          discoveredBy: 'security-team',
          dueDate: new Date('2025-01-15'),
          remediation: 'Vendor to provide detailed incident response documentation for all identified scenarios',
          assignedTo: 'vendor-management-team',
          progress: 0,
          lastUpdated: new Date('2024-12-01'),
          updatedBy: 'security-team',
          impact: 'Low impact - existing procedures are adequate but documentation gaps exist',
          references: ['assessment-001-domain-003'],
          resolutions: [],
        },
        {
          id: 'finding-002',
          vendorId: 'vendor-002',
          vendorName: 'Payment Gateway Service',
          assessmentId: 'assessment-002',
          title: 'Network Security Control Gaps',
          description: 'Network security controls do not meet best practice standards for payment processing',
          severity: 'medium' as const,
          category: 'security' as const,
          status: 'in-progress' as const,
          discoveredDate: new Date('2024-11-15'),
          discoveredBy: 'security-team',
          dueDate: new Date('2025-01-31'),
          remediation: 'Vendor to implement enhanced network security controls including DDoS protection and WAF',
          assignedTo: 'vendor-management-team',
          progress: 40,
          lastUpdated: new Date('2024-12-10'),
          updatedBy: 'vendor-management-team',
          impact: 'Medium impact - increased risk of network-based attacks',
          references: ['assessment-002-domain-005'],
          resolutions: [
            {
              date: new Date('2024-12-10'),
              action: 'Vendor submitted remediation plan',
              performedBy: 'vendor-management-team',
              notes: 'Plan approved, implementation in progress',
              evidence: ['remediation-plan-002'],
            },
          ],
        },
        {
          id: 'finding-003',
          vendorId: 'vendor-002',
          vendorName: 'Payment Gateway Service',
          assessmentId: 'assessment-002',
          title: 'Single Point of Failure',
          description: 'No backup payment gateway provider identified - creates single point of failure',
          severity: 'high' as const,
          category: 'operational' as const,
          status: 'open' as const,
          discoveredDate: new Date('2024-11-15'),
          discoveredBy: 'finance-director',
          dueDate: new Date('2025-02-28'),
          remediation: 'Identify and onboard secondary payment gateway provider for redundancy',
          assignedTo: 'finance-director',
          progress: 25,
          lastUpdated: new Date('2024-12-15'),
          updatedBy: 'finance-director',
          impact: 'High impact - payment processing outage could impact revenue',
          references: ['incident-001'],
          resolutions: [],
        },
      ],
      reviews: [],
      approvals: [],
      contracts: [
        {
          id: 'contract-001',
          vendorId: 'vendor-001',
          vendorName: 'CloudInfrastructure Provider',
          contractType: 'msa' as const,
          contractNumber: 'MSA-2020-001',
          startDate: new Date('2020-01-15'),
          endDate: undefined,
          renewalDate: new Date('2025-01-15'),
          autoRenew: true,
          noticePeriod: 90,
          status: 'active' as const,
          currency: 'USD',
          annualValue: 1200000,
          paymentTerms: 'Net 30',
          terms: {
            confidentiality: 'Standard confidentiality provisions',
            dataProtection: 'Complies with GDPR, data processing agreement in place',
            intellectualProperty: 'Standard IP provisions',
            warranties: 'Standard warranties for services',
            indemnification: 'Mutual indemnification with caps',
            limitationOfLiability: 'Cap at 12 months fees',
            terminationForConvenience: true,
            terminationForCause: true,
            auditRights: true,
            auditFrequency: 'annually',
            subcontractingAllowed: true,
            subcontractConsentRequired: false,
          },
          dataProcessing: true,
          dsaAttached: true,
          slaIncluded: true,
          liability: {
            capType: 'aggregate' as const,
            capAmount: 1200000,
            insuranceRequired: true,
            insuranceTypes: ['Cyber Liability', 'General Liability', 'Professional Liability'],
            minimumInsurance: 10000000,
          },
          reviewFrequency: 'annual' as const,
          nextReview: new Date('2025-01-15'),
          documentUrl: 'https://contracts.example.com/msa-001',
          signedBy: 'CTO',
          signedDate: new Date('2020-01-10'),
          counterpartySignatory: 'Vendor CEO',
          attachments: [],
        },
      ],
      incidents: [
        {
          id: 'incident-001',
          vendorId: 'vendor-002',
          vendorName: 'Payment Gateway Service',
          incidentDate: new Date('2024-10-15'),
          detectedDate: new Date('2024-10-15'),
          reportedDate: new Date('2024-10-16'),
          severity: 'high' as const,
          type: 'service-outage' as const,
          title: 'Payment Gateway Service Outage',
          description: '4-hour service outage affecting payment processing',
          impact: {
            dataAffected: false,
            recordsAffected: undefined,
            customersAffected: 5000,
            systemsAffected: ['payment-api', 'checkout-service'],
            servicesAffected: ['payment-processing'],
            duration: 4,
            financialImpact: 50000,
            reputationImpact: 'medium' as const,
          },
          rootCause: 'Network equipment failure at primary data center',
          containmentActions: [
            'Rerouted traffic to secondary data center',
            'Activated incident response team',
          ],
          remediationActions: [
            'Replaced failed network equipment',
            'Implemented redundant network paths',
          ],
          preventiveActions: [
            'Upgraded network infrastructure',
            'Implemented automated failover',
          ],
          notificationSent: true,
          notificationTimeline: [
            {
              date: new Date('2024-10-15'),
              recipient: 'customers',
              method: 'email' as const,
              content: 'Service outage notification',
              sentBy: 'vendor-support',
            },
          ],
          status: 'resolved' as const,
          assignedTo: 'vendor-management-team',
          resolvedDate: new Date('2024-10-19'),
          lessonsLearned: 'Need for backup payment gateway confirmed',
          references: ['post-mortem-001'],
        },
      ],
    };

    displayVendorConfig(finalConfig, options.language, options.output);

    await writeVendorFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: vendor-${providers.join('.tf, vendor-')}.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'vendor-manager.ts' : 'vendor_manager.py'}`));
    console.log(chalk.green('✅ Generated: VENDOR_ASSESSMENT.md'));
    console.log(chalk.green('✅ Generated: config.example.json\n'));

    console.log(chalk.green('✓ Vendor security assessment configured successfully!'));
  }));

  security
  .command('bcp')
  .description('Generate business continuity and disaster recovery planning with automated testing')
  .argument('<name>', 'Name of the BCP project')
  .option('--organization <name>', 'Organization name', 'Acme Corp')
  .option('--auto-bia', 'Enable automated BIA updates')
  .option('--bia-frequency <frequency>', 'BIA update frequency (monthly, quarterly, semi-annual, annual)', 'quarterly')
  .option('--require-dr-testing', 'Require DR testing')
  .option('--dr-test-frequency <frequency>', 'DR test frequency (monthly, quarterly, semi-annual, annual)', 'quarterly')
  .option('--min-test-score <score>', 'Minimum test score 0-100', '80')
  .option('--enable-automated-testing', 'Enable automated DR testing')
  .option('--test-types <types>', 'Test types (comma-separated: tabletop,simulation,parallel,full-interruption)', 'tabletop,simulation,parallel')
  .option('--require-plan-approval', 'Require plan approval')
  .option('--approvers <emails>', 'Approvers (comma-separated emails)', 'ciso@acme.com,coo@acme.com')
  .option('--rto-variance <percentage>', 'RTO variance threshold percentage', '10')
  .option('--rpo-variance <percentage>', 'RPO variance threshold percentage', '5')
  .option('--enable-risk-monitoring', 'Enable risk monitoring')
  .option('--risk-review-frequency <frequency>', 'Risk review frequency (monthly, quarterly, semi-annual)', 'quarterly')
  .option('--notify-anomalies', 'Notify on anomalies')
  .option('--notification-channels <channels>', 'Notification channels (comma-separated: email,slack,teams,sms)', 'email,slack')
  .option('--enable-compliance-reporting', 'Enable compliance reporting')
  .option('--compliance-frameworks <frameworks>', 'Compliance frameworks (comma-separated: iso-22301,soc-2,pci-dss,hipaa)', 'iso-22301,soc-2')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './bcp-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeBCPFiles, displayBCPConfig, createExampleBCPConfig } = await import('../utils/business-continuity.js');

    const providers: Array<'aws' | 'azure' | 'gcp'> = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const testTypes = options.testTypes.split(',').map((t: string) => t.trim()) as Array<'tabletop' | 'simulation' | 'parallel' | 'full-interruption'>;
    const notificationChannels = options.notificationChannels.split(',').map((c: string) => c.trim()) as Array<'email' | 'slack' | 'teams' | 'sms'>;
    const complianceFrameworks = options.complianceFrameworks.split(',').map((f: string) => f.trim()) as Array<'iso-22301' | 'soc-2' | 'pci-dss' | 'hipaa' | 'custom'>;
    const approvers = options.approvers.split(',').map((a: string) => a.trim());

    const finalConfig = createExampleBCPConfig();
    finalConfig.projectName = name;
    finalConfig.organization = options.organization;
    finalConfig.providers = providers.length > 0 ? providers : ['aws'];
    finalConfig.settings = {
      autoBIAUpdate: options.autoBia === true,
      biaUpdateFrequency: options.biaFrequency,
      requireDRTesting: options.requireDrTesting !== false,
      drTestFrequency: options.drTestFrequency,
      minTestScore: parseInt(options.minTestScore),
      enableAutomatedTesting: options.enableAutomatedTesting === true,
      testTypes,
      requirePlanApproval: options.requirePlanApproval !== false,
      approvers,
      rtoVarianceThreshold: parseInt(options.rtoVariance),
      rpoVarianceThreshold: parseInt(options.rpoVariance),
      enableRiskMonitoring: options.enableRiskMonitoring === true,
      riskReviewFrequency: options.riskReviewFrequency,
      notifyOnAnomalies: options.notifyAnomalies === true,
      notificationChannels,
      enableComplianceReporting: options.enableComplianceReporting === true,
      complianceFrameworks,
    };

    displayBCPConfig(finalConfig, options.language, options.output);

    await writeBCPFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: terraform/${providers.join('/main.tf, terraform/')}/main.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'bc-manager.ts' : 'bc_manager.py'}`));
    console.log(chalk.green('✅ Generated: BCP_GUIDE.md'));
    console.log(chalk.green('✅ Generated: bcp-config.json\n'));

    console.log(chalk.green('✓ Business continuity planning configured successfully!'));
  }));

  security
  .command('governance')
  .description('Generate governance policy management with workflow automation and approvals')
  .argument('<name>', 'Name of the governance project')
  .option('--organization <name>', 'Organization name', 'Acme Corp')
  .option('--require-approval', 'Require policy approval')
  .option('--required-approvers <number>', 'Number of required approvers', '2')
  .option('--auto-routing', 'Enable automatic routing')
  .option('--enable-escalation', 'Enable escalation')
  .option('--escalation-timeout <hours>', 'Escalation timeout in hours', '48')
  .option('--enable-notifications', 'Enable notifications')
  .option('--notification-channels <channels>', 'Notification channels (comma-separated: email,slack,teams,webhook)', 'email,slack')
  .option('--enable-audit-logging', 'Enable audit logging')
  .option('--audit-retention <days>', 'Audit retention period in days', '2555')
  .option('--enable-compliance-checks', 'Enable automated compliance checks')
  .option('--compliance-frequency <frequency>', 'Compliance check frequency (daily, weekly, monthly)', 'weekly')
  .option('--enable-violation-tracking', 'Enable violation tracking')
  .option('--auto-remediation', 'Enable automatic remediation')
  .option('--policy-versioning', 'Enable policy versioning')
  .option('--require-policy-review', 'Require periodic policy review')
  .option('--review-frequency <frequency>', 'Policy review frequency (monthly, quarterly, semi-annual, annual)', 'annual')
  .option('--enable-workflow-automation', 'Enable workflow automation')
  .option('--workflow-timeout <days>', 'Workflow timeout in days', '14')
  .option('--allow-delegation', 'Allow approval delegation')
  .option('--require-comments', 'Require comments on approvals')
  .option('--enable-reporting', 'Enable reporting')
  .option('--report-frequency <frequency>', 'Report frequency (weekly, monthly, quarterly)', 'monthly')
  .option('--stakeholders <emails>', 'Stakeholder emails (comma-separated)', 'ciso@acme.com,compliance@acme.com,legal@acme.com')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './governance-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeGovernanceFiles, displayGovernanceConfig, createExampleGovernanceConfig } = await import('../utils/governance-policy.js');

    const providers: Array<'aws' | 'azure' | 'gcp'> = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const notificationChannels = options.notificationChannels.split(',').map((c: string) => c.trim());
    const stakeholders = options.stakeholders.split(',').map((s: string) => s.trim());

    const finalConfig = createExampleGovernanceConfig();
    finalConfig.projectName = name;
    finalConfig.organization = options.organization;
    finalConfig.providers = providers.length > 0 ? providers : ['aws'];
    finalConfig.settings = {
      requireApproval: options.requireApproval !== false,
      requiredApprovers: parseInt(options.requiredApprovers),
      autoRouting: options.autoRouting === true,
      enableEscalation: options.enableEscalation !== false,
      escalationTimeout: parseInt(options.escalationTimeout),
      enableNotifications: options.enableNotifications !== false,
      notificationChannels: notificationChannels as Array<'email' | 'slack' | 'teams' | 'webhook'>,
      enableAuditLogging: options.enableAuditLogging !== false,
      auditRetentionDays: parseInt(options.auditRetention),
      enableComplianceChecks: options.enableComplianceChecks !== false,
      complianceCheckFrequency: options.complianceFrequency,
      enableViolationTracking: options.enableViolationTracking !== false,
      autoRemediation: options.autoRemediation === true,
      policyVersioning: options.policyVersioning !== false,
      requirePolicyReview: options.requirePolicyReview !== false,
      policyReviewFrequency: options.reviewFrequency,
      enableWorkflowAutomation: options.enableWorkflowAutomation !== false,
      workflowTimeout: parseInt(options.workflowTimeout),
      allowDelegation: options.allowDelegation === true,
      requireComments: options.requireComments !== false,
      enableReporting: options.enableReporting !== false,
      reportFrequency: options.reportFrequency,
      stakeholders,
    };

    displayGovernanceConfig(finalConfig, options.language, options.output);

    await writeGovernanceFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: terraform/${providers.join('/main.tf, terraform/')}/main.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'governance-manager.ts' : 'governance_manager.py'}`));
    console.log(chalk.green('✅ Generated: GOVERNANCE_GUIDE.md'));
    console.log(chalk.green('✅ Generated: governance-config.json\n'));

    console.log(chalk.green('✓ Governance policy management configured successfully!'));
  }));

  program.addCommand(security);
}
