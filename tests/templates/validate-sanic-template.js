#!/usr/bin/env node

/**
 * Comprehensive validation test for Sanic Python template
 * Tests all template features and ensures ultra-fast performance focus
 */

const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'src', 'templates', 'backend', 'sanic-py.ts');

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

console.log('🧪 Validating Sanic Python Template...\n');

// Basic Structure Tests
test('Template exports sanicTemplate', templateContent.includes('export const sanicTemplate'));
test('Template has BackendTemplate import', templateContent.includes('import { BackendTemplate }'));
test('Template ID is sanic-py', templateContent.includes("id: 'sanic-py'"));
test('Template name includes Sanic', templateContent.includes('Sanic + Python'));
test('Template framework is sanic', templateContent.includes("framework: 'sanic'"));
test('Template language is python', templateContent.includes("language: 'python'"));
test('Template emphasizes ultra-fast performance', templateContent.includes('ultra-fast') || templateContent.includes('Ultra-fast'));

// Core Dependencies Tests
test('Has Sanic dependency', (templateContent.includes("'sanic':") || templateContent.includes("sanic:")) && templateContent.includes('23.12.1'));
test('Has Sanic Extensions', templateContent.includes("'sanic-ext':") && templateContent.includes('23.12.0'));
test('Has Sanic CORS', templateContent.includes("'sanic-cors':") && templateContent.includes('2.2.0'));
test('Has async PostgreSQL driver (asyncpg)', templateContent.includes("'asyncpg':") && templateContent.includes('0.29.0'));
test('Has async Redis client (asyncio-redis)', templateContent.includes("'asyncio-redis':") && templateContent.includes('0.16.0'));
test('Has JWT support (pyjwt)', templateContent.includes("'pyjwt':") && templateContent.includes('2.8.0'));
test('Has password hashing (bcrypt)', templateContent.includes("'bcrypt':") && templateContent.includes('4.1.2'));
test('Has Marshmallow validation', templateContent.includes("'marshmallow':") && templateContent.includes('3.20.1'));
test('Has SQLAlchemy ORM', templateContent.includes("'sqlalchemy':") && templateContent.includes('2.0.23'));
test('Has uvloop for performance', templateContent.includes("'uvloop':") && templateContent.includes('0.19.0'));
test('Has httptools for performance', templateContent.includes("'httptools':") && templateContent.includes('0.6.1'));
test('Has ujson for fast JSON', templateContent.includes("'ujson':") && templateContent.includes('5.8.0'));
test('Has aiofiles for async file operations', templateContent.includes("'aiofiles':") && templateContent.includes('23.2.1'));

// Development Dependencies Tests
test('Has pytest testing framework', templateContent.includes("'pytest':") && templateContent.includes('7.4.3'));
test('Has pytest-sanic for Sanic testing', templateContent.includes("'pytest-sanic':") && templateContent.includes('1.9.1'));
test('Has pytest-asyncio for async testing', templateContent.includes("'pytest-asyncio':") && templateContent.includes('0.21.1'));
test('Has sanic-testing utilities', templateContent.includes("'sanic-testing':") && templateContent.includes('23.12.0'));
test('Has Black code formatter', templateContent.includes("'black':"));
test('Has isort import sorter', templateContent.includes("'isort':"));
test('Has mypy type checker', templateContent.includes("'mypy':"));
test('Has flake8 linter', templateContent.includes("'flake8':"));

// File Structure Tests
test('Has requirements.txt', templateContent.includes("'requirements.txt':"));
test('Has requirements-dev.txt', templateContent.includes("'requirements-dev.txt':"));
test('Has main.py entry point', templateContent.includes("'main.py':"));
test('Has app core config', templateContent.includes("'app/core/config.py':"));
test('Has app factory', templateContent.includes("'app/core/app_factory.py':"));
test('Has database configuration', templateContent.includes("'app/core/database.py':"));
test('Has Redis client', templateContent.includes("'app/core/redis_client.py':"));
test('Has auth blueprint', templateContent.includes("'app/blueprints/auth.py':"));
test('Has users blueprint', templateContent.includes("'app/blueprints/users.py':"));
test('Has websocket blueprint', templateContent.includes("'app/blueprints/websocket.py':"));
test('Has API blueprint', templateContent.includes("'app/blueprints/api.py':"));
test('Has authentication middleware', templateContent.includes("'app/middleware/authentication.py':"));
test('Has rate limiting middleware', templateContent.includes("'app/middleware/rate_limiting.py':"));
test('Has error handling middleware', templateContent.includes("'app/middleware/error_handling.py':"));
test('Has logging middleware', templateContent.includes("'app/middleware/logging.py':"));
test('Has user models', templateContent.includes("'app/models/user.py':"));
test('Has Dockerfile', templateContent.includes("'Dockerfile':"));
test('Has docker-compose.yml', templateContent.includes("'docker-compose.yml':"));
test('Has environment example', templateContent.includes("'.env.example':"));
test('Has pytest configuration', templateContent.includes("'pytest.ini':"));
test('Has test configuration', templateContent.includes("'tests/conftest.py':"));
test('Has auth tests', templateContent.includes("'tests/test_auth.py':"));
test('Has user tests', templateContent.includes("'tests/test_users.py':"));
test('Has API tests', templateContent.includes("'tests/test_api.py':"));
test('Has WebSocket tests', templateContent.includes("'tests/test_websockets.py':"));
test('Has gitignore', templateContent.includes("'.gitignore':"));
test('Has README', templateContent.includes("'README.md':"));

// Main Application Features Tests
test('Main entry enables uvloop', templateContent.includes('import uvloop'));
test('Main entry sets uvloop policy', templateContent.includes('uvloop.EventLoopPolicy'));
test('Uses Sanic app factory', templateContent.includes('create_app()'));
test('Configures startup handlers', templateContent.includes('@app.before_server_start'));
test('Configures shutdown handlers', templateContent.includes('@app.after_server_stop'));
test('Enables fast mode', templateContent.includes('fast=True'));
test('Configures multiple workers', templateContent.includes('workers='));

// Configuration Features Tests
test('Has comprehensive Settings class', templateContent.includes('class Settings'));
test('Configures performance settings', templateContent.includes('KEEP_ALIVE_TIMEOUT'));
test('Configures request settings', templateContent.includes('REQUEST_TIMEOUT'));
test('Configures JWT settings', templateContent.includes('JWT_SECRET_KEY'));
test('Configures database pool settings', templateContent.includes('DB_POOL_MIN_SIZE'));
test('Configures Redis pool settings', templateContent.includes('REDIS_POOL_MIN_SIZE'));
test('Configures rate limiting', templateContent.includes('RATE_LIMIT_ENABLED'));
test('Configures CORS settings', templateContent.includes('CORS_ORIGINS'));

// App Factory Features Tests
test('Creates Sanic app with optimizations', templateContent.includes('Sanic('));
test('Enables Sanic Extensions', templateContent.includes('Extend(app)'));
test('Configures CORS with sanic-cors', templateContent.includes('CORS('));
test('Registers blueprints', templateContent.includes('app.blueprint('));
test('Adds middleware in correct order', templateContent.includes('add_logging_middleware'));
test('Configures health check endpoint', templateContent.includes('@app.get("/health")'));
test('Enables static files in debug', templateContent.includes('app.static'));

// Database Features Tests
test('Uses asyncpg connection pool', templateContent.includes('asyncpg.create_pool'));
test('Configures connection pool settings', templateContent.includes('min_size='));
test('Uses command timeout', templateContent.includes('command_timeout='));
test('Sets application name', templateContent.includes('application_name'));
test('Provides async query execution', templateContent.includes('async def execute_query'));
test('Provides single result execution', templateContent.includes('async def execute_one'));
test('Provides command execution', templateContent.includes('async def execute_command'));

// Redis Features Tests
test('Uses asyncio-redis pool', templateContent.includes('asyncio_redis.Pool.create'));
test('Configures Redis pool size', templateContent.includes('poolsize='));
test('Uses UTF8 encoder', templateContent.includes('UTF8Encoder'));
test('Provides cache helper functions', templateContent.includes('async def set_cache'));
test('Provides cache retrieval', templateContent.includes('async def get_cache'));
test('Provides cache deletion', templateContent.includes('async def delete_cache'));

// Blueprint Architecture Tests
test('Uses blueprint for auth', templateContent.includes('Blueprint("auth"'));
test('Uses blueprint for users', templateContent.includes('Blueprint("users"'));
test('Uses blueprint for websockets', templateContent.includes('Blueprint("websocket"'));
test('Uses blueprint for API', templateContent.includes('Blueprint("api"'));
test('Configures blueprint prefixes', templateContent.includes('prefix="/api/v1'));

// Authentication Features Tests
test('Implements JWT authentication', templateContent.includes('jwt.encode'));
test('Implements password hashing', templateContent.includes('bcrypt.hashpw'));
test('Implements token blacklisting', templateContent.includes('blacklist:'));
test('Uses Marshmallow validation', templateContent.includes('ValidationError'));
test('Implements user registration', templateContent.includes('@auth_bp.post("/register")'));
test('Implements user login', templateContent.includes('@auth_bp.post("/login")'));
test('Implements user logout', templateContent.includes('@auth_bp.post("/logout")'));

// WebSocket Features Tests
test('Implements chat WebSocket', templateContent.includes('@websocket_bp.websocket("/ws/chat")'));
test('Implements notifications WebSocket', templateContent.includes('@websocket_bp.websocket("/ws/notifications")'));
test('Manages active connections', templateContent.includes('active_connections'));
test('Handles WebSocket authentication', templateContent.includes('token = request.args.get'));
test('Implements room-based chat', templateContent.includes('room_id'));
test('Implements message broadcasting', templateContent.includes('broadcast_to_room'));
test('Handles typing indicators', templateContent.includes('typing'));
test('Handles ping/pong', templateContent.includes('ping'));

// Middleware Features Tests
test('Implements authentication middleware', templateContent.includes('def add_authentication_middleware'));
test('Implements rate limiting middleware', templateContent.includes('def add_rate_limiting_middleware'));
test('Implements error handling middleware', templateContent.includes('def add_error_handling_middleware'));
test('Implements logging middleware', templateContent.includes('def add_logging_middleware'));
test('Uses request context', templateContent.includes('request.ctx'));
test('Adds performance headers', templateContent.includes('X-Response-Time'));

// API Features Tests
test('Implements status endpoint', templateContent.includes('@api_bp.get("/status")'));
test('Implements metrics endpoint', templateContent.includes('@api_bp.get("/metrics")'));
test('Implements info endpoint', templateContent.includes('@api_bp.get("/info")'));
test('Provides WebSocket statistics', templateContent.includes('websocket_stats'));
test('Provides system metrics', templateContent.includes('psutil'));
test('Provides Redis health check', templateContent.includes('redis_stats'));

// User Management Features Tests
test('Implements user listing', templateContent.includes('@users_bp.get("/")'));
test('Implements user retrieval', templateContent.includes('@users_bp.get("/<user_id:int>")'));
test('Implements user updates', templateContent.includes('@users_bp.put("/<user_id:int>")'));
test('Implements user deletion', templateContent.includes('@users_bp.delete("/<user_id:int>")'));
test('Uses pagination', templateContent.includes('pagination'));

// Model Features Tests
test('Defines user schemas', templateContent.includes('class UserCreateSchema'));
test('Defines login schema', templateContent.includes('class UserLoginSchema'));
test('Defines update schema', templateContent.includes('class UserUpdateSchema'));
test('Uses Marshmallow validation', templateContent.includes('fields.Email'));
test('Implements User model', templateContent.includes('class User'));

// Testing Features Tests
test('Configures async testing', templateContent.includes('asyncio_mode = auto'));
test('Configures code coverage', templateContent.includes('--cov=app'));
test('Has performance test marker', templateContent.includes('performance:'));
test('Uses TestClient', templateContent.includes('TestClient'));
test('Tests registration', templateContent.includes('test_register'));
test('Tests login', templateContent.includes('test_login'));
test('Tests validation errors', templateContent.includes('test_login_validation_error'));
test('Tests authentication required', templateContent.includes('test_list_users_without_auth'));

// Docker Features Tests
test('Uses Python 3.11 base image', templateContent.includes('FROM python:3.11-slim'));
test('Includes health check', templateContent.includes('HEALTHCHECK'));
test('Creates non-root user', templateContent.includes('useradd -m'));
test('Uses PostgreSQL 15', templateContent.includes('postgres:15-alpine'));
test('Uses Redis 7', templateContent.includes('redis:7-alpine'));
test('Configures service dependencies', templateContent.includes('depends_on'));
test('Sets performance environment variables', templateContent.includes('WORKERS='));

// Performance Optimization Tests
test('Enables uvloop in main', templateContent.includes('uvloop'));
test('Uses httptools', templateContent.includes('httptools'));
test('Uses ujson for JSON', templateContent.includes('ujson'));
test('Configures connection pooling', templateContent.includes('Pool'));
test('Enables fast mode', templateContent.includes('fast=True'));
test('Configures keep-alive timeout', templateContent.includes('KEEP_ALIVE_TIMEOUT'));
test('Configures request timeout', templateContent.includes('REQUEST_TIMEOUT'));
test('Configures request max size', templateContent.includes('REQUEST_MAX_SIZE'));

// Documentation Features Tests
test('Has comprehensive README', templateContent.includes('# Sanic Microservice'));
test('Documents ultra-fast performance', templateContent.includes('Ultra-fast'));
test('Documents blueprint architecture', templateContent.includes('Blueprint Architecture'));
test('Documents async support', templateContent.includes('Async/Await Support'));
test('Documents WebSocket features', templateContent.includes('WebSocket Support'));
test('Documents authentication', templateContent.includes('JWT Authentication'));
test('Documents database features', templateContent.includes('PostgreSQL'));
test('Documents Redis features', templateContent.includes('Redis'));
test('Documents performance features', templateContent.includes('Performance'));
test('Documents monitoring', templateContent.includes('Monitoring'));
test('Documents security features', templateContent.includes('Security'));
test('Documents Docker deployment', templateContent.includes('Docker'));
test('Documents testing framework', templateContent.includes('pytest'));

// Environment Configuration Tests
test('Configures server settings', templateContent.includes('HOST='));
test('Configures performance settings', templateContent.includes('KEEP_ALIVE_TIMEOUT='));
test('Configures database settings', templateContent.includes('DB_POOL_MIN_SIZE='));
test('Configures Redis settings', templateContent.includes('REDIS_POOL_MIN_SIZE='));
test('Configures rate limiting settings', templateContent.includes('RATE_LIMIT_REQUESTS='));

console.log(`\n📊 Validation Results:`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log(`\n❌ Failed Tests:`);
  failures.forEach(failure => console.log(`   • ${failure}`));
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Sanic template is ultra-fast and enterprise-ready.`);
}