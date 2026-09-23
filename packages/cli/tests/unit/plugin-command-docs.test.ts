import { describe, it, expect } from 'vitest';

import {
  DocumentationFormat,
  DocumentationSection,
  HelpDisplayMode,
  PluginCommandDocumentationGenerator,
  createDocumentationGenerator,
  estimateReadingTime,
  formatDocumentationSize,
  validateDocumentationTemplate,
  type DocumentationTemplate,
  type GeneratedDocumentation,
} from '../../src/utils/plugin-command-docs';

describe('plugin-command-docs', () => {
  describe('enums', () => {
    it('exposes the canonical DocumentationFormat values', () => {
      expect(DocumentationFormat.MARKDOWN).toBe('markdown');
      expect(DocumentationFormat.HTML).toBe('html');
      expect(DocumentationFormat.JSON).toBe('json');
      expect(DocumentationFormat.PLAIN_TEXT).toBe('plain-text');
      expect(DocumentationFormat.MAN_PAGE).toBe('man-page');
      expect(DocumentationFormat.PDF).toBe('pdf');
    });

    it('exposes the canonical DocumentationSection values', () => {
      expect(DocumentationSection.SYNOPSIS).toBe('synopsis');
      expect(DocumentationSection.DESCRIPTION).toBe('description');
      expect(DocumentationSection.ARGUMENTS).toBe('arguments');
      expect(DocumentationSection.OPTIONS).toBe('options');
      expect(DocumentationSection.EXAMPLES).toBe('examples');
      expect(DocumentationSection.EXIT_CODES).toBe('exit-codes');
    });

    it('exposes the canonical HelpDisplayMode values', () => {
      expect(HelpDisplayMode.COMPACT).toBe('compact');
      expect(HelpDisplayMode.DETAILED).toBe('detailed');
      expect(HelpDisplayMode.INTERACTIVE).toBe('interactive');
      expect(HelpDisplayMode.HIERARCHICAL).toBe('hierarchical');
      expect(HelpDisplayMode.SEARCHABLE).toBe('searchable');
    });
  });

  describe('estimateReadingTime', () => {
    it('returns 1 for empty string (split yields a single element)', () => {
      // ''.split(/\s+/) === [''] → length 1 → ceil(1/200) = 1
      expect(estimateReadingTime('')).toBe(1);
    });

    it('returns 1 minute for short text', () => {
      expect(estimateReadingTime('hello world')).toBe(1);
    });

    it('scales with word count at the configured reading speed', () => {
      // 400 words at 200 wpm = 2 minutes
      const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
      expect(estimateReadingTime(words, 200)).toBe(2);
    });

    it('honors a custom wordsPerMinute value', () => {
      const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
      // 300 / 300 = 1 minute
      expect(estimateReadingTime(words, 300)).toBe(1);
      // 300 / 100 = 3 minutes
      expect(estimateReadingTime(words, 100)).toBe(3);
    });

    it('rounds up partial minutes', () => {
      // 201 words / 200 wpm = 1.005 min -> ceil to 2
      const words = Array.from({ length: 201 }, (_, i) => `word${i}`).join(' ');
      expect(estimateReadingTime(words, 200)).toBe(2);
    });
  });

  describe('formatDocumentationSize', () => {
    it('renders bytes for content under 1KB', () => {
      const docs: GeneratedDocumentation[] = [
        {
          command: 'cmd',
          format: DocumentationFormat.MARKDOWN,
          content: 'hello',
          metadata: {
            generatedAt: 0,
            version: '1',
            template: 't',
            wordCount: 0,
            estimatedReadingTime: 0,
          },
          sections: {} as any,
          examples: [],
          relatedCommands: [],
        },
      ];
      expect(formatDocumentationSize(docs)).toBe('5 bytes');
    });

    it('renders KB for content between 1KB and 1MB', () => {
      const content = 'x'.repeat(2048);
      const docs: GeneratedDocumentation[] = [
        {
          command: 'cmd',
          format: DocumentationFormat.MARKDOWN,
          content,
          metadata: {
            generatedAt: 0,
            version: '1',
            template: 't',
            wordCount: 0,
            estimatedReadingTime: 0,
          },
          sections: {} as any,
          examples: [],
          relatedCommands: [],
        },
      ];
      expect(formatDocumentationSize(docs)).toMatch(/KB$/);
    });

    it('renders MB for content above 1MB', () => {
      const content = 'x'.repeat(1024 * 1024 + 10);
      const docs: GeneratedDocumentation[] = [
        {
          command: 'cmd',
          format: DocumentationFormat.MARKDOWN,
          content,
          metadata: {
            generatedAt: 0,
            version: '1',
            template: 't',
            wordCount: 0,
            estimatedReadingTime: 0,
          },
          sections: {} as any,
          examples: [],
          relatedCommands: [],
        },
      ];
      expect(formatDocumentationSize(docs)).toMatch(/MB$/);
    });

    it('returns "0 bytes" for an empty list', () => {
      expect(formatDocumentationSize([])).toBe('0 bytes');
    });
  });

  describe('validateDocumentationTemplate', () => {
    const valid: DocumentationTemplate = {
      name: 'default',
      format: DocumentationFormat.MARKDOWN,
      sections: [DocumentationSection.SYNOPSIS, DocumentationSection.OPTIONS],
    };

    it('returns an empty array for a valid template', () => {
      expect(validateDocumentationTemplate(valid)).toEqual([]);
    });

    it('reports a missing name', () => {
      const errors = validateDocumentationTemplate({ ...valid, name: '' });
      expect(errors).toContain('Template name is required');
    });

    it('reports a missing format (empty string)', () => {
      const errors = validateDocumentationTemplate({ ...valid, format: '' as any });
      expect(errors).toContain('Template format is required');
    });

    it('reports an empty sections array', () => {
      const errors = validateDocumentationTemplate({ ...valid, sections: [] });
      expect(errors).toContain('Template must include at least one section');
    });

    it('accumulates multiple errors', () => {
      const errors = validateDocumentationTemplate({
        name: '',
        format: '' as any,
        sections: [],
      });
      expect(errors).toHaveLength(3);
    });
  });

  describe('createDocumentationGenerator', () => {
    it('returns a PluginCommandDocumentationGenerator instance', () => {
      const gen = createDocumentationGenerator();
      expect(gen).toBeInstanceOf(PluginCommandDocumentationGenerator);
    });
  });

  describe('PluginCommandDocumentationGenerator', () => {
    it('constructs with optional help configuration', () => {
      const gen = new PluginCommandDocumentationGenerator({
        displayMode: HelpDisplayMode.DETAILED,
      });
      expect(gen).toBeInstanceOf(PluginCommandDocumentationGenerator);
    });
  });
});
