import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class NuxtTemplate extends BaseTemplate {
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

    // Nuxt config
    files.push({
      path: 'nuxt.config.ts',
      content: this.generateNuxtConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // App configuration
    files.push({
      path: 'app.config.ts',
      content: this.generateAppConfig()
    });

    // Tailwind config
    files.push({
      path: 'tailwind.config.js',
      content: this.generateTailwindConfig()
    });

    // Nuxt app
    files.push({
      path: 'app/app.vue',
      content: this.generateAppVue()
    });

    // Pages
    files.push({
      path: 'app/pages/index.vue',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'app/pages/about.vue',
      content: this.generateAboutPage()
    });

    // Dynamic route
    files.push({
      path: 'app/pages/posts/[id].vue',
      content: this.generatePostDetailPage()
    });

    // Components
    files.push({
      path: 'app/components/AppHeader.vue',
      content: this.generateHeader()
    });

    files.push({
      path: 'app/components/AppFooter.vue',
      content: this.generateFooter()
    });

    // Composables
    files.push({
      path: 'app/composables/useApi.ts',
      content: this.generateApiComposable()
    });

    // Server API routes
    files.push({
      path: 'app/server/api/hello.get.ts',
      content: this.generateHelloApiRoute()
    });

    // Utilities
    files.push({
      path: 'app/utils/helpers.ts',
      content: this.generateHelpers()
    });

    // Types
    files.push({
      path: 'app/types/index.ts',
      content: this.generateTypes()
    });

    // Middleware
    files.push({
      path: 'app/middleware/auth.ts',
      content: this.generateAuthMiddleware()
    });

    // Layouts
    files.push({
      path: 'app/layouts/default.vue',
      content: this.generateDefaultLayout()
    });

    // Plugins
    files.push({
      path: 'app/plugins/vue-i18n.ts',
      content: this.generateI18nPlugin()
    });

    // CSS
    files.push({
      path: 'app/assets/css/main.css',
      content: this.generateMainCss()
    });

    // Environment
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
      type: 'module',
      scripts: {
        dev: 'nuxt dev',
        build: 'nuxt build',
        generate: 'nuxt generate',
        preview: 'nuxt preview',
        postinstall: 'nuxt prepare'
      },
      dependencies: {
        'nuxt': '^3.10.0',
        '@nuxtjs/tailwindcss': '^6.10.0',
        '@pinia/nuxt': '^0.5.1',
        '@pinia/plugin-persistedstate': '^3.2.1',
        '@vueuse/nuxt': '^10.7.2',
        '@nuxtjs/i18n': '^8.3.0',
        '@nuxtjs/seo': '^2.0.0',
        '@nuxtjs/color-mode': '^3.3.3'
      },
      devDependencies: {
        'vue': '^3.4.0',
        '@types/node': '^20.11.0',
        'typescript': '^5.3.3',
        'autoprefixer': '^10.4.17',
        'postcss': '^8.4.33',
        'tailwindcss': '^3.4.1'
      }
    };
  }

  protected generateNuxtConfig() {
    return `// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@pinia/plugin-persistedstate',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/seo',
    '@nuxtjs/color-mode',
  ],

  app: {
    head: {
      title: '${this.context.name}',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '${this.context.description}' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.API_URL || '/api',
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
    },
    private: {
      apiSecret: process.env.API_SECRET || 'my-secret-key',
    }
  },

  vite: {
    optimizeDeps: {
      include: ['@vueuse/core'],
    }
  }
});
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      extends: './.nuxt/tsconfig.json',
      compilerOptions: {
        strict: true,
        types: ['@nuxt/vue-router'],
        paths: {
          '@': ['.'],
          '~': ['.'],
          '@@': ['.'],
          '~~': ['.'],
          '@@/': ['.']
        }
      }
    }, null, 2);
  }

  protected generateAppConfig() {
    return `// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineAppConfig({
  title: '${this.context.name}',
  description: '${this.context.description}',
  authors: [
    {
      name: '${this.context.team || this.context.org}',
    }
  ]
});
`;
  }

  protected generateTailwindConfig() {
    return `module.exports = {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
      },
    },
  },
};
`;
  }

  protected generateAppVue() {
    return `<template>
  <div>
    <NuxtPage />
    <NuxtLoadingIndicator />
  </div>
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>
`;
  }

  protected generateIndexPage() {
    return `<script setup lang="ts">
const { data } = await useFetch('/api/hello')

useSeoMeta({
  title: 'Home',
  description: 'Welcome to ${this.context.name}'
})
</script>

<template>
  <div class="min-h-screen p-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-4xl font-bold mb-8">
        Welcome to ${this.context.name}
      </h1>

      <section class="mb-12">
        <h2 class="text-3xl font-semibold mb-4">Nuxt 3 Features</h2>
        <div class="grid gap-6 md:grid-cols-2">
          <div class="border p-6 rounded-lg">
            <h3 class="text-xl font-medium mb-2">⚡ Blazing Fast</h3>
            <p class="text-gray-600">Vite-powered build system</p>
          </div>
          <div class="border p-6 rounded-lg">
            <h3 class="text-xl font-medium mb-2">🎨 Vue 3</h3>
            <p class="text-gray-600">Composition API</p>
          </div>
          <div class="border p-6 rounded-lg">
            <h3 class="text-xl font-medium mb-2">🔄 Auto-imports</h3>
            <p class="text-gray-600">Components & composables</p>
          </div>
          <div class="border p-6 rounded-lg">
            <h3 class="text-xl font-medium mb-2">💾 Pinia</h3>
            <p class="text-gray-600">State management</p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-3xl font-semibold mb-4">API Response</h2>
        <pre class="bg-gray-100 p-4 rounded">{{ data }}</pre>
      </section>
    </div>
  </div>
</template>
`;
  }

  protected generateAboutPage() {
    return `<script setup lang="ts">
useSeoMeta({
  title: 'About',
  description: 'About ${this.context.name}'
})
</script>

<template>
  <div class="min-h-screen p-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-4xl font-bold mb-6">About</h1>

      <div class="prose max-w-none">
        <p class="text-lg mb-4">
          ${this.context.name} is built with Nuxt 3, the full-stack Vue framework.
        </p>

        <h2 class="text-2xl font-semibold mt-8 mb-4">Tech Stack</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li><strong>Nuxt 3</strong> - Vue meta-framework</li>
          <li><strong>Vue 3</strong> - Progressive framework</li>
          <li><strong>TypeScript</strong> - Type safety</li>
          <li><strong>Tailwind CSS</strong> - Utility-first CSS</li>
          <li><strong>Pinia</strong> - State management</li>
        </ul>

        <h2 class="text-2xl font-semibold mt-8 mb-4">Features</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>Server-Side Rendering (SSR)</li>
          <li>Static Site Generation (SSG)</li>
          <li>Auto-imports for components & composables</li>
          <li>File-based routing</li>
          <li>API routes</li>
          <li>Module ecosystem</li>
        </ul>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generatePostDetailPage() {
    return `<script setup lang="ts">
const route = useRoute()
const { data, pending } = await useLazyAsyncData(\`post-\${route.params.id}\`, async () => {
  // Simulated API call
  return {
    post: {
      id: route.params.id,
      title: \`Post \${route.params.id}\`,
      content: 'This is the full post content...',
      date: '2024-01-15'
    }
  }
})

useSeoMeta({
  title: data.value?.post?.title || 'Post',
  description: data.value?.post?.content?.substring(0, 160)
})
</script>

<template>
  <div class="min-h-screen p-8">
    <div class="max-w-3xl mx-auto">
      <NuxtLink to="/" class="text-primary hover:underline">
        ← Back to home
      </NuxtLink>

      <article v-if="!pending && data" class="mt-6">
        <h1 class="text-4xl font-bold mb-4">{{ data.post.title }}</h1>
        <p class="text-gray-600 mb-8">{{ data.post.date }}</p>
        <div class="prose max-w-none">
          {{ data.post.content }}
        </div>
      </article>

      <div v-else class="mt-6">
        <p>Loading...</p>
      </div>
    </div>
  </div>
</template>
`;
  }

  protected generateHeader() {
    return `<script setup lang="ts">
const { data } = await useFetch('/api/hello')
</script>

<template>
  <header class="border-b">
    <div class="max-w-4xl mx-auto px-8 py-4">
      <nav class="flex gap-6">
        <NuxtLink to="/" class="text-primary hover:underline">
          Home
        </NuxtLink>
        <NuxtLink to="/about" class="text-primary hover:underline">
          About
        </NuxtLink>
        <NuxtLink to="/posts/1" class="text-primary hover:underline">
          Posts
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
`;
  }

  protected generateFooter() {
    return `<template>
  <footer class="border-t mt-12">
    <div class="max-w-4xl mx-auto px-8 py-6 text-center text-gray-600">
      <p>© {{ new Date().getFullYear() }} ${this.context.name}. Built with Nuxt.</p>
      <p class="mt-2 text-sm">
        {{ data }}
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
const { data } = await useFetch('/api/hello')
</script>
`;
  }

  protected generateApiComposable() {
    return `// Auto-imported composable

export const useApi = () => {
  const config = useRuntimeConfig()

  const fetchData = async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(\`\${config.public.apiBase}/\${endpoint}\`)
    if (!response.ok) {
      throw new Error(\`API Error: \${response.statusText}\`)
    }
    return response.json()
  }

  const postData = async <T>(endpoint: string, body: any): Promise<T> => {
    const response = await fetch(\`\${config.public.apiBase}/\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!response.ok) {
      throw new Error(\`API Error: \${response.statusText}\`)
    }
    return response.json()
  }

  return {
    fetchData,
    postData
  }
}
`;
  }

  protected generateHelloApiRoute() {
    return `export default defineEventHandler((event) => {
  return {
    message: 'Hello from Nuxt API!',
    timestamp: new Date().toISOString(),
    runtime: useRuntimeConfig()
  }
})
`;
  }

  protected generateHelpers() {
    return `// Utility functions

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const truncate = (text: string, length: number): string => {
  if (text.length <= length) return text
  return text.substring(0, length) + '...'
}

export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\\s+/g, '-')
    .replace(/[^\\w\\-]+/g, '')
}
`;
  }

  protected generateTypes() {
    return `export interface Post {
  id: string | number
  title: string
  content: string
  excerpt?: string
  date: string
  author?: string
}

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
}

export interface ApiResponse<T> {
  data: T
  message?: string
}
`;
  }

  protected generateAuthMiddleware() {
    return `export default defineNuxtRouteMiddleware((to, from) => {
  // Skip authentication for public routes
  const publicRoutes = ['/', '/about', '/login']

  if (publicRoutes.includes(to.path)) {
    return
  }

  // Check for authentication token
  const token = useCookie('auth-token')

  if (!token.value) {
    return navigateTo('/login')
  }
})
`;
  }

  protected generateDefaultLayout() {
    return `<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />

    <main class="flex-1">
      <slot />
    </main>

    <AppFooter />
  </div>
</template>
`;
  }

  protected generateI18nPlugin() {
    return `export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      welcome: 'Welcome',
      about: 'About',
      home: 'Home'
    },
    es: {
      welcome: 'Bienvenido',
      about: 'Acerca de',
      home: 'Inicio'
    }
  }
}))
`;
  }

  protected generateMainCss() {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
.page-enter-active,
.page-leave-active {
  transition: all 0.3s;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

/* Dark mode */
.dark {
  color-scheme: dark;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
`;
  }

  protected generateEnvExample() {
    return `# Application
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NUXT_PUBLIC_API_URL=http://localhost:3000/api

# Private keys
API_SECRET=your-secret-key-here

# Features
NUXT_PUBLIC_I18N_LOCALE=en
NUXT_PUBLIC_COLOR_MODE=dark
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Nuxt 3, Vue 3, TypeScript, and Tailwind CSS.

## Features

- **Nuxt 3**: Full-stack Vue framework
- **Vue 3**: Composition API and script setup
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **Auto-imports**: Components & composables auto-imported
- **Pinia**: State management with persistence
- **SSR/SSG**: Server-side rendering and static generation
- **File-based routing**: Automatic route generation
- **API routes**: Built-in API endpoints
- **i18n**: Internationalization support
- **SEO**: Built-in SEO optimization

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
\`\`\`

### Generate Static Site

\`\`\`bash
npm run generate
\`\`\`

### Preview Production Build

\`\`\`bash
npm run preview
\`\`\`

## Project Structure

\`\`\`
app/
├── pages/              # File-based routing
│   ├── index.vue      # Home page
│   ├── about.vue      # About page
│   └── posts/[id].vue # Dynamic route with params
├── components/         # Vue components
├── composables/        # Auto-imported composables
├── layouts/            # Layout components
├── middleware/         # Route middleware
├── plugins/            # Nuxt plugins
├── server/api/         # API routes
├── utils/              # Utility functions
├── assets/             # Static assets
├── types.ts            # TypeScript types
├── app.vue             # Root component
├── app.config.ts       # App configuration
└── nuxt.config.ts      # Nuxt configuration
\`\`\`

## Auto-imports

Nuxt 3 auto-imports:

- **Components**: \`~/components/*\`
- **Composables**: \`~/composables/*\`
- **Vue composables**: \`vue\`, \`pinia\`, \`@vueuse/nuxt\`
- **Utility functions**: \`useFetch\`, \`useAsyncData\`, \`useHead\`

No need to manually import!

\`\`\`vue
<script setup>
// No imports needed!
const { data } = await useFetch('/api/data')
</script>
\`\`\`

## Pages and Routing

File-based routing:

\`\`\`vue
<!-- app/pages/index.vue -->
<template>
  <h1>Home Page</h1>
</template>

<!-- app/pages/about.vue -->
<template>
  <h1>About Page</h1>
</template>

<!-- app/pages/posts/[id].vue -->
<template>
  <h1>Post {{ $route.params.id }}</h1>
</template>
\`\`\`

## Data Fetching

\`\`\`vue
<script setup lang="ts">
// Server-side data fetching
const { data } = await useAsyncData('posts', () => $fetch('/api/posts'))

// Client-side data fetching
const { data, pending } = useLazyAsyncData('user', () => $fetch('/api/user'))

// useFetch is convenient wrapper
const { data: time } = await useFetch('/api/time', {
  pick: ['timestamp', 'timezone']
})
</script>
\`\`\`

## API Routes

Create API routes in \`server/api/\`:

\`\`\`ts
// server/api/hello.get.ts
export default defineEventHandler((event) => {
  return { message: 'Hello World!' }
})

// server/api/users.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return { created: true }
})
\`\`\`

## State Management with Pinia

\`\`\`ts
// stores/useAuthStore.ts
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: ''
  }),
  actions: {
    setUser(user: User) {
      this.user = user
    }
  },
  persist: true
})
\`\`\`

## Internationalization

\`\`\`vue
<script setup>
const { t, locale } = useI18n()

const switchLocale = () => {
  locale.value = locale.value === 'en' ? 'es' : 'en'
}
</script>

<template>
  <p>{{ t('welcome') }}</p>
  <button @click="switchLocale">
    {{ locale === 'en' ? 'Español' : 'English' }}
  </button>
</template>
\`\`\`

## SEO Meta Tags

\`\`\`vue
<script setup lang="ts">
useSeoMeta({
  title: 'My Page',
  description: 'Page description',
  ogTitle: 'My Page',
  ogDescription: 'Page description',
  twitterCard: 'summary_large_image'
})
</script>
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

Deploy to any Node.js hosting:

- **Vercel**: Zero-config deployment
- **Netlify**: Full-stack support
- **AWS**: Elastic Beanstalk, EC2
- **DigitalOcean**: App Platform
- **Heroku**: (with buildpacks)

\`\`\`bash
# Build for production
npm run build

# Start production server
npm run preview
\`\`\`

## Learn More

- [Nuxt 3 Documentation](https://nuxt.com/docs)
- [Vue 3 Documentation](https://vuejs.org/)
- [Composition API](https://vuejs.org/guide/extras/composition-api-introduction.html)
- [Nuxt Modules](https://nuxt.com/modules)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Nuxt

# Dependencies stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
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
RUN adduser --system --uid 1001 nuxt

COPY --from=builder /app/package.json ./
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nuxt:nodejs /app/.nuxt ./.nuxt

USER nuxt

EXPOSE 3000

ENV PORT=3000
HOSTNAME="0.0.0.0"

CMD ["node", ".output/server/index.mjs"]
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
      - PORT=3000
      - NUXT_PUBLIC_SITE_URL=http://localhost:3000
    restart: unless-stopped
`;
  }
}
