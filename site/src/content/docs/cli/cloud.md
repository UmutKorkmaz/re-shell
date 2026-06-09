---
title: "cloud"
description: "AWS, Azure, GCP, multi-cloud, serverless, and IaC."
---

The `cloud` group generates cloud-provider deployment and CDN configuration for a
named project, across single-cloud and multi-cloud targets.

```bash
re-shell cloud --help
```

| Subcommand | Purpose |
| --- | --- |
| `aws <project>` | AWS ECS/EKS with CDK templates, auto-scaling, cost optimization. |
| `azure <project>` | Azure AKS with ARM/Bicep and Azure DevOps integration. |
| `gcp <project>` | GCP GKE with Cloud Deployment Manager and Cloud Build. |
| `multi <name>` | Multi-cloud deployment with vendor lock-in prevention. |
| `serverless <name>` | Lambda / Azure Functions / Cloud Functions deployment. |
| `db <name>` | Cloud-native database integration (RDS, CosmosDB, Cloud SQL) with backups. |
| `storage <name>` | Cloud storage + data pipeline automation with governance. |
| `iac <name>` | Infrastructure as Code with Terraform/Pulumi and state management. |
| `dr <name>` | Cross-cloud disaster recovery and backup strategies. |
| `cost <name>` | Cost optimization and budget management with alerts. |
| `hybrid <name>` | Hybrid cloud with edge-computing support. |
| `network <name>` / `resources <name>` | Multi-cloud networking and resource lifecycle. |

## Examples

```bash
re-shell cloud aws acme-platform
re-shell cloud gcp acme-platform
re-shell cloud multi acme-platform
re-shell cloud iac acme-platform
re-shell cloud serverless acme-functions
```

Run `re-shell cloud <subcommand> --help` for the flags of any subcommand.

## See also

- [k8s / Helm / GitOps](/re-shell/cli/k8s-helm-gitops/) — Kubernetes-native
  deployment.
- [observe](/re-shell/cli/observe/) — monitoring for what you deploy.
