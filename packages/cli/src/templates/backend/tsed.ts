import { BackendTemplate } from '../types';

export const tsedTemplate: BackendTemplate = {
  id: 'tsed',
  name: 'Ts.ED',
  displayName: 'Ts.ED',
  description: 'TypeScript framework built on Express/Koa with decorators, DI, and enterprise features',
  version: '7.0.0',
  language: 'typescript',
  framework: 'tsed',
  tags: ['typescript', 'express', 'decorators', 'di', 'graphql'],
  port: 3000,
  dependencies: {},
  features: ['rest-api', 'microservices', 'swagger', 'graphql', 'websockets', 'authentication', 'database', 'middleware', 'validation', 'testing', 'docker'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Ts.ED TypeScript application",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "@tsed/common": "^7.0.0",
    "@tsed/core": "^7.0.0",
    "@tsed/di": "^7.0.0",
    "@tsed/platform-express": "^7.0.0",
    "@tsed/schema": "^7.0.0",
    "@tsed/swagger": "^7.0.0",
    "express": "^4.18.2",
    "reflect-metadata": "^0.1.13"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.1"
  }
}`,

    'src/index.ts': `import { $log } from '@tsed/common';
import { PlatformExpress } from '@tsed/platform-express';
import { Server } from './Server';

async function bootstrap() {
  try {
    const platform = await PlatformExpress.bootstrap(Server, {});
    await platform.listen();
    $log.info('Server initialized');
  } catch (error) {
    $log.error({ event: 'SERVER_BOOTSTRAP_ERROR', error });
    process.exit(1);
  }
}

bootstrap();
`,

    'README.md': `# Ts.ED Application

\`\`\`bash
npm install
npm run dev
\`\`\`

Available at http://localhost:3000
`
  },

  postInstall: [
    `echo "Setting up Ts.ED..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
