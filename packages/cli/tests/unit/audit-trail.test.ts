import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateAuditMarkdown,
  generateAuditTerraformAWS,
  generateAuditTerraformAzure,
  generateAuditTypeScriptManager,
  generateAuditPythonManager,
  generateAuditPackageJSON,
  generateAuditConfigJSON,
  displayAuditConfig,
  writeAuditFiles,
  type AuditConfig,
} from '../../src/utils/audit-trail';

const config: AuditConfig = {
  projectName: 'audit-app',
  providers: ['aws', 'azure', 'gcp'],
  settings: {
    enableTamperProof: true,
    hashAlgorithm: 'sha256',
    signatureType: 'hmac',
    enableBlockchain: false,
    enableRealTimeSigning: true,
    signingInterval: 60,
    enableEncryption: true,
    enableCompression: false,
    compressionLevel: 0,
    logFormat: 'json',
    retentionPeriod: '365-days',
    archiveLocation: 's3://audit-archive',
    enableArchiveEncryption: true,
    enableIndexing: true,
    indexFields: ['userId', 'event'],
    enableSearch: true,
    enableAggregation: true,
    aggregationInterval: 5,
    enableAnomalyDetection: true,
    anomalyThreshold: 80,
    enableForwarding: false,
    forwardTargets: [],
    enableBackup: true,
    backupLocation: 's3://audit-backup',
    backupInterval: 24,
  } as any,
  logSources: [],
  eventTypes: ['user-login', 'data-access'],
  retentionPolicies: [],
  auditLogs: [],
  integrityChecks: [],
  alerts: [],
  compliance: {
    level: 'standard',
    enabledFrameworks: ['soc-2'],
    requireImmutableLogs: true,
    requireChainOfCustody: true,
    requireTamperEvidence: true,
    minimumRetention: 365,
    requireAuditTrailAccess: true,
    auditTrailAccessLog: true,
    requireLogReview: true,
    reviewInterval: 30,
    reviewers: ['security-team'],
    generateComplianceReport: true,
    reportSchedule: 'monthly',
  } as any,
} as any;

describe('generateAuditMarkdown', () => {
  it('references project name', () => {
    expect(generateAuditMarkdown(config)).toContain('audit-app');
  });
});

describe('generateAuditTerraformAWS', () => {
  it('emits AWS terraform', () => {
    expect(generateAuditTerraformAWS(config)).toMatch(/aws|cloudtrail|provider/i);
  });
});

describe('generateAuditTerraformAzure', () => {
  it('emits Azure terraform', () => {
    expect(generateAuditTerraformAzure(config)).toMatch(/azurerm|provider/i);
  });
});

describe('generateAuditTypeScriptManager', () => {
  it('produces a typescript module exposing an audit manager', () => {
    const ts = generateAuditTypeScriptManager(config);
    expect(ts).toMatch(/class|AuditManager|Audit/i);
  });
});

describe('generateAuditPythonManager', () => {
  it('produces a python module exposing an audit manager', () => {
    const py = generateAuditPythonManager(config);
    expect(py).toMatch(/class|def/i);
  });
});

describe('generateAuditPackageJSON', () => {
  it('typescript package.json lists main entrypoint', () => {
    const pkg = JSON.parse(generateAuditPackageJSON('typescript'));
    expect(pkg).toBeTruthy();
    expect(pkg.main).toBeTruthy();
  });

  it('python returns a requirements list', () => {
    const out = generateAuditPackageJSON('python');
    expect(out).toMatch(/python-dateutil|pydantic/);
  });
});

describe('generateAuditConfigJSON', () => {
  it('serialises the input config', () => {
    const json = JSON.parse(generateAuditConfigJSON(config));
    expect(json.projectName).toBe('audit-app');
  });
});

describe('writeAuditFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown, terraform per provider, manager, package.json and config', async () => {
    await writeAuditFiles(config, tmpDir, 'typescript');
    for (const file of [
      'AUDIT_TRAIL.md',
      'audit-aws.tf',
      'audit-azure.tf',
      'audit-gcp.tf',
      'package.json',
      'audit-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python manager when language=python', async () => {
    await writeAuditFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });
});

describe('displayAuditConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayAuditConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
