import { FrameworkConfig } from '../utils/framework';

export interface TemplateContext {
  name: string;
  normalizedName: string;
  framework: string;
  hasTypeScript: boolean;
  port: string;
  route?: string;
  org: string;
  team?: string;
  description: string;
  packageManager: string;
}

export interface TemplateFile {
  path: string;
  content: string;
  executable?: boolean;
}

export abstract class BaseTemplate {
  protected framework: FrameworkConfig;
  protected context: TemplateContext;

  constructor(framework: FrameworkConfig, context: TemplateContext) {
    this.framework = framework;
    this.context = context;
  }

  abstract generateFiles(): Promise<TemplateFile[]>;

  protected generatePackageJson(): any {
    const { normalizedName, org, description, port } = this.context;
    
    return {
      name: `@${org.toLowerCase()}/${normalizedName}`,
      version: '0.1.0',
      description,
      main: 'dist/index.js',
      scripts: {
        ...this.framework.scripts,
        dev: this.framework.scripts.dev.replace('vite', `vite --port ${port}`)
      },
      dependencies: this.framework.dependencies,
      devDependencies: this.framework.devDependencies,
      keywords: [
        'microfrontend',
        this.framework.name,
        're-shell'
      ],
      author: this.context.team || this.context.org,
      license: 'MIT',
      reshell: {
        framework: this.framework.name,
        route: this.context.route,
        port: parseInt(port)
      }
    };
  }

  protected generateViteConfig(): string {
    const { normalizedName, port, hasTypeScript } = this.context;
    // Vue and Svelte use .ts, others use .tsx for TypeScript
    const entryExt = this.framework.name.includes('vue') || this.framework.name.includes('svelte')
      ? (hasTypeScript ? 'ts' : 'js')
      : (hasTypeScript ? 'tsx' : 'jsx');

    let plugins = '';
    let imports = '';

    switch (this.framework.name) {
      case 'react':
      case 'react-ts':
        imports = "import react from '@vitejs/plugin-react';";
        plugins = 'react()';
        break;
      case 'vue':
      case 'vue-ts':
        imports = "import vue from '@vitejs/plugin-vue';";
        plugins = 'vue()';
        break;
      case 'svelte':
      case 'svelte-ts':
        imports = "import { svelte } from '@sveltejs/vite-plugin-svelte';";
        plugins = 'svelte()';
        break;
    }

    return `import { defineConfig } from 'vite';
import { resolve } from 'path';
${imports}

export default defineConfig(({ mode }) => ({
  plugins: [${plugins}],
  build: mode === 'production' ? {
    lib: {
      entry: resolve(__dirname, 'src/main.${entryExt}'),
      name: '${normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1).replace(/-./g, x => x[1].toUpperCase())}',
      formats: ['umd'],
      fileName: 'mf'
    },
    rollupOptions: {
      external: [${this.getExternalDependencies().map(dep => `'${dep}'`).join(', ')}],
      output: {
        globals: {
          ${this.getGlobalMappings()}
        }
      }
    }
  } : {},
  server: {
    port: ${port},
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  }
}));`;
  }

  protected getExternalDependencies(): string[] {
    switch (this.framework.name) {
      case 'react':
      case 'react-ts':
        return ['react', 'react-dom', '@re-shell/core'];
      case 'vue':
      case 'vue-ts':
        return ['vue', '@re-shell/core'];
      case 'svelte':
      case 'svelte-ts':
        return ['@re-shell/core'];
      case 'angular':
        return ['@angular/core', '@angular/common', '@angular/platform-browser', '@re-shell/core'];
      default:
        return ['@re-shell/core'];
    }
  }

  protected getGlobalMappings(): string {
    const mappings: Record<string, string> = {
      '@re-shell/core': 'ReShell'
    };

    switch (this.framework.name) {
      case 'react':
      case 'react-ts':
        mappings['react'] = 'React';
        mappings['react-dom'] = 'ReactDOM';
        break;
      case 'vue':
      case 'vue-ts':
        mappings['vue'] = 'Vue';
        break;
    }

    return Object.entries(mappings)
      .map(([key, value]) => `          '${key}': '${value}'`)
      .join(',\n');
  }

  protected generateTsConfig(): string {
    const baseConfig: any = {
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src'],
      exclude: ['node_modules', 'dist']
    };

    // Framework-specific TypeScript configuration
    switch (this.framework.name) {
      case 'react-ts':
        baseConfig.compilerOptions.jsx = 'react-jsx';
        break;
      case 'vue-ts':
        baseConfig.compilerOptions.jsx = 'preserve';
        baseConfig.compilerOptions.module = 'ESNext';
        baseConfig.compilerOptions.types = ['vite/client'];
        break;
      case 'svelte-ts':
        baseConfig.compilerOptions.types = ['svelte', 'vite/client'];
        break;
      case 'angular':
        baseConfig.compilerOptions.experimentalDecorators = true;
        baseConfig.compilerOptions.emitDecoratorMetadata = true;
        baseConfig.compilerOptions.types = ['node'];
        break;
    }

    return JSON.stringify(baseConfig, null, 2);
  }

  protected generateEslintConfig(): string {
    const config: any = {
      env: {
        browser: true,
        es2021: true,
        node: true
      },
      extends: ['eslint:recommended'],
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      rules: {}
    };

    if (this.context.hasTypeScript) {
      config.extends.push('@typescript-eslint/recommended');
      config.parser = '@typescript-eslint/parser';
      config.plugins = ['@typescript-eslint'];
    }

    switch (this.framework.name) {
      case 'react':
      case 'react-ts':
        config.extends.push('plugin:react/recommended', 'plugin:react-hooks/recommended');
        config.plugins = [...(config.plugins || []), 'react', 'react-hooks'];
        config.settings = { react: { version: 'detect' } };
        config.parserOptions.ecmaFeatures = { jsx: true };
        break;
      case 'vue':
      case 'vue-ts':
        config.extends.push('plugin:vue/vue3-recommended');
        config.plugins = [...(config.plugins || []), 'vue'];
        break;
      case 'svelte':
      case 'svelte-ts':
        config.extends.push('plugin:svelte/recommended');
        config.plugins = [...(config.plugins || []), 'svelte'];
        break;
    }

    return `module.exports = ${JSON.stringify(config, null, 2)};`;
  }

  protected generateReadme(): string {
    const { name, normalizedName, route, team, org } = this.context;
    
    return `# ${name}

A ${this.framework.displayName} microfrontend for the Re-Shell architecture.

## Overview

This microfrontend is built with ${this.framework.displayName} and can be integrated into any Re-Shell application.

## Development

### Prerequisites
- Node.js >= 16.0.0
- ${this.context.packageManager}

### Installation
\`\`\`bash
${this.context.packageManager} install
\`\`\`

### Development Server
\`\`\`bash
${this.context.packageManager} run dev
\`\`\`

The development server will start on port ${this.context.port}.

### Building
\`\`\`bash
${this.context.packageManager} run build
\`\`\`

### Testing
\`\`\`bash
${this.context.packageManager} run test
\`\`\`

### Linting
\`\`\`bash
${this.context.packageManager} run lint
\`\`\`

## Integration

This microfrontend can be integrated into a Re-Shell application by adding the following configuration:

\`\`\`javascript
const microfrontendConfig = {
  id: '${normalizedName}',
  name: '${name}',
  url: '/apps/${normalizedName}/dist/mf.umd.js',
  containerId: '${normalizedName}-container',
  route: '${route || `/${normalizedName}`}',
  team: '${team || org}'
};
\`\`\`

## Submodule Usage

This project can be used as a Git submodule:

\`\`\`bash
git submodule add <repository-url> apps/${normalizedName}
git submodule update --init --recursive
\`\`\`

## Framework: ${this.framework.displayName}

This microfrontend uses ${this.framework.displayName} with the following build tools:
- Build Tool: ${this.framework.buildTool}
- Package Manager: ${this.context.packageManager}
- TypeScript: ${this.context.hasTypeScript ? 'Yes' : 'No'}

## License

MIT
`;
  }
}
