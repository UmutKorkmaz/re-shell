import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class AngularTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Angular config
    files.push({
      path: 'angular.json',
      content: this.generateAngularJson()
    });

    // TypeScript config
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

    // App component (standalone)
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

    // Home component
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

    // About component
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

    // Core components (header, footer)
    files.push({
      path: 'src/app/core/header/header.component.ts',
      content: this.generateHeaderComponent()
    });

    files.push({
      path: 'src/app/core/header/header.component.html',
      content: this.generateHeaderComponentHtml()
    });

    files.push({
      path: 'src/app/core/header/header.component.scss',
      content: this.generateHeaderComponentStyles()
    });

    files.push({
      path: 'src/app/core/footer/footer.component.ts',
      content: this.generateFooterComponent()
    });

    files.push({
      path: 'src/app/core/footer/footer.component.html',
      content: this.generateFooterComponentHtml()
    });

    files.push({
      path: 'src/app/core/footer/footer.component.scss',
      content: this.generateFooterComponentStyles()
    });

    // Service
    files.push({
      path: 'src/app/services/api.service.ts',
      content: this.generateApiService()
    });

    // Signals
    files.push({
      path: 'src/app/signals/state.signal.ts',
      content: this.generateStateSignal()
    });

    // Interceptor
    files.push({
      path: 'src/app/interceptors/api.interceptor.ts',
      content: this.generateApiInterceptor()
    });

    // Routes
    files.push({
      path: 'src/app/app.routes.ts',
      content: this.generateRoutes()
    });

    // Environment
    files.push({
      path: 'src/environments/environment.ts',
      content: this.generateEnvironment()
    });

    files.push({
      path: 'src/environments/environment.prod.ts',
      content: this.generateEnvironmentProd()
    });

    // Component tests
    files.push({
      path: 'src/app/app.component.spec.ts',
      content: this.generateAppComponentSpec()
    });

    // Karma config
    files.push({
      path: 'karma.conf.js',
      content: this.generateKarmaConfig()
    });

    // Environment files
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Dockerfile
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Docker Compose
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.1.0',
      description: this.context.description,
      scripts: {
        ng: 'ng',
        start: 'ng serve',
        build: 'ng build',
        watch: 'ng build --watch --configuration development',
        test: 'ng test',
        lint: 'ng lint',
        e2e: 'ng e2e'
      },
      private: true,
      dependencies: {
        '@angular/animations': '^17.3.0',
        '@angular/common': '^17.3.0',
        '@angular/compiler': '^17.3.0',
        '@angular/core': '^17.3.0',
        '@angular/forms': '^17.3.0',
        '@angular/platform-browser': '^17.3.0',
        '@angular/platform-browser-dynamic': '^17.3.0',
        '@angular/router': '^17.3.0',
        'rxjs': '^7.8.1',
        'tslib': '^2.6.2',
        'zone.js': '^0.14.4'
      },
      devDependencies: {
        '@angular-devkit/build-angular': '^17.3.0',
        '@angular/cli': '^17.3.0',
        '@angular/compiler-cli': '^17.3.0',
        '@types/jasmine': '~5.1.0',
        '@types/node': '^20.11.0',
        'jasmine-core': '~5.1.0',
        'karma': '~6.4.0',
        'karma-chrome-launcher': '~3.2.0',
        'karma-coverage': '~2.2.0',
        'karma-jasmine': '~5.1.0',
        'karma-jasmine-html-reporter': '~2.1.0',
        'typescript': '~5.4.2'
      }
    };
  }

  protected generateAngularJson() {
    const projectName = this.context.normalizedName;
    return JSON.stringify({
      '$schema': './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      newProjectRoot: 'projects',
      projects: {
        [projectName]: {
          projectType: 'application',
          root: '',
          sourceRoot: 'src',
          prefix: 'app',
          architect: {
            build: {
              builder: '@angular-devkit/build-angular:application',
              options: {
                outputPath: `dist/${projectName}`,
                index: 'src/index.html',
                browser: 'src/main.ts',
                polyfills: ['zone.js'],
                tsConfig: 'tsconfig.app.json',
                assets: ['src/favicon.ico', 'src/assets'],
                styles: ['src/styles.scss'],
                scripts: []
              },
              configurations: {
                production: {
                  budgets: [
                    {
                      type: 'initial',
                      maximumWarning: '2mb',
                      maximumError: '5mb'
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
                  optimization: false,
                  extractLicenses: false,
                  sourceMap: true
                }
              },
              defaultConfiguration: 'production'
            },
            serve: {
              builder: '@angular-devkit/build-angular:dev-server',
              options: {
                buildTarget: `${projectName}:build`
              },
              configurations: {
                production: {
                  buildTarget: `${projectName}:build:production`
                },
                development: {
                  buildTarget: `${projectName}:build:development`
                }
              }
            },
            'extract-i18n': {
              builder: '@angular-devkit/build-angular:extract-i18n',
              options: {
                buildTarget: `${projectName}:build`
              }
            },
            test: {
              builder: '@angular-devkit/build-angular:karma',
              options: {
                polyfills: ['zone.js', 'zone.js/testing'],
                tsConfig: 'tsconfig.spec.json',
                assets: ['src/favicon.ico', 'src/assets'],
                styles: ['src/styles.scss'],
                scripts: []
              }
            }
          }
        }
      }
    }, null, 2);
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compileOnSave: false,
      compilerOptions: {
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
      files: ['src/main.ts', 'src/polyfills.ts'],
      include: ['src/**/*.spec.ts', 'src/**/*.d.ts']
    }, null, 2);
  }

  protected generateMain() {
    return `import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient()
  ]
}).catch((err) => console.error(err));
`;
  }

  protected generateIndexHtml() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${this.context.name}</title>
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

  protected generateStyles() {
    return `/* Global Styles */

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
`;
  }

  protected generateAppComponent() {
    return `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './core/header/header.component';
import { FooterComponent } from './core/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = '${this.context.name}';
}
`;
  }

  protected generateAppComponentHtml() {
    return `<app-header />
<main class="main-content">
  <router-outlet />
</main>
<app-footer />
`;
  }

  protected generateAppComponentStyles() {
    return `:host {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}
`;
  }

  protected generateHomeComponent() {
    return `import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { StateSignal } from '../../signals/state.signal';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private apiService = inject(ApiService);
  private stateSignal = inject(StateSignal);

  // Signals
  readonly counter = signal(0);
  readonly doubleCounter = computed(() => this.counter() * 2);

  // Data signal
  readonly data = signal<any[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.loadData();
  }

  increment() {
    this.counter.update(v => v + 1);
  }

  decrement() {
    this.counter.update(v => v - 1);
  }

  reset() {
    this.counter.set(0);
  }

  async loadData() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.apiService.getData();
      this.data.set(response);
    } catch (err) {
      this.error.set('Failed to load data');
    } finally {
      this.loading.set(false);
    }
  }
}
`;
  }

  protected generateHomeComponentHtml() {
    return `<div class="home-container">
  <div class="hero">
    <h1>Welcome to ${this.context.name}</h1>
    <p>An Angular application with standalone components and signals</p>
  </div>

  <section class="features">
    <h2>Angular 17+ Features</h2>

    <div class="feature-grid">
      <div class="feature-card">
        <h3>⚡ Signals</h3>
        <p>Reactive primitives for state management</p>
        <div class="counter-demo">
          <p>Counter: {{ counter() }}</p>
          <p>Double: {{ doubleCounter() }}</p>
          <button (click)="increment()">+</button>
          <button (click)="decrement()">-</button>
          <button (click)="reset()">Reset</button>
        </div>
      </div>

      <div class="feature-card">
        <h3>🎯 Standalone Components</h3>
        <p>No NgModule required</p>
        <p>Components are self-contained and reusable</p>
      </div>

      <div class="feature-card">
        <h3>🔄 New Control Flow</h3>
        <p>@if, @for, @switch syntax</p>
        <p>More intuitive and type-safe</p>
      </div>

      <div class="feature-card">
        <h3>💉 Dependency Injection</h3>
        <p>inject() function</p>
        <p>Works anywhere, not just constructors</p>
      </div>
    </div>
  </section>

  <section class="data-section">
    <h2>API Data</h2>

    @if (loading()) {
      <p class="loading">Loading...</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else {
      <div class="data-list">
        @for (item of data(); track item.id) {
          <div class="data-item">
            {{ item.name }}
          </div>
        } @empty {
          <p>No data available</p>
        }
      </div>
    }
  </section>

  <section class="cta-section">
    <h2>Get Started</h2>
    <p>Explore the application and discover Angular's modern features</p>
    <a routerLink="/about" class="btn btn-primary">Learn More</a>
  </section>
</div>
`;
  }

  protected generateAboutComponent() {
    return `import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  projectName = '${this.context.name}';
  projectDescription = '${this.context.description}';
}
`;
  }

  protected generateAboutComponentHtml() {
    return `<div class="about-container">
  <div class="about-header">
    <h1>About {{ projectName }}</h1>
    <p>{{ projectDescription }}</p>
  </div>

  <section class="tech-stack">
    <h2>Tech Stack</h2>
    <ul>
      <li><strong>Angular 17+</strong> - Modern web framework</li>
      <li><strong>TypeScript</strong> - Type-safe JavaScript</li>
      <li><strong>Signals</strong> - Reactive state management</li>
      <li><strong>Standalone Components</strong> - Module-free architecture</li>
      <li><strong>Angular Router</strong> - Client-side routing</li>
      <li><strong>HTTP Client</strong> - API communication</li>
    </ul>
  </section>

  <section class="features-list">
    <h2>Key Features</h2>

    <div class="feature-item">
      <h3>🎯 Standalone Components</h3>
      <p>Components are self-contained with their own imports. No NgModule required.</p>
      <pre><code>@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html'
})</code></pre>
    </div>

    <div class="feature-item">
      <h3>⚡ Signals</h3>
      <p>Reactive primitives for managing state with fine-grained reactivity.</p>
      <pre><code>const counter = signal(0);
const double = computed(() => counter() * 2);
counter.update(v => v + 1);</code></pre>
    </div>

    <div class="feature-item">
      <h3>🔄 New Control Flow</h3>
      <p>Intuitive and type-safe built-in control flow syntax.</p>
      <pre><code>@if (condition) {
  <p>Content</p>
} @else {
  <p>Alternative</p>
}

@for (item of items; track item.id) {
  <li>{{ item.name }}</li>
}</code></pre>
    </div>

    <div class="feature-item">
      <h3>💉 Injectable Functions</h3>
      <p>Create providers without classes using injection functions.</p>
      <pre><code>export const provideApiService = () => ({
  provide: ApiService,
  useClass: ApiService
});</code></pre>
    </div>
  </section>

  <section class="cta-section">
    <p>
      <a routerLink="/" class="btn btn-secondary">Back to Home</a>
    </p>
  </section>
</div>
`;
  }

  protected generateHeaderComponent() {
    return `import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  constructor(private router: Router) {}

  isActive(route: string): boolean {
    return this.router.url === route;
  }
}
`;
  }

  protected generateHeaderComponentHtml() {
    return `<header class="header">
  <div class="header-container">
    <div class="logo">
      <a routerLink="/" class="logo-link">
        <span class="logo-icon">🅰️</span>
        <span class="logo-text">${this.context.name}</span>
      </a>
    </div>

    <nav class="nav">
      <a
        routerLink="/"
        routerLinkActive="active"
        [class.active]="isActive('/')"
        class="nav-link">
        Home
      </a>
      <a
        routerLink="/about"
        routerLinkActive="active"
        [class.active]="isActive('/about')"
        class="nav-link">
        About
      </a>
    </nav>
  </div>
</header>
`;
  }

  protected generateFooterComponent() {
    return `import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
`;
  }

  protected generateFooterComponentHtml() {
    return `<footer class="footer">
  <div class="footer-container">
    <p>&copy; {{ currentYear }} ${this.context.name}. Built with Angular.</p>
    <p class="footer-links">
      <a href="https://angular.dev" target="_blank" rel="noopener">Angular Docs</a>
      <span>•</span>
      <a href="https://github.com/angular/angular" target="_blank" rel="noopener">GitHub</a>
    </p>
  </div>
</footer>
`;
  }

  protected generateApiService() {
    return `import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private apiUrl = 'https://jsonplaceholder.typicode.com';

  // State with signals
  private loadingSignal = signal(false);
  readonly loading = this.loadingSignal.asReadonly();

  constructor() {
    console.log('ApiService initialized with inject()');
  }

  getData(): Observable<any[]> {
    this.loadingSignal.set(true);
    return this.http.get<any[]>(\`\${this.apiUrl}/posts?_limit=5\`);
  }

  getDataById(id: number): Observable<any> {
    return this.http.get<any>(\`\${this.apiUrl}/posts/\${id}\`);
  }

  createData(data: any): Observable<any> {
    return this.http.post<any>(\`\${this.apiUrl}/posts\`, data);
  }

  updateData(id: number, data: any): Observable<any> {
    return this.http.put<any>(\`\${this.apiUrl}/posts/\${id}\`, data);
  }

  deleteData(id: number): Observable<void> {
    return this.http.delete<void>(\`\${this.apiUrl}/posts/\${id}\`);
  }
}
`;
  }

  protected generateStateSignal() {
    return `import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from '../services/api.service';

@Injectable({
  providedIn: 'root'
})
export class StateSignal {
  private apiService = inject(ApiService);

  // Global state signals
  private readonly counterSignal = signal(0);
  private readonly userSignal = signal<any | null>(null);
  private readonly themeSignal = signal<'light' | 'dark'>('light');

  // Computed signals
  readonly doubleCounter = computed(() => this.counterSignal() * 2);

  // Public read-only signals
  readonly counter = this.counterSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly theme = this.themeSignal.asReadonly();

  // Actions
  incrementCounter() {
    this.counterSignal.update(v => v + 1);
  }

  decrementCounter() {
    this.counterSignal.update(v => v - 1);
  }

  resetCounter() {
    this.counterSignal.set(0);
  }

  setUser(user: any) {
    this.userSignal.set(user);
  }

  clearUser() {
    this.userSignal.set(null);
  }

  toggleTheme() {
    this.themeSignal.update(t => t === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: 'light' | 'dark') {
    this.themeSignal.set(theme);
  }
}
`;
  }

  protected generateApiInterceptor() {
    return `import { inject } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptorFn,
  HttpHandlerFn,
  HttpRequest,
  HttpErrorResponse
} from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';

export const apiInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  // Clone the request and add headers
  const authReq = req.clone({
    setHeaders: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'Angular-App'
    }
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      console.error('API Error:', error);

      if (error.status === 401) {
        console.error('Unauthorized access');
      }

      return throwError(() => error);
    })
  );
};
`;
  }

  protected generateRoutes() {
    return `import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then(m => m.HomeComponent),
    title: '${this.context.name}'
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./about/about.component').then(m => m.AboutComponent),
    title: 'About'
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  }
];
`;
  }

  protected generateEnvironment() {
    return `export const environment = {
  production: false,
  apiUrl: 'https://jsonplaceholder.typicode.com'
};
`;
  }

  protected generateEnvironmentProd() {
    return `export const environment = {
  production: true,
  apiUrl: 'https://api.example.com'
};
`;
  }

  protected generateAppComponentSpec() {
    return `import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterTestingModule]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(\`should have the '${this.context.name}' title\`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('${this.context.name}');
  });
});
`;
  }

  protected generateKarmaConfig() {
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
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with random: false
        // or set a specific seed with seed: 4321
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/${this.context.normalizedName}'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    restartOnFileChange: true,
    autoWatch: true,
    singleRun: false
  });
};
`;
  }

  protected generateEnvExample() {
    return `# Angular Environment Variables
# https://angular.dev/guide/environment-variables

# API Configuration
API_URL=https://api.example.com
API_KEY=your-api-key-here

# Feature Flags
FEATURE_DARKMODE=false
FEATURE_I18N=true

# Build Configuration
NODE_ENV=development
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Angular 17+ - a modern web framework with standalone components, signals, and enhanced developer experience.

## Features

- **Angular 17+** - Latest Angular with standalone components
- **Signals** - Fine-grained reactivity for state management
- **Standalone Components** - No NgModules required
- **TypeScript** - Full type safety
- **Angular Router** - Client-side routing with lazy loading
- **HTTP Client** - API communication with interceptors
- **New Control Flow** - @if, @for, @switch syntax
- **Functional Guards** - Type-safe route guards
- **Dependency Injection** - Modern inject() function
- **ESBuild** - Fast builds with esbuild-based builder

## Getting Started

### Installation

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### Development

\`\`\`bash
npm start
# or
ng serve
\`\`\`

Open [http://localhost:4200](http://localhost:4200) in your browser.

### Build

\`\`\`bash
npm run build
# or
ng build
\`\`\`

The build artifacts will be stored in the \`dist/\` directory.

### Testing

\`\`\`bash
# Unit tests
npm test
# or
ng test

# e2e tests
npm run e2e
# or
ng e2e
\`\`\`

### Linting

\`\`\`bash
npm run lint
# or
ng lint
\`\`\`

## Angular Signals

Signals provide reactive state management:

\`\`\`typescript
import { signal, computed, inject } from '@angular/core';

// Writable signal
const counter = signal(0);
counter.update(v => v + 1);
counter.set(10);

// Computed signal
const double = computed(() => counter() * 2);

// Effect
effect(() => {
  console.log('Counter:', counter());
});
\`\`\`

## Standalone Components

Components are self-contained:

\`\`\`typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html'
})
export class HomeComponent {}
\`\`\`

## New Control Flow

Intuitive and type-safe:

\`\`\`html
@if (condition) {
  <p>Content</p>
} @else if (otherCondition) {
  <p>Alternative</p>
} @else {
  <p>Default</p>
}

@for (item of items; track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>No items</li>
}

@switch (condition) {
  @case (1) { <p>One</p> }
  @case (2) { <p>Two</p> }
  @default { <p>Other</p> }
}
\`\`\`

## Dependency Injection

Use \`inject()\` function:

\`\`\`typescript
import { inject } from '@angular/core';
import { ApiService } from './api.service';

export class HomeComponent {
  private apiService = inject(ApiService);

  loadData() {
    this.apiService.getData().subscribe(data => {
      console.log(data);
    });
  }
}
\`\`\`

## Routing

Lazy-loaded routes:

\`\`\`typescript
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./home/home.component').then(m => m.HomeComponent),
    title: 'Home'
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./about/about.component').then(m => m.AboutComponent),
    title: 'About'
  }
];
\`\`\`

## HTTP Client

API communication with interceptors:

\`\`\`typescript
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getData() {
    return this.http.get<any[]>('https://api.example.com/data');
  }
}
\`\`\`

## Docker

### Build

\`\`\`bash
docker build -t ${this.context.normalizedName} .
\`\`\`

### Run

\`\`\`bash
docker run -p 80:80 ${this.context.normalizedName}
\`\`\`

### Docker Compose

\`\`\`bash
docker-compose up
\`\`\`

## Deployment

Deploy to any hosting service:

- **Vercel**: Zero-config deployment
- **Netlify**: Full-stack support
- **AWS**: S3, CloudFront, Amplify
- **Google Cloud**: Firebase, App Engine
- **Azure**: Static Web Apps
- **GitHub Pages**: Static hosting

\`\`\`bash
# Build for production
npm run build

# Output in dist/ directory
\`\`\`

## Documentation

- [Angular Documentation](https://angular.dev)
- [Angular Signals](https://angular.dev/guide/signals)
- [Standalone Components](https://angular.dev/guide/standalone-components)
- [Angular Router](https://angular.dev/guide/router)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Angular SPA

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=build /app/dist/${this.context.normalizedName} /usr/share/nginx/html
COPY nginx-custom.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
`;
  }

  protected generateHomeComponentStyles() {
    return `.home-container {
  padding: 20px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.feature-card {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.counter-demo {
  margin-top: 20px;
}

.loading {
  color: #666;
}

.error {
  color: #f44336;
}
`;
  }

  protected generateAboutComponentStyles() {
    return `.about-container {
  padding: 20px;
}

.tech-stack ul {
  list-style: none;
  padding: 0;
}

.tech-stack li {
  padding: 8px 0;
}

.feature-item {
  margin: 30px 0;
}

.feature-item h3 {
  color: #1976d2;
}

pre {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
}
`;
  }

  protected generateHeaderComponentStyles() {
    return `.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #1976d2;
  color: white;
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
}

nav a {
  color: white;
  text-decoration: none;
  margin-left: 20px;
}

nav a:hover {
  text-decoration: underline;
}
`;
  }

  protected generateFooterComponentStyles() {
    return `.footer {
  padding: 20px;
  text-align: center;
  background: #f5f5f5;
  margin-top: auto;
}

.footer-container p {
  margin: 5px 0;
}

.footer-links a {
  margin: 0 10px;
  color: #1976d2;
}
`;
  }
}
