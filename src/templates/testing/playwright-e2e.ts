import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class PlaywrightE2ETemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Playwright configuration
    files.push({
      path: 'playwright.config.ts',
      content: this.generatePlaywrightConfig()
    });

    // Test fixtures and utilities
    files.push({
      path: 'tests/fixtures/base.ts',
      content: this.generateBaseFixtures()
    });

    files.push({
      path: 'tests/fixtures/auth.ts',
      content: this.generateAuthFixtures()
    });

    // Page objects
    files.push({
      path: 'tests/pages/BasePage.ts',
      content: this.generateBasePage()
    });

    files.push({
      path: 'tests/pages/HomePage.ts',
      content: this.generateHomePage()
    });

    files.push({
      path: 'tests/pages/LoginPage.ts',
      content: this.generateLoginPage()
    });

    // E2E tests
    files.push({
      path: 'tests/e2e/home.spec.ts',
      content: this.generateHomeSpec()
    });

    files.push({
      path: 'tests/e2e/navigation.spec.ts',
      content: this.generateNavigationSpec()
    });

    files.push({
      path: 'tests/e2e/auth.spec.ts',
      content: this.generateAuthSpec()
    });

    files.push({
      path: 'tests/e2e/api.spec.ts',
      content: this.generateApiSpec()
    });

    files.push({
      path: 'tests/e2e/visual.spec.ts',
      content: this.generateVisualSpec()
    });

    files.push({
      path: 'tests/e2e/accessibility.spec.ts',
      content: this.generateAccessibilitySpec()
    });

    // Test utilities
    files.push({
      path: 'tests/utils/helpers.ts',
      content: this.generateHelpers()
    });

    files.push({
      path: 'tests/utils/api-helpers.ts',
      content: this.generateApiHelpers()
    });

    // Test data
    files.push({
      path: 'tests/data/users.ts',
      content: this.generateUsersData()
    });

    // Global setup and teardown
    files.push({
      path: 'tests/global-setup.ts',
      content: this.generateGlobalSetup()
    });

    files.push({
      path: 'tests/global-teardown.ts',
      content: this.generateGlobalTeardown()
    });

    // GitHub Actions workflow
    files.push({
      path: '.github/workflows/playwright.yml',
      content: this.generateGitHubWorkflow()
    });

    // Package scripts
    files.push({
      path: 'playwright-package-scripts.json',
      content: this.generatePackageScripts()
    });

    // README
    files.push({
      path: 'tests/README.md',
      content: this.generateReadme()
    });

    return files;
  }

  protected generatePlaywrightConfig(): string {
    return `import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like \`await page.goto('/')\`. */
    baseURL: process.env.BASE_URL || 'http://localhost:${this.context.port}',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording */
    video: 'on-first-retry',

    /* Maximum time each action can take */
    actionTimeout: 10000,

    /* Navigation timeout */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /global-setup\\.ts/,
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testMatch: /global-teardown\\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
      dependencies: ['setup'],
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:${this.context.port}',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  /* Global setup */
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),

  /* Expect configuration */
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 5000,

    toHaveScreenshot: {
      /* An acceptable amount of pixels that could be different */
      maxDiffPixels: 100,
    },

    toMatchSnapshot: {
      /* An acceptable ratio of pixels that are different */
      maxDiffPixelRatio: 0.1,
    },
  },
});
`;
  }

  protected generateBaseFixtures(): string {
    return `import { test as base, expect, Page, BrowserContext } from '@playwright/test';

// Define custom fixtures
export interface TestFixtures {
  // Add custom fixtures here
  testId: string;
  apiUrl: string;
}

export interface WorkerFixtures {
  // Add worker-scoped fixtures here
  workerStorageState: string;
}

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Generate unique test ID for each test
  testId: async ({}, use) => {
    const id = \`test-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
    await use(id);
  },

  // API URL fixture
  apiUrl: async ({ baseURL }, use) => {
    const url = \`\${baseURL}/api\`;
    await use(url);
  },

  // Custom page fixture with common setup
  page: async ({ page }, use) => {
    // Add common page setup
    await page.setViewportSize({ width: 1280, height: 720 });

    // Add console error listener
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(\`Browser console error: \${msg.text()}\`);
      }
    });

    // Add request failure listener
    page.on('requestfailed', (request) => {
      console.log(\`Request failed: \${request.url()}\`);
    });

    await use(page);
  },
});

export { expect };

// Re-export commonly used types
export type { Page, BrowserContext };

// Custom expect matchers
expect.extend({
  async toHaveNoConsoleErrors(page: Page) {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for any errors to appear
    await page.waitForTimeout(100);

    if (errors.length > 0) {
      return {
        message: () => \`Expected no console errors but found: \${errors.join(', ')}\`,
        pass: false,
      };
    }

    return {
      message: () => 'No console errors found',
      pass: true,
    };
  },
});
`;
  }

  protected generateAuthFixtures(): string {
    return `import { test as base, expect } from '@playwright/test';
import { users } from '../data/users';

// Auth-specific test fixtures
export interface AuthFixtures {
  authenticatedPage: any;
  adminPage: any;
}

export const test = base.extend<AuthFixtures>({
  // Page with regular user authentication
  authenticatedPage: async ({ browser }, use) => {
    // Create a new context with saved storage state
    const context = await browser.newContext({
      storageState: 'tests/.auth/user.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  // Page with admin authentication
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: 'tests/.auth/admin.json',
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };

// Helper to setup authentication storage state
export async function setupAuthState(page: any, user: typeof users.validUser, storageStatePath: string) {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(user.email);
  await page.getByTestId('password-input').fill(user.password);
  await page.getByTestId('login-button').click();

  // Wait for successful login
  await page.waitForURL('**/dashboard');

  // Save storage state
  await page.context().storageState({ path: storageStatePath });
}
`;
  }

  protected generateBasePage(): string {
    return `import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object with common functionality
 */
export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Navigation
  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  // Common elements
  get header(): Locator {
    return this.page.locator('header');
  }

  get footer(): Locator {
    return this.page.locator('footer');
  }

  get mainContent(): Locator {
    return this.page.locator('main');
  }

  // Element helpers
  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  getByRole(role: string, options?: { name?: string | RegExp }): Locator {
    return this.page.getByRole(role as any, options);
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.page.getByText(text, options);
  }

  // Actions
  async clickButton(name: string) {
    await this.page.getByRole('button', { name }).click();
  }

  async fillInput(testId: string, value: string) {
    await this.getByTestId(testId).fill(value);
  }

  async selectOption(testId: string, value: string) {
    await this.getByTestId(testId).selectOption(value);
  }

  // Assertions
  async expectToBeVisible(locator: Locator) {
    await expect(locator).toBeVisible();
  }

  async expectToHaveText(locator: Locator, text: string | RegExp) {
    await expect(locator).toHaveText(text);
  }

  async expectToHaveURL(url: string | RegExp) {
    await expect(this.page).toHaveURL(url);
  }

  async expectToHaveTitle(title: string | RegExp) {
    await expect(this.page).toHaveTitle(title);
  }

  // Screenshot
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: \`screenshots/\${name}.png\`, fullPage: true });
  }

  // Wait helpers
  async waitForSelector(selector: string) {
    await this.page.waitForSelector(selector);
  }

  async waitForResponse(urlPattern: string | RegExp) {
    return await this.page.waitForResponse(urlPattern);
  }

  // Error handling
  async dismissAlert() {
    this.page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });
  }

  async acceptAlert() {
    this.page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
  }
}
`;
  }

  protected generateHomePage(): string {
    return `import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Home Page Object
 */
export class HomePage extends BasePage {
  // Page URL
  readonly url = '/';

  // Page elements
  get heroSection(): Locator {
    return this.page.locator('[data-testid="hero-section"]');
  }

  get heroTitle(): Locator {
    return this.page.locator('[data-testid="hero-title"]');
  }

  get heroSubtitle(): Locator {
    return this.page.locator('[data-testid="hero-subtitle"]');
  }

  get ctaButton(): Locator {
    return this.page.locator('[data-testid="cta-button"]');
  }

  get featuresSection(): Locator {
    return this.page.locator('[data-testid="features-section"]');
  }

  get featureCards(): Locator {
    return this.page.locator('[data-testid="feature-card"]');
  }

  get testimonialSection(): Locator {
    return this.page.locator('[data-testid="testimonial-section"]');
  }

  get newsletterForm(): Locator {
    return this.page.locator('[data-testid="newsletter-form"]');
  }

  get emailInput(): Locator {
    return this.page.locator('[data-testid="newsletter-email"]');
  }

  get subscribeButton(): Locator {
    return this.page.locator('[data-testid="subscribe-button"]');
  }

  constructor(page: Page) {
    super(page);
  }

  // Actions
  async navigate() {
    await this.goto(this.url);
  }

  async clickCTA() {
    await this.ctaButton.click();
  }

  async subscribeToNewsletter(email: string) {
    await this.emailInput.fill(email);
    await this.subscribeButton.click();
  }

  async getFeatureCount(): Promise<number> {
    return await this.featureCards.count();
  }

  // Assertions
  async expectHeroToBeVisible() {
    await this.expectToBeVisible(this.heroSection);
    await this.expectToBeVisible(this.heroTitle);
  }

  async expectFeaturesToBeLoaded(minCount: number = 1) {
    const count = await this.getFeatureCount();
    expect(count).toBeGreaterThanOrEqual(minCount);
  }
}
`;
  }

  protected generateLoginPage(): string {
    return `import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Login Page Object
 */
export class LoginPage extends BasePage {
  readonly url = '/login';

  // Form elements
  get loginForm(): Locator {
    return this.page.locator('[data-testid="login-form"]');
  }

  get emailInput(): Locator {
    return this.page.locator('[data-testid="email-input"]');
  }

  get passwordInput(): Locator {
    return this.page.locator('[data-testid="password-input"]');
  }

  get loginButton(): Locator {
    return this.page.locator('[data-testid="login-button"]');
  }

  get rememberMeCheckbox(): Locator {
    return this.page.locator('[data-testid="remember-me"]');
  }

  get forgotPasswordLink(): Locator {
    return this.page.locator('[data-testid="forgot-password-link"]');
  }

  get signupLink(): Locator {
    return this.page.locator('[data-testid="signup-link"]');
  }

  // Error messages
  get errorMessage(): Locator {
    return this.page.locator('[data-testid="error-message"]');
  }

  get emailError(): Locator {
    return this.page.locator('[data-testid="email-error"]');
  }

  get passwordError(): Locator {
    return this.page.locator('[data-testid="password-error"]');
  }

  constructor(page: Page) {
    super(page);
  }

  // Actions
  async navigate() {
    await this.goto(this.url);
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async loginWithRememberMe(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.rememberMeCheckbox.check();
    await this.loginButton.click();
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  async clickSignup() {
    await this.signupLink.click();
  }

  // Assertions
  async expectLoginFormToBeVisible() {
    await this.expectToBeVisible(this.loginForm);
    await this.expectToBeVisible(this.emailInput);
    await this.expectToBeVisible(this.passwordInput);
    await this.expectToBeVisible(this.loginButton);
  }

  async expectErrorMessage(message: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toHaveText(message);
  }

  async expectEmailError(message: string | RegExp) {
    await expect(this.emailError).toBeVisible();
    await expect(this.emailError).toHaveText(message);
  }

  async expectPasswordError(message: string | RegExp) {
    await expect(this.passwordError).toBeVisible();
    await expect(this.passwordError).toHaveText(message);
  }

  async expectSuccessfulLogin() {
    await this.page.waitForURL('**/dashboard');
    await expect(this.page).not.toHaveURL(/login/);
  }
}
`;
  }

  protected generateHomeSpec(): string {
    return `import { test, expect } from '../fixtures/base';
import { HomePage } from '../pages/HomePage';

test.describe('Home Page', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.navigate();
  });

  test('should display the home page', async ({ page }) => {
    await expect(page).toHaveURL('/');
  });

  test('should have the correct page title', async ({ page }) => {
    await expect(page).toHaveTitle(/${this.context.name}/);
  });

  test('should display the hero section', async () => {
    await homePage.expectHeroToBeVisible();
  });

  test('should display the header', async () => {
    await expect(homePage.header).toBeVisible();
  });

  test('should display the footer', async () => {
    await expect(homePage.footer).toBeVisible();
  });

  test('should display the main content', async () => {
    await expect(homePage.mainContent).toBeVisible();
  });

  test.describe('CTA Button', () => {
    test('should be visible', async () => {
      await expect(homePage.ctaButton).toBeVisible();
    });

    test('should navigate to the correct page when clicked', async ({ page }) => {
      await homePage.clickCTA();
      await expect(page).not.toHaveURL('/');
    });
  });

  test.describe('Features Section', () => {
    test('should display features', async () => {
      await homePage.expectFeaturesToBeLoaded(3);
    });
  });

  test.describe('Newsletter Subscription', () => {
    test('should allow subscribing with valid email', async () => {
      await homePage.subscribeToNewsletter('test@example.com');
      await expect(homePage.page.getByText(/thank you|subscribed/i)).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(homePage.header).toBeVisible();
      await expect(homePage.mainContent).toBeVisible();
    });

    test('should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(homePage.header).toBeVisible();
      await expect(homePage.mainContent).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000); // 3 seconds
    });
  });
});
`;
  }

  protected generateNavigationSpec(): string {
    return `import { test, expect } from '../fixtures/base';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate between pages', async ({ page }) => {
    // Click first navigation link
    const navLinks = page.locator('nav a');
    const firstLink = navLinks.first();
    const href = await firstLink.getAttribute('href');

    await firstLink.click();

    if (href) {
      await expect(page).toHaveURL(new RegExp(href.replace(/\\//g, '\\\\/')));
    }

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/');
  });

  test('should highlight active navigation item', async ({ page }) => {
    const navLinks = page.locator('nav a');
    const firstLink = navLinks.first();

    await firstLink.click();
    await page.waitForLoadState('networkidle');

    // Check if the link has active class
    await expect(firstLink).toHaveClass(/active|current/);
  });

  test('should support keyboard navigation', async ({ page }) => {
    const navLinks = page.locator('nav a');
    const firstLink = navLinks.first();

    await firstLink.focus();
    await expect(firstLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).not.toHaveURL('/');
  });

  test.describe('Mobile Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should show mobile menu button', async ({ page }) => {
      await expect(page.getByTestId('mobile-menu-button')).toBeVisible();
    });

    test('should open mobile menu on click', async ({ page }) => {
      await page.getByTestId('mobile-menu-button').click();
      await expect(page.getByTestId('mobile-menu')).toBeVisible();
    });

    test('should close mobile menu when link is clicked', async ({ page }) => {
      await page.getByTestId('mobile-menu-button').click();
      await page.getByTestId('mobile-menu').locator('a').first().click();

      await expect(page.getByTestId('mobile-menu')).not.toBeVisible();
    });

    test('should close mobile menu on outside click', async ({ page }) => {
      await page.getByTestId('mobile-menu-button').click();
      await expect(page.getByTestId('mobile-menu')).toBeVisible();

      // Click outside the menu
      await page.locator('body').click({ position: { x: 10, y: 10 } });

      await expect(page.getByTestId('mobile-menu')).not.toBeVisible();
    });
  });

  test.describe('Browser History', () => {
    test('should support back navigation', async ({ page }) => {
      const navLinks = page.locator('nav a');
      await navLinks.first().click();

      await page.goBack();
      await expect(page).toHaveURL('/');
    });

    test('should support forward navigation', async ({ page }) => {
      const navLinks = page.locator('nav a');
      await navLinks.first().click();

      await page.goBack();
      await page.goForward();

      await expect(page).not.toHaveURL('/');
    });
  });
});
`;
  }

  protected generateAuthSpec(): string {
    return `import { test, expect } from '../fixtures/base';
import { LoginPage } from '../pages/LoginPage';
import { users } from '../data/users';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test.describe('Login Form', () => {
    test('should display login form', async () => {
      await loginPage.expectLoginFormToBeVisible();
    });

    test('should login with valid credentials', async () => {
      await loginPage.login(users.validUser.email, users.validUser.password);
      await loginPage.expectSuccessfulLogin();
    });

    test('should show error with invalid credentials', async () => {
      await loginPage.login('invalid@example.com', 'wrongpassword');
      await loginPage.expectErrorMessage(/invalid|incorrect/i);
    });

    test('should validate email format', async () => {
      await loginPage.emailInput.fill('invalid-email');
      await loginPage.passwordInput.fill('password123');
      await loginPage.loginButton.click();

      await loginPage.expectEmailError(/valid email/i);
    });

    test('should require password', async () => {
      await loginPage.emailInput.fill('test@example.com');
      await loginPage.loginButton.click();

      await loginPage.expectPasswordError(/required/i);
    });

    test('should remember user when checkbox is checked', async ({ page }) => {
      await loginPage.loginWithRememberMe(users.validUser.email, users.validUser.password);
      await loginPage.expectSuccessfulLogin();

      // Check for remember me cookie/storage
      const cookies = await page.context().cookies();
      const rememberCookie = cookies.find(c => c.name.includes('remember'));
      expect(rememberCookie).toBeDefined();
    });
  });

  test.describe('Password Recovery', () => {
    test('should navigate to forgot password page', async ({ page }) => {
      await loginPage.clickForgotPassword();
      await expect(page).toHaveURL(/forgot|reset|password/);
    });
  });

  test.describe('Signup Link', () => {
    test('should navigate to signup page', async ({ page }) => {
      await loginPage.clickSignup();
      await expect(page).toHaveURL(/signup|register/);
    });
  });
});

test.describe('Logout', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(users.validUser.email, users.validUser.password);
    await loginPage.expectSuccessfulLogin();
  });

  test('should logout successfully', async ({ page }) => {
    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout-button').click();

    await expect(page).toHaveURL(/login/);
  });

  test('should clear session data on logout', async ({ page }) => {
    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout-button').click();

    // Check that session is cleared
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session');
    expect(sessionCookie).toBeUndefined();
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('should access protected route when authenticated', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(users.validUser.email, users.validUser.password);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });
});
`;
  }

  protected generateApiSpec(): string {
    return `import { test, expect } from '../fixtures/base';
import { users } from '../data/users';

test.describe('API Tests', () => {
  let apiUrl: string;

  test.beforeAll(async ({ baseURL }) => {
    apiUrl = \`\${baseURL}/api\`;
  });

  test.describe('Health Check', () => {
    test('should return healthy status', async ({ request }) => {
      const response = await request.get(\`\${apiUrl}/health\`);

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('status', 'healthy');
    });
  });

  test.describe('CRUD Operations', () => {
    let itemId: string;

    test('should create a new item', async ({ request }) => {
      const response = await request.post(\`\${apiUrl}/items\`, {
        data: {
          name: 'Test Item',
          value: 100,
        },
      });

      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body).toHaveProperty('id');
      itemId = body.id;
    });

    test('should read an item', async ({ request }) => {
      test.skip(!itemId, 'No item ID from previous test');

      const response = await request.get(\`\${apiUrl}/items/\${itemId}\`);

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('name', 'Test Item');
    });

    test('should update an item', async ({ request }) => {
      test.skip(!itemId, 'No item ID from previous test');

      const response = await request.put(\`\${apiUrl}/items/\${itemId}\`, {
        data: {
          name: 'Updated Item',
          value: 200,
        },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body).toHaveProperty('name', 'Updated Item');
    });

    test('should delete an item', async ({ request }) => {
      test.skip(!itemId, 'No item ID from previous test');

      const response = await request.delete(\`\${apiUrl}/items/\${itemId}\`);
      expect(response.status()).toBe(204);

      // Verify deletion
      const getResponse = await request.get(\`\${apiUrl}/items/\${itemId}\`);
      expect(getResponse.status()).toBe(404);
    });
  });

  test.describe('Authentication', () => {
    test('should return 401 for protected endpoints without auth', async ({ request }) => {
      const response = await request.get(\`\${apiUrl}/protected\`);
      expect(response.status()).toBe(401);
    });

    test('should access protected endpoint with valid token', async ({ request }) => {
      // Get token first
      const loginResponse = await request.post(\`\${apiUrl}/auth/login\`, {
        data: {
          email: users.validUser.email,
          password: users.validUser.password,
        },
      });

      const { token } = await loginResponse.json();

      // Use token for protected request
      const response = await request.get(\`\${apiUrl}/protected\`, {
        headers: {
          Authorization: \`Bearer \${token}\`,
        },
      });

      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test('should return 400 for invalid request body', async ({ request }) => {
      const response = await request.post(\`\${apiUrl}/items\`, {
        data: {},
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    test('should return 404 for non-existent resource', async ({ request }) => {
      const response = await request.get(\`\${apiUrl}/items/non-existent-id\`);
      expect(response.status()).toBe(404);
    });
  });
});
`;
  }

  protected generateVisualSpec(): string {
    return `import { test, expect } from '../fixtures/base';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: \`
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
        }
      \`,
    });
  });

  test('home page should match snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
      maxDiffPixels: 100,
    });
  });

  test('login page should match snapshot', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 50,
    });
  });

  test.describe('Responsive Screenshots', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 },
    ];

    for (const viewport of viewports) {
      test(\`home page on \${viewport.name}\`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot(\`home-\${viewport.name}.png\`, {
          fullPage: true,
        });
      });
    }
  });

  test.describe('Component Screenshots', () => {
    test('header component', async ({ page }) => {
      await page.goto('/');
      const header = page.locator('header');

      await expect(header).toHaveScreenshot('header.png');
    });

    test('footer component', async ({ page }) => {
      await page.goto('/');
      const footer = page.locator('footer');

      await expect(footer).toHaveScreenshot('footer.png');
    });
  });

  test.describe('Interactive States', () => {
    test('button hover state', async ({ page }) => {
      await page.goto('/');
      const button = page.getByRole('button').first();

      await button.hover();
      await expect(button).toHaveScreenshot('button-hover.png');
    });

    test('input focus state', async ({ page }) => {
      await page.goto('/login');
      const input = page.getByTestId('email-input');

      await input.focus();
      await expect(input).toHaveScreenshot('input-focus.png');
    });
  });
});
`;
  }

  protected generateAccessibilitySpec(): string {
    return `import { test, expect } from '../fixtures/base';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('home page should have no accessibility violations', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('login page should have no accessibility violations', async ({ page }) => {
    await page.goto('/login');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test.describe('WCAG Compliance', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1); // Should have exactly one h1

      // Check heading order
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should have alt text on images', async ({ page }) => {
      await page.goto('/');

      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        expect(alt).not.toBeNull();
        expect(alt).not.toBe('');
      }
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/login');

      const inputs = page.locator('input[type="text"], input[type="email"], input[type="password"]');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');

        // Should have either a label, aria-label, or aria-labelledby
        if (id) {
          const label = page.locator(\`label[for="\${id}"]\`);
          const hasLabel = await label.count() > 0;
          expect(hasLabel || ariaLabel || ariaLabelledby).toBeTruthy();
        }
      }
    });

    test('should have sufficient color contrast', async ({ page }) => {
      await page.goto('/');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ rules: { 'color-contrast': { enabled: true } } })
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/');

      // Tab through the page
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(firstFocused).toBeDefined();

      // Continue tabbing
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement?.tagName);
        expect(focused).toBeDefined();
      }
    });

    test('should have skip link for main content', async ({ page }) => {
      await page.goto('/');

      // Look for skip link
      const skipLink = page.locator('a[href="#main"], a[href="#content"]');
      const skipLinkExists = await skipLink.count() > 0;

      if (skipLinkExists) {
        await page.keyboard.press('Tab');
        await expect(skipLink).toBeFocused();
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have ARIA landmarks', async ({ page }) => {
      await page.goto('/');

      const header = page.locator('header, [role="banner"]');
      const main = page.locator('main, [role="main"]');
      const footer = page.locator('footer, [role="contentinfo"]');

      expect(await header.count()).toBeGreaterThan(0);
      expect(await main.count()).toBeGreaterThan(0);
      expect(await footer.count()).toBeGreaterThan(0);
    });

    test('should have descriptive link text', async ({ page }) => {
      await page.goto('/');

      const links = page.locator('a');
      const count = await links.count();

      const genericTexts = ['click here', 'read more', 'learn more', 'here'];

      for (let i = 0; i < count; i++) {
        const text = await links.nth(i).textContent();
        const ariaLabel = await links.nth(i).getAttribute('aria-label');

        const linkText = (text || ariaLabel || '').toLowerCase().trim();

        // Skip empty links (might be icon links with aria-label)
        if (linkText) {
          const isGeneric = genericTexts.some((g) => linkText === g);
          expect(isGeneric).toBeFalsy();
        }
      }
    });
  });
});
`;
  }

  protected generateHelpers(): string {
    return `import { Page, BrowserContext } from '@playwright/test';

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Clear all browser data
 */
export async function clearBrowserData(context: BrowserContext) {
  await context.clearCookies();
  const pages = context.pages();
  for (const page of pages) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: \`screenshots/\${name}-\${timestamp}.png\`,
    fullPage: true,
  });
}

/**
 * Retry action with exponential backoff
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      const delay = initialDelay * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Generate random test data
 */
export function generateTestData() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return {
    email: \`test-\${timestamp}@example.com\`,
    password: \`Pass\${timestamp}!\`,
    name: \`Test User \${random}\`,
    id: \`\${timestamp}-\${random}\`,
  };
}

/**
 * Mock date/time for consistent tests
 */
export async function mockDateTime(page: Page, date: Date) {
  await page.addInitScript((dateString: string) => {
    const mockDate = new Date(dateString);
    const OriginalDate = Date;

    // @ts-ignore
    window.Date = class extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          return new OriginalDate(mockDate);
        }
        // @ts-ignore
        return new OriginalDate(...args);
      }

      static now() {
        return mockDate.getTime();
      }
    };
  }, date.toISOString());
}

/**
 * Disable animations for consistent visual tests
 */
export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: \`
      *, *::before, *::after {
        transition-duration: 0ms !important;
        transition-delay: 0ms !important;
        animation-duration: 0ms !important;
        animation-delay: 0ms !important;
      }
    \`,
  });
}

/**
 * Wait for specific API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options: { method?: string; status?: number } = {}
) {
  return page.waitForResponse((response) => {
    const urlMatch =
      typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url());

    const methodMatch = options.method
      ? response.request().method() === options.method
      : true;

    const statusMatch = options.status
      ? response.status() === options.status
      : true;

    return urlMatch && methodMatch && statusMatch;
  });
}
`;
  }

  protected generateApiHelpers(): string {
    return `import { APIRequestContext } from '@playwright/test';

/**
 * API Client for test helpers
 */
export class ApiClient {
  private request: APIRequestContext;
  private baseUrl: string;
  private token?: string;

  constructor(request: APIRequestContext, baseUrl: string) {
    this.request = request;
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = \`Bearer \${this.token}\`;
    }
    return headers;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await this.request.get(\`\${this.baseUrl}\${endpoint}\`, {
      headers: this.getHeaders(),
    });
    return response.json();
  }

  async post<T>(endpoint: string, data: object): Promise<T> {
    const response = await this.request.post(\`\${this.baseUrl}\${endpoint}\`, {
      headers: this.getHeaders(),
      data,
    });
    return response.json();
  }

  async put<T>(endpoint: string, data: object): Promise<T> {
    const response = await this.request.put(\`\${this.baseUrl}\${endpoint}\`, {
      headers: this.getHeaders(),
      data,
    });
    return response.json();
  }

  async delete(endpoint: string): Promise<void> {
    await this.request.delete(\`\${this.baseUrl}\${endpoint}\`, {
      headers: this.getHeaders(),
    });
  }

  // Auth helpers
  async login(email: string, password: string): Promise<{ token: string }> {
    const result = await this.post<{ token: string }>('/auth/login', {
      email,
      password,
    });
    this.token = result.token;
    return result;
  }

  async logout(): Promise<void> {
    await this.post('/auth/logout', {});
    this.token = undefined;
  }

  // User helpers
  async createUser(data: { email: string; password: string; name: string }) {
    return this.post('/users', data);
  }

  async deleteUser(id: string) {
    return this.delete(\`/users/\${id}\`);
  }

  // Generic CRUD helpers
  async createItem<T>(endpoint: string, data: object): Promise<T> {
    return this.post<T>(endpoint, data);
  }

  async getItem<T>(endpoint: string, id: string): Promise<T> {
    return this.get<T>(\`\${endpoint}/\${id}\`);
  }

  async updateItem<T>(endpoint: string, id: string, data: object): Promise<T> {
    return this.put<T>(\`\${endpoint}/\${id}\`, data);
  }

  async deleteItem(endpoint: string, id: string): Promise<void> {
    return this.delete(\`\${endpoint}/\${id}\`);
  }
}
`;
  }

  protected generateUsersData(): string {
    return `/**
 * Test user data
 */
export const users = {
  validUser: {
    email: 'test@example.com',
    password: 'Password123!',
    name: 'Test User',
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'Admin123!',
    name: 'Admin User',
    role: 'admin',
  },
  newUser: {
    email: 'new@example.com',
    password: 'NewUser123!',
    name: 'New User',
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrong',
    name: 'Invalid User',
  },
};

/**
 * Generate unique user for test isolation
 */
export function generateUniqueUser() {
  const timestamp = Date.now();
  return {
    email: \`test-\${timestamp}@example.com\`,
    password: \`Pass\${timestamp}!\`,
    name: \`Test User \${timestamp}\`,
  };
}
`;
  }

  protected generateGlobalSetup(): string {
    return `import { chromium, FullConfig } from '@playwright/test';
import { users } from './data/users';

async function globalSetup(config: FullConfig) {
  console.log('Running global setup...');

  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Setup regular user auth state
    await page.goto(\`\${baseURL}/login\`);
    await page.getByTestId('email-input').fill(users.validUser.email);
    await page.getByTestId('password-input').fill(users.validUser.password);
    await page.getByTestId('login-button').click();
    await page.waitForURL('**/dashboard');
    await context.storageState({ path: 'tests/.auth/user.json' });

    // Setup admin auth state
    await page.goto(\`\${baseURL}/login\`);
    await page.getByTestId('email-input').fill(users.adminUser.email);
    await page.getByTestId('password-input').fill(users.adminUser.password);
    await page.getByTestId('login-button').click();
    await page.waitForURL('**/dashboard');
    await context.storageState({ path: 'tests/.auth/admin.json' });

    console.log('Auth states saved successfully');
  } catch (error) {
    console.error('Failed to setup auth states:', error);
    // Don't throw - allow tests to run anyway
  }

  await browser.close();
}

export default globalSetup;
`;
  }

  protected generateGlobalTeardown(): string {
    return `import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('Running global teardown...');

  // Clean up auth state files
  const authDir = 'tests/.auth';
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log('Auth state files cleaned up');
  }

  // Clean up any test data created during tests
  // Add your cleanup logic here

  console.log('Global teardown completed');
}

export default globalTeardown;
`;
  }

  protected generateGitHubWorkflow(): string {
    return `name: Playwright Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        shardIndex: [1, 2, 3, 4]
        shardTotal: [4]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npx playwright test --shard=\${{ matrix.shardIndex }}/\${{ matrix.shardTotal }}

      - name: Upload blob report to GitHub Actions Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: blob-report-\${{ matrix.shardIndex }}
          path: blob-report
          retention-days: 1

  merge-reports:
    if: always()
    needs: [test]
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Download blob reports from GitHub Actions Artifacts
        uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true

      - name: Merge into HTML Report
        run: npx playwright merge-reports --reporter html ./all-blob-reports

      - name: Upload HTML report
        uses: actions/upload-artifact@v4
        with:
          name: html-report--attempt-\${{ github.run_attempt }}
          path: playwright-report
          retention-days: 14
`;
  }

  protected generatePackageScripts(): string {
    return JSON.stringify({
      scripts: {
        'test:e2e': 'playwright test',
        'test:e2e:ui': 'playwright test --ui',
        'test:e2e:debug': 'playwright test --debug',
        'test:e2e:headed': 'playwright test --headed',
        'test:e2e:chromium': 'playwright test --project=chromium',
        'test:e2e:firefox': 'playwright test --project=firefox',
        'test:e2e:webkit': 'playwright test --project=webkit',
        'test:e2e:mobile': 'playwright test --project="Mobile Chrome" --project="Mobile Safari"',
        'test:e2e:report': 'playwright show-report',
        'test:e2e:codegen': 'playwright codegen',
        'test:e2e:update-snapshots': 'playwright test --update-snapshots'
      },
      devDependencies: {
        '@playwright/test': '^1.41.0',
        '@axe-core/playwright': '^4.8.0'
      }
    }, null, 2);
  }

  protected generateReadme(): string {
    return `# Playwright E2E Testing for ${this.context.name}

This directory contains end-to-end tests using Playwright.

## Quick Start

\`\`\`bash
# Install Playwright browsers
npx playwright install

# Run all tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode
npm run test:e2e:debug
\`\`\`

## Directory Structure

\`\`\`
tests/
├── e2e/                 # E2E test specs
│   ├── home.spec.ts
│   ├── navigation.spec.ts
│   ├── auth.spec.ts
│   ├── api.spec.ts
│   ├── visual.spec.ts
│   └── accessibility.spec.ts
├── fixtures/            # Test fixtures
│   ├── base.ts
│   └── auth.ts
├── pages/               # Page Object Models
│   ├── BasePage.ts
│   ├── HomePage.ts
│   └── LoginPage.ts
├── utils/               # Test utilities
│   ├── helpers.ts
│   └── api-helpers.ts
├── data/                # Test data
│   └── users.ts
├── global-setup.ts      # Global setup
└── global-teardown.ts   # Global teardown
\`\`\`

## Running Tests

### Basic Commands

\`\`\`bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test auth.spec.ts

# Run tests matching pattern
npx playwright test -g "login"

# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
\`\`\`

### UI Mode

\`\`\`bash
npx playwright test --ui
\`\`\`

### Debug Mode

\`\`\`bash
npx playwright test --debug
\`\`\`

### Generate Test Code

\`\`\`bash
npx playwright codegen http://localhost:${this.context.port}
\`\`\`

## Page Objects

Use Page Objects for maintainable tests:

\`\`\`typescript
import { LoginPage } from '../pages/LoginPage';

test('should login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login('user@example.com', 'password');
  await loginPage.expectSuccessfulLogin();
});
\`\`\`

## Test Fixtures

Custom fixtures provide reusable test setup:

\`\`\`typescript
import { test, expect } from '../fixtures/base';

test('test with fixtures', async ({ page, testId, apiUrl }) => {
  console.log(\`Test ID: \${testId}\`);
  console.log(\`API URL: \${apiUrl}\`);
});
\`\`\`

## API Testing

Test APIs directly:

\`\`\`typescript
test('API test', async ({ request }) => {
  const response = await request.get('/api/users');
  expect(response.ok()).toBeTruthy();
});
\`\`\`

## Visual Testing

Capture and compare screenshots:

\`\`\`typescript
test('visual test', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('home.png');
});
\`\`\`

Update snapshots:
\`\`\`bash
npx playwright test --update-snapshots
\`\`\`

## Accessibility Testing

\`\`\`typescript
import AxeBuilder from '@axe-core/playwright';

test('accessibility', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
\`\`\`

## Reports

### View HTML Report

\`\`\`bash
npx playwright show-report
\`\`\`

### CI Artifacts

In CI, reports are uploaded as artifacts. Download and view locally.

## Best Practices

1. **Use data-testid for selectors**
   \`\`\`typescript
   await page.getByTestId('submit-button').click();
   \`\`\`

2. **Avoid hard waits**
   \`\`\`typescript
   // Bad
   await page.waitForTimeout(2000);

   // Good
   await page.waitForSelector('[data-testid="result"]');
   \`\`\`

3. **Use Page Objects for complex pages**

4. **Isolate tests** - Each test should be independent

5. **Use fixtures for common setup**

## Configuration

See \`playwright.config.ts\` for full configuration options.

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Page Object Model](https://playwright.dev/docs/pom)
`;
  }
}
