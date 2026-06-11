// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const GITHUB_REPO = 'https://github.com/UmutKorkmaz/re-shell';

// https://astro.build/config
export default defineConfig({
  site: 'https://umutkorkmaz.github.io',
  base: '/re-shell',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    starlight({
      title: 'Re-Shell',
      tagline: 'Full-stack platform: microfrontends + microservices, one CLI.',
      description:
        'Re-Shell unites microfrontends and polyglot microservices under one CLI — 205 templates across 36 languages, a hardened web dashboard, and a typed JSON contract.',
      logo: {
        src: './src/assets/logo.svg',
        alt: 'Re-Shell',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/theme.css'],
      pagefind: true,
      social: [
        { icon: 'github', label: 'GitHub', href: GITHUB_REPO },
        {
          icon: 'npm',
          label: 'npm',
          href: 'https://www.npmjs.com/package/@re-shell/cli',
        },
      ],
      editLink: {
        baseUrl: `${GITHUB_REPO}/edit/main/site/`,
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Install', slug: 'getting-started/install' },
            { label: 'Quickstart', slug: 'getting-started/quickstart' },
            { label: 'Core Concepts', slug: 'getting-started/concepts' },
          ],
        },
        {
          label: 'CLI Reference',
          items: [
            { label: 'Overview', slug: 'cli/overview' },
            { label: 'find', slug: 'cli/find' },
            { label: 'workspace', slug: 'cli/workspace' },
            { label: 'templates', slug: 'cli/templates' },
            { label: 'generate', slug: 'cli/generate' },
            { label: 'doctor & analyze', slug: 'cli/doctor-analyze' },
            { label: 'completion', slug: 'cli/completion' },
            { label: 'ai', slug: 'cli/ai' },
            { label: 'agents (AGENTS.md)', slug: 'cli/agents' },
            { label: 'api', slug: 'cli/api' },
            { label: 'service & bridge', slug: 'cli/service-bridge' },
            { label: 'k8s / Helm / GitOps', slug: 'cli/k8s-helm-gitops' },
            { label: 'cloud', slug: 'cli/cloud' },
            { label: 'observe', slug: 'cli/observe' },
            { label: 'security', slug: 'cli/security' },
            { label: 'data', slug: 'cli/data' },
            { label: 'collab & learn', slug: 'cli/collab-learn' },
            { label: 'plugin', slug: 'cli/plugin' },
            { label: 'tools / config / quality', slug: 'cli/tools-config-quality' },
          ],
        },
        {
          label: 'Concepts & Integration',
          items: [
            { label: 'JSON Contract', slug: 'contract/json-contract' },
            { label: 'Dashboard', slug: 'dashboard/overview' },
            { label: 'Assistant Panel', slug: 'dashboard/assistant' },
            { label: 'Template Catalog', slug: 'templates/catalog' },
            { label: 'Compatibility Matrix', slug: 'templates/matrix' },
            { label: 'MCP Server (AI agents)', slug: 'integrations/mcp' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Monorepo', slug: 'architecture/monorepo' },
            { label: 'Contracts Package', slug: 'architecture/contracts-package' },
            { label: 'Secure Hub', slug: 'architecture/secure-hub' },
          ],
        },
        {
          label: 'Roadmap',
          items: [{ label: 'Roadmap', slug: 'roadmap' }],
        },
      ],
    }),
  ],
});
