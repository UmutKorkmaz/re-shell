const { fastifyTypeScriptTemplate } = require('../src/templates/backend/fastify-ts');

describe('Fastify TypeScript Template', () => {
  test('should have correct template structure', () => {
    expect(fastifyTypeScriptTemplate.id).toBe('fastify-ts');
    expect(fastifyTypeScriptTemplate.name).toBe('Fastify + TypeScript');
    expect(fastifyTypeScriptTemplate.framework).toBe('fastify');
    expect(fastifyTypeScriptTemplate.language).toBe('typescript');
    expect(fastifyTypeScriptTemplate.port).toBe(3000);
  });

  test('should include required dependencies', () => {
    const deps = fastifyTypeScriptTemplate.dependencies;
    expect(deps).toHaveProperty('fastify');
    expect(deps).toHaveProperty('@fastify/jwt');
    expect(deps).toHaveProperty('@fastify/cors');
    expect(deps).toHaveProperty('@fastify/helmet');
    expect(deps).toHaveProperty('@fastify/rate-limit');
    expect(deps).toHaveProperty('pino');
    expect(deps).toHaveProperty('fluent-json-schema');
  });

  test('should include dev dependencies', () => {
    const devDeps = fastifyTypeScriptTemplate.devDependencies;
    expect(devDeps).toHaveProperty('typescript');
    expect(devDeps).toHaveProperty('ts-node');
    expect(devDeps).toHaveProperty('tap');
    expect(devDeps).toHaveProperty('@typescript-eslint/eslint-plugin');
  });

  test('should have comprehensive features', () => {
    const features = fastifyTypeScriptTemplate.features;
    expect(features).toContain('authentication');
    expect(features).toContain('validation');
    expect(features).toContain('logging');
    expect(features).toContain('cors');
    expect(features).toContain('rate-limiting');
    expect(features).toContain('rest-api');
  });

  test('should include essential files', () => {
    const files = fastifyTypeScriptTemplate.files;
    expect(files).toHaveProperty('package.json');
    expect(files).toHaveProperty('tsconfig.json');
    expect(files).toHaveProperty('src/server.ts');
    expect(files).toHaveProperty('src/config/environment.ts');
    expect(files).toHaveProperty('src/plugins/index.ts');
    expect(files).toHaveProperty('src/routes/health.ts');
    expect(files).toHaveProperty('src/routes/auth.ts');
    expect(files).toHaveProperty('src/routes/users.ts');
    expect(files).toHaveProperty('README.md');
    expect(files).toHaveProperty('Dockerfile');
  });

  test('should have proper package.json structure', () => {
    const packageJson = fastifyTypeScriptTemplate.files['package.json'];
    expect(packageJson.scripts).toHaveProperty('dev');
    expect(packageJson.scripts).toHaveProperty('build');
    expect(packageJson.scripts).toHaveProperty('test');
    expect(packageJson.scripts).toHaveProperty('lint');
    expect(packageJson.scripts.dev).toContain('ts-node-dev');
  });

  test('should include schema validation with TypeBox', () => {
    const serverFile = fastifyTypeScriptTemplate.files['src/server.ts'];
    expect(serverFile).toContain('ajv');
    expect(serverFile).toContain('customOptions');
    
    const authFile = fastifyTypeScriptTemplate.files['src/routes/auth.ts'];
    expect(authFile).toContain('@sinclair/typebox');
    expect(authFile).toContain('Type.Object');
  });

  test('should include plugin architecture', () => {
    const pluginsFile = fastifyTypeScriptTemplate.files['src/plugins/index.ts'];
    expect(pluginsFile).toContain('@fastify/autoload');
    expect(pluginsFile).toContain('fastify.register');
    expect(pluginsFile).toContain('@fastify/swagger');
  });

  test('should include comprehensive testing setup', () => {
    const testFile = fastifyTypeScriptTemplate.files['test/health.test.ts'];
    expect(testFile).toContain('tap');
    expect(testFile).toContain('app.inject');
    expect(testFile).toContain('t.equal');
  });

  test('should have proper environment configuration', () => {
    const envFile = fastifyTypeScriptTemplate.files['src/config/environment.ts'];
    expect(envFile).toContain('@sinclair/typebox');
    expect(envFile).toContain('ConfigSchema');
    expect(envFile).toContain('JWT_SECRET');
    expect(envFile).toContain('RATE_LIMIT_MAX');
  });

  test('should include Docker configuration', () => {
    const dockerfile = fastifyTypeScriptTemplate.files['Dockerfile'];
    expect(dockerfile).toContain('node:18-alpine');
    expect(dockerfile).toContain('dumb-init');
    expect(dockerfile).toContain('HEALTHCHECK');
    
    const dockerCompose = fastifyTypeScriptTemplate.files['docker-compose.yml'];
    expect(dockerCompose).toContain('version: \'3.8\'');
    expect(dockerCompose).toContain('redis');
  });

  test('should have correct template tags', () => {
    const tags = fastifyTypeScriptTemplate.tags;
    expect(tags).toContain('fastify');
    expect(tags).toContain('typescript');
    expect(tags).toContain('schema-validation');
    expect(tags).toContain('plugins');
    expect(tags).toContain('async');
  });

  test('should include proper postInstall commands', () => {
    const postInstall = fastifyTypeScriptTemplate.postInstall;
    expect(postInstall).toContain('npm install');
    expect(postInstall).toContain('cp .env.example .env');
    expect(postInstall.some(cmd => cmd.includes('/docs'))).toBe(true);
  });

  console.log('✅ All Fastify TypeScript template tests passed!');
});