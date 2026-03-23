// Technical Documentation Generation and Maintenance with AI Assistance

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type DocType = 'api' | 'architecture' | 'user-guide' | 'developer-guide' | 'deployment' | 'troubleshooting' | 'reference';
export type DocFormat = 'markdown' | 'html' | 'pdf' | 'openapi' | 'json-schema';
export type DocStatus = 'draft' | 'review' | 'published' | 'deprecated' | 'archived';
export type AIProvider = 'openai' | 'anthropic' | 'custom';
export type ChangeType = 'created' | 'updated' | 'deleted' | 'restructured';
export type SeverityLevel = 'minor' | 'major' | 'critical';

export interface TechnicalDocConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  documentation: {
    docId: string;
    title: string;
    type: DocType;
    format: DocFormat;
    status: DocStatus;
    content: string;
    sections: DocSection[];
    metadata: DocMetadata;
    version: string;
    lastReviewed: Date;
    nextReviewDate: Date;
    aiSuggestions: AISuggestion[];
    changeHistory: DocChange[];
  }[];
  aiConfig: AIConfiguration;
  templates: DocTemplate[];
  workflows: DocumentationWorkflow[];
  qualityChecks: QualityCheck[];
  autoGeneration: AutoGenerationRule[];
  versioning: DocVersioningConfig;
}

export interface DocSection {
  id: string;
  title: string;
  content: string;
  order: number;
  subsections?: DocSection[];
  codeBlocks: CodeBlock[];
  diagrams: Diagram[];
  examples: Example[];
  references: Reference[];
  tags: string[];
  aiGenerated: boolean;
  lastUpdated: Date;
}

export interface CodeBlock {
  language: string;
  code: string;
  description?: string;
  executable?: boolean;
  syntaxHighlighted: boolean;
  lineNumbers: boolean;
}

export interface Diagram {
  type: 'sequence' | 'flowchart' | 'architecture' | 'er-diagram' | 'state-machine' | 'gantt';
  format: 'mermaid' | 'plantuml' | 'graphviz' | 'custom';
  content: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface Example {
  title: string;
  description: string;
  code?: string;
  input?: any;
  output?: any;
  language?: string;
  tags: string[];
}

export interface Reference {
  type: 'internal' | 'external' | 'api' | 'rfc' | 'standard';
  title: string;
  url?: string;
  docId?: string;
  section?: string;
  lineNumber?: number;
}

export interface DocMetadata {
  author: string;
  contributors: string[];
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  category: string;
  audience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  readingTime: number; // in minutes
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  prerequisites: string[];
  relatedDocs: string[];
  searchKeywords: string[];
  locale: string;
}

export interface AISuggestion {
  id: string;
  type: 'content' | 'structure' | 'formatting' | 'clarity' | 'completeness' | 'accuracy';
  suggestion: string;
  confidence: number; // 0-1
  reasoning: string;
  sectionId?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface DocChange {
  id: string;
  type: ChangeType;
  description: string;
  author: string;
  timestamp: Date;
  version: string;
  affectedSections: string[];
  severity: SeverityLevel;
  reviewRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface AIConfiguration {
  provider: AIProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enableContentGeneration: boolean;
  enableReview: boolean;
  enableSuggestions: boolean;
  enableAutoUpdate: boolean;
  customPrompt?: string;
  knowledgeBase?: string[];
}

export interface DocTemplate {
  id: string;
  name: string;
  type: DocType;
  format: DocFormat;
  structure: TemplateSection[];
  placeholders: TemplatePlaceholder[];
  styleGuidelines: StyleGuideline[];
  requiredSections: string[];
  optionalSections: string[];
}

export interface TemplateSection {
  id: string;
  title: string;
  description: string;
  required: boolean;
  order: number;
  contentTemplate?: string;
  subsections?: TemplateSection[];
}

export interface TemplatePlaceholder {
  key: string;
  description: string;
  type: 'text' | 'code' | 'list' | 'table' | 'image';
  required: boolean;
  defaultValue?: string;
}

export interface StyleGuideline {
  category: 'tone' | 'formatting' | 'structure' | 'terminology' | 'code';
  rule: string;
  example?: string;
  enforcement: 'suggestion' | 'required';
}

export interface DocumentationWorkflow {
  id: string;
  name: string;
  description: string;
  stages: WorkflowStage[];
  approvers: string[];
  autoTrigger: boolean;
  triggerConditions: TriggerCondition[];
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  type: 'creation' | 'review' | 'approval' | 'publishing' | 'archival';
  order: number;
  assignee?: string;
  role?: string;
  autoAssign: boolean;
  duration?: number; // in days
  checklists: ChecklistItem[];
}

export interface TriggerCondition {
  type: 'code-change' | 'api-change' | 'schedule' | 'manual' | 'version-release';
  description: string;
  config: any;
}

export interface ChecklistItem {
  id: string;
  task: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
}

export interface QualityCheck {
  id: string;
  name: string;
  description: string;
  type: 'spelling' | 'grammar' | 'links' | 'consistency' | 'completeness' | 'accuracy' | 'formatting';
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  config: any;
  autoFix: boolean;
}

export interface AutoGenerationRule {
  id: string;
  name: string;
  trigger: string;
  source: string;
  templateId: string;
  outputFormat: DocFormat;
  schedule?: string; // cron expression
  enabled: boolean;
  config: any;
}

export interface DocVersioningConfig {
  enabled: boolean;
  strategy: 'semantic' | 'date-based' | 'git-hash';
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  retentionPolicy: {
    keepMajor: number;
    keepMinor: number;
    keepAll: boolean;
  };
  branching: boolean;
  mergeStrategy: 'auto' | 'manual';
}

// Main configuration function
export function technicalDocumentation(config: TechnicalDocConfig) {
  return {
    name: config.projectName,
    providers: config.providers,
    documentation: config.documentation,
    aiConfig: config.aiConfig,
    templates: config.templates,
    workflows: config.workflows,
    qualityChecks: config.qualityChecks,
    autoGeneration: config.autoGeneration,
    versioning: config.versioning,
  };
}

// Display configuration
export function displayConfig(config: ReturnType<typeof technicalDocumentation>) {
  console.log(chalk.cyan('📚 Technical Documentation Generation and Maintenance'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow('Project Name:'), config.name);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Documents:'), chalk.cyan(String(config.documentation.length)));
  console.log(chalk.yellow('AI Provider:'), config.aiConfig.provider);
  console.log(chalk.yellow('Model:'), config.aiConfig.model);
  console.log(chalk.yellow('Templates:'), chalk.cyan(String(config.templates.length)));
  console.log(chalk.yellow('Workflows:'), chalk.cyan(String(config.workflows.length)));
  console.log(chalk.yellow('Quality Checks:'), chalk.cyan(String(config.qualityChecks.length)));
  console.log(chalk.yellow('Auto Generation Rules:'), chalk.cyan(String(config.autoGeneration.length)));
  console.log(chalk.yellow('Versioning:'), config.versioning.enabled ? 'Yes' : 'No');
  console.log(chalk.gray('─'.repeat(60)));
}

// Generate markdown documentation
export function generateMD(config: ReturnType<typeof technicalDocumentation>): string {
  let md = '';

  md += '# Technical Documentation Generation and Maintenance\n\n';

  md += '## Features\n\n';
  md += '- Document types: API, architecture, user guides, developer guides, deployment, troubleshooting, reference\n';
  md += '- Formats: Markdown, HTML, PDF, OpenAPI, JSON Schema\n';
  md += '- Document lifecycle: draft, review, published, deprecated, archived\n';
  md += '- AI-powered content generation and suggestions\n';
  md += '- Automated documentation from code and API specs\n';
  md += '- Quality checks (spelling, grammar, links, consistency, completeness)\n';
  md += '- Documentation workflows with approvals\n';
  md += '- Version control and change tracking\n';
  md += '- Multi-language support with locale management\n';
  md += '- Diagram generation (Mermaid, PlantUML, Graphviz)\n';
  md += '- Code examples with syntax highlighting\n';
  md += '- Search and indexing\n';
  md += '- Automated review and update scheduling\n\n';

  md += '## AI Capabilities\n\n';
  md += `- Provider: ${config.aiConfig.provider}\n`;
  md += `- Model: ${config.aiConfig.model}\n`;
  md += `- Content Generation: ${config.aiConfig.enableContentGeneration ? 'Enabled' : 'Disabled'}\n`;
  md += `- Auto Review: ${config.aiConfig.enableReview ? 'Enabled' : 'Disabled'}\n`;
  md += `- Suggestions: ${config.aiConfig.enableSuggestions ? 'Enabled' : 'Disabled'}\n\n`;

  md += '## Documentation Workflows\n\n';
  config.workflows.forEach((workflow) => {
    md += `### ${workflow.name}\n`;
    md += `${workflow.description}\n`;
    md += `- Stages: ${workflow.stages.length}\n`;
    md += `- Approvers: ${workflow.approvers.length}\n`;
    md += `- Auto Trigger: ${workflow.autoTrigger ? 'Yes' : 'No'}\n\n`;
  });

  md += '## Quality Checks\n\n';
  config.qualityChecks.forEach((check) => {
    md += `- **${check.name}**: ${check.type} (${check.severity})\n`;
  });
  md += '\n';

  md += '## Auto Generation Rules\n\n';
  config.autoGeneration.forEach((rule) => {
    md += `- **${rule.name}**: ${rule.trigger} → ${rule.outputFormat}\n`;
  });
  md += '\n';

  md += '## Versioning\n\n';
  if (config.versioning.enabled) {
    md += `- Strategy: ${config.versioning.strategy}\n`;
    md += `- Current Version: ${config.versioning.majorVersion}.${config.versioning.minorVersion}.${config.versioning.patchVersion}\n`;
    md += `- Branching: ${config.versioning.branching ? 'Enabled' : 'Disabled'}\n`;
  }
  md += '\n';

  md += '## Document Statistics\n\n';
  const statusCounts = config.documentation.reduce((acc, doc) => {
    acc[doc.status] = (acc[doc.status] || 0) + 1;
    return acc;
  }, {} as Record<DocStatus, number>);

  md += `- Total Documents: ${config.documentation.length}\n`;
  Object.entries(statusCounts).forEach(([status, count]) => {
    md += `- ${status}: ${count}\n`;
  });
  md += '\n';

  md += '## AI Suggestions\n\n';
  config.documentation.forEach((doc) => {
    if (doc.aiSuggestions.length > 0) {
      md += `### ${doc.title}\n`;
      md += `- Pending Suggestions: ${doc.aiSuggestions.filter(s => s.status === 'pending').length}\n`;
      md += `- Accepted: ${doc.aiSuggestions.filter(s => s.status === 'accepted').length}\n`;
      md += `- Rejected: ${doc.aiSuggestions.filter(s => s.status === 'rejected').length}\n`;
      md += '\n';
    }
  });

  return md;
}

// Generate Terraform configuration
export function generateTerraform(config: ReturnType<typeof technicalDocumentation>, provider: 'aws' | 'azure' | 'gcp'): string {
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

function generateAWS(config: ReturnType<typeof technicalDocumentation>): string {
  let tf = '';

  tf += '# Technical Documentation Infrastructure on AWS\n\n';
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

  tf += '# S3 Bucket for document storage\n';
  tf += 'resource "aws_s3_bucket" "docs_storage" {\n';
  tf += '  bucket = "${var.project_name}-docs-${var.environment}"\n';
  tf += '\n';
  tf += '  tags = {\n';
  tf += '    Name        = "${var.project_name}-docs"\n';
  tf += '    Environment = var.environment\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'resource "aws_s3_bucket_versioning" "docs_storage_versioning" {\n';
  tf += '  bucket = aws_s3_bucket.docs_storage.id\n';
  tf += '\n';
  tf += '  versioning_configuration {\n';
  tf += '    status = "Enabled"\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# DynamoDB Table for document metadata\n';
  tf += 'resource "aws_dynamodb_table" "docs_metadata" {\n';
  tf += '  name           = "${var.project_name}-docs-metadata"\n';
  tf += '  billing_mode   = "PAY_PER_REQUEST"\n';
  tf += '  hash_key       = "docId"\n\n';

  tf += '  attribute {\n';
  tf += '    name = "docId"\n';
  tf += '    type = "S"\n';
  tf += '  }\n\n';

  tf += '  attribute {\n';
  tf += '    name = "type"\n';
  tf += '    type = "S"\n';
  tf += '  }\n\n';

  tf += '  global_secondary_index {\n';
  tf += '    name            = "TypeIndex"\n';
  tf += '    hash_key        = "type"\n';
  tf += '    projection_type = "ALL"\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# ECS Cluster for AI documentation services\n';
  tf += 'resource "aws_ecs_cluster" "docs_ai" {\n';
  tf += '  name = "${var.project_name}-docs-ai"\n';
  tf += '}\n\n';

  tf += 'resource "aws_ecs_task_definition" "docs_ai_task" {\n';
  tf += '  family                   = "${var.project_name}-docs-ai"\n';
  tf += '  network_mode             = "awsvpc"\n';
  tf += '  requires_compatibilities = ["FARGATE"]\n';
  tf += '  cpu                      = "2048"\n';
  tf += '  memory                   = "4096"\n\n';

  tf += '  container_definitions = jsonencode([\n';
  tf += '    {\n';
  tf += '      name      = "docs-ai"\n';
  tf += '      image     = "${var.ai_service_image}"\n';
  tf += '      essential = true\n';
  tf += '      portMappings = [\n';
  tf += '        {\n';
  tf += '          containerPort = 8080\n';
  tf += '          protocol      = "tcp"\n';
  tf += '        }\n';
  tf += '      ]\n';
  tf += '      environment = [\n';
  tf += '        {\n';
  tf += '          name  = "AI_PROVIDER"\n';
  tf += `          value = "${config.aiConfig.provider}"\n`;
  tf += '        },\n';
  tf += '        {\n';
  tf += '          name  = "AI_MODEL"\n';
  tf += `          value = "${config.aiConfig.model}"\n`;
  tf += '        },\n';
  tf += '        {\n';
  tf += '          name  = "AI_API_KEY"\n';
  tf += '          value = var.ai_api_key\n';
  tf += '        }\n';
  tf += '      ]\n';
  tf += '      secrets = [\n';
  tf += '        {\n';
  tf += '          name      = "AI_API_KEY_SECRET"\n';
  tf += '          valueFrom = aws_secretsmanager_secret.ai_api_key.arn\n';
  tf += '        }\n';
  tf += '      ]\n';
  tf += '      logConfiguration = {\n';
  tf += '        logDriver = "awslogs"\n';
  tf += '        options = {\n';
  tf += '          "awslogs-group"         = aws_cloudwatch_log_group.docs_ai.name\n';
  tf += '          "awslogs-region"        = var.aws_region\n';
  tf += '          "awslogs-stream-prefix" = "ai"\n';
  tf += '        }\n';
  tf += '      }\n';
  tf += '    }\n';
  tf += '  ])\n';
  tf += '}\n\n';

  tf += 'resource "aws_cloudwatch_log_group" "docs_ai" {\n';
  tf += '  name              = "/aws/ecs/${var.project_name}-docs-ai"\n';
  tf += '  retention_in_days = 7\n';
  tf += '}\n\n';

  tf += '# API Gateway for documentation API\n';
  tf += 'resource "aws_apigatewayv2_api" "docs_api" {\n';
  tf += '  name          = "${var.project_name}-docs-api"\n';
  tf += '  protocol_type = "HTTP"\n';
  tf += '}\n\n';

  tf += 'resource "aws_apigatewayv2_stage" "docs_api_stage" {\n';
  tf += '  api_id      = aws_apigatewayv2_api.docs_api.id\n';
  tf += '  name        = var.environment\n';
  tf += '  auto_deploy = true\n';
  tf += '}\n\n';

  tf += '# Lambda function for document processing\n';
  tf += 'resource "aws_lambda_function" "docs_processor" {\n';
  tf += '  function_name = "${var.project_name}-docs-processor"\n';
  tf += '  role          = aws_iam_role.docs_processor_role.arn\n';
  tf += '  package_type  = "Image"\n';
  tf += '  image_uri     = "${var.processor_image}"\n\n';

  tf += '  environment {\n';
  tf += '    variables = {\n';
  tf += '      DOCS_TABLE = aws_dynamodb_table.docs_metadata.name\n';
  tf += '      DOCS_BUCKET = aws_s3_bucket.docs_storage.id\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'resource "aws_iam_role" "docs_processor_role" {\n';
  tf += '  name = "${var.project_name}-docs-processor-role"\n\n';

  tf += '  assume_role_policy = jsonencode({\n';
  tf += '    Version = "2012-10-17"\n';
  tf += '    Statement = [\n';
  tf += '      {\n';
  tf += '        Action = "sts:AssumeRole"\n';
  tf += '        Effect = "Allow"\n';
  tf += '        Principal = {\n';
  tf += '          Service = "lambda.amazonaws.com"\n';
  tf += '        }\n';
  tf += '      }\n';
  tf += '    ]\n';
  tf += '  })\n';
  tf += '}\n\n';

  tf += '# Secrets Manager for AI API keys\n';
  tf += 'resource "aws_secretsmanager_secret" "ai_api_key" {\n';
  tf += '  name = "${var.project_name}/ai-api-key"\n';
  tf += '}\n\n';

  tf += '# Variables\n';
  tf += 'variable "aws_region" {\n';
  tf += '  description = "AWS region"\n';
  tf += '  type        = string\n';
  tf += '  default     = "us-east-1"\n';
  tf += '}\n\n';

  tf += 'variable "project_name" {\n';
  tf += '  description = "Project name"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "environment" {\n';
  tf += '  description = "Environment"\n';
  tf += '  type        = string\n';
  tf += '  default     = "production"\n';
  tf += '}\n\n';

  tf += 'variable "ai_service_image" {\n';
  tf += '  description = "Docker image for AI service"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "processor_image" {\n';
  tf += '  description = "Docker image for document processor"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "ai_api_key" {\n';
  tf += '  description = "AI API key"\n';
  tf += '  type        = string\n';
  tf += '  sensitive   = true\n';
  tf += '}\n\n';

  tf += '# Outputs\n';
  tf += 'output "docs_api_endpoint" {\n';
  tf += '  description = "Documentation API endpoint"\n';
  tf += '  value       = aws_apigatewayv2_api.docs_api.api_endpoint\n';
  tf += '}\n\n';

  tf += 'output "docs_storage_bucket" {\n';
  tf += '  description = "Documentation storage bucket"\n';
  tf += '  value       = aws_s3_bucket.docs_storage.id\n';
  tf += '}\n';

  return tf;
}

function generateAzure(config: ReturnType<typeof technicalDocumentation>): string {
  let tf = '';

  tf += '# Technical Documentation Infrastructure on Azure\n\n';
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

  tf += '# Resource Group\n';
  tf += 'resource "azurerm_resource_group" "docs_rg" {\n';
  tf += '  name     = "${var.project_name}-docs-rg"\n';
  tf += '  location = var.azure_location\n';
  tf += '}\n\n';

  tf += '# Storage Account for documents\n';
  tf += 'resource "azurerm_storage_account" "docs_storage" {\n';
  tf += '  name                     = "${var.project_name}docs"\n';
  tf += '  resource_group_name      = azurerm_resource_group.docs_rg.name\n';
  tf += '  location                 = azurerm_resource_group.docs_rg.location\n';
  tf += '  account_tier             = "Standard"\n';
  tf += '  account_replication_type = "GRS"\n';
  tf += '}\n\n';

  tf += 'resource "azurerm_storage_container" "docs" {\n';
  tf += '  name                  = "documents"\n';
  tf += '  storage_account_name  = azurerm_storage_account.docs_storage.name\n';
  tf += '  container_access_type = "private"\n';
  tf += '}\n\n';

  tf += '# Cosmos DB for document metadata\n';
  tf += 'resource "azurerm_cosmosdb_account" "docs_metadata" {\n';
  tf += '  name                = "${var.project_name}-docs-metadata"\n';
  tf += '  location            = azurerm_resource_group.docs_rg.location\n';
  tf += '  resource_group_name = azurerm_resource_group.docs_rg.name\n';
  tf += '  offer_type          = "Standard"\n';
  tf += '  kind                = "GlobalDocumentDB"\n\n';

  tf += '  consistency_policy {\n';
  tf += '    consistency_level       = "Session"\n';
  tf += '    max_interval_in_seconds = 5\n';
  tf += '    max_staleness_prefix    = 100\n';
  tf += '  }\n\n';

  tf += '  geo_location {\n';
  tf += '          location          = azurerm_resource_group.docs_rg.location\n';
  tf += '          failover_priority = 0\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'resource "azurerm_cosmosdb_sql_database" "docs_db" {\n';
  tf += '  name                = "documentation"\n';
  tf += '  resource_group_name = azurerm_resource_group.docs_rg.name\n';
  tf += '  account_name        = azurerm_cosmosdb_account.docs_metadata.name\n';
  tf += '  throughput          = 400\n';
  tf += '}\n\n';

  tf += 'resource "azurerm_cosmosdb_sql_container" "docs" {\n';
  tf += '  name                = "documents"\n';
  tf += '  resource_group_name = azurerm_resource_group.docs_rg.name\n';
  tf += '  account_name        = azurerm_cosmosdb_account.docs_metadata.name\n';
  tf += '  database_name       = azurerm_cosmosdb_sql_database.docs_db.name\n';
  tf += '  partition_key_path  = "/docId"\n';
  tf += '  throughput          = 400\n';
  tf += '}\n\n';

  tf += '# Container App for AI services\n';
  tf += 'resource "azurerm_container_app" "docs_ai" {\n';
  tf += '  name                         = "${var.project_name}-docs-ai"\n';
  tf += '  resource_group_name          = azurerm_resource_group.docs_rg.name\n';
  tf += '  location                     = azurerm_resource_group.docs_rg.location\n';
  tf += '  managed_environment_id       = azurerm_container_app_environment.docs_env.id\n';
  tf += '  revision_mode                = "Single"\n\n';

  tf += '  template {\n';
  tf += '    container {\n';
  tf += '      name   = "docs-ai"\n';
  tf += '      image  = var.ai_service_image\n';
  tf += '      cpu    = 1.0\n';
  tf += '      memory = "2.0Gi"\n\n';

  tf += '      env {\n';
  tf += '        name  = "AI_PROVIDER"\n';
  tf += `        value = "${config.aiConfig.provider}"\n`;
  tf += '      }\n\n';

  tf += '      env {\n';
  tf += '        name  = "AI_MODEL"\n';
  tf += `        value = "${config.aiConfig.model}"\n`;
  tf += '      }\n\n';

  tf += '      secret {\n';
  tf += '        name  = "AI_API_KEY"\n';
  tf += '        value = var.ai_api_key\n';
  tf += '      }\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'resource "azurerm_container_app_environment" "docs_env" {\n';
  tf += '  name                = "${var.project_name}-docs-env"\n';
  tf += '  resource_group_name = azurerm_resource_group.docs_rg.name\n';
  tf += '  location            = azurerm_resource_group.docs_rg.location\n';
  tf += '}\n\n';

  tf += '# Key Vault for secrets\n';
  tf += 'resource "azurerm_key_vault" "docs_kv" {\n';
  tf += '  name                = "${var.project_name}-docs-kv"\n';
  tf += '  location            = azurerm_resource_group.docs_rg.location\n';
  tf += '  resource_group_name = azurerm_resource_group.docs_rg.name\n';
  tf += '  tenant_id           = data.azurerm_client_config.current.tenant_id\n';
  tf += '  sku_name            = "standard"\n\n';

  tf += '  access_policy {\n';
  tf += '    tenant_id = data.azurerm_client_config.current.tenant_id\n';
  tf += '    object_id = data.azurerm_client_config.current.object_id\n\n';

  tf += '    secret_permissions = [\n';
  tf += '      "Get",\n';
  tf += '      "Set",\n';
  tf += '      "Delete",\n';
  tf += '      "List"\n';
  tf += '    ]\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'resource "azurerm_key_vault_secret" "ai_api_key" {\n';
  tf += '  name         = "ai-api-key"\n';
  tf += '  value        = var.ai_api_key\n';
  tf += '  key_vault_id = azurerm_key_vault.docs_kv.id\n';
  tf += '}\n\n';

  tf += 'data "azurerm_client_config" "current" {}\n\n';

  tf += '# Variables\n';
  tf += 'variable "azure_location" {\n';
  tf += '  description = "Azure location"\n';
  tf += '  type        = string\n';
  tf += '  default     = "eastus"\n';
  tf += '}\n\n';

  tf += 'variable "project_name" {\n';
  tf += '  description = "Project name"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "ai_service_image" {\n';
  tf += '  description = "Docker image for AI service"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "ai_api_key" {\n';
  tf += '  description = "AI API key"\n';
  tf += '  type        = string\n';
  tf += '  sensitive   = true\n';
  tf += '}\n';

  return tf;
}

function generateGCP(config: ReturnType<typeof technicalDocumentation>): string {
  let tf = '';

  tf += '# Technical Documentation Infrastructure on GCP\n\n';
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

  tf += '# GCS Bucket for documents\n';
  tf += 'resource "google_storage_bucket" "docs_storage" {\n';
  tf += '  name          = "${var.project_name}-docs"\n';
  tf += '  location      = var.gcp_region\n';
  tf += '  force_destroy = false\n';
  tf += '  uniform_bucket_level_access = true\n';
  tf += '  versioning {\n';
  tf += '    enabled = true\n';
  tf += '  }\n\n';

  tf += '  lifecycle_rule {\n';
  tf += '    condition {\n';
  tf += '      matches_prefix = ["archived/"]\n';
  tf += '    }\n';
  tf += '    action {\n';
  tf += '      type = "SetStorageClass"\n';
  tf += '      storage_class = "ARCHIVE"\n';
  tf += '    }\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# Firestore for document metadata\n';
  tf += 'resource "google_firestore_database" "docs_metadata" {\n';
  tf += '  name        = "documentation"\n';
  tf += '  location_id = var.gcp_region\n';
  tf += '  type        = "FIRESTORE_NATIVE"\n';
  tf += '}\n\n';

  tf += '# Cloud Run for AI services\n';
  tf += 'resource "google_cloud_run_service" "docs_ai" {\n';
  tf += '  name     = "${var.project_name}-docs-ai"\n';
  tf += '  location = var.gcp_region\n\n';

  tf += '  template {\n';
  tf += '    spec {\n';
  tf += '      containers {\n';
  tf += '        image = var.ai_service_image\n\n';

  tf += '        env {\n';
  tf += '          name  = "AI_PROVIDER"\n';
  tf += `          value = "${config.aiConfig.provider}"\n`;
  tf += '        }\n\n';

  tf += '        env {\n';
  tf += '          name  = "AI_MODEL"\n';
  tf += `          value = "${config.aiConfig.model}"\n`;
  tf += '        }\n\n';

  tf += '        env {\n';
  tf += '          name  = "AI_API_KEY"\n';
  tf += '          value_from {\n';
  tf += '            secret_key_ref {\n';
  tf += '              name = google_secret_manager_secret.ai_api_key.secret_id\n';
  tf += '              key  = "latest"\n';
  tf += '            }\n';
  tf += '          }\n';
  tf += '        }\n';
  tf += '      }\n';
  tf += '      container_concurrency = 10\n';
  tf += '      timeout_seconds       = 300\n';
  tf += '    }\n';
  tf += '  }\n\n';

  tf += '  traffic {\n';
  tf += '    percent         = 100\n';
  tf += '    latest_revision = true\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += '# Cloud Functions for document processing\n';
  tf += 'resource "google_cloudfunctions_function" "docs_processor" {\n';
  tf += '  name        = "${var.project_name}-docs-processor"\n';
  tf += '  description = "Process documentation updates"\n';
  tf += '  runtime     = "nodejs20"\n\n';

  tf += '  available_memory_mb   = 256\n';
  tf += '  source_archive_bucket = google_storage_bucket.docs_storage.name\n';
  tf += '  source_archive_object = google_storage_bucket_object.processor_source.name\n';
  tf += '  trigger_http          = true\n';
  tf += '  entry_point           = "processDocument"\n\n';

  tf += '  environment_variables = {\n';
  tf += '    DOCS_PROJECT = var.gcp_project\n';
  tf += '    DOCS_BUCKET  = google_storage_bucket.docs_storage.name\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'resource "google_storage_bucket_object" "processor_source" {\n';
  tf += '  name   = "processor-source.zip"\n';
  tf += '  bucket = google_storage_bucket.docs_storage.name\n';
  tf += '  source = var.processor_source_path\n';
  tf += '}\n\n';

  tf += '# Secret Manager for AI API keys\n';
  tf += 'resource "google_secret_manager_secret" "ai_api_key" {\n';
  tf += '  secret_id = "ai-api-key"\n';
  tf += '  replication {\n';
  tf += '    automatic = true\n';
  tf += '  }\n';
  tf += '}\n\n';

  tf += 'resource "google_secret_manager_secret_version" "ai_api_key_version" {\n';
  tf += '  secret      = google_secret_manager_secret.ai_api_key.id\n';
  tf += '  secret_data = var.ai_api_key\n';
  tf += '}\n\n';

  tf += '# Variables\n';
  tf += 'variable "gcp_project" {\n';
  tf += '  description = "GCP project ID"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "gcp_region" {\n';
  tf += '  description = "GCP region"\n';
  tf += '  type        = string\n';
  tf += '  default     = "us-central1"\n';
  tf += '}\n\n';

  tf += 'variable "project_name" {\n';
  tf += '  description = "Project name"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "ai_service_image" {\n';
  tf += '  description = "Docker image for AI service"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "processor_source_path" {\n';
  tf += '  description = "Path to processor source zip"\n';
  tf += '  type        = string\n';
  tf += '}\n\n';

  tf += 'variable "ai_api_key" {\n';
  tf += '  description = "AI API key"\n';
  tf += '  type        = string\n';
  tf += '  sensitive   = true\n';
  tf += '}\n';

  return tf;
}

// Generate TypeScript manager class
export function generateTypeScript(config: ReturnType<typeof technicalDocumentation>): string {
  let ts = '';

  ts += '// Auto-generated Technical Documentation Manager\n';
  ts += `// Generated at: ${new Date().toISOString()}\n\n`;

  ts += `import { EventEmitter } from 'events';\n\n`;

  ts += `interface DocumentSection {\n`;
  ts += `  id: string;\n`;
  ts += `  title: string;\n`;
  ts += `  content: string;\n`;
  ts += `  order: number;\n`;
  ts += `  subsections?: DocumentSection[];\n`;
  ts += `  codeBlocks: CodeBlock[];\n`;
  ts += `  diagrams: Diagram[];\n`;
  ts += `  examples: Example[];\n`;
  ts += `  references: Reference[];\n`;
  ts += `  tags: string[];\n`;
  ts += `  aiGenerated: boolean;\n`;
  ts += `  lastUpdated: Date;\n`;
  ts += `}\n\n`;

  ts += `interface TechnicalDoc {\n`;
  ts += `  docId: string;\n`;
  ts += `  title: string;\n`;
  ts += `  type: string;\n`;
  ts += `  format: string;\n`;
  ts += `  status: string;\n`;
  ts += `  content: string;\n`;
  ts += `  sections: DocumentSection[];\n`;
  ts += `  metadata: any;\n`;
  ts += `  version: string;\n`;
  ts += `  lastReviewed: Date;\n`;
  ts += `  nextReviewDate: Date;\n`;
  ts += `  aiSuggestions: AISuggestion[];\n`;
  ts += `  changeHistory: DocChange[];\n`;
  ts += `}\n\n`;

  ts += `interface AISuggestion {\n`;
  ts += `  id: string;\n`;
  ts += `  type: string;\n`;
  ts += `  suggestion: string;\n`;
  ts += `  confidence: number;\n`;
  ts += `  reasoning: string;\n`;
  ts += `  sectionId?: string;\n`;
  ts += `  priority: string;\n`;
  ts += `  status: string;\n`;
  ts += `  createdAt: Date;\n`;
  ts += `  reviewedBy?: string;\n`;
  ts += `  reviewedAt?: Date;\n`;
  ts += `}\n\n`;

  ts += `interface DocChange {\n`;
  ts += `  id: string;\n`;
  ts += `  type: string;\n`;
  ts += `  description: string;\n`;
  ts += `  author: string;\n`;
  ts += `  timestamp: Date;\n`;
  ts += `  version: string;\n`;
  ts += `  affectedSections: string[];\n`;
  ts += `  severity: string;\n`;
  ts += `  reviewRequired: boolean;\n`;
  ts += `  approvedBy?: string;\n`;
  ts += `  approvedAt?: Date;\n`;
  ts += `}\n\n`;

  ts += `interface CodeBlock {\n`;
  ts += `  language: string;\n`;
  ts += `  code: string;\n`;
  ts += `  description?: string;\n`;
  ts += `  executable?: boolean;\n`;
  ts += `  syntaxHighlighted: boolean;\n`;
  ts += `  lineNumbers: boolean;\n`;
  ts += `}\n\n`;

  ts += `interface Diagram {\n`;
  ts += `  type: string;\n`;
  ts += `  format: string;\n`;
  ts += `  content: string;\n`;
  ts += `  caption?: string;\n`;
  ts += `  width?: number;\n`;
  ts += `  height?: number;\n`;
  ts += `}\n\n`;

  ts += `interface Example {\n`;
  ts += `  title: string;\n`;
  ts += `  description: string;\n`;
  ts += `  code?: string;\n`;
  ts += `  input?: any;\n`;
  ts += `  output?: any;\n`;
  ts += `  language?: string;\n`;
  ts += `  tags: string[];\n`;
  ts += `}\n\n`;

  ts += `interface Reference {\n`;
  ts += `  type: string;\n`;
  ts += `  title: string;\n`;
  ts += `  url?: string;\n`;
  ts += `  docId?: string;\n`;
  ts += `  section?: string;\n`;
  ts += `  lineNumber?: number;\n`;
  ts += `}\n\n`;

  ts += `class TechnicalDocumentationManager extends EventEmitter {\n`;
  ts += `  private documents: Map<string, TechnicalDoc> = new Map();\n`;
  ts += `  private aiConfig: any;\n`;
  ts += `  private versioning: any;\n\n`;

  ts += `  constructor(options: any = {}) {\n`;
  ts += `    super();\n`;
  ts += `    this.aiConfig = options.aiConfig || {};\n`;
  ts += `    this.versioning = options.versioning || { enabled: false };\n`;
  ts += `  }\n\n`;

  ts += `  async createDocument(doc: Omit<TechnicalDoc, 'docId' | 'aiSuggestions' | 'changeHistory' | 'createdAt'>): Promise<TechnicalDoc> {\n`;
  ts += `    const newDoc: TechnicalDoc = {\n`;
  ts += `      ...doc,\n`;
  ts += `      docId: \`doc-\${Date.now()}\`,\n`;
  ts += `      aiSuggestions: [],\n`;
  ts += `      changeHistory: [],\n`;
  ts += `      lastReviewed: new Date(),\n`;
  ts += `      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days\n`;
  ts += `    };\n\n`;

  ts += `    this.documents.set(newDoc.docId, newDoc);\n`;
  ts += `    this.emit('document-created', { docId: newDoc.docId, title: newDoc.title });\n\n`;

  ts += `    if (this.aiConfig.enableReview) {\n`;
  ts += `      await this.generateAISuggestions(newDoc.docId);\n`;
  ts += `    }\n\n`;

  ts += `    return newDoc;\n`;
  ts += `  }\n\n`;

  ts += `  async updateDocument(docId: string, updates: Partial<TechnicalDoc>, author: string): Promise<TechnicalDoc | null> {\n`;
  ts += `    const doc = this.documents.get(docId);\n`;
  ts += `    if (!doc) {\n`;
  ts += `      throw new Error(\`Document not found: \${docId}\`);\n`;
  ts += `    }\n\n`;

  ts += `    const previousVersion = JSON.stringify({ ...doc });\n`;
  ts += `    Object.assign(doc, updates);\n`;
  ts += `    doc.metadata.updatedAt = new Date();\n\n`;

  ts += `    // Record change\n`;
  ts += `    const change: DocChange = {\n`;
  ts += `      id: \`change-\${Date.now()}\`,\n`;
  ts += `      type: 'updated',\n`;
  ts += `      description: \`Document updated by \${author}\`,\n`;
  ts += `      author,\n`;
  ts += `      timestamp: new Date(),\n`;
  ts += `      version: doc.version,\n`;
  ts += `      affectedSections: Object.keys(updates).filter(k => k !== 'changeHistory'),\n`;
  ts += `      severity: 'major',\n`;
  ts += `      reviewRequired: true,\n`;
  ts += `    };\n`;
  ts += `    doc.changeHistory.push(change);\n\n`;

  ts += `    this.emit('document-updated', { docId, change });\n\n`;

  ts += `    if (this.aiConfig.enableReview) {\n`;
  ts += `      await this.generateAISuggestions(docId);\n`;
  ts += `    }\n\n`;

  ts += `    return doc;\n`;
  ts += `  }\n\n`;

  ts += `  async generateAISuggestions(docId: string): Promise<AISuggestion[]> {\n`;
  ts += `    const doc = this.documents.get(docId);\n`;
  ts += `    if (!doc) {\n`;
  ts += `      throw new Error(\`Document not found: \${docId}\`);\n`;
  ts += `    }\n\n`;

  ts += `    // Simulate AI analysis\n`;
  ts += `    const suggestions: AISuggestion[] = [];\n\n`;

  ts += `    // Check for missing sections\n`;
  ts += `    const requiredSections = ['Overview', 'Examples', 'API Reference'];\n`;
  ts += `    const missingSections = requiredSections.filter(\n`;
  ts += `      req => !doc.sections.some(s => s.title === req)\n`;
  ts += `    );\n\n`;

  ts += `    if (missingSections.length > 0) {\n`;
  ts += `      suggestions.push({\n`;
  ts += `        id: \`suggestion-\${Date.now()}-1\`,\n`;
  ts += `        type: 'completeness',\n`;
  ts += `        suggestion: \`Consider adding these sections: \${missingSections.join(', ')}\`,\n`;
  ts += `        confidence: 0.85,\n`;
  ts += `        reasoning: 'These sections are commonly expected in technical documentation',\n`;
  ts += `        priority: 'medium',\n`;
  ts += `        status: 'pending',\n`;
  ts += `        createdAt: new Date(),\n`;
  ts += `      });\n`;
  ts += `    }\n\n`;

  ts += `    // Check for code examples\n`;
  ts += `    const hasCodeExamples = doc.sections.some(s => s.codeBlocks.length > 0);\n`;
  ts += `    if (!hasCodeExamples) {\n`;
  ts += `      suggestions.push({\n`;
  ts += `        id: \`suggestion-\${Date.now()}-2\`,\n`;
  ts += `        type: 'content',\n`;
  ts += `        suggestion: 'Add code examples to illustrate usage',\n`;
  ts += `        confidence: 0.9,\n`;
  ts += `        reasoning: 'Code examples improve comprehension and practical application',\n`;
  ts += `        priority: 'high',\n`;
  ts += `        status: 'pending',\n`;
  ts += `        createdAt: new Date(),\n`;
  ts += `      });\n`;
  ts += `    }\n\n`;

  ts += `    doc.aiSuggestions.push(...suggestions);\n`;
  ts += `    this.emit('ai-suggestions-generated', { docId, count: suggestions.length });\n\n`;

  ts += `    return suggestions;\n`;
  ts += `  }\n\n`;

  ts += `  async acceptSuggestion(docId: string, suggestionId: string, reviewer: string): Promise<void> {\n`;
  ts += `    const doc = this.documents.get(docId);\n`;
  ts += `    if (!doc) {\n`;
  ts += `      throw new Error(\`Document not found: \${docId}\`);\n`;
  ts += `    }\n\n`;

  ts += `    const suggestion = doc.aiSuggestions.find(s => s.id === suggestionId);\n`;
  ts += `    if (!suggestion) {\n`;
  ts += `      throw new Error(\`Suggestion not found: \${suggestionId}\`);\n`;
  ts += `    }\n\n`;

  ts += `    suggestion.status = 'accepted';\n`;
  ts += `    suggestion.reviewedBy = reviewer;\n`;
  ts += `    suggestion.reviewedAt = new Date();\n\n`;

  ts += `    this.emit('suggestion-accepted', { docId, suggestionId, reviewer });\n`;
  ts += `  }\n\n`;

  ts += `  async rejectSuggestion(docId: string, suggestionId: string, reviewer: string): Promise<void> {\n`;
  ts += `    const doc = this.documents.get(docId);\n`;
  ts += `    if (!doc) {\n`;
  ts += `      throw new Error(\`Document not found: \${docId}\`);\n`;
  ts += `    }\n\n`;

  ts += `    const suggestion = doc.aiSuggestions.find(s => s.id === suggestionId);\n`;
  ts += `    if (!suggestion) {\n`;
  ts += `      throw new Error(\`Suggestion not found: \${suggestionId}\`);\n`;
  ts += `    }\n\n`;

  ts += `    suggestion.status = 'rejected';\n`;
  ts += `    suggestion.reviewedBy = reviewer;\n`;
  ts += `    suggestion.reviewedAt = new Date();\n\n`;

  ts += `    this.emit('suggestion-rejected', { docId, suggestionId, reviewer });\n`;
  ts += `  }\n\n`;

  ts += `  async autoGenerateFromCode(sourcePath: string, templateId: string): Promise<TechnicalDoc> {\n`;
  ts += `    // Simulate parsing code and generating documentation\n`;
  ts += `    const generatedDoc: Omit<TechnicalDoc, 'docId' | 'aiSuggestions' | 'changeHistory'> = {\n`;
  ts += `      title: \`API Documentation for \${sourcePath}\`,\n`;
  ts += `      type: 'api',\n`;
  ts += `      format: 'markdown',\n`;
  ts += `      status: 'draft',\n`;
  ts += `      content: \`# API Documentation\\n\\nAuto-generated from \${sourcePath}\\n\`,\n`;
  ts += `      sections: [\n`;
  ts += `        {\n`;
  ts += `          id: 'section-1',\n`;
  ts += `          title: 'Overview',\n`;
  ts += `          content: 'API overview and introduction',\n`;
  ts += `          order: 1,\n`;
  ts += `          codeBlocks: [],\n`;
  ts += `          diagrams: [],\n`;
  ts += `          examples: [],\n`;
  ts += `          references: [],\n`;
  ts += `          tags: ['api', 'auto-generated'],\n`;
  ts += `          aiGenerated: true,\n`;
  ts += `          lastUpdated: new Date(),\n`;
  ts += `        },\n`;
  ts += `      ],\n`;
  ts += `      metadata: {\n`;
  ts += `        author: 'AI Generator',\n`;
  ts += `        contributors: [],\n`;
  ts += `        createdAt: new Date(),\n`;
  ts += `        updatedAt: new Date(),\n`;
  ts += `        tags: ['api', 'auto-generated'],\n`;
  ts += `        category: 'API',\n`;
  ts += `        audience: 'developer',\n`;
  ts += `        readingTime: 5,\n`;
  ts += `        difficulty: 'medium',\n`;
  ts += `        prerequisites: [],\n`;
  ts += `        relatedDocs: [],\n`;
  ts += `        searchKeywords: ['api', 'rest', 'endpoints'],\n`;
  ts += `        locale: 'en',\n`;
  ts += `      },\n`;
  ts += `      version: this.versioning.enabled ? '1.0.0' : 'latest',\n`;
  ts += `      lastReviewed: new Date(),\n`;
  ts += `      nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),\n`;
  ts += `      aiSuggestions: [],\n`;
  ts += `      changeHistory: [],\n`;
  ts += `    };\n\n`;

  ts += `    return this.createDocument(generatedDoc);\n`;
  ts += `  }\n\n`;

  ts += `  async runQualityChecks(docId: string): Promise<any[]> {\n`;
  ts += `    const doc = this.documents.get(docId);\n`;
  ts += `    if (!doc) {\n`;
  ts += `      throw new Error(\`Document not found: \${docId}\`);\n`;
  ts += `    }\n\n`;

  ts += `    const issues: any[] = [];\n\n`;

  ts += `    // Check for broken links (simplified)\n`;
  ts += `    const linkRegex = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g;\n`;
  ts += `    let match;\n`;
  ts += `    while ((match = linkRegex.exec(doc.content)) !== null) {\n`;
  ts += `      const url = match[2];\n`;
  ts += `      if (!url.startsWith('http') && !url.startsWith('#')) {\n`;
  ts += `        issues.push({\n`;
  ts += `          type: 'links',\n`;
  ts += `          severity: 'warning',\n`;
  ts += `          message: \`Potential broken link: \${url}\`,\n`;
  ts += `          autoFix: false,\n`;
  ts += `        });\n`;
  ts += `      }\n`;
  ts += `    }\n\n`;

  ts += `    return issues;\n`;
  ts += `  }\n\n`;

  ts += `  getDocumentsByStatus(status: string): TechnicalDoc[] {\n`;
  ts += `    return Array.from(this.documents.values()).filter(doc => doc.status === status);\n`;
  ts += `  }\n\n`;

  ts += `  getDocumentsByType(type: string): TechnicalDoc[] {\n`;
  ts += `    return Array.from(this.documents.values()).filter(doc => doc.type === type);\n`;
  ts += `  }\n\n`;

  ts += `  getDocumentsNeedingReview(): TechnicalDoc[] {\n`;
  ts += `    const now = new Date();\n`;
  ts += `    return Array.from(this.documents.values()).filter(doc => doc.nextReviewDate <= now);\n`;
  ts += `  }\n\n`;

  ts += `  getChangeHistory(docId: string): DocChange[] {\n`;
  ts += `    const doc = this.documents.get(docId);\n`;
  ts += `    return doc?.changeHistory || [];\n`;
  ts += `  }\n`;
  ts += `}\n\n`;

  ts += `export { TechnicalDocumentationManager, TechnicalDoc, AISuggestion, DocChange };\n`;

  return ts;
}

// Generate Python manager class
export function generatePython(config: ReturnType<typeof technicalDocumentation>): string {
  let py = '';

  py += '# Auto-generated Technical Documentation Manager\n';
  py += `# Generated at: ${new Date().toISOString()}\n\n`;

  py += 'from typing import Dict, List, Any, Optional\n';
  py += 'from dataclasses import dataclass, field\n';
  py += 'from datetime import datetime, timedelta\n';
  py += 'from enum import Enum\n';
  py += 'import re\n\n';

  py += 'class DocType(Enum):\n';
  py += '    API = "api"\n';
  py += '    ARCHITECTURE = "architecture"\n';
  py += '    USER_GUIDE = "user-guide"\n';
  py += '    DEVELOPER_GUIDE = "developer-guide"\n';
  py += '    DEPLOYMENT = "deployment"\n';
  py += '    TROUBLESHOOTING = "troubleshooting"\n';
  py += '    REFERENCE = "reference"\n\n';

  py += 'class DocFormat(Enum):\n';
  py += '    MARKDOWN = "markdown"\n';
  py += '    HTML = "html"\n';
  py += '    PDF = "pdf"\n';
  py += '    OPENAPI = "openapi"\n';
  py += '    JSON_SCHEMA = "json-schema"\n\n';

  py += 'class DocStatus(Enum):\n';
  py += '    DRAFT = "draft"\n';
  py += '    REVIEW = "review"\n';
  py += '    PUBLISHED = "published"\n';
  py += '    DEPRECATED = "deprecated"\n';
  py += '    ARCHIVED = "archived"\n\n';

  py += '@dataclass\n';
  py += 'class CodeBlock:\n';
  py += '    language: str\n';
  py += '    code: str\n';
  py += '    description: Optional[str] = None\n';
  py += '    executable: bool = False\n';
  py += '    syntax_highlighted: bool = True\n';
  py += '    line_numbers: bool = True\n\n';

  py += '@dataclass\n';
  py += 'class Diagram:\n';
  py += '    type: str\n';
  py += '    format: str\n';
  py += '    content: str\n';
  py += '    caption: Optional[str] = None\n';
  py += '    width: Optional[int] = None\n';
  py += '    height: Optional[int] = None\n\n';

  py += '@dataclass\n';
  py += 'class Example:\n';
  py += '    title: str\n';
  py += '    description: str\n';
  py += '    code: Optional[str] = None\n';
  py += '    input: Optional[Any] = None\n';
  py += '    output: Optional[Any] = None\n';
  py += '    language: Optional[str] = None\n';
  py += '    tags: List[str] = field(default_factory=list)\n\n';

  py += '@dataclass\n';
  py += 'class Reference:\n';
  py += '    type: str\n';
  py += '    title: str\n';
  py += '    url: Optional[str] = None\n';
  py += '    doc_id: Optional[str] = None\n';
  py += '    section: Optional[str] = None\n';
  py += '    line_number: Optional[int] = None\n\n';

  py += '@dataclass\n';
  py += 'class DocSection:\n';
  py += '    id: str\n';
  py += '    title: str\n';
  py += '    content: str\n';
  py += '    order: int\n';
  py += '    subsections: Optional[List["DocSection"]] = None\n';
  py += '    code_blocks: List[CodeBlock] = field(default_factory=list)\n';
  py += '    diagrams: List[Diagram] = field(default_factory=list)\n';
  py += '    examples: List[Example] = field(default_factory=list)\n';
  py += '    references: List[Reference] = field(default_factory=list)\n';
  py += '    tags: List[str] = field(default_factory=list)\n';
  py += '    ai_generated: bool = False\n';
  py += '    last_updated: datetime = field(default_factory=datetime.now)\n\n';

  py += '@dataclass\n';
  py += 'class AISuggestion:\n';
  py += '    id: str\n';
  py += '    type: str\n';
  py += '    suggestion: str\n';
  py += '    confidence: float\n';
  py += '    reasoning: str\n';
  py += '    section_id: Optional[str] = None\n';
  py += '    priority: str\n';
  py += '    status: str\n';
  py += '    created_at: datetime = field(default_factory=datetime.now)\n';
  py += '    reviewed_by: Optional[str] = None\n';
  py += '    reviewed_at: Optional[datetime] = None\n\n';

  py += '@dataclass\n';
  py += 'class DocChange:\n';
  py += '    id: str\n';
  py += '    type: str\n';
  py += '    description: str\n';
  py += '    author: str\n';
  py += '    timestamp: datetime\n';
  py += '    version: str\n';
  py += '    affected_sections: List[str]\n';
  py += '    severity: str\n';
  py += '    review_required: bool\n';
  py += '    approved_by: Optional[str] = None\n';
  py += '    approved_at: Optional[datetime] = None\n\n';

  py += '@dataclass\n';
  py += 'class DocMetadata:\n';
  py += '    author: str\n';
  py += '    contributors: List[str]\n';
  py += '    created_at: datetime\n';
  py += '    updated_at: datetime\n';
  py += '    tags: List[str]\n';
  py += '    category: str\n';
  py += '    audience: str\n';
  py += '    reading_time: int\n';
  py += '    difficulty: str\n';
  py += '    prerequisites: List[str]\n';
  py += '    related_docs: List[str]\n';
  py += '    search_keywords: List[str]\n';
  py += '    locale: str\n\n';

  py += '@dataclass\n';
  py += 'class TechnicalDoc:\n';
  py += '    doc_id: str\n';
  py += '    title: str\n';
  py += '    type: str\n';
  py += '    format: str\n';
  py += '    status: str\n';
  py += '    content: str\n';
  py += '    sections: List[DocSection]\n';
  py += '    metadata: DocMetadata\n';
  py += '    version: str\n';
  py += '    last_reviewed: datetime\n';
  py += '    next_review_date: datetime\n';
  py += '    ai_suggestions: List[AISuggestion] = field(default_factory=list)\n';
  py += '    change_history: List[DocChange] = field(default_factory=list)\n\n';

  py += 'class TechnicalDocumentationManager:\n';
  py += '    def __init__(self, project_name: str = \'Documentation\'):\n';
  py += '        self.project_name = project_name\n';
  py += '        self.documents: Dict[str, TechnicalDoc] = {}\n';
  py += '        self.ai_config: Dict[str, Any] = {}\n';
  py += '        self.versioning: Dict[str, Any] = {"enabled": False}\n\n';

  py += '    async def create_document(self, doc: Dict[str, Any]) -> TechnicalDoc:\n';
  py += '        doc_id = f"doc-{int(datetime.now().timestamp())}"\n';
  py += '        new_doc = TechnicalDoc(\n';
  py += '            doc_id=doc_id,\n';
  py += '            title=doc.get("title", "Untitled"),\n';
  py += '            type=doc.get("type", "api"),\n';
  py += '            format=doc.get("format", "markdown"),\n';
  py += '            status=doc.get("status", "draft"),\n';
  py += '            content=doc.get("content", ""),\n';
  py += '            sections=doc.get("sections", []),\n';
  py += '            metadata=doc.get("metadata", {}),\n';
  py += '            version=doc.get("version", "1.0.0"),\n';
  py += '            last_reviewed=datetime.now(),\n';
  py += '            next_review_date=datetime.now() + timedelta(days=90),\n';
  py += '            ai_suggestions=[],\n';
  py += '            change_history=[],\n';
  py += '        )\n\n';

  py += '        self.documents[doc_id] = new_doc\n';
  py += '        return new_doc\n\n';

  py += '    async def update_document(self, doc_id: str, updates: Dict[str, Any], author: str) -> Optional[TechnicalDoc]:\n';
  py += '        doc = self.documents.get(doc_id)\n';
  py += '        if not doc:\n';
  py += '            raise ValueError(f"Document not found: {doc_id}")\n\n';

  py += '        change = DocChange(\n';
  py += '            id=f"change-{int(datetime.now().timestamp())}",\n';
  py += '            type="updated",\n';
  py += '            description=f"Document updated by {author}",\n';
  py += '            author=author,\n';
  py += '            timestamp=datetime.now(),\n';
  py += '            version=doc.version,\n';
  py += '            affected_sections=list(updates.keys()),\n';
  py += '            severity="major",\n';
  py += '            review_required=True,\n';
  py += '        )\n\n';

  py += '        doc.change_history.append(change)\n';
  py += '        doc.metadata.updated_at = datetime.now()\n\n';

  py += '        if self.ai_config.get("enable_review"):\n';
  py += '            await self.generate_ai_suggestions(doc_id)\n\n';

  py += '        return doc\n\n';

  py += '    async def generate_ai_suggestions(self, doc_id: str) -> List[AISuggestion]:\n';
  py += '        doc = self.documents.get(doc_id)\n';
  py += '        if not doc:\n';
  py += '            raise ValueError(f"Document not found: {doc_id}")\n\n';

  py += '        suggestions = []\n\n';

  py += '        # Check for missing sections\n';
  py += '        required_sections = ["Overview", "Examples", "API Reference"]\n';
  py += '        section_titles = [s.title for s in doc.sections]\n';
  py += '        missing = [s for s in required_sections if s not in section_titles]\n\n';

  py += '        if missing:\n';
  py += '            suggestions.append(AISuggestion(\n';
  py += '                id=f"suggestion-{int(datetime.now().timestamp())}-1",\n';
  py += '                type="completeness",\n';
  py += '                suggestion=f"Consider adding these sections: {", ".join(missing)}",\n';
  py += '                confidence=0.85,\n';
  py += '                reasoning="These sections are commonly expected in technical documentation",\n';
  py += '                priority="medium",\n';
  py += '                status="pending",\n';
  py += '            ))\n\n';

  py += '        doc.ai_suggestions.extend(suggestions)\n';
  py += '        return suggestions\n\n';

  py += '    async def accept_suggestion(self, doc_id: str, suggestion_id: str, reviewer: str) -> None:\n';
  py += '        doc = self.documents.get(doc_id)\n';
  py += '        if not doc:\n';
  py += '            raise ValueError(f"Document not found: {doc_id}")\n\n';

  py += '        for suggestion in doc.ai_suggestions:\n';
  py += '            if suggestion.id == suggestion_id:\n';
  py += '                suggestion.status = "accepted"\n';
  py += '                suggestion.reviewed_by = reviewer\n';
  py += '                suggestion.reviewed_at = datetime.now()\n';
  py += '                break\n\n';

  py += '    async def auto_generate_from_code(self, source_path: str, template_id: str) -> TechnicalDoc:\n';
  py += '        generated_doc = {\n';
  py += '            "title": f"API Documentation for {source_path}",\n';
  py += '            "type": "api",\n';
  py += '            "format": "markdown",\n';
  py += '            "status": "draft",\n';
  py += '            "content": f"# API Documentation\\n\\nAuto-generated from {source_path}\\n",\n';
  py += '            "sections": [\n';
  py += '                DocSection(\n';
  py += '                    id="section-1",\n';
  py += '                    title="Overview",\n';
  py += '                    content="API overview and introduction",\n';
  py += '                    order=1,\n';
  py += '                    ai_generated=True,\n';
  py += '                ),\n';
  py += '            ],\n';
  py += '            "metadata": {\n';
  py += '                "author": "AI Generator",\n';
  py += '                "contributors": [],\n';
  py += '                "created_at": datetime.now(),\n';
  py += '                "updated_at": datetime.now(),\n';
  py += '                "tags": ["api", "auto-generated"],\n';
  py += '                "category": "API",\n';
  py += '                "audience": "developer",\n';
  py += '                "reading_time": 5,\n';
  py += '                "difficulty": "medium",\n';
  py += '                "prerequisites": [],\n';
  py += '                "related_docs": [],\n';
  py += '                "search_keywords": ["api", "rest", "endpoints"],\n';
  py += '                "locale": "en",\n';
  py += '            },\n';
  py += '            "version": "1.0.0",\n';
  py += '        }\n\n';

  py += '        return await self.create_document(generated_doc)\n\n';

  py += '    async def run_quality_checks(self, doc_id: str) -> List[Dict[str, Any]]:\n';
  py += '        doc = self.documents.get(doc_id)\n';
  py += '        if not doc:\n';
  py += '            raise ValueError(f"Document not found: {doc_id}")\n\n';

  py += '        issues = []\n\n';

  py += '        # Check for broken links\n';
  py += '        link_pattern = r"\\[([^\\]]+)\\]\\(([^)]+)\\)"\n';
  py += '        for match in re.finditer(link_pattern, doc.content):\n';
  py += '            url = match.group(2)\n';
  py += '            if not url.startswith("http") and not url.startswith("#"):\n';
  py += '                issues.append({\n';
  py += '                    "type": "links",\n';
  py += '                    "severity": "warning",\n';
  py += '                    "message": f"Potential broken link: {url}",\n';
  py += '                    "auto_fix": False,\n';
  py += '                })\n\n';

  py += '        return issues\n\n';

  py += '    def get_documents_by_status(self, status: str) -> List[TechnicalDoc]:\n';
  py += '        return [doc for doc in self.documents.values() if doc.status == status]\n\n';

  py += '    def get_documents_by_type(self, type: str) -> List[TechnicalDoc]:\n';
  py += '        return [doc for doc in self.documents.values() if doc.type == type]\n\n';

  py += '    def get_documents_needing_review(self) -> List[TechnicalDoc]:\n';
  py += '        now = datetime.now()\n';
  py += '        return [doc for doc in self.documents.values() if doc.next_review_date <= now]\n';

  return py;
}

// Write files to disk
export async function writeFiles(
  config: ReturnType<typeof technicalDocumentation>,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Generate and write Terraform for each provider
  for (const provider of config.providers) {
    const tf = generateTerraform(config, provider);
    const tfPath = path.join(outputDir, `technical-documentation-${provider}.tf`);
    await fs.writeFile(tfPath, tf);
  }

  // Generate and write manager class
  const managerCode = language === 'typescript' ? generateTypeScript(config) : generatePython(config);
  const managerFilename = language === 'typescript' ? 'technical-documentation-manager.ts' : 'technical_documentation_manager.py';
  const managerPath = path.join(outputDir, managerFilename);
  await fs.writeFile(managerPath, managerCode);

  // Generate and write markdown documentation
  const md = generateMD(config);
  const mdPath = path.join(outputDir, 'TECHNICAL_DOCUMENTATION.md');
  await fs.writeFile(mdPath, md);

  // Generate and write config JSON
  const configPath = path.join(outputDir, 'technical-documentation-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  // Generate package.json or requirements.txt
  if (language === 'typescript') {
    const packageJson = {
      name: config.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: 'Technical documentation generation and maintenance with AI',
      main: 'technical-documentation-manager.ts',
      scripts: {
        start: 'ts-node technical-documentation-manager.ts',
        test: 'jest',
      },
      dependencies: {
        eventemitter3: '^4.0.7',
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
