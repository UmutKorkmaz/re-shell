# Cloud, Kubernetes, And Observability

These examples cover infrastructure generation, cluster deployment assets, and monitoring stack setup.

## Cloud Provider Scaffolding

```bash
re-shell cloud aws acme-platform --region eu-central-1 --enable-spot --output tmp/aws
re-shell cloud azure acme-platform --location westeurope --enable-autoscale --output tmp/azure
re-shell cloud gcp acme-platform --region europe-west1 --enable-autoscale --output tmp/gcp
```

## Kubernetes Assets

```bash
re-shell k8s manifests acme-platform --services api:3000,worker:8080 --namespace production --replicas 3 --output tmp/k8s-manifests
re-shell k8s helm acme-platform --chart-name acme --environments dev,staging,prod --output tmp/helm
re-shell k8s gitops acme-platform --platform argocd --git-repo https://github.com/acme/platform.git --output tmp/gitops
re-shell k8s mesh acme-platform --mesh istio --services api:3000,worker:8080 --output tmp/mesh
re-shell k8s hpa acme-platform
```

## Metrics, Tracing, And Logs

```bash
re-shell observe metrics acme-platform --retention-days 30 --enable-alerts --output tmp/metrics
re-shell observe trace acme-platform --backend jaeger --sampling-rate 0.2 --output tmp/tracing
re-shell observe logs acme-platform --backend elk --format json --retention-days 14 --output tmp/logs
```

## Other Cloud Features In This Group

- Multi-cloud patterns: `cloud multi`, `cloud hybrid`, `cloud network`
- Managed data and storage: `cloud db`, `cloud storage`
- Runtime models: `cloud serverless`, `cloud resources`
- Delivery and governance: `cloud iac`, `cloud dr`, `cloud cost`

## Other Kubernetes Features In This Group

- Platform hardening: `k8s network-policy`, `k8s pod-security`, `k8s multi-tenant`
- Extension points: `k8s crd`, `k8s operator`
- Delivery: `k8s cicd`, `k8s multi-cluster`, `k8s ingress`, `k8s cluster`

## Other Observability Features In This Group

- Application and business monitoring: `observe apm`, `observe business`
- Detection and capacity: `observe anomaly`, `observe scale`
- Notification and routing: `observe alerts`
