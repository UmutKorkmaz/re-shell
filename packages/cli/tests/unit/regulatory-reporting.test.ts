import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateRegulatoryMarkdown,
  generateRegulatoryTerraform,
  generateTypeScriptManager,
  generatePythonManager,
  writeRegulatoryFiles,
  displayRegulatoryConfig,
} from '../../src/utils/regulatory-reporting';

const config = {
  projectName: 'reg-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  settings: {
    autoGenerate: true,
    frequency: 'monthly',
    formats: ['pdf', 'json'],
    includeEvidence: true,
    evidenceRetentionDays: 365,
    requireApproval: true,
    approvers: ['compliance-team'],
    notificationChannels: ['email', 'slack'],
    watermarkReports: true,
    archiveLocation: 's3://reg-archive',
    enableEncryption: true,
    complianceThreshold: 80,
    enableGapAnalysis: true,
    includeRecommendations: true,
    signReports: true,
    enableDashboard: true,
    dashboardRefreshInterval: 15,
    enableRealTimeUpdates: true,
    enableTrendAnalysis: true,
    trendAnalysisPeriod: 90,
    enableBenchmarking: true,
    benchmarkIndustry: 'fintech',
  } as any,
  dashboards: [],
  reports: [],
  controls: [],
  frameworks: [],
  workflows: [],
  alerts: [],
  schedules: [],
  evidence: [],
} as any;

describe('generateRegulatoryMarkdown', () => {
  it('references project name', () => {
    expect(generateRegulatoryMarkdown(config)).toContain('reg-app');
  });
});

describe('generateRegulatoryTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateRegulatoryTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateRegulatoryTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateRegulatoryTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateTypeScriptManager', () => {
  it('produces a typescript module', () => {
    expect(generateTypeScriptManager()).toMatch(/class|Regulatory|regulatory/i);
  });
});

describe('generatePythonManager', () => {
  it('produces a python module', () => {
    expect(generatePythonManager()).toMatch(/class|def/i);
  });
});

describe('writeRegulatoryFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reg-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown + terraform per provider + TS manager + example config', async () => {
    await writeRegulatoryFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'REGULATORY_REPORTING.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'aws', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'azure', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'gcp', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'regulatory-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'config.example.json'))).toBe(true);
  });

  it('writes Python manager', async () => {
    await writeRegulatoryFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'regulatory_manager.py'))).toBe(true);
  });

  it('config.example.json reflects project name', async () => {
    await writeRegulatoryFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'config.example.json'), 'utf-8'));
    expect(json.projectName).toBe('reg-app');
  });
});

describe('displayRegulatoryConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayRegulatoryConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
