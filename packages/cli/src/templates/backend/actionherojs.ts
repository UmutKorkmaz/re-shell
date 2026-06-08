import { BackendTemplate } from '../types';

export const actionheroTemplate: BackendTemplate = {
  id: 'actionherojs',
  name: 'actionherojs',
  displayName: 'ActionHero',
  description: 'Multi-transport API server with clustering, real-time capabilities, and background jobs',
  version: '29.0.0',
  language: 'typescript',
  framework: 'actionhero',
  tags: ['nodejs', 'actionhero', 'api', 'websocket', 'cluster', 'typescript'],
  port: 8080,
  dependencies: {},
  features: ['websockets', 'authentication', 'database', 'rest-api', 'queue', 'logging', 'testing', 'docker'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "ActionHero multi-transport API server",
  "scripts": {
    "start": "actionhero start",
    "start:cluster": "actionhero start cluster --workers=4",
    "dev": "actionhero start --watch",
    "test": "jest",
    "build": "tsc"
  },
  "dependencies": {
    "actionhero": "^29.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true
  }
}`,

    'config/servers/web.ts': `export const DEFAULT = {
  servers: {
    web: (config: any) => {
      return {
        enabled: true,
        secure: false,
        port: process.env.WEB_PORT || 8080,
        bindIP: '0.0.0.0'
      };
    }
  }
};
`,

    'README.md': `# ActionHero Backend

Multi-transport API server.

\`\`\`bash
npm install
npm run dev
\`\`\`

Available at http://localhost:8080
`
  },

  postInstall: [
    `echo "Setting up ActionHero backend..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
