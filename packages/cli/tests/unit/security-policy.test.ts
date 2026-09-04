import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateSecurityPolicyMarkdown,
  generateSecurityPolicyTerraform,
  generatePolicyManagerTypeScript,
  generatePolicyManagerPython,
  writeSecurityPolicyFiles,
  displaySecurityPolicyConfig,
} from '../../src/utils/security-policy';

const config = {
  projectName: 'sec-pol-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  settings: {
    autoEnforce: true,
    enforcementMode: 'block' as const,
    scanInterval: 15,
    notificationEnabled: true,
    notificationChannels: ['email'],
    autoRemediation: false,
    autoRemediationTimeout: 30,
    requireApproval: true,
    approvers: ['security-team'],
    auditRetentionDays: 90,
    logLevel: 'info' as const,
    enableReporting: true,
    reportFrequency: 'weekly' as const,
    complianceFrameworks: [],
    baselineTemplates: [],
  },
  policies: [],
  rules: [],
  violations: [],
  exceptions: [],
  audits: [],
  compliance: [],
  enforcement: [],
} as any;

describe('generateSecurityPolicyMarkdown', () => {
  it('includes project name and heading', () => {
    const md = generateSecurityPolicyMarkdown(config);
    expect(md).toContain('sec-pol-app');
  });

  it('mentions enforcement configuration', () => {
    expect(generateSecurityPolicyMarkdown(config).toLowerCase()).toContain('enforce');
  });
});

describe('generateSecurityPolicyTerraform', () => {
  it('aws provider emits AWS resources', () => {
    const tf = generateSecurityPolicyTerraform(config, 'aws');
    expect(tf).toMatch(/aws|provider/i);
  });

  it('azure provider emits Azure resources', () => {
    expect(generateSecurityPolicyTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits GCP resources', () => {
    expect(generateSecurityPolicyTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generatePolicyManagerTypeScript', () => {
  it('produces a typescript module', () => {
    const ts = generatePolicyManagerTypeScript(config);
    expect(ts).toMatch(/class|SecurityPolicy/i);
  });
});

describe('generatePolicyManagerPython', () => {
  it('produces a python module', () => {
    const py = generatePolicyManagerPython(config);
    expect(py).toMatch(/class|def/i);
  });
});

describe('writeSecurityPolicyFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'secpol-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output + terraform per provider', async () => {
    await writeSecurityPolicyFiles(config, tmpDir, 'typescript');
    for (const file of [
      'SECURITY_POLICY.md',
      'security-policy-aws.tf',
      'security-policy-azure.tf',
      'security-policy-gcp.tf',
      'security-policy-manager.ts',
      'package.json',
      'security-policy-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output', async () => {
    await writeSecurityPolicyFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'security_policy_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeSecurityPolicyFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'security-policy-config.json'), 'utf-8'));
    expect(json.projectName).toBe('sec-pol-app');
  });
});

describe('displaySecurityPolicyConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displaySecurityPolicyConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
