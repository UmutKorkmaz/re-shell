import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export interface DockerIsolation {
  mode: 'docker';
  /** Explicit dedicated local daemon. Never inherit DOCKER_HOST/context. */
  host: string;
  /** Immutable, already-present image ID or repository digest. */
  image: string;
  workerId: string;
  cpus: number;
  memoryMb: number;
  pids: number;
  uid: number;
  gid: number;
}
export type Isolation = { mode: 'process' } | DockerIsolation;
const MANAGED = 'io.re-shell.job';
const OWNER = 'io.re-shell.owner';
const COMMAND_TIMEOUT = 30_000;

export function validateIsolation(config: Isolation): void {
  if (config.mode === 'process') return;
  if (config.mode !== 'docker' || !/^unix:\/\/\/.+/.test(config.host) || /[\r\n\0]/.test(config.host)) throw new Error('Docker isolation requires an explicit local unix:// daemon.');
  if (!/^(sha256:[a-f0-9]{64}|[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64})$/.test(config.image)) throw new Error('Docker isolation requires a pinned image ID or digest (no mutable tags).');
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(config.workerId)) throw new Error('Docker workerId must be a stable plain identifier.');
  if (!Number.isFinite(config.cpus) || config.cpus < 0.1 || config.cpus > 64 || !Number.isInteger(config.memoryMb) || config.memoryMb < 64 || config.memoryMb > 65536 || !Number.isInteger(config.pids) || config.pids < 16 || config.pids > 4096 || !Number.isInteger(config.uid) || config.uid < 1 || !Number.isInteger(config.gid) || config.gid < 1) throw new Error('Invalid Docker resource limits or non-root uid/gid.');
}

// The orchestrator can access the daemon; its token/config never enters a job.
const dockerEnv = (): NodeJS.ProcessEnv => ({ PATH: process.env.PATH, HOME: '/nonexistent', DOCKER_CONFIG: '/nonexistent', LANG: 'C' });
export function dockerCommand(config: DockerIsolation, args: string[], timeoutMs = COMMAND_TIMEOUT): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('docker', ['--host', config.host, ...args], { env: dockerEnv(), timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`Docker ${args[0]} failed: ${String(stderr || error.message).slice(0, 500)}`));
      else resolve(stdout.trim());
    });
  });
}

export function ownerLabel(config: DockerIsolation, tenantId: string, root: string): string {
  return createHash('sha256').update(`${config.workerId}\0${tenantId}\0${fs.realpathSync(root)}`).digest('hex');
}

/** Exact labels + a host lock prevent one orchestrator from reaping another's jobs. */
export async function prepareIsolation(config: DockerIsolation, tenantId: string, root: string): Promise<() => void> {
  validateIsolation(config);
  const owner = ownerLabel(config, tenantId, root);
  const release = acquireOwnerLock(root, owner);
  try {
    const info = JSON.parse(await dockerCommand(config, ['info', '--format', '{{json .}}'])) as Record<string, unknown>;
    if (info.OSType !== 'linux') throw new Error('Docker isolation requires a Linux daemon.');
    if (['MemoryLimit', 'SwapLimit', 'PidsLimit', 'CpuCfsQuota'].some((key) => info[key] !== true)) throw new Error('Dedicated Docker daemon must enforce memory, swap, pids and CPU quota limits.');
    await dockerCommand(config, ['image', 'inspect', config.image]);
    const ids = await dockerCommand(config, ['ps', '-aq', '--filter', `label=${MANAGED}=1`, '--filter', `label=${OWNER}=${owner}`]);
    for (const id of ids.split(/\s+/).filter(Boolean)) {
      if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('Invalid container ID during recovery.');
      await dockerCommand(config, ['rm', '--force', '--volumes', id]);
    }
    return release;
  } catch (error) { release(); throw error; }
}

/** Serialize stale recovery before observing/removing any previous lock generation. */
export function acquireOwnerLock(root: string, owner: string): () => void {
  const state = path.join(fs.realpathSync(root), '.re-shell-workers');
  fs.mkdirSync(state, { recursive: true, mode: 0o700 });
  const lock = path.join(state, `${owner}.lock`);
  const guard = path.join(state, `${owner}.recovery`);
  // This guard is held only for synchronous filesystem operations. A process
  // killed inside this tiny critical section requires explicit operator recovery.
  try { fs.mkdirSync(guard, { mode: 0o700 }); }
  catch { throw new Error('Worker owner recovery is already active or interrupted; operator recovery required.'); }
  const generation = randomUUID();
  try {
    if (fs.existsSync(lock)) {
    let pid: number;
    try { pid = Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8')); }
    catch { throw new Error('Worker isolation lock is incomplete; operator recovery required.'); }
    if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Invalid isolation lock.');
    try { process.kill(pid, 0); throw new Error('Docker worker owner is already active.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    fs.rmSync(lock, { recursive: true });
    }
    fs.mkdirSync(lock, { mode: 0o700 });
    fs.writeFileSync(path.join(lock, 'pid'), String(process.pid), { mode: 0o600 });
    fs.writeFileSync(path.join(lock, 'generation'), generation, { mode: 0o600 });
  } finally { fs.rmdirSync(guard); }
  return (): void => {
    try {
      if (fs.readFileSync(path.join(lock, 'generation'), 'utf8') === generation) fs.rmSync(lock, { recursive: true });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  };
}

export function containerArgs(config: DockerIsolation, owner: string, name: string, workspace: string, cwd: string, cliArgs: readonly string[]): string[] {
  // Docker's --mount parser uses commas as separators. Reject rather than reinterpret.
  if (/[\r\n,\0]/.test(workspace)) throw new Error('Workspace path cannot be represented safely as a Docker bind mount.');
  const real = fs.realpathSync(workspace);
  if (/[\r\n,\0]/.test(real)) throw new Error('Workspace realpath cannot be represented safely as a Docker bind mount.');
  const realCwd = fs.realpathSync(cwd);
  const relative = path.relative(real, realCwd);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || !fs.statSync(realCwd).isDirectory()) throw new Error('cwd escapes workspace or is not a directory.');
  return ['create', '--name', name, '--pull=never', '--label', `${MANAGED}=1`, '--label', `${OWNER}=${owner}`,
    '--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
    '--cpus', String(config.cpus), '--memory', `${config.memoryMb}m`, '--memory-swap', `${config.memoryMb}m`, '--pids-limit', String(config.pids),
    '--user', `${config.uid}:${config.gid}`, '--ipc=private', '--log-driver=none',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777',
    '--mount', `type=bind,src=${real},dst=/workspace,bind-propagation=rprivate,bind-recursive=disabled`,
    '--attach', 'stdout', '--attach', 'stderr',
    '--workdir', path.posix.join('/workspace', relative.split(path.sep).join('/')),
    // env -i also scrubs image-baked variables; Docker --env alone only adds
    // overrides and would leave image secrets/NODE_OPTIONS in the CLI process.
    '--entrypoint', '/usr/bin/env', config.image, '-i',
    'PATH=/usr/local/bin:/usr/bin:/bin', 'NODE_ENV=production', 'HOME=/tmp', 'TMPDIR=/tmp', 'CI=1', 'NO_COLOR=1', 'FORCE_COLOR=0', 'TERM=dumb',
    '/usr/local/bin/node', '/opt/re-shell/dist/index.js', ...cliArgs];
}

export interface IsolatedProcess {
  child: ChildProcess;
  terminate(): Promise<void>;
  cleanup(): Promise<void>;
}
export class IsolationSetupError extends Error {
  constructor(message: string, readonly code: string, readonly fatal = false) { super(message); }
}

export async function startIsolatedJob(config: DockerIsolation, tenantId: string, root: string, workspace: string, cwd: string, args: readonly string[], shutdown?: AbortSignal, deadline?: number): Promise<IsolatedProcess> {
  const owner = ownerLabel(config, tenantId, root);
  const name = `re-shell-job-${randomUUID()}`;
  const runArgs = containerArgs(config, owner, name, workspace, cwd, args);
  const remove = async (): Promise<void> => {
    try { await dockerCommand(config, ['rm', '--force', '--volumes', name]); }
    catch (error) {
      // Only an explicit not-found proves absence. A daemon error is not success.
      if (!/No such container:/i.test((error as Error).message)) throw error;
    }
  };
  try {
    const id = await dockerCommand(config, runArgs);
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('Docker create returned an invalid container ID.');
    if (shutdown?.aborted) throw new IsolationSetupError('The worker stopped before the container started.', 'WORKER_SHUTDOWN');
    if (deadline !== undefined && Date.now() >= deadline) throw new IsolationSetupError('The job timed out before the container started.', 'TIMEOUT');
  } catch (error) {
    try { await remove(); }
    catch (cleanupError) { throw new IsolationSetupError(`Container setup/cleanup unconfirmed: ${String(cleanupError).slice(0, 500)}`, 'ISOLATION_FAILED', true); }
    throw error;
  }
  const child = spawn('docker', ['--host', config.host, 'start', '--attach', name], { env: dockerEnv(), shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let removing: Promise<void> | undefined;
  return {
    child,
    terminate: () => removing ??= remove(),
    cleanup: async () => {
      // A cancellation can race the Docker attachment closing. Serialize the
      // final retry, including the create-versus-remove startup race.
      await removing?.catch(() => {});
      await remove();
    },
  };
}
