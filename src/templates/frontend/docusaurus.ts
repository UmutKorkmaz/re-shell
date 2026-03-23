import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class DocusaurusTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Docusaurus config
    files.push({
      path: 'docusaurus.config.ts',
      content: this.generateDocusaurusConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Sidebars
    files.push({
      path: 'sidebars.ts',
      content: this.generateSidebars()
    });

    // Docs
    files.push({
      path: 'docs/intro.md',
      content: this.generateIntroDoc()
    });

    files.push({
      path: 'docs/getting-started.md',
      content: this.generateGettingStartedDoc()
    });

    files.push({
      path: 'docs/configuration.md',
      content: this.generateConfigurationDoc()
    });

    files.push({
      path: 'docs/components.md',
      content: this.generateComponentsDoc()
    });

    // Blog
    files.push({
      path: 'blog/2024-01-15-welcome/index.md',
      content: this.generateBlogPost()
    });

    // Src files
    files.push({
      path: 'src/css/custom.css',
      content: this.generateCustomCss()
    });

    files.push({
      path: 'src/components/HomepageFeatures/index.tsx',
      content: this.generateHomepageFeatures()
    });

    files.push({
      path: 'src/components/HomepageFeatures/styles.module.css',
      content: this.generateHomepageFeaturesStyles()
    });

    files.push({
      path: 'src/theme/Counter.tsx',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/theme/Counter.module.css',
      content: this.generateCounterStyles()
    });

    files.push({
      path: 'src/components/Badge.tsx',
      content: this.generateBadge()
    });

    files.push({
      path: 'src/components/Badge.module.css',
      content: this.generateBadgeStyles()
    });

    // Pages
    files.push({
      path: 'src/pages/index.tsx',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/pages/index.module.css',
      content: this.generateIndexStyles()
    });

    files.push({
      path: 'src/pages/markdown-page.md',
      content: this.generateMarkdownPage()
    });

    // Static files
    files.push({
      path: 'static/img/logo.svg',
      content: this.generateLogoSvg()
    });

    files.push({
      path: 'static/img/docusaurus.svg',
      content: this.generateDocusaurusSvg()
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

    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.0.0',
      private: true,
      scripts: {
        'docusaurus': 'docusaurus',
        'start': 'docusaurus start',
        'build': 'docusaurus build',
        'swizzle': 'docusaurus swizzle',
        'deploy': 'docusaurus deploy',
        'clear': 'docusaurus clear',
        'serve': 'docusaurus serve',
        'write-translations': 'docusaurus write-translations',
        'write-heading-ids': 'docusaurus write-heading-ids',
        'lint': 'eslint --ext .js,.jsx,.ts,.tsx src',
        'format': 'prettier --write "**/*.{js,jsx,ts,tsx,json,css,scss,md}"'
      },
      dependencies: {
        '@docusaurus/core': '^3.2.0',
        '@docusaurus/preset-classic': '^3.2.0',
        '@mdx-js/react': '^3.0.1',
        'clsx': '^2.1.0',
        'prism-react-renderer': '^2.3.1',
        'react': '^18.3.0',
        'react-dom': '^18.3.0'
      },
      devDependencies: {
        '@docusaurus/module-type-aliases': '^3.2.0',
        '@docusaurus/plugin-client-redirects': '^3.2.0',
        '@docusaurus/plugin-google-analytics': '^3.2.0',
        '@docusaurus/plugin-google-gtag': '^3.2.0',
        '@docusaurus/plugin-sitemap': '^3.2.0',
        '@docusaurus/theme-classic': '^3.2.0',
        '@docusaurus/theme-common': '^3.2.0',
        '@docusaurus/theme-live-codeblock': '^3.2.0',
        '@docusaurus/theme-search-algolia': '^3.2.0',
        '@tsconfig/docusaurus': '^2.0.2',
        '@types/react': '^18.2.55',
        '@types/react-dom': '^18.2.19',
        '@typescript-eslint/eslint-plugin': '^6.21.0',
        '@typescript-eslint/parser': '^6.21.0',
        'eslint': '^8.56.0',
        'eslint-config-prettier': '^9.1.0',
        'eslint-plugin-prettier': '^5.1.3',
        'eslint-plugin-react': '^7.33.2',
        'eslint-plugin-react-hooks': '^4.6.0',
        'prettier': '^3.2.5',
        'typescript': '^5.3.3'
      },
      engines: {
        node: '>=18.0'
      },
      browserslist: {
        production: [
          '>0.5%',
          'not dead',
          'not op_mini all'
        ],
        development: [
          'last 1 chrome version',
          'last 1 firefox version',
          'last 1 safari version'
        ]
      }
    };
  }

  private generateDocusaurusConfig() {
    return `import type { Config } from '@docusaurus/types';
import type { Options as PluginClientRedirects } from '@docusaurus/plugin-client-redirects';
import type { Options as PluginGoogleGTag } from '@docusaurus/plugin-google-gtag';
import type { Options as ThemeCommon } from '@docusaurus/theme-common';
import type { Options as PresetClassic } from '@docusaurus/preset-classic';

const config: Config = {
  title: '${this.context.name}',
  tagline: '${this.context.description || 'Dinosaurs are cool'}',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://your-docusaurus-site.example.com',
  // Set the /<baseUrl>/ to your site's trailing slash
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'your-username',
  projectName: '${this.context.normalizedName}',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/your-username/${this.context.normalizedName}/tree/main/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
          },
        },
        theme: {
          customCss: ['./src/css/custom.css'],
        },
      } satisfies PresetClassic.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: '${this.context.name}',
      logo: {
        alt: '${this.context.name} Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Tutorial',
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          href: 'https://github.com/your-username/${this.context.normalizedName}',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Tutorial',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/docusaurus',
            },
            {
              label: 'Discord',
              href: 'https://discordapp.com/invite/docusaurus',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/docusaurus',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/your-username/${this.context.normalizedName}',
            },
          ],
        },
      ],
      copyright: \`Copyright © \${new Date().getFullYear()} ${this.context.name || 'My Project'}. Built with Docusaurus.\`,
    },
    prism: {
      theme: {
        light: require('prism-react-renderer/themes/github'),
        dark: require('prism-react-renderer/themes/dracula'),
      },
      darkCodeTheme: require('prism-react-renderer/themes/dracula'),
      additionalLanguages: ['bash', 'diff', 'json', 'markdown', 'tsx', 'typescript'],
    },
  } satisfies ThemeCommon.Options,

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        createRedirects: function (existingPath) {
          // Redirect /docs to /docs/intro
          if (existingPath === '/docs') {
            return ['/docs/intro', '/docs/introduction'];
          }
          return undefined; // Return a falsy value: no redirect created
        },
      } satisfies PluginClientRedirects.Options,
    ],
    [
      '@docusaurus/plugin-google-gtag',
      {
        trackingID: 'G-XXXXXXXXXX',
        anonymizeIP: true,
      } satisfies PluginGoogleGTag.Options,
    ],
  ],

  // Add custom themes
  themes: [],
};

export default config;
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      extends: '@tsconfig/docusaurus/tsconfig.json',
      compilerOptions: {
        baseUrl: '.',
        allowSyntheticDefaultImports: true
      },
      include: ['**/*.ts', '**/*.tsx', '**/*.d.ts', '.docusaurus/*.ts.d.ts']
    }, null, 2);
  }

  private generateSidebars() {
    return `import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'getting-started',
    'configuration',
    'components',
  ],
};

export default sidebars;
`;
  }

  private generateIntroDoc() {
    return `---
sidebar_position: 1
slug: /
---

# Getting Started with ${this.context.name}

Welcome to ${this.context.name}! This tutorial will help you get started with your new Docusaurus site.

## Features

- ⚡️ **Fast** - Built with React and optimized for performance
- 📝 **MDX** - Write docs and blog posts with MDX
- 🎨 **Customizable** - Easy to customize with React components
- 🔍 **Search** - Built-in search functionality
- 🌙 **Dark Mode** - Automatic theme switching
- 📱 **Responsive** - Mobile-friendly design

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm start
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

---

## Interactive Demo

Try the counter component below:

<Counter />

## What's Next?

- Learn about [Getting Started](./getting-started.md)
- Check out [Configuration](./configuration.md)
- Explore [Components](./components.md)
`;
  }

  private generateGettingStartedDoc() {
    return `---
sidebar_position: 2
---

# Getting Started

This guide will help you get started with ${this.context.name} and Docusaurus.

## Prerequisites

- Node.js 18.0 or higher
- npm, yarn, or pnpm

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/${this.context.normalizedName}.git
cd ${this.context.normalizedName}

# Install dependencies
npm install
\`\`\`

## Development

\`\`\`bash
# Start development server
npm start
\`\`\`

Open \`http://localhost:3000\` in your browser.

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── blog/                # Blog posts
├── docs/                # Documentation
├── src/                 # React components and pages
│   ├── components/      # Reusable components
│   ├── css/             # Styles
│   ├── pages/           # Additional pages
│   └── theme/           # Theme customization
├── static/              # Static assets
├── docusaurus.config.ts # Docusaurus configuration
└── sidebars.ts          # Sidebar configuration
\`\`\`

## Creating Content

### Documentation

Create Markdown files in the \`docs\` directory:

\`\`\`md
---
title: My Page
sidebar_position: 3
---

# My Page

Content goes here...
\`\`\`

### Blog Posts

Create Markdown files in \`blog/YYYY-MM-DD-title/index.md\`:

\`\`\`md
---
slug: welcome
title: Welcome
authors: [your-name]
tags: [hello]
---

Welcome to my blog!
\`\`\`

### Using React Components

Use React components in your MDX files:

\`\`\`md
<Counter initialValue={5} />

<Badge type="info">New Feature</Badge>
\`\`\`

## Next Steps

- Learn about [Configuration](./configuration.md)
- Explore [Components](./components.md)
`;
  }

  private generateConfigurationDoc() {
    return `---
sidebar_position: 3
---

# Configuration

Learn how to configure your Docusaurus site.

## Docusaurus Config

The main configuration is in \`docusaurus.config.ts\`:

\`\`\`ts
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: '${this.context.name}',
  tagline: 'Your tagline',
  url: 'https://your-site.example.com',
  baseUrl: '/',

  // ...
};
\`\`\`

## Site Metadata

\`\`\`ts
{
  title: '${this.context.name}',           // Site title
  tagline: 'Your tagline',                 // Site tagline
  favicon: 'img/favicon.ico',              // Favicon
  url: 'https://your-site.example.com',    // Production URL
  baseUrl: '/',                            // Base URL
}
\`\`\`

## Navigation

Configure navbar and footer:

\`\`\`ts
themeConfig: {
  navbar: {
    title: '${this.context.name}',
    logo: { src: 'img/logo.svg' },
    items: [
      { type: 'doc', sidebarId: 'tutorialSidebar', label: 'Tutorial' },
      { to: '/blog', label: 'Blog' },
    ],
  },
  footer: {
    links: [
      {
        title: 'Docs',
        items: [{ label: 'Tutorial', to: '/docs/intro' }],
      },
    ],
  },
}
\`\`\`

## Sidebar

Configure sidebars in \`sidebars.ts\`:

\`\`\`ts
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'getting-started',
    'configuration',
  ],
};
\`\`\`

## Themes and Plugins

Add themes and plugins:

\`\`\`ts
{
  themes: ['@docusaurus/theme-live-codeblock'],
  plugins: [
    '@docusaurus/plugin-google-gtag',
    '@docusaurus/plugin-sitemap',
  ],
}
\`\`\`

## Styling

Customize styles in \`src/css/custom.css\`:

\`\`\`css
:root {
  --ifm-color-primary: #2196f3;
  --ifm-color-primary-dark: #1976d2;
}
\`\`\`

## Deployment

### GitHub Pages

\`\`\`bash
npm run deploy
\`\`\`

### Docker

\`\`\`bash
docker build -t ${this.context.normalizedName} .
docker run -p 3000:3000 ${this.context.normalizedName}
\`\`\`
`;
  }

  private generateComponentsDoc() {
    return `---
sidebar_position: 4
---

# Components

This page documents the custom React components available in ${this.context.name}.

## Counter Component

An interactive counter with increment, decrement, and reset functionality.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| initialValue | number | 0 | Initial counter value |
| min | number | 0 | Minimum value |
| max | number | 100 | Maximum value |

### Usage

\`\`\`mdx
<Counter initialValue={5} min={0} max={10} />
\`\`\`

### Example

<Counter initialValue={5} min={0} max={10} />

## Badge Component

A badge component for displaying status or information.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | - | Badge content |
| type | string | 'info' | Badge type: 'info', 'success', 'warning', 'danger' |

### Usage

\`\`\`mdx
<Badge type="info">New Feature</Badge>
<Badge type="success">Completed</Badge>
<Badge type="warning">Deprecated</Badge>
<Badge type="danger">Breaking</Badge>
\`\`\`

### Examples

<Badge type="info">New Feature</Badge>
<Badge type="success">Completed</Badge>
<Badge type="warning">Deprecated</Badge>
<Badge type="danger">Breaking</Badge>

## HomepageFeatures Component

Feature cards for the homepage.

### Usage

\`\`\`tsx
import HomepageFeatures from '@site/src/components/HomepageFeatures';

<HomepageFeatures />
\`\`\`

### Example

<HomepageFeatures />
`;
  }

  private generateBlogPost() {
    return `---
slug: welcome
title: Welcome to ${this.context.name}
authors: [${this.context.name || 'your-username'}]
tags: [welcome, announcement]
---

Welcome to ${this.context.name}! We're excited to announce the launch of our new documentation site.

## Why Docusaurus?

We chose Docusaurus because:

- ⚡️ **Fast** - Optimized performance
- 📝 **MDX** - Natural documentation workflow
- 🎨 **Customizable** - Easy to theme
- 🔍 **Search** - Built-in search
- 🌙 **Dark Mode** - Auto theme switching

## What's Next?

Stay tuned for more updates and tutorials!

## Getting Started

Check out the [Getting Started](/docs/getting-started) guide to begin.

---

## Interactive Demo

Try the counter:

<Counter initialValue={0} />

## Badge Examples

<Badge type="info">Info</Badge>
<Badge type="success">Success</Badge>
<Badge type="warning">Warning</Badge>
<Badge type="danger">Danger</Badge>
`;
  }

  private generateCustomCss() {
    return `/**
 * Any CSS included here will be global. The classic template
 * bundles Infima by default. Infima is a CSS framework designed to
 * work well for content-centric websites.
 */

/* You can override the default Infima variables here. */
:root {
  --ifm-color-primary: #25c2a0;
  --ifm-color-primary-dark: rgb(33, 175, 144);
  --ifm-color-primary-darker: rgb(31, 165, 136);
  --ifm-color-primary-darkest: rgb(26, 136, 112);
  --ifm-color-primary-light: rgb(70, 203, 174);
  --ifm-color-primary-lighter: rgb(92, 210, 183);
  --ifm-color-primary-lightest: rgb(120, 221, 195);
  --ifm-code-font-size: 95%;
}

/* Dark mode adjustments */
[data-theme='dark'] {
  --ifm-color-primary: #4ec9b0;
  --ifm-color-primary-dark: #25c2a0;
  --ifm-color-primary-darker: #21af90;
  --ifm-color-primary-darkest: #1a8f75;
  --ifm-color-primary-light: #70ddb9;
  --ifm-color-primary-lighter: #92e5c7;
  --ifm-color-primary-lightest: #b3f0d9;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--ifm-background-surface-color);
}

::-webkit-scrollbar-thumb {
  background: var(--ifm-color-primary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--ifm-color-primary-dark);
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Focus styles */
*:focus-visible {
  outline: 2px solid var(--ifm-color-primary);
  outline-offset: 2px;
}

/* Hero styles */
.hero {
  text-align: center;
  padding: 4rem 0;
}

.hero__title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.hero__subtitle {
  font-size: 1.25rem;
  color: var(--ifm-color-emphasis-600);
  margin-bottom: 2rem;
}

.hero__buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Code block styles */
.theme-code-block {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Table styles */
table {
  border-radius: 8px;
  overflow: hidden;
}

/* Admonition styles */
.admonition {
  border-radius: 8px;
}
`;
  }

  private generateHomepageFeatures() {
    return `import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: string;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Easy to Use',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: 'Docusaurus was designed from the ground up to be easily installed and used to get your website up and running quickly.',
  },
  {
    title: 'Focus on What Matters',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: 'Docusaurus lets you focus on your docs, and we will do the chores. Go ahead and move your content into the \`docs\` directory.',
  },
  {
    title: 'Powered by React',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: 'Extend or customize your website layout by reusing React. Docusaurus can be extended while reusing the same header and footer.',
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
`;
  }

  private generateHomepageFeaturesStyles() {
    return `.features {
  display: flex;
  align-items: center;
  padding: 2rem 0;
  width: 100%;
}

.featureSvg {
  height: 200px;
  width: 200px;
}
`;
  }

  private generateCounter() {
    return `import React, { useState } from 'react';
import clsx from 'clsx';
import styles from './Counter.module.css';

interface CounterProps {
  initialValue?: number;
  min?: number;
  max?: number;
}

export default function Counter({
  initialValue = 0,
  min = 0,
  max = 100,
}: CounterProps): JSX.Element {
  const [count, setCount] = useState(initialValue);

  const increment = () => {
    setCount((prev) => (prev < max ? prev + 1 : prev));
  };

  const decrement = () => {
    setCount((prev) => (prev > min ? prev - 1 : prev));
  };

  const reset = () => {
    setCount(initialValue);
  };

  return (
    <div className={styles.counter}>
      <div className={styles.display}>{count}</div>
      <div className={styles.controls}>
        <button
          className={clsx(styles.button, styles.decrement)}
          onClick={decrement}
          disabled={count <= min}
        >
          −
        </button>
        <button
          className={clsx(styles.button, styles.reset)}
          onClick={reset}
        >
          Reset
        </button>
        <button
          className={clsx(styles.button, styles.increment)}
          onClick={increment}
          disabled={count >= max}
        >
          +
        </button>
      </div>
      <div className={styles.info}>
        <span>Min: {min}</span>
        <span>Max: {max}</span>
      </div>
    </div>
  );
}
`;
  }

  private generateBadge() {
    return `import React from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

interface BadgeProps {
  children: React.ReactNode;
  type?: 'info' | 'success' | 'warning' | 'danger';
}

export default function Badge({
  children,
  type = 'info',
}: BadgeProps): JSX.Element {
  return (
    <span className={clsx(styles.badge, styles[\`badge--\${type}\`])}>
      {children}
    </span>
  );
}
`;
  }

  private generateCounterStyles() {
    return `.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  border: 2px solid var(--ifm-color-emphasis-200);
  border-radius: 0.75rem;
  background: var(--ifm-background-surface-color);
}

.display {
  font-size: 4rem;
  font-weight: 700;
  color: var(--ifm-color-primary);
  font-variant-numeric: tabular-nums;
}

.controls {
  display: flex;
  gap: 1rem;
}

.button {
  padding: 0.75rem 1.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  border: 2px solid var(--ifm-color-emphasis-200);
  border-radius: 0.5rem;
  background: var(--ifm-background-color);
  color: var(--ifm-color-emphasis-900);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--ifm-color-primary);
    color: #fff;
    border-color: var(--ifm-color-primary);
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.increment {
  background: var(--ifm-color-primary);
  color: #fff;
  border-color: var(--ifm-color-primary);

  &:hover:not(:disabled) {
    background: var(--ifm-color-primary-dark);
    border-color: var(--ifm-color-primary-dark);
  }
}

.decrement {
  background: var(--ifm-color-danger);
  color: #fff;
  border-color: var(--ifm-color-danger);

  &:hover:not(:disabled) {
    background: var(--ifm-color-danger-dark);
    border-color: var(--ifm-color-danger-dark);
  }
}

.reset {
  &:hover:not(:disabled) {
    background: var(--ifm-color-emphasis-100);
  }
}

.info {
  display: flex;
  gap: 1rem;
  color: var(--ifm-color-emphasis-600);
}
`;
  }

  private generateBadgeStyles() {
    return `.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 1rem;
  white-space: nowrap;
}

.badge--info {
  background: var(--ifm-color-info-contrast-background);
  color: var(--ifm-color-info-contrast-foreground);
  border: 1px solid var(--ifm-color-info-dark);
}

.badge--success {
  background: var(--ifm-color-success-contrast-background);
  color: var(--ifm-color-success-contrast-foreground);
  border: 1px solid var(--ifm-color-success-dark);
}

.badge--warning {
  background: var(--ifm-color-warning-contrast-background);
  color: var(--ifm-color-warning-contrast-foreground);
  border: 1px solid var(--ifm-color-warning-dark);
}

.badge--danger {
  background: var(--ifm-color-danger-contrast-background);
  color: var(--ifm-color-danger-contrast-foreground);
  border: 1px solid var(--ifm-color-danger-dark);
}
`;
  }

  private generateIndexPage() {
    return `import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Counter from '@site/src/theme/Counter';
import Badge from '@site/src/components/Badge';

export default function Homepage(): JSX.Element {
  return (
    <Layout
      title=\${'Home'}
      description="${this.context.description || 'Description will go into a meta tag in <head />'}"
    >
      <main>
        <div className={"container margin-top--lg margin-bottom--xl"}>
          <div className={"row"}>
            <div className={"col col--6 col--offset-3"}>
              <Heading as="h1" className={"hero__title"}>
                Welcome to ${this.context.name}
              </Heading>
              <p className={"hero__subtitle"}>
                ${this.context.description || 'A modern documentation site built with Docusaurus'}
              </p>
              <div className={"hero__buttons"}>
                <a
                  className={"button button--primary button--lg"}
                  href="/docs/intro"
                >
                  Get Started
                </a>
                <a
                  className={"button button--secondary button--lg"}
                  href="/docs/getting-started"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>

        <HomepageFeatures />

        <div className={"container margin-top--xl margin-bottom--xl"}>
          <div className={"row"}>
            <div className={"col col--6 col--offset-3"}>
              <Heading as="h2" id="interactive-demo">
                Interactive Demo
              </Heading>
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <Counter initialValue={0} />
              </div>
            </div>
          </div>

          <div className={"row margin-top--lg"}>
            <div className={"col col--6 col--offset-3"}>
              <Heading as="h2" id="badge-examples">
                Badge Examples
              </Heading>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Badge type="info">New Feature</Badge>
                <Badge type="success">Completed</Badge>
                <Badge type="warning">Deprecated</Badge>
                <Badge type="danger">Breaking</Badge>
              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
`;
  }

  private generateIndexStyles() {
    return `.hero {
  text-align: center;
  padding: 4rem 0;
}

.hero__title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  background: linear-gradient(120deg, #25c2a0, #2196f3);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero__subtitle {
  font-size: 1.25rem;
  color: var(--ifm-color-emphasis-600);
  margin-bottom: 2rem;
}

.hero__buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 996px) {
  .hero__title {
    font-size: 2rem;
  }

  .hero__subtitle {
    font-size: 1rem;
  }
}
`;
  }

  private generateMarkdownPage() {
    return `---
title: Markdown page example
---

# Markdown page example

You don't need React to write simple standalone pages.

## Interactive Components

<Counter initialValue={10} />

## Badges

<Badge type="info">Info</Badge>
<Badge type="success">Success</Badge>
<Badge type="warning">Warning</Badge>
<Badge type="danger">Danger</Badge>

## Code Blocks

\`\`\`js
function hello() {
  console.log('Hello, world!');
}
\`\`\`
`;
  }

  private generateLogoSvg() {
    return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="90" fill="#25c2a0" opacity="0.2"/>
  <circle cx="100" cy="100" r="70" fill="#25c2a0" opacity="0.4"/>
  <circle cx="100" cy="100" r="50" fill="#25c2a0"/>
  <text x="100" y="110" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="white" text-anchor="middle">
    ${this.context.name.charAt(0).toUpperCase()}
  </text>
</svg>
`;
  }

  private generateDocusaurusSvg() {
    return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="160" height="160" rx="20" fill="#25c2a0"/>
  <text x="100" y="90" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
    Built with
  </text>
  <text x="100" y="130" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">
    Docusaurus
  </text>
</svg>
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A modern documentation site built with [Docusaurus](https://docusaurus.io/).

## Features

- ⚡️ **Fast Performance** - Optimized for speed
- 📝 **MDX Support** - Write docs with Markdown + React
- 🎨 **Customizable** - Easy to theme and customize
- 🔍 **Search** - Built-in search functionality
- 🌙 **Dark Mode** - Automatic theme switching
- 📱 **Responsive** - Mobile-friendly design
- 🔧 **TypeScript** - Full TypeScript support
- 🚀 **Easy Deployment** - Deploy to GitHub Pages, Netlify, Vercel, etc.

## Quick Start

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm start
\`\`\`

Open \`http://localhost:3000\` to view the site.

### Build

\`\`\`bash
npm run build
\`\`\`

### Serve

\`\`\`bash
npm run serve
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── blog/                # Blog posts
├── docs/                # Documentation
├── src/                 # React components and pages
│   ├── components/      # Reusable components
│   ├── css/             # Global styles
│   ├── pages/           # Additional pages
│   └── theme/           # Theme customization
├── static/              # Static assets (images, etc.)
├── docusaurus.config.ts # Docusaurus configuration
├── sidebars.ts          # Sidebar configuration
├── package.json
└── README.md
\`\`\`

## Customization

### Configuration

Edit \`docusaurus.config.ts\` to customize:

- Site metadata (title, tagline, favicon)
- Navigation (navbar, footer)
- Theme settings
- Plugins

### Styling

Customize styles in \`src/css/custom.css\`:

\`\`\`css
:root {
  --ifm-color-primary: #25c2a0;
}
\`\`\`

### Components

Add custom React components in \`src/components/\`:

\`\`\`tsx
export default function MyComponent() {
  return <div>Hello World</div>;
}
\`\`\`

Use components in MDX:

\`\`\`md
<MyComponent />
\`\`\`

## Documentation

For more information, visit the [Docusaurus documentation](https://docusaurus.io/docs).

## Deployment

### GitHub Pages

\`\`\`bash
npm run deploy
\`\`\`

### Docker

\`\`\`bash
docker build -t ${this.context.normalizedName} .
docker run -p 3000:3000 ${this.context.normalizedName}
\`\`\`

Or use Docker Compose:

\`\`\`bash
docker-compose up -d
\`\`\`

## License

MIT

---

Generated with [Re-Shell CLI](https://github.com/your-org/re-shell)
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Docusaurus site

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  ${this.context.normalizedName}:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    labels:
      - "com.${this.context.normalizedName}.description=${this.context.name} Documentation"
      - "com.${this.context.normalizedName}.version=1.0.0"
`;
  }
}

