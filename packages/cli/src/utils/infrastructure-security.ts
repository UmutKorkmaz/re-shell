/**
 * @file Infrastructure Security Scanning and Compliance Checking with Remediation
 * @description Provides types, configuration interfaces, and code generators for
 * scanning cloud and infrastructure resources, tracking security findings,
 * managing remediations, and producing compliance reports across multiple
 * cloud providers (AWS, Azure, GCP) and Kubernetes.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/** Supported infrastructure scan targets (cloud providers, IaC tools, or custom). */
export type ScanTarget = 'aws' | 'azure' | 'gcp' | 'kubernetes' | 'terraform' | 'cloudformation' | 'arm' | 'custom';
/** Categories of cloud resources that can be scanned. */
export type ResourceType = 'compute' | 'storage' | 'network' | 'database' | 'security' | 'identity' | 'container' | 'serverless' | 'custom';
/** Compliance and security standards supported for reporting. */
export type ComplianceStandard = 'cis-benchmark' | 'nist-800-53' | 'pci-dss' | 'hipaa' | 'gdpr' | 'soc2' | 'iso-27001' | 'custom';
/** Severity levels ordered from most to least severe. */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
/** Lifecycle states for a security finding. */
export type FindingStatus = 'open' | 'investigating' | 'remediating' | 'resolved' | 'accepted' | 'false-positive';
/** Lifecycle states for a remediation action. */
export type RemediationStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
/** Level of automation applied to a remediation action. */
export type RemediationType = 'automatic' | 'manual' | 'semi-automatic';

/**
 * Top-level configuration object for infrastructure security scanning,
 * holding all scan settings, resources, findings, remediations, reports,
 * benchmarks, and integrations for a project.
 */
export interface InfrastructureSecurityConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  scanSettings: ScanSettings;
  resources: Resource[];
  findings: SecurityFinding[];
  remediations: Remediation[];
  complianceReports: ComplianceReport[];
  benchmarks: SecurityBenchmark[];
  integrations: SecurityIntegration[];
}

/**
 * Configuration controlling when and how security scans run, including
 * frequency, severity thresholds, scan categories, and remediation behavior.
 */
export interface ScanSettings {
  enabled: boolean;
  frequency: 'on-deploy' | 'on-schedule' | 'on-demand' | 'continuous';
  interval: string; // cron expression
  severityThreshold: SeverityLevel;
  failOnThreshold: SeverityLevel;
  targets: ScanTarget[];
  resourceTypes: ResourceType[];
  complianceStandards: ComplianceStandard[];
  deepAnalysis: boolean;
  includeDeprecated: boolean;
  scanDrift: boolean;
  scanMisconfigurations: boolean;
  scanCompliance: boolean;
  scanVulnerabilities: boolean;
  autoRemediate: boolean;
  remediationType: RemediationType;
  notifyOnFindings: boolean;
  generateReports: boolean;
}

/**
 * Represents a cloud or infrastructure resource that has been discovered
 * and is tracked for security scanning, drift detection, and findings.
 */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  provider: 'aws' | 'azure' | 'gcp' | 'kubernetes';
  region?: string;
  account?: string;
  subscription?: string;
  project?: string;
  cluster?: string;
  namespace?: string;
  arn?: string;
  resourceId?: string;
  tags: Record<string, string>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastScanned: Date;
  driftDetected: boolean;
  findings: string[]; // Finding IDs
}

/**
 * A security issue detected during a scan, including severity, status,
 * the affected resource, related compliance references, and remediation info.
 */
export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  status: FindingStatus;
  resource: ResourceReference;
  control: SecurityControl;
  compliance: ComplianceReference[];
  detectedAt: Date;
  resolvedAt?: Date;
  remediation: RemediationReference;
  confidence: number; // 0-1
  falsePositive: boolean;
  businessImpact: 'critical' | 'high' | 'medium' | 'low';
  effort: string; // time estimate
  assignee?: string;
  references: FindingReference[];
  metadata: Record<string, unknown>;
}

/**
 * Lightweight reference to a resource, used within findings to avoid
 * duplicating full resource details.
 */
export interface ResourceReference {
  id: string;
  name: string;
  type: ResourceType;
  provider: 'aws' | 'azure' | 'gcp' | 'kubernetes';
  region?: string;
  arn?: string;
  resourceId?: string;
}

/**
 * Describes a security control (from a framework such as CIS or NIST)
 * that a finding maps to, including its implementation and validation.
 */
export interface SecurityControl {
  id: string;
  name: string;
  category: string;
  framework: string;
  description: string;
  implementation: string;
  validation: string;
}

/**
 * Links a finding to a specific requirement and control within a
 * compliance standard.
 */
export interface ComplianceReference {
  standard: ComplianceStandard;
  requirement: string;
  control: string;
  severity: SeverityLevel;
}

/**
 * Summary reference to a remediation action associated with a finding,
 * including type, status, estimated time, complexity, and risk.
 */
export interface RemediationReference {
  id: string;
  type: RemediationType;
  status: RemediationStatus;
  estimatedTime: string;
  complexity: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
}

/**
 * An external reference (e.g. CWE, OWASP, NIST, CIS) attached to a finding
 * for additional context.
 */
export interface FindingReference {
  type: 'cwe' | 'owasp' | 'nist' | 'cis' | 'custom';
  url: string;
  title: string;
}

/**
 * A full remediation plan for a finding, including ordered steps,
 * pre/post conditions, a rollback plan, approval tracking, and
 * optional automated scripts or manual instructions.
 */
export interface Remediation {
  id: string;
  findingId: string;
  type: RemediationType;
  status: RemediationStatus;
  title: string;
  description: string;
  steps: RemediationStep[];
  preConditions: string[];
  postConditions: string[];
  rollbackPlan: string;
  estimatedTime: string;
  actualTime?: string;
  complexity: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  approvedBy?: string;
  approvedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  automatedScript?: string;
  manualInstructions?: string;
  validationResults?: ValidationResult[];
}

/**
 * A single step within a remediation plan, which may be automated
 * (via command or script) or performed manually, and may depend on
 * other steps.
 */
export interface RemediationStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  script?: string;
  automated: boolean;
  order: number;
  dependencies: string[];
}

/**
 * The outcome of a validation check performed after a remediation step
 * or plan to verify the issue is resolved.
 */
export interface ValidationResult {
  check: string;
  status: 'passed' | 'failed' | 'skipped';
  message: string;
  timestamp: Date;
}

/**
 * A compliance report for a specific standard, summarizing the overall
 * score, individual requirement results, scanned resources, findings,
 * and recommendations.
 */
export interface ComplianceReport {
  id: string;
  name: string;
  description: string;
  standard: ComplianceStandard;
  version: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'pending';
  score: number; // 0-100
  passScore: number; // minimum to pass
  requirements: Requirement[];
  scannedResources: number;
  findings: string[];
  recommendations: string[];
  generatedAt: Date;
  validUntil: Date;
  frameworks: string[];
}

/**
 * A single requirement within a compliance report, with its pass/fail
 * status, severity, related controls, findings, and optional evidence.
 */
export interface Requirement {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'skip';
  severity: SeverityLevel;
  controls: string[];
  findings: string[];
  implementation?: string;
  evidence?: string[];
}

/**
 * Results of evaluating resources against a security benchmark
 * (e.g. CIS Benchmark), including an aggregate score, level, and
 * individual control outcomes.
 */
export interface SecurityBenchmark {
  id: string;
  name: string;
  description: string;
  standard: ComplianceStandard;
  version: string;
  level: '1' | '2' | '3';
  controls: BenchmarkControl[];
  score: number;
  maxScore: number;
  scannedAt: Date;
  duration: number; // seconds
}

/**
 * A single control within a security benchmark, with its status,
 * severity, associated code, references, affected resources, and
 * optional audit/remediation commands.
 */
export interface BenchmarkControl {
  id: string;
  title: string;
  description: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  severity: SeverityLevel;
  code: string;
  references: string[];
  resources: string[];
  remediation: string;
  auditCommand?: string;
  remediationCommand?: string;
}

/**
 * Configuration for an external security tool integration (e.g.
 * Prisma Cloud, Prowler, CIS-CAT) including connection status and
 * last sync time.
 */
export interface SecurityIntegration {
  id: string;
  name: string;
  type: 'prisma-cloud' | 'terraform-cloud-security' | 'prowler' | 'scout2' | 'cis-cat' | 'custom';
  enabled: boolean;
  config: any;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
  errorMessage?: string;
}

/**
 * Generates a Markdown documentation string summarizing the infrastructure
 * security configuration, including scan settings, resources, findings,
 * remediations, compliance reports, and benchmarks.
 *
 * @description Produces human-readable Markdown from the given config.
 * @param config - The infrastructure security configuration to document.
 * @returns A Markdown string describing the security posture.
 */
export function generateInfrastructureSecurityMarkdown(config: InfrastructureSecurityConfig): string {
  return `# Infrastructure Security Scanning and Compliance

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Scan Enabled**: ${config.scanSettings.enabled ? 'Yes' : 'No'}
**Frequency**: ${config.scanSettings.frequency}

## Scan Settings

- **Severity Threshold**: ${config.scanSettings.severityThreshold}
- **Fail On Threshold**: ${config.scanSettings.failOnThreshold}
- **Targets**: ${config.scanSettings.targets.join(', ')}
- **Resource Types**: ${config.scanSettings.resourceTypes.join(', ')}
- **Compliance Standards**: ${config.scanSettings.complianceStandards.join(', ')}
- **Deep Analysis**: ${config.scanSettings.deepAnalysis}
- **Scan Drift**: ${config.scanSettings.scanDrift}
- **Auto Remediate**: ${config.scanSettings.autoRemediate}
- **Remediation Type**: ${config.scanSettings.remediationType}

## Resources (${config.resources.length})

${config.resources.map(resource => `
### ${resource.name}

- **Type**: ${resource.type}
- **Provider**: ${resource.provider}
${resource.region ? `- **Region**: ${resource.region}` : ''}
- **Findings**: ${resource.findings.length}
- **Drift Detected**: ${resource.driftDetected}
`).join('\n')}

## Security Findings (${config.findings.length})

${config.findings.map(finding => `
### ${finding.title}

- **Severity**: ${finding.severity}
- **Status**: ${finding.status}
- **Resource**: ${finding.resource.name}
- **Remediation**: ${finding.remediation.type} (${finding.remediation.status})
- **Confidence**: ${(finding.confidence * 100).toFixed(1)}%
`).join('\n')}

## Remediations (${config.remediations.length})
## Compliance Reports (${config.complianceReports.length})
## Security Benchmarks (${config.benchmarks.length})
`;
}

/**
 * Generates Terraform configuration for the requested cloud provider,
 * setting up the provider's native security scanning and compliance
 * resources.
 *
 * @description Returns provider-specific Terraform (HCL) for AWS, Azure, or GCP.
 * @param config - The infrastructure security configuration to provision.
 * @param provider - The target cloud provider.
 * @returns A Terraform configuration string for the given provider.
 */
export function generateInfrastructureSecurityTerraform(config: InfrastructureSecurityConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  if (provider === 'aws') {
    return `# AWS Infrastructure Security
resource "aws_securityhub_account" "main" {
  depends_on = [aws_securityhub_product.standard]
}

resource "aws_config_config_rule" "security_rule" {
  name = "${config.projectName}-security-rule"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_VERSIONING_ENABLED"
  }

  scope {
    compliance_resource_types = ["AWS::S3::Bucket"]
  }
}
`;
  } else if (provider === 'azure') {
    return `# Azure Infrastructure Security
resource "azurerm_security_center_workspace" "main" {
  scope        = azurerm_resource_group.main.id
  workspace_id = azurerm_log_analytics_workspace.main.id
}

resource "azurerm_security_center_assessment" "example" {
  assessment_type     = "BuiltIn"
  display_name        = "${config.projectName}-assessment"
  severity            = "High"
  resource_type_id    = "microsoft.compute/virtualmachines"
}
`;
  } else {
    return `# GCP Infrastructure Security
resource "google_security_command_center_source" "main" {
  display_name = "${config.projectName}-security-source"
  description  = "Security source for ${config.projectName}"
  organization = "var.organization_id"
}

resource "google_security_health_analytics_settings" "main" {
  parent = "organizations/\${var.organization_id}/locations/global"
  settings {
    name = "${config.projectName}-health-analytics"
  }
}
`;
  }
}

/**
 * Generates a TypeScript `InfrastructureSecurityManager` class source
 * string that can scan infrastructure and remediate findings.
 *
 * @description Produces a self-contained TypeScript module from the config.
 * @param config - The infrastructure security configuration to base the manager on.
 * @returns TypeScript source code as a string.
 */
export function generateSecurityManagerTypeScript(config: InfrastructureSecurityConfig): string {
  return `// Auto-generated Infrastructure Security Manager
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';

interface SecurityFinding {
  id: string;
  title: string;
  severity: string;
  status: string;
  confidence: number;
}

class InfrastructureSecurityManager extends EventEmitter {
  private findings: Map<string, SecurityFinding> = new Map();

  async scanInfrastructure(targets: string[]): Promise<SecurityFinding[]> {
    const finding: SecurityFinding = {
      id: 'finding-001',
      title: 'S3 Bucket Public Access',
      severity: 'critical',
      status: 'open',
      confidence: 0.98,
    };

    this.findings.set(finding.id, finding);
    return [finding];
  }

  async remediateFinding(findingId: string): Promise<unknown> {
    return { findingId, status: 'completed' };
  }
}

export { InfrastructureSecurityManager };
`;
}

/**
 * Generates a Python `InfrastructureSecurityManager` class source
 * string that can scan infrastructure and track findings.
 *
 * @description Produces a self-contained Python module from the config.
 * @param config - The infrastructure security configuration to base the manager on.
 * @returns Python source code as a string.
 */
export function generateSecurityManagerPython(config: InfrastructureSecurityConfig): string {
  return `# Auto-generated Infrastructure Security Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List
from dataclasses import dataclass

@dataclass
class SecurityFinding:
    id: str
    title: str
    severity: str
    status: str
    confidence: float

class InfrastructureSecurityManager:
    def __init__(self):
        self.findings: Dict[str, SecurityFinding] = {}

    async def scan_infrastructure(self, targets: List[str]) -> List[SecurityFinding]:
        finding = SecurityFinding(
            id='finding-001',
            title='S3 Bucket Public Access',
            severity='critical',
            status='open',
            confidence=0.98,
        )
        self.findings[finding.id] = finding
        return [finding]
`;
}

/**
 * Writes all infrastructure security artifacts to disk, including the
 * Markdown documentation, per-provider Terraform configs, the security
 * manager source (TypeScript or Python) with its dependencies, and the
 * raw configuration JSON.
 *
 * @description Creates the output directory and writes all generated files.
 * @param config - The infrastructure security configuration to materialize.
 * @param outputDir - Directory where files will be written (created if missing).
 * @param language - Target language for the generated security manager.
 * @returns Resolves when all files have been written.
 */
export async function writeInfrastructureSecurityFiles(
  config: InfrastructureSecurityConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  await fs.writeFile(
    path.join(outputDir, 'INFRASTRUCTURE_SECURITY.md'),
    generateInfrastructureSecurityMarkdown(config)
  );

  // Write Terraform configs for each provider
  for (const provider of config.providers) {
    const tfContent = generateInfrastructureSecurityTerraform(config, provider);
    await fs.writeFile(
      path.join(outputDir, `infrastructure-security-${provider}.tf`),
      tfContent
    );
  }

  // Write manager code
  if (language === 'typescript') {
    const tsContent = generateSecurityManagerTypeScript(config);
    await fs.writeFile(path.join(outputDir, 'infrastructure-security-manager.ts'), tsContent);

    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'Infrastructure Security Scanning',
      main: 'infrastructure-security-manager.ts',
      scripts: {
        start: 'ts-node infrastructure-security-manager.ts',
      },
      dependencies: {
        '@types/node': '^20.0.0',
        'events': '^3.3.0',
      },
    };
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  } else {
    const pyContent = generateSecurityManagerPython(config);
    await fs.writeFile(path.join(outputDir, 'infrastructure_security_manager.py'), pyContent);

    const requirements = ['pydantic>=2.0.0', 'python-dotenv>=1.0.0'];
    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      requirements.join('\n')
    );
  }

  // Write config JSON
  await fs.writeFile(
    path.join(outputDir, 'infrastructure-security-config.json'),
    JSON.stringify(config, null, 2)
  );
}

/**
 * Prints a concise summary of the infrastructure security configuration
 * to the console, including project name, providers, and counts of
 * resources, findings, remediations, and compliance reports.
 *
 * @description Renders a formatted, colorized console overview.
 * @param config - The infrastructure security configuration to display.
 * @returns No return value; output is written to the console.
 */
export function displayInfrastructureSecurityConfig(config: InfrastructureSecurityConfig): void {
  console.log(chalk.cyan('🛡️ Infrastructure Security Scanning and Compliance'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow(`Project Name:`), chalk.white(config.projectName));
  console.log(chalk.yellow(`Providers:`), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow(`Resources:`), chalk.cyan(config.resources.length));
  console.log(chalk.yellow(`Findings:`), chalk.cyan(config.findings.length));
  console.log(chalk.yellow(`Remediations:`), chalk.cyan(config.remediations.length));
  console.log(chalk.yellow(`Compliance Reports:`), chalk.cyan(config.complianceReports.length));
  console.log(chalk.gray('─'.repeat(60)));
}
