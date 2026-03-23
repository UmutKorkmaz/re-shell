import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Context-Aware Template Selection
 *
 * Analyzes existing project stack and selects appropriate templates
 * based on frameworks, libraries, patterns, and code style.
 */

export interface ProjectStack {
  // Backend frameworks detected
  backendFrameworks: string[];
  // Frontend frameworks detected
  frontendFrameworks: string[];
  // Languages detected
  languages: string[];
  // Package managers
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  // Testing frameworks
  testingFrameworks: string[];
  // Database ORM/ODM
  databases: string[];
  // Build tools
  buildTools: string[];
  // Styling approaches (CSS, SCSS, Tailwind, etc.)
  styling: string[];
  // State management
  stateManagement: string[];
  // API patterns (REST, GraphQL, gRPC)
  apiPatterns: string[];
  // Authentication methods
  authMethods: string[];
  // Deployment targets
  deployment: string[];
  // Code patterns detected
  patterns: CodePattern[];
}

export interface CodePattern {
  name: string;
  category: 'architecture' | 'design' | 'styling' | 'testing' | 'config';
  description: string;
  examples: number;
  confidence: number;
}

export interface TemplateRecommendation {
  templateId: string;
  templateName: string;
  category: 'backend' | 'frontend' | 'fullstack';
  framework: string;
  confidence: number;
  reasons: string[];
  warnings: string[];
  changes: string[];
}

export interface TemplateSelectionResult {
  recommendations: TemplateRecommendation[];
  stack: ProjectStack;
  summary: {
    totalServices: number;
    backendServices: number;
    frontendServices: number;
    dominantFramework: string;
    dominantLanguage: string;
  };
}

/**
 * Analyze project stack by examining package.json, config files, and source code
 */
export async function analyzeProjectStack(
  workspacePath: string = process.cwd()
): Promise<ProjectStack> {
  const stack: ProjectStack = {
    backendFrameworks: [],
    frontendFrameworks: [],
    languages: [],
    packageManager: 'unknown',
    testingFrameworks: [],
    databases: [],
    buildTools: [],
    styling: [],
    stateManagement: [],
    apiPatterns: [],
    authMethods: [],
    deployment: [],
    patterns: [],
  };

  // Check for package.json files across all apps and packages
  const appsPath = path.join(workspacePath, 'apps');
  const packagesPath = path.join(workspacePath, 'packages');

  const packageJsonPaths: string[] = [];

  // Collect all package.json files
  if (await fs.pathExists(appsPath)) {
    const apps = await fs.readdir(appsPath);
    for (const app of apps) {
      const pkgJsonPath = path.join(appsPath, app, 'package.json');
      if (await fs.pathExists(pkgJsonPath)) {
        packageJsonPaths.push(pkgJsonPath);
      }
    }
  }

  if (await fs.pathExists(packagesPath)) {
    const pkgs = await fs.readdir(packagesPath);
    for (const pkg of pkgs) {
      const pkgJsonPath = path.join(packagesPath, pkg, 'package.json');
      if (await fs.pathExists(pkgJsonPath)) {
        packageJsonPaths.push(pkgJsonPath);
      }
    }
  }

  // Also check root package.json
  const rootPkgJson = path.join(workspacePath, 'package.json');
  if (await fs.pathExists(rootPkgJson)) {
    packageJsonPaths.push(rootPkgJson);
  }

  // Analyze each package.json
  for (const pkgJsonPath of packageJsonPaths) {
    const pkgJson = await fs.readJson(pkgJsonPath);
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    // Detect package manager
    if (await fs.pathExists(path.join(path.dirname(pkgJsonPath), 'pnpm-lock.yaml'))) {
      stack.packageManager = 'pnpm';
    } else if (await fs.pathExists(path.join(path.dirname(pkgJsonPath), 'yarn.lock'))) {
      stack.packageManager = 'yarn';
    } else if (await fs.pathExists(path.join(path.dirname(pkgJsonPath), 'package-lock.json'))) {
      stack.packageManager = 'npm';
    }

    // Detect backend frameworks
    if (deps.express) stack.backendFrameworks.push('express');
    if (deps.fastify) stack.backendFrameworks.push('fastify');
    if (deps['@nestjs/core']) stack.backendFrameworks.push('nestjs');
    if (deps.koa) stack.backendFrameworks.push('koa');
    if (deps.hapi || deps['@hapi/hapi']) stack.backendFrameworks.push('hapi');
    if (deps['@apollo/server']) stack.backendFrameworks.push('apollo');
    if (deps['graphql-yoga']) stack.backendFrameworks.push('graphql-yoga');
    if (deps.django || deps.Django) stack.backendFrameworks.push('django');
    if (deps.flask) stack.backendFrameworks.push('flask');
    if (deps.fastapi) stack.backendFrameworks.push('fastapi');
    if (deps['gin-gonic/gin'] || deps.gin) stack.backendFrameworks.push('gin');

    // Detect frontend frameworks
    if (deps.react || deps['@types/react']) stack.frontendFrameworks.push('react');
    if (deps.vue) stack.frontendFrameworks.push('vue');
    if (deps['@angular/core']) stack.frontendFrameworks.push('angular');
    if (deps.svelte) stack.frontendFrameworks.push('svelte');
    if (deps.solid) stack.frontendFrameworks.push('solid');
    if (deps['@solidjs/router']) stack.frontendFrameworks.push('solid-js');

    // Detect languages
    if (pkgJson.types || pkgJson.type === 'module' || deps.typescript) {
      stack.languages.push('typescript');
    }
    if (deps.babel || deps['@babel/core']) {
      stack.languages.push('javascript');
    }
    if (deps.python || deps.Python) {
      stack.languages.push('python');
    }
    if (deps['go-test']) {
      stack.languages.push('go');
    }

    // Detect testing frameworks
    if (deps.jest) stack.testingFrameworks.push('jest');
    if (deps.vitest) stack.testingFrameworks.push('vitest');
    if (deps.mocha) stack.testingFrameworks.push('mocha');
    if (deps.jasmine) stack.testingFrameworks.push('jasmine');
    if (deps['@testing-library/react']) stack.testingFrameworks.push('testing-library');
    if (deps.cypress) stack.testingFrameworks.push('cypress');
    if (deps.playwright) stack.testingFrameworks.push('playwright');
    if (deps.pytest) stack.testingFrameworks.push('pytest');

    // Detect databases
    if (deps['@prisma/client']) stack.databases.push('prisma');
    if (deps.typeorm) stack.databases.push('typeorm');
    if (deps.mongoose) stack.databases.push('mongoose');
    if (deps.sequelize) stack.databases.push('sequelize');
    if (deps['@sequelize/core']) stack.databases.push('sequelize');
    if (deps['mikro-orm']) stack.databases.push('mikro-orm');
    if (deps.pg) stack.databases.push('postgresql');
    if (deps.mongodb || deps.mongoose) stack.databases.push('mongodb');
    if (deps.redis) stack.databases.push('redis');

    // Detect build tools
    if (deps.webpack) stack.buildTools.push('webpack');
    if (deps.vite) stack.buildTools.push('vite');
    if (deps.rollup) stack.buildTools.push('rollup');
    if (deps.esbuild) stack.buildTools.push('esbuild');
    if (deps.parcel) stack.buildTools.push('parcel');
    if (deps.turbopack) stack.buildTools.push('turbopack');

    // Detect styling
    if (deps.tailwindcss) stack.styling.push('tailwind');
    if (deps.sass || deps['sass']) stack.styling.push('scss');
    if (deps.less) stack.styling.push('less');
    if (deps.stylus) stack.styling.push('stylus');
    if (deps['@emotion/styled']) stack.styling.push('emotion');
    if (deps['styled-components']) stack.styling.push('styled-components');
    if (deps.cssModules) stack.styling.push('css-modules');

    // Detect state management
    if (deps.redux || deps['@reduxjs/toolkit']) stack.stateManagement.push('redux');
    if (deps.mobx) stack.stateManagement.push('mobx');
    if (deps.zustand) stack.stateManagement.push('zustand');
    if (deps.recoil) stack.stateManagement.push('recoil');
    if (deps.jotai) stack.stateManagement.push('jotai');
    if (deps.pinia) stack.stateManagement.push('pinia');
    if (deps.vuex) stack.stateManagement.push('vuex');
    if (deps['ngx-state-store']) stack.stateManagement.push('ngxs');

    // Detect API patterns
    if (deps['@apollo/client'] || deps.graphql || deps['@graphql-tools']) {
      stack.apiPatterns.push('graphql');
    }
    if (deps['@grpc/grpc-js'] || deps['@grpc/proto-loader']) {
      stack.apiPatterns.push('grpc');
    }
    if (deps.socket?.io || deps.ws) {
      stack.apiPatterns.push('websocket');
    }

    // Detect authentication
    if (deps['passport'] || deps['passport-local'] || deps['passport-jwt']) {
      stack.authMethods.push('passport');
    }
    if (deps['@auth/core'] || deps['next-auth']) {
      stack.authMethods.push('authjs');
    }
    if (deps['@nestjs/passport'] || deps['@nestjs/jwt']) {
      stack.authMethods.push('nestjs-auth');
    }
    if (deps.keycloak || deps['keycloak-connect']) {
      stack.authMethods.push('keycloak');
    }

    // Detect deployment
    if (deps.vercel) stack.deployment.push('vercel');
    if (deps.netlify || deps['netlify-cli']) stack.deployment.push('netlify');
    if (deps.serverless) stack.deployment.push('serverless');
    if (deps['@pulumi/pulumi']) stack.deployment.push('pulumi');
    if (deps['terraform']) stack.deployment.push('terraform');
    if (deps.docker) stack.deployment.push('docker');
  }

  // Analyze code patterns
  stack.patterns = await analyzeCodePatterns(workspacePath);

  return stack;
}

/**
 * Analyze code patterns in the project
 */
async function analyzeCodePatterns(workspacePath: string): Promise<CodePattern[]> {
  const patterns: CodePattern[] = [];

  // Scan for architectural patterns
  const appsPath = path.join(workspacePath, 'apps');
  const packagesPath = path.join(workspacePath, 'packages');

  const searchPaths = [appsPath, packagesPath];
  const patternCounts: Record<string, number> = {};

  for (const searchPath of searchPaths) {
    if (!(await fs.pathExists(searchPath))) continue;

    const scanDir = async (dirPath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = await fs.readFile(fullPath, 'utf-8');

          // Detect patterns
          if (content.includes('@Injectable()')) {
            patternCounts['dependency-injection'] = (patternCounts['dependency-injection'] || 0) + 1;
          }
          if (content.includes('class ') && content.includes('extends ')) {
            patternCounts['inheritance'] = (patternCounts['inheritance'] || 0) + 1;
          }
          if (content.includes('decorator') || content.includes('@')) {
            patternCounts['decorators'] = (patternCounts['decorators'] || 0) + 1;
          }
          if (content.includes('async ') && content.includes('await ')) {
            patternCounts['async-await'] = (patternCounts['async-await'] || 0) + 1;
          }
          if (content.includes('Observable') || content.includes('.pipe(')) {
            patternCounts['reactive'] = (patternCounts['reactive'] || 0) + 1;
          }
          if (content.includes('useState') || content.includes('useEffect')) {
            patternCounts['react-hooks'] = (patternCounts['react-hooks'] || 0) + 1;
          }
          if (content.includes('Controller') || content.includes('@Controller')) {
            patternCounts['mvc-controller'] = (patternCounts['mvc-controller'] || 0) + 1;
          }
          if (content.includes('Service') || content.includes('@Service')) {
            patternCounts['service-layer'] = (patternCounts['service-layer'] || 0) + 1;
          }
          if (content.includes('Repository') || content.includes('@Repository')) {
            patternCounts['repository-pattern'] = (patternCounts['repository-pattern'] || 0) + 1;
          }
          if (content.includes('createSlice') || content.includes('createReducer')) {
            patternCounts['redux-toolkit'] = (patternCounts['redux-toolkit'] || 0) + 1;
          }
          if (content.includes('describe(') && content.includes('it(')) {
            patternCounts['unit-testing'] = (patternCounts['unit-testing'] || 0) + 1;
          }
          if (content.includes('test(') && content.includes('expect(')) {
            patternCounts['jest-testing'] = (patternCounts['jest-testing'] || 0) + 1;
          }
        }
      }
    };

    await scanDir(searchPath);
  }

  // Convert to pattern objects
  for (const [name, examples] of Object.entries(patternCounts)) {
    let category: CodePattern['category'] = 'architecture';
    let description = '';

    switch (name) {
      case 'dependency-injection':
        category = 'architecture';
        description = 'Dependency injection pattern';
        break;
      case 'inheritance':
        category = 'design';
        description = 'Class inheritance';
        break;
      case 'decorators':
        category = 'design';
        description = 'Decorator pattern';
        break;
      case 'async-await':
        category = 'architecture';
        description = 'Async/await pattern';
        break;
      case 'reactive':
        category = 'architecture';
        description = 'Reactive programming with Observables';
        break;
      case 'react-hooks':
        category = 'architecture';
        description = 'React Hooks pattern';
        break;
      case 'mvc-controller':
        category = 'architecture';
        description = 'MVC Controller pattern';
        break;
      case 'service-layer':
        category = 'architecture';
        description = 'Service layer pattern';
        break;
      case 'repository-pattern':
        category = 'architecture';
        description = 'Repository pattern';
        break;
      case 'redux-toolkit':
        category = 'architecture';
        description = 'Redux Toolkit pattern';
        break;
      case 'unit-testing':
        category = 'testing';
        description = 'Unit testing pattern';
        break;
      case 'jest-testing':
        category = 'testing';
        description = 'Jest testing pattern';
        break;
    }

    patterns.push({
      name,
      category,
      description,
      examples,
      confidence: Math.min(examples / 10, 1), // Cap at 1.0
    });
  }

  return patterns.sort((a, b) => b.examples - a.examples);
}

/**
 * Recommend templates based on project stack
 */
export async function recommendTemplates(
  workspacePath: string = process.cwd()
): Promise<TemplateSelectionResult> {
  const stack = await analyzeProjectStack(workspacePath);
  const recommendations: TemplateRecommendation[] = [];

  // Analyze stack to create recommendations
  const summary = {
    totalServices: 0,
    backendServices: 0,
    frontendServices: 0,
    dominantFramework: '',
    dominantLanguage: '',
  };

  // Count services
  const appsPath = path.join(workspacePath, 'apps');
  if (await fs.pathExists(appsPath)) {
    const apps = await fs.readdir(appsPath);
    summary.totalServices = apps.length;

    for (const app of apps) {
      const pkgJson = path.join(appsPath, app, 'package.json');
      if (await fs.pathExists(pkgJson)) {
        const deps = (await fs.readJson(pkgJson)).dependencies || {};

        if (deps.express || deps.fastify || deps['@nestjs/core']) {
          summary.backendServices++;
        }
        if (deps.react || deps.vue || deps['@angular/core'] || deps.svelte) {
          summary.frontendServices++;
        }
      }
    }
  }

  // Determine dominant framework and language
  const frameworkCounts = {
    ...stack.backendFrameworks.reduce((acc, f) => ({ ...acc, [f]: (acc[f] || 0) + 1 }), {} as Record<string, number>),
    ...stack.frontendFrameworks.reduce((acc, f) => ({ ...acc, [f]: (acc[f] || 0) + 1 }), {} as Record<string, number>),
  };

  const languageCounts = stack.languages.reduce((acc, l) => ({ ...acc, [l]: (acc[l] || 0) + 1 }), {} as Record<string, number>);

  summary.dominantFramework = Object.entries(frameworkCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  summary.dominantLanguage = Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // Generate recommendations for backend services
  if (stack.backendFrameworks.includes('nestjs')) {
    recommendations.push({
      templateId: 'nestjs',
      templateName: 'NestJS Service',
      category: 'backend',
      framework: 'nestjs',
      confidence: 0.95,
      reasons: [
        'Existing NestJS services detected in workspace',
        'Consistent with current architecture',
        'TypeScript-based',
        'Built-in dependency injection',
      ],
      warnings: [],
      changes: [],
    });
  }

  if (stack.backendFrameworks.includes('express')) {
    recommendations.push({
      templateId: 'express',
      templateName: 'Express Service',
      category: 'backend',
      framework: 'express',
      confidence: 0.90,
      reasons: [
        'Existing Express services detected',
        'Lightweight and flexible',
        'Large ecosystem',
      ],
      warnings: [
        'Consider NestJS for better structure and DI',
      ],
      changes: [],
    });
  }

  // Generate recommendations for frontend services
  if (stack.frontendFrameworks.includes('react')) {
    recommendations.push({
      templateId: 'react',
      templateName: 'React Application',
      category: 'frontend',
      framework: 'react',
      confidence: 0.95,
      reasons: [
        'Existing React apps detected',
        'Component-based architecture',
        'Large ecosystem',
      ],
      warnings: stack.languages.includes('typescript') ? [] : ['Consider TypeScript for better type safety'],
      changes: stack.languages.includes('typescript') ? [] : ['Add TypeScript support'],
    });
  }

  if (stack.frontendFrameworks.includes('vue')) {
    recommendations.push({
      templateId: 'vue',
      templateName: 'Vue Application',
      category: 'frontend',
      framework: 'vue',
      confidence: 0.92,
      reasons: [
        'Existing Vue apps detected',
        'Progressive framework',
        'Excellent documentation',
      ],
      warnings: [],
      changes: [],
    });
  }

  // Generate recommendations based on testing frameworks
  if (stack.testingFrameworks.includes('jest')) {
    const jestRec = recommendations.find(r => r.framework === 'nestjs' || r.framework === 'react');
    if (jestRec) {
      jestRec.reasons.push('Jest testing already configured');
      jestRec.confidence = Math.min(jestRec.confidence + 0.05, 1.0);
    }
  }

  // Generate recommendations based on databases
  if (stack.databases.includes('prisma')) {
    const backendRec = recommendations.find(r => r.category === 'backend');
    if (backendRec) {
      backendRec.reasons.push('Prisma ORM already in use');
      backendRec.changes.push('Include Prisma schema');
    } else {
      recommendations.push({
        templateId: 'nestjs-prisma',
        templateName: 'NestJS with Prisma',
        category: 'backend',
        framework: 'nestjs',
        confidence: 0.88,
        reasons: [
          'Prisma ORM available in workspace',
          'Type-safe database access',
          'Excellent TypeScript support',
        ],
        warnings: [],
        changes: ['Configure Prisma schema', 'Set up database connection'],
      });
    }
  }

  // Generate recommendations based on styling
  if (stack.styling.includes('tailwind')) {
    const frontendRec = recommendations.find(r => r.category === 'frontend');
    if (frontendRec) {
      frontendRec.reasons.push('Tailwind CSS already configured');
      frontendRec.confidence = Math.min(frontendRec.confidence + 0.03, 1.0);
    }
  }

  // Sort by confidence
  recommendations.sort((a, b) => b.confidence - a.confidence);

  return {
    recommendations,
    stack,
    summary,
  };
}

/**
 * Display template selection results
 */
export async function displayTemplateSelectionResults(
  result: TemplateSelectionResult
): Promise<void> {
  console.log(chalk.bold('\n📊 Project Stack Analysis\n'));

  // Display summary
  console.log(chalk.cyan('Summary:'));
  console.log(`  Total Services: ${result.summary.totalServices}`);
  console.log(`  Backend Services: ${result.summary.backendServices}`);
  console.log(`  Frontend Services: ${result.summary.frontendServices}`);
  console.log(`  Dominant Framework: ${chalk.yellow(result.summary.dominantFramework || 'None')}`);
  console.log(`  Dominant Language: ${chalk.yellow(result.summary.dominantLanguage || 'None')}`);

  // Display frameworks
  console.log(chalk.cyan('\nFrameworks:'));
  if (result.stack.backendFrameworks.length > 0) {
    console.log(`  Backend: ${result.stack.backendFrameworks.map(f => chalk.green(f)).join(', ')}`);
  }
  if (result.stack.frontendFrameworks.length > 0) {
    console.log(`  Frontend: ${result.stack.frontendFrameworks.map(f => chalk.green(f)).join(', ')}`);
  }
  if (result.stack.languages.length > 0) {
    console.log(`  Languages: ${result.stack.languages.map(l => chalk.blue(l)).join(', ')}`);
  }

  // Display testing
  if (result.stack.testingFrameworks.length > 0) {
    console.log(chalk.cyan('\nTesting:'));
    console.log(`  Frameworks: ${result.stack.testingFrameworks.map(t => chalk.magenta(t)).join(', ')}`);
  }

  // Display databases
  if (result.stack.databases.length > 0) {
    console.log(chalk.cyan('\nDatabases:'));
    console.log(`  ORMs/ODMs: ${result.stack.databases.map(d => chalk.yellow(d)).join(', ')}`);
  }

  // Display patterns
  if (result.stack.patterns.length > 0) {
    console.log(chalk.cyan('\nDetected Patterns:'));
    for (const pattern of result.stack.patterns.slice(0, 10)) {
      const confidence = Math.round(pattern.confidence * 100);
      console.log(`  ${chalk.green('●')} ${pattern.description} ${chalk.gray(`(${pattern.examples} examples, ${confidence}% confidence)`)}`);
    }
  }

  // Display recommendations
  console.log(chalk.bold('\n💡 Template Recommendations\n'));

  if (result.recommendations.length === 0) {
    console.log(chalk.yellow('No specific recommendations based on current stack.'));
    console.log(chalk.gray('Use --backend or --frontend option to specify a framework.'));
    return;
  }

  for (const rec of result.recommendations) {
    const confidence = Math.round(rec.confidence * 100);
    console.log(chalk.bold(`${rec.templateName} ${chalk.green(`(${confidence}%)`)}`));
    console.log(chalk.gray(`  Framework: ${rec.framework}`));
    console.log(chalk.gray(`  Category: ${rec.category}`));

    if (rec.reasons.length > 0) {
      console.log(chalk.cyan('  Reasons:'));
      for (const reason of rec.reasons) {
        console.log(`    ${chalk.green('✓')} ${reason}`);
      }
    }

    if (rec.warnings.length > 0) {
      console.log(chalk.yellow('  Warnings:'));
      for (const warning of rec.warnings) {
        console.log(`    ${chalk.yellow('⚠')} ${warning}`);
      }
    }

    if (rec.changes.length > 0) {
      console.log(chalk.blue('  Suggested Changes:'));
      for (const change of rec.changes) {
        console.log(`    ${chalk.blue('→')} ${change}`);
      }
    }

    console.log();
  }
}

/**
 * Get best matching template for given criteria
 */
export async function getBestMatchingTemplate(
  workspacePath: string,
  category: 'backend' | 'frontend' | 'fullstack'
): Promise<TemplateRecommendation | null> {
  const result = await recommendTemplates(workspacePath);
  const matches = result.recommendations.filter(r => r.category === category || category === 'fullstack');
  return matches.length > 0 ? matches[0] : null;
}
