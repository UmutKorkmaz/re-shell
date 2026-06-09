---
title: "doctor & analyze"
description: "Health checks and bundle, dependency, performance, and security analysis."
---

Two diagnostic commands sit at the top level: `doctor` for monorepo health (with
optional auto-fix) and `analyze` for bundle, dependency, performance, and
security analysis. Both speak the typed
[JSON contract](/re-shell/contract/json-contract/).

## `doctor`

Runs a battery of health checks on the current monorepo and can fix common
issues in place.

```
Usage: re-shell doctor [options]

Options:
  --fix       Automatically fix detected issues where possible
  --verbose   Show detailed suggestions for each check
  --json      Output results as JSON
```

```bash
re-shell doctor
re-shell doctor --fix --verbose
re-shell doctor --json
```

```json
{
  "ok": true,
  "data": {
    "checks": [
      { "name": "package-json", "status": "success", "message": "Package.json structure is valid" },
      { "name": "dependency-duplicates", "status": "success", "message": "No dependency version conflicts found" },
      { "name": "security-audit", "status": "warning", "message": "Security audit completed with warnings", "suggestion": "Review audit output manually" },
      { "name": "workspace-config", "status": "warning", "message": "No workspaces found", "suggestion": "Add workspaces to your monorepo using \"re-shell create\"" },
      { "name": "git-config", "status": "warning", "message": "Git repository not initialized", "suggestion": "Initialize git repository with \"git init\"" }
    ]
  },
  "warnings": ["Security audit completed with warnings", "No workspaces found"]
}
```

Checks cover package.json structure, dependency duplicates, outdated
dependencies, security audit, workspace config, git config, build config, large
files, disk space, and broken symlinks.

## `analyze`

Analyzes the project across four dimensions and rolls them up.

```
Usage: re-shell analyze [options]

Options:
  --workspace <name>  Analyze a specific workspace only
  --type <type>       bundle | dependencies | performance | security | all (default: "all")
  --output <file>     Save analysis results to a file
  --verbose           Show detailed breakdown
  --json              Output results as JSON
```

```bash
re-shell analyze
re-shell analyze --type security
re-shell analyze --workspace storefront --type bundle --json
re-shell analyze --type all --output analysis.json --json
```

The `--json` output is a contract envelope; on failure it carries
`code: "ANALYZE_ERROR"` and exits non-zero.

## Using these in CI

Because both commands emit the contract envelope and exit non-zero on `ok:
false`, they slot directly into CI gates:

```bash
re-shell doctor --json > doctor.json || echo "doctor failed"
re-shell analyze --type security --json > security.json
```

## See also

- [workspace health](/re-shell/cli/workspace/#workspace-health) — scored
  topology diagnostics.
- [security](/re-shell/cli/security/) — security generators.
- [JSON Contract](/re-shell/contract/json-contract/).
