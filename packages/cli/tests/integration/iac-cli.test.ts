import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  cloudDeployResponseSchema,
  iacGenerateResponseSchema,
  iacValidateResponseSchema,
  jsonResponseSchema,
} from '@re-shell/contracts';

/**
 * Drives the BUILT CLI for `cloud iac generate|validate` and `cloud deploy`.
 *
 * Terraform-backed tests use the REAL terraform binary (`terraform init
 * -backend=false` + `validate`). They skip only when terraform is not installed
 * or its providers cannot be installed in this environment; the CI workflow
 * .github/workflows/iac-validate.yml runs the same checks with
 * hashicorp/setup-terraform and a real registry.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const FIXTURE = path.resolve(process.cwd(), 'tests/fixtures/polyglot-workspace');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-iac-int-'));
const PROVIDERS = ['aws', 'azure', 'gcp'] as const;

interface Run {
  status: number;
  stdout: string;
  stderr: string;
  json: any;
}

function run(args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env): Run {
  const res = spawnSync(process.execPath, [CLI_PATH, ...args], { cwd, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000 });
  let json: any;
  if (args.includes('--json')) {
    const lines = res.stdout.split('\n').filter(l => l.length > 0);
    expect(lines.length, `expected a single JSON line, got:\n${res.stdout}\n${res.stderr}`).toBe(1);
    json = JSON.parse(lines[0]);
  }
  return { status: res.status ?? 1, stdout: res.stdout, stderr: res.stderr, json };
}

function workspace(): string {
  const dir = fs.mkdtempSync(path.join(SCRATCH, 'ws-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

/** Process env without any cloud credentials or terraform on PATH. */
function bareEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const bin = fs.mkdtempSync(path.join(SCRATCH, 'bin-'));
  const home = fs.mkdtempSync(path.join(SCRATCH, 'home-'));
  return { PATH: bin, HOME: home, ...extra };
}

const terraformFound = spawnSync('terraform', ['version'], { encoding: 'utf8' }).status === 0;
const validated: Record<string, Run> = {};
const outDirs: Record<string, string> = {};
let providersInstallable = false;
let ws: string;

beforeAll(() => {
  expect(fs.existsSync(CLI_PATH), 'dist/index.js must be built').toBe(true);
  ws = workspace();
  if (!terraformFound) return;
  for (const p of PROVIDERS) {
    outDirs[p] = path.join(ws, 'infra', p);
    validated[p] = run(['cloud', 'iac', 'generate', '--provider', p, '--out', outDirs[p], '--validate', '--json'], ws);
  }
  // Providers are installable when every `init` got far enough to run validate.
  providersInstallable = PROVIDERS.every(p => validated[p].json?.ok === true || validated[p].json?.error?.details?.validation?.providersInstalled === true);
});
afterAll(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

describe('cloud iac generate (built CLI, no terraform needed)', () => {
  for (const provider of PROVIDERS) {
    it(`${provider}: --dry-run --json returns schema-valid files + variables and writes nothing`, () => {
      const dir = workspace();
      const r = run(['cloud', 'iac', 'generate', '--provider', provider, '--dry-run', '--json'], dir);
      expect(r.status, r.stdout).toBe(0);
      expect(jsonResponseSchema(iacGenerateResponseSchema).safeParse(r.json).success).toBe(true);
      expect(r.json.data.provider).toBe(provider);
      expect(r.json.data.written).toBe(false);
      expect(r.json.data.files.find((f: any) => f.path === 'main.tf').content).toContain('resource');
      const vars = r.json.data.variables.map((v: any) => v.name);
      expect(vars).toEqual(expect.arrayContaining(['image_tags', 'default_image_tag', provider === 'azure' ? 'location' : 'region']));
      expect(fs.existsSync(path.join(dir, 'infra'))).toBe(false);
    });
  }

  it('writes the files for --out and honours --services', () => {
    const dir = workspace();
    const r = run(['cloud', 'iac', 'generate', '--provider', 'aws', '--services', 'api,billing', '--out', 'tf', '--json'], dir);
    expect(r.status).toBe(0);
    expect(r.json.data.services.map((s: any) => s.name)).toEqual(['api', 'billing']);
    const main = fs.readFileSync(path.join(dir, 'tf', 'main.tf'), 'utf8');
    expect(main).toContain('aws_ecs_service" "api"');
    expect(main).not.toContain('aws_ecs_service" "web"');
  });

  it('IAC_ERROR for unknown provider/service and a missing --out; WORKSPACE_NOT_FOUND outside a workspace', () => {
    const dir = workspace();
    expect(run(['cloud', 'iac', 'generate', '--provider', 'oracle', '--out', 'x', '--json'], dir).json.error.code).toBe('IAC_ERROR');
    expect(run(['cloud', 'iac', 'generate', '--provider', 'aws', '--services', 'nope', '--out', 'x', '--json'], dir).json.error.code).toBe('IAC_ERROR');
    const noOut = run(['cloud', 'iac', 'generate', '--provider', 'aws', '--json'], dir);
    expect(noOut.status).toBe(1);
    expect(noOut.json.error.message).toContain('--out');
    const empty = fs.mkdtempSync(path.join(SCRATCH, 'empty-'));
    expect(run(['cloud', 'iac', 'generate', '--provider', 'aws', '--out', 'x', '--json'], empty).json.error.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('the legacy `cloud iac <name>` scaffold still works (default subcommand)', () => {
    const dir = workspace();
    const out = path.join(dir, 'legacy');
    const r = run(['cloud', 'iac', 'legacy-proj', '-o', out], dir);
    expect(r.status, r.stderr).toBe(0);
    expect(fs.existsSync(path.join(out, 'main.tf'))).toBe(true);
    const help = run(['cloud', 'iac', '--help'], dir);
    expect(help.stdout).toMatch(/generate/);
    expect(help.stdout).toMatch(/validate/);
    expect(help.stdout).toMatch(/scaffold/);
  });
});

describe('cloud iac validate: terraform missing is explicit, structural check still reported', () => {
  it('IAC_TERRAFORM_MISSING (exit 1) and says fmt/init/validate did not run', () => {
    const dir = workspace();
    run(['cloud', 'iac', 'generate', '--provider', 'gcp', '--out', 'tf', '--json'], dir);
    const r = run(['cloud', 'iac', 'validate', 'tf', '--json'], dir, { ...process.env, RESHELL_TERRAFORM_BIN: '/nonexistent/terraform' });
    expect(r.status).toBe(1);
    expect(r.json.ok).toBe(false);
    expect(r.json.error.code).toBe('IAC_TERRAFORM_MISSING');
    const v = r.json.error.details.validation;
    expect(v.validated).toBe(false);
    expect(v.terraform.found).toBe(false);
    const byName = Object.fromEntries(v.steps.map((s: any) => [s.name, s]));
    expect(byName['hcl-structure']).toMatchObject({ ran: true, ok: true });
    expect(byName.version).toMatchObject({ ran: false });
    expect(byName.init).toBeUndefined();
    expect(v.summary).toMatch(/NOT run/);
  });

  it('a broken file fails the structural check even without terraform', () => {
    const dir = workspace();
    run(['cloud', 'iac', 'generate', '--provider', 'aws', '--out', 'tf', '--json'], dir);
    fs.appendFileSync(path.join(dir, 'tf', 'main.tf'), '\nresource "aws_x" "y" {\n');
    const r = run(['cloud', 'iac', 'validate', 'tf', '--json'], dir, { ...process.env, RESHELL_TERRAFORM_BIN: '/nonexistent/terraform' });
    const structure = r.json.error.details.validation.steps.find((s: any) => s.name === 'hcl-structure');
    expect(structure).toMatchObject({ ran: true, ok: false });
    expect(structure.output).toMatch(/unclosed "\{"/);
  });

  it('a directory without .tf files is IAC_ERROR', () => {
    const dir = workspace();
    fs.mkdirSync(path.join(dir, 'none'));
    expect(run(['cloud', 'iac', 'validate', 'none', '--json'], dir).json.error.code).toBe('IAC_ERROR');
  });
});

describe.skipIf(!terraformFound)('real terraform validation of the generated output', () => {
  it('runs fmt -check, init -backend=false and validate for aws, azure and gcp (or reports exactly why it could not)', () => {
    for (const p of PROVIDERS) {
      const r = validated[p];
      const v = r.json.ok ? r.json.data.validation : r.json.error.details.validation;
      expect(v.terraform.found, p).toBe(true);
      const names = v.steps.map((s: any) => s.name);
      expect(names, p).toEqual(expect.arrayContaining(['hcl-structure', 'version', 'fmt', 'init']));
      const fmt = v.steps.find((s: any) => s.name === 'fmt');
      expect(fmt, `${p}: generated files must be terraform-fmt clean\n${fmt.output}`).toMatchObject({ ran: true, ok: true });
      expect(v.steps.find((s: any) => s.name === 'hcl-structure')).toMatchObject({ ran: true, ok: true });
      if (!providersInstallable) {
        const init = v.steps.find((s: any) => s.name === 'init');
        // honest reporting: nothing claims validation when init failed
        expect(r.json.ok, p).toBe(false);
        expect(v.validated).toBe(false);
        expect(init.ok).toBe(false);
        expect(r.json.error.code).toBe('IAC_VALIDATE_ERROR');
      }
    }
  });

  it.skipIf(!terraformFound)('with providers installable: init -backend=false + validate pass and the envelope is schema-valid', ({ skip }) => {
    if (!providersInstallable) skip();
    for (const p of PROVIDERS) {
      const r = validated[p];
      expect(r.status, `${p}\n${r.stdout}`).toBe(0);
      expect(jsonResponseSchema(iacGenerateResponseSchema).safeParse(r.json).success).toBe(true);
      expect(r.json.data.validation).toMatchObject({ validated: true, formatted: true, providersInstalled: true });
      expect(r.json.data.validation.steps.find((s: any) => s.name === 'validate')).toMatchObject({ ran: true, ok: true });
      expect(r.json.data.validation.terraform.version).toMatch(/^\d+\.\d+\.\d+/);
      // validation ran in a temp copy: no provider cache in the output dir
      expect(fs.existsSync(path.join(outDirs[p], '.terraform'))).toBe(false);
      expect(fs.readdirSync(outDirs[p]).sort()).toEqual(['README.md', 'main.tf', 'outputs.tf', 'terraform.tfvars.example', 'variables.tf', 'versions.tf']);
    }
  });

  it('`cloud iac validate` accepts a generated directory and rejects a semantically broken one with real diagnostics', ({ skip }) => {
    if (!providersInstallable) skip();
    const good = run(['cloud', 'iac', 'validate', outDirs.aws, '--json'], ws);
    expect(good.status, good.stdout).toBe(0);
    expect(jsonResponseSchema(iacValidateResponseSchema).safeParse(good.json).success).toBe(true);
    expect(good.json.data.validation.validated).toBe(true);

    const broken = path.join(ws, 'infra', 'aws-broken');
    fs.cpSync(outDirs.aws, broken, { recursive: true });
    fs.appendFileSync(path.join(broken, 'main.tf'), '\noutput "oops" {\n  value = aws_ecs_cluster.does_not_exist.id\n}\n');
    const bad = run(['cloud', 'iac', 'validate', broken, '--json'], ws);
    expect(bad.status).toBe(1);
    expect(bad.json.error.code).toBe('IAC_VALIDATE_ERROR');
    const step = bad.json.error.details.validation.steps.find((s: any) => s.name === 'validate');
    expect(step).toMatchObject({ ran: true, ok: false });
    expect(step.output).toMatch(/does_not_exist/);
  });

  it('an unreachable provider registry is reported as such (fmt + structure ran, validate did not) and exits non-zero', () => {
    // Real terraform, with provider installation pointed at an empty mirror and no direct access.
    const home = fs.mkdtempSync(path.join(SCRATCH, 'tfhome-'));
    const emptyMirror = fs.mkdtempSync(path.join(SCRATCH, 'mirror-'));
    const rc = path.join(home, 'terraformrc');
    fs.writeFileSync(rc, `provider_installation {\n  filesystem_mirror {\n    path = "${emptyMirror}"\n  }\n}\n`);
    const r = run(['cloud', 'iac', 'generate', '--provider', 'aws', '--out', path.join(ws, 'infra', 'aws-nomirror'), '--validate', '--json'], ws, {
      ...process.env,
      TF_CLI_CONFIG_FILE: rc,
    });
    expect(r.status).toBe(1);
    expect(r.json.ok).toBe(false);
    expect(r.json.error.code).toBe('IAC_VALIDATE_ERROR');
    const v = r.json.error.details.validation;
    expect(v.validated).toBe(false);
    expect(v.providersInstalled).toBe(false);
    const by = Object.fromEntries(v.steps.map((s: any) => [s.name, s]));
    expect(by.fmt).toMatchObject({ ran: true, ok: true });
    expect(by['hcl-structure']).toMatchObject({ ran: true, ok: true });
    expect(by.init).toMatchObject({ ran: true, ok: false });
    expect(by.init.reason).toMatch(/provider plugins could not be downloaded/);
    expect(by.validate).toMatchObject({ ran: false, ok: null });
    expect(r.json.error.message).toMatch(/could not be completed/);
    // the generated files are still written so the user can validate elsewhere (CI)
    expect(fs.existsSync(path.join(ws, 'infra', 'aws-nomirror', 'main.tf'))).toBe(true);
  });
});

describe('cloud deploy (built CLI)', () => {
  const generated = (provider: string): { dir: string; tf: string } => {
    const dir = workspace();
    const tf = path.join(dir, 'infra', provider);
    run(['cloud', 'iac', 'generate', '--provider', provider, '--out', tf, '--json'], dir);
    return { dir, tf };
  };

  for (const provider of PROVIDERS) {
    it(`${provider}: no credentials => CLOUD_CREDENTIALS_MISSING, exit 1, nothing executed`, () => {
      const { dir, tf } = generated(provider);
      const env = bareEnv();
      // a terraform on PATH that would leave a trace if it were ever invoked
      const trace = path.join(dir, 'terraform-was-called');
      fs.writeFileSync(path.join(env.PATH!, 'terraform'), `#!/bin/sh\ntouch "${trace}"\nexit 0\n`, { mode: 0o755 });
      const r = run(['cloud', 'deploy', '--provider', provider, '--dir', tf, '--yes', '--json'], dir, env);
      expect(r.status).toBe(1);
      expect(r.json.ok).toBe(false);
      expect(r.json.error.code).toBe('CLOUD_CREDENTIALS_MISSING');
      expect(r.json.error.details.provider).toBe(provider);
      expect(r.json.error.details.checked.length).toBeGreaterThan(1);
      expect(r.json.error.details.hint).toBeTruthy();
      expect(fs.existsSync(trace)).toBe(false);
    });
  }

  it('credentials present but terraform missing => IAC_TERRAFORM_MISSING', () => {
    const { dir, tf } = generated('aws');
    const r = run(['cloud', 'deploy', '--provider', 'aws', '--dir', tf, '--yes', '--json'], dir, bareEnv({ AWS_ACCESS_KEY_ID: 'AKIATEST', AWS_SECRET_ACCESS_KEY: 's' }));
    expect(r.json.error.code).toBe('IAC_TERRAFORM_MISSING');
  });

  describe('apply gating, with a recording terraform stand-in (the real cloud APIs are never reachable in tests)', () => {
    function fakeTerraform(dir: string, failApply = false): { env: NodeJS.ProcessEnv; log: string } {
      const log = path.join(dir, 'terraform-calls.log');
      const bin = path.join(dir, 'fake-terraform');
      fs.writeFileSync(
        bin,
        `#!/bin/sh\necho "$1" >> "${log}"\ncase "$1" in\n  output) echo '{"alb_dns_name":{"value":"demo.example.com"}}';;\n  apply) ${failApply ? 'echo "Error: AccessDenied" >&2; exit 1' : 'echo applied'};;\n  *) echo "$1 done";;\nesac\n`,
        { mode: 0o755 }
      );
      return { env: bareEnv({ AWS_ACCESS_KEY_ID: 'AKIATEST', AWS_SECRET_ACCESS_KEY: 's', RESHELL_TERRAFORM_BIN: bin }), log };
    }
    const calls = (log: string): string[] => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []);

    it('without --yes: init + plan, never apply; CLOUD_DEPLOY_CONFIRMATION_REQUIRED (exit 1)', () => {
      const { dir, tf } = generated('aws');
      const { env, log } = fakeTerraform(dir);
      const r = run(['cloud', 'deploy', '--provider', 'aws', '--dir', tf, '--json'], dir, env);
      expect(r.status).toBe(1);
      expect(r.json.error.code).toBe('CLOUD_DEPLOY_CONFIRMATION_REQUIRED');
      expect(r.json.error.details.plan).toContain('plan done');
      expect(calls(log)).toEqual(['init', 'plan']);
    });

    it('with --yes: init, apply, output; schema-valid success envelope with outputs', () => {
      const { dir, tf } = generated('aws');
      const { env, log } = fakeTerraform(dir);
      const r = run(['cloud', 'deploy', '--provider', 'aws', '--dir', tf, '--yes', '--image-tag', 'api=9.9.9', '--region', 'eu-west-1', '--json'], dir, env);
      expect(r.status, r.stdout).toBe(0);
      expect(jsonResponseSchema(cloudDeployResponseSchema).safeParse(r.json).success).toBe(true);
      expect(r.json.data).toMatchObject({ applied: true, provider: 'aws', credentials: { source: 'env:AWS_ACCESS_KEY_ID' } });
      expect(r.json.data.outputs).toEqual({ alb_dns_name: 'demo.example.com' });
      expect(calls(log)).toEqual(['init', 'apply', 'output']);
      const apply = r.json.data.steps.find((s: any) => s.name === 'apply');
      expect(apply.argv).toEqual(expect.arrayContaining(['-auto-approve', '-var=region=eu-west-1', '-var=image_tags={"api":"9.9.9"}']));
    });

    it('a failing apply is CLOUD_DEPLOY_ERROR with the tool output, exit 1', () => {
      const { dir, tf } = generated('aws');
      const { env } = fakeTerraform(dir, true);
      const r = run(['cloud', 'deploy', '--provider', 'aws', '--dir', tf, '--yes', '--json'], dir, env);
      expect(r.status).toBe(1);
      expect(r.json.error.code).toBe('CLOUD_DEPLOY_ERROR');
      expect(r.json.error.details.output).toContain('AccessDenied');
      expect(r.json.ok).toBe(false);
    });

    it('--dry-run prints the commands and executes nothing', () => {
      const { dir, tf } = generated('aws');
      const { env, log } = fakeTerraform(dir);
      const r = run(['cloud', 'deploy', '--provider', 'aws', '--dir', tf, '--yes', '--dry-run', '--json'], dir, env);
      expect(r.status).toBe(0);
      expect(r.json.data).toMatchObject({ dryRun: true, applied: false });
      expect(r.json.data.steps.map((s: any) => s.name)).toEqual(['init', 'apply']);
      expect(calls(log)).toEqual([]);
    });
  });

  it('a directory generated for another cloud is refused', () => {
    const { dir, tf } = generated('azure');
    const r = run(['cloud', 'deploy', '--provider', 'aws', '--dir', tf, '--yes', '--json'], dir, bareEnv({ AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 'b' }));
    expect(r.json.error.code).toBe('IAC_ERROR');
    expect(r.json.error.message).toContain('targets azure');
  });
});
