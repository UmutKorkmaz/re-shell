import { describe, it, expect } from 'vitest';
import { Command, Option, Argument } from 'commander';

import {
  buildCommandCatalog,
  type CommandCatalogEntry,
} from '../../src/utils/command-catalog';

describe('command-catalog', () => {
  describe('buildCommandCatalog', () => {
    it('returns an empty array for a program with no commands', () => {
      const program = new Command('root');
      expect(buildCommandCatalog(program)).toEqual([]);
    });

    it('skips the auto-registered help command', () => {
      const program = new Command('root');
      const sub = new Command('help');
      sub.action(() => {});
      program.addCommand(sub);

      const catalog = buildCommandCatalog(program);
      expect(catalog.find(e => e.path === 'help')).toBeUndefined();
    });

    it('only emits entries for runnable commands (action handler set)', () => {
      const program = new Command('root');
      const runnable = new Command('run').action(() => {});
      const pureGroup = new Command('group'); // no action
      const nestedLeaf = new Command('leaf').action(() => {});
      pureGroup.addCommand(nestedLeaf);
      program.addCommand(runnable);
      program.addCommand(pureGroup);

      const paths = buildCommandCatalog(program).map(e => e.path);
      expect(paths).toEqual(expect.arrayContaining(['run', 'group leaf']));
      expect(paths).not.toContain('group');
    });

    it('sorts entries alphabetically by path', () => {
      const program = new Command('root');
      program.addCommand(new Command('zebra').action(() => {}));
      program.addCommand(new Command('alpha').action(() => {}));
      program.addCommand(new Command('middle').action(() => {}));

      const paths = buildCommandCatalog(program).map(e => e.path);
      expect(paths).toEqual(['alpha', 'middle', 'zebra']);
    });

    it('captures description text', () => {
      const program = new Command('root');
      program.addCommand(
        new Command('deploy').description('Deploy services').action(() => {})
      );

      const [entry] = buildCommandCatalog(program);
      expect(entry.description).toBe('Deploy services');
    });

    it('captures registered aliases', () => {
      const program = new Command('root');
      const cmd = new Command('install').alias('i').alias('add').action(() => {});
      program.addCommand(cmd);

      const [entry] = buildCommandCatalog(program);
      expect(entry.aliases).toEqual(['i', 'add']);
    });

    it('records required and optional arguments', () => {
      const program = new Command('root');
      const cmd = new Command('use')
        .addArgument(new Argument('<name>'))
        .addArgument(new Argument('[version]'))
        .action(() => {});
      program.addCommand(cmd);

      const [entry] = buildCommandCatalog(program);
      expect(entry.args).toEqual([
        { name: 'name', required: true },
        { name: 'version', required: false },
      ]);
    });

    it('marks boolean flags as takesValue=false', () => {
      const program = new Command('root');
      program.addCommand(
        new Command('run').addOption(new Option('-v, --verbose')).action(() => {})
      );

      const [entry] = buildCommandCatalog(program);
      const verbose = entry.flags.find(f => f.name === '--verbose');
      expect(verbose).toBeDefined();
      expect(verbose?.takesValue).toBe(false);
    });

    it('marks value flags as takesValue=true via required/optional', () => {
      const program = new Command('root');
      program.addCommand(
        new Command('run')
          .addOption(new Option('-p, --port <number>'))
          .addOption(new Option('-t, --tag [value]'))
          .action(() => {})
      );

      const [entry] = buildCommandCatalog(program);
      const port = entry.flags.find(f => f.name === '--port');
      const tag = entry.flags.find(f => f.name === '--tag');
      expect(port?.takesValue).toBe(true);
      expect(tag?.takesValue).toBe(true);
    });

    it('captures the default value when one is set', () => {
      const program = new Command('root');
      program.addCommand(
        new Command('run')
          .addOption(new Option('-m, --mode <mode>').default('production'))
          .action(() => {})
      );

      const [entry] = buildCommandCatalog(program);
      const mode = entry.flags.find(f => f.name === '--mode');
      expect(mode?.default).toBe('production');
    });

    it('detects --json / --json-output as supportsJson=true', () => {
      const program = new Command('root');
      program.addCommand(
        new Command('run')
          .addOption(new Option('--json'))
          .action(() => {})
      );
      program.addCommand(
        new Command('other')
          .addOption(new Option('--json-output'))
          .action(() => {})
      );

      const catalog = buildCommandCatalog(program);
      const run = catalog.find(e => e.path === 'run');
      const other = catalog.find(e => e.path === 'other');
      expect(run?.supportsJson).toBe(true);
      expect(other?.supportsJson).toBe(true);
    });

    it('detects --dry-run as supportsDryRun=true', () => {
      const program = new Command('root');
      program.addCommand(
        new Command('run')
          .addOption(new Option('--dry-run'))
          .action(() => {})
      );

      const [entry] = buildCommandCatalog(program);
      expect(entry.supportsDryRun).toBe(true);
    });

    it('marks destructive verbs as destructive', () => {
      const program = new Command('root');
      program.addCommand(new Command('uninstall').action(() => {}));
      program.addCommand(new Command('delete').action(() => {}));
      program.addCommand(new Command('reset').action(() => {}));
      program.addCommand(new Command('prune').action(() => {}));
      program.addCommand(new Command('deploy').action(() => {}));

      const catalog = buildCommandCatalog(program);
      const byPath = Object.fromEntries(catalog.map(e => [e.path, e.destructive]));
      expect(byPath['uninstall']).toBe(true);
      expect(byPath['delete']).toBe(true);
      expect(byPath['reset']).toBe(true);
      expect(byPath['prune']).toBe(true);
      expect(byPath['deploy']).toBe(false);
    });

    it('marks "service down" and "service run down" as destructive via path suffix', () => {
      const program = new Command('root');
      const service = new Command('service');
      const run = new Command('run');
      const down = new Command('down').action(() => {});
      run.addCommand(down);
      service.addCommand(run);
      // Also "service down" direct
      const serviceDown = new Command('down').action(() => {});
      service.addCommand(serviceDown);
      program.addCommand(service);

      const catalog = buildCommandCatalog(program);
      const paths = new Set(catalog.filter(e => e.destructive).map(e => e.path));
      expect(paths.has('service run down')).toBe(true);
      expect(paths.has('service down')).toBe(true);
    });

    it('walks arbitrary depth subgroup trees', () => {
      const program = new Command('root');
      const a = new Command('a');
      const b = new Command('b');
      const c = new Command('c').action(() => {});
      b.addCommand(c);
      a.addCommand(b);
      program.addCommand(a);

      const catalog = buildCommandCatalog(program);
      expect(catalog.map(e => e.path)).toEqual(['a b c']);
    });

    it('CommandCatalogEntry shape matches expected fields', () => {
      const program = new Command('root');
      program.addCommand(
        new Command('deploy')
          .description('Deploy it')
          .addArgument(new Argument('<target>'))
          .addOption(new Option('--json'))
          .action(() => {})
      );

      const [entry] = buildCommandCatalog(program);
      const keys = Object.keys(entry).sort();
      expect(keys).toEqual(
        [
          'aliases',
          'args',
          'description',
          'destructive',
          'flags',
          'path',
          'supportsDryRun',
          'supportsJson',
        ].sort()
      );
    });
  });
});
