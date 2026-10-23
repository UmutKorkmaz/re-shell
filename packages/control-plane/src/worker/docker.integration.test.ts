import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resolveCommand } from '@re-shell/contracts/command-registry';
import { STANDARD_SEED, startHarness, type Harness } from '../test-support/harness.js';
import { Worker } from './worker.js';
import { containerArgs, dockerCommand, ownerLabel, prepareIsolation, startIsolatedJob, type DockerIsolation, type IsolatedProcess } from './isolation.js';

// Explicit opt-in. Once enabled, an unavailable engine/image FAILS this suite.
const enabled = process.env.RE_SHELL_TEST_DOCKER === '1';
const suite = enabled ? describe : describe.skip;
const baseImage = process.env.CONTROL_PLANE_JOB_IMAGE ?? '';
const config: DockerIsolation = { mode: 'docker', host: process.env.CONTROL_PLANE_DOCKER_HOST ?? '', image: baseImage, workerId: `qa-${randomUUID()}`, cpus: 0.5, memoryMb: 128, pids: 32, uid: 1000, gid: 1000 };
let tmp: string;
let root: string;
let fixtureImage: string;
const fixtureId = randomUUID();
const baseTag = `re-shell-test-base:${fixtureId}`;
const fixtureTag = `re-shell-test-probe:${fixtureId}`;
let taggedBase = false;
let harness: Harness | undefined;
const workers: Worker[] = [];
const executions: IsolatedProcess[] = [];
const ownedVolumes = new Set<string>();
const volumeCaptures: Promise<void>[] = [];
const probe = `
const fs = require('node:fs');
const net = require('node:net');
const action = process.argv[4];
if (action === 'sleep') {
  net.createServer(() => {}).listen(32123, '127.0.0.1', () => console.log('ready'));
  process.on('SIGTERM', () => {});
} else if (action === 'flood') {
  setInterval(() => process.stdout.write('x'.repeat(65536)), 1);
} else {
  const denied = p => { try { fs.readFileSync(p); return false; } catch { return true; } };
  const unreachable = (host, port) => new Promise(resolve => {
    const s = net.connect({host, port});
    s.setTimeout(500); s.on('connect', () => {s.destroy(); resolve(false)});
    s.on('error', () => {s.destroy(); resolve(true)}); s.on('timeout', () => {s.destroy(); resolve(true)});
  });
  (async () => {
    let readOnly = false; try { fs.writeFileSync('/root-write', 'x') } catch { readOnly = true }
    console.log(JSON.stringify({cwd:process.cwd(), uid:process.getuid(), readOnly,
      socketDenied:denied('/var/run/docker.sock'), siblingDenied:denied('/workspace/../sibling/secret'),
      symlinkDenied:denied('/workspace/leak'), secretAbsent:!Object.keys(process.env).some(k=>k.startsWith('CONTROL_PLANE')),
      crossJobDenied:await unreachable('127.0.0.1',32123), egressDenied:await unreachable('1.1.1.1',53)}));
  })();
}
`;

async function launch(args: readonly string[], override: DockerIsolation = { ...config, image: fixtureImage }, exitCodes = [0]): Promise<{ execution: IsolatedProcess; output: Promise<string> }> {
  const execution = await startIsolatedJob(override, 'acme', root, path.join(root, 'main'), path.join(root, 'main'), args);
  executions.push(execution);
  const output = new Promise<string>((resolve, reject) => {
    let stdout = ''; let stderr = '';
    execution.child.stdout?.on('data', (buf) => { stdout += buf.toString(); });
    execution.child.stderr?.on('data', (buf) => { stderr += buf.toString(); });
    execution.child.once('error', reject);
    execution.child.once('close', (code) => code !== null && exitCodes.includes(code) ? resolve(stdout) : reject(new Error(`Docker CLI exit ${code}: ${stderr}`)));
  });
  // Attach a handler immediately for cancellation cases, then assert outcome explicitly.
  void output.catch(() => {});
  const capture = recordOwnedVolumes(override);
  volumeCaptures.push(capture);
  void capture.catch(() => {});
  return { execution, output };
}
async function waitUntil(check: () => Promise<boolean>, timeout = 20_000, interval = 100): Promise<void> {
  const until = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() >= until) throw new Error('Docker isolation condition timed out.');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
const ownedContainers = (override = config) => dockerCommand(override, ['ps', '-aq', '--filter', `label=io.re-shell.owner=${ownerLabel(override, 'acme', root)}`]);
async function recordOwnedVolumes(override = config): Promise<void> {
  const ids = (await ownedContainers(override)).split(/\s+/).filter(Boolean);
  for (const id of ids) {
    let containers: Array<{ Mounts: Array<{ Type: string; Name?: string }> }>;
    try { containers = JSON.parse(await dockerCommand(config, ['inspect', id])); }
    catch (error) {
      // A fast output-limited job may already have been removed by its worker.
      if (/No such (object|container):/i.test(String(error))) continue;
      throw error;
    }
    for (const mount of containers[0].Mounts) if (mount.Type === 'volume' && mount.Name) ownedVolumes.add(mount.Name);
  }
}

suite('real Docker per-job isolation', () => {
  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-docker-'));
    root = path.join(tmp, 'workspaces');
    fs.mkdirSync(path.join(root, 'main'), { recursive: true, mode: 0o777 });
    fs.chmodSync(tmp, 0o755); fs.chmodSync(root, 0o755); fs.chmodSync(path.join(root, 'main'), 0o777);
    fs.mkdirSync(path.join(root, 'sibling'));
    fs.writeFileSync(path.join(root, 'sibling', 'secret'), 'cross-workspace-secret');
    fs.symlinkSync('../sibling/secret', path.join(root, 'main', 'leak'));
    const release = await prepareIsolation(config, 'acme', root); release();
    const context = path.join(tmp, 'image-context');
    fs.mkdirSync(context);
    fs.writeFileSync(path.join(context, 'probe.cjs'), probe);
    // Keep an original tag as an anchor: removing our temporary alias must
    // never delete the caller's pinned base image, including after setup fails.
    const base = JSON.parse(await dockerCommand(config, ['image', 'inspect', baseImage]))[0];
    expect(base.RepoTags?.length, 'The pinned local fixture base must have an existing image tag.').toBeGreaterThan(0);
    taggedBase = true;
    await dockerCommand(config, ['image', 'tag', baseImage, baseTag]);
    // Two-file context, no RUN instructions, no downloaded code. A COPY layer
    // avoids Docker Desktop's slow export of a modified stopped container.
    fs.writeFileSync(path.join(context, 'Dockerfile'), `FROM ${baseTag}\nCOPY probe.cjs /opt/re-shell/dist/index.js\n`);
    // Buildx writes client state; give only this fixture build private config.
    // Worker/cleanup commands retain the production scrubbed environment.
    const dockerConfig = path.join(tmp, 'docker-build-config');
    fs.mkdirSync(dockerConfig, { mode: 0o700 });
    // Docker Desktop bundles its plugin beside the real CLI executable. Locate
    // that installed binary without reading the user's Docker configuration.
    const dockerBin = (process.env.PATH ?? '').split(path.delimiter).map((dir) => path.join(dir, 'docker')).find((file) => fs.existsSync(file));
    const buildx = dockerBin && path.resolve(path.dirname(fs.realpathSync(dockerBin)), '../cli-plugins/docker-buildx');
    if (buildx && fs.existsSync(buildx)) {
      fs.accessSync(buildx, fs.constants.X_OK);
      const plugins = path.join(dockerConfig, 'cli-plugins');
      fs.mkdirSync(plugins, { mode: 0o700 });
      fs.symlinkSync(fs.realpathSync(buildx), path.join(plugins, 'docker-buildx'));
    }
    await new Promise<void>((resolve, reject) => {
      execFile('docker', ['--host', config.host, 'buildx', 'build', '--load', '--pull=false', '--network=none', '--label', `io.re-shell.test-fixture=${fixtureId}`,
        '--tag', fixtureTag, context], { env: { PATH: process.env.PATH, HOME: tmp, DOCKER_CONFIG: dockerConfig, LANG: 'C' },
        timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 }, (error, _stdout, stderr) => {
        if (error) reject(new Error(`Docker fixture build failed: ${String(stderr || error.message).slice(0, 500)}`));
        else resolve();
      });
    });
    fixtureImage = await dockerCommand(config, ['image', 'inspect', '--format', '{{.Id}}', fixtureTag]);
    expect(fixtureImage).toMatch(/^sha256:[a-f0-9]{64}$/);
  }, 180_000);
  afterEach(async () => {
    await Promise.all(volumeCaptures.splice(0));
    for (const worker of workers.splice(0)) await worker.stop();
    for (const execution of executions.splice(0)) await execution.cleanup();
    if (harness) { await harness.close(); harness = undefined; }
    expect(await ownedContainers()).toBe('');
    for (const name of ownedVolumes) await expect(dockerCommand(config, ['volume', 'inspect', name])).rejects.toThrow(/no such volume\b/i);
    ownedVolumes.clear();
  });
  afterAll(async () => {
    const failures: unknown[] = [];
    // Tags are known before the build starts, so a partial setup cannot leave
    // an untracked fixture image. Never remove by the caller's base image ID.
    if (taggedBase) for (const tag of [fixtureTag, baseTag]) {
      try { await dockerCommand(config, ['image', 'rm', tag]); }
      catch (error) { if (!/No such image:/i.test(String(error))) failures.push(error); }
    }
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    if (failures.length) throw new AggregateError(failures, 'Owned Docker fixture image cleanup failed.');
  });

  it('runs the actual allowlisted CLI doctor in the real pinned image', async () => {
    const resolved = resolveCommand('doctor', {});
    if (!resolved.ok) throw new Error(resolved.error);
    const run = await launch(resolved.args, config, [0, 1]);
    const output = await run.output;
    await run.execution.cleanup();
    const report = JSON.parse(output);
    expect(report).toMatchObject({ ok: true, data: { healthy: false } });
    expect(report.data.checks.some((check: {name:string}) => check.name === 'monorepo-detection')).toBe(true);
    expect(output.length).toBeGreaterThan(20);
    console.info('REAL_DOCKER_DOCTOR', output.trim());
  });

  it('blocks egress, cross-job loopback, sibling workspace/symlink, secrets, socket and root writes', async () => {
    const sleeper = await launch(['templates', 'show', 'sleep', '--json']);
    await new Promise<void>((resolve, reject) => {
      sleeper.execution.child.stdout?.once('data', () => resolve());
      sleeper.execution.child.once('error', reject);
    });
    const run = await launch(['doctor', '--json']);
    expect(JSON.parse(await run.output)).toMatchObject({ cwd: '/workspace', uid: 1000, readOnly: true, socketDenied: true, siblingDenied: true, symlinkDenied: true, secretAbsent: true, crossJobDenied: true, egressDenied: true });
    await run.execution.cleanup();
    await sleeper.execution.terminate();
    await expect(sleeper.output).rejects.toThrow('Docker CLI exit');
  });

  it('enforces resource configuration on the running container and scoped orphan recovery', async () => {
    const foreign = { ...config, image: fixtureImage, workerId: `${config.workerId}-foreign` };
    const other = await launch(['templates', 'show', 'sleep'], foreign);
    const run = await launch(['templates', 'show', 'sleep']);
    await waitUntil(async () => (await ownedContainers()).length > 0);
    const id = await ownedContainers();
    const inspect = JSON.parse(await dockerCommand(config, ['inspect', id]))[0];
    expect(inspect.HostConfig).toMatchObject({ ReadonlyRootfs: true, NetworkMode: 'none', Memory: 128 * 1024 * 1024, MemorySwap: 128 * 1024 * 1024, NanoCpus: 500_000_000, PidsLimit: 32, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'] });
    expect(inspect.Mounts.filter((mount: {Type:string}) => mount.Type === 'bind')).toHaveLength(1);
    // Simulate the orchestrator's abrupt death; daemon continues its container.
    run.execution.child.kill('SIGKILL');
    const release = await prepareIsolation({ ...config, image: fixtureImage }, 'acme', root);
    release();
    expect(await ownedContainers()).toBe('');
    expect(await ownedContainers(foreign)).not.toBe('');
    await other.execution.terminate();
  });

  for (const reason of ['timeout', 'cancel', 'shutdown', 'output-limit'] as const) {
    it(`kills AND removes a container after ${reason} through the worker`, async () => {
      const commands = ['doctor', 'templates.show'];
      harness = await startHarness({ seed: { ...STANDARD_SEED, tenants: [{ id: 'acme', name: 'Acme', allowedCommandIds: commands }], workspaces: [{ id: 'main', tenantId: 'acme', name: 'Main', allowedCommandIds: commands }], members: STANDARD_SEED.members.filter((member) => member.tenantId === 'acme') } });
      const h = harness;
      const worker = new Worker({ controlPlaneUrl: h.url, token: h.workerToken(config.workerId, 'acme'), tenantId: 'acme', workspaceRoot: root, cliBin: 'must-never-run-host-cli', claimWaitMs: 100,
        runner: { isolation: { ...config, image: fixtureImage }, heartbeatMs: 300, outputFlushMs: 20, killGraceMs: 100, jobTimeoutMs: reason === 'timeout' ? 10_000 : 60_000, maxOutputChars: reason === 'output-limit' ? 1024 : 4096 } });
      workers.push(worker); worker.start();
      const submitted = await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('bob'), body: { commandId: 'templates.show', params: { id: reason === 'output-limit' ? 'flood' : 'sleep' } } });
      const id = submitted.json.data.job.id;
      await waitUntil(async () => (await ownedContainers()).length > 0);
      await recordOwnedVolumes();
      if (reason === 'cancel') await h.request('POST', `/tenants/acme/jobs/${id}/cancel`, { token: h.userToken('bob') });
      if (reason === 'shutdown') await worker.stop();
      let result: any;
      // Respect the real API's per-user budget while waiting for the 10-second
      // timeout case; 100ms polling exhausts its default burst before completion.
      await waitUntil(async () => {
        const response = await h.request('GET', `/tenants/acme/jobs/${id}`, { token: h.userToken('alice') });
        expect(response.status).toBe(200);
        result = response.json.data;
        return ['succeeded', 'failed', 'canceled'].includes(result.job.status);
      }, 20_000, 500);
      expect(result.job.errorCode).toBe({ timeout: 'TIMEOUT', cancel: 'CANCELED', shutdown: 'WORKER_SHUTDOWN', 'output-limit': 'OUTPUT_LIMIT' }[reason]);
      await worker.stop();
      expect(await ownedContainers()).toBe('');
    });
  }
});
