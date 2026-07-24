import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateServerlessMD,
  generateTerraformServerless,
  generateTypeScriptServerless,
  generatePythonServerless,
  writeFiles,
} from '../../src/utils/serverless-functions';

/**
 * Unit tests for the auto-generated serverless function deployment utility.
 * Covers displayConfig, MD/Terraform/TS/Python codegen, provider filtering,
 * conditional Terraform branches (snapStart, concurrency, triggers), and
 * writeFiles for both TypeScript and Python language bundles.
 */

const baseConfig: any = {
  projectName: 'sls-app',
  functionName: 'processOrder',
  runtime: 'nodejs20.x',
  handler: 'handler.processOrder',
  providers: ['aws', 'azure', 'gcp'],
  triggers: [
    { type: 'http', httpPath: '/orders', httpMethod: 'POST', authentication: 'jwt' },
    { type: 'scheduled', scheduleExpression: 'rate(5 minutes)' },
    { type: 'event', eventSource: 'sns' },
  ],
  aws: {
    memorySize: 512,
    timeout: 30,
    architecture: 'arm64',
    snapStart: false,
    deadLetterQueueEnabled: true,
    tracingMode: 'Active',
  },
  azure: {
    runtime: 'node',
    functionAppScaleLimit: 5,
    alwaysOn: true,
    http20Only: false,
    clientAffinityEnabled: false,
    vnetIntegration: false,
    siteConfig: {
      appSettings: { APP_SETTING_KEY: 'app-setting-value' },
      cors: {
        allowedOrigins: ['https://example.com'],
        supportedMethods: ['GET', 'POST'],
      },
    },
  },
  gcp: {
    memoryMB: 512,
    timeout: '30s',
    maxInstances: 10,
    minInstances: 0,
    availableCpu: '1',
    environmentVariables: { NODE_ENV: 'production' },
    vpcConnector: 'projects/x/connectors/y',
    ingressSettings: 'ALLOW_ALL',
    serviceAccountEmail: 'sa@x.iam.gserviceaccount.com',
  },
  monitoring: {
    enabled: true,
    cloudWatchLogs: true,
    applicationInsights: true,
    cloudLogging: true,
    alertsEnabled: true,
  },
};

describe('displayConfig', () => {
  it('logs project/function/runtime/handler/providers/triggers summary', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      displayConfig(baseConfig);
      const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(out).toContain('sls-app');
      expect(out).toContain('processOrder');
      expect(out).toContain('nodejs20.x');
      expect(out).toContain('handler.processOrder');
      expect(out).toContain('aws, azure, gcp');
      expect(out).toContain('http, scheduled, event');
    } finally {
      spy.mockRestore();
    }
  });

  it('reports monitoring as Yes/No based on the enabled flag', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      displayConfig({ ...baseConfig, monitoring: { ...baseConfig.monitoring, enabled: false } });
      const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
      expect(out).toContain('Monitoring: No');
      expect(out).not.toContain('Monitoring: Yes');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('generateServerlessMD', () => {
  it('returns markdown with a fixed feature list and TypeScript usage example', () => {
    const md = generateServerlessMD(baseConfig);
    expect(md).toContain('# Serverless Function Deployment');
    expect(md).toContain('## Features');
    expect(md).toContain('AWS Lambda');
    expect(md).toContain('Azure Functions');
    expect(md).toContain('Cloud Functions');
    expect(md).toContain('SnapStart for cold start optimization');
    expect(md).toContain('## Usage');
    expect(md).toContain("import { ServerlessManager } from './serverless-manager'");
    expect(md).toContain('await manager.deploy()');
  });
});

describe('generateTerraformServerless', () => {
  it('emits a header with the project name and a generation timestamp', () => {
    const tf = generateTerraformServerless(baseConfig);
    expect(tf).toContain('# Auto-generated Serverless Functions Terraform for sls-app');
    expect(tf).toContain('# Generated at:');
  });

  it('generates the AWS Lambda resource with handler/runtime/memory/timeout/architecture', () => {
    const tf = generateTerraformServerless(baseConfig);
    expect(tf).toContain('resource "aws_lambda_function" "main"');
    expect(tf).toContain('function_name = "processOrder"');
    expect(tf).toContain('handler = "handler.processOrder"');
    expect(tf).toContain('runtime = "nodejs20.x"');
    expect(tf).toContain('memory_size = 512');
    expect(tf).toContain('timeout = 30');
    expect(tf).toContain('architectures = ["arm64"]');
    // Default ephemeral storage when not specified.
    expect(tf).toContain('size = 512');
    expect(tf).toContain('mode = "Active"');
  });

  it('emits snap_start block only when snapStart is enabled', () => {
    const withSnap = generateTerraformServerless({
      ...baseConfig,
      aws: { ...baseConfig.aws, snapStart: true },
    });
    expect(withSnap).toContain('snap_start {');
    expect(withSnap).toContain('apply_on = "PublishedVersions"');

    const withoutSnap = generateTerraformServerless(baseConfig);
    expect(withoutSnap).not.toContain('snap_start {');
  });

  it('emits reserved and provisioned concurrency lines when provided', () => {
    const tf = generateTerraformServerless({
      ...baseConfig,
      aws: {
        ...baseConfig.aws,
        reservedConcurrency: 5,
        provisionedConcurrency: 2,
      },
    });
    expect(tf).toContain('reserved_concurrent_executions = 5');
    expect(tf).toContain('provisioned_concurrent_executions = 2');
  });

  it('creates HTTP and scheduled trigger resources for matching trigger types', () => {
    const tf = generateTerraformServerless(baseConfig);
    // HTTP trigger (index 0)
    expect(tf).toContain('# HTTP Trigger 1');
    expect(tf).toContain('resource "aws_apigatewayv2_api" "http0"');
    expect(tf).toContain('principal = "apigateway.amazonaws.com"');
    // Scheduled trigger (index 1)
    expect(tf).toContain('# Scheduled Trigger 2');
    expect(tf).toContain('resource "aws_cloudwatch_event_rule" "schedule1"');
    expect(tf).toContain('schedule_expression = "rate(5 minutes)"');
    // Event trigger produces no dedicated AWS resource.
    expect(tf).not.toContain('# HTTP Trigger 3');
    expect(tf).not.toContain('# Scheduled Trigger 3');
  });

  it('generates Azure Function App with worker runtime, CORS for HTTP triggers and app settings', () => {
    const tf = generateTerraformServerless(baseConfig);
    expect(tf).toContain('resource "azurerm_function_app" "main"');
    expect(tf).toContain('name = "processOrder-func"');
    expect(tf).toContain('"FUNCTIONS_WORKER_RUNTIME" = "node"');
    expect(tf).toContain('"WEBSITE_RUN_FROM_PACKAGE" = "1"');
    expect(tf).toContain('"APP_SETTING_KEY" = "app-setting-value"');
    // CORS only emitted for HTTP triggers.
    expect(tf).toContain('allowed_origins = ["https://example.com"]');
    expect(tf).toContain('supported_methods = ["GET","POST"]');
    // Scale limit line when configured.
    expect(tf).toContain('maximum_elastic_instance_count = 5');
  });

  it('generates GCP Cloud Function 2nd gen with stripped runtime, memory, timeout and service account', () => {
    const tf = generateTerraformServerless(baseConfig);
    expect(tf).toContain('resource "google_cloudfunctions2_function" "main"');
    expect(tf).toContain('name = "processOrder"');
    // runtime ".x" suffix is stripped for GCP build_config.
    expect(tf).toContain('runtime = "nodejs20"');
    expect(tf).toContain('entry_point = "handler"');
    expect(tf).toContain('max_instance_count = 10');
    expect(tf).toContain('min_instance_count = 0');
    expect(tf).toContain('available_memory = "512M"');
    expect(tf).toContain('available_cpu = "1"');
    expect(tf).toContain('timeout_seconds = 30');
    expect(tf).toContain('ingress_settings = "ALLOW_ALL"');
    // Service account email present → quoted interpolation.
    expect(tf).toContain('service_account_email = "sa@x.iam.gserviceaccount.com"');
  });

  it('falls back to the default compute service account when no email is set', () => {
    const tf = generateTerraformServerless({
      ...baseConfig,
      gcp: { ...baseConfig.gcp, serviceAccountEmail: '' },
    });
    expect(tf).toContain('service_account_email = google_compute_default_service_account.email');
    expect(tf).not.toContain('service_account_email = ""');
  });

  it('only emits resources for the providers that are included', () => {
    const tf = generateTerraformServerless({ ...baseConfig, providers: ['aws'] });
    expect(tf).toContain('aws_lambda_function');
    expect(tf).not.toContain('azurerm_function_app');
    expect(tf).not.toContain('google_cloudfunctions2_function');
  });

  it('skips provider blocks when the provider config object is absent', () => {
    const tf = generateTerraformServerless({
      ...baseConfig,
      aws: undefined,
      azure: undefined,
      gcp: undefined,
    });
    expect(tf).not.toContain('aws_lambda_function');
    expect(tf).not.toContain('azurerm_function_app');
    expect(tf).not.toContain('google_cloudfunctions2_function');
  });
});

describe('generateTypeScriptServerless', () => {
  it('generates a ServerlessManager class extending EventEmitter with deploy methods per provider', () => {
    const code = generateTypeScriptServerless(baseConfig);
    expect(code).toContain('// Auto-generated Serverless Manager for sls-app');
    expect(code).toContain('// Generated at:');
    expect(code).toContain("import { execSync } from 'child_process'");
    expect(code).toContain("import { EventEmitter } from 'events'");
    expect(code).toContain('class ServerlessManager extends EventEmitter');
    expect(code).toContain('async deployToAWS()');
    expect(code).toContain('async deployToAzure()');
    expect(code).toContain('async deployToGCP()');
    expect(code).toContain('async deploy()');
    expect(code).toContain('getFunctionUrl(provider');
    // getFunctionUrl switch arms.
    expect(code).toContain("case 'aws':");
    expect(code).toContain("case 'azure':");
    expect(code).toContain("case 'gcp':");
    expect(code).toContain('export default serverlessManager');
    expect(code).toContain('export { ServerlessManager }');
  });

  it('only includes deploy methods for selected providers', () => {
    const code = generateTypeScriptServerless({ ...baseConfig, providers: ['gcp'] });
    expect(code).toContain('async deployToGCP()');
    expect(code).not.toContain('async deployToAWS()');
    expect(code).not.toContain('async deployToAzure()');
  });
});

describe('generatePythonServerless', () => {
  it('generates a ServerlessManager class with asyncio and per-provider async deploy methods', () => {
    const code = generatePythonServerless(baseConfig);
    expect(code).toContain('# Auto-generated Serverless Manager for sls-app');
    expect(code).toContain('import subprocess');
    expect(code).toContain('import asyncio');
    expect(code).toContain('from typing import List, Optional');
    expect(code).toContain('class ServerlessManager:');
    expect(code).toContain('async def deploy_to_aws(self)');
    expect(code).toContain('async def deploy_to_azure(self)');
    expect(code).toContain('async def deploy_to_gcp(self)');
    expect(code).toContain('async def deploy(self)');
    expect(code).toContain('def get_function_url(self, provider: str)');
    // providers list rendered as JSON.
    expect(code).toContain('self.providers = ["aws","azure","gcp"]');
    expect(code).toContain('serverless_manager = ServerlessManager()');
  });

  it('only includes deploy methods for selected providers', () => {
    const code = generatePythonServerless({ ...baseConfig, providers: ['azure'] });
    expect(code).toContain('async def deploy_to_azure(self)');
    expect(code).not.toContain('async def deploy_to_aws(self)');
    expect(code).not.toContain('async def deploy_to_gcp(self)');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sls-'));
  });
  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes the TypeScript bundle (tf, manager, handler, package.json, MD, config.json)', async () => {
    await writeFiles(baseConfig, tmpDir, 'typescript');
    for (const f of [
      'serverless.tf',
      'serverless-manager.ts',
      'handler.ts',
      'package.json',
      'SERVERLESS.md',
      'serverless-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, f))).toBe(true);
    }

    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('sls-app-serverless');
    expect(pkg.main).toBe('serverless-manager.ts');
    expect(pkg.scripts).toHaveProperty('deploy', 'terraform apply -auto-approve');
    expect(pkg.dependencies).toHaveProperty('@types/node');

    const handler = await fs.readFile(path.join(tmpDir, 'handler.ts'), 'utf8');
    expect(handler).toContain('processOrder');

    const stored = await fs.readJson(path.join(tmpDir, 'serverless-config.json'));
    expect(stored.projectName).toBe('sls-app');
    expect(stored.functionName).toBe('processOrder');
    expect(stored.runtime).toBe('nodejs20.x');
    expect(stored.providers).toEqual(['aws', 'azure', 'gcp']);
  });

  it('writes the Python bundle (tf, manager, handler, requirements.txt, MD, config.json)', async () => {
    await writeFiles(baseConfig, tmpDir, 'python');
    for (const f of [
      'serverless.tf',
      'serverless_manager.py',
      'handler.py',
      'requirements.txt',
      'SERVERLESS.md',
      'serverless-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, f))).toBe(true);
    }
    expect(await fs.pathExists(path.join(tmpDir, 'serverless-manager.ts'))).toBe(false);
    expect(await fs.pathExists(path.join(tmpDir, 'handler.ts'))).toBe(false);

    const requirements = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf8');
    expect(requirements).toContain('asyncio');

    const handler = await fs.readFile(path.join(tmpDir, 'handler.py'), 'utf8');
    expect(handler).toContain('processOrder');

    const tf = await fs.readFile(path.join(tmpDir, 'serverless.tf'), 'utf8');
    expect(tf).toContain('aws_lambda_function');
  });

  it('creates a nested output directory that does not yet exist', async () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c');
    await writeFiles(baseConfig, nested, 'typescript');
    expect(await fs.pathExists(path.join(nested, 'serverless.tf'))).toBe(true);
  });
});
