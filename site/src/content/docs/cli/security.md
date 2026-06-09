---
title: "security"
description: "Scanning, RBAC, audit, compliance, and SBOM."
---

The `security` group generates security, compliance, and governance integrations
for a named project — from dependency and container scanning to zero-trust,
RBAC, audit logging, SBOM, and regulatory reporting.

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
| `audit <name>` | Comprehensive audit trail and tamper-proof logging. |
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
