import { BackendTemplate } from '../types';

export const thinkjsTemplate: BackendTemplate = {
  id: 'thinkjs',
  name: 'ThinkJS',
  displayName: 'ThinkJS',
  description: 'Modern Node.js MVC framework with ES6/ES7 support and auto-loading',
  framework: 'thinkjs',
  version: '3.0.0',
  language: 'javascript',
  tags: ['nodejs', 'thinkjs', 'mvc', 'es6', 'rest'],
  port: 8360,
  dependencies: {},
  features: ['rest-api', 'middleware', 'routing', 'authentication', 'database', 'websockets', 'docker', 'graphql'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "ThinkJS application",
  "scripts": {
    "start": "node development.js",
    "dev": "node development.js",
    "compile": "babel src/ --out-dir app/",
    "test": "mocha test/"
  },
  "dependencies": {
    "thinkjs": "^3.0.0",
    "think-model-mysql": "^1.0.0",
    "think-graphql": "^1.0.0",
    "graphql": "^16.8.1"
  },
  "devDependencies": {
    "babel-cli": "^6.26.0",
    "babel-preset-think-node": "^1.0.0"
  }
}`,

    'src/config/adapter.js': `module.exports = {
  type: 'mysql'
};
`,

    'README.md': `# ThinkJS Application

\`\`\`bash
npm install
npm run dev
\`\`\`

Available at http://localhost:8360
`,

    'src/config/graphql.js': `const { buildSchema } = require('graphql');

const schema = buildSchema(\`
  type Query {
    hello: String!
    health: String!
  }
\`);

const rootResolver = {
  hello: () => 'Hello from ThinkJS GraphQL!',
  health: () => 'healthy'
};

module.exports = {
  schema,
  rootResolver
};
`,

    'src/controller/graphql.js': `const think = require('thinkjs');
const { graphql } = require('graphql');
const config = think.config('graphql');

module.exports = class extends think.Controller {
  async indexAction() {
    const ctx = this.ctx;
    let query = '{ hello health }';

    if (this.isPost) {
      const body = this.post();
      query = body.query || query;
    }

    try {
      const result = await graphql({
        schema: config.schema,
        source: query,
        rootValue: config.rootResolver
      });
      this.json(result);
    } catch (err) {
      this.json({ errors: [{ message: err.message }] });
    }
  }
};
`
  },

  postInstall: [
    `echo "Setting up ThinkJS..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
