import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateAlertManagementMD,
  generateTerraformAlertManagement,
  generateTypeScriptAlertManagement,
  generatePythonAlertManagement,
  writeFiles,
  alertManagement,
} from '../../src/utils/alert-management';

const config = {
  projectName: 'alert-app',
  providers: ['aws' as const],
  alerts: [
    { enabled: true, name: 'high-cpu', condition: 'cpu > 90%', severity: 'critical' as const, cooldown: 300, threshold: 90 },
  ],
  channels: [
    { name: 'slack-alerts', type: 'slack' as const, config: { webhook: 'https://hooks.slack.com/xxx' }, enabled: true },
  ],
  escalations: [
    { name: 'sev1', trigger: 'severity == emergency', levels: [{ level: 1, wait: 0, action: 'page' as const, target: 'oncall' }] },
  ],
  workflows: [
    { name: 'auto-resolve', triggers: ['metric < threshold'], actions: [], autoResolve: true, resolveAfter: 600 },
  ],
  enableAutoRemediation: true,
  enableIncidentTracking: false,
  enablePostmortem: true,
};

describe('alertManagement', () => {
  it('returns the config as-is', () => {
    expect(alertManagement(config)).toBe(config);
  });
});

describe('generateAlertManagementMD', () => {
  it('generates markdown with title', () => {
    const md = generateAlertManagementMD(config);
    expect(md).toContain('# Custom Alerting');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateAlertManagementMD(config);
    expect(md).toContain('Alert');
    expect(md).toContain('notification');
  });
});

describe('generateTerraformAlertManagement', () => {
  it('includes project name', () => {
    expect(generateTerraformAlertManagement(config)).toContain('alert-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformAlertManagement(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptAlertManagement', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptAlertManagement(config);
    expect(ts).toContain('AlertManagementManager');
    expect(ts).toContain('alert-app');
  });
});

describe('generatePythonAlertManagement', () => {
  it('generates Python manager class', () => {
    const py = generatePythonAlertManagement(config);
    expect(py).toContain('class AlertManagementManager');
    expect(py).toContain('alert-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'alert-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'alert-management.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'alert-management-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'ALERT_MANAGEMENT.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'alert-management-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'alert_management_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('alert-app-alert-management');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'alert-management-config.json'));
    expect(json.projectName).toBe('alert-app');
    expect(json.enableAutoRemediation).toBe(true);
    expect(json.alerts).toHaveLength(1);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pagerduty');
    expect(req).toContain('slack');
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
