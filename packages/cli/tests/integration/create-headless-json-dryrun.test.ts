import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import {
  createDryRunResponseSchema,
  createResponseSchema,
  jsonResponseSchema,
} from '@re-shell/contracts';
import { cliPath, expectFinished, json, runCli } from './helpers-create-cli';

describe('re-shell create with stdin closed (built CLI): json-dryrun', () => {
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

});
