import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Framework detection and intelligent defaults
 * Analyze existing project structure and recommend optimal configurations
 */

/**
 * Represents a framework that was detected in the analyzed project.
 *
 * Contains metadata about the framework such as its name, the primary
 * language it expects, an optional version, a confidence score between
 * 0 and 1, and the supporting evidence (files and dependencies) that
 * contributed to the detection.
 */
export interface DetectedFramework {
  /** The human-readable name of the detected framework (e.g. "react", "vue"). */
  name: string;
  /** The primary language associated with the framework (e.g. "javascript", "typescript"). */
  language: string;
  /** Optional detected version of the framework, when available. */
  version?: string;
  /** Confidence score of the detection, expressed as a value between 0 and 1. */
  confidence: number; // 0-1
  /** List of file paths that matched the framework's detection pattern. */
  files: string[];
  /** Runtime dependencies that indicate the presence of this framework. */
  dependencies: string[];
  /** Development dependencies that indicate the presence of this framework. */
  devDependencies: string[];
}

/**
 * The full result of analyzing a project directory.
 *
 * Aggregates every piece of information gathered during the analysis,
 * including detected frameworks, primary language/framework, package
 * manager, build tool, testing framework, TypeScript presence, and the
 * generated configuration recommendations.
 */
export interface ProjectAnalysis {
  /** Frameworks detected in the project, ordered by descending confidence. */
  frameworks: DetectedFramework[];
  /** The most frequently detected language across the detected frameworks. */
  primaryLanguage: string;
  /** The name of the framework with the highest confidence, if any was detected. */
  primaryFramework?: string;
  /** The package manager inferred from lock files found in the project. */
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  /** The build tool inferred from the project's dependencies. */
  buildTool: 'webpack' | 'vite' | 'rollup' | 'esbuild' | 'tsc' | 'unknown';
  /** The testing framework inferred from the project's dependencies. */
  testingFramework: 'jest' | 'vitest' | 'mocha' | 'jasmine' | 'unknown';
  /** Whether the project appears to use TypeScript. */
  hasTypeScript: boolean;
  /** Generated configuration recommendations tailored to the project. */
  recommendedConfig: ProjectRecommendations;
}

/**
 * Configuration recommendations produced for an analyzed project.
 *
 * Includes the suggested dev server port, build target, dev server
 * options, environment variables, npm scripts, and any additional
 * runtime or development dependencies that should be installed.
 */
export interface ProjectRecommendations {
  /** The recommended port the dev server should listen on. */
  port: number;
  /** The recommended JavaScript/TypeScript build target (e.g. "es2020"). */
  buildTarget: string;
  /** Options for the recommended development server configuration. */
  devServer: {
    /** Whether Hot Module Replacement (HMR) should be enabled. */
    hmr: boolean;
    /** Whether CORS should be enabled on the dev server. */
    cors: boolean;
    /** The host the dev server should bind to. */
    host: string;
  };
  /** Suggested environment variables for the project. */
  envVars: string[];
  /** Suggested npm scripts to add to the project. */
  scripts: string[];
  /** Additional runtime dependencies recommended for the project. */
  dependencies: string[];
  /** Additional development dependencies recommended for the project. */
  devDependencies: string[];
}

// Framework detection patterns
const FRAMEWORK_PATTERNS: Record<string, {
  files: string[];
  dependencies: string[];
  devDependencies: string[];
  language: string;
  recommended?: any;
}> = {
  react: {
    files: ['src/App.jsx', 'src/App.js', 'src/App.tsx', 'public/index.html'],
    dependencies: ['react', 'react-dom'],
    devDependencies: ['@types/react', '@vitejs/plugin-react'],
    language: 'javascript',
    recommended: {
      port: 3000,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  vue: {
    files: ['src/App.vue', 'src/main.js', 'public/index.html'],
    dependencies: ['vue'],
    devDependencies: ['@vitejs/plugin-vue'],
    language: 'javascript',
    recommended: {
      port: 5173,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  svelte: {
    files: ['src/App.svelte', 'src/main.js'],
    dependencies: ['svelte'],
    devDependencies: ['@sveltejs/vite-plugin-svelte'],
    language: 'javascript',
    recommended: {
      port: 5173,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  angular: {
    files: ['src/main.ts', 'angular.json', 'src/index.html'],
    dependencies: ['@angular/core', '@angular/common'],
    devDependencies: ['@angular/compiler-cli'],
    language: 'typescript',
    recommended: {
      port: 4200,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  nextjs: {
    files: ['pages/_app.js', 'pages/index.js', 'next.config.js'],
    dependencies: ['next', 'react'],
    devDependencies: [],
    language: 'typescript',
    recommended: {
      port: 3000,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  nuxt: {
    files: ['pages/index.vue', 'nuxt.config.js'],
    dependencies: ['nuxt', 'vue'],
    devDependencies: [],
    language: 'typescript',
    recommended: {
      port: 3000,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  express: {
    files: ['src/server.js', 'app.js', 'server.js'],
    dependencies: ['express'],
    devDependencies: ['@types/express'],
    language: 'javascript',
    recommended: {
      port: 3000,
      hmr: false,
      buildTarget: 'es2020',
    },
  },
  fastify: {
    files: ['src/server.js', 'app.js'],
    dependencies: ['fastify'],
    devDependencies: ['@types/fastify'],
    language: 'javascript',
    recommended: {
      port: 3000,
      hmr: false,
      buildTarget: 'es2020',
    },
  },
  nestjs: {
    files: ['src/main.ts', 'nest-cli.json'],
    dependencies: ['@nestjs/core', '@nestjs/common'],
    devDependencies: ['@nestjs/cli'],
    language: 'typescript',
    recommended: {
      port: 3000,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  sveltekit: {
    files: ['src/routes/+page.svelte', 'svelte.config.js'],
    dependencies: ['@sveltejs/kit'],
    devDependencies: ['svelte'],
    language: 'typescript',
    recommended: {
      port: 5173,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
  solid: {
    files: ['src/App.jsx', 'src/App.tsx'],
    dependencies: ['solid-js'],
    devDependencies: ['vite-plugin-solid'],
    language: 'typescript',
    recommended: {
      port: 3000,
      hmr: true,
      buildTarget: 'es2020',
    },
  },
};

// Backend framework patterns
const BACKEND_FRAMEWORKS: Record<string, {
  files: string[];
  dependencies: string[];
  language: string;
  recommended?: any;
}> = {
  express: {
    files: ['src/index.js', 'server.js'],
    dependencies: ['express'],
    language: 'javascript',
    recommended: { port: 3000 },
  },
  fastify: {
    files: ['src/index.js', 'server.js'],
    dependencies: ['fastify'],
    language: 'javascript',
    recommended: { port: 3000 },
  },
  nestjs: {
    files: ['src/main.ts'],
    dependencies: ['@nestjs/core'],
    language: 'typescript',
    recommended: { port: 3000 },
  },
  django: {
    files: ['manage.py', 'settings.py'],
    dependencies: [],
    language: 'python',
    recommended: { port: 8000 },
  },
  flask: {
    files: ['app.py', 'wsgi.py'],
    dependencies: ['flask'],
    language: 'python',
    recommended: { port: 5000 },
  },
  spring: {
    files: ['src/main/java', 'pom.xml'],
    dependencies: ['spring-boot'],
    language: 'java',
    recommended: { port: 8080 },
  },
};

/**
 * Detect frameworks present in the given project directory.
 *
 * Reads the project's package.json (when present) and checks each known
 * framework pattern against the filesystem and declared dependencies.
 * Frameworks are returned sorted by descending confidence, and only
 * frameworks with a confidence greater than zero are included.
 *
 * If package.json exists but cannot be parsed, a warning is emitted and
 * detection continues with dependency-based checks effectively skipped.
 *
 * @param cwd - The directory to analyze. Defaults to the current working directory.
 * @returns A promise that resolves to an array of detected frameworks, sorted by confidence.
 */
export async function detectFrameworks(cwd: string = process.cwd()): Promise<DetectedFramework[]> {
  const detected: DetectedFramework[] = [];

  // Check for package.json
  const packageJsonPath = path.join(cwd, 'package.json');
  let packageJson: Record<string, unknown> = {};

  if (await fs.pathExists(packageJsonPath)) {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8');
      packageJson = JSON.parse(content);
    } catch (error) {
      // Invalid package.json — warn so the user knows their file is malformed
      console.warn(`Warning: could not parse ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Check each framework pattern
  for (const [frameworkName, pattern] of Object.entries(FRAMEWORK_PATTERNS)) {
    const confidence = calculateFrameworkConfidence(cwd, packageJson, pattern);

    if (confidence > 0) {
      detected.push({
        name: frameworkName,
        language: pattern.language,
        confidence,
        files: pattern.files,
        dependencies: pattern.dependencies,
        devDependencies: pattern.devDependencies,
      });
    }
  }

  // Sort by confidence
  detected.sort((a, b) => b.confidence - a.confidence);

  return detected;
}

/**
 * Analyze a project directory and produce a full report with recommendations.
 *
 * Runs framework detection, determines the primary language and framework,
 * infers the package manager, build tool, and testing framework, checks for
 * TypeScript usage, and finally generates tailored configuration
 * recommendations.
 *
 * If package.json exists but cannot be parsed, a warning is emitted and the
 * analysis continues with best-effort results.
 *
 * @param cwd - The directory to analyze. Defaults to the current working directory.
 * @returns A promise that resolves to a complete {@link ProjectAnalysis} object.
 */
export async function analyzeProject(cwd: string = process.cwd()): Promise<ProjectAnalysis> {
  const frameworks = await detectFrameworks(cwd);

  // Load package.json for other detections
  const packageJsonPath = path.join(cwd, 'package.json');
  let packageJson: Record<string, unknown> = {};

  if (await fs.pathExists(packageJsonPath)) {
    try {
      const content = await fs.readFile(packageJsonPath, 'utf8');
      packageJson = JSON.parse(content);
    } catch (error) {
      // Invalid package.json — warn so the user knows their file is malformed
      console.warn(`Warning: could not parse ${packageJsonPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Determine primary language
  const languageCounts: Record<string, number> = {};
  for (const fw of frameworks) {
    languageCounts[fw.language] = (languageCounts[fw.language] || 0) + 1;
  }

  const primaryLanguage = Object.entries(languageCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'javascript';

  const primaryFramework = frameworks[0]?.name;

  // Detect package manager
  const packageManager = await detectPackageManager(cwd);

  // Detect build tool
  const buildTool = await detectBuildTool(cwd, packageJson);

  // Detect testing framework
  const testingFramework = await detectTestingFramework(cwd, packageJson);

  // Check for TypeScript
  const hasTypeScript = await fs.pathExists(path.join(cwd, 'tsconfig.json')) ||
                       primaryLanguage === 'typescript';

  // Generate recommendations
  const recommendedConfig = generateRecommendations(
    primaryFramework,
    primaryLanguage,
    hasTypeScript,
    frameworks
  );

  return {
    frameworks,
    primaryLanguage,
    primaryFramework,
    packageManager,
    buildTool,
    testingFramework,
    hasTypeScript,
    recommendedConfig,
  };
}

/**
 * Print a human-readable project analysis and its recommendations to stdout.
 *
 * Runs {@link analyzeProject} for the given directory and renders the
 * results using colored console output, including detected frameworks
 * with confidence bars, project characteristics (language, package
 * manager, build tool, testing framework, TypeScript status), and the
 * recommended configuration (port, build target, dev server options,
 * suggested environment variables and scripts).
 *
 * @param cwd - The directory to analyze. Defaults to the current working directory.
 * @returns A promise that resolves once the analysis has been printed.
 */
export async function showProjectAnalysis(cwd: string = process.cwd()): Promise<void> {
  console.log(chalk.cyan.bold('\n🔍 Analyzing Project Structure\n'));

  const analysis = await analyzeProject(cwd);

  // Detected frameworks
  console.log(chalk.white('Detected Frameworks:'));
  if (analysis.frameworks.length === 0) {
    console.log(chalk.gray('  No frameworks detected\n'));
  } else {
    for (const fw of analysis.frameworks) {
      const confidenceBar = '█'.repeat(Math.floor(fw.confidence * 10));
      const confidencePercent = Math.floor(fw.confidence * 100);
      console.log(chalk.cyan(`  ${fw.name}`));
      console.log(chalk.gray(`    Language: ${fw.language}`));
      console.log(chalk.gray(`    Confidence: ${confidencePercent}% ${chalk.green(confidenceBar)}`));
      console.log('');
    }
  }

  // Project characteristics
  console.log(chalk.white('Project Characteristics:'));
  console.log(chalk.gray(`  Primary Language: ${analysis.primaryLanguage}`));
  console.log(chalk.gray(`  Package Manager: ${analysis.packageManager}`));
  console.log(chalk.gray(`  Build Tool: ${analysis.buildTool}`));
  console.log(chalk.gray(`  Testing: ${analysis.testingFramework}`));
  console.log(chalk.gray(`  TypeScript: ${analysis.hasTypeScript ? '✓' : '✗'}\n`));

  // Recommendations
  console.log(chalk.white('Recommended Configuration:'));
  console.log(chalk.gray(`  Port: ${analysis.recommendedConfig.port}`));
  console.log(chalk.gray(`  Build Target: ${analysis.recommendedConfig.buildTarget}`));
  console.log(chalk.gray(`  HMR: ${analysis.recommendedConfig.devServer.hmr ? 'enabled' : 'disabled'}`));
  console.log(chalk.gray(`  CORS: ${analysis.recommendedConfig.devServer.cors ? 'enabled' : 'disabled'}`));

  if (analysis.recommendedConfig.envVars.length > 0) {
    console.log(chalk.gray('\n  Suggested Environment Variables:'));
    analysis.recommendedConfig.envVars.forEach(envVar => {
      console.log(chalk.gray(`    ${envVar}`));
    });
  }

  if (analysis.recommendedConfig.scripts.length > 0) {
    console.log(chalk.gray('\n  Suggested Scripts:'));
    analysis.recommendedConfig.scripts.forEach(script => {
      console.log(chalk.gray(`    ${script}`));
    });
  }

  console.log('');
}

/**
 * Get recommended profile based on project analysis
 */
/**
 * Helper functions
 */

async function detectPackageManager(cwd: string): Promise<'npm' | 'yarn' | 'pnpm' | 'unknown'> {
  // Check for lock files
  if (await fs.pathExists(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (await fs.pathExists(path.join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (await fs.pathExists(path.join(cwd, 'package-lock.json'))) {
    return 'npm';
  }

  return 'unknown';
}

async function detectBuildTool(cwd: string, packageJson: any): Promise<'webpack' | 'vite' | 'rollup' | 'esbuild' | 'tsc' | 'unknown'> {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (allDeps.vite) return 'vite';
  if (allDeps.webpack) return 'webpack';
  if (allDeps.rollup) return 'rollup';
  if (allDeps.esbuild) return 'esbuild';
  if (allDeps.typescript) return 'tsc';

  return 'unknown';
}

async function detectTestingFramework(cwd: string, packageJson: any): Promise<'jest' | 'vitest' | 'mocha' | 'jasmine' | 'unknown'> {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  if (allDeps.vitest) return 'vitest';
  if (allDeps.jest) return 'jest';
  if (allDeps.mocha) return 'mocha';
  if (allDeps.jasmine) return 'jasmine';

  return 'unknown';
}

function calculateFrameworkConfidence(
  cwd: string,
  packageJson: any,
  pattern: any
): number {
  let confidence = 0;
  let totalChecks = 0;

  // Check files
  const fileChecks = pattern.files.length;
  totalChecks += fileChecks;

  for (const file of pattern.files) {
    if (fs.existsSync(path.join(cwd, file))) {
      confidence += 0.4 / fileChecks;
    }
  }

  // Check dependencies
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const depChecks = pattern.dependencies.length + pattern.devDependencies.length;
  totalChecks += depChecks;

  for (const dep of [...pattern.dependencies, ...pattern.devDependencies]) {
    if (allDeps[dep]) {
      confidence += 0.6 / depChecks;
    }
  }

  return Math.min(confidence, 1);
}

function generateRecommendations(
  primaryFramework: string | undefined,
  primaryLanguage: string,
  hasTypeScript: boolean,
  frameworks: DetectedFramework[]
): ProjectRecommendations {
  // Get framework-specific recommendations
  const frameworkPattern = primaryFramework ? FRAMEWORK_PATTERNS[primaryFramework] : null;

  const baseRec = frameworkPattern?.recommended || {
    port: 3000,
    hmr: true,
    buildTarget: hasTypeScript ? 'es2020' : 'esnext',
  };

  // Build env vars list based on framework and language
  const envVars: string[] = ['NODE_ENV'];

  if (primaryFramework === 'nextjs') {
    envVars.push('NEXT_PUBLIC_API_URL');
  } else if (primaryFramework === 'nuxt') {
    envVars.push('NUXT_PUBLIC_API_URL');
  } else if (primaryFramework?.includes('express') || primaryFramework === 'fastify' || primaryFramework === 'nestjs') {
    envVars.push('PORT', 'API_URL', 'DATABASE_URL');
  }

  if (primaryLanguage === 'typescript') {
    envVars.push('TS_NODE_PROJECT');
  }

  // Build scripts list
  const scripts: string[] = [];

  if (frameworkPattern) {
    if (primaryFramework === 'nextjs') {
      scripts.push('dev:next', 'build:next', 'start:next', 'lint:next');
    } else if (primaryFramework === 'react' || primaryFramework === 'vue' || primaryFramework === 'svelte') {
      scripts.push('dev:vite', 'build:vite', 'preview:vite');
    } else if (primaryFramework === 'nestjs') {
      scripts.push('start:nest', 'build:nest', 'start:dev:nest', 'start:prod:nest');
    } else if (primaryFramework === 'express' || primaryFramework === 'fastify') {
      scripts.push('dev:server', 'start:server', 'watch:server');
    }
  }

  if (hasTypeScript) {
    scripts.push('type-check');
  }

  // Dependencies based on language and framework
  const dependencies: string[] = [];
  const devDependencies: string[] = [];

  if (hasTypeScript) {
    devDependencies.push('typescript', '@types/node');
  }

  return {
    port: baseRec.port,
    buildTarget: baseRec.buildTarget,
    devServer: {
      hmr: baseRec.hmr,
      cors: true,
      host: 'localhost',
    },
    envVars,
    scripts,
    dependencies,
    devDependencies,
  };
}
