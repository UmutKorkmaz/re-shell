import { describe, it, expect } from 'vitest';

import {
  displayConfig,
  generateInteractiveTutorialsMD,
  generateTerraformInteractiveTutorials,
  generateTypeScriptInteractiveTutorials,
  generatePythonInteractiveTutorials,
  interactiveTutorials,
} from '../../src/utils/interactive-tutorials';

const baseConfig = {
  projectName: 'tuttest',
  providers: ['aws' as const, 'azure' as const],
  learningPaths: [
    {
      id: 'lp1',
      title: 'Getting Started',
      description: 'intro',
      category: 'onboarding',
      difficulty: 'beginner' as const,
      estimatedDuration: 4,
      prerequisites: [],
      learningObjectives: ['Learn basics'],
      targetAudience: ['new hires'],
      steps: [],
      tags: ['intro'],
    },
  ],
  learnerProgress: [],
  recommendations: [],
  enableProgressTracking: true,
  enablePersonalizedRecommendations: false,
  enableCertificates: true,
  enableBookmarking: true,
  enableNotes: false,
  defaultLearningStyle: 'visual' as const,
  maxRetries: 3,
  passingScoreThreshold: 70,
};

describe('interactive-tutorials', () => {
  describe('interactiveTutorials passthrough', () => {
    it('returns the same config reference', () => {
      expect(interactiveTutorials(baseConfig)).toBe(baseConfig);
    });
  });

  describe('displayConfig', () => {
    it('does not throw', () => {
      expect(() => displayConfig(baseConfig)).not.toThrow();
    });
  });

  describe('generateInteractiveTutorialsMD', () => {
    it('renders the title header', () => {
      const md = generateInteractiveTutorialsMD(baseConfig);
      expect(md).toContain('# Interactive Tutorials and Guided Learning Paths');
    });

    it('describes the supported content types', () => {
      const md = generateInteractiveTutorialsMD(baseConfig);
      // Just sanity check that the MD has substantive content
      expect(md.length).toBeGreaterThan(100);
    });
  });

  describe('generateTerraformInteractiveTutorials', () => {
    it('embeds the project name in the comment header', () => {
      const tf = generateTerraformInteractiveTutorials(baseConfig);
      expect(tf).toContain('tuttest');
      expect(tf).toContain('Auto-generated Interactive Tutorials Terraform');
    });

    it('emits an ISO 8601 timestamp', () => {
      const tf = generateTerraformInteractiveTutorials(baseConfig);
      expect(tf).toMatch(/Generated at: \d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('generateTypeScriptInteractiveTutorials', () => {
    it('embeds the project name in the comment header', () => {
      const ts = generateTypeScriptInteractiveTutorials(baseConfig);
      expect(ts).toContain('tuttest');
      expect(ts).toContain('Auto-generated Interactive Tutorials Manager');
    });

    it('serializes enableProgressTracking and passingScoreThreshold', () => {
      const ts = generateTypeScriptInteractiveTutorials(baseConfig);
      expect(ts).toContain('enableProgressTracking: true');
      expect(ts).toContain('passingScoreThreshold: 70');
    });

    it('serializes enableProgressTracking=false when disabled', () => {
      const ts = generateTypeScriptInteractiveTutorials({ ...baseConfig, enableProgressTracking: false });
      expect(ts).toContain('enableProgressTracking: false');
    });
  });

  describe('generatePythonInteractiveTutorials', () => {
    it('embeds the project name in the comment header', () => {
      const py = generatePythonInteractiveTutorials(baseConfig);
      expect(py).toContain('tuttest');
      expect(py).toContain('Auto-generated Interactive Tutorials Manager');
    });

    it('emits Python booleans True/False', () => {
      const pyOn = generatePythonInteractiveTutorials(baseConfig);
      const pyOff = generatePythonInteractiveTutorials({ ...baseConfig, enableProgressTracking: false });
      expect(pyOn).toContain('self.enable_progress_tracking = True');
      expect(pyOff).toContain('self.enable_progress_tracking = False');
    });

    it('embeds the project name in __init__ default argument', () => {
      const py = generatePythonInteractiveTutorials(baseConfig);
      expect(py).toContain("def __init__(self, project_name: str = 'tuttest')");
    });

    it('serializes passingScoreThreshold as a Python attribute', () => {
      const py = generatePythonInteractiveTutorials(baseConfig);
      expect(py).toContain('self.passing_score_threshold = 70');
    });
  });
});
