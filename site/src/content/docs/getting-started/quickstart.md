---
title: "Quickstart"
description: "Go from install to a running workspace and dashboard in about five minutes."
---

This walkthrough takes you from an empty directory to a monorepo with a backend
service and the live dashboard. It assumes you have
[installed the CLI](/re-shell/getting-started/install/) and are on Node.js 18+. The
file counts and outputs below come from running these exact commands against the
0.31.0 tree; yours may differ slightly with the CLI version.

## 1. Initialize a workspace

`re-shell init` scaffolds a monorepo: package-manager config, workspace layout,
linting, Docker, CI, and a `pnpm-workspace.yaml` / `turbo.json` so tooling works out
of the box.

```bash
re-shell init acme-platform
cd acme-platform
```

Useful flags (`re-shell init --help`):

| Flag | Purpose |
| --- | --- |
| `--package-manager <pm>` | `npm`, `yarn`, `pnpm` (default), or `bun`. |
| `--template <template>` | `blank` (default), `ecommerce`, `dashboard`, `saas`. |
| `--skip-install` | Scaffold without running the package install. |
| `--no-git` | Skip Git repository initialization. |
| `-y, --yes` | Skip interactive prompts and accept defaults. |

```bash
# Non-interactive, no install (fast scaffold)
re-shell init acme-platform --package-manager pnpm --skip-install -y
```

That writes **28 files** (not counting `.git`, which gets an initial commit):
`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `Dockerfile`,
`docker-compose.yml`, `.github/workflows/ci.yml`, lint/format/commit-hook
configuration, `.re-shell/config.yaml`, and the first lines of the
[audit trail](/re-shell/cli/security-audit/) under `.re-shell/audit/`.

## 2. Add a backend service

Preview before you write. `templates apply` is a dry run that computes the exact
file set a scaffold would produce, without touching your workspace:

```bash
re-shell templates apply express --name billing
```

```
🔍 Dry run: express → "billing"

Would create 34 files (52080 bytes). Nothing written.

  + .dockerignore (356b)
  + .env.example (592b)
  + docker-compose.yml (1418b)
  + Dockerfile (1228b)
  + jest.config.js (1000b)
  + package.json (2538b)
  + prisma/schema.prisma (1273b)
  ...
```

There are two ways to write a backend, and they produce different amounts of code:

```bash
# A small starter service: services/billing with package.json, tsconfig.json
# and src/index.ts (3 files for Express)
re-shell generate backend billing --framework express --language typescript

# The full template as its own project (38 files for Express, including the
# workspace scaffolding around it), laid out as apps/<name>
re-shell create api --backend express
```

Add `--dry-run --json` to `create` to get the file set with per-file previews
and diffs as a JSON envelope, with nothing written.

Browse all 208 templates across 36 languages with
[`templates list`](/re-shell/cli/templates/), or read the
[Template Catalog](/re-shell/templates/catalog/).

## 3. Check workspace health

Every data command speaks the typed [JSON contract](/re-shell/contract/json-contract/).
Run a health check both ways, human-readable and machine-readable:

```bash
re-shell workspace health
re-shell workspace health --json
```

```json
{
  "ok": true,
  "data": {
    "score": 67,
    "status": "critical",
    "checks": [
      { "name": "Workspaces", "status": "healthy", "message": "1 workspace(s) detected", "details": ["billing (service)"] },
      { "name": "File Structure", "status": "warning", "message": "Workspace structure could be improved", "details": ["Missing recommended files: README.md"] },
      { "name": "Package Manager", "status": "warning", "message": "No package manager lock file detected" }
    ]
  },
  "warnings": ["Workspace structure could be improved", "No package manager lock file detected"]
}
```

A fresh workspace scores lower until you install dependencies and add the
recommended files; that is expected. (`status` on the wire is
`healthy|degraded|critical`; the human-readable output uses its own wording.)

## 4. Open the dashboard

`re-shell ui` launches the bundled dashboard: a token-authenticated,
`127.0.0.1`-bound web app for inspecting your workspace. It starts a local hub,
waits for it to be healthy (and fails if it is not), and opens the browser.

```bash
re-shell ui
```

This opens `http://127.0.0.1:3333` with **11 screens**: Overview, Workspace Graph,
Templates, Command Builder, Assistant, Jobs & Logs, Health, Scorecard, Catalog,
Collaboration and Settings. The dashboard talks to the CLI over a hardened local
hub (see [Dashboard](/re-shell/dashboard/overview/) and the
[Secure Hub](/re-shell/architecture/secure-hub/) architecture). The Collaboration
screen needs a running [control plane](/re-shell/architecture/control-plane/).

Preview the launch plan without starting anything:

```bash
re-shell ui --dry-run
re-shell ui --json
```

## 5. Diagnose your environment

`doctor` runs health checks on the monorepo. It is a gate: it exits non-zero when
the workspace is unhealthy, so you can use it in CI.

```bash
re-shell doctor
re-shell doctor --explain     # why each failing check failed, and what to do
re-shell doctor --fix         # a dry-run remediation plan; add --yes to apply
re-shell doctor --json
```

On the fresh workspace above it reports 8 passed checks and 3 warnings (security
audit, uncommitted git changes, a workspace missing build configuration files).

## Where to go next

- [Core Concepts](/re-shell/getting-started/concepts/): the mental model.
- [CLI Reference](/re-shell/cli/overview/): every command group.
- [Template Catalog](/re-shell/templates/catalog/): all 208 templates.
- [Dashboard](/re-shell/dashboard/overview/): the 11 screens in depth.
- [AI](/re-shell/cli/ai/), [service bridge](/re-shell/cli/service-bridge/),
  [Kubernetes](/re-shell/cli/k8s-helm-gitops/): the larger features.
