# Security, Collaboration, And Learning

These examples cover the enterprise-heavy command groups that generate security programs, collaboration tooling, and developer enablement assets.

## Security And Compliance Starters

```bash
re-shell security vulnerability-scan finance-platform --severity-threshold high --license-check --supply-chain-analysis --output tmp/vuln-scan
re-shell security container-security finance-platform
re-shell security code-security finance-platform
re-shell security secret-detection finance-platform
re-shell security zero-trust finance-platform
re-shell security rbac finance-platform
re-shell security audit finance-platform
re-shell security compliance-reporting finance-platform
```

## Security Areas Covered By The Group

- Runtime and infrastructure: `container-security`, `infrastructure-security`, `supply-chain-security`
- Detection and response: `threat-detection`, `incident-management`, `risk`, `vendor`, `bcp`
- Policies and governance: `security-policy`, `custom-policy`, `governance`, `regulatory`, `privacy`
- Training and offensive testing: `security-training`, `penetration-testing`

## Collaboration Workflows

```bash
re-shell collab webrtc-sharing engineering-room --enable-screen-sharing --enable-file-transfer --output tmp/webrtc
re-shell collab terminal-broadcasting ops-room --enable-interactive --enable-recording --output tmp/terminal
re-shell collab operational-transform docs-room --enable-presence --enable-cursors --output tmp/ot
re-shell collab session-recording onboarding-room --enable-auto-recording --enable-playback --output tmp/recording
```

## Collaboration Areas Covered By The Group

- Real-time teamwork: `voice-video-integration`, `workspace-sync`, `team-coding-sessions`, `collaboration`
- Team process: `code-review-workflow`, `collaborative-testing`, `incident-response`, `project-mgmt`
- Productivity and analytics: `developer-productivity`, `velocity-tracking`, `custom-analytics`, `feature-flag`
- Team health: `communication-analysis`, `workload-balancing`, `burnout-detection`, `team-performance-optimization`
- Knowledge flow: `knowledge-sharing`, `knowledge-sharing-automation`, `skills-assessment`, `architecture-design`

## Learning And Enablement

```bash
re-shell learn interactive-tutorials onboarding --enable-progress-tracking --enable-certificates --output tmp/tutorials
re-shell learn skill-assessment frontend-bench
re-shell learn mentorship team-mentoring
re-shell learn code-quality-coaching refactor-track
re-shell learn best-practices platform-handbook
re-shell learn technical-docs docs-program
```

## Suggested Enterprise Rollout Path

1. Start with `security vulnerability-scan`, `security secret-detection`, and `security compliance-reporting`.
2. Add `collab webrtc-sharing` or `collab terminal-broadcasting` for pairing and incident response.
3. Use `learn interactive-tutorials` and `learn code-quality-coaching` to document standards and onboard teams.
