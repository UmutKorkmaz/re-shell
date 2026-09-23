import { describe, it, expect } from 'vitest';
import {
  getTestingTemplate,
  generateUnitTestCode,
  generateIntegrationTestCode,
  generateContractTestCode,
  generateMockServerCode,
  generateLoadTestCode,
  generateTestConfig,
  formatAPITestConfig,
  listTestingFrameworks,
  type APITestConfig,
  type APITestCase,
  type ContractTestConfig,
  type MockServerConfig,
  type LoadTestConfig,
} from '../../src/utils/api-testing';

const sampleTestCases: APITestCase[] = [
  {
    name: 'get users',
    method: 'GET',
    path: '/api/users',
    expectedStatus: 200,
    description: 'returns user list',
    authRequired: true,
    tags: ['smoke'],
  },
  {
    name: 'create user',
    method: 'POST',
    path: '/api/users',
    expectedStatus: 201,
    requestBody: { name: 'Alice' },
    headers: { 'Content-Type': 'application/json' },
  },
];

describe('getTestingTemplate', () => {
  it('returns template for express', () => {
    const t = getTestingTemplate('express');
    expect(t).toBeDefined();
    expect(t!.framework).toBe('express');
    expect(t!.language).toBe('typescript');
    expect(t!.testFramework).toBe('jest');
    expect(t!.unitTestFile).toContain('api.test.ts');
    expect(t!.dependencies.length).toBeGreaterThan(0);
    expect(t!.setupCommands.length).toBeGreaterThan(0);
  });

  it('returns python template for fastapi', () => {
    const t = getTestingTemplate('fastapi');
    expect(t).toBeDefined();
    expect(t!.language).toBe('python');
    expect(t!.testFramework).toBe('pytest');
  });

  it('returns undefined for unsupported framework', () => {
    expect(getTestingTemplate('nope')).toBeUndefined();
  });

  it('returns templates for all supported frameworks', () => {
    const supported = ['express', 'nestjs', 'fastify', 'fastapi', 'django', 'aspnet-core', 'spring-boot', 'gin', 'rust-axum'];
    for (const fw of supported) {
      expect(getTestingTemplate(fw)).toBeDefined();
    }
  });
});

describe('generateUnitTestCode', () => {
  it('generates express unit test code', () => {
    const code = generateUnitTestCode('express', sampleTestCases);
    expect(code).toContain('API Unit Tests');
    expect(code).toContain('/api/users');
    expect(code).toContain('200');
  });

  it('includes auth header when authRequired', () => {
    const code = generateUnitTestCode('express', sampleTestCases);
    expect(code).toContain('Authorization');
  });

  it('returns fallback for unsupported framework', () => {
    expect(generateUnitTestCode('unknown', [])).toContain('No test template');
  });

  it('generates fastapi python unit tests', () => {
    const code = generateUnitTestCode('fastapi', sampleTestCases);
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('generateIntegrationTestCode', () => {
  it('generates express integration test code', () => {
    const code = generateIntegrationTestCode('express', sampleTestCases);
    expect(code).toContain('Integration Tests');
    expect(code).toContain('/api/users');
  });

  it('returns fallback for unsupported framework', () => {
    expect(generateIntegrationTestCode('unknown', [])).toContain('No integration test template');
  });
});

describe('generateContractTestCode', () => {
  const config: ContractTestConfig = {
    providerName: 'users-service',
    consumerName: 'web-app',
    pactDir: './pacts',
    specPath: './openapi.yaml',
  };

  it('generates express contract test code with consumer and provider names', () => {
    const code = generateContractTestCode('express', config);
    expect(code).toContain('Contract Tests');
    expect(code).toContain('users-service');
    expect(code).toContain('web-app');
  });

  it('generates code for nestjs', () => {
    const code = generateContractTestCode('nestjs', config);
    expect(code).toBeDefined();
    expect(code.length).toBeGreaterThan(0);
  });
});

describe('generateMockServerCode', () => {
  const config: MockServerConfig = {
    port: 8080,
    host: 'localhost',
    cors: true,
    latency: 100,
  };

  it('generates express mock server code', () => {
    const code = generateMockServerCode('express', config);
    expect(code).toContain('Mock Server');
    expect(code).toContain('msw');
    expect(code).toContain('setupServer');
    expect(code).toContain('startMockServer');
  });

  it('generates fastapi mock server code', () => {
    const code = generateMockServerCode('fastapi', config);
    expect(code).toContain('aioresponses');
  });

  it('returns fallback for unsupported framework', () => {
    expect(generateMockServerCode('unknown', config)).toContain('No mock server');
  });
});

describe('generateLoadTestCode', () => {
  const config: LoadTestConfig = {
    baseUrl: 'http://localhost:3000',
    duration: 60,
    concurrency: 50,
    rampUp: 10,
    scenarios: [
      {
        name: 'list users',
        weight: 70,
        requests: [
          { method: 'GET', path: '/api/users', expectedStatus: 200 },
        ],
      },
      {
        name: 'create user',
        weight: 30,
        requests: [
          { method: 'POST', path: '/api/users', body: { name: 'Bob' }, headers: { 'Content-Type': 'application/json' } },
        ],
      },
    ],
  };

  it('generates express load test (Artillery YAML)', () => {
    const code = generateLoadTestCode('express', config);
    expect(code).toContain('http://localhost:3000');
    expect(code).toContain('list users');
    expect(code).toContain('create user');
    expect(code).toContain('arrivalRate');
  });

  it('generates nestjs load test (k6)', () => {
    const code = generateLoadTestCode('nestjs', config);
    expect(code).toContain('k6/http');
    expect(code).toContain('stages');
    expect(code).toContain('check(');
  });

  it('generates fastapi load test (Locust)', () => {
    const code = generateLoadTestCode('fastapi', config);
    expect(code).toContain('locust');
    expect(code).toContain('HttpUser');
  });

  it('returns fallback for unsupported framework', () => {
    expect(generateLoadTestCode('unknown', config)).toContain('No load test template');
  });
});

describe('generateTestConfig', () => {
  it('generates jest config for express', () => {
    const cfg = generateTestConfig('express', ['unit', 'integration']);
    expect(cfg).toContain('ts-jest');
    expect(cfg).toContain('testEnvironment');
  });

  it('generates pytest config for fastapi', () => {
    const cfg = generateTestConfig('fastapi', ['unit']);
    expect(cfg).toContain('pytest');
    expect(cfg).toContain('asyncio_mode');
  });

  it('returns fallback for unknown framework', () => {
    expect(generateTestConfig('unknown', [])).toContain('No test config template');
  });
});

describe('formatAPITestConfig', () => {
  it('formats config with all options', () => {
    const config: APITestConfig = {
      framework: 'express',
      baseUrl: 'http://localhost:3000',
      outputDir: './tests',
      testTypes: ['unit', 'integration', 'contract'],
      includeContractTests: true,
      includeMockServer: true,
      includeLoadTests: true,
    };
    const out = formatAPITestConfig(config);
    expect(out).toContain('express');
    expect(out).toContain('http://localhost:3000');
    expect(out).toContain('Contract Tests:');
    expect(out).toContain('Mock Server:');
    expect(out).toContain('Load Tests:');
  });

  it('omits optional lines when features disabled', () => {
    const config: APITestConfig = {
      framework: 'fastapi',
      outputDir: './tests',
      testTypes: ['unit'],
      includeContractTests: false,
      includeMockServer: false,
      includeLoadTests: false,
    };
    const out = formatAPITestConfig(config);
    expect(out).not.toContain('Contract Tests:');
    expect(out).not.toContain('Base URL:');
  });
});

describe('listTestingFrameworks', () => {
  it('lists all supported frameworks with metadata', () => {
    const list = listTestingFrameworks();
    const names = list.map(f => f.name);
    expect(names).toContain('express');
    expect(names).toContain('nestjs');
    expect(names).toContain('fastapi');
    expect(names).toContain('rust-axum');
    expect(list.length).toBeGreaterThanOrEqual(8);
    const express = list.find(f => f.name === 'express');
    expect(express!.language).toBe('typescript');
    expect(express!.testFramework).toBe('jest');
  });
});
