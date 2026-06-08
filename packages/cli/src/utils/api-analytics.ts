/**
 * API Analytics and Monitoring Generator
 * Generates analytics middleware and monitoring configurations for all backend frameworks
 */

import * as fs from 'fs-extra';
import * as path from 'path';

// Analytics provider type
export type AnalyticsProvider =
  | 'prometheus'
  | 'datadog'
  | 'newrelic'
  | 'grafana'
  | 'elastic-apm'
  | 'cloudwatch'
  | 'open-telemetry'
  | 'custom';

// Backend framework type
export type BackendFramework =
  | 'express'
  | 'nestjs'
  | 'fastify'
  | 'fastapi'
  | 'django'
  | 'aspnet-core'
  | 'spring-boot'
  | 'gin'
  | 'axum';

// Analytics configuration interfaces
export interface AnalyticsConfig {
  name: string;
  provider: AnalyticsProvider;
  framework: BackendFramework;
  metrics: MetricConfig[];
  endpoints: AnalyticsEndpoint[];
  dashboard?: boolean;
  alerts?: AlertConfig[];
}

export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  labels?: string[];
}

export interface AnalyticsEndpoint {
  path: string;
  method: string;
  trackMetrics: boolean;
  logRequests: boolean;
  logErrors: boolean;
}

export interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  window: string;
  notify: string[];
}

// Provider templates
export function getAnalyticsProvider(provider: AnalyticsProvider): ProviderTemplate | undefined {
  const providers: Record<AnalyticsProvider, ProviderTemplate> = {
    prometheus: {
      provider: 'prometheus',
      format: 'yaml',
      configPath: './prometheus.yml',
      description: 'Prometheus - Open-source metrics and alerting toolkit',
      docsUrl: 'https://prometheus.io/docs/',
      defaultPort: 9090,
      metricsPath: '/metrics',
    },
    datadog: {
      provider: 'datadog',
      format: 'yaml',
      configPath: './datadog.yaml',
      description: 'Datadog - Cloud monitoring and security platform',
      docsUrl: 'https://docs.datadoghq.com/',
      defaultPort: 8125,
      metricsPath: '/metrics',
    },
    newrelic: {
      provider: 'newrelic',
      format: 'js',
      configPath: './newrelic.js',
      description: 'New Relic - observability platform',
      docsUrl: 'https://docs.newrelic.com/',
      defaultPort: null,
      metricsPath: null,
    },
    grafana: {
      provider: 'grafana',
      format: 'json',
      configPath: './grafana-dashboard.json',
      description: 'Grafana - Open-source analytics and visualization',
      docsUrl: 'https://grafana.com/docs/',
      defaultPort: 3000,
      metricsPath: '/metrics',
    },
    'elastic-apm': {
      provider: 'elastic-apm',
      format: 'yaml',
      configPath: './elastic-apm.yml',
      description: 'Elastic APM - Application performance monitoring',
      docsUrl: 'https://www.elastic.co/guide/en/apm/',
      defaultPort: 8200,
      metricsPath: '/intake/v2/events',
    },
    cloudwatch: {
      provider: 'cloudwatch',
      format: 'json',
      configPath: './cloudwatch.json',
      description: 'AWS CloudWatch - Monitoring and observability',
      docsUrl: 'https://docs.aws.amazon.com/cloudwatch/',
      defaultPort: null,
      metricsPath: null,
    },
    'open-telemetry': {
      provider: 'open-telemetry',
      format: 'yaml',
      configPath: './otel-collector.yml',
      description: 'OpenTelemetry - Observability framework',
      docsUrl: 'https://opentelemetry.io/docs/',
      defaultPort: 4317,
      metricsPath: '/v1/metrics',
    },
    custom: {
      provider: 'custom',
      format: 'ts',
      configPath: './analytics.ts',
      description: 'Custom analytics implementation',
      docsUrl: '',
      defaultPort: null,
      metricsPath: '/analytics',
    },
  };

  return providers[provider];
}

export interface ProviderTemplate {
  provider: AnalyticsProvider;
  format: 'yaml' | 'json' | 'js' | 'ts';
  configPath: string;
  description: string;
  docsUrl: string;
  defaultPort: number | null;
  metricsPath: string | null;
}

// Generate Express analytics middleware
export function generateExpressAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push("import { Router, Request, Response } from 'express';");
  lines.push("import promClient from 'prom-client';");
  lines.push('');

  if (config.provider === 'prometheus') {
    lines.push('// Create a Registry to register the metrics');
    lines.push('const register = new promClient.Registry();');
    lines.push('');

    lines.push('// Add default metrics (CPU, memory, etc.)');
    lines.push('promClient.collectDefaultMetrics({ register });');
    lines.push('');

    // Add custom metrics
    config.metrics.forEach(metric => {
      lines.push(`// ${metric.description}`);
      if (metric.type === 'counter') {
        lines.push(`export const ${metric.name} = new promClient.Counter({`);
        lines.push(`  name: '${metric.name}',`);
        lines.push(`  help: '${metric.description}',`);
        if (metric.labels && metric.labels.length > 0) {
          lines.push(`  labelNames: [${metric.labels.map(l => `'${l}'`).join(', ')}],`);
        }
        lines.push(`});`);
        lines.push(`${metric.name}.register(register);`);
      } else if (metric.type === 'histogram') {
        lines.push(`export const ${metric.name} = new promClient.Histogram({`);
        lines.push(`  name: '${metric.name}',`);
        lines.push(`  help: '${metric.description}',`);
        lines.push(`  buckets: [0.1, 0.5, 1, 2, 5, 10],`);
        if (metric.labels && metric.labels.length > 0) {
          lines.push(`  labelNames: [${metric.labels.map(l => `'${l}'`).join(', ')}],`);
        }
        lines.push(`});`);
        lines.push(`${metric.name}.register(register);`);
      } else if (metric.type === 'gauge') {
        lines.push(`export const ${metric.name} = new promClient.Gauge({`);
        lines.push(`  name: '${metric.name}',`);
        lines.push(`  help: '${metric.description}',`);
        if (metric.labels && metric.labels.length > 0) {
          lines.push(`  labelNames: [${metric.labels.map(l => `'${l}'`).join(', ')}],`);
        }
        lines.push(`});`);
        lines.push(`${metric.name}.register(register);`);
      }
      lines.push('');
    });

    lines.push('// Analytics middleware');
    lines.push('export const analyticsMiddleware = (req: Request, res: Response, next: Function) => {');
    lines.push('  const start = Date.now();');
    lines.push('');
    lines.push('  res.on("finish", () => {');
    lines.push('    const duration = Date.now() - start;');
    lines.push('    const route = req.route ? req.route.path : req.path;');
    lines.push('    const method = req.method;');
    lines.push('    const status = res.statusCode;');
    lines.push('');
    lines.push('    httpRequestsTotal.inc({ method, route, status });');
    lines.push('    httpRequestDurationMs.observe({ method, route }, duration);');
    lines.push('  });');
    lines.push('');
    lines.push('  next();');
    lines.push('};');
    lines.push('');
    lines.push('// Metrics endpoint');
    lines.push('export const metricsRouter = Router();');
    lines.push('metricsRouter.get("/metrics", async (req: Request, res: Response) => {');
    lines.push('  res.set("Content-Type", register.contentType);');
    lines.push('  res.end(await register.metrics());');
    lines.push('});');
  } else if (config.provider === 'custom') {
    lines.push('// Custom analytics implementation');
    lines.push('interface AnalyticsEvent {');
    lines.push('  timestamp: Date;');
    lines.push('  path: string;');
    lines.push('  method: string;');
    lines.push('  status: number;');
    lines.push('  duration: number;');
    lines.push('  userAgent?: string;');
    lines.push('  ip?: string;');
    lines.push('}');
    lines.push('');
    lines.push('const analyticsEvents: AnalyticsEvent[] = [];');
    lines.push('');
    lines.push('export const analyticsMiddleware = (req: Request, res: Response, next: Function) => {');
    lines.push('  const start = Date.now();');
    lines.push('');
    lines.push('  res.on("finish", () => {');
    lines.push('    const event: AnalyticsEvent = {');
    lines.push('      timestamp: new Date(),');
    lines.push('      path: req.path,');
    lines.push('      method: req.method,');
    lines.push('      status: res.statusCode,');
    lines.push('      duration: Date.now() - start,');
    lines.push('      userAgent: req.get("user-agent"),');
    lines.push('      ip: req.ip,');
    lines.push('    };');
    lines.push('');
    lines.push('    analyticsEvents.push(event);');
    lines.push('    ');
    lines.push('    // Keep only last 10000 events in memory');
    lines.push('    if (analyticsEvents.length > 10000) {');
    lines.push('      analyticsEvents.shift();');
    lines.push('    }');
    lines.push('  });');
    lines.push('');
    lines.push('  next();');
    lines.push('};');
    lines.push('');
    lines.push('// Analytics dashboard endpoint');
    lines.push('export const analyticsRouter = Router();');
    lines.push('analyticsRouter.get("/analytics", (req: Request, res: Response) => {');
    lines.push('  const stats = {');
    lines.push('    totalRequests: analyticsEvents.length,');
    lines.push('    averageResponseTime: analyticsEvents.reduce((sum, e) => sum + e.duration, 0) / analyticsEvents.length || 0,');
    lines.push('    successRate: (analyticsEvents.filter(e => e.status < 400).length / analyticsEvents.length * 100) || 0,');
    lines.push('    requestsByMethod: analyticsEvents.reduce((acc, e) => {');
    lines.push('      acc[e.method] = (acc[e.method] || 0) + 1;');
    lines.push('      return acc;');
    lines.push('    }, {} as Record<string, number>),');
    lines.push('    requestsByPath: analyticsEvents.reduce((acc, e) => {');
    lines.push('      acc[e.path] = (acc[e.path] || 0) + 1;');
    lines.push('      return acc;');
    lines.push('    }, {} as Record<string, number>),');
    lines.push('  };');
    lines.push('  res.json(stats);');
    lines.push('});');
  }

  return lines.join('\n');
}

// Generate FastAPI analytics middleware
export function generateFastAPIAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push('from fastapi import Request, Response');
  lines.push('from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST');
  lines.push('from prometheus_client import CollectorRegistry');
  lines.push('import time');
  lines.push('from typing import Dict, Any');
  lines.push('');

  if (config.provider === 'prometheus') {
    lines.push('# Create a registry');
    lines.push('registry = CollectorRegistry()');
    lines.push('');

    lines.push('# Define metrics');
    lines.push('http_requests_total = Counter(');
    lines.push('    "http_requests_total",');
    lines.push('    "Total number of HTTP requests",');
    lines.push('    ["method", "endpoint", "status"],');
    lines.push('    registry=registry');
    lines.push(')');
    lines.push('');
    lines.push('http_request_duration_seconds = Histogram(');
    lines.push('    "http_request_duration_seconds",');
    lines.push('    "HTTP request duration in seconds",');
    lines.push('    ["method", "endpoint"],');
    lines.push('    registry=registry');
    lines.push(')');
    lines.push('');
    lines.push('# Custom metrics from config');
    config.metrics.forEach(metric => {
      if (metric.type === 'counter') {
        lines.push(`${metric.name} = Counter(`);
        lines.push(`    "${metric.name}",`);
        lines.push(`    "${metric.description}",`);
        if (metric.labels && metric.labels.length > 0) {
          lines.push(`    ${metric.labels.map(l => `'${l}'`).join(', ')},`);
        }
        lines.push(`    registry=registry`);
        lines.push(`)`);
      } else if (metric.type === 'histogram') {
        lines.push(`${metric.name} = Histogram(`);
        lines.push(`    "${metric.name}",`);
        lines.push(`    "${metric.description}",`);
        if (metric.labels && metric.labels.length > 0) {
          lines.push(`    ${metric.labels.map(l => `'${l}'`).join(', ')},`);
        }
        lines.push(`    registry=registry`);
        lines.push(`)`);
      }
      lines.push('');
    });

    lines.push('# Analytics middleware');
    lines.push('async def analytics_middleware(request: Request, call_next):');
    lines.push('    start_time = time.time()');
    lines.push('    ');
    lines.push('    response = await call_next(request)');
    lines.push('    ');
    lines.push('    duration = time.time() - start_time');
    lines.push('    endpoint = request.url.path');
    lines.push('    method = request.method');
    lines.push('    status = response.status_code');
    lines.push('    ');
    lines.push('    http_requests_total.labels(');
    lines.push('        method=method,');
    lines.push('        endpoint=endpoint,');
    lines.push('        status=str(status)');
    lines.push('    ).inc()');
    lines.push('    ');
    lines.push('    http_request_duration_seconds.labels(');
    lines.push('        method=method,');
    lines.push('        endpoint=endpoint');
    lines.push('    ).observe(duration)');
    lines.push('    ');
    lines.push('    return response');
    lines.push('');
    lines.push('# Metrics endpoint');
    lines.push('async def metrics_endpoint():');
    lines.push('    return Response(');
    lines.push('        content=generate_latest(registry),');
    lines.push('        media_type=CONTENT_TYPE_LATEST');
    lines.push('    )');
  } else if (config.provider === 'custom') {
    lines.push('# Custom analytics implementation');
    lines.push('from collections import defaultdict');
    lines.push('from datetime import datetime');
    lines.push('import json');
    lines.push('');
    lines.push('analytics_events = []');
    lines.push('');
    lines.push('async def analytics_middleware(request: Request, call_next):');
    lines.push('    start_time = time.time()');
    lines.push('    response = await call_next(request)');
    lines.push('    duration = time.time() - start_time');
    lines.push('    ');
    lines.push('    event = {');
    lines.push('        "timestamp": datetime.utcnow().isoformat(),');
    lines.push('        "path": request.url.path,');
    lines.push('        "method": request.method,');
    lines.push('        "status": response.status_code,');
    lines.push('        "duration": duration,');
    lines.push('        "user_agent": request.headers.get("user-agent"),');
    lines.push('    }');
    lines.push('    ');
    lines.push('    analytics_events.append(event)');
    lines.push('    if len(analytics_events) > 10000:');
    lines.push('        analytics_events.pop(0)');
    lines.push('    ');
    lines.push('    return response');
    lines.push('');
    lines.push('async def analytics_endpoint() -> Dict[str, Any]:');
    lines.push('    if not analytics_events:');
    lines.push('        return {"total_requests": 0}');
    lines.push('    ');
    lines.push('    total_duration = sum(e["duration"] for e in analytics_events)');
    lines.push('    successful = sum(1 for e in analytics_events if e["status"] < 400)');
    lines.push('    ');
    lines.push('    by_method = defaultdict(int)');
    lines.push('    for e in analytics_events:');
    lines.push('        by_method[e["method"]] += 1');
    lines.push('    ');
    lines.push('    by_path = defaultdict(int)');
    lines.push('    for e in analytics_events:');
    lines.push('        by_path[e["path"]] += 1');
    lines.push('    ');
    lines.push('    return {');
    lines.push('        "total_requests": len(analytics_events),');
    lines.push('        "average_response_time": total_duration / len(analytics_events),');
    lines.push('        "success_rate": successful / len(analytics_events) * 100,');
    lines.push('        "requests_by_method": dict(by_method),');
    lines.push('        "requests_by_path": dict(by_path),');
    lines.push('    }');
  }

  return lines.join('\n');
}

// Generate Django analytics middleware
export function generateDjangoAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push('import time');
  lines.push('from django.utils.deprecation import MiddlewareMixin');
  lines.push('from prometheus_client import Counter, Histogram, generate_latest, CollectorRegistry');
  lines.push('from django.http import HttpResponse');
  lines.push('');

  if (config.provider === 'prometheus') {
    lines.push('registry = CollectorRegistry()');
    lines.push('');
    lines.push('http_requests_total = Counter(');
    lines.push('    "http_requests_total",');
    lines.push('    "Total number of HTTP requests",');
    lines.push('    ["method", "endpoint", "status"],');
    lines.push('    registry=registry');
    lines.push(')');
    lines.push('');
    lines.push('http_request_duration_seconds = Histogram(');
    lines.push('    "http_request_duration_seconds",');
    lines.push('    "HTTP request duration in seconds",');
    lines.push('    ["method", "endpoint"],');
    lines.push('    registry=registry');
    lines.push(')');
    lines.push('');
    lines.push('class AnalyticsMiddleware(MiddlewareMixin):');
    lines.push('    def process_request(self, request):');
    lines.push('        request.start_time = time.time()');
    lines.push('    ');
    lines.push('    def process_response(self, request, response):');
    lines.push('        duration = time.time() - getattr(request, "start_time", time.time())');
    lines.push('        endpoint = request.path');
    lines.push('        method = request.method');
    lines.push('        status = response.status_code');
    lines.push('        ');
    lines.push('        http_requests_total.labels(');
    lines.push('            method=method,');
    lines.push('            endpoint=endpoint,');
    lines.push('            status=status');
    lines.push('        ).inc()');
    lines.push('        ');
    lines.push('        http_request_duration_seconds.labels(');
    lines.push('            method=method,');
    lines.push('            endpoint=endpoint');
    lines.push('        ).observe(duration)');
    lines.push('        ');
    lines.push('        return response');
    lines.push('');
    lines.push('# URL pattern for metrics endpoint');
    lines.push('# In urls.py:');
    lines.push('# from django.urls import path');
    lines.push('# from .analytics import metrics_view');
    lines.push('# urlpatterns = [');
    lines.push('#     path("metrics/", metrics_view),');
    lines.push('# ]');
    lines.push('');
    lines.push('def metrics_view(request):');
    lines.push('    return HttpResponse(');
    lines.push('        generate_latest(registry),');
    lines.push('        content_type="text/plain"]');
    lines.push('    )');
  } else if (config.provider === 'custom') {
    lines.push('from collections import defaultdict');
    lines.push('from datetime import datetime');
    lines.push('import json');
    lines.push('');
    lines.push('analytics_events = []');
    lines.push('');
    lines.push('class AnalyticsMiddleware(MiddlewareMixin):');
    lines.push('    def process_request(self, request):');
    lines.push('        request.start_time = time.time()');
    lines.push('    ');
    lines.push('    def process_response(self, request, response):');
    lines.push('        duration = time.time() - getattr(request, "start_time", time.time())');
    lines.push('        ');
    lines.push('        event = {');
    lines.push('            "timestamp": datetime.utcnow().isoformat(),');
    lines.push('            "path": request.path,');
    lines.push('            "method": request.method,');
    lines.push('            "status": response.status_code,');
    lines.push('            "duration": duration,');
    lines.push('            "user_agent": request.META.get("HTTP_USER_AGENT"),');
    lines.push('        }');
    lines.push('        ');
    lines.push('        analytics_events.append(event)');
    lines.push('        if len(analytics_events) > 10000:');
    lines.push('            analytics_events.pop(0)');
    lines.push('        ');
    lines.push('        return response');
    lines.push('');
    lines.push('def analytics_view(request):');
    lines.push('    if not analytics_events:');
    lines.push('        return JsonResponse({"total_requests": 0})');
    lines.push('    ');
    lines.push('    total_duration = sum(e["duration"] for e in analytics_events)');
    lines.push('    successful = sum(1 for e in analytics_events if e["status"] < 400)');
    lines.push('    ');
    lines.push('    by_method = defaultdict(int)');
    lines.push('    for e in analytics_events:');
    lines.push('        by_method[e["method"]] += 1');
    lines.push('    ');
    lines.push('    return JsonResponse({');
    lines.push('        "total_requests": len(analytics_events),');
    lines.push('        "average_response_time": total_duration / len(analytics_events),');
    lines.push('        "success_rate": successful / len(analytics_events) * 100,');
    lines.push('        "requests_by_method": dict(by_method),');
    lines.push('    })');
  }

  return lines.join('\n');
}

// Generate ASP.NET Core analytics middleware
export function generateAspNetCoreAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push('using System.Diagnostics;');
  lines.push('using System.Diagnostics.Metrics;');
  lines.push('using Microsoft.AspNetCore.Http;');
  lines.push('using System.Threading.Tasks;');
  lines.push('');

  if (config.provider === 'prometheus') {
    lines.push('// Add NuGet package: Prometheus.AspNetCore');
    lines.push('using Prometheus;');
    lines.push('');
    lines.push('public class AnalyticsMiddleware');
    lines.push('{');
    lines.push('    private readonly RequestDelegate _next;');
    lines.push('    private readonly Counter _httpRequestsTotal;');
    lines.push('    private readonly Histogram _httpRequestDuration;');
    lines.push('');
    lines.push('    public AnalyticsMiddleware(RequestDelegate next)');
    lines.push('    {');
    lines.push('        _next = next;');
    lines.push('        ');
    lines.push('        _httpRequestsTotal = Metrics.CreateCounter(');
    lines.push('            "http_requests_total",');
    lines.push('            "Total number of HTTP requests",');
    lines.push('            new CounterConfiguration');
    lines.push('            {');
    lines.push('                LabelNames = new[] { "method", "endpoint", "status" }');
    lines.push('            });');
    lines.push('        ');
    lines.push('        _httpRequestDuration = Metrics.CreateHistogram(');
    lines.push('            "http_request_duration_seconds",');
    lines.push('            "HTTP request duration in seconds",');
    lines.push('            new HistogramConfiguration');
    lines.push('            {');
    lines.push('                LabelNames = new[] { "method", "endpoint" },');
    lines.push('                Buckets = Histogram.ExponentialBuckets(0.01, 2, 10)');
    lines.push('            });');
    lines.push('    }');
    lines.push('    ');
    lines.push('    public async Task InvokeAsync(HttpContext context)');
    lines.push('    {');
    lines.push('        var stopwatch = Stopwatch.StartNew();');
    lines.push('        ');
    lines.push('        try');
    lines.push('        {');
    lines.push('            await _next(context);');
    lines.push('        }');
    lines.push('        finally');
    lines.push('        {');
    lines.push('            stopwatch.Stop();');
    lines.push('            ');
    lines.push('            var method = context.Request.Method;');
    lines.push('            var endpoint = context.Request.Path;');
    lines.push('            var status = context.Response.StatusCode.ToString();');
    lines.push('            ');
    lines.push('            _httpRequestsTotal.WithLabels(method, endpoint, status).Inc();');
    lines.push('            _httpRequestDuration.WithLabels(method, endpoint).Observe(stopwatch.Elapsed.TotalSeconds);');
    lines.push('        }');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('// Extension method to register middleware');
    lines.push('public static class AnalyticsMiddlewareExtensions');
    lines.push('{');
    lines.push('    public static IApplicationBuilder UseAnalytics(this IApplicationBuilder builder)');
    lines.push('    {');
    lines.push('        return builder.UseMiddleware<AnalyticsMiddleware>()');
    lines.push('            .UseMetricsServer(); // Exposes /metrics endpoint');
    lines.push('    }');
    lines.push('}');
  } else if (config.provider === 'custom') {
    lines.push('using System.Collections.Concurrent;');
    lines.push('');
    lines.push('public class AnalyticsEvent');
    lines.push('{');
    lines.push('    public DateTime Timestamp { get; set; }');
    lines.push('    public string Path { get; set; }');
    lines.push('    public string Method { get; set; }');
    lines.push('    public int Status { get; set; }');
    lines.push('    public double Duration { get; set; }');
    lines.push('    public string? UserAgent { get; set; }');
    lines.push('}');
    lines.push('');
    lines.push('public class AnalyticsMiddleware');
    lines.push('{');
    lines.push('    private static readonly ConcurrentQueue<AnalyticsEvent> _events = new();');
    lines.push('    private const int MaxEvents = 10000;');
    lines.push('    private readonly RequestDelegate _next;');
    lines.push('');
    lines.push('    public AnalyticsMiddleware(RequestDelegate next)');
    lines.push('    {');
    lines.push('        _next = next;');
    lines.push('    }');
    lines.push('    ');
    lines.push('    public async Task InvokeAsync(HttpContext context)');
    lines.push('    {');
    lines.push('        var stopwatch = Stopwatch.StartNew();');
    lines.push('        ');
    lines.push('        try');
    lines.push('        {');
    lines.push('            await _next(context);');
    lines.push('        }');
    lines.push('        finally');
    lines.push('        {');
    lines.push('            stopwatch.Stop();');
    lines.push('            ');
    lines.push('            var @event = new AnalyticsEvent');
    lines.push('            {');
    lines.push('                Timestamp = DateTime.UtcNow,');
    lines.push('                Path = context.Request.Path,');
    lines.push('                Method = context.Request.Method,');
    lines.push('                Status = context.Response.StatusCode,');
    lines.push('                Duration = stopwatch.Elapsed.TotalMilliseconds,');
    lines.push('                UserAgent = context.Request.Headers["User-Agent"].ToString(),');
    lines.push('            };');
    lines.push('            ');
    lines.push('            _events.Enqueue(@event);');
    lines.push('            while (_events.Count > MaxEvents)');
    lines.push('                _events.TryDequeue(out _);');
    lines.push('        }');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('// Analytics summary endpoint');
    lines.push('public class AnalyticsEndpoint');
    lines.push('{');
    lines.push('    public static IResult GetAnalytics()');
    lines.push('    {');
    lines.push('        var events = _events.ToArray();');
    lines.push('        ');
    lines.push('        if (events.Length == 0)');
    lines.push('            return Results.Ok(new { totalRequests = 0 });');
    lines.push('        ');
    lines.push('        var avgDuration = events.Average(e => e.Duration);');
    lines.push('        var successRate = events.Count(e => e.Status < 400) * 100.0 / events.Length;');
    lines.push('        ');
    lines.push('        var byMethod = events');
    lines.push('            .GroupBy(e => e.Method)');
    lines.push('            .ToDictionary(g => g.Key, g => g.Count());');
    lines.push('        ');
    lines.push('        return Results.Ok(new {');
    lines.push('            totalRequests = events.Length,');
    lines.push('            averageResponseTime = avgDuration,');
    lines.push('            successRate,');
    lines.push('            requestsByMethod = byMethod');
    lines.push('        });');
    lines.push('    }');
    lines.push('}');
  }

  return lines.join('\n');
}

// Generate Spring Boot analytics configuration
export function generateSpringBootAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  if (config.provider === 'prometheus') {
    lines.push('// Add dependencies to build.gradle:');
    lines.push('// implementation "io.micrometer:micrometer-registry-prometheus"');
    lines.push('// implementation "org.springframework.boot:spring-boot-starter-actuator"');
    lines.push('');
    lines.push('# application.yml');
    lines.push('management:');
    lines.push('  endpoints:');
    lines.push('    web:');
    lines.push('      exposure:');
    lines.push('        include: health,info,metrics,prometheus');
    lines.push('  metrics:');
    lines.push('    export:');
    lines.push('      prometheus:');
    lines.push('        enabled: true');
    lines.push('    tags:');
    lines.push('      application: ${spring.application.name}');
    lines.push('');
    lines.push('// Custom metrics configuration');
    lines.push('package com.example.analytics;');
    lines.push('');
    lines.push('import io.micrometer.core.instrument.Counter;');
    lines.push('import io.micrometer.core.instrument.MeterRegistry;');
    lines.push('import io.micrometer.core.instrument.Timer;');
    lines.push('import org.springframework.stereotype.Component;');
    lines.push('');
    lines.push('@Component');
    lines.push('public class CustomMetrics {');
    lines.push('');
    lines.push('    private final Counter requestCounter;');
    lines.push('    private final Timer requestTimer;');
    lines.push('');
    lines.push('    public CustomMetrics(MeterRegistry registry) {');
    lines.push('        this.requestCounter = Counter.builder("api.requests.total")');
    lines.push('            .description("Total API requests")');
    lines.push('            .tag("method", "unknown")');
    lines.push('            .tag("endpoint", "unknown")');
    lines.push('            .tag("status", "unknown")');
    lines.push('            .register(registry);');
    lines.push('            ');
    lines.push('        this.requestTimer = Timer.builder("api.request.duration")');
    lines.push('            .description("API request duration")');
    lines.push('            .tag("method", "unknown")');
    lines.push('            .tag("endpoint", "unknown")');
    lines.push('            .register(registry);');
    lines.push('    }');
    lines.push('    ');
    lines.push('    public void recordRequest(String method, String endpoint, String status) {');
    lines.push('        requestCounter.tags(method, endpoint, status).increment();');
    lines.push('    }');
    lines.push('    ');
    lines.push('    public void recordRequestTime(String method, String endpoint, long duration) {');
    lines.push('        requestTimer.tags(method, endpoint).record(duration, java.util.concurrent.TimeUnit.MILLISECONDS);');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('// Filter for request tracking');
    lines.push('package com.example.analytics;');
    lines.push('');
    lines.push('import jakarta.servlet.*;');
    lines.push('import jakarta.servlet.http.HttpServletRequest;');
    lines.push('import jakarta.servlet.http.HttpServletResponse;');
    lines.push('import org.springframework.stereotype.Component;');
    lines.push('import java.io.IOException;');
    lines.push('');
    lines.push('@Component');
    lines.push('public class AnalyticsFilter implements Filter {');
    lines.push('    ');
    lines.push('    private final CustomMetrics metrics;');
    lines.push('    ');
    lines.push('    public AnalyticsFilter(CustomMetrics metrics) {');
    lines.push('        this.metrics = metrics;');
    lines.push('    }');
    lines.push('    ');
    lines.push('    @Override');
    lines.push('    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)');
    lines.push('            throws IOException, ServletException {');
    lines.push('        HttpServletRequest req = (HttpServletRequest) request;');
    lines.push('        HttpServletResponse res = (HttpServletResponse) response;');
    lines.push('        ');
    lines.push('        long start = System.currentTimeMillis();');
    lines.push('        ');
    lines.push('        try {');
    lines.push('            chain.doFilter(request, response);');
    lines.push('        } finally {');
    lines.push('            long duration = System.currentTimeMillis() - start;');
    lines.push('            metrics.recordRequest(req.getMethod(), req.getRequestURI(), String.valueOf(res.getStatus()));');
    lines.push('            metrics.recordRequestTime(req.getMethod(), req.getRequestURI(), duration);');
    lines.push('        }');
    lines.push('    }');
    lines.push('}');
  } else if (config.provider === 'custom') {
    lines.push('# Custom analytics implementation');
    lines.push('package com.example.analytics;');
    lines.push('');
    lines.push('import org.springframework.stereotype.Component;');
    lines.push('import org.springframework.web.bind.annotation.GetMapping;');
    lines.push('import org.springframework.web.bind.annotation.RestController;');
    lines.push('import java.time.LocalDateTime;');
    lines.push('import java.util.*;');
    lines.push('import java.util.concurrent.*;');
    lines.push('');
    lines.push('@Component');
    lines.push('public class AnalyticsService {');
    lines.push('    ');
    lines.push('    private final Queue<AnalyticsEvent> events = new ConcurrentLinkedQueue<>();');
    lines.push('    private static final int MAX_EVENTS = 10000;');
    lines.push('    ');
    lines.push('    public void recordEvent(String method, String path, int status, long duration, String userAgent) {');
    lines.push('        AnalyticsEvent event = new AnalyticsEvent(LocalDateTime.now(), method, path, status, duration, userAgent);');
    lines.push('        events.offer(event);');
    lines.push('        while (events.size() > MAX_EVENTS) {');
    lines.push('            events.poll();');
    lines.push('        }');
    lines.push('    }');
    lines.push('    ');
    lines.push('    public Map<String, Object> getStats() {');
    lines.push('        List<AnalyticsEvent> eventList = new ArrayList<>(events);');
    lines.push('        ');
    lines.push('        if (eventList.isEmpty()) {');
    lines.push('            return Map.of("totalRequests", 0);');
    lines.push('        }');
    lines.push('        ');
    lines.push('        double avgDuration = eventList.stream()');
    lines.push('            .mapToLong(e -> e.duration)');
    lines.push('            .average()');
    lines.push('            .orElse(0);');
    lines.push('        ');
    lines.push('        long successCount = eventList.stream()');
    lines.push('            .filter(e -> e.status < 400)');
    lines.push('            .count();');
    lines.push('        ');
    lines.push('        Map<String, Long> byMethod = eventList.stream()');
    lines.push('            .collect(Collectors.groupingBy(e -> e.method, Collectors.counting()));');
    lines.push('        ');
    lines.push('        return Map.of(');
    lines.push('            "totalRequests", eventList.size(),');
    lines.push('            "averageResponseTime", avgDuration,');
    lines.push('            "successRate", successCount * 100.0 / eventList.size(),');
    lines.push('            "requestsByMethod", byMethod');
    lines.push('        );');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('record AnalyticsEvent(LocalDateTime timestamp, String method, String path, int status, long duration, String userAgent) {}');
    lines.push('');
    lines.push('@RestController');
    lines.push('public class AnalyticsController {');
    lines.push('    ');
    lines.push('    private final AnalyticsService analyticsService;');
    lines.push('    ');
    lines.push('    public AnalyticsController(AnalyticsService analyticsService) {');
    lines.push('        this.analyticsService = analyticsService;');
    lines.push('    }');
    lines.push('    ');
    lines.push('    @GetMapping("/analytics")');
    lines.push('    public Map<String, Object> getAnalytics() {');
    lines.push('        return analyticsService.getStats();');
    lines.push('    }');
    lines.push('}');
  }

  return lines.join('\n');
}

// Generate Gin (Go) analytics middleware
export function generateGinAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push('package analytics');
  lines.push('');
  lines.push('import (');
  lines.push('    "github.com/gin-gonic/gin"');
  lines.push('    "github.com/prometheus/client_golang/prometheus"');
  lines.push('    "github.com/prometheus/client_golang/prometheus/promhttp"');
  lines.push('    "strconv"');
  lines.push('    "time"');
  lines.push(')');

  if (config.provider === 'prometheus') {
    lines.push('');
    lines.push('var (');
    lines.push('    httpRequestsTotal = prometheus.NewCounterVec(');
    lines.push('        prometheus.CounterOpts{');
    lines.push('            Name: "http_requests_total",');
    lines.push('            Help: "Total number of HTTP requests",');
    lines.push('        },');
    lines.push('        []string{"method", "endpoint", "status"},');
    lines.push('    )');
    lines.push('    ');
    lines.push('    httpRequestDuration = prometheus.NewHistogramVec(');
    lines.push('        prometheus.HistogramOpts{');
    lines.push('            Name: "http_request_duration_seconds",');
    lines.push('            Help: "HTTP request duration in seconds",');
    lines.push('            Buckets: prometheus.DefBuckets,');
    lines.push('        },');
    lines.push('        []string{"method", "endpoint"},');
    lines.push('    )');
    lines.push(')');

    config.metrics.forEach(metric => {
      lines.push('');
      lines.push('// ' + metric.description);
      lines.push('var ' + metric.name + ' = prometheus.New' + (metric.type === 'counter' ? 'CounterVec' : metric.type === 'histogram' ? 'HistogramVec' : 'GaugeVec') + '(');
      lines.push('    prometheus.' + (metric.type === 'counter' ? 'Counter' : metric.type === 'histogram' ? 'Histogram' : 'Gauge') + 'Opts{');
      lines.push('        Name: "' + metric.name + '",');
      lines.push('        Help: "' + metric.description + '",');
      lines.push('    },');
      if (metric.labels && metric.labels.length > 0) {
        lines.push('    []string{' + metric.labels.map(l => '"' + l + '"').join(', ') + '},');
      } else {
        lines.push('    nil,');
      }
      lines.push(')');
    });

    lines.push('');
    lines.push('func init() {');
    lines.push('    prometheus.MustRegister(httpRequestsTotal)');
    lines.push('    prometheus.MustRegister(httpRequestDuration)');
    config.metrics.forEach(metric => {
      lines.push('    prometheus.MustRegister(' + metric.name + ')');
    });
    lines.push('}');
    lines.push('');
    lines.push('// AnalyticsMiddleware tracks HTTP requests');
    lines.push('func AnalyticsMiddleware() gin.HandlerFunc {');
    lines.push('    return func(c *gin.Context) {');
    lines.push('        start := time.Now()');
    lines.push('        ');
    lines.push('        c.Next()');
    lines.push('        ');
    lines.push('        duration := time.Since(start).Seconds()');
    lines.push('        method := c.Request.Method');
    lines.push('        endpoint := c.FullPath()');
    lines.push('        if endpoint == "" {');
    lines.push('            endpoint = c.Request.URL.Path');
    lines.push('        }');
    lines.push('        status := strconv.Itoa(c.Writer.Status())');
    lines.push('        ');
    lines.push('        httpRequestsTotal.WithLabelValues(method, endpoint, status).Inc()');
    lines.push('        httpRequestDuration.WithLabelValues(method, endpoint).Observe(duration)');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('// MetricsHandler returns the Prometheus metrics handler');
    lines.push('func MetricsHandler() gin.HandlerFunc {');
    lines.push('    return gin.WrapH(promhttp.Handler())');
    lines.push('}');
  } else if (config.provider === 'custom') {
    lines.push('');
    lines.push('import (');
    lines.push('    "sync"');
    lines.push('    "time"');
    lines.push(')');
    lines.push('');
    lines.push('type AnalyticsEvent struct {');
    lines.push('    Timestamp time.Time');
    lines.push('    Method    string');
    lines.push('    Path      string');
    lines.push('    Status    int');
    lines.push('    Duration  time.Duration');
    lines.push('    UserAgent string');
    lines.push('}');
    lines.push('');
    lines.push('type AnalyticsService struct {');
    lines.push('    mu     sync.RWMutex');
    lines.push('    events []AnalyticsEvent');
    lines.push('}');
    lines.push('');
    lines.push('var analytics = &AnalyticsService{');
    lines.push('    events: make([]AnalyticsEvent, 0, 10000),');
    lines.push('}');
    lines.push('');
    lines.push('func (a *AnalyticsService) Record(event AnalyticsEvent) {');
    lines.push('    a.mu.Lock()');
    lines.push('    defer a.mu.Unlock()');
    lines.push('    ');
    lines.push('    a.events = append(a.events, event)');
    lines.push('    if len(a.events) > 10000 {');
    lines.push('        a.events = a.events[1:]');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('func (a *AnalyticsService) GetStats() map[string]interface{} {');
    lines.push('    a.mu.RLock()');
    lines.push('    defer a.mu.RUnlock()');
    lines.push('    ');
    lines.push('    if len(a.events) == 0 {');
    lines.push('        return map[string]interface{}{"total_requests": 0}');
    lines.push('    }');
    lines.push('    ');
    lines.push('    var totalDuration time.Duration');
    lines.push('    var successCount int');
    lines.push('    byMethod := make(map[string]int)');
    lines.push('    ');
    lines.push('    for _, e := range a.events {');
    lines.push('        totalDuration += e.Duration');
    lines.push('        if e.Status < 400 {');
    lines.push('            successCount++');
    lines.push('        }');
    lines.push('        byMethod[e.Method]++');
    lines.push('    }');
    lines.push('    ');
    lines.push('    avgDuration := float64(totalDuration) / float64(len(a.events)) / 1e9 // convert to seconds');
    lines.push('    successRate := float64(successCount) / float64(len(a.events)) * 100');
    lines.push('    ');
    lines.push('    return map[string]interface{}{');
    lines.push('        "total_requests": len(a.events),');
    lines.push('        "average_response_time": avgDuration,');
    lines.push('        "success_rate": successRate,');
    lines.push('        "requests_by_method": byMethod,');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('func AnalyticsMiddleware() gin.HandlerFunc {');
    lines.push('    return func(c *gin.Context) {');
    lines.push('        start := time.Now()');
    lines.push('        ');
    lines.push('        c.Next()');
    lines.push('        ');
    lines.push('        event := AnalyticsEvent{');
    lines.push('            Timestamp: time.Now(),');
    lines.push('            Method:    c.Request.Method,');
    lines.push('            Path:      c.Request.URL.Path,');
    lines.push('            Status:    c.Writer.Status(),');
    lines.push('            Duration:  time.Since(start),');
    lines.push('            UserAgent: c.Request.UserAgent(),');
    lines.push('        }');
    lines.push('        ');
    lines.push('        analytics.Record(event)');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push('func GetAnalyticsHandler(c *gin.Context) {');
    lines.push('    c.JSON(200, analytics.GetStats())');
    lines.push('}');
  }

  return lines.join('\n');
}

// Generate Rust Axum analytics middleware
export function generateAxumAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push('use axum::{');
  lines.push('    extract::Request,');
  lines.push('    http::StatusCode,');
  lines.push('    middleware::Next,');
  lines.push('    response::Response,');
  lines.push('};');
  lines.push('use prometheus::{');
  lines.push('    Counter, Histogram, Registry, TextEncoder, Encoder');
  lines.push('};');
  lines.push('use std::sync::Arc;');
  lines.push('use std::time::Instant;');
  lines.push('');
  lines.push('// Create metrics registry');
  lines.push('pub fn create_registry() -> Arc<Registry> {');
  lines.push('    let registry = Registry::new();');
  lines.push('    ');
  lines.push('    // Register HTTP request counter');
  lines.push('    let http_requests_total = Counter::new(');
  lines.push('        "http_requests_total",');
  lines.push('        "Total number of HTTP requests"');
  lines.push('    ).unwrap();');
  lines.push('    registry.register(Box::new(http_requests_total)).unwrap();');
  lines.push('    ');
  lines.push('    // Register HTTP request duration histogram');
  lines.push('    let http_request_duration = Histogram::with_opts(');
  lines.push('        prometheus::HistogramOpts::new(');
  lines.push('            "http_request_duration_seconds",');
  lines.push('            "HTTP request duration in seconds"');
  lines.push('        ).buckets(vec![0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0])');
  lines.push('    ).unwrap();');
  lines.push('    registry.register(Box::new(http_request_duration)).unwrap();');
  lines.push('    ');
  lines.push('    Arc::new(registry)');
  lines.push('}');
  lines.push('');
  lines.push('// Analytics middleware');
  lines.push('pub async fn analytics_middleware(');
  lines.push('    req: Request,');
  lines.push('    next: Next,');
  lines.push(') -> Response {');
  lines.push('    let start = Instant::now();');
  lines.push('    let method = req.method().to_string();');
  lines.push('    let path = req.uri().path().to_string();');
  lines.push('    ');
  lines.push('    let response = next.run(req).await;');
  lines.push('    ');
  lines.push('    let duration = start.elapsed().as_secs_f64();');
  lines.push('    let status = response.status().as_u16();');
  lines.push('    ');
  lines.push('    // Record metrics (you would typically store these in a shared state)');
  lines.push('    // http_requests_total.with_label_values(&[&method, &path, &status.to_string()]).inc();');
  lines.push('    // http_request_duration.with_label_values(&[&method, &path]).observe(duration);');
  lines.push('    ');
  lines.push('    response');
  lines.push('}');
  lines.push('');
  lines.push('// Metrics endpoint handler');
  lines.push('pub async fn metrics_handler() -> String {');
  lines.push('    let registry = create_registry();');
  lines.push('    let encoder = TextEncoder::new();');
  lines.push('    let metric_families = registry.gather();');
  lines.push('    let mut buffer = Vec::new();');
  lines.push('    encoder.encode(&metric_families, &mut buffer).unwrap();');
  lines.push('    String::from_utf8(buffer).unwrap()');
  lines.push('}');

  return lines.join('\n');
}

// Generate NestJS analytics middleware
export function generateNestJSAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push("import { Injectable, NestMiddleware, Module } from '@nestjs/common';");
  lines.push("import { Request, Response, NextFunction } from 'express';");
  lines.push("import { Counter, Histogram, Registry } from 'prom-client';");
  lines.push('');

  if (config.provider === 'prometheus') {
    lines.push('@Injectable()');
    lines.push('export class AnalyticsMiddleware implements NestMiddleware {');
    lines.push('  private registry: Registry;');
    lines.push('  private httpRequestsTotal: Counter<string>;');
    lines.push('  private httpRequestDuration: Histogram<string>;');
    lines.push('');
    lines.push('  constructor() {');
    lines.push('    this.registry = new Registry();');
    lines.push('    ');
    lines.push('    this.httpRequestsTotal = new Counter({');
    lines.push('      name: "http_requests_total",');
    lines.push('      help: "Total number of HTTP requests",');
    lines.push('      labelNames: ["method", "endpoint", "status"],');
    lines.push('      registers: [this.registry],');
    lines.push('    });');
    lines.push('    ');
    lines.push('    this.httpRequestDuration = new Histogram({');
    lines.push('      name: "http_request_duration_seconds",');
    lines.push('      help: "HTTP request duration in seconds",');
    lines.push('      labelNames: ["method", "endpoint"],');
    lines.push('      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],');
    lines.push('      registers: [this.registry],');
    lines.push('    });');
    lines.push('  }');
    lines.push('');
    lines.push('  use(req: Request, res: Response, next: NextFunction): void {');
    lines.push('    const start = Date.now();');
    lines.push('    ');
    lines.push('    res.on("finish", () => {');
    lines.push('      const duration = (Date.now() - start) / 1000;');
    lines.push('      const route = (req as any).route?.path || req.path;');
    lines.push('      const method = req.method;');
    lines.push('      const status = res.statusCode.toString();');
    lines.push('      ');
    lines.push('      this.httpRequestsTotal.inc({ method, endpoint: route, status });');
    lines.push('      this.httpRequestDuration.observe({ method, endpoint: route }, duration);');
    lines.push('    });');
    lines.push('    ');
    lines.push('    next();');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push('@Module({');
    lines.push('  providers: [AnalyticsMiddleware],');
    lines.push('  exports: [AnalyticsMiddleware],');
    lines.push('})');
    lines.push('export class AnalyticsModule {}');
  } else if (config.provider === 'custom') {
    lines.push('interface AnalyticsEvent {');
    lines.push('  timestamp: Date;');
    lines.push('  path: string;');
    lines.push('  method: string;');
    lines.push('  status: number;');
    lines.push('  duration: number;');
    lines.push('  userAgent?: string;');
    lines.push('}');
    lines.push('');
    lines.push('@Injectable()');
    lines.push('export class AnalyticsService {');
    lines.push('  private events: AnalyticsEvent[] = [];');
    lines.push('  private readonly maxEvents = 10000;');
    lines.push('');
    lines.push('  record(event: AnalyticsEvent): void {');
    lines.push('    this.events.push(event);');
    lines.push('    if (this.events.length > this.maxEvents) {');
    lines.push('      this.events.shift();');
    lines.push('    }');
    lines.push('  }');
    lines.push('  ');
    lines.push('  getStats() {');
    lines.push('    if (this.events.length === 0) {');
    lines.push('      return { totalRequests: 0 };');
    lines.push('    }');
    lines.push('    ');
    lines.push('    const totalDuration = this.events.reduce((sum, e) => sum + e.duration, 0);');
    lines.push('    const successCount = this.events.filter(e => e.status < 400).length;');
    lines.push('    ');
    lines.push('    const byMethod = this.events.reduce((acc, e) => {');
    lines.push('      acc[e.method] = (acc[e.method] || 0) + 1;');
    lines.push('      return acc;');
    lines.push('    }, {} as Record<string, number>);');
    lines.push('    ');
    lines.push('    return {');
    lines.push('      totalRequests: this.events.length,');
    lines.push('      averageResponseTime: totalDuration / this.events.length,');
    lines.push('      successRate: (successCount / this.events.length) * 100,');
    lines.push('      requestsByMethod: byMethod,');
    lines.push('    };');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push('@Injectable()');
    lines.push('export class AnalyticsMiddleware implements NestMiddleware {');
    lines.push('  constructor(private readonly analyticsService: AnalyticsService) {}');
    lines.push('');
    lines.push('  use(req: Request, res: Response, next: NextFunction): void {');
    lines.push('    const start = Date.now();');
    lines.push('    ');
    lines.push('    res.on("finish", () => {');
    lines.push('      this.analyticsService.record({');
    lines.push('        timestamp: new Date(),');
    lines.push('        path: req.path,');
    lines.push('        method: req.method,');
    lines.push('        status: res.statusCode,');
    lines.push('        duration: Date.now() - start,');
    lines.push('        userAgent: req.get("user-agent"),');
    lines.push('      });');
    lines.push('    });');
    lines.push('    ');
    lines.push('    next();');
    lines.push('  }');
    lines.push('}');
  }

  return lines.join('\n');
}

// Generate Fastify analytics middleware
export function generateFastifyAnalytics(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push("import fp from 'fastify-plugin';");
  lines.push("import promClient from 'prom-client';");
  lines.push('');

  if (config.provider === 'prometheus') {
    lines.push('export default fp(async (fastify, opts) => {');
    lines.push('  const register = new promClient.Registry();');
    lines.push('  ');
    lines.push('  promClient.collectDefaultMetrics({ register });');
    lines.push('  ');
    lines.push('  const httpRequestsTotal = new promClient.Counter({');
    lines.push('    name: "http_requests_total",');
    lines.push('    help: "Total number of HTTP requests",');
    lines.push('    labelNames: ["method", "route", "status"],');
    lines.push('    registers: [register],');
    lines.push('  });');
    lines.push('  ');
    lines.push('  const httpRequestDuration = new promClient.Histogram({');
    lines.push('    name: "http_request_duration_seconds",');
    lines.push('    help: "HTTP request duration in seconds",');
    lines.push('    labelNames: ["method", "route"],');
    lines.push('    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],');
    lines.push('    registers: [register],');
    lines.push('  });');
    lines.push('  ');
    lines.push('  fastify.addHook("onRequest", async (request, reply) => {');
    lines.push('    request.startTime = Date.now();');
    lines.push('  });');
    lines.push('  ');
    lines.push('  fastify.addHook("onResponse", async (request, reply) => {');
    lines.push('    const duration = (Date.now() - (request.startTime as number)) / 1000;');
    lines.push('    const route = (request.routeConfig as any)?.url || request.routerPath;');
    lines.push('    const method = request.method;');
    lines.push('    const status = reply.statusCode;');
    lines.push('    ');
    lines.push('    httpRequestsTotal.inc({ method, route, status });');
    lines.push('    httpRequestDuration.observe({ method, route }, duration);');
    lines.push('  });');
    lines.push('  ');
    lines.push('  fastify.get("/metrics", async (request, reply) => {');
    lines.push('    reply.type(register.contentType);');
    lines.push('    return await register.metrics();');
    lines.push('  });');
    lines.push('});');
  } else if (config.provider === 'custom') {
    lines.push('interface AnalyticsEvent {');
    lines.push('  timestamp: Date;');
    lines.push('  path: string;');
    lines.push('  method: string;');
    lines.push('  status: number;');
    lines.push('  duration: number;');
    lines.push('  userAgent?: string;');
    lines.push('}');
    lines.push('');
    lines.push('const events: AnalyticsEvent[] = [];');
    lines.push('const MAX_EVENTS = 10000;');
    lines.push('');
    lines.push('export default fp(async (fastify, opts) => {');
    lines.push('  fastify.addHook("onRequest", async (request, reply) => {');
    lines.push('    request.startTime = Date.now();');
    lines.push('  });');
    lines.push('  ');
    lines.push('  fastify.addHook("onResponse", async (request, reply) => {');
    lines.push('    const event: AnalyticsEvent = {');
    lines.push('      timestamp: new Date(),');
    lines.push('      path: request.url,');
    lines.push('      method: request.method,');
    lines.push('      status: reply.statusCode,');
    lines.push('      duration: Date.now() - (request.startTime as number),');
    lines.push('      userAgent: request.headers["user-agent"],');
    lines.push('    };');
    lines.push('    ');
    lines.push('    events.push(event);');
    lines.push('    while (events.length > MAX_EVENTS) {');
    lines.push('      events.shift();');
    lines.push('    }');
    lines.push('  });');
    lines.push('  ');
    lines.push('  fastify.get("/analytics", async (request, reply) => {');
    lines.push('    if (events.length === 0) {');
    lines.push('      return { totalRequests: 0 };');
    lines.push('    }');
    lines.push('    ');
    lines.push('    const totalDuration = events.reduce((sum, e) => sum + e.duration, 0);');
    lines.push('    const successCount = events.filter(e => e.status < 400).length;');
    lines.push('    ');
    lines.push('    const byMethod = events.reduce((acc, e) => {');
    lines.push('      acc[e.method] = (acc[e.method] || 0) + 1;');
    lines.push('      return acc;');
    lines.push('    }, {} as Record<string, number>);');
    lines.push('    ');
    lines.push('    return {');
    lines.push('      totalRequests: events.length,');
    lines.push('      averageResponseTime: totalDuration / events.length,');
    lines.push('      successRate: (successCount / events.length) * 100,');
    lines.push('      requestsByMethod: byMethod,');
    lines.push('    };');
    lines.push('  });');
    lines.push('});');
  }

  return lines.join('\n');
}

// Generate Prometheus config file
export function generatePrometheusConfig(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push('# Prometheus Configuration');
  lines.push('global:');
  lines.push('  scrape_interval: 15s');
  lines.push('  evaluation_interval: 15s');
  lines.push('');
  lines.push('alerting:');
  lines.push('  alertmanagers:');
  lines.push('    - static_configs:');
  lines.push('        - targets: []');
  lines.push('');
  lines.push('rule_files:');
  if (config.alerts && config.alerts.length > 0) {
    lines.push("  - 'alerts.yml'");
  }
  lines.push('');
  lines.push('scrape_configs:');
  lines.push('  # Scrape Prometheus itself');
  lines.push('  - job_name: "prometheus"');
  lines.push('    static_configs:');
  lines.push('      - targets: ["localhost:9090"]');
  lines.push('');
  lines.push('  # Scrape your application');
  lines.push('  - job_name: "' + config.name + '"');
  lines.push('    metrics_path: "/metrics"');
  lines.push('    static_configs:');
  lines.push('      - targets: ["localhost:3000"]');

  return lines.join('\n');
}

// Generate Grafana dashboard JSON
export function generateGrafanaDashboard(config: AnalyticsConfig): string {
  const dashboard = {
    dashboard: {
      title: config.name + ' Analytics',
      panels: [
        {
          title: 'Total Requests',
          targets: [{ expr: 'rate(http_requests_total[1m]) * 60' }],
          type: 'graph',
        },
        {
          title: 'Request Duration',
          targets: [{ expr: 'rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])' }],
          type: 'graph',
        },
        {
          title: 'Error Rate',
          targets: [{ expr: 'rate(http_requests_total{status=~"5.."}[5m])' }],
          type: 'graph',
        },
      ],
    },
  };

  return JSON.stringify(dashboard, null, 2);
}

// Generate alert rules for Prometheus
export function generateAlertRules(config: AnalyticsConfig): string {
  const lines: string[] = [];

  lines.push('# Alert rules for ' + config.name);
  lines.push('groups:');
  lines.push('  - name: ' + config.name);
  lines.push('    interval: 30s');
  lines.push('    rules:');

  if (config.alerts && config.alerts.length > 0) {
    config.alerts.forEach(alert => {
      lines.push('      - alert: ' + alert.name);
      lines.push('        expr: ' + alert.condition);
      lines.push('        for: ' + alert.window);
      lines.push('        labels:');
      lines.push('          severity: warning');
      lines.push('        annotations:');
      lines.push('          summary: "Alert triggered for ' + alert.name + '"');
      lines.push('          description: "{{ $value }} exceeds threshold of ' + alert.threshold + '"');
    });
  } else {
    // Default alerts
    lines.push('      - alert: HighErrorRate');
    lines.push('        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05');
    lines.push('        for: 5m');
    lines.push('        labels:');
    lines.push('          severity: critical');
    lines.push('        annotations:');
    lines.push('          summary: "High error rate detected"');
    lines.push('          description: "Error rate is {{ $value | humanizePercentage }}"');
    lines.push('');
    lines.push('      - alert: HighResponseTime');
    lines.push('        expr: rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m]) > 1');
    lines.push('        for: 5m');
    lines.push('        labels:');
    lines.push('          severity: warning');
    lines.push('        annotations:');
    lines.push('          summary: "High response time detected"');
    lines.push('          description: "Average response time is {{ $value }}s"');
  }

  return lines.join('\n');
}

// Generate analytics middleware based on framework and provider
export function generateAnalyticsMiddleware(config: AnalyticsConfig): string {
  const { framework, provider } = config;

  if (provider === 'prometheus') {
    switch (framework) {
      case 'express':
        return generateExpressAnalytics(config);
      case 'nestjs':
        return generateNestJSAnalytics(config);
      case 'fastify':
        return generateFastifyAnalytics(config);
      case 'fastapi':
        return generateFastAPIAnalytics(config);
      case 'django':
        return generateDjangoAnalytics(config);
      case 'aspnet-core':
        return generateAspNetCoreAnalytics(config);
      case 'spring-boot':
        return generateSpringBootAnalytics(config);
      case 'gin':
        return generateGinAnalytics(config);
      case 'axum':
        return generateAxumAnalytics(config);
      default:
        return generateExpressAnalytics(config);
    }
  }

  // For custom provider, use framework-specific custom implementation
  switch (framework) {
    case 'express':
      return generateExpressAnalytics(config);
    case 'nestjs':
      return generateNestJSAnalytics(config);
    case 'fastify':
      return generateFastifyAnalytics(config);
    case 'fastapi':
      return generateFastAPIAnalytics(config);
    case 'django':
      return generateDjangoAnalytics(config);
    case 'aspnet-core':
      return generateAspNetCoreAnalytics(config);
    case 'spring-boot':
      return generateSpringBootAnalytics(config);
    case 'gin':
      return generateGinAnalytics(config);
    case 'axum':
      return generateAxumAnalytics(config);
    default:
      return generateExpressAnalytics(config);
  }
}

// Generate docker-compose for analytics stack
export function generateAnalyticsDockerCompose(provider: AnalyticsProvider): string {
  const templates: Record<AnalyticsProvider, string> = {
    prometheus: `version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  prometheus-data:
  grafana-data:
`,
    datadog: `# Datadog requires agent installation
# Follow: https://docs.datadoghq.com/agent/
`,
    newrelic: `# New Relic requires agent setup
# Follow: https://docs.newrelic.com/docs/apm/agents/
`,
    grafana: `version: '3.8'
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_INSTALL_PLUGINS: grafana-prometheus-datasource
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana-dashboard.json:/etc/grafana/provisioning/dashboards/dashboard.json

volumes:
  grafana-data:
`,
    'elastic-apm': `version: '3.8'
services:
  apm-server:
    image: docker.elastic.co/apm/apm-server:8.11.0
    ports:
      - "8200:8200"
    command: apm-server -e -E apm-server.rum.enabled=true

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
`,
    cloudwatch: `# AWS CloudWatch requires AWS credentials and region setup
# Use AWS CloudWatch Agent
`,
    'open-telemetry': `version: '3.8'
services:
  otel-collector:
    image: otel/opentelemetry-collector:latest
    ports:
      - "4317:4317"
      - "4318:4318"
    volumes:
      - ./otel-collector.yml:/etc/otelcol/config.yml
    command: ["--config=/etc/otelcol/config.yml"]
`,
    custom: `# Custom analytics implementation
# No external services required
`,
  };

  return templates[provider];
}

// List all supported analytics providers
export function listAnalyticsProviders(): Array<{ provider: AnalyticsProvider; description: string; docs: string }> {
  const providers: AnalyticsProvider[] = [
    'prometheus',
    'datadog',
    'newrelic',
    'grafana',
    'elastic-apm',
    'cloudwatch',
    'open-telemetry',
    'custom',
  ];

  return providers.map(p => {
    const template = getAnalyticsProvider(p);
    return {
      provider: p,
      description: template?.description || p,
      docs: template?.docsUrl || '',
    };
  });
}

// List all supported backend frameworks
export function listSupportedFrameworks(): BackendFramework[] {
  return ['express', 'nestjs', 'fastify', 'fastapi', 'django', 'aspnet-core', 'spring-boot', 'gin', 'axum'];
}

// Generate complete analytics setup
export function generateAnalyticsSetup(config: AnalyticsConfig): {
  middleware: string;
  prometheusConfig?: string;
  grafanaDashboard?: string;
  alertRules?: string;
  dockerCompose?: string;
} {
  const result: {
    middleware: string;
    prometheusConfig?: string;
    grafanaDashboard?: string;
    alertRules?: string;
    dockerCompose?: string;
  } = {
    middleware: generateAnalyticsMiddleware(config),
  };

  if (config.provider === 'prometheus') {
    result.prometheusConfig = generatePrometheusConfig(config);
    result.dockerCompose = generateAnalyticsDockerCompose('prometheus');
    if (config.dashboard) {
      result.grafanaDashboard = generateGrafanaDashboard(config);
    }
    if (config.alerts && config.alerts.length > 0) {
      result.alertRules = generateAlertRules(config);
    }
  } else if (config.provider === 'grafana') {
    result.dockerCompose = generateAnalyticsDockerCompose('grafana');
    if (config.dashboard) {
      result.grafanaDashboard = generateGrafanaDashboard(config);
    }
  } else {
    result.dockerCompose = generateAnalyticsDockerCompose(config.provider);
  }

  return result;
}
