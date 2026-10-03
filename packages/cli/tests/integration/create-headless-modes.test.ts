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

describe('re-shell create with stdin closed (built CLI): modes', () => {
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

});
