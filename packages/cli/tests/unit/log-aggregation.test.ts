import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateLogAggregationMD,
  generateTerraformLogAggregation,
  generateTypeScriptLogAggregation,
  generatePythonLogAggregation,
  writeFiles,
  logAggregation,
} from '../../src/utils/log-aggregation';

const config = {
  projectName: 'log-app',
  providers: ['aws' as const],
  log: {
    enabled: true,
    backend: 'elk' as const,
    format: 'json' as const,
    level: 'info' as const,
    retentionDays: 30,
    maxFileSize: 100,
    bufferSize: 50,
    flushInterval: 5,
  },
  elasticsearch: {
    host: 'localhost',
    port: 9200,
    indexPrefix: 'logs',
    shards: 3,
    replicas: 1,
  },
  logstash: {
    host: 'localhost',
    port: 5044,
    pipelines: ['main'],
  },
  kibana: {
    enabled: true,
    host: 'localhost',
    port: 5601,
    dashboards: ['overview'],
  },
  fluentd: {
    host: 'localhost',
    port: 24224,
    parsers: ['json'],
    buffers: [{ path: '/var/log/buffer', size: '100m' }],
  },
  parsers: [
    { name: 'json', pattern: '%{DATA}', fields: {}, timestampField: '@timestamp', timestampFormat: 'ISO8601' },
  ],
  filters: [
    { name: 'drop-debug', condition: 'level == debug', actions: [] },
  ],
  enableAlerting: true,
  enableMetrics: false,
};

describe('logAggregation', () => {
  it('returns the config as-is', () => {
    expect(logAggregation(config)).toBe(config);
  });
});

describe('generateLogAggregationMD', () => {
  it('generates markdown with title', () => {
    const md = generateLogAggregationMD(config);
    expect(md).toContain('# Log Aggregation');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateLogAggregationMD(config);
    expect(md).toContain('ELK');
    expect(md).toContain('Structured');
  });
});

describe('generateTerraformLogAggregation', () => {
  it('includes project name', () => {
    expect(generateTerraformLogAggregation(config)).toContain('log-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformLogAggregation(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptLogAggregation', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptLogAggregation(config);
    expect(ts).toContain('LogAggregationManager');
    expect(ts).toContain('log-app');
  });
});

describe('generatePythonLogAggregation', () => {
  it('generates Python manager class', () => {
    const py = generatePythonLogAggregation(config);
    expect(py).toContain('class LogAggregationManager');
    expect(py).toContain('log-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'logagg-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'log-aggregation.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'log-aggregation-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'LOG_AGGREGATION.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'log-aggregation-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'log_aggregation_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('log-app-log-aggregation');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'log-aggregation-config.json'));
    expect(json.projectName).toBe('log-app');
    expect(json.log.backend).toBe('elk');
    expect(json.enableAlerting).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('elasticsearch');
    expect(req).toContain('logstash');
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
