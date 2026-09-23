import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateAnomalyDetectionMD,
  generateTerraformAnomalyDetection,
  generateTypeScriptAnomalyDetection,
  generatePythonAnomalyDetection,
  writeFiles,
  anomalyDetection,
} from '../../src/utils/anomaly-detection';

const config = {
  projectName: 'test-project',
  providers: ['aws' as const],
  anomaly: {
    enabled: true,
    algorithm: 'isolation-forest' as const,
    sensitivity: 0.8,
    trainingWindow: '30d',
    detectionInterval: 60,
    threshold: 0.95,
  },
  patterns: [
    { name: 'cpu-spike', pattern: 'cpu > 90%', metrics: ['cpu'], conditions: {} },
  ],
  alerts: [
    { name: 'high-cpu', condition: 'cpu > 95%', severity: 'high' as const, channels: ['email'] },
  ],
  responses: [
    { trigger: 'cpu > 95%', actions: [{ type: 'scale-up' as const, params: {} }], cooldown: 300 },
  ],
  enableAutoResponse: true,
  enableRetraining: true,
  enableExplainability: false,
};

describe('anomalyDetection', () => {
  it('returns the config as-is', () => {
    const result = anomalyDetection(config);
    expect(result).toBe(config);
  });
});

describe('generateAnomalyDetectionMD', () => {
  it('generates markdown with title', () => {
    const md = generateAnomalyDetectionMD(config);
    expect(md).toContain('# Anomaly Detection with Machine Learning');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateAnomalyDetectionMD(config);
    expect(md).toContain('Isolation Forest');
    expect(md).toContain('Automated alerting');
    expect(md).toContain('Self-learning');
    expect(md).toContain('Integration with cloud');
  });
});

describe('generateTerraformAnomalyDetection', () => {
  it('includes project name', () => {
    const tf = generateTerraformAnomalyDetection(config);
    expect(tf).toContain('test-project');
    expect(tf).toContain('Terraform');
  });

  it('includes timestamp', () => {
    const before = Date.now();
    const tf = generateTerraformAnomalyDetection(config);
    const after = Date.now();
    expect(tf).toContain('Generated at:');
    // Extract timestamp from string and verify it's recent
    expect(tf).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('generateTypeScriptAnomalyDetection', () => {
  it('generates TypeScript manager class', () => {
    const ts = generateTypeScriptAnomalyDetection(config);
    expect(ts).toContain('AnomalyDetectionManager');
    expect(ts).toContain('extends EventEmitter');
    expect(ts).toContain('export default');
    expect(ts).toContain('test-project');
  });
});

describe('generatePythonAnomalyDetection', () => {
  it('generates Python manager class', () => {
    const py = generatePythonAnomalyDetection(config);
    expect(py).toContain('class AnomalyDetectionManager');
    expect(py).toContain('test-project');
    expect(py).toContain('import asyncio');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anomaly-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'anomaly-detection.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'anomaly-detection-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'ANOMALY_DETECTION.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'anomaly-detection-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'anomaly-detection.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'anomaly_detection_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'ANOMALY_DETECTION.md'))).toBe(true);
  });

  it('package.json has correct name for TypeScript', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('test-project-anomaly-detection');
    expect(pkg.dependencies).toHaveProperty('@types/node');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'anomaly-detection-config.json'));
    expect(json.projectName).toBe('test-project');
    expect(json.anomaly.algorithm).toBe('isolation-forest');
    expect(json.enableAutoResponse).toBe(true);
  });
});

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
