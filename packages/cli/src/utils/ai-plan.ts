import type {
  ScaffoldIntent,
  ScaffoldIntentSlot,
  ScaffoldPlan,
  ScaffoldPlanStep,
} from '@re-shell/contracts';
import {
  listBackendTemplates,
  toTemplateSummary,
  type TemplateSummary,
} from '../templates/backend/index';
import { SUPPORTED_FRAMEWORKS } from './framework';
import { FIELD_WEIGHTS, rankDocs, tokenize, type IndexDoc } from './find-index';

/**
 * Offline, deterministic scaffold PLANNER for
 * `re-shell ai create "<description>"`.
 *
 * This module turns a free-text project description (e.g. "a react shell +
 * fastapi auth service + postgres, on k8s") into a structured {@link ScaffoldIntent}
 * and then a reviewable, dry-run {@link ScaffoldPlan} of REAL re-shell commands.
 *
 * It is intentionally:
 *  - OFFLINE: no network, no LLM on the default path. The description is parsed
 *    against the static template registry vocabulary + a small curated synonym
 *    map. No I/O beyond reading in-memory registries.
 *  - DETERMINISTIC: the same description always yields the same intent + plan.
 *    No randomness, time, or environment dependence.
 *  - REUSING THE RANKER: every component is resolved to a REAL template id via
 *    `rankDocs` (the same pure ranker `find`/`recommend` use) — ranking is never
 *    reimplemented here. Unresolvable mentions are dropped, never fabricated.
 *  - SAFE-BY-CONSTRUCTION: the plan's argv tokens come ONLY from real command
 *    paths/flags, resolved registry ids, and a sanitised project-name slot. Raw
 *    description text is never spliced into a command.
 *
 * The plan composes only commands/flags that actually exist:
 *  - `create <name> --template <frontend>`     (the shell app)
 *  - `generate backend <name> --framework <id>` (each backend service)
 *  - `generate backend <name> --framework <id>` (each datastore config template)
 *  - `k8s generate` / `k8s helm <name>`        (infra)
 */

// ---------------------------------------------------------------------------
// Tuning constants (named — no magic numbers)
// ---------------------------------------------------------------------------

/** Minimum ranker score for a resolved slot to be trusted. */
const MIN_SLOT_SCORE = 0.2;

/** How many ranked hits to consider per resolution before picking the best. */
const RESOLVE_LIMIT = 5;

/** Fallback project name when the description yields no safe slug. */
const DEFAULT_PROJECT_NAME = 'app';

/** Safe identifier charset for any value spliced into argv (e.g. project name). */
const SAFE_VALUE = /^[a-z0-9][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Vocabulary: phrase -> ranker query, per slot kind.
//
// Keys are lower-case phrases that may appear in a description; values are the
// query string handed to the ranker to resolve a REAL template id. Curated and
// offline. A phrase only ever resolves to whatever the ranker returns from the
// real registry — these maps just steer the query, they cannot invent an id.
// ---------------------------------------------------------------------------

/** Frontend framework phrases -> ranker query against the frontend corpus. */
const FRONTEND_VOCAB: Readonly<Record<string, string>> = {
  react: 'react',
  'react-ts': 'react typescript',
  vue: 'vue',
  svelte: 'svelte',
  angular: 'angular',
  next: 'next',
  nextjs: 'next',
  remix: 'remix',
  nuxt: 'nuxt',
  gatsby: 'gatsby',
  astro: 'astro',
  solid: 'solid-js',
  qwik: 'qwik',
  preact: 'preact',
  lit: 'lit',
  sveltekit: 'sveltekit',
};

/** Backend service phrases -> ranker query against the backend corpus. */
const BACKEND_VOCAB: Readonly<Record<string, string>> = {
  fastapi: 'fastapi',
  flask: 'flask',
  django: 'django',
  express: 'express',
  fastify: 'fastify',
  nestjs: 'nestjs',
  nest: 'nestjs',
  koa: 'koa',
  hapi: 'hapi typescript',
  gin: 'gin',
  echo: 'echo go',
  fiber: 'fiber go',
  chi: 'chi go',
  grpc: 'grpc service',
  axum: 'axum rust',
  actix: 'actix web rust',
  rocket: 'rocket rust',
  warp: 'warp rust',
  ktor: 'ktor kotlin',
  spring: 'spring boot',
  quarkus: 'quarkus',
  micronaut: 'micronaut',
  laravel: 'laravel php',
  symfony: 'symfony php',
  rails: 'rails api ruby',
  sinatra: 'sinatra ruby',
  phoenix: 'phoenix elixir',
  hono: 'hono bun',
  apollo: 'apollo server graphql',
  graphql: 'graphql server',
  auth: 'comprehensive auth service',
};

/** Datastore phrases -> ranker query against the backend corpus (config templates). */
const DATASTORE_VOCAB: Readonly<Record<string, string>> = {
  postgres: 'postgres config',
  postgresql: 'postgres config',
  mysql: 'mysql config',
  mariadb: 'mysql config',
  mongo: 'mongodb config',
  mongodb: 'mongodb config',
  redis: 'redis integration',
  couchdb: 'couchdb config',
  influxdb: 'influxdb config',
  influx: 'influxdb config',
  neo4j: 'neo4j config',
  elasticsearch: 'elasticsearch config',
  elastic: 'elasticsearch config',
};

/**
 * Infra phrases -> a real command spec (NOT a template). `k8s`/`kubernetes`
 * compose `k8s generate`; `helm` composes `k8s helm <name>`; `gitops` composes
 * `k8s gitops <name>`. Each value is the argv prefix the step will run.
 */
interface InfraSpec {
  /** Stable id surfaced as the slot id (no template behind it). */
  id: string;
  /** argv (after `re-shell`) the step runs; project name appended when needed. */
  baseArgv: readonly string[];
  /** Whether the project name is appended as a positional argument. */
  needsName: boolean;
  description: string;
}

const INFRA_VOCAB: Readonly<Record<string, InfraSpec>> = {
  k8s: {
    id: 'k8s',
    baseArgv: ['k8s', 'generate'],
    needsName: false,
    description: 'Generate Kubernetes manifests from the workspace config',
  },
  kubernetes: {
    id: 'k8s',
    baseArgv: ['k8s', 'generate'],
    needsName: false,
    description: 'Generate Kubernetes manifests from the workspace config',
  },
  helm: {
    id: 'helm',
    baseArgv: ['k8s', 'helm'],
    needsName: true,
    description: 'Generate a Helm chart for the project',
  },
  gitops: {
    id: 'gitops',
    baseArgv: ['k8s', 'gitops'],
    needsName: true,
    description: 'Generate GitOps (Argo CD / Flux) manifests for the project',
  },
};

// ---------------------------------------------------------------------------
// Corpora (template-only index docs, adapted for the shared ranker)
// ---------------------------------------------------------------------------

/** Adapt a backend template summary into a weighted ranker doc. */
function backendToDoc(t: TemplateSummary): IndexDoc {
  const title = t.displayName || t.name || t.id;
  const tagText = [t.language, t.framework, ...(t.tags ?? []), ...(t.features ?? [])]
    .filter(Boolean)
    .join(' ');
  return {
    type: 'template',
    id: t.id,
    title,
    fields: [
      { text: t.id, weight: FIELD_WEIGHTS.id },
      { text: title, weight: FIELD_WEIGHTS.title },
      { text: tagText, weight: FIELD_WEIGHTS.tags },
      { text: t.description, weight: FIELD_WEIGHTS.description },
    ],
  };
}

/** Adapt a frontend framework config into a weighted ranker doc. */
function frontendToDoc(name: string, displayName: string): IndexDoc {
  return {
    type: 'template',
    id: name,
    title: displayName,
    fields: [
      { text: name, weight: FIELD_WEIGHTS.id },
      { text: displayName, weight: FIELD_WEIGHTS.title },
      { text: 'frontend ui shell app', weight: FIELD_WEIGHTS.description },
    ],
  };
}

/**
 * Build the backend/datastore corpus from the live registry (offline).
 *
 * Enumerates every registered backend template, converts each into a
 * `TemplateSummary`, and adapts it to a weighted `IndexDoc` suitable for the
 * shared ranker. The resulting corpus is used to resolve backend service and
 * datastore phrases to real template ids.
 *
 * @returns An array of `IndexDoc` entries, one per backend template.
 */
export function buildBackendCorpus(): IndexDoc[] {
  return listBackendTemplates().map(toTemplateSummary).map(backendToDoc);
}

/**
 * Build the frontend corpus from the supported framework registry (offline).
 *
 * Enumerates every entry in `SUPPORTED_FRAMEWORKS` and adapts each into a
 * weighted `IndexDoc` suitable for the shared ranker. The resulting corpus is
 * used to resolve frontend framework phrases to a real framework id.
 *
 * @returns An array of `IndexDoc` entries, one per supported frontend framework.
 */
export function buildFrontendCorpus(): IndexDoc[] {
  return Object.values(SUPPORTED_FRAMEWORKS).map(f =>
    frontendToDoc(f.name, f.displayName)
  );
}

// ---------------------------------------------------------------------------
// Resolution (reuse the ranker; never reimplement ranking)
// ---------------------------------------------------------------------------

/**
 * Resolve a steering query to a REAL template id via the shared ranker. Returns
 * the best hit at or above {@link MIN_SLOT_SCORE}, or undefined when nothing in
 * the corpus clears the bar — so an unknown phrase yields no slot rather than a
 * fabricated id.
 */
function resolveSlot(
  query: string,
  corpus: readonly IndexDoc[]
): { id: string; title: string; score: number; matched: string[] } | undefined {
  const ranked = rankDocs(query, corpus, { limit: RESOLVE_LIMIT, type: 'template' });
  const top = ranked[0];
  if (!top || top.score < MIN_SLOT_SCORE) return undefined;
  return { id: top.id, title: top.title, score: top.score, matched: top.matched };
}

// ---------------------------------------------------------------------------
// Project name slug
// ---------------------------------------------------------------------------

/**
 * Derive a safe project-name slug from the description.
 *
 * Takes the first few meaningful tokens (after filtering out common stop words
 * like "a", "the", "app", "create"), joins them with dashes, and constrains the
 * result to {@link SAFE_VALUE}. Any stray non-slug characters are stripped
 * defensively; if nothing safe remains the {@link DEFAULT_PROJECT_NAME} is
 * returned. This is the ONLY place a description-derived value enters argv, and
 * it is always sanitised.
 *
 * @param description - The free-text project description provided by the user.
 * @returns A lowercase slug matching `SAFE_VALUE`, or `'app'` as a fallback.
 */
export function deriveProjectName(description: string): string {
  const skip = new Set([
    'a', 'an', 'the', 'with', 'and', 'on', 'for', 'of', 'to', 'in',
    'app', 'application', 'project', 'build', 'create', 'make', 'new',
  ]);
  const tokens = tokenize(description).filter(t => !skip.has(t));
  const slug = tokens.slice(0, 3).join('-');
  if (SAFE_VALUE.test(slug)) return slug;
  // Strip any stray non-slug chars defensively, then re-check.
  const cleaned = slug.replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  return SAFE_VALUE.test(cleaned) ? cleaned : DEFAULT_PROJECT_NAME;
}

// ---------------------------------------------------------------------------
// Intent extraction (offline, deterministic)
// ---------------------------------------------------------------------------

/** Find which vocabulary keys are present in the description token set. */
function presentKeys(
  tokenSet: ReadonlySet<string>,
  vocab: Readonly<Record<string, unknown>>
): string[] {
  return Object.keys(vocab).filter(key => tokenSet.has(key));
}

/**
 * Extract the structured {@link ScaffoldIntent} from a description.
 *
 * Pure and offline: the description is tokenised and matched against the
 * curated frontend/backend/datastore/infra vocabularies. Each detected phrase is
 * resolved to a REAL id via the shared ranker; unresolved phrases are silently
 * dropped and never invented. Datastores are resolved before backends so a
 * phrase like "postgres" cannot double-count as a generic backend service, and
 * backend hits are de-duped by resolved id. Frontend resolution stops at the
 * first matched phrase (in description order) so the shell framework choice is
 * deterministic.
 *
 * @param description - The free-text project description provided by the user.
 * @returns A `ScaffoldIntent` describing the detected slots and derived project
 *   name. Slots may be empty arrays when nothing in the description resolves.
 */
export function extractIntent(description: string): ScaffoldIntent {
  const tokens = tokenize(description);
  const tokenSet = new Set(tokens);
  const projectName = deriveProjectName(description);

  const frontendCorpus = buildFrontendCorpus();
  const backendCorpus = buildBackendCorpus();

  // Frontend: at most one (the shell app's framework). Prefer the first phrase
  // in description order so the choice is deterministic and intuitive.
  let frontend: ScaffoldIntentSlot | undefined;
  for (const token of tokens) {
    const query = FRONTEND_VOCAB[token];
    if (!query) continue;
    const hit = resolveSlot(query, frontendCorpus);
    if (hit) {
      frontend = { kind: 'frontend', term: token, ...hit };
      break;
    }
  }

  // Datastores resolve against the backend corpus (config templates) first so a
  // "postgres" phrase never also surfaces as a generic backend service.
  const datastores: ScaffoldIntentSlot[] = [];
  for (const key of presentKeys(tokenSet, DATASTORE_VOCAB)) {
    const hit = resolveSlot(DATASTORE_VOCAB[key], backendCorpus);
    if (hit) datastores.push({ kind: 'datastore', term: key, ...hit });
  }

  // Backends: each detected service phrase resolved against the backend corpus,
  // de-duped by resolved id and excluding anything already claimed as a datastore.
  const claimedIds = new Set(datastores.map(d => d.id));
  const backends: ScaffoldIntentSlot[] = [];
  for (const key of presentKeys(tokenSet, BACKEND_VOCAB)) {
    const hit = resolveSlot(BACKEND_VOCAB[key], backendCorpus);
    if (!hit) continue;
    if (claimedIds.has(hit.id)) continue;
    claimedIds.add(hit.id);
    backends.push({ kind: 'backend', term: key, ...hit });
  }

  // Infra: command-backed slots (no template). De-duped by infra id.
  const infra: ScaffoldIntentSlot[] = [];
  const seenInfra = new Set<string>();
  for (const key of presentKeys(tokenSet, INFRA_VOCAB)) {
    const spec = INFRA_VOCAB[key];
    if (seenInfra.has(spec.id)) continue;
    seenInfra.add(spec.id);
    infra.push({
      kind: 'infra',
      term: key,
      id: spec.id,
      title: spec.description,
      score: 1,
      matched: [key],
    });
  }

  return {
    description: description.trim(),
    projectName,
    ...(frontend ? { frontend } : {}),
    backends,
    datastores,
    infra,
  };
}

// ---------------------------------------------------------------------------
// Plan composition (real commands/flags only)
// ---------------------------------------------------------------------------

/**
 * Compose a dry-run {@link ScaffoldPlan} from an extracted intent.
 *
 * The argv of every step is built only from real command paths/flags, the
 * resolved template/framework id, and the sanitised project name. Steps are
 * produced in a fixed, reviewable order: the shell app via
 * `create <name> --template <frontend>`, each backend service via
 * `generate backend <name> --framework <id>`, each datastore integration via
 * `generate backend <name> --framework <id>`, and finally each infra slot via
 * `k8s generate` / `k8s helm <name>` / `k8s gitops <name>`. `applied` is always
 * `false` on the produced steps; execution is a separate, explicit step (`--yes`).
 *
 * @param intent - The extracted `ScaffoldIntent` to translate into commands.
 * @returns A `ScaffoldPlan` whose `resolved` list contains every real id used
 *   and whose `steps` are the reviewable, unapplied command descriptions.
 */
export function composePlan(intent: ScaffoldIntent): ScaffoldPlan {
  const steps: ScaffoldPlanStep[] = [];
  const resolved: string[] = [];
  const name = intent.projectName;

  // 1) The shell app via `create <name> --template <frontend>`.
  if (intent.frontend) {
    resolved.push(intent.frontend.id);
    steps.push({
      command: ['create', name, '--template', intent.frontend.id],
      description: `Create the shell app "${name}" using the ${intent.frontend.title} frontend template`,
      template: intent.frontend.id,
      why: `Description mentioned "${intent.frontend.term}", resolved to template ${intent.frontend.id}`,
      applied: false,
    });
  }

  // 2) Each backend service via `generate backend <serviceName> --framework <id>`.
  for (const backend of intent.backends) {
    resolved.push(backend.id);
    // Avoid a doubled "-service-service" suffix when the resolved id already
    // ends in "-service" (e.g. comprehensive-auth-service).
    const serviceName = backend.id.endsWith('-service')
      ? backend.id
      : `${backend.id}-service`;
    steps.push({
      command: ['generate', 'backend', serviceName, '--framework', backend.id],
      description: `Generate the "${serviceName}" service using the ${backend.title} backend template`,
      template: backend.id,
      why: `Description mentioned "${backend.term}", resolved to template ${backend.id}`,
      applied: false,
    });
  }

  // 3) Each datastore via `generate backend <storeName> --framework <id>`. The
  //    config templates ARE real backend templates, so this reuses the same real
  //    command with a real --framework flag.
  for (const store of intent.datastores) {
    resolved.push(store.id);
    const storeName = store.id;
    steps.push({
      command: ['generate', 'backend', storeName, '--framework', store.id],
      description: `Generate the "${storeName}" datastore integration using the ${store.title} template`,
      template: store.id,
      why: `Description mentioned "${store.term}", resolved to template ${store.id}`,
      applied: false,
    });
  }

  // 4) Infra steps via real `k8s ...` commands.
  for (const item of intent.infra) {
    resolved.push(item.id);
    const spec = INFRA_VOCAB[item.term] ?? INFRA_VOCAB[item.id];
    if (!spec) continue;
    const command = spec.needsName ? [...spec.baseArgv, name] : [...spec.baseArgv];
    steps.push({
      command,
      description: spec.description,
      why: `Description mentioned "${item.term}"`,
      applied: false,
    });
  }

  return { applied: false, steps, resolved };
}

/**
 * One-shot offline entry point: description -> `{ intent, plan }`.
 *
 * Convenience wrapper that runs {@link extractIntent} followed by
 * {@link composePlan}. Pure relative to the live in-memory registries: no
 * network and no I/O beyond reading them.
 *
 * @param description - The free-text project description provided by the user.
 * @returns An object containing the extracted `intent` and the composed dry-run
 *   `plan` (with `applied` set to `false`).
 */
export function planScaffold(description: string): {
  intent: ScaffoldIntent;
  plan: ScaffoldPlan;
} {
  const intent = extractIntent(description);
  const plan = composePlan(intent);
  return { intent, plan };
}

// ---------------------------------------------------------------------------
// Pluggable LLM planner (optional, OFF by default; never on the default path)
// ---------------------------------------------------------------------------

/**
 * Pluggable contract for an optional LLM-backed planner, mirroring the
 * EmbeddingReranker / RationalePhraser patterns elsewhere.
 *
 * Guarantees the caller relies on:
 *  - It receives the description and may PROPOSE a {@link ScaffoldIntent}.
 *  - Its proposal MUST be validated (see {@link sanitizeProposedIntent}) so that
 *    every referenced slot id is a REAL template/framework id; unknown ids are
 *    dropped. A misbehaving provider can therefore never inject a fabricated id.
 *  - The DEFAULT `ai create` path never constructs or calls a planner, so the
 *    offline guarantee holds regardless of this interface's existence.
 */
export interface PlannerProvider {
  /** Stable identifier for the provider (used for logging/selection). */
  readonly name: string;
  /**
   * Propose a structured {@link ScaffoldIntent} for a description.
   *
   * Implementations are typically backed by an LLM and may perform network I/O,
   * hence the `Promise` return type. The proposal MUST be passed through
   * {@link sanitizeProposedIntent} before use so any non-real id is dropped.
   *
   * @param description - The free-text project description provided by the user.
   * @returns A promise resolving to a proposed `ScaffoldIntent`.
   */
  propose(description: string): Promise<ScaffoldIntent>;
}

/** Real id sets, snapshotted once for validating a provider's proposal. */
function realIdSets(): {
  frontend: ReadonlySet<string>;
  backend: ReadonlySet<string>;
} {
  return {
    frontend: new Set(Object.keys(SUPPORTED_FRAMEWORKS)),
    backend: new Set(listBackendTemplates().map(t => t.id)),
  };
}

/**
 * Defensively sanitise a provider-proposed intent.
 *
 * Drops any slot whose id is not a REAL registry id (frontend, backend, or
 * datastore) and re-derives a safe project name from either the proposed name
 * or the description. Infra slots are kept only when their id matches a known
 * infra spec. The returned intent is guaranteed to reference only real ids,
 * exactly like the offline path produced by {@link extractIntent}.
 *
 * @param proposed - The `ScaffoldIntent` proposed by a {@link PlannerProvider}.
 * @returns A new `ScaffoldIntent` with all unsafe/unknown ids removed.
 */
export function sanitizeProposedIntent(proposed: ScaffoldIntent): ScaffoldIntent {
  const { frontend: frontendIds, backend: backendIds } = realIdSets();
  const infraIds = new Set(Object.values(INFRA_VOCAB).map(s => s.id));

  const keepBackend = (slot: ScaffoldIntentSlot): boolean => backendIds.has(slot.id);
  const validFrontend =
    proposed.frontend && frontendIds.has(proposed.frontend.id)
      ? proposed.frontend
      : undefined;

  return {
    description: proposed.description.trim(),
    projectName: deriveProjectName(proposed.projectName || proposed.description),
    ...(validFrontend ? { frontend: validFrontend } : {}),
    backends: (proposed.backends ?? []).filter(keepBackend),
    datastores: (proposed.datastores ?? []).filter(keepBackend),
    infra: (proposed.infra ?? []).filter(slot => infraIds.has(slot.id)),
  };
}

/**
 * Resolve which planner provider to use from the environment, if any.
 *
 * Returns `undefined` on the default path so callers stay offline unless a
 * provider is explicitly configured. This reads env ONLY; it never performs a
 * network call. Wiring a concrete provider is intentionally left to the
 * integrator: this hook exists so an LLM adapter can be slotted in without
 * touching the offline core, and its output still funnels through
 * {@link sanitizeProposedIntent}.
 *
 * @returns A {@link PlannerProvider} when one is configured, otherwise
 *   `undefined`. The current implementation always returns `undefined` because
 *   no provider ships by default.
 */
export function plannerFromEnv(): PlannerProvider | undefined {
  // No provider is bundled. The presence of an env flag is recognised so an
  // operator can see the hook exists, but no network adapter ships by default.
  return undefined;
}
