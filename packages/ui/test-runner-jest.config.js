// Jest config for @storybook/test-runner (`pnpm test-storybook`).
//
// Chromium comes from Playwright's own download by default; point
// PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH at an existing Chromium to use that instead
// (offline CI images, sandboxes). The viewport is fixed so screenshots are stable.
import { getJestConfig } from '@storybook/test-runner';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const base = getJestConfig();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const require = createRequire(import.meta.url);

export default {
  ...base,
  // Storybook 10 registers a process-wide TS loader even inside Jest 30.5,
  // which rejects loader hooks. Let Jest's existing transform load the config.
  // https://github.com/storybookjs/storybook/issues/36116
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^storybook/internal/common$': fileURLToPath(new URL('./.storybook/test-runner.common.mjs', import.meta.url)),
    '^#storybook-common-original$': require.resolve('storybook/internal/common')
  },
  testEnvironmentOptions: {
    'jest-playwright': {
      ...base.testEnvironmentOptions?.['jest-playwright'],
      browsers: ['chromium'],
      launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : {},
      contextOptions: {
        viewport: { width: 960, height: 640 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce'
      }
    }
  }
};
