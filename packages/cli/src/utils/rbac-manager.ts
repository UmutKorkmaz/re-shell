// RBAC and Access Control Manager with Fine-Grained Permissions

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions
/** Actions that can be granted or denied by a permission. */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve' | 'admin' | 'custom';
/** Categories of resources that can be governed by RBAC policies. */
export type ResourceTypeRBAC = 'users' | 'roles' | 'permissions' | 'policies' | 'services' | 'resources' | 'audit-logs' | 'settings' | 'api-keys' | 'custom';
/** The outcome of a permission or policy statement. */
export type Effect = 'allow' | 'deny';
/** Lifecycle state of a role. */
export type RoleStatus = 'active' | 'inactive' | 'deprecated' | 'pending-approval';
/** Lifecycle state of a permission grant. */
export type PermissionStatus = 'granted' | 'revoked' | 'pending' | 'expired' | 'denied';
/** Lifecycle state of a role assignment to a user. */
export type AssignmentStatus = 'active' | 'inactive' | 'expired' | 'revoked' | 'pending';

/** Root configuration object describing a project's RBAC setup. */
export interface RBACConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: RBACSettings;
  roles: Role[];
  permissions: Permission[];
  policies: AccessPolicy[];
  assignments: RoleAssignment[];
  groups: Group[];
  resourceHierarchy: ResourceNode[];
  auditLogs: AuditLog[];
}

/** Global RBAC feature toggles and tunable settings. */
export interface RBACSettings {
  enableFineGrained: boolean;
  defaultDenyAll: boolean;
  requireMFAForAdmin: boolean;
  enableSessionTimeout: boolean;
  sessionTimeoutMinutes: number;
  enablePermissionCaching: boolean;
  cacheTTLMinutes: number;
  enableAuditLogging: boolean;
  logRetentionDays: number;
  enableDynamicPermissions: boolean;
  enableRoleHierarchy: boolean;
  maxRoleDepth: number;
  enableTemporaryAccess: boolean;
  temporaryAccessMaxHours: number;
  enableIPRestrictions: boolean;
  enableTimeRestrictions: boolean;
  enableContextAwareAccess: boolean;
}

/** Represents a role that can be assigned to users and groups. */
export interface Role {
  id: string;
  name: string;
  description: string;
  status: RoleStatus;
  isSystemRole: boolean;
  isCustomizable: boolean;
  priority: number;
  inheritsFrom?: string; // parent role ID for hierarchy
  permissions: string[]; // permission IDs
  scopedPermissions: ScopedPermission[];
  conditions: RoleCondition[];
  metadata: RoleMetadata;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** A permission scoped to a specific scope with resource filters and conditions. */
export interface ScopedPermission {
  permissionId: string;
  scope: PermissionScope;
  resourceFilters: ResourceFilter[];
  conditions: PermissionCondition[];
  effect: Effect;
}

/** Defines the organizational scope at which a permission applies. */
export interface PermissionScope {
  type: 'global' | 'organization' | 'department' | 'project' | 'resource' | 'custom';
  value?: string;
}

/** A field-based filter used to narrow the resources a permission applies to. */
export interface ResourceFilter {
  field: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'regex' | 'in' | 'not-in';
  value: any;
}

/** A condition that must hold for a permission to be granted. */
export interface PermissionCondition {
  type: 'ip' | 'time' | 'context' | 'custom';
  field: string;
  operator: string;
  value: any;
  negate?: boolean;
}

/** A condition that must hold for a role assignment to be active. */
export interface RoleCondition {
  type: 'attribute' | 'context' | 'time' | 'location' | 'custom';
  field: string;
  operator: string;
  value: any;
  required: boolean;
}

/** Metadata describing a role's risk, compliance, and review requirements. */
export interface RoleMetadata {
  category: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  complianceReferences: string[];
  approvalRequired: boolean;
  approvers: string[];
  reviewInterval: number; // days
  lastReviewed: Date;
  nextReviewDate: Date;
  version: string;
  changeHistory: RoleChange[];
  documentation: string;
  rationale: string;
}

/** A single entry in a role's change history. */
export interface RoleChange {
  timestamp: Date;
  user: string;
  action: 'created' | 'updated' | 'deprecated' | 'permissions-changed' | 'reactivated';
  reason: string;
  previousValue?: any;
  newValue?: any;
}

/** Represents a permission governing actions on a resource. */
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: ResourceTypeRBAC;
  actions: PermissionAction[];
  effect: Effect;
  isSystemPermission: boolean;
  constraints: PermissionConstraint[];
  status: PermissionStatus;
  metadata: PermissionMetadata;
  createdAt: Date;
  expiresAt?: Date;
}

/** A constraint that limits how a permission may be exercised. */
export interface PermissionConstraint {
  type: 'ip-range' | 'time-window' | 'rate-limit' | 'data-limit' | 'location' | 'mfa' | 'custom';
  config: Record<string, unknown>;
  enforce: boolean;
}

/** Metadata describing a permission's sensitivity and approval requirements. */
export interface PermissionMetadata {
  category: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  complianceRequirements: string[];
  riskScore: number; // 0-100
  requiresApproval: boolean;
  approvers: string[];
}

/** A named policy composed of statements that govern access decisions. */
export interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'draft';
  priority: number;
  statements: PolicyStatement[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  metadata: PolicyMetadata;
}

/** A single statement within an access policy. */
export interface PolicyStatement {
  id: string;
  effect: Effect;
  principals: Principal[];
  actions: PermissionAction[];
  resources: ResourcePattern[];
  conditions: PolicyCondition[];
  overrideEffect?: boolean; // allow this statement to override deny
}

/** Identifies a principal (user, group, role, service, etc.) in a policy statement. */
export interface Principal {
  type: 'user' | 'group' | 'role' | 'service' | 'anonymous';
  id: string;
  conditions?: PrincipalCondition[];
}

/** A condition that must hold for a principal in a policy statement. */
export interface PrincipalCondition {
  type: 'attribute' | 'auth-method' | 'mfa' | 'session-age' | 'custom';
  field: string;
  operator: string;
  value: any;
}

/** A pattern describing a set of resources targeted by a policy statement. */
export interface ResourcePattern {
  type: 'exact' | 'prefix' | 'wildcard' | 'regex';
  pattern: string;
}

/** A condition under which a policy statement applies. */
export interface PolicyCondition {
  type: 'string' | 'numeric' | 'boolean' | 'ip' | 'time' | 'custom';
  operator: string;
  key: string;
  value: any;
  negate?: boolean;
}

/** Metadata describing ownership, risk, and history of a policy. */
export interface PolicyMetadata {
  description: string;
  owner: string;
  tags: string[];
  complianceReferences: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  changeHistory: PolicyChange[];
}

/** A single entry in a policy's change history. */
export interface PolicyChange {
  timestamp: Date;
  user: string;
  action: string;
  reason: string;
}

/** Represents an assignment of a role to a user, possibly temporary. */
export interface RoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  status: AssignmentStatus;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  conditions?: AssignmentCondition[];
  context?: AssignmentContext;
  justification?: string;
  isTemporary: boolean;
  temporaryDurationHours?: number;
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

/** A condition attached to a role assignment. */
export interface AssignmentCondition {
  type: 'time' | 'location' | 'context' | 'custom';
  field: string;
  operator: string;
  value: any;
}

/** Context describing how a role assignment originated. */
export interface AssignmentContext {
  source: 'direct' | 'group-inheritance' | 'role-hierarchy' | 'approval';
  reason: string;
  requestId?: string;
  ticketId?: string;
}

/** Represents a group of users that may share roles. */
export interface Group {
  id: string;
  name: string;
  description: string;
  type: 'department' | 'team' | 'project' | 'custom';
  status: 'active' | 'inactive' | 'archived';
  members: string[]; // user IDs
  roles: string[]; // role IDs
  inheritsFrom?: string[]; // parent group IDs
  owners: string[];
  metadata: GroupMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/** Metadata describing a group's organization and sync status. */
export interface GroupMetadata {
  category: string;
  department?: string;
  costCenter?: string;
  location?: string;
  externalSync: boolean;
  syncSource?: string;
  lastSyncedAt?: Date;
}

/** A node in the resource hierarchy tree. */
export interface ResourceNode {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  path: string;
  permissions: string[]; // inherited permissions
  children: string[]; // child node IDs
  metadata: ResourceMetadata;
}

/** Metadata describing ownership and classification of a resource. */
export interface ResourceMetadata {
  owner: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  tags: string[];
  complianceRequirements: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** A single audit log entry recording an access decision. */
export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  resourceType: string;
  outcome: 'allowed' | 'denied' | 'error';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionContext?: SessionContext;
  policyEvaluated?: string; // policy ID
  rolesUsed?: string[]; // role IDs
  permissionsChecked?: string[]; // permission IDs
  details?: Record<string, unknown>;
}

/** Information about the session in which an audited action occurred. */
export interface SessionContext {
  sessionId: string;
  mfaVerified: boolean;
  sessionAge: number;
  loginTime: Date;
  lastActivity: Date;
}

// Markdown Generation
/**
 * Generates a Markdown report summarizing the RBAC configuration.
 * @param config - The RBAC configuration to document.
 * @returns A Markdown string describing roles, permissions, policies, and audit logs.
 */
export function generateRBACMarkdown(config: RBACConfig): string {
  return `# RBAC and Access Control Management

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Fine-Grained Permissions**: ${config.settings.enableFineGrained ? 'Enabled' : 'Disabled'}
**Default Deny All**: ${config.settings.defaultDenyAll ? 'Yes' : 'No'}

## RBAC Settings

- **Fine-Grained Permissions**: ${config.settings.enableFineGrained}
- **Default Deny All**: ${config.settings.defaultDenyAll}
- **MFA Required for Admin**: ${config.settings.requireMFAForAdmin}
- **Session Timeout**: ${config.settings.sessionTimeoutMinutes} minutes
- **Permission Caching**: ${config.settings.enablePermissionCaching} (${config.settings.cacheTTLMinutes}min TTL)
- **Audit Logging**: ${config.settings.enableAuditLogging} (${config.settings.logRetentionDays} days retention)
- **Role Hierarchy**: ${config.settings.enableRoleHierarchy} (max depth: ${config.settings.maxRoleDepth})
- **Temporary Access**: ${config.settings.enableTemporaryAccess} (max: ${config.settings.temporaryAccessMaxHours} hours)

## Roles (${config.roles.length})

${config.roles.slice(0, 5).map(role => `
### ${role.name} - ${role.status.toUpperCase()}

- **ID**: ${role.id}
- **Description**: ${role.description}
- **Priority**: ${role.priority}
- **System Role**: ${role.isSystemRole ? 'Yes' : 'No'}
- **Inherits From**: ${role.inheritsFrom || 'None'}
- **Risk Level**: ${role.metadata.riskLevel}
- **Permissions**: ${role.permissions.length} granted
- **Scoped Permissions**: ${role.scopedPermissions.length}
${role.tags.length > 0 ? `- **Tags**: ${role.tags.join(', ')}` : ''}
`).join('')}

${config.roles.length > 5 ? `
*... and ${config.roles.length - 5} more roles*
` : ''}

## Permissions (${config.permissions.length})

${config.permissions.slice(0, 5).map(perm => `
### ${perm.name}

- **Resource**: ${perm.resource}
- **Actions**: ${perm.actions.join(', ')}
- **Effect**: ${perm.effect}
- **Status**: ${perm.status}
- **System Permission**: ${perm.isSystemPermission ? 'Yes' : 'No'}
- **Constraints**: ${perm.constraints.length}
`).join('')}

${config.permissions.length > 5 ? `
*... and ${config.permissions.length - 5} more permissions*
` : ''}

## Access Policies (${config.policies.length})

${config.policies.slice(0, 3).map(policy => `
### ${policy.name} - ${policy.status.toUpperCase()}

- **Priority**: ${policy.priority}
- **Statements**: ${policy.statements.length}
- **Version**: ${policy.version}
- **Effective**: ${policy.effectiveFrom.toISOString()} ${policy.effectiveUntil ? 'to ' + policy.effectiveUntil.toISOString() : ''}
`).join('')}

## Role Assignments (${config.assignments.length})

${config.assignments.slice(0, 5).map(assign => `
- **${assign.userId}** → **${assign.roleId}** (${assign.status}${assign.isTemporary ? ', temporary' : ''})
`).join('')}

## Groups (${config.groups.length})

${config.groups.slice(0, 3).map(group => `
### ${group.name} (${group.type})

- **Members**: ${group.members.length}
- **Roles**: ${group.roles.length}
- **Owners**: ${group.owners.join(', ')}
`).join('')}

## Resource Hierarchy (${config.resourceHierarchy.length} nodes)

${config.resourceHierarchy.slice(0, 5).map(node => `
- **${node.name}** (${node.type}) - ${node.path}
`).join('')}

## Audit Logs (${config.auditLogs.length} entries)

${config.auditLogs.slice(0, 5).map(log => `
- [${log.timestamp.toISOString()}] **${log.userId}** ${log.action} on ${log.resource} - ${log.outcome}
`).join('')}
`;
}

// Terraform Generation for AWS
/**
 * Generates Terraform configuration for deploying RBAC resources to AWS.
 * @param config - The RBAC configuration to deploy.
 * @returns A Terraform (HCL) string provisioning IAM roles, policies, and audit log storage.
 */
export function generateRBACTerraformAWS(config: RBACConfig): string {
  return `# Terraform configuration for RBAC on AWS
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

# IAM Roles for RBAC
${config.roles.map(role => `
resource "aws_iam_role" "${role.id}" {
  name = "${role.id}"

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

  tags = {
    Name        = "${role.name}"
    Priority    = "${role.priority}"
    RiskLevel   = "${role.metadata.riskLevel}"
    Environment = "${config.projectName}"
  }
}
`).join('\n')}

# IAM Policies for Permissions
${config.permissions.map(perm => `
resource "aws_iam_policy" "${perm.id}" {
  name        = "${perm.id}"
  description = "${perm.description}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "${perm.effect}"
        Action = ${JSON.stringify(perm.actions.map(a => `${perm.resource}:${a}`))}
        Resource = "*"
      }
    ]
  })
}
`).join('\n')}

# Policy Attachments
${config.assignments.map(assign => `
resource "aws_iam_role_policy_attachment" "${assign.id}" {
  role       = "${assign.roleId}"
  policy_arn = aws_iam_policy.${assign.roleId}.arn
}
`).join('\n')}

# S3 Bucket for Audit Logs
resource "aws_s3_bucket" "rbac_audit_logs" {
  bucket = "${config.projectName}-rbac-audit-logs"

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

  lifecycle_rule {
    id      = "audit-log-retention"
    enabled = true

    expiration {
      days = ${config.settings.logRetentionDays}
    }
  }

  tags = {
    Purpose = "RBAC Audit Logging"
    Environment = "${config.projectName}"
  }
}

# CloudWatch Log Group for Audit Logs
resource "aws_cloudwatch_log_group" "rbac_audit" {
  name              = "/aws/rbac/${config.projectName}"
  retention_in_days = ${config.settings.logRetentionDays}

  tags = {
    Purpose = "RBAC Audit Logging"
    Environment = "${config.projectName}"
  }
}
`;
}

// Terraform Generation for Azure
/**
 * Generates Terraform configuration for deploying RBAC resources to Azure.
 * @param config - The RBAC configuration to deploy.
 * @returns A Terraform (HCL) string provisioning role definitions, assignments, and audit log storage.
 */
export function generateRBACTerraformAzure(config: RBACConfig): string {
  return `# Terraform configuration for RBAC on Azure
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
resource "azurerm_resource_group" "rbac" {
  name     = "${config.projectName}-rbac"
  location = "East US"
}

# Role Definitions
${config.roles.map(role => `
resource "azurerm_role_definition" "${role.id}" {
  name        = "${role.name}"
  scope       = azurerm_resource_group.rbac.id
  description = "${role.description}"

  permissions {
    actions = ${JSON.stringify(role.permissions.flatMap(p => {
      const perm = config.permissions.find(perm => perm.id === p);
      return perm ? perm.actions.map(a => `${perm.resource}/${a}`) : [];
    })), [] as string[]}

    not_actions = []
  }

  assignable_scopes = [
    azurerm_resource_group.rbac.id
  ]
}
`).join('\n')}

# Role Assignments
${config.assignments.map(assign => `
resource "azurerm_role_assignment" "${assign.id}" {
  name             = "${assign.id}"
  scope            = azurerm_resource_group.rbac.id
  role_definition_id = "\${azurerm_role_definition.${assign.roleId}.role_definition_resource_id}"
  principal_id     = "${assign.userId}"
}
`).join('\n')}

# Storage Account for Audit Logs
resource "azurerm_storage_account" "audit_logs" {
  name                     = "${config.projectName.replace(/-/g, '')}auditlogs"
  resource_group_name      = azurerm_resource_group.rbac.name
  location                 = azurerm_resource_group.rbac.location
  account_tier             = "Standard"
  account_replication_type = "GRS"

  blob_properties {
    versioning_enabled = true
  }

  tags = {
    Purpose = "RBAC Audit Logging"
    Environment = "${config.projectName}"
  }
}
`;
}

// TypeScript Manager Generation
/**
 * Generates a TypeScript RBACManager class source file from the configuration.
 * @param config - The RBAC configuration to materialize into TypeScript code.
 * @returns A TypeScript source string implementing the RBAC manager.
 */
export function generateRBACTypeScriptManager(config: RBACConfig): string {
  return `// Auto-generated RBAC Manager
// Generated at: ${new Date().toISOString()}

import { v4 as uuidv4 } from 'uuid';

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  APPROVE = 'approve',
  ADMIN = 'admin'
}

export enum Effect {
  ALLOW = 'allow',
  DENY = 'deny'
}

export enum RoleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  PENDING_APPROVAL = 'pending-approval'
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  actions: PermissionAction[];
  effect: Effect;
  status: string;
}

export interface Role {
  id: string;
  name: string;
  status: RoleStatus;
  permissions: string[];
  inheritsFrom?: string;
  priority: number;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: PermissionAction;
  context?: Record<string, unknown>;
}

export interface AccessDecision {
  allowed: boolean;
  effect: Effect;
  matchedPolicies: string[];
  deniedReasons: string[];
  roles?: string[];
  permissions?: string[];
}

export class RBACManager {
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private userRoles: Map<string, Set<string>> = new Map();
  private roleHierarchy: Map<string, Set<string>> = new Map();
  private permissionCache: Map<string, AccessDecision> = new Map();
  private cacheTimeout: number = ${config.settings.cacheTTLMinutes * 60 * 1000};

  constructor() {
    this.initializeDefaultRoles();
    this.buildRoleHierarchy();
  }

  private initializeDefaultRoles(): void {
    ${config.roles.slice(0, 3).map(role => `
    this.roles.set('${role.id}', {
      id: '${role.id}',
      name: '${role.name}',
      status: RoleStatus.${role.status.toUpperCase().replace(/-/g, '_') as RoleStatus},
      permissions: [${role.permissions.map(p => `'${p}'`).join(', ')}],
      inheritsFrom: ${role.inheritsFrom ? `'${role.inheritsFrom}'` : 'undefined'},
      priority: ${role.priority}
    });`).join('\n    ')}
  }

  private buildRoleHierarchy(): void {
    for (const role of this.roles.values()) {
      if (role.inheritsFrom) {
        if (!this.roleHierarchy.has(role.id)) {
          this.roleHierarchy.set(role.id, new Set());
        }
        this.roleHierarchy.get(role.id)!.add(role.inheritsFrom);
      }
    }
  }

  assignRole(userId: string, roleId: string): void {
    if (!this.roles.has(roleId)) {
      throw new Error(\`Role \${roleId} not found\`);
    }

    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }

    this.userRoles.get(userId)!.add(roleId);
    this.invalidateCache(userId);
  }

  revokeRole(userId: string, roleId: string): void {
    const userRoles = this.userRoles.get(userId);
    if (userRoles) {
      userRoles.delete(roleId);
      this.invalidateCache(userId);
    }
  }

  getUserRoles(userId: string): string[] {
    const directRoles = Array.from(this.userRoles.get(userId) || []);
    const allRoles = new Set<string>(directRoles);

    // Include inherited roles
    for (const roleId of directRoles) {
      this.getInheritedRoles(roleId, allRoles, new Set());
    }

    return Array.from(allRoles);
  }

  private getInheritedRoles(
    roleId: string,
    collected: Set<string>,
    visited: Set<string>
  ): void {
    if (visited.has(roleId) || !this.roleHierarchy.has(roleId)) {
      return;
    }

    visited.add(roleId);

    for (const parentId of this.roleHierarchy.get(roleId)!) {
      if (this.roles.has(parentId)) {
        collected.add(parentId);
        this.getInheritedRoles(parentId, collected, visited);
      }
    }
  }

  async checkAccess(request: AccessRequest): Promise<AccessDecision> {
    const cacheKey = this.getCacheKey(request);
    const cached = this.permissionCache.get(cacheKey);

    if (cached && Date.now() - (cached as AccessDecision & { timestamp?: number }).timestamp < this.cacheTimeout) {
      return cached;
    }

    const userRoles = this.getUserRoles(request.userId);
    const matchedPolicies: string[] = [];
    const deniedReasons: string[] = [];

    if (userRoles.length === 0) {
      return {
        allowed: false,
        effect: Effect.DENY,
        matchedPolicies: [],
        deniedReasons: ['User has no assigned roles']
      };
    }

    let hasAllow = false;
    let hasDeny = false;

    for (const roleId of userRoles) {
      const role = this.roles.get(roleId);
      if (!role || role.status !== RoleStatus.ACTIVE) continue;

      for (const permId of role.permissions) {
        const permission = this.permissions.get(permId);
        if (!permission || permission.status !== 'granted') continue;

        if (this.matchesResource(request.resource, permission.resource) &&
            permission.actions.includes(request.action)) {

          matchedPolicies.push(permission.id);

          if (permission.effect === Effect.ALLOW) {
            hasAllow = true;
          } else {
            hasDeny = true;
            deniedReasons.push(\`Denied by permission \${permission.name}\`);
          }
        }
      }
    }

    const decision: AccessDecision = {
      allowed: ${config.settings.defaultDenyAll ? 'hasAllow && !hasDeny' : '!hasDeny'},
      effect: hasDeny ? Effect.DENY : Effect.ALLOW,
      matchedPolicies,
      deniedReasons,
      roles: userRoles,
      permissions: matchedPolicies
    };

    (decision as AccessDecision & { timestamp?: number }).timestamp = Date.now();
    this.permissionCache.set(cacheKey, decision);

    return decision;
  }

  private matchesResource(requested: string, allowed: string): boolean {
    if (allowed === '*') return true;
    const pattern = allowed.replace(/*/g, '.*');
    return new RegExp(\`^\${pattern}$\`).test(requested);
  }

  private getCacheKey(request: AccessRequest): string {
    return \`\${request.userId}:\${request.resource}:\${request.action}\`;
  }

  private invalidateCache(userId?: string): void {
    if (userId) {
      for (const key of this.permissionCache.keys()) {
        if (key.startsWith(userId + ':')) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      this.permissionCache.clear();
    }
  }

  createRole(role: Omit<Role, 'id'>): Role {
    const newRole: Role = {
      ...role,
      id: uuidv4()
    };

    this.roles.set(newRole.id, newRole);
    return newRole;
  }

  updateRole(roleId: string, updates: Partial<Role>): Role | null {
    const role = this.roles.get(roleId);
    if (!role) return null;

    const updated = { ...role, ...updates };
    this.roles.set(roleId, updated);
    this.invalidateCache();
    return updated;
  }

  deleteRole(roleId: string): boolean {
    this.invalidateCache();
    return this.roles.delete(roleId);
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  addPermission(permission: Permission): void {
    this.permissions.set(permission.id, permission);
    this.invalidateCache();
  }

  removePermission(permissionId: string): boolean {
    this.invalidateCache();
    return this.permissions.delete(permissionId);
  }

  getPermission(permissionId: string): Permission | undefined {
    return this.permissions.get(permissionId);
  }

  listPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  async batchCheckAccess(requests: AccessRequest[]): Promise<AccessDecision[]> {
    return Promise.all(requests.map(req => this.checkAccess(req)));
  }
}
`;
}

// Python Manager Generation
/**
 * Generates a Python RBACManager class source file from the configuration.
 * @param config - The RBAC configuration to materialize into Python code.
 * @returns A Python source string implementing the RBAC manager.
 */
export function generateRBACPythonManager(config: RBACConfig): string {
  return `# Auto-generated RBAC Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Set, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import re
import uuid

class PermissionAction(Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    APPROVE = "approve"
    ADMIN = "admin"

class Effect(Enum):
    ALLOW = "allow"
    DENY = "deny"

class RoleStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPRECATED = "deprecated"
    PENDING_APPROVAL = "pending-approval"

@dataclass
class Permission:
    id: str
    name: str
    resource: str
    actions: List[PermissionAction]
    effect: Effect
    status: str

@dataclass
class Role:
    id: str
    name: str
    status: RoleStatus
    permissions: List[str]
    inherits_from: Optional[str] = None
    priority: int = 0

@dataclass
class AccessRequest:
    user_id: str
    resource: str
    action: PermissionAction
    context: Optional[Dict[str, Any]] = None

@dataclass
class AccessDecision:
    allowed: bool
    effect: Effect
    matched_policies: List[str]
    denied_reasons: List[str]
    roles: Optional[List[str]] = None
    permissions: Optional[List[str]] = None
    timestamp: float = field(default_factory=lambda: datetime.now().timestamp())

class RBACManager:
    def __init__(self):
        self.roles: Dict[str, Role] = {}
        self.permissions: Dict[str, Permission] = {}
        self.user_roles: Dict[str, Set[str]] = {}
        self.role_hierarchy: Dict[str, Set[str]] = {}
        self.permission_cache: Dict[str, AccessDecision] = {}
        self.cache_timeout: int = ${config.settings.cacheTTLMinutes * 60}
        self._initialize_default_roles()
        self._build_role_hierarchy()

    def _initialize_default_roles(self) -> None:
        ${config.roles.slice(0, 3).map((role, i) => `
        self.roles["${role.id}"] = Role(
            id="${role.id}",
            name="${role.name}",
            status=RoleStatus.${role.status.toUpperCase().replace(/-/g, '_')},
            permissions=[${role.permissions.map(p => `'${p}'`).join(', ')}],
            inherits_from=${role.inheritsFrom ? `'${role.inheritsFrom}'` : 'None'},
            priority=${role.priority}
        )`).join('\n        ')}

    def _build_role_hierarchy(self) -> None:
        for role in self.roles.values():
            if role.inherits_from:
                if role.id not in self.role_hierarchy:
                    self.role_hierarchy[role.id] = set()
                self.role_hierarchy[role.id].add(role.inherits_from)

    def assign_role(self, user_id: str, role_id: str) -> None:
        if role_id not in self.roles:
            raise ValueError(f"Role {role_id} not found")

        if user_id not in self.user_roles:
            self.user_roles[user_id] = set()

        self.user_roles[user_id].add(role_id)
        self._invalidate_cache(user_id)

    def revoke_role(self, user_id: str, role_id: str) -> None:
        if user_id in self.user_roles:
            self.user_roles[user_id].discard(role_id)
            self._invalidate_cache(user_id)

    def get_user_roles(self, user_id: str) -> List[str]:
        direct_roles = list(self.user_roles.get(user_id, set()))
        all_roles = set(direct_roles)

        for role_id in direct_roles:
            self._get_inherited_roles(role_id, all_roles, set())

        return list(all_roles)

    def _get_inherited_roles(
        self, role_id: str, collected: Set[str], visited: Set[str]
    ) -> None:
        if role_id in visited or role_id not in self.role_hierarchy:
            return

        visited.add(role_id)

        for parent_id in self.role_hierarchy.get(role_id, set()):
            if parent_id in self.roles:
                collected.add(parent_id)
                self._get_inherited_roles(parent_id, collected, visited)

    async def check_access(self, request: AccessRequest) -> AccessDecision:
        cache_key = self._get_cache_key(request)
        cached = self.permission_cache.get(cache_key)

        if cached and datetime.now().timestamp() - cached.timestamp < self.cache_timeout:
            return cached

        user_roles = self.get_user_roles(request.user_id)
        matched_policies = []
        denied_reasons = []

        if not user_roles:
            return AccessDecision(
                allowed=False,
                effect=Effect.DENY,
                matched_policies=[],
                denied_reasons=["User has no assigned roles"]
            )

        has_allow = False
        has_deny = False

        for role_id in user_roles:
            role = self.roles.get(role_id)
            if not role or role.status != RoleStatus.ACTIVE:
                continue

            for perm_id in role.permissions:
                permission = self.permissions.get(perm_id)
                if not permission or permission.status != "granted":
                    continue

                if (self._matches_resource(request.resource, permission.resource) and
                    request.action in permission.actions):

                    matched_policies.append(permission.id)

                    if permission.effect == Effect.ALLOW:
                        has_allow = True
                    else:
                        has_deny = True
                        denied_reasons.append(f"Denied by permission {permission.name}")

        decision = AccessDecision(
            allowed=${config.settings.defaultDenyAll ? 'has_allow and not has_deny' : 'not has_deny'},
            effect=Effect.DENY if has_deny else Effect.ALLOW,
            matched_policies=matched_policies,
            denied_reasons=denied_reasons,
            roles=user_roles,
            permissions=matched_policies
        )

        self.permission_cache[cache_key] = decision
        return decision

    def _matches_resource(self, requested: str, allowed: str) -> bool:
        if allowed == "*":
            return True
        pattern = allowed.replace("*", ".*")
        return bool(re.match(f"^{pattern}$", requested))

    def _get_cache_key(self, request: AccessRequest) -> str:
        return f"{request.user_id}:{request.resource}:{request.action.value}"

    def _invalidate_cache(self, user_id: Optional[str] = None) -> None:
        if user_id:
            keys_to_delete = [k for k in self.permission_cache.keys() if k.startswith(f"{user_id}:")]
            for key in keys_to_delete:
                del self.permission_cache[key]
        else:
            self.permission_cache.clear()

    def create_role(self, role: Role) -> Role:
        self.roles[role.id] = role
        return role

    def update_role(self, role_id: str, updates: Dict[str, Any]) -> Optional[Role]:
        role = self.roles.get(role_id)
        if not role:
            return None

        updated = role.__class__(
            **{**role.__dict__, **updates}
        )
        self.roles[role_id] = updated
        self._invalidate_cache()
        return updated

    def delete_role(self, role_id: str) -> bool:
        self._invalidate_cache()
        return self.roles.pop(role_id, None) is not None

    def get_role(self, role_id: str) -> Optional[Role]:
        return self.roles.get(role_id)

    def list_roles(self) -> List[Role]:
        return list(self.roles.values())

    def add_permission(self, permission: Permission) -> None:
        self.permissions[permission.id] = permission
        self._invalidate_cache()

    def remove_permission(self, permission_id: str) -> bool:
        self._invalidate_cache()
        return self.permissions.pop(permission_id, None) is not None

    def get_permission(self, permission_id: str) -> Optional[Permission]:
        return self.permissions.get(permission_id)

    def list_permissions(self) -> List[Permission]:
        return list(self.permissions.values())

    async def batch_check_access(self, requests: List[AccessRequest]) -> List[AccessDecision]:
        return [await self.check_access(req) for req in requests]
`;
}

// Package.json generation
/**
 * Generates package manifest or requirements file content for the RBAC manager.
 * @param language - Target language: 'typescript' produces a package.json, otherwise a Python requirements.txt.
 * @returns A string containing the manifest content for the given language.
 */
export function generateRBACPackageJSON(language: string): string {
  if (language === 'typescript') {
    return JSON.stringify({
      name: 'rbac-manager',
      version: '1.0.0',
      description: 'RBAC and Access Control Manager',
      main: 'rbac-manager.ts',
      scripts: {
        build: 'tsc',
        test: 'jest',
        lint: 'eslint rbac-manager.ts'
      },
      dependencies: {
        uuid: '^9.0.0'
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
    return `uuid==9.0.0
pydantic==2.0.0
pytest==7.0.0
pytest-asyncio==0.21.0`;
  }
}

// Config JSON generation
/**
 * Serializes the RBAC configuration to a pretty-printed JSON string.
 * @param config - The RBAC configuration to serialize.
 * @returns A JSON string representation of the configuration, with dates serialized as ISO strings.
 */
export function generateRBACConfigJSON(config: RBACConfig): string {
  return JSON.stringify(config, (key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }, 2);
}

// Display function
/**
 * Prints a human-readable summary of the RBAC configuration to the console.
 * @param config - The RBAC configuration to display.
 */
export function displayRBACConfig(config: RBACConfig): void {
  console.log(chalk.cyan('🔐 RBAC and Access Control Management'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Providers:'), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow('Fine-Grained:'), chalk.white(config.settings.enableFineGrained ? 'Yes' : 'No'));
  console.log(chalk.yellow('Default Deny All:'), chalk.white(config.settings.defaultDenyAll ? 'Yes' : 'No'));
  console.log(chalk.yellow('Roles:'), chalk.cyan(config.roles.length));
  console.log(chalk.yellow('Permissions:'), chalk.cyan(config.permissions.length));
  console.log(chalk.yellow('Policies:'), chalk.cyan(config.policies.length));
  console.log(chalk.yellow('Assignments:'), chalk.cyan(config.assignments.length));
  console.log(chalk.gray('─'.repeat(60)));
}

// Main write function
/**
 * Writes all RBAC artifacts (Markdown, Terraform, manager code, manifest, and config) to the output directory.
 * @param config - The RBAC configuration to materialize.
 * @param outputDir - Directory where the generated files will be written.
 * @param language - Target language for the generated manager code.
 * @returns A promise that resolves when all files have been written.
 */
export async function writeRBACFiles(
  config: RBACConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Markdown
  await fs.writeFile(
    path.join(outputDir, 'RBAC.md'),
    generateRBACMarkdown(config)
  );

  // Terraform files
  if (config.providers.includes('aws')) {
    await fs.writeFile(
      path.join(outputDir, 'rbac-aws.tf'),
      generateRBACTerraformAWS(config)
    );
  }

  if (config.providers.includes('azure')) {
    await fs.writeFile(
      path.join(outputDir, 'rbac-azure.tf'),
      generateRBACTerraformAzure(config)
    );
  }

  if (config.providers.includes('gcp')) {
    await fs.writeFile(
      path.join(outputDir, 'rbac-gcp.tf'),
      `# Terraform for GCP RBAC\n# Resource: ${config.projectName}\n`
    );
  }

  // Manager code
  const managerFile = language === 'typescript'
    ? 'rbac-manager.ts'
    : 'rbac_manager.py';

  const managerCode = language === 'typescript'
    ? generateRBACTypeScriptManager(config)
    : generateRBACPythonManager(config);

  await fs.writeFile(
    path.join(outputDir, managerFile),
    managerCode
  );

  // Package/requirements
  if (language === 'typescript') {
    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      generateRBACPackageJSON('typescript')
    );
  } else {
    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      generateRBACPackageJSON('python')
    );
  }

  // Config JSON
  await fs.writeFile(
    path.join(outputDir, 'rbac-config.json'),
    generateRBACConfigJSON(config)
  );
}
