#!/usr/bin/env node
// Isolated coturn + real PeerLink integration. No public TURN service or existing container is used.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireWeb = createRequire(path.join(root, 'apps/web/package.json'));
const run = promisify(execFile);
const docker = async (...args) => (await run('docker', args, { encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
const optional = process.argv.includes('--allow-skip');
try {
  const engine = await run('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 15_000 });
  assert.match(engine.stdout.trim(), /^\d+\./, 'Docker did not return a server version');
} catch {
  console.error('TURN_INTEGRATION_UNAVAILABLE: Docker engine is unavailable. No TURN checks ran.');
  process.exit(optional ? 0 : 1);
}
const image = process.env.RE_SHELL_TURN_IMAGE ?? 'coturn/coturn:4.18.0-r0-alpine';
if (!/^coturn\/coturn:\d+\.\d+\.\d+(?:-r\d+)?(?:-alpine|-debian)?(?:@sha256:[a-f0-9]{64})?$/.test(image)) {
  throw new Error('Use a versioned official coturn/coturn image.');
}
const container = `re-shell-turn-${randomUUID()}`;
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-turn-'));
fs.chmodSync(folder, 0o700);
const username = `local-${randomBytes(12).toString('hex')}`;
const credential = randomBytes(32).toString('hex');
let vite;
let browser;
let started = false;
let phase = 'coturn-startup';
const checks = [];

async function cleanup() {
  // Keep all cleanup attempts independent: a browser close error must not orphan our container.
  const actions = [() => browser?.close(), () => vite?.close(), async () => {
    if (!started) return;
    try { await docker('rm', '--force', container); }
    catch (error) {
      // --rm may already have removed an exited owned container.
      if (!String(error.stderr).includes(`No such container: ${container}`)) throw error;
    }
  }, () => fs.rmSync(folder, { recursive: true, force: true })];
  const failures = [];
  for (const action of actions) {
    try { await action(); } catch { failures.push(true); }
  }
  if (failures.length) {
    console.error(`TURN_INTEGRATION_CLEANUP_FAILED: verify owned container ${container} and temporary directory ${folder}.`);
    process.exitCode = 1;
  }
}
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  if (stopping) return;
  stopping = true;
  void cleanup().finally(() => process.exit(1));
});

// A bare RFC 8489 Allocate request must receive a 401 challenge, never a relay allocation.
async function unauthenticatedAllocate(port) {
  const request = Buffer.alloc(28);
  request.writeUInt16BE(0x0003, 0); // Allocate request
  request.writeUInt16BE(8, 2);
  request.writeUInt32BE(0x2112a442, 4);
  randomBytes(12).copy(request, 8);
  request.writeUInt16BE(0x0019, 20); // REQUESTED-TRANSPORT: UDP
  request.writeUInt16BE(4, 22);
  request[24] = 17;
  const socket = dgram.createSocket('udp4');
  try {
    const response = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TURN authentication probe timed out')), 1500);
      socket.once('error', (error) => { clearTimeout(timer); reject(error); });
      socket.on('message', (message) => {
        if (message.length < 20 || !message.subarray(8, 20).equals(request.subarray(8, 20))) return;
        clearTimeout(timer);
        resolve(message);
      });
      socket.send(request, port, '127.0.0.1', (error) => { if (error) { clearTimeout(timer); reject(error); } });
    });
    assert.equal(response.readUInt16BE(0), 0x0113, 'Unauthenticated TURN Allocate was not rejected');
    assert.equal(response.readUInt32BE(4), 0x2112a442);
    const end = 20 + response.readUInt16BE(2);
    assert.equal(response.length >= end, true, 'Truncated TURN response');
    let code;
    for (let offset = 20; offset + 4 <= end;) {
      const type = response.readUInt16BE(offset);
      const length = response.readUInt16BE(offset + 2);
      assert.equal(offset + 4 + length <= end, true, 'Malformed TURN response attribute');
      if (type === 0x0009 && length >= 4) code = response[offset + 6] * 100 + response[offset + 7];
      assert.notEqual(type, 0x0016, 'Unauthenticated TURN request received a relayed address');
      offset += 4 + Math.ceil(length / 4) * 4;
    }
    assert.equal(code, 401, 'TURN server did not require authentication');
  } finally { socket.close(); }
}

try {
  const configFile = path.join(folder, 'turnserver.conf');
  // Loopback peer routing is test-only: both allocations live inside this one isolated container.
  // Browser-to-server sockets are published only on host loopback; no relay range is exposed.
  fs.writeFileSync(configFile, [
    'listening-ip=0.0.0.0', 'listening-port=3478', 'relay-ip=127.0.0.1',
    'min-port=49160', 'max-port=49180', 'relay-threads=1', 'fingerprint', 'lt-cred-mech',
    'realm=re-shell-local.invalid', `user=${username}:${credential}`, `cli-password=${randomBytes(24).toString('hex')}`,
    'no-cli', 'no-tls', 'no-dtls', 'no-tcp-relay', 'allow-loopback-peers', 'no-multicast-peers',
    'pidfile=/tmp/turnserver.pid', 'log-file=stdout', 'simple-log',
  ].join('\n'), { mode: 0o600 });
  // Root is needed only to read the temporary 0600 config mount. No host source or Docker socket is mounted.
  started = true; // Also attempt cleanup after a failed or timed-out Docker run.
  await docker('run', '--detach', '--rm', '--name', container, '--user', '0:0', '--read-only',
    '--tmpfs', '/tmp', '--tmpfs', '/var/lib/coturn', '--memory', '128m', '--cpus', '1',
    '--publish', '127.0.0.1::3478/tcp', '--publish', '127.0.0.1::3478/udp',
    '--volume', `${configFile}:/etc/coturn/test.conf:ro`, image, '-c', '/etc/coturn/test.conf');
  const port = async (protocol) => {
    const bindings = JSON.parse(await docker('inspect', '--format', '{{json .NetworkSettings.Ports}}', container));
    const binding = bindings[`3478/${protocol}`];
    assert.equal(binding.length, 1);
    assert.equal(binding[0].HostIp, '127.0.0.1');
    assert.match(binding[0].HostPort, /^\d+$/);
    return Number(binding[0].HostPort);
  };
  const tcpPort = await port('tcp');
  const udpPort = await port('udp');
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { await unauthenticatedAllocate(udpPort); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  assert.equal(ready, true, 'coturn did not become ready and reject unauthenticated allocation');
  checks.push('real coturn rejects unauthenticated UDP Allocate with 401 and no relayed address');

  phase = 'dashboard-module-server';
  process.env.RE_SHELL_UI_HUB_MANAGED = '1';
  const { createServer } = await import(requireWeb.resolve('vite'));
  vite = await createServer({ root: path.join(root, 'apps/web'), configFile: path.join(root, 'apps/web/vite.config.mts'),
    logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false },
    // Install before Vite's SPA fallback. Only PeerLink and contracts are loaded by the harness.
    plugins: [{ name: 'local-turn-harness', configureServer(server) {
      server.middlewares.use('/__turn_harness', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html><head><title>Local TURN integration</title></head><body>Local TURN integration</body></html>');
      });
    } }],
  });
  await vite.listen();
  const dashboard = `http://127.0.0.1:${vite.httpServer.address().port}/__turn_harness`;
  phase = 'browser-startup';
  const { chromium } = requireWeb('@playwright/test');
  browser = await chromium.launch({ headless: true });
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  assert.notEqual(aliceContext, bobContext);
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();
  const pages = { alice, bob };

  // Signaling is delivered independently of data. Any app relay attempt is a hard failure.
  phase = 'browser-module-loading';
  for (const [selfId, page] of Object.entries(pages)) {
    await page.exposeFunction('deliverTurnSignal', async (input) => {
      const signal = { ...input, from: selfId };
      await pages[input.to].evaluate(async (incoming) => window.turnHarness.link.handleSignal(incoming), signal);
      return { delivered: true };
    });
    await page.goto(dashboard, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async ({ selfId, username, credential, tcpPort }) => {
      const { PeerLink } = await import('/src/collab/peer-link.ts');
      const harness = window.turnHarness = { messages: [], states: [], fallbackAttempts: 0, pc: undefined, link: undefined };
      harness.link = new PeerLink({
        selfId, remoteId: selfId === 'alice' ? 'bob' : 'alice',
        iceServers: [{ urls: `turn:127.0.0.1:${tcpPort}?transport=tcp`, username, credential }],
        connectTimeoutMs: 30_000,
        createPeerConnection: (config) => harness.pc = new RTCPeerConnection({ ...config, iceTransportPolicy: 'relay' }),
        sendSignal: (input) => window.deliverTurnSignal(input),
        sendRelay: async () => { harness.fallbackAttempts += 1; throw new Error('HTTP fallback is forbidden in the TURN integration'); },
        onMessage: (message) => harness.messages.push(message),
        onState: (state, detail) => harness.states.push({ state, detail }),
      });
    }, { selfId, username, credential, tcpPort });
  }
  phase = 'relay-only-peer-link';
  await bob.evaluate(() => window.turnHarness.link.connect());
  await alice.evaluate(() => window.turnHarness.link.connect());
  for (const page of [alice, bob]) {
    await page.waitForFunction(() => window.turnHarness.link.state === 'p2p', undefined, { timeout: 40_000 });
  }
  // "p2p" is the application data-channel state; getStats must prove TURN beneath it.
  const selected = [];
  for (const page of [alice, bob]) {
    selected.push(await page.evaluate(async () => {
      const pc = window.turnHarness.pc;
      const stats = await pc.getStats();
      const transports = [...stats.values()].filter((stat) => stat.type === 'transport' && stat.selectedCandidatePairId);
      const pairs = transports.map((transport) => stats.get(transport.selectedCandidatePairId));
      const pair = pairs.find((candidate) => candidate?.state === 'succeeded' && candidate.nominated)
        ?? [...stats.values()].find((candidate) => candidate.type === 'candidate-pair' && candidate.state === 'succeeded' && candidate.nominated);
      const local = pair && stats.get(pair.localCandidateId);
      const remote = pair && stats.get(pair.remoteCandidateId);
      return { policy: pc.getConfiguration().iceTransportPolicy, nominated: pair?.nominated, state: pair?.state,
        localType: local?.candidateType, remoteType: remote?.candidateType, relayProtocol: local?.relayProtocol };
    }));
  }
  for (const pair of selected) {
    assert.equal(pair.policy, 'relay');
    assert.equal(pair.nominated, true);
    assert.equal(pair.state, 'succeeded');
    assert.equal(pair.localType, 'relay');
    assert.equal(pair.remoteType, 'relay');
    assert.equal(pair.relayProtocol, 'tcp');
  }
  checks.push('two independent Chromium contexts use real PeerLink with relay-only ICE and nominated local+remote relay candidates over TURN TCP');

  phase = 'bidirectional-peer-link-data';
  const nonce = randomUUID();
  for (const [selfId, page] of Object.entries(pages)) {
    assert.equal(await page.evaluate(({ selfId, nonce }) => window.turnHarness.link.send('ping', { from: selfId, nonce }), { selfId, nonce }), 'p2p');
  }
  for (const [selfId, page] of Object.entries(pages)) {
    await page.waitForFunction(({ sender, nonce }) => window.turnHarness.messages.some((message) =>
      message.channel === 'ping' && message.via === 'p2p' && message.payload.from === sender && message.payload.nonce === nonce),
    { sender: selfId === 'alice' ? 'bob' : 'alice', nonce });
    const result = await page.evaluate(() => ({ fallbackAttempts: window.turnHarness.fallbackAttempts,
      states: window.turnHarness.states.map(({ state }) => state) }));
    assert.equal(result.fallbackAttempts, 0);
    assert.equal(result.states.includes('relay'), false, 'PeerLink fell back to the application relay');
  }
  checks.push('unique application ping exchanged in both directions with zero HTTP fallback attempts');
  // Do not emit credentials, SDP, candidate addresses, browser URLs, or coturn logs.
  console.log(JSON.stringify({ result: 'PASS', provider: image, scope: 'isolated local Docker only', checks, selected }));
} catch (error) {
  // Keep the first diagnostic line useful without emitting credentials, SDP or provider logs.
  const reason = String(error instanceof Error ? error.message : 'Unknown failure').split('\n')[0]
    .replaceAll(credential, '[redacted]').replaceAll(username, '[redacted]');
  console.error(`TURN_INTEGRATION_FAILED: ${phase}: ${reason}`);
  process.exitCode = 1;
} finally { await cleanup(); }
