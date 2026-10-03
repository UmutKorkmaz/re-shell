import { describe, expect, it } from 'vitest';
import {
  createFrontendTemplate,
  hasFrontendTemplate,
  listFrontendTemplateIds,
} from '../../src/templates/frontend/registry';
import { SUPPORTED_FRAMEWORKS, getFrameworkConfig } from '../../src/utils/framework';
import type { TemplateContext } from '../../src/templates/index';

function contextFor(framework: string): TemplateContext {
  return {
    name: 'demo',
    normalizedName: 'demo',
    framework,
    hasTypeScript: Boolean(SUPPORTED_FRAMEWORKS[framework]?.hasTypeScript),
    port: '5173',
    route: '/demo',
    org: 're-shell',
    description: 'demo app',
    packageManager: 'pnpm',
  };
}

describe('frontend template registry', () => {
  it('has a scaffold template for every supported framework except those explicitly missing one', () => {
    const missing = Object.keys(SUPPORTED_FRAMEWORKS).filter(id => !hasFrontendTemplate(id));
    // vue-storefront is registered as a framework config but has no template yet;
    // it must be rejected, never scaffolded as React.
    expect(missing).toEqual(['vue-storefront']);
  });

  it('only lists ids that are real framework configs', () => {
    for (const id of listFrontendTemplateIds()) {
      expect(SUPPORTED_FRAMEWORKS[id], id).toBeDefined();
    }
  });

  it('does not report Object.prototype keys as templates', () => {
    expect(hasFrontendTemplate('constructor')).toBe(false);
    expect(hasFrontendTemplate('toString')).toBe(false);
  });

  it('renders a runnable app (package.json + entry + html) for the core frameworks', async () => {
    for (const id of ['react', 'react-ts', 'vue', 'vue-ts', 'svelte', 'svelte-ts']) {
      const files = await createFrontendTemplate(getFrameworkConfig(id), contextFor(id)).generateFiles();
      const paths = files.map(f => f.path);
      expect(paths, id).toContain('package.json');
      // Vite serves the app from a root index.html (a public/index.html is not an entry).
      expect(paths, id).toContain('index.html');
      expect(paths, id).not.toContain('public/index.html');
      const pkg = JSON.parse(files.find(f => f.path === 'package.json')!.content);
      expect(pkg.scripts.dev, id).toBeTruthy();
      expect(pkg.scripts.build, id).toBeTruthy();
    }
  });

  it('refuses a framework with no template instead of falling back to React', () => {
    const config = { ...getFrameworkConfig('react'), name: 'vue-storefront' };
    expect(() => createFrontendTemplate(config, contextFor('vue-storefront'))).toThrow(
      /No scaffold template for frontend framework "vue-storefront"/
    );
  });
});
