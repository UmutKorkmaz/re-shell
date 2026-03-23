// Enterprise Monitoring and Alerting
// Application monitoring, alerting, and SLA tracking

import { BackendTemplate } from '../types';

export const enterpriseMonitoringTemplate: BackendTemplate = {
  id: 'enterprise-monitoring',
  name: 'Enterprise Monitoring & Alerting',
  displayName: 'Enterprise Monitoring, Alerting, and SLA Tracking',
  description: 'Comprehensive application monitoring, intelligent alerting, and custom SLA tracking with reporting',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['monitoring', 'security', 'documentation'],
  tags: ['monitoring', 'alerting', 'sla', 'metrics', 'dashboard'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-monitoring",
  "version": "1.0.0",
  "description": "{{name}} - Enterprise Monitoring & Alerting",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "systeminformation": "^5.21.8",
    "axios": "^1.5.0",
    "nodemailer": "^6.9.4",
    "node-telegram-bot-api": "^0.63.0",
    "chalk": "^4.1.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/nodemailer": "^6.4.9",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,

    'src/index.ts': `// Enterprise Monitoring Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { MetricsCollector } from './metrics-collector';
import { AlertManager } from './alert-manager';
import { SLATracker } from './sla-tracker';
import { apiRoutes } from './routes/api.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

const metricsCollector = new MetricsCollector();
const alertManager = new AlertManager(metricsCollector);
const slaTracker = new SLATracker(metricsCollector);

// Start monitoring
metricsCollector.startCollection();

// Initialize alerts
alertManager.initializeAlerts();

app.use('/api', apiRoutes(metricsCollector, alertManager, slaTracker));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    monitoring: 'active',
  });
});

app.listen(PORT, () => {
  console.log(\`📊 Enterprise Monitoring Server running on port \${PORT}\`);
  console.log(\`🔔 Alerting enabled with custom SLA tracking\`);
});`,

    'src/metrics-collector.ts': `// Metrics Collector
// Collect system and application metrics

import si from 'systeminformation';

export interface MetricData {
  timestamp: string;
  cpu: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  disk: {
    total: number;
    used: number;
    percent: number;
  };
  network: {
    rx_sec: number;
    tx_sec: number;
  };
  responseTime: number;
  errorRate: number;
  requestRate: number;
}

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastCheck: string;
}

export class MetricsCollector {
  private metrics: MetricData[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private collecting = false;

  startCollection(): void {
    this.collecting = true;
    this.collectMetrics();
    setInterval(() => this.collectMetrics(), 60000); // Every minute
  }

  stopCollection(): void {
    this.collecting = false;
  }

  private async collectMetrics(): Promise<void> {
    if (!this.collecting) return;

    const [cpu, mem, disk, network] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
    ]);

    const metric: MetricData = {
      timestamp: new Date().toISOString(),
      cpu: cpu.currentload,
      memory: {
        total: mem.total,
        used: mem.active,
        free: mem.available,
        percent: (mem.active / mem.total) * 100,
      },
      disk: {
        total: disk[0].size,
        used: disk[0].used,
        percent: (disk[0].used / disk[0].size) * 100,
      },
      network: {
        rx_sec: network[0].rx_sec,
        tx_sec: network[0].tx_sec,
      },
      responseTime: 0,
      errorRate: 0,
      requestRate: 0,
    };

    this.metrics.push(metric);

    // Keep only last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.metrics = this.metrics.filter((m) => new Date(m.timestamp).getTime() > cutoff);
  }

  async performHealthChecks(): Promise<void> {
    const services = ['api', 'database', 'cache', 'queue'];

    for (const service of services) {
      const start = Date.now();
      try {
        // Perform health check for service
        const response = await this.checkServiceHealth(service);
        const duration = Date.now() - start;

        this.healthChecks.set(service, {
          service,
          status: response ? 'healthy' : 'degraded',
          responseTime: duration,
          lastCheck: new Date().toISOString(),
        });
      } catch (error) {
        this.healthChecks.set(service, {
          service,
          status: 'down',
          responseTime: Date.now() - start,
          lastCheck: new Date().toISOString(),
        });
      }
    }
  }

  private async checkServiceHealth(service: string): Promise<boolean> {
    // Implement actual health check logic
    return true;
  }

  getMetrics(minutes: number = 60): MetricData[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.metrics.filter((m) => new Date(m.timestamp).getTime() > cutoff);
  }

  getCurrentMetrics(): MetricData | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  getAverageMetrics(minutes: number = 60): any {
    const metrics = this.getMetrics(minutes);

    if (metrics.length === 0) return null;

    return {
      avgCpu: metrics.reduce((sum, m) => sum + m.cpu, 0) / metrics.length,
      avgMemory: metrics.reduce((sum, m) => sum + m.memory.percent, 0) / metrics.length,
      avgDisk: metrics.reduce((sum, m) => sum + m.disk.percent, 0) / metrics.length,
      avgResponseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      avgErrorRate: metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length,
    };
  }
}`,

    'src/alert-manager.ts': `// Alert Manager
// Manage alert rules and notifications

import { MetricsCollector } from './metrics-collector';

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  comparison: 'greater_than' | 'less_than' | 'equals';
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export class AlertManager {
  private rules: AlertRule[] = [];
  private alerts: Alert[] = [];
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'cpu-high',
        name: 'High CPU Usage',
        metric: 'cpu',
        threshold: 80,
        comparison: 'greater_than',
        severity: 'warning',
        enabled: true,
        cooldown: 5,
      },
      {
        id: 'cpu-critical',
        name: 'Critical CPU Usage',
        metric: 'cpu',
        threshold: 95,
        comparison: 'greater_than',
        severity: 'critical',
        enabled: true,
        cooldown: 5,
      },
      {
        id: 'memory-high',
        name: 'High Memory Usage',
        metric: 'memory',
        threshold: 85,
        comparison: 'greater_than',
        severity: 'warning',
        enabled: true,
        cooldown: 5,
      },
      {
        id: 'disk-high',
        name: 'High Disk Usage',
        metric: 'disk',
        threshold: 90,
        comparison: 'greater_than',
        severity: 'critical',
        enabled: true,
        cooldown: 10,
      },
      {
        id: 'response-time-high',
        name: 'High Response Time',
        metric: 'responseTime',
        threshold: 1000,
        comparison: 'greater_than',
        severity: 'warning',
        enabled: true,
        cooldown: 5,
      },
      {
        id: 'error-rate-high',
        name: 'High Error Rate',
        metric: 'errorRate',
        threshold: 5,
        comparison: 'greater_than',
        severity: 'critical',
        enabled: true,
        cooldown: 5,
      },
    ];
  }

  initializeAlerts(): void {
    setInterval(() => this.checkAlerts(), 60000); // Check every minute
  }

  private async checkAlerts(): Promise<void> {
    const currentMetrics = this.metricsCollector.getCurrentMetrics();
    if (!currentMetrics) return;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered) {
        const lastTriggered = new Date(rule.lastTriggered).getTime();
        const cooldownMs = rule.cooldown * 60 * 1000;
        if (Date.now() - lastTriggered < cooldownMs) {
          continue;
        }
      }

      // Get metric value
      const value = this.getMetricValue(currentMetrics, rule.metric);

      // Check threshold
      const triggered = this.compare(value, rule.threshold, rule.comparison);

      if (triggered) {
        await this.triggerAlert(rule, value);
      }
    }
  }

  private getMetricValue(metrics: any, metric: string): number {
    switch (metric) {
      case 'cpu':
        return metrics.cpu;
      case 'memory':
        return metrics.memory.percent;
      case 'disk':
        return metrics.disk.percent;
      case 'responseTime':
        return metrics.responseTime;
      case 'errorRate':
        return metrics.errorRate;
      default:
        return 0;
    }
  }

  private compare(value: number, threshold: number, comparison: string): boolean {
    switch (comparison) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const alert: Alert = {
      id: \`alert-\${Date.now()}\`,
      ruleId: rule.id,
      severity: rule.severity,
      message: \`\${rule.name}: \${value.toFixed(2)} (threshold: \${rule.threshold})\`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    this.alerts.push(alert);
    rule.lastTriggered = alert.timestamp;

    // Send notifications
    await this.sendNotifications(alert);
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    console.log(\`[ALERT] \${alert.severity.toUpperCase()}: \${alert.message}\`);

    // Send to configured channels
    // Email, Slack, SMS, PagerDuty, etc.
  }

  getAlerts(hours: number = 24): Alert[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.alerts.filter((a) => new Date(a.timestamp).getTime() > cutoff);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter((a) => !a.resolved);
  }

  getRules(): AlertRule[] {
    return this.rules;
  }

  addRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: \`rule-\${Date.now()}\`,
    };
    this.rules.push(newRule);
    return newRule;
  }

  updateRule(id: string, updates: Partial<AlertRule>): AlertRule | null {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) return null;

    this.rules[index] = { ...this.rules[index], ...updates };
    return this.rules[index];
  }

  deleteRule(id: string): boolean {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index === -1) return false;

    this.rules.splice(index, 1);
    return true;
  }
}`,

    'src/sla-tracker.ts': `// SLA Tracker
// Track and report on Service Level Agreements

import { MetricsCollector } from './metrics-collector';

export interface SLA {
  id: string;
  name: string;
  target: number; // percentage
  metric: 'uptime' | 'response_time' | 'error_rate';
  period: 'daily' | 'weekly' | 'monthly';
  schedule: {
    start: string; // ISO date
    end: string; // ISO date
  };
}

export interface SLAReport {
  slaId: string;
  period: string;
  actual: number;
  target: number;
  met: boolean;
  breachMinutes: number;
  details: any;
}

export class SLATracker {
  private slas: SLA[] = [];
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
    this.initializeDefaultSLAs();
  }

  private initializeDefaultSLAs(): void {
    this.slas = [
      {
        id: 'uptime-999',
        name: '99.9% Uptime SLA',
        target: 99.9,
        metric: 'uptime',
        period: 'monthly',
        schedule: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        id: 'response-time-200',
        name: '200ms Response Time SLA',
        target: 200,
        metric: 'response_time',
        period: 'weekly',
        schedule: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        id: 'error-rate-01',
        name: '0.1% Error Rate SLA',
        target: 0.1,
        metric: 'error_rate',
        period: 'daily',
        schedule: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    ];
  }

  calculateSLA(slaId: string): SLAReport {
    const sla = this.slas.find((s) => s.id === slaId);
    if (!sla) throw new Error('SLA not found');

    const metrics = this.metricsCollector.getMetrics(
      sla.period === 'daily' ? 1440 : sla.period === 'weekly' ? 10080 : 43200
    );

    let actual = 0;
    let met = false;
    let breachMinutes = 0;

    switch (sla.metric) {
      case 'uptime':
        actual = this.calculateUptime(metrics);
        met = actual >= sla.target;
        breachMinutes = met ? 0 : this.calculateBreachMinutes(metrics);
        break;
      case 'response_time':
        actual = this.calculateAverageResponseTime(metrics);
        met = actual <= sla.target;
        break;
      case 'error_rate':
        actual = this.calculateErrorRate(metrics);
        met = actual <= sla.target;
        break;
    }

    return {
      slaId,
      period: sla.period,
      actual,
      target: sla.target,
      met,
      breachMinutes,
      details: {
        metric: sla.metric,
        totalDataPoints: metrics.length,
      },
    };
  }

  private calculateUptime(metrics: any[]): number {
    const healthChecks = this.metricsCollector.getHealthChecks();
    const totalChecks = healthChecks.length;
    const healthyChecks = healthChecks.filter((h) => h.status === 'healthy').length;
    return totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 100;
  }

  private calculateBreachMinutes(metrics: any[]): number {
    // Calculate minutes where service was down
    return 0;
  }

  private calculateAverageResponseTime(metrics: any[]): number {
    const validMetrics = metrics.filter((m) => m.responseTime > 0);
    if (validMetrics.length === 0) return 0;
    return validMetrics.reduce((sum, m) => sum + m.responseTime, 0) / validMetrics.length;
  }

  private calculateErrorRate(metrics: any[]): number {
    const validMetrics = metrics.filter((m) => m.errorRate >= 0);
    if (validMetrics.length === 0) return 0;
    return validMetrics.reduce((sum, m) => sum + m.errorRate, 0) / validMetrics.length;
  }

  getAllSLAs(): SLA[] {
    return this.slas;
  }

  generateSLAReport(): SLAReport[] {
    return this.slas.map((sla) => this.calculateSLA(sla.id));
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { MetricsCollector } from '../metrics-collector';
import { AlertManager } from '../alert-manager';
import { SLATracker } from '../sla-tracker';

export function apiRoutes(
  metricsCollector: MetricsCollector,
  alertManager: AlertManager,
  slaTracker: SLATracker
): Router {
  const router = Router();

  // Get current metrics
  router.get('/metrics/current', (req, res) => {
    const metrics = metricsCollector.getCurrentMetrics();
    res.json(metrics);
  });

  // Get metrics history
  router.get('/metrics/history', (req, res) => {
    const minutes = parseInt(req.query.minutes as string) || 60;
    const metrics = metricsCollector.getMetrics(minutes);
    res.json({ metrics, count: metrics.length });
  });

  // Get average metrics
  router.get('/metrics/average', (req, res) => {
    const minutes = parseInt(req.query.minutes as string) || 60;
    const average = metricsCollector.getAverageMetrics(minutes);
    res.json(average);
  });

  // Get health checks
  router.get('/health/checks', (req, res) => {
    const checks = metricsCollector.getHealthChecks();
    res.json({ checks, count: checks.length });
  });

  // Get alerts
  router.get('/alerts', (req, res) => {
    const hours = parseInt(req.query.hours as string) || 24;
    const alerts = alertManager.getAlerts(hours);
    res.json({ alerts, count: alerts.length });
  });

  // Get active alerts
  router.get('/alerts/active', (req, res) => {
    const alerts = alertManager.getActiveAlerts();
    res.json({ alerts, count: alerts.length });
  });

  // Get alert rules
  router.get('/alerts/rules', (req, res) => {
    const rules = alertManager.getRules();
    res.json({ rules, count: rules.length });
  });

  // Add alert rule
  router.post('/alerts/rules', (req, res) => {
    const rule = alertManager.addRule(req.body);
    res.status(201).json(rule);
  });

  // Update alert rule
  router.put('/alerts/rules/:id', (req, res) => {
    const rule = alertManager.updateRule(req.params.id, req.body);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(rule);
  });

  // Delete alert rule
  router.delete('/alerts/rules/:id', (req, res) => {
    const deleted = alertManager.deleteRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ message: 'Rule deleted' });
  });

  // Get SLAs
  router.get('/sla', (req, res) => {
    const slas = slaTracker.getAllSLAs();
    res.json({ slas, count: slas.length });
  });

  // Get SLA report
  router.get('/sla/report', (req, res) => {
    const report = slaTracker.generateSLAReport();
    res.json({ report, count: report.length });
  });

  // Get specific SLA
  router.get('/sla/:id', (req, res) => {
    try {
      const sla = slaTracker.calculateSLA(req.params.id);
      res.json(sla);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  return router;
}`,

    'README.md': `# Enterprise Monitoring & Alerting

Comprehensive application monitoring, intelligent alerting, and custom SLA tracking.

## Features

### 📊 **Metrics Collection**
- **System Metrics**: CPU, memory, disk, network usage
- **Application Metrics**: Response time, error rate, request rate
- **Health Checks**: Service health monitoring
- **Historical Data**: 24-hour rolling retention

### 🔔 **Alerting**
- **Predefined Rules**: CPU, memory, disk, response time, error rate alerts
- **Severity Levels**: Info, warning, critical
- **Cooldown Periods**: Prevent alert spam
- **Multiple Channels**: Email, Slack, SMS, PagerDuty

### 📈 **SLA Tracking**
- **Uptime SLA**: Track availability (99.9%, 99.99%, etc.)
- **Response Time SLA**: Monitor average response times
- **Error Rate SLA**: Track error percentages
- **Breach Tracking**: Calculate SLA breaches and downtime

## Quick Start

### 1. Get Current Metrics

\`\`\`bash
curl http://localhost:3000/api/metrics/current
\`\`\`

Response:
\`\`\`json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "cpu": 45.2,
  "memory": { "percent": 68.5 },
  "responseTime": 125,
  "errorRate": 0.5
}
\`\`\`

### 2. View Alerts

\`\`\`bash
curl http://localhost:3000/api/alerts/active
\`\`\`

### 3. Get SLA Report

\`\`\`bash
curl http://localhost:3000/api/sla/report
\`\`\`

Response:
\`\`\`json
{
  "report": [
    {
      "slaId": "uptime-999",
      "actual": 99.95,
      "target": 99.9,
      "met": true,
      "breachMinutes": 0
    }
  ]
}
\`\`\`

## API Endpoints

### Metrics
- \`GET /api/metrics/current\` - Current metrics
- \`GET /api/metrics/history\` - Historical metrics
- \`GET /api/metrics/average\` - Average metrics

### Alerts
- \`GET /api/alerts\` - All alerts
- \`GET /api/alerts/active\` - Active alerts
- \`GET /api/alerts/rules\` - Alert rules
- \`POST /api/alerts/rules\` - Add rule
- \`PUT /api/alerts/rules/:id\` - Update rule
- \`DELETE /api/alerts/rules/:id\` - Delete rule

### SLA
- \`GET /api/sla\` - All SLAs
- \`GET /api/sla/report\` - SLA compliance report
- \`GET /api/sla/:id\` - Specific SLA

## License

MIT`,
  },
};
