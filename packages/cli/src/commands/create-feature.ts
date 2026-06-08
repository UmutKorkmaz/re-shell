import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { findMonorepoRoot } from '../utils/monorepo';
import { getBackendTemplate, listBackendTemplates, BackendTemplate } from '../templates/backend/index';

interface CreateFeatureOptions {
  spinner?: any;
  verbose?: boolean;
  type?: 'crud' | 'auth' | 'file-upload' | 'websocket' | 'graphql' | 'rest-api' | 'fullstack';
  backend?: string;
  frontend?: 'react' | 'vue' | 'svelte' | 'angular' | 'vanilla';
  language?: 'typescript' | 'javascript' | 'python' | 'go' | 'rust';
  features?: string[];
  workspace?: string;
  port?: string;
  skipInstall?: boolean;
  openApi?: boolean;
  graphql?: boolean;
  websockets?: boolean;
  database?: 'prisma' | 'typeorm' | 'mongoose' | 'sequelize' | 'none';
}

interface FeatureContext {
  name: string;
  normalizedName: string;
  pascalName: string;
  camelName: string;
  type: string;
  backend?: string;
  frontend?: string;
  language?: string;
  port?: string;
  database?: string;
  features: string[];
}

export async function createFeature(name: string, options: CreateFeatureOptions = {}) {
  try {
    const monorepoRoot = await findMonorepoRoot(process.cwd());
    if (!monorepoRoot) {
      throw new Error('Not in a Re-Shell monorepo. Run this command from within a monorepo.');
    }

    if (options.spinner) {
      options.spinner.text = `Creating feature "${name}"...`;
    }

    const context = await buildFeatureContext(name, options);
    const featurePath = await determineFeaturePath(monorepoRoot, context, options);

    if (await fs.pathExists(featurePath)) {
      throw new Error(`Feature "${name}" already exists at ${featurePath}`);
    }

    await generateFeature(monorepoRoot, featurePath, context, options);

    if (options.spinner) {
      options.spinner.succeed(chalk.green(`Feature "${name}" created successfully!`));
    }

    console.log('\n' + chalk.bold('Feature Created:'));
    console.log(`  Name: ${name}`);
    console.log(`  Type: ${context.type}`);
    console.log(`  Path: ${path.relative(process.cwd(), featurePath)}`);

    if (context.backend) {
      console.log(`  Backend: ${context.backend}`);
    }
    if (context.frontend) {
      console.log(`  Frontend: ${context.frontend}`);
    }
    if (context.database && context.database !== 'none') {
      console.log(`  Database: ${context.database}`);
    }

    console.log('\nNext steps:');
    console.log(`  1. cd ${path.relative(process.cwd(), featurePath)}`);
    if (!options.skipInstall) {
      console.log(`  2. pnpm install`);
    }
    console.log(`  3. pnpm run dev`);

  } catch (error) {
    if (options.spinner) {
      options.spinner.fail(chalk.red('Feature creation failed'));
    }
    throw error;
  }
}

async function buildFeatureContext(name: string, options: CreateFeatureOptions): Promise<FeatureContext> {
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const pascalName = name.split(/[-\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);

  return {
    name,
    normalizedName,
    pascalName,
    camelName,
    type: options.type || 'crud',
    backend: options.backend,
    frontend: options.frontend,
    language: options.language,
    port: options.port,
    database: options.database || 'none',
    features: options.features || [],
  };
}

async function determineFeaturePath(monorepoRoot: string, context: FeatureContext, options: CreateFeatureOptions): Promise<string> {
  if (options.workspace) {
    return path.join(monorepoRoot, options.workspace, 'features', context.normalizedName);
  }

  // Determine if this is a backend-only, frontend-only, or full-stack feature
  if (context.backend && !context.frontend) {
    return path.join(monorepoRoot, 'apps', `${context.normalizedName}-api`);
  }

  if (context.frontend && !context.backend) {
    return path.join(monorepoRoot, 'apps', context.normalizedName);
  }

  // Full-stack feature
  return path.join(monorepoRoot, 'apps', context.normalizedName);
}

async function generateFeature(
  monorepoRoot: string,
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  await fs.ensureDir(featurePath);

  const isFullStack = context.backend && context.frontend;
  const isBackendOnly = context.backend && !context.frontend;
  const isFrontendOnly = context.frontend && !context.backend;

  if (isFullStack) {
    // Create monorepo structure for full-stack feature
    await generateFullStackFeature(featurePath, context, options);
  } else if (isBackendOnly) {
    await generateBackendFeature(featurePath, context, options);
  } else if (isFrontendOnly) {
    await generateFrontendFeature(featurePath, context, options);
  } else {
    // Default to CRUD full-stack
    await generateFullStackFeature(featurePath, context, options);
  }
}

async function generateFullStackFeature(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const backendPath = path.join(featurePath, 'api');
  const frontendPath = path.join(featurePath, 'web');

  // Generate backend
  if (context.backend) {
    await fs.ensureDir(backendPath);
    await generateBackendFeature(backendPath, context, options);
  }

  // Generate frontend
  if (context.frontend) {
    await fs.ensureDir(frontendPath);
    await generateFrontendFeature(frontendPath, context, options);
  }

  // Generate root configuration files
  await generateRootConfig(featurePath, context, options);
}

async function generateBackendFeature(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const backendTemplate = context.backend
    ? getBackendTemplate(context.backend)
    : getBackendTemplate('express');

  if (!backendTemplate) {
    throw new Error(`Backend template not found: ${context.backend}`);
  }

  // Generate files from backend template
  for (const [filePath, content] of Object.entries(backendTemplate.files)) {
    const processedContent = processTemplateContent(content, context);
    const fullPath = path.join(featurePath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, processedContent);

    if (options.verbose) {
      console.log(chalk.green(`  ✓ Created ${filePath}`));
    }
  }

  // Generate feature-specific backend code
  await generateFeatureBackendCode(featurePath, context, options);
}

async function generateFrontendFeature(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const frontendFramework = context.frontend || 'react';

  // Generate frontend based on framework
  switch (frontendFramework) {
    case 'react':
      await generateReactFrontend(featurePath, context, options);
      break;
    case 'vue':
      await generateVueFrontend(featurePath, context, options);
      break;
    case 'svelte':
      await generateSvelteFrontend(featurePath, context, options);
      break;
    default:
      await generateReactFrontend(featurePath, context, options);
  }

  // Generate feature-specific frontend code
  await generateFeatureFrontendCode(featurePath, context, options);
}

async function generateReactFrontend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const hasTypeScript = context.language === 'typescript' || !context.language;

  const files = {
    'package.json': generateReactPackageJson(context, hasTypeScript),
    'vite.config.ts': generateViteConfig(context),
    'tsconfig.json': generateTsConfig(),
    'index.html': generateIndexHtml(context),
    'src/main.tsx': generateReactMain(context, hasTypeScript),
    'src/App.tsx': generateReactApp(context),
    'src/index.css': generateIndexCss(),
    ...(hasTypeScript ? { 'src/vite-env.d.ts': '// Vite environment types\n' } : {}),
  };

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(featurePath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);

    if (options.verbose) {
      console.log(chalk.green(`  ✓ Created ${filePath}`));
    }
  }
}

async function generateVueFrontend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const files = {
    'package.json': generateVuePackageJson(context),
    'vite.config.ts': generateVueViteConfig(context),
    'tsconfig.json': generateTsConfig(),
    'index.html': generateVueIndexHtml(context),
    'src/main.ts': generateVueMain(context),
    'src/App.vue': generateVueApp(context),
    'src/style.css': generateIndexCss(),
  };

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(featurePath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);

    if (options.verbose) {
      console.log(chalk.green(`  ✓ Created ${filePath}`));
    }
  }
}

async function generateSvelteFrontend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const files = {
    'package.json': generateSveltePackageJson(context),
    'vite.config.ts': generateSvelteViteConfig(context),
    'tsconfig.json': generateTsConfig(),
    'svelte.config.js': generateSvelteConfig(),
    'index.html': generateSvelteIndexHtml(context),
    'src/main.ts': generateSvelteMain(context),
    'src/App.svelte': generateSvelteApp(context),
    'src/app.css': generateIndexCss(),
  };

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(featurePath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);

    if (options.verbose) {
      console.log(chalk.green(`  ✓ Created ${filePath}`));
    }
  }
}

async function generateFeatureBackendCode(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const featureType = context.type || 'crud';

  switch (featureType) {
    case 'crud':
      await generateCrudBackend(featurePath, context, options);
      break;
    case 'auth':
      await generateAuthBackend(featurePath, context, options);
      break;
    case 'file-upload':
      await generateFileUploadBackend(featurePath, context, options);
      break;
    case 'websocket':
      await generateWebSocketBackend(featurePath, context, options);
      break;
    case 'graphql':
      await generateGraphQLBackend(featurePath, context, options);
      break;
    default:
      await generateCrudBackend(featurePath, context, options);
  }
}

async function generateCrudBackend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const hasTypeScript = context.language === 'typescript' || !context.language;

  const routesFile = hasTypeScript ? 'src/routes/' + context.normalizedName + '.routes.ts' : 'src/routes/' + context.normalizedName + '.routes.js';
  const controllerFile = hasTypeScript ? 'src/controllers/' + context.normalizedName + '.controller.ts' : 'src/controllers/' + context.normalizedName + '.controller.js';
  const serviceFile = hasTypeScript ? 'src/services/' + context.normalizedName + '.service.ts' : 'src/services/' + context.normalizedName + '.service.js';
  const modelFile = hasTypeScript ? 'src/models/' + context.normalizedName + '.model.ts' : 'src/models/' + context.normalizedName + '.model.js';

  const modelContent = generateCrudModel(context, hasTypeScript);
  const serviceContent = generateCrudService(context, hasTypeScript);
  const controllerContent = generateCrudController(context, hasTypeScript);
  const routesContent = generateCrudRoutes(context, hasTypeScript);

  await fs.ensureDir(path.join(featurePath, path.dirname(routesFile)));
  await fs.ensureDir(path.join(featurePath, path.dirname(controllerFile)));
  await fs.ensureDir(path.join(featurePath, path.dirname(serviceFile)));
  await fs.ensureDir(path.join(featurePath, path.dirname(modelFile)));

  await fs.writeFile(path.join(featurePath, routesFile), routesContent);
  await fs.writeFile(path.join(featurePath, controllerFile), controllerContent);
  await fs.writeFile(path.join(featurePath, serviceFile), serviceContent);
  await fs.writeFile(path.join(featurePath, modelFile), modelContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created CRUD backend files'));
  }
}

async function generateAuthBackend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const hasTypeScript = context.language === 'typescript' || !context.language;

  const authControllerContent = generateAuthController(context, hasTypeScript);
  const authServiceContent = generateAuthService(context, hasTypeScript);
  const authRoutesContent = generateAuthRoutes(context, hasTypeScript);
  const middlewareContent = generateAuthMiddleware(context, hasTypeScript);

  await fs.ensureDir(path.join(featurePath, 'src/controllers'));
  await fs.ensureDir(path.join(featurePath, 'src/services'));
  await fs.ensureDir(path.join(featurePath, 'src/routes'));
  await fs.ensureDir(path.join(featurePath, 'src/middleware'));

  await fs.writeFile(path.join(featurePath, 'src/controllers/auth.controller.ts'), authControllerContent);
  await fs.writeFile(path.join(featurePath, 'src/services/auth.service.ts'), authServiceContent);
  await fs.writeFile(path.join(featurePath, 'src/routes/auth.routes.ts'), authRoutesContent);
  await fs.writeFile(path.join(featurePath, 'src/middleware/auth.middleware.ts'), middlewareContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created auth backend files'));
  }
}

async function generateFileUploadBackend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const hasTypeScript = context.language === 'typescript' || !context.language;

  const uploadControllerContent = generateUploadController(context, hasTypeScript);
  const uploadRoutesContent = generateUploadRoutes(context, hasTypeScript);
  const multerConfigContent = generateMulterConfig(context, hasTypeScript);

  await fs.ensureDir(path.join(featurePath, 'src/controllers'));
  await fs.ensureDir(path.join(featurePath, 'src/routes'));
  await fs.ensureDir(path.join(featurePath, 'src/config'));

  await fs.writeFile(path.join(featurePath, 'src/controllers/upload.controller.ts'), uploadControllerContent);
  await fs.writeFile(path.join(featurePath, 'src/routes/upload.routes.ts'), uploadRoutesContent);
  await fs.writeFile(path.join(featurePath, 'src/config/multer.config.ts'), multerConfigContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created file upload backend files'));
  }
}

async function generateWebSocketBackend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const hasTypeScript = context.language === 'typescript' || !context.language;

  const wsServerContent = generateWebSocketServer(context, hasTypeScript);
  const wsHandlersContent = generateWebSocketHandlers(context, hasTypeScript);

  await fs.ensureDir(path.join(featurePath, 'src/websocket'));

  await fs.writeFile(path.join(featurePath, 'src/websocket/server.ts'), wsServerContent);
  await fs.writeFile(path.join(featurePath, 'src/websocket/handlers.ts'), wsHandlersContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created WebSocket backend files'));
  }
}

async function generateGraphQLBackend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const hasTypeScript = context.language === 'typescript' || !context.language;

  const graphqlSchemaContent = generateGraphQLSchema(context, hasTypeScript);
  const graphqlResolversContent = generateGraphQLResolvers(context, hasTypeScript);

  await fs.ensureDir(path.join(featurePath, 'src/graphql'));

  await fs.writeFile(path.join(featurePath, 'src/graphql/schema.graphql'), graphqlSchemaContent);
  await fs.writeFile(path.join(featurePath, 'src/graphql/resolvers.ts'), graphqlResolversContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created GraphQL backend files'));
  }
}

async function generateFeatureFrontendCode(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const featureType = context.type || 'crud';
  const frontendFramework = context.frontend || 'react';

  switch (featureType) {
    case 'crud':
      await generateCrudFrontend(featurePath, context, frontendFramework, options);
      break;
    case 'auth':
      await generateAuthFrontend(featurePath, context, frontendFramework, options);
      break;
    default:
      await generateCrudFrontend(featurePath, context, frontendFramework, options);
  }
}

async function generateCrudFrontend(
  featurePath: string,
  context: FeatureContext,
  framework: string,
  options: CreateFeatureOptions
): Promise<void> {
  if (framework === 'react') {
    await generateReactCrudFrontend(featurePath, context, options);
  } else if (framework === 'vue') {
    await generateVueCrudFrontend(featurePath, context, options);
  } else if (framework === 'svelte') {
    await generateSvelteCrudFrontend(featurePath, context, options);
  }
}

async function generateReactCrudFrontend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const componentDir = path.join(featurePath, 'src', 'features', context.normalizedName);
  await fs.ensureDir(componentDir);

  // Generate main feature component
  const featureComponentContent = generateReactCrudComponent(context);
  const featureHookContent = generateReactCrudHook(context);
  const featureTypesContent = generateReactCrudTypes(context);

  await fs.writeFile(path.join(componentDir, context.pascalName + '.tsx'), featureComponentContent);
  await fs.writeFile(path.join(componentDir, 'use' + context.pascalName + '.ts'), featureHookContent);
  await fs.writeFile(path.join(componentDir, context.pascalName + '.types.ts'), featureTypesContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created React CRUD frontend files'));
  }
}

async function generateVueCrudFrontend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const componentDir = path.join(featurePath, 'src', 'features', context.normalizedName);
  await fs.ensureDir(componentDir);

  const featureComponentContent = generateVueCrudComponent(context);
  const featureComposableContent = generateVueCrudComposable(context);

  await fs.writeFile(path.join(componentDir, context.pascalName + '.vue'), featureComponentContent);
  await fs.writeFile(path.join(componentDir, 'use' + context.pascalName + '.ts'), featureComposableContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created Vue CRUD frontend files'));
  }
}

async function generateSvelteCrudFrontend(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const componentDir = path.join(featurePath, 'src', 'features', context.normalizedName);
  await fs.ensureDir(componentDir);

  const featureComponentContent = generateSvelteCrudComponent(context);

  await fs.writeFile(path.join(componentDir, context.pascalName + '.svelte'), featureComponentContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created Svelte CRUD frontend files'));
  }
}

async function generateAuthFrontend(
  featurePath: string,
  context: FeatureContext,
  framework: string,
  options: CreateFeatureOptions
): Promise<void> {
  const authDir = path.join(featurePath, 'src', 'features', 'auth');
  await fs.ensureDir(authDir);

  if (framework === 'react') {
    const loginComponentContent = generateReactLoginComponent(context);
    const authHookContent = generateReactAuthHook(context);

    await fs.writeFile(path.join(authDir, 'Login.tsx'), loginComponentContent);
    await fs.writeFile(path.join(authDir, 'useAuth.ts'), authHookContent);
  }

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created auth frontend files'));
  }
}

async function generateRootConfig(
  featurePath: string,
  context: FeatureContext,
  options: CreateFeatureOptions
): Promise<void> {
  const packageJsonContent = generateRootPackageJson(context);
  const readmeContent = generateFeatureReadme(context);
  const dockerComposeContent = generateDockerCompose(context);
  const envExampleContent = generateEnvExample(context);

  await fs.writeFile(path.join(featurePath, 'package.json'), packageJsonContent);
  await fs.writeFile(path.join(featurePath, 'README.md'), readmeContent);
  await fs.writeFile(path.join(featurePath, 'docker-compose.yml'), dockerComposeContent);
  await fs.writeFile(path.join(featurePath, '.env.example'), envExampleContent);

  if (options.verbose) {
    console.log(chalk.green('  ✓ Created root configuration files'));
  }
}

function processTemplateContent(content: string, context: FeatureContext): string {
  return content
    .replace(/\{\{name\}\}/g, context.name)
    .replace(/\{\{normalizedName\}\}/g, context.normalizedName)
    .replace(/\{\{pascalName\}\}/g, context.pascalName)
    .replace(/\{\{camelName\}\}/g, context.camelName)
    .replace(/\{\{port\}\}/g, context.port || '3000')
    .replace(/\{\{description\}\}/g, `${context.name} feature`)
    .replace(/\{\{projectName\}\}/g, `${context.normalizedName}-api`);
}

// Template content generators
function generateReactPackageJson(context: FeatureContext, hasTypeScript: boolean): string {
  return `{
  "name": "${context.normalizedName}-web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.3",
    "vite": "^5.4.9"${hasTypeScript ? `,
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"` : ''}
  }
}`;
}

function generateVuePackageJson(context: FeatureContext): string {
  return `{
  "name": "${context.normalizedName}-web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.12",
    "vue-router": "^4.4.5",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.4",
    "@vue/tsconfig": "^0.5.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.9",
    "vue-tsc": "^2.1.6"
  }
}`;
}

function generateSveltePackageJson(context: FeatureContext): string {
  return `{
  "name": "${context.normalizedName}-web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "svelte-check && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "svelte": "^4.2.19",
    "svelte-routing": "^2.0.0",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "@tsconfig/svelte": "^5.0.0",
    "svelte-check": "^4.0.5",
    "typescript": "^5.6.3",
    "vite": "^5.4.9"
  }
}`;
}

function generateViteConfig(context: FeatureContext): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${parseInt(context.port || '5173') + 1000},
    proxy: {
      '/api': {
        target: 'http://localhost:${context.port || "3000"}',
        changeOrigin: true,
      },
    },
  },
});`;
}

function generateVueViteConfig(context: FeatureContext): string {
  return `import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: ${parseInt(context.port || '5173') + 1000},
    proxy: {
      '/api': {
        target: 'http://localhost:${context.port || "3000"}',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});`;
}

function generateSvelteViteConfig(context: FeatureContext): string {
  return `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: ${parseInt(context.port || '5173') + 1000},
    proxy: {
      '/api': {
        target: 'http://localhost:${context.port || "3000"}',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      $lib: '/src/lib',
    },
  },
});`;
}

function generateSvelteConfig(): string {
  return `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};`;
}

function generateTsConfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`;
}

function generateIndexHtml(context: FeatureContext): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${context.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

function generateVueIndexHtml(context: FeatureContext): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${context.name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`;
}

function generateSvelteIndexHtml(context: FeatureContext): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${context.name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`;
}

function generateReactMain(context: FeatureContext, hasTypeScript: boolean): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);`;
}

function generateReactApp(context: FeatureContext): string {
  return `import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>${context.name}</h1>
      <p>A full-stack feature generated by Re-Shell.</p>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

export default App;`;
}

function generateVueMain(context: FeatureContext): string {
  return `import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');`;
}

function generateVueApp(context: FeatureContext): string {
  return `<template>
  <div style="padding: 2rem; font-family: system-ui, sans-serif;">
    <h1>${context.name}</h1>
    <p>A full-stack feature generated by Re-Shell.</p>
    <button @click="count++">
      Count: {{ count }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
</script>`;
}

function generateSvelteMain(context: FeatureContext): string {
  return `import App from './App.svelte';
import './app.css';

new App({
  target: document.getElementById('app')!,
});`;
}

function generateSvelteApp(context: FeatureContext): string {
  return `<script lang="ts">
  let count = 0;
</script>

<div style="padding: 2rem; font-family: system-ui, sans-serif;">
  <h1>${context.name}</h1>
  <p>A full-stack feature generated by Re-Shell.</p>
  <button on:click={() => count += 1}>
    Count: {count}
  </button>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
</style>`;
}

function generateIndexCss(): string {
  return `:root {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  min-height: 100vh;
}

#root, #app {
  width: 100%;
  min-height: 100vh;
}`;
}

function generateCrudModel(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `module.exports = {
  name: '${context.normalizedName}',
  schema: {
    // Add your model fields here
  }
};`;
  }

  return `export interface ${context.pascalName} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  // Add your fields here
}

export interface Create${context.pascalName}Input {
  // Add your create fields here
}

export interface Update${context.pascalName}Input {
  // Add your update fields here
}

export class ${context.pascalName}Model {
  async findAll(): Promise<${context.pascalName}[]> {
    // Implement find all logic
    return [];
  }

  async findById(id: string): Promise<${context.pascalName} | null> {
    // Implement find by id logic
    return null;
  }

  async create(input: Create${context.pascalName}Input): Promise<${context.pascalName}> {
    // Implement create logic
    return {} as ${context.pascalName};
  }

  async update(id: string, input: Update${context.pascalName}Input): Promise<${context.pascalName} | null> {
    // Implement update logic
    return null;
  }

  async delete(id: string): Promise<boolean> {
    // Implement delete logic
    return true;
  }
}

export const ${context.camelName}Model = new ${context.pascalName}Model();`;
}

function generateCrudService(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const { ${context.pascalName}Model } = require('../models/${context.normalizedName}.model');

class ${context.pascalName}Service {
  async findAll() {
    return await ${context.pascalName}Model.findAll();
  }

  async findById(id) {
    return await ${context.pascalName}Model.findById(id);
  }

  async create(input) {
    return await ${context.pascalName}Model.create(input);
  }

  async update(id, input) {
    return await ${context.pascalName}Model.update(id, input);
  }

  async delete(id) {
    return await ${context.pascalName}Model.delete(id);
  }
}

module.exports = new ${context.pascalName}Service();`;
  }

  return `import { ${context.camelName}Model } from '../models/${context.normalizedName}.model';
import type { ${context.pascalName}, Create${context.pascalName}Input, Update${context.pascalName}Input } from '../models/${context.normalizedName}.model';

export class ${context.pascalName}Service {
  async findAll(): Promise<${context.pascalName}[]> {
    return await ${context.camelName}Model.findAll();
  }

  async findById(id: string): Promise<${context.pascalName} | null> {
    return await ${context.camelName}Model.findById(id);
  }

  async create(input: Create${context.pascalName}Input): Promise<${context.pascalName}> {
    return await ${context.camelName}Model.create(input);
  }

  async update(id: string, input: Update${context.pascalName}Input): Promise<${context.pascalName} | null> {
    return await ${context.camelName}Model.update(id, input);
  }

  async delete(id: string): Promise<boolean> {
    return await ${context.camelName}Model.delete(id);
  }
}

export const ${context.camelName}Service = new ${context.pascalName}Service();`;
}

function generateCrudController(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const ${context.pascalName}Service = require('../services/${context.normalizedName}.service');

class ${context.pascalName}Controller {
  async findAll(req, res) {
    try {
      const items = await ${context.pascalName}Service.findAll();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async findById(req, res) {
    try {
      const { id } = req.params;
      const item = await ${context.pascalName}Service.findById(id);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const item = await ${context.pascalName}Service.create(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const item = await ${context.pascalName}Service.update(id, req.body);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      await ${context.pascalName}Service.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ${context.pascalName}Controller();`;
  }

  return `import { ${context.camelName}Service } from '../services/${context.normalizedName}.service';
import type { Request, Response, NextFunction } from 'express';

export class ${context.pascalName}Controller {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await ${context.camelName}Service.findAll();
      res.json(items);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await ${context.camelName}Service.findById(id);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ${context.camelName}Service.create(req.body);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await ${context.camelName}Service.update(id, req.body);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await ${context.camelName}Service.delete(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const ${context.camelName}Controller = new ${context.pascalName}Controller();`;
}

function generateCrudRoutes(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const express = require('express');
const ${context.pascalName}Controller = require('../controllers/${context.normalizedName}.controller');

const router = express.Router();

router.get('/', ${context.pascalName}Controller.findAll.bind(${context.pascalName}Controller));
router.get('/:id', ${context.pascalName}Controller.findById.bind(${context.pascalName}Controller));
router.post('/', ${context.pascalName}Controller.create.bind(${context.pascalName}Controller));
router.put('/:id', ${context.pascalName}Controller.update.bind(${context.pascalName}Controller));
router.delete('/:id', ${context.pascalName}Controller.delete.bind(${context.pascalName}Controller));

module.exports = router;`;
  }

  return `import { Router } from 'express';
import { ${context.camelName}Controller } from '../controllers/${context.normalizedName}.controller';

const router = Router();

router.get('/', ${context.camelName}Controller.findAll.bind(${context.camelName}Controller));
router.get('/:id', ${context.camelName}Controller.findById.bind(${context.camelName}Controller));
router.post('/', ${context.camelName}Controller.create.bind(${context.camelName}Controller));
router.put('/:id', ${context.camelName}Controller.update.bind(${context.camelName}Controller));
router.delete('/:id', ${context.camelName}Controller.delete.bind(${context.camelName}Controller));

export default router;`;
}

function generateAuthController(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const authService = require('../services/auth.service');

class AuthController {
  async register(req, res) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  async logout(req, res) {
    try {
      await authService.logout(req.user);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async me(req, res) {
    try {
      res.json(req.user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AuthController();`;
  }

  return `import { authService } from '../services/auth.service';
import type { Request, Response, NextFunction } from 'express';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.user);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response) {
    res.json(req.user);
  }
}

export const authController = new AuthController();`;
}

function generateAuthService(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const jwt = require('jsonwebtoken');

class AuthService {
  async register(input) {
    // Implement registration logic
    const user = { id: Date.now().toString(), ...input };
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret');
    return { token, user };
  }

  async login(input) {
    // Implement login logic
    const user = { id: '1', email: input.email };
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret');
    return { token, user };
  }

  async logout(user) {
    // Implement logout logic (e.g., clear token from blacklist)
    return true;
  }

  async verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret');
  }
}

module.exports = new AuthService();`;
  }

  return `import jwt from 'jsonwebtoken';

interface User {
  id: string;
  email: string;
}

interface AuthPayload {
  token: string;
  user: User;
}

export class AuthService {
  async register(input: any): Promise<AuthPayload> {
    // Implement registration logic
    const user: User = { id: Date.now().toString(), email: input.email };
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret');
    return { token, user };
  }

  async login(input: any): Promise<AuthPayload> {
    // Implement login logic
    const user: User = { id: '1', email: input.email };
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret');
    return { token, user };
  }

  async logout(user: User): Promise<boolean> {
    // Implement logout logic
    return true;
  }

  async verifyToken(token: string): Promise<any> {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret');
  }
}

export const authService = new AuthService();`;
}

function generateAuthRoutes(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const express = require('express');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.get('/me', authMiddleware, authController.me.bind(authController));

module.exports = router;`;
  }

  return `import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.get('/me', authMiddleware, authController.me.bind(authController));

export default router;`;
}

function generateAuthMiddleware(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const authService = require('../services/auth.service');

async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const payload = await authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;`;
  }

  return `import { authService } from '../services/auth.service';
import type { Request, Response, NextFunction } from 'express';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const payload = await authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}`;
}

function generateUploadController(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const multer = require('multer');
const uploadConfig = require('../../config/multer.config');

const upload = multer(uploadConfig);

class UploadController {
  uploadSingle = upload.single('file');

  async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      res.json({
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        url: '/uploads/' + req.file.filename
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  uploadMultiple = upload.array('files', 10);

  async uploadFiles(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      res.json({
        files: req.files.map(f => ({
          filename: f.filename,
          originalname: f.originalname,
          size: f.size,
          url: '/uploads/' + f.filename
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new UploadController();`;
  }

  return `import multer from 'multer';
import { uploadConfig } from '../../config/multer.config';
import type { Request, Response, NextFunction } from 'express';

const upload = multer(uploadConfig);

export class UploadController {
  uploadSingle = upload.single('file');

  async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      res.json({
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        url: '/uploads/' + req.file.filename
      });
    } catch (error) {
      next(error);
    }
  }

  uploadMultiple = upload.array('files', 10);

  async uploadFiles(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }
      res.json({
        files: (req.files as Express.Multer.File[]).map(f => ({
          filename: f.filename,
          originalname: f.originalname,
          size: f.size,
          url: '/uploads/' + f.filename
        }))
      });
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();`;
}

function generateUploadRoutes(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const express = require('express');
const uploadController = require('../controllers/upload.controller');

const router = express.Router();

router.post('/single', uploadController.uploadSingle.bind(uploadController), uploadController.uploadFile.bind(uploadController));
router.post('/multiple', uploadController.uploadMultiple.bind(uploadController), uploadController.uploadFiles.bind(uploadController));

module.exports = router;`;
  }

  return `import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';

const router = Router();

router.post('/single', uploadController.uploadSingle, uploadController.uploadFile.bind(uploadController));
router.post('/multiple', uploadController.uploadMultiple, uploadController.uploadFiles.bind(uploadController));

export default router;`;
}

function generateMulterConfig(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

module.exports = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
};`;
  }

  return `import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const uploadConfig = {
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
};`;
}

function generateWebSocketServer(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const { WebSocketServer } = require('ws');
const { handleConnection } = require('./handlers');

function createWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    handleConnection(ws, wss);
  });

  console.log('WebSocket server initialized');
  return wss;
}

module.exports = { createWebSocketServer };`;
  }

  return `import { WebSocketServer, WebSocket } from 'ws';
import { handleConnection } from './handlers';

export interface WebSocketServerExt extends WebSocketServer {
  clients: Set<WebSocket>;
}

export function createWebSocketServer(server: any): WebSocketServerExt {
  const wss = new WebSocketServer({ server }) as WebSocketServerExt;
  wss.clients = new Set();

  wss.on('connection', (ws: WebSocket) => {
    handleConnection(ws, wss);
  });

  console.log('WebSocket server initialized');
  return wss;
}`;
}

function generateWebSocketHandlers(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `function handleConnection(ws, wss) {
  console.log('New client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());

    // Broadcast to all clients
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === 1) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to ${context.name}' }));
}

module.exports = { handleConnection };`;
  }

  return `import type { WebSocket } from 'ws';
import type { WebSocketServerExt } from './server';

export function handleConnection(ws: WebSocket, wss: WebSocketServerExt) {
  console.log('New client connected');

  ws.on('message', (message: Buffer) => {
    console.log('Received:', message.toString());

    // Broadcast to all clients
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === 1) {
        client.send(message.toString());
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to ${context.name}' }));
}`;
}

function generateGraphQLSchema(context: FeatureContext, hasTypeScript: boolean): string {
  return `# GraphQL Schema for ${context.name}

type ${context.pascalName} {
  id: ID!
  createdAt: String!
  updatedAt: String!
}

type Query {
  ${context.camelName}(id: ID!): ${context.pascalName}
  ${context.camelName}s: [${context.pascalName}]!
}

type Mutation {
  create${context.pascalName}(input: Create${context.pascalName}Input!): ${context.pascalName}!
  update${context.pascalName}(id: ID!, input: Update${context.pascalName}Input!): ${context.pascalName}!
  delete${context.pascalName}(id: ID!): Boolean!
}

input Create${context.pascalName}Input {
  # Add your input fields
}

input Update${context.pascalName}Input {
  # Add your update fields
}`;
}

function generateGraphQLResolvers(context: FeatureContext, hasTypeScript: boolean): string {
  if (!hasTypeScript) {
    return `const ${context.pascalName}Service = require('../services/${context.normalizedName}.service');

const resolvers = {
  Query: {
    ${context.camelName}: async (_parent, args) => {
      return await ${context.pascalName}Service.findById(args.id);
    },
    ${context.camelName}s: async () => {
      return await ${context.pascalName}Service.findAll();
    }
  },
  Mutation: {
    create${context.pascalName}: async (_parent, args) => {
      return await ${context.pascalName}Service.create(args.input);
    },
    update${context.pascalName}: async (_parent, args) => {
      return await ${context.pascalName}Service.update(args.id, args.input);
    },
    delete${context.pascalName}: async (_parent, args) => {
      return await ${context.pascalName}Service.delete(args.id);
    }
  }
};

module.exports = resolvers;`;
  }

  return `import { ${context.camelName}Service } from '../services/${context.normalizedName}.service';
import type ${context.pascalName} from '../models/${context.normalizedName}.model';

interface Create${context.pascalName}Input {
  // Add fields
}

interface Update${context.pascalName}Input {
  // Add fields
}

interface Context {
  user?: any;
}

const resolvers = {
  Query: {
    ${context.camelName}: async (_parent: any, args: { id: string }): Promise<${context.pascalName} | null> => {
      return await ${context.camelName}Service.findById(args.id);
    },
    ${context.camelName}s: async (): Promise<${context.pascalName}[]> => {
      return await ${context.camelName}Service.findAll();
    }
  },
  Mutation: {
    create${context.pascalName}: async (_parent: any, args: { input: Create${context.pascalName}Input }): Promise<${context.pascalName}> => {
      return await ${context.camelName}Service.create(args.input);
    },
    update${context.pascalName}: async (_parent: any, args: { id: string; input: Update${context.pascalName}Input }): Promise<${context.pascalName} | null> => {
      return await ${context.camelName}Service.update(args.id, args.input);
    },
    delete${context.pascalName}: async (_parent: any, args: { id: string }): Promise<boolean> => {
      return await ${context.camelName}Service.delete(args.id);
    }
  }
};

export default resolvers;`;
}

function generateReactCrudComponent(context: FeatureContext): string {
  return `import React, { useEffect, useState } from 'react';
import { use${context.pascalName} } from './use${context.pascalName}';
import type { ${context.pascalName} } from './${context.pascalName}.types';

export function ${context.pascalName}() {
  const { items, loading, error, fetchItems, createItem, updateItem, deleteItem } = use${context.pascalName}();
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<${context.pascalName}> | null>(null);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem?.id) {
      await updateItem(editingItem.id, editingItem);
    } else {
      await createItem(editingItem);
    }
    setIsEditing(false);
    setEditingItem(null);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>${context.name}</h1>
      <button onClick={() => setIsEditing(true)}>Add New</button>

      {isEditing && (
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <input
            placeholder="Name"
            value={editingItem?.toString() || ''}
            onChange={(e) => setEditingItem({ ...editingItem })}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
        </form>
      )}

      <ul style={{ marginTop: '1rem' }}>
        {items.map((item) => (
          <li key={item.id}>
            {item.id}
            <button onClick={() => { setEditingItem(item); setIsEditing(true); }}>Edit</button>
            <button onClick={() => deleteItem(item.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}`;
}

function generateReactCrudHook(context: FeatureContext): string {
  return `import { useState, useEffect, useCallback } from 'react';
import type { ${context.pascalName}, Create${context.pascalName}Input, Update${context.pascalName}Input } from './${context.pascalName}.types';

const API_BASE = '/api/${context.normalizedName}';

export function use${context.pascalName}() {
  const [items, setItems] = useState<${context.pascalName}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (input: Create${context.pascalName}Input) => {
    setLoading(true);
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to create');
      const data = await response.json();
      setItems(prev => [...prev, data]);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateItem = useCallback(async (id: string, input: Update${context.pascalName}Input) => {
    setLoading(true);
    try {
      const response = await fetch(\`\${API_BASE}/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to update');
      const data = await response.json();
      setItems(prev => prev.map(item => item.id === id ? data : item));
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(\`\${API_BASE}/\${id}\`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      setItems(prev => prev.filter(item => item.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, error, fetchItems, createItem, updateItem, deleteItem };
}`;
}

function generateReactCrudTypes(context: FeatureContext): string {
  return `export interface ${context.pascalName} {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Create${context.pascalName}Input {
  // Add your create input fields
}

export interface Update${context.pascalName}Input {
  // Add your update input fields
}`;
}

function generateVueCrudComponent(context: FeatureContext): string {
  return `<template>
  <div style="padding: 2rem">
    <h1>${context.name}</h1>
    <button @click="showForm = true">Add New</button>

    <form v-if="showForm" @submit.prevent="handleSubmit" style="margin-top: 1rem">
      <input v-model="formData.name" placeholder="Name" />
      <button type="submit">Save</button>
      <button type="button" @click="showForm = false">Cancel</button>
    </form>

    <ul style="margin-top: 1rem">
      <li v-for="item in items" :key="item.id">
        {{ item.id }}
        <button @click="editItem(item)">Edit</button>
        <button @click="deleteItem(item.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { use${context.pascalName} } from './use${context.pascalName}';

const { items, loading, error, fetchItems, createItem, updateItem, deleteItem } = use${context.pascalName}();
const showForm = ref(false);
const formData = ref({});

onMounted(() => {
  fetchItems();
});

const handleSubmit = async () => {
  if (formData.value.id) {
    await updateItem(formData.value.id, formData.value);
  } else {
    await createItem(formData.value);
  }
  showForm.value = false;
  formData.value = {};
};

const editItem = (item: any) => {
  formData.value = { ...item };
  showForm.value = true;
};
</script>`;
}

function generateVueCrudComposable(context: FeatureContext): string {
  return `import { ref, useCallback } from 'vue';

const API_BASE = '/api/${context.normalizedName}';

export function use${context.pascalName}() {
  const items = ref([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchItems = async () => {
    loading.value = true;
    try {
      const response = await fetch(API_BASE);
      if (!response.ok) throw new Error('Failed to fetch');
      items.value = await response.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading.value = false;
    }
  };

  const createItem = async (input: any) => {
    loading.value = true;
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to create');
      const data = await response.json();
      items.value.push(data);
      return data;
    } finally {
      loading.value = false;
    }
  };

  const updateItem = async (id: string, input: any) => {
    loading.value = true;
    try {
      const response = await fetch(\`\${API_BASE}/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to update');
      const data = await response.json();
      const index = items.value.findIndex((item: any) => item.id === id);
      if (index !== -1) items.value[index] = data;
      return data;
    } finally {
      loading.value = false;
    }
  };

  const deleteItem = async (id: string) => {
    loading.value = true;
    try {
      const response = await fetch(\`\${API_BASE}/\${id}\`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      items.value = items.value.filter((item: any) => item.id !== id);
    } finally {
      loading.value = false;
    }
  };

  return { items, loading, error, fetchItems, createItem, updateItem, deleteItem };
}`;
}

function generateSvelteCrudComponent(context: FeatureContext): string {
  return `<script lang="ts">
  import { onMount } from 'svelte';
  import { use${context.pascalName} } from './use${context.pascalName}';

  const { items, loading, error, fetchItems, createItem, updateItem, deleteItem } = use${context.pascalName}();
  let showForm = false;
  let formData = {};

  onMount(() => {
    fetchItems();
  });

  const handleSubmit = async () => {
    if (formData.id) {
      await updateItem(formData.id, formData);
    } else {
      await createItem(formData);
    }
    showForm = false;
    formData = {};
  };

  const editItem = (item) => {
    formData = { ...item };
    showForm = true;
  };
</script>

<div style="padding: 2rem">
  <h1>${context.name}</h1>
  <button on:click={() => showForm = true}>Add New</button>

  {#if showForm}
    <form on:submit={handleSubmit} style="margin-top: 1rem">
      <input bind:value={formData} placeholder="Name" />
      <button type="submit">Save</button>
      <button type="button" on:click={() => showForm = false}>Cancel</button>
    </form>
  {/if}

  <ul style="margin-top: 1rem">
    {#each items as item (item.id)}
      <li>
        {item.id}
        <button on:click={() => editItem(item)}>Edit</button>
        <button on:click={() => deleteItem(item.id)}>Delete</button>
      </li>
    {/each}
  </ul>
</div>`;
}

function generateReactLoginComponent(context: FeatureContext): string {
  return `import React, { useState } from 'react';
import { useAuth } from './useAuth';

export function Login() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email, password });
  };

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '2rem', border: '1px solid #ccc' }}>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Login'}
        </button>
      </form>
    </div>
  );
}`;
}

function generateReactAuthHook(context: FeatureContext): string {
  return `import { useState, useCallback } from 'react';

const API_BASE = '/api/auth';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState(null);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(\`\${API_BASE}/login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) throw new Error('Login failed');
      const data = await response.json();
      setUser(data.user);
      localStorage.setItem('token', data.token);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(\`\${API_BASE}/logout\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${localStorage.getItem('token')}\`,
        },
      });
    } finally {
      setUser(null);
      localStorage.removeItem('token');
    }
  }, []);

  return { user, loading, error, login, logout };
}`;
}

function generateRootPackageJson(context: FeatureContext): string {
  return `{
  "name": "${context.normalizedName}",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \\"pnpm --filter web dev\\" \\"pnpm --filter api dev\\"",
    "build": "pnpm --filter web build && pnpm --filter api build",
    "start": "concurrently \\"pnpm --filter web start\\" \\"pnpm --filter api start\\"",
    "lint": "pnpm --filter web lint && pnpm --filter api lint"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}`;
}

function generateFeatureReadme(context: FeatureContext): string {
  return `# ${context.name}

A full-stack feature generated by Re-Shell.

## Overview

This feature includes both frontend and backend components for a complete ${context.type} implementation.

## Structure

\`\`\`
${context.normalizedName}/
├── api/          # Backend API (Node.js/Express)
├── web/          # Frontend application (React)
├── package.json  # Root package.json for monorepo management
└── docker-compose.yml
\`\`\`

## Quick Start

### Development

\`\`\`bash
# Install dependencies
pnpm install

# Start both frontend and backend
pnpm dev

# Or start individually
cd api && pnpm dev    # Backend on port ${context.port || '3000'}
cd web && pnpm dev    # Frontend on port ${parseInt(context.port || '3000') + 1000}
\`\`\`

### Docker

\`\`\`bash
docker-compose up
\`\`\`

## API Endpoints

### ${context.pascalName} CRUD

- \`GET /api/${context.normalizedName}\` - List all items
- \`GET /api/${context.normalizedName}/:id\` - Get item by ID
- \`POST /api/${context.normalizedName}\` - Create new item
- \`PUT /api/${context.normalizedName}/:id\` - Update item
- \`DELETE /api/${context.normalizedName}/:id\` - Delete item

## Features

- Type-safe TypeScript (both frontend and backend)
- RESTful API design
- React with hooks
- Vite for fast development
- Hot module replacement
- Docker support
`;
}

function generateDockerCompose(context: FeatureContext): string {
  return `version: '3.8'

services:
  api:
    build: ./api
    ports:
      - "${context.port || '3000'}:3000"
    environment:
      - NODE_ENV=development
      - PORT=${context.port || '3000'}
    volumes:
      - ./api:/app
      - /app/node_modules

  web:
    build: ./web
    ports:
      - "${parseInt(context.port || '3000') + 1000}:5173"
    environment:
      - VITE_API_URL=http://localhost:${context.port || '3000'}
    volumes:
      - ./web:/app
      - /app/node_modules
    depends_on:
      - api
`;
}

function generateEnvExample(context: FeatureContext): string {
  return `# Backend
NODE_ENV=development
PORT=${context.port || '3000'}

# JWT
JWT_SECRET=your-secret-key-here

# Database (if configured)
DATABASE_URL=

# Frontend
VITE_API_URL=http://localhost:${context.port || '3000'}
`;
}

export function getFeatureTypeChoices(): Array<{ title: string; value: string; description: string }> {
  return [
    { title: 'CRUD API', value: 'crud', description: 'Create, Read, Update, Delete operations' },
    { title: 'Authentication', value: 'auth', description: 'Login, registration, JWT tokens' },
    { title: 'File Upload', value: 'file-upload', description: 'Single and multiple file uploads' },
    { title: 'WebSocket', value: 'websocket', description: 'Real-time bidirectional communication' },
    { title: 'GraphQL', value: 'graphql', description: 'GraphQL API with resolvers' },
    { title: 'Full Stack', value: 'fullstack', description: 'Complete frontend + backend' },
  ];
}

export function getBackendFrameworkChoices(): Array<{ title: string; value: string; description: string }> {
  return listBackendTemplates().map(t => ({
    title: t.displayName,
    value: t.id,
    description: t.description,
  }));
}

export function getFrontendFrameworkChoices(): Array<{ title: string; value: string; description: string }> {
  return [
    { title: 'React', value: 'react', description: 'React with TypeScript and Vite' },
    { title: 'Vue', value: 'vue', description: 'Vue 3 with TypeScript and Vite' },
    { title: 'Svelte', value: 'svelte', description: 'Svelte with TypeScript and Vite' },
    { title: 'Angular', value: 'angular', description: 'Angular with CLI' },
    { title: 'Vanilla', value: 'vanilla', description: 'Vanilla JavaScript with Vite' },
  ];
}

export function getDatabaseChoices(): Array<{ title: string; value: string; description: string }> {
  return [
    { title: 'None', value: 'none', description: 'No database' },
    { title: 'Prisma', value: 'prisma', description: 'TypeScript ORM with SQLite/PostgreSQL' },
    { title: 'TypeORM', value: 'typeorm', description: 'TypeScript ORM for SQL databases' },
    { title: 'Mongoose', value: 'mongoose', description: 'MongoDB ODM' },
    { title: 'Sequelize', value: 'sequelize', description: 'Node.js ORM for SQL databases' },
  ];
}
