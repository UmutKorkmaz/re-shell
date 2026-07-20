import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateRiskMarkdown,
  generateRiskTerraform,
  generateTypeScriptManager,
  generatePythonManager,
  writeRiskFiles,
  displayRiskConfig,
} from '../../src/utils/risk-assessment';

const config = {
  projectName: 'risk-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  settings: {
    autoAssessment: true,
    assessmentFrequency: 'monthly',
    enableContinuousMonitoring: true,
    monitoringInterval: 15,
    enableRealTimeAlerts: true,
    alertEscalationEnabled: true,
    riskAcceptanceThreshold: 70,
    requireApprovalForAcceptance: true,
    riskApprovers: ['security-team'],
    autoCreateMitigation: true,
    mitigationTemplate: 'standard',
    enableRiskHeatmap: true,
    heatmapRefreshInterval: 30,
    enableTrendAnalysis: true,
    trendAnalysisPeriod: 180,
    enablePredictiveAnalysis: false,
    predictiveModel: 'linear-regression',
    enableDependencyTracking: true,
    enableComplianceMapping: true,
    complianceFrameworks: ['sox', 'iso-27001'],
    retentionDays: 1095,
    archiveLocation: 's3://risk-archive',
    enableReporting: true,
    reportSchedule: 'monthly',
    stakeholders: ['ciso', 'legal'],
  } as any,
  risks: [],
  assessments: [],
  mitigations: [],
  monitors: [],
  alerts: [],
  controls: [],
  matrices: [],
  reports: [],
  thresholds: [],
  dependencies: [],
  scenarios: [],
} as any;

describe('generateRiskMarkdown', () => {
  it('references project name', () => {
    expect(generateRiskMarkdown(config)).toContain('risk-app');
  });
});

describe('generateRiskTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateRiskTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateRiskTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateRiskTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateTypeScriptManager', () => {
  it('produces a typescript module', () => {
    expect(generateTypeScriptManager()).toMatch(/class|Risk|risk/i);
  });
});

describe('generatePythonManager', () => {
  it('produces a python module', () => {
    expect(generatePythonManager()).toMatch(/class|def/i);
  });
});

describe('writeRiskFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'risk-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown + terraform per provider + TS manager + example config', async () => {
    await writeRiskFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'RISK_ASSESSMENT.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'aws', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'azure', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'gcp', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'risk-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'config.example.json'))).toBe(true);
  });

  it('writes Python manager', async () => {
    await writeRiskFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'risk_manager.py'))).toBe(true);
  });

  it('config.example.json reflects project name', async () => {
    await writeRiskFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'config.example.json'), 'utf-8'));
    expect(json.projectName).toBe('risk-app');
  });
});

describe('displayRiskConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayRiskConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
