/**
 * Startup time regression testing framework
 */
import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface PerformanceBenchmark {
  command: string;
  timestamp: number;
  duration: number;
  version: string;
  nodeVersion: string;
  platform: string;
  cpuUsage?: NodeJS.CpuUsage;
  memoryUsage?: NodeJS.MemoryUsage;
}

interface RegressionReport {
  baseline: PerformanceBenchmark;
  current: PerformanceBenchmark;
  regression: number; // Percentage change
  status: 'pass' | 'fail' | 'warning';
  threshold: number;
}

export class StartupRegressionTester {
  private static instance: StartupRegressionTester;
  private benchmarksPath: string;
  private baselines: Map<string, PerformanceBenchmark> = new Map();
  
  // Performance thresholds
  private readonly REGRESSION_THRESHOLD = 10; // 10% slower is a regression
  private readonly WARNING_THRESHOLD = 5; // 5% slower is a warning
  
  private constructor() {
    const cacheDir = join(homedir(), '.re-shell', 'benchmarks');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    
    this.benchmarksPath = join(cacheDir, 'startup-benchmarks.json');
    this.loadBaselines();
  }
  
  static getInstance(): StartupRegressionTester {
    if (!StartupRegressionTester.instance) {
      StartupRegressionTester.instance = new StartupRegressionTester();
    }
    return StartupRegressionTester.instance;
  }
  
  /**
   * Measure startup time for a command
   */
  async measureStartupTime(
    command: string,
    args: string[] = [],
    iterations = 5
  ): Promise<PerformanceBenchmark> {
    const measurements: number[] = [];
    let cpuUsage: NodeJS.CpuUsage | undefined;
    let memoryUsage: NodeJS.MemoryUsage | undefined;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const startCpu = process.cpuUsage();
      const startMemory = process.memoryUsage();
      
      await this.runCommand(command, args);
      
      const endTime = performance.now();
      const endCpu = process.cpuUsage(startCpu);
      const endMemory = process.memoryUsage();
      
      measurements.push(endTime - startTime);
      
      // Use measurements from the last iteration
      if (i === iterations - 1) {
        cpuUsage = endCpu;
        memoryUsage = endMemory;
      }
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Remove outliers and calculate median
    measurements.sort((a, b) => a - b);
    const median = measurements[Math.floor(measurements.length / 2)];
    
    return {
      command: `${command} ${args.join(' ')}`.trim(),
      timestamp: Date.now(),
      duration: median,
      version: this.getVersion(),
      nodeVersion: process.version,
      platform: process.platform,
      cpuUsage,
      memoryUsage
    };
  }
  
  /**
   * Run a command and measure its execution time
   */
  private async runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'ignore',
        cwd: process.cwd()
      });
      
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, 10000); // 10 second timeout
      
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Set baseline for a command
   */
  async setBaseline(command: string, args: string[] = []): Promise<void> {
    const benchmark = await this.measureStartupTime(command, args);
    const key = benchmark.command;
    
    this.baselines.set(key, benchmark);
    this.saveBaselines();
    
    console.log(`Baseline set for "${key}": ${benchmark.duration.toFixed(2)}ms`);
  }
  
  /**
   * Test for regressions against baseline
   */
  async testRegression(
    command: string,
    args: string[] = []
  ): Promise<RegressionReport> {
    const current = await this.measureStartupTime(command, args);
    const key = current.command;
    const baseline = this.baselines.get(key);
    
    if (!baseline) {
      throw new Error(`No baseline found for command: ${key}`);
    }
    
    const regression = ((current.duration - baseline.duration) / baseline.duration) * 100;
    
    let status: 'pass' | 'fail' | 'warning';
    if (regression >= this.REGRESSION_THRESHOLD) {
      status = 'fail';
    } else if (regression >= this.WARNING_THRESHOLD) {
      status = 'warning';
    } else {
      status = 'pass';
    }
    
    return {
      baseline,
      current,
      regression,
      status,
      threshold: this.REGRESSION_THRESHOLD
    };
  }
  
  /**
   * Run comprehensive regression test suite
   */
  async runTestSuite(): Promise<RegressionReport[]> {
    const testCommands: [string, string[]][] = [
      ['node', ['dist/index.js', '--version']],
      ['node', ['dist/index.js', '--help']],
      ['node', ['dist/index.js', 'init', '--help']],
      ['node', ['dist/index.js', 'plugin', 'list', '--help']]
    ];
    
    const reports: RegressionReport[] = [];
    
    for (const [command, args] of testCommands) {
      try {
        const report = await this.testRegression(command, args);
        reports.push(report);
      } catch (error) {
        console.error(`Failed to test ${command} ${Array.isArray(args) ? args.join(' ') : args || ''}: ${error}`);
      }
    }
    
    return reports;
  }
  
  /**
   * Generate performance report
   */
  generateReport(reports: RegressionReport[]): string {
    const lines = [
      '# Re-Shell CLI Startup Performance Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Summary',
      ''
    ];
    
    const passed = reports.filter(r => r.status === 'pass').length;
    const warnings = reports.filter(r => r.status === 'warning').length;
    const failed = reports.filter(r => r.status === 'fail').length;
    
    lines.push(`- ✅ Passed: ${passed}`);
    lines.push(`- ⚠️ Warnings: ${warnings}`);
    lines.push(`- ❌ Failed: ${failed}`);
    lines.push('');
    
    lines.push('## Detailed Results');
    lines.push('');
    
    for (const report of reports) {
      const icon = report.status === 'pass' ? '✅' : 
                   report.status === 'warning' ? '⚠️' : '❌';
      
      lines.push(`### ${icon} ${report.current.command}`);
      lines.push('');
      lines.push(`| Metric | Baseline | Current | Change |`);
      lines.push(`|--------|----------|---------|--------|`);
      lines.push(`| Duration | ${report.baseline.duration.toFixed(2)}ms | ${report.current.duration.toFixed(2)}ms | ${report.regression > 0 ? '+' : ''}${report.regression.toFixed(1)}% |`);
      
      if (report.baseline.memoryUsage && report.current.memoryUsage) {
        const memoryChange = ((report.current.memoryUsage.heapUsed - report.baseline.memoryUsage.heapUsed) / report.baseline.memoryUsage.heapUsed) * 100;
        lines.push(`| Memory | ${(report.baseline.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB | ${(report.current.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB | ${memoryChange > 0 ? '+' : ''}${memoryChange.toFixed(1)}% |`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Continuous monitoring setup
   */
  setupContinuousMonitoring(): void {
    // Run tests periodically during development
    if (process.env.NODE_ENV === 'development') {
      setInterval(async () => {
        try {
          const reports = await this.runTestSuite();
          const failed = reports.filter(r => r.status === 'fail');
          
          if (failed.length > 0) {
            console.warn(`\n⚠️ Performance regression detected in ${failed.length} command(s):`);
            failed.forEach(report => {
              console.warn(`  - ${report.current.command}: +${report.regression.toFixed(1)}% slower`);
            });
          }
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 60000); // Check every minute
    }
  }
  
  /**
   * Load baselines from disk
   */
  private loadBaselines(): void {
    if (existsSync(this.benchmarksPath)) {
      try {
        const data = JSON.parse(readFileSync(this.benchmarksPath, 'utf-8'));
        Object.entries(data).forEach(([key, benchmark]) => {
          this.baselines.set(key, benchmark as PerformanceBenchmark);
        });
      } catch {
        // Ignore load errors
      }
    }
  }
  
  /**
   * Save baselines to disk
   */
  private saveBaselines(): void {
    try {
      const data: Record<string, PerformanceBenchmark> = {};
      this.baselines.forEach((benchmark, key) => {
        data[key] = benchmark;
      });
      
      writeFileSync(this.benchmarksPath, JSON.stringify(data, null, 2));
    } catch {
      // Ignore save errors
    }
  }
  
  /**
   * Get current CLI version
   */
  private getVersion(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('../../package.json').version;
    } catch {
      return 'unknown';
    }
  }
}

export const startupTester = StartupRegressionTester.getInstance();