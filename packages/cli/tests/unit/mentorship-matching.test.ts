import { describe, it, expect } from 'vitest';

import {
  displayConfig,
  generateMentorshipMD,
  generateTerraformMentorship,
  generateTypeScriptMentorship,
  generatePythonMentorship,
  mentorship,
} from '../../src/utils/mentorship-matching';

const baseConfig = {
  projectName: 'mentortest',
  providers: ['aws' as const, 'azure' as const, 'gcp' as const],
  users: [
    {
      userId: 'u1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'mentor' as const,
      department: 'Eng',
      level: 'senior' as const,
      skills: ['ts'],
      expertiseAreas: ['frontend'],
      learningGoals: [],
      availability: { daysPerWeek: 2, hoursPerWeek: 4, timezone: 'UTC' },
      location: 'remote',
      bio: '',
      yearsExperience: 8,
    },
    {
      userId: 'u2',
      name: 'Bob',
      email: 'bob@example.com',
      role: 'mentee' as const,
      department: 'Eng',
      level: 'junior' as const,
      skills: [],
      expertiseAreas: [],
      learningGoals: ['ts'],
      availability: { daysPerWeek: 3, hoursPerWeek: 6, timezone: 'UTC' },
      location: 'remote',
      bio: '',
      yearsExperience: 1,
    },
  ],
  programs: [],
  pairs: [
    {
      id: 'p1',
      mentorId: 'u1',
      mentorName: 'Alice',
      menteeId: 'u2',
      menteeName: 'Bob',
      status: 'active' as const,
      startDate: new Date('2026-01-01'),
      matchScore: 88,
      collaborationType: 'one-on-one' as const,
      focusAreas: ['frontend'],
      goals: ['learn ts'],
      sessionFrequency: 'weekly',
      sessionDuration: 60,
    },
  ],
  sessions: [],
  feedbacks: [],
  enableAutoMatching: true,
  enableFeedbackSystem: false,
  enableProgressTracking: true,
  matchThreshold: 70,
  sessionReminderHours: 24,
};

describe('mentorship-matching', () => {
  describe('mentorship passthrough', () => {
    it('returns the same config reference', () => {
      expect(mentorship(baseConfig)).toBe(baseConfig);
    });
  });

  describe('displayConfig', () => {
    it('does not throw', () => {
      expect(() => displayConfig(baseConfig)).not.toThrow();
    });
  });

  describe('generateMentorshipMD', () => {
    it('renders the title header', () => {
      const md = generateMentorshipMD(baseConfig);
      expect(md).toContain('# Mentorship Matching and Collaboration Tools');
    });

    it('lists all collaboration types', () => {
      const md = generateMentorshipMD(baseConfig);
      expect(md).toContain('One-on-One');
      expect(md).toContain('Group');
      expect(md).toContain('Workshop');
      expect(md).toContain('Project');
      expect(md).toContain('Shadowing');
    });

    it('describes the matching algorithm factors', () => {
      const md = generateMentorshipMD(baseConfig);
      expect(md).toContain('Skills Overlap');
      expect(md).toContain('Experience Gap');
      expect(md).toContain('Availability');
      expect(md).toContain('Goals Alignment');
    });
  });

  describe('generateTerraformMentorship', () => {
    it('embeds the project name in the comment header', () => {
      const tf = generateTerraformMentorship(baseConfig);
      expect(tf).toContain('mentortest');
      expect(tf).toContain('Auto-generated Mentorship Terraform');
    });

    it('includes an ISO 8601 generation timestamp', () => {
      const tf = generateTerraformMentorship(baseConfig);
      expect(tf).toMatch(/Generated at: \d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('generateTypeScriptMentorship', () => {
    it('embeds the project name in the file header', () => {
      const ts = generateTypeScriptMentorship(baseConfig);
      expect(ts).toContain('mentortest');
      expect(ts).toContain('Auto-generated Mentorship Manager');
    });

    it('imports EventEmitter', () => {
      const ts = generateTypeScriptMentorship(baseConfig);
      expect(ts).toContain("import { EventEmitter } from 'events';");
    });

    it('serializes matchThreshold and enableAutoMatching', () => {
      const ts = generateTypeScriptMentorship(baseConfig);
      expect(ts).toContain('matchThreshold: 70');
      expect(ts).toContain('enableAutoMatching: true');
    });

    it('serializes enableAutoMatching as false when disabled', () => {
      const ts = generateTypeScriptMentorship({ ...baseConfig, enableAutoMatching: false });
      expect(ts).toContain('enableAutoMatching: false');
    });
  });

  describe('generatePythonMentorship', () => {
    it('embeds the project name in the file header', () => {
      const py = generatePythonMentorship(baseConfig);
      expect(py).toContain('mentortest');
      expect(py).toContain('Auto-generated Mentorship Manager');
    });

    it('uses Python booleans True/False', () => {
      const pyOn = generatePythonMentorship(baseConfig);
      const pyOff = generatePythonMentorship({ ...baseConfig, enableAutoMatching: false });
      expect(pyOn).toContain('self.enable_auto_matching = True');
      expect(pyOff).toContain('self.enable_auto_matching = False');
    });

    it('embeds the project name in __init__ default argument', () => {
      const py = generatePythonMentorship(baseConfig);
      expect(py).toContain("def __init__(self, project_name: str = 'mentortest')");
    });

    it('serializes matchThreshold as a Python attribute', () => {
      const py = generatePythonMentorship(baseConfig);
      expect(py).toContain('self.match_threshold = 70');
    });
  });
});
