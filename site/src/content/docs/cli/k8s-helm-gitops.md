---
title: "k8s / Helm / GitOps"
description: "Kubernetes manifests, Helm charts, GitOps, mesh, and operators."
---

The `k8s` group turns your declarative workspace config into deployment
artifacts: Kubernetes manifests, Helm charts, GitOps integrations, service mesh
config, autoscalers, network policies, operators, and more.

```bash
re-shell k8s --help
```

| Subcommand | Purpose |
| --- | --- |
| `generate` | Deployment, Service, HPA, NetworkPolicy from the workspace v2 config. |
| `helm <project>` | Helm chart templates with environment-specific values. |
| `gitops <project>` | ArgoCD/Flux GitOps integration for automated deploys and rollbacks. |
| `mesh <project>` | Istio/Linkerd service mesh integration. |
| `hpa <project>` | Horizontal Pod Autoscaler with custom/predictive metrics. |
| `network-policy <project>` | Network policies and security contexts (micro-segmentation). |
| `crd` / `operator <project>` | Custom Resource Definitions and polyglot operators. |
| `ingress <project>` | Ingress with SSL/TLS automation and WAF integration. |
| `multi-cluster` / `multi-tenant <project>` | Multi-cluster DR and tenant isolation. |
| `cicd <project>` | Kubernetes-native CI/CD with progressive delivery. |

## `k8s generate`

Generates the core manifests from your `re-shell.workspaces.yaml` (v2).

```
Usage: re-shell k8s generate [options]

Options:
  --out <dir>       Output directory to write manifest files into
  --namespace <ns>  Target Kubernetes namespace (default: "default")
  --json            Emit machine-readable JSON envelope to stdout
  --dry-run         Render manifests without writing any files
```

```bash
# Preview without writing
re-shell k8s generate --dry-run

# Write manifests to ./k8s in the "acme" namespace
re-shell k8s generate --out ./k8s --namespace acme

# Machine-readable envelope
re-shell k8s generate --json
```

Produces Deployment, Service, HPA, and NetworkPolicy manifests. The `--json`
form is a contract envelope; on failure it carries `code: "K8S_GENERATE_ERROR"`.

## `k8s helm`

```bash
re-shell k8s helm acme --help
re-shell k8s helm acme
```

Generates a Helm chart with environment-specific `values` and dependency
management. Errors surface as `code: "HELM_GENERATE_ERROR"`.

## `k8s gitops`

```bash
re-shell k8s gitops acme --tool argocd
re-shell k8s gitops acme --tool flux
```

Generates an ArgoCD `Application` or a Flux `GitRepository` + `Kustomization`,
wired for automated deployment and rollback. Errors surface as
`code: "GITOPS_GENERATE_ERROR"`.

## Related: cloud, observe, security

The platform-engineering surface continues across sibling groups:

- [cloud](/re-shell/cli/cloud/) — AWS/Azure/GCP targets and IaC.
- [observe](/re-shell/cli/observe/) — metrics, tracing, logging, alerting.
- [security](/re-shell/cli/security/) — scanning, policy-as-code, compliance.

## See also

- [Architecture: Monorepo](/re-shell/architecture/monorepo/) — where the v2
  workspace config lives.
- [JSON Contract](/re-shell/contract/json-contract/) — error codes.
