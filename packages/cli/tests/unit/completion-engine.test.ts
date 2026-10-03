import { describe, it, expect } from 'vitest';
import { Command, Option } from 'commander';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildCompletionTree,
  generateCompletionScript,
  renderBashCompletion,
  renderZshCompletion,
  isCompletionShell,
} from '../../src/utils/completion-engine';
import { markDeprecatedAlias, walkCommandTree, buildCommandCatalog } from '../../src/utils/command-catalog';

function program(): Command {
  const p = new Command('re-shell');
  p.command('init').description('Initialize').option('--force', 'Overwrite').action(() => {});
  const ws = new Command('workspace').description('Workspace tools');
  ws.command('list').description('List').option('--json', 'JSON').action(() => {});
  const tpl = new Command('tpl').alias('template').description('Templates');
  tpl.command('show').description('Show').action(() => {});
  ws.addCommand(tpl);
  p.addCommand(ws);
  p.command('completion')
    .description('Completion')
    .addOption(new Option('--shell <shell>', 'Shell').choices(['bash', 'zsh']))
    .action(() => {});
  // A later sibling with an already-claimed name is unreachable in Commander.
  const stub = new Command('init').description('[deprecated] shadow').action(() => {});
  p.addCommand(stub, { hidden: true });
  // Hidden deprecated alias that is not shadowed.
  const dep = new Command('workspace-list').description('[deprecated]').action(() => {});
  p.addCommand(dep, { hidden: true });
  markDeprecatedAlias(dep, 'workspace list');
  return p;
}

function bashComplete(script: string, words: string[], cword: number): string[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-comp-engine-'));
  const file = path.join(dir, 'completion.bash');
  fs.writeFileSync(file, script);
  try {
    const quoted = words.map(w => `'${w}'`).join(' ');
    const out = spawnSync(
      'bash',
      ['-c', `source ${file}; COMP_WORDS=(${quoted}); COMP_CWORD=${cword}; _re_shell_completions; printf '%s\\n' "\${COMPREPLY[@]}"`],
      { encoding: 'utf8' }
    );
    return out.stdout.split('\n').filter(Boolean);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('walkCommandTree', () => {
  it('skips shadowed duplicates and hidden commands by default', () => {
    const paths: string[] = [];
    walkCommandTree(program(), n => paths.push(n.path));
    expect(paths).toEqual(['init', 'workspace', 'workspace list', 'workspace tpl', 'workspace tpl show', 'completion']);
  });

  it('includeHidden visits hidden commands but never shadowed ones, flagging deprecated stubs', () => {
    const nodes: Array<{ path: string; hidden: boolean; replacedBy?: string }> = [];
    walkCommandTree(program(), n => nodes.push({ path: n.path, hidden: n.hidden, replacedBy: n.replacedBy }), {
      includeHidden: true,
    });
    expect(nodes.filter(n => n.path === 'init')).toHaveLength(1);
    expect(nodes.find(n => n.path === 'init')!.hidden).toBe(false);
    expect(nodes.find(n => n.path === 'workspace-list')).toEqual({
      path: 'workspace-list',
      hidden: true,
      replacedBy: 'workspace list',
    });
  });

  it('catalog dedupes and reports hidden stubs only on request', () => {
    expect(buildCommandCatalog(program()).map(e => e.path)).not.toContain('workspace-list');
    const all = buildCommandCatalog(program(), { includeHidden: true });
    const stub = all.find(e => e.path === 'workspace-list')!;
    expect(stub.hidden).toBe(true);
    expect(stub.replacedBy).toBe('workspace list');
    expect(all.filter(e => e.path === 'init')).toHaveLength(1);
  });
});

describe('buildCompletionTree', () => {
  it('nests live commands with aliases and options, without hidden ones', () => {
    const root = buildCompletionTree(program());
    expect(root.children.map(c => c.name)).toEqual(['init', 'workspace', 'completion']);
    const ws = root.children.find(c => c.name === 'workspace')!;
    expect(ws.children.map(c => c.name)).toEqual(['list', 'tpl']);
    expect(ws.children[1].aliases).toEqual(['template']);
    expect(root.children[0].options.map(o => o.flag)).toEqual(['--force']);
    const shell = root.children[2].options[0];
    expect(shell.choices).toEqual(['bash', 'zsh']);
  });
});

describe('generated bash completion', () => {
  const script = generateCompletionScript(program(), 'bash');

  it('completes top-level commands from the tree (and not hidden ones)', () => {
    expect(bashComplete(script, ['re-shell', ''], 1).sort()).toEqual(['completion', 'init', 'workspace']);
    expect(bashComplete(script, ['re-shell', 'work'], 1)).toEqual(['workspace']);
  });

  it('completes nested subcommands and alias paths', () => {
    expect(bashComplete(script, ['re-shell', 'workspace', ''], 2).sort()).toEqual(['list', 'template', 'tpl']);
    expect(bashComplete(script, ['re-shell', 'workspace', 'template', ''], 3)).toEqual(['show']);
    expect(bashComplete(script, ['re-shell', 'workspace', 'tpl', 's'], 3)).toEqual(['show']);
  });

  it('completes flags and constrained flag values', () => {
    expect(bashComplete(script, ['re-shell', 'workspace', 'list', '--j'], 3)).toEqual(['--json']);
    expect(bashComplete(script, ['re-shell', 'completion', '--shell', ''], 3).sort()).toEqual(['bash', 'zsh']);
  });

  it('is deterministic for the same tree', () => {
    expect(generateCompletionScript(program(), 'bash')).toBe(script);
  });
});

describe('generated zsh completion', () => {
  const script = renderZshCompletion(buildCompletionTree(program()));

  it('is a #compdef script that registers itself and never shadows $path', () => {
    expect(script.startsWith('#compdef re-shell')).toBe(true);
    expect(script).toContain('compdef _re_shell re-shell');
    expect(script).toContain('_re_shell()');
    expect(script).not.toMatch(/local [^\n]*\bpath\b/);
  });

  it('embeds descriptions and every live command, not hidden ones', () => {
    expect(script).toContain("'workspace:Workspace tools'");
    expect(script).toContain("'template:Templates'");
    expect(script).not.toContain('workspace-list');
    expect(script).not.toContain('deprecated');
  });
});

describe('helpers', () => {
  it('isCompletionShell narrows supported shells', () => {
    expect(isCompletionShell('bash')).toBe(true);
    expect(isCompletionShell('zsh')).toBe(true);
    expect(isCompletionShell('fish')).toBe(false);
  });

  it('renderBashCompletion escapes single quotes in descriptions-free tables', () => {
    const p = new Command('re-shell');
    p.command("it's").action(() => {});
    const out = renderBashCompletion(buildCompletionTree(p));
    expect(out).toContain("it'\\''s");
  });
});
