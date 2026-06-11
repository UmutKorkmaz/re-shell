---
title: "agents"
description: "Make a repo agent-ready by construction — generate AGENTS.md + llms.txt and drift-check them in CI. Offline, deterministic."
---

`re-shell agents` makes a repository **agent-ready by construction**. It reads
your workspace graph, each package's `package.json` scripts, and the live command
catalogue, then generates a consistent set of guidance files that AI coding
agents (and humans) can rely on:

- a **root `AGENTS.md`** — project overview, structure from the graph,
  build/test/lint commands, package boundaries, the JSON-contract location, and
  "do-not-touch" zones (build output / generated dirs);
- a **per-package `AGENTS.md`** in every workspace package — that package's
  commands (scoped via `--filter`), boundaries, and internal dependencies;
- an **`llms.txt`-style machine index** — a concise, terse text index of the
  whole workspace surface that an agent can load cheaply.

Everything is **offline and deterministic**: identical inputs produce identical
bytes, which is what makes the drift check a stable CI gate.

```bash
re-shell agents init     # write the docs
re-shell agents sync     # regenerate after a graph change (idempotent)
re-shell agents check    # fail (non-zero) if the on-disk docs are stale
```

## Why it exists

AGENTS.md files drift the moment a package is added, a script is renamed, or a
dependency edge changes. Hand-maintained, they rot silently and start lying to
the very agents that trust them. `re-shell agents` derives them mechanically
from the workspace itself, so they are correct by construction and a single
command keeps them honest.

## Commands

### `agents init`

Generates and **writes** the root + per-package `AGENTS.md` and `llms.txt` to
disk. Run it once to make the repo agent-ready.

```bash
re-shell agents init
re-shell agents init --json
```

### `agents sync`

Regenerates the same files after a graph change (a new package, a renamed
script, a changed dependency). It is **idempotent**: running it when nothing has
changed rewrites identical bytes and leaves a subsequent `check` green.

```bash
re-shell agents sync
```

### `agents check`

The **drift check**. It generates the docs in memory and compares them
byte-for-byte against what is on disk. If any file is **missing** or **stale**,
it exits **non-zero** and prints exactly which files drifted — ideal for CI.

```bash
re-shell agents check
```

## Offline-first

`agents` never touches the network. Discovery walks the workspace on disk
(`pnpm-workspace.yaml` globs, falling back to `packages/*` + `apps/*`), reads
each `package.json`, resolves internal dependency edges, and feeds a plain-data
surface to a **pure generator** with no I/O. The result is deterministic across
machines and runs.

## Drift check in CI

Add `agents check` to your pipeline so a PR that changes the workspace but
forgets to regenerate the docs fails loudly:

```yaml
# .github/workflows/ci.yml
- name: Verify AGENTS.md is up to date
  run: re-shell agents check
```

To fix a failing check locally, run `re-shell agents sync` and commit the result.

## The `llms.txt` index

Alongside the Markdown docs, `agents` writes an `llms.txt` machine index at the
repo root: a terse, line-oriented map of the project, its top-level commands,
every package (with its directory, internal deps, and the path to its
`AGENTS.md`), the JSON-contract location, and the CLI command groups. It is
designed to be the cheapest possible entry point for an agent orienting itself
in the repository.

## JSON output

All three subcommands support `--json` and emit the canonical
`{ ok, data, warnings }` envelope.

`agents init` / `agents sync`:

```json
{
  "ok": true,
  "data": {
    "written": true,
    "files": [
      { "path": "AGENTS.md", "kind": "root", "bytes": 1234 },
      { "path": "packages/cli/AGENTS.md", "kind": "package", "bytes": 567 },
      { "path": "llms.txt", "kind": "index", "bytes": 234 }
    ]
  },
  "warnings": []
}
```

`agents check` (in sync):

```json
{ "ok": true, "data": { "drift": false, "checked": 4, "files": [] }, "warnings": [] }
```

`agents check` (drifted) emits an **error** envelope with `AGENTS_ERROR` and a
non-zero exit; the drift report is carried in `error.details`:

```json
{
  "ok": false,
  "error": {
    "code": "AGENTS_ERROR",
    "message": "Agent docs are out of date: 1 of 4 file(s) drifted. Run `re-shell agents sync`.",
    "details": {
      "drift": true,
      "checked": 4,
      "files": [
        { "path": "packages/cli/AGENTS.md", "kind": "package", "reason": "stale" }
      ]
    }
  },
  "warnings": []
}
```

The shapes are defined as zod schemas in `@re-shell/contracts`
(`agentsDocResponseSchema`, `agentsCheckResponseSchema`) so consumers validate
against one source of truth.
