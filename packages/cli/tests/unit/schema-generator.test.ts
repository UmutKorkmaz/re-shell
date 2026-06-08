import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import Ajv from 'ajv';
import {
  validateWorkspaceFile,
  getIdeSchema,
  getWorkspaceSchema,
  SCHEMA_ID,
} from '../../src/utils/schema-generator';

/**
 * A minimal but complete v2 workspace that satisfies the canonical schema:
 * required top-level fields (name, version, services) plus a service with its
 * own required fields (name, language, framework).
 */
const VALID_WORKSPACE = `
name: my-workspace
version: 2.0.0
services:
  api:
    name: api
    language: typescript
    framework: express
`;

describe('schema-generator: real ajv validation (v2)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-gen-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  async function write(name: string, content: string): Promise<string> {
    const file = path.join(tmpDir, name);
    await fs.writeFile(file, content, 'utf8');
    return file;
  }

  it('accepts a valid v2 workspace', async () => {
    const file = await write('workspace.yaml', VALID_WORKSPACE);
    const result = await validateWorkspaceFile(file);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('rejects a workspace missing a required top-level field with field-level errors', async () => {
    // Missing `services` (required).
    const file = await write(
      'workspace.yaml',
      'name: my-workspace\nversion: 2.0.0\n'
    );
    const result = await validateWorkspaceFile(file);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // ajv reports required-property failures at the parent instancePath ('').
    const messages = result.errors.map(e => e.message).join(' ');
    expect(messages).toContain('services');
    for (const err of result.errors) {
      expect(err).toHaveProperty('instancePath');
      expect(err).toHaveProperty('message');
    }
  });

  it('rejects a workspace with a wrong-typed field, pointing at the offending path', async () => {
    // `version` should be a string matching ^2\.0\.[0-9]+$, give it a number.
    const file = await write(
      'workspace.yaml',
      'name: my-workspace\nversion: 2\nservices: {}\n'
    );
    const result = await validateWorkspaceFile(file);

    expect(result.valid).toBe(false);
    const versionError = result.errors.find(e => e.instancePath === '/version');
    expect(versionError).toBeDefined();
  });

  it('rejects a service missing its required fields', async () => {
    const file = await write(
      'workspace.yaml',
      'name: my-workspace\nversion: 2.0.0\nservices:\n  api:\n    name: api\n'
    );
    const result = await validateWorkspaceFile(file);

    expect(result.valid).toBe(false);
    const messages = result.errors.map(e => e.message).join(' ');
    expect(messages).toContain('language');
  });

  it('reports a structured error for a missing file', async () => {
    const result = await validateWorkspaceFile(
      path.join(tmpDir, 'does-not-exist.yaml')
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('File not found');
  });

  it('warns on non-yaml extension but still validates content', async () => {
    const file = await write('workspace.txt', VALID_WORKSPACE);
    const result = await validateWorkspaceFile(file);

    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      'File should have .yaml or .yml extension'
    );
  });
});

describe('schema-generator: IDE-autocomplete schema', () => {
  it('emits a v2 schema with an owned $id and draft-07 $schema', () => {
    const schema = getIdeSchema();
    expect(schema.$id).toBe(SCHEMA_ID);
    expect(schema.$id).not.toContain('re-shell.dev');
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect((schema as { required?: string[] }).required).toEqual([
      'name',
      'version',
      'services',
    ]);
  });

  it('produces a schema that ajv can compile (valid JSON Schema)', () => {
    const schema = getIdeSchema();
    const ajv = new Ajv({ strict: false, validateFormats: false });
    expect(() => ajv.compile(schema)).not.toThrow();
  });

  it('serializes to parseable JSON', () => {
    const json = JSON.stringify(getIdeSchema());
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.title).toContain('Re-Shell Workspace');
  });

  it('shares the canonical v2 schema as its base', () => {
    const base = getWorkspaceSchema();
    expect((base as { $id?: string }).$id).toBeDefined();
    expect((base as { required?: string[] }).required).toContain('services');
  });
});
