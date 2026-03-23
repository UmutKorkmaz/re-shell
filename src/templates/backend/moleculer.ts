import { BackendTemplate } from '../types';

export const moleculerTemplate: BackendTemplate = {
  id: 'moleculer',
  name: 'Moleculer',
  displayName: 'Moleculer',
  description: 'Fast & powerful microservices framework with built-in service discovery, load balancing, and fault tolerance',
  framework: 'moleculer',
  version: '0.14.0',
  language: 'typescript',
  tags: ['typescript', 'microservices', 'moleculer', 'nats', 'redis'],
  port: 3000,
  dependencies: {},
  features: ['microservices', 'rest-api', 'websockets', 'authentication', 'database', 'caching', 'docker', 'testing'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Moleculer microservices application",
  "scripts": {
    "dev": "moleculer-runner --repl --hot",
    "start": "moleculer-runner",
    "cli": "moleculer-runner"
  },
  "dependencies": {
    "moleculer": "^0.14.0",
    "nats": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}`,

    'moleculer.config.ts': `module.exports = {
  namespace: '{{projectName}}',
  nodeID: null,
  transporter: 'NATS',
  logger: true
};
`,

    'README.md': `# Moleculer Application

\`\`\`bash
npm install
npm run dev
\`\`\`

Available at http://localhost:3000
`
  },

  postInstall: [
    `echo "Setting up Moleculer..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
