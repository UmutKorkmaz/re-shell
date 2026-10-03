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

describe('re-shell create with stdin closed (built CLI): failures', () => {
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

});
