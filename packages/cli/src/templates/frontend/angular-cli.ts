import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class AngularCliTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { normalizedName, name } = this.context;

    // Package.json with Angular CLI and latest dependencies
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Angular CLI configuration
    files.push({
      path: 'angular.json',
      content: this.generateAngularJson()
    });

    // TypeScript configs
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    files.push({
      path: 'tsconfig.app.json',
      content: this.generateTsConfigApp()
    });

    files.push({
      path: 'tsconfig.spec.json',
      content: this.generateTsConfigSpec()
    });

    files.push({
      path: 'tsconfig.worker.json',
      content: this.generateTsConfigWorker()
    });

    // Angular application files
    files.push({
      path: 'src/main.ts',
      content: this.generateMain()
    });

    files.push({
      path: 'src/index.html',
      content: this.generateIndexHtml()
    });

    files.push({
      path: 'src/styles.scss',
      content: this.generateStyles()
    });

    // Angular Material theme
    files.push({
      path: 'src/theme.scss',
      content: this.generateMaterialTheme()
    });

    // Custom Material styles
    files.push({
      path: 'src/app/material.styles.scss',
      content: this.generateMaterialStyles()
    });

    // App component with standalone and signals
    files.push({
      path: 'src/app/app.config.ts',
      content: this.generateAppConfig()
    });

    files.push({
      path: 'src/app/app.component.ts',
      content: this.generateAppComponent()
    });

    files.push({
      path: 'src/app/app.component.html',
      content: this.generateAppComponentHtml()
    });

    files.push({
      path: 'src/app/app.component.scss',
      content: this.generateAppComponentStyles()
    });

    // Home component with signals
    files.push({
      path: 'src/app/home/home.component.ts',
      content: this.generateHomeComponent()
    });

    files.push({
      path: 'src/app/home/home.component.html',
      content: this.generateHomeComponentHtml()
    });

    files.push({
      path: 'src/app/home/home.component.scss',
      content: this.generateHomeComponentStyles()
    });

    // About component with signals
    files.push({
      path: 'src/app/about/about.component.ts',
      content: this.generateAboutComponent()
    });

    files.push({
      path: 'src/app/about/about.component.html',
      content: this.generateAboutComponentHtml()
    });

    files.push({
      path: 'src/app/about/about.component.scss',
      content: this.generateAboutComponentStyles()
    });

    // Auth Guard
    files.push({
      path: 'src/app/guards/auth.guard.ts',
      content: this.generateAuthGuard()
    });

    // Admin Guard
    files.push({
      path: 'src/app/guards/admin.guard.ts',
      content: this.generateAdminGuard()
    });

    // User Resolver
    files.push({
      path: 'src/app/resolvers/user.resolver.ts',
      content: this.generateUserResolver()
    });

    // Dashboard components
    files.push({
      path: 'src/app/dashboard/dashboard.component.ts',
      content: this.generateDashboardComponent()
    });

    files.push({
      path: 'src/app/dashboard/dashboard.component.html',
      content: this.generateDashboardComponentHtml()
    });

    files.push({
      path: 'src/app/dashboard/dashboard.component.scss',
      content: this.generateDashboardComponentStyles()
    });

    files.push({
      path: 'src/app/dashboard/home/home.component.ts',
      content: this.generateDashboardHomeComponent()
    });

    files.push({
      path: 'src/app/dashboard/home/home.component.html',
      content: this.generateDashboardHomeComponentHtml()
    });

    files.push({
      path: 'src/app/dashboard/profile/profile.component.ts',
      content: this.generateDashboardProfileComponent()
    });

    files.push({
      path: 'src/app/dashboard/profile/profile.component.html',
      content: this.generateDashboardProfileComponentHtml()
    });

    // Settings lazy-loaded routes
    files.push({
      path: 'src/app/dashboard/settings/settings.routes.ts',
      content: this.generateSettingsRoutes()
    });

    files.push({
      path: 'src/app/dashboard/settings/settings.component.ts',
      content: this.generateSettingsComponent()
    });

    files.push({
      path: 'src/app/dashboard/settings/settings.component.html',
      content: this.generateSettingsComponentHtml()
    });

    // Admin components
    files.push({
      path: 'src/app/admin/admin.component.ts',
      content: this.generateAdminComponent()
    });

    files.push({
      path: 'src/app/admin/admin.component.html',
      content: this.generateAdminComponentHtml()
    });

    files.push({
      path: 'src/app/admin/users/users.component.ts',
      content: this.generateAdminUsersComponent()
    });

    files.push({
      path: 'src/app/admin/users/users.component.html',
      content: this.generateAdminUsersComponentHtml()
    });

    files.push({
      path: 'src/app/admin/roles/roles.component.ts',
      content: this.generateAdminRolesComponent()
    });

    files.push({
      path: 'src/app/admin/roles/roles.component.html',
      content: this.generateAdminRolesComponentHtml()
    });

    // 404 Not Found component
    files.push({
      path: 'src/app/not-found/not-found.component.ts',
      content: this.generateNotFoundComponent()
    });

    files.push({
      path: 'src/app/not-found/not-found.component.html',
      content: this.generateNotFoundComponentHtml()
    });

    // Core components (standalone)
    files.push({
      path: 'src/app/core/header/header.component.ts',
      content: this.generateHeaderComponent()
    });

    files.push({
      path: 'src/app/core/header/header.component.html',
      content: this.generateHeaderComponentHtml()
    });

    files.push({
      path: 'src/app/core/footer/footer.component.ts',
      content: this.generateFooterComponent()
    });

    files.push({
      path: 'src/app/core/footer/footer.component.html',
      content: this.generateFooterComponentHtml()
    });

    // Services with signals
    files.push({
      path: 'src/app/services/counter.service.ts',
      content: this.generateCounterService()
    });

    files.push({
      path: 'src/app/services/api.service.ts',
      content: this.generateApiService()
    });

    // Interceptors
    files.push({
      path: 'src/app/interceptors/auth.interceptor.ts',
      content: this.generateAuthInterceptor()
    });

    // Theme service for Material
    files.push({
      path: 'src/app/services/theme.service.ts',
      content: this.generateThemeService()
    });

    // Theme toggle component
    files.push({
      path: 'src/app/core/theme-toggle/theme-toggle.component.ts',
      content: this.generateThemeToggleComponent()
    });

    files.push({
      path: 'src/app/core/theme-toggle/theme-toggle.component.html',
      content: this.generateThemeToggleComponentHtml()
    });

    // Models
    files.push({
      path: 'src/app/models/counter.model.ts',
      content: this.generateCounterModel()
    });

    // NgRx State Management
    files.push({
      path: 'src/app/store/actions/counter.actions.ts',
      content: this.generateCounterActions()
    });

    files.push({
      path: 'src/app/store/reducers/counter.reducer.ts',
      content: this.generateCounterReducer()
    });

    files.push({
      path: 'src/app/store/reducers/index.ts',
      content: this.generateStoreReducers()
    });

    files.push({
      path: 'src/app/store/selectors/counter.selectors.ts',
      content: this.generateCounterSelectors()
    });

    files.push({
      path: 'src/app/store/effects/counter.effects.ts',
      content: this.generateCounterEffects()
    });

    files.push({
      path: 'src/app/store/index.ts',
      content: this.generateStoreIndex()
    });

    // Routing
    files.push({
      path: 'src/app/app.routes.ts',
      content: this.generateRoutes()
    });

    // Environment files
    files.push({
      path: 'src/environments/environment.ts',
      content: this.generateEnvironment()
    });

    files.push({
      path: 'src/environments/environment.prod.ts',
      content: this.generateEnvironmentProd()
    });

    // Specs
    files.push({
      path: 'src/app/app.component.spec.ts',
      content: this.generateAppComponentSpec()
    });

    files.push({
      path: 'src/app/home/home.component.spec.ts',
      content: this.generateHomeComponentSpec()
    });

    // Test setup and utilities
    files.push({
      path: 'src/test-setup.ts',
      content: this.generateTestSetup()
    });

    files.push({
      path: 'src/testing/test-helpers.ts',
      content: this.generateTestHelpers()
    });

    // Karma config
    files.push({
      path: 'karma.conf.js',
      content: this.generateKarmaConf()
    });

    // ESLint config
    files.push({
      path: '.eslintrc.json',
      content: this.generateEslintConfig()
    });

    // PWA manifest (if PWA enabled)
    files.push({
      path: 'src/manifest.webmanifest',
      content: this.generateManifest()
    });

    // Docker support
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    files.push({
      path: '.dockerignore',
      content: this.generateDockerIgnore()
    });

    files.push({
      path: 'nginx.conf',
      content: this.generateNginxConf()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Git ignore
    files.push({
      path: '.gitignore',
      content: this.generateGitIgnore()
    });

    return files;
  }

  protected generatePackageJson() {
    const { normalizedName } = this.context;
    return {
      name: normalizedName,
      version: '0.0.0',
      scripts: {
        'ng': 'ng',
        'start': 'ng serve',
        'build': 'ng build',
        'watch': 'ng build --watch --configuration development',
        'test': 'ng test',
        'test:ci': 'ng test --watch=false --browsers=ChromeHeadlessCI',
        'test:coverage': 'ng test --watch=false --code-coverage',
        'test:watch': 'ng test --watch',
        'test:headless': 'ng test --watch=false --browsers=ChromeHeadless',
        'lint': 'ng lint',
        'lint:fix': 'ng lint --fix',
        'e2e': 'ng e2e'
      },
      private: true,
      dependencies: {
        '@angular/animations': '^17.0.0',
        '@angular/cdk': '^17.0.0',
        '@angular/common': '^17.0.0',
        '@angular/compiler': '^17.0.0',
        '@angular/core': '^17.0.0',
        '@angular/forms': '^17.0.0',
        '@angular/material': '^17.0.0',
        '@angular/platform-browser': '^17.0.0',
        '@angular/platform-browser-dynamic': '^17.0.0',
        '@angular/router': '^17.0.0',
        '@angular/service-worker': '^17.0.0',
        '@ngrx/effects': '^17.0.0',
        '@ngrx/entity': '^17.0.0',
        '@ngrx/operators': '^17.0.0',
        '@ngrx/router-store': '^17.0.0',
        '@ngrx/store': '^17.0.0',
        '@ngrx/store-devtools': '^17.0.0',
        'rxjs': '^7.8.0',
        'tslib': '^2.6.0',
        'zone.js': '^0.14.0'
      },
      devDependencies: {
        '@angular-devkit/build-angular': '^17.0.0',
        '@angular/cli': '^17.0.0',
        '@angular/compiler-cli': '^17.0.0',
        '@types/jasmine': '^5.1.0',
        '@types/node': '^20.0.0',
        'jasmine-core': '^5.1.0',
        'jasmine-spec-reporter': '^7.0.0',
        'karma': '^6.4.0',
        'karma-chrome-launcher': '^3.2.0',
        'karma-coverage': '^2.2.0',
        'karma-coverage-istanbul-reporter': '^3.0.3',
        'karma-jasmine': '^5.1.0',
        'karma-jasmine-html-reporter': '^2.1.0',
        'typescript': '~5.2.0',
        '@angular-eslint/builder': '^17.0.0',
        '@angular-eslint/eslint-plugin': '^17.0.0',
        '@angular-eslint/eslint-plugin-template': '^17.0.0',
        '@angular-eslint/schematics': '^17.0.0',
        '@angular-eslint/template-parser': '^17.0.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
        '@typescript-eslint/parser': '^6.0.0',
        'eslint': '^8.50.0'
      }
    };
  }

  private generateAngularJson() {
    const { normalizedName } = this.context;
    const projects: any = {};
    projects[normalizedName] = {
      projectType: 'application',
      schematics: {
        '@schematics/angular:component': {
          standalone: true,
          changeDetection: 'OnPush'
        },
        '@schematics/angular:directive': {
          standalone: true
        },
        '@schematics/angular:pipe': {
          standalone: true
        }
      },
      root: '',
      sourceRoot: 'src',
      prefix: 'app',
      architect: {
        build: {
          builder: '@angular-devkit/build-angular:application',
          options: {
            outputPath: `dist/${normalizedName}`,
            index: 'src/index.html',
            browser: 'src/main.ts',
            polyfills: ['zone.js'],
            tsConfig: 'tsconfig.app.json',
            inlineStyleLanguage: 'scss',
            assets: [
              'src/favicon.ico',
              'src/assets',
              'src/manifest.webmanifest'
            ],
            styles: ['src/styles.scss'],
            scripts: [],
            serviceWorker: 'src/ngsw-config.json'
          },
          configurations: {
            production: {
              budgets: [
                {
                  type: 'initial',
                  maximumWarning: '500kb',
                  maximumError: '1mb'
                },
                {
                  type: 'anyComponentStyle',
                  maximumWarning: '2kb',
                  maximumError: '4kb'
                }
              ],
              outputHashing: 'all'
            },
            development: {
              buildOptimizer: false,
              optimization: false,
              vendorChunk: true,
              extractLicenses: false,
              sourceMap: true,
              namedChunks: true
            }
          },
          defaultConfiguration: 'production'
        },
        serve: {
          builder: '@angular-devkit/build-angular:dev-server',
          configurations: {
            production: {
              buildTarget: `${normalizedName}:build:production`
            },
            development: {
              buildTarget: `${normalizedName}:build:development`
            }
          },
          defaultConfiguration: 'development'
        },
        extracti18n: {
          builder: '@angular-devkit/build-angular:extract-i18n',
          options: {
            buildTarget: `${normalizedName}:build`
          }
        },
        test: {
          builder: '@angular-devkit/build-angular:karma',
          options: {
            polyfills: ['zone.js', 'zone.js/testing'],
            tsConfig: 'tsconfig.spec.json',
            inlineStyleLanguage: 'scss',
            assets: [
              'src/favicon.ico',
              'src/assets'
            ],
            styles: ['src/styles.scss'],
            scripts: [],
            codeCoverage: true,
            coverageThreshold: {
              global: {
                statements: 70,
                branches: 70,
                functions: 70,
                lines: 70
              }
            }
          }
        },
        lint: {
          builder: '@angular-eslint/builder:lint',
          options: {
            lintFilePatterns: ['src/**/*.ts', 'src/**/*.html']
          }
        }
      }
    };

    return JSON.stringify({
      '$schema': './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      newProjectRoot: 'projects',
      projects: projects
    }, null, 2);
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compileOnSave: false,
      compilerOptions: {
        baseUrl: './',
        outDir: './dist/out-tsc',
        forceConsistentCasingInFileNames: true,
        strict: true,
        noImplicitOverride: true,
        noPropertyAccessFromIndexSignature: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        sourceMap: true,
        declaration: false,
        experimentalDecorators: true,
        moduleResolution: 'node',
        importHelpers: true,
        target: 'ES2022',
        module: 'ES2022',
        useDefineForClassFields: false,
        lib: ['ES2022', 'dom']
      },
      angularCompilerOptions: {
        enableI18nLegacyMessageIdFormat: false,
        strictInjectionParameters: true,
        strictInputAccessModifiers: true,
        strictTemplates: true
      }
    }, null, 2);
  }

  protected generateTsConfigApp() {
    return JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: './out-tsc/app',
        types: []
      },
      files: ['src/main.ts'],
      include: ['src/**/*.d.ts']
    }, null, 2);
  }

  protected generateTsConfigSpec() {
    return JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: './out-tsc/spec',
        types: ['jasmine', 'node']
      },
      files: ['src/main.ts', 'src/polyfills.ts'],
      include: ['src/**/*.spec.ts', 'src/**/*.d.ts']
    }, null, 2);
  }

  protected generateTsConfigWorker() {
    return JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: {
        outDir: './out-tsc/worker',
        types: []
      },
      include: ['src/**/*.worker.ts', 'src/**/*.worker.ts']
    }, null, 2);
  }

  private generateMain() {
    return `import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    provideAnimationsAsync(),
    provideHttpClient()
  ]
}).catch((err) => console.error(err));

// Register service worker for PWA
if ('serviceWorker' in navigator && environment.production) {
  navigator.serviceWorker.register('/ngsw-worker.js');
}

// Import environment
import { environment } from './environments/environment';
`;
  }

  private generateIndexHtml() {
    const { name } = this.context;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#1976d2">
  <meta name="description" content="Angular CLI application with standalone components and signals">
</head>
<body>
  <app-root></app-root>
  <noscript>Please enable JavaScript to continue using this application.</noscript>
</body>
</html>
`;
  }

  private generateStyles() {
    return `/* Global Styles */

// Import Angular Material theme
@import './theme.scss';

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
  font-family: Roboto, 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  font-family: Roboto, 'Helvetica Neue', sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  padding: 0;
}

/* Utility Classes */

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.text-center {
  text-align: center;
}

.mt-1 { margin-top: 0.5rem; }
.mt-2 { margin-top: 1rem; }
.mt-3 { margin-top: 1.5rem; }
.mt-4 { margin-top: 2rem; }

.mb-1 { margin-bottom: 0.5rem; }
.mb-2 { margin-bottom: 1rem; }
.mb-3 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 2rem; }

/* Material Design Colors */

.primary {
  color: #1976d2;
}

.accent {
  color: #ff4081;
}

.warn {
  color: #f44336;
}
`;
  }

  private generateAppConfig() {
    return `import { ApplicationConfig } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, withViewTransitions, withDebugTracing } from '@angular/router';
import { provideStore, provideState, provideEffects } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideRouterStore } from '@ngrx/router-store';
import { appRoutes } from './app.routes';
import { reducers } from './store/reducers/index';
import * as fromCounter from './store/reducers/counter.reducer';
import { CounterEffects } from './store/effects/counter.effects';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      appRoutes,
      withPreloading(PreloadAllModules),
      withViewTransitions(),
      withDebugTracing()
    ),
    provideStore(reducers, {
      runtimeChecks: {
        strictStateImmutability: true,
        strictActionImmutability: true,
        strictStateSerializability: true,
        strictActionTypeUniqueness: true,
      },
    }),
    provideState(fromCounter.counterFeatureKey, fromCounter.reducer),
    provideEffects(CounterEffects),
    provideRouterStore(),
    !environment.production ? provideStoreDevtools({
      maxAge: 25,
      logOnly: environment.production,
    }) : [],
  ]
};
`;
  }

  private generateAppComponent() {
    return `import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { HeaderComponent } from './core/header/header.component';
import { FooterComponent } from './core/footer/footer.component';
import * as CounterActions from './store/actions/counter.actions';
import { selectCount } from './store/selectors/counter.selectors';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = '${this.context.name}';
  private store = inject(Store);

  // Using NgRx store with signals (Angular 16+)
  readonly count$ = this.store.select(selectCount);
  readonly doubleCount = computed(() => {
    let count = 0;
    this.count$.subscribe(c => count = c);
    return count * 2;
  });

  increment() {
    this.store.dispatch(CounterActions.increment());
  }

  decrement() {
    this.store.dispatch(CounterActions.decrement());
  }

  reset() {
    this.store.dispatch(CounterActions.reset());
  }
}
`;
  }

  private generateAppComponentHtml() {
    return `<app-header></app-header>

<main class="main-container">
  <div class="container">
    <div class="hero">
      <h1>{{ title }}</h1>
      <p class="subtitle">Angular CLI with NgRx State Management</p>
    </div>

    <div class="counter-section">
      <h2>Reactive Counter (NgRx)</h2>
      <div class="counter-display">
        <span class="count">{{ count$ | async }}</span>
        <span class="double-count">Double: {{ doubleCount() }}</span>
      </div>
      <div class="counter-controls">
        <button (click)="decrement()">-</button>
        <button (click)="reset()">Reset</button>
        <button (click)="increment()">+</button>
      </div>
    </div>

    <div class="features">
      <div class="feature-card">
        <h3>⚡ NgRx State Management</h3>
        <p>Predictable state with actions, reducers, and effects</p>
      </div>
      <div class="feature-card">
        <h3>🎯 Standalone Components</h3>
        <p>No NgModules needed - truly independent components</p>
      </div>
      <div class="feature-card">
        <h3>🔧 Angular CLI</h3>
        <p>Full-featured CLI with best practices built-in</p>
      </div>
    </div>

    <router-outlet></router-outlet>
  </div>
</main>

<app-footer></app-footer>
`;
  }

  private generateAppComponentStyles() {
    return `.main-container {
  min-height: calc(100vh - 120px);
  padding: 2rem 0;
}

.hero {
  text-align: center;
  padding: 3rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 1rem;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.2rem;
  opacity: 0.9;
}

.counter-section {
  text-align: center;
  padding: 2rem;
  background-color: #f5f5f5;
  border-radius: 0.5rem;
  margin-bottom: 3rem;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

.counter-display {
  font-size: 2rem;
  font-weight: bold;
  margin: 1.5rem 0;
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.count {
  color: #1976d2;
}

.double-count {
  color: #ff4081;
  font-size: 1.5rem;
}

.counter-controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.counter-controls button {
  font-size: 1.5rem;
  padding: 0.5rem 1.5rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.counter-controls button:hover {
  background-color: #1565c0;
}

.message {
  margin-top: 1rem;
  color: #1976d2;
  font-size: 1rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card {
  padding: 2rem;
  background-color: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 0.5rem;
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #1976d2;
}
`;
  }

  private generateHomeComponent() {
    return `import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  readonly welcomeMessage = signal('Welcome to Angular CLI!');
  readonly features = signal([
    { icon: '⚡', title: 'Signals', description: 'Fine-grained reactivity' },
    { icon: '🎯', title: 'Standalone', description: 'No NgModules required' },
    { icon: '🔧', title: 'CLI', description: 'Powerful tooling' },
    { icon: '📱', title: 'PWA', description: 'Progressive Web App' }
  ]);

  readonly featureCount = computed(() => this.features().length);

  constructor() {
    effect(() => {
      console.log(\`Home has \${this.featureCount()} features\`);
    });
  }
}
`;
  }

  private generateHomeComponentHtml() {
    return `<div class="home">
  <div class="hero-section">
    <h1>{{ welcomeMessage() }}</h1>
    <p class="subtitle">
      Built with Angular 17, standalone components, and signals
    </p>
    <div class="cta-buttons">
      <a routerLink="/about" class="btn btn-primary">Learn More</a>
      <a href="https://angular.io" target="_blank" class="btn btn-secondary">
        Angular Docs
      </a>
    </div>
  </div>

  <section class="features-section">
    <h2>Key Features</h2>
    <div class="features-grid">
      @for (feature of features(); track feature.title) {
        <div class="feature-card">
          <span class="feature-icon">{{ feature.icon }}</span>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </div>
      }
    </div>
    <p class="feature-count">
      Total Features: {{ featureCount() }}
    </p>
  </section>

  <section class="demo-section">
    <h2>Interactive Demo</h2>
    <p>Try the reactive counter on the main page!</p>
    <div class="info-box">
      <h4>Why Signals?</h4>
      <ul>
        <li>Fine-grained reactivity</li>
        <li>Better performance</li>
        <li>Simpler mental model</li>
        <li>No Zone.js needed in the future</li>
      </ul>
    </div>
  </section>
</div>
`;
  }

  private generateHomeComponentStyles() {
    return `.home {
  padding: 2rem 0;
}

.hero-section {
  text-align: center;
  padding: 4rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 1rem;
  margin-bottom: 3rem;
}

.hero-section h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.subtitle {
  font-size: 1.2rem;
  opacity: 0.9;
  margin-bottom: 2rem;
}

.cta-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 2rem;
  border-radius: 0.25rem;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-primary {
  background-color: white;
  color: #667eea;
}

.btn-primary:hover {
  background-color: #f5f5f5;
  transform: translateY(-2px);
}

.btn-secondary {
  background-color: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background-color: white;
  color: #667eea;
}

.features-section {
  margin-bottom: 3rem;
}

.features-section h2 {
  text-align: center;
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #1976d2;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.feature-card {
  padding: 2rem;
  background-color: #f5f5f5;
  border-radius: 0.5rem;
  text-align: center;
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.feature-card h3 {
  margin-bottom: 0.5rem;
  color: #1976d2;
}

.feature-count {
  text-align: center;
  font-size: 1.1rem;
  color: #666;
}

.demo-section {
  background-color: #f5f5f5;
  padding: 2rem;
  border-radius: 0.5rem;
}

.demo-section h2 {
  color: #1976d2;
  margin-bottom: 1rem;
}

.info-box {
  background-color: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  border-left: 4px solid #1976d2;
}

.info-box h4 {
  color: #1976d2;
  margin-bottom: 0.5rem;
}

.info-box ul {
  margin: 0;
  padding-left: 1.5rem;
}

.info-box li {
  margin-bottom: 0.5rem;
}
`;
  }

  private generateAboutComponent() {
    return `import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {
  readonly technologies = signal([
    'Angular 17',
    'TypeScript 5.2',
    'Signals API',
    'Standalone Components',
    'Angular CLI',
    'RxJS 7'
  ]);

  readonly showDetails = signal(false);

  toggleDetails() {
    this.showDetails.update(value => !value);
  }
}
`;
  }

  private generateAboutComponentHtml() {
    return `<div class="about">
  <h1>About This Application</h1>

  <p class="intro">
    This is an Angular CLI application showcasing the latest Angular features
    including standalone components and signals.
  </p>

  <section class="tech-stack">
    <h2>Tech Stack</h2>
    <div class="tech-list">
      @for (tech of technologies(); track tech) {
        <div class="tech-item">
          <span class="tech-name">{{ tech }}</span>
        </div>
      }
    </div>
  </section>

  <section class="details">
    <h2>Angular Features</h2>
    <button (click)="toggleDetails()" class="toggle-btn">
      {{ showDetails() ? 'Hide' : 'Show' }} Details
    </button>

    @if (showDetails()) {
      <div class="details-content">
        <h3>Standalone Components</h3>
        <p>
          No need for NgModules! Components can be self-contained with their own
          dependencies and are tree-shakable by default.
        </p>

        <h3>Signals</h3>
        <p>
          Fine-grained reactivity system that provides better performance and
          a simpler mental model for managing state.
        </p>

        <h3>New Control Flow Syntax</h3>
        <p>
          Use @if, @for, and @switch instead of ngIf, ngFor, and ngSwitch.
          Better type checking and performance!
        </p>
      </div>
    }
  </section>

  <section class="links">
    <h2>Learn More</h2>
    <div class="link-grid">
      <a href="https://angular.io/guide/signals" target="_blank" class="link-card">
        <h3>📚 Signals Guide</h3>
        <p>Official Angular signals documentation</p>
      </a>
      <a href="https://angular.io/guide/standalone-components" target="_blank" class="link-card">
        <h3>🎯 Standalone</h3>
        <p>Learn about standalone components</p>
      </a>
    </div>
  </section>
</div>
`;
  }

  private generateAboutComponentStyles() {
    return `.about {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.about h1 {
  color: #1976d2;
  margin-bottom: 1.5rem;
}

.intro {
  font-size: 1.1rem;
  line-height: 1.6;
  color: #555;
  margin-bottom: 3rem;
}

.tech-stack {
  margin-bottom: 3rem;
}

.tech-stack h2 {
  margin-bottom: 1.5rem;
  color: #1976d2;
}

.tech-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.tech-item {
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 0.25rem;
  text-align: center;
}

.tech-name {
  font-weight: 500;
  color: #1976d2;
}

.details {
  margin-bottom: 3rem;
}

.details h2 {
  margin-bottom: 1rem;
  color: #1976d2;
}

.toggle-btn {
  padding: 0.5rem 1.5rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  margin-bottom: 1.5rem;
}

.toggle-btn:hover {
  background-color: #1565c0;
}

.details-content {
  background-color: #f5f5f5;
  padding: 1.5rem;
  border-radius: 0.5rem;
}

.details-content h3 {
  color: #1976d2;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.details-content p {
  line-height: 1.6;
  color: #555;
}

.links {
  margin-bottom: 2rem;
}

.links h2 {
  margin-bottom: 1.5rem;
  color: #1976d2;
}

.link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.link-card {
  display: block;
  background-color: #f5f5f5;
  padding: 1.5rem;
  border-radius: 0.5rem;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s ease;
}

.link-card:hover {
  background-color: #1976d2;
  color: white;
  transform: translateY(-2px);
}

.link-card h3 {
  margin-bottom: 0.5rem;
}

.link-card p {
  font-size: 0.9rem;
  opacity: 0.8;
}
`;
  }

  private generateAuthGuard() {
    return `import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  // Check if user is authenticated
  const isAuthenticated = localStorage.getItem('authToken') !== null;

  if (!isAuthenticated) {
    // Redirect to login page with return URL
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  return true;
};

// Injectable version for use in components
export class AuthGuard {
  canActivate() {
    return authGuard();
  }
}
`;
  }

  private generateAdminGuard() {
    return `import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  // Check if user is authenticated
  const isAuthenticated = localStorage.getItem('authToken') !== null;
  if (!isAuthenticated) {
    router.navigate(['/login']);
    return false;
  }

  // Check if user has admin role
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'admin') {
    router.navigate(['/dashboard']); // Redirect to dashboard for non-admins
    return false;
  }

  return true;
};

// Injectable version for use in components
export class AdminGuard {
  canActivate() {
    return adminGuard();
  }
}
`;
  }

  private generateUserResolver() {
    return `import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable } from 'rxjs';
import { map, of } from 'rxjs';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export const userResolver: ResolveFn<User> = (route, state) => {
  // In a real app, this would make an HTTP request to your API
  // Example: return inject(HttpClient).get('/api/user').pipe(map(res => res.data));

  // Mock data for demonstration
  const mockUser: User = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user'
  };

  // Simulate async operation
  return of(mockUser).pipe(
    map(user => user)
  );
};
`;
  }

  private generateDashboardComponent() {
    return `import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {}
`;
  }

  private generateDashboardComponentHtml() {
    return `<div class="dashboard-layout">
  <aside class="sidebar">
    <div class="logo">
      <h2>Dashboard</h2>
    </div>
    <nav class="nav">
      <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
        <span class="icon">🏠</span> Home
      </a>
      <a routerLink="/dashboard/profile" routerLinkActive="active" class="nav-link">
        <span class="icon">👤</span> Profile
      </a>
      <a routerLink="/dashboard/settings" routerLinkActive="active" class="nav-link">
        <span class="icon">⚙️</span> Settings
      </a>
    </nav>
  </aside>
  <main class="main-content">
    <header class="header">
      <h1>{{ 'Dashboard' | title }}</h1>
      <div class="user-menu">
        <span>Welcome, User</span>
        <button (click)="logout()">Logout</button>
      </div>
    </header>
    <div class="content">
      <router-outlet></router-outlet>
    </div>
  </main>
</div>

<!-- Title pipe for dynamic page titles -->
<script>
import { Title } from '@angular/platform-browser';
import { Injectable } from '@angular/core';
import { Pipe, PipeTransform } from '@angular/core';

@Injectable({ providedIn: 'root' })
@Pipe({ name: 'title', standalone: true })
export class TitlePipe implements PipeTransform {
  constructor(private title: Title) {}

  transform(value: string): string {
    this.title.setTitle(value);
    return value;
  }
}
</script>
`;
  }

  private generateDashboardComponentStyles() {
    return `.dashboard-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 250px;
  background: #2c3e50;
  color: white;
  padding: 2rem 0;
  position: fixed;
  height: 100vh;
}

.logo {
  padding: 0 2rem;
  margin-bottom: 2rem;
}

.logo h2 {
  color: #1976d2;
  margin: 0;
}

.nav {
  display: flex;
  flex-direction: column;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  color: #ecf0f1;
  text-decoration: none;
  transition: all 0.3s ease;
  border-left: 3px solid transparent;
}

.nav-link:hover,
.nav-link.active {
  background: #34495e;
  border-left-color: #1976d2;
}

.icon {
  font-size: 1.25rem;
}

.main-content {
  margin-left: 250px;
  flex: 1;
}

.header {
  background: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  margin: 0;
  color: #2c3e50;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-menu button {
  padding: 0.5rem 1.5rem;
  background: #1976d2;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background 0.3s;
}

.user-menu button:hover {
  background: #1565c0;
}

.content {
  padding: 2rem;
}
`;
  }

  private generateDashboardHomeComponent() {
    return `import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  templateUrl: './home.component.html'
})
export class DashboardHomeComponent {
  stats = signal([
    { label: 'Total Users', value: '1,234', icon: '👥' },
    { label: 'Active Sessions', value: '56', icon: '⚡' },
    { label: 'Revenue', value: '$12,345', icon: '💰' }
  ]);
}
`;
  }

  private generateDashboardHomeComponentHtml() {
    return `<div class="dashboard-home">
  <h2>Welcome to your Dashboard</h2>
  <div class="stats-grid">
    @for (stat of stats(); track stat.label) {
      <div class="stat-card">
        <div class="stat-icon">{{ stat.icon }}</div>
        <div class="stat-info">
          <h3>{{ stat.label }}</h3>
          <p class="stat-value">{{ stat.value }}</p>
        </div>
      </div>
    }
  </div>
</div>
`;
  }

  private generateDashboardProfileComponent() {
    return `import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { User, userResolver } from '../../resolvers/user.resolver';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit {
  private route = inject(ActivatedRoute);

  // Get resolved data from route
  user = toSignal(this.route.data.pipe(
    map(data => data['user'])
  ), { initialValue: {} as User });

  ngOnInit() {
    console.log('User data resolved:', this.user());
  }
}
`;
  }

  private generateDashboardProfileComponentHtml() {
    return `<div class="profile">
  <h2>User Profile</h2>
  <div class="profile-card" *ngIf="user; else loading">
    <div class="profile-header">
      <div class="avatar">{{ user?.name?.charAt(0) || '?' }}</div>
      <div class="user-info">
        <h3>{{ user?.name }}</h3>
        <p>{{ user?.email }}</p>
        <span class="badge">{{ user?.role }}</span>
      </div>
    </div>
  </div>
  <ng-template #loading>Loading user data...</ng-template>
</div>
`;
  }

  private generateSettingsRoutes() {
    return `import { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./settings.component').then((m) => m.SettingsComponent),
    children: [
      {
        path: 'account',
        loadComponent: () =>
          import('./account/account.component').then((m) => m.AccountComponent),
        title: 'Account Settings'
      },
      {
        path: 'preferences',
        loadComponent: () =>
          import('./preferences/preferences.component').then((m) => m.PreferencesComponent),
        title: 'Preferences'
      }
    ]
  }
];
`;
  }

  private generateSettingsComponent() {
    return `import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './settings.component.html'
})
export class SettingsComponent {}
`;
  }

  private generateSettingsComponentHtml() {
    return `<div class="settings">
  <h2>Settings</h2>
  <div class="settings-nav">
    <a routerLink="account" routerLinkActive="active" class="nav-link">Account</a>
    <a routerLink="preferences" routerLinkActive="active" class="nav-link">Preferences</a>
  </div>
  <router-outlet></router-outlet>
</div>
`;
  }

  private generateAdminComponent() {
    return `import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin.component.html'
})
export class AdminComponent {}
`;
  }

  private generateAdminComponentHtml() {
    return `<div class="admin-layout">
  <aside class="sidebar">
    <div class="logo">
      <h2>⚡ Admin Panel</h2>
    </div>
    <nav class="nav">
      <a routerLink="/admin/users" routerLinkActive="active" class="nav-link">Users</a>
      <a routerLink="/admin/roles" routerLinkActive="active" class="nav-link">Roles</a>
    </nav>
  </aside>
  <main class="main-content">
    <header class="header">
      <h1>{{ 'Admin' | title }}</h1>
    </header>
    <div class="content">
      <router-outlet></router-outlet>
    </div>
  </main>
</div>
`;
  }

  private generateAdminUsersComponent() {
    return `import { Component, signal } from '@angular/core';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-users',
  standalone: true,
  template: \`
    <div class="users-page">
      <div class="header">
        <h2>User Management</h2>
        <button class="btn-add">Add User</button>
      </div>
      <table class="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (user of users(); track user.id) {
            <tr>
              <td>{{ user.id }}</td>
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ user.role }}</td>
              <td>
                <span [class]="['status-badge', user.status === 'Active' ? 'active' : 'inactive']">
                  {{ user.status }}
                </span>
              </td>
              <td>
                <button class="btn-edit">Edit</button>
                <button class="btn-delete">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  \`
})
export class UsersComponent {
  users = signal<User[]>([
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Inactive' }
  ]);
}
`;
  }

  private generateAdminUsersComponentHtml() {
    return ``; // Template is inline in the component
  }

  private generateAdminRolesComponent() {
    return `import { Component, signal } from '@angular/core';

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
}

@Component({
  selector: 'app-roles',
  standalone: true,
  template: \`
    <div class="roles-page">
      <div class="header">
        <h2>Role Management</h2>
        <button class="btn-add">Add Role</button>
      </div>
      <div class="roles-grid">
        @for (role of roles(); track role.id) {
          <div class="role-card">
            <h3>{{ role.name }}</h3>
            <p>{{ role.description }}</p>
            <div class="permissions">
              <h4>Permissions:</h4>
              <ul>
                @for (perm of role.permissions; track perm) {
                  <li>{{ perm }}</li>
                }
              </ul>
            </div>
            <div class="actions">
              <button class="btn-edit">Edit</button>
              <button class="btn-delete">Delete</button>
            </div>
          </div>
        }
      </div>
    </div>
  \`
})
export class RolesComponent {
  roles = signal<Role[]>([
    {
      id: 1,
      name: 'Administrator',
      description: 'Full system access',
      permissions: ['Create', 'Read', 'Update', 'Delete', 'Manage Users']
    },
    {
      id: 2,
      name: 'Editor',
      description: 'Content management',
      permissions: ['Create', 'Read', 'Update']
    },
    {
      id: 3,
      name: 'Viewer',
      description: 'Read-only access',
      permissions: ['Read']
    }
  ]);
}
`;
  }

  private generateAdminRolesComponentHtml() {
    return ``; // Template is inline in the component
  }

  private generateNotFoundComponent() {
    return `import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styles: [\`
    .not-found {
      text-align: center;
      padding: 4rem 2rem;
    }

    .not-found h1 {
      font-size: 6rem;
      color: #1976d2;
      margin-bottom: 1rem;
    }

    .not-found p {
      font-size: 1.5rem;
      color: #7f8c8d;
      margin-bottom: 2rem;
    }

    .not-found a {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #1976d2;
      color: white;
      text-decoration: none;
      border-radius: 0.25rem;
      transition: background 0.3s;
    }

    .not-found a:hover {
      background: #1565c0;
    }
  \`]
})
export class NotFoundComponent {}
`;
  }

  private generateNotFoundComponentHtml() {
    return `<div class="not-found">
  <h1>404</h1>
  <p>Page not found</p>
  <a routerLink="/">Go Home</a>
</div>
`;
  }

  private generateHeaderComponent() {
    return `import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ThemeToggleComponent],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  readonly title = '${this.context.name}';
}
`;
  }

  private generateHeaderComponentHtml() {
    return `<header class="header">
  <div class="container">
    <div class="header-content">
      <a routerLink="/" class="logo">{{ title }}</a>
      <nav class="nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          Home
        </a>
        <a routerLink="/about" routerLinkActive="active">
          About
        </a>
      </nav>
      <app-theme-toggle></app-theme-toggle>
    </div>
  </div>
</header>
`;
  }

  private generateFooterComponent() {
    return `import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  readonly currentYear = signal(new Date().getFullYear());
}
`;
  }

  private generateFooterComponentHtml() {
    return `<footer class="footer">
  <div class="container">
    <div class="footer-content">
      <p class="copyright">
        &copy; {{ currentYear() }} {{ '${this.context.name}' }}. Built with Angular CLI.
      </p>
      <div class="footer-links">
        <a href="https://angular.io" target="_blank">Angular</a>
        <a href="https://github.com/angular/angular" target="_blank">GitHub</a>
      </div>
    </div>
  </div>
</footer>
`;
  }

  private generateCounterService() {
    return `import { Injectable, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CounterService {
  private count = signal(0);
  readonly doubleCount = computed(() => this.count() * 2);

  constructor() {
    console.log('CounterService initialized');
  }

  updateCount(value: number) {
    this.count.set(value);
  }

  getCount(): number {
    return this.count();
  }

  getDoubleCount(): number {
    return this.doubleCount();
  }

  // Simulate API call
  fetchCount(): Observable<number> {
    return of(this.count());
  }
}
`;
  }

  private generateApiService() {
    return `import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'https://api.example.com';

  constructor(private http: HttpClient) {
    console.log('ApiService initialized');
  }

  getData<T>(): Observable<T> {
    return this.http.get<T>(\`\${this.apiUrl}/data\`);
  }

  postData<T>(data: T): Observable<T> {
    return this.http.post<T>(\`\${this.apiUrl}/data\`, data);
  }
}
`;
  }

  private generateAuthInterceptor() {
    return `import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Add auth token to requests
    const token = localStorage.getItem('auth_token');

    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: \`Bearer \${token}\`
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Handle unauthorized
          console.error('Unauthorized request');
        }
        return throwError(() => error);
      })
    );
  }
}
`;
  }

  private generateCounterModel() {
    return `export interface CounterState {
  count: number;
  lastUpdated: Date;
}

export interface CounterEvent {
  type: string;
  value: number;
  timestamp: Date;
}
`;
  }

  private generateRoutes() {
    return `import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then((m) => m.HomeComponent),
    title: '${this.context.name}',
    canActivate: [() => inject(AuthGuard).canActivate()]
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./about/about.component').then((m) => m.AboutComponent),
    title: 'About - ${this.context.name}'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard',
    canActivate: [() => inject(AuthGuard).canActivate()],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./dashboard/home/home.component').then((m) => m.DashboardHomeComponent),
        title: 'Dashboard Home'
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./dashboard/profile/profile.component').then((m) => m.ProfileComponent),
        title: 'Profile',
        resolve: {
          user: () => inject(UserResolver).resolve()
        }
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./dashboard/settings/settings.routes').then((m) => m.settingsRoutes)
      }
    ]
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin.component').then((m) => m.AdminComponent),
    title: 'Admin Panel',
    canActivate: [() => inject(AuthGuard).canActivate(), () => inject(AdminGuard).canActivate()],
    children: [
      {
        path: '',
        redirectTo: 'users',
        pathMatch: 'full'
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./admin/users/users.component').then((m) => m.UsersComponent),
        title: 'User Management'
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./admin/roles/roles.component').then((m) => m.RolesComponent),
        title: 'Role Management'
      }
    ]
  },
  {
    path: '**',
    loadComponent: () =>
      import('./not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: '404 - Page Not Found'
  }
];

// Enable preloading strategy for better performance
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      appRoutes,
      withPreloading(PreloadAllModules),
      withViewTransitions(),
      withDebugTracing()
    )
  ]
};
`;
  }

  private generateEnvironment() {
    return `export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  enableAnalytics: false
};
`;
  }

  private generateEnvironmentProd() {
    return `export const environment = {
  production: true,
  apiUrl: '/api',
  enableAnalytics: true
};
`;
  }

  private generateAppComponentSpec() {
    return `import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(\`should have title '${this.context.name}'\`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('${this.context.name}');
  });

  it('should increment count', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const initialCount = app.count();
    app.increment();
    expect(app.count()).toBe(initialCount + 1);
  });
});
`;
  }

  private generateHomeComponentSpec() {
    return `import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have welcome message', () => {
    expect(component.welcomeMessage()).toContain('Welcome');
  });

  it('should have features', () => {
    expect(component.features().length).toBeGreaterThan(0);
  });
});
`;
  }

  private generateKarmaConf() {
    return `module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // Disable random execution for consistent test runs
        random: false,
        // Set seed for reproducible test order
        seed: '4321',
        // Increased timeout for async operations
        timeoutInterval: 10000,
        // Show specs in the console
        displaySpecDuration: true,
        // Print failures to the console
        print: function() {
          return process.stdout.write.bind(process.stdout);
        }
      },
      clearContext: false, // Leave Jasmine Spec Runner output visible in browser
      // Capture console output
      captureConsole: true
    },
    jasmineHtmlReporter: {
      suppressAll: false, // Show full stack traces
      showFailedMessages: true,
      showSpecDuration: true
    },
    // Code coverage configuration
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, './coverage/${this.context.normalizedName}'),
      reports: ['html', 'lcovonly', 'text-summary', 'json'],
      fixWebpackSourcePaths: true,
      thresholds: {
        emitWarning: false, // Warn but don't fail on thresholds
        global: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70
        }
      }
    },
    // Karma coverage reporter
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/${this.context.normalizedName}'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'lcov' },
        { type: 'text-summary' },
        { type: 'json' }
      ]
    },
    reporters: ['progress', 'kjhtml', 'coverage-istanbul'],
    browsers: ['ChromeHeadless'],
    restartOnFileChange: true,
    // Custom launchers for different environments
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      }
    },
    // Single run mode for CI
    singleRun: false,
    // Colors in output
    colors: true,
    // Log level
    logLevel: config.LOG_INFO,
    // Watch configuration
    autoWatch: true,
    // Concurrency
    concurrency: Infinity
  });
};
`;
  }

  protected generateEslintConfig() {
    return JSON.stringify({
      root: true,
      ignorePatterns: ['dist', 'node_modules'],
      overrides: [
        {
          files: ['*.ts'],
          parserOptions: {
            project: ['tsconfig.*?.json'],
            createDefaultProgram: true
          },
          extends: [
            'plugin:@angular-eslint/recommended',
            'plugin:@angular-eslint/template/process-inline-templates'
          ],
          rules: {
            '@angular-eslint/directive-selector': [
              'error',
              { type: 'attribute', prefix: 'app', style: 'kebab-case' }
            ],
            '@angular-eslint/component-selector': [
              'error',
              { type: 'element', prefix: 'app', style: 'kebab-case' }
            ]
          }
        },
        {
          files: ['*.html'],
          extends: ['plugin:@angular-eslint/template/recommended'],
          rules: {}
        }
      ]
    }, null, 2);
  }

  private generateManifest() {
    const { name } = this.context;
    return JSON.stringify({
      name: name,
      short_name: name,
      theme_color: '#1976d2',
      background_color: '#ffffff',
      display: 'standalone',
      scope: '/',
      icons: [
        {
          src: 'assets/icons/icon-72x72.png',
          sizes: '72x72',
          type: 'image/png'
        },
        {
          src: 'assets/icons/icon-96x96.png',
          sizes: '96x96',
          type: 'image/png'
        },
        {
          src: 'assets/icons/icon-128x128.png',
          sizes: '128x128',
          type: 'image/png'
        },
        {
          src: 'assets/icons/icon-144x144.png',
          sizes: '144x144',
          type: 'image/png'
        },
        {
          src: 'assets/icons/icon-152x152.png',
          sizes: '152x152',
          type: 'image/png'
        },
        {
          src: 'assets/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'assets/icons/icon-384x384.png',
          sizes: '384x384',
          type: 'image/png'
        },
        {
          src: 'assets/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    }, null, 2);
  }

  private generateDockerfile() {
    return `# Multi-stage Dockerfile for Angular CLI

# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerIgnore() {
    return `node_modules
npm-debug.log
dist
.env.local
.env.development.local
.env.test.local
.env.production.local
.git
.gitignore
README.md
.DS_Store
.vscode
.idea
coverage
`;
  }

  private generateNginxConf() {
    return `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
`;
  }

  protected generateReadme() {
    const { name, description, packageManager } = this.context;
    return `# ${name}

${description || 'Angular CLI application with Angular Material and NgRx state management'}

## Features

- ⚡ Angular 17 with standalone components
- 🎨 Angular Material UI components
- 🎯 NgRx for state management
- 🌙 Dark mode with theme toggle (light/dark/auto)
- 🔧 Angular CLI for best practices
- ♿ Accessibility-first design (WCAG 2.1 AA)
- 📱 Progressive Web App (PWA) support
- 🧪 Testing with Jasmine and Karma
- 🎨 SCSS for styling
- 🐳 Docker support

## Quick Start

\`\`\`bash
# Install dependencies
${packageManager} install

# Serve with hot reload
${packageManager} start

# Build for production
${packageManager} run build

# Run tests
${packageManager} test

# Run linter
${packageManager} run lint
\`\`\`

## Development Server

Run \`ng serve\` for a dev server. Navigate to \`http://localhost:4200/\`.

## Code Scaffolding

Run \`ng generate component component-name\` to generate a new component.

## Build

Run \`ng build\` to build the project. The build artifacts will be stored in the \`dist/\` directory.

## Running Unit Tests

This application is configured for unit testing with Jasmine and Karma.

### Test Scripts

\`\`\`bash
# Run tests in watch mode (interactive)
${packageManager} test

# Run tests once with coverage report
${packageManager} run test:coverage

# Run tests in CI mode (no watch, headless)
${packageManager} run test:ci

# Run tests in headless Chrome
${packageManager} run test:headless

# Run tests with watch mode
${packageManager} run test:watch
\`\`\`

### Code Coverage

Coverage reports are generated in the \`coverage/\` directory:

\`\`\`bash
# View HTML coverage report
open coverage/${this.context.normalizedName}/index.html

# CLI coverage summary
${packageManager} run test:coverage
\`\`\`

Coverage thresholds are configured at 70% for:
- Statements
- Branches
- Functions
- Lines

### Test Configuration

- **Test Runner**: Karma with Jasmine
- **Browser**: Chrome Headless
- **Coverage Tool**: Istanbul
- **Test Location**: \`**/*.spec.ts\`

### Test Utilities

Helper functions available in \`src/testing/test-helpers.ts\`:

\`\`\`typescript
import {
  createComponent,
  queryByCss,
  clickElement,
  setInputValue,
  waitFor,
  MockData,
  createMockService
} from './testing/test-helpers';

// Create component fixture
const fixture = createComponent(MyComponent);

// Query elements
const button = queryByCss(fixture, 'button');

// Simulate user interactions
clickElement(fixture, button);
setInputValue(inputElement, 'test value');

// Wait for async operations
await waitFor(1000);

// Use mock data
const user = MockData.user({ name: 'Custom User' });

// Create mock service
const mockService = createMockService<MyService>(['getData', 'saveData']);
\`\`\`

### Custom Matchers

Additional Jasmine matchers:

\`\`\`typescript
// Check if number is in range
expect(value).toBeInRange(min, max);

// Check element text content
expect(element).toHaveText('expected text');
\`\`\`

## Angular Material

This application uses Angular Material for UI components with comprehensive theming and accessibility.

### Theme System

The app includes a complete theme system with light/dark/auto modes:

\`\`\`typescript
import { ThemeService } from './services/theme.service';

// Use in component
constructor(private themeService: ThemeService) {
  // Set theme
  this.themeService.setTheme('dark');

  // Get current theme
  const isDark = this.themeService.isDarkMode();
}
\`\`\`

### Material Components

Available components:
- **Buttons**: mat-button, mat-raised-button, mat-icon-button, mat-stroked-button
- **Form Fields**: mat-form-field with inputs and selects
- **Cards**: mat-card with headers, titles, and actions
- **Navigation**: mat-menu, mat-toolbar, mat-sidenav
- **Layout**: mat-grid-list, mat-divider, mat-progress-spinner
- **Feedback**: mat-snack-bar, mat-dialog, mat-tooltip

### Customization

Theme customization in \`src/theme.scss\`:

\`\`\`scss
// Define custom palettes
$primary-palette: mat.define-palette(mat.$indigo-palette);
$accent-palette: mat.define-palette(mat.$pink-palette, A200, A100, A400);

// Create custom theme
$custom-theme: mat.define-light-theme((
  color: (
    primary: $primary-palette,
    accent: $accent-palette,
  ),
  density: 0,
));
\`\`\`

### Accessibility

Angular Material is configured for WCAG 2.1 AA compliance:

- Color contrast ratios meet AA standards (4.5:1 for text)
- Keyboard navigation support for all interactive elements
- ARIA labels and roles properly defined
- Focus indicators visible on all components
- High contrast mode support
- Reduced motion support for users with vestibular disorders

## NgRx State Management

This application uses NgRx for predictable state management.

### Store Structure
\`\`\`
src/app/store/
├── actions/         # Action definitions
├── reducers/        # Reducer functions
├── selectors/       # Memoized selectors
├── effects/         # Side effects
└── index.ts         # Store configuration
\`\`\`

### Actions
\`\`\`typescript
import { increment, decrement, reset } from './store/actions/counter.actions';

// Dispatch actions
this.store.dispatch(increment());
this.store.dispatch(decrement());
this.store.dispatch(reset());
\`\`\`

### Selectors
\`\`\`typescript
import { selectCount, selectDoubleCount } from './store/selectors/counter.selectors';

// Select state
this.count$ = this.store.select(selectCount);
this.doubleCount$ = this.store.select(selectDoubleCount);
\`\`\`

### Effects
Effects handle side effects like API calls:
\`\`\`typescript
loadCounter$ = createEffect(() =>
  this.actions$.pipe(
    ofType(CounterActions.loadCounter),
    mergeMap(() =>
      this.apiService.getCounter().pipe(
        map(count => CounterActions.loadCounterSuccess({ count })),
        catchError(error => of(CounterActions.loadCounterFailure({ error })))
      )
    )
  )
);
\`\`\`

### Runtime Checks
NgRx is configured with strict runtime checks for development:
- Strict state immutability
- Strict action immutability
- Strict state serializability
- Strict action type uniqueness

## Angular Features

### Standalone Components
This application uses standalone components - no NgModules needed!
Components are self-contained and tree-shakable.

### New Control Flow
Uses \`@if\`, \`@for\`, and \`@switch\` instead of structural directives.

### Functional Guards
Router guards use functional approach with \`CanActivateFn\` instead of classes.

## Docker

\`\`\`bash
# Build Docker image
docker build -t ${name} .

# Run container
docker run -p 80:80 ${name}
\`\`\`

## Further Help

To get more help on the Angular CLI use \`ng help\` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

For NgRx documentation, visit [ngrx.io](https://ngrx.io).

## License

MIT
`;
  }

  private generateCounterActions() {
    return `import { createAction, props } from '@ngrx/store';

export const increment = createAction('[Counter] Increment');
export const decrement = createAction('[Counter] Decrement');
export const reset = createAction('[Counter] Reset');
export const setValue = createAction('[Counter] SetValue', props<{ value: number }>());
export const incrementBy = createAction('[Counter] IncrementBy', props<{ value: number }>());
export const loadCounter = createAction('[Counter] Load');
export const loadCounterSuccess = createAction('[Counter] Load Success', props<{ count: number }>());
export const loadCounterFailure = createAction('[Counter] Load Failure', props<{ error: string }>());
`;
  }

  private generateCounterReducer() {
    return `import { createReducer, on } from '@ngrx/store';
import * as CounterActions from '../actions/counter.actions';

export const counterFeatureKey = 'counter';

export interface State {
  count: number;
  loading: boolean;
  error: string | null;
}

export const initialState: State = {
  count: 0,
  loading: false,
  error: null
};

export const reducer = createReducer(
  initialState,

  on(CounterActions.increment, (state) => ({
    ...state,
    count: state.count + 1
  })),

  on(CounterActions.decrement, (state) => ({
    ...state,
    count: state.count - 1
  })),

  on(CounterActions.reset, (state) => ({
    ...state,
    count: 0
  })),

  on(CounterActions.setValue, (state, { value }) => ({
    ...state,
    count: value
  })),

  on(CounterActions.incrementBy, (state, { value }) => ({
    ...state,
    count: state.count + value
  })),

  on(CounterActions.loadCounter, (state) => ({
    ...state,
    loading: true,
    error: null
  })),

  on(CounterActions.loadCounterSuccess, (state, { count }) => ({
    ...state,
    count,
    loading: false,
    error: null
  })),

  on(CounterActions.loadCounterFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  }))
);
`;
  }

  private generateStoreReducers() {
    return `import { ActionReducerMap, createFeatureSelector, createSelector } from '@ngrx/store';
import * as fromCounter from './counter.reducer';

export interface State {
  [fromCounter.counterFeatureKey]: fromCounter.State;
}

export const reducers: ActionReducerMap<State> = {
  [fromCounter.counterFeatureKey]: fromCounter.reducer
};
`;
  }

  private generateCounterSelectors() {
    return `import { createFeatureSelector, createSelector } from '@ngrx/store';
import { counterFeatureKey, State } from '../reducers/counter.reducer';

export const selectCounterState = createFeatureSelector<State>(counterFeatureKey);

export const selectCount = createSelector(
  selectCounterState,
  (state) => state.count
);

export const selectDoubleCount = createSelector(
  selectCount,
  (count) => count * 2
);

export const selectLoading = createSelector(
  selectCounterState,
  (state) => state.loading
);

export const selectError = createSelector(
  selectCounterState,
  (state) => state.error
);

export const selectCounterViewModel = createSelector(
  selectCount,
  selectLoading,
  selectError,
  (count, loading, error) => ({
    count,
    loading,
    error,
    canDecrement: count > 0
  })
);
`;
  }

  private generateCounterEffects() {
    return `import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { catchError, map, mergeMap, tap, delay } from 'rxjs/operators';
import * as CounterActions from '../actions/counter.actions';

@Injectable()
export class CounterEffects {
  loadCounter$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CounterActions.loadCounter),
      tap(() => console.log('[CounterEffects] Loading counter...')),
      delay(1000), // Simulate API call
      mergeMap(() =>
        of({ count: 42 }).pipe(
          map(({ count }) => CounterActions.loadCounterSuccess({ count })),
          catchError((error) => of(CounterActions.loadCounterFailure({ error: error.message })))
        )
      )
    )
  );

  constructor(private actions$: Actions) {}
}
`;
  }

  private generateStoreIndex() {
    return `import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../../environments/environment';
import { reducers } from './reducers/index';
import { CounterEffects } from './effects/counter.effects';

@NgModule({
  imports: [
    StoreModule.forRoot(reducers, {
      runtimeChecks: {
        strictStateImmutability: true,
        strictActionImmutability: true,
        strictStateSerializability: true,
        strictActionSerializability: true,
        strictActionWithinNgZone: true,
        strictActionTypeUniqueness: true,
      },
    }),
    EffectsModule.forRoot([CounterEffects]),
    !environment.production ? StoreDevtoolsModule.instrument() : [],
  ],
})
export class AppStoreModule {}
`;
  }

  private generateMaterialTheme() {
    return `// Custom Angular Material Theme

@use '@angular/material' as mat;
@use '@angular/material/theming' as *;

// Define theme palettes
$primary-palette: mat.define-palette(mat.$indigo-palette);
$accent-palette: mat.define-palette(mat.$pink-palette, A200, A100, A400);
$warn-palette: mat.define-palette(mat.$red-palette);

// Create theme (light)
$light-theme: mat.define-light-theme((
  color: (
    primary: $primary-palette,
    accent: $accent-palette,
    warn: $warn-palette,
  ),
  typography: mat.define-typography-config(),
  density: 0,
));

// Create theme (dark)
$dark-theme: mat.define-dark-theme((
  color: (
    primary: mat.define-palette(mat.$blue-palette),
    accent: mat.define-palette(mat.$amber-palette, A200, A100, A400),
  ),
  density: 0,
));

// Apply theme
@include mat.core-theme($light-theme);
@include mat.button-theme($light-theme);
@include mat.checkbox-theme($light-theme);
@include mat.form-field-theme($light-theme);
@include mat.icon-theme($light-theme);
@include mat.input-theme($light-theme);
@include mat.progress-spinner-theme($light-theme);
@include mat.slide-toggle-theme($light-theme);
@include mat.slider-theme($light-theme);
@include mat.tabs-theme($light-theme);

// Dark theme class
.dark-theme {
  @include mat.all-component-colors($dark-theme);
  @include mat.button-colors($dark-theme);
  @include mat.checkbox-colors($dark-theme);
  @include mat.form-field-colors($dark-theme);
  @include mat.icon-colors($dark-theme);
  @include mat.input-colors($dark-theme);
  @include mat.progress-spinner-colors($dark-theme);
  @include mat.slide-toggle-colors($dark-theme);
  @include mat.slider-colors($dark-theme);
  @include mat.tabs-colors($dark-theme);
}

// Custom density overrides
.mat-dense-button {
  @include mat.button-density(0);
}

// Custom typography
$custom-typography: mat.define-typography-config(
  $font-family: 'Roboto, sans-serif',
  $headline-1: mat.define-typography-level(112px, 112px, 300, 'Roboto', -0.0134em),
  $headline-2: mat.define-typography-level(56px, 56px, 400, 'Roboto', -0.007em),
  $headline-3: mat.define-typography-level(45px, 48px, 400, 'Roboto', 0em),
  $headline-4: mat.define-typography-level(34px, 40px, 400, 'Roboto', 0.0074em),
  $headline-5: mat.define-typography-level(24px, 32px, 400, 'Roboto', 0em),
  $headline-6: mat.define-typography-level(20px, 32px, 500, 'Roboto', 0.0015em),
  $subtitle-1: mat.define-typography-level(16px, 28px, 400, 'Roboto', 0.0094em),
  $subtitle-2: mat.define-typography-level(14px, 24px, 500, 'Roboto', 0.0063em),
  $body-1: mat.define-typography-level(16px, 24px, 400, 'Roboto', 0.005em),
  $body-2: mat.define-typography-level(14px, 24px, 400, 'Roboto', 0.0107em),
  $button: mat.define-typography-level(14px, 14px, 500, 'Roboto', 0.0893em),
  $caption: mat.define-typography-level(12px, 20px, 400, 'Roboto', 0.0333em),
  $overline: mat.define-typography-level(10px, 20px, 400, 'Roboto', 0.1667em),
);

@include mat.typography-hierarchy($custom-typography);
`;
  }

  private generateMaterialStyles() {
    return `// Custom Material component styles

// Override default Material styles
.mat-mdc-form-field {
  width: 100%;
}

.mat-mdc-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.mat-mdc-button-base {
  border-radius: 4px;
}

.mat-mdc-raised-button {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.mat-mdc-raised-button:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

// Accessibility improvements
.mat-mdc-button-focus-overlay {
  background-color: rgba(0, 0, 0, 0.12);
}

// High contrast mode support
@media (prefers-contrast: high) {
  .mat-mdc-button {
    border: 2px solid currentColor;
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .mat-mdc-menu-panel {
    transition: none !important;
  }

  .mat-mdc-slide-toggle {
    transition: none !important;
  }
}

// Dark mode toggle styles
.theme-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
}

// Custom elevation overrides
.mat-mdc-elevated-card {
  @include mat.elevation(2);
}

.mat-mdc-elevated-card:hover {
  @include mat.elevation(4);
}

// RTL support
[dir='rtl'] {
  .mat-mdc-icon-button {
    margin-left: 8px;
    margin-right: 0;
  }
}
`;
  }

  private generateThemeService() {
    return `import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type Theme = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);

  private readonly THEME_KEY = 'theme';
  private readonly storage = localStorage;

  // Current theme signal
  private currentTheme = signal<Theme>(this.getStoredTheme());

  // Computed theme (resolves 'auto' to system preference)
  readonly activeTheme = computed<'light' | 'dark'>(() => {
    const theme = this.currentTheme();
    if (theme === 'auto') {
      return this.getSystemTheme();
    }
    return theme;
  });

  // Computed observable for template binding
  readonly isDarkMode = computed(() => this.activeTheme() === 'dark');

  constructor() {
    this.applyTheme(this.activeTheme());
    this.listenForSystemChanges();
  }

  setTheme(theme: Theme) {
    this.currentTheme.set(theme);
    this.storage.setItem(this.THEME_KEY, theme);
    this.applyTheme(this.activeTheme());
  }

  toggleTheme() {
    const current = this.currentTheme();
    const themes: Theme[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(current);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    this.setTheme(nextTheme);
  }

  private getStoredTheme(): Theme {
    const stored = this.storage.getItem(this.THEME_KEY);
    if (stored && ['light', 'dark', 'auto'].includes(stored)) {
      return stored as Theme;
    }
    return 'auto';
  }

  private getSystemTheme(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: 'light' | 'dark') {
    const body = this.document.body;
    if (theme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
  }

  private listenForSystemChanges() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      if (this.currentTheme() === 'auto') {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handler);

    this.destroyRef.onDestroy(() => {
      mediaQuery.removeEventListener('change', handler);
    });
  }
}
`;
  }

  private generateThemeToggleComponent() {
    return `import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ThemeService } from '../../services/theme.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './theme-toggle.component.html',
  styleUrls: ['./theme-toggle.component.scss']
})
export class ThemeToggleComponent {
  private themeService = inject(ThemeService);

  currentTheme = toSignal(this.themeService.currentTheme, { initialValue: 'auto' as const });
  isDarkMode = this.themeService.isDarkMode;

  setTheme(theme: 'light' | 'dark' | 'auto') {
    this.themeService.setTheme(theme);
  }

  getThemeIcon(): string {
    switch (this.currentTheme()) {
      case 'light':
        return 'light_mode';
      case 'dark':
        return 'dark_mode';
      default:
        return 'brightness_auto';
    }
  }
}
`;
  }

  private generateThemeToggleComponentHtml() {
    return `<button mat-icon-button [matMenuTriggerFor]="themeMenu" aria-label="Toggle theme">
  <mat-icon>{{ getThemeIcon() }}</mat-icon>
</button>

<mat-menu #themeMenu="matMenu">
  <button mat-menu-item (click)="setTheme('light')">
    <mat-icon>light_mode</mat-icon>
    <span>Light</span>
  </button>
  <button mat-menu-item (click)="setTheme('dark')">
    <mat-icon>dark_mode</mat-icon>
    <span>Dark</span>
  </button>
  <button mat-menu-item (click)="setTheme('auto')">
    <mat-icon>brightness_auto</mat-icon>
    <span>Auto</span>
  </button>
</mat-menu>
`;
  }

  private generateTestSetup() {
    return `import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// Initialize test environment
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Additional test configuration
declare const require: {
  context(
    path: string,
    deep?: boolean,
    filter?: RegExp
  ): {
    keys(): string[];
    <T>(id: string): T;
  };
};

// Jasmine custom matchers
beforeEach(() => {
  jasmine.addMatchers({
    toBeInRange: () => {
      return {
        compare: (actual: number, min: number, max: number) => {
          const pass = actual >= min && actual <= max;
          return {
            pass,
            message: \`Expected \${actual} to be in range [\${min}, \${max}]\`
          };
        }
      };
    },
    toHaveText: () => {
      return {
        compare: (actual: HTMLElement, text: string) => {
          const pass = actual.textContent?.trim() === text;
          return {
            pass,
            message: \`Expected "\${actual.textContent?.trim()}" to equal "\${text}"\`
          };
        }
      };
    }
  });
});

// Global test utilities
(global as any).waitForAsync = (fn: () => void) => {
  return fn();
};
`;
  }

  private generateTestHelpers() {
    return `import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

/**
 * Enhanced test utilities for Angular components
 */

// Helper to create component with async detection
export function createComponent<T>(
  componentType: Type<T>,
  declarations?: Type<any>[],
  providers?: any[],
  imports?: any[]
  ): ComponentFixture<T> {
  TestBed.configureTestingModule({
    declarations: declarations || [],
    providers: providers || [],
    imports: imports || []
  });

  const fixture = TestBed.createComponent(componentType);
  fixture.detectChanges();
  return fixture;
}

// Helper to query by CSS selector
export function queryByCss<T>(
  fixture: ComponentFixture<T>,
  selector: string
): HTMLElement | null {
  return fixture.nativeElement.querySelector(selector);
}

// Helper to query all by CSS selector
export function queryAllByCss<T>(
  fixture: ComponentFixture<T>,
  selector: string
): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll(selector));
}

// Helper to query by debug element
export function queryByDebug<T>(
  fixture: ComponentFixture<T>,
  selector: string
): any {
  return fixture.debugElement.query(By.css(selector));
}

// Helper to dispatch event
export function dispatchEvent<T>(
  fixture: ComponentFixture<T>,
  element: HTMLElement,
  eventType: string
): void {
  const event = new Event(eventType, { bubbles: true });
  element.dispatchEvent(event);
  fixture.detectChanges();
}

// Helper to set input value
export function setInputValue(
  element: HTMLInputElement,
  value: string
): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// Helper to click element
export function clickElement(
  fixture: ComponentFixture<any>,
  element: HTMLElement
): void {
  element.click();
  fixture.detectChanges();
}

// Helper to wait for async
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to check if element has class
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

// Helper to get component instance
export function getComponentInstance<T>(
  fixture: ComponentFixture<T>
): T {
  return fixture.componentInstance;
}

// Helper to get debug element
export function getDebugElement<T>(
  fixture: ComponentFixture<T>,
  selector: string
): any {
  return fixture.debugElement.query(By.css(selector));
}

// Mock data helpers
export class MockData {
  static user(overrides = {}) {
    return {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      ...overrides
    };
  }

  static product(overrides = {}) {
    return {
      id: 1,
      name: 'Test Product',
      price: 99.99,
      description: 'Test description',
      ...overrides
    };
  }
}

// Mock service helpers
export function createMockService<T>(methods: string[]): T {
  const mock = {} as T;
  methods.forEach(method => {
    (mock as any)[method] = jasmine.createSpy(method);
  });
  return mock;
}

// Helper to test reactive forms
export function updateFormField(
  fixture: ComponentFixture<any>,
  controlName: string,
  value: any
): void {
  const input = fixture.debugElement.query(By.css(\`[formControlName="\${controlName}"]\`))
    || fixture.debugElement.query(By.css(\`[name="\${controlName}"]\`));

  if (input) {
    input.nativeElement.value = value;
    input.nativeElement.dispatchEvent(new Event('input'));
    input.nativeElement.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
}
`;
  }

  private generateGitIgnore() {
    return `# See http://help.github.com/ignore-files/ for more about ignoring files.

# Compiled output
/dist
/tmp
/out-tsc
/bazel-out

# Node
/node_modules
npm-debug.log
yarn-error.log

# IDEs and editors
.idea/
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace
.vscode/*

# Visual Studio Code
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
.history/*

# Miscellaneous
/.angular/cache
.sass-cache/
/connect.lock
/coverage
/libpeerconnection.log
testem.log
/typings

# System files
.DS_Store
Thumbs.db
`;
  }
}
