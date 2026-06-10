import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  aiPlanResponseSchema,
  scaffoldPlanSchema,
} from '@re-shell/contracts';

/**
 * Integration conformance for `re-shell ai create`.
 *
 * Drives the BUILT CLI (dist/index.js) exactly as a consumer would and asserts:
 *   1. `--json` emits the single-line `{ ok, data }` envelope and the `data`
 *      validates against `jsonResponseSchema(aiPlanResponseSchema)`.
 *   2. The plan references ONLY real templates/commands (allowed heads + flags).
 *   3. The DEFAULT (no `--yes`) path is a pure dry-run: run inside a fresh temp
 *      directory and prove the filesystem is byte-for-byte unchanged afterward.
 *   4. An unresolvable description emits `{ ok:false }` AI_INTENT_ERROR + non-0.
 *
 * No `--yes` is ever passed here, so nothing is ever executed/written.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 16 * 1024 * 1024;

interface RunResult {
  stdout: string;
  status: number;
}

/** Spawn the built CLI, capturing stdout to a file (never throws on non-zero). */
function runCli(args: string[], cwd: string): RunResult {
  const outFile = path.join(
    os.tmpdir(),
    `rs-aicreate-${process.pid}-${Math.random().toString(36).slice(2)}.json`
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

/** Recursive, deterministic snapshot of a directory tree: relpath -> content. */
function snapshotDir(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs);
      if (entry.isDirectory()) {
        out[`${rel}/`] = '<dir>';
        walk(abs);
      } else {
        out[rel] = fs.readFileSync(abs, 'utf8');
      }
    }
  };
  walk(root);
  return out;
}

const ACCEPTANCE = 'a react shell + fastapi auth service + postgres, on k8s';

describe('ai create (built CLI): --json conformance + dry-run safety', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  it('emits the envelope + aiPlanResponse shape and references only real ids', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-aicreate-json-'));
    try {
      const { stdout, status } = runCli(['ai', 'create', ACCEPTANCE, '--json'], tmpDir);
      expect(status).toBe(0);

      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);

      const parsed = jsonResponseSchema(aiPlanResponseSchema).safeParse(env);
      expect(parsed.success, JSON.stringify((parsed as { error?: { issues?: unknown[] } }).error?.issues?.[0])).toBe(true);

      const data = (env as { data: { plan: z.infer<typeof scaffoldPlanSchema> } }).data;
      const { plan } = data;

      // Dry-run by default: the plan is never marked applied and no step ran.
      expect(plan.applied).toBe(false);
      expect(plan.steps.every(s => s.applied === false)).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);

      // Only real command heads + catalogue flags appear.
      const allowedHeads = new Set(['create', 'generate', 'k8s']);
      for (const step of plan.steps) {
        expect(allowedHeads.has(step.command[0])).toBe(true);
        for (const flag of step.command.filter(t => t.startsWith('--'))) {
          expect(['--template', '--framework']).toContain(flag);
        }
      }
      // The resolved ids are the real templates the description named.
      expect(plan.resolved).toEqual(expect.arrayContaining(['react', 'fastapi', 'postgres-config']));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes NOTHING in a temp dir without --yes (filesystem byte-for-byte unchanged)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-aicreate-fs-'));
    // Seed a marker file so the snapshot is non-trivial and we'd detect deletion too.
    fs.writeFileSync(path.join(tmpDir, 'marker.txt'), 'untouched');
    try {
      const before = snapshotDir(tmpDir);

      // Default path: no --yes. Run both human and --json variants.
      const human = runCli(['ai', 'create', ACCEPTANCE], tmpDir);
      expect(human.status).toBe(0);
      const json = runCli(['ai', 'create', ACCEPTANCE, '--json'], tmpDir);
      expect(json.status).toBe(0);

      const after = snapshotDir(tmpDir);
      expect(after).toEqual(before);
      // Marker still present and intact.
      expect(fs.readFileSync(path.join(tmpDir, 'marker.txt'), 'utf8')).toBe('untouched');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('emits {ok:false} AI_INTENT_ERROR + non-zero exit for an unresolvable description', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-aicreate-err-'));
    try {
      const { stdout, status } = runCli(
        ['ai', 'create', 'the quick brown fox', '--json'],
        tmpDir
      );
      expect(status).not.toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      const parsed = jsonResponseSchema(z.unknown()).safeParse(env);
      expect(parsed.success).toBe(true);
      expect((env as { error: { code: string } }).error.code).toBe('AI_INTENT_ERROR');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
