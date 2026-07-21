import { describe, it, expect } from 'vitest';

import {
  getAnalyticsProvider,
  listAnalyticsProviders,
  listSupportedFrameworks,
  generateAnalyticsSetup,
  generatePrometheusConfig,
  generateGrafanaDashboard,
  generateAlertRules,
  generateAnalyticsDockerCompose,
  generateAnalyticsMiddleware,
  generateExpressAnalytics,
  generateFastAPIAnalytics,
  generateDjangoAnalytics,
  generateAspNetCoreAnalytics,
  generateSpringBootAnalytics,
  generateGinAnalytics,
  generateAxumAnalytics,
  generateNestJSAnalytics,
  generateFastifyAnalytics,
  type AnalyticsConfig,
} from '../../src/utils/api-analytics';

const baseConfig: AnalyticsConfig = {
  name: 'svc',
  provider: 'prometheus',
  framework: 'express',
  metrics: [
    {
      name: 'http_requests_total',
      type: 'counter',
      description: 'Total HTTP requests',
      labels: ['method', 'route', 'status'],
    },
  ],
  endpoints: [
    {
      path: '/health',
      method: 'GET',
      trackMetrics: true,
      logRequests: true,
      logErrors: true,
    },
  ],
  dashboard: true,
  alerts: [
    {
      name: 'HighErrorRate',
      condition: 'rate(http_requests_total{status="5xx"}[5m]) > 0',
      threshold: 0.05,
      window: '5m',
      notify: ['slack:ops'],
    },
  ],
};

describe('api-analytics', () => {
  describe('getAnalyticsProvider', () => {
    it('returns metadata for prometheus', () => {
      const t = getAnalyticsProvider('prometheus');
      expect(t).toBeDefined();
      expect(t?.provider).toBe('prometheus');
      expect(t?.format).toBe('yaml');
      expect(t?.defaultPort).toBe(9090);
      expect(t?.metricsPath).toBe('/metrics');
      expect(t?.docsUrl).toMatch(/^https?:\/\//);
    });

    it('returns metadata for datadog with port 8125', () => {
      const t = getAnalyticsProvider('datadog');
      expect(t?.defaultPort).toBe(8125);
    });

    it('returns null port for newrelic and cloudwatch', () => {
      expect(getAnalyticsProvider('newrelic')?.defaultPort).toBeNull();
      expect(getAnalyticsProvider('cloudwatch')?.defaultPort).toBeNull();
    });

    it('returns empty docsUrl for custom', () => {
      expect(getAnalyticsProvider('custom')?.docsUrl).toBe('');
    });

    it('returns ts format for custom provider', () => {
      expect(getAnalyticsProvider('custom')?.format).toBe('ts');
    });
  });

  describe('listAnalyticsProviders', () => {
    it('lists all 8 providers', () => {
      const list = listAnalyticsProviders();
      expect(list).toHaveLength(8);
      const names = list.map(p => p.provider);
      expect(names).toEqual(
        expect.arrayContaining([
          'prometheus',
          'datadog',
          'newrelic',
          'grafana',
          'elastic-apm',
          'cloudwatch',
          'open-telemetry',
          'custom',
        ])
      );
    });

    it('each entry has description and docs fields', () => {
      for (const entry of listAnalyticsProviders()) {
        expect(typeof entry.description).toBe('string');
        expect(typeof entry.docs).toBe('string');
      }
    });
  });

  describe('listSupportedFrameworks', () => {
    it('returns the canonical list of 9 frameworks', () => {
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
        'axum',
      ]);
    });
  });

  describe('generatePrometheusConfig', () => {
    it('returns a YAML string referencing the service name', () => {
      const yml = generatePrometheusConfig(baseConfig);
      expect(typeof yml).toBe('string');
      expect(yml).toContain('svc');
    });
  });

  describe('generateGrafanaDashboard', () => {
    it('returns a non-empty string', () => {
      const dash = generateGrafanaDashboard(baseConfig);
      expect(dash.length).toBeGreaterThan(0);
    });
  });

  describe('generateAlertRules', () => {
    it('renders the alert name from the config', () => {
      const rules = generateAlertRules(baseConfig);
      expect(rules).toContain('HighErrorRate');
    });
  });

  describe('generateAnalyticsDockerCompose', () => {
    it('returns a docker-compose snippet for prometheus', () => {
      const dc = generateAnalyticsDockerCompose('prometheus');
      expect(dc).toMatch(/prometheus/);
    });

    it('returns a docker-compose snippet for grafana', () => {
      const dc = generateAnalyticsDockerCompose('grafana');
      expect(dc).toMatch(/grafana/);
    });
  });

  describe('generateAnalyticsMiddleware', () => {
    it('routes to express generator for express framework', () => {
      const mw = generateAnalyticsMiddleware(baseConfig);
      expect(mw).toContain("import { Router, Request, Response } from 'express';");
    });
  });

  describe('framework code generators', () => {
    it('all generators return non-empty strings', () => {
      expect(generateExpressAnalytics(baseConfig).length).toBeGreaterThan(0);
      expect(generateFastAPIAnalytics({ ...baseConfig, framework: 'fastapi' }).length).toBeGreaterThan(0);
      expect(generateDjangoAnalytics({ ...baseConfig, framework: 'django' }).length).toBeGreaterThan(0);
      expect(generateAspNetCoreAnalytics({ ...baseConfig, framework: 'aspnet-core' }).length).toBeGreaterThan(0);
      expect(generateSpringBootAnalytics({ ...baseConfig, framework: 'spring-boot' }).length).toBeGreaterThan(0);
      expect(generateGinAnalytics({ ...baseConfig, framework: 'gin' }).length).toBeGreaterThan(0);
      expect(generateAxumAnalytics({ ...baseConfig, framework: 'axum' }).length).toBeGreaterThan(0);
      expect(generateNestJSAnalytics({ ...baseConfig, framework: 'nestjs' }).length).toBeGreaterThan(0);
      expect(generateFastifyAnalytics({ ...baseConfig, framework: 'fastify' }).length).toBeGreaterThan(0);
    });
  });

  describe('generateAnalyticsSetup', () => {
    it('returns middleware plus prometheus artifacts for prometheus provider', () => {
      const setup = generateAnalyticsSetup(baseConfig);
      expect(typeof setup.middleware).toBe('string');
      expect(setup.middleware.length).toBeGreaterThan(0);
      expect(setup.prometheusConfig).toBeDefined();
      expect(setup.dockerCompose).toBeDefined();
      expect(setup.grafanaDashboard).toBeDefined(); // dashboard: true
      expect(setup.alertRules).toBeDefined(); // alerts present
    });

    it('includes grafana dashboard only when dashboard=true', () => {
      const noDash = generateAnalyticsSetup({ ...baseConfig, dashboard: false });
      expect(noDash.grafanaDashboard).toBeUndefined();
    });

    it('omits alertRules when alerts are absent', () => {
      const noAlerts = generateAnalyticsSetup({ ...baseConfig, alerts: [] });
      expect(noAlerts.alertRules).toBeUndefined();
    });

    it('falls back to docker-compose only for non-prometheus providers', () => {
      const setup = generateAnalyticsSetup({ ...baseConfig, provider: 'datadog' });
      expect(setup.prometheusConfig).toBeUndefined();
      expect(setup.grafanaDashboard).toBeUndefined();
      expect(setup.alertRules).toBeUndefined();
      expect(setup.dockerCompose).toBeDefined();
    });
  });
});
