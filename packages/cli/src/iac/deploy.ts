// `re-shell cloud deploy`: terraform apply for generated IaC, gated on real
// cloud credentials and an explicit --yes. Never simulates a deployment.

import * as fs from 'fs';
import * as path from 'path';

import { checkCredentials } from './credentials';
import { IacError, parseProvider } from './generate';
import type { IacProvider } from './model';
import { findTerraform, runProcess, terraformEnv } from './terraform';

export interface DeployOptions {
  provider: string;
  /** Directory with the generated Terraform (default `<cwd>/infra/<provider>`). */
  dir?: string;
  cwd?: string;
  /** Extra terraform variables (`name=value`). */
  vars?: string[];
  /** `service=tag` pairs merged into the `image_tags` variable. */
  imageTags?: string[];
  /** Region (aws/gcp) or location (azure). */
  region?: string;
  /** Required to run `terraform apply`. */
  yes?: boolean;
  /** Print the commands without running anything. */
  dryRun?: boolean;
  env?: NodeJS.ProcessEnv;
  /** Test seam: terraform step runner. */
  run?: typeof runProcess;
}

export interface DeployStep {
  name: 'init' | 'plan' | 'apply' | 'output';
  argv: string[];
  executed: boolean;
  exitCode: number | null;
  durationMs: number | null;
  output: string;
}

export interface DeployResult {
  provider: IacProvider;
  dir: string;
  dryRun: boolean;
  credentials: { checked: boolean; source: string | null };
  steps: DeployStep[];
  applied: boolean;
  outputs: Record<string, unknown>;
}

const tail = (s: string, n = 6000): string => (s.length > n ? '…' + s.slice(-n) : s);
const SECRET_KEY = /(secret|password|token|key|credential)/i;

function redact(argv: string[]): string[] {
  return argv.map(a => {
    const m = /^(-var=)?([A-Za-z_][\w-]*)=(.*)$/s.exec(a);
    return m && SECRET_KEY.test(m[2]) ? `${m[1] ?? ''}${m[2]}=<redacted>` : a;
  });
}

const PROVIDER_SOURCE: Record<IacProvider, string> = {
  aws: 'hashicorp/aws',
  azure: 'hashicorp/azurerm',
  gcp: 'hashicorp/google',
};

/** Refuse to deploy a directory generated for a different cloud than `--provider`. */
function assertDirTargetsProvider(dir: string, provider: IacProvider): void {
  const text = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.tf'))
    .map(f => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  const present = (Object.keys(PROVIDER_SOURCE) as IacProvider[]).filter(p => text.includes(PROVIDER_SOURCE[p]));
  if (present.length > 0 && !present.includes(provider)) {
    throw new IacError('IAC_ERROR', `${dir} targets ${present.join('/')} but --provider is ${provider}`, { dir, found: present, provider });
  }
}

function buildVarArgs(provider: IacProvider, options: DeployOptions): string[] {
  const args: string[] = [];
  const tags: Record<string, string> = {};
  for (const t of options.imageTags ?? []) {
    const i = t.indexOf('=');
    if (i <= 0) throw new IacError('IAC_ERROR', `--image-tag expects service=tag, got "${t}"`);
    tags[t.slice(0, i)] = t.slice(i + 1);
  }
  if (Object.keys(tags).length > 0) args.push(`-var=image_tags=${JSON.stringify(tags)}`);
  if (options.region) args.push(`-var=${provider === 'azure' ? 'location' : 'region'}=${options.region}`);
  for (const v of options.vars ?? []) {
    if (!/^[A-Za-z_][\w-]*=/.test(v)) throw new IacError('IAC_ERROR', `--var expects name=value, got "${v}"`);
    args.push(`-var=${v}`);
  }
  return args;
}

/**
 * Deploy generated Terraform.
 *
 * Order of checks (each failure is explicit and happens before any cloud call):
 * 1. provider + directory, 2. cloud credentials (`CLOUD_CREDENTIALS_MISSING`),
 * 3. terraform binary (`IAC_TERRAFORM_MISSING`), then `init`; without `--yes` a
 * `plan` is shown and the run stops with `CLOUD_DEPLOY_CONFIRMATION_REQUIRED`;
 * with `--yes` it runs `terraform apply -auto-approve`.
 */
export async function deploy(options: DeployOptions): Promise<DeployResult> {
  const provider = parseProvider(options.provider);
  const cwd = options.cwd ?? process.cwd();
  const dir = path.resolve(cwd, options.dir ?? path.join('infra', provider));
  const env = options.env ?? process.env;
  const run = options.run ?? runProcess;

  if (!fs.existsSync(dir) || !fs.readdirSync(dir).some(f => f.endsWith('.tf'))) {
    throw new IacError('IAC_ERROR', `No Terraform files in ${dir}. Generate them first: re-shell cloud iac generate --provider ${provider} --out ${path.relative(cwd, dir) || '.'}`, { dir });
  }
  assertDirTargetsProvider(dir, provider);
  const varArgs = buildVarArgs(provider, options);

  const plannedSteps: Array<Pick<DeployStep, 'name' | 'argv'>> = [
    { name: 'init', argv: ['terraform', 'init', '-input=false', '-no-color'] },
    ...(options.yes
      ? [{ name: 'apply' as const, argv: ['terraform', 'apply', '-input=false', '-no-color', '-auto-approve', ...varArgs] }]
      : [{ name: 'plan' as const, argv: ['terraform', 'plan', '-input=false', '-no-color', ...varArgs] }]),
  ];

  if (options.dryRun) {
    return {
      provider,
      dir,
      dryRun: true,
      credentials: { checked: false, source: null },
      steps: plannedSteps.map(s => ({ ...s, argv: redact(s.argv), executed: false, exitCode: null, durationMs: null, output: '' })),
      applied: false,
      outputs: {},
    };
  }

  // 1. credentials: fail before any terraform/cloud call
  const creds = await checkCredentials(provider, env);
  if (!creds.ok) {
    throw new IacError('CLOUD_CREDENTIALS_MISSING', `No ${provider.toUpperCase()} credentials found. ${creds.hint}`, {
      provider,
      checked: creds.checked,
      hint: creds.hint,
    });
  }

  // 2. terraform
  const bin = findTerraform(env);
  if (!bin) {
    throw new IacError('IAC_TERRAFORM_MISSING', 'terraform was not found on PATH (set RESHELL_TERRAFORM_BIN or install terraform: https://developer.hashicorp.com/terraform/install)', { provider });
  }
  const tfEnv = terraformEnv({ ...env, ...creds.extraEnv });

  const steps: DeployStep[] = [];
  const exec = async (name: DeployStep['name'], args: string[], timeoutMs: number): Promise<{ code: number | null; out: string }> => {
    const r = await run(bin, args, { cwd: dir, env: tfEnv, timeoutMs });
    const out = (r.stdout + r.stderr).trim();
    steps.push({ name, argv: redact(['terraform', ...args]), executed: true, exitCode: r.code, durationMs: r.durationMs, output: tail(out) });
    if (r.code !== 0) {
      throw new IacError('CLOUD_DEPLOY_ERROR', `terraform ${args[0]} failed${r.timedOut ? ' (timed out)' : ''} with exit code ${r.code}`, {
        step: name,
        exitCode: r.code,
        output: tail(out),
        steps,
      });
    }
    return { code: r.code, out };
  };

  await exec('init', ['init', '-input=false', '-no-color'], 15 * 60_000);

  if (!options.yes) {
    const plan = await exec('plan', ['plan', '-input=false', '-no-color', ...varArgs], 30 * 60_000);
    throw new IacError(
      'CLOUD_DEPLOY_CONFIRMATION_REQUIRED',
      `Plan complete; nothing was applied. Re-run with --yes to run terraform apply (credentials: ${creds.source}).`,
      { provider, dir, plan: tail(plan.out), steps }
    );
  }

  await exec('apply', ['apply', '-input=false', '-no-color', '-auto-approve', ...varArgs], 90 * 60_000);

  let outputs: Record<string, unknown> = {};
  const out = await run(bin, ['output', '-json', '-no-color'], { cwd: dir, env: tfEnv, timeoutMs: 120_000 });
  steps.push({ name: 'output', argv: ['terraform', 'output', '-json', '-no-color'], executed: true, exitCode: out.code, durationMs: out.durationMs, output: '' });
  if (out.code === 0) {
    try {
      const parsed = JSON.parse(out.stdout) as Record<string, { value: unknown; sensitive?: boolean }>;
      outputs = Object.fromEntries(Object.entries(parsed).filter(([, v]) => !v.sensitive).map(([k, v]) => [k, v.value]));
    } catch {
      /* outputs are informational */
    }
  }

  return {
    provider,
    dir,
    dryRun: false,
    credentials: { checked: true, source: creds.source ?? null },
    steps,
    applied: true,
    outputs,
  };
}
