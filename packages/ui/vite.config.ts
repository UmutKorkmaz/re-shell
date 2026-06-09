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
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**'],
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
    cssCodeSplit: true,
    lib: {
      entry: resolve(packageRoot, 'src/index.ts'),
      name: 'ReShellUI',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs')
    },
    rollupOptions: {
      external
    }
  }
});
