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
  id: string;
  name: string;
  displayName?: string;
  language: string;
  framework: string;
  databases: string[];
  caches: string[];
  deploymentTargets: string[];
  features: string[];
}

/**
 * Distinct values seen across every row, so consumers can build filter UIs or
 * assert coverage without re-deriving the union themselves.
 */
export interface MatrixFacets {
  languages: string[];
  frameworks: string[];
  databases: string[];
  caches: string[];
  deploymentTargets: string[];
  features: string[];
}

export interface TemplateMatrix {
  matrix: MatrixRow[];
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
