import { describe, expect, it } from 'vitest';

import {
  getDatabaseConfig,
  getDatabaseChoices,
  getBackendTemplateChoices,
  getRecommendedFrontends,
  getRecommendedBackends,
  validateDatabaseType,
  validateBackendFramework,
  validateFrontendFramework,
  getCompatibilitySummary,
  getPopularBackendFrameworks,
} from '../../src/utils/database';

describe('getDatabaseConfig', () => {
  it('returns config for prisma', () => {
    const config = getDatabaseConfig('prisma');
    expect(config).toBeDefined();
    expect(config).not.toBeNull();
  });

  it('returns config for typeorm', () => {
    const config = getDatabaseConfig('typeorm');
    expect(config).toBeDefined();
    expect(config).not.toBeNull();
  });

  it('returns config for mongoose', () => {
    const config = getDatabaseConfig('mongoose');
    expect(config).toBeDefined();
    expect(config).not.toBeNull();
  });

  it('returns null for none', () => {
    expect(getDatabaseConfig('none')).toBeNull();
  });

  it('returns null for unknown type', () => {
    expect(getDatabaseConfig('unknown' as any)).toBeNull();
  });
});

describe('getDatabaseChoices', () => {
  it('returns array with none, prisma, typeorm, mongoose', () => {
    const choices = getDatabaseChoices();
    expect(choices.length).toBeGreaterThanOrEqual(4);
    const values = choices.map(c => c.value);
    expect(values).toContain('none');
    expect(values).toContain('prisma');
    expect(values).toContain('typeorm');
    expect(values).toContain('mongoose');
  });
});

describe('getBackendTemplateChoices', () => {
  it('returns a non-empty array of choices', () => {
    const choices = getBackendTemplateChoices();
    expect(choices.length).toBeGreaterThan(0);
    expect(choices[0]).toHaveProperty('title');
    expect(choices[0]).toHaveProperty('value');
  });
});

describe('getRecommendedFrontends', () => {
  it('returns recommendations for a known backend', () => {
    const recs = getRecommendedFrontends('express');
    expect(recs.length).toBeGreaterThan(0);
  });

  it('returns recommendations for unknown backend (fallback)', () => {
    const recs = getRecommendedFrontends('unknown-backend');
    expect(Array.isArray(recs)).toBe(true);
  });
});

describe('getRecommendedBackends', () => {
  it('returns recommendations for a known frontend', () => {
    const recs = getRecommendedBackends('react');
    expect(recs.length).toBeGreaterThan(0);
  });
});

describe('validateDatabaseType', () => {
  it('validates known types', () => {
    expect(validateDatabaseType('prisma')).toEqual({ valid: true });
    expect(validateDatabaseType('typeorm')).toEqual({ valid: true });
    expect(validateDatabaseType('mongoose')).toEqual({ valid: true });
    expect(validateDatabaseType('none')).toEqual({ valid: true });
  });

  it('rejects unknown types', () => {
    const result = validateDatabaseType('unknown');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('unknown');
  });
});

describe('validateBackendFramework', () => {
  it('validates known backend', () => {
    const result = validateBackendFramework('express');
    expect(result.valid).toBe(true);
  });

  it('rejects unknown backend', () => {
    const result = validateBackendFramework('nonexistent');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('validateFrontendFramework', () => {
  it('validates known frontend', () => {
    const result = validateFrontendFramework('react');
    expect(result.valid).toBe(true);
  });

  it('rejects unknown frontend', () => {
    const result = validateFrontendFramework('nonexistent');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('getCompatibilitySummary', () => {
  it('returns summary object with icon, text, and color', () => {
    const summary = getCompatibilitySummary('react', 'express');
    expect(summary).toHaveProperty('icon');
    expect(summary).toHaveProperty('text');
    expect(summary).toHaveProperty('color');
  });
});

describe('getPopularBackendFrameworks', () => {
  it('returns a non-empty array', () => {
    const frameworks = getPopularBackendFrameworks();
    expect(frameworks.length).toBeGreaterThan(0);
  });
});
