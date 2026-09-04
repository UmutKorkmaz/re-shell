import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateCustomPolicyMarkdown,
  generateCustomPolicyTerraform,
  generateCustomPolicyManagerTypeScript,
  generateCustomPolicyManagerPython,
  writeCustomPolicyFiles,
  displayCustomPolicyConfig,
} from '../../src/utils/custom-policy';

const config = {
  projectName: 'cp-app',
  providers: ['aws' as const],
  settings: {
    autoEnforce: true,
    defaultEnforcementLevel: 'blocking' as const,
    allowExceptions: true,
    requireExceptionApproval: false,
    exceptionApprovers: [],
    exceptionDuration: 30,
    autoExpireExceptions: true,
    auditAllActions: true,
    logLevel: 'info' as const,
    notificationChannels: [],
    defaultRemediation: 'notify' as const,
    dryRun: false,
    bypassConditions: [],
    policyVersioning: true,
    reviewFrequency: 90,
  },
  policies: [],
  rules: [],
  conditions: [],
  exceptions: [],
  enforcement: [],
  templates: [],
};

describe('generateCustomPolicyMarkdown', () => {
  it('generates markdown with title', () => {
    const md = generateCustomPolicyMarkdown(config);
    expect(md).toContain('# Custom Security');
    expect(md).toContain('## Policy Settings');
  });

  it('includes feature descriptions', () => {
    expect(generateCustomPolicyMarkdown(config).toLowerCase()).toContain('policy');
  });
});

describe('generateCustomPolicyTerraform', () => {
  it('includes project name for aws', () => {
    expect(generateCustomPolicyTerraform(config, 'aws')).toContain('cp-app');
  });
});

describe('generateCustomPolicyManagerTypeScript', () => {
  it('generates TS manager class', () => {
    const ts = generateCustomPolicyManagerTypeScript(config);
    expect(ts).toContain('class CustomPolicyManager');
    expect(ts).toContain('CustomPolicyManager');
  });
});

describe('generateCustomPolicyManagerPython', () => {
  it('generates Python manager class', () => {
    const py = generateCustomPolicyManagerPython(config);
    expect(py).toContain('class CustomPolicyManager');
    expect(py).toContain('CustomPolicyManager');
  });
});

describe('writeCustomPolicyFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cp-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeCustomPolicyFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'CUSTOM_POLICY.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'custom-policy-aws.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'custom-policy-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeCustomPolicyFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'custom_policy_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writeCustomPolicyFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'custom-policy-config.json'), 'utf-8'));
    expect(json.projectName).toBe('cp-app');
    expect(json.settings.autoEnforce).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeCustomPolicyFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pydantic');
    expect(req).toContain('python-dotenv');
  });
});

describe('displayCustomPolicyConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayCustomPolicyConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
