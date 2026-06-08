import * as fs from 'fs-extra';
import * as path from 'path';

export interface FrameworkConfig {
  name: string;
  displayName: string;
  buildTool: 'vite' | 'webpack' | 'rollup' | 'esbuild' | 'angular-cli' | 'astro' | 'eleventy' |
    'docusaurus' | 'gridsome' | 'jekyll' | 'hugo' | 'hexo' | 'zola' | 'vue-cli' | 'nuxt' | 'next' |
    'remix' | 'gatsby' | 'sveltekit' | 'solid' | 'qwik' | 'lit' | 'stencil' | 'parcel' | 'rush' | 'vue-storefront';
  packageManager: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  configFiles: string[];
  entryFile: string;
  extensions: string[];
  hasTypeScript?: boolean;
}

export const SUPPORTED_FRAMEWORKS: Record<string, FrameworkConfig> = {
  'react': {
    name: 'react',
    displayName: 'React',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      'vite': '^4.4.0',
      '@vitejs/plugin-react': '^4.0.0',
      'eslint': '^8.44.0',
      'vitest': '^0.34.3'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'lint': 'eslint src --ext js,jsx',
      'test': 'vitest'
    },
    configFiles: ['vite.config.js', '.eslintrc.js'],
    entryFile: 'src/main.jsx',
    extensions: ['.js', '.jsx']
  },
  'react-ts': {
    name: 'react-ts',
    displayName: 'React with TypeScript',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      'vite': '^4.4.0',
      '@vitejs/plugin-react': '^4.0.0',
      'typescript': '^5.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'eslint': '^8.44.0',
      'vitest': '^0.34.3'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'lint': 'eslint src --ext ts,tsx',
      'test': 'vitest',
      'type-check': 'tsc --noEmit'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json', '.eslintrc.js'],
    entryFile: 'src/main.tsx',
    extensions: ['.ts', '.tsx'],
    hasTypeScript: true
  },
  'vue': {
    name: 'vue',
    displayName: 'Vue 3',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'vue': '^3.3.0'
    },
    devDependencies: {
      'vite': '^4.4.0',
      '@vitejs/plugin-vue': '^4.0.0',
      'eslint': '^8.44.0',
      'vitest': '^0.34.3'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'lint': 'eslint src --ext js,vue',
      'test': 'vitest'
    },
    configFiles: ['vite.config.js', '.eslintrc.js'],
    entryFile: 'src/main.js',
    extensions: ['.js', '.vue']
  },
  'vue-ts': {
    name: 'vue-ts',
    displayName: 'Vue 3 with TypeScript',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'vue': '^3.3.0'
    },
    devDependencies: {
      'vite': '^4.4.0',
      '@vitejs/plugin-vue': '^4.0.0',
      'typescript': '^5.0.0',
      'vue-tsc': '^1.8.0',
      'eslint': '^8.44.0',
      'vitest': '^0.34.3'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vue-tsc && vite build',
      'preview': 'vite preview',
      'lint': 'eslint src --ext ts,vue',
      'test': 'vitest',
      'type-check': 'vue-tsc --noEmit'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json', '.eslintrc.js'],
    entryFile: 'src/main.ts',
    extensions: ['.ts', '.vue'],
    hasTypeScript: true
  },
  'svelte': {
    name: 'svelte',
    displayName: 'Svelte',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'svelte-navigator': '^3.2.2'
    },
    devDependencies: {
      'svelte': '^3.59.0',
      'vite': '^4.4.0',
      '@sveltejs/vite-plugin-svelte': '^2.4.0',
      'eslint': '^8.44.0',
      'vitest': '^0.34.3'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'lint': 'eslint src --ext js,svelte',
      'test': 'vitest'
    },
    configFiles: ['vite.config.js', 'svelte.config.js', '.eslintrc.js'],
    entryFile: 'src/main.js',
    extensions: ['.js', '.svelte']
  },
  'svelte-ts': {
    name: 'svelte-ts',
    displayName: 'Svelte with TypeScript',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'svelte-navigator': '^3.2.2'
    },
    devDependencies: {
      'svelte': '^3.59.0',
      'vite': '^4.4.0',
      '@sveltejs/vite-plugin-svelte': '^2.4.0',
      'typescript': '^5.0.0',
      'svelte-check': '^3.4.0',
      'eslint': '^8.44.0',
      'vitest': '^0.34.3'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'lint': 'eslint src --ext ts,svelte',
      'test': 'vitest',
      'check': 'svelte-check --tsconfig ./tsconfig.json'
    },
    configFiles: ['vite.config.ts', 'svelte.config.js', 'tsconfig.json', '.eslintrc.js'],
    entryFile: 'src/main.ts',
    extensions: ['.ts', '.svelte'],
    hasTypeScript: true
  },
  'next': {
    name: 'next',
    displayName: 'Next.js 14',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'next': '^14.1.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      '@types/react': '^18.2.48',
      '@types/react-dom': '^18.2.18',
      'typescript': '^5.3.3',
      'tailwindcss': '^3.4.1',
      'autoprefixer': '^10.4.17',
      'postcss': '^8.4.33',
      'eslint': '^8.56.0',
      'eslint-config-next': '^14.1.0'
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
      'lint': 'next lint'
    },
    configFiles: ['next.config.js', 'tailwind.config.ts', 'tsconfig.json', '.eslintrc.json'],
    entryFile: 'src/app/page.tsx',
    extensions: ['.ts', '.tsx'],
    hasTypeScript: true
  },
  'remix': {
    name: 'remix',
    displayName: 'Remix',
    buildTool: 'esbuild',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@remix-run/node': '^2.8.1',
      '@remix-run/react': '^2.8.1',
      '@remix-run/serve': '^2.8.1',
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@remix-run/dev': '^2.8.1',
      '@types/react': '^18.2.48',
      '@types/react-dom': '^18.2.18',
      'typescript': '^5.3.3',
      'tailwindcss': '^3.4.1',
      'autoprefixer': '^10.4.17',
      'postcss': '^8.4.33',
      'eslint': '^8.56.0'
    },
    scripts: {
      'dev': 'remix dev --manual',
      'build': 'remix build',
      'start': 'remix-serve ./build/index.js',
      'typecheck': 'tsc'
    },
    configFiles: ['remix.config.js', 'tailwind.config.js', 'tsconfig.json'],
    entryFile: 'app/root.tsx',
    extensions: ['.ts', '.tsx'],
    hasTypeScript: true
  },
  'gatsby': {
    name: 'gatsby',
    displayName: 'Gatsby 5',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'gatsby': '^5.13.0',
      'gatsby-plugin-image': '^3.13.0',
      'gatsby-plugin-manifest': '^5.13.0',
      'gatsby-plugin-offline': '^6.13.0',
      'gatsby-plugin-sharp': '^5.13.0',
      'gatsby-source-filesystem': '^5.13.0',
      'gatsby-transformer-remark': '^7.13.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      '@types/react': '^18.2.48',
      '@types/react-dom': '^18.2.18',
      'typescript': '^5.3.3'
    },
    scripts: {
      'develop': 'gatsby develop',
      'build': 'gatsby build',
      'serve': 'gatsby serve',
      'clean': 'gatsby clean'
    },
    configFiles: ['gatsby-config.ts', 'gatsby-node.ts', 'tsconfig.json'],
    entryFile: 'src/pages/index.tsx',
    extensions: ['.ts', '.tsx'],
    hasTypeScript: true
  },
  'nuxt': {
    name: 'nuxt',
    displayName: 'Nuxt 3',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'nuxt': '^3.10.0',
      '@nuxtjs/tailwindcss': '^6.10.0',
      '@pinia/nuxt': '^0.5.1',
      '@pinia/plugin-persistedstate': '^3.2.1',
      '@vueuse/nuxt': '^10.7.2',
      '@nuxtjs/i18n': '^8.3.0',
      '@nuxtjs/seo': '^2.0.0',
      '@nuxtjs/color-mode': '^3.3.3',
      'vue': '^3.4.0'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      'typescript': '^5.3.3',
      'autoprefixer': '^10.4.17',
      'postcss': '^8.4.33',
      'tailwindcss': '^3.4.1'
    },
    scripts: {
      'dev': 'nuxt dev',
      'build': 'nuxt build',
      'generate': 'nuxt generate',
      'preview': 'nuxt preview',
      'postinstall': 'nuxt prepare'
    },
    configFiles: ['nuxt.config.ts', 'tsconfig.json', 'app.config.ts', 'tailwind.config.js'],
    entryFile: 'app/app.vue',
    extensions: ['.ts', '.vue'],
    hasTypeScript: true
  },
  'quasar': {
    name: 'quasar',
    displayName: 'Quasar Framework',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@quasar/extras': '^1.16.9',
      'axios': '^1.6.5',
      'pinia': '^2.1.7',
      'quasar': '^2.14.0',
      'vue': '^3.4.15',
      'vue-router': '^4.2.5'
    },
    devDependencies: {
      '@quasar/app-vite': '^1.5.0',
      '@types/node': '^20.11.0',
      'autoprefixer': '^10.4.17',
      'eslint': '^8.56.0',
      'eslint-config-prettier': '^9.1.0',
      'eslint-plugin-vue': '^9.20.1',
      'prettier': '^3.2.4',
      'typescript': '^5.3.3'
    },
    scripts: {
      'dev': 'quasar dev',
      'build': 'quasar build',
      'build:pwa': 'quasar build -m pwa',
      'build:electron': 'quasar build -m electron',
      'lint': 'eslint --ext .js,.vue ./src',
      'format': 'prettier --write "**/*.{js,vue,scss,md,json}"',
      'test': 'echo "No test specified" && exit 0'
    },
    configFiles: ['quasar.config.js', 'tsconfig.json'],
    entryFile: 'src/App.vue',
    extensions: ['.js', '.vue'],
    hasTypeScript: true
  },
  'angular': {
    name: 'angular',
    displayName: 'Angular 17+',
    buildTool: 'esbuild',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@angular/animations': '^17.3.0',
      '@angular/common': '^17.3.0',
      '@angular/compiler': '^17.3.0',
      '@angular/core': '^17.3.0',
      '@angular/forms': '^17.3.0',
      '@angular/platform-browser': '^17.3.0',
      '@angular/platform-browser-dynamic': '^17.3.0',
      '@angular/router': '^17.3.0',
      'rxjs': '^7.8.1',
      'tslib': '^2.6.2',
      'zone.js': '^0.14.4'
    },
    devDependencies: {
      '@angular-devkit/build-angular': '^17.3.0',
      '@angular/cli': '^17.3.0',
      '@angular/compiler-cli': '^17.3.0',
      '@types/jasmine': '~5.1.0',
      '@types/node': '^20.11.0',
      'jasmine-core': '~5.1.0',
      'karma': '~6.4.0',
      'karma-chrome-launcher': '~3.2.0',
      'karma-coverage': '~2.2.0',
      'karma-jasmine': '~5.1.0',
      'karma-jasmine-html-reporter': '~2.1.0',
      'typescript': '~5.4.2'
    },
    scripts: {
      'ng': 'ng',
      'start': 'ng serve',
      'build': 'ng build',
      'watch': 'ng build --watch --configuration development',
      'test': 'ng test',
      'lint': 'ng lint'
    },
    configFiles: ['angular.json', 'tsconfig.json', 'karma.conf.js'],
    entryFile: 'src/main.ts',
    extensions: ['.ts', '.html'],
    hasTypeScript: true
  },
  'vite-react': {
    name: 'vite-react',
    displayName: 'Vite + React',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@types/react': '^18.2.48',
      '@types/react-dom': '^18.2.18',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      '@vitejs/plugin-react': '^4.2.1',
      'eslint': '^8.56.0',
      'eslint-plugin-react-hooks': '^4.6.0',
      'eslint-plugin-react-refresh': '^0.4.5',
      'prettier': '^3.2.4',
      'typescript': '^5.3.3',
      'vite': '^5.0.12'
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
      'preview': 'vite preview',
      'format': 'prettier --write "src/**/*.{ts,tsx,css,md}"'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json', '.eslintrc.cjs'],
    entryFile: 'src/main.tsx',
    extensions: ['.ts', '.tsx'],
    hasTypeScript: true
  },
  'sveltekit': {
    name: 'sveltekit',
    displayName: 'SvelteKit',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {},
    devDependencies: {
      '@playwright/test': '^1.41.2',
      '@sveltejs/adapter-auto': '^3.1.1',
      '@sveltejs/adapter-node': '^5.0.1',
      '@sveltejs/kit': '^2.5.0',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      'eslint': '^8.56.0',
      'eslint-config-prettier': '^9.1.0',
      'eslint-plugin-svelte': '^2.35.1',
      'prettier': '^3.2.4',
      'prettier-plugin-svelte': '^3.2.2',
      'svelte-check': '^3.6.3',
      'svelte': '^4.2.9',
      'tslib': '^2.6.2',
      'typescript': '^5.3.3',
      'vite': '^5.1.0',
      'vitest': '^1.2.2'
    },
    scripts: {
      'dev': 'vite dev',
      'build': 'vite build',
      'preview': 'vite preview',
      'check': 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
      'check:watch': 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch',
      'test': 'playwright test',
      'lint': 'prettier --check . && eslint .',
      'format': 'prettier --write .'
    },
    configFiles: ['svelte.config.js', 'vite.config.ts', 'tsconfig.json'],
    entryFile: 'src/routes/+page.svelte',
    extensions: ['.svelte', '.ts'],
    hasTypeScript: true
  },
  'solid-js': {
    name: 'solid-js',
    displayName: 'Solid.js',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@solidjs/router': '^0.10.5',
      'solid-js': '^1.8.11'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      'eslint': '^8.56.0',
      'eslint-plugin-solid': '^0.13.1',
      'typescript': '^5.3.3',
      'vite': '^5.1.0',
      'vite-plugin-solid': '^2.9.1'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json'],
    entryFile: 'src/main.tsx',
    extensions: ['.ts', '.tsx'],
    hasTypeScript: true
  },
  'qwik': {
    name: 'qwik',
    displayName: 'Qwik',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {},
    devDependencies: {
      '@builder.io/qwik': '^1.5.1',
      '@builder.io/qwik-city': '^1.5.1',
      '@types/eslint': '^8.56.0',
      '@types/node': '^20.11.0',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      'eslint': '^8.56.0',
      'eslint-plugin-qwik': '^1.5.1',
      'node-fetch': '^3.3.2',
      'prettier': '^3.2.4',
      'typescript': '^5.3.3',
      'undici': '^6.6.2',
      'vite': '^5.1.0',
      'vitest': '^1.2.2'
    },
    scripts: {
      'dev': 'qwik dev',
      'build': 'qwik build',
      'build.preview': 'qwik build --preview',
      'deploy': 'qwik build deploy',
      'fmt': 'prettier --write .',
      'fmt.check': 'prettier --check .',
      'lint': 'eslint "src/**/*.ts{,x}"',
      'test': 'vitest',
      'start': 'qwik build preview && vite preview'
    },
    configFiles: ['qwik.config.ts', 'vite.config.ts', 'tsconfig.json'],
    entryFile: 'src/root.tsx',
    extensions: ['.tsx'],
    hasTypeScript: true
  },
  'lit': {
    name: 'lit',
    displayName: 'Lit',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'lit': '^3.1.2'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      'eslint': '^8.56.0',
      'prettier': '^3.2.4',
      'typescript': '^5.3.3',
      'vite': '^5.1.0',
      'vite-plugin-lit': '^3.0.0',
      'vitest': '^1.2.2'
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview',
      'lint': 'eslint . --ext ts --report-unused-disable-directives --max-warnings 0',
      'test': 'vitest',
      'format': 'prettier --write "src/**/*.{ts,css,md}"'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json', '.eslintrc.cjs'],
    entryFile: 'src/main.ts',
    extensions: ['.ts'],
    hasTypeScript: true
  },
  'stencil': {
    name: 'stencil',
    displayName: 'Stencil',
    buildTool: 'rollup',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@stencil/core': '^4.12.0'
    },
    devDependencies: {
      '@stencil/angular-output-target': '^0.8.0',
      '@stencil/react-output-target': '^0.5.0',
      '@stencil/svelte-output-target': '^0.6.0',
      '@stencil/vue-output-target': '^0.8.0',
      '@stencil/web-components-output-target': '^0.4.0',
      '@types/jest': '^29.5.11',
      '@types/node': '^20.11.0',
      'jest': '^29.7.0',
      'jest-cli': '^29.7.0',
      'puppeteer': '^22.0.0',
      'typescript': '^5.3.3'
    },
    scripts: {
      'build': 'stencil build',
      'start': 'stencil build --dev --watch --serve',
      'test': 'stencil test --spec --e2e',
      'test.watch': 'stencil test --spec --e2e --watchAll',
      'generate': 'stencil generate'
    },
    configFiles: ['stencil.config.ts', 'tsconfig.json'],
    entryFile: 'src/index.html',
    extensions: ['.tsx', '.ts'],
    hasTypeScript: true
  },
  'alpine': {
    name: 'alpine',
    displayName: 'Alpine.js',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'alpinejs': '^3.13.5',
      'htmx.org': '^1.9.10',
      '@alpinejs/focus': '^3.13.5',
      '@alpinejs/intersect': '^3.13.5',
      '@alpinejs/persist': '^3.13.5',
      '@alpinejs/mask': '^3.13.5'
    },
    devDependencies: {
      'vite': '^5.0.12'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'test': 'echo "No tests configured" && exit 0'
    },
    configFiles: ['vite.config.js'],
    entryFile: 'src/index.html',
    extensions: ['.js', '.html'],
    hasTypeScript: false
  },
  'preact': {
    name: 'preact',
    displayName: 'Preact',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'preact': '^10.19.3',
      'preact-compat': '^3.19.0',
      'preact-router': '^4.1.0'
    },
    devDependencies: {
      '@preact/preset-vite': '^2.8.1',
      '@types/node': '^20.11.0',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      'eslint': '^8.56.0',
      'eslint-plugin-react-hooks': '^4.6.0',
      'jsdom': '^24.0.0',
      'typescript': '^5.3.3',
      'vite': '^5.0.12',
      'vitest': '^1.2.2'
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview',
      'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
      'test': 'vitest'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json'],
    entryFile: 'src/main.tsx',
    extensions: ['.ts', '.tsx'],
    hasTypeScript: true
  },
  'mithril': {
    name: 'mithril',
    displayName: 'Mithril.js',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'mithril': '^2.2.2'
    },
    devDependencies: {
      '@types/mithril': '^2.0.12',
      '@types/node': '^20.11.0',
      'typescript': '^5.3.3',
      'vite': '^5.0.12',
      'vite-plugin-mithril': '^2.2.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview',
      'test': 'echo "No tests configured" && exit 0'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json'],
    entryFile: 'src/main.ts',
    extensions: ['.ts'],
    hasTypeScript: true
  },
  'hyperapp': {
    name: 'hyperapp',
    displayName: 'Hyperapp',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'hyperapp': '^2.0.22',
      '@hyperapp/router': '^2.1.0'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      'typescript': '^5.3.3',
      'vite': '^5.0.12',
      'vite-plugin-hyperapp': '^0.6.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'tsc && vite build',
      'preview': 'vite preview',
      'test': 'echo "No tests configured" && exit 0'
    },
    configFiles: ['vite.config.ts', 'tsconfig.json'],
    entryFile: 'src/main.ts',
    extensions: ['.ts'],
    hasTypeScript: true
  },
  'astro': {
    name: 'astro',
    displayName: 'Astro',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@astrojs/react': '^3.0.9',
      '@astrojs/vue': '^4.0.4',
      '@astrojs/svelte': '^5.0.3',
      '@astrojs/tailwind': '^5.1.0',
      'astro': '^4.4.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'vue': '^3.4.15',
      'svelte': '^4.2.9',
      'tailwindcss': '^3.4.1'
    },
    devDependencies: {
      '@types/react': '^18.2.48',
      '@types/react-dom': '^18.2.18',
      '@types/node': '^20.11.0',
      'prettier': '^3.2.4',
      'prettier-plugin-astro': '^0.13.0',
      'typescript': '^5.3.3'
    },
    scripts: {
      'dev': 'astro dev',
      'start': 'astro dev',
      'build': 'astro check && astro build',
      'preview': 'astro preview',
      'astro': 'astro'
    },
    configFiles: ['astro.config.mjs', 'tsconfig.json'],
    entryFile: 'src/pages/index.astro',
    extensions: ['.astro', '.jsx', '.vue', '.svelte'],
    hasTypeScript: true
  },
  'eleventy': {
    name: 'eleventy',
    displayName: '11ty (Eleventy)',
    buildTool: 'eleventy',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {},
    devDependencies: {
      '@11ty/eleventy': '^3.0.0-alpha.12',
      '@11ty/eleventy-img': '^5.0.0-beta.6',
      '@11ty/eleventy-plugin-rss': '^2.0.0',
      '@11ty/eleventy-plugin-syntaxhighlight': '^5.0.0',
      'markdown-it': '^14.0.0',
      'markdown-it-anchor': '^9.0.1'
    },
    scripts: {
      'build': 'eleventy',
      'start': 'eleventy --serve',
      'watch': 'eleventy --watch',
      'serve': 'eleventy --serve'
    },
    configFiles: ['eleventy.config.js'],
    entryFile: 'src/index.njk',
    extensions: ['.njk', '.md', '.html'],
    hasTypeScript: false
  },
  'vuepress': {
    name: 'vuepress',
    displayName: 'VuePress',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'vue': '^3.4.0',
      'vuepress': '^2.0.0-rc.15',
      '@vuepress/client': '^2.0.0-rc.15',
      '@vuepress/bundler-vite': '^2.0.0-rc.15',
      '@vuepress/bundler-webpack': '^2.0.0-rc.15'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      '@vuepress/plugin-docsearch': '^2.0.0-rc.32',
      '@vuepress/plugin-search': '^2.0.0-rc.32',
      '@vuepress/plugin-register-components': '^2.0.0-rc.32',
      '@vuepress/plugin-shiki': '^2.0.0-rc.32',
      'eslint': '^8.56.0',
      'eslint-plugin-vue': '^9.20.0',
      'prettier': '^3.2.0',
      'sass': '^1.70.0',
      'sass-loader': '^14.0.0',
      'typescript': '^5.3.3'
    },
    scripts: {
      'docs:dev': 'vuepress dev docs',
      'docs:build': 'vuepress build docs',
      'docs:preview': 'vuepress preview docs',
      'lint': 'eslint --ext .js,.ts,.vue .',
      'format': 'prettier --write .'
    },
    configFiles: ['docs/.vuepress/config.ts'],
    entryFile: 'docs/index.md',
    extensions: ['.md', '.vue', '.ts'],
    hasTypeScript: true
  },
  'docusaurus': {
    name: 'docusaurus',
    displayName: 'Docusaurus',
    buildTool: 'docusaurus',
    packageManager: ['npm', 'yarn', 'pnpm'],
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
    scripts: {
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
    configFiles: ['docusaurus.config.ts'],
    entryFile: 'src/pages/index.tsx',
    extensions: ['.tsx', '.ts', '.md', '.mdx'],
    hasTypeScript: true
  },
  'gridsome': {
    name: 'gridsome',
    displayName: 'Gridsome',
    buildTool: 'gridsome',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'gridsome': '^0.7.23',
      'vue': '^2.7.14',
      'vue-runtime-template-compiler': '^2.7.14',
      'graphql-request': '^6.1.0',
      'vue-property-decorator': '^9.1.2',
      'vuex': '^3.6.2'
    },
    devDependencies: {
      '@gridsome/plugin-sitemap': '^0.4.0',
      '@gridsome/transformer-remark': '^0.6.0',
      '@gridsome/vue-docgen-loader': '^0.6.0',
      '@types/node': '^20.11.0',
      '@typescript-eslint/eslint-plugin': '^6.19.0',
      '@typescript-eslint/parser': '^6.19.0',
      'eslint': '^8.56.0',
      'eslint-plugin-prettier': '^5.1.3',
      'eslint-plugin-vue': '^9.20.0',
      'node-sass': '^9.0.0',
      'prettier': '^3.2.0',
      'sass-loader': '^14.0.0',
      'typescript': '^5.3.3',
      'webpack-node-externals': '^3.0.0'
    },
    scripts: {
      'build': 'gridsome build',
      'develop': 'gridsome develop',
      'explore': 'gridsome explore',
      'lint': 'eslint --ext .js,.ts,.vue src',
      'format': 'prettier --write "**/*.{js,ts,vue,json,css,scss}"'
    },
    configFiles: ['gridsome.config.js'],
    entryFile: 'src/pages/Index.vue',
    extensions: ['.vue', '.js', '.ts'],
    hasTypeScript: true
  },
  'scully': {
    name: 'scully',
    displayName: 'Scully (Angular)',
    buildTool: 'angular-cli',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@angular/animations': '^17.0.0',
      '@angular/common': '^17.0.0',
      '@angular/compiler': '^17.0.0',
      '@angular/core': '^17.0.0',
      '@angular/forms': '^17.0.0',
      '@angular/platform-browser': '^17.0.0',
      '@angular/platform-browser-dynamic': '^17.0.0',
      '@angular/router': '^17.0.0',
      '@scullyio/scully': '^2.0.0',
      '@scullyio/ng-lib': '^2.0.0',
      'rxjs': '^7.8.0',
      'tslib': '^2.6.0',
      'zone.js': '^0.14.0'
    },
    devDependencies: {
      '@angular-devkit/build-angular': '^17.0.0',
      '@angular/cli': '^17.0.0',
      '@angular/compiler-cli': '^17.0.0',
      '@types/jasmine': '^5.1.0',
      '@types/node': '^20.11.0',
      'jasmine-core': '^5.1.0',
      'karma': '^6.4.0',
      'karma-chrome-launcher': '^3.2.0',
      'karma-coverage': '^2.2.0',
      'karma-jasmine': '^5.1.0',
      'karma-jasmine-html-reporter': '^2.1.0',
      'typescript': '~5.3.0'
    },
    scripts: {
      'start': 'ng serve',
      'build': 'ng build',
      'watch': 'ng build --watch --configuration development',
      'test': 'ng test',
      'lint': 'ng lint',
      'scully': 'npx scully',
      'scully:serve': 'npx scully serve',
      'build:prod': 'ng build --configuration production && npx scully'
    },
    configFiles: ['angular.json', 'scully.config.js'],
    entryFile: 'src/main.ts',
    extensions: ['.ts', '.html', '.scss'],
    hasTypeScript: true
  },
  'jekyll': {
    name: 'jekyll',
    displayName: 'Jekyll',
    buildTool: 'jekyll',
    packageManager: ['bundler'],
    dependencies: {},
    devDependencies: {
      'jekyll': '~> 4.3.3',
      'kramdown': '~> 2.4',
      'kramdown-parser-gfm': '~> 1.1',
      'rdiscount': '~> 2.2',
      'liquid-c': '~> 4.0',
      'rouge': '~> 4.2',
      'jekyll-feed': '~> 0.12',
      'jekyll-seo-tag': '~> 2.8',
      'jekyll-sitemap': '~> 1.4',
      'jekyll-paginate': '~> 1.1',
      'jekyll-archives': '~> 2.2',
      'jekyll-include-cache': '~> 0.1',
      'sass-embedded': '~> 1.69',
      'jekyll-assets': '~> 3.0',
      'jekyll-watch': '~> 2.2',
      'jekyll-compose': '~> 0.12',
      'jekyll-redirect-from': '~> 0.16',
      'github-pages': '>= 227'
    },
    scripts: {
      'install': 'bundle install',
      'start': 'bundle exec jekyll serve',
      'build': 'bundle exec jekyll build',
      'watch': 'bundle exec jekyll serve --watch',
      'clean': 'bundle exec jekyll clean'
    },
    configFiles: ['_config.yml', 'Gemfile'],
    entryFile: 'index.md',
    extensions: ['.md', '.html', '.scss', '.yml'],
    hasTypeScript: false
  },
  'hugo': {
    name: 'hugo',
    displayName: 'Hugo',
    buildTool: 'hugo',
    packageManager: [],
    dependencies: {},
    devDependencies: {},
    scripts: {
      'start': 'hugo server -D',
      'build': 'hugo --minify',
      'clean': 'hugo --cleanDestinationDir'
    },
    configFiles: ['hugo.toml'],
    entryFile: 'content/_index.md',
    extensions: ['.md', '.html', '.toml', '.yml'],
    hasTypeScript: false
  },
  'hexo': {
    name: 'hexo',
    displayName: 'Hexo',
    buildTool: 'hexo',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'hexo': '^7.0.0',
      'hexo-generator-archive': '^2.0.0',
      'hexo-generator-category': '^2.0.0',
      'hexo-generator-index': '^3.0.0',
      'hexo-generator-tag': '^2.0.0',
      'hexo-renderer-ejs': '^2.0.0',
      'hexo-renderer-marked': '^6.0.0',
      'hexo-renderer-stylus': '^3.0.0',
      'hexo-server': '^3.0.0',
      'hexo-deployer-git': '^4.0.0',
      'hexo-generator-searchdb': '^1.4.0',
      'hexo-generator-sitemap': '^3.0.0',
      'hexo-generator-feed': '^3.0.0',
      'hexo-util': '^3.0.0'
    },
    devDependencies: {
      'hexo-cli': '^4.3.0'
    },
    scripts: {
      'build': 'hexo generate',
      'clean': 'hexo clean',
      'deploy': 'hexo deploy',
      'server': 'hexo server',
      'start': 'hexo server --debug'
    },
    configFiles: ['_config.yml'],
    entryFile: 'source/index.md',
    extensions: ['.md', '.ejs', '.yml'],
    hasTypeScript: false
  },
  'zola': {
    name: 'zola',
    displayName: 'Zola',
    buildTool: 'zola',
    packageManager: [],
    dependencies: {},
    devDependencies: {},
    scripts: {
      'serve': 'zola serve',
      'build': 'zola build',
      'new': 'zola new-post'
    },
    configFiles: ['config.toml'],
    entryFile: 'content/_index.md',
    extensions: ['.md', '.toml'],
    hasTypeScript: false
  },
  'create-react-app': {
    name: 'create-react-app',
    displayName: 'Create React App',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'react-scripts': '5.0.1',
      'web-vitals': '^3.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'customize-cra': '^1.0.0',
      'react-app-rewired': '^2.2.1',
      'webpack-bundle-analyzer': '^4.9.0'
    },
    scripts: {
      'start': 'react-app-rewired start',
      'build': 'react-app-rewired build',
      'test': 'react-app-rewired test',
      'eject': 'react-scripts eject',
      'analyze': 'ANALYZE=true react-app-rewired build',
      'lint': 'eslint src --ext .js,.jsx,.ts,.tsx'
    },
    configFiles: ['package.json', 'config-overrides.js'],
    entryFile: 'src/index.js',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    hasTypeScript: true
  },
  'cra': {
    name: 'cra',
    displayName: 'CRA (Create React App)',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'react-scripts': '5.0.1',
      'web-vitals': '^3.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      'customize-cra': '^1.0.0',
      'react-app-rewired': '^2.2.1',
      'webpack-bundle-analyzer': '^4.9.0'
    },
    scripts: {
      'start': 'react-app-rewired start',
      'build': 'react-app-rewired build',
      'test': 'react-app-rewired test',
      'eject': 'react-scripts eject',
      'analyze': 'ANALYZE=true react-app-rewired build',
      'lint': 'eslint src --ext .js,.jsx,.ts,.tsx'
    },
    configFiles: ['package.json', 'config-overrides.js'],
    entryFile: 'src/index.js',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    hasTypeScript: true
  },
  'vue-cli': {
    name: 'vue-cli',
    displayName: 'Vue CLI',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'vue': '^3.3.0',
      'vue-router': '^4.0.3',
      'vuex': '^4.0.0',
      'core-js': '^3.8.3',
      'register-service-worker': '^1.7.2'
    },
    devDependencies: {
      '@vue/cli-service': '~5.0.0',
      '@vue/cli-plugin-babel': '~5.0.0',
      '@vue/cli-plugin-eslint': '~5.0.0',
      '@vue/cli-plugin-pwa': '~5.0.0',
      '@vue/cli-plugin-router': '~5.0.0',
      '@vue/cli-plugin-vuex': '~5.0.0',
      '@vue/test-utils': '^2.0.0',
      'sass': '^1.32.7',
      'sass-loader': '^12.0.0'
    },
    scripts: {
      'serve': 'vue-cli-service serve',
      'build': 'vue-cli-service build',
      'lint': 'vue-cli-service lint',
      'test:unit': 'vue-cli-service test:unit'
    },
    configFiles: ['vue.config.js', '.browserslistrc'],
    entryFile: 'src/main.js',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue'],
    hasTypeScript: true
  },
  'angular-cli': {
    name: 'angular-cli',
    displayName: 'Angular CLI',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@angular/animations': '^17.0.0',
      '@angular/common': '^17.0.0',
      '@angular/compiler': '^17.0.0',
      '@angular/core': '^17.0.0',
      '@angular/forms': '^17.0.0',
      '@angular/platform-browser': '^17.0.0',
      '@angular/platform-browser-dynamic': '^17.0.0',
      '@angular/router': '^17.0.0',
      '@angular/service-worker': '^17.0.0',
      'rxjs': '^7.8.0',
      'tslib': '^2.6.0',
      'zone.js': '^0.14.0'
    },
    devDependencies: {
      '@angular-devkit/build-angular': '^17.0.0',
      '@angular/cli': '^17.0.0',
      '@angular/compiler-cli': '^17.0.0',
      '@types/jasmine': '^5.1.0',
      '@types/node': '^20.0.0',
      'jasmine-core': '^5.1.0',
      'karma': '^6.4.0',
      'typescript': '~5.2.0'
    },
    scripts: {
      'ng': 'ng',
      'start': 'ng serve',
      'build': 'ng build',
      'test': 'ng test',
      'lint': 'ng lint'
    },
    configFiles: ['angular.json', 'tsconfig.json'],
    entryFile: 'src/main.ts',
    extensions: ['.ts', '.html', '.scss', '.css'],
    hasTypeScript: true
  },
  'vite-svelte': {
    name: 'vite-svelte',
    displayName: 'Vite + Svelte',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'svelte-navigator': '^4.0.0'
    },
    devDependencies: {
      '@sveltejs/vite-plugin-svelte': '^3.0.0',
      '@sveltejs/vite-plugin-svelte-inspector': '^2.0.0',
      '@tsconfig/svelte': '^5.0.0',
      'svelte': '^4.0.0',
      'svelte-check': '^3.5.0',
      'typescript': '^5.3.0',
      'vite': '^5.0.0',
      'vitest': '^1.0.0',
      '@playwright/test': '^1.40.0'
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
      'test': 'vitest',
      'check': 'svelte-check --tsconfig ./tsconfig.json'
    },
    configFiles: ['vite.config.ts', 'svelte.config.js', 'tsconfig.json'],
    entryFile: 'src/main.ts',
    extensions: ['.svelte', '.ts'],
    hasTypeScript: true
  },
  'react-module-federation': {
    name: 'react-module-federation',
    displayName: 'React Module Federation',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router-dom': '^6.20.0'
    },
    devDependencies: {
      '@module-federation/utilities': '^3.0.0',
      '@docusaurus/react-loadable': '^5.5.2',
      'webpack': '^5.89.0',
      'webpack-cli': '^5.1.0',
      'html-webpack-plugin': '^5.5.0',
      'babel-loader': '^9.1.3',
      'css-loader': '^6.8.0',
      'style-loader': '^3.3.0'
    },
    scripts: {
      'start': 'webpack serve --mode development',
      'build': 'webpack --mode production',
      'lint': 'eslint src --ext .js,.jsx,.ts,.tsx'
    },
    configFiles: ['webpack.config.js', '.babelrc.js'],
    entryFile: 'src/index.js',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    hasTypeScript: true
  },
  'vue-module-federation': {
    name: 'vue-module-federation',
    displayName: 'Vue Module Federation',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'vue': '^3.3.0',
      'vue-router': '^4.0.0',
      'vuex': '^4.0.0'
    },
    devDependencies: {
      '@vue/cli-service': '~5.0.0',
      '@vue/cli-plugin-webpack': '~5.0.0',
      'webpack': '^5.89.0',
      'vue-loader': '^17.4.0',
      'vue-template-compiler': '^2.7.0',
      '@module-federation/utilities': '^3.0.0'
    },
    scripts: {
      'serve': 'vue-cli-service serve',
      'build': 'vue-cli-service build',
      'lint': 'vue-cli-service lint'
    },
    configFiles: ['vue.config.js', 'webpack.config.js'],
    entryFile: 'src/main.js',
    extensions: ['.js', '.vue', '.ts'],
    hasTypeScript: true
  },
  'angular-module-federation': {
    name: 'angular-module-federation',
    displayName: 'Angular Module Federation',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@angular/animations': '^17.0.0',
      '@angular/common': '^17.0.0',
      '@angular/core': '^17.0.0',
      '@angular/elements': '^17.0.0',
      '@angular/forms': '^17.0.0',
      '@angular/platform-browser': '^17.0.0',
      '@angular/platform-browser-dynamic': '^17.0.0',
      '@angular/router': '^17.0.0',
      '@ngrx/effects': '^17.0.0',
      '@ngrx/entity': '^17.0.0',
      '@ngrx/store': '^17.0.0',
      '@ngrx/store-devtools': '^17.0.0',
      'rxjs': '^7.8.0',
      'tslib': '^2.6.0',
      'zone.js': '^0.14.0'
    },
    devDependencies: {
      '@angular-architects/module-federation': '^17.0.0',
      '@angular-devkit/build-angular': '^17.0.0',
      '@angular/cli': '^17.0.0',
      '@angular/compiler-cli': '^17.0.0',
      '@types/node': '^20.10.0',
      '@typescript-eslint/eslint-plugin': '^6.13.0',
      '@typescript-eslint/parser': '^6.13.0',
      'eslint': '^8.55.0',
      'jasmine-core': '^5.1.0',
      'karma': '^6.4.0',
      'karma-chrome-launcher': '^3.2.0',
      'karma-coverage': '^2.2.0',
      'karma-jasmine': '^5.1.0',
      'karma-jasmine-html-reporter': '^2.1.0',
      'typescript': '^5.3.0',
      'webpack': '^5.89.0'
    },
    scripts: {
      'start': 'ng serve',
      'build': 'ng build',
      'watch': 'ng build --watch --configuration development',
      'test': 'ng test',
      'lint': 'ng lint'
    },
    configFiles: ['angular.json', 'webpack.config.js'],
    entryFile: 'src/main.ts',
    extensions: ['.ts', '.html'],
    hasTypeScript: true
  },
  'svelte-module-federation': {
    name: 'svelte-module-federation',
    displayName: 'Svelte Module Federation',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      'svelte': '^4.0.0',
      'svelte-routing': '^2.0.0'
    },
    devDependencies: {
      '@module-federation/utilities': '^3.0.0',
      '@tsconfig/svelte': '^5.0.0',
      '@types/svelte': '^3.24.0',
      'cross-env': '^7.0.3',
      'css-loader': '^6.8.0',
      'eslint': '^8.56.0',
      'eslint-plugin-svelte': '^2.35.0',
      'html-webpack-plugin': '^5.5.0',
      'mini-css-extract-plugin': '^2.7.0',
      'svelte-loader': '^3.1.0',
      'svelte-preprocess': '^5.1.0',
      'webpack': '^5.89.0',
      'webpack-cli': '^5.1.0',
      'webpack-dev-server': '^4.15.0'
    },
    scripts: {
      'start': 'webpack serve --mode development',
      'build': 'webpack --mode production',
      'serve': 'webpack serve --mode development',
      'lint': 'eslint src --ext .js,.svelte'
    },
    configFiles: ['webpack.config.js', 'svelte.config.js'],
    entryFile: 'src/main.js',
    extensions: ['.js', '.svelte'],
    hasTypeScript: true
  },
  'nx-angular': {
    name: 'nx-angular',
    displayName: 'Nx Angular',
    buildTool: 'webpack',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@angular/animations': '^17.0.0',
      '@angular/common': '^17.0.0',
      '@angular/compiler': '^17.0.0',
      '@angular/core': '^17.0.0',
      '@angular/forms': '^17.0.0',
      '@angular/platform-browser': '^17.0.0',
      '@angular/platform-browser-dynamic': '^17.0.0',
      '@angular/router': '^17.0.0',
      'rxjs': '^7.8.0',
      'tslib': '^2.6.0',
      'zone.js': '^0.14.0'
    },
    devDependencies: {
      '@angular-devkit/build-angular': '^17.0.0',
      '@angular-devkit/build-webpack': '^17.0.0',
      '@angular-eslint/eslint-plugin': '^17.0.0',
      '@angular-eslint/eslint-plugin-template': '^17.0.0',
      '@angular-eslint/template-parser': '^17.0.0',
      '@angular/cli': '^17.0.0',
      '@angular/compiler-cli': '^17.0.0',
      '@angular/language-service': '^17.0.0',
      '@nx/angular': '^17.0.0',
      '@nx/cypress': '^17.0.0',
      '@nx/eslint-plugin': '^17.0.0',
      '@nx/jest': '^17.0.0',
      '@nx/workspace': '^17.0.0',
      '@types/jest': '^29.5.0',
      '@types/node': '^20.10.0',
      '@typescript-eslint/eslint-plugin': '^6.13.0',
      '@typescript-eslint/parser': '^6.13.0',
      'cypress': '^13.6.0',
      'eslint': '^8.55.0',
      'eslint-config-prettier': '^9.1.0',
      'jest': '^29.7.0',
      'jest-environment-jsdom': '^29.7.0',
      'jest-preset-angular': '^13.1.0',
      'nx': '^17.0.0',
      'prettier': '^3.2.0',
      'ts-jest': '^29.1.0',
      'typescript': '^5.3.0'
    },
    scripts: {
      'nx': 'nx',
      'start': 'nx serve',
      'build': 'nx run-many --target=build --all',
      'test': 'nx run-many --target=test --all',
      'lint': 'nx workspace-lint && nx run-many --target=lint --all',
      'affected': 'nx affected --graph',
      'affected:build': 'nx affected --target=build',
      'affected:test': 'nx affected --target=test',
      'format': 'nx format:write',
      'format:check': 'nx format:check',
      'workspace-generator': 'nx workspace-generator'
    },
    configFiles: ['nx.json', 'angular.json', 'workspace.json'],
    entryFile: 'apps/app1/src/main.ts',
    extensions: ['.ts', '.html'],
    hasTypeScript: true
  },
  'analog': {
    name: 'analog',
    displayName: 'Analog',
    buildTool: 'vite',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@analogjs/content': '^1.0.0',
      '@analogjs/router': '^1.0.0',
      '@angular/animations': '^17.0.0',
      '@angular/common': '^17.0.0',
      '@angular/core': '^17.0.0',
      '@angular/forms': '^17.0.0',
      '@angular/platform-browser': '^17.0.0',
      '@angular/platform-browser-dynamic': '^17.0.0',
      '@angular/platform-server': '^17.0.0',
      '@angular/router': '^17.0.0',
      'front-matter': '^4.0.2',
      'marked': '^11.0.0',
      'rxjs': '^7.8.0',
      'tslib': '^2.6.0',
      'zone.js': '^0.14.0'
    },
    devDependencies: {
      '@analogjs/platform': '^1.0.0',
      '@analogjs/vite-plugin-angular': '^1.0.0',
      '@angular-devkit/build-angular': '^17.0.0',
      '@angular/cli': '^17.0.0',
      '@angular/compiler-cli': '^17.0.0',
      '@nx/vite': '^17.0.0',
      '@types/marked': '^6.0.0',
      '@vitest/ui': '^1.0.0',
      'autoprefixer': '^10.4.0',
      'cssnano': '^6.0.0',
      'jsdom': '^23.0.0',
      'postcss': '^8.4.0',
      'postcss-nesting': '^12.0.0',
      'tailwindcss': '^3.4.0',
      'typescript': '^5.3.0',
      'vite': '^5.0.0',
      'vitest': '^1.0.0'
    },
    scripts: {
      'start': 'ng serve',
      'build': 'ng build',
      'watch': 'ng build --watch --configuration development',
      'test': 'ng test',
      'lint': 'ng lint'
    },
    configFiles: ['analog.config.ts', 'vite.config.ts', 'nitro.config.ts'],
    entryFile: 'src/main.ts',
    extensions: ['.ts', '.html'],
    hasTypeScript: true
  },
  'vue-storefront': {
    name: 'vue-storefront',
    displayName: 'Vue Storefront',
    buildTool: 'nuxt',
    packageManager: ['npm', 'yarn', 'pnpm'],
    dependencies: {
      '@vuestorefront/sdk': '^3.0.0',
      '@vuestorefront/middleware': '^3.0.0',
      'nuxt': '^3.10.0',
      '@nuxtjs/tailwindcss': '^6.10.0',
      '@pinia/nuxt': '^0.5.1',
      '@pinia/plugin-persistedstate': '^3.2.1',
      '@vueuse/nuxt': '^10.7.2',
      '@nuxtjs/i18n': '^8.3.0',
      '@nuxt/image': '^1.3.0',
      'vue': '^3.4.0',
      'pinia': '^2.1.7',
      'swiper': '^11.0.5',
      'stripe': '^14.14.0'
    },
    devDependencies: {
      '@types/node': '^20.11.0',
      'typescript': '^5.3.3',
      'autoprefixer': '^10.4.17',
      'postcss': '^8.4.33',
      'tailwindcss': '^3.4.1',
      'vitest': '^1.2.0',
      '@playwright/test': '^1.41.0',
      '@nuxt/test-utils': '^3.11.0'
    },
    scripts: {
      'dev': 'nuxt dev',
      'build': 'nuxt build',
      'generate': 'nuxt generate',
      'preview': 'nuxt preview',
      'postinstall': 'nuxt prepare',
      'test': 'vitest',
      'test:e2e': 'playwright test'
    },
    configFiles: ['nuxt.config.ts', 'tsconfig.json', 'app.config.ts', 'tailwind.config.js'],
    entryFile: 'app/app.vue',
    extensions: ['.ts', '.vue'],
    hasTypeScript: true
  }
};

export function getFrameworkChoices() {
  return Object.values(SUPPORTED_FRAMEWORKS).map(framework => ({
    title: framework.displayName,
    value: framework.name
  }));
}

export function getFrameworkConfig(framework: string): FrameworkConfig {
  const config = SUPPORTED_FRAMEWORKS[framework];
  if (!config) {
    throw new Error(`Unsupported framework: ${framework}`);
  }
  return config;
}

export function detectFramework(projectPath: string): string | null {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for framework-specific dependencies
    if (dependencies['@angular/core']) return 'angular';
    if (dependencies['vue']) return dependencies['typescript'] ? 'vue-ts' : 'vue';
    if (dependencies['svelte']) return dependencies['typescript'] ? 'svelte-ts' : 'svelte';
    if (dependencies['react']) return dependencies['typescript'] ? 'react-ts' : 'react';

    return null;
  } catch (error) {
    return null;
  }
}

export function validateFramework(framework: string): boolean {
  return framework in SUPPORTED_FRAMEWORKS;
}
