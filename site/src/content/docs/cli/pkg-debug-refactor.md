---
title: "pkg, debug & refactor"
description: "One package-manager command for every ecosystem, VS Code debug configurations for every service, and a workspace-wide service rename."
---

Three commands that treat a polyglot workspace as one thing. They all work from the
services declared in `re-shell.workspaces.yaml` and all support `--json` and
`--dry-run`.

## `pkg`: one package manager across ecosystems

```bash
re-shell pkg --help
```

| Subcommand | Does |
| --- | --- |
| `pkg add <packages...>` | Add packages with the ecosystem's own package manager (`--dev` for development dependencies). |
| `pkg remove <packages...>` | Remove packages. |
| `pkg install` | Install or restore all dependencies. |
| `pkg list` | List declared dependencies, parsed from the manifests and **normalized** across ecosystems. |
| `pkg outdated` | Report outdated dependencies using the native outdated command, normalized. |

Supported ecosystems: `npm`, `pnpm`, `yarn`, `bun`, `pip`, `poetry`, `uv`, `cargo`,
`maven`, `gradle`, `dotnet`, `composer`, `bundler`, `go`. The ecosystem is detected
from the manifest and lockfile in the target directory; `--ecosystem <id>` overrides
it. Target a directory with `--path <dir>` (default: the current one) or a workspace
service with `--service <name>`.

```bash
re-shell pkg add zod --service api
re-shell pkg add pytest --service analytics --dev
re-shell pkg list --service api --json
re-shell pkg outdated --service billing
re-shell pkg add left-pad --service api --dry-run     # prints the native command, runs nothing
```

`pkg` calls the real tool (`pnpm add`, `poetry add`, `cargo add`, `go get`, ...), so
that tool must be installed: a missing one fails with a `PKG_TOOLCHAIN_MISSING`
error rather than being skipped, and `--dry-run` shows the exact native command
first. `pkg list` reads the manifests directly and works without the tool. A sample
`pkg list --service api --json`:

```json
{
  "ok": true,
  "data": {
    "operation": "list",
    "ecosystem": "npm",
    "detectedBy": "package.json without a lockfile (defaulting to npm)",
    "service": "api",
    "dependencies": [
      { "name": "express", "requested": "^4.19.0", "kind": "prod", "ecosystem": "npm", "manifest": "package.json" }
    ],
    "outdated": []
  },
  "warnings": []
}
```

(Abbreviated.) The commands are tested against real npm, pnpm, yarn and bun where
those are installed; the other ecosystems' command construction is tested without
running the tool.

## `debug config`: cross-language debug configurations

```bash
re-shell debug config                                  # .vscode/launch.json + docker-compose.debug.yml
re-shell debug config --services api,billing --dry-run
re-shell debug config --no-compose --out .vscode/launch.json
```

Generates a VS Code `launch.json` with an **attach** (and, where the runtime supports
it, **launch**) configuration per service, plus a **compound** configuration that
starts them together, and a docker-compose override that exposes each service's
debug port. Supported runtimes: Node, Bun, Python, Go, Rust, Java, PHP, Ruby and
.NET. Ports are allocated without collisions (Node 9229 and up, Java 5005, Python
5678, ...). An existing `launch.json` is **merged**, not overwritten: your own
configurations and your comments are preserved and only the entries this command
owns are added or updated. The output is configuration; this was
not tested by attaching a real debugger.

## `refactor rename-service`

Renames a service everywhere in one step:

```bash
re-shell refactor rename-service billing payments --dry-run   # unified diff, nothing written
re-shell refactor rename-service billing payments
```

It updates the workspace config, compose files, Kubernetes and Helm manifests
(including renaming files such as `deployment-billing.yaml`), package manifests,
references in other services (URLs such as `http://billing:8081`) and the service's
directory. `--dry-run` prints a unified diff of every change. It refuses to run in a
git repository with uncommitted changes unless you pass `--force`, and moves the
directory with `git mv` when the repository tracks it. A failed rename is rolled
back. The residue it cannot rewrite safely (for example a name inside source code)
is listed in the result rather than silently skipped.

## See also

- [service & bridge](/re-shell/cli/service-bridge/): link services with typed clients.
- [k8s / Helm / GitOps](/re-shell/cli/k8s-helm-gitops/): the manifests a rename also updates.
- [workspace](/re-shell/cli/workspace/): the graph these commands read.
