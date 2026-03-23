// Auto-generated Cloud Resource Tagging and Lifecycle Management Utility
// Generated at: 2026-01-13T11:40:00.000Z

type ResourceType = 'ec2' | 's3' | 'rds' | 'lambda' | 'vm' | 'storage' | 'sql' | 'functions' | 'all';
type LifecycleState = 'active' | 'deprecated' | 'retired' | 'archived';
type TagCompliance = 'compliant' | 'non-compliant' | 'pending';

interface ResourceTag {
  key: string;
  value: string;
  required: boolean;
  enforceOnCreate: boolean;
}

interface TagPolicy {
  name: string;
  description: string;
  requiredTags: ResourceTag[];
  enforceCompliance: boolean;
  autoRemediation: boolean;
}

interface LifecycleRule {
  name: string;
  resourceType: ResourceType;
  transitionStates: {
    state: LifecycleState;
    trigger: string; // cron expression or event
    action: string;
  }[];
  retentionPeriodDays: number;
  notificationEnabled: boolean;
}

interface AutoTaggingConfig {
  enabled: boolean;
  rules: {
    resourceType: ResourceType;
    tags: { key: string; value: string }[];
  }[];
  enforceOnCreation: boolean;
  blockNonCompliant: boolean;
}

interface ResourceLifecycleConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  tagPolicy: TagPolicy;
  lifecycleRules: LifecycleRule[];
  autoTagging: AutoTaggingConfig;
  enableScheduling: boolean;
  schedule: string;
  notifications: {
    enabled: boolean;
    endpoints: string[];
    slackWebhook?: string;
  };
}

export function displayConfig(config: ResourceLifecycleConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Cloud Resource Tagging and Lifecycle Management with Automation');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Tag Policy:', config.tagPolicy.name);
  console.log('\x1b[33m%s\x1b[0m', 'Required Tags:', config.tagPolicy.requiredTags.length);
  console.log('\x1b[33m%s\x1b[0m', 'Enforce Compliance:', config.tagPolicy.enforceCompliance ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Lifecycle Rules:', config.lifecycleRules.length);
  console.log('\x1b[33m%s\x1b[0m', 'Auto Tagging:', config.autoTagging.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Scheduling:', config.enableScheduling ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateResourceLifecycleMD(config: ResourceLifecycleConfig): string {
  let md = '# Cloud Resource Tagging and Lifecycle Management\n\n';
  md += '## Features\n\n';
  md += '- Automated resource tagging with policies\n';
  md += '- Tag compliance enforcement and reporting\n';
  md += '- Lifecycle management with state transitions\n';
  md += '- Auto-remediation of non-compliant resources\n';
  md += '- Scheduled resource operations\n';
  md += '- Multi-cloud resource discovery and tagging\n';
  md += '- Cost allocation and chargeback support\n';
  md += '- Resource retirement and archival\n';
  md += '- Notification and alerting\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import { ResourceLifecycleManager } from \'./resource-lifecycle-manager\';\n\n';
  md += 'const manager = new ResourceLifecycleManager({\n';
  md += '  projectName: \'my-project\',\n';
  md += '  enforceCompliance: true,\n';
  md += '  autoTagging: true,\n';
  md += '});\n\n';
  md += 'await manager.applyTags();\n';
  md += 'await manager.checkCompliance();\n';
  md += '```\n\n';
  md += '## Tag Policy\n\n';
  md += '**Policy**: ' + config.tagPolicy.name + '\n\n';
  md += '### Required Tags\n\n';
  config.tagPolicy.requiredTags.forEach(tag => {
    md += `- **` + tag.key + `**: ` + tag.value + (tag.required ? ` (required)` : ` (optional)`) + `\n`;
  });
  md += '\n## Lifecycle Rules\n\n';
  config.lifecycleRules.forEach(rule => {
    md += '### ' + rule.name + '\n';
    md += '- **Resource Type**: ' + rule.resourceType + '\n';
    md += '- **Retention**: ' + rule.retentionPeriodDays + ' days\n';
    md += '- **Transitions**: ' + rule.transitionStates.length + ' states\n\n';
  });
  return md;
}

export function generateTerraformLifecycle(config: ResourceLifecycleConfig): string {
  let code = '# Auto-generated Resource Lifecycle Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';

  if (config.providers.includes('aws')) {
    code += '# AWS Tag Policy\n';
    code += 'resource "aws_tagging_policy" "main" {\n';
    code += '  name = "' + config.projectName + '-tag-policy"\n';
    code += '  description = "' + config.tagPolicy.description + '"\n\n';

    if (config.tagPolicy.requiredTags.length > 0) {
      code += '  tags = {\n';
      config.tagPolicy.requiredTags.forEach(tag => {
        code += '    ' + tag.key + ' = {\n';
        code += '      value = "' + tag.value + '"\n';
        code += '      required = ' + (tag.required ? 'true' : 'false') + '\n';
        code += '    }\n';
      });
      code += '  }\n';
    }
    code += '}\n\n';

    // S3 Lifecycle
    code += '# S3 Lifecycle Rule\n';
    code += 'resource "aws_s3_bucket_lifecycle_configuration" "main" {\n';
    code += '  bucket = aws_s3_bucket.main.id\n\n';
    code += '  rule {\n';
    code += '    id = "' + config.projectName + '-lifecycle"\n';
    code += '    status = "Enabled"\n\n';
    code += '    transition {\n';
    code += '      days          = 30\n';
    code += '      storage_class = "STANDARD_IA"\n';
    code += '    }\n\n';
    code += '    transition {\n';
    code += '      days          = 90\n';
    code += '      storage_class = "GLACIER"\n';
    code += '    }\n\n';
    code += '    expiration {\n';
    code += '      days = 365\n';
    code += '    }\n';
    code += '  }\n';
    code += '}\n\n';

    // EC2 Auto-tagging
    if (config.autoTagging.enabled) {
      code += '# EC2 Auto Tagging Lambda\n';
      code += 'resource "aws_lambda_function" "auto_tag" {\n';
      code += '  filename         = data.archive_file.lambda_zip.output_path\n';
      code += '  function_name    = "' + config.projectName + '-auto-tagger"\n';
      code += '  role            = aws_iam_role.lambda_role.arn\n';
      code += '  handler         = "index.handler"\n';
      code += '  runtime         = "python3.9"\n\n';
      code += '  environment {\n';
      code += '    variables = {\n';
      code += '      TAGS = ' + JSON.stringify(config.autoTagging.rules[0]?.tags || []) + '\n';
      code += '    }\n';
      code += '  }\n';
      code += '}\n\n';

      code += 'resource "aws_cloudwatch_event_rule" "ec2_creation" {\n';
      code += '  name        = "' + config.projectName + '-ec2-creation"\n';
      code += '  description = "Trigger on EC2 instance creation"\n\n';
      code += '  event_pattern = jsonencode({\n';
      code += '    source      = ["aws.ec2"]\n';
      code += '    "detail-type" = ["EC2 Instance State-change Notification"]\n';
      code += '    detail = {\n';
      code += '      state = ["running"]\n';
      code += '    }\n';
      code += '  })\n';
      code += '}\n\n';
    }
  }

  if (config.providers.includes('azure')) {
    code += '# Azure Resource Tags\n';
    code += 'resource "azurerm_resource_group" "main" {\n';
    code += '  name     = "' + config.projectName + '-rg"\n';
    code += '  location = "East US"\n\n';
    code += '  tags = {\n';
    config.tagPolicy.requiredTags.forEach(tag => {
      code += '    ' + tag.key + ' = "' + tag.value + '"\n';
    });
    code += '  }\n';
    code += '}\n\n';

    code += '# Azure Policy for Tag Enforcement\n';
    code += 'resource "azurerm_policy_definition" "tag_enforcement" {\n';
    code += '  name         = "' + config.projectName + '-tag-policy"\n';
    code += '  policy_type  = "Custom"\n';
    code += '  mode         = "Indexed"\n';
    code += '  display_name = "Enforce required tags"\n\n';
    code += '  policy_rule = <<POLICY_RULE\n';
    code += '{\n';
    code += '  "if": {\n';
    code += '    "allOf": [\n';
    code += '      {\n';
    code += '        "field": "type",\n';
    code += '        "in": ["Microsoft.Resources/subscriptions/resources"]\n';
    code += '      },\n';
    code += '      {\n';
    code += '        "not": {\n';
    code += '          "field": "[concat(\'tags\', \'\', \'' + config.tagPolicy.requiredTags[0]?.key || 'Environment' + '\', \'\')]",\n';
    code += '          "exists": "true"\n';
    code += '        }\n';
    code += '      }\n';
    code += '    ]\n';
    code += '  },\n';
    code += '  "then": {\n';
    code += '    "effect": "deny"\n';
    code += '  }\n';
    code += '}\n';
    code += 'POLICY_RULE\n';
    code += '}\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '# GCP Resource Manager Tags\n';
    code += 'resource "google_tags_tag_key" "environment" {\n';
    code += '  parent     = "projects/' + config.projectName + '"\n';
    code += '  short_name = "environment"\n';
    code += '  description = "Environment tag for resources"\n\n';
    code += '  purpose = "GCE_CONTAINER"\n';
    code += '  purpose_data = {\n';
    code += '    network = google_compute_network.main.id\n';
    code += '  }\n';
    code += '}\n\n';

    code += 'resource "google_tags_tag_value" "production" {\n';
    code += '  parent = google_tags_tag_key.environment.id\n';
    code += '  short_name = "production"\n';
    code += '  description = "Production environment"\n';
    code += '}\n\n';
  }

  return code;
}

export function generateTypeScriptLifecycle(config: ResourceLifecycleConfig): string {
  let code = '// Auto-generated Resource Lifecycle Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { Event EventEmitter } from \'events\';\n\n';

  code += 'interface Resource {\n';
  code += '  id: string;\n';
  code += '  type: string;\n';
  code += '  tags: Record<string, string>;\n';
  code += '  state: string;\n';
  code += '  createdAt: Date;\n';
  code += '}\n\n';

  code += 'class ResourceLifecycleManager extends EventEmitter {\n';
  code += '  private projectName: string;\n';
  code += '  private tagPolicy: any;\n';
  code += '  private lifecycleRules: any[];\n';
  code += '  private autoTagging: any;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.tagPolicy = options.tagPolicy || ' + JSON.stringify(config.tagPolicy) + ';\n';
  code += '    this.lifecycleRules = options.lifecycleRules || ' + JSON.stringify(config.lifecycleRules) + ';\n';
  code += '    this.autoTagging = options.autoTagging || ' + JSON.stringify(config.autoTagging) + ';\n';
  code += '  }\n\n';

  code += '  async applyTags(resources: Resource[]): Promise<any> {\n';
  code += '    console.log(\'[ResourceLifecycle] Applying tags to resources...\');\n\n';
  code += '    const results = {\n';
  code += '      timestamp: new Date().toISOString(),\n';
  code += '      total: resources.length,\n';
  code += '      tagged: 0,\n';
  code += '      failed: 0,\n';
  code += '      compliance: \'compliant\' as string,\n';
  code += '    };\n\n';

  if (config.autoTagging.enabled) {
    code += '    for (const resource of resources) {\n';
    code += '      try {\n';
    code += '        await this.tagResource(resource);\n';
    code += '        results.tagged++;\n';
    code += '      } catch (error) {\n';
    code += "        console.log('[ResourceLifecycle] Failed to tag resource:', error);\\n";
    code += '        results.failed++;\n';
    code += '      }\n';
    code += '    }\n';
  }

  code += "    console.log('[ResourceLifecycle] Tagged resources:', results.tagged, '/', results.total);\\n";
  code += '    this.emit(\'tags-applied\', results);\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  async checkCompliance(resources: Resource[]): Promise<any> {\n';
  code += '    console.log(\'[ResourceLifecycle] Checking tag compliance...\');\n\n';
  code += '    const nonCompliant = resources.filter(resource => {\n';
  code += '      return !this.isCompliant(resource);\n';
  code += '    });\n\n';
  code += '    const results = {\n';
  code += '      timestamp: new Date().toISOString(),\n';
  code += '      total: resources.length,\n';
  code += '      compliant: resources.length - nonCompliant.length,\n';
  code += '      nonCompliant: nonCompliant.length,\n';
  code += '      complianceRate: ((resources.length - nonCompliant.length) / resources.length * 100).toFixed(2) + \'%\',\n';
  code += '    };\n\n';

  if (config.tagPolicy.autoRemediation) {
    code += '    if (nonCompliant.length > 0) {\n';
    code += "      console.log('[ResourceLifecycle] Auto-remediating non-compliant resources:', nonCompliant.length);\n";
    code += '      await this.remediate(nonCompliant);\n';
    code += '    }\n';
  }

  code += '    this.emit(\'compliance-check\', results);\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  private async tagResource(resource: Resource): Promise<void> {\n';
  code += '    const tags = this.tagPolicy.requiredTags;\n';
  code += '    for (const tag of tags) {\n';
  code += '      resource.tags[tag.key] = tag.value;\n';
  code += '    }\n';
  code += '    // Resource tagging logic\n';
  code += '  }\n\n';

  code += '  private isCompliant(resource: Resource): boolean {\n';
  code += '    const requiredTags = this.tagPolicy.requiredTags.filter((t: any) => t.required);\n';
  code += '    return requiredTags.every((tag: any) => resource.tags[tag.key] === tag.value);\n';
  code += '  }\n\n';

  code += '  private async remediate(resources: Resource[]): Promise<void> {\n';
  code += '    for (const resource of resources) {\n';
  code += '      await this.tagResource(resource);\n';
  code += "      console.log('[ResourceLifecycle] Remediated resource:', resource.id);\\n";
  code += '    }\n';
  code += '  }\n\n';

  code += '  async transitionState(resourceId: string, newState: string): Promise<any> {\n';
  code += "    console.log('[ResourceLifecycle] Transitioning resource:', resourceId, 'to', newState);\\n";
  code += '    return { resourceId, newState, timestamp: new Date().toISOString() };\n';
  code += '  }\n\n';

  code += '  getPolicyStatus(): any {\n';
  code += '    return {\n';
  code += '      projectName: this.projectName,\n';
  code += '      tagPolicy: this.tagPolicy.name,\n';
  code += '      requiredTags: this.tagPolicy.requiredTags.length,\n';
  code += '      lifecycleRules: this.lifecycleRules.length,\n';
  code += '      autoTaggingEnabled: this.autoTagging.enabled,\n';
  code += '      enforceCompliance: this.tagPolicy.enforceCompliance,\n';
  code += '    };\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const resourceLifecycleManager = new ResourceLifecycleManager();\n\n';
  code += 'export default resourceLifecycleManager;\n';
  code += 'export { ResourceLifecycleManager };\n';

  return code;
}

export function generatePythonLifecycle(config: ResourceLifecycleConfig): string {
  let code = '# Auto-generated Resource Lifecycle Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import List, Dict, Any\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from enum import Enum\n\n';

  code += 'class LifecycleState(Enum):\n';
  code += '    ACTIVE = "active"\n';
  code += '    DEPRECATED = "deprecated"\n';
  code += '    RETIRED = "retired"\n';
  code += '    ARCHIVED = "archived"\n\n';

  code += '@dataclass\n';
  code += 'class Resource:\n';
  code += '    id: str\n';
  code += '    type: str\n';
  code += '    tags: Dict[str, str]\n';
  code += '    state: str\n';
  code += '    created_at: str\n\n';

  code += 'class ResourceLifecycleManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.tag_policy = ' + JSON.stringify(config.tagPolicy) + '\n';
  code += '        self.lifecycle_rules = ' + JSON.stringify(config.lifecycleRules) + '\n';
  code += '        self.auto_tagging = ' + JSON.stringify(config.autoTagging) + '\n\n';

  code += '    async def apply_tags(self, resources: List[Resource]) -> Dict[str, Any]:\n';
  code += '        print("[ResourceLifecycle] Applying tags to resources...")\n\n';
  code += '        results = {\n';
  code += '            "timestamp": "2026-01-13T00:00:00Z",\n';
  code += '            "total": len(resources),\n';
  code += '            "tagged": 0,\n';
  code += '            "failed": 0,\n';
  code += '            "compliance": "compliant",\n';
  code += '        }\n\n';

  if (config.autoTagging.enabled) {
    code += '        for resource in resources:\n';
    code += '            try:\n';
    code += '                await self.tag_resource(resource)\n';
    code += '                results["tagged"] += 1\n';
    code += '            except Exception as error:\n';
    code += '                print(f"[ResourceLifecycle] Failed to tag {resource.id}: {error}")\n';
    code += '                results["failed"] += 1\n';
  }

  code += '        print(f"[ResourceLifecycle] Tagged {results[\'tagged\']}/{results[\'total\']} resources")\n';
  code += '        return results\n\n';

  code += '    async def check_compliance(self, resources: List[Resource]) -> Dict[str, Any]:\n';
  code += '        print("[ResourceLifecycle] Checking tag compliance...")\n\n';
  code += '        non_compliant = [r for r in resources if not self.is_compliant(r)]\n\n';
  code += '        results = {\n';
  code += '            "timestamp": "2026-01-13T00:00:00Z",\n';
  code += '            "total": len(resources),\n';
  code += '            "compliant": len(resources) - len(non_compliant),\n';
  code += '            "nonCompliant": len(non_compliant),\n';
  code += '            "complianceRate": f"{(len(resources) - len(non_compliant)) / len(resources) * 100:.2f}%",\n';
  code += '        }\n\n';

  if (config.tagPolicy.autoRemediation) {
    code += '        if len(non_compliant) > 0:\n';
    code += '            print(f"[ResourceLifecycle] Auto-remediating {len(non_compliant)} non-compliant resources...")\n';
    code += '            await self.remediate(non_compliant)\n';
  }

  code += '        return results\n\n';

  code += '    async def tag_resource(self, resource: Resource) -> None:\n';
  code += '        tags = self.tag_policy.get("requiredTags", [])\n';
  code += '        for tag in tags:\n';
  code += '            resource.tags[tag["key"]] = tag["value"]\n\n';

  code += '    def is_compliant(self, resource: Resource) -> bool:\n';
  code += '        required_tags = [t for t in self.tag_policy.get("requiredTags", []) if t.get("required", False)]\n';
  code += '        return all(resource.tags.get(t["key"]) == t["value"] for t in required_tags)\n\n';

  code += '    async def remediate(self, resources: List[Resource]) -> None:\n';
  code += '        for resource in resources:\n';
  code += '            await self.tag_resource(resource)\n';
  code += '            print(f"[ResourceLifecycle] Remediated resource {resource.id}")\n\n';

  code += '    async def transition_state(self, resource_id: str, new_state: str) -> Dict[str, Any]:\n';
  code += '        print(f"[ResourceLifecycle] Transitioning {resource_id} to {new_state}")\n';
  code += '        return {"resourceId": resource_id, "newState": new_state, "timestamp": "2026-01-13T00:00:00Z"}\n\n';

  code += '    def get_policy_status(self) -> Dict[str, Any]:\n';
  code += '        return {\n';
  code += '            "projectName": self.project_name,\n';
  code += '            "tagPolicy": self.tag_policy.get("name"),\n';
  code += '            "requiredTags": len(self.tag_policy.get("requiredTags", [])),\n';
  code += '            "lifecycleRules": len(self.lifecycle_rules),\n';
  code += '            "autoTaggingEnabled": self.auto_tagging.get("enabled", False),\n';
  code += '            "enforceCompliance": self.tag_policy.get("enforceCompliance", False),\n';
  code += '        }\n\n';

  code += 'resource_lifecycle_manager = ResourceLifecycleManager()\n';

  return code;
}

export async function writeFiles(config: ResourceLifecycleConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Terraform config
  const terraformCode = generateTerraformLifecycle(config);
  await fs.writeFile(path.join(outputDir, 'resource-lifecycle.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptLifecycle(config);
    await fs.writeFile(path.join(outputDir, 'resource-lifecycle-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-resource-lifecycle',
      version: '1.0.0',
      description: 'Cloud Resource Tagging and Lifecycle Management with Automation',
      main: 'resource-lifecycle-manager.ts',
      scripts: {
        'apply-tags': 'ts-node resource-lifecycle-manager.ts apply-tags',
        'check-compliance': 'ts-node resource-lifecycle-manager.ts check-compliance',
        'transition': 'ts-node resource-lifecycle-manager.ts transition',
      },
      dependencies: {
        '@types/node': '^20.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        'ts-node': '^10.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonLifecycle(config);
    await fs.writeFile(path.join(outputDir, 'resource_lifecycle_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'boto3>=1.28.0',
      'azure-identity>=1.13.0',
      'google-cloud-asset>=3.0.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateResourceLifecycleMD(config);
  await fs.writeFile(path.join(outputDir, 'RESOURCE_LIFECYCLE.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    tagPolicy: config.tagPolicy,
    lifecycleRules: config.lifecycleRules,
    autoTagging: config.autoTagging,
    enableScheduling: config.enableScheduling,
    schedule: config.schedule,
    notifications: config.notifications,
  };
  await fs.writeFile(path.join(outputDir, 'lifecycle-config.json'), JSON.stringify(configJson, null, 2));
}

export function resourceLifecycle(config: ResourceLifecycleConfig): ResourceLifecycleConfig {
  return config;
}
