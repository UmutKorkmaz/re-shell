import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { checkCredentials, parseIni } from '../../src/iac/credentials';
import { deploy } from '../../src/iac/deploy';
import { IacError, generateIac } from '../../src/iac/generate';
import type { RunResult } from '../../src/iac/terraform';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'polyglot-workspace');
const tmpDirs: string[] = [];

function tmp(prefix = 'rs-iac-dep-'): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

/** Executable shell stub placed on a private PATH. */
function stubBin(dir: string, name: string, body: string): void {
  const f = path.join(dir, name);
  fs.writeFileSync(f, `#!/bin/sh\n${body}\n`);
  fs.chmodSync(f, 0o755);
}

/** An environment containing no cloud credentials at all. */
function cleanEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const home = tmp('rs-home-');
  const bin = tmp('rs-bin-');
  return { PATH: bin, HOME: home, ...extra };
}

describe('parseIni', () => {
  it('parses sections, comments and quoted-free values', () => {
    expect(parseIni('# c\n[default]\naws_access_key_id = AKIA\n\n[profile dev]\nsso_session=x\n; no\n')).toEqual({
      default: { aws_access_key_id: 'AKIA' },
      'profile dev': { sso_session: 'x' },
    });
  });
});

describe('credential detection', () => {
  describe('aws', () => {
    it('is missing in an empty environment and says what it checked', async () => {
      const c = await checkCredentials('aws', cleanEnv());
      expect(c.ok).toBe(false);
      expect(c.checked.join('\n')).toMatch(/AWS_ACCESS_KEY_ID/);
      expect(c.checked.join('\n')).toMatch(/profile "default"/);
      expect(c.hint).toMatch(/AWS_PROFILE/);
    });

    it('finds env keys (needs both halves)', async () => {
      expect((await checkCredentials('aws', cleanEnv({ AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' }))).source).toBe('env:AWS_ACCESS_KEY_ID');
      expect((await checkCredentials('aws', cleanEnv({ AWS_ACCESS_KEY_ID: 'a' }))).ok).toBe(false);
    });

    it('finds a static profile in the shared credentials file', async () => {
      const env = cleanEnv({ AWS_PROFILE: 'work' });
      const f = path.join(env.HOME!, 'creds');
      fs.writeFileSync(f, '[work]\naws_access_key_id = A\naws_secret_access_key = B\n');
      env.AWS_SHARED_CREDENTIALS_FILE = f;
      const c = await checkCredentials('aws', env);
      expect(c).toMatchObject({ ok: true, source: 'profile:work' });
      env.AWS_PROFILE = 'other';
      expect((await checkCredentials('aws', env)).ok).toBe(false);
    });

    it('finds sso / role / process profiles in the config file', async () => {
      const env = cleanEnv({ AWS_PROFILE: 'corp' });
      fs.mkdirSync(path.join(env.HOME!, '.aws'));
      fs.writeFileSync(path.join(env.HOME!, '.aws', 'config'), '[profile corp]\nsso_session = s\nsso_account_id = 1\n');
      expect(await checkCredentials('aws', env)).toMatchObject({ ok: true, source: 'profile:corp' });
    });

    it('finds web-identity and container credentials', async () => {
      expect((await checkCredentials('aws', cleanEnv({ AWS_WEB_IDENTITY_TOKEN_FILE: '/t', AWS_ROLE_ARN: 'arn' }))).source).toBe('env:web-identity');
      expect((await checkCredentials('aws', cleanEnv({ AWS_CONTAINER_CREDENTIALS_RELATIVE_URI: '/x' }))).source).toBe('env:container-credentials');
    });
  });

  describe('azure', () => {
    it('is missing without service-principal env or a logged-in az CLI', async () => {
      const c = await checkCredentials('azure', cleanEnv());
      expect(c.ok).toBe(false);
      expect(c.checked).toContain('az CLI not installed');
    });

    it('accepts a complete service principal and managed identity from env', async () => {
      expect((await checkCredentials('azure', cleanEnv({ ARM_CLIENT_ID: 'c', ARM_TENANT_ID: 't', ARM_SUBSCRIPTION_ID: 's', ARM_CLIENT_SECRET: 'x' }))).source).toBe('env:service-principal');
      expect((await checkCredentials('azure', cleanEnv({ ARM_CLIENT_ID: 'c', ARM_TENANT_ID: 't', ARM_SUBSCRIPTION_ID: 's' }))).ok).toBe(false);
      expect((await checkCredentials('azure', cleanEnv({ ARM_USE_MSI: 'true', ARM_SUBSCRIPTION_ID: 's' }))).source).toBe('env:managed-identity');
    });

    it('uses `az account show` for an Azure CLI login', async () => {
      const env = cleanEnv();
      stubBin(env.PATH!, 'az', 'echo \'{"name":"sub","user":{"name":"me@example.com"}}\'');
      expect(await checkCredentials('azure', env)).toMatchObject({ ok: true, source: 'azure-cli:me@example.com' });
      stubBin(env.PATH!, 'az', 'echo "Please run az login" >&2; exit 1');
      expect((await checkCredentials('azure', env)).ok).toBe(false);
    });
  });

  describe('gcp', () => {
    it('is missing without any credential source', async () => {
      const c = await checkCredentials('gcp', cleanEnv());
      expect(c.ok).toBe(false);
      expect(c.checked).toContain('gcloud CLI not installed');
    });

    it('accepts GOOGLE_APPLICATION_CREDENTIALS only when the file exists', async () => {
      const env = cleanEnv();
      const key = path.join(env.HOME!, 'key.json');
      env.GOOGLE_APPLICATION_CREDENTIALS = key;
      expect((await checkCredentials('gcp', env)).ok).toBe(false);
      fs.writeFileSync(key, '{}');
      expect((await checkCredentials('gcp', env)).source).toBe('env:GOOGLE_APPLICATION_CREDENTIALS');
    });

    it('accepts GOOGLE_CREDENTIALS, an access token and the application-default credentials file', async () => {
      expect((await checkCredentials('gcp', cleanEnv({ GOOGLE_CREDENTIALS: '{}' }))).source).toBe('env:GOOGLE_CREDENTIALS');
      expect((await checkCredentials('gcp', cleanEnv({ GOOGLE_OAUTH_ACCESS_TOKEN: 't' }))).source).toBe('env:GOOGLE_OAUTH_ACCESS_TOKEN');
      const env = cleanEnv();
      fs.mkdirSync(path.join(env.HOME!, '.config', 'gcloud'), { recursive: true });
      fs.writeFileSync(path.join(env.HOME!, '.config', 'gcloud', 'application_default_credentials.json'), '{}');
      expect((await checkCredentials('gcp', env)).source).toBe('application-default-credentials');
    });

    it('derives an access token from an active gcloud account', async () => {
      const env = cleanEnv();
      stubBin(
        env.PATH!,
        'gcloud',
        'case "$1" in auth) case "$2" in list) echo me@example.com;; print-access-token) echo ya29.token;; esac;; esac'
      );
      const c = await checkCredentials('gcp', env);
      expect(c).toMatchObject({ ok: true, source: 'gcloud:me@example.com', extraEnv: { GOOGLE_OAUTH_ACCESS_TOKEN: 'ya29.token' } });
    });

    it('a listed gcloud account whose token cannot be minted is treated as missing', async () => {
      const env = cleanEnv();
      stubBin(env.PATH!, 'gcloud', 'case "$2" in list) echo me@example.com;; *) exit 1;; esac');
      const c = await checkCredentials('gcp', env);
      expect(c.ok).toBe(false);
      expect(c.checked.join('\n')).toMatch(/print-access-token. failed/);
    });

    it('gcloud with no active account is missing', async () => {
      const env = cleanEnv();
      stubBin(env.PATH!, 'gcloud', 'exit 0');
      expect((await checkCredentials('gcp', env)).ok).toBe(false);
    });
  });
});

describe('deploy gating', () => {
  let workspace: string;
  let iacDir: string;
  beforeEach(() => {
    workspace = tmp('rs-iac-ws-');
    fs.cpSync(FIXTURE, workspace, { recursive: true });
    iacDir = path.join(workspace, 'infra', 'aws');
    generateIac({ cwd: workspace, provider: 'aws', out: iacDir });
  });

  /** Records every terraform invocation; succeeds with canned output. */
  function recorder(failOn?: string) {
    const calls: string[][] = [];
    const run = async (_file: string, args: string[]): Promise<RunResult> => {
      calls.push(args);
      if (failOn && args[0] === failOn) return { code: 1, stdout: '', stderr: `boom in ${failOn}`, timedOut: false, durationMs: 1 };
      const stdout = args[0] === 'output' ? JSON.stringify({ alb_dns_name: { value: 'x.elb.amazonaws.com' }, secret: { value: 's', sensitive: true } }) : `${args[0]} ok`;
      return { code: 0, stdout, stderr: '', timedOut: false, durationMs: 5 };
    };
    return { calls, run };
  }

  function awsEnv(): NodeJS.ProcessEnv {
    const env = cleanEnv({ AWS_ACCESS_KEY_ID: 'AKIATEST', AWS_SECRET_ACCESS_KEY: 'secret' });
    stubBin(env.PATH!, 'terraform', 'exit 0');
    return env;
  }

  it('fails with CLOUD_CREDENTIALS_MISSING before any terraform call when credentials are absent', async () => {
    const { calls, run } = recorder();
    const env = cleanEnv();
    stubBin(env.PATH!, 'terraform', 'exit 0');
    await expect(deploy({ provider: 'aws', dir: iacDir, yes: true, env, run })).rejects.toMatchObject({
      code: 'CLOUD_CREDENTIALS_MISSING',
      details: { provider: 'aws', hint: expect.stringContaining('AWS_PROFILE') },
    });
    expect(calls).toEqual([]);
  });

  it('fails with IAC_TERRAFORM_MISSING when credentials exist but terraform does not', async () => {
    const { calls, run } = recorder();
    const env = cleanEnv({ AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' });
    await expect(deploy({ provider: 'aws', dir: iacDir, yes: true, env, run })).rejects.toMatchObject({ code: 'IAC_TERRAFORM_MISSING' });
    expect(calls).toEqual([]);
  });

  it('without --yes: init + plan run, apply never does, and the run stops with CLOUD_DEPLOY_CONFIRMATION_REQUIRED', async () => {
    const { calls, run } = recorder();
    try {
      await deploy({ provider: 'aws', dir: iacDir, env: awsEnv(), run });
      expect.unreachable('should have required confirmation');
    } catch (err) {
      expect(err).toBeInstanceOf(IacError);
      expect((err as IacError).code).toBe('CLOUD_DEPLOY_CONFIRMATION_REQUIRED');
      expect((err as IacError).details?.plan).toContain('plan ok');
      expect((err as IacError).message).toMatch(/Re-run with --yes/);
    }
    expect(calls.map(c => c[0])).toEqual(['init', 'plan']);
  });

  it('with --yes: init, apply -auto-approve, then outputs (sensitive outputs omitted)', async () => {
    const { calls, run } = recorder();
    const res = await deploy({ provider: 'aws', dir: iacDir, yes: true, env: awsEnv(), run, region: 'eu-west-1', imageTags: ['api=1.2.3', 'web=2'], vars: ['environment=prod'] });
    expect(calls.map(c => c[0])).toEqual(['init', 'apply', 'output']);
    const apply = calls[1];
    expect(apply).toContain('-auto-approve');
    expect(apply).toContain('-var=region=eu-west-1');
    expect(apply).toContain('-var=image_tags={"api":"1.2.3","web":"2"}');
    expect(apply).toContain('-var=environment=prod');
    expect(res).toMatchObject({ applied: true, dryRun: false, credentials: { checked: true, source: 'env:AWS_ACCESS_KEY_ID' } });
    expect(res.outputs).toEqual({ alb_dns_name: 'x.elb.amazonaws.com' });
    expect(res.steps.map(s => s.name)).toEqual(['init', 'apply', 'output']);
  });

  it('azure uses the `location` variable for --region', async () => {
    const { calls, run } = recorder();
    generateIac({ cwd: workspace, provider: 'azure', out: path.join(workspace, 'infra', 'azure') });
    const env = cleanEnv({ ARM_CLIENT_ID: 'c', ARM_TENANT_ID: 't', ARM_SUBSCRIPTION_ID: 's', ARM_CLIENT_SECRET: 'x' });
    stubBin(env.PATH!, 'terraform', 'exit 0');
    await deploy({ provider: 'azure', dir: path.join(workspace, 'infra', 'azure'), yes: true, env, run, region: 'northeurope' });
    expect(calls[1]).toContain('-var=location=northeurope');
  });

  it('the gcloud-derived access token reaches terraform without being recorded in the result', async () => {
    generateIac({ cwd: workspace, provider: 'gcp', out: path.join(workspace, 'infra', 'gcp') });
    const env = cleanEnv();
    stubBin(env.PATH!, 'terraform', 'exit 0');
    stubBin(env.PATH!, 'gcloud', 'case "$2" in list) echo me@example.com;; print-access-token) echo ya29.secret;; esac');
    const seenEnv: Array<string | undefined> = [];
    const run = async (_f: string, args: string[], opts?: { env?: NodeJS.ProcessEnv }): Promise<RunResult> => {
      seenEnv.push(opts?.env?.GOOGLE_OAUTH_ACCESS_TOKEN);
      return { code: 0, stdout: args[0] === 'output' ? '{}' : 'ok', stderr: '', timedOut: false, durationMs: 1 };
    };
    const res = await deploy({ provider: 'gcp', dir: path.join(workspace, 'infra', 'gcp'), yes: true, env, run, vars: ['project_id=p'] });
    expect(seenEnv.every(t => t === 'ya29.secret')).toBe(true);
    expect(JSON.stringify(res)).not.toContain('ya29.secret');
  });

  it('a failing init/apply is CLOUD_DEPLOY_ERROR carrying terraform output, never a success', async () => {
    for (const failOn of ['init', 'apply']) {
      const { calls, run } = recorder(failOn);
      await expect(deploy({ provider: 'aws', dir: iacDir, yes: true, env: awsEnv(), run })).rejects.toMatchObject({
        code: 'CLOUD_DEPLOY_ERROR',
        details: { step: failOn, exitCode: 1, output: `boom in ${failOn}` },
      });
      expect(calls.map(c => c[0])).not.toContain('output');
    }
  });

  it('--dry-run lists the commands (secrets redacted) and neither checks credentials nor runs terraform', async () => {
    const { calls, run } = recorder();
    const res = await deploy({ provider: 'aws', dir: iacDir, yes: true, dryRun: true, env: cleanEnv(), run, vars: ['db_password=hunter2', 'environment=prod'] });
    expect(calls).toEqual([]);
    expect(res).toMatchObject({ dryRun: true, applied: false, credentials: { checked: false, source: null } });
    expect(res.steps.map(s => s.name)).toEqual(['init', 'apply']);
    expect(res.steps.every(s => !s.executed)).toBe(true);
    const apply = res.steps[1].argv;
    expect(apply).toContain('-var=db_password=<redacted>');
    expect(apply).toContain('-var=environment=prod');
    expect(JSON.stringify(res)).not.toContain('hunter2');
  });

  it('rejects a directory without terraform files, a provider mismatch, and malformed variables', async () => {
    const { run } = recorder();
    const empty = tmp();
    await expect(deploy({ provider: 'aws', dir: empty, env: awsEnv(), run })).rejects.toMatchObject({ code: 'IAC_ERROR', message: expect.stringContaining('No Terraform files') });
    await expect(deploy({ provider: 'gcp', dir: iacDir, env: awsEnv(), run })).rejects.toMatchObject({ code: 'IAC_ERROR', message: expect.stringContaining('targets aws but --provider is gcp') });
    await expect(deploy({ provider: 'aws', dir: iacDir, env: awsEnv(), run, vars: ['novalue'] })).rejects.toMatchObject({ code: 'IAC_ERROR' });
    await expect(deploy({ provider: 'aws', dir: iacDir, env: awsEnv(), run, imageTags: ['bad'] })).rejects.toMatchObject({ code: 'IAC_ERROR' });
    await expect(deploy({ provider: 'oracle', dir: iacDir, env: awsEnv(), run })).rejects.toMatchObject({ code: 'IAC_ERROR' });
  });
});
