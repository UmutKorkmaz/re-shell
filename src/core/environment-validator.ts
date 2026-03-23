import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';

const execAsync = promisify(exec);

export interface EnvironmentRequirement {
  name: string;
  type: 'runtime' | 'tool' | 'package' | 'system' | 'network';
  required: boolean;
  minVersion?: string;
  maxVersion?: string;
  checkCommand?: string;
  installCommand?: string;
  installUrl?: string;
  validator?: () => Promise<boolean>;
  autoInstall?: boolean;
  platforms?: NodeJS.Platform[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  systemInfo: SystemInfo;
  recommendations: string[];
  autoFixAvailable: boolean;
}

export interface ValidationIssue {
  requirement: string;
  type: 'missing' | 'version' | 'permission' | 'configuration' | 'network';
  severity: 'error' | 'warning';
  message: string;
  fixCommand?: string;
  fixUrl?: string;
  autoFixable: boolean;
}

export interface ValidationWarning {
  message: string;
  type: 'performance' | 'compatibility' | 'security' | 'deprecated';
  recommendation?: string;
}

export interface SystemInfo {
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  npmVersion: string;
  osVersion: string;
  shell: string;
  memory: {
    total: number;
    free: number;
    used: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
  };
  cpu: {
    model: string;
    cores: number;
    speed: number;
  };
  network: {
    online: boolean;
    proxy?: string;
    vpn?: boolean;
  };
}

export interface SetupOptions {
  autoFix: boolean;
  interactive: boolean;
  verbose: boolean;
  skipOptional: boolean;
  parallel: boolean;
  timeout: number;
  retryAttempts: number;
}

export interface SetupResult {
  success: boolean;
  fixed: string[];
  failed: string[];
  skipped: string[];
  warnings: string[];
  duration: number;
  recoveryActions?: RecoveryAction[];
}

export interface RecoveryAction {
  name: string;
  command: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  automated: boolean;
}

export class EnvironmentValidator extends EventEmitter {
  private requirements: Map<string, EnvironmentRequirement> = new Map();
  private systemInfo?: SystemInfo;
  private validationCache: Map<string, { result: boolean; timestamp: number }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private readonly defaultOptions: SetupOptions = {
    autoFix: true,
    interactive: false,
    verbose: false,
    skipOptional: false,
    parallel: true,
    timeout: 30000,
    retryAttempts: 3
  };

  constructor() {
    super();
    this.initializeRequirements();
  }

  private initializeRequirements(): void {
    // Core requirements
    this.addRequirement({
      name: 'Node.js',
      type: 'runtime',
      required: true,
      minVersion: '16.0.0',
      checkCommand: 'node --version',
      installUrl: 'https://nodejs.org/',
      validator: async () => {
        try {
          const version = execSync('node --version', { encoding: 'utf8' }).trim();
          return semver.gte(version.replace('v', ''), '16.0.0');
        } catch {
          return false;
        }
      }
    });

    this.addRequirement({
      name: 'npm',
      type: 'tool',
      required: true,
      minVersion: '8.0.0',
      checkCommand: 'npm --version',
      installCommand: 'npm install -g npm@latest',
      autoInstall: true
    });

    this.addRequirement({
      name: 'Git',
      type: 'tool',
      required: true,
      minVersion: '2.25.0',
      checkCommand: 'git --version',
      installUrl: 'https://git-scm.com/downloads',
      validator: async () => {
        try {
          const output = execSync('git --version', { encoding: 'utf8' });
          const version = output.match(/(\d+\.\d+\.\d+)/)?.[1];
          return version ? semver.gte(version, '2.25.0') : false;
        } catch {
          return false;
        }
      }
    });

    // Optional but recommended tools
    this.addRequirement({
      name: 'Docker',
      type: 'tool',
      required: false,
      checkCommand: 'docker --version',
      installUrl: 'https://docs.docker.com/get-docker/'
    });

    this.addRequirement({
      name: 'Yarn',
      type: 'package',
      required: false,
      minVersion: '1.22.0',
      checkCommand: 'yarn --version',
      installCommand: 'npm install -g yarn',
      autoInstall: true
    });

    this.addRequirement({
      name: 'pnpm',
      type: 'package',
      required: false,
      minVersion: '7.0.0',
      checkCommand: 'pnpm --version',
      installCommand: 'npm install -g pnpm',
      autoInstall: true
    });

    // System requirements
    this.addRequirement({
      name: 'Disk Space',
      type: 'system',
      required: true,
      validator: async () => {
        const diskInfo = await this.getDiskInfo();
        return diskInfo.free > 1024 * 1024 * 1024; // 1GB free space
      }
    });

    this.addRequirement({
      name: 'Memory',
      type: 'system',
      required: true,
      validator: async () => {
        const memInfo = this.getMemoryInfo();
        return memInfo.free > 512 * 1024 * 1024; // 512MB free memory
      }
    });

    this.addRequirement({
      name: 'Internet Connection',
      type: 'network',
      required: true,
      validator: async () => {
        return await this.checkInternetConnection();
      }
    });

    // Platform-specific requirements
    if (process.platform === 'win32') {
      this.addRequirement({
        name: 'Windows Build Tools',
        type: 'tool',
        required: false,
        platforms: ['win32'],
        checkCommand: 'npm list -g windows-build-tools',
        installCommand: 'npm install -g windows-build-tools',
        autoInstall: true
      });
    }

    if (process.platform === 'darwin') {
      this.addRequirement({
        name: 'Xcode Command Line Tools',
        type: 'tool',
        required: false,
        platforms: ['darwin'],
        checkCommand: 'xcode-select -p',
        installCommand: 'xcode-select --install'
      });
    }
  }

  addRequirement(requirement: EnvironmentRequirement): void {
    // Check platform compatibility
    if (requirement.platforms && !requirement.platforms.includes(process.platform)) {
      return;
    }

    this.requirements.set(requirement.name, requirement);
    this.emit('requirement:added', requirement);
  }

  removeRequirement(name: string): boolean {
    const removed = this.requirements.delete(name);
    if (removed) {
      this.emit('requirement:removed', name);
    }
    return removed;
  }

  async validate(options: Partial<SetupOptions> = {}): Promise<ValidationResult> {
    this.emit('validation:start');

    const opts = { ...this.defaultOptions, ...options };
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    // Gather system info
    this.systemInfo = await this.gatherSystemInfo();

    // Validate each requirement
    const validationPromises = Array.from(this.requirements.values()).map(req =>
      this.validateRequirement(req, opts)
    );

    const results = opts.parallel
      ? await Promise.all(validationPromises)
      : await this.validateSequentially(validationPromises);

    // Process results
    for (const result of results) {
      if (result.issues) {
        issues.push(...result.issues);
      }
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
      if (result.recommendations) {
        recommendations.push(...result.recommendations);
      }
    }

    // Add system-specific warnings
    const systemWarnings = this.analyzeSystemHealth();
    warnings.push(...systemWarnings);

    // Add general recommendations
    const generalRecommendations = this.generateRecommendations(this.systemInfo);
    recommendations.push(...generalRecommendations);

    const validationResult: ValidationResult = {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      warnings,
      systemInfo: this.systemInfo,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      autoFixAvailable: issues.some(i => i.autoFixable)
    };

    this.emit('validation:complete', validationResult);
    return validationResult;
  }

  private async validateRequirement(
    requirement: EnvironmentRequirement,
    options: SetupOptions
  ): Promise<{
    issues?: ValidationIssue[];
    warnings?: ValidationWarning[];
    recommendations?: string[];
  }> {
    // Check cache
    const cacheKey = requirement.name;
    const cached = this.validationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result ? {} : {
        issues: [{
          requirement: requirement.name,
          type: 'missing',
          severity: requirement.required ? 'error' : 'warning',
          message: `${requirement.name} is not available`,
          autoFixable: !!requirement.autoInstall && !!requirement.installCommand
        }]
      };
    }

    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const recommendations: string[] = [];

    try {
      let isValid = false;

      // Custom validator takes precedence
      if (requirement.validator) {
        isValid = await requirement.validator();
      } else if (requirement.checkCommand) {
        isValid = await this.checkCommand(requirement);
      }

      if (!isValid) {
        issues.push({
          requirement: requirement.name,
          type: 'missing',
          severity: requirement.required ? 'error' : 'warning',
          message: `${requirement.name} is not installed or not meeting requirements`,
          fixCommand: requirement.installCommand,
          fixUrl: requirement.installUrl,
          autoFixable: !!requirement.autoInstall && !!requirement.installCommand
        });

        if (!requirement.required) {
          recommendations.push(`Consider installing ${requirement.name} for better functionality`);
        }
      }

      // Cache result
      this.validationCache.set(cacheKey, { result: isValid, timestamp: Date.now() });

    } catch (error: any) {
      issues.push({
        requirement: requirement.name,
        type: 'missing',
        severity: requirement.required ? 'error' : 'warning',
        message: `Failed to check ${requirement.name}: ${error.message}`,
        autoFixable: false
      });
    }

    return { issues, warnings, recommendations };
  }

  private async checkCommand(requirement: EnvironmentRequirement): Promise<boolean> {
    if (!requirement.checkCommand) return false;

    try {
      const output = execSync(requirement.checkCommand, { encoding: 'utf8' }).trim();

      // Version check if specified
      if (requirement.minVersion || requirement.maxVersion) {
        const version = this.extractVersion(output);
        if (!version) return false;

        if (requirement.minVersion && !semver.gte(version, requirement.minVersion)) {
          return false;
        }
        if (requirement.maxVersion && !semver.lte(version, requirement.maxVersion)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private extractVersion(output: string): string | null {
    // Common version patterns
    const patterns = [
      /(\d+\.\d+\.\d+)/,  // 1.2.3
      /v(\d+\.\d+\.\d+)/, // v1.2.3
      /(\d+\.\d+)/,       // 1.2
      /version (\d+\.\d+\.\d+)/i
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private async validateSequentially(promises: Promise<any>[]): Promise<any[]> {
    const results: any[] = [];
    for (const promise of promises) {
      results.push(await promise);
    }
    return results;
  }

  async setup(options: Partial<SetupOptions> = {}): Promise<SetupResult> {
    this.emit('setup:start');

    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    const fixed: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];
    const warnings: string[] = [];
    const recoveryActions: RecoveryAction[] = [];

    // First validate
    const validation = await this.validate(opts);

    if (validation.valid && validation.issues.length === 0) {
      return {
        success: true,
        fixed,
        failed,
        skipped,
        warnings,
        duration: Date.now() - startTime
      };
    }

    // Process issues
    for (const issue of validation.issues) {
      if (!issue.autoFixable || !opts.autoFix) {
        if (issue.severity === 'error') {
          failed.push(issue.requirement);
          
          // Add recovery action
          if (issue.fixCommand || issue.fixUrl) {
            recoveryActions.push({
              name: `Fix ${issue.requirement}`,
              command: issue.fixCommand || `Visit ${issue.fixUrl}`,
              description: issue.message,
              priority: 'high',
              automated: !!issue.fixCommand
            });
          }
        } else {
          warnings.push(issue.message);
        }
        continue;
      }

      // Skip optional requirements if requested
      if (opts.skipOptional && issue.severity === 'warning') {
        skipped.push(issue.requirement);
        continue;
      }

      // Attempt auto-fix
      const requirement = this.requirements.get(issue.requirement);
      if (requirement && requirement.installCommand) {
        const fixResult = await this.attemptFix(requirement, opts);
        if (fixResult.success) {
          fixed.push(issue.requirement);
        } else {
          failed.push(issue.requirement);
          warnings.push(fixResult.error || 'Unknown error during fix');
          
          // Add recovery action
          recoveryActions.push({
            name: `Manually fix ${issue.requirement}`,
            command: requirement.installCommand,
            description: `Failed to auto-install: ${fixResult.error}`,
            priority: requirement.required ? 'high' : 'medium',
            automated: false
          });
        }
      }
    }

    const result: SetupResult = {
      success: failed.length === 0,
      fixed,
      failed,
      skipped,
      warnings,
      duration: Date.now() - startTime,
      recoveryActions: recoveryActions.length > 0 ? recoveryActions : undefined
    };

    this.emit('setup:complete', result);
    return result;
  }

  private async attemptFix(
    requirement: EnvironmentRequirement,
    options: SetupOptions
  ): Promise<{ success: boolean; error?: string }> {
    if (!requirement.installCommand) {
      return { success: false, error: 'No install command available' };
    }

    this.emit('fix:start', requirement.name);

    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < options.retryAttempts) {
      attempts++;

      try {
        // Execute install command
        if (options.verbose) {
          console.log(`Attempting to install ${requirement.name} (attempt ${attempts}/${options.retryAttempts})...`);
        }

        await execAsync(requirement.installCommand, {
          timeout: options.timeout,
          env: { ...process.env, FORCE_COLOR: '0' }
        });

        // Verify installation
        const isValid = requirement.validator
          ? await requirement.validator()
          : requirement.checkCommand
          ? await this.checkCommand(requirement)
          : true;

        if (isValid) {
          this.emit('fix:success', requirement.name);
          return { success: true };
        }

        lastError = 'Installation verification failed';
      } catch (error: any) {
        lastError = error.message || 'Unknown error';
        
        if (options.verbose) {
          console.error(`Failed to install ${requirement.name}: ${lastError}`);
        }

        // Wait before retry
        if (attempts < options.retryAttempts) {
          await this.delay(1000 * attempts); // Exponential backoff
        }
      }
    }

    this.emit('fix:failed', requirement.name, lastError);
    return { success: false, error: lastError };
  }

  private async gatherSystemInfo(): Promise<SystemInfo> {
    const cpus = os.cpus();
    const memory = this.getMemoryInfo();
    const disk = await this.getDiskInfo();
    const network = await this.getNetworkInfo();

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      npmVersion: await this.getNpmVersion(),
      osVersion: os.release(),
      shell: process.env.SHELL || 'unknown',
      memory,
      disk,
      cpu: {
        model: cpus[0]?.model || 'unknown',
        cores: cpus.length,
        speed: cpus[0]?.speed || 0
      },
      network
    };
  }

  private getMemoryInfo(): SystemInfo['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    return {
      total,
      free,
      used: total - free
    };
  }

  private async getDiskInfo(): Promise<SystemInfo['disk']> {
    // This is a simplified implementation
    // In production, you'd use a library like 'node-disk-info'
    try {
      if (process.platform === 'win32') {
        const output = execSync('wmic logicaldisk get size,freespace', { encoding: 'utf8' });
        // Parse Windows output
        const lines = output.trim().split('\n').slice(1);
        let totalSize = 0, freeSpace = 0;
        
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            freeSpace += parseInt(parts[0]) || 0;
            totalSize += parseInt(parts[1]) || 0;
          }
        }
        
        return {
          total: totalSize,
          free: freeSpace,
          used: totalSize - freeSpace
        };
      } else {
        const output = execSync('df -k /', { encoding: 'utf8' });
        const lines = output.trim().split('\n');
        const data = lines[1].split(/\s+/);
        
        return {
          total: parseInt(data[1]) * 1024,
          free: parseInt(data[3]) * 1024,
          used: parseInt(data[2]) * 1024
        };
      }
    } catch {
      return { total: 0, free: 0, used: 0 };
    }
  }

  private async getNetworkInfo(): Promise<SystemInfo['network']> {
    const online = await this.checkInternetConnection();
    const proxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    
    return {
      online,
      proxy,
      vpn: await this.detectVPN()
    };
  }

  private async getNpmVersion(): Promise<string> {
    try {
      return execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private async checkInternetConnection(): Promise<boolean> {
    try {
      // Try to resolve a reliable domain
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dns = require('dns').promises;
      await dns.resolve4('github.com');
      return true;
    } catch {
      return false;
    }
  }

  private async detectVPN(): Promise<boolean> {
    // Simple VPN detection - can be enhanced
    try {
      const interfaces = os.networkInterfaces();
      for (const [name, addresses] of Object.entries(interfaces)) {
        if (name.toLowerCase().includes('vpn') || 
            name.toLowerCase().includes('tun') ||
            name.toLowerCase().includes('tap')) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private analyzeSystemHealth(): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (!this.systemInfo) return warnings;

    // Memory warnings
    const memoryUsagePercent = (this.systemInfo.memory.used / this.systemInfo.memory.total) * 100;
    if (memoryUsagePercent > 90) {
      warnings.push({
        message: 'System memory usage is very high (>90%)',
        type: 'performance',
        recommendation: 'Close unnecessary applications to free up memory'
      });
    }

    // Disk warnings
    const diskUsagePercent = (this.systemInfo.disk.used / this.systemInfo.disk.total) * 100;
    if (diskUsagePercent > 90) {
      warnings.push({
        message: 'Disk usage is very high (>90%)',
        type: 'performance',
        recommendation: 'Free up disk space for optimal performance'
      });
    }

    // Network warnings
    if (!this.systemInfo.network.online) {
      warnings.push({
        message: 'No internet connection detected',
        type: 'compatibility',
        recommendation: 'Some features may not work without internet access'
      });
    }

    if (this.systemInfo.network.proxy) {
      warnings.push({
        message: 'HTTP proxy detected',
        type: 'compatibility',
        recommendation: 'Ensure proxy settings are correctly configured for package managers'
      });
    }

    // Node.js version warnings
    const nodeVersion = semver.clean(this.systemInfo.nodeVersion);
    if (nodeVersion && semver.lt(nodeVersion, '18.0.0')) {
      warnings.push({
        message: `Node.js ${nodeVersion} is outdated`,
        type: 'deprecated',
        recommendation: 'Consider upgrading to Node.js 18 or later for better performance and features'
      });
    }

    return warnings;
  }

  private generateRecommendations(systemInfo: SystemInfo): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (systemInfo.cpu.cores < 4) {
      recommendations.push('Consider upgrading to a system with more CPU cores for better build performance');
    }

    if (systemInfo.memory.total < 8 * 1024 * 1024 * 1024) { // Less than 8GB
      recommendations.push('Systems with 8GB+ RAM provide better development experience');
    }

    // Tool recommendations
    const installedManagers = [];
    for (const [name, req] of this.requirements) {
      if (req.type === 'package' && this.validationCache.get(name)?.result) {
        installedManagers.push(name);
      }
    }

    if (installedManagers.length === 0) {
      recommendations.push('Install pnpm or yarn for faster package installation');
    }

    // Platform-specific recommendations
    if (systemInfo.platform === 'win32') {
      recommendations.push('Consider using Windows Terminal for better CLI experience');
      recommendations.push('Enable Developer Mode in Windows settings for symbolic link support');
    }

    if (systemInfo.platform === 'darwin') {
      recommendations.push('Install Homebrew for easier tool management');
    }

    return recommendations;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateReport(validation?: ValidationResult): Promise<string> {
    const result = validation || await this.validate();
    const lines: string[] = [];

    lines.push('# Environment Validation Report');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push(`Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Issues: ${result.issues.length} (${result.issues.filter(i => i.severity === 'error').length} errors)`);
    lines.push(`Warnings: ${result.warnings.length}`);
    lines.push('');

    // System Information
    lines.push('## System Information');
    lines.push(`- Platform: ${result.systemInfo.platform} (${result.systemInfo.arch})`);
    lines.push(`- OS Version: ${result.systemInfo.osVersion}`);
    lines.push(`- Node.js: ${result.systemInfo.nodeVersion}`);
    lines.push(`- npm: ${result.systemInfo.npmVersion}`);
    lines.push(`- CPU: ${result.systemInfo.cpu.model} (${result.systemInfo.cpu.cores} cores)`);
    lines.push(`- Memory: ${this.formatBytes(result.systemInfo.memory.total)} total, ${this.formatBytes(result.systemInfo.memory.free)} free`);
    lines.push(`- Disk: ${this.formatBytes(result.systemInfo.disk.total)} total, ${this.formatBytes(result.systemInfo.disk.free)} free`);
    lines.push(`- Network: ${result.systemInfo.network.online ? 'Online' : 'Offline'}`);
    lines.push('');

    // Issues
    if (result.issues.length > 0) {
      lines.push('## Issues');
      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        lines.push(`${icon} **${issue.requirement}**: ${issue.message}`);
        if (issue.fixCommand) {
          lines.push(`   Fix: \`${issue.fixCommand}\``);
        }
        if (issue.fixUrl) {
          lines.push(`   More info: ${issue.fixUrl}`);
        }
      }
      lines.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      lines.push('## Warnings');
      for (const warning of result.warnings) {
        lines.push(`⚠️  ${warning.message}`);
        if (warning.recommendation) {
          lines.push(`   → ${warning.recommendation}`);
        }
      }
      lines.push('');
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('## Recommendations');
      for (const rec of result.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    // Auto-fix availability
    if (result.autoFixAvailable) {
      lines.push('## Auto-fix Available');
      lines.push('Run `re-shell env setup --auto-fix` to automatically resolve fixable issues.');
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // Public methods for requirement management
  getRequirements(): EnvironmentRequirement[] {
    return Array.from(this.requirements.values());
  }

  getRequirement(name: string): EnvironmentRequirement | undefined {
    return this.requirements.get(name);
  }

  clearCache(): void {
    this.validationCache.clear();
    this.systemInfo = undefined;
  }

  exportRequirements(): string {
    const requirements = this.getRequirements();
    return JSON.stringify(requirements, null, 2);
  }

  importRequirements(json: string): void {
    try {
      const requirements = JSON.parse(json);
      if (Array.isArray(requirements)) {
        this.requirements.clear();
        for (const req of requirements) {
          this.addRequirement(req);
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to import requirements: ${error.message}`);
    }
  }
}

// Global instance
let globalValidator: EnvironmentValidator | null = null;

export function getEnvironmentValidator(): EnvironmentValidator {
  if (!globalValidator) {
    globalValidator = new EnvironmentValidator();
  }
  return globalValidator;
}

export async function validateEnvironment(options?: Partial<SetupOptions>): Promise<ValidationResult> {
  const validator = getEnvironmentValidator();
  return validator.validate(options);
}

export async function setupEnvironment(options?: Partial<SetupOptions>): Promise<SetupResult> {
  const validator = getEnvironmentValidator();
  return validator.setup(options);
}