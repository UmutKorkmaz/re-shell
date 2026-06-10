---
title: "ai"
description: "Offline natural-language to command resolver that never auto-runs."
---

`ai` resolves a natural-language prompt into a concrete Re-Shell command. It is
**offline** — no LLM backend, no network, no telemetry — and it **never
auto-runs** a command unless you explicitly confirm with `--run`.

```
Usage: re-shell ai [options] <prompt...>

Arguments:
  prompt      Natural-language description of what you want to do

Options:
  --json      Output the resolved spec as JSON
  --explain   Include a human explanation of the resolved command
  --run       Execute the resolved command after explicit confirmation
```

## How it works

The resolver matches your prompt against the machine-readable
[command catalog](/re-shell/cli/overview/#command-introspection) and returns the
best-matching command with a confidence score, plus alternatives. If nothing
matches confidently, it returns `needsClarification: true` instead of guessing.

## Resolve a command

```bash
re-shell ai "list templates as json" --json
```

```json
{
  "ok": true,
  "data": {
    "needsClarification": false,
    "resolved": {
      "path": "templates list",
      "description": "List available framework templates",
      "argv": ["templates", "list", "--json"],
      "confidence": 0.875,
      "destructive": false,
      "supportsJson": true,
      "supportsDryRun": false
    },
    "confidence": 0.875,
    "alternatives": [
      { "path": "config template list", "argv": ["config", "template", "list", "--json"], "confidence": 0.3636 }
    ]
  },
  "warnings": []
}
```

## When it can't match

```bash
re-shell ai "do something vague please" --json
```

```json
{
  "ok": true,
  "data": {
    "needsClarification": true,
    "reason": "no-match",
    "question": "I could not match that to a known command. Try naming a command, e.g. \"list templates\" or \"check workspace health\".",
    "candidates": []
  },
  "warnings": []
}
```

## Safety model

- **Offline only.** The intent parser is local; there is no LLM call. A
  pluggable model abstraction is planned but not wired (see
  [Roadmap](/re-shell/roadmap/)).
- **Never auto-executes.** Without `--run`, `ai` only *resolves* — it prints the
  command it would run. `--run` requires explicit confirmation.
- **No shell.** When `--run` does execute, it spawns `re-shell` without
  `shell: true`, so the resolved argv cannot be injected into a shell.

```bash
# Explain what it resolved, but do not run it
re-shell ai "check workspace health" --explain

# Resolve and run, after confirmation
re-shell ai "check workspace health" --run
```

## `ai create` — plan a project scaffold

`ai create "<description>"` turns a free-text project description into a
**reviewable, dry-run-by-default** plan of *real* Re-Shell commands. It is the
same offline, deterministic posture as `ai`: the description is parsed against
the real template registry and every component is resolved to a **real** template
id using the shared ranker (the same one [`find`](/re-shell/cli/find/) uses).
Unresolvable mentions are dropped, never invented.

```
Usage: re-shell ai create [options] <description...>

Arguments:
  description   Natural-language description of the project to scaffold

Options:
  --json        Output the plan as a validated JSON envelope
  --yes         Execute the planned commands in order (default: dry-run only)
```

### Example

```bash
re-shell ai create "a react shell + fastapi auth service + postgres, on k8s"
```

```text
🧩 Scaffold plan (dry-run)

  project: react-shell-fastapi
  templates: react, fastapi, comprehensive-auth-service, postgres-config, k8s

Steps:
  1. re-shell create react-shell-fastapi --template react
     Create the shell app "react-shell-fastapi" using the React frontend template
  2. re-shell generate backend fastapi-service --framework fastapi
     Generate the "fastapi-service" service using the FastAPI backend template
  3. re-shell generate backend comprehensive-auth-service --framework comprehensive-auth-service
     Generate the "comprehensive-auth-service" service using the OAuth 2.0 / OpenID Connect Auth Service backend template
  4. re-shell generate backend postgres-config --framework postgres-config
     Generate the "postgres-config" datastore integration using the PostgreSQL Advanced Configuration template
  5. re-shell k8s generate
     Generate Kubernetes manifests from the workspace config

Nothing was written. Re-run with --yes to execute the plan.
```

Every step is a **real** command composed from real flags:

- a frontend framework → `create <name> --template <id>`
- each backend → `generate backend <name>-service --framework <id>`
- each datastore → `generate backend <id> --framework <id>`
- `k8s`/`kubernetes` → `k8s generate`; `helm` → `k8s helm <name>`; `gitops` → `k8s gitops <name>`

### Safety: dry-run by default, `--yes` to execute

- **Dry-run by default.** Without `--yes`, `ai create` only *plans* — it resolves
  the templates, composes the commands, and prints (or emits) the plan. It
  **writes nothing and runs nothing**.
- **`--yes` executes.** With `--yes`, the planned commands run in order by
  spawning the real `re-shell` binary **without a shell** (argv passed
  element-by-element), so no token can ever be re-interpreted as shell syntax.
  The project name is sanitised to a safe `[a-z0-9-]` slug, so description text
  can never reach the command line.

### Offline-first, optional provider

- **Offline + deterministic by default.** The same description always yields the
  same plan. There is no network call on the default path.
- **Optional planner provider (off by default).** A pluggable LLM planner *may*
  propose an intent, but it is **off by default** and any proposal is funnelled
  through a sanitiser that drops every id that is not a real registry id — so the
  plan can only ever reference real templates and commands, exactly like the
  offline path.

### JSON plan shape

```bash
re-shell ai create "a react shell + fastapi auth service + postgres, on k8s" --json
```

The `--json` envelope validates against `jsonResponseSchema(aiPlanResponseSchema)`
from `@re-shell/contracts`. `data` is `{ intent, plan }`:

```json
{
  "ok": true,
  "data": {
    "intent": {
      "description": "a react shell + fastapi auth service + postgres, on k8s",
      "projectName": "react-shell-fastapi",
      "frontend": { "kind": "frontend", "term": "react", "id": "react", "title": "React", "score": 1, "matched": ["react"] },
      "backends": [
        { "kind": "backend", "term": "fastapi", "id": "fastapi", "title": "FastAPI", "score": 1, "matched": ["fastapi"] }
      ],
      "datastores": [
        { "kind": "datastore", "term": "postgres", "id": "postgres-config", "title": "PostgreSQL Advanced Configuration", "score": 1, "matched": ["postgres", "config"] }
      ],
      "infra": [
        { "kind": "infra", "term": "k8s", "id": "k8s", "title": "Generate Kubernetes manifests from the workspace config", "score": 1, "matched": ["k8s"] }
      ]
    },
    "plan": {
      "applied": false,
      "steps": [
        {
          "command": ["create", "react-shell-fastapi", "--template", "react"],
          "description": "Create the shell app \"react-shell-fastapi\" using the React frontend template",
          "template": "react",
          "why": "Description mentioned \"react\", resolved to template react",
          "applied": false
        },
        {
          "command": ["generate", "backend", "fastapi-service", "--framework", "fastapi"],
          "description": "Generate the \"fastapi-service\" service using the FastAPI backend template",
          "template": "fastapi",
          "why": "Description mentioned \"fastapi\", resolved to template fastapi",
          "applied": false
        },
        {
          "command": ["k8s", "generate"],
          "description": "Generate Kubernetes manifests from the workspace config",
          "why": "Description mentioned \"k8s\"",
          "applied": false
        }
      ],
      "resolved": ["react", "fastapi", "postgres-config", "k8s"]
    }
  },
  "warnings": []
}
```

`plan.applied` is `false` on the dry-run path and only becomes `true` after a
`--yes` run; each step carries its own `applied` flag. See the
[JSON Contract](/re-shell/contract/json-contract/) page for the canonical
envelope and the `aiPlanResponseSchema` shape.

## See also

- [CLI Overview](/re-shell/cli/overview/) — the catalog the resolver reads.
- [find](/re-shell/cli/find/) — the same ranker that resolves templates here.
- [generate](/re-shell/cli/generate/) — the backend/service commands a plan composes.
- [JSON Contract](/re-shell/contract/json-contract/) — the `aiPlanResponseSchema` envelope.
- [Roadmap](/re-shell/roadmap/) — the optional, provider-abstracted AI layer.
