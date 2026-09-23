import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateServiceMeshMD,
  generateTypeScriptServiceMesh,
  generatePythonServiceMesh,
  writeFiles,
} from '../../src/utils/service-mesh-integration';

const config = {
  projectName: 'mesh-app',
  mesh: 'istio' as const,
  services: [
    { name: 'api', port: 8080, namespace: 'default' },
    { name: 'web', port: 3000, namespace: 'default' },
  ],
  enableMTLS: true,
  enableTrafficManagement: true,
};

describe('generateServiceMeshMD', () => {
  it('includes title and features section', () => {
    const md = generateServiceMeshMD(config);
    expect(md).toContain('# Service Mesh Integration');
    expect(md).toContain('## Features');
  });

  it('includes mTLS feature description', () => {
    expect(generateServiceMeshMD(config)).toContain('mTLS');
  });
});

describe('generateTypeScriptServiceMesh', () => {
  it('generates TypeScript class embedding project name', () => {
    const ts = generateTypeScriptServiceMesh(config);
    expect(ts).toContain('ServiceMeshIntegration');
    expect(ts).toContain('mesh-app');
  });

  it('references istio mesh when configured', () => {
    expect(generateTypeScriptServiceMesh(config)).toContain('istio');
  });
});

describe('generatePythonServiceMesh', () => {
  it('generates a Python class embedding project name', () => {
    const py = generatePythonServiceMesh(config);
    expect(py.toLowerCase()).toContain('class');
    expect(py).toContain('mesh-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mesh-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes all expected files', async () => {
    await writeFiles(config, tmpDir);
    for (const file of [
      'service-mesh-integration.ts',
      'service-mesh-integration.py',
      'SERVICE_MESH.md',
      'package.json',
      'requirements.txt',
      'service-mesh-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('package.json reflects project name', async () => {
    await writeFiles(config, tmpDir);
    const pkg = JSON.parse(await fs.readFile(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('mesh-app');
  });

  it('config.json mirrors the input config', async () => {
    await writeFiles(config, tmpDir);
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'service-mesh-config.json'), 'utf-8'));
    expect(json.projectName).toBe('mesh-app');
    expect(json.mesh).toBe('istio');
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
