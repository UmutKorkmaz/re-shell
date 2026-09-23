import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  FeatureFlagManager,
  createExampleFeatureFlagConfig,
  generateMarkdown,
  generateTerraform,
  generateTypeScript,
  generatePython,
  writeFeatureFlagFiles,
  displayFeatureFlagConfig,
} from '../../src/utils/feature-flag';

describe('FeatureFlagManager', () => {
  it('creates and retrieves a flag', () => {
    const mgr = new FeatureFlagManager(createExampleFeatureFlagConfig());
    const flag = mgr.createFlag({
      key: 'new-ui',
      name: 'New UI',
      description: 'Toggle new dashboard',
      type: 'boolean' as any,
      status: 'active' as any,
      defaultValue: false,
      currentValue: false,
      tags: ['ui'],
      owner: 'team-a',
      conditions: [],
      rolloutStrategy: 'percentage' as any,
      rolloutPercentage: 0,
      whitelist: [],
      segments: [],
      dependencies: [],
    });

    expect(flag.id).toBeDefined();
    expect(mgr.getFlag('new-ui')).toBeDefined();
    expect(mgr.getFlag('new-ui')!.name).toBe('New UI');
  });

  it('returns summary with organization info', () => {
    const config = createExampleFeatureFlagConfig();
    const mgr = new FeatureFlagManager(config);
    const summary = mgr.getSummary();
    expect(summary.organization).toBe('Acme Corp');
  });

  it('evaluates a boolean flag', () => {
    const mgr = new FeatureFlagManager(createExampleFeatureFlagConfig());
    mgr.createFlag({
      key: 'test-flag',
      name: 'Test',
      description: 'Test flag',
      type: 'boolean' as any,
      status: 'active' as any,
      defaultValue: false,
      currentValue: true,
      tags: [],
      owner: 'team',
      conditions: [],
      rolloutStrategy: 'percentage' as any,
      rolloutPercentage: 100,
      whitelist: [],
      segments: [],
      dependencies: [],
    });

    const result = mgr.evaluateFlag('test-flag', {});
    expect(result).toBeDefined();
  });
});

describe('createExampleFeatureFlagConfig', () => {
  it('returns a config with expected defaults', () => {
    const config = createExampleFeatureFlagConfig();
    expect(config.organization).toBe('Acme Corp');
    expect(config.enablePersistence).toBe(true);
    expect(config.storageBackend).toBe('memory');
  });
});

describe('displayFeatureFlagConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = createExampleFeatureFlagConfig();
    displayFeatureFlagConfig(config, 'typescript', '/tmp/out');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateMarkdown', () => {
  it('generates markdown with organization info', () => {
    const config = createExampleFeatureFlagConfig();
    const mgr = new FeatureFlagManager(config);
    const md = generateMarkdown('MyApp', mgr);
    expect(md).toContain('Feature Flag Management System');
    expect(md).toContain('MyApp');
  });
});

describe('generateTerraform', () => {
  it('generates AWS terraform', () => {
    const config = createExampleFeatureFlagConfig();
    const tf = generateTerraform('aws', 'MyApp', config);
    expect(tf).toContain('Feature Flag');
    expect(tf).toContain('aws');
    expect(tf.length).toBeGreaterThan(50);
  });

  it('generates Azure terraform', () => {
    const config = createExampleFeatureFlagConfig();
    const tf = generateTerraform('azure', 'MyApp', config);
    expect(tf).toContain('azure');
  });

  it('generates GCP terraform', () => {
    const config = createExampleFeatureFlagConfig();
    const tf = generateTerraform('gcp', 'MyApp', config);
    expect(tf).toContain('google');
  });
});

describe('generateTypeScript', () => {
  it('generates TS code', () => {
    const config = createExampleFeatureFlagConfig();
    const ts = generateTypeScript('MyApp', config);
    expect(ts).toContain('Feature Flag Manager');
    expect(ts).toContain('TypeScript');
  });
});

describe('generatePython', () => {
  it('generates Python code', () => {
    const config = createExampleFeatureFlagConfig();
    const py = generatePython('MyApp', config);
    expect(py).toContain('Feature Flag Manager');
    expect(py).toContain('Python');
  });
});

describe('writeFeatureFlagFiles', () => {
  it('writes all artifacts to disk (TypeScript)', async () => {
    const config = createExampleFeatureFlagConfig();
    const tmpDir = path.join(os.tmpdir(), `ff-test-${Date.now()}`);
    await writeFeatureFlagFiles(config, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'terraform', 'aws', 'main.tf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'feature-flag-manager.ts'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes all artifacts to disk (Python)', async () => {
    const config = createExampleFeatureFlagConfig();
    const tmpDir = path.join(os.tmpdir(), `ff-test-py-${Date.now()}`);
    await writeFeatureFlagFiles(config, tmpDir, 'python');

    expect(fs.existsSync(path.join(tmpDir, 'feature_flag_manager.py'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
