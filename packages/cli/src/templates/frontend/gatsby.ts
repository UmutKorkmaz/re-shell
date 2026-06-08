import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class GatsbyTemplate extends BaseTemplate {
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

    // Gatsby config
    files.push({
      path: 'gatsby-config.ts',
      content: this.generateGatsbyConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // GraphQL config
    files.push({
      path: 'gatsby-node.ts',
      content: this.generateGatsbyNode()
    });

    // SSR config
    files.push({
      path: 'gatsby-ssr.ts',
      content: this.generateGatsbySSR()
    });

    // Browser config
    files.push({
      path: 'gatsby-browser.ts',
      content: this.generateGatsbyBrowser()
    });

    // Types
    files.push({
      path: 'src/types.ts',
      content: this.generateTypes()
    });

    // Pages
    files.push({
      path: 'src/pages/index.tsx',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/pages/about.tsx',
      content: this.generateAboutPage()
    });

    // Templates
    files.push({
      path: 'src/templates/blog-post.tsx',
      content: this.generateBlogPostTemplate()
    });

    // Components
    files.push({
      path: 'src/components/layout.tsx',
      content: this.generateLayout()
    });

    files.push({
      path: 'src/components/seo.tsx',
      content: this.generateSEOComponent()
    });

    // Hooks
    files.push({
      path: 'src/hooks/use-theme.ts',
      content: this.generateThemeHook()
    });

    // GraphQL queries
    files.push({
      path: 'src/queries/useBlogPosts.ts',
      content: this.generateBlogPostsQuery()
    });

    // Styles
    files.push({
      path: 'src/styles/global.css',
      content: this.generateGlobalStyles()
    });

    // Sample data
    files.push({
      path: 'content/posts/hello-world.md',
      content: this.generateSamplePost()
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
      version: '1.0.0',
      private: true,
      scripts: {
        develop: 'gatsby develop',
        start: 'gatsby serve',
        build: 'gatsby build',
        clean: 'gatsby clean',
        typecheck: 'tsc --noEmit'
      },
      dependencies: {
        'gatsby': '^5.13.0',
        'gatsby-plugin-image': '^3.13.0',
        'gatsby-plugin-manifest': '^5.13.0',
        'gatsby-plugin-offline': '^6.13.0',
        'gatsby-plugin-sharp': '^5.13.0',
        'gatsby-source-filesystem': '^5.13.0',
        'gatsby-transformer-json': '^5.13.0',
        'gatsby-transformer-remark': '^7.13.0',
        'gatsby-transformer-sharp': '^5.13.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        '@types/react': '^18.2.48',
        '@types/react-dom': '^18.2.18',
        'typescript': '^5.3.3'
      }
    };
  }

  protected generateGatsbyConfig() {
    return `import type { GatsbyConfig } from 'gatsby';

const config: GatsbyConfig = {
  siteMetadata: {
    title: '${this.context.name}',
    siteUrl: 'https://www.yourdomain.tld',
    description: '${this.context.description}',
  },
  graphqlTypegen: true,
  plugins: [
    'gatsby-plugin-image',
    'gatsby-plugin-manifest',
    'gatsby-plugin-offline',
    'gatsby-plugin-sharp',
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'images',
        path: './src/images',
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'posts',
        path: './content/posts',
      },
    },
    'gatsby-transformer-json',
    {
      resolve: 'gatsby-transformer-remark',
      options: {
        plugins: [
          'gatsby-remark-images',
          'gatsby-remark-copy-linked-files',
          'gatsby-remark-smartypants',
        ],
      },
    },
    'gatsby-transformer-sharp',
  ],
};

export default config;
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compilerOptions: {
        target: 'es2020',
        module: 'esnext',
        lib: ['dom', 'dom.iterable', 'esnext'],
        jsx: 'react',
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        moduleResolution: 'node',
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        isolatedModules: true,
        allowSyntheticDefaultImports: true
      },
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['node_modules']
    }, null, 2);
  }

  protected generateGatsbyNode() {
    return `import type { GatsbyNode } from 'gatsby';
import { createFilePath } from 'gatsby-source-filesystem';

export const onCreateNode: GatsbyNode['onCreateNode'] = async ({
  node,
  actions,
  getNode,
  createNodeId,
}) => {
  const { createNodeField } = actions;

  if (node.internal.type === \`MarkdownRemark\`) {
    const value = createFilePath({ node, getNode });
    createNodeField({
      name: 'slug',
      node,
      value: \`/blog\${value}\`,
    });
  }
};

export const createPages: GatsbyNode['createPages'] = async ({ graphql, actions, createPage }) => {
  const { createRedirect } = actions;

  // Create redirects if needed
  createRedirect({
    fromPath: '/old-url',
    toPath: '/new-url',
    isPermanent: true,
  });
};
`;
  }

  protected generateGatsbySSR() {
    return `import * as React from 'react';
import type { GatsbySSRProps } from 'gatsby';

export const wrapPageElement: GatsbySSRProps['wrapPageElement'] = ({
  element,
  props,
}) => {
  return <>{element}</>;
};

export const wrapRootElement: GatsbySSRProps['wrapRootElement'] = ({
  element,
}) => {
  return <>{element}</>;
};
`;
  }

  protected generateGatsbyBrowser() {
    return `import * as React from 'react';
import type { GatsbyBrowserProps } from 'gatsby';

export const wrapPageElement: GatsbyBrowserProps['wrapPageElement'] = ({
  element,
  props,
}) => {
  return <>{element}</>;
};

export const wrapRootElement: GatsbyBrowserProps['wrapRootElement'] = ({
  element,
}) => {
  return <>{element}</>;
};
`;
  }

  protected generateTypes() {
    return `export interface SiteMetadata {
  title: string;
  siteUrl: string;
  description: string;
}

export interface MarkdownRemark {
  id: string;
  html: string;
  frontmatter: {
    title: string;
    date: string;
    description?: string;
  };
  fields: {
    slug: string;
  };
}

export interface BlogPost {
  node: {
    id: string;
    frontmatter: {
      title: string;
      date: string;
      description?: string;
    };
    fields: {
      slug: string;
    };
    excerpt: string;
  };
}
`;
  }

  protected generateIndexPage() {
    return `import * as React from 'react';
import { graphql, Link } from 'gatsby';
import Layout from '../components/layout';
import SEO from '../components/seo';
import { useBlogPosts } from '../queries/useBlogPosts';

const IndexPage = () => {
  const posts = useBlogPosts();

  return (
    <Layout>
      <SEO title="Home" />
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-4xl font-bold mb-8">Welcome to ${this.context.name}</h1>

        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-4">Latest Posts</h2>
          <div className="grid gap-6">
            {posts.map(({ node }) => (
              <article key={node.id} className="border p-6 rounded-lg">
                <Link to={node.fields.slug}>
                  <h3 className="text-2xl font-medium text-primary hover:underline">
                    {node.frontmatter.title}
                  </h3>
                </Link>
                <p className="text-gray-600 mt-2">{node.frontmatter.date}</p>
                <p className="mt-4">{node.frontmatter.description || node.excerpt}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-semibold mb-4">Features</h2>
          <ul className="space-y-2">
            <li>✅ GraphQL for data queries</li>
            <li>✅ Static Site Generation (SSG)</li>
            <li>✅ Plugin ecosystem</li>
            <li>✅ Image optimization</li>
            <li>✅ PWA support</li>
            <li>✅ Type-safe with TypeScript</li>
          </ul>
        </section>
      </div>
    </Layout>
  );
};

export default IndexPage;

export const query = graphql\`
  query {
    allMarkdownRemark(sort: { frontmatter: { date: DESC } }) {
      edges {
        node {
          id
          excerpt
          frontmatter {
            title
            date
            description
          }
          fields {
            slug
          }
        }
      }
    }
  }
\`;
`;
  }

  protected generateAboutPage() {
    return `import * as React from 'react';
import Layout from '../components/layout';
import SEO from '../components/seo';

const AboutPage = () => {
  return (
    <Layout>
      <SEO title="About" />
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-4xl font-bold mb-6">About ${this.context.name}</h1>

        <div className="prose max-w-none">
          <p className="text-lg mb-4">
            This is a Gatsby site built with TypeScript, GraphQL, and modern web technologies.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Tech Stack</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Gatsby 5</strong> - Static site generator</li>
            <li><strong>React 18</strong> - UI library</li>
            <li><strong>TypeScript</strong> - Type safety</li>
            <li><strong>GraphQL</strong> - Data queries</li>
            <li><strong>Tailwind CSS</strong> - Styling</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Features</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Static Site Generation for performance</li>
            <li>GraphQL queries for data fetching</li>
            <li>Image optimization with gatsby-plugin-image</li>
            <li>PWA support for offline functionality</li>
            <li>Type-safe development with TypeScript</li>
            <li>Rich plugin ecosystem</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default AboutPage;
`;
  }

  protected generateBlogPostTemplate() {
    return `import * as React from 'react';
import { graphql, Link } from 'gatsby';
import Layout from '../components/layout';
import SEO from '../components/seo';

interface BlogPostTemplateProps {
  data: {
    markdownRemark: {
      html: string;
      frontmatter: {
        title: string;
        date: string;
        description?: string;
      };
      fields: {
        slug: string;
      };
    };
  };
}

const BlogPostTemplate: React.FC<BlogPostTemplateProps> = ({ data }) => {
  const post = data.markdownRemark;

  return (
    <Layout>
      <SEO title={post.frontmatter.title} description={post.frontmatter.description} />
      <div className="max-w-3xl mx-auto p-8">
        <Link to="/blog" className="text-primary hover:underline">
          ← Back to posts
        </Link>

        <article className="mt-6">
          <h1 className="text-4xl font-bold mb-4">{post.frontmatter.title}</h1>
          <p className="text-gray-600 mb-8">{post.frontmatter.date}</p>

          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />
        </article>
      </div>
    </Layout>
  );
};

export default BlogPostTemplate;

export const query = graphql\`
  query BlogPostBySlug($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      html
      frontmatter {
        title
        date
        description
      }
      fields {
        slug
      }
    }
  }
\`;
`;
  }

  protected generateLayout() {
    return `import * as React from 'react';
import { Link } from 'gatsby';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <nav className="border-b">
        <div className="max-w-4xl mx-auto px-8 py-4">
          <div className="flex gap-6">
            <Link to="/" className="text-primary hover:underline">
              Home
            </Link>
            <Link to="/about" className="text-primary hover:underline">
              About
            </Link>
            <Link to="/blog" className="text-primary hover:underline">
              Blog
            </Link>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-8 py-6 text-center text-gray-600">
          © {new Date().getFullYear()} ${this.context.name}. Built with Gatsby.
        </div>
      </footer>
    </>
  );
};

export default Layout;
`;
  }

  protected generateSEOComponent() {
    return `import * as React from 'react';
import type { PageProps } from 'gatsby';

interface SEOProps {
  title?: string;
  description?: string;
  pathname?: string;
}

const SEO: React.FC<SEOProps> = ({ title, description = '', pathname }) => {
  const siteTitle = '${this.context.name}';
  const fullTitle = title ? \`\${title} | \${siteTitle}\` : siteTitle;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {pathname && <meta property="og:url" content={pathname} />}
    </>
  );
};

export default SEO;
`;
  }

  protected generateThemeHook() {
    return `import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return { theme, toggleTheme };
};
`;
  }

  protected generateBlogPostsQuery() {
    return `import { useStaticQuery, graphql } from 'gatsby';

export const useBlogPosts = () => {
  const data = useStaticQuery(
    graphql\`
      query {
        allMarkdownRemark(sort: { frontmatter: { date: DESC } }) {
          edges {
            node {
              id
              excerpt
              frontmatter {
                title
                date
                description
              }
              fields {
                slug
              }
            }
          }
        }
      }
    \`
  );

  return data.allMarkdownRemark.edges;
};
`;
  }

  protected generateGlobalStyles() {
    return `@tailwind base;
@tailwind components;
@ailwind utilities;

body {
  @apply bg-gray-50 text-gray-900;
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

/* Typography */
.prose {
  @apply max-w-none;
}

.prose h1 {
  @apply text-3xl font-bold mb-4;
}

.prose h2 {
  @apply text-2xl font-semibold mt-8 mb-4;
}

.prose p {
  @apply mb-4 leading-relaxed;
}

.prose a {
  @apply text-primary hover:underline;
}
`;
  }

  protected generateSamplePost() {
    return `---
title: Hello World
date: 2024-01-15
description: Welcome to the first post on this Gatsby blog!
---

# Hello World

This is the first post on your new Gatsby blog. You can edit this file or add new posts in the \`content/posts\` directory.

## Getting Started with Gatsby

Gatsby is a powerful static site generator that combines:

- GraphQL for data queries
- React components
- Markdown for content
- Static site generation for performance

## Adding New Posts

Create new markdown files in \`content/posts/\` with frontmatter:

\`\`\`markdown
---
title: Your Post Title
date: 2024-01-15
description: Post description
---

Your content here...
\`\`\`

## GraphQL Queries

Use GraphQL queries to fetch data in your pages and components:

\`\`\`graphql
query {
  allMarkdownRemark {
    edges {
      node {
        html
        frontmatter {
          title
          date
        }
      }
    }
  }
}
\`\`\`

Happy blogging! 🚀
`;
  }

  protected generateEnvExample() {
    return `# Site Configuration
SITE_URL=https://www.yourdomain.tld
GATSBY_DISQUS_SHORTNAME=your-disqus-shortname

# Analytics
GATSBY_GA_TRACKING_ID=your-ga-id

# Contentful CMS (optional)
CONTENTFUL_SPACE_ID=your-space-id
CONTENTFUL_ACCESS_TOKEN=your-access-token
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Gatsby 5, GraphQL, TypeScript, and a rich plugin ecosystem.

## Features

- **Gatsby 5**: Latest static site generator
- **GraphQL**: Type-safe data queries
- **Static Site Generation**: Blazing fast performance
- **Plugin Ecosystem**: Rich plugin support
- **Image Optimization**: Automatic image optimization
- **PWA**: Progressive Web App support
- **TypeScript**: Type-safe development

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
npm run develop
# or
yarn develop
# or
pnpm develop
\`\`\`

Open [http://localhost:8000](http://localhost:8000) in your browser.

### Build

\`\`\`bash
npm run build
\`\`\`

### Serve Production Build

\`\`\`bash
npm run start
\`\`\`

## Project Structure

\`\`\`
src/
├── pages/              # File-based routing
│   ├── index.tsx       # Home page
│   └── about.tsx       # About page
├── templates/          # Page templates
│   └── blog-post.tsx  # Blog post template
├── components/         # React components
│   ├── layout.tsx     # Site layout
│   └── seo.tsx        # SEO component
├── hooks/             # Custom React hooks
├── queries/           # GraphQL queries
├── styles/            # Global styles
└── types.ts           # TypeScript types

content/posts/          # Markdown blog posts
gatsby-config.ts       # Gatsby configuration
gatsby-node.ts         # Node APIs
gatsby-browser.ts      # Browser APIs
gatsby-ssr.ts          # SSR APIs
\`\`\`

## GraphQL Data Queries

Query data in your pages and components:

\`\`\`graphql
export const query = graphql\`
  query {
    allMarkdownRemark {
      edges {
        node {
          html
          frontmatter {
            title
            date
          }
        }
      }
    }
  }
\`;
\`\`\`

## Creating Content

Add markdown files to \`content/posts/\`:

\`\`\`markdown
---
title: Your Post Title
date: 2024-01-15
description: Post description
---

Your content here...
\`\`\`

## Gatsby Plugins

This template includes:

- **gatsby-plugin-image**: Optimized images
- **gatsby-plugin-manifest**: Web app manifest
- **gatsby-plugin-offline**: Service worker for PWA
- **gatsby-source-filesystem**: Filesystem source
- **gatsby-transformer-remark**: Markdown processing
- **gatsby-transformer-sharp**: Image transformations

## Adding Plugins

Add plugins to \`gatsby-config.ts\`:

\`\`\`ts
plugins: [
  'gatsby-plugin-your-plugin',
  {
    resolve: 'gatsby-plugin-other',
    options: {
      // configuration
    },
  },
]
\`\`\`

## Docker

### Build

\`\`\`bash
docker build -t ${this.context.normalizedName} .
\`\`\`

### Run

\`\`\`bash
docker run -p 8000:8000 ${this.context.normalizedName}
\`\`\`

### Docker Compose

\`\`\`bash
docker-compose up
\`\`\`

## Deployment

Gatsby sites can be deployed to:

- **Netlify**: Zero-config deployment
- **Vercel**: Preview deployments
- **GitHub Pages**: Static hosting
- **AWS S3 + CloudFront**: CDN delivery
- **Any static host**: HTML/CSS/JS files

\`\`\`bash
# Build for production
npm run build

# Deploy the public/ directory
\`\`\`

## Learn More

- [Gatsby Documentation](https://www.gatsbyjs.com/docs/)
- [GraphQL in Gatsby](https://www.gatsbyjs.com/docs/graphql-reference/)
- [Plugin Library](https://www.gatsbyjs.com/plugins/)
- [Gatsby Tutorial](https://www.gatsbyjs.com/docs/tutorial/)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Gatsby

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
RUN adduser --system --uid 1001 gatsby

COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

USER gatsby

EXPOSE 8000

ENV PORT=8000
HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - PORT=8000
    restart: unless-stopped
`;
  }
}
