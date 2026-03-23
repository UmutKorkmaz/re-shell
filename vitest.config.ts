import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**']
    },
    testTimeout: 120000, // 120 seconds timeout for tests (integration tests need time)
    hookTimeout: 120000, // 120 seconds timeout for hooks (beforeEach/afterEach)
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
