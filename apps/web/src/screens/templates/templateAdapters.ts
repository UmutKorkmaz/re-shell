import type { TemplateSummary } from '@umutkorkmaz/contracts';
import { createReShellCommand } from '@umutkorkmaz/ui';
import type { TemplateFeed } from '../shared/feedSchemas';

/** Coarse template domain (mirrors the contracts `templateDomainSchema` enum). */
type TemplateDomain = TemplateSummary['domain'];

/**
 * Curated flagship templates surfaced as "Tier 1". The CLI feed carries no tier
 * field, so this allow-list is the single place that decides which templates get
 * the prominent visual treatment.
 */
const TIER_1_IDS = new Set<string>([
  'express',
  'fastify',
  'nestjs',
  'koa',
  'adonisjs',
  'apollo-server',
  'graphql-yoga',
]);

const DATABASE_KEYWORDS: Record<string, string> = {
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mongodb: 'MongoDB',
  mongo: 'MongoDB',
  redis: 'Redis',
  sqlite: 'SQLite',
  prisma: 'Prisma',
  mongoose: 'Mongoose',
};

const INFRA_KEYWORDS = ['docker', 'cdn', 'caching', 'kubernetes', 'serverless', 'edge'];
const FRONTEND_KEYWORDS = ['react', 'vue', 'svelte', 'angular', 'frontend'];

/** Derive a coarse domain from the template's tags (feed has no domain field). */
function deriveDomain(tags: readonly string[]): TemplateDomain {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => FRONTEND_KEYWORDS.includes(t))) return 'frontend';
  if (lower.some((t) => INFRA_KEYWORDS.includes(t))) return 'infrastructure';
  return 'backend';
}

/** Derive a database label from tags, if any keyword matches. */
function deriveDatabase(tags: readonly string[]): string | undefined {
  for (const tag of tags) {
    const hit = DATABASE_KEYWORDS[tag.toLowerCase()];
    if (hit) return hit;
  }
  return undefined;
}

/** The scaffold command for a template, optionally a dry run. */
export function scaffoldCommand(template: TemplateFeed, dryRun: boolean): string[] {
  return createReShellCommand(['create', template.id], {
    template: template.id,
    dryRun,
  });
}

/**
 * Adapt the narrow CLI feed shape to the rich contracts `TemplateSummary` that
 * `TemplateCatalogCard` consumes, deriving `domain`, `database`, `tier`, and the
 * scaffold `command` that the feed omits.
 */
export function feedToTemplateSummary(template: TemplateFeed): TemplateSummary {
  return {
    id: template.id,
    name: template.displayName ?? template.name,
    description: template.description,
    domain: deriveDomain(template.tags),
    language: template.language,
    framework: template.framework,
    tier: TIER_1_IDS.has(template.id) ? 1 : undefined,
    tags: template.tags,
    database: deriveDatabase(template.tags),
    command: scaffoldCommand(template, false),
  };
}

/** Unique, sorted values of a derived facet across the template feed. */
export function facetValues(
  templates: readonly TemplateFeed[],
  pick: (summary: TemplateSummary) => string | undefined
): string[] {
  const set = new Set<string>();
  for (const t of templates) {
    const value = pick(feedToTemplateSummary(t));
    if (value) set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
