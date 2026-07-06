// `re-shell catalog` — PURE software-catalog model builder.
//
// Maps the real workspace graph (services, microfrontends, packages, APIs) onto
// a typed catalog entity model that mirrors the Backstage descriptor format.
// This module is intentionally I/O-free and contracts-free: it only transforms
// in-memory inputs into catalog entities. The command layer (commands/catalog.ts)
// handles discovery on disk; the Backstage serializer (catalog-backstage.ts)
// renders the native model to catalog-info.yaml.
//
// No mutation of any input is ever performed — every builder returns fresh data.

/**
 * Minimal service input the engine needs (projected from ServiceConfig).
 *
 * Represents a single backend/frontend/worker/function service discovered in
 * the workspace. The command layer is responsible for projecting the richer
 * `ServiceConfig` shape onto this minimal contract before handing it to the
 * pure engine; no field on this interface is ever mutated by the engine.
 */
export interface CatalogServiceInput {
  readonly name: string;
  readonly path?: string;
  readonly description?: string;
  readonly type?: string;
  readonly language?: string;
  readonly framework?: string | { readonly name: string };
  readonly port?: number;
  readonly dependsOn?: readonly string[];
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly healthCheck?: unknown;
}

/**
 * A discovered microfrontend input.
 *
 * Describes a single microfrontend entry discovered in the workspace. The
 * engine maps each microfrontend onto a Backstage Component of type `website`
 * scoped to the workspace System.
 */
export interface CatalogMicrofrontendInput {
  readonly name: string;
  readonly path?: string;
  readonly version?: string;
  readonly team?: string;
  readonly route?: string;
  readonly dependsOn?: readonly string[];
}

/**
 * The complete input surface the command feeds the pure engine.
 *
 * Aggregates every input the catalog builder needs: the workspace system
 * name, all discovered services, all discovered microfrontends, and optional
 * workspace-wide defaults (internal package names for library tagging and a
 * fallback owner). The command layer populates this; the engine never reads
 * from disk itself.
 */
export interface CatalogInputs {
  readonly systemName: string;
  readonly services: readonly CatalogServiceInput[];
  readonly microfrontends: readonly CatalogMicrofrontendInput[];
  /** Names of internal packages discovered in the workspace (for library tags). */
  readonly packages?: readonly string[];
  /** Default owner when a service declares none. */
  readonly defaultOwner?: string;
}

/**
 * The Backstage apiVersion the emitted kinds target.
 *
 * Every catalog entity produced by this engine is stamped with this value so
 * the resulting `catalog-info.yaml` is consumable by Backstage's descriptor
 * parser.
 */
export const CATALOG_API_VERSION = 'backstage.io/v1alpha1';

/**
 * The default owner applied when a service declares none.
 *
 * Used as the fallback `spec.owner` for any Component, API, or System entity
 * whose source input does not carry an explicit owner. Registering this owner
 * guarantees the System entity always has a resolvable Group.
 */
export const DEFAULT_CATALOG_OWNER = 'team-platform';

/**
 * The default lifecycle applied when a service declares none.
 *
 * Backstage expects `spec.lifecycle` to be one of `experimental`, `production`,
 * or `deprecated`. This value is used whenever an input does not specify one.
 */
export const DEFAULT_CATALOG_LIFECYCLE = 'production';

/**
 * A native catalog entity (mirrors the contracts CatalogEntity shape).
 *
 * Lightweight representation of a single Backstage catalog entity used by the
 * pure engine and the serializer. The `kind` union restricts the entity kinds
 * this module is capable of emitting; `spec` is intentionally left open as a
 * string-keyed record so each builder can populate kind-specific fields.
 */
export interface CatalogEntityLite {
  readonly apiVersion: string;
  readonly kind: 'Component' | 'API' | 'Resource' | 'Group' | 'System' | 'Domain';
  readonly metadata: {
    readonly name: string;
    readonly title?: string;
    readonly description?: string;
    readonly tags?: readonly string[];
    readonly labels?: Readonly<Record<string, string>>;
    readonly annotations?: Readonly<Record<string, string>>;
  };
  readonly spec: Readonly<Record<string, unknown>>;
}

/**
 * The pure build output: entities + counts + warnings.
 *
 * Returned by {@link buildCatalogModel}. Contains the full ordered list of
 * catalog entities, per-kind counts for quick reporting, and a list of
 * non-fatal warnings (empty slugs, owner collisions, empty workspaces) the
 * command layer may surface to the user.
 */
export interface CatalogModel {
  readonly system: string;
  readonly entities: readonly CatalogEntityLite[];
  readonly counts: {
    readonly components: number;
    readonly apis: number;
    readonly resources: number;
    readonly groups: number;
    readonly systems: number;
  };
  readonly warnings: readonly string[];
}

/**
 * Lowercase and sanitize a raw name into a valid Backstage entity name.
 *
 * Lowercases the input, replaces runs of characters outside the allowed set
 * (anything other than `a-z0-9._-`) with a single dash, trims leading and
 * trailing non-alphanumerics so the result always starts and ends with an
 * alphanumeric character, and truncates to 63 characters. The output
 * satisfies the Backstage entity-name regex `^[a-z0-9A-Z][a-z0-9A-Z._-]*$`.
 *
 * @param name - The raw name to slugify (e.g. a service name or owner string).
 * @returns A sanitized entity-name slug of at most 63 characters. May be the
 *   empty string when the input contains no alphanumeric characters; callers
 *   are expected to skip or warn on such results.
 */
export function slugifyEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    // Trim leading/trailing non-alphanumerics (dashes, dots, underscores) so the
    // result always starts and ends with [a-z0-9], satisfying the Backstage
    // entity-name regex ^[a-z0-9A-Z][a-z0-9A-Z._-]*$.
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .slice(0, 63);
}

/** Map a re-shell service type onto a Backstage Component spec.type. */
function componentTypeFor(serviceType?: string, isMicrofrontend = false): string {
  if (isMicrofrontend) return 'website';
  switch (serviceType) {
    case 'frontend':
      return 'website';
    case 'backend':
    case 'worker':
    case 'function':
      return 'service';
    default:
      return 'service';
  }
}

/** Read a framework name from either a string or a FrameworkConfig object. */
function frameworkName(framework?: string | { readonly name: string }): string | undefined {
  if (!framework) return undefined;
  return typeof framework === 'string' ? framework : framework.name;
}

/**
 * Collect every distinct owner across the inputs, returning one Group entity
 * per owner so Backstage ownership relations resolve. Owners are taken from
 * service/microfrontend metadata; missing owners fall back to the default.
 *
 * Keyed on the SLUG (not the raw string) so two owners that slugify identically
 * (e.g. "Team Payments" and "team-payments") collapse to a single Group instead
 * of emitting a duplicate entity that Backstage would reject.
 */
function buildGroupEntities(
  owners: ReadonlyMap<string, string>
): readonly CatalogEntityLite[] {
  return [...owners.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, displayName]) => ({
      apiVersion: CATALOG_API_VERSION,
      kind: 'Group' as const,
      metadata: {
        name: slug,
        title: displayName,
        description: `Owners group auto-discovered by re-shell catalog`,
      },
      spec: {
        type: 'team',
        profile: { displayName },
        children: [],
        members: [],
      },
    }));
}

/**
 * Build the full catalog model from the input surface.
 *
 * Produces a Backstage-compatible catalog entity graph from the discovered
 * workspace inputs. The model contains:
 *   - one Component per workspace service (backend/worker/function map to
 *     `service`, frontend maps to `website`),
 *   - one Component per microfrontend (always `website`),
 *   - one API per service that exposes a port or health endpoint,
 *   - one Group per distinct owner (keyed on slug to avoid duplicates),
 *   - one System scoped to the workspace.
 *
 * Every `dependsOn` edge is mapped to a `component:default/<dep>` Backstage
 * ref, and every exposed API is wired via `providesApis` on its owning
 * Component. No input is mutated; every builder returns fresh data.
 *
 * Non-fatal issues (empty slugs, owner collisions, an empty workspace) are
 * recorded as warnings in the returned model rather than thrown.
 *
 * @param inputs - The complete input surface (system name, services,
 *   microfrontends, optional packages and default owner).
 * @returns A {@link CatalogModel} containing the ordered entity list, per-kind
 *   counts, and any warnings produced during the build.
 */
export function buildCatalogModel(inputs: CatalogInputs): CatalogModel {
  const warnings: string[] = [];
  const defaultOwner = inputs.defaultOwner ?? DEFAULT_CATALOG_OWNER;
  const systemSlug = slugifyEntityName(inputs.systemName) || 'workspace';
  // Map of owner SLUG → first-seen raw display name. Keyed on the slug so two
  // distinct owners that slugify identically collapse to one Group (with a
  // collision warning) rather than emitting a duplicate entity.
  const owners = new Map<string, string>();

  /** Register an owner, warning on a slug collision (silent merge otherwise). */
  const registerOwner = (raw: string): string => {
    const slug = slugifyEntityName(raw);
    if (!owners.has(slug)) {
      owners.set(slug, raw);
    } else if (owners.get(slug) !== raw) {
      warnings.push(
        `owner "${raw}" collides with "${owners.get(slug)}" (both slugify to "${slug}"); merged`
      );
    }
    return slug;
  };

  // The System entity always uses the default owner, so guarantee its Group
  // exists to avoid a dangling ownership relation.
  registerOwner(defaultOwner);

  const entities: CatalogEntityLite[] = [];

  // ── Components (services) ──────────────────────────────────────────────────
  const serviceApiRefs = new Map<string, string[]>(); // service name → api refs it provides

  for (const service of inputs.services) {
    const name = slugifyEntityName(service.name);
    if (!name) {
      warnings.push(`service "${service.name}" produced an empty slug; skipped`);
      continue;
    }
    const ownerRaw =
      service.metadata?.owner?.trim() || defaultOwner;
    const owner = registerOwner(ownerRaw);
    const lifecycle =
      service.metadata?.lifecycle?.trim() || DEFAULT_CATALOG_LIFECYCLE;
    const fw = frameworkName(service.framework);
    const tags = [
      ...(service.tags ?? []),
      ...(service.language ? [service.language] : []),
      ...(fw ? [fw] : []),
    ].filter(Boolean);

    const annotations: Record<string, string> = {
      're-shell.io/service': service.name,
    };
    if (service.path) annotations['re-shell.io/path'] = service.path;
    if (service.port !== undefined) annotations['re-shell.io/port'] = String(service.port);

    // Map dependsOn (sibling service names) → Backstage component refs.
    const dependsOn = (service.dependsOn ?? [])
      .map(dep => `component:default/${slugifyEntityName(dep)}`)
      .filter(ref => !ref.endsWith('component:default/'));

    // Expose an API entity when the service has a port or health endpoint.
    const exposesApi = service.port !== undefined || service.healthCheck !== undefined;
    const providedApis: string[] = [];
    if (exposesApi) {
      // Slugify the FULL "<name>-api" string so the 63-char cap applies to the
      // final name (not just the service part before the "-api" suffix).
      const apiName = slugifyEntityName(`${service.name}-api`);
      providedApis.push(`api:default/${apiName}`);
      serviceApiRefs.set(service.name, providedApis);
    }

    const spec: Record<string, unknown> = {
      type: componentTypeFor(service.type),
      lifecycle,
      // `owner` is already the slug from registerOwner.
      owner,
      system: systemSlug,
    };
    if (dependsOn.length > 0) spec['dependsOn'] = dependsOn;
    if (providedApis.length > 0) spec['providesApis'] = providedApis;

    entities.push({
      apiVersion: CATALOG_API_VERSION,
      kind: 'Component',
      metadata: {
        name,
        ...(service.description ? { description: service.description } : {}),
        ...(tags.length > 0 ? { tags: [...new Set(tags)] } : {}),
        annotations,
      },
      spec,
    });
  }

  // ── Components (microfrontends → website) ──────────────────────────────────
  for (const mf of inputs.microfrontends) {
    const name = slugifyEntityName(mf.name);
    if (!name) {
      warnings.push(`microfrontend "${mf.name}" produced an empty slug; skipped`);
      continue;
    }
    const owner = registerOwner(mf.team?.trim() || defaultOwner);
    const annotations: Record<string, string> = {
      're-shell.io/microfrontend': mf.name,
    };
    if (mf.route) annotations['re-shell.io/route'] = mf.route;
    if (mf.path) annotations['re-shell.io/path'] = mf.path;

    // Map dependsOn → Backstage refs; drop empty-slug deps (mirrors services).
    const dependsOn = (mf.dependsOn ?? [])
      .map(dep => `component:default/${slugifyEntityName(dep)}`)
      .filter(ref => !ref.endsWith('component:default/'));

    const spec: Record<string, unknown> = {
      type: componentTypeFor(undefined, true),
      lifecycle: DEFAULT_CATALOG_LIFECYCLE,
      // `owner` is already the slug from registerOwner.
      owner,
      system: systemSlug,
    };
    if (dependsOn.length > 0) spec['dependsOn'] = dependsOn;

    entities.push({
      apiVersion: CATALOG_API_VERSION,
      kind: 'Component',
      metadata: {
        name,
        description: `Microfrontend ${mf.name}`,
        tags: ['microfrontend', ...(mf.version ? [mf.version] : [])],
        annotations,
      },
      spec,
    });
  }

  // ── APIs (one per service that exposes a port/health endpoint) ─────────────
  for (const service of inputs.services) {
    const exposesApi = service.port !== undefined || service.healthCheck !== undefined;
    if (!exposesApi) continue;
    // Slugify the FULL "<name>-api" so the 63-char cap + name rules apply to the
    // final name (not just the service part before the "-api" suffix).
    const apiName = slugifyEntityName(`${service.name}-api`);
    const owner = registerOwner(service.metadata?.owner?.trim() || defaultOwner);
    const lifecycle =
      service.metadata?.lifecycle?.trim() || DEFAULT_CATALOG_LIFECYCLE;
    entities.push({
      apiVersion: CATALOG_API_VERSION,
      kind: 'API',
      metadata: {
        name: apiName,
        description: `API exposed by ${service.name}`,
        tags: [...(service.language ? [service.language] : []), 'api'],
      },
      spec: {
        type: 'openapi',
        lifecycle,
        // `owner` is already the slug from registerOwner.
        owner,
        system: systemSlug,
        // Definition is required by the Backstage spec; emit a placeholder the
        // team can replace. The sync writes it as a multi-line string.
        definition: `# Auto-generated placeholder for ${service.name}. Replace with your OpenAPI spec.`,
      },
    });
  }

  // ── Groups (one per distinct owner) ────────────────────────────────────────
  for (const group of buildGroupEntities(owners)) {
    entities.push(group);
  }

  // ── System (one per workspace) ─────────────────────────────────────────────
  entities.push({
    apiVersion: CATALOG_API_VERSION,
    kind: 'System',
    metadata: {
      name: systemSlug,
      title: inputs.systemName,
      description: `re-shell workspace ${inputs.systemName}`,
    },
    spec: {
      owner: slugifyEntityName(defaultOwner),
    },
  });

  const counts = {
    components: entities.filter(e => e.kind === 'Component').length,
    apis: entities.filter(e => e.kind === 'API').length,
    resources: entities.filter(e => e.kind === 'Resource').length,
    groups: entities.filter(e => e.kind === 'Group').length,
    systems: entities.filter(e => e.kind === 'System').length,
  };

  if (inputs.services.length === 0 && inputs.microfrontends.length === 0) {
    warnings.push('no services or microfrontends discovered; catalog contains only the System entity');
  }

  return { system: systemSlug, entities, counts, warnings };
}
