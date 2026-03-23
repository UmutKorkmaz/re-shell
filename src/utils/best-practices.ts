import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Best Practice Enforcement
 *
 * Enforces framework-specific and language-specific best practices
 * with linting, validation, and auto-fix capabilities.
 */

export interface BestPracticeRule {
  id: string;
  name: string;
  category: 'security' | 'performance' | 'maintainability' | 'reliability' | 'code-style' | 'architecture';
  framework?: string;
  language?: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  pattern?: RegExp | string;
  antiPattern?: RegExp | string;
  fix?: string;
  autoFixable: boolean;
  documentation?: string;
  suggestion?: string;
}

export interface LintingViolation {
  rule: BestPracticeRule;
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
}

export interface BestPracticeReport {
  framework: string;
  language: string;
  totalViolations: number;
  errors: number;
  warnings: number;
  info: number;
  violations: LintingViolation[];
  autoFixable: number;
  summary: {
    security: number;
    performance: number;
    maintainability: number;
    reliability: number;
    codeStyle: number;
    architecture: number;
  };
}

export interface LintingConfig {
  framework: string;
  language: string;
  rules: Record<string, 'error' | 'warning' | 'info' | 'off'>;
  overrides?: Record<string, any>;
  autoFix: boolean;
}

/**
 * Best practice rules for different frameworks and languages
 */
export const BEST_PRACTICE_RULES: BestPracticeRule[] = [
  // TypeScript/JavaScript Security Rules
  {
    id: 'ts-no-any',
    name: 'Avoid using any type',
    category: 'maintainability',
    language: 'typescript',
    severity: 'warning',
    description: 'Using any defeats the purpose of TypeScript type checking',
    antiPattern: /\bany\b/g,
    autoFixable: false,
    documentation: 'https://www.typescriptlang.org/docs/handbook/2/basic-types.html#any',
  },
  {
    id: 'ts-no-eval',
    name: 'Avoid using eval()',
    category: 'security',
    language: 'typescript',
    severity: 'error',
    description: 'eval() is dangerous and can lead to code injection attacks',
    antiPattern: /\beval\s*\(/g,
    autoFixable: false,
    documentation: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#security',
  },
  {
    id: 'ts-no-inner-html',
    name: 'Avoid using innerHTML',
    category: 'security',
    language: 'typescript',
    severity: 'error',
    description: 'innerHTML can lead to XSS vulnerabilities',
    antiPattern: /\.innerHTML\s*=/g,
    autoFixable: false,
    suggestion: 'Use textContent or DOM manipulation methods instead',
    documentation: 'https://owasp.org/www-community/attacks/xss/',
  },

  // React Best Practices
  {
    id: 'react-hooks-deps',
    name: 'React Hooks dependencies',
    category: 'reliability',
    framework: 'react',
    language: 'typescript',
    severity: 'error',
    description: 'React Hooks dependencies must be declared correctly',
    pattern: /useEffect|useMemo|useCallback/,
    autoFixable: true,
    documentation: 'https://react.dev/reference/react',
  },
  {
    id: 'react-key-prop',
    name: 'React key prop',
    category: 'performance',
    framework: 'react',
    language: 'typescript',
    severity: 'warning',
    description: 'Lists should have a key prop for efficient rendering',
    pattern: /\.map\(/,
    autoFixable: true,
    suggestion: 'Add a unique key prop to each list item',
    documentation: 'https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key',
  },
  {
    id: 'react-no-direct-mutation',
    name: 'No direct state mutation',
    category: 'reliability',
    framework: 'react',
    language: 'typescript',
    severity: 'error',
    description: 'Direct state mutation can cause unexpected behavior',
    autoFixable: false,
    documentation: 'https://react.dev/learn/updating-objects-in-state',
  },

  // NestJS Best Practices
  {
    id: 'nest-injectable',
    name: 'Use @Injectable() decorator',
    category: 'architecture',
    framework: 'nestjs',
    language: 'typescript',
    severity: 'error',
    description: 'Services should use @Injectable() for dependency injection',
    pattern: /class\s+\w+Service/,
    autoFixable: true,
    suggestion: 'Add @Injectable() decorator to the service class',
    documentation: 'https://docs.nestjs.com/providers',
  },
  {
    id: 'nest-input-validation',
    name: 'Validate input DTOs',
    category: 'security',
    framework: 'nestjs',
    language: 'typescript',
    severity: 'error',
    description: 'Controller methods should validate input with DTOs',
    pattern: /@Body\(\)|@Query\(\)|@Param\(\)/,
    autoFixable: false,
    suggestion: 'Use class-validator decorators on DTO classes',
    documentation: 'https://docs.nestjs.com/techniques/validation',
  },
  {
    id: 'nest-api-response',
    name: 'Use typed API responses',
    category: 'maintainability',
    framework: 'nestjs',
    language: 'typescript',
    severity: 'warning',
    description: 'Controller methods should have return types',
    autoFixable: true,
    suggestion: 'Add return type annotations to controller methods',
    documentation: 'https://docs.nestjs.com/controllers',
  },

  // Express Best Practices
  {
    id: 'express-error-handling',
    name: 'Use error handling middleware',
    category: 'reliability',
    framework: 'express',
    language: 'typescript',
    severity: 'error',
    description: 'Express apps should have error handling middleware',
    autoFixable: false,
    suggestion: 'Add app.use((err, req, res, next) => {...})',
    documentation: 'https://expressjs.com/en/guide/error-handling.html',
  },
  {
    id: 'express-helmet',
    name: 'Use Helmet for security',
    category: 'security',
    framework: 'express',
    language: 'typescript',
    severity: 'warning',
    description: 'Express apps should use Helmet for HTTP headers',
    autoFixable: true,
    suggestion: 'Add app.use(helmet()) to middleware',
    documentation: 'https://helmetjs.github.io/',
  },
  {
    id: 'express-rate-limit',
    name: 'Use rate limiting',
    category: 'security',
    framework: 'express',
    language: 'typescript',
    severity: 'warning',
    description: 'Express apps should implement rate limiting',
    autoFixable: true,
    suggestion: 'Add express-rate-limit middleware',
    documentation: 'https://github.com/nfriedly/express-rate-limit',
  },

  // Vue Best Practices
  {
    id: 'vue-component-name',
    name: 'Use multi-word component names',
    category: 'code-style',
    framework: 'vue',
    language: 'typescript',
    severity: 'warning',
    description: 'Component names should be multi-word to avoid conflicts',
    autoFixable: true,
    documentation: 'https://vuejs.org/style-guide/rules-strongly-recommended.html#Multi-word-component-names-strongly-recommended',
  },
  {
    id: 'vue-props-definition',
    name: 'Define props with validation',
    category: 'reliability',
    framework: 'vue',
    language: 'typescript',
    severity: 'warning',
    description: 'Props should have type definitions and default values',
    autoFixable: true,
    documentation: 'https://vuejs.org/guide/components/props.html#prop-validation',
  },

  // Performance Best Practices
  {
    id: 'perf-no-unnecessary-computations',
    name: 'Avoid unnecessary computations in render',
    category: 'performance',
    language: 'typescript',
    severity: 'warning',
    description: 'Move expensive computations outside render methods',
    autoFixable: false,
    suggestion: 'Use useMemo for expensive computations',
  },
  {
    id: 'perf-lazy-loading',
    name: 'Use lazy loading for routes',
    category: 'performance',
    language: 'typescript',
    severity: 'info',
    description: 'Lazy load routes to reduce initial bundle size',
    autoFixable: true,
    suggestion: 'Use dynamic import() for route components',
  },

  // Code Style Rules
  {
    id: 'style-naming-convention',
    name: 'Follow naming conventions',
    category: 'code-style',
    language: 'typescript',
    severity: 'warning',
    description: 'Components: PascalCase, functions: camelCase, constants: UPPER_SNAKE_CASE',
    autoFixable: false,
    suggestion: 'Use consistent naming conventions throughout the codebase',
  },
  {
    id: 'style-max-line-length',
    name: 'Limit line length',
    category: 'code-style',
    language: 'typescript',
    severity: 'warning',
    description: 'Lines should not exceed 100 characters',
    autoFixable: false,
    suggestion: 'Break long lines into multiple lines',
  },
];

/**
 * Detect framework and language from project
 */
export async function detectFrameworkAndLanguage(
  projectPath: string
): Promise<{ framework: string; language: string }> {
  const pkgJsonPath = path.join(projectPath, 'package.json');

  if (!(await fs.pathExists(pkgJsonPath))) {
    return { framework: 'unknown', language: 'typescript' };
  }

  const pkgJson = await fs.readJson(pkgJsonPath);
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

  // Detect framework
  let framework = 'unknown';
  if (deps.react || deps['@types/react']) framework = 'react';
  else if (deps.vue) framework = 'vue';
  else if (deps['@angular/core']) framework = 'angular';
  else if (deps['@nestjs/core']) framework = 'nestjs';
  else if (deps.express || deps.express) framework = 'express';
  else if (deps.fastify) framework = 'fastify';
  else if (deps.svelte) framework = 'svelte';

  // Detect language
  let language = 'typescript';
  if (pkgJson.types || deps.typescript) {
    language = 'typescript';
  } else if (deps.babel || deps['@babel/core']) {
    language = 'javascript';
  }

  return { framework, language };
}

/**
 * Get applicable rules for a framework and language
 */
export function getApplicableRules(
  framework: string,
  language: string
): BestPracticeRule[] {
  return BEST_PRACTICE_RULES.filter(rule => {
    if (rule.language && rule.language !== language) return false;
    if (rule.framework && rule.framework !== framework) return false;
    return true;
  });
}

/**
 * Scan files for best practice violations
 */
export async function scanForViolations(
  projectPath: string,
  framework?: string,
  language?: string
): Promise<BestPracticeReport> {
  const detected = await detectFrameworkAndLanguage(projectPath);
  const targetFramework = framework || detected.framework;
  const targetLanguage = language || detected.language;

  const rules = getApplicableRules(targetFramework, targetLanguage);
  const violations: LintingViolation[] = [];

  // Scan source files
  const srcPath = path.join(projectPath, 'src');
  if (await fs.pathExists(srcPath)) {
    await scanDirectory(srcPath, rules, violations);
  }

  // Build report
  const report: BestPracticeReport = {
    framework: targetFramework,
    language: targetLanguage,
    totalViolations: violations.length,
    errors: violations.filter(v => v.severity === 'error').length,
    warnings: violations.filter(v => v.severity === 'warning').length,
    info: violations.filter(v => v.severity === 'info').length,
    violations,
    autoFixable: violations.filter(v => v.rule.autoFixable).length,
    summary: {
      security: violations.filter(v => v.rule.category === 'security').length,
      performance: violations.filter(v => v.rule.category === 'performance').length,
      maintainability: violations.filter(v => v.rule.category === 'maintainability').length,
      reliability: violations.filter(v => v.rule.category === 'reliability').length,
      codeStyle: violations.filter(v => v.rule.category === 'code-style').length,
      architecture: violations.filter(v => v.rule.category === 'architecture').length,
    },
  };

  return report;
}

/**
 * Recursively scan directory for violations
 */
async function scanDirectory(
  dirPath: string,
  rules: BestPracticeRule[],
  violations: LintingViolation[]
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and other common directories
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.next' ||
        entry.name === 'coverage'
      ) {
        continue;
      }
      await scanDirectory(fullPath, rules, violations);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|vue)$/.test(entry.name)) {
      await scanFile(fullPath, rules, violations);
    }
  }
}

/**
 * Scan file for violations
 */
async function scanFile(
  filePath: string,
  rules: BestPracticeRule[],
  violations: LintingViolation[]
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const rule of rules) {
    // Check for anti-patterns
    if (rule.antiPattern) {
      const pattern = rule.antiPattern instanceof RegExp ? rule.antiPattern : new RegExp(rule.antiPattern, 'g');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.matchAll(pattern);

        for (const match of matches) {
          if (match.index !== undefined) {
            violations.push({
              rule,
              file: path.relative(process.cwd(), filePath),
              line: i + 1,
              column: match.index + 1,
              message: rule.description,
              severity: rule.severity,
              code: line.trim(),
              suggestion: rule.suggestion,
            });
          }
        }
      }
    }
  }
}

/**
 * Display best practice report
 */
export async function displayBestPracticeReport(report: BestPracticeReport): Promise<void> {
  console.log(chalk.bold(`\n📋 Best Practice Report\n`));
  console.log(chalk.cyan(`Framework: ${report.framework}`));
  console.log(chalk.cyan(`Language: ${report.language}\n`));

  // Display summary
  console.log(chalk.bold('Summary:'));
  console.log(`  Total Violations: ${report.totalViolations}`);
  console.log(`  ${chalk.red('Errors:')} ${report.errors}`);
  console.log(`  ${chalk.yellow('Warnings:')} ${report.warnings}`);
  console.log(`  ${chalk.blue('Info:')} ${report.info}`);
  console.log(`  ${chalk.green('Auto-fixable:')} ${report.autoFixable}\n`);

  // Display category breakdown
  console.log(chalk.bold('By Category:'));
  const categories = [
    { name: 'Security', count: report.summary.security, color: chalk.red },
    { name: 'Performance', count: report.summary.performance, color: chalk.yellow },
    { name: 'Maintainability', count: report.summary.maintainability, color: chalk.blue },
    { name: 'Reliability', count: report.summary.reliability, color: chalk.magenta },
    { name: 'Code Style', count: report.summary.codeStyle, color: chalk.cyan },
    { name: 'Architecture', count: report.summary.architecture, color: chalk.green },
  ];

  for (const category of categories) {
    if (category.count > 0) {
      console.log(`  ${category.color(category.name)}: ${category.count}`);
    }
  }

  console.log('');

  // Display violations grouped by file
  if (report.violations.length > 0) {
    const violationsByFile = report.violations.reduce((acc, v) => {
      if (!acc[v.file]) acc[v.file] = [];
      acc[v.file].push(v);
      return acc;
    }, {} as Record<string, LintingViolation[]>);

    for (const [file, fileViolations] of Object.entries(violationsByFile)) {
      console.log(chalk.bold(`\n${chalk.gray(file)} (${fileViolations.length} issues)\n`));

      for (const violation of fileViolations.slice(0, 10)) {
        const severityIcon =
          violation.severity === 'error'
            ? chalk.red('✗')
            : violation.severity === 'warning'
            ? chalk.yellow('⚠')
            : chalk.blue('ℹ');

        console.log(
          `  ${severityIcon} Line ${violation.line}: ${chalk.bold(violation.rule.name)} [${chalk.gray(violation.rule.id)}]`
        );
        console.log(`    ${violation.message}`);
        if (violation.suggestion) {
          console.log(`    ${chalk.gray('→')} ${chalk.green(violation.suggestion)}`);
        }
        if (violation.code) {
          console.log(`    ${chalk.gray(violation.code)}`);
        }
      }

      if (fileViolations.length > 10) {
        console.log(chalk.gray(`    ... and ${fileViolations.length - 10} more`));
      }
    }
  } else {
    console.log(chalk.green('\n✓ No violations found! Your code follows best practices.\n'));
  }

  // Display recommendations
  if (report.autoFixable > 0) {
    console.log(chalk.yellow(`\n💡 ${report.autoFixable} issue(s) can be auto-fixed.`));
    console.log(chalk.gray('Run: re-shell best-practices-fix\n'));
  }
}

/**
 * Generate linting configuration
 */
export async function generateLintingConfig(
  framework: string,
  language: string,
  outputPath: string
): Promise<void> {
  const rules = getApplicableRules(framework, language);
  const config: LintingConfig = {
    framework,
    language,
    rules: {},
    autoFix: true,
  };

  // Set severity for each rule
  for (const rule of rules) {
    config.rules[rule.id] = rule.severity;
  }

  // Write configuration
  await fs.writeJson(outputPath, config, { spaces: 2 });

  console.log(chalk.green(`\n✓ Linting configuration written to ${outputPath}\n`));
}

/**
 * Export best practice rules as JSON
 */
export function exportRulesAsJSON(): string {
  return JSON.stringify(BEST_PRACTICE_RULES, null, 2);
}

/**
 * Get rule by ID
 */
export function getRuleById(id: string): BestPracticeRule | undefined {
  return BEST_PRACTICE_RULES.find(rule => rule.id === id);
}

/**
 * Get rules by category
 */
export function getRulesByCategory(category: BestPracticeRule['category']): BestPracticeRule[] {
  return BEST_PRACTICE_RULES.filter(rule => rule.category === category);
}
