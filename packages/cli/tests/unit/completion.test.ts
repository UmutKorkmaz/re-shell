import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { installCompletion } from '../../src/commands/completion';

// Covers src/commands/completion.ts — the `re-shell completion` installer. The
// command writes bash/zsh completion scripts under the user's HOME and appends a
// source/fpath line to the relevant rc file. To keep the test hermetic we point
// `os.homedir()` at a fresh temp dir per test (via a partial 'os' mock that
// spreads the real module) and exercise the REAL fs-extra against it.

const home = vi.hoisted(() => ({ dir: '' }));

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return { ...actual, homedir: () => home.dir };
});

let logSpy: ReturnType<typeof vi.spyOn>;

function bashPath(): string {
  return path.join(home.dir, '.re-shell', 'completion.bash');
}
function zshPath(): string {
  return path.join(home.dir, '.zfunc', '_re-shell');
}
function rc(name: string): string {
  return path.join(home.dir, name);
}

/** Join every console.log argument into a single string for substring checks. */
function logged(): string {
  return logSpy.mock.calls.map(args => args.join(' ')).join('\n');
}

beforeAll(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  logSpy.mockRestore();
});

beforeEach(() => {
  logSpy.mockClear();
  home.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-comp-'));
});

afterEach(async () => {
  await fs.remove(home.dir);
});

describe('completion — bash', () => {
  it('installs the bash completion script by default and announces install', async () => {
    await installCompletion();
    const script = await fs.readFile(bashPath(), 'utf8');
    expect(script).toContain('# re-shell bash completion');
    expect(script).toContain('complete -F _re_shell_completions re-shell');
    expect(logged()).toContain('Installing Shell Completion');
    expect(logged()).toContain('Bash completion installed');
  });

  it('is also selected by an explicit shell: "bash"', async () => {
    await installCompletion({ shell: 'bash' });
    expect(await fs.pathExists(bashPath())).toBe(true);
    expect(await fs.pathExists(zshPath())).toBe(false);
  });

  it('embeds every advertised re-shell command in the completion word list', async () => {
    await installCompletion({ shell: 'bash' });
    const script = await fs.readFile(bashPath(), 'utf8');
    for (const cmd of ['init', 'create', 'add', 'remove', 'list', 'workspace', 'plugin', 'config']) {
      expect(script).toContain(cmd);
    }
  });

  it('appends a source line to an existing .bashrc that lacks it', async () => {
    await fs.writeFile(rc('.bashrc'), '# my bash config\n', 'utf8');
    await installCompletion({ shell: 'bash' });
    const bashrc = await fs.readFile(rc('.bashrc'), 'utf8');
    expect(bashrc).toContain('.re-shell/completion.bash');
    expect(logged()).toContain('Added source line to');
  });

  it('does not append the source line twice when .bashrc already has it', async () => {
    const pre = '# my bash config\n. ~/.re-shell/completion.bash\n';
    await fs.writeFile(rc('.bashrc'), pre, 'utf8');
    await installCompletion({ shell: 'bash' });
    const bashrc = await fs.readFile(rc('.bashrc'), 'utf8');
    expect(bashrc.match(/\.re-shell\/completion\.bash/g)).toHaveLength(1);
    expect(logged()).not.toContain('Added source line to');
  });

  it('warns and prints the manual line when .bashrc is absent', async () => {
    await installCompletion({ shell: 'bash' });
    expect(await fs.pathExists(rc('.bashrc'))).toBe(false);
    expect(logged()).toContain('.bashrc not found');
    expect(logged()).toContain('. ~/.re-shell/completion.bash');
  });
});

describe('completion — zsh', () => {
  it('installs the zsh completion script under ~/.zfunc/_re-shell', async () => {
    await installCompletion({ shell: 'zsh' });
    const script = await fs.readFile(zshPath(), 'utf8');
    expect(script).toContain('#compdef re-shell');
    expect(script).toContain('compdef _re_shell re-shell');
    expect(script).toContain('_re_shell()');
    expect(logged()).toContain('Zsh completion installed');
  });

  it('appends the fpath/compinit block to an existing .zshrc lacking it', async () => {
    await fs.writeFile(rc('.zshrc'), '# my zsh config\n', 'utf8');
    await installCompletion({ shell: 'zsh' });
    const zshrc = await fs.readFile(rc('.zshrc'), 'utf8');
    expect(zshrc).toContain('.zfunc');
    expect(zshrc).toContain('compinit');
    expect(logged()).toContain('Added fpath to');
  });

  it('does not append the fpath block twice when .zshrc already references .zfunc', async () => {
    const pre = '# my zsh config\nfpath=(~/.zfunc $fpath)\n';
    await fs.writeFile(rc('.zshrc'), pre, 'utf8');
    await installCompletion({ shell: 'zsh' });
    const zshrc = await fs.readFile(rc('.zshrc'), 'utf8');
    expect(zshrc.match(/\.zfunc/g)).toHaveLength(1);
    expect(logged()).not.toContain('Added fpath to');
  });

  it('warns and prints manual lines when .zshrc is absent', async () => {
    await installCompletion({ shell: 'zsh' });
    expect(await fs.pathExists(rc('.zshrc'))).toBe(false);
    expect(logged()).toContain('.zshrc not found');
    expect(logged()).toContain('autoload -U compinit && compinit');
  });
});

describe('completion — error & unsupported paths', () => {
  it('rejects an unsupported shell and writes nothing', async () => {
    await installCompletion({ shell: 'fish' as 'bash' });
    expect(logged()).toContain('Unsupported shell: fish');
    expect(logged()).toContain('Supported shells: bash, zsh');
    expect(await fs.pathExists(bashPath())).toBe(false);
    expect(await fs.pathExists(zshPath())).toBe(false);
  });

  it('swallows installer errors and surfaces them via the error log', async () => {
    // Pre-create ~/.re-shell as a FILE so ensureDir rejects with ENOTDIR.
    await fs.writeFile(path.join(home.dir, '.re-shell'), 'blocker', 'utf8');
    await installCompletion({ shell: 'bash' });
    expect(logged()).toContain('Error installing completion:');
  });
});
