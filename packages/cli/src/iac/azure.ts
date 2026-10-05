// Azure target: Container Apps (resource group, Log Analytics, environment,
// ACR with a managed identity for pulls, one container app per service).

import type { IacFile } from './aws';
import { attr, block, raw, renderFile, type HclValue, type Item } from './hcl';
import { hclTemplate } from './hcl';
import type { IacModel, IacService } from './model';
import { resolveEnvRefs } from './model';

export const AZURERM_PROVIDER_VERSION = '~> 3.100';

const tpl = (s: string) => raw(hclTemplate(s));

/** Container App names: lowercase alphanumerics and hyphens, start with a letter, max 32. */
export function appName(name: string): string {
  let n = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!/^[a-z]/.test(n)) n = `app-${n}`;
  n = n.slice(0, 32).replace(/-+$/, '');
  return n;
}

/** Consumption-plan sizing: cpu in 0.25 steps up to 2, memory exactly 2 GiB per vCPU. */
export function containerAppSize(cpuMillis: number | null, memoryMiB: number | null): { cpu: number; memory: string } {
  const want = Math.max(cpuMillis ?? 250, ((memoryMiB ?? 0) / 2048) * 1000);
  const cpu = Math.min(2, Math.max(0.25, Math.ceil(want / 250) * 0.25));
  return { cpu, memory: `${cpu * 2}Gi` };
}

const hasIngress = (s: IacService): boolean => s.type !== 'worker';

function defaultLocation(model: IacModel): string {
  const r = model.defaultRegion;
  return r && /^[a-z]+[a-z0-9]*$/.test(r) && !r.includes('-') ? r : 'westeurope';
}

function v(name: string, items: Item[]): Item {
  return block('variable', [name], items);
}

function variablesFile(model: IacModel): string {
  return renderFile([
    v('project', [attr('description', 'Project name used as a prefix for every resource.'), attr('type', raw('string')), attr('default', model.project)]),
    v('environment', [attr('description', 'Environment name (dev, staging, prod).'), attr('type', raw('string')), attr('default', 'dev')]),
    v('location', [attr('description', 'Azure region (location) to deploy into.'), attr('type', raw('string')), attr('default', defaultLocation(model))]),
    v('resource_group_name', [attr('description', 'Resource group name. Empty derives one from project and environment.'), attr('type', raw('string')), attr('default', '')]),
    v('image_tags', [
      attr('description', 'Image tag per service name. Services missing from the map use default_image_tag.'),
      attr('type', raw('map(string)')),
      attr('default', {}),
    ]),
    v('default_image_tag', [attr('description', 'Image tag used when a service has no entry in image_tags.'), attr('type', raw('string')), attr('default', 'latest')]),
    v('use_placeholder_image', [
      attr('description', 'Run a public placeholder image until real images are pushed to the registry (set false after pushing).'),
      attr('type', raw('bool')),
      attr('default', true),
    ]),
    v('acr_sku', [attr('description', 'Container registry SKU.'), attr('type', raw('string')), attr('default', 'Basic')]),
    v('log_retention_days', [attr('description', 'Log Analytics retention in days.'), attr('type', raw('number')), attr('default', 30)]),
  ]);
}

function versionsFile(): string {
  return renderFile([
    block('terraform', [], [
      attr('required_version', '>= 1.5.0'),
      block('required_providers', [], [attr('azurerm', { source: 'hashicorp/azurerm', version: AZURERM_PROVIDER_VERSION })]),
    ]),
    block('provider', ['azurerm'], [block('features', [], [])]),
  ]);
}

function appBlock(s: IacService, refs: Map<string, { service: string; scheme: string; suffix: string }>, all: IacService[]): Item {
  const l = s.label;
  const size = containerAppSize(s.cpuMillis, s.memoryMiB);
  const envItems: Item[] = Object.entries(s.env).map(([name, value]) => {
    const ref = refs.get(name);
    const target = ref ? all.find(x => x.name === ref.service) : undefined;
    const valueExpr =
      ref && target
        ? tpl(`https://\${azurerm_container_app.${target.label}.ingress[0].fqdn}${ref.suffix}`)
        : value;
    return block('env', [], [attr('name', name), attr('value', valueExpr as HclValue)]);
  });

  const items: Item[] = [
    attr('name', appName(s.name)),
    attr('container_app_environment_id', raw('azurerm_container_app_environment.main.id')),
    attr('resource_group_name', raw('azurerm_resource_group.main.name')),
    attr('revision_mode', 'Single'),
    block('identity', [], [attr('type', 'UserAssigned'), attr('identity_ids', raw('[azurerm_user_assigned_identity.apps.id]'))]),
    block('registry', [], [
      attr('server', raw('azurerm_container_registry.main.login_server')),
      attr('identity', raw('azurerm_user_assigned_identity.apps.id')),
    ]),
    block('template', [], [
      attr('min_replicas', s.minReplicas),
      attr('max_replicas', s.maxReplicas),
      block('container', [], [
        attr('name', appName(s.name)),
        attr(
          'image',
          raw(
            `var.use_placeholder_image ? local.placeholder_image : ${hclTemplate(`\${azurerm_container_registry.main.login_server}/${s.name}:\${lookup(var.image_tags, ${JSON.stringify(s.name)}, var.default_image_tag)}`)}`
          )
        ),
        attr('cpu', size.cpu),
        attr('memory', size.memory),
        ...envItems,
      ]),
    ]),
  ];
  if (hasIngress(s)) {
    items.push(
      block('ingress', [], [
        attr('external_enabled', s.exposed),
        attr('target_port', s.port),
        attr('transport', 'auto'),
        block('traffic_weight', [], [attr('latest_revision', true), attr('percentage', 100)]),
      ])
    );
  }
  items.push(attr('depends_on', raw('[azurerm_role_assignment.acr_pull]')));
  return block('resource', ['azurerm_container_app', l], items);
}

function mainFile(model: IacModel): string {
  const { refs } = resolveEnvRefs(model.services.map(s => ({ ...s, env: onlyIngressTargets(s, model.services) })));
  const blocks: Item[] = [
    block('data', ['azurerm_client_config', 'current'], []),
    block('locals', [], [
      attr('name', tpl('${var.project}-${var.environment}')),
      attr('resource_group_name', raw('var.resource_group_name != "" ? var.resource_group_name : "${local.name}-rg"')),
      attr(
        'acr_name',
        raw('substr("${replace(var.project, "-", "")}${replace(var.environment, "-", "")}${substr(md5(data.azurerm_client_config.current.subscription_id), 0, 6)}", 0, 50)')
      ),
      attr('placeholder_image', 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'),
    ]),
    block('resource', ['azurerm_resource_group', 'main'], [attr('name', raw('local.resource_group_name')), attr('location', raw('var.location'))]),
    block('resource', ['azurerm_log_analytics_workspace', 'main'], [
      attr('name', tpl('${local.name}-logs')),
      attr('location', raw('azurerm_resource_group.main.location')),
      attr('resource_group_name', raw('azurerm_resource_group.main.name')),
      attr('sku', 'PerGB2018'),
      attr('retention_in_days', raw('var.log_retention_days')),
    ]),
    block('resource', ['azurerm_container_registry', 'main'], [
      attr('name', raw('local.acr_name')),
      attr('resource_group_name', raw('azurerm_resource_group.main.name')),
      attr('location', raw('azurerm_resource_group.main.location')),
      attr('sku', raw('var.acr_sku')),
      attr('admin_enabled', false),
    ]),
    block('resource', ['azurerm_user_assigned_identity', 'apps'], [
      attr('name', tpl('${local.name}-apps')),
      attr('resource_group_name', raw('azurerm_resource_group.main.name')),
      attr('location', raw('azurerm_resource_group.main.location')),
    ]),
    block('resource', ['azurerm_role_assignment', 'acr_pull'], [
      attr('scope', raw('azurerm_container_registry.main.id')),
      attr('role_definition_name', 'AcrPull'),
      attr('principal_id', raw('azurerm_user_assigned_identity.apps.principal_id')),
    ]),
    block('resource', ['azurerm_container_app_environment', 'main'], [
      attr('name', raw('local.name')),
      attr('location', raw('azurerm_resource_group.main.location')),
      attr('resource_group_name', raw('azurerm_resource_group.main.name')),
      attr('log_analytics_workspace_id', raw('azurerm_log_analytics_workspace.main.id')),
    ]),
  ];
  for (const s of model.services) blocks.push(appBlock(s, refs.get(s.name) ?? new Map(), model.services));
  return renderFile(blocks);
}

/** Only env values that point at an app with ingress can be expressed as a fqdn reference. */
function onlyIngressTargets(s: IacService, all: IacService[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(s.env)) {
    const m = /^[a-z][a-z0-9+.-]*:\/\/([a-z0-9][a-z0-9-]*)/.exec(val);
    const target = m ? all.find(x => x.name === m[1]) : undefined;
    if (target && !hasIngress(target)) continue; // keep literal (no fqdn to reference)
    out[k] = val;
  }
  return out;
}

function outputsFile(model: IacModel): string {
  const urls = model.services.filter(hasIngress);
  const blocks: Item[] = [
    block('output', ['resource_group_name'], [attr('description', 'Resource group holding every resource.'), attr('value', raw('azurerm_resource_group.main.name'))]),
    block('output', ['acr_login_server'], [attr('description', 'Container registry login server (push images here).'), attr('value', raw('azurerm_container_registry.main.login_server'))]),
  ];
  if (urls.length > 0) {
    blocks.push(
      block('output', ['app_urls'], [
        attr('description', 'HTTPS URL per service with ingress (internal apps are reachable only inside the environment).'),
        attr('value', Object.fromEntries(urls.map(s => [s.name, tpl(`https://\${azurerm_container_app.${s.label}.ingress[0].fqdn}`)]))),
      ])
    );
  }
  return renderFile(blocks);
}

/** Generate the Azure (Container Apps) Terraform files. */
export function generateAzure(model: IacModel): IacFile[] {
  return [
    { path: 'versions.tf', content: versionsFile() },
    { path: 'variables.tf', content: variablesFile(model) },
    { path: 'main.tf', content: mainFile(model) },
    { path: 'outputs.tf', content: outputsFile(model) },
  ];
}
