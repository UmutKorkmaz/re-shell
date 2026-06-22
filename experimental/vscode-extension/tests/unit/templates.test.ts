import { describe, it, expect } from 'vitest';

import {
  parseTemplatesList,
  groupTemplatesByLanguage,
  languageLabel,
} from '../../src/core/templates.js';
import type { TemplateSummary } from '../../src/core/templates.js';

function okEnvelope<T>(data: T, warnings: string[] = []): string {
  return JSON.stringify({ ok: true, data, warnings });
}

function errorEnvelope(code: string, message: string): string {
  return JSON.stringify({ ok: false, error: { code, message }, warnings: [] });
}

function tpl(over: Partial<TemplateSummary> = {}): TemplateSummary {
  return {
    id: 'node-express',
    name: 'Express',
    description: 'Express backend',
    language: 'typescript',
    framework: 'express',
    tags: ['api'],
    ...over,
  };
}

describe('parseTemplatesList', () => {
  it('parses a valid templates envelope into sorted templates', () => {
    const raw = okEnvelope([
      tpl({ id: 'b', language: 'python', framework: 'fastapi' }),
      tpl({ id: 'a', language: 'typescript', framework: 'express' }),
    ]);
    const result = parseTemplatesList(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Sorted by language (python < typescript), then framework, then id.
    expect(result.templates.map((t) => t.id)).toEqual(['b', 'a']);
    expect(result.warnings).toEqual([]);
  });

  it('accepts an already-parsed object', () => {
    const obj = { ok: true, data: [tpl()], warnings: [] };
    const result = parseTemplatesList(obj);
    expect(result.ok).toBe(true);
  });

  it('parses the real CLI wire shape (displayName/features/port/fileCount; no domain/command)', () => {
    // Mirrors the exact `re-shell templates list --json` output produced by
    // toTemplateSummary — the feed that previously failed the richer contract
    // schema (which requires `domain`/`command`). Locks the wire shape in.
    const raw = okEnvelope([
      {
        id: 'express',
        name: 'express',
        displayName: 'Express.js',
        description: 'Fast web framework',
        language: 'typescript',
        framework: 'express',
        version: '4.19.2',
        tags: ['nodejs', 'express', 'typescript'],
        features: ['middleware', 'routing', 'cors'],
        port: 3000,
        fileCount: 27,
      },
    ]);
    const result = parseTemplatesList(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.templates[0].displayName).toBe('Express.js');
    expect(result.templates[0].port).toBe(3000);
    expect(result.templates[0].features).toContain('routing');
  });

  it('rejects malformed JSON', () => {
    const result = parseTemplatesList('{broken');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('not valid JSON');
  });

  it('rejects an empty string', () => {
    const result = parseTemplatesList('');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/empty/i);
  });

  it('surfaces a CLI error envelope', () => {
    const result = parseTemplatesList(errorEnvelope('TEMPLATES_LIST_ERROR', 'nope'));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('TEMPLATES_LIST_ERROR');
  });

  it('rejects a payload that does not match the contract', () => {
    const result = parseTemplatesList(okEnvelope([{ id: 123 }]));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('does not match the contract');
  });
});

describe('languageLabel', () => {
  it('maps known language keys to canonical labels', () => {
    expect(languageLabel('typescript')).toBe('TypeScript');
    expect(languageLabel('ts')).toBe('TypeScript');
    expect(languageLabel('python')).toBe('Python');
    expect(languageLabel('go')).toBe('Go');
    expect(languageLabel('rust')).toBe('Rust');
    expect(languageLabel('csharp')).toBe('C#');
  });

  it('title-cases unknown languages', () => {
    expect(languageLabel('dart')).toBe('Dart');
    expect(languageLabel('some-lang')).toBe('Some Lang');
  });

  it('handles empty input', () => {
    expect(languageLabel('')).toBe('');
  });
});

describe('groupTemplatesByLanguage', () => {
  it('groups by language then framework, alphabetically', () => {
    const templates = [
      tpl({ id: '1', language: 'typescript', framework: 'express' }),
      tpl({ id: '2', language: 'typescript', framework: 'fastify' }),
      tpl({ id: '3', language: 'python', framework: 'fastapi' }),
      tpl({ id: '4', language: 'typescript', framework: 'express' }), // same framework, deduped by id sort
    ];
    const grouped = groupTemplatesByLanguage(templates);
    expect(grouped.map((g) => g.language)).toEqual(['python', 'typescript']);
    const ts = grouped.find((g) => g.language === 'typescript')!;
    expect(ts.frameworks.map((f) => f.framework)).toEqual(['express', 'fastify']);
    expect(ts.label).toBe('TypeScript');
    // two express templates (different ids) are both present, sorted by id.
    expect(ts.frameworks[0].templates.map((t) => t.id)).toEqual(['1', '4']);
  });

  it('returns an empty array for no templates', () => {
    expect(groupTemplatesByLanguage([])).toEqual([]);
  });
});
