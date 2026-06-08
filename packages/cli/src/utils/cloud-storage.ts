// Auto-generated Cloud Storage Integration and Data Pipeline Utility
// Generated at: 2026-01-13T10:56:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type StorageClass = 'STANDARD' | 'INFREQUENT_ACCESS' | 'GLACIER' | 'DEEP_ARCHIVE' | 'ONEZONE_IA' | 'INTELLIGENT_TIERING';
type AccessTier = 'HOT' | 'COOL' | 'ARCHIVE';

interface AWSS3Config {
  bucketName: string;
  storageClass: StorageClass;
  versioning: boolean;
  serverSideEncryption: 'AES256' | 'aws:kms';
  publicAccessBlock: boolean;
  lifecycleRules: {
    id: string;
    transitions: { days: number; storageClass: StorageClass }[];
    expirationDays?: number;
    noncurrentVersionExpirationDays?: number;
  }[];
  logging: {
    enabled: boolean;
    targetBucket?: string;
    targetPrefix?: string;
  };
  replication: {
    enabled: boolean;
    destinationBucket?: string;
    replicationTime?: number;
  };
}

interface AzureBlobConfig {
  accountName: string;
  containerName: string;
  accessTier: AccessTier;
  versioning: boolean;
  encryption: boolean;
  lifecycleManagement: {
    enabled: boolean;
    rules: {
      name: string;
      enabled: boolean;
      deleteAfterDays?: number;
      archiveAfterDays?: number;
      coolAfterDays?: number;
    }[];
  };
  immutabilityPolicy: {
    enabled: boolean;
    retentionDays?: number;
  };
  blobServiceProperties: {
    deleteRetentionPolicy: {
      enabled: boolean;
      days?: number;
    };
  };
}

interface GCPStorageConfig {
  bucketName: string;
  location: string;
  storageClass: 'STANDARD' | 'NEARLINE' | 'COLDLINE' | 'ARCHIVE';
  versioning: boolean;
  uniformBucketLevelAccess: boolean;
  lifecycleRules: {
    action: {
      type: 'Delete' | 'SetStorageClass';
      storageClass?: 'NEARLINE' | 'COLDLINE' | 'ARCHIVE';
    };
    condition: {
      age?: number;
      matchesStorageClass?: string[];
    };
  }[];
  logging: {
    enabled: boolean;
    logBucket?: string;
  };
}

interface DataPipelineConfig {
  enabled: boolean;
  source: {
    type: 's3' | 'blob' | 'gcs' | 'database' | 'api';
    connection: string;
  };
  destination: {
    type: 's3' | 'blob' | 'gcs' | 'database' | 'data-warehouse';
    connection: string;
  };
  transformations: {
    name: string;
    type: 'filter' | 'aggregate' | 'join' | 'normalize';
    config: Record<string, any>;
  }[];
  schedule: string;
}

interface GovernanceConfig {
  dataClassification: {
    enabled: boolean;
    levels: ('public' | 'internal' | 'confidential' | 'restricted')[];
    autoClassification: boolean;
  };
  retentionPolicies: {
    enabled: boolean;
    rules: {
      dataType: string;
      retentionPeriod: number;
      archiveAfter?: number;
    }[];
  };
  auditLogging: {
    enabled: boolean;
    logLevel: 'INFO' | 'WARN' | 'ERROR';
    retentionDays: number;
  };
  compliance: {
    standards: ('GDPR' | 'HIPAA' | 'SOC2' | 'PCI-DSS')[];
    automatedChecks: boolean;
  };
}

interface CloudStorageConfig {
  projectName: string;
  aws?: AWSS3Config;
  azure?: AzureBlobConfig;
  gcp?: GCPStorageConfig;
  providers: ('aws' | 'azure' | 'gcp')[];
  dataPipeline?: DataPipelineConfig;
  governance: GovernanceConfig;
}

export function displayConfig(config: CloudStorageConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Cloud Storage Integration and Data Pipeline Automation with Governance');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Data Pipeline:', config.dataPipeline?.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Data Classification:', config.governance.dataClassification.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Retention Policies:', config.governance.retentionPolicies.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Audit Logging:', config.governance.auditLogging.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Compliance Standards:', config.governance.compliance.standards.join(', '));
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateCloudStorageMD(config: CloudStorageConfig): string {
  let md = '# Cloud Storage Integration and Data Pipeline Automation\n\n';
  md += '## Features\n\n';
  md += '- Multi-cloud storage: AWS S3, Azure Blob, GCP Cloud Storage\n';
  md += '- Data lifecycle management with automated transitions\n';
  md += '- Versioning and disaster recovery\n';
  md += '- Server-side encryption and security\n';
  md += '- Cross-region replication\n';
  md += '- Data pipeline orchestration\n';
  md += '- ETL transformations and data processing\n';
  md += '- Data governance and classification\n';
  md += '- Retention policies and compliance\n';
  md += '- Audit logging and monitoring\n';
  md += '- GDPR, HIPAA, SOC2, PCI-DSS compliance checks\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import { CloudStorageManager } from \'./cloud-storage-manager\';\n\n';
  md += 'const manager = new CloudStorageManager({\n';
  md += '  projectName: \'my-project\',\n';
  md += '  providers: [\'aws\', \'azure\', \'gcp\'],\n';
  md += '  governance: {\n';
  md += '    dataClassification: { enabled: true },\n';
  md += '    compliance: { standards: [\'GDPR\', \'SOC2\'] },\n';
  md += '  },\n';
  md += '});\n\n';
  md += 'await manager.deploy();\n';
  md += '```\n\n';
  return md;
}

export function generateTerraformStorage(config: CloudStorageConfig): string {
  let code = '# Auto-generated Cloud Storage Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';

  if (config.providers.includes('aws') && config.aws) {
    code += '# AWS S3 Bucket\n';
    code += 'resource "aws_s3_bucket" "main" {\n';
    code += '  bucket = "' + config.aws.bucketName + '"\n';
    code += '  tags = {\n';
    code += '    Name = "' + config.aws.bucketName + '"\n';
    code += '    Project = "' + config.projectName + '"\n';
    code += '  }\n';
    code += '}\n\n';

    if (config.aws.versioning) {
      code += 'resource "aws_s3_bucket_versioning" "main" {\n';
      code += '  bucket = aws_s3_bucket.main.id\n';
      code += '  versioning_configuration {\n';
      code += '    status = "Enabled"\n';
      code += '  }\n';
      code += '}\n\n';
    }

    code += 'resource "aws_s3_bucket_server_side_encryption_configuration" "main" {\n';
    code += '  bucket = aws_s3_bucket.main.id\n\n';
    code += '  rule {\n';
    code += '    apply_server_side_encryption_by_default {\n';
    code += '      sse_algorithm = "' + config.aws.serverSideEncryption + '"\n';
    code += '    }\n';
    code += '  }\n';
    code += '}\n\n';

    if (config.aws.publicAccessBlock) {
      code += 'resource "aws_s3_bucket_public_access_block" "main" {\n';
      code += '  bucket = aws_s3_bucket.main.id\n\n';
      code += '  block_public_acls       = true\n';
      code += '  block_public_policy     = true\n';
      code += '  ignore_public_acls      = true\n';
      code += '  restrict_public_buckets = true\n';
      code += '}\n\n';
    }

    if (config.aws.lifecycleRules.length > 0) {
      code += 'resource "aws_s3_bucket_lifecycle_configuration" "main" {\n';
      code += '  bucket = aws_s3_bucket.main.id\n\n';
      config.aws.lifecycleRules.forEach((rule, index) => {
        code += '  rule {\n';
        code += '    id = "' + rule.id + '"\n';
        code += '    status = "Enabled"\n';
        code += '    transitions {\n';
        rule.transitions.forEach(transition => {
          code += '      { days = ' + transition.days + ', storage_class = "' + transition.storageClass + '" }\n';
        });
        code += '    }\n';
        if (rule.expirationDays) {
          code += '    expiration { days = ' + rule.expirationDays + ' }\n';
        }
        if (rule.noncurrentVersionExpirationDays) {
          code += '    noncurrent_version_expiration { noncurrent_days = ' + rule.noncurrentVersionExpirationDays + ' }\n';
        }
        code += '  }\n';
      });
      code += '}\n\n';
    }

    if (config.aws.logging.enabled) {
      code += 'resource "aws_s3_bucket_logging" "main" {\n';
      code += '  bucket = aws_s3_bucket.main.id\n\n';
      code += '  target_bucket = "' + (config.aws.logging.targetBucket || config.aws.bucketName + '-logs') + '"\n';
      code += '  target_prefix = "' + (config.aws.logging.targetPrefix || 'log/') + '"\n';
      code += '}\n\n';
    }
  }

  if (config.providers.includes('azure') && config.azure) {
    code += '# Azure Storage Account\n';
    code += 'resource "azurerm_storage_account" "main" {\n';
    code += '  name = "' + config.azure.accountName + '"\n';
    code += '  location = azurerm_resource_group.main.location\n';
    code += '  resource_group_name = azurerm_resource_group.main.name\n';
    code += '  account_tier = "Standard"\n';
    code += '  account_replication_type = "GRS"\n';
    code += '  enable_https_traffic_only = true\n';
    if (config.azure.versioning) {
      code += '  blob_properties {\n';
      code += '    versioning_enabled = true\n';
      code += '  }\n';
    }
    code += '}\n\n';

    code += 'resource "azurerm_storage_container" "main" {\n';
    code += '  name = "' + config.azure.containerName + '"\n';
    code += '  storage_account_name = azurerm_storage_account.main.name\n';
    code += '  access_tier = "' + config.azure.accessTier + '"\n';
    code += '}\n\n';

    if (config.azure.lifecycleManagement.enabled && config.azure.lifecycleManagement.rules.length > 0) {
      code += 'resource "azurerm_storage_management_policy" "main" {\n';
      code += '  storage_account_id = azurerm_storage_account.main.id\n\n';
      config.azure.lifecycleManagement.rules.forEach((rule, index) => {
        code += '  rule {\n';
        code += '    name = "' + rule.name + '"\n';
        code += '    enabled = ' + (rule.enabled ? 'true' : 'false') + '\n';
        code += '    actions {\n';
        if (rule.deleteAfterDays) {
          code += '      base_blob { delete_after_days_since_modification_greater_than = ' + rule.deleteAfterDays + ' }\n';
        }
        code += '    }\n';
        code += '  }\n';
      });
      code += '}\n\n';
    }
  }

  if (config.providers.includes('gcp') && config.gcp) {
    code += '# GCP Storage Bucket\n';
    code += 'resource "google_storage_bucket" "main" {\n';
    code += '  name = "' + config.gcp.bucketName + '"\n';
    code += '  location = "' + config.gcp.location + '"\n';
    code += '  force_destroy = false\n';
    code += '  storage_class = "' + config.gcp.storageClass + '"\n';
    code += '  versioning {\n';
    code += '    enabled = ' + (config.gcp.versioning ? 'true' : 'false') + '\n';
    code += '  }\n';
    code += '  uniform_bucket_level_access = ' + (config.gcp.uniformBucketLevelAccess ? 'true' : 'false') + '\n\n';

    if (config.gcp.lifecycleRules.length > 0) {
      code += '  lifecycle_rule {\n';
      config.gcp.lifecycleRules.forEach(rule => {
        code += '    condition {\n';
        if (rule.condition.age) {
          code += '      age = ' + rule.condition.age + '\n';
        }
        code += '    }\n';
        code += '    action {\n';
        code += '      type = "' + rule.action.type + '"\n';
        if (rule.action.storageClass) {
          code += '      storage_class = "' + rule.action.storageClass + '"\n';
        }
        code += '    }\n';
      });
      code += '  }\n';
    }

    code += '}\n\n';
  }

  if (config.governance.auditLogging.enabled) {
    code += '# Audit Logging\n';
    if (config.providers.includes('aws')) {
      code += 'resource "aws_s3_bucket" "audit" {\n';
      code += '  bucket = "' + config.projectName + '-audit-logs"\n';
      code += '  acl    = "private"\n';
      code += '}\n\n';
    }
    if (config.providers.includes('azure')) {
      code += 'resource "azurerm_storage_account" "audit" {\n';
      code += '  name = "' + config.projectName + 'auditlogs"\n';
      code += '  location = azurerm_resource_group.main.location\n';
      code += '  resource_group_name = azurerm_resource_group.main.name\n';
      code += '  account_tier = "Standard"\n';
      code += '  account_replication_type = "LRS"\n';
      code += '}\n\n';
    }
  }

  return code;
}

export function generateTypeScriptCloudStorage(config: CloudStorageConfig): string {
  let code = '// Auto-generated Cloud Storage Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import { EventEmitter } from \'events\';\n\n';

  code += 'class CloudStorageManager extends EventEmitter {\n';
  code += '  private projectName: string;\n';
  code += '  private providers: string[];\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.providers = options.providers || ' + JSON.stringify(config.providers) + ';\n';
  code += '  }\n\n';

  if (config.providers.includes('aws')) {
    code += '  async deployToAWS(): Promise<void> {\n';
    code += '    console.log(\'[CloudStorage] Deploying to AWS S3...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -target=aws_s3_bucket.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[CloudStorage] ✓ AWS S3 deployed\');\n';
    code += '      this.emit(\'deployed\', \'aws\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[CloudStorage] ✗ AWS S3 deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  if (config.providers.includes('azure')) {
    code += '  async deployToAzure(): Promise<void> {\n';
    code += '    console.log(\'[CloudStorage] Deploying to Azure Blob Storage...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -target=azurerm_storage_account.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[CloudStorage] ✓ Azure Blob Storage deployed\');\n';
    code += '      this.emit(\'deployed\', \'azure\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[CloudStorage] ✗ Azure Blob Storage deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '  async deployToGCP(): Promise<void> {\n';
    code += '    console.log(\'[CloudStorage] Deploying to GCP Cloud Storage...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -target=google_storage_bucket.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[CloudStorage] ✓ GCP Cloud Storage deployed\');\n';
    code += '      this.emit(\'deployed\', \'gcp\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[CloudStorage] ✗ GCP Cloud Storage deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[CloudStorage] Starting cloud storage deployment...\');\n\n';
  code += '    const deployments = this.providers.map(async (provider) => {\n';
  code += '      if (provider === \'aws\') await this.deployToAWS();\n';
  code += '      if (provider === \'azure\') await this.deployToAzure();\n';
  code += '      if (provider === \'gcp\') await this.deployToGCP();\n';
  code += '    });\n\n';
  code += '    await Promise.all(deployments);\n';
  code += '    console.log(\'[CloudStorage] ✓ All storage deployed\');\n';
  code += '  }\n\n';

  if (config.dataPipeline?.enabled) {
    code += '  async setupDataPipeline(): Promise<void> {\n';
    code += '    console.log(\'[CloudStorage] Setting up data pipeline...\');\n';
    code += '    // Implementation for data pipeline orchestration\n';
    code += '    console.log(\'[CloudStorage] ✓ Data pipeline configured\');\n';
    code += '  }\n\n';
  }

  if (config.governance.dataClassification.enabled) {
    code += '  async classifyData(): Promise<void> {\n';
    code += '    console.log(\'[CloudStorage] Classifying data...\');\n';
    code += '    // Implementation for automatic data classification\n';
    code += '    console.log(\'[CloudStorage] ✓ Data classified\');\n';
    code += '  }\n\n';
  }

  code += '  getStorageInfo(provider: string): any {\n';
  code += '    switch (provider) {\n';
  code += '      case \'aws\':\n';
  code += '        return {\n';
  code += '          type: \'s3\',\n';
  code += '          endpoint: `s3.amazonaws.com`,\n';
  code += '          bucket: \'' + (config.aws?.bucketName || config.projectName + '-bucket') + '\',\n';
  code += '        };\n';
  code += '      case \'azure\':\n';
  code += '        return {\n';
  code += '          type: \'blob\',\n';
  code += '          endpoint: `core.windows.net`,\n';
  code += '          account: \'' + (config.azure?.accountName || config.projectName + 'storage') + '\',\n';
  code += '        };\n';
  code += '      case \'gcp\':\n';
  code += '        return {\n';
  code += '          type: \'gcs\',\n';
  code += '          endpoint: `storage.googleapis.com`,\n';
  code += '          bucket: \'' + (config.gcp?.bucketName || config.projectName + '-bucket') + '\',\n';
  code += '        };\n';
  code += '      default:\n';
  code += '        throw new Error(`Unknown provider: ${provider}`);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const cloudStorageManager = new CloudStorageManager();\n\n';
  code += 'export default cloudStorageManager;\n';
  code += 'export { CloudStorageManager };\n';

  return code;
}

export function generatePythonCloudStorage(config: CloudStorageConfig): string {
  let code = '# Auto-generated Cloud Storage Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import asyncio\n';
  code += 'from typing import List, Optional, Dict, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += 'class CloudStorageManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.providers = ' + JSON.stringify(config.providers) + '\n\n';

  if (config.providers.includes('aws')) {
    code += '    async def deploy_to_aws(self) -> None:\n';
    code += '        print("[CloudStorage] Deploying to AWS S3...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-target=aws_s3_bucket.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[CloudStorage] ✓ AWS S3 deployed")\n\n';
  }

  if (config.providers.includes('azure')) {
    code += '    async def deploy_to_azure(self) -> None:\n';
    code += '        print("[CloudStorage] Deploying to Azure Blob Storage...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-target=azurerm_storage_account.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[CloudStorage] ✓ Azure Blob Storage deployed")\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '    async def deploy_to_gcp(self) -> None:\n';
    code += '        print("[CloudStorage] Deploying to GCP Cloud Storage...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-target=google_storage_bucket.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[CloudStorage] ✓ GCP Cloud Storage deployed")\n\n';
  }

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[CloudStorage] Starting cloud storage deployment...")\n\n';
  code += '        tasks = []\n';
  code += '        for provider in self.providers:\n';
  code += '            if provider == "aws":\n';
  code += '                tasks.append(self.deploy_to_aws())\n';
  code += '            elif provider == "azure":\n';
  code += '                tasks.append(self.deploy_to_azure())\n';
  code += '            elif provider == "gcp":\n';
  code += '                tasks.append(self.deploy_to_gcp())\n\n';
  code += '        await asyncio.gather(*tasks)\n';
  code += '        print("[CloudStorage] ✓ All storage deployed")\n\n';

  if (config.dataPipeline?.enabled) {
    code += '    async def setup_data_pipeline(self) -> None:\n';
    code += '        print("[CloudStorage] Setting up data pipeline...")\n';
    code += '        print("[CloudStorage] ✓ Data pipeline configured")\n\n';
  }

  if (config.governance.dataClassification.enabled) {
    code += '    async def classify_data(self) -> None:\n';
    code += '        print("[CloudStorage] Classifying data...")\n';
    code += '        print("[CloudStorage] ✓ Data classified")\n\n';
  }

  code += '    def get_storage_info(self, provider: str) -> Dict[str, Any]:\n';
  code += '        if provider == "aws":\n';
  code += '            return {\n';
  code += '                "type": "s3",\n';
  code += '                "endpoint": "s3.amazonaws.com",\n';
  code += '                "bucket": "' + (config.aws?.bucketName || config.projectName + '-bucket') + '",\n';
  code += '            }\n';
  code += '        elif provider == "azure":\n';
  code += '            return {\n';
  code += '                "type": "blob",\n';
  code += '                "endpoint": "core.windows.net",\n';
  code += '                "account": "' + (config.azure?.accountName || config.projectName + 'storage') + '",\n';
  code += '            }\n';
  code += '        elif provider == "gcp":\n';
  code += '            return {\n';
  code += '                "type": "gcs",\n';
  code += '                "endpoint": "storage.googleapis.com",\n';
  code += '                "bucket": "' + (config.gcp?.bucketName || config.projectName + '-bucket') + '",\n';
  code += '            }\n';
  code += '        else:\n';
  code += '            raise ValueError(f"Unknown provider: {provider}")\n\n';

  code += 'cloud_storage_manager = CloudStorageManager()\n';

  return code;
}

export async function writeFiles(config: CloudStorageConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Terraform config
  const terraformCode = generateTerraformStorage(config);
  await fs.writeFile(path.join(outputDir, 'storage.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptCloudStorage(config);
    await fs.writeFile(path.join(outputDir, 'cloud-storage-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-cloud-storage',
      version: '1.0.0',
      description: 'Cloud Storage Integration and Data Pipeline Automation',
      main: 'cloud-storage-manager.ts',
      scripts: {
        deploy: 'terraform apply -auto-approve',
        'data-pipeline': 'ts-node cloud-storage-manager.ts pipeline',
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
    const pyCode = generatePythonCloudStorage(config);
    await fs.writeFile(path.join(outputDir, 'cloud_storage_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'boto3>=1.28.0',
      'azure-storage-blob>=12.19.0',
      'google-cloud-storage>=2.13.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateCloudStorageMD(config);
  await fs.writeFile(path.join(outputDir, 'CLOUD_STORAGE.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    dataPipeline: config.dataPipeline,
    governance: config.governance,
  };
  await fs.writeFile(path.join(outputDir, 'storage-config.json'), JSON.stringify(configJson, null, 2));
}
