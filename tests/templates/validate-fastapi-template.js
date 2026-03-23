#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🐍 Testing FastAPI Template Implementation');
console.log('=========================================');

const testResults = {
  timestamp: new Date().toISOString(),
  version: '0.14.0',
  fastApiTest: {
    templateName: 'FastAPI + Python',
    templateFile: 'fastapi-py.ts',
    exists: false,
    features: {},
    featureCount: 0,
    passedFeatures: 0,
    failedFeatures: 0
  }
};

// FastAPI template test cases
const fastApiTests = [
  // Core Framework Tests
  {
    name: 'FastAPI Dependency',
    test: (content) => content.includes("fastapi: '^0.104.1'"),
    description: 'Template includes FastAPI framework',
    critical: true
  },
  {
    name: 'Uvicorn Server',
    test: (content) => content.includes("uvicorn: '^0.24.0'"),
    description: 'Template includes Uvicorn ASGI server',
    critical: true
  },
  {
    name: 'Pydantic V2',
    test: (content) => content.includes("pydantic: '^2.5.0'"),
    description: 'Template includes Pydantic V2 for validation',
    critical: true
  },
  {
    name: 'SQLAlchemy 2.0',
    test: (content) => content.includes("sqlalchemy: '^2.0.23'"),
    description: 'Template includes modern SQLAlchemy 2.0',
    critical: true
  },
  {
    name: 'Alembic Migrations',
    test: (content) => content.includes("alembic: '^1.13.0'"),
    description: 'Template includes Alembic for database migrations',
    critical: true
  },
  
  // Authentication & Security Tests
  {
    name: 'JWT Authentication',
    test: (content) => content.includes("python-jose[cryptography]"),
    description: 'Template includes JWT authentication support',
    critical: true
  },
  {
    name: 'Security Module',
    test: (content) => content.includes("app/core/security.py"),
    description: 'Template includes security utilities module',
    critical: true
  },
  {
    name: 'Password Hashing',
    test: (content) => content.includes('CryptContext') && content.includes('bcrypt'),
    description: 'Template includes password hashing with bcrypt',
    critical: true
  },
  {
    name: 'Token Management',
    test: (content) => content.includes('create_access_token') && content.includes('create_refresh_token'),
    description: 'Template includes access and refresh token management',
    critical: true
  },
  
  // Database & ORM Tests
  {
    name: 'Database Models',
    test: (content) => content.includes('app/models/user.py') && content.includes('app/models/item.py'),
    description: 'Template includes SQLAlchemy models',
    critical: true
  },
  {
    name: 'CRUD Operations',
    test: (content) => content.includes('app/crud/') && content.includes('CRUDBase'),
    description: 'Template includes CRUD operation classes',
    critical: true
  },
  {
    name: 'Database Session',
    test: (content) => content.includes('SessionLocal') && content.includes('get_db'),
    description: 'Template includes database session management',
    critical: true
  },
  {
    name: 'Database Initialization',
    test: (content) => content.includes('init_db') && content.includes('create_all'),
    description: 'Template includes database initialization',
    critical: true
  },
  
  // API Structure Tests
  {
    name: 'API Routes',
    test: (content) => content.includes('app/api/api_v1/') && content.includes('api_router'),
    description: 'Template includes structured API routes',
    critical: true
  },
  {
    name: 'Authentication Endpoints',
    test: (content) => content.includes('auth.py') && content.includes('/login'),
    description: 'Template includes authentication endpoints',
    critical: true
  },
  {
    name: 'User Management',
    test: (content) => content.includes('users.py') && content.includes('/users'),
    description: 'Template includes user management endpoints',
    critical: true
  },
  {
    name: 'CRUD Endpoints',
    test: (content) => content.includes('items.py') && content.includes('create_item'),
    description: 'Template includes CRUD endpoints for resources',
    critical: true
  },
  
  // Async & Performance Tests
  {
    name: 'Async Support',
    test: (content) => content.includes('async def') && content.includes('await'),
    description: 'Template includes comprehensive async support',
    critical: true
  },
  {
    name: 'Rate Limiting',
    test: (content) => content.includes('slowapi') && content.includes('@limiter.limit'),
    description: 'Template includes rate limiting functionality',
    critical: true
  },
  {
    name: 'Request Middleware',
    test: (content) => content.includes('@app.middleware("http")') && content.includes('process_time'),
    description: 'Template includes request timing middleware',
    critical: true
  },
  
  // Documentation & Validation Tests
  {
    name: 'Pydantic Schemas',
    test: (content) => content.includes('app/schemas/') && content.includes('BaseModel'),
    description: 'Template includes Pydantic validation schemas',
    critical: true
  },
  {
    name: 'OpenAPI Documentation',
    test: (content) => content.includes('openapi_url') && content.includes('docs_url'),
    description: 'Template includes automatic OpenAPI documentation',
    critical: true
  },
  {
    name: 'Email Validation',
    test: (content) => content.includes('EmailStr') && content.includes('pydantic[email]'),
    description: 'Template includes email validation support',
    critical: true
  },
  
  // Configuration & Environment Tests
  {
    name: 'Configuration Management',
    test: (content) => content.includes('BaseSettings') && content.includes('app/core/config.py'),
    description: 'Template includes configuration management',
    critical: true
  },
  {
    name: 'Environment Variables',
    test: (content) => content.includes('.env.example') && content.includes('DATABASE_URL'),
    description: 'Template includes environment configuration',
    critical: true
  },
  {
    name: 'Dependency Injection',
    test: (content) => content.includes('app/core/deps.py') && content.includes('Depends'),
    description: 'Template includes dependency injection system',
    critical: true
  },
  
  // Testing & Quality Tests
  {
    name: 'Pytest Framework',
    test: (content) => content.includes("pytest: '^7.4.3'") && content.includes('app/tests/'),
    description: 'Template includes pytest testing framework',
    critical: true
  },
  {
    name: 'Test Configuration',
    test: (content) => content.includes('conftest.py') && content.includes('TestClient'),
    description: 'Template includes test configuration and fixtures',
    critical: true
  },
  {
    name: 'Code Quality Tools',
    test: (content) => content.includes('black:') && content.includes('mypy:') && content.includes('isort:'),
    description: 'Template includes code formatting and type checking tools',
    critical: true
  },
  
  // Deployment & Infrastructure Tests
  {
    name: 'Docker Support',
    test: (content) => content.includes('Dockerfile') && content.includes('docker-compose.yml'),
    description: 'Template includes Docker containerization',
    critical: true
  },
  {
    name: 'Health Check Endpoints',
    test: (content) => content.includes('/health') && content.includes('health_check'),
    description: 'Template includes health check endpoints',
    critical: true
  },
  {
    name: 'Production Configuration',
    test: (content) => content.includes('HEALTHCHECK') && content.includes('non-root user'),
    description: 'Template includes production-ready configuration',
    critical: true
  },
  
  // Advanced Features Tests
  {
    name: 'Redis Integration',
    test: (content) => content.includes('redis:') && content.includes('REDIS_URL'),
    description: 'Template includes Redis for caching and sessions',
    critical: false
  },
  {
    name: 'Celery Task Queue',
    test: (content) => content.includes('celery:') && content.includes('CELERY_BROKER_URL'),
    description: 'Template includes Celery for background tasks',
    critical: false
  },
  {
    name: 'CORS Support',
    test: (content) => content.includes('CORSMiddleware') && content.includes('ALLOWED_ORIGINS'),
    description: 'Template includes CORS middleware configuration',
    critical: true
  },
  {
    name: 'Security Middleware',
    test: (content) => content.includes('TrustedHostMiddleware') && content.includes('ALLOWED_HOSTS'),
    description: 'Template includes security middleware',
    critical: true
  }
];

function testFastApiTemplate() {
  const templatePath = path.join(__dirname, '../src/templates/backend/fastapi-py.ts');
  const result = testResults.fastApiTest;

  // Check if template exists
  if (!fs.existsSync(templatePath)) {
    console.log(`❌ Template file not found: ${templatePath}`);
    return result;
  }

  result.exists = true;
  const content = fs.readFileSync(templatePath, 'utf8');

  console.log('🔍 Running FastAPI template tests...\n');

  // Run all FastAPI tests
  fastApiTests.forEach(test => {
    result.featureCount++;
    
    try {
      const passed = test.test(content);
      const status = passed ? '✅' : '❌';
      const critical = test.critical ? '🚨' : '💡';
      
      console.log(`  ${status} ${critical} ${test.name}: ${test.description}`);
      
      result.features[test.name] = {
        passed,
        description: test.description,
        critical: test.critical
      };
      
      if (passed) {
        result.passedFeatures++;
      } else {
        result.failedFeatures++;
      }
    } catch (error) {
      console.log(`❌ 🚨 ${test.name}: Error running test - ${error.message}`);
      result.features[test.name] = {
        passed: false,
        description: test.description,
        critical: test.critical,
        error: error.message
      };
      result.failedFeatures++;
    }
  });

  return result;
}

// Run the test
const result = testFastApiTemplate();

// Print summary
console.log('\n📊 FASTAPI TEMPLATE TEST SUMMARY');
console.log('=================================');
console.log(`Template: ${result.templateName}`);
console.log(`Total Features: ${result.featureCount}`);
console.log(`✅ Passed: ${result.passedFeatures}`);
console.log(`❌ Failed: ${result.failedFeatures}`);
console.log(`📈 Success Rate: ${((result.passedFeatures / result.featureCount) * 100).toFixed(1)}%`);

// Check critical features
const criticalFeatures = Object.entries(result.features).filter(([_, feature]) => feature.critical);
const failedCritical = criticalFeatures.filter(([_, feature]) => !feature.passed);

if (failedCritical.length > 0) {
  console.log('\n🚨 Critical Features Failed:');
  failedCritical.forEach(([name, _]) => {
    console.log(`   ❌ ${name}`);
  });
}

// Save results
const resultsPath = path.join(__dirname, 'validate-fastapi-template-results.json');
fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
console.log(`\n💾 Results saved to: ${resultsPath}`);

// Exit with appropriate code
const success = result.failedFeatures === 0;
console.log(`\n${success ? '🎉 All FastAPI template tests passed!' : '⚠️  Some FastAPI template tests failed'}`);

if (success) {
  console.log('\n🐍 FastAPI template includes enterprise-grade features:');
  console.log('  • Modern FastAPI with async/await support');
  console.log('  • Automatic OpenAPI/Swagger documentation');
  console.log('  • JWT authentication with access/refresh tokens');
  console.log('  • SQLAlchemy 2.0 with Alembic migrations');
  console.log('  • Pydantic V2 data validation and serialization');
  console.log('  • Comprehensive CRUD operations and API structure');
  console.log('  • Rate limiting and security middleware');
  console.log('  • Docker containerization and production setup');
  console.log('  • Pytest testing framework with fixtures');
  console.log('  • Code quality tools (Black, mypy, isort, flake8)');
}

process.exit(success ? 0 : 1);