import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { performance } from 'perf_hooks';
import * as os from 'os';
import { execSync } from 'child_process';

export interface BenchmarkConfig {
  suites: BenchmarkSuite[];
  iterations?: number;
  warmupRuns?: number;
  cooldownTime?: number;
  compareWithBaseline?: boolean;
  generateReport?: boolean;
  failOnRegression?: boolean;
  regressionThreshold?: number;
  outputPath?: string;
  includeSystemInfo?: boolean;
  includeMemoryProfile?: boolean;
  includeCpuProfile?: boolean;
}

export interface BenchmarkSuite {
  name: string;
  description?: string;
  benchmarks: Benchmark[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  timeout?: number;
  tags?: string[];
}

export interface Benchmark {
  name: string;
  fn: () => Promise<void> | void;
  options?: BenchmarkOptions;
  baseline?: number;
  tags?: string[];
}

export interface BenchmarkOptions {
  iterations?: number;
  warmupRuns?: number;
  timeout?: number;
  minSamples?: number;
  maxTime?: number;
  async?: boolean;
}

export interface BenchmarkResult {
  suite: string;
  benchmark: string;
  metrics: PerformanceMetrics;
  samples: number[];
  regression?: RegressionInfo;
  timestamp: Date;
  systemInfo?: SystemInfo;
  memoryProfile?: MemoryProfile;
  cpuProfile?: CpuProfile;
}

export interface PerformanceMetrics {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  marginOfError: number;
  relativeMarginOfError: number;
  samples: number;
  ops: number; // Operations per second
}

export interface RegressionInfo {
  detected: boolean;
  baseline: number;
  current: number;
  difference: number;
  percentage: number;
  threshold: number;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  cpus: number;
  cpuModel: string;
  totalMemory: number;
  nodeVersion: string;
  v8Version: string;
}

export interface MemoryProfile {
  heapUsedBefore: number;
  heapUsedAfter: number;
  heapDelta: number;
  external: number;
  arrayBuffers: number;
  gcRuns: number;
}

export interface CpuProfile {
  userTime: number;
  systemTime: number;
  totalTime: number;
  cpuUsage: number;
}

export interface BenchmarkReport {
  summary: BenchmarkSummary;
  results: BenchmarkResult[];
  comparisons?: BenchmarkComparison[];
  systemInfo: SystemInfo;
  timestamp: Date;
  duration: number;
}

export interface BenchmarkSummary {
  totalBenchmarks: number;
  totalSuites: number;
  totalSamples: number;
  totalDuration: number;
  regressions: number;
  improvements: number;
}

export interface BenchmarkComparison {
  suite: string;
  benchmark: string;
  baseline: PerformanceMetrics;
  current: PerformanceMetrics;
  change: {
    absolute: number;
    percentage: number;
    significant: boolean;
  };
}

export interface BaselineData {
  version: string;
  timestamp: Date;
  results: Map<string, BenchmarkResult>;
}

export class PerformanceBenchmark extends EventEmitter {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];
  private baseline: BaselineData | null = null;

  constructor(config: BenchmarkConfig) {
    super();
    this.config = {
      iterations: 100,
      warmupRuns: 10,
      cooldownTime: 100,
      compareWithBaseline: true,
      generateReport: true,
      failOnRegression: true,
      regressionThreshold: 5, // 5% regression threshold
      outputPath: './benchmarks',
      includeSystemInfo: true,
      includeMemoryProfile: true,
      includeCpuProfile: true,
      ...config
    };
  }

  async run(): Promise<BenchmarkReport> {
    this.emit('benchmark:start', { suites: this.config.suites.length });

    const startTime = performance.now();

    try {
      // Load baseline if comparison is enabled
      if (this.config.compareWithBaseline) {
        await this.loadBaseline();
      }

      // Collect system information
      const systemInfo = this.config.includeSystemInfo ? 
        this.collectSystemInfo() : 
        this.getMinimalSystemInfo();

      // Run all benchmark suites
      for (const suite of this.config.suites) {
        await this.runSuite(suite);
      }

      // Generate report
      const report = this.generateReport(
        systemInfo,
        (performance.now() - startTime) / 1000
      );

      // Save results as new baseline
      await this.saveBaseline();

      // Check for regressions
      if (this.config.failOnRegression) {
        this.checkRegressions(report);
      }

      this.emit('benchmark:complete', report);
      return report;

    } catch (error: any) {
      this.emit('benchmark:error', error);
      throw error;
    }
  }

  private async runSuite(suite: BenchmarkSuite): Promise<void> {
    this.emit('suite:start', suite);

    try {
      // Run setup if provided
      if (suite.setup) {
        await suite.setup();
      }

      // Run each benchmark in the suite
      for (const benchmark of suite.benchmarks) {
        const result = await this.runBenchmark(suite, benchmark);
        this.results.push(result);
      }

    } finally {
      // Run teardown if provided
      if (suite.teardown) {
        await suite.teardown();
      }
    }

    this.emit('suite:complete', suite);
  }

  private async runBenchmark(
    suite: BenchmarkSuite,
    benchmark: Benchmark
  ): Promise<BenchmarkResult> {
    this.emit('benchmark:run', { suite: suite.name, benchmark: benchmark.name });

    const options = {
      iterations: this.config.iterations,
      warmupRuns: this.config.warmupRuns,
      ...benchmark.options
    };

    // Warmup runs
    for (let i = 0; i < options.warmupRuns!; i++) {
      await this.executeBenchmark(benchmark);
    }

    // Cool down
    await this.wait(this.config.cooldownTime!);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Collect initial memory state
    const memoryBefore = this.config.includeMemoryProfile ? 
      process.memoryUsage() : null;

    // Collect samples
    const samples: number[] = [];
    const cpuBefore = this.config.includeCpuProfile ? 
      process.cpuUsage() : null;

    for (let i = 0; i < options.iterations!; i++) {
      const duration = await this.executeBenchmark(benchmark);
      samples.push(duration);

      // Cool down between iterations
      if (i < options.iterations! - 1) {
        await this.wait(10);
      }
    }

    const cpuAfter = this.config.includeCpuProfile ? 
      process.cpuUsage(cpuBefore!) : null;

    // Collect final memory state
    const memoryAfter = this.config.includeMemoryProfile ? 
      process.memoryUsage() : null;

    // Calculate metrics
    const metrics = this.calculateMetrics(samples);

    // Check for regression
    const regression = this.checkRegression(
      suite.name,
      benchmark.name,
      metrics.mean
    );

    const result: BenchmarkResult = {
      suite: suite.name,
      benchmark: benchmark.name,
      metrics,
      samples,
      regression,
      timestamp: new Date(),
      systemInfo: this.config.includeSystemInfo ? 
        this.collectSystemInfo() : undefined,
      memoryProfile: this.createMemoryProfile(memoryBefore, memoryAfter),
      cpuProfile: this.createCpuProfile(cpuBefore, cpuAfter, samples.length)
    };

    this.emit('benchmark:result', result);
    return result;
  }

  private async executeBenchmark(benchmark: Benchmark): Promise<number> {
    const start = performance.now();
    
    try {
      const result = benchmark.fn();
      if (result instanceof Promise) {
        await result;
      }
    } catch (error: any) {
      this.emit('benchmark:error', { benchmark: benchmark.name, error });
      throw error;
    }

    return performance.now() - start;
  }

  private calculateMetrics(samples: number[]): PerformanceMetrics {
    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const median = n % 2 === 0 ?
      (sorted[n / 2 - 1] + sorted[n / 2]) / 2 :
      sorted[Math.floor(n / 2)];

    const min = sorted[0];
    const max = sorted[n - 1];

    // Calculate standard deviation
    const variance = samples.reduce((acc, val) => {
      return acc + Math.pow(val - mean, 2);
    }, 0) / n;
    const stdDev = Math.sqrt(variance);

    // Calculate margin of error (95% confidence interval)
    const marginOfError = 1.96 * (stdDev / Math.sqrt(n));
    const relativeMarginOfError = (marginOfError / mean) * 100;

    // Operations per second
    const ops = 1000 / mean;

    return {
      mean,
      median,
      min,
      max,
      stdDev,
      marginOfError,
      relativeMarginOfError,
      samples: n,
      ops
    };
  }

  private checkRegression(
    suite: string,
    benchmark: string,
    current: number
  ): RegressionInfo | undefined {
    if (!this.baseline || !this.config.compareWithBaseline) {
      return undefined;
    }

    const key = `${suite}/${benchmark}`;
    const baselineResult = this.baseline.results.get(key);

    if (!baselineResult) {
      return undefined;
    }

    const baseline = baselineResult.metrics.mean;
    const difference = current - baseline;
    const percentage = (difference / baseline) * 100;

    return {
      detected: percentage > this.config.regressionThreshold!,
      baseline,
      current,
      difference,
      percentage,
      threshold: this.config.regressionThreshold!
    };
  }

  private collectSystemInfo(): SystemInfo {
    const cpus = os.cpus();
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      totalMemory: os.totalmem(),
      nodeVersion: process.version,
      v8Version: process.versions.v8
    };
  }

  private getMinimalSystemInfo(): SystemInfo {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      cpuModel: 'Not collected',
      totalMemory: 0,
      nodeVersion: process.version,
      v8Version: process.versions.v8
    };
  }

  private createMemoryProfile(
    before: NodeJS.MemoryUsage | null,
    after: NodeJS.MemoryUsage | null
  ): MemoryProfile | undefined {
    if (!before || !after) return undefined;

    return {
      heapUsedBefore: before.heapUsed,
      heapUsedAfter: after.heapUsed,
      heapDelta: after.heapUsed - before.heapUsed,
      external: after.external,
      arrayBuffers: after.arrayBuffers || 0,
      gcRuns: 0 // Would need to track GC events
    };
  }

  private createCpuProfile(
    before: NodeJS.CpuUsage | null,
    after: NodeJS.CpuUsage | null,
    samples: number
  ): CpuProfile | undefined {
    if (!before || !after) return undefined;

    const userTime = (after.user - before.user) / 1000; // Convert to ms
    const systemTime = (after.system - before.system) / 1000;
    const totalTime = userTime + systemTime;

    return {
      userTime,
      systemTime,
      totalTime,
      cpuUsage: (totalTime / samples) * 100
    };
  }

  private async loadBaseline(): Promise<void> {
    const baselinePath = path.join(this.config.outputPath!, 'baseline.json');

    if (await fs.pathExists(baselinePath)) {
      const data = await fs.readJson(baselinePath);
      this.baseline = {
        version: data.version,
        timestamp: new Date(data.timestamp),
        results: new Map(data.results)
      };
      this.emit('baseline:loaded', this.baseline);
    }
  }

  private async saveBaseline(): Promise<void> {
    const baselinePath = path.join(this.config.outputPath!, 'baseline.json');
    await fs.ensureDir(this.config.outputPath!);

    const results: Array<[string, BenchmarkResult]> = [];
    for (const result of this.results) {
      const key = `${result.suite}/${result.benchmark}`;
      results.push([key, result]);
    }

    const baseline: any = {
      version: this.getVersion(),
      timestamp: new Date(),
      results
    };

    await fs.writeJson(baselinePath, baseline, { spaces: 2 });
    this.emit('baseline:saved', baselinePath);
  }

  private generateReport(
    systemInfo: SystemInfo,
    duration: number
  ): BenchmarkReport {
    const summary: BenchmarkSummary = {
      totalBenchmarks: this.results.length,
      totalSuites: new Set(this.results.map(r => r.suite)).size,
      totalSamples: this.results.reduce((acc, r) => acc + r.samples.length, 0),
      totalDuration: duration,
      regressions: this.results.filter(r => r.regression?.detected).length,
      improvements: this.results.filter(r => 
        r.regression && !r.regression.detected && r.regression.percentage < -5
      ).length
    };

    const comparisons = this.generateComparisons();

    const report: BenchmarkReport = {
      summary,
      results: this.results,
      comparisons,
      systemInfo,
      timestamp: new Date(),
      duration
    };

    if (this.config.generateReport) {
      this.saveReport(report);
    }

    return report;
  }

  private generateComparisons(): BenchmarkComparison[] | undefined {
    if (!this.baseline) return undefined;

    const comparisons: BenchmarkComparison[] = [];

    for (const result of this.results) {
      const key = `${result.suite}/${result.benchmark}`;
      const baselineResult = this.baseline.results.get(key);

      if (baselineResult) {
        const change = result.metrics.mean - baselineResult.metrics.mean;
        const percentage = (change / baselineResult.metrics.mean) * 100;

        comparisons.push({
          suite: result.suite,
          benchmark: result.benchmark,
          baseline: baselineResult.metrics,
          current: result.metrics,
          change: {
            absolute: change,
            percentage,
            significant: Math.abs(percentage) > 5
          }
        });
      }
    }

    return comparisons;
  }

  private async saveReport(report: BenchmarkReport): Promise<void> {
    const reportPath = path.join(
      this.config.outputPath!,
      `benchmark-${Date.now()}.json`
    );

    await fs.ensureDir(this.config.outputPath!);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    // Also save a human-readable report
    const readablePath = reportPath.replace('.json', '.txt');
    await fs.writeFile(readablePath, this.formatReport(report));

    this.emit('report:saved', { json: reportPath, txt: readablePath });
  }

  private formatReport(report: BenchmarkReport): string {
    const lines: string[] = [
      'Performance Benchmark Report',
      '===========================',
      '',
      `Date: ${report.timestamp.toISOString()}`,
      `Duration: ${report.duration.toFixed(2)}s`,
      '',
      'System Information:',
      `  Platform: ${report.systemInfo.platform} ${report.systemInfo.arch}`,
      `  CPUs: ${report.systemInfo.cpus} x ${report.systemInfo.cpuModel}`,
      `  Node: ${report.systemInfo.nodeVersion}`,
      '',
      'Summary:',
      `  Total Benchmarks: ${report.summary.totalBenchmarks}`,
      `  Total Samples: ${report.summary.totalSamples}`,
      `  Regressions: ${report.summary.regressions}`,
      `  Improvements: ${report.summary.improvements}`,
      '',
      'Results:',
      ''
    ];

    // Group results by suite
    const suites = new Map<string, BenchmarkResult[]>();
    for (const result of report.results) {
      if (!suites.has(result.suite)) {
        suites.set(result.suite, []);
      }
      suites.get(result.suite)!.push(result);
    }

    for (const [suite, results] of suites) {
      lines.push(`${suite}:`);
      
      for (const result of results) {
        const metrics = result.metrics;
        lines.push(`  ${result.benchmark}:`);
        lines.push(`    Mean: ${metrics.mean.toFixed(3)}ms (±${metrics.relativeMarginOfError.toFixed(1)}%)`);
        lines.push(`    Ops/sec: ${metrics.ops.toFixed(0)}`);
        
        if (result.regression) {
          const r = result.regression;
          const symbol = r.detected ? '⚠️ ' : r.percentage < -5 ? '✅ ' : '';
          lines.push(`    ${symbol}Change: ${r.percentage > 0 ? '+' : ''}${r.percentage.toFixed(1)}%`);
        }

        if (result.memoryProfile) {
          const mb = (bytes: number) => (bytes / 1048576).toFixed(2);
          lines.push(`    Memory: ${mb(result.memoryProfile.heapDelta)}MB`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private checkRegressions(report: BenchmarkReport): void {
    if (report.summary.regressions > 0) {
      const regressions = this.results
        .filter(r => r.regression?.detected)
        .map(r => `${r.suite}/${r.benchmark}: +${r.regression!.percentage.toFixed(1)}%`);

      const error = new Error(
        `Performance regressions detected:\n${regressions.join('\n')}`
      );
      (error as any).regressions = regressions;
      throw error;
    }
  }

  private getVersion(): string {
    try {
      return execSync('git describe --tags --always', { encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public utility methods
  addSuite(suite: BenchmarkSuite): void {
    this.config.suites.push(suite);
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }

  compareResults(a: BenchmarkResult, b: BenchmarkResult): number {
    const diff = a.metrics.mean - b.metrics.mean;
    const percentage = (diff / b.metrics.mean) * 100;
    return percentage;
  }
}

// Export utility functions
export function createBenchmark(
  name: string,
  fn: () => Promise<void> | void,
  options?: BenchmarkOptions
): Benchmark {
  return { name, fn, options };
}

export function createSuite(
  name: string,
  benchmarks: Benchmark[],
  options?: Partial<BenchmarkSuite>
): BenchmarkSuite {
  return {
    name,
    benchmarks,
    ...options
  };
}

export async function runBenchmarks(
  suites: BenchmarkSuite[],
  config?: Partial<BenchmarkConfig>
): Promise<BenchmarkReport> {
  const benchmark = new PerformanceBenchmark({
    suites,
    ...config
  });
  return benchmark.run();
}