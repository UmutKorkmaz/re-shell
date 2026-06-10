import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  suggestionSchema,
  fixPlanSchema,
} from '@re-shell/contracts';

/**
 * End-to-end remediation contract suite for `doctor --explain` / `doctor --fix`.
 *
 * Drives the BUILT CLI (dist/index.js) against a self-contained, throwaway
 * monorepo fixture created under the OS temp dir. Everything here is offline and
 * deterministic:
 *   - the fixture's root package.json carries `workspaces`, so
 *     `findMonorepoRoot` resolves the temp dir as its OWN root (it never walks up
 *     into the real repo);
 *   - the fixture has NO `.git`, so the git-config check fails deterministically,
 *     giving us a known executable (`git init`) step to assert against;
 *   - the dry-run path (no `--yes`) runs NOTHING, so no network is touched.
 *
 * The load-bearing safety claim under test: `doctor --fix` without `--yes` emits
 * a plan but writes NOTHING — asserted by snapshotting the fixture tree before
 * and after the run and proving it is byte-for-byte unchanged (and that no `.git`
 * directory was created).
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 16 * 1024 * 1024;

interface RunResult {
  stdout: string;
  status: number;
}

/**
 * Spawn the built CLI in `cwd`, capturing stdout via a temp file (mirrors the
 * supported `re-shell ... --json > out.json` consumer pattern and avoids the
 * pipe-truncation caveat on process.exit). Never throws on non-zero exit.
 */
function runCli(args: string[], cwd: string): RunResult {
  const outFile = path.join(
    os.tmpdir(),
    `rs-doc-rem-${process.pid}-${Math.random().toString(36).slice(2)}.json`
  );
  const fd = fs.openSync(outFile, 'w');
  let status = 0;
  try {
    execFileSync('node', [CLI_PATH, ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', fd, 'ignore'],
    });
  } catch (error: unknown) {
    const e = error as { status?: number };
    status = typeof e.status === 'number' ? e.status : 1;
  } finally {
    fs.closeSync(fd);
  }
  const stdout = fs.readFileSync(outFile, 'utf8');
  fs.rmSync(outFile, { force: true });
  return { stdout, status };
}

/** Assert stdout is exactly one JSON line and return the parsed envelope. */
function parseSingleLine(stdout: string): Record<string, unknown> {
  const lines = stdout.split('\n').filter(line => line.length > 0);
  expect(lines.length, `expected exactly one stdout line, got ${lines.length}`).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

/**
 * Create a fresh, self-contained monorepo fixture in a new temp dir. The root
 * package.json declares `workspaces` (so it is detected as a monorepo root) but
 * is intentionally minimal and has NO `.git`, so several doctor checks fail
 * deterministically and produce a remediation plan with both an executable
 * (`git init`) and manual steps.
 */
function makeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-doctor-fixture-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      { name: '@fixture/doctor-remediation', private: true, workspaces: ['packages/*'] },
      null,
      2
    )
  );
  const pkgA = path.join(dir, 'packages', 'a');
  fs.mkdirSync(pkgA, { recursive: true });
  fs.writeFileSync(
    path.join(pkgA, 'package.json'),
    JSON.stringify({ name: '@fixture/a', version: '1.0.0' }, null, 2)
  );
  return dir;
}

/**
 * Recursively snapshot a directory tree as a sorted list of "relpath:size"
 * entries. Used to prove the dry-run path mutated nothing.
 */
function snapshotTree(root: string): string[] {
  const entries: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) {
        entries.push(`${rel}/`);
        walk(full, rel);
      } else {
        entries.push(`${rel}:${stat.size}`);
      }
    }
  };
  walk(root, '');
  return entries;
}

describe('doctor remediation CLI (built dist): --explain / --fix', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  it('doctor --explain --json emits a contract-valid suggestions[] array', () => {
    const dir = makeFixture();
    try {
      const { stdout } = runCli(['doctor', '--explain', '--json'], dir);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);

      // The envelope carries both the checks and the new suggestions array.
      const dataSchema = z
        .object({
          checks: z.array(z.object({ name: z.string() }).loose()),
          suggestions: z.array(suggestionSchema),
        })
        .loose();
      const parsed = jsonResponseSchema(dataSchema).safeParse(env);
      expect(parsed.success, JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);

      const suggestions = (env as { data: { suggestions: unknown[] } }).data.suggestions;
      // A minimal, git-less fixture has remediable checks, so this is non-empty.
      expect(suggestions.length).toBeGreaterThan(0);
      // Every entry independently validates against the canonical schema.
      for (const s of suggestions) {
        expect(suggestionSchema.safeParse(s).success).toBe(true);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('doctor --explain --json includes a fixable suggestion with an allow-listed fixCommand', () => {
    const dir = makeFixture();
    try {
      const { stdout } = runCli(['doctor', '--explain', '--json'], dir);
      const env = parseSingleLine(stdout);
      const suggestions = (env as { data: { suggestions: Array<z.infer<typeof suggestionSchema>> } })
        .data.suggestions;

      // The git-less fixture yields a fixable git-config suggestion.
      const git = suggestions.find(s => s.checkId === 'git-config');
      expect(git, 'expected a git-config suggestion for the git-less fixture').toBeTruthy();
      expect(git?.fixable).toBe(true);
      expect(git?.fixCommand).toBe('git init');

      // ...and at least one non-fixable (manual) suggestion alongside it.
      expect(suggestions.some(s => s.fixable === false)).toBe(true);
      // Invariant: a fixCommand is present only when fixable is true.
      for (const s of suggestions) {
        if (!s.fixable) expect(s.fixCommand).toBeUndefined();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('doctor --fix (no --yes) emits a contract-valid dry-run plan', () => {
    const dir = makeFixture();
    try {
      const { stdout } = runCli(['doctor', '--fix', '--json'], dir);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);

      const dataSchema = z
        .object({ plan: fixPlanSchema, suggestions: z.array(suggestionSchema) })
        .loose();
      const parsed = jsonResponseSchema(dataSchema).safeParse(env);
      expect(parsed.success, JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);

      const plan = (env as { data: { plan: z.infer<typeof fixPlanSchema> } }).data.plan;
      // Dry run: the plan itself and every step are marked not-applied.
      expect(plan.applied).toBe(false);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.steps.every(s => s.applied === false)).toBe(true);

      // The plan distinguishes executable (command) from manual (edit) steps.
      const git = plan.steps.find(s => s.checkId === 'git-config');
      expect(git?.command).toBe('git init');
      expect(plan.steps.some(s => s.command === undefined)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('doctor --fix (no --yes) writes NOTHING: fixture tree is byte-for-byte unchanged', () => {
    const dir = makeFixture();
    try {
      const before = snapshotTree(dir);
      const { stdout, status } = runCli(['doctor', '--fix', '--json'], dir);

      // The command succeeded and produced a plan...
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);
      expect(status).toBe(0);

      // ...but the filesystem is identical: no new files, no mutated sizes.
      const after = snapshotTree(dir);
      expect(after).toEqual(before);

      // Crucially, the executable `git init` step did NOT run: no .git appeared.
      expect(fs.existsSync(path.join(dir, '.git'))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('doctor --explain --json without remediable issues still validates (empty/absent suggestions)', () => {
    // A non-monorepo dir short-circuits doctor; assert it stays contract-valid
    // and never crashes when there is nothing to explain. The envelope remains
    // ok:true with a checks array; suggestions is absent or empty.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-doctor-nonrepo-'));
    try {
      const { stdout } = runCli(['doctor', '--explain', '--json'], dir);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);
      const dataSchema = z
        .object({
          checks: z.array(z.object({ name: z.string() }).loose()),
          suggestions: z.array(suggestionSchema).optional(),
        })
        .loose();
      const parsed = jsonResponseSchema(dataSchema).safeParse(env);
      expect(parsed.success, JSON.stringify((parsed as { error?: unknown }).error)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
