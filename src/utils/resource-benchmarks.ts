/**
 * Resource usage testing and benchmarking
 */
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';

interface BenchmarkResult {
  name: string;
  duration: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  memoryPeak: number;
  memoryDelta: number;
  cpuBefore: NodeJS.CpuUsage;
  cpuAfter: NodeJS.CpuUsage;
  cpuUsage: number;
  startTime: number;
  endTime: number;
  iterations: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  summary: {
    totalDuration: number;
    averageDuration: number;
    memoryEfficiency: number;
    cpuEfficiency: number;
    successRate: number;
  };
}

interface LoadTestConfig {
  concurrent: number;
  duration: number; // seconds
  rampUp: number; // seconds
  operations: Array<{
    name: string;
    weight: number;
    operation: () => Promise<any>;
  }>;
}

interface LoadTestResult {
  config: LoadTestConfig;
  results: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    operationsPerSecond: number;
    averageResponseTime: number;
    percentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    memoryUsage: {
      initial: number;
      peak: number;
      final: number;
    };
    errors: string[];
  };
}

export class ResourceBenchmarks {
  private static instance: ResourceBenchmarks;
  private benchmarkHistory: BenchmarkResult[] = [];
  private monitoring = false;
  private memoryPeak = 0;
  
  private constructor() { /* singleton */ }
  
  static getInstance(): ResourceBenchmarks {
    if (!ResourceBenchmarks.instance) {
      ResourceBenchmarks.instance = new ResourceBenchmarks();
    }
    return ResourceBenchmarks.instance;
  }
  
  /**
   * Run a single benchmark
   */
  async benchmark<T>(
    name: string,
    operation: () => Promise<T>,
    iterations = 1,
    metadata?: Record<string, any>
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    const cpuBefore = process.cpuUsage();
    
    this.startMemoryMonitoring();
    
    let success = true;
    let error: string | undefined;
    
    try {
      for (let i = 0; i < iterations; i++) {
        await operation();
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }
    
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    const cpuAfter = process.cpuUsage(cpuBefore);
    
    this.stopMemoryMonitoring();
    
    const result: BenchmarkResult = {
      name,
      duration: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryPeak: this.memoryPeak,
      memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed,
      cpuBefore,
      cpuAfter,
      cpuUsage: (cpuAfter.user + cpuAfter.system) / 1000, // microseconds to milliseconds
      startTime,
      endTime,
      iterations,
      success,
      error,
      metadata
    };
    
    this.benchmarkHistory.push(result);
    return result;
  }
  
  /**
   * Run a benchmark suite
   */
  async benchmarkSuite(
    suiteName: string,
    benchmarks: Array<{
      name: string;
      operation: () => Promise<any>;
      iterations?: number;
      metadata?: Record<string, any>;
    }>
  ): Promise<BenchmarkSuite> {
    const results: BenchmarkResult[] = [];
    
    for (const benchmark of benchmarks) {
      const result = await this.benchmark(
        benchmark.name,
        benchmark.operation,
        benchmark.iterations || 1,
        benchmark.metadata
      );
      results.push(result);
    }
    
    const summary = this.calculateSuiteSummary(results);
    
    return {
      name: suiteName,
      results,
      summary
    };
  }
  
  /**
   * Run CLI startup benchmark
   */
  async benchmarkStartup(
    cliPath: string,
    args: string[] = ['--version'],
    iterations = 10
  ): Promise<BenchmarkResult> {
    return this.benchmark(
      'CLI Startup',
      async () => {
        return new Promise<void>((resolve, reject) => {
          const startTime = performance.now();
          const child = spawn('node', [cliPath, ...args], {
            stdio: 'ignore'
          });
          
          child.on('close', (code) => {
            const endTime = performance.now();
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`CLI exited with code ${code}`));
            }
          });
          
          child.on('error', reject);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            child.kill();
            reject(new Error('CLI startup timeout'));
          }, 10000);
        });
      },
      iterations,
      { cliPath, args }
    );
  }
  
  /**
   * Run memory stress test
   */
  async memoryStressTest(
    allocations = 1000,
    allocationSize: number = 1024 * 1024 // 1MB
  ): Promise<BenchmarkResult> {
    return this.benchmark(
      'Memory Stress Test',
      async () => {
        const allocatedBuffers: Buffer[] = [];
        
        // Allocate memory
        for (let i = 0; i < allocations; i++) {
          const buffer = Buffer.alloc(allocationSize);
          buffer.fill(i % 256); // Fill with data to prevent optimization
          allocatedBuffers.push(buffer);
          
          // Yield control occasionally
          if (i % 100 === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }
        
        // Force GC if available
        if (global.gc) {
          global.gc();
        }
        
        // Keep references to prevent early GC
        return allocatedBuffers.length;
      },
      1,
      { allocations, allocationSize }
    );
  }
  
  /**
   * Run CPU stress test
   */
  async cpuStressTest(
    duration = 1000, // milliseconds
    complexity = 1000000
  ): Promise<BenchmarkResult> {
    return this.benchmark(
      'CPU Stress Test',
      async () => {
        const startTime = Date.now();
        let operations = 0;
        
        while (Date.now() - startTime < duration) {
          // Perform CPU-intensive calculation
          for (let i = 0; i < complexity; i++) {
            Math.sqrt(Math.random() * Math.PI);
            operations++;
          }
          
          // Yield control
          await new Promise(resolve => setImmediate(resolve));
        }
        
        return operations;
      },
      1,
      { duration, complexity }
    );
  }
  
  /**
   * Run concurrent operations test
   */
  async concurrencyTest(
    concurrency = 10,
    operationDuration = 100 // milliseconds
  ): Promise<BenchmarkResult> {
    return this.benchmark(
      'Concurrency Test',
      async () => {
        const operations: Promise<void>[] = [];
        
        for (let i = 0; i < concurrency; i++) {
          operations.push(
            new Promise(resolve => {
              setTimeout(resolve, operationDuration + Math.random() * operationDuration);
            })
          );
        }
        
        await Promise.all(operations);
      },
      1,
      { concurrency, operationDuration }
    );
  }
  
  /**
   * Run load test
   */
  async loadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const results: Array<{ success: boolean; duration: number; error?: string }> = [];
    const startTime = Date.now();
    const memoryInitial = process.memoryUsage().heapUsed / 1024 / 1024;
    let memoryPeak = memoryInitial;
    
    // Start memory monitoring
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage().heapUsed / 1024 / 1024;
      memoryPeak = Math.max(memoryPeak, current);
    }, 100);
    
    try {
      const workers: Promise<void>[] = [];
      const rampUpDelay = (config.rampUp * 1000) / config.concurrent;
      
      for (let i = 0; i < config.concurrent; i++) {
        const worker = this.createLoadTestWorker(config, results, i * rampUpDelay);
        workers.push(worker);
      }
      
      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, config.duration * 1000));
      
      // Let workers finish current operations
      await Promise.allSettled(workers);
      
    } finally {
      clearInterval(memoryMonitor);
    }
    
    const endTime = Date.now();
    const actualDuration = (endTime - startTime) / 1000;
    const memoryFinal = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // Calculate statistics
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const durations = successful.map(r => r.duration).sort((a, b) => a - b);
    
    return {
      config,
      results: {
        totalOperations: results.length,
        successfulOperations: successful.length,
        failedOperations: failed.length,
        operationsPerSecond: results.length / actualDuration,
        averageResponseTime: durations.length > 0 
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
          : 0,
        percentiles: {
          p50: durations[Math.floor(durations.length * 0.5)] || 0,
          p95: durations[Math.floor(durations.length * 0.95)] || 0,
          p99: durations[Math.floor(durations.length * 0.99)] || 0
        },
        memoryUsage: {
          initial: memoryInitial,
          peak: memoryPeak,
          final: memoryFinal
        },
        errors: failed.map(f => f.error || 'Unknown error')
      }
    };
  }
  
  /**
   * Get benchmark history
   */
  getHistory(): BenchmarkResult[] {
    return [...this.benchmarkHistory];
  }
  
  /**
   * Get performance baseline
   */
  getBaseline(): {
    startupTime: number;
    memoryUsage: number;
    cpuEfficiency: number;
  } {
    const startupBenchmarks = this.benchmarkHistory.filter(b => b.name === 'CLI Startup');
    const memoryBenchmarks = this.benchmarkHistory.filter(b => b.name === 'Memory Stress Test');
    const cpuBenchmarks = this.benchmarkHistory.filter(b => b.name === 'CPU Stress Test');
    
    return {
      startupTime: startupBenchmarks.length > 0
        ? startupBenchmarks.reduce((sum, b) => sum + b.duration, 0) / startupBenchmarks.length
        : 0,
      memoryUsage: memoryBenchmarks.length > 0
        ? memoryBenchmarks.reduce((sum, b) => sum + b.memoryDelta, 0) / memoryBenchmarks.length
        : 0,
      cpuEfficiency: cpuBenchmarks.length > 0
        ? cpuBenchmarks.reduce((sum, b) => sum + b.cpuUsage, 0) / cpuBenchmarks.length
        : 0
    };
  }
  
  /**
   * Clear benchmark history
   */
  clearHistory(): void {
    this.benchmarkHistory = [];
  }
  
  /**
   * Export benchmark results
   */
  exportResults(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = [
        'name', 'duration', 'memoryDelta', 'cpuUsage', 'iterations', 
        'success', 'startTime', 'endTime'
      ];
      
      const rows = this.benchmarkHistory.map(result => [
        result.name,
        result.duration,
        result.memoryDelta,
        result.cpuUsage,
        result.iterations,
        result.success,
        result.startTime,
        result.endTime
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } else {
      return JSON.stringify(this.benchmarkHistory, null, 2);
    }
  }
  
  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.memoryPeak = process.memoryUsage().heapUsed;
    
    const monitor = () => {
      if (!this.monitoring) return;
      
      const current = process.memoryUsage().heapUsed;
      this.memoryPeak = Math.max(this.memoryPeak, current);
      
      setImmediate(monitor);
    };
    
    monitor();
  }
  
  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring(): void {
    this.monitoring = false;
  }
  
  /**
   * Calculate suite summary
   */
  private calculateSuiteSummary(results: BenchmarkResult[]): BenchmarkSuite['summary'] {
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successful = results.filter(r => r.success);
    
    return {
      totalDuration,
      averageDuration: results.length > 0 ? totalDuration / results.length : 0,
      memoryEfficiency: successful.length > 0
        ? successful.reduce((sum, r) => sum + (r.memoryDelta / r.duration), 0) / successful.length
        : 0,
      cpuEfficiency: successful.length > 0
        ? successful.reduce((sum, r) => sum + (r.cpuUsage / r.duration), 0) / successful.length
        : 0,
      successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0
    };
  }
  
  /**
   * Create load test worker
   */
  private async createLoadTestWorker(
    config: LoadTestConfig,
    results: Array<{ success: boolean; duration: number; error?: string }>,
    delay: number
  ): Promise<void> {
    // Initial delay for ramp-up
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const endTime = Date.now() + (config.duration * 1000);
    const totalWeight = config.operations.reduce((sum, op) => sum + op.weight, 0);
    
    while (Date.now() < endTime) {
      // Select operation based on weight
      const random = Math.random() * totalWeight;
      let currentWeight = 0;
      let selectedOperation = config.operations[0];
      
      for (const operation of config.operations) {
        currentWeight += operation.weight;
        if (random <= currentWeight) {
          selectedOperation = operation;
          break;
        }
      }
      
      // Execute operation
      const startTime = performance.now();
      try {
        await selectedOperation.operation();
        const duration = performance.now() - startTime;
        results.push({ success: true, duration });
      } catch (error) {
        const duration = performance.now() - startTime;
        results.push({ 
          success: false, 
          duration, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Small delay between operations
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}

// Export singleton instance
export const resourceBenchmarks = ResourceBenchmarks.getInstance();