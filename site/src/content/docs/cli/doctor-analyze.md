---
title: "doctor & analyze"
description: "Health checks and bundle, dependency, performance, and security analysis."
---

Two diagnostic commands sit at the top level: `doctor` for monorepo health (with
explanations and a safe, dry-run-by-default remediation planner) and `analyze`
for bundle, dependency, performance, and security analysis. Both speak the typed
[JSON contract](/re-shell/contract/json-contract/).

## `doctor`

Runs a battery of health checks on the current monorepo. With `--explain` it adds
a plain-language cause and a concrete suggested fix for every failing or warning
check; with `--fix` it composes a remediation **plan** that is a dry run by
default and only applies allow-listed commands when you pass `--yes`.

```
Usage: re-shell doctor [options]

Options:
  --explain   Add cause + suggested fix for each failing/warning check
  --fix       Compose a remediation plan (dry run; nothing is changed)
  --yes       Apply the allow-listed command fixes in the plan
  --verbose   Show detailed output for each check
  --json      Output results as JSON
```

```bash
re-shell doctor
re-shell doctor --explain
re-shell doctor --fix            # dry run: prints the plan, changes nothing
re-shell doctor --fix --yes      # applies only the allow-listed command fixes
re-shell doctor --json
re-shell doctor --explain --json
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

### `--explain`: causes and suggested fixes

`--explain` maps each failing or warning check to a plain-language **cause** and a
concrete **suggestion**. The mapping is deterministic and offline — no network
calls and no model required. In `--json` mode the explanations are emitted as a
`suggestions` array alongside `checks`:

```bash
re-shell doctor --explain --json
```

```json
{
  "ok": true,
  "data": {
    "checks": [ /* ...as above... */ ],
    "suggestions": [
      {
        "checkId": "security-audit",
        "cause": "The package audit reported known security vulnerabilities in the dependency tree.",
        "suggestion": "Run \"pnpm audit fix\" to apply available patches automatically.",
        "fixable": true,
        "fixCommand": "pnpm audit fix"
      },
      {
        "checkId": "git-config",
        "cause": "The git setup is incomplete (no repo, missing .gitignore, or uncommitted changes).",
        "suggestion": "Initialize git with \"git init\", add a .gitignore, and commit pending work.",
        "fixable": true,
        "fixCommand": "git init"
      },
      {
        "checkId": "large-files",
        "cause": "Large files were found in the tree that probably should not be committed.",
        "suggestion": "Move them to Git LFS or add them to .gitignore.",
        "fixable": false
      }
    ]
  },
  "warnings": []
}
```

Each `suggestion` carries a stable `checkId`, the `cause`/`suggestion` text, and a
`fixable` flag. `fixCommand` is present **only** when `fixable` is `true` and the
fix is a command (manual edits carry no `fixCommand`). The `fixCommand` is
package-manager-aware: it resolves to your detected manager (for example yarn
correctly uses `yarn upgrade`, not `yarn update`).

### `--fix`: dry-run-by-default remediation plan

`--fix` composes a remediation **plan** from the suggestions. By default it is a
**dry run**: it prints (or emits) the plan and **changes nothing on disk**. Only
when you add `--yes` does it execute the plan — and even then it runs **only the
allow-listed commands** (e.g. `npm/pnpm/yarn/bun audit fix`, `… update`/`upgrade`,
`… install`, and `git init`). Every other suggestion stays a documented manual
step that is never executed.

```bash
re-shell doctor --fix --json          # dry run
```

```json
{
  "ok": true,
  "data": {
    "plan": {
      "applied": false,
      "steps": [
        { "checkId": "security-audit", "description": "Run: pnpm audit fix", "command": "pnpm audit fix", "applied": false },
        { "checkId": "git-config", "description": "Run: git init", "command": "git init", "applied": false },
        { "checkId": "large-files", "description": "Move them to Git LFS or add them to .gitignore.", "applied": false }
      ]
    },
    "suggestions": [ /* same shape as --explain */ ]
  },
  "warnings": []
}
```

On the default path `plan.applied` is `false` and every step's `applied` is
`false`. Executable steps carry a `command`; manual steps omit it. When you run
`--fix --yes`, `plan.applied` becomes `true` and each allow-listed command step
that ran successfully flips to `"applied": true` — manual steps and any
non-allow-listed or failed command stay `"applied": false`.

> **Safety note.** `--fix` is a dry run by default and **writes nothing** without
> the explicit `--yes` confirmation. With `--yes`, only commands on the built-in
> allow-list are ever executed; anything else is reported as a manual step and is
> never run. This keeps `doctor --fix` safe to pipe into CI for previewing
> remediation without side effects.

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
re-shell doctor --explain --json > doctor-explain.json   # causes + suggestions
re-shell doctor --fix --json > doctor-plan.json          # dry-run plan, no writes
re-shell analyze --type security --json > security.json
```

The `--fix` dry-run plan is side-effect-free, so it is safe to capture in CI to
preview remediation; gate any actual application behind an explicit `--yes` step.

The `suggestions[]` and `plan` shapes (`Suggestion`, `FixPlan`, `FixPlanStep`)
are part of the typed [JSON Contract](/re-shell/contract/json-contract/).

## See also

- [workspace health](/re-shell/cli/workspace/#workspace-health) — scored
  topology diagnostics.
- [security](/re-shell/cli/security/) — security generators.
- [JSON Contract](/re-shell/contract/json-contract/).
