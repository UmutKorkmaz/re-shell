import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  testCommandValidation,
  createCommandValidationSchema,
  listValidationRules,
  listTransformations,
  showCommandValidationSchema,
  showValidationStats,
  generateValidationTemplate,
} from '../../src/commands/plugin-validation';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/plugin-validation.ts (655 lines) — all 7 exports
// driving the real plugin-command-registry + plugin-command-validation
// engines against an empty (no plugins installed) environment, so the
// command-lookup paths all fail with ValidationError. The catalog/stats
// functions run against the real validator. createSpinner is mocked for
// the test-validation flow that builds its own spinner.

vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** All logged console output joined. */
function logged(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

/** The raw JSON payload logged in json mode. */
function jsonPayload(): unknown {
  return JSON.parse(logSpy.mock.calls.map(c => c.map(String).join('')).join(''));
}

describe('plugin-validation — command', () => {
  describe('testCommandValidation', () => {
    it('rejects an unknown command', async () => {
      await expect(
        testCommandValidation('nope', '{}')
      ).rejects.toThrow(ValidationError);
      await expect(
        testCommandValidation('nope', '{}')
      ).rejects.toThrow("Command 'nope' not found");
    });
  });

  describe('createCommandValidationSchema', () => {
    it('rejects an unknown command', async () => {
      await expect(
        createCommandValidationSchema('nope', '{}')
      ).rejects.toThrow("Command 'nope' not found");
    });
  });

  describe('listValidationRules', () => {
    it('renders the built-in rule catalog with descriptions', async () => {
      await listValidationRules();
      const out = logged();
      expect(out).toContain('Available Validation Rules');
      expect(out).toContain('required');
      expect(out).toContain('Ensures field has a value');
      expect(out).toContain('custom');
      expect(out).toMatch(/Total: \d+ built-in rule\(s\)/);
    });

    it('emits the catalog as JSON', async () => {
      await listValidationRules({ json: true });
      const payload = jsonPayload() as { name: string; description: string }[];
      expect(payload.length).toBeGreaterThanOrEqual(13);
      expect(payload.map(r => r.name)).toContain('required');
      expect(payload.map(r => r.name)).toContain('enum');
    });

    it('shows example usage in verbose mode', async () => {
      await listValidationRules({ verbose: true });
      const out = logged();
      expect(out).toContain('Example: rules.required');
      expect(out).toContain('Example: rules.pattern');
    });
  });

  describe('listTransformations', () => {
    it('renders the built-in transformation catalog', async () => {
      await listTransformations();
      const out = logged();
      expect(out).toContain('Available Parameter Transformations');
      expect(out).toContain('trim');
      expect(out).toContain('Converts string to lowercase');
      expect(out).toMatch(/Total: \d+ built-in transformation\(s\)/);
    });

    it('emits the catalog as JSON', async () => {
      await listTransformations({ json: true });
      const payload = jsonPayload() as { name: string }[];
      expect(payload.length).toBeGreaterThanOrEqual(14);
      expect(payload.map(t => t.name)).toContain('kebabCase');
      expect(payload.map(t => t.name)).toContain('sanitizeHtml');
    });

    it('shows example usage in verbose mode', async () => {
      await listTransformations({ verbose: true });
      expect(logged()).toContain('Example: transforms.trim');
    });
  });

  describe('showCommandValidationSchema', () => {
    it('rejects an unknown command', async () => {
      await expect(
        showCommandValidationSchema('nope')
      ).rejects.toThrow("Command 'nope' not found");
    });
  });

  describe('showValidationStats', () => {
    it('renders the zero-state statistics overview', async () => {
      await showValidationStats();
      const out = logged();
      expect(out).toContain('Validation System Statistics');
      expect(out).toContain('Total schemas: 0');
      expect(out).toContain('Cache size: 0');
      expect(out).toContain('Cache hit rate: 0%');
    });

    it('emits the stats object as JSON', async () => {
      await showValidationStats({ json: true });
      const payload = jsonPayload() as Record<string, number>;
      expect(payload.totalSchemas).toBe(0);
      expect(payload.cacheSize).toBe(0);
    });

    it('lists performance and enum catalogs in verbose mode', async () => {
      await showValidationStats({ verbose: true });
      const out = logged();
      expect(out).toContain('Performance:');
      expect(out).toContain('Rule Types:');
      expect(out).toContain('Transformation Types:');
    });
  });

  describe('generateValidationTemplate', () => {
    it('rejects an unknown command', async () => {
      await expect(
        generateValidationTemplate('nope')
      ).rejects.toThrow("Command 'nope' not found");
    });
  });
});
