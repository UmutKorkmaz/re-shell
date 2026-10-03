import { describe, it, expect } from 'vitest';
import {
  cloudDeployResponseSchema,
  debugConfigResponseSchema,
  errorCodeSchema,
  iacGenerateResponseSchema,
  iacValidateResponseSchema,
  jsonResponseSchema,
  pkgDependencySchema,
  pkgEcosystemSchema,
  pkgOutdatedSchema,
  pkgResponseSchema,
  refactorRenameServiceResponseSchema,
} from './index.js';

/** Contract tests for the R-1a schemas (pkg, debug config, refactor, cloud iac / deploy). */

const R1A_CODES = [
  'PKG_ERROR',
  'PKG_TOOLCHAIN_MISSING',
  'PKG_ECOSYSTEM_UNDETECTED',
  'PKG_ECOSYSTEM_AMBIGUOUS',
  'PKG_UNSUPPORTED_OPERATION',
  'PKG_INVALID_ARGS',
  'PKG_COMMAND_FAILED',
  'DEBUG_CONFIG_ERROR',
  'REFACTOR_ERROR',
  'REFACTOR_SERVICE_NOT_FOUND',
  'REFACTOR_INVALID_NAME',
  'REFACTOR_NAME_COLLISION',
  'REFACTOR_DIRTY_TREE',
  'IAC_ERROR',
  'IAC_VALIDATE_ERROR',
  'IAC_TERRAFORM_MISSING',
  'CLOUD_CREDENTIALS_MISSING',
  'CLOUD_DEPLOY_CONFIRMATION_REQUIRED',
  'CLOUD_DEPLOY_ERROR',
];

describe('R-1a error codes', () => {
  it('are all part of the closed error-code vocabulary, after the pre-existing codes', () => {
    const all = errorCodeSchema.options as string[];
    for (const code of R1A_CODES) expect(all, code).toContain(code);
    // one contiguous block, in the documented order (other workstreams append their own blocks after)
    const start = all.indexOf('PKG_ERROR');
    expect(all.slice(start, start + R1A_CODES.length)).toEqual(R1A_CODES);
    expect(all.indexOf('UI_TEST_ERROR')).toBeLessThan(all.indexOf('PKG_ERROR'));
  });

  it('are accepted by the error envelope', () => {
    const schema = jsonResponseSchema(pkgResponseSchema);
    for (const code of R1A_CODES) {
      expect(schema.safeParse({ ok: false, error: { code, message: 'x' }, warnings: [] }).success, code).toBe(true);
    }
    expect(schema.safeParse({ ok: false, error: { code: 'NOT_A_CODE', message: 'x' }, warnings: [] }).success).toBe(false);
  });
});

describe('pkg schemas', () => {
  it('ecosystem enum covers every supported package manager', () => {
    expect(pkgEcosystemSchema.options).toEqual([
      'npm', 'pnpm', 'yarn', 'bun', 'pip', 'poetry', 'uv', 'cargo', 'maven', 'gradle', 'dotnet', 'composer', 'bundler', 'go',
    ]);
  });

  it('parses dependency, outdated and full responses; rejects bad kinds', () => {
    expect(pkgDependencySchema.safeParse({ name: 'a', requested: null, kind: 'prod', ecosystem: 'npm', manifest: 'package.json' }).success).toBe(true);
    expect(pkgDependencySchema.safeParse({ name: 'a', requested: '1', kind: 'weird', ecosystem: 'npm', manifest: 'p' }).success).toBe(false);
    expect(pkgOutdatedSchema.safeParse({ name: 'a', current: '1', wanted: null, latest: '2', kind: null, ecosystem: 'go' }).success).toBe(true);
    const resp = {
      operation: 'add',
      ecosystem: 'pnpm',
      detectedBy: 'lockfile pnpm-lock.yaml',
      dir: '/x',
      service: null,
      dryRun: true,
      packages: ['zod'],
      dev: false,
      commands: [{ argv: ['pnpm', 'add', 'zod'], cwd: '/x', purpose: 'add packages', executed: false, exitCode: null, durationMs: null }],
      manifestEdits: [],
      dependencies: [],
      outdated: [],
    };
    expect(pkgResponseSchema.safeParse(resp).success).toBe(true);
    expect(pkgResponseSchema.safeParse({ ...resp, operation: 'upgrade' }).success).toBe(false);
  });
});

describe('debug / refactor / iac / deploy schemas', () => {
  it('debugConfigResponseSchema', () => {
    const data = {
      out: '/w/.vscode/launch.json',
      dryRun: false,
      written: true,
      services: [
        { name: 'api', language: 'typescript', debugKind: 'node', debugPort: 9229, portSource: 'allocated', configurations: ['re-shell: api (attach)'], inCompose: true, composeService: 'api', remoteRoot: '/app' },
        { name: 'ledger', language: 'csharp', debugKind: 'dotnet', debugPort: null, portSource: 'none', configurations: [], inCompose: false, composeService: null, remoteRoot: null },
      ],
      skipped: [{ name: 'z', language: 'elixir', reason: 'no adapter' }],
      compound: { name: 're-shell: all services', configurations: ['re-shell: api (attach)'] },
      launch: { created: true, added: [], updated: [], unchanged: [], preserved: 0, content: '{}' },
      compose: { path: '/w/docker-compose.debug.yml', written: true, services: ['api'], content: '' },
      notes: [],
      warnings: [],
    };
    expect(debugConfigResponseSchema.safeParse(data).success).toBe(true);
    expect(debugConfigResponseSchema.safeParse({ ...data, services: [{ ...data.services[0], debugKind: 'cobol' }] }).success).toBe(false);
    expect(debugConfigResponseSchema.safeParse({ ...data, compound: null, compose: null }).success).toBe(true);
  });

  it('refactorRenameServiceResponseSchema', () => {
    const data = {
      old: 'billing',
      new: 'payments',
      dryRun: true,
      applied: false,
      root: '/w',
      git: { inRepo: true, dirty: false, moved: 'none' },
      files: [{ from: 'a', to: 'b', kind: 'workspace', changedLines: 2 }],
      moves: [{ from: 'services/billing', to: 'services/payments', kind: 'directory' }],
      diff: 'diff --git a/a b/b\n',
      residualReferences: [{ path: 'README.md', line: 3, text: 'billing' }],
      warnings: [],
    };
    expect(refactorRenameServiceResponseSchema.safeParse(data).success).toBe(true);
    expect(refactorRenameServiceResponseSchema.safeParse({ ...data, git: { ...data.git, moved: 'copy' } }).success).toBe(false);
    expect(refactorRenameServiceResponseSchema.safeParse({ ...data, files: [{ ...data.files[0], kind: 'other' }] }).success).toBe(false);
  });

  it('iac generate / validate / deploy schemas', () => {
    const validation = {
      terraform: { found: true, path: '/usr/bin/terraform', version: '1.9.8' },
      steps: [
        { name: 'fmt', ran: true, ok: true, exitCode: 0, output: '' },
        { name: 'init', ran: true, ok: false, exitCode: 1, output: 'x', reason: 'providers' },
        { name: 'validate', ran: false, ok: null, exitCode: null, output: '' },
      ],
      validated: false,
      formatted: true,
      providersInstalled: false,
      summary: 's',
    };
    const gen = {
      provider: 'aws',
      target: 'ECS Fargate',
      outDir: '/o',
      dryRun: false,
      written: true,
      services: [{ name: 'api', port: 4000, exposed: true }],
      files: [{ path: 'main.tf', bytes: 10 }],
      variables: [{ name: 'region', type: 'string', description: 'r' }],
      validation,
      warnings: [],
    };
    expect(iacGenerateResponseSchema.safeParse(gen).success).toBe(true);
    expect(iacGenerateResponseSchema.safeParse({ ...gen, validation: null }).success).toBe(true);
    expect(iacGenerateResponseSchema.safeParse({ ...gen, provider: 'oracle' }).success).toBe(false);
    expect(iacValidateResponseSchema.safeParse({ dir: '/o', validation }).success).toBe(true);
    expect(iacValidateResponseSchema.safeParse({ dir: '/o', validation: { ...validation, steps: [{ name: 'lint', ran: true, ok: true, exitCode: 0, output: '' }] } }).success).toBe(false);

    const deploy = {
      provider: 'gcp',
      dir: '/o',
      dryRun: false,
      credentials: { checked: true, source: 'gcloud:me@example.com' },
      steps: [{ name: 'apply', argv: ['terraform', 'apply'], executed: true, exitCode: 0, durationMs: 5, output: '' }],
      applied: true,
      outputs: { url: 'https://x' },
    };
    expect(cloudDeployResponseSchema.safeParse(deploy).success).toBe(true);
    expect(cloudDeployResponseSchema.safeParse({ ...deploy, steps: [{ ...deploy.steps[0], name: 'destroy' }] }).success).toBe(false);
  });
});
