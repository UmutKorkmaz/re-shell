// Jest config for @storybook/test-runner (`pnpm test-storybook`).
//
// Chromium comes from Playwright's own download by default; point
// PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH at an existing Chromium to use that instead
// (offline CI images, sandboxes). The viewport is fixed so screenshots are stable.
import { getJestConfig } from '@storybook/test-runner';

const base = getJestConfig();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default {
  ...base,
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
