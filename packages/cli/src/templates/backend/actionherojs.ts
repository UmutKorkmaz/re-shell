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
  features: ['websockets', 'authentication', 'database', 'rest-api', 'queue', 'logging', 'testing', 'docker', 'graphql'],

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
    "actionhero": "^29.0.0",
    "@apollo/server": "^4.10.0",
    "graphql": "^16.8.1"
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
`,

    'src/graphql/schema.ts': `export const typeDefs = \`#graphql
type Query {
  hello: String!
  health: String!
}
\`;
`,

    'src/graphql/resolvers.ts': `export const resolvers = {
  Query: {
    hello: () => 'Hello from ActionHero GraphQL!',
    health: () => 'healthy'
  }
};
`,

    'initializers/graphql.ts': `import { ApolloServer } from '@apollo/server';
import { typeDefs } from '../src/graphql/schema';
import { resolvers } from '../src/graphql/resolvers';

export const DEFAULT = {
  graphql: () => {
    const server = new ApolloServer({ typeDefs, resolvers });

    return {
      enabled: true,
      server,
      async handle(request: any, response: any) {
        try {
          const body = await new Promise((resolve) => {
            let data = '';
            request.on('data', (chunk: string) => { data += chunk; });
            request.on('end', () => resolve(JSON.parse(data || '{}')));
          });

          const result = await server.executeOperation(body);
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify(result));
        } catch (error) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ errors: [{ message: (error as Error).message }] }));
        }
      }
    };
  }
};
`
  },

  postInstall: [
    `echo "Setting up ActionHero backend..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
