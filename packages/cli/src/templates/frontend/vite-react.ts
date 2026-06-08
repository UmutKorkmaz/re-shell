import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class ViteReactTemplate extends BaseTemplate {
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

    // Vite config
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig()
    });

    // TypeScript config
    if (hasTypeScript) {
      files.push({
        path: 'tsconfig.json',
        content: this.generateTsConfig()
      });

      files.push({
        path: 'tsconfig.node.json',
        content: this.generateTsConfigNode()
      });
    }

    // ESLint config
    files.push({
      path: '.eslintrc.cjs',
      content: this.generateEslintConfig()
    });

    // Prettier config
    files.push({
      path: '.prettierrc',
      content: this.generatePrettierConfig()
    });

    // Main entry
    files.push({
      path: 'src/main.tsx',
      content: this.generateMain()
    });

    // App component
    files.push({
      path: 'src/App.tsx',
      content: this.generateApp()
    });

    // Index CSS
    files.push({
      path: 'src/index.css',
      content: this.generateIndexCss()
    });

    // Page CSS files
    files.push({
      path: 'src/pages/Home.css',
      content: this.generateHomePageCss()
    });

    files.push({
      path: 'src/pages/About.css',
      content: this.generateAboutPageCss()
    });

    files.push({
      path: 'src/pages/Dashboard.css',
      content: this.generateDashboardPageCss()
    });

    files.push({
      path: 'src/pages/Counter.css',
      content: this.generateCounterPageCss()
    });

    files.push({
      path: 'src/pages/NotFound.css',
      content: this.generateNotFoundPageCss()
    });

    files.push({
      path: 'src/pages/Contact.css',
      content: this.generateContactPageCss()
    });

    // Components
    files.push({
      path: 'src/components/Header.tsx',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/components/Footer.tsx',
      content: this.generateFooter()
    });

    files.push({
      path: 'src/components/FeatureCard.tsx',
      content: this.generateFeatureCard()
    });

    files.push({
      path: 'src/components/ContactForm.tsx',
      content: this.generateContactForm()
    });

    // Pages
    files.push({
      path: 'src/pages/Home.tsx',
      content: this.generateHomePage()
    });

    files.push({
      path: 'src/pages/About.tsx',
      content: this.generateAboutPage()
    });

    files.push({
      path: 'src/pages/Dashboard.tsx',
      content: this.generateDashboardPage()
    });

    files.push({
      path: 'src/pages/Counter.tsx',
      content: this.generateCounterPage()
    });

    files.push({
      path: 'src/pages/Contact.tsx',
      content: this.generateContactPage()
    });

    files.push({
      path: 'src/pages/NotFound.tsx',
      content: this.generateNotFoundPage()
    });

    // Hooks
    files.push({
      path: 'src/hooks/useCounter.ts',
      content: this.generateUseCounter()
    });

    files.push({
      path: 'src/hooks/useFetch.ts',
      content: this.generateUseFetch()
    });

    files.push({
      path: 'src/hooks/useUsers.ts',
      content: this.generateUseUsers()
    });

    files.push({
      path: 'src/hooks/useProducts.ts',
      content: this.generateUseProducts()
    });

    // Zustand stores
    files.push({
      path: 'src/store/useAppStore.ts',
      content: this.generateAppStore()
    });

    files.push({
      path: 'src/store/useAuthStore.ts',
      content: this.generateAuthStore()
    });

    files.push({
      path: 'src/store/useUIStore.ts',
      content: this.generateUIStore()
    });

    // Utils
    files.push({
      path: 'src/utils/api.ts',
      content: this.generateApi()
    });

    files.push({
      path: 'src/utils/format.ts',
      content: this.generateFormat()
    });

    // Types
    if (hasTypeScript) {
      files.push({
        path: 'src/types/index.ts',
        content: this.generateTypes()
      });
    }

    // Assets
    files.push({
      path: 'public/vite.svg',
      content: this.generateViteSvg()
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

    // Nginx configuration for SPA routing
    files.push({
      path: 'nginx.conf',
      content: this.generateNginxConfig()
    });

    // Docker Compose
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // Test setup
    files.push({
      path: 'src/test-setup.ts',
      content: this.generateTestSetup()
    });

    // Test files
    files.push({
      path: 'src/components/__tests__/Header.test.tsx',
      content: this.generateHeaderTest()
    });

    files.push({
      path: 'src/hooks/__tests__/useCounter.test.ts',
      content: this.generateCounterTest()
    });

    files.push({
      path: 'src/pages/__tests__/Home.test.tsx',
      content: this.generateHomeTest()
    });

    // Storybook config
    files.push({
      path: '.storybook/main.ts',
      content: this.generateStorybookMain()
    });

    files.push({
      path: '.storybook/preview.ts',
      content: this.generateStorybookPreview()
    });

    // Story files
    files.push({
      path: 'src/stories/Header.stories.tsx',
      content: this.generateHeaderStories()
    });

    files.push({
      path: 'src/stories/FeatureCard.stories.tsx',
      content: this.generateFeatureCardStories()
    });

    files.push({
      path: 'src/stories/Button.stories.tsx',
      content: this.generateButtonStories()
    });

    // PWA Files
    files.push({
      path: 'public/manifest.json',
      content: this.generatePWAManifest()
    });

    files.push({
      path: 'public/icon-192x192.png',
      content: this.generateIcon192()
    });

    files.push({
      path: 'public/icon-512x512.png',
      content: this.generateIcon512()
    });

    files.push({
      path: 'src/pwa/registerSW.ts',
      content: this.generateRegisterSW()
    });

    files.push({
      path: 'src/pwa/PWAInstaller.tsx',
      content: this.generatePWAInstaller()
    });

    files.push({
      path: 'src/hooks/useServiceWorker.ts',
      content: this.generateUseServiceWorker()
    });

    files.push({
      path: 'scripts/generate-manifest.js',
      content: this.generateManifestScript()
    });

    files.push({
      path: 'public/offline.html',
      content: this.generateOfflinePage()
    });

    // Analytics Files
    files.push({
      path: 'src/lib/analytics/index.ts',
      content: this.generateAnalyticsIndex()
    });

    files.push({
      path: 'src/lib/analytics/google-analytics.ts',
      content: this.generateGoogleAnalytics()
    });

    files.push({
      path: 'src/lib/analytics/plausible.ts',
      content: this.generatePlausible()
    });

    files.push({
      path: 'src/lib/analytics/fathom.ts',
      content: this.generateFathom()
    });

    files.push({
      path: 'src/lib/analytics/types.ts',
      content: this.generateAnalyticsTypes()
    });

    files.push({
      path: 'src/components/Analytics.tsx',
      content: this.generateAnalyticsComponent()
    });

    files.push({
      path: 'src/hooks/useAnalytics.ts',
      content: this.generateUseAnalyticsHook()
    });

    files.push({
      path: '.env.analytics.example',
      content: this.generateAnalyticsEnvExample()
    });

    // Headless CMS Integration Files
    files.push({
      path: 'src/lib/cms/index.ts',
      content: this.generateCMSIndex()
    });

    files.push({
      path: 'src/lib/cms/types.ts',
      content: this.generateCMSTypes()
    });

    files.push({
      path: 'src/lib/cms/strapi.ts',
      content: this.generateStrapi()
    });

    files.push({
      path: 'src/lib/cms/contentful.ts',
      content: this.generateContentful()
    });

    files.push({
      path: 'src/lib/cms/sanity.ts',
      content: this.generateSanity()
    });

    files.push({
      path: 'src/hooks/useCMS.ts',
      content: this.generateUseCMSHook()
    });

    files.push({
      path: 'src/components/CMSProvider.tsx',
      content: this.generateCMSProvider()
    });

    files.push({
      path: '.env.cms.example',
      content: this.generateCMSEnvExample()
    });

    // Build Optimization & Image Processing Files
    files.push({
      path: 'vite.config.optimization.ts',
      content: this.generateOptimizedViteConfig()
    });

    files.push({
      path: 'src/utils/image-optimizer.ts',
      content: this.generateImageOptimizer()
    });

    files.push({
      path: 'src/utils/bundle-analyzer.ts',
      content: this.generateBundleAnalyzer()
    });

    files.push({
      path: 'src/components/OptimizedImage.tsx',
      content: this.generateOptimizedImage()
    });

    files.push({
      path: 'src/hooks/useImageOptimization.ts',
      content: this.generateUseImageOptimization()
    });

    files.push({
      path: 'src/utils/build-optimizer.ts',
      content: this.generateBuildOptimizer()
    });

    files.push({
      path: 'scripts/optimize-images.js',
      content: this.generateImageOptimizationScript()
    });

    files.push({
      path: 'scripts/generate-build-report.js',
      content: this.generateBuildReportScript()
    });

    // MDX Integration Files
    files.push({
      path: 'src/components/MDXProvider.tsx',
      content: this.generateMDXProvider()
    });

    files.push({
      path: 'src/components/mdx-components.tsx',
      content: this.generateMDXComponents()
    });

    files.push({
      path: 'src/hooks/useMDXComponents.ts',
      content: this.generateUseMDXComponentsHook()
    });

    files.push({
      path: 'vite-plugin-mdx.ts',
      content: this.generateMDXVitePlugin()
    });

    files.push({
      path: 'types/mdx.d.ts',
      content: this.generateMDXTypes()
    });

    files.push({
      path: 'content/example.mdx',
      content: this.generateMDXExample()
    });

    // Emotion Theme & Styling Configuration Files
    files.push({
      path: 'src/styles/theme.ts',
      content: this.generateEmotionTheme()
    });

    files.push({
      path: 'src/styles/globalStyles.ts',
      content: this.generateGlobalStyles()
    });

    files.push({
      path: 'src/styles/variables.ts',
      content: this.generateStyleVariables()
    });

    files.push({
      path: 'src/styles/mixins.ts',
      content: this.generateStyleMixins()
    });

    files.push({
      path: 'src/components/ThemeProvider.tsx',
      content: this.generateThemeProvider()
    });

    files.push({
      path: 'src/hooks/useTheme.ts',
      content: this.generateUseThemeHook()
    });

    files.push({
      path: 'src/hooks/useMediaQuery.ts',
      content: this.generateUseMediaQueryHook()
    });

    files.push({
      path: 'src/styles/reset.ts',
      content: this.generateResetStyles()
    });

    // React Native Web Integration Files
    files.push({
      path: 'src/components/native/View.tsx',
      content: this.generateRNView()
    });

    files.push({
      path: 'src/components/native/Text.tsx',
      content: this.generateRNText()
    });

    files.push({
      path: 'src/components/native/Image.tsx',
      content: this.generateRNImage()
    });

    files.push({
      path: 'src/components/native/ScrollView.tsx',
      content: this.generateRNScrollView()
    });

    files.push({
      path: 'src/components/native/ActivityIndicator.tsx',
      content: this.generateRNActivityIndicator()
    });

    files.push({
      path: 'src/components/native/StyleSheet.ts',
      content: this.generateRNStyleSheet()
    });

    files.push({
      path: 'src/components/native/Platform.ts',
      content: this.generateRNPlatform()
    });

    files.push({
      path: 'src/components/native/useWindowDimensions.ts',
      content: this.generateRNUseWindowDimensions()
    });

    files.push({
      path: 'src/pages/NativeDemo.tsx',
      content: this.generateNativeDemoPage()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        'build:analyze': 'vite build --mode analyze',
        'build:optimized': 'vite build --mode production',
        'optimize:images': 'node scripts/optimize-images.js',
        'report:build': 'node scripts/generate-build-report.js',
        lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
        preview: 'vite preview',
        format: 'prettier --write "src/**/*.{ts,tsx,css,md}"',
        test: 'vitest',
        'test:ui': 'vitest --ui',
        'test:run': 'vitest run',
        storybook: 'storybook dev -p 6006',
        'build-storybook': 'storybook build',
        'pwa:generate': 'vite-plugin-pwa',
        'pwa:manifest': 'node scripts/generate-manifest.js'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.22.0',
        '@tanstack/react-query': '^5.17.0',
        'zustand': '^4.5.0',
        'react-hook-form': '^7.49.0',
        '@emotion/react': '^11.11.0',
        '@emotion/styled': '^11.11.0',
        'workbox-window': '^7.0.0',
        // Analytics - Google Analytics (via gtag)
        // Analytics - Plausible & Fathom are script-based, no npm packages needed
        'gatsby-plugin-plausible': '^3.10.0',
        // Headless CMS SDKs
        '@strapi/sdk-js': '^2.0.0',
        'contentful': '^10.6.0',
        '@sanity/client': '^6.10.0',
        '@sanity/image-url': '^1.0.2',
        // Image optimization
        'react-image': '^4.1.0',
        'blurhash': '^2.0.5',
        // MDX support
        '@mdx-js/react': '^3.0.1',
        '@mdx-js/rollup': '^3.0.1',
        // React Native Web for cross-platform components
        'react-native-web': '^0.19.10'
      },
      devDependencies: {
        '@types/react': '^18.2.48',
        '@types/react-dom': '^18.2.18',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        '@vitejs/plugin-react': '^4.2.1',
        eslint: '^8.56.0',
        'eslint-plugin-react-hooks': '^4.6.0',
        'eslint-plugin-react-refresh': '^0.4.5',
        prettier: '^3.2.4',
        typescript: '^5.3.3',
        vite: '^5.0.12',
        'vite-plugin-pwa': '^0.17.0',
        'rollup-plugin-visualizer': '^5.11.0',
        '@testing-library/react': '^14.1.0',
        '@testing-library/jest-dom': '^6.1.5',
        '@testing-library/user-event': '^14.5.1',
        vitest: '^1.2.0',
        '@vitest/ui': '^1.2.0',
        jsdom: '^23.0.1',
        msw: '^2.0.0',
        '@storybook/react': '^7.10.0',
        '@storybook/react-vite': '^7.10.0',
        '@storybook/addon-essentials': '^7.10.0',
        '@storybook/addon-interactions': '^7.10.0',
        '@storybook/addon-links': '^7.10.0',
        '@storybook/addon-themes': '^7.10.0',
        '@storybook/testing-library': '^0.2.0',
        storybook: '^7.10.0',
        '@tanstack/react-query-devtools': '^5.17.0',
        // Image optimization
        'vite-plugin-imagemin': '^0.6.1',
        'imagemin-webp': '^8.0.0',
        'imagemin-mozjpeg': '^10.0.0',
        'imagemin-pngquant': '^10.0.0',
        'imagemin-svgo': '^10.0.1',
        'sharp': '^0.33.0',
        '@types/sharp': '^0.0.39',
        // MDX
        '@mdx-js/rollup': '^3.0.1',
        '@mdx-js/react': '^3.0.1',
        '@types/mdx': '^2.0.11',
        'remark-gfm': '^4.0.0',
        'rehype-slug': '^6.0.0',
        'rehype-autolink-headings': '^7.1.0',
        'rehype-pretty-code': '^0.12.0'
      }
    };
  }

  protected generateViteConfig() {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    // Bundle analyzer - generates stats.html and stats.json in dist/analyze
    visualizer({
      filename: 'dist/analyze/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    // PWA Plugin - generates service worker and manifest
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: '${this.context.name}',
        short_name: '${this.context.normalizedName}',
        description: '${this.context.name} - A Progressive Web App',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https://api\\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https://fonts\\.(?:googleapis|gstatic)\\.com\\/./i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@store': path.resolve(__dirname, './src/store'),
    },
  },
  server: {
    port: ${this.context.port || 5173},
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React vendor chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // React Router chunk
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor';
          }
          // Other node_modules go to vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
  },
});
`;
  }

  protected generateTsConfig() {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,

          /* Bundler mode */
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',

          /* Linting */
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,

          /* Path Mapping */
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
            '@components/*': ['./src/components/*'],
            '@hooks/*': ['./src/hooks/*'],
            '@utils/*': ['./src/utils/*'],
            '@types/*': ['./src/types/*'],
            '@store/*': ['./src/store/*'],
          },
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }],
      },
      null,
      2
    );
  }

  protected generateTsConfigNode() {
    return JSON.stringify(
      {
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          allowSyntheticDefaultImports: true,
        },
        include: ['vite.config.ts'],
      },
      null,
      2
    );
  }

  protected generateEslintConfig() {
    return `module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
};
`;
  }

  protected generatePrettierConfig() {
    return JSON.stringify(
      {
        semi: true,
        trailingComma: 'es5',
        singleQuote: true,
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
      },
      null,
      2
    );
  }

  protected generateMain() {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
`;
  }

  protected generateApp() {
    return `import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Header } from '@components/Header';
import { Footer } from '@components/Footer';
import './App.css';

// Lazy load route components for code splitting
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Counter = lazy(() => import('./pages/Counter'));
const Contact = lazy(() => import('./pages/Contact'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading component for Suspense fallback
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
}

// Error boundary for route errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <Link to="/">Go Home</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="app">
          <Header />
          <main className="main-content">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/counter" element={<Counter />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
`;
  }

  protected generateIndexCss() {
    return `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
}

#root {
  min-height: 100vh;
}

a {
  color: #646cff;
  text-decoration: none;
}

a:hover {
  color: #535bf2;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: white;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

/* Button variants */
.btn {
  display: inline-block;
  padding: 0.75em 1.5em;
  border-radius: 8px;
  border: none;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background-color: #e0e0e0;
}

.btn-tertiary {
  background-color: transparent;
  border: 1px solid #667eea;
  color: #667eea;
}

.btn-tertiary:hover {
  background-color: #667eea;
  color: white;
}

/* Page loader */
.page-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.page-loader p {
  margin-top: 1rem;
  color: #666;
}

/* Error boundary */
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  padding: 2rem;
  text-align: center;
}

.error-boundary h1 {
  color: #e74c3c;
  margin-bottom: 1rem;
}

.error-boundary a {
  margin-top: 1rem;
  color: #667eea;
  text-decoration: none;
}

.error-boundary a:hover {
  text-decoration: underline;
}
`;
  }

  protected generateHeader() {
    return `import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

interface HeaderProps {
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Header: FunctionComponent<HeaderProps> = ({ theme, onToggleTheme }) => {
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Link to="/">
            <span className="logo-icon">⚛️</span>
            <span className="logo-text">${this.context.name}</span>
          </Link>
        </div>

        <nav className="nav">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
          <Link to="/counter" className="nav-link">Counter</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
          {onToggleTheme && (
            <button onClick={onToggleTheme} className="theme-toggle">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
`;
  }

  protected generateFooter() {
    return `import { FunctionComponent } from 'react';
import './Footer.css';

export const Footer: FunctionComponent = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <p>&copy; {currentYear} ${this.context.name}. Built with React + Vite.</p>
        <div className="footer-links">
          <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">
            Vite Docs
          </a>
          <span>•</span>
          <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
            React Docs
          </a>
        </div>
      </div>
    </footer>
  );
};
`;
  }

  protected generateFeatureCard() {
    return `import { FunctionComponent } from 'react';
import './FeatureCard.css';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

export const FeatureCard: FunctionComponent<FeatureCardProps> = ({
  icon,
  title,
  description,
}) => {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{description}</p>
    </div>
  );
};
`;
  }

  protected generateUseCounter() {
    return `import { useState, useCallback } from 'react';

export const useCounter = (initialValue: number = 0) => {
  const [count, setCount] = useState<number>(initialValue);

  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(prev => prev - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return {
    count,
    increment,
    decrement,
    reset,
  };
};
`;
  }

  protected generateUseFetch() {
    return `import { useState, useEffect, useCallback } from 'react';

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFetch<T>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
`;
  }

  protected generateApi() {
    return `const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://jsonplaceholder.typicode.com';

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async delete(endpoint: string): Promise<void> {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
  },
};
`;
  }

  protected generateFormat() {
    return `export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
`;
  }

  protected generateTypes() {
    return `export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
`;
  }

  protected generateViteSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>`;
  }

  protected generateEnvExample() {
    return `# Vite Environment Variables
# https://vitejs.dev/guide/env-and-mode.html

# API Configuration
VITE_API_URL=https://jsonplaceholder.typicode.com
VITE_API_KEY=your-api-key-here

# Feature Flags
VITE_ENABLE_DARKMODE=true
VITE_ENABLE_ANALYTICS=false

# Build Configuration
NODE_ENV=development
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with React 18, Vite 5, TypeScript, and modern tooling for lightning-fast development experience.

## Features

- **React 18** - Latest React with concurrent features
- **TypeScript** - Full type safety
- **Vite 5** - Lightning-fast HMR and optimized builds
- **React Router 6** - Client-side routing with lazy loading
- **TanStack Query** - Powerful server state management with caching and synchronization
- **Zustand** - Lightweight client state management with persistence
- **React Hook Form** - Performant form management with validation
- **Emotion** - CSS-in-JS styling with styled components and css prop
- **ESLint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **Bundle Analysis** - Visualize bundle composition with rollup-plugin-visualizer
- **Path Aliases** - Clean imports with @, @components, @hooks, @utils, @store
- **Hooks** - Custom React hooks (useCounter, useFetch, useUsers, useProducts)
- **Stores** - Zustand stores (useAppStore, useAuthStore, useUIStore)
- **Code Splitting** - Optimized bundle size with route-based splitting
- **Hot Module Replacement** - Instant feedback during development

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
vite
\`\`\`

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

\`\`\`bash
npm run build
# or
tsc && vite build
\`\`\`

The build artifacts will be stored in the \`dist/\` directory.

### Preview

\`\`\`bash
npm run preview
# or
vite preview
\`\`\`

### Linting

\`\`\`bash
npm run lint
\`\`\`

### Formatting

\`\`\`bash
npm run format
\`\`\`

### Bundle Analysis

Analyze your bundle size and composition:

\`\`\`bash
npm run build:analyze
\`\`\`

This will generate:
- \`dist/analyze/stats.html\` - Interactive treemap visualization
- \`dist/analyze/stats.json\` - Detailed bundle statistics

Open \`dist/analyze/stats.html\` in your browser to explore:
- Module dependencies and sizes
- Gzip and Brotli compression sizes
- Code splitting effectiveness
- Large dependencies that may need optimization

The visualizer helps you:
- Identify bloated dependencies
- Verify code splitting is working
- Find opportunities to reduce bundle size
- Track bundle size changes over time

## Project Structure

\`\`\`
src/
├── components/         # React components
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── FeatureCard.tsx
│   └── ContactForm.tsx
├── hooks/             # Custom React hooks
│   ├── useCounter.ts
│   ├── useFetch.ts
│   ├── useUsers.ts
│   └── useProducts.ts
├── store/             # Zustand state stores
│   ├── useAppStore.ts
│   ├── useAuthStore.ts
│   └── useUIStore.ts
├── pages/             # Route components
│   ├── Home.tsx
│   ├── About.tsx
│   ├── Dashboard.tsx
│   ├── Counter.tsx
│   ├── Contact.tsx
│   └── NotFound.tsx
├── utils/             # Utility functions
│   ├── api.ts
│   └── format.ts
├── types/             # TypeScript types
│   └── index.ts
├── App.tsx            # Root component
├── App.css            # App styles
├── main.tsx           # Entry point
└── index.css          # Global styles
\`\`\`

## Path Aliases

Clean imports with path mapping:

\`\`\`typescript
// Instead of:
import { Header } from '../../../components/Header';

// Use:
import { Header } from '@components/Header';
\`\`\`

Available aliases:
- \`@\` → \`src/*\`
- \`@components\` → \`src/components/*\`
- \`@hooks\` → \`src/hooks/*\`
- \`@utils\` → \`src/utils/*\`
- \`@types\` → \`src/types/*\`

## Custom Hooks

### useCounter

\`\`\`typescript
import { useCounter } from '@hooks/useCounter';

function MyComponent() {
  const { count, increment, decrement, reset } = useCounter(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
\`\`\`

### useFetch

\`\`\`typescript
import { useFetch } from '@hooks/useFetch';

function Posts() {
  const { data, loading, error } = useFetch<Post[]>('/posts');

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <ul>
      {data?.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
\`\`\`

## TanStack Query (React Query)

TanStack Query provides powerful server state management with automatic caching, background updates, and request deduplication.

### React Query DevTools

This template includes React Query DevTools for debugging and inspecting your queries during development. The DevTools panel can be toggled by clicking the React Query icon in the browser or by pressing the keyboard shortcut.

Features:
- **Query Inspector**: View all active queries, their states, and cached data
- **Mutation Inspector**: Monitor mutations and their status
- **Query Explorer**: Browse query keys and inspect query details
- **DevTools Settings**: Customize the DevTools behavior and appearance

The DevTools are only included in development mode and automatically excluded from production builds.



### useUsers Hook

\`\`\`typescript
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '@hooks/useUsers';

function UserList() {
  const { data: users, isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>
          <span>{user.name}</span>
          <button onClick={() => deleteUser.mutate(user.id)}>Delete</button>
        </div>
      ))}
      <button onClick={() => createUser.mutate({
        name: 'New User',
        email: 'user@example.com',
        password: 'password123',
        role: 'user'
      })}>
        Add User
      </button>
    </div>
  );
}
\`\`\`

### useProducts Hook

\`\`\`typescript
import { useProducts, useCreateProduct } from '@hooks/useProducts';

function ProductList() {
  const { data: products, isLoading } = useProducts();
  const createProduct = useCreateProduct();

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      {products?.map(product => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          <p>\${product.price}</p>
        </div>
      ))}
      <button onClick={() => createProduct.mutate({
        name: 'New Product',
        description: 'Product description',
        price: 99.99
      })}>
        Add Product
      </button>
    </div>
  );
}
\`\`\`

### Query Configuration

The QueryClient is configured in \`main.tsx\` with sensible defaults:

- **staleTime**: 5 minutes - Data remains fresh for 5 minutes
- **gcTime**: 10 minutes - Inactive queries are cached for 10 minutes
- **retry**: 1 - Failed requests retry once
- **refetchOnWindowFocus**: false - No automatic refetch on window focus

You can customize these defaults per query:

\`\`\`typescript
const { data } = useQuery({
  queryKey: ['custom', 'key'],
  queryFn: () => fetch('/api').then(r => r.json()),
  staleTime: 1000 * 60, // 1 minute
  refetchInterval: 2000, // Refetch every 2 seconds
});
\`\`\`

## Zustand State Management

Zustand provides a simple and type-safe way to manage client-side state with minimal boilerplate.

### useAppStore

Global application state with persistence:

\`\`\`typescript
import { useAppStore } from '@store/useAppStore';

function UserProfile() {
  const { user, setUser, clearUser } = useAppStore();
  const { notifications, addNotification } = useAppStore();

  const handleLogin = (userData) => {
    setUser(userData);
    addNotification({
      message: 'Welcome back!',
      type: 'success',
    });
  };

  return (
    <div>
      {user ? (
        <p>Welcome, {user.name}</p>
      ) : (
        <button onClick={() => handleLogin({ id: '1', name: 'John', email: 'john@example.com', role: 'user' })}>
          Login
        </button>
      )}
    </div>
  );
}
\`\`\`

### useAuthStore

Authentication state with automatic token management:

\`\`\`typescript
import { useAuthStore } from '@store/useAuthStore';

function LoginForm() {
  const { login, logout, isAuthenticated, user } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    await login(email, password);
  };

  if (isAuthenticated) {
    return (
      <div>
        <p>Welcome, {user?.name}</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      <button type="submit">Login</button>
    </form>
  );
}
\`\`\`

### useUIStore

UI state for theme, language, loading, and modals:

\`\`\`typescript
import { useUIStore } from '@store/useUIStore';

function Settings() {
  const { theme, setTheme, language, setLanguage, openModal } = useUIStore();

  return (
    <div>
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
      <button onClick={() => openModal('Help', 'This is help content')}>
        Show Help
      </button>
    </div>
  );
}
\`\`\`

### Store Persistence

The \`useAppStore\` and \`useAuthStore\` use Zustand's persist middleware to automatically save state to localStorage:

\`\`\`typescript
persist(
  (set, get) => ({
    // store state
  }),
  {
    name: 'app-storage', // localStorage key
    partialize: (state) => ({  // Optional: pick specific state to persist
      user: state.user,
      sidebarOpen: state.sidebarOpen,
    }),
  }
)
\`\`\`

## React Hook Form

React Hook Form provides performant form management with minimal re-renders and easy validation.

### ContactForm Component

The template includes a pre-built ContactForm component with validation:

\`\`\`typescript
import { ContactForm } from '@components/ContactForm';

function ContactPage() {
  const handleSubmit = async (data) => {
    // Send data to API
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  return <ContactForm onSubmit={handleSubmit} />;
}
\`\`\`

### Form Validation

The ContactForm includes built-in validation:

- **Name**: Required, minimum 2 characters
- **Email**: Required, valid email format
- **Subject**: Required, minimum 5 characters
- **Message**: Required, minimum 10 characters

### Creating Custom Forms

Use React Hook Form to create your own forms:

\`\`\`typescript
import { useForm, SubmitHandler } from 'react-hook-form';

interface FormData {
  username: string;
  email: string;
  age: number;
}

function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit: SubmitHandler<FormData> = (data) => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('username', { required: 'Username is required' })}
        placeholder="Username"
      />
      {errors.username && <span>{errors.username.message}</span>}

      <input
        {...register('email', {
          required: 'Email is required',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i,
            message: 'Invalid email address',
          },
        })}
        placeholder="Email"
      />
      {errors.email && <span>{errors.email.message}</span>}

      <input
        type="number"
        {...register('age', {
          required: 'Age is required',
          min: { value: 18, message: 'Must be 18 or older' },
        })}
      />
      {errors.age && <span>{errors.age.message}</span>}

      <button type="submit">Submit</button>
    </form>
  );
}
\`\`\`

### Form State Management

Access form state and control submission:

\`\`\`typescript
const {
  register,
  handleSubmit,
  formState: {
    errors,
    isSubmitting,
    isValid,
    isDirty,
    touchedFields,
  },
  reset,
  setValue,
  watch,
} = useForm<FormData>();

// Watch field changes
const emailValue = watch('email');

// Set field value programmatically
setValue('username', 'johndoe');

// Reset form
reset();

// Check if form is valid
if (isValid) {
  // Form is valid
}
\`\`\`

### Advanced Validation

Use schema validation with Zod or Yup:

\`\`\`bash
npm install zod @hookform/resolvers
\`\`\`

\`\`\`typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  age: z.number().min(18),
});

function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  // ... rest of component
}
\`\`\`

## Environment Variables

Create a \`.env\` file in the root directory:

\`\`\`env
VITE_API_URL=https://api.example.com
VITE_API_KEY=your-key-here
\`\`\`

Access in code:

\`\`\`typescript
const apiUrl = import.meta.env.VITE_API_URL;
\`\`\`

## TypeScript Configuration

- **Strict mode** enabled
- **Path aliases** configured
- **JSX** set to react-jsx
- **No unused locals/parameters**

## Emotion CSS-in-JS

Emotion is a performant and flexible CSS-in-JS library that allows you to style components with JavaScript. This template is configured to use both styled components and the css prop.

### Configuration

Emotion is already configured in \`vite.config.ts\`:

\`\`\`typescript
react({
  jsxImportSource: '@emotion/react',
  babel: {
    plugins: ['@emotion/babel-plugin'],
  },
})
\`\`\`

This configuration enables:
- **jsxImportSource**: Tells React to use Emotion's JSX runtime
- **babel plugin**: Enables the css prop and optimizes styles

### Using Styled Components

Create styled components using \`@emotion/styled\`:

\`\`\`typescript
import styled from '@emotion/styled';

const Button = styled.button\`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75em 1.5em;
  font-size: 1em;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  \${(props) => props.disabled && \`
    opacity: 0.6;
    cursor: not-allowed;
  \`}
\`;

interface ButtonProps {
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

function MyButton({ disabled, onClick, children }: ButtonProps) {
  return <Button disabled={disabled} onClick={onClick}>{children}</Button>;
}
\`\`\`

### Using the CSS Prop

The css prop allows you to style any element inline:

\`\`\`typescript
import { css } from '@emotion/react';

const buttonStyle = css\`
  background: #667eea;
  color: white;
  padding: 0.75em 1.5em;
  border: none;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #5568d3;
  }
\`;

function MyComponent() {
  return (
    <button css={buttonStyle}>
      Click me
    </button>
  );
}
\`\`\`

### Dynamic Styles

Emotion makes it easy to create dynamic styles based on props:

\`\`\`typescript
import styled from '@emotion/styled';

const Card = styled.div<(props: { variant: 'primary' | 'secondary' })>\`
  padding: 1.5rem;
  border-radius: 8px;
  background: \${(props) =>
    props.variant === 'primary' ? '#667eea' : '#764ba2'};
  color: white;
\`;

function App() {
  return (
    <div>
      <Card variant="primary">Primary Card</Card>
      <Card variant="secondary">Secondary Card</Card>
    </div>
  );
}
\`\`\`

### Composition

Compose styles from other styled components:

\`\`\`typescript
import styled from '@emotion/styled';

const BaseButton = styled.button\`
  padding: 0.75em 1.5em;
  border: none;
  border-radius: 8px;
  font-size: 1em;
  cursor: pointer;
\`;

const PrimaryButton = styled(BaseButton)\`
  background: #667eea;
  color: white;

  &:hover {
    background: #5568d3;
  }
\`;

const SecondaryButton = styled(BaseButton)\`
  background: #f0f0f0;
  color: #333;

  &:hover {
    background: #e0e0e0;
  }
\`;
\`\`\`

### Theme Support

Use Emotion's ThemeProvider for consistent theming:

\`\`\`typescript
import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';

const theme = {
  colors: {
    primary: '#667eea',
    secondary: '#764ba2',
    text: '#333',
    background: '#fff',
  },
  spacing: {
    small: '0.5rem',
    medium: '1rem',
    large: '2rem',
  },
};

const ThemedButton = styled.button\`
  background: \${(props) => props.theme.colors.primary};
  color: white;
  padding: \${(props) => props.theme.spacing.medium};
  border: none;
  border-radius: 8px;
\`;

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ThemedButton>Themed Button</ThemedButton>
    </ThemeProvider>
  );
}
\`\`\`

### Responsive Design

Create responsive styles with Emotion:

\`\`\`typescript
import styled from '@emotion/styled';

const ResponsiveContainer = styled.div\`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
\`;
\`\`\`

### Global Styles

Apply global styles with \`@emotion/react\`:

\`\`\`typescript
import { Global, css } from '@emotion/react';

const globalStyles = css\`
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  code {
    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
      monospace;
  }
\`;

function App() {
  return (
    <>
      <Global styles={globalStyles} />
      {/* Your app content */}
    </>
  );
}
\`\`\`

### Type Safety

Emotion works seamlessly with TypeScript:

\`\`\`typescript
import styled from '@emotion/styled';

interface CardProps {
  padding?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary';
}

const Card = styled.div<CardProps>\`
  padding: \${(props) => {
    switch (props.padding) {
      case 'small':
        return '0.5rem';
      case 'medium':
        return '1rem';
      case 'large':
        return '2rem';
      default:
        return '1rem';
    }
  }};
  background: \${(props) =>
    props.variant === 'primary' ? '#667eea' : '#764ba2'};
  border-radius: 8px;
\`;

// Usage with full type safety
<Card padding="large" variant="primary">
  Content
</Card>
\`\`\`

### Best Practices

1. **Use styled components for reusable UI elements**
   - Create a library of styled components for buttons, cards, inputs, etc.
   - Keep them in a dedicated \`src/components/ui\` directory

2. **Use the css prop for one-off styles**
   - Perfect for component-specific overrides
   - Great for dynamic styles based on state

3. **Extract common styles**
   - Use composition to avoid repeating styles
   - Create base components and extend them

4. **Use ThemeProvider for global design tokens**
   - Define colors, spacing, typography in one place
   - Access theme values in any styled component

5. **Keep styles co-located**
   - Define styles near where they're used
   - Improves maintainability and reduces context switching

### Migration from CSS Modules

Migrating from CSS modules to Emotion is straightforward:

**Before (CSS Modules):**
\`\`\`typescript
import styles from './Button.module.css';

function Button() {
  return <button className={styles.button}>Click me</button>;
}
\`\`\`

**After (Emotion):**
\`\`\`typescript
import styled from '@emotion/styled';

const StyledButton = styled.button\`
  /* same styles as before */
\`;

function Button() {
  return <StyledButton>Click me</StyledButton>;
}
\`\`\`

## Vite Configuration

- **React plugin** with fast refresh
- **Path aliases** for clean imports
- **Code splitting** for vendor chunks
- **Bundle analyzer** with rollup-plugin-visualizer
- **Source maps** for debugging
- **Development server** on port 5173

## Docker

### Build

\`\`\`bash
docker build -t ${this.context.normalizedName} .
\`\`\`

### Run

\`\`\`bash
docker run -p 80:80 ${this.context.normalizedName}
\`\`\`

### Docker Compose

\`\`\`bash
docker-compose up
\`\`\`

## Deployment

Deploy to any hosting service:

- **Vercel**: Zero-config deployment
- **Netlify**: Full-stack support
- **AWS**: S3, CloudFront, Amplify
- **Google Cloud**: Firebase, App Engine
- **Azure**: Static Web Apps
- **GitHub Pages**: Static hosting

\`\`\`bash
# Build for production
npm run build

# Output in dist/ directory
# Deploy dist/ folder to your hosting service
\`\`\`

## Documentation

- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Vite React SPA

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
`;
  }

  protected generateHomePage() {
    return `import { Link } from 'react-router-dom';
import { FeatureCard } from '@components/FeatureCard';
import './Home.css';

export default function Home() {
  return (
    <div className="home-page">
      <section className="hero">
        <h1>Welcome to ${this.context.name}</h1>
        <p>A modern React application with Vite, TypeScript, and React Router</p>
        <div className="cta-buttons">
          <Link to="/dashboard" className="btn btn-primary">
            Go to Dashboard
          </Link>
          <Link to="/about" className="btn btn-secondary">
            Learn More
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>Features</h2>
        <div className="feature-grid">
          <FeatureCard
            icon="⚡"
            title="Lightning Fast HMR"
            description="Hot Module Replacement with Vite for instant feedback"
          />
          <FeatureCard
            icon="🔧"
            title="TypeScript"
            description="Type-safe development with full IntelliSense support"
          />
          <FeatureCard
            icon="🚀"
            title="React Router"
            description="Client-side routing with lazy loading and code splitting"
          />
          <FeatureCard
            icon="📦"
            title="Optimized Builds"
            description="Production-optimized bundles with automatic code splitting"
          />
        </div>
      </section>

      <section className="tech-stack">
        <h2>Tech Stack</h2>
        <ul>
          <li><strong>React 18</strong> - Latest React with concurrent features</li>
          <li><strong>TypeScript</strong> - Type-safe development</li>
          <li><strong>React Router 6</strong> - Client-side routing with lazy loading</li>
          <li><strong>Vite 5</strong> - Lightning-fast build tool</li>
          <li><strong>ESLint</strong> - Code linting and quality</li>
          <li><strong>Prettier</strong> - Code formatting</li>
        </ul>
      </section>
    </div>
  );
}
`;
  }

  protected generateAboutPage() {
    return `import { Link } from 'react-router-dom';
import './About.css';

export default function About() {
  return (
    <div className="about-page">
      <section className="about-hero">
        <h1>About This Project</h1>
        <p>A modern React application built with best practices and cutting-edge tools</p>
      </section>

      <section className="about-content">
        <h2>Project Overview</h2>
        <p>
          This is a React application built with Vite for fast development and optimized production builds.
          It includes React Router for navigation with lazy-loaded route components for optimal performance.
        </p>

        <h2>Key Features</h2>
        <ul>
          <li><strong>Client-side Routing:</strong> React Router with lazy loading for code splitting</li>
          <li><strong>TypeScript:</strong> Full type safety and excellent IDE support</li>
          <li><strong>Fast HMR:</strong> Vite provides instant hot module replacement</li>
          <li><strong>Code Splitting:</strong> Automatic route-based code splitting</li>
          <li><strong>Error Boundaries:</strong> Graceful error handling</li>
          <li><strong>Loading States:</strong> Suspense with loading fallbacks</li>
        </ul>

        <h2>Getting Started</h2>
        <p>
          The project includes several example routes demonstrating different features:
        </p>
        <ul>
          <li><Link to="/">Home</Link> - Landing page with feature overview</li>
          <li><Link to="/dashboard">Dashboard</Link> - Protected route example</li>
          <li><Link to="/counter">Counter</Link> - State management demo</li>
        </ul>

        <div className="back-link">
          <Link to="/">← Back to Home</Link>
        </div>
      </section>
    </div>
  );
}
`;
  }

  protected generateDashboardPage() {
    return `import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

interface DashboardData {
  users: number;
  revenue: number;
  orders: number;
  conversion: number;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    users: 0,
    revenue: 0,
    orders: 0,
    conversion: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setData({
        users: 1234,
        revenue: 45678,
        orders: 789,
        conversion: 3.2
      });
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="page-loader">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <Link to="/" className="back-link">← Back</Link>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Total Users</h3>
          <p className="stat-value">{data.users.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Revenue</h3>
          <p className="stat-value">\${data.revenue.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Orders</h3>
          <p className="stat-value">{data.orders.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>Conversion Rate</h3>
          <p className="stat-value">{data.conversion}%</p>
        </div>
      </div>

      <div className="dashboard-content">
        <h2>Recent Activity</h2>
        <p className="placeholder-text">
          Dashboard functionality with real-time data updates coming soon.
        </p>
      </div>
    </div>
  );
}
`;
  }

  protected generateCounterPage() {
    return `import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCounter } from '@hooks/useCounter';
import './Counter.css';

export default function Counter() {
  const { count, increment, decrement, reset } = useCounter();

  return (
    <div className="counter-page">
      <div className="counter-header">
        <h1>Counter Demo</h1>
        <Link to="/" className="back-link">← Back</Link>
      </div>

      <div className="counter-content">
        <div className="counter-display">
          <h2>Count: {count}</h2>
        </div>

        <div className="counter-controls">
          <button onClick={decrement} className="btn btn-secondary">
            Decrease
          </button>
          <button onClick={reset} className="btn btn-tertiary">
            Reset
          </button>
          <button onClick={increment} className="btn btn-primary">
            Increase
          </button>
        </div>

        <div className="counter-info">
          <h3>About This Demo</h3>
          <p>
            This demonstrates a custom React hook (\`useCounter\`) that manages counter state
            with increment, decrement, and reset functionality. The state is preserved
            during navigation thanks to React Router's component lifecycle.
          </p>
        </div>
      </div>
    </div>
  );
}
`;
  }

  protected generateNotFoundPage() {
    return `import { Link } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    </div>
  );
}
`;
  }

  protected generateHomePageCss() {
    return `.home-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.home-page .hero {
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
  margin-bottom: 3rem;
}

.home-page .hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.home-page .hero p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.home-page .cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.home-page .features {
  margin-bottom: 3rem;
}

.home-page .features h2 {
  text-align: center;
  margin-bottom: 2rem;
  font-size: 2rem;
}

.home-page .feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.home-page .tech-stack {
  background: #f5f5f5;
  padding: 2rem;
  border-radius: 8px;
}

.home-page .tech-stack h2 {
  margin-bottom: 1rem;
}

.home-page .tech-stack ul {
  list-style: none;
  padding: 0;
}

.home-page .tech-stack li {
  padding: 0.5rem 0;
}

.home-page .tech-stack strong {
  color: #667eea;
}
`;
  }

  protected generateAboutPageCss() {
    return `.about-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.about-page .about-hero {
  text-align: center;
  margin-bottom: 3rem;
}

.about-page .about-hero h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.about-page .about-hero p {
  font-size: 1.25rem;
  color: #666;
}

.about-page .about-content h2 {
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #333;
}

.about-page .about-content p {
  line-height: 1.6;
  color: #666;
  margin-bottom: 1rem;
}

.about-page .about-content ul {
  margin-bottom: 1.5rem;
  padding-left: 1.5rem;
}

.about-page .about-content li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.about-page .back-link {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid #eee;
}

.about-page a {
  color: #667eea;
  text-decoration: none;
}

.about-page a:hover {
  text-decoration: underline;
}
`;
  }

  protected generateDashboardPageCss() {
    return `.dashboard-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-page .dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-page .back-link {
  color: #667eea;
  text-decoration: none;
}

.dashboard-page .dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.dashboard-page .stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.dashboard-page .stat-card:hover {
  transform: translateY(-2px);
}

.dashboard-page .stat-card h3 {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dashboard-page .stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
}

.dashboard-page .dashboard-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dashboard-page .placeholder-text {
  color: #666;
  font-style: italic;
}
`;
  }

  protected generateCounterPageCss() {
    return `.counter-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.counter-page .counter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.counter-page .back-link {
  color: #667eea;
  text-decoration: none;
}

.counter-page .counter-content {
  text-align: center;
}

.counter-page .counter-display {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.counter-page .counter-display h2 {
  font-size: 3rem;
  margin: 0;
}

.counter-page .counter-controls {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.counter-page .counter-info {
  background: #f5f5f5;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: left;
}

.counter-page .counter-info h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.counter-page .counter-info p {
  line-height: 1.6;
  color: #666;
}
`;
  }

  protected generateNotFoundPageCss() {
    return `.not-found-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.not-found-content {
  text-align: center;
  max-width: 500px;
}

.not-found-content h1 {
  font-size: 6rem;
  margin: 0;
  color: #667eea;
}

.not-found-content h2 {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #333;
}

.not-found-content p {
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}
`;
  }

  protected generateUseUsers() {
    return `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: string;
}

interface UpdateUserData {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

// Fetch all users
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<User[]> => {
      const response = await fetch('/api/v1/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      return data.data;
    },
  });
}

// Fetch single user
export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async (): Promise<User> => {
      const response = await fetch(\`/api/v1/users/\${id}\`);
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// Create user mutation
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: CreateUserData): Promise<User> => {
      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        throw new Error('Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Update user mutation
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...userData }: UpdateUserData): Promise<User> => {
      const response = await fetch(\`/api/v1/users/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        throw new Error('Failed to update user');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', variables.id] });
    },
  });
}

// Delete user mutation
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(\`/api/v1/users/\${id}\`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
`;
  }

  protected generateUseProducts() {
    return `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

interface CreateProductData {
  name: string;
  description: string;
  price: number;
}

interface UpdateProductData {
  id: string;
  name?: string;
  description?: string;
  price?: number;
}

// Fetch all products
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      const response = await fetch('/api/v1/products');
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      return data.data;
    },
  });
}

// Fetch single product
export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: async (): Promise<Product> => {
      const response = await fetch(\`/api/v1/products/\${id}\`);
      if (!response.ok) {
        throw new Error('Failed to fetch product');
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// Create product mutation
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productData: CreateProductData): Promise<Product> => {
      const response = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      if (!response.ok) {
        throw new Error('Failed to create product');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Update product mutation
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...productData }: UpdateProductData): Promise<Product> => {
      const response = await fetch(\`/api/v1/products/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      if (!response.ok) {
        throw new Error('Failed to update product');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', variables.id] });
    },
  });
}

// Delete product mutation
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(\`/api/v1/products/\${id}\`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete product');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
`;
  }

  protected generateAppStore() {
    return `import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  notifications: Array<{
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
  }>;
  sidebarOpen: boolean;
  setUser: (user: AppState['user']) => void;
  clearUser: () => void;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      notifications: [],
      sidebarOpen: true,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
      addNotification: (notification) => set((state) => ({
        notifications: [
          ...state.notifications,
          {
            ...notification,
            id: crypto.randomUUID(),
            read: false,
          },
        ],
      })),
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),
      clearNotifications: () => set({ notifications: [] }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        user: state.user,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
`;
  }

  protected generateAuthStore() {
    return `import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      user: null,
      login: async (email, password) => {
        try {
          const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          if (!response.ok) {
            throw new Error('Login failed');
          }
          const data = await response.json();
          set({
            isAuthenticated: true,
            token: data.token,
            user: data.user,
          });
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },
      logout: () => {
        set({
          isAuthenticated: false,
          token: null,
          user: null,
        });
      },
      refreshToken: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const response = await fetch('/api/v1/auth/refresh', {
            headers: { Authorization: \`Bearer \${token}\` },
          });
          if (!response.ok) {
            throw new Error('Token refresh failed');
          }
          const data = await response.json();
          set({ token: data.token });
        } catch (error) {
          console.error('Token refresh error:', error);
          get().logout();
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
`;
  }

  protected generateUIStore() {
    return `import { create } from 'zustand';

interface UIState {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'es' | 'fr' | 'de';
  loading: boolean;
  modal: {
    open: boolean;
    title: string;
    content: string;
  } | null;
  setTheme: (theme: UIState['theme']) => void;
  setLanguage: (language: UIState['language']) => void;
  setLoading: (loading: boolean) => void;
  openModal: (title: string, content: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  language: 'en',
  loading: false,
  modal: null,
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  setLoading: (loading) => set({ loading }),
  openModal: (title, content) => set({ modal: { open: true, title, content } }),
  closeModal: () => set({ modal: null }),
}));
`;
  }

  protected generateTestSetup() {
    return `import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
`;
  }

  protected generateHeaderTest() {
    const name = this.context.name;
    return `import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from '../Header';

describe('Header', () => {
  it('renders logo text', () => {
    render(<Header theme="light" />);
    expect(screen.getByText('${name}')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<Header theme="light" />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Counter')).toBeInTheDocument();
  });

  it('calls onToggleTheme when theme toggle button is clicked', () => {
    const mockToggle = vi.fn();
    render(<Header theme="light" onToggleTheme={mockToggle} />);

    const themeButton = screen.getByRole('button', { name: /🌙/ });
    themeButton.click();

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('does not render theme toggle when onToggleTheme is not provided', () => {
    render(<Header />);

    const themeButton = screen.queryRole('button', { name: /🌙/ });
    expect(themeButton).not.toBeInTheDocument();
  });
});
`;
  }

  protected generateCounterTest() {
    return `import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCounter } from '../useCounter';

describe('useCounter', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('should initialize with custom initial value', () => {
    const { result } = renderHook(() => useCounter(5));
    expect(result.current.count).toBe(5);
  });

  it('should increment count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('should decrement count', () => {
    const { result } = renderHook(() => useCounter(5));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(4);
  });

  it('should reset count to initial value', () => {
    const { result } = renderHook(() => useCounter(10));

    act(() => {
      result.current.increment();
      result.current.increment();
      result.current.reset();
    });

    expect(result.current.count).toBe(10);
  });

  it('should handle multiple increments', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
      result.current.increment();
      result.current.increment();
    });

    expect(result.current.count).toBe(3);
  });
});
`;
  }

  protected generateHomeTest() {
    const name = this.context.name;
    return `import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Home from '../Home';

// Mock FeatureCard component
vi.mock('@components/FeatureCard', () => ({
  FeatureCard: ({ icon, title, description }: { icon: string; title: string; description: string }) => (
    <div data-testid="feature-card">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

describe('Home Page', () => {
  const renderWithRouter = () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
  };

  it('renders hero section', () => {
    renderWithRouter();
    expect(screen.getByText('Welcome to ${name}')).toBeInTheDocument();
    expect(screen.getByText(/A modern React application/)).toBeInTheDocument();
  });

  it('renders CTA buttons', () => {
    renderWithRouter();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Learn More')).toBeInTheDocument();
  });

  it('renders feature cards', () => {
    renderWithRouter();
    const featureCards = screen.getAllByTestId('feature-card');
    expect(featureCards).toHaveLength(4);
  });

  it('renders tech stack section', () => {
    renderWithRouter();
    expect(screen.getByText('Tech Stack')).toBeInTheDocument();
    expect(screen.getByText('React 18')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React Router 6')).toBeInTheDocument();
  });
});
`;
  }

  protected generateStorybookMain() {
    return `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};

export default config;
`;
  }

  protected generateStorybookPreview() {
    return `import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
`;
  }

  protected generateHeaderStories() {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { Header } from '../Header';

const meta: Meta<typeof Header> = {
  title: 'Components/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    theme: {
      control: 'select',
      options: ['light', 'dark'],
    },
    onToggleTheme: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Light: Story = {
  args: {
    theme: 'light',
  },
};

export const Dark: Story = {
  args: {
    theme: 'dark',
  },
};

export const WithToggle: Story = {
  args: {
    theme: 'light',
    onToggleTheme: () => console.log('Theme toggled'),
  },
};
`;
  }

  protected generateFeatureCardStories() {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { FeatureCard } from '../FeatureCard';

const meta: Meta<typeof FeatureCard> = {
  title: 'Components/FeatureCard',
  component: FeatureCard,
  tags: ['autodocs'],
  argTypes: {
    icon: { control: 'text' },
    title: { control: 'text' },
    description: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof FeatureCard>;

export const Default: Story = {
  args: {
    icon: '⚡',
    title: 'Lightning Fast HMR',
    description: 'Hot Module Replacement with Vite for instant feedback',
  },
};

export const MultipleCards: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <FeatureCard
        icon="⚡"
        title="Lightning Fast HMR"
        description="Hot Module Replacement with Vite for instant feedback"
      />
      <FeatureCard
        icon="🔧"
        title="TypeScript"
        description="Type-safe development with full IntelliSense support"
      />
      <FeatureCard
        icon="🚀"
        title="React Router"
        description="Client-side routing with lazy loading and code splitting"
      />
    </div>
  ),
};
`;
  }

  protected generateButtonStories() {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary'],
    },
    onClick: { action: 'clicked' },
    children: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Tertiary: Story = {
  args: {
    variant: 'tertiary',
    children: 'Tertiary Button',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
    </div>
  ),
};
`;
  }

  protected generateContactForm() {
    return `import { FunctionComponent } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import './ContactForm.css';

interface ContactFormInputs {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface ContactFormProps {
  onSubmit?: (data: ContactFormInputs) => void | Promise<void>;
}

export const ContactForm: FunctionComponent<ContactFormProps> = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormInputs>({
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  const handleFormSubmit: SubmitHandler<ContactFormInputs> = async (data) => {
    if (onSubmit) {
      await onSubmit(data);
    } else {
      // Default behavior: log to console
      console.log('Form submitted:', data);
      alert('Thank you for your message! We will get back to you soon.');
    }
    reset();
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="contact-form" noValidate>
      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          type="text"
          className={errors.name ? 'error' : ''}
          {...register('name', {
            required: 'Name is required',
            minLength: {
              value: 2,
              message: 'Name must be at least 2 characters',
            },
          })}
          placeholder="John Doe"
        />
        {errors.name && <span className="error-message">{errors.name.message}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          id="email"
          type="email"
          className={errors.email ? 'error' : ''}
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
          placeholder="john@example.com"
        />
        {errors.email && <span className="error-message">{errors.email.message}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="subject">Subject *</label>
        <input
          id="subject"
          type="text"
          className={errors.subject ? 'error' : ''}
          {...register('subject', {
            required: 'Subject is required',
            minLength: {
              value: 5,
              message: 'Subject must be at least 5 characters',
            },
          })}
          placeholder="How can we help?"
        />
        {errors.subject && <span className="error-message">{errors.subject.message}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="message">Message *</label>
        <textarea
          id="message"
          rows={6}
          className={errors.message ? 'error' : ''}
          {...register('message', {
            required: 'Message is required',
            minLength: {
              value: 10,
              message: 'Message must be at least 10 characters',
            },
          })}
          placeholder="Tell us more about your inquiry..."
        />
        {errors.message && <span className="error-message">{errors.message.message}</span>}
      </div>

      <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
};
`;
  }

  protected generateContactPage() {
    return `import { Link } from 'react-router-dom';
import { ContactForm } from '@components/ContactForm';
import './Contact.css';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function Contact() {
  const handleSubmit = async (data: ContactFormData) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Form submitted:', data);
    alert(\`Thank you \${data.name}! We have received your message and will respond soon.\`);
  };

  return (
    <div className="contact-page">
      <div className="contact-header">
        <h1>Contact Us</h1>
        <p>We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>

      <div className="contact-content">
        <div className="contact-info">
          <h2>Get in Touch</h2>
          <div className="info-item">
            <h3>📧 Email</h3>
            <p>contact@${this.context.normalizedName}.com</p>
          </div>
          <div className="info-item">
            <h3>📱 Phone</h3>
            <p>+1 (555) 123-4567</p>
          </div>
          <div className="info-item">
            <h3>📍 Address</h3>
            <p>123 Business Street<br />San Francisco, CA 94102</p>
          </div>
          <div className="info-item">
            <h3>⏰ Business Hours</h3>
            <p>Monday - Friday: 9:00 AM - 6:00 PM<br />Saturday: 10:00 AM - 4:00 PM<br />Sunday: Closed</p>
          </div>
        </div>

        <div className="contact-form-wrapper">
          <h2>Send a Message</h2>
          <ContactForm onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
`;
  }

  protected generateContactPageCss() {
    return `.contact-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.contact-page .contact-header {
  text-align: center;
  margin-bottom: 3rem;
}

.contact-page .contact-header h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.contact-page .contact-header p {
  font-size: 1.25rem;
  color: #666;
  margin-bottom: 1.5rem;
}

.contact-page .back-link {
  color: #667eea;
  text-decoration: none;
  display: inline-block;
}

.contact-page .back-link:hover {
  text-decoration: underline;
}

.contact-page .contact-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: start;
}

@media (max-width: 768px) {
  .contact-page .contact-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}

.contact-page .contact-info {
  background: #f9f9f9;
  padding: 2rem;
  border-radius: 8px;
}

.contact-page .contact-info h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
}

.contact-page .info-item {
  margin-bottom: 2rem;
}

.contact-page .info-item:last-child {
  margin-bottom: 0;
}

.contact-page .info-item h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #667eea;
}

.contact-page .info-item p {
  color: #666;
  line-height: 1.6;
}

.contact-page .contact-form-wrapper {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.contact-page .contact-form-wrapper h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
}
`;
  }

  protected generateContactFormCss() {
    return `.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.contact-form .form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.contact-form label {
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
}

.contact-form input,
.contact-form textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.contact-form input:focus,
.contact-form textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.contact-form input.error,
.contact-form textarea.error {
  border-color: #e74c3c;
}

.contact-form input.error:focus,
.contact-form textarea.error:focus {
  box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1);
}

.contact-form textarea {
  resize: vertical;
  min-height: 120px;
}

.contact-form .error-message {
  color: #e74c3c;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.contact-form button {
  margin-top: 0.5rem;
  width: 100%;
}

.contact-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
`;
  }

  private generateNginxConfig() {
    return `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json image/svg+xml;

    # SPA fallback - all routes go to index.html
    location / {
        try_files \\$uri \\$uri/ /index.html;
    }

    # Cache static assets with long expiry
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache service worker
    location ~* sw.js$ {
        expires 0s;
        add_header Cache-Control "no-cache";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
`;
  }

  // PWA Generator Methods

  protected generatePWAManifest() {
    return JSON.stringify({
      name: this.context.name,
      short_name: this.context.normalizedName,
      description: `${this.context.name} - A Progressive Web App built with Vite + React`,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#61dafb',
      orientation: 'portrait',
      icons: [
        {
          src: '/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ],
      categories: ['productivity', 'business'],
      shortcuts: [
        {
          name: 'Home',
          short_name: 'Home',
          description: 'Go to home page',
          url: '/',
          icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
        },
        {
          name: 'Dashboard',
          short_name: 'Dashboard',
          description: 'View your dashboard',
          url: '/dashboard',
          icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
        }
      ]
    }, null, 2);
  }

  protected generateIcon192() {
    // Simple SVG icon as base64 (192x192 placeholder)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#61dafb"/>
  <circle cx="96" cy="96" r="48" fill="white" opacity="0.9"/>
  <text x="96" y="105" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#61dafb" text-anchor="middle">${this.context.normalizedName.charAt(0).toUpperCase()}</text>
</svg>`;
  }

  protected generateIcon512() {
    // Simple SVG icon as base64 (512x512 placeholder)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#61dafb"/>
  <circle cx="256" cy="256" r="128" fill="white" opacity="0.9"/>
  <text x="256" y="280" font-family="Arial, sans-serif" font-size="96" font-weight="bold" fill="#61dafb" text-anchor="middle">${this.context.normalizedName.charAt(0).toUpperCase()}</text>
</svg>`;
  }

  protected generateRegisterSW() {
    return `/**
 * Service Worker Registration
 *
 * This module handles the registration of the service worker
 * for Progressive Web App (PWA) functionality.
 */

import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
  onRegistered(registration) {
    console.log('Service Worker registered:', registration);

    // Check for updates every hour
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('Service Worker registration error:', error);
  }
});

export { updateSW };
`;
  }

  protected generatePWAInstaller() {
    return `/**
 * PWA Installer Component
 *
 * Displays a prompt to install the PWA when the app is ready
 * and the user hasn't installed it yet.
 */

import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for app install
    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    // Listen for online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA installation accepted');
    } else {
      console.log('PWA installation dismissed');
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  // Don't show anything if already installed
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Offline indicator */}
      {isOffline && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ff9800',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          zIndex: 9999,
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>You are offline. Some features may be unavailable.</span>
        </div>
      )}

      {/* Install prompt */}
      {showInstallPrompt && !isOffline && (
        <div style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#28a745',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              Install App
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Install ${this.context.name} on your device for offline access
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            style={{
              backgroundColor: 'white',
              color: '#28a745',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Install
          </button>
          <button
            onClick={() => setShowInstallPrompt(false)}
            style={{
              backgroundColor: 'transparent',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 4px'
            }}
          >
            ×
          </button>
          <style>
            {\`
              @keyframes slideUp {
                from {
                  transform: translateX(-50%) translateY(100%);
                  opacity: 0;
                }
                to {
                  transform: translateX(-50%) translateY(0);
                  opacity: 1;
                }
              }
            \`}
          </style>
        </div>
      )}
    </>
  );
}
`;
  }

  protected generateUseServiceWorker() {
    return `/**
 * useServiceWorker Hook
 *
 * Custom hook for managing service worker functionality
 * including updates, messages, and lifecycle events.
 */

import { useEffect, useState, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface ServiceWorkerState {
  isOnline: boolean;
  isOffline: boolean;
  isUpdateAvailable: boolean;
  isUpdating: boolean;
  needRefresh: boolean;
  serviceWorkerReady: boolean;
  registration: ServiceWorkerRegistration | null;
}

const updateSW = registerSW({
  onNeedRefresh() {
    // Handled by component
  },
  onOfflineReady() {
    // Handled by component
  },
  onRegistered(registration) {
    console.log('SW registered:', registration);
  },
  onRegisterError(error) {
    console.error('SW registration error:', error);
  }
});

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
    isUpdateAvailable: false,
    isUpdating: false,
    needRefresh: false,
    serviceWorkerReady: false,
    registration: null
  });

  useEffect(() => {
    // Listen for online/offline events
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true, isOffline: false }));
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false, isOffline: true }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    setState(prev => ({ ...prev, isUpdating: true }));
    updateSW(true);
  }, []);

  const skipWaiting = useCallback(() => {
    if (state.registration?.waiting) {
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [state.registration]);

  return {
    ...state,
    updateServiceWorker,
    skipWaiting
  };
}
`;
  }

  protected generateManifestScript() {
    return `#!/usr/bin/env node

/**
 * Generate PWA Manifest
 *
 * This script generates the web app manifest with dynamic values
 * based on the current environment.
 */

const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');

const manifest = {
  name: packageJson.name || 'My App',
  short_name: packageJson.name || 'App',
  description: packageJson.description || 'A Progressive Web App',
  start_url: '/',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#61dafb',
  orientation: 'portrait',
  scope: '/',
  icons: [
    {
      src: '/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    },
    {
      src: '/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    }
  ],
  categories: ['productivity', 'business'],
  shortcuts: [
    {
      name: 'Home',
      short_name: 'Home',
      description: 'Go to home page',
      url: '/',
      icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
    },
    {
      name: 'Dashboard',
      short_name: 'Dashboard',
      description: 'View your dashboard',
      url: '/dashboard',
      icons: [{ src: '/icon-192x192.png', sizes: '192x192' }]
    }
  ]
};

// Write manifest to public directory
const manifestPath = path.resolve(__dirname, '../public/manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('✅ PWA Manifest generated successfully');
`;
  }

  protected generateOfflinePage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You are offline</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
    }

    .container {
      text-align: center;
      max-width: 400px;
    }

    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 12px;
    }

    p {
      font-size: 16px;
      opacity: 0.9;
      margin-bottom: 24px;
      line-height: 1.5;
    }

    button {
      background: white;
      color: #764ba2;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📱</div>
    <h1>You are offline</h1>
    <p>Please check your internet connection and try again.</p>
    <button onclick="window.location.reload()">Retry</button>
  </div>

  <script>
    // Auto-retry when back online
    window.addEventListener('online', function() {
      window.location.reload();
    });
  </script>
</body>
</html>
`;
  }

  // ============ ANALYTICS GENERATORS ============

  protected generateAnalyticsTypes() {
    return `/**
 * Analytics types and interfaces
 * Supports Google Analytics 4, Plausible, and Fathom Analytics
 */

export type AnalyticsProvider = 'google-analytics' | 'plausible' | 'fathom' | 'custom';

export interface AnalyticsConfig {
  provider: AnalyticsProvider;
  enabled?: boolean;
  debug?: boolean;
  // Google Analytics
  measurementId?: string;
  // Plausible
  plausibleDomain?: string;
  plausibleScriptUrl?: string;
  // Fathom
  fathomSiteId?: string;
  fathomScriptUrl?: string;
  // Custom
  customScriptUrl?: string;
}

export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  nonInteraction?: boolean;
}

export interface PageViewOptions {
  title?: string;
  location?: string;
  path?: string;
  referrer?: string;
}

export interface AnalyticsContext {
  userId?: string;
  sessionId?: string;
  customDimensions?: Record<string, string>;
  customMetrics?: Record<string, number>;
}
`;
  }

  protected generateAnalyticsIndex() {
    return `/**
 * Unified Analytics Interface
 * Provides a single API for multiple analytics providers
 */

import { AnalyticsConfig, AnalyticsEvent, PageViewOptions } from './types';
import { GoogleAnalytics } from './google-analytics';
import { PlausibleAnalytics } from './plausible';
import { FathomAnalytics } from './fathom';

export class Analytics {
  private static instance: Analytics;
  private providers: Map<string, GoogleAnalytics | PlausibleAnalytics | FathomAnalytics> = new Map();
  private isEnabled: boolean = true;
  private isDebug: boolean = false;

  private constructor() {}

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  /**
   * Initialize analytics with configuration
   */
  init(config: AnalyticsConfig): void {
    this.isEnabled = config.enabled ?? true;
    this.isDebug = config.debug ?? false;

    if (!this.isEnabled) {
      if (this.isDebug) console.log('[Analytics] Disabled');
      return;
    }

    if (this.isDebug) {
      console.log('[Analytics] Initializing with provider:', config.provider);
    }

    switch (config.provider) {
      case 'google-analytics':
        if (config.measurementId) {
          const ga = new GoogleAnalytics(config.measurementId);
          ga.init();
          this.providers.set('google-analytics', ga);
        } else {
          console.warn('[Analytics] Google Analytics measurementId is required');
        }
        break;

      case 'plausible':
        if (config.plausibleDomain) {
          const plausible = new PlausibleAnalytics(
            config.plausibleDomain,
            config.plausibleScriptUrl
          );
          plausible.init();
          this.providers.set('plausible', plausible);
        } else {
          console.warn('[Analytics] Plausible domain is required');
        }
        break;

      case 'fathom':
        if (config.fathomSiteId) {
          const fathom = new FathomAnalytics(
            config.fathomSiteId,
            config.fathomScriptUrl
          );
          fathom.init();
          this.providers.set('fathom', fathom);
        } else {
          console.warn('[Analytics] Fathom site ID is required');
        }
        break;

      default:
        console.warn('[Analytics] Unknown provider:', config.provider);
    }
  }

  /**
   * Track page view
   */
  pageView(options?: PageViewOptions): void {
    if (!this.isEnabled) return;

    if (this.isDebug) {
      console.log('[Analytics] Page view:', options);
    }

    this.providers.forEach((provider) => {
      provider.pageView(options);
    });
  }

  /**
   * Track custom event
   */
  track(event: AnalyticsEvent): void {
    if (!this.isEnabled) return;

    if (this.isDebug) {
      console.log('[Analytics] Track:', event);
    }

    this.providers.forEach((provider) => {
      provider.track(event);
    });
  }

  /**
   * Set user ID for cross-device tracking
   */
  setUserId(userId: string): void {
    if (!this.isEnabled) return;

    if (this.isDebug) {
      console.log('[Analytics] Set user ID:', userId);
    }

    this.providers.forEach((provider) => {
      provider.setUserId(userId);
    });
  }

  /**
   * Disable analytics for user opt-out
   */
  disable(): void {
    this.isEnabled = false;
    if (this.isDebug) console.log('[Analytics] Disabled');
  }

  /**
   * Enable analytics
   */
  enable(): void {
    this.isEnabled = true;
    if (this.isDebug) console.log('[Analytics] Enabled');
  }
}

// Export singleton instance
export const analytics = Analytics.getInstance();

// Export types
export * from './types';
`;
  }

  protected generateGoogleAnalytics() {
    return `/**
 * Google Analytics 4 Integration
 * Uses gtag.js for measurement
 */

import { AnalyticsEvent, PageViewOptions } from './types';

declare global {
  interface Window {
    gtag?: (command: string, targetId: string, config?: Record<string, unknown>) => void;
    dataLayer?: unknown[];
  }
}

export class GoogleAnalytics {
  private measurementId: string;
  private isInitialized: boolean = false;

  constructor(measurementId: string) {
    this.measurementId = measurementId;
  }

  init(): void {
    if (this.isInitialized) return;
    if (typeof window === 'undefined') return;

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];

    // Load gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = \`https://www.googletagmanager.com/gtag/js?id=\${this.measurementId}\`;
    document.head.appendChild(script);

    // Configure gtag
    script.onload = () => {
      window.gtag?.('js', new Date());
      window.gtag?.('config', this.measurementId, {
        send_page_view: false, // We'll send page views manually
        anonymize_ip: true,
        cookie_flags: 'SameSite=None;Secure'
      });
      this.isInitialized = true;
      console.log('[Google Analytics] Initialized with ID:', this.measurementId);
    };
  }

  pageView(options?: PageViewOptions): void {
    if (!this.isInitialized || !window.gtag) return;

    const config: Record<string, string | undefined> = {
      page_title: options?.title,
      page_location: options?.location,
      page_path: options?.path,
    };

    if (options?.referrer) {
      config.referrer = options.referrer;
    }

    window.gtag('event', 'page_view', config);
  }

  track(event: AnalyticsEvent): void {
    if (!this.isInitialized || !window.gtag) return;

    const params: Record<string, string | number | boolean | undefined> = {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      non_interaction: event.nonInteraction,
    };

    // Remove undefined values
    Object.keys(params).forEach((key) => {
      if (params[key as keyof typeof params] === undefined) {
        delete params[key as keyof typeof params];
      }
    });

    window.gtag('event', event.action, params);
  }

  setUserId(userId: string): void {
    if (!this.isInitialized || !window.gtag) return;

    window.gtag('config', this.measurementId, {
      user_id: userId,
    });
  }
}
`;
  }

  protected generatePlausible() {
    return `/**
 * Plausible Analytics Integration
 * Privacy-friendly analytics alternative
 */

import { AnalyticsEvent, PageViewOptions } from './types';

declare global {
  interface Window {
    plausible?: (event: string, props?: Record<string, unknown>, options?: { consentMode?: string }) => void;
  }
}

export class PlausibleAnalytics {
  private domain: string;
  private scriptUrl: string;
  private isInitialized: boolean = false;

  constructor(domain: string, scriptUrl: string = 'https://plausible.io/js/plausible.js') {
    this.domain = domain;
    this.scriptUrl = scriptUrl;
  }

  init(): void {
    if (this.isInitialized) return;
    if (typeof window === 'undefined') return;

    // Load Plausible script
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.dataset.domain = this.domain;
    script.src = this.scriptUrl;
    document.head.appendChild(script);

    // Mark as initialized
    this.isInitialized = true;
    console.log('[Plausible] Initialized for domain:', this.domain);
  }

  pageView(options?: PageViewOptions): void {
    if (!this.isInitialized) return;

    // Plausible tracks page views automatically via the script
    // We can trigger a manual page view if needed
    if (window.plausible && options?.path) {
      window.plausible('pageview', { props: { path: options.path } });
    }
  }

  track(event: AnalyticsEvent): void {
    if (!this.isInitialized || !window.plausible) return;

    const props: Record<string, string | number | undefined> = {
      category: event.category,
      label: event.label,
      value: event.value,
    };

    // Remove undefined values
    Object.keys(props).forEach((key) => {
      if (props[key as keyof typeof props] === undefined) {
        delete props[key as keyof typeof props];
      }
    });

    // Plausible uses event names directly
    const eventName = \`\${event.category} \${event.action}\`.trim();
    window.plausible(eventName, { props });
  }

  setUserId(userId: string): void {
    if (!this.isInitialized || !window.plausible) return;

    // Plausible doesn't have built-in user ID tracking
    // You can use custom props instead
    window.plausible('identify', { props: { userId } });
  }
}
`;
  }

  protected generateFathom() {
    return `/**
 * Fathom Analytics Integration
 * Simple, privacy-focused analytics
 */

import { AnalyticsEvent, PageViewOptions } from './types';

declare global {
  interface Window {
    fathom?: {
      trackPageview: () => void;
      trackEvent: (eventName: string, value: number | { _value: number; _delta: number }) => void;
      blockTrackingForMe: () => void;
      unblockTrackingForMe: () => void;
      isTrackingEnabled: () => boolean;
      siteId: string;
      beaconUrl: string;
      exclude: string[];
    };
  }
}

export class FathomAnalytics {
  private siteId: string;
  private scriptUrl: string;
  private isInitialized: boolean = false;

  constructor(siteId: string, scriptUrl: string = 'https://cdn.usefathom.com/script.js') {
    this.siteId = siteId;
    this.scriptUrl = scriptUrl;
  }

  init(): void {
    if (this.isInitialized) return;
    if (typeof window === 'undefined') return;

    // Load Fathom script
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = this.scriptUrl;
    script.dataset.site = this.siteId;
    document.head.appendChild(script);

    // Wait for script to load
    script.onload = () => {
      this.isInitialized = true;
      console.log('[Fathom] Initialized with site ID:', this.siteId);
    };
  }

  pageView(options?: PageViewOptions): void {
    if (!this.isInitialized || !window.fathom) return;

    // Fathom tracks page views automatically
    // Manual tracking can be done with:
    window.fathom.trackPageview();
  }

  track(event: AnalyticsEvent): void {
    if (!this.isInitialized || !window.fathom) return;

    // Fathom event tracking uses goal values
    const eventName = \`\${event.category} - \${event.action}\`.trim();

    if (event.value !== undefined) {
      window.fathom.trackEvent(eventName, event.value);
    } else {
      // Use delta for non-value events
      window.fathom.trackEvent(eventName, { _value: 0, _delta: 1 });
    }
  }

  setUserId(userId: string): void {
    // Fathom doesn't have built-in user ID tracking
    // You can use custom events or contact Fathom for custom implementations
    console.log('[Fathom] User ID tracking not directly supported. User ID:', userId);
  }
}
`;
  }

  protected generateAnalyticsComponent() {
    return `/**
 * Analytics Provider Component
 * Renders and initializes the analytics provider based on environment config
 */

import { useEffect, createContext, useContext, ReactNode } from 'react';
import { analytics, AnalyticsConfig } from '../lib/analytics';

interface AnalyticsProviderProps {
  children: ReactNode;
  config?: AnalyticsConfig;
}

const AnalyticsContext = createContext<{
  analytics: typeof analytics;
  config: AnalyticsConfig | null;
}>({
  analytics,
  config: null,
});

export const useAnalyticsContext = () => useContext(AnalyticsContext);

export function AnalyticsProvider({ children, config }: AnalyticsProviderProps) {
  // Get config from environment variables if not provided
  const effectiveConfig: AnalyticsConfig = config || {
    provider: (process.env.REACT_APP_ANALYTICS_PROVIDER as AnalyticsConfig['provider']) || 'google-analytics',
    enabled: process.env.REACT_APP_ANALYTICS_ENABLED !== 'false',
    debug: process.env.REACT_APP_ANALYTICS_DEBUG === 'true',
    measurementId: process.env.REACT_APP_GA_MEASUREMENT_ID,
    plausibleDomain: process.env.REACT_APP_PLAUSIBLE_DOMAIN,
    plausibleScriptUrl: process.env.REACT_APP_PLAUSIBLE_SCRIPT_URL,
    fathomSiteId: process.env.REACT_APP_FATHOM_SITE_ID,
    fathomScriptUrl: process.env.REACT_APP_FATHOM_SCRIPT_URL,
  };

  useEffect(() => {
    // Initialize analytics
    if (effectiveConfig.provider) {
      analytics.init(effectiveConfig);
    }
  }, [effectiveConfig]);

  return (
    <AnalyticsContext.Provider value={{ analytics, config: effectiveConfig }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Component to manually trigger page view tracking
 * Useful for client-side routing
 */
export function AnalyticsPageView({ title, path }: { title?: string; path?: string }) {
  const { analytics } = useAnalyticsContext();

  useEffect(() => {
    analytics.pageView({
      title,
      path: path || window.location.pathname,
      location: window.location.href,
    });
  }, [title, path, analytics]);

  return null;
}

/**
 * Component to disable analytics for user opt-out
 */
export function AnalyticsOptOut() {
  const { analytics } = useAnalyticsContext();

  useEffect(() => {
    analytics.disable();
    return () => analytics.enable();
  }, [analytics]);

  return null;
}
`;
  }

  protected generateUseAnalyticsHook() {
    return `/**
 * Custom React hook for analytics tracking
 * Provides easy-to-use methods for tracking events and page views
 */

import { useCallback } from 'react';
import { analytics } from '../lib/analytics';
import type { AnalyticsEvent, PageViewOptions } from '../lib/analytics/types';

export interface UseAnalyticsReturn {
  /**
   * Track a custom event
   */
  track: (event: AnalyticsEvent) => void;
  /**
   * Track page view
   */
  pageView: (options?: PageViewOptions) => void;
  /**
   * Set user ID for cross-device tracking
   */
  setUserId: (userId: string) => void;
  /**
   * Disable analytics
   */
  disable: () => void;
  /**
   * Enable analytics
   */
  enable: () => void;
}

/**
 * Helper hook for common analytics operations
 */
export function useAnalytics(): UseAnalyticsReturn {
  const track = useCallback(
    (event: AnalyticsEvent) => {
      analytics.track(event);
    },
    []
  );

  const pageView = useCallback(
    (options?: PageViewOptions) => {
      analytics.pageView(options);
    },
    []
  );

  const setUserId = useCallback(
    (userId: string) => {
      analytics.setUserId(userId);
    },
    []
  );

  const disable = useCallback(() => {
    analytics.disable();
  }, []);

  const enable = useCallback(() => {
    analytics.enable();
  }, []);

  return {
    track,
    pageView,
    setUserId,
    disable,
    enable,
  };
}

/**
 * Helper hook for tracking specific categories of events
 */
export function useCategoryAnalytics(category: string) {
  const { track } = useAnalytics();

  return useCallback(
    (action: string, options?: Omit<AnalyticsEvent, 'category' | 'action'>) => {
      track({
        category,
        action,
        ...options,
      });
    },
    [category, track]
  );
}

/**
 * Pre-configured hooks for common event categories
 */
export function useNavigationAnalytics() {
  return useCategoryAnalytics('Navigation');
}

export function useEngagementAnalytics() {
  return useCategoryAnalytics('Engagement');
}

export function useConversionAnalytics() {
  return useCategoryAnalytics('Conversion');
}

export function useErrorAnalytics() {
  return useCategoryAnalytics('Error');
}
`;
  }

  protected generateAnalyticsEnvExample() {
    return `# Analytics Configuration
# Copy this file to .env.local and fill in your values

# Analytics Provider: google-analytics | plausible | fathom | custom
REACT_APP_ANALYTICS_PROVIDER=google-analytics

# Enable/disable analytics (default: true)
REACT_APP_ANALYTICS_ENABLED=true

# Enable debug mode for console logging (default: false)
REACT_APP_ANALYTICS_DEBUG=false

# Google Analytics 4
# Get your Measurement ID from: https://analytics.google.com/
REACT_APP_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Plausible Analytics
# Your domain without protocol: https://plausible.io/
REACT_APP_PLAUSIBLE_DOMAIN=yourdomain.com
# Optional: Self-hosted Plausible instance
REACT_APP_PLAUSIBLE_SCRIPT_URL=https://plausible.io/js/plausible.js

# Fathom Analytics
# Get your Site ID from: https://usefathom.com/
REACT_APP_FATHOM_SITE_ID=XXXXXXXXXX
# Optional: Self-hosted Fathom instance
REACT_APP_FATHOM_SCRIPT_URL=https://cdn.usefathom.com/script.js
`;
  }

  // ============ HEADLESS CMS GENERATORS ============

  protected generateCMSTypes() {
    return `/**
 * Headless CMS Types
 * Unified types for Strapi, Contentful, and Sanity CMS integrations
 */

export type CMSProvider = 'strapi' | 'contentful' | 'sanity';

export interface CMSConfig {
  provider: CMSProvider;
  enabled?: boolean;
  // Strapi
  strapiUrl?: string;
  strapiApiKey?: string;
  // Contentful
  contentfulSpaceId?: string;
  contentfulAccessToken?: string;
  contentfulEnvironment?: string;
  // Sanity
  sanityProjectId?: string;
  sanityDataset?: string;
  sanityApiVersion?: string;
  sanityUseCdn?: boolean;
  sanityToken?: string;
}

export interface CMSContent {
  id: string;
  type: string;
  slug?: string;
  title?: string;
  content?: any;
  metadata?: ContentMetadata;
  [key: string]: any;
}

export interface ContentMetadata {
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  locale?: string;
  author?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export interface CMSQueryOptions {
  locale?: string;
  limit?: number;
  offset?: number;
  sort?: string[];
  filters?: Record<string, any>;
  fields?: string[];
  deep?: boolean;
}

export interface CMSResponse<T = any> {
  data: T[];
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
  errors?: Array<{
    message: string;
    path?: string[];
  }>;
}

// Generic CMS interface
export interface ICMSClient {
  getContent<T = CMSContent>(contentType: string, options?: CMSQueryOptions): Promise<CMSResponse<T>>;
  getBySlug<T = CMSContent>(contentType: string, slug: string, options?: CMSQueryOptions): Promise<T | null>;
  getById<T = CMSContent>(contentType: string, id: string, options?: CMSQueryOptions): Promise<T | null>;
  search<T = CMSContent>(query: string, options?: CMSQueryOptions): Promise<CMSResponse<T>>;
}
`;
  }

  protected generateCMSIndex() {
    return `/**
 * Unified CMS Client Interface
 * Provides a single API for multiple headless CMS providers
 */

import { CMSConfig, CMSQueryOptions, CMSResponse, ICMSClient } from './types';
import { StrapiClient } from './strapi';
import { ContentfulClient } from './contentful';
import { SanityClient } from './sanity';

export class CMSClient implements ICMSClient {
  private client: StrapiClient | ContentfulClient | SanityClient | null = null;
  private provider: CMSConfig['provider'] | null = null;

  constructor(config?: CMSConfig) {
    if (config) {
      this.init(config);
    }
  }

  init(config: CMSConfig): void {
    if (config.enabled === false) {
      console.log('[CMS] Disabled');
      return;
    }

    this.provider = config.provider;

    switch (config.provider) {
      case 'strapi':
        if (!config.strapiUrl) {
          throw new Error('[CMS] Strapi URL is required');
        }
        this.client = new StrapiClient(config.strapiUrl, config.strapiApiKey);
        console.log('[CMS] Initialized with Strapi');
        break;

      case 'contentful':
        if (!config.contentfulSpaceId || !config.contentfulAccessToken) {
          throw new Error('[CMS] Contentful Space ID and Access Token are required');
        }
        this.client = new ContentfulClient(
          config.contentfulSpaceId,
          config.contentfulAccessToken,
          config.contentfulEnvironment
        );
        console.log('[CMS] Initialized with Contentful');
        break;

      case 'sanity':
        if (!config.sanityProjectId || !config.sanityDataset) {
          throw new Error('[CMS] Sanity Project ID and Dataset are required');
        }
        this.client = new SanityClient(
          config.sanityProjectId,
          config.sanityDataset,
          config.sanityApiVersion,
          config.sanityUseCdn,
          config.sanityToken
        );
        console.log('[CMS] Initialized with Sanity');
        break;

      default:
        throw new Error(\`[CMS] Unknown provider: \${config.provider}\`);
    }
  }

  async getContent<T = any>(contentType: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    if (!this.client) throw new Error('[CMS] Client not initialized');
    return this.client.getContent<T>(contentType, options);
  }

  async getBySlug<T = any>(contentType: string, slug: string, options?: CMSQueryOptions): Promise<T | null> {
    if (!this.client) throw new Error('[CMS] Client not initialized');
    return this.client.getBySlug<T>(contentType, slug, options);
  }

  async getById<T = any>(contentType: string, id: string, options?: CMSQueryOptions): Promise<T | null> {
    if (!this.client) throw new Error('[CMS] Client not initialized');
    return this.client.getById<T>(contentType, id, options);
  }

  async search<T = any>(query: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    if (!this.client) throw new Error('[CMS] Client not initialized');
    return this.client.search<T>(query, options);
  }

  getProvider(): CMSConfig['provider'] | null {
    return this.provider;
  }
}

// Export types and individual clients
export * from './types';
export { StrapiClient } from './strapi';
export { ContentfulClient } from './contentful';
export { SanityClient } from './sanity';
`;
  }

  protected generateStrapi() {
    return `/**
 * Strapi CMS Client
 * https://docs.strapi.io/
 */

import { createClient } from '@strapi/sdk-js';
import type { CMSQueryOptions, CMSResponse } from './types';

export class StrapiClient {
  private client: ReturnType<typeof createClient>;
  private apiUrl: string;

  constructor(apiUrl: string, apiToken?: string) {
    this.apiUrl = apiUrl.replace(/\\/$/, ''); // Remove trailing slash

    this.client = createClient({
      url: this.apiUrl,
      ...(apiToken && {
        headers: {
          Authorization: \`Bearer \${apiToken}\`,
        },
      }),
    });
  }

  private normalizeQuery(options?: CMSQueryOptions) {
    const query: Record<string, any> = {};

    if (options?.locale) {
      query.locale = options.locale;
    }

    if (options?.limit) {
      query.pagination = { ...query.pagination, limit: options.limit };
    }

    if (options?.offset) {
      query.pagination = { ...query.pagination, start: options.offset };
    }

    if (options?.sort) {
      query.sort = options.sort;
    }

    if (options?.filters) {
      query.filters = options.filters;
    }

    if (options?.fields) {
      query.fields = options.fields;
    }

    if (options?.deep) {
      query.populate = 'deep';
    }

    return query;
  }

  async getContent<T = any>(contentType: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    try {
      const query = this.normalizeQuery(options);
      const response = await this.client.find(\`\${contentType}s\`, query);

      return {
        data: response.data || [],
        meta: response.meta,
      };
    } catch (error) {
      console.error(\`[Strapi] Error fetching \${contentType}:\`, error);
      return {
        data: [],
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  async getBySlug<T = any>(contentType: string, slug: string, options?: CMSQueryOptions): Promise<T | null> {
    try {
      const query = this.normalizeQuery(options);
      const response = await this.find(\`\${contentType}s\`, {
        ...query,
        filters: {
          ...query.filters,
          slug: { $eq: slug },
        },
      });

      if (response.data && response.data.length > 0) {
        return response.data[0] as T;
      }
      return null;
    } catch (error) {
      console.error(\`[Strapi] Error fetching \${contentType} by slug \${slug}:\`, error);
      return null;
    }
  }

  async getById<T = any>(contentType: string, id: string, options?: CMSQueryOptions): Promise<T | null> {
    try {
      const query = this.normalizeQuery(options);
      const response = await this.client.findOne(\`\${contentType}s\`, id, query);

      return response as T;
    } catch (error) {
      console.error(\`[Strapi] Error fetching \${contentType} by id \${id}:\`, error);
      return null;
    }
  }

  async search<T = any>(query: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    try {
      const params = this.normalizeQuery(options);
      // Strapi doesn't have a native search API, use title contains
      const response = await this.client.search(query, params);

      return {
        data: response.data || [],
        meta: response.meta,
      };
    } catch (error) {
      console.error(\`[Strapi] Error searching for \${query}:\`, error);
      return {
        data: [],
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }
}
`;
  }

  protected generateContentful() {
    return `/**
 * Contentful CMS Client
 * https://www.contentful.com/developers/docs/javascript/tutorials/using-the-cda-js/
 */

import { createClient as createContentfulClient, type ContentfulClient as CFClient, type EntryCollection } from 'contentful';
import type { CMSQueryOptions, CMSResponse } from './types';

export class ContentfulClient {
  private client: CFClient;

  constructor(
    spaceId: string,
    accessToken: string,
    environment: string = 'master'
  ) {
    this.client = createContentfulClient({
      space: spaceId,
      accessToken,
      environment,
    });
  }

  private normalizeQuery(options?: CMSQueryOptions) {
    const query: Record<string, any> = {};

    if (options?.locale) {
      query.locale = options.locale;
    }

    if (options?.limit) {
      query.limit = options.limit;
    }

    if (options?.offset) {
      query.skip = options.offset;
    }

    if (options?.fields) {
      query.select = options.fields.join(',');
    }

    if (options?.deep) {
      query.include = 10;
    }

    return query;
  }

  async getContent<T = any>(contentType: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    try {
      const query = this.normalizeQuery(options);
      query.content_type = contentType;

      const response = await this.client.getEntries<T>(query) as EntryCollection<T>;

      return {
        data: response.items.map((item) => ({
          id: item.sys.id,
          type: item.sys.type,
          ...item.fields,
          metadata: {
            createdAt: item.sys.createdAt,
            updatedAt: item.sys.updatedAt,
            locale: item.sys.locale,
          },
        })),
        meta: {
          total: response.total,
          limit: response.limit,
          offset: response.skip,
        },
      };
    } catch (error) {
      console.error(\`[Contentful] Error fetching \${contentType}:\`, error);
      return {
        data: [],
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  async getBySlug<T = any>(contentType: string, slug: string, options?: CMSQueryOptions): Promise<T | null> {
    try {
      const query = this.normalizeQuery(options);
      query.content_type = contentType;
      query['fields.slug'] = slug;
      query.limit = 1;

      const response = await this.client.getEntries<T>(query) as EntryCollection<T>;

      if (response.items.length > 0) {
        const item = response.items[0];
        return {
          id: item.sys.id,
          type: item.sys.type,
          ...item.fields,
          metadata: {
            createdAt: item.sys.createdAt,
            updatedAt: item.sys.updatedAt,
            locale: item.sys.locale,
          },
        } as T;
      }
      return null;
    } catch (error) {
      console.error(\`[Contentful] Error fetching \${contentType} by slug \${slug}:\`, error);
      return null;
    }
  }

  async getById<T = any>(contentType: string, id: string, options?: CMSQueryOptions): Promise<T | null> {
    try {
      const query = this.normalizeQuery(options);
      const entry = await this.client.getEntry<T>(id, query);

      return {
        id: entry.sys.id,
        type: entry.sys.type,
        ...entry.fields,
        metadata: {
          createdAt: entry.sys.createdAt,
          updatedAt: entry.sys.updatedAt,
          locale: entry.sys.locale,
        },
      } as T;
    } catch (error) {
      console.error(\`[Contentful] Error fetching \${contentType} by id \${id}:\`, error);
      return null;
    }
  }

  async search<T = any>(query: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    try {
      const params = this.normalizeQuery(options);
      params.query = query;

      const response = await this.client.getEntries<T>(params) as EntryCollection<T>;

      return {
        data: response.items.map((item) => ({
          id: item.sys.id,
          type: item.sys.type,
          ...item.fields,
          metadata: {
            createdAt: item.sys.createdAt,
            updatedAt: item.sys.updatedAt,
            locale: item.sys.locale,
          },
        })),
        meta: {
          total: response.total,
          limit: response.limit,
          offset: response.skip,
        },
      };
    } catch (error) {
      console.error(\`[Contentful] Error searching for \${query}:\`, error);
      return {
        data: [],
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }
}
`;
  }

  protected generateSanity() {
    return `/**
 * Sanity CMS Client
 * https://www.sanity.io/docs/js-client
 */

import { createClient as createSanityClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import type { CMSQueryOptions, CMSResponse, CMSContent } from './types';

export class SanityClient {
  private client: ReturnType<typeof createSanityClient>;
  private builder: ReturnType<typeof imageUrlBuilder>;

  constructor(
    projectId: string,
    dataset: string,
    apiVersion: string = '2024-01-01',
    useCdn: boolean = true,
    token?: string
  ) {
    this.client = createSanityClient({
      projectId,
      dataset,
      apiVersion,
      useCdn,
      ...(token && { token }),
    });

    this.builder = imageUrlBuilder(this.client);
  }

  /**
   * Get image URL from Sanity image asset
   */
  getImageUrl(source: any, options?: { width?: number; height?: number; quality?: number }) {
    let url = this.builder.image(source);

    if (options?.width) url = url.width(options.width);
    if (options?.height) url = url.height(options.height);
    if (options?.quality) url = url.quality(options.quality);

    return url.url();
  }

  private normalizeQuery(options?: CMSQueryOptions) {
    const query: Record<string, any> = {};

    if (options?.locale) {
      query.language = options.locale;
    }

    return query;
  }

  async getContent<T = any>(contentType: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    try {
      const groqQuery = \`*[_type == "\${contentType}"] | order(_createdAt desc)\`;
      const response = await this.client.fetch<T[]>(groqQuery, this.normalizeQuery(options));

      return {
        data: response || [],
      };
    } catch (error) {
      console.error(\`[Sanity] Error fetching \${contentType}:\`, error);
      return {
        data: [],
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }

  async getBySlug<T = any>(contentType: string, slug: string, options?: CMSQueryOptions): Promise<T | null> {
    try {
      const localeFilter = options?.locale ? \` && language == "\${options.locale}"\` : '';
      const groqQuery = \`*[_type == "\${contentType}" && slug.current == "\${slug}"\${localeFilter}][0]\`;
      const response = await this.client.fetch<T>(groqQuery, this.normalizeQuery(options));

      return response || null;
    } catch (error) {
      console.error(\`[Sanity] Error fetching \${contentType} by slug \${slug}:\`, error);
      return null;
    }
  }

  async getById<T = any>(contentType: string, id: string, options?: CMSQueryOptions): Promise<T | null> {
    try {
      const localeFilter = options?.locale ? \` && language == "\${options.locale}"\` : '';
      const groqQuery = \`*[_type == "\${contentType}" && _id == "\${id}"\${localeFilter}][0]\`;
      const response = await this.client.fetch<T>(groqQuery, this.normalizeQuery(options));

      return response || null;
    } catch (error) {
      console.error(\`[Sanity] Error fetching \${contentType} by id \${id}:\`, error);
      return null;
    }
  }

  async search<T = any>(query: string, options?: CMSQueryOptions): Promise<CMSResponse<T>> {
    try {
      // Simple full-text search across title fields
      const groqQuery = \`*[[_type match "*"] && title match "\${query}*"]\`;
      const response = await this.client.fetch<T[]>(groqQuery, this.normalizeQuery(options));

      return {
        data: response || [],
      };
    } catch (error) {
      console.error(\`[Sanity] Error searching for \${query}:\`, error);
      return {
        data: [],
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
      };
    }
  }
}
`;
  }

  protected generateUseCMSHook() {
    return `/**
 * Custom React hook for CMS content fetching
 * Works with Strapi, Contentful, and Sanity
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CMSClient } from '../lib/cms';
import type { CMSConfig, CMSQueryOptions, CMSResponse } from '../lib/cms/types';

interface UseCMSOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

let cmsClient: CMSClient | null = null;

export function initCMS(config: CMSConfig) {
  cmsClient = new CMSClient(config);
}

export function getCMSClient() {
  if (!cmsClient) {
    throw new Error('[useCMS] CMS client not initialized. Call initCMS first.');
  }
  return cmsClient;
}

/**
 * Hook for fetching content list from CMS
 */
export function useCMS<T = any>(
  contentType: string,
  options?: CMSQueryOptions & UseCMSOptions
) {
  const client = getCMSClient();

  return useQuery({
    queryKey: ['cms', contentType, options],
    queryFn: () => client.getContent<T>(contentType, options),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for fetching single item by slug
 */
export function useCMSBySlug<T = any>(
  contentType: string,
  slug: string | undefined,
  options?: CMSQueryOptions & UseCMSOptions
) {
  const client = getCMSClient();

  return useQuery({
    queryKey: ['cms', contentType, 'slug', slug, options],
    queryFn: () => slug ? client.getBySlug<T>(contentType, slug, options) : Promise.resolve(null),
    enabled: !!slug && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
  });
}

/**
 * Hook for fetching single item by ID
 */
export function useCMSById<T = any>(
  contentType: string,
  id: string | undefined,
  options?: CMSQueryOptions & UseCMSOptions
) {
  const client = getCMSClient();

  return useQuery({
    queryKey: ['cms', contentType, 'id', id, options],
    queryFn: () => id ? client.getById<T>(contentType, id, options) : Promise.resolve(null),
    enabled: !!id && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
  });
}

/**
 * Hook for searching CMS content
 */
export function useCMSSearch<T = any>(
  query: string,
  options?: CMSQueryOptions & UseCMSOptions
) {
  const client = getCMSClient();

  return useQuery({
    queryKey: ['cms', 'search', query, options],
    queryFn: () => client.search<T>(query, options),
    enabled: !!query && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
  });
}

/**
 * Hook for prefetching CMS content
 */
export function useCMSPrefetch() {
  const queryClient = useQueryClient();
  const client = getCMSClient();

  return {
    prefetchContent: async <T = any>(contentType: string, options?: CMSQueryOptions) => {
      await queryClient.prefetchQuery({
        queryKey: ['cms', contentType, options],
        queryFn: () => client.getContent<T>(contentType, options),
      });
    },
    prefetchBySlug: async <T = any>(contentType: string, slug: string, options?: CMSQueryOptions) => {
      await queryClient.prefetchQuery({
        queryKey: ['cms', contentType, 'slug', slug, options],
        queryFn: () => client.getBySlug<T>(contentType, slug, options),
      });
    },
  };
}
`;
  }

  protected generateCMSProvider() {
    return `/**
 * CMS Provider Component
 * Initializes CMS client and provides it to the app
 */

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { CMSClient, initCMS } from '../lib/cms';
import type { CMSConfig } from '../lib/cms/types';

interface CMSProviderProps {
  children: ReactNode;
  config?: CMSConfig;
}

const CMSContext = createContext<{
  client: CMSClient | null;
  provider: CMSConfig['provider'] | null;
}>({
  client: null,
  provider: null,
});

export const useCMSContext = () => useContext(CMSContext);

export function CMSProvider({ children, config }: CMSProviderProps) {
  const effectiveConfig: CMSConfig = config || {
    provider: (process.env.REACT_APP_CMS_PROVIDER as CMSConfig['provider']) || 'strapi',
    enabled: process.env.REACT_APP_CMS_ENABLED !== 'false',
    // Strapi
    strapiUrl: process.env.REACT_APP_STRAPI_URL,
    strapiApiKey: process.env.REACT_APP_STRAPI_API_KEY,
    // Contentful
    contentfulSpaceId: process.env.REACT_APP_CONTENTFUL_SPACE_ID,
    contentfulAccessToken: process.env.REACT_APP_CONTENTFUL_ACCESS_TOKEN,
    contentfulEnvironment: process.env.REACT_APP_CONTENTFUL_ENVIRONMENT,
    // Sanity
    sanityProjectId: process.env.REACT_APP_SANITY_PROJECT_ID,
    sanityDataset: process.env.REACT_APP_SANITY_DATASET,
    sanityApiVersion: process.env.REACT_APP_SANITY_API_VERSION,
    sanityUseCdn: process.env.REACT_APP_SANITY_USE_CDN !== 'false',
    sanityToken: process.env.REACT_APP_SANITY_TOKEN,
  };

  useEffect(() => {
    if (effectiveConfig.enabled !== false && effectiveConfig.provider) {
      try {
        initCMS(effectiveConfig);
      } catch (error) {
        console.error('[CMSProvider] Failed to initialize:', error);
      }
    }
  }, [effectiveConfig]);

  const client = effectiveConfig.enabled !== false ? new CMSClient(effectiveConfig) : null;

  return (
    <CMSContext.Provider
      value={{
        client,
        provider: effectiveConfig.provider || null,
      }}
    >
      {children}
    </CMSContext.Provider>
  );
}
`;
  }

  protected generateCMSEnvExample() {
    return `# Headless CMS Configuration
# Copy this file to .env.local and fill in your values

# CMS Provider: strapi | contentful | sanity
REACT_APP_CMS_PROVIDER=strapi

# Enable/disable CMS (default: true)
REACT_APP_CMS_ENABLED=true

# Strapi Configuration
# Get your API URL and token from: https://strapi.io/
REACT_APP_STRAPI_URL=http://localhost:1337/api
REACT_APP_STRAPI_API_KEY=your-strapi-api-key

# Contentful Configuration
# Get your Space ID and Access Token from: https://app.contentful.com/
REACT_APP_CONTENTFUL_SPACE_ID=your-space-id
REACT_APP_CONTENTFUL_ACCESS_TOKEN=your-access-token
REACT_APP_CONTENTFUL_ENVIRONMENT=master

# Sanity Configuration
# Get your Project ID from: https://www.sanity.io/
REACT_APP_SANITY_PROJECT_ID=your-project-id
REACT_APP_SANITY_DATASET=production
REACT_APP_SANITY_API_VERSION=2024-01-01
# Set to 'false' to disable CDN for preview drafts
REACT_APP_SANITY_USE_CDN=true
# Optional: For authenticated requests
REACT_APP_SANITY_TOKEN=your-sanity-token
`;
  }

  // ============ BUILD OPTIMIZATION & IMAGE PROCESSING GENERATORS ============

  protected generateOptimizedViteConfig() {
    return `/**
 * Optimized Vite Configuration
 * Advanced build optimizations including code splitting, tree shaking, and image optimization
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import viteImagemin from 'vite-plugin-imagemin';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    // Bundle analyzer - generates stats.html and stats.json in dist/analyze
    visualizer({
      filename: 'dist/analyze/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    // PWA Plugin - generates service worker and manifest
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: '${this.context.name}',
        short_name: '${this.context.normalizedName}',
        description: '${this.context.name} - A Progressive Web App',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\\/\\/api\\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\\/\\/fonts\\.(?:googleapis|gstatic)\\.com\\/./i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    }),
    // Image optimization plugin - compress images during build
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9] },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox',
            active: false
          },
          {
            name: 'removeEmptyAttrs',
            active: false
          }
        ]
      },
      webp: {
        quality: 75
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@store': path.resolve(__dirname, './src/store'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize chunk size and loading
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: (id) => {
          // React vendor chunk - rarely changes
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          // React Router chunk
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor';
          }
          // Query library
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor';
          }
          // Emotion (CSS-in-JS)
          if (id.includes('node_modules/@emotion')) {
            return 'emotion-vendor';
          }
          // CMS providers - split by provider
          if (id.includes('node_modules/@strapi')) {
            return 'cms-strapi';
          }
          if (id.includes('node_modules/contentful')) {
            return 'cms-contentful';
          }
          if (id.includes('node_modules/@sanity')) {
            return 'cms-sanity';
          }
          // Other node_modules go to vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimize bundle size
        compact: true,
        // Preserve module side effects
        preserveEntrySignatures: 'strict',
      },
      // Tree shaking options
      treeshake: {
        moduleSideEffects: true,
        propertyReadSideEffects: true,
        unknownGlobalSideEffects: false
      }
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
    // CSS code splitting
    cssCodeSplit: true,
    // Target modern browsers
    target: 'es2015',
    // Minify settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      format: {
        comments: false
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    // Pre-bundle dependencies
    force: false
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    css: true,
  },
});
`;
  }

  protected generateImageOptimizer() {
    return `/**
 * Image Optimization Utilities
 * Provides functions for optimizing images, generating responsive srcsets,
 * and creating blurhash placeholders
 */

import { encode } from 'blurhash';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface OptimizedImageOptions {
  src: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png' | 'avif';
  sizes?: string[];
  srcSet?: string[];
}

export interface BlurHashResult {
  hash: string;
  width: number;
  height: number;
}

/**
 * Generate responsive srcset for images
 */
export function generateSrcSet(
  baseUrl: string,
  sizes: number[],
  format: 'webp' | 'jpg' | 'png' = 'webp'
): string {
  return sizes
    .map(size => \`\${baseUrl}?w=\${size}&f=\${format} \${size}w\`)
    .join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(sizes: string[]): string {
  return sizes.join(', ');
}

/**
 * Calculate aspect ratio from dimensions
 */
export function getAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Generate blurhash from image URL
 * Note: This requires the image to be loaded or processed server-side
 */
export async function generateBlurHash(
  imageUrl: string
): Promise<BlurHashResult | null> {
  try {
    // In a real implementation, you would:
    // 1. Fetch the image
    // 2. Resize to small thumbnail (32x32)
    // 3. Extract pixel data
    // 4. Encode with blurhash
    // This is a placeholder that returns a mock hash
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Resize for blurhash
    const scale = 32 / Math.max(bitmap.width, bitmap.height);
    canvas.width = Math.floor(bitmap.width * scale);
    canvas.height = Math.floor(bitmap.height * scale);

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const hash = encode(imageData.data, canvas.width, canvas.height, 4, 4);

    return {
      hash,
      width: bitmap.width,
      height: bitmap.height
    };
  } catch (error) {
    console.error('Failed to generate blurhash:', error);
    return null;
  }
}

/**
 * Get optimal image size based on container and pixel ratio
 */
export function getOptimalSize(
  containerWidth: number,
  pixelRatio: number = window.devicePixelRatio || 1
): number {
  // Round to nearest multiple of 100 for better caching
  return Math.ceil((containerWidth * pixelRatio) / 100) * 100;
}

/**
 * Generate lazy loading data attributes
 */
export function generateLazyLoadingAttrs(priority: boolean = false) {
  return {
    loading: priority ? 'eager' : 'lazy' as const,
    decoding: 'async' as const,
    fetchpriority: priority ? 'high' : 'auto' as const
  };
}

/**
 * Convert image to different format
 */
export async function convertImageFormat(
  file: File,
  format: 'webp' | 'jpg' | 'png',
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0);

      const mimeType = format === 'webp' ? 'image/webp' : format === 'jpg' ? 'image/jpeg' : 'image/png';
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to convert image'));
        },
        mimeType,
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Validate image file type
 */
export function isValidImageType(type: string): boolean {
  return [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif'
  ].includes(type);
}

/**
 * Get max dimensions for different image categories
 */
export const IMAGE_DIMENSIONS = {
  avatar: { width: 200, height: 200 },
  thumbnail: { width: 400, height: 300 },
  card: { width: 600, height: 400 },
  banner: { width: 1200, height: 630 },
  hero: { width: 1920, height: 1080 },
  full: { width: 3840, height: 2160 }
} as const;

export type ImageCategory = keyof typeof IMAGE_DIMENSIONS;
`;
  }

  protected generateBundleAnalyzer() {
    return `/**
 * Bundle Analyzer Utilities
 * Provides tools for analyzing bundle size, dependencies, and optimization opportunities
 */

export interface BundleStats {
  name: string;
  size: number;
  gzipped: number;
  dependencies: string[];
}

export interface BundleReport {
  totalSize: number;
  totalGzipped: number;
  chunks: BundleStats[];
  recommendations: string[];
}

/**
 * Calculate bundle size savings from tree shaking
 */
export function calculateTreeShakingSavings(
  originalSize: number,
  actualSize: number
): number {
  const savings = originalSize - actualSize;
  const percentage = (savings / originalSize) * 100;
  return Math.round(percentage * 100) / 100;
}

/**
 * Analyze chunk dependencies for optimization opportunities
 */
export function analyzeChunkDependencies(
  chunks: BundleStats[]
): string[] {
  const recommendations: string[] = [];

  chunks.forEach(chunk => {
    // Check for large chunks
    if (chunk.size > 200000) {
      recommendations.push(
        \`Chunk "\${chunk.name}" is \${(chunk.size / 1024).toFixed(0)}KB. Consider splitting it.\`
      );
    }

    // Check for duplicate dependencies
    const duplicateDeps = chunk.dependencies.filter((dep, index, self) =>
      self.indexOf(dep) !== index
    );

    if (duplicateDeps.length > 0) {
      recommendations.push(
        \`Chunk "\${chunk.name}" has duplicate dependencies: \${duplicateDeps.join(', ')}\`
      );
    }
  });

  return recommendations;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate bundle report
 */
export function generateBundleReport(stats: any): BundleReport {
  const chunks: BundleStats[] = [];
  let totalSize = 0;
  let totalGzipped = 0;

  Object.entries(stats?.chunks || {}).forEach(([name, data]: [string, any]) => {
    const size = data.size || 0;
    const gzipped = data.gzippedSize || 0;

    totalSize += size;
    totalGzipped += gzipped;

    chunks.push({
      name,
      size,
      gzipped,
      dependencies: data.dependencies || []
    });
  });

  const recommendations = analyzeChunkDependencies(chunks);

  return {
    totalSize,
    totalGzipped,
    chunks,
    recommendations
  };
}

/**
 * Check if bundle exceeds recommended size limits
 */
export function checkBundleSizeLimits(report: BundleReport): {
  withinLimits: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const CHUNK_SIZE_LIMIT = 244000; // ~244KB uncompressed

  report.chunks.forEach(chunk => {
    if (chunk.size > CHUNK_SIZE_LIMIT) {
      warnings.push(
        \`Chunk "\${chunk.name}" exceeds recommended size of \${formatBytes(CHUNK_SIZE_LIMIT)}\`
      );
    }
  });

  return {
    withinLimits: warnings.length === 0,
    warnings
  };
}

/**
 * Estimate first contentful paint based on bundle size
 */
export function estimateFCP(bundleSize: number, connectionSpeed: '3g' | '4g' = '4g'): number {
  // Rough estimates in milliseconds
  const speeds = {
    '3g': 0.05, // 50KB per second
    '4g': 0.5   // 500KB per second
  };

  return Math.round((bundleSize / 1024) / speeds[connectionSpeed]);
}
`;
  }

  protected generateOptimizedImage() {
    return `/**
 * OptimizedImage Component
 * Lazy-loading, responsive image component with blurhash placeholder
 */

import { useState, useRef, useEffect } from 'react';
import { styled } from '@emotion/styled';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  blurHash?: string;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'auto' | 'low';
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const ImageContainer = styled.div<{ width?: number; height?: number }>\`
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0;
  \${(props) => props.width && \`width: \${props.width}px;\`}
  \${(props) => props.height && \`height: \${props.height}px;\`}
\`;

const Placeholder = styled.div<{ blurHash?: string }>\`
  position: absolute;
  inset: 0;
  background-image: \${(props) => props.blurHash
    ? \`url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><filter id="b"><feGaussianBlur stdDeviation="1" /></filter><rect width="100%" height="100%" filter="url(%23b)" fill="%23e0e0e0"/></svg>')\`
    : 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)'};
  background-size: cover;
  transition: opacity 0.3s ease;
\`;

const StyledImage = styled.img<{ loaded: boolean }>\`
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: \${(props) => (props.loaded ? 1 : 0)};
  transition: opacity 0.3s ease;
\`;

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  srcSet,
  sizes,
  blurHash,
  placeholder,
  loading = 'lazy',
  fetchPriority = 'auto',
  className,
  onLoad,
  onError
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && imgRef.current) {
            // Load the image when it comes into viewport
            if (imgRef.current.dataset.src) {
              imgRef.current.src = imgRef.current.dataset.src;
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current && loading === 'lazy') {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [loading]);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  if (error && placeholder) {
    return (
      <ImageContainer width={width} height={height}>
        <StyledImage src={placeholder} alt={alt} loaded={true} />
      </ImageContainer>
    );
  }

  return (
    <ImageContainer width={width} height={height} className={className}>
      {!loaded && <Placeholder blurHash={blurHash} />}
      <StyledImage
        ref={imgRef}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        loaded={loaded}
        onLoad={handleLoad}
        onError={handleError}
      />
    </ImageContainer>
  );
}
`;
  }

  protected generateUseImageOptimization() {
    return `/**
 * useImageOptimization Hook
 * Custom hook for image optimization and responsive image handling
 */

import { useState, useCallback, useEffect } from 'react';
import { generateBlurHash, generateSrcSet, getOptimalSize, type OptimizedImageOptions } from '../utils/image-optimizer';

interface UseImageOptimizationReturn {
  optimizedSrc: string | null;
  srcSet: string | null;
  blurHash: string | null;
  isLoading: boolean;
  error: string | null;
  generateOptimizedImage: (options: OptimizedImageOptions) => Promise<void>;
  getResponsiveSrc: (containerWidth: number) => string;
}

export function useImageOptimization(src: string): UseImageOptimizationReturn {
  const [optimizedSrc, setOptimizedSrc] = useState<string | null>(null);
  const [srcSet, setSrcSet] = useState<string | null>(null);
  const [blurHash, setBlurHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateOptimizedImage = useCallback(async (options: OptimizedImageOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate responsive srcset
      const sizes = options.sizes || [400, 800, 1200, 1600];
      const generatedSrcSet = generateSrcSet(
        options.src,
        sizes,
        options.format || 'webp'
      );
      setSrcSet(generatedSrcSet);

      // Generate blurhash for placeholder
      const hashResult = await generateBlurHash(options.src);
      if (hashResult) {
        setBlurHash(hashResult.hash);
      }

      setOptimizedSrc(options.src);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to optimize image');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getResponsiveSrc = useCallback((containerWidth: number) => {
    const optimalSize = getOptimalSize(containerWidth);
    if (srcSet) {
      // Find the closest size in srcset
      const matches = srcSet.match(/\\d+w/g);
      if (matches) {
        const sizes = matches.map(m => parseInt(m));
        const closest = sizes.reduce((prev, curr) =>
          Math.abs(curr - optimalSize) < Math.abs(prev - optimalSize) ? curr : prev
        );
        return src.replace(/\\?.*$/, \`?w=\${closest}&f=webp\`);
      }
    }
    return src;
  }, [src, srcSet]);

  useEffect(() => {
    if (src) {
      generateOptimizedImage({ src });
    }
  }, [src, generateOptimizedImage]);

  return {
    optimizedSrc,
    srcSet,
    blurHash,
    isLoading,
    error,
    generateOptimizedImage,
    getResponsiveSrc
  };
}

/**
 * Hook for responsive image sizing based on container
 */
export function useResponsiveImage() {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return { containerRef, containerWidth };
}
`;
  }

  protected generateBuildOptimizer() {
    return `/**
 * Build Optimizer Utilities
 * Tools for optimizing build output, analyzing bundle size, and generating reports
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface BuildMetrics {
  totalSize: number;
  gzipSize: number;
  brotliSize: number;
  chunkCount: number;
  assetCount: number;
  loadTime: {
    fast3G: number;
    slow3G: number;
    4g: number;
  };
}

/**
 * Get build output directory size
 */
export function getBuildSize(distPath: string): number {
  const { statSync, readdirSync, lstatSync } = require('fs');

  function getSizeRecursively(filePath: string): number {
    let size = 0;
    const stats = lstatSync(filePath);

    if (stats.isDirectory()) {
      const files = readdirSync(filePath);
      files.forEach((file: string) => {
        size += getSizeRecursively(join(filePath, file));
      });
    } else {
      size += stats.size;
    }

    return size;
  }

  return getSizeRecursively(distPath);
}

/**
 * Analyze bundle and generate metrics
 */
export function analyzeBundle(distPath: string): BuildMetrics {
  const { readdirSync, statSync, readFileSync } = require('fs');

  let totalSize = 0;
  let chunkCount = 0;
  let assetCount = 0;

  const files = readdirSync(distPath);

  files.forEach((file: string) => {
    const filePath = join(distPath, file);
    const stats = statSync(filePath);

    if (stats.isFile()) {
      totalSize += stats.size;

      if (file.endsWith('.js') || file.endsWith('.css')) {
        chunkCount++;
      } else {
        assetCount++;
      }
    }
  });

  // Estimate compressed sizes (rough approximation)
  const gzipSize = Math.round(totalSize * 0.3);
  const brotliSize = Math.round(totalSize * 0.25);

  // Estimate load times based on connection speeds
  const kbps = {
    fast3G: 1.5, // 1.5 Mbps
    slow3G: 0.4, // 400 Kbps
    4g: 10       // 10 Mbps
  };

  const loadTime = {
    fast3G: Math.round((gzipSize * 8) / (kbps.fast3G * 1000)),
    slow3G: Math.round((gzipSize * 8) / (kbps.slow3G * 1000)),
    4g: Math.round((gzipSize * 8) / (kbps['4g'] * 1000))
  };

  return {
    totalSize,
    gzipSize,
    brotliSize,
    chunkCount,
    assetCount,
    loadTime
  };
}

/**
 * Generate optimization recommendations
 */
export function generateRecommendations(metrics: BuildMetrics): string[] {
  const recommendations: string[] = [];

  // Check bundle size
  if (metrics.gzipSize > 250000) {
    recommendations.push(
      \`Bundle size (\${(metrics.gzipSize / 1024).toFixed(0)}KB gzipped) exceeds 250KB recommendation. Consider code splitting.\`
    );
  }

  // Check chunk count
  if (metrics.chunkCount < 3) {
    recommendations.push(
      'Consider splitting your bundle into more chunks for better caching.'
    );
  }

  // Check load times
  if (metrics.loadTime.slow3G > 5000) {
    recommendations.push(
      'Slow 3G load time exceeds 5 seconds. Consider lazy loading routes and components.'
    );
  }

  if (metrics.loadTime['4g'] > 2000) {
    recommendations.push(
      '4G load time exceeds 2 seconds. Review large dependencies.'
    );
  }

  return recommendations;
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Save build report to file
 */
export function saveBuildReport(
  metrics: BuildMetrics,
  recommendations: string[],
  outputPath: string
): void {
  const { writeFileSync } = require('fs');

  const report = {
    timestamp: new Date().toISOString(),
    metrics: {
      ...metrics,
      totalSize: formatBytes(metrics.totalSize),
      gzipSize: formatBytes(metrics.gzipSize),
      brotliSize: formatBytes(metrics.brotliSize),
    },
    recommendations,
    loadTimeDisplay: {
      fast3G: \`\${metrics.loadTime.fast3G / 1000}s\`,
      slow3G: \`\${metrics.loadTime.slow3G / 1000}s\`,
      '4g': \`\${metrics.loadTime['4g'] / 1000}s\`
    }
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(\`Build report saved to \${outputPath}\`);
}

/**
 * Run build with optimizations
 */
export function runOptimizedBuild(): void {
  console.log('Running optimized build...');

  try {
    // Run TypeScript check
    console.log('Checking TypeScript...');
    execSync('tsc --noEmit', { stdio: 'inherit' });

    // Run Vite build
    console.log('Building with Vite...');
    execSync('vite build', { stdio: 'inherit' });

    // Analyze the build
    console.log('Analyzing build output...');
    const metrics = analyzeBundle('dist');

    console.log('\\n=== Build Metrics ===');
    console.log(\`Total Size: \${formatBytes(metrics.totalSize)}\`);
    console.log(\`Gzip Size: \${formatBytes(metrics.gzipSize)}\`);
    console.log(\`Brotli Size: \${formatBytes(metrics.brotliSize)}\`);
    console.log(\`Chunks: \${metrics.chunkCount}\`);
    console.log(\`Assets: \${metrics.assetCount}\`);

    console.log('\\n=== Estimated Load Times ===');
    console.log(\`Slow 3G: \${metrics.loadTime.slow3G / 1000}s\`);
    console.log(\`Fast 3G: \${metrics.loadTime.fast3G / 1000}s\`);
    console.log(\`4G: \${metrics.loadTime['4g'] / 1000}s\`);

    // Generate recommendations
    const recommendations = generateRecommendations(metrics);
    if (recommendations.length > 0) {
      console.log('\\n=== Recommendations ===');
      recommendations.forEach(rec => console.log(\`• \${rec}\`));
    }

    // Save report
    saveBuildReport(metrics, recommendations, 'dist/build-report.json');

    console.log('\\n✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}
`;
  }

  protected generateImageOptimizationScript() {
    return `#!/usr/bin/env node

/**
 * Image Optimization Script
 * Optimizes all images in the public directory using sharp
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

console.log('🖼️  Image Optimization Script');
console.log('=' .repeat(40));

/**
 * Check if sharp is installed
 */
function checkDependencies() {
  try {
    require.resolve('sharp');
    return true;
  } catch {
    console.error('❌ sharp is not installed. Run: npm install sharp');
    return false;
  }
}

/**
 * Get all image files in directory recursively
 */
function getImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getImageFiles(filePath, fileList);
    } else if (IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Optimize a single image
 */
async function optimizeImage(inputPath, sharp) {
  const ext = path.extname(inputPath).toLowerCase();
  const stats = fs.statSync(inputPath);
  const originalSize = stats.size;

  try {
    let image = sharp(inputPath);
    let metadata = await image.metadata();

    // Resize if too large (max 1920px)
    if (metadata.width > 1920) {
      image = image.resize(1920, null, {
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    // Generate output path
    const outputPath = inputPath.replace(/\\.(?=[^.]*$)/, '-optimized' + ext);

    // Optimize based on format
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        await image
          .jpeg({ quality: 80, progressive: true })
          .toFile(outputPath);
        break;

      case '.png':
        await image
          .png({ quality: 80, compressionLevel: 9 })
          .toFile(outputPath);
        break;

      case '.webp':
        await image
          .webp({ quality: 80 })
          .toFile(outputPath);
        break;

      default:
        // Copy other formats
        fs.copyFileSync(inputPath, outputPath);
    }

    const optimizedStats = fs.statSync(outputPath);
    const savings = originalSize - optimizedStats.size;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

    return {
      input: inputPath,
      output: outputPath,
      original: formatBytes(originalSize),
      optimized: formatBytes(optimizedStats.size),
      savings: savings > 0 ? formatBytes(savings) : '0',
      percent: savings > 0 ? savingsPercent + '%' : '0%'
    };
  } catch (error) {
    console.error(\`❌ Failed to optimize \${inputPath}:\`, error.message);
    return null;
  }
}

/**
 * Format bytes for display
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main optimization function
 */
async function main() {
  if (!checkDependencies()) {
    process.exit(1);
  }

  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(\`❌ Public directory not found: \${PUBLIC_DIR}\`);
    process.exit(1);
  }

  const sharp = require('sharp');
  const imageFiles = getImageFiles(PUBLIC_DIR);

  if (imageFiles.length === 0) {
    console.log('No images found in public directory.');
    return;
  }

  console.log(\`Found \${imageFiles.length} image(s) to optimize\\n\`);

  let totalOriginal = 0;
  let totalOptimized = 0;
  let results = [];

  for (const imageFile of imageFiles) {
    const relativePath = path.relative(PUBLIC_DIR, imageFile);
    process.stdout.write(\`Optimizing: \${relativePath}... \`);

    const result = await optimizeImage(imageFile, sharp);

    if (result) {
      const origSize = fs.statSync(imageFile).size;
      const optSize = fs.statSync(result.output).size;
      totalOriginal += origSize;
      totalOptimized += optSize;
      results.push(result);

      console.log(\`✓ \${result.savings} saved (\${result.percent})\`);
    }
  }

  const totalSavings = totalOriginal - totalOptimized;
  const totalPercent = ((totalSavings / totalOriginal) * 100).toFixed(1);

  console.log('\\n' + '='.repeat(40));
  console.log('📊 Optimization Summary');
  console.log('  '.repeat(40));
  console.log(\`Total Original:  \${formatBytes(totalOriginal)}\`);
  console.log(\`Total Optimized: \${formatBytes(totalOptimized)}\`);
  console.log(\`Total Savings:   \${formatBytes(totalSavings)} (\${totalPercent}%)\`);
  console.log('='.repeat(40));

  // Generate WebP versions for better browser support
  console.log('\\n🔄 Generating WebP versions...');

  for (const imageFile of imageFiles) {
    const ext = path.extname(imageFile).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      const relativePath = path.relative(PUBLIC_DIR, imageFile);
      process.stdout.write(\`  \${relativePath}... \`);

      try {
        const webpPath = imageFile.replace(/\\.[^.]+$/, '.webp');
        await sharp(imageFile).webp({ quality: 80 }).toFile(webpPath);
        console.log('✓');
      } catch (error) {
        console.log('✗');
      }
    }
  }

  console.log('\\n✅ Image optimization complete!');
}

main().catch(console.error);
`;
  }

  protected generateBuildReportScript() {
    return `#!/usr/bin/env node

/**
 * Build Report Generator
 * Generates detailed build reports with bundle analysis and recommendations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const REPORT_PATH = path.resolve(DIST_DIR, 'build-report.json');

console.log('📊 Build Report Generator');
console.log('='.repeat(40));

/**
 * Get all JS files in dist
 */
function getJSFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Analyze bundle files
 */
function analyzeBundles() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ Dist directory not found. Run build first.');
    process.exit(1);
  }

  const jsFiles = getJSFiles(DIST_DIR);
  const cssFiles = fs.readdirSync(DIST_DIR)
    .filter(f => f.endsWith('.css'))
    .map(f => path.join(DIST_DIR, f));

  let totalSize = 0;
  let jsSize = 0;
  let cssSize = 0;

  const bundles = [];

  for (const file of [...jsFiles, ...cssFiles]) {
    const stats = fs.statSync(file);
    const size = stats.size;
    const relativePath = path.relative(DIST_DIR, file);

    totalSize += size;

    if (file.endsWith('.js')) {
      jsSize += size;
    } else {
      cssSize += size;
    }

    bundles.push({
      file: relativePath,
      size: size,
      formatted: formatBytes(size)
    });
  }

  // Sort by size
  bundles.sort((a, b) => b.size - a.size);

  // Get HTML file size
  const htmlFile = path.join(DIST_DIR, 'index.html');
  let htmlSize = 0;
  if (fs.existsSync(htmlFile)) {
    htmlSize = fs.statSync(htmlFile).size;
  }

  return {
    totalSize,
    jsSize,
    cssSize,
    htmlSize,
    bundles,
    gzipEstimate: Math.round(totalSize * 0.3),
    brotliEstimate: Math.round(totalSize * 0.25)
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(analysis) {
  const recommendations = [];
  const { totalSize, bundles, jsSize } = analysis;

  // Check total size
  if (analysis.gzipEstimate > 250000) {
    recommendations.push({
      type: 'warning',
      message: \`Gzipped bundle size (\${formatBytes(analysis.gzipEstimate)}) exceeds 250KB recommendation\`
    });
  }

  // Check for large bundles
  bundles.forEach(bundle => {
    if (bundle.size > 100000) {
      recommendations.push({
        type: 'info',
        message: \`Large bundle: \${bundle.file} (\${bundle.formatted}) - consider code splitting\`
      });
    }
  });

  // Check JS vs CSS ratio
  if (jsSize > analysis.totalSize * 0.8) {
    recommendations.push({
      type: 'info',
      message: 'JavaScript makes up >80% of bundle. Consider CSS extraction for critical styles.'
    });
  }

  return recommendations;
}

/**
 * Generate performance estimates
 */
function estimatePerformance(analysis) {
  const sizes = {
    'slow-3g': 400 * 1024,    // 400 Kbps
    'fast-3g': 1.5 * 1024 * 1024,  // 1.5 Mbps
    '4g': 10 * 1024 * 1024        // 10 Mbps
  };

  const gzipSize = analysis.gzipEstimate * 8; // Convert to bits

  return {
    'slow-3g': Math.round(gzipSize / sizes['slow-3g'] * 1000) / 1000,
    'fast-3g': Math.round(gzipSize / sizes['fast-3g'] * 1000) / 1000,
    '4g': Math.round(gzipSize / sizes['4g'] * 1000) / 1000
  };
}

/**
 * Main function
 */
function main() {
  console.log('Analyzing build output...\\n');

  const analysis = analyzeBundles();
  const recommendations = generateRecommendations(analysis);
  const performance = estimatePerformance(analysis);

  // Print summary
  console.log('📦 Bundle Analysis');
  console.log('─'.repeat(40));
  console.log(\`Total Size:     \${formatBytes(analysis.totalSize)}\`);
  console.log(\`JavaScript:     \${formatBytes(analysis.jsSize)}\`);
  console.log(\`CSS:            \${formatBytes(analysis.cssSize)}\`);
  console.log(\`HTML:           \${formatBytes(analysis.htmlSize)}\`);
  console.log(\`Est. Gzip:      \${formatBytes(analysis.gzipEstimate)}\`);
  console.log(\`Est. Brotli:    \${formatBytes(analysis.brotliEstimate)}\`);

  // Print bundles
  console.log('\\n📚 Bundles (sorted by size)');
  console.log('─'.repeat(40));
  analysis.bundles.slice(0, 10).forEach(bundle => {
    const bar = '█'.repeat(Math.min(30, Math.floor(bundle.size / 1000)));
    console.log(\`  \${bundle.file.padEnd(30)} \${bundle.formatted.padStart(10)}\`);
  });

  // Print performance estimates
  console.log('\\n⚡ Estimated Load Times');
  console.log('─'.repeat(40));
  console.log(\`  Slow 3G:  \${performance['slow-3g']}s\`);
  console.log(\`  Fast 3G:  \${performance['fast-3g']}s\`);
  console.log(\`  4G:       \${performance['4g']}s\`);

  // Print recommendations
  if (recommendations.length > 0) {
    console.log('\\n💡 Recommendations');
    console.log('─'.repeat(40));
    recommendations.forEach(rec => {
      const icon = rec.type === 'warning' ? '⚠️' : 'ℹ️';
      console.log(\`  \${icon} \${rec.message}\`);
    });
  }

  // Generate report JSON
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSize: analysis.totalSize,
      gzipSize: analysis.gzipEstimate,
      brotliSize: analysis.brotliEstimate
    },
    bundles: analysis.bundles,
    performance,
    recommendations
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\\n' + '='.repeat(40));
  console.log(\`✅ Report saved to: \${REPORT_PATH}\`);
  console.log('='.repeat(40));
}

main();
`;
  }

  // ============ MDX INTEGRATION GENERATORS ============

  protected generateMDXProvider() {
    return `/**
 * MDX Provider Component
 * Wraps MDX content with custom components and provides context
 */

import { MDXProvider as BaseMDXProvider } from '@mdx-js/react';
import { components } from './mdx-components';

interface MDXProviderProps {
  children: React.ReactNode;
}

export function MDXProvider({ children }: MDXProviderProps) {
  return (
    <BaseMDXProvider components={components}>
      {children}
    </BaseMDXProvider>
  );
}

/**
 * Hook to access MDX components
 */
export function useMDXComponents() {
  return components;
}
`;
  }

  protected generateMDXComponents() {
    return `/**
 * Custom MDX Components
 * Maps Markdown elements to React components for styling
 */

import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { OptimizeImage } from './OptimizedImage';

// Typography components
export const H1 = styled.h1\`
  font-size: 2.5rem;
  font-weight: 700;
  margin: 2rem 0 1rem;
  color: #1a1a1a;
  line-height: 1.2;
\`;

export const H2 = styled.h2\`
  font-size: 2rem;
  font-weight: 600;
  margin: 1.75rem 0 0.875rem;
  color: #1a1a1a;
  line-height: 1.3;
\`;

export const H3 = styled.h3\`
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem;
  color: #1a1a1a;
  line-height: 1.4;
\`;

export const H4 = styled.h4\`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.25rem 0 0.625rem;
  color: #1a1a1a;
  line-height: 1.4;
\`;

export const H5 = styled.h5\`
  font-size: 1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #1a1a1a;
  line-height: 1.5;
\`;

export const H6 = styled.h6\`
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0.875rem 0 0.4375rem;
  color: #6b7280;
  line-height: 1.5;
\`;

export const P = styled.p\`
  font-size: 1rem;
  line-height: 1.75;
  margin: 1rem 0;
  color: #374151;
\`;

export const Text = styled.span\`
  font-size: 1rem;
  line-height: 1.5;
  color: #374151;
\`;

// List components
export const Ul = styled.ul\`
  list-style: disc;
  padding-left: 1.5rem;
  margin: 1rem 0;
  color: #374151;

  li {
    margin: 0.5rem 0;
  }
\`;

export const Ol = styled.ol\`
  list-style: decimal;
  padding-left: 1.5rem;
  margin: 1rem 0;
  color: #374151;

  li {
    margin: 0.5rem 0;
  }
\`;

export const Li = styled.li\`
  margin: 0.5rem 0;
\`;

// Code components
export const Code = styled.code\`
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875em;
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  color: #e11d48;
\`;

export const Pre = styled.pre\`
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875rem;
  background: #1f2937;
  color: #f9fafb;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 1.5rem 0;

  code {
    background: transparent;
    padding: 0;
    color: inherit;
  }
\`;

export const InlineCode = styled.code\`
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.875em;
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  color: #e11d48;
\`;

// Blockquote
export const Blockquote = styled.blockquote\`
  border-left: 4px solid #6366f1;
  padding: 0.75rem 1rem;
  margin: 1.5rem 0;
  background: #f8fafc;
  color: #475569;
  font-style: italic;
\`;

// Table components
export const Table = styled.table\`
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
  font-size: 0.875rem;
\`;

export const Thead = styled.thead\`
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
\`;

export const Tbody = styled.tbody\`\`

\`;

export const Tr = styled.tr\`
  border-bottom: 1px solid #e5e7eb;

  &:last-child {
    border-bottom: none;
  }
\`;

export const Th = styled.th\`
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
\`;

export const Td = styled.td\`
  padding: 0.75rem 1rem;
  color: #6b7280;
\`;

// Horizontal rule
export const Hr = styled.hr\`
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 2rem 0;
\`;

// Anchor/Link
export const A = styled.a\`
  color: #4f46e5;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
\`;

// Image component wrapper
export const MDXImage = ({ src, alt, ...props }: any) => {
  return <OptimizeImage src={src} alt={alt} {...props} />;
};

// Alert/Callout component
export const Alert = styled.div<{ type?: 'info' | 'warning' | 'error' | 'success' }>\`
  padding: 1rem;
  border-radius: 0.5rem;
  margin: 1rem 0;
  border-left: 4px solid;
  background: #f9fafb;

  \${(props) => {
    switch (props.type) {
      case 'warning':
        return \`
          border-color: #f59e0b;
          background: #fef3c7;
        \`;
      case 'error':
        return \`
          border-color: #ef4444;
          background: #fee2e2;
        \`;
      case 'success':
        return \`
          border-color: #10b981;
          background: #d1fae5;
        \`;
      default:
        return \`
          border-color: #3b82f6;
          background: #dbeafe;
        \`;
    }
  }}
\`;

// Component for code block titles
export const CodeBlockTitle = styled.div\`
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 0.75rem;
  color: #9ca3af;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #374151;
  margin-bottom: 0;
\`;

// Export all components for MDX
export const components = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  p: P,
  span: Text,
  ul: Ul,
  ol: Ol,
  li: Li,
  code: InlineCode,
  pre: Pre,
  a: A,
  blockquote: Blockquote,
  table: Table,
  thead: Thead,
  tbody: Tbody,
  tr: Tr,
  th: Th,
  td: Td,
  hr: Hr,
  img: MDXImage,
  Alert,
  CodeBlockTitle
};
`;
  }

  protected generateUseMDXComponentsHook() {
    return `/**
 * useMDXComponents Hook
 * Provides access to custom MDX components
 */

import { components } from '../components/mdx-components';

/**
 * Get a specific MDX component by name
 */
export function getMDXComponent(name: keyof typeof components) {
  return components[name];
}

/**
 * Get all MDX components
 */
export function getAllMDXComponents() {
  return components;
}

/**
 * Map of component names to their React elements
 */
export const componentMap = components;

/**
 * Type-safe component names
 */
export type MDXComponentName = keyof typeof components;
`;
  }

  protected generateMDXVitePlugin() {
    return `/**
 * MDX Vite Plugin Configuration
 * Configures MDX support for Vite with custom rehype and remark plugins
 */

import mdx from '@mdx-js/rollup';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypePrettyCode from 'rehype-pretty-code';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    // MDX plugin with custom configuration
    mdx({
      // Include MDX files from these paths
      include: ['**/*.mdx', '**/*.md'],
      // Apply remark plugins
      remarkPlugins: [
        remarkGfm, // GitHub Flavored Markdown
      ],
      // Apply rehype plugins
      rehypePlugins: [
        rehypeSlug, // Add IDs to headings
        rehypeAutolinkHeadings, // Add links to headings
        rehypePrettyCode, // Pretty code blocks
      ],
      // Enable JSX in MDX
      jsx: true,
      // Import source files as React components
      providerImportName: '@mdx-js/react',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@store': path.resolve(__dirname, './src/store'),
    },
  },
});
`;
  }

  protected generateMDXTypes() {
    return `/**
 * MDX Type Definitions
 * TypeScript types for MDX content and components
 */

declare module '*.mdx' {
  let MDXContent: (props: any) => JSX.Element;
  export default MDXContent;
}

declare module '*.md' {
  let MDXContent: (props: any) => JSX.Element;
  export default MDXContent;
}

// MDX component props
export interface MDXProps {
  children?: React.ReactNode;
}

// Frontmatter types for MDX files
export interface MDXFrontmatter {
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  author?: string;
  draft?: boolean;
  [key: string]: any;
}

// MDX content with frontmatter
export interface MDXContent {
  frontmatter: MDXFrontmatter;
  content: string;
}

// Component prop types
export interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
  meta?: string;
}

export interface InlineCodeProps {
  children: string;
}

export interface AlertProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
}
`;
  }

  protected generateMDXExample() {
    return `---
title: "Getting Started with ${this.context.name}"
description: "A comprehensive guide to building modern web applications"
date: "2024-01-10"
tags: ["getting-started", "tutorial"]
author: "Your Name"
---

# Welcome to ${this.context.name}

This is an **MDX** file, which allows you to use JSX components directly in your Markdown!

## Features

- 🚀 **Vite** - Lightning fast build tool
- ⚛️ **React 18** - Latest React with hooks
- 🎨 **Emotion** - CSS-in-JS styling
- 📱 **PWA** - Progressive Web App support
- 📊 **Analytics** - Built-in analytics tracking
- 🗄️ **CMS** - Headless CMS integration

## Code Blocks

You can write code with syntax highlighting:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const fetchUser = async (id: number): Promise<User> => {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
};
\`\`\`

## Inline Code

You can also use \`inline code\` like \`const x = 42\`.

## Alerts

<Alert type="info">
This is an informational alert. Use it to highlight important notes.
</Alert>

<Alert type="warning">
This is a warning alert. Use it to caution users about potential issues.
</Alert>

<Alert type="success">
This is a success alert. Use it to indicate successful operations.
</Alert>

## Tables

| Feature | Status | Notes |
|---------|--------|-------|
| React | ✅ | With hooks |
| TypeScript | ✅ | Strict mode |
| Vite | ✅ | Fast HMR |
| PWA | ✅ | Offline support |

## Links

You can use regular [links](https://example.com) or [internal links](/dashboard).

## Images

![Example Image](/icon-192x192.png)

## Lists

Unordered lists:
- Item 1
- Item 2
  - Nested item
- Item 3

Ordered lists:
1. First item
2. Second item
3. Third item

## Using Components

You can use any React component directly in your MDX:

<div style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', padding: '1rem', borderRadius: '0.5rem', color: 'white' }}>
  This is a styled div using Emotion!
</div>

## Blockquotes

> "The best way to predict the future is to invent it." - Alan Kay

## Horizontal Rule

---

## Conclusion

MDX gives you the power of Markdown with the flexibility of JSX!
`;
  }

  protected generateEmotionTheme() {
    return `/**
 * Emotion Theme Configuration
 * Centralized theme tokens for colors, typography, spacing, and more
 */

export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    neutral: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    background: {
      default: string;
      paper: string;
      overlay: string;
    };
    text: {
      primary: string;
      secondary: string;
      disabled: string;
      hint: string;
    };
    divider: string;
  };
  typography: {
    fontFamily: {
      primary: string;
      secondary: string;
      mono: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
    };
    fontWeight: {
      light: number;
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
      extrabold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
  };
  breakpoints: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
  zIndex: {
    dropdown: number;
    sticky: number;
    fixed: number;
    modalBackdrop: number;
    modal: number;
    popover: number;
    tooltip: number;
  };
}

export const lightTheme: Theme = {
  colors: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    background: {
      default: '#ffffff',
      paper: '#f9fafb',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#111827',
      secondary: '#6b7280',
      disabled: '#9ca3af',
      hint: '#9ca3af',
    },
    divider: '#e5e7eb',
  },
  typography: {
    fontFamily: {
      primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      secondary: '"Inter", system-ui, -apple-system, sans-serif',
      mono: '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  transitions: {
    fast: '150ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
  zIndex: {
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modalBackdrop: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
  },
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    primary: '#818cf8',
    secondary: '#a78bfa',
    accent: '#f472b6',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    neutral: {
      50: '#1f2937',
      100: '#374151',
      200: '#4b5563',
      300: '#6b7280',
      400: '#9ca3af',
      500: '#d1d5db',
      600: '#e5e7eb',
      700: '#f3f4f6',
      800: '#f9fafb',
      900: '#ffffff',
    },
    background: {
      default: '#111827',
      paper: '#1f2937',
      overlay: 'rgba(0, 0, 0, 0.7)',
    },
    text: {
      primary: '#f9fafb',
      secondary: '#d1d5db',
      disabled: '#6b7280',
      hint: '#9ca3af',
    },
    divider: '#374151',
  },
};

export type ThemeMode = 'light' | 'dark';

export const getTheme = (mode: ThemeMode = 'light'): Theme => {
  return mode === 'dark' ? darkTheme : lightTheme;
};
`;
  }

  protected generateGlobalStyles() {
    return `/**
 * Global Styles with Emotion
 * CSS reset and global styles using Emotion's Global component
 */

import { css, Global } from '@emotion/react';
import { Theme } from './theme';

const globalStyles = (theme: Theme) => css\`
  /* CSS Reset */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    font-family: \${theme.typography.fontFamily.primary};
    font-size: \${theme.typography.fontSize.base};
    font-weight: \${theme.typography.fontWeight.normal};
    line-height: \${theme.typography.lineHeight.normal};
    color: \${theme.colors.text.primary};
    background-color: \${theme.colors.background.default};
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    font-weight: \${theme.typography.fontWeight.semibold};
    line-height: \${theme.typography.lineHeight.tight};
    color: \${theme.colors.text.primary};
    margin-bottom: \${theme.spacing.md};
  }

  h1 {
    font-size: \${theme.typography.fontSize['4xl']};
    font-weight: \${theme.typography.fontWeight.extrabold};
  }

  h2 {
    font-size: \${theme.typography.fontSize['3xl']};
  }

  h3 {
    font-size: \${theme.typography.fontSize['2xl']};
  }

  h4 {
    font-size: \${theme.typography.fontSize.xl};
  }

  h5 {
    font-size: \${theme.typography.fontSize.lg};
  }

  h6 {
    font-size: \${theme.typography.fontSize.base};
    color: \${theme.colors.text.secondary};
  }

  p {
    margin-bottom: \${theme.spacing.md};
    color: \${theme.colors.text.primary};
  }

  /* Links */
  a {
    color: \${theme.colors.primary};
    text-decoration: none;
    transition: color \${theme.transitions.fast};

    &:hover {
      color: \${theme.colors.secondary};
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid \${theme.colors.primary};
      outline-offset: 2px;
    }
  }

  /* Lists */
  ul, ol {
    margin-bottom: \${theme.spacing.md};
    padding-left: \${theme.spacing.lg};
  }

  li {
    margin-bottom: \${theme.spacing.xs};
  }

  /* Code */
  code, pre {
    font-family: \${theme.typography.fontFamily.mono};
  }

  code {
    background-color: \${theme.colors.neutral[100]};
    color: \${theme.colors.error};
    padding: 0.125rem 0.375rem;
    border-radius: \${theme.borderRadius.sm};
    font-size: 0.875em;
  }

  pre {
    background-color: \${theme.colors.neutral[900]};
    color: \${theme.colors.neutral[50]};
    padding: \${theme.spacing.md};
    border-radius: \${theme.borderRadius.md};
    overflow-x: auto;
    margin-bottom: \${theme.spacing.md};

    code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
  }

  /* Blockquotes */
  blockquote {
    border-left: 4px solid \${theme.colors.primary};
    padding-left: \${theme.spacing.md};
    margin: \${theme.spacing.md} 0;
    color: \${theme.colors.text.secondary};
    font-style: italic;
  }

  /* Horizontal Rule */
  hr {
    border: none;
    border-top: 1px solid \${theme.colors.divider};
    margin: \${theme.spacing.xl} 0;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: \${theme.spacing.md};
  }

  th, td {
    padding: \${theme.spacing.sm} \${theme.spacing.md};
    text-align: left;
    border-bottom: 1px solid \${theme.colors.divider};
  }

  th {
    font-weight: \${theme.typography.fontWeight.semibold};
    background-color: \${theme.colors.neutral[50]};
    color: \${theme.colors.text.primary};
  }

  /* Images */
  img {
    max-width: 100%;
    height: auto;
    display: block;
  }

  /* Buttons reset */
  button {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
  }

  /* Form elements */
  input, textarea, select {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
  }

  /* Selection */
  ::selection {
    background-color: \${theme.colors.primary};
    color: white;
  }

  /* Focus visible */
  :focus-visible {
    outline: 2px solid \${theme.colors.primary};
    outline-offset: 2px;
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: \${theme.colors.neutral[100]};
  }

  ::-webkit-scrollbar-thumb {
    background: \${theme.colors.neutral[400]};
    border-radius: \${theme.borderRadius.full};
  }

  ::-webkit-scrollbar-thumb:hover {
    background: \${theme.colors.neutral[500]};
  }
\`;

export const GlobalStyles = () => <Global styles={globalStyles} />;
`;
  }

  protected generateStyleVariables() {
    return `/**
 * CSS Custom Properties (CSS Variables)
 * Variables that can be used in regular CSS and updated dynamically
 */

import { Theme } from './theme';

export const cssVars = (theme: Theme) => ({
  '--color-primary': theme.colors.primary,
  '--color-secondary': theme.colors.secondary,
  '--color-accent': theme.colors.accent,
  '--color-success': theme.colors.success,
  '--color-warning': theme.colors.warning,
  '--color-error': theme.colors.error,
  '--color-info': theme.colors.info,
  '--color-bg-default': theme.colors.background.default,
  '--color-bg-paper': theme.colors.background.paper,
  '--color-text-primary': theme.colors.text.primary,
  '--color-text-secondary': theme.colors.text.secondary,
  '--color-text-disabled': theme.colors.text.disabled,
  '--color-divider': theme.colors.divider,
  '--font-family-primary': theme.typography.fontFamily.primary,
  '--font-family-secondary': theme.typography.fontFamily.secondary,
  '--font-family-mono': theme.typography.fontFamily.mono,
  '--spacing-xs': theme.spacing.xs,
  '--spacing-sm': theme.spacing.sm,
  '--spacing-md': theme.spacing.md,
  '--spacing-lg': theme.spacing.lg,
  '--spacing-xl': theme.spacing.xl,
  '--spacing-2xl': theme.spacing['2xl'],
  '--spacing-3xl': theme.spacing['3xl'],
  '--border-radius-sm': theme.borderRadius.sm,
  '--border-radius-md': theme.borderRadius.md,
  '--border-radius-lg': theme.borderRadius.lg,
  '--border-radius-xl': theme.borderRadius.xl,
  '--border-radius-full': theme.borderRadius.full,
  '--transition-fast': theme.transitions.fast,
  '--transition-normal': theme.transitions.normal,
  '--transition-slow': theme.transitions.slow,
});

/**
 * Helper to get CSS variable value
 */
export const getVar = (name: string, fallback?: string): string => {
  return fallback ? \`var(\${name}, \${fallback})\` : \`var(\${name})\`;
};

/**
 * Helper to set CSS variable
 */
export const setVar = (name: string, value: string): void => {
  document.documentElement.style.setProperty(name, value);
};
`;
  }

  protected generateStyleMixins() {
    return `/**
 * Style Mixins
 * Reusable style patterns using Emotion
 */

import { css } from '@emotion/react';
import { Theme } from './theme';

/**
 * Flexbox centering
 */
export const flexCenter = css\`
  display: flex;
  align-items: center;
  justify-content: center;
\`;

/**
 * Flexbox column
 */
export const flexColumn = css\`
  display: flex;
  flex-direction: column;
\`;

/**
 * Visually hidden (accessible but not visible)
 */
export const visuallyHidden = css\`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
\`;

/**
 * Reset button styles
 */
export const resetButton = css\`
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
\`;

/**
 * Reset link styles
 */
export const resetLink = css\`
  color: inherit;
  text-decoration: none;
  cursor: pointer;

  &:hover,
  &:focus {
    text-decoration: none;
  }
\`;

/**
 * Text truncation (ellipsis)
 */
export const textTruncate = css\`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
\`;

/**
 * Multi-line text truncation
 */
export const textClamp = (lines: number) => css\`
  display: -webkit-box;
  -webkit-line-clamp: \${lines};
  -webkit-box-orient: vertical;
  overflow: hidden;
\`;

/**
 * Clearfix
 */
export const clearfix = css\`
  &::after {
    content: '';
    display: table;
    clear: both;
  }
\`;

/**
 * Absolute positioning center
 */
export const absoluteCenter = css\`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
\`;

/**
 * Cover (absolute full size of parent)
 */
export const cover = css\`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
\`;

/**
 * Hide scrollbar but keep functionality
 */
export const hideScrollbar = css\`
  -ms-overflow-style: none;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
\`;

/**
 * Responsive container
 */
export const container = (theme: Theme) => css\`
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: \${theme.spacing.md};
  padding-right: \${theme.spacing.md};

  @media (min-width: \${theme.breakpoints.md}) {
    padding-left: \${theme.spacing.lg};
    padding-right: \${theme.spacing.lg};
  }
\`;

/**
 * Card base style
 */
export const cardStyle = (theme: Theme) => css\`
  background-color: \${theme.colors.background.paper};
  border-radius: \${theme.borderRadius.lg};
  box-shadow: \${theme.shadows.sm};
  padding: \${theme.spacing.lg};
  transition: box-shadow \${theme.transitions.normal};

  &:hover {
    box-shadow: \${theme.shadows.md};
  }
\`;

/**
 * Button base style
 */
export const buttonBase = (theme: Theme) => css\`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: \${theme.spacing.sm};
  padding: \${theme.spacing.sm} \${theme.spacing.md};
  border-radius: \${theme.borderRadius.md};
  font-weight: \${theme.typography.fontWeight.medium};
  font-size: \${theme.typography.fontSize.base};
  line-height: 1;
  cursor: pointer;
  transition: all \${theme.transitions.fast};
  border: 1px solid transparent;
  user-select: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid \${theme.colors.primary};
    outline-offset: 2px;
  }
\`;

/**
 * Button variant styles
 */
export const buttonVariant = (theme: Theme, variant: 'primary' | 'secondary' | 'outline' | 'ghost') => {
  const variants = {
    primary: css\`
      background-color: \${theme.colors.primary};
      color: white;

      &:hover:not(:disabled) {
        background-color: \${theme.colors.secondary};
      }
    \`,
    secondary: css\`
      background-color: \${theme.colors.secondary};
      color: white;

      &:hover:not(:disabled) {
        background-color: \${theme.colors.accent};
      }
    \`,
    outline: css\`
      background-color: transparent;
      border-color: \${theme.colors.divider};
      color: \${theme.colors.text.primary};

      &:hover:not(:disabled) {
        background-color: \${theme.colors.neutral[100]};
        border-color: \${theme.colors.neutral[300]};
      }
    \`,
    ghost: css\`
      background-color: transparent;
      color: \${theme.colors.text.primary};

      &:hover:not(:disabled) {
        background-color: \${theme.colors.neutral[100]};
      }
    \`,
  };

  return variants[variant];
}
\`;

/**
 * Input base style
 */
export const inputBase = (theme: Theme) => css\`
  display: block;
  width: 100%;
  padding: \${theme.spacing.sm} \${theme.spacing.md};
  border: 1px solid \${theme.colors.divider};
  border-radius: \${theme.borderRadius.md};
  font-size: \${theme.typography.fontSize.base};
  color: \${theme.colors.text.primary};
  background-color: \${theme.colors.background.default};
  transition: border-color \${theme.transitions.fast};

  &::placeholder {
    color: \${theme.colors.text.hint};
  }

  &:hover {
    border-color: \${theme.colors.neutral[400]};
  }

  &:focus {
    outline: none;
    border-color: \${theme.colors.primary};
    box-shadow: 0 0 0 3px \${theme.colors.primary}33;
  }

  &:disabled {
    background-color: \${theme.colors.neutral[100]};
    color: \${theme.colors.text.disabled};
    cursor: not-allowed;
  }
\`;
`;
  }

  protected generateThemeProvider() {
    return `/**
 * ThemeProvider Component
 * Provides theme context to the application with dark mode support
 */

import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import { useState, useEffect, ReactNode } from 'react';
import { lightTheme, darkTheme, Theme, ThemeMode } from '../styles/theme';
import { GlobalStyles } from '../styles/globalStyles';

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, defaultMode = 'light' }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Check localStorage or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme-mode') as ThemeMode;
      if (saved) return saved;

      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return defaultMode;
  });

  const theme: Theme = mode === 'dark' ? darkTheme : lightTheme;

  // Toggle theme mode
  const toggleMode = () => {
    setMode((prev) => {
      const newMode = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme-mode', newMode);
      return newMode;
    });
  };

  // Set theme mode
  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem('theme-mode', newMode);
  };

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only change if user hasn't manually set a preference
      if (!localStorage.getItem('theme-mode')) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <EmotionThemeProvider theme={theme}>
      <GlobalStyles />
      {children}
    </EmotionThemeProvider>
  );
}

export type { ThemeMode };
`;
  }

  protected generateUseThemeHook() {
    return `/**
 * useTheme Hook
 * Access theme and theme controls from Emotion's ThemeProvider
 */

import { useTheme as useEmotionTheme } from '@emotion/react';
import { Theme } from '../styles/theme';

export function useTheme(): Theme {
  const theme = useEmotionTheme() as Theme;
  return theme;
}

/**
 * Hook for accessing theme mode controls
 * Note: This requires wrapping the app with our custom ThemeProvider
 */
export function useThemeMode() {
  // This would require a separate context for mode management
  // For now, users can implement their own mode context
  const getMode = (): 'light' | 'dark' => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  };

  const toggleMode = () => {
    const currentMode = getMode();
    const newMode = currentMode === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newMode);
    localStorage.setItem('theme-mode', newMode);
    // Trigger a custom event for components listening for theme changes
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode: newMode } }));
  };

  const setMode = (mode: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('theme-mode', mode);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { mode } }));
  };

  return {
    mode: getMode(),
    toggleMode,
    setMode,
  };
}
`;
  }

  protected generateUseMediaQueryHook() {
    return `/**
 * useMediaQuery Hook
 * Respond to CSS media queries in React components
 */

import { useState, useEffect } from 'react';

interface MediaQueryOptions {
  defaultValue?: boolean;
  initializeWithValue?: boolean;
}

export function useMediaQuery(
  query: string,
  options: MediaQueryOptions = {}
): boolean {
  const { defaultValue = false, initializeWithValue = true } = options;

  const [matches, setMatches] = useState<boolean>(() => {
    if (initializeWithValue) {
      if (typeof window !== 'undefined') {
        return window.matchMedia(query).matches;
      }
    }
    return defaultValue;
  });

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const updateMatches = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Set initial value
    setMatches(mediaQueryList.matches);

    // Listen for changes
    mediaQueryList.addEventListener('change', updateMatches);
    return () => mediaQueryList.removeEventListener('change', updateMatches);
  }, [query]);

  return matches;
}

/**
 * Predefined media query hooks
 */
export const useBreakpoint = () => {
  const isXs = useMediaQuery('(min-width: 0px)');
  const isSm = useMediaQuery('(min-width: 640px)');
  const isMd = useMediaQuery('(min-width: 768px)');
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isXl = useMediaQuery('(min-width: 1280px)');
  const is2Xl = useMediaQuery('(min-width: 1536px)');

  return {
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    is2Xl,
    // Current breakpoint (largest that matches)
    current: is2Xl ? '2xl' : isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs',
  };
};

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

export const usePrefersDarkMode = () => useMediaQuery('(prefers-color-scheme: dark)');
export const usePrefersLightMode = () => useMediaQuery('(prefers-color-scheme: light)');
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
`;
  }

  protected generateResetStyles() {
    return `/**
 * CSS Reset Styles
 * Additional reset styles beyond what's in globalStyles
 */

import { css } from '@emotion/react';

export const resetStyles = css\`
  /* Box-sizing reset */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  /* Remove default margin and padding */
  body,
  h1, h2, h3, h4, h5, h6,
  p, blockquote, pre,
  dl, dd, ol, ul,
  figure,
  fieldset, legend,
  hr,
  menu,
  dialog {
    margin: 0;
    padding: 0;
  }

  /* Remove list styles */
  ul, ol {
    list-style: none;
  }

  /* Handle box-sizing while removing padding/border */
  input, textarea, select {
    box-sizing: border-box;
  }

  /* Reset table borders */
  table {
    border-collapse: collapse;
    border-spacing: 0;
  }

  /* Reset heading font weights and sizes */
  h1, h2, h3, h4, h5, h6 {
    font-weight: normal;
    font-size: 1em;
  }

  /* Remove text decoration from links */
  a {
    text-decoration: none;
    color: inherit;
  }

  /* Reset button styles */
  button {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  /* Reset form elements */
  input, textarea, select {
    font: inherit;
  }

  /* Remove default button styles in Safari */
  button,
  input[type='button'],
  input[type='reset'],
  input[type='submit'] {
    -webkit-appearance: button;
  }

  /* Remove the inner border and padding in Firefox */
  button::-moz-focus-inner,
  [type='button']::-moz-focus-inner,
  [type='reset']::-moz-focus-inner,
  [type='submit']::-moz-focus-inner {
    border-style: none;
    padding: 0;
  }

  /* Reset focus styles */
  :focus {
    outline: none;
  }

  /* Reset image display */
  img, picture, video, canvas, svg {
    display: block;
    max-width: 100%;
  }

  /* Reset font and text inheritance */
  input, button, textarea, select {
    font: inherit;
  }

  /* Remove animations for users who prefer reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Remove default appearance for form controls */
  input[type='checkbox'],
  input[type='radio'] {
    -webkit-appearance: none;
    appearance: none;
  }

  /* Remove search input styling */
  input[type='search']::-webkit-search-decoration,
  input[type='search']::-webkit-search-cancel-button,
  input[type='search']::-webkit-search-results-button,
  input[type='search']::-webkit-search-results-decoration {
    display: none;
  }
\`;
`;
  }

  protected generateRNView() {
    return `/**
 * View Component (React Native Web)
 * A web-compatible wrapper for React Native's View component
 */

import styled from '@emotion/styled';

interface ViewProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  testID?: string;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

const StyledView = styled.div<ViewProps>\`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;

  &.row {
    flex-direction: row;
  }

  &.center {
    align-items: center;
    justify-content: center;
  }

  &.space-between {
    justify-content: space-between;
  }
\`;

export function View({
  children,
  style,
  className,
  testID,
  onClick,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: ViewProps) {
  return (
    <StyledView
      style={style}
      className={className}
      data-testid={testID}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      {...rest}
    >
      {children}
    </StyledView>
  );
}

export default View;
`;
  }

  protected generateRNText() {
    return `/**
 * Text Component (React Native Web)
 * A web-compatible wrapper for React Native's Text component
 */

import styled from '@emotion/styled';

interface TextProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  testID?: string;
  numberOfLines?: number;
  onPress?: () => void;
  selectable?: boolean;
}

const StyledText = styled.span<TextProps>\`
  display: inline;
  box-sizing: border-box;

  &.block {
    display: block;
  }

  &.h1 {
    font-size: 2rem;
    font-weight: bold;
  }

  &.h2 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  &.h3 {
    font-size: 1.25rem;
    font-weight: 600;
  }

  &.body {
    font-size: 1rem;
    line-height: 1.5;
  }

  &.caption {
    font-size: 0.875rem;
    color: #666;
  }

  &.small {
    font-size: 0.75rem;
  }

  &[onPress] {
    cursor: pointer;
    &:hover {
      opacity: 0.7;
    }
  }

  \${(props) =>
    props.numberOfLines !== undefined &&
    \`
      display: -webkit-box;
      -webkit-line-clamp: \${props.numberOfLines};
      -webkit-box-orient: vertical;
      overflow: hidden;
    \`}
\`;

export function Text({
  children,
  style,
  className,
  testID,
  numberOfLines,
  onPress,
  selectable = true,
  ...rest
}: TextProps) {
  const As = onPress ? 'a' : 'span';

  return (
    <StyledText
      as={As}
      style={style}
      className={className}
      data-testid={testID}
      numberOfLines={numberOfLines}
      onClick={onPress}
      userSelect={selectable ? 'text' : 'none'}
      {...rest}
    >
      {children}
    </StyledText>
  );
}

export default Text;
`;
  }

  protected generateRNImage() {
    return `/**
 * Image Component (React Native Web)
 * A web-compatible wrapper for React Native's Image component
 */

import { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';

interface ImageProps {
  source: { uri: string } | number;
  style?: React.CSSProperties;
  className?: string;
  testID?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onLoad?: () => void;
  onError?: () => void;
}

const StyledImage = styled.img<ImageProps>\`
  display: block;
  max-width: 100%;

  \${(props) => {
    switch (props.resizeMode) {
      case 'cover':
        return 'object-fit: cover;';
      case 'contain':
        return 'object-fit: contain;';
      case 'stretch':
        return 'object-fit: fill;';
      case 'center':
        return 'object-fit: none; object-position: center;';
      default:
        return 'object-fit: cover;';
    }
  }}

  \${(props) => props.width && \`width: \${typeof props.width === 'number' ? props.width + 'px' : props.width};\`}
  \${(props) => props.height && \`height: \${typeof props.height === 'number' ? props.height + 'px' : props.height};\`}
\`;

const ImagePlaceholder = styled.div<{ width?: number | string; height?: number | string }>\`
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  \${(props) => props.width && \`width: \${typeof props.width === 'number' ? props.width + 'px' : props.width};\`}
  \${(props) => props.height && \`height: \${typeof props.height === 'number' ? props.height + 'px' : props.height};\`}
\`;

export function Image({
  source,
  style,
  className,
  testID,
  alt = '',
  width,
  height,
  resizeMode = 'cover',
  onLoad,
  onError,
  ...rest
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const uri = typeof source === 'object' ? source.uri : source;

  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      img.onload = () => {
        setLoaded(true);
        onLoad?.();
      };
      img.onerror = () => {
        setError(true);
        onError?.();
      };
    }
  }, [onLoad, onError]);

  if (error) {
    return (
      <ImagePlaceholder width={width} height={height} className={className} data-testid={testID}>
        <Text style={{ color: '#999', fontSize: '0.875rem' }}>Image not available</Text>
      </ImagePlaceholder>
    );
  }

  return (
    <StyledImage
      ref={imgRef}
      src={typeof uri === 'number' ? undefined : uri}
      style={style}
      className={className}
      data-testid={testID}
      alt={alt}
      width={width}
      height={height}
      resizeMode={resizeMode}
      {...rest}
    />
  );
}

function Text({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={style}>{children}</span>;
}

export default Image;
`;
  }

  protected generateRNScrollView() {
    return `/**
 * ScrollView Component (React Native Web)
 * A web-compatible wrapper for React Native's ScrollView component
 */

import { forwardRef } from 'react';
import styled from '@emotion/styled';

interface ScrollViewProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  testID?: string;
  horizontal?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  showsVerticalScrollIndicator?: boolean;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  contentContainerStyle?: React.CSSProperties;
  refreshControl?: React.ReactNode;
}

const StyledScrollView = styled.div<ScrollViewProps>\`
  overflow: auto;
  \${(props) => (props.horizontal ? 'overflow-x: auto; overflow-y: hidden;' : 'overflow-y: auto; overflow-x: hidden;')}

  &.hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }

  \${(props) =>
    !props.showsHorizontalScrollIndicator &&
    props.horizontal &&
    \`
      &::-webkit-scrollbar {
        display: none;
      }
    \`}
\`;

const ScrollContent = styled.div<{ contentContainerStyle?: React.CSSProperties }>\`
  \${(props) => props.contentContainerStyle}
\`;

export const ScrollView = forwardRef<HTMLDivElement, ScrollViewProps>(
  (
    {
      children,
      style,
      className,
      testID,
      horizontal = false,
      showsHorizontalScrollIndicator = true,
      showsVerticalScrollIndicator = true,
      onScroll,
      contentContainerStyle,
      refreshControl,
      ...rest
    }: ScrollViewProps,
    ref
  ) => {
    return (
      <StyledScrollView
        ref={ref}
        style={style}
        className={className}
        data-testid={testID}
        horizontal={horizontal}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        onScroll={onScroll}
        {...rest}
      >
        {refreshControl}
        <ScrollContent contentContainerStyle={contentContainerStyle}>{children}</ScrollContent>
      </StyledScrollView>
    );
  }
);

ScrollView.displayName = 'ScrollView';

export default ScrollView;
`;
  }

  protected generateRNActivityIndicator() {
    return `/**
 * ActivityIndicator Component (React Native Web)
 * A web-compatible wrapper for React Native's ActivityIndicator component
 */

import styled from '@emotion/styled';
import { useState, useEffect } from 'react';

interface ActivityIndicatorProps {
  size?: 'small' | 'large' | number;
  color?: string;
  animating?: boolean;
  style?: React.CSSProperties;
  className?: string;
  testID?: string;
  hidesWhenStopped?: boolean;
}

const Spinner = styled.div<{ size: number; color: string }>\`
  border: \${(props) => props.size / 8}px solid rgba(0, 0, 0, 0.1);
  border-top: \${(props) => props.size / 8}px solid \${(props) => props.color};
  border-radius: 50%;
  width: \${(props) => props.size}px;
  height: \${(props) => props.size}px;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
\`;

const Container = styled.div<{ show: boolean }>\`
  display: \${(props) => (props.show ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
\`;

const SIZE_MAP = {
  small: 20,
  large: 40,
};

export function ActivityIndicator({
  size = 'small',
  color = '#999',
  animating = true,
  style,
  className,
  testID,
  hidesWhenStopped = true,
}: ActivityIndicatorProps) {
  const [isAnimating, setIsAnimating] = useState(animating);

  useEffect(() => {
    setIsAnimating(animating);
  }, [animating]);

  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size];

  if (hidesWhenStopped && !isAnimating) {
    return null;
  }

  return (
    <Container show={isAnimating} style={style} className={className} data-testid={testID}>
      <Spinner size={pixelSize} color={color} />
    </Container>
  );
}

export default ActivityIndicator;
`;
  }

  protected generateRNStyleSheet() {
    return `/**
 * StyleSheet (React Native Web)
 * A web-compatible utility for creating styles similar to React Native's StyleSheet
 */

export type Style = React.CSSProperties;
export type Styles<T extends string | number> = Record<T, Style>;

export function StyleSheet<T extends string | number>(styles: Styles<T>): Styles<T> {
  return styles;
}

export const absolute = (top?: number, right?: number, bottom?: number, left?: number): Style => ({
  position: 'absolute',
  top,
  right,
  bottom,
  left,
});

export const flex = (
  direction: 'row' | 'column' = 'column',
  justify: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' = 'flex-start',
  alignItems: 'flex-start' | 'center' | 'flex-end' | 'stretch' = 'stretch'
): Style => ({
  display: 'flex',
  flexDirection: direction,
  justifyContent: justify,
  alignItems,
});

export const margin = (all?: number, vertical?: number, horizontal?: number, top?: number, right?: number, bottom?: number, left?: number): Style => ({
  marginTop: top !== undefined ? top : vertical !== undefined ? vertical : all,
  marginRight: right !== undefined ? right : horizontal !== undefined ? horizontal : all,
  marginBottom: bottom !== undefined ? bottom : vertical !== undefined ? vertical : all,
  marginLeft: left !== undefined ? left : horizontal !== undefined ? horizontal : all,
});

export const padding = (all?: number, vertical?: number, horizontal?: number, top?: number, right?: number, bottom?: number, left?: number): Style => ({
  paddingTop: top !== undefined ? top : vertical !== undefined ? vertical : all,
  paddingRight: right !== undefined ? right : horizontal !== undefined ? horizontal : all,
  paddingBottom: bottom !== undefined ? bottom : vertical !== undefined ? vertical : all,
  paddingLeft: left !== undefined ? left : horizontal !== undefined ? horizontal : all,
});

export const typography = (
  size?: number,
  weight?: number | string,
  color?: string,
  align: 'left' | 'center' | 'right' | 'justify' = 'left',
  lineHeight?: number
): Style => ({
  fontSize: size,
  fontWeight: weight,
  color,
  textAlign: align,
  lineHeight: lineHeight ? \`\${lineHeight}px\` : undefined,
});

export const shadow = (
  color = 'rgba(0, 0, 0, 0.25)',
  offset = { width: 0, height: 2 },
  radius = 4,
  opacity = 1
): Style => ({
  boxShadow: \`\${offset.width}px \${offset.height}px \${radius}px \${color}\`,
});

export default {
  create: StyleSheet,
  absolute,
  flex,
  margin,
  padding,
  typography,
  shadow,
};
`;
  }

  protected generateRNPlatform() {
    return `/**
 * Platform (React Native Web)
 * Detects the platform and provides platform-specific utilities
 */

export interface PlatformConfig {
  os: 'web' | 'ios' | 'android';
  select: <T>(specifics: { web?: T; ios?: T; android?: T; default?: T }) => T;
  isTesting: boolean;
}

const platform: PlatformConfig = {
  os: 'web',
  select: <T,>(specifics: { web?: T; ios?: T; android?: T; default?: T }): T => {
    return specifics.web ?? specifics.default ?? (Object.values(specifics).find(Boolean) as T);
  },
  isTesting: typeof process !== 'undefined' && process.env.NODE_ENV === 'test',
};

Object.defineProperty(platform, 'isWeb', {
  get: () => platform.os === 'web',
});

Object.defineProperty(platform, 'isIOS', {
  get: () => platform.os === 'ios',
});

Object.defineProperty(platform, 'isAndroid', {
  get: () => platform.os === 'android',
});

export function getPlatform(): 'web' | 'ios' | 'android' {
  return platform.os;
}

export function isPlatform(os: 'web' | 'ios' | 'android'): boolean {
  return platform.os === os;
}

export function selectPlatform<T>(specifics: { web?: T; ios?: T; android?: T; default?: T }): T {
  return platform.select(specifics);
}

export default platform;
`;
  }

  protected generateRNUseWindowDimensions() {
    return `/**
 * useWindowDimensions Hook (React Native Web)
 * Provides the window dimensions, similar to React Native's useWindowDimensions
 */

import { useState, useEffect } from 'react';

interface WindowDimensions {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}

const initialDimensions: WindowDimensions = {
  width: typeof window !== 'undefined' ? window.innerWidth : 375,
  height: typeof window !== 'undefined' ? window.innerHeight : 667,
  scale: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  fontScale: 1,
};

export function useWindowDimensions(): WindowDimensions {
  const [dimensions, setDimensions] = useState<WindowDimensions>(initialDimensions);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        scale: window.devicePixelRatio,
        fontScale: 1,
      });
    };

    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  return dimensions;
}

export function useBreakpoint() {
  const { width } = useWindowDimensions();

  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    isSmallMobile: width < 375,
    isLargeDesktop: width >= 1280,
  };
}

export function useOrientation() {
  const { width, height } = useWindowDimensions();
  return width > height ? 'landscape' : 'portrait';
}

export default useWindowDimensions;
`;
  }

  protected generateNativeDemoPage() {
    return `/**
 * Native Demo Page
 * Demonstrates React Native Web components for cross-platform development
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { View, Text, Image, ScrollView, ActivityIndicator } from '../components/native';
import { StyleSheet, flex, margin, typography } from '../components/native/StyleSheet';
import { useWindowDimensions, useBreakpoint } from '../components/native/useWindowDimensions';
import { Platform } from '../components/native/Platform';

const styles = StyleSheet.create({
  container: {
    padding: '2rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '2rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
  },
  subtitle: {
    fontSize: '1.125rem',
    color: '#666',
  },
  section: {
    marginBottom: '3rem',
    padding: '1.5rem',
    backgroundColor: '#f9fafb',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '1rem',
  },
  demo: {
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '0.375rem',
    marginBottom: '1rem',
  },
  row: {
    flexDirection: 'row',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  card: {
    flex: '1 1 200px',
    padding: '1rem',
    backgroundColor: '#eff6ff',
    borderRadius: '0.375rem',
    border: '1px solid #bfdbfe',
  },
  button: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#6366f1',
    color: 'white',
    borderRadius: '0.375rem',
    border: 'none',
    fontWeight: '500',
    cursor: 'pointer',
  },
  dimensions: {
    padding: '1rem',
    backgroundColor: '#fef3c7',
    borderRadius: '0.375rem',
    marginTop: '1rem',
  },
});

export default function NativeDemo() {
  const [count, setCount] = useState(0);
  const { width, height } = useWindowDimensions();
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text className="h1" style={styles.title}>
          React Native Web Demo
        </Text>
        <Text className="caption" style={styles.subtitle}>
          Cross-platform components that work on web, iOS, and Android
        </Text>
      </View>

      <View style={styles.section}>
        <Text className="h3" style={styles.sectionTitle}>
          Platform Detection
        </Text>
        <View style={styles.demo}>
          <Text>Current Platform: <strong>{Platform.os}</strong></Text>
          <Text>isWeb: <strong>{String(Platform.isWeb)}</strong></Text>
          <Text>isTesting: <strong>{String(Platform.isTesting)}</strong></Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text className="h3" style={styles.sectionTitle}>
          Window Dimensions
        </Text>
        <View style={styles.dimensions}>
          <Text>Width: <strong>{width}px</strong></Text>
          <Text>Height: <strong>{height}px</strong></Text>
          <Text>Breakpoint: <strong>{isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}</strong></Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text className="h3" style={styles.sectionTitle}>
          View Component
        </Text>
        <View style={styles.row}>
          <View style={styles.card}>
            <Text className="body">Card 1</Text>
          </View>
          <View style={styles.card}>
            <Text className="body">Card 2</Text>
          </View>
          <View style={styles.card}>
            <Text className="body">Card 3</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text className="h3" style={styles.sectionTitle}>
          Text Component
        </Text>
        <View style={styles.demo}>
          <Text className="h1">Heading 1</Text>
          <Text className="h2">Heading 2</Text>
          <Text className="h3">Heading 3</Text>
          <Text className="body">Body text</Text>
          <Text className="caption">Caption text</Text>
          <Text className="small">Small text</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text className="h3" style={styles.sectionTitle}>
          Activity Indicator
        </Text>
        <View style={styles.row} style={{ alignItems: 'center' }}>
          <View style={{ flex: '1', textAlign: 'center' }}>
            <ActivityIndicator size="small" />
            <Text className="caption">Small</Text>
          </View>
          <View style={{ flex: '1', textAlign: 'center' }}>
            <ActivityIndicator size="large" />
            <Text className="caption">Large</Text>
          </View>
          <View style={{ flex: '1', textAlign: 'center' }}>
            <ActivityIndicator size={60} color="#6366f1" />
            <Text className="caption">Custom</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text className="h3" style={styles.sectionTitle}>
          ScrollView (Horizontal)
        </Text>
        <ScrollView horizontal style={{ maxWidth: '100%', overflow: 'hidden' }}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <View
              key={item}
              style={{
                minWidth: '150px',
                height: '100px',
                backgroundColor: \`hsl(\${item * 60}, 70%, 60%)\`,
                margin: '0.5rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Item {item}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text className="h3" style={styles.sectionTitle}>
          Interactive Demo
        </Text>
        <View style={styles.demo} style={{ alignItems: 'center', gap: '1rem' }}>
          <Text className="h2">Count: {count}</Text>
          <View style={styles.row}>
            <button
              className={styles.button}
              onClick={() => setCount((c) => c - 1)}
            >
              Decrement
            </button>
            <button
              className={styles.button}
              onClick={() => setCount((c) => c + 1)}
            >
              Increment
            </button>
          </View>
        </View>
      </View>

      <View style={{ textAlign: 'center', marginTop: '3rem' }}>
        <Link to="/">
          <Text onPress={() => {}} style={{ color: '#6366f1', textDecoration: 'underline' }}>
            ← Back to Home
          </Text>
        </Link>
      </View>
    </View>
  );
}
`;
  }

}

