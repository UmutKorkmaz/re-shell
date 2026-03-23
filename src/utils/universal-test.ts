/**
 * Universal Testing Commands for All Frameworks and Languages
 * Provides cross-framework testing commands with unified interface
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import chalk from 'chalk';

// Test framework configuration
export interface TestFrameworkConfig {
  name: string;
  language: string;
  frameworks: string[];
  testCommand: string;
  testWatchCommand?: string;
  testCoverageCommand?: string;
  testFilePatterns: string[];
  configFileNames: string[];
  envVars?: Record<string, string>;
  dependencies?: string[];
  resultParser: 'tap' | 'jest' | 'pytest' | 'go' | 'rust' | 'generic';
}

// Test result
export interface TestResult {
  framework: string;
  language: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  failures: TestFailure[];
}

// Test failure details
export interface TestFailure {
  file: string;
  line: number;
  test: string;
  error: string;
  message: string;
}

// Test execution options
export interface TestOptions {
  pattern?: string;
  coverage?: boolean;
  watch?: boolean;
  verbose?: boolean;
  parallel?: boolean;
  updateSnapshot?: boolean;
  maxWorkers?: number;
}

// Universal test runner class
export class UniversalTestRunner extends EventEmitter {
  private projectPath: string;
  private frameworks: TestFrameworkConfig[];
  private detectedFrameworks: Set<string> = new Set();

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.frameworks = this.getSupportedFrameworks();
  }

  // Get all supported test frameworks
  getSupportedFrameworks(): TestFrameworkConfig[] {
    return [
      // JavaScript/TypeScript
      {
        name: 'jest',
        language: 'typescript',
        frameworks: ['react', 'vue', 'angular', 'node', 'nestjs', 'nextjs'],
        testCommand: 'jest',
        testWatchCommand: 'jest --watch',
        testCoverageCommand: 'jest --coverage',
        testFilePatterns: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.js', '**/*.test.jsx'],
        configFileNames: ['jest.config.js', 'jest.config.ts', 'package.json'],
        resultParser: 'jest',
      },
      {
        name: 'vitest',
        language: 'typescript',
        frameworks: ['vite', 'vue', 'react', 'svelte'],
        testCommand: 'vitest run',
        testWatchCommand: 'vitest',
        testCoverageCommand: 'vitest run --coverage',
        testFilePatterns: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
        configFileNames: ['vitest.config.ts', 'vite.config.ts'],
        resultParser: 'jest',
      },
      {
        name: 'mocha',
        language: 'typescript',
        frameworks: ['express', 'koa', 'hapi'],
        testCommand: 'mocha',
        testWatchCommand: 'mocha --watch',
        testCoverageCommand: 'nyc mocha',
        testFilePatterns: ['**/*.test.ts', '**/*.test.js'],
        configFileNames: ['.mocharc.js', '.mocharc.json', 'mocha.opts'],
        resultParser: 'tap',
      },
      // Python
      {
        name: 'pytest',
        language: 'python',
        frameworks: ['fastapi', 'django', 'flask', 'sanic', 'tornado'],
        testCommand: 'pytest',
        testWatchCommand: 'pytest-watch',
        testCoverageCommand: 'pytest --cov=. --cov-report=term-missing',
        testFilePatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py'],
        configFileNames: ['pytest.ini', 'pyproject.toml', 'setup.cfg', 'tox.ini'],
        envVars: { PYTHONDONTWRITEBYTECODE: '1' },
        resultParser: 'pytest',
      },
      {
        name: 'unittest',
        language: 'python',
        frameworks: ['django'],
        testCommand: 'python -m unittest discover',
        testCoverageCommand: 'coverage run -m unittest discover',
        testFilePatterns: ['**/test_*.py', '**/tests/**/*.py'],
        configFileNames: ['setup.cfg', '.unittest'],
        resultParser: 'generic',
      },
      // Go
      {
        name: 'go-test',
        language: 'go',
        frameworks: ['gin', 'echo', 'fiber', 'chi', 'stdlib'],
        testCommand: 'go test ./...',
        testWatchCommand: 'gotestsum --watch',
        testCoverageCommand: 'go test -cover ./...',
        testFilePatterns: ['**/*_test.go'],
        configFileNames: ['go.mod'],
        resultParser: 'go',
      },
      // Rust
      {
        name: 'cargo-test',
        language: 'rust',
        frameworks: ['actix', 'axum', 'rocket', 'stdlib'],
        testCommand: 'cargo test',
        testWatchCommand: 'cargo watch -x test',
        testCoverageCommand: 'cargo tarpaulin --out Html',
        testFilePatterns: ['**/*_test.rs', '**/tests/**/*.rs'],
        configFileNames: ['Cargo.toml'],
        resultParser: 'rust',
      },
      // Java
      {
        name: 'junit',
        language: 'java',
        frameworks: ['spring-boot', 'quarkus', 'micronaut'],
        testCommand: './gradlew test',
        testWatchCommand: './gradlew --continuous test',
        testCoverageCommand: './gradlew test jacocoTestReport',
        testFilePatterns: ['**/*Test.java', '**/src/test/**/*.java'],
        configFileNames: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        resultParser: 'generic',
      },
      {
        name: 'maven-test',
        language: 'java',
        frameworks: ['spring-boot-maven'],
        testCommand: 'mvn test',
        testCoverageCommand: 'mvn test jacoco:report',
        testFilePatterns: ['**/*Test.java'],
        configFileNames: ['pom.xml'],
        resultParser: 'generic',
      },
      // C#/.NET
      {
        name: 'dotnet-test',
        language: 'csharp',
        frameworks: ['aspnet-core', 'dotnet'],
        testCommand: 'dotnet test',
        testCoverageCommand: 'dotnet test --collect:"XPlat Code Coverage"',
        testFilePatterns: ['**/*Test.cs', '**/Tests/**/*.cs'],
        configFileNames: ['*.csproj'],
        resultParser: 'generic',
      },
      // Ruby
      {
        name: 'rspec',
        language: 'ruby',
        frameworks: ['rails', 'sinatra'],
        testCommand: 'bundle exec rspec',
        testWatchCommand: 'bundle exec guard',
        testCoverageCommand: 'bundle exec rspec --format documentation --format Html --out coverage/index.html',
        testFilePatterns: ['**/*_spec.rb', '**/spec/**/*.rb'],
        configFileNames: ['Gemfile', '.rspec'],
        envVars: { RAILS_ENV: 'test' },
        resultParser: 'generic',
      },
      {
        name: 'minitest',
        language: 'ruby',
        frameworks: ['rails'],
        testCommand: 'bundle exec rails test',
        testWatchCommand: 'bundle exec guard',
        testCoverageCommand: 'COVERAGE=true bundle exec rails test',
        testFilePatterns: ['**/test/**/*.rb'],
        configFileNames: ['Gemfile', 'test/test_helper.rb'],
        resultParser: 'generic',
      },
      // PHP
      {
        name: 'phpunit',
        language: 'php',
        frameworks: ['laravel', 'symfony', 'slim'],
        testCommand: './vendor/bin/phpunit',
        testCoverageCommand: './vendor/bin/phpunit --coverage-text',
        testFilePatterns: ['**/*Test.php', '**/tests/**/*.php'],
        configFileNames: ['phpunit.xml', 'phpunit.xml.dist'],
        resultParser: 'tap',
      },
      // C++
      {
        name: 'googletest',
        language: 'c++',
        frameworks: ['drogon', 'pistache', 'cpp-httplib'],
        testCommand: './build/tests/tests',
        testFilePatterns: ['**/*_test.cpp', '**/tests/**/*.cpp'],
        configFileNames: ['CMakeLists.txt', 'Makefile'],
        resultParser: 'generic',
      },
      // Swift
      {
        name: 'swift-test',
        language: 'swift',
        frameworks: ['vapor'],
        testCommand: 'swift test',
        testCoverageCommand: 'swift test --enable-code-coverage',
        testFilePatterns: ['**/*Tests/*.swift', '**/Tests/**/*.swift'],
        configFileNames: ['Package.swift'],
        resultParser: 'generic',
      },
      // Kotlin
      {
        name: 'kotest',
        language: 'kotlin',
        frameworks: ['ktor', 'spring-boot-kotlin'],
        testCommand: './gradlew test',
        testCoverageCommand: './gradlew test jacocoTestReport',
        testFilePatterns: ['**/*Test.kt', '**/*Specs.kt'],
        configFileNames: ['build.gradle.kts'],
        resultParser: 'generic',
      },
    ];
  }

  // Detect test framework from project files
  async detectTestFrameworks(): Promise<TestFrameworkConfig[]> {
    const detected: TestFrameworkConfig[] = [];

    for (const framework of this.frameworks) {
      // Check for config files
      for (const configFile of framework.configFileNames) {
        const configPath = path.join(this.projectPath, configFile);
        if (await fs.pathExists(configPath)) {
          // For package.json, check for test scripts
          if (configFile === 'package.json') {
            const pkgJson = await fs.readJson(configPath);
            if (pkgJson.scripts?.test || pkgJson.jest || pkgJson.vitest) {
              detected.push(framework);
              this.detectedFrameworks.add(framework.name);
              break;
            }
          } else {
            detected.push(framework);
            this.detectedFrameworks.add(framework.name);
            break;
          }
        }
      }

      // Check for test files
      if (!this.detectedFrameworks.has(framework.name)) {
        for (const pattern of framework.testFilePatterns) {
          const matches = await this.glob(pattern);
          if (matches.length > 0) {
            detected.push(framework);
            this.detectedFrameworks.add(framework.name);
            break;
          }
        }
      }
    }

    return detected;
  }

  // Simple glob implementation using minimatch-like pattern matching
  async glob(pattern: string): Promise<string[]> {
    const results: string[] = [];
    const isNegated = pattern.startsWith('!');
    const actualPattern = isNegated ? pattern.slice(1) : pattern;

    // Convert glob pattern to regex
    const regexPattern = actualPattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\./g, '\\.');
    const regex = new RegExp(regexPattern);

    const scanDir = async (dir: string) => {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.stat(filePath);
          const relativePath = path.relative(this.projectPath, filePath);

          if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'vendor' && file !== 'target' && file !== 'build' && file !== 'dist') {
            await scanDir(filePath);
          } else if (stat.isFile()) {
            const matches = regex.test(relativePath);
            if (isNegated ? !matches : matches) {
              results.push(relativePath);
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    await scanDir(this.projectPath);
    return results;
  }

  // Get test command for framework
  getTestCommand(options: TestOptions = {}): string | null {
    const primaryFramework = this.frameworks[0];
    if (!primaryFramework) {
      return null;
    }

    let command = primaryFramework.testCommand;

    if (options.watch && primaryFramework.testWatchCommand) {
      command = primaryFramework.testWatchCommand;
    }

    if (options.coverage && primaryFramework.testCoverageCommand) {
      command = primaryFramework.testCoverageCommand;
    }

    if (options.pattern) {
      command += ` -- ${options.pattern}`;
    }

    if (options.verbose) {
      command += ' --verbose';
    }

    if (options.updateSnapshot) {
      command += ' -u';
    }

    return command;
  }

  // Run tests
  async runTests(options: TestOptions = {}): Promise<TestResult> {
    const detectedFrameworks = await this.detectTestFrameworks();

    if (detectedFrameworks.length === 0) {
      throw new Error('No test framework detected');
    }

    const framework = detectedFrameworks[0];
    const command = this.buildCommand(framework, options);

    this.emit('test-start', { framework: framework.name, command });

    const startTime = Date.now();
    const result = await this.executeCommand(command, framework);
    const duration = Date.now() - startTime;

    return {
      framework: framework.name,
      language: framework.language,
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      duration,
      failures: result.failures,
    };
  }

  // Build command with options
  private buildCommand(framework: TestFrameworkConfig, options: TestOptions): string {
    let command = framework.testCommand;

    if (options.coverage && framework.testCoverageCommand) {
      command = framework.testCoverageCommand;
    } else if (options.watch && framework.testWatchCommand) {
      command = framework.testWatchCommand;
    }

    if (options.pattern) {
      command += ` ${options.pattern}`;
    }

    if (options.parallel) {
      command += ' --parallel';
    }

    if (options.maxWorkers) {
      command += ` --maxWorkers=${options.maxWorkers}`;
    }

    return command;
  }

  // Execute test command
  private async executeCommand(command: string, framework: TestFrameworkConfig): Promise<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: TestFailure[];
  }> {
    const [cmd, ...args] = command.split(' ');
    const env = { ...process.env, ...framework.envVars };

    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: this.projectPath,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.emit('test-output', data.toString());
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        this.emit('test-error', data.toString());
      });

      child.on('close', (code) => {
        const result = this.parseOutput(stdout, stderr, framework);
        resolve(result);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Parse test output based on framework
  private parseOutput(stdout: string, stderr: string, framework: TestFrameworkConfig): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: TestFailure[];
  } {
    const output = stdout + stderr;
    const defaultResult = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

    switch (framework.resultParser) {
      case 'jest':
        return this.parseJestOutput(output);
      case 'pytest':
        return this.parsePytestOutput(output);
      case 'go':
        return this.parseGoOutput(output);
      case 'rust':
        return this.parseRustOutput(output);
      case 'tap':
        return this.parseTapOutput(output);
      default:
        return defaultResult;
    }
  }

  // Parse Jest output
  private parseJestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: TestFailure[];
  } {
    const result = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

    // Match: "Tests: 10 passed, 2 failed, 1 skipped"
    const testMatch = output.match(/Tests?:\s+(\d+)\s+passed?,?\s*(\d+)\s+failed?,?\s*(\d+)\s+skipped?/i);
    if (testMatch) {
      result.passed = parseInt(testMatch[1]) || 0;
      result.failed = parseInt(testMatch[2]) || 0;
      result.skipped = parseInt(testMatch[3]) || 0;
      result.total = result.passed + result.failed + result.skipped;
    }

    // Match: "PASS src/example.test.ts"
    const passMatches = output.matchAll(/PASS\s+(.+?\.(?:test|spec)\.[jt]sx?)/g);
    for (const match of passMatches) {
      result.passed++;
    }

    // Match: "FAIL src/example.test.ts"
    const failMatches = output.matchAll(/FAIL\s+(.+?\.(?:test|spec)\.[jt]sx?)/g);
    for (const match of failMatches) {
      result.failed++;
    }

    return result;
  }

  // Parse pytest output
  private parsePytestOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: TestFailure[];
  } {
    const result = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

    // Match: "10 passed, 2 failed, 1 skipped in 5.23s"
    const summaryMatch = output.match(/(\d+)\s+passed?,?\s*(\d+)\s+failed?,?\s*(\d+)\s+skipped?/);
    if (summaryMatch) {
      result.passed = parseInt(summaryMatch[1]) || 0;
      result.failed = parseInt(summaryMatch[2]) || 0;
      result.skipped = parseInt(summaryMatch[3]) || 0;
      result.total = result.passed + result.failed + result.skipped;
    }

    return result;
  }

  // Parse go test output
  private parseGoOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: TestFailure[];
  } {
    const result = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

    // Match: "PASS: TestExample (0.12s)"
    const passMatches = output.matchAll(/PASS:\s+(\S+)/g);
    for (const _ of passMatches) {
      result.passed++;
    }

    // Match: "FAIL: TestExample (0.12s)"
    const failMatches = output.matchAll(/FAIL:\s+(\S+)/g);
    for (const _ of failMatches) {
      result.failed++;
    }

    result.total = result.passed + result.failed;
    return result;
  }

  // Parse cargo test output
  private parseRustOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: TestFailure[];
  } {
    const result = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

    // Match: "test result: ok. 10 passed; 0 failed; 0 ignored"
    const summaryMatch = output.match(/test result:\s+ok\.\s+(\d+)\s+passed;\s+(\d+)\s+failed/);
    if (summaryMatch) {
      result.passed = parseInt(summaryMatch[1]) || 0;
      result.failed = parseInt(summaryMatch[2]) || 0;
      result.total = result.passed + result.failed;
    }

    return result;
  }

  // Parse TAP output
  private parseTapOutput(output: string): {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: TestFailure[];
  } {
    const result = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

    const lines = output.split('\n');
    for (const line of lines) {
      // Match: "ok 1 - test description"
      if (line.trim().startsWith('ok ')) {
        result.passed++;
        result.total++;
      }
      // Match: "not ok 1 - test description"
      else if (line.trim().startsWith('not ok ')) {
        result.failed++;
        result.total++;
      }
      // Match: "skip 1 - test description"
      else if (line.trim().startsWith('skip ')) {
        result.skipped++;
      }
    }

    return result;
  }

  // List test files
  async listTestFiles(): Promise<string[]> {
    const detectedFrameworks = await this.detectTestFrameworks();
    const allFiles: string[] = [];

    for (const framework of detectedFrameworks) {
      for (const pattern of framework.testFilePatterns) {
        const matches = await this.glob(pattern);
        allFiles.push(...matches);
      }
    }

    return [...new Set(allFiles)].sort();
  }

  // Get test info
  async getTestInfo(): Promise<{
    frameworks: string[];
    testFileCount: number;
    testCommand: string;
  }> {
    const detectedFrameworks = await this.detectTestFrameworks();
    const testFiles = await this.listTestFiles();
    const command = this.getTestCommand();

    return {
      frameworks: detectedFrameworks.map(f => f.name),
      testFileCount: testFiles.length,
      testCommand: command || 'No test framework found',
    };
  }
}

// Factory functions

/**
 * Create universal test runner
 */
export async function createTestRunner(projectPath: string): Promise<UniversalTestRunner> {
  const runner = new UniversalTestRunner(projectPath);
  return runner;
}

/**
 * Run tests in a project
 */
export async function runTests(projectPath: string, options?: TestOptions): Promise<TestResult> {
  const runner = await createTestRunner(projectPath);
  return await runner.runTests(options);
}

/**
 * Get supported test frameworks
 */
export function getSupportedTestFrameworks(): TestFrameworkConfig[] {
  const runner = new UniversalTestRunner(process.cwd());
  return runner.getSupportedFrameworks();
}

/**
 * Format test result for display
 */
export function formatTestResult(result: TestResult): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`\n🧪 Test Results: ${chalk.blue(result.framework)}`));
  lines.push(chalk.gray('═'.repeat(50)));

  const status = result.failed === 0 ? chalk.green('PASS') : chalk.red('FAIL');
  lines.push(`\nStatus: ${status}`);
  lines.push(`Total: ${result.total}`);
  lines.push(`Passed: ${chalk.green(result.failed === 0 ? result.total : result.passed)}`);
  lines.push(`Failed: ${result.failed > 0 ? chalk.red(result.failed) : result.failed}`);
  lines.push(`Skipped: ${chalk.yellow(result.skipped)}`);
  lines.push(`Duration: ${chalk.gray((result.duration / 1000).toFixed(2) + 's')}`);

  if (result.failures.length > 0) {
    lines.push(chalk.red('\nFailures:'));
    for (const failure of result.failures.slice(0, 5)) {
      lines.push(`  • ${chalk.gray(failure.file)}:${chalk.yellow(String(failure.line))}`);
      lines.push(`    ${failure.test}: ${chalk.red(failure.message)}`);
    }
    if (result.failures.length > 5) {
      lines.push(`  ... and ${result.failures.length - 5} more`);
    }
  }

  return lines.join('\n');
}
