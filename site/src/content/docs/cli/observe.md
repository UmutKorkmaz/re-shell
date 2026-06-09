---
title: "observe"
description: "Metrics, tracing, logs, APM, and alerts."
---

The `observe` group generates observability stacks for a named project: metrics,
distributed tracing, log aggregation, APM, business KPIs, anomaly detection,
predictive scaling, and alerting.

```bash
re-shell observe --help
```

| Subcommand | Purpose |
| --- | --- |
| `metrics <name>` | Prometheus/Grafana integration with custom dashboards. |
| `trace <name>` | Distributed tracing with Jaeger/Zipkin across services. |
| `logs <name>` | Log aggregation with an ELK/EFK stack and structured logging. |
| `apm <name>` | Application Performance Monitoring with AI-powered insights. |
| `business <name>` | Business metrics and KPI tracking with real-time dashboards. |
| `anomaly <name>` | ML-based anomaly detection with automated response. |
| `scale <name>` | Predictive scaling and capacity planning with cost optimization. |
| `alerts <name>` | Custom alerting and incident management with escalation. |

## Examples

```bash
re-shell observe metrics acme-platform
re-shell observe trace acme-platform
re-shell observe logs acme-platform
re-shell observe alerts acme-platform
```

Run `re-shell observe <subcommand> --help` for the flags of any subcommand.

## See also

- [analyze](/re-shell/cli/doctor-analyze/) — one-off performance/security
  analysis.
- [k8s / Helm / GitOps](/re-shell/cli/k8s-helm-gitops/) — deploy the workloads
  you observe.
