import type {
  FindResult,
  TemplateRecommendation,
} from '@re-shell/contracts';
import {
  listBackendTemplates,
  toTemplateSummary,
  type TemplateSummary,
} from '../templates/backend';
import { FIELD_WEIGHTS, rankDocs, type IndexDoc } from './find-index';

/**
 * Offline, deterministic template recommender for
 * `re-shell templates recommend "<query>"`.
 *
 * This is a focused flavour of `find`, scoped to the TEMPLATE corpus:
 *
 *  - It REUSES the pure ranker (`rankDocs`) and the same field weights `find`
 *    uses — ranking is never reimplemented here.
 *  - It builds a TEMPLATE-only {@link IndexDoc} set (no command docs) and asks
 *    the ranker for `type: 'template'` so only templates can ever surface.
 *  - For each ranked hit it attaches a deterministic, OFFLINE `rationale` string
 *    derived purely from the matched query terms + the template's
 *    language/framework/category. No network, no LLM on the default path.
 *
 * An optional reranker-style phrasing hook may rewrite the rationale text when a
 * provider is explicitly supplied (see {@link RationalePhraser}); it is OFF by
 * default and never constructed on the offline path.
 */

// ---------------------------------------------------------------------------
// Template corpus (template-only)
// ---------------------------------------------------------------------------

/**
 * Adapt a template summary into a weighted index doc — identical weighting to
 * the `find` template adapter so recommend and find rank templates the same way.
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
 * Build the TEMPLATE-only corpus from the live backend registry. Pure relative
 * to its inputs — snapshots the static registry and performs no I/O.
 *
 * @returns An array of {@link IndexDoc} entries, one per backend template,
 * each tagged with `type: 'template'` and weighted identically to the `find`
 * template adapter.
 */
export function buildTemplateCorpus(): IndexDoc[] {
  return listBackendTemplates().map(toTemplateSummary).map(templateToDoc);
}

// ---------------------------------------------------------------------------
// Rationale (deterministic, offline)
// ---------------------------------------------------------------------------

/**
 * Pick a single, stable "category" label for a template. The backend registry
 * has no first-class category, so we use the first curated tag as the closest
 * proxy. Deterministic: tags are authored in a fixed order per template.
 */
function categoryOf(t: Pick<TemplateSummary, 'tags'>): string | undefined {
  return t.tags && t.tags.length > 0 ? t.tags[0] : undefined;
}

/**
 * Build a deterministic, offline rationale sentence for one recommendation.
 *
 * Shape (parts joined by " · " after a leading "Matches" clause):
 *   `Matches "async, api"; python/FastAPI · backend`
 *
 * - The matched-terms clause is omitted when nothing matched (defensive; the
 *   ranker never emits zero-match hits, but the formatter stays total).
 * - The language/framework clause renders whichever of the two are present.
 * - The category clause is appended only when a proxy category exists.
 *
 * @param matched - Read-only list of query terms that matched the template.
 *                  When empty, the "Matches ..." clause is omitted.
 * @param meta    - Template metadata subset (`language`, `framework`, `tags`)
 *                  used to phrase the stack and category clauses.
 * @returns The deterministic rationale string. Returns `"Suggested template"`
 *          when no clause can be derived from the inputs.
 */
export function buildRationale(
  matched: readonly string[],
  meta: Pick<TemplateSummary, 'language' | 'framework' | 'tags'>
): string {
  const parts: string[] = [];

  if (matched.length > 0) {
    parts.push(`Matches "${matched.join(', ')}"`);
  }

  const stack = [meta.language, meta.framework].filter(Boolean).join('/');
  if (stack) {
    parts.push(stack);
  }

  const category = categoryOf(meta);
  if (category) {
    parts.push(category);
  }

  if (parts.length === 0) {
    return 'Suggested template';
  }

  // First clause is the "Matches ..." sentence; the rest are middot-joined
  // metadata so the string reads "Matches "x"; lang/fw · category".
  const [head, ...tail] = parts;
  return tail.length > 0 ? `${head}; ${tail.join(' · ')}` : head;
}

// ---------------------------------------------------------------------------
// Optional LLM phrasing hook (OFF by default; no network on the default path)
// ---------------------------------------------------------------------------

/**
 * Pluggable contract for an optional rationale phraser, mirroring the
 * EmbeddingReranker pattern in find-index.ts.
 *
 * Guarantees the caller relies on:
 *  - It receives ALREADY-BUILT, deterministic recommendations and may only
 *    rewrite the `rationale` text — it must return the SAME ids/scores/order.
 *  - The DEFAULT recommend path never constructs or calls a phraser, so the
 *    offline guarantee holds regardless of this interface's existence.
 */
export interface RationalePhraser {
  /** Human-readable name of the phraser implementation (used for diagnostics). */
  readonly name: string;
  /**
   * Rewrite the rationale text for each recommendation. May be async.
   *
   * Implementations MUST preserve the ids, scores, and ordering of the input
   * recommendations; only the `rationale` text is consumed by the caller via
   * {@link applyPhraser}.
   *
   * @param query           - The original user query string.
   * @param recommendations - Read-only list of already-built deterministic
   *                          recommendations whose rationale text should be
   *                          rephrased.
   * @returns A promise resolving to a new array of recommendations with
   *          potentially updated `rationale` strings.
   */
  phrase(
    query: string,
    recommendations: readonly TemplateRecommendation[]
  ): Promise<TemplateRecommendation[]>;
}

/**
 * Apply a phraser defensively: the returned list is realigned to the original
 * id order and only the `rationale` field is taken from the phraser's output, so
 * a misbehaving adapter can never reorder, drop, or re-score vetted results.
 *
 * @param phraser         - The {@link RationalePhraser} used to rewrite
 *                          rationale text.
 * @param query           - The original user query string, forwarded to the
 *                          phraser.
 * @param recommendations - Read-only list of vetted recommendations to phrase.
 * @returns A promise resolving to a new recommendation list in the SAME order
 *          and with the SAME ids/scores as the input, but with `rationale`
 *          text replaced where the phraser returned a non-empty string.
 */
export async function applyPhraser(
  phraser: RationalePhraser,
  query: string,
  recommendations: readonly TemplateRecommendation[]
): Promise<TemplateRecommendation[]> {
  const phrased = await phraser.phrase(query, recommendations);
  const byId = new Map(phrased.map(r => [r.id, r.rationale]));
  return recommendations.map(rec => {
    const text = byId.get(rec.id);
    return typeof text === 'string' && text.length > 0
      ? { ...rec, rationale: text }
      : rec;
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Options bag for {@link recommendTemplates}.
 */
export interface RecommendOptions {
  /**
   * Max recommendations to return.
   */
  limit: number;
}

/**
 * Rank the template registry against `query` and return recommendations with a
 * deterministic, offline rationale each. Pure — no side effects, no I/O.
 *
 * Reuses `rankDocs` (no reimplemented ranking) over the template-only corpus and
 * joins each ranked hit back to its registry metadata to phrase the rationale.
 *
 * @param query   - The free-text search query entered by the user.
 * @param options - Configuration for the recommendation pass; most notably
 *                  `options.limit` caps the number of returned items.
 * @returns An array of {@link TemplateRecommendation} entries, best match first,
 *          each carrying a deterministic `rationale` string and optional
 *          metadata (`language`, `framework`, `category`) when present on the
 *          source template.
 */
export function recommendTemplates(
  query: string,
  options: RecommendOptions
): TemplateRecommendation[] {
  const summaries = listBackendTemplates().map(toTemplateSummary);
  const metaById = new Map<string, TemplateSummary>(
    summaries.map(s => [s.id, s])
  );

  const docs = summaries.map(templateToDoc);
  const ranked: FindResult[] = rankDocs(query, docs, {
    limit: options.limit,
    type: 'template',
  });

  return ranked.map(hit => toRecommendation(hit, metaById.get(hit.id)));
}

/**
 * Project one ranked {@link FindResult} into a {@link TemplateRecommendation},
 * attaching the deterministic rationale and the metadata it was built from.
 * Optional metadata fields are omitted (not set to undefined) so the JSON shape
 * stays minimal and matches the zod schema's optional semantics.
 */
function toRecommendation(
  hit: FindResult,
  meta: TemplateSummary | undefined
): TemplateRecommendation {
  const language = meta?.language;
  const framework = meta?.framework;
  const category = meta ? categoryOf(meta) : undefined;

  return {
    id: hit.id,
    title: hit.title,
    score: hit.score,
    matched: hit.matched,
    rationale: buildRationale(hit.matched, {
      language: meta?.language,
      framework: meta?.framework,
      tags: meta?.tags,
    }),
    ...(language ? { language } : {}),
    ...(framework ? { framework } : {}),
    ...(category ? { category } : {}),
  };
}
