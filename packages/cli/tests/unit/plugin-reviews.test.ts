import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  PluginReviewError,
  REVIEWS_RELATIVE_PATH,
  addReview,
  aggregateReviews,
  listReviews,
  readReviewAggregates,
  readReviews,
  resolveReviewAuthor,
  reviewsFilePath,
} from '../../src/utils/plugin-reviews';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-reviews-'));
});

afterEach(async () => {
  await fs.remove(root);
});

const at = (iso: string) => () => new Date(iso);

describe('addReview', () => {
  it('stores a review in .re-shell/plugin-reviews.json and returns the aggregate', async () => {
    const result = await addReview(root, {
      plugin: 'reshell-plugin-x',
      rating: 4,
      comment: '  solid, a bit slow to start  ',
      author: 'dev@example.com',
      version: '1.2.3',
      now: at('2026-10-01T10:00:00.000Z'),
    });

    expect(result.updated).toBe(false);
    expect(result.review).toMatchObject({
      plugin: 'reshell-plugin-x',
      rating: 4,
      comment: 'solid, a bit slow to start',
      author: 'dev@example.com',
      version: '1.2.3',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: null,
    });
    expect(result.review.id).toMatch(/^[0-9a-f]{12}$/);
    expect(result.aggregate).toEqual({ count: 1, average: 4, distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 0 } });
    expect(REVIEWS_RELATIVE_PATH).toBe('.re-shell/plugin-reviews.json');
    const onDisk = await fs.readJSON(reviewsFilePath(root));
    expect(onDisk.version).toBe(1);
    expect(onDisk.reviews['reshell-plugin-x']).toHaveLength(1);
  });

  it('replaces (not duplicates) a review by the same author, keeping createdAt and stamping updatedAt', async () => {
    await addReview(root, { plugin: 'p-x', rating: 2, comment: 'meh', author: 'a@x.io', now: at('2026-10-01T10:00:00.000Z') });
    const second = await addReview(root, { plugin: 'p-x', rating: 5, comment: 'much better in 2.0', author: 'a@x.io', now: at('2026-10-02T10:00:00.000Z') });

    expect(second.updated).toBe(true);
    expect(second.review).toMatchObject({ rating: 5, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-02T10:00:00.000Z' });
    expect(second.aggregate.count).toBe(1);
    expect((await listReviews(root, 'p-x')).reviews).toHaveLength(1);
  });

  it('aggregates across authors and plugins independently', async () => {
    await addReview(root, { plugin: 'p-x', rating: 5, author: 'a@x.io' });
    await addReview(root, { plugin: 'p-x', rating: 4, author: 'b@x.io' });
    await addReview(root, { plugin: 'p-x', rating: 4, author: 'c@x.io' });
    await addReview(root, { plugin: 'p-y', rating: 1, author: 'a@x.io' });

    const x = await listReviews(root, 'p-x');
    expect(x.aggregate).toEqual({ count: 3, average: 4.3, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 1 } });
    expect((await listReviews(root, 'p-y')).aggregate.average).toBe(1);
    const all = await readReviewAggregates(root);
    expect([...all.keys()].sort()).toEqual(['p-x', 'p-y']);
    expect(all.get('p-x')?.count).toBe(3);
  });

  it('allows a review without a comment', async () => {
    const result = await addReview(root, { plugin: 'p-x', rating: 3, author: 'a@x.io' });
    expect(result.review.comment).toBe('');
  });

  it.each([0, 6, 3.5, -1, NaN, Infinity])('rejects rating %s', async (rating) => {
    await expect(addReview(root, { plugin: 'p-x', rating, author: 'a@x.io' })).rejects.toThrow(/Rating must be an integer from 1 to 5/);
    expect(await fs.pathExists(reviewsFilePath(root))).toBe(false);
  });

  it('rejects invalid plugin names, empty authors and oversized comments', async () => {
    await expect(addReview(root, { plugin: '../x', rating: 5, author: 'a' })).rejects.toThrow(/not a valid plugin name/);
    await expect(addReview(root, { plugin: 'p-x', rating: 5, author: '   ' })).rejects.toThrow(/author/);
    await expect(addReview(root, { plugin: 'p-x', rating: 5, author: 'a', comment: 'x'.repeat(2001) })).rejects.toBeInstanceOf(PluginReviewError);
  });

  it('writes deterministically (sorted plugins, ordered reviews) so git merges stay clean', async () => {
    await addReview(root, { plugin: 'zeta', rating: 5, author: 'b@x.io', now: at('2026-10-02T00:00:00.000Z') });
    await addReview(root, { plugin: 'alpha', rating: 5, author: 'b@x.io', now: at('2026-10-03T00:00:00.000Z') });
    await addReview(root, { plugin: 'alpha', rating: 4, author: 'a@x.io', now: at('2026-10-01T00:00:00.000Z') });

    const raw = await fs.readFile(reviewsFilePath(root), 'utf8');
    expect(raw.endsWith('}\n')).toBe(true);
    const parsed = JSON.parse(raw);
    expect(Object.keys(parsed.reviews)).toEqual(['alpha', 'zeta']);
    expect(parsed.reviews.alpha.map((r: { author: string }) => r.author)).toEqual(['a@x.io', 'b@x.io']);

    // Re-adding identical content produces byte-identical output.
    await addReview(root, { plugin: 'alpha', rating: 4, author: 'a@x.io', now: at('2026-10-01T00:00:00.000Z') });
    const again = await fs.readFile(reviewsFilePath(root), 'utf8');
    expect(JSON.parse(again).reviews.alpha[0]).toMatchObject({ createdAt: '2026-10-01T00:00:00.000Z' });
  });

  it('leaves no temp files behind', async () => {
    await addReview(root, { plugin: 'p-x', rating: 5, author: 'a@x.io' });
    expect(await fs.readdir(path.join(root, '.re-shell'))).toEqual(['plugin-reviews.json']);
  });
});

describe('listReviews / readReviews', () => {
  it('lists newest first and returns an empty aggregate for an unreviewed plugin', async () => {
    await addReview(root, { plugin: 'p-x', rating: 1, comment: 'old', author: 'a@x.io', now: at('2026-09-01T00:00:00.000Z') });
    await addReview(root, { plugin: 'p-x', rating: 5, comment: 'new', author: 'b@x.io', now: at('2026-10-01T00:00:00.000Z') });
    const { reviews } = await listReviews(root, 'p-x');
    expect(reviews.map((r) => r.comment)).toEqual(['new', 'old']);

    const none = await listReviews(root, 'unreviewed');
    expect(none.reviews).toEqual([]);
    expect(none.aggregate).toEqual({ count: 0, average: null, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } });
  });

  it('returns nothing (no file created) when no reviews exist', async () => {
    expect(await readReviews(root)).toEqual({ version: 1, reviews: {} });
    expect(await fs.pathExists(reviewsFilePath(root))).toBe(false);
  });

  it('refuses to read a corrupt file, and so never overwrites it', async () => {
    await fs.outputFile(reviewsFilePath(root), '{ broken');
    await expect(listReviews(root, 'p-x')).rejects.toBeInstanceOf(PluginReviewError);
    await expect(addReview(root, { plugin: 'p-x', rating: 5, author: 'a' })).rejects.toBeInstanceOf(PluginReviewError);
    expect(await fs.readFile(reviewsFilePath(root), 'utf8')).toBe('{ broken');
  });

  it('refuses a file with a malformed review rather than silently dropping it', async () => {
    await fs.outputJSON(reviewsFilePath(root), {
      version: 1,
      reviews: { 'p-x': [{ id: 'abc', plugin: 'p-x', rating: 9, comment: '', author: 'a', createdAt: 'x' }] },
    });
    await expect(readReviews(root)).rejects.toThrow(/review #1 for "p-x" is malformed/);
    await expect(addReview(root, { plugin: 'p-x', rating: 5, author: 'b' })).rejects.toBeInstanceOf(PluginReviewError);
  });

  it('rejects structurally invalid files', async () => {
    await fs.outputJSON(reviewsFilePath(root), ['nope']);
    await expect(readReviews(root)).rejects.toThrow(/JSON object/);
    await fs.outputJSON(reviewsFilePath(root), { reviews: [] });
    await expect(readReviews(root)).rejects.toThrow(/"reviews" must be an object/);
    await fs.outputJSON(reviewsFilePath(root), { reviews: { x: 'nope' } });
    await expect(readReviews(root)).rejects.toThrow(/must be an array/);
  });
});

describe('aggregateReviews', () => {
  it('rounds the mean to one decimal', () => {
    const mk = (rating: number) => ({
      id: String(rating),
      plugin: 'p',
      rating,
      comment: '',
      author: 'a',
      version: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    });
    expect(aggregateReviews([mk(5), mk(4), mk(4)]).average).toBe(4.3);
    expect(aggregateReviews([mk(1), mk(2)]).average).toBe(1.5);
    expect(aggregateReviews([]).average).toBeNull();
  });
});

describe('resolveReviewAuthor', () => {
  const keys = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM'] as const;
  const saved: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  // Isolate from any global/system git identity on the machine running the tests.
  beforeEach(() => {
    for (const key of keys) saved[key] = process.env[key];
    process.env.GIT_CONFIG_GLOBAL = '/dev/null';
    process.env.GIT_CONFIG_SYSTEM = '/dev/null';
    process.env.GIT_CONFIG_NOSYSTEM = '1';
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('prefers git user.email, then user.name', async () => {
    const repo = path.join(root, 'repo');
    await fs.ensureDir(repo);
    execFileSync('git', ['init', '--quiet'], { cwd: repo });
    execFileSync('git', ['config', 'user.name', 'Jane Dev'], { cwd: repo });
    expect(resolveReviewAuthor(repo)).toBe('Jane Dev');
    execFileSync('git', ['config', 'user.email', 'jane@example.com'], { cwd: repo });
    expect(resolveReviewAuthor(repo)).toBe('jane@example.com');
  });

  it('falls back to the OS username outside a configured repository', () => {
    expect(resolveReviewAuthor(root)).toBe(os.userInfo().username);
  });
});
