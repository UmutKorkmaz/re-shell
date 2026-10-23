# Re-Shell stabilization implementation plan

> **For agentic workers:** Use the parallel-agent workflow for independent workstreams; integrate and review the complete branch before release.

**Goal:** Finish the five approved follow-ups to v0.32.0 with reproducible local Docker evidence and an audited npm consumer.

**Architecture:** Preserve the shared command registry and tenant authorization. Add opt-in per-job Docker execution, a complete memory-only browser identity lifecycle, and OpenTelemetry context across HTTP and the durable job queue. Upgrade tooling as one coordinated dependency change.

**Tech stack:** Node.js 22.13.0+, pnpm 9.15.9, TypeScript, SQLite, React, Docker, Playwright, OpenTelemetry.

**Spec:** The approved priorities in this conversation and `docs/DEVELOPMENT_STATUS.md`.

## Global constraints

- Preserve the original feature checkout and unrelated services.
- Local Docker staging only; signed desktop and Marketplace publication remain deferred.
- Never expose provider/worker credentials in traces, logs, browser storage, or release artifacts.
- Docker execution fails closed; only exact owned containers may be removed.
- Report live provider/relay proof separately from fixtures and source tests.
- Graph-Loop and Sol Advisor remain disabled.

## Review focus

- Cancel/shutdown during Docker creation must leave no running owned container.
- Expired or replayed refresh credentials must clear the browser session without persisting tokens.
- Concurrent requests/jobs must not exchange trace contexts or tenant data.
- Exporter failure must be bounded and must not change command results.
- Clean npm consumers must resolve the tested production dependencies without workspace overrides.

## Task 1: Dependency/tooling remediation

**Files:** workspace manifests/lockfile, Vitest/Vite/ESLint configuration, CI, package smoke.

- [x] Refresh full, production, and clean-consumer audits; record advisory paths.
- [x] Upgrade patched compatible tooling and migrate obsolete test configuration.
- [x] Restore actual TypeScript lint enforcement in CI.
- [ ] Build, typecheck, lint, run suites and pack/consumer smoke; document any upstream blocker explicitly.

## Task 2: Worker isolation

**Files:** `packages/control-plane/src/worker/`, worker CLI options, Docker configuration, `docs/job-isolation.md`.

- [x] Add behavior tests for command containment, startup refusal, timeouts, cancellation, cleanup, and orphan recovery.
- [x] Implement explicit Docker mode with pinned image, exact workspace mount, no network, nonroot user and resource limits.
- [x] Run real Docker jobs and isolation/recovery probes; preserve existing process-mode tests.

## Task 3: Identity lifecycle

**Files:** browser SSO module/hook/panel, OIDC configuration/tests, `docs/OIDC.md`, local provider check.

- [x] Test rotation, expiry, refresh races, logout and safe endpoint/redirect bindings.
- [x] Implement memory-only refresh and explicit provider logout with local cleanup.
- [x] Run login, API authorization, refresh and logout against a real local identity provider.

## Task 4: Distributed tracing and recovery

**Files:** new control-plane tracing module/tests, HTTP edge, job migration/store, worker client integration, runtime, operations checks/docs.

- [x] Test strict W3C context parsing, concurrent isolation, exporter failures, and persisted job context.
- [x] Export bounded OTLP spans for HTTP, worker calls and job execution; exclude request bodies/tokens/identifiers from names.
- [x] Test schema upgrade, process restart and SQLite restore with owned temporary data.
- [x] Verify the same trace reaches the collector across API enqueue, worker execution and completion.

## Task 5: Integration and release acceptance

**Files:** local TURN/LLM validation scripts/tests and development status/release documentation.

- [x] Verify a real model request without offline fallback when a functioning endpoint is available.
- [x] Verify a real TURN relay candidate and data exchange between independent browser contexts.
- [ ] Run combined build/typecheck/lint/tests, independent code/security review, and CI.
- [ ] Publish authorized GitHub/npm changes only after reviewed checks pass; verify exact installed artifacts and report remaining external gates.
