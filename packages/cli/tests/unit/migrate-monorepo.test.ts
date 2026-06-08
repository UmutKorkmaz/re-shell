import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  migrateMonorepo,
  sanitizeServiceName,
  renderWorkspaceYaml,
  type DetectedService,
} from '../../src/commands/migrate-monorepo';
import { validateWorkspaceFile } from '../../src/utils/schema-generator';

const FIXTURES = path.join(__dirname, '..', 'fixtures');

describe('sanitizeServiceName', () => {
  it('strips npm scope and lowercases', () => {
    expect(sanitizeServiceName('@acme/Web-App')).toBe('web-app');
  });

  it('replaces invalid runs with a single hyphen and trims', () => {
    expect(sanitizeServiceName('My_Cool Service!!')).toBe('my-cool-service');
  });

  it('falls back to a safe name when empty after stripping', () => {
    expect(sanitizeServiceName('@scope/')).toBe('service');
  });
});

describe('renderWorkspaceYaml', () => {
  it('de-duplicates colliding sanitized service keys', () => {
    const services: DetectedService[] = [
      {
        originalName: '@a/web',
        name: 'web',
        path: 'apps/a-web',
        type: 'frontend',
        language: 'typescript',
        framework: 'react',
      },
      {
        originalName: '@b/web',
        name: 'web',
        path: 'apps/b-web',
        type: 'frontend',
        language: 'typescript',
        framework: 'react',
      },
    ];
    const doc = yaml.load(renderWorkspaceYaml('ws', 'turbo', services)) as {
      services: Record<string, unknown>;
    };
    expect(Object.keys(doc.services)).toEqual(['web', 'web-2']);
  });
});

async function migrateInTmp(fixture: string, source: 'nx' | 'turbo') {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `migrate-${source}-`));
  await fs.copy(path.join(FIXTURES, fixture), tmpDir);
  const result = await migrateMonorepo({ source, cwd: tmpDir });

  // Write the rendered YAML and validate through the W9a-1 validator.
  const outFile = path.join(tmpDir, 're-shell.workspaces.yaml');
  await fs.writeFile(outFile, result.yaml);
  const validation = await validateWorkspaceFile(outFile);

  return { tmpDir, result, validation };
}

describe('migrateMonorepo --from nx', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('produces a schema-valid v2 workspace with the expected projects', async () => {
    const { tmpDir: dir, result, validation } = await migrateInTmp('nx-sample', 'nx');
    tmpDir = dir;

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);

    const names = result.detected.map(s => s.name).sort();
    expect(names).toEqual(['api-server', 'shared-utils', 'web-app']);

    const byName = Object.fromEntries(result.detected.map(s => [s.name, s]));
    expect(byName['web-app'].type).toBe('frontend');
    expect(byName['web-app'].framework).toBe('next');
    expect(byName['api-server'].type).toBe('backend');
    expect(byName['api-server'].framework).toBe('express');
    expect(byName['shared-utils'].type).toBe('worker');
    expect(byName['shared-utils'].framework).toBe('vanilla');
  });
});

describe('migrateMonorepo --from turbo', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.remove(tmpDir);
  });

  it('produces a schema-valid v2 workspace with the expected packages', async () => {
    const { tmpDir: dir, result, validation } = await migrateInTmp('turbo-sample', 'turbo');
    tmpDir = dir;

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);

    const names = result.detected.map(s => s.name).sort();
    expect(names).toEqual(['checkout-api', 'storefront', 'ui-kit']);

    const byName = Object.fromEntries(result.detected.map(s => [s.name, s]));
    expect(byName['storefront'].type).toBe('frontend');
    expect(byName['storefront'].framework).toBe('next');
    expect(byName['checkout-api'].type).toBe('backend');
    expect(byName['checkout-api'].framework).toBe('fastify');
    expect(byName['ui-kit'].framework).toBe('vanilla');
  });

  it('throws a clear error when turbo.json is missing', async () => {
    const bareDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrate-bare-'));
    tmpDir = bareDir;
    await expect(migrateMonorepo({ source: 'turbo', cwd: bareDir })).rejects.toThrow(
      /turbo\.json not found/
    );
  });
});
