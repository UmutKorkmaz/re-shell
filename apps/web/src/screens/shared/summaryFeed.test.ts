import { describe, expect, it } from 'vitest';

import {
  feedToHealthSummary,
  feedToWorkspaceSummary,
  summaryFeedSchema,
  healthFeedSchema,
} from './summaryFeed';

describe('summaryFeed adapters', () => {
  describe('feedToWorkspaceSummary', () => {
    it('splits apps from services and adapts health', () => {
      const feed = summaryFeedSchema.parse({
        root: '/repo/demo-monorepo',
        packageManager: 'pnpm',
        workspaces: [
          { name: 'web', path: 'apps/web', type: 'app', framework: 'react' },
          { name: 'api', path: 'packages/api', type: 'package' },
          { name: 'lib', path: 'libs/lib', type: 'lib' },
        ],
        health: {
          score: 80,
          status: 'degraded',
          checks: [
            { name: 'lockfile', status: 'healthy', message: 'ok' },
            { name: 'deps', status: 'warning' },
            { name: 'build', status: 'critical', message: 'broken' },
          ],
        },
      });

      const summary = feedToWorkspaceSummary(feed);
      expect(summary.name).toBe('demo-monorepo');
      expect(summary.packageManager).toBe('pnpm');
      expect(summary.apps).toHaveLength(1);
      expect(summary.apps[0]).toMatchObject({ name: 'web', framework: 'react', type: 'unknown' });
      expect(summary.services).toHaveLength(2);
      expect(summary.health.status).toBe('warn'); // degraded -> warn
      expect(summary.health.checks.map((c) => c.level)).toEqual(['pass', 'warn', 'fail']);
    });

    it('falls back to "workspace" name and "unknown" package manager', () => {
      const feed = summaryFeedSchema.parse({
        root: '',
        packageManager: 'rush',
        workspaces: [],
        health: { score: 0, status: 'critical', checks: [] },
      });
      const summary = feedToWorkspaceSummary(feed);
      expect(summary.name).toBe('workspace');
      expect(summary.packageManager).toBe('unknown');
      expect(summary.health.status).toBe('fail'); // critical -> fail
    });
  });

  describe('feedToHealthSummary', () => {
    it('adapts the canonical health feed into a HealthSummary', () => {
      const feed = healthFeedSchema.parse({
        score: 95,
        status: 'healthy',
        checks: [{ name: 'all good', status: 'healthy' }],
      });
      const summary = feedToHealthSummary(feed);
      expect(summary.score).toBe(95);
      expect(summary.status).toBe('pass'); // healthy -> pass
      expect(summary.checks[0]).toMatchObject({ title: 'all good', level: 'pass', message: '' });
    });
  });
});
