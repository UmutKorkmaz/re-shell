import type { Command } from 'commander';
import { buildCommandCatalog, type CommandCatalogEntry } from './command-catalog';
import {
  listBackendTemplates,
  toTemplateSummary,
  type TemplateSummary,
} from '../templates/backend/index';
import { FIELD_WEIGHTS, type IndexDoc } from './find-index';

/**
 * Corpus builders for `re-shell find`.
 *
 * These adapt the two live data sources — the command catalogue and the backend
 * template registry — into the weighted {@link IndexDoc} model the pure ranker
 * consumes. Kept separate from `find-index.ts` so the ranker stays free of any
 * knowledge of commander / the template registry and remains trivially testable.
 *
 * Everything here is offline: `buildCommandCatalog` walks the in-memory command
 * tree and `listBackendTemplates` returns static module data. No network, no FS.
 */

/**
 * Build an index doc from a single catalogue entry.
 *
 * Field weighting (highest → lowest): the command path (id) and a humanised
 * title carry identity; flag names are curated tag-like signals; the description
 * is a soft tie-breaker.
 */
function commandToDoc(entry: CommandCatalogEntry): IndexDoc {
  const flagNames = entry.flags.map(f => f.name.replace(/^--?/, '')).join(' ');
  const aliasText = entry.aliases.join(' ');

  return {
    type: 'command',
    id: entry.path,
    title: entry.path,
    usage: `re-shell ${entry.path}`,
    fields: [
      { text: entry.path, weight: FIELD_WEIGHTS.id },
      { text: aliasText, weight: FIELD_WEIGHTS.title },
      { text: flagNames, weight: FIELD_WEIGHTS.tags },
      { text: entry.description, weight: FIELD_WEIGHTS.description },
    ],
  };
}

/**
 * Build an index doc from a template summary. The id and display name carry
 * identity; language, framework, tags and features are curated tag signals; the
 * description is the soft field.
 */
function templateToDoc(t: TemplateSummary): IndexDoc {
  const title = t.displayName || t.name || t.id;
  const tagText = [
    t.language,
    t.framework,
    ...(t.tags ?? []),
    ...(t.features ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    type: 'template',
    id: t.id,
    title,
    usage: `re-shell create <name> --template ${t.id}`,
    fields: [
      { text: t.id, weight: FIELD_WEIGHTS.id },
      { text: title, weight: FIELD_WEIGHTS.title },
      { text: tagText, weight: FIELD_WEIGHTS.tags },
      { text: t.description, weight: FIELD_WEIGHTS.description },
    ],
  };
}

/**
 * Build the full searchable corpus (commands + templates) from a live program.
 * Pure relative to its inputs — snapshots the catalogue and registry at call
 * time and performs no I/O beyond reading those in-memory structures.
 */
export function buildFindCorpus(program: Command): IndexDoc[] {
  const commandDocs = buildCommandCatalog(program).map(commandToDoc);
  const templateDocs = listBackendTemplates().map(toTemplateSummary).map(templateToDoc);
  return [...commandDocs, ...templateDocs];
}
