import { describe, expect, it } from 'vitest';
import type { WorkspaceLiveStatus } from '@re-shell/contracts';
import { feedToWorkspaceSummary, summaryFeedSchema, toNodeStatus } from './summaryFeed';

const feed = summaryFeedSchema.parse({
  root: '/ws',
  packageManager: 'pnpm',
  workspaces: [
    { name: 'web', path: 'apps/web', type: 'app', framework: 'react-ts' },
    { name: 'api', path: 'apps/api', type: 'app' },
    { name: 'ui', path: 'packages/ui', type: 'package' },
    { name: 'db', path: 'packages/db', type: 'package' },
  ],
  health: { score: 90, status: 'healthy', checks: [] },
});

describe('node status in the workspace summary', () => {
  it('stays honestly unknown without a live status map (no guessed colours)', () => {
    const summary = feedToWorkspaceSummary(feed);
    expect([...summary.apps, ...summary.services].map((n) => n.status)).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
  });

  it('takes node status from the live status map; unhealthy maps to the contract "error"', () => {
    const live = new Map<string, WorkspaceLiveStatus>([
      ['web', 'running'],
      ['api', 'unhealthy'],
      ['ui', 'stopped'],
    ]);
    const summary = feedToWorkspaceSummary(feed, live);
    expect(summary.apps.map((a) => [a.name, a.status])).toEqual([
      ['web', 'running'],
      ['api', 'error'],
    ]);
    expect(summary.services.map((s) => [s.name, s.status])).toEqual([
      ['ui', 'stopped'],
      ['db', 'unknown'], // not in the report
    ]);
  });

  it('maps every live status', () => {
    expect(toNodeStatus('running')).toBe('running');
    expect(toNodeStatus('stopped')).toBe('stopped');
    expect(toNodeStatus('unhealthy')).toBe('error');
    expect(toNodeStatus('unknown')).toBe('unknown');
    expect(toNodeStatus(undefined)).toBe('unknown');
  });
});
