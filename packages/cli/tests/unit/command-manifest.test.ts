import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { GROUP_MANIFEST, type GroupManifestEntry } from '../../src/command-manifest';
import {
  registerLazyGroups,
  ensureFullCommandTree,
  resolveSelectedCommand,
} from '../../src/lazy-commands';
import { buildCommandCatalog } from '../../src/utils/command-catalog';

// Every group module, keyed by its path relative to src/ (e.g. './groups/run.group').
const globbed = import.meta.glob('../../src/groups/*.group.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;
const modules = new Map<string, Record<string, unknown>>();
for (const [file, mod] of Object.entries(globbed)) {
  modules.set('./groups/' + path.basename(file).replace(/\.ts$/, ''), mod);
}

type RegisterFn = (program: Command) => void;
const loadRegister = (entry: GroupManifestEntry): RegisterFn => {
  const fn = modules.get(entry.module)?.[entry.register];
  if (typeof fn !== 'function') throw new Error(`missing ${entry.register} in ${entry.module}`);
  return fn as RegisterFn;
};

/** index.ts registers the standalone `ui` command before the groups. */
function programWithStandalone(): Command {
  const program = new Command('re-shell');
  program.command('ui').description('Launch the local Re-Shell UI dashboard');
  return program;
}

function eagerProgram(): Command {
  const program = programWithStandalone();
  for (const entry of GROUP_MANIFEST) loadRegister(entry)(program);
  return program;
}

function lazyProgram(args: string[]): Command {
  const program = programWithStandalone();
  registerLazyGroups(program, args, { loadRegister, eager: false });
  return program;
}

const where = (e: GroupManifestEntry) => `${e.register} (src/${e.module.replace('./', '')}.ts)`;

describe('command manifest drift', () => {
  it('lists every groups/*.group.ts module exactly where the registrar can find it', () => {
    const problems: string[] = [];
    const registered = new Set(GROUP_MANIFEST.map(e => e.module));
    const dir = path.resolve(__dirname, '../../src/groups');
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.group.ts'))) {
      const mod = './groups/' + file.replace(/\.ts$/, '');
      if (!registered.has(mod)) {
        const exp = Object.keys(modules.get(mod) ?? {}).find(k => /^register\w+Group$/.test(k));
        problems.push(
          `src/groups/${file} is not in GROUP_MANIFEST. Add to src/command-manifest.ts:\n` +
            `  { name: '<top-level command>', description: '<its .description()>', module: '${mod}', register: '${exp ?? 'registerXGroup'}' },`
        );
      }
    }
    for (const e of GROUP_MANIFEST) {
      if (!modules.has(e.module)) {
        problems.push(`manifest entry "${e.name}" points at missing module ${e.module}`);
      } else if (typeof modules.get(e.module)![e.register] !== 'function') {
        problems.push(`manifest entry "${e.name}": ${e.module} does not export ${e.register}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('matches the real command tree (name, description, args, [options]) for every group', () => {
    const problems: string[] = [];
    for (const entry of GROUP_MANIFEST) {
      const scratch = programWithStandalone();
      if (entry.attachesTo && !scratch.commands.some(c => c.name() === entry.attachesTo)) {
        // The target is created by another group earlier in the manifest: register it first,
        // as the real (ordered) registration would.
        const owner = GROUP_MANIFEST.find(e => e.name === entry.attachesTo && !e.attachesTo);
        if (owner) loadRegister(owner)(scratch);
      }
      const before = [...scratch.commands];
      loadRegister(entry)(scratch);
      const added = scratch.commands.filter(c => !before.includes(c));

      if (entry.attachesTo) {
        if (added.length > 0) {
          problems.push(
            `${where(entry)} creates top-level command(s) [${added.map(c => c.name())}] but the manifest says it only attachesTo "${entry.attachesTo}". ` +
              `Replace attachesTo with name/description in src/command-manifest.ts.`
          );
        }
        continue;
      }
      if (added.length !== 1) {
        problems.push(
          `${where(entry)} registers ${added.length} top-level commands [${added.map(c => c.name())}]; ` +
            `the manifest supports exactly one per entry. Add one manifest entry per command (same module/register) in registration order.`
        );
        continue;
      }
      const real = added[0];
      if (real.name() !== entry.name) {
        problems.push(`${where(entry)} registers "${real.name()}" but manifest name is "${entry.name}" -> set name: '${real.name()}'.`);
      }
      if (real.description() !== (entry.description ?? '')) {
        problems.push(
          `${where(entry)} description drifted. Update src/command-manifest.ts entry "${entry.name}":\n` +
            `  description: ${JSON.stringify(real.description())}`
        );
      }
      const realArgs = real.registeredArguments.map(a => {
        const n = a.name() + (a.variadic ? '...' : '');
        return a.required ? `<${n}>` : `[${n}]`;
      });
      if (JSON.stringify(realArgs) !== JSON.stringify(entry.args ?? [])) {
        problems.push(
          `${where(entry)} positional args drifted. Update entry "${entry.name}":\n` +
            `  args: ${JSON.stringify(realArgs)}${realArgs.length ? '' : '   (or remove the args field)'}`
        );
      }
      if ((real.options.length > 0) !== Boolean(entry.hasOptions)) {
        problems.push(
          `${where(entry)} options drifted: real command has ${real.options.length} option(s). ` +
            `${real.options.length > 0 ? "Add hasOptions: true" : 'Remove hasOptions'} on entry "${entry.name}" in src/command-manifest.ts.`
        );
      }
    }
    expect(problems, '\n' + problems.join('\n\n')).toEqual([]);
  });

  it('renders the same top-level --help from stubs as from the real tree', () => {
    const lazy = lazyProgram([]).helpInformation();
    const eager = eagerProgram().helpInformation();
    expect(lazy).toBe(eager);
  });

  it('produces an identical command catalog once the full tree is requested', () => {
    const lazy = lazyProgram([]);
    const catalogLazy = buildCommandCatalog(lazy);
    const catalogEager = buildCommandCatalog(eagerProgram());
    expect(catalogLazy).toEqual(catalogEager);
    expect(catalogLazy.length).toBeGreaterThan(100);
    // Order of top-level commands is preserved after stubs are replaced.
    expect(lazy.commands.map(c => c.name())).toEqual(eagerProgram().commands.map(c => c.name()));
  });
});

describe('lazy registrar', () => {
  it('resolveSelectedCommand mirrors how argv selects a top-level command', () => {
    expect(resolveSelectedCommand([])).toBeUndefined();
    expect(resolveSelectedCommand(['--help'])).toBeUndefined();
    expect(resolveSelectedCommand(['workspace', '--help'])).toBe('workspace');
    expect(resolveSelectedCommand(['help', 'run'])).toBe('run');
    expect(resolveSelectedCommand(['help'])).toBeUndefined();
    expect(resolveSelectedCommand(['-h', 'service', 'up'])).toBe('service');
    expect(resolveSelectedCommand(['--', 'workspace'])).toBeUndefined();
  });

  it('loads only the group argv selects and leaves stubs for the rest', () => {
    const loaded: string[] = [];
    const program = programWithStandalone();
    registerLazyGroups(program, ['run', '--filter', 'x'], {
      loadRegister: entry => {
        loaded.push(entry.name);
        return loadRegister(entry);
      },
    });
    expect(loaded).toEqual(['run']);
    const run = program.commands.find(c => c.name() === 'run')!;
    expect(run.registeredArguments.map(a => a.name())).toEqual(['task']);
    expect(run.options.some(o => o.long === '--concurrency')).toBe(true);
    // The stub for `workspace` carries no subcommands until it is needed.
    expect(program.commands.find(c => c.name() === 'workspace')!.commands).toHaveLength(0);
  });

  it('keeps the real command at the stub position and loads api + api-verify together', () => {
    const program = lazyProgram(['api']);
    const names = program.commands.map(c => c.name());
    expect(names).toEqual(eagerProgram().commands.map(c => c.name()));
    // api-verify attaches `verify` to the one `api` command (no shadowed duplicate).
    const api = program.commands.filter(c => c.name() === 'api');
    expect(api.length).toBe(1);
    expect(api[0].commands.map(c => c.name())).toContain('verify');
  });

  it('attaches ui-test subcommands when the standalone `ui` command is selected', () => {
    const program = lazyProgram(['ui']);
    const ui = program.commands.find(c => c.name() === 'ui')!;
    expect(ui.commands.map(c => c.name())).toContain('test');
  });

  it('ensureFullCommandTree is idempotent and a no-op for plain programs', () => {
    const program = lazyProgram([]);
    ensureFullCommandTree(program);
    const count = program.commands.length;
    ensureFullCommandTree(program);
    expect(program.commands.length).toBe(count);
    expect(() => ensureFullCommandTree(new Command())).not.toThrow();
  });

  it('a stub that is dispatched fails explicitly instead of silently doing nothing', async () => {
    const program = programWithStandalone();
    program.exitOverride();
    registerLazyGroups(program, [], { loadRegister });
    await expect(program.parseAsync(['node', 're-shell', 'cache'])).rejects.toThrow(/lazy stub/);
  });
});
