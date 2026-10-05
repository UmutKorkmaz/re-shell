import { describe, it, expect } from 'vitest';
import {
  errorCodeSchema,
  jsonResponseSchema,
  pluginListResponseSchema,
  pluginInfoResponseSchema,
  pluginUninstallResponseSchema,
  pluginUpdateResponseSchema,
  pluginValidateResponseSchema,
  pluginPinResponseSchema,
  pluginReviewAddResponseSchema,
  pluginReviewListResponseSchema,
  pluginQualitySchema,
  policyListResponseSchema,
  policySearchResponseSchema,
  policyInstallResponseSchema,
  policyRemoveResponseSchema,
} from './index.js';

const aggregate = { count: 2, average: 4.5, distribution: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 1 } };
const review = {
  id: 'abc123def456',
  plugin: 'reshell-plugin-x',
  rating: 5,
  comment: 'works',
  author: 'dev@example.com',
  version: '1.0.0',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
};
const quality = {
  source: 'npms' as const,
  rating: 4.2,
  score: 0.84,
  quality: 0.9,
  popularity: 0.6,
  maintenance: 0.95,
  downloadsLastMonth: 1200,
  fetchedAt: '2026-01-01T00:00:00.000Z',
  cached: false,
  stale: false,
  derived: false,
};
const listItem = {
  name: 'reshell-plugin-x',
  version: '1.0.0',
  description: 'x',
  path: '/ws/.re-shell/plugins/reshell-plugin-x',
  origin: 'npm' as const,
  state: 'unloaded',
  isLoaded: false,
  isActive: false,
  usageCount: 0,
  pin: null,
  installedAt: '2026-01-01T00:00:00.000Z',
  managed: true,
  reviews: aggregate,
};

describe('plugin lifecycle error codes', () => {
  it.each([
    'PLUGIN_LIST_ERROR',
    'PLUGIN_INFO_ERROR',
    'PLUGIN_NOT_FOUND',
    'PLUGIN_UNINSTALL_ERROR',
    'PLUGIN_PIN_ERROR',
    'PLUGIN_REVIEW_ERROR',
    'POLICY_PACK_ERROR',
    'POLICY_PACK_NOT_FOUND',
    'PLUGIN_UPDATE_ERROR',
    'PLUGIN_VALIDATE_ERROR',
  ])('%s is in the closed error-code set', (code) => {
    expect(errorCodeSchema.safeParse(code).success).toBe(true);
  });
});

describe('plugin payload schemas', () => {
  it('parses a list payload', () => {
    const schema = jsonResponseSchema(pluginListResponseSchema);
    expect(
      schema.safeParse({ ok: true, data: { plugins: [listItem], total: 1 }, warnings: [] }).success
    ).toBe(true);
    // origin is a closed set
    expect(
      pluginListResponseSchema.safeParse({
        plugins: [{ ...listItem, origin: 'somewhere' }],
        total: 1,
      }).success
    ).toBe(false);
  });

  it('parses an info payload and rejects a bad rating', () => {
    const info = {
      ...listItem,
      manifest: {
        name: 'reshell-plugin-x',
        version: '1.0.0',
        description: 'x',
        main: 'index.js',
        author: null,
        license: 'MIT',
        homepage: null,
        keywords: ['reshell-plugin'],
        engines: { 'reshell-cli': '^0.30.0' },
        dependencies: null,
        peerDependencies: null,
        reshell: {},
      },
      install: {
        source: 'npm',
        spec: 'reshell-plugin-x@1.0.0',
        installedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
        git: null,
        integrity: 'sha512-abc',
        signature: { verified: true, gated: true, keyid: 'SHA256:x' },
      },
      lifecycle: { lastUsed: null, loadMs: 0, initMs: 0, activationMs: 0, errors: [] },
      dependencies: [],
      dependents: [],
      recentReviews: [review],
      quality,
    };
    expect(pluginInfoResponseSchema.safeParse(info).success).toBe(true);
    expect(
      pluginInfoResponseSchema.safeParse({ ...info, quality: { ...quality, rating: 7 } }).success
    ).toBe(false);
    expect(pluginInfoResponseSchema.safeParse({ ...info, quality: null }).success).toBe(true);
  });

  it('only accepts unavailable quality without fabricated numbers', () => {
    expect(
      pluginQualitySchema.safeParse({
        source: 'unavailable',
        rating: null,
        score: null,
        quality: null,
        popularity: null,
        maintenance: null,
        downloadsLastMonth: null,
        fetchedAt: '2026-01-01T00:00:00.000Z',
        cached: false,
        stale: false,
        derived: false,
        error: 'registry unreachable',
      }).success
    ).toBe(true);
  });

  it('parses uninstall, pin and update payloads', () => {
    expect(
      pluginUninstallResponseSchema.safeParse({
        name: 'p',
        version: '1.0.0',
        dryRun: false,
        removed: { paths: ['/a'], registryEntry: true },
        kept: [],
        deregistered: { unloaded: true, hooks: 2, commands: 1 },
      }).success
    ).toBe(true);
    expect(
      pluginPinResponseSchema.safeParse({ name: 'p', pin: '1.0.0', previousPin: null, installed: '1.0.0' })
        .success
    ).toBe(true);
    expect(
      pluginUpdateResponseSchema.safeParse({
        checkOnly: true,
        plugins: [
          {
            name: 'p',
            source: 'npm',
            installed: '1.0.0',
            target: '1.1.0',
            latest: '1.1.0',
            pin: null,
            status: 'update-available',
            message: null,
            signature: null,
          },
        ],
        summary: {
          total: 1,
          updated: 0,
          updateAvailable: 1,
          upToDate: 0,
          pinned: 0,
          notUpdatable: 0,
          failed: 0,
        },
      }).success
    ).toBe(true);
    expect(
      pluginUpdateResponseSchema.safeParse({
        checkOnly: false,
        plugins: [{ name: 'p', source: 'ftp', installed: '1', target: null, latest: null, pin: null, status: 'updated', message: null, signature: null }],
        summary: { total: 1, updated: 1, updateAvailable: 0, upToDate: 0, pinned: 0, notUpdatable: 0, failed: 0 },
      }).success
    ).toBe(false);
  });

  it('parses a validate report', () => {
    expect(
      pluginValidateResponseSchema.safeParse({
        path: '/p',
        name: 'p',
        version: '1.0.0',
        valid: false,
        strict: false,
        cliVersion: '0.30.1',
        findings: [
          { id: 'security-eval', category: 'security', severity: 'error', message: 'eval()', file: 'index.js', line: 3 },
        ],
        counts: { errors: 1, warnings: 0, info: 0 },
        size: { bytes: 10, files: 2 },
        engines: { reshellCli: '^0.30.0', node: null, reshellCliSatisfied: true, nodeSatisfied: null },
        checks: { manifest: 'pass', security: 'fail' },
      }).success
    ).toBe(true);
  });

  it('parses review payloads', () => {
    expect(
      pluginReviewAddResponseSchema.safeParse({
        review,
        updated: false,
        aggregate,
        file: '.re-shell/plugin-reviews.json',
      }).success
    ).toBe(true);
    expect(
      pluginReviewListResponseSchema.safeParse({ plugin: 'p', reviews: [review], aggregate }).success
    ).toBe(true);
    expect(
      pluginReviewListResponseSchema.safeParse({
        plugin: 'p',
        reviews: [{ ...review, rating: 6 }],
        aggregate,
      }).success
    ).toBe(false);
  });
});

describe('policy pack payload schemas', () => {
  const summary = {
    name: 'acme',
    description: 'ACME policy',
    version: '1.2.0',
    source: 'npm' as const,
    ruleCount: 3,
    package: '@acme/reshell-policy-pack',
    path: '/ws/.re-shell/policy-packs/acme/pack.yml',
    installedAt: '2026-01-01T00:00:00.000Z',
    sha256: 'a'.repeat(64),
  };

  it('parses list/search/install/remove payloads', () => {
    expect(policyListResponseSchema.safeParse({ packs: [summary], total: 1 }).success).toBe(true);
    expect(
      policySearchResponseSchema.safeParse({
        query: 'acme',
        packs: [
          {
            name: '@acme/reshell-policy-pack',
            version: '1.2.0',
            description: 'd',
            keywords: ['reshell-policy-pack'],
            publisher: 'acme',
            date: null,
            homepage: null,
            repository: null,
          },
        ],
        total: 1,
      }).success
    ).toBe(true);
    expect(
      policyInstallResponseSchema.safeParse({
        name: 'acme',
        version: '1.2.0',
        source: 'npm',
        package: '@acme/reshell-policy-pack',
        path: '/p',
        ruleCount: 3,
        replaced: false,
        dryRun: false,
        sha256: 'a'.repeat(64),
        signature: { verified: true, gated: true },
      }).success
    ).toBe(true);
    expect(policyRemoveResponseSchema.safeParse({ name: 'acme', removed: ['/p'] }).success).toBe(true);
    expect(policyListResponseSchema.safeParse({ packs: [{ ...summary, source: 'ftp' }], total: 1 }).success).toBe(
      false
    );
  });
});
