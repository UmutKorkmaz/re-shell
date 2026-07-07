// `re-shell api verify` — PURE API contract + spec-drift engine.
//
// Normalizes an OpenAPI/GraphQL-style API spec into a typed operation model,
// diffs the current spec against a baseline for BACKWARD-INCOMPATIBLE changes
// (removed endpoints/operations, removed response fields, newly-required
// params, narrowed types), and uses the workspace dependency graph to compute
// the cross-service BLAST RADIUS of a producer spec change — the novel part
// single-service contract tools cannot do. This module is intentionally I/O-free
// and contracts-free: it only transforms in-memory specs + graph into findings.
//
// No mutation of any input is ever performed.

/** One normalized API operation (OpenAPI path+method, or a GraphQL field). */
export interface ApiOperation {
  /** Stable id, e.g. "GET /users/{id}" or "Mutation.createUser". */
  readonly id: string;
  /** Optional response field names the operation returns. */
  readonly responseFields: readonly string[];
  /** Required request parameter names (newly-required ones break consumers). */
  readonly requiredParams: readonly string[];
  /** The type of the response body, when declared (e.g. "object", "string"). */
  readonly responseType?: string;
}

/** A normalized API spec: its operations keyed by id. */
export interface ApiSpecLite {
  /** The API/producer name. */
  readonly name: string;
  /** The API's operations, keyed by their stable id. */
  readonly operations: ReadonlyMap<string, ApiOperation>;
}

/** The kind of a breaking spec change. */
export type ApiBreakingKind =
  | 'operation-removed'
  | 'response-field-removed'
  | 'param-became-required'
  | 'response-type-narrowed';

/** One backward-incompatible spec finding. */
export interface ApiFindingLite {
  /** The severity classification of the finding. */
  readonly severity: 'breaking' | 'skew' | 'info';
  /** The category of breaking change this finding represents. */
  readonly kind: ApiBreakingKind;
  /** Human-readable description of the finding. */
  readonly message: string;
  /** The operation id the finding pertains to, when applicable. */
  readonly operation?: string;
  /** The consuming services impacted by this change (blast radius). */
  readonly consumers: readonly string[];
}

/** The graph shape (each producer/service → its upstream deps). */
export type ApiGraph = ReadonlyMap<string, readonly string[]>;

/** Is the value a plain object (record) and not an array/null? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalize a raw OpenAPI-ish document into an ApiSpecLite. Reads `paths` →
 * path+method operations, each operation's required `parameters` and the fields
 * of its 2xx response schema. Tolerates missing pieces (degrades to empty).
 *
 * @param raw - The raw OpenAPI-ish document to normalize. May be unknown-shaped.
 * @param name - The producer/API name to assign to the resulting spec.
 * @returns A normalized {@link ApiSpecLite} with operations keyed by their stable id.
 */
export function normalizeOpenApi(
  raw: unknown,
  name: string
): ApiSpecLite {
  const operations = new Map<string, ApiOperation>();
  if (!isRecord(raw)) return { name, operations };
  const paths = raw['paths'];
  if (!isRecord(paths)) return { name, operations };

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) continue;
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = pathItem[method];
      if (!isRecord(op)) continue;
      const id = `${method.toUpperCase()} ${path}`;

      const parameters = Array.isArray(op['parameters']) ? op['parameters'] : [];
      const requiredParams = parameters
        .filter((p): p is Record<string, unknown> => isRecord(p) && p['required'] === true)
        .map(p => String(p['name']))
        .filter(n => n.length > 0);

      const responseFields = extractResponseFields(op);
      const responseType = extractResponseType(op);

      operations.set(id, { id, responseFields, requiredParams, responseType });
    }
  }
  return { name, operations };
}

/** Extract the declared response field names from a 2xx response schema. */
function extractResponseFields(op: Record<string, unknown>): string[] {
  const responses = op['responses'];
  if (!isRecord(responses)) return [];
  // Prefer a 200, then any 2xx, then any response object.
  const ok = responses['200'] ?? responses['201'] ?? responses['2XX'];
  const resp = isRecord(ok) ? ok : Object.values(responses).find(isRecord);
  if (!isRecord(resp)) return [];
  const content = resp['content'];
  if (!isRecord(content)) return [];
  const json = content['application/json'];
  if (!isRecord(json)) return [];
  const schema = json['schema'];
  if (!isRecord(schema)) return [];
  const props = schema['properties'];
  if (!isRecord(props)) return [];
  return Object.keys(props);
}

/** Extract the declared response body type (top-level), when present. */
function extractResponseType(op: Record<string, unknown>): string | undefined {
  const responses = op['responses'];
  if (!isRecord(responses)) return undefined;
  const ok = responses['200'] ?? responses['201'];
  const resp = isRecord(ok) ? ok : undefined;
  if (!resp) return undefined;
  const content = resp['content'];
  if (!isRecord(content)) return undefined;
  const json = content['application/json'];
  if (!isRecord(json)) return undefined;
  const schema = json['schema'];
  if (isRecord(schema) && typeof schema['type'] === 'string') return schema['type'];
  return undefined;
}

/** The breaking-change diff of a spec against its baseline. */
export interface ApiSpecDiff {
  /** Operation ids that existed in the baseline but are gone in the current spec. */
  readonly removedOperations: readonly string[];
  /** Response fields declared in the baseline but absent in the current spec. */
  readonly removedResponseFields: readonly { operation: string; field: string }[];
  /** Request parameters that became required in the current spec. */
  readonly newlyRequiredParams: readonly { operation: string; param: string }[];
  /** Response body types that were narrowed from the baseline. */
  readonly narrowedResponseTypes: readonly { operation: string; from?: string; to?: string }[];
}

/**
 * Diff a current spec against its baseline. Backward-INCOMPATIBLE changes:
 *   - a removed operation (consumers calling it break),
 *   - a removed response field (consumers reading it break),
 *   - a param that BECAME required (consumers omitting it break),
 *   - a response type narrowed (e.g. any → string) (consumers break).
 * Additions (new operations/fields, optional params) are non-breaking.
 *
 * @param baseline - The previous/baseline normalized API spec.
 * @param current - The current normalized API spec to compare against the baseline.
 * @returns An {@link ApiSpecDiff} enumerating the backward-incompatible changes.
 */
export function diffApiSpec(
  baseline: ApiSpecLite,
  current: ApiSpecLite
): ApiSpecDiff {
  const removedOperations: string[] = [];
  const removedResponseFields: { operation: string; field: string }[] = [];
  const newlyRequiredParams: { operation: string; param: string }[] = [];
  const narrowedResponseTypes: { operation: string; from?: string; to?: string }[] = [];

  for (const [id, baseOp] of baseline.operations) {
    const curOp = current.operations.get(id);
    if (!curOp) {
      removedOperations.push(id);
      continue;
    }
    const baseFields = new Set(baseOp.responseFields);
    for (const field of curOp.responseFields) baseFields.delete(field);
    for (const removed of baseFields) {
      removedResponseFields.push({ operation: id, field: removed });
    }
    const baseRequired = new Set(baseOp.requiredParams);
    for (const param of curOp.requiredParams) {
      if (!baseRequired.has(param)) {
        newlyRequiredParams.push({ operation: id, param });
      }
    }
    if (
      baseOp.responseType !== undefined &&
      curOp.responseType !== undefined &&
      baseOp.responseType !== curOp.responseType &&
      baseOp.responseType !== 'any' &&
      !isWideningType(baseOp.responseType, curOp.responseType)
    ) {
      narrowedResponseTypes.push({ operation: id, from: baseOp.responseType, to: curOp.responseType });
    }
  }

  return {
    removedOperations,
    removedResponseFields,
    newlyRequiredParams,
    narrowedResponseTypes,
  };
}

/** True when `to` is a strictly wider type than `from` (a non-breaking change). */
function isWideningType(from: string, to: string): boolean {
  // string → any is a widening; object → any is a widening. Narrowing the other
  // way is breaking. Everything else with a different type string is breaking.
  return to === 'any' && from !== 'any';
}

/**
 * Compute the transitive CONSUMERS of a producer across the workspace graph: the
 * services that depend (directly or transitively) on the producer. A producer
 * spec change impacts these consumers — the cross-service blast radius.
 *
 * @param graph - The workspace dependency graph (each service → its upstream deps).
 * @param producer - The producer/service name whose consumers should be computed.
 * @returns A sorted list of transitive consumer service names.
 */
export function computeBlastRadius(
  graph: ApiGraph,
  producer: string
): string[] {
  // Build the reverse (dependents) graph, then BFS from the producer.
  const dependents = new Map<string, string[]>();
  for (const name of graph.keys()) dependents.set(name, []);
  for (const [name, deps] of graph) {
    for (const dep of deps) {
      if (dep !== name && dependents.has(dep)) dependents.get(dep)!.push(name);
    }
  }
  const consumers = new Set<string>();
  const queue = [producer];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dependent of dependents.get(current) ?? []) {
      if (!consumers.has(dependent)) {
        consumers.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return [...consumers].sort();
}

/**
 * Turn a spec diff into findings, tagging each with the producer's blast radius
 * (its transitive consumers) so the report shows which services break.
 *
 * @param producer - The producer/API name the diff pertains to.
 * @param consumers - The transitive consumers impacted by changes to the producer.
 * @param diff - The backward-incompatible spec diff to convert into findings.
 * @returns An array of {@link ApiFindingLite} entries, one per breaking change.
 */
export function diffToApiFindings(
  producer: string,
  consumers: readonly string[],
  diff: ApiSpecDiff
): ApiFindingLite[] {
  const findings: ApiFindingLite[] = [];
  for (const id of diff.removedOperations) {
    findings.push({
      severity: 'breaking',
      kind: 'operation-removed',
      message: `Operation "${id}" was removed from the "${producer}" API`,
      operation: id,
      consumers,
    });
  }
  for (const { operation, field } of diff.removedResponseFields) {
    findings.push({
      severity: 'breaking',
      kind: 'response-field-removed',
      message: `Response field "${field}" was removed from operation "${operation}" on the "${producer}" API`,
      operation,
      consumers,
    });
  }
  for (const { operation, param } of diff.newlyRequiredParams) {
    findings.push({
      severity: 'breaking',
      kind: 'param-became-required',
      message: `Parameter "${param}" became required on operation "${operation}" of the "${producer}" API`,
      operation,
      consumers,
    });
  }
  for (const { operation, from, to } of diff.narrowedResponseTypes) {
    findings.push({
      severity: 'breaking',
      kind: 'response-type-narrowed',
      message: `Response type on operation "${operation}" narrowed from "${from}" to "${to}" on the "${producer}" API`,
      operation,
      consumers,
    });
  }
  return findings;
}

/** The outcome of validating a single response against an operation's fields. */
export interface ResponseViolation {
  /** The operation id whose response was validated. */
  readonly operation: string;
  /** The declared field that was missing from the response. */
  readonly field: string;
  /** Human-readable description of the violation. */
  readonly message: string;
}

/**
 * Validate a response object against an operation's declared response fields.
 * Reports each DECLARED field that is absent from the response (the offending
 * field). Pure: takes the spec + response, returns violations. (Live-service
 * validation is the command layer's job; this is the pure check.)
 *
 * @param operation - The normalized API operation whose declared fields are checked.
 * @param response - The actual response object to validate against the operation.
 * @returns An array of {@link ResponseViolation} entries, one per missing declared field.
 */
export function validateResponse(
  operation: ApiOperation,
  response: Record<string, unknown>
): ResponseViolation[] {
  const violations: ResponseViolation[] = [];
  for (const field of operation.responseFields) {
    if (!(field in response)) {
      violations.push({
        operation: operation.id,
        field,
        message: `Response to "${operation.id}" is missing declared field "${field}"`,
      });
    }
  }
  return violations;
}
