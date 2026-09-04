import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  createExampleGovernanceConfig,
  generateGovernanceMarkdown,
  generateGovernanceTerraform,
  generateTypeScriptManager,
  generatePythonManager,
  writeGovernanceFiles,
  displayGovernanceConfig,
} from '../../src/utils/governance-policy';

describe('createExampleGovernanceConfig', () => {
  it('returns a config with expected defaults', () => {
    const config = createExampleGovernanceConfig();
    expect(config.projectName).toBe('my-governance');
    expect(config.organization).toBe('Acme Corp');
    expect(config.providers).toContain('aws');
    expect(config.policies).toBeDefined();
    expect(config.settings).toBeDefined();
  });
});

describe('generateGovernanceMarkdown', () => {
  it('generates markdown with project info', () => {
    const config = createExampleGovernanceConfig();
    const md = generateGovernanceMarkdown(config);
    expect(md).toBeDefined();
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('generateGovernanceTerraform', () => {
  it('generates AWS terraform', () => {
    const config = createExampleGovernanceConfig();
    const tf = generateGovernanceTerraform(config, 'aws');
    expect(tf).toBeDefined();
    expect(tf.length).toBeGreaterThan(0);
  });

  it('generates Azure terraform', () => {
    const config = createExampleGovernanceConfig();
    const tf = generateGovernanceTerraform(config, 'azure');
    expect(tf).toBeDefined();
    expect(tf.length).toBeGreaterThan(0);
  });

  it('generates GCP terraform', () => {
    const config = createExampleGovernanceConfig();
    const tf = generateGovernanceTerraform(config, 'gcp');
    expect(tf).toBeDefined();
    expect(tf.length).toBeGreaterThan(0);
  });
});

describe('generateTypeScriptManager', () => {
  it('generates TypeScript manager code', () => {
    const config = createExampleGovernanceConfig();
    const ts = generateTypeScriptManager(config);
    expect(ts).toBeDefined();
    expect(ts.length).toBeGreaterThan(0);
  });
});

describe('generatePythonManager', () => {
  it('generates Python manager code', () => {
    const config = createExampleGovernanceConfig();
    const py = generatePythonManager(config);
    expect(py).toBeDefined();
    expect(py.length).toBeGreaterThan(0);
  });
});

describe('writeGovernanceFiles', () => {
  it('writes all artifacts to disk (TypeScript)', async () => {
    const config = createExampleGovernanceConfig();
    const tmpDir = path.join(os.tmpdir(), `gov-test-${Date.now()}`);
    await writeGovernanceFiles(config, tmpDir, 'typescript');
    expect(fs.existsSync(tmpDir)).toBe(true);
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes all artifacts to disk (Python)', async () => {
    const config = createExampleGovernanceConfig();
    const tmpDir = path.join(os.tmpdir(), `gov-test-py-${Date.now()}`);
    await writeGovernanceFiles(config, tmpDir, 'python');
    expect(fs.existsSync(tmpDir)).toBe(true);
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayGovernanceConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = createExampleGovernanceConfig();
    displayGovernanceConfig(config, 'typescript', '/tmp/out');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
