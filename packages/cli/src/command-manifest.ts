/**
 * Static manifest of the lazily-loaded command groups.
 *
 * WHY: the CLI used to import every `groups/*.group.ts` module (and everything
 * they pull in) at startup, so even `re-shell --help` paid for the whole tree.
 * `lazy-commands.ts` now registers a lightweight stub per entry below and only
 * loads (`require`s) the group module that argv actually selects.
 *
 * HOW TO ADD A GROUP (one entry, in the same position you would have
 * registered it):
 *   {
 *     name: 'mygroup',                    // top-level command the group registers
 *     description: '<exact .description() text>',
 *     args: ['<task>'],                   // only if the top-level command has positional args
 *     hasOptions: true,                   // only if the top-level command has options
 *     module: './groups/mygroup.group',   // path relative to src/, no extension
 *     register: 'registerMygroupGroup',   // exported function (program: Command) => void
 *   },
 * A group that only attaches subcommands to an existing top-level command
 * (instead of creating its own) uses `attachesTo: '<existing name>'` and omits
 * description/args/hasOptions.
 *
 * Entries are data only: do NOT import group modules here. The drift test
 * (`tests/unit/command-manifest.test.ts`) compares this manifest to the real
 * command tree and prints exactly which field to update when they diverge.
 */
export interface GroupManifestEntry {
  /** Top-level command name registered by the group. */
  name: string;
  /** Exact description shown in `re-shell --help` (must match the real command). */
  description?: string;
  /** Positional arguments of the top-level command, e.g. `['<task>']`, for help usage. */
  args?: string[];
  /** True when the top-level command declares options (renders `[options]` in help). */
  hasOptions?: boolean;
  /** The group extends another top-level command instead of creating one (no stub). */
  attachesTo?: string;
  /** Module path relative to `src/` without extension, e.g. `./groups/run.group`. */
  module: string;
  /** Name of the exported `(program: Command) => void` registrar. */
  register: string;
}

/** Order matters: it is the order commands appear in `re-shell --help`. */
export const GROUP_MANIFEST: readonly GroupManifestEntry[] = [
  {
    name: 'completion',
    description: 'Install shell completion scripts (generated from the live command tree)',
    hasOptions: true,
    module: './groups/completion.group',
    register: 'registerCompletionGroup',
  },
  {
    name: 'workspace',
    description: 'Workspace health, dependencies, and sync management',
    module: './groups/workspace.group',
    register: 'registerWorkspaceGroup',
  },
  {
    name: 'config',
    description: 'Manage Re-Shell configuration',
    module: './groups/config.group',
    register: 'registerConfigGroup',
  },
  {
    name: 'generate',
    description: 'Generate code, tests, and documentation',
    module: './groups/generate.group',
    register: 'registerGenerateGroup',
  },
  {
    name: 'quality',
    description: 'Code quality, testing, and IDE integration tools',
    module: './groups/quality.group',
    register: 'registerQualityGroup',
  },
  {
    name: 'api',
    description: 'API development tools: OpenAPI, Swagger, versioning, validation, testing, docs, gateway, analytics, and client generation',
    module: './groups/api.group',
    register: 'registerApiGroup',
  },
  {
    name: 'plugin',
    description: 'Manage CLI plugins and extensions',
    module: './groups/plugin.group',
    register: 'registerPluginGroup',
  },
  {
    name: 'service',
    description: 'Manage polyglot services and development service orchestration',
    module: './groups/service.group',
    register: 'registerServiceGroup',
  },
  {
    name: 'tools',
    description: 'Development tools, utilities, and environment management',
    module: './groups/tools.group',
    register: 'registerToolsGroup',
  },
  {
    name: 'k8s',
    description: 'Kubernetes manifests, Helm charts, and cluster operations',
    module: './groups/k8s.group',
    register: 'registerK8sGroup',
  },
  {
    name: 'cloud',
    description: 'Cloud provider deployment and CDN management',
    module: './groups/cloud.group',
    register: 'registerCloudGroup',
  },
  {
    name: 'observe',
    description: 'Metrics, tracing, logging, and performance monitoring',
    module: './groups/observe.group',
    register: 'registerObserveGroup',
  },
  {
    name: 'security',
    description: 'Security, compliance, and governance commands',
    module: './groups/security.group',
    register: 'registerSecurityGroup',
  },
  {
    name: 'collab',
    description: 'Real-time collaboration (shared sessions on the control plane: `collab session ...`) plus collaboration code generators',
    module: './groups/collab.group',
    register: 'registerCollabGroup',
  },
  {
    name: 'learn',
    description: 'Learning, training, and knowledge development commands',
    module: './groups/learn.group',
    register: 'registerLearnGroup',
  },
  {
    name: 'data',
    description: 'Database migration, pooling, cache, and ORM utilities',
    module: './groups/data.group',
    register: 'registerDataGroup',
  },
  {
    name: 'templates',
    description: 'Discover and inspect framework templates',
    module: './groups/templates.group',
    register: 'registerTemplatesGroup',
  },
  {
    name: 'commands',
    description: 'Introspect available Re-Shell commands',
    module: './groups/commands.group',
    register: 'registerCommandsGroup',
  },
  {
    name: 'ai',
    description: 'Resolve a natural-language prompt to a re-shell command (cloud/local LLM or offline, never auto-runs)',
    args: ['<prompt...>'],
    hasOptions: true,
    module: './groups/ai.group',
    register: 'registerAiGroup',
  },
  {
    name: 'find',
    description: 'Search commands and templates by keyword (offline, ranked)',
    args: ['<query>'],
    hasOptions: true,
    module: './groups/find.group',
    register: 'registerFindGroup',
  },
  {
    name: 'agents',
    description: 'Generate and verify agent-readiness docs (AGENTS.md + llms.txt)',
    module: './groups/agents.group',
    register: 'registerAgentsGroup',
  },
  {
    name: 'run',
    description: 'Run a task across the workspace in dependency order',
    args: ['<task>'],
    hasOptions: true,
    module: './groups/run.group',
    register: 'registerRunGroup',
  },
  {
    name: 'cache',
    description: 'Inspect and prune the content-addressed build cache',
    module: './groups/cache.group',
    register: 'registerCacheGroup',
  },
  {
    name: 'dev',
    description: 'Local development runtime (use --cluster for the k8s inner loop, --restart-plan for graph-aware propagation)',
    hasOptions: true,
    module: './groups/dev.group',
    register: 'registerDevGroup',
  },
  {
    name: 'scorecard',
    description: 'Weighted production-readiness score (per-service grades + monorepo rollup)',
    hasOptions: true,
    module: './groups/scorecard.group',
    register: 'registerScorecardGroup',
  },
  {
    name: 'release',
    description: 'Graph-aware semver bump propagation + changelog + tags (+ optional publish)',
    hasOptions: true,
    module: './groups/release.group',
    register: 'registerReleaseGroup',
  },
  {
    name: 'migrate',
    description: 'Version-scoped migrations/codemods (review-then-apply, dependency-graph-ordered)',
    args: ['[to-version]'],
    hasOptions: true,
    module: './groups/migrate.group',
    register: 'registerMigrateGroup',
  },
  {
    name: 'catalog',
    description: 'Auto-discover the software catalog from the workspace graph (native + Backstage interop)',
    hasOptions: true,
    module: './groups/catalog.group',
    register: 'registerCatalogGroup',
  },
  {
    name: 'federation',
    description: 'Module-Federation contract & type enforcement (breaking-change + shared-dep skew)',
    module: './groups/federation.group',
    register: 'registerFederationGroup',
  },
  {
    // Attaches `api verify` to the existing `api` command (no second top-level `api`).
    name: 'api',
    attachesTo: 'api',
    module: './groups/api-verify.group',
    register: 'registerApiVerifyGroup',
  },
  {
    name: 'fix',
    description: 'Autonomous CI fixer: run the workspace gates and fix failures with validated AI patches on a new branch (use --ci)',
    hasOptions: true,
    module: './groups/fix-ci.group',
    register: 'registerFixCiGroup',
  },
  {
    name: 'boundaries',
    description: 'Module-boundary enforcement: tag-based import rules + undeclared-dep detection (CI-gatable)',
    hasOptions: true,
    module: './groups/boundaries.group',
    register: 'registerBoundariesGroup',
  },
  {
    name: 'env',
    description: 'Reproducible dev-environment generation (Devbox + devcontainer)',
    module: './groups/env.group',
    register: 'registerEnvGroup',
  },
  {
    name: 'ui',
    attachesTo: 'ui',
    module: './groups/ui-test.group',
    register: 'registerUiTestGroup',
  },
  {
    // `ui component new`, `ui generate`, `ui theme ...` on the standalone `ui` command.
    name: 'ui',
    attachesTo: 'ui',
    module: './groups/ui.group',
    register: 'registerUiGroup',
  },
  {
    name: 'pkg',
    description:
      'Unified package manager: add/remove/install/list/outdated across npm, pip, cargo, maven, dotnet, composer, bundler, go',
    module: './groups/pkg.group',
    register: 'registerPkgGroup',
  },
  {
    name: 'debug',
    description: 'Cross-language debugging configuration for workspace services',
    module: './groups/debug.group',
    register: 'registerDebugGroup',
  },
  {
    name: 'refactor',
    description: 'Workspace-wide refactors across languages and config files',
    module: './groups/refactor.group',
    register: 'registerRefactorGroup',
  },
];
