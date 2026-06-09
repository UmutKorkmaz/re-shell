---
title: "data"
description: "Schema, serialization, cache, lineage, and encryption."
---

The `data` group generates data-layer utilities for cross-language services:
type conversion, schema evolution, serialization, compression, lineage tracking,
encryption, format negotiation, and caching.

```bash
re-shell data --help
```

| Subcommand | Purpose |
| --- | --- |
| `convert` | Automatic data-type conversion between languages. |
| `schema <name>` | Schema evolution and backwards-compatibility management. |
| `serialize <name>` | Data serialization optimization with compression. |
| `compress <name>` | Compression and encoding strategies for large payloads. |
| `lineage <name>` | Data lineage tracking across polyglot services. |
| `encrypt <name>` | Encryption for sensitive cross-service communication. |
| `format <name>` | Data format negotiation with content-type handling. |
| `cache <name>` | Data caching strategies for cross-language communication. |

## Examples

```bash
re-shell data schema orders
re-shell data encrypt payments
re-shell data cache catalog
re-shell data convert
```

Run `re-shell data <subcommand> --help` for the flags of any subcommand.

## See also

- [service & bridge](/re-shell/cli/service-bridge/) — typed cross-language
  clients that carry this data.
- [security](/re-shell/cli/security/) — broader data-protection generators.
