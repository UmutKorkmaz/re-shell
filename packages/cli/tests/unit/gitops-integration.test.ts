import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateGitOpsMD,
  generateTypeScriptGitOps,
  generatePythonGitOps,
  writeFiles,
} from '../../src/utils/gitops-integration';

const config: any = {
  projectName: 'test-gitops',
  platform: 'argocd',
  gitRepo: 'https://github.com/org/repo',
  targetRevision: 'main',
  namespaces: ['default', 'production'],
  syncPolicy: 'automated',
};

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateGitOpsMD', () => {
  it('generates markdown', () => {
    const md = generateGitOpsMD(config);
    expect(md).toBeDefined();
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('generateTypeScriptGitOps', () => {
  it('generates TypeScript code', () => {
    const ts = generateTypeScriptGitOps(config);
    expect(ts).toBeDefined();
    expect(ts.length).toBeGreaterThan(0);
  });
});

describe('generatePythonGitOps', () => {
  it('generates Python code', () => {
    const py = generatePythonGitOps(config);
    expect(py).toBeDefined();
    expect(py.length).toBeGreaterThan(0);
  });
});

describe('writeFiles', () => {
  it('writes artifacts to disk (TypeScript)', async () => {
    const tmpDir = path.join(os.tmpdir(), `gitops-test-${Date.now()}`);
    await writeFiles(config, tmpDir, 'typescript');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes artifacts to disk (Python)', async () => {
    const tmpDir = path.join(os.tmpdir(), `gitops-test-py-${Date.now()}`);
    await writeFiles(config, tmpDir, 'python');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
