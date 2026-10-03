#!/usr/bin/env node
/**
 * End-to-end verification of every `re-shell create` mode.
 *
 * For each mode this script runs the BUILT CLI (`dist/index.js`) in a fresh temp
 * directory with stdin closed and a hard timeout, then checks that it did not
 * hang, exited 0, and wrote the expected files. Unless `--skip-install` is given
 * it then runs a real `<pm> install` and `<pm> run build` in the output and
 * checks that the build actually produced artifacts (a build that matches no
 * workspace and exits 0 is a failure, not a pass).
 *
 * It is heavier than the vitest suites (network install, webpack/vite builds), so
 * CI runs it as its own job:
 *
 *   pnpm --filter @re-shell/cli build
 *   node packages/cli/scripts/verify-create-modes.mjs
 *
 * Options:
 *   --modes a,b,c     Only run these modes (default: all). See MODES below.
 *   --skip-install    Only verify generation (no install/build); fast, offline.
 *   --keep            Keep the temp directory and print its path.
 *   --pm <pm>         Package manager for install/build (default: pnpm).
 *   --cli <path>      CLI entry to run (default: ../dist/index.js).
 *   --timeout-ms <n>  Per-command timeout (default: 600000 for install/build, 90000 for the CLI).
 *   --json            Print the final report as JSON on stdout (logs go to stderr).
 *   --list            List the available modes and exit.
 *
 * Exit code: 0 when every selected mode passes, 1 otherwise.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    modes: null,
    skipInstall: false,
    keep: false,
    pm: 'pnpm',
    cli: path.resolve(here, '../dist/index.js'),
    timeoutMs: 600_000,
    cliTimeoutMs: 90_000,
    json: false,
    list: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--modes') args.modes = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--skip-install') args.skipInstall = true;
    else if (a === '--keep') args.keep = true;
    else if (a === '--pm') args.pm = next();
    else if (a === '--cli') args.cli = path.resolve(next());
    else if (a === '--timeout-ms') args.timeoutMs = Number(next());
    else if (a === '--json') args.json = true;
    else if (a === '--list') args.list = true;
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^[\s\S]*?\/\*\*/, ''));
      process.exit(0);
    } else throw new Error(`Unknown option ${a}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const log = (...m) => (args.json ? console.error(...m) : console.log(...m));

/**
 * Each mode: the CLI invocations to run (cwd = temp dir unless `cwd` is given),
 * files that must exist afterwards, the directory the install/build runs in, and
 * build artifacts that must exist after `build`.
 */
const MODES = {
  frontend: {
    description: 'create fe --frontend react-ts',
    steps: [{ args: ['create', 'fe', '--frontend', 'react-ts'] }],
    files: ['fe/package.json', 'fe/pnpm-workspace.yaml', 'fe/apps/fe/package.json', 'fe/apps/fe/index.html', 'fe/apps/fe/src/main.tsx'],
    project: 'fe',
    artifacts: ['fe/apps/fe/dist/mf.umd.js'],
  },
  'frontend-vue': {
    description: 'create fev --frontend vue-ts',
    steps: [{ args: ['create', 'fev', '--frontend', 'vue-ts'] }],
    files: ['fev/apps/fev/package.json', 'fev/apps/fev/index.html'],
    project: 'fev',
    artifacts: ['fev/apps/fev/dist'],
  },
  backend: {
    description: 'create be --backend express (just the API)',
    steps: [{ args: ['create', 'be', '--backend', 'express'] }],
    files: ['be/package.json', 'be/pnpm-workspace.yaml', 'be/apps/be/package.json', 'be/apps/be/src'],
    forbidden: ['be/apps/be-api', 'be/apps/be/index.html'],
    project: 'be',
    artifacts: ['be/apps/be/dist'],
  },
  fullstack: {
    description: 'create fs --fullstack (default backend express)',
    steps: [{ args: ['create', 'fs', '--fullstack'] }],
    files: ['fs/apps/fs/package.json', 'fs/apps/fs-api/package.json'],
    project: 'fs',
    artifacts: ['fs/apps/fs/dist/mf.umd.js', 'fs/apps/fs-api/dist'],
  },
  microfrontend: {
    description: 'create mf --microfrontend --yes',
    steps: [{ args: ['create', 'mf', '--microfrontend', '--yes'] }],
    files: ['mf/shell/package.json', 'mf/remotes/remote-1/package.json', 'mf/shared/package.json', 'mf/package.json'],
    project: 'mf',
    artifacts: ['mf/shell/dist/index.html', 'mf/remotes/remote-1/dist/remoteEntry.js'],
  },
  polyglot: {
    description: 'create poly --polyglot --yes',
    steps: [{ args: ['create', 'poly', '--polyglot', '--yes'] }],
    files: ['poly/gateway/package.json', 'poly/frontend/package.json', 'poly/services/typescript-service-1/package.json', 'poly/docker-compose.yml'],
    project: 'poly',
    artifacts: ['poly/gateway/dist/index.js', 'poly/frontend/dist', 'poly/services/typescript-service-1/dist'],
  },
  'in-monorepo': {
    description: 'init + create web / create shop --fullstack / generate backend, inside one monorepo',
    steps: [
      { args: ['init', 'mono', '--yes', '--skip-install', '--no-git'] },
      { args: ['create', 'web', '--framework', 'react-ts', '--yes'], cwd: 'mono' },
      { args: ['create', 'shop', '--fullstack', '--yes'], cwd: 'mono' },
      { args: ['generate', 'backend', 'api'], cwd: 'mono' },
    ],
    files: ['mono/apps/web/package.json', 'mono/apps/shop/package.json', 'mono/services/shop-api/package.json', 'mono/services/api/package.json'],
    project: 'mono',
    artifacts: ['mono/apps/web/dist/mf.umd.js', 'mono/apps/shop/dist/mf.umd.js', 'mono/services/shop-api/dist'],
    // `workspace health --json` must see the generated services.
    after: (root) => {
      const res = run(process.execPath, [args.cli, 'workspace', 'health', '--json'], path.join(root, 'mono'), args.cliTimeoutMs);
      if (res.status !== 0) return `workspace health exited ${res.status}`;
      const env = JSON.parse(res.stdout.trim());
      const check = (env.data?.checks ?? []).find(c => c.name === 'Workspaces');
      const details = (check?.details ?? []).join(',');
      for (const expected of ['api (service)', 'shop-api (service)']) {
        if (!details.includes(expected)) return `workspace health did not list "${expected}" (got: ${details || check?.message})`;
      }
      return null;
    },
  },
  skeleton: {
    description: 'create blank --template blank (honest empty skeleton; nothing to install or build)',
    steps: [{ args: ['create', 'blank', '--template', 'blank'] }],
    files: ['blank/package.json', 'blank/pnpm-workspace.yaml', 'blank/README.md'],
    forbiddenGlob: 'blank/apps/*',
    stdoutIncludes: ['empty workspace skeleton', 'nothing is runnable yet'],
    noInstall: true,
  },
};

if (args.list) {
  for (const [name, mode] of Object.entries(MODES)) console.log(`${name.padEnd(14)} ${mode.description}`);
  process.exit(0);
}

const selected = args.modes ?? Object.keys(MODES);
for (const name of selected) {
  if (!MODES[name]) {
    console.error(`Unknown mode "${name}". Available: ${Object.keys(MODES).join(', ')}`);
    process.exit(2);
  }
}

if (!fs.existsSync(args.cli)) {
  console.error(`Built CLI not found at ${args.cli}. Run \`pnpm --filter @re-shell/cli build\` first.`);
  process.exit(2);
}

/** Run a command with stdin closed; reports timeouts distinctly from failures. */
function run(cmd, cmdArgs, cwd, timeout) {
  const started = Date.now();
  const res = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' },
  });
  return {
    status: res.status,
    signal: res.signal,
    timedOut: res.error?.code === 'ETIMEDOUT',
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    ms: Date.now() - started,
  };
}

function tail(text, lines = 25) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

function nonEmpty(p) {
  if (!fs.existsSync(p)) return false;
  const stat = fs.statSync(p);
  return stat.isFile() ? stat.size > 0 : fs.readdirSync(p).length > 0;
}

function globDir(dir) {
  const parent = path.dirname(dir);
  return fs.existsSync(parent) ? fs.readdirSync(parent) : [];
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-create-modes-'));
log(`work dir: ${work}`);
log(`cli: ${args.cli}`);
log(`modes: ${selected.join(', ')}${args.skipInstall ? ' (generation only)' : ''}\n`);

const report = [];

for (const name of selected) {
  const mode = MODES[name];
  const root = path.join(work, name);
  fs.mkdirSync(root, { recursive: true });
  const result = { mode: name, description: mode.description, ok: false, phases: {}, failure: null };
  const fail = (phase, message, res) => {
    result.failure = { phase, message, ...(res ? { output: tail(res.stderr || res.stdout) } : {}) };
    return result;
  };

  log(`=== ${name}: ${mode.description}`);

  // 1. Run the CLI steps: no hang, exit 0.
  let stdoutAll = '';
  let ok = true;
  for (const step of mode.steps) {
    const cwd = path.join(root, step.cwd ?? '.');
    const res = run(process.execPath, [args.cli, ...step.args], cwd, args.cliTimeoutMs);
    stdoutAll += res.stdout;
    result.phases[`cli:${step.args.join(' ')}`] = { ms: res.ms, status: res.status };
    if (res.timedOut) {
      fail('cli', `HUNG: \`re-shell ${step.args.join(' ')}\` did not finish within ${args.cliTimeoutMs}ms with stdin closed`, res);
      ok = false;
      break;
    }
    if (res.status !== 0) {
      fail('cli', `\`re-shell ${step.args.join(' ')}\` exited ${res.status}`, res);
      ok = false;
      break;
    }
    log(`  ok   re-shell ${step.args.join(' ')}  (${res.ms}ms)`);
  }
  if (!ok) {
    report.push(result);
    log(`  FAIL ${result.failure.message}\n${result.failure.output ?? ''}\n`);
    continue;
  }

  // 2. Expected files, forbidden files, stdout content.
  const missing = (mode.files ?? []).filter(f => !fs.existsSync(path.join(root, f)));
  const forbidden = (mode.forbidden ?? []).filter(f => fs.existsSync(path.join(root, f)));
  if (mode.forbiddenGlob && globDir(path.join(root, mode.forbiddenGlob)).length > 0) {
    forbidden.push(mode.forbiddenGlob);
  }
  const missingText = (mode.stdoutIncludes ?? []).filter(t => !stdoutAll.includes(t));
  if (missing.length || forbidden.length || missingText.length) {
    fail(
      'files',
      [
        missing.length ? `missing: ${missing.join(', ')}` : '',
        forbidden.length ? `unexpected: ${forbidden.join(', ')}` : '',
        missingText.length ? `stdout lacks: ${missingText.join(' | ')}` : '',
      ].filter(Boolean).join('; ')
    );
    report.push(result);
    log(`  FAIL ${result.failure.message}\n`);
    continue;
  }
  log(`  ok   ${(mode.files ?? []).length} expected files present`);

  if (mode.after) {
    const problem = mode.after(root);
    if (problem) {
      fail('after', problem);
      report.push(result);
      log(`  FAIL ${problem}\n`);
      continue;
    }
    log('  ok   post-checks');
  }

  // 3. Real install + build, with proof that something was built.
  if (!args.skipInstall && !mode.noInstall) {
    const project = path.join(root, mode.project);
    const install = run(args.pm, ['install'], project, args.timeoutMs);
    result.phases.install = { ms: install.ms, status: install.status };
    if (install.timedOut || install.status !== 0) {
      fail('install', `\`${args.pm} install\` ${install.timedOut ? 'timed out' : `exited ${install.status}`}`, install);
      report.push(result);
      log(`  FAIL ${result.failure.message}\n${result.failure.output}\n`);
      continue;
    }
    log(`  ok   ${args.pm} install  (${Math.round(install.ms / 1000)}s)`);

    const build = run(args.pm, ['run', 'build'], project, args.timeoutMs);
    result.phases.build = { ms: build.ms, status: build.status };
    if (build.timedOut || build.status !== 0) {
      fail('build', `\`${args.pm} run build\` ${build.timedOut ? 'timed out' : `exited ${build.status}`}`, build);
      report.push(result);
      log(`  FAIL ${result.failure.message}\n${result.failure.output}\n`);
      continue;
    }
    const noMatch = /None of the selected packages|No projects matched|No projects found/i.test(build.stdout + build.stderr);
    const missingArtifacts = (mode.artifacts ?? []).filter(a => !nonEmpty(path.join(root, a)));
    if (noMatch || missingArtifacts.length) {
      fail(
        'build',
        noMatch
          ? `\`${args.pm} run build\` exited 0 but matched no workspace (nothing was built)`
          : `build exited 0 but produced no artifacts: ${missingArtifacts.join(', ')}`,
        build
      );
      report.push(result);
      log(`  FAIL ${result.failure.message}\n`);
      continue;
    }
    log(`  ok   ${args.pm} run build  (${Math.round(build.ms / 1000)}s), artifacts: ${(mode.artifacts ?? []).join(', ')}`);
  }

  result.ok = true;
  report.push(result);
  log('  PASS\n');
}

const failed = report.filter(r => !r.ok);
if (args.json) {
  console.log(JSON.stringify({ workDir: work, ok: failed.length === 0, results: report }, null, 2));
} else {
  console.log('Summary');
  for (const r of report) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.mode.padEnd(14)} ${r.ok ? '' : `[${r.failure.phase}] ${r.failure.message}`}`);
  }
}

if (args.keep) {
  log(`\nKept: ${work}`);
} else {
  fs.rmSync(work, { recursive: true, force: true });
}

process.exit(failed.length === 0 ? 0 : 1);
