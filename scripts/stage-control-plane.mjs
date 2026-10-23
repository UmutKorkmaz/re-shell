#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = path.join(root, 'packages/control-plane/docker-compose.yml');
const mode = process.argv[2] ?? '--prepare';
if (!['--prepare', '--up', '--down'].includes(mode)) throw new Error('Use --prepare, --up or --down <stage-directory>.');

function docker(args, capture = false) {
  const dockerEnv = { ...process.env };
  for (const name of Object.keys(dockerEnv)) {
    if (name.startsWith('CONTROL_PLANE_')) delete dockerEnv[name];
  }
  const result = spawnSync('docker', args, { cwd: root, env: dockerEnv, encoding: 'utf8', timeout: args.includes('build') ? 1_200_000 : 30_000,
    maxBuffer: 4 * 1024 * 1024, stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`Docker command failed (${result.error?.code ?? result.status ?? 'unavailable'}).`);
  return result.stdout?.trim() ?? '';
}

if (mode === '--down') {
  const directory = process.argv[3];
  if (!directory) throw new Error('Specify the staging directory printed by --prepare or --up.');
  const manifest = JSON.parse(readFileSync(path.join(directory, 'stage.json'), 'utf8'));
  if (!/^re-shell-stage-[a-f0-9]{8}$/.test(manifest.project)) throw new Error('Invalid staging project.');
  docker(['compose', '-p', manifest.project, '--env-file', path.join(directory, '.env'), '-f', composeFile, 'down', '--volumes']);
  console.log('Removed the staging project; private credential files remain in', directory);
  process.exit(0);
}

const listener = createServer();
await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const directory = mkdtempSync(path.join(os.tmpdir(), 're-shell-stage-'));
const project = `re-shell-stage-${randomBytes(4).toString('hex')}`;
const workspace = path.join(directory, 'workspaces', 'main');
mkdirSync(workspace, { recursive: true });
writeFileSync(path.join(workspace, 'package.json'), JSON.stringify({ name: 're-shell-stage', version: '1.0.0', private: true,
  workspaces: ['apps/*', 'packages/*'], engines: { node: '>=22' } }));
const envFile = path.join(directory, '.env');
const keys = JSON.stringify({ activeKid: 'stage', keys: { stage: randomBytes(32).toString('base64url') } });
let environment = `CONTROL_PLANE_JWT_KEYS='${keys}'\nCONTROL_PLANE_PLATFORM_ADMINS=stage-admin\nCONTROL_PLANE_TENANT=stage\nCONTROL_PLANE_PUBLISH_PORT=${port}\nCONTROL_PLANE_WORKSPACES_DIR=${JSON.stringify(path.dirname(workspace))}\n`;
writeFileSync(envFile, environment, { mode: 0o600 });
writeFileSync(path.join(directory, 'stage.json'), JSON.stringify({ project, port }, null, 2), { mode: 0o600 });
// This older whole-worker smoke is explicitly trusted development. Per-job
// isolation is exercised by test-job-isolation.mjs against a dedicated daemon.
const base = ['compose', '--profile', 'development', '-p', project, '--env-file', envFile, '-f', composeFile];
docker([...base, 'config', '--quiet'], true);
console.log('Prepared private staging configuration:', directory);
console.log('Project:', project, 'loopback URL:', `http://127.0.0.1:${port}`);
if (mode === '--prepare') process.exit(0);

// Refuse an unresponsive engine before starting any containers.
docker(['version', '--format', '{{.Server.Version}}'], true);
docker([...base, 'build']);
const adminToken = docker([...base, 'run', '--rm', '--no-deps', 'control-plane', 'issue-token', '--user', 'stage-admin', '--tenant', 'stage', '--role', 'admin', '--raw'], true);
const workerToken = docker([...base, 'run', '--rm', '--no-deps', 'control-plane', 'issue-token', '--worker', '--worker-id', 'stage-worker', '--tenant', 'stage', '--raw'], true);
if (!/^[A-Za-z0-9_.-]+$/.test(adminToken) || !/^[A-Za-z0-9_.-]+$/.test(workerToken)) throw new Error('Bootstrap did not return valid token output.');
environment += `CONTROL_PLANE_WORKER_TOKEN=${workerToken}\n`;
writeFileSync(envFile, environment, { mode: 0o600 });
writeFileSync(path.join(directory, 'admin.token'), adminToken, { mode: 0o600 });
docker([...base, 'up', '-d', 'control-plane']);
const url = `http://127.0.0.1:${port}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function request(method, route, body) {
  const response = await fetch(`${url}${route}`, { method, headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5_000) });
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new Error(`Staging API failed: ${method} ${route} (${response.status}).`);
  return result.data;
}
let ready = false;
for (let i = 0; i < 30; i += 1) {
  try { await request('GET', '/healthz'); ready = true; break; } catch { await delay(1_000); }
}
if (!ready) throw new Error('Staging did not become healthy. Inspect its unique Compose project.');
await request('PUT', '/tenants/stage/policy', { allowedCommandIds: ['doctor'] });
await request('POST', '/tenants/stage/workspaces', { id: 'main', name: 'Local staging', allowedCommandIds: ['doctor'] });
docker([...base, 'up', '-d', 'worker']);
const submitted = await request('POST', '/tenants/stage/workspaces/main/commands', { commandId: 'doctor', params: {} });
let result;
for (let i = 0; i < 60; i += 1) {
  result = (await request('GET', `/tenants/stage/jobs/${submitted.job.id}`)).job;
  if (['succeeded', 'failed', 'canceled'].includes(result.status)) break;
  await delay(1_000);
}
if (result?.status !== 'succeeded') throw new Error(`Real worker command did not succeed (${result?.status ?? 'unknown'}).`);
console.log('PASS: authenticated tenant/workspace creation, policy, real worker doctor command.');
console.log('Credentials are stored privately in the staging directory; no token was printed.');
console.log('Stop only this project with: node scripts/stage-control-plane.mjs --down', directory);
