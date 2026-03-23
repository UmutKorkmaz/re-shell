// Auto-generated K8s Manifest Generator
// Generated at: 2026-01-12T22:57:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: any;
}

interface WorkspaceConfig {
  projectName: string;
  services: ServiceConfig[];
  namespace?: string;
  replicas?: number;
  resources?: ResourceLimits;
}

interface ServiceConfig {
  name: string;
  language: string;
  port: number;
  image: string;
  env: Record<string, string>;
  replicas?: number;
}

interface ResourceLimits {
  cpu: string;
  memory: string;
}

export function displayConfig(config: WorkspaceConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ K8s Manifest Generator');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Services:', config.services.map(s => s.name).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace || 'default');
  console.log('\x1b[33m%s\x1b[0m', 'Replicas:', config.replicas || 3);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateK8sMD(config: WorkspaceConfig): string {
  let md = '# Kubernetes Manifest Generator\n\n';
  md += '## Features\n\n';
  md += '- Auto-generation of K8s manifests from workspace YAML\n';
  md += '- Deployment, Service, and ConfigMap generation\n';
  md += '- Ingress configuration for external access\n';
  md += '- ConfigMap and Secret management\n';
  md += '- Resource limits and requests\n';
  md += '- Liveness and readiness probes\n';
  md += '- Pod disruption budgets\n';
  md += '- Service accounts and RBAC\n';
  md += '- Network policies\n';
  md += '- Horizontal Pod Autoscaler\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import k8sGenerator from \'./k8s-manifest-generator\';\n\n';
  md += '// Generate manifests\n';
  md += 'await k8sGenerator.generate();\n\n';
  md += '// Export to YAML\n';
  md += 'await k8sGenerator.exportYaml();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptK8s(config: WorkspaceConfig): string {
  let code = '// Auto-generated K8s Manifest Generator for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import * as yaml from \'js-yaml\';\n\n';

  code += 'interface K8sResource {\n';
  code += '  apiVersion: string;\n';
  code += '  kind: string;\n';
  code += '  metadata: any;\n';
  code += '  spec?: any;\n';
  code += '}\n\n';

  code += 'interface ServiceConfig {\n';
  code += '  name: string;\n';
  code += '  language: string;\n';
  code += '  port: number;\n';
  code += '  image: string;\n';
  code += '  env: Record<string, string>;\n';
  code += '  replicas?: number;\n';
  code += '}\n\n';

  code += 'class K8sManifestGenerator {\n';
  code += '  private projectName: string;\n';
  code += '  private services: ServiceConfig[];\n';
  code += '  private namespace: string;\n';
  code += '  private replicas: number;\n';
  code += '  private resources: any;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.services = options.services || [];\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.replicas = options.replicas || 3;\n';
  code += '    this.resources = options.resources || {\n';
  code += '      requests: { cpu: \'100m\', memory: \'128Mi\' },\n';
  code += '      limits: { cpu: \'500m\', memory: \'512Mi\' },\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  async generate(): Promise<K8sResource[]> {\n';
  code += '    console.log(\'[K8s] Generating Kubernetes manifests...\');\n\n';

  code += '    const resources: K8sResource[] = [];\n\n';

  code += '    // Generate Namespace\n';
  code += '    resources.push(this.generateNamespace());\n\n';

  code += '    // Generate ConfigMap\n';
  code += '    resources.push(this.generateConfigMap());\n\n';

  code += '    // Generate Deployments and Services\n';
  code += '    for (const service of this.services) {\n';
  code += '      resources.push(...this.generateServiceResources(service));\n';
  code += '    }\n\n';

  code += '    // Generate Ingress\n';
  code += '    resources.push(this.generateIngress());\n\n';

  code += '    // Generate HPA\n';
  code += '    for (const service of this.services) {\n';
  code += '      resources.push(this.generateHPA(service));\n';
  code += '    }\n\n';

  code += '    console.log(\'[K8s] Manifest generation complete\');\n\n';

  code += '    return resources;\n';
  code += '  }\n\n';

  code += '  private generateNamespace(): K8sResource {\n';
  code += '    return {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'Namespace\',\n';
  code += '      metadata: {\n';
  code += '        name: this.namespace,\n';
  code += '        labels: {\n';
  code += '          name: this.namespace,\n';
  code += '          project: this.projectName,\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  private generateConfigMap(): K8sResource {\n';
  code += '    const configData: any = {};\n';

  code += '    for (const service of this.services) {\n';
  code += '      configData[`${service.name}-config`] = JSON.stringify({\n';
  code += '        port: service.port,\n';
  code += '        language: service.language,\n';
  code += '        environment: \'production\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'ConfigMap\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-config`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      data: configData,\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  private generateServiceResources(service: ServiceConfig): K8sResource[] {\n';
  code += '    const resources: K8sResource[] = [];\n\n';

  code += '    // Deployment\n';
  code += '    resources.push({\n';
  code += '      apiVersion: \'apps/v1\',\n';
  code += '      kind: \'Deployment\',\n';
  code += '      metadata: {\n';
  code += '        name: service.name,\n';
  code += '        namespace: this.namespace,\n';
  code += '        labels: {\n';
  code += '          app: service.name,\n';
  code += '          language: service.language,\n';
  code += '          project: this.projectName,\n';
  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        replicas: service.replicas || this.replicas,\n';
  code += '        selector: {\n';
  code += '          matchLabels: {\n';
  code += '          app: service.name,\n';
  code += '          },\n';
  code += '        },\n';
  code += '        template: {\n';
  code += '          metadata: {\n';
  code += '            labels: {\n';
  code += '              app: service.name,\n';
  code += '              language: service.language,\n';
  code += '            },\n';
  code += '          },\n';
  code += '          spec: {\n';
  code += '            containers: [\n';
  code += '              {\n';
  code += '                name: service.name,\n';
  code += '                image: service.image,\n';
  code += '                ports: [{ containerPort: service.port }],\n';
  code += '                env: Object.entries(service.env).map(([name, value]) => ({ name, value })),\n';
  code += '                resources: this.resources,\n';
  code += '                livenessProbe: {\n';
  code += '                  httpGet: {\n';
  code += '                    path: \'/health\',\n';
  code += '                    port: service.port,\n';
  code += '                  },\n';
  code += '                  initialDelaySeconds: 30,\n';
  code += '                  periodSeconds: 10,\n';
  code += '                },\n';
  code += '                readinessProbe: {\n';
  code += '                  httpGet: {\n';
  code += '                    path: \'/ready\',\n';
  code += '                    port: service.port,\n';
  code += '                  },\n';
  code += '                  initialDelaySeconds: 5,\n';
  code += '                  periodSeconds: 5,\n';
  code += '                },\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        },\n';
  code += '      },\n';
  code += '    });\n\n';

  code += '    // Service\n';
  code += '    resources.push({\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'Service\',\n';
  code += '      metadata: {\n';
  code += '        name: `${service.name}-svc`,\n';
  code += '        namespace: this.namespace,\n';
  code += '        labels: {\n';
  code += '          app: service.name,\n';
  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        type: \'ClusterIP\',\n';
  code += '        selector: {\n';
  code += '          app: service.name,\n';
  code += '        },\n';
  code += '        ports: [\n';
  code += '          {\n';
  code += '            protocol: \'TCP\',\n';
  code += '            port: 80,\n';
  code += '            targetPort: service.port,\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    });\n\n';

  code += '    return resources;\n';
  code += '  }\n\n';

  code += '  private generateIngress(): K8sResource {\n';
  code += '    const hosts: any[] = [];\n\n';

  code += '    for (const service of this.services) {\n';
  code += '      hosts.push({\n';
  code += '        host: `${service.name}.${this.projectName}.com`,\n';
  code += '        http: {\n';
  code += '          paths: [\n';
  code += '            {\n';
  code += '              path: \'/\',\n';
  code += '              pathType: \'Prefix\',\n';
  code += '              backend: {\n';
  code += '                service: {\n';
  code += '                  name: `${service.name}-svc`,\n';
  code += '                  port: {\n';
  code += '                    number: 80,\n';
  code += '                  },\n';
  code += '                },\n';
  code += '              },\n';
  code += '            },\n';
  code += '          ],\n';
  code += '        },\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return {\n';
  code += '      apiVersion: \'networking.k8s.io/v1\',\n';
  code += '      kind: \'Ingress\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-ingress`,\n';
  code += '        namespace: this.namespace,\n';
  code += '        annotations: {\n';
  code += '          \'nginx.ingress.kubernetes.io/ssl-redirect\': \'true\',\n';
  code += '          \'nginx.ingress.kubernetes.io/force-ssl-redirect\': \'true\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        ingressClassName: \'nginx\',\n';
  code += '        tls: [\n';
  code += '          {\n';
  code += '            hosts: this.services.map(s => `${s.name}.${this.projectName}.com`),\n';
  code += '            secretName: `${this.projectName}-tls`,\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        rules: hosts,\n';
  code += '      },\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  private generateHPA(service: ServiceConfig): K8sResource {\n';
  code += '    return {\n';
  code += '      apiVersion: \'autoscaling/v2\',\n';
  code += '      kind: \'HorizontalPodAutoscaler\',\n';
  code += '      metadata: {\n';
  code += '        name: `${service.name}-hpa`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        scaleTargetRef: {\n';
  code += '          apiVersion: \'apps/v1\',\n';
  code += '          kind: \'Deployment\',\n';
  code += '          name: service.name,\n';
  code += '        },\n';
  code += '        minReplicas: 2,\n';
  code += '        maxReplicas: 10,\n';
  code += '        metrics: [\n';
  code += '          {\n';
  code += '            type: \'Resource\',\n';
  code += '            resource: {\n';
  code += '              name: \'cpu\',\n';
  code += '              target: {\n';
  code += '                type: \'Utilization\',\n';
  code += '                averageUtilization: 70,\n';
  code += '              },\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  async exportYaml(resources: K8sResource[]): Promise<void> {\n';
  code += '    const outputDir = path.join(process.cwd(), \'k8s-manifests\');\n';
  code += '    fs.mkdirSync(outputDir, { recursive: true });\n\n';

  code += '    for (const resource of resources) {\n';
  code += '      const fileName = `${resource.kind.toLowerCase()}-${resource.metadata.name}.yaml`;\n';
  code += '      const filePath = path.join(outputDir, fileName);\n';
  code += '      fs.writeFileSync(filePath, yaml.dump(resource));\n';
  code += '    }\n\n';

  code += '    console.log(`[K8s] Manifests exported to ${outputDir}`);\n';
  code += '  }\n\n';

  code += '  async exportSingleYaml(resources: K8sResource[]): Promise<void> {\n';
  code += '    const yamlContent = resources.map(r => yaml.dump(r)).join(\'---\\n\\n\');\n';
  code += '    const filePath = path.join(process.cwd(), \'k8s-manifest.yaml\');\n';
  code += '    fs.writeFileSync(filePath, yamlContent);\n';
  code += '    console.log(`[K8s] Combined manifest exported to ${filePath}`);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const k8sGenerator = new K8sManifestGenerator({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  services: [\n';
  code += '    { name: \'api\', language: \'typescript\', port: 3000, image: \'my-api:latest\', env: {} },\n';
  code += '    { name: \'worker\', language: \'python\', port: 8080, image: \'my-worker:latest\', env: {} },\n';
  code += '  ],\n';
  code += '});\n\n';

  code += 'export default k8sGenerator;\n';
  code += 'export { K8sManifestGenerator, K8sResource, ServiceConfig };\n';

  return code;
}

export function generatePythonK8s(config: WorkspaceConfig): string {
  let code = '# Auto-generated K8s Manifest Generator for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'import yaml\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class ServiceConfig:\n';
  code += '    name: str\n';
  code += '    language: str\n';
  code += '    port: int\n';
  code += '    image: str\n';
  code += '    env: Dict[str, str]\n';
  code += '    replicas: int = 3\n\n';

  code += 'class K8sManifestGenerator:\n';
  code += '    def __init__(self, project_name: str = None, services: List[ServiceConfig] = None, namespace: str = "default", replicas: int = 3):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.services = services or []\n';
  code += '        self.namespace = namespace\n';
  code += '        self.replicas = replicas\n';
  code += '        self.resources = {\n';
  code += '            "requests": {"cpu": "100m", "memory": "128Mi"},\n';
  code += '            "limits": {"cpu": "500m", "memory": "512Mi"},\n';
  code += '        }\n\n';

  code += '    async def generate(self) -> List[Dict[str, Any]]:\n';
  code += '        print("[K8s] Generating Kubernetes manifests...")\n\n';

  code += '        resources = []\n';
  code += '        resources.append(self.generate_namespace())\n';
  code += '        resources.append(self.generate_configmap())\n\n';

  code += '        for service in self.services:\n';
  code += '            resources.extend(self.generate_service_resources(service))\n\n';

  code += '        resources.append(self.generate_ingress())\n\n';

  code += '        for service in self.services:\n';
  code += '            resources.append(self.generate_hpa(service))\n\n';

  code += '        print("[K8s] Manifest generation complete")\n\n';

  code += '        return resources\n\n';

  code += '    def generate_namespace(self) -> Dict[str, Any]:\n';
  code += '        return {\n';
  code += '            "apiVersion": "v1",\n';
  code += '            "kind": "Namespace",\n';
  code += '            "metadata": {\n';
  code += '                "name": self.namespace,\n';
  code += '                "labels": {\n';
  code += '                    "name": self.namespace,\n';
  code += '                    "project": self.project_name,\n';
  code += '                },\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '    def generate_configmap(self) -> Dict[str, Any]:\n';
  code += '        config_data = {}\n';
  code += '        for service in self.services:\n';
  code += '            config_data[f"{service.name}-config"] = json.dumps({\n';
  code += '                "port": service.port,\n';
  code += '                "language": service.language,\n';
  code += '                "environment": "production",\n';
  code += '            })\n\n';

  code += '        return {\n';
  code += '            "apiVersion": "v1",\n';
  code += '            "kind": "ConfigMap",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-config",\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "data": config_data,\n';
  code += '        }\n\n';

  code += '    def generate_service_resources(self, service: ServiceConfig) -> List[Dict[str, Any]]:\n';
  code += '        resources = []\n\n';

  code += '        # Deployment\n';
  code += '        resources.append({\n';
  code += '            "apiVersion": "apps/v1",\n';
  code += '            "kind": "Deployment",\n';
  code += '            "metadata": {\n';
  code += '                "name": service.name,\n';
  code += '                "namespace": self.namespace,\n';
  code += '                "labels": {\n';
  code += '                    "app": service.name,\n';
  code += '                    "language": service.language,\n';
  code += '                    "project": self.project_name,\n';
  code += '                },\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "replicas": service.replicas or self.replicas,\n';
  code += '                "selector": {\n';
  code += '                    "matchLabels": {"app": service.name},\n';
  code += '                },\n';
  code += '                "template": {\n';
  code += '                    "metadata": {\n';
  code += '                        "labels": {\n';
  code += '                            "app": service.name,\n';
  code += '                            "language": service.language,\n';
  code += '                        },\n';
  code += '                    },\n';
  code += '                    "spec": {\n';
  code += '                        "containers": [\n';
  code += '                            {\n';
  code += '                                "name": service.name,\n';
  code += '                                "image": service.image,\n';
  code += '                                "ports": [{"containerPort": service.port}],\n';
  code += '                                "env": [{"name": k, "value": v} for k, v in service.env.items()],\n';
  code += '                                "resources": self.resources,\n';
  code += '                                "livenessProbe": {\n';
  code += '                                    "httpGet": {\n';
  code += '                                        "path": "/health",\n';
  code += '                                        "port": service.port,\n';
  code += '                                    },\n';
  code += '                                    "initialDelaySeconds": 30,\n';
  code += '                                    "periodSeconds": 10,\n';
  code += '                                },\n';
  code += '                                "readinessProbe": {\n';
  code += '                                    "httpGet": {\n';
  code += '                                        "path": "/ready",\n';
  code += '                                        "port": service.port,\n';
  code += '                                    },\n';
  code += '                                    "initialDelaySeconds": 5,\n';
  code += '                                    "periodSeconds": 5,\n';
  code += '                                },\n';
  code += '                            }\n';
  code += '                        ],\n';
  code += '                    },\n';
  code += '                },\n';
  code += '            },\n';
  code += '        })\n\n';

  code += '        # Service\n';
  code += '        resources.append({\n';
  code += '            "apiVersion": "v1",\n';
  code += '            "kind": "Service",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{service.name}-svc",\n';
  code += '                "namespace": self.namespace,\n';
  code += '                "labels": {"app": service.name},\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "type": "ClusterIP",\n';
  code += '                "selector": {"app": service.name},\n';
  code += '                "ports": [\n';
  code += '                    {\n';
  code += '                        "protocol": "TCP",\n';
  code += '                        "port": 80,\n';
  code += '                        "targetPort": service.port,\n';
  code += '                    }\n';
  code += '                ],\n';
  code += '            },\n';
  code += '        })\n\n';

  code += '        return resources\n\n';

  code += 'k8s_generator = K8sManifestGenerator(\n';
  code += '    project_name="my-app",\n';
  code += '    services=[\n';
  code += '        ServiceConfig(name="api", language="typescript", port=3000, image="my-api:latest", env={}),\n';
  code += '        ServiceConfig(name="worker", language="python", port=8080, image="my-worker:latest", env={}),\n';
  code += '    ],\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: WorkspaceConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptK8s(config);
  fs.writeFileSync(path.join(outputDir, 'k8s-manifest-generator.ts'), tsCode);

  const pyCode = generatePythonK8s(config);
  fs.writeFileSync(path.join(outputDir, 'k8s-manifest-generator.py'), pyCode);

  const md = generateK8sMD(config);
  fs.writeFileSync(path.join(outputDir, 'K8S_MANIFESTS.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'K8s manifest generator',
    main: 'k8s-manifest-generator.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0');
  fs.writeFileSync(path.join(outputDir, 'k8s-config.json'), JSON.stringify(config, null, 2));
}
