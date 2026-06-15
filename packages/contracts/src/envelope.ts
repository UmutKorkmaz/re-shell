import { z } from 'zod';

/**
 * Closed set of error codes the CLI is allowed to emit in --json mode.
 *
 * Authored as a zod enum so it can validate wire payloads at runtime, with the
 * TS union derived via `z.infer` so the two can never drift. Consumers rely on
 * this stable, documented vocabulary; typos cannot leak into output.
 */
export const errorCodeSchema = z.enum([
  // Codes emitted today
  'NOT_IN_MONOREPO',
  'LIST_WORKSPACES_ERROR',
  'GRAPH_GENERATION_ERROR',
  'WORKSPACE_NOT_FOUND',
  'TEMPLATE_NOT_FOUND',
  'INVALID_VARIABLES',
  'NOT_IN_RESHELL_PROJECT',
  'APPS_DIR_NOT_FOUND',
  'LIST_MICROFRONTENDS_ERROR',
  // Codes introduced by the json-output slice
  'TEMPLATES_LIST_ERROR',
  'WORKSPACE_SUMMARY_ERROR',
  'COMMANDS_LIST_ERROR',
  'DOCTOR_ERROR',
  'ANALYZE_ERROR',
  'HEALTH_CHECK_ERROR',
  // Codes introduced by the workspace.yaml v2 schema-validation slice
  'SCHEMA_VALIDATION_ERROR',
  // Codes introduced by the Nx/Turbo monorepo-migration slice
  'MONOREPO_MIGRATE_ERROR',
  // Codes introduced by the template compatibility-matrix + dry-run-diff slice
  'TEMPLATES_MATRIX_ERROR',
  'TEMPLATE_DRY_RUN_ERROR',
  // Codes introduced by the real plugin-install slice (W9b-1)
  'PLUGIN_INSTALL_ERROR',
  // Codes introduced by the registry-backed marketplace slice (W9b-2)
  'MARKETPLACE_UNREACHABLE',
  'MARKETPLACE_ERROR',
  'MARKETPLACE_VERIFY_ERROR',
  // Codes introduced by the policy-packs + dependency-drift slice (W9b-3)
  'POLICY_CHECK_ERROR',
  'DRIFT_CHECK_ERROR',
  // Code introduced by the K8s manifest-generation slice (W9c-1)
  'K8S_GENERATE_ERROR',
  // Codes introduced by the Helm chart + GitOps generation slice (W9c-2)
  'HELM_GENERATE_ERROR',
  'GITOPS_GENERATE_ERROR',
  // Code introduced by the cross-language service bridge slice (W9c-3)
  'BRIDGE_GENERATE_ERROR',
  // Code introduced by the offline AI/NLP command-intent slice (W9d-1)
  'AI_INTENT_ERROR',
  // Code introduced by the semantic-ish `find` search slice (issue #6)
  'FIND_ERROR',
  // Code introduced by the agent-readiness docs slice (issue #19)
  'AGENTS_ERROR',
  // Code introduced by the dependency-aware task runner slice (issue #7)
  'RUN_ERROR',
  // Code introduced by the content-addressed build cache slice (issue #8)
  'CACHE_ERROR',
  // Code introduced by the Skaffold-backed k8s inner-loop dev runtime (issue #13)
  'DEV_CLUSTER_ERROR',
  // Code introduced by the production-readiness scorecard slice (issue #12)
  'SCORECARD_ERROR',
  // Code introduced by the graph-aware release slice (issue #9)
  'RELEASE_ERROR',
  // Code introduced by the version-scoped migration/codemod slice (issue #10)
  'MIGRATE_ERROR',
  // Code introduced by the software-catalog auto-discovery slice (issue #11)
  'CATALOG_ERROR',
  // Code introduced by the module-federation contract-enforcement slice (issue #15)
  'FEDERATION_ERROR',
  // Code introduced by the JSON-mode generate-service slice (issue #17)
  'GENERATE_ERROR',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/**
 * Error payload nested inside a {@link JsonError} envelope.
 */
export const jsonErrorBodySchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type JsonErrorBody = z.infer<typeof jsonErrorBodySchema>;

/**
 * Canonical wire envelope: success branch.
 */
export interface JsonSuccess<T> {
  ok: true;
  data: T;
  warnings: string[];
}

/**
 * Canonical wire envelope: error branch.
 */
export interface JsonError {
  ok: false;
  error: JsonErrorBody;
  warnings: string[];
}

/**
 * Discriminated union of the success and error envelopes.
 */
export type JsonResponse<T> = JsonSuccess<T> | JsonError;

/**
 * Build a zod schema for the full {@link JsonResponse} envelope around a given
 * data schema. The error branch is fixed; the success branch is parameterized
 * by `dataSchema`.
 *
 * @example
 * const schema = jsonResponseSchema(workspaceSummarySchema);
 * schema.safeParse({ ok: true, data: summary, warnings: [] });
 */
export function jsonResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  const successSchema = z.object({
    ok: z.literal(true),
    data: dataSchema,
    warnings: z.array(z.string()),
  });

  const errorSchema = z.object({
    ok: z.literal(false),
    error: jsonErrorBodySchema,
    warnings: z.array(z.string()),
  });

  return z.discriminatedUnion('ok', [successSchema, errorSchema]);
}
