import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { parse as parseJsonc } from 'jsonc-parser';

import { generateDebugConfig, DebugConfigError } from '../../src/debug/engine';
import { allocateDebugPorts, BASE_PORT, LANGUAGE_KIND, PortAllocationError } from '../../src/debug/ports';
import { mergeLaunchJson, LaunchJsonError } from '../../src/debug/launch';
import { splitCommand, parseDockerfile } from '../../src/debug/compose';
import { debugConfigResponseSchema } from '@re-shell/contracts';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'polyglot-workspace');
const dirs: string[] = [];

function copyFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-debug-'));
  dirs.push(dir);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

type Cfg = Record<string, any>;
function launchOf(dir: string): { configurations: Cfg[]; compounds: Cfg[] } {
  return parseJsonc(fs.readFileSync(path.join(dir, '.vscode', 'launch.json'), 'utf8'));
}
const byName = (cfgs: Cfg[], name: string): Cfg => {
  const c = cfgs.find(x => x.name === name);
  expect(c, `config "${name}" exists`).toBeDefined();
  return c as Cfg;
};

describe('debug port allocation', () => {
  it('starts at the language base port and walks up past collisions', () => {
    const res = allocateDebugPorts(
      [
        { name: 'a', kind: 'node' },
        { name: 'b', kind: 'node' },
        { name: 'c', kind: 'node' },
        { name: 'p', kind: 'python' },
      ],
      [9230]
    );
    expect(res.map(r => [r.name, r.port, r.source])).toEqual([
      ['a', 9229, 'allocated'],
      ['b', 9231, 'allocated'], // 9230 is an application port
      ['c', 9232, 'allocated'],
      ['p', 5678, 'allocated'],
    ]);
  });

  it('is independent of declaration order', () => {
    const reqs = [
      { name: 'z', kind: 'go' as const },
      { name: 'a', kind: 'go' as const },
      { name: 'm', kind: 'go' as const },
    ];
    const forward = allocateDebugPorts(reqs, []);
    const backward = allocateDebugPorts([...reqs].reverse(), []);
    const asMap = (r: typeof forward): Record<string, number | null> => Object.fromEntries(r.map(x => [x.name, x.port]));
    expect(asMap(forward)).toEqual(asMap(backward));
    expect(asMap(forward)).toEqual({ a: 2345, m: 2346, z: 2347 });
  });

  it('honours explicit ports first and never hands them out again', () => {
    const res = allocateDebugPorts(
      [
        { name: 'a', kind: 'node' },
        { name: 'b', kind: 'node', explicit: 9229 },
      ],
      []
    );
    expect(res.find(r => r.name === 'b')).toMatchObject({ port: 9229, source: 'explicit' });
    expect(res.find(r => r.name === 'a')).toMatchObject({ port: 9230, source: 'allocated' });
  });

  it('rejects duplicate explicit ports and explicit ports that collide with an app port', () => {
    expect(() =>
      allocateDebugPorts([{ name: 'a', kind: 'node', explicit: 9300 }, { name: 'b', kind: 'go', explicit: 9300 }], [])
    ).toThrow(PortAllocationError);
    expect(() => allocateDebugPorts([{ name: 'a', kind: 'node', explicit: 3000 }], [3000])).toThrow(/application port/);
  });

  it('dotnet gets no port (pipe attach) and every other adapter has a base port', () => {
    expect(allocateDebugPorts([{ name: 'l', kind: 'dotnet' }], [])).toEqual([{ name: 'l', port: null, source: 'none' }]);
    for (const kind of new Set(Object.values(LANGUAGE_KIND))) {
      if (kind !== 'dotnet') expect(BASE_PORT[kind], kind).toBeGreaterThan(1023);
    }
  });

  it('no two services share a port across the whole fixture workspace', () => {
    const dir = copyFixture();
    const res = generateDebugConfig({ cwd: dir, dryRun: true });
    const ports = res.services.map(s => s.debugPort).filter((p): p is number => p !== null);
    expect(new Set(ports).size).toBe(ports.length);
    // none collides with application ports (3000, 4000, 8081, 8000, 8080, 8082, 3001, 7700, 7701, 8090, 5100)
    for (const app of [3000, 4000, 8081, 8000, 8080, 8082, 3001, 7700, 7701, 8090, 5100]) expect(ports).not.toContain(app);
  });
});

describe('debug config generation on the polyglot fixture', () => {
  it('dry-run writes nothing and returns a schema-valid report', () => {
    const dir = copyFixture();
    const res = generateDebugConfig({ cwd: dir, dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.written).toBe(false);
    expect(fs.existsSync(path.join(dir, '.vscode'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'docker-compose.debug.yml'))).toBe(false);
    expect(debugConfigResponseSchema.safeParse(res).success).toBe(true);
    expect(res.out).toBe(path.join(fs.realpathSync(dir), '.vscode', 'launch.json').replace(fs.realpathSync(dir), dir));
  });

  it('emits the right adapter per language with ports from the allocation', () => {
    const dir = copyFixture();
    const res = generateDebugConfig({ cwd: dir });
    expect(res.written).toBe(true);
    const { configurations: cfgs } = launchOf(dir);

    // node: inspector attach + launch via the project's own dev script
    expect(byName(cfgs, 're-shell: api (attach)')).toMatchObject({ type: 'node', request: 'attach', port: 9229, address: 'localhost' });
    expect(byName(cfgs, 're-shell: web (attach)').port).toBe(9230);
    expect(byName(cfgs, 're-shell: api (launch)')).toMatchObject({
      type: 'node',
      request: 'launch',
      runtimeExecutable: 'npm',
      runtimeArgs: ['run', 'dev'],
      cwd: '${workspaceFolder}/services/api',
    });
    expect(byName(cfgs, 're-shell: api (launch)').env).toMatchObject({ PORT: '4000', BILLING_URL: 'http://billing:8081' });

    // python: debugpy attach with path mapping from the Dockerfile WORKDIR; uvicorn launch
    expect(byName(cfgs, 're-shell: analytics (attach)')).toMatchObject({
      type: 'debugpy',
      request: 'attach',
      connect: { host: 'localhost', port: 5678 },
      pathMappings: [{ localRoot: '${workspaceFolder}/services/analytics', remoteRoot: '/srv/app' }],
    });
    expect(byName(cfgs, 're-shell: analytics (launch)')).toMatchObject({ type: 'debugpy', module: 'uvicorn', args: ['app.main:app', '--port', '8000'] });

    // go: delve remote attach with substitutePath from the Dockerfile; launch on the module dir
    expect(byName(cfgs, 're-shell: gateway (attach)')).toMatchObject({
      type: 'go',
      request: 'attach',
      mode: 'remote',
      port: 2346,
      substitutePath: [{ from: '${workspaceFolder}/services/gateway', to: '/go/src/gateway' }],
    });
    expect(byName(cfgs, 're-shell: gateway (launch)')).toMatchObject({ type: 'go', request: 'launch', program: '${workspaceFolder}/services/gateway' });

    // rust: codelldb launch (cargo build of the right bin) + gdb-remote attach
    expect(byName(cfgs, 're-shell: search (launch)')).toMatchObject({
      type: 'lldb',
      request: 'launch',
      cargo: { args: ['build', '--manifest-path=${workspaceFolder}/services/search/Cargo.toml', '--bin=search'] },
    });
    expect(byName(cfgs, 're-shell: search (attach)')).toMatchObject({ type: 'lldb', processCreateCommands: ['gdb-remote localhost:1235'] });

    // java: attach on the JDWP port
    expect(byName(cfgs, 're-shell: billing (attach)')).toMatchObject({ type: 'java', request: 'attach', port: 5005, hostName: 'localhost' });

    // php: xdebug listener
    expect(byName(cfgs, 're-shell: reports (xdebug)')).toMatchObject({ type: 'php', request: 'launch', port: 9003 });

    // ruby: rdbg
    expect(byName(cfgs, 're-shell: mailer (attach)')).toMatchObject({ type: 'rdbg', request: 'attach', debugPort: 'localhost:12345' });
    expect(byName(cfgs, 're-shell: mailer (launch)')).toMatchObject({ type: 'rdbg', request: 'launch', command: 'rackup', script: 'config.ru', useBundler: true });

    // dotnet: coreclr; attach via docker pipe transport, launch of the Debug dll named from the csproj
    expect(byName(cfgs, 're-shell: ledger (attach)')).toMatchObject({
      type: 'coreclr',
      request: 'attach',
      pipeTransport: { pipeProgram: 'docker', pipeArgs: ['compose', 'exec', '-T', 'ledger'], debuggerPath: '/vsdbg/vsdbg' },
    });
    expect(byName(cfgs, 're-shell: ledger (launch)')).toMatchObject({
      type: 'coreclr',
      request: 'launch',
      program: '${workspaceFolder}/services/ledger/bin/Debug/net8.0/Ledger.dll',
    });
  });

  it('adds a compound that debugs every service together', () => {
    const dir = copyFixture();
    const res = generateDebugConfig({ cwd: dir });
    const { configurations, compounds } = launchOf(dir);
    expect(res.compound?.name).toBe('re-shell: all services');
    const compound = byName(compounds, 're-shell: all services');
    expect(compound.stopAll).toBe(true);
    expect(compound.configurations).toHaveLength(res.services.length);
    const names = new Set(configurations.map(c => c.name));
    for (const n of compound.configurations) expect(names.has(n), n).toBe(true);
    expect(compound.configurations).toContain('re-shell: reports (xdebug)');
    expect(compound.configurations).toContain('re-shell: api (attach)');
  });

  it('--services restricts configs, keeps the ports stable and names the compound after the subset', () => {
    const dir = copyFixture();
    const all = generateDebugConfig({ cwd: dir, dryRun: true });
    const sub = generateDebugConfig({ cwd: dir, services: ['web', 'gateway'], dryRun: true });
    expect(sub.services.map(s => s.name)).toEqual(['web', 'gateway']);
    for (const s of sub.services) expect(s.debugPort).toBe(all.services.find(a => a.name === s.name)!.debugPort);
    expect(sub.compound?.name).toBe('re-shell: web + gateway');
    expect(sub.compose?.services).toEqual(['web', 'gateway']);
  });

  it('a single selected service gets no compound', () => {
    const dir = copyFixture();
    const res = generateDebugConfig({ cwd: dir, services: ['api'], dryRun: true });
    expect(res.compound).toBeNull();
    expect(res.launch.content).not.toContain('"compounds"');
  });

  it('honours metadata.debugPort from the service config', () => {
    const dir = copyFixture();
    const cfgPath = path.join(dir, 're-shell.workspaces.yaml');
    fs.writeFileSync(
      cfgPath,
      fs.readFileSync(cfgPath, 'utf8').replace('    path: services/api\n', "    path: services/api\n    metadata:\n      debugPort: '9300'\n")
    );
    const res = generateDebugConfig({ cwd: dir, dryRun: true });
    expect(res.services.find(s => s.name === 'api')).toMatchObject({ debugPort: 9300, portSource: 'explicit' });
    // the next node service now takes the freed base port
    expect(res.services.find(s => s.name === 'web')).toMatchObject({ debugPort: 9229, portSource: 'allocated' });
  });

  it('rejects an invalid or colliding explicit debug port', () => {
    const dir = copyFixture();
    const cfgPath = path.join(dir, 're-shell.workspaces.yaml');
    const base = fs.readFileSync(cfgPath, 'utf8');
    fs.writeFileSync(cfgPath, base.replace('    path: services/api\n', "    path: services/api\n    metadata:\n      debugPort: 'abc'\n"));
    expect(() => generateDebugConfig({ cwd: dir, dryRun: true })).toThrow(/invalid metadata.debugPort/);
    fs.writeFileSync(cfgPath, base.replace('    path: services/api\n', "    path: services/api\n    metadata:\n      debugPort: '3000'\n"));
    expect(() => generateDebugConfig({ cwd: dir, dryRun: true })).toThrow(/collides with a service application port/);
  });

  it('skips services whose language has no debug adapter and reports them', () => {
    const dir = copyFixture();
    const cfgPath = path.join(dir, 're-shell.workspaces.yaml');
    fs.writeFileSync(
      cfgPath,
      fs.readFileSync(cfgPath, 'utf8') +
        '\n  zeta:\n    name: zeta\n    type: backend\n    language: elixir\n    framework: phoenix\n    path: services/zeta\n    port: 4100\n'
    );
    const res = generateDebugConfig({ cwd: dir, dryRun: true });
    expect(res.skipped).toEqual([{ name: 'zeta', language: 'elixir', reason: expect.stringContaining('no debug adapter') }]);
    expect(res.services.map(s => s.name)).not.toContain('zeta');
  });

  it('errors clearly for unknown services and for a missing workspace', () => {
    const dir = copyFixture();
    try {
      generateDebugConfig({ cwd: dir, services: ['nope'], dryRun: true });
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DebugConfigError);
      expect((err as DebugConfigError).code).toBe('DEBUG_CONFIG_ERROR');
      expect((err as DebugConfigError).details?.available).toContain('api');
    }
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-debug-empty-'));
    dirs.push(empty);
    expect(() => generateDebugConfig({ cwd: empty })).toThrow(expect.objectContaining({ code: 'WORKSPACE_NOT_FOUND' }));
  });

  it('without a compose file there is no override and no path mappings', () => {
    const dir = copyFixture();
    fs.rmSync(path.join(dir, 'docker-compose.yml'));
    const res = generateDebugConfig({ cwd: dir });
    expect(res.compose).toBeNull();
    expect(res.services.every(s => !s.inCompose)).toBe(true);
    const { configurations } = launchOf(dir);
    expect(byName(configurations, 're-shell: analytics (attach)').pathMappings).toBeUndefined();
    expect(byName(configurations, 're-shell: api (attach)').remoteRoot).toBeUndefined();
    expect(byName(configurations, 're-shell: ledger (attach)').processId).toBe('${command:pickProcess}');
  });

  it('--no-compose skips the override even when compose services exist', () => {
    const dir = copyFixture();
    const res = generateDebugConfig({ cwd: dir, noCompose: true });
    expect(res.compose).toBeNull();
    expect(fs.existsSync(path.join(dir, 'docker-compose.debug.yml'))).toBe(false);
  });

  it('--out writes launch.json elsewhere and resolves ${workspaceFolder} relative to it', () => {
    const dir = copyFixture();
    const out = path.join(dir, 'tools', 'ide', 'launch.json');
    generateDebugConfig({ cwd: dir, out, noCompose: true, services: ['api'] });
    const doc = parseJsonc(fs.readFileSync(out, 'utf8'));
    expect(doc.configurations[0].cwd ?? doc.configurations[1].cwd).toBe('${workspaceFolder}/../../services/api');
  });
});

describe('launch.json merge', () => {
  const generated = [
    { name: 're-shell: api (attach)', type: 'node', request: 'attach', port: 9229 },
    { name: 're-shell: web (attach)', type: 'node', request: 'attach', port: 9230 },
  ];
  const compounds = [{ name: 're-shell: all services', configurations: generated.map(g => g.name), stopAll: true }];

  const existing = `// my launch file
{
  "version": "0.2.0",
  "configurations": [
    // keep me
    {
      "name": "My custom config",
      "type": "node",
      "request": "launch",
      "program": "\${workspaceFolder}/x.js", // inline comment
    },
    {
      "name": "re-shell: api (attach)",
      "type": "node",
      "request": "attach",
      "port": 1111
    }
  ],
  "inputs": [],
}
`;

  it('preserves user configurations, comments and unrelated keys; updates only same-named entries', () => {
    const r = mergeLaunchJson(existing, generated, compounds);
    expect(r.created).toBe(false);
    expect(r.added.sort()).toEqual(['re-shell: all services', 're-shell: web (attach)']);
    expect(r.updated).toEqual(['re-shell: api (attach)']);
    expect(r.preserved).toBe(1);
    // user content is still there verbatim
    expect(r.text).toContain('// my launch file');
    expect(r.text).toContain('// keep me');
    expect(r.text).toContain('"program": "${workspaceFolder}/x.js", // inline comment');
    expect(r.text).toContain('"inputs": []');
    const doc = parseJsonc(r.text);
    expect(doc.configurations.map((c: Cfg) => c.name)).toEqual(['My custom config', 're-shell: api (attach)', 're-shell: web (attach)']);
    expect(doc.configurations[1].port).toBe(9229); // updated
    expect(doc.compounds[0].name).toBe('re-shell: all services');
  });

  it('is idempotent: merging the same input twice changes nothing the second time', () => {
    const once = mergeLaunchJson(existing, generated, compounds);
    const twice = mergeLaunchJson(once.text, generated, compounds);
    expect(twice.text).toBe(once.text);
    expect(twice.added).toEqual([]);
    expect(twice.updated).toEqual([]);
    expect(twice.unchanged.sort()).toEqual(['re-shell: all services', 're-shell: api (attach)', 're-shell: web (attach)']);
  });

  it('creates a fresh file when none exists', () => {
    const r = mergeLaunchJson(null, generated, compounds);
    expect(r.created).toBe(true);
    expect(JSON.parse(r.text)).toEqual({ version: '0.2.0', configurations: generated, compounds });
    expect(mergeLaunchJson('', generated, []).created).toBe(true);
  });

  it('adds missing configurations/compounds arrays and a version to a minimal file', () => {
    const r = mergeLaunchJson('{}', generated, compounds);
    const doc = JSON.parse(r.text);
    expect(doc.version).toBe('0.2.0');
    expect(doc.configurations).toHaveLength(2);
    expect(doc.compounds).toHaveLength(1);
  });

  it('keeps tab indentation of the existing file', () => {
    const tabs = '{\n\t"version": "0.2.0",\n\t"configurations": [\n\t\t{ "name": "mine", "type": "node", "request": "launch" }\n\t]\n}\n';
    const r = mergeLaunchJson(tabs, generated, []);
    expect(r.text).toContain('\t\t{ "name": "mine", "type": "node", "request": "launch" }');
    expect(r.text).toMatch(/\n\t\t\{\n\t\t\t"name": "re-shell: api \(attach\)"/);
  });

  it('refuses to overwrite a launch.json that is not valid JSONC', () => {
    expect(() => mergeLaunchJson('{ "configurations": [ {', generated, [])).toThrow(LaunchJsonError);
    expect(() => mergeLaunchJson('[1,2]', generated, [])).toThrow(/not valid JSONC/);
  });

  it('end to end: an existing user launch.json survives `debug config`, and a re-run is a no-op', () => {
    const dir = copyFixture();
    const file = path.join(dir, '.vscode', 'launch.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, existing);
    const first = generateDebugConfig({ cwd: dir, services: ['api', 'web'], noCompose: true });
    expect(first.launch.preserved).toBe(1);
    const text1 = fs.readFileSync(file, 'utf8');
    expect(text1).toContain('// keep me');
    expect(text1).toContain('My custom config');
    const second = generateDebugConfig({ cwd: dir, services: ['api', 'web'], noCompose: true });
    expect(second.launch.added).toEqual([]);
    expect(second.launch.updated).toEqual([]);
    expect(fs.readFileSync(file, 'utf8')).toBe(text1);
  });

  it('warns about generated entries from a previous run that are no longer regenerated (and keeps them)', () => {
    const dir = copyFixture();
    generateDebugConfig({ cwd: dir, services: ['api', 'web'], noCompose: true });
    const res = generateDebugConfig({ cwd: dir, services: ['api'], noCompose: true });
    expect(res.warnings.join('\n')).toMatch(/re-shell: web \(attach\)/);
    expect(launchOf(dir).configurations.map(c => c.name)).toContain('re-shell: web (attach)');
  });
});

describe('docker-compose debug override', () => {
  it('wraps/annotates each service per language and is valid YAML', () => {
    const dir = copyFixture();
    const res = generateDebugConfig({ cwd: dir });
    expect(res.compose?.written).toBe(true);
    const doc = yaml.load(fs.readFileSync(path.join(dir, 'docker-compose.debug.yml'), 'utf8')) as { services: Record<string, Cfg> };
    const s = doc.services;
    expect(s.api).toMatchObject({ environment: { NODE_OPTIONS: '--inspect=0.0.0.0:9229' }, ports: ['9229:9229'] });
    expect(s.billing).toMatchObject({
      environment: { JAVA_TOOL_OPTIONS: '-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005' },
      ports: ['5005:5005'],
    });
    expect(s.analytics.command).toEqual([
      'python', '-m', 'debugpy', '--listen', '0.0.0.0:5678', '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000',
    ]);
    expect(s.gateway).toMatchObject({ cap_add: ['SYS_PTRACE'], security_opt: ['seccomp:unconfined'], ports: ['2346:2346'] });
    expect(s.gateway.command).toEqual([
      'dlv', 'exec', '--headless', '--accept-multiclient', '--continue', '--api-version=2', '--listen=:2346', './gateway', '--', '--port', '8080',
    ]);
    expect(s.search.command).toEqual(['gdbserver', '0.0.0.0:1235', './search']);
    expect(s.mailer.environment).toEqual({ RUBY_DEBUG_OPEN: 'true', RUBY_DEBUG_HOST: '0.0.0.0', RUBY_DEBUG_PORT: '12345' });
    expect(s.reports).toMatchObject({
      environment: { XDEBUG_MODE: 'debug', XDEBUG_CONFIG: 'client_host=host.docker.internal client_port=9003' },
      extra_hosts: ['host.docker.internal:host-gateway'],
    });
    expect(s.reports.ports).toBeUndefined(); // xdebug connects out to the IDE
    expect(s.ledger.volumes).toEqual(['./.vsdbg:/vsdbg:ro']);
    // only compose services are covered; indexer is not in the compose file
    expect(Object.keys(s)).not.toContain('indexer');
    expect(Object.keys(s)).not.toContain('db');
    expect(res.notes.join('\n')).toMatch(/debugpy installed/);
    expect(res.notes.join('\n')).toMatch(/edge: command not wrapped for delve/);
  });

  it('appends to an existing NODE_OPTIONS instead of replacing it', () => {
    const dir = copyFixture();
    const f = path.join(dir, 'docker-compose.yml');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('      NODE_ENV: production\n      BILLING_URL', '      NODE_ENV: production\n      NODE_OPTIONS: --max-old-space-size=512\n      BILLING_URL'));
    const res = generateDebugConfig({ cwd: dir, services: ['api'], dryRun: true });
    const doc = yaml.load(res.compose!.content) as { services: Record<string, Cfg> };
    expect(doc.services.api.environment.NODE_OPTIONS).toBe('--max-old-space-size=512 --inspect=0.0.0.0:9229');
  });

  it('wraps the Dockerfile CMD when compose defines no command', () => {
    const dir = copyFixture();
    const f = path.join(dir, 'docker-compose.yml');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('    command: uvicorn app.main:app --host 0.0.0.0 --port 8000\n', ''));
    const res = generateDebugConfig({ cwd: dir, services: ['analytics'], dryRun: true });
    const doc = yaml.load(res.compose!.content) as { services: Record<string, Cfg> };
    expect(doc.services.analytics.command.slice(0, 7)).toEqual(['python', '-m', 'debugpy', '--listen', '0.0.0.0:5678', '-m', 'uvicorn']);
  });

  it('refuses to wrap an entrypoint/shell command and says so', () => {
    const dir = copyFixture();
    const f = path.join(dir, 'docker-compose.yml');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('    command: uvicorn app.main:app --host 0.0.0.0 --port 8000\n', '    command: sh -c "migrate && uvicorn app.main:app"\n'));
    const res = generateDebugConfig({ cwd: dir, services: ['analytics'], dryRun: true });
    const doc = yaml.load(res.compose!.content) as { services: Record<string, Cfg> };
    expect(doc.services.analytics.command).toBeUndefined();
    expect(doc.services.analytics.ports).toEqual(['5678:5678']);
    expect(res.notes.join('\n')).toMatch(/analytics: command not wrapped for debugpy \(the command runs through a shell or process wrapper/);
  });

  const hasCompose = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' }).status === 0;
  it.skipIf(!hasCompose)('merges with the base compose file under `docker compose config` (real validation)', () => {
    const dir = copyFixture();
    generateDebugConfig({ cwd: dir });
    const r = spawnSync(
      'docker',
      ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.debug.yml', 'config', '--format', 'json'],
      { cwd: dir, encoding: 'utf8' }
    );
    expect(r.status, r.stderr).toBe(0);
    const merged = JSON.parse(r.stdout) as { services: Record<string, any> };
    // base settings survive, debug settings are layered on top
    expect(merged.services.api.environment.NODE_ENV).toBe('production');
    expect(merged.services.api.environment.NODE_OPTIONS).toBe('--inspect=0.0.0.0:9229');
    expect(merged.services.api.ports.map((p: any) => p.published)).toEqual(expect.arrayContaining(['4000', '9229']));
    expect(merged.services.analytics.command[0]).toBe('python');
    expect(merged.services.analytics.command).toContain('debugpy');
    expect(merged.services.gateway.cap_add).toEqual(['SYS_PTRACE']);
    expect(merged.services.reports.extra_hosts).toEqual(['host.docker.internal=host-gateway']);
    expect(merged.services.billing.environment.JAVA_TOOL_OPTIONS).toContain('jdwp');
    expect(merged.services.billing.environment.SPRING_PROFILES_ACTIVE).toBe('prod');
  });
});

describe('compose helpers', () => {
  it('splitCommand tokenizes quotes and rejects shell syntax', () => {
    expect(splitCommand('uvicorn app:app --host "0.0.0.0" --name \'a b\'')).toEqual(['uvicorn', 'app:app', '--host', '0.0.0.0', '--name', 'a b']);
    expect(splitCommand('a && b')).toBeNull();
    expect(splitCommand('echo $HOME')).toBeNull();
    expect(splitCommand('unterminated "quote')).toBeNull();
  });

  it('parseDockerfile reads the last stage WORKDIR/CMD and flags ENTRYPOINT', () => {
    const df = 'FROM a AS build\nWORKDIR /build\nCMD ["x"]\nFROM b\nWORKDIR /srv\nWORKDIR app\nCMD node server.js --port 80\n';
    expect(parseDockerfile(df)).toEqual({ workdir: '/srv/app', cmd: ['node', 'server.js', '--port', '80'], entrypoint: false });
    expect(parseDockerfile('FROM x\nENTRYPOINT ["a"]\n').entrypoint).toBe(true);
  });
});
