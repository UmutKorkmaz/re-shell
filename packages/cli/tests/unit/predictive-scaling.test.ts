import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generatePredictiveScalingMD,
  generateTerraformPredictiveScaling,
  generateTypeScriptPredictiveScaling,
  generatePythonPredictiveScaling,
  writeFiles,
  predictiveScaling,
} from '../../src/utils/predictive-scaling';

const config: any = {
  projectName: 'scaling-app',
  providers: ['aws', 'gcp'],
  prediction: {
    enabled: true,
    model: 'arima',
    lookbackWindow: '30d',
    forecastHorizon: '7d',
    accuracyTarget: 0.9,
  },
  capacity: [
    { resource: 'compute', min: 1, max: 10, current: 3, target: 5, unit: 'vCPU' },
  ],
  policies: [
    {
      name: 'aggressive-compute',
      resource: 'compute',
      strategy: 'aggressive',
      scaleUpThreshold: 0.7,
      scaleDownThreshold: 0.3,
      cooldownPeriod: 300,
      predictionWeight: 0.6,
    },
  ],
  costOptimization: {
    enabled: true,
    targetSavings: 0.25,
    preferredInstanceTypes: ['t3.medium', 't3.large'],
    reservedInstances: true,
    spotInstances: false,
    rightSizing: true,
  },
  enableBudgetAlerts: true,
  enableResourceOptimization: false,
};

describe('displayConfig', () => {
  it('logs summary of the scaling configuration', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('scaling-app');
    expect(out).toContain('arima');
    expect(out).toContain('aws');
    expect(out).toContain('gcp');
    expect(out).toContain('90.0%');
    spy.mockRestore();
  });
});

describe('generatePredictiveScalingMD', () => {
  it('returns markdown with feature list', () => {
    const md = generatePredictiveScalingMD(config);
    expect(md).toContain('# Predictive Scaling and Capacity Planning');
    expect(md).toContain('Predictive scaling with ML models');
    expect(md).toContain('ARIMA');
    expect(md).toContain('Cost optimization');
    expect(md).toContain('Multi-cloud');
  });
});

describe('generateTerraformPredictiveScaling', () => {
  it('returns Terraform header with project name', () => {
    const tf = generateTerraformPredictiveScaling(config);
    expect(tf).toContain('scaling-app');
    expect(tf).toContain('# Auto-generated Predictive Scaling Terraform');
  });
});

describe('generateTypeScriptPredictiveScaling', () => {
  it('generates a TypeScript manager class with project name', () => {
    const code = generateTypeScriptPredictiveScaling(config);
    expect(code).toContain('scaling-app');
    expect(code).toContain('PredictiveScalingManager');
    expect(code).toContain('extends EventEmitter');
    expect(code).toContain('export default predictiveScalingManager');
  });
});

describe('generatePythonPredictiveScaling', () => {
  it('generates a Python manager class with project name', () => {
    const code = generatePythonPredictiveScaling(config);
    expect(code).toContain('scaling-app');
    expect(code).toContain('class PredictiveScalingManager');
    expect(code).toContain('import asyncio');
  });
});

describe('predictiveScaling passthrough', () => {
  it('returns the same config that was provided', () => {
    expect(predictiveScaling(config)).toBe(config);
  });
});

describe('writeFiles', () => {
  let tmpDir: string;
  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ps-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript language files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'predictive-scaling.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'predictive-scaling-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'PREDICTIVE_SCALING.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'predictive-scaling-config.json'))).toBe(true);

    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('scaling-app-predictive-scaling');

    const stored = await fs.readJson(path.join(tmpDir, 'predictive-scaling-config.json'));
    expect(stored.projectName).toBe('scaling-app');
    expect(stored.prediction.model).toBe('arima');
  });

  it('writes Python language files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'predictive-scaling.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'predictive_scaling_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    const reqs = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('scikit-learn');
    expect(reqs).toContain('prophet');
  });
});
