// Vendor Security Assessment and Management with Scorecards

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Type Definitions
export type VendorTier = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';
export type VendorStatus = 'active' | 'inactive' | 'on-hold' | 'under-review' | 'terminated';
export type VendorCategory = 'software' | 'infrastructure' | 'professional-services' | 'data-processing' | 'cloud-provider' | 'custom';
export type AssessmentStatus = 'pending' | 'in-progress' | 'completed' | 'approved' | 'rejected' | 'expired';
export type RiskRating = 'critical' | 'high' | 'medium' | 'low' | 'acceptable';
export type ComplianceRating = 'compliant' | 'partial' | 'non-compliant' | 'not-assessed';
export type ScorecardStatus = 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected';
export type QuestionnaireStatus = 'not-started' | 'in-progress' | 'submitted' | 'reviewed';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'in-progress' | 'remediated' | 'accepted' | 'false-positive';
export type ControlType = 'preventive' | 'detective' | 'corrective';
export type AssessmentFrequency = 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'on-demand';

export interface VendorAssessmentConfig {
  projectName: string;
  providers: Array<'aws' | 'azure' | 'gcp'>;
  settings: AssessmentSettings;
  vendors: Vendor[];
  assessments: VendorAssessment[];
  scorecards: VendorScorecard[];
  questionnaires: SecurityQuestionnaire[];
  findings: VendorFinding[];
  reviews: VendorReview[];
  approvals: Approval[];
  contracts: VendorContract[];
  incidents: VendorIncident[];
}

export interface AssessmentSettings {
  autoAssessment: boolean;
  assessmentFrequency: AssessmentFrequency;
  requireApproval: boolean;
  approvers: string[];
  riskThreshold: number; // 0-100
  enableContinuousMonitoring: boolean;
  monitoringInterval: number; // days
  enableQuestionnaires: boolean;
  questionnaireTemplate: string;
  enableScorecards: boolean;
  scorecardWeighting: ScorecardWeighting;
  enableFindings: boolean;
  findingRetentionDays: number;
  enableAuditLogging: boolean;
  notifyFindings: boolean;
  notificationChannels: Array<'email' | 'slack' | 'teams' | 'webhook'>;
  enableBenchmarking: boolean;
  benchmarkIndustry: string;
  requireContractReview: boolean;
  contractReviewFrequency: AssessmentFrequency;
  enableIncidentTracking: boolean;
  incidentRetentionDays: number;
  requireSoc2: boolean;
  requireIso27001: boolean;
  requireHipaa: boolean;
  requirePciDss: boolean;
  requireGdpr: boolean;
  customRequirements: string[];
}

export interface ScorecardWeighting {
  securityPosture: number; // percentage
  complianceCertifications: number;
  financialHealth: number;
  operationalMaturity: number;
  incidentHistory: number;
  contractTerms: number;
  dataProtection: number;
  serviceLevelAgreement: number;
}

export interface Vendor {
  id: string;
  name: string;
  description: string;
  website: string;
  category: VendorCategory;
  tier: VendorTier;
  status: VendorStatus;
  riskRating: RiskRating;
  overallScore: number; // 0-100
  lastAssessed: Date;
  nextAssessment: Date;
  onboardingDate: Date;
  terminationDate?: Date;
  owner: string;
  technicalContact: string;
  businessContact: string;
  escalationContact?: string;
  services: string[];
  dataAccess: DataAccess[];
  certifications: Certification[];
  contracts: string[]; // contract IDs
  assessments: string[]; // assessment IDs
  findings: string[]; // finding IDs
  incidents: string[]; // incident IDs
  tags: string[];
  regions: string[];
  sla: ServiceLevelAgreement;
  spending: {
    annual: number;
    currency: string;
    budgetCode: string;
  };
  riskFactors: RiskFactor[];
  dependencies: string[]; // vendor IDs they depend on
  dependents: string[]; // vendor IDs that depend on this vendor
  metadata: VendorMetadata;
}

export interface DataAccess {
  id: string;
  dataType: string;
  category: 'personal' | 'financial' | 'health' | 'confidential' | 'public' | 'proprietary';
  accessLevel: 'full' | 'limited' | 'read-only' | 'processed';
  purpose: string;
  storageLocation: string;
  retentionPeriod: string;
  encryptionRequired: boolean;
  encryptionVerified: boolean;
  dataResidency: string[];
  subProcessors: string[];
}

export interface Certification {
  id: string;
  name: string;
  framework: 'soc-2' | 'iso-27001' | 'iso-27017' | 'hipaa' | 'pci-dss' | 'gdpr' | 'csa-star' | 'custom';
  status: 'valid' | 'expired' | 'pending' | 'revoked';
  issueDate: Date;
  expiryDate: Date;
  certificateNumber?: string;
  issuer: string;
  scope: string;
  verified: boolean;
  verifiedDate?: Date;
  evidenceUrl?: string;
}

export interface ServiceLevelAgreement {
  availability: number; // percentage
  responseTime: number; // milliseconds
  resolutionTime: {
    critical: number; // hours
    high: number;
    medium: number;
    low: number;
  };
  uptimeGuarantee: number; // percentage
  penaltyClauses: boolean;
  creditPercentage: number;
  reporting: boolean;
  reportingFrequency: string;
}

export interface RiskFactor {
  category: 'geopolitical' | 'financial' | 'operational' | 'security' | 'compliance' | 'reputational';
  description: string;
  severity: RiskRating;
  mitigation: string;
  lastReviewed: Date;
}

export interface VendorMetadata {
  created: Date;
  createdBy: string;
  lastModified: Date;
  modifiedBy: string;
  source: string; // where vendor info came from
  externalReferences: string[];
  notes: string;
  customFields: Record<string, any>;
}

export interface VendorAssessment {
  id: string;
  vendorId: string;
  vendorName: string;
  assessmentDate: Date;
  assessor: string;
  reviewers: string[];
  status: AssessmentStatus;
  type: 'initial' | 'periodic' | 'event-driven' | 'exit';
  scope: AssessmentScope;
  securityPosture: SecurityPosture;
  complianceAssessment: ComplianceAssessment;
  operationalMaturity: OperationalMaturity;
  financialHealth: FinancialHealth;
  riskScore: number;
  riskRating: RiskRating;
  findings: string[]; // finding IDs
  recommendations: string[];
  approvedBy?: string;
  approvedAt?: Date;
  expiryDate: Date;
  nextAssessment: Date;
}

export interface AssessmentScope {
  services: string[];
  regions: string[];
  dataTypes: string[];
  processes: string[];
  excludeScope: string[];
}

export interface SecurityPosture {
  overallScore: number;
  domains: SecurityDomain[];
  controls: SecurityControl[];
  vulnerabilities: Vulnerability[];
  testingPerformed: TestingSummary;
}

export interface SecurityDomain {
  name: string;
  category: 'access-control' | 'encryption' | 'network-security' | 'application-security' | 'data-protection' | 'incident-response' | 'monitoring' | 'governance';
  score: number;
  weight: number;
  findings: string[];
  maturityLevel: 'initial' | 'developing' | 'defined' | 'managed' | 'optimized';
}

export interface SecurityControl {
  id: string;
  name: string;
  description: string;
  type: ControlType;
  status: 'implemented' | 'partial' | 'planned' | 'not-implemented';
  effectiveness: 'high' | 'medium' | 'low';
  testingMethod: string;
  lastTested?: Date;
  testResult: 'pass' | 'fail' | 'partial';
  evidence: string[];
}

export interface Vulnerability {
  id: string;
  severity: FindingSeverity;
  description: string;
  affectedAsset: string;
  discoveredDate: Date;
  status: FindingStatus;
  remediation: string;
  targetDate?: Date;
}

export interface TestingSummary {
  penetrationTest: boolean;
  testDate?: Date;
  testProvider?: string;
  vulnerabilityScan: boolean;
  scanDate?: Date;
  codeReview: boolean;
  reviewDate?: Date;
  complianceAudit: boolean;
  auditDate?: Date;
}

export interface ComplianceAssessment {
  overallScore: number;
  frameworks: FrameworkAssessment[];
  gaps: ComplianceGap[];
  evidenceRequests: EvidenceRequest[];
}

export interface FrameworkAssessment {
  framework: string;
  status: ComplianceRating;
  score: number;
  requirements: RequirementAssessment[];
  lastReviewed: Date;
  nextReview: Date;
}

export interface RequirementAssessment {
  requirementId: string;
  description: string;
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-applicable';
  gap?: string;
  evidence: string[];
}

export interface ComplianceGap {
  id: string;
  framework: string;
  requirement: string;
  description: string;
  severity: FindingSeverity;
  remediationPlan: string;
  targetDate: Date;
  owner: string;
}

export interface EvidenceRequest {
  id: string;
  type: string;
  description: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  dueDate: Date;
  submittedDate?: Date;
  url?: string;
}

export interface OperationalMaturity {
  overallScore: number;
  peopleScore: number;
  processScore: number;
  technologyScore: number;
  metrics: OperationalMetric[];
}

export interface OperationalMetric {
  name: string;
  value: number;
  target: number;
  status: 'on-track' | 'at-risk' | 'off-track';
  trend: 'improving' | 'stable' | 'declining';
}

export interface FinancialHealth {
  overallScore: number;
  revenue: string;
  profitability: string;
  debtToEquity: string;
  yearsInBusiness: number;
  employeeCount: number;
  insuranceCoverage: boolean;
  insuranceAmount?: number;
  dependencies: string[]; // key customer/technology dependencies
}

export interface VendorScorecard {
  id: string;
  vendorId: string;
  vendorName: string;
  period: string;
  status: ScorecardStatus;
  generatedDate: Date;
  generatedBy: string;
  reviewedBy?: string;
  reviewedDate?: Date;
  approvedBy?: string;
  approvedDate?: Date;
  overallScore: number;
  rating: RiskRating;
  categories: ScorecardCategory[];
  trend: 'improving' | 'stable' | 'declining';
  trendScore: number; // change from previous period
  benchmarkComparison?: BenchmarkComparison;
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
  actionItems: ActionItem[];
}

export interface ScorecardCategory {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  metrics?: ScorecardMetric[];
  status: 'excellent' | 'good' | 'satisfactory' | 'needs-improvement' | 'unacceptable';
  comments: string;
}

export interface ScorecardMetric {
  name: string;
  value: number | string | boolean;
  target: number | string | boolean;
  score: number;
  weight: number;
  description: string;
  evidence?: string;
}

export interface BenchmarkComparison {
  industryAverage: number;
  percentile: number; // 0-100
  rank: string; // e.g., "Top 10%"
  peers: number;
}

export interface ActionItem {
  id: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTo: string;
  dueDate: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  completedDate?: Date;
}

export interface SecurityQuestionnaire {
  id: string;
  vendorId: string;
  vendorName: string;
  template: string;
  version: string;
  status: QuestionnaireStatus;
  assignedTo: string;
  assignedDate: Date;
  dueDate: Date;
  submittedDate?: Date;
  reviewedBy?: string;
  reviewedDate?: Date;
  sections: QuestionnaireSection[];
  overallScore: number;
  responses: QuestionResponse[];
  attachments: Attachment[];
  comments: string;
}

export interface QuestionnaireSection {
  id: string;
  name: string;
  category: string;
  order: number;
  questions: Question[];
  score: number;
  completed: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: 'yes-no' | 'multiple-choice' | 'text' | 'upload' | 'rating';
  required: boolean;
  weight: number;
  options?: string[];
  response?: QuestionResponse;
}

export interface QuestionResponse {
  questionId: string;
  answer: string | string[] | boolean;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  verified: boolean;
  verifiedBy?: string;
  verifiedDate?: Date;
  comments?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedDate: Date;
}

export interface VendorFinding {
  id: string;
  vendorId: string;
  vendorName: string;
  assessmentId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: 'security' | 'compliance' | 'operational' | 'contractual' | 'data-protection';
  status: FindingStatus;
  discoveredDate: Date;
  discoveredBy: string;
  dueDate?: Date;
  remediation: string;
  assignedTo: string;
  progress: number; // 0-100
  lastUpdated: Date;
  updatedBy: string;
  resolutions: Resolution[];
  impact: string;
  references: string[];
}

export interface Resolution {
  date: Date;
  action: string;
  performedBy: string;
  notes: string;
  evidence: string[];
}

export interface VendorReview {
  id: string;
  vendorId: string;
  vendorName: string;
  reviewType: 'periodic' | 'event-driven' | 'exit' | 'escalation';
  reviewDate: Date;
  reviewers: string[];
  purpose: string;
  scope: string[];
  findings: string[];
  decisions: ReviewDecision[];
  recommendations: string[];
  outcome: 'continue' | 'modify' | 'terminate' | 'escalate';
  nextReview: Date;
}

export interface ReviewDecision {
  area: string;
  decision: 'approve' | 'conditional' | 'reject';
  rationale: string;
  conditions?: string[];
}

export interface Approval {
  id: string;
  entityType: 'vendor' | 'assessment' | 'scorecard' | 'contract';
  entityId: string;
  type: 'onboarding' | 'renewal' | 'termination' | 'risk-acceptance';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  requestedDate: Date;
  approvers: Approver[];
  currentLevel: number;
  totalLevels: number;
  comments: string;
  completedDate?: Date;
}

export interface Approver {
  userId: string;
  name: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  decisionDate?: Date;
  comments?: string;
}

export interface VendorContract {
  id: string;
  vendorId: string;
  vendorName: string;
  contractType: 'msa' | 'dsa' | 'bpa' | 'sow' | 'custom';
  contractNumber: string;
  startDate: Date;
  endDate?: Date;
  renewalDate?: Date;
  autoRenew: boolean;
  noticePeriod: number; // days
  status: 'active' | 'expired' | 'terminated' | 'pending-renewal';
  currency: string;
  annualValue: number;
  paymentTerms: string;
  terms: ContractTerms;
  dataProcessing: boolean;
  dsaAttached: boolean;
  slaIncluded: boolean;
  liability: LiabilityTerms;
  terminationRights?: string[];
  reviewFrequency: AssessmentFrequency;
  nextReview: Date;
  documentUrl: string;
  signedBy: string;
  signedDate: Date;
  counterpartySignatory?: string;
  attachments: string[];
}

export interface ContractTerms {
  confidentiality: string;
  dataProtection: string;
  intellectualProperty: string;
  warranties: string;
  indemnification: string;
  limitationOfLiability: string;
  terminationForConvenience: boolean;
  terminationForCause: boolean;
  auditRights: boolean;
  auditFrequency?: string;
  subcontractingAllowed: boolean;
  subcontractConsentRequired: boolean;
}

export interface LiabilityTerms {
  capType: 'unlimited' | 'per-incident' | 'aggregate' | 'custom';
  capAmount?: number;
  insuranceRequired: boolean;
  insuranceTypes: string[];
  minimumInsurance: number;
}

export interface VendorIncident {
  id: string;
  vendorId: string;
  vendorName: string;
  incidentDate: Date;
  detectedDate: Date;
  reportedDate: Date;
  severity: FindingSeverity;
  type: 'data-breach' | 'security-incident' | 'service-outage' | 'compliance-violation' | 'privacy-violation' | 'custom';
  title: string;
  description: string;
  impact: IncidentImpact;
  rootCause: string;
  containmentActions: string[];
  remediationActions: string[];
  preventiveActions: string[];
  notificationSent: boolean;
  notificationTimeline: NotificationEvent[];
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  assignedTo: string;
  resolvedDate?: Date;
  lessonsLearned: string;
  references: string[];
}

export interface IncidentImpact {
  dataAffected: boolean;
  recordsAffected?: number;
  customersAffected?: number;
  systemsAffected: string[];
  servicesAffected: string[];
  duration?: number; // hours
  financialImpact?: number;
  reputationImpact: 'low' | 'medium' | 'high';
}

export interface NotificationEvent {
  date: Date;
  recipient: string;
  method: 'email' | 'phone' | 'portal' | 'letter';
  content: string;
  sentBy: string;
}

// Generate comprehensive markdown documentation
export function generateVendorMarkdown(config: VendorAssessmentConfig): string {
  const lines: string[] = [];

  lines.push(`# ${config.projectName} - Vendor Security Assessment & Management`);
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(`This module provides comprehensive vendor security assessment and management capabilities`);
  lines.push(`with security scorecards, compliance tracking, and continuous monitoring.`);
  lines.push('');
  lines.push('## Features');
  lines.push('');
  lines.push('- **Vendor Tier Management**: Classify vendors by risk tier (Tier 1-4)');
  lines.push('- **Security Scorecards**: Quantitative assessment of vendor security posture');
  lines.push('- **Compliance Tracking**: SOC 2, ISO 27001, HIPAA, PCI DSS, GDPR compliance');
  lines.push('- **Risk Assessment**: Comprehensive risk evaluation with scoring');
  lines.push('- **Security Questionnaires**: Standardized questionnaires (SIG, CAIQ, custom)');
  lines.push('- **Finding Management**: Track and remediate security findings');
  lines.push('- **Contract Management**: Track vendor contracts with security terms');
  lines.push('- **Incident Tracking**: Monitor vendor security incidents');
  lines.push('- **Continuous Monitoring**: Ongoing security posture monitoring');
  lines.push('- **Benchmarking**: Compare vendors against industry benchmarks');
  lines.push('');
  lines.push('## Configuration');
  lines.push('');
  lines.push('```typescript');
  lines.push(`const assessmentConfig: VendorAssessmentConfig = {`);
  lines.push(`  projectName: "${config.projectName}",`);
  lines.push(`  providers: ${JSON.stringify(config.providers)},`);
  lines.push(`  settings: {`);
  lines.push(`    autoAssessment: ${config.settings.autoAssessment},`);
  lines.push(`    assessmentFrequency: "${config.settings.assessmentFrequency}",`);
  lines.push(`    riskThreshold: ${config.settings.riskThreshold},`);
  lines.push(`    // ... see full config`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push('```');
  lines.push('');
  lines.push('## Vendor Management');
  lines.push('');
  config.vendors.forEach(vendor => {
    lines.push(`### ${vendor.name} (${vendor.id})`);
    lines.push('');
    lines.push(`- **Category**: ${vendor.category}`);
    lines.push(`- **Tier**: ${vendor.tier}`);
    lines.push(`- **Status**: ${vendor.status}`);
    lines.push(`- **Risk Rating**: ${vendor.riskRating}`);
    lines.push(`- **Overall Score**: ${vendor.overallScore}/100`);
    lines.push(`- **Services**: ${vendor.services.join(', ')}`);
    lines.push(`- **Owner**: ${vendor.owner}`);
    lines.push(`- **Last Assessed**: ${vendor.lastAssessed.toISOString()}`);
    lines.push('');

    if (vendor.certifications.length > 0) {
      lines.push('**Certifications:**');
      vendor.certifications.forEach(cert => {
        lines.push(`- ${cert.framework}: ${cert.status} (expires: ${cert.expiryDate.toISOString().split('T')[0]})`);
      });
      lines.push('');
    }

    if (vendor.findings.length > 0) {
      lines.push(`**Open Findings:** ${vendor.findings.length}`);
      lines.push('');
    }
  });
  lines.push('');

  // Scorecards section
  if (config.scorecards.length > 0) {
    lines.push('## Security Scorecards');
    lines.push('');
    config.scorecards.forEach(scorecard => {
      lines.push(`### ${scorecard.vendorName} - ${scorecard.period}`);
      lines.push('');
      lines.push(`- **Overall Score**: ${scorecard.overallScore}/100`);
      lines.push(`- **Rating**: ${scorecard.rating}`);
      lines.push(`- **Status**: ${scorecard.status}`);
      lines.push(`- **Trend**: ${scorecard.trend} (${scorecard.trendScore > 0 ? '+' : ''}${scorecard.trendScore}%)`);

      scorecard.categories.forEach(cat => {
        lines.push(`  - ${cat.name}: ${cat.score}/100 (${cat.weight}% weight)`);
      });
      lines.push('');
    });
  }

  // Findings section
  if (config.findings.length > 0) {
    lines.push('## Security Findings');
    lines.push('');
    config.findings.forEach(finding => {
      lines.push(`### ${finding.title} (${finding.id})`);
      lines.push('');
      lines.push(`- **Severity**: ${finding.severity}`);
      lines.push(`- **Status**: ${finding.status}`);
      lines.push(`- **Category**: ${finding.category}`);
      lines.push(`- **Vendor**: ${finding.vendorName}`);
      lines.push(`- **Discovered**: ${finding.discoveredDate.toISOString()}`);
      lines.push(`- **Assigned To**: ${finding.assignedTo}`);
      lines.push(`- **Progress**: ${finding.progress}%`);
      lines.push('');
      lines.push(finding.description);
      lines.push('');
      lines.push(`**Remediation**: ${finding.remediation}`);
      lines.push('');
    });
  }

  // Assessments section
  if (config.assessments.length > 0) {
    lines.push('## Vendor Assessments');
    lines.push('');
    config.assessments.forEach(assessment => {
      lines.push(`### ${assessment.vendorName} - ${assessment.type}`);
      lines.push('');
      lines.push(`- **Assessment Date**: ${assessment.assessmentDate.toISOString()}`);
      lines.push(`- **Assessor**: ${assessment.assessor}`);
      lines.push(`- **Status**: ${assessment.status}`);
      lines.push(`- **Risk Score**: ${assessment.riskScore}/100`);
      lines.push(`- **Risk Rating**: ${assessment.riskRating}`);
      lines.push('');

      lines.push('**Security Posture:**');
      assessment.securityPosture.domains.forEach(domain => {
        lines.push(`- ${domain.name}: ${domain.score}/100 (${domain.maturityLevel})`);
      });
      lines.push('');

      lines.push('**Compliance:**');
      assessment.complianceAssessment.frameworks.forEach(fw => {
        lines.push(`- ${fw.framework}: ${fw.status} (${fw.score}/100)`);
      });
      lines.push('');
    });
  }

  // Incidents section
  if (config.incidents.length > 0) {
    lines.push('## Vendor Incidents');
    lines.push('');
    config.incidents.forEach(incident => {
      lines.push(`### ${incident.title} (${incident.id})`);
      lines.push('');
      lines.push(`- **Vendor**: ${incident.vendorName}`);
      lines.push(`- **Type**: ${incident.type}`);
      lines.push(`- **Severity**: ${incident.severity}`);
      lines.push(`- **Status**: ${incident.status}`);
      lines.push(`- **Incident Date**: ${incident.incidentDate.toISOString()}`);
      lines.push(`- **Detected**: ${incident.detectedDate.toISOString()}`);
      lines.push('');

      if (incident.impact.dataAffected) {
        lines.push(`**Impact**: ${incident.impact.recordsAffected || 'Unknown'} records affected, ${incident.impact.customersAffected || 'Unknown'} customers`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

// Generate Terraform infrastructure
export function generateVendorTerraform(config: VendorAssessmentConfig, provider: 'aws' | 'azure' | 'gcp'): string {
  const lines: string[] = [];

  lines.push(`# Terraform for Vendor Security Assessment - ${provider.toUpperCase()}`);
  lines.push(`# Generated for ${config.projectName}`);
  lines.push('');

  if (provider === 'aws') {
    lines.push('# DynamoDB Tables for vendor data');
    lines.push(`resource "aws_dynamodb_table" "vendors" {`);
    lines.push(`  name             = "\${var.project-name}-vendors"`);
    lines.push(`  billing_mode     = "PAY_PER_REQUEST"`);
    lines.push(`  hash_key         = "id"`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "id"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "tier"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  global_secondary_index {`);
    lines.push(`    name            = "TierIndex"`);
    lines.push(`    hash_key        = "tier"`);
    lines.push(`    projection_type = "ALL"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  point_in_time_recovery {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  server_side_encryption {`);
    lines.push(`    enabled     = true`);
    lines.push(`    kms_key_arn = aws_kms_key.vendor_key.arn`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_dynamodb_table" "assessments" {`);
    lines.push(`  name             = "\${var.project-name}-assessments"`);
    lines.push(`  billing_mode     = "PAY_PER_REQUEST"`);
    lines.push(`  hash_key         = "id"`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "id"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "vendorId"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  global_secondary_index {`);
    lines.push(`    name            = "VendorIndex"`);
    lines.push(`    hash_key        = "vendorId"`);
    lines.push(`    projection_type = "ALL"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_dynamodb_table" "findings" {`);
    lines.push(`  name             = "\${var.project-name}-findings"`);
    lines.push(`  billing_mode     = "PAY_PER_REQUEST"`);
    lines.push(`  hash_key         = "id"`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "id"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "vendorId"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  attribute {`);
    lines.push(`    name = "severity"`);
    lines.push(`    type = "S"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  global_secondary_index {`);
    lines.push(`    name            = "VendorIndex"`);
    lines.push(`    hash_key        = "vendorId"`);
    lines.push(`    projection_type = "ALL"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  global_secondary_index {`);
    lines.push(`    name            = "SeverityIndex"`);
    lines.push(`    hash_key        = "severity"`);
    lines.push(`    projection_type = "ALL"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# KMS Key for encryption');
    lines.push(`resource "aws_kms_key" "vendor_key" {`);
    lines.push(`  description = "KMS key for vendor assessment data"`);
    lines.push(`  enable_key_rotation = true`);
    lines.push('}');
    lines.push('');

    lines.push(`resource "aws_kms_alias" "vendor_key_alias" {`);
    lines.push(`  name          = "alias/\${var.project-name}-vendor-key"`);
    lines.push(`  target_key_id = aws_kms_key.vendor_key.key_id`);
    lines.push(`}`);
    lines.push('');

    lines.push('# S3 Bucket for evidence and documents');
    lines.push(`resource "aws_s3_bucket" "vendor_evidence" {`);
    lines.push(`  bucket = "\${var.project-name}-vendor-evidence"`);
    lines.push('}');
    lines.push('');

    lines.push(`resource "aws_s3_bucket_versioning" "vendor_evidence_versioning" {`);
    lines.push(`  bucket = aws_s3_bucket.vendor_evidence.id`);
    lines.push(`  versioning_configuration {`);
    lines.push(`    status = "Enabled"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_s3_bucket_server_side_encryption_configuration" "vendor_evidence_encryption" {`);
    lines.push(`  bucket = aws_s3_bucket.vendor_evidence.id`);
    lines.push('');
    lines.push(`  rule {`);
    lines.push(`    apply_server_side_encryption_by_default {`);
    lines.push(`      sse_algorithm = "AES256"`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Lambda Function for automated assessment');
    lines.push(`resource "aws_lambda_function" "vendor_assessor" {`);
    lines.push(`  filename      = "vendor_assessor.zip"`);
    lines.push(`  function_name = "\${var.project-name}-vendor-assessor"`);
    lines.push(`  role          = aws_iam_role.vendor_lambda_role.arn`);
    lines.push(`  handler       = "index.handler"`);
    lines.push('');
    lines.push(`  environment {`);
    lines.push(`    variables = {`);
    lines.push(`      VENDORS_TABLE = aws_dynamodb_table.vendors.id`);
    lines.push(`      ASSESSMENTS_TABLE = aws_dynamodb_table.assessments.id`);
    lines.push(`      FINDINGS_TABLE = aws_dynamodb_table.findings.id`);
    lines.push(`      RISK_THRESHOLD = tostring(${config.settings.riskThreshold})`);
    lines.push(`    }`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# EventBridge Rule for periodic assessments');
    lines.push(`resource "aws_cloudwatch_event_rule" "assessment_schedule" {`);
    lines.push(`  name                = "\${var.project-name}-assessment-schedule"`);
    lines.push(`  schedule_expression = "${config.settings.assessmentFrequency === 'monthly' ? 'cron(0 0 1 * ? *)' : config.settings.assessmentFrequency === 'quarterly' ? 'cron(0 0 1 1,4,7,10 ? *)' : 'cron(0 0 1 1 ? *)'}"`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "aws_cloudwatch_event_target" "assessment_target" {`);
    lines.push(`  rule      = aws_cloudwatch_event_rule.assessment_schedule.name`);
    lines.push(`  target_id = "VendorAssessor"`);
    lines.push(`  arn       = aws_lambda_function.vendor_assessor.arn`);
    lines.push(`}`);
    lines.push('');

    lines.push('# SNS Topic for findings notifications');
    lines.push(`resource "aws_sns_topic" "vendor_findings" {`);
    lines.push(`  name = "\${var.project-name}-vendor-findings"`);
    lines.push(`}`);
    lines.push('');

  } else if (provider === 'azure') {
    lines.push('# Storage Account for evidence');
    lines.push(`resource "azurerm_storage_account" "vendor_evidence" {`);
    lines.push(`  name                     = "\${var.project-name}vendevidence"`);
    lines.push(`  resource_group_name      = var.resource-group-name`);
    lines.push(`  location                 = var.location`);
    lines.push(`  account_tier             = "Standard"`);
    lines.push(`  account_replication_type = "GRS"`);
    lines.push(`  enable_https_traffic_only = true`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cosmos DB for vendor records');
    lines.push(`resource "azurerm_cosmosdb_account" "vendor_management" {`);
    lines.push(`  name                = "\${var.project-name}-vendor-db"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  offer_type          = "Standard"`);
    lines.push(`  kind                = "GlobalDocumentDB"`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Key Vault for encryption keys');
    lines.push(`resource "azurerm_key_vault" "vendor_vault" {`);
    lines.push(`  name                = "\${var.project-name}-vendor-vault"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  tenant_id           = var.tenant-id`);
    lines.push(`  sku_name            = "standard"`);
    lines.push('}');
    lines.push('');

    lines.push('# Function App for vendor assessment');
    lines.push(`resource "azurerm_function_app" "vendor_assessor" {`);
    lines.push(`  name                = "\${var.project-name}-vendor-assessor"`);
    lines.push(`  location            = var.location`);
    lines.push(`  resource_group_name = var.resource-group-name`);
    lines.push(`  app_service_plan_id = azurerm_app_service_plan.vendor.id`);
    lines.push('');
    lines.push(`  app_settings = {`);
    lines.push(`    VENDORS_CONNECTION = azurerm_cosmosdb_account.vendor_management.connection_string`);
    lines.push(`    RISK_THRESHOLD = tostring(${config.settings.riskThreshold})`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

  } else if (provider === 'gcp') {
    lines.push('# GCS Bucket for evidence');
    lines.push(`resource "google_storage_bucket" "vendor_evidence" {`);
    lines.push(`  name          = "\${var.project-name}-vendor-evidence"`);
    lines.push(`  location      = var.location`);
    lines.push(`  force_destroy = false`);
    lines.push(`  uniform_bucket_level_access = true`);
    lines.push('');
    lines.push(`  versioning {`);
    lines.push(`    enabled = true`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Firestore for vendor records');
    lines.push(`resource "google_firestore_database" "vendor_records" {`);
    lines.push(`  name     = "\${var.project-name}-vendor-records"`);
    lines.push(`  location = var.location`);
    lines.push(`  type     = "FIRESTORE_NATIVE"`);
    lines.push(`}`);
    lines.push('');

    lines.push('# KMS Key Ring');
    lines.push(`resource "google_kms_key_ring" "vendor_key_ring" {`);
    lines.push(`  name     = "\${var.project-name}-vendor-keyring"`);
    lines.push(`  location = var.location`);
    lines.push(`}`);
    lines.push('');

    lines.push(`resource "google_kms_crypto_key" "vendor_key" {`);
    lines.push(`  name     = "vendor-key"`);
    lines.push(`  key_ring = google_kms_key_ring.vendor_key_ring.id`);
    lines.push(`  purpose  = "ENCRYPT_DECRYPT"`);
    lines.push('');
    lines.push(`  version_template {`);
    lines.push(`    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cloud Functions for vendor assessment');
    lines.push(`resource "google_cloudfunctions_v2_function" "vendor_assessor" {`);
    lines.push(`  name        = "\${var.project-name}-vendor-assessor"`);
    lines.push(`  location    = var.location`);
    lines.push(`  description = "Automated vendor security assessment"`);
    lines.push('');
    lines.push(`  build_config {`);
    lines.push(`    runtime     = "nodejs20"`);
    lines.push(`    entry_point = "assessVendor"`);
    lines.push(`  }`);
    lines.push('');
    lines.push(`  environment_variables = {`);
    lines.push(`    RISK_THRESHOLD = tostring(${config.settings.riskThreshold})`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');

    lines.push('# Cloud Scheduler for periodic assessments');
    lines.push(`resource "google_cloud_scheduler_job" "assessment_schedule" {`);
    lines.push(`  name             = "\${var.project-name}-assessment-schedule"`);
    lines.push(`  description      = "Trigger vendor security assessments"`);
    lines.push(`  schedule         = "${config.settings.assessmentFrequency === 'monthly' ? '0 0 1 * *' : config.settings.assessmentFrequency === 'quarterly' ? '0 0 1 1,4,7,10 *' : '0 0 1 1 *'}"`);
    lines.push(`  time_zone        = "UTC"`);
    lines.push('');
    lines.push(`  http_target {`);
    lines.push(`    http_method = "POST"`);
    lines.push(`    uri         = google_cloudfunctions_v2_function.vendor_assessor.service_uri`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// Generate TypeScript manager class
export function generateTypeScriptManager(): string {
  return `// Vendor Security Assessment Manager - TypeScript

import { EventEmitter } from 'events';

export type VendorTier = 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';
export type VendorStatus = 'active' | 'inactive' | 'on-hold' | 'under-review' | 'terminated';
export type VendorCategory = 'software' | 'infrastructure' | 'professional-services' | 'data-processing' | 'cloud-provider';
export type AssessmentStatus = 'pending' | 'in-progress' | 'completed' | 'approved' | 'rejected' | 'expired';
export type RiskRating = 'critical' | 'high' | 'medium' | 'low' | 'acceptable';
export type ScorecardStatus = 'draft' | 'submitted' | 'under-review' | 'approved' | 'rejected';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'in-progress' | 'remediated' | 'accepted' | 'false-positive';

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  tier: VendorTier;
  status: VendorStatus;
  riskRating: RiskRating;
  overallScore: number;
  lastAssessed: Date;
  nextAssessment: Date;
  owner: string;
  services: string[];
  certifications: Certification[];
  findings: string[];
  assessments: string[];
  sla: ServiceLevelAgreement;
  spending: { annual: number; currency: string; };
}

export interface Certification {
  framework: string;
  status: 'valid' | 'expired' | 'pending';
  expiryDate: Date;
  verified: boolean;
}

export interface ServiceLevelAgreement {
  availability: number;
  responseTime: number;
  uptimeGuarantee: number;
}

export interface VendorAssessment {
  id: string;
  vendorId: string;
  assessmentDate: Date;
  assessor: string;
  status: AssessmentStatus;
  riskScore: number;
  riskRating: RiskRating;
  findings: string[];
  recommendations: string[];
}

export interface VendorScorecard {
  id: string;
  vendorId: string;
  period: string;
  overallScore: number;
  rating: RiskRating;
  categories: ScorecardCategory[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface ScorecardCategory {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
}

export interface VendorFinding {
  id: string;
  vendorId: string;
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  discoveredDate: Date;
  assignedTo: string;
  progress: number;
}

export class VendorAssessmentManager extends EventEmitter {
  private vendors: Map<string, Vendor> = new Map();
  private assessments: Map<string, VendorAssessment> = new Map();
  private scorecards: Map<string, VendorScorecard> = new Map();
  private findings: Map<string, VendorFinding> = new Map();

  // Vendor Management
  async createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor> {
    const id = this.generateId('vendor');
    const newVendor: Vendor = {
      ...vendor,
      id,
      lastAssessed: new Date(),
      nextAssessed: this.calculateNextAssessment(),
    };

    this.vendors.set(id, newVendor);
    this.emit('vendorCreated', newVendor);

    // Auto-create initial assessment for new vendors
    await this.createAssessment({
      vendorId: id,
      assessmentDate: new Date(),
      assessor: vendor.owner,
      status: 'pending',
      riskScore: 0,
      riskRating: 'medium',
      findings: [],
      recommendations: [],
    });

    return newVendor;
  }

  async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<Vendor | null> {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) return null;

    const updated = { ...vendor, ...updates };
    this.vendors.set(vendorId, updated);
    this.emit('vendorUpdated', updated);

    return updated;
  }

  getVendor(vendorId: string): Vendor | null {
    return this.vendors.get(vendorId) || null;
  }

  listVendors(filters?: { tier?: VendorTier; status?: VendorStatus; category?: VendorCategory }): Vendor[] {
    let vendors = Array.from(this.vendors.values());

    if (filters?.tier) {
      vendors = vendors.filter(v => v.tier === filters.tier);
    }
    if (filters?.status) {
      vendors = vendors.filter(v => v.status === filters.status);
    }
    if (filters?.category) {
      vendors = vendors.filter(v => v.category === filters.category);
    }

    return vendors.sort((a, b) => b.overallScore - a.overallScore);
  }

  // Assessment Management
  async createAssessment(assessment: Omit<VendorAssessment, 'id'>): Promise<VendorAssessment> {
    const id = this.generateId('assessment');
    const vendor = this.vendors.get(assessment.vendorId);

    if (!vendor) {
      throw new Error(\`Vendor \${assessment.vendorId} not found\`);
    }

    const riskScore = this.calculateRiskScore(vendor);
    const riskRating = this.getRiskRating(riskScore);

    const newAssessment: VendorAssessment = {
      ...assessment,
      id,
      riskScore,
      riskRating,
    };

    this.assessments.set(id, newAssessment);
    this.emit('assessmentCreated', newAssessment);

    // Update vendor with new assessment
    await this.updateVendor(assessment.vendorId, {
      lastAssessed: assessment.assessmentDate,
      overallScore: riskScore,
      riskRating,
    });

    return newAssessment;
  }

  async completeAssessment(assessmentId: string, findings: string[], recommendations: string[]): Promise<VendorAssessment | null> {
    const assessment = this.assessments.get(assessmentId);
    if (!assessment) return null;

    assessment.status = 'completed';
    assessment.findings = findings;
    assessment.recommendations = recommendations;

    this.emit('assessmentCompleted', assessment);

    // Create findings
    for (const findingId of findings) {
      const finding = this.findings.get(findingId);
      if (finding && finding.severity === 'critical' || finding.severity === 'high') {
        this.emit('criticalFinding', finding);
      }
    }

    return assessment;
  }

  getAssessment(assessmentId: string): VendorAssessment | null {
    return this.assessments.get(assessmentId) || null;
  }

  listAssessments(vendorId?: string): VendorAssessment[] {
    let assessments = Array.from(this.assessments.values());
    if (vendorId) {
      assessments = assessments.filter(a => a.vendorId === vendorId);
    }
    return assessments.sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime());
  }

  // Scorecard Management
  async createScorecard(vendorId: string, period: string, categories: ScorecardCategory[]): Promise<VendorScorecard> {
    const id = this.generateId('scorecard');
    const vendor = this.vendors.get(vendorId);
    if (!vendor) {
      throw new Error(\`Vendor \${vendorId} not found\`);
    }

    const overallScore = this.calculateOverallScore(categories);
    const rating = this.getRiskRating(100 - overallScore); // Invert: higher score = lower risk

    const previousScorecard = Array.from(this.scorecards.values())
      .filter(s => s.vendorId === vendorId)
      .sort((a, b) => b.period.localeCompare(a.period))[0];

    const trend = previousScorecard
      ? overallScore > previousScorecard.overallScore ? 'improving'
      : overallScore < previousScorecard.overallScore ? 'declining' : 'stable'
      : 'stable';

    const trendScore = previousScorecard ? overallScore - previousScorecard.overallScore : 0;

    const scorecard: VendorScorecard = {
      id,
      vendorId,
      period,
      overallScore,
      rating,
      categories,
      trend,
      trendScore,
    };

    this.scorecards.set(id, scorecard);
    this.emit('scorecardCreated', scorecard);

    return scorecard;
  }

  getScorecard(scorecardId: string): VendorScorecard | null {
    return this.scorecards.get(scorecardId) || null;
  }

  listScorecards(vendorId?: string): VendorScorecard[] {
    let scorecards = Array.from(this.scorecards.values());
    if (vendorId) {
      scorecards = scorecards.filter(s => s.vendorId === vendorId);
    }
    return scorecards.sort((a, b) => b.period.localeCompare(a.period));
  }

  // Finding Management
  async createFinding(finding: Omit<VendorFinding, 'id'>): Promise<VendorFinding> {
    const id = this.generateId('finding');
    const newFinding: VendorFinding = {
      ...finding,
      id,
      discoveredDate: finding.discoveredDate || new Date(),
      progress: finding.progress || 0,
    };

    this.findings.set(id, newFinding);
    this.emit('findingCreated', newFinding);

    // Add finding to vendor
    const vendor = this.vendors.get(finding.vendorId);
    if (vendor && !vendor.findings.includes(id)) {
      vendor.findings.push(id);
    }

    return newFinding;
  }

  async updateFindingProgress(findingId: string, progress: number, status?: FindingStatus): Promise<VendorFinding | null> {
    const finding = this.findings.get(findingId);
    if (!finding) return null;

    finding.progress = progress;
    if (status) {
      finding.status = status;
    }

    this.emit('findingUpdated', finding);

    if (progress >= 100 && status === 'remediated') {
      this.emit('findingRemediated', finding);
    }

    return finding;
  }

  getFinding(findingId: string): VendorFinding | null {
    return this.findings.get(findingId) || null;
  }

  listFindings(vendorId?: string, severity?: FindingSeverity): VendorFinding[] {
    let findings = Array.from(this.findings.values());
    if (vendorId) {
      findings = findings.filter(f => f.vendorId === vendorId);
    }
    if (severity) {
      findings = findings.filter(f => f.severity === severity);
    }
    return findings.sort((a, b) => b.discoveredDate.getTime() - a.discoveredDate.getTime());
  }

  getOpenCriticalFindings(): VendorFinding[] {
    return Array.from(this.findings.values()).filter(
      f => (f.severity === 'critical' || f.severity === 'high') && f.status !== 'remediated' && f.status !== 'accepted'
    );
  }

  // Analytics & Reporting
  getVendorSummary(): VendorSummary {
    const vendors = this.listVendors();
    const findings = this.listFindings();

    const byTier: Record<string, number> = {
      'tier-1': 0, 'tier-2': 0, 'tier-3': 0, 'tier-4': 0
    };
    const byStatus: Record<string, number> = {
      'active': 0, 'inactive': 0, 'on-hold': 0, 'under-review': 0, 'terminated': 0
    };
    const byRisk: Record<string, number> = {
      'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'acceptable': 0
    };

    let totalScore = 0;
    for (const vendor of vendors) {
      byTier[vendor.tier]++;
      byStatus[vendor.status]++;
      byRisk[vendor.riskRating]++;
      totalScore += vendor.overallScore;
    }

    const openFindings = findings.filter(f => f.status === 'open' || f.status === 'in-progress');
    const criticalFindings = openFindings.filter(f => f.severity === 'critical' || f.severity === 'high');

    return {
      totalVendors: vendors.length,
      byTier,
      byStatus,
      byRisk,
      averageScore: totalScore / vendors.length || 0,
      openFindings: openFindings.length,
      criticalFindings: criticalFindings.length,
      topRisks: vendors.filter(v => v.riskRating === 'critical' || v.riskRating === 'high'),
    };
  }

  // Helper methods
  private generateId(prefix: string): string {
    return \`\${prefix}-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
  }

  private calculateRiskScore(vendor: Vendor): number {
    let score = 50; // Base score

    // Adjust by tier
    const tierImpact = { 'tier-1': -10, 'tier-2': -5, 'tier-3': 0, 'tier-4': 10 };
    score += tierImpact[vendor.tier] || 0;

    // Adjust by certifications
    const validCerts = vendor.certifications.filter(c => c.status === 'valid' && c.verified).length;
    score -= validCerts * 3;

    // Adjust by open findings
    const criticalFindings = vendor.findings.filter(f => {
      const finding = this.findings.get(f);
      return finding && (finding.severity === 'critical' || finding.severity === 'high') && finding.status !== 'remediated';
    }).length;
    score += criticalFindings * 10;

    // Adjust by SLA compliance
    if (vendor.sla.availability < 99.9) score += 5;
    if (vendor.sla.availability < 99.5) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private getRiskRating(score: number): RiskRating {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'acceptable';
  }

  private calculateOverallScore(categories: ScorecardCategory[]): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const category of categories) {
      totalWeightedScore += category.weightedScore;
      totalWeight += category.weight;
    }

    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
  }

  private calculateNextAssessment(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + 3); // Quarterly by default
    return date;
  }
}

export interface VendorSummary {
  totalVendors: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  byRisk: Record<string, number>;
  averageScore: number;
  openFindings: number;
  criticalFindings: number;
  topRisks: Vendor[];
}
`;
}

// Generate Python manager class
export function generatePythonManager(): string {
  return `# Vendor Security Assessment Manager - Python

from typing import Dict, List, Set, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
import uuid
import json
from abc import ABC, abstractmethod

class VendorTier(Enum):
    TIER_1 = "tier-1"
    TIER_2 = "tier-2"
    TIER_3 = "tier-3"
    TIER_4 = "tier-4"

class VendorStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ON_HOLD = "on-hold"
    UNDER_REVIEW = "under-review"
    TERMINATED = "terminated"

class VendorCategory(Enum):
    SOFTWARE = "software"
    INFRASTRUCTURE = "infrastructure"
    PROFESSIONAL_SERVICES = "professional-services"
    DATA_PROCESSING = "data-processing"
    CLOUD_PROVIDER = "cloud-provider"

class AssessmentStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"

class RiskRating(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    ACCEPTABLE = "acceptable"

class ScorecardStatus(Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under-review"
    APPROVED = "approved"
    REJECTED = "rejected"

class FindingSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class FindingStatus(Enum):
    OPEN = "open"
    IN_PROGRESS = "in-progress"
    REMEDIATED = "remediated"
    ACCEPTED = "accepted"
    FALSE_POSITIVE = "false-positive"

@dataclass
class Certification:
    framework: str
    status: str
    expiry_date: datetime
    verified: bool
    certificate_number: Optional[str] = None
    issuer: str = ""
    scope: str = ""
    verified_date: Optional[datetime] = None
    evidence_url: Optional[str] = None

@dataclass
class ServiceLevelAgreement:
    availability: float  # percentage
    response_time: int  # milliseconds
    uptime_guarantee: float  # percentage
    resolution_time_critical: int = 4  # hours
    resolution_time_high: int = 8
    resolution_time_medium: int = 24
    resolution_time_low: int = 48
    penalty_clauses: bool = False
    credit_percentage: int = 0
    reporting: bool = False
    reporting_frequency: str = "monthly"

@dataclass
class Vendor:
    id: str
    name: str
    description: str
    website: str
    category: VendorCategory
    tier: VendorTier
    status: VendorStatus
    risk_rating: RiskRating
    overall_score: int
    last_assessed: datetime
    next_assessment: datetime
    onboarding_date: datetime
    termination_date: Optional[datetime]
    owner: str
    technical_contact: str
    business_contact: str
    escalation_contact: Optional[str]
    services: List[str]
    certifications: List[Certification]
    contracts: List[str]
    assessments: List[str]
    findings: List[str]
    incidents: List[str]
    tags: List[str]
    regions: List[str]
    sla: ServiceLevelAgreement
    spending_annual: float
    spending_currency: str
    budget_code: str
    dependencies: List[str]
    dependents: List[str]

@dataclass
class VendorAssessment:
    id: str
    vendor_id: str
    vendor_name: str
    assessment_date: datetime
    assessor: str
    reviewers: List[str]
    status: AssessmentStatus
    type: str  # initial, periodic, event-driven, exit
    risk_score: int
    risk_rating: RiskRating
    findings: List[str]
    recommendations: List[str]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    expiry_date: datetime
    next_assessment: datetime

@dataclass
class ScorecardCategory:
    name: str
    weight: int
    score: int
    weighted_score: int
    status: str  # excellent, good, satisfactory, needs-improvement, unacceptable
    comments: str = ""

@dataclass
class VendorScorecard:
    id: str
    vendor_id: str
    vendor_name: str
    period: str
    status: ScorecardStatus
    generated_date: datetime
    generated_by: str
    reviewed_by: Optional[str]
    reviewed_date: Optional[datetime]
    approved_by: Optional[str]
    approved_date: Optional[datetime]
    overall_score: int
    rating: RiskRating
    categories: List[ScorecardCategory]
    trend: str  # improving, stable, declining
    trend_score: int
    recommendations: List[str]
    strengths: List[str]
    weaknesses: List[str]

@dataclass
class VendorFinding:
    id: str
    vendor_id: str
    vendor_name: str
    assessment_id: str
    title: str
    description: str
    severity: FindingSeverity
    category: str  # security, compliance, operational, contractual, data-protection
    status: FindingStatus
    discovered_date: datetime
    discovered_by: str
    due_date: Optional[datetime]
    remediation: str
    assigned_to: str
    progress: int
    last_updated: datetime
    updated_by: str
    impact: str
    references: List[str]

class VendorAssessmentManager:
    def __init__(self):
        self.vendors: Dict[str, Vendor] = {}
        self.assessments: Dict[str, VendorAssessment] = {}
        self.scorecards: Dict[str, VendorScorecard] = {}
        self.findings: Dict[str, VendorFinding] = {}
        self._event_handlers: Dict[str, List[Callable]] = {}

    def _emit(self, event_name: str, *args, **kwargs):
        for handler in self._event_handlers.get(event_name, []):
            handler(*args, **kwargs)

    def on(self, event_name: str, handler: Callable):
        if event_name not in self._event_handlers:
            self._event_handlers[event_name] = []
        self._event_handlers[event_name].append(handler)

    # Vendor Management
    async def create_vendor(
        self,
        name: str,
        description: str,
        website: str,
        category: VendorCategory,
        tier: VendorTier,
        owner: str,
        technical_contact: str,
        business_contact: str,
        services: List[str],
        sla: ServiceLevelAgreement,
        spending_annual: float,
        spending_currency: str = "USD",
        budget_code: str = "default",
        **kwargs
    ) -> Vendor:
        vendor_id = f"vendor-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()

        vendor = Vendor(
            id=vendor_id,
            name=name,
            description=description,
            website=website,
            category=category,
            tier=tier,
            status=VendorStatus.ACTIVE,
            risk_rating=RiskRating.MEDIUM,
            overall_score=50,
            last_assessed=now,
            next_assessed=self._calculate_next_assessment(),
            onboarding_date=now,
            termination_date=None,
            owner=owner,
            technical_contact=technical_contact,
            business_contact=business_contact,
            escalation_contact=kwargs.get('escalation_contact'),
            services=services,
            certifications=[],
            contracts=[],
            assessments=[],
            findings=[],
            incidents=[],
            tags=kwargs.get('tags', []),
            regions=kwargs.get('regions', []),
            sla=sla,
            spending_annual=spending_annual,
            spending_currency=spending_currency,
            budget_code=budget_code,
            dependencies=[],
            dependents=[],
        )

        self.vendors[vendor_id] = vendor
        self._emit('vendorCreated', vendor)

        # Auto-create initial assessment
        await self.create_assessment(
            vendor_id=vendor_id,
            vendor_name=name,
            assessor=owner,
            assessment_type='initial'
        )

        return vendor

    async def update_vendor(self, vendor_id: str, updates: Dict[str, Any]) -> Optional[Vendor]:
        vendor = self.vendors.get(vendor_id)
        if not vendor:
            return None

        for key, value in updates.items():
            if hasattr(vendor, key):
                setattr(vendor, key, value)

        self._emit('vendorUpdated', vendor)
        return vendor

    def get_vendor(self, vendor_id: str) -> Optional[Vendor]:
        return self.vendors.get(vendor_id)

    def list_vendors(
        self,
        tier: Optional[VendorTier] = None,
        status: Optional[VendorStatus] = None,
        category: Optional[VendorCategory] = None
    ) -> List[Vendor]:
        vendors = list(self.vendors.values())

        if tier:
            vendors = [v for v in vendors if v.tier == tier]
        if status:
            vendors = [v for v in vendors if v.status == status]
        if category:
            vendors = [v for v in vendors if v.category == category]

        return sorted(vendors, key=lambda v: v.overall_score, reverse=True)

    # Assessment Management
    async def create_assessment(
        self,
        vendor_id: str,
        vendor_name: str,
        assessor: str,
        assessment_type: str = 'periodic',
        reviewers: Optional[List[str]] = None
    ) -> VendorAssessment:
        assessment_id = f"assessment-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow()

        vendor = self.vendors.get(vendor_id)
        if not vendor:
            raise ValueError(f"Vendor {vendor_id} not found")

        risk_score = self._calculate_risk_score(vendor)
        risk_rating = self._get_risk_rating(risk_score)

        assessment = VendorAssessment(
            id=assessment_id,
            vendor_id=vendor_id,
            vendor_name=vendor_name,
            assessment_date=now,
            assessor=assessor,
            reviewers=reviewers or [],
            status=AssessmentStatus.PENDING,
            type=assessment_type,
            risk_score=risk_score,
            risk_rating=risk_rating,
            findings=[],
            recommendations=[],
            approved_by=None,
            approved_at=None,
            expiry_date=self._calculate_next_assessment(),
            next_assessment=self._calculate_next_assessment()
        )

        self.assessments[assessment_id] = assessment
        self._emit('assessmentCreated', assessment)

        # Update vendor
        await self.update_vendor(vendor_id, {
            'last_assessed': now,
            'overall_score': risk_score,
            'risk_rating': risk_rating
        })

        return assessment

    async def complete_assessment(
        self,
        assessment_id: str,
        findings: List[str],
        recommendations: List[str]
    ) -> Optional[VendorAssessment]:
        assessment = self.assessments.get(assessment_id)
        if not assessment:
            return None

        assessment.status = AssessmentStatus.COMPLETED
        assessment.findings = findings
        assessment.recommendations = recommendations

        self._emit('assessmentCompleted', assessment)

        # Check for critical findings
        for finding_id in findings:
            finding = self.findings.get(finding_id)
            if finding and finding.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]:
                self._emit('criticalFinding', finding)

        return assessment

    def get_assessment(self, assessment_id: str) -> Optional[VendorAssessment]:
        return self.assessments.get(assessment_id)

    def list_assessments(self, vendor_id: Optional[str] = None) -> List[VendorAssessment]:
        assessments = list(self.assessments.values())
        if vendor_id:
            assessments = [a for a in assessments if a.vendor_id == vendor_id]
        return sorted(assessments, key=lambda a: a.assessment_date, reverse=True)

    # Scorecard Management
    async def create_scorecard(
        self,
        vendor_id: str,
        period: str,
        categories: List[ScorecardCategory],
        generated_by: str
    ) -> VendorScorecard:
        scorecard_id = f"scorecard-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"
        vendor = self.vendors.get(vendor_id)
        if not vendor:
            raise ValueError(f"Vendor {vendor_id} not found")

        overall_score = self._calculate_overall_score(categories)
        rating = self._get_risk_rating(100 - overall_score)

        # Get previous scorecard for trend
        previous = [s for s in self.scorecards.values() if s.vendor_id == vendor_id]
        previous.sort(key=lambda x: x.period, reverse=True)

        if previous:
            if overall_score > previous[0].overall_score:
                trend = "improving"
            elif overall_score < previous[0].overall_score:
                trend = "declining"
            else:
                trend = "stable"
            trend_score = overall_score - previous[0].overall_score
        else:
            trend = "stable"
            trend_score = 0

        scorecard = VendorScorecard(
            id=scorecard_id,
            vendor_id=vendor_id,
            vendor_name=vendor.name,
            period=period,
            status=ScorecardStatus.DRAFT,
            generated_date=datetime.utcnow(),
            generated_by=generated_by,
            reviewed_by=None,
            reviewed_date=None,
            approved_by=None,
            approved_date=None,
            overall_score=overall_score,
            rating=rating,
            categories=categories,
            trend=trend,
            trend_score=trend_score,
            recommendations=[],
            strengths=[],
            weaknesses=[]
        )

        self.scorecards[scorecard_id] = scorecard
        self._emit('scorecardCreated', scorecard)

        return scorecard

    def get_scorecard(self, scorecard_id: str) -> Optional[VendorScorecard]:
        return self.scorecards.get(scorecard_id)

    def list_scorecards(self, vendor_id: Optional[str] = None) -> List[VendorScorecard]:
        scorecards = list(self.scorecards.values())
        if vendor_id:
            scorecards = [s for s in scorecards if s.vendor_id == vendor_id]
        return sorted(scorecards, key=lambda s: s.period, reverse=True)

    # Finding Management
    async def create_finding(
        self,
        vendor_id: str,
        vendor_name: str,
        assessment_id: str,
        title: str,
        description: str,
        severity: FindingSeverity,
        category: str,
        discovered_by: str,
        remediation: str,
        assigned_to: str,
        impact: str = ""
    ) -> VendorFinding:
        finding_id = f"finding-{datetime.utcnow().timestamp()}-{uuid.uuid4().hex[:8]}"

        finding = VendorFinding(
            id=finding_id,
            vendor_id=vendor_id,
            vendor_name=vendor_name,
            assessment_id=assessment_id,
            title=title,
            description=description,
            severity=severity,
            category=category,
            status=FindingStatus.OPEN,
            discovered_date=datetime.utcnow(),
            discovered_by=discovered_by,
            due_date=None,
            remediation=remediation,
            assigned_to=assigned_to,
            progress=0,
            last_updated=datetime.utcnow(),
            updated_by=discovered_by,
            impact=impact,
            references=[]
        )

        self.findings[finding_id] = finding
        self._emit('findingCreated', finding)

        # Add to vendor
        vendor = self.vendors.get(vendor_id)
        if vendor and finding_id not in vendor.findings:
            vendor.findings.append(finding_id)

        return finding

    async def update_finding_progress(
        self,
        finding_id: str,
        progress: int,
        status: Optional[FindingStatus] = None
    ) -> Optional[VendorFinding]:
        finding = self.findings.get(finding_id)
        if not finding:
            return None

        finding.progress = progress
        if status:
            finding.status = status

        self._emit('findingUpdated', finding)

        if progress >= 100 and status == FindingStatus.REMEDIATED:
            self._emit('findingRemediated', finding)

        return finding

    def get_finding(self, finding_id: str) -> Optional[VendorFinding]:
        return self.findings.get(finding_id)

    def list_findings(
        self,
        vendor_id: Optional[str] = None,
        severity: Optional[FindingSeverity] = None
    ) -> List[VendorFinding]:
        findings = list(self.findings.values())
        if vendor_id:
            findings = [f for f in findings if f.vendor_id == vendor_id]
        if severity:
            findings = [f for f in findings if f.severity == severity]
        return sorted(findings, key=lambda f: f.discovered_date, reverse=True)

    def get_open_critical_findings(self) -> List[VendorFinding]:
        return [
            f for f in self.findings.values()
            if f.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]
            and f.status not in [FindingStatus.REMEDIATED, FindingStatus.ACCEPTED]
        ]

    # Analytics
    def get_vendor_summary(self) -> Dict[str, Any]:
        vendors = self.list_vendors()
        findings = self.list_findings()

        by_tier = {t.value: 0 for t in VendorTier}
        by_status = {s.value: 0 for s in VendorStatus}
        by_risk = {r.value: 0 for r in RiskRating}

        total_score = 0
        for vendor in vendors:
            by_tier[vendor.tier.value] += 1
            by_status[vendor.status.value] += 1
            by_risk[vendor.risk_rating.value] += 1
            total_score += vendor.overall_score

        open_findings = [f for f in findings if f.status in [FindingStatus.OPEN, FindingStatus.IN_PROGRESS]]
        critical_findings = [f for f in open_findings if f.severity in [FindingSeverity.CRITICAL, FindingSeverity.HIGH]]

        return {
            'totalVendors': len(vendors),
            'byTier': by_tier,
            'byStatus': by_status,
            'byRisk': by_risk,
            'averageScore': total_score / len(vendors) if vendors else 0,
            'openFindings': len(open_findings),
            'criticalFindings': len(critical_findings),
            'topRisks': [v for v in vendors if v.risk_rating in [RiskRating.CRITICAL, RiskRating.HIGH]]
        }

    # Helper methods
    def _calculate_risk_score(self, vendor: Vendor) -> int:
        score = 50  # Base score

        # Tier impact
        tier_impact = {VendorTier.TIER_1: -10, VendorTier.TIER_2: -5, VendorTier.TIER_3: 0, VendorTier.TIER_4: 10}
        score += tier_impact.get(vendor.tier, 0)

        # Certifications
        valid_certs = sum(1 for c in vendor.certifications if c.status == 'valid' and c.verified)
        score -= valid_certs * 3

        # Open findings
        critical_findings = sum(1 for f in vendor.findings if self.findings.get(f)?.severity in ['critical', 'high'] and self.findings.get(f)?.status not in ['remediated', 'accepted'])
        score += critical_findings * 10

        # SLA
        if vendor.sla.availability < 99.9:
            score += 5
        if vendor.sla.availability < 99.5:
            score += 10

        return max(0, min(100, score))

    def _get_risk_rating(self, score: int) -> RiskRating:
        if score >= 80:
            return RiskRating.CRITICAL
        if score >= 60:
            return RiskRating.HIGH
        if score >= 40:
            return RiskRating.MEDIUM
        if score >= 20:
            return RiskRating.LOW
        return RiskRating.ACCEPTABLE

    def _calculate_overall_score(self, categories: List[ScorecardCategory]) -> int:
        total_weighted = sum(c.weighted_score for c in categories)
        total_weight = sum(c.weight for c in categories)
        return round(total_weighted / total_weight) if total_weight > 0 else 0

    def _calculate_next_assessment(self) -> datetime:
        date = datetime.utcnow() + timedelta(days=90)  # Quarterly
        return date
`;
}

// Write all files
export async function writeVendorFiles(config: VendorAssessmentConfig, outputDir: string, language: 'typescript' | 'python'): Promise<void> {
  await fs.ensureDir(outputDir);

  // Write documentation
  const markdown = generateVendorMarkdown(config);
  await fs.writeFile(path.join(outputDir, 'vendor-assessment-guide.md'), markdown);

  // Write Terraform for each provider
  for (const provider of config.providers) {
    const terraform = generateVendorTerraform(config, provider);
    const tfDir = path.join(outputDir, 'terraform', provider);
    await fs.ensureDir(tfDir);
    await fs.writeFile(path.join(tfDir, 'main.tf'), terraform);
  }

  // Write manager code
  if (language === 'typescript') {
    const tsCode = generateTypeScriptManager();
    await fs.writeFile(path.join(outputDir, 'vendor-manager.ts'), tsCode);
  } else {
    const pyCode = generatePythonManager();
    await fs.writeFile(path.join(outputDir, 'vendor_manager.py'), pyCode);
  }

  // Write config JSON
  await fs.writeFile(
    path.join(outputDir, 'vendor-config.json'),
    JSON.stringify(config, null, 2)
  );
}

// Display configuration summary
export function displayVendorConfig(config: VendorAssessmentConfig, language: 'typescript' | 'python' = 'typescript', outputDir = './output'): void {
  console.log(chalk.cyan.bold('\n🏢 Vendor Security Assessment Configuration\n'));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.white(`Project: ${config.projectName}`));
  console.log(chalk.white(`Providers: ${config.providers.join(', ').toUpperCase()}`));
  console.log(chalk.white(`Language: ${language}`));

  console.log(chalk.gray('\n📋 Settings:'));
  console.log(chalk.white(`  Auto-Assessment: ${config.settings.autoAssessment ? '✓' : '✗'}`));
  console.log(chalk.white(`  Assessment Frequency: ${config.settings.assessmentFrequency}`));
  console.log(chalk.white(`  Risk Threshold: ${config.settings.riskThreshold}/100`));
  console.log(chalk.white(`  Continuous Monitoring: ${config.settings.enableContinuousMonitoring ? '✓' : '✗'}`));
  console.log(chalk.white(`  Questionnaires: ${config.settings.enableQuestionnaires ? '✓' : '✗'}`));
  console.log(chalk.white(`  Scorecards: ${config.settings.enableScorecards ? '✓' : '✗'}`));
  console.log(chalk.white(`  Require SOC 2: ${config.settings.requireSoc2 ? '✓' : '✗'}`));
  console.log(chalk.white(`  Require ISO 27001: ${config.settings.requireIso27001 ? '✓' : '✗'}`));

  console.log(chalk.gray('\n🏭 Vendors:'));
  config.vendors.forEach(vendor => {
    const statusColor = vendor.riskRating === 'critical' ? 'red' : vendor.riskRating === 'high' ? 'yellow' : 'green';
    console.log(chalk.white(`  • ${vendor.name} (${vendor.tier}) - `) + chalk[statusColor](vendor.riskRating) + chalk.white(` - ${vendor.overallScore}/100`));
  });

  console.log(chalk.gray('\n📊 Scorecards:'));
  config.scorecards.forEach(scorecard => {
    console.log(chalk.white(`  • ${scorecard.vendorName} (${scorecard.period}) - ${scorecard.overallScore}/100 - ${scorecard.trend}`));
  });

  console.log(chalk.gray('\n⚠️ Findings:'));
  const openFindings = config.findings.filter(f => f.status === 'open' || f.status === 'in-progress');
  console.log(chalk.white(`  Open: ${openFindings.length} | Critical: ${config.findings.filter(f => f.severity === 'critical').length}`));

  console.log(chalk.gray('\n📝 Output Files:'));
  console.log(chalk.white(`  • vendor-assessment-guide.md`));
  console.log(chalk.white(`  • terraform/{provider}/main.tf`));
  console.log(chalk.white(`  • vendor-manager.${language === 'typescript' ? 'ts' : 'py'}`));
  console.log(chalk.white(`  • vendor-config.json`));

  console.log(chalk.gray('\n' + '─'.repeat(50)));
  console.log(chalk.green(`✓ Configuration ready. Files will be written to: ${outputDir}`));
}
