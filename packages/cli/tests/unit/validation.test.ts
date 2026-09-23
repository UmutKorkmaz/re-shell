import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  ConfigurationValidator,
  configValidator,
  GLOBAL_CONFIG_SCHEMA,
  PROJECT_CONFIG_SCHEMA,
  ENVIRONMENT_CONFIG_SCHEMA,
  validateGlobalConfig,
  validateProjectConfig,
  validateConfigFile,
  type ValidationRule,
} from '../../src/utils/validation';

/**
 * Minimal-schema helpers isolate a single rule type so behaviour can be
 * asserted without the cross-talk of the large bundled schemas.
 */
function rule(over: Partial<ValidationRule>): ValidationRule {
  return { field: 'value', type: 'required', message: 'fails', ...over };
}

function run(
  config: unknown,
  r: ValidationRule,
  context = '',
): ReturnType<ConfigurationValidator['validateConfiguration']> {
  return new ConfigurationValidator().validateConfiguration(
    config as Record<string, unknown>,
    [r],
    context,
  );
}

describe('bundled schemas — shape', () => {
  const find = (schema: ValidationRule[], field: string, type: ValidationRule['type']) =>
    schema.find((r) => r.field === field && r.type === type);

  it('GLOBAL_CONFIG_SCHEMA declares the required global fields', () => {
    expect(find(GLOBAL_CONFIG_SCHEMA, 'version', 'required')).toBeDefined();
    expect(find(GLOBAL_CONFIG_SCHEMA, 'packageManager', 'required')).toBeDefined();
    expect(find(GLOBAL_CONFIG_SCHEMA, 'defaultFramework', 'required')).toBeDefined();
    expect(find(GLOBAL_CONFIG_SCHEMA, 'paths.templates', 'required')).toBeDefined();
    expect(find(GLOBAL_CONFIG_SCHEMA, 'paths.cache', 'required')).toBeDefined();
  });

  it('GLOBAL_CONFIG_SCHEMA pins package manager + framework + theme enums', () => {
    expect(find(GLOBAL_CONFIG_SCHEMA, 'packageManager', 'enum')?.details?.allowedValues).toEqual([
      'npm',
      'yarn',
      'pnpm',
      'bun',
    ]);
    expect(find(GLOBAL_CONFIG_SCHEMA, 'defaultFramework', 'enum')?.details?.allowedValues).toEqual([
      'react',
      'react-ts',
      'vue',
      'vue-ts',
      'svelte',
      'svelte-ts',
      'angular',
      'angular-ts',
    ]);
    expect(find(GLOBAL_CONFIG_SCHEMA, 'cli.theme', 'enum')?.details?.allowedValues).toEqual([
      'auto',
      'light',
      'dark',
    ]);
  });

  it('GLOBAL_CONFIG_SCHEMA enforces version semver + registry URL patterns and array/boolean types', () => {
    expect(find(GLOBAL_CONFIG_SCHEMA, 'version', 'pattern')?.details?.pattern?.test('1.2.3')).toBe(
      true,
    );
    expect(find(GLOBAL_CONFIG_SCHEMA, 'version', 'pattern')?.details?.pattern?.test('1.2')).toBe(
      false,
    );
    expect(find(GLOBAL_CONFIG_SCHEMA, 'cli.autoUpdate', 'type')?.details?.expectedType).toBe(
      'boolean',
    );
    expect(find(GLOBAL_CONFIG_SCHEMA, 'plugins.enabled', 'type')?.details?.expectedType).toBe(
      'array',
    );
    expect(
      find(GLOBAL_CONFIG_SCHEMA, 'plugins.marketplace.registry', 'pattern')?.details?.pattern?.test(
        'https://registry.example.com',
      ),
    ).toBe(true);
  });

  it('PROJECT_CONFIG_SCHEMA declares name/version required, type enum and dev.port range', () => {
    expect(find(PROJECT_CONFIG_SCHEMA, 'name', 'required')).toBeDefined();
    expect(find(PROJECT_CONFIG_SCHEMA, 'version', 'required')).toBeDefined();
    expect(find(PROJECT_CONFIG_SCHEMA, 'type', 'enum')?.details?.allowedValues).toEqual([
      'monorepo',
      'standalone',
    ]);
    const port = find(PROJECT_CONFIG_SCHEMA, 'dev.port', 'range');
    expect(port?.details).toMatchObject({ min: 1024, max: 65535 });
  });

  it('PROJECT_CONFIG_SCHEMA environments rule is custom and workspace patterns are array-typed', () => {
    expect(find(PROJECT_CONFIG_SCHEMA, 'environments', 'custom')?.validator).toBeTypeOf('function');
    expect(
      find(PROJECT_CONFIG_SCHEMA, 'environments', 'custom')?.validator?.({ development: {} }),
    ).toBe(true);
    expect(find(PROJECT_CONFIG_SCHEMA, 'environments', 'custom')?.validator?.({})).toBe(false);
    expect(find(PROJECT_CONFIG_SCHEMA, 'workspaces.patterns', 'type')?.details?.expectedType).toBe(
      'array',
    );
  });

  it('ENVIRONMENT_CONFIG_SCHEMA covers name, build mode and deployment provider', () => {
    expect(find(ENVIRONMENT_CONFIG_SCHEMA, 'name', 'required')).toBeDefined();
    expect(find(ENVIRONMENT_CONFIG_SCHEMA, 'build.mode', 'enum')?.details?.allowedValues).toEqual([
      'development',
      'staging',
      'production',
    ]);
    expect(
      find(ENVIRONMENT_CONFIG_SCHEMA, 'deployment.provider', 'enum')?.details?.allowedValues,
    ).toEqual(['vercel', 'netlify', 'aws', 'azure', 'gcp', 'docker', 'custom']);
  });
});

describe('required rule', () => {
  const r = rule({ field: 'name', type: 'required', message: 'name required' });

  it('errors for a missing, null or empty-string value', () => {
    for (const cfg of [{}, { name: null }, { name: '' }]) {
      const res = run(cfg, r);
      expect(res.valid).toBe(false);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0]).toMatchObject({
        field: 'name',
        code: 'REQUIRED_FIELD_MISSING',
        severity: 'error',
        message: 'name required',
      });
    }
  });

  it('passes when a value is present', () => {
    expect(run({ name: 'app' }, r).valid).toBe(true);
  });

  it('emits curated suggestions for known fields and a generic hint otherwise', () => {
    const known = run({}, rule({ field: 'version', type: 'required' }));
    expect(known.errors[0].suggestions).toContain('Use "1.0.0" for new configurations');

    const generic = run({}, rule({ field: 'something.unmapped', type: 'required' }));
    expect(generic.errors[0].suggestions).toEqual([
      'Provide a value for something.unmapped',
    ]);
  });
});

describe('type rule', () => {
  it('flags a non-array value for an array expectation', () => {
    const res = run(
      { value: 'nope' },
      rule({ type: 'type', message: 'must be array', details: { expectedType: 'array' } }),
    );
    expect(res.errors[0]).toMatchObject({ code: 'INVALID_TYPE', expectedValue: 'array' });
    expect(res.errors[0].suggestions).toContain('Use empty array: []');
  });

  it('accepts a real array for an array expectation', () => {
    const res = run(
      { value: ['a', 'b'] },
      rule({ type: 'type', details: { expectedType: 'array' } }),
    );
    expect(res.errors).toHaveLength(0);
  });

  it('flags a string for a boolean expectation with curated suggestions', () => {
    const res = run(
      { value: 'true' },
      rule({ type: 'type', details: { expectedType: 'boolean' } }),
    );
    expect(res.errors[0]).toMatchObject({ code: 'INVALID_TYPE' });
    expect(res.errors[0].suggestions).toContain('Use true or false');
  });

  it('flags a string for a number expectation', () => {
    const res = run(
      { value: '12' },
      rule({ type: 'type', details: { expectedType: 'number' } }),
    );
    expect(res.errors[0].code).toBe('INVALID_TYPE');
  });

  it('skips type checks when the value is undefined or null', () => {
    for (const cfg of [{}, { value: null }]) {
      expect(
        run(cfg, rule({ type: 'type', details: { expectedType: 'boolean' } })).errors,
      ).toHaveLength(0);
    }
  });
});

describe('enum rule', () => {
  const r = rule({
    type: 'enum',
    details: { allowedValues: ['npm', 'yarn', 'pnpm', 'bun'] },
  });

  it('errors on a value outside the allowed set', () => {
    const res = run({ value: 'composer' }, r);
    expect(res.errors[0]).toMatchObject({
      code: 'INVALID_ENUM_VALUE',
      expectedValue: ['npm', 'yarn', 'pnpm', 'bun'],
    });
  });

  it('passes on an allowed value', () => {
    expect(run({ value: 'pnpm' }, r).valid).toBe(true);
  });

  it('suggests close matches via edit-distance similarity', () => {
    // 'npn' is one edit from 'npm' → above the 0.5 similarity threshold.
    const res = run({ value: 'npn' }, r);
    expect(res.errors[0].suggestions?.[0]).toContain('Did you mean: npm?');
  });

  it('falls back to plain "Use: X" hints when nothing is close', () => {
    const res = run({ value: 'zzzzzzzz' }, r);
    expect(res.errors[0].suggestions?.[0]).toBe('Use: npm');
    expect(res.errors[0].suggestions).not.toContain('Did you mean: npm?');
    // The first suggestion should NOT be a "Did you mean" line.
    expect(res.errors[0].suggestions?.some((s) => s.startsWith('Did you mean'))).toBe(false);
  });

  it('skips when undefined or null', () => {
    expect(run({}, r).valid).toBe(true);
  });
});

describe('pattern rule', () => {
  const r = rule({
    field: 'version',
    type: 'pattern',
    details: { pattern: /^\d+\.\d+\.\d+$/ },
  });

  it('errors on a non-matching string', () => {
    const res = run({ version: '1.2' }, r);
    expect(res.errors[0]).toMatchObject({ code: 'PATTERN_MISMATCH' });
    expect(res.errors[0].suggestions).toContain('Use format: 1.0.0');
  });

  it('passes on a matching string', () => {
    expect(run({ version: '1.2.3' }, r).valid).toBe(true);
  });

  it('skips non-string values and undefined/null', () => {
    const v = new ConfigurationValidator();
    const schema = [r];
    expect(v.validateConfiguration({ version: 123 }, schema).errors).toHaveLength(0);
    expect(v.validateConfiguration({}, schema).errors).toHaveLength(0);
  });

  it('uses a generic hint for unmapped pattern fields', () => {
    const res = run(
      { value: 'abc' },
      rule({ type: 'pattern', details: { pattern: /^[0-9]+$/ } }),
    );
    expect(res.errors[0].suggestions).toEqual(['Match pattern: ^[0-9]+$']);
  });
});

describe('range rule', () => {
  const r = rule({ type: 'range', details: { min: 1024, max: 65535 } });

  it('errors below the minimum with a suggestion', () => {
    const res = run({ value: 80 }, r);
    expect(res.errors[0]).toMatchObject({ code: 'VALUE_BELOW_MINIMUM', expectedValue: '>= 1024' });
    expect(res.errors[0].suggestions).toEqual(['Use a value >= 1024']);
  });

  it('errors above the maximum', () => {
    const res = run({ value: 70000 }, r);
    expect(res.errors[0]).toMatchObject({ code: 'VALUE_ABOVE_MAXIMUM', expectedValue: '<= 65535' });
  });

  it('passes inside the range', () => {
    expect(run({ value: 3000 }, r).valid).toBe(true);
  });

  it('honours a lone min or lone max constraint', () => {
    const minOnly = run({ value: -1 }, rule({ type: 'range', details: { min: 0 } }));
    expect(minOnly.errors[0]?.code).toBe('VALUE_BELOW_MINIMUM');
    const maxOnly = run({ value: 200 }, rule({ type: 'range', details: { max: 100 } }));
    expect(maxOnly.errors[0]?.code).toBe('VALUE_ABOVE_MAXIMUM');
  });

  it('ignores non-numeric values', () => {
    expect(run({ value: 'big' }, r).valid).toBe(true);
  });
});

describe('custom rule', () => {
  it('passes when the validator returns true', () => {
    const res = run(
      { value: { a: 1 } },
      rule({ type: 'custom', validator: (v) => v && typeof v === 'object' }),
    );
    expect(res.valid).toBe(true);
  });

  it('fails with CUSTOM_VALIDATION_FAILED when the validator returns false', () => {
    const res = run(
      { value: {} },
      rule({ type: 'custom', field: 'environments', validator: (v) => !!v && Object.keys(v).length > 0 }),
    );
    expect(res.errors[0]).toMatchObject({ code: 'CUSTOM_VALIDATION_FAILED', field: 'environments' });
    expect(res.errors[0].suggestions).toEqual([
      'Add at least one environment (development, staging, or production)',
    ]);
  });

  it('forwards the full config as the second validator argument', () => {
    const seen: unknown[] = [];
    run(
      { value: 1, sibling: 2 },
      rule({ type: 'custom', validator: (v, ctx) => { seen.push(ctx); return true; } }),
    );
    expect(seen[0]).toMatchObject({ value: 1, sibling: 2 });
  });
});

describe('valid flag and field-path prefixing', () => {
  it('reports valid=true only when there are no error-severity errors', () => {
    const v = new ConfigurationValidator();
    const schema = [
      rule({ field: 'a', type: 'required' }),
      rule({ field: 'b', type: 'enum', details: { allowedValues: ['x', 'y'] } }),
    ];
    expect(v.validateConfiguration({ a: 'present', b: 'x' }, schema).valid).toBe(true);
    expect(v.validateConfiguration({ a: 'present', b: 'z' }, schema).valid).toBe(false);
  });

  it('prefixes field paths with the context label', () => {
    const res = run(
      {},
      rule({ field: 'name', type: 'required' }),
      'project',
    );
    expect(res.errors[0].field).toBe('project.name');
  });

  it('leaves field paths unprefixed when no context is supplied', () => {
    const res = run({}, rule({ field: 'name', type: 'required' }));
    expect(res.errors[0].field).toBe('name');
  });
});

describe('contextual validations — global', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'val-global-')); });
  afterEach(() => { fs.removeSync(tmp); });

  it('warns + suggests when a configured path directory does not exist', () => {
    const res = new ConfigurationValidator().validateConfiguration(
      {
        version: '1.0.0',
        packageManager: 'pnpm',
        defaultFramework: 'react-ts',
        paths: { templates: '/no/such/dir/xyz', cache: tmp },
      },
      GLOBAL_CONFIG_SCHEMA,
      'global',
    );
    const warning = res.warnings.find((w) => w.field === 'paths.templates');
    expect(warning?.impact).toBe('medium');
    expect(warning?.message).toContain('Directory does not exist');
    const suggestion = res.suggestions.find((s) => s.field === 'paths.templates');
    expect(suggestion).toMatchObject({ autoFixable: true, autoFixValue: '/no/such/dir/xyz' });
    // The existing cache dir produces no warning.
    expect(res.warnings.find((w) => w.field === 'paths.cache')).toBeUndefined();
  });

  it('suggests verifying a configured plugin registry URL', () => {
    const res = new ConfigurationValidator().validateConfiguration(
      {
        version: '1.0.0',
        packageManager: 'pnpm',
        defaultFramework: 'react-ts',
        paths: { templates: tmp, cache: tmp },
        plugins: { marketplace: { registry: 'https://registry.example.com' } },
      },
      GLOBAL_CONFIG_SCHEMA,
      'global',
    );
    const suggestion = res.suggestions.find((s) => s.field === 'plugins.marketplace.registry');
    expect(suggestion).toMatchObject({ autoFixable: false });
  });
});

describe('contextual validations — project', () => {
  const base = {
    name: 'app',
    version: '1.0.0',
    environments: { development: {}, staging: {}, production: {} },
  };

  it('flags workspace patterns that traverse parent directories', () => {
    const res = new ConfigurationValidator().validateConfiguration(
      { ...base, workspaces: { patterns: ['../sibling/*'] } },
      PROJECT_CONFIG_SCHEMA,
      'project',
    );
    const warning = res.warnings.find((w) => w.field === 'workspaces.patterns');
    expect(warning?.impact).toBe('high');
    expect(warning?.message).toContain('parent directories');
  });

  it('warns about each missing recommended environment', () => {
    const res = new ConfigurationValidator().validateConfiguration(
      { name: 'app', version: '1.0.0', environments: { development: {} } },
      PROJECT_CONFIG_SCHEMA,
      'project',
    );
    const fields = res.warnings.filter((w) => w.field === 'environments').map((w) => w.message);
    expect(fields.some((m) => m.includes('staging'))).toBe(true);
    expect(fields.some((m) => m.includes('production'))).toBe(true);
    expect(fields.some((m) => m.includes('development'))).toBe(false);
  });

  it('warns on commonly used dev ports', () => {
    const res = new ConfigurationValidator().validateConfiguration(
      { ...base, dev: { port: 3000 } },
      PROJECT_CONFIG_SCHEMA,
      'project',
    );
    const warning = res.warnings.find((w) => w.field === 'dev.port');
    expect(warning?.impact).toBe('low');
    expect(warning?.message).toContain('commonly used');
  });
});

describe('convenience wrappers + singleton', () => {
  it('validateGlobalConfig routes through the global context', () => {
    const res = validateGlobalConfig({ version: '1.0.0', packageManager: 'pnpm', defaultFramework: 'react-ts' });
    // Missing paths.templates / paths.cache (required) → invalid.
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'global.paths.templates')).toBe(true);
  });

  it('validateProjectConfig routes through the project context', () => {
    const res = validateProjectConfig({ name: 'Bad Name!', version: 'bad' });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.field === 'project.name')).toBe(true);
    expect(res.errors.some((e) => e.field === 'project.version')).toBe(true);
  });

  it('configValidator is a shared instance', () => {
    expect(configValidator).toBeInstanceOf(ConfigurationValidator);
  });
});

describe('validateConfigFile (file-based)', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'val-file-')); });
  afterEach(() => { fs.removeSync(tmp); });

  it('returns a FILE_NOT_FOUND error when the file is missing', async () => {
    const res = await validateConfigFile(path.join(tmp, 'absent.yaml'), 'global');
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toMatchObject({ field: 'file', code: 'FILE_NOT_FOUND' });
  });

  it('returns a YAML_PARSE_ERROR for malformed YAML', async () => {
    const file = path.join(tmp, 'bad.yaml');
    await fs.writeFile(file, 'version: 1.0.0\n  bad: : indentation\n\ttabs');
    const res = await validateConfigFile(file, 'global');
    expect(res.valid).toBe(false);
    expect(res.errors[0].code).toBe('YAML_PARSE_ERROR');
  });

  it('validates a valid global YAML file against the global schema', async () => {
    const file = path.join(tmp, 'global.yaml');
    await fs.writeFile(
      file,
      [
        'version: 1.0.0',
        'packageManager: pnpm',
        'defaultFramework: react-ts',
        'paths:',
        `  templates: ${os.tmpdir()}`,
        `  cache: ${os.tmpdir()}`,
      ].join('\n'),
    );
    const res = await validateConfigFile(file, 'global');
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('validates a project YAML file against the project schema', async () => {
    const file = path.join(tmp, 'project.yaml');
    await fs.writeFile(
      file,
      ['name: my-app', 'version: 1.0.0', 'type: monorepo', 'environments:', '  development: {}'].join(
        '\n',
      ),
    );
    const res = await validateConfigFile(file, 'project');
    // Valid core fields; contextual warns about missing staging/production but stays valid.
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });
});
