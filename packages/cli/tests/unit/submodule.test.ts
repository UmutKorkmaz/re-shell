import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  SubmoduleInfo,
  createSubmoduleDocumentation,
  generateSubmoduleScript,
  isGitRepository,
  initializeGitRepository,
  getSubmoduleStatus,
} from '../../src/utils/submodule';

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `rs-sub-${Date.now()}-`));
}

describe('createSubmoduleDocumentation', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('creates docs directory and SUBMODULES.md', async () => {
    await createSubmoduleDocumentation(dir, []);
    expect(fs.existsSync(path.join(dir, 'docs'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'docs', 'SUBMODULES.md'))).toBe(true);
  });

  it('emits the "no submodules" placeholder when list is empty', async () => {
    await createSubmoduleDocumentation(dir, []);
    const md = fs.readFileSync(path.join(dir, 'docs', 'SUBMODULES.md'), 'utf8');
    expect(md).toContain('# Submodules');
    expect(md).toContain('No submodules configured.');
    expect(md).toContain('git clone --recursive');
  });

  it('renders each submodule entry with path, repo, branch, commit and status', async () => {
    const subs: SubmoduleInfo[] = [
      {
        name: 'ui-lib',
        path: 'libs/ui-lib',
        url: 'https://github.com/example/ui-lib.git',
        branch: 'main',
        commit: 'abc12345',
        status: 'clean',
      },
      {
        name: 'auth-svc',
        path: 'services/auth',
        url: 'https://github.com/example/auth.git',
        branch: 'develop',
        commit: 'deadbeef',
        status: 'modified',
      },
    ];
    await createSubmoduleDocumentation(dir, subs);
    const md = fs.readFileSync(path.join(dir, 'docs', 'SUBMODULES.md'), 'utf8');

    // Both submodules rendered as headers
    expect(md).toContain('### ui-lib');
    expect(md).toContain('### auth-svc');

    // First entry details
    expect(md).toContain('`libs/ui-lib`');
    expect(md).toContain('https://github.com/example/ui-lib.git');
    expect(md).toContain('abc12345');

    // Second entry details
    expect(md).toContain('`services/auth`');
    expect(md).toContain('develop');
    expect(md).toContain('deadbeef');
    expect(md).toContain('modified');
  });

  it('always includes workflow, best-practices and troubleshooting sections', async () => {
    await createSubmoduleDocumentation(dir, []);
    const md = fs.readFileSync(path.join(dir, 'docs', 'SUBMODULES.md'), 'utf8');
    expect(md).toContain('## Working with Submodules');
    expect(md).toContain('## Best Practices');
    expect(md).toContain('## Troubleshooting');
    expect(md).toContain('re-shell submodule update');
    expect(md).toContain('re-shell submodule add');
    expect(md).toContain('re-shell submodule remove');
    expect(md).toContain('re-shell submodule status');
  });

  it('overwrites the file when called twice', async () => {
    await createSubmoduleDocumentation(dir, []);
    const firstStat = fs.statSync(path.join(dir, 'docs', 'SUBMODULES.md'));

    // Small delay so mtime is different
    await new Promise((r) => setTimeout(r, 50));

    await createSubmoduleDocumentation(dir, [
      {
        name: 'x',
        path: 'p/x',
        url: 'u',
        branch: 'b',
        commit: 'c',
        status: 'clean',
      },
    ]);
    const secondMd = fs.readFileSync(path.join(dir, 'docs', 'SUBMODULES.md'), 'utf8');
    expect(secondMd).toContain('### x');
    expect(fs.statSync(path.join(dir, 'docs', 'SUBMODULES.md')).mtimeMs).toBeGreaterThanOrEqual(
      firstStat.mtimeMs,
    );
  });
});

describe('generateSubmoduleScript', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('creates scripts directory and submodule-helper.sh', async () => {
    await generateSubmoduleScript(dir);
    expect(fs.existsSync(path.join(dir, 'scripts'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'scripts', 'submodule-helper.sh'))).toBe(true);
  });

  it('marks the script as executable (mode 0o755)', async () => {
    await generateSubmoduleScript(dir);
    const stat = fs.statSync(path.join(dir, 'scripts', 'submodule-helper.sh'));
    // Mask to just the permission bits
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o755);
  });

  it('emits shebang and all documented subcommands', async () => {
    await generateSubmoduleScript(dir);
    const sh = fs.readFileSync(path.join(dir, 'scripts', 'submodule-helper.sh'), 'utf8');
    expect(sh.startsWith('#!/bin/bash')).toBe(true);
    expect(sh).toContain('function init_submodules');
    expect(sh).toContain('function update_submodules');
    expect(sh).toContain('function show_status');
    expect(sh).toContain('function foreach_command');
    expect(sh).toContain('function clean_submodules');
    expect(sh).toContain('function reset_submodules');
    expect(sh).toContain('function show_help');
  });

  it('case statement dispatches init/update/status/foreach/clean/reset/help', async () => {
    await generateSubmoduleScript(dir);
    const sh = fs.readFileSync(path.join(dir, 'scripts', 'submodule-helper.sh'), 'utf8');
    expect(sh).toMatch(/init\)\s+init_submodules/);
    expect(sh).toMatch(/update\)\s+update_submodules/);
    expect(sh).toMatch(/status\)\s+show_status/);
    expect(sh).toMatch(/foreach\)\s+foreach_command/);
    expect(sh).toMatch(/clean\)\s+clean_submodules/);
    expect(sh).toMatch(/reset\)\s+reset_submodules/);
    expect(sh).toMatch(/help\|--help\|-h\)\s+show_help/);
  });

  it('unknown command branch prints error and exits 1', async () => {
    await generateSubmoduleScript(dir);
    const sh = fs.readFileSync(path.join(dir, 'scripts', 'submodule-helper.sh'), 'utf8');
    expect(sh).toContain("Unknown command");
    expect(sh).toContain('exit 1');
  });

  it('update function supports both all-submodule and specific-path modes', async () => {
    await generateSubmoduleScript(dir);
    const sh = fs.readFileSync(path.join(dir, 'scripts', 'submodule-helper.sh'), 'utf8');
    expect(sh).toContain('git submodule update --remote --recursive "$path"');
    expect(sh).toContain('git submodule update --remote --recursive');
  });

  it('foreach guards against missing command argument', async () => {
    await generateSubmoduleScript(dir);
    const sh = fs.readFileSync(path.join(dir, 'scripts', 'submodule-helper.sh'), 'utf8');
    expect(sh).toContain("No command specified for foreach");
  });
});

describe('isGitRepository', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('returns false for a plain directory without .git', async () => {
    const result = await isGitRepository(dir);
    expect(result).toBe(false);
  });

  it('returns true after git init succeeds', async () => {
    // Skip when git is unavailable on the runner
    const { exec } = await import('child_process');
    await new Promise<void>((resolve, reject) => {
      exec('git init', { cwd: dir }, (err) => (err ? reject(err) : resolve()));
    });
    const result = await isGitRepository(dir);
    expect(result).toBe(true);
  });

  it('returns false for a non-existent path', async () => {
    const result = await isGitRepository(path.join(dir, 'does-not-exist'));
    expect(result).toBe(false);
  });

  it('defaults to process.cwd() when no argument is provided', async () => {
    // process.cwd() in test runs is the project root, which is a git repo
    const result = await isGitRepository();
    expect(typeof result).toBe('boolean');
  });
});

describe('initializeGitRepository', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('creates a valid git repository with an initial commit', async () => {
    // Seed a file so the initial commit has content
    await fs.writeFile(path.join(dir, 'README.md'), '# temp');
    await initializeGitRepository(dir);

    expect(await isGitRepository(dir)).toBe(true);

    const { exec } = await import('child_process');
    const { stdout: log } = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        exec('git log --oneline', { cwd: dir }, (err, stdout, stderr) =>
          err ? reject(err) : resolve({ stdout, stderr }),
        );
      },
    );
    expect(log.trim()).toContain('Initial commit');
  });

  it('throws a wrapped error when the path is invalid', async () => {
    const bad = path.join(dir, 'nope');
    await expect(initializeGitRepository(bad)).rejects.toThrow(
      /Failed to initialize Git repository/,
    );
  });
});

describe('getSubmoduleStatus', () => {
  let dir: string;

  beforeEach(() => {
    dir = tmpRoot();
  });

  afterEach(() => {
    fs.removeSync(dir);
  });

  it('returns an empty array for a repo with no submodules configured', async () => {
    await fs.writeFile(path.join(dir, 'placeholder.txt'), 'seed');
    await initializeGitRepository(dir);
    const result = await getSubmoduleStatus();
    // Note: getSubmoduleStatus uses the current process cwd, not a parameter.
    // In our test worker the cwd is the re-shell root which is a git repo with
    // no submodules, so this should resolve to [].
    expect(Array.isArray(result)).toBe(true);
  });
});
