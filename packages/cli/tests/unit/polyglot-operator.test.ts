import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import {
  displayConfig,
  generatePolyglotOperatorMD,
  generateTypeScriptPolyglotOperator,
  generatePythonPolyglotOperator,
  writeFiles,
} from '../../src/utils/polyglot-operator';

const config: any = {
  projectName: 'polyglot-app',
  namespace: 'polyglot',
  languages: [
    { name: 'nodejs', runtime: 'node', version: '18', buildTool: 'npm', port: 3000, healthCheck: { path: '/health', interval: 30 } },
    { name: 'python', runtime: 'python', version: '3.11', buildTool: 'pip' },
  ],
  enableLifecycleHooks: true,
  lifecycleHooks: [
    { name: 'migrate', type: 'pre-install', command: 'npm', args: ['run', 'migrate'] },
  ],
  enableRollback: true,
  enableScaling: true,
  enableMonitoring: false,
};

describe('displayConfig', () => {
  it('logs summary with project, languages, and toggles', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('polyglot-app');
    expect(out).toContain('polyglot');
    expect(out).toContain('nodejs');
    expect(out).toContain('python');
    expect(out).toContain('Enabled'); // hooks/rollback/scaling
    expect(out).toContain('Disabled'); // monitoring
    spy.mockRestore();
  });
});

describe('generatePolyglotOperatorMD', () => {
  it('returns markdown with feature list and usage examples', () => {
    const md = generatePolyglotOperatorMD(config);
    expect(md).toContain('# Polyglot Kubernetes Operator');
    expect(md).toContain('Multi-language');
    expect(md).toContain('Automated lifecycle hooks');
    expect(md).toContain('Rollback automation');
    expect(md).toContain('await operator.deploy()');
    expect(md).toContain('scaleApplication');
  });
});

describe('generateTypeScriptPolyglotOperator', () => {
  it('generates a PolyglotOperator TS class with project name and languages', () => {
    const code = generateTypeScriptPolyglotOperator(config);
    expect(code).toContain('polyglot-app');
    expect(code).toMatch(/class\s+\w+Operator/);
    expect(code).toContain('node');
    expect(code).toContain('export default');
  });
});

describe('generatePythonPolyglotOperator', () => {
  it('generates a Python class with project name', () => {
    const code = generatePythonPolyglotOperator(config);
    expect(code).toContain('polyglot-app');
    expect(code).toMatch(/class\s+\w+Operator/);
  });
});

describe('writeFiles', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'po-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('writes all expected files into the output directory', async () => {
    await writeFiles(config, tmpDir);

    const expected = [
      'polyglot-operator.ts',
      'polyglot-operator.py',
      'POLYGLOT_OPERATOR.md',
      'package.json',
      'requirements.txt',
      'polyglot-operator-config.json',
    ];
    for (const f of expected) {
      expect(fs.existsSync(path.join(tmpDir, f))).toBe(true);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('polyglot-app');
    expect(pkg.dependencies).toHaveProperty('js-yaml');
    expect(pkg.dependencies).toHaveProperty('@kubernetes/client-node');

    const reqs = fs.readFileSync(path.join(tmpDir, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('pyyaml');
    expect(reqs).toContain('kubernetes');

    const stored = JSON.parse(fs.readFileSync(path.join(tmpDir, 'polyglot-operator-config.json'), 'utf8'));
    expect(stored.projectName).toBe('polyglot-app');
    expect(stored.namespace).toBe('polyglot');
  });
});
