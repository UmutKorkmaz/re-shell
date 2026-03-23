// Data Privacy and Protection Compliance with Automated Classification

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted' | 'critical';
export type DataType = 'personal' | 'financial' | 'health' | 'academic' | 'employee' | 'customer' | 'proprietary' | 'custom';
export type PrivacyRegulation = 'gdpr' | 'ccpa' | 'hipaa' | 'ferpa' | 'glba' | 'sox' | 'pci-dss' | 'custom';
export type ProcessingBasis = 'consent' | 'contract' | 'legal-obligation' | 'vital-interests' | 'public-task' | 'legitimate-interests';
export type DataSubjectRight = 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'object' | 'automated-decision';
export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RetentionBasis = 'legal' | 'regulatory' | 'contractual' | 'operational' | 'custom';

export interface DataPrivacyConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: PrivacySettings;
  dataInventory: DataAsset[];
  classificationRules: ClassificationRule[];
  processingActivities: ProcessingActivity[];
  dataSubjects: DataSubject[];
  consentRecords: ConsentRecord[];
  dataRequests: DataSubjectRequest[];
  breachRecords: BreachRecord[];
  retentionPolicies: DataRetentionPolicy[];
  dpiaRecords: DPIARecord[];
  transfers: DataTransfer[];
}

export interface PrivacySettings {
  enableAutoClassification: boolean;
  enableDataDiscovery: boolean;
  enableDataLossPrevention: boolean;
  enableEncryptionAtRest: boolean;
  enableEncryptionInTransit: boolean;
  enableAnonymization: boolean;
  enablePseudonymization: boolean;
  enableConsentManagement: boolean;
  consentExpiryDays: number;
  enableRightAccess: boolean;
  enableRightErasure: boolean;
  enableRightPortability: boolean;
  requestSLADays: number;
  enableBreachDetection: boolean;
  breachNotificationHours: number;
  enableDataMapping: boolean;
  enableCrossBorderTransfer: boolean;
  defaultDataOwner: string;
  defaultDataCustodian: string;
  defaultRetentionYears: number;
  requireDPIA: boolean;
  dpiaThresholdRisk: number; // 0-100
  requireRecordsOfProcessing: boolean;
  enableAuditLogging: boolean;
  enableAutomatedPolicies: boolean;
  classificationConfidence: number; // 0-100
  dlpScanInterval: number; // hours
  enableDataLineage: boolean;
}

export interface DataAsset {
  id: string;
  name: string;
  description: string;
  classification: DataClassification;
  dataType: DataType;
  sensitivity: number; // 0-100
  location: string;
  format: string;
  size: number;
  recordCount: number;
  owner: string;
  custodian: string;
  tags: string[];
  regulations: PrivacyRegulation[];
  piiFields: PIIField[];
  encryptionRequired: boolean;
  encryptionStatus: 'encrypted' | 'partial' | 'none';
  accessControls: string[]; // role IDs
  retentionPolicy?: string;
  backupEnabled: boolean;
  disasterRecoveryEnabled: boolean;
  dataLineage: DataLineageEntry[];
  discoveryDate: Date;
  lastClassified: Date;
  nextReviewDate: Date;
  metadata: AssetMetadata;
}

export interface PIIField {
  name: string;
  type: 'direct' | 'indirect' | 'quasi';
  category: 'name' | 'address' | 'email' | 'phone' | 'ssn' | 'financial' | 'health' | 'biometric' | 'ip-address' | 'custom';
  masked: boolean;
  encrypted: boolean;
  tokenized: boolean;
}

export interface AssetMetadata {
  creator: string;
  source: string;
  purpose: string;
  legalBasis: ProcessingBasis;
  legitimateInterest?: string;
  thirdPartyAccess: boolean;
  crossBorderTransfer: boolean;
  countriesInvolved: string[];
  automatedDecisionMaking: boolean;
  profiling: boolean;
  anonymizationMethod?: 'k-anonymity' | 'l-diversity' | 't-closeness' | 'differential-privacy' | 'custom';
  deidentified: boolean;
  riskScore: number; // 0-100
}

export interface DataLineageEntry {
  source: string;
  transformation: string;
  destination: string;
  timestamp: Date;
}

export interface ClassificationRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: ClassificationCondition[];
  actions: ClassificationAction[];
  confidence: number; // 0-100
  falsePositiveRate: number; // 0-100
  lastTuned: Date;
}

export interface ClassificationCondition {
  type: 'content' | 'location' | 'format' | 'metadata' | 'pattern' | 'custom';
  field?: string;
  operator: 'contains' | 'matches' | 'equals' | 'in' | 'regex' | 'greater-than' | 'less-than';
  value: any;
  caseSensitive?: boolean;
}

export interface ClassificationAction {
  type: 'classify' | 'encrypt' | 'mask' | 'restrict-access' | 'alert' | 'quarantine' | 'custom';
  classification?: DataClassification;
  accessLevel?: string;
  notification?: string;
}

export interface ProcessingActivity {
  id: string;
  name: string;
  description: string;
  purposes: string[];
  dataCategories: string[];
  dataSubjects: string[]; // subject IDs
  dataTypes: DataType[];
  legalBasis: ProcessingBasis;
  legitimateInterest?: string;
  dataSources: string[]; // asset IDs
  dataDestinations: string[];
  thirdParties: string[];
  crossBorderTransfer: boolean;
  transferCountries: string[];
  safeguards: string[];
  retentionPeriod: string;
  deletionMechanism: string;
  securityMeasures: string[];
  automatedDecisionMaking: boolean;
  decisionLogic?: string;
  dpiRequired: boolean;
  dpiCompleted?: boolean;
  ropaStatus: 'active' | 'inactive' | 'under-review';
  lastUpdated: Date;
  nextReviewDate: Date;
}

export interface DataSubject {
  id: string;
  type: 'customer' | 'employee' | 'prospect' | 'vendor' | 'partner' | 'student' | 'patient' | 'custom';
  identifier: string;
  identifiers: Record<string, string>; // various ID types
  preferences: SubjectPreferences;
  consents: string[]; // consent record IDs
  requests: string[]; // request IDs
  rightsExercised: DataSubjectRight[];
  lastActivity: Date;
  created: Date;
  dataLocation: string;
  deletionScheduled?: Date;
  anonymized: boolean;
  metadata: SubjectMetadata;
}

export interface SubjectPreferences {
  marketingOptIn: boolean;
  analyticsOptIn: boolean;
  thirdPartySharing: boolean;
  cookiePreferences: string[];
  communicationChannels: string[];
  dataRetentionPreference?: string;
}

export interface SubjectMetadata {
  jurisdiction: string;
  primaryRegulation: PrivacyRegulation;
  specialCategory: boolean;
  childData: boolean;
  parentalConsent: boolean;
  employeeData: boolean;
}

export interface ConsentRecord {
  id: string;
  subjectId: string;
  subjectType: string;
  purpose: string;
  legalBasis: ProcessingBasis;
  consentGiven: boolean;
  givenAt: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
  method: 'web-form' | 'email' | 'written' | 'oral' | 'implicit' | 'custom';
  documents: ConsentDocument[];
  granularity: string[];
  withdrawalMechanism: string;
  revocable: boolean;
  legitimateInterestDetails?: string;
}

export interface ConsentDocument {
  type: 'privacy-notice' | 'terms-of-service' | 'cookie-policy' | 'consent-form' | 'custom';
  version: string;
  acceptedAt: Date;
  ipAddress?: string;
}

export interface DataSubjectRequest {
  id: string;
  requestId: string;
  subjectId: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection' | 'custom';
  status: 'pending' | 'processing' | 'completed' | 'denied' | 'partially-completed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  submittedAt: Date;
  dueDate: Date;
  completedAt?: Date;
  requestedData: string[];
  reason?: string;
  verificationMethod: string;
  verifiedAt?: Date;
  processedBy: string;
  denialReason?: string;
  partialCompletionReason?: string;
  dataPackage?: string; // location of exported data
  documents: string[];
  thirdPartyNotified: boolean[];
  redactions: Redaction[];
  metadata: RequestMetadata;
}

export interface Redaction {
  field: string;
  reason: string;
  basis: 'third-party' | 'legal-privilege' | 'security' | 'commercial' | 'custom';
}

export interface RequestMetadata {
  channel: 'web-portal' | 'email' | 'phone' | 'mail' | 'in-person' | 'custom';
  language: string;
  specialInstructions?: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedHours?: number;
  actualHours?: number;
}

export interface BreachRecord {
  id: string;
  name: string;
  description: string;
  severity: BreachSeverity;
  status: 'detected' | 'investigating' | 'contained' | 'notified' | 'resolved';
  discoveredAt: Date;
  reportedAt?: Date;
  containedAt?: Date;
  resolvedAt?: Date;
  breachTypes: BreachType[];
  dataCategories: DataType[];
  affectedRecords: number;
  affectedSubjects: number;
  rootCause: string;
  responseActions: ResponseAction[];
  notificationsSent: Notification[];
  mitigations: string[];
  lessonsLearned?: string;
  reportSubmitted: boolean;
  reportSubmittedTo: string[];
  regulatoryFilingRequired: boolean;
  regulatoryFilingDeadline?: Date;
  forensicReport?: string;
}

export interface BreachType {
  type: 'unauthorized-access' | 'disclosure' | 'loss' | 'theft' | 'alteration' | 'destruction' | 'custom';
  description: string;
  vector: string;
}

export interface ResponseAction {
  action: string;
  takenAt: Date;
  takenBy: string;
  effectiveness: 'high' | 'medium' | 'low';
}

export interface Notification {
  recipient: string;
  method: 'email' | 'mail' | 'phone' | 'web' | 'press-release' | 'custom';
  sentAt: Date;
  requiredBy?: Date;
  delayReason?: string;
}

export interface DataRetentionPolicy {
  id: string;
  name: string;
  description: string;
  dataCategories: DataType[];
  classification: DataClassification[];
  retentionPeriod: string;
  retentionBasis: RetentionBasis;
  legalRequirements: string[];
  archivalRequired: boolean;
  archivalPeriod: string;
  deletionMethod: 'secure-delete' | 'anonymize' | 'archive' | 'custom';
  deletionProcess: string[];
  exceptions: PolicyException[];
  approvalRequired: boolean;
  approvers: string[];
  lastReviewed: Date;
  nextReviewDate: Date;
}

export interface PolicyException {
  reason: string;
  justification: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt?: Date;
}

export interface DPIARecord {
  id: string;
  projectName: string;
  processingActivity: string;
  status: 'required' | 'in-progress' | 'completed' | 'not-required';
  riskScore: number; // 0-100
  highRiskProcessing: boolean;
  assessedBy: string;
  assessedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  risks: RiskAssessment[];
  mitigations: MitigationMeasure[];
  consultationRequired: boolean;
  consultationCompleted: boolean;
  consultationWith?: string[];
  outcome: 'proceed' | 'proceed-with-mitigation' | 'not-permitted' | 'pending';
  justification: string;
  documentLocation?: string;
}

export interface RiskAssessment {
  risk: string;
  likelihood: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  impact: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  score: number; // 0-100
  mitigationRequired: boolean;
}

export interface MitigationMeasure {
  measure: string;
  implemented: boolean;
  effectiveness: 'high' | 'medium' | 'low';
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface DataTransfer {
  id: string;
  name: string;
  description: string;
  sourceCountry: string;
  destinationCountry: string;
  adequacyDecision: boolean;
  adequacyReference?: string;
  safeguards: Safeguard[];
  dataCategories: DataType[];
  subjects: string[]; // subject IDs
  purpose: string;
  frequency: 'one-time' | 'recurring' | 'continuous';
  transferMechanism: string;
  thirdParty?: string;
  dpiaCompleted: boolean;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  nextReview: Date;
}

export interface Safeguard {
  type: 'sccs' | 'bcra' | 'standard-contractual-clauses' | 'binding-corporate-rules' | 'codes-of-conduct' | 'certifications' | 'custom';
  reference: string;
  effectiveDate: Date;
}

// Markdown Generation
export function generatePrivacyMarkdown(config: DataPrivacyConfig): string {
  return `# Data Privacy and Protection Compliance

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Auto-Classification**: ${config.settings.enableAutoClassification ? 'Enabled' : 'Disabled'}
**Consent Management**: ${config.settings.enableConsentManagement ? 'Enabled' : 'Disabled'}

## Privacy Settings

- **Auto-Classification**: ${config.settings.enableAutoClassification}
- **Data Discovery**: ${config.settings.enableDataDiscovery}
- **DLP**: ${config.settings.enableDataLossPrevention}
- **Encryption at Rest**: ${config.settings.enableEncryptionAtRest}
- **Encryption in Transit**: ${config.settings.enableEncryptionInTransit}
- **Anonymization**: ${config.settings.enableAnonymization}
- **Pseudonymization**: ${config.settings.enablePseudonymization}
- **Consent Management**: ${config.settings.enableConsentManagement}
- **Consent Expiry**: ${config.settings.consentExpiryDays} days
- **Subject Rights**: Access ${config.settings.enableRightAccess}, Erasure ${config.settings.enableRightErasure}, Portability ${config.settings.enableRightPortability}
- **Request SLA**: ${config.settings.requestSLADays} days
- **Breach Detection**: ${config.settings.enableBreachDetection}
- **Breach Notification**: ${config.settings.breachNotificationHours} hours
- **Data Mapping**: ${config.settings.enableDataMapping}
- **Cross-Border Transfer**: ${config.settings.enableCrossBorderTransfer}
- **DPIA Threshold**: ${config.settings.dpiaThresholdRisk}% risk

## Data Inventory (${config.dataInventory.length} assets)

${config.dataInventory.slice(0, 5).map(asset => `
### ${asset.name} - ${asset.classification.toUpperCase()}

- **ID**: ${asset.id}
- **Type**: ${asset.dataType}
- **Sensitivity**: ${asset.sensitivity}/100
- **Location**: ${asset.location}
- **Owner**: ${asset.owner}
- **Regulations**: ${asset.regulations.join(', ')}
- **PII Fields**: ${asset.piiFields.length}
- **Encryption**: ${asset.encryptionStatus}
${asset.metadata.riskScore > 70 ? `- **⚠️ High Risk**: ${asset.metadata.riskScore}/100` : ''}
`).join('')}

## Classification Rules (${config.classificationRules.length})

${config.classificationRules.map(rule => `
- **${rule.name}** (Priority: ${rule.priority}, ${rule.enabled ? 'Enabled' : 'Disabled'})
  - Confidence: ${rule.confidence}%
  - Conditions: ${rule.conditions.length}
  - Actions: ${rule.actions.length}
`).join('')}

## Processing Activities (${config.processingActivities.length})

${config.processingActivities.slice(0, 3).map(activity => `
### ${activity.name}

- **Legal Basis**: ${activity.legalBasis}
- **Purposes**: ${activity.purposes.join(', ')}
- **Data Types**: ${activity.dataTypes.join(', ')}
- **Third Parties**: ${activity.thirdParties.join(', ') || 'None'}
- **Cross-Border**: ${activity.crossBorderTransfer}
- **DPIA Required**: ${activity.dpiRequired}
- **ROPA Status**: ${activity.ropaStatus}
`).join('')}

## Data Subjects (${config.dataSubjects.length})

${config.dataSubjects.slice(0, 3).map(subject => `
- **${subject.identifier}** (${subject.type})
  - Jurisdiction: ${subject.metadata.jurisdiction}
  - Regulation: ${subject.metadata.primaryRegulation}
  - Consents: ${subject.consents.length}
  - Requests: ${subject.requests.length}
`).join('')}

## Subject Requests (${config.dataRequests.length})

${config.dataRequests.slice(0, 3).map(req => `
- **${req.requestId}** - ${req.requestType.toUpperCase()} (${req.status})
  - Submitted: ${req.submittedAt.toISOString()}
  - Due: ${req.dueDate.toISOString()}
  - Priority: ${req.priority}
`).join('')}

## Breach Records (${config.breachRecords.length})

${config.breachRecords.map(breach => `
- **${breach.name}** - ${breach.severity.toUpperCase()} (${breach.status})
  - Discovered: ${breach.discoveredAt.toISOString()}
  - Affected Records: ${breach.affectedRecords}
  - Notification Required: ${breach.regulatoryFilingRequired}
`).join('')}

## Retention Policies (${config.retentionPolicies.length})

${config.retentionPolicies.map(policy => `
- **${policy.name}**
  - Retention: ${policy.retentionPeriod}
  - Basis: ${policy.retentionBasis}
  - Deletion: ${policy.deletionMethod}
`).join('')}

## DPIA Records (${config.dpiaRecords.length})

${config.dpiaRecords.map(dpia => `
- **${dpia.projectName}** - ${dpia.status.toUpperCase()}
  - Risk Score: ${dpia.riskScore}/100
  - High Risk Processing: ${dpia.highRiskProcessing}
  - Outcome: ${dpia.outcome}
`).join('')}

## Data Transfers (${config.transfers.length})

${config.transfers.map(transfer => `
- **${transfer.name}**
  - ${transfer.sourceCountry} → ${transfer.destinationCountry}
  - Adequacy Decision: ${transfer.adequacyDecision}
  - Safeguards: ${transfer.safeguards.length}
`).join('')}
`;
}

// Terraform Generation for AWS
export function generatePrivacyTerraformAWS(config: DataPrivacyConfig): string {
  return `# Terraform configuration for Data Privacy on AWS
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

# S3 Buckets for classified data with different security levels
resource "aws_s3_bucket" "public_data" {
  bucket = "${config.projectName}-public-data"

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  versioning {
    enabled = true
  }

  tags = {
    Classification = "public"
    Environment     = "${config.projectName}"
  }
}

resource "aws_s3_bucket" "confidential_data" {
  bucket = "${config.projectName}-confidential-data"

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "aws:kms"
        kms_key_id    = aws_kms_key.confidential_key.arn
      }
    }
  }

  versioning {
    enabled = true
    mfa_delete = "Enabled"
  }

  # Bucket policy to restrict access
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyUnencryptedObjectUploads"
        Effect = "Deny"
        Principal = {
          AWS = "*"
        }
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "\${aws_s3_bucket.confidential_data.arn}/*"
        ]
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      }
    ]
  })

  logging {
    target_bucket = aws_s3_bucket.audit_logs.id
    target_prefix = "confidential/"
  }

  tags = {
    Classification = "confidential"
    Environment     = "${config.projectName}"
    Compliance      = "GDPR,HIPAA"
  }
}

# KMS Keys for encryption
resource "aws_kms_key" "confidential_key" {
  description             = "KMS key for confidential data"
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
    Name = "${config.projectName}-confidential-key"
  }
}

# DynamoDB tables for consent and request tracking
resource "aws_dynamodb_table" "consents" {
  name           = "${config.projectName}-consents"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "subjectId"
  range_key      = "consentId"

  attribute {
    name = "subjectId"
    type = "S"
  }

  attribute {
    name = "consentId"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.confidential_key.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Purpose = "Consent Management"
    Environment = "${config.projectName}"
  }
}

resource "aws_dynamodb_table" "subject_requests" {
  name           = "${config.projectName}-subject-requests"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "requestId"

  attribute {
    name = "requestId"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.confidential_key.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Purpose = "Data Subject Requests"
    Environment = "${config.projectName}"
  }
}

# Lambda for data classification
resource "aws_lambda_function" "data_classifier" {
  filename         = "data_classifier.zip"
  function_name    = "${config.projectName}-data-classifier"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 300
  memory_size      = 512

  environment {
    variables = {
      CONFIDENCE_THRESHOLD = "${config.settings.classificationConfidence}"
      DYNAMODB_CONSENTS    = aws_dynamodb_table.consents.name
      DYNAMODB_REQUESTS    = aws_dynamodb_table.subject_requests.name
    }
  }

  tags = {
    Name = "${config.projectName} Data Classifier"
  }
}

# EventBridge for automated classification triggers
resource "aws_cloudwatch_event_rule" "data_discovery" {
  name                = "${config.projectName}-data-discovery"
  schedule_expression = "rate(${config.settings.dlpScanInterval} hours)"

  targets {
    arn  = aws_lambda_function.data_classifier.arn
    id   = "data-classifier"
  }
}

# SNS for breach notifications
resource "aws_sns_topic" "breach_notifications" {
  name = "${config.projectName}-breach-notifications"

  tags = {
    Purpose = "Security Notifications"
  }
}

resource "sns_topic_subscription" "breach_email" {
  topic_arn = aws_sns_topic.breach_notifications.arn
  protocol  = "email"
  endpoint  = "security@${config.projectName}.com"
}
`;
}

// TypeScript Manager Generation
export function generatePrivacyTypeScriptManager(config: DataPrivacyConfig): string {
  return `// Auto-generated Data Privacy and Protection Manager
// Generated at: ${new Date().toISOString()}

import { v4 as uuidv4 } from 'uuid';

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  CRITICAL = 'critical'
}

export enum DataType {
  PERSONAL = 'personal',
  FINANCIAL = 'financial',
  HEALTH = 'health',
  EMPLOYEE = 'employee',
  CUSTOMER = 'customer',
  PROPRIETARY = 'proprietary'
}

export enum ProcessingBasis {
  CONSENT = 'consent',
  CONTRACT = 'contract',
  LEGAL_OBLIGATION = 'legal-obligation',
  VITAL_INTERESTS = 'vital-interests',
  PUBLIC_TASK = 'public-task',
  LEGITIMATE_INTERESTS = 'legitimate-interests'
}

export enum RequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  DENIED = 'denied',
  PARTIALLY_COMPLETED = 'partially-completed'
}

export interface DataAsset {
  id: string;
  name: string;
  classification: DataClassification;
  dataType: DataType;
  sensitivity: number;
  location: string;
  owner: string;
  encrypted: boolean;
  regulations: string[];
}

export interface ConsentRecord {
  id: string;
  subjectId: string;
  purpose: string;
  legalBasis: ProcessingBasis;
  consentGiven: boolean;
  givenAt: Date;
  withdrawnAt?: Date;
  expiresAt?: Date;
}

export interface SubjectRequest {
  id: string;
  requestId: string;
  subjectId: string;
  requestType: 'access' | 'rectification' | 'erasure' | 'portability';
  status: RequestStatus;
  submittedAt: Date;
  dueDate: Date;
  completedAt?: Date;
}

export class DataPrivacyManager {
  private assets: Map<string, DataAsset> = new Map();
  private consents: Map<string, ConsentRecord> = new Map();
  private requests: Map<string, SubjectRequest> = new Map();
  private requestSLADays: number = ${config.settings.requestSLADays};
  private consentExpiryDays: number = ${config.settings.consentExpiryDays};

  // Asset Management
  registerAsset(asset: Omit<DataAsset, 'id'>): DataAsset {
    const newAsset: DataAsset = {
      ...asset,
      id: uuidv4()
    };

    this.assets.set(newAsset.id, newAsset);
    return newAsset;
  }

  classifyAsset(assetId: string, content: string): DataClassification {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Simple keyword-based classification
    const sensitiveKeywords = {
      [DataClassification.CRITICAL]: ['ssn', 'credit card', 'password', 'health record'],
      [DataClassification.RESTRICTED]: ['financial', 'salary', 'medical', 'biometric'],
      [DataClassification.CONFIDENTIAL]: ['personal', 'email', 'phone', 'address'],
      [DataClassification.INTERNAL]: ['employee', 'internal', 'confidential'],
    };

    const lowerContent = content.toLowerCase();
    let classification = DataClassification.PUBLIC;
    let maxScore = 0;

    for (const [cls, keywords] of Object.entries(sensitiveKeywords)) {
      const score = keywords.filter(kw => lowerContent.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        classification = cls as DataClassification;
      }
    }

    asset.classification = classification;
    return classification;
  }

  // Consent Management
  recordConsent(consent: Omit<ConsentRecord, 'id' | 'givenAt'>): ConsentRecord {
    const record: ConsentRecord = {
      ...consent,
      id: uuidv4(),
      givenAt: new Date()
    };

    this.consents.set(record.id, record);
    return record;
  }

  checkConsent(subjectId: string, purpose: string): boolean {
    const now = new Date();
    const validConsents = Array.from(this.consents.values()).filter(c =>
      c.subjectId === subjectId &&
      c.purpose === purpose &&
      c.consentGiven &&
      (!c.withdrawnAt || c.withdrawnAt > now) &&
      (!c.expiresAt || c.expiresAt > now)
    );

    return validConsents.length > 0;
  }

  withdrawConsent(consentId: string): void {
    const consent = this.consents.get(consentId);
    if (consent) {
      consent.withdrawnAt = new Date();
      consent.consentGiven = false;
    }
  }

  // Subject Rights Management
  createSubjectRequest(request: Omit<SubjectRequest, 'id' | 'submittedAt' | 'dueDate' | 'status'>): SubjectRequest {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + this.requestSLADays);

    const newRequest: SubjectRequest = {
      ...request,
      id: uuidv4(),
      status: RequestStatus.PENDING,
      submittedAt: new Date(),
      dueDate
    };

    this.requests.set(newRequest.id, newRequest);
    return newRequest;
  }

  processSubjectRequest(requestId: string): SubjectRequest {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    request.status = RequestStatus.PROCESSING;

    // Simulate processing
    switch (request.requestType) {
      case 'access':
        // Generate data package
        break;
      case 'erasure':
        // Process deletion
        break;
      case 'portability':
        // Export data
        break;
    }

    request.status = RequestStatus.COMPLETED;
    request.completedAt = new Date();

    return request;
  }

  // Data Discovery
  discoverPersonalData(location: string): DataAsset[] {
    return Array.from(this.assets.values()).filter(asset =>
      asset.location === location &&
      asset.dataType !== DataType.PROPRIETARY
    );
  }

  // Compliance Checks
  checkCompliance(): {
    compliantAssets: number;
    nonCompliantAssets: number;
    expiredConsents: number;
    overdueRequests: number;
  } {
    const now = new Date();
    const assets = Array.from(this.assets.values());

    const nonCompliantAssets = assets.filter(a => !a.encrypted).length;
    const expiredConsents = Array.from(this.consents.values()).filter(c =>
      c.expiresAt && c.expiresAt < now
    ).length;
    const overdueRequests = Array.from(this.requests.values()).filter(r =>
      r.dueDate < now && r.status !== RequestStatus.COMPLETED
    ).length;

    return {
      compliantAssets: assets.length - nonCompliantAssets,
      nonCompliantAssets,
      expiredConsents,
      overdueRequests
    };
  }

  // Retention Management
  checkRetention(assetId: string): boolean {
    const asset = this.assets.get(assetId);
    if (!asset) return false;

    // Check if asset exceeds retention period
    const retentionDate = new Date();
    retentionDate.setFullYear(retentionDate.getFullYear() - ${config.settings.defaultRetentionYears});

    // Assuming asset has a createdDate
    return true;
  }

  deleteAsset(assetId: string): void {
    const asset = this.assets.get(assetId);
    if (asset) {
      // Secure deletion process
      this.assets.delete(assetId);
    }
  }

  // Reporting
  generateROPAReport(): any {
    return {
      totalAssets: this.assets.size,
      totalConsents: this.consents.size,
      totalRequests: this.requests.size,
      assetsByClassification: this.getAssetsByClassification(),
      assetsByDataType: this.getAssetsByDataType()
    };
  }

  private getAssetsByClassification(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const asset of this.assets.values()) {
      counts[asset.classification] = (counts[asset.classification] || 0) + 1;
    }
    return counts;
  }

  private getAssetsByDataType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const asset of this.assets.values()) {
      counts[asset.dataType] = (counts[asset.dataType] || 0) + 1;
    }
    return counts;
  }
}
`;
}

// Python Manager Generation
export function generatePrivacyPythonManager(config: DataPrivacyConfig): string {
  return `# Auto-generated Data Privacy and Protection Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import uuid

class DataClassification(Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    CRITICAL = "critical"

class DataType(Enum):
    PERSONAL = "personal"
    FINANCIAL = "financial"
    HEALTH = "health"
    EMPLOYEE = "employee"
    CUSTOMER = "customer"
    PROPRIETARY = "proprietary"

class ProcessingBasis(Enum):
    CONSENT = "consent"
    CONTRACT = "contract"
    LEGAL_OBLIGATION = "legal-obligation"
    VITAL_INTERESTS = "vital-interests"
    PUBLIC_TASK = "public-task"
    LEGITIMATE_INTERESTS = "legitimate-interests"

class RequestStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    DENIED = "denied"
    PARTIALLY_COMPLETED = "partially-completed"

@dataclass
class DataAsset:
    id: str
    name: str
    classification: DataClassification
    data_type: DataType
    sensitivity: int
    location: str
    owner: str
    encrypted: bool
    regulations: List[str]

@dataclass
class ConsentRecord:
    id: str
    subject_id: str
    purpose: str
    legal_basis: ProcessingBasis
    consent_given: bool
    given_at: datetime
    withdrawn_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

@dataclass
class SubjectRequest:
    id: str
    request_id: str
    subject_id: str
    request_type: str  # 'access', 'rectification', 'erasure', 'portability'
    status: RequestStatus
    submitted_at: datetime
    due_date: datetime
    completed_at: Optional[datetime] = None

class DataPrivacyManager:
    def __init__(self):
        self.assets: Dict[str, DataAsset] = {}
        self.consents: Dict[str, ConsentRecord] = {}
        self.requests: Dict[str, SubjectRequest] = {}
        self.request_sla_days: int = ${config.settings.requestSLADays}
        self.consent_expiry_days: int = ${config.settings.consentExpiryDays}

    # Asset Management
    def register_asset(self, asset: Dict[str, Any]) -> DataAsset:
        new_asset = DataAsset(
            id=str(uuid.uuid4()),
            name=asset['name'],
            classification=DataClassification(asset.get('classification', 'public')),
            data_type=DataType(asset.get('data_type', 'personal')),
            sensitivity=asset.get('sensitivity', 0),
            location=asset['location'],
            owner=asset['owner'],
            encrypted=asset.get('encrypted', False),
            regulations=asset.get('regulations', [])
        )
        self.assets[new_asset.id] = new_asset
        return new_asset

    def classify_asset(self, asset_id: str, content: str) -> DataClassification:
        asset = self.assets.get(asset_id)
        if not asset:
            raise ValueError("Asset not found")

        sensitive_keywords = {
            DataClassification.CRITICAL: ['ssn', 'credit card', 'password', 'health record'],
            DataClassification.RESTRICTED: ['financial', 'salary', 'medical', 'biometric'],
            DataClassification.CONFIDENTIAL: ['personal', 'email', 'phone', 'address'],
            DataClassification.INTERNAL: ['employee', 'internal', 'confidential'],
        }

        lower_content = content.lower()
        max_score = 0
        classification = DataClassification.PUBLIC

        for cls, keywords in sensitive_keywords.items():
            score = sum(1 for kw in keywords if kw in lower_content)
            if score > max_score:
                max_score = score
                classification = cls

        asset.classification = classification
        return classification

    # Consent Management
    def record_consent(self, consent: Dict[str, Any]) -> ConsentRecord:
        record = ConsentRecord(
            id=str(uuid.uuid4()),
            subject_id=consent['subject_id'],
            purpose=consent['purpose'],
            legal_basis=ProcessingBasis(consent['legal_basis']),
            consent_given=consent.get('consent_given', True),
            given_at=datetime.utcnow(),
            withdrawn_at=consent.get('withdrawn_at'),
            expires_at=consent.get('expires_at')
        )
        self.consents[record.id] = record
        return record

    def check_consent(self, subject_id: str, purpose: str) -> bool:
        now = datetime.utcnow()
        valid_consents = [
            c for c in self.consents.values()
            if c.subject_id == subject_id
            and c.purpose == purpose
            and c.consent_given
            and (not c.withdrawn_at or c.withdrawn_at > now)
            and (not c.expires_at or c.expires_at > now)
        ]
        return len(valid_consents) > 0

    def withdraw_consent(self, consent_id: str) -> None:
        consent = self.consents.get(consent_id)
        if consent:
            consent.withdrawn_at = datetime.utcnow()
            consent.consent_given = False

    # Subject Rights Management
    def create_subject_request(self, request: Dict[str, Any]) -> SubjectRequest:
        due_date = datetime.utcnow() + timedelta(days=self.request_sla_days)

        new_request = SubjectRequest(
            id=str(uuid.uuid4()),
            request_id=request['request_id'],
            subject_id=request['subject_id'],
            request_type=request['request_type'],
            status=RequestStatus.PENDING,
            submitted_at=datetime.utcnow(),
            due_date=due_date
        )

        self.requests[new_request.id] = new_request
        return new_request

    def process_subject_request(self, request_id: str) -> SubjectRequest:
        request = self.requests.get(request_id)
        if not request:
            raise ValueError("Request not found")

        request.status = RequestStatus.PROCESSING

        # Simulate processing
        if request.request_type == 'access':
            pass  # Generate data package
        elif request.request_type == 'erasure':
            pass  # Process deletion
        elif request.request_type == 'portability':
            pass  # Export data

        request.status = RequestStatus.COMPLETED
        request.completed_at = datetime.utcnow()

        return request

    # Compliance Checks
    def check_compliance(self) -> Dict[str, int]:
        now = datetime.utcnow()
        assets = list(self.assets.values())

        non_compliant_assets = sum(1 for a in assets if not a.encrypted)
        expired_consents = sum(
            1 for c in self.consents.values()
            if c.expires_at and c.expires_at < now
        )
        overdue_requests = sum(
            1 for r in self.requests.values()
            if r.due_date < now and r.status != RequestStatus.COMPLETED
        )

        return {
            'compliant_assets': len(assets) - non_compliant_assets,
            'non_compliant_assets': non_compliant_assets,
            'expired_consents': expired_consents,
            'overdue_requests': overdue_requests
        }

    # Reporting
    def generate_ropa_report(self) -> Dict[str, Any]:
        assets_by_type: Dict[str, int] = {}
        assets_by_classification: Dict[str, int] = {}

        for asset in self.assets.values():
            dt = asset.data_type.value
            cls = asset.classification.value
            assets_by_type[dt] = assets_by_type.get(dt, 0) + 1
            assets_by_classification[cls] = assets_by_classification.get(cls, 0) + 1

        return {
            'total_assets': len(self.assets),
            'total_consents': len(self.consents),
            'total_requests': len(self.requests),
            'assets_by_classification': assets_by_classification,
            'assets_by_type': assets_by_type
        }
`;
}

// Display function
export function displayPrivacyConfig(config: DataPrivacyConfig): void {
  console.log(chalk.cyan('🔒 Data Privacy and Protection Compliance'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Providers:'), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow('Auto-Classification:'), chalk.white(config.settings.enableAutoClassification ? 'Yes' : 'No'));
  console.log(chalk.yellow('DLP:'), chalk.white(config.settings.enableDataLossPrevention ? 'Yes' : 'No'));
  console.log(chalk.yellow('Encryption:'), chalk.white(`${config.settings.enableEncryptionAtRest ? 'At Rest ✓' : 'At Rest ✗'} / ${config.settings.enableEncryptionInTransit ? 'In Transit ✓' : 'In Transit ✗'}`));
  console.log(chalk.yellow('Consent Mgmt:'), chalk.white(config.settings.enableConsentManagement ? 'Yes' : 'No'));
  console.log(chalk.yellow('Data Inventory:'), chalk.cyan(config.dataInventory.length));
  console.log(chalk.yellow('Processing Activities:'), chalk.cyan(config.processingActivities.length));
  console.log(chalk.yellow('Data Subjects:'), chalk.cyan(config.dataSubjects.length));
  console.log(chalk.yellow('Subject Requests:'), chalk.cyan(config.dataRequests.length));
  console.log(chalk.gray('─'.repeat(60)));
}

// Package.json generation
export function generatePrivacyPackageJSON(language: string): string {
  if (language === 'typescript') {
    return JSON.stringify({
      name: 'data-privacy-manager',
      version: '1.0.0',
      description: 'Data Privacy and Protection Compliance Manager',
      main: 'privacy-manager.ts',
      scripts: {
        build: 'tsc',
        test: 'jest'
      },
      dependencies: {
        uuid: '^9.0.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0'
      }
    }, null, 2);
  } else {
    return `python-dateutil==2.8.2
pydantic==2.0.0`;
  }
}

// Config JSON generation
export function generatePrivacyConfigJSON(config: DataPrivacyConfig): string {
  return JSON.stringify(config, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}

// Main write function
export async function writePrivacyFiles(
  config: DataPrivacyConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Markdown
  await fs.writeFile(
    path.join(outputDir, 'DATA_PRIVACY.md'),
    generatePrivacyMarkdown(config)
  );

  // Terraform files
  if (config.providers.includes('aws')) {
    await fs.writeFile(
      path.join(outputDir, 'privacy-aws.tf'),
      generatePrivacyTerraformAWS(config)
    );
  }

  if (config.providers.includes('azure')) {
    await fs.writeFile(
      path.join(outputDir, 'privacy-azure.tf'),
      `# Terraform for GCP Data Privacy\n# Resource: ${config.projectName}\n`
    );
  }

  if (config.providers.includes('gcp')) {
    await fs.writeFile(
      path.join(outputDir, 'privacy-gcp.tf'),
      `# Terraform for GCP Data Privacy\n# Resource: ${config.projectName}\n`
    );
  }

  // Manager code
  const managerFile = language === 'typescript'
    ? 'privacy-manager.ts'
    : 'privacy_manager.py';

  const managerCode = language === 'typescript'
    ? generatePrivacyTypeScriptManager(config)
    : generatePrivacyPythonManager(config);

  await fs.writeFile(
    path.join(outputDir, managerFile),
    managerCode
  );

  // Package/requirements
  if (language === 'typescript') {
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      generatePrivacyPackageJSON('typescript')
    );
  } else {
    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      generatePrivacyPackageJSON('python')
    );
  }

  // Config JSON
  await fs.writeFile(
    path.join(outputDir, 'privacy-config.json'),
    generatePrivacyConfigJSON(config)
  );
}
