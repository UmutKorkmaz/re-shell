---
title: "Audit trail & compliance"
description: "A tamper-evident, hash-chained log of every state-changing command, and SOC 2 / ISO 27001 evidence reports built from it."
---

Re-Shell keeps an **audit trail** of the commands that change your workspace, lets
you **verify** that it has not been tampered with, and turns it (plus your policy
checks and configuration) into a **compliance evidence report**. This is evidence
collection, not certification: see [what it does not do](#what-this-is-not).

## The audit trail

Every command that changes state (`create`, `plugin install`, `k8s generate`,
`cloud deploy`, `config set`, `service link`, ...) appends one line to
`.re-shell/audit/audit.jsonl` in the workspace root, after it runs. A central
classifier (`src/audit/classify.ts`) decides which commands are state-changing:
`--help` and `--dry-run` never are, an explicit rule table covers the commands whose
verbs mislead, then verb heuristics apply, and an **unknown command is audited**
(fail closed). A test walks the real command catalog so stale rules fail the build.

Each entry records the sequence number, timestamp, actor (your `git user.email`,
else the OS user), command, arguments, working directory (relative to the workspace),
exit code and duration, plus the hash of the previous entry and its own SHA-256, so
the log is a **hash chain**: changing, removing, reordering or inserting a line breaks
the chain.

**Secrets are redacted before they are written.** Values of flags and keys whose
names look like secrets (`token`, `secret`, `password`, `api-key`, `authorization`,
...) and anything that looks like a credential (GitHub, npm, AWS, Slack, OpenAI-style
keys, JWTs, private-key headers, `scheme://user:password@host`) become `[REDACTED]`.

Opt out with `RE_SHELL_AUDIT=0` in the environment or `re-shell config set
audit.enabled false`; `audit.unknownCommands: ignore` stops auditing commands the
classifier cannot place. Commit the log if you want it as evidence. A workspace's
own `.re-shell/audit/` files are what the commands below read.

## `security audit verify`

```bash
re-shell security audit verify
re-shell security audit verify --json
re-shell security audit verify --expect-head <hash>   # a head hash you anchored elsewhere
```

Recomputes the chain and **exits 1 on any failure**. The CLI also records the latest
entry in `.re-shell/audit/audit.head.json`, so deleting the log or truncating its tail
is caught as long as that file is intact. `--expect-head` checks that the log ends at
a head hash you recorded somewhere an attacker with write access to the repository
cannot also edit (a CI artifact, a ticket, a signed tag); without such an external
anchor, someone who can rewrite both files can produce a log that verifies. Failures are named (`hash-mismatch`, `chain-broken`, `sequence-gap`,
`sequence-reordered`, `head-mismatch`, `anchor-mismatch`, `invalid-json`,
`invalid-entry`, `log-missing`).

```json
{
  "ok": true,
  "data": {
    "valid": true, "entries": 0, "lastSeq": null, "lastHash": null,
    "logPath": ".re-shell/audit/audit.jsonl", "logExists": false,
    "head": null, "failures": []
  },
  "warnings": []
}
```

(`security audit <name>`, with a project name, is the older generator for an audit-log
*system*; `audit verify` checks the log the CLI itself writes.)

## `security compliance report`

```bash
re-shell security compliance report --framework soc2
re-shell security compliance report --framework iso27001 --since 30d --format md --output compliance.md
re-shell security compliance report --framework soc2 --pack recommended --strict --json
```

Maps three kinds of evidence onto the framework's controls:

- the **audit log** (is it present, enabled, chain-valid; who changed what, when),
- **policy-check results** (`--pack <name|file>`, the same engine as
  [`workspace policy check`](/re-shell/cli/workspace/#workspace-policy)),
- **configuration and repository files**.

Each control is `evidence` (every check this tool can perform passed), `partial`, or
`no-evidence`, with the gaps listed. `--since` limits the audit window (an ISO date
or `30d`). Controls that depend on systems outside the repository (identity provider,
HR, physical security) are listed under `notEvaluated` instead of being omitted.
`--strict` exits non-zero when any control has no evidence, which makes the report a
CI gate. Frameworks: `soc2` (AICPA Trust Services Criteria, common criteria) and
`iso27001` (ISO/IEC 27001:2022 Annex A).

## What this is not

- **Not an attestation or certification.** The report says so in its output: auditors
  decide whether evidence satisfies a control.
- **Not protection against a privileged attacker.** The chain is tamper-*evident*. Someone
  who can rewrite the whole file can recompute it; anchor the head hash externally
  and use `--expect-head`.
- **Only the CLI's commands.** Changes made outside `re-shell` (your editor, `git`,
  other tools) are not recorded.

## See also

- [security](/re-shell/cli/security/): the security and compliance generators.
- [workspace](/re-shell/cli/workspace/#workspace-policy): policy packs, the other evidence source.
- [Roadmap](/re-shell/roadmap/).
