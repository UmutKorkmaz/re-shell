---
title: "plugin"
description: "Install, uninstall, update, validate, pin and review plugins; a marketplace backed by the npm registry."
---

The `plugin` group manages CLI plugins and extensions: install, uninstall, update,
validate, pin and review, dependency resolution, security scanning, a marketplace
backed by the npm registry, command registration, middleware, and auto-generated docs.
It is the largest command group in the CLI.

```bash
re-shell plugin --help
```

## Lifecycle

| Subcommand | Purpose |
| --- | --- |
| `list` / `info <plugin>` | List installed plugins; show one. |
| `install <plugin>` | Install from a local path, git URL, or npm package. |
| `uninstall <plugin>` | Remove the plugin's files, registry entry, hooks and commands. |
| `update [plugin]` | Update installed plugins (npm and git; respects pins). |
| `validate <path>` | Validate a plugin before publishing. |
| `pin <plugin> [version]` / `unpin <plugin>` | Pin to an exact version or semver range. |
| `review add <plugin>` / `review list` | Team reviews. |
| `enable` / `disable <plugin>`, `reload <plugin>` | Toggle or reload. |

```bash
re-shell plugin install ./my-plugin
re-shell plugin install reshell-plugin-example --pin          # pin the version you got
re-shell plugin install reshell-plugin-example@^1.2.0 --pin   # pin the range
re-shell plugin install https://github.com/acme/reshell-plugin-x.git --dry-run
re-shell plugin update --check          # report available updates; change nothing
re-shell plugin update                  # update everything that is not pinned
re-shell plugin uninstall reshell-plugin-example --dry-run
re-shell plugin uninstall reshell-plugin-example --purge     # also delete its data directory
```

- **Install** classifies the source (npm, git or local), resolves and validates the
  manifest, and records the plugin in **`.re-shell/plugins.json`** (written atomically; a
  corrupt file fails loudly instead of being overwritten). For git it records the
  resolved commit. `--dry-run` resolves and validates without installing. Errors surface
  as `PLUGIN_INSTALL_ERROR`.
- **Uninstall** removes the files, the registry entry, its hooks and its commands, and
  refuses (unless `--force`) while other plugins depend on it. `--purge` also removes
  `.re-shell/data/<plugin>`.
- **Update** re-resolves npm and git plugins (local plugins cannot be updated), skips
  pinned ones, and can require registry signature verification (`--verify`, or
  `--no-verify` to opt out explicitly).
- **Validate** checks the manifest, entry point, `engines` compatibility with the CLI,
  dependencies (`--check-registry` resolves missing ones against npm), a security scan and
  the package size. `--strict` treats warnings as failures. (`PLUGIN_VALIDATE_ERROR` is
  the error code for a failing run.)
- **Pin** stops `update` from moving a plugin.

## Marketplace

The marketplace connects to the **real npm registry** (keyword `reshell-plugin`) and can
verify package signatures against npm's key API.

| Subcommand | Purpose |
| --- | --- |
| `search [query]` | Search plugins (`--category`, `--featured`, `--verified`, `--sort`, `--limit`). |
| `show <plugin>` | Detailed plugin information. |
| `install-marketplace <plugin> [version]` | Install from the npm registry. |
| `featured` / `popular [category]` / `categories` | Browse. |

```bash
re-shell plugin search graphql --sort downloads
re-shell plugin install-marketplace reshell-plugin-example 1.0.0
```

**Ratings** come from npms.io (`score.final`); when npms.io is unreachable or has no
analysis, a score derived from npm download counts is used instead. npm has no review
system, so **reviews are a workspace-level record**, `.re-shell/plugin-reviews.json`,
that teammates add to and share through git:

```bash
re-shell plugin review add reshell-plugin-example --rating 4 --comment "works well"
re-shell plugin review list
```

Marketplace errors use `MARKETPLACE_UNREACHABLE`, `MARKETPLACE_ERROR` or
`MARKETPLACE_VERIFY_ERROR`.

**What was tested.** The installer, uninstaller, updater, validator, pinning, ratings
and reviews are covered by unit tests, and the lifecycle commands by integration tests
against a **fake npm registry** serving real tarballs. Installing from the live npm
registry is not asserted in CI and was not exercised while writing this
documentation. Plugins written for the older scope and manifest keys (`reshell`,
`reshell-plugin`, `reshell-cli`) are still recognized.

## Dependencies & security

```bash
re-shell plugin deps
re-shell plugin conflicts
re-shell plugin security-scan
re-shell plugin security-report
```

## Command extension system

Plugins can register their own commands, with middleware, conflict resolution,
validation schemas, caching, and auto-generated documentation:

```bash
re-shell plugin commands
re-shell plugin command-conflicts
re-shell plugin middleware
re-shell plugin generate-docs
```

Run `re-shell plugin --help` for the complete list of subcommands.

## Policy packs and theme packs

Two sibling distribution channels use the same npm approach: policy packs
(`re-shell workspace policy search|install`, keyword `reshell-policy-pack`; see
[workspace](/re-shell/cli/workspace/#workspace-policy)) and dashboard themes
(`re-shell ui theme ...`, keyword `reshell-theme`; see [ui](/re-shell/cli/ui/)).

## See also

- [Architecture: Monorepo](/re-shell/architecture/monorepo/): where plugins register.
- [JSON Contract](/re-shell/contract/json-contract/): plugin error codes.
