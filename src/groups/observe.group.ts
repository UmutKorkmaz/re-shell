import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { withTimeout } from '../utils/error-handler';
import chalk from 'chalk';

export function registerObserveGroup(program: Command): void {
  const observe = new Command('observe')
    .description('Metrics, tracing, logging, and performance monitoring');

  // prometheus-grafana → observe metrics
  observe
    .command('metrics')
    .description('Generate Prometheus/Grafana integration with auto-configuration and custom dashboards')
    .argument('<name>', 'Project name')
    .option('--enable-aws', 'Enable AWS', true)
    .option('--enable-azure', 'Enable Azure', true)
    .option('--enable-gcp', 'Enable GCP', true)
    .option('--enable-prometheus', 'Enable Prometheus', true)
    .option('--enable-grafana', 'Enable Grafana', true)
    .option('--retention-days <days>', 'Data retention days', '15')
    .option('--scrape-interval <interval>', 'Scrape interval', '15s')
    .option('--evaluation-interval <interval>', 'Evaluation interval', '15s')
    .option('--enable-overview', 'Enable overview dashboard', true)
    .option('--enable-performance', 'Enable performance dashboard', true)
    .option('--enable-infrastructure', 'Enable infrastructure dashboard', true)
    .option('--enable-application', 'Enable application dashboard', true)
    .option('--enable-alerts', 'Enable alerting', true)
    .option('--enable-recording-rules', 'Enable recording rules', false)
    .option('--webhook-url <url>', 'Alert webhook URL', '')
    .option('--anonymous-access', 'Enable anonymous Grafana access', false)
    .option('--output <dir>', 'Output directory', './prometheus-grafana')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/prometheus-grafana.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const dashboards: ('overview' | 'performance' | 'infrastructure' | 'application' | 'custom')[] = [];
      if (options.enableOverview) dashboards.push('overview');
      if (options.enablePerformance) dashboards.push('performance');
      if (options.enableInfrastructure) dashboards.push('infrastructure');
      if (options.enableApplication) dashboards.push('application');

      const config = {
        projectName: name,
        providers,
        prometheus: {
          enabled: options.enablePrometheus,
          retentionDays: parseInt(options.retentionDays),
          scrapeInterval: options.scrapeInterval,
          evaluationInterval: options.evaluationInterval,
          externalLabels: {
            cluster: name,
            environment: 'production',
          },
          globalScrapeConfigs: [
            {
              jobName: name + '-nodes',
              targets: ['localhost:9100'],
              scrapeInterval: options.scrapeInterval,
              metricsPath: '/metrics',
            },
          ],
        },
        grafana: {
          enabled: options.enableGrafana,
          adminPassword: 'admin123',
          anonymousAccess: options.anonymousAccess,
          dashboards,
          datasources: [
            { name: 'Prometheus', type: 'prometheus', url: 'http://localhost:9090', access: 'proxy' as 'proxy' | 'direct' },
          ],
          alerts: {
            enabled: options.enableAlerts,
            webhookUrl: options.webhookUrl || undefined,
          },
        },
        metrics: [
          { name: 'http_requests_total', type: 'counter' as 'counter' | 'gauge' | 'histogram' | 'summary', help: 'Total HTTP requests', labels: ['method', 'endpoint', 'status'] },
          { name: 'request_duration_seconds', type: 'histogram' as 'counter' | 'gauge' | 'histogram' | 'summary', help: 'Request duration', labels: [], buckets: [0.1, 0.5, 1, 2, 5] },
          { name: 'active_connections', type: 'gauge' as 'counter' | 'gauge' | 'histogram' | 'summary', help: 'Active connections', labels: [] },
        ],
        alerts: [
          {
            name: 'HighErrorRate',
            expr: 'rate(http_requests_total{status=~"5.."}[5m]) > 0.05',
            for: '5m',
            labels: { severity: 'critical', team: 'ops' },
            annotations: { summary: 'High error rate detected', description: 'Error rate is above 5%' },
          },
          {
            name: 'HighLatency',
            expr: 'histogram_quantile(0.95, request_duration_seconds) > 1',
            for: '5m',
            labels: { severity: 'warning', team: 'ops' },
            annotations: { summary: 'High latency detected', description: 'P95 latency is above 1s' },
          },
        ],
        enableRecordingRules: options.enableRecordingRules,
        enableAlerting: options.enableAlerts,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating Prometheus/Grafana configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: monitoring.tf`));
        console.log(chalk.green(`✅ Generated: prometheus-grafana-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: PROMETHEUS_GRAFANA.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: monitoring-config.json\n`));

        console.log(chalk.green('✓ Prometheus/Grafana configuration generated successfully!'));
      }, 30000);
    }));

  // distributed-tracing → observe trace
  observe
    .command('trace')
    .description('Generate distributed tracing with Jaeger/Zipkin across all services with performance insights')
    .argument('<name>', 'Project name')
    .option('--enable-aws', 'Enable AWS', true)
    .option('--enable-azure', 'Enable Azure', true)
    .option('--enable-gcp', 'Enable GCP', true)
    .option('--backend <backend>', 'Tracing backend (jaeger|zipkin|tempo|xray)', 'jaeger')
    .option('--sampling-rate <rate>', 'Sampling rate (0.0-1.0)', '0.1')
    .option('--enable-profiling', 'Enable profiling', false)
    .option('--enable-logging', 'Enable trace logging', true)
    .option('--enable-metrics', 'Enable trace metrics', true)
    .option('--output <dir>', 'Output directory', './distributed-tracing')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/distributed-tracing.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const config = {
        projectName: name,
        providers,
        trace: {
          enabled: true,
          backend: options.backend as ('jaeger' | 'zipkin' | 'tempo' | 'xray'),
          samplingRate: parseFloat(options.samplingRate),
          maxPathLength: 100,
          debugEnabled: false,
        },
        services: [
          { name: name + '-api', protocol: 'http' as 'http' | 'grpc' | 'thrift', endpoint: 'api.' + name + '.com', port: 8080, traced: true },
          { name: name + '-auth', protocol: 'grpc' as 'http' | 'grpc' | 'thrift', endpoint: 'auth.' + name + '.com', port: 9090, traced: true },
          { name: name + '-db', protocol: 'grpc' as 'http' | 'grpc' | 'thrift', endpoint: 'db.' + name + '.com', port: 5432, traced: true },
        ],
        spans: [],
        insights: [
          { operationName: 'GET /api/users', avgDuration: 45, p95Duration: 89, p99Duration: 156, errorRate: 0.01, throughput: 1000 },
          { operationName: 'POST /api/auth', avgDuration: 120, p95Duration: 234, p99Duration: 412, errorRate: 0.02, throughput: 500 },
        ],
        enableProfiling: options.enableProfiling,
        enableLogging: options.enableLogging,
        enableMetrics: options.enableMetrics,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating distributed tracing configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: distributed-tracing.tf`));
        console.log(chalk.green(`✅ Generated: distributed-tracing-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: DISTRIBUTED_TRACING.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: tracing-config.json\n`));

        console.log(chalk.green('✓ Distributed tracing configuration generated successfully!'));
      }, 30000);
    }));

  // log-aggregation → observe logs
  observe
    .command('logs')
    .description('Generate log aggregation with ELK/EFK stack and structured logging')
    .argument('<name>', 'Name of the log aggregation setup')
    .option('-b, --backend <backend>', 'Log backend (elk, efk, fluentd, cloudwatch, azure-log)', 'elk')
    .option('-f, --format <format>', 'Log format (json, text, cef, syslog)', 'json')
    .option('-l, --level <level>', 'Log level (debug, info, warn, error, fatal)', 'info')
    .option('--retention-days <days>', 'Log retention in days', '7')
    .option('--enable-alerting', 'Enable log-based alerting')
    .option('--enable-metrics', 'Enable log metrics collection')
    .option('--enable-aws', 'Enable AWS CloudWatch integration')
    .option('--enable-azure', 'Enable Azure Monitor integration')
    .option('--enable-gcp', 'Enable GCP Cloud Logging integration')
    .option('--output <dir>', 'Output directory', './log-aggregation')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/log-aggregation.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const config = {
        projectName: name,
        providers,
        log: {
          enabled: true,
          backend: options.backend as ('elk' | 'efk' | 'fluentd' | 'cloudwatch' | 'azure-log'),
          format: options.format as ('json' | 'text' | 'cef' | 'syslog'),
          level: options.level as ('debug' | 'info' | 'warn' | 'error' | 'fatal'),
          retentionDays: parseInt(options.retentionDays),
          maxFileSize: 100,
          bufferSize: 1000,
          flushInterval: 5,
        },
        elasticsearch: {
          host: 'localhost',
          port: 9200,
          username: 'elastic',
          password: 'changeme',
          indexPrefix: name.toLowerCase(),
          shards: 3,
          replicas: 1,
        },
        logstash: {
          host: 'localhost',
          port: 5044,
          pipelines: ['main', 'syslog', 'application'],
        },
        kibana: {
          enabled: true,
          host: 'localhost',
          port: 5601,
          dashboards: ['overview', 'logs', 'metrics'],
        },
        fluentd: {
          host: 'localhost',
          port: 24224,
          parsers: ['json', 'regex', 'apache', 'nginx'],
          buffers: [{ path: '/var/log/fluent/buffers', size: '100m' }],
        },
        parsers: [
          { name: 'json', pattern: '^(?<time>.+) (?<level>.+) (?<message>.+)$', fields: { time: 'timestamp', level: 'log_level', message: 'msg' }, timestampField: 'time', timestampFormat: '%Y-%m-%d %H:%M:%S' },
          { name: 'syslog', pattern: '^(?<timestamp>.+) (?<host>.+) (?<process>.+): (?<message>.+)$', fields: { timestamp: '@timestamp', host: 'hostname', process: 'application', message: 'log' }, timestampField: 'timestamp', timestampFormat: '%b %d %H:%M:%S' },
        ],
        filters: [
          { name: 'drop-debug', condition: 'level == "debug"', actions: [{ type: 'drop', params: {} }] },
          { name: 'enrich-host', condition: 'true', actions: [{ type: 'add_field', params: { field: 'environment', value: 'production' } }] },
        ],
        enableAlerting: options.enableAlerting || false,
        enableMetrics: options.enableMetrics || false,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating log aggregation configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: log-aggregation.tf`));
        console.log(chalk.green(`✅ Generated: log-aggregation-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: LOG_AGGREGATION.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: log-aggregation-config.json\n`));

        console.log(chalk.green('✓ Log aggregation configuration generated successfully!'));
      }, 30000);
    }));

  // apm-integration → observe apm
  observe
    .command('apm')
    .description('Generate Application Performance Monitoring (APM) with AI-powered insights')
    .argument('<name>', 'Name of the APM setup')
    .option('-b, --backend <backend>', 'APM backend (datadog, newrelic, dynatrace, appdynamics, elastic-apm)', 'datadog')
    .option('-e, --environment <env>', 'Environment (dev, staging, production)', 'production')
    .option('--profiling-mode <mode>', 'Profiling mode (continuous, on-demand, sampling)', 'sampling')
    .option('--sample-rate <rate>', 'Sample rate (0.0-1.0)', '0.1')
    .option('--enable-distributed-tracing', 'Enable distributed tracing integration')
    .option('--enable-error-tracking', 'Enable error tracking')
    .option('--enable-security-monitoring', 'Enable security monitoring')
    .option('--enable-profiling', 'Enable code profiling')
    .option('--enable-aws', 'Enable AWS integration')
    .option('--enable-azure', 'Enable Azure integration')
    .option('--enable-gcp', 'Enable GCP integration')
    .option('--output <dir>', 'Output directory', './apm-integration')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/apm-integration.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const config = {
        projectName: name,
        providers,
        apm: {
          enabled: true,
          backend: options.backend as ('datadog' | 'newrelic' | 'dynatrace' | 'appdynamics' | 'elastic-apm'),
          apiKey: 'YOUR_API_KEY',
          environment: options.environment,
          serviceUrl: 'https://' + options.backend + '.com',
          profilingMode: options.profilingMode as ('continuous' | 'on-demand' | 'sampling'),
          sampleRate: parseFloat(options.sampleRate),
        },
        metrics: [
          { name: 'response_time', type: 'histogram' as const, enabled: true, aggregation: 'percentile' as const },
          { name: 'throughput', type: 'counter' as const, enabled: true, aggregation: 'sum' as const },
          { name: 'error_rate', type: 'gauge' as const, enabled: true, aggregation: 'avg' as const },
          { name: 'cpu_usage', type: 'gauge' as const, enabled: true, aggregation: 'avg' as const },
          { name: 'memory_usage', type: 'gauge' as const, enabled: true, aggregation: 'avg' as const },
        ],
        alerts: [
          { name: 'HighResponseTime', condition: 'response_time_p95 > 1000', threshold: 1000, duration: 300, severity: 'warning' as const },
          { name: 'HighErrorRate', condition: 'error_rate > 0.05', threshold: 0.05, duration: 60, severity: 'critical' as const },
          { name: 'LowThroughput', condition: 'throughput < 100', threshold: 100, duration: 300, severity: 'info' as const },
        ],
        aiInsights: [
          { type: 'performance' as const, enabled: true, confidence: 0.9, recommendations: ['Optimize database queries', 'Enable caching'], relatedMetrics: ['response_time', 'throughput'] },
          { type: 'error' as const, enabled: true, confidence: 0.85, recommendations: ['Add retry logic', 'Implement circuit breaker'], relatedMetrics: ['error_rate'] },
          { type: 'security' as const, enabled: true, confidence: 0.95, recommendations: ['Update dependencies', 'Add rate limiting'], relatedMetrics: ['error_rate', 'response_time'] },
          { type: 'business' as const, enabled: true, confidence: 0.88, recommendations: ['Optimize conversion funnel', 'Improve user experience'], relatedMetrics: ['throughput'] },
        ],
        enableDistributedTracing: options.enableDistributedTracing || false,
        enableErrorTracking: options.enableErrorTracking || false,
        enableSecurityMonitoring: options.enableSecurityMonitoring || false,
        enableProfiling: options.enableProfiling || false,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating APM integration configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: apm-integration.tf`));
        console.log(chalk.green(`✅ Generated: apm-integration-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: APM_INTEGRATION.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: apm-config.json\n`));

        console.log(chalk.green('✓ APM integration configuration generated successfully!'));
      }, 30000);
    }));

  // business-metrics → observe business
  observe
    .command('business')
    .description('Generate business metrics and KPI tracking with real-time dashboards')
    .argument('<name>', 'Name of the business metrics setup')
    .option('-d, --dashboard <dashboard>', 'Dashboard provider (grafana, kibana, datadog, cloudwatch, custom)', 'grafana')
    .option('--refresh-interval <seconds>', 'Dashboard refresh interval in seconds', '30')
    .option('--enable-real-time', 'Enable real-time metric collection')
    .option('--enable-alerting', 'Enable KPI-based alerting')
    .option('--enable-reporting', 'Enable automated reporting')
    .option('--enable-aws', 'Enable AWS integration')
    .option('--enable-azure', 'Enable Azure integration')
    .option('--enable-gcp', 'Enable GCP integration')
    .option('--output <dir>', 'Output directory', './business-metrics')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/business-metrics.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const config = {
        projectName: name,
        providers,
        metrics: [
          { name: 'revenue_total', type: 'counter' as const, category: 'revenue' as const, description: 'Total revenue generated', aggregation: 'sum' as const, unit: 'USD', tags: ['business', 'finance'] },
          { name: 'users_active', type: 'gauge' as const, category: 'user' as const, description: 'Number of active users', aggregation: 'count' as const, unit: 'count', tags: ['business', 'user'] },
          { name: 'conversion_rate', type: 'gauge' as const, category: 'engagement' as const, description: 'User conversion rate percentage', aggregation: 'avg' as const, unit: '%', tags: ['business', 'engagement'] },
          { name: 'session_duration', type: 'histogram' as const, category: 'engagement' as const, description: 'User session duration in seconds', aggregation: 'percentile' as const, unit: 'seconds', tags: ['business', 'engagement'] },
          { name: 'page_views', type: 'counter' as const, category: 'engagement' as const, description: 'Total page views', aggregation: 'sum' as const, unit: 'count', tags: ['business', 'engagement'] },
          { name: 'response_time_p95', type: 'gauge' as const, category: 'performance' as const, description: '95th percentile response time', aggregation: 'percentile' as const, unit: 'ms', tags: ['performance', 'latency'] },
        ],
        kpis: [
          { name: 'Monthly Recurring Revenue', metric: 'revenue_total', target: 100000, warningThreshold: 80000, criticalThreshold: 60000, timeWindow: '30d', calculation: 'sum' },
          { name: 'Daily Active Users', metric: 'users_active', target: 10000, warningThreshold: 8000, criticalThreshold: 5000, timeWindow: '1d', calculation: 'count' },
          { name: 'Conversion Rate', metric: 'conversion_rate', target: 5.0, warningThreshold: 3.0, criticalThreshold: 2.0, timeWindow: '7d', calculation: 'avg' },
          { name: 'Average Session Duration', metric: 'session_duration', target: 300, warningThreshold: 180, criticalThreshold: 120, timeWindow: '1d', calculation: 'avg' },
          { name: 'P95 Response Time', metric: 'response_time_p95', target: 500, warningThreshold: 800, criticalThreshold: 1200, timeWindow: '5m', calculation: 'percentile(95)' },
        ],
        dashboard: {
          provider: options.dashboard as ('grafana' | 'kibana' | 'datadog' | 'cloudwatch' | 'custom'),
          url: 'http://localhost:3000',
          refreshInterval: parseInt(options.refreshInterval),
          enabled: true,
        },
        enableRealTime: options.enableRealTime || false,
        enableAlerting: options.enableAlerting || false,
        enableReporting: options.enableReporting || false,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating business metrics configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: business-metrics.tf`));
        console.log(chalk.green(`✅ Generated: business-metrics-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: BUSINESS_METRICS.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: business-metrics-config.json\n`));

        console.log(chalk.green('✓ Business metrics configuration generated successfully!'));
      }, 30000);
    }));

  // anomaly-detection → observe anomaly
  observe
    .command('anomaly')
    .description('Generate anomaly detection with machine learning and automated response')
    .argument('<name>', 'Name of the anomaly detection setup')
    .option('-a, --algorithm <algorithm>', 'ML algorithm (isolation-forest, autoencoder, lstm, prophet, arima)', 'isolation-forest')
    .option('--sensitivity <sensitivity>', 'Detection sensitivity (0.0-1.0)', '0.8')
    .option('--training-window <window>', 'Training data time window', '7d')
    .option('--detection-interval <seconds>', 'Detection interval in seconds', '60')
    .option('--enable-auto-response', 'Enable automated response actions')
    .option('--enable-retraining', 'Enable continuous model retraining')
    .option('--enable-explainability', 'Enable model explainability')
    .option('--enable-aws', 'Enable AWS integration')
    .option('--enable-azure', 'Enable Azure integration')
    .option('--enable-gcp', 'Enable GCP integration')
    .option('--output <dir>', 'Output directory', './anomaly-detection')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/anomaly-detection.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const config = {
        projectName: name,
        providers,
        anomaly: {
          enabled: true,
          algorithm: options.algorithm as ('isolation-forest' | 'autoencoder' | 'lstm' | 'prophet' | 'arima'),
          sensitivity: parseFloat(options.sensitivity),
          trainingWindow: options.trainingWindow,
          detectionInterval: parseInt(options.detectionInterval),
          threshold: 0.95,
        },
        patterns: [
          { name: 'spike_detection', pattern: 'sudden increase in metrics', metrics: ['cpu_usage', 'memory_usage', 'request_rate'], conditions: { threshold: 2.0, window: '5m' } },
          { name: 'drop_detection', pattern: 'sudden decrease in metrics', metrics: ['throughput', 'success_rate'], conditions: { threshold: 0.5, window: '5m' } },
          { name: 'trend_change', pattern: 'gradual metric change', metrics: ['response_time', 'error_rate'], conditions: { threshold: 1.5, window: '1h' } },
        ],
        alerts: [
          { name: 'HighCPUAnomaly', condition: 'cpu_usage_anomaly > 0.9', severity: 'high' as const, channels: ['slack', 'email'] },
          { name: 'MemoryLeakDetected', condition: 'memory_usage_trend > increasing', severity: 'medium' as const, channels: ['slack'] },
          { name: 'TrafficSpike', condition: 'request_rate_anomaly > 0.95', severity: 'critical' as const, channels: ['pagerduty', 'slack', 'email'] },
        ],
        responses: [
          { trigger: 'HighCPUAnomaly', actions: [{ type: 'scale-up' as const, params: { service: 'api', increment: 1 } }], cooldown: 300 },
          { trigger: 'MemoryLeakDetected', actions: [{ type: 'restart' as const, params: { service: 'worker' } }], cooldown: 600 },
          { trigger: 'TrafficSpike', actions: [{ type: 'scale-up' as const, params: { service: 'api', increment: 2 } }, { type: 'alert' as const, params: { channel: 'slack' } }], cooldown: 180 },
        ],
        enableAutoResponse: options.enableAutoResponse || false,
        enableRetraining: options.enableRetraining || false,
        enableExplainability: options.enableExplainability || false,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating anomaly detection configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: anomaly-detection.tf`));
        console.log(chalk.green(`✅ Generated: anomaly-detection-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: ANOMALY_DETECTION.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: anomaly-detection-config.json\n`));

        console.log(chalk.green('✓ Anomaly detection configuration generated successfully!'));
      }, 30000);
    }));

  // predictive-scaling → observe scale
  observe
    .command('scale')
    .description('Generate predictive scaling and capacity planning with cost optimization')
    .argument('<name>', 'Name of the predictive scaling setup')
    .option('-m, --model <model>', 'Prediction model (arima, prophet, lstm, xgboost, linear-regression)', 'prophet')
    .option('--lookback <window>', 'Historical data lookback window', '30d')
    .option('--forecast <horizon>', 'Forecast horizon', '7d')
    .option('--accuracy <target>', 'Accuracy target (0.0-1.0)', '0.9')
    .option('--target-savings <savings>', 'Cost optimization target savings (0.0-1.0)', '0.3')
    .option('--enable-budget-alerts', 'Enable budget alerts')
    .option('--enable-resource-optimization', 'Enable resource optimization')
    .option('--enable-aws', 'Enable AWS integration')
    .option('--enable-azure', 'Enable Azure integration')
    .option('--enable-gcp', 'Enable GCP integration')
    .option('--output <dir>', 'Output directory', './predictive-scaling')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/predictive-scaling.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const config = {
        projectName: name,
        providers,
        prediction: {
          enabled: true,
          model: options.model as ('arima' | 'prophet' | 'lstm' | 'xgboost' | 'linear-regression'),
          lookbackWindow: options.lookback,
          forecastHorizon: options.forecast,
          accuracyTarget: parseFloat(options.accuracy),
        },
        capacity: [
          { resource: 'compute' as const, min: 2, max: 10, current: 4, target: 6, unit: 'instances' },
          { resource: 'database' as const, min: 1, max: 5, current: 2, target: 3, unit: 'instances' },
          { resource: 'storage' as const, min: 100, max: 1000, current: 500, target: 700, unit: 'GB' },
          { resource: 'network' as const, min: 1, max: 10, current: 2, target: 5, unit: 'Gbps' },
        ],
        policies: [
          { name: 'cpu-based-scaling', resource: 'compute' as const, strategy: 'balanced' as const, scaleUpThreshold: 0.7, scaleDownThreshold: 0.3, cooldownPeriod: 300, predictionWeight: 0.8 },
          { name: 'memory-based-scaling', resource: 'database' as const, strategy: 'conservative' as const, scaleUpThreshold: 0.8, scaleDownThreshold: 0.4, cooldownPeriod: 600, predictionWeight: 0.7 },
          { name: 'storage-based-scaling', resource: 'storage' as const, strategy: 'aggressive' as const, scaleUpThreshold: 0.9, scaleDownThreshold: 0.5, cooldownPeriod: 900, predictionWeight: 0.6 },
        ],
        costOptimization: {
          enabled: true,
          targetSavings: parseFloat(options.targetSavings),
          preferredInstanceTypes: ['t3.medium', 't3.large', 'm5.large'],
          reservedInstances: true,
          spotInstances: true,
          rightSizing: true,
        },
        enableBudgetAlerts: options.enableBudgetAlerts || false,
        enableResourceOptimization: options.enableResourceOptimization || false,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating predictive scaling configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: predictive-scaling.tf`));
        console.log(chalk.green(`✅ Generated: predictive-scaling-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: PREDICTIVE_SCALING.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: predictive-scaling-config.json\n`));

        console.log(chalk.green('✓ Predictive scaling configuration generated successfully!'));
      }, 30000);
    }));

  // alert-management → observe alerts
  observe
    .command('alerts')
    .description('Generate custom alerting and incident management with escalation and automation')
    .argument('<name>', 'Name of the alert management setup')
    .option('--enable-auto-remediation', 'Enable automatic remediation actions')
    .option('--enable-incident-tracking', 'Enable incident tracking and management')
    .option('--enable-postmortem', 'Enable automatic postmortem generation')
    .option('--enable-aws', 'Enable AWS integration')
    .option('--enable-azure', 'Enable Azure integration')
    .option('--enable-gcp', 'Enable GCP integration')
    .option('--output <dir>', 'Output directory', './alert-management')
    .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
    .action(createAsyncCommand(async (name, options) => {
      const { writeFiles, displayConfig } = await import('../utils/alert-management.js');

      const providers: ('aws' | 'azure' | 'gcp')[] = [];
      if (options.enableAws) providers.push('aws');
      if (options.enableAzure) providers.push('azure');
      if (options.enableGcp) providers.push('gcp');

      const config = {
        projectName: name,
        providers,
        alerts: [
          { enabled: true, name: 'HighErrorRate', condition: 'error_rate > 0.05', severity: 'critical' as const, cooldown: 300, threshold: 0.05 },
          { enabled: true, name: 'HighLatency', condition: 'response_time_p95 > 1000', severity: 'warning' as const, cooldown: 600, threshold: 1000 },
          { enabled: true, name: 'ServiceDown', condition: 'up == 0', severity: 'emergency' as const, cooldown: 60, threshold: 0 },
          { enabled: true, name: 'DiskSpaceLow', condition: 'disk_usage > 0.9', severity: 'warning' as const, cooldown: 900, threshold: 0.9 },
        ],
        channels: [
          { name: 'ops-email', type: 'email' as const, config: { to: 'ops@example.com' }, enabled: true },
          { name: 'slack-alerts', type: 'slack' as const, config: { webhook: 'https://hooks.slack.com/webhook' }, enabled: true },
          { name: 'pagerduty', type: 'pagerduty' as const, config: { apiKey: 'YOUR_API_KEY', serviceKey: 'SERVICE_KEY' }, enabled: true },
          { name: 'sms-oncall', type: 'sms' as const, config: { phone: '+1234567890' }, enabled: false },
        ],
        escalations: [
          {
            name: 'oncall-escalation',
            trigger: 'severity == "critical" || severity == "emergency"',
            levels: [
              { level: 1, wait: 300, action: 'page' as const, target: 'oncall-engineer' },
              { level: 2, wait: 900, action: 'page' as const, target: 'engineering-lead' },
              { level: 3, wait: 1800, action: 'call' as const, target: 'cto' },
            ],
          },
        ],
        workflows: [
          {
            name: 'auto-restart-service',
            triggers: ['ServiceDown'],
            actions: [
              { type: 'restart_service', params: { service: 'api', maxRetries: 3 } },
              { type: 'notify', params: { channel: 'slack', message: 'Service auto-restarted' } },
            ],
            autoResolve: true,
            resolveAfter: 300,
          },
          {
            name: 'scale-up-on-load',
            triggers: ['HighLatency', 'HighErrorRate'],
            actions: [
              { type: 'scale_up', params: { service: 'api', increment: 2 } },
              { type: 'notify', params: { channel: 'slack', message: 'Auto-scaled up due to high load' } },
            ],
            autoResolve: false,
            resolveAfter: 600,
          },
        ],
        enableAutoRemediation: options.enableAutoRemediation || false,
        enableIncidentTracking: options.enableIncidentTracking || false,
        enablePostmortem: options.enablePostmortem || false,
      };

      displayConfig(config);

      console.log(chalk.gray('Generating alert management configuration...'));

      await withTimeout(async () => {
        await writeFiles(config, options.output, options.language);
        console.log(chalk.green(`\n✅ Generated: alert-management.tf`));
        console.log(chalk.green(`✅ Generated: alert-management-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
        console.log(chalk.green(`✅ Generated: ALERT_MANAGEMENT.md`));
        console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
        console.log(chalk.green(`✅ Generated: alert-management-config.json\n`));

        console.log(chalk.green('✓ Alert management configuration generated successfully!'));
      }, 30000);
    }));

  program.addCommand(observe);
}
