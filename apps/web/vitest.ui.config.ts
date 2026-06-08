import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Component/screen render tests run in jsdom with the React plugin. The UI and
// contracts packages resolve to their built dist via the workspace symlinks
// (same as the dev/build path), so tests exercise the published surface.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
