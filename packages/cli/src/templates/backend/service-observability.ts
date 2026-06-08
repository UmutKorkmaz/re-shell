import { BackendTemplate } from '../types';

/**
 * Service Mesh Observability Template
 * Distributed tracing and metrics collection for service mesh
 */
export const serviceObservabilityTemplate: BackendTemplate = {
  id: 'service-observability',
  name: 'Service Mesh Observability',
  displayName: 'Distributed Tracing & Metrics',
  description: 'Complete service mesh observability with OpenTelemetry, Jaeger distributed tracing, Prometheus metrics, Grafana dashboards, and Loki logging',
  version: '1.0.0',
  language: 'typescript',
  framework: 'observability',
  tags: ['kubernetes', 'observability', 'tracing', 'metrics', 'monitoring', 'opentelemetry'],
  port: 4318,
  dependencies: {},
  features: ['monitoring', 'docker', 'rest-api', 'documentation'],

  files: {
    'opentelemetry/collector-config.yaml': `# OpenTelemetry Collector Configuration
# Receives traces, metrics, and logs from services

receiver:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  zipkin:
    endpoint: :9411
  prometheus:
    config:
      scrape_configs:
        - job_name: 'otel-collector'
          scrape_interval: 10s
          static_configs:
            - targets: ['localhost:8888']

processor:
  batch:
    timeout: 1s
    send_batch_size: 1024
  memory_limiter:
    limit_mib: 256
    spike_limit_mib: 64

exporter:
  logging:
    loglevel: debug
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
  prometheusremotewrite:
    endpoint: 'http://prometheus:9090/api/v1/write'
  loki:
    endpoint: 'http://loki:3100/loki/api/v1/push'

service:
  pipelines:
    traces:
      receivers: [otlp, zipkin]
      processors: [memory_limiter, batch]
      exporters: [jaeger]
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [loki]

extensions:
  health_check:
    endpoint: 0.0.0.0:13133
  pprof:
    endpoint: localhost:1777
`,

    'opentelemetry/instrumentation.ts': `// OpenTelemetry Instrumentation
// Automatic tracing and metrics for Node.js services

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

// Service resource attributes
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'my-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  })
);

// Trace Provider
const traceProvider = new NodeTracerProvider({ resource });

// Jaeger Exporter
const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

// Zipkin Exporter (fallback)
const zipkinExporter = new ZipkinExporter({
  url: process.env.ZIPKIN_URL || 'http://localhost:9411/api/v2/spans',
});

traceProvider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter));
traceProvider.addSpanProcessor(new SimpleSpanProcessor(zipkinExporter));
traceProvider.register();

// Metrics Provider
const prometheusExporter = new PrometheusExporter({
  port: 9464,
  endpoint: '/metrics',
});

const meterProvider = new MeterProvider({ resource });
meterProvider.addMetricReader(prometheusExporter);

// Auto-instrumentation
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
    new GrpcInstrumentation(),
  ],
  meterProvider,
});

console.log('OpenTelemetry instrumentation initialized');

export { traceProvider, meterProvider };
`,

    'opentelemetry/k8s-deployment.yaml': `# OpenTelemetry Collector Deployment on Kubernetes

apiVersion: v1
kind: Namespace
metadata:
  name: observability

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector
  namespace: observability
data:
  collector.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
      zipkin:
        endpoint: :9411

    processors:
      batch:
        timeout: 1s
        send_batch_size: 1024

    exporters:
      jaeger:
        endpoint: jaeger-collector.observability:14250
        tls:
          insecure: true
      prometheusremotewrite:
        endpoint: 'http://prometheus.observability:9090/api/v1/write'
      logging:
        loglevel: info

    service:
      pipelines:
        traces:
          receivers: [otlp, zipkin]
          processors: [batch]
          exporters: [jaeger, logging]
        metrics:
          receivers: [otlp]
          processors: [batch]
          exporters: [prometheusremotewrite]

---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: observability
  labels:
    app: otel-collector
spec:
  ports:
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
  - name: otlp-http
    port: 4318
    targetPort: 4318
  - name: zipkin
    port: 9411
    targetPort: 9411
  selector:
    app: otel-collector

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: observability
  labels:
    app: otel-collector
spec:
  replicas: 2
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
      - name: otel-collector
        image: otel/opentelemetry-collector-contrib:0.88.0
        args:
        - --config=/etc/otelcol/config.yaml
        ports:
        - containerPort: 4317
          name: otlp-grpc
        - containerPort: 4318
          name: otlp-http
        - containerPort: 9411
          name: zipkin
        volumeMounts:
        - name: config
          mountPath: /etc/otelcol
        livenessProbe:
          httpGet:
            path: /
            port: 13133
        readinessProbe:
          httpGet:
            path: /
            port: 13133
      volumes:
      - name: config
        configMap:
          name: otel-collector
`,

    'jaeger/k8s-deployment.yaml': `# Jaeger Distributed Tracing Deployment

apiVersion: v1
kind: Namespace
metadata:
  name: observability

---
apiVersion: v1
kind: Service
metadata:
  name: jaeger-query
  namespace: observability
spec:
  ports:
  - name: query
    port: 16686
    targetPort: 16686
  - name: grpc
    port: 16685
    targetPort: 16685
  selector:
    app: jaeger

---
apiVersion: v1
kind: Service
metadata:
  name: jaeger-collector
  namespace: observability
spec:
  ports:
  - name: c-tchan
    port: 14267
    targetPort: 14267
  - name: c-grpc
    port: 14250
    targetPort: 14250
  - name: c-http
    port: 14268
    targetPort: 14268
  selector:
    app: jaeger

---
apiVersion: v1
kind: Service
metadata:
  name: jaeger-agent
  namespace: observability
spec:
  ports:
  - name: a-compact
    port: 6831
    targetPort: 6831
    protocol: UDP
  - name: a-binary
    port: 6832
    targetPort: 6832
    protocol: UDP
  selector:
    app: jaeger

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
  namespace: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:1.50
        ports:
        - containerPort: 5775
          protocol: UDP
        - containerPort: 6831
          protocol: UDP
        - containerPort: 6832
          protocol: UDP
        - containerPort: 5778
          protocol: TCP
        - containerPort: 16686
          protocol: TCP
        - containerPort: 16685
          protocol: TCP
        - containerPort: 14267
          protocol: TCP
        - containerPort: 14250
          protocol: TCP
        - containerPort: 14268
          protocol: TCP
        - containerPort: 9411
          protocol: TCP
        env:
        - name: COLLECTOR_ZIPKIN_HOST_PORT
          value: ':9411'
        - name: SPAN_STORAGE_TYPE
          value: elasticsearch
        - name: ES_SERVER_URLS
          value: 'http://elasticsearch:9200'
`,

    'prometheus/k8s-deployment.yaml': `# Prometheus Metrics Deployment

apiVersion: v1
kind: Namespace
metadata:
  name: observability

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus
  namespace: observability
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
      - job_name: 'prometheus'
        static_configs:
          - targets: ['localhost:9090']

      - job_name: 'kubernetes-pods'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            regex: ([^:]+)(?::\\d+)?;(\\d+)
            replacement: '$1:$2'
            target_label: __address__

      - job_name: 'kubernetes-nodes'
        kubernetes_sd_configs:
          - role: node
        relabel_configs:
          - source_labels: [__address__]
            regex: '(.*):10250'
            replacement: '${1}:9100'
            target_label: __address__

      - job_name: 'otel-collector'
        static_configs:
          - targets: ['otel-collector:8888']

    alerting:
      alertmanagers:
        - static_configs:
            - targets: ['alertmanager:9093']

    rule_files:
      - '/etc/prometheus/rules/*.yml'
  rules.yml: |
    groups:
      - name: service_alerts
        rules:
          - alert: HighErrorRate
            expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: High error rate detected

          - alert: HighLatency
            expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: High latency detected

---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: observability
spec:
  ports:
  - name: web
    port: 9090
    targetPort: 9090
  selector:
    app: prometheus

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:v2.47.0
        args:
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus'
        - '--web.console.libraries=/usr/share/prometheus/console_libraries'
        - '--web.console.templates=/usr/share/prometheus/consoles'
        ports:
        - containerPort: 9090
          name: web
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
        - name: data
          mountPath: /prometheus
        livenessProbe:
          httpGet:
            path: /-/healthy
            port: 9090
        readinessProbe:
          httpGet:
            path: /-/ready
            port: 9090
      volumes:
      - name: config
        configMap:
          name: prometheus
      - name: data
        emptyDir: {}
`,

    'grafana/k8s-deployment.yaml': `# Grafana Dashboards Deployment

apiVersion: v1
kind: Namespace
metadata:
  name: observability

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: observability
data:
  datasources.yaml: |
    apiVersion: 1

    datasources:
      - name: Prometheus
        type: prometheus
        access: proxy
        url: http://prometheus:9090
        isDefault: true

      - name: Jaeger
        type: jaeger
        access: proxy
        url: http://jaeger:16686

      - name: Loki
        type: loki
        access: proxy
        url: http://loki:3100

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
  namespace: observability
data:
  service-mesh-dashboard.json: |
    {
      "dashboard": {
        "title": "Service Mesh Observability",
        "panels": [
          {
            "title": "Request Rate",
            "targets": [
              {
                "expr": "rate(http_requests_total[5m])"
              }
            ]
          },
          {
            "title": "Error Rate",
            "targets": [
              {
                "expr": "rate(http_requests_total{status=~"5.."}[5m])"
              }
            ]
          },
          {
            "title": "Latency (p95)",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
              }
            ]
          }
        ]
      }
    }

---
apiVersion: v1
kind: Secret
metadata:
  name: grafana
  namespace: observability
type: Opaque
stringData:
  admin-password: prom-operator

---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: observability
spec:
  ports:
  - name: web
    port: 3000
    targetPort: 3000
  selector:
    app: grafana

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:10.1.0
        ports:
        - containerPort: 3000
          name: web
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana
              key: admin-password
        - name: GF_USERS_ALLOW_SIGN_UP
          value: "false"
        - name: GF_SERVER_ROOT_URL
          value: "http://grafana.observability:3000"
        volumeMounts:
        - name: datasources
          mountPath: /etc/grafana/provisioning/datasources
        - name: dashboards
          mountPath: /etc/grafana/provisioning/dashboards
        - name: data
          mountPath: /var/lib/grafana
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
      volumes:
      - name: datasources
        configMap:
          name: grafana-datasources
      - name: dashboards
        configMap:
          name: grafana-dashboards
      - name: data
        emptyDir: {}
`,

    'loki/k8s-deployment.yaml': `# Loki Log Aggregation Deployment

apiVersion: v1
kind: Namespace
metadata:
  name: observability

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki
  namespace: observability
data:
  loki-config.yaml: |
    auth_enabled: false

    server:
      http_listen_port: 3100

    ingester:
      lifecycler:
        address: 127.0.0.1
        ring:
          kvstore:
            store: inmemory
          replication_factor: 1
      chunk_idle_period: 1h
      max_chunk_age: 1h

    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: filesystem
          schema: v11
          index:
            prefix: index_
            period: 24h

    storage_config:
      boltdb_shipper:
        active_index_directory: /loki/index
        cache_location: /loki/cache
      filesystem:
        directory: /loki/chunks

    limits_config:
      enforce_metric_name: false
      reject_old_samples: true
      reject_old_samples_max_age: 168h

    ruler:
      storage:
        type: local
        local:
          directory: /loki/rules

---
apiVersion: v1
kind: Service
metadata:
  name: loki
  namespace: observability
spec:
  ports:
  - name: http
    port: 3100
    targetPort: 3100
  selector:
    app: loki

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki
  template:
    metadata:
      labels:
        app: loki
    spec:
      containers:
      - name: loki
        image: grafana/loki:2.9.0
        args:
        - '-config.file=/etc/loki/loki-config.yaml'
        ports:
        - containerPort: 3100
          name: http
        volumeMounts:
        - name: config
          mountPath: /etc/loki
        - name: data
          mountPath: /loki
        livenessProbe:
          httpGet:
            path: /ready
            port: 3100
        readinessProbe:
          httpGet:
            path: /ready
            port: 3100
      volumes:
      - name: config
        configMap:
          name: loki
      - name: data
        emptyDir: {}
`,

    'promtail/k8s-deployment.yaml': `# Promtail Log Agent Deployment

apiVersion: v1
kind: Namespace
metadata:
  name: observability

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: promtail
  namespace: observability
data:
  promtail-config.yaml: |
    server:
      http_listen_port: 3101

    clients:
      - url: http://loki:3100/loki/api/v1/push

    positions:
      filename: /tmp/positions.yaml

    scrape_configs:
      - job_name: kubernetes-pods
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
          - source_labels: [__meta_kubernetes_pod_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_node_name]
            target_label: node
          - source_labels: [__meta_kubernetes_pod_container_name]
            target_label: container
          - replacement: /var/log/pods/*$1/*.log
            separator: /
            source_labels: [__meta_kubernetes_pod_uid, __meta_kubernetes_pod_container_name]
            target_label: __path__

---
apiVersion: v1
kind: Service
metadata:
  name: promtail
  namespace: observability
spec:
  ports:
  - name: http
    port: 3101
    targetPort: 3101
  selector:
    app: promtail

---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: observability
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      containers:
      - name: promtail
        image: grafana/promtail:2.9.0
        args:
        - '-config.file=/etc/promtail/promtail-config.yaml'
        ports:
        - containerPort: 3101
          name: http
        volumeMounts:
        - name: config
          mountPath: /etc/promtail
        - name: varlog
          mountPath: /var/log
          readOnly: true
        env:
        - name: HOSTNAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
      volumes:
      - name: config
        configMap:
          name: promtail
      - name: varlog
        hostPath:
          path: /var/log
`,

    'istio/telemetry.yaml': `# Istio Telemetry Configuration
# Automatic metrics and traces for Istio services

apiVersion: telemetry.istio.io/v1alpha1
kind: Telemetry
metadata:
  name: mesh-default
  namespace: istio-system
spec:
  metrics:
    - providers:
        - name: prometheus
      overrides:
        - match:
            metric: ALL_METRICS
          tagOverrides:
            destination_service:
              value: destination.service.name
            source_app:
              value: source.app
  tracing:
    - providers:
        - name: jaeger
      randomSamplingPercentage: 100
  accessLogging:
    - providers:
        - name: envoy

---
# Prometheus ServiceMonitor for Istio
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istio-component-monitor
  namespace: istio-system
  labels:
    app: istio-component-monitor
spec:
  selector:
    matchExpressions:
      - key: app
        operator: In
        values: ['istiod', 'pilot']
  endpoints:
    - port: http-monitoring
      interval: 15s
`,

    'docker-compose.yml': `version: '3.8'

services:
  # OpenTelemetry Collector
  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.88.0
    container_name: otel-collector
    command: ['--config=/etc/otelcol/config.yaml']
    volumes:
      - ./opentelemetry/collector-config.yaml:/etc/otelcol/config.yaml:ro
    ports:
      - "4317:4317"
      - "4318:4318"
      - "9411:9411"
      - "8888:8888"
      - "13133:13133"
    networks:
      - observability-net
    depends_on:
      - jaeger
      - prometheus

  # Jaeger Distributed Tracing
  jaeger:
    image: jaegertracing/all-in-one:1.50
    container_name: jaeger
    ports:
      - "5775:5775/udp"
      - "6831:6831/udp"
      - "6832:6832/udp"
      - "5778:5778"
      - "16686:16686"
      - "16685:16685"
      - "14267:14267"
      - "14250:14250"
      - "14268:14268"
      - "9411:9411"
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
    networks:
      - observability-net
    depends_on:
      - elasticsearch

  # Elasticsearch for Jaeger storage
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.9.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      - observability-net

  # Prometheus Metrics
  prometheus:
    image: prom/prometheus:v2.47.0
    container_name: prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - observability-net

  # Grafana Dashboards
  grafana:
    image: grafana/grafana:10.1.0
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    ports:
      - "3000:3000"
    networks:
      - observability-net
    depends_on:
      - prometheus
      - jaeger

  # Loki Log Aggregation
  loki:
    image: grafana/loki:2.9.0
    container_name: loki
    command: -config.file=/etc/loki/loki-config.yaml
    volumes:
      - ./loki/loki-config.yaml:/etc/loki/loki-config.yaml:ro
      - loki-data:/loki
    ports:
      - "3100:3100"
    networks:
      - observability-net

  # Promtail Log Agent
  promtail:
    image: grafana/promtail:2.9.0
    container_name: promtail
    command: -config.file=/etc/promtail/promtail-config.yaml
    volumes:
      - ./promtail/promtail-config.yaml:/etc/promtail/promtail-config.yaml:ro
      - /var/log:/var/log:ro
    ports:
      - "3101:3101"
    networks:
      - observability-net
    depends_on:
      - loki

networks:
  observability-net:
    driver: bridge

volumes:
  elasticsearch-data:
  prometheus-data:
  grafana-data:
  loki-data:
`,

    'README.md': `# Service Mesh Observability

Complete observability stack for service mesh with distributed tracing, metrics collection, and log aggregation.

## Features

### Distributed Tracing
- OpenTelemetry Collector for traces
- Jaeger UI for trace visualization
- Zipkin-compatible endpoint
- Automatic instrumentation for HTTP/Express/gRPC

### Metrics Collection
- Prometheus for metric storage
- Custom metrics and histograms
- Service mesh auto-discovery
- Alerting rules for SLOs

### Dashboards
- Grafana for visualization
- Pre-built service mesh dashboards
- Real-time metrics
- Trace correlation

### Log Aggregation
- Loki for log storage
- Promtail log agent
- Kubernetes pod logs
- Log queries with Grafana

## Quick Start

### Docker Compose

bash code for starting observability stack

### Kubernetes

bash code for deploying to Kubernetes

## Endpoints

- Jaeger UI: http://localhost:16686
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000 (admin/admin)
- Loki: http://localhost:3100
- OTEL Collector: http://localhost:4318

## License

MIT
`,

    'Makefile': `.PHONY: help start stop logs clean

help:
	@echo "Available targets: start stop logs clean"

start:
	docker-compose up -d

stop:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	rm -rf elasticsearch-data prometheus-data grafana-data loki-data
`
  },

  postInstall: [
    `echo "Setting up service mesh observability..."
echo ""
echo "Observability Stack:"
echo "- OpenTelemetry Collector: http://localhost:4318"
echo "- Jaeger UI: http://localhost:16686"
echo "- Prometheus: http://localhost:9090"
echo "- Grafana: http://localhost:3000 (admin/admin)"
echo ""
echo "Quick Start:"
echo "  make start"
echo ""
echo "Instrument your services with OpenTelemetry:"
echo "  npm install @opentelemetry/api @opentelemetry/sdk-node"
echo ""
echo "Configure OTEL endpoint:"
echo "  export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318"
`
  ]
};
