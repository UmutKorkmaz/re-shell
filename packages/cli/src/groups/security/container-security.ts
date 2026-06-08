import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security container-security` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerContainerSecurity(security: Command): void {
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
    const { containerSecurity, writeFiles, displayConfig } = await import('../../utils/container-security.js');

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

}
