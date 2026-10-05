import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';
import { nestjsTemplate } from '../../src/templates/backend/nestjs';
import { backendTemplates } from '../../src/templates/backend';

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

const CORE_UTILITIES = ['bash', 'sh', 'dirname', 'mktemp', 'rm', 'grep', 'head', 'tail', 'wc', 'tr', 'sed', 'find', 'env', 'cat', 'mkdir', 'basename', 'sort', 'cut', 'cp', 'chmod', 'touch'];

// One shim stands in for every language toolchain: it records the invocation, prints
// SHIM_PRINT when SHIM_PRINT_ON matches and fails when FAIL_ON matches.
// `python3 -m venv DIR` creates DIR/bin/python.
const TOOL_SHIM = `#!/bin/bash
name=$(basename "$0")
echo "$name $*" >> "$SHIM_LOG"
if [ "$name" = python3 ] && [ "$1" = -m ] && [ "$2" = venv ]; then mkdir -p "$3/bin"; cp "$0" "$3/bin/python"; exit 0; fi
if [ -n "\${SHIM_PRINT_ON:-}" ] && [[ "$name $*" == *"$SHIM_PRINT_ON"* ]]; then printf '%s\\n' "$SHIM_PRINT"; fi
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
  haskell) printf 'name: x\n' > x.cabal ;;
  deno) printf '{}' > deno.json ;;
  deno-build) printf '{"tasks":{"build":"deno run -A dev.ts build"}}' > deno.json ;;
  laravel) printf '{}' > composer.json; printf '<?php\n' > index.php; printf '#!/usr/bin/env php\n' > artisan; printf '<phpunit/>' > phpunit.xml; printf 'APP_KEY=\n' > .env.example ;;
  elixir-ecto) printf '{:ecto_sql, "~> 3.12"}\n' > mix.exs ;;
  nerves) printf '{:nerves_bootstrap, "~> 1.13"}\n' > mix.exs ;;
  gleam) printf 'name = "x"\n' > gleam.toml ;;
  julia) printf 'name = "X"\n' > Project.toml ;;
  nim) printf 'version = "0.1.0"\n' > x.nimble ;;
  crystal) printf 'name: x\n' > shard.yml; mkdir spec ;;
  crystal-db) printf 'name: x\ndependencies:\n  avram:\n    github: luckyframework/avram\n' > shard.yml; mkdir spec ;;
  ocaml) printf '(lang dune 3.0)\n' > dune-project ;;
  clojure) printf '(defproject x "0.1.0")\n' > project.clj ;;
  crow) printf 'GIT_REPOSITORY https://github.com/CrowCpp/Crow.git\n' > CMakeLists.txt ;;
  zig-test) printf 'const tests = b.step("test", "Run the tests");\n' > build.zig ;;
  zig-url) printf 'const tests = b.step("test", "Run the tests");\n' > build.zig; printf '.{\n    .dependencies = .{\n        .zap = .{\n            .url = "https://example.invalid/zap.tar.gz",\n        },\n    },\n}\n' > build.zig.zon ;;
  v) printf 'Module {}\n' > v.mod; mkdir src; touch src/main.v src/main_test.v ;;
  odin) printf '{}' > ols.json; mkdir scripts; printf 'exit 0\n' > scripts/setup-deps.sh ;;
  pony) printf '{}' > corral.json ;;
  ballerina) printf '[package]\n' > Ballerina.toml ;;
  grain) mkdir src; touch src/main.gr ;;
  unison) printf 'selfTest = ()\n' > main.u ;;
  mojo) printf '' > pixi.toml ;;
  mojo-fastapi) printf '' > pixi.toml; printf '' > mojo_bindings.mojo; printf 'fastapi\n' > requirements.txt ;;
  red) printf '' > main.red ;;
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
    ['servant', 'haskell', ['ghc', 'cabal'], 'cabal build', 'build failed', 'cabal build all --enable-tests'],
    ['oak-deno', 'deno', ['deno'], 'deno check', 'check failed', 'deno check'],
    ['oak-deno', 'deno', ['deno'], 'deno test', 'test failed', 'deno test -A'],
    ['fresh-deno', 'deno-build', ['deno'], 'deno task build', 'build failed', 'deno task build'],
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

  it('runs the Deno steps in order (check, build when the app has a build task, test)', () => {
    const fresh = runHealthFixture('non-node', 'fresh-deno', { kinds: { 'fresh-deno': 'deno-build' }, tools: ['node', 'pnpm', 'npx', 'deno'] });
    const log = fresh.shimLog.split('\n');
    const order = ['deno check', 'deno task build', 'deno test -A'].map((fragment) => log.findIndex((line) => line.includes(fragment)));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // Oak defines no build task, so none is run
    const oak = runHealthFixture('non-node', 'oak-deno', { kinds: { 'oak-deno': 'deno' }, tools: ['node', 'pnpm', 'npx', 'deno'] });
    expect(oak.status).toBe(0);
    expect(oak.shimLog).not.toContain('deno task build');
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
    ['servant', 'haskell', 'ghc is not installed'],
    ['oak-deno', 'deno', 'deno is not installed'],
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

describe('native verification of the toolchain groups (swift, julia, nim, crystal, ocaml, clojure, beam, systems, exotic, exoticb)', () => {
  const ZAP_HASH = `1220${'0123456789abcdef'.repeat(4)}`;
  // A directory holding asio.hpp, named through CMAKE_INCLUDE_PATH (Crow needs the Asio headers).
  const asioInclude = () => {
    const directory = mkdtempSync(join(tmpdir(), 'template-health-asio-'));
    temporaryDirectories.push(directory);
    writeFileSync(join(directory, 'asio.hpp'), '');
    return { CMAKE_INCLUDE_PATH: directory };
  };

  // template, manifest kind, tools on PATH, command that fails, failure reason, command that must run
  const GROUP_TOOLCHAINS: Array<[string, string, string[], string, string, string]> = [
    ['hummingbird', 'swift', ['swift'], 'swift test', 'test failed', 'swift build --build-tests'],
    ['genie-jl', 'julia', ['julia'], 'Pkg.precompile', 'precompile failed', 'julia --startup-file=no --project=. -e using Pkg; Pkg.test()'],
    ['jester', 'nim', ['nim', 'nimble'], 'nimble build', 'build failed', 'nimble test -y'],
    ['kemal', 'crystal', ['crystal', 'shards'], 'crystal spec', 'spec failed', 'shards build'],
    ['dream-ocaml', 'ocaml', ['opam'], 'dune build', 'build failed', 'opam exec -- dune runtest --root .'],
    ['compojure', 'clojure', ['lein', 'java'], 'lein test', 'test failed', 'lein check'],
    ['plug-ex', 'elixir', ['mix'], 'mix test', 'test failed', 'mix compile'],
    ['nerves-ex', 'nerves', ['mix'], 'mix archive.install', 'bootstrap failed', 'mix archive.install hex nerves_bootstrap --force'],
    ['wisp', 'gleam', ['gleam', 'erl', 'rebar3'], 'gleam build', 'build failed', 'gleam test'],
    ['zig-http', 'zig-test', ['zig'], 'zig build test', 'test failed', 'zig build test'],
    ['crow', 'crow', ['cmake', 'g++', 'git', 'ctest'], 'ctest', 'test failed', 'ctest --test-dir build --output-on-failure'],
    ['vweb', 'v', ['v', 'gcc'], 'v fmt', 'fmt failed', 'v -cc gcc test src/main_test.v'],
    ['odin-http', 'odin', ['odin', 'git'], 'odin test', 'test failed', 'odin build src -collection:deps=./deps'],
    ['ballerina', 'ballerina', ['bal'], 'bal build', 'build failed', 'bal build'],
    ['ballerina', 'ballerina', ['bal'], 'bal test', 'test failed', 'bal test'],
    ['grain', 'grain', ['grain'], 'grain run build/router_test.wasm', 'test failed', 'grain compile tests/router_test.gr'],
    ['unison', 'unison', ['ucm'], 'ucm transcript', 'transcript failed', 'ucm transcript'],
    ['laravel', 'laravel', ['php', 'composer'], 'artisan test', 'phpunit failed', 'php artisan route:list'],
  ];

  it.each(GROUP_TOOLCHAINS)('%s: verified with its own toolchain', (template, kind, tools, _failOn, _reason, ran) => {
    const result = runHealthFixture('non-node', template, {
      kinds: { [template]: kind },
      tools: ['node', 'pnpm', 'npx', ...tools],
      env: asioInclude(),
    });
    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Native build verified');
    expect(result.stdout).not.toContain('unexpected-install');
    expect(result.shimLog).toContain(ran);
  });

  it.each(GROUP_TOOLCHAINS)('%s: fails (never passes) when the toolchain step fails', (template, kind, tools, failOn, reason) => {
    const result = runHealthFixture('non-node', template, {
      kinds: { [template]: kind },
      tools: ['node', 'pnpm', 'npx', ...tools],
      failOn,
      env: asioInclude(),
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
    expect(result.stdout).toContain(`native build: ${reason}`);
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });

  // Paths that cannot pass under the shims (they run a program the build produced, or boot a
  // server), so only their failures are checked: template, kind, tools, command that fails, reason.
  it.each<[string, string, string[], string, string]>([
    ['jennet-pony', 'pony', ['ponyc', 'corral'], '', 'ponyc-version failed'],
    ['mojo', 'mojo', ['mojo'], 'mojo build main.mojo', 'build failed'],
    ['mojo-fastapi', 'mojo-fastapi', ['mojo', 'python3'], 'mojo build mojo_bindings.mojo', 'build-extension failed'],
    ['red-http', 'red', ['red'], 'red -r -o bin/test-app', 'build-tests failed'],
    ['zap-zig', 'zig-url', ['zig'], 'zig fetch', 'fetch failed'],
    ['zap-zig', 'zig-url', ['zig'], '', 'zig fetch printed no package hash for https://example.invalid/zap.tar.gz'],
  ])('%s (%s, case %#): a failing step fails the template', (template, kind, tools, failOn, reason) => {
    const result = runHealthFixture('non-node', template, {
      kinds: { [template]: kind },
      tools: ['node', 'pnpm', 'npx', ...tools],
      ...(failOn ? { failOn } : {}),
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
    expect(result.stdout).toContain(`native build: ${reason}`);
  });

  it.each<[string, string, string[], string]>([
    ['hummingbird', 'swift', [], 'swift is not installed'],
    ['genie-jl', 'julia', [], 'julia is not installed'],
    ['jester', 'nim', [], 'nim is not installed'],
    ['jester', 'nim', ['nim'], 'nimble is not installed'],
    ['kemal', 'crystal', [], 'crystal is not installed'],
    ['kemal', 'crystal', ['crystal'], 'shards is not installed'],
    ['dream-ocaml', 'ocaml', [], 'opam (OCaml package manager) is not installed'],
    ['compojure', 'clojure', [], 'lein (Leiningen) is not installed'],
    ['compojure', 'clojure', ['lein'], 'java is not installed'],
    ['plug-ex', 'elixir', [], 'elixir (mix) is not installed'],
    ['wisp', 'gleam', [], 'gleam is not installed'],
    ['wisp', 'gleam', ['gleam'], 'erlang (erl) is not installed'],
    ['wisp', 'gleam', ['gleam', 'erl'], 'rebar3 is not installed (gleam needs it for Erlang dependencies)'],
    ['zap-zig', 'zig-url', [], 'zig is not installed'],
    ['crow', 'crow', [], 'cmake is not installed'],
    ['crow', 'crow', ['cmake', 'g++'], 'git is not installed (CMake fetches Crow from GitHub)'],
    ['vweb', 'v', [], 'v (the V compiler) is not installed'],
    ['vweb', 'v', ['v'], 'gcc is not installed (V compiles to C, built here with -cc gcc)'],
    ['odin-http', 'odin', [], 'odin (the Odin compiler) is not installed'],
    ['jennet-pony', 'pony', [], 'ponyc (the Pony compiler) is not installed'],
    ['jennet-pony', 'pony', ['ponyc'], 'corral (the Pony dependency manager) is not installed'],
    ['ballerina', 'ballerina', [], 'bal (Ballerina) is not installed'],
    ['grain', 'grain', [], 'grain (the Grain compiler) is not installed'],
    ['unison', 'unison', [], 'ucm (Unison Codebase Manager) is not installed'],
    ['mojo', 'mojo', [], 'mojo is not installed (pip install mojo)'],
    // mojo-fastapi also ships requirements.txt: it must still reach the Mojo verifier.
    ['mojo-fastapi', 'mojo-fastapi', [], 'mojo is not installed (pip install mojo)'],
    ['mojo-fastapi', 'mojo-fastapi', ['mojo'], 'python3 is not installed'],
    ['red-http', 'red', [], 'red (the 32-bit Red toolchain, red-toolchain-NNN) is not installed'],
  ])('%s (%s, with %j): SKIP names the missing toolchain', (template, kind, tools, reason) => {
    const result = runHealthFixture('non-node', template, {
      kinds: { [template]: kind },
      tools: ['node', 'pnpm', 'npx', ...tools],
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 0 passed, 0 failed, 1 skipped');
    expect(result.stdout).toContain(`${template} (toolchain missing: ${reason})`);
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });

  it('skips an OCaml template when opam has no switch selected', () => {
    const result = runHealthFixture('non-node', 'dream-ocaml', {
      kinds: { 'dream-ocaml': 'ocaml' },
      tools: ['node', 'pnpm', 'npx', 'opam'],
      failOn: 'opam switch show',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('dream-ocaml (toolchain missing: opam has no switch selected (create one, or set OPAMSWITCH))');
    expect(result.shimLog).not.toContain('opam install');
  });

  it('skips Crow when the Asio headers are not on any include path CMake searches', () => {
    const empty = mkdtempSync(join(tmpdir(), 'template-health-no-asio-'));
    temporaryDirectories.push(empty);
    const asioOnSystem = ['/usr/include/asio.hpp', '/usr/local/include/asio.hpp'].some((file) => existsSync(file));
    const result = runHealthFixture('non-node', 'crow', {
      kinds: { crow: 'crow' },
      tools: ['node', 'pnpm', 'npx', 'cmake', 'g++', 'git', 'ctest'],
      env: { CMAKE_INCLUDE_PATH: empty },
    });
    if (asioOnSystem) {
      // The system headers satisfy the check; nothing to skip on this machine.
      expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
    } else {
      expect(result.stdout).toContain('crow (toolchain missing: Asio headers are not installed (apt install libasio-dev))');
      expect(result.shimLog).not.toContain('cmake -S');
    }
  });

  it('runs the steps of each verifier in order', () => {
    const cases: Array<[string, string, string[], string[]]> = [
      ['hummingbird', 'swift', ['swift'], ['swift build --build-tests', 'swift test --skip-build']],
      ['genie-jl', 'julia', ['julia'], ['Pkg.instantiate()', 'Pkg.precompile()', 'Pkg.test()']],
      ['jester', 'nim', ['nim', 'nimble'], ['nimble install -y --depsOnly', 'nimble build -y', 'nimble test -y']],
      ['dream-ocaml', 'ocaml', ['opam'], ['opam install --yes --deps-only .', 'dune build --root .', 'dune runtest --root .']],
      ['compojure', 'clojure', ['lein', 'java'], ['lein deps', 'lein check', 'lein test']],
      ['nerves-ex', 'nerves', ['mix'], ['mix archive.install hex nerves_bootstrap', 'mix deps.get', 'mix compile', 'mix test']],
      ['wisp', 'gleam', ['gleam', 'erl', 'rebar3'], ['gleam deps download', 'gleam build', 'gleam test']],
      ['crow', 'crow', ['cmake', 'g++', 'git', 'ctest'], ['cmake -S . -B build', 'cmake --build build', 'ctest --test-dir build']],
      ['vweb', 'v', ['v', 'gcc'], ['v fmt -verify', 'v -cc gcc -o', 'v -cc gcc test']],
      ['ballerina', 'ballerina', ['bal'], ['bal build', 'bal test']],
      ['grain', 'grain', ['grain'], ['grain compile src/main.gr', 'grain run build/main.wasm', 'grain compile tests/router_test.gr', 'grain run build/router_test.wasm']],
      ['laravel', 'laravel', ['php', 'composer'], ['php -l', 'composer install', 'php artisan route:list', 'php artisan test']],
    ];
    for (const [template, kind, tools, steps] of cases) {
      const result = runHealthFixture('non-node', template, { kinds: { [template]: kind }, tools: ['node', 'pnpm', 'npx', ...tools], env: asioInclude() });
      expect(result.status, template).toBe(0);
      const log = result.shimLog.split('\n');
      const order = steps.map((fragment) => log.findIndex((line) => line.includes(fragment)));
      expect(order.every((index) => index >= 0), `${template}: ${JSON.stringify(order)}`).toBe(true);
      expect([...order].sort((a, b) => a - b), template).toEqual(order);
    }
  });

  it('builds and runs the Vapor XCTVapor tests like any SwiftPM template', () => {
    const result = runHealthFixture('non-node', 'vapor', { kinds: { vapor: 'swift' }, tools: ['node', 'pnpm', 'npx', 'swift'] });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
    const log = result.shimLog.split('\n');
    const order = ['swift build --build-tests', 'swift test --skip-build'].map((fragment) => log.findIndex((line) => line.includes(fragment)));
    expect(order.every((index) => index >= 0), JSON.stringify(order)).toBe(true);
    expect(order[0]).toBeLessThan(order[1]);
    expect(result.stdout).not.toContain('NOTE:');
  });

  it('fails Vapor when its tests fail', () => {
    const result = runHealthFixture('non-node', 'vapor', { kinds: { vapor: 'swift' }, tools: ['node', 'pnpm', 'npx', 'swift'], failOn: 'swift test' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
  });

  it('runs mix test for an Ecto app (Phoenix) when PostgreSQL answers', () => {
    const result = runHealthFixture('non-node', 'phoenix', { kinds: { phoenix: 'elixir-ecto' }, tools: ['node', 'pnpm', 'npx', 'mix', 'psql'] });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
    expect(result.shimLog).toContain('psql -h localhost -U postgres');
    const log = result.shimLog.split('\n');
    const order = ['mix deps.get', 'mix compile', 'mix test'].map((fragment) => log.findIndex((line) => line.includes(fragment)));
    expect(order.every((index) => index >= 0), JSON.stringify(order)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(result.shimLog).not.toContain('nerves_bootstrap');
    expect(result.stdout).not.toContain('NOTE:');
  });

  it('fails Phoenix when mix test fails', () => {
    const result = runHealthFixture('non-node', 'phoenix', {
      kinds: { phoenix: 'elixir-ecto' },
      tools: ['node', 'pnpm', 'npx', 'mix', 'psql'],
      failOn: 'mix test',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
  });

  it('compiles an Ecto app (Phoenix) without running its tests when no PostgreSQL is available, and says so', () => {
    const result = runHealthFixture('non-node', 'phoenix', { kinds: { phoenix: 'elixir-ecto' }, tools: ['node', 'pnpm', 'npx', 'mix'] });
    expect(result.status).toBe(0);
    expect(result.shimLog).toContain('mix compile');
    expect(result.shimLog).not.toContain('mix test');
    expect(result.shimLog).not.toContain('nerves_bootstrap');
    expect(result.stdout).toContain("NOTE: compiled only: the app's tests need PostgreSQL (postgres/postgres on localhost); mix test was not run");
  });

  it('fails Phoenix instead of downgrading to compile-only when PostgreSQL is required but not answering', () => {
    const result = runHealthFixture('non-node', 'phoenix', {
      kinds: { phoenix: 'elixir-ecto' },
      tools: ['node', 'pnpm', 'npx', 'mix', 'psql'],
      failOn: 'psql',
      env: { TEMPLATE_HEALTH_REQUIRE_POSTGRES: '1' },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
    expect(result.stdout).toContain('TEMPLATE_HEALTH_REQUIRE_POSTGRES=1');
    expect(result.shimLog).not.toContain('mix test');
    expect(result.stdout).not.toContain('NOTE: compiled only');
  });

  it('type-checks database-backed Crystal specs when no PostgreSQL is running, and says so', () => {
    const result = runHealthFixture('non-node', 'lucky-cr', { kinds: { 'lucky-cr': 'crystal-db' }, tools: ['node', 'pnpm', 'npx', 'crystal', 'shards'] });
    expect(result.status).toBe(0);
    expect(result.shimLog).toContain('crystal build --no-codegen .spec_typecheck.cr');
    expect(result.shimLog).not.toContain('crystal spec');
    expect(result.stdout).toContain('NOTE: the specs need PostgreSQL');
  });

  it('fails a type-checked Crystal run when PostgreSQL is required but not running', () => {
    const result = runHealthFixture('non-node', 'lucky-cr', {
      kinds: { 'lucky-cr': 'crystal-db' },
      tools: ['node', 'pnpm', 'npx', 'crystal', 'shards'],
      env: { TEMPLATE_HEALTH_REQUIRE_POSTGRES: '1' },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 0 passed, 1 failed, 0 skipped');
    expect(result.stdout).toContain('TEMPLATE_HEALTH_REQUIRE_POSTGRES=1');
    expect(result.shimLog).not.toContain('crystal spec');
    expect(result.shimLog).not.toContain('.spec_typecheck.cr');
  });

  it('exits 1 on a SKIP only when TEMPLATE_HEALTH_FAIL_ON_SKIP=1', () => {
    const options = { kinds: { jester: 'nim' }, tools: ['node', 'pnpm', 'npx'] };
    const lenient = runHealthFixture('non-node', 'jester', options);
    expect(lenient.status).toBe(0);
    expect(lenient.stdout).toContain('RESULTS: 0 passed, 0 failed, 1 skipped');
    const strict = runHealthFixture('non-node', 'jester', { ...options, env: { TEMPLATE_HEALTH_FAIL_ON_SKIP: '1' } });
    expect(strict.status).toBe(1);
    expect(strict.stdout).toContain('RESULTS: 0 passed, 0 failed, 1 skipped');
    expect(strict.stdout).toContain('SKIPs are not allowed here (TEMPLATE_HEALTH_FAIL_ON_SKIP=1)');
    expect(strict.stdout).not.toContain('ALL TEMPLATES PASSED');
  });

  it('keeps a passing strict run green', () => {
    const result = runHealthFixture('non-node', 'jester', {
      kinds: { jester: 'nim' },
      tools: ['node', 'pnpm', 'npx', 'nim', 'nimble'],
      env: { TEMPLATE_HEALTH_FAIL_ON_SKIP: '1' },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
  });

  it('pins an unhashed Zig URL dependency from zig fetch, then builds and tests', () => {
    const result = runHealthFixture('non-node', 'zap-zig', {
      kinds: { 'zap-zig': 'zig-url' },
      tools: ['node', 'pnpm', 'npx', 'zig'],
      env: { SHIM_PRINT_ON: 'zig fetch', SHIM_PRINT: ZAP_HASH },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`hash: ${ZAP_HASH} (https://example.invalid/zap.tar.gz)`);
    expect(result.stdout).toContain('NOTE: dependency hash computed during the run');
    const log = result.shimLog.split('\n');
    const order = ['zig fetch https://example.invalid/zap.tar.gz', 'zig build', 'zig build test'].map((command) => log.indexOf(command));
    expect(order.every((index) => index >= 0), JSON.stringify(log)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('reports a Unison transcript run without a separate compile step', () => {
    const result = runHealthFixture('non-node', 'unison', { kinds: { unison: 'unison' }, tools: ['node', 'pnpm', 'npx', 'ucm'] });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NOTE: Unison has no separate compile step');
  });

  it('prints a failed Unison transcript error from its start, not only its last lines', () => {
    const candidates = Array.from({ length: 20 }, (_, index) => `(T${index}.==) : T${index} -> T${index} -> Boolean`);
    const result = runHealthFixture('non-node', 'unison', {
      kinds: { unison: 'unison' },
      tools: ['node', 'pnpm', 'npx', 'ucm'],
      failOn: 'ucm transcript',
      env: {
        SHIM_PRINT_ON: 'ucm transcript',
        SHIM_PRINT: ['The transcript failed due to an error in the stanza above. The error is:', "I couldn't figure out what == refers to here:", ...candidates].join('\n'),
      },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('native build: transcript failed');
    expect(result.stdout).toContain("| I couldn't figure out what == refers to here:");
  });

  it('fails Jennet when ponyc is not the 0.61.0 release it needs', () => {
    const result = runHealthFixture('non-node', 'jennet-pony', {
      kinds: { 'jennet-pony': 'pony' },
      tools: ['node', 'pnpm', 'npx', 'ponyc', 'corral'],
      env: { SHIM_PRINT_ON: 'ponyc --version', SHIM_PRINT: '0.74.0-8e04579 [release]' },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('found ponyc 0.74.0-8e04579 [release], jennet-pony needs 0.61.0');
    expect(result.stdout).toContain('native build: ponyc-version failed');
    expect(result.shimLog).not.toContain('corral fetch');
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


describe('template health wiring', () => {
  const INFEASIBLE = ['perfect', 'roc', 'carbon', 'vale'];
  const workflow = readFileSync(resolve(__dirname, '../../../../.github/workflows/template-health.yml'), 'utf8');

  const groups: Record<string, string[]> = {};
  for (const match of healthScript.matchAll(/^GROUP_([A-Z]+)=\(\n([\s\S]*?)\n\)/gm)) {
    groups[match[1].toLowerCase()] = match[2]
      .split('\n')
      .map((line) => line.replace(/#.*/, ''))
      .join(' ')
      .split(/\s+/)
      .filter(Boolean);
  }
  const wired = Object.values(groups).flat();

  it('parses every group array of the script', () => {
    expect(Object.keys(groups).sort()).toEqual(
      ['core', 'jvm', 'dotnet', 'native', 'node', 'config', 'haskell', 'deno', 'swift', 'julia', 'nim', 'crystal', 'ocaml', 'clojure', 'beam', 'systems', 'exotic', 'exoticb'].sort(),
    );
  });

  it('wires every registered backend template exactly once, except the infeasible ones', () => {
    expect(wired.filter((id, index) => wired.indexOf(id) !== index)).toEqual([]);
    const expected = Object.keys(backendTemplates).filter((id) => !INFEASIBLE.includes(id));
    expect([...wired].sort()).toEqual([...expected].sort());
  });

  it.each(INFEASIBLE)('registers %s but keeps it out of every group', (id) => {
    expect(Object.keys(backendTemplates)).toContain(id);
    expect(wired).not.toContain(id);
  });

  it('places the newly wired templates in their groups', () => {
    expect(groups.swift).toEqual(['hummingbird', 'kitura']);
    expect(groups.julia).toEqual(['genie-jl', 'oxygen-jl']);
    expect(groups.nim).toEqual(['jester', 'prologue-nim', 'happyx-nim']);
    expect(groups.crystal).toEqual(['kemal', 'lucky-cr', 'amber-cr']);
    expect(groups.ocaml).toEqual(['dream-ocaml', 'opium-ocaml']);
    expect(groups.clojure).toEqual(['compojure', 'luminus-clj', 'reitit-clj', 'pedestal-clj']);
    expect(groups.beam).toEqual(['plug-ex', 'nerves-ex', 'wisp']);
    expect(groups.systems).toEqual(['vweb', 'vex-v', 'odin-http', 'jennet-pony']);
    expect(groups.exotic).toEqual(['grain', 'ballerina', 'unison']);
    expect(groups.exoticb).toEqual(['mojo', 'mojo-fastapi', 'red-http']);
    expect(groups.core).toContain('zap-zig');
    expect(groups.core).toContain('laravel');
    expect(groups.native).toContain('crow');
    expect(groups.deno).toContain('aleph-deno');
  });

  it('runs a workflow matrix job for exactly the groups the script defines', () => {
    const matrix = /group: \[([^\]]+)\]/.exec(workflow);
    expect(matrix).not.toBeNull();
    const jobs = matrix![1].split(',').map((name) => name.trim());
    expect(jobs.sort()).toEqual(Object.keys(groups).sort());
  });

  it('selects every group with a --group case arm', () => {
    for (const name of Object.keys(groups)) {
      expect(healthScript, name).toMatch(new RegExp(`^\\s+${name}\\) TEMPLATES\\+=\\("\\$\\{GROUP_${name.toUpperCase()}\\[@\\]\\}"\\)`, 'm'));
      expect(healthScript, name).toContain(`"\${GROUP_${name.toUpperCase()}[@]}"`);
    }
  });

  it('fails the toolchain-installing groups on a SKIP and requires PostgreSQL for Crystal and core (Phoenix)', () => {
    const strict = /TEMPLATE_HEALTH_FAIL_ON_SKIP: \$\{\{ contains\(fromJSON\('(\[[^']*\])'\), matrix\.group\)/.exec(workflow);
    expect(strict).not.toBeNull();
    const strictGroups = JSON.parse(strict![1]) as string[];
    expect(strictGroups.sort()).toEqual(['swift', 'julia', 'nim', 'crystal', 'ocaml', 'clojure', 'beam', 'systems', 'exotic', 'exoticb'].sort());
    for (const name of strictGroups) expect(Object.keys(groups)).toContain(name);
    const postgres = /TEMPLATE_HEALTH_REQUIRE_POSTGRES: \$\{\{ contains\(fromJSON\('(\[[^']*\])'\), matrix\.group\)/.exec(workflow);
    expect(postgres).not.toBeNull();
    expect((JSON.parse(postgres![1]) as string[]).sort()).toEqual(['core', 'crystal']);
    // The groups that require PostgreSQL start the runner's PostgreSQL service before the script runs.
    expect(workflow).toMatch(/if: matrix\.group == 'crystal' \|\| matrix\.group == 'core'\n\s+name: Start PostgreSQL[^\n]*\n\s+run: \|\n\s+sudo systemctl start postgresql\.service/);
    // Phoenix is in core and Vapor's tests need no database server.
    expect(groups.core).toContain('phoenix');
    expect(groups.core).toContain('vapor');
  });
});
