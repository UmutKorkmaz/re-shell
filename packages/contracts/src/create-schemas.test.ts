import { describe, it, expect } from 'vitest';
import {
  createDryRunResponseSchema,
  createModeSchema,
  createResponseSchema,
  errorCodeSchema,
  jsonResponseSchema,
  scaffoldFileSchema,
} from './index.js';

/**
 * Wire-contract tests for `re-shell create` (S-D): the dry-run payload that
 * reports an exact file set classified against an existing target, the real-run
 * payload, and the error codes the create command may emit.
 */
describe('createModeSchema', () => {
  it('accepts every scaffold mode and rejects unknown ones', () => {
    for (const mode of ['frontend', 'backend', 'fullstack', 'microfrontend', 'polyglot', 'skeleton']) {
      expect(createModeSchema.safeParse(mode).success).toBe(true);
    }
    expect(createModeSchema.safeParse('monolith').success).toBe(false);
  });
});

describe('scaffoldFileSchema', () => {
  it('parses an added file without a diff', () => {
    const parsed = scaffoldFileSchema.safeParse({
      path: 'apps/web/package.json',
      bytes: 120,
      action: 'create',
      status: 'added',
    });
    expect(parsed.success).toBe(true);
  });

  it('parses a modified file carrying a unified diff', () => {
    const parsed = scaffoldFileSchema.safeParse({
      path: 'apps/web/src/App.tsx',
      bytes: 300,
      action: 'overwrite',
      status: 'modified',
      diff: '--- a/apps/web/src/App.tsx\n+++ b/apps/web/src/App.tsx\n@@ -1 +1 @@\n-old\n+new\n',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a status outside added/modified/unchanged', () => {
    const parsed = scaffoldFileSchema.safeParse({
      path: 'x',
      bytes: 1,
      action: 'create',
      status: 'deleted',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('createDryRunResponseSchema', () => {
  const payload = {
    project: 'web',
    mode: 'frontend',
    templateId: 'react-ts',
    frontend: 'react-ts',
    dryRun: true,
    root: '/tmp/work',
    targetExists: true,
    files: [
      { path: 'web/package.json', bytes: 10, action: 'create', status: 'added' },
      { path: 'web/README.md', bytes: 5, action: 'unchanged', status: 'unchanged' },
      {
        path: 'web/index.html',
        bytes: 8,
        action: 'overwrite',
        status: 'modified',
        diff: '--- a/web/index.html\n+++ b/web/index.html\n',
      },
    ],
    totalBytes: 23,
    previews: { 'web/package.json': '{}' },
    summary: { added: 1, modified: 1, unchanged: 1 },
    notes: [],
  };

  it('parses a full dry-run payload', () => {
    expect(createDryRunResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('requires dryRun to be the literal true', () => {
    expect(createDryRunResponseSchema.safeParse({ ...payload, dryRun: false }).success).toBe(false);
  });

  it('round-trips inside the canonical json envelope', () => {
    const schema = jsonResponseSchema(createDryRunResponseSchema);
    expect(schema.safeParse({ ok: true, data: payload, warnings: [] }).success).toBe(true);
  });
});

describe('createResponseSchema', () => {
  it('parses a real-run payload for a skeleton', () => {
    const parsed = createResponseSchema.safeParse({
      project: 'blank',
      mode: 'skeleton',
      dryRun: false,
      root: '/tmp/work',
      projectPath: '/tmp/work/blank',
      skeleton: true,
      files: ['blank/package.json'],
      nextSteps: ['cd blank'],
      notes: [],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('create error codes', () => {
  it('includes the S-D create codes and the template lookup code', () => {
    for (const code of [
      'CREATE_ERROR',
      'CREATE_INVALID_OPTIONS',
      'CREATE_INPUT_REQUIRED',
      'CREATE_TARGET_EXISTS',
      'TEMPLATE_NOT_FOUND',
    ]) {
      expect(errorCodeSchema.safeParse(code).success).toBe(true);
    }
  });
});
