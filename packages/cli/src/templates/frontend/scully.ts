import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class ScullyTemplate extends BaseTemplate {
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

    // Scully config
    files.push({
      path: 'scully.config.js',
      content: this.generateScullyConfig()
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

    // Main app files
    files.push({
      path: 'src/index.html',
      content: this.generateIndexHtml()
    });

    files.push({
      path: 'src/main.ts',
      content: this.generateMainTs()
    });

    files.push({
      path: 'src/styles.scss',
      content: this.generateGlobalStyles()
    });

    // Components
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
      content: this.generateAppComponentScss()
    });

    files.push({
      path: 'src/app/app.component.spec.ts',
      content: this.generateAppComponentSpec()
    });

    files.push({
      path: 'src/app/app.routes.ts',
      content: this.generateAppRoutes()
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
      content: this.generateHomeComponentScss()
    });

    // Blog component
    files.push({
      path: 'src/app/blog/blog.component.ts',
      content: this.generateBlogComponent()
    });

    files.push({
      path: 'src/app/blog/blog.component.html',
      content: this.generateBlogComponentHtml()
    });

    files.push({
      path: 'src/app/blog/blog.component.scss',
      content: this.generateBlogComponentScss()
    });

    // Counter component
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
      content: this.generateCounterComponentScss()
    });

    // Badge component
    files.push({
      path: 'src/app/badge/badge.component.ts',
      content: this.generateBadgeComponent()
    });

    files.push({
      path: 'src/app/badge/badge.component.html',
      content: this.generateBadgeComponentHtml()
    });

    files.push({
      path: 'src/app/badge/badge.component.scss',
      content: this.generateBadgeComponentScss()
    });

    // Blog post files
    files.push({
      path: 'blog/2024-01-15-welcome.md',
      content: this.generateBlogPost()
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

    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.0.0',
      scripts: {
        'ng': 'ng',
        'start': 'ng serve',
        'build': 'ng build',
        'watch': 'ng build --watch --configuration development',
        'test': 'ng test',
        'lint': 'ng lint',
        'scully': 'npx scully',
        'scully:serve': 'npx scully serve',
        'build:prod': 'ng build --configuration production && npx scully'
      },
      private: true,
      dependencies: {
        '@angular/animations': '^17.0.0',
        '@angular/common': '^17.0.0',
        '@angular/compiler': '^17.0.0',
        '@angular/core': '^17.0.0',
        '@angular/forms': '^17.0.0',
        '@angular/platform-browser': '^17.0.0',
        '@angular/platform-browser-dynamic': '^17.0.0',
        '@angular/router': '^17.0.0',
        '@scullyio/scully': '^2.0.0',
        '@scullyio/ng-lib': '^2.0.0',
        'rxjs': '^7.8.0',
        'tslib': '^2.6.0',
        'zone.js': '^0.14.0'
      },
      devDependencies: {
        '@angular-devkit/build-angular': '^17.0.0',
        '@angular/cli': '^17.0.0',
        '@angular/compiler-cli': '^17.0.0',
        '@types/jasmine': '^5.1.0',
        '@types/node': '^20.11.0',
        'jasmine-core': '^5.1.0',
        'karma': '^6.4.0',
        'karma-chrome-launcher': '^3.2.0',
        'karma-coverage': '^2.2.0',
        'karma-jasmine': '^5.1.0',
        'karma-jasmine-html-reporter': '^2.1.0',
        'typescript': '~5.3.0'
      }
    };
  }

  private generateAngularJson() {
    return JSON.stringify({
      '$schema': './node_modules/@angular/cli/lib/config/schema.json',
      version: 1,
      newProjectRoot: 'projects',
      projects: {
        [this.context.normalizedName]: {
          projectType: 'application',
          schematics: {},
          root: '',
          sourceRoot: 'src',
          prefix: 'app',
          architect: {
            build: {
              builder: '@angular-devkit/build-angular:application',
              options: {
                outputPath: `dist/${this.context.normalizedName}`,
                index: 'src/index.html',
                browser: 'src/main.ts',
                polyfills: ['zone.js'],
                tsConfig: 'tsconfig.app.json',
                assets: [],
                styles: ['src/styles.scss'],
                scripts: []
              },
              configurations: {
                production: {
                  budgets: [
                    { type: 'initial', maximumWarning: '2mb', maximumError: '5mb' },
                    { type: 'anyComponentStyle', maximumWarning: '2kb', maximumError: '4kb' }
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
                production: { buildTarget: `${this.context.normalizedName}:build:production` },
                development: { buildTarget: `${this.context.normalizedName}:build:development` }
              },
              defaultConfiguration: 'development'
            },
            'extract-i18n': {
              builder: '@angular-devkit/build-angular:extract-i18n',
              options: { buildTarget: `${this.context.normalizedName}:build` }
            },
            test: {
              builder: '@angular-devkit/build-angular:karma',
              options: {
                polyfills: ['zone.js', 'zone.js/testing'],
                tsConfig: 'tsconfig.spec.json',
                assets: [],
                styles: ['src/styles.scss'],
                scripts: []
              }
            }
          }
        }
      }
    }, null, 2);
  }

  private generateScullyConfig() {
    return `require('zone.js/dist/zone-node');

module.exports = {
  projectName: '${this.context.normalizedName}',
  outDir: './dist/static',
  distFolder: './dist/${this.context.normalizedName}',
  bare: false,
  // add routes in here
  routes: [
    // {
    //   route: '/blog/:slug',
    //   type: 'contentFolder',
    //   slug: {
    //     folder: './blog',
    //   },
    // },
  ],
  // If using SASS, add the following
  inlineStyleExtension: '.scss',
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

  private generateTsConfigApp() {
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

  private generateIndexHtml() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${this.context.name}</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${this.context.description || 'An Angular static site built with Scully'}">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
`;
  }

  private generateMainTs() {
    return `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)]
}).catch((err) => console.error(err));
`;
  }

  private generateGlobalStyles() {
    return `/* Global Styles */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333;
  background: #fff;
  line-height: 1.6;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;

  &:hover {
    background: #555;
  }
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Selection */
::selection {
  background: #dd0031;
  color: #fff;
}

/* Focus styles */
*:focus-visible {
  outline: 2px solid #dd0031;
  outline-offset: 2px;
}
`;
  }

  private generateAppComponent() {
    return `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = '${this.context.name}';
}
`;
  }

  private generateAppComponentHtml() {
    return `<header class="header">
  <div class="container">
    <a routerLink="/" class="logo">{{ title }}</a>
    <nav class="nav">
      <a routerLink="/" class="nav-link" routerLinkActive="active">Home</a>
      <a routerLink="/blog" class="nav-link" routerLinkActive="active">Blog</a>
    </nav>
  </div>
</header>

<main class="main">
  <router-outlet></router-outlet>
</main>

<footer class="footer">
  <div class="container">
    <p>&copy; {{ currentYear }} {{ title }}</p>
  </div>
</footer>
`;
  }

  private generateAppComponentScss() {
    return `.header {
  background: #fff;
  border-bottom: 2px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #dd0031;
  text-decoration: none;
  display: inline-block;
  padding: 1.5rem 0;
}

.nav {
  display: inline-block;
  margin-left: 2rem;
}

.nav-link {
  color: #666;
  text-decoration: none;
  margin-left: 1.5rem;
  padding: 0.5rem 0;
  transition: color 0.2s ease;
  cursor: pointer;

  &:hover,
  &.active {
    color: #dd0031;
  }
}

.main {
  min-height: calc(100vh - 200px);
  padding: 2rem 0;
}

.footer {
  background: #f5f5f5;
  border-top: 2px solid #e0e0e0;
  padding: 2rem 0;
  text-align: center;
  color: #666;
}

@media (max-width: 768px) {
  .nav {
    display: block;
    margin-left: 0;
    margin-top: 1rem;
  }

  .nav-link {
    margin: 0 1rem 0 0;
  }
}
`;
  }

  private generateAppComponentSpec() {
    return `import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      declarations: [AppComponent]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(\`should have as title '${this.context.name}'\`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('${this.context.name}');
  });
});
`;
  }

  private generateAppRoutes() {
    return `import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'blog', loadComponent: () => import('./blog/blog.component').then(m => m.BlogComponent) },
];
`;
  }

  private generateHomeComponent() {
    return `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CounterComponent } from '../counter/counter.component';
import { BadgeComponent } from '../badge/badge.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, CounterComponent, BadgeComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  currentYear = new Date().getFullYear();
}
`;
  }

  private generateHomeComponentHtml() {
    return `<div class="home">
  <section class="hero">
    <div class="container">
      <h1 class="hero-title">Welcome to ${this.context.name}</h1>
      <p class="hero-description">
        A modern static site built with Angular and Scully
      </p>
      <div class="hero-actions">
        <a routerLink="/blog" class="action-button primary">View Blog</a>
        <a href="https://scully.io/docs/" target="_blank" rel="noopener" class="action-button secondary">
          Learn More
        </a>
      </div>
    </div>
  </section>

  <section class="features">
    <div class="container">
      <h2>Features</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <span class="feature-icon">⚡</span>
          <h3>Lightning Fast</h3>
          <p>Static site generation for optimal performance</p>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🎨</span>
          <h3>Angular Powered</h3>
          <p>Built with Angular 17 and standalone components</p>
        </div>
        <div class="feature-card">
          <span class="feature-icon">🔍</span>
          <h3>SEO Optimized</h3>
          <p>Pre-rendered content for better search rankings</p>
        </div>
      </div>
    </div>
  </section>

  <section class="demo">
    <div class="container">
      <h2>Interactive Demo</h2>
      <div class="demo-content">
        <app-counter></app-counter>
      </div>
      <div class="badge-demo">
        <h3>Badge Examples</h3>
        <app-badge type="info">Info</app-badge>
        <app-badge type="success">Success</app-badge>
        <app-badge type="warning">Warning</app-badge>
        <app-badge type="danger">Danger</app-badge>
      </div>
    </div>
  </section>
</div>
`;
  }

  private generateHomeComponentScss() {
    return `.home {
  padding: 0;
}

.hero {
  text-align: center;
  padding: 6rem 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  margin-bottom: 4rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.hero-description {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.action-button {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease;

  &.primary {
    background: #fff;
    color: #667eea;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  }

  &.secondary {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    border: 2px solid #fff;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }
  }
}

.features {
  padding: 4rem 0;
  margin-bottom: 4rem;

  h2 {
    text-align: center;
    margin-bottom: 3rem;
    font-size: 2rem;
  }
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2rem;
  border: 2px solid #e0e0e0;
  border-radius: 0.75rem;
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    border-color: #667eea;
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.15);
  }

  h3 {
    margin: 1rem 0 0.5rem;
    font-size: 1.25rem;
  }

  p {
    color: #666;
    line-height: 1.6;
  }
}

.feature-icon {
  font-size: 3rem;
  display: block;
}

.demo {
  padding: 4rem 0;

  h2 {
    text-align: center;
    margin-bottom: 2rem;
    font-size: 2rem;
  }
}

.demo-content {
  max-width: 500px;
  margin: 0 auto 3rem;
}

.badge-demo {
  text-align: center;

  h3 {
    margin-bottom: 1rem;
  }

  app-badge {
    margin: 0 0.5rem;
  }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-description {
    font-size: 1rem;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }
}
`;
  }

  private generateBlogComponent() {
    return `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss']
})
export class BlogComponent {
  currentYear = new Date().getFullYear();

  posts = [
    {
      slug: 'welcome',
      title: 'Welcome to ${this.context.name}',
      date: 'January 15, 2024',
      excerpt: 'We're excited to launch our new static site built with Angular and Scully.'
    }
  ];
}
`;
  }

  private generateBlogComponentHtml() {
    return `<div class="blog">
  <div class="container">
    <header class="blog-header">
      <h1>Blog</h1>
      <p>Thoughts, stories, and ideas</p>
    </header>

    <div class="posts">
      <article *ngFor="let post of posts" class="post-card">
        <h2 class="post-title">
          <a [routerLink]="['/blog', post.slug]">{{ post.title }}</a>
        </h2>
        <p class="post-date">{{ post.date }}</p>
        <p class="post-excerpt">{{ post.excerpt }}</p>
        <a [routerLink]="['/blog', post.slug]" class="read-more">Read more →</a>
      </article>
    </div>
  </div>
</div>
`;
  }

  private generateBlogComponentScss() {
    return `.blog {
  padding: 2rem 0;
}

.blog-header {
  text-align: center;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;

  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  p {
    color: #666;
    font-size: 1.125rem;
  }
}

.posts {
  display: grid;
  gap: 2rem;
}

.post-card {
  padding: 2rem;
  border: 2px solid #e0e0e0;
  border-radius: 0.75rem;
  background: #fff;
  transition: all 0.3s ease;

  &:hover {
    border-color: #667eea;
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.15);
  }
}

.post-title {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;

  a {
    color: #333;
    text-decoration: none;

    &:hover {
      color: #667eea;
    }
  }
}

.post-date {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.post-excerpt {
  color: #666;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.read-more {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

@media (min-width: 768px) {
  .posts {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }
}
`;
  }

  private generateCounterComponent() {
    return `import { Component } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  templateUrl: './counter.component.html',
  styleUrls: ['./counter.component.scss']
})
export class CounterComponent {
  count = 0;
  min = 0;
  max = 100;

  increment(): void {
    if (this.count < this.max) {
      this.count++;
    }
  }

  decrement(): void {
    if (this.count > this.min) {
      this.count--;
    }
  }

  reset(): void {
    this.count = 0;
  }
}
`;
  }

  private generateCounterComponentHtml() {
    return `<div class="counter">
  <div class="counter-display">{{ count }}</div>
  <div class="counter-controls">
    <button class="counter-btn decrement" (click)="decrement()" [disabled]="count <= min">
      −
    </button>
    <button class="counter-btn reset" (click)="reset()">
      Reset
    </button>
    <button class="counter-btn increment" (click)="increment()" [disabled]="count >= max">
      +
    </button>
  </div>
  <div class="counter-info">
    <span>Min: {{ min }}</span>
    <span>Max: {{ max }}</span>
  </div>
</div>
`;
  }

  private generateCounterComponentScss() {
    return `.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  border: 2px solid #e0e0e0;
  border-radius: 0.75rem;
  background: #f9f9f9;
}

.counter-display {
  font-size: 4rem;
  font-weight: 700;
  color: #dd0031;
  font-variant-numeric: tabular-nums;
}

.counter-controls {
  display: flex;
  gap: 1rem;
}

.counter-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  border: 2px solid #e0e0e0;
  border-radius: 0.5rem;
  background: #fff;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: #dd0031;
    color: #dd0031;
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.increment {
  background: #dd0031;
  color: #fff;
  border-color: #dd0031;

  &:hover:not(:disabled) {
    background: #c3002f;
    border-color: #c3002f;
    color: #fff;
  }
}

.decrement {
  background: #666;
  color: #fff;
  border-color: #666;

  &:hover:not(:disabled) {
    background: #555;
    border-color: #555;
    color: #fff;
  }
}

.counter-info {
  display: flex;
  gap: 1rem;
  color: #666;
  font-size: 0.875rem;
}
`;
  }

  private generateBadgeComponent() {
    return `import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.scss']
})
export class BadgeComponent {
  @Input() type: 'info' | 'success' | 'warning' | 'danger' = 'info';
}
`;
  }

  private generateBadgeComponentHtml() {
    return `<span [class]="'badge badge--' + type">
  <ng-content></ng-content>
</span>
`;
  }

  private generateBadgeComponentScss() {
    return `.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 1rem;
  white-space: nowrap;
}

.badge--info {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
}

.badge--success {
  background: #e8f5e9;
  color: #388e3c;
  border: 1px solid #81c784;
}

.badge--warning {
  background: #fff3e0;
  color: #f57c00;
  border: 1px solid #ffb74d;
}

.badge--danger {
  background: #ffebee;
  color: #d32f2f;
  border: 1px solid #e57373;
}
`;
  }

  private generateBlogPost() {
    return `---
title: Welcome to ${this.context.name}
description: We're excited to launch our new static site built with Angular and Scully.
published: true
slug: welcome
---

# Welcome to ${this.context.name}!

We're thrilled to announce the launch of our new static site, built with the power of **Angular** and **Scully**.

## Why Scully?

Scully is the best static site generator for Angular applications. Here's why we chose it:

- ⚡ **Lightning Fast** - Pre-renders your Angular app into static HTML
- 🔍 **SEO Optimized** - Content is pre-rendered for search engines
- 🎨 **Angular Powered** - Use all Angular features you know and love
- 📱 **Responsive** - Mobile-first design approach

## Getting Started with Angular

Angular provides a robust framework for building web applications. With Angular 17, we now have:

- Standalone components
- Improved performance
- Better developer experience
- Enhanced type safety

## What's Next?

Stay tuned for more tutorials, tips, and tricks on building modern web applications with Angular and Scully!

---

## Interactive Components

Try out the counter component below:

<app-counter></app-counter>

## Badge Examples

<app-badge type="info">Info</app-badge>
<app-badge type="success">Success</app-badge>
<app-badge type="warning">Warning</app-badge>
<app-badge type="danger">Danger</app-badge>
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

An Angular static site built with [Scully](https://scully.io/).

## Features

- ⚡ **Static Site Generation** - Pre-rendered for optimal performance
- 🎨 **Angular 17** - Modern Angular with standalone components
- 🔍 **SEO Optimized** - Pre-rendered HTML for search engines
- 📱 **Responsive Design** - Mobile-first approach
- 🎯 **TypeScript** - Full type safety
- 🚀 **Fast Builds** - Optimized build process

## Quick Start

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
# Start Angular dev server
npm start

# Build and run Scully
npm run build:prod

# Serve Scully output
npm run scully:serve
\`\`\`

### Build

\`\`\`bash
# Build Angular app
npm run build

# Build Angular + Scully
npm run build:prod
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── src/
│   ├── app/
│   │   ├── components/    # Angular components
│   │   ├── pages/         # Page components
│   │   └── services/      # Services
│   ├── assets/            # Static assets
│   └── styles.scss        # Global styles
├── blog/                  # Blog content (Markdown)
├── dist/                  # Build output
├── angular.json           # Angular configuration
├── scully.config.js       # Scully configuration
└── package.json
\`\`\`

## Adding Content

### Creating Pages

Create a new component and add it to the routes in \`src/app/app.routes.ts\`.

### Blog Posts

Create Markdown files in the \`blog/\` directory with front matter:

\`\`\`markdown
---
title: My Post
description: Post description
published: true
slug: my-post
---

# My Post

Content here...
\`\`\`

## Customization

### Styling

Edit \`src/styles.scss\` for global styles and component \`.scss\` files for component styles.

### Configuration

- **Angular**: \`angular.json\`
- **Scully**: \`scully.config.js\`

## Deployment

Build the static site and deploy the \`dist/static\` folder to any static hosting service:

- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront

## Documentation

- [Angular Docs](https://angular.io/docs)
- [Scully Docs](https://scully.io/docs/)

## License

MIT

---

Generated with [Re-Shell CLI](https://github.com/your-org/re-shell)
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Angular + Scully site

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build Angular
COPY . .
RUN npm run build

# Build Scully
RUN npm run scully

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from Scully
COPY --from=builder /app/dist/static /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  ${this.context.normalizedName}:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    labels:
      - "com.${this.context.normalizedName}.description=${this.context.name} Angular + Scully Site"
      - "com.${this.context.normalizedName}.version=1.0.0"
`;
  }
}
