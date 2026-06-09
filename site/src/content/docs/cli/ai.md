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

## See also

- [CLI Overview](/re-shell/cli/overview/) — the catalog the resolver reads.
- [Roadmap](/re-shell/roadmap/) — the optional, provider-abstracted AI layer.
