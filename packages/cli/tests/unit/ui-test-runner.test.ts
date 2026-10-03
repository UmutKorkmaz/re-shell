import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  StorybookRunError,
  assertToolingInstalled,
  collectStoryResults,
  detectStorybook,
  parseStorybookIndex,
  runStorybookTests,
  type IndexStory,
  type JestJson,
} from '../../src/utils/ui-test-runner';
import { UI_TEST_HOOKS_SOURCE, type UiStoryRecord } from '../../src/utils/ui-test-hooks';
import { runUiTest } from '../../src/commands/ui-test';
import { aggregateUiTests, passesGate } from '../../src/utils/ui-test-engine';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ui-test-runner-'));
}

function project(root: string, rel: string): string {
  const dir = path.join(root, rel);
  fs.mkdirSync(path.join(dir, '.storybook'), { recursive: true });
  return dir;
}

describe('detectStorybook', () => {
  let root: string;
  beforeEach(() => {
    root = tmp();
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('returns null when the workspace has no Storybook', () => {
    fs.mkdirSync(path.join(root, 'packages', 'plain'), { recursive: true });
    expect(detectStorybook(root)).toBeNull();
  });

  it('finds .storybook in the workspace root', () => {
    const dir = project(root, '.');
    expect(detectStorybook(root)).toEqual({ projectDir: dir, configDir: path.join(dir, '.storybook') });
  });

  it('finds a single Storybook under packages/*', () => {
    const dir = project(root, 'packages/ui');
    fs.mkdirSync(path.join(root, 'packages', 'cli'), { recursive: true });
    expect(detectStorybook(root)?.projectDir).toBe(dir);
  });

  it('does not look at sibling packages when run inside a package without Storybook', () => {
    project(root, 'packages/ui');
    expect(detectStorybook(path.join(root, 'packages', 'ui', '..', 'other'))).toBeNull();
  });

  it('refuses to guess between several Storybooks', () => {
    project(root, 'packages/ui');
    project(root, 'apps/docs');
    expect(() => detectStorybook(root)).toThrow(/multiple Storybook projects.*--storybook/);
  });

  it('honours an explicit --storybook directory and validates it', () => {
    const dir = project(root, 'tools/sb');
    expect(detectStorybook(root, 'tools/sb')?.projectDir).toBe(dir);
    expect(() => detectStorybook(root, 'tools/missing')).toThrow(StorybookRunError);
  });
});

describe('assertToolingInstalled', () => {
  it('names every missing dependency', () => {
    const root = tmp();
    try {
      const dir = project(root, '.');
      const proj = { projectDir: dir, configDir: path.join(dir, '.storybook') };
      let message = '';
      try {
        assertToolingInstalled(proj, true);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/UI tests not run/);
      for (const name of ['storybook', '@storybook/test-runner', 'axe-playwright', 'jest-image-snapshot']) {
        expect(message).toContain(name);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('parseStorybookIndex', () => {
  it('keeps story entries and drops docs entries', () => {
    const stories = parseStorybookIndex({
      v: 5,
      entries: {
        'a--one': { type: 'story', id: 'a--one', title: 'A', name: 'One' },
        'a--docs': { type: 'docs', id: 'a--docs', title: 'A', name: 'Docs' },
        'b--two': { id: 'b--two', title: 'B', name: 'Two' },
      },
    });
    expect(stories.map((s) => s.id)).toEqual(['a--one', 'b--two']);
  });

  it('rejects an index without entries', () => {
    expect(() => parseStorybookIndex({})).toThrow(/entries/);
    expect(() => parseStorybookIndex(null)).toThrow(StorybookRunError);
  });
});

describe('collectStoryResults', () => {
  const stories: IndexStory[] = [
    { id: 'ui-button--primary', title: 'UI/Button', name: 'Primary' },
    { id: 'ui-button--disabled', title: 'UI/Button', name: 'Disabled' },
    { id: 'ui-card--default', title: 'UI/Card', name: 'Default' },
    { id: 'ui-tabs--keys', title: 'UI/Tabs', name: 'Keys' },
  ];
  const record = (id: string, patch: Partial<UiStoryRecord> = {}): [string, UiStoryRecord] => [
    id,
    { id, a11y: [], visual: [], createdBaselines: 0, ...patch },
  ];
  const jest: JestJson = {
    testResults: [
      {
        assertionResults: [
          { ancestorTitles: ['UI/Button', 'Primary'], title: 'play-test', status: 'passed' },
          {
            ancestorTitles: ['UI/Button', 'Disabled'],
            title: 'play-test',
            status: 'failed',
            failureMessages: ['Error: \u001b[34mClick to debug\u001b[39m\n\nMessage:\n expected 0 to be greater than 0\n\nIgnored nodes'],
          },
          { ancestorTitles: ['UI/Card', 'Default'], title: 'smoke-test', status: 'passed' },
        ],
      },
    ],
  };

  it('reports each pillar separately and never lets one failure mask another', () => {
    const results = collectStoryResults(
      stories,
      jest,
      new Map([
        record('ui-button--primary'),
        record('ui-card--default', { a11y: ['[light] color-contrast (serious): low contrast -> .x'], visual: ['[dark] 3% different'] }),
      ])
    );
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));

    expect(byId['ui-button--primary']).toMatchObject({ interaction: true, a11y: true, visual: true });
    expect(byId['ui-button--primary'].failures).toBeUndefined();

    // Passing interaction, failing a11y AND visual, both reported.
    expect(byId['ui-card--default']).toMatchObject({ interaction: true, a11y: false, visual: false });
    expect(byId['ui-card--default'].failures?.a11y).toContain('color-contrast');
    expect(byId['ui-card--default'].failures?.visual).toContain('3% different');
  });

  it('marks a failing play function and the unevaluated pillars as failed', () => {
    const [disabled] = collectStoryResults(stories.slice(1, 2), jest, new Map());
    expect(disabled).toMatchObject({ interaction: false, a11y: false, visual: false });
    expect(disabled.failures?.interaction).toBe('expected 0 to be greater than 0');
    expect(disabled.failures?.a11y).toMatch(/not evaluated/);
  });

  it('treats a story the runner never executed as a failure, not a pass', () => {
    const [tabs] = collectStoryResults(stories.slice(3), jest, new Map([record('ui-tabs--keys')]));
    expect(tabs.interaction).toBe(false);
    expect(tabs.failures?.interaction).toMatch(/not executed/);
  });

  it('flags missing check records even when the story itself passed', () => {
    const [primary] = collectStoryResults(stories.slice(0, 1), jest, new Map());
    expect(primary).toMatchObject({ interaction: true, a11y: false, visual: false });
    expect(primary.failures?.a11y).toMatch(/hooks did not run/);
  });

  it('feeds the gate: a11y/visual failures fail it, an all-green run passes it', () => {
    const green = collectStoryResults(stories.slice(0, 1), jest, new Map([record('ui-button--primary')]));
    expect(passesGate(aggregateUiTests(green))).toBe(true);
    const red = collectStoryResults(stories.slice(0, 1), jest, new Map([record('ui-button--primary', { a11y: ['x'] })]));
    expect(passesGate(aggregateUiTests(red))).toBe(false);
  });
});

describe('embedded test-runner hooks', () => {
  it('is valid CommonJS that implements the shared contract', () => {
    // Compiles (no syntax errors) without executing the Playwright-dependent body.
    expect(() => new Function('require', 'module', 'process', 'expect', UI_TEST_HOOKS_SOURCE)).not.toThrow();
    for (const needle of ['RE_SHELL_UI_TEST_OUT', 'RE_SHELL_UI_TEST_SNAPSHOTS', 'wcag21aa', 'toMatchImageSnapshot', "['dark', 'light']"]) {
      expect(UI_TEST_HOOKS_SOURCE).toContain(needle);
    }
  });
});

describe('runStorybookTests orchestration (with a stand-in test-storybook binary)', () => {
  let root: string;
  beforeEach(() => {
    root = tmp();
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  /** A project whose `test-storybook` is a script that honours the runner's CLI + env contract. */
  function projectWithFakeRunner(body: string): string {
    const dir = project(root, 'packages/ui');
    fs.mkdirSync(path.join(dir, 'node_modules', '.bin'), { recursive: true });
    for (const dep of ['axe-playwright', 'jest-image-snapshot']) fs.mkdirSync(path.join(dir, 'node_modules', dep), { recursive: true });
    const bin = path.join(dir, 'node_modules', '.bin', 'test-storybook');
    fs.writeFileSync(bin, `#!/usr/bin/env node\n${body}\n`, { mode: 0o755 });
    return dir;
  }

  function staticDir(stories: Array<{ id: string; title: string; name: string }>): string {
    const dir = path.join(root, 'static');
    fs.mkdirSync(dir, { recursive: true });
    const entries = Object.fromEntries(stories.map((s) => [s.id, { type: 'story', ...s }]));
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ v: 5, entries }));
    return dir;
  }

  const FAKE = `
    const fs = require('fs'); const path = require('path');
    const args = process.argv.slice(2);
    const arg = (n) => args[args.indexOf(n) + 1];
    const url = arg('--url');
    require('http').get(url + '/index.json', (res) => {
      let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => {
        const entries = Object.values(JSON.parse(body).entries);
        const out = process.env.RE_SHELL_UI_TEST_OUT; fs.mkdirSync(out, { recursive: true });
        const assertionResults = entries.map((e) => ({ ancestorTitles: [e.title, e.name], title: 'play-test', status: 'passed', failureMessages: [] }));
        for (const e of entries) fs.writeFileSync(path.join(out, e.id + '.json'), JSON.stringify({ id: e.id, a11y: [], visual: [], createdBaselines: 1 }));
        fs.writeFileSync(arg('--outputFile'), JSON.stringify({ testResults: [{ assertionResults }] }));
        fs.writeFileSync(path.join(process.env.CAPTURE, 'argv.json'), JSON.stringify({ args, hooks: fs.existsSync(path.join(arg('--config-dir'), 'test-runner.js')), main: fs.existsSync(path.join(arg('--config-dir'), 'main.js')), snapshots: process.env.RE_SHELL_UI_TEST_SNAPSHOTS, ci: process.env.CI }));
      });
    });
  `;

  it('serves the static build, runs the runner with the hooks contract and collects every story', async () => {
    const capture = path.join(root, 'capture');
    fs.mkdirSync(capture);
    const dir = projectWithFakeRunner(FAKE);
    const stories = staticDir([
      { id: 'ui-a--one', title: 'UI/A', name: 'One' },
      { id: 'ui-a--two', title: 'UI/A', name: 'Two' },
    ]);
    process.env.CAPTURE = capture;
    try {
      const run = await runStorybookTests({ workspace: root, staticDir: stories, updateSnapshots: true, ci: true });
      expect(run.storyCount).toBe(2);
      expect(run.results.map((r) => [r.id, r.interaction, r.a11y, r.visual])).toEqual([
        ['ui-a--one', true, true, true],
        ['ui-a--two', true, true, true],
      ]);
      expect(run.warnings.join(' ')).toMatch(/2 new visual baseline/);

      const seen = JSON.parse(fs.readFileSync(path.join(capture, 'argv.json'), 'utf8'));
      expect(seen.args).toEqual(expect.arrayContaining(['--index-json', '--json', '--browsers', 'chromium', '--updateSnapshot']));
      // `ci` is expressed through jest's CI mode, not a flag the runner mishandles.
      expect(seen.args).not.toContain('--ci');
      expect(seen.ci).toBe('true');
      expect(seen.hooks).toBe(true);
      expect(seen.main).toBe(true);
      expect(seen.snapshots).toBe(path.join(dir, '__image_snapshots__'));
      // Temp config dir is cleaned up afterwards.
      expect(fs.readdirSync(path.join(dir, 'node_modules', '.cache', 're-shell'))).toEqual([]);
    } finally {
      delete process.env.CAPTURE;
    }
  });

  it('fails explicitly when the runner exits without producing a result', async () => {
    projectWithFakeRunner('console.error("browserType.launch: Executable doesn\'t exist"); process.exit(1);');
    const stories = staticDir([{ id: 'ui-a--one', title: 'UI/A', name: 'One' }]);
    await expect(runStorybookTests({ workspace: root, staticDir: stories })).rejects.toMatchObject({
      name: 'StorybookRunError',
      message: expect.stringMatching(/produced no result.*Playwright browser/s),
      details: { tail: expect.stringContaining("Executable doesn't exist") },
    });
  });

  it('refuses a Storybook that lists no stories', async () => {
    projectWithFakeRunner('process.exit(0);');
    const stories = staticDir([]);
    await expect(runStorybookTests({ workspace: root, staticDir: stories })).rejects.toThrow(/lists no stories/);
  });

  it('fails when no Storybook exists in the workspace', async () => {
    await expect(runStorybookTests({ workspace: root })).rejects.toThrow(/no Storybook detected/);
  });
});

describe('runUiTest (real runner path)', () => {
  let written: string[];
  let writeSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    }) as unknown as ReturnType<typeof vi.spyOn>;
  });
  afterEach(() => {
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('keeps the explicit UI_TEST_ERROR when no Storybook is detected', async () => {
    const root = tmp();
    try {
      await runUiTest({ json: true, workspace: root });
      const env = JSON.parse(written[written.length - 1]);
      expect(env).toMatchObject({ ok: false, error: { code: 'UI_TEST_ERROR', message: expect.stringMatching(/not run.*no Storybook detected/) } });
      expect(process.exitCode).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports missing tooling as UI_TEST_ERROR, not a pass', async () => {
    const root = tmp();
    try {
      project(root, 'packages/ui');
      await runUiTest({ json: true, workspace: root });
      const env = JSON.parse(written[written.length - 1]);
      expect(env.ok).toBe(false);
      expect(env.error.code).toBe('UI_TEST_ERROR');
      expect(env.error.message).toMatch(/@storybook\/test-runner/);
      expect(process.exitCode).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
