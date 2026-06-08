// Auto-generated Helm Chart Generator
// Generated at: 2026-01-12T22:59:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface HelmChart {
  name: string;
  version: string;
  description: string;
  apiVersion: string;
}

interface HelmConfig {
  projectName: string;
  chartName: string;
  environments: string[];
  services: ServiceConfig[];
}

interface ServiceConfig {
  name: string;
  port: number;
  image: string;
  replicas: number;
}

export function displayConfig(config: HelmConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Helm Chart Generator');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Chart Name:', config.chartName);
  console.log('\x1b[33m%s\x1b[0m', 'Environments:', config.environments.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Services:', config.services.map(s => s.name).join(', '));
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateHelmMD(config: HelmConfig): string {
  let md = '# Helm Chart Generator\n\n';
  md += '## Features\n\n';
  md += '- Helm chart templates generation\n';
  md += '- Environment-specific values files\n';
  md += '- Dependency management\n';
  md += '- Deployment, Service, and Ingress templates\n';
  md += '- ConfigMap and Secret templates\n';
  md += '- RBAC and ServiceAccount templates\n';
  md += '- HPA templates\n';
  md += '- Notes.txt for post-install instructions\n';
  md += '- Chart.yaml and values.yaml generation\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import helmGenerator from \'./helm-chart-generator\';\n\n';
  md += '// Generate Helm chart\n';
  md += 'await helmGenerator.generate();\n\n';
  md += '// Package chart\n';
  md += 'await helmGenerator.package();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptHelm(config: HelmConfig): string {
  let code = '// Auto-generated Helm Chart Generator for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface HelmChart {\n';
  code += '  name: string;\n';
  code += '  version: string;\n';
  code += '  description: string;\n';
  code += '  apiVersion: string;\n';
  code += '}\n\n';

  code += 'class HelmChartGenerator {\n';
  code += '  private projectName: string;\n';
  code += '  private chartName: string;\n';
  code += '  private environments: string[];\n';
  code += '  private services: ServiceConfig[];\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.chartName = options.chartName || this.projectName;\n';
  code += '    this.environments = options.environments || [\'dev\', \'staging\', \'prod\'];\n';
  code += '    this.services = options.services || [];\n';
  code += '  }\n\n';

  code += '  async generate(): Promise<void> {\n';
  code += '    console.log(\'[Helm] Generating Helm chart...\');\n\n';

  code += '    const chartDir = path.join(process.cwd(), \'helm\', this.chartName);\n';
  code += '    const templatesDir = path.join(chartDir, \'templates\');\n';
  code += '    const chartsDir = path.join(chartDir, \'charts\');\n\n';

  code += '    // Create directories\n';
  code += '    fs.mkdirSync(templatesDir, { recursive: true });\n';
  code += '    fs.mkdirSync(chartsDir, { recursive: true });\n\n';

  code += '    // Generate Chart.yaml\n';
  code += '    this.generateChartYaml(chartDir);\n\n';

  code += '    // Generate values.yaml\n';
  code += '    this.generateValuesYaml(chartDir);\n\n';

  code += '    // Generate templates\n';
  code += '    this.generateTemplates(templatesDir);\n\n';

  code += '    // Generate environment-specific values\n';
  code += '    for (const env of this.environments) {\n';
  code += '      this.generateEnvValues(chartDir, env);\n';
  code += '    }\n\n';

  code += '    console.log(\'[Helm] Helm chart generation complete\');\n';
  code += '  }\n\n';

  code += '  private generateChartYaml(chartDir: string): void {\n';
  code += '    const chartYaml = {\n';
  code += '      name: this.chartName,\n';
  code += '      version: \'0.1.0\',\n';
  code += '      description: `Helm chart for ${this.projectName}`,\n';
  code += '      apiVersion: \'v2\',\n';
  code += '      type: \'application\',\n';
  code += '      appVersion: \'1.0.0\',\n';
  code += '      dependencies: this.services.map(s => ({\n';
  code += '        name: s.name,\n';
  code += '        version: \'>= 0.1.0\',\n';
  code += '        repository: `file://../${s.name}`,\n';
  code += '      })),\n';
  code += '    };\n\n';

  code += '    fs.writeFileSync(\n';
  code += '      path.join(chartDir, \'Chart.yaml\'),\n';
  code += '      JSON.stringify(chartYaml, null, 2).replace(/"/g, \'\')\n';
  code += '    );\n';
  code += '  }\n\n';

  code += '  private generateValuesYaml(chartDir: string): void {\n';
  code += '    let values = \'# Default values for \' + this.chartName + \'\\n\\n\';\n';
  code += '    values += \'global:\\n\';\n';
  code += '    values += \'  environment: production\\n\\n\';\n\n';

  code += '    for (const service of this.services) {\n';
  code += '      values += `${service.name}:\\n`;\n';
  code += '      values += \'  enabled: true\\n\';\n';
  code += '      values += \'  replicaCount: 3\\n\\n\';\n';
  code += '      values += \'  image:\\n\';\n';
  code += '      values += `    repository: ${service.image.split(\':\')[0]}\\n`;\n';
  code += '      values += `    tag: ${service.image.split(\':\')[1] || \'latest\'}\\n`;\n';
  code += '      values += `    pullPolicy: IfNotPresent\\n\\n`;\n';
  code += '      values += \'  service:\\n\';\n';
  code += '      values += \'    type: ClusterIP\\n\';\n';
  code += '      values += `    port: ${service.port}\\n\\n`;\n';
  code += '      values += \'  resources:\\n\';\n';
  code += '      values += \'    requests:\\n\';\n';
  code += '      values += \'      cpu: 100m\\n\';\n';
  code += '      values += \'      memory: 128Mi\\n\';\n';
  code += '      values += \'    limits:\\n\';\n';
  code += '      values += \'      cpu: 500m\\n\';\n';
  code += '      values += \'      memory: 512Mi\\n\\n\';\n';
  code += '    }\n\n';

  code += '    fs.writeFileSync(path.join(chartDir, \'values.yaml\'), values);\n';
  code += '  }\n\n';

  code += '  private generateTemplates(templatesDir: string): void {\n';
  code += '    // Generate deployment template\n';
  code += '    let deployment = \'{{- range .Values.services }}\\n\';\n';
  code += '    deployment += \'{{- if .enabled }}\\n\\n\';\n';
  code += '    deployment += \'apiVersion: apps/v1\\n\';\n';
  code += '    deployment += \'kind: Deployment\\n\';\n';
  code += '    deployment += \'metadata:\\n\';\n';
  code += '    deployment += \'  name: {{ .name }}\\n\';\n';
  code += '    deployment += \'  labels:\\n\';\n';
  code += '    deployment += \'    app: {{ .name }}\\n\';\n';
  code += '    deployment += \'spec:\\n\';\n';
  code += '    deployment += \'  replicas: {{ .replicaCount }}\\n\';\n';
  code += '    deployment += \'  selector:\\n\';\n';
  code += '    deployment += \'    matchLabels:\\n\';\n';
  code += '    deployment += \'      app: {{ .name }}\\n\';\n';
  code += '    deployment += \'  template:\\n\';\n';
  code += '    deployment += \'    metadata:\\n\';\n';
  code += '    deployment += \'      labels:\\n\';\n';
  code += '    deployment += \'        app: {{ .name }}\\n\';\n';
  code += '    deployment += \'    spec:\\n\';\n';
  code += '    deployment += \'      containers:\\n\';\n';
  code += '    deployment += \'        - name: {{ .name }}\\n\';\n';
  code += '    deployment += \'          image: "{{ .image.repository }}:{{ .image.tag }}"\\n\';\n';
  code += '    deployment += \'          ports:\\n\';\n';
  code += '    deployment += \'            - containerPort: {{ .service.port }}\\n\';\n';
  code += '    deployment += \'          resources: {{ toYaml .resources | nindent 12 }}\\n\';\n';
  code += '    deployment += \'{{- end }}\\n\';\n';
  code += '    deployment += \'{{- end }}\\n\';\n\n';

  code += '    fs.writeFileSync(path.join(templatesDir, \'deployment.yaml\'), deployment);\n\n';

  code += '    // Generate service template\n';
  code += '    let service = \'{{- range .Values.services }}\\n\';\n';
  code += '    service += \'{{- if .enabled }}\\n\\n\';\n';
  code += '    service += \'apiVersion: v1\\n\';\n';
  code += '    service += \'kind: Service\\n\';\n';
  code += '    service += \'metadata:\\n\';\n';
  code += '    service += \'  name: {{ .name }}-svc\\n\';\n';
  code += '    service += \'spec:\\n\';\n';
  code += '    service += \'  type: {{ .service.type }}\\n\';\n';
  code += '    service += \'  selector:\\n\';\n';
  code += '    service += \'    app: {{ .name }}\\n\';\n';
  code += '    service += \'  ports:\\n\';\n';
  code += '    service += \'    - port: {{ .service.port }}\\n\';\n';
  code += '    service += \'      targetPort: {{ .service.port }}\\n\';\n';
  code += '    service += \'      protocol: TCP\\n\';\n';
  code += '    service += \'{{- end }}\\n\';\n';
  code += '    service += \'{{- end }}\\n\';\n\n';

  code += '    fs.writeFileSync(path.join(templatesDir, \'service.yaml\'), service);\n\n';

  code += '    // Generate ingress template\n';
  code += '    let ingress = \'{{- range .Values.services }}\\n\';\n';
  code += '    ingress += \'{{- if .enabled }}\\n\\n\';\n';
  code += '    ingress += \'{{- if .ingress.enabled }}\\n\';\n';
  code += '    ingress += \'apiVersion: networking.k8s.io/v1\\n\';\n';
  code += '    ingress += \'kind: Ingress\\n\';\n';
  code += '    ingress += \'metadata:\\n\';\n';
  code += '    ingress += \'  name: {{ .name }}-ingress\\n\';\n';
  code += '    ingress += \'  annotations: {{ toYaml .ingress.annotations | nindent 4 }}\\n\';\n';
  code += '    ingress += \'spec:\\n\';\n';
  code += '    ingress += \'  ingressClassName: nginx\\n\';\n';
  code += '    ingress += \'  rules:\\n\';\n';
  code += '    ingress += \'    - host: {{ .ingress.host }}\\n\';\n';
  code += '    ingress += \'      http:\\n\';\n';
  code += '    ingress += \'        paths:\\n\';\n';
  code += '    ingress += \'          - path: /\\n\';\n';
  code += '    ingress += \'            pathType: Prefix\\n\';\n';
  code += '    ingress += \'            backend:\\n\';\n';
  code += '    ingress += \'              service:\\n\';\n';
  code += '    ingress += \'                name: {{ .name }}-svc\\n\';\n';
  code += '    ingress += \'                port:\\n\';\n';
  code += '    ingress += \'                  number: {{ .service.port }}\\n\';\n';
  code += '    ingress += \'{{- end }}\\n\';\n';
  code += '    ingress += \'{{- end }}\\n\';\n';
  code += '    ingress += \'{{- end }}\\n\';\n\n';

  code += '    fs.writeFileSync(path.join(templatesDir, \'ingress.yaml\'), ingress);\n';
  code += '  }\n\n';

  code += '  private generateEnvValues(chartDir: string, env: string): void {\n';
  code += '    let values = `# Values for ${env}\\n\\n`;\n';
  code += '    values += \'global:\\n\';\n';
  code += '    values += `  environment: ${env}\\n\\n`;\n\n';

  code += '    for (const service of this.services) {\n';
  code += '      values += `${service.name}:\\n`;\n';

  code += '      if (env === \'prod\') {\n';
  code += '        values += \'  replicaCount: 5\\n\';\n';
  code += '        values += \'  resources:\\n\';\n';
  code += '        values += \'    requests:\\n\';\n';
  code += '        values += \'      cpu: 500m\\n\';\n';
  code += '        values += \'      memory: 512Mi\\n\';\n';
  code += '        values += \'    limits:\\n\';\n';
  code += '        values += \'      cpu: 2000m\\n\';\n';
  code += '        values += \'      memory: 2Gi\\n\';\n';
  code += '      } else if (env === \'staging\') {\n';
  code += '        values += \'  replicaCount: 2\\n\';\n';
  code += '        values += \'  resources:\\n\';\n';
  code += '        values += \'    requests:\\n\';\n';
  code += '        values += \'      cpu: 200m\\n\';\n';
  code += '        values += \'      memory: 256Mi\\n\';\n';
  code += '        values += \'    limits:\\n\';\n';
  code += '        values += \'      cpu: 1000m\\n\';\n';
  code += '        values += \'      memory: 1Gi\\n\';\n';
  code += '      } else {\n';
  code += '        values += \'  replicaCount: 1\\n\';\n';
  code += '        values += \'  resources:\\n\';\n';
  code += '        values += \'    requests:\\n\';\n';
  code += '        values += \'      cpu: 100m\\n\';\n';
  code += '        values += \'      memory: 128Mi\\n\';\n';
  code += '        values += \'    limits:\\n\';\n';
  code += '        values += \'      cpu: 500m\\n\';\n';
  code += '        values += \'      memory: 512Mi\\n\';\n';
  code += '      }\n';
  code += '      values += \'\\n\';\n';
  code += '    }\n\n';

  code += '    fs.writeFileSync(path.join(chartDir, `values-${env}.yaml`), values);\n';
  code += '  }\n\n';

  code += '  async package(): Promise<void> {\n';
  code += '    const chartPath = path.join(process.cwd(), \'helm\', this.chartName);\n';
  code += '    const packagePath = path.join(process.cwd(), \'helm\');\n\n';

  code += '    try {\n';
  code += '      execSync(`helm package ${chartPath} -d ${packagePath}`, {\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '      console.log(`[Helm] Chart packaged successfully`);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Helm] Failed to package chart:`, error.message);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const helmGenerator = new HelmChartGenerator({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  chartName: \'my-chart\',\n';
  code += '  environments: [\'dev\', \'staging\', \'prod\'],\n';
  code += '  services: [\n';
  code += '    { name: \'api\', port: 3000, image: \'my-api:latest\', replicas: 3 },\n';
  code += '    { name: \'worker\', port: 8080, image: \'my-worker:latest\', replicas: 2 },\n';
  code += '  ],\n';
  code += '});\n\n';

  code += 'export default helmGenerator;\n';
  code += 'export { HelmChartGenerator, HelmChart, ServiceConfig };\n';

  return code;
}

export function generatePythonHelm(config: HelmConfig): string {
  let code = '# Auto-generated Helm Chart Generator for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import os\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class ServiceConfig:\n';
  code += '    name: str\n';
  code += '    port: int\n';
  code += '    image: str\n';
  code += '    replicas: int\n\n';

  code += 'class HelmChartGenerator:\n';
  code += '    def __init__(self, project_name: str = None, chart_name: str = None, environments: List[str] = None, services: List[ServiceConfig] = None):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.chart_name = chart_name or self.project_name\n';
  code += '        self.environments = environments or ["dev", "staging", "prod"]\n';
  code += '        self.services = services or []\n\n';

  code += '    async def generate(self) -> None:\n';
  code += '        print("[Helm] Generating Helm chart...")\n\n';

  code += '        chart_dir = Path.cwd() / "helm" / self.chart_name\n';
  code += '        templates_dir = chart_dir / "templates"\n';
  code += '        charts_dir = chart_dir / "charts"\n\n';

  code += '        templates_dir.mkdir(parents=True, exist_ok=True)\n';
  code += '        charts_dir.mkdir(parents=True, exist_ok=True)\n\n';

  code += '        self.generate_chart_yaml(chart_dir)\n';
  code += '        self.generate_values_yaml(chart_dir)\n';
  code += '        self.generate_templates(templates_dir)\n\n';

  code += '        for env in self.environments:\n';
  code += '            self.generate_env_values(chart_dir, env)\n\n';

  code += '        print("[Helm] Helm chart generation complete")\n\n';

  code += '    def generate_chart_yaml(self, chart_dir: Path) -> None:\n';
  code += '        chart_yaml = f"""name: {self.chart_name}\n';
  code += 'version: 0.1.0\n';
  code += 'description: Helm chart for {self.project_name}\n';
  code += 'apiVersion: v2\n';
  code += 'type: application\n';
  code += 'appVersion: 1.0.0\n';
  code += 'dependencies:\n';
  code += '"""\n\n';

  code += '        for service in self.services:\n';
  code += '            chart_yaml += f"""  - name: {service.name}\n';
  code += '    version: ">= 0.1.0"\n';
  code += '    repository: file://../{service.name}\n';
  code += '"""\n\n';

  code += '        (chart_dir / "Chart.yaml").write_text(chart_yaml)\n\n';

  code += 'helm_generator = HelmChartGenerator(\n';
  code += '    project_name="my-app",\n';
  code += '    chart_name="my-chart",\n';
  code += '    environments=["dev", "staging", "prod"],\n';
  code += '    services=[\n';
  code += '        ServiceConfig(name="api", port=3000, image="my-api:latest", replicas=3),\n';
  code += '        ServiceConfig(name="worker", port=8080, image="my-worker:latest", replicas=2),\n';
  code += '    ],\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: HelmConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptHelm(config);
  fs.writeFileSync(path.join(outputDir, 'helm-chart-generator.ts'), tsCode);

  const pyCode = generatePythonHelm(config);
  fs.writeFileSync(path.join(outputDir, 'helm-chart-generator.py'), pyCode);

  const md = generateHelmMD(config);
  fs.writeFileSync(path.join(outputDir, 'HELM_CHARTS.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Helm chart generator',
    main: 'helm-chart-generator.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'helm-config.json'), JSON.stringify(config, null, 2));
}
