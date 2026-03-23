// Auto-generated Serverless Function Deployment Utility
// Generated at: 2026-01-13T10:52:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type Runtime = 'nodejs20.x' | 'python3.11' | 'python3.10' | 'go1.x' | 'java21' | 'dotnet8';
type TriggerType = 'http' | 'event' | 'scheduled' | 'storage' | 'queue' | 'database';

interface AWSLambdaConfig {
  memorySize: number;
  timeout: number;
  ephemeralStorage?: number;
  architecture: 'x86_64' | 'arm64';
  snapStart: boolean;
  provisionedConcurrency?: number;
  reservedConcurrency?: number;
  deadLetterQueueEnabled: boolean;
  tracingMode: 'Active' | 'PassThrough';
}

interface AzureFunctionConfig {
  runtime: string;
  functionAppScaleLimit?: number;
  alwaysOn: boolean;
  http20Only: boolean;
  clientAffinityEnabled: boolean;
  vnetIntegration: boolean;
  siteConfig: {
    appSettings: Record<string, string>;
    cors: {
      allowedOrigins: string[];
      supportedMethods: string[];
    };
  };
}

interface GCPFunctionConfig {
  memoryMB: number;
  timeout: string;
  maxInstances: number;
  minInstances: number;
  availableCpu: string;
  environmentVariables: Record<string, string>;
  vpcConnector: string;
  ingressSettings: 'ALLOW_ALL' | 'ALLOW_INTERNAL_ONLY' | 'ALLOW_INTERNAL_AND_GCLB';
  serviceAccountEmail: string;
}

interface TriggerConfig {
  type: TriggerType;
  httpPath?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  scheduleExpression?: string;
  eventSource?: string;
  authentication?: 'none' | 'apiKey' | 'oauth2' | 'jwt';
}

interface MonitoringConfig {
  enabled: boolean;
  cloudWatchLogs?: boolean;
  applicationInsights?: boolean;
  cloudLogging?: boolean;
  alertsEnabled: boolean;
}

interface ServerlessConfig {
  projectName: string;
  functionName: string;
  runtime: Runtime;
  handler: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  triggers: TriggerConfig[];
  aws?: AWSLambdaConfig;
  azure?: AzureFunctionConfig;
  gcp?: GCPFunctionConfig;
  monitoring: MonitoringConfig;
}

export function displayConfig(config: ServerlessConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Serverless Function Deployment (Lambda, Azure Functions, Cloud Functions)');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Function Name:', config.functionName);
  console.log('\x1b[33m%s\x1b[0m', 'Runtime:', config.runtime);
  console.log('\x1b[33m%s\x1b[0m', 'Handler:', config.handler);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Triggers:', config.triggers.map(t => t.type).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Monitoring:', config.monitoring.enabled ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateServerlessMD(config: ServerlessConfig): string {
  let md = '# Serverless Function Deployment\n\n';
  md += '## Features\n\n';
  md += '- AWS Lambda with support for multiple runtimes\n';
  md += '- Azure Functions with HTTP triggers and event grid\n';
  md += '- GCP Cloud Functions with 2nd gen support\n';
  md += '- Multiple trigger types: HTTP, Event, Scheduled, Storage, Queue, Database\n';
  md += '- Auto-scaling and provisioned concurrency\n';
  md += '- VPC integration and private endpoints\n';
  md += '- Monitoring and logging integration\n';
  md += '- Dead letter queues for error handling\n';
  md += '- SnapStart for cold start optimization\n';
  md += '- Multi-cloud deployment support\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import { ServerlessManager } from \'./serverless-manager\';\n\n';
  md += 'const manager = new ServerlessManager({\n';
  md += '  projectName: \'my-project\',\n';
  md += '  functionName: \'my-function\',\n';
  md += '  runtime: \'nodejs20.x\',\n';
  md += '  providers: [\'aws\', \'azure\', \'gcp\'],\n';
  md += '  triggers: [{ type: \'http\', httpPath: \'/api/hello\' }],\n';
  md += '});\n\n';
  md += 'await manager.deploy();\n';
  md += '```\n\n';
  return md;
}

export function generateTerraformServerless(config: ServerlessConfig): string {
  let code = '# Auto-generated Serverless Functions Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';

  if (config.providers.includes('aws') && config.aws) {
    code += '# AWS Lambda Function\n';
    code += 'resource "aws_lambda_function" "main" {\n';
    code += '  filename = data.archive_file.lambda.output_path\n';
    code += '  function_name = "' + config.functionName + '"\n';
    code += '  role = aws_iam_role.lambda.arn\n';
    code += '  handler = "' + config.handler + '"\n';
    code += '  runtime = "' + config.runtime + '"\n';
    code += '  memory_size = ' + config.aws.memorySize + '\n';
    code += '  timeout = ' + config.aws.timeout + '\n';
    code += '  architectures = ["' + config.aws.architecture + '"]\n';
    code += '  ephemeral_storage {\n';
    code += '    size = ' + (config.aws.ephemeralStorage || 512) + '\n';
    code += '  }\n';
    if (config.aws.snapStart) {
      code += '  snap_start {\n';
      code += '    apply_on = "PublishedVersions"\n';
      code += '  }\n';
    }
    if (config.aws.reservedConcurrency !== undefined) {
      code += '  reserved_concurrent_executions = ' + config.aws.reservedConcurrency + '\n';
    }
    if (config.aws.provisionedConcurrency !== undefined) {
      code += '  provisioned_concurrent_executions {\n';
      code += '    provisioned_concurrent_executions = ' + config.aws.provisionedConcurrency + '\n';
      code += '  }\n';
    }
    code += '  tracing_config {\n';
    code += '    mode = "' + config.aws.tracingMode + '"\n';
    code += '  }\n';
    code += '  environment {\n';
    code += '    variables = {\n';
    code += '      ENVIRONMENT = "production"\n';
    code += '      LOG_LEVEL = "info"\n';
    code += '    }\n';
    code += '  }\n';
    code += '}\n\n';

    code += 'data "archive_file" "lambda" {\n';
    code += '  type = "zip"\n';
    code += '  source_file = "' + config.handler.split('.')[0] + '.js"\n';
    code += '  output_path = "' + config.functionName + '.zip"\n';
    code += '}\n\n';

    code += 'resource "aws_iam_role" "lambda" {\n';
    code += '  name = "' + config.functionName + '-role"\n';
    code += '  assume_role_policy = data.aws_iam_policy_document.assume_role.json\n';
    code += '}\n\n';

    code += 'data "aws_iam_policy_document" "assume_role" {\n';
    code += '  statement {\n';
    code += '    actions = ["sts:AssumeRole"]\n\n';
    code += '    principals {\n';
    code += '      type = "Service"\n';
    code += '      identifiers = ["lambda.amazonaws.com"]\n';
    code += '    }\n';
    code += '  }\n';
    code += '}\n\n';

    config.triggers.forEach((trigger, index) => {
      if (trigger.type === 'http') {
        code += '# HTTP Trigger ' + (index + 1) + '\n';
        code += 'resource "aws_apigatewayv2_api" "http' + index + '" {\n';
        code += '  name = "' + config.functionName + '-http' + index + '"\n';
        code += '  protocol_type = "HTTP"\n';
        code += '  target = aws_lambda_function.main.arn\n';
        code += '}\n\n';

        code += 'resource "aws_lambda_permission" "http' + index + '" {\n';
        code += '  statement_id = "AllowAPIGatewayInvoke' + index + '"\n';
        code += '  action = "lambda:InvokeFunction"\n';
        code += '  function_name = aws_lambda_function.main.function_name\n';
        code += '  principal = "apigateway.amazonaws.com"\n';
        code += '}\n\n';
      } else if (trigger.type === 'scheduled' && trigger.scheduleExpression) {
        code += '# Scheduled Trigger ' + (index + 1) + '\n';
        code += 'resource "aws_cloudwatch_event_rule" "schedule' + index + '" {\n';
        code += '  name = "' + config.functionName + '-schedule' + index + '"\n';
        code += '  schedule_expression = "' + trigger.scheduleExpression + '"\n';
        code += '}\n\n';

        code += 'resource "aws_cloudwatch_event_target" "schedule' + index + '" {\n';
        code += '  rule = aws_cloudwatch_event_rule.schedule' + index + '.name\n';
        code += '  target_id = "' + config.functionName + '"\n';
        code += '  arn = aws_lambda_function.main.arn\n';
        code += '}\n\n';

        code += 'resource "aws_lambda_permission" "schedule' + index + '" {\n';
        code += '  statement_id = "AllowExecutionFromCloudWatch' + index + '"\n';
        code += '  action = "lambda:InvokeFunction"\n';
        code += '  function_name = aws_lambda_function.main.function_name\n';
        code += '  principal = "events.amazonaws.com"\n';
        code += '  source_arn = aws_cloudwatch_event_rule.schedule' + index + '.arn\n';
        code += '}\n\n';
      }
    });
  }

  if (config.providers.includes('azure') && config.azure) {
    code += '# Azure Function App\n';
    code += 'resource "azurerm_function_app" "main" {\n';
    code += '  name = "' + config.functionName + '-func"\n';
    code += '  location = azurerm_resource_group.main.location\n';
    code += '  resource_group_name = azurerm_resource_group.main.name\n';
    code += '  app_service_plan_id = azurerm_service_plan.main.id\n';
    code += '  storage_account_name = azurerm_storage_account.main.name\n';
    code += '  storage_account_access_key = azurerm_storage_account.main.primary_access_key\n';
    code += '  os_type = "linux"\n';
    code += '  version = "~4"\n\n';

    config.triggers.forEach((trigger, index) => {
      if (trigger.type === 'http') {
        code += '  site_config {\n';
        code += '    cors {\n';
        code += '      allowed_origins = ' + JSON.stringify(config.azure.siteConfig.cors.allowedOrigins) + '\n';
        code += '      supported_methods = ' + JSON.stringify(config.azure.siteConfig.cors.supportedMethods) + '\n';
        code += '    }\n';
        code += '  }\n\n';
      }
    });

    code += '  app_settings = {\n';
    code += '    "FUNCTIONS_WORKER_RUNTIME" = "' + config.azure.runtime + '"\n';
    code += '    "WEBSITE_RUN_FROM_PACKAGE" = "1"\n';
    Object.entries(config.azure.siteConfig.appSettings).forEach(([key, value]) => {
      code += '    "' + key + '" = "' + value + '"\n';
    });
    code += '  }\n';
    code += '}\n\n';

    code += 'resource "azurerm_service_plan" "main" {\n';
    code += '  name = "' + config.functionName + '-asp"\n';
    code += '  location = azurerm_resource_group.main.location\n';
    code += '  resource_group_name = azurerm_resource_group.main.name\n';
    code += '  os_type = "Linux"\n';
    code += '  sku_name = "Y1"\n';
    if (config.azure.functionAppScaleLimit) {
      code += '  maximum_elastic_instance_count = ' + config.azure.functionAppScaleLimit + '\n';
    }
    code += '}\n\n';
  }

  if (config.providers.includes('gcp') && config.gcp) {
    code += '# GCP Cloud Function (2nd Gen)\n';
    code += 'resource "google_cloudfunctions2_function" "main" {\n';
    code += '  name = "' + config.functionName + '"\n';
    code += '  location = "us-central1"\n';
    code += '  description = "' + config.projectName + ' serverless function"\n\n';

    code += '  build_config {\n';
    code += '    runtime = "' + config.runtime.replace('.x', '') + '"\n';
    code += '    entry_point = "' + config.handler.split('.')[0] + '"\n';
    code += '    source {\n';
    code += '      storage_source {\n';
    code += '        bucket = google_storage_bucket.bucket.name\n';
    code += '        object = google_storage_bucket_object.source.name\n';
    code += '      }\n';
    code += '    }\n';
    code += '  }\n\n';

    code += '  service_config {\n';
    code += '    max_instance_count = ' + config.gcp.maxInstances + '\n';
    code += '    min_instance_count = ' + config.gcp.minInstances + '\n';
    code += '    available_memory = "' + config.gcp.memoryMB + 'M"\n';
    code += '    available_cpu = "' + config.gcp.availableCpu + '"\n';
    code += '    timeout_seconds = ' + parseInt(config.gcp.timeout) + '\n';
    code += '    environment_variables = ' + JSON.stringify(config.gcp.environmentVariables) + '\n';
    code += '    ingress_settings = "' + config.gcp.ingressSettings + '"\n';
    code += '    service_account_email = ' + (config.gcp.serviceAccountEmail ? `"${config.gcp.serviceAccountEmail}"` : 'google_compute_default_service_account.email') + '\n';
    code += '  }\n\n';

    code += '  event_trigger {\n';
    code += '    trigger_region = "us-central1"\n';
    code += '    event_type = "google.cloud.storage.object.v1.finalized"\n';
    code += '    retry_policy = "RETRY_POLICY_RETRY"\n';
    code += '  }\n\n';

    code += '}\n\n';
  }

  return code;
}

export function generateTypeScriptServerless(config: ServerlessConfig): string {
  let code = '// Auto-generated Serverless Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import { EventEmitter } from \'events\';\n\n';

  code += 'class ServerlessManager extends EventEmitter {\n';
  code += '  private projectName: string;\n';
  code += '  private functionName: string;\n';
  code += '  private runtime: string;\n';
  code += '  private providers: string[];\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.functionName = options.functionName || \'' + config.functionName + '\';\n';
  code += '    this.runtime = options.runtime || \'' + config.runtime + '\';\n';
  code += '    this.providers = options.providers || ' + JSON.stringify(config.providers) + ';\n';
  code += '  }\n\n';

  if (config.providers.includes('aws')) {
    code += '  async deployToAWS(): Promise<void> {\n';
    code += '    console.log(\'[Serverless] Deploying to AWS Lambda...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -var="function=' + config.functionName + '" \\\n';
    code += '      -var="runtime=' + config.runtime + '" \\\n';
    code += '      -target=aws_lambda_function.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[Serverless] ✓ AWS Lambda deployed\');\n';
    code += '      this.emit(\'deployed\', \'aws\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[Serverless] ✗ AWS Lambda deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  if (config.providers.includes('azure')) {
    code += '  async deployToAzure(): Promise<void> {\n';
    code += '    console.log(\'[Serverless] Deploying to Azure Functions...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -var="function=' + config.functionName + '" \\\n';
    code += '      -target=azurerm_function_app.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[Serverless] ✓ Azure Functions deployed\');\n';
    code += '      this.emit(\'deployed\', \'azure\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[Serverless] ✗ Azure Functions deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '  async deployToGCP(): Promise<void> {\n';
    code += '    console.log(\'[Serverless] Deploying to GCP Cloud Functions...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -var="function=' + config.functionName + '" \\\n';
    code += '      -target=google_cloudfunctions2_function.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[Serverless] ✓ GCP Cloud Functions deployed\');\n';
    code += '      this.emit(\'deployed\', \'gcp\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[Serverless] ✗ GCP Cloud Functions deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[Serverless] Starting serverless deployment...\');\n\n';
  code += '    const deployments = this.providers.map(async (provider) => {\n';
  code += '      if (provider === \'aws\') await this.deployToAWS();\n';
  code += '      if (provider === \'azure\') await this.deployToAzure();\n';
  code += '      if (provider === \'gcp\') await this.deployToGCP();\n';
  code += '    });\n\n';
  code += '    await Promise.all(deployments);\n';
  code += '    console.log(\'[Serverless] ✓ All functions deployed\');\n';
  code += '  }\n\n';

  code += '  getFunctionUrl(provider: string, httpPath?: string): string {\n';
  code += '    switch (provider) {\n';
  code += '      case \'aws\':\n';
  code += '        return `https://${this.functionName}.execute-api.us-east-1.amazonaws.com/prod`;\n';
  code += '      case \'azure\':\n';
  code += '        return `https://${this.functionName}-func.azurewebsites.net/api`;\n';
  code += '      case \'gcp\':\n';
  code += '        return `https://${this.functionName}-{RANDOM}.us-central1.cloudfunctions.net`;\n';
  code += '      default:\n';
  code += '        throw new Error(`Unknown provider: ${provider}`);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const serverlessManager = new ServerlessManager();\n\n';
  code += 'export default serverlessManager;\n';
  code += 'export { ServerlessManager };\n';

  return code;
}

export function generatePythonServerless(config: ServerlessConfig): string {
  let code = '# Auto-generated Serverless Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import asyncio\n';
  code += 'from typing import List, Optional\n\n';

  code += 'class ServerlessManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '", function_name: str = "' + config.functionName + '"):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.function_name = function_name\n';
  code += '        self.runtime = "' + config.runtime + '"\n';
  code += '        self.providers = ' + JSON.stringify(config.providers) + '\n\n';

  if (config.providers.includes('aws')) {
    code += '    async def deploy_to_aws(self) -> None:\n';
    code += '        print("[Serverless] Deploying to AWS Lambda...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-var=function=' + config.functionName + '",\n';
    code += '            "-var=runtime=' + config.runtime + '",\n';
    code += '            "-target=aws_lambda_function.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[Serverless] ✓ AWS Lambda deployed")\n\n';
  }

  if (config.providers.includes('azure')) {
    code += '    async def deploy_to_azure(self) -> None:\n';
    code += '        print("[Serverless] Deploying to Azure Functions...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-var=function=' + config.functionName + '",\n';
    code += '            "-target=azurerm_function_app.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[Serverless] ✓ Azure Functions deployed")\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '    async def deploy_to_gcp(self) -> None:\n';
    code += '        print("[Serverless] Deploying to GCP Cloud Functions...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-var=function=' + config.functionName + '",\n';
    code += '            "-target=google_cloudfunctions2_function.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[Serverless] ✓ GCP Cloud Functions deployed")\n\n';
  }

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[Serverless] Starting serverless deployment...")\n\n';
  code += '        tasks = []\n';
  code += '        for provider in self.providers:\n';
  code += '            if provider == "aws":\n';
  code += '                tasks.append(self.deploy_to_aws())\n';
  code += '            elif provider == "azure":\n';
  code += '                tasks.append(self.deploy_to_azure())\n';
  code += '            elif provider == "gcp":\n';
  code += '                tasks.append(self.deploy_to_gcp())\n\n';
  code += '        await asyncio.gather(*tasks)\n';
  code += '        print("[Serverless] ✓ All functions deployed")\n\n';

  code += '    def get_function_url(self, provider: str) -> str:\n';
  code += '        if provider == "aws":\n';
  code += '            return f"https://' + config.functionName + '.execute-api.us-east-1.amazonaws.com/prod"\n';
  code += '        elif provider == "azure":\n';
  code += '            return f"https://' + config.functionName + '-func.azurewebsites.net/api"\n';
  code += '        elif provider == "gcp":\n';
  code += '            return f"https://{self.function_name}-{RANDOM}.us-central1.cloudfunctions.net"\n';
  code += '        else:\n';
  code += '            raise ValueError(f"Unknown provider: {provider}")\n\n';

  code += 'serverless_manager = ServerlessManager()\n';

  return code;
}

export async function writeFiles(config: ServerlessConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Terraform config
  const terraformCode = generateTerraformServerless(config);
  await fs.writeFile(path.join(outputDir, 'serverless.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptServerless(config);
    await fs.writeFile(path.join(outputDir, 'serverless-manager.ts'), tsCode);

    // Generate sample function
    const sampleFunction = `// Sample ${config.runtime} handler for ${config.functionName}
export const handler = async (event: any, context: any) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const response = {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Hello from ${config.functionName}!',
      input: event,
    }),
  };

  return response;
};
`;
    await fs.writeFile(path.join(outputDir, 'handler.ts'), sampleFunction);

    const packageJson = {
      name: config.projectName + '-serverless',
      version: '1.0.0',
      description: 'Serverless Function Deployment',
      main: 'serverless-manager.ts',
      scripts: {
        deploy: 'terraform apply -auto-approve',
        package: 'serverless package',
      },
      dependencies: {
        '@types/node': '^20.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        serverless: '^3.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonServerless(config);
    await fs.writeFile(path.join(outputDir, 'serverless_manager.py'), pyCode);

    // Generate sample function
    const sampleFunction = `# Sample Python handler for ${config.functionName}
import json

def handler(event, context):
    print('Event:', json.dumps(event, indent=2))

    response = {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
        },
        'body': json.dumps({
            'message': 'Hello from ${config.functionName}!',
            'input': event,
        })
    }

    return response
`;
    await fs.writeFile(path.join(outputDir, 'handler.py'), sampleFunction);

    const requirements = [
      'asyncio>=3.4.3',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateServerlessMD(config);
  await fs.writeFile(path.join(outputDir, 'SERVERLESS.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    functionName: config.functionName,
    runtime: config.runtime,
    handler: config.handler,
    providers: config.providers,
    triggers: config.triggers,
    monitoring: config.monitoring,
  };
  await fs.writeFile(path.join(outputDir, 'serverless-config.json'), JSON.stringify(configJson, null, 2));
}
