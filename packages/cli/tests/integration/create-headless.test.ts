import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  createDryRunResponseSchema,
  createResponseSchema,
  jsonResponseSchema,
} from '@re-shell/contracts';

/**
 * End-to-end tests for `re-shell create` run as the real, built CLI with stdin
 * closed (/dev/null, not a TTY) and a hard timeout: the CLI must never wait on a
 * prompt, must exit with the right code, and must produce what it claims.
 */

const cliPath = path.join(process.cwd(), 'dist/index.js');
const TIMEOUT_MS = 60_000;

interface RunResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

/** Run the built CLI with stdin closed and a timeout; never inherits a TTY. */
function runCli(args: string[], cwd: string): RunResult {
  const started = Date.now();
  const res = spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: TIMEOUT_MS,
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return {
    status: res.status,
    signal: res.signal,
    timedOut: (res.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    elapsedMs: Date.now() - started,
  };
}

/** Assert the run finished by itself with the given exit code (i.e. did not hang). */
function expectFinished(result: RunResult, status: number): void {
  expect(result.timedOut, `timed out; stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(false);
  expect(result.signal).toBeNull();
  expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(status);
}

function json(result: RunResult): any {
  return JSON.parse(result.stdout.trim());
}

describe('re-shell create with stdin closed (built CLI)', () => {
  let base: string;
  let n = 0;

  /** A fresh empty working directory per test. */
  function fresh(): string {
    const dir = path.join(base, `case-${++n}`);
    fs.mkdirpSync(dir);
    return dir;
  }

  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Built CLI not found at ${cliPath}. Run the package build first.`);
    }
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'create-headless-'));
  });

  afterAll(async () => {
    await fs.remove(base);
  });

  describe('modes finish without a terminal and write what they claim', () => {
    it('--frontend scaffolds a runnable frontend app at apps/<name> (was: empty apps/ + packages/)', () => {
      const cwd = fresh();
      const result = runCli(['create', 'fe-only', '--frontend', 'react-ts'], cwd);
      expectFinished(result, 0);

      const app = fs.readJsonSync(path.join(cwd, 'fe-only/apps/fe-only/package.json'));
      expect(app.scripts.dev).toContain('vite');
      expect(app.dependencies.react).toBeDefined();
      for (const file of ['index.html', 'vite.config.ts', 'src/main.tsx', 'src/App.tsx']) {
        expect(fs.existsSync(path.join(cwd, 'fe-only/apps/fe-only', file)), file).toBe(true);
      }
      expect(result.stdout).toContain('Scaffolded react-ts frontend');
      expect(result.stdout).not.toContain('empty workspace skeleton');
    });

    it('--backend creates just the API (was: a fullstack project)', () => {
      const cwd = fresh();
      const result = runCli(['create', 'be-only', '--backend', 'express'], cwd);
      expectFinished(result, 0);

      expect(fs.readdirSync(path.join(cwd, 'be-only/apps'))).toEqual(['be-only']);
      expect(fs.existsSync(path.join(cwd, 'be-only/apps/be-only/index.html'))).toBe(false);
      expect(fs.existsSync(path.join(cwd, 'be-only/apps/be-only/package.json'))).toBe(true);
      // Minimal workspace files.
      expect(fs.existsSync(path.join(cwd, 'be-only/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'be-only/pnpm-workspace.yaml'))).toBe(true);
      expect(result.stdout).not.toContain('frontend');
    });

    it('--fullstack without --backend uses the default backend (express) instead of scaffolding nothing', () => {
      const cwd = fresh();
      const result = runCli(['create', 'fs-app', '--fullstack'], cwd);
      expectFinished(result, 0);

      expect(fs.existsSync(path.join(cwd, 'fs-app/apps/fs-app/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'fs-app/apps/fs-app-api/package.json'))).toBe(true);
      expect(result.stdout).toContain('default backend "express"');
    });

    it('--microfrontend --yes finishes (was: hung on "Select shell application framework")', () => {
      const cwd = fresh();
      const result = runCli(['create', 'mf-app', '--microfrontend', '--yes'], cwd);
      expectFinished(result, 0);

      expect(fs.existsSync(path.join(cwd, 'mf-app/shell/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'mf-app/remotes/remote-1/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'mf-app/shared/package.json'))).toBe(true);
    });

    it('--microfrontend --framework react-ts --yes also finishes (it still hung with --framework)', () => {
      const cwd = fresh();
      const result = runCli(
        ['create', 'mf-fw', '--microfrontend', '--framework', 'react-ts', '--yes', '--remotes', 'cart,search'],
        cwd
      );
      expectFinished(result, 0);
      expect(fs.existsSync(path.join(cwd, 'mf-fw/remotes/cart/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'mf-fw/remotes/search/package.json'))).toBe(true);
    });

    it('--microfrontend without --yes finishes too (a non-TTY stdin is enough)', () => {
      const cwd = fresh();
      expectFinished(runCli(['create', 'mf-noyes', '--microfrontend'], cwd), 0);
      expect(fs.existsSync(path.join(cwd, 'mf-noyes/shell/package.json'))).toBe(true);
    });

    it('--polyglot --yes finishes with exit 0 (was: hung, and exited 0 when killed)', () => {
      const cwd = fresh();
      const result = runCli(['create', 'poly', '--polyglot', '--yes'], cwd);
      expectFinished(result, 0);

      expect(fs.existsSync(path.join(cwd, 'poly/gateway/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'poly/services/typescript-service-1/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'poly/services/python-service-2'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'poly/frontend/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'poly/docker-compose.yml'))).toBe(true);
    });

    it('--polyglot with custom --services/--gateway', () => {
      const cwd = fresh();
      const result = runCli(
        ['create', 'poly2', '--polyglot', '--gateway', 'fastify', '--services', 'users:fastapi,orders:express'],
        cwd
      );
      expectFinished(result, 0);
      expect(fs.existsSync(path.join(cwd, 'poly2/services/users'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'poly2/services/orders/package.json'))).toBe(true);
    });

    it('--template blank is an empty skeleton and prints skeleton-specific next steps', () => {
      const cwd = fresh();
      const result = runCli(['create', 'blank-ws', '--template', 'blank'], cwd);
      expectFinished(result, 0);

      expect(fs.readdirSync(path.join(cwd, 'blank-ws/apps'))).toEqual([]);
      expect(result.stdout).toContain('empty workspace skeleton');
      expect(result.stdout).toContain('nothing is runnable yet');
      expect(result.stdout).toContain('re-shell create <app> --frontend react-ts');
      // It must not imply there is something to run right now.
      expect(result.stdout).not.toMatch(/\n\s*3\. pnpm run dev\n/);
    });

    it('a bare create defaults to a react-ts frontend app', () => {
      const cwd = fresh();
      const result = runCli(['create', 'plain'], cwd);
      expectFinished(result, 0);
      expect(fs.existsSync(path.join(cwd, 'plain/apps/plain/package.json'))).toBe(true);
      expect(result.stdout).toContain('defaulting to a "react-ts" frontend');
    });
  });

  describe('inside an existing monorepo', () => {
    function stageMonorepo(cwd: string): void {
      fs.writeJsonSync(path.join(cwd, 'package.json'), {
        name: 'host',
        private: true,
        workspaces: ['apps/*', 'packages/*', 'services/*'],
      });
      fs.mkdirpSync(path.join(cwd, 'apps'));
    }

    it('create <name> --framework react-ts --yes finishes (was: hung on "Route path:")', () => {
      const cwd = fresh();
      stageMonorepo(cwd);
      const result = runCli(['create', 'web', '--framework', 'react-ts', '--yes'], cwd);
      expectFinished(result, 0);
      expect(fs.readJsonSync(path.join(cwd, 'apps/web/package.json')).reshell.route).toBe('/web');
    });

    it('also finishes without --yes when stdin is closed', () => {
      const cwd = fresh();
      stageMonorepo(cwd);
      expectFinished(runCli(['create', 'web2', '--framework', 'react-ts'], cwd), 0);
      expect(fs.existsSync(path.join(cwd, 'apps/web2/package.json'))).toBe(true);
    });

    it('fullstack puts the API under services/<name>-api', () => {
      const cwd = fresh();
      stageMonorepo(cwd);
      expectFinished(runCli(['create', 'shop', '--fullstack', '--yes'], cwd), 0);
      expect(fs.existsSync(path.join(cwd, 'apps/shop/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(cwd, 'services/shop-api/package.json'))).toBe(true);
    });

    it('an existing workspace directory fails with CREATE_TARGET_EXISTS instead of prompting', () => {
      const cwd = fresh();
      stageMonorepo(cwd);
      expectFinished(runCli(['create', 'web', '--framework', 'react-ts', '--yes'], cwd), 0);

      const result = runCli(['create', 'web', '--framework', 'react-ts', '--yes', '--json'], cwd);
      expectFinished(result, 1);
      expect(json(result).error.code).toBe('CREATE_TARGET_EXISTS');

      expectFinished(runCli(['create', 'web', '--framework', 'react-ts', '--yes', '--force'], cwd), 0);
    });
  });

  describe('explicit failures', () => {
    it('create x --template go-gin --dry-run --json fails with TEMPLATE_NOT_FOUND and suggestions', () => {
      const cwd = fresh();
      const result = runCli(['create', 'x', '--template', 'go-gin', '--dry-run', '--json'], cwd);
      expectFinished(result, 1);

      const env = json(result);
      expect(env.ok).toBe(false);
      expect(env.error.code).toBe('TEMPLATE_NOT_FOUND');
      expect(env.error.message).toContain('Unknown template "go-gin"');
      expect(env.error.details.suggestions).toContain('gin');
      expect(fs.readdirSync(cwd)).toEqual([]);
    });

    it('prints the same error (with close matches) and exits non-zero without --json', () => {
      const cwd = fresh();
      const result = runCli(['create', 'x', '--template', 'go-gin', '--dry-run'], cwd);
      expectFinished(result, 1);
      expect(result.stderr).toContain('Unknown template "go-gin"');
      expect(result.stderr).toContain('Did you mean: gin');
      expect(result.stdout).not.toContain('Mode: frontend');
    });

    it('rejects an unknown --backend / --frontend with TEMPLATE_NOT_FOUND (no silent skeleton)', () => {
      const cwd = fresh();
      const backend = runCli(['create', 'a', '--backend', 'nope-js', '--json'], cwd);
      expectFinished(backend, 1);
      expect(json(backend).error.code).toBe('TEMPLATE_NOT_FOUND');

      const frontend = runCli(['create', 'b', '--frontend', 'react-tsx', '--json'], cwd);
      expectFinished(frontend, 1);
      expect(json(frontend).error.details.suggestions).toContain('react-ts');
      expect(fs.readdirSync(cwd)).toEqual([]);
    });

    it('rejects contradictory flags with CREATE_INVALID_OPTIONS', () => {
      const cwd = fresh();
      const result = runCli(['create', 'x', '--polyglot', '--microfrontend', '--json'], cwd);
      expectFinished(result, 1);
      expect(json(result).error.code).toBe('CREATE_INVALID_OPTIONS');
    });

    it('an existing top-level directory fails with CREATE_TARGET_EXISTS', () => {
      const cwd = fresh();
      expectFinished(runCli(['create', 'dup', '--frontend', 'react-ts'], cwd), 0);
      const result = runCli(['create', 'dup', '--frontend', 'react-ts', '--json'], cwd);
      expectFinished(result, 1);
      expect(json(result).error.code).toBe('CREATE_TARGET_EXISTS');
    });
  });

  describe('--json', () => {
    it('a real run emits one parseable envelope matching the contract', () => {
      const cwd = fresh();
      const result = runCli(['create', 'jsonapp', '--frontend', 'react-ts', '--json'], cwd);
      expectFinished(result, 0);

      const parsed = jsonResponseSchema(createResponseSchema).safeParse(json(result));
      expect(parsed.success, JSON.stringify(parsed)).toBe(true);
      const data = json(result).data;
      expect(data).toMatchObject({ mode: 'frontend', skeleton: false, dryRun: false });
      expect(data.files).toContain('jsonapp/apps/jsonapp/package.json');
      // stdout carries only the envelope.
      expect(result.stdout.trim().split('\n')).toHaveLength(1);
    });

    it('--polyglot --json never prompts and reports the files', () => {
      const cwd = fresh();
      const result = runCli(['create', 'pj', '--polyglot', '--json'], cwd);
      expectFinished(result, 0);
      expect(json(result).data.mode).toBe('polyglot');
      expect(json(result).data.files).toContain('pj/gateway/package.json');
    });
  });

  describe('dry run (frontend and backend)', () => {
    it('frontend --dry-run --json lists the exact file set with previews and writes nothing', () => {
      const cwd = fresh();
      const dry = runCli(['create', 'web', '--frontend', 'react-ts', '--dry-run', '--json'], cwd);
      expectFinished(dry, 0);
      expect(fs.readdirSync(cwd)).toEqual([]);

      const parsed = jsonResponseSchema(createDryRunResponseSchema).safeParse(json(dry));
      expect(parsed.success, JSON.stringify(parsed)).toBe(true);
      const data = json(dry).data;
      expect(data).toMatchObject({ mode: 'frontend', dryRun: true, targetExists: false });
      expect(data.files.length).toBeGreaterThan(5);
      expect(data.files.every((f: any) => f.status === 'added' && f.action === 'create')).toBe(true);
      expect(Object.keys(data.previews).sort()).toEqual(data.files.map((f: any) => f.path).sort());
      expect(data.previews['web/apps/web/package.json']).toContain('"name": "@re-shell/web"');

      // The real run writes exactly that file set.
      const real = runCli(['create', 'web', '--frontend', 'react-ts', '--json'], cwd);
      expectFinished(real, 0);
      expect([...json(real).data.files].sort()).toEqual(data.files.map((f: any) => f.path).sort());
    });

    it('backend --dry-run --json (and --template <backend>) lists the files and keeps templateId', () => {
      const cwd = fresh();
      const byFlag = runCli(['create', 'svc', '--backend', 'express', '--dry-run', '--json'], cwd);
      expectFinished(byFlag, 0);
      expect(json(byFlag).data).toMatchObject({ mode: 'backend', templateId: 'express', backend: 'express' });

      const byTemplate = runCli(['create', 'svc', '--template', 'express', '--dry-run', '--json'], cwd);
      expectFinished(byTemplate, 0);
      expect(json(byTemplate).data.files.every((f: any) => f.action === 'create')).toBe(true);
      expect(fs.readdirSync(cwd)).toEqual([]);
    });

    it('fullstack / polyglot / microfrontend dry runs also report their exact file set', () => {
      for (const [flag, mode] of [
        ['--fullstack', 'fullstack'],
        ['--polyglot', 'polyglot'],
        ['--microfrontend', 'microfrontend'],
      ] as const) {
        const cwd = fresh();
        const dry = runCli(['create', 'dr', flag, '--dry-run', '--json'], cwd);
        expectFinished(dry, 0);
        expect(json(dry).data.mode).toBe(mode);
        expect(json(dry).data.files.length).toBeGreaterThan(5);
        expect(fs.readdirSync(cwd)).toEqual([]);
      }
    });

    it('classifies files as added / modified / unchanged against an existing target, with diffs', () => {
      const cwd = fresh();
      expectFinished(runCli(['create', 'web', '--frontend', 'react-ts'], cwd), 0);

      const app = path.join(cwd, 'web/apps/web');
      fs.writeFileSync(path.join(app, 'index.html'), '<!doctype html><title>hand edited</title>\n');
      fs.removeSync(path.join(app, 'nginx.conf'));
      const editedBefore = fs.readFileSync(path.join(app, 'index.html'), 'utf8');

      const dry = runCli(['create', 'web', '--frontend', 'react-ts', '--dry-run', '--json'], cwd);
      expectFinished(dry, 0);
      const data = json(dry).data;
      expect(data.targetExists).toBe(true);

      const byPath = Object.fromEntries(data.files.map((f: any) => [f.path, f]));
      expect(byPath['web/apps/web/nginx.conf']).toMatchObject({ status: 'added', action: 'create' });
      expect(byPath['web/apps/web/index.html']).toMatchObject({ status: 'modified', action: 'overwrite' });
      expect(byPath['web/apps/web/index.html'].diff).toContain('-<!doctype html><title>hand edited</title>');
      expect(byPath['web/apps/web/package.json']).toMatchObject({ status: 'unchanged' });
      expect(data.summary).toMatchObject({ added: 1, modified: 1 });
      expect(data.files.filter((f: any) => f.diff)).toHaveLength(1);

      // Nothing was touched by the dry run.
      expect(fs.readFileSync(path.join(app, 'index.html'), 'utf8')).toBe(editedBefore);
      expect(fs.existsSync(path.join(app, 'nginx.conf'))).toBe(false);
    });

    it('human dry run shows the diff of modified files', () => {
      const cwd = fresh();
      expectFinished(runCli(['create', 'web', '--frontend', 'react-ts'], cwd), 0);
      fs.writeFileSync(path.join(cwd, 'web/README.md'), '# edited\n');

      const dry = runCli(['create', 'web', '--frontend', 'react-ts', '--dry-run'], cwd);
      expectFinished(dry, 0);
      expect(dry.stdout).toContain('Dry Run Preview');
      expect(dry.stdout).toContain('--- a/web/README.md');
      expect(dry.stdout).toContain('1 modified');
    });
  });

  describe('generated services are visible to the workspace', () => {
    it('init writes services/* and `workspace health --json` sees a service from `generate backend`', () => {
      const cwd = fresh();
      expectFinished(runCli(['init', 'mono', '--yes', '--skip-install', '--no-git'], cwd), 0);
      const mono = path.join(cwd, 'mono');

      const workspaceYaml = fs.readFileSync(path.join(mono, 'pnpm-workspace.yaml'), 'utf8');
      expect(workspaceYaml).toContain('services/*');
      expect(fs.readJsonSync(path.join(mono, 'package.json')).workspaces).toContain('services/*');

      expectFinished(runCli(['generate', 'backend', 'api'], mono), 0);
      expect(fs.existsSync(path.join(mono, 'services/api/package.json'))).toBe(true);

      const health = runCli(['workspace', 'health', '--json'], mono);
      expectFinished(health, 0);
      const checks = json(health).data.checks as Array<{ name: string; message: string; details?: string[] }>;
      const workspaces = checks.find(c => c.name === 'Workspaces');
      expect(workspaces?.message).toBe('1 workspace(s) detected');
      expect(workspaces?.details).toEqual(['api (service)']);

      const list = runCli(['workspace', 'list', '--json'], mono);
      expectFinished(list, 0);
      expect(json(list).data.map((w: any) => `${w.name}:${w.type}`)).toEqual(['api:service']);
    });

    it('create (top-level) also lists services/* so a later generate backend is part of the workspace', () => {
      const cwd = fresh();
      expectFinished(runCli(['create', 'proj', '--frontend', 'react-ts'], cwd), 0);
      const proj = path.join(cwd, 'proj');
      expect(fs.readFileSync(path.join(proj, 'pnpm-workspace.yaml'), 'utf8')).toContain("'services/*'");

      expectFinished(runCli(['generate', 'backend', 'api'], proj), 0);
      const health = runCli(['workspace', 'health', '--json'], proj);
      expectFinished(health, 0);
      const checks = json(health).data.checks as Array<{ name: string; details?: string[] }>;
      expect(checks.find(c => c.name === 'Workspaces')?.details).toEqual(
        expect.arrayContaining(['api (service)'])
      );
    });
  });
});
