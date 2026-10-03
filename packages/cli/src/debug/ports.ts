// Debug-port allocation: deterministic and collision-free.

export type DebugKind = 'node' | 'bun' | 'python' | 'go' | 'rust' | 'java' | 'php' | 'ruby' | 'dotnet';

/** Workspace v2 `language` value -> debug adapter family. */
export const LANGUAGE_KIND: Record<string, DebugKind> = {
  typescript: 'node',
  javascript: 'node',
  deno: 'node',
  bun: 'bun',
  python: 'python',
  go: 'go',
  rust: 'rust',
  java: 'java',
  kotlin: 'java',
  scala: 'java',
  clojure: 'java',
  csharp: 'dotnet',
  fsharp: 'dotnet',
  'f#': 'dotnet',
  php: 'php',
  ruby: 'ruby',
};

/** Conventional default debug port per adapter (dotnet attaches over a pipe: no port). */
export const BASE_PORT: Record<DebugKind, number | null> = {
  node: 9229,
  bun: 6499,
  python: 5678,
  go: 2345,
  rust: 1234,
  java: 5005,
  php: 9003,
  ruby: 12345,
  dotnet: null,
};

export interface PortRequest {
  name: string;
  kind: DebugKind;
  /** Explicit `metadata.debugPort` from the workspace config. */
  explicit?: number;
}

export interface PortAssignment {
  name: string;
  port: number | null;
  source: 'explicit' | 'allocated' | 'none';
}

export class PortAllocationError extends Error {}

/**
 * Allocate one debug port per service.
 *
 * - Explicit `metadata.debugPort` values are honoured and must be unique.
 * - Everything else starts at the language's conventional port and walks up to
 *   the next free number, visiting services in name order so the result does not
 *   depend on config ordering or on which subset of services is later selected.
 * - Application ports (`reserved`) and ports taken by earlier services are never reused.
 */
export function allocateDebugPorts(requests: PortRequest[], reserved: number[]): PortAssignment[] {
  const used = new Set<number>(reserved);
  const result = new Map<string, PortAssignment>();

  const explicit = requests.filter(r => r.explicit !== undefined && BASE_PORT[r.kind] !== null);
  const seenExplicit = new Map<number, string>();
  for (const r of explicit) {
    const port = r.explicit as number;
    if (seenExplicit.has(port)) {
      throw new PortAllocationError(
        `Services "${seenExplicit.get(port)}" and "${r.name}" both declare metadata.debugPort ${port}`
      );
    }
    if (reserved.includes(port)) {
      throw new PortAllocationError(`Service "${r.name}" metadata.debugPort ${port} collides with a service application port`);
    }
    seenExplicit.set(port, r.name);
    used.add(port);
    result.set(r.name, { name: r.name, port, source: 'explicit' });
  }

  const rest = requests.filter(r => !result.has(r.name)).sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rest) {
    const base = BASE_PORT[r.kind];
    if (base === null) {
      result.set(r.name, { name: r.name, port: null, source: 'none' });
      continue;
    }
    let candidate = base;
    while (used.has(candidate)) candidate += 1;
    if (candidate > 65535) throw new PortAllocationError(`No free debug port available for "${r.name}"`);
    used.add(candidate);
    result.set(r.name, { name: r.name, port: candidate, source: 'allocated' });
  }
  return requests.map(r => result.get(r.name) as PortAssignment);
}
