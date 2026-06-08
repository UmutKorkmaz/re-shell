/**
 * API Testing Suite Generator
 * Generates comprehensive API testing with contract testing, mocking, and load testing
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Test configuration interfaces
export interface APITestConfig {
  framework: string;
  baseUrl?: string;
  specPath?: string;
  outputDir: string;
  testTypes: TestType[];
  includeContractTests: boolean;
  includeMockServer: boolean;
  includeLoadTests: boolean;
}

export type TestType = 'unit' | 'integration' | 'e2e' | 'contract' | 'performance' | 'security';

export interface APITestCase {
  name: string;
  method: string;
  path: string;
  description?: string;
  headers?: Record<string, string>;
  requestBody?: any;
  expectedStatus: number;
  expectedResponse?: any;
  authRequired?: boolean;
  tags?: string[];
}

export interface MockServerConfig {
  port: number;
  host: string;
  cors: boolean;
  latency?: number;
  specPath?: string;
}

export interface LoadTestConfig {
  baseUrl: string;
  duration: number; // seconds
  concurrency: number;
  rampUp: number; // seconds
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage of traffic
  requests: Array<{
    method: string;
    path: string;
    body?: any;
    headers?: Record<string, string>;
    expectedStatus?: number;
  }>;
}

// Contract testing configuration
export interface ContractTestConfig {
  providerName: string;
  consumerName: string;
  pactDir: string;
  specPath: string;
}

// Framework testing templates
export interface FrameworkTestTemplate {
  framework: string;
  language: string;
  testFramework: string;
  unitTestFile: string;
  integrationTestFile: string;
  contractTestFile?: string;
  mockServerFile: string;
  loadTestFile: string;
  dependencies: string[];
  devDependencies: string[];
  setupCommands: string[];
}

// Get testing template for a framework
export function getTestingTemplate(framework: string): FrameworkTestTemplate | undefined {
  const templates: Record<string, FrameworkTestTemplate> = {
    express: {
      framework: 'express',
      language: 'typescript',
      testFramework: 'jest',
      unitTestFile: 'tests/unit/api.test.ts',
      integrationTestFile: 'tests/integration/api.integration.test.ts',
      contractTestFile: 'tests/contract/api.contract.test.ts',
      mockServerFile: 'tests/mocks/server.ts',
      loadTestFile: 'tests/load/api.load.test.ts',
      dependencies: [
        '@types/jest@29.5.12',
        'ts-jest@29.1.2',
        'supertest@6.3.4',
        'msw@2.2.3',
      ],
      devDependencies: [
        'jest@29.7.0',
        '@types/supertest@6.0.2',
      ],
      setupCommands: [
        'npm install --save-dev jest ts-jest @types/jest supertest @types/supertest msw',
        'npx ts-jest config:init',
      ],
    },
    nestjs: {
      framework: 'nestjs',
      language: 'typescript',
      testFramework: 'jest',
      unitTestFile: 'test/unit/api.spec.ts',
      integrationTestFile: 'test/integration/api.integration.spec.ts',
      contractTestFile: 'test/contract/api.contract.spec.ts',
      mockServerFile: 'test/mocks/server.ts',
      loadTestFile: 'test/load/api.load.spec.ts',
      dependencies: [
        '@nestjs/testing@10.3.7',
        '@pact-foundation/pact@14.0.0',
      ],
      devDependencies: [
        'jest@29.7.0',
        '@types/jest@29.5.12',
      ],
      setupCommands: [
        'npm install --save-dev @nestjs/testing @pact-foundation/pact',
      ],
    },
    fastify: {
      framework: 'fastify',
      language: 'typescript',
      testFramework: 'tap',
      unitTestFile: 'tests/unit/api.test.ts',
      integrationTestFile: 'tests/integration/api.integration.test.ts',
      contractTestFile: 'tests/contract/api.contract.test.ts',
      mockServerFile: 'tests/mocks/server.ts',
      loadTestFile: 'tests/load/api.load.test.ts',
      dependencies: [
        'tap@18.6.1',
        'fastify-tsconfig@1.0.1',
      ],
      devDependencies: [
        '@types/tap@18.0.0',
      ],
      setupCommands: [
        'npm install --save-dev tap @types/tap',
      ],
    },
    fastapi: {
      framework: 'fastapi',
      language: 'python',
      testFramework: 'pytest',
      unitTestFile: 'tests/unit/test_api.py',
      integrationTestFile: 'tests/integration/test_api_integration.py',
      contractTestFile: 'tests/contract/test_api_contract.py',
      mockServerFile: 'tests/mocks/server.py',
      loadTestFile: 'tests/load/test_api_load.py',
      dependencies: [
        'pytest@7.4.4',
        'pytest-asyncio@0.21.1',
        'httpx@0.25.2',
        'pytest-mock@3.12.0',
        'aioresponses@0.7.6',
        'locust@2.18.3',
      ],
      devDependencies: [
        'pytest-cov@4.1.0',
        'pytest-aiohttp@1.0.5',
      ],
      setupCommands: [
        'pip install pytest pytest-asyncio httpx pytest-mock aioresponses locust pytest-cov',
      ],
    },
    django: {
      framework: 'django',
      language: 'python',
      testFramework: 'pytest',
      unitTestFile: 'tests/unit/test_api.py',
      integrationTestFile: 'tests/integration/test_api_integration.py',
      contractTestFile: 'tests/contract/test_api_contract.py',
      mockServerFile: 'tests/mocks/server.py',
      loadTestFile: 'tests/load/test_api_load.py',
      dependencies: [
        'pytest@7.4.4',
        'pytest-django@4.7.0',
        'pytest-mock@3.12.0',
        'responses@0.24.1',
        'locust@2.18.3',
        'django-rest-framework@1.0.0',
      ],
      devDependencies: [
        'pytest-cov@4.1.0',
        'factory-boy@3.3.0',
      ],
      setupCommands: [
        'pip install pytest pytest-django pytest-mock responses locust django-rest-framework pytest-cov factory-boy',
      ],
    },
    'aspnet-core': {
      framework: 'aspnet-core',
      language: 'csharp',
      testFramework: 'xunit',
      unitTestFile: 'Tests/Unit/ApiTests.cs',
      integrationTestFile: 'Tests/Integration/ApiIntegrationTests.cs',
      contractTestFile: 'Tests/Contract/ApiContractTests.cs',
      mockServerFile: 'Tests/Mocks/Server.cs',
      loadTestFile: 'Tests/Load/ApiLoadTests.cs',
      dependencies: [
        'Microsoft.NET.Test.Sdk',
        'xunit',
        'xunit.runner.visualstudio',
        'coverlet.collector',
        'Moq',
        'FluentAssertions',
        'Microsoft.AspNetCore.Mvc.Testing',
        'PactNet',
        'NBomber',
      ],
      devDependencies: [],
      setupCommands: [
        'dotnet add package Moq',
        'dotnet add package FluentAssertions',
        'dotnet add package Microsoft.AspNetCore.Mvc.Testing',
        'dotnet add package PactNet',
        'dotnet add package NBomber',
      ],
    },
    'spring-boot': {
      framework: 'spring-boot',
      language: 'java',
      testFramework: 'junit5',
      unitTestFile: 'src/test/java/com/example/api/ApiTests.java',
      integrationTestFile: 'src/test/java/com/example/api/ApiIntegrationTests.java',
      contractTestFile: 'src/test/java/com/example/api/ApiContractTests.java',
      mockServerFile: 'src/test/java/com/example/mocks/Server.java',
      loadTestFile: 'src/test/java/com/example/load/ApiLoadTests.java',
      dependencies: [
        'org.springframework.boot:spring-boot-starter-test',
        'org.springframework.cloud:spring-cloud-starter-contract-verifier',
        'au.com.dius:pact-jvm-provider-junit5',
        'io.gatling:gatling-app',
        'io.gatling.highcharts:gatling-charts-highcharts',
        'org.mockito:mockito-core',
      ],
      devDependencies: [],
      setupCommands: [
        './mvnw test',
      ],
    },
    gin: {
      framework: 'gin',
      language: 'go',
      testFramework: 'go-test',
      unitTestFile: 'api_test.go',
      integrationTestFile: 'api_integration_test.go',
      contractTestFile: 'api_contract_test.go',
      mockServerFile: 'mocks/server.go',
      loadTestFile: 'api_load_test.go',
      dependencies: [
        'github.com/stretchr/testify/assert',
        'github.com/stretchr/testify/mock',
        'github.com/gavv/httpexpect/v2',
        'github.com/pact-foundation/pact-go',
      ],
      devDependencies: [],
      setupCommands: [
        'go get github.com/stretchr/testify/assert',
        'go get github.com/stretchr/testify/mock',
        'go get github.com/gavv/httpexpect/v2',
      ],
    },
    'rust-axum': {
      framework: 'rust-axum',
      language: 'rust',
      testFramework: 'cargo-test',
      unitTestFile: 'tests/api_test.rs',
      integrationTestFile: 'tests/api_integration_test.rs',
      contractTestFile: 'tests/api_contract_test.rs',
      mockServerFile: 'tests/mocks/server.rs',
      loadTestFile: 'tests/api_load_test.rs',
      dependencies: [
        'tokio-test',
        'mockito',
        'wiremock',
        'criterion',
        'reqwest',
        'serde_json',
      ],
      devDependencies: [],
      setupCommands: [
        'cargo add --dev tokio-test mockito wiremock criterion',
        'cargo add reqwest serde_json --features json',
      ],
    },
  };

  return templates[framework];
}

// Generate unit test code
export function generateUnitTestCode(framework: string, testCases: APITestCase[]): string {
  const template = getTestingTemplate(framework);
  if (!template) return `// No test template found for ${framework}`;

  const templates: Record<string, string> = {
    express: `// API Unit Tests for Express
import request from 'supertest';
import { createApp } from '../src/app';

describe('API Unit Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await app.close();
  });

${testCases.map(tc => `  describe('${tc.description || tc.method + ' ' + tc.path}', () => {
    it('should return ${tc.expectedStatus}', async () => {
      const response = await request(app)
        .${tc.method.toLowerCase()}('${tc.path}')
        ${tc.authRequired ? ".set('Authorization', 'Bearer test-token')" : ''}
        ${tc.requestBody ? `.send(${JSON.stringify(tc.requestBody)})` : '.send()'};

      expect(response.status).toBe(${tc.expectedStatus});
      ${tc.expectedResponse ? `expect(response.body).toMatchObject(${JSON.stringify(tc.expectedResponse)});` : ''}
    });
  });
`).join('\n')}
});`,
    nestjs: `// API Unit Tests for NestJS
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('API Unit Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

${testCases.map(tc => `  describe('${tc.description || tc.method + ' ' + tc.path}', () => {
    it('/${tc.method.toLowerCase()}${tc.path} (${tc.expectedStatus})', () => {
      return request(app.getHttpServer())
        .${tc.method.toLowerCase()}('${tc.path}')
        ${tc.authRequired ? ".set('Authorization', 'Bearer test-token')" : ''}
        ${tc.requestBody ? `.send(${JSON.stringify(tc.requestBody)})` : '.send()'}
        .expect(${tc.expectedStatus});
    });
  });
`).join('\n')}
});`,
    fastapi: `# API Unit Tests for FastAPI
import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
${testCases.map(tc => `async def test_${tc.name.replace(/\s+/g, '_').toLowerCase()}():
    """Test ${tc.description || tc.path}"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.${tc.method.toLowerCase()}("${tc.path}"${tc.requestBody ? `, json=${JSON.stringify(tc.requestBody)}` : ''}${tc.authRequired ? ', headers={"Authorization": "Bearer test-token"}' : ''})
        assert response.status_code == ${tc.expectedStatus}
        ${tc.expectedResponse ? `assert response.json() == ${JSON.stringify(tc.expectedResponse)}` : ''}`).join('\n\n')}`,
    django: `# API Unit Tests for Django
import pytest
from django.test import Client
from django.urls import reverse

@pytest.mark.django_db
${testCases.map(tc => `def test_${tc.name.replace(/\s+/g, '_').toLowerCase()}():
    """Test ${tc.description || tc.path}"""
    client = Client()
    ${tc.authRequired ? 'client.force_login(test_user)' : ''}
    response = client.${tc.method.toLowerCase()}("${tc.path}"${tc.requestBody ? `, data=${JSON.stringify(tc.requestBody)}, content_type="application/json"` : ''})
    assert response.status_code == ${tc.expectedStatus}
    ${tc.expectedResponse ? `assert response.json() == ${JSON.stringify(tc.expectedResponse)}` : ''}`).join('\n\n')}`,
    'aspnet-core': `// API Unit Tests for ASP.NET Core
using Xunit;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;

public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

${testCases.map(tc => {
    const method = tc.method.charAt(0).toUpperCase() + tc.method.slice(1).toLowerCase();
    let arrange = '';
    if (tc.requestBody) {
        const props = Object.entries(tc.requestBody).map(([k, v]) => {
            const val = typeof v === 'string' ? `"${v}"` : String(v);
            return `${k} = ${val}`;
        }).join(', ');
        arrange = `\n        // Arrange\n        var payload = new { ${props} };`;
    }
    return `    [Fact]
    public async Task ${tc.name.replace(/\s+/g, '_')}_${method}_Returns_${tc.expectedStatus}()
    {${arrange}

        // Act
        var response = await _client.${method}Async("${tc.path}"${tc.requestBody ? ', JsonContent.Create(payload)' : ''});

        // Assert
        response.StatusCode.Should().Be(${tc.expectedStatus});
    }
`;
}).join('\n')}
}`,
    'spring-boot': `// API Unit Tests for Spring Boot
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ApiTests {

    @Autowired
    private MockMvc mockMvc;

${testCases.map(tc => {
    const contentLine = tc.requestBody ? `\n            .contentType(MediaType.APPLICATION_JSON)\n            .content("${JSON.stringify(tc.requestBody).replace(/"/g, '\\"')}")` : '';
    return `    @Test
    void ${tc.name.replace(/\s+/g, '_').toLowerCase()}() throws Exception {
        mockMvc.perform(${tc.method.toLowerCase()}("${tc.path}")
            ${tc.authRequired ? `.header("Authorization", "Bearer test-token")` : ''}${contentLine})
            .andExpect(status().is${tc.expectedStatus === 200 ? 'Ok' : tc.expectedStatus === 201 ? 'Created' : tc.expectedStatus === 204 ? 'NoContent' : 'BadRequest'}());
    }
`;
}).join('\n')}
}`,
    gin: `// API Unit Tests for Gin
package main

import (
    "bytes"
    "net/http"
    "net/http/httptest"
    "testing"
    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
    "encoding/json"
)

func setupRouter() *gin.Engine {
    r := gin.Default()
    // Setup routes
    return r
}

${testCases.map(tc => {
    const bodyLine = tc.requestBody ? `\n    payload, _ := json.Marshal(${JSON.stringify(tc.requestBody)})` : '';
    const bufferArg = tc.requestBody ? ', bytes.NewBuffer(payload)' : '';
    return `func Test${tc.name.replace(/\s+/g, '')}(t *testing.T) {
    router := setupRouter()
    w := httptest.NewRecorder()${bodyLine}

    req, _ := http.NewRequest("${tc.method.toUpperCase()}", "${tc.path}"${bufferArg})
    ${tc.authRequired ? `req.Header.Set("Authorization", "Bearer test-token")` : ''}
    router.ServeHTTP(w, req)

    assert.Equal(t, ${tc.expectedStatus}, w.Code)
}`;
}).join('\n\n')}`,
    'rust-axum': `// API Unit Tests for Rust Axum
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;

#[tokio::test]
${testCases.map(tc => `async fn test_${tc.name.replace(/\s+/g, '_').toLowerCase()}() {
    let app = create_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method("${tc.method.toUpperCase()}")
                .uri("${tc.path}")
                ${tc.authRequired ? '.header("Authorization", "Bearer test-token")' : ''}
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::from_u16(${tc.expectedStatus}).unwrap());
}`).join('\n\n')}
`,
  };

  return templates[framework] || `// No unit test template for ${framework}`;
}

// Generate integration test code
export function generateIntegrationTestCode(framework: string, testCases: APITestCase[]): string {
  const template = getTestingTemplate(framework);
  if (!template) return `// No integration test template found for ${framework}`;

  const templates: Record<string, string> = {
    express: `// API Integration Tests for Express
import request from 'supertest';
import { createApp } from '../src/app';
import { setupDatabase, teardownDatabase } from './helpers';

describe('API Integration Tests', () => {
  let app: Application;
  let db: any;

  beforeAll(async () => {
    db = await setupDatabase();
    app = createApp({ database: db });
  });

  afterAll(async () => {
    await teardownDatabase(db);
    await app.close();
  });

  beforeEach(async () => {
    await db.migrate.rollback();
    await db.migrate.latest();
    await db.seed();
  });

${testCases.map(tc => `  describe('${tc.description || tc.method + ' ' + tc.path}', () => {
    it('should persist data to database', async () => {
      const response = await request(app)
        .${tc.method.toLowerCase()}('${tc.path}')
        ${tc.requestBody ? `.send(${JSON.stringify(tc.requestBody)})` : '.send()'};

      expect(response.status).toBe(${tc.expectedStatus});

      // Verify in database
      const record = await db('table_name').where({ id: response.body.id }).first();
      expect(record).toBeDefined();
    });
  });
`).join('\n')}
});`,
    nestjs: `// API Integration Tests for NestJS
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('API Integration Tests', () => {
  let app: INestApplication;
  let repository: Repository<any>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    repository = moduleFixture.get<Repository<any>>(getRepositoryToken(Entity));
    await app.init();
  });

  afterEach(async () => {
    await repository.query('DELETE FROM entities');
    await app.close();
  });

${testCases.map(tc => `  describe('${tc.description || tc.method + ' ' + tc.path}', () => {
    it('should persist data to database', async () => {
      const response = await request(app.getHttpServer())
        .${tc.method.toLowerCase()}('${tc.path}')
        ${tc.requestBody ? `.send(${JSON.stringify(tc.requestBody)})` : '.send()'};

      expect(response.status).toBe(${tc.expectedStatus});

      const saved = await repository.findOne({ where: { id: response.body.id } });
      expect(saved).toBeDefined();
    });
  });
`).join('\n')}
});`,
    fastapi: `# API Integration Tests for FastAPI
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from main import app, get_db

@pytest_asyncio.fixture
async def db_session():
    async with async_session() as session:
        yield session

@pytest.mark.asyncio
${testCases.map(tc => `async def test_${tc.name.replace(/\s+/g, '_').toLowerCase()}_integration(db_session: AsyncSession):
    """Test ${tc.description || tc.path} with database"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.${tc.method.toLowerCase()}("${tc.path}"${tc.requestBody ? `, json=${JSON.stringify(tc.requestBody)}` : ''})

        assert response.status_code == ${tc.expectedStatus}

        # Verify in database
        result = await db_session.execute(select(Entity).where(Entity.id == response.json()["id"]))
        entity = result.scalar_one()
        assert entity is not None`).join('\n\n')}`,
    django: `# API Integration Tests for Django
import pytest
from django.test import Client
from django.urls import reverse
from .models import YourModel

@pytest.mark.django_db
${testCases.map(tc => `def test_${tc.name.replace(/\s+/g, '_').toLowerCase()}_integration():
    """Test ${tc.description || tc.path} with database"""
    initial_count = YourModel.objects.count()

    client = Client()
    response = client.${tc.method.toLowerCase()}("${tc.path}"${tc.requestBody ? `, data=${JSON.stringify(tc.requestBody)}, content_type="application/json"` : ''})

    assert response.status_code == ${tc.expectedStatus}

    # Verify in database
    assert YourModel.objects.count() == initial_count + 1`).join('\n\n')}`,
    'aspnet-core': `// API Integration Tests for ASP.NET Core
using Xunit;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Json;

public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly WebApplicationFactory<Program> _factory;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    services.AddDbContext<AppDbContext>(options =>
                        options.UseInMemoryDatabase("TestDb"));
                });
            })
            .CreateClient();
    }

${testCases.map(tc => `    [Fact]
    public async Task ${tc.name.replace(/\s+/g, '_')}_Integration()
    {
        // Arrange
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await context.Database.EnsureCreatedAsync();

        // Act
        var response = await _client.${tc.method.charAt(0).toUpperCase() + tc.method.slice(1).toLowerCase()}Async("${tc.path}");

        // Assert
        response.StatusCode.Should().Be(${tc.expectedStatus});
    }
`).join('\n')}
}`,
    'spring-boot': `// API Integration Tests for Spring Boot
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EntityRepository repository;

${testCases.map(tc => `    @Test
    void ${tc.name.replace(/\s+/g, '_').toLowerCase()}() throws Exception {
        long initialCount = repository.count();

        mockMvc.perform(${tc.method.toLowerCase()}("${tc.path}")
            ${tc.requestBody ? `.contentType(MediaType.APPLICATION_JSON).content("${JSON.stringify(tc.requestBody).replace(/"/g, '\\"')}")` : ''})
            .andExpect(status().is${tc.expectedStatus === 200 ? 'Ok' : tc.expectedStatus === 201 ? 'Created' : 'BadRequest'}());

        assertThat(repository.count()).isEqualTo(initialCount + 1);
    }
`).join('\n')}
}`,
    gin: `// API Integration Tests for Gin
package main

import (
    "net/http"
    "net/http/httptest"
    "testing"
    "github.com/gin-gonic/gin"
    "github.com/stretchr/testify/assert"
    "gorm.io/gorm"
)

${testCases.map(tc => `func Test${tc.name.replace(/\s+/g, '')}_Integration(t *testing.T) {
    db := setupTestDB()
    defer cleanupTestDB(db)

    router := setupRouter(db)

    w := httptest.NewRecorder()
    req, _ := http.NewRequest("${tc.method.toUpperCase()}", "${tc.path}", nil)
    router.ServeHTTP(w, req)

    assert.Equal(t, ${tc.expectedStatus}, w.Code)

    // Verify in database
    var result Entity
    db.First(&result, w.Body.(*json).Get("id"))
    assert.NotNil(t, result)
}`).join('\n\n')}`,
    'rust-axum': `// API Integration Tests for Rust Axum
use sqlx::SqlitePool;

#[sqlx::test]
${testCases.map(tc => `async fn test_${tc.name.replace(/\s+/g, '_').toLowerCase()}_integration(pool: SqlitePool) {
    let app = create_app(pool.clone()).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("${tc.method.toUpperCase()}")
                .uri("${tc.path}")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::from_u16(${tc.expectedStatus}).unwrap());

    // Verify in database
    let result = sqlx::query!("SELECT COUNT(*) as count FROM entities")
        .fetch_one(&pool)
        .await;
    assert!(result.count > 0);
}`).join('\n\n')}
`,
  };

  return templates[framework] || `// No integration test template for ${framework}`;
}

// Generate contract test code
export function generateContractTestCode(framework: string, config: ContractTestConfig): string {
  const templates: Record<string, string> = {
    express: `// API Contract Tests for Express using Pact
import { Pact } from '@pact-foundation/pact';
import { resolve } from 'path';

describe('API Contract Tests', () => {
  const provider = new Pact({
    consumer: '${config.consumerName}',
    provider: '${config.providerName}',
    dir: resolve(__dirname, '${config.pactDir}'),
    logLevel: 'INFO',
  });

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  afterEach(async () => {
    await provider.verify();
  });

  describe('User API Contract', () => {
    beforeEach(async () => {
      await provider.addInteraction({
        state: 'user exists',
        uponReceiving: 'a request for user',
        withRequest: {
          method: 'GET',
          path: '/api/users/1',
        },
        willRespondWith: {
          status: 200,
          body: {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      });
    });

    it('should return user data', async () => {
      const response = await fetch(provider.mockService.baseUrl + '/api/users/1');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe(1);
    });
  });
});`,
    nestjs: `// API Contract Tests for NestJS using Pact
import { Pact } from '@pact-foundation/pact';
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';

describe('API Contract Tests', () => {
  let app;

  const provider = new Pact({
    consumer: '${config.consumerName}',
    provider: '${config.providerName}',
    dir: './pacts',
    logLevel: 'INFO',
  });

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe('User API Contract', () => {
    it('should verify contract with provider', async () => {
      await provider.addInteraction({
        state: 'user exists',
        uponReceiving: 'a request for user',
        withRequest: {
          method: 'GET',
          path: '/users/1',
          headers: { Authorization: 'Bearer token' },
        },
        willRespondWith: {
          status: 200,
          body: like({
            id: like(1),
            name: like('John Doe'),
            email: like('john@example.com'),
          }),
        },
      });

      const response = await fetch(provider.mockService.baseUrl + '/users/1', {
        headers: { Authorization: 'Bearer token' },
      });

      expect(response.status).toBe(200);
    });
  });
});`,
    fastapi: `# API Contract Tests for FastAPI using Pact Python
import pytest
from pact import Consumer, Provider
import requests

@pytest.fixture
def pact():
    pact = Consumer('${config.consumerName}')
    pact.has_pact_with(Provider('${config.providerName}'))
    return pact

def test_user_api_contract(pact):
    (pact
     .given('user exists')
     .upon_receiving('a request for user')
     .with_request('GET', '/api/users/1')
     .will_respond_with(200, body={
         'id': 1,
         'name': 'John Doe',
         'email': 'john@example.com'
     }))

    with pact:
        response = requests.get(f'{pact.uri}/api/users/1')
        assert response.status_code == 200
        data = response.json()
        assert data['id'] == 1`,
    django: `# API Contract Tests for Django using Pact Python
import pytest
from pact import Consumer, Provider
from django.test import Client

@pytest.fixture
def pact():
    pact = Consumer('${config.consumerName}')
    pact.has_pact_with(Provider('${config.providerName}'))
    return pact

def test_api_contract(pact):
    (pact
     .given('resource exists')
     .upon_receiving('a request for resource')
     .with_request('GET', '/api/v1/resource/1/')
     .will_respond_with(200, body={
         'id': 1,
         'name': 'Test Resource'
     }))

    with pact:
        client = Client()
        response = client.get('/api/v1/resource/1/')
        assert response.status_code == 200`,
    'aspnet-core': `// API Contract Tests for ASP.NET Core using Pact Net
using Xunit;
using PactNet;
using PactNet.Output.Xunit;
using System.Net.Http;
using System.Text.Json;

public class ApiContractTests : IClassFixture<PactProviderFixture>
{
    private readonly PactProviderFixture _fixture;
    private readonly HttpClient _client;

    public ApiContractTests(PactProviderFixture fixture)
    {
        _fixture = fixture;
        _client = new HttpClient { BaseAddress = new Uri(fixture.MockServerUrl) };
    }

    [Fact]
    public async Task GetUser_ShouldReturnExpectedResponse()
    {
        // Arrange
        _fixture.MockProviderService
            .Given("user exists")
            .UponReceiving("a request for user")
            .WithRequest(HttpMethod.Get, "/api/users/1")
            .WillRespond()
            .WithStatus(200)
            .WithJsonBody(new { id = 1, name = "John Doe", email = "john@example.com" });

        // Act
        var response = await _client.GetAsync("/api/users/1");

        // Assert
        _fixture.VerifyInteractions();
        response.EnsureSuccessStatusCode();
    }
}`,
    'spring-boot': `// API Contract Tests for Spring Boot using Spring Cloud Contract
import org.junit.jupiter.api.Test;
import org.springframework.cloud.contract.verifier.context.contract.Contract;
import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static io.restassured.RestAssured.*;
import io.restassured.response.ValidatableResponse;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class ApiContractTests {

    @Test
    void should_validate_contract() {
        given()
            .port(8080)
            .basePath("/api")
        .when()
            .get("/users/1")
        .then()
            .statusCode(200)
            .body("id", equalTo(1))
            .body("name", equalTo("John Doe"))
            .body("email", equalTo("john@example.com"));
    }
}`,
    gin: `// API Contract Tests for Gin using Pact Go
package main

import (
    "testing"
    "github.com/pact-foundation/pact-go/v2/consumer"
    "github.com/stretchr/testify/assert"
)

func TestAPIContract(t *testing.T) {
    pact, _ := consumer.NewV2Pact(consumer.MockServerConfig{
        Consumer: "${config.consumerName}",
        Provider: "${config.providerName}",
    })

    pact.AddInteraction().
        Given("user exists").
        UponReceiving("a request for user").
        WithRequest("GET", "/api/users/1").
        WillRespondWith(200, map[string]interface{}{
            "id":    1,
            "name":  "John Doe",
            "email": "john@example.com",
        })

    response, _ := http.Get(pact.Interactions[0].Request.Path)
    assert.Equal(t, 200, response.StatusCode)
}`,
    'rust-axum': `// API Contract Tests for Rust Axum using Pact
use pact_consumer::prelude::*;
use pact_consumer::patterns::matching;

#[tokio::test]
async fn test_api_contract() {
    let mut pact = PactBuilder::new_v4("${config.consumerName}", "${config.providerName}")
        .interaction("a request for user", |i| {
            i.given("user exists");
            i.request.path("/api/users/1");
            i.response.status(200)
                .json_body(json_pattern!({
                    "id": 1i64,
                    "name": "John Doe",
                    "email": "john@example.com"
                }));
        })
        .start_mock_server(None)
        .await;

    let response = reqwest::get(format!("{}/api/users/1", pact.url())).await.unwrap();
    assert_eq!(200, response.status().as_u16());
}
`,
  };

  return templates[framework] || `// No contract test template for ${framework}`;
}

// Generate mock server code
export function generateMockServerCode(framework: string, config: MockServerConfig): string {
  const templates: Record<string, string> = {
    express: `// Mock Server for Express using MSW
import { setupServer, rest } from 'msw';

export const mockServer = setupServer(
  // Example: Mock user endpoints
  rest.get('/api/users', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ])
    );
  }),

  rest.get('/api/users/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.status(200),
      ctx.json({ id: parseInt(id), name: 'John Doe', email: 'john@example.com' })
    );
  }),

  rest.post('/api/users', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({ id: 3, ...req.body })
    );
  }),

  // Add more mocks as needed
);

// For Vitest/Jest setup
export { rest };

// Start server in tests
export function startMockServer() {
  mockServer.listen({ onUnhandledRequest: 'error' });
}

export function stopMockServer() {
  mockServer.close();
}

// Reset handlers between tests
export function resetMockServer() {
  mockServer.resetHandlers();
}`,
    nestjs: `// Mock Server for NestJS
import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const mockServer = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json([
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ])
    );
  }),

  rest.get('/api/users/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.status(200),
      ctx.json({ id: parseInt(id), name: 'John Doe', email: 'john@example.com' })
    );
  }),
);

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());`,
    fastapi: `# Mock Server for FastAPI using aioresponses
from aioresponses import aioresponses
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

# Mock HTTP responses for external service calls
@pytest.fixture
def mock_aiohttp():
    with aioresponses() as m:
        # Mock external API calls
        m.get('https://api.external.com/users', payload=[
            {'id': 1, 'name': 'John Doe'},
            {'id': 2, 'name': 'Jane Smith'},
        ])
        yield m

# Alternative: Mock database queries
@pytest.fixture
def mock_db_session(mocker):
    mock_session = mocker.Mock()
    mock_session.query.return_value.all.return_value = [
        {'id': 1, 'name': 'John Doe'},
        {'id': 2, 'name': 'Jane Smith'},
    ]
    return mock_session`,
    django: `# Mock Server for Django using responses
import responses
from unittest.mock import Mock, patch

@pytest.fixture
def mock_responses():
    responses.start()
    responses.add(
        responses.GET,
        'https://api.external.com/users',
        json=[{'id': 1, 'name': 'John Doe'}],
        status=200,
    )
    yield responses
    responses.stop()
    responses.reset()

# Mock Django ORM
@pytest.fixture
def mock_queryset():
    mock_qs = Mock()
    mock_qs.all.return_value = [
        Mock(id=1, name='John Doe'),
        Mock(id=2, name='Jane Smith'),
    ]
    return mock_qs`,
    'aspnet-core': `// Mock Server for ASP.NET Core using WireMock.Net
using WireMock.RequestBuilders;
using WireMock.ResponseProviders;
using WireMock.Server;

public class MockServer : IDisposable
{
    private readonly WireMockServer _server;

    public MockServer(int port = ${config.port})
    {
        _server = WireMockServer.Start(port);

        // Setup mock responses
        _server
            .Given(Request.Create()
                .WithPath("/api/users")
                .UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithHeader("Content-Type", "application/json")
                .WithBody(@"[{""id"":1,""name"":""John Doe""}]"));

        _server
            .Given(Request.Create()
                .WithPath("/api/users/*")
                .UsingGet())
            .RespondWith(Response.Create()
                .WithStatusCode(200)
                .WithHeader("Content-Type", "application/json")
                .WithBody(@"{""id"":1,""name"":""John Doe""}"));
    }

    public string Url => _server.Urls[0];

    public void Dispose()
    {
        _server.Stop();
        _server.Dispose();
    }
}`,
    'spring-boot': `// Mock Server for Spring Boot using WireMock
import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import static com.github.tomakehurst.wiremock.client.WireMock.*;

@Component
public class MockServerConfig {

    private final WireMockServer wireMockServer;

    public MockServerConfig() {
        this.wireMockServer = new WireMockServer(${config.port});
        this.wireMockServer.start();
    }

    @PostConstruct
    public void configureMocks() {
        wireMockServer.stubFor(get(urlPathEqualTo("/api/users"))
            .willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("[{\\"id\\":1,\\"name\\":\\"John Doe\\"}]")));

        wireMockServer.stubFor(get(urlPathMatching("/api/users/.*"))
            .willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("{\\"id\\":1,\\"name\\":\\"John Dove\\"}")));
    }

    @PreDestroy
    public void stopServer() {
        wireMockServer.stop();
    }
}`,
    gin: `// Mock Server for Gin using httptest
package main

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
)

// Mock HTTP server for testing
func startMockServer() *httptest.Server {
    return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        switch r.URL.Path {
        case "/api/users":
            users := []map[string]interface{}{
                {"id": 1, "name": "John Doe"},
                {"id": 2, "name": "Jane Smith"},
            }
            json.NewEncoder(w).Encode(users)
        case "/api/users/1":
            user := map[string]interface{}{"id": 1, "name": "John Doe"}
            json.NewEncoder(w).Encode(user)
        default:
            w.WriteHeader(http.StatusNotFound)
        }
    }))
}`,
    'rust-axum': `// Mock Server for Rust Axum using wiremock
use wiremock::{MockServer, Mock, ResponseTemplate};
use wiremock::matchers::{method, path};

pub async fn start_mock_server() -> MockServer {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/users"))
        .respond_with(ResponseTemplate::new(200).set_body_json(
            serde_json::json!([
                {"id": 1, "name": "John Doe"},
                {"id": 2, "name": "Jane Smith"}
            ])
        ))
        .mount(&mock_server)
        .await;

    mock_server
}`,
  };

  return templates[framework] || `// No mock server template for ${framework}`;
}

// Generate load test code
export function generateLoadTestCode(framework: string, config: LoadTestConfig): string {
  const templates: Record<string, string> = {
    express: `// Load Tests for Express using Artillery
// Save as: load-tests.yml
config:
  target: ${config.baseUrl}
  phases:
    - duration: ${config.rampUp}
      arrivalRate: 1
      name: Warm up
    - duration: ${config.duration}
      arrivalRate: ${config.concurrency}
      name: Sustained load

scenarios:
${config.scenarios.map(s => {
    const scenarioLines = s.requests.map(r => {
        const headers = r.headers ? Object.entries(r.headers).map(([k, v]) => `            ${k}: "${v}"`).join('\n') : '';
        const headersBlock = r.headers ? `          headers:\n${headers}` : '';
        const bodyLine = r.body ? `          json: ${JSON.stringify(r.body)}` : '';
        return `      - ${r.method.toLowerCase()}:\n          url: "${r.path}"\n${headersBlock}${bodyLine ? '\n' + bodyLine : ''}`;
    }).join('\n');
    return `  - name: ${s.name}\n    weight: ${s.weight}\n    flow:\n${scenarioLines}`;
}).join('\n\n')}`,
    nestjs: `// Load Tests for NestJS using k6
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '${config.rampUp}s', target: ${Math.floor(config.concurrency / 2)} },
    { duration: '${config.duration}s', target: ${config.concurrency} },
    { duration: '30s', target: 0 },
  ],
};

const BASE_URL = '${config.baseUrl}';

export default function () {
${config.scenarios.map((s, i) => {
    const requestLines = s.requests.map(r => {
        const status = r.expectedStatus || 200;
        const bodyArg = r.body ? `, JSON.stringify(${JSON.stringify(r.body)})` : '';
        return `    let response = http.${r.method.toLowerCase()}(\`\${BASE_URL}${r.path}\`${bodyArg});
    check(response, {
      'status is ${status}': r => r.status === ${status},
    });`;
    }).join('\n');
    return `  // Scenario: ${s.name}
  if (Math.random() < ${s.weight / 100}) {
${requestLines}
  }
`;
}).join('\n\n')}
  sleep(1);
}`,
    fastapi: `# Load Tests for FastAPI using Locust
# Save as: locustfile.py
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)
    host = "${config.baseUrl}"

${config.scenarios.map(s => {
    const requestLines = s.requests.map(r => {
        const bodyArg = r.body ? `, json=${JSON.stringify(r.body)}` : '';
        const status = r.expectedStatus || 200;
        return `        response = self.client.${r.method.toLowerCase()}("${r.path}"${bodyArg})
        assert response.status_code == ${status}`;
    }).join('\n');
    return `    @task(${s.weight})
    def ${s.name.replace(/\s+/g, '_').toLowerCase()}(self):
${requestLines}`;
}).join('\n\n')}`,
    django: `# Load Tests for Django using Locust
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)
    host = "${config.baseUrl}"

${config.scenarios.map(s => {
    const requestLines = s.requests.map(r => {
        const bodyArg = r.body ? `, json=${JSON.stringify(r.body)}` : '';
        return `        self.client.${r.method.toLowerCase()}("${r.path}"${bodyArg})`;
    }).join('\n        ');
    return `    @task(${s.weight})
    def ${s.name.replace(/\s+/g, '_').toLowerCase()}(self):
${requestLines}`;
}).join('\n\n')}`,
    'aspnet-core': `// Load Tests for ASP.NET Core using NBomber
using NBomber.CPerf;
using NBomber.Contracts;
using NBomber.Http.CSharp;

var scenario = Scenario.Create("${config.scenarios[0]?.name || 'api_load'}", async context =>
{
    var requests = ${JSON.stringify(config.scenarios[0]?.requests || [])};

    return await Http.Create(context)
        .WithRequest(context.CustomSettings["Url"] + "/api/endpoint")
        .Execute();
})
    .WithLoadSimulations(
        Simulation.Inject(rate: ${config.concurrency}, interval: TimeSpan.FromSeconds(1), during: TimeSpan.FromSeconds(${config.duration}))
    );

NBomberRunner
    .RegisterScenarios(scenario)
    .Run();`,
    'spring-boot': `// Load Tests for Spring Boot using Gatling
import io.gatling.javaapi.core.*
import io.gatling.javaapi.http.*
import io.gatling.javaapi.core.CoreDsl.*

class ApiLoadTest : Simulation() {
    val httpProtocol = http
        .baseUrl("${config.baseUrl}")
        .acceptHeader("application/json")

    val scn = scenario("API Load Test")
${config.scenarios.map((s, i) => `${i > 0 ? '.exec(' : ''}${s.requests.map(r => `exec(http("${r.method} ${r.path}")
            .httpRequest("${r.method.toUpperCase()}", "${r.path}")
            .check(status().is(${r.expectedStatus || 200})))`).join('\n            .')}`).join('\n        ')}

    setUp(
        scn.injectOpen(
            rampUsersPerSec(1).to(${config.concurrency}).during(Duration.ofSeconds(${config.rampUp})),
            constantUsersPerSec(${config.concurrency}).during(Duration.ofSeconds(${config.duration}))
        )
    ).protocols(httpProtocol)
}`,
    gin: `// Load Tests for Go using vegeta
package main

import (
    "fmt"
    "net/http"
    "time"

    "github.com/tsenart/vegeta/lib"
)

func main() {
    rate := vegeta.Rate{Freq: ${config.concurrency}, Per: time.Second}
    duration := ${config.duration} * time.Second
    targeter := vegeta.NewStaticTargeter(vegeta.Target{
        Method: "GET",
        URL:    "${config.baseUrl}/api/users",
    })
    attacker := vegeta.NewAttacker()

    var metrics vegeta.Metrics
    for res := range attacker.Attack(targeter, rate, duration, "Big Bang!") {
        metrics.Add(res)
    }
    metrics.Close()

    fmt.Printf("Requests: %d\\n", metrics.Requests)
    fmt.Printf("Success: %.2f%%\\n", metrics.Success*100)
    fmt.Printf("Latencies:\\n%s\\n", metrics.Latencies)
}`,
    'rust-axum': `// Load Tests for Rust using golem
use golem::scenario::Scenario;
use golem::context::GolemContext;

fn main() {
    let scenarios = vec![
${config.scenarios.map(s => `        Scenario::new("${s.name}")
            .request(|ctx| {
                ctx.http("${config.baseUrl}/api/endpoint")
                    .method("GET")
                    .send()
            }),`).join('\n')},
    ];

    GolemContext::new()
        .parallel_requests(${config.concurrency})
        .duration(std::time::Duration::from_secs(${config.duration}))
        .run(scenarios);
}
`,
  };

  return templates[framework] || `// No load test template for ${framework}`;
}

// Generate test configuration file
export function generateTestConfig(framework: string, testTypes: TestType[]): string {
  const config: Record<string, string> = {
    express: `// Jest configuration for API testing
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};`,
    nestjs: `// Jest configuration for NestJS
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.(spec|e2e-spec)\\.(ts|js)$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};`,
    fastapi: `# Pytest configuration
[tool.pytest.ini_options]
minversion = "7.0"
addopts = "-ra -q --strict-markers --cov=src --cov-report=term-missing --cov-report=html"
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
markers = [
    "unit: Unit tests",
    "integration: Integration tests",
    "contract: Contract tests",
    "slow: Slow running tests",
]
asyncio_mode = "auto"`,
    django: `# Pytest configuration for Django
[tool.pytest.ini_options]
minversion = "7.0"
addopts = "-ra -q --ds=config.settings.test --strict-markers --cov=src"
testpaths = ["tests"]
django_find_project = false
markers = [
    "unit: Unit tests",
    "integration: Integration tests",
    "contract: Contract tests",
    "django_db: Database tests",
]`,
    'aspnet-core': `<!-- xUnit configuration for ASP.NET Core -->
<RunSettings>
  <DataCollectionRunSettings>
    <DataCollectors>
      <DataCollector friendlyName="Code Coverage">
        <Configuration>
          <CodeCoverage>
            <ModulePaths>
              <Exclude>
                <ModulePath>.*Tests\\.dll</ModulePath>
              </Exclude>
            </ModulePaths>
          </CodeCoverage>
        </Configuration>
      </DataCollector>
    </DataCollectors>
  </DataCollectionRunSettings>
</RunSettings>`,
    'spring-boot': `# JUnit configuration for Spring Boot
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = concurrent
junit.jupiter.execution.parallel.mode.classes.default = concurrent

# Test coverage
jacoco.coverage.minimum = 0.80`,
    gin: `# Go test configuration
# Create a go.test.config file
# No specific config needed, use go test with flags

# Example test command:
# go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
# go tool cover -html=coverage.out`,
    'rust-axum': `# Cargo test configuration for Rust
# In .cargo/config.toml:
[build]
rustflags = ["-C", "link-args=-rdynamic"]

# Run tests with:
# cargo test --workspace
# cargo test --release

# For coverage:
# cargo install cargo-tarpaulin
# cargo tarpaulin --workspace --out Html`,
  };

  return config[framework] || `// No test config template for ${framework}`;
}

// Format for display
export function formatAPITestConfig(config: APITestConfig): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('\n🧪 API Testing Configuration'));
  lines.push(chalk.gray('═'.repeat(60)));
  lines.push(`\n${chalk.blue('Framework:')} ${config.framework}`);
  lines.push(`${chalk.blue('Test Types:')} ${config.testTypes.join(', ')}`);
  lines.push(`${chalk.blue('Output Directory:')} ${config.outputDir}`);

  if (config.baseUrl) {
    lines.push(`${chalk.blue('Base URL:')} ${config.baseUrl}`);
  }

  if (config.includeContractTests) {
    lines.push(`${chalk.blue('Contract Tests:')} Enabled`);
  }
  if (config.includeMockServer) {
    lines.push(`${chalk.blue('Mock Server:')} Enabled`);
  }
  if (config.includeLoadTests) {
    lines.push(`${chalk.blue('Load Tests:')} Enabled`);
  }

  return lines.join('\n');
}

// List all supported frameworks
export function listTestingFrameworks(): Array<{ name: string; language: string; testFramework: string }> {
  const frameworks = ['express', 'nestjs', 'fastify', 'fastapi', 'django', 'aspnet-core', 'spring-boot', 'gin', 'rust-axum'];

  return frameworks.map(f => {
    const template = getTestingTemplate(f);
    return {
      name: f,
      language: template?.language || 'unknown',
      testFramework: template?.testFramework || 'unknown',
    };
  });
}
