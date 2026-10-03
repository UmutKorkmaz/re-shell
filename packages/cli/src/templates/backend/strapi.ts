import { BackendTemplate } from '../types';

export const strapiTemplate: BackendTemplate = {
  id: 'strapi',
  name: 'Strapi Headless CMS',
  displayName: 'Strapi',
  description: 'Flexible, open-source headless CMS with admin panel, Content-Type Builder, and a REST API',
  framework: 'strapi',
  version: '4.25.23',
  language: 'javascript',
  tags: ['javascript', 'strapi', 'cms', 'headless', 'rest'],
  port: 1337,
  dependencies: {},
  features: ['rest-api', 'authentication', 'database', 'file-upload'],

  files: {
    'package.json': `{
  "name": "{{projectName}}",
  "private": true,
  "version": "1.0.0",
  "description": "Strapi headless CMS",
  "scripts": {
    "develop": "strapi develop",
    "start": "strapi start",
    "build": "strapi build",
    "strapi": "strapi"
  },
  "dependencies": {
    "@strapi/plugin-cloud": "4.25.23",
    "@strapi/plugin-i18n": "4.25.23",
    "@strapi/plugin-users-permissions": "4.25.23",
    "@strapi/strapi": "4.25.23",
    "better-sqlite3": "9.4.3",
    "pg": "^8.11.5",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-router-dom": "5.3.4",
    "styled-components": "5.3.3"
  },
  "strapi": {
    "uuid": "{{projectName}}"
  },
  "engines": {
    "node": ">=18.0.0 <=20.x.x",
    "npm": ">=6.0.0"
  },
  "license": "MIT"
}
`,

    'README.md': `# Strapi Headless CMS

Strapi 4 with the Users & Permissions, i18n and Cloud plugins, an \`Article\` content type
(\`src/api/article\`) and SQLite by default (PostgreSQL and MySQL via \`DATABASE_CLIENT\`).

\`\`\`bash
cp .env.example .env   # then replace every "toBeModified" / "tobemodified" secret
npm install
npm run develop        # admin panel at http://localhost:1337/admin
\`\`\`

Production:

\`\`\`bash
npm run build          # builds the admin panel
npm run start
\`\`\`

| Endpoint | Description |
| --- | --- |
| \`http://localhost:1337/admin\` | admin panel (create the first administrator on first visit) |
| \`GET /api/articles\` | REST API of the Article content type (grant access under Settings, Roles, Public) |

Node.js 18 or 20 is required (see \`engines\`). \`better-sqlite3\` is a native module: when a package
manager skips install scripts, run its approve/rebuild step once (\`pnpm approve-builds\`).
`,

    '.env.example': `HOST=0.0.0.0
PORT=1337
APP_KEYS="toBeModified1,toBeModified2"
API_TOKEN_SALT=tobemodified
ADMIN_JWT_SECRET=tobemodified
TRANSFER_TOKEN_SALT=tobemodified
JWT_SECRET=tobemodified

# Database: sqlite (default), postgres or mysql
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_NAME=strapi
# DATABASE_USERNAME=strapi
# DATABASE_PASSWORD=strapi
`,

    '.gitignore': `node_modules
.env
.tmp
.cache
build
dist
public/uploads/*
!public/uploads/.gitkeep
`,

    'config/admin.js': `module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
});
`,

    'config/api.js': `module.exports = {
  rest: {
    defaultLimit: 25,
    maxLimit: 100,
    withCount: true,
  },
};
`,

    'config/database.js': `const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  const connections = {
    mysql: {
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false),
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    },
    postgres: {
      connection: {
        host: env('DATABASE_HOST', 'localhost'),
        port: env.int('DATABASE_PORT', 5432),
        database: env('DATABASE_NAME', 'strapi'),
        user: env('DATABASE_USERNAME', 'strapi'),
        password: env('DATABASE_PASSWORD', 'strapi'),
        ssl: env.bool('DATABASE_SSL', false),
        schema: env('DATABASE_SCHEMA', 'public'),
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
    },
    sqlite: {
      connection: {
        filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };

  return {
    connection: {
      client,
      ...connections[client],
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};
`,

    'config/middlewares.js': `module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
`,

    'config/plugins.js': `// Plugin configuration: https://docs.strapi.io/dev-docs/configurations/plugins
module.exports = () => ({});
`,

    'config/server.js': `module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});
`,

    'public/robots.txt': `# To prevent search engines from seeing the site altogether, uncomment the next two lines:
# User-Agent: *
# Disallow: /
`,

    'public/uploads/.gitkeep': ``,

    'src/api/article/content-types/article/schema.json': `{
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article",
    "description": "Blog articles"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "title": {
      "type": "string",
      "required": true
    },
    "slug": {
      "type": "uid",
      "targetField": "title"
    },
    "summary": {
      "type": "text"
    },
    "content": {
      "type": "richtext"
    }
  }
}
`,

    'src/api/article/controllers/article.js': `'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::article.article');
`,

    'src/api/article/routes/article.js': `'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::article.article');
`,

    'src/api/article/services/article.js': `'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::article.article');
`,

    'src/index.js': `'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before the application is initialized.
   * Use it to extend plugins or register custom fields.
   */
  register(/* { strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before the application starts.
   */
  bootstrap(/* { strapi } */) {},
};
`
  },

  postInstall: [
    `echo "Setting up Strapi CMS..."
echo "1. Run: cp .env.example .env (and replace every tobemodified secret)"
echo "2. Run: npm install"
echo "3. Start: npm run develop"`
  ]
};
