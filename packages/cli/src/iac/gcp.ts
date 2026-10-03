// GCP target: Cloud Run v2 services, Artifact Registry, per-service runtime
// service accounts and IAM bindings (public invoker + service-to-service).

import type { IacFile } from './aws';
import { attr, block, hclTemplate, raw, renderFile, type HclValue, type Item } from './hcl';
import type { IacModel, IacService } from './model';
import { resolveEnvRefs } from './model';

export const GOOGLE_PROVIDER_VERSION = '~> 6.0';

const tpl = (s: string) => raw(hclTemplate(s));

/** Cloud Run service names: lowercase letters, digits, hyphens; start with a letter; max 49. */
export function runServiceName(name: string): string {
  let n = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!/^[a-z]/.test(n)) n = `svc-${n}`;
  return n.slice(0, 49).replace(/-+$/, '');
}

/** CPU limit as a Cloud Run string; memory limit; clamps invalid combinations. */
export function runLimits(cpuMillis: number | null, memoryMiB: number | null): { cpu: string; memory: string } {
  let cpu = cpuMillis ?? 1000;
  let mem = memoryMiB ?? 512;
  const validCpu = [1000, 2000, 4000, 6000, 8000];
  if (cpu < 1000) cpu = 1000; // sub-1-CPU limits force concurrency 1; use a whole vCPU
  cpu = validCpu.find(c => c >= cpu) ?? 8000;
  if (mem > 4096 && cpu < 2000) cpu = 2000;
  if (mem > 8192 && cpu < 4000) cpu = 4000;
  if (mem < 512) mem = 512;
  return { cpu: String(cpu / 1000), memory: `${mem}Mi` };
}

function defaultRegion(model: IacModel): string {
  const r = model.defaultRegion;
  return r && /^[a-z]+-[a-z]+\d+$/.test(r) ? r : 'us-central1';
}

function v(name: string, items: Item[]): Item {
  return block('variable', [name], items);
}

function variablesFile(model: IacModel): string {
  return renderFile([
    v('project_id', [attr('description', 'GCP project id to deploy into.'), attr('type', raw('string'))]),
    v('project', [attr('description', 'Name prefix for every resource.'), attr('type', raw('string')), attr('default', model.project)]),
    v('environment', [attr('description', 'Environment name (dev, staging, prod).'), attr('type', raw('string')), attr('default', 'dev')]),
    v('region', [attr('description', 'GCP region for Cloud Run and Artifact Registry.'), attr('type', raw('string')), attr('default', defaultRegion(model))]),
    v('image_tags', [
      attr('description', 'Image tag per service name. Services missing from the map use default_image_tag.'),
      attr('type', raw('map(string)')),
      attr('default', {}),
    ]),
    v('default_image_tag', [attr('description', 'Image tag used when a service has no entry in image_tags.'), attr('type', raw('string')), attr('default', 'latest')]),
    v('use_placeholder_image', [
      attr('description', 'Run a public placeholder image until real images are pushed to Artifact Registry (set false after pushing).'),
      attr('type', raw('bool')),
      attr('default', true),
    ]),
    v('allow_unauthenticated', [attr('description', 'Allow public (unauthenticated) invocation of exposed services.'), attr('type', raw('bool')), attr('default', true)]),
    v('enable_apis', [attr('description', 'Enable the required Google APIs on the project.'), attr('type', raw('bool')), attr('default', true)]),
    v('deletion_protection', [attr('description', 'Protect Cloud Run services from deletion.'), attr('type', raw('bool')), attr('default', false)]),
  ]);
}

function versionsFile(): string {
  return renderFile([
    block('terraform', [], [
      attr('required_version', '>= 1.5.0'),
      block('required_providers', [], [attr('google', { source: 'hashicorp/google', version: GOOGLE_PROVIDER_VERSION })]),
    ]),
    block('provider', ['google'], [attr('project', raw('var.project_id')), attr('region', raw('var.region'))]),
  ]);
}

function serviceBlocks(s: IacService, refs: Map<string, { service: string; scheme: string; suffix: string }>, all: IacService[]): Item[] {
  const l = s.label;
  const limits = runLimits(s.cpuMillis, s.memoryMiB);
  const envItems: Item[] = Object.entries(s.env).map(([name, value]) => {
    const ref = refs.get(name);
    const target = ref ? all.find(x => x.name === ref.service) : undefined;
    const uri = target ? `google_cloud_run_v2_service.${target.label}.uri` : '';
    const valueExpr = ref && target ? (ref.suffix ? tpl(`\${${uri}}${ref.suffix}`) : raw(uri)) : value;
    return block('env', [], [attr('name', name), attr('value', valueExpr as HclValue)]);
  });

  const items: Item[] = [
    block('resource', ['google_service_account', l], [
      attr('project', raw('var.project_id')),
      attr('account_id', raw(`substr(${hclTemplate(`\${local.name}-${s.name}`)}, 0, 30)`)),
      attr('display_name', `${s.name} runtime`),
    ]),
    block('resource', ['google_artifact_registry_repository_iam_member', `${l}_reader`], [
      attr('project', raw('var.project_id')),
      attr('location', raw('google_artifact_registry_repository.main.location')),
      attr('repository', raw('google_artifact_registry_repository.main.name')),
      attr('role', 'roles/artifactregistry.reader'),
      attr('member', tpl(`serviceAccount:\${google_service_account.${l}.email}`)),
    ]),
    block('resource', ['google_cloud_run_v2_service', l], [
      attr('project', raw('var.project_id')),
      attr('name', runServiceName(s.name)),
      attr('location', raw('var.region')),
      attr('ingress', s.exposed ? 'INGRESS_TRAFFIC_ALL' : 'INGRESS_TRAFFIC_INTERNAL_ONLY'),
      attr('deletion_protection', raw('var.deletion_protection')),
      block('template', [], [
        attr('service_account', raw(`google_service_account.${l}.email`)),
        block('scaling', [], [attr('min_instance_count', s.minReplicas), attr('max_instance_count', s.maxReplicas)]),
        block('containers', [], [
          attr(
            'image',
            raw(
              `var.use_placeholder_image ? local.placeholder_image : ${hclTemplate(`\${local.registry}/${s.name}:\${lookup(var.image_tags, ${JSON.stringify(s.name)}, var.default_image_tag)}`)}`
            )
          ),
          block('ports', [], [attr('container_port', s.port)]),
          ...envItems,
          block('resources', [], [attr('limits', { cpu: limits.cpu, memory: limits.memory })]),
        ]),
      ]),
      attr('depends_on', raw('[google_project_service.apis]')),
    ]),
  ];
  if (s.exposed) {
    items.push(
      block('resource', ['google_cloud_run_v2_service_iam_member', `${l}_public`], [
        attr('count', raw('var.allow_unauthenticated ? 1 : 0')),
        attr('project', raw('var.project_id')),
        attr('location', raw('var.region')),
        attr('name', raw(`google_cloud_run_v2_service.${l}.name`)),
        attr('role', 'roles/run.invoker'),
        attr('member', 'allUsers'),
      ])
    );
  }
  return items;
}

function mainFile(model: IacModel): string {
  const { refs } = resolveEnvRefs(model.services);
  const blocks: Item[] = [
    block('locals', [], [
      attr('name', tpl('${var.project}-${var.environment}')),
      attr('placeholder_image', 'us-docker.pkg.dev/cloudrun/container/hello'),
      attr('registry', tpl('${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}')),
    ]),
    block('resource', ['google_project_service', 'apis'], [
      attr('for_each', raw('var.enable_apis ? toset(["run.googleapis.com", "artifactregistry.googleapis.com", "iam.googleapis.com"]) : toset([])')),
      attr('project', raw('var.project_id')),
      attr('service', raw('each.value')),
      attr('disable_on_destroy', false),
    ]),
    block('resource', ['google_artifact_registry_repository', 'main'], [
      attr('project', raw('var.project_id')),
      attr('location', raw('var.region')),
      attr('repository_id', raw('local.name')),
      attr('format', 'DOCKER'),
      attr('description', 'Container images for the workspace services'),
      attr('depends_on', raw('[google_project_service.apis]')),
    ]),
  ];
  for (const s of model.services) blocks.push(...serviceBlocks(s, refs.get(s.name) ?? new Map(), model.services));

  // service-to-service: the caller's runtime identity may invoke the callee
  for (const s of model.services) {
    const seen = new Set<string>();
    for (const ref of (refs.get(s.name) ?? new Map()).values()) {
      if (seen.has(ref.service)) continue;
      seen.add(ref.service);
      const callee = model.services.find(x => x.name === ref.service)!;
      blocks.push(
        block('resource', ['google_cloud_run_v2_service_iam_member', `${s.label}_invokes_${callee.label}`], [
          attr('project', raw('var.project_id')),
          attr('location', raw('var.region')),
          attr('name', raw(`google_cloud_run_v2_service.${callee.label}.name`)),
          attr('role', 'roles/run.invoker'),
          attr('member', tpl(`serviceAccount:\${google_service_account.${s.label}.email}`)),
        ])
      );
    }
  }
  return renderFile(blocks);
}

function outputsFile(model: IacModel): string {
  return renderFile([
    block('output', ['artifact_registry'], [attr('description', 'Artifact Registry path (push images here).'), attr('value', raw('local.registry'))]),
    block('output', ['service_urls'], [
      attr('description', 'Cloud Run URL per service.'),
      attr('value', Object.fromEntries(model.services.map(s => [s.name, raw(`google_cloud_run_v2_service.${s.label}.uri`)]))),
    ]),
  ]);
}

/** Generate the GCP (Cloud Run) Terraform files. */
export function generateGcp(model: IacModel): IacFile[] {
  return [
    { path: 'versions.tf', content: versionsFile() },
    { path: 'variables.tf', content: variablesFile(model) },
    { path: 'main.tf', content: mainFile(model) },
    { path: 'outputs.tf', content: outputsFile(model) },
  ];
}
