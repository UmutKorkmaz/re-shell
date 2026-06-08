# Commands from index.ts lines 492-3641

This file maps every command in that range to its target group and new subcommand name.

## tools group

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| di-generate | 494 | tools di generate | ../utils/dependency-injection |
| di-wire | 531 | tools di wire | ../utils/dependency-injection |
| di-validate | 556 | tools di validate | ../utils/dependency-injection |
| template-analyze | 1109 | tools template analyze | ../utils/template-selection |
| template-recommend | 1167 | tools template recommend | ../utils/template-selection |
| template-match | 1195 | tools template match | ../utils/template-selection |
| template-validate | 1253 | tools template validate | ../utils/template-selection |
| doc-generate | 1773 | tools doc generate | ../utils/doc-generation |
| doc-readme | 1839 | tools doc readme | ../utils/doc-generation |
| doc-jsdoc | 1871 | tools doc jsdoc | ../utils/doc-generation |
| error-handler | 2904 | tools error-handler | ../utils/cross-language-error-handler |
| tui | 3566 | tools tui | ../commands/ink-tui |

## generate group

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| scaffold | 620 | generate scaffold | ../utils/service-scaffolding, ../utils/framework-detection |
| scaffold-list | 705 | generate scaffold-list | (inline) |
| scaffold-validate | 743 | generate scaffold-validate | ../utils/framework-detection |
| code-generate | 1668 | generate code | ../utils/code-generation |
| code-analyze | 1714 | generate code-analyze | ../utils/code-generation |

## quality group

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| test-setup | 807 | quality test-setup | ../utils/testing-setup, ../utils/framework-detection |
| test-validate | 903 | quality test-validate | (inline fs checks) |
| best-practices-check | 1507 | quality check | ../utils/best-practices |
| best-practices-rules | 1538 | quality rules | ../utils/best-practices |
| best-practices-init | 1598 | quality init | ../utils/best-practices |
| best-practices-validate | 1632 | quality validate | ../utils/best-practices |

## service group

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| services-analyze | 954 | service analyze | ../utils/service-relationships |
| services-link | 977 | service link | ../utils/service-relationships |
| services-validate | 1011 | service validate | ../utils/service-relationships |
| services-graph | 1023 | service graph | ../utils/service-relationships, ../utils/dependency-graph-viz |
| service-analyze | 1338 | service inspect | ../utils/service-integration |
| service-integrate | 1357 | service integrate | ../utils/service-integration |
| service-validate | 1417 | service check | ../utils/service-integration |
| service-deps | 1454 | service deps | ../utils/service-integration |
| mq-generate | 2437 | service mq generate | ../utils/message-queue |
| mq-crud | 2486 | service mq crud | ../utils/message-queue |
| events-generate | 2526 | service events generate | ../utils/event-streaming |
| events-crud | 2581 | service events crud | ../utils/event-streaming |
| discovery-generate | 2622 | service discovery | ../utils/service-discovery |
| circuit-breaker | 2661 | service circuit-breaker | ../utils/circuit-breaker |
| load-balancer | 2701 | service load-balancer | ../utils/load-balancer |
| service-versioning | 2853 | service versioning | ../utils/service-versioning |

## api group

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| doc-openapi | 1806 | api openapi | ../utils/doc-generation |
| protocol-generate | 2017 | api protocol generate | ../utils/service-protocol |
| protocol-bridge | 2054 | api protocol bridge | ../utils/service-protocol |
| protocol-list | 2096 | api protocol list | (inline fs) |
| grpc-generate | 2141 | api grpc generate | ../utils/grpc-bridge |
| grpc-proto | 2184 | api grpc proto | ../utils/grpc-bridge |
| rest-generate | 2218 | api rest generate | ../utils/rest-adapter |
| rest-crud | 2268 | api rest crud | ../utils/rest-adapter |
| graphql-generate | 2308 | api graphql generate | ../utils/graphql-federation |
| graphql-crud | 2359 | api graphql crud | ../utils/graphql-federation |
| graphql-schema | 2397 | api graphql schema | ../utils/graphql-federation |
| transformation | 2738 | api transformation | ../utils/transformation-middleware |
| universal-validator | 3055 | api validator | ../utils/universal-validator |

## config group

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| template-versions | 1904 | config template-versions | ../utils/template-versioning |
| template-updates | 1919 | config template-updates | ../utils/template-versioning |
| template-migrate | 1938 | config template-migrate | ../utils/template-versioning |
| template-migration-guide | 1995 | config template-migration-guide | ../utils/template-versioning |

## security group

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| auth | 2798 | security auth | ../utils/auth-middleware |

## data group (NEW - data.group.ts)

| Old Command | Line | New Subcommand | Import Path |
|---|---|---|---|
| data-converter | 2954 | data convert | ../utils/data-type-converter |
| schema-evolution | 3004 | data schema | ../utils/schema-evolution |
| serialization-optimizer | 3106 | data serialize | ../utils/serialization-optimizer |
| large-payload-compression | 3161 | data compress | ../utils/large-payload-compression |
| data-lineage-tracker | 3216 | data lineage | ../utils/data-lineage-tracker |
| data-encryption | 3267 | data encrypt | ../utils/data-encryption |
| format-negotiator | 3321 | data format | ../utils/format-negotiator |
| data-caching | 3376 | data cache | ../utils/data-caching |

## NOT grouped (remain as top-level commands)

| Command | Line | Reason |
|---|---|---|
| create | 3434 | Core project command |
| add | 3498 | Core project command |
| remove | 3522 | Core project command |
| list | 3542 | Core project command |
| build | 3598 | Core project command |
| serve | 3625 | Core project command |
