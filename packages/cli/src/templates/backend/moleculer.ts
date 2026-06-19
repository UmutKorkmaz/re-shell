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
  features: ['microservices', 'rest-api', 'websockets', 'authentication', 'database', 'caching', 'docker', 'testing', 'graphql'],

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
    "moleculer-apollo-server": "^0.3.1",
    "moleculer-web": "^0.10.0",
    "graphql": "^16.8.1",
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
`,

    'services/graphql.service.ts': `import { Service } from 'moleculer';
import ApiGateway from 'moleculer-apollo-server';

export default {
  name: 'graphql',
  mixins: [ApiGateway],
  settings: {
    path: '/graphql',
    cors: true,
    route: {
      path: '/graphql',
      cors: true,
      aliases: {
        'GET /': 'graphql.graphiql',
        'POST /': 'graphql.api',
        'OPTIONS /': 'graphql.cors'
      },
      bodyParsers: {
        json: true,
        urlencoded: { extended: true }
      }
    },
    schema: \`type Query {
  hello: String!
  health: String!
}
\`,
    resolvers: {
      Query: {
        hello: () => 'Hello from Moleculer GraphQL!',
        health: () => 'healthy'
      }
    }
  }
} as Service;
`,

    'services/api.service.ts': `import { Service } from 'moleculer-web';

export default {
  name: 'api',
  mixins: [],
  settings: {
    port: 3000
  }
} as Service;
`
  },

  postInstall: [
    `echo "Setting up Moleculer..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
