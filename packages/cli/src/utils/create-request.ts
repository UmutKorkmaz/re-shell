import prompts from 'prompts';
import type { CreateMode, ErrorCode } from '@re-shell/contracts';
import { backendTemplates } from '../templates/backend/index';
import {
  getAllArchitectureTemplates,
  type ArchitectureTemplate,
} from '../templates/architecture/index';
import { hasFrontendTemplate, listFrontendTemplateIds } from '../templates/frontend/registry';
import { validateDatabaseType } from './database';

/**
 * An error raised while resolving or running `create` that maps to a stable
 * machine-readable JSON error code (see `errorCodeSchema` in @re-shell/contracts).
 */
export class CreateError extends Error {
  /** Machine-readable code emitted in `--json` mode. */
  readonly code: ErrorCode;
  /** Optional structured details emitted under `error.details`. */
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CreateError';
    this.code = code;
    this.details = details;
  }
}

/** Workspace types accepted by `--type`. */
export const WORKSPACE_TYPES = ['app', 'package', 'lib', 'tool'] as const;

/** The pseudo-template that asks for an empty workspace with no app. */
export const BLANK_TEMPLATE = 'blank';

/** Default frontend framework when none is given. */
export const DEFAULT_FRONTEND = 'react-ts';

/** Default backend template when `--fullstack` is used without `--backend`. */
export const DEFAULT_BACKEND = 'express';

/**
 * True when `create` must not prompt: `--yes` was passed, or stdin is not a TTY
 * (CI, pipes, closed stdin) and no test harness injected prompt answers. In that
 * mode every prompt falls back to its documented default, and anything with no
 * sensible default fails explicitly instead of waiting on input that never comes.
 *
 * @param options - The create options (only `yes` is read).
 * @returns `true` when prompts must be skipped.
 */
export function isNonInteractive(options: { yes?: boolean }): boolean {
  if (options.yes === true) return true;
  const injected = Boolean((prompts as unknown as { _injected?: unknown[] })._injected?.length);
  return !process.stdin.isTTY && !injected;
}

/**
 * Standard Levenshtein edit distance between two strings.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns The minimum number of single-character edits turning `a` into `b`.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Rank the closest candidates to `input`: names that contain or are contained by
 * the input first, then names sharing a meaningful token, then small edit
 * distances.
 *
 * @param input - The unknown name the user typed.
 * @param candidates - Valid names to suggest from.
 * @param limit - Maximum suggestions to return (default 5).
 * @returns Up to `limit` suggestions, best first, without duplicates.
 */
export function suggestMatches(input: string, candidates: string[], limit = 5): string[] {
  const needle = input.toLowerCase();
  const needleTokens = needle.split(/[-_./\s]+/).filter(t => t.length >= 3);
  const maxDistance = Math.max(2, Math.floor(needle.length / 3));

  const scored: Array<{ name: string; tier: number; score: number }> = [];
  for (const name of new Set(candidates)) {
    const hay = name.toLowerCase();
    if (hay === needle) {
      scored.push({ name, tier: 0, score: 0 });
    } else if (
      (hay.length >= 3 && needle.includes(hay)) ||
      (needle.length >= 3 && hay.includes(needle))
    ) {
      scored.push({ name, tier: 1, score: Math.abs(hay.length - needle.length) });
    } else if (needleTokens.some(t => hay.split(/[-_./\s]+/).includes(t))) {
      scored.push({ name, tier: 2, score: levenshtein(needle, hay) });
    } else {
      const distance = levenshtein(needle, hay);
      if (distance <= maxDistance) scored.push({ name, tier: 3, score: distance });
    }
  }

  return scored
    .sort((a, b) => a.tier - b.tier || a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(s => s.name);
}

function has(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** True when `id` is a registered backend template. */
export function isKnownBackend(id: string): boolean {
  return has(backendTemplates, id);
}

/** True when `id` is a frontend framework that can actually be scaffolded. */
export function isKnownFrontend(id: string): boolean {
  return hasFrontendTemplate(id);
}

/** Look up an architecture template by exact id (own keys only). */
export function findArchitectureTemplate(id: string): ArchitectureTemplate | undefined {
  return getAllArchitectureTemplates().find(t => t.id === id);
}

/** Every backend template id. */
export function backendIds(): string[] {
  return Object.keys(backendTemplates);
}

/**
 * Build the TEMPLATE_NOT_FOUND error for an unknown name, with close matches.
 *
 * @param label - What the name was supposed to be (e.g. `backend template`).
 * @param input - The unknown name.
 * @param candidates - Valid names to suggest from.
 * @param hint - Where to browse the full list when nothing is close.
 * @returns A {@link CreateError} with code `TEMPLATE_NOT_FOUND`.
 */
export function templateNotFound(
  label: string,
  input: string,
  candidates: string[],
  hint = 'Run `re-shell templates list` to see available ids.'
): CreateError {
  const suggestions = suggestMatches(input, candidates);
  const tail =
    suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : ` ${hint}`;
  return new CreateError('TEMPLATE_NOT_FOUND', `Unknown ${label} "${input}".${tail}`, {
    name: input,
    kind: label,
    suggestions,
  });
}

/** The raw options `create` resolves into a request. */
export interface CreateRequestInput {
  template?: string;
  framework?: string;
  frontend?: string;
  backend?: string;
  db?: string;
  fullstack?: boolean;
  polyglot?: boolean;
  microfrontend?: boolean;
  type?: string;
  port?: string;
  route?: string;
}

/** Controls how {@link resolveCreateRequest} treats missing values. */
export interface ResolveContext {
  /**
   * Fill every missing stack choice with its documented default (non-interactive
   * and dry-run). When `false`, missing choices are left unset so the interactive
   * wizard can ask for them.
   */
  fillDefaults: boolean;
}

/** A validated, normalized `create` request. */
export interface ResolvedCreateRequest {
  mode: CreateMode;
  /** Validated frontend framework id (a scaffoldable template). */
  frontend?: string;
  /** Validated backend template id. */
  backend?: string;
  /** Validated database type, as given. */
  db?: string;
  /** Architecture template selected with `--template`, if any. */
  architectureTemplate?: ArchitectureTemplate;
  /** Human-readable notes: defaults applied, flags ignored. */
  notes: string[];
}

type TemplateKind =
  | { kind: 'blank' }
  | { kind: 'architecture'; template: ArchitectureTemplate }
  | { kind: 'backend'; id: string }
  | { kind: 'frontend'; id: string };

/** Classify a `--template` value, or fail with TEMPLATE_NOT_FOUND and close matches. */
function classifyTemplate(value: string): TemplateKind {
  if (value === BLANK_TEMPLATE) return { kind: 'blank' };
  if (isKnownBackend(value)) return { kind: 'backend', id: value };
  const architecture = findArchitectureTemplate(value);
  if (architecture) return { kind: 'architecture', template: architecture };
  if (isKnownFrontend(value)) return { kind: 'frontend', id: value };

  const candidates = [
    BLANK_TEMPLATE,
    ...backendIds(),
    ...getAllArchitectureTemplates().map(t => t.id),
    ...listFrontendTemplateIds(),
  ];
  throw templateNotFound('template', value, candidates);
}

function invalid(message: string, details?: Record<string, unknown>): CreateError {
  return new CreateError('CREATE_INVALID_OPTIONS', message, details);
}

/**
 * Validate a `--frontend` / `--framework` value.
 *
 * @param value - The framework id.
 * @returns The id when it can be scaffolded.
 * @throws CreateError `TEMPLATE_NOT_FOUND` with close matches otherwise.
 */
export function assertFrontend(value: string): string {
  if (!isKnownFrontend(value)) {
    throw templateNotFound('frontend framework', value, listFrontendTemplateIds());
  }
  return value;
}

/**
 * Validate a `--backend` value.
 *
 * @param value - The backend template id.
 * @returns The id when it is a registered backend template.
 * @throws CreateError `TEMPLATE_NOT_FOUND` with close matches otherwise.
 */
export function assertBackend(value: string): string {
  if (!isKnownBackend(value)) {
    throw templateNotFound('backend template', value, backendIds());
  }
  return value;
}

/**
 * Turn the raw `create` options into a validated request: reject unknown
 * template/framework names (with close matches), reject contradictory flags,
 * classify the mode, and (for non-interactive runs) fill documented defaults.
 *
 * Mode rules:
 * - `--polyglot` / `--microfrontend` select those modes (mutually exclusive).
 * - `--template blank` selects an empty `skeleton` workspace.
 * - `--fullstack`, an architecture template, or both `--backend` and a frontend
 *   select `fullstack` (default backend `express`, default frontend `react-ts`).
 * - A backend alone is `backend` (just the API), a frontend alone is `frontend`.
 * - Nothing selected means `frontend` with the default `react-ts`.
 *
 * @param input - The raw options.
 * @param context - Whether to fill defaults for missing choices.
 * @returns The validated request.
 * @throws CreateError (`TEMPLATE_NOT_FOUND`, `CREATE_INVALID_OPTIONS`).
 */
export function resolveCreateRequest(
  input: CreateRequestInput,
  context: ResolveContext
): ResolvedCreateRequest {
  const notes: string[] = [];

  if (input.type !== undefined && !(WORKSPACE_TYPES as readonly string[]).includes(input.type)) {
    throw invalid(
      `Invalid --type "${input.type}": expected one of ${WORKSPACE_TYPES.join(', ')}. ` +
        'Use --fullstack for a frontend plus API.',
      { type: input.type }
    );
  }

  if (input.db !== undefined) {
    const dbCheck = validateDatabaseType(input.db);
    if (!dbCheck.valid) {
      throw invalid(dbCheck.error ?? `Unknown database "${input.db}"`, { db: input.db });
    }
  }

  if (input.port !== undefined) {
    const port = Number(input.port);
    if (!/^\d+$/.test(String(input.port)) || port < 1 || port > 65535) {
      throw invalid(`Invalid --port "${input.port}": must be a number between 1 and 65535.`, {
        port: input.port,
      });
    }
  }

  if (input.route !== undefined && !input.route.startsWith('/')) {
    throw invalid(`Invalid --route "${input.route}": a route must start with "/".`, {
      route: input.route,
    });
  }

  if (input.polyglot && input.microfrontend) {
    throw invalid('--polyglot and --microfrontend cannot be combined; pick one mode.');
  }
  if ((input.polyglot || input.microfrontend) && input.fullstack) {
    throw invalid(
      `--fullstack cannot be combined with --${input.polyglot ? 'polyglot' : 'microfrontend'}.`
    );
  }

  if (input.framework && input.frontend && input.framework !== input.frontend) {
    throw invalid(
      `--framework "${input.framework}" and --frontend "${input.frontend}" conflict; they are aliases, pass one.`
    );
  }

  let frontend = input.framework ?? input.frontend;
  let backend = input.backend;
  if (frontend !== undefined) assertFrontend(frontend);
  if (backend !== undefined) assertBackend(backend);

  let template: TemplateKind | undefined;
  if (input.template !== undefined) template = classifyTemplate(input.template);

  let db = input.db;
  let architectureTemplate: ArchitectureTemplate | undefined;

  if (template) {
    switch (template.kind) {
      case 'blank': {
        const clash = input.polyglot
          ? '--polyglot'
          : input.microfrontend
            ? '--microfrontend'
            : input.fullstack
              ? '--fullstack'
              : frontend
                ? '--frontend/--framework'
                : backend
                  ? '--backend'
                  : undefined;
        if (clash) {
          throw invalid(`--template blank creates an empty workspace and cannot be combined with ${clash}.`);
        }
        return { mode: 'skeleton', db, notes };
      }
      case 'architecture': {
        if (input.polyglot || input.microfrontend) {
          throw invalid(
            `Architecture template "${template.template.id}" cannot be combined with --${input.polyglot ? 'polyglot' : 'microfrontend'}.`
          );
        }
        architectureTemplate = template.template;
        if (!frontend && architectureTemplate.frontend) {
          frontend = assertArchitectureSide(architectureTemplate, 'frontend', architectureTemplate.frontend);
        }
        if (!backend && architectureTemplate.backend) {
          backend = assertArchitectureSide(architectureTemplate, 'backend', architectureTemplate.backend);
        }
        if ((db === undefined || db === 'none') && architectureTemplate.db) {
          db = architectureTemplate.db;
        }
        break;
      }
      case 'backend': {
        if (input.polyglot || input.microfrontend) {
          throw invalid(
            `Backend template "${template.id}" cannot be used with --${input.polyglot ? 'polyglot' : 'microfrontend'}; use --services for polyglot services.`
          );
        }
        if (backend && backend !== template.id) {
          throw invalid(`--template "${template.id}" conflicts with --backend "${backend}".`);
        }
        backend = template.id;
        break;
      }
      case 'frontend': {
        if (frontend && frontend !== template.id) {
          throw invalid(`--template "${template.id}" conflicts with --framework/--frontend "${frontend}".`);
        }
        frontend = template.id;
        break;
      }
    }
  }

  if (input.polyglot || input.microfrontend) {
    if (backend) {
      throw invalid(
        `--backend is not used by --${input.polyglot ? 'polyglot' : 'microfrontend'}; ` +
          (input.polyglot ? 'choose services with --services.' : 'remotes are frontends (see --remotes).')
      );
    }
    return { mode: input.polyglot ? 'polyglot' : 'microfrontend', frontend, db, notes };
  }

  const wantsFullstack = Boolean(input.fullstack || architectureTemplate || (backend && frontend));
  if (wantsFullstack) {
    if (!backend && context.fillDefaults) {
      backend = DEFAULT_BACKEND;
      notes.push(`No --backend given for a fullstack project; using the default backend "${DEFAULT_BACKEND}".`);
    }
    if (!frontend && context.fillDefaults) {
      frontend = DEFAULT_FRONTEND;
      notes.push(`No --frontend given for a fullstack project; using the default frontend "${DEFAULT_FRONTEND}".`);
    }
    return { mode: 'fullstack', frontend, backend, db, architectureTemplate, notes };
  }

  if (backend) {
    return { mode: 'backend', backend, db, notes };
  }

  if (!frontend && context.fillDefaults) {
    frontend = DEFAULT_FRONTEND;
    notes.push(
      `No stack selected; defaulting to a "${DEFAULT_FRONTEND}" frontend app (use --template ${BLANK_TEMPLATE} for an empty workspace).`
    );
  }
  return { mode: 'frontend', frontend, db, notes };
}

/** An architecture template can reference an id that no registry has; fail loudly. */
function assertArchitectureSide(
  architecture: ArchitectureTemplate,
  side: 'frontend' | 'backend',
  id: string
): string {
  const known = side === 'frontend' ? isKnownFrontend(id) : isKnownBackend(id);
  if (!known) {
    const candidates = side === 'frontend' ? listFrontendTemplateIds() : backendIds();
    const base = templateNotFound(`${side} template`, id, candidates);
    throw new CreateError(
      'TEMPLATE_NOT_FOUND',
      `Architecture template "${architecture.id}" references unknown ${side} "${id}"` +
        (base.details && Array.isArray(base.details.suggestions) && base.details.suggestions.length > 0
          ? `. Did you mean: ${(base.details.suggestions as string[]).join(', ')}?`
          : '. Pass --frontend/--backend explicitly to override it.'),
      { template: architecture.id, side, name: id, suggestions: base.details?.suggestions ?? [] }
    );
  }
  return id;
}

/** One `name[:framework]` entry parsed from `--services` / `--remotes`. */
export interface NameFrameworkEntry {
  name: string;
  framework?: string;
}

const KEBAB_CASE = /^[a-z][a-z0-9-]*$/;

/**
 * Parse a comma-separated `name[:framework]` list (the `--services` /
 * `--remotes` flags).
 *
 * @param flag - The flag name, for error messages.
 * @param spec - The raw value, e.g. `users:fastapi,orders:express`.
 * @returns The parsed entries, in order.
 * @throws CreateError `CREATE_INVALID_OPTIONS` for empty, malformed or duplicate entries.
 */
export function parseNameFrameworkList(flag: string, spec: string): NameFrameworkEntry[] {
  const entries: NameFrameworkEntry[] = [];
  const seen = new Set<string>();
  for (const raw of spec.split(',')) {
    const item = raw.trim();
    if (!item) continue;
    const [name, framework, ...rest] = item.split(':');
    if (rest.length > 0 || !name) {
      throw invalid(`Invalid ${flag} entry "${item}": expected name or name:framework.`, {
        flag,
        entry: item,
      });
    }
    if (!KEBAB_CASE.test(name)) {
      throw invalid(
        `Invalid ${flag} name "${name}": use lowercase letters, numbers and hyphens, starting with a letter.`,
        { flag, entry: item }
      );
    }
    if (seen.has(name)) {
      throw invalid(`Duplicate ${flag} name "${name}".`, { flag, entry: item });
    }
    seen.add(name);
    entries.push({ name, framework: framework || undefined });
  }
  if (entries.length === 0) {
    throw invalid(`${flag} must list at least one entry (name or name:framework).`, { flag });
  }
  return entries;
}
