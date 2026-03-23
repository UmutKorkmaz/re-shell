const fs = require('fs');
const path = require('path');

// Test file exists and is readable
const templatePath = path.join(__dirname, '../src/templates/backend/fastify-ts.ts');

try {
  const content = fs.readFileSync(templatePath, 'utf8');
  
  // Basic validation checks
  const checks = [
    { name: 'Template export', test: content.includes('export const fastifyTypeScriptTemplate') },
    { name: 'Framework property', test: content.includes("framework: 'fastify'") },
    { name: 'Language property', test: content.includes("language: 'typescript'") },
    { name: 'Fastify dependency', test: content.includes("fastify: '^4.25.2'") },
    { name: 'JWT plugin', test: content.includes("'@fastify/jwt'") },
    { name: 'Schema validation', test: content.includes('@sinclair/typebox') },
    { name: 'TypeScript config', test: content.includes('tsconfig.json') },
    { name: 'Server file', test: content.includes("'src/server.ts'") },
    { name: 'Environment config', test: content.includes("'src/config/environment.ts'") },
    { name: 'Plugin system', test: content.includes("'src/plugins/index.ts'") },
    { name: 'Health routes', test: content.includes("'src/routes/health.ts'") },
    { name: 'Auth routes', test: content.includes("'src/routes/auth.ts'") },
    { name: 'User routes', test: content.includes("'src/routes/users.ts'") },
    { name: 'Test files', test: content.includes("'test/health.test.ts'") },
    { name: 'Docker config', test: content.includes("'Dockerfile'") },
    { name: 'README included', test: content.includes("'README.md'") },
    { name: 'Environment example', test: content.includes("'.env.example'") },
    { name: 'Async/await support', test: content.includes('async') },
    { name: 'Schema validation features', test: content.includes('Type.Object') },
    { name: 'Plugin architecture', test: content.includes('fastify.register') },
    { name: 'Health checks', test: content.includes('/api/health') },
    { name: 'JWT authentication', test: content.includes('JWT_SECRET') },
    { name: 'Rate limiting', test: content.includes('@fastify/rate-limit') },
    { name: 'CORS support', test: content.includes('@fastify/cors') },
    { name: 'Helmet security', test: content.includes('@fastify/helmet') },
    { name: 'Swagger docs', test: content.includes('@fastify/swagger') },
    { name: 'TAP testing', test: content.includes("'tap'") },
    { name: 'Graceful shutdown', test: content.includes('SIGTERM') },
    { name: 'Post install commands', test: content.includes('postInstall') }
  ];

  let passed = 0;
  let failed = 0;

  console.log('🧪 Validating Fastify TypeScript Template...\n');

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
    console.log('🎉 All Fastify template validations passed!');
    console.log('✅ Template is ready for Phase 1 implementation');
  } else {
    console.log('⚠️  Some validations failed');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Error reading template file:', error.message);
  process.exit(1);
}