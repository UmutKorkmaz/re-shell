import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateApmIntegrationMD,
  generateTerraformApmIntegration,
  generateTypeScriptApmIntegration,
  generatePythonApmIntegration,
  writeFiles,
  apmIntegration,
} from '../../src/utils/apm-integration';

const config = {
  projectName: 'apm-app',
  providers: ['aws' as const],
  apm: {
    enabled: true,
    backend: 'datadog' as const,
    apiKey: 'secret-key',
    environment: 'production',
    serviceUrl: 'https://api.datadoghq.com',
    profilingMode: 'continuous' as const,
    sampleRate: 0.5,
  },
  metrics: [
    { name: 'request_count', type: 'counter' as const, enabled: true, aggregation: 'sum' as const },
  ],
  alerts: [
    { name: 'high_latency', condition: 'p99 > 500ms', threshold: 500, duration: 300, severity: 'critical' as const },
  ],
  aiInsights: [
    { type: 'performance' as const, enabled: true, confidence: 0.9, recommendations: ['optimize query'], relatedMetrics: ['latency'] },
  ],
  enableDistributedTracing: true,
  enableErrorTracking: true,
  enableSecurityMonitoring: false,
  enableProfiling: true,
};

describe('apmIntegration', () => {
  it('returns the config as-is', () => {
    expect(apmIntegration(config)).toBe(config);
  });
});

describe('generateApmIntegrationMD', () => {
  it('generates markdown with title', () => {
    const md = generateApmIntegrationMD(config);
    expect(md).toContain('# Application Performance Monitoring (APM)');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateApmIntegrationMD(config);
    expect(md).toContain('Datadog');
    expect(md).toContain('Distributed tracing');
    expect(md).toContain('Code profiling');
  });
});

describe('generateTerraformApmIntegration', () => {
  it('includes project name', () => {
    expect(generateTerraformApmIntegration(config)).toContain('apm-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformApmIntegration(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptApmIntegration', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptApmIntegration(config);
    expect(ts).toContain('ApmIntegrationManager');
    expect(ts).toContain('apm-app');
  });
});

describe('generatePythonApmIntegration', () => {
  it('generates Python manager class', () => {
    const py = generatePythonApmIntegration(config);
    expect(py).toContain('class ApmIntegrationManager');
    expect(py).toContain('apm-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apm-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'apm-integration.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'apm-integration-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'APM_INTEGRATION.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'apm-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'apm_integration_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('apm-app-apm-integration');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'apm-config.json'));
    expect(json.projectName).toBe('apm-app');
    expect(json.apm.backend).toBe('datadog');
    expect(json.enableDistributedTracing).toBe(true);
    expect(json.aiInsights).toHaveLength(1);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('datadog');
    expect(req).toContain('newrelic');
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
