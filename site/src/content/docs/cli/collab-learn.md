---
title: "collab & learn"
description: "Collaboration and learning command suites."
---

Two groups round out the team-productivity surface: `collab` (real shared sessions
plus collaboration generators) and `learn` for training, mentorship, and knowledge
development (generators for a named project).

## `collab session`: shared sessions (a real client)

`collab session` is a client for live, shared sessions on a hosted
[control plane](/re-shell/architecture/control-plane/): a shared console, handover of
control, and team analytics. It talks to a control plane you run; none is deployed
for you.

```bash
re-shell collab session start --workspace acme-web --title "billing refactor"
re-shell collab session list --status active
re-shell collab session join <sessionId>
re-shell collab session run <sessionId> workspace.summary
re-shell collab session handover <sessionId> <userId>
re-shell collab session cancel <sessionId>
re-shell collab session end <sessionId>
```

See [Collaboration](/re-shell/integrations/collaboration/) for the session model,
connection settings, WebRTC and the relay fallback, and the limits.

## `collab` generators

Every other `collab` subcommand is a **code generator**: it writes starter code for a
named project and talks to no server.

```bash
re-shell collab --help
```

| Subcommand | Purpose |
| --- | --- |
| `webrtc-sharing <name>` | WebRTC-based code sharing and pair programming. |
| `terminal-broadcasting <name>` | Encrypted terminal broadcasting with access control. |
| `session-recording <name>` | Session recording/replay for training and debugging. |
| `collaborative-debugging <name>` | Cross-service debugging with shared breakpoints. |
| `code-review-workflow <name>` | Real-time code review and approval workflows. |
| `velocity-tracking <name>` | Velocity tracking and capacity planning with analytics. |
| `feature-flag <name>` | Feature-flag management with A/B testing and gradual rollout. |

There are more subcommands (`workspace-sync`, `knowledge-sharing`,
`burnout-detection`, `project-mgmt`, …) — run `re-shell collab --help` for the
full list.

```bash
re-shell collab webrtc-sharing acme-team
re-shell collab feature-flag acme-platform
```

## `learn`

```bash
re-shell learn --help
```

| Subcommand | Purpose |
| --- | --- |
| `interactive-tutorials <name>` | Interactive tutorials and guided learning paths. |
| `skill-assessment <name>` | Skill assessment and certification tracking. |
| `mentorship <name>` | Mentorship matching and collaboration tools. |
| `code-quality-coaching <name>` | Code-quality coaching with automated feedback. |
| `best-practices <name>` | Best-practices sharing and enforcement. |
| `technical-docs <name>` | Technical documentation with AI assistance. |

```bash
re-shell learn interactive-tutorials acme-onboarding
re-shell learn best-practices acme-platform
```

## See also

- [quality](/re-shell/cli/tools-config-quality/) — testing and IDE integration.
- [CLI Overview](/re-shell/cli/overview/) — the full group map.
