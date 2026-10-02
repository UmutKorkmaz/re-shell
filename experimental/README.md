# Experimental (Parked) Scaffolds

The packages in this directory are **UNVERIFIED, PARKED scaffolds**. They are
intentionally placed outside the pnpm workspace globs (`packages/*`, `apps/*`),
so they are **excluded from install, build, test, and release**. They exist
here for future reference only.

## control-plane (`@re-shell/control-plane`)

A hosted multi-tenant control-plane **stub** (tenant isolation, authz, request
validation) intended as a future hosted extension of the local Re-Shell hub.

- Status: logic is **unit-tested only**.
- Not deployed, no live server, no database — single-process logic only.

## Important

These scaffolds are not part of the active monorepo. Do not rely on them for
production. They will not be built or published until they are verified and
promoted back into `packages/*` or `apps/*`.
