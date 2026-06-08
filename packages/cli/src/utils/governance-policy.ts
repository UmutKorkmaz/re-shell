// Governance Policy Management with Workflow Automation and Approvals

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions
export type PolicyStatus = 'draft' | 'pending-review' | 'under-review' | 'approved' | 'rejected' | 'deprecated' | 'archived';
export type PolicyCategory = 'security' | 'compliance' | 'operational' | 'financial' | 'hr' | 'legal' | 'it' | 'data-privacy' | 'risk-management' | 'custom';
export type PolicyType = 'standard' | 'procedure' | 'guideline' | 'policy' | 'regulation' | 'framework';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'conditional' | 'escalated';
export type WorkflowStatus = 'active' | 'suspended' | 'completed' | 'cancelled';
export type WorkflowStepType = 'review' | 'approval' | 'notification' | 'conditional' | 'escalation' | 'automated-check';
export type ComplianceLevel = 'mandatory' | 'required' | 'recommended' | 'optional';
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AuditEventType = 'policy-created' | 'policy-updated' | 'policy-approved' | 'policy-rejected' | 'policy-deprecated' | 'workflow-started' | 'workflow-completed' | 'violation-detected' | 'compliance-check';

export interface GovernanceConfig {
  projectName: string;
  organization: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: GovernanceSettings;
  policies: Policy[];
  workflows: Workflow[];
  approvalChains: ApprovalChain[];
  violations: PolicyViolation[];
  audits: AuditEvent[];
  complianceFrameworks: ComplianceFramework[];
}

export interface GovernanceSettings {
  requireApproval: boolean;
  requiredApprovers: number;
  autoRouting: boolean;
  enableEscalation: boolean;
  escalationTimeout: number; // hours
  enableNotifications: boolean;
  notificationChannels: Array<'email' | 'slack' | 'teams' | 'webhook'>;
  enableAuditLogging: boolean;
  auditRetentionDays: number;
  enableComplianceChecks: boolean;
  complianceCheckFrequency: 'daily' | 'weekly' | 'monthly';
  enableViolationTracking: boolean;
  autoRemediation: boolean;
  policyVersioning: boolean;
  requirePolicyReview: boolean;
  policyReviewFrequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  enableWorkflowAutomation: boolean;
  workflowTimeout: number; // days
  allowDelegation: boolean;
  requireComments: boolean;
  enableReporting: boolean;
  reportFrequency: 'weekly' | 'monthly' | 'quarterly';
  stakeholders: string[];
}

export interface Policy {
  id: string;
  name: string;
  title: string;
  description: string;
  category: PolicyCategory;
  type: PolicyType;
  status: PolicyStatus;
  version: string;
  complianceLevel: ComplianceLevel;

  // Policy Content
  purpose: string;
  scope: string[];
  statement: string;
  procedures: PolicyProcedure[];
  responsibilities: PolicyResponsibility[];
  references: string[];

  // Approval
  workflowId?: string;
  approvalChainId: string;
  approvals: PolicyApproval[];
  conditions: PolicyCondition[];

  // Lifecycle
  createdDate: Date;
  createdBy: string;
  lastUpdated: Date;
  updatedBy: string;
  effectiveDate?: Date;
  reviewDate?: Date;
  expiryDate?: Date;
  nextReviewDate: Date;

  // Compliance
  applicableFrameworks: string[]; // framework IDs
  controls: PolicyControl[];
  violationPenalties: string[];

  // Metrics
  complianceScore: number; // 0-100
  violationsCount: number;
  lastComplianceCheck?: Date;

  // Metadata
  tags: string[];
  documents: PolicyDocument[];
  relatedPolicies: string[]; // policy IDs
  dependencies: string[]; // policy IDs this depends on
  dependents: string[]; // policy IDs that depend on this
}

export interface PolicyProcedure {
  id: string;
  name: string;
  description: string;
  steps: ProcedureStep[];
  owner: string;
  frequency?: string;
  requiredResources: string[];
}

export interface ProcedureStep {
  stepNumber: number;
  action: string;
  responsible: string;
  expectedDuration: number; // minutes
  verification: string;
  references?: string[];
}

export interface PolicyResponsibility {
  role: string;
  responsibilities: string[];
  accountabilities: string[];
  authority: string[];
}

export interface PolicyApproval {
  approverId: string;
  approverName: string;
  approverRole: string;
  status: ApprovalStatus;
  requestedDate: Date;
  reviewedDate?: Date;
  comments?: string;
  conditions?: string[];
  delegation?: {
    delegatedTo: string;
    delegatedToName: string;
    delegatedDate: Date;
    reason: string;
  };
}

export interface PolicyCondition {
  type: 'effective-date' | 'expiry-date' | 'compliance-score' | 'framework-approval' | 'custom';
  description: string;
  requirement: string;
  met: boolean;
  lastChecked?: Date;
}

export interface PolicyControl {
  id: string;
  controlId: string; // external framework ID
  description: string;
  type: 'preventive' | 'detective' | 'corrective';
  automation: 'manual' | 'semi-automated' | 'automated';
  implementation: string;
  validation: string;
  frequency: string;
}

export interface PolicyDocument {
  id: string;
  name: string;
  type: 'policy-document' | 'procedure' | 'guideline' | 'template' | 'evidence';
  url: string;
  version: string;
  lastUpdated: Date;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  type: 'policy-approval' | 'policy-review' | 'compliance-check' | 'violation-remediation' | 'custom';
  status: WorkflowStatus;

  // Workflow Definition
  steps: WorkflowStep[];
  currentStep: number;
  autoAdvance: boolean;
  allowParallel: boolean;

  // Execution
  startedDate: Date;
  startedBy: string;
  completedDate?: Date;
  timeoutDate?: Date;
  entityId: string; // policy ID, violation ID, etc.
  entityType: 'policy' | 'violation' | 'custom';

  // Participants
  initiator: string;
  participants: WorkflowParticipant[];
  escalations: WorkflowEscalation[];

  // History
  history: WorkflowHistoryEntry[];

  // Outcome
  outcome?: WorkflowOutcome;
}

export interface WorkflowStep {
  stepNumber: number;
  name: string;
  type: WorkflowStepType;
  description: string;
  assignee: string;
  assigneeRole: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  startedDate?: Date;
  completedDate?: Date;
  duration?: number; // minutes

  // Step Configuration
  required: boolean;
  allowDelegation: boolean;
  escalationTimeout?: number; // hours
  autoApproveConditions?: string[];

  // Output
  decision?: 'approved' | 'rejected' | 'conditional' | 'escalated';
  comments?: string;
  attachments?: string[];
}

export interface WorkflowParticipant {
  userId: string;
  userName: string;
  role: string;
  addedDate: Date;
  addedBy: string;
}

export interface WorkflowEscalation {
  escalationNumber: number;
  escalatedFrom: string;
  escalatedTo: string;
  reason: string;
  escalatedDate: Date;
  acknowledged?: boolean;
  acknowledgedDate?: Date;
}

export interface WorkflowHistoryEntry {
  timestamp: Date;
  action: string;
  performedBy: string;
  details: string;
}

export interface WorkflowOutcome {
  status: 'approved' | 'rejected' | 'cancelled' | 'timeout' | 'conditional';
  decidedBy: string;
  decidedDate: Date;
  reason: string;
  conditions?: string[];
}

export interface ApprovalChain {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
 适用: string[]; // policy types this applies to

  // Chain Definition
  levels: ApprovalLevel[];
  requireAllLevels: boolean;
  allowParallel: boolean;
  timeout: number; // days

  // Configuration
  autoEscalate: boolean;
  escalationAction: 'reject' | 'escalate-up' | 'notify-only';
  allowDelegation: boolean;
  requireComments: boolean;
}

export interface ApprovalLevel {
  level: number;
  name: string;
  approvers: Approver[];
  requireAll: boolean;
  timeout: number; // hours
  escalationLevel?: number;
}

export interface Approver {
  userId: string;
  userName: string;
  role: string;
  primary: boolean;
  alternate?: string;
  alternateName?: string;
}

export interface PolicyViolation {
  id: string;
  policyId: string;
  policyName: string;
  violationType: string;
  severity: ViolationSeverity;
  status: 'open' | 'in-progress' | 'remediated' | 'accepted' | 'false-positive';

  // Detection
  detectedDate: Date;
  detectedBy: string; // system or user ID
  detectionMethod: string;

  // Details
  description: string;
  affectedEntities: string[];
  evidence: ViolationEvidence[];

  // Impact
  riskImpact: string;
  potentialPenalty: string;
  affectedFrameworks: string[];

  // Remediation
  workflowId?: string;
  assignedTo: string;
  dueDate?: Date;
  remediationPlan: string;
  remediationSteps: RemediationStep[];
  resolvedDate?: Date;
  resolvedBy?: string;

  // Metrics
  timeToDetect: number; // minutes
  timeToResolve?: number; // minutes
}

export interface ViolationEvidence {
  type: 'screenshot' | 'log' | 'document' | 'system-alert' | 'audit-record';
  description: string;
  url: string;
  timestamp: Date;
  collectedBy: string;
}

export interface RemediationStep {
  stepNumber: number;
  action: string;
  assignedTo: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate: Date;
  completedDate?: Date;
  notes?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId: string;
  userName: string;
  action: string;
  entityType: 'policy' | 'workflow' | 'violation' | 'approval-chain' | 'framework';
  entityId: string;
  entityName: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  type: 'iso-27001' | 'soc-2' | 'pci-dss' | 'hipaa' | 'gdpr' | 'nist-csf' | 'cobit' | 'custom';
  version: string;
  status: 'active' | 'updating' | 'deprecated';

  // Framework Details
  description: string;
  scope: string[];
  requirements: FrameworkRequirement[];
  controls: FrameworkControl[];

  // Certification
  certificationRequired: boolean;
  certifiedDate?: Date;
  expiryDate?: Date;
  certifyingBody?: string;

  // Mapping
  mappedPolicies: string[]; // policy IDs
  complianceScore: number; // 0-100
  lastAssessment: Date;
  nextAssessment: Date;

  // Owner
  owner: string;
  team: string[];
}

export interface FrameworkRequirement {
  id: string;
  requirementId: string; // external ID
  category: string;
  title: string;
  description: string;
  mandatory: boolean;
  mappedControls: string[]; // control IDs
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-assessed';
}

export interface FrameworkControl {
  controlId: string;
  title: string;
  description: string;
  category: string;
  implementationStatus: 'implemented' | 'partial' | 'planned' | 'not-implemented';
  policyMappings: string[]; // policy IDs
  testProcedures: string[];
  lastTested?: Date;
  testResult?: 'pass' | 'fail' | 'partial';
}

// Manager Class
export class GovernancePolicyManager {
  private policies: Map<string, Policy> = new Map();
  private workflows: Map<string, Workflow> = new Map();
  private approvalChains: Map<string, ApprovalChain> = new Map();
  private violations: Map<string, PolicyViolation> = new Map();
  private audits: AuditEvent[] = [];
  private frameworks: Map<string, ComplianceFramework> = new Map();

  // Policy Management
  createPolicy(policy: Omit<Policy, 'id' | 'createdDate' | 'lastUpdated' | 'nextReviewDate' | 'complianceScore' | 'violationsCount'>): Policy {
    const id = this.generateId('policy');
    const now = new Date();

    const newPolicy: Policy = {
      ...policy,
      id,
      createdDate: now,
      lastUpdated: now,
      nextReviewDate: this.calculateNextReviewDate(),
      complianceScore: 100,
      violationsCount: 0,
    };

    this.policies.set(id, newPolicy);
    this.audit({
      eventType: 'policy-created',
      userId: policy.createdBy,
      userName: policy.createdBy,
      action: 'created',
      entityType: 'policy',
      entityId: id,
      entityName: policy.name,
      details: { category: policy.category, type: policy.type },
    });

    return newPolicy;
  }

  updatePolicy(id: string, updates: Partial<Policy>, userId: string): Policy | undefined {
    const policy = this.policies.get(id);
    if (!policy) return undefined;

    const updated = {
      ...policy,
      ...updates,
      lastUpdated: new Date(),
      updatedBy: userId,
    };

    this.policies.set(id, updated);
    this.audit({
      eventType: 'policy-updated',
      userId,
      userName: userId,
      action: 'updated',
      entityType: 'policy',
      entityId: id,
      entityName: policy.name,
      details: updates,
    });

    return updated;
  }

  getPolicy(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  listPolicies(filters?: { category?: PolicyCategory; status?: PolicyStatus; type?: PolicyType }): Policy[] {
    let policies = Array.from(this.policies.values());

    if (filters?.category) {
      policies = policies.filter(p => p.category === filters.category);
    }
    if (filters?.status) {
      policies = policies.filter(p => p.status === filters.status);
    }
    if (filters?.type) {
      policies = policies.filter(p => p.type === filters.type);
    }

    return policies.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  // Workflow Management
  createWorkflow(workflow: Omit<Workflow, 'id' | 'startedDate' | 'currentStep' | 'status'>): Workflow {
    const id = this.generateId('workflow');
    const now = new Date();

    const newWorkflow: Workflow = {
      ...workflow,
      id,
      startedDate: now,
      currentStep: 0,
      status: 'active',
      history: [{
        timestamp: now,
        action: 'workflow-started',
        performedBy: workflow.startedBy,
        details: 'Workflow initiated',
      }],
    };

    this.workflows.set(id, newWorkflow);
    this.audit({
      eventType: 'workflow-started',
      userId: workflow.startedBy,
      userName: workflow.startedBy,
      action: 'created',
      entityType: 'workflow',
      entityId: id,
      entityName: workflow.name,
      details: { entityType: workflow.entityType, entityId: workflow.entityId },
    });

    return newWorkflow;
  }

  advanceWorkflow(workflowId: string, stepResult: { decision: 'approved' | 'rejected' | 'conditional' | 'escalated'; comments?: string; userId: string }): Workflow | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    const currentStep = workflow.steps[workflow.currentStep];
    currentStep.decision = stepResult.decision;
    currentStep.comments = stepResult.comments;
    currentStep.completedDate = new Date();
    currentStep.status = 'completed';

    // Record history
    workflow.history.push({
      timestamp: new Date(),
      action: `step-completed: ${stepResult.decision}`,
      performedBy: stepResult.userId,
      details: stepResult.comments || '',
    });

    // Check if workflow should continue
    if (stepResult.decision === 'rejected') {
      workflow.status = 'cancelled';
      workflow.outcome = {
        status: 'rejected',
        decidedBy: stepResult.userId,
        decidedDate: new Date(),
        reason: stepResult.comments || 'Rejected at step ' + (workflow.currentStep + 1),
      };
    } else if (workflow.currentStep < workflow.steps.length - 1) {
      workflow.currentStep++;
      workflow.steps[workflow.currentStep].status = 'in-progress';
      workflow.steps[workflow.currentStep].startedDate = new Date();
    } else {
      workflow.status = 'completed';
      workflow.completedDate = new Date();
      workflow.outcome = {
        status: stepResult.decision === 'approved' ? 'approved' : 'conditional',
        decidedBy: stepResult.userId,
        decidedDate: new Date(),
        reason: stepResult.comments || '',
      };
    }

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  listWorkflows(status?: WorkflowStatus): Workflow[] {
    let workflows = Array.from(this.workflows.values());
    if (status) {
      workflows = workflows.filter(w => w.status === status);
    }
    return workflows.sort((a, b) => b.startedDate.getTime() - a.startedDate.getTime());
  }

  // Approval Chain Management
  createApprovalChain(chain: Omit<ApprovalChain, 'id'>): ApprovalChain {
    const id = this.generateId('chain');
    const newChain: ApprovalChain = { ...chain, id };
    this.approvalChains.set(id, newChain);
    return newChain;
  }

  getApprovalChain(id: string): ApprovalChain | undefined {
    return this.approvalChains.get(id);
  }

  // Violation Management
  createViolation(violation: Omit<PolicyViolation, 'id' | 'detectedDate' | 'timeToDetect'>): PolicyViolation {
    const id = this.generateId('violation');
    const now = new Date();

    const newViolation: PolicyViolation = {
      ...violation,
      id,
      detectedDate: now,
      timeToDetect: 0,
    };

    this.violations.set(id, newViolation);

    // Update policy violation count
    const policy = this.policies.get(violation.policyId);
    if (policy) {
      policy.violationsCount++;
    }

    this.audit({
      eventType: 'violation-detected',
      userId: violation.detectedBy,
      userName: violation.detectedBy,
      action: 'detected',
      entityType: 'violation',
      entityId: id,
      entityName: violation.violationType,
      details: { policyId: violation.policyId, severity: violation.severity },
    });

    return newViolation;
  }

  getViolation(id: string): PolicyViolation | undefined {
    return this.violations.get(id);
  }

  listViolations(filters?: { policyId?: string; severity?: ViolationSeverity; status?: string }): PolicyViolation[] {
    let violations = Array.from(this.violations.values());

    if (filters?.policyId) {
      violations = violations.filter(v => v.policyId === filters.policyId);
    }
    if (filters?.severity) {
      violations = violations.filter(v => v.severity === filters.severity);
    }
    if (filters?.status) {
      violations = violations.filter(v => v.status === filters.status);
    }

    return violations.sort((a, b) => b.detectedDate.getTime() - a.detectedDate.getTime());
  }

  // Compliance Framework Management
  createFramework(framework: Omit<ComplianceFramework, 'id' | 'lastAssessment' | 'nextAssessment'>): ComplianceFramework {
    const id = this.generateId('framework');
    const now = new Date();

    const newFramework: ComplianceFramework = {
      ...framework,
      id,
      lastAssessment: now,
      nextAssessment: this.calculateNextAssessment(),
    };

    this.frameworks.set(id, newFramework);
    return newFramework;
  }

  getFramework(id: string): ComplianceFramework | undefined {
    return this.frameworks.get(id);
  }

  listFrameworks(): ComplianceFramework[] {
    return Array.from(this.frameworks.values());
  }

  // Audit Logging
  private audit(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateId('audit'),
      timestamp: new Date(),
    };
    this.audits.push(auditEvent);
  }

  getAuditLog(filters?: { entityType?: string; entityId?: string; eventType?: AuditEventType; userId?: string }): AuditEvent[] {
    let events = [...this.audits];

    if (filters?.entityType) {
      events = events.filter(e => e.entityType === filters.entityType);
    }
    if (filters?.entityId) {
      events = events.filter(e => e.entityId === filters.entityId);
    }
    if (filters?.eventType) {
      events = events.filter(e => e.eventType === filters.eventType);
    }
    if (filters?.userId) {
      events = events.filter(e => e.userId === filters.userId);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Analytics & Reporting
  getGovernanceSummary(): GovernanceSummary {
    const policies = this.listPolicies();
    const workflows = this.listWorkflows();
    const violations = this.listViolations();
    const frameworks = this.listFrameworks();

    const activePolicies = policies.filter(p => p.status === 'approved');
    const pendingApprovals = policies.filter(p => p.status === 'pending-review' || p.status === 'under-review');
    const activeWorkflows = workflows.filter(w => w.status === 'active');
    const openViolations = violations.filter(v => v.status === 'open' || v.status === 'in-progress');
    const criticalViolations = violations.filter(v => v.severity === 'critical' && v.status !== 'remediated');

    const avgComplianceScore = activePolicies.length > 0
      ? activePolicies.reduce((sum, p) => sum + p.complianceScore, 0) / activePolicies.length
      : 0;

    return {
      totalPolicies: policies.length,
      activePolicies: activePolicies.length,
      pendingApprovals: pendingApprovals.length,
      avgComplianceScore: Math.round(avgComplianceScore),
      totalWorkflows: workflows.length,
      activeWorkflows: activeWorkflows.length,
      totalViolations: violations.length,
      openViolations: openViolations.length,
      criticalViolations: criticalViolations.length,
      totalFrameworks: frameworks.length,
      avgFrameworkCompliance: Math.round(
        frameworks.length > 0
          ? frameworks.reduce((sum, f) => sum + f.complianceScore, 0) / frameworks.length
          : 0
      ),
      auditEvents: this.audits.length,
    };
  }

  // Helper methods
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private calculateNextReviewDate(): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  }

  private calculateNextAssessment(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return date;
  }
}

export interface GovernanceSummary {
  totalPolicies: number;
  activePolicies: number;
  pendingApprovals: number;
  avgComplianceScore: number;
  totalWorkflows: number;
  activeWorkflows: number;
  totalViolations: number;
  openViolations: number;
  criticalViolations: number;
  totalFrameworks: number;
  avgFrameworkCompliance: number;
  auditEvents: number;
}

// Generate Markdown Documentation
export function generateGovernanceMarkdown(config: GovernanceConfig): string {
  let md = '# Governance Policy Management\n\n';
  md += '## Overview\n\n';
  md += `**Project:** ${config.projectName}\n`;
  md += `**Organization:** ${config.organization}\n`;
  md += `**Providers:** ${config.providers.join(', ')}\n\n`;

  md += '## Features\n\n';
  md += '- Policy lifecycle management (draft, review, approve, deprecate)\n';
  md += '- Multi-level approval chains with escalation\n';
  md += '- Workflow automation with configurable steps\n';
  md += '- Violation tracking and remediation workflows\n';
  md += '- Compliance framework mapping (ISO 27001, SOC 2, PCI DSS, HIPAA, GDPR)\n';
  md += '- Audit logging for all governance activities\n';
  md += '- Automated compliance checks\n';
  md += '- Policy versioning and review scheduling\n';
  md += '- Multi-cloud infrastructure support\n\n';

  md += '## Policy Categories\n\n';
  md += '| Category | Policies | Avg Compliance |\n';
  md += '|----------|----------|----------------|\n';

  const categories = ['security', 'compliance', 'operational', 'financial', 'hr', 'legal', 'it', 'data-privacy'] as PolicyCategory[];
  for (const cat of categories) {
    const catPolicies = config.policies.filter(p => p.category === cat);
    const avgScore = catPolicies.length > 0
      ? catPolicies.reduce((sum, p) => sum + p.complianceScore, 0) / catPolicies.length
      : 0;
    md += `| ${cat} | ${catPolicies.length} | ${Math.round(avgScore)}% |\n`;
  }
  md += '\n';

  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import { GovernancePolicyManager } from \'./governance-manager\';\n\n';
  md += 'const manager = new GovernancePolicyManager();\n\n';
  md += '// Create a policy\n';
  md += 'const policy = manager.createPolicy({\n';
  md += '  name: "data-retention",\n';
  md += '  title: "Data Retention Policy",\n';
  md += '  category: "data-privacy",\n';
  md += '  type: "policy",\n';
  md += '  status: "draft",\n';
  md += '  // ... other fields\n';
  md += '});\n\n';
  md += '// Start approval workflow\n';
  md += 'const workflow = manager.createWorkflow({\n';
  md += '  name: "Policy Approval",\n';
  md += '  type: "policy-approval",\n';
  md += '  entityId: policy.id,\n';
  md += '  entityType: "policy",\n';
  md += '  steps: [/* ... */],\n';
  md += '  startedBy: "admin"\n';
  md += '});\n';
  md += '```\n\n';

  return md;
}

// Generate Terraform Configuration
export function generateGovernanceTerraform(config: GovernanceConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  let tf = `# Terraform for Governance Policy Management - ${provider.toUpperCase()}\n`;
  tf += `# Generated for ${config.projectName}\n\n`;

  if (provider === 'aws') {
    tf += '# DynamoDB for policy storage\n';
    tf += 'resource "aws_dynamodb_table" "governance_policies" {\n';
    tf += `  name = "${config.projectName}-governance-policies"\n`;
    tf += '  billing_mode = "PAY_PER_REQUEST"\n';
    tf += '  hash_key = "id"\n\n';
    tf += '  attribute {\n';
    tf += '    name = "id"\n';
    tf += '    type = "S"\n';
    tf += '  }\n\n';
    tf += '  point_in_time_recovery {\n';
    tf += '    enabled = true\n';
    tf += '  }\n\n';
    tf += '  server_side_encryption {\n';
    tf += '    enabled = true\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += '# DynamoDB for audit log\n';
    tf += 'resource "aws_dynamodb_table" "governance_audit" {\n';
    tf += `  name = "${config.projectName}-governance-audit"\n`;
    tf += '  billing_mode = "PAY_PER_REQUEST"\n';
    tf += '  hash_key = "id"\n';
    tf += '  range_key = "timestamp"\n\n';
    tf += '  attribute {\n';
    tf += '    name = "id"\n';
    tf += '    type = "S"\n';
    tf += '  }\n\n';
    tf += '  attribute {\n';
    tf += '    name = "timestamp"\n';
    tf += '    type = "N"\n';
    tf += '  }\n\n';
    tf += '  ttl {\n';
    tf += '    attribute_name = "expiry"\n';
    tf += '    enabled = true\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += '# S3 for policy documents\n';
    tf += 'resource "aws_s3_bucket" "governance_docs" {\n';
    tf += `  bucket = "${config.projectName}-governance-docs"\n`;
    tf += '  versioning {\n';
    tf += '    enabled = true\n';
    tf += '  }\n\n';
    tf += '  server_side_encryption_configuration {\n';
    tf += '    rule {\n';
    tf += '      apply_server_side_encryption_by_default {\n';
    tf += '        sse_algorithm = "AES256"\n';
    tf += '      }\n';
    tf += '    }\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += '# SNS for notifications\n';
    tf += 'resource "aws_sns_topic" "governance_notifications" {\n';
    tf += `  name = "${config.projectName}-governance-notifications"\n`;
    tf += '}\n\n';

    tf += '# Lambda for automated compliance checks\n';
    tf += 'resource "aws_lambda_function" "compliance_checker" {\n';
    tf += `  function_name = "${config.projectName}-compliance-checker"\n`;
    tf += '  role = aws_iam_role.governance.arn\n';
    tf += '  handler = "index.handler"\n\n';
    tf += '  environment {\n';
    tf += '    variables = {\n';
    tf += '      POLICIES_TABLE = aws_dynamodb_table.governance_policies.name\n';
    tf += '      AUDIT_TABLE = aws_dynamodb_table.governance_audit.name\n';
    tf += '      NOTIFICATIONS_TOPIC = aws_sns_topic.governance_notifications.name\n';
    tf += '    }\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += '# EventBridge for scheduled compliance checks\n';
    tf += 'resource "aws_cloudwatch_event_rule" "compliance_check_schedule" {\n';
    tf += `  name = "${config.projectName}-compliance-check-schedule"\n`;
    tf += '  schedule_expression = "cron(0 2 * * ? *)"\n'; // Daily at 2 AM
    tf += '}\n\n';
  } else if (provider === 'azure') {
    tf += '# Azure Resources for Governance\n';
    tf += 'resource "azurerm_storage_account" "governance_docs" {\n';
    tf += `  name = "${config.projectName}govdocs"\n`;
    tf += '  resource_group_name = azurerm_resource_group.main.name\n';
    tf += '  location = var.location\n';
    tf += '  account_tier = "Standard"\n';
    tf += '  account_replication_type = "GRS"\n';
    tf += '}\n\n';

    tf += '# Cosmos DB for policies\n';
    tf += 'resource "azurerm_cosmosdb_account" "governance_db" {\n';
    tf += `  name = "${config.projectName}-governance-db"\n`;
    tf += '  location = var.location\n';
    tf += '  resource_group_name = azurerm_resource_group.main.name\n';
    tf += '  offer_type = "Standard"\n';
    tf += '  kind = "GlobalDocumentDB"\n';
    tf += '}\n\n';
  } else if (provider === 'gcp') {
    tf += '# GCP Resources for Governance\n';
    tf += 'resource "google_storage_bucket" "governance_docs" {\n';
    tf += `  name = "${config.projectName}-governance-docs"\n`;
    tf += '  location = var.location\n';
    tf += '  versioning {\n';
    tf += '    enabled = true\n';
    tf += '  }\n';
    tf += '}\n\n';

    tf += '# Firestore for governance data\n';
    tf += 'resource "google_firestore_database" "governance_db" {\n';
    tf += `  name = "${config.projectName}-governance-db"\n`;
    tf += '  location = var.region\n';
    tf += '  type = "FIRESTORE_NATIVE"\n';
    tf += '}\n\n';
  }

  return tf;
}

// Generate TypeScript Manager
export function generateTypeScriptManager(config: GovernanceConfig): string {
  let code = `// Governance Policy Manager - TypeScript\n`;
  code += `// Generated for ${config.projectName}\n\n`;
  code += `import { EventEmitter } from 'events';\n`;
  code += `import { randomUUID } from 'crypto';\n\n`;

  // Enums
  code += `export enum PolicyStatus {\n`;
  code += `  DRAFT = 'draft',\n`;
  code += `  PENDING_REVIEW = 'pending-review',\n`;
  code += `  UNDER_REVIEW = 'under-review',\n`;
  code += `  APPROVED = 'approved',\n`;
  code += `  REJECTED = 'rejected',\n`;
  code += `  DEPRECATED = 'deprecated',\n`;
  code += `  ARCHIVED = 'archived'\n`;
  code += `}\n\n`;

  code += `export enum ApprovalStatus {\n`;
  code += `  PENDING = 'pending',\n`;
  code += `  APPROVED = 'approved',\n`;
  code += `  REJECTED = 'rejected',\n`;
  code += `  CONDITIONAL = 'conditional',\n`;
  code += `  ESCALATED = 'escalated'\n`;
  code += `}\n\n`;

  code += `export enum WorkflowStatus {\n`;
  code += `  ACTIVE = 'active',\n`;
  code += `  SUSPENDED = 'suspended',\n`;
  code += `  COMPLETED = 'completed',\n`;
  code += `  CANCELLED = 'cancelled'\n`;
  code += `}\n\n`;

  // Interfaces
  code += `export interface Policy {\n`;
  code += `  id: string;\n`;
  code += `  name: string;\n`;
  code += `  title: string;\n`;
  code += `  category: string;\n`;
  code += `  type: string;\n`;
  code += `  status: PolicyStatus;\n`;
  code += `  version: string;\n`;
  code += `  complianceScore: number;\n`;
  code += `  approvals: PolicyApproval[];\n`;
  code += `  createdDate: Date;\n`;
  code += `  effectiveDate?: Date;\n`;
  code += `  nextReviewDate: Date;\n`;
  code += `}\n\n`;

  code += `export interface PolicyApproval {\n`;
  code += `  approverId: string;\n`;
  code += `  approverName: string;\n`;
  code += `  approverRole: string;\n`;
  code += `  status: ApprovalStatus;\n`;
  code += `  requestedDate: Date;\n`;
  code += `  reviewedDate?: Date;\n`;
  code += `  comments?: string;\n`;
  code += `}\n\n`;

  code += `export interface Workflow {\n`;
  code += `  id: string;\n`;
  code += `  name: string;\n`;
  code += `  type: string;\n`;
  code += `  status: WorkflowStatus;\n`;
  code += `  currentStep: number;\n`;
  code += `  steps: WorkflowStep[];\n`;
  code += `  startedDate: Date;\n`;
  code += `  completedDate?: Date;\n`;
  code += `  entityId: string;\n`;
  code += `}\n\n`;

  code += `export interface WorkflowStep {\n`;
  code += `  stepNumber: number;\n`;
  code += `  name: string;\n`;
  code += `  assignee: string;\n`;
  code += `  status: string;\n`;
  code += `  decision?: string;\n`;
  code += `  comments?: string;\n`;
  code += `}\n\n`;

  // Manager Class
  code += `export class GovernancePolicyManager extends EventEmitter {\n`;
  code += `  private policies: Map<string, Policy> = new Map();\n`;
  code += `  private workflows: Map<string, Workflow> = new Map();\n`;
  code += `  private violations: Map<string, PolicyViolation> = new Map();\n\n`;

  code += `  constructor() {\n`;
  code += `    super();\n`;
  code += `  }\n\n`;

  // Create Policy
  code += `  createPolicy(policy: Omit<Policy, 'id' | 'createdDate' | 'nextReviewDate' | 'complianceScore'>): Policy {\n`;
  code += `    const id = this.generateId('policy');\n`;
  code += `    const newPolicy: Policy = {\n`;
  code += `      ...policy,\n`;
  code += `      id,\n`;
  code += `      createdDate: new Date(),\n`;
  code += `      nextReviewDate: this.calculateNextReviewDate(),\n`;
  code += `      complianceScore: 100\n`;
  code += `    };\n\n`;
  code += `    this.policies.set(id, newPolicy);\n`;
  code += `    this.emit('policyCreated', newPolicy);\n`;
  code += `    return newPolicy;\n`;
  code += `  }\n\n`;

  // Approve Policy
  code += `  approvePolicy(policyId: string, approverId: string, approverName: string, comments?: string): Policy | undefined {\n`;
  code += `    const policy = this.policies.get(policyId);\n`;
  code += `    if (!policy) return undefined;\n\n`;
  code += `    const approval: PolicyApproval = {\n`;
  code += `      approverId,\n`;
  code += `      approverName,\n`;
  code += `      approverRole: 'Approver',\n`;
  code += `      status: ApprovalStatus.APPROVED,\n`;
  code += `      requestedDate: new Date(),\n`;
  code += `      reviewedDate: new Date(),\n`;
  code += `      comments\n`;
  code += `    };\n\n`;
  code += `    policy.approvals.push(approval);\n`;
  code += `    policy.status = PolicyStatus.APPROVED;\n`;
  code += `    policy.effectiveDate = new Date();\n\n`;
  code += `    this.emit('policyApproved', policy);\n`;
  code += `    return policy;\n`;
  code += `  }\n\n`;

  // Create Workflow
  code += `  createWorkflow(workflow: Omit<Workflow, 'id' | 'startedDate' | 'currentStep' | 'status'>): Workflow {\n`;
  code += `    const id = this.generateId('workflow');\n`;
  code += `    const newWorkflow: Workflow = {\n`;
  code += `      ...workflow,\n`;
  code += `      id,\n`;
  code += `      startedDate: new Date(),\n`;
  code += `      currentStep: 0,\n`;
  code += `      status: WorkflowStatus.ACTIVE\n`;
  code += `    };\n\n`;
  code += `    this.workflows.set(id, newWorkflow);\n`;
  code += `    this.emit('workflowCreated', newWorkflow);\n`;
  code += `    return newWorkflow;\n`;
  code += `  }\n\n`;

  // Advance Workflow
  code += `  advanceWorkflow(workflowId: string, decision: string, comments?: string): Workflow | undefined {\n`;
  code += `    const workflow = this.workflows.get(workflowId);\n`;
  code += `    if (!workflow) return undefined;\n\n`;
  code += `    const step = workflow.steps[workflow.currentStep];\n`;
  code += `    step.decision = decision;\n`;
  code += `    step.comments = comments;\n`;
  code += `    step.status = 'completed';\n\n`;
  code += `    if (decision === 'rejected') {\n`;
  code += `      workflow.status = WorkflowStatus.CANCELLED;\n`;
  code += `      workflow.completedDate = new Date();\n`;
  code += `    } else if (workflow.currentStep < workflow.steps.length - 1) {\n`;
  code += `      workflow.currentStep++;\n`;
  code += `      workflow.steps[workflow.currentStep].status = 'in-progress';\n`;
  code += `    } else {\n`;
  code += `      workflow.status = WorkflowStatus.COMPLETED;\n`;
  code += `      workflow.completedDate = new Date();\n`;
  code += `    }\n\n`;
  code += `    this.emit('workflowAdvanced', workflow);\n`;
  code += `    return workflow;\n`;
  code += `  }\n\n`;

  // List methods
  code += `  listPolicies(): Policy[] {\n`;
  code += `    return Array.from(this.policies.values()).sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());\n`;
  code += `  }\n\n`;

  code += `  listWorkflows(): Workflow[] {\n`;
  code += `    return Array.from(this.workflows.values()).sort((a, b) => b.startedDate.getTime() - a.startedDate.getTime());\n`;
  code += `  }\n\n`;

  // Get Summary
  code += `  getSummary(): GovernanceSummary {\n`;
  code += `    const policies = this.listPolicies();\n`;
  code += `    const workflows = this.listWorkflows();\n\n`;
  code += `    return {\n`;
  code += `      totalPolicies: policies.length,\n`;
  code += `      activePolicies: policies.filter(p => p.status === PolicyStatus.APPROVED).length,\n`;
  code += `      pendingApprovals: policies.filter(p => p.status === PolicyStatus.PENDING_REVIEW).length,\n`;
  code += `      avgComplianceScore: Math.round(policies.reduce((sum, p) => sum + p.complianceScore, 0) / policies.length || 0),\n`;
  code += `      totalWorkflows: workflows.length,\n`;
  code += `      activeWorkflows: workflows.filter(w => w.status === WorkflowStatus.ACTIVE).length\n`;
  code += `    };\n`;
  code += `  }\n\n`;

  // Private helpers
  code += `  private generateId(prefix: string): string {\n`;
  code += `    return \`\${prefix}-\${Date.now()}-\${randomUUID().substring(0, 8)}\`;\n`;
  code += `  }\n\n`;

  code += `  private calculateNextReviewDate(): Date {\n`;
  code += `    const date = new Date();\n`;
  code += `    date.setFullYear(date.getFullYear() + 1);\n`;
  code += `    return date;\n`;
  code += `  }\n`;
  code += `}\n\n`;

  code += `export interface PolicyViolation {\n`;
  code += `  id: string;\n`;
  code += `  policyId: string;\n`;
  code += `  severity: string;\n`;
  code += `  status: string;\n`;
  code += `  detectedDate: Date;\n`;
  code += `}\n\n`;

  code += `export interface GovernanceSummary {\n`;
  code += `  totalPolicies: number;\n`;
  code += `  activePolicies: number;\n`;
  code += `  pendingApprovals: number;\n`;
  code += `  avgComplianceScore: number;\n`;
  code += `  totalWorkflows: number;\n`;
  code += `  activeWorkflows: number;\n`;
  code += `}\n`;

  return code;
}

// Generate Python Manager
export function generatePythonManager(config: GovernanceConfig): string {
  let code = `# Governance Policy Manager - Python\n`;
  code += `# Generated for ${config.projectName}\n\n`;
  code += `from typing import Dict, List, Optional, Any\n`;
  code += `from dataclasses import dataclass, field\n`;
  code += `from datetime import datetime, date, timedelta\n`;
  code += `from enum import Enum\n`;
  code += `import uuid\n`;
  code += `import json\n\n`;

  // Enums
  code += `class PolicyStatus(Enum):\n`;
  code += `    DRAFT = "draft"\n`;
  code += `    PENDING_REVIEW = "pending-review"\n`;
  code += `    UNDER_REVIEW = "under-review"\n`;
  code += `    APPROVED = "approved"\n`;
  code += `    REJECTED = "rejected"\n`;
  code += `    DEPRECATED = "deprecated"\n`;
  code += `    ARCHIVED = "archived"\n\n`;

  code += `class ApprovalStatus(Enum):\n`;
  code += `    PENDING = "pending"\n`;
  code += `    APPROVED = "approved"\n`;
  code += `    REJECTED = "rejected"\n`;
  code += `    CONDITIONAL = "conditional"\n`;
  code += `    ESCALATED = "escalated"\n\n`;

  code += `class WorkflowStatus(Enum):\n`;
  code += `    ACTIVE = "active"\n`;
  code += `    SUSPENDED = "suspended"\n`;
  code += `    COMPLETED = "completed"\n`;
  code += `    CANCELLED = "cancelled"\n\n`;

  // Dataclasses
  code += `@dataclass\n`;
  code += `class PolicyApproval:\n`;
  code += `    approver_id: str\n`;
  code += `    approver_name: str\n`;
  code += `    approver_role: str\n`;
  code += `    status: ApprovalStatus\n`;
  code += `    requested_date: datetime\n`;
  code += `    reviewed_date: Optional[datetime] = None\n`;
  code += `    comments: Optional[str] = None\n\n`;

  code += `@dataclass\n`;
  code += `class Policy:\n`;
  code += `    id: str\n`;
  code += `    name: str\n`;
  code += `    title: str\n`;
  code += `    category: str\n`;
  code += `    type: str\n`;
  code += `    status: PolicyStatus\n`;
  code += `    version: str\n`;
  code += `    compliance_score: int\n`;
  code += `    approvals: List[PolicyApproval] = field(default_factory=list)\n`;
  code += `    created_date: datetime = field(default_factory=datetime.now)\n`;
  code += `    effective_date: Optional[datetime] = None\n`;
  code += `    next_review_date: datetime = field(default_factory=lambda: datetime.now() + timedelta(days=365))\n\n`;

  code += `@dataclass\n`;
  code += `class WorkflowStep:\n`;
  code += `    step_number: int\n`;
  code += `    name: str\n`;
  code += `    assignee: str\n`;
  code += `    status: str = "pending"\n`;
  code += `    decision: Optional[str] = None\n`;
  code += `    comments: Optional[str] = None\n\n`;

  code += `@dataclass\n`;
  code += `class Workflow:\n`;
  code += `    id: str\n`;
  code += `    name: str\n`;
  code += `    type: str\n`;
  code += `    status: WorkflowStatus\n`;
  code += `    current_step: int\n`;
  code += `    steps: List[WorkflowStep]\n`;
  code += `    entity_id: str\n`;
  code += `    started_date: datetime = field(default_factory=datetime.now)\n`;
  code += `    completed_date: Optional[datetime] = None\n\n`;

  // Manager Class
  code += `class GovernancePolicyManager:\n`;
  code += `    def __init__(self):\n`;
  code += `        self.policies: Dict[str, Policy] = {}\n`;
  code += `        self.workflows: Dict[str, Workflow] = {}\n`;
  code += `        self.violations: Dict[str, Any] = {}\n\n`;

  code += `    def generate_id(self, prefix: str) -> str:\n`;
  code += `        return f"{prefix}-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:8]}"\n\n`;

  code += `    def create_policy(\n`;
  code += `        self,\n`;
  code += `        name: str,\n`;
  code += `        title: str,\n`;
  code += `        category: str,\n`;
  code += `        policy_type: str,\n`;
  code += `        version: str,\n`;
  code += `        **kwargs\n`;
  code += `    ) -> Policy:\n`;
  code += `        policy_id = self.generate_id("policy")\n`;
  code += `        policy = Policy(\n`;
  code += `            id=policy_id,\n`;
  code += `            name=name,\n`;
  code += `            title=title,\n`;
  code += `            category=category,\n`;
  code += `            type=policy_type,\n`;
  code += `            status=PolicyStatus.DRAFT,\n`;
  code += `            version=version,\n`;
  code += `            compliance_score=100,\n`;
  code += `            next_review_date=datetime.now() + timedelta(days=365)\n`;
  code += `        )\n`;
  code += `        self.policies[policy_id] = policy\n`;
  code += `        return policy\n\n`;

  code += `    def approve_policy(\n`;
  code += `        self,\n`;
  code += `        policy_id: str,\n`;
  code += `        approver_id: str,\n`;
  code += `        approver_name: str,\n`;
  code += `        comments: Optional[str] = None\n`;
  code += `    ) -> Optional[Policy]:\n`;
  code += `        policy = self.policies.get(policy_id)\n`;
  code += `        if not policy:\n`;
  code += `            return None\n\n`;
  code += `        approval = PolicyApproval(\n`;
  code += `            approver_id=approver_id,\n`;
  code += `            approver_name=approver_name,\n`;
  code += `            approver_role="Approver",\n`;
  code += `            status=ApprovalStatus.APPROVED,\n`;
  code += `            requested_date=datetime.now(),\n`;
  code += `            reviewed_date=datetime.now(),\n`;
  code += `            comments=comments\n`;
  code += `        )\n\n`;
  code += `        policy.approvals.append(approval)\n`;
  code += `        policy.status = PolicyStatus.APPROVED\n`;
  code += `        policy.effective_date = datetime.now()\n\n`;
  code += `        return policy\n\n`;

  code += `    def create_workflow(\n`;
  code += `        self,\n`;
  code += `        name: str,\n`;
  code += `        workflow_type: str,\n`;
  code += `        entity_id: str,\n`;
  code += `        steps: List[WorkflowStep]\n`;
  code += `    ) -> Workflow:\n`;
  code += `        workflow_id = self.generate_id("workflow")\n`;
  code += `        workflow = Workflow(\n`;
  code += `            id=workflow_id,\n`;
  code += `            name=name,\n`;
  code += `            type=workflow_type,\n`;
  code += `            status=WorkflowStatus.ACTIVE,\n`;
  code += `            current_step=0,\n`;
  code += `            steps=steps,\n`;
  code += `            entity_id=entity_id\n`;
  code += `        )\n`;
  code += `        self.workflows[workflow_id] = workflow\n`;
  code += `        return workflow\n\n`;

  code += `    def advance_workflow(\n`;
  code += `        self,\n`;
  code += `        workflow_id: str,\n`;
  code += `        decision: str,\n`;
  code += `        comments: Optional[str] = None\n`;
  code += `    ) -> Optional[Workflow]:\n`;
  code += `        workflow = self.workflows.get(workflow_id)\n`;
  code += `        if not workflow:\n`;
  code += `            return None\n\n`;
  code += `        step = workflow.steps[workflow.current_step]\n`;
  code += `        step.decision = decision\n`;
  code += `        step.comments = comments\n`;
  code += `        step.status = "completed"\n\n`;
  code += `        if decision == "rejected":\n`;
  code += `            workflow.status = WorkflowStatus.CANCELLED\n`;
  code += `            workflow.completed_date = datetime.now()\n`;
  code += `        elif workflow.current_step < len(workflow.steps) - 1:\n`;
  code += `            workflow.current_step += 1\n`;
  code += `            workflow.steps[workflow.current_step].status = "in-progress"\n`;
  code += `        else:\n`;
  code += `            workflow.status = WorkflowStatus.COMPLETED\n`;
  code += `            workflow.completed_date = datetime.now()\n\n`;
  code += `        return workflow\n\n`;

  code += `    def list_policies(self) -> List[Policy]:\n`;
  code += `        return sorted(self.policies.values(), key=lambda p: p.created_date, reverse=True)\n\n`;

  code += `    def list_workflows(self) -> List[Workflow]:\n`;
  code += `        return sorted(self.workflows.values(), key=lambda w: w.started_date, reverse=True)\n\n`;

  code += `    def get_summary(self) -> Dict[str, Any]:\n`;
  code += `        policies = self.list_policies()\n`;
  code += `        workflows = self.list_workflows()\n\n`;
  code += `        return {\n`;
  code += `            "totalPolicies": len(policies),\n`;
  code += `            "activePolicies": sum(1 for p in policies if p.status == PolicyStatus.APPROVED),\n`;
  code += `            "pendingApprovals": sum(1 for p in policies if p.status == PolicyStatus.PENDING_REVIEW),\n`;
  code += `            "avgComplianceScore": round(sum(p.compliance_score for p in policies) / len(policies)) if policies else 0,\n`;
  code += `            "totalWorkflows": len(workflows),\n`;
  code += `            "activeWorkflows": sum(1 for w in workflows if w.status == WorkflowStatus.ACTIVE)\n`;
  code += `        }\n`;

  return code;
}

// Write files
export async function writeGovernanceFiles(
  config: GovernanceConfig,
  outputDir: string,
  language: 'typescript' | 'python'
): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write markdown documentation
  const markdown = generateGovernanceMarkdown(config);
  await fs.writeFile(path.join(outputDir, 'GOVERNANCE_GUIDE.md'), markdown);

  // Write config JSON
  await fs.writeFile(path.join(outputDir, 'governance-config.json'), JSON.stringify(config, null, 2));

  // Write Terraform configs for enabled providers
  for (const provider of config.providers) {
    const terraformDir = path.join(outputDir, 'terraform', provider);
    await fs.ensureDir(terraformDir);

    const tf = generateGovernanceTerraform(config, provider);
    await fs.writeFile(path.join(terraformDir, 'main.tf'), tf);
  }

  // Write manager code
  if (language === 'typescript') {
    const tsCode = generateTypeScriptManager(config);
    await fs.writeFile(path.join(outputDir, 'governance-manager.ts'), tsCode);

    const packageJson = {
      name: `${config.projectName}-governance`,
      version: '1.0.0',
      description: 'Governance Policy Management with Workflow Automation',
      main: 'governance-manager.ts',
      scripts: {
        'test': 'ts-node governance-manager.ts test',
        'report': 'ts-node governance-manager.ts report',
      },
      dependencies: {
        '@types/node': '^20.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        'ts-node': '^10.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonManager(config);
    await fs.writeFile(path.join(outputDir, 'governance_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'boto3>=1.28.0',
      'azure-identity>=1.13.0',
      'google-cloud-storage>=2.13.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }
}

// Display configuration
export function displayGovernanceConfig(config: GovernanceConfig, language: 'typescript' | 'python', outputDir: string): void {
  console.log(chalk.cyan('\n✨ Governance Policy Management with Workflow Automation'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Organization:'), config.organization);
  console.log(chalk.yellow('Language:'), language);
  console.log(chalk.yellow('Output:'), outputDir);
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));

  console.log(chalk.cyan('\n📊 Configuration:'));
  console.log(chalk.gray('  Policies:'), config.policies.length);
  console.log(chalk.gray('  Workflows:'), config.workflows.length);
  console.log(chalk.gray('  Approval Chains:'), config.approvalChains.length);
  console.log(chalk.gray('  Violations:'), config.violations.length);
  console.log(chalk.gray('  Compliance Frameworks:'), config.complianceFrameworks.length);

  console.log(chalk.cyan('\n⚙️  Settings:'));
  console.log(chalk.gray('  Require Approval:'), config.settings.requireApproval ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Auto Routing:'), config.settings.autoRouting ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Enable Escalation:'), config.settings.enableEscalation ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Enable Notifications:'), config.settings.enableNotifications ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Enable Audit Logging:'), config.settings.enableAuditLogging ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Enable Compliance Checks:'), config.settings.enableComplianceChecks ? chalk.green('Yes') : chalk.red('No'));
  console.log(chalk.gray('  Auto Remediation:'), config.settings.autoRemediation ? chalk.green('Yes') : chalk.red('No'));

  console.log(chalk.cyan('\n☁️  Cloud Providers:'));
  for (const provider of config.providers) {
    console.log(chalk.gray(`  - ${provider.toUpperCase()}`));
  }

  console.log(chalk.cyan('\n📁 Output Files:'));
  console.log(chalk.gray(`  - GOVERNANCE_GUIDE.md`));
  console.log(chalk.gray(`  - governance-config.json`));
  console.log(chalk.gray(`  - ${language === 'typescript' ? 'governance-manager.ts' : 'governance_manager.py'}`));
  console.log(chalk.gray(`  - terraform/{provider}/main.tf`));

  console.log(chalk.gray('\n────────────────────────────────────────────────────────────\n'));
}

// Create example configuration
export function createExampleGovernanceConfig(): GovernanceConfig {
  return {
    projectName: 'my-governance',
    organization: 'Acme Corp',
    providers: ['aws', 'azure', 'gcp'],
    settings: {
      requireApproval: true,
      requiredApprovers: 2,
      autoRouting: true,
      enableEscalation: true,
      escalationTimeout: 48,
      enableNotifications: true,
      notificationChannels: ['email' as const, 'slack' as const],
      enableAuditLogging: true,
      auditRetentionDays: 2555, // 7 years
      enableComplianceChecks: true,
      complianceCheckFrequency: 'weekly',
      enableViolationTracking: true,
      autoRemediation: false,
      policyVersioning: true,
      requirePolicyReview: true,
      policyReviewFrequency: 'annual',
      enableWorkflowAutomation: true,
      workflowTimeout: 14,
      allowDelegation: true,
      requireComments: true,
      enableReporting: true,
      reportFrequency: 'monthly',
      stakeholders: ['ciso@acme.com', 'compliance@acme.com', 'legal@acme.com'],
    },
    policies: [
      {
        id: 'policy-001',
        name: 'data-retention-policy',
        title: 'Data Retention Policy',
        description: 'Policy governing the retention and disposal of organizational data',
        category: 'data-privacy',
        type: 'policy',
        status: 'approved',
        version: '2.1',
        complianceLevel: 'mandatory',
        purpose: 'To ensure data is retained for legal and business requirements while securely disposing of data no longer needed',
        scope: ['All departments', 'All systems', 'All data types'],
        statement: 'Data shall be retained according to its classification and legal requirements. All data disposal must follow approved procedures.',
        procedures: [
          {
            id: 'proc-001',
            name: 'Data Classification',
            description: 'Classify data according to sensitivity',
            steps: [
              {
                stepNumber: 1,
                action: 'Review data content',
                responsible: 'Data Owner',
                expectedDuration: 30,
                verification: 'Classification recorded',
              },
              {
                stepNumber: 2,
                action: 'Assign classification level',
                responsible: 'Data Owner',
                expectedDuration: 15,
                verification: 'Classification label applied',
              },
            ],
            owner: 'Data Governance Team',
            frequency: 'on creation',
            requiredResources: ['Data classification tool', 'Training materials'],
          },
        ],
        responsibilities: [
          {
            role: 'Data Owner',
            responsibilities: ['Classify data', 'Approve data disposal', 'Maintain data inventory'],
            accountabilities: ['Data accuracy', 'Compliance with retention schedules'],
            authority: ['Approve data access requests', 'Authorize data disposal'],
          },
          {
            role: 'Data Steward',
            responsibilities: ['Maintain data quality', 'Monitor compliance', 'Report violations'],
            accountabilities: ['Data completeness', 'Retention schedule adherence'],
            authority: ['Access data for quality checks', 'Escalate compliance issues'],
          },
        ],
        references: ['GDPR Article 5(1)(e)', 'SOC 2 Requirement 6.1'],
        approvalChainId: 'chain-001',
        approvals: [
          {
            approverId: 'user-001',
            approverName: 'Jane Smith',
            approverRole: 'CISO',
            status: 'approved',
            requestedDate: new Date('2024-10-01'),
            reviewedDate: new Date('2024-10-05'),
            comments: 'Policy meets all security and compliance requirements',
          },
          {
            approverId: 'user-002',
            approverName: 'John Doe',
            approverRole: 'Legal Counsel',
            status: 'approved',
            requestedDate: new Date('2024-10-01'),
            reviewedDate: new Date('2024-10-06'),
            comments: 'Legal requirements addressed',
          },
        ],
        conditions: [],
        createdDate: new Date('2024-01-15'),
        createdBy: 'policy-admin',
        lastUpdated: new Date('2024-10-06'),
        updatedBy: 'Jane Smith',
        effectiveDate: new Date('2024-10-10'),
        reviewDate: new Date('2025-10-10'),
        nextReviewDate: new Date('2025-10-10'),
        applicableFrameworks: ['framework-001', 'framework-002'],
        controls: [
          {
            id: 'control-001',
            controlId: 'DR-01',
            description: 'Data retention schedules implemented',
            type: 'preventive',
            automation: 'automated',
            implementation: 'DLP solution with retention labels',
            validation: 'Quarterly audit of retention labels',
            frequency: 'continuous',
          },
        ],
        violationPenalties: ['Security training required', 'Performance review impact', 'Re-approval of access'],
        complianceScore: 95,
        violationsCount: 1,
        lastComplianceCheck: new Date('2024-12-01'),
        tags: ['data', 'privacy', 'gdpr', 'critical'],
        documents: [
          {
            id: 'doc-001',
            name: 'Data Retention Schedule',
            type: 'procedure',
            url: 'https://docs.acme.com/retention-schedule',
            version: '2.1',
            lastUpdated: new Date('2024-10-01'),
          },
        ],
        relatedPolicies: [],
        dependencies: [],
        dependents: ['policy-002'],
      },
      {
        id: 'policy-002',
        name: 'access-control-policy',
        title: 'Access Control Policy',
        description: 'Policy governing access to organizational systems and data',
        category: 'security',
        type: 'policy',
        status: 'approved',
        version: '3.0',
        complianceLevel: 'mandatory',
        purpose: 'To ensure only authorized individuals have access to organizational resources',
        scope: ['All systems', 'All facilities', 'All data'],
        statement: 'Access shall be granted based on principle of least privilege and business need',
        procedures: [],
        responsibilities: [
          {
            role: 'System Owner',
            responsibilities: ['Approve access requests', 'Review access logs'],
            accountabilities: ['Unauthorized access prevention', 'Access review completion'],
            authority: ['Grant access', 'Revoke access'],
          },
        ],
        references: ['ISO 27001 A.9', 'NIST AC-1'],
        approvalChainId: 'chain-001',
        approvals: [
          {
            approverId: 'user-001',
            approverName: 'Jane Smith',
            approverRole: 'CISO',
            status: 'approved',
            requestedDate: new Date('2024-09-01'),
            reviewedDate: new Date('2024-09-05'),
            comments: 'Access control requirements met',
          },
        ],
        conditions: [],
        createdDate: new Date('2023-06-01'),
        createdBy: 'policy-admin',
        lastUpdated: new Date('2024-09-05'),
        updatedBy: 'Jane Smith',
        effectiveDate: new Date('2024-09-10'),
        nextReviewDate: new Date('2025-09-10'),
        applicableFrameworks: ['framework-001'],
        controls: [],
        violationPenalties: ['Access revocation', 'Mandatory security training'],
        complianceScore: 88,
        violationsCount: 3,
        lastComplianceCheck: new Date('2024-12-01'),
        tags: ['security', 'access', 'iam'],
        documents: [],
        relatedPolicies: ['policy-001'],
        dependencies: ['policy-001'],
        dependents: [],
      },
      {
        id: 'policy-003',
        name: 'acceptable-use-policy',
        title: 'Acceptable Use Policy',
        description: 'Policy governing acceptable use of organizational resources',
        category: 'operational',
        type: 'policy',
        status: 'pending-review',
        version: '1.5',
        complianceLevel: 'required',
        purpose: 'To define acceptable use of company resources and establish employee responsibilities',
        scope: ['All employees', 'All contractors', 'All company equipment'],
        statement: 'Company resources must be used for legitimate business purposes only',
        procedures: [],
        responsibilities: [
          {
            role: 'Employee',
            responsibilities: ['Follow AUP guidelines', 'Report violations', 'Protect company assets'],
            accountabilities: ['Personal use compliance', 'Security incident reporting'],
            authority: [],
          },
        ],
        references: ['Employee Handbook Section 5'],
        approvalChainId: 'chain-002',
        approvals: [],
        conditions: [],
        createdDate: new Date('2024-11-01'),
        createdBy: 'hr-admin',
        lastUpdated: new Date('2024-11-01'),
        updatedBy: 'hr-admin',
        nextReviewDate: new Date('2025-11-01'),
        applicableFrameworks: [],
        controls: [],
        violationPenalties: ['Warning', 'Suspension of privileges', 'Termination'],
        complianceScore: 100,
        violationsCount: 0,
        tags: ['hr', 'employee', 'operations'],
        documents: [],
        relatedPolicies: [],
        dependencies: [],
        dependents: [],
      },
    ],
    workflows: [
      {
        id: 'workflow-001',
        name: 'Policy Approval Workflow - Data Retention v2.1',
        description: 'Approval workflow for data retention policy update',
        type: 'policy-approval',
        status: 'completed',
        steps: [
          {
            stepNumber: 0,
            name: 'CISO Review',
            type: 'review',
            description: 'Security and compliance review',
            assignee: 'user-001',
            assigneeRole: 'CISO',
            status: 'completed',
            startedDate: new Date('2024-10-01T09:00:00'),
            completedDate: new Date('2024-10-05T14:30:00'),
            duration: 0,
            required: true,
            allowDelegation: true,
            escalationTimeout: 48,
            decision: 'approved',
            comments: 'All security requirements addressed',
          },
          {
            stepNumber: 1,
            name: 'Legal Review',
            type: 'approval',
            description: 'Legal and regulatory compliance review',
            assignee: 'user-002',
            assigneeRole: 'Legal Counsel',
            status: 'completed',
            startedDate: new Date('2024-10-05T15:00:00'),
            completedDate: new Date('2024-10-06T10:00:00'),
            duration: 0,
            required: true,
            allowDelegation: true,
            escalationTimeout: 72,
            decision: 'approved',
            comments: 'GDPR and other legal requirements met',
          },
          {
            stepNumber: 2,
            name: 'Final Approval',
            type: 'approval',
            description: 'Executive approval for policy publication',
            assignee: 'user-003',
            assigneeRole: 'CTO',
            status: 'completed',
            startedDate: new Date('2024-10-06T11:00:00'),
            completedDate: new Date('2024-10-07T09:00:00'),
            duration: 0,
            required: true,
            allowDelegation: false,
            escalationTimeout: 24,
            decision: 'approved',
            comments: 'Approved for publication',
          },
        ],
        currentStep: 2,
        autoAdvance: false,
        allowParallel: false,
        startedDate: new Date('2024-10-01T09:00:00'),
        startedBy: 'policy-admin',
        completedDate: new Date('2024-10-07T09:00:00'),
        timeoutDate: new Date('2024-10-15T09:00:00'),
        entityId: 'policy-001',
        entityType: 'policy',
        initiator: 'policy-admin',
        participants: [
          {
            userId: 'user-001',
            userName: 'Jane Smith',
            role: 'CISO',
            addedDate: new Date('2024-10-01T09:00:00'),
            addedBy: 'policy-admin',
          },
          {
            userId: 'user-002',
            userName: 'John Doe',
            role: 'Legal Counsel',
            addedDate: new Date('2024-10-01T09:00:00'),
            addedBy: 'policy-admin',
          },
        ],
        escalations: [],
        history: [
          {
            timestamp: new Date('2024-10-01T09:00:00'),
            action: 'workflow-started',
            performedBy: 'policy-admin',
            details: 'Workflow initiated for policy-001',
          },
          {
            timestamp: new Date('2024-10-05T14:30:00'),
            action: 'step-completed',
            performedBy: 'user-001',
            details: 'CISO review completed - approved',
          },
          {
            timestamp: new Date('2024-10-06T10:00:00'),
            action: 'step-completed',
            performedBy: 'user-002',
            details: 'Legal review completed - approved',
          },
          {
            timestamp: new Date('2024-10-07T09:00:00'),
            action: 'workflow-completed',
            performedBy: 'user-003',
            details: 'Final approval granted - policy approved',
          },
        ],
        outcome: {
          status: 'approved',
          decidedBy: 'user-003',
          decidedDate: new Date('2024-10-07T09:00:00'),
          reason: 'All review steps completed successfully',
        },
      },
    ],
    approvalChains: [
      {
        id: 'chain-001',
        name: 'Security Policy Approval Chain',
        description: 'Standard approval chain for security-related policies',
        category: 'security',
        适用: ['policy', 'procedure', 'guideline'],
        levels: [
          {
            level: 1,
            name: 'Technical Review',
            approvers: [
              {
                userId: 'user-001',
                userName: 'Jane Smith',
                role: 'CISO',
                primary: true,
              },
            ],
            requireAll: false,
            timeout: 48,
            escalationLevel: 2,
          },
          {
            level: 2,
            name: 'Legal Review',
            approvers: [
              {
                userId: 'user-002',
                userName: 'John Doe',
                role: 'Legal Counsel',
                primary: true,
              },
            ],
            requireAll: false,
            timeout: 72,
            escalationLevel: 3,
          },
          {
            level: 3,
            name: 'Executive Approval',
            approvers: [
              {
                userId: 'user-003',
                userName: 'Bob Wilson',
                role: 'CTO',
                primary: true,
              },
            ],
            requireAll: false,
            timeout: 24,
          },
        ],
        requireAllLevels: true,
        allowParallel: false,
        timeout: 14,
        autoEscalate: true,
        escalationAction: 'escalate-up',
        allowDelegation: true,
        requireComments: true,
      },
      {
        id: 'chain-002',
        name: 'HR Policy Approval Chain',
        description: 'Approval chain for HR-related policies',
        category: 'hr',
        适用: ['policy', 'guideline'],
        levels: [
          {
            level: 1,
            name: 'HR Review',
            approvers: [
              {
                userId: 'user-004',
                userName: 'Sarah Johnson',
                role: 'HR Director',
                primary: true,
              },
            ],
            requireAll: false,
            timeout: 72,
          },
          {
            level: 2,
            name: 'Legal Review',
            approvers: [
              {
                userId: 'user-002',
                userName: 'John Doe',
                role: 'Legal Counsel',
                primary: true,
              },
            ],
            requireAll: false,
            timeout: 72,
          },
        ],
        requireAllLevels: true,
        allowParallel: false,
        timeout: 10,
        autoEscalate: true,
        escalationAction: 'escalate-up',
        allowDelegation: true,
        requireComments: false,
      },
    ],
    violations: [
      {
        id: 'violation-001',
        policyId: 'policy-002',
        policyName: 'Access Control Policy',
        violationType: 'Unauthorized Access',
        severity: 'high',
        status: 'remediated',
        detectedDate: new Date('2024-11-15T10:30:00'),
        detectedBy: 'system-id-001',
        detectionMethod: 'SIEM Alert - Excessive Failed Logins',
        description: 'User account showed excessive failed login attempts indicating potential unauthorized access attempt',
        affectedEntities: ['user-account-12345', 'system-payroll'],
        evidence: [
          {
            type: 'system-alert',
            description: 'SIEM alert triggered - 50 failed login attempts in 5 minutes',
            url: 'https://siem.acme.com/alerts/ALT-12345',
            timestamp: new Date('2024-11-15T10:30:00'),
            collectedBy: 'system-id-001',
          },
        ],
        riskImpact: 'Potential unauthorized access to payroll data',
        potentialPenalty: 'Regulatory fines, employee data exposure',
        affectedFrameworks: ['framework-001'],
        workflowId: 'workflow-002',
        assignedTo: 'user-001',
        dueDate: new Date('2024-11-22T10:30:00'),
        remediationPlan: 'Account locked, investigation completed, additional controls implemented',
        remediationSteps: [
          {
            stepNumber: 1,
            action: 'Lock affected user account',
            assignedTo: 'helpdesk',
            status: 'completed',
            dueDate: new Date('2024-11-15T11:00:00'),
            completedDate: new Date('2024-11-15T10:45:00'),
          },
          {
            stepNumber: 2,
            action: 'Investigate access attempts',
            assignedTo: 'security-team',
            status: 'completed',
            dueDate: new Date('2024-11-18T10:30:00'),
            completedDate: new Date('2024-11-17T16:00:00'),
          },
          {
            stepNumber: 3,
            action: 'Implement additional monitoring',
            assignedTo: 'it-ops',
            status: 'completed',
            dueDate: new Date('2024-11-20T10:30:00'),
            completedDate: new Date('2024-11-19T14:00:00'),
          },
        ],
        resolvedDate: new Date('2024-11-19T14:00:00'),
        resolvedBy: 'user-001',
        timeToDetect: 5,
        timeToResolve: 5685, // ~4 days
      },
    ],
    audits: [
      {
        id: 'audit-001',
        timestamp: new Date('2024-10-01T09:00:00'),
        eventType: 'policy-created',
        userId: 'policy-admin',
        userName: 'Policy Admin',
        action: 'created',
        entityType: 'policy',
        entityId: 'policy-001',
        entityName: 'data-retention-policy',
        details: { category: 'data-privacy', type: 'policy', version: '2.1' },
      },
      {
        id: 'audit-002',
        timestamp: new Date('2024-10-07T09:00:00'),
        eventType: 'policy-approved',
        userId: 'user-003',
        userName: 'Bob Wilson',
        action: 'approved',
        entityType: 'policy',
        entityId: 'policy-001',
        entityName: 'data-retention-policy',
        details: { workflowId: 'workflow-001', comments: 'Approved for publication' },
      },
      {
        id: 'audit-003',
        timestamp: new Date('2024-11-15T10:30:00'),
        eventType: 'violation-detected',
        userId: 'system-id-001',
        userName: 'SIEM System',
        action: 'detected',
        entityType: 'violation',
        entityId: 'violation-001',
        entityName: 'Unauthorized Access',
        details: { policyId: 'policy-002', severity: 'high', detectionMethod: 'SIEM Alert' },
      },
    ],
    complianceFrameworks: [
      {
        id: 'framework-001',
        name: 'ISO 27001 Information Security',
        type: 'iso-27001',
        version: '2022',
        status: 'active',
        description: 'International standard for information security management',
        scope: ['Information Security Management System', 'All organizational data'],
        requirements: [
          {
            id: 'req-001',
            requirementId: 'A.9.1.1',
            category: 'Access Control',
            title: 'Access Control Policy',
            description: 'An access control policy shall be established, documented, and reviewed',
            mandatory: true,
            mappedControls: ['control-001'],
            status: 'compliant',
          },
          {
            id: 'req-002',
            requirementId: 'A.18.1.4',
            category: 'Data Protection',
            title: 'Data Retention',
            description: 'Retention periods for data shall be defined and enforced',
            mandatory: true,
            mappedControls: ['control-DR-01'],
            status: 'compliant',
          },
        ],
        controls: [
          {
            controlId: 'A.9.1.1',
            title: 'Access Control Policy',
            description: 'Policy governing access to organizational assets',
            category: 'Access Control',
            implementationStatus: 'implemented',
            policyMappings: ['policy-002'],
            testProcedures: ['Annual access review', 'Quarterly audit log review'],
            lastTested: new Date('2024-09-15'),
            testResult: 'pass',
          },
          {
            controlId: 'A.18.1.4',
            title: 'Data Retention',
            description: 'Data retention schedules and disposal procedures',
            category: 'Data Protection',
            implementationStatus: 'implemented',
            policyMappings: ['policy-001'],
            testProcedures: ['Quarterly retention audit', 'DLP system verification'],
            lastTested: new Date('2024-11-01'),
            testResult: 'pass',
          },
        ],
        certificationRequired: true,
        certifiedDate: new Date('2023-06-15'),
        expiryDate: new Date('2026-06-15'),
        certifyingBody: 'BSI',
        mappedPolicies: ['policy-001', 'policy-002'],
        complianceScore: 92,
        lastAssessment: new Date('2024-11-01'),
        nextAssessment: new Date('2025-05-01'),
        owner: 'Jane Smith',
        team: ['security-team', 'compliance-team', 'it-ops'],
      },
      {
        id: 'framework-002',
        name: 'SOC 2 Type II',
        type: 'soc-2',
        version: '2017',
        status: 'active',
        description: 'Service Organization Control 2 reporting framework',
        scope: ['System security', 'Availability', 'Processing integrity', 'Confidentiality', 'Privacy'],
        requirements: [
          {
            id: 'req-003',
            requirementId: 'CC6.1',
            category: 'Logical and Physical Access',
            title: 'Access to Assets',
            description: 'The entity restricts access to assets to authorized personnel',
            mandatory: true,
            mappedControls: ['control-ACC-001'],
            status: 'compliant',
          },
          {
            id: 'req-004',
            requirementId: 'CC6.6',
            category: 'Data Disposal',
            title: 'Disposal of Assets',
            description: 'The entity disposes of assets securely',
            mandatory: true,
            mappedControls: ['control-DISP-001'],
            status: 'compliant',
          },
        ],
        controls: [],
        certificationRequired: true,
        certifiedDate: new Date('2024-01-15'),
        expiryDate: new Date('2025-01-15'),
        certifyingBody: 'Independent Auditor',
        mappedPolicies: ['policy-001'],
        complianceScore: 88,
        lastAssessment: new Date('2024-10-15'),
        nextAssessment: new Date('2025-01-15'),
        owner: 'John Doe',
        team: ['compliance-team', 'security-team'],
      },
    ],
  };
}
