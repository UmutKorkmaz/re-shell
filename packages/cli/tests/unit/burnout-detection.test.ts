import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateBurnoutDetectionMD,
  generateTerraformBurnoutDetection,
  generateTypeScriptBurnoutDetection,
  generatePythonBurnoutDetection,
  writeFiles,
  burnoutDetection,
} from '../../src/utils/burnout-detection';

const config = {
  projectName: 'bd-app',
  providers: ['aws' as const],
  teamMembers: [],
  metricConfigs: [],
  interventions: [],
  enableRealTimeMonitoring: true,
  enableAutomatedInterventions: false,
  enableAnonymousSurveys: true,
  surveyFrequency: 7,
  riskThreshold: 75,
  escalationMatrix: {
    medium: ['notify-manager'],
    high: ['notify-director'],
    critical: ['notify-vp'],
  },
};

describe('burnoutDetection', () => {
  it('returns the config as-is', () => {
    expect(burnoutDetection(config)).toBe(config);
  });
});

describe('generateBurnoutDetectionMD', () => {
  it('generates markdown with title', () => {
    const md = generateBurnoutDetectionMD(config);
    expect(md).toContain('# Team Burnout Detection');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateBurnoutDetectionMD(config).toLowerCase()).toContain('wellness');
  });
});

describe('generateTerraformBurnoutDetection', () => {
  it('includes project name', () => {
    expect(generateTerraformBurnoutDetection(config)).toContain('bd-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformBurnoutDetection(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptBurnoutDetection', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptBurnoutDetection(config);
    expect(ts).toContain('BurnoutDetectionManager');
    expect(ts).toContain('bd-app');
  });
});

describe('generatePythonBurnoutDetection', () => {
  it('generates Python manager class', () => {
    const py = generatePythonBurnoutDetection(config);
    expect(py).toContain('class BurnoutDetectionManager');
    expect(py).toContain('bd-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bd-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'burnout-detection.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'burnout-detection-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'BURNOUT_DETECTION.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'burnout_detection_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('bd-app-burnout-detection');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'burnout-detection-config.json'), 'utf-8'));
    expect(json.projectName).toBe('bd-app');
    expect(json.enableRealTimeMonitoring).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pandas');
    expect(req).toContain('numpy');
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
