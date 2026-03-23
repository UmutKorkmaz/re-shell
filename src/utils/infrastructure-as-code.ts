// Auto-generated Infrastructure as Code Utility
// Generated at: 2026-01-13T11:00:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type IaCProvider = 'terraform' | 'pulumi';
type StateBackend = 's3' | 'azurerm' | 'gcs' | 'local' | 'remote';

interface TerraformConfig {
  version: string;
  requiredProviders: {
    name: string;
    source: string;
    version: string;
  }[];
  backend: {
    type: StateBackend;
    config: Record<string, string>;
  };
}

interface PulumiConfig {
  runtime: 'nodejs' | 'python' | 'go' | 'dotnet';
  backend: {
    url: string;
    encryptionKey?: string;
  };
  config: Record<string, any>;
}

interface StateManagementConfig {
  enabled: boolean;
  backend: StateBackend;
  stateFile: string;
  lockFile: string;
  encryption: boolean;
  versioning: boolean;
  remoteStateSharing: boolean;
}

interface ModuleConfig {
  name: string;
  source: string;
  version: string;
  variables: Record<string, any>;
  outputs: string[];
}

interface WorkspaceConfig {
  name: string;
  environments: ('dev' | 'staging' | 'prod')[];
  variablesPerEnvironment: Record<string, Record<string, any>>;
}

interface IaCConfig {
  projectName: string;
  provider: IaCProvider;
  terraform?: TerraformConfig;
  pulumi?: PulumiConfig;
  stateManagement: StateManagementConfig;
  modules: ModuleConfig[];
  workspaces: WorkspaceConfig;
  enableValidation: boolean;
  enableDriftDetection: boolean;
}

export function displayConfig(config: IaCConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Infrastructure as Code with Terraform/Pulumi and State Management');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'IaC Provider:', config.provider);
  console.log('\x1b[33m%s\x1b[0m', 'State Backend:', config.stateManagement.backend);
  console.log('\x1b[33m%s\x1b[0m', 'State Encryption:', config.stateManagement.encryption ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'State Versioning:', config.stateManagement.versioning ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Modules:', config.modules.length);
  console.log('\x1b[33m%s\x1b[0m', 'Workspaces:', config.workspaces.environments.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Validation:', config.enableValidation ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Drift Detection:', config.enableDriftDetection ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateIaCMD(config: IaCConfig): string {
  let md = '# Infrastructure as Code with Terraform/Pulumi\n\n';
  md += '## Features\n\n';
  md += '- Multi-provider IaC support (Terraform, Pulumi)\n';
  md += '- State management with remote backends\n';
  md += '- State encryption and versioning\n';
  md += '- Remote state sharing between teams\n';
  md += '- Modular infrastructure design\n';
  md += '- Workspace management (dev, staging, prod)\n';
  md += '- Environment-specific variables\n';
  md += '- Pre-deployment validation\n';
  md += '- Drift detection and remediation\n';
  md += '- State locking for concurrent operations\n';
  md += '- Rollback and state restore capabilities\n\n';
  md += '## Usage\n\n';
  md += '```bash\n';
  md += '# Terraform\n';
  md += 'terraform init\n';
  md += 'terraform validate\n';
  md += 'terraform plan -out=tfplan\n';
  md += 'terraform apply tfplan\n\n';
  md += '# Pulumi\n';
  md += 'pulumi stack init dev\n';
  md += 'pulumi up\n';
  md += 'pulumi preview\n';
  md += 'pulumi destroy\n';
  md += '```\n\n';
  return md;
}

export function generateTerraformMain(config: IaCConfig): string {
  let code = '# Terraform configuration for ' + config.projectName + '\n';
  code += 'terraform {\n';
  code += '  required_version = "' + (config.terraform?.version || '>= 1.0') + '"\n\n';

  if (config.terraform?.requiredProviders && config.terraform.requiredProviders.length > 0) {
    code += '  required_providers {\n';
    config.terraform.requiredProviders.forEach(provider => {
      code += '    ' + provider.name + ' = {\n';
      code += '      source = "' + provider.source + '"\n';
      code += '      version = "' + provider.version + '"\n';
      code += '    }\n';
    });
    code += '  }\n\n';
  }

  if (config.terraform?.backend) {
    code += '  backend "' + config.terraform.backend.type + '" {\n';
    Object.entries(config.terraform.backend.config).forEach(([key, value]) => {
      code += '    ' + key + ' = "' + value + '"\n';
    });
    code += '  }\n';
  }

  code += '}\n\n';

  // Provider configurations
  code += '# Providers\n';
  code += 'provider "aws" {\n';
  code += '  region = var.aws_region\n';
  code += '}\n\n';

  code += 'provider "azurerm" {\n';
  code += '  features {}\n';
  code += '}\n\n';

  code += 'provider "google" {\n';
  code += '  project = var.gcp_project\n';
  code += '  region = var.gcp_region\n';
  code += '}\n\n';

  // Variables
  code += '# Variables\n';
  code += 'variable "aws_region" {\n';
  code += '  description = "AWS region for resources"\n';
  code += '  type = string\n';
  code += '  default = "us-east-1"\n';
  code += '}\n\n';

  code += 'variable "gcp_project" {\n';
  code += '  description = "GCP project ID"\n';
  code += '  type = string\n';
  code += '}\n\n';

  code += 'variable "environment" {\n';
  code += '  description = "Environment (dev, staging, prod)"\n';
  code += '  type = string\n';
  code += '  validation {\n';
  code += '    condition = contains(["dev", "staging", "prod"], var.environment)\n';
  code += '    error_message = "Environment must be dev, staging, or prod."\n';
  code += '  }\n';
  code += '}\n\n';

  // Outputs
  code += '# Outputs\n';
  code += 'output "infrastructure_id" {\n';
  code += '  description = "Infrastructure identifier"\n';
  code += '  value = "' + config.projectName + '-${var.environment}"\n';
  code += '}\n\n';

  return code;
}

export function generateTerraformState(config: IaCConfig): string {
  let code = '# State management configuration for ' + config.projectName + '\n\n';

  if (config.stateManagement.backend === 's3') {
    code += '# S3 Backend for Terraform State\n';
    code += 'terraform {\n';
    code += '  backend "s3" {\n';
    code += '    bucket = "' + config.projectName + '-terraform-state"\n';
    code += '    key = "' + config.stateManagement.stateFile + '"\n';
    code += '    region = "us-east-1"\n';
    if (config.stateManagement.encryption) {
      code += '    encrypt = true\n';
    }
    if (config.stateManagement.versioning) {
      code += '    # Versioning is enabled on the bucket\n';
    }
    code += '    dynamodb_table = "' + config.projectName + '-locks"\n';
    code += '  }\n';
    code += '}\n\n';
  } else if (config.stateManagement.backend === 'azurerm') {
    code += '# AzureRM Backend for Terraform State\n';
    code += 'terraform {\n';
    code += '  backend "azurerm" {\n';
    code += '    resource_group_name = "' + config.projectName + '-rg"\n';
    code += '    storage_account_name = "' + config.projectName + 'state"\n';
    code += '    container_name = "terraform-state"\n';
    code += '    key = "' + config.stateManagement.stateFile + '"\n';
    code += '  }\n';
    code += '}\n\n';
  } else if (config.stateManagement.backend === 'gcs') {
    code += '# GCS Backend for Terraform State\n';
    code += 'terraform {\n';
    code += '  backend "gcs" {\n';
    code += '    bucket = "' + config.projectName + '-terraform-state"\n';
    code += '    prefix = "' + config.stateManagement.stateFile + '"\n';
    if (config.stateManagement.encryption) {
      code += '    encryption_key = var.state_encryption_key\n';
    }
    code += '  }\n';
    code += '}\n\n';
  }

  return code;
}

export function generatePulumiProgram(config: IaCConfig): string {
  const runtime = config.pulumi?.runtime || 'nodejs';

  if (runtime === 'nodejs') {
    let code = '// Pulumi TypeScript program for ' + config.projectName + '\n';
    code += 'import * as pulumi from "@pulumi/pulumi";\n';
    code += 'import * as aws from "@pulumi/aws";\n';
    code += 'import * as azure from "@pulumi/azure";\n';
    code += 'import * as gcp from "@pulumi/gcp";\n\n';

    code += '// Get the current stack name\n';
    code += 'const stack = pulumi.getStack();\n\n';

    code += '// Export configuration\n';
    code += 'const config = new pulumi.Config();\n';
    code += 'const awsRegion = config.require("awsRegion");\n';
    code += 'const gcpProject = config.require("gcpProject");\n\n';

    code += '// Create example resource\n';
    code += 'const bucket = new aws.s3.Bucket("' + config.projectName + '-bucket", {\n';
    code += '  bucket: pulumi.interpolate`${' + config.projectName + '}-${stack}-bucket`,\n';
    code += '  tags: {\n';
    code += '    Environment: stack,\n';
    code += '    Project: "' + config.projectName + '",\n';
    code += '  },\n';
    code += '});\n\n';

    code += '// Export outputs\n';
    code += 'export const bucketName = bucket.id;\n';
    code += 'export const bucketArn = bucket.arn;\n';
    code += 'export const infrastructureId = pulumi.interpolate`' + config.projectName + '-${stack}`;\n';

    return code;
  } else if (runtime === 'python') {
    let code = '# Pulumi Python program for ' + config.projectName + '\n';
    code += 'import pulumi\n';
    code += 'import pulumi_aws as aws\n';
    code += 'import pulumi_azure as azure\n';
    code += 'import pulumi_gcp as gcp\n\n';

    code += '# Get the current stack name\n';
    code += 'stack = pulumi.get_stack()\n\n';

    code += '# Get configuration\n';
    code += 'config = pulumi.Config()\n';
    code += 'aws_region = config.require("awsRegion")\n';
    code += 'gcp_project = config.require("gcpProject")\n\n';

    code += '# Create example resource\n';
    code += 'bucket = aws.s3.Bucket("' + config.projectName + '-bucket",\n';
    code += '    bucket=f"' + config.projectName + '-{stack}-bucket",\n';
    code += '    tags={\n';
    code += '        "Environment": stack,\n';
    code += '        "Project": "' + config.projectName + '",\n';
    code += '    }\n';
    code += ')\n\n';

    code += '# Export outputs\n';
    code += 'pulumi.export("bucketName", bucket.id)\n';
    code += 'pulumi.export("bucketArn", bucket.arn)\n';
    code += 'pulumi.export("infrastructureId", f"' + config.projectName + '-{stack}")\n';

    return code;
  }

  return '';
}

export function generateTypeScriptIaCManager(config: IaCConfig): string {
  let code = '// Auto-generated IaC Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import { EventEmitter } from \'events\';\n\n';

  code += 'class IaCManager extends EventEmitter {\n';
  code += '  private projectName: string;\n';
  code += '  private provider: string;\n';
  code += '  private stateBackend: string;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.provider = options.provider || \'' + config.provider + '\';\n';
  code += '    this.stateBackend = options.stateBackend || \'' + config.stateManagement.backend + '\';\n';
  code += '  }\n\n';

  if (config.enableValidation) {
    code += '  async validate(): Promise<boolean> {\n';
    code += '    console.log(\'[IaC] Validating configuration...\');\n\n';
    code += '    if (this.provider === \'terraform\') {\n';
    code += '      const cmd = \'terraform validate\';\n';
    code += '      try {\n';
    code += '        execSync(cmd, { stdio: \'inherit\' });\n';
    code += '        console.log(\'[IaC] ✓ Validation passed\');\n';
    code += '        this.emit(\'validated\', true);\n';
    code += '        return true;\n';
    code += '      } catch (error: any) {\n';
    code += '        console.error(\'[IaC] ✗ Validation failed:\', error.message);\n';
    code += '        this.emit(\'validated\', false);\n';
    code += '        return false;\n';
    code += '      }\n';
    code += '    }\n\n';
    code += '    return true;\n';
    code += '  }\n\n';
  }

  code += '  async init(): Promise<void> {\n';
  code += '    console.log(\'[IaC] Initializing ' + (config.provider === 'terraform' ? 'Terraform' : 'Pulumi') + '...\');\n\n';
  code += '    const cmd = this.provider === \'terraform\' ? \'terraform init\' : \'pulumi stack init\';\n';
  code += '    execSync(cmd, { stdio: \'inherit\' });\n';
  code += '    console.log(\'[IaC] ✓ Initialized\');\n';
  code += '  }\n\n';

  code += '  async plan(): Promise<void> {\n';
  code += '    console.log(\'[IaC] Creating execution plan...\');\n\n';
  code += '    const cmd = this.provider === \'terraform\' ? \'terraform plan -out=tfplan\' : \'pulumi preview\';\n';
  code += '    execSync(cmd, { stdio: \'inherit\' });\n';
  code += '    console.log(\'[IaC] ✓ Plan created\');\n';
  code += '  }\n\n';

  if (config.enableDriftDetection) {
    code += '  async detectDrift(): Promise<void> {\n';
    code += '    console.log(\'[IaC] Detecting configuration drift...\');\n\n';
    code += '    if (this.provider === \'terraform\') {\n';
    code += '      const cmd = \'terraform plan -detailed-exitcode\';\n';
    code += '      try {\n';
    code += '        execSync(cmd, { stdio: \'inherit\' });\n';
    code += '        console.log(\'[IaC] ✓ No drift detected\');\n';
    code += '        this.emit(\'drift-detected\', false);\n';
    code += '      } catch (error: any) {\n';
    code += '        console.log(\'[IaC] ⚠ Drift detected\');\n';
    code += '        this.emit(\'drift-detected\', true);\n';
    code += '      }\n';
    code += '    }\n';
    code += '  }\n\n';
  }

  code += '  async apply(): Promise<void> {\n';
  code += '    console.log(\'[IaC] Applying infrastructure changes...\');\n\n';
  code += '    const cmd = this.provider === \'terraform\' ? \'terraform apply tfplan\' : \'pulumi up\';\n';
  code += '    execSync(cmd, { stdio: \'inherit\' });\n';
  code += '    console.log(\'[IaC] ✓ Apply completed\');\n';
  code += '    this.emit(\'applied\');\n';
  code += '  }\n\n';

  code += '  async destroy(): Promise<void> {\n';
  code += '    console.log(\'[IaC] Destroying infrastructure...\');\n\n';
  code += '    const cmd = this.provider === \'terraform\' ? \'terraform destroy -auto-approve\' : \'pulumi destroy\';\n';
  code += '    execSync(cmd, { stdio: \'inherit\' });\n';
  code += '    console.log(\'[IaC] ✓ Destroy completed\');\n';
  code += '  }\n\n';

  code += '  async switchWorkspace(environment: string): Promise<void> {\n';
  code += '    console.log(`[IaC] Switching to ${environment} workspace...`);\n\n';
  code += '    if (this.provider === \'terraform\') {\n';
  code += '      const cmd = `terraform workspace new ${environment} || terraform workspace select ${environment}`;\n';
  code += '      execSync(cmd, { stdio: \'inherit\' });\n';
  code += '    } else if (this.provider === \'pulumi\') {\n';
  code += '      const cmd = `pulumi stack select ${environment} || pulumi stack init ${environment}`;\n';
  code += '      execSync(cmd, { stdio: \'inherit\' });\n';
  code += '    }\n\n';
  code += '    console.log(`[IaC] ✓ Switched to ${environment}`);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const iaCManager = new IaCManager();\n\n';
  code += 'export default iaCManager;\n';
  code += 'export { IaCManager };\n';

  return code;
}

export function generatePythonIaCManager(config: IaCConfig): string {
  let code = '# Auto-generated IaC Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'from typing import Optional\n';
  code += 'from enum import Enum\n\n';

  code += 'class IaCProvider(Enum):\n';
  code += '    TERRAFORM = "terraform"\n';
  code += '    PULUMI = "pulumi"\n\n';

  code += 'class IaCManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '", provider: str = "' + config.provider + '"):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.provider = provider\n';
  code += '        self.state_backend = "' + config.stateManagement.backend + '"\n\n';

  if (config.enableValidation) {
    code += '    def validate(self) -> bool:\n';
    code += '        print("[IaC] Validating configuration...")\n\n';
    code += '        if self.provider == "terraform":\n';
    code += '            cmd = ["terraform", "validate"]\n';
    code += '            try:\n';
    code += '                subprocess.run(cmd, check=True)\n';
    code += '                print("[IaC] ✓ Validation passed")\n';
    code += '                return True\n';
    code += '            except subprocess.CalledProcessError as e:\n';
    code += '                print(f"[IaC] ✗ Validation failed: {e}")\n';
    code += '                return False\n\n';
    code += '        return True\n\n';
  }

  code += '    def init(self) -> None:\n';
  code += '        print("[IaC] Initializing...")\n\n';
  code += '        if self.provider == "terraform":\n';
  code += '            cmd = ["terraform", "init"]\n';
  code += '        else:\n';
  code += '            cmd = ["pulumi", "stack", "init"]\n\n';
  code += '        subprocess.run(cmd, check=True)\n';
  code += '        print("[IaC] ✓ Initialized")\n\n';

  code += '    def plan(self) -> None:\n';
  code += '        print("[IaC] Creating execution plan...")\n\n';
  code += '        if self.provider == "terraform":\n';
  code += '            cmd = ["terraform", "plan", "-out=tfplan"]\n';
  code += '        else:\n';
  code += '            cmd = ["pulumi", "preview"]\n\n';
  code += '        subprocess.run(cmd, check=True)\n';
  code += '        print("[IaC] ✓ Plan created")\n\n';

  if (config.enableDriftDetection) {
    code += '    def detect_drift(self) -> None:\n';
    code += '        print("[IaC] Detecting configuration drift...")\n\n';
    code += '        if self.provider == "terraform":\n';
    code += '            cmd = ["terraform", "plan", "-detailed-exitcode"]\n';
    code += '            try:\n';
    code += '                subprocess.run(cmd, check=True)\n';
    code += '                print("[IaC] ✓ No drift detected")\n';
    code += '            except subprocess.CalledProcessError:\n';
    code += '                print("[IaC] ⚠ Drift detected")\n\n';
  }

  code += '    def apply(self) -> None:\n';
  code += '        print("[IaC] Applying infrastructure changes...")\n\n';
  code += '        if self.provider == "terraform":\n';
  code += '            cmd = ["terraform", "apply", "tfplan"]\n';
  code += '        else:\n';
  code += '            cmd = ["pulumi", "up"]\n\n';
  code += '        subprocess.run(cmd, check=True)\n';
  code += '        print("[IaC] ✓ Apply completed")\n\n';

  code += '    def destroy(self) -> None:\n';
  code += '        print("[IaC] Destroying infrastructure...")\n\n';
  code += '        if self.provider == "terraform":\n';
  code += '            cmd = ["terraform", "destroy", "-auto-approve"]\n';
  code += '        else:\n';
  code += '            cmd = ["pulumi", "destroy"]\n\n';
  code += '        subprocess.run(cmd, check=True)\n';
  code += '        print("[IaC] ✓ Destroy completed")\n\n';

  code += '    def switch_workspace(self, environment: str) -> None:\n';
  code += '        print(f"[IaC] Switching to {environment} workspace...")\n\n';
  code += '        if self.provider == "terraform":\n';
  code += '            cmd = ["terraform", "workspace", "select", environment]\n';
  code += '        else:\n';
  code += '            cmd = ["pulumi", "stack", "select", environment]\n\n';
  code += '        subprocess.run(cmd, check=True)\n';
  code += '        print(f"[IaC] ✓ Switched to {environment}")\n\n';

  code += 'ia_c_manager = IaCManager()\n';

  return code;
}

export async function writeFiles(config: IaCConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Terraform files
  const terraformMain = generateTerraformMain(config);
  await fs.writeFile(path.join(outputDir, 'main.tf'), terraformMain);

  const terraformState = generateTerraformState(config);
  await fs.writeFile(path.join(outputDir, 'state.tf'), terraformState);

  // Generate Pulumi program if using Pulumi
  if (config.provider === 'pulumi') {
    const pulumiProgram = generatePulumiProgram(config);
    const extension = config.pulumi?.runtime === 'python' ? 'py' : 'ts';
    await fs.writeFile(path.join(outputDir, `PulumiProgram.${extension}`), pulumiProgram);
  }

  if (language === 'typescript') {
    const tsCode = generateTypeScriptIaCManager(config);
    await fs.writeFile(path.join(outputDir, 'iac-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-iac',
      version: '1.0.0',
      description: 'Infrastructure as Code with Terraform/Pulumi',
      main: 'iac-manager.ts',
      scripts: {
        init: 'terraform init',
        validate: 'terraform validate',
        plan: 'terraform plan -out=tfplan',
        apply: 'terraform apply tfplan',
        destroy: 'terraform destroy -auto-approve',
      },
      dependencies: {
        '@types/node': '^20.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonIaCManager(config);
    await fs.writeFile(path.join(outputDir, 'iac_manager.py'), pyCode);

    const requirements = [
      'pulumi>=3.100.0',
      'pulumi-aws>=6.0.0',
      'pulumi-azure>=5.0.0',
      'pulumi-gcp>=7.0.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateIaCMD(config);
  await fs.writeFile(path.join(outputDir, 'IAC.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    provider: config.provider,
    stateManagement: config.stateManagement,
    workspaces: config.workspaces,
    enableValidation: config.enableValidation,
    enableDriftDetection: config.enableDriftDetection,
  };
  await fs.writeFile(path.join(outputDir, 'iac-config.json'), JSON.stringify(configJson, null, 2));
}
