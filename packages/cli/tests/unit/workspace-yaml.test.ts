import { describe, expect, it } from 'vitest';
import * as yaml from 'js-yaml';
import { SCHEMA_URL } from '../../src/constants/brand';
import {
  SCHEMA_MODELINE,
  SCHEMA_NAME_PATTERN,
  WORKSPACE_CONFIG_VERSION,
  dumpWorkspaceYaml,
  preserveSchemaModeline,
  toSchemaName,
  uniqueKey,
} from '../../src/utils/workspace-yaml';
import { validateWorkspaceDocument } from '../../src/utils/schema-generator';

describe('SCHEMA_MODELINE', () => {
  it('is a yaml-language-server modeline for the hosted schema', () => {
    expect(SCHEMA_MODELINE).toBe(`# yaml-language-server: $schema=${SCHEMA_URL}`);
  });
});

describe('toSchemaName', () => {
  it.each([
    ['@acme/Web-App', 'web-app'],
    ['My_Cool Service!!', 'my-cool-service'],
    ['already-valid', 'already-valid'],
    ['UPPER', 'upper'],
    ['--a--b--', 'a-b'],
    ['9lives', '9lives'],
  ])('sanitises %s to %s', (raw, expected) => {
    expect(toSchemaName(raw)).toBe(expected);
    expect(SCHEMA_NAME_PATTERN.test(toSchemaName(raw))).toBe(true);
  });

  it('falls back when nothing valid remains', () => {
    expect(toSchemaName('@scope/')).toBe('service');
    expect(toSchemaName('!!!', 'workspace')).toBe('workspace');
    expect(toSchemaName('', 'my-workspace')).toBe('my-workspace');
  });

  it('caps names at 63 characters without a trailing hyphen', () => {
    const name = toSchemaName(`${'a'.repeat(62)}-b`);
    expect(name.length).toBeLessThanOrEqual(63);
    expect(SCHEMA_NAME_PATTERN.test(name)).toBe(true);
    expect(name.endsWith('-')).toBe(false);
  });
});

describe('uniqueKey', () => {
  it('suffixes collisions and records the chosen key', () => {
    const used = new Set<string>();
    expect(uniqueKey('web', used)).toBe('web');
    expect(uniqueKey('web', used)).toBe('web-2');
    expect(uniqueKey('web', used)).toBe('web-3');
    expect([...used]).toEqual(['web', 'web-2', 'web-3']);
  });

  it('keeps suffixed keys within the 63-character limit', () => {
    const used = new Set<string>();
    const base = 'a'.repeat(63);
    uniqueKey(base, used);
    const second = uniqueKey(base, used);
    expect(second.length).toBeLessThanOrEqual(63);
    expect(SCHEMA_NAME_PATTERN.test(second)).toBe(true);
    expect(second).not.toBe(base);
  });
});

describe('dumpWorkspaceYaml', () => {
  it('starts with the schema modeline and round-trips the document', () => {
    const doc = { name: 'ws', version: WORKSPACE_CONFIG_VERSION, services: {} };
    const text = dumpWorkspaceYaml(doc);
    expect(text.split('\n')[0]).toBe(SCHEMA_MODELINE);
    expect(yaml.load(text)).toEqual(doc);
  });

  it('writes an empty services map as {} (never null)', () => {
    const text = dumpWorkspaceYaml({ name: 'ws', version: '2.0.0', services: {} });
    expect(text).toContain('services: {}');
    expect((yaml.load(text) as { services: unknown }).services).toEqual({});
  });

  it('drops undefined values instead of throwing', () => {
    const text = dumpWorkspaceYaml({ name: 'ws', version: '2.0.0', description: undefined, services: {} });
    expect(text).not.toContain('description');
  });

  it('quotes scalars that would otherwise change meaning', () => {
    const doc = {
      name: 'ws',
      version: '2.0.0',
      description: 'Build: fast # not a comment',
      services: {},
    };
    expect(yaml.load(dumpWorkspaceYaml(doc))).toEqual(doc);
  });

  it('produces a document the v2 schema accepts', () => {
    const doc = yaml.load(dumpWorkspaceYaml({ name: 'ws', version: '2.0.0', services: {} }));
    expect(validateWorkspaceDocument(doc)).toEqual([]);
  });
});

describe('preserveSchemaModeline', () => {
  it('re-attaches the modeline when the original started with one', () => {
    const original = `${SCHEMA_MODELINE}\nname: x\n`;
    expect(preserveSchemaModeline(original, 'name: y\n')).toBe(`${SCHEMA_MODELINE}\nname: y\n`);
  });

  it('keeps a modeline that points at another schema location', () => {
    const line = '# yaml-language-server: $schema=./local.schema.json';
    expect(preserveSchemaModeline(`${line}\nname: x\n`, 'name: y\n')).toBe(`${line}\nname: y\n`);
  });

  it('leaves the dump untouched when there was no modeline', () => {
    expect(preserveSchemaModeline('name: x\n', 'name: y\n')).toBe('name: y\n');
    expect(preserveSchemaModeline('# some other comment\nname: x\n', 'name: y\n')).toBe('name: y\n');
  });
});
