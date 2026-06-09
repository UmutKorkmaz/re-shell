---
title: "Quickstart"
description: "Go from install to a running workspace and dashboard in about five minutes."
---

This walkthrough takes you from an empty directory to a working monorepo with a
backend service and the live mission-control dashboard. It assumes you have
[installed the CLI](/re-shell/getting-started/install/) and are on Node.js 18+.

## 1. Initialize a workspace

`re-shell init` scaffolds a monorepo: package-manager config, workspace layout,
linting, Docker, and a `pnpm-workspace.yaml`/`turbo.json` so tooling works out of
the box.

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

## 2. Scaffold a backend service

Preview before you write. `templates apply` is a dry-run that computes the exact
file set a scaffold would produce, without touching your workspace:

```bash
re-shell templates apply express --name billing
```

```
🔍 Dry run: express → "billing"

Would create 27 files (39040 bytes). Nothing written.

  + package.json (2360b)
  + src/index.ts (2915b)
  + src/controllers/auth.controller.ts (3328b)
  + src/routes/index.ts (608b)
  ...
```

Then generate the real service:

```bash
re-shell generate backend billing --framework express --language typescript
```

Browse all 205 templates across 36 languages with
[`templates list`](/re-shell/cli/templates/), or read the
[Template Catalog](/re-shell/templates/catalog/).

## 3. Check workspace health

Every data command speaks the typed [JSON contract](/re-shell/contract/json-contract/).
Run a health check both ways — human-readable and machine-readable:

```bash
re-shell workspace health
re-shell workspace health --json
```

```json
{
  "ok": true,
  "data": {
    "score": 50,
    "status": "critical",
    "checks": [
      { "name": "Workspaces", "status": "warning", "message": "No workspaces found in monorepo" }
    ]
  },
  "warnings": ["No workspaces found in monorepo"]
}
```

A fresh, empty workspace scores low until you add packages — that is expected.

## 4. Open the dashboard

`re-shell ui` launches the bundled **mission-control dashboard**: a
token-authenticated, `127.0.0.1`-bound web app for inspecting your workspace.

```bash
re-shell ui
```

This opens `http://127.0.0.1:3333` with seven screens — Overview, Workspace
Graph, Templates, Command Builder, Jobs & Logs, Health, and Settings. The
dashboard talks to the CLI over a hardened local hub (see
[Dashboard](/re-shell/dashboard/overview/) and the
[Secure Hub](/re-shell/architecture/secure-hub/) architecture).

Preview the launch plan without starting anything:

```bash
re-shell ui --dry-run
re-shell ui --json
```

## 5. Diagnose your environment

`doctor` runs health checks on the monorepo and can auto-fix common issues:

```bash
re-shell doctor
re-shell doctor --fix
re-shell doctor --json
```

## Where to go next

- [Core Concepts](/re-shell/getting-started/concepts/) — the mental model.
- [CLI Reference](/re-shell/cli/overview/) — every command group.
- [Template Catalog](/re-shell/templates/catalog/) — all 205 frameworks.
- [Dashboard](/re-shell/dashboard/overview/) — the seven screens in depth.
