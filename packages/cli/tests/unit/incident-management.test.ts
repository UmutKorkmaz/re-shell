import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generateIncidentManagementMarkdown,
  generateIncidentManagementTerraform,
  generateIncidentManagerTypeScript,
  generateIncidentManagerPython,
  writeIncidentManagementFiles,
  displayIncidentManagementConfig,
  type IncidentManagementConfig,
} from '../../src/utils/incident-management';

/**
 * incident-management is a code-gen utility (Markdown / Terraform / TS / Python
 * bundles) driven by a deeply-nested IncidentManagementConfig. We build one
 * valid fixture and assert on the deterministic string output of each
 * generator, plus the on-disk bundle written by writeIncidentManagementFiles.
 */

const D = (s: string) => new Date(s);
const PROJECT = 'secure-platform';

/** A complete, valid IncidentManagementConfig fixture (1 of each entity). */
function makeConfig(): IncidentManagementConfig {
  return {
    projectName: PROJECT,
    providers: ['aws', 'azure', 'gcp'],
    settings: {
      autoTriage: true,
      autoContainment: false,
      autoInvestigation: true,
      investigationDepth: 'comprehensive',
      evidenceCollection: 'fully-automated',
      retentionPeriod: 90,
      slaResponseTime: { p1: 15, p2: 30, p3: 60, p4: 120, p5: 240 },
      slaResolutionTime: { p1: 240, p2: 480, p3: 960, p4: 1920, p5: 3840 },
      notificationChannels: ['email', 'slack'],
      escalationRules: [
        {
          id: 'esc-1',
          name: 'Critical Escalation',
          conditions: [{ field: 'severity', operator: 'equals', value: 'critical' }],
          actions: [{ type: 'notify', target: 'oncall', message: 'Critical incident' }],
          escalateTo: ['ciso'],
          notifyChannels: ['pagerduty'],
        },
      ],
      approvalRequired: true,
      approvers: ['ciso', 'sec-lead'],
      forensicImaging: true,
      chainOfCustody: true,
      legalHold: true,
      reportGeneration: true,
      postmortemRequired: true,
    },
    incidents: [
      {
        id: 'INC-001',
        title: 'Ransomware Outbreak',
        description: 'Mass file encryption detected across file servers.',
        type: 'ransomware',
        severity: 'critical',
        status: 'containing',
        phase: 'containment',
        priority: 'p1',
        confidence: 0.85,
        detectedAt: D('2026-01-10T08:00:00.000Z'),
        reportedBy: 'edr-alert',
        assignedTo: 'blue-team',
        team: ['ir-team', 'infra'],
        watchers: ['ciso'],
        affectedAssets: [
          {
            id: 'asset-1',
            name: 'fs-prod-01',
            type: 'server',
            impact: 'critical',
            compromiseLevel: 'confirmed',
            isolationStatus: 'isolated',
            evidenceCollected: 3,
          },
        ],
        indicators: [
          {
            id: 'ioc-1',
            type: 'hash',
            value: 'abc123deadbeef',
            description: 'Known ransomware binary hash',
            confidence: 0.95,
            firstSeen: D('2026-01-10T07:55:00.000Z'),
            lastSeen: D('2026-01-10T08:00:00.000Z'),
            source: 'threat-intel',
          },
        ],
        timeline: [
          {
            id: 'tl-1',
            timestamp: D('2026-01-10T08:01:00.000Z'),
            phase: 'identification',
            action: 'Isolated host',
            actor: 'auto-isolation',
            description: 'EDR auto-isolated the affected host',
            evidence: ['edr-log-1'],
            automated: true,
          },
        ],
        recoverySteps: ['Restore from backup', 'Validate integrity'],
        rootCause: 'Exposed RDP service with weak credentials',
        tags: ['ransomware', 'rdp'],
        metadata: { region: 'eu-west-1' },
      },
    ],
    playbooks: [
      {
        id: 'PB-001',
        name: 'Ransomware Response',
        description: 'Standard containment and recovery for ransomware.',
        incidentTypes: ['ransomware'],
        severity: ['critical', 'high'],
        status: 'active',
        version: '2.1.0',
        author: 'sec-lead',
        approvedBy: 'ciso',
        lastUpdated: D('2026-01-05T00:00:00.000Z'),
        autoExecute: true,
        approvalRequired: false,
        phases: [
          {
            id: 'phase-1',
            name: 'Contain',
            order: 1,
            description: 'Isolate affected hosts',
            duration: 30,
            steps: [
              {
                id: 'step-1',
                order: 1,
                name: 'Isolate host',
                description: 'Network isolation',
                action: 'isolate',
                automated: true,
                parameters: { mode: 'strict' },
                timeout: 60,
                onSuccess: 'mark-contained',
                onFailure: 'escalate',
                dependencies: [],
              },
            ],
            dependencies: [],
          },
        ],
        estimatedDuration: 120,
        successRate: 0.92,
        executions: 17,
        variables: [
          {
            name: 'isolationMode',
            type: 'string',
            description: 'Isolation strictness',
            required: true,
            defaultValue: 'strict',
          },
        ],
      },
    ],
    investigations: [
      {
        id: 'INV-001',
        incidentId: 'INC-001',
        title: 'Ransomware Root Cause Analysis',
        status: 'in-progress',
        priority: 'p1',
        assignedTo: 'forensics',
        team: ['ir-team'],
        startedAt: D('2026-01-10T08:10:00.000Z'),
        estimatedDuration: 8,
        progress: 45,
        tasks: [
          {
            id: 'task-1',
            name: 'Acquire memory image',
            description: 'Capture volatile memory',
            status: 'completed',
            assignedTo: 'forensics',
            estimatedDuration: 30,
            dependencies: [],
            automated: false,
            artifacts: ['art-1'],
            findings: [],
          },
        ],
        findings: [
          {
            id: 'finding-1',
            category: 'initial-access',
            severity: 'critical',
            confidence: 0.9,
            description: 'Attacker brute-forced RDP',
            evidence: ['log-1'],
            discoveredAt: D('2026-01-10T09:00:00.000Z'),
            discoveredBy: 'forensics',
            verified: true,
          },
        ],
        hypotheses: [
          {
            id: 'hyp-1',
            description: 'Credential reuse from breach',
            confidence: 0.7,
            status: 'confirmed',
            evidence: ['log-2'],
            testedBy: 'analyst-1',
          },
        ],
        conclusions: ['Initial access via brute-forced RDP'],
        recommendations: ['Enforce MFA on all RDP endpoints'],
        tools: [
          {
            name: 'volatility',
            version: '3.0',
            purpose: 'Memory analysis',
            command: 'vol.py -f memory.img',
            parameters: { profile: 'win10' },
            output: 'pslist',
            executedAt: D('2026-01-10T09:30:00.000Z'),
            executedBy: 'forensics',
          },
        ],
      },
    ],
    artifacts: [],
    evidence: [],
    communications: [],
    analytics: [],
    integrations: [],
  };
}

describe('generateIncidentManagementMarkdown', () => {
  const md = generateIncidentManagementMarkdown(makeConfig());

  it('renders the title, project, providers and settings flags', () => {
    expect(md).toContain('# Security Incident Management and Forensics');
    expect(md).toContain(`**Project**: ${PROJECT}`);
    expect(md).toContain('**Providers**: aws, azure, gcp');
    expect(md).toContain('**Auto-Triage**: Yes');
    expect(md).toContain('**Auto-Containment**: No');
    expect(md).toContain('**Auto-Investigation**: Yes');
    expect(md).toContain('**Investigation Depth**: comprehensive');
  });

  it('renders the management settings block', () => {
    expect(md).toContain('## Management Settings');
    expect(md).toContain('**Evidence Collection**: fully-automated');
    expect(md).toContain('**Retention Period**: 90 days');
    expect(md).toContain('**Forensic Imaging**: true');
    expect(md).toContain('**Chain of Custody**: true');
    expect(md).toContain('**Postmortem Required**: true');
  });

  it('renders each incident with severity/phase/counts and root cause', () => {
    expect(md).toContain('### Ransomware Outbreak - CRITICAL');
    expect(md).toContain('- **ID**: INC-001');
    expect(md).toContain('- **Type**: ransomware');
    expect(md).toContain('- **Status**: containing');
    expect(md).toContain('- **Phase**: containment');
    expect(md).toContain('- **Priority**: P1');
    expect(md).toContain('- **Confidence**: 85.0%');
    expect(md).toContain('- **Affected Assets**: 1');
    expect(md).toContain('- **Indicators**: 1');
    expect(md).toContain('- **Timeline Entries**: 1');
    expect(md).toContain('fs-prod-01 (server) - Impact: critical');
    expect(md).toContain('**Root Cause**: Exposed RDP service with weak credentials');
  });

  it('renders each playbook with version, phases, success rate and types', () => {
    expect(md).toContain('### Ransomware Response');
    expect(md).toContain('- **Status**: active');
    expect(md).toContain('- **Version**: 2.1.0');
    expect(md).toContain('- **Author**: sec-lead');
    expect(md).toContain('- **Auto-Execute**: true');
    expect(md).toContain('- **Phases**: 1');
    expect(md).toContain('- **Success Rate**: 92.0%');
    expect(md).toContain('- **Executions**: 17');
    expect(md).toContain('**Incident Types**: ransomware');
    expect(md).toContain('**Estimated Duration**: 120 minutes');
  });

  it('renders each investigation with progress and conclusions', () => {
    expect(md).toContain('### Ransomware Root Cause Analysis');
    expect(md).toContain('- **Status**: in-progress');
    expect(md).toContain('- **Priority**: P1');
    expect(md).toContain('- **Progress**: 45%');
    expect(md).toContain('- **Tasks**: 1');
    expect(md).toContain('- **Findings**: 1');
    expect(md).toContain('- **Hypotheses**: 1');
    expect(md).toContain('- Initial access via brute-forced RDP');
  });

  it('renders the aggregate section counts', () => {
    expect(md).toContain('## Incidents (1)');
    expect(md).toContain('## Playbooks (1)');
    expect(md).toContain('## Investigations (1)');
    expect(md).toContain('## Forensic Artifacts (0)');
    expect(md).toContain('## Evidence (0)');
    expect(md).toContain('## Communications (0)');
    expect(md).toContain('## Analytics (0)');
  });
});

describe('generateIncidentManagementTerraform', () => {
  const cfg = makeConfig();

  it('aws: provisions forensic bucket, SNS, lambda, security hub, detective, cloudtrail', () => {
    const tf = generateIncidentManagementTerraform(cfg, 'aws');
    expect(tf).toContain('# AWS Incident Management');
    expect(tf).toContain(`bucket = "${PROJECT}-forensic-artifacts"`);
    expect(tf).toContain('resource "aws_s3_bucket" "forensic_artifacts"');
    expect(tf).toContain('resource "aws_sns_topic" "incident_alerts"');
    expect(tf).toContain('resource "aws_lambda_function" "incident_automation"');
    expect(tf).toContain('resource "aws_securityhub_account" "main"');
    expect(tf).toContain('resource "aws_detective_graph" "main"');
    expect(tf).toContain('resource "aws_cloudtrail" "forensics"');
    expect(tf).toContain(`days = ${cfg.settings.retentionPeriod}`);
  });

  it('azure: provisions forensics storage (hyphens stripped), sentinel and eventhub', () => {
    const tf = generateIncidentManagementTerraform(cfg, 'azure');
    expect(tf).toContain('# Azure Incident Management');
    expect(tf).toContain('resource "azurerm_storage_account" "forensics"');
    expect(tf).toContain(`name                     = "secureplatformforensics"`);
    expect(tf).toContain('resource "azurerm_sentinel_alert_rule" "incident_automation"');
    expect(tf).toContain('resource "azurerm_eventhub" "incident_events"');
    expect(tf).toContain(`message_retention   = ${cfg.settings.retentionPeriod}`);
  });

  it('gcp: provisions forensic bucket, pubsub, bigquery and cloud function', () => {
    const tf = generateIncidentManagementTerraform(cfg, 'gcp');
    expect(tf).toContain('# GCP Incident Management');
    expect(tf).toContain('resource "google_storage_bucket" "forensics"');
    expect(tf).toContain(`name = "${PROJECT}-incident-alerts"`);
    expect(tf).toContain('resource "google_pubsub_topic" "incident_alerts"');
    expect(tf).toContain('resource "google_bigquery_dataset" "forensics"');
    expect(tf).toContain('resource "google_cloudfunctions_function" "incident_automation"');
    expect(tf).toContain(`age = ${cfg.settings.retentionPeriod}`);
  });
});

describe('generateIncidentManagerTypeScript', () => {
  const ts = generateIncidentManagerTypeScript(makeConfig());

  it('imports EventEmitter and declares the manager class extending it', () => {
    expect(ts).toContain(`import { EventEmitter } from 'events';`);
    expect(ts).toContain('class IncidentManagementManager extends EventEmitter {');
  });

  it('declares the Incident/Investigation/Artifact interfaces', () => {
    expect(ts).toContain('interface Incident {');
    expect(ts).toContain('interface Investigation {');
    expect(ts).toContain('interface Artifact {');
  });

  it('declares the async CRUD methods and re-exports the class', () => {
    expect(ts).toContain('async createIncident(data: any): Promise<Incident> {');
    expect(ts).toContain('async startInvestigation(incidentId: string)');
    expect(ts).toContain('async collectArtifact(incidentId: string, type: string, name: string, path: string)');
    expect(ts).toContain('async updateIncidentStatus(incidentId: string, status: string, phase: string)');
    expect(ts).toContain('export { IncidentManagementManager };');
  });
});

describe('generateIncidentManagerPython', () => {
  const py = generateIncidentManagerPython(makeConfig());

  it('imports typing/dataclass/datetime/enum', () => {
    expect(py).toContain('from typing import Dict, List, Any, Optional');
    expect(py).toContain('from dataclasses import dataclass');
    expect(py).toContain('from datetime import datetime');
    expect(py).toContain('from enum import Enum');
  });

  it('declares the status/phase enums and the dataclass models', () => {
    expect(py).toContain('class IncidentStatus(str, Enum):');
    expect(py).toContain('class IncidentPhase(str, Enum):');
    expect(py).toContain('@dataclass\nclass Incident:');
    expect(py).toContain('@dataclass\nclass Investigation:');
    expect(py).toContain('@dataclass\nclass Artifact:');
  });

  it('declares the manager class and its async methods', () => {
    expect(py).toContain('class IncidentManagementManager:');
    expect(py).toContain('def __init__(self):');
    expect(py).toContain('async def create_incident(self, data: Dict[str, Any]) -> Incident:');
    expect(py).toContain('async def start_investigation(self, incident_id: str) -> Investigation:');
    expect(py).toContain('async def collect_artifact(self, incident_id: str, artifact_type: str, name: str, path: str) -> Artifact:');
    expect(py).toContain('async def update_incident_status(self, incident_id: str, status: str, phase: str) -> Dict[str, Any]:');
  });
});

describe('writeIncidentManagementFiles', () => {
  let out: string;

  beforeEach(async () => {
    out = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-incident-'));
  });

  afterEach(async () => {
    await fs.remove(out);
  });

  it('writes the full TypeScript bundle (md, per-provider tf, manager, package.json, config)', async () => {
    await writeIncidentManagementFiles(makeConfig(), out, 'typescript');

    expect(await fs.pathExists(path.join(out, 'INCIDENT_MANAGEMENT.md'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'incident-management-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'incident-management-azure.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'incident-management-gcp.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'incident-management-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'incident-management-config.json'))).toBe(true);

    const pkg = await fs.readJson(path.join(out, 'package.json'));
    expect(pkg.name).toBe(PROJECT);
    expect(pkg.main).toBe('incident-management-manager.ts');
    expect(pkg.dependencies).toHaveProperty('events');
    expect(pkg.dependencies).toHaveProperty('@types/node');
  });

  it('writes the Python bundle (manager.py + requirements.txt, no package.json)', async () => {
    await writeIncidentManagementFiles(makeConfig(), out, 'python');

    expect(await fs.pathExists(path.join(out, 'incident_management_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'requirements.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'package.json'))).toBe(false);

    const reqs = await fs.readFile(path.join(out, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('pydantic>=2.0.0');
    expect(reqs).toContain('python-dotenv>=1.0.0');
  });

  it('serializes the full config into config.json (round-trip)', async () => {
    await writeIncidentManagementFiles(makeConfig(), out, 'typescript');
    const written = await fs.readJson(path.join(out, 'incident-management-config.json'));
    expect(written.projectName).toBe(PROJECT);
    expect(written.incidents).toHaveLength(1);
    expect(written.incidents[0].id).toBe('INC-001');
    expect(written.settings.retentionPeriod).toBe(90);
  });

  it('writes only the requested providers tf files', async () => {
    const cfg = makeConfig();
    cfg.providers = ['aws'];
    await writeIncidentManagementFiles(cfg, out, 'typescript');
    expect(await fs.pathExists(path.join(out, 'incident-management-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(out, 'incident-management-azure.tf'))).toBe(false);
    expect(await fs.pathExists(path.join(out, 'incident-management-gcp.tf'))).toBe(false);
  });

  it('creates the output directory when missing', async () => {
    const nested = path.join(out, 'nested', 'deep');
    await writeIncidentManagementFiles(makeConfig(), nested, 'typescript');
    expect(await fs.pathExists(path.join(nested, 'INCIDENT_MANAGEMENT.md'))).toBe(true);
  });
});

describe('displayIncidentManagementConfig', () => {
  const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, '');

  it('prints the project, providers, settings flags and entity counts', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      displayIncidentManagementConfig(makeConfig());
      const out = stripAnsi(spy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n'));
      expect(out).toContain('Security Incident Management and Forensics');
      expect(out).toContain(`Project Name: ${PROJECT}`);
      expect(out).toContain('Providers: aws, azure, gcp');
      expect(out).toContain('Auto-Triage: Yes');
      expect(out).toContain('Auto-Containment: No');
      expect(out).toContain('Auto-Investigation: Yes');
      expect(out).toContain('Incidents: 1');
      expect(out).toContain('Playbooks: 1');
      expect(out).toContain('Investigations: 1');
      expect(out).toContain('Forensic Artifacts: 0');
    } finally {
      spy.mockRestore();
    }
  });

  it('reflects disabled automation toggles', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const cfg = makeConfig();
      cfg.settings.autoTriage = false;
      cfg.settings.autoInvestigation = false;
      displayIncidentManagementConfig(cfg);
      const out = stripAnsi(spy.mock.calls.map((c: unknown[]) => c.join(' ')).join('\n'));
      expect(out).toContain('Auto-Triage: No');
      expect(out).toContain('Auto-Investigation: No');
    } finally {
      spy.mockRestore();
    }
  });
});
