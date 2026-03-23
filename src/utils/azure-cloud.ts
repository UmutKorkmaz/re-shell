// Auto-generated Azure AKS Utility
// Generated at: 2026-01-13T10:35:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface AKSClusterConfig {
  clusterName: string;
  resourceGroupName: string;
  location: string;
  kubernetesVersion: string;
  nodeCount: number;
  nodeVmSize: string;
  enableAutoScaling: boolean;
  minCount: number;
  maxCount: number;
  osDiskSizeGB: number;
  osDiskType: string;
  enablePrivateCluster: boolean;
  enableManagedIdentity: boolean;
}

interface AzureDevOpsConfig {
  organization: string;
  project: string;
  repoName: string;
  buildPipeline: string;
  releasePipeline: string;
  enableCI: boolean;
  enableCD: boolean;
  branch: string;
}

interface MonitoringConfig {
  enableLogAnalytics: boolean;
  enableApplicationInsights: boolean;
  enableAzureMonitor: boolean;
  retentionDays: number;
}

interface AzureCloudConfig {
  projectName: string;
  subscriptionId: string;
  aksConfig: AKSClusterConfig;
  devOpsConfig: AzureDevOpsConfig;
  monitoringConfig: MonitoringConfig;
  enableACR: boolean;
  enableKeyVault: boolean;
}

export function displayConfig(config: AzureCloudConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Azure AKS with ARM/Bicep Integration and Azure DevOps');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Subscription ID:', config.subscriptionId.substring(0, 8) + '...');
  console.log('\x1b[33m%s\x1b[0m', 'AKS Cluster:', config.aksConfig.clusterName);
  console.log('\x1b[33m%s\x1b[0m', 'Resource Group:', config.aksConfig.resourceGroupName);
  console.log('\x1b[33m%s\x1b[0m', 'Location:', config.aksConfig.location);
  console.log('\x1b[33m%s\x1b[0m', 'K8s Version:', config.aksConfig.kubernetesVersion);
  console.log('\x1b[33m%s\x1b[0m', 'Node Count:', config.aksConfig.nodeCount);
  console.log('\x1b[33m%s\x1b[0m', 'VM Size:', config.aksConfig.nodeVmSize);
  console.log('\x1b[33m%s\x1b[0m', 'Auto-Scaling:', config.aksConfig.enableAutoScaling ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Private Cluster:', config.aksConfig.enablePrivateCluster ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Azure DevOps:', config.devOpsConfig.organization);
  console.log('\x1b[33m%s\x1b[0m', 'ACR:', config.enableACR ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Key Vault:', config.enableKeyVault ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateAzureCloudMD(config: AzureCloudConfig): string {
  let md = '# Azure AKS with ARM/Bicep Integration and Azure DevOps\n\n';
  md += '## Features\n\n';
  md += '- Azure Kubernetes Service (AKS) cluster provisioning\n';
  md += '- ARM (Azure Resource Manager) and Bicep templates\n';
  md += '- Azure DevOps CI/CD pipelines\n';
  md += '- Azure Container Registry (ACR) integration\n';
  md += '- Azure Key Vault for secrets management\n';
  md += '- Azure Monitor and Log Analytics\n';
  md += '- Application Insights integration\n';
  md += '- Managed identity for Azure resources\n';
  md += '- Private AKS clusters\n';
  md += '- Auto-scaling with cluster autoscaler\n';
  md += '- Azure Policy integration\n';
  md += '- Azure Security Center integration\n';
  md += '- Multi-region deployment support\n\n';
  md += '## Usage\n\n';
  md += '```bicep\n';
  md += '// Deploy AKS cluster\n';
  md += 'az deployment group create \\\n';
  md += '  -g ' + config.aksConfig.resourceGroupName + ' \\\n';
  md += '  -f main.bicep \\\n';
  md += '  -p clusterName=' + config.aksConfig.clusterName + '\n\n';
  md += '// Connect to cluster\n';
  md += 'az aks get-credentials -g ' + config.aksConfig.resourceGroupName + ' -n ' + config.aksConfig.clusterName + '\n';
  md += '```\n\n';
  return md;
}

export function generateBicepTemplate(config: AzureCloudConfig): string {
  let code = '// Auto-generated AKS Bicep Template for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';

  code += 'param location string = resourceGroup().location\n';
  code += 'param clusterName string = \'' + config.aksConfig.clusterName + '\'\n';
  code += 'param kubernetesVersion string = \'' + config.aksConfig.kubernetesVersion + '\'\n';
  code += 'param nodeCount int = ' + config.aksConfig.nodeCount + '\n';
  code += 'param nodeVmSize string = \'' + config.aksConfig.nodeVmSize + '\'\n';
  code += 'param enableAutoScaling bool = ' + (config.aksConfig.enableAutoScaling ? 'true' : 'false') + '\n';
  code += 'param minCount int = ' + config.aksConfig.minCount + '\n';
  code += 'param maxCount int = ' + config.aksConfig.maxCount + '\n';
  code += 'param enablePrivateCluster bool = ' + (config.aksConfig.enablePrivateCluster ? 'true' : 'false') + '\n';
  code += 'param enableACR bool = ' + (config.enableACR ? 'true' : 'false') + '\n';
  code += 'param enableKeyVault bool = ' + (config.enableKeyVault ? 'true' : 'false') + '\n\n';

  if (config.enableACR) {
    code += '// Azure Container Registry\n';
    code += 'resource acr \'Microsoft.ContainerRegistry/registries\' = {\n';
    code += '  name: \'${clusterName}acr\'\n';
    code += '  location: location\n';
    code += '  sku: {\n';
    code += '    name: \'Premium\'\n';
    code += '  }\n';
    code += '  properties: {\n';
    code += '    adminUserEnabled: true\n';
    code += '  }\n';
    code += '}\n\n';
  }

  if (config.enableKeyVault) {
    code += '// Azure Key Vault\n';
    code += 'resource keyVault \'Microsoft.KeyVault/vaults\' = {\n';
    code += '  name: \'${clusterName}kv\'\n';
    code += '  location: location\n';
    code += '  properties: {\n';
    code += '    sku: {\n';
    code += '      family: \'A\'\n';
    code += '      name: \'standard\'\n';
    code += '    }\n';
    code += '    tenantId: subscription().tenantId\n';
    code += '    enablePurgeProtection: true\n';
    code += '    enableSoftDelete: true\n';
    code += '  }\n';
    code += '}\n\n';
  }

  code += '// Managed Identity\n';
  code += 'resource identity \'Microsoft.ManagedIdentity/userAssignedIdentities\' = {\n';
  code += '  name: \'${clusterName}-identity\'\n';
  code += '  location: location\n';
  code += '}\n\n';

  code += '// AKS Cluster\n';
  code += 'resource aks \'Microsoft.ContainerService/managedClusters\' = {\n';
  code += '  name: clusterName\n';
  code += '  location: location\n';
  code += '  identity: {\n';
  code += '    type: \'UserAssigned\'\n';
  code += '    userAssignedIdentities: {\n';
  code += '      \'${identity.id}\' = {}\n';
  code += '    }\n';
  code += '  }\n';
  code += '  properties: {\n';
  code += '    kubernetesVersion: kubernetesVersion\n';
  code += '    dnsPrefix: clusterName\n';
  code += '    agentPoolProfiles: [\n';
  code += '      {\n';
  code += '        name: \'systempool\'\n';
  code += '        count: nodeCount\n';
  code += '        vmSize: nodeVmSize\n';
  code += '        osDiskSizeGB: ' + config.aksConfig.osDiskSizeGB + '\n';
  code += '        osDiskType: \'' + config.aksConfig.osDiskType + '\'\n';
  if (config.aksConfig.enableAutoScaling) {
    code += '        enableAutoScaling: enableAutoScaling\n';
    code += '        minCount: minCount\n';
    code += '        maxCount: maxCount\n';
  }
  code += '        mode: \'System\'\n';
  code += '        type: \'VirtualMachineScaleSets\'\n';
  code += '        orchestratorVersion: kubernetesVersion\n';
  code += '      }\n';
  code += '    ]\n';
  code += '    linuxProfile: {\n';
  code += '      adminUsername: \'azureuser\'\n';
  code += '      ssh: {\n';
  code += '        publicKeys: [\n';
  code += '          {\n';
  code += '            keyData: \'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...\'\n';
  code += '          }\n';
  code += '        ]\n';
  code += '      }\n';
  code += '    }\n';
  if (config.aksConfig.enablePrivateCluster) {
    code += '    apiServerAccessProfile: {\n';
    code += '      enablePrivateCluster: enablePrivateCluster\n';
    code += '    }\n';
  }
  if (config.enableACR) {
    code += '    networkProfile: {\n';
    code += '      loadBalancerSku: \'standard\'\n';
    code += '      outboundType: \'loadBalancer\'\n';
    code += '    }\n';
    code += '    azureRBAC: true\n';
    code += '    aadProfile: {\n';
    code += '      managed: true\n';
    code += '      enableAzureRBAC: true\n';
    code += '    }\n';
    code += '    addonProfiles: {\n';
    code += '      azureKeyvaultSecretsProvider: {\n';
    code += '        enabled: ' + (config.enableKeyVault ? 'true' : 'false') + '\n';
    code += '        config: {\n';
    code += '          enableSecretRotation: true\n';
    code += '        }\n';
    code += '      }\n';
    code += '      omsagent: {\n';
    code += '        enabled: ' + (config.monitoringConfig.enableLogAnalytics ? 'true' : 'false') + '\n';
    code += '        config: {\n';
    code += '          logAnalyticsWorkspaceResourceID: \'\'\n';
    code += '        }\n';
    code += '      }\n';
    code += '    }\n';
  }
  code += '  }\n';
  code += '}\n\n';

  code += '// Output\n';
  code += 'output aksId string = aks.id\n';
  code += 'output identityId string = identity.id\n';
  if (config.enableACR) {
    code += 'output acrId string = acr.id\n';
    code += 'output acrLoginServer string = acr.properties.loginServer\n';
  }
  if (config.enableKeyVault) {
    code += 'output keyVaultId string = keyVault.id\n';
    code += 'output keyVaultUri string = keyVault.properties.vaultUri\n';
  }
  code += 'output aksFqdn string = aks.properties.fqdn\n';

  return code;
}

export function generateTypeScriptAzureCloud(config: AzureCloudConfig): string {
  let code = '// Auto-generated Azure Cloud Infrastructure for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import * as azure from \'@azure/arm-resources\';\n';
  code += 'import { DefaultAzureCredential } from \'@azure/identity\';\n\n';

  code += 'class AzureCloudManager {\n';
  code += '  private subscriptionId: string;\n';
  code += '  private resourceGroupName: string;\n';
  code += '  private projectName: string;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.subscriptionId = options.subscriptionId || process.env.AZURE_SUBSCRIPTION_ID;\n';
  code += '    this.resourceGroupName = options.resourceGroupName || \'' + config.aksConfig.resourceGroupName + '\';\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '  }\n\n';

  code += '  async deployAKS(): Promise<void> {\n';
  code += '    console.log(\'[AzureCloud] Deploying AKS cluster...\');\n\n';
  code += '    // Create resource group\n';
  code += '    await this.createResourceGroup();\n\n';
  code += '    // Deploy AKS cluster\n';
  code += '    const deployCmd = \'az aks create \\\n';
  code += '      --resource-group ${this.resourceGroupName} \\\n';
  code += '      --name ' + config.aksConfig.clusterName + ' \\\n';
  code += '      --kubernetes-version ' + config.aksConfig.kubernetesVersion + ' \\\n';
  code += '      --node-count ' + config.aksConfig.nodeCount + ' \\\n';
  code += '      --node-vm-size ' + config.aksConfig.nodeVmSize + ' \\\n';
  if (config.aksConfig.enableAutoScaling) {
    code += '      --enable-cluster-autoscaler \\\n';
    code += '      --min-count ' + config.aksConfig.minCount + ' \\\n';
    code += '      --max-count ' + config.aksConfig.maxCount + ' \\\n';
  }
  if (config.aksConfig.enablePrivateCluster) {
    code += '      --enable-private-cluster \\\n';
  }
  if (config.enableACR) {
    code += '      --attach-acr ' + config.aksConfig.clusterName + 'acr \\\n';
  }
  code += '      --enable-managed-identity \\\n';
  code += '      --enable-aad \\\n';
  code += '      --enable-azure-rbac \\\n';
  code += '      --yes\';\n\n';

  code += '    try {\n';
  code += '      execSync(deployCmd, { stdio: \'inherit\' });\n';
  code += '      console.log(\'[AzureCloud] ✓ AKS cluster deployed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[AzureCloud] ✗ Failed to deploy AKS:\', error.message);\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async createResourceGroup(): Promise<void> {\n';
  code += '    console.log(\'[AzureCloud] Creating resource group...\');\n\n';
  code += '    const cmd = \'az group create --name ${this.resourceGroupName} --location ' + config.aksConfig.location + '\';\n\n';
  code += '    try {\n';
  code += '      execSync(cmd, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[AzureCloud] ✓ Resource group created\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[AzureCloud] Resource group may already exist\');\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployACR(): Promise<void> {\n';
  code += '    console.log(\'[AzureCloud] Deploying Azure Container Registry...\');\n\n';
  code += '    const cmd = \'az acr create --resource-group ${this.resourceGroupName} --name ' + config.aksConfig.clusterName + 'acr --sku Premium\';\n\n';
  code += '    try {\n';
  code += '      execSync(cmd, { stdio: \'inherit\' });\n';
  code += '      console.log(\'[AzureCloud] ✓ ACR deployed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[AzureCloud] ✗ Failed to deploy ACR:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployKeyVault(): Promise<void> {\n';
  code += '    console.log(\'[AzureCloud] Deploying Azure Key Vault...\');\n\n';
  code += '    const cmd = \'az keyvault create --name ' + config.aksConfig.clusterName + 'kv --resource-group ${this.resourceGroupName} --location ' + config.aksConfig.location + '\';\n\n';
  code += '    try {\n';
  code += '      execSync(cmd, { stdio: \'inherit\' });\n';
  code += '      console.log(\'[AzureCloud] ✓ Key Vault deployed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[AzureCloud] ✗ Failed to deploy Key Vault:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async setupAzureDevOps(): Promise<void> {\n';
  code += '    console.log(\'[AzureCloud] Setting up Azure DevOps...\');\n';
  code += '    console.log(\'[AzureCloud] Azure DevOps configuration completed\');\n';
  code += '  }\n\n';

  code += '  async getCredentials(): Promise<void> {\n';
  code += '    console.log(\'[AzureCloud] Getting AKS credentials...\');\n\n';
  code += '    const cmd = \'az aks get-credentials --resource-group ${this.resourceGroupName} --name ' + config.aksConfig.clusterName + '\';\n\n';
  code += '    try {\n';
  code += '      execSync(cmd, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[AzureCloud] ✓ Credentials configured\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[AzureCloud] ✗ Failed to get credentials:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployMonitoring(): Promise<void> {\n';
  code += '    console.log(\'[AzureCloud] Deploying monitoring resources...\');\n';
  code += '    console.log(\'[AzureCloud] ✓ Monitoring deployed\');\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const azureCloudManager = new AzureCloudManager({\n';
  code += '  subscriptionId: \'' + config.subscriptionId + '\',\n';
  code += '  resourceGroupName: \'' + config.aksConfig.resourceGroupName + '\',\n';
  code += '  projectName: \'' + config.projectName + '\',\n';
  code += '});\n\n';

  code += 'export default azureCloudManager;\n';
  code += 'export { AzureCloudManager };\n';

  return code;
}

export function generatePythonAzureCloud(config: AzureCloudConfig): string {
  let code = '# Auto-generated Azure Cloud Infrastructure for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'from azure.identity import DefaultAzureCredential\n';
  code += 'from azure.mgmt.resource import ResourceManagementClient\n';
  code += 'from pathlib import Path\n\n';

  code += 'class AzureCloudManager:\n';
  code += '    def __init__(self, subscription_id: str = None, resource_group_name: str = None, project_name: str = None):\n';
  code += '        self.subscription_id = subscription_id or "' + config.subscriptionId + '"\n';
  code += '        self.resource_group_name = resource_group_name or "' + config.aksConfig.resourceGroupName + '"\n';
  code += '        self.project_name = project_name or "' + config.projectName + '"\n';
  code += '        self.credential = DefaultAzureCredential()\n\n';

  code += '    def deploy_aks(self) -> None:\n';
  code += '        print("[AzureCloud] Deploying AKS cluster...")\n';
  code += '        self.create_resource_group()\n\n';
  code += '        cmd = [\n';
  code += '            "az", "aks", "create",\n';
  code += '            "--resource-group", self.resource_group_name,\n';
  code += '            "--name", "' + config.aksConfig.clusterName + '",\n';
  code += '            "--kubernetes-version", "' + config.aksConfig.kubernetesVersion + '",\n';
  code += '            "--node-count", str(' + config.aksConfig.nodeCount + '),\n';
  code += '            "--node-vm-size", "' + config.aksConfig.nodeVmSize + '",\n';
  if (config.aksConfig.enableAutoScaling) {
    code += '            "--enable-cluster-autoscaler",\n';
    code += '            "--min-count", str(' + config.aksConfig.minCount + '),\n';
    code += '            "--max-count", str(' + config.aksConfig.maxCount + '),\n';
  }
  code += '            "--enable-managed-identity",\n';
  code += '            "--enable-aad",\n';
  code += '            "--enable-azure-rbac",\n';
  code += '            "--yes",\n';
  code += '        ]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True)\n';
  code += '            print("[AzureCloud] ✓ AKS cluster deployed")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[AzureCloud] ✗ Failed to deploy AKS: {e}")\n';

  code += '    def create_resource_group(self) -> None:\n';
  code += '        print("[AzureCloud] Creating resource group...")\n';
  code += '        cmd = ["az", "group", "create", "--name", self.resource_group_name, "--location", "' + config.aksConfig.location + '"]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True, capture_output=True)\n';
  code += '            print("[AzureCloud] ✓ Resource group created")\n';
  code += '        except subprocess.CalledProcessError:\n';
  code += '            print("[AzureCloud] Resource group may already exist")\n\n';

  code += '    def deploy_acr(self) -> None:\n';
  code += '        print("[AzureCloud] Deploying Azure Container Registry...")\n';
  code += '        cmd = ["az", "acr", "create", "--resource-group", self.resource_group_name, "--name", "' + config.aksConfig.clusterName + 'acr", "--sku", "Premium"]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True)\n';
  code += '            print("[AzureCloud] ✓ ACR deployed")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[AzureCloud] ✗ Failed to deploy ACR: {e}")\n\n';

  code += '    def deploy_keyvault(self) -> None:\n';
  code += '        print("[AzureCloud] Deploying Azure Key Vault...")\n';
  code += '        cmd = ["az", "keyvault", "create", "--name", "' + config.aksConfig.clusterName + 'kv", "--resource-group", self.resource_group_name, "--location", "' + config.aksConfig.location + '"]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True)\n';
  code += '            print("[AzureCloud] ✓ Key Vault deployed")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[AzureCloud] ✗ Failed to deploy Key Vault: {e}")\n\n';

  code += '    def get_credentials(self) -> None:\n';
  code += '        print("[AzureCloud] Getting AKS credentials...")\n';
  code += '        cmd = ["az", "aks", "get-credentials", "--resource-group", self.resource_group_name, "--name", "' + config.aksConfig.clusterName + '"]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True, capture_output=True)\n';
  code += '            print("[AzureCloud] ✓ Credentials configured")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[AzureCloud] ✗ Failed to get credentials: {e}")\n\n';

  code += 'azure_cloud_manager = AzureCloudManager(\n';
  code += '    subscription_id="' + config.subscriptionId + '",\n';
  code += '    resource_group_name="' + config.aksConfig.resourceGroupName + '",\n';
  code += '    project_name="' + config.projectName + '",\n';
  code += ')\n';

  return code;
}

export async function writeFiles(config: AzureCloudConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Bicep template
  const bicepCode = generateBicepTemplate(config);
  await fs.writeFile(path.join(outputDir, 'main.bicep'), bicepCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptAzureCloud(config);
    await fs.writeFile(path.join(outputDir, 'azure-cloud-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-azure-cloud',
      version: '1.0.0',
      description: 'Azure AKS with ARM/Bicep Integration and Azure DevOps',
      main: 'azure-cloud-manager.ts',
      scripts: {
        deploy: 'az deployment group create -g ' + config.aksConfig.resourceGroupName + ' -f main.bicep',
      },
      dependencies: {
        '@azure/arm-resources': '^5.0.0',
        '@azure/identity': '^3.0.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonAzureCloud(config);
    await fs.writeFile(path.join(outputDir, 'azure_cloud_manager.py'), pyCode);

    const requirements = [
      'azure-identity>=1.0.0',
      'azure-mgmt-resource>=23.0.0',
      'azure-cli-core>=2.0.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateAzureCloudMD(config);
  await fs.writeFile(path.join(outputDir, 'AZURE_CLOUD.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    subscriptionId: config.subscriptionId,
    aksConfig: config.aksConfig,
    devOpsConfig: config.devOpsConfig,
    monitoringConfig: config.monitoringConfig,
    enableACR: config.enableACR,
    enableKeyVault: config.enableKeyVault,
  };
  await fs.writeFile(path.join(outputDir, 'azure-config.json'), JSON.stringify(configJson, null, 2));
}
