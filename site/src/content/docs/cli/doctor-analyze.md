---
title: "doctor & analyze"
description: "A health gate, workspace analysis with severity gating, and the CI fixer."
---

Three diagnostic commands sit at the top level: `doctor`, a **health gate** for the
monorepo (with explanations and a safe, dry-run-by-default remediation planner);
`analyze`, real analysis of your workspace with a severity gate; and `fix --ci`, a
gated CI fixer. All speak the typed [JSON contract](/re-shell/contract/json-contract/).

## `doctor`

Runs a battery of health checks on the current monorepo. **It is a gate**: the JSON
envelope is `ok: true` with `healthy` and a `summary`, and the process **exits 1 when
the workspace is unhealthy** (any failed check), so it can stand in a CI pipeline.
Warnings alone leave it healthy. With `--explain` it adds
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
      { "name": "security-audit", "status": "warning", "message": "Security audit completed with warnings", "suggestion": "Review audit output manually" },
      { "name": "git-config", "status": "warning", "message": "Git issues: uncommitted changes", "suggestion": "Review and fix git configuration" },
      { "name": "build-files", "status": "warning", "message": "1 workspaces missing build configuration files", "suggestion": "Add build configuration files (vite.config.ts, etc.)" }
    ],
    "summary": { "passed": 8, "warnings": 3, "errors": 0 },
    "healthy": true
  },
  "warnings": ["Security audit completed with warnings", "Git issues: uncommitted changes", "1 workspaces missing build configuration files"]
}
```

(Abbreviated: the real output lists all 11 checks. This is the output for a fresh
workspace made by the [Quickstart](/re-shell/getting-started/quickstart/).)

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

Analyzes the workspace and rolls the results up. The analysis reads your real
workspace graph, manifests and build output: it is not a template.

```
Usage: re-shell analyze [options]

Options:
  --workspace <name>    Analyze a specific workspace only
  --type <type>         bundle | dependencies | performance | security | scalability | architecture | all (default: "all")
  --fail-on <severity>  Exit non-zero when a finding at or above this severity exists (critical|high|medium|low|info)
  --output <file>       Save analysis results to a file
  --verbose             Show detailed breakdown
  --json                Output results as JSON
```

```bash
re-shell analyze
re-shell analyze --type security
re-shell analyze --type architecture --json
re-shell analyze --type scalability --fail-on high      # gate: exit 1 on a high or critical finding
re-shell analyze --workspace storefront --type bundle --json
re-shell analyze --type all --output analysis.json --json
```

- **`security`**: credentials in source files, secrets in `.env` files or service
  environments, missing lockfiles, unpinned dependencies and container images.
- **`performance`**: deep dependency chains, duplicate dependency versions across the
  workspace, heavy dependencies. (`bundle` and `dependencies` report asset sizes and
  dependency state.)
- **`architecture`**: dependency cycles, fan-in and fan-out hot spots, layering
  violations (an app depending on an app, a package depending on an app), packages
  with no tests.
- **`scalability`**: services without health checks or resource limits, single
  replicas, and single points of failure in the service graph.
- Every finding carries evidence (a `file:line` or a graph path) and a concrete
  recommendation; nothing is templated, a finding exists only when the files show it.
- **`--fail-on <severity>`** turns the analysis into a gate: the command exits non-zero
  (and the envelope reports the findings) when any finding is at or above that severity.

With `--type architecture` or `scalability` the envelope carries a graph summary
and a `findings[]` list with a `summary` by severity and type:

```json
{
  "ok": true,
  "data": {
    "monorepo": "acme-platform",
    "workspaces": 1,
    "types": ["architecture"],
    "graph": { "packages": 1, "edges": 0, "services": 3 },
    "findings": [],
    "summary": {
      "total": 0,
      "bySeverity": { "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0 },
      "byType": { "security": 0, "performance": 0, "scalability": 0, "architecture": 0 }
    }
  },
  "warnings": []
}
```

On failure the envelope carries `code: "ANALYZE_ERROR"` and the command exits
non-zero.

## `fix --ci`

`re-shell fix --ci` runs your workspace's CI gates and, if some fail, tries to fix
them with **validated AI patches on a new branch**. Without `--ci` the command refuses
to claim anything (`FIX_CI_ERROR`).

```bash
re-shell fix --ci                       # run the gates; report only if no provider is configured
ANTHROPIC_API_KEY=... re-shell fix --ci # propose, validate and apply patches on a new branch (dry-run)
re-shell fix --ci --no-dry-run          # also push the branch and open a PR when the gates are green
re-shell fix --ci --max-iterations 3 --skip-gate lint --json
```

How it behaves:

- **Gates** are detected from your package manager and `package.json` scripts
  (typecheck, test, lint, build) and can be configured in `.re-shell/fix-ci.yaml`.
  Each gate runs as a real process (argv, no shell) and passes only on exit 0 within its
  timeout. **Test gates are always locked**: they cannot be skipped, and a workspace
  with no test gate is refused.
- **Preconditions**: a git repository with a clean tree (`--allow-dirty` to override).
- **Without an API key** it is **report-only**: it evaluates the gates and says what
  fails; it attempts and claims no fixes.
- **With a provider** each proposed patch is untrusted: it is rejected if it touches test
  files, type/lint configuration or CI definitions, adds suppression directives
  (`@ts-ignore`, `eslint-disable`, ...), escapes the workspace, exceeds size limits, or
  does not apply cleanly. A patch that makes a gate worse is rolled back.
- **Outcome**: if the gates go green, exactly the touched files are committed on a new
  branch; otherwise every kept patch is rolled back and the branch is deleted. It
  never pushes to or merges into your starting branch, and the default is a dry run
  (`--no-dry-run` pushes and opens the PR with `gh`).

No live model call was made while writing this documentation (no key was available);
the loop, gate evaluator, patch validation, rollback and PR flow are covered by tests
with a stub provider and real git repositories.

## Using these in CI

Because these commands emit the contract envelope and exit non-zero on `ok:
false` (and `doctor` and `analyze --fail-on` also exit non-zero on an unhealthy result), they
slot directly into CI gates:

```bash
re-shell doctor --json > doctor.json || echo "doctor failed"
re-shell doctor --explain --json > doctor-explain.json   # causes + suggestions
re-shell doctor --fix --json > doctor-plan.json          # dry-run plan, no writes
re-shell analyze --type security --json > security.json
re-shell analyze --type all --fail-on high              # fail the build on a high or critical finding
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
