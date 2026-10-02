import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
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

function runHealthFixture(scenario: string, templates: string | string[] = 'express') {
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
if [ "$SCENARIO" = scaffold ]; then echo Scaffolded; exit 1; fi
if [ "$SCENARIO" = missing-app ]; then echo Scaffolded; exit 0; fi
if [ "$SCENARIO" = mixed ] && [ "$3" = test-fastapi ]; then SCENARIO=non-node; fi
mkdir -p "$PWD/$3/apps/$3"
cd "$PWD/$3/apps/$3"
if [ "$SCENARIO" != non-node ] && [ "$SCENARIO" != missing-package ]; then printf '{}' > package.json; fi
if [ "$SCENARIO" = malformed-package ]; then printf '{"name":}' > package.json; fi
if [ "$SCENARIO" != no-tsconfig ]; then printf '{}' > tsconfig.json; fi
if [ "$SCENARIO" = prisma ]; then mkdir prisma; touch prisma/schema.prisma; fi
echo Scaffolded
`, { mode: 0o755 });
  writeFileSync(join(bin, 'pnpm'), `#!/bin/bash
set -eu
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
  const result = spawnSync('bash', [join(scripts, 'scaffold-test-templates.sh'), ...templateList], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SCENARIO: scenario, TMPDIR: workspaces, REAL_NODE: process.execPath, FIXTURE_REPO: root },
    timeout: 10000,
  });
  expect(readdirSync(workspaces)).toEqual([]);
  return result;
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

  it('counts non-Node templates as unverified skips without attempting pnpm', () => {
    const result = runHealthFixture('non-node', 'fastapi');
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 0 passed, 0 failed, 1 skipped');
    expect(result.stdout).toContain('not verified');
    expect(result.stdout).not.toContain('unexpected-install');
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });

  it('counts successful Node typechecks as passes', () => {
    const result = runHealthFixture('pass');
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('RESULTS: 1 passed, 0 failed, 0 skipped');
  });

  it('counts mixed passes, failures, and unverified skips independently', () => {
    const result = runHealthFixture('mixed', ['express', 'fastify', 'fastapi']);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('RESULTS: 1 passed, 1 failed, 1 skipped');
    expect(result.stdout).toContain('fastify (typecheck:');
    expect(result.stdout).toContain('fastapi (non-Node build not verified)');
    expect(result.stdout).not.toContain('ALL TEMPLATES PASSED');
  });
});
