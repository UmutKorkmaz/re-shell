import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import glob from 'fast-glob';

export interface CoverageConfig {
  targetCoverage: number; // Target coverage percentage (e.g., 95)
  includePatterns?: string[];
  excludePatterns?: string[];
  reporters?: CoverageReporter[];
  thresholds?: CoverageThresholds;
  collectFrom?: string[];
  coverageDirectory?: string;
  failOnLowCoverage?: boolean;
  generateBadge?: boolean;
  trackHistory?: boolean;
}

export interface CoverageThresholds {
  branches?: number;
  functions?: number;
  lines?: number;
  statements?: number;
  global?: number;
}

export interface CoverageReporter {
  type: 'text' | 'json' | 'html' | 'lcov' | 'cobertura' | 'teamcity' | 'text-summary' | 'json-summary';
  options?: any;
}

export interface CoverageResult {
  success: boolean;
  coverage: CoverageMetrics;
  uncoveredFiles: UncoveredFile[];
  suggestions: string[];
  report: CoverageReport;
  badge?: string;
  history?: CoverageHistory[];
}

export interface CoverageMetrics {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  overall: number;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  percentage: number;
}

export interface UncoveredFile {
  file: string;
  lines: UncoveredLine[];
  functions: string[];
  branches: string[];
  coverage: number;
}

export interface UncoveredLine {
  line: number;
  code: string;
  hits: number;
}

export interface CoverageReport {
  summary: string;
  detailed: FileCoverage[];
  timestamp: Date;
  duration: number;
}

export interface FileCoverage {
  file: string;
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  uncoveredLines: number[];
}

export interface CoverageHistory {
  date: Date;
  coverage: number;
  metrics: CoverageMetrics;
  commit?: string;
  branch?: string;
}

export interface TestFile {
  path: string;
  testCount: number;
  coverage: number;
  missing: string[];
}

export class UnitTestCoverage extends EventEmitter {
  private config: CoverageConfig;
  private historyPath: string;

  constructor(config: CoverageConfig) {
    super();
    this.config = {
      targetCoverage: 95,
      reporters: [
        { type: 'text' },
        { type: 'json' },
        { type: 'html' },
        { type: 'lcov' }
      ],
      coverageDirectory: 'coverage',
      failOnLowCoverage: true,
      generateBadge: true,
      trackHistory: true,
      ...config
    };
    this.historyPath = path.join(this.config.coverageDirectory!, 'coverage-history.json');
  }

  async analyze(projectPath: string): Promise<CoverageResult> {
    this.emit('coverage:start', { projectPath });

    const result: CoverageResult = {
      success: false,
      coverage: this.createEmptyMetrics(),
      uncoveredFiles: [],
      suggestions: [],
      report: {
        summary: '',
        detailed: [],
        timestamp: new Date(),
        duration: 0
      }
    };

    const startTime = Date.now();

    try {
      // Run tests with coverage
      const coverage = await this.runCoverage(projectPath);
      result.coverage = coverage;

      // Analyze uncovered code
      const uncovered = await this.analyzeUncoveredCode(projectPath, coverage);
      result.uncoveredFiles = uncovered;

      // Generate suggestions
      result.suggestions = this.generateSuggestions(coverage, uncovered);

      // Create detailed report
      result.report = await this.createDetailedReport(projectPath, coverage);
      result.report.duration = Date.now() - startTime;

      // Check thresholds
      result.success = this.checkThresholds(coverage);

      // Generate badge if requested
      if (this.config.generateBadge) {
        result.badge = await this.generateCoverageBadge(coverage.overall);
      }

      // Track history if enabled
      if (this.config.trackHistory) {
        result.history = await this.trackCoverageHistory(coverage);
      }

      this.emit('coverage:complete', result);
      return result;

    } catch (error: any) {
      result.report.duration = Date.now() - startTime;
      this.emit('coverage:error', error);
      throw error;
    }
  }

  async generateMissingTests(projectPath: string): Promise<TestFile[]> {
    this.emit('generate:start', { projectPath });

    const missingTests: TestFile[] = [];

    try {
      // Find all source files
      const sourceFiles = await this.findSourceFiles(projectPath);

      // Find corresponding test files
      for (const sourceFile of sourceFiles) {
        const testFile = this.getTestFilePath(sourceFile);
        const exists = await fs.pathExists(testFile);

        if (!exists) {
          missingTests.push({
            path: testFile,
            testCount: 0,
            coverage: 0,
            missing: ['All tests missing']
          });
        } else {
          // Analyze test coverage for this file
          const coverage = await this.analyzeFileCoverage(sourceFile);
          if (coverage < this.config.targetCoverage) {
            const missing = await this.identifyMissingTests(sourceFile, testFile);
            missingTests.push({
              path: testFile,
              testCount: await this.countTests(testFile),
              coverage,
              missing
            });
          }
        }
      }

      this.emit('generate:complete', missingTests);
      return missingTests;

    } catch (error: any) {
      this.emit('generate:error', error);
      throw error;
    }
  }

  async createTestTemplate(sourceFile: string): Promise<string> {
    const content = await fs.readFile(sourceFile, 'utf-8');
    const functions = this.extractFunctions(content);
    const className = this.extractClassName(content);
    
    let template = `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';\n`;
    template += `import { ${className || 'module'} } from '${this.getImportPath(sourceFile)}';\n\n`;

    if (className) {
      template += `describe('${className}', () => {\n`;
      template += `  let instance: ${className};\n\n`;
      template += `  beforeEach(() => {\n`;
      template += `    instance = new ${className}();\n`;
      template += `  });\n\n`;
      template += `  afterEach(() => {\n`;
      template += `    vi.clearAllMocks();\n`;
      template += `  });\n\n`;

      for (const func of functions) {
        template += this.generateTestCase(func, true);
      }

      template += `});\n`;
    } else {
      template += `describe('${path.basename(sourceFile, '.ts')}', () => {\n`;
      
      for (const func of functions) {
        template += this.generateTestCase(func, false);
      }

      template += `});\n`;
    }

    return template;
  }

  private async runCoverage(projectPath: string): Promise<CoverageMetrics> {
    try {
      // Configure coverage collection
      const coverageConfig = this.buildCoverageConfig();
      
      // Run tests with coverage
      const command = `npx vitest run --coverage ${this.buildCoverageFlags()}`;
      execSync(command, {
        cwd: projectPath,
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          COVERAGE_CONFIG: JSON.stringify(coverageConfig)
        }
      });

      // Read coverage results
      const coverageFile = path.join(projectPath, this.config.coverageDirectory!, 'coverage-summary.json');
      const coverageData = await fs.readJson(coverageFile);

      return this.parseCoverageData(coverageData);

    } catch (error: any) {
      // Parse coverage even if tests fail
      const coverageFile = path.join(projectPath, this.config.coverageDirectory!, 'coverage-summary.json');
      if (await fs.pathExists(coverageFile)) {
        const coverageData = await fs.readJson(coverageFile);
        return this.parseCoverageData(coverageData);
      }
      throw error;
    }
  }

  private async analyzeUncoveredCode(
    projectPath: string,
    coverage: CoverageMetrics
  ): Promise<UncoveredFile[]> {
    const uncoveredFiles: UncoveredFile[] = [];
    const coverageDetail = path.join(projectPath, this.config.coverageDirectory!, 'coverage-final.json');

    if (await fs.pathExists(coverageDetail)) {
      const detailData = await fs.readJson(coverageDetail);

      for (const [file, data] of Object.entries(detailData)) {
        const fileCoverage = this.analyzeFileCoverageData(data as any);
        
        if (fileCoverage.coverage < this.config.targetCoverage) {
          uncoveredFiles.push({
            file: path.relative(projectPath, file),
            lines: fileCoverage.uncoveredLines,
            functions: fileCoverage.uncoveredFunctions,
            branches: fileCoverage.uncoveredBranches,
            coverage: fileCoverage.coverage
          });
        }
      }
    }

    return uncoveredFiles;
  }

  private analyzeFileCoverageData(data: any): any {
    const uncoveredLines: UncoveredLine[] = [];
    const uncoveredFunctions: string[] = [];
    const uncoveredBranches: string[] = [];

    // Analyze line coverage
    for (const [lineNum, hits] of Object.entries(data.statementMap || {})) {
      if (data.s[lineNum] === 0) {
        uncoveredLines.push({
          line: parseInt(lineNum),
          code: this.getLineCode(data, parseInt(lineNum)),
          hits: 0
        });
      }
    }

    // Analyze function coverage
    for (const [funcId, func] of Object.entries(data.fnMap || {})) {
      if (data.f[funcId] === 0) {
        uncoveredFunctions.push((func as any).name || `anonymous_${funcId}`);
      }
    }

    // Analyze branch coverage
    for (const [branchId, branch] of Object.entries(data.branchMap || {})) {
      const coverage = data.b[branchId];
      if (coverage && coverage.some((c: number) => c === 0)) {
        uncoveredBranches.push((branch as any).type || `branch_${branchId}`);
      }
    }

    // Calculate overall coverage
    const statements = Object.values(data.s || {});
    const covered = statements.filter((s: any) => s > 0).length;
    const total = statements.length;
    const coverage = total > 0 ? (covered / total) * 100 : 0;

    return {
      uncoveredLines,
      uncoveredFunctions,
      uncoveredBranches,
      coverage
    };
  }

  private generateSuggestions(
    coverage: CoverageMetrics,
    uncoveredFiles: UncoveredFile[]
  ): string[] {
    const suggestions: string[] = [];

    // Overall coverage suggestions
    if (coverage.overall < this.config.targetCoverage) {
      suggestions.push(
        `Increase overall coverage from ${coverage.overall.toFixed(1)}% to ${this.config.targetCoverage}%`
      );
    }

    // Metric-specific suggestions
    if (coverage.functions.percentage < coverage.overall) {
      suggestions.push('Focus on testing uncovered functions');
    }

    if (coverage.branches.percentage < coverage.overall) {
      suggestions.push('Add tests for edge cases and conditional branches');
    }

    // File-specific suggestions
    const criticalFiles = uncoveredFiles
      .filter(f => f.coverage < 50)
      .sort((a, b) => a.coverage - b.coverage)
      .slice(0, 5);

    if (criticalFiles.length > 0) {
      suggestions.push('Critical files needing immediate attention:');
      criticalFiles.forEach(file => {
        suggestions.push(`  - ${file.file} (${file.coverage.toFixed(1)}% coverage)`);
      });
    }

    // Test generation suggestions
    const missingTests = uncoveredFiles.filter(f => f.coverage === 0);
    if (missingTests.length > 0) {
      suggestions.push(`Generate tests for ${missingTests.length} untested files`);
    }

    return suggestions;
  }

  private async createDetailedReport(
    projectPath: string,
    coverage: CoverageMetrics
  ): Promise<CoverageReport> {
    const detailed: FileCoverage[] = [];
    const coverageDetail = path.join(projectPath, this.config.coverageDirectory!, 'coverage-final.json');

    if (await fs.pathExists(coverageDetail)) {
      const detailData = await fs.readJson(coverageDetail);

      for (const [file, data] of Object.entries(detailData)) {
        const fileData = data as any;
        detailed.push({
          file: path.relative(projectPath, file),
          lines: this.calculateMetric(fileData.statementMap, fileData.s),
          statements: this.calculateMetric(fileData.statementMap, fileData.s),
          functions: this.calculateMetric(fileData.fnMap, fileData.f),
          branches: this.calculateMetric(fileData.branchMap, fileData.b),
          uncoveredLines: this.getUncoveredLines(fileData)
        });
      }
    }

    const summary = this.generateSummary(coverage, detailed);

    return {
      summary,
      detailed,
      timestamp: new Date(),
      duration: 0
    };
  }

  private checkThresholds(coverage: CoverageMetrics): boolean {
    if (!this.config.thresholds) {
      return coverage.overall >= this.config.targetCoverage;
    }

    const thresholds = this.config.thresholds;
    
    if (thresholds.global && coverage.overall < thresholds.global) {
      return false;
    }

    if (thresholds.lines && coverage.lines.percentage < thresholds.lines) {
      return false;
    }

    if (thresholds.functions && coverage.functions.percentage < thresholds.functions) {
      return false;
    }

    if (thresholds.branches && coverage.branches.percentage < thresholds.branches) {
      return false;
    }

    if (thresholds.statements && coverage.statements.percentage < thresholds.statements) {
      return false;
    }

    return true;
  }

  private async generateCoverageBadge(coverage: number): Promise<string> {
    const color = coverage >= 90 ? 'brightgreen' : 
                  coverage >= 80 ? 'green' :
                  coverage >= 70 ? 'yellowgreen' :
                  coverage >= 60 ? 'yellow' :
                  coverage >= 50 ? 'orange' : 'red';

    const badge = {
      schemaVersion: 1,
      label: 'coverage',
      message: `${coverage.toFixed(1)}%`,
      color
    };

    const badgePath = path.join(this.config.coverageDirectory!, 'coverage-badge.json');
    await fs.ensureDir(path.dirname(badgePath));
    await fs.writeJson(badgePath, badge, { spaces: 2 });

    return `[![Coverage](https://img.shields.io/badge/coverage-${coverage.toFixed(1)}%25-${color}.svg)]`;
  }

  private async trackCoverageHistory(coverage: CoverageMetrics): Promise<CoverageHistory[]> {
    let history: CoverageHistory[] = [];

    // Load existing history
    if (await fs.pathExists(this.historyPath)) {
      history = await fs.readJson(this.historyPath);
    }

    // Get git information
    let commit: string | undefined;
    let branch: string | undefined;
    
    try {
      commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      // Git not available
    }

    // Add new entry
    history.push({
      date: new Date(),
      coverage: coverage.overall,
      metrics: coverage,
      commit,
      branch
    });

    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }

    // Save history
    await fs.ensureDir(path.dirname(this.historyPath));
    await fs.writeJson(this.historyPath, history, { spaces: 2 });

    return history;
  }

  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const patterns = this.config.includePatterns || ['src/**/*.ts', 'src/**/*.tsx'];
    const ignore = this.config.excludePatterns || [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.tsx',
      '**/*.spec.tsx'
    ];

    return glob(patterns, {
      cwd: projectPath,
      absolute: true,
      ignore
    });
  }

  private getTestFilePath(sourceFile: string): string {
    const dir = path.dirname(sourceFile);
    const basename = path.basename(sourceFile, path.extname(sourceFile));
    const ext = path.extname(sourceFile);
    
    // Try different test file conventions
    const testDir = dir.replace('/src/', '/tests/');
    return path.join(testDir, `${basename}.test${ext}`);
  }

  private async analyzeFileCoverage(sourceFile: string): Promise<number> {
    // This would integrate with actual coverage data
    // For now, return a mock value
    return Math.random() * 100;
  }

  private async identifyMissingTests(sourceFile: string, testFile: string): Promise<string[]> {
    const missing: string[] = [];
    const content = await fs.readFile(sourceFile, 'utf-8');
    const functions = this.extractFunctions(content);
    
    const testContent = await fs.readFile(testFile, 'utf-8');
    
    for (const func of functions) {
      if (!testContent.includes(func)) {
        missing.push(`Test for function: ${func}`);
      }
    }

    return missing;
  }

  private async countTests(testFile: string): Promise<number> {
    const content = await fs.readFile(testFile, 'utf-8');
    const matches = content.match(/\bit\s*\(/g);
    return matches ? matches.length : 0;
  }

  private extractFunctions(content: string): string[] {
    const functions: string[] = [];
    
    // Extract function declarations
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }

    // Extract arrow functions
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }

    // Extract class methods
    const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+\s*)?{/g;
    while ((match = methodRegex.exec(content)) !== null) {
      if (!['constructor', 'if', 'for', 'while', 'switch'].includes(match[1])) {
        functions.push(match[1]);
      }
    }

    return [...new Set(functions)];
  }

  private extractClassName(content: string): string | null {
    const match = content.match(/(?:export\s+)?class\s+(\w+)/);
    return match ? match[1] : null;
  }

  private getImportPath(sourceFile: string): string {
    return sourceFile.replace(/\.(ts|tsx)$/, '').replace(/^.*\/src\//, './');
  }

  private generateTestCase(funcName: string, isMethod: boolean): string {
    const prefix = isMethod ? 'instance.' : '';
    
    return `
  describe('${funcName}', () => {
    it('should work correctly with valid input', () => {
      // Arrange
      const input = {};
      
      // Act
      const result = ${prefix}${funcName}(input);
      
      // Assert
      expect(result).toBeDefined();
    });

    it('should handle edge cases', () => {
      // Add edge case tests
    });

    it('should handle errors gracefully', () => {
      // Add error handling tests
    });
  });
`;
  }

  private buildCoverageConfig(): any {
    return {
      enabled: true,
      all: true,
      clean: true,
      reportsDirectory: this.config.coverageDirectory,
      reporter: this.config.reporters?.map(r => 
        typeof r === 'string' ? r : [r.type, r.options]
      ),
      include: this.config.collectFrom || ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/*.d.ts',
        '**/types/**',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}'
      ],
      thresholds: this.config.thresholds
    };
  }

  private buildCoverageFlags(): string {
    const flags: string[] = [];
    
    if (this.config.reporters) {
      this.config.reporters.forEach(reporter => {
        flags.push(`--coverage.reporter=${reporter.type}`);
      });
    }

    if (this.config.thresholds) {
      if (this.config.thresholds.lines) {
        flags.push(`--coverage.lines=${this.config.thresholds.lines}`);
      }
      if (this.config.thresholds.functions) {
        flags.push(`--coverage.functions=${this.config.thresholds.functions}`);
      }
      if (this.config.thresholds.branches) {
        flags.push(`--coverage.branches=${this.config.thresholds.branches}`);
      }
      if (this.config.thresholds.statements) {
        flags.push(`--coverage.statements=${this.config.thresholds.statements}`);
      }
    }

    return flags.join(' ');
  }

  private parseCoverageData(data: any): CoverageMetrics {
    const total = data.total || {};
    
    return {
      lines: this.parseMetric(total.lines),
      statements: this.parseMetric(total.statements),
      functions: this.parseMetric(total.functions),
      branches: this.parseMetric(total.branches),
      overall: this.calculateOverall(total)
    };
  }

  private parseMetric(metric: any): CoverageMetric {
    if (!metric) {
      return { total: 0, covered: 0, skipped: 0, percentage: 0 };
    }

    return {
      total: metric.total || 0,
      covered: metric.covered || 0,
      skipped: metric.skipped || 0,
      percentage: metric.pct || 0
    };
  }

  private calculateOverall(total: any): number {
    const metrics = ['lines', 'statements', 'functions', 'branches'];
    let sum = 0;
    let count = 0;

    for (const metric of metrics) {
      if (total[metric] && total[metric].pct !== undefined) {
        sum += total[metric].pct;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  private calculateMetric(map: any, coverage: any): CoverageMetric {
    if (!map || !coverage) {
      return { total: 0, covered: 0, skipped: 0, percentage: 0 };
    }

    const total = Object.keys(map).length;
    const covered = Object.values(coverage).filter((v: any) => v > 0).length;
    const percentage = total > 0 ? (covered / total) * 100 : 0;

    return {
      total,
      covered,
      skipped: 0,
      percentage
    };
  }

  private getUncoveredLines(data: any): number[] {
    const uncovered: number[] = [];
    
    if (data.statementMap && data.s) {
      for (const [id, statement] of Object.entries(data.statementMap)) {
        if (data.s[id] === 0) {
          uncovered.push((statement as any).start.line);
        }
      }
    }

    return [...new Set(uncovered)].sort((a, b) => a - b);
  }

  private getLineCode(data: any, lineNum: number): string {
    // This would need access to the actual source file
    return `Line ${lineNum}`;
  }

  private generateSummary(coverage: CoverageMetrics, detailed: FileCoverage[]): string {
    const lines: string[] = [
      `Coverage Report`,
      `===============`,
      ``,
      `Overall Coverage: ${coverage.overall.toFixed(2)}%`,
      ``,
      `Metrics:`,
      `  Lines:      ${coverage.lines.covered}/${coverage.lines.total} (${coverage.lines.percentage.toFixed(2)}%)`,
      `  Statements: ${coverage.statements.covered}/${coverage.statements.total} (${coverage.statements.percentage.toFixed(2)}%)`,
      `  Functions:  ${coverage.functions.covered}/${coverage.functions.total} (${coverage.functions.percentage.toFixed(2)}%)`,
      `  Branches:   ${coverage.branches.covered}/${coverage.branches.total} (${coverage.branches.percentage.toFixed(2)}%)`,
      ``
    ];

    if (detailed.length > 0) {
      lines.push(`Files with Low Coverage:`);
      const lowCoverage = detailed
        .filter(f => f.lines.percentage < this.config.targetCoverage)
        .sort((a, b) => a.lines.percentage - b.lines.percentage)
        .slice(0, 10);

      lowCoverage.forEach(file => {
        lines.push(`  ${file.file}: ${file.lines.percentage.toFixed(2)}%`);
      });
    }

    return lines.join('\n');
  }

  private createEmptyMetrics(): CoverageMetrics {
    const emptyMetric: CoverageMetric = {
      total: 0,
      covered: 0,
      skipped: 0,
      percentage: 0
    };

    return {
      lines: emptyMetric,
      statements: emptyMetric,
      functions: emptyMetric,
      branches: emptyMetric,
      overall: 0
    };
  }

  // Public utility methods
  async generateCoverageReport(projectPath: string): Promise<string> {
    const result = await this.analyze(projectPath);
    return result.report.summary;
  }

  async checkCoverageThreshold(projectPath: string): Promise<boolean> {
    const result = await this.analyze(projectPath);
    return result.success;
  }

  async getUncoveredCode(projectPath: string): Promise<UncoveredFile[]> {
    const result = await this.analyze(projectPath);
    return result.uncoveredFiles;
  }
}

// Export utility functions
export async function analyzeCoverage(
  projectPath: string,
  config?: Partial<CoverageConfig>
): Promise<CoverageResult> {
  const coverage = new UnitTestCoverage({
    targetCoverage: 95,
    ...config
  });
  return coverage.analyze(projectPath);
}

export async function generateMissingTests(
  projectPath: string,
  config?: Partial<CoverageConfig>
): Promise<TestFile[]> {
  const coverage = new UnitTestCoverage({
    targetCoverage: 95,
    ...config
  });
  return coverage.generateMissingTests(projectPath);
}