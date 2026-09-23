import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generateCICDConfig,
  generateDeployConfig,
  setupEnvironments,
} from '../../src/commands/cicd';
import { findMonorepoRoot } from '../../src/utils/monorepo';

const fsp = fs as typeof fs & {
  ensureDir: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
  writeJson: ReturnType<typeof vi.fn>;
};

// Covers src/commands/cicd.ts (1228 lines) — CI/CD pipeline config
// generation for github/gitlab/jenkins/circleci/azure, deployment config
// (scripts + Docker + environment configs) and multi-environment setup.
// Everything runs against a real staged monorepo in a temp dir; the only
// mock is console output.

vi.mock('fs-extra', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs-extra')>();
  // NOTE: the ESM namespace only enumerates ~34 fs-extra-specific names —
  // the node:fs re-exports (mkdtempSync, removeSync, writeJsonSync, ...)
  // live on `default`. Copy both shapes so every member stays callable.
  const mocked: Record<string, unknown> = {
    ...real.default,
    ...real,
  };
  return {
    ...mocked,
    ensureDir: vi.fn(real.ensureDir),
    writeFile: vi.fn(real.writeFile),
    writeJson: vi.fn(real.writeJson),
    chmod: vi.fn(real.chmod),
  };
});

vi.mock('../../src/utils/monorepo', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/monorepo')>();
  return {
    ...original,
    findMonorepoRoot: vi.fn(async (start: string) =>
      original.findMonorepoRoot(start)
    ),
  };
});

let tempRoot: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

/** Stage a minimal monorepo: root package.json + workspaces + pnpm yaml. */
function stageMonorepo(): void {
  fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
    name: 'test-mono',
    private: true,
    workspaces: ['packages/*'],
  });
  fs.ensureDirSync(path.join(tempRoot, 'packages', 'cli'));
  fs.writeJsonSync(path.join(tempRoot, 'packages', 'cli', 'package.json'), {
    name: '@test/cli',
    version: '0.0.1',
  });
  fs.writeFileSync(
    path.join(tempRoot, 'pnpm-workspace.yaml'),
    'packages:\n  - "packages/*"\n'
  );
}

describe('cicd — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-cicd-'));
    const cwdSpy = vi
      .spyOn(process, 'cwd')
      .mockReturnValue(tempRoot);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // keep the spy alive through afterEach
    (process as unknown as { __cwdSpy?: unknown }).__cwdSpy = cwdSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.removeSync(tempRoot);
  });

  describe('generateCICDConfig', () => {
    it('throws when not inside a monorepo', async () => {
      // cwd points at an empty temp dir — no workspaces anywhere up the tree
      await expect(generateCICDConfig()).rejects.toThrow(
        'Not in a Re-Shell monorepo'
      );
    });

    it('generates GitHub Actions workflows by default', async () => {
      stageMonorepo();
      const spinner = { text: '', succeed: vi.fn(), fail: vi.fn() };
      await generateCICDConfig({ spinner });
      const workflows = fs.readdirSync(
        path.join(tempRoot, '.github', 'workflows')
      );
      expect(workflows.length).toBeGreaterThan(0);
      const ci = fs.readFileSync(
        path.join(tempRoot, '.github', 'workflows', 'ci.yml'),
        'utf-8'
      );
      expect(ci).toContain('name: CI');
      expect(ci).toContain('re-shell doctor');
      expect(spinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('github')
      );
      expect(output()).toContain('Next Steps:');
    });

    it('generates GitLab CI configuration', async () => {
      stageMonorepo();
      await generateCICDConfig({ provider: 'gitlab' });
      const gitlab = fs.readFileSync(
        path.join(tempRoot, '.gitlab-ci.yml'),
        'utf-8'
      );
      expect(gitlab).toContain('stages:');
      expect(gitlab).toContain('pnpm');
      expect(output()).toContain('GitLab');
    });

    it('generates a Jenkinsfile', async () => {
      stageMonorepo();
      await generateCICDConfig({ provider: 'jenkins' });
      const jenkins = fs.readFileSync(
        path.join(tempRoot, 'Jenkinsfile'),
        'utf-8'
      );
      expect(jenkins).toContain('pipeline {');
      expect(jenkins).toContain("nodejs '20'");
    });

    it('generates CircleCI config under .circleci/', async () => {
      stageMonorepo();
      await generateCICDConfig({ provider: 'circleci' });
      const cfg = fs.readFileSync(
        path.join(tempRoot, '.circleci', 'config.yml'),
        'utf-8'
      );
      expect(cfg).toContain('version: 2.1');
      expect(cfg).toContain('cimg/node');
    });

    it('generates Azure Pipelines configuration', async () => {
      stageMonorepo();
      await generateCICDConfig({ provider: 'azure' });
      const azure = fs.readFileSync(
        path.join(tempRoot, 'azure-pipelines.yml'),
        'utf-8'
      );
      expect(azure).toContain('pool:');
      expect(azure).toContain("vmImage: 'ubuntu-latest'");
    });

    it('fails the spinner and rethrows on generation errors', async () => {
      stageMonorepo();
      const spinner = { text: '', succeed: vi.fn(), fail: vi.fn() };
      fsp.writeFile.mockRejectedValueOnce(new Error('disk full'));
      await expect(
        generateCICDConfig({ spinner, provider: 'gitlab' })
      ).rejects.toThrow('disk full');
      expect(spinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('CI/CD generation failed')
      );
    });
  });

  describe('generateDeployConfig', () => {
    it('throws when not inside a monorepo', async () => {
      await expect(generateDeployConfig('staging')).rejects.toThrow(
        'Not in a Re-Shell monorepo'
      );
    });

    it('writes deploy/rollback scripts, Docker files and env config', async () => {
      stageMonorepo();
      const spinner = { text: '', succeed: vi.fn(), fail: vi.fn() };
      await generateDeployConfig('staging', { spinner });

      // deploy scripts
      const deploy = fs.readFileSync(
        path.join(tempRoot, 'scripts', 'deploy', 'deploy.sh'),
        'utf-8'
      );
      expect(deploy).toContain('#!/bin/bash');
      expect(deploy).toContain('re-shell doctor');
      const rollback = fs.readFileSync(
        path.join(tempRoot, 'scripts', 'deploy', 'rollback.sh'),
        'utf-8'
      );
      expect(rollback).toContain('Rolling back');
      // executable bit set
      const mode = fs.statSync(
        path.join(tempRoot, 'scripts', 'deploy', 'deploy.sh')
      ).mode;
      expect(mode & 0o111).toBeTruthy();

      // docker files
      expect(
        fs.readFileSync(path.join(tempRoot, 'Dockerfile'), 'utf-8')
      ).toContain('FROM node:20-alpine');
      expect(
        fs.existsSync(path.join(tempRoot, 'docker-compose.yml'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(tempRoot, 'docker-compose.prod.yml'))
      ).toBe(true);

      // environment config
      const envCfg = fs.readJsonSync(
        path.join(tempRoot, 'config', 'environments', 'staging.json')
      );
      expect(envCfg.staging.api.url).toBe('https://api-staging.example.com');
      expect(envCfg.staging.database.ssl).toBe(false);
      expect(spinner.succeed).toHaveBeenCalled();
    });

    it('marks production configs with ssl and error-level logging', async () => {
      stageMonorepo();
      await generateDeployConfig('production');
      const envCfg = fs.readJsonSync(
        path.join(tempRoot, 'config', 'environments', 'production.json')
      );
      expect(envCfg.production.database.ssl).toBe(true);
      expect(envCfg.production.monitoring.level).toBe('error');
    });

    it('fails the spinner and rethrows on script write errors', async () => {
      stageMonorepo();
      const spinner = { text: '', succeed: vi.fn(), fail: vi.fn() };
      fsp.ensureDir.mockRejectedValueOnce(new Error('EACCES'));
      await expect(
        generateDeployConfig('staging', { spinner })
      ).rejects.toThrow('EACCES');
      expect(spinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Deployment configuration failed')
      );
    });
  });

  describe('setupEnvironments', () => {
    it('throws when not inside a monorepo', async () => {
      await expect(
        setupEnvironments([{ name: 'staging', secrets: [], variables: {} }])
      ).rejects.toThrow('Not in a Re-Shell monorepo');
    });

    it('writes config.json and an executable deploy script per environment', async () => {
      stageMonorepo();
      const spinner = { text: '', succeed: vi.fn(), fail: vi.fn() };
      await setupEnvironments(
        [
          {
            name: 'staging',
            url: 'https://staging.example.com',
            secrets: ['DEPLOY_TOKEN'],
            variables: { NODE_ENV: 'staging', REGION: 'eu' },
          },
          {
            name: 'production',
            secrets: ['DEPLOY_TOKEN', 'DB_PASSWORD'],
            variables: {},
          },
        ],
        { spinner, verbose: true }
      );

      const staging = fs.readJsonSync(
        path.join(tempRoot, 'environments', 'staging', 'config.json')
      );
      expect(staging.name).toBe('staging');
      expect(staging.url).toBe('https://staging.example.com');
      expect(staging.secrets).toEqual([
        { name: 'DEPLOY_TOKEN', required: true },
      ]);
      expect(staging.variables).toEqual({ NODE_ENV: 'staging', REGION: 'eu' });

      const deployScript = fs.readFileSync(
        path.join(tempRoot, 'environments', 'staging', 'deploy.sh'),
        'utf-8'
      );
      expect(deployScript).toContain('export NODE_ENV="staging"');
      expect(deployScript).toContain('export REGION="eu"');
      expect(
        fs.statSync(
          path.join(tempRoot, 'environments', 'staging', 'deploy.sh')
        ).mode & 0o111
      ).toBeTruthy();

      expect(
        fs.existsSync(
          path.join(tempRoot, 'environments', 'production', 'config.json')
        )
      ).toBe(true);
      expect(spinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining('2 environments configured')
      );
      expect(output()).toContain('Created environment configuration');
    });

    it('fails the spinner and rethrows on write errors', async () => {
      stageMonorepo();
      const spinner = { text: '', succeed: vi.fn(), fail: vi.fn() };
      fsp.writeJson.mockRejectedValueOnce(new Error('readonly'));
      await expect(
        setupEnvironments(
          [{ name: 'staging', secrets: [], variables: {} }],
          { spinner }
        )
      ).rejects.toThrow('readonly');
      expect(spinner.fail).toHaveBeenCalledWith(
        expect.stringContaining('Environment setup failed')
      );
    });
  });

  it('findMonorepoRoot resolves the staged root from cwd', async () => {
    stageMonorepo();
    expect(await findMonorepoRoot(process.cwd())).toBe(tempRoot);
  });
});
