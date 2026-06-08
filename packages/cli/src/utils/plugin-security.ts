import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { PluginManifest, PluginPermission, PluginRegistration } from './plugin-system';

// Security levels
export enum SecurityLevel {
  TRUSTED = 'trusted',
  VERIFIED = 'verified',
  SANDBOXED = 'sandboxed',
  RESTRICTED = 'restricted',
  BLOCKED = 'blocked'
}

// Security policies
export interface SecurityPolicy {
  allowNetworkAccess: boolean;
  allowFileSystemAccess: boolean;
  allowProcessExecution: boolean;
  allowEnvironmentAccess: boolean;
  allowWorkspaceAccess: boolean;
  maxMemoryUsage: number;
  maxExecutionTime: number;
  trustedSources: string[];
  blockedSources: string[];
  requiredSignatures: boolean;
}

// Security violation types
export interface SecurityViolation {
  type: 'permission' | 'resource' | 'signature' | 'sandbox' | 'malware';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  recommendation: string;
  blocked: boolean;
}

// Security scan result
export interface SecurityScanResult {
  plugin: string;
  securityLevel: SecurityLevel;
  violations: SecurityViolation[];
  permissions: PluginPermission[];
  signature?: SecuritySignature;
  reputation?: PluginReputation;
  sandboxRequired: boolean;
  approved: boolean;
  warnings: string[];
}

// Plugin signature information
export interface SecuritySignature {
  algorithm: string;
  signature: string;
  publicKey: string;
  timestamp: number;
  verified: boolean;
  issuer?: string;
}

// Plugin reputation data
export interface PluginReputation {
  downloads: number;
  rating: number;
  reviews: number;
  lastUpdated: number;
  maintainer: string;
  verified: boolean;
  communityTrust: number;
}

// Sandbox configuration
export interface SandboxConfig {
  isolateFileSystem: boolean;
  isolateNetwork: boolean;
  isolateProcesses: boolean;
  memoryLimit: number;
  timeoutLimit: number;
  allowedPaths: string[];
  blockedPaths: string[];
  allowedNetworks: string[];
  blockedNetworks: string[];
}

// Plugin security validator
export class PluginSecurityValidator extends EventEmitter {
  private securityPolicy: SecurityPolicy;
  private trustedPublicKeys: Set<string> = new Set();
  private pluginReputations: Map<string, PluginReputation> = new Map();
  private securityCache: Map<string, SecurityScanResult> = new Map();

  constructor(policy: Partial<SecurityPolicy> = {}) {
    super();
    this.securityPolicy = {
      allowNetworkAccess: false,
      allowFileSystemAccess: true,
      allowProcessExecution: false,
      allowEnvironmentAccess: false,
      allowWorkspaceAccess: true,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxExecutionTime: 30000, // 30 seconds
      trustedSources: ['npm', 'builtin'],
      blockedSources: [],
      requiredSignatures: false,
      ...policy
    };
  }

  // Perform comprehensive security scan
  async scanPlugin(registration: PluginRegistration): Promise<SecurityScanResult> {
    const cacheKey = this.getCacheKey(registration);
    
    // Check cache
    if (this.securityCache.has(cacheKey)) {
      const cached = this.securityCache.get(cacheKey)!;
      this.emit('security-scan-cached', registration.manifest.name);
      return cached;
    }

    this.emit('security-scan-started', registration.manifest.name);
    const startTime = Date.now();

    try {
      const result: SecurityScanResult = {
        plugin: registration.manifest.name,
        securityLevel: SecurityLevel.SANDBOXED,
        violations: [],
        permissions: registration.manifest.reshell?.permissions || [],
        sandboxRequired: true,
        approved: false,
        warnings: []
      };

      // 1. Validate permissions
      await this.validatePermissions(registration, result);

      // 2. Scan for malicious code
      await this.scanForMaliciousCode(registration, result);

      // 3. Verify signatures
      await this.verifySignature(registration, result);

      // 4. Check reputation
      await this.checkReputation(registration, result);

      // 5. Analyze source trust
      await this.analyzeSourceTrust(registration, result);

      // 6. Determine security level
      this.determineSecurityLevel(result);

      // 7. Generate recommendations
      this.generateSecurityRecommendations(result);

      // Cache result
      this.securityCache.set(cacheKey, result);

      const duration = Date.now() - startTime;
      this.emit('security-scan-completed', {
        plugin: registration.manifest.name,
        securityLevel: result.securityLevel,
        violations: result.violations.length,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('security-scan-failed', {
        plugin: registration.manifest.name,
        error,
        duration
      });
      throw error;
    }
  }

  // Validate plugin permissions
  private async validatePermissions(
    registration: PluginRegistration,
    result: SecurityScanResult
  ): Promise<void> {
    const permissions = registration.manifest.reshell?.permissions || [];

    for (const permission of permissions) {
      const violation = this.checkPermissionViolation(permission);
      if (violation) {
        result.violations.push(violation);
      }
    }

    // Check for excessive permissions
    if (permissions.length > 10) {
      result.violations.push({
        type: 'permission',
        severity: 'medium',
        description: 'Plugin requests excessive permissions',
        source: 'permission-validator',
        recommendation: 'Review and reduce permission scope',
        blocked: false
      });
    }

    // Check for dangerous permission combinations
    const hasFileSystem = permissions.some(p => p.type === 'filesystem' && p.access === 'full');
    const hasNetwork = permissions.some(p => p.type === 'network');
    const hasProcess = permissions.some(p => p.type === 'process');

    if (hasFileSystem && hasNetwork && hasProcess) {
      result.violations.push({
        type: 'permission',
        severity: 'high',
        description: 'Plugin requests dangerous permission combination (filesystem + network + process)',
        source: 'permission-validator',
        recommendation: 'Consider sandboxing or restricting permissions',
        blocked: true
      });
    }
  }

  // Check individual permission violation
  private checkPermissionViolation(permission: PluginPermission): SecurityViolation | null {
    // Check against security policy
    switch (permission.type) {
      case 'network':
        if (!this.securityPolicy.allowNetworkAccess) {
          return {
            type: 'permission',
            severity: 'high',
            description: `Network access not allowed: ${permission.description}`,
            source: 'permission-policy',
            recommendation: 'Remove network permission or enable network access',
            blocked: true
          };
        }
        break;

      case 'process':
        if (!this.securityPolicy.allowProcessExecution) {
          return {
            type: 'permission',
            severity: 'high',
            description: `Process execution not allowed: ${permission.description}`,
            source: 'permission-policy',
            recommendation: 'Remove process permission or enable process execution',
            blocked: true
          };
        }
        break;

      case 'filesystem':
        if (!this.securityPolicy.allowFileSystemAccess && permission.access !== 'read') {
          return {
            type: 'permission',
            severity: 'medium',
            description: `File system write access not allowed: ${permission.description}`,
            source: 'permission-policy',
            recommendation: 'Restrict to read-only access or enable filesystem writes',
            blocked: false
          };
        }
        break;

      case 'environment':
        if (!this.securityPolicy.allowEnvironmentAccess) {
          return {
            type: 'permission',
            severity: 'medium',
            description: `Environment access not allowed: ${permission.description}`,
            source: 'permission-policy',
            recommendation: 'Remove environment permission or enable environment access',
            blocked: false
          };
        }
        break;
    }

    return null;
  }

  // Scan for malicious code patterns
  private async scanForMaliciousCode(
    registration: PluginRegistration,
    result: SecurityScanResult
  ): Promise<void> {
    try {
      const mainFile = path.join(registration.pluginPath, registration.manifest.main);
      
      if (!await fs.pathExists(mainFile)) {
        result.violations.push({
          type: 'malware',
          severity: 'medium',
          description: 'Main plugin file not found',
          source: 'malware-scanner',
          recommendation: 'Verify plugin integrity',
          blocked: false
        });
        return;
      }

      const fileContent = await fs.readFile(mainFile, 'utf8');
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        { pattern: /eval\s*\(/g, severity: 'high' as const, description: 'Uses eval() - potential code injection' },
        { pattern: /Function\s*\(/g, severity: 'medium' as const, description: 'Uses Function constructor - potential code injection' },
        { pattern: /child_process|spawn|exec/g, severity: 'high' as const, description: 'Executes system processes' },
        { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/g, severity: 'medium' as const, description: 'Direct filesystem access' },
        { pattern: /require\s*\(\s*['"`]http['"`]\s*\)|require\s*\(\s*['"`]https['"`]\s*\)/g, severity: 'medium' as const, description: 'Network access capabilities' },
        { pattern: /\.\.\/|\.\.\\|\.\.\//g, severity: 'medium' as const, description: 'Path traversal attempt' },
        { pattern: /document\.cookie|localStorage|sessionStorage/g, severity: 'low' as const, description: 'Browser storage access' },
        { pattern: /XMLHttpRequest|fetch\(/g, severity: 'low' as const, description: 'HTTP requests' }
      ];

      for (const { pattern, severity, description } of suspiciousPatterns) {
        const matches = fileContent.match(pattern);
        if (matches) {
          result.violations.push({
            type: 'malware',
            severity,
            description: `${description} (${matches.length} occurrences)`,
            source: 'malware-scanner',
            recommendation: severity === 'high' ? 'Block plugin execution' : 'Review code carefully',
            blocked: severity === 'high'
          });
        }
      }

      // Check file size (very large files might be suspicious)
      const stats = await fs.stat(mainFile);
      if (stats.size > 10 * 1024 * 1024) { // 10MB
        result.violations.push({
          type: 'malware',
          severity: 'medium',
          description: `Unusually large plugin file (${Math.round(stats.size / 1024 / 1024)}MB)`,
          source: 'malware-scanner',
          recommendation: 'Verify plugin legitimacy',
          blocked: false
        });
      }

      // Check for minified/obfuscated code
      const minifiedIndicators = [
        fileContent.length > 1000 && fileContent.split('\n').length < 10, // Long lines
        /[a-zA-Z0-9]{50,}/.test(fileContent), // Very long identifiers
        fileContent.includes('\\x') && fileContent.includes('\\u') // Hex/unicode escapes
      ];

      if (minifiedIndicators.some(Boolean)) {
        result.violations.push({
          type: 'malware',
          severity: 'medium',
          description: 'Plugin code appears to be minified or obfuscated',
          source: 'malware-scanner',
          recommendation: 'Review source code for transparency',
          blocked: false
        });
      }

    } catch (error) {
      result.warnings.push(`Could not scan plugin file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Verify plugin signature
  private async verifySignature(
    registration: PluginRegistration,
    result: SecurityScanResult
  ): Promise<void> {
    // Look for signature file
    const signatureFile = path.join(registration.pluginPath, 'SIGNATURE');
    
    if (!await fs.pathExists(signatureFile)) {
      if (this.securityPolicy.requiredSignatures) {
        result.violations.push({
          type: 'signature',
          severity: 'high',
          description: 'Plugin signature required but not found',
          source: 'signature-validator',
          recommendation: 'Sign the plugin or disable signature requirement',
          blocked: true
        });
      }
      return;
    }

    try {
      const signatureData = await fs.readJSON(signatureFile);
      
      result.signature = {
        algorithm: signatureData.algorithm,
        signature: signatureData.signature,
        publicKey: signatureData.publicKey,
        timestamp: signatureData.timestamp,
        verified: false,
        issuer: signatureData.issuer
      };

      // Verify signature (simplified - in real implementation would use proper crypto)
      if (this.trustedPublicKeys.has(signatureData.publicKey)) {
        result.signature.verified = true;
      } else {
        result.violations.push({
          type: 'signature',
          severity: 'medium',
          description: 'Plugin signature not from trusted source',
          source: 'signature-validator',
          recommendation: 'Verify signature issuer identity',
          blocked: false
        });
      }

    } catch (error) {
      result.violations.push({
        type: 'signature',
        severity: 'medium',
        description: 'Invalid signature format',
        source: 'signature-validator',
        recommendation: 'Provide valid signature file',
        blocked: false
      });
    }
  }

  // Check plugin reputation
  private async checkReputation(
    registration: PluginRegistration,
    result: SecurityScanResult
  ): Promise<void> {
    const reputation = this.pluginReputations.get(registration.manifest.name);
    
    if (reputation) {
      result.reputation = reputation;

      // Low reputation checks
      if (reputation.rating < 2.0) {
        result.violations.push({
          type: 'permission',
          severity: 'medium',
          description: `Low community rating: ${reputation.rating}/5.0`,
          source: 'reputation-checker',
          recommendation: 'Consider alternative plugins',
          blocked: false
        });
      }

      if (reputation.downloads < 100) {
        result.violations.push({
          type: 'permission',
          severity: 'low',
          description: `Low download count: ${reputation.downloads}`,
          source: 'reputation-checker',
          recommendation: 'Exercise caution with new plugins',
          blocked: false
        });
      }

      // Check if recently updated
      const daysSinceUpdate = (Date.now() - reputation.lastUpdated) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 365) {
        result.violations.push({
          type: 'permission',
          severity: 'low',
          description: `Plugin not updated in ${Math.round(daysSinceUpdate)} days`,
          source: 'reputation-checker',
          recommendation: 'Verify plugin is still maintained',
          blocked: false
        });
      }
    } else {
      result.warnings.push('No reputation data available for plugin');
    }
  }

  // Analyze source trust
  private async analyzeSourceTrust(
    registration: PluginRegistration,
    result: SecurityScanResult
  ): Promise<void> {
    // Determine plugin source
    const source = this.determinePluginSource(registration);

    if (this.securityPolicy.blockedSources.includes(source)) {
      result.violations.push({
        type: 'permission',
        severity: 'critical',
        description: `Plugin from blocked source: ${source}`,
        source: 'source-validator',
        recommendation: 'Remove plugin or allow source',
        blocked: true
      });
    }

    if (!this.securityPolicy.trustedSources.includes(source)) {
      result.violations.push({
        type: 'permission',
        severity: 'medium',
        description: `Plugin from untrusted source: ${source}`,
        source: 'source-validator',
        recommendation: 'Verify source legitimacy',
        blocked: false
      });
    }
  }

  // Determine plugin source type
  private determinePluginSource(registration: PluginRegistration): string {
    const pluginPath = registration.pluginPath;
    
    if (pluginPath.includes('node_modules')) {
      return 'npm';
    } else if (pluginPath.includes('.re-shell/plugins')) {
      return 'local';
    } else if (pluginPath.includes('/plugins')) {
      return 'builtin';
    } else {
      return 'unknown';
    }
  }

  // Determine overall security level
  private determineSecurityLevel(result: SecurityScanResult): void {
    const criticalViolations = result.violations.filter(v => v.severity === 'critical');
    const highViolations = result.violations.filter(v => v.severity === 'high');
    const blockedViolations = result.violations.filter(v => v.blocked);

    if (criticalViolations.length > 0 || blockedViolations.length > 0) {
      result.securityLevel = SecurityLevel.BLOCKED;
      result.approved = false;
    } else if (highViolations.length > 0) {
      result.securityLevel = SecurityLevel.RESTRICTED;
      result.approved = false;
      result.sandboxRequired = true;
    } else if (result.violations.length > 0) {
      result.securityLevel = SecurityLevel.SANDBOXED;
      result.approved = true;
      result.sandboxRequired = true;
    } else if (result.signature?.verified && result.reputation?.verified) {
      result.securityLevel = SecurityLevel.TRUSTED;
      result.approved = true;
      result.sandboxRequired = false;
    } else {
      result.securityLevel = SecurityLevel.VERIFIED;
      result.approved = true;
      result.sandboxRequired = false;
    }
  }

  // Generate security recommendations
  private generateSecurityRecommendations(result: SecurityScanResult): void {
    if (result.violations.length === 0) {
      result.warnings.push('Plugin passed all security checks');
      return;
    }

    const recommendations = new Set<string>();

    result.violations.forEach(violation => {
      recommendations.add(violation.recommendation);
    });

    if (result.sandboxRequired) {
      recommendations.add('Run plugin in sandboxed environment');
    }

    if (result.violations.some(v => v.severity === 'high' || v.severity === 'critical')) {
      recommendations.add('Consider blocking plugin execution');
    }

    result.warnings.push(...Array.from(recommendations));
  }

  // Create sandbox configuration
  createSandboxConfig(
    registration: PluginRegistration,
    securityResult: SecurityScanResult
  ): SandboxConfig {
    const baseConfig: SandboxConfig = {
      isolateFileSystem: true,
      isolateNetwork: true,
      isolateProcesses: true,
      memoryLimit: this.securityPolicy.maxMemoryUsage,
      timeoutLimit: this.securityPolicy.maxExecutionTime,
      allowedPaths: [
        registration.pluginPath,
        path.join(process.cwd(), '.re-shell', 'data', registration.manifest.name),
        path.join(process.cwd(), '.re-shell', 'cache', registration.manifest.name)
      ],
      blockedPaths: [
        path.join(process.cwd(), '.re-shell', 'config.yaml'),
        '/etc',
        '/usr/bin',
        '/System'
      ],
      allowedNetworks: [],
      blockedNetworks: ['127.0.0.1', 'localhost']
    };

    // Adjust based on permissions
    const permissions = registration.manifest.reshell?.permissions || [];
    
    permissions.forEach(permission => {
      switch (permission.type) {
        case 'filesystem':
          if (permission.access === 'read') {
            baseConfig.isolateFileSystem = false;
          }
          if (permission.resource) {
            baseConfig.allowedPaths.push(permission.resource);
          }
          break;

        case 'network':
          baseConfig.isolateNetwork = false;
          if (permission.resource) {
            baseConfig.allowedNetworks.push(permission.resource);
          }
          break;

        case 'process':
          if (permission.access === 'read') {
            baseConfig.isolateProcesses = false;
          }
          break;
      }
    });

    // Adjust based on security level
    switch (securityResult.securityLevel) {
      case SecurityLevel.TRUSTED:
        baseConfig.isolateFileSystem = false;
        baseConfig.isolateNetwork = false;
        break;

      case SecurityLevel.VERIFIED:
        baseConfig.isolateNetwork = false;
        break;

      case SecurityLevel.RESTRICTED:
        baseConfig.memoryLimit = Math.min(baseConfig.memoryLimit, 256 * 1024 * 1024); // 256MB
        baseConfig.timeoutLimit = Math.min(baseConfig.timeoutLimit, 10000); // 10 seconds
        break;
    }

    return baseConfig;
  }

  // Add trusted public key
  addTrustedPublicKey(publicKey: string): void {
    this.trustedPublicKeys.add(publicKey);
    this.clearCache();
  }

  // Update plugin reputation
  updatePluginReputation(pluginName: string, reputation: PluginReputation): void {
    this.pluginReputations.set(pluginName, reputation);
    this.clearCache();
  }

  // Clear security cache
  clearCache(): void {
    this.securityCache.clear();
    this.emit('cache-cleared');
  }

  // Get cache key
  private getCacheKey(registration: PluginRegistration): string {
    const contentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(registration.manifest))
      .update(registration.pluginPath)
      .digest('hex');
    
    return `${registration.manifest.name}_${registration.manifest.version}_${contentHash}`;
  }

  // Get security statistics
  getSecurityStats(): any {
    const stats = {
      totalScans: this.securityCache.size,
      trustedKeys: this.trustedPublicKeys.size,
      reputationData: this.pluginReputations.size,
      securityLevels: {} as Record<string, number>,
      violationTypes: {} as Record<string, number>
    };

    for (const result of this.securityCache.values()) {
      stats.securityLevels[result.securityLevel] = 
        (stats.securityLevels[result.securityLevel] || 0) + 1;

      result.violations.forEach(violation => {
        stats.violationTypes[violation.type] = 
          (stats.violationTypes[violation.type] || 0) + 1;
      });
    }

    return stats;
  }
}

// Plugin sandbox executor
export class PluginSandbox extends EventEmitter {
  private config: SandboxConfig;
  private activeProcesses: Map<string, any> = new Map();

  constructor(config: SandboxConfig) {
    super();
    this.config = config;
  }

  // Execute plugin in sandbox
  async executeInSandbox(
    pluginFunction: (...args: any[]) => any,
    context: any,
    timeout?: number
  ): Promise<any> {
    const executionTimeout = timeout || this.config.timeoutLimit;
    const startTime = Date.now();

    this.emit('sandbox-execution-started', {
      timeout: executionTimeout,
      memoryLimit: this.config.memoryLimit
    });

    try {
      // Create isolated context
      const sandboxedContext = this.createSandboxedContext(context);

      // Execute with timeout
      const result = await Promise.race([
        Promise.resolve(pluginFunction(sandboxedContext)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Plugin execution timeout')), executionTimeout)
        )
      ]);

      const duration = Date.now() - startTime;
      this.emit('sandbox-execution-completed', {
        duration,
        memoryUsed: process.memoryUsage().heapUsed
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('sandbox-execution-failed', {
        duration,
        error
      });
      throw error;
    }
  }

  // Create sandboxed context
  private createSandboxedContext(originalContext: any): any {
    const sandboxedContext = { ...originalContext };

    // Override dangerous functions
    if (this.config.isolateFileSystem) {
      sandboxedContext.fs = this.createSandboxedFS();
    }

    if (this.config.isolateNetwork) {
      sandboxedContext.http = null;
      sandboxedContext.https = null;
      sandboxedContext.fetch = null;
    }

    if (this.config.isolateProcesses) {
      sandboxedContext.child_process = null;
      sandboxedContext.process = this.createSandboxedProcess();
    }

    return sandboxedContext;
  }

  // Create sandboxed filesystem interface
  private createSandboxedFS(): any {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const originalFS = require('fs-extra');
    const sandboxedFS = { ...originalFS };

    // Override write operations
    const writeOperations = ['writeFile', 'writeFileSync', 'writeJSON', 'writeJSONSync', 'remove', 'removeSync'];
    
    writeOperations.forEach(operation => {
      sandboxedFS[operation] = (filePath: string, ...args: any[]) => {
        if (!this.isPathAllowed(filePath)) {
          throw new Error(`Filesystem access denied: ${filePath}`);
        }
        return originalFS[operation](filePath, ...args);
      };
    });

    return sandboxedFS;
  }

  // Create sandboxed process interface
  private createSandboxedProcess(): any {
    return {
      env: {},
      cwd: () => this.config.allowedPaths[0] || process.cwd(),
      exit: () => { throw new Error('Process exit blocked in sandbox'); },
      kill: () => { throw new Error('Process kill blocked in sandbox'); }
    };
  }

  // Check if path is allowed
  private isPathAllowed(filePath: string): boolean {
    const normalizedPath = path.resolve(filePath);
    
    // Check blocked paths
    for (const blockedPath of this.config.blockedPaths) {
      if (normalizedPath.startsWith(path.resolve(blockedPath))) {
        return false;
      }
    }

    // Check allowed paths
    for (const allowedPath of this.config.allowedPaths) {
      if (normalizedPath.startsWith(path.resolve(allowedPath))) {
        return true;
      }
    }

    return false;
  }

  // Monitor resource usage
  monitorResourceUsage(): void {
    const interval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      
      if (memoryUsage.heapUsed > this.config.memoryLimit) {
        this.emit('memory-limit-exceeded', {
          current: memoryUsage.heapUsed,
          limit: this.config.memoryLimit
        });
      }
    }, 1000);

    // Clean up interval
    setTimeout(() => clearInterval(interval), this.config.timeoutLimit);
  }
}

// Utility functions
export function createSecurityValidator(policy?: Partial<SecurityPolicy>): PluginSecurityValidator {
  return new PluginSecurityValidator(policy);
}

export function createPluginSandbox(config: SandboxConfig): PluginSandbox {
  return new PluginSandbox(config);
}

export function getDefaultSecurityPolicy(): SecurityPolicy {
  return {
    allowNetworkAccess: false,
    allowFileSystemAccess: true,
    allowProcessExecution: false,
    allowEnvironmentAccess: false,
    allowWorkspaceAccess: true,
    maxMemoryUsage: 512 * 1024 * 1024,
    maxExecutionTime: 30000,
    trustedSources: ['npm', 'builtin'],
    blockedSources: [],
    requiredSignatures: false
  };
}