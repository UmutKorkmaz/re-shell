import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

// PostCSS (Tailwind + autoprefixer) is picked up from ../postcss.config.cjs, which
// runs the same Tailwind config the library stylesheet is built with.
export default defineConfig({
  root: resolve(here, '..'),
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(here, '../src') },
    dedupe: ['react', 'react-dom']
  }
});
