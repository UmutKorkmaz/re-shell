// Code Security Analysis with SonarQube and Custom Rules with AI Enhancement

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type Language = 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'csharp' | 'cpp' | 'ruby' | 'php' | 'rust' | 'swift';
export type IssueSeverity = 'blocker' | 'critical' | 'major' | 'minor' | 'info';
export type IssueType = 'vulnerability' | 'bug' | 'code-smell' | 'security' | 'hotspot' | 'custom';
export type RuleType = 'vulnerability' | 'bug' | 'code-smell' | 'security-hotspot' | 'custom';
export type RuleStatus = 'active' | 'deprecated' | 'removed' | 'beta';
export type QualityGateStatus = 'passed' | 'failed' | 'warned' | 'skipped';
export type ScanStatus = 'success' | 'failed' | 'in-progress' | 'pending' | 'cancelled';
export type AIModelType = 'rule-generation' | 'issue-detection' | 'remediation' | 'pattern-matching';

export interface CodeSecurityAnalysisConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  analysisSettings: AnalysisSettings;
  codebases: Codebase[];
  issues: SecurityIssue[];
  rules: SecurityRule[];
  qualityGates: QualityGate[];
  aiModels: AIModel[];
  integrations: AnalysisIntegration[];
  reports: AnalysisReport[];
}

export interface AnalysisSettings {
  enabled: boolean;
  frequency: 'on-commit' | 'on-push' | 'scheduled' | 'manual';
  languages: Language[];
  severityThreshold: IssueSeverity;
  failOnThreshold: IssueSeverity;
  scanTests: boolean;
  scanTestCoverage: boolean;
  analyzeComplexity: boolean;
  analyzeDuplication: boolean;
  analyzeSecurityHotspots: boolean;
  customRulesEnabled: boolean;
  aiEnhancedAnalysis: boolean;
  autoFix: boolean;
  parallelAnalysis: boolean;
  maxAnalysisTime: number; // minutes
}

export interface Codebase {
  id: string;
  name: string;
  language: Language;
  path: string;
  branch: string;
  lastCommitSha: string;
  lastScanned: Date;
  totalFiles: number;
  totalLines: number;
  codeLines: number;
  testLines: number;
  coverage: number; // percentage
  complexity: number;
  duplication: number; // percentage
  securityRating: 'A' | 'B' | 'C' | 'D' | 'E';
  reliabilityRating: 'A' | 'B' | 'C' | 'D' | 'E';
  maintainabilityRating: 'A' | 'B' | 'C' | 'D' | 'E';
  technicalDebt: number; // hours
  issues: SecurityIssue[];
  hotspots: SecurityHotspot[];
  metrics: CodeMetrics;
}

export interface CodeMetrics {
  files: FileMetric[];
  functions: FunctionMetric[];
  classes: ClassMetric[];
  complexity: ComplexityMetric[];
  coverage: CoverageMetric[];
  duplication: DuplicationMetric[];
}

export interface FileMetric {
  path: string;
  lines: number;
  codeLines: number;
  commentLines: number;
  complexity: number;
  functions: number;
  classes: number;
  issues: number;
  coverage: number;
}

export interface FunctionMetric {
  name: string;
  file: string;
  line: number;
  complexity: number;
  lines: number;
  parameters: number;
  returnCount: number;
  nesting: number;
  issues: string[];
}

export interface ClassMetric {
  name: string;
  file: string;
  line: number;
  lines: number;
  methods: number;
  fields: number;
  complexity: number;
  coupling: number;
  cohesion: number;
  issues: string[];
}

export interface ComplexityMetric {
  name: string;
  type: 'cyclomatic' | 'cognitive' | 'nesting';
  value: number;
  threshold: number;
  severity: IssueSeverity;
}

export interface CoverageMetric {
  name: string;
  type: 'line' | 'branch' | 'path' | 'condition';
  covered: number;
  total: number;
  percentage: number;
  threshold: number;
}

export interface DuplicationMetric {
  file: string;
  lines: number;
  duplicatedLines: number;
  percentage: number;
  threshold: number;
}

export interface SecurityIssue {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  type: IssueType;
  language: Language;
  file: string;
  line: number;
  endLine: number;
  column?: number;
  endColumn?: number;
  effort: string; // time to fix
  debt: string; // technical debt in minutes
  status: 'open' | 'acknowledged' | 'resolved' | 'false-positive';
  author: string;
  createdAt: Date;
  updatedAt: Date;
  assignee?: string;
  resolution?: string;
  rule: SecurityRule;
  codeSnippet: string;
  suggestedFix?: string;
  aiDetected: boolean;
  aiConfidence: number; // 0-1
  references: IssueReference[];
  cwe?: string[];
  owasp?: string[];
}

export interface SecurityHotspot {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  file: string;
  line: number;
  status: 'reviewed' | 'to-review' | 'acknowledged' | 'safe';
  author: string;
  createdAt: Date;
  updatedAt: Date;
  reviewer?: string;
  reviewedAt?: Date;
  comment?: string;
  rule: SecurityRule;
  vulnerabilityProbability: 'low' | 'medium' | 'high';
  cwe: string[];
}

export interface SecurityRule {
  id: string;
  key: string;
  name: string;
  type: RuleType;
  severity: IssueSeverity;
  language: Language;
  description: string;
  htmlDescription: string;
  status: RuleStatus;
  tags: string[];
  params: RuleParameter[];
  isActive: boolean;
  isTemplate: boolean;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  aiGenerated: boolean;
  aiModel?: string;
  trainingData?: TrainingData[];
}

export interface RuleParameter {
  key: string;
  name: string;
  description: string;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'text';
  defaultValue: any;
}

export interface TrainingData {
  id: string;
  description: string;
  codeExamples: CodeExample[];
  patterns: Pattern[];
  outcomes: RuleOutcome[];
}

export interface CodeExample {
  vulnerable: string;
  secure: string;
  description: string;
  language: Language;
}

export interface Pattern {
  type: string;
  pattern: string;
  description: string;
}

export interface RuleOutcome {
  type: 'vulnerability' | 'bug' | 'code-smell';
  severity: IssueSeverity;
  confidence: number;
}

export interface IssueReference {
  type: 'cwe' | 'owasp' | 'owasp-top10' | 'sans-top25' | 'pci-dss' | 'nist' | 'article';
  url: string;
  title: string;
}

export interface QualityGate {
  id: string;
  name: string;
  description: string;
  conditions: GateCondition[];
  status: QualityGateStatus;
  lastEvaluation: Date;
  evaluatedBy: string;
}

export interface GateCondition {
  id: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'ge' | 'le';
  threshold: number;
  status: 'ok' | 'error' | 'warn';
  actualValue: number;
}

export interface AIModel {
  id: string;
  name: string;
  type: AIModelType;
  language: Language;
  model: string; // GPT-4, Claude, custom
  version: string;
  accuracy: number; // 0-1
  precision: number;
  recall: number;
  f1Score: number;
  trainingDataSize: number;
  lastTrained: Date;
  status: 'training' | 'deployed' | 'deprecated';
  features: string[];
  config: any;
}

export interface AnalysisIntegration {
  tool: 'sonarqube' | 'sonarcloud' | 'fortify' | 'checkmarx' | 'veracode' | 'custom';
  enabled: boolean;
  url?: string;
  apiKey?: string;
  organization?: string;
  projectKey: string;
  lastSync: Date;
  status: 'connected' | 'disconnected' | 'error';
}

export interface AnalysisReport {
  id: string;
  name: string;
  type: 'executive' | 'detailed' | 'security' | 'compliance' | 'trend';
  format: 'pdf' | 'html' | 'json' | 'markdown';
  generatedAt: Date;
  generatedBy: string;
  summary: ReportSummary;
  sections: ReportSection[];
  charts: ReportChart[];
}

export interface ReportSummary {
  totalIssues: number;
  vulnerabilities: number;
  bugs: number;
  codeSmells: number;
  securityHotspots: number;
  coverage: number;
  duplication: number;
  technicalDebt: number;
  securityRating: string;
  reliabilityRating: string;
  maintainabilityRating: string;
}

export interface ReportSection {
  title: string;
  content: string;
  order: number;
  includeInSummary: boolean;
}

export interface ReportChart {
  type: 'bar' | 'line' | 'pie' | 'heatmap';
  title: string;
  data: any;
  order: number;
}

// Main configuration function
export function codeSecurityAnalysis(config: CodeSecurityAnalysisConfig) {
  return {
    projectName: config.projectName,
    providers: config.providers,
    analysisSettings: config.analysisSettings,
    codebases: config.codebases,
    issues: config.issues,
    rules: config.rules,
    qualityGates: config.qualityGates,
    aiModels: config.aiModels,
    integrations: config.integrations,
    reports: config.reports,
  };
}

// Display configuration
export function displayConfig(config: ReturnType<typeof codeSecurityAnalysis>) {
  console.log(chalk.cyan('🔍 Code Security Analysis with SonarQube and AI Enhancement'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Analysis Enabled:'), config.analysisSettings.enabled ? 'Yes' : 'No');
  console.log(chalk.yellow('Frequency:'), config.analysisSettings.frequency);
  console.log(chalk.yellow('Languages:'), config.analysisSettings.languages.join(', '));
  console.log(chalk.yellow('Severity Threshold:'), config.analysisSettings.severityThreshold);
  console.log(chalk.yellow('AI Enhanced:'), config.analysisSettings.aiEnhancedAnalysis ? 'Yes' : 'No');
  console.log(chalk.yellow('Codebases:'), chalk.cyan(String(config.codebases.length)));
  console.log(chalk.yellow('Issues:'), chalk.cyan(String(config.issues.length)));
  console.log(chalk.yellow('Rules:'), chalk.cyan(String(config.rules.length)));
  console.log(chalk.yellow('Quality Gates:'), chalk.cyan(String(config.qualityGates.length)));
  console.log(chalk.yellow('AI Models:'), chalk.cyan(String(config.aiModels.length)));
  console.log(chalk.yellow('Integrations:'), chalk.cyan(String(config.integrations.length)));
  console.log(chalk.gray('─'.repeat(60)));
}

// Generate markdown documentation
export function generateMD(config: ReturnType<typeof codeSecurityAnalysis>): string {
  let md = '';

  md += '# Code Security Analysis with SonarQube and AI Enhancement\n\n';

  md += '## Features\n\n';
  md += '- Multi-language support: TypeScript, JavaScript, Python, Java, Go, C#, C++, Ruby, PHP, Rust, Swift\n';
  md += '- Issue types: vulnerability, bug, code-smell, security, hotspot, custom\n';
  md += '- Severity levels: blocker, critical, major, minor, info\n';
  md += '- Rule types: vulnerability, bug, code-smell, security-hotspot, custom\n';
  md += '- Custom rule creation with AI assistance\n';
  md += '- AI-enhanced issue detection and pattern matching\n';
  md += '- Automated remediation suggestions\n';
  md += '- Code metrics: files, functions, classes, complexity, coverage, duplication\n';
  md += '- Security ratings: A, B, C, D, E\n';
  md += '- Quality gates with custom conditions\n';
  md += '- Technical debt measurement in hours\n';
  md += '- Security hotspots review workflow\n';
  md += '- CWE and OWASP references\n';
  md += '- Test coverage analysis (line, branch, path, condition)\n';
  md += '- Code duplication detection\n';
  md += '- Complexity analysis (cyclomatic, cognitive, nesting)\n';
  md += '- SonarQube and SonarCloud integration\n';
  md += '- Multi-format reporting (PDF, HTML, JSON, Markdown)\n';
  md += '- Trend analysis and historical data\n';
  md += '- Parallel analysis for large codebases\n';
  md += '- AI model training and evaluation\n';
  md += '- Custom rule templates and parameters\n';
  md += '- Multi-cloud provider support (AWS, Azure, GCP)\n\n';

  md += '## Codebases\n\n';
  config.codebases.forEach((codebase) => {
    md += `### ${codebase.name}\n`;
    md += `- **Language**: ${codebase.language}\n`;
    md += `- **Branch**: ${codebase.branch}\n`;
    md += `- **Files**: ${codebase.totalFiles}\n`;
    md += `- **Lines of Code**: ${codebase.codeLines}\n`;
    md += `- **Coverage**: ${codebase.coverage}%\n`;
    md += `- **Complexity**: ${codebase.complexity}\n`;
    md += `- **Duplication**: ${codebase.duplication}%\n`;
    md += `- **Security Rating**: ${codebase.securityRating}\n`;
    md += `- **Technical Debt**: ${codebase.technicalDebt}h\n\n`;
  });

  md += '## Security Issues\n\n';
  const issueSummary = config.issues.reduce((acc, issue) => {
    acc[issue.severity]++;
    return acc;
  }, {} as Record<IssueSeverity, number>);

  md += '| Severity | Count |\n';
  md += '|----------|-------|\n';
  Object.entries(issueSummary).forEach(([severity, count]) => {
    md += `| ${severity.charAt(0).toUpperCase() + severity.slice(1)} | ${count} |\n`;
  });
  md += '\n';

  md += '## AI Models\n\n';
  config.aiModels.forEach((model) => {
    md += `### ${model.name}\n`;
    md += `- **Type**: ${model.type}\n`;
    md += `- **Language**: ${model.language}\n`;
    md += `- **Model**: ${model.model}\n`;
    md += `- **Accuracy**: ${(model.accuracy * 100).toFixed(1)}%\n`;
    md += `- **F1 Score**: ${(model.f1Score * 100).toFixed(1)}%\n`;
    md += `- **Status**: ${model.status}\n\n`;
  });

  md += '## Quality Gates\n\n';
  config.qualityGates.forEach((gate) => {
    md += `### ${gate.name}\n`;
    md += `- **Status**: ${gate.status}\n`;
    md += `- **Conditions**: ${gate.conditions.length}\n`;
    md += `- **Last Evaluation**: ${gate.lastEvaluation.toISOString()}\n\n`;
  });

  return md;
}

// Generate Terraform configuration
export function generateTerraform(config: ReturnType<typeof codeSecurityAnalysis>, provider: 'aws' | 'azure' | 'gcp'): string {
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

function generateAWS(config: ReturnType<typeof codeSecurityAnalysis>): string {
  let tf = '';

  tf += '# Code Security Analysis Infrastructure on AWS\n\n';
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

  tf += '# ECS Cluster for SonarQube\n';
  tf += 'resource "aws_ecs_cluster" "sonarqube" {\n';
  tf += '  name = "${var.project_name}-sonarqube"\n';
  tf += '}\n\n';

  tf += 'resource "aws_ecs_task_definition" "sonarqube_task" {\n';
  tf += '  family = "${var.project_name}-sonarqube"\n';
  tf += '  network_mode = "awsvpc"\n';
  tf += '  requires_compatibilities = ["FARGATE"]\n';
  tf += '  cpu = "4096"\n';
  tf += '  memory = "8192"\n\n';

  tf += '  container_definitions = jsonencode([\n';
  tf += '    {\n';
  tf += '      name = "sonarqube",\n';
  tf += '      image = "sonarqube:lts-community",\n';
  tf += '      essential = true,\n';
  tf += '      portMappings = [\n';
  tf += '        {\n';
  tf += '          containerPort = 9000\n';
  tf += '        }\n';
  tf += '      ],\n';
  tf += '      environment = [\n';
  tf += '        {\n';
  tf += '          name = "SONAR_JDBC_URL"\n';
  tf += '          value = "jdbc:postgresql://${aws_rds_cluster.sonarq_db.endpoint}:5432/sonar"\n';
  tf += '        }\n';
  tf += '      ],\n';
  tf += '      mountPoints = [\n';
  tf += '        {\n';
  tf += '          source = "sonarqube-data"\n';
  tf += '          containerPath = "/opt/sonarqube/data"\n';
  tf += '        }\n';
  tf += '      ]\n';
  tf += '    }\n';
  tf += '  ])\n';
  tf += '}\n\n';

  tf += '# RDS for SonarQube database\n';
  tf += 'resource "aws_rds_cluster" "sonarq_db" {\n';
  tf += '  engine = "aurora-postgresql"\n';
  tf += '  engine_version = "13.7"\n';
  tf += '  database_name = "sonar"\n';
  tf += '  master_username = "sonarqube"\n';
  tf += '  cluster_identifier = "${var.project_name}-sonarqube-db"\n';
  tf += '  availability_zones = ["${var.aws_region}a", "${var.aws_region}b"]\n';
  tf += '  skip_final_snapshot = true\n';
  tf += '}\n\n';

  tf += '# EFS for SonarQube data\n';
  tf += 'resource "aws_efs_file_system" "sonarqube_data" {\n';
  tf += '  creation_token = "sonarqube-data"\n';
  tf += '\n';
  tf += '  tags = {\n';
  tf += '    Name = "${var.project_name}-sonarqube"\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# S3 Bucket for analysis reports\n';
  tf += 'resource "aws_s3_bucket" "reports" {\n';
  tf += '  bucket = "${var.project_name}-security-reports"\n';
  tf += '}\n\n';

  tf += '# CodeBuild for analysis jobs\n';
  tf += 'resource "aws_codebuild_project" "security_analysis" {\n';
  tf += '  name = "${var.project_name}-security-analysis"\n';
  tf += '  description = "Run security analysis with SonarQube"\n\n';

  tf += '  source {\n';
  tf += '    type = "CODEPIPELINE"\n';
  tf += '    buildspec = file("buildspec.yml")\n';
  tf += '  }\n\n';

  tf += '  environment {\n';
  tf += '    compute_type = "BUILD_GENERAL1_LARGE"\n';
  tf += '    image = "aws/codebuild/standard:5.0"\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'variable "aws_region" {\n';
  tf += '  type = string\n';
  tf += '  default = "us-east-1"\n';
  tf += '}\n\n';

  tf += 'variable "project_name" {\n';
  tf += '  type = string\n';
  tf += '}\n';

  return tf;
}

function generateAzure(config: ReturnType<typeof codeSecurityAnalysis>): string {
  let tf = '';

  tf += '# Code Security Analysis Infrastructure on Azure\n\n';
  tf += 'terraform {\n';
  tf += '  required_providers {\n';
  tf += '    azurerm = {\n';
  tf += '      source = "hashicorp/azurerm"\n';
  tf += '      version = "~> 3.0"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'provider "azurerm" {\n';
  tf += '  features {}\n';
  tf += '}\n\n';

  tf += '# Container App for SonarQube\n';
  tf += 'resource "azurerm_container_app_environment" "sonar_env" {\n';
  tf += '  name = "${var.project_name}-sonar-env"\n';
  tf += '  location = var.azure_location\n';
  tf += '  resource_group_name = azurerm_resource_group.security_rg.name\n';
  tf += '}\n\n';

  tf += 'resource "azurerm_container_app" "sonarqube" {\n';
  tf += '  name = "${var.project_name}-sonarqube"\n';
  tf += '  location = var.azure_location\n';
  tf += '  resource_group_name = azurerm_resource_group.security_rg.name\n';
  tf += '  container_app_environment_id = azurerm_container_app_environment.sonar_env.id\n\n';

  tf += '  template {\n';
  tf += '    container {\n';
  tf += '      name = "sonarqube"\n';
  tf += '      image = "sonarqube:lts-community"\n';
  tf += '      cpu = 2.0\n';
  tf += '      memory = "4.0Gi"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n';

  return tf;
}

function generateGCP(config: ReturnType<typeof codeSecurityAnalysis>): string {
  let tf = '';

  tf += '# Code Security Analysis Infrastructure on GCP\n\n';
  tf += 'terraform {\n';
  tf += '  required_providers {\n';
  tf += '    google = {\n';
  tf += '      source = "hashicorp/google"\n';
  tf += '      version = "~> 5.0"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'provider "google" {\n';
  tf += '  project = var.gcp_project\n';
  tf += '  region = var.gcp_region\n';
  tf += '}\n\n';

  tf += '# Cloud Run for SonarQube\n';
  tf += 'resource "google_cloud_run_service" "sonarqube" {\n';
  tf += '  name = "${var.project_name}-sonarqube"\n';
  tf += '  location = var.gcp_region\n\n';

  tf += '  template {\n';
  tf += '    spec {\n';
  tf += '      containers {\n';
  tf += '        image = "sonarqube:lts-community"\n';
  tf += '      }\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n';

  return tf;
}

// Generate TypeScript manager class
export function generateTypeScript(config: ReturnType<typeof codeSecurityAnalysis>): string {
  let ts = '';

  ts += '// Auto-generated Code Security Analysis Manager\n';
  ts += `// Generated at: ${new Date().toISOString()}\n\n`;

  ts += `import { EventEmitter } from 'events';\n\n`;

  ts += `interface SecurityIssue {\n`;
  ts += `  id: string;\n`;
  ts += `  ruleId: string;\n`;
  ts += `  title: string;\n`;
  ts += `  severity: string;\n`;
  ts += `  type: string;\n`;
  ts += `  file: string;\n`;
  ts += `  line: number;\n`;
  ts += `  effort: string;\n`;
  ts += `  status: string;\n`;
  ts += `  aiDetected: boolean;\n`;
  ts += `  aiConfidence: number;\n`;
  ts += `}\n\n`;

  ts += `interface ScanResult {\n`;
  ts += `  scanId: string;\n`;
  ts += `  timestamp: Date;\n`;
  ts += `  codebaseId: string;\n`;
  ts += `  status: string;\n`;
  ts += `  duration: number;\n`;
  ts += `  issuesFound: number;\n`;
  ts += `  vulnerabilities: number;\n`;
  ts += `  bugs: number;\n`;
  ts += `  codeSmells: number;\n`;
  ts += `  securityRating: string;\n`;
  ts += `  issues: SecurityIssue[];\n`;
  ts += `}\n\n`;

  ts += `class CodeSecurityManager extends EventEmitter {\n`;
  ts += `  private issues: Map<string, SecurityIssue> = new Map();\n`;
  ts += `  private scanResults: ScanResult[] = [];\n`;
  ts += `  private config: any;\n\n`;

  ts += `  constructor(options: any = {}) {\n`;
  ts += `    super();\n`;
  ts += `    this.config = options;\n`;
  ts += `  }\n\n`;

  ts += `  async scanCodebase(codebaseId: string, language: string): Promise<ScanResult> {\n`;
  ts += `    const scanId = \`scan-\${Date.now()}\`;\n`;
  ts += `    const startTime = Date.now();\n\n`;

  ts += `    // Simulate AI-enhanced scanning\n`;
  ts += `    const issues: SecurityIssue[] = [\n`;
  ts += `      {\n`;
  ts += `        id: 'issue-001',\n`;
  ts += `        ruleId: 'typescript:S2755',\n`;
  ts += `        title: 'Debug statements should not be used in production code',\n`;
  ts += `        severity: 'major',\n`;
  ts += `        type: 'code-smell',\n`;
  ts += `        file: 'src/app.ts',\n`;
  ts += `        line: 42,\n`;
  ts += `        effort: '5min',\n`;
  ts += `        status: 'open',\n`;
  ts += `        aiDetected: false,\n`;
  ts += `        aiConfidence: 0.0,\n`;
  ts += `      },\n`;
  ts += `      {\n`;
  ts += `        id: 'issue-002',\n`;
  ts += `        ruleId: 'typescript:S2068',\n`;
  ts += `        title: 'Potential SQL injection vulnerability',\n`;
  ts += `        severity: 'critical',\n`;
  ts += `        type: 'vulnerability',\n`;
  ts += `        file: 'src/database.ts',\n`;
  ts += `        line: 15,\n`;
  ts += `        effort: '30min',\n`;
  ts += `        status: 'open',\n`;
  ts += `        aiDetected: true,\n`;
  ts += `        aiConfidence: 0.92,\n`;
  ts += `      },\n`;
  ts += `    ];\n\n`;

  ts += `    issues.forEach(i => this.issues.set(i.id, i));\n\n`;

  ts += `    const duration = (Date.now() - startTime) / 1000;\n\n`;

  ts += `    const result: ScanResult = {\n`;
  ts += `      scanId,\n`;
  ts += `      timestamp: new Date(),\n`;
  ts += `      codebaseId,\n`;
  ts += `      status: 'success',\n`;
  ts += `      duration,\n`;
  ts += `      issuesFound: issues.length,\n`;
  ts += `      vulnerabilities: issues.filter(i => i.type === 'vulnerability').length,\n`;
  ts += `      bugs: issues.filter(i => i.type === 'bug').length,\n`;
  ts += `      codeSmells: issues.filter(i => i.type === 'code-smell').length,\n`;
  ts += `      securityRating: issues.some(i => i.severity === 'critical') ? 'D' : 'B',\n`;
  ts += `      issues,\n`;
  ts += `    };\n\n`;

  ts += `    this.scanResults.push(result);\n`;
  ts += `    this.emit('scan-completed', result);\n\n`;

  ts += `    return result;\n`;
  ts += `  }\n\n`;

  ts += `  async generateCustomRule(description: string, language: string): Promise<any> {\n`;
  ts += `    // Simulate AI rule generation\n`;
  ts += `    return {\n`;
  ts += `      id: \`rule-\${Date.now()}\`,\n`;
  ts += `      key: 'ai-generated-rule',\n`;
  ts += `      name: 'AI Generated Rule',\n`;
  ts += `      type: 'custom',\n`;
  ts += `      severity: 'major',\n`;
  ts += `      language,\n`;
  ts += `      description,\n`;
  ts += `      isCustom: true,\n`;
  ts += `      isTemplate: false,\n`;
  ts += `      aiGenerated: true,\n`;
  ts += `      createdAt: new Date(),\n`;
  ts += `    };\n`;
  ts += `  }\n`;
  ts += `}\n\n`;

  ts += `export { CodeSecurityManager, SecurityIssue, ScanResult };\n`;

  return ts;
}

// Generate Python manager class
export function generatePython(config: ReturnType<typeof codeSecurityAnalysis>): string {
  let py = '';

  py += '# Auto-generated Code Security Analysis Manager\n';
  py += `# Generated at: ${new Date().toISOString()}\n\n`;

  py += 'from typing import Dict, List, Any, Optional\n';
  py += 'from dataclasses import dataclass, field\n';
  py += 'from datetime import datetime\n';
  py += 'from enum import Enum\n\n';

  py += 'class SeverityLevel(Enum):\n';
  py += '    BLOCKER = "blocker"\n';
  py += '    CRITICAL = "critical"\n';
  py += '    MAJOR = "major"\n';
  py += '    MINOR = "minor"\n';
  py += '    INFO = "info"\n\n';

  py += '@dataclass\n';
  py += 'class SecurityIssue:\n';
  py += '    id: str\n';
  py += '    rule_id: str\n';
  py += '    title: str\n';
  py += '    severity: str\n';
  py += '    type: str\n';
  py += '    file: str\n';
  py += '    line: int\n';
  py += '    effort: str\n';
  py += '    status: str\n';
  py += '    ai_detected: bool = False\n';
  py += '    ai_confidence: float = 0.0\n\n';

  py += 'class CodeSecurityManager:\n';
  py += '    def __init__(self, project_name: str = \'CodeSecurity\'):\n';
  py += '        self.project_name = project_name\n';
  py += '        self.issues: Dict[str, SecurityIssue] = {}\n';
  py += '        self.scan_results: List[Dict[str, Any]] = []\n\n';

  py += '    async def scan_codebase(self, codebase_id: str, language: str) -> Dict[str, Any]:\n';
  py += '        scan_id = f"scan-{int(datetime.now().timestamp())}"\n';
  py += '        start_time = datetime.now()\n\n';

  py += '        # Simulate scanning\n';
  py += '        issue = SecurityIssue(\n';
  py += '            id=\'issue-001\',\n';
  py += '            rule_id=\'typescript:S2755\',\n';
  py += '            title=\'Debug statements should not be used in production code\',\n';
  py += '            severity=\'major\',\n';
  py += '            type=\'code-smell\',\n';
  py += '            file=\'src/app.ts\',\n';
  py += '            line=42,\n';
  py += '            effort=\'5min\',\n';
  py += '            status=\'open\',\n';
  py += '        )\n\n';

  py += '        self.issues[issue.id] = issue\n\n';

  py += '        result = {\n';
  py += '            \'scanId\': scan_id,\n';
  py += '            \'timestamp\': datetime.now(),\n';
  py += '            \'codebaseId\': codebase_id,\n';
  py += '            \'status\': \'success\',\n';
  py += '            \'issuesFound\': 1,\n';
  py += '            \'issues\': [issue],\n';
  py += '        }\n\n';

  py += '        return result\n';

  return py;
}

// Write files to disk
export async function writeFiles(
  config: ReturnType<typeof codeSecurityAnalysis>,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Generate and write Terraform for each provider
  for (const provider of config.providers) {
    const tf = generateTerraform(config, provider);
    const tfPath = path.join(outputDir, `code-security-${provider}.tf`);
    await fs.writeFile(tfPath, tf);
  }

  // Generate and write manager class
  const managerCode = language === 'typescript' ? generateTypeScript(config) : generatePython(config);
  const managerFilename = language === 'typescript' ? 'code-security-manager.ts' : 'code_security_manager.py';
  const managerPath = path.join(outputDir, managerFilename);
  await fs.writeFile(managerPath, managerCode);

  // Generate and write markdown documentation
  const md = generateMD(config);
  const mdPath = path.join(outputDir, 'CODE_SECURITY_ANALYSIS.md');
  await fs.writeFile(mdPath, md);

  // Generate and write config JSON
  const configPath = path.join(outputDir, 'code-security-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  // Generate package.json or requirements.txt
  if (language === 'typescript') {
    const packageJson = {
      name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: 'Code security analysis with SonarQube and AI enhancement',
      main: 'code-security-manager.ts',
      scripts: {
        start: 'ts-node code-security-manager.ts',
        scan: 'ts-node code-security-manager.ts --scan',
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
