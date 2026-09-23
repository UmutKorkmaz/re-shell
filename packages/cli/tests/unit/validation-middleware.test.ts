import { describe, it, expect } from 'vitest';

import {
  VALIDATION_PATTERNS,
  BUILT_IN_VALIDATORS,
  getValidationTemplate,
  generateValidationMiddleware,
  ValidationMiddlewareGenerator,
  formatValidationTemplate,
} from '../../src/utils/validation-middleware';

describe('validation-middleware', () => {
  describe('VALIDATION_PATTERNS', () => {
    it('matches a valid email', () => {
      expect(VALIDATION_PATTERNS.email.test('user@example.com')).toBe(true);
    });

    it('rejects a malformed email', () => {
      expect(VALIDATION_PATTERNS.email.test('not-an-email')).toBe(false);
    });

    it('matches a lowercase uuid', () => {
      expect(VALIDATION_PATTERNS.uuid.test('12345678-1234-1234-1234-1234567890ab')).toBe(true);
    });

    it('matches an uppercase uuid (case-insensitive)', () => {
      expect(VALIDATION_PATTERNS.uuid.test('12345678-1234-1234-1234-1234567890AB')).toBe(true);
    });

    it('rejects a malformed uuid', () => {
      expect(VALIDATION_PATTERNS.uuid.test('not-a-uuid')).toBe(false);
    });

    it('matches http and https urls', () => {
      expect(VALIDATION_PATTERNS.url.test('http://example.com')).toBe(true);
      expect(VALIDATION_PATTERNS.url.test('https://example.com/path?q=1')).toBe(true);
    });

    it('rejects a non-url string', () => {
      expect(VALIDATION_PATTERNS.url.test('ftp://example.com')).toBe(false);
      expect(VALIDATION_PATTERNS.url.test('example.com')).toBe(false);
    });

    it('matches a YYYY-MM-DD date string', () => {
      expect(VALIDATION_PATTERNS.dateString.test('2026-07-21')).toBe(true);
    });

    it('matches an ISO 8601 timestamp with Z suffix', () => {
      expect(VALIDATION_PATTERNS.iso8601.test('2026-07-21T10:30:00Z')).toBe(true);
    });
  });

  describe('BUILT_IN_VALIDATORS', () => {
    describe('required', () => {
      it('passes when a value is supplied', () => {
        const r = BUILT_IN_VALIDATORS.required('hello');
        expect(r.valid).toBe(true);
        expect(r.errors).toEqual([]);
      });

      it('fails on empty string, null and undefined', () => {
        expect(BUILT_IN_VALIDATORS.required('').valid).toBe(false);
        expect(BUILT_IN_VALIDATORS.required(null).valid).toBe(false);
        expect(BUILT_IN_VALIDATORS.required(undefined).valid).toBe(false);
      });
    });

    describe('email', () => {
      it('passes for empty value (optional)', () => {
        expect(BUILT_IN_VALIDATORS.email('').valid).toBe(true);
      });

      it('fails for invalid email', () => {
        const r = BUILT_IN_VALIDATORS.email('bad');
        expect(r.valid).toBe(false);
        expect(r.errors?.[0]?.code).toBe('format');
      });
    });

    describe('minLength / maxLength', () => {
      it('enforces minimum length', () => {
        expect(BUILT_IN_VALIDATORS.minLength(3)('ab').valid).toBe(false);
        expect(BUILT_IN_VALIDATORS.minLength(3)('abc').valid).toBe(true);
      });

      it('enforces maximum length', () => {
        expect(BUILT_IN_VALIDATORS.maxLength(3)('abcd').valid).toBe(false);
        expect(BUILT_IN_VALIDATORS.maxLength(3)('abc').valid).toBe(true);
      });

      it('includes limit in error message', () => {
        const r = BUILT_IN_VALIDATORS.minLength(5)('ab');
        expect(r.errors?.[0]?.message).toContain('5');
      });
    });

    describe('min / max', () => {
      it('enforces minimum value', () => {
        expect(BUILT_IN_VALIDATORS.min(10)(5).valid).toBe(false);
        expect(BUILT_IN_VALIDATORS.min(10)(15).valid).toBe(true);
      });

      it('enforces maximum value', () => {
        expect(BUILT_IN_VALIDATORS.max(10)(15).valid).toBe(false);
        expect(BUILT_IN_VALIDATORS.max(10)(5).valid).toBe(true);
      });

      it('treats null/undefined as valid', () => {
        expect(BUILT_IN_VALIDATORS.min(10)(null).valid).toBe(true);
        expect(BUILT_IN_VALIDATORS.max(10)(undefined).valid).toBe(true);
      });
    });

    describe('pattern', () => {
      it('matches against provided regex', () => {
        const validator = BUILT_IN_VALIDATORS.pattern(/^[a-z]+$/);
        expect(validator('abc').valid).toBe(true);
        expect(validator('ABC').valid).toBe(false);
      });
    });

    describe('enum', () => {
      it('restricts to enumerated values', () => {
        const validator = BUILT_IN_VALIDATORS.enum('red', 'green', 'blue');
        expect(validator('red').valid).toBe(true);
        expect(validator('purple').valid).toBe(false);
      });

      it('treats null/undefined as valid', () => {
        const validator = BUILT_IN_VALIDATORS.enum('a', 'b');
        expect(validator(null).valid).toBe(true);
        expect(validator(undefined).valid).toBe(true);
      });

      it('lists allowed values in the error message', () => {
        const r = BUILT_IN_VALIDATORS.enum('a', 'b')('c');
        expect(r.errors?.[0]?.message).toContain('a');
        expect(r.errors?.[0]?.message).toContain('b');
      });
    });
  });

  describe('getValidationTemplate', () => {
    it('returns the express template', () => {
      const t = getValidationTemplate('express');
      expect(t).toBeDefined();
      expect(t?.framework).toBe('express');
      expect(t?.language).toBe('typescript');
      expect(t?.middlewareFile).toBe('validation.middleware.ts');
    });

    it('returns undefined for an unknown framework', () => {
      expect(getValidationTemplate('does-not-exist')).toBeUndefined();
    });
  });

  describe('generateValidationMiddleware', () => {
    it('returns undefined when the framework is unknown', () => {
      expect(generateValidationMiddleware('nope')).toBeUndefined();
    });

    it('emits header comments with default options', () => {
      const code = generateValidationMiddleware('express');
      expect(code).toContain('Validation middleware for express');
      expect(code).toContain('Mode: lenient');
      expect(code).toContain('Validate Request: true');
      expect(code).toContain('Validate Response: false');
      expect(code).toContain('Strip Unknown: true');
    });

    it('respects overridden options', () => {
      const code = generateValidationMiddleware('express', {
        mode: 'strict',
        validateRequest: false,
        validateResponse: true,
        stripUnknown: false,
      });
      expect(code).toContain('Mode: strict');
      expect(code).toContain('Validate Request: false');
      expect(code).toContain('Validate Response: true');
      expect(code).toContain('Strip Unknown: false');
    });
  });

  describe('ValidationMiddlewareGenerator', () => {
    describe('getInstallCommands', () => {
      it('returns dependencies for a known framework', () => {
        const gen = new ValidationMiddlewareGenerator('/tmp', 'express');
        const deps = gen.getInstallCommands('express');
        expect(deps.length).toBeGreaterThan(0);
        expect(deps.some(d => d.startsWith('joi'))).toBe(true);
      });

      it('returns empty array for unknown framework', () => {
        const gen = new ValidationMiddlewareGenerator('/tmp', 'unknown');
        expect(gen.getInstallCommands('unknown')).toEqual([]);
      });
    });

    describe('getSupportedFrameworks', () => {
      it('returns a list (possibly empty) of framework keys', () => {
        const gen = new ValidationMiddlewareGenerator('/tmp');
        const result = gen.getSupportedFrameworks();
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('formatValidationTemplate', () => {
    it('renders framework header and language', () => {
      const t = getValidationTemplate('express')!;
      const out = formatValidationTemplate(t);
      expect(out).toContain('express');
      expect(out).toContain('Language:');
      expect(out).toContain('typescript');
    });

    it('renders dependencies section when present', () => {
      const t = getValidationTemplate('express')!;
      const out = formatValidationTemplate(t);
      expect(out).toContain('Dependencies:');
      // express template has joi listed
      expect(out).toMatch(/joi/);
    });

    it('renders the usage example', () => {
      const t = getValidationTemplate('express')!;
      const out = formatValidationTemplate(t);
      expect(out).toContain('Usage Example:');
    });
  });
});
