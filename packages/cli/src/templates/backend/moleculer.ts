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
    "build": "tsc",
    "dev": "ts-node ./node_modules/moleculer/bin/moleculer-runner.js --hot --repl --config moleculer.config.ts services/**/*.service.ts",
    "start": "moleculer-runner --config dist/moleculer.config.js dist/services/**/*.service.js",
    "typecheck": "tsc --noEmit",
    "cli": "moleculer connect NATS"
  },
  "dependencies": {
    "graphql": "^16.8.1",
    "moleculer": "^0.14.35",
    "moleculer-web": "^0.10.8",
    "nats": "^2.28.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "moleculer-repl": "^0.7.4",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  },
  "engines": {
    "node": ">= 18.x.x"
  }
}
`,

    'moleculer.config.ts': `import type { BrokerOptions } from 'moleculer';

/**
 * Moleculer ServiceBroker configuration.
 * Docs: https://moleculer.services/docs/0.14/configuration.html
 */
const brokerConfig: BrokerOptions = {
  namespace: '{{projectName}}',
  logger: true,
  logLevel: 'info',

  // Set TRANSPORTER (for example nats://localhost:4222) to run several nodes;
  // without it the broker runs standalone in a single process.
  transporter: process.env.TRANSPORTER || undefined,

  // Retry failed calls
  retryPolicy: {
    enabled: true,
    retries: 3,
    delay: 100,
    maxDelay: 1000,
    factor: 2
  },

  // Protect services from cascading failures
  circuitBreaker: {
    enabled: true,
    threshold: 0.5,
    minRequestCount: 20,
    windowTime: 60,
    halfOpenTime: 10 * 1000
  },

  metrics: {
    enabled: true,
    reporter: [{ type: 'Console', options: { interval: 60 } }]
  },

  tracing: {
    enabled: false
  }
};

export default brokerConfig;
`,

    'README.md': `# Moleculer Application

TypeScript Moleculer app with an HTTP gateway (\`moleculer-web\`), a REST-exposed \`greeter\`
service and a GraphQL endpoint backed by graphql-js.

\`\`\`bash
npm install
npm run dev     # ts-node, hot reload, REPL
npm run build && npm start
\`\`\`

Available at http://localhost:3000

| Endpoint | Description |
| --- | --- |
| \`GET /api/greeter/hello?name=Ada\` | \`greeter.hello\` action |
| \`GET /api/greeter/health\` | \`greeter.health\` action |
| \`POST /graphql\` | \`{"query": "{ hello(name: \\"Ada\\") health }"}\` |

Set \`TRANSPORTER=nats://localhost:4222\` to run several nodes against a NATS server;
without it the broker runs standalone.
`,

    'services/graphql.service.ts': `import type { Context, ServiceSchema } from 'moleculer';
import { buildSchema, graphql } from 'graphql';

interface QueryParams {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

const schema = buildSchema(\`
  type Query {
    hello(name: String): String!
    health: String!
  }
\`);

/**
 * GraphQL over Moleculer: the \`query\` action executes a document with graphql-js,
 * and every field resolves by calling other services through the broker.
 * The gateway exposes it as POST /graphql.
 */
const GraphqlService: ServiceSchema = {
  name: 'graphql',

  actions: {
    query: {
      params: {
        query: { type: 'string' },
        variables: { type: 'object', optional: true },
        operationName: { type: 'string', optional: true }
      },
      handler(ctx: Context<QueryParams>) {
        return graphql({
          schema,
          source: ctx.params.query,
          variableValues: ctx.params.variables,
          operationName: ctx.params.operationName,
          rootValue: {
            hello: ({ name }: { name?: string }) => ctx.call('greeter.hello', { name }),
            health: async () => {
              const health = (await ctx.call('greeter.health', {})) as { status: string };
              return health.status;
            }
          }
        });
      }
    }
  }
};

export default GraphqlService;
`,

    'services/api.service.ts': `import type { ServiceSchema } from 'moleculer';
import ApiGateway from 'moleculer-web';

/**
 * HTTP gateway: REST routes for every service action marked with \`rest\`
 * (/api/greeter/...) and the GraphQL endpoint (POST /graphql).
 */
const ApiService: ServiceSchema = {
  name: 'api',

  mixins: [ApiGateway],

  settings: {
    port: Number(process.env.PORT) || 3000,

    routes: [
      {
        path: '/api',
        whitelist: ['greeter.*'],
        autoAliases: true,
        bodyParsers: {
          json: true
        }
      },
      {
        path: '/graphql',
        whitelist: ['graphql.query'],
        cors: true,
        aliases: {
          'POST /': 'graphql.query'
        },
        bodyParsers: {
          json: true
        },
        mappingPolicy: 'restrict'
      }
    ]
  }
};

export default ApiService;
`,

    'services/greeter.service.ts': `import type { Context, ServiceSchema } from 'moleculer';

interface HelloParams {
  name?: string;
}

const GreeterService: ServiceSchema = {
  name: 'greeter',

  actions: {
    /** GET /api/greeter/hello?name=... */
    hello: {
      rest: 'GET /hello',
      params: {
        name: { type: 'string', optional: true }
      },
      handler(ctx: Context<HelloParams>) {
        return \`Hello \${ctx.params.name ?? 'Moleculer'}!\`;
      }
    },

    /** GET /api/greeter/health */
    health: {
      rest: 'GET /health',
      handler() {
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        };
      }
    }
  }
};

export default GreeterService;
`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "sourceMap": true
  },
  "include": ["moleculer.config.ts", "services/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
`
  },

  postInstall: [
    `echo "Setting up Moleculer..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
