# Re-Shell CLI Example Library

This directory breaks the CLI feature surface into smaller, workflow-oriented guides.
Use it when `../EXAMPLES.md` is too broad and you want concrete commands by topic.

## Coverage Map

- `core-workflows.md`
  Covers: `init`, `create`, `add`, `remove`, `list`, `build`, `serve`, `tui`
- `workspace-and-config.md`
  Covers: `workspace`, `config`
- `scaffolding-api-and-generation.md`
  Covers: `generate`, `api`
- `services-tools-and-quality.md`
  Covers: `service`, `tools`, `quality`
- `plugins-and-data.md`
  Covers: `plugin`, `data`
- `cloud-k8s-and-observability.md`
  Covers: `cloud`, `k8s`, `observe`
- `security-collaboration-and-learning.md`
  Covers: `security`, `collab`, `learn`
- `using-new-backend-templates.ts`
  Executable example that prints backend template inventories and scaffold commands

## Usage Notes

- Commands assume you run them from the workspace root unless the example says otherwise.
- Start with `--dry-run`, `--json`, or `--verbose` where available if you are exploring a feature for the first time.
- Many generator-style commands write files into the current project, so direct output with `--output` when you want to experiment safely.
- Architecture templates such as `mern`, `graphql`, `microservices`, and `websocket-realtime` can be passed to `re-shell create --template ...`.

## Suggested Reading Order

1. `core-workflows.md`
2. `workspace-and-config.md`
3. `scaffolding-api-and-generation.md`
4. `services-tools-and-quality.md`
5. `plugins-and-data.md`
6. `cloud-k8s-and-observability.md`
7. `security-collaboration-and-learning.md`
