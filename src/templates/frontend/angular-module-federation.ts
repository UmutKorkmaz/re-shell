import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class AngularModuleFederationTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { normalizedName, name, port } = this.context;

    // Package.json with Angular and Module Federation dependencies
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Angular CLI configuration with Module Federation
    files.push({
      path: 'angular.json',
      content: this.generateAngularJson()
    });

    // Webpack config for Module Federation
    files.push({
      path: 'webpack.config.js',
      content: this.generateWebpackConfig()
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

    // Counter component for microfrontend demo
    files.push({
      path: 'src/app/counter/counter.component.ts',
      content: this.generateCounterComponent()
    });

    files.push({
      path: 'src/app/counter/counter.component.html',
      content: this.generateCounterComponentHtml()
    });

    files.push({
      path: 'src/app/counter/counter.component.scss',
      content: this.generateCounterComponentStyles()
    });

    // Remote component exposed for Module Federation
    files.push({
      path: 'src/app/remote/remote.component.ts',
      content: this.generateRemoteComponent()
    });

    files.push({
      path: 'src/app/remote/remote.component.html',
      content: this.generateRemoteComponentHtml()
    });

    files.push({
      path: 'src/app/remote/remote.component.scss',
      content: this.generateRemoteComponentStyles()
    });

    // NgRx Store for enterprise state management
    files.push({
      path: 'src/app/store/counter.reducer.ts',
      content: this.generateCounterReducer()
    });

    files.push({
      path: 'src/app/store/counter.actions.ts',
      content: this.generateCounterActions()
    });

    files.push({
      path: 'src/app/store/counter.selectors.ts',
      content: this.generateCounterSelectors()
    });

    files.push({
      path: 'src/app/store/index.ts',
      content: this.generateStoreIndex()
    });

    // Event bus for microfrontend communication
    files.push({
      path: 'src/app/utils/event-bus.ts',
      content: this.generateEventBus()
    });

    // Docker
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    files.push({
      path: '.dockerignore',
      content: this.generateDockerIgnore()
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

    // Env example
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    return files;
  }

  protected generatePackageJson() {
    const { normalizedName } = this.context;
    return {
      name: normalizedName,
      version: '1.0.0',
      scripts: {
        'ng': 'ng',
        'start': 'ng serve',
        'build': 'ng build',
        'watch': 'ng build --watch --configuration development',
        'test': 'ng test',
        'lint': 'ng lint'
      },
      private: true,
      dependencies: {
        '@angular/animations': '^17.0.0',
        '@angular/common': '^17.0.0',
        '@angular/core': '^17.0.0',
        '@angular/elements': '^17.0.0',
        '@angular/forms': '^17.0.0',
        '@angular/platform-browser': '^17.0.0',
        '@angular/platform-browser-dynamic': '^17.0.0',
        '@angular/router': '^17.0.0',
        '@ngrx/effects': '^17.0.0',
        '@ngrx/entity': '^17.0.0',
        '@ngrx/store': '^17.0.0',
        '@ngrx/store-devtools': '^17.0.0',
        'rxjs': '^7.8.0',
        'tslib': '^2.6.0',
        'zone.js': '^0.14.0'
      },
      devDependencies: {
        '@angular-architects/module-federation': '^17.0.0',
        '@angular-devkit/build-angular': '^17.0.0',
        '@angular/cli': '^17.0.0',
        '@angular/compiler-cli': '^17.0.0',
        '@types/node': '^20.10.0',
        '@typescript-eslint/eslint-plugin': '^6.13.0',
        '@typescript-eslint/parser': '^6.13.0',
        'eslint': '^8.55.0',
        'jasmine-core': '^5.1.0',
        'karma': '^6.4.0',
        'karma-chrome-launcher': '^3.2.0',
        'karma-coverage': '^2.2.0',
        'karma-jasmine': '^5.1.0',
        'karma-jasmine-html-reporter': '^2.1.0',
        'typescript': '^5.3.0',
        'webpack': '^5.89.0'
      }
    };
  }

  private generateAngularJson() {
    const { normalizedName, port } = this.context;
    const portValue = port || 4200;

    const buildTargetBase = `${normalizedName}:build`;
    const buildTargetProd = `${buildTargetBase}:production`;
    const buildTargetDev = `${buildTargetBase}:development`;

    const architect: any = {
      build: {
        builder: '@angular-devkit/build-angular:browser',
        options: {
          outputPath: 'dist/' + normalizedName,
          index: 'src/index.html',
          main: 'src/main.ts',
          polyfills: ['zone.js'],
          tsConfig: 'tsconfig.app.json',
          assets: [
            'src/favicon.ico',
            'src/assets'
          ],
          styles: [
            'src/styles.scss'
          ],
          scripts: []
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
        options: {
          port: portValue
        },
        configurations: {
          production: {
            buildTarget: buildTargetProd
          },
          development: {
            buildTarget: buildTargetDev
          }
        },
        defaultConfiguration: 'development'
      },
      'extract-i18n': {
        builder: '@angular-devkit/build-angular:extract-i18n',
        options: {
          buildTarget: buildTargetBase
        }
      },
      test: {
        builder: '@angular-devkit/build-angular:karma',
        options: {
          polyfills: ['zone.js', 'zone.js/testing'],
          tsConfig: 'tsconfig.spec.json',
          assets: [
            'src/favicon.ico',
            'src/assets'
          ],
          styles: [
            'src/styles.scss'
          ],
          scripts: []
        }
      },
      lint: {
        builder: '@angular-eslint/builder:lint',
        options: {
          lintFilePatterns: [
            'src/**/*.ts',
            'src/**/*.html'
          ]
        }
      }
    };

    const projects: any = {};
    projects[normalizedName] = {
      projectType: 'application',
      root: '',
      sourceRoot: 'src',
      prefix: 'app',
      architect: architect
    };

    return JSON.stringify({
      '$schema': './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      newProjectRoot: 'projects',
      projects: projects
    }, null, 2);
  }

  private generateWebpackConfig() {
    const { normalizedName, port } = this.context;
    const portValue = port || 4200;
    return `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const mf = require('@angular-architects/module-federation/webpack');

module.exports = {
  output: {
    uniqueName: '${normalizedName}',
    publicPath: 'http://localhost:${portValue}/'
  },

  optimization: {
    runtimeChunk: false
  },

  plugins: [
    new ModuleFederationPlugin({
      name: '${normalizedName}',
      filename: 'remoteEntry.js',
      exposes: {
        './CounterComponent': './src/app/counter/counter.component',
        './RemoteComponent': './src/app/remote/remote.component'
      },
      remotes: {
        // Configure remote microfrontends here
        // mf1: 'mf1@http://localhost:4201/remoteEntry.js',
      },
      shared: {
        '@angular/core': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '^17.0.0'
        },
        '@angular/common': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '^17.0.0'
        },
        '@angular/router': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '^17.0.0'
        },
        '@angular/platform-browser': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '^17.0.0'
        },
        '@ngrx/store': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '^17.0.0'
        },
        'rxjs': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '^7.8.0'
        },
        'zone.js': {
          singleton: true,
          strictVersion: true,
          requiredVersion: '^0.14.0'
        }
      }
    })
  ]
};
`;
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
        esModuleInterop: true,
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
      files: ['src/test.ts', 'src/polyfills.ts'],
      include: ['src/**/*.spec.ts', 'src/**/*.d.ts']
    }, null, 2);
  }

  private generateMain() {
    return `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import './styles.scss';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

// Microfrontend event listeners
window.addEventListener('counter-update', (event: any) => {
  if (event.detail.type === 'COUNTER_UPDATE') {
    console.log('Counter update received:', event.detail.value);
  }
});
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
</head>
<body>
  <app-root></app-root>
</body>
</html>
`;
  }

  private generateStyles() {
    return `/* Global Styles */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

app-root {
  display: block;
  min-height: 100vh;
}
`;
  }

  private generateAppConfig() {
    return `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { counterReducer } from './store/counter.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter([]),
    provideStore({ counter: counterReducer }),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !import.meta.env.DEV
    })
  ]
};
`;
  }

  private generateAppComponent() {
    return `import { Component, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import * as CounterActions from './store/counter.actions';
import { selectCount } from './store/counter.selectors';
import { CounterComponent } from './counter/counter.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, CounterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  readonly title = 'Angular Module Federation Microfrontend';
  readonly count = signal(0);

  constructor(private store: Store) {
    // Reactive effect for counter changes
    effect(() => {
      console.log(\`Count changed to: \${this.count()}\`);
    });
  }

  ngOnInit() {
    // Subscribe to NgRx store
    this.store.select(selectCount).subscribe(value => {
      this.count.set(value);
    });
  }
}
`;
  }

  private generateAppComponentHtml() {
    return `<div class="app">
  <header class="header">
    <div class="header-content">
      <h1>🚀 {{ title }}</h1>
      <p>Enterprise-grade microfrontend architecture with Angular 17 + Webpack Module Federation</p>
    </div>
  </header>

  <main class="main">
    <section class="features">
      <div class="feature-card">
        <h2>⚡ Module Federation 2.0</h2>
        <p>Dynamic component loading with Webpack 5</p>
      </div>
      <div class="feature-card">
        <h2>🔄 NgRx State Management</h2>
        <p>Enterprise-grade state with effects and entities</p>
      </div>
      <div class="feature-card">
        <h2>🎯 Angular Signals</h2>
        <p>Fine-grained reactivity with standalone components</p>
      </div>
    </section>

    <section class="counter-section">
      <h2>Shared Counter (Microfrontend Demo)</h2>
      <app-counter></app-counter>
    </section>

    <section class="info-section">
      <h2>📝 Module Federation Configuration</h2>
      <p>Check <code>webpack.config.js</code> for Module Federation setup:</p>
      <ul>
        <li>Remote Entry: <code>http://localhost:${this.context.port || 4200}/remoteEntry.js</code></li>
        <li>Exposes: CounterComponent, RemoteComponent</li>
        <li>Shared: Angular Core, Router, NgRx, RxJS</li>
      </ul>
    </section>

    <section class="ngrx-section">
      <h2>🔧 NgRx DevTools</h2>
      <p>Install Redux DevTools extension to inspect state changes</p>
      <div class="state-display">
        <h3>Current Count: {{ count() }}</h3>
      </div>
    </section>
  </main>

  <footer class="footer">
    <p>Built with Angular 17, Webpack 5, Module Federation, and NgRx</p>
  </footer>
</div>
`;
  }

  private generateAppComponentStyles() {
    return `.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #dd0031 0%, #c3002f 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.header-content h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card {
  padding: 2rem;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: center;
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.counter-section,
.info-section,
.ngrx-section {
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.state-display {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 4px;
}

.footer {
  background: #1976d2;
  color: white;
  padding: 1.5rem;
  text-align: center;
}

code {
  background: #e0e0e0;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}
`;
  }

  private generateCounterComponent() {
    return `import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import * as CounterActions from '../store/counter.actions';
import { selectCount } from '../store/counter.selectors';

@Component({
  selector: 'app-counter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './counter.component.html',
  styleUrls: ['./counter.component.scss']
})
export class CounterComponent implements OnInit, OnDestroy {
  readonly count = signal(0);
  readonly doubleCount = computed(() => this.count() * 2);

  constructor(private store: Store) {}

  ngOnInit() {
    this.store.select(selectCount).subscribe(value => {
      this.count.set(value);
    });
  }

  increment() {
    this.store.dispatch(CounterActions.increment());
    this.emitCounterUpdate();
  }

  decrement() {
    this.store.dispatch(CounterActions.decrement());
    this.emitCounterUpdate();
  }

  reset() {
    this.store.dispatch(CounterActions.reset());
    this.emitCounterUpdate();
  }

  private emitCounterUpdate() {
    window.dispatchEvent(new CustomEvent('counter-update', {
      detail: { type: 'COUNTER_UPDATE', value: this.count() }
    }));
  }

  ngOnDestroy() {
    // Cleanup if needed
  }
}
`;
  }

  private generateCounterComponentHtml() {
    return `<div class="counter-wrapper">
  <div class="counter-display">
    <span class="count">{{ count() }}</span>
    <span class="label">Count</span>
  </div>
  <div class="stats">
    <div class="stat">
      <span class="stat-value">{{ doubleCount() }}</span>
      <span class="stat-label">Double</span>
    </div>
  </div>
  <div class="counter-controls">
    <button (click)="decrement()" class="btn btn-decrement">-</button>
    <button (click)="reset()" class="btn btn-reset">Reset</button>
    <button (click)="increment()" class="btn btn-increment">+</button>
  </div>
</div>
`;
  }

  private generateCounterComponentStyles() {
    return `.counter-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.counter-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.count {
  font-size: 3rem;
  font-weight: bold;
  color: #dd0031;
}

.label {
  font-size: 0.875rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats {
  display: flex;
  gap: 2rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1976d2;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
}

.counter-controls {
  display: flex;
  gap: 1rem;
}

.btn {
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-increment {
  background: #dd0031;
  color: white;
}

.btn-increment:hover {
  background: #c3002f;
  transform: scale(1.1);
}

.btn-decrement {
  background: #1976d2;
  color: white;
}

.btn-decrement:hover {
  background: #1565c0;
  transform: scale(1.1);
}

.btn-reset {
  background: #757575;
  color: white;
  width: 80px;
  border-radius: 30px;
}

.btn-reset:hover {
  background: #616161;
  transform: scale(1.05);
}
`;
  }

  private generateRemoteComponent() {
    return `import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CounterComponent } from '../counter/counter.component';

@Component({
  selector: 'app-remote',
  standalone: true,
  imports: [CommonModule, CounterComponent],
  templateUrl: './remote.component.html',
  styleUrls: ['./remote.component.scss']
})
export class RemoteComponent {
  readonly message = signal('This component can be consumed by other microfrontends');
}
`;
  }

  private generateRemoteComponentHtml() {
    return `<div class="remote-container">
  <h3>📦 Remote Component</h3>
  <p>{{ message() }}</p>
  <app-counter></app-counter>
</div>
`;
  }

  private generateRemoteComponentStyles() {
    return `.remote-container {
  padding: 2rem;
  background: white;
  border-radius: 8px;
  border-left: 4px solid #dd0031;
}

.remote-container h3 {
  margin-top: 0;
  color: #dd0031;
}
`;
  }

  private generateCounterReducer() {
    return `import { createReducer, on } from '@ngrx/store';
import * as CounterActions from './counter.actions';

export interface CounterState {
  count: number;
}

export const initialState: CounterState = {
  count: 0
};

export const counterReducer = createReducer(
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
  }))
);
`;
  }

  private generateCounterActions() {
    return `import { createAction } from '@ngrx/store';

export const increment = createAction('[Counter] Increment');
export const decrement = createAction('[Counter] Decrement');
export const reset = createAction('[Counter] Reset');
`;
  }

  private generateCounterSelectors() {
    return `import { createFeature, createSelector, Store } from '@ngrx/store';
import { counterReducer, CounterState } from './counter.reducer';

export const COUNTER_FEATURE_KEY = 'counter';

export const counterFeature = createFeature<{
  [COUNTER_FEATURE_KEY]: CounterState
}, CounterState>({
  name: COUNTER_FEATURE_KEY,
  reducer: counterReducer
});

export const selectCount = counterFeature.selectCount;
export const selectCounterState = counterFeature.selectCounterState;
`;
  }

  private generateStoreIndex() {
    return `export * from './counter.reducer';
export * from './counter.actions';
export * from './counter.selectors';
`;
  }

  private generateEventBus() {
    return `// Event bus for microfrontend communication

export interface CounterUpdateEvent {
  type: 'COUNTER_UPDATE';
  value: number;
}

export const eventBus = {
  emit(event: string, detail: any) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  },

  on(event: string, callback: (detail: any) => void) {
    const handler = (e: any) => callback(e.detail);
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  }
};

// Helper functions for counter updates
export const emitCounterUpdate = (value: number): void => {
  eventBus.emit('counter-update', { type: 'COUNTER_UPDATE', value });
};

export const onCounterUpdate = (callback: (value: number) => void): (() => void) => {
  return eventBus.on('counter-update', (detail: CounterUpdateEvent) => {
    if (detail.type === 'COUNTER_UPDATE') {
      callback(detail.value);
    }
  });
};
`;
  }

  private generateDockerfile() {
    return `# Multi-stage Dockerfile for Angular Module Federation

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration for SPA with Module Federation
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
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
        try_files \\\\$uri \\\\$uri/ /index.html;
    }

    # Cache remoteEntry.js and other JS files
    location ~* \\\\\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\\\\\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # CORS for Module Federation
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
}
EOF

EXPOSE 80

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
`;
  }

  protected generateReadme() {
    const { name, description, packageManager, port } = this.context;
    return `# ${name}

${description || 'Angular Module Federation Microfrontend'}

## Features

- ⚡ **Webpack Module Federation 2.0**
- 🔄 **Dynamic Remote Loading**
- 🎯 **Angular 17 Standalone Components**
- 🔥 **Angular Signals for Reactivity**
- 📦 **NgRx State Management**
- 🎨 **SCSS Styling**
- 🐳 **Docker Support**

## Quick Start

\`\`\`bash
# Install dependencies
${packageManager} install

# Start development server
${packageManager} start

# Build for production
${packageManager} run build

# Run tests
${packageManager} test

# Run linter
${packageManager} run lint
\`\`\`

## Module Federation Setup

### As a Host (Consumer)

To consume remote microfrontends, update \`webpack.config.js\`:

\`\`\`javascript
remotes: {
  mf1: 'mf1@http://localhost:4201/remoteEntry.js',
  mf2: 'mf2@http://localhost:4202/remoteEntry.js'
}
\`\`\`

### Load Remote Component

\`\`\`typescript
import { loadRemoteModule } from '@angular-architects/module-federation';

const routes = [
  {
    path: 'remote',
    loadChildren: () => loadRemoteModule({
      type: 'module',
      remoteEntry: 'http://localhost:4201/remoteEntry.js',
      exposedModule: './RemoteComponent'
    }).then(m => m.RemoteComponentModule)
  }
];
\`\`\`

### As a Remote (Provider)

This microfrontend exposes:
- \`./CounterComponent\` - Shared counter component with NgRx
- \`./RemoteComponent\` - Remote container component

Remote Entry URL: \`http://localhost:${port || 4200}/remoteEntry.js\`

## NgRx State Management

### Actions

\`\`\`typescript
import * as CounterActions from './store/counter.actions';

store.dispatch(CounterActions.increment());
store.dispatch(CounterActions.decrement());
store.dispatch(CounterActions.reset());
\`\`\`

### Selectors

\`\`\`typescript
import { selectCount } from './store/counter.selectors';

store.select(selectCount).subscribe(count => {
  console.log('Current count:', count);
});
\`\`\`

## Microfrontend Communication

Components communicate via Custom Events:

\`\`\`typescript
// Emit event
window.dispatchEvent(new CustomEvent('counter-update', {
  detail: { type: 'COUNTER_UPDATE', value: 123 }
}));

// Listen for events
window.addEventListener('counter-update', (event) => {
  console.log(event.detail.value);
});
\`\`\`

## Docker

\`\`\`bash
# Build and run
docker build -t ${name} .
docker run -p 80:80 ${name}
\`\`\`

## Angular Architecture

- **Standalone Components**: No NgModules needed
- **Signals**: Fine-grained reactivity
- **NgRx**: Enterprise state management
- **Lazy Loading**: On-demand component loading
- **Module Federation**: Dynamic microfrontend integration

## Resources

- [Angular Documentation](https://angular.io)
- [Module Federation for Angular](https://www.angulararchitects.io/enaktuelles/module-federation-in-angular/)
- [NgRx](https://ngrx.io)
- [Angular Signals](https://angular.io/guide/signals)

## License

MIT
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

  private generateEnvExample() {
    const { port } = this.context;
    return `# Module Federation Configuration
PORT=${port || 4200}

# Remote Microfrontends (configure as needed)
# REMOTE_MF1=http://localhost:4201
# REMOTE_MF2=http://localhost:4202
`;
  }
}
