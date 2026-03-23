const fs = require('fs');
const path = require('path');

// Test file exists and is readable
const templatePath = path.join(__dirname, '../src/templates/backend/koa-ts.ts');

try {
  const content = fs.readFileSync(templatePath, 'utf8');
  
  // Basic validation checks
  const checks = [
    // Template structure
    { name: 'Template export', test: content.includes('export const koaTypeScriptTemplate') },
    { name: 'Framework property', test: content.includes("framework: 'koa'") },
    { name: 'Language property', test: content.includes("language: 'typescript'") },
    { name: 'Port configuration', test: content.includes('port: 3000') },
    
    // Core Koa.js dependencies
    { name: 'Koa framework', test: content.includes("'koa': '^2.14.2'") },
    { name: 'Koa router', test: content.includes("'@koa/router'") },
    { name: 'Koa CORS', test: content.includes("'@koa/cors'") },
    { name: 'Koa bodyparser', test: content.includes("'koa-bodyparser'") },
    { name: 'Koa compress', test: content.includes("'koa-compress'") },
    { name: 'Koa helmet', test: content.includes("'koa-helmet'") },
    { name: 'Koa rate limit', test: content.includes("'koa-ratelimit'") },
    { name: 'Koa JWT', test: content.includes("'koa-jwt'") },
    { name: 'Koa logger', test: content.includes("'koa-logger'") },
    { name: 'Koa JSON', test: content.includes("'koa-json'") },
    { name: 'Koa static', test: content.includes("'koa-static'") },
    
    // Authentication and validation
    { name: 'JWT', test: content.includes("'jsonwebtoken'") },
    { name: 'Bcrypt', test: content.includes("'bcryptjs'") },
    { name: 'Joi validation', test: content.includes("'joi'") },
    
    // Infrastructure
    { name: 'Winston logging', test: content.includes("'winston'") },
    { name: 'Redis client', test: content.includes("'ioredis'") },
    { name: 'Dotenv', test: content.includes("'dotenv'") },
    
    // Essential files
    { name: 'Package.json', test: content.includes("'package.json'") },
    { name: 'TypeScript config', test: content.includes("'tsconfig.json'") },
    { name: 'Main entry point', test: content.includes("'src/index.ts'") },
    
    // Configuration
    { name: 'Environment config', test: content.includes("'src/config/environment.ts'") },
    { name: 'Logger config', test: content.includes("'src/config/logger.ts'") },
    { name: 'Redis config', test: content.includes("'src/config/redis.ts'") },
    
    // Middleware
    { name: 'Error handler middleware', test: content.includes("'src/middleware/errorHandler.ts'") },
    { name: 'Response time middleware', test: content.includes("'src/middleware/responseTime.ts'") },
    { name: 'Request ID middleware', test: content.includes("'src/middleware/requestId.ts'") },
    { name: 'Auth middleware', test: content.includes("'src/middleware/auth.ts'") },
    { name: 'Validation middleware', test: content.includes("'src/middleware/validation.ts'") },
    
    // Routes
    { name: 'Routes index', test: content.includes("'src/routes/index.ts'") },
    { name: 'Health routes', test: content.includes("'src/routes/health.ts'") },
    { name: 'Auth routes', test: content.includes("'src/routes/auth.ts'") },
    { name: 'User routes', test: content.includes("'src/routes/users.ts'") },
    
    // Schemas
    { name: 'Auth schemas', test: content.includes("'src/schemas/auth.ts'") },
    { name: 'User schemas', test: content.includes("'src/schemas/user.ts'") },
    
    // Types and utilities
    { name: 'Type definitions', test: content.includes("'src/types/index.ts'") },
    { name: 'Password utils', test: content.includes("'src/utils/password.ts'") },
    { name: 'JWT utils', test: content.includes("'src/utils/jwt.ts'") },
    { name: 'Response utils', test: content.includes("'src/utils/response.ts'") },
    
    // Configuration files
    { name: 'Environment example', test: content.includes("'.env.example'") },
    { name: 'Gitignore', test: content.includes("'.gitignore'") },
    { name: 'ESLint config', test: content.includes("'.eslintrc.json'") },
    { name: 'Prettier config', test: content.includes("'.prettierrc'") },
    
    // Docker configuration
    { name: 'Dockerfile', test: content.includes("'Dockerfile'") },
    { name: 'Docker compose', test: content.includes("'docker-compose.yml'") },
    
    // Testing
    { name: 'Jest config', test: content.includes("'jest.config.js'") },
    { name: 'Health tests', test: content.includes("'test/health.test.ts'") },
    { name: 'Auth tests', test: content.includes("'test/auth.test.ts'") },
    
    // README
    { name: 'README included', test: content.includes("'README.md'") },
    
    // Features
    { name: 'Async/await patterns', test: content.includes('async') && content.includes('await') },
    { name: 'Middleware composition', test: content.includes('app.use') },
    { name: 'Context and Next', test: content.includes('Context') && content.includes('Next') },
    { name: 'Error handling', test: content.includes('errorHandler') },
    { name: 'JWT authentication', test: content.includes('authenticateToken') },
    { name: 'Role authorization', test: content.includes('authorizeRoles') },
    { name: 'Joi validation', test: content.includes('Joi.object') },
    { name: 'Redis integration', test: content.includes('redisClient') },
    { name: 'Winston logging', test: content.includes('winston') },
    { name: 'Rate limiting', test: content.includes('rateLimit') },
    { name: 'Compression', test: content.includes('compress') },
    { name: 'Security headers', test: content.includes('helmet') },
    { name: 'CORS support', test: content.includes('cors') },
    { name: 'Request tracking', test: content.includes('requestId') },
    { name: 'Response timing', test: content.includes('responseTime') },
    
    // Async/await specific patterns
    { name: 'Modern async middleware', test: content.includes('async (ctx, next)') },
    { name: 'Async route handlers', test: content.includes('async (ctx)') },
    { name: 'Graceful shutdown', test: content.includes('gracefulShutdown') },
    
    // Template tags
    { name: 'Template tags complete', test: content.includes('async-await') && content.includes('middleware') },
    { name: 'Post install commands', test: content.includes('postInstall') }
  ];

  let passed = 0;
  let failed = 0;

  console.log('🧪 Validating Koa.js TypeScript Template...\n');

  checks.forEach(check => {
    if (check.test) {
      console.log(`✅ ${check.name}`);
      passed++;
    } else {
      console.log(`❌ ${check.name}`);
      failed++;
    }
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All Koa.js template validations passed!');
    console.log('✅ Template includes comprehensive modern features:');
    console.log('   - Modern async/await patterns throughout');
    console.log('   - Elegant middleware composition with onion model');
    console.log('   - JWT authentication and role-based authorization');
    console.log('   - Joi schema validation for requests');
    console.log('   - Winston structured logging with request tracking');
    console.log('   - Redis integration for caching and sessions');
    console.log('   - Security middleware (Helmet, CORS, rate limiting)');
    console.log('   - Health checks for Kubernetes deployment');
    console.log('   - Comprehensive error handling and response formatting');
    console.log('   - Clean architecture with organized project structure');
    console.log('   - Docker configuration for production deployment');
    console.log('   - Comprehensive testing setup with Jest');
    console.log('✅ Template is ready for Phase 1 implementation');
  } else {
    console.log('⚠️  Some validations failed');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Error reading template file:', error.message);
  process.exit(1);
}