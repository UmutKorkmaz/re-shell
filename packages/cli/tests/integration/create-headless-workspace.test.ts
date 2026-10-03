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

describe('re-shell create with stdin closed (built CLI): workspace', () => {
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
