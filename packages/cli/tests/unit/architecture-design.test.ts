import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateArchitectureDesignMD,
  generateTerraformArchitectureDesign,
  generateTypeScriptArchitectureDesign,
  generatePythonArchitectureDesign,
  writeFiles,
  architectureDesign,
} from '../../src/utils/architecture-design';

const config = {
  projectName: 'arch-app',
  providers: ['aws' as const],
  diagram: {
    type: 'component' as const,
    format: 'mermaid' as const,
    autoLayout: true,
    theme: 'dark',
  },
  elements: [
    {
      id: 'el1',
      type: 'service' as const,
      name: 'API Gateway',
      description: 'Entry point',
      properties: { port: 3000 },
    },
  ],
  collaboration: {
    enableComments: true,
    enableVersioning: true,
    enableReview: false,
    maxCollaborators: 10,
  },
  versionControl: 'github' as const,
  enableAutoSave: true,
  enableTemplates: false,
};

describe('architectureDesign', () => {
  it('returns the config as-is', () => {
    const result = architectureDesign(config);
    expect(result).toBe(config);
  });
});

describe('generateArchitectureDesignMD', () => {
  it('generates markdown with title', () => {
    const md = generateArchitectureDesignMD(config);
    expect(md).toContain('# Collaborative Architecture Design and Planning');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateArchitectureDesignMD(config);
    expect(md).toContain('Multiple diagram types');
    expect(md).toContain('Export formats');
    expect(md).toContain('Collaborative editing');
    expect(md).toContain('Multi-cloud');
  });
});

describe('generateTerraformArchitectureDesign', () => {
  it('includes project name', () => {
    const tf = generateTerraformArchitectureDesign(config);
    expect(tf).toContain('arch-app');
    expect(tf).toContain('Terraform');
  });

  it('includes ISO timestamp', () => {
    const tf = generateTerraformArchitectureDesign(config);
    expect(tf).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('generateTypeScriptArchitectureDesign', () => {
  it('generates TypeScript manager class', () => {
    const ts = generateTypeScriptArchitectureDesign(config);
    expect(ts).toContain('ArchitectureDesignManager');
    expect(ts).toContain('extends EventEmitter');
    expect(ts).toContain('export default');
    expect(ts).toContain('arch-app');
  });
});

describe('generatePythonArchitectureDesign', () => {
  it('generates Python manager class', () => {
    const py = generatePythonArchitectureDesign(config);
    expect(py).toContain('class ArchitectureDesignManager');
    expect(py).toContain('arch-app');
    expect(py).toContain('import asyncio');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arch-design-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'architecture-design.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'architecture-design-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'ARCHITECTURE_DESIGN.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'architecture-design-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'architecture-design.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'architecture_design_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'ARCHITECTURE_DESIGN.md'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('arch-app-architecture-design');
    expect(pkg.dependencies).toHaveProperty('@types/node');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'architecture-design-config.json'));
    expect(json.projectName).toBe('arch-app');
    expect(json.diagram.type).toBe('component');
    expect(json.elements).toHaveLength(1);
    expect(json.versionControl).toBe('github');
    expect(json.enableAutoSave).toBe(true);
  });

  it('requirements.txt contains expected deps for Python', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('graphviz');
    expect(req).toContain('plantuml');
  });
});

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
