// `re-shell catalog sync` — PURE Backstage serializer.
//
// Renders the native catalog entity model (from catalog-engine.ts) to Backstage
// `catalog-info.yaml` text. One YAML document per entity. Pure: takes entities
// in, returns strings out — no I/O, no mutation.
//
// js-yaml is a value import (already a dependency). The serializer orders keys
// deterministically (apiVersion, kind, metadata, spec) so re-running sync after
// a graph change produces a clean, reviewable diff.

import * as yaml from 'js-yaml';
import type { CatalogEntityLite } from './catalog-engine';

/**
 * Compute the repo-relative path where a given entity's catalog-info.yaml
 * descriptor should be written. Group entities are placed under an `owners`
 * directory while Component, API, and Resource entities are placed under a
 * kind-specific pluralized directory (e.g. `components`, `apis`, `resources`).
 *
 * @param entity - The lightweight catalog entity to compute a path for.
 * @param baseDir - Root directory the kind directories sit beneath. Defaults to `.`.
 * @returns The repo-relative YAML file path for the entity's descriptor.
 */
export function catalogFilePath(entity: CatalogEntityLite, baseDir = '.'): string {
  // Group entities under owners/; Component/API/Resource under their kind dir.
  const dir =
    entity.kind === 'Group'
      ? `${baseDir}/owners`
      : `${baseDir}/${entity.kind.toLowerCase()}s`;
  return `${dir}/${entity.metadata.name}.yaml`;
}

/** Deterministically order an entity's keys for a clean, reviewable diff. */
function orderEntity(entity: CatalogEntityLite): Record<string, unknown> {
  const ordered: Record<string, unknown> = {
    apiVersion: entity.apiVersion,
    kind: entity.kind,
  };
  // metadata: drop undefined optional fields so they don't serialize as null.
  const md: Record<string, unknown> = { name: entity.metadata.name };
  if (entity.metadata.title !== undefined) md['title'] = entity.metadata.title;
  if (entity.metadata.description !== undefined) md['description'] = entity.metadata.description;
  if (entity.metadata.tags !== undefined && entity.metadata.tags.length > 0)
    md['tags'] = [...entity.metadata.tags];
  if (entity.metadata.labels !== undefined && Object.keys(entity.metadata.labels).length > 0)
    md['labels'] = { ...entity.metadata.labels };
  if (entity.metadata.annotations !== undefined && Object.keys(entity.metadata.annotations).length > 0)
    md['annotations'] = { ...entity.metadata.annotations };
  ordered['metadata'] = md;
  ordered['spec'] = { ...entity.spec };
  return ordered;
}

/**
 * Serialize a single entity to a `catalog-info.yaml` document string. The
 * output is a complete, standalone Backstage descriptor file with
 * deterministically ordered keys (apiVersion, kind, metadata, spec) so that
 * re-running sync after a graph change produces a clean, reviewable diff.
 *
 * @param entity - The lightweight catalog entity to serialize.
 * @returns A YAML string representing a single Backstage entity descriptor.
 */
export function serializeEntity(entity: CatalogEntityLite): string {
  return yaml.dump(orderEntity(entity), {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: "'",
  });
}

/**
 * Serialize a list of entities into a single multi-document YAML stream whose
 * documents are separated by `---`. Used when emitting all entities into one
 * combined descriptor file rather than one file per entity.
 *
 * @param entities - The readonly list of catalog entities to serialize.
 * @returns A multi-document YAML string with each entity separated by `---`.
 */
export function serializeEntities(entities: readonly CatalogEntityLite[]): string {
  return entities.map(serializeEntity).join('\n---\n');
}

/**
 * Minimal validator for the Backstage descriptor shape. Every entity requires
 * an `apiVersion`, `kind`, and a valid `metadata.name`. Component and API
 * entities additionally require `spec.type` and `spec.owner`, and API entities
 * require a defined `spec.definition`. Returns the list of violations so the
 * calling command can warn the user before writing malformed descriptor files.
 *
 * @param entity - The lightweight catalog entity to validate.
 * @returns An array of human-readable violation strings; empty when the entity is valid.
 */
export function validateBackstageEntity(entity: CatalogEntityLite): string[] {
  const violations: string[] = [];
  if (!entity.apiVersion) violations.push('missing apiVersion');
  if (!entity.kind) violations.push('missing kind');
  if (!entity.metadata?.name) violations.push('missing metadata.name');
  else if (!/^[a-z0-9A-Z][a-z0-9A-Z._-]*$/.test(entity.metadata.name))
    violations.push(`metadata.name "${entity.metadata.name}" is not a valid entity name`);
  // Component/API require type/lifecycle/owner in spec.
  if (entity.kind === 'Component' || entity.kind === 'API') {
    if (!entity.spec?.type) violations.push(`${entity.kind} missing spec.type`);
    if (!entity.spec?.owner) violations.push(`${entity.kind} missing spec.owner`);
  }
  if (entity.kind === 'API' && entity.spec?.definition === undefined)
    violations.push('API missing spec.definition');
  return violations;
}
