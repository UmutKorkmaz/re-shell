import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { analyzeProject } from './framework-detection';

/**
 * Automated Testing Setup with Coverage Targets
 * Generates testing configuration and setup for new services
 */

export interface TestingConfig {
  framework: string;
  language: string;
  testingFramework: 'jest' | 'vitest' | 'mocha' | 'jasmine' | 'pytest' | 'go-test' | 'java-junit';
  coverageThreshold: number;
  coverageReporters: string[];
  testEnvironment: 'node' | 'jsdom' | 'happy-dom';
  e2eFramework?: 'cypress' | 'playwright' | 'puppeteer' | 'supertest';
  ciIntegration: boolean;
  watchMode: boolean;
}

export interface TestingSetupResult {
  files: Array<{ path: string; content: string }>;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  warnings: string[];
}

// Testing configurations per framework
const TESTING_CONFIGS: Record<string, Partial<TestingConfig>> = {
  nestjs: {
    testingFramework: 'jest',
    coverageThreshold: 80,
    coverageReporters: ['text', 'lcov', 'html'],
    testEnvironment: 'node',
    e2eFramework: 'cypress',
    ciIntegration: true,
    watchMode: true,
  },
  express: {
    testingFramework: 'jest',
    coverageThreshold: 75,
    coverageReporters: ['text', 'lcov', 'html'],
    testEnvironment: 'node',
    e2eFramework: 'supertest',
    ciIntegration: true,
    watchMode: true,
  },
  react: {
    testingFramework: 'vitest',
    coverageThreshold: 80,
    coverageReporters: ['text', 'lcov', 'html'],
    testEnvironment: 'jsdom',
    e2eFramework: 'playwright',
    ciIntegration: true,
    watchMode: true,
  },
  vue: {
    testingFramework: 'vitest',
    coverageThreshold: 80,
    coverageReporters: ['text', 'lcov', 'html'],
    testEnvironment: 'jsdom',
    e2eFramework: 'cypress',
    ciIntegration: true,
    watchMode: true,
  },
  angular: {
    testingFramework: 'jasmine',
    coverageThreshold: 80,
    coverageReporters: ['text', 'lcov', 'html'],
    testEnvironment: 'jsdom',
    e2eFramework: 'cypress',
    ciIntegration: true,
    watchMode: true,
  },
  svelte: {
    testingFramework: 'vitest',
    coverageThreshold: 75,
    coverageReporters: ['text', 'lcov', 'html'],
    testEnvironment: 'jsdom',
    e2eFramework: 'playwright',
    ciIntegration: true,
    watchMode: true,
  },
  fastify: {
    testingFramework: 'jest',
    coverageThreshold: 75,
    coverageReporters: ['text', 'lcov', 'html'],
    testEnvironment: 'node',
    e2eFramework: 'supertest',
    ciIntegration: true,
    watchMode: true,
  },
  django: {
    testingFramework: 'pytest',
    coverageThreshold: 80,
    coverageReporters: ['term', 'html', 'xml'],
    testEnvironment: 'node',
    ciIntegration: true,
    watchMode: false,
  },
  flask: {
    testingFramework: 'pytest',
    coverageThreshold: 75,
    coverageReporters: ['term', 'html'],
    testEnvironment: 'node',
    ciIntegration: true,
    watchMode: false,
  },
};

/**
 * Generate testing setup for a project
 */
export async function generateTestingSetup(
  config: TestingConfig
): Promise<TestingSetupResult> {
  console.log(chalk.cyan.bold('\n🧪 Generating Testing Setup\n'));
  console.log(chalk.gray(`Framework: ${config.framework}`));
  console.log(chalk.gray(`Testing: ${config.testingFramework}`));
  console.log(chalk.gray(`Coverage Target: ${config.coverageThreshold}%\n`));

  const result: TestingSetupResult = {
    files: [],
    dependencies: [],
    devDependencies: [],
    scripts: {},
    warnings: [],
  };

  // Generate configuration based on testing framework
  switch (config.testingFramework) {
    case 'jest':
      generateJestSetup(config, result);
      break;
    case 'vitest':
      generateVitestSetup(config, result);
      break;
    case 'mocha':
      generateMochaSetup(config, result);
      break;
    case 'jasmine':
      generateJasmineSetup(config, result);
      break;
    case 'pytest':
      generatePytestSetup(config, result);
      break;
    case 'go-test':
      generateGoTestSetup(config, result);
      break;
    case 'java-junit':
      generateJUnitSetup(config, result);
      break;
    default:
      result.warnings.push(`Unknown testing framework: ${config.testingFramework}`);
  }

  // Generate CI configuration
  if (config.ciIntegration) {
    generateCIConfig(config, result);
  }

  // Generate test utilities
  generateTestUtils(config, result);

  // Generate example tests
  generateExampleTests(config, result);

  console.log(chalk.green(`✓ Generated ${result.files.length} testing file(s)\n`));

  return result;
}

/**
 * Generate Jest configuration
 */
function generateJestSetup(config: TestingConfig, result: TestingSetupResult): void {
  result.devDependencies.push(
    'jest',
    '@types/jest',
    'ts-jest',
    '@jest/globals',
    'ts-node'
  );

  // Add coverage reporter
  result.devDependencies.push('@testing-library/jest-dom');

  // Generate Jest config
  result.files.push({
    path: 'jest.config.js',
    content: generateJestConfig(config),
  });

  // Generate Jest setup file
  result.files.push({
    path: 'jest.setup.js',
    content: generateJestSetupFile(config),
  });

  // Add scripts
  result.scripts['test'] = 'jest';
  result.scripts['test:watch'] = 'jest --watch';
  result.scripts['test:coverage'] = 'jest --coverage';
  result.scripts['test:ci'] = 'jest --ci --coverage --maxWorkers=2';
  result.scripts['test:debug'] = 'node --inspect-brk node_modules/.bin/jest --runInBand';
}

/**
 * Generate Jest configuration file
 */
function generateJestConfig(config: TestingConfig): string {
  const isTypeScript = config.language === 'typescript';

  return `module.exports = {
  preset: '${isTypeScript ? 'ts-jest' : 'ts-jest/presets/default-esm'}',
  testEnvironment: '${config.testEnvironment}',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.interface.{ts,tsx}',
    '!src/**/*.types.{ts,tsx}',
    '!src/**/*.mock.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/main.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: ${config.coverageThreshold},
      functions: ${config.coverageThreshold},
      lines: ${config.coverageThreshold},
      statements: ${config.coverageThreshold},
    },
  },
  coverageReporters: [${config.coverageReporters.map(r => `'${r}'`).join(', ')}],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  verbose: true,
  ${config.watchMode ? 'watchPlugins: ["jest-watch-typeahead"],' : ''}
};
`;
}

/**
 * Generate Jest setup file
 */
function generateJestSetupFile(config: TestingConfig): string {
  let content = `// Jest setup file
import '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

`;

  if (config.testEnvironment === 'jsdom' || config.testEnvironment === 'happy-dom') {
    content += `// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

`;
  }

  content += `// Global test utilities
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly debugging
  log: jest.fn(),
  debug: jest.fn(),
};

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => \`expected \${received} not to be within range \${floor} - \${ceiling}\`,
        pass: true,
      };
    } else {
      return {
        message: () => \`expected \${received} to be within range \${floor} - \${ceiling}\`,
        pass: false,
      };
    }
  },
});
`;

  return content;
}

/**
 * Generate Vitest configuration
 */
function generateVitestSetup(config: TestingConfig, result: TestingSetupResult): void {
  result.devDependencies.push(
    'vitest',
    '@vitest/ui',
    '@vitest/coverage-v8',
    'jsdom'
  );

  result.files.push({
    path: 'vitest.config.ts',
    content: generateVitestConfig(config),
  });

  result.scripts['test'] = 'vitest';
  result.scripts['test:ui'] = 'vitest --ui';
  result.scripts['test:coverage'] = 'vitest --coverage';
  result.scripts['test:ci'] = 'vitest run --coverage';
}

/**
 * Generate Vitest configuration
 */
function generateVitestConfig(config: TestingConfig): string {
  return `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: '${config.testEnvironment}',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: [${config.coverageReporters.map(r => `'${r}'`).join(', ')}],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.interface.{ts,tsx}',
        'src/**/*.types.{ts,tsx}',
        'src/**/*.mock.{ts,tsx}',
        'src/**/__tests__/**',
        'src/main.ts',
        'src/index.ts',
      ],
      thresholds: {
        lines: ${config.coverageThreshold},
        functions: ${config.coverageThreshold},
        branches: ${config.coverageThreshold},
        statements: ${config.coverageThreshold},
      },
    },
    include: ['src/**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.{spec,test}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@common': path.resolve(__dirname, './src/common'),
      '@config': path.resolve(__dirname, './src/config'),
      '@modules': path.resolve(__dirname, './src/modules'),
    },
  },
});
`;
}

/**
 * Generate Mocha configuration
 */
function generateMochaSetup(config: TestingConfig, result: TestingSetupResult): void {
  result.devDependencies.push(
    'mocha',
    'chai',
    'chai-as-promised',
    'sinon',
    '@types/mocha',
    '@types/chai',
    'nyc'
  );

  result.files.push({
    path: '.mocharc.json',
    content: JSON.stringify({
      require: ['ts-node/register', 'source-map-support/register'],
      timeout: 10000,
      spec: 'src/**/*.spec.ts',
      extension: ['ts', 'js'],
      reporter: 'spec',
      recursive: true,
    }, null, 2),
  });

  result.files.push({
    path: 'nyc.config.js',
    content: `module.exports = {
  extension: ['.ts', '.tsx'],
  include: ['src/**/*.ts'],
  exclude: [
    'src/**/*.d.ts',
    'src/**/*.spec.ts',
    'src/**/*.test.ts',
    'src/main.ts',
  ],
  reporter: [${config.coverageReporters.map(r => `'${r}'`).join(', ')}],
  lines: ${config.coverageThreshold},
  functions: ${config.coverageThreshold},
  branches: ${config.coverageThreshold},
  statements: ${config.coverageThreshold},
  check-coverage: true,
  all: true,
};`,
  });

  result.scripts['test'] = 'mocha';
  result.scripts['test:coverage'] = 'nyc mocha';
  result.scripts['test:watch'] = 'mocha --watch';
}

/**
 * Generate Jasmine configuration
 */
function generateJasmineSetup(config: TestingConfig, result: TestingSetupResult): void {
  result.devDependencies.push(
    'jasmine',
    'jasmine-spec-reporter',
    '@types/jasmine'
  );

  result.files.push({
    path: 'jasmine.json',
    content: JSON.stringify({
      spec_dir: 'src',
      spec_files: ['**/*[sS]pec.ts'],
      helpers: [],
      stopSpecOnExpectationFailure: false,
      random: true,
    }, null, 2),
  });

  result.scripts['test'] = 'jasmine';
  result.scripts['test:coverage'] = 'nyc jasmine';
}

/**
 * Generate Pytest configuration
 */
function generatePytestSetup(config: TestingConfig, result: TestingSetupResult): void {
  result.dependencies.push('pytest');
  result.dependencies.push('pytest-cov');
  result.dependencies.push('pytest-asyncio');
  result.dependencies.push('pytest-mock');

  result.files.push({
    path: 'pytest.ini',
    content: `[pytest]
testpaths = tests
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
addopts =
    --verbose
    --strict-markers
    --cov=src
    --cov-report=term-missing
    --cov-report=html
    --cov-report=xml
    --cov-fail-under=${config.coverageThreshold}
    --tb=short
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
    e2e: marks tests as end-to-end tests
`,
  });

  result.files.push({
    path: 'tests/conftest.py',
    content: `# Pytest configuration
import pytest

@pytest.fixture
def sample_data():
    """Sample data fixture for testing"""
    return {
        "id": 1,
        "name": "Test",
    }

@pytest.fixture
def client():
    """Test client fixture"""
    # Import and configure your test client here
    pass

# Pytest hooks
def pytest_configure(config):
    """Configure pytest markers"""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m "not slow"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "e2e: marks tests as end-to-end tests"
    )
`,
  });

  result.scripts['test'] = 'pytest';
  result.scripts['test:watch'] = 'ptw';
  result.scripts['test:coverage'] = 'pytest --cov --cov-report=html';
  result.scripts['test:ci'] = 'pytest --cov --cov-report=xml --junitxml=test-results.xml';
}

/**
 * Generate Go test configuration
 */
function generateGoTestSetup(config: TestingConfig, result: TestingSetupResult): void {
  result.files.push({
    path: 'Makefile',
    content: `.PHONY: test test-coverage test-race

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Run tests with race detection
test-race:
	go test -race -v ./...

# Run tests and check coverage threshold
test-ci:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | grep total | awk '{if ($$3 + 0 < ${config.coverageThreshold}) { exit 1 }}'
`,
  });
}

/**
 * Generate JUnit configuration
 */
function generateJUnitSetup(config: TestingConfig, result: TestingSetupResult): void {
  result.dependencies.push('org.junit.jupiter:junit-jupiter');
  result.dependencies.push('org.junit.jupiter:junit-jupiter-engine');
  result.dependencies.push('org.mockito:mockito-core');

  result.files.push({
    path: 'src/test/resources/junit-platform.properties',
    content: `junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = concurrent
junit.jupiter.execution.parallel.config.strategy = dynamic
junit.jupiter.testinstance.lifecycle.default = per_class
`,
  });
}

/**
 * Generate CI configuration
 */
function generateCIConfig(config: TestingConfig, result: TestingSetupResult): void {
  // GitHub Actions
  result.files.push({
    path: '.github/workflows/test.yml',
    content: generateGitHubActionsConfig(config),
  });

  // GitLab CI
  result.files.push({
    path: '.gitlab-ci.yml',
    content: generateGitLabCIConfig(config),
  });

  // CircleCI
  result.files.push({
    path: '.circleci/config.yml',
    content: generateCircleCIConfig(config),
  });
}

/**
 * Generate GitHub Actions configuration
 */
function generateGitHubActionsConfig(config: TestingConfig): string {
  return `name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  test-e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
`;
}

/**
 * Generate GitLab CI configuration
 */
function generateGitLabCIConfig(config: TestingConfig): string {
  return `image: node:20

stages:
  - test
  - coverage

variables:
  NODE_ENV: test

cache:
  key: '$\${CI_COMMIT_REF_SLUG}'
  paths:
    - node_modules/

test:
  stage: test
  script:
    - npm ci
    - npm run test:ci
  coverage: '/All files[^|]*\\\\|[^|]*\\\\s+([\\\\d\\\\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 1 week
  only:
    - branches

test:e2e:
  stage: test
  script:
    - npm ci
    - npx playwright install --with-deps
    - npm run test:e2e
  artifacts:
    when: always
    paths:
      - playwright-report/
    expire_in: 1 week
  only:
    - branches
`;
}

/**
 * Generate CircleCI configuration
 */
function generateCircleCIConfig(config: TestingConfig): string {
  return `version: 2.1

orbs:
  node: circleci/node@5.0.3

jobs:
  test:
    docker:
      - image: cimg/node:20.11
    steps:
      - checkout
      - node/install-packages
      - run:
          name: Run tests
          command: npm run test:ci
      - run:
          name: Generate coverage report
          command: npm run test:coverage
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage
          destination: coverage-reports
      - codecov/upload:
          token_name: CODECOV_TOKEN

  test-e2e:
    docker:
      - image: mcr.microsoft.com/playwright:v1.40.0-jammy
    steps:
      - checkout
      - node/install-packages
      - run:
          name: Install Playwright browsers
          command: npx playwright install --with-deps
      - run:
          name: Run E2E tests
          command: npm run test:e2e
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: playwright-report
          destination: playwright-reports

workflows:
  version: 2
  test-workflow:
    jobs:
      - test
      - test-e2e
`;
}

/**
 * Generate test utilities
 */
function generateTestUtils(config: TestingConfig, result: TestingSetupResult): void {
  result.files.push({
    path: 'src/__tests__/utils/test-helpers.ts',
    content: generateTestHelpers(config),
  });

  result.files.push({
    path: 'src/__tests__/mocks/index.ts',
    content: generateTestMocks(config),
  });
}

/**
 * Generate test helpers
 */
function generateTestHelpers(config: TestingConfig): string {
  return `// Test helper functions
import { ${config.language === 'typescript' ? 'type' : ''} MockedFunction } from '${config.testingFramework === 'vitest' ? 'vitest' : 'jest'}';

/**
 * Create a mock function with proper typing
 */
export function createMockFunction<T extends (...args: any[]) => any>(
  impl?: T
): MockedFunction<T> {
  return jest.fn(impl) as MockedFunction<T>;
}

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for next tick
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Flush promises
 */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a mock response object
 */
export function createMockResponse(data: any = {}) {
  return {
    json: jest.fn().mockResolvedValue(data),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    ...data,
  };
}

/**
 * Create a mock request object
 */
export function createMockRequest(params: any = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...params,
  };
}

/**
 * Suppress console output during test
 */
export function suppressConsole() {
  const originalConsole = global.console;
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;

  return () => {
    global.console = originalConsole;
  };
}
`;
}

/**
 * Generate test mocks
 */
function generateTestMocks(config: TestingConfig): string {
  return `// Common test mocks

export const mockEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  API_URL: 'http://localhost:3000',
};

export const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
};

export const mockAuthUser = {
  ...mockUser,
  sub: mockUser.id,
  email_verified: true,
};

// Mock configuration
export const mockConfig = {
  port: 3000,
  database: {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
  },
};
`;
}

/**
 * Generate example tests
 */
function generateExampleTests(config: TestingConfig, result: TestingSetupResult): void {
  if (config.framework === 'nestjs' || config.framework === 'express' || config.framework === 'fastify') {
    result.files.push({
      path: 'src/__tests__/example/api.test.ts',
      content: generateAPIExampleTest(config),
    });
  }

  if (config.framework === 'react' || config.framework === 'vue' || config.framework === 'svelte') {
    result.files.push({
      path: 'src/__tests__/example/component.test.tsx',
      content: generateComponentExampleTest(config),
    });
  }
}

/**
 * Generate API example test
 */
function generateAPIExampleTest(config: TestingConfig): string {
  return `import { describe, it, expect, beforeAll, afterAll } from '${config.testingFramework === 'vitest' ? 'vitest' : '@jest/globals'}';
import request from 'supertest';
import { app } from '../app';

describe('API Example Tests', () => {
  let server: any;

  beforeAll(async () => {
    // Setup server
    server = app.listen();
  });

  afterAll(async () => {
    // Cleanup
    await server.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('Authentication', () => {
    it('should reject requests without auth token', async () => {
      const response = await request(server)
        .get('/api/protected')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should accept requests with valid auth token', async () => {
      const token = 'valid-token-here';
      const response = await request(server)
        .get('/api/protected')
        .set('Authorization', \`Bearer \${token}\`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(server)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(server)
        .post('/api/items')
        .send({ invalid: 'data' })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});
`;
}

/**
 * Generate component example test
 */
function generateComponentExampleTest(config: TestingConfig): string {
  return `import { describe, it, expect } from '${config.testingFramework === 'vitest' ? 'vitest' : '@jest/globals'}';
import { render, screen, fireEvent, waitFor } from '@testing-library/${config.framework}';
import { ExampleComponent } from '../ExampleComponent';

describe('ExampleComponent', () => {
  it('should render component', () => {
    render(<ExampleComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = vi.fn() || jest.fn();
    render(<ExampleComponent title="Test" onClick={handleClick} />);

    fireEvent.click(screen.getByText('Test'));
    await waitFor(() => {
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  it('should update state on interaction', async () => {
    render(<ExampleComponent title="Test" />);
    const button = screen.getByRole('button');

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('Clicked')).toBeInTheDocument();
    });
  });

  it('should render with custom className', () => {
    const { container } = render(
      <ExampleComponent title="Test" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
`;
}

