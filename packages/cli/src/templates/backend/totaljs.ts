import { BackendTemplate } from '../types';

export const totaljsTemplate: BackendTemplate = {
  id: 'totaljs',
  name: 'Total.js',
  displayName: 'Total.js',
  description: 'Modern Node.js framework for MVC applications with embedded CMS, routing, and middleware',
  framework: 'totaljs',
  version: '3.0.0',
  language: 'javascript',
  tags: ['nodejs', 'totaljs', 'mvc', 'rest', 'cms'],
  port: 8000,
  dependencies: {},
  features: ['rest-api', 'middleware', 'routing', 'authentication', 'database', 'websockets', 'docker', 'graphql'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Total.js application",
  "scripts": {
    "start": "node index.js",
    "dev": "node debug.js"
  },
  "dependencies": {
    "total.js": "^3.0.0",
    "graphql-yoga": "^5.10.0"
  }
}`,

    'index.js': `const total = require('total.js');
const { createYoga } = require('graphql-yoga');
const { schema } = require('./src/graphql/schema');
const { resolvers } = require('./src/graphql/resolver');

// Build the GraphQL Yoga instance mounted at /graphql
const yoga = createYoga({
  schema,
  resolvers,
  graphqlEndpoint: '/graphql',
  logging: 'warn'
});

total.http('release', {
  port: 8000
});

// Wire the GraphQL endpoint into Total.js routing.
// F.route registers a handler executed on every matching request.
total.route('/graphql', function() {
  yoga(this.req, this.res);
});

// Total.js exposes the controller/request via the global F namespace once
// the HTTP server boots. The handler above runs the Yoga request pipeline.
console.log('Server running on http://localhost:8000');
console.log('GraphQL endpoint: http://localhost:8000/graphql');
`,

    'src/graphql/schema.js': `const { buildSchema } = require('graphql');

// Minimal GraphQL schema: a hello world query plus a health check query.
const source = \`
  type Query {
    hello: String
    health: String
  }
\`;

const schema = buildSchema(source);

module.exports = { schema, source };
`,

    'src/graphql/resolver.js': `// Resolvers for the GraphQL schema.
// hello: simple greeting, health: service health check.
const resolvers = {
  hello: () => 'Hello from Total.js + GraphQL Yoga!',
  health: () => 'ok'
};

module.exports = { resolvers };
`,

    'README.md': `# Total.js Application

\`\`\`bash
npm install
npm start
\`\`\`

Available at http://localhost:8000
`
  },

  postInstall: [
    `echo "Setting up Total.js..."
echo "1. Run: npm install"
echo "2. Start: npm start"`
  ]
};
