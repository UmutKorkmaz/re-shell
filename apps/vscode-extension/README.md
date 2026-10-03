# Re-Shell for VS Code

Browse a Re-Shell workspace, build vetted CLI commands, and run them from inside
the editor, either in a terminal or through the local Re-Shell hub.

The extension is a thin renderer over the `re-shell` CLI: everything it shows
comes from the CLI's `--json` commands, validated against the shared
`@re-shell/contracts` envelope before anything is rendered. A malformed or
`ok:false` payload surfaces an error instead of being trusted.

> Part of the [Re-Shell monorepo](https://github.com/UmutKorkmaz/re-shell). Package `re-shell`,
> version **0.3.0**, private (not on the Marketplace; install the `.vsix`).
>
> **Verification status.** The unit and real-hub integration suites (built CLI + built hub,
> no editor) and the `.vsix` packaging check run without VS Code. The **VS Code host test**
> (`@vscode/test-electron`, inside a real editor) was **not run in the environment this
> was developed in**: it downloads VS Code from `update.code.visualstudio.com`, which was
> blocked. It runs in the `VS Code Extension` GitHub workflow (pending its first run).

## What it does

- **Views** (Re-Shell activity-bar container)
  - **Projects**: apps and packages from `re-shell workspace graph --json`, with
    health markers from `workspace health --json`.
  - **Commands**: the command catalog from `re-shell commands list --json`,
    grouped by category.
  - **Templates**: `re-shell templates list --json`, grouped by language and
    framework.
- **Re-Shell: Build Command**: pick a catalog command, fill in its arguments, and
  get a vetted `CommandSpec` (id, argv, cwd, destructive / dry-run flags) written
  to the Re-Shell output channel. Nothing runs; you can then run it in a
  terminal, copy it, or, for allow-listed commands, run it via the hub.
- **Re-Shell: Run via Hub**: build a spec for an allow-listed catalog command and
  run it through your local hub. The job result (exit code and the CLI's JSON
  envelope) is reported back and written to the output channel.
- **Re-Shell: Run Command**, **Run Doctor**, **Create Project**, **Refresh**,
  **Open Terminal**, **Show Output**, plus per-project Build / Serve / Test.
- **Status bar** item showing workspace health.

Values you type are never spliced into a shell string. Every argument and flag
value goes through the pure command builder, which only accepts a safe
identifier (`[A-Za-z0-9][A-Za-z0-9._-]*`), and only catalog-declared flags are
allowed, so `foo; rm -rf ~` fails the build instead of reaching a terminal or
the hub. Commands flagged destructive ask for confirmation first.

## Install

The extension is not published to the Marketplace. Install it from a `.vsix`.

**From CI:** download the `re-shell-vscode-extension` artifact of the
"VS Code Extension" workflow run, unzip it, then

```bash
code --install-extension re-shell-0.3.0.vsix
```

(or *Extensions: Install from VSIX...* in the Command Palette).

**From a checkout:**

```bash
pnpm install
pnpm --filter re-shell run package      # builds, packages and verifies the .vsix
code --install-extension apps/vscode-extension/re-shell-*.vsix
```

Requirements: VS Code 1.85 or newer, and the Re-Shell CLI (`re-shell` on your
`PATH`, or point the extension at it with `reShell.cliBin`). The extension runs
only in trusted workspaces because it executes the CLI against the open folder.

## Settings

| Setting | Default | Environment fallback | Description |
| --- | --- | --- | --- |
| `reShell.cliBin` | `re-shell` | `RE_SHELL_CLI_BIN` | The CLI to run. A bare name or absolute path of a launcher, or the path of the CLI's JavaScript entry (for example `packages/cli/dist/index.js` in a checkout), which is run with Node. |
| `reShell.hub.url` | `http://127.0.0.1:3334` | `RE_SHELL_UI_HUB_URL` | Base URL of the local hub. Must be a loopback address. |
| `reShell.hub.token` | empty | `RE_SHELL_UI_HUB_TOKEN` | The hub's session token, sent as the `x-re-shell-ui-hub-token` header. |
| `reShell.hub.timeoutMs` | `120000` | none | Abort a hub run that takes longer than this. |

A setting that has been changed wins; otherwise the environment variable is
used; otherwise the default. All four settings are machine-scoped: they are read
from your user settings only, so a workspace's `.vscode/settings.json` cannot
choose which program the extension launches or which server receives the token.
Keep the token out of version control.

If `re-shell` is installed globally but the editor was launched from the Dock or
a launcher with a minimal `PATH`, the extension also probes common global bin
directories and your login shell. Set `reShell.cliBin` to an absolute path if
that is not enough.

## Run against a local hub

The hub is the token-authenticated, loopback-only server behind the Re-Shell
dashboard. It runs only allow-listed commands, resolved against its own
registry; the extension never sends it a raw command line, only
`{ commandId: "run", params: { subcommand, cwd } }`.

1. Start the hub. Either launch the dashboard, which starts it and prints its
   URL and token:

   ```bash
   re-shell ui
   #   Hub: http://127.0.0.1:3334 (loopback-only, token-protected)
   #   Hub token: <token>
   ```

   or start the built hub server yourself with a token of your choice:

   ```bash
   RE_SHELL_UI_HUB_TOKEN=<token> \
   RE_SHELL_UI_HUB_PORT=3334 \
   RE_SHELL_WORKSPACE="$PWD" \
   RE_SHELL_CLI_BIN="$PWD/packages/cli/dist/index.js" \
   node apps/web/dist/hub-server.js
   ```

2. Tell the extension where it is, in user settings (`reShell.hub.url`,
   `reShell.hub.token`) or in the environment the editor starts with
   (`RE_SHELL_UI_HUB_URL`, `RE_SHELL_UI_HUB_TOKEN`).
3. Open the Command Palette and run **Re-Shell: Run via Hub**, or use the
   inline *Run via Hub* action on a command in the Commands view.

What to expect:

- Only the hub's allow-list can run through it: `workspace summary`,
  `workspace graph`, `workspace health`, `workspace list`, `workspace validate`,
  `templates list`, `commands list`, `doctor` and `analyze`. The hub appends
  `--json` and cannot forward extra arguments or flags; use the terminal for
  those.
- The folder open in VS Code must be inside the hub's workspace (the hub
  contains every job's working directory to it); otherwise the hub answers
  "cwd is outside the workspace root".
- A run is reported as successful only when the job exited `0` **and** its
  output is a valid `ok:true` JSON envelope. A non-zero exit, an `ok:false`
  envelope, a wrong token (HTTP 401), an unreachable hub or a dropped stream is
  reported as a failure with the reason.
- The hub is loopback-only, so a non-loopback `reShell.hub.url` is rejected
  before anything is sent.

## Architecture

VS Code API usage is confined to `src/extension.ts` (thin host layer). The
logic lives in host-free modules under `src/core` that are unit-tested without
an editor:

| Module | Responsibility |
| --- | --- |
| `core/catalog.ts` | Parse and validate the `commands list` envelope via `@re-shell/contracts`. |
| `core/command-builder.ts` | Assemble a vetted argv from a catalog entry and params. |
| `core/spec.ts` | Build the contract-validated `CommandSpec`, and the hub run spec + request. |
| `core/hub-client.ts` | Allow-list gating, request shaping, SSE parsing, job-result folding, envelope parsing. |
| `core/settings.ts` | Resolve the CLI and hub settings (setting, then environment, then default). |
| `core/cli-invocation.ts` | Decide how the CLI is launched (native launcher, or a JS entry under Node). |
| `core/workspace.ts`, `core/templates.ts` | Parse workspace and template payloads for the views. |

Two small non-pure files own the I/O: `src/cli.ts` spawns the CLI
(`shell: false`, fixed argv) and `src/hub-run.ts` talks to the hub over HTTP/SSE.

`activate()` returns a small API (`ready`, `refresh()`, `commandsTree()`,
`catalog()`, `resolvedCli()`) so tests can observe what the views render. The
`reShell.buildCommand` and `reShell.runViaHub` commands accept an optional
`{ path, params? }` argument and return their outcome, so they can be driven
programmatically.

## Development

The extension is a member of the pnpm workspace (`apps/vscode-extension`,
package name `re-shell`, the Marketplace name).

```bash
pnpm install
pnpm -r build                                   # contracts, CLI and hub server are used by the tests

pnpm --filter re-shell run build                # esbuild -> dist/extension.js
pnpm --filter re-shell run typecheck            # tsc: sources against @types/vscode, plus all tests
pnpm --filter re-shell run test                 # unit tests (vitest; no editor, no network, no build needed)
pnpm --filter re-shell run test:integration     # real hub + real CLI, no editor (needs `pnpm -r build`)
pnpm --filter re-shell run test:host            # tests inside a real VS Code (downloads VS Code)
pnpm --filter re-shell run package              # minified build -> .vsix -> verify the .vsix
```

### Test layers

- **Unit** (`tests/unit`): the pure core, the SSE/job handling and the socket
  client (against a local server that speaks the hub's wire protocol), and a
  manifest-vs-code consistency check.
- **Integration** (`tests/integration`): the REAL built CLI
  (`packages/cli/dist/index.js`) and the REAL built hub
  (`apps/web/dist/hub-server.js`), started as child processes with a random
  token. The extension's own client code lists the catalog, builds a spec, runs
  it through the hub and reads the result, including a multi-hundred-KB response
  and every failure path. `src/extension.ts` is also activated here, with the
  `vscode` module replaced by a small recording stub
  (`tests/support/vscode-stub.ts`) so its wiring is exercised without an
  editor. The stub is not a substitute for the editor.
- **Host** (`tests/host`): `@vscode/test-electron` downloads a real VS Code
  from `update.code.visualstudio.com`, opens a fixture workspace with the
  extension loaded, starts the real hub, and runs a Mocha suite inside the
  extension host. It checks that the extension activates, that the Commands
  tree is populated from `re-shell commands list --json` using the built CLI
  (configured through `reShell.cliBin` / `RE_SHELL_CLI_BIN`), and that a palette
  command builds a spec and runs it through the hub, with the job result coming
  back.

Host test options:

```bash
xvfb-run -a pnpm --filter re-shell run test:host     # Linux without a display
VSCODE_TEST_VERSION=1.85.0 pnpm --filter re-shell run test:host   # engine floor; default is `stable`
VSCODE_EXECUTABLE_PATH=/path/to/code pnpm --filter re-shell run test:host   # skip the download
```

The `VS Code Extension` GitHub Actions workflow
(`.github/workflows/vscode-extension.yml`) runs the build, unit tests,
integration tests and the host tests under `xvfb-run -a`, then packages the
`.vsix` and uploads it as the `re-shell-vscode-extension` artifact.
