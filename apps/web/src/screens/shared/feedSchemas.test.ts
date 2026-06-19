import { describe, it, expect } from 'vitest';
import {
  graphNodeSchema,
  workspaceGraphSchema,
  templateFeedSchema,
  scorecardGradeSchema,
  scorecardFeedSchema,
  catalogFeedSchema,
} from './feedSchemas';

/**
 * Tests for feedSchemas.ts — the zod schemas that protect every data screen
 * from malformed hub/CLI --json output. Previously zero direct tests.
 */
describe('graphNodeSchema', () => {
  it('parses a valid node with defaults for missing optional fields', () => {
    const node = graphNodeSchema.parse({ name: 'api' });
    expect(node.name).toBe('api');
    expect(node.dependencies).toEqual([]);
  });

  it('rejects a node missing name', () => {
    expect(graphNodeSchema.safeParse({ framework: 'express' }).success).toBe(false);
  });
});

describe('workspaceGraphSchema', () => {
  it('parses a valid graph with defaults', () => {
    const graph = workspaceGraphSchema.parse({ apps: [], services: [] });
    expect(graph.apps).toEqual([]);
    expect(graph.services).toEqual([]);
  });

  it('rejects a non-array apps field', () => {
    expect(workspaceGraphSchema.safeParse({ apps: {}, services: [] }).success).toBe(false);
  });
});

describe('templateFeedSchema', () => {
  it('parses a valid template with defaults', () => {
    const t = templateFeedSchema.parse({ id: 'express', name: 'Express', language: 'typescript' });
    expect(t.id).toBe('express');
    expect(t.tags).toEqual([]);
  });
});

describe('scorecardGradeSchema', () => {
  it('accepts valid grades', () => {
    for (const g of ['A', 'B', 'C', 'D', 'F']) {
      expect(scorecardGradeSchema.safeParse(g).success).toBe(true);
    }
  });

  it('rejects an out-of-band grade', () => {
    expect(scorecardGradeSchema.safeParse('E').success).toBe(false);
    expect(scorecardGradeSchema.safeParse('X').success).toBe(false);
  });
});

describe('scorecardFeedSchema', () => {
  it('parses a valid scorecard with defaults', () => {
    const s = scorecardFeedSchema.parse({
      score: 85,
      grade: 'B',
      threshold: 70,
      pass: true,
    });
    expect(s.score).toBe(85);
    expect(s.services).toEqual([]);
    expect(s.driftEntries).toBe(0);
  });
});

describe('catalogFeedSchema', () => {
  it('parses a valid catalog with defaults', () => {
    const c = catalogFeedSchema.parse({
      system: 'demo',
    });
    expect(c.system).toBe('demo');
    expect(c.entities).toEqual([]);
    expect(c.dryRun).toBe(true);
    expect(c.counts.components).toBe(0);
  });

  it('accepts extra fields on the catalog entity spec via catchall', () => {
    const c = catalogFeedSchema.parse({
      system: 'demo',
      entities: [
        {
          kind: 'Component',
          metadata: { name: 'api' },
          spec: { type: 'service', owner: 'team-x', customField: true },
        },
      ],
    });
    expect(c.entities).toHaveLength(1);
    expect(c.entities[0].spec.customField).toBe(true);
  });

  it('rejects a catalog entity missing kind', () => {
    const parsed = catalogFeedSchema.safeParse({
      system: 'demo',
      entities: [{ metadata: { name: 'api' }, spec: {} }],
    });
    expect(parsed.success).toBe(false);
  });
});
