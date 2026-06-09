---
title: "api"
description: "OpenAPI, Swagger, gateway, and client generation tooling."
---

The `api` group provides API development tooling that works across all supported
backend frameworks: spec generation, documentation, versioning, validation,
testing, gateways, analytics, and type-safe client generation.

```bash
re-shell api --help
```

| Subcommand | Alias | Purpose |
| --- | --- | --- |
| `openapi` | `spec` | Auto-generate OpenAPI specifications from code annotations. |
| `swagger` | `ui` | Generate Swagger UI documentation with custom branding. |
| `versioning` | `version` | API versioning patterns and backwards-compatibility management. |
| `validation` | `validate` | Request/response validation middleware for all frameworks. |
| `test` | | API testing suite: contract testing, mocking, and load testing. |
| `docs` | | Interactive API documentation with live examples and try-it. |
| `gateway` | | API gateway integration for supported backend frameworks. |
| `analytics` | | API analytics and monitoring. |
| `client` | | Generate type-safe API clients from OpenAPI specifications. |

## Examples

```bash
# Generate an OpenAPI spec from annotations
re-shell api openapi generate

# Generate branded Swagger UI
re-shell api swagger

# Generate a type-safe client from a spec
re-shell api client

# Add validation middleware and gateway integration
re-shell api validation
re-shell api gateway
```

> **Tip.** Nested `--version` flags resolve correctly — for example
> `re-shell api openapi generate --version 0.25.1` sets the spec version rather
> than printing the CLI banner.

Run `re-shell api <subcommand> --help` for the flags of any subcommand.

## See also

- [generate](/re-shell/cli/generate/) — scaffold the backend the API describes.
- [service & bridge](/re-shell/cli/service-bridge/) — typed cross-language
  clients.
