// Custom Security Policies and Automated Enforcement with Exception Handling

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export type PolicyCategory = 'identity' | 'access-control' | 'data-protection' | 'network-security' | 'encryption' | 'monitoring' | 'compliance' | 'custom';
export type RuleType = 'allow' | 'deny' | 'require' | 'recommend' | 'warn' | 'encrypt' | 'log' | 'alert' | 'custom';
export type ExceptionStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'revoked' | 'auto-revoked';
export type EnforcementLevel = 'advisory' | 'warning' | 'blocking' | 'critical' | 'custom';
export type PolicyScope = 'global' | 'organization' | 'department' | 'project' | 'resource' | 'custom';
export type ResourceType = 'user' | 'group' | 'role' | 'service' | 'data' | 'network' | 'api' | 'infrastructure' | 'custom';
export type ConditionOperator = 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'greater-than' | 'less-than' | 'regex' | 'in' | 'not-in' | 'custom';
export type TriggerType = 'on-create' | 'on-update' | 'on-delete' | 'on-access' | 'on-schedule' | 'on-change' | 'custom';
export type RemediationAction = 'auto-fix' | 'block' | 'quarantine' | 'notify' | 'tag' | 'isolate' | 'shutdown' | 'custom';

export interface CustomPolicyConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: PolicySettings;
  policies: CustomSecurityPolicy[];
  rules: PolicyRule[];
  conditions: PolicyCondition[];
  exceptions: PolicyException[];
  enforcement: EnforcementRecord[];
  templates: PolicyTemplate[];
}

export interface PolicySettings {
  autoEnforce: boolean;
  defaultEnforcementLevel: EnforcementLevel;
  allowExceptions: boolean;
  requireExceptionApproval: boolean;
  exceptionApprovers: string[];
  exceptionDuration: number; // days
  autoExpireExceptions: boolean;
  auditAllActions: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  notificationChannels: string[];
  defaultRemediation: RemediationAction;
  dryRun: boolean;
  bypassConditions: string[];
  policyVersioning: boolean;
  reviewFrequency: number; // days
}

export interface CustomSecurityPolicy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  version: string;
  status: 'draft' | 'active' | 'deprecated' | 'disabled';
  scope: PolicyScope;
  scopeValues: string[];
  priority: number; // 1-100
  enforcementLevel: EnforcementLevel;
  owner: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastReviewed: Date;
  rules: string[]; // rule IDs
  conditions: string[]; // condition IDs
  exceptions: string[]; // exception IDs
  metadata: PolicyMetadata;
  tags: string[];
}

export interface PolicyMetadata {
  riskScore: number; // 0-100
  complianceReferences: string[];
  relatedPolicies: string[]; // policy IDs
  changeHistory: PolicyChange[];
  documentation: string;
  rationale: string;
}

export interface PolicyChange {
  timestamp: Date;
  user: string;
  action: 'created' | 'updated' | 'deprecated' | 'enabled' | 'disabled';
  reason: string;
  previousValue?: any;
  newValue?: any;
}

export interface PolicyRule {
  id: string;
  policyId: string;
  name: string;
  description: string;
  type: RuleType;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  triggers: TriggerType[];
  remediation: RemediationAction[];
  parameters: RuleParameter[];
}

export interface RuleCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: any;
  caseSensitive?: boolean;
  negate?: boolean;
}

export interface RuleAction {
  type: string;
  config: Record<string, any>;
  order: number;
  continueOnFailure?: boolean;
}

export interface TriggerConfig {
  type: TriggerType;
  schedule?: string; // cron expression
  eventFilter?: string;
  debounce?: number; // milliseconds
}

export interface RemediationConfig {
  action: RemediationAction;
  autoExecute: boolean;
  timeout: number; // seconds
  rollbackOnFailure: boolean;
  approvalRequired: boolean;
}

export interface RuleParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  defaultValue: any;
  required: boolean;
  description: string;
  validation?: string;
}

export interface PolicyCondition {
  id: string;
  name: string;
  description: string;
  type: 'and' | 'or' | 'not' | 'custom';
  conditions: RuleCondition[];
  enabled: boolean;
}

export interface PolicyException {
  id: string;
  policyId: string;
  policyRuleId?: string;
  name: string;
  description: string;
  status: ExceptionStatus;
  requestedBy: string;
  approvedBy?: string;
  requestedAt: Date;
  approvedAt?: Date;
  expiresAt: Date;
  reason: string;
  justification: string;
  conditions: RuleCondition[];
  scope: ExceptionScope;
  riskScore: number; // 0-100
  mitigation: string;
  reviewRequired: boolean;
  nextReviewDate: Date;
  comments: ExceptionComment[];
  auditTrail: ExceptionAuditEntry[];
}

export interface ExceptionScope {
  resources: string[];
  users: string[];
  groups: string[];
  timeWindows: TimeWindow[];
  locations: string[];
}

export interface TimeWindow {
  start: Date;
  end: Date;
  recurrence?: string; // cron expression for recurring windows
  timezone: string;
}

export interface ExceptionComment {
  id: string;
  author: string;
  comment: string;
  timestamp: Date;
  type: 'request' | 'approval' | 'denial' | 'note' | 'extension';
}

export interface ExceptionAuditEntry {
  timestamp: Date;
  user: string;
  action: string;
  details: string;
}

export interface EnforcementRecord {
  id: string;
  policyId: string;
  ruleId: string;
  timestamp: Date;
  triggeredBy: string;
  triggerType: TriggerType;
  target: ResourceTarget;
  conditions: ConditionEvaluation[];
  actionsTaken: ActionTaken[];
  exceptionApplied?: string; // exception ID
  result: EnforcementResult;
  duration: number; // milliseconds
}

export interface ResourceTarget {
  type: ResourceType;
  id: string;
  name: string;
  location?: string;
  metadata: Record<string, any>;
}

export interface ConditionEvaluation {
  conditionId: string;
  result: boolean;
  evaluatedValue: any;
  expectedValue: any;
  matched: boolean;
}

export interface ActionTaken {
  action: RemediationAction;
  status: 'success' | 'failed' | 'skipped' | 'partial';
  message: string;
  details?: Record<string, any>;
  duration: number;
}

export interface EnforcementResult {
  status: 'enforced' | 'blocked' | 'warning' | 'exception-applied' | 'failed' | 'skipped';
  message: string;
  modifiedResources: string[];
  errors: string[];
  warnings: string[];
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  template: Partial<CustomSecurityPolicy>;
  parameters: TemplateParameter[];
  requiredPermissions: string[];
  compatibleWith: string[];
  tags: string[];
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  defaultValue: any;
  required: boolean;
  options?: any[];
}

// Markdown Generation
export function generateCustomPolicyMarkdown(config: CustomPolicyConfig): string {
  return `# Custom Security Policies and Automated Enforcement with Exception Handling

**Project**: ${config.projectName}
**Providers**: ${config.providers.join(', ')}
**Auto-Enforce**: ${config.settings.autoEnforce ? 'Yes' : 'No'}
**Default Enforcement**: ${config.settings.defaultEnforcementLevel}
**Allow Exceptions**: ${config.settings.allowExceptions ? 'Yes' : 'No'}

## Policy Settings

- **Auto-Enforce**: ${config.settings.autoEnforce}
- **Default Enforcement Level**: ${config.settings.defaultEnforcementLevel}
- **Allow Exceptions**: ${config.settings.allowExceptions}
- **Require Exception Approval**: ${config.settings.requireExceptionApproval}
- **Exception Approvers**: ${config.settings.exceptionApprovers.join(', ')}
- **Exception Duration**: ${config.settings.exceptionDuration} days
- **Auto-Expire Exceptions**: ${config.settings.autoExpireExceptions}
- **Audit All Actions**: ${config.settings.auditAllActions}
- **Dry Run**: ${config.settings.dryRun}

## Security Policies (${config.policies.length})

${config.policies.slice(0, 5).map(policy => `
### ${policy.name} - ${policy.category.toUpperCase()}

- **Category**: ${policy.category}
- **Status**: ${policy.status}
- **Scope**: ${policy.scope}
- **Priority**: ${policy.priority}
- **Enforcement**: ${policy.enforcementLevel}
- **Rules**: ${policy.rules.length}
`).join('\n')}

## Rules (${config.rules.length})
## Conditions (${config.conditions.length})
## Exceptions (${config.exceptions.length})
## Enforcement Records (${config.enforcement.length})
## Templates (${config.templates.length})
`;
}

// Terraform Generation
export function generateCustomPolicyTerraform(config: CustomPolicyConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  if (provider === 'aws') {
    return `# AWS Custom Security Policy Infrastructure
# Generated at: ${new Date().toISOString()}

resource "aws_s3_bucket" "policy_artifacts" {
  bucket = "${config.projectName}-policy-artifacts"

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
}

resource "aws_dynamodb_table" "policy_state" {
  name         = "${config.projectName}-policy-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PolicyId"

  attribute {
    name = "PolicyId"
    type = "S"
  }

  attribute {
    name = "ResourceId"
    type = "S"
  }

  global_secondary_index {
    name            = "ResourceIndex"
    hash_key        = "ResourceId"
    projection_type = "ALL"
  }
}

resource "aws_lambda_function" "policy_enforcer" {
  filename         = "policy_enforcer.zip"
  function_name    = "${config.projectName}-policy-enforcer"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      DRY_RUN              = "${config.settings.dryRun}"
      ENFORCEMENT_LEVEL    = "${config.settings.defaultEnforcementLevel}"
      ALLOW_EXCEPTIONS     = "${config.settings.allowExceptions}"
      STATE_TABLE         = aws_dynamodb_table.policy_state.name
      ARTIFACT_BUCKET     = aws_s3_bucket.policy_artifacts.id
    }
  }
}

resource "aws_cloudwatch_event_rule" "policy_evaluation" {
  name                = "${config.projectName}-policy-evaluation"
  description         = "Trigger custom policy evaluation"
  schedule_expression = "rate(1 hour)"

  targets {
    arn      = aws_lambda_function.policy_enforcer.arn
    id       = "policy-enforcer"
  }
}

resource "aws_sns_topic" "policy_alerts" {
  name = "${config.projectName}-policy-alerts"
}
`;
  } else if (provider === 'azure') {
    return `# Azure Custom Security Policy Infrastructure
# Generated at: ${new Date().toISOString()}

resource "azurerm_storage_account" "policy_artifacts" {
  name                     = "${config.projectName.replace(/-/g, '')}policy"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
}

resource "azurerm_policy_definition" "custom_policy" {
  name         = "${config.projectName}-custom-policy"
  policy_type  = "Custom"
  mode         = "All"

  policy_rule = <<POLICY_RULE
{
  "if": {
    "field": "type",
    "equals": "Microsoft.Storage/storageAccounts"
  },
  "then": {
    "effect": "modify",
    "details": {
      "roleDefinitionIds": [
        "/providers/Microsoft.Authorization/roleDefinitions/17d1049b-9a84-46fb-8f29-5587753039cc"
      ],
      "operations": [
        {
          "operation": "addOrReplace",
          "field": "Microsoft.Storage/storageAccounts/networkAcls.defaultAction",
          "value": "Deny"
        }
      ]
    }
  }
}
POLICY_RULE
}

resource "azurerm_policy_assignment" "custom_assignment" {
  name                 = "${config.projectName}-policy-assignment"
  policy_definition_id = azurerm_policy_definition.custom_policy.id
}
`;
  } else {
    return `# GCP Custom Security Policy Infrastructure
# Generated at: ${new Date().toISOString()}

resource "google_storage_bucket" "policy_artifacts" {
  name          = "${config.projectName}-policy-artifacts"
  location      = "US"
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

resource "google_firestore_database" "policy_state" {
  name                = "${config.projectName}-policy-state"
  location            = "us-central"
  type                = "FIRESTORE_NATIVE"
  concurrency_mode    = "OPTIMISTIC"
  delete_protection_state = "DELETE_PROTECTION_DISABLED"
}

resource "google_cloudfunctions_function" "policy_enforcer" {
  name        = "${config.projectName}-policy-enforcer"
  runtime     = "python39"
  source_archive_bucket = google_storage_bucket.policy_artifacts.name
  entry_point = "enforce_policy"

  environment_variables = {
    DRY_RUN           = "${config.settings.dryRun}"
    ENFORCEMENT_LEVEL = "${config.settings.defaultEnforcementLevel}"
    ALLOW_EXCEPTIONS  = "${config.settings.allowExceptions}"
    STATE_DATABASE    = google_firestore_database.policy_state.name
  }
}

resource "google_cloud_scheduler_job" "policy_evaluation" {
  name             = "${config.projectName}-policy-evaluation"
  description      = "Scheduled custom policy evaluation"
  schedule         = "0 * * * *"
  time_zone        = "America/New_York"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions_function.policy_enforcer.https_trigger_url

    body = base64encode("{"action": "evaluate"}")
  }
}

resource "google_pubsub_topic" "policy_alerts" {
  name = "${config.projectName}-policy-alerts"
}
`;
  }
}

// TypeScript Manager Generation
export function generateCustomPolicyManagerTypeScript(config: CustomPolicyConfig): string {
  return `// Auto-generated Custom Security Policy Manager
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';

interface Policy {
  id: string;
  name: string;
  category: string;
  status: string;
  enforcementLevel: string;
  priority: number;
}

interface Rule {
  id: string;
  policyId: string;
  type: string;
  enabled: boolean;
  priority: number;
}

interface Exception {
  id: string;
  policyId: string;
  status: string;
  expiresAt: Date;
  conditions: any[];
}

interface EnforcementRecord {
  id: string;
  policyId: string;
  ruleId: string;
  timestamp: Date;
  result: string;
}

class CustomPolicyManager extends EventEmitter {
  private policies: Map<string, Policy> = new Map();
  private rules: Map<string, Rule> = new Map();
  private exceptions: Map<string, Exception> = new Map();
  private records: EnforcementRecord[] = [];

  createPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
    this.emit('policy-created', policy);
  }

  createRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
    this.emit('rule-created', rule);
  }

  async enforcePolicy(policyId: string, target: any): Promise<EnforcementRecord> {
    const policy = this.policies.get(policyId);
    if (!policy || policy.status !== 'active') {
      throw new Error('Policy not found or not active');
    }

    const record: EnforcementRecord = {
      id: \`record-\${Date.now()}\`,
      policyId,
      ruleId: '',
      timestamp: new Date(),
      result: 'enforced',
    };

    // Check for exceptions
    const exception = this.findActiveException(policyId, target);
    if (exception) {
      record.result = 'exception-applied';
      this.emit('exception-applied', { policyId, exceptionId: exception.id });
      return record;
    }

    // Get policy rules
    const policyRules = Array.from(this.rules.values()).filter(r => r.policyId === policyId && r.enabled);
    for (const rule of policyRules) {
      await this.enforceRule(rule, target);
    }

    this.records.push(record);
    this.emit('policy-enforced', record);

    return record;
  }

  private async enforceRule(rule: Rule, target: any): Promise<void> {
    // Evaluate conditions
    const conditionsMet = this.evaluateConditions(rule, target);

    if (conditionsMet) {
      // Execute actions based on rule type
      switch (rule.type) {
        case 'block':
          this.emit('blocked', { ruleId: rule.id, target });
          break;
        case 'allow':
          this.emit('allowed', { ruleId: rule.id, target });
          break;
        case 'warn':
          this.emit('warning', { ruleId: rule.id, target });
          break;
        default:
          this.emit('action', { ruleId: rule.id, target, type: rule.type });
      }
    }
  }

  private evaluateConditions(rule: Rule, target: any): boolean {
    // Simplified condition evaluation
    return true;
  }

  findActiveException(policyId: string, target: any): Exception | null {
    const now = new Date();
    for (const exception of this.exceptions.values()) {
      if (exception.policyId === policyId &&
          exception.status === 'approved' &&
          exception.expiresAt > now) {
        return exception;
      }
    }
    return null;
  }

  requestException(exception: Exception): void {
    this.exceptions.set(exception.id, exception);
    this.emit('exception-requested', exception);
  }

  approveException(exceptionId: string, approver: string): void {
    const exception = this.exceptions.get(exceptionId);
    if (!exception) throw new Error('Exception not found');

    exception.status = 'approved';
    this.emit('exception-approved', { exceptionId, approver });
  }

  revokeException(exceptionId: string): void {
    const exception = this.exceptions.get(exceptionId);
    if (!exception) throw new Error('Exception not found');

    exception.status = 'revoked';
    this.emit('exception-revoked', exceptionId);
  }

  getEnforcementHistory(policyId?: string): EnforcementRecord[] {
    if (policyId) {
      return this.records.filter(r => r.policyId === policyId);
    }
    return this.records;
  }
}

export { CustomPolicyManager };
`;
}

// Python Manager Generation
export function generateCustomPolicyManagerPython(config: CustomPolicyConfig): string {
  return `# Auto-generated Custom Security Policy Manager
# Generated at: ${new Date().toISOString()}

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class PolicyStatus(Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    DISABLED = "disabled"

class ExceptionStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    EXPIRED = "expired"
    REVOKED = "revoked"

@dataclass
class Policy:
    id: str
    name: str
    category: str
    status: str
    enforcement_level: str
    priority: int

@dataclass
class Rule:
    id: str
    policy_id: str
    type: str
    enabled: bool
    priority: int

@dataclass
class Exception:
    id: str
    policy_id: str
    status: str
    expires_at: datetime
    conditions: List[Any]

@dataclass
class EnforcementRecord:
    id: str
    policy_id: str
    rule_id: str
    timestamp: datetime
    result: str

class CustomPolicyManager:
    def __init__(self):
        self.policies: Dict[str, Policy] = {}
        self.rules: Dict[str, Rule] = {}
        self.exceptions: Dict[str, Exception] = {}
        self.records: List[EnforcementRecord] = []

    def create_policy(self, policy: Policy) -> None:
        self.policies[policy.id] = policy

    def create_rule(self, rule: Rule) -> None:
        self.rules[rule.id] = rule

    async def enforce_policy(self, policy_id: str, target: Any) -> EnforcementRecord:
        policy = self.policies.get(policy_id)
        if not policy or policy.status != PolicyStatus.ACTIVE.value:
            raise ValueError("Policy not found or not active")

        record = EnforcementRecord(
            id=f"record-{int(datetime.now().timestamp())}",
            policy_id=policy_id,
            rule_id="",
            timestamp=datetime.now(),
            result="enforced",
        )

        # Check for exceptions
        exception = self._find_active_exception(policy_id, target)
        if exception:
            record.result = "exception-applied"
            return record

        # Get policy rules
        policy_rules = [r for r in self.rules.values() if r.policy_id == policy_id and r.enabled]
        for rule in policy_rules:
            await self._enforce_rule(rule, target)

        self.records.append(record)
        return record

    async def _enforce_rule(self, rule: Rule, target: Any) -> None:
        conditions_met = self._evaluate_conditions(rule, target)

        if conditions_met:
            # Execute actions based on rule type
            if rule.type == "block":
                pass
            elif rule.type == "allow":
                pass
            elif rule.type == "warn":
                pass

    def _evaluate_conditions(self, rule: Rule, target: Any) -> bool:
        # Simplified condition evaluation
        return True

    def _find_active_exception(self, policy_id: str, target: Any) -> Optional[Exception]:
        now = datetime.now()
        for exception in self.exceptions.values():
            if (exception.policy_id == policy_id and
                exception.status == ExceptionStatus.APPROVED.value and
                exception.expires_at > now):
                return exception
        return None

    def request_exception(self, exception: Exception) -> None:
        self.exceptions[exception.id] = exception

    def approve_exception(self, exception_id: str, approver: str) -> None:
        exception = self.exceptions.get(exception_id)
        if not exception:
            raise ValueError("Exception not found")

        exception.status = ExceptionStatus.APPROVED.value

    def revoke_exception(self, exception_id: str) -> None:
        exception = self.exceptions.get(exception_id)
        if not exception:
            raise ValueError("Exception not found")

        exception.status = ExceptionStatus.REVOKED.value

    def get_enforcement_history(self, policy_id: Optional[str] = None) -> List[EnforcementRecord]:
        if policy_id:
            return [r for r in self.records if r.policy_id == policy_id]
        return self.records
`;
}

// Write Files
export async function writeCustomPolicyFiles(
  config: CustomPolicyConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  await fs.writeFile(
    path.join(outputDir, 'CUSTOM_POLICY.md'),
    generateCustomPolicyMarkdown(config)
  );

  for (const provider of config.providers) {
    const tfContent = generateCustomPolicyTerraform(config, provider);
    await fs.writeFile(
      path.join(outputDir, `custom-policy-${provider}.tf`),
      tfContent
    );
  }

  if (language === 'typescript') {
    const tsContent = generateCustomPolicyManagerTypeScript(config);
    await fs.writeFile(path.join(outputDir, 'custom-policy-manager.ts'), tsContent);

    const packageJson = {
      name: config.projectName,
      version: '1.0.0',
      description: 'Custom Security Policies and Automated Enforcement',
      main: 'custom-policy-manager.ts',
      scripts: { start: 'ts-node custom-policy-manager.ts' },
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
    const pyContent = generateCustomPolicyManagerPython(config);
    await fs.writeFile(path.join(outputDir, 'custom_policy_manager.py'), pyContent);

    await fs.writeFile(
      path.join(outputDir, 'requirements.txt'),
      'pydantic>=2.0.0\npython-dotenv>=1.0.0\n'
    );
  }

  await fs.writeFile(
    path.join(outputDir, 'custom-policy-config.json'),
    JSON.stringify(config, null, 2)
  );
}

export function displayCustomPolicyConfig(config: CustomPolicyConfig): void {
  console.log(chalk.cyan('🛡️  Custom Security Policies and Automated Enforcement'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow(`Project Name:`), chalk.white(config.projectName));
  console.log(chalk.yellow(`Providers:`), chalk.white(config.providers.join(', ')));
  console.log(chalk.yellow(`Auto-Enforce:`), chalk.white(config.settings.autoEnforce ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Default Enforcement:`), chalk.white(config.settings.defaultEnforcementLevel));
  console.log(chalk.yellow(`Allow Exceptions:`), chalk.white(config.settings.allowExceptions ? 'Yes' : 'No'));
  console.log(chalk.yellow(`Policies:`), chalk.cyan(config.policies.length));
  console.log(chalk.yellow(`Rules:`), chalk.cyan(config.rules.length));
  console.log(chalk.gray('─'.repeat(60)));
}
