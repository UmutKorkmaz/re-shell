#!/usr/bin/env node

/**
 * Simple validation test for Tornado Python template
 * Tests template structure and key features
 */

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'tornado-py.ts');

if (!fs.existsSync(templatePath)) {
  console.error('❌ Template file not found:', templatePath);
  process.exit(1);
}

const templateContent = fs.readFileSync(templatePath, 'utf8');

// Validation results
let passed = 0;
let failed = 0;
const failures = [];

function test(description, assertion) {
  try {
    if (assertion) {
      console.log(`✅ ${description}`);
      passed++;
    } else {
      console.log(`❌ ${description}`);
      failed++;
      failures.push(description);
    }
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
    failed++;
    failures.push(description);
  }
}

console.log('🧪 Validating Tornado Python Template...\n');

// Basic Structure Tests
test('Template exports tornadoTemplate', templateContent.includes('export const tornadoTemplate'));
test('Template has BackendTemplate import', templateContent.includes('import { BackendTemplate }'));
test('Template ID is tornado-py', templateContent.includes("id: 'tornado-py'"));
test('Template name includes Tornado', templateContent.includes('Tornado + Python'));
test('Template framework is tornado', templateContent.includes("framework: 'tornado'"));
test('Template language is python', templateContent.includes("language: 'python'"));

// Core Dependencies Tests
test('Has Tornado dependency', templateContent.includes('tornado:') && templateContent.includes('6.4'));
test('Has async PostgreSQL driver (aiopg)', templateContent.includes("'aiopg':") && templateContent.includes('1.4.0'));
test('Has async Redis client (aioredis)', templateContent.includes("'aioredis':") && templateContent.includes('2.0.1'));
test('Has JWT support (pyjwt)', templateContent.includes("'pyjwt':") && templateContent.includes('2.8.0'));
test('Has password hashing (bcrypt)', templateContent.includes("'bcrypt':") && templateContent.includes('4.1.2'));
test('Has Marshmallow validation', templateContent.includes("'marshmallow':") && templateContent.includes('3.20.1'));
test('Has SQLAlchemy ORM', templateContent.includes("'sqlalchemy':") && templateContent.includes('2.0.23'));
test('Has Alembic migrations', templateContent.includes("'alembic':") && templateContent.includes('1.13.0'));

// Development Dependencies Tests
test('Has pytest testing framework', templateContent.includes("'pytest':") && templateContent.includes('7.4.3'));
test('Has pytest-tornado for Tornado testing', templateContent.includes('pytest-tornado'));
test('Has pytest-asyncio for async testing', templateContent.includes('pytest-asyncio'));
test('Has Black code formatter', templateContent.includes("'black':"));
test('Has isort import sorter', templateContent.includes("'isort':"));
test('Has mypy type checker', templateContent.includes("'mypy':"));
test('Has flake8 linter', templateContent.includes("'flake8':"));

// File Structure Tests
test('Has requirements.txt', templateContent.includes("'requirements.txt':"));
test('Has requirements-dev.txt', templateContent.includes("'requirements-dev.txt':"));
test('Has main.py entry point', templateContent.includes("'main.py':"));
test('Has app core configuration', templateContent.includes("'app/core/config.py':"));
test('Has application factory', templateContent.includes("'app/core/application.py':"));
test('Has database configuration', templateContent.includes("'app/core/database.py':"));
test('Has Redis client', templateContent.includes("'app/core/redis_client.py':"));
test('Has logging configuration', templateContent.includes("'app/core/logging_config.py':"));
test('Has base handler', templateContent.includes("'app/handlers/base.py':"));
test('Has auth handlers', templateContent.includes("'app/handlers/auth_handlers.py':"));
test('Has user handlers', templateContent.includes("'app/handlers/user_handlers.py':"));
test('Has WebSocket handlers', templateContent.includes("'app/handlers/websocket_handlers.py':"));
test('Has API handlers', templateContent.includes("'app/handlers/api_handlers.py':"));
test('Has user model', templateContent.includes("'app/models/user.py':"));
test('Has Dockerfile', templateContent.includes("'Dockerfile':"));
test('Has docker-compose.yml', templateContent.includes("'docker-compose.yml':"));
test('Has environment example', templateContent.includes("'.env.example':"));
test('Has pytest configuration', templateContent.includes("'pytest.ini':"));
test('Has test configuration', templateContent.includes("'tests/conftest.py':"));
test('Has auth tests', templateContent.includes("'tests/test_auth.py':"));
test('Has WebSocket tests', templateContent.includes("'tests/test_websockets.py':"));
test('Has API tests', templateContent.includes("'tests/test_api.py':"));
test('Has gitignore', templateContent.includes("'.gitignore':"));
test('Has README', templateContent.includes("'README.md':"));

// Main Application Features Tests
test('Main entry uses async/await', templateContent.includes('async def main'));
test('Uses Tornado IOLoop', templateContent.includes('tornado.ioloop'));
test('Initializes database asynchronously', templateContent.includes('await init_database'));
test('Initializes Redis asynchronously', templateContent.includes('await init_redis'));
test('Handles graceful shutdown', templateContent.includes('signal.signal'));

// Configuration Features Tests
test('Has Settings class', templateContent.includes('class Settings'));
test('Configures JWT settings', templateContent.includes('JWT_SECRET_KEY'));
test('Configures database URL', templateContent.includes('DATABASE_URL'));
test('Configures Redis URL', templateContent.includes('REDIS_URL'));
test('Loads environment variables', templateContent.includes('load_dotenv'));

// Application Factory Tests
test('Has application factory function', templateContent.includes('def create_application'));
test('Configures chat WebSocket endpoint', templateContent.includes('/ws/chat'));
test('Configures notification WebSocket endpoint', templateContent.includes('/ws/notifications'));
test('Configures authentication endpoints', templateContent.includes('/api/v1/auth'));
test('Configures health check endpoint', templateContent.includes('/health'));

// Database Features Tests
test('Creates async database pool', templateContent.includes('aiopg.create_pool'));
test('Uses SQLAlchemy integration', templateContent.includes('SQLAlchemy'));
test('Configures database sessions', templateContent.includes('sessionmaker'));

// Redis Features Tests
test('Uses async Redis client', templateContent.includes('aioredis.from_url'));
test('Tests Redis connection', templateContent.includes('await _redis_client.ping'));

// Authentication Features Tests
test('Implements JWT token validation', templateContent.includes('jwt.decode'));
test('Hashes passwords with bcrypt', templateContent.includes('bcrypt.hashpw'));
test('Generates JWT tokens', templateContent.includes('jwt.encode'));
test('Implements token blacklisting', templateContent.includes('blacklist:'));

// WebSocket Features Tests
test('Has ChatWebSocketHandler', templateContent.includes('class ChatWebSocketHandler'));
test('Has NotificationWebSocketHandler', templateContent.includes('class NotificationWebSocketHandler'));
test('Manages active connections', templateContent.includes('active_connections'));
test('Handles async WebSocket messages', templateContent.includes('async def on_message'));
test('Implements room-based broadcasting', templateContent.includes('broadcast_to_room'));
test('Supports typing indicators', templateContent.includes('typing_indicator'));

// API Features Tests
test('Has health check handler', templateContent.includes('class HealthCheckHandler'));
test('Has status handler', templateContent.includes('class StatusHandler'));
test('Monitors system metrics', templateContent.includes('psutil'));
test('Reports WebSocket statistics', templateContent.includes('websocket_stats'));

// Testing Features Tests
test('Configures async testing', templateContent.includes('asyncio_mode = auto'));
test('Configures code coverage', templateContent.includes('--cov=app'));
test('Has WebSocket test marker', templateContent.includes('websocket:'));
test('Uses Tornado test case', templateContent.includes('AsyncHTTPTestCase'));
test('Has registration test', templateContent.includes('test_register'));
test('Has WebSocket connection test', templateContent.includes('websocket_connect'));
test('Tests CORS headers', templateContent.includes('test_cors_headers'));

// Docker Features Tests
test('Uses Python 3.11 base image', templateContent.includes('FROM python:3.11-slim'));
test('Includes health check', templateContent.includes('HEALTHCHECK'));
test('Creates non-root user', templateContent.includes('useradd -m'));
test('Uses PostgreSQL 15', templateContent.includes('postgres:15-alpine'));
test('Uses Redis 7', templateContent.includes('redis:7-alpine'));
test('Configures service dependencies', templateContent.includes('depends_on'));

// Documentation Features Tests
test('Has comprehensive README', templateContent.includes('# Tornado Microservice'));
test('Documents WebSocket features', templateContent.includes('WebSocket Support'));
test('Documents async features', templateContent.includes('Async/Await Support'));
test('Documents authentication', templateContent.includes('JWT Authentication'));
test('Documents database support', templateContent.includes('PostgreSQL'));
test('Documents caching support', templateContent.includes('Redis'));
test('Documents containerization', templateContent.includes('Docker'));
test('Documents WebSocket endpoints', templateContent.includes('/ws/chat'));
test('Documents testing framework', templateContent.includes('pytest'));

console.log(`\n📊 Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Tornado template is comprehensive and enterprise-ready.`);
}