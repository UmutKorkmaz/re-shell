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

/** Repo-relative path a given entity's catalog-info.yaml should be written to. */
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
 * Serialize a single entity to a catalog-info.yaml document string. The output
 * is a complete, standalone Backstage descriptor file.
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
 * Serialize a list of entities into a single multi-document YAML stream
 * (documents separated by `---`). Used when emitting one combined file.
 */
export function serializeEntities(entities: readonly CatalogEntityLite[]): string {
  return entities.map(serializeEntity).join('\n---\n');
}

/**
 * A minimal validator for the Backstage descriptor shape: every entity needs
 * apiVersion, kind, metadata.name. Returns the list of violations (empty when
 * valid) so the command can warn before writing malformed files.
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
