import {
  listBackendTemplates,
  toTemplateSummary,
  type BackendTemplate,
} from '../templates/backend/index';

/**
 * One row of the template compatibility matrix: a template plus the
 * databases, caches, deployment targets and features it advertises through its
 * registry metadata (tags + features).
 */
export interface MatrixRow {
  /** Stable, unique identifier of the template (kebab-case). */
  id: string;
  /** Machine-readable name of the template. */
  name: string;
  /** Optional human-friendly display name used in user-facing UI. */
  displayName?: string;
  /** Primary programming language the template is written in (e.g. `typescript`, `python`). */
  language: string;
  /** Framework or runtime the template is built on (e.g. `express`, `fastapi`). */
  framework: string;
  /** Normalized set of databases the template supports, derived from its tags/features. */
  databases: string[];
  /** Normalized set of caches the template supports, derived from its tags/features. */
  caches: string[];
  /** Normalized set of deployment targets the template supports, derived from its tags/features. */
  deploymentTargets: string[];
  /** Sorted list of feature tags the template advertises verbatim from the registry. */
  features: string[];
}

/**
 * Distinct values seen across every row, so consumers can build filter UIs or
 * assert coverage without re-deriving the union themselves.
 *
 * Each field is the deduplicated, sorted union of the matching field across
 * every {@link MatrixRow} produced by the matrix.
 */
export interface MatrixFacets {
  /** Distinct languages advertised across all templates. */
  languages: string[];
  /** Distinct frameworks advertised across all templates. */
  frameworks: string[];
  /** Distinct databases supported across all templates. */
  databases: string[];
  /** Distinct caches supported across all templates. */
  caches: string[];
  /** Distinct deployment targets supported across all templates. */
  deploymentTargets: string[];
  /** Distinct feature tags advertised across all templates. */
  features: string[];
}

/**
 * Result of building the template compatibility matrix: the per-template rows
 * plus aggregated facets used to drive filters and coverage checks.
 */
export interface TemplateMatrix {
  /** One normalized row per template in the backend registry, sorted by id. */
  matrix: MatrixRow[];
  /** Aggregated distinct values across all rows, used for filters and coverage assertions. */
  facets: MatrixFacets;
}

/**
 * Canonical marker -> normalized name maps. A template "supports" an entry when
 * any of its tags/features match a marker (substring, case-insensitive). Sourced
 * purely from registry metadata so the grid stays in lockstep with the registry.
 */
const DATABASE_MARKERS: Record<string, string> = {
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mariadb',
  mongo: 'mongodb',
  mongodb: 'mongodb',
  sqlite: 'sqlite',
  couchdb: 'couchdb',
  couchbase: 'couchbase',
  cassandra: 'cassandra',
  dynamodb: 'dynamodb',
  neo4j: 'neo4j',
  influxdb: 'influxdb',
  elasticsearch: 'elasticsearch',
  database: 'generic-sql',
};

const CACHE_MARKERS: Record<string, string> = {
  redis: 'redis',
  memcached: 'memcached',
  caching: 'in-memory',
  cache: 'in-memory',
};

const DEPLOYMENT_MARKERS: Record<string, string> = {
  docker: 'docker',
  container: 'docker',
  kubernetes: 'kubernetes',
  k8s: 'kubernetes',
  'cloud-native': 'kubernetes',
  serverless: 'serverless',
  lambda: 'serverless',
  cicd: 'ci-cd',
  'ci-cd': 'ci-cd',
};

/**
 * Match a template's signal tokens against a marker map, returning the distinct,
 * sorted set of normalized values.
 */
function deriveFrom(signals: string[], markers: Record<string, string>): string[] {
  const found = new Set<string>();
  for (const signal of signals) {
    const lower = signal.toLowerCase();
    for (const [marker, normalized] of Object.entries(markers)) {
      if (lower.includes(marker)) {
        found.add(normalized);
      }
    }
  }
  return [...found].sort();
}

/**
 * Build a single matrix row from a registry template.
 */
function toMatrixRow(template: BackendTemplate): MatrixRow {
  const summary = toTemplateSummary(template);
  const signals = [...(summary.tags ?? []), ...(summary.features ?? [])];

  return {
    id: summary.id,
    name: summary.name,
    displayName: summary.displayName,
    language: summary.language,
    framework: summary.framework,
    databases: deriveFrom(signals, DATABASE_MARKERS),
    caches: deriveFrom(signals, CACHE_MARKERS),
    deploymentTargets: deriveFrom(signals, DEPLOYMENT_MARKERS),
    features: [...(summary.features ?? [])].sort(),
  };
}

/**
 * Collect the distinct, sorted union of a field across all rows.
 */
function collect(rows: MatrixRow[], pick: (r: MatrixRow) => string[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const value of pick(row)) {
      set.add(value);
    }
  }
  return [...set].sort();
}

/**
 * Build the full template compatibility matrix + facets from the backend
 * registry. Every registry entry yields exactly one row.
 *
 * Each row's databases, caches and deployment targets are derived from the
 * template's tags and features using canonical marker maps, so the matrix
 * stays in lockstep with whatever the registry advertises.
 *
 * @returns A {@link TemplateMatrix} containing one sorted row per backend
 * template and the aggregated {@link MatrixFacets} across all rows.
 */
export function buildTemplateMatrix(): TemplateMatrix {
  const rows = listBackendTemplates()
    .map(toMatrixRow)
    .sort((a, b) => a.id.localeCompare(b.id));

  const facets: MatrixFacets = {
    languages: collect(rows, r => [r.language]),
    frameworks: collect(rows, r => [r.framework]),
    databases: collect(rows, r => r.databases),
    caches: collect(rows, r => r.caches),
    deploymentTargets: collect(rows, r => r.deploymentTargets),
    features: collect(rows, r => r.features),
  };

  return { matrix: rows, facets };
}
