import { describe, it, expect } from 'vitest';

import {
  getGatewayTemplate,
  generateKongConfig,
  generateTraefikConfig,
  generateNginxConfig,
  generateEnvoyConfig,
  generateGatewayDockerCompose,
  generateGatewayConfig,
  listGatewayTypes,
  formatGatewayConfig,
  type GatewayConfig,
} from '../../src/utils/api-gateway';

const baseConfig: GatewayConfig = {
  name: 'gw',
  type: 'kong',
  routes: [
    {
      id: 'r1',
      path: '/api/users',
      method: ['GET', 'POST'],
      service: 'users-svc',
      stripPath: true,
      timeout: 60000,
    },
  ],
  services: [
    {
      id: 's1',
      name: 'users-svc',
      url: 'http://users-svc:3000',
      healthCheck: {
        path: '/health',
        interval: 30,
        timeout: 5,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
      },
    },
  ],
  rateLimit: { enabled: true, window: 60, limit: 100 },
  cors: {
    enabled: true,
    origins: ['https://app.example.com'],
    methods: ['GET', 'POST'],
    headers: ['Content-Type'],
    credentials: true,
    maxAge: 3600,
  },
  auth: { type: 'jwt' },
};

describe('api-gateway', () => {
  describe('getGatewayTemplate', () => {
    it('returns metadata for kong', () => {
      const t = getGatewayTemplate('kong');
      expect(t).toBeDefined();
      expect(t?.type).toBe('kong');
      expect(t?.format).toBe('yaml');
      expect(t?.configPath).toBe('./kong.yml');
      expect(t?.docsUrl).toMatch(/^https?:\/\//);
    });

    it('returns metadata for traefik', () => {
      const t = getGatewayTemplate('traefik');
      expect(t?.type).toBe('traefik');
      expect(t?.configPath).toBe('./traefik.yml');
    });

    it('returns metadata for nginx', () => {
      const t = getGatewayTemplate('nginx');
      expect(t?.type).toBe('nginx');
    });

    it('returns metadata for envoy', () => {
      const t = getGatewayTemplate('envoy');
      expect(t?.type).toBe('envoy');
    });

    it('returns metadata for all 9 gateway types', () => {
      const all = [
        'kong',
        'traefik',
        'nginx',
        'envoy',
        'aws-api-gateway',
        'azure-api-management',
        'gcp-api-gateway',
        'express-gateway',
        'krakenD',
      ] as const;
      for (const t of all) {
        expect(getGatewayTemplate(t)).toBeDefined();
      }
    });
  });

  describe('listGatewayTypes', () => {
    it('lists all 9 gateway types with descriptions and docs', () => {
      const list = listGatewayTypes();
      expect(list).toHaveLength(9);
      const types = list.map(x => x.type);
      expect(types).toEqual(
        expect.arrayContaining([
          'kong',
          'traefik',
          'nginx',
          'envoy',
          'aws-api-gateway',
          'azure-api-management',
          'gcp-api-gateway',
          'express-gateway',
          'krakenD',
        ])
      );
      for (const entry of list) {
        expect(typeof entry.description).toBe('string');
        expect(typeof entry.docs).toBe('string');
      }
    });
  });

  describe('generateKongConfig', () => {
    it('embeds the service name and URL', () => {
      const cfg = generateKongConfig(baseConfig);
      expect(cfg).toContain('users-svc');
      expect(cfg).toContain('http://users-svc:3000');
    });

    it('embeds route paths and methods', () => {
      const cfg = generateKongConfig(baseConfig);
      expect(cfg).toContain('/api/users');
      expect(cfg).toContain('GET');
      expect(cfg).toContain('POST');
    });

    it('declares the Kong format version header', () => {
      const cfg = generateKongConfig(baseConfig);
      expect(cfg).toContain('_format_version:');
    });
  });

  describe('generateTraefikConfig', () => {
    it('declares entry points and dynamic provider', () => {
      const cfg = generateTraefikConfig(baseConfig);
      expect(cfg).toContain('entryPoints:');
      expect(cfg).toContain('providers:');
    });

    it('emits a router per route referencing the service', () => {
      const cfg = generateTraefikConfig(baseConfig);
      expect(cfg).toContain('users-svc');
      expect(cfg).toContain('/api/users');
    });
  });

  describe('generateNginxConfig', () => {
    it('declares an upstream block per service with host:port', () => {
      const cfg = generateNginxConfig(baseConfig);
      expect(cfg).toContain('upstream users-svc');
      expect(cfg).toContain('users-svc:3000');
    });
  });

  describe('generateEnvoyConfig', () => {
    it('declares a cluster per service', () => {
      const cfg = generateEnvoyConfig(baseConfig);
      expect(cfg).toContain('clusters:');
      expect(cfg).toContain('name: users-svc');
    });
  });

  describe('generateGatewayDockerCompose', () => {
    it('returns a docker-compose snippet referencing the gateway type', () => {
      const dc = generateGatewayDockerCompose('kong');
      expect(dc).toMatch(/kong/i);
    });

    it('returns a docker-compose snippet for traefik', () => {
      const dc = generateGatewayDockerCompose('traefik');
      expect(dc).toMatch(/traefik/i);
    });
  });

  describe('generateGatewayConfig', () => {
    it('routes to the kong generator', () => {
      const cfg = generateGatewayConfig('kong', baseConfig);
      expect(cfg).toContain('_format_version:');
      expect(cfg).toContain('users-svc');
    });

    it('routes to the traefik generator', () => {
      const cfg = generateGatewayConfig('traefik', baseConfig);
      expect(cfg).toContain('entryPoints:');
    });

    it('routes to the nginx generator', () => {
      const cfg = generateGatewayConfig('nginx', baseConfig);
      expect(cfg).toContain('upstream users-svc');
    });

    it('routes to the envoy generator', () => {
      const cfg = generateGatewayConfig('envoy', baseConfig);
      expect(cfg).toContain('clusters:');
    });

    it('falls back to a placeholder comment for unsupported types', () => {
      const cfg = generateGatewayConfig('aws-api-gateway', baseConfig);
      expect(cfg).toContain('# Configuration for aws-api-gateway');
      expect(cfg).toContain('Coming soon');
    });
  });

  describe('formatGatewayConfig', () => {
    it('renders the gateway name and type', () => {
      const out = formatGatewayConfig(baseConfig);
      expect(out).toContain('gw');
      expect(out).toContain('kong');
    });

    it('renders the services with their URLs', () => {
      const out = formatGatewayConfig(baseConfig);
      expect(out).toContain('users-svc');
      expect(out).toContain('http://users-svc:3000');
    });

    it('renders the routes with their methods and target service', () => {
      const out = formatGatewayConfig(baseConfig);
      expect(out).toContain('/api/users');
      expect(out).toContain('GET');
      expect(out).toContain('POST');
    });

    it('renders the rate limit section when enabled', () => {
      const out = formatGatewayConfig(baseConfig);
      expect(out).toContain('Rate Limit:');
      expect(out).toContain('100');
      expect(out).toContain('60s');
    });

    it('omits the rate limit section when disabled', () => {
      const out = formatGatewayConfig({
        ...baseConfig,
        rateLimit: { enabled: false, window: 60, limit: 100 },
      });
      expect(out).not.toContain('Rate Limit:');
    });
  });
});
