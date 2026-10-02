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

  it('fails explicitly when no runner is wired', async () => {
    await runUiTest({ json: true });
    const env = lastJson();
    expect(env.ok).toBe(false);
    expect(env.error).toMatchObject({ code: 'UI_TEST_ERROR', message: expect.stringMatching(/not run/i) });
    expect(env.data).toBeUndefined();
    expect(process.exitCode).toBe(1);
  });

  it('reports missing runner on stderr in human mode', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await runUiTest({});
      expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/not run/i));
      expect(written).toEqual([]);
      expect(process.exitCode).toBe(1);
    } finally {
      stderr.mockRestore();
    }
  });

  it('fails the gate when an injected runner returns no stories', async () => {
    await runUiTest({ json: true, runStories: async () => [] });
    const data = lastJson().data as { storyCount: number; uiMaturityScore: number; pass: boolean; warnings: string[] };
    expect(data.storyCount).toBe(0);
    expect(data.uiMaturityScore).toBe(0);
    expect(data.pass).toBe(false);
    expect(data.warnings.join(' ')).toMatch(/no stories were run/);
    expect(process.exitCode).toBe(1);
  });

  it.each(['visaul', 'a11y,unknown', '', ', ,'])('rejects invalid gate %j before running stories', async gate => {
    const runStories = vi.fn(async () => [{ id: 'a', interaction: true, a11y: true, visual: true }]);
    await runUiTest({ json: true, gate, runStories });
    expect(lastJson()).toMatchObject({ ok: false, error: { code: 'UI_TEST_ERROR', message: expect.stringMatching(/gate/i) } });
    expect(runStories).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
