import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { jsonResponseSchema, releaseResponseSchema } from '@re-shell/contracts';

/**
 * Integration conformance for `re-shell release`, driving the BUILT CLI
 * (dist/index.js) inside a throwaway REAL git repo. Everything here is OFFLINE
 * and deterministic — NO network, NO registry publish is exercised.
 *
 *   - default (dry-run) plan bumps the changed package AND its dependent, writes
 *     nothing to disk, and reports every unit published:false.
 *   - `--no-dry-run --bump minor` writes bumped versions, a CHANGELOG, and
 *     creates annotated tags.
 *   - a non-git directory is a hard RELEASE_ERROR.
 *   - an invalid `--bump` is a RELEASE_ERROR.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 16 * 1024 * 1024;

interface RunResult {
  stdout: string;
  status: number;
}

/** Spawn the built CLI in `cwd`, capturing stdout via a temp file (no pipe). */
function runCli(args: string[], cwd: string): RunResult {
  const outFile = path.join(
    os.tmpdir(),
    `rs-rel-${process.pid}-${Math.random().toString(36).slice(2)}.out`
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
  expect(
    lines.length,
    `expected exactly one stdout line, got ${lines.length}: ${stdout}`
  ).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

/** Run git with an argv array in `cwd` (no shell). */
function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
}

/**
 * Build a real temp git repo with two internal-dep packages (pkg-b depends on
 * pkg-a), an initial commit, a v0.0.0 tag, then a change + commit to pkg-a.
 */
function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-rel-repo-'));

  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      { name: 'fixture-root', private: true, workspaces: ['packages/*'] },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(
    path.join(root, 'pnpm-workspace.yaml'),
    'packages:\n  - "packages/*"\n'
  );

  const pkgA = path.join(root, 'packages', 'pkg-a');
  const pkgB = path.join(root, 'packages', 'pkg-b');
  fs.mkdirSync(pkgA, { recursive: true });
  fs.mkdirSync(pkgB, { recursive: true });

  fs.writeFileSync(
    path.join(pkgA, 'package.json'),
    JSON.stringify({ name: 'pkg-a', version: '0.0.0' }, null, 2) + '\n'
  );
  fs.writeFileSync(path.join(pkgA, 'index.js'), 'module.exports = 1;\n');

  fs.writeFileSync(
    path.join(pkgB, 'package.json'),
    JSON.stringify(
      { name: 'pkg-b', version: '0.0.0', dependencies: { 'pkg-a': '^0.0.0' } },
      null,
      2
    ) + '\n'
  );
  fs.writeFileSync(path.join(pkgB, 'index.js'), 'module.exports = 2;\n');

  git(['init'], root);
  git(['config', 'user.email', 'release-bot@example.com'], root);
  git(['config', 'user.name', 'Release Bot'], root);
  git(['add', '-A'], root);
  git(['commit', '-m', 'chore: initial'], root);
  git(['tag', 'v0.0.0'], root);

  // Change pkg-a and commit, so it is the only "changed" package since v0.0.0.
  fs.writeFileSync(path.join(pkgA, 'index.js'), 'module.exports = 42;\n');
  git(['add', '-A'], root);
  git(['commit', '-m', 'feat: bump pkg-a behavior'], root);

  return root;
}

describe('release (built CLI): dry-run safety, apply, errors', () => {
  beforeAll(() => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  it('--json (default dry-run) bumps changed + dependent, writes nothing', () => {
    const root = makeRepo();
    try {
      const before = fs.readFileSync(
        path.join(root, 'packages', 'pkg-a', 'package.json'),
        'utf8'
      );

      const { stdout, status } = runCli(['release', '--json'], root);
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);

      const parsed = jsonResponseSchema(releaseResponseSchema).safeParse(env);
      expect(
        parsed.success,
        JSON.stringify(
          (parsed as { error?: { issues?: unknown[] } }).error?.issues?.[0]
        )
      ).toBe(true);

      const data = (env as { data: z.infer<typeof releaseResponseSchema> }).data;
      expect(data.dryRun).toBe(true);
      const byName = new Map(data.units.map(u => [u.name, u]));
      expect(byName.get('pkg-a')?.reason).toBe('changed');
      expect(byName.get('pkg-b')?.reason).toBe('dependent');
      expect(byName.get('pkg-b')?.bumpLevel).toBe('patch');
      expect(data.units.every(u => u.published === false)).toBe(true);

      // The manifest on disk must be UNCHANGED in dry-run.
      const after = fs.readFileSync(
        path.join(root, 'packages', 'pkg-a', 'package.json'),
        'utf8'
      );
      expect(after).toBe(before);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--no-dry-run --bump minor writes versions, CHANGELOG, and tags', () => {
    const root = makeRepo();
    try {
      const { stdout, status } = runCli(
        ['release', '--json', '--no-dry-run', '--bump', 'minor'],
        root
      );
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);
      const data = (env as { data: z.infer<typeof releaseResponseSchema> }).data;
      expect(data.dryRun).toBe(false);

      // pkg-a bumped minor on disk; pkg-b patched on disk.
      const aJson = JSON.parse(
        fs.readFileSync(path.join(root, 'packages', 'pkg-a', 'package.json'), 'utf8')
      ) as { version: string };
      const bJson = JSON.parse(
        fs.readFileSync(path.join(root, 'packages', 'pkg-b', 'package.json'), 'utf8')
      ) as { version: string };
      expect(aJson.version).toBe('0.1.0');
      expect(bJson.version).toBe('0.0.1');

      // CHANGELOG written for pkg-a.
      expect(
        fs.existsSync(path.join(root, 'packages', 'pkg-a', 'CHANGELOG.md'))
      ).toBe(true);

      // Annotated tags created for both units.
      const tags = git(['tag', '-l'], root).split('\n').filter(Boolean);
      expect(tags).toContain('pkg-a@0.1.0');
      expect(tags).toContain('pkg-b@0.0.1');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a non-git directory is a hard RELEASE_ERROR', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-rel-nogit-'));
    try {
      const { stdout, status } = runCli(['release', '--json'], root);
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'RELEASE_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('an invalid --bump is a RELEASE_ERROR', () => {
    const root = makeRepo();
    try {
      const { stdout, status } = runCli(
        ['release', '--json', '--bump', 'huge'],
        root
      );
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'RELEASE_ERROR'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--no-dry-run --bump minor repins pkg-b dependencies["pkg-a"] to ^0.1.0', () => {
    const root = makeRepo();
    try {
      const { status } = runCli(
        ['release', '--json', '--no-dry-run', '--bump', 'minor'],
        root
      );
      expect(status).toBe(0);

      const bJson = JSON.parse(
        fs.readFileSync(path.join(root, 'packages', 'pkg-b', 'package.json'), 'utf8')
      ) as { version: string; dependencies: Record<string, string> };

      // pkg-a was bumped to 0.1.0 (minor), so pkg-b's dep must be repinned.
      expect(bJson.dependencies['pkg-a']).toBe('^0.1.0');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--filter does-not-exist exits 0 and warns about the unknown name', () => {
    const root = makeRepo();
    try {
      const { stdout, status } = runCli(
        ['release', '--json', '--filter', 'does-not-exist'],
        root
      );
      expect(status).toBe(0);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(true);
      const warnings = (env as { data: { warnings: string[] } }).data.warnings;
      expect(
        warnings.some(w => /does-not-exist/.test(w)),
        `expected a warning mentioning "does-not-exist", got: ${JSON.stringify(warnings)}`
      ).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('--since -bad is a RELEASE_ERROR (cannot start with -)', () => {
    const root = makeRepo();
    try {
      const { stdout, status } = runCli(
        ['release', '--json', '--since', '-bad'],
        root
      );
      expect(status).toBe(1);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect((env as { error: { code: string } }).error.code).toBe(
        'RELEASE_ERROR'
      );
      expect((env as { error: { message: string } }).error.message).toMatch(
        /invalid --since ref/i
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
