import { describe, it, expect } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  displayConfig,
  generateSkillsAssessmentMD,
  generateTerraformSkillsAssessment,
  generateTypeScriptSkillsAssessment,
  generatePythonSkillsAssessment,
  writeFiles,
  skillsAssessment,
} from '../../src/utils/skills-assessment';

const BASE_CONFIG = {
  projectName: 'test-project',
  providers: ['aws', 'azure'] as const,
  learningPaths: [],
  enableAutoAssessment: true,
  enableProgressTracking: false,
  enableRecommendations: true,
};

describe('skillsAssessment (passthrough)', () => {
  it('returns the same config instance', () => {
    const cfg = { ...BASE_CONFIG };
    expect(skillsAssessment(cfg)).toBe(cfg);
  });
});

describe('displayConfig', () => {
  it('logs project name, providers, and toggle flags', () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    try {
      displayConfig(BASE_CONFIG);
    } finally {
      console.log = orig;
    }
    const joined = logs.join('\n');
    expect(joined).toContain('test-project');
    expect(joined).toContain('aws, azure');
    expect(joined).toContain('Skills Assessment');
    // Toggle values
    expect(joined).toContain('Yes'); // Auto Assessment is true
    expect(joined).toContain('No'); // Progress Tracking is false
  });
});

describe('generateSkillsAssessmentMD', () => {
  it('emits the title and a features list', () => {
    const md = generateSkillsAssessmentMD(BASE_CONFIG);
    expect(md).toContain('# Skills Assessment and Learning Path Recommendations');
    expect(md).toContain('## Features');
    expect(md).toContain('beginner, intermediate, advanced, expert');
    expect(md).toContain('Multi-cloud provider support');
  });
});

describe('generateTerraformSkillsAssessment', () => {
  it('embeds the project name and an ISO timestamp', () => {
    const code = generateTerraformSkillsAssessment(BASE_CONFIG);
    expect(code).toContain('Auto-generated Skills Assessment Terraform for test-project');
    expect(code).toMatch(/Generated at: \d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptSkillsAssessment', () => {
  it('emits EventEmitter class with default export', () => {
    const code = generateTypeScriptSkillsAssessment(BASE_CONFIG);
    expect(code).toContain('Skills Assessment Manager for test-project');
    expect(code).toContain("import { EventEmitter } from 'events';");
    expect(code).toContain('class SkillsAssessmentManager extends EventEmitter');
    expect(code).toContain('export default skillsAssessmentManager;');
  });
});

describe('generatePythonSkillsAssessment', () => {
  it('embeds the project name in __init__ and uses Python booleans', () => {
    const code = generatePythonSkillsAssessment(BASE_CONFIG);
    expect(code).toContain('Skills Assessment Manager for test-project');
    expect(code).toContain('import asyncio');
    expect(code).toContain('class SkillsAssessmentManager:');
    expect(code).toContain('def __init__(self, project_name: str = "test-project"):');
    expect(code).toContain('skills_assessment_manager = SkillsAssessmentManager()');
  });
});

describe('writeFiles', () => {
  function tmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), `rs-skills-${Date.now()}-`));
  }

  it('writes TS bundle: .tf, manager.ts, package.json, .md, config.json', async () => {
    const dir = tmpDir();
    try {
      await writeFiles(BASE_CONFIG, dir, 'typescript');
      expect(fs.existsSync(path.join(dir, 'skills-assessment.tf'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'skills-assessment-manager.ts'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'SKILLS_ASSESSMENT.md'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'skills-assessment-config.json'))).toBe(true);

      const pkgJson = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      expect(pkgJson.name).toBe('test-project-skills-assessment');
      expect(pkgJson.main).toBe('skills-assessment-manager.ts');
    } finally {
      fs.removeSync(dir);
    }
  });

  it('writes Python bundle: .tf, manager.py, requirements.txt, .md, config.json', async () => {
    const dir = tmpDir();
    try {
      await writeFiles(BASE_CONFIG, dir, 'python');
      expect(fs.existsSync(path.join(dir, 'skills-assessment.tf'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'skills_assessment_manager.py'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'requirements.txt'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'SKILLS_ASSESSMENT.md'))).toBe(true);

      const reqs = fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf8');
      expect(reqs).toContain('asyncio');
      expect(reqs).toContain('pandas');
    } finally {
      fs.removeSync(dir);
    }
  });

  it('creates the output directory if it does not exist', async () => {
    const base = tmpDir();
    const dir = path.join(base, 'nested', 'deeper');
    try {
      await writeFiles(BASE_CONFIG, dir, 'typescript');
      expect(fs.existsSync(dir)).toBe(true);
    } finally {
      fs.removeSync(base);
    }
  });

  it('serializes the full config to skills-assessment-config.json', async () => {
    const dir = tmpDir();
    try {
      await writeFiles(BASE_CONFIG, dir, 'typescript');
      const cfg = JSON.parse(
        fs.readFileSync(path.join(dir, 'skills-assessment-config.json'), 'utf8'),
      );
      expect(cfg.projectName).toBe('test-project');
      expect(cfg.providers).toEqual(['aws', 'azure']);
      expect(cfg.enableAutoAssessment).toBe(true);
      expect(cfg.enableProgressTracking).toBe(false);
      expect(cfg.enableRecommendations).toBe(true);
    } finally {
      fs.removeSync(dir);
    }
  });
});
