import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@tanstack/react-query',
  '@re-shell/contracts',
  '@radix-ui/react-dialog',
  '@radix-ui/react-label',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-tabs',
  '@radix-ui/react-tooltip',
  'class-variance-authority',
  'clsx',
  'lucide-react',
  'tailwind-merge'
];

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Keep the hub-connection `import.meta.env.VITE_*` references LITERAL in the
  // library bundle. Vite would otherwise inline them to `undefined` at lib-build
  // time (no app env is present here), permanently baking out the token/URL. By
  // mapping each key to itself, the references survive into dist and are resolved
  // by the CONSUMING app's Vite build (apps/web), where the real values exist.
  define: {
    'import.meta.env.VITE_RE_SHELL_UI_HUB_TOKEN':
      'import.meta.env.VITE_RE_SHELL_UI_HUB_TOKEN',
    'import.meta.env.VITE_RE_SHELL_UI_HUB_URL':
      'import.meta.env.VITE_RE_SHELL_UI_HUB_URL',
    'import.meta.env.VITE_RE_SHELL_UI_HOST': 'import.meta.env.VITE_RE_SHELL_UI_HOST',
    'import.meta.env.VITE_RE_SHELL_UI_PORT': 'import.meta.env.VITE_RE_SHELL_UI_PORT'
  },
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.test-d.ts',
        'src/**/*.test-d.tsx',
        'src/**/*.stories.tsx',
        'src/test/**'
      ],
      insertTypesEntry: true,
      tsconfigPath: resolve(packageRoot, 'tsconfig.json')
    })
  ],
  resolve: {
    alias: {
      '@': resolve(packageRoot, 'src')
    },
    dedupe: ['react', 'react-dom']
  },
  build: {
    sourcemap: true,
    emptyOutDir: true,
    // Per-module output (see rollupOptions.output) keeps every component in its
    // own file so bundlers can tree-shake, and `@re-shell/ui/components/ui/<name>`
    // style deep imports resolve to real files. Stylesheets are NOT part of the JS
    // graph: `pnpm build:css` compiles globals.css with Tailwind into dist/index.css
    // and copies fonts.css, so nothing is inlined into JS.
    lib: {
      // Every barrel is an explicit entry: rollup would otherwise drop pure
      // re-export modules from a preserveModules build, and the sub-path exports
      // in package.json (`./components/ui`, `./hooks`, ...) point at them.
      entry: {
        index: resolve(packageRoot, 'src/index.ts'),
        'components/ui/index': resolve(packageRoot, 'src/components/ui/index.ts'),
        'components/primitives/index': resolve(packageRoot, 'src/components/primitives/index.ts'),
        'components/re-shell/index': resolve(packageRoot, 'src/components/re-shell/index.ts'),
        'contracts/index': resolve(packageRoot, 'src/contracts/index.ts'),
        'hooks/index': resolve(packageRoot, 'src/hooks/index.ts'),
        'lib/index': resolve(packageRoot, 'src/lib/index.ts')
      },
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [...external, /^@radix-ui\//, /^@fontsource\//],
      output: [
        {
          format: 'es',
          dir: 'dist',
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].js',
          exports: 'named'
        },
        {
          format: 'cjs',
          dir: 'dist/cjs',
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].cjs',
          exports: 'named'
        }
      ]
    }
  }
});
