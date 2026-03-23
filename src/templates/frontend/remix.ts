import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class RemixTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript } = this.context;

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Remix config
    files.push({
      path: 'remix.config.js',
      content: this.generateRemixConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Tailwind config
    files.push({
      path: 'tailwind.config.js',
      content: this.generateTailwindConfig()
    });

    // PostCSS config
    files.push({
      path: 'postcss.config.js',
      content: this.generatePostcssConfig()
    });

    // Root route
    files.push({
      path: 'app/root.tsx',
      content: this.generateRootRoute()
    });

    // Home route
    files.push({
      path: 'app/routes/home.tsx',
      content: this.generateHomeRoute()
    });

    // Index route
    files.push({
      path: 'app/routes/_index.tsx',
      content: this.generateIndexRoute()
    });

    // API routes example
    files.push({
      path: 'app/routes/api.users.ts',
      content: this.generateUsersApiRoute()
    });

    // Nested routes example
    files.push({
      path: 'app/routes/posts.tsx',
      content: this.generatePostsRoute()
    });

    files.push({
      path: 'app/routes/posts.$id.tsx',
      content: this.generatePostDetailRoute()
    });

    // Loaders and actions
    files.push({
      path: 'app/models/user.server.ts',
      content: this.generateUserModel()
    });

    // Styles
    files.push({
      path: 'app/tailwind.css',
      content: this.generateTailwindCss()
    });

    // Entry client
    files.push({
      path: 'app/entry.client.tsx',
      content: this.generateEntryClient()
    });

    // Entry server
    files.push({
      path: 'app/entry.server.tsx',
      content: this.generateEntryServer()
    });

    // Database utilities
    files.push({
      path: 'app/utils/db.server.ts',
      content: this.generateDbUtils()
    });

    // Session utilities
    files.push({
      path: 'app/utils/session.server.ts',
      content: this.generateSessionUtils()
    });

    // Types
    files.push({
      path: 'app/types.ts',
      content: this.generateTypes()
    });

    // Environment config
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Dockerfile
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Docker Compose
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      private: true,
      sideEffects: false,
      type: 'module',
      scripts: {
        build: 'remix build',
        dev: 'remix dev --manual',
        start: 'remix-serve ./build/index.js',
        typecheck: 'tsc'
      },
      dependencies: {
        '@remix-run/node': '^2.8.1',
        '@remix-run/react': '^2.8.1',
        '@remix-run/serve': '^2.8.1',
        'isbot': '^4.1.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@remix-run/dev': '^2.8.1',
        '@types/react': '^18.2.48',
        '@types/react-dom': '^18.2.18',
        'autoprefixer': '^10.4.17',
        'eslint': '^8.56.0',
        'eslint-config-prettier': '^9.1.0',
        'postcss': '^8.4.33',
        'prettier': '^3.1.1',
        'tailwindcss': '^3.4.1',
        'typescript': '^5.3.3'
      }
    };
  }

  protected generateRemixConfig() {
    return `/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ['**/.*'],
  serverModuleFormat: 'esm',
  future: {
    v2_fetcherPersist: true,
    v2_normalizeFormMethod: true,
    v2_errorBoundary: true,
  },
  // When running locally in development mode, we use the built-in remix server
  devServerBroadcastDelay: 1000,
};
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2023'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        strict: true,
        skipLibCheck: true,
        jsx: 'react-jsx',
        isolatedModules: true,
       esModuleInterop: true,
        paths: {
          '~/*': ['./app/*']
        }
      },
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['node_modules']
    }, null, 2);
  }

  protected generateTailwindConfig() {
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/**.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
      },
    },
  },
  plugins: [],
};
`;
  }

  protected generatePostcssConfig() {
    return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  }

  protected generateRootRoute() {
    return `import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import type { LinksFunction } from '@remix-run/node';
import tailwind from './tailwind.css';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: tailwind },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
`;
  }

  protected generateHomeRoute() {
    return `import { Link } from '@remix-run/react';

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Welcome to ${this.context.name}</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="border p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Remix Features</h2>
            <ul className="space-y-2">
              <li>✅ Nested Routing</li>
              <li>✅ Data Loading & Mutations</li>
              <li>✅ Progressive Enhancement</li>
              <li>✅ Server-Side Rendering</li>
              <li>✅ Type-Safe</li>
            </ul>
          </div>

          <div className="border p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Quick Links</h2>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-primary hover:underline">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/posts" className="text-primary hover:underline">
                  Posts (Nested Routes)
                </Link>
              </li>
              <li>
                <Link to="/api/users" className="text-primary hover:underline">
                  API: Users
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
  }

  protected generateIndexRoute() {
    return `import { redirect } from '@remix-run/node';

export function loader() {
  return redirect('/home');
}
`;
  }

  protected generateUsersApiRoute() {
    return `import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { getUsers, createUser } from '~/models/user.server';

// GET /api/users - List all users
export async function loader({ request }: LoaderFunctionArgs) {
  const users = await getUsers();
  return json({ users });
}

// POST /api/users - Create a new user
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const user = await createUser(body);
    return json(user, { status: 201 });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 400 }
    );
  }
}
`;
  }

  protected generatePostsRoute() {
    return `import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, Outlet } from '@remix-run/react';
import { getPosts } from '~/utils/db.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const posts = await getPosts();
  return json({ posts });
}

export default function Posts() {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Posts</h1>

      <div className="grid gap-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            to={\`/posts/\${post.id}\`}
            className="block border p-4 rounded-lg hover:bg-gray-50 transition"
          >
            <h2 className="text-xl font-semibold">{post.title}</h2>
            <p className="text-gray-600 mt-2">{post.excerpt}</p>
          </Link>
        ))}
      </div>

      {/* Outlet for nested routes */}
      <Outlet />
    </div>
  );
}
`;
  }

  protected generatePostDetailRoute() {
    return `import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form, redirect } from '@remix-run/react';
import { getPostById, updatePost, deletePost } from '~/utils/db.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const post = await getPostById(Number(params.id));
  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }
  return json({ post });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    await deletePost(Number(params.id));
    return redirect('/posts');
  }

  if (intent === 'update') {
    const title = formData.get('title');
    const content = formData.get('content');
    await updatePost(Number(params.id), { title, content });
    return redirect(\`/posts/\${params.id}\`);
  }

  return json({ error: 'Invalid intent' }, { status: 400 });
}

export default function PostDetail() {
  const { post } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Link to="/posts" className="text-primary hover:underline">
        ← Back to Posts
      </Link>

      <article className="mt-6">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-gray-600 mb-8">{post.date}</p>

        <div className="prose max-w-none">
          {post.content}
        </div>
      </article>

      <div className="mt-8 border-t pt-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Delete Post
          </button>
        </Form>
      </div>
    </div>
  );
}
`;
  }

  protected generateUserModel() {
    return `import { prisma } from '~/utils/db.server';

export async function getUsers() {
  return prisma.user.findMany();
}

export async function getUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(data: any) {
  return prisma.user.create({ data });
}

export async function updateUser(id: number, data: any) {
  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: number) {
  return prisma.user.delete({ where: { id } });
}
`;
  }

  protected generateTailwindCss() {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900;
}
`;
  }

  protected generateEntryClient() {
    return `import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
`;
  }

  protected generateEntryServer() {
    return `import type { EntryContext } from '@remix-run/node';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToPipeableStream } from 'react-dom/server';

const ABORT_DELAY = 5_000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return isbot(request.headers.get('user-agent'))
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext
      );
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onAllReady() {
          const body = new ReadableStream({
            start(controller) {
              pipe(controller);
            },
            cancel(reason) {
              abort();
            },
          });

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(body, {
              status: didError ? 500 : responseStatusCode,
              headers: responseHeaders,
            })
          );
        },
        onShellError(error: unknown) {
          didError = true;
          reject(error);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady() {
          const body = new ReadableStream({
            start(controller) {
              pipe(controller);
            },
            cancel(reason) {
              abort();
            },
          });

          responseHeaders.set('Content-Type', 'text/html');

          resolve(
            new Response(body, {
              status: didError ? 500 : responseStatusCode,
              headers: responseHeaders,
            })
          );
        },
        onShellError(error: unknown) {
          didError = true;
          reject(error);
        },
        onError(error: unknown) {
          didError = true;
          console.error(error);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
`;
  }

  protected generateDbUtils() {
    return `import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

declare global {
  var __db__: PrismaClient;
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  prisma = global.__db__;
}

export const db = prisma;

// Simulated data (replace with actual Prisma queries)
export async function getPosts() {
  return [
    {
      id: 1,
      title: 'Getting Started with Remix',
      excerpt: 'Learn the fundamentals of Remix framework',
      date: '2024-01-15',
      content: 'Full content here...',
    },
    {
      id: 2,
      title: 'Nested Routing in Remix',
      excerpt: 'Master nested routes and data loading',
      date: '2024-01-14',
      content: 'Full content here...',
    },
  ];
}

export async function getPostById(id: number) {
  const posts = await getPosts();
  return posts.find(post => post.id === id) || null;
}

export async function updatePost(id: number, data: any) {
  // Implementation with Prisma
  return { id, ...data };
}

export async function deletePost(id: number) {
  // Implementation with Prisma
  return { id };
}
`;
  }

  protected generateSessionUtils() {
    return `import { createCookieSessionStorage } from '@remix-run/node';

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: 'session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/',
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET || 'default-secret'],
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function getSession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  return session;
}

export async function getUser(request: Request) {
  const session = await getSession(request);
  return session.get('userId');
}
`;
  }

  protected generateTypes() {
    return `export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: Date;
}

export interface Post {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  authorId: number;
}

export interface Comment {
  id: number;
  postId: number;
  author: string;
  content: string;
  createdAt: Date;
}
`;
  }

  protected generateEnvExample() {
    return `# Session
SESSION_SECRET=your-secret-key-here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# API
API_URL=https://api.example.com
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Remix, TypeScript, Tailwind CSS, and progressive enhancement.

## Features

- **Remix**: Full-stack web framework with nested routing
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Nested Routing**: File-based routing with nested routes
- **Data Loading**: Server-side data loading with loaders
- **Progressive Enhancement**: Works without JavaScript
- **Forms**: Built-in form handling with actions
- **Docker**: Container support for deployment

## Getting Started

### Installation

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### Development

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

\`\`\`bash
npm run build
npm run start
\`\`\`

## Project Structure

\`\`\`
app/
├── root.tsx              # Root component with HTML
├── routes/               # File-based routing
│   ├── _index.tsx        # Index route
│   ├── home.tsx          # Home page
│   ├── posts.tsx         # Posts list (parent route)
│   ├── posts.$id.tsx    # Post detail (nested route)
│   └── api.users.ts      # API route
├── models/               # Data models
├── utils/                # Utility functions
├── entry.client.tsx      # Browser entry
├── entry.server.tsx      # Server entry
└── tailwind.css          # Global styles
\`\`\`

## Nested Routes

Remix supports nested routes through file naming:

\`\`\`tsx
// app/routes/posts.tsx - Parent route
export default function Posts() {
  return (
    <div>
      <h1>Posts</h1>
      <Outlet /> {/* Child routes render here */}
    </div>
  );
}

// app/routes/posts.$id.tsx - Child route
export default function PostDetail() {
  return <div>Post content</div>;
}
\`\`\`

## Data Loading

Load data on the server with \`loader\`:

\`\`\`tsx
import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader() {
  const data = await fetchData();
  return json(data);
}

export default function Component() {
  const data = useLoaderData<typeof loader>();
  return <div>{data}</div>;
}
\`\`\`

## Actions (Form Handling)

Handle form submissions with \`action\`:

\`\`\`tsx
import { Form } from '@remix-run/react';

export async function action({ request }) {
  const formData = await request.formData();
  // Process form data
  return redirect('/success');
}

export default function Component() {
  return (
    <Form method="post">
      <input name="email" />
      <button type="submit">Submit</button>
    </Form>
  );
}
\`\`\`

## Progressive Enhancement

Remix works without JavaScript:

- Forms submit natively
- Links work without JS
- Progressive enhancement with JS

## API Routes

Create API routes in the \`routes\` directory:

\`\`\`tsx
// app/routes/api.users.ts
import { json } from '@remix-run/node';

export async function loader() {
  return json({ users: [] });
}
\`\`\`

## Docker

### Build

\`\`\`bash
docker build -t ${this.context.normalizedName} .
\`\`\`

### Run

\`\`\`bash
docker run -p 3000:3000 ${this.context.normalizedName}
\`\`\`

### Docker Compose

\`\`\`bash
docker-compose up
\`\`\`

## Deployment

### Deploy to any Node.js host

\`\`\`bash
npm run build
npm run start
\`\`\`

### Deploy with Docker

\`\`\`bash
docker build -t app .
docker run -p 3000:3000 app
\`\`\`

## Learn More

- [Remix Documentation](https://remix.run/docs)
- [Remix Tutorial](https://remix.run/docs/en/main/start/tutorial)
- [Nested Routes](https://remix.run/docs/en/main/file-conventions/routes-files)
- [Data Loading](https://remix.run/docs/en/main/route/loader)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Remix

# Dependencies stage
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 remix

COPY --from=builder /app/package.json ./
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public

USER remix

EXPOSE 3000

ENV PORT 3000

CMD ["npm", "run", "start"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
`;
  }
}
