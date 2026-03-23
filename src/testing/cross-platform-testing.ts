import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn } from 'child_process';

export interface CrossPlatformConfig {
  platforms: PlatformTarget[];
  tests: PlatformTest[];
  dockerEnabled?: boolean;
  vmEnabled?: boolean;
  ciEnabled?: boolean;
  localOnly?: boolean;
  parallel?: boolean;
  generateReport?: boolean;
  failFast?: boolean;
}

export interface PlatformTarget {
  os: 'win32' | 'darwin' | 'linux';
  arch?: 'x64' | 'arm64' | 'ia32';
  version?: string;
  nodeVersion?: string;
  dockerImage?: string;
  vmImage?: string;
  enabled?: boolean;
}

export interface PlatformTest {
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  platforms?: string[]; // Specific platforms only
  skip?: string[]; // Skip on these platforms
  expectedOutput?: string | RegExp;
  expectedExitCode?: number;
  validators?: TestValidator[];
}

export interface TestValidator {
  type: 'file' | 'directory' | 'command' | 'custom';
  target: string;
  condition: 'exists' | 'contains' | 'matches' | 'custom';
  value?: any;
  platform?: string;
}

export interface PlatformTestResult {
  platform: PlatformInfo;
  test: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
  validators?: ValidatorResult[];
  artifacts?: string[];
}

export interface PlatformInfo {
  os: string;
  arch: string;
  version: string;
  nodeVersion: string;
  npmVersion?: string;
  environment: 'local' | 'docker' | 'vm' | 'ci';
}

export interface ValidatorResult {
  validator: string;
  success: boolean;
  actual?: any;
  expected?: any;
  error?: string;
}

export interface CrossPlatformReport {
  summary: TestSummary;
  platforms: PlatformInfo[];
  results: PlatformTestResult[];
  compatibility: CompatibilityMatrix;
  issues: CompatibilityIssue[];
  recommendations: string[];
  timestamp: Date;
}

export interface TestSummary {
  totalTests: number;
  totalPlatforms: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  compatibility: number; // Percentage
}

export interface CompatibilityMatrix {
  tests: string[];
  platforms: string[];
  results: boolean[][]; // tests x platforms
}

export interface CompatibilityIssue {
  test: string;
  platform: string;
  type: 'failure' | 'warning' | 'incompatible';
  description: string;
  suggestion?: string;
}

export interface DockerConfig {
  baseImages: Map<string, string>;
  buildCache?: boolean;
  cleanup?: boolean;
  network?: string;
  volumes?: string[];
}

export class CrossPlatformTesting extends EventEmitter {
  private config: CrossPlatformConfig;
  private results: PlatformTestResult[] = [];
  private currentPlatform: PlatformInfo;
  private dockerConfig: DockerConfig;

  constructor(config: CrossPlatformConfig) {
    super();
    this.config = {
      dockerEnabled: false,
      vmEnabled: false,
      ciEnabled: false,
      localOnly: true,
      parallel: false,
      generateReport: true,
      failFast: false,
      ...config
    };

    this.currentPlatform = this.detectCurrentPlatform();
    this.dockerConfig = this.initializeDockerConfig();
  }

  async run(): Promise<CrossPlatformReport> {
    this.emit('test:start', { 
      platforms: this.config.platforms.length,
      tests: this.config.tests.length 
    });

    const startTime = Date.now();

    try {
      // Filter enabled platforms
      const platforms = this.getEnabledPlatforms();

      // Run tests on each platform
      if (this.config.parallel && platforms.length > 1) {
        await this.runParallel(platforms);
      } else {
        await this.runSequential(platforms);
      }

      // Generate report
      const report = this.generateReport(Date.now() - startTime);

      if (this.config.generateReport) {
        await this.saveReport(report);
      }

      this.emit('test:complete', report);
      return report;

    } catch (error: any) {
      this.emit('test:error', error);
      throw error;
    }
  }

  private async runSequential(platforms: PlatformTarget[]): Promise<void> {
    for (const platform of platforms) {
      if (this.config.failFast && this.hasFailures()) {
        break;
      }

      await this.runPlatformTests(platform);
    }
  }

  private async runParallel(platforms: PlatformTarget[]): Promise<void> {
    const promises = platforms.map(platform => 
      this.runPlatformTests(platform)
    );
    await Promise.all(promises);
  }

  private async runPlatformTests(platform: PlatformTarget): Promise<void> {
    this.emit('platform:start', platform);

    const platformInfo = await this.getPlatformInfo(platform);

    for (const test of this.config.tests) {
      // Check if test should run on this platform
      if (!this.shouldRunTest(test, platform)) {
        continue;
      }

      const result = await this.runTest(test, platform, platformInfo);
      this.results.push(result);

      if (this.config.failFast && !result.success) {
        throw new Error(`Test failed on ${platform.os}: ${test.name}`);
      }
    }

    this.emit('platform:complete', platform);
  }

  private async runTest(
    test: PlatformTest,
    platform: PlatformTarget,
    platformInfo: PlatformInfo
  ): Promise<PlatformTestResult> {
    this.emit('test:run', { test: test.name, platform: platform.os });

    const result: PlatformTestResult = {
      platform: platformInfo,
      test: test.name,
      success: false,
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Execute test based on platform environment
      let output: string;
      
      if (this.isCurrentPlatform(platform)) {
        output = await this.runLocalTest(test);
      } else if (this.config.dockerEnabled && platform.dockerImage) {
        output = await this.runDockerTest(test, platform);
      } else if (this.config.vmEnabled && platform.vmImage) {
        output = await this.runVMTest(test, platform);
      } else if (this.config.ciEnabled) {
        output = await this.runCITest(test, platform);
      } else {
        throw new Error(`Cannot test on ${platform.os} - no execution environment available`);
      }

      result.output = output;

      // Check expected output
      if (test.expectedOutput) {
        if (typeof test.expectedOutput === 'string') {
          result.success = output.includes(test.expectedOutput);
        } else {
          result.success = test.expectedOutput.test(output);
        }
      } else {
        result.success = true;
      }

      // Run validators
      if (test.validators) {
        result.validators = await this.runValidators(test.validators, platform);
        result.success = result.success && 
          result.validators.every(v => v.success);
      }

    } catch (error: any) {
      result.error = error.message;
      result.success = false;

      // Check if error is expected
      if (test.expectedExitCode !== undefined && error.status === test.expectedExitCode) {
        result.success = true;
      }
    }

    result.duration = Date.now() - startTime;
    this.emit('test:result', result);
    return result;
  }

  private async runLocalTest(test: PlatformTest): Promise<string> {
    const command = test.command;
    const args = test.args?.join(' ') || '';
    const fullCommand = `${command} ${args}`.trim();

    const options: any = {
      cwd: test.cwd || process.cwd(),
      env: { ...process.env, ...test.env },
      timeout: test.timeout || 30000,
      encoding: 'utf-8',
      shell: true
    };

    return execSync(fullCommand, options);
  }

  private async runDockerTest(
    test: PlatformTest,
    platform: PlatformTarget
  ): Promise<string> {
    const image = platform.dockerImage!;
    const command = test.command;
    const args = test.args || [];

    // Build docker command
    const dockerArgs = [
      'run',
      '--rm',
      '-v', `${process.cwd()}:/workspace`,
      '-w', '/workspace'
    ];

    // Add environment variables
    if (test.env) {
      Object.entries(test.env).forEach(([key, value]) => {
        dockerArgs.push('-e', `${key}=${value}`);
      });
    }

    dockerArgs.push(image, command, ...args);

    const result = execSync(`docker ${dockerArgs.join(' ')}`, {
      encoding: 'utf-8',
      timeout: test.timeout || 60000
    });

    return result;
  }

  private async runVMTest(
    test: PlatformTest,
    platform: PlatformTarget
  ): Promise<string> {
    // VM test implementation would use vagrant or similar
    throw new Error('VM testing not implemented');
  }

  private async runCITest(
    test: PlatformTest,
    platform: PlatformTarget
  ): Promise<string> {
    // CI test implementation would use GitHub Actions or similar
    throw new Error('CI testing not implemented');
  }

  private async runValidators(
    validators: TestValidator[],
    platform: PlatformTarget
  ): Promise<ValidatorResult[]> {
    const results: ValidatorResult[] = [];

    for (const validator of validators) {
      // Skip if validator is platform-specific
      if (validator.platform && validator.platform !== platform.os) {
        continue;
      }

      const result = await this.runValidator(validator, platform);
      results.push(result);
    }

    return results;
  }

  private async runValidator(
    validator: TestValidator,
    platform: PlatformTarget
  ): Promise<ValidatorResult> {
    const result: ValidatorResult = {
      validator: `${validator.type}:${validator.target}`,
      success: false
    };

    try {
      switch (validator.type) {
        case 'file':
          await this.validateFile(validator, result);
          break;

        case 'directory':
          await this.validateDirectory(validator, result);
          break;

        case 'command':
          await this.validateCommand(validator, result);
          break;

        case 'custom':
          await this.validateCustom(validator, result);
          break;
      }
    } catch (error: any) {
      result.error = error.message;
    }

    return result;
  }

  private async validateFile(
    validator: TestValidator,
    result: ValidatorResult
  ): Promise<void> {
    const exists = await fs.pathExists(validator.target);

    switch (validator.condition) {
      case 'exists':
        result.success = exists;
        result.actual = exists;
        result.expected = true;
        break;

      case 'contains':
        if (exists) {
          const content = await fs.readFile(validator.target, 'utf-8');
          result.success = content.includes(validator.value);
          result.actual = content.substring(0, 100);
          result.expected = `contains "${validator.value}"`;
        }
        break;

      case 'matches':
        if (exists) {
          const content = await fs.readFile(validator.target, 'utf-8');
          const regex = new RegExp(validator.value);
          result.success = regex.test(content);
          result.actual = content.substring(0, 100);
          result.expected = `matches ${regex}`;
        }
        break;
    }
  }

  private async validateDirectory(
    validator: TestValidator,
    result: ValidatorResult
  ): Promise<void> {
    const exists = await fs.pathExists(validator.target);

    switch (validator.condition) {
      case 'exists':
        result.success = exists;
        result.actual = exists;
        result.expected = true;
        break;

      case 'contains':
        if (exists) {
          const files = await fs.readdir(validator.target);
          result.success = files.includes(validator.value);
          result.actual = files;
          result.expected = `contains "${validator.value}"`;
        }
        break;
    }
  }

  private async validateCommand(
    validator: TestValidator,
    result: ValidatorResult
  ): Promise<void> {
    try {
      const output = execSync(validator.target, { encoding: 'utf-8' });
      result.success = true;
      result.actual = output.trim();
    } catch (error: any) {
      result.success = false;
      result.error = error.message;
    }
  }

  private async validateCustom(
    validator: TestValidator,
    result: ValidatorResult
  ): Promise<void> {
    // Custom validation would be implemented by extending this class
    result.success = true;
  }

  private detectCurrentPlatform(): PlatformInfo {
    return {
      os: os.platform(),
      arch: os.arch(),
      version: os.release(),
      nodeVersion: process.version,
      npmVersion: this.getNpmVersion(),
      environment: 'local'
    };
  }

  private getNpmVersion(): string {
    try {
      return execSync('npm --version', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private initializeDockerConfig(): DockerConfig {
    return {
      baseImages: new Map([
        ['win32', 'mcr.microsoft.com/windows/servercore:ltsc2022'],
        ['darwin', 'sickcodes/docker-osx:latest'],
        ['linux', 'node:18-alpine']
      ]),
      buildCache: true,
      cleanup: true,
      network: 'bridge'
    };
  }

  private getEnabledPlatforms(): PlatformTarget[] {
    return this.config.platforms.filter(p => p.enabled !== false);
  }

  private isCurrentPlatform(platform: PlatformTarget): boolean {
    return platform.os === this.currentPlatform.os &&
           (!platform.arch || platform.arch === this.currentPlatform.arch);
  }

  private shouldRunTest(test: PlatformTest, platform: PlatformTarget): boolean {
    // Check if test is platform-specific
    if (test.platforms && !test.platforms.includes(platform.os)) {
      return false;
    }

    // Check if test should be skipped on this platform
    if (test.skip && test.skip.includes(platform.os)) {
      return false;
    }

    return true;
  }

  private hasFailures(): boolean {
    return this.results.some(r => !r.success);
  }

  private async getPlatformInfo(platform: PlatformTarget): Promise<PlatformInfo> {
    let environment: 'local' | 'docker' | 'vm' | 'ci' = 'local';
    
    if (!this.isCurrentPlatform(platform)) {
      if (this.config.dockerEnabled && platform.dockerImage) {
        environment = 'docker';
      } else if (this.config.vmEnabled && platform.vmImage) {
        environment = 'vm';
      } else if (this.config.ciEnabled) {
        environment = 'ci';
      }
    }

    return {
      os: platform.os,
      arch: platform.arch || 'x64',
      version: platform.version || 'latest',
      nodeVersion: platform.nodeVersion || process.version,
      environment
    };
  }

  private generateReport(duration: number): CrossPlatformReport {
    const platforms = this.getUniquePlatforms();
    const tests = this.getUniqueTests();
    
    const matrix = this.buildCompatibilityMatrix(tests, platforms);
    const issues = this.identifyIssues();
    const recommendations = this.generateRecommendations(issues);

    const summary: TestSummary = {
      totalTests: tests.length,
      totalPlatforms: platforms.length,
      passed: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      skipped: 0,
      duration: duration / 1000,
      compatibility: this.calculateCompatibility(matrix)
    };

    return {
      summary,
      platforms,
      results: this.results,
      compatibility: matrix,
      issues,
      recommendations,
      timestamp: new Date()
    };
  }

  private getUniquePlatforms(): PlatformInfo[] {
    const platforms = new Map<string, PlatformInfo>();
    
    for (const result of this.results) {
      const key = `${result.platform.os}-${result.platform.arch}`;
      platforms.set(key, result.platform);
    }

    return Array.from(platforms.values());
  }

  private getUniqueTests(): string[] {
    return [...new Set(this.results.map(r => r.test))];
  }

  private buildCompatibilityMatrix(
    tests: string[],
    platforms: PlatformInfo[]
  ): CompatibilityMatrix {
    const matrix: boolean[][] = [];

    for (const test of tests) {
      const row: boolean[] = [];
      
      for (const platform of platforms) {
        const result = this.results.find(r => 
          r.test === test && 
          r.platform.os === platform.os &&
          r.platform.arch === platform.arch
        );
        
        row.push(result?.success || false);
      }
      
      matrix.push(row);
    }

    return {
      tests,
      platforms: platforms.map(p => `${p.os}-${p.arch}`),
      results: matrix
    };
  }

  private identifyIssues(): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = [];

    for (const result of this.results) {
      if (!result.success) {
        issues.push({
          test: result.test,
          platform: `${result.platform.os}-${result.platform.arch}`,
          type: 'failure',
          description: result.error || 'Test failed',
          suggestion: this.getSuggestion(result)
        });
      }

      // Check for platform-specific warnings
      if (result.validators) {
        for (const validator of result.validators) {
          if (!validator.success && validator.error?.includes('warning')) {
            issues.push({
              test: result.test,
              platform: `${result.platform.os}-${result.platform.arch}`,
              type: 'warning',
              description: validator.error
            });
          }
        }
      }
    }

    return issues;
  }

  private getSuggestion(result: PlatformTestResult): string | undefined {
    const error = result.error?.toLowerCase() || '';
    
    if (error.includes('permission denied')) {
      return 'Check file permissions or run with elevated privileges';
    }
    
    if (error.includes('command not found')) {
      return 'Ensure required dependencies are installed';
    }
    
    if (error.includes('timeout')) {
      return 'Increase timeout or optimize test performance';
    }
    
    if (result.platform.os === 'win32' && error.includes('path')) {
      return 'Use cross-platform path handling (path.join)';
    }
    
    return undefined;
  }

  private calculateCompatibility(matrix: CompatibilityMatrix): number {
    let total = 0;
    let passed = 0;

    for (const row of matrix.results) {
      for (const result of row) {
        total++;
        if (result) passed++;
      }
    }

    return total > 0 ? (passed / total) * 100 : 0;
  }

  private generateRecommendations(issues: CompatibilityIssue[]): string[] {
    const recommendations: string[] = [];
    
    // Platform-specific issues
    const platformIssues = new Map<string, number>();
    for (const issue of issues) {
      const count = platformIssues.get(issue.platform) || 0;
      platformIssues.set(issue.platform, count + 1);
    }

    for (const [platform, count] of platformIssues) {
      if (count > 3) {
        recommendations.push(
          `Consider platform-specific implementation for ${platform}`
        );
      }
    }

    // Common issues
    const pathIssues = issues.filter(i => 
      i.description.toLowerCase().includes('path')
    );
    if (pathIssues.length > 0) {
      recommendations.push(
        'Use path.join() and path.resolve() for cross-platform paths'
      );
    }

    const permissionIssues = issues.filter(i => 
      i.description.toLowerCase().includes('permission')
    );
    if (permissionIssues.length > 0) {
      recommendations.push(
        'Review file permissions and consider platform-specific handling'
      );
    }

    return recommendations;
  }

  private async saveReport(report: CrossPlatformReport): Promise<void> {
    const reportPath = path.join(
      process.cwd(),
      'cross-platform-report.json'
    );

    await fs.writeJson(reportPath, report, { spaces: 2 });

    // Also save a markdown report
    const mdPath = reportPath.replace('.json', '.md');
    await fs.writeFile(mdPath, this.formatMarkdownReport(report));

    this.emit('report:saved', { json: reportPath, md: mdPath });
  }

  private formatMarkdownReport(report: CrossPlatformReport): string {
    const lines: string[] = [
      '# Cross-Platform Compatibility Report',
      '',
      `**Date:** ${report.timestamp.toISOString()}`,
      `**Compatibility:** ${report.summary.compatibility.toFixed(1)}%`,
      '',
      '## Summary',
      '',
      `- **Total Tests:** ${report.summary.totalTests}`,
      `- **Total Platforms:** ${report.summary.totalPlatforms}`,
      `- **Passed:** ${report.summary.passed}`,
      `- **Failed:** ${report.summary.failed}`,
      '',
      '## Compatibility Matrix',
      '',
      this.formatMatrix(report.compatibility),
      '',
      '## Issues',
      ''
    ];

    if (report.issues.length > 0) {
      for (const issue of report.issues) {
        lines.push(`### ${issue.test} on ${issue.platform}`);
        lines.push(`- **Type:** ${issue.type}`);
        lines.push(`- **Description:** ${issue.description}`);
        if (issue.suggestion) {
          lines.push(`- **Suggestion:** ${issue.suggestion}`);
        }
        lines.push('');
      }
    } else {
      lines.push('No compatibility issues found! 🎉');
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      for (const rec of report.recommendations) {
        lines.push(`- ${rec}`);
      }
    }

    return lines.join('\n');
  }

  private formatMatrix(matrix: CompatibilityMatrix): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`| Test | ${matrix.platforms.join(' | ')} |`);
    lines.push(`|------|${matrix.platforms.map(() => '------').join('|')}|`);
    
    // Rows
    for (let i = 0; i < matrix.tests.length; i++) {
      const cells = [matrix.tests[i]];
      for (let j = 0; j < matrix.platforms.length; j++) {
        cells.push(matrix.results[i][j] ? '✅' : '❌');
      }
      lines.push(`| ${cells.join(' | ')} |`);
    }

    return lines.join('\n');
  }
}

// Export utility functions
export function createPlatformTest(
  name: string,
  command: string,
  options?: Partial<PlatformTest>
): PlatformTest {
  return {
    name,
    command,
    ...options
  };
}

export function createPlatformTarget(
  os: 'win32' | 'darwin' | 'linux',
  options?: Partial<PlatformTarget>
): PlatformTarget {
  return {
    os,
    enabled: true,
    ...options
  };
}

export async function runCrossPlatformTests(
  config: CrossPlatformConfig
): Promise<CrossPlatformReport> {
  const tester = new CrossPlatformTesting(config);
  return tester.run();
}