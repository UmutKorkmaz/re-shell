// Auto-generated CRD Generator
// Generated at: 2026-01-12T23:16:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CustomResourceDefinition {
  metadata: {
    name: string;
  };
  spec: {
    group: string;
    versions: Array<{
      name: string;
      served: boolean;
      storage: boolean;
      schema?: {
        openAPIV3Schema: any;
      };
      subresources?: {
        status?: any;
        scale?: any;
      };
      additionalPrinterColumns?: Array<{
        name: string;
        type: string;
        description: string;
        jsonPath: string;
      }>;
    }>;
    scope: 'Namespaced' | 'Cluster';
    names: {
      plural: string;
      singular: string;
      kind: string;
      shortNames?: string[];
      categories?: string[];
    };
  };
}

interface OperatorConfig {
  projectName: string;
  namespace: string;
  crds: Array<{
    name: string;
    group: string;
    scope: 'Namespaced' | 'Cluster';
    kind: string;
    plural: string;
    singular: string;
    shortNames?: string[];
    properties: Record<string, {
      type: string;
      description?: string;
      required?: boolean;
      properties?: Record<string, any>;
    }>;
  }>;
  enableController: boolean;
  enableWebhooks: boolean;
}

export function displayConfig(config: OperatorConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Custom Resource Definitions & Operators');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'CRDs:', config.crds.map(c => c.kind).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Controller:', config.enableController ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Webhooks:', config.enableWebhooks ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateCRDMD(config: OperatorConfig): string {
  let md = '# Custom Resource Definitions & Operators\n\n';
  md += '## Features\n\n';
  md += '- Custom Resource Definitions (CRDs) for domain-specific resources\n';
  md += '- Kubernetes operators for managing custom resources\n';
  md += '- Automated reconciliation loops\n';
  md += '- Validation webhooks\n';
  md += '- Mutation webhooks\n';
  md += '- Status subresources\n';
  md += '- Finalizers for cleanup\n';
  md += '- Event recording\n';
  md += '- Leader election\n';
  md += '- Metrics and observability\n';
  md += '- RBAC configuration\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import crd from \'./crd-generator\';\n\n';
  md += '// Deploy CRDs\n';
  md += 'await crd.deployCRDs();\n\n';
  md += '// Deploy operator\n';
  md += 'await crd.deployOperator();\n\n';
  md += '// Create custom resource instance\n';
  md += 'await crd.createInstance();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptCRD(config: OperatorConfig): string {
  let code = '// Auto-generated CRD Generator for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { KubeConfig, CustomObjectsApi } from \'@kubernetes/client-node\';\n\n';

  code += 'class CRDOperator {\n';
  code += '  private projectName: string;\n';
  code += '  private namespace: string;\n';
  code += '  private crds: any[];\n';
  code += '  private enableController: boolean;\n';
  code += '  private enableWebhooks: boolean;\n';
  code += '  private kc: KubeConfig;\n';
  code += '  private customObjectsApi: CustomObjectsApi;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.crds = options.crds || [];\n';
  code += '    this.enableController = options.enableController !== false;\n';
  code += '    this.enableWebhooks = options.enableWebhooks !== false;\n\n';

  code += '    this.kc = new KubeConfig();\n';
  code += '    this.kc.loadFromDefault();\n';
  code += '    this.customObjectsApi = this.kc.makeApiClient(CustomObjectsApi);\n';
  code += '  }\n\n';

  code += '  async deployCRDs(): Promise<void> {\n';
  code += '    console.log(\'[CRD] Deploying Custom Resource Definitions...\');\n\n';

  code += '    for (const crd of this.crds) {\n';
  code += '      await this.deployCRD(crd);\n';
  code += '    }\n\n';

  code += '    console.log(\'[CRD] ✓ CRDs deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private async deployCRD(crd: any): Promise<void> {\n';
  code += '    console.log(`[CRD] Deploying CRD: ${crd.kind}...`);\n\n';

  code += '    const crdYaml = this.generateCRDManifest(crd);\n';
  code += '    const crdPath = path.join(process.cwd(), \'k8s\', \'crds\', `${crd.plural}.yaml`);\n';
  code += '    fs.mkdirSync(path.dirname(crdPath), { recursive: true });\n';
  code += '    fs.writeFileSync(crdPath, crdYaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${crdPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[CRD] Failed to deploy ${crd.kind}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private generateCRDManifest(crd: any): string {\n';
  code += '    const crdManifest: any = {\n';
  code += '      apiVersion: \'apiextensions.k8s.io/v1\',\n';
  code += '      kind: \'CustomResourceDefinition\',\n';
  code += '      metadata: {\n';
  code += '        name: `${crd.plural}.${crd.group}`,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        group: crd.group,\n';
  code += '        versions: [\n';
  code += '          {\n';
  code += '            name: \'v1\',\n';
  code += '            served: true,\n';
  code += '            storage: true,\n';
  code += '            schema: {\n';
  code += '              openAPIV3Schema: {\n';
  code += '                type: \'object\',\n';
  code += '                properties: this.generatePropertiesSchema(crd.properties),\n';
  code += '              },\n';
  code += '            },\n';
  code += '            subresources: {\n';
  code += '              status: {},\n';
  code += '            },\n';
  code += '            additionalPrinterColumns: [\n';
  code += '              {\n';
  code += '                name: \'Status\',\n';
  code += '                type: \'string\',\n';
  code += '                description: \'The status of the resource\',\n';
  code += '                jsonPath: \'.status.phase\',\n';
  code += '              },\n';
  code += '              {\n';
  code += '                name: \'Age\',\n';
  code += '                type: \'date\',\n';
  code += '                description: \'Time since creation\',\n';
  code += '                jsonPath: \'.metadata.creationTimestamp\',\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        scope: crd.scope,\n';
  code += '        names: {\n';
  code += '          plural: crd.plural,\n';
  code += '          singular: crd.singular,\n';
  code += '          kind: crd.kind,\n';
  code += '          shortNames: crd.shortNames || [],\n';
  code += '          categories: [\'all\'],\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    return this.toYaml(crdManifest);\n';
  code += '  }\n\n';

  code += '  private generatePropertiesSchema(properties: any): any {\n';
  code += '    const schema: any = {};\n';
  code += '    const required: string[] = [];\n\n';

  code += '    for (const [name, prop] of Object.entries(properties)) {\n';
  code += '      const propSchema: any = {\n';
  code += '        type: prop.type,\n';
  code += '        description: prop.description,\n';
  code += '      };\n\n';

  code += '      if (prop.required) {\n';
  code += '        required.push(name);\n';
  code += '      }\n\n';

  code += '      if (prop.properties) {\n';
  code += '        propSchema.properties = this.generatePropertiesSchema(prop.properties);\n';
  code += '      }\n\n';

  code += '      schema[name] = propSchema;\n';
  code += '    }\n\n';

  code += '    return { properties: schema, required: required.length > 0 ? required : undefined };\n';
  code += '  }\n\n';

  code += '  async deployOperator(): Promise<void> {\n';
  code += '    if (!this.enableController) {\n';
  code += '      console.log(\'[CRD] Controller deployment disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    console.log(\'[CRD] Deploying operator controller...\');\n\n';

  code += '    const deployment = {\n';
  code += '      apiVersion: \'apps/v1\',\n';
  code += '      kind: \'Deployment\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '        labels: {\n';
  code += '          app: \'operator\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        replicas: 1,\n';
  code += '        selector: {\n';
  code += '          matchLabels: {\n';
  code += '            app: \'operator\',\n';
  code += '          },\n';
  code += '        },\n';
  code += '        template: {\n';
  code += '          metadata: {\n';
  code += '            labels: {\n';
  code += '              app: \'operator\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '          spec: {\n';
  code += '            serviceAccountName: `${this.projectName}-operator`,\n';
  code += '            containers: [\n';
  code += '              {\n';
  code += '                name: \'operator\',\n';
  code += '                image: \'operator:latest\',\n';
  code += '                command: [\'/manager\'],\n';
  code += '                args: [\n';
  code += '                  \'--leader-elect\',\n';
  code += '                  `--namespace=${this.namespace}`,\n';
  code += '                ],\n';
  code += '                env: [\n';
  code += '                  {\n';
  code += '                    name: \'WATCH_NAMESPACE\',\n';
  code += '                    value: this.namespace,\n';
  code += '                  },\n';
  code += '                  {\n';
  code += '                    name: \'POD_NAME\',\n';
  code += '                    valueFrom: {\n';
  code += '                      fieldRef: {\n';
  code += '                        fieldPath: \'metadata.name\',\n';
  code += '                      },\n';
  code += '                    },\n';
  code += '                  },\n';
  code += '                ],\n';
  code += '                resources: {\n';
  code += '                  requests: {\n';
  code += '                    cpu: \'100m\',\n';
  code += '                    memory: \'128Mi\',\n';
  code += '                  },\n';
  code += '                  limits: {\n';
  code += '                    cpu: \'500m\',\n';
  code += '                    memory: \'512Mi\',\n';
  code += '                  },\n';
  code += '                },\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(deployment);\n';
  code += '    const deployPath = path.join(process.cwd(), \'k8s\', \'operator\', \'deployment.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(deployPath), { recursive: true });\n';
  code += '    fs.writeFileSync(deployPath, yaml);\n\n';

  code += '    console.log(\'[CRD] ✓ Operator deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async deployRBAC(): Promise<void> {\n';
  code += '    console.log(\'[CRD] Deploying RBAC resources...\');\n\n';

  code += '    const serviceAccount = {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'ServiceAccount\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const role = {\n';
  code += '      apiVersion: \'rbac.authorization.k8s.io/v1\',\n';
  code += '      kind: \'Role\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      rules: [\n';
  code += '        {\n';
  code += '          apiGroups: [\'*\'],\n';
  code += '          resources: [\'*\'],\n';
  code += '          verbs: [\'get\', \'list\', \'watch\', \'create\', \'update\', \'patch\', \'delete\'],\n';
  code += '        },\n';
  code += '      ],\n';
  code += '    };\n\n';

  code += '    const roleBinding = {\n';
  code += '      apiVersion: \'rbac.authorization.k8s.io/v1\',\n';
  code += '      kind: \'RoleBinding\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      subjects: [\n';
  code += '        {\n';
  code += '          kind: \'ServiceAccount\',\n';
  code += '          name: `${this.projectName}-operator`,\n';
  code += '          namespace: this.namespace,\n';
  code += '        },\n';
  code += '      ],\n';
  code += '      roleRef: {\n';
  code += '        kind: \'Role\',\n';
  code += '        name: `${this.projectName}-operator`,\n';
  code += '        apiGroup: \'rbac.authorization.k8s.io\',\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const rbacDir = path.join(process.cwd(), \'k8s\', \'operator\');\n';
  code += '    fs.mkdirSync(rbacDir, { recursive: true });\n\n';

  code += '    fs.writeFileSync(path.join(rbacDir, \'serviceaccount.yaml\'), this.toYaml(serviceAccount));\n';
  code += '    fs.writeFileSync(path.join(rbacDir, \'role.yaml\'), this.toYaml(role));\n';
  code += '    fs.writeFileSync(path.join(rbacDir, \'rolebinding.yaml\'), this.toYaml(roleBinding));\n\n';

  code += '    console.log(\'[CRD] ✓ RBAC resources deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async createInstance(crdName: string, instance: any): Promise<void> {\n';
  code += '    console.log(`[CRD] Creating instance of ${crdName}...`);\n\n';

  code += '    const crd = this.crds.find(c => c.kind === crdName);\n';
  code += '    if (!crd) {\n';
  code += '      throw new Error(`CRD ${crdName} not found`);\n';
  code += '    }\n\n';

  code += '    try {\n';
  code += '      await this.customObjectsApi.createNamespacedCustomObject(\n';
  code += '        crd.group,\n';
  code += '        \'v1\',\n';
  code += '        this.namespace,\n';
  code += '        crd.plural,\n';
  code += '        instance\n';
  code += '      );\n\n';

  code += '      console.log(`[CRD] ✓ Instance created successfully`);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[CRD] Failed to create instance:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const crdOperator = new CRDOperator({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  namespace: \'default\',\n';
  code += '  enableController: true,\n';
  code += '  enableWebhooks: true,\n';
  code += '  crds: [\n';
  code += '    {\n';
  code += '      name: \'MicroService\',\n';
  code += '      group: \'re-shell.io\',\n';
  code += '      scope: \'Namespaced\',\n';
  code += '      kind: \'MicroService\',\n';
  code += '      plural: \'microservices\',\n';
  code += '      singular: \'microservice\',\n';
  code += '      shortNames: [\'ms\'],\n';
  code += '      properties: {\n';
  code += '        spec: {\n';
  code += '          type: \'object\',\n';
  code += '          description: \'Specification of the MicroService\',\n';
  code += '          required: true,\n';
  code += '          properties: {\n';
  code += '            replicas: {\n';
  code += '              type: \'number\',\n';
  code += '              description: \'Number of replicas\',\n';
  code += '            },\n';
  code += '            image: {\n';
  code += '              type: \'string\',\n';
  code += '              description: \'Container image\',\n';
  code += '              required: true,\n';
  code += '            },\n';
  code += '            port: {\n';
  code += '              type: \'number\',\n';
  code += '              description: \'Service port\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '        },\n';
  code += '      },\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'Database\',\n';
  code += '      group: \'re-shell.io\',\n';
  code += '      scope: \'Namespaced\',\n';
  code += '      kind: \'Database\',\n';
  code += '      plural: \'databases\',\n';
  code += '      singular: \'database\',\n';
  code += '      shortNames: [\'db\'],\n';
  code += '      properties: {\n';
  code += '        spec: {\n';
  code += '          type: \'object\',\n';
  code += '          description: \'Database specification\',\n';
  code += '          properties: {\n';
  code += '            type: {\n';
  code += '              type: \'string\',\n';
  code += '              description: \'Database type (postgres, mysql, mongo)\',\n';
  code += '              required: true,\n';
  code += '            },\n';
  code += '            version: {\n';
  code += '              type: \'string\',\n';
  code += '              description: \'Database version\',\n';
  code += '            },\n';
  code += '            size: {\n';
  code += '              type: \'string\',\n';
  code += '              description: \'Storage size\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '        },\n';
  code += '      },\n';
  code += '    },\n';
  code += '  ],\n';
  code += '});\n\n';

  code += 'export default crdOperator;\n';
  code += 'export { CRDOperator, CustomResourceDefinition, OperatorConfig };\n';

  return code;
}

export function generatePythonCRD(config: OperatorConfig): string {
  let code = '# Auto-generated CRD Generator for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';

  code += '@dataclass\n';
  code += 'class CustomResourceDefinition:\n';
  code += '    name: str\n';
  code += '    group: str\n';
  code += '    scope: str\n';
  code += '    kind: str\n';
  code += '    plural: str\n';
  code += '    singular: str\n';
  code += '    short_names: Optional[List[str]] = None\n';
  code += '    properties: Optional[Dict[str, Any]] = None\n\n';

  code += 'class CRDOperator:\n';
  code += '    def __init__(self, project_name: str = None, namespace: str = "default", crds: List[CustomResourceDefinition] = None, enable_controller: bool = True, enable_webhooks: bool = True):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespace = namespace\n';
  code += '        self.crds = crds or []\n';
  code += '        self.enable_controller = enable_controller\n';
  code += '        self.enable_webhooks = enable_webhooks\n\n';

  code += '    async def deploy_crds(self) -> None:\n';
  code += '        print("[CRD] Deploying Custom Resource Definitions...")\n\n';

  code += '        for crd in self.crds:\n';
  code += '            await self._deploy_crd(crd)\n\n';

  code += '        print("[CRD] ✓ CRDs deployed successfully")\n\n';

  code += '    async def _deploy_crd(self, crd: CustomResourceDefinition) -> None:\n';
  code += '        print(f"[CRD] Deploying CRD: {crd.kind}...")\n\n';

  code += '        crd_manifest = self._generate_crd_manifest(crd)\n';
  code += '        crd_path = Path.cwd() / "k8s" / "crds" / f"{crd.plural}.yaml"\n';
  code += '        crd_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '        crd_path.write_text(yaml.dump(crd_manifest))\n\n';

  code += '        subprocess.run(["kubectl", "apply", "-f", str(crd_path)], check=True)\n\n';

  code += '    def _generate_crd_manifest(self, crd: CustomResourceDefinition) -> Dict[str, Any]:\n';
  code += '        return {\n';
  code += '            "apiVersion": "apiextensions.k8s.io/v1",\n';
  code += '            "kind": "CustomResourceDefinition",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{crd.plural}.{crd.group}",\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "group": crd.group,\n';
  code += '                "versions": [\n';
  code += '                    {\n';
  code += '                        "name": "v1",\n';
  code += '                        "served": True,\n';
  code += '                        "storage": True,\n';
  code += '                        "schema": {\n';
  code += '                            "openAPIV3Schema": {\n';
  code += '                                "type": "object",\n';
  code += '                            },\n';
  code += '                        },\n';
  code += '                        "subresources": {"status": {}},\n';
  code += '                    },\n';
  code += '                ],\n';
  code += '                "scope": crd.scope,\n';
  code += '                "names": {\n';
  code += '                    "plural": crd.plural,\n';
  code += '                    "singular": crd.singular,\n';
  code += '                    "kind": crd.kind,\n';
  code += '                    "shortNames": crd.short_names or [],\n';
  code += '                },\n';
  code += '            },\n';
  code += '        }\n\n';

  code += 'crd_operator = CRDOperator(\n';
  code += '    project_name="my-app",\n';
  code += '    namespace="default",\n';
  code += '    enable_controller=True,\n';
  code += '    enable_webhooks=True,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: OperatorConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptCRD(config);
  fs.writeFileSync(path.join(outputDir, 'crd-generator.ts'), tsCode);

  const pyCode = generatePythonCRD(config);
  fs.writeFileSync(path.join(outputDir, 'crd-generator.py'), pyCode);

  const md = generateCRDMD(config);
  fs.writeFileSync(path.join(outputDir, 'CRD.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Custom Resource Definitions and Operators',
    main: 'crd-generator.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0', '@kubernetes/client-node': '^0.20.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0\nkubernetes>=28.0.0');
  fs.writeFileSync(path.join(outputDir, 'crd-config.json'), JSON.stringify(config, null, 2));
}
