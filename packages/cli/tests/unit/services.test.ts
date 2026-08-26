import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import {
  parseDockerCompose,
  buildDependencyGraph,
  servicesUp,
  servicesDown,
  servicesHealth,
  servicesLogs,
  servicesRestart,
  servicesScale,
  servicesExec,
  servicesInspect,
  servicesMigrate,
  listMigrationTargets,
  servicesOptimize,
  listOptimizationRecommendations,
} from '../../src/commands/services';

// Covers src/commands/services.ts — the `services` command surface
// (2212 lines): compose/script parsing, dependency graph, up/down/health/
// logs/restart/scale/exec/inspect, framework migration planning and
// optimization analysis.
//
// child_process.spawn is mocked with controllable fake processes so no real
// docker/npm process is launched; runCommand's promise resolves when the
// fake child emits 'close'. All file access (docker-compose.yml,
// package.json, .re-shell/pids/*, .re-shell/logs/*) runs against a real
// temp directory.

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  pid = 4242;
  killed = false;
  kill = vi.fn(() => {
    this.killed = true;
    return true;
  });
  unref = vi.fn();
}

/**
 * True when a spawned command line matches a fragment. spawn(cmd, args) may
 * arrive as one string (shell:true merges) or cmd + args — join everything.
 */
function cmdMatches(args: unknown[], frag: string): boolean {
  return args.map(String).join(' ').includes(frag);
}

const hoisted = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

vi.mock('child_process', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('child_process')>();
  return { ...original, spawn: hoisted.spawn };
});

// The migration flow imports prompts dynamically; mock it so no real
// prompt blocks the test.
const promptsMock = vi.hoisted(() => vi.fn());
vi.mock('prompts', () => ({ default: promptsMock }));

/**
 * Route spawns by command fragment: matching frags succeed (with optional
 * stdout), everything else emits 'error' — runCommand only rejects on spawn
 * errors (non-zero exits still resolve), so this makes docker unavailable.
 */
function routeSpawns(
  routes: Array<{ frag: string; stdout?: string; code?: number }>,
  unmatched: 'error' | 'ok' = 'error'
) {
  hoisted.spawn.mockImplementation((...args: unknown[]) => {
    const route = routes.find(r => cmdMatches(args, r.frag));
    const child = new FakeChild();
    if (route || unmatched === 'ok') {
      const stdout = route?.stdout ?? '';
      const code = route?.code ?? 0;
      queueMicrotask(() => {
        if (stdout) child.stdout.emit('data', Buffer.from(stdout));
        child.emit('close', code);
      });
    } else {
      queueMicrotask(() =>
        child.emit('error', new Error('spawn not found'))
      );
    }
    return child;
  });
}

let tempRoot: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls
    .map(c => c.map(a => String(a)).join(' '))
    .join('\n');
}

/** Full command lines captured from spawn (cmd + args joined). */
function spawnCmds(): string[] {
  return hoisted.spawn.mock.calls.map(c => c.map(String).join(' '));
}

describe('services — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promptsMock.mockReset();
    // Default: every spawn errors → docker considered unavailable, so the
    // npm-script fallback paths are exercised (runCommand rejects on spawn
    // errors, NOT on non-zero exits).
    routeSpawns([], 'error');
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-svc-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  describe('parseDockerCompose', () => {
    it('reads services from docker-compose.yml', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        `services:
  api:
    image: node:20
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      NODE_ENV: production
    command: node server.js
  db:
    image: postgres:16
    build: ./db
`
      );
      const services = await parseDockerCompose(tempRoot);
      expect(services).toHaveLength(2);
      const api = services.find(s => s.name === 'api')!;
      expect(api.image).toBe('node:20');
      expect(api.ports).toEqual(['3000:3000']);
      expect(api.depends_on).toEqual(['db']);
      expect(api.environment).toEqual({ NODE_ENV: 'production' });
      expect(api.command).toBe('node server.js');
      const db = services.find(s => s.name === 'db')!;
      expect(db.build).toBe('./db');
    });

    it('prefers docker-compose.yml over dev and package.json variants', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  main:\n    image: a:1\n'
      );
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.dev.yml'),
        'services:\n  dev:\n    image: b:2\n'
      );
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ scripts: { dev: 'vite' } })
      );
      const services = await parseDockerCompose(tempRoot);
      expect(services.map(s => s.name)).toEqual(['main']);
    });

    it('tries .yaml extension when .yml is missing', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yaml'),
        'services:\n  yaml-svc:\n    image: c:3\n'
      );
      const services = await parseDockerCompose(tempRoot);
      expect(services.map(s => s.name)).toEqual(['yaml-svc']);
    });

    it('falls back to package.json dev/start/serve scripts with port extraction', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({
          scripts: {
            dev: 'vite --port 5173',
            start: 'node -p 8080 server.js',
            'serve:prod': 'serve -l 9000',
            build: 'tsc', // no dev/start/serve keyword → skipped
          },
        })
      );
      const services = await parseDockerCompose(tempRoot);
      expect(services.map(s => s.name).sort()).toEqual([
        'dev',
        'serve-prod',
        'start',
      ]);
      expect(services.find(s => s.name === 'dev')!.port).toBe(5173);
      expect(services.find(s => s.name === 'start')!.port).toBe(8080);
      expect(services.find(s => s.name === 'serve-prod')!.port).toBe(
        undefined
      );
    });

    it('returns [] when no compose file and unreadable package.json', async () => {
      const services = await parseDockerCompose(tempRoot);
      expect(services).toEqual([]);
    });

    it('recurses into workspaces glob and prefixes names', async () => {
      fs.mkdirSync(path.join(tempRoot, 'services'), { recursive: true });
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ workspaces: ['services/*'] })
      );
      fs.writeFileSync(
        path.join(tempRoot, 'services', 'package.json'),
        JSON.stringify({ scripts: { dev: 'node . --port 4000' } })
      );
      const services = await parseDockerCompose(tempRoot);
      expect(services.map(s => s.name)).toEqual(['services-dev']);
      expect(services[0].port).toBe(4000);
    });
  });

  describe('buildDependencyGraph', () => {
    it('groups services into startup levels by longest dependency chain', () => {
      const graph = buildDependencyGraph([
        { name: 'web', depends_on: ['api'] },
        { name: 'api', depends_on: ['db', 'cache'] },
        { name: 'db' },
        { name: 'cache' },
      ]);
      expect(graph.levels).toEqual([['db', 'cache'], ['api'], ['web']]);
      expect(graph.dependencies.get('api')).toEqual(['db', 'cache']);
      expect(graph.nodes.get('web')!.name).toBe('web');
    });

    it('treats a dependency on an unknown service as level 0', () => {
      const graph = buildDependencyGraph([
        { name: 'a', depends_on: ['ghost'] },
      ]);
      expect(graph.levels).toEqual([['a']]);
    });

    it('does not infinite-loop on circular dependencies', () => {
      const graph = buildDependencyGraph([
        { name: 'a', depends_on: ['b'] },
        { name: 'b', depends_on: ['a'] },
      ]);
      // Circular deps break the recursion (visiting-set guard returns 0),
      // leaving an empty level-0 bucket and both services one level up.
      expect(graph.levels).toEqual([[], ['b'], ['a']]);
    });

    it('keeps already-visited services at their computed level', () => {
      const graph = buildDependencyGraph([
        { name: 'shared' },
        { name: 'x', depends_on: ['shared'] },
        { name: 'y', depends_on: ['shared'] },
      ]);
      expect(graph.levels).toEqual([['shared'], ['x', 'y']]);
    });
  });

  describe('servicesUp', () => {
    it('reports when no services are found', async () => {
      await servicesUp(tempRoot);
      expect(output()).toContain('No services found in project.');
      expect(hoisted.spawn).not.toHaveBeenCalled();
    });

    it('uses docker-compose when available', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  api:\n    image: node:20\n'
      );
      // docker --version OK, docker-compose --version OK, up OK, ps JSON []
      routeSpawns(
        [
          { frag: 'ps --format json', stdout: '[]' },
          { frag: '--version', stdout: '' },
          { frag: 'up -d', stdout: '' },
        ],
        'ok'
      );
      await servicesUp(tempRoot, { detached: true, build: true, forceRecreate: true, noDeps: true, scale: { api: 2 } });
      const cmds = spawnCmds();
      expect(cmds.some(c => c.includes('docker-compose'))).toBe(true);
    });

    it('renders the dependency graph in verbose mode', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  api:\n    image: node:20\n    depends_on:\n      db:\n        condition: started\n  db:\n    image: postgres:16\n'
      );
      routeSpawns(
        [
          { frag: 'ps --format json', stdout: '[]' },
          { frag: '--version', stdout: '' },
          { frag: 'up -d', stdout: '' },
        ],
        'ok'
      );
      await servicesUp(tempRoot, { verbose: true });
      expect(output()).toContain('Service Dependency Graph');
      expect(output()).toContain('Level 0: db');
      expect(output()).toContain('Level 1: api');
    });

    it('falls back to npm scripts and starts services level by level', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({
          scripts: {
            dev: 'node dev-server.js --port 3000',
            start: 'node api-server.js --port 3001',
          },
        })
      );
      // docker unavailable (default erroring mock) → npm fallback. The two
      // services sit at level 0; the readiness sleep of 2000ms per level
      // is awaited.
      await servicesUp(tempRoot, {});
      expect(spawnCmds().some(c => c.includes('dev-server.js'))).toBe(true);
      expect(spawnCmds().some(c => c.includes('api-server.js'))).toBe(true);
      expect(output()).toContain('Services started:');
      // PID + log bookkeeping happened on disk
      const pids = fs.readdirSync(path.join(tempRoot, '.re-shell', 'pids'));
      expect(pids.sort()).toEqual(['dev.pid', 'start.pid']);
    }, 15000);
  });

  describe('servicesDown', () => {
    it('uses docker-compose down when available', async () => {
      routeSpawns(
        [
          { frag: '--version', stdout: '' },
          { frag: 'down', stdout: '' },
        ],
        'ok'
      );
      await servicesDown(tempRoot, { volumes: true, removeOrphans: true });
      expect(spawnCmds().some(c => c.includes('down'))).toBe(true);
      expect(output()).toContain('Services stopped.');
    });

    it('stops npm processes from pid files and removes them', async () => {
      const pidDir = path.join(tempRoot, '.re-shell', 'pids');
      fs.mkdirSync(pidDir, { recursive: true });
      // A PID that definitely is not running.
      fs.writeFileSync(path.join(pidDir, 'dev.pid'), '999999');
      fs.writeFileSync(path.join(pidDir, 'notes.txt'), 'not a pid');
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
      await servicesDown(tempRoot, {});
      expect(killSpy).toHaveBeenCalledWith(999999, 'SIGTERM');
      expect(fs.existsSync(path.join(pidDir, 'dev.pid'))).toBe(false);
      expect(fs.existsSync(path.join(pidDir, 'notes.txt'))).toBe(true);
      expect(output()).toContain('Services stopped.');
    });

    it('says no running services when the pid dir is missing', async () => {
      await servicesDown(tempRoot, {});
      expect(output()).toContain('No running services found.');
    });
  });

  describe('servicesHealth', () => {
    it('reports npm process health with running/stopped states (human)', async () => {
      const pidDir = path.join(tempRoot, '.re-shell', 'pids');
      fs.mkdirSync(pidDir, { recursive: true });
      fs.writeFileSync(path.join(pidDir, 'api.pid'), String(process.pid));
      fs.writeFileSync(path.join(pidDir, 'dead.pid'), '999999');
      await servicesHealth(tempRoot, {});
      const out = output();
      expect(out).toContain('Service Health Status');
      expect(out).toContain(`api: running (PID: ${process.pid})`);
      expect(out).toContain('dead: stopped');
    });

    it('emits a JSON array of service states', async () => {
      const pidDir = path.join(tempRoot, '.re-shell', 'pids');
      fs.mkdirSync(pidDir, { recursive: true });
      fs.writeFileSync(path.join(pidDir, 'api.pid'), String(process.pid));
      await servicesHealth(tempRoot, { json: true });
      const payload = JSON.parse(
        logSpy.mock.calls[logSpy.mock.calls.length - 1][0]
      );
      expect(payload).toEqual([
        { name: 'api', pid: process.pid, status: 'running' },
      ]);
    });

    it('says no services found when the pid dir is missing', async () => {
      await servicesHealth(tempRoot, {});
      expect(output()).toContain('No services found.');
    });
  });

  describe('servicesLogs', () => {
    it('tails npm logs for a specific service', async () => {
      const logDir = path.join(tempRoot, '.re-shell', 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(
        path.join(logDir, 'dev.log'),
        Array.from({ length: 150 }, (_, i) => `line-${i}`).join('\n')
      );
      await servicesLogs(tempRoot, 'dev', { tail: 10 });
      const out = output();
      expect(out).toContain('line-149');
      expect(out).not.toContain('line-100');
    });

    it('renders all log files when no service is named', async () => {
      const logDir = path.join(tempRoot, '.re-shell', 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(path.join(logDir, 'a.log'), 'alpha\n');
      fs.writeFileSync(path.join(logDir, 'b.log'), 'beta\n');
      await servicesLogs(tempRoot, undefined, {});
      const out = output();
      expect(out).toContain('=== a.log ===');
      expect(out).toContain('=== b.log ===');
    });

    it('says no logs found when the log dir is missing', async () => {
      await servicesLogs(tempRoot, 'dev', {});
      expect(output()).toContain('No logs found.');
    });
  });

  describe('servicesRestart', () => {
    it('restarts via docker-compose when available', async () => {
      routeSpawns(
        [
          { frag: '--version', stdout: '' },
          { frag: 'restart', stdout: '' },
        ],
        'ok'
      );
      await servicesRestart(tempRoot, 'api');
      expect(spawnCmds().some(c => c.includes('restart'))).toBe(true);
      expect(output()).toContain("Service 'api' restarted.");
    });

    it('stops npm processes then restarts the named one', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ scripts: { dev: 'node dev-server.js --port 3000' } })
      );
      await servicesRestart(tempRoot, 'dev');
      expect(spawnCmds().some(c => c.includes('dev-server.js'))).toBe(true);
      expect(output()).toContain("Service 'dev' restarted.");
    });

    it('silently skips when the service is not defined', async () => {
      await servicesRestart(tempRoot, 'ghost');
      expect(output()).not.toContain("Service 'ghost' restarted.");
    });
  });

  describe('servicesScale', () => {
    it('scales via docker-compose when available', async () => {
      routeSpawns(
        [
          { frag: '--version', stdout: '' },
          { frag: '--scale', stdout: '' },
        ],
        'ok'
      );
      await servicesScale(tempRoot, 'api', 3);
      expect(
        spawnCmds().some(c => c.includes('--scale'))
      ).toBe(true);
      expect(output()).toContain('scaled to 3 instances');
    });

    it('declines scaling without docker-compose', async () => {
      await servicesScale(tempRoot, 'api', 3);
      expect(output()).toContain('only supported with Docker Compose');
    });
  });

  describe('servicesExec', () => {
    it('executes inside the container when docker-compose is available', async () => {
      routeSpawns(
        [
          { frag: '--version', stdout: '' },
          { frag: 'exec', stdout: '' },
        ],
        'ok'
      );
      await servicesExec(tempRoot, 'api', ['sh', '-c', 'ls'], {
        interactive: false,
      });
      const execLine = spawnCmds().find(c => c.includes(' exec'));
      expect(execLine).toBeDefined();
      expect(execLine).toContain('-T');
      expect(execLine).toContain('api');
    });

    it('declines exec without docker-compose', async () => {
      await servicesExec(tempRoot, 'api', ['ls']);
      expect(output()).toContain('only supported with Docker Compose');
    });
  });

  describe('servicesInspect', () => {
    it('throws for an unknown service', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  api:\n    image: node:20\n'
      );
      await expect(servicesInspect(tempRoot, 'ghost')).rejects.toThrow(
        "Service 'ghost' not found"
      );
    });

    it('inspects an npm-script service: ports, dependents, pid status', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ scripts: { dev: 'node . --port 3000' } })
      );
      const pidDir = path.join(tempRoot, '.re-shell', 'pids');
      fs.mkdirSync(pidDir, { recursive: true });
      fs.writeFileSync(path.join(pidDir, 'dev.pid'), String(process.pid));
      const result = await servicesInspect(tempRoot, 'dev', {});
      expect(result.status).toBe('running');
      expect(result.type).toBe('npm-script');
      expect(result.metadata.pid).toBe(process.pid);
      expect(result.ports).toEqual([
        { container: 3000, host: 3000, protocol: 'tcp' },
      ]);
      expect(output()).toContain('Service Inspection: dev');
      expect(output()).toContain('3000 -> 3000/tcp');
    });

    it('reports stopped when the pid file points at a dead process', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ scripts: { dev: 'node . --port 3000' } })
      );
      const pidDir = path.join(tempRoot, '.re-shell', 'pids');
      fs.mkdirSync(pidDir, { recursive: true });
      fs.writeFileSync(path.join(pidDir, 'dev.pid'), '999999');
      const result = await servicesInspect(tempRoot, 'dev', {});
      expect(result.status).toBe('stopped');
    });

    it('reports unknown when no pid file exists', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ scripts: { dev: 'node . --port 3000' } })
      );
      const result = await servicesInspect(tempRoot, 'dev', {});
      expect(result.status).toBe('unknown');
    });

    it('inspects a compose service and lists its dependents', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        `services:
  api:
    image: node:20
    ports:
      - "3000:3000"
      - "9229:9229/udp"
    environment:
      NODE_ENV: production
    depends_on:
      db:
        condition: service_started
  db:
    image: postgres:16
`
      );
      const result = await servicesInspect(tempRoot, 'db', {});
      expect(result.dependents).toEqual(['api']);
      expect(output()).toContain('Dependents');
      expect(output()).toContain('api');
    });

    it('parses compose port mappings incl. udp protocol', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        `services:
  api:
    image: node:20
    ports:
      - "3000:3000"
      - "9229:9229/udp"
`
      );
      const result = await servicesInspect(tempRoot, 'api', { json: true });
      expect(result.ports).toEqual([
        { container: 3000, host: 3000, protocol: 'tcp' },
        { container: 9229, host: 9229, protocol: 'udp' },
      ]);
      // JSON mode prints the inspection payload
      expect(output()).toContain('"name": "api"');
    });
  });

  describe('servicesMigrate', () => {
    it('throws for an unknown source framework', async () => {
      await expect(
        servicesMigrate(tempRoot, 'api', {
          sourceFramework: 'nope',
          targetFramework: 'express',
        })
      ).rejects.toThrow("Source framework 'nope' not found");
    });

    it('throws for an unknown target framework', async () => {
      await expect(
        servicesMigrate(tempRoot, 'api', {
          sourceFramework: 'express',
          targetFramework: 'nope',
        })
      ).rejects.toThrow("Target framework 'nope' not found");
    });

    it('builds and renders a dry-run plan without touching the disk', async () => {
      const plan = await servicesMigrate(tempRoot, 'api', {
        sourceFramework: 'express',
        targetFramework: 'fastapi',
        dryRun: true,
      });
      expect(plan.source.framework).toBe('Express.js');
      expect(plan.target.framework).toBe('FastAPI');
      expect(plan.source.language).toBe('typescript');
      expect(plan.target.language).toBe('python');
      // Language change → a manual translation step exists
      const translate = plan.steps.find(s => s.id === 'translate-code')!;
      expect(translate.manual).toBe(true);
      expect(plan.steps.some(s => s.id === 'update-dependencies')).toBe(true);
      expect(output()).toContain('Dry run - no changes made.');
      expect(fs.existsSync(path.join(tempRoot, '.re-shell'))).toBe(false);
    });

    it('cancels the migration when the confirm prompt is declined', async () => {
      promptsMock.mockResolvedValueOnce({ confirm: false });
      const plan = await servicesMigrate(tempRoot, 'api', {
        sourceFramework: 'express',
        targetFramework: 'fastify',
        backup: false,
      });
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(output()).toContain('Migration cancelled.');
    });

    it('creates a backup and executes the migration when confirmed', async () => {
      promptsMock.mockResolvedValueOnce({ confirm: true });
      // Seed a source file the backup/migration can act on.
      fs.mkdirSync(path.join(tempRoot, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, 'src', 'app.ts'), 'x');
      const plan = await servicesMigrate(tempRoot, 'api', {
        sourceFramework: 'express',
        targetFramework: 'fastify',
        backup: true,
      });
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(output()).toContain('Backup created');
      expect(output()).toContain('Migration completed!');
    });
  });

  describe('listMigrationTargets', () => {
    it('warns for an unknown source framework', async () => {
      await listMigrationTargets('nope');
      expect(output()).toContain("Source framework 'nope' not found");
    });

    it('lists same-language targets with a ✅ and cross-language with ⚠️', async () => {
      await listMigrationTargets('express');
      const out = output();
      expect(out).toContain('Migration targets from Express.js');
      expect(out).toContain('✅ Fastify');
      expect(out).toContain('⚠️ FastAPI');
    });

    it('groups all frameworks by language when no source is given', async () => {
      await listMigrationTargets();
      const out = output();
      expect(out).toContain('Available framework migrations');
      expect(out).toContain('typescript:');
      expect(out).toContain('python:');
    });
  });

  describe('servicesOptimize', () => {
    it('detects the framework from the compose service image', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  api:\n    image: myorg/express-api:1\n'
      );
      const analysis = await servicesOptimize(tempRoot, 'api', {});
      expect(analysis.framework).toBe('express');
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(output()).toContain('Optimization Analysis: api');
    });

    it('uses the provided framework override', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  api:\n    image: myorg/api:1\n'
      );
      const analysis = await servicesOptimize(tempRoot, 'api', {
        framework: 'fastapi',
      });
      expect(analysis.framework).toBe('fastapi');
    });

    it('defaults to unknown when nothing is detected', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ scripts: { dev: 'node . --port 3000' } })
      );
      const analysis = await servicesOptimize(tempRoot, 'dev', {});
      expect(analysis.framework).toBe('unknown');
      // Only generic recommendations apply
      expect(analysis.estimatedImprovement).toBeTruthy();
    });

    it('stays a dry run by default', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  api:\n    image: myorg/express-api:1\n'
      );
      await servicesOptimize(tempRoot, 'api', {});
      expect(output()).toContain('Dry run - no changes made.');
    });

    it('sorts recommendations by priority', async () => {
      fs.writeFileSync(
        path.join(tempRoot, 'docker-compose.yml'),
        'services:\n  api:\n    image: myorg/express-api:1\n'
      );
      const analysis = await servicesOptimize(tempRoot, 'api', {});
      const ranks = analysis.recommendations.map(r =>
        ({ high: 0, medium: 1, low: 2 })[r.priority]
      );
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    });
  });

  describe('listOptimizationRecommendations', () => {
    it('lists framework-specific recommendations when a known framework is given', async () => {
      await listOptimizationRecommendations('express');
      const out = output();
      expect(out).toContain('Framework-specific optimizations for express');
      expect(out).toContain('Generic optimizations');
    });

    it('falls back to generic-only for unknown frameworks', async () => {
      await listOptimizationRecommendations('nope');
      const out = output();
      expect(out).not.toContain('Framework-specific');
      expect(out).toContain('Generic optimizations');
    });
  });
});
