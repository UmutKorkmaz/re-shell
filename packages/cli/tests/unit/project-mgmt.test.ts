import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateProjectMgmtMarkdown,
  generateProjectMgmtTerraform,
  generateTypeScriptManager,
  generatePythonManager,
  writeProjectMgmtFiles,
  displayProjectMgmtConfig,
  createExampleProjectMgmtConfig,
} from '../../src/utils/project-mgmt';

describe('createExampleProjectMgmtConfig', () => {
  it('returns a fully populated example config', () => {
    const cfg = createExampleProjectMgmtConfig();
    expect(cfg.projectName).toBe('my-project-mgmt');
    expect(cfg.organization).toBe('Acme Corp');
    expect(cfg.providers).toContain('aws');
    expect(cfg.projects.length).toBeGreaterThan(0);
    expect(cfg.settings.enableSprints).toBe(true);
  });
});

describe('generateProjectMgmtMarkdown', () => {
  it('renders markdown with project metadata and project table', () => {
    const cfg = createExampleProjectMgmtConfig();
    const md = generateProjectMgmtMarkdown(cfg);
    expect(md).toContain('# Project Management and Tracking System');
    expect(md).toContain('my-project-mgmt');
    expect(md).toContain('Acme Corp');
    expect(md).toContain('Sprint planning');
    expect(md).toContain('| Project | Status |');
    expect(md).toContain('ProjectManagementManager');
  });
});

describe('generateProjectMgmtTerraform', () => {
  it('generates Terraform for each provider', () => {
    const cfg = createExampleProjectMgmtConfig();
    const aws = generateProjectMgmtTerraform(cfg, 'aws');
    expect(aws).toContain('AWS');
    expect(aws).toContain('Terraform');
    const azure = generateProjectMgmtTerraform(cfg, 'azure');
    expect(azure).toContain('Azure');
    const gcp = generateProjectMgmtTerraform(cfg, 'gcp');
    expect(gcp).toContain('GCP');
  });
});

describe('generateTypeScriptManager', () => {
  it('generates a TypeScript manager class', () => {
    const cfg = createExampleProjectMgmtConfig();
    const code = generateTypeScriptManager(cfg);
    expect(code).toContain('Project Management Manager');
    expect(code).toContain('class ProjectManagementManager');
  });
});

describe('generatePythonManager', () => {
  it('generates a Python manager class', () => {
    const cfg = createExampleProjectMgmtConfig();
    const code = generatePythonManager(cfg);
    expect(code).toContain('Project Management Manager');
    expect(code).toContain('class ProjectManagementManager');
  });
});

describe('displayProjectMgmtConfig', () => {
  it('prints a summary of the configuration', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cfg = createExampleProjectMgmtConfig();
    displayProjectMgmtConfig(cfg, 'typescript', '/tmp/out');
    expect(spy).toHaveBeenCalled();
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('my-project-mgmt');
    expect(out).toContain('typescript');
    expect(out).toContain('/tmp/out');
    spy.mockRestore();
  });
});

describe('writeProjectMgmtFiles', () => {
  let tmpDir: string;
  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pm-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown, config JSON, per-provider Terraform, and TypeScript manager', async () => {
    const cfg = createExampleProjectMgmtConfig();
    await writeProjectMgmtFiles(cfg, tmpDir, 'typescript');

    expect(await fs.pathExists(path.join(tmpDir, 'PROJECT_MGMT_GUIDE.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'pm-config.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'pm-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);

    for (const provider of cfg.providers) {
      expect(await fs.pathExists(path.join(tmpDir, 'terraform', provider, 'main.tf'))).toBe(true);
    }

    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('my-project-mgmt-pm');
    expect(pkg.main).toBe('pm-manager.ts');

    const stored = await fs.readJson(path.join(tmpDir, 'pm-config.json'));
    expect(stored.projectName).toBe('my-project-mgmt');
  });

  it('writes Python manager + requirements when language is python', async () => {
    const cfg = createExampleProjectMgmtConfig();
    await writeProjectMgmtFiles(cfg, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'pm_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    const reqs = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('boto3');
    expect(reqs).toContain('azure-identity');
  });
});
