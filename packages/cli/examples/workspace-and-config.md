# Workspace And Config

These workflows cover workspace topology, diagnostics, backup/state management, and layered configuration.

## Workspace Basics

```bash
re-shell workspace list --type app --framework react
re-shell workspace validate --fix
re-shell workspace health --verbose
re-shell workspace optimize --type performance --severity high
```

## Workspace Definitions And Graphs

```bash
re-shell workspace def init --dry-run
re-shell workspace def auto-detect --merge --dry-run
re-shell workspace def validate --strict
re-shell workspace graph --format mermaid --output workspace-graph.mmd
re-shell workspace graph-analysis analyze --detailed
re-shell workspace graph-analysis cycles
re-shell workspace graph-analysis order --json
re-shell workspace graph-analysis visualize --output graph.json
```

## Workspace Documentation And Diagnostics

```bash
re-shell workspace docs --output WORKSPACE.md --format markdown
re-shell workspace diff --from .re-shell/backups/base.yaml --to re-shell.workspaces.yaml --format markdown
re-shell workspace diagnostics check --detailed
re-shell workspace diagnostics topology --json
re-shell workspace diagnostics watch
```

## Workspace State, Templates, And Backups

```bash
re-shell workspace state status --verbose
re-shell workspace state backup --output .re-shell/state-backup.json
re-shell workspace state cache --clear
re-shell workspace tpl list
re-shell workspace tpl apply service-defaults --variables '{"runtime":"node"}'
re-shell workspace backup create --name pre-upgrade --description "Before config migration"
re-shell workspace backup list --verbose
re-shell workspace backup compare backup-a backup-b
```

## Core Config Operations

```bash
re-shell config show --json
re-shell config get packageManager --global
re-shell config set packageManager pnpm --global
re-shell config preset save team-standard
re-shell config preset load team-standard
re-shell config backup
```

## Environment And Unified Config Sync

```bash
re-shell config env list
re-shell config env create staging --extends development
re-shell config env set staging
re-shell config env compare development staging
re-shell config env generate staging --output .env.staging
re-shell config unified sync development staging production --dry-run
re-shell config unified snapshot production --version 2026-03-23
```

## Schema, Validation, Migration, And Profiles

```bash
re-shell config schema publish --output-dir schemas
re-shell config validate all --fix
re-shell config migrate check
re-shell config migrate auto
re-shell config project init --framework react --package-manager pnpm
re-shell config workspace init
```

```bash
re-shell config profile create --framework react
re-shell config profile activate frontend-dev
re-shell config profile env add frontend-dev API_URL https://api.example.com
re-shell config profile env validate frontend-dev
re-shell config profile template list
re-shell config backup-mgr create --full --name before-sync
```
