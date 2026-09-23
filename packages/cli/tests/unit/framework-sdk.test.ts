import { describe, expect, it } from 'vitest';

import {
  generateFrameworkSdkBundle,
  generateBundleConfig,
} from '../../src/utils/framework-sdk';

const mockSpec = {
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'getUsers',
        responses: { '200': { description: 'OK' } },
      },
    },
  },
};

describe('generateFrameworkSdkBundle', () => {
  it('generates generic SDK by default', () => {
    const code = generateFrameworkSdkBundle(mockSpec as any);
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });

  it('generates React SDK', () => {
    const code = generateFrameworkSdkBundle(mockSpec as any, { framework: 'react' });
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });

  it('generates Vue SDK', () => {
    const code = generateFrameworkSdkBundle(mockSpec as any, { framework: 'vue' });
    expect(code).toBeDefined();
  });

  it('generates Angular SDK', () => {
    const code = generateFrameworkSdkBundle(mockSpec as any, { framework: 'angular' });
    expect(code).toBeDefined();
  });

  it('generates Svelte SDK', () => {
    const code = generateFrameworkSdkBundle(mockSpec as any, { framework: 'svelte' });
    expect(code).toBeDefined();
  });

  it('uses custom client name', () => {
    const code = generateFrameworkSdkBundle(mockSpec as any, { clientName: 'MyCustomClient' });
    expect(code).toContain('MyCustomClient');
  });
});

describe('generateBundleConfig', () => {
  it('generates vite config', () => {
    const config = generateBundleConfig('vite');
    expect(config.toLowerCase()).toContain('vite');
    expect(config).toContain('build');
  });

  it('generates webpack config', () => {
    const config = generateBundleConfig('webpack');
    expect(config.toLowerCase()).toContain('webpack');
  });

  it('generates rollup config', () => {
    const config = generateBundleConfig('rollup');
    expect(config.toLowerCase()).toContain('rollup');
  });
});
