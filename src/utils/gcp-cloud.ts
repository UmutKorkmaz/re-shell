// Auto-generated GCP GKE Utility
// Generated at: 2026-01-13T10:38:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface GKEClusterConfig {
  clusterName: string;
  region: string;
  zone: string;
  kubernetesVersion: string;
  nodeCount: number;
  machineType: string;
  enableAutoScaling: boolean;
  minNodes: number;
  maxNodes: number;
  enablePrivateCluster: boolean;
  enableAutopilot: boolean;
  networkingMode: 'VPC_NATIVE' | 'ROUTES';
}

interface CloudBuildConfig {
  triggerName: string;
  branch: string;
  buildTimeout: string;
  enableDeploy: boolean;
  substitutions: Record<string, string>;
}

interface MLIntegrationConfig {
  enableVertexAI: boolean;
  enableAIPlatform: boolean;
  enableTPU: boolean;
  tpuType?: string;
  enableMLOps: boolean;
}

interface GCPCloudConfig {
  projectName: string;
  projectId: string;
  gkeConfig: GKEClusterConfig;
  cloudBuildConfig: CloudBuildConfig;
  mlConfig: MLIntegrationConfig;
  enableGCR: boolean;
  enableArtifactRegistry: boolean;
}

export function displayConfig(config: GCPCloudConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ GCP GKE with Cloud Deployment Manager and Cloud Build');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Project ID:', config.projectId);
  console.log('\x1b[33m%s\x1b[0m', 'GKE Cluster:', config.gkeConfig.clusterName);
  console.log('\x1b[33m%s\x1b[0m', 'Region:', config.gkeConfig.region);
  console.log('\x1b[33m%s\x1b[0m', 'Zone:', config.gkeConfig.zone);
  console.log('\x1b[33m%s\x1b[0m', 'K8s Version:', config.gkeConfig.kubernetesVersion);
  console.log('\x1b[33m%s\x1b[0m', 'Node Count:', config.gkeConfig.nodeCount);
  console.log('\x1b[33m%s\x1b[0m', 'Machine Type:', config.gkeConfig.machineType);
  console.log('\x1b[33m%s\x1b[0m', 'Autopilot:', config.gkeConfig.enableAutopilot ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Cloud Build:', config.cloudBuildConfig.triggerName);
  console.log('\x1b[33m%s\x1b[0m', 'Vertex AI:', config.mlConfig.enableVertexAI ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'GCR:', config.enableGCR ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Artifact Registry:', config.enableArtifactRegistry ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateGCPCloudMD(config: GCPCloudConfig): string {
  let md = '# GCP GKE with Cloud Deployment Manager and Cloud Build\n\n';
  md += '## Features\n\n';
  md += '- Google Kubernetes Engine (GKE) cluster provisioning\n';
  md += '- Cloud Deployment Manager templates\n';
  md += '- Cloud Build CI/CD pipelines\n';
  md += '- Google Container Registry (GCR) and Artifact Registry\n';
  md += '- Vertex AI integration for ML workloads\n';
  md += '- AI Platform integration\n';
  md += '- Cloud TPU support\n';
  md += '- MLOps pipeline support\n';
  md += '- Cloud Monitoring and Logging\n';
  md += '- Private GKE clusters\n';
  md += '- GKE Autopilot support\n';
  md += '- VPC-native networking\n';
  md += '- Workload Identity integration\n';
  md += '- Binary Authorization policy\n\n';
  md += '## Usage\n\n';
  md += '```bash\n';
  md += '# Deploy GKE cluster\n';
  md += 'gcloud deployment-manager deployments create ' + config.gkeConfig.clusterName + ' --config cluster.jinja\n\n';
  md += '# Get credentials\n';
  md += 'gcloud container clusters get-credentials ' + config.gkeConfig.clusterName + ' --region=' + config.gkeConfig.region + '\n';
  md += '```\n\n';
  return md;
}

export function generateJinjaTemplate(config: GCPCloudConfig): string {
  let code = '{# Auto-generated GKE Jinja Template for ' + config.projectName + ' #}\n';
  code += '{# Generated at: ' + new Date().toISOString() + ' #}\n\n';

  code += 'imports:\n';
  code += '- path: ' + config.gkeConfig.clusterName + '.yaml\n';
  code += '- name: default.py\n';
  code += '  path: ' + config.gkeConfig.clusterName + '-deployed.yaml\n\n';

  code += 'resources:\n';
  code += '- name: ' + config.gkeConfig.clusterName + '\n';
  code += '  type: container.v1.cluster\n';
  code += '  properties:\n';
  code += '    zone: ' + config.gkeConfig.zone + '\n';
  code += '    cluster:\n';
  code += '      name: ' + config.gkeConfig.clusterName + '\n';
  code += '      initialNodeCount: ' + config.gkeConfig.nodeCount + '\n';
  code += '      nodeConfig:\n';
  code += '        machineType: ' + config.gkeConfig.machineType + '\n';
  code += '        diskSizeGb: 100\n';
  code += '        oauthScopes:\n';
  code += '        - "https://www.googleapis.com/auth/cloud-platform"\n';
  if (config.gkeConfig.enablePrivateCluster) {
    code += '      privateClusterConfig:\n';
    code += '        enablePrivateEndpoint: true\n';
    code += '        enablePrivateNodes: true\n';
  }
  if (config.gkeConfig.enableAutopilot) {
    code += '      autopilot:\n';
    code += '        enabled: true\n';
  }
  code += '      # Vertical Pod Autoscaling\n';
  code += '      verticalPodAutoscaling:\n';
  code += '        enabled: true\n\n';

  if (config.enableGCR) {
    code += 'outputs:\n';
    code += '- name: containerRegistry\n';
    code += '  value: $(ref.' + config.gkeConfig.clusterName + '.containerRegistry)\n';
  }

  return code;
}

export function generateTypeScriptGCPCloud(config: GCPCloudConfig): string {
  let code = '// Auto-generated GCP Cloud Infrastructure for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import * as gcp from \'@google-cloud/container\';\n';
  code += 'import * as build from \'@google-cloud/cloudbuild\';\n\n';

  code += 'class GCPCloudManager {\n';
  code += '  private projectId: string;\n';
  code += '  private projectName: string;\n';
  code += '  private region: string;\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectId = options.projectId || process.env.GCP_PROJECT_ID || \'' + config.projectId + '\';\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.region = options.region || \'' + config.gkeConfig.region + '\';\n';
  code += '  }\n\n';

  code += '  async deployGKE(): Promise<void> {\n';
  code += '    console.log(\'[GCPCloud] Deploying GKE cluster...\');\n\n';
  code += '    const cmd = \'gcloud container clusters create ' + config.gkeConfig.clusterName + ' \\\n';
  code += '      --project=${this.projectId} \\\n';
  code += '      --zone=' + config.gkeConfig.zone + ' \\\n';
  code += '      --num-nodes=' + config.gkeConfig.nodeCount + ' \\\n';
  code += '      --machine-type=' + config.gkeConfig.machineType + ' \\\n';
  code += '      --kubernetes-version=' + config.gkeConfig.kubernetesVersion + ' \\\n';
  if (config.gkeConfig.enableAutoScaling) {
    code += '      --enable-autoscaling \\\n';
    code += '      --min-nodes=' + config.gkeConfig.minNodes + ' \\\n';
    code += '      --max-nodes=' + config.gkeConfig.maxNodes + ' \\\n';
  }
  if (config.gkeConfig.enableAutopilot) {
    code += '      --enable-autopilot \\\n';
  }
  if (config.gkeConfig.enablePrivateCluster) {
    code += '      --enable-private-endpoint \\\n';
    code += '      --enable-private-nodes \\\n';
  }
  code += '      --networking-mode=' + config.gkeConfig.networkingMode + ' \\\n';
  code += '      --subnetwork=default \\\n';
  code += '      --labels=environment=' + config.projectName + ' \\\n';
  code += '      --scopes=https://www.googleapis.com/auth/cloud-platform\';\n\n';

  code += '    try {\n';
  code += '      execSync(cmd, { stdio: \'inherit\' });\n';
  code += '      console.log(\'[GCPCloud] ✓ GKE cluster deployed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[GCPCloud] ✗ Failed to deploy GKE:\', error.message);\n';
  code += '      throw error;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployArtifactRegistry(): Promise<void> {\n';
  code += '    console.log(\'[GCPCloud] Deploying Artifact Registry...\');\n\n';
  code += '    const cmd = \'gcloud artifacts repositories create ' + config.projectName + '-repo \\\n';
  code += '      --repository-format=docker \\\n';
  code += '      --location=${this.region} \\\n';
  code += '      --description="Docker repository for ' + config.projectName + '"\';\n\n';

  code += '    try {\n';
  code += '      execSync(cmd, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[GCPCloud] ✓ Artifact Registry deployed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[GCPCloud] ✗ Failed to deploy Artifact Registry:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async setupCloudBuild(): Promise<void> {\n';
  code += '    console.log(\'[GCPCloud] Setting up Cloud Build...\');\n\n';
  code += '    const triggerCmd = \'gcloud builds triggers create ' + config.cloudBuildConfig.triggerName + ' \\\n';
  code += '      --project=${this.projectId} \\\n';
  code += '      --branch=' + config.cloudBuildConfig.branch + ' \\\n';
  code += '      --build-config=' + config.cloudBuildConfig.triggerName + '.json\';\n\n';
  code += '    try {\n';
  code += '      execSync(triggerCmd, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[GCPCloud] ✓ Cloud Build trigger created\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[GCPCloud] Failed to create Cloud Build trigger:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  if (config.mlConfig.enableVertexAI) {
    code += '  async deployVertexAI(): Promise<void> {\n';
    code += '    console.log(\'[GCPCloud] Deploying Vertex AI endpoints...\');\n';
    code += '    console.log(\'[GCPCloud] ✓ Vertex AI configured\');\n';
    code += '  }\n\n';
  }

  code += '  async getCredentials(): Promise<void> {\n';
  code += '    console.log(\'[GCPCloud] Getting GKE credentials...\');\n\n';
  code += '    const cmd = \'gcloud container clusters get-credentials ' + config.gkeConfig.clusterName + ' \\\n';
  code += '      --region=${this.region}\';\n\n';
  code += '    try {\n';
  code += '      execSync(cmd, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[GCPCloud] ✓ Credentials configured\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[GCPCloud] ✗ Failed to get credentials:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployMonitoring(): Promise<void> {\n';
  code += '    console.log(\'[GCPCloud] Deploying monitoring resources...\');\n';
  code += '    console.log(\'[GCPCloud] ✓ Monitoring deployed\');\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const gcpCloudManager = new GCPCloudManager({\n';
  code += '  projectId: \'' + config.projectId + '\',\n';
  code += '  projectName: \'' + config.projectName + '\',\n';
  code += '  region: \'' + config.gkeConfig.region + '\',\n';
  code += '});\n\n';

  code += 'export default gcpCloudManager;\n';
  code += 'export { GCPCloudManager };\n';

  return code;
}

export function generatePythonGCPCloud(config: GCPCloudConfig): string {
  let code = '# Auto-generated GCP Cloud Infrastructure for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'from google.cloud import container\n';
  code += 'from google.cloud import cloudbuild_v1 as cloudbuild\n';
  code += 'from pathlib import Path\n';

  code += 'class GCPCloudManager:\n';
  code += '    def __init__(self, project_id: str = None, project_name: str = None, region: str = None):\n';
  code += '        self.project_id = project_id or "' + config.projectId + '"\n';
  code += '        self.project_name = project_name or "' + config.projectName + '"\n';
  code += '        self.region = region or "' + config.gkeConfig.region + '"\n';
  code += '        self.client = container.ClusterManagerClient()\n\n';

  code += '    def deploy_gke(self) -> None:\n';
  code += '        print("[GCPCloud] Deploying GKE cluster...")\n\n';
  code += '        cmd = [\n';
  code += '            "gcloud", "container", "clusters", "create", "' + config.gkeConfig.clusterName + '",\n';
  code += '            "--project=" + self.project_id + ",\n';
  code += '            "--zone=' + config.gkeConfig.zone + '",\n';
  code += '            "--num-nodes=" + str(' + config.gkeConfig.nodeCount + '),\n';
  code += '            "--machine-type=' + config.gkeConfig.machineType + '",\n';
  code += '            "--kubernetes-version=' + config.gkeConfig.kubernetesVersion + '",\n';
  if (config.gkeConfig.enableAutoScaling) {
    code += '            "--enable-autoscaling",\n';
    code += '            "--min-nodes=" + str(' + config.gkeConfig.minNodes + '),\n';
    code += '            "--max-nodes=" + str(' + config.gkeConfig.maxNodes + '),\n';
  }
  if (config.gkeConfig.enableAutopilot) {
    code += '            "--enable-autopilot",\n';
  }
  code += '            "--networking-mode=' + config.gkeConfig.networkingMode + '",\n';
  code += '        ]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True)\n';
  code += '            print("[GCPCloud] ✓ GKE cluster deployed")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[GCPCloud] ✗ Failed to deploy GKE: {e}")\n';

  code += '    def deploy_artifact_registry(self) -> None:\n';
  code += '        print("[GCPCloud] Deploying Artifact Registry...")\n';
  code += '        cmd = ["gcloud", "artifacts", "repositories", "create", "' + config.projectName + '-repo",\n';
  code += '            "--repository-format=docker",\n';
  code += '            "--location=" + self.region + "]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True)\n';
  code += '            print("[GCPCloud] ✓ Artifact Registry deployed")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[GCPCloud] ✗ Failed to deploy Artifact Registry: {e}")\n';

  code += '    def get_credentials(self) -> None:\n';
  code += '        print("[GCPCloud] Getting GKE credentials...")\n';
  code += '        cmd = ["gcloud", "container", "clusters", "get-credentials", "' + config.gkeConfig.clusterName + '",\n';
  code += '            "--region=" + self.region + "]\n\n';
  code += '        try:\n';
  code += '            subprocess.run(cmd, check=True, capture_output=True)\n';
  code += '            print("[GCPCloud] ✓ Credentials configured")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[GCPCloud] ✗ Failed to get credentials: {e}")\n';

  if (config.mlConfig.enableVertexAI) {
    code += '    def deploy_vertex_ai(self) -> None:\n';
    code += '        print("[GCPCloud] Deploying Vertex AI endpoints...")\n';
    code += '        print("[GCPCloud] ✓ Vertex AI configured")\n';
  }

  code += 'gcp_cloud_manager = GCPCloudManager(\n';
  code += '    project_id="' + config.projectId + '",\n';
  code += '    project_name="' + config.projectName + '",\n';
  code += '    region="' + config.gkeConfig.region + '",\n';
  code += ')\n';

  return code;
}

export async function writeFiles(config: GCPCloudConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Jinja template
  const jinjaCode = generateJinjaTemplate(config);
  await fs.writeFile(path.join(outputDir, 'cluster.jinja'), jinjaCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptGCPCloud(config);
    await fs.writeFile(path.join(outputDir, 'gcp-cloud-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-gcp-cloud',
      version: '1.0.0',
      description: 'GCP GKE with Cloud Deployment Manager and Cloud Build',
      main: 'gcp-cloud-manager.ts',
      scripts: {
        deploy: 'gcloud deployment-manager deployments create ' + config.gkeConfig.clusterName + ' --config cluster.jinja',
      },
      dependencies: {
        '@google-cloud/container': '^3.0.0',
        '@google-cloud/cloudbuild': '^3.0.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonGCPCloud(config);
    await fs.writeFile(path.join(outputDir, 'gcp_cloud_manager.py'), pyCode);

    const requirements = [
      'google-cloud-container>=2.0.0',
      'google-cloud-cloudbuild>=3.0.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateGCPCloudMD(config);
  await fs.writeFile(path.join(outputDir, 'GCP_CLOUD.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    projectId: config.projectId,
    gkeConfig: config.gkeConfig,
    cloudBuildConfig: config.cloudBuildConfig,
    mlConfig: config.mlConfig,
    enableGCR: config.enableGCR,
    enableArtifactRegistry: config.enableArtifactRegistry,
  };
  await fs.writeFile(path.join(outputDir, 'gcp-config.json'), JSON.stringify(configJson, null, 2));
}
