import { describe, expect, it } from 'vitest';
import {
  buildConfigFromFlags,
  isValidPluginName,
  parseList,
  VALID_HOOK_TYPES,
  VALID_PERMISSIONS,
  type PluginScaffoldConfig,
} from '../../src/utils/plugin-wizard';

describe('isValidPluginName', () => {
  it('accepts scoped names', () => {
    expect(isValidPluginName('@re-shell/my-plugin')).toBe(true);
  });
  it('accepts plain names', () => {
    expect(isValidPluginName('reshell-plugin-foo')).toBe(true);
  });
  it('rejects names with spaces', () => {
    expect(isValidPluginName('Bad Name')).toBe(false);
  });
  it('rejects names with uppercase', () => {
    expect(isValidPluginName('MyPlugin')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidPluginName('')).toBe(false);
  });
});

describe('parseList', () => {
  it('returns empty array for empty string', () => {
    expect(parseList('')).toEqual([]);
  });
  it('returns empty array for whitespace only', () => {
    expect(parseList('   ')).toEqual([]);
  });
  it('splits comma-separated values', () => {
    expect(parseList('build:start,build:end')).toEqual(['build:start', 'build:end']);
  });
  it('trims whitespace around values', () => {
    expect(parseList(' build:start , build:end ')).toEqual(['build:start', 'build:end']);
  });
  it('handles single value', () => {
    expect(parseList('build:start')).toEqual(['build:start']);
  });
});

describe('buildConfigFromFlags', () => {
  it('builds config with defaults', () => {
    const config = buildConfigFromFlags({
      name: 'reshell-plugin-test',
      description: 'A test plugin',
      author: 'Test Author',
      license: 'MIT',
      type: 'hooks',
      hooks: 'build:start,build:end',
      commands: 'db:migrate',
      permissions: 'filesystem:read',
      framework: 'universal',
      includeTests: true,
      includeCI: true,
    });
    expect(config.name).toBe('reshell-plugin-test');
    expect(config.description).toBe('A test plugin');
    expect(config.license).toBe('MIT');
    expect(config.pluginType).toBe('hooks');
    expect(config.hooks).toEqual(['build:start', 'build:end']);
    expect(config.commands).toEqual(['db:migrate']);
    expect(config.permissions).toEqual(['filesystem:read']);
    expect(config.frameworkTarget).toBe('universal');
    expect(config.includeTests).toBe(true);
    expect(config.includeCI).toBe(true);
  });

  it('defaults type to "both"', () => {
    const config = buildConfigFromFlags({
      name: 'reshell-plugin-test',
      description: 'Test',
      author: 'Author',
      license: undefined,
      type: undefined,
      hooks: '',
      commands: '',
      permissions: '',
      framework: undefined,
      includeTests: undefined,
      includeCI: undefined,
    });
    expect(config.pluginType).toBe('both');
    expect(config.license).toBe('MIT');
    expect(config.frameworkTarget).toBe('universal');
    expect(config.includeTests).toBe(true);
    expect(config.includeCI).toBe(true);
  });

  it('throws on invalid plugin name', () => {
    expect(() =>
      buildConfigFromFlags({
        name: 'Bad Name',
        description: 'x',
        author: 'x',
        license: 'MIT',
        type: 'hooks',
        hooks: '',
        commands: '',
        permissions: '',
        framework: 'universal',
        includeTests: true,
        includeCI: true,
      })
    ).toThrow(/Invalid plugin name/);
  });

  it('throws on empty description', () => {
    expect(() =>
      buildConfigFromFlags({
        name: 'reshell-plugin-x',
        description: '',
        author: 'x',
        license: 'MIT',
        type: 'hooks',
        hooks: '',
        commands: '',
        permissions: '',
        framework: 'universal',
        includeTests: true,
        includeCI: true,
      })
    ).toThrow(/Missing required field: description/);
  });
});

describe('VALID_HOOK_TYPES', () => {
  it('contains build:start and build:end', () => {
    expect(VALID_HOOK_TYPES).toContain('build:start');
    expect(VALID_HOOK_TYPES).toContain('build:end');
  });
  it('does NOT contain command:register or custom', () => {
    expect(VALID_HOOK_TYPES).not.toContain('command:register');
    expect(VALID_HOOK_TYPES).not.toContain('custom');
  });
});

describe('VALID_PERMISSIONS', () => {
  it('contains filesystem:read and network', () => {
    expect(VALID_PERMISSIONS).toContain('filesystem:read');
    expect(VALID_PERMISSIONS).toContain('network');
  });
});
