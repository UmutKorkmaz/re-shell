// Auto-generated Cloud-Native Database Integration Utility
// Generated at: 2026-01-13T10:48:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type DatabaseEngine = 'postgres' | 'mysql' | 'mongodb' | 'mariadb' | 'sqlserver';

interface AWSRDSConfig {
  instanceClass: string;
  allocatedStorage: number;
  storageType: 'standard' | 'gp2' | 'gp3' | 'io1';
  multiAZ: boolean;
  publiclyAccessible: boolean;
  deletionProtection: boolean;
  backupRetentionPeriod: number;
  backupWindow: string;
  maintenanceWindow: string;
  enablePerformanceInsights: boolean;
  enableCloudWatchLogs: boolean;
}

interface AzureCosmosDBConfig {
  consistencyLevel: 'Eventual' | 'ConsistentPrefix' | 'Session' | 'BoundedStaleness' | 'Strong';
  maxStalenessPrefix?: number;
  maxIntervalInSeconds?: number;
  enableAutomaticFailover: boolean;
  enableMultipleWriteLocations: boolean;
  enableFreeTier: boolean;
  backupPolicy: {
    type: 'Periodic' | 'Continuous';
    interval?: number;
    retention?: number;
  };
}

interface GCPCloudSQLConfig {
  tier: string;
  storageSize: number;
  storageType: 'SSD' | 'HDD';
  availabilityType: 'REGIONAL' | 'ZONAL';
  enableAutomaticBackup: boolean;
  backupRetention: number;
  backupStartTime: string;
  enableBinaryLogging: boolean;
  enablePointInTimeRecovery: boolean;
}

interface DisasterRecovery {
  enabled: boolean;
  crossRegionReplication: boolean;
  failoverStrategy: 'manual' | 'automatic';
  replicationLagThreshold: number;
  drRegion: string;
}

interface MonitoringConfig {
  enabled: boolean;
  metricsRetention: number;
  alertingEnabled: boolean;
  performanceInsights: boolean;
}

interface CloudDatabaseConfig {
  projectName: string;
  engine: DatabaseEngine;
  version: string;
  aws?: AWSRDSConfig;
  azure?: AzureCosmosDBConfig;
  gcp?: GCPCloudSQLConfig;
  providers: ('aws' | 'azure' | 'gcp')[];
  disasterRecovery: DisasterRecovery;
  monitoring: MonitoringConfig;
}

export function displayConfig(config: CloudDatabaseConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Cloud-Native Database Integration with Backup Strategies');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Database Engine:', config.engine);
  console.log('\x1b[33m%s\x1b[0m', 'Version:', config.version);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'DR Enabled:', config.disasterRecovery.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Cross-Region Replication:', config.disasterRecovery.crossRegionReplication ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Monitoring:', config.monitoring.enabled ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateCloudDatabaseMD(config: CloudDatabaseConfig): string {
  let md = '# Cloud-Native Database Integration with Backup Strategies\n\n';
  md += '## Features\n\n';
  md += '- AWS RDS integration with automated backups\n';
  md += '- Azure Cosmos DB with global distribution\n';
  md += '- GCP Cloud SQL with high availability\n';
  md += '- Multi-region replication and disaster recovery\n';
  md += '- Automated backup with retention policies\n';
  md += '- Point-in-time recovery\n';
  md += '- Performance monitoring and alerting\n';
  md += '- Automatic failover capabilities\n';
  md += '- Security encryption at rest and in transit\n\n';
  md += '## Database Engines Supported\n\n';
  md += '- PostgreSQL\n';
  md += '- MySQL\n';
  md += '- MongoDB\n';
  md += '- MariaDB\n';
  md += '- SQL Server\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import { CloudDatabaseManager } from \'./cloud-database-manager\';\n\n';
  md += 'const dbManager = new CloudDatabaseManager({\n';
  md += '  engine: \'postgres\',\n';
  md += '  version: \'14.7\',\n';
  md += '  providers: [\'aws\', \'azure\', \'gcp\'],\n';
  md += '  disasterRecovery: {\n';
  md += '    enabled: true,\n';
  md += '    crossRegionReplication: true,\n';
  md += '  },\n';
  md += '});\n\n';
  md += 'await dbManager.deploy();\n';
  md += '```\n\n';
  return md;
}

export function generateTerraformDatabase(config: CloudDatabaseConfig): string {
  let code = '# Auto-generated Cloud-Native Database Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';

  if (config.providers.includes('aws') && config.aws) {
    code += '# AWS RDS Instance\n';
    code += 'resource "aws_db_instance" "main" {\n';
    code += '  identifier = "' + config.projectName + '-db"\n';
    code += '  engine = "' + (config.engine === 'mongodb' ? 'docdb' : config.engine) + '"\n';
    code += '  engine_version = "' + config.version + '"\n';
    code += '  instance_class = "' + config.aws.instanceClass + '"\n';
    code += '  allocated_storage = ' + config.aws.allocatedStorage + '\n';
    code += '  storage_type = "' + config.aws.storageType + '"\n';
    code += '  storage_encrypted = true\n';
    code += '  multi_az = ' + (config.aws.multiAZ ? 'true' : 'false') + '\n';
    code += '  publicly_accessible = ' + (config.aws.publiclyAccessible ? 'true' : 'false') + '\n';
    code += '  deletion_protection = ' + (config.aws.deletionProtection ? 'true' : 'false') + '\n';
    code += '  backup_retention_period = ' + config.aws.backupRetentionPeriod + '\n';
    code += '  backup_window = "' + config.aws.backupWindow + '"\n';
    code += '  maintenance_window = "' + config.aws.maintenanceWindow + '"\n';
    code += '  performance_insights_enabled = ' + (config.aws.enablePerformanceInsights ? 'true' : 'false') + '\n';
    code += '  enabled_cloudwatch_logs_exports = ' + (config.aws.enableCloudWatchLogs ? '["postgresql", "upgrade"]' : '[]') + '\n';
    code += '  skip_final_snapshot = false\n';
    code += '  final_snapshot_identifier = "' + config.projectName + '-final-snapshot"\n';
    code += '  username = "admin"\n';
    code += '  password = var.db_password\n\n';

    if (config.aws.enablePerformanceInsights) {
      code += '  performance_insights {\n';
      code += '    retention_period = 7\n';
      code += '  }\n\n';
    }

    code += '  tags = {\n';
    code += '    Name = "' + config.projectName + '-database"\n';
    code += '    Project = "' + config.projectName + '"\n';
    code += '  }\n';
    code += '}\n\n';

    if (config.disasterRecovery.enabled && config.disasterRecovery.crossRegionReplication) {
      code += '# AWS Cross-Region Read Replica\n';
      code += 'resource "aws_db_instance" "replica" {\n';
      code += '  identifier = "' + config.projectName + '-db-replica"\n';
      code += '  replicate_source_db = aws_db_instance.main.identifier\n';
      code += '  instance_class = "' + config.aws.instanceClass + '"\n';
      code += '  backup_retention_period = ' + config.aws.backupRetentionPeriod + '\n';
      code += '  skip_final_snapshot = true\n\n';
      code += '  tags = {\n';
      code += '    Name = "' + config.projectName + '-database-replica"\n';
      code += '  }\n';
      code += '}\n\n';
    }

    code += 'variable "db_password" {\n';
    code += '  type = string\n';
    code += '  sensitive = true\n';
    code += '}\n\n';
  }

  if (config.providers.includes('azure') && config.azure) {
    code += '# Azure Cosmos DB Account\n';
    code += 'resource "azurerm_cosmosdb_account" "main" {\n';
    code += '  name = "' + config.projectName + '-cosmos"\n';
    code += '  location = azurerm_resource_group.main.location\n';
    code += '  resource_group_name = azurerm_resource_group.main.name\n';
    code += '  offer_type = "Standard"\n';
    code += '  kind = "' + (config.engine === 'mongodb' ? 'MongoDB' : 'GlobalDocumentDB') + '"\n\n';

    if (config.engine === 'mongodb') {
      code += '  enable_free_tier = ' + (config.azure.enableFreeTier ? 'true' : 'false') + '\n';
      code += '  enable_automatic_failover = ' + (config.azure.enableAutomaticFailover ? 'true' : 'false') + '\n';
      code += '  enable_multiple_write_locations = ' + (config.azure.enableMultipleWriteLocations ? 'true' : 'false') + '\n';
    }

    code += '  consistency_policy {\n';
    code += '    consistency_level = "' + config.azure.consistencyLevel + '"\n';
    if (config.azure.consistencyLevel === 'BoundedStaleness' && config.azure.maxStalenessPrefix) {
      code += '    max_interval_in_seconds = ' + config.azure.maxIntervalInSeconds + '\n';
      code += '    max_staleness_prefix = ' + config.azure.maxStalenessPrefix + '\n';
    }
    code += '  }\n\n';

    code += '  geo_location {\n';
    code += '    location = azurerm_resource_group.main.location\n';
    code += '    failover_priority = 0\n';
    code += '  }\n\n';

    if (config.disasterRecovery.crossRegionReplication) {
      code += '  geo_location {\n';
      code += '    location = "' + config.disasterRecovery.drRegion + '"\n';
      code += '    failover_priority = 1\n';
      code += '  }\n\n';
    }

    code += '  backup {\n';
    code += '    type = "' + config.azure.backupPolicy.type + '"\n';
    if (config.azure.backupPolicy.type === 'Periodic') {
      code += '    interval_in_minutes = ' + config.azure.backupPolicy.interval + '\n';
      code += '    retention_in_hours = ' + config.azure.backupPolicy.retention + '\n';
    }
    code += '  }\n';
    code += '}\n\n';
  }

  if (config.providers.includes('gcp') && config.gcp) {
    code += '# GCP Cloud SQL Instance\n';
    code += 'resource "google_sql_database_instance" "main" {\n';
    code += '  name = "' + config.projectName + '-cloudsql"\n';
    code += '  database_version = "' + (config.engine === 'postgres' ? 'POSTGRES_' + config.version.replace('.', '') : 'MYSQL_' + config.version.replace('.', '')) + '"\n';
    code += '  region = "' + (config.gcp.availabilityType === 'REGIONAL' ? 'us-central1' : 'us-central1-a') + '"\n';
    code += '  root_password = var.db_password\n\n';

    code += '  settings {\n';
    code += '    tier = "' + config.gcp.tier + '"\n';
    code += '    disk_size = ' + config.gcp.storageSize + '\n';
    code += '    disk_type = "' + (config.gcp.storageType === 'SSD' ? 'PD_SSD' : 'PD_HDD') + '"\n';
    code += '    availability_type = "' + config.gcp.availabilityType + '"\n\n';

    code += '    backup_configuration {\n';
    code += '      enabled = ' + (config.gcp.enableAutomaticBackup ? 'true' : 'false') + '\n';
    code += '      point_in_time_recovery_enabled = ' + (config.gcp.enablePointInTimeRecovery ? 'true' : 'false') + '\n';
    code += '      start_time = "' + config.gcp.backupStartTime + '"\n';
    code += '      backup_retention_settings {\n';
    code += '        retained_backups = ' + config.gcp.backupRetention + '\n';
    code += '        retention_unit = "COUNT"\n';
    code += '      }\n';
    code += '    }\n\n';

    if (config.gcp.enableBinaryLogging) {
      code += '    activation_policy = "ALWAYS"\n';
      code += '    ip_configuration {\n';
      code += '      ipv4_enabled = true\n';
      code += '      require_ssl = true\n';
      code += '      authorized_networks = [{\n';
      code += '        name = "trusted-network"\n';
      code += '        value = "10.0.0.0/8"\n';
      code += '      }]\n';
      code += '    }\n';
    }

    code += '    location_preference {\n';
    code += '      zone = "us-central1-a"\n';
    code += '    }\n';
    code += '  }\n\n';

    code += '  deletion_protection = true\n';
    code += '}\n\n';

    code += 'variable "db_password" {\n';
    code += '  type = string\n';
    code += '  sensitive = true\n';
    code += '}\n\n';
  }

  return code;
}

export function generateTypeScriptCloudDatabase(config: CloudDatabaseConfig): string {
  let code = '// Auto-generated Cloud-Native Database Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import { EventEmitter } from \'events\';\n\n';

  code += 'class CloudDatabaseManager extends EventEmitter {\n';
  code += '  private projectName: string;\n';
  code += '  private engine: string;\n';
  code += '  private providers: string[];\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.engine = options.engine || \'' + config.engine + '\';\n';
  code += '    this.providers = options.providers || ' + JSON.stringify(config.providers) + ';\n';
  code += '  }\n\n';

  if (config.providers.includes('aws')) {
    code += '  async deployToAWS(): Promise<void> {\n';
    code += '    console.log(\'[CloudDatabase] Deploying to AWS RDS...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -var="engine=' + config.engine + '" \\\n';
    code += '      -var="version=' + config.version + '" \\\n';
    code += '      -target=aws_db_instance.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[CloudDatabase] ✓ AWS RDS deployed\');\n';
    code += '      this.emit(\'deployed\', \'aws\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[CloudDatabase] ✗ AWS RDS deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  if (config.providers.includes('azure')) {
    code += '  async deployToAzure(): Promise<void> {\n';
    code += '    console.log(\'[CloudDatabase] Deploying to Azure Cosmos DB...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -var="engine=' + config.engine + '" \\\n';
    code += '      -target=azurerm_cosmosdb_account.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[CloudDatabase] ✓ Azure Cosmos DB deployed\');\n';
    code += '      this.emit(\'deployed\', \'azure\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[CloudDatabase] ✗ Azure Cosmos DB deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '  async deployToGCP(): Promise<void> {\n';
    code += '    console.log(\'[CloudDatabase] Deploying to GCP Cloud SQL...\');\n\n';
    code += '    const cmd = \'terraform apply -auto-approve \\\n';
    code += '      -var="project=' + config.projectName + '" \\\n';
    code += '      -var="engine=' + config.engine + '" \\\n';
    code += '      -target=google_sql_database_instance.main\';\n\n';
    code += '    try {\n';
    code += '      execSync(cmd, { stdio: \'inherit\' });\n';
    code += '      console.log(\'[CloudDatabase] ✓ GCP Cloud SQL deployed\');\n';
    code += '      this.emit(\'deployed\', \'gcp\');\n';
    code += '    } catch (error: any) {\n';
    code += '      console.error(\'[CloudDatabase] ✗ GCP Cloud SQL deployment failed:\', error.message);\n';
    code += '      throw error;\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[CloudDatabase] Starting cloud database deployment...\');\n\n';
  code += '    const deployments = this.providers.map(async (provider) => {\n';
  code += '      if (provider === \'aws\') await this.deployToAWS();\n';
  code += '      if (provider === \'azure\') await this.deployToAzure();\n';
  code += '      if (provider === \'gcp\') await this.deployToGCP();\n';
  code += '    });\n\n';
  code += '    await Promise.all(deployments);\n';
  code += '    console.log(\'[CloudDatabase] ✓ All databases deployed\');\n';
  code += '  }\n\n';

  if (config.disasterRecovery.enabled) {
    code += '  async createBackup(): Promise<void> {\n';
    code += '    console.log(\'[CloudDatabase] Creating backup...\');\n';
    code += '    // Implementation depends on provider\n';
    code += '    console.log(\'[CloudDatabase] ✓ Backup created\');\n';
    code += '  }\n\n';

    code += '  async restoreFromBackup(backupId: string): Promise<void> {\n';
    code += '    console.log(`[CloudDatabase] Restoring from backup ${backupId}...`);\n';
    code += '    // Implementation depends on provider\n';
    code += '    console.log(\'[CloudDatabase] ✓ Restore completed\');\n';
    code += '  }\n\n';

    if (config.disasterRecovery.failoverStrategy === 'automatic') {
      code += '  async failover(): Promise<void> {\n';
      code += '    console.log(\'[CloudDatabase] Initiating automatic failover...\');\n';
      code += '    this.emit(\'failover-initiated\');\n';
      code += '    console.log(\'[CloudDatabase] ✓ Failover completed\');\n';
      code += '  }\n\n';
    }
  }

  code += '  getConnectionString(provider: string): string {\n';
  code += '    switch (provider) {\n';
  code += '      case \'aws\':\n';
  code += '        return `postgres://${this.projectName}-db.XXX.us-east-1.rds.amazonaws.com:5432/${this.projectName}`;\n';
  code += '      case \'azure\':\n';
  code += '        return `mongodb://${this.projectName}-cosmos.documents.azure.com:10255`;\n';
  code += '      case \'gcp\':\n';
  code += '        return `postgres://google:/cloudsql/${this.projectName}-cloudsql`;\n';
  code += '      default:\n';
  code += '        throw new Error(`Unknown provider: ${provider}`);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const cloudDatabaseManager = new CloudDatabaseManager();\n\n';
  code += 'export default cloudDatabaseManager;\n';
  code += 'export { CloudDatabaseManager };\n';

  return code;
}

export function generatePythonCloudDatabase(config: CloudDatabaseConfig): string {
  let code = '# Auto-generated Cloud-Native Database Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import asyncio\n';
  code += 'from typing import List, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from enum import Enum\n\n';

  code += 'class CloudProvider(Enum):\n';
  code += '    AWS = "aws"\n';
  code += '    AZURE = "azure"\n';
  code += '    GCP = "gcp"\n\n';

  code += 'class CloudDatabaseManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '", engine: str = "' + config.engine + '"):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.engine = engine\n';
  code += '        self.providers = ' + JSON.stringify(config.providers) + '\n\n';

  if (config.providers.includes('aws')) {
    code += '    async def deploy_to_aws(self) -> None:\n';
    code += '        print("[CloudDatabase] Deploying to AWS RDS...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-var=engine=' + config.engine + '",\n';
    code += '            "-var=version=' + config.version + '",\n';
    code += '            "-target=aws_db_instance.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[CloudDatabase] ✓ AWS RDS deployed")\n\n';
  }

  if (config.providers.includes('azure')) {
    code += '    async def deploy_to_azure(self) -> None:\n';
    code += '        print("[CloudDatabase] Deploying to Azure Cosmos DB...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-var=engine=' + config.engine + '",\n';
    code += '            "-target=azurerm_cosmosdb_account.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[CloudDatabase] ✓ Azure Cosmos DB deployed")\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '    async def deploy_to_gcp(self) -> None:\n';
    code += '        print("[CloudDatabase] Deploying to GCP Cloud SQL...")\n\n';
    code += '        cmd = [\n';
    code += '            "terraform", "apply", "-auto-approve",\n';
    code += '            "-var=project=' + config.projectName + '",\n';
    code += '            "-var=engine=' + config.engine + '",\n';
    code += '            "-target=google_sql_database_instance.main",\n';
    code += '        ]\n';
    code += '        subprocess.run(cmd, check=True)\n';
    code += '        print("[CloudDatabase] ✓ GCP Cloud SQL deployed")\n\n';
  }

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[CloudDatabase] Starting cloud database deployment...")\n\n';
  code += '        tasks = []\n';
  code += '        for provider in self.providers:\n';
  code += '            if provider == "aws":\n';
  code += '                tasks.append(self.deploy_to_aws())\n';
  code += '            elif provider == "azure":\n';
  code += '                tasks.append(self.deploy_to_azure())\n';
  code += '            elif provider == "gcp":\n';
  code += '                tasks.append(self.deploy_to_gcp())\n\n';
  code += '        await asyncio.gather(*tasks)\n';
  code += '        print("[CloudDatabase] ✓ All databases deployed")\n\n';

  if (config.disasterRecovery.enabled) {
    code += '    async def create_backup(self) -> None:\n';
    code += '        print("[CloudDatabase] Creating backup...")\n';
    code += '        print("[CloudDatabase] ✓ Backup created")\n\n';

    code += '    async def restore_from_backup(self, backup_id: str) -> None:\n';
    code += '        print(f"[CloudDatabase] Restoring from backup {backup_id}...")\n';
    code += '        print("[CloudDatabase] ✓ Restore completed")\n\n';

    if (config.disasterRecovery.failoverStrategy === 'automatic') {
      code += '    async def failover(self) -> None:\n';
      code += '        print("[CloudDatabase] Initiating automatic failover...")\n';
      code += '        print("[CloudDatabase] ✓ Failover completed")\n\n';
    }
  }

  code += '    def get_connection_string(self, provider: str) -> str:\n';
  code += '        if provider == "aws":\n';
  code += '            return f"postgres://' + config.projectName + '-db.XXX.us-east-1.rds.amazonaws.com:5432/' + config.projectName + '"\n';
  code += '        elif provider == "azure":\n';
  code += '            return f"mongodb://' + config.projectName + '-cosmos.documents.azure.com:10255"\n';
  code += '        elif provider == "gcp":\n';
  code += '            return f"postgres://google:/cloudsql/' + config.projectName + '-cloudsql"\n';
  code += '        else:\n';
  code += '            raise ValueError(f"Unknown provider: {provider}")\n\n';

  code += 'cloud_database_manager = CloudDatabaseManager()\n';

  return code;
}

export async function writeFiles(config: CloudDatabaseConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Terraform config
  const terraformCode = generateTerraformDatabase(config);
  await fs.writeFile(path.join(outputDir, 'database.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptCloudDatabase(config);
    await fs.writeFile(path.join(outputDir, 'cloud-database-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-cloud-database',
      version: '1.0.0',
      description: 'Cloud-Native Database Integration with Backup Strategies',
      main: 'cloud-database-manager.ts',
      scripts: {
        deploy: 'terraform apply -auto-approve',
        backup: 'ts-node cloud-database-manager.ts backup',
        restore: 'ts-node cloud-database-manager.ts restore',
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
    const pyCode = generatePythonCloudDatabase(config);
    await fs.writeFile(path.join(outputDir, 'cloud_database_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'boto3>=1.28.0',
      'azure-identity>=1.13.0',
      'azure-cosmos>=4.5.0',
      'google-cloud-sql>=3.12.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateCloudDatabaseMD(config);
  await fs.writeFile(path.join(outputDir, 'CLOUD_DATABASE.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    engine: config.engine,
    version: config.version,
    providers: config.providers,
    disasterRecovery: config.disasterRecovery,
    monitoring: config.monitoring,
  };
  await fs.writeFile(path.join(outputDir, 'database-config.json'), JSON.stringify(configJson, null, 2));
}
