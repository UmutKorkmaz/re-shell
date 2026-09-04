import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  CollaborationManager,
  createExampleCollaborationConfig,
  generateMarkdown,
  generateTerraform,
  generateTypeScript,
  generatePython,
  writeCollaborationFiles,
  displayCollaborationConfig,
} from '../../src/utils/collaboration';

const config = createExampleCollaborationConfig();

describe('createExampleCollaborationConfig', () => {
  it('returns a config with organization and features enabled', () => {
    expect(config.organization).toBe('Acme Corp');
    expect(config.enableMessaging).toBe(true);
    expect(config.enableCodeReview).toBe(true);
  });
});

describe('CollaborationManager', () => {
  it('can be instantiated with a config', () => {
    const manager = new CollaborationManager(config);
    expect(manager).toBeDefined();
  });

  it('getSummary returns expected shape', () => {
    const manager = new CollaborationManager(config);
    const summary = manager.getSummary();
    expect(summary).toBeDefined();
    expect(summary.users).toBeDefined();
    expect(summary.teams).toBeDefined();
  });
});

describe('generateMarkdown', () => {
  it('produces markdown with organization name and headings', () => {
    const manager = new CollaborationManager(config);
    const md = generateMarkdown('Acme Corp', manager);
    expect(md).toContain('# Enterprise Collaboration and Team Management');
    expect(md).toContain('**Generated for:** Acme Corp');
    expect(md).toContain('## Platform Summary');
    expect(md).toContain('## Features');
  });
});

describe('generateTerraform', () => {
  it('generates Terraform with organization name', () => {
    const tf = generateTerraform('aws', 'Acme Corp', config);
    expect(tf).toContain('Acme Corp');
    expect(tf).toContain('Terraform for Collaboration Platform');
    expect(tf.length).toBeGreaterThan(100);
  });

  it('generates Terraform for azure provider', () => {
    const tf = generateTerraform('azure', 'Acme Corp', config);
    expect(tf).toContain('Acme Corp');
  });

  it('generates Terraform for gcp provider', () => {
    const tf = generateTerraform('gcp', 'Acme Corp', config);
    expect(tf).toContain('Acme Corp');
  });
});

describe('generateTypeScript', () => {
  it('generates TypeScript code with organization name', () => {
    const ts = generateTypeScript('Acme Corp', config);
    expect(ts).toContain('Acme Corp');
    expect(ts).toContain('class CollaborationManager');
  });
});

describe('generatePython', () => {
  it('generates Python code with organization name', () => {
    const py = generatePython('Acme Corp', config);
    expect(py).toContain('Acme Corp');
    expect(py).toContain('class CollaborationManager');
  });
});

describe('writeCollaborationFiles', () => {
  it('writes TypeScript files to output directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `collab-ts-${Date.now()}`);
    await writeCollaborationFiles(config, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'collaboration-manager.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'COLLABORATION_GUIDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'collaboration-config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'terraform', 'aws', 'main.tf'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes Python files to output directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `collab-py-${Date.now()}`);
    await writeCollaborationFiles(config, tmpDir, 'python');

    expect(fs.existsSync(path.join(tmpDir, 'collaboration_manager.py'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'COLLABORATION_GUIDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'terraform', 'aws', 'main.tf'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayCollaborationConfig', () => {
  it('logs config summary without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayCollaborationConfig(config, 'typescript', '/tmp/out')).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
