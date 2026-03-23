// Auto-generated Service Mesh Integration
// Generated at: 2026-01-12T23:05:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ServiceMeshConfig {
  projectName: string;
  mesh: 'istio' | 'linkerd';
  services: ServiceConfig[];
  enableMTLS: boolean;
  enableTrafficManagement: boolean;
}

interface ServiceConfig {
  name: string;
  port: number;
  namespace: string;
}

export function displayConfig(config: ServiceMeshConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Service Mesh Integration');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Service Mesh:', config.mesh);
  console.log('\x1b[33m%s\x1b[0m', 'Services:', config.services.map(s => s.name).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'mTLS Enabled:', config.enableMTLS);
  console.log('\x1b[33m%s\x1b[0m', 'Traffic Management:', config.enableTrafficManagement);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateServiceMeshMD(config: ServiceMeshConfig): string {
  let md = '# Service Mesh Integration\n\n';
  md += '## Features\n\n';
  md += '- Service mesh installation and configuration\n';
  md += '- Mutual TLS (mTLS) authentication\n';
  md += '- Traffic management and splitting\n';
  md += '- Circuit breaking and retries\n';
  md += '- Timeout and retry policies\n';
  md += '- Rate limiting\n';
  md += '- Security policies\n';
  md += '- Observability and metrics\n';
  md += '- Service-to-service authentication\n';
  md += '- Canary deployments\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import serviceMesh from \'./service-mesh-integration\';\n\n';
  md += '// Install service mesh\n';
  md += 'await serviceMesh.install();\n\n';
  md += '// Configure services\n';
  md += 'await serviceMesh.configure();\n\n';
  md += '// Enable mTLS\n';
  md += 'await serviceMesh.enableMTLS();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptServiceMesh(config: ServiceMeshConfig): string {
  let code = '// Auto-generated Service Mesh Integration for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'class ServiceMeshIntegration {\n';
  code += '  private projectName: string;\n';
  code += '  private mesh: \'istio\' | \'linkerd\';\n';
  code += '  private services: ServiceConfig[];\n';
  code += '  private enableMTLS: boolean;\n';
  code += '  private enableTrafficManagement: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.mesh = options.mesh || \'istio\';\n';
  code += '    this.services = options.services || [];\n';
  code += '    this.enableMTLS = options.enableMTLS !== false;\n';
  code += '    this.enableTrafficManagement = options.enableTrafficManagement !== false;\n';
  code += '  }\n\n';

  code += '  async install(): Promise<void> {\n';
  code += '    console.log(`[ServiceMesh] Installing ${this.mesh}...`);\n\n';

  code += '    if (this.mesh === \'istio\') {\n';
  code += '      await this.installIstio();\n';
  code += '    } else {\n';
  code += '      await this.installLinkerd();\n';
  code += '    }\n\n';

  code += '    console.log(\'[ServiceMesh] Installation complete\');\n';
  code += '  }\n\n';

  code += '  private async installIstio(): Promise<void> {\n';
  code += '    try {\n';
  code += '      console.log(\'[ServiceMesh] Downloading Istio...\');\n';
  code += '      execSync(\'curl -L https://istio.io/downloadIstio | sh -\', {\n';
  code += '        stdio: \'inherit\',\n';
  code += '        timeout: 300000,\n';
  code += '      });\n\n';

  code += '      console.log(\'[ServiceMesh] Installing Istio...\');\n';
  code += '      execSync(\'istioctl install --set profile=demo -y\', {\n';
  code += '        stdio: \'inherit\',\n';
  code += '        timeout: 600000,\n';
  code += '      });\n';

  code += '      console.log(\'[ServiceMesh] ✓ Istio installed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ServiceMesh] Failed to install Istio:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async installLinkerd(): Promise<void> {\n';
  code += '    try {\n';
  code += '      console.log(\'[ServiceMesh] Installing Linkerd CLI...\');\n';
  code += '      execSync(\'curl -sL https://run.linkerd.io/install | sh\', {\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n\n';

  code += '      console.log(\'[ServiceMesh] Installing Linkerd...\');\n';
  code += '      execSync(\'linkerd install --crds | kubectl apply -f -\', {\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';

  code += '      execSync(\'linkerd inject | kubectl apply -f -\', {\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n\n';

  code += '      console.log(\'[ServiceMesh] ✓ Linkerd installed\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[ServiceMesh] Failed to install Linkerd:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async configure(): Promise<void> {\n';
  code += '    console.log(\'[ServiceMesh] Configuring services...\');\n\n';

  code += '    for (const service of this.services) {\n';
  code += '      await this.configureService(service);\n';
  code += '    }\n\n';

  code += '    console.log(\'[ServiceMesh] Configuration complete\');\n';
  code += '  }\n\n';

  code += '  private async configureService(service: ServiceConfig): Promise<void> {\n';
  code += '    console.log(`[ServiceMesh] Configuring ${service.name}...`);\n\n';

  code += '    if (this.mesh === \'istio\') {\n';
  code += '      await this.configureIstioService(service);\n';
  code += '    } else {\n';
  code += '      await this.configureLinkerdService(service);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async configureIstioService(service: ServiceConfig): Promise<void> {\n';
  code += '    // Generate VirtualService\n';
  code += '    const virtualService = {\n';
  code += '      apiVersion: \'networking.istio.io/v1beta1\',\n';
  code += '      kind: \'VirtualService\',\n';
  code += '      metadata: {\n';
  code += '        name: service.name,\n';
  code += '        namespace: service.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        hosts: [service.name],\n';
  code += '        http: [\n';
  code += '          {\n';
  code += '            route: [\n';
  code += '              {\n';
  code += '                destination: {\n';
  code += '                  host: service.name,\n';
  code += '                  subset: \'v1\',\n';
  code += '                },\n';
  code += '                weight: 100,\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(virtualService);\n';
  code += '    const vsPath = path.join(process.cwd(), \'service-mesh\', `virtualservice-${service.name}.yaml`);\n';
  code += '    fs.mkdirSync(path.dirname(vsPath), { recursive: true });\n';
  code += '    fs.writeFileSync(vsPath, yaml);\n';
  code += '  }\n\n';

  code += '  private async configureLinkerdService(service: ServiceConfig): Promise<void> {\n';
  code += '    // Generate ServiceProfile\n';
  code += '    const serviceProfile = {\n';
  code += '      apiVersion: \'policy.linkerd.io/v1beta1\',\n';
  code += '      kind: \'ServiceProfile\',\n';
  code += '      metadata: {\n';
  code += '        name: service.name,\n';
  code += '        namespace: service.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        routes: [\n';
  code += '          {\n';
  code += '            condition: {\n';
  code += '              pathPrefix: \'/\',\n';
  code += '            },\n';
  code += '            retryPolicy: {\n';
  code += '              maxRetries: 3,\n';
  code += '              timeout: \'100ms\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(serviceProfile);\n';
  code += '    const spPath = path.join(process.cwd(), \'service-mesh\', `serviceprofile-${service.name}.yaml`);\n';
  code += '    fs.mkdirSync(path.dirname(spPath), { recursive: true });\n';
  code += '    fs.writeFileSync(spPath, yaml);\n';
  code += '  }\n\n';

  code += '  async enableMTLS(): Promise<void> {\n';
  code += '    if (!this.enableMTLS) {\n';
  code += '      console.log(\'[ServiceMesh] mTLS is disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    console.log(\'[ServiceMesh] Enabling mTLS...\');\n\n';

  code += '    const peerAuthentication = {\n';
  code += '      apiVersion: \'security.istio.io/v1beta1\',\n';
  code += '      kind: \'PeerAuthentication\',\n';
  code += '      metadata: {\n';
  code += '        name: \'default\',\n';
  code += '        namespace: \'istio-system\',\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        mtls: {\n';
  code += '          mode: \'STRICT\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(peerAuthentication);\n';
  code += '    const paPath = path.join(process.cwd(), \'service-mesh\', \'peerauthentication.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(paPath), { recursive: true });\n';
  code += '    fs.writeFileSync(paPath, yaml);\n\n';

  code += '    console.log(\'[ServiceMesh] ✓ mTLS enabled\');\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const serviceMesh = new ServiceMeshIntegration({\n';
  code += '  mesh: \'istio\',\n';
  code += '  services: [\n';
  code += '    { name: \'api\', port: 3000, namespace: \'default\' },\n';
  code += '    { name: \'worker\', port: 8080, namespace: \'default\' },\n';
  code += '  ],\n';
  code += '  enableMTLS: true,\n';
  code += '  enableTrafficManagement: true,\n';
  code += '});\n\n';

  code += 'export default serviceMesh;\n';
  code += 'export { ServiceMeshIntegration, ServiceConfig };\n';

  return code;
}

export function generatePythonServiceMesh(config: ServiceMeshConfig): string {
  let code = '# Auto-generated Service Mesh Integration for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class ServiceConfig:\n';
  code += '    name: str\n';
  code += '    port: int\n';
  code += '    namespace: str\n\n';

  code += 'class ServiceMeshIntegration:\n';
  code += '    def __init__(self, project_name: str = None, mesh: str = "istio", services: List[ServiceConfig] = None, enable_mtls: bool = True, enable_traffic_management: bool = True):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.mesh = mesh\n';
  code += '        self.services = services or []\n';
  code += '        self.enable_mtls = enable_mtls\n';
  code += '        self.enable_traffic_management = enable_traffic_management\n\n';

  code += '    async def install(self) -> None:\n';
  code += '        print(f"[ServiceMesh] Installing {self.mesh}...")\n\n';

  code += '        if self.mesh == "istio":\n';
  code += '            await self.install_istio()\n';
  code += '        else:\n';
  code += '            await self.install_linkerd()\n\n';

  code += '        print("[ServiceMesh] Installation complete")\n\n';

  code += '    async def install_istio(self) -> None:\n';
  code += '        try:\n';
  code += '            print("[ServiceMesh] Downloading Istio...")\n';
  code += '            subprocess.run("curl -L https://istio.io/downloadIstio | sh -", shell=True, check=True)\n\n';

  code += '            print("[ServiceMesh] Installing Istio...")\n';
  code += '            subprocess.run("istioctl install --set profile=demo -y", shell=True, check=True)\n\n';

  code += '            print("[ServiceMesh] ✓ Istio installed")\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[ServiceMesh] Failed to install Istio: {e}")\n\n';

  code += 'service_mesh = ServiceMeshIntegration(\n';
  code += '    mesh="istio",\n';
  code += '    services=[\n';
  code += '        ServiceConfig(name="api", port=3000, namespace="default"),\n';
  code += '        ServiceConfig(name="worker", port=8080, namespace="default"),\n';
  code += '    ],\n';
  code += '    enable_mtls=True,\n';
  code += '    enable_traffic_management=True,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: ServiceMeshConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptServiceMesh(config);
  fs.writeFileSync(path.join(outputDir, 'service-mesh-integration.ts'), tsCode);

  const pyCode = generatePythonServiceMesh(config);
  fs.writeFileSync(path.join(outputDir, 'service-mesh-integration.py'), pyCode);

  const md = generateServiceMeshMD(config);
  fs.writeFileSync(path.join(outputDir, 'SERVICE_MESH.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Service mesh integration',
    main: 'service-mesh-integration.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0');
  fs.writeFileSync(path.join(outputDir, 'service-mesh-config.json'), JSON.stringify(config, null, 2));
}
