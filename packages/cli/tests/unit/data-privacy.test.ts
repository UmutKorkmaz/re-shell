import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generatePrivacyMarkdown,
  generatePrivacyTerraformAWS,
  generatePrivacyTypeScriptManager,
  generatePrivacyPythonManager,
  generatePrivacyPackageJSON,
  generatePrivacyConfigJSON,
  writePrivacyFiles,
  displayPrivacyConfig,
} from '../../src/utils/data-privacy';

const config = {
  projectName: 'dp-app',
  providers: ['aws' as const],
  settings: {
    enableAutoClassification: true,
    enableDataDiscovery: false,
    enableDataLossPrevention: true,
    enableEncryptionAtRest: true,
    enableEncryptionInTransit: true,
    enableAnonymization: false,
    enablePseudonymization: true,
    enableConsentManagement: true,
    consentExpiryDays: 365,
    enableRightAccess: true,
    enableRightErasure: true,
    enableRightPortability: false,
    requestSLADays: 30,
    enableBreachDetection: true,
    breachNotificationHours: 72,
    enableDataMapping: true,
    enableCrossBorderTransfer: false,
    defaultDataOwner: 'security-team',
    defaultDataCustodian: 'data-team',
    defaultRetentionYears: 7,
    requireDPIA: true,
    dpiaThresholdRisk: 50,
    requireRecordsOfProcessing: true,
    enableAuditLogging: true,
    enableAutomatedPolicies: true,
    classificationConfidence: 85,
    dlpScanInterval: 24,
    enableDataLineage: false,
  },
  dataInventory: [],
  classificationRules: [],
  processingActivities: [],
  dataSubjects: [],
  consentRecords: [],
  dataRequests: [],
  breachRecords: [],
  retentionPolicies: [],
  dpiaRecords: [],
  transfers: [],
};

describe('generatePrivacyMarkdown', () => {
  it('generates markdown with title', () => {
    const md = generatePrivacyMarkdown(config);
    expect(md).toContain('# Data Privacy');
    expect(md).toContain('## Privacy Settings');
  });

  it('includes project name', () => {
    expect(generatePrivacyMarkdown(config)).toContain('dp-app');
  });
});

describe('generatePrivacyTerraformAWS', () => {
  it('includes project name', () => {
    expect(generatePrivacyTerraformAWS(config)).toContain('dp-app');
  });
});

describe('generatePrivacyTypeScriptManager', () => {
  it('generates TS manager class', () => {
    const ts = generatePrivacyTypeScriptManager(config);
    expect(ts).toContain('DataPrivacyManager');
  });
});

describe('generatePrivacyPythonManager', () => {
  it('generates Python manager class', () => {
    const py = generatePrivacyPythonManager(config);
    expect(py).toContain('class DataPrivacyManager');
  });
});

describe('generatePrivacyPackageJSON', () => {
  it('returns package.json for typescript', () => {
    const pkg = generatePrivacyPackageJSON('typescript');
    expect(pkg).toContain('name');
    expect(pkg).toContain('dependencies');
  });

  it('returns requirements for python', () => {
    const req = generatePrivacyPackageJSON('python');
    expect(req).toContain('pydantic');
  });
});

describe('generatePrivacyConfigJSON', () => {
  it('returns JSON with projectName', () => {
    const json = generatePrivacyConfigJSON(config);
    expect(json).toContain('dp-app');
  });
});

describe('writePrivacyFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dp-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writePrivacyFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'DATA_PRIVACY.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'privacy-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'privacy-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writePrivacyFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'privacy_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writePrivacyFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'privacy-config.json'), 'utf-8'));
    expect(json.projectName).toBe('dp-app');
    expect(json.settings.enableAutoClassification).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writePrivacyFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pydantic');
  });
});

describe('displayPrivacyConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayPrivacyConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
