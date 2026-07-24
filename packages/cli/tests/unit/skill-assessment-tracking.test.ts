import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateSkillAssessmentMD,
  generateTerraformSkillAssessment,
  generateTypeScriptSkillAssessment,
  generatePythonSkillAssessment,
  writeFiles,
  skillAssessment,
} from '../../src/utils/skill-assessment-tracking';

/**
 * Unit tests for the auto-generated skill assessment & certification tracking utility.
 * Covers displayConfig, MD/Terraform/TS/Python codegen (including config interpolation
 * of passingScoreThreshold and enableCertificationTracking toggles), writeFiles for
 * both language bundles, and the skillAssessment pass-through accessor.
 */

const baseConfig: any = {
  projectName: 'skills-app',
  providers: ['aws', 'azure', 'gcp'],
  employees: [
    {
      employeeId: 'emp-1',
      employeeName: 'Alice',
      department: 'Engineering',
      role: 'Senior Engineer',
      skills: [
        { id: 'sk-1', name: 'TypeScript', category: 'Programming', level: 'expert', lastAssessed: new Date('2024-01-01'), proficiencyScore: 95, yearsExperience: 5, verified: true },
      ],
      certifications: [
        { id: 'cert-1', name: 'AWS SAA', issuer: 'Amazon', industryStandard: 'aws', level: 'advanced', status: 'valid', issueDate: new Date('2024-01-01'), skillsValidated: ['sk-1'], renewalRequired: false },
      ],
      assessments: [],
      skillGaps: [],
      overallSkillScore: 90,
      lastUpdated: new Date('2024-01-01'),
      nextReviewDate: new Date('2024-07-01'),
    },
    {
      employeeId: 'emp-2',
      employeeName: 'Bob',
      department: 'Engineering',
      role: 'Engineer',
      skills: [],
      certifications: [],
      assessments: [],
      skillGaps: [],
      overallSkillScore: 60,
      lastUpdated: new Date('2024-01-01'),
      nextReviewDate: new Date('2024-07-01'),
    },
  ],
  careerPaths: [
    { id: 'cp-1', title: 'Staff Engineer', description: 'd', requiredSkills: [], requiredCertifications: [], estimatedProgression: [] },
  ],
  industryStandards: ['aws', 'azure', 'scrum'],
  enableAutomatedAssessments: true,
  enableCertificationTracking: true,
  enableSkillGapAnalysis: false,
  assessmentFrequency: 6,
  certificationExpiryAlert: 60,
  passingScoreThreshold: 75,
};

describe('displayConfig', () => {
  it('logs project metadata, counts and toggle summary', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      displayConfig(baseConfig);
      const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(out).toContain('skills-app');
      expect(out).toContain('aws, azure, gcp');
      expect(out).toContain('Employees: 2');
      expect(out).toContain('Career Paths: 1');
      expect(out).toContain('Industry Standards: 3');
      expect(out).toContain('Assessment Frequency: 6 months');
      expect(out).toContain('Passing Score: 75%');
    } finally {
      spy.mockRestore();
    }
  });

  it('renders toggle flags as Yes/No', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      displayConfig(baseConfig);
      const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(out).toContain('Automated Assessments: Yes');
      expect(out).toContain('Certification Tracking: Yes');
      expect(out).toContain('Skill Gap Analysis: No');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('generateSkillAssessmentMD', () => {
  it('renders a fixed feature list, industry-standards reference and gap-analysis priorities', () => {
    const md = generateSkillAssessmentMD(baseConfig);
    expect(md).toContain('# Skill Assessment and Certification Tracking');
    expect(md).toContain('## Features');
    expect(md).toContain('Skill levels: beginner, intermediate, advanced, expert');
    expect(md).toContain('Assessment types: quiz, practical, peer-review, interview, project');
    expect(md).toContain('## Industry Standards');
    expect(md).toContain('### Cloud Platforms');
    expect(md).toContain('**AWS**');
    expect(md).toContain('**Azure**');
    expect(md).toContain('**GCP**');
    expect(md).toContain('### Project Management');
    expect(md).toContain('**PMI**');
    expect(md).toContain('### Technical Skills');
    expect(md).toContain('**Cisco**');
    expect(md).toContain('## Skill Gap Analysis');
    expect(md).toContain('**Critical**');
    expect(md).toContain('**Low**');
  });
});

describe('generateTerraformSkillAssessment', () => {
  it('emits a header comment with the project name and a generation timestamp', () => {
    const tf = generateTerraformSkillAssessment(baseConfig);
    expect(tf).toContain('# Auto-generated Skill Assessment Terraform for skills-app');
    expect(tf).toContain('# Generated at:');
    // The Terraform output is intentionally a header-only stub.
    expect(tf.trim().split('\n').length).toBeLessThanOrEqual(3);
  });
});

describe('generateTypeScriptSkillAssessment', () => {
  it('generates a SkillAssessmentManager class with interfaces, methods and default export', () => {
    const code = generateTypeScriptSkillAssessment(baseConfig);
    expect(code).toContain('// Auto-generated Skill Assessment Manager for skills-app');
    expect(code).toContain('// Generated at:');
    expect(code).toContain("import { EventEmitter } from 'events'");
    expect(code).toContain('interface Skill {');
    expect(code).toContain('interface Certification {');
    expect(code).toContain('class SkillAssessmentManager extends EventEmitter');
    expect(code).toContain('assessSkill(');
    expect(code).toContain('analyzeSkillGaps(');
    expect(code).toContain('checkCertificationExpiry()');
    expect(code).toContain('generateReport()');
    expect(code).toContain('calculateAverageSkillScore()');
    expect(code).toContain('export default skillAssessmentManager');
  });

  it('interpolates passingScoreThreshold and enableCertificationTracking into the constructor call', () => {
    const code = generateTypeScriptSkillAssessment(baseConfig);
    // JS boolean rendered as literal `true`.
    expect(code).toContain('passingScoreThreshold: 75,');
    expect(code).toContain('enableCertificationTracking: true,');
  });

  it('renders a false JS boolean when certification tracking is disabled', () => {
    const code = generateTypeScriptSkillAssessment({
      ...baseConfig,
      enableCertificationTracking: false,
    });
    expect(code).toContain('enableCertificationTracking: false,');
  });
});

describe('generatePythonSkillAssessment', () => {
  it('generates a SkillAssessmentManager with enums, dataclass, typing and methods', () => {
    const code = generatePythonSkillAssessment(baseConfig);
    expect(code).toContain('# Auto-generated Skill Assessment Manager for skills-app');
    expect(code).toContain('# Generated at:');
    expect(code).toContain('from typing import Dict, List, Any, Optional');
    expect(code).toContain('from dataclasses import dataclass');
    expect(code).toContain('from datetime import datetime, timedelta');
    expect(code).toContain('from enum import Enum');
    expect(code).toContain('class SkillLevel(Enum):');
    expect(code).toContain('BEGINNER = "beginner"');
    expect(code).toContain('EXPERT = "expert"');
    expect(code).toContain('@dataclass');
    expect(code).toContain('class SkillAssessmentManager:');
    expect(code).toContain('def add_employee(self, employee');
    expect(code).toContain('def assess_skill(self, employee_id');
    expect(code).toContain('def analyze_skill_gaps(self, employee_id');
    expect(code).toContain('def check_certification_expiry(self)');
    expect(code).toContain('def generate_report(self)');
    expect(code).toContain('skill_assessment_manager = SkillAssessmentManager()');
  });

  it('interpolates project name, passing score and a Python True boolean', () => {
    const code = generatePythonSkillAssessment(baseConfig);
    expect(code).toContain("def __init__(self, project_name: str = 'skills-app'):");
    expect(code).toContain('self.passing_score_threshold = 75');
    expect(code).toContain('self.enable_certification_tracking = True');
  });

  it('renders a Python False boolean when certification tracking is disabled', () => {
    const code = generatePythonSkillAssessment({ ...baseConfig, enableCertificationTracking: false });
    expect(code).toContain('self.enable_certification_tracking = False');
  });
});

describe('skillAssessment', () => {
  it('returns the provided config unchanged (pass-through)', () => {
    expect(skillAssessment(baseConfig)).toBe(baseConfig);
  });
});

describe('writeFiles', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sat-'));
  });
  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes the TypeScript bundle (tf, manager, package.json, MD, config.json)', async () => {
    await writeFiles(baseConfig, tmpDir, 'typescript');
    for (const f of [
      'skill-assessment.tf',
      'skill-assessment-manager.ts',
      'package.json',
      'SKILL_ASSESSMENT.md',
      'skill-assessment-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, f))).toBe(true);
    }
    expect(await fs.pathExists(path.join(tmpDir, 'skill_assessment_manager.py'))).toBe(false);

    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('skills-app-skill-assessment');
    expect(pkg.main).toBe('skill-assessment-manager.ts');
    expect(pkg.devDependencies).toHaveProperty('typescript');

    const stored = await fs.readJson(path.join(tmpDir, 'skill-assessment-config.json'));
    expect(stored.projectName).toBe('skills-app');
    expect(stored.passingScoreThreshold).toBe(75);
    expect(stored.enableCertificationTracking).toBe(true);
    expect(stored.providers).toEqual(['aws', 'azure', 'gcp']);
  });

  it('writes the Python bundle (tf, manager, requirements.txt, MD, config.json)', async () => {
    await writeFiles(baseConfig, tmpDir, 'python');
    for (const f of [
      'skill-assessment.tf',
      'skill_assessment_manager.py',
      'requirements.txt',
      'SKILL_ASSESSMENT.md',
      'skill-assessment-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, f))).toBe(true);
    }
    expect(await fs.pathExists(path.join(tmpDir, 'skill-assessment-manager.ts'))).toBe(false);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(false);

    const requirements = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf8');
    expect(requirements).toContain('asyncio');
    expect(requirements).toContain('pandas');
    expect(requirements).toContain('numpy');
  });

  it('creates a nested output directory that does not yet exist', async () => {
    const nested = path.join(tmpDir, 'x', 'y', 'z');
    await writeFiles(baseConfig, nested, 'typescript');
    expect(await fs.pathExists(path.join(nested, 'skill-assessment.tf'))).toBe(true);
  });
});
