// Comprehensive Audit Trail and Tamper-Proof Logging System

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import * as crypto from 'crypto';

// Type Definitions
export type AuditEventType = 'user-login' | 'user-logout' | 'permission-granted' | 'permission-revoked' | 'data-access' | 'data-modified' | 'data-deleted' | 'config-change' | 'policy-violation' | 'system-start' | 'system-stop' | 'api-call' | 'custom';
export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type LogRetention = '7-days' | '30-days' | '90-days' | '180-days' | '365-days' | '7-years' | 'permanent';
export type LogFormat = 'json' | 'csv' | 'plaintext' | 'cef' | 'custom';
export type HashAlgorithm = 'sha256' | 'sha384' | 'sha512' | 'blake2b' | 'blake2s';
export type SignatureType = 'hmac' | 'digital' | 'blockchain' | 'none';
export type LogStatus = 'active' | 'archived' | 'deleted' | 'corrupted' | 'verified';
export type ComplianceLevel = 'basic' | 'standard' | 'enhanced' | 'sox' | 'hipaa' | 'pci-dss' | 'gdpr' | 'custom';

export interface AuditConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: AuditSettings;
  logSources: LogSource[];
  eventTypes: AuditEventType[];
  retentionPolicies: RetentionPolicy[];
  auditLogs: AuditEntry[];
  integrityChecks: IntegrityCheck[];
  alerts: AuditAlert[];
  compliance: ComplianceConfig;
}

export interface AuditSettings {
  enableTamperProof: boolean;
  hashAlgorithm: HashAlgorithm;
  signatureType: SignatureType;
  signatureKey?: string;
  enableBlockchain: boolean;
  blockchainProvider?: 'ethereum' | 'hyperledger' | 'custom';
  enableRealTimeSigning: boolean;
  signingInterval: number; // seconds
  enableEncryption: boolean;
  encryptionKey?: string;
  enableCompression: boolean;
  compressionLevel: number; // 0-9
  logFormat: LogFormat;
  retentionPeriod: LogRetention;
  archiveLocation: string;
  enableArchiveEncryption: boolean;
  enableIndexing: boolean;
  indexFields: string[];
  enableSearch: boolean;
  enableAggregation: boolean;
  aggregationInterval: number; // minutes
  enableAnomalyDetection: boolean;
  anomalyThreshold: number; // 0-100
  enableForwarding: boolean;
  forwardTargets: ForwardTarget[];
  enableBackup: boolean;
  backupLocation: string;
  backupInterval: number; // hours
}

export interface ForwardTarget {
  type: 'syslog' | 'splunk' | 'elasticsearch' | 's3' | 'datadog' | 'custom';
  endpoint: string;
  format: LogFormat;
  enabled: boolean;
  apiKey?: string;
}

export interface LogSource {
  id: string;
  name: string;
  type: 'application' | 'system' | 'network' | 'database' | 'api' | 'custom';
  enabled: boolean;
  priority: number; // 1-100
  source: string;
  format: LogFormat;
  parser?: string;
  filters: LogFilter[];
  retentionOverride?: LogRetention;
}

export interface LogFilter {
  field: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'regex' | 'gt' | 'lt' | 'in' | 'not-in';
  value: any;
  caseSensitive?: boolean;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  description: string;
  eventType: AuditEventType | 'all';
  retention: LogRetention;
  complianceRequirements: string[];
  archiveAfter: number; // days
  deleteAfter: number; // days
  conditions: RetentionCondition[];
  enabled: boolean;
}

export interface RetentionCondition {
  type: 'severity' | 'source' | 'user' | 'custom';
  field: string;
  operator: string;
  value: any;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  source: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  resource: string;
  resourceType: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial' | 'error';
  details: Record<string, any>;
  complianceTags: string[];
  correlationId?: string;
  requestId?: string;
  hash?: string;
  signature?: string;
  previousHash?: string;
  blockchainTxId?: string;
  status: LogStatus;
  retentionDate?: Date;
  archived: boolean;
  archiveLocation?: string;
}

export interface IntegrityCheck {
  id: string;
  timestamp: Date;
  logRange: {
    start: Date;
    end: Date;
  };
  hash: string;
  previousHash: string;
  verified: boolean;
  discrepancies: Discrepancy[];
  checkedBy: string;
  checkMethod: 'hash-verify' | 'signature-verify' | 'blockchain-verify' | 'full-audit';
  result: 'passed' | 'failed' | 'warning';
}

export interface Discrepancy {
  logId: string;
  type: 'missing' | 'modified' | 'corrupted' | 'out-of-order' | 'hash-mismatch';
  description: string;
  severity: AuditSeverity;
}

export interface AuditAlert {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  severity: AuditSeverity;
  throttle: number; // minutes
  lastTriggered?: Date;
  notificationChannels: string[];
}

export interface AlertCondition {
  type: 'event-type' | 'severity' | 'frequency' | 'pattern' | 'anomaly' | 'custom';
  field?: string;
  operator: string;
  value: any;
  timeWindow?: number; // minutes
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'slack' | 'pagerduty' | 'block' | 'quarantine' | 'custom';
  target: string;
  config: Record<string, any>;
}

export interface ComplianceConfig {
  level: ComplianceLevel;
  enabledFrameworks: ('sox' | 'hipaa' | 'pci-dss' | 'gdpr' | 'iso-27001' | 'soc-2')[];
  requireImmutableLogs: boolean;
  requireChainOfCustody: boolean;
  requireTamperEvidence: boolean;
  minimumRetention: number; // days
  requireAuditTrailAccess: boolean;
  auditTrailAccessLog: boolean;
  requireLogReview: boolean;
  reviewInterval: number; // days
  lastReviewDate?: Date;
  nextReviewDate?: Date;
  reviewers: string[];
  generateComplianceReport: boolean;
  reportSchedule: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

// Markdown Generation
export function generateAuditMarkdown(config: AuditConfig): string {
  return `# Comprehensive Audit Trail and Tamper-Proof Logging

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Tamper-Proof**: ${config.settings.enableTamperProof ? 'Enabled' : 'Disabled'}
**Hash Algorithm**: ${config.settings.hashAlgorithm.toUpperCase()}
**Signature Type**: ${config.settings.signatureType}
**Retention**: ${config.settings.retentionPeriod}

## Audit Settings

- **Tamper-Proof Logging**: ${config.settings.enableTamperProof}
- **Hash Algorithm**: ${config.settings.hashAlgorithm}
- **Signature Type**: ${config.settings.signatureType}
- **Real-Time Signing**: ${config.settings.enableRealTimeSigning} (${config.settings.signingInterval}s interval)
- **Encryption**: ${config.settings.enableEncryption}
- **Compression**: ${config.settings.enableCompression} (level ${config.settings.compressionLevel})
- **Log Format**: ${config.settings.logFormat}
- **Retention Period**: ${config.settings.retentionPeriod}
- **Archive Location**: ${config.settings.archiveLocation}
- **Indexing**: ${config.settings.enableIndexing} (${config.settings.indexFields.join(', ')})
- **Anomaly Detection**: ${config.settings.enableAnomalyDetection} (threshold: ${config.settings.anomalyThreshold})
- **Backup**: ${config.settings.enableBackup} every ${config.settings.backupInterval}h to ${config.settings.backupLocation}

## Log Sources (${config.logSources.length})

${config.logSources.slice(0, 5).map(source => `
### ${source.name}

- **Type**: ${source.type}
- **Enabled**: ${source.enabled}
- **Priority**: ${source.priority}
- **Source**: ${source.source}
- **Format**: ${source.format}
${source.filters.length > 0 ? `- **Filters**: ${source.filters.length} applied` : ''}
${source.retentionOverride ? `- **Retention Override**: ${source.retentionOverride}` : ''}
`).join('')}

## Event Types (${config.eventTypes.length})

${config.eventTypes.map(type => `- **${type}**`).join('\n')}

## Retention Policies (${config.retentionPolicies.length})

${config.retentionPolicies.map(policy => `
### ${policy.name}

- **Event Type**: ${policy.eventType}
- **Retention**: ${policy.retention}
- **Archive After**: ${policy.archiveAfter} days
- **Delete After**: ${policy.deleteAfter} days
- **Compliance**: ${policy.complianceRequirements.join(', ')}
`).join('')}

## Audit Logs (${config.auditLogs.length})

${config.auditLogs.slice(0, 5).map(log => `
- [${log.timestamp.toISOString()}] **${log.eventType}** - ${log.source} → ${log.resource} (${log.outcome})
${log.hash ? `  Hash: \`${log.hash.substring(0, 16)}...\`` : ''}
${log.signature ? `  Signed: ✓` : ''}
`).join('')}

## Integrity Checks (${config.integrityChecks.length})

${config.integrityChecks.map(check => `
- [${check.timestamp.toISOString()}] **${check.checkMethod}** - ${check.result.toUpperCase()}
  Range: ${check.logRange.start.toISOString()} to ${check.logRange.end.toISOString()}
  ${check.discrepancies.length > 0 ? `⚠️ ${check.discrepancies.length} discrepancies` : '✓ Verified'}
`).join('')}

## Alerts (${config.alerts.length})

${config.alerts.map(alert => `
### ${alert.name} (${alert.severity.toUpperCase()})

- **Enabled**: ${alert.enabled}
- **Conditions**: ${alert.conditions.length}
- **Actions**: ${alert.actions.length}
- **Notifications**: ${alert.notificationChannels.join(', ')}
`).join('')}

## Compliance (${config.compliance.level.toUpperCase()})

- **Frameworks**: ${config.compliance.enabledFrameworks.join(', ').toUpperCase()}
- **Immutable Logs**: ${config.compliance.requireImmutableLogs}
- **Chain of Custody**: ${config.compliance.requireChainOfCustody}
- **Tamper Evidence**: ${config.compliance.requireTamperEvidence}
- **Minimum Retention**: ${config.compliance.minimumRetention} days
- **Audit Trail Access**: ${config.compliance.requireAuditTrailAccess}
- **Log Review**: ${config.compliance.requireLogReview} every ${config.compliance.reviewInterval} days
- **Reviewers**: ${config.compliance.reviewers.join(', ')}
- **Report Schedule**: ${config.compliance.generateComplianceReport ? config.compliance.reportSchedule : 'disabled'}
`;
}

// Terraform Generation for AWS
export function generateAuditTerraformAWS(config: AuditConfig): string {
  return `# Terraform configuration for Audit Logging on AWS
# Generated at: ${new Date().toISOString()}

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# S3 Bucket for Audit Logs with versioning and encryption
resource "aws_s3_bucket" "audit_logs" {
  bucket = "${config.projectName}-audit-logs"

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  # Enable MFA Delete for tamper-proof
  versioning {
    mfa_delete = "Enabled"
    versioning_configuration {
      status = "Enabled"
    }
  }

  # Lifecycle policy for retention
  lifecycle_rule {
    id      = "audit-log-retention"
    enabled = true

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = ${config.settings.retentionPeriod === '7-years' ? 2555 : config.settings.retentionPeriod === '365-days' ? 365 : 90}
    }
  }

  # Block public access
  public_access_block {
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
  }

  logging {
    target_bucket = aws_s3_bucket.audit_log_access.id
    target_prefix = "log/"
  }

  tags = {
    Name        = "${config.projectName} Audit Logs"
    Environment = "${config.projectName}"
    Purpose     = "Audit Logging"
    TamperProof = "${config.settings.enableTamperProof}"
  }
}

# S3 Bucket for access logs
resource "aws_s3_bucket" "audit_log_access" {
  bucket = "${config.projectName}-audit-log-access"

  versioning {
    enabled = true
  }

  acl           = "log-delivery-write"
  force_destroy = false
}

# CloudWatch Log Group for real-time logs
resource "aws_cloudwatch_log_group" "audit_logs" {
  name              = "/aws/${config.projectName}/audit"
  retention_in_days = ${config.settings.retentionPeriod === '7-years' ? 365 : config.settings.retentionPeriod === '365-days' ? 365 : 90}

  kms_key_id = aws_kms_key.audit_logs.arn

  tags = {
    Name        = "${config.projectName} Audit Logs"
    Environment = "${config.projectName}"
  }
}

# KMS Key for encryption
resource "aws_kms_key" "audit_logs" {
  description             = "KMS key for audit log encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "*"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "${config.projectName}-audit-logs"
  }
}

# CloudTrail for audit trail
resource "aws_cloudtrail" "audit_trail" {
  name                          = "${config.projectName}-audit-trail"
  s3_bucket_name                = aws_s3_bucket.audit_logs.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = ${config.settings.enableTamperProof}
  kms_key_id                    = aws_kms_key.audit_logs.arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["\${aws_s3_bucket.audit_logs.arn}/*"]
    }
  }

  tags = {
    Name        = "${config.projectName} Audit Trail"
    Environment = "${config.projectName}"
  }
}

# Lambda for real-time log processing
resource "aws_lambda_function" "audit_processor" {
  filename         = "audit_processor.zip"
  function_name    = "${config.projectName}-audit-processor"
  role             = aws_iam_role.audit_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = filebase64sha256("audit_processor.zip")

  environment {
    variables = {
      HASH_ALGORITHM = "${config.settings.hashAlgorithm}"
      SIGNING_KEY    = "${config.settings.signatureKey || ''}"
    }
  }

  tags = {
    Name = "${config.projectName} Audit Processor"
  }
}

# IAM role for Lambda
resource "aws_iam_role" "audit_lambda" {
  name = "${config.projectName}-audit-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Events for Lambda trigger
resource "aws_cloudwatch_event_rule" "audit_trigger" {
  name                = "${config.projectName}-audit-trigger"
  schedule_expression = "rate(${config.settings.signingInterval} seconds)"

  targets {
    arn  = aws_lambda_function.audit_processor.arn
    id   = "audit-processor"
  }
}
`;
}

// Terraform Generation for Azure
export function generateAuditTerraformAzure(config: AuditConfig): string {
  return `# Terraform configuration for Audit Logging on Azure
# Generated at: ${new Date().toISOString()}

terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "audit" {
  name     = "${config.projectName}-audit-rg"
  location = "East US"
}

# Storage Account for Audit Logs
resource "azurerm_storage_account" "audit_logs" {
  name                     = "${config.projectName.replace(/-/g, '')}auditlogs"
  resource_group_name      = azurerm_resource_group.audit.name
  location                 = azurerm_resource_group.audit.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
  enable_https_traffic_only = true

  blob_properties {
    versioning_enabled = true
  }

  tags = {
    Name = "${config.projectName} Audit Logs"
  }
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "audit_logs" {
  name                = "${config.projectName}-audit-logs"
  location            = azurerm_resource_group.audit.location
  resource_group_name = azurerm_resource_group.audit.name
  sku                 = "PerGB2018"
  retention_in_days   = ${config.settings.retentionPeriod === '7-years' ? 365 : config.settings.retentionPeriod === '365-days' ? 365 : 90}
}

# Activity Log Alert
resource "azurerm_monitor_activity_log_alert" "audit_alert" {
  name                = "${config.projectName}-audit-alert"
  resource_group_name = azurerm_resource_group.audit.name
  scopes              = [azurerm_resource_group.audit.id]
  description         = "Alert for audit log events"

  criteria {
    category = "Audit"
  }

  action {
    action_group_id = azurerm_monitor_action_group.audit_actions.id
  }
}

# Action Group for Alerts
resource "azurerm_monitor_action_group" "audit_actions" {
  name                = "${config.projectName}-audit-actions"
  resource_group_name = azurerm_resource_group.audit.name
  short_name           = "auditact"

  email_receiver {
    name          = "security-team"
    email_address = "security@${config.projectName}.com"
  }
}
`;
}

// TypeScript Manager Generation
export function generateAuditTypeScriptManager(config: AuditConfig): string {
  return `// Auto-generated Audit Trail and Tamper-Proof Logging Manager
// Generated at: ${new Date().toISOString()}

import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export enum AuditEventType {
  USER_LOGIN = 'user-login',
  USER_LOGOUT = 'user-logout',
  PERMISSION_GRANTED = 'permission-granted',
  PERMISSION_REVOKED = 'permission-revoked',
  DATA_ACCESS = 'data-access',
  DATA_MODIFIED = 'data-modified',
  DATA_DELETED = 'data-deleted',
  CONFIG_CHANGE = 'config-change',
  POLICY_VIOLATION = 'policy-violation',
  SYSTEM_START = 'system-start',
  SYSTEM_STOP = 'system-stop',
  API_CALL = 'api-call'
}

export enum AuditSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum LogStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
  CORRUPTED = 'corrupted',
  VERIFIED = 'verified'
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  source: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  resource: string;
  resourceType: string;
  action: string;
  outcome: 'success' | 'failure' | 'partial' | 'error';
  details: Record<string, any>;
  hash?: string;
  signature?: string;
  previousHash?: string;
  status: LogStatus;
}

export interface IntegrityCheck {
  id: string;
  timestamp: Date;
  logRange: { start: Date; end: Date };
  hash: string;
  previousHash: string;
  verified: boolean;
  result: 'passed' | 'failed' | 'warning';
}

export class AuditManager {
  private entries: Map<string, AuditEntry> = new Map();
  private integrityChecks: IntegrityCheck[] = [];
  private lastHash: string = '';
  private signingKey: string;
  private hashAlgorithm: string = '${config.settings.hashAlgorithm}';

  constructor(signingKey?: string) {
    this.signingKey = signingKey || process.env.AUDIT_SIGNING_KEY || 'default-key-change-in-production';
    this.initializeChain();
  }

  private initializeChain(): void {
    // Initialize with a genesis hash
    this.lastHash = crypto.createHash(this.hashAlgorithm).update('genesis').digest('hex');
  }

  async logEvent(entry: Omit<AuditEntry, 'id' | 'hash' | 'signature' | 'previousHash' | 'status'>): Promise<AuditEntry> {
    const auditEntry: AuditEntry = {
      ...entry,
      id: uuidv4(),
      status: LogStatus.ACTIVE
    };

    // Create hash of the entry
    const entryHash = this.computeHash(auditEntry);
    auditEntry.hash = entryHash;
    auditEntry.previousHash = this.lastHash;

    // Sign the entry
    if (${config.settings.signatureType !== 'none'}) {
      auditEntry.signature = this.signEntry(auditEntry);
    }

    this.entries.set(auditEntry.id, auditEntry);
    this.lastHash = entryHash;

    return auditEntry;
  }

  private computeHash(entry: AuditEntry): string {
    const data = JSON.stringify({
      timestamp: entry.timestamp,
      eventType: entry.eventType,
      severity: entry.severity,
      source: entry.source,
      userId: entry.userId,
      resource: entry.resource,
      action: entry.action,
      outcome: entry.outcome,
      previousHash: this.lastHash
    });

    return crypto.createHash(this.hashAlgorithm).update(data).digest('hex');
  }

  private signEntry(entry: AuditEntry): string {
    const data = entry.hash + this.lastHash;
    return crypto
      .createHmac('sha256', this.signingKey)
      .update(data)
      .digest('hex');
  }

  verifyEntry(entry: AuditEntry): boolean {
    // Verify hash
    const computedHash = this.computeHash(entry);
    if (computedHash !== entry.hash) {
      return false;
    }

    // Verify signature
    if (${config.settings.signatureType !== 'none'}) {
      const expectedSignature = this.signEntry(entry);
      if (expectedSignature !== entry.signature) {
        return false;
      }
    }

    // Verify chain integrity
    if (entry.previousHash !== this.lastHash && this.entries.size > 0) {
      // Find previous entry
      const prevEntry = Array.from(this.entries.values())
        .find(e => e.hash === entry.previousHash);
      if (!prevEntry) {
        return false;
      }
    }

    return true;
  }

  async verifyIntegrity(startDate: Date, endDate: Date): Promise<IntegrityCheck> {
    const entriesInRange = Array.from(this.entries.values())
      .filter(e => e.timestamp >= startDate && e.timestamp <= endDate)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let verified = true;
    let currentHash = this.lastHash;

    // Verify each entry in reverse
    for (const entry of entriesInRange.reverse()) {
      if (entry.hash !== currentHash && entry !== entriesInRange[0]) {
        verified = false;
        break;
      }
      currentHash = entry.previousHash || '';
    }

    const check: IntegrityCheck = {
      id: uuidv4(),
      timestamp: new Date(),
      logRange: { start: startDate, end: endDate },
      hash: this.computeHash(entriesInRange[0] || {} as any),
      previousHash: entriesInRange[0]?.previousHash || '',
      verified,
      result: verified ? 'passed' : 'failed'
    };

    this.integrityChecks.push(check);
    return check;
  }

  queryEvents(filter: Partial<AuditEntry>): AuditEntry[] {
    return Array.from(this.entries.values()).filter(entry => {
      return Object.entries(filter).every(([key, value]) => {
        return (entry as any)[key] === value;
      });
    });
  }

  getEntry(id: string): AuditEntry | undefined {
    return this.entries.get(id);
  }

  async archiveEntriesOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let archived = 0;
    for (const [id, entry] of this.entries) {
      if (entry.timestamp < cutoffDate && entry.status === LogStatus.ACTIVE) {
        entry.status = LogStatus.ARCHIVED;
        archived++;
      }
    }

    return archived;
  }

  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    const entries = Array.from(this.entries.values());

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else {
      // CSV format
      const headers = ['id', 'timestamp', 'eventType', 'severity', 'source', 'userId', 'resource', 'action', 'outcome'];
      const rows = entries.map(e =>
        headers.map(h => \`"\${(e as any)[h] || ''}"\`).join(',')
      );
      return [headers.join(','), ...rows].join('\\n');
    }
  }

  async generateComplianceReport(): Promise<{
    totalEntries: number;
    entriesByType: Record<string, number>;
    entriesBySeverity: Record<string, number>;
    integrityChecks: IntegrityCheck[];
    verified: boolean;
  }> {
    const entries = Array.from(this.entries.values());

    const entriesByType: Record<string, number> = {};
    const entriesBySeverity: Record<string, number> = {};

    for (const entry of entries) {
      entriesByType[entry.eventType] = (entriesByType[entry.eventType] || 0) + 1;
      entriesBySeverity[entry.severity] = (entriesBySeverity[entry.severity] || 0) + 1;
    }

    const latestCheck = this.integrityChecks[this.integrityChecks.length - 1];

    return {
      totalEntries: entries.length,
      entriesByType,
      entriesBySeverity,
      integrityChecks: this.integrityChecks,
      verified: latestCheck?.verified || true
    };
  }
}
`;
}

// Python Manager Generation
export function generateAuditPythonManager(config: AuditConfig): string {
  return `# Auto-generated Audit Trail and Tamper-Proof Logging Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import hmac
import json
import uuid

class AuditEventType(Enum):
    USER_LOGIN = "user-login"
    USER_LOGOUT = "user-logout"
    PERMISSION_GRANTED = "permission-granted"
    PERMISSION_REVOKED = "permission-revoked"
    DATA_ACCESS = "data-access"
    DATA_MODIFIED = "data-modified"
    DATA_DELETED = "data-deleted"
    CONFIG_CHANGE = "config-change"
    POLICY_VIOLATION = "policy-violation"
    SYSTEM_START = "system-start"
    SYSTEM_STOP = "system-stop"
    API_CALL = "api-call"

class AuditSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class LogStatus(Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"
    CORRUPTED = "corrupted"
    VERIFIED = "verified"

@dataclass
class AuditEntry:
    id: str
    timestamp: datetime
    event_type: AuditEventType
    severity: AuditSeverity
    source: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    resource: str = ""
    resource_type: str = ""
    action: str = ""
    outcome: str = "success"
    details: Dict[str, Any] = field(default_factory=dict)
    hash: Optional[str] = None
    signature: Optional[str] = None
    previous_hash: Optional[str] = None
    status: LogStatus = LogStatus.ACTIVE

@dataclass
class IntegrityCheck:
    id: str
    timestamp: datetime
    log_range_start: datetime
    log_range_end: datetime
    hash: str
    previous_hash: str
    verified: bool
    result: str

class AuditManager:
    def __init__(self, signing_key: Optional[str] = None):
        self.entries: Dict[str, AuditEntry] = {}
        self.integrity_checks: List[IntegrityCheck] = []
        self.last_hash: str = self._genesis_hash()
        self.signing_key: str = signing_key or "default-key-change-in-production"
        self.hash_algorithm: str = "${config.settings.hashAlgorithm}"

    def _genesis_hash(self) -> str:
        return hashlib.sha256(b"genesis").hexdigest()

    def _compute_hash(self, entry: AuditEntry) -> str:
        data = json.dumps({
            "timestamp": entry.timestamp.isoformat(),
            "event_type": entry.event_type.value,
            "severity": entry.severity.value,
            "source": entry.source,
            "user_id": entry.user_id,
            "resource": entry.resource,
            "action": entry.action,
            "outcome": entry.outcome,
            "previous_hash": self.last_hash
        }, sort_keys=True).encode()

        return hashlib.sha256(data).hexdigest()

    def _sign_entry(self, entry: AuditEntry) -> str:
        data = (entry.hash or "") + self.last_hash
        return hmac.new(
            self.signing_key.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()

    async def log_event(self, entry: Dict[str, Any]) -> AuditEntry:
        audit_entry = AuditEntry(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            event_type=AuditEventType(entry.get("event_type", "api-call")),
            severity=AuditSeverity(entry.get("severity", "info")),
            source=entry.get("source", "system"),
            user_id=entry.get("user_id"),
            user_name=entry.get("user_name"),
            ip_address=entry.get("ip_address"),
            user_agent=entry.get("user_agent"),
            session_id=entry.get("session_id"),
            resource=entry.get("resource", ""),
            resource_type=entry.get("resource_type", ""),
            action=entry.get("action", ""),
            outcome=entry.get("outcome", "success"),
            details=entry.get("details", {})
        )

        # Create hash
        entry_hash = self._compute_hash(audit_entry)
        audit_entry.hash = entry_hash
        audit_entry.previous_hash = self.last_hash

        # Sign entry
        if ${config.settings.signatureType !== 'none'}:
            audit_entry.signature = self._sign_entry(audit_entry)

        self.entries[audit_entry.id] = audit_entry
        self.last_hash = entry_hash

        return audit_entry

    def verify_entry(self, entry: AuditEntry) -> bool:
        # Verify hash
        computed_hash = self._compute_hash(entry)
        if computed_hash != entry.hash:
            return False

        # Verify signature
        if ${config.settings.signatureType !== 'none'}:
            expected_signature = self._sign_entry(entry)
            if expected_signature != entry.signature:
                return False

        return True

    async def verify_integrity(
        self, start_date: datetime, end_date: datetime
    ) -> IntegrityCheck:
        entries_in_range = [
            e for e in self.entries.values()
            if start_date <= e.timestamp <= end_date
        ]
        entries_in_range.sort(key=lambda x: x.timestamp)

        verified = all(self.verify_entry(e) for e in entries_in_range)

        check = IntegrityCheck(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            log_range_start=start_date,
            log_range_end=end_date,
            hash=self._compute_hash(entries_in_range[0]) if entries_in_range else "",
            previous_hash=entries_in_range[0].previous_hash if entries_in_range else "",
            verified=verified,
            result="passed" if verified else "failed"
        )

        self.integrity_checks.append(check)
        return check

    def query_events(self, **filters) -> List[AuditEntry]:
        results = list(self.entries.values())

        for key, value in filters.items():
            results = [e for e in results if getattr(e, key, None) == value]

        return results

    def get_entry(self, entry_id: str) -> Optional[AuditEntry]:
        return self.entries.get(entry_id)

    async def archive_entries_older_than(self, days: int) -> int:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        archived = 0

        for entry in self.entries.values():
            if entry.timestamp < cutoff_date and entry.status == LogStatus.ACTIVE:
                entry.status = LogStatus.ARCHIVED
                archived += 1

        return archived

    async def export_logs(self, format: str = "json") -> str:
        entries = list(self.entries.values())

        if format == "json":
            return json.dumps([self._entry_to_dict(e) for e in entries], indent=2)
        else:
            # CSV format
            headers = ["id", "timestamp", "event_type", "severity", "source", "user_id", "resource", "action", "outcome"]
            rows = []
            for e in entries:
                row = [str(getattr(e, h, "")) for h in headers]
                rows.append(",".join(f'"{v}"' for v in row))
            return ",".join(headers) + "\\n" + "\\n".join(rows)

    def _entry_to_dict(self, entry: AuditEntry) -> Dict[str, Any]:
        return {
            "id": entry.id,
            "timestamp": entry.timestamp.isoformat(),
            "event_type": entry.event_type.value,
            "severity": entry.severity.value,
            "source": entry.source,
            "user_id": entry.user_id,
            "resource": entry.resource,
            "action": entry.action,
            "outcome": entry.outcome,
            "hash": entry.hash,
            "status": entry.status.value
        }

    async def generate_compliance_report(self) -> Dict[str, Any]:
        entries = list(self.entries.values())

        entries_by_type = {}
        entries_by_severity = {}

        for entry in entries:
            et = entry.event_type.value
            es = entry.severity.value
            entries_by_type[et] = entries_by_type.get(et, 0) + 1
            entries_by_severity[es] = entries_by_severity.get(es, 0) + 1

        latest_check = self.integrity_checks[-1] if self.integrity_checks else None

        return {
            "total_entries": len(entries),
            "entries_by_type": entries_by_type,
            "entries_by_severity": entries_by_severity,
            "integrity_checks": [
                {
                    "id": c.id,
                    "timestamp": c.timestamp.isoformat(),
                    "result": c.result,
                    "verified": c.verified
                }
                for c in self.integrity_checks
            ],
            "verified": latest_check.verified if latest_check else True
        }
`;
}

// Package.json generation
export function generateAuditPackageJSON(language: string): string {
  if (language === 'typescript') {
    return JSON.stringify({
      name: 'audit-trail-manager',
      version: '1.0.0',
      description: 'Comprehensive Audit Trail and Tamper-Proof Logging',
      main: 'audit-manager.ts',
      scripts: {
        build: 'tsc',
        test: 'jest',
        lint: 'eslint audit-manager.ts'
      },
      dependencies: {
        uuid: '^9.0.0',
        crypto: '^1.0.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0',
        jest: '^29.0.0',
        '@types/jest': '^29.0.0',
        eslint: '^8.0.0'
      }
    }, null, 2);
  } else {
    return `python-dateutil==2.8.2
pydantic==2.0.0
pytest==7.0.0
pytest-asyncio==0.21.0`;
  }
}

// Config JSON generation
export function generateAuditConfigJSON(config: AuditConfig): string {
  return JSON.stringify(config, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}

// Display function
export function displayAuditConfig(config: AuditConfig): void {
  console.log(chalk.cyan('📋 Comprehensive Audit Trail and Tamper-Proof Logging'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Providers:'), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow('Tamper-Proof:'), chalk.white(config.settings.enableTamperProof ? 'Yes' : 'No'));
  console.log(chalk.yellow('Hash Algorithm:'), chalk.white(config.settings.hashAlgorithm.toUpperCase()));
  console.log(chalk.yellow('Signature:'), chalk.white(config.settings.signatureType));
  console.log(chalk.yellow('Retention:'), chalk.white(config.settings.retentionPeriod));
  console.log(chalk.yellow('Log Sources:'), chalk.cyan(config.logSources.length));
  console.log(chalk.yellow('Event Types:'), chalk.cyan(config.eventTypes.length));
  console.log(chalk.yellow('Retention Policies:'), chalk.cyan(config.retentionPolicies.length));
  console.log(chalk.yellow('Alerts:'), chalk.cyan(config.alerts.length));
  console.log(chalk.gray('─'.repeat(60)));
}

// Main write function
export async function writeAuditFiles(
  config: AuditConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Markdown
  await fs.writeFile(
    path.join(outputDir, 'AUDIT_TRAIL.md'),
    generateAuditMarkdown(config)
  );

  // Terraform files
  if (config.providers.includes('aws')) {
    await fs.writeFile(
      path.join(outputDir, 'audit-aws.tf'),
      generateAuditTerraformAWS(config)
    );
  }

  if (config.providers.includes('azure')) {
    await fs.writeFile(
      path.join(outputDir, 'audit-azure.tf'),
      generateAuditTerraformAzure(config)
    );
  }

  if (config.providers.includes('gcp')) {
    await fs.writeFile(
      path.join(outputDir, 'audit-gcp.tf'),
      `# Terraform for GCP Audit Logging\n# Resource: ${config.projectName}\n`
    );
  }

  // Manager code
  const managerFile = language === 'typescript'
    ? 'audit-manager.ts'
    : 'audit_manager.py';

  const managerCode = language === 'typescript'
    ? generateAuditTypeScriptManager(config)
    : generateAuditPythonManager(config);

  await fs.writeFile(
    path.join(outputDir, managerFile),
    managerCode
  );

  // Package/requirements
  if (language === 'typescript') {
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      generateAuditPackageJSON('typescript')
    );
  } else {
    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      generateAuditPackageJSON('python')
    );
  }

  // Config JSON
  await fs.writeFile(
    path.join(outputDir, 'audit-config.json'),
    generateAuditConfigJSON(config)
  );
}
