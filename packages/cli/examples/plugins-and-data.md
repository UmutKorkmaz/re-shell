# Plugins And Data

These examples cover plugin lifecycle management, marketplace and command-extension workflows, plus data transport and compatibility tooling.

## Plugin Lifecycle

```bash
re-shell plugin list --verbose
re-shell plugin discover --source npm --json
re-shell plugin install @re-shell/plugin-observe
re-shell plugin info @re-shell/plugin-observe
re-shell plugin enable @re-shell/plugin-observe
re-shell plugin update
re-shell plugin stats --json
re-shell plugin validate ./plugins/custom-plugin
```

## Marketplace, Hooks, And Command Registry

```bash
re-shell plugin search auth
re-shell plugin featured
re-shell plugin popular observability
re-shell plugin show @re-shell/plugin-auth
re-shell plugin install-marketplace @re-shell/plugin-auth latest
re-shell plugin hooks @re-shell/plugin-auth --json
re-shell plugin hook-types
re-shell plugin execute-hook beforeCommand '{"command":"build"}'
re-shell plugin commands
re-shell plugin command-conflicts
```

## Middleware, Validation, Cache, Docs, And Security

```bash
re-shell plugin middleware
re-shell plugin middleware-chain build
re-shell plugin test-middleware beforeCommand '{"command":"test"}'
re-shell plugin generate-docs
re-shell plugin search-docs auth
re-shell plugin validation-rules
re-shell plugin show-schema build
re-shell plugin cache-stats
re-shell plugin optimize-cache
re-shell plugin security-scan
re-shell plugin security-report
re-shell plugin list-conflicts
re-shell plugin auto-resolve
```

## Data Conversion And Schema Compatibility

```bash
re-shell data convert --source json --target protobuf --language typescript --output tmp/data-converter
re-shell data schema catalog --type openapi --language typescript --output tmp/schema-evolution
re-shell data serialize events --format protobuf --compression zstd --strategy balanced --output tmp/serialization
re-shell data compress exports --encoding base64 --chunking adaptive --adaptive entropy-based --output tmp/compression
```

## Data Lineage, Encryption, Negotiation, And Caching

```bash
re-shell data lineage orders --format mermaid --output tmp/lineage
re-shell data encrypt pii --algorithm aes-256-gcm --key-exchange ecdh --output tmp/encryption
re-shell data format catalog --formats json,xml,yaml --default json --output tmp/format
re-shell data cache catalog --backend redis --eviction lru --ttl 900 --max-entries 5000 --output tmp/cache
```

## Plugin Feature Areas To Explore Further

- Lifecycle and state: `reload`, `disable`, `uninstall`, `clear-cache`
- Dependencies and conflicts: `deps`, `resolve`, `resolve-conflicts`, `set-priority`, `resolution-history`
- Marketplace insight: `reviews`, `categories`, `marketplace-stats`, `clear-marketplace-cache`
- Docs and help system: `help`, `list-docs`, `docs-stats`, `configure-help`, `docs-templates`
- Validation and cache tuning: `test-validation`, `create-schema`, `transformations`, `validation-stats`, `clear-command-cache`, `list-cached`
