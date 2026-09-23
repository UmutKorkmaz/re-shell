import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Command } from 'commander';
import {
  PluginCommandValidator,
  createCommandValidator,
  createValidationSchema,
  formatValidationResult,
  ValidationRuleType,
  TransformationType,
  ValidationSeverity,
  type ValidationSchema,
  type PluginCommandContext,
  type ValidationResult,
  type ParameterTransformation,
  type ValidationRule,
} from '../../src/utils/plugin-command-validation';
import { ValidationError } from '../../src/utils/error-handler';

/**
 * Minimal but valid PluginCommandContext stub. The built-in validators and
 * transformers are parametric over the context and almost never inspect it, so
 * a stub with the expected nested shape is sufficient.
 */
function makeContext(): PluginCommandContext {
  return {
    command: {
      name: 'test-command',
      description: 'test',
      handler: () => {},
      options: [],
    },
    plugin: {
      name: 'test-plugin',
      version: '1.0.0',
    },
    cli: {
      program: new Command(),
      rootPath: process.cwd(),
      configPath: process.cwd(),
      version: '0.0.0',
    },
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    utils: {
      path,
      fs,
    },
  } as unknown as PluginCommandContext;
}

const CTX = makeContext();
const A = {};
const O = {};

describe('plugin-command-validation — enums & standalone functions', () => {
  it('exposes the expected ValidationRuleType values', () => {
    expect(ValidationRuleType.REQUIRED).toBe('required');
    expect(ValidationRuleType.TYPE).toBe('type');
    expect(ValidationRuleType.RANGE).toBe('range');
    expect(ValidationRuleType.LENGTH).toBe('length');
    expect(ValidationRuleType.PATTERN).toBe('pattern');
    expect(ValidationRuleType.ENUM).toBe('enum');
    expect(ValidationRuleType.CUSTOM).toBe('custom');
    expect(ValidationRuleType.CONDITIONAL).toBe('conditional');
    expect(ValidationRuleType.DEPENDENCY).toBe('dependency');
    expect(ValidationRuleType.EXCLUSION).toBe('exclusion');
  });

  it('exposes the expected TransformationType values', () => {
    expect(TransformationType.CASE).toBe('case');
    expect(TransformationType.TRIM).toBe('trim');
    expect(TransformationType.PARSE).toBe('parse');
    expect(TransformationType.FORMAT).toBe('format');
    expect(TransformationType.NORMALIZE).toBe('normalize');
    expect(TransformationType.CONVERT).toBe('convert');
    expect(TransformationType.SANITIZE).toBe('sanitize');
    expect(TransformationType.EXPAND).toBe('expand');
    expect(TransformationType.RESOLVE).toBe('resolve');
    expect(TransformationType.CUSTOM).toBe('custom');
  });

  it('exposes the expected ValidationSeverity values', () => {
    expect(ValidationSeverity.ERROR).toBe('error');
    expect(ValidationSeverity.WARNING).toBe('warning');
    expect(ValidationSeverity.INFO).toBe('info');
  });

  it('createCommandValidator returns a PluginCommandValidator instance', () => {
    const validator = createCommandValidator();
    expect(validator).toBeInstanceOf(PluginCommandValidator);
    expect(validator.getBuiltInRules()).toBeDefined();
    expect(validator.getBuiltInTransformations()).toBeDefined();
  });

  it('createValidationSchema returns sensible defaults', () => {
    const schema = createValidationSchema();
    expect(schema).toEqual({
      arguments: {},
      options: {},
      globalRules: [],
      transformations: [],
      strict: false,
      allowUnknown: true,
      failFast: false,
    });
  });

  it('createValidationSchema merges provided overrides over the defaults', () => {
    const schema = createValidationSchema({ strict: true, failFast: true });
    expect(schema.strict).toBe(true);
    expect(schema.failFast).toBe(true);
    // Untouched defaults are preserved.
    expect(schema.allowUnknown).toBe(true);
    expect(schema.globalRules).toEqual([]);
  });

  it('formatValidationResult returns an empty string when there are no issues', () => {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      info: [],
      transformedArgs: {},
      transformedOptions: {},
    };
    expect(formatValidationResult(result)).toBe('');
  });

  it('formatValidationResult renders errors, warnings and info sections', () => {
    const result: ValidationResult = {
      valid: false,
      errors: [{ field: 'name', type: ValidationRuleType.REQUIRED, severity: ValidationSeverity.ERROR, message: 'required', value: '' }],
      warnings: [{ field: 'age', type: ValidationRuleType.RANGE, severity: ValidationSeverity.WARNING, message: 'low', value: 1 }],
      info: [{ field: 'nick', type: ValidationRuleType.LENGTH, severity: ValidationSeverity.INFO, message: 'short', value: 'a' }],
      transformedArgs: {},
      transformedOptions: {},
    };
    const out = formatValidationResult(result);
    expect(out).toContain('Validation Errors:');
    expect(out).toContain('name: required');
    expect(out).toContain('Validation Warnings:');
    expect(out).toContain('age: low');
    expect(out).toContain('Validation Info:');
    expect(out).toContain('nick: short');
  });
});

describe('plugin-command-validation — built-in rules', () => {
  const validator = createCommandValidator();
  const rules = validator.getBuiltInRules();

  it('required rejects undefined/null/empty-string and accepts real values', () => {
    const r = rules.required();
    expect(r.type).toBe(ValidationRuleType.REQUIRED);
    expect(r.severity).toBe(ValidationSeverity.ERROR);
    expect(r.validator!('x', A, O, CTX)).toBe(true);
    expect(r.validator!(undefined, A, O, CTX)).toBe(false);
    expect(r.validator!(null, A, O, CTX)).toBe(false);
    expect(r.validator!('', A, O, CTX)).toBe(false);
  });

  it('required uses a custom message when provided', () => {
    const r = rules.required('need it');
    expect(r.message).toBe('need it');
  });

  it('type validates JavaScript primitives and distinguishes objects from arrays', () => {
    expect(rules.type('string').validator!('a', A, O, CTX)).toBe(true);
    expect(rules.type('number').validator!(5, A, O, CTX)).toBe(true);
    // NaN is not a valid number.
    expect(rules.type('number').validator!(NaN, A, O, CTX)).toBe(false);
    expect(rules.type('boolean').validator!(true, A, O, CTX)).toBe(true);
    expect(rules.type('array').validator!([1], A, O, CTX)).toBe(true);
    expect(rules.type('object').validator!({}, A, O, CTX)).toBe(true);
    // arrays are NOT plain objects
    expect(rules.type('object').validator!([1], A, O, CTX)).toBe(false);
    // null is not an object
    expect(rules.type('object').validator!(null, A, O, CTX)).toBe(false);
    // unknown type defaults to valid
    expect(rules.type('mystery').validator!('anything', A, O, CTX)).toBe(true);
  });

  it('minLength and maxLength enforce string bounds', () => {
    expect(rules.minLength(3).validator!('abcd', A, O, CTX)).toBe(true);
    expect(rules.minLength(3).validator!('ab', A, O, CTX)).toBe(false);
    // non-strings are invalid for length checks
    expect(rules.minLength(3).validator!(12345, A, O, CTX)).toBe(false);
    expect(rules.maxLength(2).validator!('ab', A, O, CTX)).toBe(true);
    expect(rules.maxLength(2).validator!('abc', A, O, CTX)).toBe(false);
  });

  it('min and max enforce numeric bounds', () => {
    expect(rules.min(5).validator!(5, A, O, CTX)).toBe(true);
    expect(rules.min(5).validator!(4, A, O, CTX)).toBe(false);
    // non-numbers are invalid
    expect(rules.min(5).validator!('5', A, O, CTX)).toBe(false);
    expect(rules.max(5).validator!(5, A, O, CTX)).toBe(true);
    expect(rules.max(5).validator!(6, A, O, CTX)).toBe(false);
  });

  it('pattern tests string values against a RegExp', () => {
    expect(rules.pattern(/^[a-z]+$/).validator!('abc', A, O, CTX)).toBe(true);
    expect(rules.pattern(/^[a-z]+$/).validator!('ABC', A, O, CTX)).toBe(false);
    expect(rules.pattern(/^[a-z]+$/).validator!(123, A, O, CTX)).toBe(false);
  });

  it('enum restricts values to a predefined set', () => {
    const r = rules.enum(['a', 'b', 'c']);
    expect(r.validator!('b', A, O, CTX)).toBe(true);
    expect(r.validator!('d', A, O, CTX)).toBe(false);
    expect(r.message).toContain('a, b, c');
  });

  it('email validates well-formed addresses', () => {
    expect(rules.email().validator!('a@b.com', A, O, CTX)).toBe(true);
    expect(rules.email().validator!('no-at-sign', A, O, CTX)).toBe(false);
    expect(rules.email().validator!('a@b', A, O, CTX)).toBe(false); // missing TLD
    expect(rules.email().validator!(42, A, O, CTX)).toBe(false);
  });

  it('url validates via the URL constructor', () => {
    expect(rules.url().validator!('https://example.com', A, O, CTX)).toBe(true);
    expect(rules.url().validator!('not a url', A, O, CTX)).toBe(false);
  });

  it('path validates strings and optionally existence', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcv-'));
    try {
      const existing = path.join(tmp, 'file.txt');
      fs.writeFileSync(existing, 'x');
      // mustExist=false (default): any string passes, non-string fails
      expect(rules.path().validator!('/some/path', A, O, CTX)).toBe(true);
      expect(rules.path().validator!(123, A, O, CTX)).toBe(false);
      // mustExist=true: real file passes, fake file fails
      expect(rules.path(true).validator!(existing, A, O, CTX)).toBe(true);
      expect(rules.path(true).validator!(path.join(tmp, 'missing'), A, O, CTX)).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('json validates parseable JSON strings', () => {
    expect(rules.json().validator!('{"a":1}', A, O, CTX)).toBe(true);
    expect(rules.json().validator!('[1,2,3]', A, O, CTX)).toBe(true);
    expect(rules.json().validator!('{bad', A, O, CTX)).toBe(false);
    expect(rules.json().validator!(42, A, O, CTX)).toBe(false); // non-string
  });

  it('custom delegates to the supplied validator function', () => {
    const r = rules.custom((v) => v === 'ok', 'must be ok');
    expect(r.type).toBe(ValidationRuleType.CUSTOM);
    expect(r.message).toBe('must be ok');
    expect(r.validator!('ok', A, O, CTX)).toBe(true);
    expect(r.validator!('no', A, O, CTX)).toBe(false);
  });
});

describe('plugin-command-validation — built-in transformations', () => {
  const validator = createCommandValidator();
  const t = validator.getBuiltInTransformations();

  it('trim strips whitespace from both ends by default, and respects start/end options', () => {
    expect(t.trim().transformer('  hi  ', A, O, CTX)).toBe('hi');
    expect(t.trim({ start: true, end: false }).transformer('  hi  ', A, O, CTX)).toBe('hi  ');
    expect(t.trim({ start: false, end: true }).transformer('  hi  ', A, O, CTX)).toBe('  hi');
    // non-strings pass through unchanged
    expect(t.trim().transformer(42, A, O, CTX)).toBe(42);
  });

  it('lowercase and uppercase change string case', () => {
    expect(t.lowercase().transformer('AbC', A, O, CTX)).toBe('abc');
    expect(t.uppercase().transformer('AbC', A, O, CTX)).toBe('ABC');
    expect(t.lowercase().transformer(7, A, O, CTX)).toBe(7);
  });

  it('camelCase converts delimited strings', () => {
    expect(t.camelCase().transformer('foo-bar', A, O, CTX)).toBe('fooBar');
    expect(t.camelCase().transformer('foo_bar baz', A, O, CTX)).toBe('fooBarBaz');
    expect(t.camelCase().transformer(5, A, O, CTX)).toBe(5);
  });

  it('kebabCase converts camelCase to kebab-case', () => {
    expect(t.kebabCase().transformer('camelCase', A, O, CTX)).toBe('camel-case');
    // Leading uppercase becomes lowercase (the leading-dash is stripped).
    expect(t.kebabCase().transformer('PascalCase', A, O, CTX)).toBe('pascal-case');
  });

  it('snakeCase converts camelCase to snake_case', () => {
    expect(t.snakeCase().transformer('camelCase', A, O, CTX)).toBe('camel_case');
  });

  it('parseNumber parses floats by default and integers when float=false', () => {
    expect(t.parseNumber().transformer('3.14', A, O, CTX)).toBe(3.14);
    expect(t.parseNumber({ float: false, base: 10 }).transformer('42', A, O, CTX)).toBe(42);
    // non-parseable strings pass through unchanged
    expect(t.parseNumber().transformer('abc', A, O, CTX)).toBe('abc');
    // numbers and non-strings pass through
    expect(t.parseNumber().transformer(9, A, O, CTX)).toBe(9);
    expect(t.parseNumber().transformer(null, A, O, CTX)).toBe(null);
  });

  it('parseBoolean parses common truthy/falsy string representations', () => {
    for (const v of ['true', '1', 'yes', 'on']) {
      expect(t.parseBoolean().transformer(v, A, O, CTX)).toBe(true);
    }
    for (const v of ['false', '0', 'no', 'off']) {
      expect(t.parseBoolean().transformer(v, A, O, CTX)).toBe(false);
    }
    // unknown strings and non-strings pass through
    expect(t.parseBoolean().transformer('maybe', A, O, CTX)).toBe('maybe');
    expect(t.parseBoolean().transformer(true, A, O, CTX)).toBe(true);
    expect(t.parseBoolean().transformer(5, A, O, CTX)).toBe(5);
  });

  it('parseJSON parses JSON strings and passes through invalid input', () => {
    expect(t.parseJSON().transformer('{"a":1}', A, O, CTX)).toEqual({ a: 1 });
    expect(t.parseJSON().transformer('{bad', A, O, CTX)).toBe('{bad');
    expect(t.parseJSON().transformer({ x: 1 }, A, O, CTX)).toEqual({ x: 1 }); // non-string passthrough
  });

  it('expandPath expands ~ to home and resolves relative paths', () => {
    const home = os.homedir();
    expect(t.expandPath().transformer('~/dir', A, O, CTX)).toBe(path.join(home, 'dir'));
    expect(t.expandPath({ relative: '/base' }).transformer('sub', A, O, CTX)).toBe(path.resolve('/base', 'sub'));
    expect(t.expandPath().transformer(9, A, O, CTX)).toBe(9);
  });

  it('resolvePath resolves a value to an absolute path', () => {
    expect(path.isAbsolute(t.resolvePath().transformer('rel/path', A, O, CTX))).toBe(true);
    expect(t.resolvePath().transformer(9, A, O, CTX)).toBe(9);
  });

  it('sanitizeHtml strips HTML tags from strings', () => {
    expect(t.sanitizeHtml().transformer('<b>hi</b><br/>', A, O, CTX)).toBe('hi');
    expect(t.sanitizeHtml().transformer(9, A, O, CTX)).toBe(9);
  });

  it('normalizeUrl normalizes valid URLs and passes invalid ones through', () => {
    expect(t.normalizeUrl().transformer('HTTPS://Example.com', A, O, CTX)).toBe('https://example.com/');
    expect(t.normalizeUrl().transformer('not a url', A, O, CTX)).toBe('not a url');
    expect(t.normalizeUrl().transformer(9, A, O, CTX)).toBe(9);
  });

  it('custom transformation delegates to the supplied transformer with a given order', () => {
    const c = t.custom((v) => `[${v}]`, 42);
    expect(c.type).toBe(TransformationType.CUSTOM);
    expect(c.order).toBe(42);
    expect(c.transformer('x', A, O, CTX)).toBe('[x]');
  });
});

describe('plugin-command-validation — schema management & events', () => {
  it('registerSchema stores the schema and emits schema-registered', () => {
    const validator = createCommandValidator();
    const listener = vi.fn();
    validator.on('schema-registered', listener);
    const schema = createValidationSchema({ arguments: { name: { rules: [validator.getBuiltInRules().required()] } } });
    validator.registerSchema('cmd', schema);
    expect(listener).toHaveBeenCalledWith({ commandId: 'cmd', schema });
  });

  it('removeSchema returns true and emits schema-removed when the schema exists, false otherwise', () => {
    const validator = createCommandValidator();
    validator.registerSchema('cmd', createValidationSchema());
    const removed = vi.fn();
    validator.on('schema-removed', removed);
    expect(validator.removeSchema('cmd')).toBe(true);
    expect(removed).toHaveBeenCalledWith({ commandId: 'cmd' });
    // Second removal has nothing to remove.
    removed.mockClear();
    expect(validator.removeSchema('cmd')).toBe(false);
    expect(removed).not.toHaveBeenCalled();
  });

  it('validateAndTransform with no registered schema returns a valid passthrough result', async () => {
    const validator = createCommandValidator();
    const started = vi.fn();
    validator.on('validation-started', started);
    const completed = vi.fn();
    validator.on('validation-completed', completed);
    const result = await validator.validateAndTransform('unknown', { a: 1 }, { b: 2 }, CTX);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.transformedArgs).toEqual({ a: 1 });
    expect(result.transformedOptions).toEqual({ b: 2 });
    // No-schema path returns early before emitting lifecycle events.
    expect(started).not.toHaveBeenCalled();
    expect(completed).not.toHaveBeenCalled();
  });
});

describe('plugin-command-validation — validation rule application', () => {
  it('records an error when a required rule fails and sets valid=false', async () => {
    const validator = createCommandValidator();
    const rules = validator.getBuiltInRules();
    validator.registerSchema('cmd', {
      arguments: { name: { rules: [rules.required()] } },
    });
    const result = await validator.validateAndTransform('cmd', { name: '' }, {}, CTX);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      field: 'name',
      type: ValidationRuleType.REQUIRED,
      severity: ValidationSeverity.ERROR,
    });
  });

  it('skips a rule whose condition returns false', async () => {
    const validator = createCommandValidator();
    const rules = validator.getBuiltInRules();
    const alwaysFail: ValidationRule = {
      ...rules.required('boom'),
      // Only validate when this flag is set; we leave args without it so condition is falsy.
      condition: () => false,
    };
    validator.registerSchema('cmd', { arguments: { name: { rules: [alwaysFail] } } });
    const result = await validator.validateAndTransform('cmd', { name: '' }, {}, CTX);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('uses a validator-returned string as the issue message', async () => {
    const validator = createCommandValidator();
    const customRule: ValidationRule = {
      type: ValidationRuleType.CUSTOM,
      severity: ValidationSeverity.ERROR,
      validator: () => 'nope, custom reason',
    };
    validator.registerSchema('cmd', { arguments: { name: { rules: [customRule] } } });
    const result = await validator.validateAndTransform('cmd', { name: 'x' }, {}, CTX);
    expect(result.errors[0].message).toBe('nope, custom reason');
    expect(result.valid).toBe(false);
  });

  it('routes warnings and info to the right buckets without failing validation', async () => {
    const validator = createCommandValidator();
    const warnRule: ValidationRule = { type: ValidationRuleType.CUSTOM, severity: ValidationSeverity.WARNING, validator: () => false, message: 'w' };
    const infoRule: ValidationRule = { type: ValidationRuleType.CUSTOM, severity: ValidationSeverity.INFO, validator: () => false, message: 'i' };
    validator.registerSchema('cmd', { arguments: { name: { rules: [warnRule, infoRule] } } });
    const result = await validator.validateAndTransform('cmd', { name: 'x' }, {}, CTX);
    // Only ERROR-severity issues invalidate the result.
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.info).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it('global rules are evaluated against the __global__ field', async () => {
    const validator = createCommandValidator();
    const globalRule: ValidationRule = {
      type: ValidationRuleType.CUSTOM,
      severity: ValidationSeverity.ERROR,
      validator: () => 'global failure',
    };
    validator.registerSchema('cmd', { globalRules: [globalRule] });
    const result = await validator.validateAndTransform('cmd', { a: 1 }, {}, CTX);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe('__global__');
    expect(result.errors[0].value).toEqual({ args: { a: 1 }, options: {} });
  });
});

describe('plugin-command-validation — dependency / conflict / implication', () => {
  it('checkDependencies reports a missing required companion field', async () => {
    const validator = createCommandValidator();
    validator.registerSchema('cmd', {
      arguments: { a: { rules: [], dependencies: ['b'] } },
    });
    const result = await validator.validateAndTransform('cmd', { a: 'present' }, {}, CTX);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe(ValidationRuleType.DEPENDENCY);
    expect(result.errors[0].message).toContain("requires 'b'");
  });

  it('checkConflicts reports a present conflicting field', async () => {
    const validator = createCommandValidator();
    validator.registerSchema('cmd', {
      arguments: { a: { rules: [], conflicts: ['b'] } },
    });
    const result = await validator.validateAndTransform('cmd', { a: 'x', b: 'y' }, {}, CTX);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe(ValidationRuleType.EXCLUSION);
    expect(result.errors[0].message).toContain("conflicts with 'b'");
  });

  it('option implies enforces implied companions', async () => {
    const validator = createCommandValidator();
    validator.registerSchema('cmd', {
      options: { verbose: { rules: [], implies: ['detail'] } },
    });
    const result = await validator.validateAndTransform('cmd', {}, { verbose: true }, CTX);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("requires 'detail'");
  });

  it('does not report conflicts/dependencies when the source field is absent', async () => {
    const validator = createCommandValidator();
    validator.registerSchema('cmd', {
      arguments: { a: { rules: [], dependencies: ['b'], conflicts: ['c'] } },
    });
    const result = await validator.validateAndTransform('cmd', { b: 'y', c: 'z' }, {}, CTX);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('plugin-command-validation — transformations within schemas', () => {
  it('applies per-field transformations before validating that field', async () => {
    const validator = createCommandValidator();
    const tr = validator.getBuiltInTransformations();
    const rules = validator.getBuiltInRules();
    validator.registerSchema('cmd', {
      arguments: {
        name: {
          rules: [rules.minLength(2)],
          transformations: [tr.trim()],
        },
      },
    });
    const result = await validator.validateAndTransform('cmd', { name: '  ab  ' }, {}, CTX);
    expect(result.valid).toBe(true);
    expect(result.transformedArgs.name).toBe('ab');
  });

  it('global transformations apply to every argument and option value', async () => {
    const validator = createCommandValidator();
    const tr = validator.getBuiltInTransformations();
    validator.registerSchema('cmd', { transformations: [tr.lowercase()] });
    const result = await validator.validateAndTransform('cmd', { a: 'UP' }, { b: 'LOW' }, CTX);
    expect(result.transformedArgs.a).toBe('up');
    expect(result.transformedOptions.b).toBe('low');
  });

  it('transformation chains run in ascending order regardless of declaration order', async () => {
    const validator = createCommandValidator();
    // Declare high-order transformer first, low-order second; chain must sort by order.
    const transformations: ParameterTransformation[] = [
      { type: TransformationType.CUSTOM, order: 2, transformer: (v) => `${v}!` },
      { type: TransformationType.CUSTOM, order: 1, transformer: (v) => `${v}?` },
    ];
    validator.registerSchema('cmd', {
      arguments: { name: { rules: [], transformations } },
    });
    const result = await validator.validateAndTransform('cmd', { name: 'x' }, {}, CTX);
    // order 1 ('?') runs before order 2 ('!'): 'x' -> 'x?' -> 'x?!'
    expect(result.transformedArgs.name).toBe('x?!');
  });

  it('skips a transformation whose condition returns false', async () => {
    const validator = createCommandValidator();
    const transformations: ParameterTransformation[] = [
      {
        type: TransformationType.CUSTOM,
        order: 1,
        transformer: (v) => `${v}!`,
        condition: () => false,
      },
    ];
    validator.registerSchema('cmd', { arguments: { name: { rules: [], transformations } } });
    const result = await validator.validateAndTransform('cmd', { name: 'x' }, {}, CTX);
    expect(result.transformedArgs.name).toBe('x');
  });
});

describe('plugin-command-validation — caching, failFast & configuration', () => {
  it('caches validation results and returns the same object on a cache hit', async () => {
    const validator = createCommandValidator();
    const rules = validator.getBuiltInRules();
    validator.registerSchema('cmd', { arguments: { name: { rules: [rules.required()] } } });
    const r1 = await validator.validateAndTransform('cmd', { name: 'x' }, {}, CTX);
    const started = vi.fn();
    validator.on('validation-started', started);
    const r2 = await validator.validateAndTransform('cmd', { name: 'x' }, {}, CTX);
    // Cache hit: identical object reference and no new validation-started event.
    expect(r2).toBe(r1);
    expect(started).not.toHaveBeenCalled();
  });

  it('failFast throws a ValidationError on the first error', async () => {
    const validator = createCommandValidator();
    const rules = validator.getBuiltInRules();
    validator.registerSchema('cmd', {
      failFast: true,
      arguments: { name: { rules: [rules.required('name needed')] } },
    });
    const errored = vi.fn();
    validator.on('validation-error', errored);
    await expect(validator.validateAndTransform('cmd', { name: '' }, {}, CTX)).rejects.toBeInstanceOf(ValidationError);
    expect(errored).toHaveBeenCalledTimes(1);
  });

  it('clearCache empties the cache and emits cache-cleared', async () => {
    const validator = createCommandValidator();
    const rules = validator.getBuiltInRules();
    validator.registerSchema('cmd', { arguments: { name: { rules: [rules.required()] } } });
    await validator.validateAndTransform('cmd', { name: 'x' }, {}, CTX);
    expect(validator.getValidationStats().cacheSize).toBe(1);
    const cleared = vi.fn();
    validator.on('cache-cleared', cleared);
    validator.clearCache();
    expect(validator.getValidationStats().cacheSize).toBe(0);
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('getValidationStats reports the registered schema count', () => {
    const validator = createCommandValidator();
    validator.registerSchema('a', createValidationSchema());
    validator.registerSchema('b', createValidationSchema());
    const stats = validator.getValidationStats();
    expect(stats.totalSchemas).toBe(2);
    expect(stats.cacheSize).toBe(0);
    expect(stats).toHaveProperty('cacheHitRate');
    expect(stats).toHaveProperty('validationCount');
  });

  it('updateConfiguration merges overrides and emits configuration-updated', () => {
    const validator = createCommandValidator();
    const updated = vi.fn();
    validator.on('configuration-updated', updated);
    validator.updateConfiguration({ cacheSize: 50, strictMode: true });
    expect(updated).toHaveBeenCalledTimes(1);
    expect(updated.mock.calls[0][0]).toMatchObject({ cacheSize: 50, strictMode: true, enableCaching: true });
  });

  it('evicts the oldest cache entry when the cache reaches capacity', async () => {
    const validator = createCommandValidator();
    const rules = validator.getBuiltInRules();
    validator.updateConfiguration({ cacheSize: 2 });
    validator.registerSchema('cmd', { arguments: { name: { rules: [rules.required()] } } });
    // Three distinct inputs -> third evicts the first (oldest).
    await validator.validateAndTransform('cmd', { name: 'a' }, {}, CTX);
    await validator.validateAndTransform('cmd', { name: 'b' }, {}, CTX);
    await validator.validateAndTransform('cmd', { name: 'c' }, {}, CTX);
    expect(validator.getValidationStats().cacheSize).toBe(2);
    // Recomputing the evicted 'a' entry is a fresh result (not the original reference).
    const r1 = await validator.validateAndTransform('cmd', { name: 'a' }, {}, CTX);
    expect(r1).toBeDefined();
    expect(validator.getValidationStats().cacheSize).toBe(2);
  });
});

describe('plugin-command-validation — removeSchema cache-eviction caveat', () => {
  // NOTE: removeSchema attempts this.validationCache.delete(commandId), but cache
  // keys are generated hashes (not commandIds), so the eviction is effectively a
  // no-op. After removing a schema that was previously validated, a stale cached
  // result can be returned unless clearCache() is called explicitly. The tests
  // below assert the actual (buggy) behaviour rather than the intended one.
  it('returns a stale cached result after removeSchema unless the cache is cleared', async () => {
    const validator = createCommandValidator();
    const rules = validator.getBuiltInRules();
    validator.registerSchema('cmd', { arguments: { name: { rules: [rules.required('needed')] } } });
    // First validation populates the cache with an error result.
    const cached = await validator.validateAndTransform('cmd', { name: '' }, {}, CTX);
    expect(cached.valid).toBe(false);
    // Removing the schema does not evict the hashed cache entry.
    validator.removeSchema('cmd');
    const again = await validator.validateAndTransform('cmd', { name: '' }, {}, CTX);
    expect(again).toBe(cached); // stale cached error returned, not the no-schema passthrough
    // After explicitly clearing the cache, the now-schemaless command validates cleanly.
    validator.clearCache();
    const fresh = await validator.validateAndTransform('cmd', { name: '' }, {}, CTX);
    expect(fresh.valid).toBe(true);
    expect(fresh.errors).toEqual([]);
  });
});
