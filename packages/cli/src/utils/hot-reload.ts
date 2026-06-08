/**
 * Hot Reload System for All Backend and Frontend Frameworks
 * Provides intelligent file watching and framework-specific hot reload
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import chalk from 'chalk';

// Framework detection patterns
export interface FrameworkPattern {
  language: string;
  framework: string;
  detectionFiles: string[];
  detectionPatterns: Record<string, RegExp | string[]>;
  devCommand: string;
  devScript?: string;
  watchPaths: string[];
  excludePatterns: string[];
  reloadStrategy: 'hmr' | 'restart' | 'soft-reload' | 'custom';
  port?: number;
}

// Hot reload configuration
export interface HotReloadConfig {
  projectPath: string;
  framework?: string;
  language?: string;
  watchPaths?: string[];
  excludePatterns?: string[];
  debounceMs?: number;
  verbose?: boolean;
  onStart?: () => void;
  onReload?: (type: ReloadType) => void;
  onError?: (error: Error) => void;
}

export type ReloadType = 'initial' | 'change' | 'add' | 'unlink' | 'error';

// Process manager for dev servers
interface DevServerProcess {
  child: ChildProcess;
  framework: string;
  startTime: number;
  restartCount: number;
  isRestarting: boolean;
}

// Framework detection result
export interface DetectedFramework {
  framework: string;
  language: string;
  config: FrameworkPattern;
  confidence: number;
}

// Framework patterns for detection
const FRAMEWORK_PATTERNS: Record<string, FrameworkPattern> = {
  // Node.js / TypeScript
  'express': {
    language: 'typescript',
    framework: 'express',
    detectionFiles: ['package.json'],
    detectionPatterns: {
      'package.json': ['express', 'nodemon', 'ts-node'],
    },
    devCommand: 'nodemon',
    devScript: 'dev',
    watchPaths: ['src/**/*.ts', 'src/**/*.js'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    reloadStrategy: 'restart',
    port: 3000,
  },
  'nestjs': {
    language: 'typescript',
    framework: 'nestjs',
    detectionFiles: ['package.json', 'nest-cli.json'],
    detectionPatterns: {
      'package.json': ['@nestjs/core', '@nestjs/common'],
      'nest-cli.json': /.*/,
    },
    devCommand: 'nest start --watch',
    devScript: 'start:dev',
    watchPaths: ['src/**/*.ts'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    reloadStrategy: 'hmr',
    port: 3000,
  },
  'fastify': {
    language: 'typescript',
    framework: 'fastify',
    detectionFiles: ['package.json'],
    detectionPatterns: {
      'package.json': ['fastify'],
    },
    devCommand: 'nodemon',
    devScript: 'dev',
    watchPaths: ['src/**/*.ts'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    reloadStrategy: 'restart',
    port: 3000,
  },
  'nextjs': {
    language: 'typescript',
    framework: 'nextjs',
    detectionFiles: ['package.json', 'next.config.js', 'next.config.ts'],
    detectionPatterns: {
      'package.json': ['next'],
      'next.config.js': /.*/,
      'next.config.ts': /.*/,
    },
    devCommand: 'next dev',
    devScript: 'dev',
    watchPaths: ['app/**/*', 'pages/**/*', 'components/**/*', 'lib/**/*'],
    excludePatterns: ['node_modules', '.next', 'build', '.git'],
    reloadStrategy: 'hmr',
    port: 3000,
  },
  'vite-react': {
    language: 'typescript',
    framework: 'vite-react',
    detectionFiles: ['package.json', 'vite.config.ts'],
    detectionPatterns: {
      'package.json': ['vite', 'react'],
      'vite.config.ts': /.*/,
    },
    devCommand: 'vite',
    devScript: 'dev',
    watchPaths: ['src/**/*', 'index.html'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    reloadStrategy: 'hmr',
    port: 5173,
  },
  'vite-vue': {
    language: 'typescript',
    framework: 'vite-vue',
    detectionFiles: ['package.json', 'vite.config.ts'],
    detectionPatterns: {
      'package.json': ['vite', 'vue'],
      'vite.config.ts': /.*/,
    },
    devCommand: 'vite',
    devScript: 'dev',
    watchPaths: ['src/**/*', 'index.html'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    reloadStrategy: 'hmr',
    port: 5173,
  },
  'vite-svelte': {
    language: 'typescript',
    framework: 'vite-svelte',
    detectionFiles: ['package.json', 'vite.config.ts', 'svelte.config.js'],
    detectionPatterns: {
      'package.json': ['vite', 'svelte'],
      'svelte.config.js': /.*/,
    },
    devCommand: 'vite',
    devScript: 'dev',
    watchPaths: ['src/**/*'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git', '.svelte-kit'],
    reloadStrategy: 'hmr',
    port: 5173,
  },
  'angular': {
    language: 'typescript',
    framework: 'angular',
    detectionFiles: ['package.json', 'angular.json'],
    detectionPatterns: {
      'package.json': ['@angular/core'],
      'angular.json': /.*/,
    },
    devCommand: 'ng serve',
    devScript: 'start',
    watchPaths: ['src/**/*.ts', 'src/**/*.html', 'src/**/*.css'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    reloadStrategy: 'hmr',
    port: 4200,
  },
  'react-cra': {
    language: 'typescript',
    framework: 'react-cra',
    detectionFiles: ['package.json'],
    detectionPatterns: {
      'package.json': ['react-scripts'],
    },
    devCommand: 'react-scripts start',
    devScript: 'start',
    watchPaths: ['src/**/*'],
    excludePatterns: ['node_modules', 'build', '.git'],
    reloadStrategy: 'hmr',
    port: 3000,
  },
  'vue-cli': {
    language: 'typescript',
    framework: 'vue-cli',
    detectionFiles: ['package.json', 'vue.config.js'],
    detectionPatterns: {
      'package.json': ['@vue/cli-service'],
      'vue.config.js': /.*/,
    },
    devCommand: 'vue-cli-service serve',
    devScript: 'serve',
    watchPaths: ['src/**/*'],
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    reloadStrategy: 'hmr',
    port: 8080,
  },

  // Python
  'fastapi': {
    language: 'python',
    framework: 'fastapi',
    detectionFiles: ['requirements.txt', 'pyproject.toml', 'main.py', 'app/main.py'],
    detectionPatterns: {
      'requirements.txt': ['fastapi', 'uvicorn'],
      'pyproject.toml': ['fastapi'],
      'main.py': /from fastapi|import fastapi/,
      'app/main.py': /from fastapi|import fastapi/,
    },
    devCommand: 'uvicorn app.main:app --reload',
    devScript: 'dev',
    watchPaths: ['app/**/*.py', 'src/**/*.py'],
    excludePatterns: ['__pycache__', '*.pyc', '.git', 'venv', 'env', '.venv'],
    reloadStrategy: 'hmr',
    port: 8000,
  },
  'django': {
    language: 'python',
    framework: 'django',
    detectionFiles: ['requirements.txt', 'pyproject.toml', 'manage.py'],
    detectionPatterns: {
      'requirements.txt': ['django'],
      'pyproject.toml': ['django'],
      'manage.py': /django/,
    },
    devCommand: 'python manage.py runserver',
    devScript: 'dev',
    watchPaths: ['**/*.py', 'templates/**/*.html', 'static/**/*.css'],
    excludePatterns: ['__pycache__', '*.pyc', '.git', 'venv', 'env', '.venv', 'migrations'],
    reloadStrategy: 'hmr',
    port: 8000,
  },
  'flask': {
    language: 'python',
    framework: 'flask',
    detectionFiles: ['requirements.txt', 'pyproject.toml', 'app.py'],
    detectionPatterns: {
      'requirements.txt': ['flask'],
      'pyproject.toml': ['flask'],
      'app.py': /from flask|import flask|Flask\(/,
    },
    devCommand: 'flask run --reload',
    devScript: 'dev',
    watchPaths: ['**/*.py', 'templates/**/*.html', 'static/**/*.css'],
    excludePatterns: ['__pycache__', '*.pyc', '.git', 'venv', 'env', '.venv'],
    reloadStrategy: 'hmr',
    port: 5000,
  },
  'sanic': {
    language: 'python',
    framework: 'sanic',
    detectionFiles: ['requirements.txt', 'pyproject.toml'],
    detectionPatterns: {
      'requirements.txt': ['sanic'],
      'pyproject.toml': ['sanic'],
    },
    devCommand: 'sanic app.main:app --dev --reload',
    devScript: 'dev',
    watchPaths: ['app/**/*.py', 'src/**/*.py'],
    excludePatterns: ['__pycache__', '*.pyc', '.git', 'venv', 'env', '.venv'],
    reloadStrategy: 'hmr',
    port: 8000,
  },
  'tornado': {
    language: 'python',
    framework: 'tornado',
    detectionFiles: ['requirements.txt', 'pyproject.toml'],
    detectionPatterns: {
      'requirements.txt': ['tornado'],
      'pyproject.toml': ['tornado'],
    },
    devCommand: 'python -m tornado.autoreload',
    devScript: 'dev',
    watchPaths: ['**/*.py'],
    excludePatterns: ['__pycache__', '*.pyc', '.git', 'venv', 'env', '.venv'],
    reloadStrategy: 'restart',
    port: 8000,
  },

  // Go
  'gin': {
    language: 'go',
    framework: 'gin',
    detectionFiles: ['go.mod', 'main.go'],
    detectionPatterns: {
      'go.mod': ['gin-gonic/gin'],
      'main.go': /gin\.|import.*gin/,
    },
    devCommand: 'air',
    devScript: 'dev',
    watchPaths: ['**/*.go'],
    excludePatterns: ['vendor', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 8080,
  },
  'echo': {
    language: 'go',
    framework: 'echo',
    detectionFiles: ['go.mod', 'main.go'],
    detectionPatterns: {
      'go.mod': ['labstack/echo'],
      'main.go': /echo\.|import.*echo/,
    },
    devCommand: 'air',
    devScript: 'dev',
    watchPaths: ['**/*.go'],
    excludePatterns: ['vendor', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 8080,
  },
  'fiber': {
    language: 'go',
    framework: 'fiber',
    detectionFiles: ['go.mod', 'main.go'],
    detectionPatterns: {
      'go.mod': ['gofiber/fiber'],
      'main.go': /fiber\.|import.*fiber/,
    },
    devCommand: 'air',
    devScript: 'dev',
    watchPaths: ['**/*.go'],
    excludePatterns: ['vendor', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 8080,
  },
  'chi': {
    language: 'go',
    framework: 'chi',
    detectionFiles: ['go.mod', 'main.go'],
    detectionPatterns: {
      'go.mod': ['go-chi/chi'],
      'main.go': /chi\.|import.*chi/,
    },
    devCommand: 'air',
    devScript: 'dev',
    watchPaths: ['**/*.go'],
    excludePatterns: ['vendor', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 8080,
  },

  // Rust
  'actix': {
    language: 'rust',
    framework: 'actix',
    detectionFiles: ['Cargo.toml'],
    detectionPatterns: {
      'Cargo.toml': ['actix-web'],
    },
    devCommand: 'cargo watch -x run',
    devScript: 'dev',
    watchPaths: ['**/*.rs'],
    excludePatterns: ['target', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 8080,
  },
  'axum': {
    language: 'rust',
    framework: 'axum',
    detectionFiles: ['Cargo.toml'],
    detectionPatterns: {
      'Cargo.toml': ['axum'],
    },
    devCommand: 'cargo watch -x run',
    devScript: 'dev',
    watchPaths: ['**/*.rs'],
    excludePatterns: ['target', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 8080,
  },
  'rocket': {
    language: 'rust',
    framework: 'rocket',
    detectionFiles: ['Cargo.toml'],
    detectionPatterns: {
      'Cargo.toml': ['rocket'],
    },
    devCommand: 'cargo watch -x run',
    devScript: 'dev',
    watchPaths: ['**/*.rs'],
    excludePatterns: ['target', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 8080,
  },

  // Ruby
  'rails': {
    language: 'ruby',
    framework: 'rails',
    detectionFiles: ['Gemfile'],
    detectionPatterns: {
      'Gemfile': ['rails'],
    },
    devCommand: 'bin/rails server',
    devScript: 'server',
    watchPaths: ['**/*.rb', 'app/**/*.html.erb', 'app/**/*.json.jbuilder'],
    excludePatterns: ['tmp', 'log', '.git', 'node_modules'],
    reloadStrategy: 'hmr',
    port: 3000,
  },
  'sinatra': {
    language: 'ruby',
    framework: 'sinatra',
    detectionFiles: ['Gemfile'],
    detectionPatterns: {
      'Gemfile': ['sinatra'],
    },
    devCommand: 'bundle exec shotgun',
    devScript: 'dev',
    watchPaths: ['**/*.rb', 'views/**/*.erb', 'public/**/*.css'],
    excludePatterns: ['tmp', 'log', '.git', 'node_modules'],
    reloadStrategy: 'restart',
    port: 9393,
  },

  // PHP
  'laravel': {
    language: 'php',
    framework: 'laravel',
    detectionFiles: ['composer.json', 'artisan'],
    detectionPatterns: {
      'composer.json': ['laravel/framework'],
      'artisan': /.*/,
    },
    devCommand: 'php artisan serve',
    devScript: 'dev',
    watchPaths: ['app/**/*.php', 'resources/**/*.php', 'routes/**/*.php'],
    excludePatterns: ['vendor', 'node_modules', '.git', 'storage'],
    reloadStrategy: 'hmr',
    port: 8000,
  },
  'symfony': {
    language: 'php',
    framework: 'symfony',
    detectionFiles: ['composer.json'],
    detectionPatterns: {
      'composer.json': ['symfony'],
    },
    devCommand: 'symfony server:start --no-tls',
    devScript: 'dev',
    watchPaths: ['src/**/*.php', 'templates/**/*.twig'],
    excludePatterns: ['vendor', 'var', 'node_modules', '.git'],
    reloadStrategy: 'hmr',
    port: 8000,
  },
  'slim': {
    language: 'php',
    framework: 'slim',
    detectionFiles: ['composer.json'],
    detectionPatterns: {
      'composer.json': ['slim/slim'],
    },
    devCommand: 'php -S localhost:8080 -t public',
    devScript: 'dev',
    watchPaths: ['src/**/*.php', 'public/**/*.php'],
    excludePatterns: ['vendor', 'node_modules', '.git'],
    reloadStrategy: 'restart',
    port: 8080,
  },

  // Java
  'spring-boot': {
    language: 'java',
    framework: 'spring-boot',
    detectionFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    detectionPatterns: {
      'pom.xml': ['spring-boot'],
      'build.gradle': ['spring-boot'],
      'build.gradle.kts': ['spring-boot'],
    },
    devCommand: './gradlew bootRun',
    devScript: 'bootRun',
    watchPaths: ['src/**/*.java', 'src/**/*.kt'],
    excludePatterns: ['build', '.gradle', 'node_modules', '.git'],
    reloadStrategy: 'restart',
    port: 8080,
  },

  // C#
  'aspnet-core': {
    language: 'csharp',
    framework: 'aspnet-core',
    detectionFiles: ['*.csproj'],
    detectionPatterns: {
      '*.csproj': ['Microsoft.AspNetCore'],
    },
    devCommand: 'dotnet watch run',
    devScript: 'dev',
    watchPaths: ['**/*.cs'],
    excludePatterns: ['bin', 'obj', 'node_modules', '.git'],
    reloadStrategy: 'hmr',
    port: 5000,
  },
};

// Hot Reload Manager class
export class HotReloadManager extends EventEmitter {
  private projectPath: string;
  private framework: FrameworkPattern | null = null;
  private detectedFrameworks: DetectedFramework[] = [];
  private watcher: chokidar.FSWatcher | null = null;
  private devServer: DevServerProcess | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isReloading = false;
  private config: HotReloadConfig;
  private watchedPaths: Set<string> = new Set();

  constructor(config: HotReloadConfig) {
    super();
    this.projectPath = config.projectPath;
    this.config = {
      debounceMs: 300,
      verbose: false,
      ...config,
    };
  }

  // Detect the framework used in the project
  async detectFramework(): Promise<DetectedFramework | null> {
    const results: DetectedFramework[] = [];

    for (const [key, pattern] of Object.entries(FRAMEWORK_PATTERNS)) {
      let confidence = 0;
      let matchCount = 0;

      // Check detection files
      for (const file of pattern.detectionFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          confidence += 20;
          matchCount++;

          // Check content patterns
          for (const [subPath, contentPattern] of Object.entries(pattern.detectionPatterns)) {
            if (subPath === file || file.endsWith(subPath)) {
              try {
                const content = await fs.readFile(filePath, 'utf-8');
                const matches = this.checkPattern(content, contentPattern);
                if (matches) {
                  confidence += 30;
                }
              } catch {
                // File exists but couldn't be read
              }
            }
          }
        }
      }

      if (confidence > 0) {
        results.push({
          framework: key,
          language: pattern.language,
          config: pattern,
          confidence,
        });
      }
    }

    this.detectedFrameworks = results.sort((a, b) => b.confidence - a.confidence);

    if (results.length > 0 && results[0].confidence >= 20) {
      this.framework = results[0].config;
      return results[0];
    }

    return null;
  }

  // Check if content matches pattern
  private checkPattern(content: string, pattern: RegExp | string[]): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(content);
    }
    if (Array.isArray(pattern)) {
      return pattern.some(p => content.toLowerCase().includes(p.toLowerCase()));
    }
    return false;
  }

  // Get detected frameworks list
  getDetectedFrameworks(): DetectedFramework[] {
    return this.detectedFrameworks;
 }

  // Start hot reload
  async start(): Promise<void> {
    if (!this.framework) {
      const detected = await this.detectFramework();
      if (!detected) {
        throw new Error('Could not detect framework. Please specify explicitly.');
      }
      this.framework = detected.config;
    }

    const watchPaths = this.config.watchPaths || this.framework.watchPaths;
    const excludePatterns = this.config.excludePatterns || this.framework.excludePatterns;

    // Create watcher
    this.watcher = chokidar.watch(watchPaths, {
      cwd: this.projectPath,
      ignored: excludePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
    });

    // Set up event handlers
    this.watcher.on('change', (filePath) => this.handleFileChange('change', filePath));
    this.watcher.on('add', (filePath) => this.handleFileChange('add', filePath));
    this.watcher.on('unlink', (filePath) => this.handleFileChange('unlink', filePath));
    this.watcher.on('ready', () => this.handleWatcherReady());
    this.watcher.on('error', (error) => this.handleError(error as Error));

    // Start dev server
    await this.startDevServer();

    this.emit('started');
  }

  // Handle file changes
  private handleFileChange(type: ReloadType, filePath: string): void {
    if (this.isReloading) return;

    const fullPath = path.join(this.projectPath, filePath);
    this.watchedPaths.add(fullPath);

    if (this.config.verbose) {
      console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] ${type}: ${filePath}`));
    }

    // Debounce reload
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.triggerReload(type, filePath);
    }, this.config.debounceMs);
  }

  // Trigger reload based on strategy
  private async triggerReload(type: ReloadType, filePath: string): Promise<void> {
    this.isReloading = true;

    try {
      if (this.config.onReload) {
        this.config.onReload(type);
      }

      const strategy = this.framework?.reloadStrategy || 'restart';

      switch (strategy) {
        case 'hmr':
          // Framework handles HMR internally
          this.emit('reload', { type, filePath, strategy: 'hmr' });
          if (this.config.verbose) {
            console.log(chalk.green('🔄 HMR: Framework will hot reload'));
          }
          break;

        case 'restart':
          await this.restartDevServer();
          this.emit('reload', { type, filePath, strategy: 'restart' });
          break;

        case 'soft-reload':
          this.emit('reload', { type, filePath, strategy: 'soft-reload' });
          if (this.config.verbose) {
            console.log(chalk.yellow('🔄 Soft reload triggered'));
          }
          break;

        case 'custom':
          await this.executeCustomReload(filePath);
          break;
      }

    } catch (error) {
      this.handleError(error as Error);
    } finally {
      this.isReloading = false;
    }
  }

  // Start the dev server
  private async startDevServer(): Promise<void> {
    if (!this.framework) return;

    const command = this.framework.devCommand;
    const args: string[] = [];
    const env = { ...process.env };

    // Parse command and args
    const parts = command.split(' ');
    const cmd = parts[0];
    const cmdArgs = parts.slice(1);
    args.push(...cmdArgs);

    // Check for npm script
    if (this.framework.devScript) {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        if (packageJson.scripts?.[this.framework.devScript]) {
          // Use npm script
          this.spawnDevServer('npm', ['run', this.framework.devScript], env);
          return;
        }
      }
    }

    this.spawnDevServer(cmd, args, env);
  }

  // Spawn dev server process
  private spawnDevServer(command: string, args: string[], env: Record<string, string>): void {
    const child = spawn(command, args, {
      cwd: this.projectPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    // Handle output
    child.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(chalk.gray(`[${this.framework?.framework}] ${output}`));
      }
    });

    child.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.error(chalk.red(`[${this.framework?.framework}] ${output}`));
      }
    });

    child.on('error', (error) => {
      this.handleError(error);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        if (this.config.verbose) {
          console.log(chalk.yellow(`Dev server exited with code ${code}`));
        }
      }
    });

    this.devServer = {
      child,
      framework: this.framework?.framework || 'unknown',
      startTime: Date.now(),
      restartCount: 0,
      isRestarting: false,
    };

    if (this.config.verbose) {
      console.log(chalk.green(`🚀 Started dev server: ${command} ${args.join(' ')}`));
    }
  }

  // Restart dev server
  private async restartDevServer(): Promise<void> {
    if (!this.devServer || this.devServer.isRestarting) return;

    this.devServer.isRestarting = true;
    this.devServer.restartCount++;

    if (this.config.verbose) {
      console.log(chalk.yellow('🔄 Restarting dev server...'));
    }

    // Kill existing process
    this.devServer.child.kill('SIGTERM');

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      if (!this.devServer) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.devServer?.child.kill('SIGKILL');
        resolve();
      }, 5000);

      this.devServer.child.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Start new process
    await this.startDevServer();

    if (this.devServer) {
      this.devServer.isRestarting = false;
    }
  }

  // Execute custom reload
  private async executeCustomReload(filePath: string): Promise<void> {
    this.emit('reload', { type: 'custom', filePath, strategy: 'custom' });
    if (this.config.verbose) {
      console.log(chalk.yellow('🔄 Custom reload triggered'));
    }
  }

  // Handle watcher ready
  private handleWatcherReady(): void {
    this.emit('ready');
    if (this.config.verbose) {
      console.log(chalk.green('👀 File watching ready'));
    }
  }

  // Handle errors
  private handleError(error: Error): void {
    this.emit('error', error);
    if (this.config.onError) {
      this.config.onError(error);
    } else {
      console.error(chalk.red(`❌ Hot reload error: ${error.message}`));
    }
  }

  // Stop hot reload
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.devServer) {
      this.devServer.child.kill('SIGTERM');
      this.devServer = null;
    }

    this.emit('stopped');
  }

  // Get current status
  getStatus(): {
    framework: string | null;
    isWatching: boolean;
    devServerRunning: boolean;
    uptime: number;
    restartCount: number;
    watchedPaths: number;
  } {
    return {
      framework: this.framework?.framework || null,
      isWatching: this.watcher !== null,
      devServerRunning: this.devServer !== null,
      uptime: this.devServer ? Date.now() - this.devServer.startTime : 0,
      restartCount: this.devServer?.restartCount || 0,
      watchedPaths: this.watchedPaths.size,
    };
  }

  // Add watch path
  addWatchPath(pattern: string): void {
    this.watcher?.add(pattern);
  }

  // Remove watch path
  removeWatchPath(pattern: string): void {
    this.watcher?.unwatch(pattern);
  }
}

// Utility functions

/**
 * Create a hot reload manager
 */
export async function createHotReload(config: HotReloadConfig): Promise<HotReloadManager> {
  const manager = new HotReloadManager(config);

  if (!config.framework) {
    await manager.detectFramework();
  }

  return manager;
}

/**
 * Detect framework in a directory
 */
export async function detectProjectFramework(projectPath: string): Promise<DetectedFramework | null> {
  const manager = new HotReloadManager({ projectPath });
  return await manager.detectFramework();
}

/**
 * List all supported frameworks
 */
export function listSupportedFrameworks(): Array<{
  id: string;
  language: string;
  reloadStrategy: string;
  port: number | undefined;
}> {
  return Object.entries(FRAMEWORK_PATTERNS).map(([id, config]) => ({
    id,
    language: config.language,
    reloadStrategy: config.reloadStrategy,
    port: config.port,
  }));
}

/**
 * Get framework pattern by ID
 */
export function getFrameworkPattern(id: string): FrameworkPattern | undefined {
  return FRAMEWORK_PATTERNS[id];
}
