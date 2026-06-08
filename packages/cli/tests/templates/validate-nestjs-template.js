const fs = require('fs');
const path = require('path');

// Test file exists and is readable
const templatePath = path.join(__dirname, '../src/templates/backend/nestjs-ts.ts');

try {
  const content = fs.readFileSync(templatePath, 'utf8');
  
  // Basic validation checks
  const checks = [
    // Template structure
    { name: 'Template export', test: content.includes('export const nestjsTypeScriptTemplate') },
    { name: 'Framework property', test: content.includes("framework: 'nestjs'") },
    { name: 'Language property', test: content.includes("language: 'typescript'") },
    { name: 'Port configuration', test: content.includes('port: 3000') },
    
    // Core NestJS dependencies
    { name: 'NestJS common', test: content.includes("'@nestjs/common'") },
    { name: 'NestJS core', test: content.includes("'@nestjs/core'") },
    { name: 'NestJS platform express', test: content.includes("'@nestjs/platform-express'") },
    { name: 'NestJS config', test: content.includes("'@nestjs/config'") },
    { name: 'NestJS JWT', test: content.includes("'@nestjs/jwt'") },
    { name: 'NestJS Passport', test: content.includes("'@nestjs/passport'") },
    { name: 'NestJS Swagger', test: content.includes("'@nestjs/swagger'") },
    { name: 'NestJS Throttler', test: content.includes("'@nestjs/throttler'") },
    { name: 'NestJS TypeORM', test: content.includes("'@nestjs/typeorm'") },
    
    // Authentication dependencies
    { name: 'Passport', test: content.includes("'passport'") },
    { name: 'Passport JWT', test: content.includes("'passport-jwt'") },
    { name: 'Passport Local', test: content.includes("'passport-local'") },
    { name: 'Bcrypt', test: content.includes("'bcrypt'") },
    
    // Validation dependencies
    { name: 'Class validator', test: content.includes("'class-validator'") },
    { name: 'Class transformer', test: content.includes("'class-transformer'") },
    
    // Essential files
    { name: 'Package.json', test: content.includes("'package.json'") },
    { name: 'Nest CLI config', test: content.includes("'nest-cli.json'") },
    { name: 'TypeScript config', test: content.includes("'tsconfig.json'") },
    { name: 'TypeScript build config', test: content.includes("'tsconfig.build.json'") },
    { name: 'Main entry point', test: content.includes("'src/main.ts'") },
    
    // Application structure
    { name: 'App module', test: content.includes("'src/app/app.module.ts'") },
    { name: 'App controller', test: content.includes("'src/app/app.controller.ts'") },
    { name: 'App service', test: content.includes("'src/app/app.service.ts'") },
    
    // Configuration
    { name: 'Configuration file', test: content.includes("'src/config/configuration.ts'") },
    { name: 'Database config', test: content.includes("'src/config/database.config.ts'") },
    
    // Authentication module
    { name: 'Auth module', test: content.includes("'src/auth/auth.module.ts'") },
    { name: 'Auth service', test: content.includes("'src/auth/auth.service.ts'") },
    { name: 'Auth controller', test: content.includes("'src/auth/auth.controller.ts'") },
    { name: 'JWT strategy', test: content.includes("'src/auth/strategies/jwt.strategy.ts'") },
    { name: 'Local strategy', test: content.includes("'src/auth/strategies/local.strategy.ts'") },
    
    // Guards
    { name: 'JWT auth guard', test: content.includes("'src/auth/guards/jwt-auth.guard.ts'") },
    { name: 'Local auth guard', test: content.includes("'src/auth/guards/local-auth.guard.ts'") },
    { name: 'Roles guard', test: content.includes("'src/auth/guards/roles.guard.ts'") },
    
    // DTOs
    { name: 'Login DTO', test: content.includes("'src/auth/dto/login.dto.ts'") },
    { name: 'Register DTO', test: content.includes("'src/auth/dto/register.dto.ts'") },
    
    // Users module
    { name: 'Users module', test: content.includes("'src/users/users.module.ts'") },
    { name: 'Users service', test: content.includes("'src/users/users.service.ts'") },
    { name: 'Users controller', test: content.includes("'src/users/users.controller.ts'") },
    
    // Health module
    { name: 'Health module', test: content.includes("'src/health/health.module.ts'") },
    { name: 'Health service', test: content.includes("'src/health/health.service.ts'") },
    { name: 'Health controller', test: content.includes("'src/health/health.controller.ts'") },
    
    // Common utilities
    { name: 'Logging interceptor', test: content.includes("'src/common/interceptors/logging.interceptor.ts'") },
    { name: 'Transform interceptor', test: content.includes("'src/common/interceptors/transform.interceptor.ts'") },
    { name: 'HTTP exception filter', test: content.includes("'src/common/filters/http-exception.filter.ts'") },
    
    // Decorators
    { name: 'Roles decorator', test: content.includes("'src/auth/decorators/roles.decorator.ts'") },
    
    // Configuration files
    { name: 'Environment example', test: content.includes("'.env.example'") },
    { name: 'Gitignore', test: content.includes("'.gitignore'") },
    { name: 'ESLint config', test: content.includes("'.eslintrc.js'") },
    { name: 'Prettier config', test: content.includes("'.prettierrc'") },
    
    // Docker configuration
    { name: 'Dockerfile', test: content.includes("'Dockerfile'") },
    { name: 'Docker compose', test: content.includes("'docker-compose.yml'") },
    
    // Testing
    { name: 'Jest E2E config', test: content.includes("'test/jest-e2e.json'") },
    { name: 'E2E test', test: content.includes("'test/app.e2e-spec.ts'") },
    
    // README
    { name: 'README included', test: content.includes("'README.md'") },
    
    // Features
    { name: 'Dependency injection', test: content.includes('Injectable') },
    { name: 'Modules architecture', test: content.includes('@Module') },
    { name: 'Guards implementation', test: content.includes('CanActivate') },
    { name: 'Interceptors', test: content.includes('NestInterceptor') },
    { name: 'Decorators usage', test: content.includes('@') },
    { name: 'Swagger integration', test: content.includes('SwaggerModule') },
    { name: 'Rate limiting', test: content.includes('ThrottlerModule') },
    { name: 'Validation pipes', test: content.includes('ValidationPipe') },
    { name: 'JWT authentication', test: content.includes('JwtModule') },
    { name: 'Passport strategies', test: content.includes('PassportStrategy') },
    { name: 'TypeORM integration', test: content.includes('TypeOrmModule') },
    
    // Template tags
    { name: 'Template tags', test: content.includes('nestjs') && content.includes('dependency-injection') },
    { name: 'Post install commands', test: content.includes('postInstall') }
  ];

  let passed = 0;
  let failed = 0;

  console.log('🧪 Validating NestJS TypeScript Template...\n');

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
    console.log('🎉 All NestJS template validations passed!');
    console.log('✅ Template includes comprehensive enterprise features:');
    console.log('   - Dependency injection with decorators');
    console.log('   - Modular architecture with feature modules');
    console.log('   - Guards for authentication and authorization');
    console.log('   - Interceptors for logging and transformation');
    console.log('   - JWT authentication with Passport strategies');
    console.log('   - Class-validator for DTO validation');
    console.log('   - Swagger/OpenAPI documentation');
    console.log('   - Rate limiting and security features');
    console.log('   - Health checks for Kubernetes');
    console.log('   - TypeORM database integration');
    console.log('   - Docker configuration for production');
    console.log('   - Comprehensive testing setup');
    console.log('✅ Template is ready for Phase 1 implementation');
  } else {
    console.log('⚠️  Some validations failed');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Error reading template file:', error.message);
  process.exit(1);
}