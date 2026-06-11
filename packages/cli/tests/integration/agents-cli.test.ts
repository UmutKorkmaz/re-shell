import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  jsonResponseSchema,
  agentsDocResponseSchema,
  agentsCheckResponseSchema,
} from '@re-shell/contracts';

/**
 * Integration conformance for `re-shell agents init|sync|check`.
 *
 * Drives the BUILT CLI (dist/index.js) against a throwaway TEMP fixture
 * workspace and asserts, offline + deterministically:
 *   1. `agents init` writes the root + per-package AGENTS.md and llms.txt with
 *      the REAL build/test/lint commands.
 *   2. `agents check` PASSES (exit 0) immediately after init.
 *   3. `agents check` FAILS (non-zero) after a package script changes (drift),
 *      and names the drifted file.
 *   4. `--json` output validates against the contract schemas.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const MAX_BUFFER = 16 * 1024 * 1024;

interface RunResult {
  stdout: string;
  status: number;
}

/** Spawn the built CLI in `cwd`, capturing stdout; never throws on non-zero. */
function runCli(args: string[], cwd: string): RunResult {
  const outFile = path.join(
    os.tmpdir(),
    `rs-agents-${process.pid}-${Math.random().toString(36).slice(2)}.out`
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

let root = '';

/** Build a minimal pnpm-style fixture workspace in a temp dir. */
function makeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-agents-ws-'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture-monorepo',
        description: 'A fixture workspace.',
        scripts: { build: 'pnpm -r build', test: 'pnpm -r test', lint: 'pnpm -r lint' },
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(dir, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/*'\n"
  );
  // A lockfile so package-manager detection resolves to pnpm deterministically.
  fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
  const mkPkg = (name: string, scripts: Record<string, string>, deps?: Record<string, string>) => {
    const pdir = path.join(dir, 'packages', name);
    fs.mkdirSync(pdir, { recursive: true });
    fs.writeFileSync(
      path.join(pdir, 'package.json'),
      JSON.stringify({ name: `@fixture/${name}`, scripts, ...(deps ? { dependencies: deps } : {}) }, null, 2)
    );
  };
  mkPkg('contracts', { build: 'tsc', test: 'vitest run' });
  mkPkg(
    'app',
    { build: 'tsc', test: 'vitest run', lint: 'eslint src' },
    { '@fixture/contracts': 'workspace:*' }
  );
  return dir;
}

beforeEach(() => {
  root = makeFixture();
});

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe('agents init', () => {
  it('writes root + per-package AGENTS.md and llms.txt with real commands', () => {
    const res = runCli(['agents', 'init'], root);
    expect(res.status).toBe(0);

    const rootDoc = path.join(root, 'AGENTS.md');
    const appDoc = path.join(root, 'packages/app/AGENTS.md');
    const contractsDoc = path.join(root, 'packages/contracts/AGENTS.md');
    const index = path.join(root, 'llms.txt');

    expect(fs.existsSync(rootDoc)).toBe(true);
    expect(fs.existsSync(appDoc)).toBe(true);
    expect(fs.existsSync(contractsDoc)).toBe(true);
    expect(fs.existsSync(index)).toBe(true);

    const rootText = fs.readFileSync(rootDoc, 'utf8');
    expect(rootText).toContain('fixture-monorepo');
    expect(rootText).toContain('`pnpm run build`');
    expect(rootText).toContain('## Do not touch');

    const appText = fs.readFileSync(appDoc, 'utf8');
    expect(appText).toContain('`pnpm --filter @fixture/app run build`');
    expect(appText).toContain('@fixture/contracts');
  });

  it('--json validates against agentsDocResponse and reports written files', () => {
    const res = runCli(['agents', 'init', '--json'], root);
    expect(res.status).toBe(0);
    const parsed = jsonResponseSchema(agentsDocResponseSchema).safeParse(
      JSON.parse(res.stdout.trim())
    );
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.ok) {
      expect(parsed.data.data.written).toBe(true);
      // root + 2 packages + index = 4
      expect(parsed.data.data.files).toHaveLength(4);
    }
  });
});

describe('agents check', () => {
  it('passes (exit 0) right after init', () => {
    expect(runCli(['agents', 'init'], root).status).toBe(0);
    const res = runCli(['agents', 'check'], root);
    expect(res.status).toBe(0);
  });

  it('--json check after init validates and reports no drift', () => {
    runCli(['agents', 'init'], root);
    const res = runCli(['agents', 'check', '--json'], root);
    expect(res.status).toBe(0);
    const parsed = jsonResponseSchema(agentsCheckResponseSchema).safeParse(
      JSON.parse(res.stdout.trim())
    );
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.ok) {
      expect(parsed.data.data.drift).toBe(false);
      expect(parsed.data.data.files).toHaveLength(0);
    }
  });

  it('FAILS (non-zero) after a package script changes (drift)', () => {
    runCli(['agents', 'init'], root);

    // Mutate a package script → generated content changes → on-disk goes stale.
    const appPkgPath = path.join(root, 'packages/app/package.json');
    const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
    appPkg.scripts.typecheck = 'tsc --noEmit';
    fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2));

    const res = runCli(['agents', 'check'], root);
    expect(res.status).not.toBe(0);
  });

  it('--json drift after a change reports the stale file and errors', () => {
    runCli(['agents', 'init'], root);

    const appPkgPath = path.join(root, 'packages/app/package.json');
    const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
    appPkg.scripts.typecheck = 'tsc --noEmit';
    fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2));

    const res = runCli(['agents', 'check', '--json'], root);
    expect(res.status).not.toBe(0);
    const json = JSON.parse(res.stdout.trim());
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('AGENTS_ERROR');
    expect(json.error.details.drift).toBe(true);
    const staleApp = (json.error.details.files as Array<{ path: string }>).some(f =>
      f.path.endsWith('packages/app/AGENTS.md')
    );
    expect(staleApp).toBe(true);
  });

  it('FAILS when a doc file is missing', () => {
    runCli(['agents', 'init'], root);
    fs.rmSync(path.join(root, 'llms.txt'), { force: true });
    const res = runCli(['agents', 'check'], root);
    expect(res.status).not.toBe(0);
  });
});

describe('agents sync', () => {
  it('is idempotent: re-running produces no drift', () => {
    runCli(['agents', 'init'], root);
    expect(runCli(['agents', 'sync'], root).status).toBe(0);
    expect(runCli(['agents', 'check'], root).status).toBe(0);
  });

  it('repairs drift so a subsequent check passes', () => {
    runCli(['agents', 'init'], root);
    const appPkgPath = path.join(root, 'packages/app/package.json');
    const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
    appPkg.scripts.typecheck = 'tsc --noEmit';
    fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2));

    expect(runCli(['agents', 'check'], root).status).not.toBe(0);
    expect(runCli(['agents', 'sync'], root).status).toBe(0);
    expect(runCli(['agents', 'check'], root).status).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fix 1 – root-dir collision: a glob that resolves to "." must not overwrite
//         the root AGENTS.md with a per-package doc.
// ---------------------------------------------------------------------------

describe('agents init – root-dir collision guard (Fix 1)', () => {
  let collisionRoot = '';

  beforeEach(() => {
    // Build a workspace whose pnpm-workspace.yaml includes "." so that fast-glob
    // would find the root package.json and — without the fix — try to emit a
    // per-package AGENTS.md at path "AGENTS.md", colliding with the root doc.
    collisionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-fix1-collision-'));
    fs.writeFileSync(
      path.join(collisionRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'collision-workspace',
          description: 'A workspace that globs itself.',
          scripts: { build: 'pnpm -r build', test: 'pnpm -r test' },
        },
        null,
        2
      )
    );
    fs.writeFileSync(path.join(collisionRoot, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n");
    // Include '.' in the workspace glob — the root itself — to trigger the collision.
    fs.writeFileSync(
      path.join(collisionRoot, 'pnpm-workspace.yaml'),
      "packages:\n  - '.'\n  - 'packages/*'\n"
    );
    // A normal sub-package to ensure per-package docs are still generated.
    const pkgDir = path.join(collisionRoot, 'packages', 'core');
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify(
        { name: '@collision/core', scripts: { build: 'tsc', test: 'vitest run' } },
        null,
        2
      )
    );
  });

  afterEach(() => {
    if (collisionRoot) fs.rmSync(collisionRoot, { recursive: true, force: true });
  });

  it('init exits 0 and root AGENTS.md is the ROOT doc, not overwritten by per-package', () => {
    const res = runCli(['agents', 'init'], collisionRoot);
    expect(res.status).toBe(0);

    const rootDoc = path.join(collisionRoot, 'AGENTS.md');
    expect(fs.existsSync(rootDoc)).toBe(true);

    const content = fs.readFileSync(rootDoc, 'utf8');
    // The root doc contains '## Project overview'; a per-package doc would
    // contain '# AGENTS.md — <name>' without the project overview section.
    expect(content).toContain('## Project overview');
    expect(content).toContain('collision-workspace');
  });

  it('check passes immediately after init (no collision-induced drift)', () => {
    runCli(['agents', 'init'], collisionRoot);
    const res = runCli(['agents', 'check'], collisionRoot);
    expect(res.status).toBe(0);
  });
});
