import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  cacheStatsResponseSchema,
  cacheCleanResponseSchema,
  jsonResponseSchema,
} from '@re-shell/contracts';

/**
 * Integration conformance for `re-shell cache stats|clean`, driving the BUILT
 * CLI in a throwaway workspace. Fully offline + deterministic:
 *
 *   - A single package `a` with a `build` script that writes `dist/out.js`.
 *   - `run build` (with the workspace-local cache) populates the cache.
 *   - `cache stats --json` reports >= 1 entry; `cache clean --json` prunes it;
 *     a follow-up `cache stats --json` reports 0 entries.
 *
 * The cache dir is the workspace-local `.re-shell/cache`, so nothing leaks into
 * the developer's home directory and no network is touched.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 16 * 1024 * 1024;

function runCli(args: string[], cwd: string): { stdout: string; status: number } {
  const outFile = path.join(
    os.tmpdir(),
    `rs-cache-${process.pid}-${Math.random().toString(36).slice(2)}.out`
  );
  const fd = fs.openSync(outFile, 'w');
  let status = 0;
  try {
    execFileSync('node', [CLI_PATH, ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', fd, 'ignore'],
      env: { ...process.env },
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

function parseSingleLine(stdout: string): Record<string, unknown> {
  const lines = stdout.split('\n').filter(l => l.length > 0);
  expect(lines.length, `expected one JSON line, got: ${stdout}`).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-cache-ws-'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fixture-root', private: true }, null, 2)
  );
  fs.writeFileSync(path.join(root, 'package-lock.json'), '');

  const pkg = path.join(root, 'packages', 'a');
  fs.mkdirSync(path.join(pkg, 'src'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'src', 'index.ts'), 'export const x = 1;');
  // The build script writes a deterministic output artifact.
  fs.writeFileSync(
    path.join(pkg, 'build.cjs'),
    'const fs=require("fs");const p=require("path");' +
      'fs.mkdirSync(p.join(__dirname,"dist"),{recursive:true});' +
      'fs.writeFileSync(p.join(__dirname,"dist","out.js"),"compiled");\n'
  );
  fs.writeFileSync(
    path.join(pkg, 'package.json'),
    JSON.stringify(
      { name: 'a', scripts: { build: 'node build.cjs' } },
      null,
      2
    )
  );

  fs.writeFileSync(
    path.join(root, 're-shell.workspaces.yaml'),
    'tasks:\n  build:\n    inputs: ["src/**", "package.json"]\n    outputs: ["dist/**"]\n'
  );
  return root;
}

describe('cache stats|clean (built CLI)', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  it('run build populates the cache; stats reports it; clean prunes it', () => {
    const root = makeWorkspace();
    try {
      const build = runCli(['run', 'build'], root);
      expect(build.status).toBe(0);

      // stats: at least one entry, valid envelope.
      const statsRes = runCli(['cache', 'stats', '--json'], root);
      expect(statsRes.status).toBe(0);
      const statsEnv = parseSingleLine(statsRes.stdout);
      expect(statsEnv.ok).toBe(true);
      const statsParsed = jsonResponseSchema(cacheStatsResponseSchema).safeParse(
        statsEnv
      );
      expect(statsParsed.success).toBe(true);
      const stats = (statsEnv as { data: { entries: number; sizeBytes: number } })
        .data;
      expect(stats.entries).toBeGreaterThanOrEqual(1);
      expect(stats.sizeBytes).toBeGreaterThan(0);

      // clean: removes the entries, valid envelope.
      const cleanRes = runCli(['cache', 'clean', '--json'], root);
      expect(cleanRes.status).toBe(0);
      const cleanEnv = parseSingleLine(cleanRes.stdout);
      expect(cleanEnv.ok).toBe(true);
      const cleanParsed = jsonResponseSchema(cacheCleanResponseSchema).safeParse(
        cleanEnv
      );
      expect(cleanParsed.success).toBe(true);
      expect(
        (cleanEnv as { data: { removedEntries: number } }).data.removedEntries
      ).toBeGreaterThanOrEqual(1);

      // stats after clean: zero entries.
      const afterRes = runCli(['cache', 'stats', '--json'], root);
      const afterEnv = parseSingleLine(afterRes.stdout);
      expect((afterEnv as { data: { entries: number } }).data.entries).toBe(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a second run build reports the task as cached (no rebuild)', () => {
    const root = makeWorkspace();
    try {
      expect(runCli(['run', 'build'], root).status).toBe(0);
      const second = runCli(['run', 'build', '--json'], root);
      expect(second.status).toBe(0);
      const env = parseSingleLine(second.stdout);
      const data = (env as { data: { results: { package: string; status: string }[] } })
        .data;
      const a = data.results.find(r => r.package === 'a');
      expect(a?.status).toBe('cached');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
