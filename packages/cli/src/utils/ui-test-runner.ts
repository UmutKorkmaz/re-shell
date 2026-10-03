// `re-shell ui test` Storybook runner (R-2).
//
// Runs the workspace's REAL Storybook through @storybook/test-runner and turns the
// outcome into the `StoryResult[]` the aggregator (ui-test-engine.ts) consumes:
//
//   1. detect  - find the Storybook project (a `.storybook` dir) under the workspace
//   2. build   - `storybook build` into a temp dir (skipped for --url / --static-dir)
//   3. serve   - a tiny loopback static server for that build
//   4. run     - `test-storybook --index-json` with the hooks from ui-test-hooks.ts, which
//                run axe + screenshot checks in both themes and write one record per story
//   5. collect - merge jest's per-story results (interaction) with the records
//                (a11y, visual) by story id, keyed off the Storybook `index.json`
//
// Nothing here is simulated: a story that never ran, or whose checks never produced a
// record, is reported as FAILED for the pillars that were not evaluated, so the gate
// cannot pass on missing evidence.

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { StoryResult, UiTestKind } from './ui-test-engine';
import { UI_TEST_ENV, UI_TEST_HOOKS_FILENAME, UI_TEST_HOOKS_SOURCE, type UiStoryRecord } from './ui-test-hooks';

/** Raised for every runner failure so the command layer can emit UI_TEST_ERROR. */
export class StorybookRunError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'StorybookRunError';
    this.details = details;
  }
}

/** A detected Storybook project. */
export interface StorybookProject {
  /** Directory that contains `.storybook` and the project's `node_modules`. */
  readonly projectDir: string;
  /** Absolute path of the `.storybook` directory. */
  readonly configDir: string;
}

/** Options for {@link runStorybookTests}. */
export interface StorybookRunOptions {
  /** Workspace root to search (default: cwd). */
  readonly workspace: string;
  /** Explicit project directory containing `.storybook` (skips detection). */
  readonly storybook?: string;
  /** Test an already running / hosted Storybook instead of building one. */
  readonly url?: string;
  /** Serve a prebuilt `storybook-static` directory instead of building. */
  readonly staticDir?: string;
  /** Refresh the visual baselines instead of comparing against them. */
  readonly updateSnapshots?: boolean;
  /** Fail (instead of writing) when a visual baseline is missing. */
  readonly ci?: boolean;
  /** Overall deadline in ms for build + run (default 15 minutes). */
  readonly timeoutMs?: number;
  /** Chromium executable for Playwright (default: the project's Playwright browsers). */
  readonly browserPath?: string;
}

/** What {@link runStorybookTests} returns. */
export interface StorybookRunResult {
  readonly results: StoryResult[];
  readonly warnings: string[];
  readonly project: StorybookProject;
  /** Number of stories listed by the Storybook index. */
  readonly storyCount: number;
}

const WORKSPACE_PARENTS = ['packages', 'apps', 'libs', 'services', 'projects'];

// ---------------------------------------------------------------------------
// 1. detection
// ---------------------------------------------------------------------------

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Find the Storybook project under `workspace`: the workspace itself, or any
 * direct child of `packages/ apps/ libs/ services/ projects/`, that has a
 * `.storybook` directory. The search never walks UP or deeper, so running in an
 * unrelated package does not silently pick up a sibling's Storybook.
 *
 * @returns the project, `null` when none exists
 * @throws {StorybookRunError} when `explicit` is invalid or several projects match
 */
export function detectStorybook(workspace: string, explicit?: string): StorybookProject | null {
  if (explicit !== undefined) {
    const projectDir = path.resolve(workspace, explicit);
    const configDir = path.join(projectDir, '.storybook');
    if (!isDir(configDir)) {
      throw new StorybookRunError(`--storybook ${explicit}: no .storybook directory in ${projectDir}`, { projectDir });
    }
    return { projectDir, configDir };
  }

  const root = path.resolve(workspace);
  const found: StorybookProject[] = [];
  const consider = (dir: string): void => {
    const configDir = path.join(dir, '.storybook');
    if (isDir(configDir)) found.push({ projectDir: dir, configDir });
  };
  consider(root);
  for (const parent of WORKSPACE_PARENTS) {
    const parentDir = path.join(root, parent);
    if (!isDir(parentDir)) continue;
    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        consider(path.join(parentDir, entry.name));
      }
    }
  }
  if (found.length === 0) return null;
  if (found.length > 1) {
    throw new StorybookRunError(
      `multiple Storybook projects found (${found.map((p) => path.relative(root, p.projectDir) || '.').join(', ')}); choose one with --storybook <dir>`,
      { projects: found.map((p) => p.projectDir) }
    );
  }
  return found[0];
}

function binary(project: StorybookProject, name: string): string {
  return path.join(project.projectDir, 'node_modules', '.bin', name);
}

/** Verify the project has the tooling the runner needs, naming what is missing. */
export function assertToolingInstalled(project: StorybookProject, needBuild: boolean): void {
  const missing: string[] = [];
  if (needBuild && !fs.existsSync(binary(project, 'storybook'))) missing.push('storybook');
  if (!fs.existsSync(binary(project, 'test-storybook'))) missing.push('@storybook/test-runner');
  for (const dep of ['axe-playwright', 'jest-image-snapshot']) {
    if (!fs.existsSync(path.join(project.projectDir, 'node_modules', dep))) missing.push(dep);
  }
  if (missing.length > 0) {
    throw new StorybookRunError(
      `UI tests not run: ${missing.join(', ')} not installed in ${project.projectDir}. ` +
        `Add them as devDependencies (e.g. pnpm add -D ${missing.join(' ')}).`,
      { projectDir: project.projectDir, missing }
    );
  }
}

// ---------------------------------------------------------------------------
// 3. static server
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

/** Serve a directory on an ephemeral loopback port. */
export async function serveDirectory(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    let file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// ---------------------------------------------------------------------------
// 4. child processes
// ---------------------------------------------------------------------------

interface ExecResult {
  code: number | null;
  output: string;
}

function exec(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs: number }): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const keep = (chunk: Buffer): void => {
      output = (output + chunk.toString()).slice(-200_000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new StorybookRunError(`${path.basename(command)} timed out after ${options.timeoutMs} ms`, { tail: tail(output) }));
    }, options.timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(new StorybookRunError(`could not start ${path.basename(command)}: ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

function tail(output: string, lines = 25): string {
  // eslint-disable-next-line no-control-regex
  return output.replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(-lines).join('\n');
}

// ---------------------------------------------------------------------------
// 5. collection (pure)
// ---------------------------------------------------------------------------

/** A story entry from Storybook's `index.json`. */
export interface IndexStory {
  readonly id: string;
  readonly title: string;
  readonly name: string;
}

/** Narrow Storybook's `index.json` (v5 `entries`, v3 `stories`) to story entries. */
export function parseStorybookIndex(json: unknown): IndexStory[] {
  const root = json as { entries?: Record<string, unknown>; stories?: Record<string, unknown> } | null;
  const entries = root?.entries ?? root?.stories;
  if (!entries || typeof entries !== 'object') {
    throw new StorybookRunError('Storybook index.json has no "entries": is this a Storybook 7+ build?');
  }
  const stories: IndexStory[] = [];
  for (const value of Object.values(entries)) {
    const entry = value as { id?: unknown; title?: unknown; name?: unknown; type?: unknown };
    if (typeof entry.id !== 'string' || typeof entry.title !== 'string' || typeof entry.name !== 'string') continue;
    if (entry.type !== undefined && entry.type !== 'story') continue; // skip docs entries
    stories.push({ id: entry.id, title: entry.title, name: entry.name });
  }
  return stories;
}

/** The slice of jest's `--json` output the collector reads. */
export interface JestJson {
  testResults?: Array<{
    assertionResults?: Array<{
      ancestorTitles?: string[];
      title?: string;
      status?: string;
      failureMessages?: string[];
    }>;
  }>;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

function firstLines(messages: string[] | undefined, count = 3): string | undefined {
  if (!messages || messages.length === 0) return undefined;
  const text = messages.join('\n').replace(ANSI, '');
  // Prefer the human message ("Message:" block) the runner prints for play failures.
  const marker = text.indexOf('Message:');
  const body = marker >= 0 ? text.slice(marker + 'Message:'.length).trim().split(/\n\s*\n/)[0] : text;
  return body.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, count).join(' ').slice(0, 400);
}

/**
 * Merge jest results (interaction) and the hooks' records (a11y, visual) into
 * `StoryResult[]`, one per story in the Storybook index.
 */
export function collectStoryResults(
  stories: readonly IndexStory[],
  jest: JestJson,
  records: ReadonlyMap<string, UiStoryRecord>
): StoryResult[] {
  const outcomes = new Map<string, { passed: boolean; detail?: string }>();
  for (const file of jest.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      const [title, name] = assertion.ancestorTitles ?? [];
      if (title === undefined || name === undefined) continue;
      const key = `${title}\u0000${name}`;
      const passed = assertion.status === 'passed';
      const previous = outcomes.get(key);
      outcomes.set(key, {
        passed: passed && (previous?.passed ?? true),
        detail: passed ? previous?.detail : previous?.detail ?? firstLines(assertion.failureMessages),
      });
    }
  }

  return stories.map((story): StoryResult => {
    const outcome = outcomes.get(`${story.title}\u0000${story.name}`);
    const record = records.get(story.id);
    const failures: Partial<Record<UiTestKind, string>> = {};

    let interaction = outcome?.passed === true;
    if (!outcome) {
      interaction = false;
      failures.interaction = 'story was not executed by the test runner';
    } else if (!outcome.passed) {
      failures.interaction = outcome.detail ?? 'play function or render failed';
    }

    let a11y = false;
    let visual = false;
    if (record) {
      a11y = record.a11y.length === 0;
      visual = record.visual.length === 0;
      if (!a11y) failures.a11y = record.a11y.slice(0, 3).join(' | ');
      if (!visual) failures.visual = record.visual.slice(0, 3).join(' | ');
    } else {
      // No record means the checks never ran (the story failed first, or the hooks
      // did not load). Missing evidence is a failure, never a pass.
      const why = interaction
        ? 'a11y/visual checks produced no result (test-runner hooks did not run)'
        : 'not evaluated: the story failed before the a11y/visual checks ran';
      failures.a11y = why;
      failures.visual = why;
    }

    return {
      id: story.id,
      title: `${story.title} / ${story.name}`,
      interaction,
      a11y,
      visual,
      ...(Object.keys(failures).length > 0 ? { failures } : {}),
    };
  });
}

function readRecords(dir: string): Map<string, UiStoryRecord> {
  const records = new Map<string, UiStoryRecord>();
  if (!isDir(dir)) return records;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const record = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as UiStoryRecord;
      if (typeof record.id === 'string' && Array.isArray(record.a11y) && Array.isArray(record.visual)) {
        records.set(record.id, record);
      }
    } catch {
      // A truncated record is "no record" and is reported as such.
    }
  }
  return records;
}

// ---------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------

/**
 * Detect, build, serve and test the workspace's Storybook.
 *
 * @throws {StorybookRunError} when no Storybook exists, tooling is missing, the build
 *   or the runner cannot run, or no stories were found
 */
export async function runStorybookTests(options: StorybookRunOptions): Promise<StorybookRunResult> {
  const project = detectStorybook(options.workspace, options.storybook);
  if (!project) {
    throw new StorybookRunError(
      `UI tests not run: no Storybook detected under ${path.resolve(options.workspace)} ` +
        `(looked for .storybook in the workspace and in packages/*, apps/*, libs/*). ` +
        `Pass --storybook <dir> or --url <running storybook>.`
    );
  }

  const timeoutMs = options.timeoutMs ?? 15 * 60_000;
  const needBuild = options.url === undefined && options.staticDir === undefined;
  assertToolingInstalled(project, needBuild);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-ui-test-'));
  // The hooks live inside the project so `axe-playwright` / `jest-image-snapshot`
  // resolve from ITS node_modules (a temp dir elsewhere could not see them).
  const cacheRoot = path.join(project.projectDir, 'node_modules', '.cache', 're-shell');
  fs.mkdirSync(cacheRoot, { recursive: true });
  const hooksDir = fs.mkdtempSync(path.join(cacheRoot, 'ui-test-'));
  const recordsDir = path.join(workDir, 'records');
  const warnings: string[] = [];
  let server: { url: string; close: () => Promise<void> } | undefined;

  try {
    let baseUrl = options.url?.replace(/\/+$/, '');
    if (baseUrl === undefined) {
      let staticDir = options.staticDir ? path.resolve(options.workspace, options.staticDir) : undefined;
      if (staticDir === undefined) {
        staticDir = path.join(workDir, 'storybook-static');
        const build = await exec(binary(project, 'storybook'), ['build', '-o', staticDir, '--quiet'], {
          cwd: project.projectDir,
          timeoutMs,
        });
        if (build.code !== 0) {
          throw new StorybookRunError(`storybook build failed (exit ${build.code})`, { tail: tail(build.output) });
        }
      }
      if (!fs.existsSync(path.join(staticDir, 'index.json'))) {
        throw new StorybookRunError(`${staticDir} has no index.json: not a Storybook 7+ static build`);
      }
      server = await serveDirectory(staticDir);
      baseUrl = server.url;
    }

    let stories: IndexStory[];
    try {
      const response = await fetch(`${baseUrl}/index.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      stories = parseStorybookIndex(await response.json());
    } catch (error) {
      if (error instanceof StorybookRunError) throw error;
      throw new StorybookRunError(`could not read ${baseUrl}/index.json: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (stories.length === 0) {
      throw new StorybookRunError(`${baseUrl}/index.json lists no stories; nothing to test`);
    }

    fs.writeFileSync(path.join(hooksDir, UI_TEST_HOOKS_FILENAME), UI_TEST_HOOKS_SOURCE);
    // The runner insists on a Storybook `main` in its config dir even in index-json
    // mode (where the story list comes from the served index.json instead).
    fs.writeFileSync(path.join(hooksDir, 'main.js'), 'module.exports = { stories: ["./*.stories.js"] };\n');
    const jestOut = path.join(workDir, 'jest.json');
    const snapshotDir = path.join(project.projectDir, '__image_snapshots__');
    const args = [
      '--index-json',
      '--url',
      baseUrl,
      '--config-dir',
      hooksDir,
      '--json',
      '--outputFile',
      jestOut,
      '--browsers',
      'chromium',
      ...(options.updateSnapshots ? ['--updateSnapshot'] : []),
    ];
    const run = await exec(binary(project, 'test-storybook'), args, {
      cwd: project.projectDir,
      timeoutMs,
      env: {
        [UI_TEST_ENV.out]: recordsDir,
        [UI_TEST_ENV.snapshots]: snapshotDir,
        // jest's CI mode (via the CI env var; the runner mishandles a `--ci` flag)
        // makes jest-image-snapshot refuse to write new baselines.
        ...(options.ci ? { CI: 'true' } : {}),
        ...(options.browserPath ? { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: options.browserPath } : {}),
      },
    });

    if (!fs.existsSync(jestOut)) {
      throw new StorybookRunError(
        `the Storybook test runner produced no result (exit ${run.code}); is a Playwright browser installed? ` +
          `Set --browser <chromium> or PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.`,
        { tail: tail(run.output) }
      );
    }
    const jest = JSON.parse(fs.readFileSync(jestOut, 'utf8')) as JestJson;
    const records = readRecords(recordsDir);
    const results = collectStoryResults(stories, jest, records);

    let created = 0;
    for (const record of records.values()) created += record.createdBaselines ?? 0;
    if (created > 0) {
      warnings.push(
        `${created} new visual baseline(s) written to ${path.relative(options.workspace, snapshotDir) || '__image_snapshots__'}; ` +
          `commit them (re-run with --ci to fail on missing baselines).`
      );
    }
    return { results, warnings, project, storyCount: stories.length };
  } finally {
    await server?.close();
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(hooksDir, { recursive: true, force: true });
  }
}
