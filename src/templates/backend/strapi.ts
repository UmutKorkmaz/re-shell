import { BackendTemplate } from '../types';

export const strapiTemplate: BackendTemplate = {
  id: 'strapi',
  name: 'Strapi Headless CMS',
  displayName: 'Strapi',
  description: 'Flexible, open-source headless CMS with admin panel, Content-Type Builder, and REST/GraphQL APIs',
  framework: 'strapi',
  version: '4.24.0',
  language: 'javascript',
  tags: ['javascript', 'strapi', 'cms', 'headless', 'graphql', 'rest'],
  port: 1337,
  dependencies: {},
  features: ['graphql', 'rest-api', 'authentication', 'database', 'file-upload', 'docker'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "Strapi Headless CMS",
  "scripts": {
    "develop": "strapi develop",
    "start": "strapi start",
    "build": "strapi build",
    "strapi": "strapi"
  },
  "dependencies": {
    "@strapi/plugin-cloud": "4.24.0",
    "@strapi/plugin-i18n": "4.24.0",
    "@strapi/plugin-users-permissions": "4.24.0",
    "@strapi/strapi": "4.24.0",
    "better-sqlite3": "9.4.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "styled-components": "^6.1.8"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}`,

    'README.md': `# Strapi Headless CMS

\`\`\`bash
npm install
npm run develop
\`\`\`

Available at http://localhost:1337
`
  },

  postInstall: [
    `echo "Setting up Strapi CMS..."
echo "1. Run: npm install"
echo "2. Start: npm run develop"`
  ]
};
