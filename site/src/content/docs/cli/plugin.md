---
title: "plugin"
description: "Plugin lifecycle and marketplace."
---

The `plugin` group manages CLI plugins and extensions: discovery, install,
lifecycle, dependency resolution, security scanning, a marketplace backed by the
npm registry, command registration, middleware, and auto-generated docs. It is
the largest command group in the CLI.

```bash
re-shell plugin --help
```

## Lifecycle

| Subcommand | Purpose |
| --- | --- |
| `list` | List installed plugins. |
| `discover` | Discover available plugins. |
| `install <plugin>` | Install from a local path, git URL, or npm package. |
| `uninstall <plugin>` | Uninstall a plugin. |
| `enable` / `disable <plugin>` | Toggle a plugin. |
| `info <plugin>` | Show plugin information. |
| `update` | Update all plugins. |
| `validate <path>` | Validate a plugin. |
| `reload <plugin>` | Reload a plugin. |

```bash
re-shell plugin install ./my-plugin
re-shell plugin install reshell-plugin-example
re-shell plugin list
re-shell plugin info reshell-plugin-example
```

The installer classifies the source (npm / git / local), resolves and validates
the manifest, and registers it in `.re-shell/plugins/registry.json`. Errors
surface as `code: "PLUGIN_INSTALL_ERROR"`.

## Marketplace

The marketplace connects to the **real npm registry** (keyword
`reshell-plugin`) and can verify package signatures against npm's key API.

| Subcommand | Purpose |
| --- | --- |
| `search [query]` | Search plugins in the marketplace. |
| `show <plugin>` | Detailed plugin information from the marketplace. |
| `install-marketplace <plugin> [version]` | Install from the npm registry. |
| `featured` / `popular [category]` | Browse featured/popular plugins. |
| `categories` | Show available categories. |

```bash
re-shell plugin search graphql
re-shell plugin featured
re-shell plugin install-marketplace reshell-plugin-example 1.0.0
```

Marketplace errors use `code: "MARKETPLACE_UNREACHABLE"`,
`"MARKETPLACE_ERROR"`, or `"MARKETPLACE_VERIFY_ERROR"`.

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

## See also

- [Architecture: Monorepo](/re-shell/architecture/monorepo/) — where plugins
  register.
- [JSON Contract](/re-shell/contract/json-contract/) — plugin error codes.
