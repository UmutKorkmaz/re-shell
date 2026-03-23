import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class CypressE2ETemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Cypress configuration
    files.push({
      path: 'cypress.config.ts',
      content: this.generateCypressConfig()
    });

    // TypeScript config for Cypress
    files.push({
      path: 'cypress/tsconfig.json',
      content: this.generateCypressTsConfig()
    });

    // Support files
    files.push({
      path: 'cypress/support/e2e.ts',
      content: this.generateSupportE2E()
    });

    files.push({
      path: 'cypress/support/commands.ts',
      content: this.generateCommands()
    });

    files.push({
      path: 'cypress/support/component.ts',
      content: this.generateComponentSupport()
    });

    // Fixtures
    files.push({
      path: 'cypress/fixtures/example.json',
      content: this.generateExampleFixture()
    });

    files.push({
      path: 'cypress/fixtures/users.json',
      content: this.generateUsersFixture()
    });

    // E2E specs
    files.push({
      path: 'cypress/e2e/home.cy.ts',
      content: this.generateHomeSpec()
    });

    files.push({
      path: 'cypress/e2e/navigation.cy.ts',
      content: this.generateNavigationSpec()
    });

    files.push({
      path: 'cypress/e2e/auth.cy.ts',
      content: this.generateAuthSpec()
    });

    files.push({
      path: 'cypress/e2e/api.cy.ts',
      content: this.generateApiSpec()
    });

    // Component specs (if using component testing)
    files.push({
      path: 'cypress/component/Button.cy.tsx',
      content: this.generateButtonComponentSpec()
    });

    // Types
    files.push({
      path: 'cypress/support/index.d.ts',
      content: this.generateTypeDefinitions()
    });

    // Plugins
    files.push({
      path: 'cypress/plugins/index.ts',
      content: this.generatePlugins()
    });

    // Custom tasks
    files.push({
      path: 'cypress/tasks/database.ts',
      content: this.generateDatabaseTasks()
    });

    // GitHub Actions workflow
    files.push({
      path: '.github/workflows/cypress.yml',
      content: this.generateGitHubWorkflow()
    });

    // Package.json scripts (partial - to be merged)
    files.push({
      path: 'cypress-package-scripts.json',
      content: this.generatePackageScripts()
    });

    // README
    files.push({
      path: 'cypress/README.md',
      content: this.generateReadme()
    });

    return files;
  }

  protected generateCypressConfig(): string {
    return `import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: '${this.context.normalizedName}',

  e2e: {
    baseUrl: 'http://localhost:${this.context.port}',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    chromeWebSecurity: false,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    env: {
      apiUrl: 'http://localhost:${this.context.port}/api',
      coverage: false,
    },
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      require('./cypress/plugins/index.ts').default(on, config);

      // Code coverage
      if (config.env.coverage) {
        require('@cypress/code-coverage/task')(on, config);
      }

      return config;
    },
  },

  component: {
    devServer: {
      framework: '${this.getFrameworkType()}',
      bundler: '${this.getBundlerType()}',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },

  experimentalStudio: true,
  experimentalWebKitSupport: true,
});
`;
  }

  protected getFrameworkType(): string {
    const frameworkMap: Record<string, string> = {
      'react': 'react',
      'react-ts': 'react',
      'vue': 'vue',
      'vue-ts': 'vue',
      'next': 'next',
      'nuxt': 'nuxt',
      'angular': 'angular',
      'svelte': 'svelte',
      'solid-js': 'react', // Use React-like config
    };
    return frameworkMap[this.framework.name] || 'react';
  }

  protected getBundlerType(): string {
    if (this.framework.buildTool === 'webpack') return 'webpack';
    return 'vite';
  }

  protected generateCypressTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM'],
        types: ['cypress', 'node'],
        isolatedModules: false,
        esModuleInterop: true,
        moduleResolution: 'node',
        strict: true,
        skipLibCheck: true,
        baseUrl: '.',
        paths: {
          '@/*': ['../src/*'],
          '@fixtures/*': ['fixtures/*'],
          '@support/*': ['support/*']
        }
      },
      include: ['**/*.ts', '**/*.tsx'],
      exclude: ['node_modules']
    }, null, 2);
  }

  protected generateSupportE2E(): string {
    return `// ***********************************************************
// This file is processed and loaded automatically before your test files.
// You can read more here: https://on.cypress.io/configuration
// ***********************************************************

import './commands';

// Hide fetch/XHR requests in the command log
const app = window.top;
if (app && !app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style');
  style.innerHTML = '.command-name-request, .command-name-xhr { display: none }';
  style.setAttribute('data-hide-command-log-request', '');
  app.document.head.appendChild(style);
}

// Global before hook
beforeEach(() => {
  // Preserve cookies between tests
  cy.getCookies().then((cookies) => {
    const cookieNames = cookies.map((c) => c.name);
    Cypress.Cookies.preserveOnce(...cookieNames);
  });

  // Clear local storage except auth tokens
  cy.clearLocalStorage().then(() => {
    // Restore any needed items
  });
});

// Global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Don't fail tests on uncaught exceptions from the app
  // You can customize this to handle specific errors
  if (err.message.includes('ResizeObserver') ||
      err.message.includes('Script error')) {
    return false;
  }
  return true;
});

// Custom logging
Cypress.on('test:after:run', (test, runnable) => {
  if (test.state === 'failed') {
    const screenshot = \`cypress/screenshots/\${Cypress.spec.name}/\${test.title} (failed).png\`;
    console.log(\`Test failed. Screenshot: \${screenshot}\`);
  }
});
`;
  }

  protected generateCommands(): string {
    return `// ***********************************************
// Custom commands for ${this.context.name}
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      signup(user: { email: string; password: string; name: string }): Chainable<void>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
      getByRole(role: string, options?: { name?: string | RegExp }): Chainable<JQuery<HTMLElement>>;
      waitForApi(alias: string, timeout?: number): Chainable<void>;
      mockApi(method: string, url: string, response: object): Chainable<void>;
      dragAndDrop(subject: string, target: string): Chainable<void>;
      checkAccessibility(context?: string): Chainable<void>;
      preserveSession(): Chainable<void>;
      clearAllData(): Chainable<void>;
    }
  }
}

// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    cy.url().should('not.include', '/login');
  });
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-button"]').click();
  cy.url().should('include', '/login');
});

// Signup command
Cypress.Commands.add('signup', (user: { email: string; password: string; name: string }) => {
  cy.visit('/signup');
  cy.get('[data-testid="name-input"]').type(user.name);
  cy.get('[data-testid="email-input"]').type(user.email);
  cy.get('[data-testid="password-input"]').type(user.password);
  cy.get('[data-testid="confirm-password-input"]').type(user.password);
  cy.get('[data-testid="signup-button"]').click();
  cy.url().should('not.include', '/signup');
});

// Get element by test ID
Cypress.Commands.add('getByTestId', (testId: string) => {
  return cy.get(\`[data-testid="\${testId}"]\`);
});

// Get element by role (accessibility)
Cypress.Commands.add('getByRole', (role: string, options?: { name?: string | RegExp }) => {
  if (options?.name) {
    return cy.get(\`[role="\${role}"]\`).filter((_, el) => {
      const name = el.getAttribute('aria-label') || el.textContent;
      if (typeof options.name === 'string') {
        return name?.includes(options.name);
      }
      return options.name.test(name || '');
    });
  }
  return cy.get(\`[role="\${role}"]\`);
});

// Wait for API call to complete
Cypress.Commands.add('waitForApi', (alias: string, timeout = 10000) => {
  cy.wait(\`@\${alias}\`, { timeout });
});

// Mock API endpoint
Cypress.Commands.add('mockApi', (method: string, url: string, response: object) => {
  cy.intercept(method, url, {
    statusCode: 200,
    body: response,
  }).as(url.replace(/\\//g, '_'));
});

// Drag and drop command
Cypress.Commands.add('dragAndDrop', (subject: string, target: string) => {
  const dataTransfer = new DataTransfer();

  cy.get(subject)
    .trigger('dragstart', { dataTransfer })
    .trigger('drag', {});

  cy.get(target)
    .trigger('dragover', { dataTransfer })
    .trigger('drop', { dataTransfer })
    .trigger('dragend', { dataTransfer });
});

// Accessibility check command (requires cypress-axe)
Cypress.Commands.add('checkAccessibility', (context?: string) => {
  cy.injectAxe();
  if (context) {
    cy.checkA11y(context);
  } else {
    cy.checkA11y();
  }
});

// Preserve session between tests
Cypress.Commands.add('preserveSession', () => {
  Cypress.Cookies.preserveOnce('session', 'auth_token', 'refresh_token');
});

// Clear all application data
Cypress.Commands.add('clearAllData', () => {
  cy.clearCookies();
  cy.clearLocalStorage();
  cy.window().then((win) => {
    win.sessionStorage.clear();
  });
});

export {};
`;
  }

  protected generateComponentSupport(): string {
    const isReact = ['react', 'react-ts', 'next', 'vite-react'].includes(this.framework.name);
    const isVue = ['vue', 'vue-ts', 'nuxt'].includes(this.framework.name);

    let imports = '';
    let mountSetup = '';

    if (isReact) {
      imports = `import { mount } from 'cypress/react18';`;
      mountSetup = `
Cypress.Commands.add('mount', mount);

// Example: mount with providers
Cypress.Commands.add('mountWithProviders', (component, options = {}) => {
  // Wrap with providers like Router, Redux, etc.
  return mount(component, options);
});`;
    } else if (isVue) {
      imports = `import { mount } from 'cypress/vue';`;
      mountSetup = `
Cypress.Commands.add('mount', mount);

// Example: mount with plugins
Cypress.Commands.add('mountWithPlugins', (component, options = {}) => {
  return mount(component, {
    ...options,
    global: {
      plugins: [/* your plugins */],
      ...options.global,
    },
  });
});`;
    } else {
      imports = `// Import framework-specific mount function`;
      mountSetup = `// Configure component testing for your framework`;
    }

    return `// Component testing support file
${imports}
import './commands';

${mountSetup}

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}
`;
  }

  protected generateExampleFixture(): string {
    return JSON.stringify({
      name: this.context.name,
      version: '1.0.0',
      description: 'Example fixture data',
      items: [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
        { id: 3, name: 'Item 3', value: 300 }
      ]
    }, null, 2);
  }

  protected generateUsersFixture(): string {
    return JSON.stringify({
      validUser: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      },
      adminUser: {
        email: 'admin@example.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin'
      },
      newUser: {
        email: 'new@example.com',
        password: 'newuser123',
        name: 'New User'
      }
    }, null, 2);
  }

  protected generateHomeSpec(): string {
    return `describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display the home page', () => {
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should have a visible header', () => {
    cy.get('header').should('be.visible');
  });

  it('should have a visible main content area', () => {
    cy.get('main').should('be.visible');
  });

  it('should display the page title', () => {
    cy.title().should('contain', '${this.context.name}');
  });

  it('should be responsive on mobile', () => {
    cy.viewport('iphone-x');
    cy.get('header').should('be.visible');
    cy.get('main').should('be.visible');
  });

  it('should be responsive on tablet', () => {
    cy.viewport('ipad-2');
    cy.get('header').should('be.visible');
    cy.get('main').should('be.visible');
  });

  it('should load within acceptable time', () => {
    cy.window().its('performance.timing').then((timing) => {
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      expect(loadTime).to.be.lessThan(5000); // 5 seconds max
    });
  });

  context('Accessibility', () => {
    it('should not have any accessibility violations', () => {
      cy.injectAxe();
      cy.checkA11y();
    });

    it('should have proper heading hierarchy', () => {
      cy.get('h1').should('have.length.at.least', 1);
    });

    it('should have alt text on images', () => {
      cy.get('img').each(($img) => {
        expect($img).to.have.attr('alt');
      });
    });
  });
});
`;
  }

  protected generateNavigationSpec(): string {
    return `describe('Navigation', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should navigate to different pages', () => {
    // Test navigation links
    cy.get('nav a').first().click();
    cy.url().should('not.eq', Cypress.config().baseUrl + '/');

    // Go back to home
    cy.go('back');
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should highlight active navigation item', () => {
    cy.get('nav a').first().click();
    cy.get('nav a').first().should('have.class', 'active');
  });

  it('should support keyboard navigation', () => {
    cy.get('nav a').first().focus();
    cy.focused().should('have.attr', 'href');
    cy.focused().type('{enter}');
    cy.url().should('not.eq', Cypress.config().baseUrl + '/');
  });

  context('Mobile Navigation', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('should show mobile menu button', () => {
      cy.getByTestId('mobile-menu-button').should('be.visible');
    });

    it('should open mobile menu on click', () => {
      cy.getByTestId('mobile-menu-button').click();
      cy.getByTestId('mobile-menu').should('be.visible');
    });

    it('should close mobile menu when link is clicked', () => {
      cy.getByTestId('mobile-menu-button').click();
      cy.getByTestId('mobile-menu').find('a').first().click();
      cy.getByTestId('mobile-menu').should('not.be.visible');
    });
  });

  context('Browser History', () => {
    it('should support back/forward navigation', () => {
      const initialUrl = cy.url();

      cy.get('nav a').first().click();
      cy.go('back');
      cy.url().should('eq', Cypress.config().baseUrl + '/');

      cy.go('forward');
      cy.url().should('not.eq', Cypress.config().baseUrl + '/');
    });
  });
});
`;
  }

  protected generateAuthSpec(): string {
    return `describe('Authentication', () => {
  beforeEach(() => {
    cy.clearAllData();
  });

  context('Login', () => {
    beforeEach(() => {
      cy.visit('/login');
    });

    it('should display login form', () => {
      cy.getByTestId('email-input').should('be.visible');
      cy.getByTestId('password-input').should('be.visible');
      cy.getByTestId('login-button').should('be.visible');
    });

    it('should login with valid credentials', () => {
      cy.fixture('users').then((users) => {
        cy.getByTestId('email-input').type(users.validUser.email);
        cy.getByTestId('password-input').type(users.validUser.password);
        cy.getByTestId('login-button').click();

        cy.url().should('not.include', '/login');
        cy.getByTestId('user-menu').should('be.visible');
      });
    });

    it('should show error with invalid credentials', () => {
      cy.getByTestId('email-input').type('invalid@example.com');
      cy.getByTestId('password-input').type('wrongpassword');
      cy.getByTestId('login-button').click();

      cy.getByTestId('error-message').should('be.visible');
    });

    it('should validate email format', () => {
      cy.getByTestId('email-input').type('invalid-email');
      cy.getByTestId('password-input').type('password123');
      cy.getByTestId('login-button').click();

      cy.getByTestId('email-input').should('have.attr', 'aria-invalid', 'true');
    });

    it('should require password', () => {
      cy.getByTestId('email-input').type('test@example.com');
      cy.getByTestId('login-button').click();

      cy.getByTestId('password-input').should('have.attr', 'aria-invalid', 'true');
    });
  });

  context('Signup', () => {
    beforeEach(() => {
      cy.visit('/signup');
    });

    it('should display signup form', () => {
      cy.getByTestId('name-input').should('be.visible');
      cy.getByTestId('email-input').should('be.visible');
      cy.getByTestId('password-input').should('be.visible');
      cy.getByTestId('signup-button').should('be.visible');
    });

    it('should create account with valid data', () => {
      cy.fixture('users').then((users) => {
        const uniqueEmail = \`test-\${Date.now()}@example.com\`;

        cy.getByTestId('name-input').type(users.newUser.name);
        cy.getByTestId('email-input').type(uniqueEmail);
        cy.getByTestId('password-input').type(users.newUser.password);
        cy.getByTestId('confirm-password-input').type(users.newUser.password);
        cy.getByTestId('signup-button').click();

        cy.url().should('not.include', '/signup');
      });
    });

    it('should validate password confirmation', () => {
      cy.getByTestId('name-input').type('Test');
      cy.getByTestId('email-input').type('test@example.com');
      cy.getByTestId('password-input').type('password123');
      cy.getByTestId('confirm-password-input').type('different');
      cy.getByTestId('signup-button').click();

      cy.getByTestId('confirm-password-input').should('have.attr', 'aria-invalid', 'true');
    });
  });

  context('Logout', () => {
    beforeEach(() => {
      cy.fixture('users').then((users) => {
        cy.login(users.validUser.email, users.validUser.password);
      });
      cy.visit('/');
    });

    it('should logout successfully', () => {
      cy.getByTestId('user-menu').click();
      cy.getByTestId('logout-button').click();

      cy.url().should('include', '/login');
      cy.getByTestId('user-menu').should('not.exist');
    });

    it('should clear session data on logout', () => {
      cy.getByTestId('user-menu').click();
      cy.getByTestId('logout-button').click();

      cy.getCookie('session').should('not.exist');
      cy.window().then((win) => {
        expect(win.localStorage.getItem('auth_token')).to.be.null;
      });
    });
  });

  context('Protected Routes', () => {
    it('should redirect to login when accessing protected route without auth', () => {
      cy.visit('/dashboard');
      cy.url().should('include', '/login');
    });

    it('should access protected route when authenticated', () => {
      cy.fixture('users').then((users) => {
        cy.login(users.validUser.email, users.validUser.password);
      });

      cy.visit('/dashboard');
      cy.url().should('include', '/dashboard');
    });
  });
});
`;
  }

  protected generateApiSpec(): string {
    return `describe('API Tests', () => {
  const apiUrl = Cypress.env('apiUrl');

  beforeEach(() => {
    cy.request('GET', \`\${apiUrl}/health\`).its('status').should('eq', 200);
  });

  context('Health Check', () => {
    it('should return healthy status', () => {
      cy.request('GET', \`\${apiUrl}/health\`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('status', 'healthy');
      });
    });
  });

  context('CRUD Operations', () => {
    let itemId: string;

    it('should create a new item', () => {
      cy.request({
        method: 'POST',
        url: \`\${apiUrl}/items\`,
        body: {
          name: 'Test Item',
          value: 100
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body).to.have.property('id');
        itemId = response.body.id;
      });
    });

    it('should read an item', () => {
      cy.request('GET', \`\${apiUrl}/items/\${itemId}\`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('name', 'Test Item');
      });
    });

    it('should update an item', () => {
      cy.request({
        method: 'PUT',
        url: \`\${apiUrl}/items/\${itemId}\`,
        body: {
          name: 'Updated Item',
          value: 200
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('name', 'Updated Item');
      });
    });

    it('should delete an item', () => {
      cy.request('DELETE', \`\${apiUrl}/items/\${itemId}\`).then((response) => {
        expect(response.status).to.eq(204);
      });

      cy.request({
        method: 'GET',
        url: \`\${apiUrl}/items/\${itemId}\`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });

  context('Authentication Endpoints', () => {
    it('should return 401 for protected endpoints without auth', () => {
      cy.request({
        method: 'GET',
        url: \`\${apiUrl}/protected\`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it('should access protected endpoint with valid token', () => {
      cy.fixture('users').then((users) => {
        // Get auth token
        cy.request('POST', \`\${apiUrl}/auth/login\`, {
          email: users.validUser.email,
          password: users.validUser.password
        }).then((loginResponse) => {
          const token = loginResponse.body.token;

          cy.request({
            method: 'GET',
            url: \`\${apiUrl}/protected\`,
            headers: {
              Authorization: \`Bearer \${token}\`
            }
          }).then((response) => {
            expect(response.status).to.eq(200);
          });
        });
      });
    });
  });

  context('Error Handling', () => {
    it('should return 400 for invalid request body', () => {
      cy.request({
        method: 'POST',
        url: \`\${apiUrl}/items\`,
        body: {},
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body).to.have.property('error');
      });
    });

    it('should return 404 for non-existent resource', () => {
      cy.request({
        method: 'GET',
        url: \`\${apiUrl}/items/non-existent-id\`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(404);
      });
    });
  });

  context('Rate Limiting', () => {
    it('should enforce rate limits', () => {
      const requests = Array(100).fill(null);

      cy.wrap(requests).each(() => {
        cy.request({
          method: 'GET',
          url: \`\${apiUrl}/health\`,
          failOnStatusCode: false
        });
      });

      // The last requests should potentially be rate limited
      cy.request({
        method: 'GET',
        url: \`\${apiUrl}/health\`,
        failOnStatusCode: false
      }).then((response) => {
        // Either 200 or 429 (Too Many Requests) is acceptable
        expect([200, 429]).to.include(response.status);
      });
    });
  });
});
`;
  }

  protected generateButtonComponentSpec(): string {
    const isReact = ['react', 'react-ts', 'next', 'vite-react'].includes(this.framework.name);

    if (isReact) {
      return `import React from 'react';

// Example Button component for testing
const Button = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'medium'
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    data-testid="button"
    data-variant={variant}
    data-size={size}
    className={\`btn btn-\${variant} btn-\${size}\`}
  >
    {children}
  </button>
);

describe('Button Component', () => {
  it('renders correctly', () => {
    cy.mount(<Button>Click me</Button>);
    cy.getByTestId('button').should('have.text', 'Click me');
  });

  it('handles click events', () => {
    const onClick = cy.stub().as('onClick');
    cy.mount(<Button onClick={onClick}>Click me</Button>);

    cy.getByTestId('button').click();
    cy.get('@onClick').should('have.been.calledOnce');
  });

  it('can be disabled', () => {
    const onClick = cy.stub().as('onClick');
    cy.mount(<Button onClick={onClick} disabled>Click me</Button>);

    cy.getByTestId('button').should('be.disabled');
    cy.getByTestId('button').click({ force: true });
    cy.get('@onClick').should('not.have.been.called');
  });

  context('Variants', () => {
    it('renders primary variant', () => {
      cy.mount(<Button variant="primary">Primary</Button>);
      cy.getByTestId('button').should('have.attr', 'data-variant', 'primary');
    });

    it('renders secondary variant', () => {
      cy.mount(<Button variant="secondary">Secondary</Button>);
      cy.getByTestId('button').should('have.attr', 'data-variant', 'secondary');
    });

    it('renders danger variant', () => {
      cy.mount(<Button variant="danger">Danger</Button>);
      cy.getByTestId('button').should('have.attr', 'data-variant', 'danger');
    });
  });

  context('Sizes', () => {
    it('renders small size', () => {
      cy.mount(<Button size="small">Small</Button>);
      cy.getByTestId('button').should('have.attr', 'data-size', 'small');
    });

    it('renders medium size', () => {
      cy.mount(<Button size="medium">Medium</Button>);
      cy.getByTestId('button').should('have.attr', 'data-size', 'medium');
    });

    it('renders large size', () => {
      cy.mount(<Button size="large">Large</Button>);
      cy.getByTestId('button').should('have.attr', 'data-size', 'large');
    });
  });

  context('Accessibility', () => {
    it('is focusable', () => {
      cy.mount(<Button>Focusable</Button>);
      cy.getByTestId('button').focus();
      cy.focused().should('have.text', 'Focusable');
    });

    it('can be triggered with keyboard', () => {
      const onClick = cy.stub().as('onClick');
      cy.mount(<Button onClick={onClick}>Press Enter</Button>);

      cy.getByTestId('button').focus().type('{enter}');
      cy.get('@onClick').should('have.been.called');
    });
  });
});
`;
    }

    // Vue version
    return `// Vue Button Component Test
// Adjust based on your component structure

describe('Button Component', () => {
  beforeEach(() => {
    // Mount your Vue Button component here
  });

  it('renders correctly', () => {
    cy.getByTestId('button').should('exist');
  });

  it('handles click events', () => {
    cy.getByTestId('button').click();
    // Add assertions
  });

  it('can be disabled', () => {
    cy.getByTestId('button').should('be.disabled');
  });
});
`;
  }

  protected generateTypeDefinitions(): string {
    return `/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Custom command to login a user
     * @param email - User email
     * @param password - User password
     */
    login(email: string, password: string): Chainable<void>;

    /**
     * Custom command to logout the current user
     */
    logout(): Chainable<void>;

    /**
     * Custom command to signup a new user
     * @param user - User data object
     */
    signup(user: { email: string; password: string; name: string }): Chainable<void>;

    /**
     * Custom command to get element by data-testid
     * @param testId - The test ID to search for
     */
    getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Custom command to get element by role
     * @param role - The ARIA role
     * @param options - Optional filter options
     */
    getByRole(role: string, options?: { name?: string | RegExp }): Chainable<JQuery<HTMLElement>>;

    /**
     * Wait for an API call to complete
     * @param alias - The intercept alias
     * @param timeout - Optional timeout in ms
     */
    waitForApi(alias: string, timeout?: number): Chainable<void>;

    /**
     * Mock an API endpoint
     * @param method - HTTP method
     * @param url - URL pattern
     * @param response - Mock response object
     */
    mockApi(method: string, url: string, response: object): Chainable<void>;

    /**
     * Drag and drop an element
     * @param subject - Selector for draggable element
     * @param target - Selector for drop target
     */
    dragAndDrop(subject: string, target: string): Chainable<void>;

    /**
     * Check accessibility using axe-core
     * @param context - Optional context selector
     */
    checkAccessibility(context?: string): Chainable<void>;

    /**
     * Preserve session cookies between tests
     */
    preserveSession(): Chainable<void>;

    /**
     * Clear all application data (cookies, localStorage, sessionStorage)
     */
    clearAllData(): Chainable<void>;
  }
}
`;
  }

  protected generatePlugins(): string {
    return `// Cypress plugins file
// https://on.cypress.io/plugins-guide

import { execSync } from 'child_process';

export default (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) => {
  // Database tasks
  on('task', {
    // Reset database to clean state
    'db:reset': () => {
      console.log('Resetting database...');
      try {
        // Add your database reset logic here
        // Example: execSync('npm run db:reset', { encoding: 'utf-8' });
        return null;
      } catch (error) {
        console.error('Failed to reset database:', error);
        return null;
      }
    },

    // Seed database with test data
    'db:seed': (seedFile: string) => {
      console.log(\`Seeding database with: \${seedFile}\`);
      try {
        // Add your database seeding logic here
        return null;
      } catch (error) {
        console.error('Failed to seed database:', error);
        return null;
      }
    },

    // Log to terminal
    log: (message: string) => {
      console.log(message);
      return null;
    },

    // Read file from disk
    readFile: (filePath: string) => {
      const fs = require('fs');
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch (error) {
        return null;
      }
    },

    // Execute shell command
    exec: (command: string) => {
      try {
        return execSync(command, { encoding: 'utf-8' });
      } catch (error: any) {
        return error.message;
      }
    },
  });

  // Modify config based on environment
  if (config.env.environment === 'production') {
    config.baseUrl = 'https://your-production-url.com';
  }

  // Handle environment-specific configurations
  const envFile = \`.env.\${config.env.environment || 'development'}\`;
  try {
    require('dotenv').config({ path: envFile });
  } catch (e) {
    // .env file not found, continue with defaults
  }

  return config;
};
`;
  }

  protected generateDatabaseTasks(): string {
    return `// Database tasks for Cypress tests

export interface DatabaseTask {
  name: string;
  execute: () => Promise<void>;
}

// Reset database to initial state
export async function resetDatabase(): Promise<void> {
  console.log('Resetting database to clean state...');
  // Implement your database reset logic here
  // Example: await prisma.$executeRaw\`TRUNCATE TABLE users CASCADE\`;
}

// Seed database with test data
export async function seedDatabase(seedName: string): Promise<void> {
  console.log(\`Seeding database with: \${seedName}\`);

  const seeds: Record<string, () => Promise<void>> = {
    users: async () => {
      // Add test users
    },
    products: async () => {
      // Add test products
    },
    full: async () => {
      await seeds.users();
      await seeds.products();
    },
  };

  if (seeds[seedName]) {
    await seeds[seedName]();
  }
}

// Create test user
export async function createTestUser(userData: {
  email: string;
  password: string;
  name: string;
}): Promise<{ id: string; email: string }> {
  console.log(\`Creating test user: \${userData.email}\`);
  // Implement user creation logic
  return { id: '1', email: userData.email };
}

// Delete test data
export async function cleanupTestData(prefix: string = 'test-'): Promise<void> {
  console.log(\`Cleaning up test data with prefix: \${prefix}\`);
  // Implement cleanup logic
}
`;
  }

  protected generateGitHubWorkflow(): string {
    return `name: Cypress Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  cypress-run:
    runs-on: ubuntu-latest

    strategy:
      fail-fast: false
      matrix:
        browser: [chrome, firefox, edge]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Start server
        run: npm run start &
        env:
          NODE_ENV: test

      - name: Wait for server
        run: npx wait-on http://localhost:${this.context.port}

      - name: Run Cypress tests
        uses: cypress-io/github-action@v6
        with:
          browser: \${{ matrix.browser }}
          headed: false
          record: true
          parallel: true
        env:
          CYPRESS_RECORD_KEY: \${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

      - name: Upload screenshots
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: cypress-screenshots-\${{ matrix.browser }}
          path: cypress/screenshots
          retention-days: 7

      - name: Upload videos
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: cypress-videos-\${{ matrix.browser }}
          path: cypress/videos
          retention-days: 7

  cypress-component:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run component tests
        uses: cypress-io/github-action@v6
        with:
          component: true
          browser: chrome
`;
  }

  protected generatePackageScripts(): string {
    return JSON.stringify({
      scripts: {
        'cy:open': 'cypress open',
        'cy:run': 'cypress run',
        'cy:run:chrome': 'cypress run --browser chrome',
        'cy:run:firefox': 'cypress run --browser firefox',
        'cy:run:edge': 'cypress run --browser edge',
        'cy:component': 'cypress run --component',
        'cy:component:open': 'cypress open --component',
        'cy:ci': 'start-server-and-test start http://localhost:3000 cy:run',
        'test:e2e': 'npm run cy:run',
        'test:e2e:watch': 'npm run cy:open'
      },
      devDependencies: {
        'cypress': '^13.6.0',
        '@cypress/code-coverage': '^3.12.0',
        'cypress-axe': '^1.5.0',
        'axe-core': '^4.8.0',
        'start-server-and-test': '^2.0.0'
      }
    }, null, 2);
  }

  protected generateReadme(): string {
    return `# Cypress E2E Testing for ${this.context.name}

This directory contains end-to-end tests using Cypress.

## Quick Start

\`\`\`bash
# Open Cypress Test Runner (interactive mode)
npm run cy:open

# Run all tests headlessly
npm run cy:run

# Run tests in specific browser
npm run cy:run:chrome
npm run cy:run:firefox
\`\`\`

## Directory Structure

\`\`\`
cypress/
├── e2e/              # E2E test specs
│   ├── home.cy.ts
│   ├── navigation.cy.ts
│   ├── auth.cy.ts
│   └── api.cy.ts
├── component/        # Component test specs
│   └── Button.cy.tsx
├── fixtures/         # Test data
│   ├── example.json
│   └── users.json
├── support/          # Support files and commands
│   ├── e2e.ts
│   ├── commands.ts
│   └── component.ts
├── plugins/          # Cypress plugins
│   └── index.ts
└── tasks/            # Custom tasks
    └── database.ts
\`\`\`

## Custom Commands

### Authentication
\`\`\`typescript
// Login a user
cy.login('user@example.com', 'password');

// Logout
cy.logout();

// Signup
cy.signup({ email: 'new@example.com', password: 'pass123', name: 'New User' });
\`\`\`

### Element Selection
\`\`\`typescript
// Get by test ID (preferred)
cy.getByTestId('submit-button');

// Get by role
cy.getByRole('button', { name: 'Submit' });
\`\`\`

### API Helpers
\`\`\`typescript
// Wait for API call
cy.waitForApi('getUsers');

// Mock API response
cy.mockApi('GET', '/api/users', { users: [] });
\`\`\`

### Accessibility
\`\`\`typescript
// Run accessibility check
cy.checkAccessibility();
\`\`\`

## Best Practices

### Use data-testid Attributes
\`\`\`html
<button data-testid="submit-button">Submit</button>
\`\`\`

\`\`\`typescript
cy.getByTestId('submit-button').click();
\`\`\`

### Avoid Arbitrary Waits
\`\`\`typescript
// Bad
cy.wait(2000);

// Good
cy.getByTestId('loading').should('not.exist');
\`\`\`

### Use Fixtures for Test Data
\`\`\`typescript
cy.fixture('users').then((users) => {
  cy.login(users.validUser.email, users.validUser.password);
});
\`\`\`

### Intercept API Calls
\`\`\`typescript
cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers');
cy.visit('/users');
cy.wait('@getUsers');
\`\`\`

## Running in CI/CD

Tests run automatically on push to main and develop branches. See \`.github/workflows/cypress.yml\`.

### Environment Variables

- \`CYPRESS_RECORD_KEY\`: For Cypress Dashboard recording
- \`CYPRESS_BASE_URL\`: Override the base URL

## Debugging Tips

1. Use \`cy.pause()\` to pause test execution
2. Use \`cy.debug()\` to open browser DevTools
3. Check screenshots in \`cypress/screenshots\` after failures
4. Watch videos in \`cypress/videos\` for test runs

## Resources

- [Cypress Documentation](https://docs.cypress.io)
- [Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Custom Commands](https://docs.cypress.io/api/cypress-api/custom-commands)
`;
  }
}
