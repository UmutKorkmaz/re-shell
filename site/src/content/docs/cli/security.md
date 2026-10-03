---
title: "security"
description: "Security generators, the tamper-evident audit trail, and compliance evidence reports."
---

The `security` group has two parts. Most subcommands are **generators** that write
security, compliance and governance integrations for a named project (dependency and
container scanning, zero-trust, RBAC, SBOM, regulatory reporting). They generate
integrations (configuration and starter code) for the project name you pass; for a
one-off analysis of the current workspace use `analyze --type security`. Two
subcommands are **real tools that operate on your workspace**: `security audit verify`
and `security compliance report`, documented on
[Audit trail & compliance](/re-shell/cli/security-audit/).

```bash
re-shell security --help
```

| Subcommand | Purpose |
| --- | --- |
| `vulnerability-scan <name>` | Dependency vulnerability scanning with Snyk and OWASP. |
| `container-security <name>` | Container security with Trivy and runtime protection. |
| `code-security <name>` | Code security analysis with SonarQube. |
| `secret-detection <name>` | Secret detection/management with HashiCorp Vault and rotation. |
| `infrastructure-security <name>` | IaC security scanning and compliance checking. |
| `zero-trust <name>` | Zero-trust security model with identity verification. |
| `threat-detection <name>` | ML-based threat detection and response. |
| `supply-chain-security <name>` | Supply-chain security and SBOM with integrity verification. |
| `compliance-reporting <name>` | SOX, GDPR, HIPAA compliance reporting with evidence collection. |
| `rbac <name>` | RBAC and access control with fine-grained permissions. |
| `audit <name>` | Generate an audit-log system (tamper-proof logging) for a project. |
| `audit verify` | **Verify the CLI's own hash-chained audit log**; exits 1 on tampering. See [Audit trail & compliance](/re-shell/cli/security-audit/). |
| `compliance report` | **SOC 2 / ISO 27001 evidence report** from the audit log, policy checks and config. |
| `governance <name>` | Governance policy management with workflow automation. |

There are more subcommands (`incident-management`, `penetration-testing`,
`privacy`, `risk`, `vendor`, `bcp`, …) — run `re-shell security --help` for the
full list.

## Examples

```bash
re-shell security vulnerability-scan acme-platform
re-shell security supply-chain-security acme-platform
re-shell security rbac acme-platform
re-shell security compliance-reporting acme-platform
```

## See also

- [analyze --type security](/re-shell/cli/doctor-analyze/#analyze) — one-off
  security analysis of the current workspace.
- [data](/re-shell/cli/data/) — data encryption for cross-service traffic.
