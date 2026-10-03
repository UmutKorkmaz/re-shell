import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  attr,
  block,
  call,
  checkHclStructure,
  hclString,
  hclTemplate,
  hclValue,
  label,
  raw,
  renderFile,
} from '../../src/iac/hcl';
import { generateIac, IacError, parseProvider, renderIac } from '../../src/iac/generate';
import { fargateSize } from '../../src/iac/aws';
import { appName, containerAppSize } from '../../src/iac/azure';
import { runLimits, runServiceName } from '../../src/iac/gcp';
import { parseEnvRef, resolveEnvRefs, type IacService } from '../../src/iac/model';
import { iacGenerateResponseSchema } from '@re-shell/contracts';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'polyglot-workspace');
const dirs: string[] = [];

function workspaceCopy(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-iac-'));
  dirs.push(dir);
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

function files(provider: string, services?: string[]): Record<string, string> {
  const dir = workspaceCopy();
  const res = generateIac({ cwd: dir, provider, services, dryRun: true });
  return Object.fromEntries(res.files.map(f => [f.path, f.content]));
}

describe('HCL helpers', () => {
  it('hclString escapes quotes, backslashes, newlines and interpolation sequences', () => {
    expect(hclString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
    expect(hclString('${var.x} %{if}')).toBe('"$${var.x} %%{if}"');
  });

  it('hclTemplate keeps interpolations verbatim and escapes only outside them', () => {
    expect(hclTemplate('a"b-${lookup(m, "k", d)}-"c')).toBe('"a\\"b-${lookup(m, "k", d)}-\\"c"');
    expect(hclTemplate('x${a["b"]}y')).toBe('"x${a["b"]}y"');
    expect(hclTemplate('$${literal}')).toBe('"$${literal}"');
  });

  it('hclValue renders maps with aligned `=` (terraform fmt style) and quotes odd keys', () => {
    expect(hclValue({ a: 1, longer: 'x', 'needs-quote!': true })).toBe('{\n  a              = 1\n  longer         = "x"\n  "needs-quote!" = true\n}');
    expect(hclValue([])).toBe('[]');
    expect(hclValue({})).toBe('{}');
    expect(hclValue(['a', 'b'])).toBe('[\n  "a",\n  "b",\n]');
    expect(hclValue(null)).toBe('null');
  });

  it('multi-line values end an alignment run (matches terraform fmt)', () => {
    const out = renderFile([
      block('resource', ['t', 'n'], [attr('a', 1), attr('bbbb', 2), attr('c', { x: 1 }), attr('dd', 3), attr('e', 4)]),
    ]);
    expect(out).toBe(
      'resource "t" "n" {\n  a    = 1\n  bbbb = 2\n  c = {\n    x = 1\n  }\n  dd = 3\n  e  = 4\n}\n'
    );
  });

  it('call() renders the argument at the call-site indent', () => {
    const out = renderFile([block('resource', ['t', 'n'], [attr('p', call('jsonencode', [{ a: 1 }]))])]);
    expect(out).toBe('resource "t" "n" {\n  p = jsonencode([\n    {\n      a = 1\n    },\n  ])\n}\n');
  });

  it('label() makes terraform-safe identifiers', () => {
    expect(label('billing-api')).toBe('billing-api');
    expect(label('1st')).toBe('_1st');
    expect(label('a.b')).toBe('a_b');
  });

  it('structure checker accepts valid HCL (strings, heredocs, comments, nested interpolation)', () => {
    const ok = [
      '# comment { not a brace',
      'resource "a" "b" {',
      '  x = "${lookup(var.m, "k", "}")}"',
      '  y = <<EOT',
      '{ not counted',
      'EOT',
      '  z = [1, 2, { a = (1 + 2) }]',
      '  /* block { */',
      '}',
      '',
    ].join('\n');
    expect(checkHclStructure(ok)).toEqual([]);
  });

  it('structure checker reports unbalanced blocks, unterminated strings and heredocs, stray text', () => {
    expect(checkHclStructure('resource "a" "b" {\n  x = 1\n')).toEqual([{ line: 1, message: 'unclosed "{"' }]);
    expect(checkHclStructure('a = "unterminated\nb = 1\n').some(i => /unterminated string/.test(i.message))).toBe(true);
    expect(checkHclStructure('a = <<EOT\nbody\n').some(i => /unterminated heredoc/.test(i.message))).toBe(true);
    expect(checkHclStructure('x = [1, 2)\n').some(i => /mismatched/.test(i.message))).toBe(true);
    expect(checkHclStructure('}\n').some(i => /unexpected "}"/.test(i.message))).toBe(true);
    expect(checkHclStructure('this is not hcl\n').some(i => /unexpected top-level text/.test(i.message))).toBe(true);
    expect(checkHclStructure('/* never closed').some(i => /block comment/.test(i.message))).toBe(true);
  });

  it('raw() expressions are emitted verbatim', () => {
    expect(hclValue(raw('var.x'))).toBe('var.x');
  });
});

describe('sizing helpers', () => {
  it('fargateSize rounds up to a valid cpu/memory pair', () => {
    expect(fargateSize(null, null)).toEqual({ cpu: 256, memory: 512 });
    expect(fargateSize(500, 512)).toEqual({ cpu: 512, memory: 1024 });
    expect(fargateSize(256, 3072)).toEqual({ cpu: 512, memory: 3072 });
    expect(fargateSize(1000, 1024)).toEqual({ cpu: 1024, memory: 2048 });
    expect(fargateSize(99999, 99999)).toEqual({ cpu: 4096, memory: 30720 });
  });

  it('containerAppSize keeps memory at 2 GiB per vCPU within 0.25-2 vCPU', () => {
    expect(containerAppSize(null, null)).toEqual({ cpu: 0.25, memory: '0.5Gi' });
    expect(containerAppSize(500, 512)).toEqual({ cpu: 0.5, memory: '1Gi' });
    expect(containerAppSize(250, 4096)).toEqual({ cpu: 2, memory: '4Gi' }); // memory drives cpu (2 GiB per vCPU)
    expect(containerAppSize(9000, null)).toEqual({ cpu: 2, memory: '4Gi' });
  });

  it('runLimits clamps to valid Cloud Run combinations', () => {
    expect(runLimits(null, null)).toEqual({ cpu: '1', memory: '512Mi' });
    expect(runLimits(500, 256)).toEqual({ cpu: '1', memory: '512Mi' });
    expect(runLimits(1000, 6144)).toEqual({ cpu: '2', memory: '6144Mi' });
    expect(runLimits(1000, 9000)).toEqual({ cpu: '4', memory: '9000Mi' });
  });

  it('name sanitizers satisfy provider rules', () => {
    expect(appName('1st-svc')).toBe('app-1st-svc');
    expect(appName('x'.repeat(40)).length).toBe(32);
    expect(runServiceName('9lives')).toBe('svc-9lives');
    expect(runServiceName('billing')).toBe('billing');
  });
});

describe('env service references', () => {
  const svc = (name: string, env: Record<string, string>): IacService => ({
    name,
    label: name,
    type: 'backend',
    port: 8080,
    exposed: true,
    cpuMillis: null,
    memoryMiB: null,
    minReplicas: 1,
    maxReplicas: 3,
    healthPath: '/',
    env,
    dependsOn: [],
  });

  it('parseEnvRef recognises scheme://service[:port][/path] pointing at another service', () => {
    const all = [svc('api', {}), svc('billing', {})];
    expect(parseEnvRef('http://billing:8081/v1?x=1', all, 'api')).toEqual({ service: 'billing', scheme: 'http', suffix: '/v1?x=1' });
    expect(parseEnvRef('https://billing', all, 'api')).toEqual({ service: 'billing', scheme: 'https', suffix: '' });
    expect(parseEnvRef('http://api:1', all, 'api')).toBeNull(); // self
    expect(parseEnvRef('http://other:1', all, 'api')).toBeNull(); // not selected
    expect(parseEnvRef('postgres://db/x', all, 'api')).toBeNull();
    expect(parseEnvRef('not a url', all, 'api')).toBeNull();
  });

  it('resolveEnvRefs drops edges that would create a dependency cycle', () => {
    const a = svc('a', { B_URL: 'http://b:1' });
    const b = svc('b', { A_URL: 'http://a:1', C_URL: 'http://c:1' });
    const c = svc('c', {});
    const { refs, cyclic } = resolveEnvRefs([a, b, c]);
    expect([...refs.get('a')!.keys()]).toEqual(['B_URL']);
    expect([...refs.get('b')!.keys()]).toEqual(['C_URL']);
    expect(cyclic).toEqual(['b.A_URL -> a']);
  });
});

describe('generateIac on the polyglot fixture', () => {
  it('rejects unknown providers and services, a missing --out, and a missing workspace', () => {
    const dir = workspaceCopy();
    expect(() => parseProvider('oracle')).toThrow(/Unknown provider/);
    expect(() => generateIac({ cwd: dir, provider: 'aws', services: ['nope'], dryRun: true })).toThrow(/Unknown service/);
    expect(() => generateIac({ cwd: dir, provider: 'aws' })).toThrow(/--out/);
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-iac-empty-'));
    dirs.push(empty);
    try {
      generateIac({ cwd: empty, provider: 'aws', dryRun: true });
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(IacError);
      expect((err as IacError).code).toBe('WORKSPACE_NOT_FOUND');
    }
  });

  it('dry run writes nothing; a real run writes every file and reports a schema-valid result', () => {
    const dir = workspaceCopy();
    const dry = generateIac({ cwd: dir, provider: 'gcp', out: 'iac', dryRun: true });
    expect(dry.written).toBe(false);
    expect(fs.existsSync(path.join(dir, 'iac'))).toBe(false);
    const real = generateIac({ cwd: dir, provider: 'gcp', out: 'iac' });
    expect(real.written).toBe(true);
    for (const f of real.files) expect(fs.readFileSync(path.join(dir, 'iac', f.path), 'utf8')).toBe(f.content);
    expect(real.files.map(f => f.path).sort()).toEqual(['README.md', 'main.tf', 'outputs.tf', 'terraform.tfvars.example', 'variables.tf', 'versions.tf']);
    expect(
      iacGenerateResponseSchema.safeParse({
        provider: real.provider,
        target: real.target,
        outDir: real.outDir,
        dryRun: real.dryRun,
        written: real.written,
        services: real.services,
        files: real.files.map(f => ({ path: f.path, bytes: f.bytes })),
        variables: real.variables,
        validation: null,
        warnings: real.warnings,
      }).success
    ).toBe(true);
  });

  it('every generated .tf file passes the structural HCL check for every provider', () => {
    for (const provider of ['aws', 'azure', 'gcp']) {
      for (const [name, content] of Object.entries(files(provider))) {
        if (name.endsWith('.tf')) expect(checkHclStructure(content), `${provider}/${name}`).toEqual([]);
      }
    }
  });

  it('generation is deterministic', () => {
    for (const provider of ['aws', 'azure', 'gcp']) {
      expect(files(provider)).toEqual(files(provider));
    }
  });

  describe('aws (ECS Fargate)', () => {
    const f = files('aws');
    it('has the provider, required version and region/image-tag variables', () => {
      expect(f['versions.tf']).toContain('source  = "hashicorp/aws"');
      expect(f['versions.tf']).toContain('version = "~> 5.0"');
      expect(f['variables.tf']).toMatch(/variable "region" \{[^}]*default\s+= "us-east-1"/s);
      expect(f['variables.tf']).toContain('variable "image_tags"');
      expect(f['variables.tf']).toContain('type        = map(string)');
      expect(f['variables.tf']).toContain('variable "default_image_tag"');
    });

    it('defines cluster, ALB, per-service ECR/log group/IAM/task/service resources', () => {
      const m = f['main.tf'];
      for (const r of ['aws_ecs_cluster" "main', 'aws_lb" "main', 'aws_lb_listener" "http', 'aws_lb_listener" "https', 'aws_iam_role" "task_execution', 'aws_service_discovery_http_namespace" "main', 'aws_security_group" "alb', 'aws_security_group" "service']) {
        expect(m, r).toContain(`resource "${r}"`);
      }
      for (const svc of ['web', 'api', 'billing', 'analytics', 'gateway', 'edge', 'mailer', 'search', 'indexer', 'reports', 'ledger']) {
        for (const t of ['aws_ecr_repository', 'aws_cloudwatch_log_group', 'aws_ecs_task_definition', 'aws_ecs_service', 'aws_iam_role', 'aws_appautoscaling_target']) {
          const lbl = t === 'aws_iam_role' ? `${svc}_task` : svc;
          expect(m, `${t}.${lbl}`).toContain(`resource "${t}" "${lbl}"`);
        }
      }
    });

    it('wires image tags into the task definition and keeps service env + ports', () => {
      const m = f['main.tf'];
      expect(m).toContain('image     = "${aws_ecr_repository.api.repository_url}:${lookup(var.image_tags, "api", var.default_image_tag)}"');
      expect(m).toContain('containerPort = 4000');
      expect(m).toMatch(/name\s+= "BILLING_URL"\s+value = "http:\/\/billing:8081"/);
      // service connect makes `http://billing:8081` resolvable
      expect(m).toContain('dns_name = "billing"');
    });

    it('exposes frontend/backend services through path rules and not workers', () => {
      const m = f['main.tf'];
      expect(m).toContain('resource "aws_lb_target_group" "api"');
      expect(m).toContain('values = [\n        "/api",\n        "/api/*",\n      ]');
      expect(m).not.toContain('resource "aws_lb_target_group" "mailer"');
      expect(m).not.toContain('resource "aws_lb_target_group" "indexer"');
    });

    it('--services limits the resources', () => {
      const sub = files('aws', ['api']);
      expect(sub['main.tf']).toContain('resource "aws_ecs_service" "api"');
      expect(sub['main.tf']).not.toContain('resource "aws_ecs_service" "billing"');
      expect(sub['outputs.tf']).toContain('api = aws_ecr_repository.api.repository_url');
    });

    it('a workers-only selection has no load balancer', () => {
      const sub = files('aws', ['mailer', 'indexer']);
      expect(sub['main.tf']).not.toContain('aws_lb');
      expect(sub['outputs.tf']).not.toContain('alb_dns_name');
    });

    it('uses the workspace default region only when it is a valid AWS region', () => {
      const dir = workspaceCopy();
      const cfg = path.join(dir, 're-shell.workspaces.yaml');
      fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('variables:', 'config:\n  defaultRegion: eu-west-2\nvariables:'));
      const res = generateIac({ cwd: dir, provider: 'aws', dryRun: true });
      expect(res.files.find(x => x.path === 'variables.tf')!.content).toContain('default     = "eu-west-2"');
      fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('eu-west-2', 'mars-1'));
      expect(generateIac({ cwd: dir, provider: 'aws', dryRun: true }).files.find(x => x.path === 'variables.tf')!.content).toContain('default     = "us-east-1"');
    });
  });

  describe('azure (Container Apps)', () => {
    const f = files('azure');
    it('defines resource group, Log Analytics, ACR, identity, environment and one app per service', () => {
      const m = f['main.tf'];
      for (const r of ['azurerm_resource_group" "main', 'azurerm_log_analytics_workspace" "main', 'azurerm_container_registry" "main', 'azurerm_user_assigned_identity" "apps', 'azurerm_role_assignment" "acr_pull', 'azurerm_container_app_environment" "main']) {
        expect(m, r).toContain(`resource "${r}"`);
      }
      for (const svc of ['web', 'api', 'billing', 'analytics', 'gateway', 'edge', 'mailer', 'search', 'indexer', 'reports', 'ledger']) {
        expect(m, svc).toContain(`resource "azurerm_container_app" "${svc}"`);
      }
      expect(f['versions.tf']).toContain('source  = "hashicorp/azurerm"');
      expect(f['variables.tf']).toContain('variable "location"');
      expect(f['variables.tf']).toContain('variable "image_tags"');
    });

    it('pulls from ACR with a managed identity (no admin credentials) and supports a placeholder image', () => {
      const m = f['main.tf'];
      expect(m).toContain('admin_enabled       = false');
      expect(m).toContain('role_definition_name = "AcrPull"');
      expect(m).toContain('var.use_placeholder_image ? local.placeholder_image : "${azurerm_container_registry.main.login_server}/api:${lookup(var.image_tags, "api", var.default_image_tag)}"');
    });

    it('ingress: external for frontend/backend, none for workers; env references become fqdn expressions', () => {
      const m = f['main.tf'];
      const apiApp = m.slice(m.indexOf('resource "azurerm_container_app" "api"'), m.indexOf('resource "azurerm_container_app" "billing"'));
      expect(apiApp).toContain('external_enabled = true');
      expect(apiApp).toContain('target_port      = 4000');
      expect(apiApp).toContain('value = "https://${azurerm_container_app.billing.ingress[0].fqdn}"');
      const mailer = m.slice(m.indexOf('resource "azurerm_container_app" "mailer"'), m.indexOf('resource "azurerm_container_app" "search"'));
      expect(mailer).not.toContain('ingress {');
    });
  });

  describe('gcp (Cloud Run)', () => {
    const f = files('gcp');
    it('defines Artifact Registry, per-service runtime service accounts, Cloud Run services and IAM bindings', () => {
      const m = f['main.tf'];
      expect(m).toContain('resource "google_artifact_registry_repository" "main"');
      expect(m).toContain('resource "google_project_service" "apis"');
      for (const svc of ['web', 'api', 'billing', 'analytics', 'gateway', 'edge', 'mailer', 'search', 'indexer', 'reports', 'ledger']) {
        expect(m, svc).toContain(`resource "google_cloud_run_v2_service" "${svc}"`);
        expect(m, svc).toContain(`resource "google_service_account" "${svc}"`);
        expect(m, svc).toContain(`resource "google_artifact_registry_repository_iam_member" "${svc}_reader"`);
      }
      expect(m).toContain('resource "google_cloud_run_v2_service_iam_member" "api_public"');
      expect(m).not.toContain('resource "google_cloud_run_v2_service_iam_member" "indexer_public"');
      expect(m).toContain('role     = "roles/run.invoker"');
      expect(f['versions.tf']).toContain('source  = "hashicorp/google"');
      expect(f['variables.tf']).toContain('variable "project_id"');
      expect(f['variables.tf']).toContain('variable "region"');
      expect(f['variables.tf']).toContain('variable "image_tags"');
    });

    it('turns service URLs in env into Cloud Run uri references with matching invoker bindings', () => {
      const m = f['main.tf'];
      expect(m).toContain('value = google_cloud_run_v2_service.billing.uri');
      expect(m).toContain('resource "google_cloud_run_v2_service_iam_member" "api_invokes_billing"');
      expect(m).toContain('member   = "serviceAccount:${google_service_account.api.email}"');
      // the same URL value that points at nothing selected stays literal
      const sub = files('gcp', ['api']);
      expect(sub['main.tf']).toContain('value = "http://billing:8081"');
      expect(sub['main.tf']).not.toContain('api_invokes_billing');
    });

    it('cyclic service references stay literal and produce a warning', () => {
      const dir = workspaceCopy();
      const cfg = path.join(dir, 're-shell.workspaces.yaml');
      // billing -> api closes the cycle api -> billing -> api
      fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('      SPRING_PROFILES_ACTIVE: prod\n', '      SPRING_PROFILES_ACTIVE: prod\n      API_URL: http://api:4000\n'));
      const res = generateIac({ cwd: dir, provider: 'gcp', services: ['api', 'billing', 'analytics'], dryRun: true });
      expect(res.warnings.join('\n')).toMatch(/Circular service reference/);
      const main = res.files.find(x => x.path === 'main.tf')!.content;
      expect(checkHclStructure(main)).toEqual([]);
    });
  });

  it('special characters in env values are escaped, not interpolated', () => {
    const dir = workspaceCopy();
    const cfg = path.join(dir, 're-shell.workspaces.yaml');
    fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace('      NODE_ENV: production\n', '      NODE_ENV: production\n      TRICKY: \'a "quoted" ${var.secret} %{if x}\'\n'));
    for (const provider of ['aws', 'azure', 'gcp']) {
      const main = generateIac({ cwd: dir, provider, services: ['api'], dryRun: true }).files.find(x => x.path === 'main.tf')!.content;
      expect(main, provider).toContain('"a \\"quoted\\" $${var.secret} %%{if x}"');
      expect(checkHclStructure(main)).toEqual([]);
    }
  });

  it('renderIac includes a tfvars example and README for deploying', () => {
    const dir = workspaceCopy();
    const res = generateIac({ cwd: dir, provider: 'azure', dryRun: true });
    const tfvars = res.files.find(x => x.path === 'terraform.tfvars.example')!.content;
    expect(tfvars).toContain('location = "westeurope"');
    expect(tfvars).toContain('"api" = "latest"');
    expect(res.files.find(x => x.path === 'README.md')!.content).toContain('cloud deploy --provider azure');
    expect(renderIac).toBeTypeOf('function');
  });
});
