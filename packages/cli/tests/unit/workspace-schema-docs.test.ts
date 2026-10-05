import { describe, expect, it } from 'vitest';
import schema from '../../src/schemas/workspace-v2.schema.json';

// IDE hover (yaml-language-server) shows `title`/`description`. These tests keep
// the canonical v2 schema documented, so hovering a key never shows nothing.

type Node = { description?: string; $ref?: string; properties?: Record<string, Node> };
const definitions = (schema as unknown as { definitions: Record<string, Node> }).definitions;

/** Description for a property, following a local `$ref` (draft-07 ignores siblings of `$ref`). */
function describe_(node: Node): string | undefined {
  if (node.description) return node.description;
  if (node.$ref) {
    const name = node.$ref.replace('#/definitions/', '');
    return definitions[name]?.description;
  }
  return undefined;
}

function undocumented(props: Record<string, Node> | undefined, prefix: string): string[] {
  return Object.entries(props ?? {})
    .filter(([, node]) => !describe_(node)?.trim())
    .map(([key]) => `${prefix}${key}`);
}

describe('canonical v2 schema documentation', () => {
  it('declares draft-07, a descriptive title and a document-level description', () => {
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.title).toContain('re-shell.workspaces.yaml');
    expect(schema.description.length).toBeGreaterThan(80);
    expect(schema.description).toContain('services');
  });

  it('requires exactly what every writer produces: name, version, services', () => {
    expect(schema.required).toEqual(['name', 'version', 'services']);
  });

  it('documents every top-level property', () => {
    expect(undocumented((schema as unknown as { properties: Record<string, Node> }).properties, '')).toEqual([]);
  });

  it('documents every service property', () => {
    expect(undocumented(definitions.service.properties, 'services.*.')).toEqual([]);
  });

  it('documents every definition', () => {
    const missing = Object.entries(definitions)
      .filter(([, node]) => !node.description?.trim())
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('explains the version and name constraints in plain words', () => {
    const props = (schema as unknown as { properties: Record<string, Node & { examples?: string[] }> }).properties;
    expect(props.version.description).toContain('2.0.x');
    expect(props.version.examples).toEqual(['2.0.0']);
    expect(props.name.description).toContain('kebab-case');
  });
});
