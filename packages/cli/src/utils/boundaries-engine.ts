// `re-shell boundaries` — PURE module-boundary / dependency-constraint engine.
//
// Tags packages (scope:shell, type:ui, layer:domain), evaluates declarative
// import rules over those tags (a domain layer must not import a UI layer; a
// shell must not import another remote's internals), and detects undeclared
// runtime dependencies. The evaluator is polyglot-agnostic — it operates on
// tag + edge data, not source — so the same rules govern JS/TS/Go/Python
// packages. This module is intentionally I/O-free: the command layer feeds it
// discovered packages, tags, and import edges.
//
// No mutation of any input is ever performed.

/**
 * A package's immutable tag set, e.g. `{ scope: 'shell', type: 'ui', layer: 'domain' }`.
 *
 * Tags are arbitrary string key/value pairs attached to a package and used by
 * the boundary evaluator to declaratively express dependency constraints.
 */
export type PackageTags = Readonly<Record<string, string>>;

/**
 * A tagged package node in the boundary graph.
 *
 * Each entry is a polyglot-agnostic package (JS/TS/Go/Python) discovered by the
 * command layer and fed into the pure evaluator along with observed edges.
 */
export interface BoundaryPackage {
  /** The unique name of the package (e.g. its manifest/module name). */
  readonly name: string;
  /** The tags attached to this package, used to evaluate declarative rules. */
  readonly tags: PackageTags;
  /**
   * Names of packages this one DECLARES as dependencies in its manifest.
   * Used by the evaluator to detect hidden/undeclared runtime dependencies.
   */
  readonly declaredDeps: readonly string[];
}

/**
 * One observed import edge between two packages in the boundary graph.
 *
 * Edges are produced by the command layer's import discovery and consumed by
 * the evaluator to test rule violations and undeclared dependencies.
 */
export interface BoundaryEdge {
  /** The name of the importing package. */
  readonly from: string;
  /** The name of the imported package. */
  readonly to: string;
  /** Repo-relative file path where the import occurs; included verbatim in the report. */
  readonly file?: string;
}

/**
 * A tag matcher used in declarative rules.
 *
 * Every key/value pair in a matcher must be present on a package's tags for the
 * match to succeed (logical AND semantics).
 */
export type TagMatcher = Readonly<Record<string, string>>;

/**
 * A declarative boundary rule: packages matching `from` MUST NOT import packages
 * matching `disallow`. E.g. `{from:{layer:'domain'}, disallow:{layer:'ui'}}`.
 *
 * Rules are evaluated against observed edges; the first matching rule for an
 * edge produces a single violation.
 */
export interface BoundaryRule {
  /** Stable identifier for the rule, surfaced in violation messages and reports. */
  readonly id: string;
  /** Matcher describing the importing (source) package(s) the rule applies to. */
  readonly from: TagMatcher;
  /** Matcher describing the imported (target) package(s) that are disallowed. */
  readonly disallow: TagMatcher;
  /** Human-readable explanation of why the rule exists, shown in violations. */
  readonly reason: string;
}

/**
 * The kind of a boundary violation.
 *
 * - `disallowed-import`: an edge violates a declarative rule's `from`/`disallow`.
 * - `undeclared-dependency`: an edge targets a package not in the importer's
 *   declared dependency list (a hidden runtime dependency).
 */
export type BoundaryViolationKind = 'disallowed-import' | 'undeclared-dependency';

/**
 * One boundary violation emitted by the evaluator.
 *
 * Lite records are intentionally minimal and report-oriented; they do not carry
 * full package/rule objects, only the keys needed to render the report.
 */
export interface BoundaryViolationLite {
  /** Discriminant identifying the violation category. */
  readonly kind: BoundaryViolationKind;
  /** Identifier of the rule that was violated, present only for `disallowed-import`. */
  readonly ruleId?: string;
  /** Name of the importing package. */
  readonly from: string;
  /** Name of the imported package. */
  readonly to: string;
  /** Repo-relative file path where the offending import occurs, if known. */
  readonly file?: string;
  /** Pre-formatted human-readable description of the violation. */
  readonly message: string;
}

/**
 * Test whether a package's tag set satisfies a matcher.
 *
 * The match succeeds when every key/value pair in the matcher is present with
 * the same value on the package (logical AND across all matcher entries).
 *
 * @param tags    The package's tag set to test.
 * @param matcher The matcher whose keys/values must all be present on `tags`.
 * @returns `true` when every matcher entry matches the package's tags.
 */
export function matchesTags(tags: PackageTags, matcher: TagMatcher): boolean {
  for (const [key, value] of Object.entries(matcher)) {
    if (tags[key] !== value) return false;
  }
  return true;
}

/**
 * Evaluate the boundary ruleset against the tagged packages and observed import edges.
 *
 * For each non-self edge the evaluator checks two flag categories:
 *   - `disallowed-import`: an edge from a package matching a rule's `from` to a
 *     package matching that rule's `disallow` (the first matching rule wins; one
 *     violation per edge is emitted).
 *   - `undeclared-dependency`: an edge whose `to` is NOT in the `from` package's
 *     `declaredDeps`, i.e. a hidden runtime dependency.
 *
 * Inputs are never mutated. Violations are returned sorted deterministically by
 * kind, then `from`, then `to`, then `file`.
 *
 * @param packages Tagged packages participating in the boundary graph.
 * @param edges    Observed import edges between packages.
 * @param rules    Declarative rules used to detect disallowed imports.
 * @returns Deterministically sorted boundary violations.
 */
export function evaluateBoundaries(
  packages: readonly BoundaryPackage[],
  edges: readonly BoundaryEdge[],
  rules: readonly BoundaryRule[]
): BoundaryViolationLite[] {
  const byName = new Map(packages.map(p => [p.name, p]));
  const violations: BoundaryViolationLite[] = [];

  for (const edge of edges) {
    if (edge.from === edge.to) continue; // self-imports are not boundary violations
    const fromPkg = byName.get(edge.from);
    const toPkg = byName.get(edge.to);

    // ── Disallowed-import: match the edge against every rule ───────────────────
    if (fromPkg && toPkg) {
      for (const rule of rules) {
        if (matchesTags(fromPkg.tags, rule.from) && matchesTags(toPkg.tags, rule.disallow)) {
          violations.push({
            kind: 'disallowed-import',
            ruleId: rule.id,
            from: edge.from,
            to: edge.to,
            file: edge.file,
            message: `"${edge.from}" (${formatTags(fromPkg.tags)}) imports "${edge.to}" (${formatTags(
              toPkg.tags
            )}); violates rule "${rule.id}": ${rule.reason}`,
          });
          break; // one violation per edge is enough
        }
      }
    }

    // ── Undeclared-dependency: `to` is not a declared dep of `from` ────────────
    if (fromPkg && toPkg && !fromPkg.declaredDeps.includes(edge.to)) {
      violations.push({
        kind: 'undeclared-dependency',
        from: edge.from,
        to: edge.to,
        file: edge.file,
        message: `"${edge.from}" imports "${edge.to}" but does not declare it as a dependency`,
      });
    }
  }

  // Deterministic ordering: kind, then from, then to, then file.
  return violations.sort((a, b) => {
    const rank = { 'disallowed-import': 0, 'undeclared-dependency': 1 } as const;
    if (a.kind !== b.kind) return rank[a.kind] - rank[b.kind];
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    if (a.to !== b.to) return a.to.localeCompare(b.to);
    return (a.file ?? '').localeCompare(b.file ?? '');
  });
}

/** Render a tag set as `key:value, key2:value2` for messages. */
function formatTags(tags: PackageTags): string {
  return Object.entries(tags)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
}

/**
 * The default boundary ruleset used when none is explicitly supplied.
 *
 * Encodes the classic monorepo layering guard: the domain layer must not import
 * the UI layer or the application shell, and a shell must not import another
 * remote's internals.
 */
export const DEFAULT_BOUNDARY_RULES: readonly BoundaryRule[] = [
  {
    id: 'no-domain-imports-ui',
    from: { layer: 'domain' },
    disallow: { layer: 'ui' },
    reason: 'the domain layer must not depend on the UI layer',
  },
  {
    id: 'no-domain-imports-shell',
    from: { layer: 'domain' },
    disallow: { layer: 'shell' },
    reason: 'the domain layer must not depend on the application shell',
  },
  {
    id: 'shell-isolates-remote-internals',
    from: { scope: 'shell' },
    disallow: { kind: 'remote-internal' },
    reason: 'the shell must not import another remote\'s internals',
  },
];
