// AWS target: ECS Fargate behind an ALB, ECR repositories, IAM roles, log
// groups, Service Connect for service-to-service names, and app autoscaling.

import { attr, block, call, comment, hclTemplate, raw, renderFile, type Item } from './hcl';
import type { IacModel, IacService } from './model';

export interface IacFile {
  path: string;
  content: string;
}

export const AWS_PROVIDER_VERSION = '~> 5.0';

/** Valid Fargate cpu -> memory (MiB) steps. */
const FARGATE: Array<{ cpu: number; mem: number[] }> = [
  { cpu: 256, mem: [512, 1024, 2048] },
  { cpu: 512, mem: range(1024, 4096, 1024) },
  { cpu: 1024, mem: range(2048, 8192, 1024) },
  { cpu: 2048, mem: range(4096, 16384, 1024) },
  { cpu: 4096, mem: range(8192, 30720, 1024) },
];

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/** Round a requested cpu (millicores) / memory (MiB) up to a valid Fargate pair. */
export function fargateSize(cpuMillis: number | null, memoryMiB: number | null): { cpu: number; memory: number } {
  const wantCpu = cpuMillis ?? 256;
  const wantMem = memoryMiB ?? 512;
  for (const row of FARGATE) {
    if (row.cpu < wantCpu) continue;
    const mem = row.mem.find(m => m >= wantMem);
    if (mem !== undefined) return { cpu: row.cpu, memory: mem };
  }
  const top = FARGATE[FARGATE.length - 1];
  return { cpu: top.cpu, memory: top.mem[top.mem.length - 1] };
}

const tpl = (s: string) => raw(hclTemplate(s));

function defaultRegion(model: IacModel): string {
  const r = model.defaultRegion;
  return r && /^[a-z]{2}(-[a-z]+)+-\d$/.test(r) ? r : 'us-east-1';
}

function variablesFile(model: IacModel): string {
  const v = (name: string, items: Item[]): Item => block('variable', [name], items);
  return renderFile([
    v('project', [attr('description', 'Project name used as a prefix for every resource.'), attr('type', raw('string')), attr('default', model.project)]),
    v('environment', [attr('description', 'Environment name (dev, staging, prod).'), attr('type', raw('string')), attr('default', 'dev')]),
    v('region', [attr('description', 'AWS region to deploy into.'), attr('type', raw('string')), attr('default', defaultRegion(model))]),
    v('image_tags', [
      attr('description', 'Image tag per service name. Services missing from the map use default_image_tag.'),
      attr('type', raw('map(string)')),
      attr('default', {}),
    ]),
    v('default_image_tag', [attr('description', 'Image tag used when a service has no entry in image_tags.'), attr('type', raw('string')), attr('default', 'latest')]),
    v('desired_counts', [
      attr('description', 'Desired task count per service name (defaults to the workspace scaling.min).'),
      attr('type', raw('map(number)')),
      attr('default', {}),
    ]),
    v('vpc_id', [attr('description', 'Existing VPC id. Empty uses the default VPC.'), attr('type', raw('string')), attr('default', '')]),
    v('subnet_ids', [attr('description', 'Subnet ids for the ALB and tasks. Empty uses the subnets of the VPC.'), attr('type', raw('list(string)')), attr('default', [])]),
    v('assign_public_ip', [attr('description', 'Give tasks a public IP (needed in public subnets without NAT).'), attr('type', raw('bool')), attr('default', true)]),
    v('certificate_arn', [attr('description', 'ACM certificate ARN. When set an HTTPS listener is created.'), attr('type', raw('string')), attr('default', '')]),
    v('log_retention_days', [attr('description', 'CloudWatch log retention in days.'), attr('type', raw('number')), attr('default', 30)]),
    v('ecr_force_delete', [attr('description', 'Delete ECR repositories even when they contain images.'), attr('type', raw('bool')), attr('default', false)]),
  ]);
}

function versionsFile(): string {
  return renderFile([
    block('terraform', [], [
      attr('required_version', '>= 1.5.0'),
      block('required_providers', [], [
        attr('aws', { source: 'hashicorp/aws', version: AWS_PROVIDER_VERSION }),
      ]),
    ]),
    block('provider', ['aws'], [
      attr('region', raw('var.region')),
      block('default_tags', [], [
        attr('tags', { Project: raw('var.project'), Environment: raw('var.environment'), ManagedBy: 're-shell' }),
      ]),
    ]),
  ]);
}

function serviceBlocks(s: IacService, index: number, hasAlb: boolean): Item[] {
  const l = s.label;
  const size = fargateSize(s.cpuMillis, s.memoryMiB);
  const env = Object.entries(s.env).map(([name, value]) => ({ name, value }));
  const items: Item[] = [];

  items.push(
    comment(`${s.name}`),
    block('resource', ['aws_ecr_repository', l], [
      attr('name', tpl(`\${var.project}/${s.name}`)),
      attr('image_tag_mutability', 'MUTABLE'),
      attr('force_delete', raw('var.ecr_force_delete')),
      block('image_scanning_configuration', [], [attr('scan_on_push', true)]),
    ]),
    block('resource', ['aws_ecr_lifecycle_policy', l], [
      attr('repository', raw(`aws_ecr_repository.${l}.name`)),
      attr(
        'policy',
        call('jsonencode', {
          rules: [
            {
              rulePriority: 1,
              description: 'Keep the last 20 images',
              selection: { tagStatus: 'any', countType: 'imageCountMoreThan', countNumber: 20 },
              action: { type: 'expire' },
            },
          ],
        })
      ),
    ]),
    block('resource', ['aws_cloudwatch_log_group', l], [
      attr('name', tpl(`/ecs/\${local.name}/${s.name}`)),
      attr('retention_in_days', raw('var.log_retention_days')),
    ]),
    block('resource', ['aws_iam_role', `${l}_task`], [
      attr('name', raw(`substr(${hclTemplate(`\${local.name}-${s.name}-task`)}, 0, 64)`)),
      attr('assume_role_policy', raw('data.aws_iam_policy_document.ecs_tasks_assume.json')),
    ]),
    block('resource', ['aws_ecs_task_definition', l], [
      attr('family', tpl(`\${local.name}-${s.name}`)),
      attr('requires_compatibilities', ['FARGATE']),
      attr('network_mode', 'awsvpc'),
      attr('cpu', String(size.cpu)),
      attr('memory', String(size.memory)),
      attr('execution_role_arn', raw('aws_iam_role.task_execution.arn')),
      attr('task_role_arn', raw(`aws_iam_role.${l}_task.arn`)),
      attr(
        'container_definitions',
        call('jsonencode', [
          {
            name: s.name,
            image: tpl(`\${aws_ecr_repository.${l}.repository_url}:\${lookup(var.image_tags, ${JSON.stringify(s.name)}, var.default_image_tag)}`),
            essential: true,
            portMappings: [{ name: s.name, containerPort: s.port, protocol: 'tcp', appProtocol: 'http' }],
            environment: env,
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-group': raw(`aws_cloudwatch_log_group.${l}.name`),
                'awslogs-region': raw('var.region'),
                'awslogs-stream-prefix': 'ecs',
              },
            },
          },
        ])
      ),
    ])
  );

  if (hasAlb && s.exposed) {
    items.push(
      block('resource', ['aws_lb_target_group', l], [
        attr('name', raw(`trim(substr(${hclTemplate(`\${local.name}-${s.name}`)}, 0, 32), "-")`)),
        attr('port', s.port),
        attr('protocol', 'HTTP'),
        attr('target_type', 'ip'),
        attr('vpc_id', raw('local.vpc_id')),
        block('health_check', [], [
          attr('path', s.healthPath),
          attr('matcher', '200-399'),
          attr('interval', 30),
          attr('timeout', 5),
          attr('healthy_threshold', 2),
          attr('unhealthy_threshold', 3),
        ]),
      ]),
      block('resource', ['aws_lb_listener_rule', l], [
        attr('listener_arn', raw('aws_lb_listener.http.arn')),
        attr('priority', 100 + index),
        block('action', [], [attr('type', 'forward'), attr('target_group_arn', raw(`aws_lb_target_group.${l}.arn`))]),
        block('condition', [], [block('path_pattern', [], [attr('values', [`/${s.name}`, `/${s.name}/*`])])]),
      ]),
      block('resource', ['aws_lb_listener_rule', `${l}_https`], [
        attr('count', raw('var.certificate_arn != "" ? 1 : 0')),
        attr('listener_arn', raw('aws_lb_listener.https[0].arn')),
        attr('priority', 100 + index),
        block('action', [], [attr('type', 'forward'), attr('target_group_arn', raw(`aws_lb_target_group.${l}.arn`))]),
        block('condition', [], [block('path_pattern', [], [attr('values', [`/${s.name}`, `/${s.name}/*`])])]),
      ])
    );
  }

  const svcItems: Item[] = [
    attr('name', s.name),
    attr('cluster', raw('aws_ecs_cluster.main.id')),
    attr('task_definition', raw(`aws_ecs_task_definition.${l}.arn`)),
    attr('desired_count', raw(`lookup(var.desired_counts, ${JSON.stringify(s.name)}, ${s.minReplicas})`)),
    attr('launch_type', 'FARGATE'),
    block('network_configuration', [], [
      attr('subnets', raw('local.subnet_ids')),
      attr('security_groups', raw('[aws_security_group.service.id]')),
      attr('assign_public_ip', raw('var.assign_public_ip')),
    ]),
    block('service_connect_configuration', [], [
      attr('enabled', true),
      attr('namespace', raw('aws_service_discovery_http_namespace.main.arn')),
      block('service', [], [
        attr('port_name', s.name),
        block('client_alias', [], [attr('port', s.port), attr('dns_name', s.name)]),
      ]),
    ]),
  ];
  if (hasAlb && s.exposed) {
    svcItems.push(
      block('load_balancer', [], [
        attr('target_group_arn', raw(`aws_lb_target_group.${l}.arn`)),
        attr('container_name', s.name),
        attr('container_port', s.port),
      ]),
      attr('depends_on', raw(`[aws_lb_listener_rule.${l}]`))
    );
  }
  svcItems.push(block('lifecycle', [], [attr('ignore_changes', raw('[desired_count]'))]));
  items.push(
    block('resource', ['aws_ecs_service', l], svcItems),
    block('resource', ['aws_appautoscaling_target', l], [
      attr('service_namespace', 'ecs'),
      attr('scalable_dimension', 'ecs:service:DesiredCount'),
      attr('resource_id', raw(`"service/\${aws_ecs_cluster.main.name}/\${aws_ecs_service.${l}.name}"`)),
      attr('min_capacity', s.minReplicas),
      attr('max_capacity', s.maxReplicas),
    ]),
    block('resource', ['aws_appautoscaling_policy', `${l}_cpu`], [
      attr('name', tpl(`\${local.name}-${s.name}-cpu`)),
      attr('policy_type', 'TargetTrackingScaling'),
      attr('service_namespace', raw(`aws_appautoscaling_target.${l}.service_namespace`)),
      attr('scalable_dimension', raw(`aws_appautoscaling_target.${l}.scalable_dimension`)),
      attr('resource_id', raw(`aws_appautoscaling_target.${l}.resource_id`)),
      block('target_tracking_scaling_policy_configuration', [], [
        attr('target_value', 70),
        block('predefined_metric_specification', [], [attr('predefined_metric_type', 'ECSServiceAverageCPUUtilization')]),
      ]),
    ])
  );
  return items;
}

function mainFile(model: IacModel): string {
  const hasAlb = model.services.some(s => s.exposed);
  const blocks: Item[] = [
    block('data', ['aws_vpc', 'default'], [attr('count', raw('var.vpc_id == "" ? 1 : 0')), attr('default', true)]),
    block('data', ['aws_subnets', 'default'], [
      attr('count', raw('length(var.subnet_ids) == 0 ? 1 : 0')),
      block('filter', [], [attr('name', 'vpc-id'), attr('values', raw('[local.vpc_id]'))]),
    ]),
    block('locals', [], [
      attr('name', tpl('${var.project}-${var.environment}')),
      attr('vpc_id', raw('var.vpc_id != "" ? var.vpc_id : one(data.aws_vpc.default[*].id)')),
      attr('subnet_ids', raw('length(var.subnet_ids) > 0 ? var.subnet_ids : one(data.aws_subnets.default[*].ids)')),
    ]),
    block('resource', ['aws_ecs_cluster', 'main'], [
      attr('name', raw('local.name')),
      block('setting', [], [attr('name', 'containerInsights'), attr('value', 'enabled')]),
    ]),
    block('resource', ['aws_service_discovery_http_namespace', 'main'], [
      attr('name', raw('local.name')),
      attr('description', 'Service Connect namespace so services reach each other by name'),
    ]),
    block('data', ['aws_iam_policy_document', 'ecs_tasks_assume'], [
      block('statement', [], [
        attr('actions', ['sts:AssumeRole']),
        block('principals', [], [attr('type', 'Service'), attr('identifiers', ['ecs-tasks.amazonaws.com'])]),
      ]),
    ]),
    block('resource', ['aws_iam_role', 'task_execution'], [
      attr('name', raw('substr("${local.name}-task-execution", 0, 64)')),
      attr('assume_role_policy', raw('data.aws_iam_policy_document.ecs_tasks_assume.json')),
    ]),
    block('resource', ['aws_iam_role_policy_attachment', 'task_execution'], [
      attr('role', raw('aws_iam_role.task_execution.name')),
      attr('policy_arn', 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'),
    ]),
    block('resource', ['aws_security_group', 'service'], [
      attr('name', tpl('${local.name}-service')),
      attr('description', 'ECS tasks: traffic from the ALB and from other tasks'),
      attr('vpc_id', raw('local.vpc_id')),
      ...(hasAlb
        ? [
            block('ingress', [], [
              attr('description', 'From the load balancer'),
              attr('from_port', 0),
              attr('to_port', 65535),
              attr('protocol', 'tcp'),
              attr('security_groups', raw('[aws_security_group.alb.id]')),
            ]),
          ]
        : []),
      block('ingress', [], [
        attr('description', 'Between tasks (Service Connect)'),
        attr('from_port', 0),
        attr('to_port', 0),
        attr('protocol', '-1'),
        attr('self', true),
      ]),
      block('egress', [], [attr('from_port', 0), attr('to_port', 0), attr('protocol', '-1'), attr('cidr_blocks', ['0.0.0.0/0'])]),
    ]),
  ];

  if (hasAlb) {
    blocks.push(
      block('resource', ['aws_security_group', 'alb'], [
        attr('name', tpl('${local.name}-alb')),
        attr('description', 'Public HTTP/HTTPS to the load balancer'),
        attr('vpc_id', raw('local.vpc_id')),
        block('ingress', [], [attr('from_port', 80), attr('to_port', 80), attr('protocol', 'tcp'), attr('cidr_blocks', ['0.0.0.0/0'])]),
        block('ingress', [], [attr('from_port', 443), attr('to_port', 443), attr('protocol', 'tcp'), attr('cidr_blocks', ['0.0.0.0/0'])]),
        block('egress', [], [attr('from_port', 0), attr('to_port', 0), attr('protocol', '-1'), attr('cidr_blocks', ['0.0.0.0/0'])]),
      ]),
      block('resource', ['aws_lb', 'main'], [
        attr('name', raw('trim(substr(local.name, 0, 32), "-")')),
        attr('load_balancer_type', 'application'),
        attr('security_groups', raw('[aws_security_group.alb.id]')),
        attr('subnets', raw('local.subnet_ids')),
      ]),
      block('resource', ['aws_lb_listener', 'http'], [
        attr('load_balancer_arn', raw('aws_lb.main.arn')),
        attr('port', 80),
        attr('protocol', 'HTTP'),
        block('default_action', [], [
          attr('type', 'fixed-response'),
          block('fixed_response', [], [attr('content_type', 'text/plain'), attr('message_body', 'no route'), attr('status_code', '404')]),
        ]),
      ]),
      block('resource', ['aws_lb_listener', 'https'], [
        attr('count', raw('var.certificate_arn != "" ? 1 : 0')),
        attr('load_balancer_arn', raw('aws_lb.main.arn')),
        attr('port', 443),
        attr('protocol', 'HTTPS'),
        attr('ssl_policy', 'ELBSecurityPolicy-TLS13-1-2-2021-06'),
        attr('certificate_arn', raw('var.certificate_arn')),
        block('default_action', [], [
          attr('type', 'fixed-response'),
          block('fixed_response', [], [attr('content_type', 'text/plain'), attr('message_body', 'no route'), attr('status_code', '404')]),
        ]),
      ])
    );
  }

  let idx = 0;
  for (const s of model.services) {
    blocks.push(...serviceBlocks(s, idx, hasAlb));
    if (s.exposed) idx++;
  }
  return renderFile(blocks);
}

function outputsFile(model: IacModel): string {
  const hasAlb = model.services.some(s => s.exposed);
  const blocks: Item[] = [];
  if (hasAlb) {
    blocks.push(block('output', ['alb_dns_name'], [attr('description', 'Public DNS name of the load balancer.'), attr('value', raw('aws_lb.main.dns_name'))]));
  }
  blocks.push(
    block('output', ['cluster_name'], [attr('description', 'ECS cluster name.'), attr('value', raw('aws_ecs_cluster.main.name'))]),
    block('output', ['ecr_repository_urls'], [
      attr('description', 'ECR repository URL per service (push images here).'),
      attr('value', Object.fromEntries(model.services.map(s => [s.name, raw(`aws_ecr_repository.${s.label}.repository_url`)]))),
    ]),
    block('output', ['service_names'], [
      attr('description', 'ECS service name per service.'),
      attr('value', Object.fromEntries(model.services.map(s => [s.name, raw(`aws_ecs_service.${s.label}.name`)]))),
    ])
  );
  return renderFile(blocks);
}

/** Generate the AWS (ECS Fargate) Terraform files. */
export function generateAws(model: IacModel): IacFile[] {
  return [
    { path: 'versions.tf', content: versionsFile() },
    { path: 'variables.tf', content: variablesFile(model) },
    { path: 'main.tf', content: mainFile(model) },
    { path: 'outputs.tf', content: outputsFile(model) },
  ];
}
