import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';
import { nestjsTemplate } from '../../src/templates/backend/nestjs';

const temporaryDirectories: string[] = [];
const healthScript = readFileSync(resolve(__dirname, '../../../../scripts/scaffold-test-templates.sh'), 'utf8');

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

interface FixtureOptions {
  /** template-name -> language kind of the app the fake CLI scaffolds (native templates). */
  kinds?: Record<string, string>;
  /** Toolchain shims to install. When set, PATH is hermetic: only the shims and core utilities. */
  tools?: string[];
  /** Command (as "name args") that makes the matching toolchain shim fail. */
  failOn?: string;
  /** Extra environment for the script. */
  env?: Record<string, string>;
}

const CORE_UTILITIES = ['bash', 'sh', 'dirname', 'mktemp', 'rm', 'grep', 'head', 'tail', 'wc', 'tr', 'sed', 'find', 'env', 'cat', 'mkdir', 'basename', 'sort', 'cut', 'cp', 'chmod'];

// One shim stands in for every language toolchain: it records the invocation and
// fails when FAIL_ON matches. `python3 -m venv DIR` creates DIR/bin/python.
const TOOL_SHIM = `#!/bin/bash
name=$(basename "$0")
echo "$name $*" >> "$SHIM_LOG"
if [ "$name" = python3 ] && [ "$1" = -m ] && [ "$2" = venv ]; then mkdir -p "$3/bin"; cp "$0" "$3/bin/python"; exit 0; fi
if [ -n "\${FAIL_ON:-}" ] && [[ "$name $*" == *"$FAIL_ON"* ]]; then echo "shim failure: $name $*" >&2; exit 1; fi
exit 0
`;

function runHealthFixture(scenario: string, templates: string | string[] = 'express', options: FixtureOptions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'template-health-fixture-'));
  temporaryDirectories.push(root);
  const scripts = join(root, 'scripts');
  const bin = join(root, 'bin');
  const workspaces = join(root, 'temporary');
  mkdirSync(scripts);
  mkdirSync(bin);
  mkdirSync(workspaces);
  writeFileSync(join(scripts, 'scaffold-test-templates.sh'), healthScript);
  writeFileSync(join(bin, 'node'), `#!/bin/bash
set -eu
if [ "$1" = -e ]; then exec "$REAL_NODE" "$@"; fi
if [ "$1" = --check ] || [[ "$1" == *check-js-imports.mjs ]]; then exit 0; fi
if [ "$SCENARIO" = scaffold ]; then echo Scaffolded; exit 1; fi
if [ "$SCENARIO" = missing-app ]; then echo Scaffolded; exit 0; fi
if [ "$SCENARIO" = mixed ]; then case "$3" in test-fastapi|test-phoenix) SCENARIO=non-node ;; esac; fi
mkdir -p "$PWD/$3/apps/$3"
cd "$PWD/$3/apps/$3"
kind=$(printf '%s' "\${NATIVE_KINDS:-}" | tr ',' '\n' | grep "^$3=" | cut -d= -f2 || true)
case "$kind" in
  python) printf 'flask\n' > requirements.txt; printf 'app = None\n' > main.py ;;
  go) printf 'module x\n' > go.mod ;;
  rust) printf '[package]\nname = "x"\n' > Cargo.toml ;;
  php) printf '{}' > composer.json; printf '<?php\n' > index.php ;;
  ruby) printf 'source "x"\n' > Gemfile; printf 'puts 1\n' > app.rb ;;
  java) printf '<project/>' > pom.xml ;;
  zig) printf '' > build.zig ;;
  elixir) printf '' > mix.exs ;;
  swift) printf '' > Package.swift ;;
  dart) printf 'name: x\n' > pubspec.yaml ;;
  rescript) printf '{}' > rescript.json ;;
esac
if [ "$SCENARIO" != non-node ] && [ "$SCENARIO" != missing-package ]; then printf '{}' > package.json; fi
if [ "$SCENARIO" = malformed-package ]; then printf '{"name":}' > package.json; fi
if [ "$SCENARIO" != no-tsconfig ]; then printf '{}' > tsconfig.json; fi
if [ "$SCENARIO" = prisma ]; then mkdir prisma; touch prisma/schema.prisma; fi
echo Scaffolded
`, { mode: 0o755 });
  writeFileSync(join(bin, 'pnpm'), `#!/bin/bash
set -eu
if [ "$1" = exec ] || [ "$1" = run ]; then
  echo "pnpm $*" >> "$SHIM_LOG"
  if [ -n "\${FAIL_ON:-}" ] && [[ "pnpm $*" == *"$FAIL_ON"* ]]; then echo "shim failure: pnpm $*" >&2; exit 1; fi
  exit 0
fi
if [ "$PWD" != "$FIXTURE_REPO" ] || [ "$1" != --dir ]; then echo incorrect-package-manager-selection; exit 1; fi
cd "$2"
shift 2
if [ "$1" != install ]; then echo incorrect-install-command; exit 1; fi
if [ "$SCENARIO" = non-node ]; then echo unexpected-install; exit 1; fi
if [ "$SCENARIO" = install ]; then echo dependency-install-failed >&2; exit 1; fi
if [ "$SCENARIO" = missing-tsc ]; then exit 0; fi
mkdir -p node_modules/.bin
printf '#!/bin/bash\\nif [ "$SCENARIO" = typecheck ] || { [ "$SCENARIO" = mixed ] && [ "$(basename "$PWD")" = test-fastify ]; }; then echo compiler-error; exit 1; fi\\n' > node_modules/.bin/tsc
chmod +x node_modules/.bin/tsc
`, { mode: 0o755 });
  writeFileSync(join(bin, 'npx'), '#!/bin/bash\necho prisma-generate-failed >&2\nexit 1\n', { mode: 0o755 });
  const templateList = Array.isArray(templates) ? templates : [templates];
  const shimLog = join(root, 'shim.log');
  writeFileSync(shimLog, '');
  let searchPath = `${bin}:${process.env.PATH}`;
  if (options.tools) {
    // Hermetic PATH: the fixture shims plus symlinks to the core utilities only,
    // so a toolchain that is not listed is genuinely missing.
    const core = join(root, 'core');
    mkdirSync(core);
    for (const tool of CORE_UTILITIES) {
      const found = spawnSync('bash', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).stdout.trim();
      if (found) symlinkSync(found, join(core, tool));
    }
    // node, pnpm and npx keep their dedicated fixture shims.
    for (const tool of options.tools.filter((name) => !['node', 'pnpm', 'npx'].includes(name))) {
      writeFileSync(join(bin, tool), TOOL_SHIM, { mode: 0o755 });
    }
    searchPath = `${bin}:${core}`;
  }
  const bash = spawnSync('bash', ['-c', 'command -v bash'], { encoding: 'utf8' }).stdout.trim();
  const result = spawnSync(bash, [join(scripts, 'scaffold-test-templates.sh'), ...templateList], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: searchPath,
      SCENARIO: scenario,
      TMPDIR: workspaces,
      REAL_NODE: process.execPath,
      FIXTURE_REPO: root,
      SHIM_LOG: shimLog,
      NATIVE_KINDS: Object.entries(options.kinds ?? {}).map(([name, kind]) => `test-${name}=${kind}`).join(','),
      ...(options.failOn ? { FAIL_ON: options.failOn } : {}),
      ...(options.env ?? {}),
    },
    timeout: 10000,
  });
  expect(readdirSync(workspaces)).toEqual([]);
  return { ...result, shimLog: readFileSync(shimLog, 'utf8') };
}

describe('NestJS generated JSON', () => {
  it('renders package.json as strict JSON without normalizing malformed output', () => {
    const rendered = String(nestjsTemplate.files['package.json']).replace(/\{\{projectName\}\}/g, 'health-test');
    const manifest = JSON.parse(rendered);
    expect(manifest.name).toBe('health-test');
    expect(manifest.dependencies.kafkajs).toBe('^2.2.4');
    expect(manifest.scripts.typecheck).toBe('tsc --noEmit');
  });
});

describe('template health accounting', () => {
  it.each(['scaffold', 'missing-app', 'missing-package', 'malformed-package', 'install', 'missing-tsc', 'no-tsconfig', 'typecheck', 'prisma'])(
    'fails instead of passing a Node template when %s fails', (scenario) => {
      const result = runHealthFixture(scenario);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
      expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
    },
  );

  it('counts successful Node typechecks as passes', () => {
    const result = runHealthFixture('pass');
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
  });

  it('counts mixed passes, failures, and skips for missing toolchains independently', () => {
    // express passes, fastify fails its typecheck, fastapi is built with python3,
    // and phoenix is skipped because no elixir toolchain is on PATH.
    const result = runHealthFixture('mixed', ['express', 'fastify', 'fastapi', 'phoenix'], {
      kinds: { fastapi: 'python', phoenix: 'elixir' },
      tools: ['node', 'pnpm', 'npx', 'python3'],
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 2 passed, 1 failed, 1 skipped');
    expect(result.stdout).toContain('fastify (typecheck:');
    expect(result.stdout).toContain('phoenix (toolchain missing: elixir (mix) is not installed)');
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });
});

describe('native (non-Node) template verification', () => {
  // template, manifest kind, tools on PATH, command that fails, failure reason, command that must run
  const TOOLCHAINS: Array<[string, string, string[], string, string, string]> = [
    ['fastapi', 'python', ['python3'], 'compileall', 'compile failed', 'python -m compileall'],
    ['gin', 'go', ['go'], 'go build', 'build failed', 'go build ./...'],
    ['axum', 'rust', ['cargo'], 'cargo check', 'check failed', 'cargo check'],
    ['laravel', 'php', ['php', 'composer'], 'composer install', 'composer-install failed', 'php -l'],
    ['rails-api', 'ruby', ['ruby', 'bundle'], 'bundle install', 'bundle-install failed', 'ruby -c'],
    ['spring-boot', 'java', ['mvn', 'java'], 'mvn', 'package failed', 'mvn -B -q -DskipTests package'],
    ['zig-http', 'zig', ['zig'], 'zig build', 'build failed', 'zig build'],
    ['shelf', 'dart', ['dart'], 'dart analyze', 'analyze failed', 'dart analyze'],
  ];

  it.each(TOOLCHAINS)('%s: verified with its own toolchain, never through pnpm', (template, kind, tools, _failOn, _reason, ran) => {
    const result = runHealthFixture('non-node', template, { kinds: { [template]: kind }, tools: ['node', 'pnpm', 'npx', ...tools] });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
    expect(result.stdout).toContain('Native build verified');
    expect(result.stdout).toContain('ALL TEMPLATES PASSED');
    expect(result.stdout).not.toContain('unexpected-install');
    expect(result.shimLog).toContain(ran);
  });

  it.each(TOOLCHAINS)('%s: fails (never passes) when the toolchain step fails', (template, kind, tools, failOn, reason) => {
    const result = runHealthFixture('non-node', template, {
      kinds: { [template]: kind },
      tools: ['node', 'pnpm', 'npx', ...tools],
      failOn,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
    expect(result.stdout).toContain(`native build: ${reason}`);
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });

  it('runs the Python steps in order: venv, install, compile, import', () => {
    const result = runHealthFixture('non-node', 'fastapi', { kinds: { fastapi: 'python' }, tools: ['node', 'pnpm', 'npx', 'python3'] });
    const log = result.shimLog.split('\n');
    const order = ['python3 -m venv .venv', 'python -m pip install', 'python -m compileall', 'python -c import main'].map((fragment) =>
      log.findIndex((line) => line.includes(fragment)),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it.each([
    ['fastapi', 'python', 'python3 is not installed'],
    ['gin', 'go', 'go is not installed'],
    ['axum', 'rust', 'cargo is not installed'],
    ['laravel', 'php', 'php is not installed'],
    ['rails-api', 'ruby', 'ruby is not installed'],
    ['spring-boot', 'java', 'mvn (Maven) is not installed'],
    ['zig-http', 'zig', 'zig is not installed'],
    ['shelf', 'dart', 'dart is not installed'],
    ['phoenix', 'elixir', 'elixir (mix) is not installed'],
    ['vapor', 'swift', 'swift is not installed'],
  ])('%s: SKIP names the missing toolchain when it is not installed', (template, kind, reason) => {
    const result = runHealthFixture('non-node', template, { kinds: { [template]: kind }, tools: ['node', 'pnpm', 'npx'] });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 0 passed, 0 failed, 1 skipped');
    expect(result.stdout).toContain(`SKIP: toolchain missing: ${reason}`);
    expect(result.stdout).toContain(`${template} (toolchain missing: ${reason})`);
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });

  it('fails a native template that produced no recognisable build manifest', () => {
    const result = runHealthFixture('non-node', 'fastapi', { tools: ['node', 'pnpm', 'npx', 'python3'] });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
    expect(result.stdout).toContain('no recognised build manifest');
  });

  it('says so when PHP is verified without composer', () => {
    const result = runHealthFixture('non-node', 'laravel', { kinds: { laravel: 'php' }, tools: ['node', 'pnpm', 'npx', 'php'] });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
    expect(result.stdout).toContain('NOTE: syntax only: composer is not installed');
  });

  it('can resolve (not download) composer dependencies when asked to', () => {
    const result = runHealthFixture('non-node', 'laravel', {
      kinds: { laravel: 'php' },
      tools: ['node', 'pnpm', 'npx', 'php', 'composer'],
      env: { TEMPLATE_HEALTH_COMPOSER_RESOLVE_ONLY: '1' },
    });
    expect(result.status).toBe(0);
    expect(result.shimLog).toContain('composer update --dry-run');
    expect(result.shimLog).not.toContain('composer install');
    expect(result.stdout).toContain('NOTE: composer dependencies were resolved but not downloaded');
  });
});

describe('ReScript template verification', () => {
  const options = { kinds: { 'rescript-express': 'rescript' } };

  it('builds with rescript, checks the JavaScript and runs the app tests', () => {
    const result = runHealthFixture('pass', 'rescript-express', options);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
    expect(result.stdout).toContain('ReScript build passed');
    expect(result.stdout).toContain('Tests passed');
    const log = result.shimLog.split('\n');
    const order = ['pnpm exec rescript build', 'pnpm run test'].map((fragment) => log.findIndex((line) => line.includes(fragment)));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order[0]).toBeLessThan(order[1]);
  });

  it.each([
    ['exec rescript build', 'ReScript build failed'],
    ['run test', 'tests failed'],
  ])('fails (never passes) when %s fails', (failOn, reason) => {
    const result = runHealthFixture('pass', 'rescript-express', { ...options, failOn });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
    expect(result.stdout).toContain(reason);
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });
});

