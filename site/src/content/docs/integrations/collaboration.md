---
title: "Collaboration"
description: "Shared sessions with a shared console, operational-transform editing, WebRTC pairing with a relay fallback, and team analytics, on the control plane."
---

Real-time collaboration in Re-Shell runs on the [control plane](/re-shell/architecture/control-plane/):
people on the same team join a **session** in a workspace, watch and drive one shared
console, edit a shared document, see each other's presence, and get team analytics.

> **What exists and what does not.** All of it is implemented and tested against a real
> control plane, worker and the built CLI. **No control plane is deployed**, so you run
> your own (see [Control Plane](/re-shell/architecture/control-plane/)), and **no TURN
> server is shipped or deployed**: direct WebRTC links work between peers that can
> reach each other, and otherwise the relay fallback carries the messages through the
> server. Full detail:
> [`docs/control-plane.md` section 14](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/control-plane.md).

## The session model

A session belongs to one tenant and workspace. It has an **owner** (the creator), a
**driver** (initially the owner; exactly one, or nobody) and **participants**.

| Who | Can |
| --- | --- |
| tenant `operator` or above | create, list, read, join and leave sessions; edit documents; signal to participants |
| the **driver** | run allow-listed commands, cancel the running command, hand control to a participant |
| the **owner** | everything the driver can, at any time; end the session |
| a tenant `admin` | end any session; cancel the running command |

Control moves with a handover. The target must have joined and still hold the
`operator` role (checked live), so a demoted user cannot be handed the keyboard. A
session ends with `end` (owner or admin), is then read-only history, and cannot end
while a command is queued or running.

## CLI: `collab session`

```bash
re-shell collab session start --workspace acme-web --title "billing refactor"
re-shell collab session list --status active
re-shell collab session join <sessionId>            # terminal: live shared console
re-shell collab session run <sessionId> workspace.summary
re-shell collab session handover <sessionId> <userId>
re-shell collab session cancel <sessionId>
re-shell collab session end <sessionId> --reason "done"
```

`run` takes a **command id from the allow-list** (such as `workspace.summary`), not a
shell command: it executes on a worker through the same registry as the dashboard hub,
and the output is shared with everyone in the session. Pass parameters with
`--param key=value` or `--params-json`.

Connection settings, in order: flags (`--url`, `--token-file`, `--tenant`; `--token` is
visible in `ps`, so prefer the file), the environment (`RE_SHELL_CONTROL_PLANE_URL`,
`RE_SHELL_CONTROL_PLANE_TOKEN`, `RE_SHELL_CONTROL_PLANE_TOKEN_FILE`,
`RE_SHELL_CONTROL_PLANE_TENANT`), then `~/.re-shell/control-plane.json`. Every command
accepts `--json`. In a terminal `join` streams the live console; piped or with `--json`
it prints a snapshot. Remote output is stripped of terminal escape sequences before it
reaches your terminal.

The older `collab webrtc-sharing`, `terminal-broadcasting`, `operational-transform` and
similar subcommands are **code generators**: they write starter code and talk to no
server.

## The dashboard's Collaboration screen

Sidebar, Team, **Collaboration** has control-plane connection settings (URL, tenant,
token; an optional ICE-server override), a sessions list with a start form, the shared
console, presence with the WebRTC link state per peer, the shared editor with remote
cursors, and the analytics panel.

## How it works

- **Shared console.** Command output is job output, streamed to every participant in
  order; a late joiner gets a snapshot plus the history.
- **Shared editing** uses **operational transformation**: concurrent edits from any
  number of clients converge to the same text. The transform and compose functions are
  property-tested over thousands of seeded random operation pairs, and multi-client
  convergence is tested with arbitrary delivery order. Plain text only.
- **WebRTC pairing.** The dashboard opens an `RTCPeerConnection` data channel between
  each pair of online participants (up to 8 peers) for presence and cursors. By default
  only host candidates are used; set `CONTROL_PLANE_ICE_SERVERS` to hand STUN/TURN
  servers to participants (those values are visible to every participant, so use
  short-lived TURN credentials). If the channel does not open in 8 seconds, ICE fails
  or the browser has no WebRTC, the link switches to a **server relay** and the panel
  shows which transport each peer uses.
- **Team analytics**: command counts and success rates, session durations and
  participants, audit allow/deny counts, and a timeline, scoped to the tenant.
- **Audit**: every collaboration decision is recorded before it is acted on
  (high-frequency traffic is sampled: every denial is audited, an allow only the first
  time per session).

## Limits

- Single node: fan-out and presence are in-process.
- No end-to-end encryption: console output and documents are visible to the server's
  operators and stored in SQLite (a session is capped at 200 000 events). Do not run
  commands whose output must not be retained.
- WebRTC is a mesh, not an SFU, and symmetric NATs need a TURN server that this
  repository does not provide.
- Plain text only; any operator in a session may edit its documents.

## See also

- [Control Plane](/re-shell/architecture/control-plane/)
- [collab & learn](/re-shell/cli/collab-learn/): the `collab` command group.
- [Dashboard](/re-shell/dashboard/overview/)
