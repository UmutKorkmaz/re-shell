/**
 * Monitoring and Alerting for Polyglot Services
 *
 * Generates monitoring and alerting utilities for detecting and responding to failures:
 * - Health checks and heartbeat monitoring
 * - Anomaly detection and alerting
 * - Root cause analysis
 * - Multi-language monitoring implementations
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type MonitorLanguage = 'typescript' | 'python' | 'go';

export interface MonitorConfig {
  serviceName: string;
  language: MonitorLanguage;
  outputDir: string;
  endpoints: MonitoredEndpoint[];
  alertThresholds: AlertThresholds;
  notificationChannels: NotificationChannel[];
}

export interface MonitoredEndpoint {
  name: string;
  path: string;
  method: string;
  expectedStatus: number;
  timeout: number;
}

export interface AlertThresholds {
  errorRate: number;
  latency: number;
  consecutiveFailures: number;
}

export interface NotificationChannel {
  type: 'slack' | 'email' | 'pagerduty' | 'webhook';
  config: Record<string, string>;
}

// TypeScript Monitoring and Alerting
export function generateTypeScriptMonitoring(config: MonitorConfig): string {
  return `// Auto-generated Monitoring and Alerting for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

interface HealthCheck {
  endpoint: string;
  healthy: boolean;
  latency: number;
  lastCheck: Date;
  consecutiveFailures: number;
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  endpoint: string;
  timestamp: Date;
  rootCause?: string;
}

interface AlertThresholds {
  errorRate: number;
  latency: number;
  consecutiveFailures: number;
}

class MonitoringService {
  private serviceName: string;
  private baseUrl: string;
  private healthChecks: Map<string, HealthCheck>;
  private alerts: Alert[];
  private thresholds: AlertThresholds;
  private intervalId?: NodeJS.Timeout;

  constructor(serviceName: string, baseUrl: string, thresholds: AlertThresholds) {
    this.serviceName = serviceName;
    this.baseUrl = baseUrl;
    this.healthChecks = new Map();
    this.alerts = [];
    this.thresholds = thresholds;
  }

  async performHealthCheck(endpoint: string, method: string = 'GET', expectedStatus: number = 200): Promise<HealthCheck> {
    const startTime = Date.now();
    let healthy = false;
    let latency = 0;

    try {
      const response = await fetch(this.baseUrl + endpoint, {
        method,
        signal: AbortSignal.timeout(5000),
      });

      latency = Date.now() - startTime;
      healthy = response.status === expectedStatus;
    } catch (error) {
      latency = Date.now() - startTime;
      healthy = false;
    }

    const existing = this.healthChecks.get(endpoint);
    const consecutiveFailures = healthy ? 0 : (existing?.consecutiveFailures || 0) + 1;

    const healthCheck: HealthCheck = {
      endpoint,
      healthy,
      latency,
      lastCheck: new Date(),
      consecutiveFailures,
    };

    this.healthChecks.set(endpoint, healthCheck);
    return healthCheck;
  }

  evaluateHealthCheck(healthCheck: HealthCheck): void {
    // Check latency threshold
    if (healthCheck.latency > this.thresholds.latency) {
      this.createAlert('warning', \`High latency detected: \${healthCheck.latency}ms\`, healthCheck.endpoint, {
        metric: 'latency',
        value: healthCheck.latency,
        threshold: this.thresholds.latency,
      });
    }

    // Check consecutive failures
    if (healthCheck.consecutiveFailures >= this.thresholds.consecutiveFailures) {
      this.createAlert('critical', \`Endpoint unhealthy for \${healthCheck.consecutiveFailures} consecutive checks\`, healthCheck.endpoint, {
        metric: 'consecutiveFailures',
        value: healthCheck.consecutiveFailures,
        threshold: this.thresholds.consecutiveFailures,
      });
    }

    if (!healthCheck.healthy) {
      this.createAlert('warning', 'Health check failed', healthCheck.endpoint, {
        metric: 'health',
        value: 'unhealthy',
        expected: 'healthy',
      });
    }
  }

  analyzeRootCause(endpoint: string): string {
    const healthCheck = this.healthChecks.get(endpoint);
    if (!healthCheck) return 'No health check data available';

    const causes: string[] = [];

    if (healthCheck.latency > this.thresholds.latency) {
      causes.push('High latency indicates possible performance bottleneck or network congestion');
    }

    if (healthCheck.consecutiveFailures > 0) {
      causes.push('Consecutive failures suggest service downtime or dependency issues');
    }

    if (!healthCheck.healthy) {
      causes.push('Unhealthy status may indicate application errors or misconfiguration');
    }

    return causes.length > 0 ? causes.join('; ') : 'No specific root cause identified';
  }

  createAlert(severity: 'info' | 'warning' | 'critical', message: string, endpoint: string, details?: any): void {
    const alert: Alert = {
      id: this.generateId(),
      severity,
      message,
      endpoint,
      timestamp: new Date(),
    };

    if (severity === 'critical') {
      alert.rootCause = this.analyzeRootCause(endpoint);
    }

    this.alerts.push(alert);
    this.logAlert(alert, details);
  }

  logAlert(alert: Alert, details?: any): void {
    const logEntry = {
      timestamp: alert.timestamp.toISOString(),
      severity: alert.severity,
      service: this.serviceName,
      message: alert.message,
      endpoint: alert.endpoint,
      ...(alert.rootCause && { rootCause: alert.rootCause }),
      ...(details && { details }),
    };

    const severityColors = {
      info: '\\x1b[36m', // cyan
      warning: '\\x1b[33m', // yellow
      critical: '\\x1b[31m', // red
    };

    const reset = '\\x1b[0m';
    const color = severityColors[alert.severity];

    console.log(\`\${color}[\${alert.severity.toUpperCase()}]\${reset} \${alert.message}\`);
    if (alert.rootCause) {
      console.log(\`  Root Cause: \${alert.rootCause}\`);
    }
  }

  sendNotification(alert: Alert, channel: string): void {
    // Placeholder for notification integration
    console.log(\`📢 Sending \${alert.severity} alert to \${channel}:\`);
    console.log(\`  Message: \${alert.message}\`);
    console.log(\`  Endpoint: \${alert.endpoint}\`);
    if (alert.rootCause) {
      console.log(\`  Root Cause: \${alert.rootCause}\`);
    }
  }

  async checkAllEndpoints(endpoints: Array<{ name: string; path: string; method: string; expectedStatus: number }>): Promise<void> {
    for (const ep of endpoints) {
      const healthCheck = await this.performHealthCheck(ep.path, ep.method, ep.expectedStatus);
      this.evaluateHealthCheck(healthCheck);
    }
  }

  startMonitoring(endpoints: Array<{ name: string; path: string; method: string; expectedStatus: number }>, intervalMs: number = 30000): void {
    console.log(\`🔍 Starting monitoring for \${this.serviceName} (interval: \${intervalMs}ms)\\n\`);

    this.intervalId = setInterval(async () => {
      await this.checkAllEndpoints(endpoints);
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('⏸️  Monitoring stopped');
    }
  }

  getHealthStatus(): Map<string, HealthCheck> {
    return this.healthChecks;
  }

  getAlerts(severity?: 'info' | 'warning' | 'critical'): Alert[] {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return this.alerts;
  }

  getErrorRate(): number {
    const total = this.healthChecks.size;
    if (total === 0) return 0;

    const unhealthy = Array.from(this.healthChecks.values()).filter(hc => !hc.healthy).length;
    return (unhealthy / total) * 100;
  }

  getAverageLatency(): number {
    const values = Array.from(this.healthChecks.values()).map(hc => hc.latency);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  generateReport(): string {
    const report = {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      healthStatus: Array.from(this.healthChecks.values()).map(hc => ({
        endpoint: hc.endpoint,
        healthy: hc.healthy,
        latency: hc.latency,
        consecutiveFailures: hc.consecutiveFailures,
      })),
      metrics: {
        errorRate: this.getErrorRate(),
        averageLatency: this.getAverageLatency(),
        totalEndpoints: this.healthChecks.size,
        unhealthyEndpoints: Array.from(this.healthChecks.values()).filter(hc => !hc.healthy).length,
      },
      recentAlerts: this.alerts.slice(-10),
    };

    return JSON.stringify(report, null, 2);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Export singleton instance
const thresholds: AlertThresholds = {
  errorRate: ${config.alertThresholds.errorRate},
  latency: ${config.alertThresholds.latency},
  consecutiveFailures: ${config.alertThresholds.consecutiveFailures},
};

const monitor = new MonitoringService('${config.serviceName}', process.env.SERVICE_URL || 'http://localhost:3000', thresholds);

export default monitor;
`;
}

// Python Monitoring and Alerting
export function generatePythonMonitoring(config: MonitorConfig): string {
  return `# Auto-generated Monitoring and Alerting for ${config.serviceName}
# Generated at: ${new Date().toISOString()}

import asyncio
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import json

@dataclass
class HealthCheck:
    endpoint: str
    healthy: bool
    latency: float
    last_check: str
    consecutive_failures: int

@dataclass
class Alert:
    id: str
    severity: str
    message: str
    endpoint: str
    timestamp: str
    root_cause: Optional[str] = None

@dataclass
class AlertThresholds:
    error_rate: float
    latency: float
    consecutive_failures: int

class MonitoringService:
    def __init__(self, service_name: str, base_url: str, thresholds: AlertThresholds):
        self.service_name = service_name
        self.base_url = base_url
        self.health_checks: Dict[str, HealthCheck] = {}
        self.alerts: List[Alert] = []
        self.thresholds = thresholds
        self.monitoring_task = None

    async def perform_health_check(self, endpoint: str, method: str = 'GET', expected_status: int = 200) -> HealthCheck:
        """Perform a health check on an endpoint"""
        import aiohttp

        start_time = time.time()
        healthy = False
        latency = 0

        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(method, self.base_url + endpoint, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    latency = (time.time() - start_time) * 1000
                    healthy = response.status == expected_status
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            healthy = False

        existing = self.health_checks.get(endpoint)
        consecutive_failures = 0 if healthy else (existing.consecutive_failures + 1 if existing else 1)

        health_check = HealthCheck(
            endpoint=endpoint,
            healthy=healthy,
            latency=latency,
            last_check=datetime.now().isoformat(),
            consecutive_failures=consecutive_failures
        )

        self.health_checks[endpoint] = health_check
        return health_check

    def evaluate_health_check(self, health_check: HealthCheck):
        """Evaluate health check and create alerts if needed"""
        # Check latency threshold
        if health_check.latency > self.thresholds.latency:
            self.create_alert('warning', f'High latency detected: {health_check.latency}ms', health_check.endpoint, {
                'metric': 'latency',
                'value': health_check.latency,
                'threshold': self.thresholds.latency
            })

        # Check consecutive failures
        if health_check.consecutive_failures >= self.thresholds.consecutive_failures:
            self.create_alert('critical', f'Endpoint unhealthy for {health_check.consecutive_failures} consecutive checks', health_check.endpoint, {
                'metric': 'consecutiveFailures',
                'value': health_check.consecutive_failures,
                'threshold': self.thresholds.consecutive_failures
            })

        if not health_check.healthy:
            self.create_alert('warning', 'Health check failed', health_check.endpoint, {
                'metric': 'health',
                'value': 'unhealthy',
                'expected': 'healthy'
            })

    def analyze_root_cause(self, endpoint: str) -> str:
        """Analyze root cause of failures"""
        health_check = self.health_checks.get(endpoint)
        if not health_check:
            return 'No health check data available'

        causes = []

        if health_check.latency > self.thresholds.latency:
            causes.append('High latency indicates possible performance bottleneck or network congestion')

        if health_check.consecutive_failures > 0:
            causes.append('Consecutive failures suggest service downtime or dependency issues')

        if not health_check.healthy:
            causes.append('Unhealthy status may indicate application errors or misconfiguration')

        return '; '.join(causes) if causes else 'No specific root cause identified'

    def create_alert(self, severity: str, message: str, endpoint: str, details: Optional[Dict] = None):
        """Create and log an alert"""
        alert = Alert(
            id=str(uuid.uuid4()),
            severity=severity,
            message=message,
            endpoint=endpoint,
            timestamp=datetime.now().isoformat()
        )

        if severity == 'critical':
            alert.root_cause = self.analyze_root_cause(endpoint)

        self.alerts.append(alert)
        self.log_alert(alert, details)

    def log_alert(self, alert: Alert, details: Optional[Dict] = None):
        """Log an alert to console"""
        log_entry = {
            'timestamp': alert.timestamp,
            'severity': alert.severity,
            'service': self.service_name,
            'message': alert.message,
            'endpoint': alert.endpoint
        }

        if alert.root_cause:
            log_entry['root_cause'] = alert.root_cause

        if details:
            log_entry['details'] = details

        severity_emoji = {
            'info': 'ℹ️',
            'warning': '⚠️',
            'critical': '🚨'
        }

        emoji = severity_emoji.get(alert.severity, 'ℹ️')
        print(f"{emoji} [{alert.severity.upper()}] {alert.message}")
        if alert.root_cause:
            print(f"  Root Cause: {alert.root_cause}")

    def send_notification(self, alert: Alert, channel: str):
        """Send notification (placeholder)"""
        print(f"📢 Sending {alert.severity} alert to {channel}:")
        print(f"  Message: {alert.message}")
        print(f"  Endpoint: {alert.endpoint}")
        if alert.root_cause:
            print(f"  Root Cause: {alert.root_cause}")

    async def check_all_endpoints(self, endpoints: List[Dict]):
        """Check all monitored endpoints"""
        for ep in endpoints:
            health_check = await self.perform_health_check(
                ep['path'],
                ep.get('method', 'GET'),
                ep.get('expectedStatus', 200)
            )
            self.evaluate_health_check(health_check)

    async def start_monitoring(self, endpoints: List[Dict], interval_seconds: int = 30):
        """Start continuous monitoring"""
        print(f"🔍 Starting monitoring for {self.service_name} (interval: {interval_seconds}s)\\n")

        while True:
            await self.check_all_endpoints(endpoints)
            await asyncio.sleep(interval_seconds)

    def stop_monitoring(self):
        """Stop monitoring (placeholder for cleanup)"""
        print("⏸️  Monitoring stopped")

    def get_health_status(self) -> Dict[str, HealthCheck]:
        """Get current health status of all endpoints"""
        return self.health_checks

    def get_alerts(self, severity: Optional[str] = None) -> List[Alert]:
        """Get alerts, optionally filtered by severity"""
        if severity:
            return [a for a in self.alerts if a.severity == severity]
        return self.alerts

    def get_error_rate(self) -> float:
        """Calculate error rate"""
        if not self.health_checks:
            return 0.0

        unhealthy = sum(1 for hc in self.health_checks.values() if not hc.healthy)
        return (unhealthy / len(self.health_checks)) * 100

    def get_average_latency(self) -> float:
        """Calculate average latency"""
        if not self.health_checks:
            return 0.0

        latencies = [hc.latency for hc in self.health_checks.values()]
        return sum(latencies) / len(latencies)

    def generate_report(self) -> str:
        """Generate monitoring report"""
        report = {
            'service': self.service_name,
            'timestamp': datetime.now().isoformat(),
            'health_status': [asdict(hc) for hc in self.health_checks.values()],
            'metrics': {
                'error_rate': self.get_error_rate(),
                'average_latency': self.get_average_latency(),
                'total_endpoints': len(self.health_checks),
                'unhealthy_endpoints': sum(1 for hc in self.health_checks.values() if not hc.healthy)
            },
            'recent_alerts': [asdict(a) for a in self.alerts[-10:]]
        }

        return json.dumps(report, indent=2)


# Singleton instance
thresholds = AlertThresholds(
    error_rate=${config.alertThresholds.errorRate},
    latency=${config.alertThresholds.latency},
    consecutive_failures=${config.alertThresholds.consecutiveFailures}
)

monitor = MonitoringService('${config.serviceName}', 'http://localhost:3000', thresholds)
`;
}

// Go Monitoring and Alerting
export function generateGoMonitoring(config: MonitorConfig): string {
  return `// Auto-generated Monitoring and Alerting for ${config.serviceName}
// Generated at: ${new Date().toISOString()}

package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"
)

type HealthCheck struct {
	Endpoint            string  \`json:"endpoint"\`
	Healthy             bool    \`json:"healthy"\`
	Latency             float64 \`json:"latency"\`
	LastCheck           string  \`json:"lastCheck"\`
	ConsecutiveFailures int     \`json:"consecutiveFailures"\`
}

type Alert struct {
	ID        string \`json:"id"\`
	Severity  string \`json:"severity"\`
	Message   string \`json:"message"\`
	Endpoint  string \`json:"endpoint"\`
	Timestamp string \`json:"timestamp"\`
	RootCause string \`json:"rootCause,omitempty"\`
}

type AlertThresholds struct {
	ErrorRate           float64 \`json:"errorRate"\`
	Latency             float64 \`json:"latency"\`
	ConsecutiveFailures int     \`json:"consecutiveFailures"\`
}

type MonitoringService struct {
	serviceName  string
	baseURL      string
	healthChecks map[string]HealthCheck
	alerts       []Alert
	thresholds   AlertThresholds
	mu           sync.RWMutex
}

func NewMonitoringService(serviceName, baseURL string, thresholds AlertThresholds) *MonitoringService {
	return &MonitoringService{
		serviceName:  serviceName,
		baseURL:      baseURL,
		healthChecks: make(map[string]HealthCheck),
		alerts:       make([]Alert, 0),
		thresholds:   thresholds,
	}
}

func (ms *MonitoringService) PerformHealthCheck(endpoint, method string, expectedStatus int) HealthCheck {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	startTime := time.Now()
	healthy := false
	latency := 0.0

	client := &http.Client{Timeout: 5 * time.Second}
	req, _ := http.NewRequest(method, ms.baseURL+endpoint, nil)

	resp, err := client.Do(req)
	if err == nil {
		latency = float64(time.Since(startTime).Microseconds()) / 1000.0
		healthy = resp.StatusCode == expectedStatus
		resp.Body.Close()
	} else {
		latency = float64(time.Since(startTime).Microseconds()) / 1000.0
	}

	existing, exists := ms.healthChecks[endpoint]
	consecutiveFailures := 0
	if healthy {
		consecutiveFailures = 0
	} else if exists {
		consecutiveFailures = existing.ConsecutiveFailures + 1
	} else {
		consecutiveFailures = 1
	}

	healthCheck := HealthCheck{
		Endpoint:            endpoint,
		Healthy:             healthy,
		Latency:             latency,
		LastCheck:           time.Now().Format(time.RFC3339),
		ConsecutiveFailures: consecutiveFailures,
	}

	ms.healthChecks[endpoint] = healthCheck
	return healthCheck
}

func (ms *MonitoringService) EvaluateHealthCheck(healthCheck HealthCheck) {
	// Check latency threshold
	if healthCheck.Latency > ms.thresholds.Latency {
		details := map[string]interface{}{
			"metric":    "latency",
			"value":     healthCheck.Latency,
			"threshold": ms.thresholds.Latency,
		}
		ms.CreateAlert("warning", fmt.Sprintf("High latency detected: %.2fms", healthCheck.Latency), healthCheck.Endpoint, details)
	}

	// Check consecutive failures
	if healthCheck.ConsecutiveFailures >= ms.thresholds.ConsecutiveFailures {
		details := map[string]interface{}{
			"metric":    "consecutiveFailures",
			"value":     healthCheck.ConsecutiveFailures,
			"threshold": ms.thresholds.ConsecutiveFailures,
		}
		ms.CreateAlert("critical", fmt.Sprintf("Endpoint unhealthy for %d consecutive checks", healthCheck.ConsecutiveFailures), healthCheck.Endpoint, details)
	}

	if !healthCheck.Healthy {
		details := map[string]interface{}{
			"metric":  "health",
			"value":   "unhealthy",
			"expected": "healthy",
		}
		ms.CreateAlert("warning", "Health check failed", healthCheck.Endpoint, details)
	}
}

func (ms *MonitoringService) AnalyzeRootCause(endpoint string) string {
	ms.mu.RLock()
	healthCheck, exists := ms.healthChecks[endpoint]
	ms.mu.RUnlock()

	if !exists {
		return "No health check data available"
	}

	var causes []string

	if healthCheck.Latency > ms.thresholds.Latency {
		causes = append(causes, "High latency indicates possible performance bottleneck or network congestion")
	}

	if healthCheck.ConsecutiveFailures > 0 {
		causes = append(causes, "Consecutive failures suggest service downtime or dependency issues")
	}

	if !healthCheck.Healthy {
		causes = append(causes, "Unhealthy status may indicate application errors or misconfiguration")
	}

	if len(causes) == 0 {
		return "No specific root cause identified"
	}

	// Join causes with "; "
	result := causes[0]
	for i := 1; i < len(causes); i++ {
		result += "; " + causes[i]
	}
	return result
}

func (ms *MonitoringService) CreateAlert(severity, message, endpoint string, details map[string]interface{}) {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	alert := Alert{
		ID:        ms.generateID(),
		Severity:  severity,
		Message:   message,
		Endpoint:  endpoint,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	if severity == "critical" {
		alert.RootCause = ms.AnalyzeRootCause(endpoint)
	}

	ms.alerts = append(ms.alerts, alert)
	ms.logAlert(alert, details)
}

func (ms *MonitoringService) logAlert(alert Alert, details map[string]interface{}) {
	severityEmoji := map[string]string{
		"info":     "ℹ️",
		"warning":  "⚠️",
		"critical": "🚨",
	}

	emoji := severityEmoji[alert.Severity]
	fmt.Printf("%s [%s] %s\\n", emoji, alert.Severity, alert.Message)
	if alert.RootCause != "" {
		fmt.Printf("  Root Cause: %s\\n", alert.RootCause)
	}
}

func (ms *MonitoringService) SendNotification(alert Alert, channel string) {
	fmt.Printf("📢 Sending %s alert to %s:\\n", alert.Severity, channel)
	fmt.Printf("  Message: %s\\n", alert.Message)
	fmt.Printf("  Endpoint: %s\\n", alert.Endpoint)
	if alert.RootCause != "" {
		fmt.Printf("  Root Cause: %s\\n", alert.RootCause)
	}
}

func (ms *MonitoringService) GetHealthStatus() map[string]HealthCheck {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	// Return copy
	result := make(map[string]HealthCheck)
	for k, v := range ms.healthChecks {
		result[k] = v
	}
	return result
}

func (ms *MonitoringService) GetAlerts(severity string) []Alert {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	if severity == "" {
		return ms.alerts
	}

	var filtered []Alert
	for _, alert := range ms.alerts {
		if alert.Severity == severity {
			filtered = append(filtered, alert)
		}
	}
	return filtered
}

func (ms *MonitoringService) GetErrorRate() float64 {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	if len(ms.healthChecks) == 0 {
		return 0.0
	}

	unhealthy := 0
	for _, hc := range ms.healthChecks {
		if !hc.Healthy {
			unhealthy++
		}
	}

	return (float64(unhealthy) / float64(len(ms.healthChecks))) * 100.0
}

func (ms *MonitoringService) GetAverageLatency() float64 {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	if len(ms.healthChecks) == 0 {
		return 0.0
	}

	sum := 0.0
	for _, hc := range ms.healthChecks {
		sum += hc.Latency
	}

	return sum / float64(len(ms.healthChecks))
}

func (ms *MonitoringService) GenerateReport() string {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	healthStatus := make([]HealthCheck, 0, len(ms.healthChecks))
	for _, hc := range ms.healthChecks {
		healthStatus = append(healthStatus, hc)
	}

	unhealthy := 0
	for _, hc := range ms.healthChecks {
		if !hc.Healthy {
			unhealthy++
		}
	}

	recentAlerts := ms.alerts
	if len(recentAlerts) > 10 {
		recentAlerts = recentAlerts[len(recentAlerts)-10:]
	}

	report := map[string]interface{}{
		"service":   ms.serviceName,
		"timestamp": time.Now().Format(time.RFC3339),
		"healthStatus": healthStatus,
		"metrics": map[string]interface{}{
			"errorRate":         ms.GetErrorRate(),
			"averageLatency":    ms.GetAverageLatency(),
			"totalEndpoints":    len(ms.healthChecks),
			"unhealthyEndpoints": unhealthy,
		},
		"recentAlerts": recentAlerts,
	}

	jsonData, _ := json.MarshalIndent(report, "", "  ")
	return string(jsonData)
}

func (ms *MonitoringService) generateID() string {
	return fmt.Sprintf("%d", rand.Int63())
}

// Global instance
var thresholds = AlertThresholds{
	ErrorRate:           ${config.alertThresholds.errorRate},
	Latency:             ${config.alertThresholds.latency},
	ConsecutiveFailures: ${config.alertThresholds.consecutiveFailures},
}

var monitor = NewMonitoringService("${config.serviceName}", "http://localhost:3000", thresholds)
`;
}

// Display configuration
export function displayConfig(config: MonitorConfig): void {
  console.log(chalk.cyan('\n✨ Monitoring and Alerting Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Service Name:'), chalk.white(config.serviceName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Monitored Endpoints:'), chalk.white(config.endpoints.length));
  console.log(chalk.yellow('Alert Thresholds:'));
  console.log(chalk.gray('  - Error Rate:'), chalk.white(config.alertThresholds.errorRate + '%'));
  console.log(chalk.gray('  - Latency:'), chalk.white(config.alertThresholds.latency + 'ms'));
  console.log(chalk.gray('  - Consecutive Failures:'), chalk.white(config.alertThresholds.consecutiveFailures));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Monitored Endpoints:\n'));

  config.endpoints.slice(0, 5).forEach((ep, index) => {
    console.log('  ' + chalk.green((index + 1).toString() + '.') + ' ' + chalk.white(ep.name));
    console.log('     ' + chalk.gray(ep.method + ' ' + ep.path + ' (expected: ' + ep.expectedStatus + ')'));
  });

  if (config.endpoints.length > 5) {
    console.log('  ' + chalk.gray('... and ' + (config.endpoints.length - 5) + ' more'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: MonitorConfig): string {
  let content = '# Monitoring and Alerting for ' + config.serviceName + '\n\n';
  content += 'Monitoring and alerting utilities for **' + config.serviceName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Service**: ' + config.serviceName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Monitored Endpoints**: ' + config.endpoints.length + '\n';
  content += '- **Error Rate Threshold**: ' + config.alertThresholds.errorRate + '%\n';
  content += '- **Latency Threshold**: ' + config.alertThresholds.latency + 'ms\n';
  content += '- **Consecutive Failures**: ' + config.alertThresholds.consecutiveFailures + '\n\n';

  content += '## 🚀 Installation\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += 'npm install\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += 'pip install -r requirements.txt\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```bash\n';
    content += 'go mod download\n';
    content += '```\n\n';
  }

  content += '## 💻 Usage\n\n';

  if (config.language === 'typescript') {
    content += '```typescript\n';
    content += 'import monitor from \'./monitoring\';\n\n';
    content += '// Perform health check\n';
    content += 'const health = await monitor.performHealthCheck(\'/health\');\n\n';
    content += '// Start continuous monitoring\n';
    content += 'monitor.startMonitoring(endpoints, 30000);\n\n';
    content += '// Get health status\n';
    content += 'const status = monitor.getHealthStatus();\n\n';
    content += '// Generate report\n';
    content += 'const report = monitor.generateReport();\n';
    content += 'console.log(report);\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```python\n';
    content += 'from monitoring import monitor\n\n';
    content += '# Perform health check\n';
    content += 'health = await monitor.perform_health_check(\'/health\')\n\n';
    content += '# Start continuous monitoring\n';
    content += 'await monitor.start_monitoring(endpoints, 30)\n\n';
    content += '# Get health status\n';
    content += 'status = monitor.get_health_status()\n\n';
    content += '# Generate report\n';
    content += 'report = monitor.generate_report()\n';
    content += 'print(report)\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```go\n';
    content += 'package main\n\n';
    content += 'import "monitoring"\n\n';
    content += 'func main() {\n';
    content += '    // Perform health check\n';
    content += '    health := monitoring.monitor.PerformHealthCheck("/health", "GET", 200)\n\n';
    content += '    // Get health status\n';
    content += '    status := monitoring.monitor.GetHealthStatus()\n\n';
    content += '    // Generate report\n';
    content += '    report := monitoring.monitor.GenerateReport()\n';
    content += '    fmt.Println(report)\n';
    content += '}\n';
    content += '```\n\n';
  }

  content += '## 📚 Features\n\n';
  content += '- **Health Checks**: Automatic endpoint health monitoring\n';
  content += '- **Alert Thresholds**: Configurable error rate, latency, and failure limits\n';
  content += '- **Root Cause Analysis**: Automatic analysis of critical failures\n';
  content += '- **Metrics**: Error rate, average latency, consecutive failures\n';
  content += '- **Reporting**: JSON-based monitoring reports\n';
  content += '- **Notifications**: Alert notification framework\n\n';

  content += '## 🎯 Alert Levels\n\n';
  content += '- **info**: Informational alerts\n';
  content += '- **warning**: Warnings for degraded performance\n';
  content += '- **critical**: Critical failures with root cause analysis\n\n';

  content += '## 📊 Metrics\n\n';
  content += 'The monitoring service tracks:\n';
  content += '- Endpoint health status\n';
  content += '- Request/response latency\n';
  content += '- Consecutive failure count\n';
  content += '- Overall error rate\n';
  content += '- Average latency across endpoints\n\n';

  return content;
}

// Write files
export async function writeMonitoringFiles(
  config: MonitorConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';
  const fileName = 'monitoring.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptMonitoring(config);
  } else if (config.language === 'python') {
    content = generatePythonMonitoring(config);
  } else if (config.language === 'go') {
    content = generateGoMonitoring(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config);
  const buildMDPath = path.join(output, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  // Generate example usage file
  const exampleContent = generateMonitoringExample(config);
  const examplePath = path.join(output, 'example.' + ext);
  await fs.writeFile(examplePath, exampleContent);
  console.log(chalk.green('✅ Generated: example.' + ext));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: config.serviceName.toLowerCase() + '-monitoring',
      version: '1.0.0',
      description: 'Monitoring and alerting for ' + config.serviceName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    const packageJsonPath = path.join(output, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✅ Generated: package.json'));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [
      'aiohttp>=3.9.0',
    ];

    const requirementsPath = path.join(output, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  // Generate go.mod for Go
  if (config.language === 'go') {
    const goMod = 'module ' + config.serviceName.toLowerCase() + '\n\n' +
                  'go 1.21\n';

    const goModPath = path.join(output, 'go.mod');
    await fs.writeFile(goModPath, goMod);
    console.log(chalk.green('✅ Generated: go.mod'));
  }

  // Generate monitoring config JSON
  const monitoringConfig = {
    serviceName: config.serviceName,
    language: config.language,
    alertThresholds: config.alertThresholds,
    endpoints: config.endpoints,
    notificationChannels: config.notificationChannels,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const configPath = path.join(output, 'monitoring-config.json');
  await fs.writeFile(configPath, JSON.stringify(monitoringConfig, null, 2));
  console.log(chalk.green('✅ Generated: monitoring-config.json'));
}

function generateMonitoringExample(config: MonitorConfig): string {
  if (config.language === 'typescript') {
    return `// Example usage of monitoring for ${config.serviceName}
import monitor from './monitoring';

async function runMonitoring() {
  console.log('🔍 Starting monitoring example...\\n');

  // Perform a health check
  const health = await monitor.performHealthCheck('/health', 'GET', 200);
  console.log('Health check result:', health);

  // Check all endpoints
  const endpoints = [
${config.endpoints.slice(0, 3).map(ep => `    { name: '${ep.name}', path: '${ep.path}', method: '${ep.method}', expectedStatus: ${ep.expectedStatus} },`).join('\n')}
  ];

  await monitor.checkAllEndpoints(endpoints);

  // Generate and display report
  console.log('\\n📊 Monitoring Report:');
  console.log(monitor.generateReport());

  // Get alerts
  const alerts = monitor.getAlerts();
  console.log('\\n🚨 Total Alerts:', alerts.length);
}

// Run example
runMonitoring().catch(console.error);
`;
  } else if (config.language === 'python') {
    return `# Example usage of monitoring for ${config.serviceName}
import asyncio
from monitoring import monitor

async def run_monitoring():
    print("🔍 Starting monitoring example...\\n")

    # Perform a health check
    health = await monitor.perform_health_check('/health', 'GET', 200)
    print("Health check result:", health)

    # Check all endpoints
    endpoints = [
${config.endpoints.slice(0, 3).map(ep => `        {'name': '${ep.name}', 'path': '${ep.path}', 'method': '${ep.method}', 'expectedStatus': ${ep.expectedStatus}},`).join('\n')}
    ]

    await monitor.check_all_endpoints(endpoints)

    # Generate and display report
    print("\\n📊 Monitoring Report:")
    print(monitor.generate_report())

    # Get alerts
    alerts = monitor.get_alerts()
    print(f"\\n🚨 Total Alerts: {len(alerts)}")

# Run example
asyncio.run(run_monitoring())
`;
  } else {
    return `// Example usage of monitoring for ${config.serviceName}
package main

import (
	"fmt"
	"monitoring"
)

func main() {
	fmt.Println("🔍 Starting monitoring example...\\n")

	// Perform a health check
	health := monitoring.monitor.PerformHealthCheck("/health", "GET", 200)
	fmt.Printf("Health check result: %+v\\n", health)

	// Get health status
	status := monitoring.monitor.GetHealthStatus()

	// Generate and display report
	fmt.Println("\\n📊 Monitoring Report:")
	fmt.Println(monitoring.monitor.GenerateReport())

	// Get alerts
	alerts := monitoring.monitor.GetAlerts("")
	fmt.Printf("\\n🚨 Total Alerts: %d\\n", len(alerts))
}
`;
  }
}
