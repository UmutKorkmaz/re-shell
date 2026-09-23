import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Covers src/aliases.ts — backward-compatibility aliases for old flat command
// names. Each alias registers a hidden commander stub that warns on stderr and
// exits 1. Driven through a REAL commander program (same pattern as the groups
// registration suites).

const { registerAliases } = await import('../../src/aliases');

/** The complete alias catalogue in declaration order. */
const EXPECTED_ALIASES: ReadonlyArray<readonly [string, string]> = [
  // workspace-* flat commands → workspace <sub>
  ['workspace-health', 'workspace health'],
  ['workspace-graph', 'workspace graph'],
  ['workspace-def', 'workspace def'],
  ['workspace-state', 'workspace state'],
  ['workspace-template', 'workspace template'],
  ['workspace-backup', 'workspace'],
  ['workspace-migration', 'workspace migrate'],
  ['workspace-conflict', 'workspace'],
  ['workspace-config', 'workspace'],
  ['file-watcher', 'tools'],
  ['change-detector', 'tools'],
  // api-related flat commands → api <sub>
  ['openapi', 'api'],
  ['swagger', 'api'],
  ['versioning', 'api'],
  ['validation', 'api'],
  ['gateway', 'api gateway'],
  ['analytics', 'api'],
  ['client', 'api'],
  ['api-test', 'api'],
  ['docs', 'learn docs'],
  // config-related flat commands → config <sub>
  ['env', 'config env'],
  ['uconfig', 'config'],
  ['config-migrate', 'config'],
  ['config-diff', 'config diff'],
  ['validate', 'config validate'],
  ['project-config', 'config'],
  ['template', 'generate'],
  // quality/testing flat commands → quality <sub>
  ['test', 'quality test'],
  ['intellisense', 'quality ide'],
  ['cicd', 'tools cicd'],
  // tools flat commands → tools <sub>
  ['debug', 'tools debug'],
  ['devenv', 'tools devenv'],
  ['hotreload', 'tools hotreload'],
  ['dev', 'tools dev'],
  // service flat commands → service <sub>
  ['services', 'service'],
  // migrate/backup flat commands → tools migrate <sub>
  ['backup', 'tools migrate backup'],
  ['migrate', 'tools migrate'],
];

describe('registerAliases', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    // Throwing exit spy so the alias action halts like a real process exit.
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`EXITED_${code}`);
      }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function programWithAliases() {
    const program = new Command();
    program.exitOverride(); // keep commander from exiting on its own
    registerAliases(program);
    return program;
  }

  it('registers every documented alias in declaration order', () => {
    const program = programWithAliases();

    // Visibility (hidden) is asserted via help output below — commander@11
    // exposes no per-command hidden introspection.
    expect(program.commands.map(c => c.name())).toEqual(EXPECTED_ALIASES.map(([name]) => name));
    expect(program.commands).toHaveLength(37);
  });

  it('does not leak aliases into help output', () => {
    const program = programWithAliases();
    program.name('re-shell');

    const help = program.helpInformation();

    expect(help).not.toContain('--workspace-health');
    expect(help).not.toContain('file-watcher');
    expect(help).not.toContain('config-diff');
  });

  it('describes the replacement path per alias', () => {
    const program = programWithAliases();
    const byName = new Map(program.commands.map(c => [c.name(), c]));

    expect(byName.get('workspace-health')!.description()).toBe(
      '[deprecated] Use: re-shell workspace health',
    );
    expect(byName.get('gateway')!.description()).toBe(
      '[deprecated] Use: re-shell api gateway',
    );
    expect(byName.get('docs')!.description()).toBe('[deprecated] Use: re-shell learn docs');
    expect(byName.get('template')!.description()).toBe('[deprecated] Use: re-shell generate');
    expect(byName.get('backup')!.description()).toBe(
      '[deprecated] Use: re-shell tools migrate backup',
    );
    expect(byName.get('dev')!.description()).toBe('[deprecated] Use: re-shell tools dev');
    expect(byName.get('services')!.description()).toBe('[deprecated] Use: re-shell service');
  });

  it('warns on stderr and exits 1 when an alias is invoked', async () => {
    const program = programWithAliases();

    await program
      .parseAsync(['node', 're-shell', 'workspace-health'])
      .catch(() => undefined); // the throwing exit spy rejects the parse

    expect(stderrSpy).toHaveBeenCalledWith(
      '[deprecated] re-shell workspace-health → re-shell workspace health\n',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints the alias-specific mapping for every family representative', async () => {
    const program = programWithAliases();
    const samples: ReadonlyArray<readonly [string, string]> = [
      ['env', '[deprecated] re-shell env → re-shell config env\n'],
      ['test', '[deprecated] re-shell test → re-shell quality test\n'],
      ['migrate', '[deprecated] re-shell migrate → re-shell tools migrate\n'],
      ['validate', '[deprecated] re-shell validate → re-shell config validate\n'],
    ];

    for (const [alias, message] of samples) {
      stderrSpy.mockClear();
      exitSpy.mockClear();
      await program.parseAsync(['node', 're-shell', alias]).catch(() => undefined);
      expect(stderrSpy).toHaveBeenCalledWith(message);
      expect(exitSpy).toHaveBeenCalledWith(1);
    }
  });

  it('tolerates unknown options on deprecated invocations', async () => {
    const program = programWithAliases();

    await program
      .parseAsync(['node', 're-shell', 'workspace-graph', '--format', 'json'])
      .catch(() => undefined);

    expect(stderrSpy).toHaveBeenCalledWith(
      '[deprecated] re-shell workspace-graph → re-shell workspace graph\n',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('only executes the matching alias', async () => {
    const program = programWithAliases();

    await program.parseAsync(['node', 're-shell', 'hotreload']).catch(() => undefined);

    const messages = stderrSpy.mock.calls.map(c => String(c[0]));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('re-shell hotreload → re-shell tools hotreload');
  });
});
