# re-shell-ui Web Components Design

## Status

Draft — awaiting user review before implementation.

---

## 1. Goal

Transform `re-shell-ui` into a **framework-agnostic UI component library** shippable as a single package (`@umutkorkmaz/re-shell-ui`) that works in React, Vue, Angular, Svelte, Solid, and vanilla HTML — without requiring any adapter layer per framework.

The `re-shell ui` command serves as a **local IPC hub** that bridges CLI commands (Node.js) to the browser via Server-Sent Events (SSE) and WebSockets.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser                                 │
│  <re-shell-health>   <re-shell-terminal>   <re-shell-topology> │
│  (Web Components — Shadow DOM, framework-agnostic)              │
└──────────────────────────┬───────────────────────────────────┘
                           │ fetch / SSE / WS
┌──────────────────────────▼───────────────────────────────────┐
│  re-shell ui (Vite dev server + IPC hub)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ SSE server  │  │ WS server    │  │ CLI process pool   │   │
│  │ /events    │  │ /jobs        │  │ child_process     │   │
│  └─────────────┘  └──────────────┘  └────────────────────┘   │
└──────────────────────────┬───────────────────────────────────┘
                           │ stdio / spawn
                    ┌──────▼──────┐
                    │ re-shell CLI │
                    └─────────────┘
```

### Communication Patterns

| UI Component Need          | Mechanism | Endpoint         |
|----------------------------|-----------|------------------|
| One-shot command + output  | SSE       | `GET /events`    |
| Interactive job (streaming)| WebSocket | `WS /jobs`       |
| Real-time health updates   | SSE       | `GET /health/stream` |
| Workspace file watching    | WS        | `WS /workspace/watch` |

---

## 3. Component Inventory

### 3.1 Atomic Components (base layer)

These wrap shadcn/ui primitives and are used by domain components:

| Component | Description |
|-----------|-------------|
| `<re-shell-badge>` | Variant-aware status badge (pass/warn/fail/info) |
| `<re-shell-button>` | CLI action trigger, emits `rs-command` event |
| `<re-shell-spinner>` | Animated activity indicator |
| `<re-shell-progress>` | Numeric or indeterminate progress bar |
| `<re-shell-kv>` | Key-value display row |

### 3.2 Domain Components

| Component | Description | Data Source |
|-----------|-------------|-------------|
| `<re-shell-health>` | Health score, check list, status | `workspace health --json` via SSE |
| `<re-shell-terminal>` | Streaming command output, ANSI color | WebSocket `/jobs` |
| `<re-shell-topology>` | App/service node grid with status | `workspace graph --json` via SSE |
| `<re-shell-template-catalog>` | Template cards with filter/search | Static + `template list --json` |
| `<re-shell-job-panel>` | Job list, status, cancel control | WebSocket `/jobs` |
| `<re-shell-command-preview>` | Dry-run preview, copy, run buttons | Static spec |
| `<re-shell-workspace-summary>` | Name, path, git status, package manager | `workspace --json` via SSE |

### 3.3 Layout Components

| Component | Description |
|-----------|-------------|
| `<re-shell-sidebar>` | Collapsible nav sidebar |
| `<re-shell-tabs>` | Tab container (coordinates child panels) |
| `<re-shell-layout>` | Full dashboard shell (sidebar + content slot) |

---

## 4. CLI Hub (`re-shell ui`)

The command already exists in `src/commands/ui.ts`. It is extended to:

1. **Start a Vite dev server** for the web app (unchanged)
2. **Start an SSE server** on `/events` — accepts `?command=<name>&args=...`, spawns the CLI process, streams stdout as SSE events
3. **Start a WebSocket server** on `/jobs` — manages interactive sessions (streaming output, job cancellation)
4. **Expose workspace detection** — the detected `uiRoot`, `workspace`, `packageManager` are passed as env vars to the Vite app

### SSE Endpoint

```
GET /events?command=workspace+health&args=--json

event: line
data: {"type":"stdout","content":"Inspecting package manager..."}

event: line
data: {"type":"stdout","content":"{\"score\":86,\"status\":\"warning\"}"}

event: done
data: {"type":"exit","code":0}
```

### WebSocket Endpoint

```
WS /jobs

// Client → Server
{"type":"start","id":"job_01","command":["re-shell","workspace","health","--json"],"cwd":"/path/to/workspace"}

// Server → Client (streaming)
{"type":"stdout","content":"..."}
{"type":"stderr","content":"..."}
{"type":"exit","code":0}
{"type":"heartbeat","ts":"..."}

// Client → Server (control)
{"type":"cancel","id":"job_01"}
```

---

## 5. Contracts Package

`packages/contracts/` defines TypeScript interfaces shared between CLI and UI:

```typescript
// packages/contracts/src/index.ts
export interface WorkspaceSummary { /* ... */ }
export interface HealthReport { /* ... */ }
export interface JobRecord { /* ... */ }
export interface TemplateSummary { /* ... */ }
export interface SseEvent { type: 'stdout' | 'stderr' | 'exit' | 'heartbeat'; content?: string; code?: number; id?: string; ts?: string; }
export interface WsMessage { type: 'start' | 'cancel' | 'stdout' | 'stderr' | 'exit' | 'heartbeat'; id?: string; command?: string[]; cwd?: string; content?: string; code?: number; ts?: string; }
```

The CLI hub serializes CLI output into these contract types. Web Components consume them with `JSON.parse`.

---

## 6. Component API Design

All Web Components accept:

- **Attributes/properties** for configuration (e.g., `workspace`, `port`)
- **Events** for communication upward (e.g., `rs-command`, `rs-output`, `rs-status`)
- **Slots** for composition (e.g., `<re-shell-tabs>` has named slots for each tab's content)

Example usage (vanilla HTML):

```html
<script type="module" src="/dist/re-shell-ui.js"></script>

<re-shell-layout workspace="/path/to/my-app">
  <re-shell-sidebar slot="sidebar">
    <re-shell-badge variant="pass">Healthy</re-shell-badge>
  </re-shell-sidebar>

  <re-shell-tabs>
    <re-shell-tab name="overview">
      <re-shell-health workspace="/path/to/my-app"></re-shell-health>
    </re-shell-tab>
    <re-shell-tab name="topology">
      <re-shell-topology workspace="/path/to/my-app"></re-shell-topology>
    </re-shell-tab>
    <re-shell-tab name="terminal">
      <re-shell-terminal workspace="/path/to/my-app"></re-shell-terminal>
    </re-shell-tab>
  </re-shell-tabs>
</re-shell-layout>

<script>
  document.querySelector('re-shell-health').addEventListener('rs-output', (e) => {
    console.log(e.detail);
  });
</script>
```

Example usage (React):

```tsx
import '@re-shell/ui';

// React wrapper is just a thin adapter that maps props/children to attributes/slots
// No separate @re-shell/ui-react package needed — any React component can use
// web components directly via standard DOM APIs
function Dashboard() {
  return (
    <re-shell-layout workspace="/path/to/my-app">
      <re-shell-health workspace="/path/to/my-app" />
    </re-shell-layout>
  );
}
```

---

## 7. File Structure

```
re-shell-ui/
├── packages/
│   ├── contracts/              # Shared TS interfaces (CLI ↔ UI)
│   │   └── src/index.ts
│   └── ui/                    # Web Components package
│       ├── src/
│       │   ├── components/
│       │   │   ├── atomic/    # Badge, Button, Spinner, Progress, KV
│       │   │   ├── domain/    # Health, Terminal, Topology, JobPanel, etc.
│       │   │   └── layout/    # Sidebar, Tabs, Layout
│       │   ├── hub/           # SSE/WS client (used by components)
│       │   │   ├── sse-client.ts
│       │   │   └── ws-client.ts
│       │   ├── styles/        # globals.css tokens
│       │   └── index.ts      # registers all custom elements
│       └── dist/             # Built output
├── apps/
│   └── web/                   # Vite app + hub server (the `re-shell ui` target)
│       ├── src/
│       │   ├── main.tsx       # Mounts <re-shell-layout>
│       │   ├── hub-server.ts  # SSE + WS servers + CLI process spawning
│       │   └── App.tsx       # Shell layout, routes
│       └── vite.config.ts
└── docs/
    └── cli-integration.md
```

---

## 8. Hub Server Implementation

The hub server (`hub-server.ts`) is a lightweight Express or stdlib HTTP server that:

1. **SSE `/events`** — spawns CLI process, pipes stdout line-by-line as SSE `data:` lines, sends `{type:'done'}` on exit
2. **WebSocket `/jobs`** — tracks active jobs in a `Map<id, ChildProcess>`, supports cancel signals via `process.kill`
3. **Workspace context** — reads env vars set by the CLI launch plan (`RE_SHELL_WORKSPACE`, etc.) and injects them into SSE/WS responses

Hub server runs inside the same Node.js process spawned by `re-shell ui`. It reuses the `workspace` and `packageManager` already resolved by `createUiLaunchPlan()`.

---

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| CLI process fails | SSE sends `event: error\ndata: {"message":"..."}`, WebSocket sends `exit` event with `code != 0` |
| Workspace not found | Component shows error state in its shadow DOM, does not crash |
| Hub server unreachable | Components retry with exponential backoff (3 attempts), then show "offline" state |
| Job cancellation | WebSocket sends SIGTERM to child process, removes from active job map |
| Invalid workspace path | Hub returns HTTP 400 with `{error: "invalid workspace path"}` |

---

## 10. Data Flow: `re-shell-health` Example

```
1. <re-shell-health workspace="/path/to/app"> upgrades (connectedCallback)
2. component fetches GET /events?command=workspace+health&args=--json&workspace=/path/to/app
3. hub-server spawns: re-shell workspace health --json
4. CLI outputs JSON line-by-line; hub sends SSE events
5. component receives SSE, parses JSON, updates shadow DOM
6. shadow DOM renders: score badge, check list, status indicator
7. on CLI exit (code 0 or non-0): component displays final state
```

---

## 11. Naming Convention

- All custom elements are prefixed `re-shell-` (or `rs-` for brevity in attributes)
- CSS custom properties (variables) are namespaced: `--rs-color-*`, `--rs-font-*`, `--rs-radius-*`
- Events are prefixed `rs-`: `rs-command`, `rs-output`, `rs-status`, `rs-error`

---

## 12. shadcn Alignment

The existing `packages/ui/` primitives (Button, Card, Badge, Tabs, etc.) are React components. For the Web Components layer:

1. Extract the **design tokens** from `packages/ui/src/styles/globals.css` into shared CSS variables
2. Re-implement the **base components** (Button, Badge, Card, etc.) as vanilla Web Components that consume those tokens
3. Domain components (`<re-shell-health>`, etc.) compose the atomic Web Components
4. The React primitives in `packages/ui/` remain as-is for React-first consumers

This gives a single visual language across both the React shadcn package and the Web Component library.

---

## 13. Implementation Order

| Phase | Task | Notes |
|-------|------|-------|
| 0 | Extract contracts to `packages/contracts` | Define `WorkspaceSummary`, `HealthReport`, `JobRecord`, `SseEvent`, `WsMessage` interfaces |
| 1 | Hub server (`hub-server.ts`) | SSE + WS in `apps/web/src/`, reusable by `re-shell ui` launch |
| 2 | CSS tokens extraction | Move design tokens to `packages/ui/src/styles/globals.css` (already done) |
| 3 | Atomic Web Components | Badge, Button, Spinner, Progress, KV |
| 4 | Domain Web Components | Health (uses SSE), Terminal (uses WS), Topology (uses SSE) |
| 5 | Layout Web Components | Sidebar, Tabs, Layout shell |
| 6 | Wire `re-shell ui` to hub server | Modify `launchUi()` to also start hub server |
| 7 | Rewrite `App.tsx` | Use Web Components instead of React imports |
| 8 | Build + package | `packages/ui/` builds to `dist/re-shell-ui.js` + `dist/re-shell-ui.css` |

---

## 14. Out of Scope

- Any authentication / multi-user support (local dev tool only)
- Production deployment of the UI (it's a local developer tool)
- Non-Node.js CLI wrappers (Python, Go, etc.) — the hub is Node.js only; other runtimes can expose the same JSON contract on their own
- Mobile-optimized layouts
