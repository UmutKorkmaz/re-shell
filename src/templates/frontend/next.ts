import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class NextJsTemplate extends BaseTemplate {
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

    // Next.js config
    files.push({
      path: 'next.config.js',
      content: this.generateNextConfig()
    });

    // TypeScript config
    if (hasTypeScript) {
      files.push({
        path: 'tsconfig.json',
        content: this.generateTsConfig()
      });
    }

    // Tailwind config
    files.push({
      path: 'tailwind.config.ts',
      content: this.generateTailwindConfig()
    });

    // PostCSS config
    files.push({
      path: 'postcss.config.js',
      content: this.generatePostcssConfig()
    });

    // ESLint config
    files.push({
      path: '.eslintrc.json',
      content: this.generateEslintConfig()
    });

    // App Router structure
    files.push({
      path: 'src/app/layout.tsx',
      content: this.generateLayout()
    });

    files.push({
      path: 'src/app/page.tsx',
      content: this.generateHomePage()
    });

    files.push({
      path: 'src/app/globals.css',
      content: this.generateGlobalsCss()
    });

    // API routes
    files.push({
      path: 'src/app/api/hello/route.ts',
      content: this.generateApiRoute()
    });

    files.push({
      path: 'src/app/api/users/route.ts',
      content: this.generateUsersApiRoute()
    });

    // Example dynamic route
    files.push({
      path: 'src/app/posts/[id]/page.tsx',
      content: this.generateDynamicRoute()
    });

    // Server component example
    files.push({
      path: 'src/app/components/ServerComponent.tsx',
      content: this.generateServerComponent()
    });

    // Client component example
    files.push({
      path: 'src/app/components/ClientComponent.tsx',
      content: this.generateClientComponent()
    });

    // React Server Components (RSC) examples
    files.push({
      path: 'src/app/components/rsc/AsyncComponent.tsx',
      content: this.generateAsyncComponent()
    });

    files.push({
      path: 'src/app/components/rsc/SuspenseComponent.tsx',
      content: this.generateSuspenseComponent()
    });

    files.push({
      path: 'src/app/components/rsc/StreamingComponent.tsx',
      content: this.generateStreamingComponent()
    });

    files.push({
      path: 'src/app/components/rsc/NestedServerComponent.tsx',
      content: this.generateNestedServerComponent()
    });

    files.push({
      path: 'src/app/components/rsc/ServerActionsDemo.tsx',
      content: this.generateServerActionsDemo()
    });

    files.push({
      path: 'src/app/actions/server-actions.ts',
      content: this.generateServerActions()
    });

    files.push({
      path: 'src/app/components/rsc/ParallelDataFetching.tsx',
      content: this.generateParallelDataFetching()
    });

    files.push({
      path: 'src/app/components/rsc/ErrorBoundary.tsx',
      content: this.generateRSCErrorBoundary()
    });

    files.push({
      path: 'src/app/components/rsc/loading.tsx',
      content: this.generateLoadingComponent()
    });

    files.push({
      path: 'src/app/components/rsc/error.tsx',
      content: this.generateErrorComponent()
    });

    files.push({
      path: 'src/app/lib/rsc-utils.ts',
      content: this.generateRSCUtils()
    });

    files.push({
      path: 'src/app/rsc/page.tsx',
      content: this.generateRSCPage()
    });

    // Data fetching example
    files.push({
      path: 'src/app/lib/data.ts',
      content: this.generateDataLib()
    });

    // Types
    files.push({
      path: 'src/app/types/index.ts',
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

    // .dockerignore
    files.push({
      path: '.dockerignore',
      content: this.generateDockerIgnore()
    });

    // .gitignore
    files.push({
      path: '.gitignore',
      content: this.generateGitIgnore()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
        'type-check': 'tsc --noEmit'
      },
      dependencies: {
        next: '^14.1.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        '@types/react': '^18.2.48',
        '@types/react-dom': '^18.2.18',
        'autoprefixer': '^10.4.17',
        'eslint': '^8.56.0',
        'eslint-config-next': '^14.1.0',
        'postcss': '^8.4.33',
        tailwindcss: '^3.4.1',
        typescript: '^5.3.3'
      }
    };
  }

  protected generateNextConfig() {
    return `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: {
          '@/*': ['./src/*']
        }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    }, null, 2);
  }

  protected generateTailwindConfig() {
    return `import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
      },
    },
  },
  plugins: [],
}
export default config
`;
  }

  protected generatePostcssConfig() {
    return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
  }

  protected generateEslintConfig() {
    return JSON.stringify({
      extends: 'next/core-web-vitals'
    }, null, 2);
  }

  protected generateLayout() {
    return `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${this.context.name}',
  description: '${this.context.description}',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
`;
  }

  protected generateHomePage() {
    return `import ClientComponent from '@/app/components/ClientComponent'
import { getPosts } from '@/app/lib/data'

export default async function Home() {
  const posts = await getPosts()

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Welcome to ${this.context.name}</h1>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Server-Side Rendered Posts</h2>
          <div className="grid gap-4">
            {posts.map((post) => (
              <div key={post.id} className="border p-4 rounded-lg">
                <h3 className="text-xl font-medium">{post.title}</h3>
                <p className="text-gray-600 mt-2">{post.excerpt}</p>
              </div>
            ))}
          </div>
        </div>

        <ClientComponent />
      </div>
    </main>
  )
}
`;
  }

  protected generateGlobalsCss() {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
`;
  }

  protected generateApiRoute() {
    return `import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Hello from Next.js API Route!',
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  return NextResponse.json({
    message: 'Data received',
    data: body,
  })
}
`;
  }

  protected generateUsersApiRoute() {
    return `import { NextResponse } from 'next/server'

const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
]

export async function GET() {
  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  const body = await request.json()
  const newUser = { id: users.length + 1, ...body }
  users.push(newUser)
  return NextResponse.json(newUser, { status: 201 })
}
`;
  }

  protected generateDynamicRoute() {
    return `import { notFound } from 'next/navigation'
import { getPostById } from '@/app/lib/data'

export default async function PostPage({
  params,
}: {
  params: { id: string }
}) {
  const post = await getPostById(parseInt(params.id))

  if (!post) {
    notFound()
  }

  return (
    <main className="min-h-screen p-8">
      <article className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
        <p className="text-gray-600 mb-8">{post.date}</p>
        <div className="prose">{post.content}</div>
      </article>
    </main>
  )
}
`;
  }

  protected generateServerComponent() {
    return `import { getServerData } from '@/app/lib/data'

export default async function ServerComponent() {
  const data = await getServerData()

  return (
    <div className="border p-6 rounded-lg bg-white">
      <h3 className="text-xl font-semibold mb-4">Server Component</h3>
      <p className="text-gray-600 mb-4">
        This component is rendered on the server with real data:
      </p>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
`;
  }

  protected generateClientComponent() {
    return `'use client'

import { useState } from 'react'

export default function ClientComponent() {
  const [count, setCount] = useState(0)

  return (
    <div className="border p-6 rounded-lg bg-white">
      <h3 className="text-xl font-semibold mb-4">Client Component</h3>
      <p className="text-gray-600 mb-4">
        This component uses React hooks for interactivity:
      </p>
      <button
        onClick={() => setCount(count + 1)}
        className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
      >
        Count: {count}
      </button>
    </div>
  )
}
`;
  }

  protected generateDataLib() {
    return `// Simulated data fetching functions

export async function getPosts() {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100))

  return [
    {
      id: 1,
      title: 'Getting Started with Next.js 14',
      excerpt: 'Learn about the new App Router and Server Components',
      date: '2024-01-15',
    },
    {
      id: 2,
      title: 'Server Actions in Next.js',
      excerpt: 'Mutations made easy with Server Actions',
      date: '2024-01-14',
    },
    {
      id: 3,
      title: 'Static Site Generation with Next.js',
      excerpt: 'Build lightning-fast static sites',
      date: '2024-01-13',
    },
  ]
}

export async function getPostById(id: number) {
  const posts = await getPosts()
  return posts.find(post => post.id === id) || null
}

export async function getServerData() {
  return {
    message: 'Data fetched on server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  }
}
`;
  }

  protected generateTypes() {
    return `export interface Post {
  id: number
  title: string
  excerpt: string
  date: string
  content?: string
}

export interface User {
  id: number
  name: string
  email: string
}
`;
  }

  protected generateEnvExample() {
    return `# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# API Keys
NEXT_PUBLIC_API_URL=http://localhost:3000
API_SECRET_KEY=your-secret-key

# Features
NEXT_PUBLIC_ANALYTICS_ID=
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Next.js 14, TypeScript, Tailwind CSS, and App Router.

## Features

- **Next.js 14**: Latest React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Server Components**: React Server Components for performance
- **API Routes**: Built-in API routes for backend functionality
- **SSR/SSG**: Server-Side Rendering and Static Site Generation
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
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page (SSR)
│   ├── globals.css         # Global styles
│   ├── api/                # API routes
│   │   ├── hello/route.ts  # Example API route
│   │   └── users/route.ts  # Users CRUD API
│   ├── posts/[id]/page.tsx # Dynamic route (SSG)
│   ├── components/         # React components
│   ├── lib/               # Utility functions
│   └── types/             # TypeScript types
└── public/                # Static assets
\`\`\`

## App Router Features

### Server Components (Default)

All components in the \`app\` directory are Server Components by default:

\`\`\`tsx
// This runs on the server
export default async function Page() {
  const data = await fetchData() // Direct async!
  return <div>{data}</div>
}
\`\`\`

### Client Components

Add \`'use client'\` for interactivity:

\`\`\`tsx
'use client'

import { useState } from 'react'

export default function Interactive() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
\`\`\`

### API Routes

Create API routes in the \`app/api\` directory:

\`\`\`ts
// app/api/hello/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Hello' })
}
\`\`\`

### Dynamic Routes

Use brackets for dynamic segments:

\`\`\`ts
// app/posts/[id]/page.tsx
export default async function Post({ params }) {
  const post = await getPost(params.id)
  return <div>{post.title}</div>
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

### Vercel (Recommended)

Deploy to Vercel with zero configuration:

\`\`\`bash
vercel
\`\`\`

### Other Platforms

Build the application and start the server:

\`\`\`bash
npm run build
npm run start
\`\`\`

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Next.js

# Dependencies stage
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies based on package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
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

  protected generateDockerIgnore() {
    return `node_modules
.next
.git
.env*.local
*.md
`;
  }

  protected generateGitIgnore() {
    return `# dependencies
node_modules
.pnp
.pnp.js

# testing
coverage

# next.js
.next/
out/
build
dist

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;
  }

  protected generateAsyncComponent() {
    return `/**
 * Async Server Component
 * Demonstrates async data fetching in Server Components
 */

import { delay } from '@/app/lib/rsc-utils';

interface User {
  id: number;
  name: string;
  email: string;
  avatar: string;
}

async function getUsers(): Promise<User[]> {
  // Simulate API delay
  await delay(1500);

  return [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', avatar: '/avatars/1.png' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', avatar: '/avatars/2.png' },
    { id: 3, name: 'Carol White', email: 'carol@example.com', avatar: '/avatars/3.png' },
  ];
}

export default async function AsyncComponent() {
  const users = await getUsers();

  return (
    <div className="border p-6 rounded-lg bg-white shadow-sm">
      <h3 className="text-xl font-semibold mb-4">Async Server Component</h3>
      <p className="text-gray-600 mb-4">
        This component fetches data asynchronously on the server:
      </p>
      <ul className="space-y-2">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
              {user.name[0]}
            </div>
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;
  }

  protected generateSuspenseComponent() {
    return `/**
 * Suspense Component
 * Demonstrates React Suspense with async components
 */

import { Suspense } from 'react';
import { AsyncComponent } from './AsyncComponent';

function SkeletonLoader() {
  return (
    <div className="border p-6 rounded-lg bg-white shadow-sm">
      <h3 className="text-xl font-semibold mb-4">Loading...</h3>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-100 rounded animate-pulse">
            <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SuspenseComponent() {
  return (
    <div className="space-y-6">
      <div className="border p-6 rounded-lg bg-white shadow-sm">
        <h3 className="text-2xl font-semibold mb-4">React Suspense Demo</h3>
        <p className="text-gray-600 mb-4">
          This demonstrates Suspense boundaries with async server components:
        </p>
      </div>

      <Suspense fallback={<SkeletonLoader />}>
        <AsyncComponent />
      </Suspense>
    </div>
  );
}
`;
  }

  protected generateStreamingComponent() {
    return `/**
 * Streaming Component
 * Demonstrates progressive rendering with streaming SSR
 */

import { Suspense } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

async function getProducts(): Promise<Product[]> {
  // Simulate slow API with streaming response
  await new Promise(resolve => setTimeout(resolve, 2000));

  return [
    { id: 1, name: 'Premium Widget', price: 99.99, description: 'High-quality widget for professionals' },
    { id: 2, name: 'Basic Gadget', price: 29.99, description: 'Essential gadget for everyday use' },
    { id: 3, name: 'Deluxe Doohickey', price: 149.99, description: 'Top-of-the-line doohickey' },
  ];
}

async function ProductList() {
  const products = await getProducts();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {products.map((product) => (
        <div key={product.id} className="border p-4 rounded-lg bg-white shadow-sm hover:shadow-md transition">
          <h4 className="font-semibold text-lg">{product.name}</h4>
          <p className="text-2xl font-bold text-primary my-2">\${product.price}</p>
          <p className="text-sm text-gray-600">{product.description}</p>
          <button className="mt-4 w-full bg-primary text-white py-2 rounded hover:bg-primary/90">
            Add to Cart
          </button>
        </div>
      ))}
    </div>
  );
}

function ProductListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border p-4 rounded-lg bg-gray-100 animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
          <div className="h-8 bg-gray-300 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-full mb-1"></div>
          <div className="h-4 bg-gray-300 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
}

export default function StreamingComponent() {
  return (
    <div className="space-y-6">
      <div className="border p-6 rounded-lg bg-white shadow-sm">
        <h3 className="text-2xl font-semibold mb-4">Streaming SSR Demo</h3>
        <p className="text-gray-600">
          This page streams in progressively. The UI renders immediately, then streams
          in data as it becomes available from the server.
        </p>
      </div>

      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList />
      </Suspense>
    </div>
  );
}
`;
  }

  protected generateNestedServerComponent() {
    return `/**
 * Nested Server Component
 * Demonstrates composition of server and client components
 */

import { Suspense } from 'react';

// Server Child Component
async function ServerChild({ id }: { id: number }) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  return (
    <div className="p-4 bg-blue-50 rounded border-2 border-blue-200">
      <h4 className="font-semibold text-blue-900">Server Child Component</h4>
      <p className="text-blue-700">ID: {id}</p>
      <p className="text-sm text-blue-600 mt-2">
        This component renders on the server and streams to the client.
      </p>
    </div>
  );
}

// Client Child Component (will be marked with 'use client')
const ClientChild = ({ count }: { count: number }) => (
  <div className="p-4 bg-green-50 rounded border-2 border-green-200">
    <h4 className="font-semibold text-green-900">Client Child Component</h4>
    <p className="text-green-700">Count: {count}</p>
    <p className="text-sm text-green-600 mt-2">
      This component hydrates on the client for interactivity.
    </p>
  </div>
);

// Loading state
function ChildSkeleton() {
  return (
    <div className="p-4 bg-gray-100 rounded animate-pulse">
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
    </div>
  );
}

export default async function NestedServerComponent() {
  return (
    <div className="space-y-4">
      <div className="border p-6 rounded-lg bg-white shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Nested Component Demo</h3>
        <p className="text-gray-600">
          Server components can be nested and composed. Each component can be
          server or client, and they work together seamlessly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Suspense fallback={<ChildSkeleton />}>
          <ServerChild id={1} />
        </Suspense>

        <Suspense fallback={<ChildSkeleton />}>
          <ServerChild id={2} />
        </Suspense>

        <ClientChild count={42} />
        <ClientChild count={99} />
      </div>
    </div>
  );
}
`;
  }

  protected generateServerActionsDemo() {
    return `'use client';

/**
 * Server Actions Demo
 * Client component that uses Server Actions
 */

import { useTransition, useState } from 'react';
import { createUser, updateUser, deleteUser } from '@/app/actions/server-actions';

interface User {
  id: number;
  name: string;
  email: string;
}

export default function ServerActionsDemo() {
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<User[]>([
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ]);

  const handleCreate = async (formData: FormData) => {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    startTransition(async () => {
      const newUser = await createUser({ name, email });
      setUsers([...users, newUser]);
    });
  };

  const handleUpdate = async (id: number, formData: FormData) => {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;

    startTransition(async () => {
      const updated = await updateUser(id, { name, email });
      setUsers(users.map(u => u.id === id ? updated : u));
    });
  };

  const handleDelete = async (id: number) => {
    startTransition(async () => {
      await deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      <div className="border p-6 rounded-lg bg-white shadow-sm">
        <h3 className="text-2xl font-semibold mb-4">Server Actions Demo</h3>
        <p className="text-gray-600">
          Server Actions allow you to run server code from client components.
          They automatically handle form submissions and mutations.
        </p>
      </div>

      {/* Create User Form */}
      <div className="border p-6 rounded-lg bg-white shadow-sm">
        <h4 className="text-lg font-semibold mb-4">Create User</h4>
        <form action={handleCreate} className="flex gap-4">
          <input
            type="text"
            name="name"
            placeholder="Name"
            required
            className="flex-1 px-3 py-2 border rounded"
            disabled={isPending}
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="flex-1 px-3 py-2 border rounded"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Users List */}
      <div className="border p-6 rounded-lg bg-white shadow-sm">
        <h4 className="text-lg font-semibold mb-4">Users ({users.length})</h4>
        <ul className="space-y-2">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <button
                onClick={() => handleDelete(user.id)}
                disabled={isPending}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
`;
  }

  protected generateServerActions() {
    return `'use server';

/**
 * Server Actions
 * Functions that run on the server but can be called from client components
 */

import { revalidatePath } from 'next/cache';
import { delay } from '@/app/lib/rsc-utils';

export interface User {
  id: number;
  name: string;
  email: string;
}

// Simulated database
let users: User[] = [
  { id: 1, name: 'Server User 1', email: 'server1@example.com' },
  { id: 2, name: 'Server User 2', email: 'server2@example.com' },
];

let nextId = 3;

/**
 * Create a new user
 */
export async function createUser(data: { name: string; email: string }): Promise<User> {
  await delay(500); // Simulate database latency

  const newUser: User = {
    id: nextId++,
    name: data.name,
    email: data.email,
  };

  users.push(newUser);

  // Revalidate the page to show updated data
  revalidatePath('/rsc');

  return newUser;
}

/**
 * Update an existing user
 */
export async function updateUser(
  id: number,
  data: { name: string; email: string }
): Promise<User> {
  await delay(500); // Simulate database latency

  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    throw new Error(\`User with id \${id} not found\`);
  }

  users[index] = { ...users[index], ...data };

  revalidatePath('/rsc');

  return users[index];
}

/**
 * Delete a user
 */
export async function deleteUser(id: number): Promise<void> {
  await delay(500); // Simulate database latency

  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    throw new Error(\`User with id \${id} not found\`);
  }

  users.splice(index, 1);

  revalidatePath('/rsc');
}

/**
 * Get all users (for server-side use)
 */
export async function getUsers(): Promise<User[]> {
  await delay(300);
  return [...users];
}

/**
 * Get a single user
 */
export async function getUserById(id: number): Promise<User | null> {
  await delay(200);
  return users.find(u => u.id === id) || null;
}
`;
  }

  protected generateParallelDataFetching() {
    return `/**
 * Parallel Data Fetching
 * Demonstrates fetching multiple data sources concurrently
 */

import { Suspense } from 'react';

// Simulated data sources with different latencies
async function fetchUsers() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return [
    { id: 1, name: 'User 1', role: 'Admin' },
    { id: 2, name: 'User 2', role: 'User' },
  ];
}

async function fetchPosts() {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return [
    { id: 1, title: 'Post 1', views: 100 },
    { id: 2, title: 'Post 2', views: 200 },
  ];
}

async function fetchStats() {
  await new Promise(resolve => setTimeout(resolve, 500));
  return { totalUsers: 1234, totalPosts: 5678, activeNow: 42 };
}

// Individual data components
async function UsersSection() {
  const users = await fetchUsers();
  return (
    <div className="p-4 bg-blue-50 rounded">
      <h4 className="font-semibold mb-2">Users ({users.length})</h4>
      <ul className="text-sm space-y-1">
        {users.map(u => (
          <li key={u.id}>{u.name} - {u.role}</li>
        ))}
      </ul>
    </div>
  );
}

async function PostsSection() {
  const posts = await fetchPosts();
  return (
    <div className="p-4 bg-green-50 rounded">
      <h4 className="font-semibold mb-2">Posts ({posts.length})</h4>
      <ul className="text-sm space-y-1">
        {posts.map(p => (
          <li key={p.id}>{p.title} ({p.views} views)</li>
        ))}
      </ul>
    </div>
  );
}

async function StatsSection() {
  const stats = await fetchStats();
  return (
    <div className="p-4 bg-purple-50 rounded">
      <h4 className="font-semibold mb-2">Statistics</h4>
      <div className="text-sm space-y-1">
        <p>Total Users: {stats.totalUsers}</p>
        <p>Total Posts: {stats.totalPosts}</p>
        <p>Active Now: {stats.activeNow}</p>
      </div>
    </div>
  );
}

// Loading skeleton
function SectionSkeleton() {
  return (
    <div className="p-4 bg-gray-100 rounded animate-pulse">
      <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
      <div className="h-3 bg-gray-300 rounded w-full"></div>
    </div>
  );
}

export default async function ParallelDataFetching() {
  return (
    <div className="space-y-6">
      <div className="border p-6 rounded-lg bg-white shadow-sm">
        <h3 className="text-2xl font-semibold mb-4">Parallel Data Fetching</h3>
        <p className="text-gray-600">
          All three sections below fetch data in parallel, not sequentially.
          This significantly reduces the total page load time.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Total time: ~1.5s (slowest request) instead of ~3s (sum of all requests)
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Suspense fallback={<SectionSkeleton />}>
          <UsersSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <PostsSection />
        </Suspense>

        <Suspense fallback={<SectionSkeleton />}>
          <StatsSection />
        </Suspense>
      </div>
    </div>
  );
}
`;
  }

  protected generateRSCErrorBoundary() {
    return `/**
 * Error Boundary for Server Components
 * Catches and handles errors in server components
 */

'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class RSCErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('RSC Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Something went wrong</h3>
          <p className="text-red-700">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
`;
  }

  protected generateLoadingComponent() {
    return `/**
 * Loading Component
 * Shown while content is loading in a Suspense boundary
 */

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
`;
  }

  protected generateErrorComponent() {
    return `/**
 * Error Component
 * Shown when an error occurs in a Server Component
 */

'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Server Component Error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-6">{error.message}</p>
        <div className="space-x-4">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
`;
  }

  protected generateRSCUtils() {
    return `/**
 * RSC Utility Functions
 * Helper functions for React Server Components
 */

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(baseDelay * Math.pow(2, i));
    }
  }
  throw new Error('Retry failed');
}

/**
 * Cache data with TTL
 */
const cache = new Map<string, { data: any; expires: number }>();

export async function cachedFetch<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = 60000 // 1 minute default
): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  const data = await fn();
  cache.set(key, { data, expires: Date.now() + ttl });
  return data;
}

/**
 * Prefetch data for navigation
 */
export function prefetchData(url: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }
}
`;
  }

  protected generateRSCPage() {
    return `/**
 * RSC Demo Page
 * Comprehensive demonstration of React Server Components
 */

import { Suspense } from 'react';
import { RSCErrorBoundary } from './components/rsc/ErrorBoundary';
import { SuspenseComponent } from './components/rsc/SuspenseComponent';
import { StreamingComponent } from './components/rsc/StreamingComponent';
import { NestedServerComponent } from './components/rsc/NestedServerComponent';
import { ServerActionsDemo } from './components/rsc/ServerActionsDemo';
import { ParallelDataFetching } from './components/rsc/ParallelDataFetching';

export default function RSCPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">React Server Components</h1>
          <p className="text-xl text-gray-600">
            Comprehensive demonstration of RSC features in Next.js 14
          </p>
        </div>

        <RSCErrorBoundary>
          <Suspense fallback={<div>Loading Suspense Demo...</div>}>
            <SuspenseComponent />
          </Suspense>
        </RSCErrorBoundary>

        <RSCErrorBoundary>
          <Suspense fallback={<div>Loading Streaming Demo...</div>}>
            <StreamingComponent />
          </Suspense>
        </RSCErrorBoundary>

        <RSCErrorBoundary>
          <Suspense fallback={<div>Loading Nested Demo...</div>}>
            <NestedServerComponent />
          </Suspense>
        </RSCErrorBoundary>

        <RSCErrorBoundary>
          <Suspense fallback={<div>Loading Parallel Demo...</div>}>
            <ParallelDataFetching />
          </Suspense>
        </RSCErrorBoundary>

        <RSCErrorBoundary>
          <ServerActionsDemo />
        </RSCErrorBoundary>

        <div className="border p-6 rounded-lg bg-white shadow-sm">
          <h3 className="text-xl font-semibold mb-4">Key Features Demonstrated</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Async Server Components with data fetching</li>
            <li>Suspense boundaries for loading states</li>
            <li>Streaming SSR for progressive rendering</li>
            <li>Nested server and client components</li>
            <li>Parallel data fetching for optimal performance</li>
            <li>Server Actions for mutations</li>
            <li>Error boundaries for graceful error handling</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
`;
  }

}
