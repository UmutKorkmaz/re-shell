import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import glob from 'fast-glob';

export interface PerformanceProfileConfig {
  profileDuration?: number;
  sampleInterval?: number;
  includeMemoryProfile?: boolean;
  includeCpuProfile?: boolean;
  includeIOProfile?: boolean;
  includeNetworkProfile?: boolean;
  outputPath?: string;
  generateReport?: boolean;
  optimization?: OptimizationConfig;
  benchmarks?: BenchmarkConfig[];
  thresholds?: PerformanceThresholds;
}

export interface OptimizationConfig {
  analyzeBundleSize?: boolean;
  analyzeDependencies?: boolean;
  analyzeStartupTime?: boolean;
  analyzeMemoryUsage?: boolean;
  analyzeBuildTime?: boolean;
  generateRecommendations?: boolean;
}

export interface BenchmarkConfig {
  name: string;
  command: string;
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
  env?: Record<string, string>;
}

export interface PerformanceThresholds {
  cpuUsage: number;          // Maximum CPU usage percentage
  memoryUsage: number;       // Maximum memory usage in MB
  startupTime: number;       // Maximum startup time in ms
  buildTime: number;         // Maximum build time in ms
  bundleSize: number;        // Maximum bundle size in MB
  networkLatency: number;    // Maximum network latency in ms
}

export interface PerformanceMetrics {
  timestamp: Date;
  duration: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  io: IOMetrics;
  network?: NetworkMetrics;
  process: ProcessMetrics;
  system: SystemMetrics;
}

export interface CpuMetrics {
  usage: number;             // CPU usage percentage
  userTime: number;          // User CPU time in ms
  systemTime: number;        // System CPU time in ms
  idleTime: number;          // Idle time in ms
  loadAverage: number[];     // Load average [1m, 5m, 15m]
  cores: number;             // Number of CPU cores
}

export interface MemoryMetrics {
  used: number;              // Used memory in bytes
  total: number;             // Total memory in bytes
  heap: HeapMetrics;         // Heap memory stats
  external: number;          // External memory in bytes
  rss: number;              // Resident set size in bytes
  arrayBuffers: number;     // Array buffers in bytes
}

export interface HeapMetrics {
  used: number;              // Used heap memory in bytes
  total: number;             // Total heap memory in bytes
  limit: number;             // Heap memory limit in bytes
  available: number;         // Available heap memory in bytes
}

export interface IOMetrics {
  read: IOOperation;         // Read operations
  write: IOOperation;        // Write operations
  total: IOSummary;          // Total I/O summary
}

export interface IOOperation {
  bytes: number;             // Bytes read/written
  operations: number;        // Number of operations
  time: number;              // Time spent in ms
  throughput: number;        // Throughput in bytes/sec
}

export interface IOSummary {
  bytes: number;             // Total bytes
  operations: number;        // Total operations
  time: number;              // Total time
  efficiency: number;        // I/O efficiency score (0-100)
}

export interface NetworkMetrics {
  requests: number;          // Number of network requests
  totalBytes: number;        // Total bytes transferred
  averageLatency: number;    // Average latency in ms
  errors: number;            // Number of network errors
  connections: number;       // Active connections
}

export interface ProcessMetrics {
  pid: number;               // Process ID
  ppid: number;              // Parent process ID
  startTime: Date;           // Process start time
  uptime: number;            // Process uptime in ms
  threads: number;           // Number of threads
  handles: number;           // Number of handles (Windows)
}

export interface SystemMetrics {
  platform: string;         // Operating system platform
  arch: string;              // System architecture
  nodeVersion: string;       // Node.js version
  v8Version: string;         // V8 engine version
  totalMemory: number;       // Total system memory
  freeMemory: number;        // Free system memory
  uptime: number;            // System uptime in seconds
  loadAverage: number[];     // System load average
}

export interface PerformanceProfile {
  config: PerformanceProfileConfig;
  startTime: Date;
  endTime: Date;
  duration: number;
  metrics: PerformanceMetrics[];
  benchmarks: BenchmarkResult[];
  analysis: PerformanceAnalysis;
  optimizations: OptimizationRecommendation[];
  summary: PerformanceSummary;
}

export interface BenchmarkResult {
  name: string;
  command: string;
  iterations: number;
  results: BenchmarkIteration[];
  statistics: BenchmarkStatistics;
  baseline?: BenchmarkBaseline;
  regression?: RegressionAnalysis;
}

export interface BenchmarkIteration {
  iteration: number;
  duration: number;
  exitCode: number;
  memory: MemorySnapshot;
  cpu: number;
  success: boolean;
  error?: string;
}

export interface BenchmarkStatistics {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  variance: number;
  percentiles: Record<number, number>;
  successRate: number;
  throughput: number;
}

export interface BenchmarkBaseline {
  version: string;
  date: Date;
  mean: number;
  environment: string;
}

export interface RegressionAnalysis {
  significant: boolean;
  change: number;             // Percentage change from baseline
  confidence: number;         // Confidence level (0-100)
  trend: 'improving' | 'degrading' | 'stable';
  pValue: number;
}

export interface MemorySnapshot {
  timestamp: Date;
  heap: HeapMetrics;
  rss: number;
  external: number;
  total: number;
}

export interface PerformanceAnalysis {
  bottlenecks: PerformanceBottleneck[];
  patterns: PerformancePattern[];
  trends: PerformanceTrend[];
  anomalies: PerformanceAnomaly[];
  efficiency: EfficiencyMetrics;
}

export interface PerformanceBottleneck {
  type: 'cpu' | 'memory' | 'io' | 'network' | 'startup' | 'build';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  location?: string;
  metrics: Record<string, number>;
  recommendations: string[];
}

export interface PerformancePattern {
  name: string;
  frequency: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  occurrences: PatternOccurrence[];
}

export interface PatternOccurrence {
  timestamp: Date;
  duration: number;
  context: string;
  metrics: Record<string, number>;
}

export interface PerformanceTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  rate: number;              // Rate of change per time unit
  confidence: number;        // Trend confidence (0-100)
  significance: boolean;     // Statistical significance
  prediction?: TrendPrediction;
}

export interface TrendPrediction {
  timeframe: number;         // Prediction timeframe in days
  expectedValue: number;     // Expected metric value
  confidence: number;        // Prediction confidence (0-100)
  range: {
    min: number;
    max: number;
  };
}

export interface PerformanceAnomaly {
  timestamp: Date;
  type: 'spike' | 'drop' | 'outlier' | 'pattern_break';
  metric: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  possibleCauses: string[];
}

export interface EfficiencyMetrics {
  overall: number;           // Overall efficiency score (0-100)
  cpu: number;              // CPU efficiency score
  memory: number;           // Memory efficiency score
  io: number;               // I/O efficiency score
  network?: number;         // Network efficiency score
  improvement: number;      // Potential improvement percentage
}

export interface OptimizationRecommendation {
  id: string;
  type: 'startup' | 'memory' | 'cpu' | 'io' | 'bundle' | 'dependency' | 'build' | 'network';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: OptimizationImpact;
  effort: 'low' | 'medium' | 'high';
  implementation: OptimizationImplementation;
  benefits: string[];
  risks: string[];
  metrics: OptimizationMetrics;
}

export interface OptimizationImpact {
  performance: number;       // Expected performance improvement (%)
  memory: number;           // Expected memory reduction (%)
  size: number;             // Expected size reduction (%)
  speed: number;            // Expected speed improvement (%)
}

export interface OptimizationImplementation {
  steps: string[];
  code?: string;
  config?: Record<string, any>;
  dependencies?: string[];
  automatizable: boolean;
  timeEstimate: string;
}

export interface OptimizationMetrics {
  before: Record<string, number>;
  after: Record<string, number>;
  improvement: Record<string, number>;
}

export interface PerformanceSummary {
  overall: PerformanceScore;
  categories: Record<string, PerformanceScore>;
  improvements: SummaryImprovement[];
  warnings: SummaryWarning[];
  achievements: SummaryAchievement[];
}

export interface PerformanceScore {
  score: number;             // Score (0-100)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'improving' | 'degrading' | 'stable';
  change: number;           // Change from previous assessment
}

export interface SummaryImprovement {
  area: string;
  potential: number;         // Potential improvement percentage
  effort: 'low' | 'medium' | 'high';
  impact: 'high' | 'medium' | 'low';
}

export interface SummaryWarning {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  metric: string;
  threshold: number;
  current: number;
}

export interface SummaryAchievement {
  title: string;
  description: string;
  metric: string;
  value: number;
}

export interface PerformanceReport {
  profile: PerformanceProfile;
  executive: ExecutiveSummary;
  technical: TechnicalDetails;
  actionPlan: ActionPlan;
  appendices: ReportAppendices;
  timestamp: Date;
}

export interface ExecutiveSummary {
  overallScore: number;
  keyFindings: string[];
  criticalIssues: number;
  potentialSavings: PotentialSavings;
  recommendations: ExecutiveRecommendation[];
}

export interface PotentialSavings {
  timeReduction: number;     // Time savings in ms
  memoryReduction: number;   // Memory savings in MB
  costSavings: number;       // Estimated cost savings
  efficiencyGain: number;    // Efficiency improvement percentage
}

export interface ExecutiveRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  impact: string;
  effort: string;
  timeline: string;
  roi: number;              // Return on investment
}

export interface TechnicalDetails {
  methodology: string;
  environment: EnvironmentInfo;
  dataCollection: DataCollectionInfo;
  analysis: AnalysisMethodology;
  limitations: string[];
}

export interface EnvironmentInfo {
  platform: string;
  nodeVersion: string;
  cpuInfo: os.CpuInfo[];
  memory: number;
  timestamp: Date;
}

export interface DataCollectionInfo {
  duration: number;
  sampleCount: number;
  sampleRate: number;
  metrics: string[];
}

export interface AnalysisMethodology {
  algorithms: string[];
  thresholds: PerformanceThresholds;
  statisticalMethods: string[];
  confidence: number;
}

export interface ActionPlan {
  immediate: ActionItem[];
  shortTerm: ActionItem[];
  longTerm: ActionItem[];
  monitoring: MonitoringPlan;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: string;
  timeline: string;
  owner: string;
  dependencies: string[];
  success: SuccessCriteria;
}

export interface SuccessCriteria {
  metrics: string[];
  targets: Record<string, number>;
  validation: string[];
}

export interface MonitoringPlan {
  frequency: string;
  metrics: string[];
  alerts: AlertConfiguration[];
  reporting: ReportingSchedule;
}

export interface AlertConfiguration {
  metric: string;
  threshold: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  action: string;
}

export interface ReportingSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  format: 'summary' | 'detailed' | 'executive';
  recipients: string[];
}

export interface ReportAppendices {
  rawData: PerformanceMetrics[];
  benchmarkData: BenchmarkResult[];
  statisticalAnalysis: StatisticalSummary;
  methodologyDetails: string;
}

export interface StatisticalSummary {
  sampleSize: number;
  confidence: number;
  margin: number;
  significance: number;
  correlations: CorrelationMatrix;
}

export interface CorrelationMatrix {
  [metric: string]: Record<string, number>;
}

export class PerformanceProfiler extends EventEmitter {
  private config: PerformanceProfileConfig;
  private startTime: Date;
  private endTime: Date;
  private metrics: PerformanceMetrics[] = [];
  private intervalId?: NodeJS.Timeout;

  constructor(config: PerformanceProfileConfig = {}) {
    super();
    this.config = {
      profileDuration: 60000,
      sampleInterval: 1000,
      includeMemoryProfile: true,
      includeCpuProfile: true,
      includeIOProfile: true,
      includeNetworkProfile: false,
      outputPath: './performance-reports',
      generateReport: true,
      optimization: {
        analyzeBundleSize: true,
        analyzeDependencies: true,
        analyzeStartupTime: true,
        analyzeMemoryUsage: true,
        analyzeBuildTime: true,
        generateRecommendations: true
      },
      thresholds: {
        cpuUsage: 80,
        memoryUsage: 500,
        startupTime: 2000,
        buildTime: 60000,
        bundleSize: 10,
        networkLatency: 1000
      },
      benchmarks: [],
      ...config
    };
    this.startTime = new Date();
    this.endTime = new Date();
  }

  async profile(projectPath: string): Promise<PerformanceProfile> {
    this.emit('profile:start', { project: projectPath });
    this.startTime = new Date();

    try {
      // Start metrics collection
      await this.startMetricsCollection();

      // Run benchmarks if configured
      const benchmarks = await this.runBenchmarks(projectPath);

      // Stop metrics collection
      this.stopMetricsCollection();
      this.endTime = new Date();

      // Analyze performance data
      const analysis = await this.analyzePerformance();

      // Generate optimization recommendations
      const optimizations = await this.generateOptimizations(projectPath);

      // Create performance summary
      const summary = this.generateSummary(analysis, optimizations);

      const profile: PerformanceProfile = {
        config: this.config,
        startTime: this.startTime,
        endTime: this.endTime,
        duration: this.endTime.getTime() - this.startTime.getTime(),
        metrics: this.metrics,
        benchmarks,
        analysis,
        optimizations,
        summary
      };

      this.emit('profile:complete', profile);
      return profile;

    } catch (error: any) {
      this.emit('profile:error', error);
      throw error;
    }
  }

  private async startMetricsCollection(): Promise<void> {
    this.emit('metrics:start');

    this.intervalId = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        this.emit('metrics:collected', metrics);
      } catch (error) {
        this.emit('metrics:error', error);
      }
    }, this.config.sampleInterval);

    // Stop collection after configured duration
    setTimeout(() => {
      this.stopMetricsCollection();
    }, this.config.profileDuration);
  }

  private stopMetricsCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.emit('metrics:stop');
  }

  private async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = new Date();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp,
      duration: timestamp.getTime() - this.startTime.getTime(),
      cpu: await this.collectCpuMetrics(cpuUsage),
      memory: this.collectMemoryMetrics(memUsage),
      io: await this.collectIOMetrics(),
      network: this.config.includeNetworkProfile ? await this.collectNetworkMetrics() : undefined,
      process: this.collectProcessMetrics(),
      system: this.collectSystemMetrics()
    };
  }

  private async collectCpuMetrics(cpuUsage: NodeJS.CpuUsage): Promise<CpuMetrics> {
    const loadAverage = os.loadavg();
    const cpus = os.cpus();

    return {
      usage: this.calculateCpuUsage(cpuUsage),
      userTime: cpuUsage.user / 1000,
      systemTime: cpuUsage.system / 1000,
      idleTime: 0, // Will be calculated based on sampling
      loadAverage,
      cores: cpus.length
    };
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simple CPU usage calculation
    const totalTime = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalTime / 1000000) * 100); // Convert to percentage
  }

  private collectMemoryMetrics(memUsage: NodeJS.MemoryUsage): MemoryMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
      used: totalMemory - freeMemory,
      total: totalMemory,
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        limit: this.getHeapLimit(),
        available: this.getHeapLimit() - memUsage.heapUsed
      },
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }

  private getHeapLimit(): number {
    // Get V8 heap size limit
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const v8 = require('v8');
      const heapStats = v8.getHeapStatistics();
      return heapStats.heap_size_limit;
    } catch {
      return 1024 * 1024 * 1024; // Default 1GB
    }
  }

  private async collectIOMetrics(): Promise<IOMetrics> {
    // Mock I/O metrics - in real implementation, this would use system calls
    return {
      read: {
        bytes: 0,
        operations: 0,
        time: 0,
        throughput: 0
      },
      write: {
        bytes: 0,
        operations: 0,
        time: 0,
        throughput: 0
      },
      total: {
        bytes: 0,
        operations: 0,
        time: 0,
        efficiency: 100
      }
    };
  }

  private async collectNetworkMetrics(): Promise<NetworkMetrics> {
    // Mock network metrics - in real implementation, this would monitor network activity
    return {
      requests: 0,
      totalBytes: 0,
      averageLatency: 0,
      errors: 0,
      connections: 0
    };
  }

  private collectProcessMetrics(): ProcessMetrics {
    return {
      pid: process.pid,
      ppid: process.ppid,
      startTime: new Date(Date.now() - process.uptime() * 1000),
      uptime: process.uptime() * 1000,
      threads: 1, // Node.js is single-threaded (main thread)
      handles: 0 // Platform specific
    };
  }

  private collectSystemMetrics(): SystemMetrics {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      v8Version: process.versions.v8,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  private async runBenchmarks(projectPath: string): Promise<BenchmarkResult[]> {
    this.emit('benchmarks:start');
    const results: BenchmarkResult[] = [];

    for (const benchmark of this.config.benchmarks || []) {
      try {
        const result = await this.runBenchmark(benchmark, projectPath);
        results.push(result);
        this.emit('benchmark:complete', result);
      } catch (error) {
        this.emit('benchmark:error', { benchmark, error });
      }
    }

    this.emit('benchmarks:complete', results);
    return results;
  }

  private async runBenchmark(config: BenchmarkConfig, projectPath: string): Promise<BenchmarkResult> {
    const iterations = config.iterations || 5;
    const warmupIterations = config.warmupIterations || 1;
    const results: BenchmarkIteration[] = [];

    // Warmup runs
    for (let i = 0; i < warmupIterations; i++) {
      await this.executeBenchmarkIteration(config, projectPath, i - warmupIterations);
    }

    // Actual benchmark runs
    for (let i = 0; i < iterations; i++) {
      const result = await this.executeBenchmarkIteration(config, projectPath, i);
      results.push(result);
    }

    const statistics = this.calculateBenchmarkStatistics(results);
    const baseline = await this.loadBenchmarkBaseline(config.name);
    const regression = baseline ? this.analyzeRegression(statistics, baseline) : undefined;

    return {
      name: config.name,
      command: config.command,
      iterations,
      results,
      statistics,
      baseline,
      regression
    };
  }

  private async executeBenchmarkIteration(
    config: BenchmarkConfig,
    projectPath: string,
    iteration: number
  ): Promise<BenchmarkIteration> {
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage();

    try {
      const result = execSync(config.command, {
        cwd: projectPath,
        timeout: config.timeout || 30000,
        env: { ...process.env, ...config.env },
        stdio: 'pipe'
      });

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();

      return {
        iteration,
        duration: endTime - startTime,
        exitCode: 0,
        memory: {
          timestamp: new Date(),
          heap: {
            used: memoryAfter.heapUsed,
            total: memoryAfter.heapTotal,
            limit: this.getHeapLimit(),
            available: this.getHeapLimit() - memoryAfter.heapUsed
          },
          rss: memoryAfter.rss,
          external: memoryAfter.external,
          total: memoryAfter.rss + memoryAfter.external
        },
        cpu: 0, // Would need process.cpuUsage() tracking
        success: true
      };

    } catch (error: any) {
      const endTime = Date.now();

      return {
        iteration,
        duration: endTime - startTime,
        exitCode: error.status || 1,
        memory: {
          timestamp: new Date(),
          heap: {
            used: memoryBefore.heapUsed,
            total: memoryBefore.heapTotal,
            limit: this.getHeapLimit(),
            available: this.getHeapLimit() - memoryBefore.heapUsed
          },
          rss: memoryBefore.rss,
          external: memoryBefore.external,
          total: memoryBefore.rss + memoryBefore.external
        },
        cpu: 0,
        success: false,
        error: error.message
      };
    }
  }

  private calculateBenchmarkStatistics(results: BenchmarkIteration[]): BenchmarkStatistics {
    const durations = results.map(r => r.duration);
    const successfulResults = results.filter(r => r.success);
    
    durations.sort((a, b) => a - b);

    const mean = durations.reduce((sum, val) => sum + val, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    const variance = durations.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    const percentiles: Record<number, number> = {};
    [50, 75, 90, 95, 99].forEach(p => {
      const index = Math.floor((p / 100) * durations.length);
      percentiles[p] = durations[Math.min(index, durations.length - 1)];
    });

    return {
      mean,
      median,
      min,
      max,
      stdDev,
      variance,
      percentiles,
      successRate: (successfulResults.length / results.length) * 100,
      throughput: successfulResults.length > 0 ? 1000 / mean : 0
    };
  }

  private async loadBenchmarkBaseline(benchmarkName: string): Promise<BenchmarkBaseline | undefined> {
    try {
      const baselinePath = path.join(this.config.outputPath || '', 'baselines', `${benchmarkName}.json`);
      if (await fs.pathExists(baselinePath)) {
        return await fs.readJson(baselinePath);
      }
    } catch (error) {
      // Baseline not found or corrupted
    }
    return undefined;
  }

  private analyzeRegression(statistics: BenchmarkStatistics, baseline: BenchmarkBaseline): RegressionAnalysis {
    const change = ((statistics.mean - baseline.mean) / baseline.mean) * 100;
    const significant = Math.abs(change) > 5; // 5% threshold for significance
    
    let trend: 'improving' | 'degrading' | 'stable';
    if (change > 5) {
      trend = 'degrading';
    } else if (change < -5) {
      trend = 'improving';
    } else {
      trend = 'stable';
    }

    return {
      significant,
      change,
      confidence: significant ? 95 : 50,
      trend,
      pValue: significant ? 0.01 : 0.5
    };
  }

  private async analyzePerformance(): Promise<PerformanceAnalysis> {
    this.emit('analysis:start');

    const bottlenecks = this.identifyBottlenecks();
    const patterns = this.identifyPatterns();
    const trends = this.analyzeTrends();
    const anomalies = this.detectAnomalies();
    const efficiency = this.calculateEfficiency();

    this.emit('analysis:complete');

    return {
      bottlenecks,
      patterns,
      trends,
      anomalies,
      efficiency
    };
  }

  private identifyBottlenecks(): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    if (this.metrics.length === 0) return bottlenecks;

    // Analyze CPU bottlenecks
    const avgCpuUsage = this.metrics.reduce((sum, m) => sum + m.cpu.usage, 0) / this.metrics.length;
    if (avgCpuUsage > this.config.thresholds!.cpuUsage) {
      bottlenecks.push({
        type: 'cpu',
        severity: avgCpuUsage > 95 ? 'critical' : avgCpuUsage > 85 ? 'high' : 'medium',
        description: `High CPU usage detected (${avgCpuUsage.toFixed(1)}%)`,
        impact: `System responsiveness may be affected`,
        metrics: { avgCpuUsage },
        recommendations: [
          'Optimize CPU-intensive operations',
          'Implement code profiling to identify hot spots',
          'Consider worker threads for heavy computations'
        ]
      });
    }

    // Analyze memory bottlenecks
    const avgMemoryUsage = this.metrics.reduce((sum, m) => sum + m.memory.used, 0) / this.metrics.length;
    const avgMemoryMB = avgMemoryUsage / (1024 * 1024);
    if (avgMemoryMB > this.config.thresholds!.memoryUsage) {
      bottlenecks.push({
        type: 'memory',
        severity: avgMemoryMB > 1000 ? 'critical' : avgMemoryMB > 750 ? 'high' : 'medium',
        description: `High memory usage detected (${avgMemoryMB.toFixed(1)}MB)`,
        impact: `Risk of out-of-memory errors and performance degradation`,
        metrics: { avgMemoryMB },
        recommendations: [
          'Implement memory profiling to identify leaks',
          'Optimize data structures and algorithms',
          'Use streaming for large data processing',
          'Implement garbage collection optimization'
        ]
      });
    }

    // Analyze heap bottlenecks
    const avgHeapUsage = this.metrics.reduce((sum, m) => sum + (m.memory.heap.used / m.memory.heap.total), 0) / this.metrics.length * 100;
    if (avgHeapUsage > 80) {
      bottlenecks.push({
        type: 'memory',
        severity: avgHeapUsage > 95 ? 'critical' : avgHeapUsage > 90 ? 'high' : 'medium',
        description: `High heap usage detected (${avgHeapUsage.toFixed(1)}%)`,
        impact: `Frequent garbage collection may impact performance`,
        metrics: { avgHeapUsage },
        recommendations: [
          'Reduce object allocations in hot paths',
          'Implement object pooling for frequently created objects',
          'Optimize data structures to reduce memory footprint'
        ]
      });
    }

    return bottlenecks;
  }

  private identifyPatterns(): PerformancePattern[] {
    // Pattern analysis would be more sophisticated in a real implementation
    const patterns: PerformancePattern[] = [];

    if (this.metrics.length < 10) return patterns;

    // Memory growth pattern
    const memoryGrowth = this.analyzeMemoryGrowth();
    if (memoryGrowth.significant) {
      patterns.push({
        name: 'Memory Growth',
        frequency: memoryGrowth.occurrences,
        impact: memoryGrowth.rate > 1 ? 'negative' : 'neutral',
        description: `Memory usage is ${memoryGrowth.rate > 0 ? 'increasing' : 'decreasing'} over time`,
        occurrences: [{
          timestamp: new Date(),
          duration: this.metrics.length * this.config.sampleInterval!,
          context: 'Overall profiling period',
          metrics: { growthRate: memoryGrowth.rate }
        }]
      });
    }

    return patterns;
  }

  private analyzeMemoryGrowth(): { significant: boolean; rate: number; occurrences: number } {
    if (this.metrics.length < 2) return { significant: false, rate: 0, occurrences: 0 };

    const firstMemory = this.metrics[0].memory.used;
    const lastMemory = this.metrics[this.metrics.length - 1].memory.used;
    const duration = this.metrics[this.metrics.length - 1].timestamp.getTime() - this.metrics[0].timestamp.getTime();
    
    const rate = ((lastMemory - firstMemory) / firstMemory) * 100;
    const significant = Math.abs(rate) > 10; // 10% change threshold

    return {
      significant,
      rate,
      occurrences: significant ? 1 : 0
    };
  }

  private analyzeTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    if (this.metrics.length < 5) return trends;

    // CPU trend
    const cpuTrend = this.calculateTrend(this.metrics.map(m => m.cpu.usage));
    trends.push({
      metric: 'CPU Usage',
      direction: cpuTrend.direction,
      rate: cpuTrend.rate,
      confidence: cpuTrend.confidence,
      significance: cpuTrend.significant
    });

    // Memory trend
    const memoryValues = this.metrics.map(m => m.memory.used / (1024 * 1024));
    const memoryTrend = this.calculateTrend(memoryValues);
    trends.push({
      metric: 'Memory Usage',
      direction: memoryTrend.direction,
      rate: memoryTrend.rate,
      confidence: memoryTrend.confidence,
      significance: memoryTrend.significant
    });

    return trends;
  }

  private calculateTrend(values: number[]): {
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number;
    confidence: number;
    significant: boolean;
  } {
    if (values.length < 3) {
      return { direction: 'stable', rate: 0, confidence: 0, significant: false };
    }

    // Simple linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.1) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    return {
      direction,
      rate: Math.abs(slope),
      confidence: Math.min(95, Math.abs(slope) * 100),
      significant: Math.abs(slope) > 0.5
    };
  }

  private detectAnomalies(): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];

    if (this.metrics.length < 10) return anomalies;

    // Detect CPU spikes
    const cpuValues = this.metrics.map(m => m.cpu.usage);
    const cpuMean = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
    const cpuStdDev = Math.sqrt(cpuValues.reduce((sum, val) => sum + Math.pow(val - cpuMean, 2), 0) / cpuValues.length);

    this.metrics.forEach((metric, index) => {
      const deviation = Math.abs(metric.cpu.usage - cpuMean) / cpuStdDev;
      if (deviation > 2) { // 2 standard deviations
        anomalies.push({
          timestamp: metric.timestamp,
          type: metric.cpu.usage > cpuMean ? 'spike' : 'drop',
          metric: 'CPU Usage',
          value: metric.cpu.usage,
          expectedValue: cpuMean,
          deviation,
          severity: deviation > 3 ? 'critical' : deviation > 2.5 ? 'high' : 'medium',
          description: `CPU usage ${metric.cpu.usage > cpuMean ? 'spike' : 'drop'} detected`,
          possibleCauses: [
            'Intensive computation',
            'Background process interference',
            'Resource contention',
            'System load'
          ]
        });
      }
    });

    return anomalies;
  }

  private calculateEfficiency(): EfficiencyMetrics {
    if (this.metrics.length === 0) {
      return {
        overall: 0,
        cpu: 0,
        memory: 0,
        io: 0,
        improvement: 0
      };
    }

    // Calculate CPU efficiency (lower usage for same output = higher efficiency)
    const avgCpuUsage = this.metrics.reduce((sum, m) => sum + m.cpu.usage, 0) / this.metrics.length;
    const cpuEfficiency = Math.max(0, 100 - avgCpuUsage);

    // Calculate memory efficiency (lower usage = higher efficiency)
    const avgMemoryUsage = this.metrics.reduce((sum, m) => sum + (m.memory.heap.used / m.memory.heap.total * 100), 0) / this.metrics.length;
    const memoryEfficiency = Math.max(0, 100 - avgMemoryUsage);

    // I/O efficiency (mock calculation)
    const ioEfficiency = 85; // Mock value

    const overall = (cpuEfficiency + memoryEfficiency + ioEfficiency) / 3;
    const improvement = Math.max(0, 100 - overall);

    return {
      overall,
      cpu: cpuEfficiency,
      memory: memoryEfficiency,
      io: ioEfficiency,
      improvement
    };
  }

  private async generateOptimizations(projectPath: string): Promise<OptimizationRecommendation[]> {
    this.emit('optimization:start');
    
    const optimizations: OptimizationRecommendation[] = [];

    if (this.config.optimization?.analyzeStartupTime) {
      optimizations.push(...await this.analyzeStartupOptimizations(projectPath));
    }

    if (this.config.optimization?.analyzeMemoryUsage) {
      optimizations.push(...await this.analyzeMemoryOptimizations());
    }

    if (this.config.optimization?.analyzeBundleSize) {
      optimizations.push(...await this.analyzeBundleOptimizations(projectPath));
    }

    if (this.config.optimization?.analyzeDependencies) {
      optimizations.push(...await this.analyzeDependencyOptimizations(projectPath));
    }

    if (this.config.optimization?.analyzeBuildTime) {
      optimizations.push(...await this.analyzeBuildOptimizations(projectPath));
    }

    this.emit('optimization:complete', optimizations);
    return optimizations;
  }

  private async analyzeStartupOptimizations(projectPath: string): Promise<OptimizationRecommendation[]> {
    const optimizations: OptimizationRecommendation[] = [];

    // Startup time optimization
    optimizations.push({
      id: 'startup-lazy-loading',
      type: 'startup',
      priority: 'high',
      title: 'Implement Lazy Loading for Heavy Dependencies',
      description: 'Defer loading of heavy dependencies until they are actually needed to improve startup time',
      impact: {
        performance: 30,
        memory: 20,
        size: 0,
        speed: 35
      },
      effort: 'medium',
      implementation: {
        steps: [
          'Identify heavy dependencies using bundle analysis',
          'Implement dynamic imports for non-critical modules',
          'Use lazy loading patterns for command-specific dependencies',
          'Add loading states for better user experience'
        ],
        code: `
// Before
import heavyLibrary from 'heavy-library';

// After
const loadHeavyLibrary = () => import('heavy-library');
`,
        automatizable: true,
        timeEstimate: '2-4 hours'
      },
      benefits: [
        'Faster startup time',
        'Reduced memory usage on startup',
        'Better user experience',
        'Lower resource consumption'
      ],
      risks: [
        'Slight delay when feature is first used',
        'Complexity in error handling',
        'Potential for loading state management issues'
      ],
      metrics: {
        before: { startupTime: 2000 },
        after: { startupTime: 1400 },
        improvement: { startupTime: 30 }
      }
    });

    // Code splitting optimization
    optimizations.push({
      id: 'startup-code-splitting',
      type: 'startup',
      priority: 'medium',
      title: 'Implement Command-Based Code Splitting',
      description: 'Split code by commands to load only necessary code for each operation',
      impact: {
        performance: 25,
        memory: 15,
        size: 10,
        speed: 30
      },
      effort: 'high',
      implementation: {
        steps: [
          'Analyze command usage patterns',
          'Split commands into separate modules',
          'Implement dynamic command loading',
          'Update CLI router to handle dynamic loading'
        ],
        config: {
          'webpack.config.js': {
            optimization: {
              splitChunks: {
                chunks: 'all',
                cacheGroups: {
                  commands: {
                    test: /src\/commands/,
                    name: 'commands',
                    chunks: 'all'
                  }
                }
              }
            }
          }
        },
        automatizable: false,
        timeEstimate: '1-2 days'
      },
      benefits: [
        'Faster startup for specific commands',
        'Reduced bundle size per command',
        'Better caching strategies',
        'Improved maintainability'
      ],
      risks: [
        'Increased complexity',
        'Potential for loading errors',
        'Build process complications'
      ],
      metrics: {
        before: { bundleSize: 10 },
        after: { bundleSize: 8 },
        improvement: { bundleSize: 20 }
      }
    });

    return optimizations;
  }

  private async analyzeMemoryOptimizations(): Promise<OptimizationRecommendation[]> {
    const optimizations: OptimizationRecommendation[] = [];

    if (this.metrics.length === 0) return optimizations;

    const avgHeapUsage = this.metrics.reduce((sum, m) => sum + (m.memory.heap.used / m.memory.heap.total), 0) / this.metrics.length;

    if (avgHeapUsage > 0.7) {
      optimizations.push({
        id: 'memory-object-pooling',
        type: 'memory',
        priority: 'high',
        title: 'Implement Object Pooling for Frequently Created Objects',
        description: 'Reduce garbage collection pressure by reusing objects instead of creating new ones',
        impact: {
          performance: 20,
          memory: 40,
          size: 0,
          speed: 15
        },
        effort: 'medium',
        implementation: {
          steps: [
            'Identify frequently allocated objects',
            'Create object pools for these objects',
            'Implement pool management (acquire/release)',
            'Monitor pool effectiveness'
          ],
          code: `
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  
  constructor(createFn: () => T, initialSize = 10) {
    this.createFn = createFn;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }
  
  acquire(): T {
    return this.pool.pop() || this.createFn();
  }
  
  release(obj: T): void {
    this.pool.push(obj);
  }
}
`,
          automatizable: false,
          timeEstimate: '4-6 hours'
        },
        benefits: [
          'Reduced garbage collection',
          'Lower memory allocation rate',
          'Improved performance consistency',
          'Better memory utilization'
        ],
        risks: [
          'Complexity in object lifecycle management',
          'Potential memory leaks if not handled properly',
          'Debugging complexity'
        ],
        metrics: {
          before: { heapUsage: avgHeapUsage * 100 },
          after: { heapUsage: (avgHeapUsage * 0.7) * 100 },
          improvement: { heapUsage: 30 }
        }
      });
    }

    return optimizations;
  }

  private async analyzeBundleOptimizations(projectPath: string): Promise<OptimizationRecommendation[]> {
    const optimizations: OptimizationRecommendation[] = [];

    try {
      // Check if there's a package.json to analyze
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        // Check for heavy dependencies
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const heavyDeps = Object.keys(deps).filter(dep => 
          ['webpack', 'typescript', 'eslint', 'babel'].some(heavy => dep.includes(heavy))
        );

        if (heavyDeps.length > 0) {
          optimizations.push({
            id: 'bundle-tree-shaking',
            type: 'bundle',
            priority: 'medium',
            title: 'Enable Tree Shaking for Unused Code Elimination',
            description: 'Remove unused code from dependencies to reduce bundle size',
            impact: {
              performance: 15,
              memory: 10,
              size: 30,
              speed: 20
            },
            effort: 'low',
            implementation: {
              steps: [
                'Enable ES modules in package.json',
                'Configure bundler for tree shaking',
                'Mark side-effect-free modules',
                'Analyze bundle to verify improvements'
              ],
              config: {
                'package.json': {
                  type: 'module',
                  sideEffects: false
                }
              },
              automatizable: true,
              timeEstimate: '1-2 hours'
            },
            benefits: [
              'Smaller bundle size',
              'Faster loading times',
              'Reduced memory usage',
              'Better performance'
            ],
            risks: [
              'Potential for breaking changes',
              'Build configuration complexity'
            ],
            metrics: {
              before: { bundleSize: 10 },
              after: { bundleSize: 7 },
              improvement: { bundleSize: 30 }
            }
          });
        }
      }
    } catch (error) {
      // Ignore errors in bundle analysis
    }

    return optimizations;
  }

  private async analyzeDependencyOptimizations(projectPath: string): Promise<OptimizationRecommendation[]> {
    const optimizations: OptimizationRecommendation[] = [];

    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = packageJson.dependencies || {};
        
        // Look for optimization opportunities
        if (Object.keys(deps).length > 20) {
          optimizations.push({
            id: 'dependency-audit',
            type: 'dependency',
            priority: 'medium',
            title: 'Audit and Optimize Dependencies',
            description: 'Review and optimize project dependencies to reduce bundle size and improve performance',
            impact: {
              performance: 25,
              memory: 20,
              size: 35,
              speed: 30
            },
            effort: 'medium',
            implementation: {
              steps: [
                'Run dependency analyzer to identify unused dependencies',
                'Remove unused dependencies',
                'Replace heavy dependencies with lighter alternatives',
                'Bundle analyze to verify improvements'
              ],
              dependencies: ['webpack-bundle-analyzer', 'depcheck'],
              automatizable: true,
              timeEstimate: '2-4 hours'
            },
            benefits: [
              'Reduced bundle size',
              'Faster installation',
              'Lower security attack surface',
              'Improved maintainability'
            ],
            risks: [
              'Potential for breaking changes',
              'Need for thorough testing'
            ],
            metrics: {
              before: { dependencies: Object.keys(deps).length },
              after: { dependencies: Math.floor(Object.keys(deps).length * 0.8) },
              improvement: { dependencies: 20 }
            }
          });
        }
      }
    } catch (error) {
      // Ignore errors in dependency analysis
    }

    return optimizations;
  }

  private async analyzeBuildOptimizations(projectPath: string): Promise<OptimizationRecommendation[]> {
    const optimizations: OptimizationRecommendation[] = [];

    // Build time optimization
    optimizations.push({
      id: 'build-incremental',
      type: 'build',
      priority: 'high',
      title: 'Implement Incremental Build System',
      description: 'Use incremental builds to only rebuild changed files and their dependencies',
      impact: {
        performance: 50,
        memory: 10,
        size: 0,
        speed: 60
      },
      effort: 'high',
      implementation: {
        steps: [
          'Set up build cache system',
          'Implement file change detection',
          'Configure incremental TypeScript compilation',
          'Add cache invalidation strategies'
        ],
        config: {
          'tsconfig.json': {
            compilerOptions: {
              incremental: true,
              tsBuildInfoFile: '.tsbuildinfo'
            }
          }
        },
        automatizable: true,
        timeEstimate: '4-8 hours'
      },
      benefits: [
        'Dramatically faster builds',
        'Improved developer experience',
        'Reduced CI/CD time',
        'Lower resource usage'
      ],
      risks: [
        'Cache invalidation complexity',
        'Initial setup complexity',
        'Storage requirements for cache'
      ],
      metrics: {
        before: { buildTime: 60000 },
        after: { buildTime: 15000 },
        improvement: { buildTime: 75 }
      }
    });

    return optimizations;
  }

  private generateSummary(analysis: PerformanceAnalysis, optimizations: OptimizationRecommendation[]): PerformanceSummary {
    const overallScore = this.calculateOverallScore(analysis);
    
    const categories = {
      cpu: this.calculateCategoryScore('cpu', analysis),
      memory: this.calculateCategoryScore('memory', analysis),
      io: this.calculateCategoryScore('io', analysis),
      startup: this.calculateCategoryScore('startup', analysis)
    };

    const improvements = this.generateImprovements(optimizations);
    const warnings = this.generateWarnings(analysis);
    const achievements = this.generateAchievements(analysis);

    return {
      overall: overallScore,
      categories,
      improvements,
      warnings,
      achievements
    };
  }

  private calculateOverallScore(analysis: PerformanceAnalysis): PerformanceScore {
    const score = analysis.efficiency.overall;
    
    return {
      score,
      grade: this.scoreToGrade(score),
      trend: 'stable', // Would be calculated from historical data
      change: 0 // Would be calculated from previous assessments
    };
  }

  private calculateCategoryScore(category: string, analysis: PerformanceAnalysis): PerformanceScore {
    let score = 100;
    
    // Reduce score based on bottlenecks in this category
    const categoryBottlenecks = analysis.bottlenecks.filter(b => 
      category === 'startup' ? b.type === 'startup' : b.type === category
    );
    
    for (const bottleneck of categoryBottlenecks) {
      switch (bottleneck.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }

    score = Math.max(0, score);

    return {
      score,
      grade: this.scoreToGrade(score),
      trend: 'stable',
      change: 0
    };
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateImprovements(optimizations: OptimizationRecommendation[]): SummaryImprovement[] {
    return optimizations.slice(0, 5).map(opt => ({
      area: opt.type,
      potential: opt.impact.performance,
      effort: opt.effort,
      impact: opt.priority === 'critical' || opt.priority === 'high' ? 'high' : 
              opt.priority === 'medium' ? 'medium' : 'low'
    }));
  }

  private generateWarnings(analysis: PerformanceAnalysis): SummaryWarning[] {
    const warnings: SummaryWarning[] = [];

    for (const bottleneck of analysis.bottlenecks) {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        warnings.push({
          severity: bottleneck.severity,
          message: bottleneck.description,
          metric: bottleneck.type,
          threshold: this.getThresholdForType(bottleneck.type),
          current: Object.values(bottleneck.metrics)[0] || 0
        });
      }
    }

    return warnings;
  }

  private getThresholdForType(type: string): number {
    switch (type) {
      case 'cpu': return this.config.thresholds!.cpuUsage;
      case 'memory': return this.config.thresholds!.memoryUsage;
      case 'startup': return this.config.thresholds!.startupTime;
      case 'build': return this.config.thresholds!.buildTime;
      default: return 100;
    }
  }

  private generateAchievements(analysis: PerformanceAnalysis): SummaryAchievement[] {
    const achievements: SummaryAchievement[] = [];

    if (analysis.efficiency.overall > 80) {
      achievements.push({
        title: 'High Efficiency',
        description: 'System is running with high efficiency',
        metric: 'Overall Efficiency',
        value: analysis.efficiency.overall
      });
    }

    if (analysis.anomalies.length === 0) {
      achievements.push({
        title: 'Stable Performance',
        description: 'No performance anomalies detected',
        metric: 'Anomalies',
        value: 0
      });
    }

    return achievements;
  }

  async generateReport(profile: PerformanceProfile): Promise<PerformanceReport> {
    const executive = this.generateExecutiveSummary(profile);
    const technical = this.generateTechnicalDetails(profile);
    const actionPlan = this.generateActionPlan(profile);
    const appendices = this.generateAppendices(profile);

    const report: PerformanceReport = {
      profile,
      executive,
      technical,
      actionPlan,
      appendices,
      timestamp: new Date()
    };

    if (this.config.generateReport) {
      await this.saveReport(report);
    }

    return report;
  }

  private generateExecutiveSummary(profile: PerformanceProfile): ExecutiveSummary {
    const criticalIssues = profile.analysis.bottlenecks.filter(b => b.severity === 'critical').length;
    
    return {
      overallScore: profile.summary.overall.score,
      keyFindings: [
        `Overall performance score: ${profile.summary.overall.score}/100`,
        `${profile.analysis.bottlenecks.length} performance bottlenecks identified`,
        `${profile.optimizations.length} optimization opportunities found`
      ],
      criticalIssues,
      potentialSavings: {
        timeReduction: profile.optimizations.reduce((sum, opt) => sum + (opt.impact.speed || 0), 0),
        memoryReduction: profile.optimizations.reduce((sum, opt) => sum + (opt.impact.memory || 0), 0),
        costSavings: 0, // Would be calculated based on resource costs
        efficiencyGain: profile.optimizations.reduce((sum, opt) => sum + (opt.impact.performance || 0), 0) / profile.optimizations.length
      },
      recommendations: profile.optimizations.slice(0, 3).map(opt => ({
        priority: opt.priority,
        category: opt.type,
        impact: `${opt.impact.performance}% performance improvement`,
        effort: opt.effort,
        timeline: opt.implementation.timeEstimate,
        roi: opt.impact.performance / (opt.effort === 'low' ? 1 : opt.effort === 'medium' ? 2 : 3)
      }))
    };
  }

  private generateTechnicalDetails(profile: PerformanceProfile): TechnicalDetails {
    return {
      methodology: 'Performance profiling using Node.js process metrics and custom benchmarking',
      environment: {
        platform: os.platform(),
        nodeVersion: process.version,
        cpuInfo: os.cpus(),
        memory: os.totalmem(),
        timestamp: profile.startTime
      },
      dataCollection: {
        duration: profile.duration,
        sampleCount: profile.metrics.length,
        sampleRate: this.config.sampleInterval || 1000,
        metrics: ['CPU', 'Memory', 'I/O', 'Process', 'System']
      },
      analysis: {
        algorithms: ['Linear regression', 'Statistical analysis', 'Anomaly detection'],
        thresholds: this.config.thresholds!,
        statisticalMethods: ['Standard deviation', 'Percentile analysis', 'Trend analysis'],
        confidence: 95
      },
      limitations: [
        'I/O metrics are simulated in this implementation',
        'Network metrics are optional and may not be available',
        'Historical trend analysis requires multiple profiling sessions'
      ]
    };
  }

  private generateActionPlan(profile: PerformanceProfile): ActionPlan {
    const critical = profile.optimizations.filter(opt => opt.priority === 'critical');
    const high = profile.optimizations.filter(opt => opt.priority === 'high');
    const medium = profile.optimizations.filter(opt => opt.priority === 'medium');

    return {
      immediate: critical.map(this.optimizationToActionItem),
      shortTerm: high.map(this.optimizationToActionItem),
      longTerm: medium.map(this.optimizationToActionItem),
      monitoring: {
        frequency: 'weekly',
        metrics: ['CPU usage', 'Memory usage', 'Startup time', 'Build time'],
        alerts: [
          {
            metric: 'CPU usage',
            threshold: this.config.thresholds!.cpuUsage,
            severity: 'high',
            action: 'Investigate high CPU usage'
          },
          {
            metric: 'Memory usage',
            threshold: this.config.thresholds!.memoryUsage,
            severity: 'high',
            action: 'Investigate memory leaks'
          }
        ],
        reporting: {
          frequency: 'weekly',
          format: 'summary',
          recipients: ['development-team']
        }
      }
    };
  }

  private optimizationToActionItem = (optimization: OptimizationRecommendation): ActionItem => ({
    id: optimization.id,
    title: optimization.title,
    description: optimization.description,
    priority: optimization.priority,
    effort: optimization.implementation.timeEstimate,
    timeline: optimization.implementation.timeEstimate,
    owner: 'development-team',
    dependencies: optimization.implementation.dependencies || [],
    success: {
      metrics: [optimization.type],
      targets: optimization.metrics.after,
      validation: optimization.implementation.steps
    }
  });

  private generateAppendices(profile: PerformanceProfile): ReportAppendices {
    return {
      rawData: profile.metrics,
      benchmarkData: profile.benchmarks,
      statisticalAnalysis: {
        sampleSize: profile.metrics.length,
        confidence: 95,
        margin: 5,
        significance: 0.05,
        correlations: {} // Would be calculated from actual data
      },
      methodologyDetails: 'Detailed methodology and analysis techniques used for performance profiling'
    };
  }

  private async saveReport(report: PerformanceReport): Promise<void> {
    await fs.ensureDir(this.config.outputPath!);

    // Save JSON report
    const jsonPath = path.join(this.config.outputPath!, 'performance-report.json');
    await fs.writeJson(jsonPath, report, { spaces: 2 });

    // Save HTML report
    const htmlPath = path.join(this.config.outputPath!, 'performance-report.html');
    const html = this.generateHtmlReport(report);
    await fs.writeFile(htmlPath, html);

    this.emit('report:saved', { json: jsonPath, html: htmlPath });
  }

  private generateHtmlReport(report: PerformanceReport): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Performance Profiling Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        .score { font-size: 2em; font-weight: bold; }
        .grade-A { color: #4CAF50; }
        .grade-B { color: #8BC34A; }
        .grade-C { color: #FFC107; }
        .grade-D { color: #FF9800; }
        .grade-F { color: #F44336; }
        .optimization { margin: 10px 0; padding: 15px; border-left: 4px solid #2196F3; background: #f8f9fa; }
        .critical { border-left-color: #F44336; }
        .high { border-left-color: #FF9800; }
        .medium { border-left-color: #FFC107; }
        .low { border-left-color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .chart { width: 100%; height: 200px; background: #f8f9fa; margin: 20px 0; display: flex; align-items: center; justify-content: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ Performance Profiling Report</h1>
        <p>Overall Score: <span class="score grade-${report.profile.summary.overall.grade}">${report.profile.summary.overall.score}/100 (${report.profile.summary.overall.grade})</span></p>
    </div>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metric">
            <strong>Critical Issues:</strong> ${report.executive.criticalIssues}
        </div>
        <div class="metric">
            <strong>Potential Time Savings:</strong> ${report.executive.potentialSavings.timeReduction.toFixed(0)}ms
        </div>
        <div class="metric">
            <strong>Potential Memory Savings:</strong> ${report.executive.potentialSavings.memoryReduction.toFixed(0)}MB
        </div>
        <div class="metric">
            <strong>Efficiency Gain:</strong> ${report.executive.potentialSavings.efficiencyGain.toFixed(1)}%
        </div>
    </div>

    <h2>Performance Categories</h2>
    <table>
        <tr>
            <th>Category</th>
            <th>Score</th>
            <th>Grade</th>
            <th>Trend</th>
        </tr>
        ${Object.entries(report.profile.summary.categories).map(([category, score]) => `
            <tr>
                <td>${category.toUpperCase()}</td>
                <td>${score.score}</td>
                <td><span class="grade-${score.grade}">${score.grade}</span></td>
                <td>${score.trend}</td>
            </tr>
        `).join('')}
    </table>

    <h2>Top Optimization Recommendations</h2>
    ${report.profile.optimizations.slice(0, 5).map(opt => `
        <div class="optimization ${opt.priority}">
            <h4>${opt.title} (${opt.priority} priority)</h4>
            <p>${opt.description}</p>
            <p><strong>Impact:</strong> ${opt.impact.performance}% performance improvement</p>
            <p><strong>Effort:</strong> ${opt.effort} | <strong>Timeline:</strong> ${opt.implementation.timeEstimate}</p>
            <p><strong>Benefits:</strong> ${opt.benefits.join(', ')}</p>
        </div>
    `).join('')}

    <h2>Performance Bottlenecks</h2>
    <table>
        <thead>
            <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Description</th>
                <th>Impact</th>
            </tr>
        </thead>
        <tbody>
            ${report.profile.analysis.bottlenecks.map(bottleneck => `
                <tr>
                    <td>${bottleneck.type.toUpperCase()}</td>
                    <td><span class="${bottleneck.severity}">${bottleneck.severity.toUpperCase()}</span></td>
                    <td>${bottleneck.description}</td>
                    <td>${bottleneck.impact}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Metrics Timeline</h2>
    <div class="chart">
        Performance metrics visualization would be rendered here with a charting library
    </div>

    <h2>Immediate Action Items</h2>
    <ul>
        ${report.actionPlan.immediate.map(item => `
            <li><strong>${item.title}</strong> - ${item.description} (${item.timeline})</li>
        `).join('')}
    </ul>

    <footer>
        <p>Generated on ${report.timestamp.toISOString()}</p>
        <p>Profiling session: ${report.profile.startTime.toISOString()} to ${report.profile.endTime.toISOString()}</p>
        <p>Duration: ${(report.profile.duration / 1000).toFixed(1)} seconds</p>
    </footer>
</body>
</html>`;
  }
}

// Export utility functions
export async function profilePerformance(
  projectPath: string,
  config?: Partial<PerformanceProfileConfig>
): Promise<PerformanceReport> {
  const profiler = new PerformanceProfiler(config);
  const profile = await profiler.profile(projectPath);
  return profiler.generateReport(profile);
}

export function createBenchmark(
  name: string,
  command: string,
  options?: Partial<BenchmarkConfig>
): BenchmarkConfig {
  return {
    name,
    command,
    iterations: 5,
    warmupIterations: 1,
    timeout: 30000,
    ...options
  };
}