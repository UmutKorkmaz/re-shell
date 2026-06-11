---
title: "cache (build cache)"
description: "Content-addressed build cache for re-shell run: deterministic cache keys, local + remote (hub) backends with CI hydration, HMAC-signed tamper-evident artifacts, and cache stats / clean."
---

`re-shell run` is backed by a **content-addressed build cache**. When a task's
inputs haven't changed, its result is replayed from the cache instead of being
re-run: the declared outputs are restored to disk, the captured logs are
replayed, and the node is reported as `cached` with **no process spawned**.

The cache is **on by default**, fully **offline and deterministic**, and
**tamper-evident**: every cached artifact is HMAC-signed and re-verified before
it is ever trusted. A corrupt or tampered entry is treated as a miss, so a bad
cache can never poison a build — the worst case is a normal run.

```bash
re-shell run build                 # 1st run: spawns + caches each task
re-shell run build                 # 2nd run: every unchanged task is `cached`
re-shell run build --no-cache      # bypass the cache entirely (always spawn)
re-shell run build --cache-dir /tmp/rs-cache
re-shell cache stats               # size, entry count, hit-rate
re-shell cache clean               # prune the whole local cache
```

## How a cache key is computed

A cache key uniquely identifies the **result** of running one `(package, task)`.
Two runs that would produce the same artifacts always produce the same key, and
any change that could alter the result produces a different key. The key is a
single SHA-256 over a canonical, sorted-key JSON of five inputs:

1. **Task command** — the `package.json` script *body* for the task (not just
   its name). Changing `tsc` to `tsc --strict` changes the key.
2. **Input file hashes** — the SHA-256 of every input file, folded in as
   `relPath\0sha256` so both a content change *and* a rename change the key. By
   default the input set is the whole package directory minus declared
   `outputs`, `node_modules`, `.git`, `.re-shell`, and `dist`. Declare explicit
   `inputs` globs to narrow it.
3. **Dependency closure keys** — the cache keys of the task's upstream
   dependency edges (sorted, so the order they were discovered in is
   irrelevant). An upstream change therefore cascades into every downstream key.
4. **Toolchain fingerprint** — `process.version` (Node), the detected package
   manager, and any per-language versions discovered **offline** from
   `.nvmrc`, `.node-version`, `.python-version`, `.tool-versions`, the `go`
   directive of `go.mod`, and `rust-toolchain[.toml]` at both the package and
   the workspace root. Bumping any of these invalidates the cache.
5. **Allow-listed environment subset** — only `NODE_ENV`, `CI`, `BABEL_ENV`,
   `GO_ENV`, and `PYTHON_ENV` can influence a key. Any other environment
   variable is invisible to the cache, so a noisy local shell never busts it.

Nothing here spawns a process, reads the network, or reads a clock — the same
tree on disk always yields the same key, which is what makes the cache safe.

## Declaring `inputs` and `outputs`

The cache learns what to hash and what to restore from the `tasks` config in
`re-shell.workspaces.yaml`. Both globs are optional and resolved relative to each
package directory:

```yaml
tasks:
  build:
    dependsOn: ["^build"]
    inputs: ["src/**", "package.json", "tsconfig.json"]
    outputs: ["dist/**"]
```

- **`outputs`** are the artifacts captured on a miss and restored on a hit. They
  are also excluded from the default input set so a task's own output never feeds
  back into its own key. Without `outputs`, nothing is restored on a hit (the
  task is still skipped, but it must produce no files to be useful).
- **`inputs`** narrow the hashed file set. Omit it to hash the whole package
  directory (minus the excluded dirs above). Narrowing `inputs` to the files a
  task actually reads gives more cache hits.

## What gets cached

Only **successful** runs (exit code `0`) are cached — a failure is never
replayed as a hit. Each cached entry records:

- the **exit code**,
- the **captured output artifacts** (the bytes of every file matching `outputs`),
- the **combined stdout/stderr logs**, replayed verbatim on a hit, and
- the **SHA-256 of every artifact**, which binds the bytes to the entry.

On a hit the runner restores the outputs to disk (with a path-traversal guard
that refuses to write outside the package directory) and replays the logs,
without spawning the script.

## Local vs remote (hub) backends

Both backends implement the same content-addressed contract — `has`, `get`,
`put` — so the runner treats them identically.

### Local filesystem cache (default)

Entries live under the workspace-local `.re-shell/cache` directory, sharded by
the first two hex characters of the key (`<root>/<key[0:2]>/<key>/`). Each entry
is written atomically: artifacts and the record are built in a temp directory,
then moved into place. Use `--cache-dir` (or `--cache-dir` on the `cache`
commands) to point at a different root, e.g. a shared mount.

### Remote cache + CI hydration (off by default)

A remote cache (served by the hardened local hub) is **off** unless you opt in:

```bash
export RE_SHELL_REMOTE_CACHE="https://hub.internal/cache-api"
export RE_SHELL_REMOTE_CACHE_TOKEN="…"   # optional bearer token
re-shell run build
```

When configured, lookups are **remote-then-local**: a CI runner with an empty
local store hydrates from the remote first. A remote hit is **seeded into the
local store** so subsequent runs hit instantly. On a miss, the freshly captured
entry is pushed to the remote (best-effort — a push failure never fails the
build). The remote uses the same HMAC verification as the local backend; a
tampered envelope is rejected and surfaced as a miss.

## HMAC signing and tamper rejection

Every entry is signed with an HMAC-SHA-256 secret from `RE_SHELL_CACHE_SECRET`
(falling back to a stable per-machine default for purely local use). For a
**shared or remote** cache you **must** set an explicit secret on every machine
that reads or writes it.

On `put`, three things are signed: the record, the canonical digest of the
artifact set, and the SHA-256 of each individual artifact. On `get`, all three
are re-verified — the record signature, the files-digest signature, **and** a
re-hash of every artifact against its bound SHA-256. Signature comparison is
constant-time. **Any** mismatch — a flipped byte in an artifact, an edited
record, an added/removed file, or the wrong secret — rejects the *whole* entry,
which the runner treats as a miss and falls back to a real run.

## `--no-cache`

`re-shell run <task> --no-cache` disables the cache for that invocation: every
task is spawned, nothing is read from or written to the cache, and no task is
ever reported as `cached`. Use it to force a clean run or to measure cold-build
time.

## `cache stats`

Read-only, offline summary of the local cache root:

```bash
re-shell cache stats
re-shell cache stats --json
re-shell cache stats --cache-dir /tmp/rs-cache
```

```
▶ build cache stats

  location  /repo/.re-shell/cache
  entries   42
  size      18.3 MiB
  hit-rate  74.2% (115 hits / 40 misses)
```

The hit-rate is cumulative across runs (tracked in a small telemetry file
alongside the entries) and reads `n/a` until at least one run has been recorded.

`--json` emits a single-line typed envelope conforming to the
[JSON contract](/re-shell/contract/json-contract/):

```json
{
  "ok": true,
  "data": {
    "location": "/repo/.re-shell/cache",
    "entries": 42,
    "sizeBytes": 19184384,
    "hits": 115,
    "misses": 40,
    "hitRate": 0.742
  }
}
```

`hitRate` is `null` when no runs have been recorded.

## `cache clean`

Prune the entire local cache and reset its telemetry:

```bash
re-shell cache clean
re-shell cache clean --json
re-shell cache clean --cache-dir /tmp/rs-cache
```

```json
{
  "ok": true,
  "data": {
    "location": "/repo/.re-shell/cache",
    "removedEntries": 42,
    "reclaimedBytes": 19184384
  }
}
```

Cleaning a non-existent cache root is a no-op (zeros). On error, both commands
emit a `CACHE_ERROR` envelope in `--json` mode and exit non-zero.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `RE_SHELL_CACHE_SECRET` | HMAC secret for signing/verifying artifacts. Required for any shared or remote cache. |
| `RE_SHELL_REMOTE_CACHE` | Base URL of the remote cache. Setting it (non-empty) enables the remote backend. |
| `RE_SHELL_REMOTE_CACHE_TOKEN` | Optional bearer token sent as `Authorization: Bearer <token>` to the remote. |
| `NODE_ENV`, `CI`, `BABEL_ENV`, `GO_ENV`, `PYTHON_ENV` | The only environment variables that participate in a cache key. |
