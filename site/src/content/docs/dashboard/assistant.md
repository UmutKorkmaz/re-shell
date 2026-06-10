---
title: "Assistant Panel"
description: "Natural language in, one allow-listed command out — the dashboard's offline-first assistant maps plain English to a single vetted hub command, or refuses."
---

The **Assistant** screen lets you describe what you want in plain language —
"is my workspace healthy?" — and have the dashboard map it to a single
[allow-listed hub command](/re-shell/architecture/secure-hub/), show you exactly
which command it picked, and stream the result inline. If nothing in the
allow-list confidently matches, it **refuses** rather than guessing.

It introduces **no new execution path**. The assistant can only ever do what the
[hardened hub](/re-shell/architecture/secure-hub/) already permits: send a stable
`commandId` plus opaque `params` and let the hub spawn the CLI, shell-free,
against its allow-listed registry.

## The flow

1. You type a request in natural language (or click an example prompt).
2. The resolver scores it against the hub's allow-list and picks **at most one**
   command — or returns *no match*.
3. On a match, the resolved command is shown in the same
   [CommandPreview](/re-shell/dashboard/overview/) you see in the Command Builder,
   annotated with a confidence percentage, then run through the existing job
   pipeline — output streams inline over SSE/WS.
4. On no match, a clear refusal panel ("I can't run that") lists the vetted
   commands the assistant *can* run, so you can rephrase.

```
"is my workspace healthy?"   → workspace.health   → runs, streams output
"what's the dependency graph" → workspace.graph    → runs, streams output
"show templates"             → templates.list     → runs, streams output
"delete the production database" → (no match)      → refused, nothing runs
```

## Offline-first and deterministic

The default path is **fully offline**. The resolver
(`resolveCommand`) is a pure, dependency-free, field-weighted **term-overlap**
matcher — no network, no model, no I/O, no randomness. The same query against the
same allow-list always yields the same result, so behaviour is reproducible and
auditable.

It scores each candidate over its `id`, `title`, curated intent `keywords`, and
`description` (weighted in that order, exact hits beating fuzzy substring hits),
normalises to a `[0, 1]` confidence, and returns the single best command **only**
if it clears a confidence floor. Generic filler words ("is", "my", "show",
"please") are treated as stop-words so they can't manufacture a phantom match.

## The allow-list is the registry

The set of commands the assistant can resolve to is **derived from the hub
command registry** — the same single source of truth the hub uses to actually run
commands. There is no second, hand-maintained list to drift out of sync.

- The candidate set passed to the resolver **is** the allow-list, so the resolver
  can never return a fabricated or non-allow-listed command id — by construction.
- Only commands that run **without caller-supplied params** are offered, because a
  free-text query can't reliably synthesise a required argument (such as a
  template id). Param-requiring commands like `run` and `templates.show` stay
  reachable through their dedicated screens.

## Refusal behavior

If no allow-listed command clears the confidence floor, the assistant **refuses**.
It does not run a weakly-matched command, and it never invents one. Out-of-scope
or destructive phrasing ("delete everything", "rm -rf /") simply produces a *no
match* — no job is ever started. The refusal panel surfaces the vetted commands
so you can rephrase toward something the hub will actually run.

## Optional provider, off by default

For richer phrasing, an **optional** LLM resolver can be plugged in behind a small
interface. It is **off by default** — nothing on the standard path constructs or
calls it, so the offline guarantee holds out of the box.

Crucially, the security surface does **not** widen when a provider is enabled:

- The adapter can only ever **propose a command id** — never argv, never params,
  never a new exec path.
- Its proposal is **defensively filtered back to the same allow-list**. A
  hallucinated or unknown id is rejected and collapses to a refusal, exactly like
  the offline resolver.

So even with a provider attached, the worst a misbehaving model can do is propose
a command that already exists in the registry — or be refused.

## Security stance

| Guarantee | How |
| --- | --- |
| **No new exec path** | Execution only ever happens by sending an allow-listed `{ commandId, params }` back through the [hub](/re-shell/architecture/secure-hub/). The assistant adds no spawn, no shell, no raw argv. |
| **Can't invent commands** | The resolver's candidate set *is* the allow-list; it can only return an id that was supplied to it. |
| **No registry drift** | The allow-list is derived from the hub command registry, not a parallel list. |
| **Offline by default** | The default resolver is pure and network-free; the optional provider is opt-in. |
| **Refuses, never guesses** | Below the confidence floor → no match → no job. |
| **Provider stays sandboxed** | An LLM proposal is filtered to the allow-list before anything runs. |

## See also

- [Secure Hub](/re-shell/architecture/secure-hub/) — token auth, loopback binding, the shell-free allow-list.
- [Dashboard](/re-shell/dashboard/overview/) — the bundled mission-control surface and its screens.
- [MCP Server](/re-shell/integrations/mcp/) — the same typed commands exposed to external AI agents.
