---
title: "ai"
description: "Resolve natural language to a vetted re-shell command with Anthropic, a local OpenAI-compatible model, or an offline parser. Never auto-runs."
---

`ai` turns a natural-language prompt into a concrete Re-Shell command. It works
with **no network and no key** (the offline parser), and can use a cloud or local
LLM when you configure one. In every mode it only **resolves**: nothing runs
unless you pass `--run` and confirm, and every argument vector it returns has been
checked against the real command catalog.

```
Usage: re-shell ai [options] [command] <prompt...>

Options:
  --json               Output the resolved spec as JSON
  --explain            Include a human explanation of the resolved command
  --run                Execute the resolved command after explicit confirmation
  --session <id>       Use (or create) a multi-turn session
  --continue           Continue the most recent session
  --provider <name>    auto, anthropic, openai-compatible, offline
  --offline            Use only the offline parser (no network)
  --no-cache           Bypass the semantic response cache
  --no-fallback        Fail instead of falling back to the offline parser

Commands:
  create <description...>   Plan a project scaffold (offline, dry-run by default)
  suggest <partial...>      Confidence-scored autocomplete
  session                   Manage multi-turn sessions (.re-shell/ai/sessions)
  cache                     Inspect or clear the semantic response cache
  config                    View or change the provider configuration
```

## Providers

| Provider | What it is | Needs |
| --- | --- | --- |
| `offline` | Local intent parser over the command catalog and workspace graph. Deterministic. | Nothing. |
| `anthropic` | Anthropic Messages API. Default model `claude-opus-5-5` (override with `model`). | `ANTHROPIC_API_KEY` (or `RE_SHELL_AI_API_KEY`). |
| `openai-compatible` | Any server that speaks the OpenAI `/v1` chat API, such as a local model server. | A base URL (`RE_SHELL_AI_BASE_URL` or `ai config set baseUrl ...`); a key only if the server needs one. |

`auto` (the default) picks `openai-compatible` when a base URL is set, otherwise
`anthropic` when an Anthropic key is available, otherwise `offline`. A provider
that errors (timeout, bad key, malformed answer) falls back to the offline parser
with a warning, unless you pass `--no-fallback`. A key from `ANTHROPIC_API_KEY` is
never sent to a non-Anthropic server.

**What was and was not verified.** The provider code is covered by tests against
local fake servers, and the offline path is exercised end to end by the built CLI.
No call to a live Anthropic or OpenAI-compatible server was made while writing this
documentation, because no key was available; the `tests/live` suite exists for that
and skips itself without a key or base URL.

### Configure

```bash
re-shell ai config show                       # effective values and where each came from; the key is never printed
re-shell ai config set provider anthropic
re-shell ai config set model claude-opus-5-5
re-shell ai config set baseUrl http://localhost:11434/v1
echo "$KEY" | re-shell ai config set apiKey -     # "-" reads the key from stdin
re-shell ai config unset baseUrl
```

Settable keys: `provider`, `model`, `baseUrl`, `apiKey`, `timeoutMs`, `cache`,
`cacheTtlSeconds`. They are stored under `ai:` in `~/.re-shell/config.yaml`.
Precedence: flags, then environment (`RE_SHELL_AI_PROVIDER`, `RE_SHELL_AI_MODEL`,
`RE_SHELL_AI_BASE_URL`, `RE_SHELL_AI_API_KEY`, `RE_SHELL_AI_TIMEOUT_MS`,
`ANTHROPIC_API_KEY`), then the persisted config, then defaults.

## Resolve a command

```bash
re-shell ai "check workspace health" --offline --json
```

```json
{
  "ok": true,
  "data": {
    "needsClarification": false,
    "resolved": {
      "path": "workspace health",
      "description": "Check workspace health with comprehensive diagnostics",
      "argv": ["workspace", "health"],
      "confidence": 0.9375,
      "destructive": false,
      "supportsJson": true,
      "supportsDryRun": false
    },
    "confidence": 0.9375,
    "alternatives": [
      { "path": "workspace diagnostics check", "argv": ["workspace", "diagnostics", "check"], "confidence": 0.6818 }
    ],
    "provider": "offline",
    "requestedProvider": "offline",
    "source": "offline",
    "cached": false,
    "lowConfidence": false,
    "workspace": { "inWorkspace": true, "nodes": 12, "fingerprint": "..." },
    "executed": false
  },
  "warnings": []
}
```

(`alternatives` is abbreviated here.) `source` says what produced the answer
(`offline`, a provider, or the cache), `cached` whether the semantic cache served
it, and `workspace` is the context the resolver saw: with a provider configured,
a compact, size-capped rendering of the real workspace graph (node names, kinds,
languages, frameworks, ports and dependency edges; no source code) is added to the
prompt so "build the payments service" resolves to an actual node.

When nothing matches, the answer is a question rather than a guess:

```bash
re-shell ai "do something vague please" --offline --json
```

```json
{
  "ok": true,
  "data": {
    "needsClarification": true,
    "reason": "no-match",
    "question": "I could not match that to a known command. Try naming a command, e.g. \"list templates\" or \"check workspace health\".",
    "candidates": [],
    "provider": "offline",
    "executed": false
  },
  "warnings": []
}
```

## Sessions

`--session <id>` (or `--continue` for the most recent) keeps a multi-turn session
so a follow-up can answer a clarifying question. Sessions are plain JSON files
under `.re-shell/ai/sessions` (the directory is git-ignored; a session keeps its
last 50 turns).

```bash
re-shell ai "build it" --session demo      # asks which service
re-shell ai "the billing one" --session demo
re-shell ai session list
re-shell ai session show demo
re-shell ai session clear demo
```

## Cache

Resolutions are cached by prompt, catalog and workspace fingerprint
(`.re-shell/ai/cache.json`, one-week TTL, 200 entries by default), so repeating a
prompt costs no provider call. `--no-cache` bypasses it for one call; or
`ai config set cache false`.

```bash
re-shell ai cache stats --json
re-shell ai cache clear
```

## Suggest

`ai suggest <partial...>` returns confidence-scored completions drawn from the
command catalog, your session history and workspace node names. It is offline.

```bash
re-shell ai suggest "work" --limit 5 --json
```

## Safety model

- **Never auto-executes.** Without `--run`, `ai` only resolves. `--run` asks for
  explicit confirmation first.
- **Vetted argv.** A provider can only propose a command; the result is accepted only
  if it matches an entry in the command catalog and every argument passes the
  shell-inert check (no metacharacters, no flags the command does not declare).
  Anything else is dropped and the offline parser answers instead.
- **No shell.** When `--run` executes, it spawns `re-shell` with an argv array and
  never `shell: true`.
- **No telemetry, no key in output.** API keys are never printed or logged
  (`ai config show` reports only `set`/`unset` and the source), and nothing is
  sent anywhere unless you configured a provider.

## Programmatic API

The same machinery is importable as `@re-shell/cli/ai`:

```ts
import { resolveIntent, createProvider, resolveAiConfig } from '@re-shell/cli/ai';

const { result, meta } = await resolveIntent('build the payments service', {
  catalog,            // CommandCatalogEntry[], e.g. from `commands list --json`
  cwd: workspaceRoot,
});
if (!result.needsClarification) {
  // result.candidate.argv is a vetted re-shell argv: run it with shell:false
}
```

Nothing exported there executes a command.

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
