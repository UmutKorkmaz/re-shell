import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runRealFixCi } from '../../src/fix-ci/loop';
import { openPullRequestWithGh } from '../../src/fix-ci/pr';
import { FAST_GATES, TYPE_ERROR_FIX_PATCH, createFixture, fakeProvider, git, type Fixture } from '../utils/fix-ci-fixture';

/**
 * PR flow: --no-dry-run pushes ONLY the new fix branch and opens a PR through
 * `gh`. A real bare repository plays the remote; `gh` is a real executable
 * (a shell script) on PATH so the real child-process path is exercised.
 */

const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();

let fx: Fixture | undefined;
let scratch: string;
const savedEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined): void {
  if (!(key in savedEnv)) savedEnv[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/** A bin dir holding git (always) and, optionally, a fake gh. */
function makeBin(withGh: boolean): string {
  const bin = fs.mkdtempSync(path.join(scratch, 'bin-'));
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nexec ${REAL_GIT} "$@"\n`, { mode: 0o755 });
  if (withGh) {
    const script = [
      '#!/bin/sh',
      'echo "$@" >> "$GH_LOG"',
      'case "$1 $2" in',
      '  "auth status") exit ${GH_AUTH_EXIT:-0} ;;',
      '  "pr create") echo "https://github.com/acme/fixture/pull/42"; exit 0 ;;',
      'esac',
      'exit 1',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(bin, 'gh'), script, { mode: 0o755 });
  }
  return bin;
}

function withRemote(dir: string): string {
  const bare = fs.mkdtempSync(path.join(scratch, 'remote-')) + '/origin.git';
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', bare]);
  git(dir, 'remote', 'add', 'origin', bare);
  git(dir, 'push', '-q', '-u', 'origin', 'main');
  return bare;
}

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-ci-pr-'));
  setEnv('GH_LOG', path.join(scratch, 'gh.log'));
  setEnv('GH_AUTH_EXIT', undefined);
});

afterEach(() => {
  fx?.cleanup();
  fx = undefined;
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  fs.rmSync(scratch, { recursive: true, force: true });
});

const provider = () => fakeProvider(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'pass a number' }));

describe('fix --ci --no-dry-run PR flow', () => {
  it('pushes only the fix branch and opens a PR via gh; never touches the base branch', async () => {
    fx = createFixture({ ...FAST_GATES });
    const bare = withRemote(fx.dir);
    const mainBefore = git(bare, 'rev-parse', 'main');
    setEnv('PATH', `${makeBin(true)}${path.delimiter}${process.env.PATH}`);

    const res = await runRealFixCi({ cwd: fx.dir, dryRun: false, provider: provider() });

    expect(res.verdict).toBe('green');
    expect(res.prOpened).toBe(true);
    expect(res.prUrl).toBe('https://github.com/acme/fixture/pull/42');
    expect(res.pr).toEqual({ url: 'https://github.com/acme/fixture/pull/42', branch: res.branch, base: 'main' });
    expect(res.manualSteps).toBeUndefined();

    // Remote: the fix branch exists with the fix; main is byte-identical.
    expect(git(bare, 'branch', '--format=%(refname:short)').split('\n').sort()).toEqual(['main', res.branch].sort());
    expect(git(bare, 'rev-parse', 'main')).toBe(mainBefore);
    expect(git(bare, 'show', `${res.branch}:src/index.ts`)).toContain('add(1, 2)');
    // gh was asked for a PR from the fix branch into main, and never to merge.
    const log = fs.readFileSync(path.join(scratch, 'gh.log'), 'utf8');
    expect(log).toContain('auth status');
    expect(log).toMatch(new RegExp(`pr create --base main --head ${res.branch!.replace(/[/]/g, '\\/')} --title`));
    expect(log).not.toMatch(/^pr merge/m);
    // Local checkout is back on the starting branch, clean.
    expect(git(fx.dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
  }, 120_000);

  it('dry-run (default) never pushes or calls gh', async () => {
    fx = createFixture({ ...FAST_GATES });
    const bare = withRemote(fx.dir);
    setEnv('PATH', `${makeBin(true)}${path.delimiter}${process.env.PATH}`);
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: true, provider: provider() });
    expect(res.verdict).toBe('green');
    expect(res.pr).toBeNull();
    expect(res.manualSteps).toBeUndefined();
    expect(git(bare, 'branch', '--format=%(refname:short)')).toBe('main');
    expect(fs.existsSync(path.join(scratch, 'gh.log'))).toBe(false);
  }, 120_000);

  it('gh unauthenticated: prints exact manual steps, pr null, still green, nothing pushed', async () => {
    fx = createFixture({ ...FAST_GATES });
    const bare = withRemote(fx.dir);
    setEnv('PATH', `${makeBin(true)}${path.delimiter}${process.env.PATH}`);
    setEnv('GH_AUTH_EXIT', '1');

    const res = await runRealFixCi({ cwd: fx.dir, dryRun: false, provider: provider() });

    expect(res.verdict).toBe('green');
    expect(res.gatesPassed).toBe(true);
    expect(res.pr).toBeNull();
    expect(res.prOpened).toBe(false);
    expect(res.prUrl).toBe('');
    expect(res.manualSteps![0]).toBe(`git push -u origin ${res.branch}`);
    expect(res.manualSteps![1]).toMatch(/^gh pr create --base main --head re-shell\/fix-ci-/);
    expect(res.warnings.join('\n')).toMatch(/not authenticated/);
    expect(git(bare, 'branch', '--format=%(refname:short)')).toBe('main');
    // The fix itself is safely committed locally.
    expect(git(fx.dir, 'log', '--format=%s', `main..${res.branch}`)).toMatch(/^fix\(ci\)/);
  }, 120_000);

  it('gh missing: manual steps, pr null', async () => {
    fx = createFixture({ ...FAST_GATES });
    withRemote(fx.dir);
    setEnv('PATH', makeBin(false));
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: false, provider: provider() });
    expect(res.verdict).toBe('green');
    expect(res.pr).toBeNull();
    expect(res.warnings.join('\n')).toMatch(/gh CLI not found/);
    expect(res.manualSteps!.length).toBeGreaterThan(0);
  }, 120_000);

  it('no remote: manual steps mention the placeholder remote', async () => {
    fx = createFixture({ ...FAST_GATES });
    setEnv('PATH', `${makeBin(true)}${path.delimiter}${process.env.PATH}`);
    const res = await runRealFixCi({ cwd: fx.dir, dryRun: false, provider: provider() });
    expect(res.verdict).toBe('green');
    expect(res.pr).toBeNull();
    expect(res.warnings.join('\n')).toMatch(/no git remote/);
    expect(res.manualSteps![0]).toMatch(/^git push -u <remote> re-shell\/fix-ci-/);
  }, 120_000);

  it('does not open a PR (and does not push) when gates end red', async () => {
    fx = createFixture({ ...FAST_GATES });
    const bare = withRemote(fx.dir);
    setEnv('PATH', `${makeBin(true)}${path.delimiter}${process.env.PATH}`);
    const res = await runRealFixCi({
      cwd: fx.dir,
      dryRun: false,
      provider: fakeProvider(() => ({ patch: '', explanation: 'cannot fix' })),
    });
    expect(res.verdict).toBe('red');
    expect(res.pr).toBeNull();
    expect(res.manualSteps).toBeUndefined();
    expect(git(bare, 'branch', '--format=%(refname:short)')).toBe('main');
    expect(fs.existsSync(path.join(scratch, 'gh.log'))).toBe(false);
  }, 120_000);

  it('the default opener refuses to push anything but a re-shell/fix-ci-* branch', async () => {
    fx = createFixture();
    withRemote(fx.dir);
    for (const branch of ['main', 'release', 're-shell/other']) {
      const r = await openPullRequestWithGh({ repoRoot: fx.dir, branch, base: 'main', title: 't', body: 'b' });
      expect(r.pr).toBeNull();
      expect(r.manualSteps).toEqual([]);
      expect(r.warnings.join('\n')).toMatch(/refusing to push/);
    }
  });
});
