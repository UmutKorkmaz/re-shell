/**
 * Performance profiler for CLI startup and command execution
 */
import { performance } from 'perf_hooks';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface PerformanceMark {
  name: string;
  timestamp: number;
  duration?: number;
  memory?: NodeJS.MemoryUsage;
}

interface PerformanceReport {
  startTime: number;
  endTime: number;
  totalDuration: number;
  marks: PerformanceMark[];
  command: string;
  version: string;
  platform: string;
  nodeVersion: string;
}

export class PerformanceProfiler {
  private static instance: PerformanceProfiler;
  private marks: Map<string, PerformanceMark> = new Map();
  private startTime = 0;
  private enabled = false;
  private reportPath: string;

  private constructor() {
    const cacheDir = join(homedir(), '.re-shell', 'performance');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    this.reportPath = join(cacheDir, 'performance.json');
    
    // Enable profiling based on environment variable
    this.enabled = process.env.RESHELL_PROFILE === 'true' || process.env.DEBUG === 'true';
  }

  static getInstance(): PerformanceProfiler {
    if (!PerformanceProfiler.instance) {
      PerformanceProfiler.instance = new PerformanceProfiler();
    }
    return PerformanceProfiler.instance;
  }

  /**
   * Start profiling
   */
  start(command = 'unknown'): void {
    if (!this.enabled) return;
    
    this.startTime = performance.now();
    this.marks.clear();
    
    this.mark('startup', {
      command,
      argv: process.argv.slice(2).join(' ')
    });
  }

  /**
   * Mark a performance checkpoint
   */
  mark(name: string, metadata?: any): void {
    if (!this.enabled) return;
    
    const timestamp = performance.now();
    const memory = process.memoryUsage();
    
    this.marks.set(name, {
      name,
      timestamp,
      memory,
      ...(metadata && { metadata })
    });
  }

  /**
   * Measure duration between two marks
   */
  measure(name: string, startMark: string, endMark?: string): void {
    if (!this.enabled) return;
    
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : { timestamp: performance.now() };
    
    if (start && end) {
      const duration = end.timestamp - start.timestamp;
      this.marks.set(name, {
        name,
        timestamp: end.timestamp,
        duration
      });
    }
  }

  /**
   * End profiling and generate report
   */
  end(): PerformanceReport | null {
    if (!this.enabled) return null;
    
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;
    
    const report: PerformanceReport = {
      startTime: this.startTime,
      endTime,
      totalDuration,
      marks: Array.from(this.marks.values()),
      command: process.argv.slice(2).join(' ') || 'none',
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      version: require('../../package.json').version,
      platform: process.platform,
      nodeVersion: process.version
    };
    
    // Save report
    this.saveReport(report);
    
    if (process.env.DEBUG === 'true') {
      this.printReport(report);
    }
    
    return report;
  }

  /**
   * Save performance report
   */
  private saveReport(report: PerformanceReport): void {
    try {
      let reports: PerformanceReport[] = [];
      
      if (existsSync(this.reportPath)) {
        const existing = readFileSync(this.reportPath, 'utf-8');
        reports = JSON.parse(existing);
      }
      
      // Keep only last 100 reports
      reports.push(report);
      if (reports.length > 100) {
        reports = reports.slice(-100);
      }
      
      writeFileSync(this.reportPath, JSON.stringify(reports, null, 2));
    } catch (error) {
      // Ignore save errors
    }
  }

  /**
   * Print performance report to console
   */
  private printReport(report: PerformanceReport): void {
    console.log('\n=== Performance Report ===');
    console.log(`Total Duration: ${report.totalDuration.toFixed(2)}ms`);
    console.log(`Command: ${report.command}`);
    console.log(`Platform: ${report.platform} (Node ${report.nodeVersion})`);
    console.log('\nTimings:');
    
    const sortedMarks = report.marks.sort((a, b) => a.timestamp - b.timestamp);
    let lastTime = 0;
    
    for (const mark of sortedMarks) {
      const delta = mark.timestamp - lastTime;
      const fromStart = mark.timestamp - report.startTime;
      
      console.log(
        `  ${mark.name.padEnd(30)} +${delta.toFixed(2).padStart(8)}ms  (${fromStart.toFixed(2).padStart(8)}ms from start)`
      );
      
      if (mark.duration) {
        console.log(`    └─ Duration: ${mark.duration.toFixed(2)}ms`);
      }
      
      if (mark.memory) {
        const heapMB = (mark.memory.heapUsed / 1024 / 1024).toFixed(2);
        console.log(`    └─ Memory: ${heapMB}MB`);
      }
      
      lastTime = mark.timestamp;
    }
    
    console.log('========================\n');
  }

  /**
   * Get average startup time from recent reports
   */
  getAverageStartupTime(): number | null {
    if (!existsSync(this.reportPath)) {
      return null;
    }
    
    try {
      const reports: PerformanceReport[] = JSON.parse(
        readFileSync(this.reportPath, 'utf-8')
      );
      
      if (reports.length === 0) return null;
      
      const recentReports = reports.slice(-10);
      const avgTime = recentReports.reduce((sum, r) => sum + r.totalDuration, 0) / recentReports.length;
      
      return avgTime;
    } catch {
      return null;
    }
  }

  /**
   * Analyze performance bottlenecks
   */
  analyzeBottlenecks(): { phase: string; duration: number; percentage: number }[] {
    const marks = Array.from(this.marks.values()).sort((a, b) => a.timestamp - b.timestamp);
    const bottlenecks: { phase: string; duration: number; percentage: number }[] = [];
    
    for (let i = 0; i < marks.length - 1; i++) {
      const current = marks[i];
      const next = marks[i + 1];
      const duration = next.timestamp - current.timestamp;
      const percentage = (duration / (performance.now() - this.startTime)) * 100;
      
      if (duration > 10) { // Only report phases taking more than 10ms
        bottlenecks.push({
          phase: `${current.name} → ${next.name}`,
          duration,
          percentage
        });
      }
    }
    
    return bottlenecks.sort((a, b) => b.duration - a.duration);
  }
}

// Export singleton instance
export const profiler = PerformanceProfiler.getInstance();