import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateDistributedTracingMD,
  generateTerraformTracing,
  generateTypeScriptTracing,
  generatePythonTracing,
  writeFiles,
  distributedTracing,
} from '../../src/utils/distributed-tracing';

const config = {
  projectName: 'trace-app',
  providers: ['aws' as const],
  trace: {
    enabled: true,
    backend: 'jaeger' as const,
    samplingRate: 0.1,
    maxPathLength: 10,
    debugEnabled: false,
  },
  services: [
    { name: 'api', protocol: 'http' as const, endpoint: '/api', port: 3000, traced: true },
  ],
  spans: [
    { serviceName: 'api', operationName: 'GET /users', tags: {}, logs: [] },
  ],
  insights: [
    { operationName: 'GET /users', avgDuration: 50, p95Duration: 120, p99Duration: 200, errorRate: 0.01, throughput: 1000 },
  ],
  enableProfiling: true,
  enableLogging: false,
  enableMetrics: true,
};

describe('distributedTracing', () => {
  it('returns the config as-is', () => {
    expect(distributedTracing(config)).toBe(config);
  });
});

describe('generateDistributedTracingMD', () => {
  it('generates markdown with title', () => {
    const md = generateDistributedTracingMD(config);
    expect(md).toContain('# Distributed Tracing');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateDistributedTracingMD(config);
    expect(md).toContain('Jaeger');
    expect(md).toContain('trace');
  });
});

describe('generateTerraformTracing', () => {
  it('includes project name', () => {
    expect(generateTerraformTracing(config)).toContain('trace-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformTracing(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptTracing', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptTracing(config);
    expect(ts).toContain('DistributedTracingManager');
    expect(ts).toContain('trace-app');
  });
});

describe('generatePythonTracing', () => {
  it('generates Python manager class', () => {
    const py = generatePythonTracing(config);
    expect(py).toContain('class DistributedTracingManager');
    expect(py).toContain('trace-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trace-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'distributed-tracing.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'distributed-tracing-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'DISTRIBUTED_TRACING.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'tracing-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'distributed_tracing_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('trace-app-distributed-tracing');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'tracing-config.json'));
    expect(json.projectName).toBe('trace-app');
    expect(json.trace.backend).toBe('jaeger');
    expect(json.enableProfiling).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('jaeger');
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
