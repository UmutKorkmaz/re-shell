/**
 * A tiny path router: literal segments and `:param` segments, no wildcards, no
 * regexes — so a route can never match more than the segments it spells out.
 */

export interface RouteMatch<T> {
  route: T;
  params: Record<string, string>;
}

interface Entry<T> {
  method: string;
  segments: string[];
  route: T;
}

export type RouteLookup<T> =
  | { kind: 'match'; match: RouteMatch<T> }
  | { kind: 'method-not-allowed'; allowed: string[] }
  | { kind: 'not-found' };

function split(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

export class Router<T> {
  private readonly entries: Entry<T>[] = [];

  add(method: string, pattern: string, route: T): this {
    this.entries.push({ method, segments: split(pattern), route });
    return this;
  }

  /**
   * Find the route for `method` + `path`. Path parameters are percent-decoded;
   * a malformed escape sequence is a not-found (never a throw).
   */
  lookup(method: string, path: string): RouteLookup<T> {
    const segments = split(path);
    const allowed = new Set<string>();
    for (const entry of this.entries) {
      const params = this.matchSegments(entry.segments, segments);
      if (!params) {
        continue;
      }
      if (entry.method === method) {
        return { kind: 'match', match: { route: entry.route, params } };
      }
      allowed.add(entry.method);
    }
    if (allowed.size > 0) {
      return { kind: 'method-not-allowed', allowed: Array.from(allowed).sort() };
    }
    return { kind: 'not-found' };
  }

  private matchSegments(
    pattern: string[],
    actual: string[]
  ): Record<string, string> | undefined {
    if (pattern.length !== actual.length) {
      return undefined;
    }
    const params: Record<string, string> = {};
    for (let i = 0; i < pattern.length; i += 1) {
      const want = pattern[i];
      if (want.startsWith(':')) {
        try {
          params[want.slice(1)] = decodeURIComponent(actual[i]);
        } catch {
          return undefined;
        }
      } else if (want !== actual[i]) {
        return undefined;
      }
    }
    return params;
  }
}
