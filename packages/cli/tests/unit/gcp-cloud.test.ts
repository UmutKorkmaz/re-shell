import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateGCPCloudMD,
  generateJinjaTemplate,
  generateTypeScriptGCPCloud,
  generatePythonGCPCloud,
  writeFiles,
} from '../../src/utils/gcp-cloud';

function makeConfig(): any {
  return {
    projectName: 'test-project',
    projectId: 'test-project-123',
    gkeConfig: {
      clusterName: 'test-cluster',
      region: 'us-central1',
      zone: 'us-central1-a',
      kubernetesVersion: '1.28',
      nodeCount: 3,
      machineType: 'e2-medium',
      enableAutoScaling: true,
      minNodes: 1,
      maxNodes: 10,
      enablePrivateCluster: false,
      enableAutopilot: false,
      networkingMode: 'VPC_NATIVE',
    },
    cloudBuildConfig: {
      triggerName: 'build-trigger',
      branch: 'main',
      buildTimeout: '1200s',
      enableDeploy: true,
      substitutions: { _PROJECT_ID: 'test-project-123' },
    },
    mlConfig: {
      enableVertexAI: false,
      enableAIPlatform: false,
      enableTPU: false,
      enableMLOps: false,
    },
    enableGCR: true,
    enableArtifactRegistry: true,
  };
}

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(makeConfig());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateGCPCloudMD', () => {
  it('generates markdown with project info', () => {
    const md = generateGCPCloudMD(makeConfig());
    expect(md).toBeDefined();
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('generateJinjaTemplate', () => {
  it('generates Jinja template string', () => {
    const jinja = generateJinjaTemplate(makeConfig());
    expect(jinja).toBeDefined();
    expect(jinja.length).toBeGreaterThan(0);
  });
});

describe('generateTypeScriptGCPCloud', () => {
  it('generates TypeScript code', () => {
    const ts = generateTypeScriptGCPCloud(makeConfig());
    expect(ts).toBeDefined();
    expect(ts.length).toBeGreaterThan(0);
  });
});

describe('generatePythonGCPCloud', () => {
  it('generates Python code', () => {
    const py = generatePythonGCPCloud(makeConfig());
    expect(py).toBeDefined();
    expect(py.length).toBeGreaterThan(0);
  });
});

describe('writeFiles', () => {
  it('writes all artifacts to disk (TypeScript)', async () => {
    const config = makeConfig();
    const tmpDir = path.join(os.tmpdir(), `gcp-test-${Date.now()}`);
    await writeFiles(config, tmpDir, 'typescript');
    expect(fs.existsSync(tmpDir)).toBe(true);
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes all artifacts to disk (Python)', async () => {
    const config = makeConfig();
    const tmpDir = path.join(os.tmpdir(), `gcp-test-py-${Date.now()}`);
    await writeFiles(config, tmpDir, 'python');
    expect(fs.existsSync(tmpDir)).toBe(true);
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
