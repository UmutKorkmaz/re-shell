// Secret Detection and Management with HashiCorp Vault and Rotation Policies

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/** Represents the category of a detected secret. */
export type SecretType = 'api-key' | 'password' | 'token' | 'certificate' | 'ssh-key' | 'database-url' | 'private-key' | 'oauth' | 'jwt' | 'custom';
/** Severity level assigned to a detected secret, influencing alerting and remediation priority. */
export type SecretSeverity = 'critical' | 'high' | 'medium' | 'low';
/** Lifecycle status of a secret, tracking whether it is in use, revoked, expired, or otherwise. */
export type SecretStatus = 'active' | 'revoked' | 'expired' | 'rotated' | 'compromised';
/** Current state of a secret rotation operation. */
export type RotationStatus = 'pending' | 'in-progress' | 'completed' | 'failed';
/** Cadence at which a secret should be rotated. */
export type RotationFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'never' | 'on-compromise';
/** Supported external vault or secrets-management providers. */
export type VaultProvider = 'hashicorp-vault' | 'aws-secrets-manager' | 'azure-key-vault' | 'gcp-secret-manager' | 'custom';
/** Encryption algorithm used to protect secret material. */
export type EncryptionAlgorithm = 'aes256-gcm' | 'rsa-4096' | 'chacha20-poly1305' | 'custom';

/**
 * Top-level configuration for secret detection and management.
 */
export interface SecretDetectionConfig {
  /** Name of the project this configuration applies to. */
  projectName: string;
  /** Cloud providers targeted by the generated infrastructure. */
  providers: Array<'aws' | 'azure' | 'gcp'>;
  /** Settings controlling how and when secrets are scanned. */
  detectionSettings: DetectionSettings;
  /** List of detected or tracked secrets. */
  secrets: Secret[];
  /** Rotation policies governing secret lifecycles. */
  rotationPolicies: RotationPolicy[];
  /** Integrations with external vault/secrets-management providers. */
  vaultIntegrations: VaultIntegration[];
  /** Access-control entries regulating who can interact with each secret. */
  accessControls: AccessControl[];
  /** Chronological audit log entries for secret-related actions. */
  auditLogs: AuditLog[];
  /** Compliance reports produced for various standards. */
  complianceReports: ComplianceReport[];
}

/**
 * Settings controlling the secret-detection scanning behavior.
 */
export interface DetectionSettings {
  /** Whether secret detection scanning is enabled. */
  enabled: boolean;
  /** When scans are triggered. */
  frequency: 'on-commit' | 'on-push' | 'on-build' | 'scheduled' | 'on-demand';
  /** Cron expression describing the scheduled scan interval. */
  interval: string;
  /** Minimum severity required to surface a finding. */
  severityThreshold: SecretSeverity;
  /** Severity at which the scan should fail the build/pipeline. */
  failOnThreshold: SecretSeverity;
  /** Whether to scan git history. */
  scanHistory: boolean;
  /** Whether to scan source-code comments. */
  scanComments: boolean;
  /** Whether to scan source code. */
  scanCode: boolean;
  /** Whether to scan configuration files. */
  scanConfigs: boolean;
  /** Whether to scan environment variables. */
  scanEnvVars: boolean;
  /** Whether to scan Dockerfiles. */
  scanDockerfiles: boolean;
  /** Whether to scan Kubernetes manifests. */
  scanKubernetesManifests: boolean;
  /** Entropy value above which a string is considered likely to be a secret. */
  entropyThreshold: number;
  /** Minimum length for a candidate string to be evaluated as a secret. */
  minSecretLength: number;
  /** Whether to automatically revoke detected secrets. */
  autoRevoke: boolean;
  /** Whether to automatically rotate detected secrets. */
  autoRotate: boolean;
  /** Whether to send notifications when secrets are detected. */
  notifyOnDetection: boolean;
  /** Whether to quarantine files containing detected secrets. */
  quarantineDetected: boolean;
}

/**
 * Represents a detected or managed secret.
 */
export interface Secret {
  /** Unique identifier for the secret. */
  id: string;
  /** Human-readable name of the secret. */
  name: string;
  /** Category of the secret. */
  type: SecretType;
  /** Severity of the finding. */
  severity: SecretSeverity;
  /** Current lifecycle status. */
  status: SecretStatus;
  /** Where the secret was detected or stored. */
  location: SecretLocation;
  /** Hash of the secret's value for comparison without exposure. */
  valueHash: string;
  /** Masked representation of the secret value safe for display. */
  valueMasked: string;
  /** When the secret was first detected. */
  detectedAt: Date;
  /** When the secret was last rotated. */
  lastRotated: Date;
  /** Optional expiration timestamp for the secret. */
  expiresAt?: Date;
  /** Optional identifier of the rotation policy governing this secret. */
  rotationPolicyId?: string;
  /** Optional path to the secret within the vault. */
  vaultPath?: string;
  /** Description of the secret and its purpose. */
  description: string;
  /** Free-form tags associated with the secret. */
  tags: string[];
  /** Additional metadata key-value pairs. */
  metadata: Record<string, unknown>;
  /** Owner responsible for the secret. */
  owner: string;
  /** Optional user or team the secret is assigned to. */
  assignedTo?: string;
  /** Detection confidence score between 0 and 1. */
  confidence: number;
  /** Whether this finding has been marked as a false positive. */
  falsePositive: boolean;
  /** External references related to the finding (e.g. CWE, OWASP). */
  references: SecretReference[];
  /** IDs of other secrets that depend on this one. */
  dependencies: string[];
}

/**
 * Describes where a secret is located.
 */
export interface SecretLocation {
  /** Kind of location holding the secret. */
  type: 'file' | 'environment' | 'config' | 'docker' | 'kubernetes' | 'database' | 'vault';
  /** Logical path or identifier of the location. */
  path: string;
  /** Specific file within the location, if applicable. */
  file?: string;
  /** Line number within the file, if applicable. */
  line?: number;
  /** Column number within the line, if applicable. */
  column?: number;
  /** Repository name, when the secret resides in source control. */
  repository?: string;
  /** Branch name, when the secret resides in source control. */
  branch?: string;
  /** Commit hash, when the secret resides in source control. */
  commit?: string;
  /** Container name, when the secret resides in a Docker/container context. */
  container?: string;
  /** Pod name, when the secret resides in Kubernetes. */
  pod?: string;
  /** Kubernetes namespace, when applicable. */
  namespace?: string;
}

/**
 * External reference providing context for a secret finding.
 */
export interface SecretReference {
  /** Type of reference (e.g. CWE, OWASP, NIST). */
  type: 'cwe' | 'owasp' | 'nist' | 'custom';
  /** URL pointing to the reference documentation. */
  url: string;
  /** Display title for the reference. */
  title: string;
}

/**
 * Policy defining how and when a category of secrets is rotated.
 */
export interface RotationPolicy {
  /** Unique identifier for the policy. */
  id: string;
  /** Human-readable name of the policy. */
  name: string;
  /** Description of the policy's purpose. */
  description: string;
  /** Secret types this policy applies to. */
  secretTypes: SecretType[];
  /** How often matching secrets should be rotated. */
  frequency: RotationFrequency;
  /** Whether rotation should occur automatically. */
  autoRotate: boolean;
  /** Whether to notify owners before a scheduled rotation. */
  notifyBeforeRotation: boolean;
  /** Number of days before rotation to send notifications. */
  notificationDays: number;
  /** Whether human approval is required before rotation. */
  requireApproval: boolean;
  /** List of principals allowed to approve rotation. */
  approvers: string[];
  /** Time window during which rotations are permitted. */
  rotationWindow: {
    /** Start of the rotation window in HH:MM format. */
    start: string;
    /** End of the rotation window in HH:MM format. */
    end: string;
    /** Timezone for the rotation window. */
    timezone: string;
  };
  /** Maximum duration (in minutes) a rotation may take. */
  maxRotationTime: number;
  /** Whether to retry failed rotations. */
  retryOnFailure: boolean;
  /** Maximum number of retry attempts on failure. */
  maxRetries: number;
  /** Interval (in minutes) between retry attempts. */
  retryInterval: number;
  /** Optional script executed before rotation. */
  preRotationScript?: string;
  /** Optional script executed after rotation. */
  postRotationScript?: string;
  /** Optional script used to validate the rotated secret. */
  validationScript?: string;
  /** Whether to roll back changes if rotation fails. */
  rollbackOnFailure: boolean;
  /** Whether secrets are encrypted at rest. */
  encryptionAtRest: boolean;
  /** Whether secrets are encrypted in transit. */
  encryptionInTransit: boolean;
  /** Encryption algorithm used for the secrets. */
  algorithm: EncryptionAlgorithm;
  /** Encryption key length in bits. */
  keyLength: number;
  /** Whether this policy is currently active. */
  isActive: boolean;
  /** When the policy was last applied, if ever. */
  lastRotated?: Date;
  /** When the next rotation is scheduled, if any. */
  nextRotation?: Date;
  /** When the policy was created. */
  createdAt: Date;
  /** When the policy was last updated. */
  updatedAt: Date;
}

/**
 * Describes an integration with an external vault or secrets manager.
 */
export interface VaultIntegration {
  /** Unique identifier for the integration. */
  id: string;
  /** Human-readable name of the integration. */
  name: string;
  /** Vault provider backing this integration. */
  provider: VaultProvider;
  /** Whether the integration is enabled. */
  enabled: boolean;
  /** Provider-specific configuration. */
  config: VaultConfig;
  /** Authentication details for the vault. */
  auth: VaultAuth;
  /** Secrets managed through this integration. */
  secrets: VaultSecret[];
  /** Current connection status. */
  status: 'connected' | 'disconnected' | 'error';
  /** Timestamp of the last successful synchronization. */
  lastSync: Date;
  /** Optional error message when the integration is in an error state. */
  errorMessage?: string;
}

/**
 * Provider-specific configuration for a vault integration.
 */
export interface VaultConfig {
  /** Vault API endpoint URL. */
  endpoint: string;
  /** Optional namespace within the vault (used by some providers). */
  namespace?: string;
  /** Secrets engine name (e.g. KV, Database, PKI). */
  engine: string;
  /** Version of the secrets engine. */
  engineVersion: 'v1' | 'v2';
  /** Maximum number of retry attempts for vault requests. */
  maxRetries: number;
  /** Request timeout in seconds. */
  timeout: number;
  /** Health-check settings for the vault connection. */
  healthCheck: {
    /** Whether health checks are enabled. */
    enabled: boolean;
    /** Interval between health checks in seconds. */
    interval: number;
    /** Number of failed checks before the vault is considered unhealthy. */
    unhealthyThreshold: number;
  };
}

/**
 * Authentication configuration for accessing a vault.
 */
export interface VaultAuth {
  /** Authentication method used to obtain access. */
  method: 'token' | 'approle' | 'kubernetes' | 'aws' | 'azure' | 'gcp' | 'github' | 'ldap';
  /** Static token, when using token-based auth. */
  token?: string;
  /** AppRole role ID, when using AppRole auth. */
  roleId?: string;
  /** AppRole secret ID, when using AppRole auth. */
  secretId?: string;
  /** Kubernetes service-account role, when using Kubernetes auth. */
  kubernetesRole?: string;
  /** Custom mount path for the auth method. */
  mountPath?: string;
  /** Whether the token should be automatically renewed. */
  renewToken: boolean;
  /** Time-to-live for the token in seconds. */
  tokenTTL?: number;
  /** Maximum time-to-live for the token in seconds. */
  maxTTL?: number;
}

/**
 * Represents a secret stored within a vault.
 */
export interface VaultSecret {
  /** Unique identifier for the secret within the vault. */
  id: string;
  /** Path to the secret in the vault. */
  path: string;
  /** Display name of the secret. */
  name: string;
  /** Category of the secret. */
  type: SecretType;
  /** Version number of the secret. */
  version: number;
  /** When the secret was created. */
  createdAt: Date;
  /** When the secret was last updated. */
  updatedAt: Date;
  /** When the secret was last accessed. */
  lastAccessed: Date;
  /** Checksum of the secret value. */
  checksum: string;
  /** Size of the secret value in bytes. */
  size: number;
  /** Additional metadata associated with the secret. */
  metadata: Record<string, unknown>;
}

/**
 * Defines access control rules for a specific secret.
 */
export interface AccessControl {
  /** Unique identifier for the access-control entry. */
  id: string;
  /** Identifier of the secret being protected. */
  secretId: string;
  /** Principal (user, group, or service account) granted access. */
  principal: string;
  /** Kind of principal represented by the entry. */
  principalType: 'user' | 'group' | 'service-account' | 'application';
  /** Permissions granted to the principal. */
  permissions: Permission[];
  /** Conditions that must be met for access to be allowed. */
  conditions: AccessCondition[];
  /** Optional expiration timestamp for the access grant. */
  expiresAt?: Date;
  /** When the access was granted. */
  grantedAt: Date;
  /** Principal that granted the access. */
  grantedBy: string;
  /** Justification recorded for granting access. */
  justification: string;
}

/**
 * A single permission granting or denying a specific action on a secret.
 */
export interface Permission {
  /** Action the permission applies to. */
  action: 'read' | 'write' | 'delete' | 'rotate' | 'approve' | 'audit';
  /** Whether the action is allowed. */
  allowed: boolean;
}

/**
 * A condition that must be satisfied for an access-control entry to apply.
 */
export interface AccessCondition {
  /** Kind of condition being evaluated. */
  type: 'time' | 'location' | 'ip' | 'environment' | 'custom';
  /** Comparison operator used to evaluate the condition. */
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'not-in';
  /** Value(s) compared against the condition input. */
  value: string | string[];
}

/**
 * Audit-log entry capturing a secret-related action.
 */
export interface AuditLog {
  /** Unique identifier for the log entry. */
  id: string;
  /** When the action occurred. */
  timestamp: Date;
  /** Action that was performed. */
  action: 'created' | 'read' | 'updated' | 'deleted' | 'rotated' | 'revoked' | 'accessed' | 'denied';
  /** Identifier of the affected secret. */
  secretId: string;
  /** Principal that performed the action. */
  principal: string;
  /** Type of principal that performed the action. */
  principalType: string;
  /** IP address of the principal, if known. */
  ipAddress?: string;
  /** User-agent string of the principal, if known. */
  userAgent?: string;
  /** Geographic or logical location of the principal, if known. */
  location?: string;
  /** Outcome of the action. */
  result: 'success' | 'failure';
  /** Optional reason for the action or its result. */
  reason?: string;
  /** Additional metadata about the event. */
  metadata: Record<string, unknown>;
}

/**
 * Compliance report summarizing adherence to a specific standard.
 */
export interface ComplianceReport {
  /** Unique identifier for the report. */
  id: string;
  /** Human-readable name of the report. */
  name: string;
  /** Description of the report contents. */
  description: string;
  /** Compliance standard evaluated. */
  standard: ComplianceStandard;
  /** Overall compliance status. */
  status: 'compliant' | 'non-compliant' | 'partial' | 'pending';
  /** Compliance score between 0 and 100. */
  score: number;
  /** Individual requirements assessed for the standard. */
  requirements: ComplianceRequirement[];
  /** Number of secrets included in the scan. */
  scannedSecrets: number;
  /** Violations identified during the scan. */
  violations: ComplianceViolation[];
  /** Recommendations for improving compliance. */
  recommendations: string[];
  /** When the scan was last performed. */
  lastScan: Date;
  /** When the next scan is scheduled. */
  nextScan: Date;
}

/** Supported compliance standards used when evaluating secret-management practices. */
export type ComplianceStandard = 'pci-dss' | 'hipaa' | 'gdpr' | 'soc2' | 'nist-800-53' | 'iso-27001' | 'custom';

/**
 * A single requirement within a compliance report.
 */
export interface ComplianceRequirement {
  /** Unique identifier for the requirement. */
  id: string;
  /** Human-readable name of the requirement. */
  name: string;
  /** Description of what the requirement mandates. */
  description: string;
  /** Evaluation result for the requirement. */
  status: 'pass' | 'fail' | 'warning' | 'skip';
  /** Severity of failing this requirement. */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Control identifiers mapped to the requirement. */
  controls: string[];
}

/**
 * A violation of a compliance requirement tied to a specific secret.
 */
export interface ComplianceViolation {
  /** Unique identifier for the violation. */
  id: string;
  /** Identifier of the requirement that was violated. */
  requirementId: string;
  /** Identifier of the secret associated with the violation. */
  secretId: string;
  /** Description of the violation. */
  description: string;
  /** Severity of the violation. */
  severity: string;
  /** Recommended remediation steps. */
  remediation: string;
  /** Current resolution status of the violation. */
  status: 'open' | 'in-progress' | 'resolved' | 'accepted';
}

// Markdown Generation
/**
 * Generates a Markdown document summarizing the secret detection and management configuration.
 *
 * @param config - The secret detection configuration to render.
 * @returns A Markdown string describing the configured secrets, policies, vaults, and reports.
 */
export function generateSecretDetectionMarkdown(config: SecretDetectionConfig): string {
  return `# Secret Detection and Management

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Detection Enabled**: ${config.detectionSettings.enabled ? 'Yes' : 'No'}
**Frequency**: ${config.detectionSettings.frequency}

## Detection Settings

- **Severity Threshold**: ${config.detectionSettings.severityThreshold}
- **Fail On Threshold**: ${config.detectionSettings.failOnThreshold}
- **Entropy Threshold**: ${config.detectionSettings.entropyThreshold}
- **Min Secret Length**: ${config.detectionSettings.minSecretLength}
- **Auto Revoke**: ${config.detectionSettings.autoRevoke}
- **Auto Rotate**: ${config.detectionSettings.autoRotate}
- **Scan Targets**:
  - History: ${config.detectionSettings.scanHistory}
  - Comments: ${config.detectionSettings.scanComments}
  - Code: ${config.detectionSettings.scanCode}
  - Configs: ${config.detectionSettings.scanConfigs}
  - Environment Variables: ${config.detectionSettings.scanEnvVars}
  - Dockerfiles: ${config.detectionSettings.scanDockerfiles}
  - Kubernetes Manifests: ${config.detectionSettings.scanKubernetesManifests}

## Secrets (${config.secrets.length})

${config.secrets.map(secret => `
### ${secret.name}

- **Type**: ${secret.type}
- **Severity**: ${secret.severity}
- **Status**: ${secret.status}
- **Location**: ${secret.location.type} - ${secret.location.path}${secret.location.file ? `/${secret.location.file}:${secret.location.line}` : ''}
- **Detected**: ${secret.detectedAt.toISOString()}
- **Last Rotated**: ${secret.lastRotated.toISOString()}
${secret.expiresAt ? `- **Expires**: ${secret.expiresAt.toISOString()}` : ''}
${secret.rotationPolicyId ? `- **Rotation Policy**: ${secret.rotationPolicyId}` : ''}
${secret.vaultPath ? `- **Vault Path**: ${secret.vaultPath}` : ''}
- **Owner**: ${secret.owner}
${secret.assignedTo ? `- **Assigned To**: ${secret.assignedTo}` : ''}
- **Confidence**: ${(secret.confidence * 100).toFixed(1)}%
- **False Positive**: ${secret.falsePositive}
- **Description**: ${secret.description}
- **Tags**: ${secret.tags.join(', ')}

**References**:
${secret.references.map(ref => `- [${ref.title}](${ref.url})`).join('\n')}
`).join('\n')}

## Rotation Policies (${config.rotationPolicies.length})

${config.rotationPolicies.map(policy => `
### ${policy.name}

- **ID**: ${policy.id}
- **Secret Types**: ${policy.secretTypes.join(', ')}
- **Frequency**: ${policy.frequency}
- **Auto Rotate**: ${policy.autoRotate}
- **Notify Before Rotation**: ${policy.notifyBeforeRotation} (${policy.notificationDays} days)
- **Require Approval**: ${policy.requireApproval}
${policy.approvers.length > 0 ? `- **Approvers**: ${policy.approvers.join(', ')}` : ''}
- **Rotation Window**: ${policy.rotationWindow.start} - ${policy.rotationWindow.end} (${policy.rotationWindow.timezone})
- **Max Rotation Time**: ${policy.maxRotationTime} minutes
- **Retry on Failure**: ${policy.retryOnFailure} (Max: ${policy.maxRetries}, Interval: ${policy.retryInterval} min)
- **Rollback on Failure**: ${policy.rollbackOnFailure}
- **Encryption**: ${policy.algorithm} (${policy.keyLength} bits)
- **Active**: ${policy.isActive}
${policy.lastRotated ? `- **Last Rotated**: ${policy.lastRotated.toISOString()}` : ''}
${policy.nextRotation ? `- **Next Rotation**: ${policy.nextRotation.toISOString()}` : ''}
- **Created**: ${policy.createdAt.toISOString()}
- **Updated**: ${policy.updatedAt.toISOString()}
`).join('\n')}

## Vault Integrations (${config.vaultIntegrations.length})

${config.vaultIntegrations.map(vault => `
### ${vault.name}

- **Provider**: ${vault.provider}
- **Status**: ${vault.status}
- **Endpoint**: ${vault.config.endpoint}
${vault.config.namespace ? `- **Namespace**: ${vault.config.namespace}` : ''}
- **Engine**: ${vault.config.engine} (${vault.config.engineVersion})
- **Auth Method**: ${vault.auth.method}
- **Secrets**: ${vault.secrets.length}
- **Last Sync**: ${vault.lastSync.toISOString()}
${vault.errorMessage ? `- **Error**: ${vault.errorMessage}` : ''}
`).join('\n')}

## Access Controls (${config.accessControls.length})

${config.accessControls.map(ac => `
### ${ac.id}

- **Secret ID**: ${ac.secretId}
- **Principal**: ${ac.principal} (${ac.principalType})
- **Permissions**:
${ac.permissions.map(p => `  - ${p.action}: ${p.allowed ? 'Allowed' : 'Denied'}`).join('\n')}
${ac.conditions.length > 0 ? `- **Conditions**: ${ac.conditions.length}` : ''}
${ac.expiresAt ? `- **Expires**: ${ac.expiresAt.toISOString()}` : ''}
- **Granted**: ${ac.grantedAt.toISOString()} by ${ac.grantedBy}
`).join('\n')}

## Audit Logs (${config.auditLogs.length})

Recent activity:
${config.auditLogs.slice(0, 10).map(log => `
- **${log.timestamp.toISOString()}** - ${log.action.toUpperCase()}: ${log.secretId} by ${log.principal} (${log.result})
`).join('\n')}

## Compliance Reports (${config.complianceReports.length})

${config.complianceReports.map(report => `
### ${report.name}

- **Standard**: ${report.standard}
- **Status**: ${report.status}
- **Score**: ${report.score}/100
- **Requirements**: ${report.requirements.length} (${report.requirements.filter(r => r.status === 'pass').length} passed)
- **Violations**: ${report.violations.length}
- **Recommendations**: ${report.recommendations.length}
- **Last Scan**: ${report.lastScan.toISOString()}
`).join('\n')}
`;
}

// Terraform Generation
/**
 * Generates Terraform infrastructure code for provisioning a vault/secret store for the given provider.
 *
 * @param config - The secret detection configuration describing the project and secrets.
 * @param provider - The cloud provider to generate Terraform for.
 * @returns A Terraform-formatted string provisioning the provider's secrets manager.
 */
export function generateVaultTerraform(config: SecretDetectionConfig, provider: 'aws' | 'azure' | 'gcp'): string {

  return `# Secret Detection and Management - ${provider.toUpperCase()}
# Generated at: ${new Date().toISOString()}

provider "${provider}" {
  region = "${provider === 'aws' ? 'us-east-1' : provider === 'azure' ? 'eastus' : 'us-central1'}"
}

${provider === 'aws' ? `
# AWS Secrets Manager
resource "aws_secretsmanager_secret" "${config.projectName}_vault" {
  name = "${config.projectName}-vault"
  description = "Secret vault for ${config.projectName}"

  kms_key_id = aws_kms_key.secret_key.arn

  tags = {
    Name = "${config.projectName}"
    Project = "${config.projectName}"
  }
}

resource "aws_kms_key" "secret_key" {
  description = "KMS key for ${config.projectName} secrets"
  enable_key_rotation = true

  tags = {
    Name = "${config.projectName}"
  }
}

resource "aws_iam_role" "vault_role" {
  name = "${config.projectName}-vault-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "vault_policy" {
  name = "${config.projectName}-vault-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:CreateSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:DeleteSecret",
          "secretsmanager:RotateSecret"
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:${config.projectName}/*"
      }
    ]
  })
}

` : provider === 'azure' ? `
# Azure Key Vault
resource "azurerm_key_vault" "${config.projectName}_vault" {
  name                = "${config.projectName.replace(/-/g, '')}-vault"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "premium"

  enable_soft_delete       = true
  soft_delete_retention_days = 90
  enable_purge_protection  = true

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get",
      "List",
      "Set",
      "Delete",
      "Recover",
      "Backup",
      "Restore"
    ]
  }

  tags = {
    Name = "${config.projectName}"
    Project = "${config.projectName}"
  }
}

resource "azurerm_key_vault_secret" "example" {
  name         = "example-secret"
  value        = "SecretValue"
  key_vault_id = azurerm_key_vault.${config.projectName}_vault.id
}

` : `
# GCP Secret Manager
resource "google_secret_manager_secret" "${config.projectName}_vault" {
  secret_id = "${config.projectName}-vault"

  replication {
    automatic = true
  }

  labels = {
    project = "${config.projectName}"
  }
}

resource "google_secret_manager_secret_version" "${config.projectName}_vault_version" {
  secret = google_secret_manager_secret.${config.projectName}_vault.id
  secret_data = "secret-value"

  annotations = {
    built-by = "terraform"
  }
}

resource "google_iam_policy" "secret_iam" {
  policy_data = data.google_iam_policy.secret_policy.policy_data
  secret_id   = google_secret_manager_secret.${config.projectName}_vault.id
}
`}
`;
}

// TypeScript Manager Generation
/**
 * Generates a TypeScript secret-detection manager module based on the provided configuration.
 *
 * @param config - The secret detection configuration used to template the manager.
 * @returns A TypeScript source string containing a `SecretDetectionManager` class and related types.
 */
export function generateSecretManagerTypeScript(config: SecretDetectionConfig): string {
  return `// Auto-generated Secret Detection and Management Manager
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';

interface Secret {
  id: string;
  name: string;
  type: string;
  severity: string;
  status: string;
  location: {
    type: string;
    path: string;
    file?: string;
    line?: number;
  };
  valueHash: string;
  detectedAt: Date;
  lastRotated: Date;
  expiresAt?: Date;
  rotationPolicyId?: string;
  vaultPath?: string;
  owner: string;
  confidence: number;
  falsePositive: boolean;
}

interface RotationPolicy {
  id: string;
  name: string;
  secretTypes: string[];
  frequency: string;
  autoRotate: boolean;
  requireApproval: boolean;
  approvers: string[];
  rotationWindow: {
    start: string;
    end: string;
    timezone: string;
  };
  isActive: boolean;
}

class SecretDetectionManager extends EventEmitter {
  private secrets: Map<string, Secret> = new Map();
  private rotationPolicies: Map<string, RotationPolicy> = new Map();
  private config: any;

  constructor(options: Record<string, unknown> = {}) {
    super();
    this.config = options;
  }

  async scanRepository(repoPath: string): Promise<Secret[]> {
    const secrets: Secret[] = [
      {
        id: 'secret-001',
        name: 'AWS Access Key',
        type: 'api-key',
        severity: 'critical',
        status: 'active',
        location: {
          type: 'file',
          path: repoPath,
          file: 'config/credentials.yml',
          line: 15,
        },
        valueHash: 'ab123cd456ef789',
        detectedAt: new Date(),
        lastRotated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        rotationPolicyId: 'policy-001',
        vaultPath: 'secret/aws/access-key',
        owner: 'DevOps Team',
        confidence: 0.95,
        falsePositive: false,
      },
      {
        id: 'secret-002',
        name: 'Database Password',
        type: 'password',
        severity: 'high',
        status: 'active',
        location: {
          type: 'environment',
          path: '.env',
        },
        valueHash: 'xyz789abc456def',
        detectedAt: new Date(),
        lastRotated: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        rotationPolicyId: 'policy-002',
        vaultPath: 'secret/database/password',
        owner: 'DBA Team',
        confidence: 0.88,
        falsePositive: false,
      },
    ];

    secrets.forEach(s => this.secrets.set(s.id, s));
    this.emit('secrets-detected', secrets);

    return secrets;
  }

  async rotateSecret(secretId: string, force: boolean = false): Promise<unknown> {
    const secret = this.secrets.get(secretId);
    if (!secret) {
      throw new Error(\`Secret \${secretId} not found\`);
    }

    const rotationResult = {
      secretId,
      status: 'success',
      rotatedAt: new Date(),
      newValueHash: 'new-hash-value',
      previousValueHash: secret.valueHash,
      rotatedBy: 'system',
    };

    secret.lastRotated = new Date();
    secret.valueHash = rotationResult.newValueHash;

    this.emit('secret-rotated', rotationResult);

    return rotationResult;
  }

  async revokeSecret(secretId: string, reason: string): Promise<unknown> {
    const secret = this.secrets.get(secretId);
    if (!secret) {
      throw new Error(\`Secret \${secretId} not found\`);
    }

    secret.status = 'revoked';

    this.emit('secret-revoked', { secretId, reason, timestamp: new Date() });

    return { secretId, status: 'revoked', reason };
  }

  async checkRotationPolicies(): Promise<any[]> {
    const due: any[] = [];

    for (const [id, policy] of this.rotationPolicies) {
      if (policy.autoRotate && policy.isActive) {
        due.push({
          policyId: id,
          policyName: policy.name,
          dueDate: new Date(),
          secretsAffected: Array.from(this.secrets.values())
            .filter(s => policy.secretTypes.includes(s.type))
            .map(s => s.id),
        });
      }
    }

    return due;
  }

  async getComplianceReport(standard: string): Promise<unknown> {
    const report = {
      standard,
      status: 'compliant',
      score: 92,
      requirements: [
        { id: 'req-1', name: 'Secret Encryption', status: 'pass' },
        { id: 'req-2', name: 'Rotation Policy', status: 'pass' },
        { id: 'req-3', name: 'Access Control', status: 'warning' },
      ],
      violations: [],
      recommendations: [
        'Implement automatic rotation for high-severity secrets',
        'Enable MFA for secret access',
      ],
      scannedAt: new Date(),
    };

    return report;
  }
}

export { SecretDetectionManager, Secret, RotationPolicy };
`;
}

// Python Manager Generation
/**
 * Generates a Python secret-detection manager module based on the provided configuration.
 *
 * @param config - The secret detection configuration used to template the manager.
 * @returns A Python source string containing a `SecretDetectionManager` class and related data classes.
 */
export function generateSecretManagerPython(config: SecretDetectionConfig): string {
  return `# Auto-generated Secret Detection and Management Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

class SecretType(Enum):
    API_KEY = "api-key"
    PASSWORD = "password"
    TOKEN = "token"
    CERTIFICATE = "certificate"
    SSH_KEY = "ssh-key"
    DATABASE_URL = "database-url"

class SecretSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class SecretStatus(Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    ROTATED = "rotated"

@dataclass
class SecretLocation:
    type: str
    path: str
    file: Optional[str] = None
    line: Optional[int] = None

@dataclass
class Secret:
    id: str
    name: str
    type: str
    severity: str
    status: str
    location: SecretLocation
    value_hash: str
    detected_at: datetime
    last_rotated: datetime
    expires_at: Optional[datetime] = None
    rotation_policy_id: Optional[str] = None
    vault_path: Optional[str] = None
    owner: str = ""
    confidence: float = 0.0
    false_positive: bool = False

@dataclass
class RotationPolicy:
    id: str
    name: str
    secret_types: List[str]
    frequency: str
    auto_rotate: bool
    require_approval: bool
    approvers: List[str]
    is_active: bool

class SecretDetectionManager:
    def __init__(self, project_name: str = 'SecretDetection'):
        self.project_name = project_name
        self.secrets: Dict[str, Secret] = {}
        self.rotation_policies: Dict[str, RotationPolicy] = {}

    async def scan_repository(self, repo_path: str) -> List[Secret]:
        secret = Secret(
            id='secret-001',
            name='API Key',
            type='api-key',
            severity='critical',
            status='active',
            location=SecretLocation(
                type='file',
                path=repo_path,
                file='config.yml',
                line=42
            ),
            value_hash='abc123',
            detected_at=datetime.now(),
            last_rotated=datetime.now() - timedelta(days=30),
        )

        self.secrets[secret.id] = secret
        return [secret]

    async def rotate_secret(self, secret_id: str) -> Dict[str, Any]:
        if secret_id not in self.secrets:
            raise ValueError(f"Secret {secret_id} not found")

        secret = self.secrets[secret_id]
        secret.last_rotated = datetime.now()
        secret.status = 'rotated'

        return {
            'secretId': secret_id,
            'status': 'success',
            'rotatedAt': datetime.now(),
        }

    async def revoke_secret(self, secret_id: str, reason: str) -> Dict[str, Any]:
        if secret_id not in self.secrets:
            raise ValueError(f"Secret {secret_id} not found")

        secret = self.secrets[secret_id]
        secret.status = 'revoked'

        return {'secretId': secret_id, 'status': 'revoked', 'reason': reason}
`;
}

// Write Files
/**
 * Writes secret-detection documentation, infrastructure, and manager files to disk.
 *
 * @param config - The secret detection configuration to generate files from.
 * @param outputDir - Directory where generated files will be written.
 * @param language - Target language for the generated manager module.
 * @returns A promise that resolves once all files have been written.
 */
export async function writeSecretDetectionFiles(
  config: SecretDetectionConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  await fs.writeFile(
    path.join(outputDir, 'SECRET_DETECTION.md'),
    generateSecretDetectionMarkdown(config)
  );

  // Write Terraform configs for each provider
  for (const provider of config.providers) {
    const tfContent = generateVaultTerraform(config, provider);
    await fs.writeFile(
      path.join(outputDir, `secret-detection-${provider}.tf`),
      tfContent
    );
  }

  // Write manager code
  if (language === 'typescript') {
    const tsContent = generateSecretManagerTypeScript(config);
    await fs.writeFile(path.join(outputDir, 'secret-detection-manager.ts'), tsContent);

    // Write package.json
    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'Secret Detection and Management',
      main: 'secret-detection-manager.ts',
      scripts: {
        start: 'ts-node secret-detection-manager.ts',
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
    const pyContent = generateSecretManagerPython(config);
    await fs.writeFile(path.join(outputDir, 'secret_detection_manager.py'), pyContent);

    // Write requirements.txt
    const requirements = [
      'pydantic>=2.0.0',
      'python-dotenv>=1.0.0',
    ];
    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      requirements.join('\n')
    );
  }

  // Write config JSON
  await fs.writeFile(
    path.join(outputDir, 'secret-detection-config.json'),
    JSON.stringify(config, null, 2)
  );
}

/**
 * Prints a concise summary of the secret detection configuration to the console.
 *
 * @param config - The secret detection configuration to display.
 */
export function displaySecretDetectionConfig(config: SecretDetectionConfig): void {
  console.log(chalk.cyan('🔐 Secret Detection and Management'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow(`Project Name:`), chalk.white(config.projectName));
  console.log(chalk.yellow(`Providers:`), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow(`Detection Enabled:`), chalk.white(config.detectionSettings.enabled ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Frequency:`), chalk.white(config.detectionSettings.frequency));
  console.log(chalk.yellow(`Secrets:`), chalk.cyan(config.secrets.length));
  console.log(chalk.yellow(`Rotation Policies:`), chalk.cyan(config.rotationPolicies.length));
  console.log(chalk.yellow(`Vault Integrations:`), chalk.cyan(config.vaultIntegrations.length));
  console.log(chalk.gray('─'.repeat(60)));
}
