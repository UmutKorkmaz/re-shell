import { describe, it, expect } from 'vitest';

import {
  createDependencyResolver,
  validateVersion,
  compareVersions,
  satisfiesConstraint,
  PluginDependencyResolver,
} from '../../src/utils/plugin-dependency';

describe('plugin-dependency', () => {
  describe('validateVersion', () => {
    it('returns true for a clean semver', () => {
      expect(validateVersion('1.2.3')).toBe(true);
    });

    it('returns true for a v-prefixed semver', () => {
      expect(validateVersion('v1.2.3')).toBe(true);
    });

    it('returns true for prerelease versions', () => {
      expect(validateVersion('1.0.0-beta.1')).toBe(true);
    });

    it('returns false for a non-semver string', () => {
      expect(validateVersion('not-a-version')).toBe(false);
    });

    it('returns false for partial versions', () => {
      expect(validateVersion('1.2')).toBe(false);
    });
  });

  describe('compareVersions', () => {
    it('returns 0 for equal versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('returns -1 when a < b', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('returns 1 when a > b', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    });

    it('compares patch levels correctly', () => {
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
      expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    });

    it('treats v-prefix and no prefix as equivalent', () => {
      expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    });
  });

  describe('satisfiesConstraint', () => {
    it('matches a caret constraint', () => {
      expect(satisfiesConstraint('1.2.3', '^1.0.0')).toBe(true);
      expect(satisfiesConstraint('2.0.0', '^1.0.0')).toBe(false);
    });

    it('matches a tilde constraint', () => {
      expect(satisfiesConstraint('1.2.3', '~1.2.0')).toBe(true);
      expect(satisfiesConstraint('1.3.0', '~1.2.0')).toBe(false);
    });

    it('matches an exact version', () => {
      expect(satisfiesConstraint('1.2.3', '1.2.3')).toBe(true);
      expect(satisfiesConstraint('1.2.4', '1.2.3')).toBe(false);
    });

    it('matches complex ranges', () => {
      expect(satisfiesConstraint('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
      expect(satisfiesConstraint('2.5.0', '>=1.0.0 <2.0.0')).toBe(false);
    });

    it('matches x-range wildcards', () => {
      expect(satisfiesConstraint('1.2.3', '1.x')).toBe(true);
      expect(satisfiesConstraint('2.0.0', '1.x')).toBe(false);
    });

    it('returns false instead of throwing on invalid constraint', () => {
      expect(satisfiesConstraint('1.0.0', 'not-a-constraint')).toBe(false);
    });
  });

  describe('createDependencyResolver', () => {
    it('returns a PluginDependencyResolver instance', () => {
      const r = createDependencyResolver();
      expect(r).toBeInstanceOf(PluginDependencyResolver);
    });

    it('accepts partial options merged with defaults', () => {
      const r = createDependencyResolver({ maxDepth: 99 });
      // The options are private; we verify behavior via the instance type.
      expect(r).toBeInstanceOf(PluginDependencyResolver);
    });
  });

  describe('PluginDependencyResolver', () => {
    it('emits plugin-registered when registerPlugin is called', () => {
      const resolver = new PluginDependencyResolver();
      const events: string[] = [];
      resolver.on('plugin-registered', (name: string) => events.push(`reg:${name}`));

      resolver.registerPlugin({
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: '',
          author: '',
          main: '',
          permissions: [],
        },
        enabled: true,
        source: 'local',
      });

      expect(events).toEqual(['reg:test-plugin']);
    });

    it('emits plugin-unregistered when unregisterPlugin is called', () => {
      const resolver = new PluginDependencyResolver();
      const events: string[] = [];
      resolver.on('plugin-unregistered', (name: string) => events.push(`unreg:${name}`));

      resolver.registerPlugin({
        manifest: {
          name: 'p1',
          version: '1.0.0',
          description: '',
          author: '',
          main: '',
          permissions: [],
        },
        enabled: true,
        source: 'local',
      });
      resolver.unregisterPlugin('p1');

      expect(events).toEqual(['unreg:p1']);
    });
  });
});
