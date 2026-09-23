import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import * as fsReal from 'fs';
import * as path from 'path';
import * as os from 'os';

// Covers the small commander registration groups in src/groups/ that carry
// their action handlers inline (rather than delegating to a src/commands
// module): boundaries, ui-test, api-verify, fix-ci, env, migrate, federation,
// scorecard, catalog, release, dev. Each test builds a fresh real Commander
// program, registers the group, and asserts (a) the command tree shape —
// names, descriptions, options with flags+defaults — and (b) the action
// wiring — the underlying command handler is invoked with the forwarded and
// normalized options (json flag, --no-dry-run inversion, defaults), and the
// spinner/json-mode lifecycle brackets the handler call.

vi.mock('../../src/commands/boundaries', () => ({ runBoundaries: vi.fn() }));
vi.mock('../../src/commands/ui-test', () => ({ runUiTest: vi.fn() }));
vi.mock('../../src/commands/api-verify', () => ({ runApiVerify: vi.fn() }));
vi.mock('../../src/commands/fix-ci', () => ({ runFixCi: vi.fn() }));
vi.mock('../../src/commands/env', () => ({ runEnv: vi.fn() }));
vi.mock('../../src/commands/migrate', () => ({ runMigrate: vi.fn() }));
vi.mock('../../src/commands/federation', () => ({
  runFederationCheck: vi.fn(),
}));
vi.mock('../../src/commands/scorecard', () => ({ runScorecard: vi.fn() }));
vi.mock('../../src/commands/catalog', () => ({ runCatalog: vi.fn() }));
vi.mock('../../src/commands/release', () => ({ runRelease: vi.fn() }));
vi.mock('../../src/commands/dev-cluster', () => ({ runDevCluster: vi.fn() }));
vi.mock('../../src/commands/dev-restart-plan', () => ({
  runRestartPlan: vi.fn(),
}));

vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(function (this: unknown) {
      return this;
    }),
    stop: vi.fn(),
    setText: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
  flushOutput: vi.fn(),
}));

const { registerBoundariesGroup } = await import('../../src/groups/boundaries.group');
const { registerUiTestGroup } = await import('../../src/groups/ui-test.group');
const { registerApiVerifyGroup } = await import('../../src/groups/api-verify.group');
const { registerFixCiGroup } = await import('../../src/groups/fix-ci.group');
const { registerEnvGroup } = await import('../../src/groups/env.group');
const { registerMigrateGroup } = await import('../../src/groups/migrate.group');
const { registerFederationGroup } = await import('../../src/groups/federation.group');
const { registerScorecardGroup } = await import('../../src/groups/scorecard.group');
const { registerCatalogGroup } = await import('../../src/groups/catalog.group');
const { registerReleaseGroup } = await import('../../src/groups/release.group');
const { registerDevGroup } = await import('../../src/groups/dev.group');

const { runBoundaries } = await import('../../src/commands/boundaries');
const { runUiTest } = await import('../../src/commands/ui-test');
const { runApiVerify } = await import('../../src/commands/api-verify');
const { runFixCi } = await import('../../src/commands/fix-ci');
const { runEnv } = await import('../../src/commands/env');
const { runMigrate } = await import('../../src/commands/migrate');
const { runFederationCheck } = await import('../../src/commands/federation');
const { runScorecard } = await import('../../src/commands/scorecard');
const { runCatalog } = await import('../../src/commands/catalog');
const { runRelease } = await import('../../src/commands/release');
const { runDevCluster } = await import('../../src/commands/dev-cluster');
const { runRestartPlan } = await import('../../src/commands/dev-restart-plan');

/** Build a program with the given group registered, ready for parseAsync. */
function programWith(register: (program: Command) => void): Command {
  const program = new Command();
  program.exitOverride(); // never call process.exit during tests
  register(program);
  return program;
}

/** Option flags of a command as a sorted string for shape assertions. */
function optionFlags(command: Command): string[] {
  return command.options.map(option => option.flags);
}

/** Find a subcommand by name on a program/command. */
function subcommand(parent: Command, name: string): Command {
  const found = parent.commands.find(command => command.name() === name);
  if (!found) {
    throw new Error(`subcommand "${name}" not found on ${parent.name()}`);
  }
  return found;
}

describe('groups — small registration groups', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBackup: string | number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitCodeBackup = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    process.exitCode = exitCodeBackup;
  });

  describe('boundaries group', () => {
    it('registers the boundaries command with json+rules options', () => {
      const program = programWith(registerBoundariesGroup);
      const cmd = subcommand(program, 'boundaries');
      expect(cmd.description()).toContain('Module-boundary');
      expect(optionFlags(cmd)).toEqual(['--json', '--rules <path>']);
    });

    it('forwards json and rules options to runBoundaries', async () => {
      const program = programWith(registerBoundariesGroup);
      vi.mocked(runBoundaries).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'boundaries', '--json', '--rules', 'rules.json']);
      expect(runBoundaries).toHaveBeenCalledWith({ json: true, rules: 'rules.json' });
    });

    it('defaults to human output with no rules override', async () => {
      const program = programWith(registerBoundariesGroup);
      vi.mocked(runBoundaries).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'boundaries']);
      expect(runBoundaries).toHaveBeenCalledWith({ json: false, rules: undefined });
    });

    it('stops the spinner and rethrows when runBoundaries fails', async () => {
      const program = programWith(registerBoundariesGroup);
      const { createSpinner } = await import('../../src/utils/spinner');
      const spinnerStop = vi.fn();
      vi.mocked(createSpinner).mockImplementation((() => ({
        start: vi.fn(), stop: spinnerStop, setText: vi.fn(), succeed: vi.fn(), fail: vi.fn(),
      })) as never);
      vi.mocked(runBoundaries).mockRejectedValue(new Error('boom'));
      // exitOverride makes commander throw rather than exit; createAsyncCommand
      // calls process.exit(1) on error, so stub it.
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('EXIT_CALLED');
      }) as never);
      await expect(
        program.parseAsync(['node', 're-shell', 'boundaries'])
      ).rejects.toThrow('EXIT_CALLED');
      expect(spinnerStop).toHaveBeenCalled();
      exitSpy.mockRestore();
    });
  });

  describe('ui-test group', () => {
    it('registers ui test with a default gate of a11y,visual', async () => {
      const program = programWith(registerUiTestGroup);
      const ui = subcommand(program, 'ui');
      const test = subcommand(ui, 'test');
      expect(optionFlags(test)).toEqual(['--json', '--gate <pillars>']);
      const gateOption = test.options.find(option => option.long === '--gate');
      expect(gateOption?.defaultValue).toBe('a11y,visual');
    });

    it('defaults the gate when omitted', async () => {
      const program = programWith(registerUiTestGroup);
      vi.mocked(runUiTest).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'ui', 'test']);
      expect(runUiTest).toHaveBeenCalledWith({ json: false, gate: 'a11y,visual' });
    });

    it('forwards an explicit gate with json', async () => {
      const program = programWith(registerUiTestGroup);
      vi.mocked(runUiTest).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'ui', 'test', '--json', '--gate', 'a11y']);
      expect(runUiTest).toHaveBeenCalledWith({ json: true, gate: 'a11y' });
    });
  });

  describe('api-verify group', () => {
    it('registers api verify with all discovery options', () => {
      const program = programWith(registerApiVerifyGroup);
      const verify = subcommand(subcommand(program, 'api'), 'verify');
      expect(optionFlags(verify)).toEqual([
        '--json',
        '--api <name>',
        '--baseline <dir>',
        '--spec <path>',
        '--baseline-spec <path>',
      ]);
    });

    it('forwards every option to runApiVerify', async () => {
      const program = programWith(registerApiVerifyGroup);
      vi.mocked(runApiVerify).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'api', 'verify',
        '--json', '--api', 'orders', '--baseline', 'baselines/',
        '--spec', 'openapi.json', '--baseline-spec', 'old.json',
      ]);
      expect(runApiVerify).toHaveBeenCalledWith({
        json: true,
        api: 'orders',
        baseline: 'baselines/',
        spec: 'openapi.json',
        baselineSpec: 'old.json',
      });
    });

    it('passes undefined for omitted discovery options', async () => {
      const program = programWith(registerApiVerifyGroup);
      vi.mocked(runApiVerify).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'api', 'verify']);
      expect(runApiVerify).toHaveBeenCalledWith({
        json: false,
        api: undefined,
        baseline: undefined,
        spec: undefined,
        baselineSpec: undefined,
      });
    });
  });

  describe('fix-ci group', () => {
    it('registers fix with ci/json/dry-run/max-iterations options', () => {
      const program = programWith(registerFixCiGroup);
      const cmd = subcommand(program, 'fix');
      expect(optionFlags(cmd)).toContain('--ci');
      expect(optionFlags(cmd)).toContain('--no-dry-run');
      expect(optionFlags(cmd)).toContain('--max-iterations <n>');
    });

    it('refuses to run without --ci and points at doctor', async () => {
      const program = programWith(registerFixCiGroup);
      await program.parseAsync(['node', 're-shell', 'fix']);
      expect(runFixCi).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('pass --ci')
      );
      expect(process.exitCode).toBe(1);
    });

    it('runs the loop with --ci and inverts --no-dry-run', async () => {
      const program = programWith(registerFixCiGroup);
      vi.mocked(runFixCi).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'fix', '--ci', '--no-dry-run', '--max-iterations', '7',
      ]);
      expect(runFixCi).toHaveBeenCalledWith({
        json: false,
        noDryRun: true,
        maxIterations: 7,
      });
    });

    it('defaults to dry-run mode', async () => {
      const program = programWith(registerFixCiGroup);
      vi.mocked(runFixCi).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'fix', '--ci']);
      expect(runFixCi).toHaveBeenCalledWith({
        json: false,
        noDryRun: false,
        maxIterations: undefined,
      });
    });
  });

  describe('env group', () => {
    it('registers env init + verify subcommands', () => {
      const program = programWith(registerEnvGroup);
      const env = subcommand(program, 'env');
      expect(env.commands.map(command => command.name())).toEqual(['init', 'verify']);
      expect(optionFlags(subcommand(env, 'init'))).toEqual([
        '--json',
        '--no-dry-run',
      ]);
      expect(optionFlags(subcommand(env, 'verify'))).toEqual(['--json']);
    });

    it('init defaults to dry-run and forwards noDryRun:false', async () => {
      const program = programWith(registerEnvGroup);
      vi.mocked(runEnv).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'env', 'init']);
      expect(runEnv).toHaveBeenCalledWith({ json: false, mode: 'init', noDryRun: false });
    });

    it('init applies with --no-dry-run and supports json', async () => {
      const program = programWith(registerEnvGroup);
      vi.mocked(runEnv).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'env', 'init', '--json', '--no-dry-run']);
      expect(runEnv).toHaveBeenCalledWith({ json: true, mode: 'init', noDryRun: true });
    });

    it('verify forwards mode verify', async () => {
      const program = programWith(registerEnvGroup);
      vi.mocked(runEnv).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'env', 'verify', '--json']);
      expect(runEnv).toHaveBeenCalledWith({ json: true, mode: 'verify' });
    });
  });

  describe('migrate group', () => {
    it('registers migrate with an optional version argument', () => {
      const program = programWith(registerMigrateGroup);
      const cmd = subcommand(program, 'migrate');
      expect(cmd.description()).toContain('migration');
      expect(optionFlags(cmd)).toEqual(['--json', '--no-dry-run', '--filter <names>']);
      expect(cmd.registeredArguments[0].name()).toBe('to-version');
    });

    it('defaults the target to LATEST and dry-run mode', async () => {
      const program = programWith(registerMigrateGroup);
      vi.mocked(runMigrate).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'migrate']);
      const call = vi.mocked(runMigrate).mock.calls[0][0];
      expect(call.json).toBe(false);
      expect(call.noDryRun).toBe(false);
      expect(call.toVersion).toBeDefined();
      expect(typeof call.toVersion).toBe('string');
      expect(call.toVersion).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('forwards an explicit version, apply mode, and filter', async () => {
      const program = programWith(registerMigrateGroup);
      vi.mocked(runMigrate).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'migrate', '2.1.0', '--no-dry-run', '--filter', 'web,api', '--json',
      ]);
      expect(runMigrate).toHaveBeenCalledWith({
        json: true,
        toVersion: '2.1.0',
        noDryRun: true,
        filter: 'web,api',
      });
    });
  });

  describe('federation group', () => {
    it('registers federation check with baseline+manifest options', () => {
      const program = programWith(registerFederationGroup);
      const check = subcommand(subcommand(program, 'federation'), 'check');
      expect(optionFlags(check)).toEqual([
        '--json',
        '--baseline <dir>',
        '--manifest <paths>',
      ]);
    });

    it('splits a comma-separated manifest list and trims blanks', async () => {
      const program = programWith(registerFederationGroup);
      vi.mocked(runFederationCheck).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'federation', 'check',
        '--manifest', 'a.json, b.json ,,c.json', '--baseline', 'base/',
      ]);
      expect(runFederationCheck).toHaveBeenCalledWith({
        json: false,
        baseline: 'base/',
        manifests: ['a.json', 'b.json', 'c.json'],
      });
    });

    it('passes undefined manifests when the option is omitted', async () => {
      const program = programWith(registerFederationGroup);
      vi.mocked(runFederationCheck).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'federation', 'check']);
      expect(runFederationCheck).toHaveBeenCalledWith({
        json: false,
        baseline: undefined,
        manifests: undefined,
      });
    });
  });

  describe('scorecard group', () => {
    it('registers scorecard with threshold/service/pack options', async () => {
      const program = programWith(registerScorecardGroup);
      const cmd = subcommand(program, 'scorecard');
      expect(optionFlags(cmd)).toEqual([
        '--json',
        '--threshold <n>',
        '--service <name>',
        '--pack <ref>',
      ]);
      const threshold = cmd.options.find(option => option.long === '--threshold');
      expect(threshold?.defaultValue).toBe('70');
      const pack = cmd.options.find(option => option.long === '--pack');
      expect(pack?.defaultValue).toBe('recommended');
    });

    it('coerces the threshold default to a number and forwards options', async () => {
      const program = programWith(registerScorecardGroup);
      vi.mocked(runScorecard).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'scorecard', '--service', 'api', '--threshold', '85',
      ]);
      expect(runScorecard).toHaveBeenCalledWith({
        json: false,
        threshold: 85,
        service: 'api',
        pack: 'recommended',
      });
    });

    it('rejects a non-numeric threshold without running the scorecard', async () => {
      const program = programWith(registerScorecardGroup);
      await program.parseAsync(['node', 're-shell', 'scorecard', '--threshold', 'abc']);
      expect(runScorecard).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid --threshold'));
      expect(process.exitCode).toBe(1);
    });

    it('rejects an out-of-range threshold (101) in json mode via fail()', async () => {
      const program = programWith(registerScorecardGroup);
      await program.parseAsync(['node', 're-shell', 'scorecard', '--json', '--threshold', '101']);
      expect(runScorecard).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it('rejects a negative threshold', async () => {
      const program = programWith(registerScorecardGroup);
      await program.parseAsync(['node', 're-shell', 'scorecard', '--threshold', '-1']);
      expect(runScorecard).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });
  });

  describe('catalog group', () => {
    it('registers catalog + catalog sync', () => {
      const program = programWith(registerCatalogGroup);
      const catalog = subcommand(program, 'catalog');
      expect(catalog.commands.map(command => command.name())).toEqual(['sync']);
      expect(optionFlags(catalog)).toContain('--json');
      expect(optionFlags(subcommand(catalog, 'sync'))).toContain('--no-dry-run');
    });

    it('catalog emits a dry-run discovery by default', async () => {
      const program = programWith(registerCatalogGroup);
      vi.mocked(runCatalog).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'catalog']);
      expect(runCatalog).toHaveBeenCalledWith({ json: false });
    });

    it('catalog sync defaults to dry-run', async () => {
      const program = programWith(registerCatalogGroup);
      vi.mocked(runCatalog).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'catalog', 'sync']);
      expect(runCatalog).toHaveBeenCalledWith({ json: false, sync: true, noDryRun: false });
    });

    // REGRESSION NOTE: `catalog sync --json` currently DROPS the json flag.
    // The parent `catalog` command declares its own --json option (for
    // `re-shell catalog --json`), and commander@11.1.0 silently consumes the
    // flag at the parent level when a subcommand runs — the child action
    // receives json:false and emits HUMAN output even though --json was
    // passed. This test pins the current behavior so any fix (or commander
    // upgrade) that changes it flips this test visibly.
    it('catalog sync currently drops --json (parent-option collision, see note)', async () => {
      const program = programWith(registerCatalogGroup);
      vi.mocked(runCatalog).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'catalog', 'sync', '--json', '--no-dry-run',
      ]);
      expect(runCatalog).toHaveBeenCalledWith({ json: false, sync: true, noDryRun: true });
    });
  });

  describe('release group', () => {
    it('registers release with json/dry-run/publish/bump/since/filter/registry', () => {
      const program = programWith(registerReleaseGroup);
      const cmd = subcommand(program, 'release');
      expect(optionFlags(cmd)).toEqual([
        '--json',
        '--no-dry-run',
        '--publish',
        '--bump <level>',
        '--since <ref>',
        '--filter <names...>',
        '--registry <name>',
      ]);
    });

    it('defaults to dry-run and forwards the full option set', async () => {
      const program = programWith(registerReleaseGroup);
      vi.mocked(runRelease).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'release']);
      expect(runRelease).toHaveBeenCalledWith({
        json: false,
        dryRun: true,
        publish: false,
        bump: undefined,
        since: undefined,
        filter: undefined,
        registry: undefined,
      });
    });

    it('validates --bump before any side effects', async () => {
      const program = programWith(registerReleaseGroup);
      await program.parseAsync(['node', 're-shell', 'release', '--bump', 'huge']);
      expect(runRelease).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid --bump "huge"'));
      expect(process.exitCode).toBe(1);
    });

    it('accepts a valid bump and applies with --no-dry-run + --publish', async () => {
      const program = programWith(registerReleaseGroup);
      vi.mocked(runRelease).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'release', '--no-dry-run', '--publish',
        '--bump', 'minor', '--since', 'v1.0.0', '--filter', 'web', 'api',
        '--registry', 'github',
      ]);
      expect(runRelease).toHaveBeenCalledWith({
        json: false,
        dryRun: false,
        publish: true,
        bump: 'minor',
        since: 'v1.0.0',
        filter: ['web', 'api'],
        registry: 'github',
      });
    });
  });

  describe('dev group', () => {
    it('registers dev with cluster/restart-plan options', () => {
      const program = programWith(registerDevGroup);
      const cmd = subcommand(program, 'dev');
      expect(optionFlags(cmd)).toContain('--cluster');
      expect(optionFlags(cmd)).toContain('--restart-plan');
      expect(optionFlags(cmd)).toContain('--changed <pkgs...>');
    });

    it('steers users to tools dev when no mode flag is given', async () => {
      const program = programWith(registerDevGroup);
      await program.parseAsync(['node', 're-shell', 'dev']);
      expect(runDevCluster).not.toHaveBeenCalled();
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('--cluster'));
      expect(process.exitCode).toBe(1);
    });

    it('restart-plan short-circuits before the cluster path', async () => {
      const program = programWith(registerDevGroup);
      vi.mocked(runRestartPlan).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'dev', '--restart-plan', '--json', '--changed', 'ui-kit',
      ]);
      expect(runRestartPlan).toHaveBeenCalledWith({
        json: true,
        changed: ['ui-kit'],
        getChangedFiles: undefined,
      });
      expect(runDevCluster).not.toHaveBeenCalled();
    });

    it('restart-plan wires git detection when --changed is omitted', async () => {
      const program = programWith(registerDevGroup);
      vi.mocked(runRestartPlan).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'dev', '--restart-plan']);
      const call = vi.mocked(runRestartPlan).mock.calls[0][0];
      expect(call.getChangedFiles).toBeTypeOf('function');
      expect(call.changed).toBeUndefined();
    });

    it('forwards cluster options to runDevCluster with git detection', async () => {
      const program = programWith(registerDevGroup);
      vi.mocked(runDevCluster).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'dev', '--cluster', '--dry-run',
        '--namespace', 'staging', '--filter', 'api', 'web', '--json',
      ]);
      const call = vi.mocked(runDevCluster).mock.calls[0][0];
      expect(call).toMatchObject({
        cluster: true,
        dryRun: true,
        json: true,
        namespace: 'staging',
        filter: ['api', 'web'],
      });
      expect(call.getChangedFiles).toBeTypeOf('function');
    });
  });
});
