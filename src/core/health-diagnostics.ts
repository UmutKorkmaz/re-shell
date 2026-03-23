import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { execSync } from 'child_process';

export interface HealthCheck {
  id: string;
  name: string;
  category: HealthCategory;
  description: string;
  severity: HealthSeverity;
  check: () => Promise<HealthResult>;
  repair?: () => Promise<RepairResult>;
  dependencies?: string[];
  timeout: number;
  enabled: boolean;
}

export enum HealthCategory {
  SYSTEM = 'system',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
  DEPENDENCIES = 'dependencies',
  CONFIGURATION = 'configuration',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  ENVIRONMENT = 'environment'
}

export enum HealthSeverity {
  INFO = 0,
  WARNING = 1,
  ERROR = 2,
  CRITICAL = 3
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export interface HealthResult {
  status: HealthStatus;
  message: string;
  details?: Record<string, any>;
  metrics?: Record<string, number>;
  suggestions?: string[];
  timestamp: Date;
  duration: number;
}

export interface RepairResult {
  success: boolean;
  message: string;
  actions: string[];
  timestamp: Date;
  duration: number;
}

export interface DiagnosticReport {
  id: string;
  timestamp: Date;
  overallStatus: HealthStatus;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
  results: Array<{
    check: HealthCheck;
    result: HealthResult;
    repairAttempted?: boolean;
    repairResult?: RepairResult;
  }>;
  systemInfo: SystemInfo;
  recommendations: string[];
  duration: number;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  cliVersion: string;
  workingDirectory: string;
  homeDirectory: string;
  memory: {
    total: number;
    free: number;
    used: number;
  };
  cpu: {
    model: string;
    cores: number;
    loadAverage: number[];
  };
  uptime: number;
}

export class HealthDiagnostics extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private lastReport?: DiagnosticReport;
  private running = false;

  constructor() {
    super();
    this.registerBuiltinChecks();
  }

  private registerBuiltinChecks(): void {
    // System checks
    this.registerCheck({
      id: 'system_memory',
      name: 'System Memory',
      category: HealthCategory.SYSTEM,
      description: 'Check available system memory',
      severity: HealthSeverity.WARNING,
      timeout: 5000,
      enabled: true,
      check: async () => {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usagePercentage = (used / total) * 100;

        let status = HealthStatus.HEALTHY;
        let message = `Memory usage: ${usagePercentage.toFixed(1)}%`;
        const suggestions: string[] = [];

        if (usagePercentage > 90) {
          status = HealthStatus.UNHEALTHY;
          message = `Critical memory usage: ${usagePercentage.toFixed(1)}%`;
          suggestions.push('Close unnecessary applications');
          suggestions.push('Restart the system if memory usage remains high');
        } else if (usagePercentage > 80) {
          status = HealthStatus.DEGRADED;
          message = `High memory usage: ${usagePercentage.toFixed(1)}%`;
          suggestions.push('Monitor memory usage');
          suggestions.push('Consider closing some applications');
        }

        return {
          status,
          message,
          details: { total, free, used, usagePercentage },
          metrics: { memory_usage: usagePercentage },
          suggestions,
          timestamp: new Date(),
          duration: 0
        };
      }
    });

    this.registerCheck({
      id: 'system_disk_space',
      name: 'Disk Space',
      category: HealthCategory.FILESYSTEM,
      description: 'Check available disk space',
      severity: HealthSeverity.ERROR,
      timeout: 5000,
      enabled: true,
      check: async () => {
        try {
          const stats = await fs.stat(process.cwd());
          // Note: Getting actual disk space requires platform-specific implementations
          // This is a simplified version
          
          return {
            status: HealthStatus.HEALTHY,
            message: 'Disk space check completed',
            details: { available: 'unknown' },
            suggestions: ['Use platform-specific tools for accurate disk space monitoring'],
            timestamp: new Date(),
            duration: 0
          };
        } catch (error: any) {
          return {
            status: HealthStatus.UNHEALTHY,
            message: `Disk space check failed: ${error.message}`,
            suggestions: ['Check file system permissions', 'Verify working directory exists'],
            timestamp: new Date(),
            duration: 0
          };
        }
      }
    });

    this.registerCheck({
      id: 'node_version',
      name: 'Node.js Version',
      category: HealthCategory.ENVIRONMENT,
      description: 'Check Node.js version compatibility',
      severity: HealthSeverity.ERROR,
      timeout: 2000,
      enabled: true,
      check: async () => {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        let status = HealthStatus.HEALTHY;
        let message = `Node.js version: ${nodeVersion}`;
        const suggestions: string[] = [];

        if (majorVersion < 14) {
          status = HealthStatus.UNHEALTHY;
          message = `Unsupported Node.js version: ${nodeVersion}`;
          suggestions.push('Upgrade to Node.js 14 or higher');
          suggestions.push('Use a Node.js version manager like nvm');
        } else if (majorVersion < 16) {
          status = HealthStatus.DEGRADED;
          message = `Old Node.js version: ${nodeVersion}`;
          suggestions.push('Consider upgrading to Node.js 16+ for better performance');
        }

        return {
          status,
          message,
          details: { version: nodeVersion, majorVersion },
          suggestions,
          timestamp: new Date(),
          duration: 0
        };
      }
    });

    this.registerCheck({
      id: 'package_manager',
      name: 'Package Manager',
      category: HealthCategory.DEPENDENCIES,
      description: 'Check package manager availability',
      severity: HealthSeverity.WARNING,
      timeout: 10000,
      enabled: true,
      check: async () => {
        const managers = ['npm', 'yarn', 'pnpm', 'bun'];
        const available: string[] = [];
        const unavailable: string[] = [];

        for (const manager of managers) {
          try {

            execSync(`${manager} --version`, { stdio: 'ignore' });
            available.push(manager);
          } catch {
            unavailable.push(manager);
          }
        }

        let status = HealthStatus.HEALTHY;
        let message = `Available package managers: ${available.join(', ')}`;
        const suggestions: string[] = [];

        if (available.length === 0) {
          status = HealthStatus.UNHEALTHY;
          message = 'No package managers found';
          suggestions.push('Install npm (comes with Node.js)');
          suggestions.push('Consider installing yarn or pnpm for better performance');
        } else if (available.length === 1 && available[0] === 'npm') {
          status = HealthStatus.DEGRADED;
          suggestions.push('Consider installing yarn or pnpm for faster package management');
        }

        return {
          status,
          message,
          details: { available, unavailable },
          suggestions,
          timestamp: new Date(),
          duration: 0
        };
      }
    });

    this.registerCheck({
      id: 'git_availability',
      name: 'Git Availability',
      category: HealthCategory.ENVIRONMENT,
      description: 'Check Git installation',
      severity: HealthSeverity.WARNING,
      timeout: 5000,
      enabled: true,
      check: async () => {
        try {

          const version = execSync('git --version', { encoding: 'utf8' }).trim();
          
          return {
            status: HealthStatus.HEALTHY,
            message: `Git is available: ${version}`,
            details: { version },
            timestamp: new Date(),
            duration: 0
          };
        } catch (error) {
          return {
            status: HealthStatus.DEGRADED,
            message: 'Git is not available',
            suggestions: [
              'Install Git from https://git-scm.com/',
              'Add Git to your PATH environment variable'
            ],
            timestamp: new Date(),
            duration: 0
          };
        }
      }
    });

    this.registerCheck({
      id: 'config_files',
      name: 'Configuration Files',
      category: HealthCategory.CONFIGURATION,
      description: 'Check Re-Shell configuration files',
      severity: HealthSeverity.INFO,
      timeout: 5000,
      enabled: true,
      check: async () => {
        const configDir = path.join(os.homedir(), '.re-shell');
        const configFile = path.join(configDir, 'config.yaml');
        const preferencesFile = path.join(configDir, 'preferences.json');
        
        const files = {
          configDir: await fs.pathExists(configDir),
          configFile: await fs.pathExists(configFile),
          preferencesFile: await fs.pathExists(preferencesFile)
        };

        let status = HealthStatus.HEALTHY;
        let message = 'Configuration files are present';
        const suggestions: string[] = [];

        if (!files.configDir) {
          status = HealthStatus.DEGRADED;
          message = 'Configuration directory not found';
          suggestions.push('Run re-shell init to create configuration');
        } else if (!files.configFile && !files.preferencesFile) {
          status = HealthStatus.DEGRADED;
          message = 'No configuration files found';
          suggestions.push('Run re-shell config to set up configuration');
        }

        return {
          status,
          message,
          details: files,
          suggestions,
          timestamp: new Date(),
          duration: 0
        };
      },
      repair: async () => {
        const configDir = path.join(os.homedir(), '.re-shell');
        const actions: string[] = [];

        try {
          await fs.ensureDir(configDir);
          actions.push(`Created configuration directory: ${configDir}`);

          const defaultConfig = {
            version: '1.0.0',
            created: new Date().toISOString()
          };

          const configFile = path.join(configDir, 'config.yaml');
          if (!await fs.pathExists(configFile)) {
            await fs.writeFile(configFile, '# Re-Shell Configuration\nversion: 1.0.0\n');
            actions.push(`Created default config file: ${configFile}`);
          }

          return {
            success: true,
            message: 'Configuration files repaired successfully',
            actions,
            timestamp: new Date(),
            duration: 0
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Failed to repair configuration: ${error.message}`,
            actions,
            timestamp: new Date(),
            duration: 0
          };
        }
      }
    });

    this.registerCheck({
      id: 'network_connectivity',
      name: 'Network Connectivity',
      category: HealthCategory.NETWORK,
      description: 'Check internet connectivity',
      severity: HealthSeverity.WARNING,
      timeout: 10000,
      enabled: true,
      check: async () => {
        try {

          
          return new Promise<HealthResult>((resolve) => {
            const startTime = Date.now();
            const req = https.get('https://registry.npmjs.org/', (res: any) => {
              const duration = Date.now() - startTime;
              
              if (res.statusCode === 200) {
                resolve({
                  status: HealthStatus.HEALTHY,
                  message: `Network connectivity OK (${duration}ms)`,
                  details: { statusCode: res.statusCode, responseTime: duration },
                  metrics: { response_time: duration },
                  timestamp: new Date(),
                  duration
                });
              } else {
                resolve({
                  status: HealthStatus.DEGRADED,
                  message: `Network issues detected (status: ${res.statusCode})`,
                  details: { statusCode: res.statusCode },
                  suggestions: ['Check internet connection', 'Verify firewall settings'],
                  timestamp: new Date(),
                  duration
                });
              }
            });

            req.on('error', (error: any) => {
              resolve({
                status: HealthStatus.UNHEALTHY,
                message: `Network connectivity failed: ${error.message}`,
                suggestions: [
                  'Check internet connection',
                  'Verify DNS settings',
                  'Check proxy configuration'
                ],
                timestamp: new Date(),
                duration: Date.now() - startTime
              });
            });

            req.setTimeout(10000, () => {
              req.destroy();
              resolve({
                status: HealthStatus.DEGRADED,
                message: 'Network request timed out',
                suggestions: ['Check internet connection speed', 'Verify network stability'],
                timestamp: new Date(),
                duration: Date.now() - startTime
              });
            });
          });
        } catch (error: any) {
          return {
            status: HealthStatus.UNHEALTHY,
            message: `Network check failed: ${error.message}`,
            timestamp: new Date(),
            duration: 0
          };
        }
      }
    });

    this.registerCheck({
      id: 'permissions',
      name: 'File Permissions',
      category: HealthCategory.FILESYSTEM,
      description: 'Check file system permissions',
      severity: HealthSeverity.ERROR,
      timeout: 5000,
      enabled: true,
      check: async () => {
        const testDir = path.join(os.tmpdir(), 'reshell-permission-test');
        const testFile = path.join(testDir, 'test.txt');
        
        try {
          await fs.ensureDir(testDir);
          await fs.writeFile(testFile, 'test');
          await fs.readFile(testFile);
          await fs.remove(testDir);

          return {
            status: HealthStatus.HEALTHY,
            message: 'File system permissions are correct',
            timestamp: new Date(),
            duration: 0
          };
        } catch (error: any) {
          return {
            status: HealthStatus.UNHEALTHY,
            message: `Permission error: ${error.message}`,
            suggestions: [
              'Check file system permissions',
              'Run with appropriate user privileges',
              'Verify temp directory access'
            ],
            timestamp: new Date(),
            duration: 0
          };
        }
      }
    });
  }

  registerCheck(check: HealthCheck): void {
    this.checks.set(check.id, check);
    this.emit('check:registered', check);
  }

  unregisterCheck(id: string): boolean {
    const check = this.checks.get(id);
    if (check) {
      this.checks.delete(id);
      this.emit('check:unregistered', check);
      return true;
    }
    return false;
  }

  async runDiagnostics(options: {
    categories?: HealthCategory[];
    includeRepairs?: boolean;
    timeout?: number;
  } = {}): Promise<DiagnosticReport> {
    if (this.running) {
      throw new Error('Diagnostics already running');
    }

    this.running = true;
    const startTime = Date.now();
    const reportId = this.generateReportId();

    try {
      this.emit('diagnostics:start', { reportId });

      // Filter checks
      let checksToRun = Array.from(this.checks.values())
        .filter(check => check.enabled);

      if (options.categories) {
        checksToRun = checksToRun.filter(check => 
          options.categories!.includes(check.category)
        );
      }

      // Sort by dependencies
      checksToRun = this.sortChecksByDependencies(checksToRun);

      // Run checks
      const results: DiagnosticReport['results'] = [];
      const summary = {
        total: checksToRun.length,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        unknown: 0
      };

      for (const check of checksToRun) {
        this.emit('check:start', check);
        
        try {
          const checkStartTime = Date.now();
          const result = await this.runSingleCheck(check, options.timeout);
          result.duration = Date.now() - checkStartTime;

          // Update summary
          switch (result.status) {
            case HealthStatus.HEALTHY: summary.healthy++; break;
            case HealthStatus.DEGRADED: summary.degraded++; break;
            case HealthStatus.UNHEALTHY: summary.unhealthy++; break;
            default: summary.unknown++; break;
          }

          const checkResult: DiagnosticReport['results'][0] = {
            check,
            result
          };

          // Attempt repair if needed and enabled
          if (options.includeRepairs && 
              check.repair && 
              (result.status === HealthStatus.UNHEALTHY || 
               result.status === HealthStatus.DEGRADED)) {
            
            this.emit('repair:start', check);
            
            try {
              const repairResult = await this.runRepair(check);
              checkResult.repairAttempted = true;
              checkResult.repairResult = repairResult;
              
              if (repairResult.success) {
                this.emit('repair:success', { check, result: repairResult });
              } else {
                this.emit('repair:failure', { check, result: repairResult });
              }
            } catch (repairError: any) {
              checkResult.repairAttempted = true;
              checkResult.repairResult = {
                success: false,
                message: `Repair failed: ${repairError.message}`,
                actions: [],
                timestamp: new Date(),
                duration: 0
              };
              this.emit('repair:error', { check, error: repairError });
            }
          }

          results.push(checkResult);
          this.emit('check:complete', { check, result });

        } catch (error: any) {
          const errorResult: HealthResult = {
            status: HealthStatus.UNKNOWN,
            message: `Check failed: ${error.message}`,
            timestamp: new Date(),
            duration: 0
          };

          results.push({ check, result: errorResult });
          summary.unknown++;
          this.emit('check:error', { check, error });
        }
      }

      // Determine overall status
      const overallStatus = this.calculateOverallStatus(summary);

      // Generate recommendations
      const recommendations = this.generateRecommendations(results);

      // Create report
      const report: DiagnosticReport = {
        id: reportId,
        timestamp: new Date(),
        overallStatus,
        summary,
        results,
        systemInfo: await this.getSystemInfo(),
        recommendations,
        duration: Date.now() - startTime
      };

      this.lastReport = report;
      this.emit('diagnostics:complete', report);

      return report;

    } finally {
      this.running = false;
    }
  }

  private async runSingleCheck(check: HealthCheck, timeout?: number): Promise<HealthResult> {
    const checkTimeout = timeout || check.timeout;
    
    return new Promise<HealthResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Check timed out after ${checkTimeout}ms`));
      }, checkTimeout);

      check.check()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async runRepair(check: HealthCheck): Promise<RepairResult> {
    if (!check.repair) {
      throw new Error('No repair function available');
    }

    const startTime = Date.now();
    const result = await check.repair();
    result.duration = Date.now() - startTime;
    
    return result;
  }

  private sortChecksByDependencies(checks: HealthCheck[]): HealthCheck[] {
    const sorted: HealthCheck[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (check: HealthCheck) => {
      if (visiting.has(check.id)) {
        throw new Error(`Circular dependency detected: ${check.id}`);
      }
      
      if (visited.has(check.id)) {
        return;
      }

      visiting.add(check.id);

      if (check.dependencies) {
        for (const depId of check.dependencies) {
          const depCheck = checks.find(c => c.id === depId);
          if (depCheck) {
            visit(depCheck);
          }
        }
      }

      visiting.delete(check.id);
      visited.add(check.id);
      sorted.push(check);
    };

    for (const check of checks) {
      if (!visited.has(check.id)) {
        visit(check);
      }
    }

    return sorted;
  }

  private calculateOverallStatus(summary: DiagnosticReport['summary']): HealthStatus {
    if (summary.unhealthy > 0) {
      return HealthStatus.UNHEALTHY;
    }
    if (summary.degraded > 0) {
      return HealthStatus.DEGRADED;
    }
    if (summary.unknown > 0) {
      return HealthStatus.UNKNOWN;
    }
    return HealthStatus.HEALTHY;
  }

  private generateRecommendations(results: DiagnosticReport['results']): string[] {
    const recommendations: string[] = [];

    // High-priority recommendations
    const unhealthyChecks = results.filter(r => r.result.status === HealthStatus.UNHEALTHY);
    const degradedChecks = results.filter(r => r.result.status === HealthStatus.DEGRADED);

    if (unhealthyChecks.length > 0) {
      recommendations.push(`Address ${unhealthyChecks.length} critical issues immediately`);
    }

    if (degradedChecks.length > 0) {
      recommendations.push(`Review ${degradedChecks.length} warnings for optimal performance`);
    }

    // Category-specific recommendations
    const systemIssues = results.filter(r => 
      r.check.category === HealthCategory.SYSTEM && 
      r.result.status !== HealthStatus.HEALTHY
    );

    if (systemIssues.length > 0) {
      recommendations.push('System resources may need attention');
    }

    // Add specific suggestions from checks
    for (const result of results) {
      if (result.result.suggestions) {
        recommendations.push(...result.result.suggestions);
      }
    }

    return Array.from(new Set(recommendations)); // Remove duplicates
  }

  private async getSystemInfo(): Promise<SystemInfo> {
    const memory = process.memoryUsage();
    const cpus = os.cpus();

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cliVersion: await this.getCliVersion(),
      workingDirectory: process.cwd(),
      homeDirectory: os.homedir(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: memory.rss
      },
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        loadAverage: os.loadavg()
      },
      uptime: os.uptime()
    };
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

  private generateReportId(): string {
    return `health_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  // Query methods
  getChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  getChecksByCategory(category: HealthCategory): HealthCheck[] {
    return Array.from(this.checks.values())
      .filter(check => check.category === category);
  }

  getLastReport(): DiagnosticReport | undefined {
    return this.lastReport;
  }

  isRunning(): boolean {
    return this.running;
  }

  // Configuration methods
  enableCheck(id: string): boolean {
    const check = this.checks.get(id);
    if (check) {
      check.enabled = true;
      this.emit('check:enabled', check);
      return true;
    }
    return false;
  }

  disableCheck(id: string): boolean {
    const check = this.checks.get(id);
    if (check) {
      check.enabled = false;
      this.emit('check:disabled', check);
      return true;
    }
    return false;
  }

  // Quick health check
  async quickCheck(): Promise<{ status: HealthStatus; message: string; critical: number }> {
    const criticalChecks = Array.from(this.checks.values())
      .filter(check => check.enabled && check.severity >= HealthSeverity.ERROR);

    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const check of criticalChecks) {
      try {
        const result = await this.runSingleCheck(check, 5000);
        if (result.status === HealthStatus.UNHEALTHY) {
          unhealthyCount++;
        } else if (result.status === HealthStatus.DEGRADED) {
          degradedCount++;
        }
      } catch {
        unhealthyCount++;
      }
    }

    let status = HealthStatus.HEALTHY;
    let message = 'System is healthy';

    if (unhealthyCount > 0) {
      status = HealthStatus.UNHEALTHY;
      message = `${unhealthyCount} critical issues detected`;
    } else if (degradedCount > 0) {
      status = HealthStatus.DEGRADED;
      message = `${degradedCount} warnings detected`;
    }

    return { status, message, critical: unhealthyCount };
  }
}

// Global health diagnostics
let globalHealthDiagnostics: HealthDiagnostics | null = null;

export function createHealthDiagnostics(): HealthDiagnostics {
  return new HealthDiagnostics();
}

export function getGlobalHealthDiagnostics(): HealthDiagnostics {
  if (!globalHealthDiagnostics) {
    globalHealthDiagnostics = new HealthDiagnostics();
  }
  return globalHealthDiagnostics;
}

export function setGlobalHealthDiagnostics(diagnostics: HealthDiagnostics): void {
  globalHealthDiagnostics = diagnostics;
}