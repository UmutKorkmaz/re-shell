import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generateType,
  capitalize,
  toMethodName,
  toCamelCase,
  generateInterfaces,
  generateClientMethods,
  generateClient,
  generateEnums,
  generateReactQueryHooks,
  listOperations,
  validateSpec,
  generateClientFromSpecFile,
} from '../../src/utils/typescript-client';

/**
 * Unit tests for the TypeScript client generator (OpenAPI/Swagger -> typed client codegen).
 * Covers the pure helper functions, type/interface/method/client generators, the spec
 * validator, operation listing, React Query hook generation, and the spec-file round-trip.
 */

const spec: any = {
  openapi: '3.0.0',
  info: { title: 'Pet Store', version: '1.0.0', description: 'A sample API' },
  servers: [{ url: 'https://api.petstore.com' }],
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        summary: 'List all pets',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
        responses: {
          '200': { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Pet' } } } } },
        },
      },
      post: {
        operationId: 'createPet',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
        responses: {
          '201': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
        },
      },
    },
    '/pets/{petId}': {
      get: {
        operationId: 'getPetById',
        parameters: [{ name: 'petId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        description: 'A pet',
        properties: {
          id: { type: 'integer', description: 'Pet id' },
          name: { type: 'string' },
          status: { $ref: '#/components/schemas/Status' },
          tag: { type: 'string' },
        },
      },
      Status: { enum: ['available', 'pending', 'sold'] },
    },
  },
};

describe('capitalize', () => {
  it('uppercases the first character', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('word')).toBe('Word');
  });

  it('handles empty and single-char strings', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize('a')).toBe('A');
  });
});

describe('toMethodName', () => {
  it('passes through already-camelCase identifiers unchanged', () => {
    expect(toMethodName('listPets')).toBe('listPets');
  });

  it('camelCases kebab-case and dot-separated identifiers', () => {
    expect(toMethodName('get-user-by-id')).toBe('getUserById');
    expect(toMethodName('list_users')).toBe('listUsers');
    expect(toMethodName('getPet.byId')).toBe('getPetById');
  });
});

describe('toCamelCase', () => {
  it('lowercases the first word and uppercases subsequent words, dropping separators', () => {
    expect(toCamelCase('Pet Store')).toBe('petStore');
    expect(toCamelCase('my-api')).toBe('myApi');
    expect(toCamelCase('user_name')).toBe('userName');
  });
});

describe('generateType', () => {
  it('maps primitives and integer to number, formats stay string', () => {
    expect(generateType({ type: 'string' })).toBe('string');
    expect(generateType({ type: 'integer' })).toBe('number');
    expect(generateType({ type: 'boolean' })).toBe('boolean');
    expect(generateType({ type: 'string', format: 'date-time' })).toBe('string');
  });

  it('resolves $ref to the referenced type name', () => {
    expect(generateType({ $ref: '#/components/schemas/Pet' })).toBe('Pet');
  });

  it('renders enums as a union of literals (strings quoted, numbers bare)', () => {
    expect(generateType({ enum: ['active', 'inactive'] })).toBe("'active' | 'inactive'");
    expect(generateType({ enum: [1, 2, 3] })).toBe('1 | 2 | 3');
  });

  it('composes allOf/oneOf/anyOf', () => {
    expect(generateType({ allOf: [{ type: 'string' }, { type: 'number' }] })).toBe('(string & number)');
    expect(generateType({ oneOf: [{ type: 'string' }, { type: 'number' }] })).toBe('(string | number)');
    expect(generateType({ anyOf: [{ type: 'string' }, { type: 'boolean' }] })).toBe('(string | boolean)');
  });

  it('renders arrays and empty objects', () => {
    expect(generateType({ type: 'array', items: { type: 'string' } })).toBe('string[]');
    expect(generateType({ type: 'object' })).toBe('Record<string, unknown>');
  });

  it('renders object properties with required/optional markers', () => {
    const out = generateType({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' }, age: { type: 'integer' } },
    });
    expect(out).toContain('{');
    expect(out).toContain('  name: string;');
    expect(out).toContain('  age?: number;');
  });

  it('returns unknown for a schema with no resolvable type', () => {
    expect(generateType({})).toBe('unknown');
  });
});

describe('generateInterfaces', () => {
  it('emits interfaces with required/optional props, descriptions, and enum type aliases', () => {
    const code = generateInterfaces(spec);
    expect(code).toContain('// Auto-generated TypeScript types from OpenAPI specification');
    expect(code).toContain('// Pet Store v1.0.0');
    expect(code).toContain('export interface RequestConfig {');
    expect(code).toContain('export interface Pet {');
    expect(code).toContain('  /** A pet */');
    expect(code).toContain('  id: number; /** Pet id */');
    expect(code).toContain('  name: string;');
    expect(code).toContain('  tag?: string;');
    expect(code).toContain("export type Status = 'available' | 'pending' | 'sold';");
  });

  it('falls back to an index signature when a schema has no properties', () => {
    const code = generateInterfaces({
      openapi: '3.0.0',
      info: { title: 'Empty', version: '1.0.0' },
      paths: {},
      components: { schemas: { Empty: { type: 'object' } } },
    });
    expect(code).toContain('export interface Empty {');
    expect(code).toContain('  [key: string]: unknown;');
  });
});

describe('generateClientMethods', () => {
  it('generates a GET method with query params, URLSearchParams and fetch (default)', () => {
    const code = generateClientMethods(spec, {});
    expect(code).toContain('async listPets(');
    expect(code).toContain('query?: {');
    expect(code).toContain('    limit?: number;');
    expect(code).toContain('Promise<Pet[]>');
    expect(code).toContain('const queryString = new URLSearchParams();');
    expect(code).toContain("fetch(fullUrl, {");
  });

  it('generates a POST method with a typed body and uses axios when useAxios is set', () => {
    const code = generateClientMethods(spec, { useAxios: true });
    expect(code).toContain('async createPet(');
    expect(code).toContain('body: Pet;');
    expect(code).toContain('Promise<Pet>');
    expect(code).toContain('this.axios.post(');
  });

  it('substitutes path parameters via encodeURIComponent', () => {
    const code = generateClientMethods(spec, {});
    expect(code).toContain('async getPetById(');
    expect(code).toContain('  petId: string;');
    expect(code).toContain(".replace('{petId}', encodeURIComponent(String(params.petId)))");
  });
});

describe('generateClient', () => {
  it('builds a client class with a camelCased name derived from the spec title and the server base URL', () => {
    const code = generateClient(spec, {});
    expect(code).toContain('export class petStoreClient {');
    expect(code).toContain("this.baseUrl = config?.baseUrl || 'https://api.petstore.com';");
    expect(code).toContain('private buildUrl(path: string): string {');
    // No axios import by default.
    expect(code).toContain('// Using native fetch API');
  });

  it('emits the axios import and instance when useAxios is set', () => {
    const code = generateClient(spec, { useAxios: true });
    expect(code).toContain("import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';");
    expect(code).toContain('private axios: AxiosInstance;');
  });
});

describe('generateEnums', () => {
  it('emits a TypeScript enum with uppercased keys for each enum schema', () => {
    const code = generateEnums(spec);
    expect(code).toContain('export enum Status {');
    expect(code).toContain("  AVAILABLE = 'available',");
    expect(code).toContain("  SOLD = 'sold',");
  });
});

describe('listOperations', () => {
  it('lists every operation with its derived id, method, path and description', () => {
    const ops = listOperations(spec);
    expect(ops).toHaveLength(3);
    const ids = ops.map(o => o.operationId);
    expect(ids).toEqual(expect.arrayContaining(['listPets', 'createPet', 'getPetById']));
    const get = ops.find(o => o.operationId === 'listPets')!;
    expect(get.method).toBe('GET');
    expect(get.path).toBe('/pets');
    expect(get.description).toBe('List all pets');
  });
});

describe('validateSpec', () => {
  it('accepts a well-formed OpenAPI spec', () => {
    const result = validateSpec(spec);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports every missing required field for an empty object', () => {
    const result = validateSpec({});
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Spec must have either "openapi" or "swagger" field',
      'Spec must have an "info" object',
      'Spec must have "paths" object',
    ]));
  });

  it('rejects non-object input outright', () => {
    const result = validateSpec(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Spec must be an object']);
  });
});

describe('generateReactQueryHooks', () => {
  it('generates useQuery hooks for GET/HEAD and useMutation hooks for other methods', () => {
    const code = generateReactQueryHooks(spec, 'PetClient');
    expect(code).toContain("import { useMutation, useQuery, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';");
    expect(code).toContain("import { PetClient } from './client';");
    // GET -> query hook. NOTE: hook name is `use` + toMethodName(opId); since
    // toMethodName keeps the first word verbatim, 'listPets' stays lower-cased
    // after the `use` prefix (i.e. `uselistPets`, not `useListPets`).
    expect(code).toContain('export function uselistPets(');
    expect(code).toContain('queryKey: [\'listPets\', params]');
    // POST -> mutation hook
    expect(code).toContain('export function usecreatePetMutation(');
    expect(code).toContain('mutationFn: (params) => client.createPet(params)');
  });
});

describe('generateClientFromSpecFile', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsc-client-'));
  });
  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('reads a JSON spec from disk and writes a generated client to the output path', async () => {
    const specPath = path.join(tmpDir, 'spec.json');
    const outputPath = path.join(tmpDir, 'out', 'client.ts');
    await fs.writeJson(specPath, spec);

    await generateClientFromSpecFile(specPath, outputPath, { clientName: 'PetStoreClient' });

    const generated = await fs.readFile(outputPath, 'utf-8');
    expect(generated).toContain('export class PetStoreClient {');
    // Default option useAxios is true.
    expect(generated).toContain("import axios");
    // Methods are generated from the spec paths.
    expect(generated).toContain('async listPets(');
  });
});
