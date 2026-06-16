import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { runUiTest } from '../../src/commands/ui-test';
import { uiTestResponseSchema } from '@re-shell/contracts';
import type { StoryResult } from '../../src/utils/ui-test-engine';

/** Integration coverage for `re-shell ui test` (issue #22). */

describe('runUiTest', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];
  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });
  afterEach(() => {
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });
  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  it('aggregates injected story results and scores them', async () => {
    const results: StoryResult[] = [
      { id: 'a', interaction: true, a11y: true, visual: true },
      { id: 'b', interaction: true, a11y: true, visual: true },
    ];
    await runUiTest({ json: true, runStories: async () => results });
    const data = lastJson().data as { storyCount: number; uiMaturityScore: number; allPassed: boolean; pass: boolean };
    expect(data.storyCount).toBe(2);
    expect(data.uiMaturityScore).toBe(100);
    expect(data.allPassed).toBe(true);
    expect(data.pass).toBe(true);
  });

  it('exits non-zero when an a11y check fails (default gate)', async () => {
    const results: StoryResult[] = [{ id: 'a', interaction: true, a11y: false, visual: true }];
    await runUiTest({ json: true, runStories: async () => results });
    const data = lastJson().data as { pass: boolean; failures: Array<{ kind: string }> };
    expect(data.pass).toBe(false);
    expect(data.failures.some(f => f.kind === 'a11y')).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('does NOT gate on an interaction-only failure by default', async () => {
    const results: StoryResult[] = [{ id: 'a', interaction: false, a11y: true, visual: true }];
    await runUiTest({ json: true, runStories: async () => results });
    const data = lastJson().data as { pass: boolean };
    expect(data.pass).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  it('honours a custom --gate that includes interaction', async () => {
    const results: StoryResult[] = [{ id: 'a', interaction: false, a11y: true, visual: true }];
    await runUiTest({ json: true, gate: 'interaction', runStories: async () => results });
    const data = lastJson().data as { pass: boolean };
    expect(data.pass).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('emits output that validates against uiTestResponseSchema', async () => {
    const results: StoryResult[] = [{ id: 'a', interaction: true, a11y: true, visual: true }];
    await runUiTest({ json: true, runStories: async () => results });
    expect(uiTestResponseSchema.safeParse(lastJson().data).success).toBe(true);
  });

  it('reports a warning + score 0 when no runner is wired', async () => {
    await runUiTest({ json: true });
    const data = lastJson().data as { storyCount: number; uiMaturityScore: number; warnings: string[] };
    expect(data.storyCount).toBe(0);
    expect(data.uiMaturityScore).toBe(0);
    expect(data.warnings.join(' ')).toMatch(/no Storybook runner wired/);
  });
});
