---
title: "cloud"
description: "Generate and validate Terraform for AWS, Azure and GCP from your workspace config, and deploy it with credentials you provide."
---

The `cloud` group has two layers:

1. **Workspace-driven Terraform** (`cloud iac generate`, `cloud iac validate`,
   `cloud deploy`): real infrastructure code generated from your
   `re-shell.workspaces.yaml`, validated with a real Terraform, and applied only
   when you ask.
2. **Project generators** (`cloud aws|azure|gcp|multi|...`): scaffolding that
   writes provider-specific configuration files for a named project. They write
   files and call no cloud API.

```bash
re-shell cloud --help
```

## `cloud iac generate`

Generates Terraform for one provider from the services in your workspace config:

| `--provider` | Target |
| --- | --- |
| `aws` | ECS Fargate |
| `azure` | Container Apps |
| `gcp` | Cloud Run |

```bash
re-shell cloud iac generate --provider aws --out ./infra/aws
re-shell cloud iac generate --provider gcp --services web,api --out ./infra/gcp --validate
re-shell cloud iac generate --provider azure --dry-run --json
```

`--services` selects a subset (default: all). A dry run reports the services (with
their ports and whether they are exposed) and every file with its content, and writes
nothing. `--validate` runs the validation below on the output.

## `cloud iac validate`

```bash
re-shell cloud iac validate ./infra/aws
```

Runs `terraform fmt -check`, `terraform init -backend=false` and `terraform
validate` (in a temporary copy unless `--in-place`) and **fails unless all three
really ran and passed**: a missing `terraform` binary is a failure, not a skip.
The `iac-validate` workflow runs this for AWS, Azure and GCP output on every change to
the generator (it downloads providers from the registry; it does not use cloud
credentials, and the workflow passes on GitHub, PR #395). Generating Terraform is verified
by unit tests and that workflow; **nothing here has been applied to a real cloud
account.**

## `cloud deploy`

```bash
re-shell cloud deploy --provider aws --dir ./infra/aws --region eu-west-1 --image-tag api=1.4.2
re-shell cloud deploy --provider aws --dir ./infra/aws --yes      # actually apply
re-shell cloud deploy --provider gcp --dry-run --json
```

`cloud deploy` checks for credentials first and fails clearly if they are missing.
Without `--yes` it runs only `terraform init` and `plan` and stops; `terraform apply`
runs only with `--yes`. `--var name=value` and `--image-tag service=tag` are
repeatable. `--dry-run` prints the Terraform commands without running them. It needs
real credentials and reports exactly what it checked: for AWS, access-key or
web-identity or container credentials in the environment, or a configured profile;
for Azure, `az login` or the `ARM_*` variables; for GCP, a `gcloud` login or
`GOOGLE_APPLICATION_CREDENTIALS`. It never fakes a deployment, and it was not run
against a real account while writing this documentation.

## Project generators

| Subcommand | Purpose |
| --- | --- |
| `aws <project>` | AWS ECS/EKS with CDK templates, auto-scaling, cost optimization. |
| `azure <project>` | Azure AKS with ARM/Bicep and Azure DevOps integration. |
| `gcp <project>` | GCP GKE with Cloud Deployment Manager and Cloud Build. |
| `multi <name>` | Multi-cloud deployment with vendor lock-in prevention. |
| `serverless <name>` | Lambda / Azure Functions / Cloud Functions deployment. |
| `db <name>` | Cloud-native database integration (RDS, CosmosDB, Cloud SQL) with backups. |
| `storage <name>` | Cloud storage + data pipeline automation with governance. |
| `iac scaffold <name>` | Standalone Terraform or Pulumi tooling for a named project (`--provider terraform\|pulumi`, `--language typescript\|python`, `--backend s3\|azurerm\|gcs\|local`). |
| `dr <name>` | Cross-cloud disaster recovery and backup strategies. |
| `cost <name>` | Cost optimization and budget management with alerts. |
| `hybrid <name>` | Hybrid cloud with edge-computing support. |
| `network <name>` / `resources <name>` | Multi-cloud networking and resource lifecycle. |

```bash
re-shell cloud aws acme-platform
re-shell cloud multi acme-platform
re-shell cloud iac scaffold acme-platform --provider terraform --backend s3
```

Run `re-shell cloud <subcommand> --help` for the flags of any subcommand.

## See also

- [k8s / Helm / GitOps](/re-shell/cli/k8s-helm-gitops/): Kubernetes-native deployment.
- [observe](/re-shell/cli/observe/): monitoring for what you deploy.
- [Security audit trail](/re-shell/cli/security-audit/): `cloud deploy --yes` is recorded.
