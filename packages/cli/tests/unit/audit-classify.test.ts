import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { GROUP_MANIFEST, type GroupManifestEntry } from '../../src/command-manifest';
import { buildCommandCatalog } from '../../src/utils/command-catalog';
import {
  classifyCommand,
  EXPLICIT_RULES,
  ruleMatchesAnyPath,
} from '../../src/audit/classify';

const globbed = import.meta.glob('../../src/groups/*.group.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;
const modules = new Map<string, Record<string, unknown>>();
for (const [file, mod] of Object.entries(globbed)) {
  modules.set('./groups/' + path.basename(file).replace(/\.ts$/, ''), mod);
}

function realCatalogPaths(): string[][] {
  const program = new Command('re-shell');
  program.command('ui').description('stub');
  for (const entry of GROUP_MANIFEST as readonly GroupManifestEntry[]) {
    (modules.get(entry.module)![entry.register] as (p: Command) => void)(program);
  }
  const paths = buildCommandCatalog(program).map(e => e.path.split(' '));
  // Standalone commands are declared inline in index.ts (`program\n  .command('x')`).
  const index = fs.readFileSync(path.resolve(__dirname, '../../src/index.ts'), 'utf8');
  for (const m of index.matchAll(/^program\s*\n\s*\.command\('([^']+)'\)/gm)) paths.push([m[1]]);
  return paths;
}

const c = (cmd: string, args: string[] = []) => classifyCommand({ path: cmd.split(' '), args });

describe('audit command classification', () => {
  it('audits the state-changing commands named in the requirements', () => {
    for (const cmd of [
      'create',
      'add',
      'remove',
      'init',
      'generate component',
      'plugin install',
      'plugin uninstall',
      'plugin update',
      'config set',
      'service run up',
      'service run down',
      'workspace init',
      'workspace migrate',
      'cloud aws',
      'k8s apply',
      'release',
      'run',
    ]) {
      expect(c(cmd).mutating, cmd).toBe(true);
    }
  });

  it('does not audit pure queries', () => {
    for (const cmd of [
      'list',
      'doctor',
      'workspace list',
      'workspace health',
      'workspace policy check',
      'plugin list',
      'config get',
      'config show',
      'templates list',
      'commands list',
      'find',
      'security audit verify',
      'security compliance report',
      'config profile insights',
      'build',
      'serve',
    ]) {
      expect(c(cmd).mutating, cmd).toBe(false);
    }
  });

  it('--dry-run and --help never change state', () => {
    expect(c('create', ['x', '--dry-run']).mutating).toBe(false);
    expect(c('plugin install', ['--help']).mutating).toBe(false);
    expect(c('plugin install', ['-h']).mutating).toBe(false);
  });

  it('read-only commands that write when given output/apply flags are audited', () => {
    expect(c('doctor').mutating).toBe(false);
    expect(c('doctor', ['--fix', '--yes']).mutating).toBe(true);
    expect(c('analyze').mutating).toBe(false);
    expect(c('analyze', ['--output', 'r.json']).mutating).toBe(true);
    expect(c('config profile optimize').mutating).toBe(false);
    expect(c('config profile optimize', ['--auto']).mutating).toBe(true);
  });

  it('classifies hyphenated verbs by their tokens', () => {
    expect(c('plugin list-cached').mutating).toBe(false);
    expect(c('plugin clear-marketplace-cache').mutating).toBe(true);
    expect(c('plugin generate-docs').mutating).toBe(true);
    expect(c('plugin search-docs').mutating).toBe(false);
  });

  it('audits unknown commands by default (fail closed)', () => {
    const r = c('frobnicate widgets');
    expect(r).toMatchObject({ mutating: true, source: 'default', category: 'unknown' });
  });

  it('records a category usable by the compliance report', () => {
    expect(c('plugin install').category).toBe('dependency');
    expect(c('service up').category).toBe('deploy');
    expect(c('remove').category).toBe('delete');
    expect(c('create').category).toBe('create');
    expect(c('config set').category).toBe('modify');
  });
});

describe('audit classification stays in sync with the real command tree', () => {
  const paths = realCatalogPaths();

  it('has no stale explicit rules (every rule matches a real command)', () => {
    const stale = EXPLICIT_RULES.filter(rule => !ruleMatchesAnyPath(rule, paths)).map(r => r.match);
    expect(
      stale,
      `These rules in src/audit/classify.ts match no command in the real tree. Fix the pattern or remove the rule:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  it('classifies the large majority of real commands without falling back to the default', () => {
    const unclassified = paths.filter(p => classifyCommand({ path: p, args: [] }).source === 'default').map(p => p.join(' '));
    const share = unclassified.length / paths.length;
    // Not a hard requirement per command (the default is deliberate and safe),
    // but a high share means the heuristics/table need maintenance.
    expect(
      share,
      `${unclassified.length}/${paths.length} commands use the default classification. Consider adding rows to EXPLICIT_RULES:\n  ${unclassified.slice(0, 40).join('\n  ')}`
    ).toBeLessThan(0.35);
  });
});
