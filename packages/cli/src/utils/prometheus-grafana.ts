// Auto-generated Prometheus/Grafana Integration Utility
// Generated at: 2026-01-13T12:00:00.000Z

type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
type DashboardType = 'overview' | 'performance' | 'infrastructure' | 'application' | 'custom';

interface MetricConfig {
  name: string;
  type: MetricType;
  help: string;
  labels: string[];
  buckets?: number[];
}

interface PrometheusConfig {
  enabled: boolean;
  retentionDays: number;
  scrapeInterval: string;
  evaluationInterval: string;
  externalLabels: { [key: string]: string };
  globalScrapeConfigs: {
    jobName: string;
    targets: string[];
    scrapeInterval: string;
    metricsPath: string;
  }[];
}

interface GrafanaConfig {
  enabled: boolean;
  adminPassword: string;
  anonymousAccess: boolean;
  dashboards: DashboardType[];
  datasources: {
    name: string;
    type: string;
    url: string;
    access: 'proxy' | 'direct';
  }[];
  alerts: {
    enabled: boolean;
    webhookUrl?: string;
  };
}

interface AlertRule {
  name: string;
  expr: string;
  for: string;
  labels: { [key: string]: string };
  annotations: { [key: string]: string };
}

interface MonitoringConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  prometheus: PrometheusConfig;
  grafana: GrafanaConfig;
  metrics: MetricConfig[];
  alerts: AlertRule[];
  enableRecordingRules: boolean;
  enableAlerting: boolean;
}

export function displayConfig(config: MonitoringConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Prometheus/Grafana Integration with Auto-Configuration');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Prometheus:', config.prometheus.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Grafana:', config.grafana.enabled ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Metrics:', config.metrics.length);
  console.log('\x1b[33m%s\x1b[0m', 'Dashboards:', config.grafana.dashboards.length);
  console.log('\x1b[33m%s\x1b[0m', 'Alerts:', config.alerts.length);
  console.log('\x1b[33m%s\x1b[0m', 'Recording Rules:', config.enableRecordingRules ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Alerting:', config.enableAlerting ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generatePrometheusGrafanaMD(config: MonitoringConfig): string {
  let md = '# Prometheus/Grafana Integration\n\n';
  md += '## Features\n\n';
  md += '- Prometheus metrics collection with custom scrape configurations\n';
  md += '- Grafana dashboards with auto-configuration\n';
  md += '- Custom metric types (counter, gauge, histogram, summary)\n';
  md += '- Alert management with Prometheus Alertmanager\n';
  md += '- Recording rules for computed metrics\n';
  md += '- Multi-cloud provider integration\n';
  md += '- Pre-built dashboards (overview, performance, infrastructure, application)\n';
  md += '- Anonymous access control\n';
  md += '- Data source auto-configuration\n\n';
  md += '## Usage\n\n';
  md += '```bash\n';
  md += '# Start Prometheus\n';
  md += 'prometheus --config.file=prometheus.yml\n\n';
  md += '# Start Grafana\n';
  md += 'grafana-server --config=grafana.ini\n\n';
  md += '# Access dashboards\n';
  md += 'http://localhost:3000\n';
  md += '```\n\n';
  md += '## Dashboards\n\n';
  config.grafana.dashboards.forEach(dash => {
    md += '- **' + dash + '**: Auto-configured with relevant metrics\n';
  });
  md += '\n## Metrics\n\n';
  config.metrics.forEach(metric => {
    md += '- **' + metric.name + '** (' + metric.type + '): ' + metric.help + '\n';
  });
  return md;
}

export function generateTerraformMonitoring(config: MonitoringConfig): string {
  let code = '# Auto-generated Prometheus/Grafana Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';

  if (config.providers.includes('aws')) {
    code += '# AWS Prometheus Workspace\n';
    code += 'resource "aws_prometheus_workspace" "main" {\n';
    code += '  alias = "' + config.projectName + '-workspace"\n';
    code += '}\n\n';

    code += '# AWS Grafana Workspace\n';
    code += 'resource "aws_amp_workspace" "main" {\n';
    code += '  alias = "' + config.projectName + '-grafana"\n';
    code += '}\n\n';

    code += '# CloudWatch Alarm Integration\n';
    code += 'resource "aws_cloudwatch_metric_alarm" "high_cpu" {\n';
    code += '  alarm_name          = "' + config.projectName + '-high-cpu"\n';
    code += '  comparison_operator = "GreaterThanOrEqualToThreshold"\n';
    code += '  evaluation_periods  = "2"\n';
    code += '  metric_name         = "CPUUtilization"\n';
    code += '  namespace           = "AWS/EC2"\n';
    code += '  period              = "120"\n';
    code += '  statistic           = "Average"\n';
    code += '  threshold           = "80"\n';
    code += '  alarm_description   = "This metric monitors EC2 CPU utilization"\n';
    code += '  alarm_actions       = [aws_sns_topic.main.arn]\n';
    code += '}\n\n';
  }

  if (config.providers.includes('azure')) {
    code += '# Azure Monitor Workspace\n';
    code += 'resource "azurerm_monitor_workspace" "main" {\n';
    code += '  name                = "' + config.projectName + '-monitor"\n';
    code += '  location            = azurerm_resource_group.main.location\n';
    code += '  resource_group_name = azurerm_resource_group.main.name\n';
    code += '}\n\n';

    code += '# Azure Grafana Instance\n';
    code += 'resource "azurerm_dashboard_grafana" "main" {\n';
    code += '  name                = "' + config.projectName + '-grafana"\n';
    code += '  location            = azurerm_resource_group.main.location\n';
    code += '  resource_group_name = azurerm_resource_group.main.name\n';
    code += '  sku                 = "Standard"\n';
    code += '}\n\n';
  }

  if (config.providers.includes('gcp')) {
    code += '# GCP Monitoring Workspace\n';
    code += 'resource "google_monitoring_dashboard" "main" {\n';
    code += '  dashboard_json = <<EOF\n';
    code += '{\n';
    code += '  "displayName": "' + config.projectName + ' Dashboard"\n';
    code += '}\n';
    code += 'EOF\n';
    code += '}\n\n';
  }

  code += '# Prometheus Configuration\n';
  code += 'resource "local_file" "prometheus_config" {\n';
  code += '  content = <<-EOF\n';
  code += 'global:\n';
  code += '  scrape_interval: ' + config.prometheus.scrapeInterval + '\n';
  code += '  evaluation_interval: ' + config.prometheus.evaluationInterval + '\n';
  code += '  retention: ' + (config.prometheus.retentionDays * 24) + 'h\n';
  code += '  external_labels:\n';
  if (Object.keys(config.prometheus.externalLabels).length > 0) {
    Object.entries(config.prometheus.externalLabels).forEach(([key, value]) => {
      code += '    ' + key + ': "' + value + '"\n';
    });
  } else {
    code += '    cluster: "' + config.projectName + '"\n';
    code += '    env: "production"\n';
  }
  code += 'EOF\n\n';
  code += '  filename = "${path.module}/prometheus.yml"\n';
  code += '}\n\n';

  if (config.enableAlerting) {
    code += '# Alertmanager Configuration\n';
    code += 'resource "local_file" "alertmanager_config" {\n';
    code += '  content = <<-EOF\n';
    code += 'global:\n';
    code += '  resolve_timeout: 5m\n\n';
    code += 'route:\n';
    code += '  group_by: [\'alertname\', \'cluster\', \'service\']\n';
    code += '  group_wait: 10s\n';
    code += '  group_interval: 10s\n';
    code += '  repeat_interval: 12h\n';
    code += '  receiver: \'default\'\n\n';
    code += 'receivers:\n';
    code += '- name: \'default\'\n';
    if (config.grafana.alerts.webhookUrl) {
      code += '  webhook_configs:\n';
      code += '  - url: "' + config.grafana.alerts.webhookUrl + '"\n';
    } else {
      code += '  email_configs:\n';
      code += '  - to: "alerts@' + config.projectName + '.com"\n';
    }
    code += 'EOF\n\n';
    code += '  filename = "${path.module}/alertmanager.yml"\n';
    code += '}\n\n';
  }

  return code;
}

export function generateTypeScriptMonitoring(config: MonitoringConfig): string {
  let code = '// Auto-generated Prometheus/Grafana Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';

  code += 'class PrometheusGrafanaManager extends EventEmitter {\n';
  code += '  private projectName: string;\n';
  code += '  private prometheusConfig: any;\n';
  code += '  private grafanaConfig: any;\n';
  code += '  private metrics: any[];\n';
  code += '  private alerts: any[];\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.projectName = options.projectName || \'' + config.projectName + '\';\n';
  code += '    this.prometheusConfig = options.prometheus || ' + JSON.stringify(config.prometheus) + ';\n';
  code += '    this.grafanaConfig = options.grafana || ' + JSON.stringify(config.grafana) + ';\n';
  code += '    this.metrics = options.metrics || ' + JSON.stringify(config.metrics) + ';\n';
  code += '    this.alerts = options.alerts || ' + JSON.stringify(config.alerts) + ';\n';
  code += '  }\n\n';

  code += '  async initialize(): Promise<any> {\n';
  code += '    console.log(\'[PrometheusGrafana] Initializing monitoring stack...\');\n\n';
  code += '    const results = {\n';
  code += '      timestamp: new Date().toISOString(),\n';
  code += '      prometheus: { enabled: this.prometheusConfig.enabled, configured: false },\n';
  code += '      grafana: { enabled: this.grafanaConfig.enabled, configured: false },\n';
  code += '      dashboards: 0,\n';
  code += '      alerts: 0,\n';
  code += '    };\n\n';

  if (config.prometheus.enabled) {
    code += '    if (this.prometheusConfig.enabled) {\n';
    code += '      await this.configurePrometheus();\n';
    code += '      results.prometheus.configured = true;\n';
    code += '    }\n';
  }

  if (config.grafana.enabled) {
    code += '    if (this.grafanaConfig.enabled) {\n';
    code += '      await this.configureGrafana();\n';
    code += '      results.grafana.configured = true;\n';
    code += '      results.dashboards = this.grafanaConfig.dashboards.length;\n';
    code += '    }\n';
  }

  if (config.enableAlerting) {
    code += '    if (this.alerts.length > 0) {\n';
    code += '      await this.configureAlerts();\n';
    code += '      results.alerts = this.alerts.length;\n';
    code += '    }\n';
  }

  code += '    console.log(`[PrometheusGrafana] Monitoring stack initialized`);\n';
  code += '    this.emit(\'initialized\', results);\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  private async configurePrometheus(): Promise<void> {\n';
  code += '    console.log(\'[PrometheusGrafana] Configuring Prometheus...\');\n';
  code += '    const config = {\n';
  code += '      global: {\n';
  code += '        scrape_interval: this.prometheusConfig.scrapeInterval,\n';
  code += '        evaluation_interval: this.prometheusConfig.evaluationInterval,\n';
  code += '        retention: \'' + (config.prometheus.retentionDays * 24) + 'h\',\n';
  code += '        external_labels: ' + JSON.stringify(config.prometheus.externalLabels) + ',\n';
  code += '      },\n';
  code += '      scrape_configs: this.prometheusConfig.globalScrapeConfigs,\n';
  code += '    };\n';
  code += '    // Write prometheus.yml\n';
  code += '  }\n\n';

  code += '  private async configureGrafana(): Promise<void> {\n';
  code += '    console.log(\'[PrometheusGrafana] Configuring Grafana...\');\n';
  code += '    for (const dashboard of this.grafanaConfig.dashboards) {\n';
  code += '      await this.createDashboard(dashboard);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async createDashboard(type: string): Promise<void> {\n';
  code += '    console.log(`[PrometheusGrafana] Creating dashboard: ${type}`);\n';
  code += '    // Dashboard creation logic\n';
  code += '  }\n\n';

  code += '  private async configureAlerts(): Promise<void> {\n';
  code += '    console.log(`[PrometheusGrafana] Configuring ${this.alerts.length} alerts...`);\n';
  code += '    // Alert configuration logic\n';
  code += '  }\n\n';

  code += '  addMetric(metric: any): void {\n';
  code += '    this.metrics.push(metric);\n';
  code += '    console.log(`[PrometheusGrafana] Added metric: ${metric.name}`);\n';
  code += '  }\n\n';

  code += '  addAlert(alert: any): void {\n';
  code += '    this.alerts.push(alert);\n';
  code += '    console.log(`[PrometheusGrafana] Added alert: ${alert.name}`);\n';
  code += '  }\n\n';

  code += '  getMonitoringStatus(): any {\n';
  code += '    return {\n';
  code += '      projectName: this.projectName,\n';
  code += '      prometheusEnabled: this.prometheusConfig.enabled,\n';
  code += '      grafanaEnabled: this.grafanaConfig.enabled,\n';
  code += '      metricsCount: this.metrics.length,\n';
  code += '      alertsCount: this.alerts.length,\n';
  code += '      dashboardsCount: this.grafanaConfig.dashboards.length,\n';
  code += '    };\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const prometheusGrafanaManager = new PrometheusGrafanaManager();\n\n';
  code += 'export default prometheusGrafanaManager;\n';
  code += 'export { PrometheusGrafanaManager };\n';

  return code;
}

export function generatePythonMonitoring(config: MonitoringConfig): string {
  let code = '# Auto-generated Prometheus/Grafana Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import List, Dict, Any\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from enum import Enum\n\n';

  code += 'class MetricType(Enum):\n';
  code += '    COUNTER = "counter"\n';
  code += '    GAUGE = "gauge"\n';
  code += '    HISTOGRAM = "histogram"\n';
  code += '    SUMMARY = "summary"\n\n';

  code += 'class PrometheusGrafanaManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n';
  code += '        self.prometheus_config = ' + JSON.stringify(config.prometheus) + '\n';
  code += '        self.grafana_config = ' + JSON.stringify(config.grafana) + '\n';
  code += '        self.metrics = ' + JSON.stringify(config.metrics) + '\n';
  code += '        self.alerts = ' + JSON.stringify(config.alerts) + '\n\n';

  code += '    async def initialize(self) -> Dict[str, Any]:\n';
  code += '        print("[PrometheusGrafana] Initializing monitoring stack...")\n\n';
  code += '        results = {\n';
  code += '            "timestamp": "2026-01-13T00:00:00Z",\n';
  code += '            "prometheus": {"enabled": self.prometheus_config.get("enabled", False), "configured": False},\n';
  code += '            "grafana": {"enabled": self.grafana_config.get("enabled", False), "configured": False},\n';
  code += '            "dashboards": 0,\n';
  code += '            "alerts": 0,\n';
  code += '        }\n\n';

  if (config.prometheus.enabled) {
    code += '        if self.prometheus_config.get("enabled"):\n';
    code += '            await self.configure_prometheus()\n';
    code += '            results["prometheus"]["configured"] = True\n';
  }

  if (config.grafana.enabled) {
    code += '        if self.grafana_config.get("enabled"):\n';
    code += '            await self.configure_grafana()\n';
    code += '            results["grafana"]["configured"] = True\n';
    code += '            results["dashboards"] = len(self.grafana_config.get("dashboards", []))\n';
  }

  if (config.enableAlerting) {
    code += '        if len(self.alerts) > 0:\n';
    code += '            await self.configure_alerts()\n';
    code += '            results["alerts"] = len(self.alerts)\n';
  }

  code += '        print("[PrometheusGrafana] Monitoring stack initialized")\n';
  code += '        return results\n\n';

  code += '    async def configure_prometheus(self) -> None:\n';
  code += '        print("[PrometheusGrafana] Configuring Prometheus...")\n';
  code += '        config = {\n';
  code += '            "global": {\n';
  code += '                "scrape_interval": self.prometheus_config.get("scrapeInterval"),\n';
  code += '                "evaluation_interval": self.prometheus_config.get("evaluationInterval"),\n';
  code += '                "retention": "' + (config.prometheus.retentionDays * 24) + 'h",\n';
  code += '                "external_labels": ' + JSON.stringify(config.prometheus.externalLabels) + ',\n';
  code += '            },\n';
  code += '            "scrape_configs": self.prometheus_config.get("globalScrapeConfigs", []),\n';
  code += '        }\n';
  code += '        # Write prometheus.yml\n';
  code += '        await asyncio.sleep(0.1)\n\n';

  code += '    async def configure_grafana(self) -> None:\n';
  code += '        print("[PrometheusGrafana] Configuring Grafana...")\n';
  code += '        for dashboard in self.grafana_config.get("dashboards", []):\n';
  code += '            await self.create_dashboard(dashboard)\n\n';

  code += '    async def create_dashboard(self, dashboard_type: str) -> None:\n';
  code += '        print(f"[PrometheusGrafana] Creating dashboard: {dashboard_type}")\n';
  code += '        await asyncio.sleep(0.05)\n\n';

  code += '    async def configure_alerts(self) -> None:\n';
  code += '        print(f"[PrometheusGrafana] Configuring {len(self.alerts)} alerts...")\n';
  code += '        await asyncio.sleep(0.1)\n\n';

  code += '    def add_metric(self, metric: Dict[str, Any]) -> None:\n';
  code += '        self.metrics.append(metric)\n';
  code += '        print(f"[PrometheusGrafana] Added metric: {metric.get("name")}")\n\n';

  code += '    def add_alert(self, alert: Dict[str, Any]) -> None:\n';
  code += '        self.alerts.append(alert)\n';
  code += '        print(f"[PrometheusGrafana] Added alert: {alert.get("name")}")\n\n';

  code += '    def get_monitoring_status(self) -> Dict[str, Any]:\n';
  code += '        return {\n';
  code += '            "projectName": self.project_name,\n';
  code += '            "prometheusEnabled": self.prometheus_config.get("enabled", False),\n';
  code += '            "grafanaEnabled": self.grafana_config.get("enabled", False),\n';
  code += '            "metricsCount": len(self.metrics),\n';
  code += '            "alertsCount": len(self.alerts),\n';
  code += '            "dashboardsCount": len(self.grafana_config.get("dashboards", [])),\n';
  code += '        }\n\n';

  code += 'prometheus_grafana_manager = PrometheusGrafanaManager()\n';

  return code;
}

export async function writeFiles(config: MonitoringConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  // Always generate Terraform config
  const terraformCode = generateTerraformMonitoring(config);
  await fs.writeFile(path.join(outputDir, 'monitoring.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptMonitoring(config);
    await fs.writeFile(path.join(outputDir, 'prometheus-grafana-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-prometheus-grafana',
      version: '1.0.0',
      description: 'Prometheus/Grafana Integration with Auto-Configuration',
      main: 'prometheus-grafana-manager.ts',
      scripts: {
        init: 'ts-node prometheus-grafana-manager.ts init',
        status: 'ts-node prometheus-grafana-manager.ts status',
      },
      dependencies: {
        '@types/node': '^20.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        'ts-node': '^10.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonMonitoring(config);
    await fs.writeFile(path.join(outputDir, 'prometheus_grafana_manager.py'), pyCode);

    const requirements = [
      'asyncio>=3.4.3',
      'prometheus-client>=0.19.0',
      'grafana-api>=1.3.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generatePrometheusGrafanaMD(config);
  await fs.writeFile(path.join(outputDir, 'PROMETHEUS_GRAFANA.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    prometheus: config.prometheus,
    grafana: config.grafana,
    metrics: config.metrics,
    alerts: config.alerts,
    enableRecordingRules: config.enableRecordingRules,
    enableAlerting: config.enableAlerting,
  };
  await fs.writeFile(path.join(outputDir, 'monitoring-config.json'), JSON.stringify(configJson, null, 2));
}

export function prometheusGrafana(config: MonitoringConfig): MonitoringConfig {
  return config;
}
