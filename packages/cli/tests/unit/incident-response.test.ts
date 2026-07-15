import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateIncidentResponseMD,
  generateTerraformIncidentResponse,
  generateTypeScriptIncidentResponse,
  generatePythonIncidentResponse,
  writeFiles,
  incidentResponse,
} from '../../src/utils/incident-response';

const config = {
  projectName: 'incident-app',
  providers: ['aws' as const],
  incidents: [
    { id: 'inc1', title: 'DB outage', description: 'Primary DB down', severity: 'critical' as const, status: 'resolved' as const, detectedAt: Date.now() - 3600000, resolvedAt: Date.now(), assignedTo: { oncall: 'alice' } },
  ],
  timeline: [
    { id: 'tl1', incidentId: 'inc1', timestamp: Date.now(), author: 'alice', type: 'status-update' as const, content: 'Investigating', attachments: [] },
  ],
  communicationRules: [
    { id: 'cr1', name: 'notify-stakeholders', trigger: 'severity == critical', channels: ['slack' as const, 'pagerduty' as const], template: 'Incident {{id}}: {{title}}', recipients: ['team@example.com'] },
  ],
  escalationPolicies: [
    { id: 'ep1', name: 'sev1-policy', levels: [{ level: 1, wait: 0, assignTo: ['oncall'], notify: ['pagerduty' as const] }] },
  ],
  enableAutoDetection: true,
  enableAutoEscalation: false,
  enablePostmortem: true,
};

describe('incidentResponse', () => {
  it('returns the config as-is', () => {
    expect(incidentResponse(config)).toBe(config);
  });
});

describe('generateIncidentResponseMD', () => {
  it('generates markdown with title', () => {
    const md = generateIncidentResponseMD(config);
    expect(md).toContain('# Collaborative Incident Response');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateIncidentResponseMD(config);
    expect(md).toContain('incident');
    expect(md).toContain('escalation');
  });
});

describe('generateTerraformIncidentResponse', () => {
  it('includes project name', () => {
    expect(generateTerraformIncidentResponse(config)).toContain('incident-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformIncidentResponse(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptIncidentResponse', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptIncidentResponse(config);
    expect(ts).toContain('IncidentResponseManager');
    expect(ts).toContain('incident-app');
  });
});

describe('generatePythonIncidentResponse', () => {
  it('generates Python manager class', () => {
    const py = generatePythonIncidentResponse(config);
    expect(py).toContain('class IncidentResponseManager');
    expect(py).toContain('incident-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ir-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'incident-response.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'incident-response-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'INCIDENT_RESPONSE.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'incident-response-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'incident_response_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('incident-app-incident-response');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'incident-response-config.json'));
    expect(json.projectName).toBe('incident-app');
    expect(json.enableAutoDetection).toBe(true);
    expect(json.incidents).toHaveLength(1);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('slack');
    expect(req).toContain('pagerduty');
  });
});

describe('displayConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
