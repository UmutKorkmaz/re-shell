---
title: "run"
description: "Dependency-aware task runner: build/test across the workspace in topological order, with --affected, bounded concurrency, and a typed JSON contract."
---

`re-shell run <task>` runs a script across every workspace package **in
dependency order**. It builds an execution DAG of `(package, task)` nodes from
your workspace dependency graph plus an optional `tasks` config, detects cycles
*before* anything runs, then executes with bounded parallelism. Packages that
don't define the script are skipped — their dependents still run.

```bash
re-shell run build
re-shell run test --affected
re-shell run lint --filter web --filter api
re-shell run build --concurrency 1 --json
```

```
Usage: re-shell run [options] <task>

Arguments:
  task                  Task/script name to run, e.g. build or test

Options:
  --affected            Only run for packages affected by current changes
  --concurrency <n>     Max parallel tasks (default: CPU count)
  --filter <pkg...>     Restrict to specific package name(s)
  --json                Output the run summary as a JSON envelope
  --continue            Continue scheduling unaffected branches after a failure
  --no-cache            Disable the content-addressed build cache
  --cache-dir <dir>     Override the cache directory (default: <root>/.re-shell/cache)
```

## How ordering works

For each requested `(package, task)`, the runner expands the full set of nodes
that must run and wires two kinds of edges:

- **Intra-package** (`"build"`): a sibling task in the *same* package must
  finish first. By default `test` depends on `build`, so `web:test` waits for
  `web:build`.
- **Upstream** (`"^build"`): the same task on each *upstream workspace
  dependency*. By default `build` depends on `^build`, so if `web` depends on
  `ui`, then `web:build` waits for `ui:build`.

A package's upstream dependencies are derived from its `package.json`
`dependencies`/`devDependencies` that resolve to **other packages in the same
workspace** (registry deps are never edges). Discovery scans the conventional
roots `apps/`, `packages/`, `libs/`, and `tools/`.

### Example

Given `web` → `ui` → `tokens` (each depends on the next):

```bash
re-shell run build
# tokens:build → ui:build → web:build

re-shell run test
# tokens:build → ui:build → web:build, then each package's :test
# (every test waits for its own build and all upstream builds)
```

## The `tasks` config

Defaults work with zero config:

| Task    | Depends on  | Meaning                                  |
| ------- | ----------- | ---------------------------------------- |
| `build` | `^build`    | build all upstream deps first            |
| `test`  | `build`     | build this package before testing it     |

To customise the task graph, add a `tasks` section to
`re-shell.workspaces.yaml` at the workspace root:

```yaml
tasks:
  build:
    dependsOn: ["^build"]
  test:
    dependsOn: ["build", "lint"]   # test waits for this package's build AND lint
  lint:
    dependsOn: []                  # leaf task, no prerequisites
  typecheck:
    dependsOn: ["^build"]          # typecheck after all upstream builds
```

Each task name maps to `{ dependsOn?: string[] }`. An entry is either:

- a **sibling** task name (`"build"`, `"lint"`) — same package, or
- a **`^`-prefixed** task name (`"^build"`) — that task on every upstream
  workspace dependency.

A task present in your config **fully replaces** the default for that name (no
deep-merge of `dependsOn`), so overrides are predictable. Task names match
`^\^?[a-zA-Z0-9][a-zA-Z0-9:_-]*$`.

### Cycle errors

If the resulting graph contains a cycle (e.g. `build → test → build`), the run
**fails before executing anything**:

```bash
re-shell run build
# ✗ Task dependency cycle detected: a#build -> a#test -> a#build
```

The exit code is non-zero and no script is spawned. In `--json` mode this is a
`RUN_ERROR` envelope (see below). Cycles are detected across both intra-package
and upstream edges.

## Caching and outputs

`run` is backed by a **content-addressed build cache** that is on by default.
When a task's inputs are unchanged, its result is replayed from the cache —
declared `outputs` are restored to disk and logs are replayed — and the node is
reported as `cached` with **no spawn**:

```bash
re-shell run build     # 1st run spawns + caches each task
re-shell run build     # 2nd run: unchanged tasks are `cached`
```

Declare each task's `inputs`/`outputs` globs in the `tasks` config so the cache
knows what to hash and what to restore:

```yaml
tasks:
  build:
    dependsOn: ["^build"]
    inputs: ["src/**", "package.json"]
    outputs: ["dist/**"]
```

Cache keys fold in the script body, input file hashes, the dependency closure's
keys, an offline toolchain fingerprint, and an allow-listed env subset, so any
real change busts the cache. Only successful (exit-0) runs are cached, every
artifact is HMAC-signed and re-verified before it is trusted, and a tampered
entry degrades to a normal run. Use `--no-cache` to bypass it and `--cache-dir`
to relocate it. See [cache](/re-shell/cli/cache/) for keys, local vs remote
(hub) backends, CI hydration, and `cache stats` / `cache clean`.

## `--affected`

`run <task> --affected` scopes the target packages to those impacted by your
current working-tree changes:

```bash
re-shell run test --affected
```

It reads git changes (`git diff --name-only HEAD` plus untracked files), maps
each file to its owning package, and expands that set with its **transitive
dependents** (a change to an upstream package affects everything downstream of
it). The analysis is fully offline and deterministic; if git is unavailable it
degrades to "nothing affected" rather than failing.

Upstream builds still run when a downstream package needs them. If only `web`
changed and `web` depends on `ui`, then `run test --affected` runs `ui:build`,
`web:build`, and `web:test` — but **not** `ui:test`.

## `--concurrency` and `--filter`

- `--concurrency <n>` caps how many tasks run in parallel. The default is your
  CPU count. `--concurrency 1` serialises the whole plan while still honouring
  dependency order.
- `--filter <pkg...>` restricts the **root** target packages by name (repeatable
  or comma-separated). Upstream dependencies the targets need are still pulled
  in automatically.

```bash
re-shell run build --filter web,api
re-shell run test --concurrency 4
```

Scripts run via the detected package manager (`pnpm` / `yarn` / `npm`, chosen by
the nearest lockfile) as an **argv array with `shell: false`** — package and
task names are never interpreted by a shell.

## JSON output

`--json` emits a single-line typed envelope conforming to the
[JSON contract](/re-shell/contract/json-contract/):

```json
{
  "ok": true,
  "data": {
    "task": "build",
    "concurrency": 8,
    "results": [
      { "package": "ui",  "task": "build", "status": "success", "exitCode": 0,    "durationMs": 412 },
      { "package": "web", "task": "build", "status": "success", "exitCode": 0,    "durationMs": 880 }
    ],
    "affected": ["web"]
  }
}
```

- `results` is ordered for stable display. Each entry's `status` is one of
  `"success"`, `"cached"`, `"failed"`, or `"skipped"`. A `"cached"` node was
  replayed from the [build cache](/re-shell/cli/cache/) instead of being spawned
  (its outputs were restored and its logs replayed). `exitCode` is `null` for
  skipped nodes (the package had no such script, or an upstream dependency
  failed).
- `affected` is present only when `--affected` was used.
- A failing task still produces `ok: true` (the run completed) with the failure
  recorded in `results`; the **process exit code** is non-zero so CI fails.
- A dependency **cycle** produces `ok: false` with error code `RUN_ERROR` and an
  empty plan — nothing ran:

```json
{ "ok": false, "error": { "code": "RUN_ERROR", "message": "Task dependency cycle detected: a#build -> a#test -> a#build", "details": { "task": "build", "cycle": ["a#build", "a#test", "a#build"] } } }
```

## Polyglot by design

`run` is task-name-agnostic and language-agnostic: it orchestrates whatever
`scripts` each `package.json` declares. The same command sequences a TypeScript
frontend, a Python service wrapper, and a Go tool in one dependency-ordered
pass, because edges come from the workspace graph and the `tasks` config — not
from any single toolchain. A package that doesn't define the requested script is
simply skipped, so heterogeneous workspaces compose without special-casing.

## Failure behaviour

- A task that exits non-zero is recorded as `failed`; its dependents are
  cascaded to `skipped` (never spawned) so the run still terminates.
- The overall process exits non-zero if **any** task failed or a cycle was
  detected.
- `--continue` keeps scheduling independent branches after a failure rather than
  winding down.
