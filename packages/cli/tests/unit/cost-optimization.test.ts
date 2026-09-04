import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCostOptimizationMD,
  generateTerraformCostOptimization,
  generateTypeScriptCostOptimization,
  generatePythonCostOptimization,
  writeFiles,
} from '../../src/utils/cost-optimization';

const config = {
  projectName: 'co-app',
  providers: ['aws' as const],
  enableCostMonitoring: true,
  enableBudgetAlerts: false,
  budgets: {
    monthly: 5000,
    daily: 200,
    alerts: [],
  },
  optimizations: {
    enableRightsizing: true,
    enableReservedInstances: false,
    enableSpotInstances: true,
    enableSavingsPlans: false,
    enableAutoScaling: true,
    enableScheduledStartStop: false,
  },
  anomalyDetection: {
    enabled: true,
    threshold: 20,
    lookbackPeriod: 30,
    alertOnAnomaly: true,
  },
  reporting: {
    frequency: 'weekly' as const,
    includeRecommendations: true,
    includeForecast: false,
  },
};

describe('generateCostOptimizationMD', () => {
  it('generates markdown with title', () => {
    const md = generateCostOptimizationMD(config);
    expect(md).toContain('# Cloud Cost Optimization');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateCostOptimizationMD(config).toLowerCase()).toContain('cost');
  });
});

describe('generateTerraformCostOptimization', () => {
  it('includes project name', () => {
    expect(generateTerraformCostOptimization(config)).toContain('co-app');
  });
});

describe('generateTypeScriptCostOptimization', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCostOptimization(config);
    expect(ts).toContain('CostOptimizationManager');
    expect(ts).toContain('co-app');
  });
});

describe('generatePythonCostOptimization', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCostOptimization(config);
    expect(py).toContain('class CostOptimizationManager');
    expect(py).toContain('co-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'co-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'cost-optimization.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'cost-optimization-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'COST_OPTIMIZATION.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'cost_optimization_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('co-app-cost-optimization');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'cost-config.json'), 'utf-8'));
    expect(json.projectName).toBe('co-app');
    expect(json.enableCostMonitoring).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('boto3');
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
