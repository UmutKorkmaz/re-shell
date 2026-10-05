import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import type { PluginReview, PluginReviewAggregate } from '@re-shell/contracts';
import { isValidPackageName } from './plugin-installer';

/**
 * Team plugin reviews.
 *
 * The npm registry has no review system, so reviews are a workspace-level,
 * git-shareable record: `.re-shell/plugin-reviews.json`. Teammates add reviews
 * with `plugin review add`, commit the file, and everyone sees the same
 * aggregate in `plugin info`. One review per (plugin, author): adding again as
 * the same author replaces the earlier review, so the aggregate counts people,
 * not clicks.
 *
 * The file is written deterministically (sorted plugins, reviews ordered by
 * creation time then id, 2-space JSON, trailing newline) so concurrent edits by
 * different authors merge cleanly in git.
 */

/** Raised for invalid review input or an unreadable review file. */
export class PluginReviewError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PluginReviewError';
    this.details = details;
  }
}

/** On-disk shape of `.re-shell/plugin-reviews.json`. */
export interface PluginReviewsFile {
  version: 1;
  /** Reviews keyed by plugin package name. */
  reviews: Record<string, PluginReview[]>;
}

/** Workspace-relative path of the shared review file. */
export const REVIEWS_RELATIVE_PATH = '.re-shell/plugin-reviews.json';

const MAX_COMMENT_LENGTH = 2000;
const MAX_AUTHOR_LENGTH = 200;

/** Absolute path of the review file. */
export function reviewsFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.re-shell', 'plugin-reviews.json');
}

/**
 * Read the review file. Missing => empty. Corrupt => {@link PluginReviewError}
 * (never overwritten).
 */
export async function readReviews(workspaceRoot: string): Promise<PluginReviewsFile> {
  const file = reviewsFilePath(workspaceRoot);
  if (!(await fs.pathExists(file))) return { version: 1, reviews: {} };

  let raw: unknown;
  try {
    raw = await fs.readJSON(file);
  } catch (error) {
    throw new PluginReviewError(
      `Cannot read ${REVIEWS_RELATIVE_PATH}: ${error instanceof Error ? error.message : String(error)}`,
      { path: file }
    );
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PluginReviewError(`${REVIEWS_RELATIVE_PATH} must contain a JSON object`, { path: file });
  }
  const reviews = (raw as { reviews?: unknown }).reviews;
  if (reviews === undefined) return { version: 1, reviews: {} };
  if (!reviews || typeof reviews !== 'object' || Array.isArray(reviews)) {
    throw new PluginReviewError(`${REVIEWS_RELATIVE_PATH}: "reviews" must be an object`, { path: file });
  }

  const out: Record<string, PluginReview[]> = {};
  for (const [plugin, list] of Object.entries(reviews as Record<string, unknown>)) {
    if (!Array.isArray(list)) {
      throw new PluginReviewError(`${REVIEWS_RELATIVE_PATH}: reviews for "${plugin}" must be an array`, {
        path: file,
      });
    }
    const bad = list.findIndex((entry) => !isReview(entry));
    if (bad >= 0) {
      // Refuse rather than drop: the next write would silently erase a hand-edited review.
      throw new PluginReviewError(
        `${REVIEWS_RELATIVE_PATH}: review #${bad + 1} for "${plugin}" is malformed ` +
          '(needs id, plugin, rating 1-5, comment, author, createdAt)',
        { path: file, plugin, index: bad }
      );
    }
    out[plugin] = list as PluginReview[];
  }
  return { version: 1, reviews: out };
}

function isReview(value: unknown): value is PluginReview {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.plugin === 'string' &&
    typeof r.rating === 'number' &&
    Number.isInteger(r.rating) &&
    r.rating >= 1 &&
    r.rating <= 5 &&
    typeof r.comment === 'string' &&
    typeof r.author === 'string' &&
    typeof r.createdAt === 'string'
  );
}

async function writeReviews(workspaceRoot: string, data: PluginReviewsFile): Promise<void> {
  const target = reviewsFilePath(workspaceRoot);
  await fs.ensureDir(path.dirname(target));

  const sorted: Record<string, PluginReview[]> = {};
  for (const plugin of Object.keys(data.reviews).sort()) {
    const list = data.reviews[plugin];
    if (list.length === 0) continue;
    sorted[plugin] = [...list].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
    );
  }
  const body = JSON.stringify({ version: 1, reviews: sorted }, null, 2) + '\n';

  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmp, body, 'utf8');
    await fs.move(tmp, target, { overwrite: true });
  } catch (error) {
    await fs.remove(tmp).catch(() => {});
    throw error;
  }
}

/**
 * Aggregate a set of reviews.
 *
 * @param reviews - Reviews for one plugin.
 * @returns Count, mean rating (1 decimal; null when empty) and per-star counts.
 */
export function aggregateReviews(reviews: readonly PluginReview[]): PluginReviewAggregate {
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let sum = 0;
  for (const review of reviews) {
    distribution[String(review.rating)] += 1;
    sum += review.rating;
  }
  return {
    count: reviews.length,
    average: reviews.length === 0 ? null : Math.round((sum / reviews.length) * 10) / 10,
    distribution,
  };
}

/**
 * Best-effort identity for a review author: `git config user.email`, then
 * `user.name`, then the OS username.
 *
 * @param workspaceRoot - Directory to read the git config from.
 */
export function resolveReviewAuthor(workspaceRoot: string): string {
  for (const key of ['user.email', 'user.name']) {
    try {
      const value = execFileSync('git', ['config', '--get', key], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (value) return value;
    } catch {
      // not configured / not a git repo
    }
  }
  try {
    return os.userInfo().username;
  } catch {
    return 'unknown';
  }
}

/** Input for {@link addReview}. */
export interface AddReviewInput {
  plugin: string;
  /** Integer 1-5. */
  rating: number;
  comment?: string;
  /** Defaults to {@link resolveReviewAuthor}. */
  author?: string;
  /** Plugin version being reviewed, when known. */
  version?: string | null;
  /** Clock override for tests. */
  now?: () => Date;
}

/** Result of {@link addReview}. */
export interface AddReviewResult {
  review: PluginReview;
  /** True when an earlier review by the same author was replaced. */
  updated: boolean;
  aggregate: PluginReviewAggregate;
}

/**
 * Add (or replace, for the same author) a review.
 *
 * @throws {PluginReviewError} On invalid plugin name, rating, comment or author.
 */
export async function addReview(
  workspaceRoot: string,
  input: AddReviewInput
): Promise<AddReviewResult> {
  if (!isValidPackageName(input.plugin)) {
    throw new PluginReviewError(`"${input.plugin}" is not a valid plugin name`, { plugin: input.plugin });
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new PluginReviewError(`Rating must be an integer from 1 to 5 (got ${String(input.rating)})`, {
      rating: input.rating,
    });
  }
  const comment = (input.comment ?? '').trim();
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new PluginReviewError(`Comment is too long (${comment.length} > ${MAX_COMMENT_LENGTH} characters)`);
  }
  const author = (input.author ?? resolveReviewAuthor(workspaceRoot)).trim();
  if (author.length === 0 || author.length > MAX_AUTHOR_LENGTH) {
    throw new PluginReviewError(`Review author must be 1-${MAX_AUTHOR_LENGTH} characters`);
  }

  const data = await readReviews(workspaceRoot);
  const existing = data.reviews[input.plugin] ?? [];
  const id = crypto.createHash('sha1').update(`${input.plugin}\n${author}`).digest('hex').slice(0, 12);
  const previous = existing.find((r) => r.id === id);
  const now = (input.now?.() ?? new Date()).toISOString();

  const review: PluginReview = {
    id,
    plugin: input.plugin,
    rating: input.rating,
    comment,
    author,
    version: input.version ?? null,
    createdAt: previous?.createdAt ?? now,
    updatedAt: previous ? now : null,
  };
  const next = [...existing.filter((r) => r.id !== id), review];
  await writeReviews(workspaceRoot, { version: 1, reviews: { ...data.reviews, [input.plugin]: next } });

  return { review, updated: previous !== undefined, aggregate: aggregateReviews(next) };
}

/**
 * List the reviews for one plugin, newest first, with their aggregate.
 */
export async function listReviews(
  workspaceRoot: string,
  plugin: string
): Promise<{ reviews: PluginReview[]; aggregate: PluginReviewAggregate }> {
  const data = await readReviews(workspaceRoot);
  const reviews = [...(data.reviews[plugin] ?? [])].sort(
    (a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
  );
  return { reviews, aggregate: aggregateReviews(reviews) };
}

/** Aggregates for every reviewed plugin (plugins without reviews are absent). */
export async function readReviewAggregates(
  workspaceRoot: string
): Promise<Map<string, PluginReviewAggregate>> {
  const data = await readReviews(workspaceRoot);
  const out = new Map<string, PluginReviewAggregate>();
  for (const [plugin, list] of Object.entries(data.reviews)) {
    out.set(plugin, aggregateReviews(list));
  }
  return out;
}
