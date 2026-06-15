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

/** A package's tag set, e.g. { scope: 'shell', type: 'ui', layer: 'shell' }. */
export type PackageTags = Readonly<Record<string, string>>;

/** A tagged package in the boundary graph. */
export interface BoundaryPackage {
  readonly name: string;
  readonly tags: PackageTags;
  /** Names of packages this one DECLARES as dependencies (for undeclared-dep detection). */
  readonly declaredDeps: readonly string[];
}

/** One observed import edge between two packages. */
export interface BoundaryEdge {
  /** The importing package. */
  readonly from: string;
  /** The imported package. */
  readonly to: string;
  /** Repo-relative file where the import occurs (for the report). */
  readonly file?: string;
}

/** A tag matcher: every key/value must match a package's tags (AND semantics). */
export type TagMatcher = Readonly<Record<string, string>>;

/**
 * A declarative boundary rule: packages matching `from` MUST NOT import packages
 * matching `disallow`. E.g. {from:{layer:'domain'}, disallow:{layer:'ui'}}.
 */
export interface BoundaryRule {
  readonly id: string;
  readonly from: TagMatcher;
  readonly disallow: TagMatcher;
  readonly reason: string;
}

/** The kind of a boundary violation. */
export type BoundaryViolationKind = 'disallowed-import' | 'undeclared-dependency';

/** One boundary violation. */
export interface BoundaryViolationLite {
  readonly kind: BoundaryViolationKind;
  readonly ruleId?: string;
  readonly from: string;
  readonly to: string;
  readonly file?: string;
  readonly message: string;
}

/** True when `tags` satisfies the matcher (every matcher key matches). */
export function matchesTags(tags: PackageTags, matcher: TagMatcher): boolean {
  for (const [key, value] of Object.entries(matcher)) {
    if (tags[key] !== value) return false;
  }
  return true;
}

/**
 * Evaluate the boundary ruleset against the tagged packages + import edges.
 * Flags:
 *   - disallowed-import: an edge from a package matching a rule's `from` to a
 *     package matching its `disallow`.
 *   - undeclared-dependency: an edge whose `to` is NOT in the `from` package's
 *     declared deps (a hidden runtime dependency).
 * Returns violations sorted deterministically (by kind, from, to, file).
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

/** The default ruleset when none is provided (the classic layering guard). */
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
