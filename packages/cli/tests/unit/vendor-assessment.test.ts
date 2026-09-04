import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateVendorMarkdown,
  generateVendorTerraform,
  generateTypeScriptManager,
  generatePythonManager,
  writeVendorFiles,
  displayVendorConfig,
} from '../../src/utils/vendor-assessment';

const config = {
  projectName: 'vendor-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  settings: {
    autoAssessment: true,
    assessmentFrequency: 'quarterly',
    requireApproval: true,
    approvers: ['security-team'],
    riskThreshold: 70,
    enableContinuousMonitoring: true,
    monitoringInterval: 7,
    enableQuestionnaires: true,
    questionnaireTemplate: 'sig-core',
    enableScorecards: true,
    scorecardWeighting: { security: 40, compliance: 30, financial: 20, performance: 10 },
    enableFindings: true,
    findingRetentionDays: 365,
    enableAuditLogging: true,
    notifyFindings: true,
    notificationChannels: ['email', 'slack'],
    enableBenchmarking: true,
    benchmarkIndustry: 'fintech',
    requireContractReview: true,
    contractReviewFrequency: 'annual',
    enableIncidentTracking: true,
    incidentRetentionDays: 730,
    requireSoc2: true,
    requireIso27001: true,
    requireHipaa: false,
    requirePciDss: true,
    requireGdpr: true,
    customRequirements: [],
  } as any,
  vendors: [],
  assessments: [],
  scorecards: [],
  questionnaires: [],
  findings: [],
  reviews: [],
  approvals: [],
  contracts: [],
  incidents: [],
} as any;

describe('generateVendorMarkdown', () => {
  it('references project name', () => {
    expect(generateVendorMarkdown(config)).toContain('vendor-app');
  });
});

describe('generateVendorTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateVendorTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateVendorTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateVendorTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateTypeScriptManager', () => {
  it('produces a typescript module', () => {
    expect(generateTypeScriptManager()).toMatch(/class|VendorManager|vendor/i);
  });
});

describe('generatePythonManager', () => {
  it('produces a python module', () => {
    expect(generatePythonManager()).toMatch(/class|def/i);
  });
});

describe('writeVendorFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vendor-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown + terraform per provider + TS manager + config', async () => {
    await writeVendorFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'vendor-assessment-guide.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'aws', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'azure', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'terraform', 'gcp', 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'vendor-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'vendor-config.json'))).toBe(true);
  });

  it('writes Python manager', async () => {
    await writeVendorFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'vendor_manager.py'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeVendorFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'vendor-config.json'), 'utf-8'));
    expect(json.projectName).toBe('vendor-app');
  });
});

describe('displayVendorConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayVendorConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
