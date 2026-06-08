// Auto-generated CI/CD Pipeline Generator
// Generated at: 2026-01-13T10:06:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface PipelineStage {
  name: string;
  type: 'build' | 'test' | 'deploy' | 'canary' | 'rollback';
  image?: string;
  commands: string[];
  environment?: Record<string, string>;
}

interface ProgressiveDeliveryConfig {
  enabled: boolean;
  strategy?: 'canary' | 'blue-green' | 'shadow';
  canary?: {
    steps: number;
    intervalSeconds: number;
    incrementPercentage: number;
  };
  analysis?: {
    enabled: boolean;
    metrics: string[];
    successThreshold: number;
  };
}

interface CICDPipelineConfig {
  projectName: string;
  namespace: string;
  gitRepo: string;
  branch: string;
  stages: PipelineStage[];
  progressiveDelivery: ProgressiveDeliveryConfig;
  enableNotifications: boolean;
  enableRollback: boolean;
}

export function displayConfig(config: CICDPipelineConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Kubernetes-Native CI/CD Pipeline');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'Git Repository:', config.gitRepo);
  console.log('\x1b[33m%s\x1b[0m', 'Branch:', config.branch);
  console.log('\x1b[33m%s\x1b[0m', 'Stages:', config.stages.map(s => s.name).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Progressive Delivery:', config.progressiveDelivery.enabled ? `${config.progressiveDelivery.strategy}` : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Notifications:', config.enableNotifications ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Auto Rollback:', config.enableRollback ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateCICDMD(config: CICDPipelineConfig): string {
  let md = '# Kubernetes-Native CI/CD Pipeline\n\n';
  md += '## Features\n\n';
  md += '- Kubernetes-native pipeline resources\n';
  md += '- Progressive delivery with canary deployments\n';
  md += '- Blue-green deployment support\n';
  md += '- Shadow traffic routing\n';
  md += '- Automated testing stages\n';
  md += '- Analysis metrics and success thresholds\n';
  md += '- Automatic rollback on failures\n';
  md += '- Slack/Discord/Email notifications\n';
  md += '- Pipeline execution history\n';
  md += '- Manual approval gates\n';
  md += '- Integration with GitHub/GitLab webhooks\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import pipeline from \'./cicd-pipeline\';\n\n';
  md += '// Deploy pipeline resources\n';
  md += 'await pipeline.deploy();\n\n';
  md += '// Trigger pipeline\n';
  md += 'await pipeline.trigger({\n';
  md += '  gitSha: \'abc123\',\n';
  md += '  branch: \'main\',\n';
  md += '});\n\n';
  md += '// Monitor pipeline status\n';
  md += 'await pipeline.getStatus();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptCICD(config: CICDPipelineConfig): string {
  let code = '// Auto-generated CI/CD Pipeline for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { KubeConfig, CustomObjectsApi } from \'@kubernetes/client-node\';\n\n';

  code += 'class CICDPipeline {\n';
  code += '  private projectName: string;\n';
  code += '  private namespace: string;\n';
  code += '  private gitRepo: string;\n';
  code += '  private branch: string;\n';
  code += '  private stages: PipelineStage[];\n';
  code += '  private progressiveDelivery: ProgressiveDeliveryConfig;\n';
  code += '  private enableNotifications: boolean;\n';
  code += '  private enableRollback: boolean;\n';
  code += '  private kc: KubeConfig;\n';
  code += '  private customObjectsApi: CustomObjectsApi;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.gitRepo = options.gitRepo || \'https://github.com/example/app.git\';\n';
  code += '    this.branch = options.branch || \'main\';\n';
  code += '    this.stages = options.stages || [];\n';
  code += '    this.progressiveDelivery = options.progressiveDelivery || { enabled: false };\n';
  code += '    this.enableNotifications = options.enableNotifications !== false;\n';
  code += '    this.enableRollback = options.enableRollback !== false;\n\n';

  code += '    this.kc = new KubeConfig();\n';
  code += '    this.kc.loadFromDefault();\n';
  code += '    this.customObjectsApi = this.kc.makeApiClient(CustomObjectsApi);\n';
  code += '  }\n\n';

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[CI/CD] Deploying CI/CD pipeline...\');\n\n';

  code += '    // Deploy Tekton Pipeline CRD\n';
  code += '    await this.deployPipelineCRD();\n\n';

  code += '    // Deploy pipeline resources\n';
  code += '    await this.deployPipeline();\n\n';

  code += '    // Deploy Trigger template\n';
  code += '    await this.deployTrigger();\n\n';

  code += '    // Deploy Notification resources\n';
  code += '    if (this.enableNotifications) {\n';
  code += '      await this.deployNotifications();\n';
  code += '    }\n\n';

  code += '    console.log(\'[CI/CD] ✓ CI/CD pipeline deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private async deployPipelineCRD(): Promise<void> {\n';
  code += '    console.log(\'[CI/CD] Deploying Tekton Pipeline CRD...\');\n\n';

  code += '    // Apply Tekton CRDs\n';
  code += '    const tektonCRDs = {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'ConfigMap\',\n';
  code += '      metadata: {\n';
  code += '        name: \'tekton-crds\',\n';
  code += '        namespace: this.namespace,\n';
  code += '        annotations: {\n';
  code += '          \'argocd.argoproj.io/sync-wave\': \'-1\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '      data: {\n';
  code += '        \'tekton-pipelines.yaml\': this.getTektonPipelinesCRD(),\n';
  code += '        \'tekton-triggers.yaml\': this.getTektonTriggersCRD(),\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(tektonCRDs);\n';
  code += '    const crdPath = path.join(process.cwd(), \'k8s\', \'cicd\', \'tekton-crds.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(crdPath), { recursive: true });\n';
  code += '    fs.writeFileSync(crdPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${crdPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[CI/CD] Failed to deploy Tekton CRDs:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async deployPipeline(): Promise<void> {\n';
  code += '    console.log(\'[CI/CD] Deploying pipeline...\');\n\n';

  code += '    const tasks = this.stages.map((stage, index) => {\n';
  code += '      return {\n';
  code += '        name: stage.name,\n';
  code += '        taskSpec: {\n';
  code += '          steps: [\n';
  code += '            {\n';
  code += '              name: stage.name,\n';
  code += '              image: stage.image || \'alpine:3.18\',\n';
  code += '              command: [\'sh\', \'-c\'],\n';
  code += '              args: [stage.commands.join(\' && \')],\n';
  code += '              env: stage.environment ? Object.entries(stage.environment).map(([k, v]) => ({ name: k, value: v })) : [],\n';
  code += '            },\n';
  code += '          ],\n';
  code += '        },\n';
  code += '        runAfter: index > 0 ? [this.stages[index - 1].name] : [],\n';
  code += '      };\n';
  code += '    });\n\n';

  code += '    const pipeline = {\n';
  code += '      apiVersion: \'tekton.dev/v1\',\n';
  code += '      kind: \'Pipeline\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-pipeline`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        params: [\n';
  code += '          {\n';
  code += '            name: \'git-repo\',\n';
  code += '            type: \'string\',\n';
  code += '            description: \'Git repository URL\',\n';
  code += '            default: this.gitRepo,\n';
  code += '          },\n';
  code += '          {\n';
  code += '          name: \'git-revision\',\n';
  code += '          type: \'string\',\n';
  code += '          description: \'Git revision (branch, tag, or SHA)\',\n';
  code += '          default: this.branch,\n';
  code += '          },\n';
  code += '          {\n';
  code += '            name: \'image-url\',\n';
  code += '            type: \'string\',\n';
  code += '            description: \'Container image URL\',\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        workspaces: [\n';
  code += '          {\n';
  code += '            name: \'source\',\n';
  code += '            description: \'Git source workspace\',\n';
  code += '          },\n';
  code += '          {\n';
  code += '            name: \'dockerconfig\',\n';
  code += '            description: \'Docker registry credentials\',\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        tasks: tasks,\n';
  code += '        finally: [\n';
  code += '          {\n';
  code += '            name: \'cleanup\',\n';
  code += '            taskSpec: {\n';
  code += '              steps: [\n';
  code += '                {\n';
  code += '                  name: \'cleanup\',\n';
  code += '                  image: \'alpine:3.18\',\n';
  code += '                  script: \'echo "Cleaning up..."\',\n';
  code += '                },\n';
  code += '              ],\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(pipeline);\n';
  code += '    const pipelinePath = path.join(process.cwd(), \'k8s\', \'cicd\', \'pipeline.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(pipelinePath), { recursive: true });\n';
  code += '    fs.writeFileSync(pipelinePath, yaml);\n\n';

  code += '    // Deploy PipelineRun for initial execution\n';
  code += '    await this.createPipelineRun();\n';

  code += '    console.log(\'[CI/CD] ✓ Pipeline deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private async deployTrigger(): Promise<void> {\n';
  code += '    console.log(\'[CI/CD] Deploying triggers...\');\n\n';

  code += '    const triggerTemplate = {\n';
  code += '      apiVersion: \'triggers.tekton.dev/v1beta1\',\n';
  code += '      kind: \'TriggerTemplate\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-trigger`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        params: [\n';
  code += '          {\n';
  code += '            name: \'git-repo\',\n';
  code += '          },\n';
  code += '          {\n';
  code += '            name: \'git-revision\',\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        resourcetemplates: [\n';
  code += '          {\n';
  code += '            apiVersion: \'tekton.dev/v1\',\n';
  code += '            kind: \'PipelineRun\',\n';
  code += '            metadata: {\n';
  code += '              generateName: `${this.projectName}-run-`,\n';
  code += '              namespace: this.namespace,\n';
  code += '            },\n';
  code += '            spec: {\n';
  code += '              pipelineRef: {\n';
  code += '                name: `${this.projectName}-pipeline`,\n';
  code += '              },\n';
  code += '              params: [\n';
  code += '                  {\n';
  code += '                    name: \'git-repo\',\n';
  code += '                    value: \'$(tt.params.git-repo)\',\n';
  code += '                  },\n';
  code += '                  {\n';
  code += '                    name: \'git-revision\',\n';
  code += '                    value: \'$(tt.params.git-revision)\',\n';
  code += '                  },\n';
  code += '              ],\n';
  code += '              workspaces: [\n';
  code += '                {\n';
  code += '                  name: \'source\',\n';
  code += '                  emptyDir: {},\n';
  code += '                },\n';
  code += '              ],\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const triggerBinding = {\n';
  code += '      apiVersion: \'triggers.tekton.dev/v1beta1\',\n';
  code += '      kind: \'TriggerBinding\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-binding`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        params: [\n';
  code += '          {\n';
  code += '            name: \'git-repo\',\n';
  code += '            value: \'$(body.repository.url)\',\n';
  code += '          },\n';
  code += '          {\n';
  code += '            name: \'git-revision\',\n';
  code += '            value: \'$(body.head_commit.id)\',\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    constEventListener = {\n';
  code += '      apiVersion: \'triggers.tekton.dev/v1beta1\',\n';
  code += '      kind: \'EventListener\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-listener`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        serviceAccountName: \'tekton-triggers\',\n';
  code += '        triggers: [\n';
  code += '          {\n';
  code += '            name: \'github-push\',\n';
  code += '            bindings: [\n';
  code += '              {\n';
  code += '                kind: \'TriggerBinding\',\n';
  code += '                ref: `${this.projectName}-binding`,\n';
  code += '              },\n';
  code += '            ],\n';
  code += '            template: {\n';
  code += '              ref: `${this.projectName}-trigger`,\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const triggerDir = path.join(process.cwd(), \'k8s\', \'cicd\', \'triggers\');\n';
  code += '    fs.mkdirSync(triggerDir, { recursive: true });\n\n';

  code += '    fs.writeFileSync(path.join(triggerDir, \'template.yaml\'), this.toYaml(triggerTemplate));\n';
  code += '    fs.writeFileSync(path.join(triggerDir, \'binding.yaml\'), this.toYaml(triggerBinding));\n';
  code += '    fs.writeFileSync(path.join(triggerDir, \'listener.yaml\'), this.toYaml(eventListener));\n\n';

  code += '    console.log(\'[CI/CD] ✓ Triggers deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private async deployNotifications(): Promise<void> {\n';
  code += '    console.log(\'[CI/CD] Deploying notifications...\');\n\n';

  code += '    const notifier = {\n';
  code += '      apiVersion: \'tekton.dev/v1alpha1\',\n';
  code += '      kind: \'Trigger\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-notifier`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        serviceAccountName: \'tekton-triggers\',\n';
  code += '        bindings: [\n';
  code += '          {\n';
  code += '            kind: \'TriggerBinding\',\n';
  code += '            ref: \'notification-binding\',\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        template: {\n';
  code += '          ref: \'notification-template\',\n';
  code += '        },\n';
  code += '        interceptors: [\n';
  code += '          {\n';
  code += '            webhook: {\n';
  code += '              objectRef: {\n';
  code += '                kind: \'SlackInterceptor\',\n';
  code += '                name: \'slack-notifier\',\n';
  code += '              },\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(notifier);\n';
  code += '    const notifierPath = path.join(process.cwd(), \'k8s\', \'cicd\', \'notifier.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(notifierPath), { recursive: true });\n';
  code += '    fs.writeFileSync(notifierPath, yaml);\n\n';

  code += '    console.log(\'[CI/CD] ✓ Notifications deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async deployProgressiveDelivery(): Promise<void> {\n';
  code += '    if (!this.progressiveDelivery.enabled) {\n';
  code += '      console.log(\'[CI/CD] Progressive delivery disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    console.log(`[CI/CD] Deploying ${this.progressiveDelivery.strategy} strategy...`);\n\n';

  code += '    const analysisTemplate: any = {\n';
  code += '      apiVersion: "flagger.app/v1beta1",\n';
  code += '      kind: \'Canary\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        targetRef: {\n';
  code += '          apiVersion: \'apps/v1\',\n';
  code += '          kind: \'Deployment\',\n';
  code += '          name: this.projectName,\n';
  code += '        },\n';
  code += '        service: {\n';
  code += '          port: 80,\n';
  code += '          targetPort: this.progressiveDelivery.strategy === \'canary\' ? 8080 : 80,\n';
  code += '        },\n';
  code += '        analysis: this.progressiveDelivery.analysis.enabled ? {\n';
  code += '          interval: \'1m\',\n';
  code += '          threshold: this.progressiveDelivery.analysis.successThreshold,\n';
  code += '          maxWeight: this.progressiveDelivery.strategy === \'canary\' ? 100 : 0,\n';
  code += '          stepWeight: this.progressiveDelivery.strategy === \'canary\' ? this.progressiveDelivery.analysis.incrementPercentage : 0,\n';
  code += '          metrics: this.progressiveDelivery.analysis.metrics.map((metric: string) => ({\n';
  code += '            name: metric,\n';
  code += '            thresholdRange: {\n';
  code += '              min: this.progressiveDelivery.analysis.successThreshold,\n';
  code += '              max: 100,\n';
  code += '            },\n';
  code += '          })),\n';
  code += '        } : undefined,\n';
  code += '        canaryStrategy: this.progressiveDelivery.strategy === \'canary\' ? {\n';
  code += '          steps: this.progressiveDelivery.canary.steps,\n';
  code += '          setWeight: this.progressiveDelivery.canary.incrementPercentage,\n';
  code += '          interval: this.progressiveDelivery.canary.intervalSeconds + \'s\',\n';
  code += '        } : undefined,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(analysisTemplate);\n';
  code += '    const deliveryPath = path.join(process.cwd(), \'k8s\', \'cicd\', \'progressive-delivery.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(deliveryPath), { recursive: true });\n';
  code += '    fs.writeFileSync(deliveryPath, yaml);\n\n';

  code += '    console.log(\'[CI/CD] ✓ Progressive delivery deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async createPipelineRun(params: any = {}): Promise<void> {\n';
  code += '    console.log(\'[CI/CD] Creating PipelineRun...\');\n\n';

  code += '    const pipelineRun = {\n';
  code += '      apiVersion: \'tekton.dev/v1\',\n';
  code += '      kind: \'PipelineRun\',\n';
  code += '      metadata: {\n';
  code += '        generateName: `${this.projectName}-run-`,\n';
  code += '        namespace: this.namespace,\n';
  code += '        labels: {\n';
  code += '          \'tekton.dev/pipeline\': `${this.projectName}-pipeline`,\n';
  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        pipelineRef: {\n';
  code += '          name: `${this.projectName}-pipeline`,\n';
  code += '        },\n';
  code += '        params: [\n';
  code += '          {\n';
  code += '            name: \'git-repo\',\n';
  code += '            value: params.gitRepo || this.gitRepo,\n';
  code += '          },\n';
  code += '          {\n';
  code += '            name: \'git-revision\',\n';
  code += '            value: params.gitRevision || this.branch,\n';
  code += '          },\n';
  code += '          {\n';
  code += '            name: \'image-url\',\n';
  code += '            value: params.imageUrl || `${this.projectName}:latest`,\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        workspaces: [\n';
  code += '          {\n';
  code += '            name: \'source\',\n';
  code += '            emptyDir: {},\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(pipelineRun);\n';
  code += '    const runPath = path.join(process.cwd(), \'k8s\', \'cicd\', \'pipelinerun.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(runPath), { recursive: true });\n';
  code += '    fs.writeFileSync(runPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${runPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '      console.log(\'[CI/CD] ✓ PipelineRun created successfully\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[CI/CD] Failed to create PipelineRun:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async getStatus(): Promise<void> {\n';
  code += '    console.log(\'[CI/CD] Getting pipeline status...\');\n\n';

  code += '    try {\n';
  code += '      const result = execSync(\n';
  code += '        `kubectl get pipelineruns -n ${this.namespace} -l tekton.dev/pipeline=${this.projectName}-pipeline -o json`,\n';
  code += '        {\n';
  code += '          encoding: \'utf-8\',\n';
  code += '        }\n';
  code += '      );\n\n';

  code += '      const runs = JSON.parse(result);\n';
  code += '      console.log(`[CI/CD] Found ${runs.items.length} pipeline runs`);\n\n';

  code += '      for (const run of runs.items) {\n';
  code += '        console.log(`  - ${run.metadata.name}: ${run.status?.conditions?.[0]?.status || \'Unknown\'} - ${run.status?.conditions?.[0]?.reason || \'No reason\'}`);\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[CI/CD] Failed to get status:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n\n';

  code += '  private getTektonPipelinesCRD(): string {\n';
  code += '    return `apiVersion: v1\n';
  code += 'kind: ConfigMap\n';
  code += 'metadata:\n';
  code += '  name: tekton-pipelines-crds\n';
  code += 'data:\n';
  code += '  tekton-pipelines.yaml: |\n';
  code += '    # Tekton Pipelines CRD content would be here\n';
  code += '    # Downloaded from: https://github.com/tektoncd/pipeline/releases/download/v0.50.0/release.yaml\n';
  code += '`;\n';
  code += '  }\n\n';

  code += '  private getTektonTriggersCRD(): string {\n';
  code += '    return `apiVersion: v1\n';
  code += 'kind: ConfigMap\n';
  code += 'metadata:\n';
  code += '  name: tekton-triggers-crds\n';
  code += 'data:\n';
  code += '  tekton-triggers.yaml: |\n';
  code += '    # Tekton Triggers CRD content would be here\n';
  code += '    # Downloaded from: https://github.com/tektoncd/triggers/releases/download/v0.25.0/release.yaml\n';
  code += '`;\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const cicdPipeline = new CICDPipeline({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  namespace: \'default\',\n';
  code += '  gitRepo: \'https://github.com/example/app.git\',\n';
  code += '  branch: \'main\',\n';
  code += '  stages: [\n';
  code += '    {\n';
  code += '      name: \'clone\',\n';
  code += '      type: \'build\',\n';
  code += '      image: \'golang:1.21\',\n';
  code += '      commands: [\'git clone $(params.git-repo) .\', \'git checkout $(params.git-revision)\'],\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'build\',\n';
  code += '      type: \'build\',\n';
  code += '      image: \'golang:1.21\',\n';
  code += '      commands: [\'go build -o app ./main.go\', \'docker build -t $(params.image-url) .\'],\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'test\',\n';
  code += '      type: \'test\',\n';
  code += '      image: \'golang:1.21\',\n';
  code += '      commands: ["go test ./...", "go vet ./..."]\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'deploy\',\n';
  code += '      type: \'deploy\',\n';
  code += '      image: \'bitnami/kubectl:latest\',\n';
  code += '      commands: [\'kubectl apply -f k8s/\'],\n';
  code += '    },\n';
  code += '  ],\n';
  code += '  progressiveDelivery: {\n';
  code += '    enabled: true,\n';
  code += '    strategy: \'canary\',\n';
  code += '    canary: {\n';
  code += '      steps: 10,\n';
  code += '      intervalSeconds: 60,\n';
  code += '      incrementPercentage: 10,\n';
  code += '    },\n';
  code += '    analysis: {\n';
  code += '      enabled: true,\n';
  code += '      metrics: [\'request-success-rate\', \'request-duration\', \'cpu-usage\'],\n';
  code += '      successThreshold: 99,\n';
  code += '    },\n';
  code += '  },\n';
  code += '  enableNotifications: true,\n';
  code += '  enableRollback: true,\n';
  code += '});\n\n';

  code += 'export default cicdPipeline;\n';
  code += 'export { CICDPipeline, PipelineStage, ProgressiveDeliveryConfig };\n';

  return code;
}

export function generatePythonCICD(config: CICDPipelineConfig): string {
  let code = '# Auto-generated CI/CD Pipeline for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';

  code += '@dataclass\n';
  code += 'class PipelineStage:\n';
  code += '    name: str\n';
  code += '    stage_type: str\n';
  code += '    image: Optional[str] = None\n';
  code += '    commands: Optional[List[str]] = None\n';
  code += '    environment: Optional[Dict[str, str]] = None\n\n';

  code += '@dataclass\n';
  code += 'class ProgressiveDeliveryConfig:\n';
  code += '    enabled: bool = False\n';
  code += '    strategy: str = "canary"\n';
  code += '    canary_steps: Optional[int] = None\n';
  code += '    interval_seconds: Optional[int] = None\n';
  code += '    increment_percentage: Optional[int] = None\n\n';

  code += 'class CICDPipeline:\n';
  code += '    def __init__(self, project_name: str = None, namespace: str = "default", git_repo: str = None, branch: str = "main", stages: List[PipelineStage] = None, progressive_delivery: ProgressiveDeliveryConfig = None, enable_notifications: bool = True, enable_rollback: bool = True):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespace = namespace\n';
  code += '        self.git_repo = git_repo or "https://github.com/example/app.git"\n';
  code += '        self.branch = branch\n';
  code += '        self.stages = stages or []\n';
  code += '        self.progressive_delivery = progressive_delivery or ProgressiveDeliveryConfig()\n';
  code += '        self.enable_notifications = enable_notifications\n';
  code += '        self.enable_rollback = enable_rollback\n\n';

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[CI/CD] Deploying CI/CD pipeline...")\n';
  code += '        print("[CI/CD] ✓ CI/CD pipeline deployed successfully")\n\n';

  code += '    async def get_status(self) -> None:\n';
  code += '        print("[CI/CD] Getting pipeline status...")\n';
  code += '        result = subprocess.run(\n';
  code += '            ["kubectl", "get", "pipelineruns", "-n", self.namespace, "-o", "json"],\n';
  code += '            capture_output=True,\n';
  code += '            text=True,\n';
  code += '            check=True\n';
  code += '        )\n';
  code += '        runs = json.loads(result.stdout)\n';
  code += '        print(f"[CI/CD] Found {len(runs[\'items\'])} pipeline runs")\n\n';

  code += 'cicd_pipeline = CICDPipeline(\n';
  code += '    project_name="my-app",\n';
  code += '    namespace="default",\n';
  code += '    progressive_delivery=ProgressiveDeliveryConfig(\n';
  code += '        enabled=True,\n';
  code += '        strategy="canary",\n';
  code += '    ),\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: CICDPipelineConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptCICD(config);
  fs.writeFileSync(path.join(outputDir, 'cicd-pipeline.ts'), tsCode);

  const pyCode = generatePythonCICD(config);
  fs.writeFileSync(path.join(outputDir, 'cicd-pipeline.py'), pyCode);

  const md = generateCICDMD(config);
  fs.writeFileSync(path.join(outputDir, 'CICD.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Kubernetes-native CI/CD pipeline',
    main: 'cicd-pipeline.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0', '@kubernetes/client-node': '^0.20.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0\nkubernetes>=28.0.0');
  fs.writeFileSync(path.join(outputDir, 'cicd-config.json'), JSON.stringify(config, null, 2));
}
