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
  features: ['rest-api', 'middleware', 'routing', 'authentication', 'database', 'websockets', 'docker'],

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
    "think-model-mysql": "^1.0.0"
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
`
  },

  postInstall: [
    `echo "Setting up ThinkJS..."
echo "1. Run: npm install"
echo "2. Start: npm run dev"`
  ]
};
