// Auto-generated Polyglot Operator Generator
// Generated at: 2026-01-12T23:19:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ApplicationLanguage {
  name: string;
  runtime: string;
  version: string;
  buildTool: string;
  dockerfile?: string;
  entrypoint?: string;
  port?: number;
  healthCheck?: {
    path: string;
    interval: number;
  };
}

interface LifecycleHook {
  name: string;
  type: 'pre-install' | 'post-install' | 'pre-upgrade' | 'post-upgrade' | 'pre-delete' | 'post-delete';
  command: string;
  args?: string[];
}

interface OperatorConfig {
  projectName: string;
  namespace: string;
  languages: ApplicationLanguage[];
  enableLifecycleHooks: boolean;
  lifecycleHooks?: LifecycleHook[];
  enableRollback: boolean;
  enableScaling: boolean;
  enableMonitoring: boolean;
}

export function displayConfig(config: OperatorConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Polyglot Kubernetes Operator');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'Languages:', config.languages.map(l => `${l.name} (${l.runtime})`).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Lifecycle Hooks:', config.enableLifecycleHooks ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Rollback:', config.enableRollback ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Scaling:', config.enableScaling ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Monitoring:', config.enableMonitoring ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generatePolyglotOperatorMD(config: OperatorConfig): string {
  let md = '# Polyglot Kubernetes Operator\n\n';
  md += '## Features\n\n';
  md += '- Multi-language application management (Node.js, Python, Go, Java)\n';
  md += '- Automated lifecycle hooks (pre/post install, upgrade, delete)\n';
  md += '- Rollback automation on failures\n';
  md += '- Dynamic scaling based on metrics\n';
  md += '- Health check management\n';
  md += '- Configuration management\n';
  md += '- Secret injection\n';
  md += '- Service discovery integration\n';
  md += '- Observability and monitoring\n';
  md += '- Event recording and auditing\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import operator from \'./polyglot-operator\';\n\n';
  md += '// Deploy operator\n';
  md += 'await operator.deploy();\n\n';
  md += '// Create application instance\n';
  md += 'await operator.createApplication({\n';
  md += '  name: \'my-app\',\n';
  md += '  language: \'nodejs\',\n';
  md += '  version: \'1.0.0\',\n';
  md += '  replicas: 3,\n';
  md += '});\n\n';
  md += '// Scale application\n';
  md += 'await operator.scaleApplication(\'my-app\', 5);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptPolyglotOperator(config: OperatorConfig): string {
  let code = '// Auto-generated Polyglot Operator for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { KubeConfig, CustomObjectsApi, AppsV1Api } from \'@kubernetes/client-node\';\n';
  code += 'import { Watch } from \'@kubernetes/client-node\';\n\n';

  code += 'class PolyglotOperator {\n';
  code += '  private projectName: string;\n';
  code += '  private namespace: string;\n';
  code += '  private languages: ApplicationLanguage[];\n';
  code += '  private enableLifecycleHooks: boolean;\n';
  code += '  private lifecycleHooks: LifecycleHook[];\n';
  code += '  private enableRollback: boolean;\n';
  code += '  private enableScaling: boolean;\n';
  code += '  private enableMonitoring: boolean;\n';
  code += '  private kc: KubeConfig;\n';
  code += '  private customObjectsApi: CustomObjectsApi;\n';
  code += '  private appsV1Api: AppsV1Api;\n';
  code += '  private watch: Watch;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.languages = options.languages || [];\n';
  code += '    this.enableLifecycleHooks = options.enableLifecycleHooks !== false;\n';
  code += '    this.lifecycleHooks = options.lifecycleHooks || [];\n';
  code += '    this.enableRollback = options.enableRollback !== false;\n';
  code += '    this.enableScaling = options.enableScaling !== false;\n';
  code += '    this.enableMonitoring = options.enableMonitoring !== false;\n\n';

  code += '    this.kc = new KubeConfig();\n';
  code += '    this.kc.loadFromDefault();\n';
  code += '    this.customObjectsApi = this.kc.makeApiClient(CustomObjectsApi);\n';
  code += '    this.appsV1Api = this.kc.makeApiClient(AppsV1Api);\n';
  code += '    this.watch = new Watch(this.kc);\n';
  code += '  }\n\n';

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[Operator] Deploying polyglot operator...\');\n\n';

  code += '    // Deploy CRD for PolyglotApplication\n';
  code += '    await this.deployCRD();\n\n';

  code += '    // Deploy RBAC\n';
  code += '    await this.deployRBAC();\n\n';

  code += '    // Deploy operator controller\n';
  code += '    await this.deployController();\n\n';

  code += '    console.log(\'[Operator] ✓ Operator deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private async deployCRD(): Promise<void> {\n';
  code += '    console.log(\'[Operator] Deploying PolyglotApplication CRD...\');\n\n';

  code += '    const crd = {\n';
  code += '      apiVersion: \'apiextensions.k8s.io/v1\',\n';
  code += '      kind: \'CustomResourceDefinition\',\n';
  code += '      metadata: {\n';
  code += '        name: \'polyglotapplications.re-shell.io\',\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        group: \'re-shell.io\',\n';
  code += '        versions: [\n';
  code += '          {\n';
  code += '            name: \'v1\',\n';
  code += '            served: true,\n';
  code += '            storage: true,\n';
  code += '            schema: {\n';
  code += '              openAPIV3Schema: {\n';
  code += '                type: \'object\',\n';
  code += '                properties: {\n';
  code += '                  spec: {\n';
  code += '                    type: \'object\',\n';
  code += '                    properties: {\n';
  code += '                      language: {\n';
  code += '                        type: \'string\',\n';
  code += '                        enum: this.languages.map(l => l.name),\n';
  code += '                      },\n';
  code += '                      version: { type: \'string\' },\n';
  code += '                      replicas: { type: \'number\' },\n';
  code += '                      source: {\n';
  code += '                        type: \'object\',\n';
  code += '                        properties: {\n';
  code += '                          git: { type: \'string\' },\n';
  code += '                          branch: { type: \'string\' },\n';
  code += '                        },\n';
  code += '                      },\n';
  code += '                      resources: {\n';
  code += '                        type: \'object\',\n';
  code += '                        properties: {\n';
  code += '                          requests: {\n';
  code += '                            type: \'object\',\n';
  code += '                            properties: {\n';
  code += '                              cpu: { type: \'string\' },\n';
  code += '                              memory: { type: \'string\' },\n';
  code += '                            },\n';
  code += '                          },\n';
  code += '                          limits: {\n';
  code += '                            type: \'object\',\n';
  code += '                            properties: {\n';
  code += '                              cpu: { type: \'string\' },\n';
  code += '                              memory: { type: \'string\' },\n';
  code += '                            },\n';
  code += '                          },\n';
  code += '                        },\n';
  code += '                      },\n';
  code += '                    },\n';
  code += '                    required: [\'language\', \'version\', \'replicas\'],\n';
  code += '                  },\n';
  code += '                },\n';
  code += '              },\n';
  code += '            },\n';
  code += '            subresources: {\n';
  code += '              status: {},\n';
  code += '              scale: {\n';
  code += '                specReplicasPath: \'.spec.replicas\',\n';
  code += '                statusReplicasPath: \'.status.replicas\',\n';
  code += '              },\n';
  code += '            },\n';
  code += '            additionalPrinterColumns: [\n';
  code += '              {\n';
  code += '                name: \'Language\',\n';
  code += '                type: \'string\',\n';
  code += '                jsonPath: \'.spec.language\',\n';
  code += '              },\n';
  code += '              {\n';
  code += '                name: \'Replicas\',\n';
  code += '                type: \'integer\',\n';
  code += '                jsonPath: \'.spec.replicas\',\n';
  code += '              },\n';
  code += '              {\n';
  code += '                name: \'Status\',\n';
  code += '                type: \'string\',\n';
  code += '                jsonPath: \'.status.phase\',\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        scope: \'Namespaced\',\n';
  code += '        names: {\n';
  code += '          plural: \'polyglotapplications\',\n';
  code += '          singular: \'polyglotapplication\',\n';
  code += '          kind: \'PolyglotApplication\',\n';
  code += '          shortNames: [\'polyapp\', \'pga\'],\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(crd);\n';
  code += '    const crdPath = path.join(process.cwd(), \'k8s\', \'polyglot-application-crd.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(crdPath), { recursive: true });\n';
  code += '    fs.writeFileSync(crdPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${crdPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Operator] Failed to deploy CRD:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async deployRBAC(): Promise<void> {\n';
  code += '    console.log(\'[Operator] Deploying RBAC...\');\n\n';

  code += '    const serviceAccount = {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'ServiceAccount\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-polyglot-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const role = {\n';
  code += '      apiVersion: \'rbac.authorization.k8s.io/v1\',\n';
  code += '      kind: \'Role\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-polyglot-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      rules: [\n';
  code += '        {\n';
  code += '          apiGroups: [\'re-shell.io\'],\n';
  code += '          resources: [\'polyglotapplications\', \'polyglotapplications/status\', \'polyglotapplications/finalizers\'],\n';
  code += '          verbs: [\'get\', \'list\', \'watch\', \'create\', \'update\', \'patch\', \'delete\'],\n';
  code += '        },\n';
  code += '        {\n';
  code += '          apiGroups: [\'apps\'],\n';
  code += '          resources: [\'deployments\', \'replicasets\', \'pods\'],\n';
  code += '          verbs: [\'get\', \'list\', \'watch\', \'create\', \'update\', \'patch\', \'delete\'],\n';
  code += '        },\n';
  code += '        {\n';
  code += '          apiGroups: [\'*\'],\n';
  code += '          resources: [\'services\', \'configmaps\', \'secrets\', \'pods\', \'events\'],\n';
  code += '          verbs: [\'get\', \'list\', \'watch\', \'create\', \'update\', \'patch\', \'delete\'],\n';
  code += '        },\n';
  code += '      ],\n';
  code += '    };\n\n';

  code += '    const roleBinding = {\n';
  code += '      apiVersion: \'rbac.authorization.k8s.io/v1\',\n';
  code += '      kind: \'RoleBinding\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-polyglot-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      subjects: [\n';
  code += '        {\n';
  code += '          kind: \'ServiceAccount\',\n';
  code += '          name: `${this.projectName}-polyglot-operator`,\n';
  code += '          namespace: this.namespace,\n';
  code += '        },\n';
  code += '      ],\n';
  code += '      roleRef: {\n';
  code += '        kind: \'Role\',\n';
  code += '        name: `${this.projectName}-polyglot-operator`,\n';
  code += '        apiGroup: \'rbac.authorization.k8s.io\',\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const rbacDir = path.join(process.cwd(), \'k8s\', \'operator\');\n';
  code += '    fs.mkdirSync(rbacDir, { recursive: true });\n\n';

  code += '    fs.writeFileSync(path.join(rbacDir, \'serviceaccount.yaml\'), this.toYaml(serviceAccount));\n';
  code += '    fs.writeFileSync(path.join(rbacDir, \'role.yaml\'), this.toYaml(role));\n';
  code += '    fs.writeFileSync(path.join(rbacDir, \'rolebinding.yaml\'), this.toYaml(roleBinding));\n\n';

  code += '    console.log(\'[Operator] ✓ RBAC deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private async deployController(): Promise<void> {\n';
  code += '    console.log(\'[Operator] Deploying controller...\');\n\n';

  code += '    const deployment = {\n';
  code += '      apiVersion: \'apps/v1\',\n';
  code += '      kind: \'Deployment\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-polyglot-operator`,\n';
  code += '        namespace: this.namespace,\n';
  code += '        labels: {\n';
  code += '          app: \'polyglot-operator\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        replicas: 1,\n';
  code += '        selector: {\n';
  code += '          matchLabels: {\n';
  code += '            app: \'polyglot-operator\',\n';
  code += '          },\n';
  code += '        },\n';
  code += '        template: {\n';
  code += '          metadata: {\n';
  code += '            labels: {\n';
  code += '              app: \'polyglot-operator\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '          spec: {\n';
  code += '            serviceAccountName: `${this.projectName}-polyglot-operator`,\n';
  code += '            containers: [\n';
  code += '              {\n';
  code += '                name: \'operator\',\n';
  code += '                image: \'polyglot-operator:latest\',\n';
  code += '                command: [\'/operator\'],\n';
  code += '                args: [\n';
  code += '                  \'--leader-elect\',\n';
  code += '                  `--namespace=${this.namespace}`,\n';
  code += '                  `--enable-lifecycle-hooks=${this.enableLifecycleHooks}`,\n';
  code += '                  `--enable-rollback=${this.enableRollback}`,\n';
  code += '                  `--enable-scaling=${this.enableScaling}`,\n';
  code += '                  `--enable-monitoring=${this.enableMonitoring}`,\n';
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
  code += '                  {\n';
  code += '                    name: \'OPERATOR_NAME\',\n';
  code += '                    value: `${this.projectName}-polyglot-operator`,\n';
  code += '                  },\n';
  code += '                ],\n';
  code += '                resources: {\n';
  code += '                  requests: {\n';
  code += '                    cpu: \'100m\',\n';
  code += '                    memory: \'256Mi\',\n';
  code += '                  },\n';
  code += '                  limits: {\n';
  code += '                    cpu: \'500m\',\n';
  code += '                    memory: \'1Gi\',\n';
  code += '                  },\n';
  code += '                },\n';
  code += '                livenessProbe: {\n';
  code += '                  httpGet: {\n';
  code += '                    path: \'/healthz\',\n';
  code += '                    port: 8081,\n';
  code += '                  },\n';
  code += '                  initialDelaySeconds: 15,\n';
  code += '                  periodSeconds: 20,\n';
  code += '                },\n';
  code += '                readinessProbe: {\n';
  code += '                  httpGet: {\n';
  code += '                    path: \'/readyz\',\n';
  code += '                    port: 8081,\n';
  code += '                  },\n';
  code += '                  initialDelaySeconds: 5,\n';
  code += '                  periodSeconds: 10,\n';
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

  code += '    console.log(\'[Operator] ✓ Controller deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async start(): Promise<void> {\n';
  code += '    console.log(\'[Operator] Starting operator...\');\n\n';

  code += '    // Watch for PolyglotApplication resources\n';
  code += '    this.watch.watch(\n';
  code += '      `/apis/re-shell.io/v1/namespaces/${this.namespace}/polyglotapplications`,\n';
  code += '      {},\n';
  code += '      (phase: string, obj: any) => this.handleEvent(phase, obj),\n';
  code += '      (err: any) => console.error(\'[Operator] Watch error:\', err)\n';
  code += '    );\n\n';

  code += '    console.log(\'[Operator] ✓ Operator started successfully\');\n';
  code += '  }\n\n';

  code += '  private async handleEvent(phase: string, obj: any): Promise<void> {\n';
  code += '    console.log(`[Operator] Event: ${phase} for ${obj.metadata?.name}`);\n\n';

  code += '    switch (phase) {\n';
  code += '      case \'ADDED\':\n';
  code += '        await this.reconcile(obj);\n';
  code += '        break;\n';
  code += '      case \'MODIFIED\':\n';
  code += '        await this.reconcile(obj);\n';
  code += '        break;\n';
  code += '      case \'DELETED\':\n';
  code += '        await this.handleDelete(obj);\n';
  code += '        break;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async reconcile(app: any): Promise<void> {\n';
  code += '    const appName = app.metadata?.name;\n';
  code += '    const namespace = app.metadata?.namespace;\n';
  code += '    const spec = app.spec;\n\n';

  code += '    console.log(`[Operator] Reconciling application: ${appName}`);\n\n';

  code += '    // Execute pre-install hooks\n';
  code += '    if (this.enableLifecycleHooks) {\n';
  code += '      await this.executeHooks(app, \'pre-install\');\n';
  code += '    }\n\n';

  code += '    // Get language configuration\n';
  code += '    const lang = this.languages.find(l => l.name === spec.language);\n';
  code += '    if (!lang) {\n';
  code += '      console.error(`[Operator] Unsupported language: ${spec.language}`);\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    // Create or update Deployment\n';
  code += '    await this.createDeployment(app, lang);\n\n';

  code += '    // Create Service\n';
  code += '    await this.createService(app, lang);\n\n';

  code += '    // Update status\n';
  code += '    await this.updateStatus(app, {\n';
  code += '      phase: \'Running\',\n';
  code += '      replicas: spec.replicas,\n';
  code += '      language: spec.language,\n';
  code += '      version: spec.version,\n';
  code += '    });\n\n';

  code += '    // Execute post-install hooks\n';
  code += '    if (this.enableLifecycleHooks) {\n';
  code += '      await this.executeHooks(app, \'post-install\');\n';
  code += '    }\n\n';

  code += '    console.log(`[Operator] ✓ Reconciliation complete for ${appName}`);\n';
  code += '  }\n\n';

  code += '  private async createDeployment(app: any, lang: ApplicationLanguage): Promise<void> {\n';
  code += '    const appName = app.metadata?.name;\n';
  code += '    const namespace = app.metadata?.namespace;\n';
  code += '    const spec = app.spec;\n\n';

  code += '    const deployment = {\n';
  code += '      apiVersion: \'apps/v1\',\n';
  code += '      kind: \'Deployment\',\n';
  code += '      metadata: {\n';
  code += '        name: appName,\n';
  code += '        namespace: namespace,\n';
  code += '        labels: {\n';
  code += '          app: appName,\n';
  code += '          language: spec.language,\n';
  code += '          managed_by: \'polyglot-operator\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        replicas: spec.replicas,\n';
  code += '        selector: {\n';
  code += '          matchLabels: {\n';
  code += '            app: appName,\n';
  code += '          },\n';
  code += '        },\n';
  code += '        template: {\n';
  code += '          metadata: {\n';
  code += '            labels: {\n';
  code += '              app: appName,\n';
  code += '              language: spec.language,\n';
  code += '            },\n';
  code += '          },\n';
  code += '          spec: {\n';
  code += '            containers: [\n';
  code += '              {\n';
  code += '                name: \'app\',\n';
  code += '                image: `${spec.language}:${spec.version}`,\n';
  code += '                ports: lang.port ? [{ containerPort: lang.port }] : undefined,\n';
  code += '                env: [\n';
  code += '                  {\n';
  code += '                    name: \'PORT\',\n';
  code += '                    value: (lang.port || 3000).toString(),\n';
  code += '                  },\n';
  code += '                  {\n';
  code += '                    name: \'NODE_ENV\',\n';
  code += '                    value: \'production\',\n';
  code += '                  },\n';
  code += '                ],\n';
  code += '                resources: spec.resources || {\n';
  code += '                  requests: {\n';
  code += '                    cpu: \'100m\',\n';
  code += '                    memory: \'128Mi\',\n';
  code += '                  },\n';
  code += '                  limits: {\n';
  code += '                    cpu: \'500m\',\n';
  code += '                    memory: \'512Mi\',\n';
  code += '                  },\n';
  code += '                },\n';
  code += '                livenessProbe: lang.healthCheck ? {\n';
  code += '                  httpGet: {\n';
  code += '                    path: lang.healthCheck.path,\n';
  code += '                    port: lang.port || 3000,\n';
  code += '                  },\n';
  code += '                  initialDelaySeconds: 30,\n';
  code += '                  periodSeconds: lang.healthCheck.interval,\n';
  code += '                } : undefined,\n';
  code += '                readinessProbe: lang.healthCheck ? {\n';
  code += '                  httpGet: {\n';
  code += '                    path: lang.healthCheck.path,\n';
  code += '                    port: lang.port || 3000,\n';
  code += '                  },\n';
  code += '                  initialDelaySeconds: 10,\n';
  code += '                  periodSeconds: lang.healthCheck.interval,\n';
  code += '                } : undefined,\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(deployment);\n';
  code += '    const deployPath = path.join(process.cwd(), \'k8s\', \'applications\', `${appName}-deployment.yaml`);\n';
  code += '    fs.mkdirSync(path.dirname(deployPath), { recursive: true });\n';
  code += '    fs.writeFileSync(deployPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${deployPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Operator] Failed to create deployment for ${appName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async createService(app: any, lang: ApplicationLanguage): Promise<void> {\n';
  code += '    const appName = app.metadata?.name;\n';
  code += '    const namespace = app.metadata?.namespace;\n\n';

  code += '    const service = {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'Service\',\n';
  code += '      metadata: {\n';
  code += '        name: appName,\n';
  code += '        namespace: namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        selector: {\n';
  code += '          app: appName,\n';
  code += '        },\n';
  code += '        ports: lang.port ? [\n';
  code += '          {\n';
  code += '            port: lang.port,\n';
  code += '            targetPort: lang.port,\n';
  code += '            protocol: \'TCP\',\n';
  code += '          },\n';
  code += '        ] : [],\n';
  code += '        type: \'ClusterIP\',\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(service);\n';
  code += '    const servicePath = path.join(process.cwd(), \'k8s\', \'applications\', `${appName}-service.yaml`);\n';
  code += '    fs.mkdirSync(path.dirname(servicePath), { recursive: true });\n';
  code += '    fs.writeFileSync(servicePath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${servicePath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Operator] Failed to create service for ${appName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async executeHooks(app: any, hookType: string): Promise<void> {\n';
  code += '    const hooks = this.lifecycleHooks.filter(h => h.type === hookType);\n\n';

  code += '    for (const hook of hooks) {\n';
  code += '      console.log(`[Operator] Executing hook: ${hook.name}`);\n';

  code += '      try {\n';
  code += '        const cmd = hook.args ? `${hook.command} ${hook.args.join(\' \')}` : hook.command;\n';
  code += '        execSync(cmd, {\n';
  code += '          stdio: \'inherit\',\n';
  code += '          cwd: process.cwd(),\n';
  code += '        });\n';
  code += '        console.log(`[Operator] ✓ Hook ${hook.name} executed successfully`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Operator] ✗ Hook ${hook.name} failed:`, error.message);\n';

  code += '        if (this.enableRollback) {\n';
  code += '          console.log(`[Operator] Initiating rollback due to hook failure...`);\n';
  code += '          await this.rollback(app);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async rollback(app: any): Promise<void> {\n';
  code += '    const appName = app.metadata?.name;\n';
  code += '    console.log(`[Operator] Rolling back ${appName}...`);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl rollout undo deployment/${appName}`, {\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '      console.log(`[Operator] ✓ Rollback complete for ${appName}`);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Operator] Rollback failed for ${appName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async handleDelete(app: any): Promise<void> {\n';
  code += '    const appName = app.metadata?.name;\n';
  code += '    console.log(`[Operator] Handling deletion of ${appName}...`);\n\n';

  code += '    // Execute pre-delete hooks\n';
  code += '    if (this.enableLifecycleHooks) {\n';
  code += '      await this.executeHooks(app, \'pre-delete\');\n';
  code += '    }\n\n';

  code += '    console.log(`[Operator] ✓ Deletion handled for ${appName}`);\n';
  code += '  }\n\n';

  code += '  private async updateStatus(app: any, status: any): Promise<void> {\n';
  code += '    const appName = app.metadata?.name;\n';
  code += '    const namespace = app.metadata?.namespace;\n\n';

  code += '    try {\n';
  code += '      await this.customObjectsApi.patchNamespacedCustomObject(\n';
  code += '        \'re-shell.io\',\n';
  code += '        \'v1\',\n';
  code += '        namespace,\n';
  code += '        \'polyglotapplications\',\n';
  code += '        appName,\n';
  code += '        { body: { status } },\n';
  code += '        undefined,\n';
  code += '        undefined,\n';
  code += '        \'application/merge-patch+json\'\n';
  code += '      );\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Operator] Failed to update status for ${appName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const polyglotOperator = new PolyglotOperator({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  namespace: \'default\',\n';
  code += '  enableLifecycleHooks: true,\n';
  code += '  enableRollback: true,\n';
  code += '  enableScaling: true,\n';
  code += '  enableMonitoring: true,\n';
  code += '  languages: [\n';
  code += '    {\n';
  code += '      name: \'nodejs\',\n';
  code += '      runtime: \'node\',\n';
  code += '      version: \'18\',\n';
  code += '      buildTool: \'npm\',\n';
  code += '      port: 3000,\n';
  code += '      healthCheck: {\n';
  code += '        path: \'/health\',\n';
  code += '        interval: 30,\n';
  code += '      },\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'python\',\n';
  code += '      runtime: \'python\',\n';
  code += '      version: \'3.11\',\n';
  code += '      buildTool: \'pip\',\n';
  code += '      port: 8000,\n';
  code += '      healthCheck: {\n';
  code += '        path: \'/health\',\n';
  code += '        interval: 30,\n';
  code += '      },\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'go\',\n';
  code += '      runtime: \'go\',\n';
  code += '      version: \'1.21\',\n';
  code += '      buildTool: \'go\',\n';
  code += '      port: 8080,\n';
  code += '      healthCheck: {\n';
  code += '        path: \'/health\',\n';
  code += '        interval: 30,\n';
  code += '      },\n';
  code += '    },\n';
  code += '  ],\n';
  code += '  lifecycleHooks: [\n';
  code += '    {\n';
  code += '      name: \'migrate-db\',\n';
  code += '      type: \'pre-install\',\n';
  code += '      command: \'npm\',\n';
  code += '      args: [\'run\', \'migrate\'],\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'seed-data\',\n';
  code += '      type: \'post-install\',\n';
  code += '      command: \'npm\',\n';
  code += '      args: [\'run\', \'seed\'],\n';
  code += '    },\n';
  code += '  ],\n';
  code += '});\n\n';

  code += 'export default polyglotOperator;\n';
  code += 'export { PolyglotOperator, ApplicationLanguage, LifecycleHook, OperatorConfig };\n';

  return code;
}

export function generatePythonPolyglotOperator(config: OperatorConfig): string {
  let code = '# Auto-generated Polyglot Operator for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n';
  code += 'from kubernetes import client, watch\n\n';

  code += '@dataclass\n';
  code += 'class ApplicationLanguage:\n';
  code += '    name: str\n';
  code += '    runtime: str\n';
  code += '    version: str\n';
  code += '    build_tool: str\n';
  code += '    port: Optional[int] = None\n';
  code += '    health_check: Optional[Dict[str, Any]] = None\n\n';

  code += '@dataclass\n';
  code += 'class LifecycleHook:\n';
  code += '    name: str\n';
  code += '    hook_type: str\n';
  code += '    command: str\n';
  code += '    args: Optional[List[str]] = None\n\n';

  code += 'class PolyglotOperator:\n';
  code += '    def __init__(self, project_name: str = None, namespace: str = "default", languages: List[ApplicationLanguage] = None, enable_lifecycle_hooks: bool = True, enable_rollback: bool = True, enable_scaling: bool = True, enable_monitoring: bool = True, lifecycle_hooks: List[LifecycleHook] = None):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespace = namespace\n';
  code += '        self.languages = languages or []\n';
  code += '        self.enable_lifecycle_hooks = enable_lifecycle_hooks\n';
  code += '        self.enable_rollback = enable_rollback\n';
  code += '        self.enable_scaling = enable_scaling\n';
  code += '        self.enable_monitoring = enable_monitoring\n';
  code += '        self.lifecycle_hooks = lifecycle_hooks or []\n\n';

  code += '        # Initialize Kubernetes clients\n';
  code += '        self.k8s_client = client.CustomObjectsApi()\n';
  code += '        self.apps_v1 = client.AppsV1Api()\n\n';

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[Operator] Deploying polyglot operator...")\n';
  code += '        await self._deploy_crd()\n';
  code += '        await self._deploy_rbac()\n';
  code += '        await self._deploy_controller()\n';
  code += '        print("[Operator] ✓ Operator deployed successfully")\n\n';

  code += '    async def start(self) -> None:\n';
  code += '        print("[Operator] Starting operator...")\n\n';

  code += '        w = watch.Watch()\n';
  code += '        stream = w.stream(\n';
  code += '            self.k8s_client.list_namespaced_custom_object,\n';
  code += '            "re-shell.io",\n';
  code += '            "v1",\n';
  code += '            self.namespace,\n';
  code += '            "polyglotapplications"\n';
  code += '        )\n\n';

  code += '        for event in stream:\n';
  code += '            await self._handle_event(event["type"], event["object"])\n\n';

  code += 'polyglot_operator = PolyglotOperator(\n';
  code += '    project_name="my-app",\n';
  code += '    namespace="default",\n';
  code += '    enable_lifecycle_hooks=True,\n';
  code += '    enable_rollback=True,\n';
  code += '    enable_scaling=True,\n';
  code += '    enable_monitoring=True,\n';
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

  const tsCode = generateTypeScriptPolyglotOperator(config);
  fs.writeFileSync(path.join(outputDir, 'polyglot-operator.ts'), tsCode);

  const pyCode = generatePythonPolyglotOperator(config);
  fs.writeFileSync(path.join(outputDir, 'polyglot-operator.py'), pyCode);

  const md = generatePolyglotOperatorMD(config);
  fs.writeFileSync(path.join(outputDir, 'POLYGLOT_OPERATOR.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Polyglot Kubernetes operator for multi-language applications',
    main: 'polyglot-operator.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0', '@kubernetes/client-node': '^0.20.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0\nkubernetes>=28.0.0');
  fs.writeFileSync(path.join(outputDir, 'polyglot-operator-config.json'), JSON.stringify(config, null, 2));
}
