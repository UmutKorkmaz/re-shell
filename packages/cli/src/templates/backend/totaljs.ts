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
  features: ['rest-api', 'middleware', 'routing', 'authentication', 'database', 'websockets', 'docker'],

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
    "total.js": "^3.0.0"
  }
}`,

    'index.js': `const total = require('total.js');

total.http('release', {
  port: 8000
});

console.log('Server running on http://localhost:8000');
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
