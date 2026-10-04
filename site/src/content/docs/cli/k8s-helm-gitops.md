---
title: "k8s / Helm / GitOps"
description: "Hardened Kubernetes manifests, Helm charts, ArgoCD and Flux, rollback, CRD, operator and service mesh, generated from your workspace config."
---

The `k8s` group turns your declarative workspace config
(`re-shell.workspaces.yaml`, v2) into deployment artifacts: Kubernetes manifests,
Helm charts, GitOps resources, a CRD and operator, and service-mesh configuration,
plus a `rollback` command for a running cluster.

```bash
re-shell k8s --help
```

| Subcommand | Purpose |
| --- | --- |
| `generate` | Deployment, Service, HPA, NetworkPolicy and PodDisruptionBudget per service. |
| `helm generate` | A Helm chart (`Chart.yaml`, `values.yaml`, `templates/`). |
| `gitops generate` | ArgoCD `Application` or Flux resources, plus cert-manager TLS ingress. |
| `rollback <service>` | Roll a workload back (`kubectl rollout undo`, or `helm rollback`). |
| `crd` | The `ReShellWorkspace` CustomResourceDefinition and a sample resource. |
| `operator` | A Go (controller-runtime) operator that reconciles that CRD. |
| `mesh` | Istio or Linkerd resources (injection, mTLS, traffic policy). |
| `hpa`, `network-policy`, `pod-security`, `ingress`, `cluster`, `multi-cluster`, `multi-tenant`, `cicd` | Standalone generators; run `--help`. |

Every generator takes `--out <dir>`, `--dry-run` (render without writing) and
`--json`. Failures carry `K8S_GENERATE_ERROR`, `HELM_GENERATE_ERROR` or
`GITOPS_GENERATE_ERROR`.

## Hardened by default

Generated workloads are written to pass the Pod Security Standard `restricted`
profile. Unless the workspace config says otherwise:

- `runAsNonRoot: true` with a non-zero uid (a config that sets `runAsNonRoot` and
  uid 0 is rejected), `automountServiceAccountToken: false`;
- `readOnlyRootFilesystem: true` (writable paths become `emptyDir` mounts), all
  capabilities dropped, no privilege escalation, `RuntimeDefault` seccomp;
- a rolling update that never drops below the desired replicas, a
  `PodDisruptionBudget`, default-deny NetworkPolicy with intra-namespace allows;
- probes and resource requests/limits as declared in the config.

## `k8s generate`

```bash
re-shell k8s generate --dry-run                      # render, write nothing
re-shell k8s generate --out ./k8s --namespace acme   # write manifests
re-shell k8s generate --json
```

## `k8s helm generate`

```bash
re-shell k8s helm generate --out ./charts/app
```

The chart's `values.yaml` carries per-service image, replicas, port, env, resources
and the pod security context, plus ingress and TLS settings.

## `k8s gitops generate`

```bash
re-shell k8s gitops generate --tool argocd --repo-url https://github.com/acme/platform.git
re-shell k8s gitops generate --tool flux   --repo-url https://github.com/acme/platform.git --chart-path ./charts/app
re-shell k8s gitops generate --tool flux --source manifests    # reconcile raw manifests instead of the chart
```

`--source` chooses what the tool reconciles: `helm` (default; Flux gets a
`GitRepository` plus a **`HelmRelease`** with Helm remediation, so a failed release
is rolled back by Flux) or `manifests` (Flux `Kustomization`). `--revision` sets the
branch (default `main`).

## `k8s rollback`

```bash
re-shell k8s rollback billing --namespace prod                 # previous revision
re-shell k8s rollback billing --to-revision 3 --method helm --release billing
re-shell k8s rollback billing --dry-run --json
```

`--method auto` (default) detects whether the Deployment belongs to a Helm release.
It waits for the rolled-back workload to become ready (`--timeout`, default 300 s) and
**exits non-zero on any failure**, including a rollout that never becomes ready.
`--context` selects a kubeconfig context.

## `k8s crd`, `k8s operator`, `k8s mesh`

These are driven by the workspace config, not by a project name.

```bash
re-shell k8s crd --out ./crd                    # ReShellWorkspace CRD (schema derived from the v2 schema) + sample CR
re-shell k8s operator --out ./operator --verify # Go operator; --verify runs go mod tidy, go build, go vet
re-shell k8s mesh --mesh linkerd --namespace prod --out ./mesh
```

The operator reconciles a `ReShellWorkspace` into Deployments and Services. `--verify`
fails if Go is missing or the build fails. The standalone script generators these
commands used to be are still available behind `--legacy <project-name>`.

## What was verified

- **Unit tests** cover the manifest, chart, GitOps, CRD, operator, mesh and rollback
  generators.
- **A live cluster.** `scripts/k8s-live-check.sh` validates the generators against a
  real cluster (`KUBECONFIG`): it generates everything from a fixture workspace, runs
  `helm lint --strict` and `helm template`, validates every manifest with
  `kubeconform`, applies the manifests into a namespace enforcing Pod Security
  `restricted`, waits for rollout, upgrades to a broken image, runs `re-shell k8s
  rollback` (kubectl and Helm) and checks recovery, installs the CRD and validates
  good and bad custom resources, and builds and runs the Go operator. Steps 1 to 8
  ran against a local k3s cluster during development.
- **Not run locally:** the Flux (and Argo CD) sync step. It needs registry egress that
  the development environment blocks. It runs in the `k8s-live` workflow against a
  `kind` cluster (the workflow passes on GitHub, PR #395); Argo CD is not installed
  there, so the Argo `Application` manifest is validated against its CRD schema with
  `kubeconform` only.

## Related: cloud, observe, security

- [cloud](/re-shell/cli/cloud/): Terraform generation for AWS, Azure and GCP.
- [observe](/re-shell/cli/observe/): metrics, tracing, logging, alerting.
- [security](/re-shell/cli/security/): scanning, policy-as-code, compliance.

## See also

- [Architecture: Monorepo](/re-shell/architecture/monorepo/): where the v2 workspace config lives.
- [JSON Contract](/re-shell/contract/json-contract/): error codes.
