# Experimental (Parked) Scaffolds

The packages in this directory are **UNVERIFIED, PARKED scaffolds**. They are
intentionally placed outside the pnpm workspace globs (`packages/*`, `apps/*`),
so they are **excluded from install, build, test, and release**. They exist
here for future reference only.

> The hosted control plane (`@re-shell/control-plane`) graduated out of this
> directory into `packages/control-plane`; see `docs/control-plane.md`.

## vscode-extension (`@re-shell/vscode`)

A VS Code extension that would browse, build, and run vetted Re-Shell CLI
commands from inside the editor.

- Status: **compiles** and core logic is **unit-tested**, but it has **never
  been run inside a real VS Code host**.

## Important

These scaffolds are not part of the active monorepo. Do not rely on them for
production. They will not be built or published until they are verified and
promoted back into `packages/*` or `apps/*`.
