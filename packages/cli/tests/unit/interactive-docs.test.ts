import { describe, it, expect } from 'vitest';

import {
  generateInteractiveDocsHTML,
  openAPIToInteractiveDocs,
  formatInteractiveDocsConfig,
  listSupportedFrameworks,
  type InteractiveDocsConfig,
} from '../../src/utils/interactive-docs';

const baseConfig: InteractiveDocsConfig = {
  title: 'Demo API',
  description: 'A demo API',
  version: '1.0.0',
  baseUrl: 'https://api.example.com',
  endpoints: [
    {
      id: 'get-health',
      method: 'GET',
      path: '/health',
      summary: 'Health check',
      responses: [{ statusCode: 200, description: 'OK' }],
    },
    {
      id: 'post-users',
      method: 'POST',
      path: '/users',
      summary: 'Create user',
      responses: [{ statusCode: 201, description: 'Created' }],
    },
  ],
};

describe('interactive-docs', () => {
  describe('listSupportedFrameworks', () => {
    it('returns the canonical 9 frameworks', () => {
      const list = listSupportedFrameworks();
      expect(list).toEqual([
        'express',
        'nestjs',
        'fastify',
        'fastapi',
        'django',
        'aspnet-core',
        'spring-boot',
        'gin',
        'rust-axum',
      ]);
    });
  });

  describe('generateInteractiveDocsHTML', () => {
    it('emits a full HTML document with doctype', () => {
      const html = generateInteractiveDocsHTML(baseConfig);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('embeds the title in the head section', () => {
      const html = generateInteractiveDocsHTML(baseConfig);
      expect(html).toContain('<title>');
      expect(html).toContain('Demo API');
    });

    it('renders each endpoint path in the body', () => {
      const html = generateInteractiveDocsHTML(baseConfig);
      expect(html).toContain('/health');
      expect(html).toContain('/users');
    });

    it('renders each HTTP method', () => {
      const html = generateInteractiveDocsHTML(baseConfig);
      expect(html).toContain('GET');
      expect(html).toContain('POST');
    });

    it('applies the themeColor when provided', () => {
      const html = generateInteractiveDocsHTML({ ...baseConfig, themeColor: '#ff0000' });
      expect(html).toContain('#ff0000');
    });

    it('defaults themeColor to blue when not provided', () => {
      const html = generateInteractiveDocsHTML(baseConfig);
      expect(html).toContain('#3b82f6');
    });
  });

  describe('openAPIToInteractiveDocs', () => {
    it('converts title/version/description from info', () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Spec API', version: '2.0.0', description: 'desc' },
        paths: {},
      };
      const cfg = openAPIToInteractiveDocs(spec, 'https://api.example.com');
      expect(cfg.title).toBe('Spec API');
      expect(cfg.version).toBe('2.0.0');
      expect(cfg.description).toBe('desc');
      expect(cfg.baseUrl).toBe('https://api.example.com');
    });

    it('falls back to defaults when info is missing', () => {
      const cfg = openAPIToInteractiveDocs({ paths: {} }, '');
      expect(cfg.title).toBe('API Documentation');
      expect(cfg.version).toBe('1.0.0');
    });

    it('extracts tags as groups', () => {
      const cfg = openAPIToInteractiveDocs(
        {
          paths: {},
          tags: [
            { name: 'users', description: 'user mgmt' },
            { name: 'admin', description: 'admin endpoints' },
          ],
        },
        ''
      );
      expect(cfg.groups).toHaveLength(2);
      expect(cfg.groups?.[0]).toMatchObject({
        id: 'users',
        name: 'users',
        description: 'user mgmt',
      });
    });

    it('converts each path/method into an endpoint', () => {
      const cfg = openAPIToInteractiveDocs(
        {
          paths: {
            '/items': {
              get: { summary: 'list items', responses: { '200': { description: 'OK' } } },
              post: { summary: 'create item', responses: { '201': { description: 'Created' } } },
            },
          },
        },
        ''
      );
      expect(cfg.endpoints).toHaveLength(2);
      const methods = cfg.endpoints.map(e => e.method).sort();
      expect(methods).toEqual(['GET', 'POST']);
      expect(cfg.endpoints.every(e => e.path === '/items')).toBe(true);
    });

    it('skips the shared parameters key of a path item', () => {
      const cfg = openAPIToInteractiveDocs(
        {
          paths: {
            '/x': {
              parameters: [{ name: 'limit', in: 'query', required: false }],
              get: { responses: { '200': { description: 'OK' } } },
            },
          },
        },
        ''
      );
      expect(cfg.endpoints).toHaveLength(1);
      expect(cfg.endpoints[0].method).toBe('GET');
    });

    it('marks authRequired when operation has security', () => {
      const cfg = openAPIToInteractiveDocs(
        {
          paths: {
            '/secure': {
              get: {
                security: [{ bearerAuth: [] }],
                responses: { '200': { description: 'OK' } },
              },
            },
          },
        },
        ''
      );
      expect(cfg.endpoints[0].authRequired).toBe(true);
    });

    it('maps response status codes to numbers', () => {
      const cfg = openAPIToInteractiveDocs(
        {
          paths: {
            '/x': {
              get: {
                responses: {
                  '200': { description: 'OK' },
                  '404': { description: 'Not Found' },
                },
              },
            },
          },
        },
        ''
      );
      const codes = cfg.endpoints[0].responses.map(r => r.statusCode).sort();
      expect(codes).toEqual([200, 404]);
    });

    it('detects bearer auth when securitySchemes are defined', () => {
      const cfg = openAPIToInteractiveDocs(
        {
          paths: {},
          components: { securitySchemes: { bearerAuth: { type: 'http' } } },
        },
        ''
      );
      expect(cfg.authConfig?.type).toBe('bearer');
    });

    it('uses none auth when no securitySchemes are defined', () => {
      const cfg = openAPIToInteractiveDocs({ paths: {} }, '');
      expect(cfg.authConfig?.type).toBe('none');
    });
  });

  describe('formatInteractiveDocsConfig', () => {
    it('renders title, version, and baseUrl', () => {
      const out = formatInteractiveDocsConfig(baseConfig);
      expect(out).toContain('Demo API');
      expect(out).toContain('1.0.0');
      expect(out).toContain('https://api.example.com');
    });

    it('renders description when present', () => {
      const out = formatInteractiveDocsConfig(baseConfig);
      expect(out).toContain('A demo API');
    });

    it('renders endpoint count and per-method counts', () => {
      const out = formatInteractiveDocsConfig(baseConfig);
      expect(out).toContain('Endpoints:');
      expect(out).toContain('GET');
      expect(out).toContain('POST');
    });

    it('shows feature toggles', () => {
      const out = formatInteractiveDocsConfig({
        ...baseConfig,
        tryItEnabled: true,
        examplesEnabled: true,
      });
      expect(out).toMatch(/Try It:\s+Enabled/);
      expect(out).toMatch(/Examples:\s+Enabled/);
    });

    it('falls back to "none" when authConfig is missing', () => {
      const out = formatInteractiveDocsConfig(baseConfig);
      expect(out).toMatch(/Auth:\s+none/);
    });

    it('shows the auth type when authConfig is set', () => {
      const out = formatInteractiveDocsConfig({
        ...baseConfig,
        authConfig: { type: 'bearer' },
      });
      expect(out).toMatch(/Auth:\s+bearer/);
    });
  });
});
