// Container Security with Trivy and Runtime Protection with Behavioral Analysis

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type ContainerRuntime = 'docker' | 'containerd' | 'cri-o' | 'podman';
export type Orchestration = 'kubernetes' | 'ecs' | 'aks' | 'gke' | 'eks' | 'openshift';
export type ScanType = 'image' | 'filesystem' | 'repository' | 'config' | 'runtime';
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type VulnerabilityStatus = 'detected' | 'investigating' | 'mitigating' | 'resolved' | 'accepted' | 'false-positive';
export type ThreatLevel = 'benign' | 'suspicious' | 'malicious' | 'critical';
export type AlertStatus = 'open' | 'investigating' | 'contained' | 'resolved';
export type PolicyAction = 'allow' | 'warn' | 'block' | 'quarantine';
export type ComplianceStandard = 'cis-benchmark' | 'nist' | 'pci-dss' | 'hipaa' | 'gdpr' | 'soc2';

export interface ContainerSecurityConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  scanSettings: ScanSettings;
  containers: ContainerManifest[];
  images: ContainerImage[];
  vulnerabilities: ContainerVulnerability[];
  behavioralAnalysis: BehavioralAnalysis[];
  securityPolicies: SecurityPolicy[];
  complianceChecks: ComplianceCheck[];
  alerts: SecurityAlert[];
  integrations: SecurityIntegration[];
}

export interface ScanSettings {
  enabled: boolean;
  frequency: 'on-build' | 'on-push' | 'on-deploy' | 'scheduled' | 'on-demand';
  interval: string; // cron expression
  scanTypes: ScanType[];
  severityThreshold: SeverityLevel;
  failOnThreshold: SeverityLevel;
  scanBaseImage: boolean;
  scanLayers: boolean;
  licenseCheck: boolean;
  secretsCheck: boolean;
  misconfigCheck: boolean;
  runtimeProtection: boolean;
  behavioralAnalysis: boolean;
  autoRemediation: boolean;
  quarantineVulnerable: boolean;
}

export interface ContainerManifest {
  id: string;
  name: string;
  runtime: ContainerRuntime;
  orchestration: Orchestration;
  namespace: string;
  containers: ContainerInstance[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  lastScanned: Date;
  scanResults: ContainerScanResult[];
  securityPosture: 'secure' | 'warning' | 'critical';
}

export interface ContainerInstance {
  id: string;
  name: string;
  imageId: string;
  imageTag: string;
  imageDigest: string;
  state: 'running' | 'stopped' | 'paused' | 'exited';
  pid: number;
  created: Date;
  started: Date;
  resources: ResourceUsage;
  mounts: Mount[];
  ports: PortMapping[];
  envVars: Record<string, string>;
  capabilities: string[];
  privileged: boolean;
  readOnlyRoot: boolean;
  securityContext: SecurityContext;
}

export interface ResourceUsage {
  cpu: CPUUsage;
  memory: MemoryUsage;
  network: NetworkUsage;
  storage: StorageUsage;
}

export interface CPUUsage {
  limit: string;
  request: string;
  usagePercent: number;
  throttling: boolean;
}

export interface MemoryUsage {
  limit: string;
  request: string;
  usagePercent: number;
  oomKills: number;
}

export interface NetworkUsage {
  interfaces: NetworkInterface[];
  totalBytesIn: number;
  totalBytesOut: number;
  connections: number;
}

export interface NetworkInterface {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  errors: number;
}

export interface StorageUsage {
  size: string;
  used: string;
  usagePercent: number;
  readOnly: boolean;
}

export interface Mount {
  source: string;
  target: string;
  type: 'bind' | 'volume' | 'tmpfs';
  readOnly: boolean;
}

export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  protocol: 'tcp' | 'udp';
  hostIP?: string;
}

export interface SecurityContext {
  user: number;
  group: number;
  fsGroup: number;
  seLinuxOptions: Record<string, string>;
  runAsNonRoot: boolean;
  allowPrivilegeEscalation: boolean;
  readOnlyRootFilesystem: boolean;
}

export interface ContainerImage {
  id: string;
  name: string;
  tag: string;
  digest: string;
  registry: string;
  size: number;
  layers: ImageLayer[];
  os: string;
  architecture: string;
  created: Date;
  author: string;
  history: ImageHistory[];
  config: ImageConfig;
  vulnerabilities: ContainerVulnerability[];
  secrets: SecretInfo[];
  misconfigurations: Misconfiguration[];
  lastScanned: Date;
  scanScore: number; // 0-100
  compliance: ComplianceStatus;
}

export interface ImageLayer {
  digest: string;
  size: number;
  command: string;
  vulnerabilities: ContainerVulnerability[];
}

export interface ImageHistory {
  created: Date;
  created_by: string;
  author: string;
  comment: string;
  empty_layer: boolean;
}

export interface ImageConfig {
  env: Record<string, string>;
  cmd: string[];
  entrypoint: string[];
  workingDir: string;
  user: string;
  exposedPorts: number[];
  labels: Record<string, string>;
  volumes: string[];
}

export interface ContainerVulnerability {
  id: string;
  vulnId: string; // CVE, GHSA, etc.
  title: string;
  description: string;
  severity: SeverityLevel;
  score: number; // CVSS 0-10
  vector: string;
  layerId: string;
  package: PackageInfo;
  publishedDate: Date;
  lastModifiedDate: Date;
  fixedIn?: string;
  status: VulnerabilityStatus;
  references: VulnerabilityReference[];
  exploitAvailable: boolean;
  exploitMaturity: 'none' | 'poc' | 'active' | 'weaponized';
  inWild: boolean;
  distroAffected: string[];
  cwe: string[];
}

export interface PackageInfo {
  name: string;
  version: string;
  type: 'os' | 'language' | 'binary';
  license: string;
  source?: string;
  maintainer?: string;
}

export interface VulnerabilityReference {
  type: 'cve' | 'ghsa' | 'usn' | 'dsa' | 'advisory';
  url: string;
  source: string;
}

export interface SecretInfo {
  id: string;
  type: 'ssh-key' | 'api-key' | 'password' | 'certificate' | 'token';
  severity: SeverityLevel;
  layerId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string; // Redacted
  fingerprint: string;
  committedDate?: Date;
  author?: string;
}

export interface Misconfiguration {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  category: 'dockerfile' | 'kubernetes' | 'security' | 'best-practice';
  layerId?: string;
  code: string;
  cause: string;
  resolution: string;
  references: string[];
}

export interface ComplianceStatus {
  cisLevel: number; // 1, 2
  score: number; // 0-100
  passed: number;
  failed: number;
  skipped: number;
  checks: ComplianceCheckResult[];
}

export interface ComplianceCheckResult {
  id: string;
  title: string;
  description: string;
  category: string;
  level: number;
  status: 'pass' | 'fail' | 'skip' | 'warn';
  severity: SeverityLevel;
  reason: string;
}

export interface ContainerScanResult {
  scanId: string;
  timestamp: Date;
  scanner: 'trivy' | 'grype' | 'snyk' | 'clair';
  type: ScanType;
  imageId: string;
  status: 'completed' | 'failed' | 'in-progress';
  duration: number; // seconds
  vulnerabilitiesFound: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  score: number; // 0-100
  passed: boolean;
  reportPath: string;
}

export interface BehavioralAnalysis {
  id: string;
  containerId: string;
  timestamp: Date;
  type: 'anomaly' | 'threat' | 'baseline' | 'incident';
  severity: SeverityLevel;
  threatLevel: ThreatLevel;
  category: 'process' | 'network' | 'file' | 'system' | 'privilege' | 'resource';
  title: string;
  description: string;
  indicators: ThreatIndicator[];
  timeline: EventTimeline[];
  confidence: number; // 0-1
  baseline: BaselineMetric[];
  status: AlertStatus;
  response: ResponseAction[];
  assignedTo?: string;
  resolvedAt?: Date;
}

export interface ThreatIndicator {
  type: string;
  value: string;
  severity: SeverityLevel;
  description: string;
  detected: Date;
}

export interface EventTimeline {
  timestamp: Date;
  event: string;
  details: any;
  source: string;
}

export interface BaselineMetric {
  metric: string;
  normalRange: [number, number];
  currentValue: number;
  deviation: number; // standard deviations
  significance: 'normal' | 'warning' | 'anomaly';
}

export interface ResponseAction {
  action: string;
  executed: boolean;
  executedAt?: Date;
  executedBy?: string;
  result?: string;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scope: PolicyScope[];
  rules: PolicyRule[];
  exceptions: PolicyException[];
  enforcementLevel: 'audit' | 'warn' | 'block' | 'quarantine';
}

export interface PolicyScope {
  type: 'image' | 'container' | 'namespace' | 'label';
  value: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  condition: string;
  severity: SeverityLevel;
  action: PolicyAction;
  parameters: Record<string, any>;
}

export interface PolicyException {
  id: string;
  scope: string;
  reason: string;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  approvedBy?: string;
}

export interface ComplianceCheck {
  id: string;
  standard: ComplianceStandard;
  version: string;
  enabled: boolean;
  checks: ComplianceCheckDef[];
  lastRun: Date;
  results: ComplianceCheckResult[];
  overallStatus: 'compliant' | 'non-compliant' | 'partial';
  score: number; // 0-100
}

export interface ComplianceCheckDef {
  id: string;
  title: string;
  description: string;
  category: string;
  level: number;
  automated: boolean;
}

export interface SecurityAlert {
  id: string;
  type: 'vulnerability' | 'misconfiguration' | 'behavior' | 'compliance' | 'secret';
  severity: SeverityLevel;
  title: string;
  description: string;
  source: string;
  containerId?: string;
  imageId?: string;
  vulnerabilityId?: string;
  analysisId?: string;
  timestamp: Date;
  status: AlertStatus;
  assignedTo?: string;
  dueDate?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface SecurityIntegration {
  tool: 'trivy' | 'falco' | 'opa' | 'istio' | 'calico' | 'kube-bench';
  enabled: boolean;
  config: any;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
}

// Main configuration function
export function containerSecurity(config: ContainerSecurityConfig) {
  return {
    projectName: config.projectName,
    providers: config.providers,
    scanSettings: config.scanSettings,
    containers: config.containers,
    images: config.images,
    vulnerabilities: config.vulnerabilities,
    behavioralAnalysis: config.behavioralAnalysis,
    securityPolicies: config.securityPolicies,
    complianceChecks: config.complianceChecks,
    alerts: config.alerts,
    integrations: config.integrations,
  };
}

// Display configuration
export function displayConfig(config: ReturnType<typeof containerSecurity>) {
  console.log(chalk.cyan('🔒 Container Security with Trivy and Runtime Protection'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Scanning Enabled:'), config.scanSettings.enabled ? 'Yes' : 'No');
  console.log(chalk.yellow('Frequency:'), config.scanSettings.frequency);
  console.log(chalk.yellow('Scan Types:'), config.scanSettings.scanTypes.join(', '));
  console.log(chalk.yellow('Runtime Protection:'), config.scanSettings.runtimeProtection ? 'Yes' : 'No');
  console.log(chalk.yellow('Behavioral Analysis:'), config.scanSettings.behavioralAnalysis ? 'Yes' : 'No');
  console.log(chalk.yellow('Containers:'), chalk.cyan(String(config.containers.length)));
  console.log(chalk.yellow('Images:'), chalk.cyan(String(config.images.length)));
  console.log(chalk.yellow('Vulnerabilities:'), chalk.cyan(String(config.vulnerabilities.length)));
  console.log(chalk.yellow('Behavioral Events:'), chalk.cyan(String(config.behavioralAnalysis.length)));
  console.log(chalk.yellow('Security Policies:'), chalk.cyan(String(config.securityPolicies.length)));
  console.log(chalk.yellow('Compliance Checks:'), chalk.cyan(String(config.complianceChecks.length)));
  console.log(chalk.yellow('Security Integrations:'), chalk.cyan(String(config.integrations.length)));
  console.log(chalk.gray('─'.repeat(60)));
}

// Generate markdown documentation
export function generateMD(config: ReturnType<typeof containerSecurity>): string {
  let md = '';

  md += '# Container Security with Trivy and Runtime Protection\n\n';

  md += '## Features\n\n';
  md += '- Multi-runtime support: Docker, Containerd, CRI-O, Podman\n';
  md += '- Orchestration platforms: Kubernetes, ECS, AKS, GKE, EKS, OpenShift\n';
  md += '- Scan types: image, filesystem, repository, config, runtime\n';
  md += '- Scanner tools: Trivy, Grype, Snyk, Clair\n';
  md += '- Vulnerability severity: critical, high, medium, low, unknown\n';
  md += '- CVSS scoring with vector analysis\n';
  md += '- Layer-by-layer vulnerability mapping\n';
  md += '- Secret detection (SSH keys, API keys, passwords, certificates, tokens)\n';
  md += '- Misconfiguration detection (Dockerfile, Kubernetes, security)\n';
  md += '- Compliance standards: CIS Benchmark, NIST, PCI-DSS, HIPAA, GDPR, SOC2\n';
  md += '- Behavioral analysis with anomaly detection\n';
  md += '- Threat levels: benign, suspicious, malicious, critical\n';
  md += '- Runtime protection with process monitoring\n';
  md += '- Network traffic analysis\n';
  md += '- File system monitoring\n';
  md += '- Privilege escalation detection\n';
  md += '- Resource anomaly detection\n';
  md += '- Security policies with enforcement (audit, warn, block, quarantine)\n';
  md += '- Automatic remediation and quarantining\n';
  md += '- Multi-cloud provider support (AWS, Azure, GCP)\n\n';

  md += '## Container Security Posture\n\n';
  config.containers.forEach((container) => {
    md += `### ${container.name}\n`;
    md += `- **Runtime**: ${container.runtime}\n`;
    md += `- **Orchestration**: ${container.orchestration}\n`;
    md += `- **Namespace**: ${container.namespace}\n`;
    md += `- **Containers**: ${container.containers.length}\n`;
    md += `- **Security Posture**: ${container.securityPosture}\n`;
    md += `- **Last Scanned**: ${container.lastScanned.toISOString()}\n\n`;
  });

  md += '## Image Vulnerabilities\n\n';
  const vulnSummary = config.vulnerabilities.reduce((acc, vuln) => {
    acc[vuln.severity]++;
    return acc;
  }, {} as Record<SeverityLevel, number>);

  md += '| Severity | Count |\n';
  md += '|----------|-------|\n';
  Object.entries(vulnSummary).forEach(([severity, count]) => {
    md += `| ${severity.charAt(0).toUpperCase() + severity.slice(1)} | ${count} |\n`;
  });
  md += '\n';

  md += '## Behavioral Analysis\n\n';
  config.behavioralAnalysis.forEach((analysis) => {
    md += `### ${analysis.title}\n`;
    md += `- **Container**: ${analysis.containerId}\n`;
    md += `- **Type**: ${analysis.type}\n`;
    md += `- **Severity**: ${analysis.severity}\n`;
    md += `- **Threat Level**: ${analysis.threatLevel}\n`;
    md += `- **Category**: ${analysis.category}\n`;
    md += `- **Confidence**: ${(analysis.confidence * 100).toFixed(0)}%\n`;
    md += `- **Status**: ${analysis.status}\n\n`;
  });

  md += '## Compliance Status\n\n';
  config.complianceChecks.forEach((check) => {
    md += `### ${check.standard.toUpperCase()} ${check.version}\n`;
    md += `- **Status**: ${check.overallStatus}\n`;
    md += `- **Score**: ${check.score}/100\n`;
    md += `- **Passed**: ${check.results.filter(r => r.status === 'pass').length}\n`;
    md += `- **Failed**: ${check.results.filter(r => r.status === 'fail').length}\n\n`;
  });

  return md;
}

// Generate Terraform configuration
export function generateTerraform(config: ReturnType<typeof containerSecurity>, provider: 'aws' | 'azure' | 'gcp'): string {
  let tf = '';

  if (provider === 'aws') {
    tf += generateAWS(config);
  } else if (provider === 'azure') {
    tf += generateAzure(config);
  } else if (provider === 'gcp') {
    tf += generateGCP(config);
  }

  return tf;
}

function generateAWS(config: ReturnType<typeof containerSecurity>): string {
  let tf = '';

  tf += '# Container Security Infrastructure on AWS\n\n';
  tf += 'terraform {\n';
  tf += '  required_version = ">= 1.0"\n';
  tf += '  required_providers {\n';
  tf += '    aws = {\n';
  tf += '      source  = "hashicorp/aws"\n';
  tf += '      version = "~> 5.0"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'provider "aws" {\n';
  tf += '  region = var.aws_region\n';
  tf += '}\n\n';

  tf += '# ECR Repository for container images\n';
  tf += 'resource "aws_ecr_repository" "secure_images" {\n';
  tf += '  name = "${var.project_name}/secure-images"\n';
  tf += '  image_scanning_configuration {\n';
  tf += '    scan_on_push = true\n';
  tf += '    image_tag_mutability = "MUTABLE"\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# Lambda function for image scanning\n';
  tf += 'resource "aws_lambda_function" "trivy_scanner" {\n';
  tf += '  function_name = "${var.project_name}-trivy-scanner"\n';
  tf += '  role          = aws_iam_role.scanner_role.arn\n';
  tf += '  package_type  = "Image"\n';
  tf += '  image_uri     = var.scanner_image\n\n';

  tf += '  environment {\n';
  tf += '    variables = {\n';
  tf += '      ECR_REPOSITORY = aws_ecr_repository.secure_images.name\n';
  tf += '      SEVERITY_THRESHOLD = "${config.scanSettings.severityThreshold}"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# EventBridge Rule for scan on push\n';
  tf += 'resource "aws_cloudwatch_event_rule" "ecr_push" {\n';
  tf += '  name = "${var.project_name}-ecr-push-scan"\n';
  tf += '  description = "Trigger Trivy scan on ECR image push"\n\n';

  tf += '  event_pattern = jsonencode({\n';
  tf += '    source = ["aws.ecr"],\n';
  tf += '    "detail-type" = ["ECR Image Action"],\n';
  tf += '    detail = {\n';
  tf += '      action-type = ["PUSH"]\n';
  tf += '    }\n';
  tf += '  })\n';
  tf += '}\n\n';

  tf += '# SNS Topic for security alerts\n';
  tf += 'resource "aws_sns_topic" "security_alerts" {\n';
  tf += '  name = "${var.project_name}-container-security-alerts"\n';
  tf += '}\n\n';

  tf += '# ECS Task Definition for Falco runtime security\n';
  tf += 'resource "aws_ecs_task_definition" "falco" {\n';
  tf += '  family = "${var.project_name}-falco"\n';
  tf += '  network_mode = "awsvpc"\n';
  tf += '  requires_compatibilities = ["FARGATE"]\n';
  tf += '  cpu = "256"\n';
  tf += '  memory = "512"\n\n';

  tf += '  container_definitions = jsonencode([\n';
  tf += '    {\n';
  tf += '      name = "falco",\n';
  tf += '      image = "falcosecurity/falco:latest",\n';
  tf += '      essential = true,\n';
  tf += '      privileged = true,\n';
  tf += '      linuxParameters = {\n';
  tf += '        capabilities = {\n';
  tf += '        add = ["ALL"]\n';
  tf += '      }\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '])\n';
  tf += '}\n\n';

  tf += 'variable "aws_region" {\n';
  tf += '  description = "AWS region"\n';
  tf += '  type        = string\n';
  tf += '  default     = "us-east-1"\n';
  tf += '}\n\n';

  tf += 'variable "project_name" {\n';
  tf += '  description = "Project name"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "scanner_image" {\n';
  tf += '  description = "Trivy scanner image"\n';
  tf += '  type        = string\n';
  tf += '}\n';

  return tf;
}

function generateAzure(config: ReturnType<typeof containerSecurity>): string {
  let tf = '';

  tf += '# Container Security Infrastructure on Azure\n\n';
  tf += 'terraform {\n';
  tf += '  required_version = ">= 1.0"\n';
  tf += '  required_providers {\n';
  tf += '    azurerm = {\n';
  tf += '      source  = "hashicorp/azurerm"\n';
  tf += '      version = "~> 3.0"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'provider "azurerm" {\n';
  tf += '  features {}\n';
  tf += '}\n\n';

  tf += '# Azure Container Registry\n';
  tf += 'resource "azurerm_container_registry" "secure_acr" {\n';
  tf += '  name                = "${var.project_name}secureacr"\n';
  tf += '  resource_group_name = azurerm_resource_group.security_rg.name\n';
  tf += '  location            = azurerm_resource_group.security_rg.location\n';
  tf += '  sku                 = "Premium"\n';
  tf += '  admin_enabled       = true\n\n';

  tf += '  trust_policy {\n';
  tf += '    enabled = true\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# AKS Cluster with security features\n';
  tf += 'resource "azurerm_kubernetes_cluster" "secure_aks" {\n';
  tf += '  name                = "${var.project_name}-aks"\n';
  tf += '  location            = azurerm_resource_group.security_rg.location\n';
  tf += '  resource_group_name = azurerm_resource_group.security_rg.name\n';
  tf += '  dns_prefix          = "${var.project_name}-aks"\n';
  tf += '  kubernetes_version  = "1.27"\n\n';

  tf += '  default_node_pool {\n';
  tf += '    name       = "default"\n';
  tf += '    node_count = 3\n';
  tf += '    vm_size    = "Standard_DS2_v2"\n\n';

  tf += '    upgrade_settings {\n';
  tf += '      max_surge = "10%"\n';
  tf += '    }\n';
  tf += '  }\n\n';

  tf += '  identity {\n';
  tf += '    type = "SystemAssigned"\n';
  tf += '  }\n\n';

  tf += '  azure_active_directory_role_based_access_control {\n';
  tf += '    managed = true\n';
  tf += '    admin_group_object_ids = [\n';
  tf += '      data.azurerm_client_config.current.object_id\n';
  tf += '    ]\n';
  tf += '  }\n\n';

  tf += '  network_profile {\n';
  tf += '    network_plugin = "azure"\n';
  tf += '  }\n\n';

  tf += '  security_posture_config {\n';
  tf += '    azure_defender_enabled = true\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'data "azurerm_client_config" "current" {}\n';

  return tf;
}

function generateGCP(config: ReturnType<typeof containerSecurity>): string {
  let tf = '';

  tf += '# Container Security Infrastructure on GCP\n\n';
  tf += 'terraform {\n';
  tf += '  required_version = ">= 1.0"\n';
  tf += '  required_providers {\n';
  tf += '    google = {\n';
  tf += '      source  = "hashicorp/google"\n';
  tf += '      version = "~> 5.0"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'provider "google" {\n';
  tf += '  project = var.gcp_project\n';
  tf += '  region  = var.gcp_region\n';
  tf += '}\n\n';

  tf += '# GKE Cluster with security features\n';
  tf += 'resource "google_container_cluster" "secure_gke" {\n';
  tf += '  name     = "${var.project_name}-gke"\n';
  tf += '  location = var.gcp_region\n\n';

  tf += '  remove_default_node_pool = true\n';
  tf += '  initial_node_count       = 1\n\n';

  tf += '  network    = google_compute_network.vpc.name\n';
  tf += '  subnetwork = google_compute_subnetwork.subnet.name\n\n';

  tf += '  master_authorized_networks_config {\n';
  tf += '    cidr_blocks {\n';
  tf += '      cidr_block   = "10.0.0.0/8"\n';
  tf += '      display_name = "Internal network"\n';
  tf += '    }\n';
  tf += '  }\n\n';

  tf += '  ip_allocation_policy {\n';
  tf += '    cluster_secondary_range_name = google_compute_subnetwork.subnet.secondary_ip_range.0.range_name\n';
  tf += '    services_secondary_range_name  = google_compute_subnetwork.subnet.secondary_ip_range.1.range_name\n';
  tf += '  }\n\n';

  tf += '  binary_authorization {\n';
  tf += '    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"\n';
  tf += '  }\n\n';

  tf += '  security_posture_config {\n';
  tf += '    mode = "BASIC"\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# Artifact Registry with vulnerability scanning\n';
  tf += 'resource "google_artifact_registry_repository" "secure_images" {\n';
  tf += '  location      = var.gcp_region\n';
  tf += '  repository_id = "secure-images"\n';
  tf += '  description   = "Container images with vulnerability scanning"\n';
  tf += '  format        = "DOCKER"\n\n';

  tf += '  vulnerability_scanning {\n';
  tf += '    enable_vulnerability_scanning = true\n';
  tf += '  }\n';
  tf += '}\n';

  return tf;
}

// Generate TypeScript manager class
export function generateTypeScript(config: ReturnType<typeof containerSecurity>): string {
  let ts = '';

  ts += '// Auto-generated Container Security Manager\n';
  ts += `// Generated at: ${new Date().toISOString()}\n\n`;

  ts += `import { EventEmitter } from 'events';\n\n`;

  ts += `interface ContainerVulnerability {\n`;
  ts += `  id: string;\n`;
  ts += `  vulnId: string;\n`;
  ts += `  title: string;\n`;
  ts += `  severity: string;\n`;
  ts += `  score: number;\n`;
  ts += `  layerId: string;\n`;
  ts += `  package: any;\n`;
  ts += `  fixedIn?: string;\n`;
  ts += `  exploitAvailable: boolean;\n`;
  ts += `  inWild: boolean;\n`;
  ts += `}\n\n`;

  ts += `interface BehavioralAnalysis {\n`;
  ts += `  id: string;\n`;
  ts += `  containerId: string;\n`;
  ts += `  type: string;\n`;
  ts += `  severity: string;\n`;
  ts += `  threatLevel: string;\n`;
  ts += `  category: string;\n`;
  ts += `  title: string;\n`;
  ts += `  confidence: number;\n`;
  ts += `  status: string;\n`;
  ts += `}\n\n`;

  ts += `class ContainerSecurityManager extends EventEmitter {\n`;
  ts += `  private vulnerabilities: Map<string, ContainerVulnerability> = new Map();\n`;
  ts += `  private behavioralAnalysis: BehavioralAnalysis[] = [];\n`;
  ts += `  private config: any;\n\n`;

  ts += `  constructor(options: any = {}) {\n`;
  ts += `    super();\n`;
  ts += `    this.config = options;\n`;
  ts += `  }\n\n`;

  ts += `  async scanImage(imageTag: string, scanner: string = 'trivy'): Promise<any> {\n`;
  ts += `    const scanId = \`scan-\${Date.now()}\`;\n`;
  ts += `    const startTime = Date.now();\n\n`;

  ts += `    // Simulate scanning\n`;
  ts += `    const vulnerabilities: ContainerVulnerability[] = [\n`;
  ts += `      {\n`;
  ts += `        id: 'vuln-001',\n`;
  ts += `        vulnId: 'CVE-2024-1234',\n`;
  ts += `        title: 'Heap buffer overflow in libpng',\n`;
  ts += `        severity: 'high',\n`;
  ts += `        score: 7.8,\n`;
  ts += `        layerId: 'sha256:abc123',\n`;
  ts += `        package: { name: 'libpng', version: '1.6.37', type: 'os' },\n`;
  ts += `        fixedIn: '1.6.38',\n`;
  ts += `        exploitAvailable: true,\n`;
  ts += `        inWild: false,\n`;
  ts += `      },\n`;
  ts += `      {\n`;
  ts += `        id: 'vuln-002',\n`;
  ts += `        vulnId: 'CVE-2024-5678',\n`;
  ts += `        title: 'Use-after-free in libwebp',\n`;
  ts += `        severity: 'critical',\n`;
  ts += `        score: 9.1,\n`;
  ts += `        layerId: 'sha256:def456',\n`;
  ts += `        package: { name: 'libwebp', version: '1.0.2', type: 'os' },\n`;
  ts += `        fixedIn: '1.0.3',\n`;
  ts += `        exploitAvailable: true,\n`;
  ts += `        inWild: true,\n`;
  ts += `      },\n`;
  ts += `    ];\n\n`;

  ts += `    vulnerabilities.forEach(v => this.vulnerabilities.set(v.id, v));\n\n`;

  ts += `    const duration = (Date.now() - startTime) / 1000;\n\n`;

  ts += `    const result = {\n`;
  ts += `      scanId,\n`;
  ts += `      timestamp: new Date(),\n`;
  ts += `      scanner,\n`;
  ts += `      imageTag,\n`;
  ts += `      status: 'completed',\n`;
  ts += `      duration,\n`;
  ts += `      vulnerabilitiesFound: vulnerabilities.length,\n`;
  ts += `      criticalCount: vulnerabilities.filter(v => v.severity === 'critical').length,\n`;
  ts += `      highCount: vulnerabilities.filter(v => v.severity === 'high').length,\n`;
  ts += `      score: 100 - (vulnerabilities.reduce((acc, v) => acc + v.score, 0) / vulnerabilities.length * 10),\n`;
  ts += `      passed: vulnerabilities.every(v => v.score < this.config.severityThreshold),\n`;
  ts += `      vulnerabilities,\n`;
  ts += `    };\n\n`;

  ts += `    this.emit('scan-completed', result);\n`;
  ts += `    return result;\n`;
  ts += `  }\n\n`;

  ts += `  async analyzeBehavior(containerId: string): Promise<BehavioralAnalysis[]> {\n`;
  ts += `    // Simulate behavioral analysis\n`;
  ts += `    const analysis: BehavioralAnalysis[] = [\n`;
  ts += `      {\n`;
  ts += `        id: 'analysis-001',\n`;
  ts += `        containerId,\n`;
  ts += `        type: 'anomaly',\n`;
  ts += `        severity: 'high',\n`;
  ts += `        threatLevel: 'suspicious',\n`;
  ts += `        category: 'process',\n`;
  ts += `        title: 'Suspicious shell spawned',\n`;
  ts += `        confidence: 0.85,\n`;
  ts += `        status: 'open',\n`;
  ts += `      },\n`;
  ts += `    ];\n\n`;

  ts += `    this.behavioralAnalysis.push(...analysis);\n`;
  ts += `    this.emit('behavior-detected', analysis);\n\n`;
  ts += `    return analysis;\n`;
  ts += `  }\n\n`;

  ts += `  getVulnerabilitiesBySeverity(severity: string): ContainerVulnerability[] {\n`;
  ts += `    return Array.from(this.vulnerabilities.values()).filter(v => v.severity === severity);\n`;
  ts += `  }\n`;
  ts += `}\n\n`;

  ts += `export { ContainerSecurityManager, ContainerVulnerability, BehavioralAnalysis };\n`;

  return ts;
}

// Generate Python manager class
export function generatePython(config: ReturnType<typeof containerSecurity>): string {
  let py = '';

  py += '# Auto-generated Container Security Manager\n';
  py += `# Generated at: ${new Date().toISOString()}\n\n`;

  py += 'from typing import Dict, List, Any, Optional\n';
  py += 'from dataclasses import dataclass, field\n';
  py += 'from datetime import datetime\n';
  py += 'from enum import Enum\n\n';

  py += 'class SeverityLevel(Enum):\n';
  py += '    CRITICAL = "critical"\n';
  py += '    HIGH = "high"\n';
  py += '    MEDIUM = "medium"\n';
  py += '    LOW = "low"\n';
  py += '    UNKNOWN = "unknown"\n\n';

  py += 'class ThreatLevel(Enum):\n';
  py += '    BENIGN = "benign"\n';
  py += '    SUSPICIOUS = "suspicious"\n';
  py += '    MALICIOUS = "malicious"\n';
  py += '    CRITICAL = "critical"\n\n';

  py += '@dataclass\n';
  py += 'class ContainerVulnerability:\n';
  py += '    id: str\n';
  py += '    vuln_id: str\n';
  py += '    title: str\n';
  py += '    severity: str\n';
  py += '    score: float\n';
  py += '    layer_id: str\n';
  py += '    package: Dict[str, Any]\n';
  py += '    fixed_in: Optional[str] = None\n';
  py += '    exploit_available: bool = False\n';
  py += '    in_wild: bool = False\n\n';

  py += '@dataclass\n';
  py += 'class BehavioralAnalysis:\n';
  py += '    id: str\n';
  py += '    container_id: str\n';
  py += '    type: str\n';
  py += '    severity: str\n';
  py += '    threat_level: str\n';
  py += '    category: str\n';
  py += '    title: str\n';
  py += '    confidence: float\n';
  py += '    status: str\n\n';

  py += 'class ContainerSecurityManager:\n';
  py += '    def __init__(self, project_name: str = \'ContainerSecurity\'):\n';
  py += '        self.project_name = project_name\n';
  py += '        self.vulnerabilities: Dict[str, ContainerVulnerability] = {}\n';
  py += '        self.behavioral_analysis: List[BehavioralAnalysis] = []\n\n';

  py += '    async def scan_image(self, image_tag: str, scanner: str = \'trivy\') -> Dict[str, Any]:\n';
  py += '        scan_id = f"scan-{int(datetime.now().timestamp())}"\n';
  py += '        start_time = datetime.now()\n\n';

  py += '        # Simulate scanning\n';
  py += '        vuln = ContainerVulnerability(\n';
  py += '            id=\'vuln-001\',\n';
  py += '            vuln_id=\'CVE-2024-1234\',\n';
  py += '            title=\'Heap buffer overflow in libpng\',\n';
  py += '            severity=\'high\',\n';
  py += '            score=7.8,\n';
  py += '            layer_id=\'sha256:abc123\',\n';
  py += '            package={\'name\': \'libpng\', \'version\': \'1.6.37\', \'type\': \'os\'},\n';
  py += '            fixed_in=\'1.6.38\',\n';
  py += '            exploit_available=True,\n';
  py += '            in_wild=False,\n';
  py += '        )\n\n';

  py += '        self.vulnerabilities[vuln.id] = vuln\n\n';

  py += '        duration = (datetime.now() - start_time).total_seconds()\n\n';

  py += '        result = {\n';
  py += '            \'scanId\': scan_id,\n';
  py += '            \'timestamp\': datetime.now(),\n';
  py += '            \'scanner\': scanner,\n';
  py += '            \'imageTag\': image_tag,\n';
  py += '            \'status\': \'completed\',\n';
  py += '            \'duration\': duration,\n';
  py += '            \'vulnerabilitiesFound\': 1,\n';
  py += '            \'criticalCount\': 0,\n';
  py += '            \'highCount\': 1,\n';
  py += '            \'score\': 72,\n';
  py += '            \'passed\': True,\n';
  py += '            \'vulnerabilities\': [vuln],\n';
  py += '        }\n\n';

  py += '        return result\n\n';

  py += '    def get_vulnerabilities_by_severity(self, severity: str) -> List[ContainerVulnerability]:\n';
  py += '        return [v for v in self.vulnerabilities.values() if v.severity == severity]\n';

  return py;
}

// Write files to disk
export async function writeFiles(
  config: ReturnType<typeof containerSecurity>,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Generate and write Terraform for each provider
  for (const provider of config.providers) {
    const tf = generateTerraform(config, provider);
    const tfPath = path.join(outputDir, `container-security-${provider}.tf`);
    await fs.writeFile(tfPath, tf);
  }

  // Generate and write manager class
  const managerCode = language === 'typescript' ? generateTypeScript(config) : generatePython(config);
  const managerFilename = language === 'typescript' ? 'container-security-manager.ts' : 'container_security_manager.py';
  const managerPath = path.join(outputDir, managerFilename);
  await fs.writeFile(managerPath, managerCode);

  // Generate and write markdown documentation
  const md = generateMD(config);
  const mdPath = path.join(outputDir, 'CONTAINER_SECURITY.md');
  await fs.writeFile(mdPath, md);

  // Generate and write config JSON
  const configPath = path.join(outputDir, 'container-security-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  // Generate package.json or requirements.txt
  if (language === 'typescript') {
    const packageJson = {
      name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: 'Container security with Trivy and runtime protection',
      main: 'container-security-manager.ts',
      scripts: {
        start: 'ts-node container-security-manager.ts',
        scan: 'ts-node container-security-manager.ts --scan',
      },
      dependencies: {
        eventemitter3: '^4.0.7',
        axios: '^1.6.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
        'ts-node': '^10.9.0',
      },
    };
    const pkgJsonPath = path.join(outputDir, 'package.json');
    await fs.writeFile(pkgJsonPath, JSON.stringify(packageJson, null, 2));
  } else {
    const requirements = [
      'pydantic>=2.0.0',
      'python-dateutil>=2.8.0',
    ];
    const reqPath = path.join(outputDir, 'requirements.txt');
    await fs.writeFile(reqPath, requirements.join('\n'));
  }
}
