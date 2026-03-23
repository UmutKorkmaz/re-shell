import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as https from 'https';
import { execSync } from 'child_process';

export interface CrashReport {
  id: string;
  timestamp: Date;
  type: CrashType;
  severity: CrashSeverity;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    signal?: string;
  };
  context: CrashContext;
  systemInfo: SystemInfo;
  diagnostics: DiagnosticInfo;
  fingerprint: string;
  recovered: boolean;
  reportedToRemote: boolean;
}

export enum CrashType {
  UNCAUGHT_EXCEPTION = 'uncaught_exception',
  UNHANDLED_REJECTION = 'unhandled_rejection',
  ASSERTION_ERROR = 'assertion_error',
  MEMORY_ERROR = 'memory_error',
  TIMEOUT_ERROR = 'timeout_error',
  FILE_SYSTEM_ERROR = 'file_system_error',
  NETWORK_ERROR = 'network_error',
  DEPENDENCY_ERROR = 'dependency_error',
  CONFIGURATION_ERROR = 'configuration_error',
  PERMISSION_ERROR = 'permission_error',
  OPERATION_FAILURE = 'operation_failure',
  PLUGIN_ERROR = 'plugin_error',
  BUILD_ERROR = 'build_error',
  CUSTOM = 'custom'
}

export enum CrashSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CrashContext {
  command: string;
  args: string[];
  workingDirectory: string;
  operationId?: string;
  userId?: string;
  sessionId: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  environmentVariables: Record<string, string>;
  recentLogs: string[];
  activeOperations: string[];
  pluginsLoaded: string[];
  configurationState: any;
  lastUserAction?: {
    action: string;
    timestamp: Date;
    data?: any;
  };
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  cliVersion: string;
  homeDirectory: string;
  totalMemory: number;
  freeMemory: number;
  cpuModel: string;
  cpuCores: number;
  loadAverage: number[];
  uptime: number;
  diskSpace?: {
    total: number;
    free: number;
    used: number;
  };
}

export interface DiagnosticInfo {
  healthChecks: Array<{
    name: string;
    status: string;
    message: string;
  }>;
  networkConnectivity: boolean;
  fileSystemPermissions: boolean;
  dependencyVersions: Record<string, string>;
  configurationValid: boolean;
  recentErrors: Array<{
    timestamp: Date;
    error: string;
    context?: string;
  }>;
  performanceMetrics: {
    averageResponseTime: number;
    memoryTrend: 'stable' | 'increasing' | 'decreasing';
    cpuUsage: number;
  };
}

export interface IssuePattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | ((error: Error, context: CrashContext) => boolean);
  severity: CrashSeverity;
  category: string;
  knownCauses: string[];
  suggestedFixes: string[];
  documentationLink?: string;
  autoRecovery?: () => Promise<boolean>;
}

export interface CrashAnalysis {
  reportId: string;
  matchedPatterns: Array<{
    pattern: IssuePattern;
    confidence: number;
    extractedData?: any;
  }>;
  rootCause?: string;
  recommendations: string[];
  quickFixes: Array<{
    description: string;
    action: () => Promise<boolean>;
    safe: boolean;
  }>;
  similarIssues: string[];
  severity: CrashSeverity;
  recoverable: boolean;
}

export interface CrashReporterOptions {
  enableRemoteReporting: boolean;
  remoteEndpoint?: string;
  apiKey?: string;
  enableLocalStorage: boolean;
  maxReportsStored: number;
  enableAutoRecovery: boolean;
  enableUserNotification: boolean;
  anonymizeData: boolean;
  reportingLevel: CrashSeverity;
  retryAttempts: number;
}

export class CrashReporter extends EventEmitter {
  private sessionId: string;
  private startTime: Date;
  private crashReportsPath: string;
  private issuePatterns: Map<string, IssuePattern> = new Map();
  private recentLogs: string[] = [];
  private recentErrors: Array<{ timestamp: Date; error: string; context?: string }> = [];
  private hookInstalled = false;

  private defaultOptions: CrashReporterOptions = {
    enableRemoteReporting: false,
    enableLocalStorage: true,
    maxReportsStored: 100,
    enableAutoRecovery: true,
    enableUserNotification: true,
    anonymizeData: true,
    reportingLevel: CrashSeverity.MEDIUM,
    retryAttempts: 3
  };

  constructor(
    private workspaceRoot: string,
    private options: Partial<CrashReporterOptions> = {}
  ) {
    super();
    
    this.sessionId = this.generateSessionId();
    this.startTime = new Date();
    this.crashReportsPath = path.join(workspaceRoot, '.re-shell', 'crash-reports');
    this.options = { ...this.defaultOptions, ...options };
    
    this.ensureReportsDirectory();
    this.loadKnownIssuePatterns();
    this.installGlobalHooks();
  }

  private ensureReportsDirectory(): void {
    try {
      fs.ensureDirSync(this.crashReportsPath);
    } catch (error) {
      console.warn('Failed to create crash reports directory:', error);
    }
  }

  private loadKnownIssuePatterns(): void {
    // Memory issues
    this.registerIssuePattern({
      id: 'memory_heap_out_of_memory',
      name: 'Memory Heap Exceeded',
      description: 'JavaScript heap out of memory error',
      pattern: /JavaScript heap out of memory/i,
      severity: CrashSeverity.HIGH,
      category: 'Memory',
      knownCauses: [
        'Large file processing',
        'Memory leaks in plugins',
        'Insufficient Node.js heap size',
        'Processing too many files simultaneously'
      ],
      suggestedFixes: [
        'Increase Node.js heap size with --max-old-space-size',
        'Process files in smaller batches',
        'Check for memory leaks in custom plugins',
        'Use streaming for large file operations'
      ],
      documentationLink: 'https://nodejs.org/api/cli.html#cli_max_old_space_size_size_in_megabytes'
    });

    // Permission issues
    this.registerIssuePattern({
      id: 'permission_denied_eacces',
      name: 'Permission Denied',
      description: 'File system permission error',
      pattern: /EACCES|permission denied/i,
      severity: CrashSeverity.MEDIUM,
      category: 'Permissions',
      knownCauses: [
        'Insufficient file system permissions',
        'Files owned by different user',
        'Read-only file system',
        'Protected system directories'
      ],
      suggestedFixes: [
        'Run with appropriate user permissions',
        'Change file ownership: sudo chown -R $USER:$USER .',
        'Check directory permissions',
        'Use sudo if accessing system directories'
      ]
    });

    // Network issues
    this.registerIssuePattern({
      id: 'network_connection_refused',
      name: 'Network Connection Refused',
      description: 'Unable to connect to remote service',
      pattern: /ECONNREFUSED|connection refused/i,
      severity: CrashSeverity.MEDIUM,
      category: 'Network',
      knownCauses: [
        'Service is not running',
        'Incorrect port or URL',
        'Firewall blocking connection',
        'Network connectivity issues'
      ],
      suggestedFixes: [
        'Verify service is running and accessible',
        'Check network connectivity',
        'Verify firewall settings',
        'Check proxy configuration'
      ]
    });

    // Dependency issues
    this.registerIssuePattern({
      id: 'module_not_found',
      name: 'Module Not Found',
      description: 'Required module cannot be found',
      pattern: /Cannot find module|Module not found/i,
      severity: CrashSeverity.HIGH,
      category: 'Dependencies',
      knownCauses: [
        'Missing dependencies',
        'Corrupted node_modules',
        'Version incompatibility',
        'Path resolution issues'
      ],
      suggestedFixes: [
        'Run npm install or yarn install',
        'Delete node_modules and reinstall',
        'Check package.json for correct dependencies',
        'Clear package manager cache'
      ],
      autoRecovery: async () => {
        try {

          execSync('npm install', { stdio: 'inherit' });
          return true;
        } catch {
          return false;
        }
      }
    });

    // Configuration issues
    this.registerIssuePattern({
      id: 'invalid_configuration',
      name: 'Invalid Configuration',
      description: 'Configuration file is invalid or corrupted',
      pattern: (error: Error, context: CrashContext) => {
        return error.message.includes('configuration') && 
               (error.message.includes('invalid') || error.message.includes('parse'));
      },
      severity: CrashSeverity.MEDIUM,
      category: 'Configuration',
      knownCauses: [
        'Syntax error in config file',
        'Invalid configuration values',
        'Missing required configuration',
        'Corrupted configuration file'
      ],
      suggestedFixes: [
        'Validate configuration syntax',
        'Reset to default configuration',
        'Check for required fields',
        'Restore from backup'
      ]
    });

    // File system issues
    this.registerIssuePattern({
      id: 'file_system_full',
      name: 'File System Full',
      description: 'No space left on device',
      pattern: /ENOSPC|no space left on device/i,
      severity: CrashSeverity.CRITICAL,
      category: 'FileSystem',
      knownCauses: [
        'Disk space exhausted',
        'Inode exhaustion',
        'Temporary files accumulation',
        'Large log files'
      ],
      suggestedFixes: [
        'Free up disk space',
        'Clean temporary files',
        'Remove old log files',
        'Move files to different location'
      ]
    });

    // Plugin issues
    this.registerIssuePattern({
      id: 'plugin_error',
      name: 'Plugin Error',
      description: 'Error in plugin execution',
      pattern: (error: Error, context: CrashContext) => {
        return context.pluginsLoaded.length > 0 && 
               (error.stack?.includes('plugin') || error.message.includes('plugin'));
      },
      severity: CrashSeverity.MEDIUM,
      category: 'Plugins',
      knownCauses: [
        'Plugin compatibility issues',
        'Plugin dependency conflicts',
        'Malformed plugin code',
        'Plugin API misuse'
      ],
      suggestedFixes: [
        'Update plugins to latest versions',
        'Disable problematic plugins',
        'Check plugin compatibility',
        'Report issue to plugin author'
      ]
    });
  }

  private installGlobalHooks(): void {
    if (this.hookInstalled) return;

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.reportCrash(CrashType.UNCAUGHT_EXCEPTION, error, CrashSeverity.CRITICAL);
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.reportCrash(CrashType.UNHANDLED_REJECTION, error, CrashSeverity.HIGH);
    });

    // Exit events
    process.on('exit', () => {
      this.handleGracefulShutdown();
    });

    process.on('SIGINT', () => {
      this.handleGracefulShutdown();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.handleGracefulShutdown();
      process.exit(0);
    });

    this.hookInstalled = true;
  }

  registerIssuePattern(pattern: IssuePattern): void {
    this.issuePatterns.set(pattern.id, pattern);
    this.emit('pattern:registered', pattern);
  }

  async reportCrash(
    type: CrashType,
    error: Error,
    severity: CrashSeverity = CrashSeverity.MEDIUM,
    context?: Partial<CrashContext>
  ): Promise<string> {
    const reportId = this.generateReportId();
    
    try {
      const crashReport: CrashReport = {
        id: reportId,
        timestamp: new Date(),
        type,
        severity,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
          signal: (error as any).signal
        },
        context: await this.gatherContext(context),
        systemInfo: await this.gatherSystemInfo(),
        diagnostics: await this.gatherDiagnostics(),
        fingerprint: this.generateFingerprint(error),
        recovered: false,
        reportedToRemote: false
      };

      // Store locally if enabled
      if (this.options.enableLocalStorage) {
        await this.storeReportLocally(crashReport);
      }

      // Analyze the crash
      const analysis = await this.analyzeCrash(crashReport);
      
      // Attempt auto-recovery if enabled
      if (this.options.enableAutoRecovery && analysis.recoverable) {
        const recovered = await this.attemptAutoRecovery(analysis);
        crashReport.recovered = recovered;
        
        if (recovered) {
          this.emit('crash:recovered', { report: crashReport, analysis });
        }
      }

      // Send to remote if enabled and severity is high enough
      if (this.options.enableRemoteReporting && 
          this.shouldReportRemotely(severity)) {
        await this.sendToRemote(crashReport);
      }

      // Notify user if enabled
      if (this.options.enableUserNotification) {
        this.notifyUser(crashReport, analysis);
      }

      this.emit('crash:reported', { report: crashReport, analysis });
      return reportId;

    } catch (reportingError) {
      console.error('Failed to report crash:', reportingError);
      this.emit('crash:reporting_failed', { error: reportingError, originalError: error });
      return reportId;
    }
  }

  private async gatherContext(partial?: Partial<CrashContext>): Promise<CrashContext> {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime.getTime();

    // Filter environment variables for privacy
    const env = this.options.anonymizeData 
      ? this.anonymizeEnvironment(process.env)
      : { ...process.env };

    return {
      command: process.argv[2] || 'unknown',
      args: process.argv.slice(3),
      workingDirectory: process.cwd(),
      sessionId: this.sessionId,
      uptime,
      memoryUsage,
      environmentVariables: env,
      recentLogs: [...this.recentLogs],
      activeOperations: [], // TODO: Get from operation manager
      pluginsLoaded: [], // TODO: Get from plugin manager
      configurationState: {}, // TODO: Get from config manager
      ...partial
    };
  }

  private async gatherSystemInfo(): Promise<SystemInfo> {
    const cpus = os.cpus();
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cliVersion: await this.getCliVersion(),
      homeDirectory: this.options.anonymizeData ? '<anonymized>' : os.homedir(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuModel: cpus[0]?.model || 'Unknown',
      cpuCores: cpus.length,
      loadAverage: os.loadavg(),
      uptime: os.uptime(),
      diskSpace: await this.getDiskSpace()
    };
  }

  private async gatherDiagnostics(): Promise<DiagnosticInfo> {
    return {
      healthChecks: [], // TODO: Get from health diagnostics
      networkConnectivity: await this.testNetworkConnectivity(),
      fileSystemPermissions: await this.testFileSystemPermissions(),
      dependencyVersions: await this.getDependencyVersions(),
      configurationValid: await this.validateConfiguration(),
      recentErrors: [...this.recentErrors],
      performanceMetrics: {
        averageResponseTime: 0, // TODO: Calculate from metrics
        memoryTrend: 'stable', // TODO: Analyze memory usage trend
        cpuUsage: 0 // TODO: Get current CPU usage
      }
    };
  }

  private async analyzeCrash(report: CrashReport): Promise<CrashAnalysis> {
    const matchedPatterns: CrashAnalysis['matchedPatterns'] = [];
    
    // Match against known patterns
    for (const pattern of this.issuePatterns.values()) {
      let matches = false;
      let confidence = 0;

      if (pattern.pattern instanceof RegExp) {
        if (pattern.pattern.test(report.error.message) || 
            (report.error.stack && pattern.pattern.test(report.error.stack))) {
          matches = true;
          confidence = 0.8;
        }
      } else if (typeof pattern.pattern === 'function') {
        matches = pattern.pattern(new Error(report.error.message), report.context);
        confidence = matches ? 0.7 : 0;
      }

      if (matches) {
        matchedPatterns.push({
          pattern,
          confidence,
          extractedData: this.extractPatternData(pattern, report)
        });
      }
    }

    // Sort by confidence
    matchedPatterns.sort((a, b) => b.confidence - a.confidence);

    // Determine root cause and recommendations
    const bestMatch = matchedPatterns[0];
    const rootCause = bestMatch ? bestMatch.pattern.description : 'Unknown error';
    
    const recommendations: string[] = [];
    const quickFixes: CrashAnalysis['quickFixes'] = [];

    if (bestMatch) {
      recommendations.push(...bestMatch.pattern.suggestedFixes);
      
      if (bestMatch.pattern.autoRecovery) {
        quickFixes.push({
          description: `Auto-fix for ${bestMatch.pattern.name}`,
          action: bestMatch.pattern.autoRecovery,
          safe: true
        });
      }
    }

    // Find similar issues
    const similarIssues = await this.findSimilarIssues(report);

    return {
      reportId: report.id,
      matchedPatterns,
      rootCause,
      recommendations,
      quickFixes,
      similarIssues,
      severity: bestMatch ? bestMatch.pattern.severity : report.severity,
      recoverable: quickFixes.length > 0 || this.isRecoverableError(report)
    };
  }

  private extractPatternData(pattern: IssuePattern, report: CrashReport): any {
    // Extract relevant data based on pattern type
    switch (pattern.category) {
      case 'Memory':
        return {
          memoryUsage: report.context.memoryUsage,
          totalMemory: report.systemInfo.totalMemory,
          freeMemory: report.systemInfo.freeMemory
        };
      
      case 'Dependencies':
        return {
          dependencies: report.diagnostics.dependencyVersions,
          nodeVersion: report.systemInfo.nodeVersion
        };
      
      default:
        return null;
    }
  }

  private async attemptAutoRecovery(analysis: CrashAnalysis): Promise<boolean> {
    for (const quickFix of analysis.quickFixes) {
      if (quickFix.safe) {
        try {
          this.emit('recovery:attempt', quickFix);
          const success = await quickFix.action();
          
          if (success) {
            this.emit('recovery:success', quickFix);
            return true;
          }
        } catch (error) {
          this.emit('recovery:failed', { quickFix, error });
        }
      }
    }

    return false;
  }

  private isRecoverableError(report: CrashReport): boolean {
    // Check if error type is generally recoverable
    const recoverableTypes = [
      CrashType.NETWORK_ERROR,
      CrashType.DEPENDENCY_ERROR,
      CrashType.CONFIGURATION_ERROR,
      CrashType.TIMEOUT_ERROR
    ];

    return recoverableTypes.includes(report.type);
  }

  private async findSimilarIssues(report: CrashReport): Promise<string[]> {
    try {
      const reportFiles = await fs.readdir(this.crashReportsPath);
      const similarReports: string[] = [];

      for (const file of reportFiles.slice(0, 50)) { // Limit search
        if (file.endsWith('.json') && !file.includes(report.id)) {
          try {
            const otherReport = await fs.readJson(path.join(this.crashReportsPath, file));
            
            if (this.isSimilarError(report, otherReport)) {
              similarReports.push(otherReport.id);
            }
          } catch {
            // Skip corrupted reports
          }
        }
      }

      return similarReports.slice(0, 5); // Return top 5 similar issues
    } catch {
      return [];
    }
  }

  private isSimilarError(report1: CrashReport, report2: CrashReport): boolean {
    // Check if fingerprints match (exact same error)
    if (report1.fingerprint === report2.fingerprint) {
      return true;
    }

    // Check if error names and types match
    if (report1.error.name === report2.error.name && report1.type === report2.type) {
      return true;
    }

    // Check if error messages are similar (basic similarity)
    const similarity = this.calculateStringSimilarity(report1.error.message, report2.error.message);
    return similarity > 0.7;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  private async storeReportLocally(report: CrashReport): Promise<void> {
    try {
      const reportPath = path.join(this.crashReportsPath, `${report.id}.json`);
      await fs.writeJson(reportPath, report, { spaces: 2 });
      
      // Cleanup old reports if limit exceeded
      await this.cleanupOldReports();
    } catch (error) {
      console.warn('Failed to store crash report locally:', error);
    }
  }

  private async cleanupOldReports(): Promise<void> {
    try {
      const reportFiles = await fs.readdir(this.crashReportsPath);
      const jsonFiles = reportFiles.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length > this.options.maxReportsStored!) {
        // Sort by modification time and remove oldest
        const fileStats = await Promise.all(
          jsonFiles.map(async (file) => ({
            file,
            stats: await fs.stat(path.join(this.crashReportsPath, file))
          }))
        );
        
        fileStats.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());
        
        const toDelete = fileStats.slice(0, jsonFiles.length - this.options.maxReportsStored!);
        
        for (const { file } of toDelete) {
          await fs.unlink(path.join(this.crashReportsPath, file));
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old crash reports:', error);
    }
  }

  private shouldReportRemotely(severity: CrashSeverity): boolean {
    const severityOrder = [CrashSeverity.LOW, CrashSeverity.MEDIUM, CrashSeverity.HIGH, CrashSeverity.CRITICAL];
    const currentIndex = severityOrder.indexOf(severity);
    const thresholdIndex = severityOrder.indexOf(this.options.reportingLevel!);
    
    return currentIndex >= thresholdIndex;
  }

  private async sendToRemote(report: CrashReport): Promise<void> {
    if (!this.options.remoteEndpoint) return;

    try {
      const anonymizedReport = this.options.anonymizeData ? this.anonymizeReport(report) : report;
      
      const response = await fetch(this.options.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.options.apiKey && { 'Authorization': `Bearer ${this.options.apiKey}` })
        },
        body: JSON.stringify(anonymizedReport)
      });

      if (response.ok) {
        report.reportedToRemote = true;
        this.emit('crash:reported_remote', report);
      } else {
        throw new Error(`Remote reporting failed: ${response.status}`);
      }
    } catch (error) {
      this.emit('crash:remote_failed', { report, error });
    }
  }

  private anonymizeReport(report: CrashReport): CrashReport {
    const anonymized = { ...report };
    
    // Anonymize paths
    anonymized.context.workingDirectory = this.anonymizePath(report.context.workingDirectory);
    anonymized.systemInfo.homeDirectory = '<anonymized>';
    
    // Remove potentially sensitive environment variables
    anonymized.context.environmentVariables = this.anonymizeEnvironment(report.context.environmentVariables);
    
    // Anonymize error stack traces
    if (anonymized.error.stack) {
      anonymized.error.stack = this.anonymizeStackTrace(anonymized.error.stack);
    }
    
    return anonymized;
  }

  private anonymizePath(filePath: string): string {
    const homeDir = os.homedir();
    return filePath.replace(homeDir, '~').replace(/\/Users\/[^/]+/, '/Users/<user>');
  }

  private anonymizeEnvironment(env: Record<string, string>): Record<string, string> {
    const sensitiveKeys = ['PATH', 'HOME', 'USER', 'USERNAME', 'USERPROFILE'];
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(env)) {
      if (sensitiveKeys.some(k => key.includes(k))) {
        result[key] = '<anonymized>';
      } else if (key.startsWith('RE_SHELL_')) {
        result[key] = value; // Keep Re-Shell specific vars
      }
    }
    
    return result;
  }

  private anonymizeStackTrace(stack: string): string {
    const homeDir = os.homedir();
    return stack
      .replace(new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~')
      .replace(/\/Users\/[^/]+/g, '/Users/<user>');
  }

  private notifyUser(report: CrashReport, analysis: CrashAnalysis): void {
    console.error(`\n🔥 Re-Shell CLI Crash Detected (${report.id})`);
    console.error(`Type: ${report.type}`);
    console.error(`Severity: ${report.severity}`);
    console.error(`Error: ${report.error.message}\n`);
    
    if (analysis.rootCause) {
      console.error(`Root Cause: ${analysis.rootCause}\n`);
    }
    
    if (analysis.recommendations.length > 0) {
      console.error('Suggested Fixes:');
      analysis.recommendations.slice(0, 3).forEach((rec, i) => {
        console.error(`  ${i + 1}. ${rec}`);
      });
      console.error('');
    }
    
    if (report.recovered) {
      console.error('✅ Auto-recovery was successful');
    } else if (analysis.quickFixes.length > 0) {
      console.error('🔧 Auto-recovery options are available');
    }
    
    console.error(`📝 Full report saved: ${report.id}`);
    console.error('');
  }

  private handleGracefulShutdown(): void {
    // Perform final cleanup and reporting
    this.emit('shutdown');
  }

  // Utility methods
  private generateReportId(): string {
    return `crash_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateFingerprint(error: Error): string {

    const data = `${error.name}:${error.message}:${error.stack?.split('\n')[0] || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex').substr(0, 16);
  }

  private async getCliVersion(): Promise<string> {
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      const pkg = await fs.readJson(packagePath);
      return pkg.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async getDiskSpace(): Promise<SystemInfo['diskSpace']> {
    try {
      const stats = await fs.stat(this.workspaceRoot);
      return {
        total: 0, // TODO: Implement platform-specific disk space check
        free: 0,
        used: 0
      };
    } catch {
      return undefined;
    }
  }

  private async testNetworkConnectivity(): Promise<boolean> {
    try {

      return new Promise((resolve) => {
        const req = https.get('https://registry.npmjs.org/', (res: any) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  private async testFileSystemPermissions(): Promise<boolean> {
    try {
      const testFile = path.join(os.tmpdir(), 're-shell-permission-test');
      await fs.writeFile(testFile, 'test');
      await fs.readFile(testFile);
      await fs.unlink(testFile);
      return true;
    } catch {
      return false;
    }
  }

  private async getDependencyVersions(): Promise<Record<string, string>> {
    try {
      const packagePath = path.join(this.workspaceRoot, 'package.json');
      if (await fs.pathExists(packagePath)) {
        const pkg = await fs.readJson(packagePath);
        return {
          ...pkg.dependencies,
          ...pkg.devDependencies
        };
      }
    } catch {
      // Ignore errors
    }
    return {};
  }

  private async validateConfiguration(): Promise<boolean> {
    try {
      const configPath = path.join(this.workspaceRoot, '.re-shell', 'config.yaml');
      return await fs.pathExists(configPath);
    } catch {
      return false;
    }
  }

  // Public methods for logging and error tracking
  addLogEntry(message: string): void {
    this.recentLogs.push(`${new Date().toISOString()}: ${message}`);
    
    // Keep only recent logs
    if (this.recentLogs.length > 100) {
      this.recentLogs = this.recentLogs.slice(-50);
    }
  }

  recordError(error: string, context?: string): void {
    this.recentErrors.push({
      timestamp: new Date(),
      error,
      context
    });
    
    // Keep only recent errors
    if (this.recentErrors.length > 50) {
      this.recentErrors = this.recentErrors.slice(-25);
    }
  }

  // Query methods
  async getReports(limit = 10): Promise<CrashReport[]> {
    try {
      const reportFiles = await fs.readdir(this.crashReportsPath);
      const jsonFiles = reportFiles.filter(f => f.endsWith('.json'));
      
      const reports: CrashReport[] = [];
      
      for (const file of jsonFiles.slice(0, limit)) {
        try {
          const report = await fs.readJson(path.join(this.crashReportsPath, file));
          reports.push(report);
        } catch {
          // Skip corrupted reports
        }
      }
      
      return reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return [];
    }
  }

  async getReport(id: string): Promise<CrashReport | null> {
    try {
      const reportPath = path.join(this.crashReportsPath, `${id}.json`);
      if (await fs.pathExists(reportPath)) {
        return await fs.readJson(reportPath);
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  getSessionInfo(): { id: string; startTime: Date; uptime: number } {
    return {
      id: this.sessionId,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime.getTime()
    };
  }
}

// Global crash reporter
let globalCrashReporter: CrashReporter | null = null;

export function createCrashReporter(
  workspaceRoot: string,
  options?: Partial<CrashReporterOptions>
): CrashReporter {
  return new CrashReporter(workspaceRoot, options);
}

export function getGlobalCrashReporter(): CrashReporter {
  if (!globalCrashReporter) {
    globalCrashReporter = new CrashReporter(process.cwd());
  }
  return globalCrashReporter;
}

export function setGlobalCrashReporter(reporter: CrashReporter): void {
  globalCrashReporter = reporter;
}