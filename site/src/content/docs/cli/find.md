---
title: "find"
description: "Search commands and templates by keyword — offline, deterministic, ranked."
---

`re-shell find` is a search engine for the CLI itself. Give it free-text and it
ranks the most relevant **commands** and **templates** across the live command
catalogue and the template registry — no need to remember exact command paths or
template ids.

```bash
re-shell find "kubernetes manifests"
re-shell find "rotate a secret in k8s"
re-shell find "high-throughput async API"
re-shell find "generate helm chart"
```

## Why it exists

The CLI ships hundreds of subcommands and 200+ templates. `find` lets you
describe what you want in plain language and get a ranked, explainable shortlist
back, with the exact invocation string for each hit.

## Usage

```
Usage: re-shell find <query> [options]

Arguments:
  query              Search terms, e.g. "kubernetes manifests"

Options:
  --json             Output the ranked results as a JSON envelope
  --limit <n>        Maximum number of results (default: 10)
  --type <type>      Restrict to command | template | all (default: all)
```

### Examples

```bash
# Top 10 matches across commands and templates
re-shell find "deploy to kubernetes"

# Only templates, top 5
re-shell find "rest api" --type template --limit 5

# Only commands
re-shell find "secret" --type command

# Machine-readable envelope for scripts / agents
re-shell find "generate helm chart" --json
```

Each result shows its relevance score, the ready-to-run usage string, and the
query terms that contributed to the match:

```
🔎 Results for "generate helm chart" (10)

Commands
  ● k8s helm generate (87%)
    re-shell k8s helm generate
    matched: generate, helm, chart
  ● k8s helm (61%)
    re-shell k8s helm <project>
    matched: generate, helm, chart
```

## Offline-first by design

The default `find` path is **completely offline and deterministic**:

- **No network, no LLM, no I/O.** Indexing and ranking are pure functions of the
  in-memory command catalogue and template registry. Running `find` never leaves
  your machine.
- **Deterministic.** The same query against the same CLI version always returns
  the same ranking. Ties break predictably: score → command-before-template →
  id (lexicographic).
- **Transparent.** Scoring is a field-weighted blend of exact term overlap and
  bounded fuzzy substring matching. Each hit reports which query terms it matched
  (`matched`), so the ranking is explainable rather than a black box.

### How ranking works

For each query term, `find` takes the *best* hit against any token in each field
of a document, weighted by that field's importance:

| Field | Weight | Example |
| --- | --- | --- |
| `id` | 5 | command path / template id — strongest identity signal |
| `title` | 4 | command path echo / template display name |
| `tags` | 3 | flags, categories, language, framework, features |
| `description` | 1 | free-text — a soft signal, easily out-weighed by an id hit |

An exact whole-token match scores higher than a bounded fuzzy substring match,
and both query and field token must be at least 3 characters before fuzzy
matching applies (so a single flag letter can't manufacture a phantom hit).
Common stop-words (`the`, `a`, `of`, `to`, `how`, `do`, …) are dropped, so a
query made only of filler returns nothing.

## Optional semantic re-ranking

`find` exposes a pluggable `EmbeddingReranker` interface so an embedding-based
provider can reorder the top keyword hits using semantic similarity. This is
**off by default**:

- The default `find` path never constructs or calls a reranker — the offline
  guarantee holds out of the box, and CI never touches the network.
- A reranker can only **reorder or trim** the catalogue-vetted keyword results.
  Output is always filtered back to the original result id set, so a model can
  never inject an unknown command or template id into the results.

To enable a provider, set the embeddings environment variable:

```bash
# Opt in to embedding re-ranking (provider-specific value)
export RE_SHELL_EMBEDDINGS=<provider>
```

When the variable is unset (the default), `find` runs the keyword/fuzzy path
only.

## JSON output

With `--json`, `find` emits a single-line typed envelope (the same
`{ ok, data, warnings }` contract used across the CLI — see the
[JSON Contract](/re-shell/contract/json-contract/) page):

```json
{
  "ok": true,
  "data": {
    "query": "generate helm chart",
    "limit": 10,
    "results": [
      {
        "type": "command",
        "id": "k8s helm generate",
        "title": "k8s helm generate",
        "score": 0.8667,
        "matched": ["generate", "helm", "chart"],
        "usage": "re-shell k8s helm generate"
      }
    ]
  },
  "warnings": []
}
```

The payload validates against the `findResponse` schema from
`@re-shell/contracts`. On an invalid `--type` or a runtime error, `find` emits an
`{ ok: false }` envelope with `code: "FIND_ERROR"` and exits non-zero.
</content>
</invoke>
