#!/usr/bin/env node

/**
 * Comprehensive validation test for Tornado Python template
 * Tests all template features and ensures enterprise-grade quality
 */

const fs = require('fs');
const path = require('path');

// Load the template by evaluating the TypeScript file as JavaScript
const templatePath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'tornado-py.ts');

if (!fs.existsSync(templatePath)) {
  console.error('❌ Template file not found:', templatePath);
  process.exit(1);
}

// Read and parse the template file content
const templateContent = fs.readFileSync(templatePath, 'utf8');

// Extract the template object using regex (simplified approach for testing)
const templateMatch = templateContent.match(/export const tornadoTemplate[^=]*=\s*({[\s\S]*?};?\s*$)/m);
if (!templateMatch) {
  console.error('❌ Could not parse template from file');
  process.exit(1);
}

// Simple evaluation for testing (in production, you'd use proper TypeScript compilation)
let template;
try {
  // Create a simple evaluation context
  const BackendTemplate = {}; // Mock type
  const templateCode = templateMatch[1].replace(/;$/, '');
  template = eval('(' + templateCode + ')');
} catch (error) {
  console.error('❌ Error parsing template:', error.message);
  process.exit(1);
}

// Validation results
let passed = 0;
let failed = 0;
const failures = [];

function test(description, assertion) {
  try {
    if (assertion()) {
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

function testFileContent(fileName, expectedContent, description) {
  const file = template.files[fileName];
  test(description, () => file && file.includes(expectedContent));
}

function testFileExists(fileName) {
  test(`File exists: ${fileName}`, () => template.files[fileName] !== undefined);
}

console.log('🧪 Validating Tornado Python Template...\n');

// Template Metadata Tests
test('Template has correct ID', () => template.id === 'tornado-py');
test('Template has correct name', () => template.name === 'Tornado + Python');
test('Template has correct framework', () => template.framework === 'tornado');
test('Template has correct language', () => template.language === 'python');
test('Template has comprehensive description', () => 
  template.description.includes('Tornado') && 
  template.description.includes('async') && 
  template.description.includes('WebSocket')
);
test('Template has appropriate tags', () => 
  template.tags.includes('tornado') && 
  template.tags.includes('async') && 
  template.tags.includes('websockets')
);

// Core Dependencies Tests
test('Has Tornado dependency', () => 
  template.dependencies.tornado && template.dependencies.tornado.includes('6.4')
);
test('Has async database driver (motor)', () => 
  template.dependencies.motor && template.dependencies.motor.includes('3.3.2')
);
test('Has async PostgreSQL driver (aiopg)', () => 
  template.dependencies.aiopg && template.dependencies.aiopg.includes('1.4.0')
);
test('Has async Redis client (aioredis)', () => 
  template.dependencies.aioredis && template.dependencies.aioredis.includes('2.0.1')
);
test('Has JWT support', () => 
  template.dependencies.pyjwt && template.dependencies.pyjwt.includes('2.8.0')
);
test('Has password hashing (bcrypt)', () => 
  template.dependencies.bcrypt && template.dependencies.bcrypt.includes('4.1.2')
);
test('Has Marshmallow validation', () => 
  template.dependencies.marshmallow && template.dependencies.marshmallow.includes('3.20.1')
);
test('Has SQLAlchemy ORM', () => 
  template.dependencies.sqlalchemy && template.dependencies.sqlalchemy.includes('2.0.23')
);

// Development Dependencies Tests
test('Has pytest testing framework', () => 
  template.devDependencies.pytest && template.devDependencies.pytest.includes('7.4.3')
);
test('Has pytest-tornado for Tornado testing', () => 
  template.devDependencies['pytest-tornado'] && template.devDependencies['pytest-tornado'].includes('0.8.1')
);
test('Has pytest-asyncio for async testing', () => 
  template.devDependencies['pytest-asyncio'] && template.devDependencies['pytest-asyncio'].includes('0.21.1')
);
test('Has code quality tools', () => 
  template.devDependencies.black && 
  template.devDependencies.isort && 
  template.devDependencies.mypy && 
  template.devDependencies.flake8
);

// File Structure Tests
testFileExists('requirements.txt');
testFileExists('requirements-dev.txt');
testFileExists('main.py');
testFileExists('app/__init__.py');
testFileExists('app/core/__init__.py');
testFileExists('app/core/config.py');
testFileExists('app/core/application.py');
testFileExists('app/core/database.py');
testFileExists('app/core/redis_client.py');
testFileExists('app/core/logging_config.py');
testFileExists('app/handlers/__init__.py');
testFileExists('app/handlers/base.py');
testFileExists('app/handlers/auth_handlers.py');
testFileExists('app/handlers/user_handlers.py');
testFileExists('app/handlers/websocket_handlers.py');
testFileExists('app/handlers/api_handlers.py');
testFileExists('app/models/__init__.py');
testFileExists('app/models/user.py');
testFileExists('Dockerfile');
testFileExists('docker-compose.yml');
testFileExists('.env.example');
testFileExists('pytest.ini');
testFileExists('tests/__init__.py');
testFileExists('tests/conftest.py');
testFileExists('tests/test_auth.py');
testFileExists('tests/test_websockets.py');
testFileExists('tests/test_api.py');
testFileExists('.gitignore');
testFileExists('README.md');

// Main Application Tests
testFileContent('main.py', 'tornado.ioloop', 'Main entry point uses Tornado IOLoop');
testFileContent('main.py', 'async def main', 'Main function is async');
testFileContent('main.py', 'await init_database', 'Initializes database asynchronously');
testFileContent('main.py', 'await init_redis', 'Initializes Redis asynchronously');
testFileContent('main.py', 'signal.signal', 'Handles graceful shutdown signals');

// Configuration Tests
testFileContent('app/core/config.py', 'class Settings', 'Has Settings configuration class');
testFileContent('app/core/config.py', 'JWT_SECRET_KEY', 'Configures JWT secret key');
testFileContent('app/core/config.py', 'DATABASE_URL', 'Configures database URL');
testFileContent('app/core/config.py', 'REDIS_URL', 'Configures Redis URL');
testFileContent('app/core/config.py', 'load_dotenv', 'Loads environment variables');

// Application Factory Tests
testFileContent('app/core/application.py', 'def create_application', 'Has application factory');
testFileContent('app/core/application.py', '/ws/chat', 'Configures chat WebSocket endpoint');
testFileContent('app/core/application.py', '/ws/notifications', 'Configures notification WebSocket endpoint');
testFileContent('app/core/application.py', '/api/v1/auth', 'Configures authentication endpoints');
testFileContent('app/core/application.py', '/health', 'Configures health check endpoint');

// Database Configuration Tests
testFileContent('app/core/database.py', 'aiopg.create_pool', 'Creates async database connection pool');
testFileContent('app/core/database.py', 'async def init_database', 'Database initialization is async');
testFileContent('app/core/database.py', 'SQLAlchemy', 'Integrates with SQLAlchemy');
testFileContent('app/core/database.py', 'sessionmaker', 'Configures database sessions');

// Redis Configuration Tests
testFileContent('app/core/redis_client.py', 'aioredis.from_url', 'Uses async Redis client');
testFileContent('app/core/redis_client.py', 'async def init_redis', 'Redis initialization is async');
testFileContent('app/core/redis_client.py', 'await _redis_client.ping', 'Tests Redis connection');

// Base Handler Tests
testFileContent('app/handlers/base.py', 'class BaseHandler', 'Has base request handler');
testFileContent('app/handlers/base.py', 'Access-Control-Allow-Origin', 'Configures CORS headers');
testFileContent('app/handlers/base.py', 'def write_json', 'Has JSON response helper');
testFileContent('app/handlers/base.py', 'jwt.decode', 'Implements JWT token validation');
testFileContent('app/handlers/base.py', 'ThreadPoolExecutor', 'Supports thread pool operations');

// Authentication Handler Tests
testFileContent('app/handlers/auth_handlers.py', 'bcrypt.hashpw', 'Hashes passwords with bcrypt');
testFileContent('app/handlers/auth_handlers.py', 'jwt.encode', 'Generates JWT tokens');
testFileContent('app/handlers/auth_handlers.py', 'AuthRegisterHandler', 'Has user registration handler');
testFileContent('app/handlers/auth_handlers.py', 'AuthLoginHandler', 'Has user login handler');
testFileContent('app/handlers/auth_handlers.py', 'AuthLogoutHandler', 'Has user logout handler');
testFileContent('app/handlers/auth_handlers.py', 'blacklist:', 'Implements token blacklisting');

// User Handler Tests
testFileContent('app/handlers/user_handlers.py', 'UserHandler', 'Has user CRUD handler');
testFileContent('app/handlers/user_handlers.py', 'UserProfileHandler', 'Has user profile handler');
testFileContent('app/handlers/user_handlers.py', 'get_current_user_async', 'Uses async authentication');
testFileContent('app/handlers/user_handlers.py', 'pagination', 'Implements pagination');

// WebSocket Handler Tests
testFileContent('app/handlers/websocket_handlers.py', 'ChatWebSocketHandler', 'Has chat WebSocket handler');
testFileContent('app/handlers/websocket_handlers.py', 'NotificationWebSocketHandler', 'Has notification WebSocket handler');
testFileContent('app/handlers/websocket_handlers.py', 'active_connections', 'Manages active connections');
testFileContent('app/handlers/websocket_handlers.py', 'async def on_message', 'Handles WebSocket messages asynchronously');
testFileContent('app/handlers/websocket_handlers.py', 'broadcast_to_room', 'Implements room-based broadcasting');
testFileContent('app/handlers/websocket_handlers.py', 'typing_indicator', 'Supports typing indicators');

// API Handler Tests
testFileContent('app/handlers/api_handlers.py', 'HealthCheckHandler', 'Has health check handler');
testFileContent('app/handlers/api_handlers.py', 'StatusHandler', 'Has status handler');
testFileContent('app/handlers/api_handlers.py', 'psutil', 'Monitors system metrics');
testFileContent('app/handlers/api_handlers.py', 'websocket_stats', 'Reports WebSocket statistics');

// Model Tests
testFileContent('app/models/user.py', 'UserSchema', 'Has user validation schema');
testFileContent('app/models/user.py', 'marshmallow', 'Uses Marshmallow for validation');
testFileContent('app/models/user.py', 'class User', 'Has user model class');
testFileContent('app/models/user.py', 'validate.Length', 'Validates input lengths');

// Docker Tests
testFileContent('Dockerfile', 'FROM python:3.11-slim', 'Uses Python 3.11 base image');
testFileContent('Dockerfile', 'HEALTHCHECK', 'Includes health check');
testFileContent('Dockerfile', 'useradd -m', 'Creates non-root user');
testFileContent('Dockerfile', 'EXPOSE 8000', 'Exposes correct port');

testFileContent('docker-compose.yml', 'postgres:15-alpine', 'Uses PostgreSQL 15');
testFileContent('docker-compose.yml', 'redis:7-alpine', 'Uses Redis 7');
testFileContent('docker-compose.yml', 'depends_on', 'Configures service dependencies');

// Environment Configuration Tests
testFileContent('.env.example', 'DATABASE_URL', 'Configures database URL example');
testFileContent('.env.example', 'REDIS_URL', 'Configures Redis URL example');
testFileContent('.env.example', 'JWT_SECRET_KEY', 'Configures JWT secret example');
testFileContent('.env.example', 'CORS_ORIGINS', 'Configures CORS origins example');

// Testing Configuration Tests
testFileContent('pytest.ini', 'asyncio_mode = auto', 'Configures async testing');
testFileContent('pytest.ini', '--cov=app', 'Configures code coverage');
testFileContent('pytest.ini', 'websocket:', 'Defines WebSocket test marker');

testFileContent('tests/conftest.py', 'AsyncHTTPTestCase', 'Uses Tornado test case');
testFileContent('tests/conftest.py', 'event_loop', 'Configures async event loop');

// Test Files Tests
testFileContent('tests/test_auth.py', 'test_register', 'Has registration test');
testFileContent('tests/test_auth.py', 'test_login', 'Has login test');
testFileContent('tests/test_auth.py', 'access_token', 'Tests JWT token generation');

testFileContent('tests/test_websockets.py', 'websocket_connect', 'Has WebSocket connection test');
testFileContent('tests/test_websockets.py', 'test_chat_websocket', 'Tests chat WebSocket');
testFileContent('tests/test_websockets.py', 'test_notification_websocket', 'Tests notification WebSocket');

testFileContent('tests/test_api.py', 'test_health_check', 'Has health check test');
testFileContent('tests/test_api.py', 'test_status_endpoint', 'Has status endpoint test');
testFileContent('tests/test_api.py', 'test_cors_headers', 'Tests CORS headers');

// Requirements Tests
testFileContent('requirements.txt', 'tornado==6.4', 'Pins Tornado version');
testFileContent('requirements.txt', 'aiopg==1.4.0', 'Pins aiopg version');
testFileContent('requirements.txt', 'aioredis==2.0.1', 'Pins aioredis version');
testFileContent('requirements.txt', 'pyjwt==2.8.0', 'Pins PyJWT version');

testFileContent('requirements-dev.txt', 'pytest==7.4.3', 'Pins pytest version');
testFileContent('requirements-dev.txt', 'pytest-tornado==0.8.1', 'Pins pytest-tornado version');
testFileContent('requirements-dev.txt', 'black==23.11.0', 'Pins Black version');

// Documentation Tests
testFileContent('README.md', '# Tornado Microservice', 'Has proper README title');
testFileContent('README.md', 'WebSocket Support', 'Documents WebSocket features');
testFileContent('README.md', 'Async/Await Support', 'Documents async features');
testFileContent('README.md', 'JWT Authentication', 'Documents authentication');
testFileContent('README.md', 'PostgreSQL', 'Documents database support');
testFileContent('README.md', 'Redis', 'Documents caching support');
testFileContent('README.md', 'Docker', 'Documents containerization');
testFileContent('README.md', '/ws/chat', 'Documents WebSocket endpoints');
testFileContent('README.md', 'pytest', 'Documents testing framework');

// Git Configuration Tests
testFileContent('.gitignore', '__pycache__/', 'Ignores Python cache');
testFileContent('.gitignore', '.env', 'Ignores environment files');
testFileContent('.gitignore', '*.log', 'Ignores log files');
testFileContent('.gitignore', '.pytest_cache/', 'Ignores pytest cache');

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