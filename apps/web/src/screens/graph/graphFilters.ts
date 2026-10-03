import type { WorkspaceLiveStatus } from '@re-shell/contracts';
import type { NodeFacts, StatusLookup } from './graphData';

export const FILTER_KEYS = ['q', 'language', 'framework', 'type', 'status'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type GraphFilters = Record<FilterKey, string>;

export const STATUS_ORDER: readonly WorkspaceLiveStatus[] = ['running', 'unhealthy', 'stopped', 'unknown'];

export function hasActiveFilters(filters: GraphFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key].trim() !== '');
}

/**
 * Ids matching the filters: every whitespace-separated search term must occur in
 * `name\npath`, and each active facet must equal the node's value. One O(n)
 * pass over precomputed facts; no per-node allocations beyond the result Set.
 */
export function matchNodes(facts: readonly NodeFacts[], filters: GraphFilters, statusOf: StatusLookup): Set<string> {
  const terms = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const fact of facts) {
    if (filters.language && fact.language !== filters.language) continue;
    if (filters.framework && fact.framework !== filters.framework) continue;
    if (filters.type && fact.type !== filters.type) continue;
    if (filters.status && statusOf(fact.id) !== filters.status) continue;
    let ok = true;
    for (const term of terms) {
      if (!fact.haystack.includes(term)) {
        ok = false;
        break;
      }
    }
    if (ok) out.add(fact.id);
  }
  return out;
}

export interface FacetOptions {
  language: string[];
  framework: string[];
  type: string[];
  status: string[];
}

/** Distinct values per facet, with the statuses in a fixed severity order. */
export function facetOptions(facts: readonly NodeFacts[], statusOf: StatusLookup): FacetOptions {
  const language = new Set<string>();
  const framework = new Set<string>();
  const type = new Set<string>();
  const status = new Set<string>();
  for (const f of facts) {
    language.add(f.language);
    framework.add(f.framework);
    type.add(f.type);
    status.add(statusOf(f.id));
  }
  const sort = (s: Set<string>): string[] => [...s].sort();
  return {
    language: sort(language),
    framework: sort(framework),
    type: sort(type),
    status: STATUS_ORDER.filter((s) => status.has(s)),
  };
}
