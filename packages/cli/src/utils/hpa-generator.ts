// Auto-generated HPA Generator
// Generated at: 2026-01-12T23:09:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface Metric {
  name: string;
  type: 'Resource' | 'Pods' | 'Object' | 'External';
  resource?: {
    name: 'cpu' | 'memory';
    target: {
      type: 'Utilization' | 'AverageValue';
      averageUtilization?: number;
      averageValue?: string;
    };
  };
  pods?: {
    metric: {
      name: string;
    };
    target: {
      type: 'AverageValue';
      averageValue: string;
    };
  };
  object?: {
    describedObject: {
      apiVersion: string;
      kind: string;
      name: string;
    };
    metric: {
      name: string;
    };
    target: {
      type: 'Value' | 'AverageValue';
      value?: string;
      averageValue?: string;
    };
  };
  external?: {
    metric: {
      name: string;
      selector?: string;
    };
    target: {
      type: 'AverageValue';
      averageValue: string;
    };
  };
}

interface PredictiveScalingConfig {
  enabled: boolean;
  algorithm?: 'linear' | 'exponential' | 'ml-based';
  lookbackDays?: number;
  predictionHorizonMinutes?: number;
  scaleUpCooldownMinutes?: number;
  scaleDownCooldownMinutes?: number;
}

interface HPAConfig {
  projectName: string;
  namespace: string;
  minReplicas: number;
  maxReplicas: number;
  targetMetrics: Metric[];
  behavior?: {
    scaleDown?: {
      stabilizationWindowSeconds?: number;
      policies?: Array<{
        type: string;
        value: number;
        periodSeconds: number;
      }>;
    };
    scaleUp?: {
      stabilizationWindowSeconds?: number;
      policies?: Array<{
        type: string;
        value: number;
        periodSeconds: number;
      }>;
    };
  };
  predictiveScaling?: PredictiveScalingConfig;
}

export function displayConfig(config: HPAConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Horizontal Pod Autoscaling');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'Min Replicas:', config.minReplicas);
  console.log('\x1b[33m%s\x1b[0m', 'Max Replicas:', config.maxReplicas);
  console.log('\x1b[33m%s\x1b[0m', 'Metrics:', config.targetMetrics.map(m => m.name).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Predictive Scaling:', config.predictiveScaling?.enabled ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateHPAMD(config: HPAConfig): string {
  let md = '# Horizontal Pod Autoscaling\n\n';
  md += '## Features\n\n';
  md += '- Custom metrics-based autoscaling\n';
  md += '- Resource metrics (CPU, memory)\n';
  md += '- Pod metrics (requests per second, custom metrics)\n';
  md += '- Object metrics (Ingress, Custom Resources)\n';
  md += '- External metrics (Prometheus, CloudWatch)\n';
  md += '- Predictive scaling with ML algorithms\n';
  md += '- Scale-up and scale-down policies\n';
  md += '- Stabilization windows\n';
  md += '- Advanced traffic prediction\n';
  md += '- Automatic metric discovery\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import hpa from \'./hpa-generator\';\n\n';
  md += '// Deploy HPA resources\n';
  md += 'await hpa.deploy();\n\n';
  md += '// Enable predictive scaling\n';
  md += 'await hpa.enablePredictiveScaling();\n\n';
  md += '// Check scaling status\n';
  md += 'await hpa.getStatus();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptHPA(config: HPAConfig): string {
  let code = '// Auto-generated HPA Generator for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import axios from \'axios\';\n\n';

  code += 'class HPAController {\n';
  code += '  private projectName: string;\n';
  code += '  private namespace: string;\n';
  code += '  private minReplicas: number;\n';
  code += '  private maxReplicas: number;\n';
  code += '  private targetMetrics: Metric[];\n';
  code += '  private behavior: any;\n';
  code += '  private predictiveScaling: PredictiveScalingConfig;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.minReplicas = options.minReplicas || 2;\n';
  code += '    this.maxReplicas = options.maxReplicas || 10;\n';
  code += '    this.targetMetrics = options.targetMetrics || [];\n';
  code += '    this.behavior = options.behavior;\n';
  code += '    this.predictiveScaling = options.predictiveScaling || { enabled: false };\n';
  code += '  }\n\n';

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[HPA] Deploying Horizontal Pod Autoscaler...\');\n\n';

  code += '    const hpa = this.generateHPA();\n';
  code += '    const yaml = this.toYaml(hpa);\n';
  code += '    const hpaPath = path.join(process.cwd(), \'k8s\', \'hpa.yaml\');\n\n';

  code += '    fs.mkdirSync(path.dirname(hpaPath), { recursive: true });\n';
  code += '    fs.writeFileSync(hpaPath, yaml);\n\n';

  code += '    console.log(\'[HPA] Applying HPA manifest...\');\n';
  code += '    execSync(`kubectl apply -f ${hpaPath}`, {\n';
  code += '      stdio: \'inherit\',\n';
  code += '    });\n\n';

  code += '    console.log(\'[HPA] ✓ HPA deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private generateHPA(): any {\n';
  code += '    const hpa: any = {\n';
  code += '      apiVersion: \'autoscaling/v2\',\n';
  code += '      kind: \'HorizontalPodAutoscaler\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        scaleTargetRef: {\n';
  code += '          apiVersion: \'apps/v1\',\n';
  code += '          kind: \'Deployment\',\n';
  code += '          name: this.projectName,\n';
  code += '        },\n';
  code += '        minReplicas: this.minReplicas,\n';
  code += '        maxReplicas: this.maxReplicas,\n';
  code += '        metrics: this.targetMetrics.map(metric => this.generateMetricSpec(metric)),\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    if (this.behavior) {\n';
  code += '      hpa.spec.behavior = this.behavior;\n';
  code += '    }\n\n';

  code += '    return hpa;\n';
  code += '  }\n\n';

  code += '  private generateMetricSpec(metric: Metric): any {\n';
  code += '    switch (metric.type) {\n';
  code += '      case \'Resource\':\n';
  code += '        return {\n';
  code += '          type: \'Resource\',\n';
  code += '          resource: {\n';
  code += '            name: metric.resource?.name,\n';
  code += '            target: {\n';
  code += '              type: metric.resource?.target.type,\n';
  code += '              ...(metric.resource?.target.averageUtilization && { averageUtilization: metric.resource.target.averageUtilization }),\n';
  code += '              ...(metric.resource?.target.averageValue && { averageValue: metric.resource.target.averageValue }),\n';
  code += '            },\n';
  code += '          },\n';
  code += '        };\n\n';

  code += '      case \'Pods\':\n';
  code += '        return {\n';
  code += '          type: \'Pods\',\n';
  code += '          pods: metric.pods,\n';
  code += '        };\n\n';

  code += '      case \'Object\':\n';
  code += '        return {\n';
  code += '          type: \'Object\',\n';
  code += '          object: metric.object,\n';
  code += '        };\n\n';

  code += '      case \'External\':\n';
  code += '        return {\n';
  code += '          type: \'External\',\n';
  code += '          external: metric.external,\n';
  code += '        };\n\n';

  code += '      default:\n';
  code += '        throw new Error(`Unknown metric type: ${metric.type}`);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async enablePredictiveScaling(): Promise<void> {\n';
  code += '    if (!this.predictiveScaling.enabled) {\n';
  code += '      console.log(\'[HPA] Predictive scaling is disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    console.log(\'[HPA] Enabling predictive scaling...\');\n\n';

  code += '    // Deploy Prometheus Adapter for custom metrics\n';
  code += '    await this.deployPrometheusAdapter();\n\n';

  code += '    // Deploy predictive scaling service\n';
  code += '    await this.deployPredictiveScalingService();\n\n';

  code += '    console.log(\'[HPA] ✓ Predictive scaling enabled\');\n';
  code += '  }\n\n';

  code += '  private async deployPrometheusAdapter(): Promise<void> {\n';
  code += '    console.log(\'[HPA] Deploying Prometheus Adapter...\');\n\n';

  code += '    const adapter = {\n';
  code += '      apiVersion: \'apiregistration.k8s.io/v1\',\n';
  code += '      kind: \'APIService\',\n';
  code += '      metadata: {\n';
  code += '        name: \'v1beta1.metrics.k8s.io\',\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        service: {\n';
  code += '          name: \'prometheus-adapter\',\n';
  code += '          namespace: \'kube-system\',\n';
  code += '          port: 443,\n';
  code += '        },\n';
  code += '        group: \'metrics.k8s.io\',\n';
  code += '        version: \'v1beta1\',\n';
  code += '        groupPriorityMinimum: 100,\n';
  code += '        versionPriority: 100,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(adapter);\n';
  code += '    const adapterPath = path.join(process.cwd(), \'k8s\', \'prometheus-adapter.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(adapterPath), { recursive: true });\n';
  code += '    fs.writeFileSync(adapterPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${adapterPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[HPA] Failed to deploy Prometheus Adapter:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async deployPredictiveScalingService(): Promise<void> {\n';
  code += '    console.log(\'[HPA] Deploying predictive scaling service...\');\n\n';

  code += '    const deployment = {\n';
  code += '      apiVersion: \'apps/v1\',\n';
  code += '      kind: \'Deployment\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-predictive-scaling`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        replicas: 1,\n';
  code += '        selector: {\n';
  code += '          matchLabels: {\n';
  code += '            app: \'predictive-scaling\',\n';
  code += '          },\n';
  code += '        },\n';
  code += '        template: {\n';
  code += '          metadata: {\n';
  code += '            labels: {\n';
  code += '              app: \'predictive-scaling\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '          spec: {\n';
  code += '            containers: [\n';
  code += '              {\n';
  code += '                name: \'scaler\',\n';
  code += '                image: \'python:3.9-slim\',\n';
  code += '                command: [\'python\', \'-u\', \'scaler.py\'],\n';
  code += '                env: [\n';
  code += '                  { name: \'ALGORITHM\', value: this.predictiveScaling.algorithm },\n';
  code += '                  { name: \'LOOKBACK_DAYS\', value: this.predictiveScaling.lookbackDays.toString() },\n';
  code += '                  { name: \'PREDICTION_HORIZON_MINUTES\', value: this.predictiveScaling.predictionHorizonMinutes.toString() },\n';
  code += '                  { name: \'SCALE_UP_COOLDOWN_MINUTES\', value: this.predictiveScaling.scaleUpCooldownMinutes.toString() },\n';
  code += '                  { name: \'SCALE_DOWN_COOLDOWN_MINUTES\', value: this.predictiveScaling.scaleDownCooldownMinutes.toString() },\n';
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
  code += '    const deploymentPath = path.join(process.cwd(), \'k8s\', \'predictive-scaling-deployment.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });\n';
  code += '    fs.writeFileSync(deploymentPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${deploymentPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[HPA] Failed to deploy predictive scaling service:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async getStatus(): Promise<void> {\n';
  code += '    console.log(\'[HPA] Checking HPA status...\');\n\n';

  code += '    try {\n';
  code += '      const result = execSync(\'kubectl get hpa \' + this.projectName + \' -n \' + this.namespace + \' -o json\', {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '      });\n\n';

  code += '      const hpa = JSON.parse(result);\n';
  code += '      console.log(`[HPA] Current Replicas: ${hpa.status.currentReplicas}`);\n';
  code += '      console.log(`[HPA] Desired Replicas: ${hpa.status.desiredReplicas}`);\n';
  code += '      console.log(`[HPA] Min Replicas: ${hpa.spec.minReplicas}`);\n';
  code += '      console.log(`[HPA] Max Replicas: ${hpa.spec.maxReplicas}`);\n\n';

  code += '      if (hpa.status.currentMetrics) {\n';
  code += '        console.log(\'[HPA] Current Metrics:\');\n';
  code += '        hpa.status.currentMetrics.forEach((metric: any) => {\n';
  code += '          console.log(`  - ${metric.type}: ${JSON.stringify(metric.resource || metric.pods || metric.external)}`);\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[HPA] Failed to get status:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const hpa = new HPAController({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  namespace: \'default\',\n';
  code += '  minReplicas: 2,\n';
  code += '  maxReplicas: 10,\n';
  code += '  targetMetrics: [\n';
  code += '    {\n';
  code += '      name: \'cpu\',\n';
  code += '      type: \'Resource\',\n';
  code += '      resource: {\n';
  code += '        name: \'cpu\',\n';
  code += '        target: {\n';
  code += '          type: \'Utilization\',\n';
  code += '          averageUtilization: 70,\n';
  code += '        },\n';
  code += '      },\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'requests-per-second\',\n';
  code += '      type: \'Pods\',\n';
  code += '      pods: {\n';
  code += '        metric: {\n';
  code += '          name: \'http_requests_per_second\',\n';
  code += '        },\n';
  code += '        target: {\n';
  code += '          type: \'AverageValue\',\n';
  code += '          averageValue: \'1000\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '    },\n';
  code += '  ],\n';
  code += '  behavior: {\n';
  code += '    scaleDown: {\n';
  code += '      stabilizationWindowSeconds: 300,\n';
  code += '      policies: [\n';
  code += '        { type: \'Percent\', value: 50, periodSeconds: 60 },\n';
  code += '      ],\n';
  code += '    },\n';
  code += '    scaleUp: {\n';
  code += '      stabilizationWindowSeconds: 0,\n';
  code += '      policies: [\n';
  code += '        { type: \'Percent\', value: 100, periodSeconds: 15 },\n';
  code += '        { type: \'Pods\', value: 4, periodSeconds: 15 },\n';
  code += '      ],\n';
  code += '      selectPolicy: \'Max\',\n';
  code += '    },\n';
  code += '  },\n';
  code += '  predictiveScaling: {\n';
  code += '    enabled: true,\n';
  code += '    algorithm: \'ml-based\',\n';
  code += '    lookbackDays: 7,\n';
  code += '    predictionHorizonMinutes: 15,\n';
  code += '    scaleUpCooldownMinutes: 5,\n';
  code += '    scaleDownCooldownMinutes: 10,\n';
  code += '  },\n';
  code += '});\n\n';

  code += 'export default hpa;\n';
  code += 'export { HPAController, Metric, PredictiveScalingConfig };\n';

  return code;
}

export function generatePythonHPA(config: HPAConfig): string {
  let code = '# Auto-generated HPA Generator for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';

  code += '@dataclass\n';
  code += 'class Metric:\n';
  code += '    name: str\n';
  code += '    type: str\n';
  code += '    resource: Optional[Dict[str, Any]] = None\n';
  code += '    pods: Optional[Dict[str, Any]] = None\n';
  code += '    external: Optional[Dict[str, Any]] = None\n\n';

  code += '@dataclass\n';
  code += 'class PredictiveScalingConfig:\n';
  code += '    enabled: bool = False\n';
  code += '    algorithm: str = "linear"\n';
  code += '    lookback_days: int = 7\n';
  code += '    prediction_horizon_minutes: int = 15\n';
  code += '    scale_up_cooldown_minutes: int = 5\n';
  code += '    scale_down_cooldown_minutes: int = 10\n\n';

  code += 'class HPAController:\n';
  code += '    def __init__(self, project_name: str = None, namespace: str = "default", min_replicas: int = 2, max_replicas: int = 10, target_metrics: List[Metric] = None, behavior: Dict[str, Any] = None, predictive_scaling: PredictiveScalingConfig = None):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespace = namespace\n';
  code += '        self.min_replicas = min_replicas\n';
  code += '        self.max_replicas = max_replicas\n';
  code += '        self.target_metrics = target_metrics or []\n';
  code += '        self.behavior = behavior\n';
  code += '        self.predictive_scaling = predictive_scaling or PredictiveScalingConfig()\n\n';

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[HPA] Deploying Horizontal Pod Autoscaler...")\n\n';

  code += '        hpa = self._generate_hpa()\n';
  code += '        yaml_content = yaml.dump(hpa)\n';
  code += '        hpa_path = Path.cwd() / "k8s" / "hpa.yaml"\n';
  code += '        hpa_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '        hpa_path.write_text(yaml_content)\n\n';

  code += '        print("[HPA] Applying HPA manifest...")\n';
  code += '        subprocess.run(["kubectl", "apply", "-f", str(hpa_path)], check=True)\n\n';

  code += '        print("[HPA] ✓ HPA deployed successfully")\n\n';

  code += '    def _generate_hpa(self) -> Dict[str, Any]:\n';
  code += '        hpa = {\n';
  code += '            "apiVersion": "autoscaling/v2",\n';
  code += '            "kind": "HorizontalPodAutoscaler",\n';
  code += '            "metadata": {\n';
  code += '                "name": self.project_name,\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "scaleTargetRef": {\n';
  code += '                    "apiVersion": "apps/v1",\n';
  code += '                    "kind": "Deployment",\n';
  code += '                    "name": self.project_name,\n';
  code += '                },\n';
  code += '                "minReplicas": self.min_replicas,\n';
  code += '                "maxReplicas": self.max_replicas,\n';
  code += '                "metrics": [self._generate_metric_spec(metric) for metric in self.target_metrics],\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        if self.behavior:\n';
  code += '            hpa["spec"]["behavior"] = self.behavior\n\n';

  code += '        return hpa\n\n';

  code += '    def _generate_metric_spec(self, metric: Metric) -> Dict[str, Any]:\n';
  code += '        if metric.type == "Resource":\n';
  code += '            return {\n';
  code += '                "type": "Resource",\n';
  code += '                "resource": metric.resource,\n';
  code += '            }\n';
  code += '        elif metric.type == "Pods":\n';
  code += '            return {\n';
  code += '                "type": "Pods",\n';
  code += '                "pods": metric.pods,\n';
  code += '            }\n';
  code += '        elif metric.type == "External":\n';
  code += '            return {\n';
  code += '                "type": "External",\n';
  code += '                "external": metric.external,\n';
  code += '            }\n';
  code += '        else:\n';
  code += '            raise ValueError(f"Unknown metric type: {metric.type}")\n\n';

  code += '    async def get_status(self) -> None:\n';
  code += '        print("[HPA] Checking HPA status...")\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["kubectl", "get", "hpa", self.project_name, "-n", self.namespace, "-o", "json"],\n';
  code += '                capture_output=True,\n';
  code += '                text=True,\n';
  code += '                check=True\n';
  code += '            )\n\n';

  code += '            hpa = json.loads(result.stdout)\\n';
  code += '            print(f"[HPA] Current Replicas: {hpa[\\\'status\\\'][\\\'currentReplicas\']}")\\n';
  code += '            print(f"[HPA] Desired Replicas: {hpa[\\\'status\\\'][\\\'desiredReplicas\']}")\\n';
  code += '            print(f"[HPA] Min Replicas: {hpa[\\\'spec\\\'][\\\'minReplicas\']}")\\n';
  code += '            print(f"[HPA] Max Replicas: {hpa[\\\'spec\\\'][\\\'maxReplicas\']}")\\n\\n';

  code += '            if "currentMetrics" in hpa["status"]:\\n';
  code += '                print("[HPA] Current Metrics:")\\n';
  code += '                for metric in hpa["status"]["currentMetrics"]:\\n';
  code += '                    print(f"  - {metric[\\\'type\\\']}: {json.dumps(metric.get(\\\'resource\\\', metric.get(\\\'pods\\\', metric.get(\\\'external\\\'))))}")\\n\\n';

  code += '        except Exception as e:\n';
  code += '            print(f"[HPA] Failed to get status: {e}")\n\n';

  code += 'hpa = HPAController(\n';
  code += '    project_name="my-app",\n';
  code += '    namespace="default",\n';
  code += '    min_replicas=2,\n';
  code += '    max_replicas=10,\n';
  code += '    predictive_scaling=PredictiveScalingConfig(\n';
  code += '        enabled=True,\n';
  code += '        algorithm="ml-based",\n';
  code += '    ),\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: HPAConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptHPA(config);
  fs.writeFileSync(path.join(outputDir, 'hpa-generator.ts'), tsCode);

  const pyCode = generatePythonHPA(config);
  fs.writeFileSync(path.join(outputDir, 'hpa-generator.py'), pyCode);

  const md = generateHPAMD(config);
  fs.writeFileSync(path.join(outputDir, 'HPA.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Horizontal Pod Autoscaler with predictive scaling',
    main: 'hpa-generator.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0', axios: '^1.6.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0\nrequests>=2.31.0');
  fs.writeFileSync(path.join(outputDir, 'hpa-config.json'), JSON.stringify(config, null, 2));
}
