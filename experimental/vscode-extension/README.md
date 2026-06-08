# re-shell-vscode

A VS Code extension that surfaces the Re-Shell JSON contracts and a command
builder inside the editor.

## What it does

- **Commands tree view** — sourced from `re-shell commands list --json`. The raw
  stdout is validated against the shared `re-shell-contracts` envelope before
  anything is rendered; a malformed or `ok:false` payload surfaces an error
  instead of trusting the blob.
- **Re-Shell: Build Command** — prompts for a catalog entry's args, then
  assembles a vetted `argv` array via the pure builder. Values are sanitized to a
  safe identifier charset, so an injection payload (`foo; rm -rf ~`) can never
  become an argv token, let alone be shell-interpreted.
- **Re-Shell: Run via hub** — maps an allow-listed catalog entry onto the local
  hub's `run` command and streams its SSE output. The extension never sends a raw
  command/argv to the hub; it sends only a stable `commandId` + `params`, which
  the hub resolves against its own allow-list registry.

## Architecture

VS Code API usage is confined to `src/extension.ts` (thin host layer). All logic
lives in pure, host-free modules under `src/core`:

| Module | Responsibility |
| --- | --- |
| `core/catalog.ts` | Parse + validate the `commands.list` envelope via `re-shell-contracts`. |
| `core/command-builder.ts` | Assemble a vetted argv from a `CatalogEntry` + params, preserving flag/arg order. |
| `core/hub-client.ts` | Map an entry to the hub allow-list + shape the SSE/health request descriptors. |

`src/cli.ts` is the only non-pure helper (it spawns `re-shell` with
`shell: false` and a fixed argv); it is kept out of `core` so the core stays
unit-testable without a process.

`src/vscode.d.ts` is a minimal ambient declaration of the slice of the VS Code
API the extension consumes. We intentionally do **not** depend on
`@types/vscode`; the real `vscode` module is injected by the host at runtime and
stays `external` in the bundle.

## Build

```bash
pnpm run build      # esbuild -> dist/extension.js (CJS, vscode external)
pnpm run typecheck  # tsc --noEmit
pnpm run test       # vitest run (pure-core unit tests only)
```

## Testing scope

Pure-core unit tests run under vitest with **no VS Code host and no network**.

Full VS Code host integration testing via `@vscode/test-electron` is
**intentionally NOT run** in this environment: it downloads a VS Code build,
which is out of scope for the offline/deterministic CI guardrails. The
extension's logic is exercised entirely through the pure-core suite; the host
layer is kept thin specifically so this split is possible.
