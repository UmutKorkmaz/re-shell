import { describe, expect, it } from 'vitest';

import { feedToTemplateSummary, facetValues, scaffoldCommand } from './templateAdapters';
import type { TemplateFeed } from '../shared/feedSchemas';

const base = (over: Partial<TemplateFeed>): TemplateFeed => ({
  id: 'svc',
  name: 'svc',
  description: 'a service',
  language: 'typescript',
  framework: 'express',
  tags: [],
  features: [],
  ...over,
});

describe('templateAdapters', () => {
  describe('feedToTemplateSummary', () => {
    it('derives a frontend domain and marks tier-1 ids', () => {
      const summary = feedToTemplateSummary(base({ id: 'express', tags: ['react'] }));
      expect(summary.domain).toBe('frontend');
      expect(summary.tier).toBe(1);
    });

    it('derives an infrastructure domain', () => {
      expect(feedToTemplateSummary(base({ tags: ['docker'] })).domain).toBe('infrastructure');
    });

    it('defaults to a backend domain and derives a database label', () => {
      const summary = feedToTemplateSummary(base({ tags: ['postgres'] }));
      expect(summary.domain).toBe('backend');
      expect(summary.database).toBe('PostgreSQL');
      expect(summary.tier).toBeUndefined();
    });

    it('prefers displayName but falls back to name', () => {
      expect(feedToTemplateSummary(base({ displayName: 'Pretty' })).name).toBe('Pretty');
      expect(feedToTemplateSummary(base({ displayName: undefined, name: 'raw' })).name).toBe('raw');
    });
  });

  describe('scaffoldCommand', () => {
    it('builds the create command and injects --dry-run when requested', () => {
      expect(scaffoldCommand(base({ id: 'fastify' }), false)).toEqual([
        're-shell',
        'create',
        'fastify',
        '--template',
        'fastify',
      ]);
      expect(scaffoldCommand(base({ id: 'fastify' }), true)).toContain('--dry-run');
    });
  });

  describe('facetValues', () => {
    it('collects unique, sorted facet values across the feed', () => {
      const templates = [
        base({ id: 'a', tags: ['postgres'] }),
        base({ id: 'b', tags: ['mysql'] }),
        base({ id: 'c', tags: ['postgres'] }),
        base({ id: 'd', tags: [] }),
      ];
      const databases = facetValues(templates, (s) => s.database);
      expect(databases).toEqual(['MySQL', 'PostgreSQL']);
    });
  });
});
