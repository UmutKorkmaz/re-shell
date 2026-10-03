// Cloud credential discovery for `cloud deploy`. Nothing here contacts a cloud
// API: it inspects environment variables, credential files and the logged-in
// state of the provider CLIs (az, gcloud), and reports exactly what it checked.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { findExecutable } from '../pkg/exec';
import { runProcess } from './terraform';
import type { IacProvider } from './model';

export interface CredentialCheck {
  provider: IacProvider;
  ok: boolean;
  /** Where credentials were found (never the secret itself). */
  source?: string;
  /** Everything that was inspected, for the error message when nothing is found. */
  checked: string[];
  /** How to fix it when credentials are missing. */
  hint: string;
  /** Extra environment to pass to terraform (e.g. an access token derived from gcloud). */
  extraEnv: Record<string, string>;
}

const HINTS: Record<IacProvider, string> = {
  aws: 'Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, or configure a profile (`aws configure`, `aws configure sso`) and set AWS_PROFILE.',
  azure: 'Run `az login` (and `az account set --subscription <id>`), or set ARM_CLIENT_ID, ARM_CLIENT_SECRET, ARM_TENANT_ID and ARM_SUBSCRIPTION_ID.',
  gcp: 'Run `gcloud auth application-default login` or `gcloud auth login`, or set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file.',
};

function homeDir(env: NodeJS.ProcessEnv): string {
  return env.HOME ?? env.USERPROFILE ?? os.homedir();
}

/** Parse a minimal INI file into section -> key -> value. */
export function parseIni(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const s = /^\[(.+)\]$/.exec(line);
    if (s) {
      section = s[1].trim();
      out[section] = out[section] ?? {};
      continue;
    }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (kv && section) out[section][kv[1].trim()] = kv[2].trim();
  }
  return out;
}

function readFile(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function checkAws(env: NodeJS.ProcessEnv): CredentialCheck {
  const checked: string[] = [];
  const done = (source?: string): CredentialCheck => ({ provider: 'aws', ok: Boolean(source), source, checked, hint: HINTS.aws, extraEnv: {} });

  checked.push('env AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY');
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) return done('env:AWS_ACCESS_KEY_ID');
  checked.push('env AWS_WEB_IDENTITY_TOKEN_FILE + AWS_ROLE_ARN');
  if (env.AWS_WEB_IDENTITY_TOKEN_FILE && env.AWS_ROLE_ARN) return done('env:web-identity');
  checked.push('env AWS_CONTAINER_CREDENTIALS_RELATIVE_URI/FULL_URI');
  if (env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || env.AWS_CONTAINER_CREDENTIALS_FULL_URI) return done('env:container-credentials');

  const profile = env.AWS_PROFILE || env.AWS_DEFAULT_PROFILE || 'default';
  const credFile = env.AWS_SHARED_CREDENTIALS_FILE || path.join(homeDir(env), '.aws', 'credentials');
  const configFile = env.AWS_CONFIG_FILE || path.join(homeDir(env), '.aws', 'config');
  checked.push(`profile "${profile}" in ${credFile}`);
  const cred = readFile(credFile);
  if (cred) {
    const sec = parseIni(cred)[profile];
    if (sec?.aws_access_key_id && sec.aws_secret_access_key) return done(`profile:${profile}`);
  }
  checked.push(`profile "${profile}" in ${configFile}`);
  const conf = readFile(configFile);
  if (conf) {
    const ini = parseIni(conf);
    const sec = ini[profile === 'default' ? 'default' : `profile ${profile}`];
    if (
      sec &&
      (sec.aws_access_key_id || sec.sso_session || sec.sso_start_url || sec.role_arn || sec.credential_process || sec.web_identity_token_file)
    ) {
      return done(`profile:${profile}`);
    }
  }
  return done();
}

async function checkAzure(env: NodeJS.ProcessEnv): Promise<CredentialCheck> {
  const checked: string[] = [];
  const result = (source?: string): CredentialCheck => ({ provider: 'azure', ok: Boolean(source), source, checked, hint: HINTS.azure, extraEnv: {} });

  checked.push('env ARM_CLIENT_ID + ARM_TENANT_ID + ARM_SUBSCRIPTION_ID + (ARM_CLIENT_SECRET | ARM_CLIENT_CERTIFICATE_PATH | ARM_USE_OIDC)');
  if (env.ARM_CLIENT_ID && env.ARM_TENANT_ID && env.ARM_SUBSCRIPTION_ID && (env.ARM_CLIENT_SECRET || env.ARM_CLIENT_CERTIFICATE_PATH || env.ARM_USE_OIDC === 'true')) {
    return result('env:service-principal');
  }
  checked.push('env ARM_USE_MSI + ARM_SUBSCRIPTION_ID');
  if (env.ARM_USE_MSI === 'true' && env.ARM_SUBSCRIPTION_ID) return result('env:managed-identity');

  checked.push('Azure CLI login (`az account show`)');
  const az = findExecutable('az', env);
  if (!az) {
    checked.push('az CLI not installed');
    return result();
  }
  const r = await runProcess(az, ['account', 'show', '--output', 'json'], { env, timeoutMs: 60_000 });
  if (r.code === 0) {
    try {
      const acct = JSON.parse(r.stdout) as { user?: { name?: string }; name?: string };
      return result(`azure-cli:${acct.user?.name ?? acct.name ?? 'logged-in'}`);
    } catch {
      return result('azure-cli');
    }
  }
  return result();
}

async function checkGcp(env: NodeJS.ProcessEnv): Promise<CredentialCheck> {
  const checked: string[] = [];
  const result = (source?: string, extraEnv: Record<string, string> = {}): CredentialCheck => ({
    provider: 'gcp',
    ok: Boolean(source),
    source,
    checked,
    hint: HINTS.gcp,
    extraEnv,
  });

  checked.push('env GOOGLE_APPLICATION_CREDENTIALS (file must exist)');
  if (env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(env.GOOGLE_APPLICATION_CREDENTIALS)) return result('env:GOOGLE_APPLICATION_CREDENTIALS');
  checked.push('env GOOGLE_CREDENTIALS / GOOGLE_OAUTH_ACCESS_TOKEN');
  if (env.GOOGLE_CREDENTIALS) return result('env:GOOGLE_CREDENTIALS');
  if (env.GOOGLE_OAUTH_ACCESS_TOKEN) return result('env:GOOGLE_OAUTH_ACCESS_TOKEN');

  const cfg = env.CLOUDSDK_CONFIG || (process.platform === 'win32' && env.APPDATA ? path.join(env.APPDATA, 'gcloud') : path.join(homeDir(env), '.config', 'gcloud'));
  const adc = path.join(cfg, 'application_default_credentials.json');
  checked.push(`application default credentials file ${adc}`);
  if (fs.existsSync(adc)) return result('application-default-credentials');

  checked.push('gcloud active account (`gcloud auth list`)');
  const gcloud = findExecutable('gcloud', env);
  if (!gcloud) {
    checked.push('gcloud CLI not installed');
    return result();
  }
  const list = await runProcess(gcloud, ['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'], { env, timeoutMs: 60_000 });
  const account = list.stdout.trim().split(/\r?\n/)[0];
  if (list.code !== 0 || !account) return result();
  const token = await runProcess(gcloud, ['auth', 'print-access-token'], { env, timeoutMs: 60_000 });
  if (token.code !== 0 || !token.stdout.trim()) {
    checked.push(`gcloud account ${account} is listed but \`gcloud auth print-access-token\` failed`);
    return result();
  }
  return result(`gcloud:${account}`, { GOOGLE_OAUTH_ACCESS_TOKEN: token.stdout.trim() });
}

/** Check whether usable credentials exist for `provider`. */
export async function checkCredentials(provider: IacProvider, env: NodeJS.ProcessEnv = process.env): Promise<CredentialCheck> {
  if (provider === 'aws') return checkAws(env);
  if (provider === 'azure') return checkAzure(env);
  return checkGcp(env);
}
