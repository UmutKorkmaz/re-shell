import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import * as fsReal from 'fs';
import * as path from 'path';
import * as os from 'os';

// Covers src/groups/run.group.ts and src/groups/service.group.ts — the
// dependency-aware task runner group and the polyglot/bridge/dev-services
// orchestration group. The run group's task-runner + cache collaborators are
// mocked so the option normalization (concurrency parsing, CSV filter
// flattening, --no-cache inversion, cache-config composition with the
// remote-secret warning), error envelopes, and the human renderer are
// exercised. The service group delegates to polyglot/bridge-generate/services
// command modules — all mocked — while the option forwarding (protocol
// precedence, scale parsing, timeout math, list-style short-circuits) is
// asserted through real commander parsing.

vi.mock('../../src/utils/task-runner', () => ({
  runTask: vi.fn(),
  discoverWorkspace: vi.fn(),
  resolveAffectedPackages: vi.fn(),
}));
vi.mock('../../src/utils/cache-config', () => ({
  resolveCacheRoot: vi.fn(() => '/cache/root'),
  resolveCacheSecret: vi.fn(() => 'sekrit'),
  resolveRemoteCacheSettings: vi.fn(() => undefined),
  CACHE_SECRET_ENV: 'RE_SHELL_CACHE_SECRET',
}));
vi.mock('../../src/utils/cache-store', () => ({
  RemoteCache: vi.fn(function () {
    return {};
  }),
  createHttpCacheTransport: vi.fn(() => ({})),
}));
vi.mock('../../src/commands/polyglot', () => ({
  buildAll: vi.fn(),
  generateDeploymentConfig: vi.fn(),
  deployServices: vi.fn(),
  listServices: vi.fn(),
}));
vi.mock('../../src/commands/bridge-generate', () => ({
  runBridgeGenerate: vi.fn(),
}));
vi.mock('../../src/commands/services', () => ({
  servicesUp: vi.fn(),
  servicesDown: vi.fn(),
  servicesHealth: vi.fn(),
  servicesLogs: vi.fn(),
  servicesRestart: vi.fn(),
  servicesScale: vi.fn(),
  servicesExec: vi.fn(),
  servicesInspect: vi.fn(),
  servicesMigrate: vi.fn(),
  listMigrationTargets: vi.fn(),
  servicesOptimize: vi.fn(),
  listOptimizationRecommendations: vi.fn(),
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

const { registerRunGroup } = await import('../../src/groups/run.group');
const { registerServiceGroup } = await import('../../src/groups/service.group');

const { runTask, discoverWorkspace } = await import('../../src/utils/task-runner');
const { resolveCacheRoot, resolveRemoteCacheSettings } = await import(
  '../../src/utils/cache-config'
);
const { RemoteCache } = await import('../../src/utils/cache-store');
const { buildAll, generateDeploymentConfig, deployServices, listServices } = await import(
  '../../src/commands/polyglot'
);
const { runBridgeGenerate } = await import('../../src/commands/bridge-generate');
const svcs = await import('../../src/commands/services');

/** Build a program with the given group registered, ready for parseAsync. */
function programWith(register: (program: Command) => void): Command {
  const program = new Command();
  program.exitOverride();
  register(program);
  return program;
}

/** Find a subcommand by name (or alias) on a program/command. */
function subcommand(parent: Command, name: string): Command {
  const found = parent.commands.find(
    command => command.name() === name || command.aliases().includes(name)
  );
  if (!found) {
    throw new Error(`subcommand "${name}" not found on ${parent.name()}`);
  }
  return found;
}

/** Successful runner result fixture. */
function successResult(overrides: Record<string, unknown> = {}) {
  return {
    task: 'build',
    concurrency: 4,
    results: [
      { package: 'web', task: 'build', status: 'success', durationMs: 120 },
      { package: 'api', task: 'build', status: 'cached', durationMs: 5 },
      { package: 'lib', task: 'build', status: 'skipped' },
      { package: 'bad', task: 'build', status: 'failed', exitCode: 2, durationMs: 9 },
    ],
    hadFailure: true,
    ...overrides,
  };
}

describe('groups — run + service registration groups', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBackup: string | number | undefined;
  let tempRoot: string;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitCodeBackup = process.exitCode;
    process.exitCode = undefined;
    tempRoot = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-groups-run-'));
    // The run group checks for a package.json at process.cwd() before running.
    fsReal.writeFileSync(path.join(tempRoot, 'package.json'), '{}');
    vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
    process.exitCode = exitCodeBackup;
    fsReal.rmSync(tempRoot, { recursive: true, force: true });
  });

  describe('run group', () => {
    it('registers run with a required task argument and its options', () => {
      const program = programWith(registerRunGroup);
      const cmd = subcommand(program, 'run');
      expect(cmd.registeredArguments[0].name()).toBe('task');
      expect(cmd.options.map(option => option.flags)).toContain('--affected');
      expect(cmd.options.map(option => option.flags)).toContain('--concurrency <n>');
      expect(cmd.options.map(option => option.flags)).toContain('--no-cache');
      expect(cmd.options.map(option => option.flags)).toContain('--continue');
    });

    it('runs a task with cache config on and forwards parsed options', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue(successResult({ hadFailure: false }) as never);
      await program.parseAsync([
        'node', 're-shell', 'run', 'build', '--concurrency', '8', '--continue',
      ]);
      const call = vi.mocked(runTask).mock.calls[0][0];
      expect(call.task).toBe('build');
      expect(call.concurrency).toBe(8);
      expect(call.continueOnError).toBe(true);
      expect(call.cacheConfig).toEqual({
        root: '/cache/root',
        secret: 'sekrit',
        remote: undefined,
      });
      expect(resolveCacheRoot).toHaveBeenCalledWith(tempRoot, undefined);
    });

    it('disables the cache with --no-cache', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue(successResult({ hadFailure: false }) as never);
      await program.parseAsync(['node', 're-shell', 'run', 'test', '--no-cache']);
      expect(vi.mocked(runTask).mock.calls[0][0].cacheConfig).toBeUndefined();
    });

    it('falls back to CPU-count concurrency for invalid --concurrency', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue(successResult({ hadFailure: false }) as never);
      await program.parseAsync(['node', 're-shell', 'run', 'build', '--concurrency', 'abc']);
      expect(vi.mocked(runTask).mock.calls[0][0].concurrency).toBeUndefined();
    });

    it('flattens CSV and repeatable --filter values', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue(successResult({ hadFailure: false }) as never);
      vi.mocked(discoverWorkspace).mockResolvedValue({
        packages: new Map([
          ['web', {}],
          ['api', {}],
        ]),
      } as never);
      await program.parseAsync([
        'node', 're-shell', 'run', 'build', '--filter', 'web, api', '--filter', 'api',
      ]);
      const call = vi.mocked(runTask).mock.calls[0][0];
      // No dedup across repeats: commander flattens every occurrence and
      // parseFilter only splits/trims/filters empties.
      expect(call.filter).toEqual(['web', 'api', 'api']);
    });

    it('rejects unknown --filter packages with a RUN_ERROR envelope', async () => {
      const program = programWith(registerRunGroup);
      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(discoverWorkspace).mockResolvedValue({
        packages: new Map([['web', {}]]),
      } as never);
      await program.parseAsync([
        'node', 're-shell', 'run', 'build', '--filter', 'ghost', '--json',
      ]);
      expect(runTask).not.toHaveBeenCalled();
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe('RUN_ERROR');
      expect(payload.error.message).toContain('Unknown package(s)');
      expect(payload.error.details.unknown).toEqual(['ghost']);
    });

    it('resolves affected packages when --affected is passed', async () => {
      const program = programWith(registerRunGroup);
      const { resolveAffectedPackages } = await import('../../src/utils/task-runner');
      vi.mocked(runTask).mockResolvedValue(successResult({ hadFailure: false }) as never);
      vi.mocked(discoverWorkspace).mockResolvedValue({ packages: new Map() } as never);
      vi.mocked(resolveAffectedPackages).mockResolvedValue(['web', 'lib'] as never);
      await program.parseAsync(['node', 're-shell', 'run', 'test', '--affected']);
      expect(vi.mocked(runTask).mock.calls[0][0].affectedPackages).toEqual(['web', 'lib']);
    });

    it('refuses to run outside a project directory', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(process.cwd).mockReturnValue('/definitely/not/a/project');
      await program.parseAsync(['node', 're-shell', 'run', 'build']);
      expect(runTask).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it('emits a cycle error without running anything', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue({
        task: 'build',
        concurrency: 4,
        results: [],
        cycleError: { message: 'Dependency cycle detected: a -> b -> a', cycle: ['a', 'b'] },
        hadFailure: true,
      } as never);
      await program.parseAsync(['node', 're-shell', 'run', 'build']);
      expect(process.exitCode).toBe(1);
    });

    it('renders per-status lines and a tally in human mode', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue(successResult() as never);
      await program.parseAsync(['node', 're-shell', 'run', 'build']);
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('run "build" (concurrency 4)');
      expect(out).toContain('web:build — success (120ms)');
      expect(out).toContain('api:build — cached (5ms)');
      expect(out).toContain('lib:build — skipped (no script)');
      expect(out).toContain('bad:build — failed (exit 2)');
      expect(out).toContain('1 ok, 1 cached, 1 failed, 1 skipped');
    });

    it('emits a JSON envelope including affected packages', async () => {
      const program = programWith(registerRunGroup);
      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(runTask).mockResolvedValue(
        successResult({ hadFailure: false, affected: ['web'] }) as never
      );
      await program.parseAsync(['node', 're-shell', 'run', 'build', '--json']);
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload.ok).toBe(true);
      expect(payload.data.task).toBe('build');
      expect(payload.data.concurrency).toBe(4);
      expect(payload.data.affected).toEqual(['web']);
      expect(payload.data.results).toHaveLength(4);
    });

    it('sets exitCode 1 when any task failed', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue(successResult() as never);
      await program.parseAsync(['node', 're-shell', 'run', 'build']);
      expect(process.exitCode).toBe(1);
    });

    it('builds a remote cache backend when RE_SHELL_REMOTE_CACHE is set', async () => {
      const program = programWith(registerRunGroup);
      vi.mocked(runTask).mockResolvedValue(successResult({ hadFailure: false }) as never);
      vi.mocked(resolveRemoteCacheSettings).mockReturnValue({
        baseUrl: 'https://cache.example.com',
        token: 'tok',
      } as never);
      await program.parseAsync(['node', 're-shell', 'run', 'build']);
      const cacheConfig = vi.mocked(runTask).mock.calls[0][0].cacheConfig;
      expect(RemoteCache).toHaveBeenCalledTimes(1);
      expect(cacheConfig?.remote).toEqual({});
    });

    it('warns when a remote cache is configured without an explicit secret', async () => {
      const program = programWith(registerRunGroup);
      const stderrSpy = vi.mocked(process.stderr.write);
      vi.mocked(runTask).mockResolvedValue(successResult({ hadFailure: false }) as never);
      vi.mocked(resolveRemoteCacheSettings).mockReturnValue({
        baseUrl: 'https://cache.example.com',
        token: 'tok',
      } as never);
      await program.parseAsync(['node', 're-shell', 'run', 'build']);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('RE_SHELL_CACHE_SECRET')
      );
    });
  });

  describe('service group', () => {
    it('registers the three subgroups with aliases', () => {
      const program = programWith(registerServiceGroup);
      const service = subcommand(program, 'service');
      expect(service.commands.map(command => command.name())).toEqual([
        'bridge', 'polyglot', 'run',
      ]);
      expect(subcommand(service, 'run').alias()).toBe('svc');
      expect(
        subcommand(subcommand(service, 'bridge'), 'generate').options.map(o => o.flags)
      ).toContain('--grpc');
    });

    it('bridge generate resolves rest when --rest is passed', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(runBridgeGenerate).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'bridge', 'generate', '--rest',
      ]);
      expect(vi.mocked(runBridgeGenerate).mock.calls[0][0].protocol).toBe('rest');
    });

    it('bridge generate prefers grpc over rest when both are set', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(runBridgeGenerate).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'bridge', 'generate', '--rest', '--grpc',
      ]);
      expect(vi.mocked(runBridgeGenerate).mock.calls[0][0].protocol).toBe('grpc');
    });

    it('bridge generate resolves graphql when --graphql is passed', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(runBridgeGenerate).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'bridge', 'generate', '--graphql',
      ]);
      expect(vi.mocked(runBridgeGenerate).mock.calls[0][0].protocol).toBe('graphql');
    });

    it('bridge generate leaves protocol undefined without any flag', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(runBridgeGenerate).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'service', 'bridge', 'generate']);
      expect(vi.mocked(runBridgeGenerate).mock.calls[0][0].protocol).toBeUndefined();
    });

    it('bridge generate suppresses the spinner in json mode', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(runBridgeGenerate).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'bridge', 'generate', '--json', '--dry-run',
      ]);
      const call = vi.mocked(runBridgeGenerate).mock.calls[0][0];
      expect(call.json).toBe(true);
      expect(call.dryRun).toBe(true);
      expect(call.spinner).toBeUndefined();
    });

    it('polyglot build-all forwards production/parallel/filters', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(buildAll).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'polyglot', 'build-all',
        '--production', '--type', 'backend', '--language', 'python', '--verbose',
      ]);
      expect(buildAll).toHaveBeenCalledWith(
        expect.objectContaining({
          production: true,
          type: ['backend'],
          language: ['python'],
          verbose: true,
          spinner: expect.anything(),
        })
      );
    });

    it('polyglot list forwards json + filters', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(listServices).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'polyglot', 'list', '--json', '--type', 'frontend',
      ]);
      expect(listServices).toHaveBeenCalledWith({ json: true, type: 'frontend' });
    });

    it('polyglot generate-deployment forwards target + environment + options', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(generateDeploymentConfig).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'polyglot', 'generate-deployment', 'k8s', 'prod',
        '--region', 'us-east-1', '--domain', 'api.example.com',
      ]);
      expect(generateDeploymentConfig).toHaveBeenCalledWith(
        'k8s',
        'prod',
        expect.objectContaining({ region: 'us-east-1', domain: 'api.example.com' })
      );
    });

    it('polyglot deploy forwards skip-build + dry-run', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(deployServices).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'polyglot', 'deploy', 'docker', 'staging',
        '--skip-build', '--dry-run',
      ]);
      expect(deployServices).toHaveBeenCalledWith(
        'docker',
        'staging',
        expect.objectContaining({ skipBuild: true, dryRun: true })
      );
    });

    it('run up parses scale pairs and timeout', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesUp).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'up',
        '--scale', 'web=3', 'worker=2', '--timeout', '30000', '--no-deps',
      ]);
      expect(svcs.servicesUp).toHaveBeenCalledWith(
        tempRoot,
        expect.objectContaining({
          scale: { web: 3, worker: 2 },
          timeout: 30000,
          noDeps: true,
          detached: true,
        })
      );
    });

    it('run down forwards volumes + remove-orphans', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesDown).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'down', '-v', '--remove-orphans',
      ]);
      expect(svcs.servicesDown).toHaveBeenCalledWith(
        tempRoot,
        expect.objectContaining({ volumes: true, removeOrphans: true, timeout: 60000 })
      );
    });

    it('run health forwards watch + interval + json', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesHealth).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'health', '-w', '--interval', '2500', '--json',
      ]);
      expect(svcs.servicesHealth).toHaveBeenCalledWith(
        tempRoot,
        expect.objectContaining({ watch: true, interval: 2500, json: true })
      );
    });

    it('run logs forwards an optional service + tail', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesLogs).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'logs', 'api', '-f', '--tail', '50',
      ]);
      expect(svcs.servicesLogs).toHaveBeenCalledWith(
        tempRoot,
        'api',
        expect.objectContaining({ follow: true, tail: 50 })
      );
    });

    it('run scale parses the replica count', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesScale).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'service', 'run', 'scale', 'web', '4']);
      expect(svcs.servicesScale).toHaveBeenCalledWith(tempRoot, 'web', 4, expect.anything());
    });

    it('run exec forwards the command array and tty default', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesExec).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'exec', 'api', 'npm', 'test',
      ]);
      expect(svcs.servicesExec).toHaveBeenCalledWith(
        tempRoot,
        'api',
        ['npm', 'test'],
        expect.objectContaining({ interactive: true })
      );
    });

    it('run exec disables tty with -T', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesExec).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'exec', 'api', 'ls', '-T',
      ]);
      expect(svcs.servicesExec).toHaveBeenCalledWith(
        tempRoot,
        'api',
        ['ls'],
        expect.objectContaining({ interactive: false })
      );
    });

    it('run inspect forwards json + verbose', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesInspect).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'inspect', 'api', '--json', '--verbose',
      ]);
      expect(svcs.servicesInspect).toHaveBeenCalledWith(
        tempRoot,
        'api',
        { json: true, verbose: true }
      );
    });

    it('run migrate short-circuits to listMigrationTargets with --list-targets', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.listMigrationTargets).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'migrate', 'api', 'fastapi',
        '--list-targets', '--source', 'express',
      ]);
      expect(svcs.listMigrationTargets).toHaveBeenCalledWith('express');
      expect(svcs.servicesMigrate).not.toHaveBeenCalled();
    });

    it('run migrate defaults source to express and backup stays on', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesMigrate).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'migrate', 'api', 'fastapi', '--dry-run',
      ]);
      expect(svcs.servicesMigrate).toHaveBeenCalledWith(
        tempRoot,
        'api',
        expect.objectContaining({
          sourceFramework: 'express',
          targetFramework: 'fastapi',
          dryRun: true,
          backup: true,
        })
      );
    });

    it('run migrate skips backup with --no-backup', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesMigrate).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'migrate', 'api', 'nest', '--no-backup',
      ]);
      expect(vi.mocked(svcs.servicesMigrate).mock.calls[0][2]).toMatchObject({ backup: false });
    });

    it('run optimize short-circuits to recommendations with --list-all', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.listOptimizationRecommendations).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'optimize', 'api', '--list-all',
        '--framework', 'express',
      ]);
      expect(svcs.listOptimizationRecommendations).toHaveBeenCalledWith('express');
      expect(svcs.servicesOptimize).not.toHaveBeenCalled();
    });

    it('run optimize applies only with --apply (dry-run by default)', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesOptimize).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'service', 'run', 'optimize', 'api']);
      // apply is forwarded verbatim (undefined when the flag is absent); the
      // dry-run default is derived from it.
      expect(vi.mocked(svcs.servicesOptimize).mock.calls[0][2]).toMatchObject({
        dryRun: true,
      });
      await program.parseAsync([
        'node', 're-shell', 'service', 'run', 'optimize', 'api', '--apply',
      ]);
      expect(vi.mocked(svcs.servicesOptimize).mock.calls[1][2]).toMatchObject({
        apply: true,
        dryRun: false,
      });
    });

    it('routes the svc alias to the run subgroup', async () => {
      const program = programWith(registerServiceGroup);
      vi.mocked(svcs.servicesHealth).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'service', 'svc', 'health', '--json']);
      expect(svcs.servicesHealth).toHaveBeenCalledWith(
        tempRoot,
        expect.objectContaining({ json: true })
      );
    });
  });
});
