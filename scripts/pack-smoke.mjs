#!/usr/bin/env node
/**
 * Clean-install smoke test for the published packages.
 *
 * What a user gets from `npm install @re-shell/cli @re-shell/mcp` is not what the
 * monorepo checkout contains: files are filtered through each package's `files`
 * list, workspace: specifiers are rewritten, bin shims are symlinks, and nothing
 * from the repo's node_modules is on the resolution path. This script reproduces
 * that from a real packed tarball and exercises the installed result:
 *
 *   1. `pnpm pack` @re-shell/contracts, @re-shell/cli and @re-shell/mcp into a temp dir
 *      (the cli's `prepack` hook builds the dashboard bundle into the tarball).
 *   2. `npm install` the three tarballs into a FRESH directory outside the repo.
 *   3. Run the installed binaries and assert on their real output:
 *        - `re-shell --version`            stdout is EXACTLY the package version
 *        - `re-shell --help`               exit 0
 *        - `re-shell templates list --json` parseable envelope, >= 200 templates
 *        - `re-shell ui --dry-run --json`  finds the dashboard bundled in the package
 *        - `re-shell-mcp`                  MCP initialize + tools/list over stdio
 *
 * Every check runs even if an earlier one failed, and the process exits non-zero
 * when any check fails. Nothing here is mocked: a check passes only when the real
 * installed artifact behaves correctly.
 *
 * Usage:
 *   node scripts/pack-smoke.mjs [--no-build] [--keep]
 *     --no-build  skip building contracts/ui/mcp first (use existing dist output)
 *     --keep      keep the temp directory (it is always kept when a check fails)
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const args = new Set(process.argv.slice(2));
const SKIP_BUILD = args.has('--no-build');
const KEEP = args.has('--keep') || process.env.PACK_SMOKE_KEEP === '1';

/** Packages under test, in dependency order (contracts first). */
const PACKAGES = [
  { name: '@re-shell/contracts', dir: 'packages/contracts' },
  { name: '@re-shell/cli', dir: 'packages/cli' },
  { name: '@re-shell/mcp', dir: 'packages/mcp' },
];

const MIN_TEMPLATES = 200;
const COMMAND_TIMEOUT_MS = 120_000;
const MCP_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Tiny check harness
// ---------------------------------------------------------------------------

const results = [];

function log(message) {
  process.stdout.write(`[pack-smoke] ${message}\n`);
}

/** Run one named check; a thrown error is a failure, never swallowed. */
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail ?? '' });
    log(`PASS  ${name}${detail ? ` - ${detail}` : ''}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail: message });
    log(`FAIL  ${name}\n        ${message.replace(/\n/g, '\n        ')}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------

/**
 * Environment for child processes: the parent env minus anything that would steer
 * the installed packages toward the monorepo (RE_SHELL_* overrides, pnpm/npm run
 * context). The install under test must resolve everything from its own tree.
 */
function cleanEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('RE_SHELL_') || key.startsWith('npm_') || key.startsWith('PNPM_')) {
      continue;
    }
    env[key] = value;
  }
  // The CLI must not wait for a TTY or open a browser during the smoke test.
  env.CI = 'true';
  return { ...env, ...extra };
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
    shell: isWindows,
    ...options,
  });
  if (result.error) {
    throw new Error(`${command} ${commandArgs.join(' ')} could not run: ${result.error.message}`);
  }
  return result;
}

function runOrThrow(command, commandArgs, options = {}) {
  const result = run(command, commandArgs, options);
  if (result.status !== 0) {
    throw new Error(
      `${command} ${commandArgs.join(' ')} exited with ${result.status}\n` +
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }
  return result;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function tarballName(pkgJson) {
  // pnpm/npm pack naming: "@scope/name" -> "scope-name", then "-<version>.tgz".
  return `${pkgJson.name.replace(/^@/, '').replace('/', '-')}-${pkgJson.version}.tgz`;
}

/** List entries of a tarball (paths as stored, e.g. "package/dist/index.js"). */
function listTarball(tarball) {
  return runOrThrow('tar', ['-tzf', tarball], { shell: false }).stdout.split('\n').filter(Boolean);
}

function readTarballFile(tarball, entry) {
  return runOrThrow('tar', ['-xzOf', tarball, entry], { shell: false }).stdout;
}

// ---------------------------------------------------------------------------
// 1. Build prerequisites + pack
// ---------------------------------------------------------------------------

function buildPrerequisites() {
  // contracts is imported by every other package; ui is bundled into the
  // dashboard; mcp ships its own tsc output. The cli's own build + dashboard
  // bundle run in its `prepack` hook during `pnpm pack`.
  log('Building contracts, ui and mcp (pass --no-build to skip)...');
  runOrThrow(
    'pnpm',
    ['--filter', '@re-shell/contracts', '--filter', '@re-shell/ui', '--filter', '@re-shell/mcp', 'build'],
    { cwd: repoRoot, stdio: 'inherit', timeout: 15 * 60_000 }
  );
}

function packAll(packDir) {
  const packed = {};
  for (const pkg of PACKAGES) {
    const cwd = path.join(repoRoot, pkg.dir);
    const manifest = readJson(path.join(cwd, 'package.json'));
    log(`Packing ${pkg.name}@${manifest.version} (pnpm pack runs the package's prepack hook)...`);
    // `pnpm pack`, not `npm pack`: only pnpm rewrites workspace: specifiers to the
    // real versions in the tarball's package.json, as `pnpm publish` does.
    runOrThrow('pnpm', ['pack', '--pack-destination', packDir], {
      cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: 15 * 60_000,
    });
    const tarball = path.join(packDir, tarballName(manifest));
    assert(existsSync(tarball), `pnpm pack did not produce ${tarball}`);
    packed[pkg.name] = { tarball, manifest };
  }
  return packed;
}

// ---------------------------------------------------------------------------
// 3. MCP stdio handshake
// ---------------------------------------------------------------------------

/**
 * Start `re-shell-mcp` exactly as an MCP client would (the installed bin shim,
 * stdio pipes) and complete initialize + tools/list. Resolves with the tool list.
 * Rejects if the process exits before answering, or on timeout.
 */
function mcpHandshake(binPath, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(binPath, [], {
      cwd,
      env: cleanEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
    });

    let stdoutBuffer = '';
    let stderr = '';
    let settled = false;
    const responses = new Map();
    const waiters = new Map();

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdin.end();
      child.kill('SIGTERM');
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(
      () =>
        finish(
          new Error(
            `MCP handshake timed out after ${MCP_TIMEOUT_MS}ms (no response from re-shell-mcp).\nstderr:\n${stderr}`
          )
        ),
      MCP_TIMEOUT_MS
    );

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => finish(new Error(`could not start re-shell-mcp: ${error.message}`)));
    child.on('exit', (code, signal) => {
      if (!settled) {
        finish(
          new Error(
            `re-shell-mcp exited (code ${code}, signal ${signal}) before completing the handshake. ` +
              `A server started through the installed bin symlink must stay up and answer on stdio.\nstderr:\n${stderr}`
          )
        );
      }
    });

    // MCP stdio framing: one JSON-RPC message per line.
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      let newline;
      while ((newline = stdoutBuffer.indexOf('\n')) >= 0) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          finish(new Error(`re-shell-mcp wrote a non-JSON line to stdout (corrupts the protocol): ${line}`));
          return;
        }
        if (message.id !== undefined) {
          responses.set(message.id, message);
          waiters.get(message.id)?.(message);
        }
      }
    });

    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    const request = (id, method, params) =>
      new Promise((resolveRequest) => {
        waiters.set(id, resolveRequest);
        if (responses.has(id)) resolveRequest(responses.get(id));
        send({ jsonrpc: '2.0', id, method, params });
      });

    (async () => {
      const init = await request(1, 'initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'pack-smoke', version: '1.0.0' },
      });
      if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
      if (!init.result?.serverInfo?.name) {
        throw new Error(`initialize result has no serverInfo.name: ${JSON.stringify(init.result)}`);
      }
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });

      const list = await request(2, 'tools/list', {});
      if (list.error) throw new Error(`tools/list failed: ${JSON.stringify(list.error)}`);
      if (!Array.isArray(list.result?.tools)) {
        throw new Error(`tools/list result has no tools array: ${JSON.stringify(list.result)}`);
      }
      finish(null, { serverInfo: init.result.serverInfo, tools: list.result.tools });
    })().catch((error) => finish(error));
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const workDir = mkdtempSync(path.join(os.tmpdir(), 're-shell-pack-smoke-'));
  const packDir = path.join(workDir, 'packs');
  const installDir = path.join(workDir, 'install');
  mkdirSync(packDir);
  mkdirSync(installDir);
  log(`Working directory (outside the repo): ${workDir}`);

  if (!SKIP_BUILD) {
    buildPrerequisites();
  }

  const packed = packAll(packDir);
  const cliVersion = packed['@re-shell/cli'].manifest.version;
  const cliTarball = packed['@re-shell/cli'].tarball;
  const mcpTarball = packed['@re-shell/mcp'].tarball;

  // ---- Tarball content checks (what npm would actually publish) -----------
  await check('cli tarball contains the dashboard bundle (dist/dashboard)', () => {
    const entries = listTarball(cliTarball);
    for (const required of [
      'package/dist/dashboard/index.html',
      'package/dist/dashboard/hub-server.js',
      'package/dist/index.js',
    ]) {
      assert(entries.includes(required), `${required} is missing from ${path.basename(cliTarball)}`);
    }
    const assets = entries.filter((entry) => entry.startsWith('package/dist/dashboard/assets/'));
    assert(assets.length > 0, 'package/dist/dashboard/assets/ is empty in the cli tarball');
    return `${entries.length} files, ${assets.length} dashboard assets`;
  });

  await check('no tarball keeps a workspace: dependency specifier', () => {
    for (const { tarball } of Object.values(packed)) {
      const manifest = JSON.parse(readTarballFile(tarball, 'package/package.json'));
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
          assert(
            !String(spec).startsWith('workspace:'),
            `${manifest.name} ${field}.${dep} is still "${spec}" in the tarball; npm cannot install that`
          );
        }
      }
    }
  });

  // [depends on the MCP package fix: declare @re-shell/cli as a dependency]
  await check('mcp tarball declares @re-shell/cli as a dependency', () => {
    const manifest = JSON.parse(readTarballFile(mcpTarball, 'package/package.json'));
    const declared =
      manifest.dependencies?.['@re-shell/cli'] ??
      manifest.peerDependencies?.['@re-shell/cli'] ??
      manifest.optionalDependencies?.['@re-shell/cli'];
    assert(
      declared,
      '@re-shell/mcp spawns the re-shell CLI at runtime but lists @re-shell/cli in none of ' +
        'dependencies/peerDependencies/optionalDependencies, so a clean `npm install @re-shell/mcp` cannot work'
    );
    return `@re-shell/cli@${declared}`;
  });

  // ---- Fresh install --------------------------------------------------------
  writeFileSync(
    path.join(installDir, 'package.json'),
    JSON.stringify({ name: 're-shell-pack-smoke-install', version: '0.0.0', private: true }, null, 2)
  );
  let installed = false;
  await check('npm install of the three tarballs into a fresh directory', () => {
    const tarballs = PACKAGES.map((pkg) => packed[pkg.name].tarball);
    runOrThrow('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...tarballs], {
      cwd: installDir,
      env: cleanEnv(),
      timeout: 10 * 60_000,
    });
    for (const pkg of PACKAGES) {
      assert(
        existsSync(path.join(installDir, 'node_modules', ...pkg.name.split('/'), 'package.json')),
        `${pkg.name} is not present in the fresh node_modules`
      );
    }
    installed = true;
  });

  if (installed) {
    const binDir = path.join(installDir, 'node_modules', '.bin');
    const reShell = path.join(binDir, isWindows ? 're-shell.cmd' : 're-shell');
    const reShellMcp = path.join(binDir, isWindows ? 're-shell-mcp.cmd' : 're-shell-mcp');
    const installedCli = path.join(installDir, 'node_modules', '@re-shell', 'cli');
    const cli = (cliArgs) => run(reShell, cliArgs, { cwd: installDir, env: cleanEnv(), input: '' });

    // [depends on the CLI fix: no banner on stdout for --version]
    await check('re-shell --version prints exactly the package version', () => {
      const result = cli(['--version']);
      assert(result.status === 0, `exit ${result.status}\nstderr: ${result.stderr}`);
      assert(
        result.stdout === `${cliVersion}\n`,
        `stdout must be exactly "${cliVersion}\\n" but was ${JSON.stringify(result.stdout.slice(0, 200))}` +
          `${result.stdout.length > 200 ? ' (truncated)' : ''}`
      );
      return cliVersion;
    });

    await check('re-shell --help exits 0', () => {
      const result = cli(['--help']);
      assert(result.status === 0, `exit ${result.status}\nstderr: ${result.stderr}`);
      assert(/usage/i.test(result.stdout), `--help output has no "Usage" line: ${result.stdout.slice(0, 200)}`);
    });

    await check(`re-shell templates list --json is parseable with >= ${MIN_TEMPLATES} templates`, () => {
      const result = cli(['templates', 'list', '--json']);
      assert(result.status === 0, `exit ${result.status}\nstderr: ${result.stderr}`);
      let envelope;
      try {
        envelope = JSON.parse(result.stdout);
      } catch (error) {
        throw new Error(
          `stdout is not a single JSON document (${error.message}): ${JSON.stringify(result.stdout.slice(0, 200))}`
        );
      }
      assert(envelope.ok === true, `envelope.ok is not true: ${JSON.stringify(envelope).slice(0, 300)}`);
      const templates = Array.isArray(envelope.data) ? envelope.data : envelope.data?.templates;
      assert(Array.isArray(templates), 'envelope.data is not a template array');
      assert(
        templates.length >= MIN_TEMPLATES,
        `expected at least ${MIN_TEMPLATES} templates, got ${templates.length}`
      );
      return `${templates.length} templates`;
    });

    // [depends on the dashboard bundle shipping in the tarball: prepack + bundle-dashboard fix]
    await check('re-shell ui --dry-run --json finds the bundled dashboard', () => {
      // Run from the install dir: there is no apps/web here, so the only way to
      // resolve a dashboard is the one shipped inside @re-shell/cli.
      const result = cli(['ui', '--dry-run', '--json']);
      assert(result.status === 0, `exit ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
      let plan;
      try {
        plan = JSON.parse(result.stdout);
      } catch (error) {
        throw new Error(`stdout is not JSON (${error.message}): ${JSON.stringify(result.stdout.slice(0, 200))}`);
      }
      assert(plan.mode === 'static', `expected mode "static" (bundled dashboard), got "${plan.mode}"`);
      const dashboardDir = path.resolve(plan.dashboardDir ?? '');
      assert(
        dashboardDir.startsWith(path.resolve(installedCli) + path.sep),
        `dashboardDir ${plan.dashboardDir} is not inside the installed @re-shell/cli (${installedCli})`
      );
      assert(existsSync(path.join(dashboardDir, 'index.html')), `${dashboardDir}/index.html does not exist`);
      assert(existsSync(plan.hubBundlePath ?? ''), `hub bundle ${plan.hubBundlePath} does not exist`);
      return `mode=static dashboardDir=${path.relative(installDir, dashboardDir)}`;
    });

    await check('installed dashboard bundle embeds no hub token or hub URL', async () => {
      const { findInlinedHubConfig } = await import(
        pathToFileURL(path.join(repoRoot, 'packages/cli/scripts/bundle-dashboard.mjs')).href
      );
      const dashboardDir = path.join(installedCli, 'dist', 'dashboard');
      assert(existsSync(dashboardDir), `${dashboardDir} does not exist`);
      const findings = findInlinedHubConfig(dashboardDir);
      assert(findings.length === 0, `baked-in hub config found:\n${findings.join('\n')}`);
    });

    // [depends on the MCP bin fix: symlink-safe entry-point check]
    await check('re-shell-mcp (from node_modules/.bin) completes initialize + tools/list', async () => {
      assert(existsSync(reShellMcp), `${reShellMcp} does not exist`);
      const { serverInfo, tools } = await mcpHandshake(reShellMcp, installDir);
      assert(tools.length > 0, 'tools/list returned no tools');
      for (const tool of tools) {
        assert(
          typeof tool.name === 'string' && tool.inputSchema && typeof tool.inputSchema === 'object',
          `tool without a name/inputSchema: ${JSON.stringify(tool).slice(0, 200)}`
        );
      }
      return `${serverInfo.name}@${serverInfo.version ?? '?'} exposes ${tools.length} tools`;
    });
  }

  // ---- Summary --------------------------------------------------------------
  const failed = results.filter((result) => !result.ok);
  log('');
  log(`${results.length - failed.length}/${results.length} checks passed`);
  for (const result of failed) {
    log(`  FAILED: ${result.name}`);
  }

  if (failed.length === 0 && !KEEP) {
    rmSync(workDir, { recursive: true, force: true });
  } else {
    log(`Kept ${workDir} for inspection.`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`[pack-smoke] FATAL: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(2);
});
