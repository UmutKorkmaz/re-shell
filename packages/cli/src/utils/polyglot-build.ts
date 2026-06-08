/**
 * Polyglot Build System
 * Unified build commands for multi-language full-stack applications
 * Supports Node.js, Python, Go, Rust, Java, .NET, PHP, Ruby
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { ProgressSpinner } from './spinner';

const execAsync = promisify(exec);

export type LanguageType =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'unknown';

export type BuildTarget = 'frontend' | 'backend' | 'fullstack' | 'package' | 'lib' | 'tool';

export interface ServiceInfo {
  name: string;
  path: string;
  type: BuildTarget;
  language: LanguageType;
  framework?: string;
  hasBuildScript: boolean;
  buildCommand?: string;
  dependencies?: string[]; // Services that must build first
}

export interface PolyglotBuildOptions {
  production?: boolean;
  parallel?: boolean;
  analyze?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
  filter?: {
    type?: BuildTarget[];
    language?: LanguageType[];
    name?: string[];
  };
}

export interface BuildResult {
  service: ServiceInfo;
  success: boolean;
  duration: number;
  error?: string;
  outputPath?: string;
}

/**
 * Detect the programming language of a service
 */
export function detectLanguage(servicePath: string): LanguageType {
  // Check for language-specific files
  const files = fs.readdirSync(servicePath);

  // TypeScript/JavaScript
  if (files.includes('package.json')) {
    const pkgJson = fs.readJsonSync(path.join(servicePath, 'package.json'));
    if (pkgJson.dependencies?.typescript || pkgJson.devDependencies?.typescript) {
      return 'typescript';
    }
    return 'javascript';
  }

  // Python
  if (
    files.includes('requirements.txt') ||
    files.includes('setup.py') ||
    files.includes('pyproject.toml') ||
    files.includes('Pipfile') ||
    files.includes('poetry.lock')
  ) {
    return 'python';
  }

  // Go
  if (files.includes('go.mod')) {
    return 'go';
  }

  // Rust
  if (files.includes('Cargo.toml')) {
    return 'rust';
  }

  // Java
  if (
    files.includes('pom.xml') ||
    files.includes('build.gradle') ||
    files.includes('build.gradle.kts')
  ) {
    return 'java';
  }

  // .NET (C#)
  if (files.includes('.csproj') || files.includes('project.json')) {
    return 'csharp';
  }

  // PHP
  if (files.includes('composer.json')) {
    return 'php';
  }

  // Ruby
  if (files.includes('Gemfile')) {
    return 'ruby';
  }

  return 'unknown';
}

/**
 * Detect the framework of a service
 */
export function detectFramework(servicePath: string, language: LanguageType): string | undefined {
  try {
    switch (language) {
      case 'typescript':
      case 'javascript': {
        const pkgJson = fs.readJsonSync(path.join(servicePath, 'package.json'));
        const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

        if (deps.express) return 'express';
        if (deps.fastify) return 'fastify';
        if (deps['@nestjs/core']) return 'nestjs';
        if (deps.koa) return 'koa';
        if (deps.react || deps['@types/react']) return 'react';
        if (deps.vue || deps['@vue/compiler-sfc']) return 'vue';
        if (deps.angular || deps['@angular/core']) return 'angular';
        if (deps.svelte) return 'svelte';
        if (deps['@remix-run/react']) return 'remix';
        if (deps.next) return 'next';
        if (deps.nuxt) return 'nuxt';
        if (deps.solid) return 'solid';
        if (deps['@astrojsastro']) return 'astro';
        break;
      }

      case 'python': {
        const requirementsPath = path.join(servicePath, 'requirements.txt');
        const pyprojectPath = path.join(servicePath, 'pyproject.toml');

        if (fs.existsSync(requirementsPath)) {
          const requirements = fs.readFileSync(requirementsPath, 'utf8');
          if (requirements.includes('fastapi')) return 'fastapi';
          if (requirements.includes('flask')) return 'flask';
          if (requirements.includes('django')) return 'django';
          if (requirements.includes('tornado')) return 'tornado';
          if (requirements.includes('sanic')) return 'sanic';
          if (requirements.includes('starlette')) return 'starlette';
        }

        if (fs.existsSync(pyprojectPath)) {
          const pyproject = fs.readFileSync(pyprojectPath, 'utf8');
          if (pyproject.includes('fastapi')) return 'fastapi';
          if (pyproject.includes('flask')) return 'flask';
          if (pyproject.includes('django')) return 'django';
        }
        break;
      }

      case 'go': {
        const goModPath = path.join(servicePath, 'go.mod');
        if (fs.existsSync(goModPath)) {
          const goMod = fs.readFileSync(goModPath, 'utf8');
          if (goMod.includes('gin-gonic')) return 'gin';
          if (goMod.includes('echo')) return 'echo';
          if (goMod.includes('fiber')) return 'fiber';
          if (goMod.includes('go-chi')) return 'chi';
        }
        break;
      }

      case 'rust': {
        const cargoPath = path.join(servicePath, 'Cargo.toml');
        if (fs.existsSync(cargoPath)) {
          const cargo = fs.readFileSync(cargoPath, 'utf8');
          if (cargo.includes('actix')) return 'actix';
          if (cargo.includes('warp')) return 'warp';
          if (cargo.includes('rocket')) return 'rocket';
          if (cargo.includes('axum')) return 'axum';
        }
        break;
      }

      case 'java': {
        const pomPath = path.join(servicePath, 'pom.xml');
        if (fs.existsSync(pomPath)) {
          const pom = fs.readFileSync(pomPath, 'utf8');
          if (pom.includes('spring-boot')) return 'spring-boot';
          if (pom.includes('quarkus')) return 'quarkus';
          if (pom.includes('micronaut')) return 'micronaut';
          if (pom.includes('vertx')) return 'vertx';
        }
        break;
      }

      case 'csharp': {
        const csprojFiles = fs.readdirSync(servicePath).filter(f => f.endsWith('.csproj'));
        if (csprojFiles.length > 0) {
          const csproj = fs.readFileSync(path.join(servicePath, csprojFiles[0]), 'utf8');
          if (csproj.includes('Microsoft.AspNetCore')) return 'aspnet-core';
          if (csproj.includes('blazor')) return 'blazor';
        }
        break;
      }

      case 'php': {
        const composerPath = path.join(servicePath, 'composer.json');
        if (fs.existsSync(composerPath)) {
          const composer = fs.readFileSync(composerPath, 'utf8');
          if (composer.includes('laravel')) return 'laravel';
          if (composer.includes('symfony')) return 'symfony';
          if (composer.includes('slim')) return 'slim';
          if (composer.includes('codeigniter')) return 'codeigniter';
        }
        break;
      }

      case 'ruby': {
        const gemfilePath = path.join(servicePath, 'Gemfile');
        if (fs.existsSync(gemfilePath)) {
          const gemfile = fs.readFileSync(gemfilePath, 'utf8');
          if (gemfile.includes('rails')) return 'rails';
          if (gemfile.includes('sinatra')) return 'sinatra';
          if (gemfile.includes('grape')) return 'grape';
        }
        break;
      }
    }
  } catch {
    // Ignore errors
  }

  return undefined;
}

/**
 * Get build command for a language
 */
export function getBuildCommand(language: LanguageType, servicePath: string): string | undefined {
  switch (language) {
    case 'typescript':
    case 'javascript': {
      const pkgJson = path.join(servicePath, 'package.json');
      if (fs.existsSync(pkgJson)) {
        const pkg = fs.readJsonSync(pkgJson);
        if (pkg.scripts?.build) {
          // Detect package manager
          if (fs.existsSync(path.join(path.dirname(servicePath), 'pnpm-lock.yaml')) ||
              fs.existsSync(path.join(servicePath, 'pnpm-lock.yaml'))) {
            return 'pnpm build';
          }
          if (fs.existsSync(path.join(path.dirname(servicePath), 'yarn.lock')) ||
              fs.existsSync(path.join(servicePath, 'yarn.lock'))) {
            return 'yarn build';
          }
          return 'npm run build';
        }
      }
      return undefined;
    }

    case 'python': {
      if (fs.existsSync(path.join(servicePath, 'pyproject.toml'))) {
        return 'python -m build';
      }
      if (fs.existsSync(path.join(servicePath, 'setup.py'))) {
        return 'python setup.py build';
      }
      return undefined;
    }

    case 'go': {
      return 'go build -o bin/service';
    }

    case 'rust': {
      return 'cargo build --release';
    }

    case 'java': {
      if (fs.existsSync(path.join(servicePath, 'pom.xml'))) {
        return 'mvn clean package';
      }
      if (fs.existsSync(path.join(servicePath, 'build.gradle')) ||
          fs.existsSync(path.join(servicePath, 'build.gradle.kts'))) {
        return 'gradle build';
      }
      return undefined;
    }

    case 'csharp': {
      const csprojFiles = fs.readdirSync(servicePath).filter(f => f.endsWith('.csproj'));
      if (csprojFiles.length > 0) {
        return `dotnet build ${csprojFiles[0]}`;
      }
      return 'dotnet build';
    }

    case 'php': {
      if (fs.existsSync(path.join(servicePath, 'composer.json'))) {
        return 'composer build';
      }
      return undefined;
    }

    case 'ruby': {
      if (fs.existsSync(path.join(servicePath, 'Rakefile'))) {
        return 'rake build';
      }
      return undefined;
    }

    default:
      return undefined;
  }
}

/**
 * Scan the workspace for all services
 */
export function scanWorkspace(rootPath: string = process.cwd()): ServiceInfo[] {
  const services: ServiceInfo[] = [];
  const dirs = ['apps', 'packages', 'libs', 'tools'];

  for (const dir of dirs) {
    const dirPath = path.join(rootPath, dir);
    if (!fs.existsSync(dirPath)) continue;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory());

    for (const entry of entries) {
      const servicePath = path.join(dirPath, entry.name);
      const language = detectLanguage(servicePath);
      const framework = detectFramework(servicePath, language);
      const buildCommand = getBuildCommand(language, servicePath);

      // Determine type
      let type: BuildTarget;
      if (dir === 'apps') {
        type = (language === 'typescript' || language === 'javascript') &&
               (framework === 'react' || framework === 'vue' || framework === 'angular' ||
                framework === 'svelte' || framework === 'next' || framework === 'nuxt')
          ? 'frontend'
          : 'backend';
      } else if (dir === 'packages') {
        type = 'package';
      } else if (dir === 'libs') {
        type = 'lib';
      } else {
        type = 'tool';
      }

      services.push({
        name: entry.name,
        path: servicePath,
        type,
        language,
        framework,
        hasBuildScript: !!buildCommand,
        buildCommand,
      });
    }
  }

  return services;
}

/**
 * Build a single service
 */
export async function buildService(
  service: ServiceInfo,
  options: PolyglotBuildOptions = {}
): Promise<BuildResult> {
  const { production = false, verbose = false } = options;
  const startTime = Date.now();

  if (!service.hasBuildScript || !service.buildCommand) {
    return {
      service,
      success: false,
      duration: 0,
      error: `No build script found for ${service.language}`,
    };
  }

  try {
    const env = {
      ...process.env,
      NODE_ENV: production ? 'production' : 'development',
      PYTHON_ENV: production ? 'production' : 'development',
      GO_ENV: production ? 'production' : 'development',
      RUST_ENV: production ? 'release' : 'debug',
    };

    const originalCwd = process.cwd();
    process.chdir(service.path);

    try {
      const { stdout, stderr } = await execAsync(service.buildCommand, {
        env,
        timeout: 600000, // 10 minutes
      });

      if (verbose) {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
      }

      const duration = Date.now() - startTime;

      return {
        service,
        success: true,
        duration,
        outputPath: getOutputPath(service),
      };
    } finally {
      process.chdir(originalCwd);
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      service,
      success: false,
      duration,
      error: error.message,
    };
  }
}

/**
 * Build multiple services
 */
export async function buildServices(
  services: ServiceInfo[],
  options: PolyglotBuildOptions = {}
): Promise<BuildResult[]> {
  const { parallel = true, spinner } = options;

  if (parallel) {
    // Build in parallel
    const promises = services.map(service => buildService(service, options));
    return await Promise.all(promises);
  } else {
    // Build sequentially
    const results: BuildResult[] = [];
    for (const service of services) {
      if (spinner) {
        spinner.setText(`Building ${service.name}...`);
      }
      const result = await buildService(service, options);
      results.push(result);

      if (!result.success && spinner) {
        spinner.warn(`Failed to build ${service.name}: ${result.error}`);
      }
    }
    return results;
  }
}

/**
 * Get output path for built artifacts
 */
export function getOutputPath(service: ServiceInfo): string | undefined {
  switch (service.language) {
    case 'typescript':
    case 'javascript':
      return path.join(service.path, 'dist');

    case 'python':
      return path.join(service.path, 'build');

    case 'go':
      return path.join(service.path, 'bin');

    case 'rust':
      return path.join(service.path, 'target', 'release');

    case 'java':
      if (fs.existsSync(path.join(service.path, 'pom.xml'))) {
        return path.join(service.path, 'target');
      }
      return path.join(service.path, 'build', 'libs');

    case 'csharp':
      return path.join(service.path, 'bin', 'Release', 'net8.0');

    case 'php':
      return path.join(service.path, 'public');

    default:
      return undefined;
  }
}

/**
 * Filter services based on options
 */
export function filterServices(services: ServiceInfo[], options: PolyglotBuildOptions): ServiceInfo[] {
  let filtered = [...services];

  if (options.filter?.type) {
    filtered = filtered.filter(s => options.filter!.type!.includes(s.type));
  }

  if (options.filter?.language) {
    filtered = filtered.filter(s => options.filter!.language!.includes(s.language));
  }

  if (options.filter?.name) {
    filtered = filtered.filter(s => options.filter!.name!.includes(s.name));
  }

  return filtered;
}

/**
 * Print build results summary
 */
export function printBuildResults(results: BuildResult[]): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(chalk.bold('\n📊 Build Summary\n'));

  if (successful.length > 0) {
    console.log(chalk.green(`✅ Built ${successful.length} service${successful.length > 1 ? 's' : ''}:`));
    for (const result of successful) {
      const duration = ((result.duration / 1000).toFixed(2)) + 's';
      console.log(chalk.green(`   ✓ ${result.service.name} (${result.service.language}) - ${duration}`));
    }
  }

  if (failed.length > 0) {
    console.log(chalk.red(`\n❌ Failed ${failed.length} service${failed.length > 1 ? 's' : ''}:`));
    for (const result of failed) {
      console.log(chalk.red(`   ✗ ${result.service.name} - ${result.error}`));
    }
  }

  console.log(chalk.gray(`\n⏱️  Total time: ${((totalDuration / 1000).toFixed(2))}s\n`));
}
