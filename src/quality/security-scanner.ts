import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import glob from 'fast-glob';

export interface SecurityScanConfig {
  scanners?: SecurityScannerConfig[];
  vulnerabilityDatabase?: VulnerabilityDatabase;
  customRules?: SecurityRule[];
  thresholds?: SecurityThresholds;
  includePatterns?: string[];
  excludePatterns?: string[];
  generateReport?: boolean;
  outputPath?: string;
  integrations?: SecurityIntegration[];
}

export interface SecurityScannerConfig {
  name: 'npm-audit' | 'snyk' | 'semgrep' | 'bandit' | 'eslint-security' | 'custom';
  config?: any;
  enabled?: boolean;
  severity?: SecuritySeverity[];
}

export interface VulnerabilityDatabase {
  source: 'nvd' | 'snyk' | 'github' | 'custom';
  updateInterval?: number;
  customFeed?: string;
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  cwe?: string;
  owasp?: string;
  pattern?: RegExp;
  check: (file: FileContent) => SecurityViolation[];
  remediation?: string;
}

export interface SecurityThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface SecurityIntegration {
  type: 'github' | 'slack' | 'jira' | 'email' | 'webhook';
  config: any;
  events: SecurityEvent[];
}

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SecurityCategory = 'injection' | 'authentication' | 'authorization' | 'cryptography' | 
  'configuration' | 'sensitive-data' | 'dependency' | 'xss' | 'csrf' | 'xxe' | 'deserialization' | 'other';
export type SecurityEvent = 'vulnerability-found' | 'threshold-exceeded' | 'scan-complete' | 'critical-issue';

export interface FileContent {
  path: string;
  content: string;
  type: 'source' | 'config' | 'dependency' | 'build' | 'other';
  language?: string;
}

export interface SecurityViolation {
  line: number;
  column?: number;
  message: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  cwe?: string;
  owasp?: string;
  evidence?: string;
  remediation?: string;
}

export interface SecurityVulnerability {
  id: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  cwe?: string;
  cvss?: CVSSScore;
  affected: AffectedComponent[];
  discovered: Date;
  source: string;
  references: string[];
  remediation: RemediationAdvice;
}

export interface CVSSScore {
  version: '2.0' | '3.0' | '3.1';
  score: number;
  vector: string;
  impact: number;
  exploitability: number;
}

export interface AffectedComponent {
  type: 'dependency' | 'code' | 'configuration';
  name: string;
  version?: string;
  path?: string;
  fixedVersion?: string;
}

export interface RemediationAdvice {
  priority: 'immediate' | 'high' | 'medium' | 'low';
  effort: string;
  steps: string[];
  alternativeApproaches?: string[];
  automatedFix?: boolean;
}

export interface SecurityScanResult {
  projectPath: string;
  timestamp: Date;
  summary: SecuritySummary;
  vulnerabilities: SecurityVulnerability[];
  dependencies: DependencyAnalysis;
  codeAnalysis: CodeSecurityAnalysis;
  configurationAnalysis: ConfigurationAnalysis;
  scanners: ScannerResult[];
  metrics: SecurityMetrics;
  trends?: SecurityTrend[];
}

export interface SecuritySummary {
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  riskScore: number;
  complianceScore: number;
  recommendations: string[];
}

export interface DependencyAnalysis {
  totalDependencies: number;
  vulnerableDependencies: number;
  outdatedDependencies: number;
  licenseIssues: LicenseIssue[];
  dependencyTree: DependencyNode[];
  recommendations: DependencyRecommendation[];
}

export interface LicenseIssue {
  dependency: string;
  version: string;
  license: string;
  risk: 'high' | 'medium' | 'low';
  reason: string;
}

export interface DependencyNode {
  name: string;
  version: string;
  vulnerabilities: number;
  children: DependencyNode[];
}

export interface DependencyRecommendation {
  dependency: string;
  currentVersion: string;
  recommendedVersion: string;
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export interface CodeSecurityAnalysis {
  totalFiles: number;
  vulnerableFiles: number;
  patterns: SecurityPattern[];
  hotspots: SecurityHotspot[];
  recommendations: string[];
}

export interface SecurityPattern {
  pattern: string;
  category: SecurityCategory;
  occurrences: number;
  files: string[];
  severity: SecuritySeverity;
}

export interface SecurityHotspot {
  file: string;
  line: number;
  function?: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  description: string;
  remediation: string;
}

export interface ConfigurationAnalysis {
  files: ConfigFile[];
  issues: ConfigurationIssue[];
  recommendations: string[];
}

export interface ConfigFile {
  path: string;
  type: 'package.json' | 'dockerfile' | 'nginx' | 'env' | 'ci' | 'other';
  issues: ConfigurationIssue[];
  securityScore: number;
}

export interface ConfigurationIssue {
  file: string;
  line?: number;
  setting: string;
  issue: string;
  severity: SecuritySeverity;
  remediation: string;
}

export interface ScannerResult {
  scanner: string;
  success: boolean;
  duration: number;
  vulnerabilities: number;
  errors?: string[];
  rawOutput?: string;
}

export interface SecurityMetrics {
  riskDistribution: Record<SecuritySeverity, number>;
  categoryDistribution: Record<SecurityCategory, number>;
  coverageMetrics: SecurityCoverage;
  complianceMetrics: ComplianceMetrics;
}

export interface SecurityCoverage {
  codeScanned: number;
  dependenciesScanned: number;
  configurationScanned: number;
  totalCoverage: number;
}

export interface ComplianceMetrics {
  owasp: OWASPCompliance;
  cwe: CWECompliance;
  pci: boolean;
  hipaa: boolean;
  gdpr: boolean;
}

export interface OWASPCompliance {
  top10Coverage: number;
  issuesFound: Array<{ category: string; count: number }>;
}

export interface CWECompliance {
  top25Coverage: number;
  issuesFound: Array<{ cwe: string; count: number }>;
}

export interface SecurityTrend {
  date: Date;
  vulnerabilities: number;
  riskScore: number;
  newVulnerabilities: number;
  fixedVulnerabilities: number;
}

export interface SecurityReport {
  summary: SecurityReportSummary;
  scan: SecurityScanResult;
  actionPlan: SecurityActionItem[];
  compliance: ComplianceReport;
  trends: SecurityTrendAnalysis;
  timestamp: Date;
}

export interface SecurityReportSummary {
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  totalVulnerabilities: number;
  criticalIssues: number;
  complianceScore: number;
  trend: 'improving' | 'degrading' | 'stable';
  lastScan: Date;
}

export interface SecurityActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: SecurityCategory;
  title: string;
  description: string;
  effort: string;
  impact: string;
  vulnerabilities: string[];
  automatedFix: boolean;
}

export interface ComplianceReport {
  frameworks: ComplianceFramework[];
  overallScore: number;
  gaps: ComplianceGap[];
}

export interface ComplianceFramework {
  name: string;
  score: number;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  status: 'compliant' | 'non-compliant' | 'partial';
  issues: string[];
}

export interface ComplianceGap {
  framework: string;
  requirement: string;
  severity: SecuritySeverity;
  description: string;
  remediation: string;
}

export interface SecurityTrendAnalysis {
  historical: SecurityTrend[];
  predictions: SecurityPrediction[];
  patterns: SecurityTrendPattern[];
}

export interface SecurityPrediction {
  date: Date;
  predictedVulnerabilities: number;
  confidence: number;
  factors: string[];
}

export interface SecurityTrendPattern {
  pattern: string;
  frequency: number;
  impact: SecuritySeverity;
  description: string;
}

export class SecurityScanner extends EventEmitter {
  private config: SecurityScanConfig;

  constructor(config: SecurityScanConfig) {
    super();
    this.config = {
      scanners: [
        { name: 'npm-audit', enabled: true },
        { name: 'eslint-security', enabled: true }
      ],
      generateReport: true,
      outputPath: './security-reports',
      includePatterns: ['**/*.{js,ts,jsx,tsx,json,yml,yaml,dockerfile}'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
      thresholds: {
        critical: 0,
        high: 0,
        medium: 5,
        low: 10,
        total: 20
      },
      ...config
    };
  }

  async scan(projectPath: string): Promise<SecurityScanResult> {
    this.emit('scan:start', { project: projectPath });

    const result: SecurityScanResult = {
      projectPath,
      timestamp: new Date(),
      summary: this.createEmptySummary(),
      vulnerabilities: [],
      dependencies: this.createEmptyDependencyAnalysis(),
      codeAnalysis: this.createEmptyCodeAnalysis(),
      configurationAnalysis: this.createEmptyConfigAnalysis(),
      scanners: [],
      metrics: this.createEmptyMetrics()
    };

    try {
      // Run dependency analysis
      result.dependencies = await this.analyzeDependencies(projectPath);

      // Run code security analysis
      result.codeAnalysis = await this.analyzeCode(projectPath);

      // Run configuration analysis
      result.configurationAnalysis = await this.analyzeConfiguration(projectPath);

      // Run external scanners
      for (const scanner of this.config.scanners.filter(s => s.enabled)) {
        const scannerResult = await this.runScanner(scanner, projectPath);
        result.scanners.push(scannerResult);
      }

      // Aggregate vulnerabilities
      result.vulnerabilities = await this.aggregateVulnerabilities(result);

      // Calculate metrics
      result.metrics = this.calculateSecurityMetrics(result);
      result.summary = this.generateSummary(result);

      // Calculate trends if historical data exists
      result.trends = await this.calculateTrends(result);

      this.emit('scan:complete', result);
      return result;

    } catch (error: any) {
      this.emit('scan:error', error);
      throw error;
    }
  }

  private async analyzeDependencies(projectPath: string): Promise<DependencyAnalysis> {
    this.emit('analyze:dependencies:start');

    const analysis: DependencyAnalysis = {
      totalDependencies: 0,
      vulnerableDependencies: 0,
      outdatedDependencies: 0,
      licenseIssues: [],
      dependencyTree: [],
      recommendations: []
    };

    try {
      // Read package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        const deps = {
          ...packageJson.dependencies || {},
          ...packageJson.devDependencies || {}
        };

        analysis.totalDependencies = Object.keys(deps).length;

        // Run npm audit
        try {
          const auditOutput = execSync('npm audit --json', {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: 'pipe'
          });

          const auditData = JSON.parse(auditOutput);
          analysis.vulnerableDependencies = Object.keys(auditData.vulnerabilities || {}).length;

          // Process vulnerabilities
          for (const [name, vuln] of Object.entries(auditData.vulnerabilities || {})) {
            const vulnData = vuln as any;
            if (vulnData.severity === 'high' || vulnData.severity === 'critical') {
              analysis.recommendations.push({
                dependency: name,
                currentVersion: vulnData.range || 'unknown',
                recommendedVersion: vulnData.fixAvailable?.name || 'latest',
                reason: `Security vulnerability: ${vulnData.title}`,
                urgency: vulnData.severity === 'critical' ? 'critical' : 'high'
              });
            }
          }

        } catch (auditError) {
          this.emit('audit:error', auditError);
        }

        // Check for outdated dependencies
        try {
          const outdatedOutput = execSync('npm outdated --json', {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: 'pipe'
          });

          const outdatedData = JSON.parse(outdatedOutput);
          analysis.outdatedDependencies = Object.keys(outdatedData).length;

        } catch (outdatedError) {
          // npm outdated returns non-zero exit code when outdated packages found
          if (outdatedError.stdout) {
            try {
              const outdatedData = JSON.parse(outdatedError.stdout);
              analysis.outdatedDependencies = Object.keys(outdatedData).length;
            } catch {
              // Ignore parsing errors
            }
          }
        }

        // Analyze licenses
        analysis.licenseIssues = await this.analyzeLicenses(deps);
      }

    } catch (error: any) {
      this.emit('dependencies:error', error);
    }

    return analysis;
  }

  private async analyzeLicenses(dependencies: Record<string, string>): Promise<LicenseIssue[]> {
    const issues: LicenseIssue[] = [];
    
    // Define problematic licenses
    const problematicLicenses = [
      'GPL-2.0', 'GPL-3.0', 'AGPL-1.0', 'AGPL-3.0',
      'CPAL-1.0', 'EPL-1.0', 'EPL-2.0'
    ];

    // This would typically integrate with a license checking service
    // For now, we'll use a simplified approach
    for (const [name, version] of Object.entries(dependencies)) {
      // Mock license checking
      const mockLicense = Math.random() > 0.95 ? 'GPL-3.0' : 'MIT';
      
      if (problematicLicenses.includes(mockLicense)) {
        issues.push({
          dependency: name,
          version,
          license: mockLicense,
          risk: 'high',
          reason: 'Copyleft license may require code disclosure'
        });
      }
    }

    return issues;
  }

  private async analyzeCode(projectPath: string): Promise<CodeSecurityAnalysis> {
    this.emit('analyze:code:start');

    const analysis: CodeSecurityAnalysis = {
      totalFiles: 0,
      vulnerableFiles: 0,
      patterns: [],
      hotspots: [],
      recommendations: []
    };

    try {
      // Find source files
      const files = await glob(this.config.includePatterns!, {
        cwd: projectPath,
        absolute: true,
        ignore: this.config.excludePatterns
      });

      analysis.totalFiles = files.length;

      // Analyze each file
      for (const file of files) {
        const fileAnalysis = await this.analyzeSourceFile(file);
        
        if (fileAnalysis.vulnerabilities.length > 0) {
          analysis.vulnerableFiles++;
          
          for (const vuln of fileAnalysis.vulnerabilities) {
            analysis.hotspots.push({
              file: path.relative(projectPath, file),
              line: vuln.line,
              category: vuln.category,
              severity: vuln.severity,
              description: vuln.message,
              remediation: vuln.remediation || 'Review and fix security issue'
            });
          }
        }
      }

      // Identify common patterns
      analysis.patterns = this.identifySecurityPatterns(analysis.hotspots);
      analysis.recommendations = this.generateCodeRecommendations(analysis);

    } catch (error: any) {
      this.emit('code:error', error);
    }

    return analysis;
  }

  private async analyzeSourceFile(filePath: string): Promise<{ vulnerabilities: SecurityViolation[] }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const vulnerabilities: SecurityViolation[] = [];

    // Apply built-in security rules
    const builtInRules = this.getBuiltInSecurityRules();
    
    for (const rule of builtInRules) {
      const fileContent: FileContent = {
        path: filePath,
        content,
        type: this.getFileType(filePath),
        language: this.getLanguage(filePath)
      };

      const violations = rule.check(fileContent);
      vulnerabilities.push(...violations);
    }

    // Apply custom rules
    if (this.config.customRules) {
      for (const rule of this.config.customRules) {
        const fileContent: FileContent = {
          path: filePath,
          content,
          type: this.getFileType(filePath),
          language: this.getLanguage(filePath)
        };

        const violations = rule.check(fileContent);
        vulnerabilities.push(...violations);
      }
    }

    return { vulnerabilities };
  }

  private getBuiltInSecurityRules(): SecurityRule[] {
    return [
      {
        id: 'hardcoded-password',
        name: 'Hardcoded Password',
        description: 'Detects hardcoded passwords in source code',
        severity: 'high',
        category: 'authentication',
        cwe: 'CWE-798',
        pattern: /password\s*[=:]\s*["'][^"']+["']/i,
        check: (file) => {
          const violations: SecurityViolation[] = [];
          const lines = file.content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/password\s*[=:]\s*["'][^"']+["']/i.test(line)) {
              violations.push({
                line: i + 1,
                message: 'Hardcoded password detected',
                severity: 'high',
                category: 'authentication',
                cwe: 'CWE-798',
                evidence: line.trim(),
                remediation: 'Use environment variables or secure configuration for passwords'
              });
            }
          }
          
          return violations;
        },
        remediation: 'Use environment variables or secure configuration management'
      },
      {
        id: 'sql-injection',
        name: 'SQL Injection',
        description: 'Detects potential SQL injection vulnerabilities',
        severity: 'critical',
        category: 'injection',
        cwe: 'CWE-89',
        check: (file) => {
          const violations: SecurityViolation[] = [];
          const lines = file.content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for string concatenation in SQL queries
            if (/(?:SELECT|INSERT|UPDATE|DELETE).*\+.*\$\{/i.test(line)) {
              violations.push({
                line: i + 1,
                message: 'Potential SQL injection vulnerability',
                severity: 'critical',
                category: 'injection',
                cwe: 'CWE-89',
                evidence: line.trim(),
                remediation: 'Use parameterized queries or prepared statements'
              });
            }
          }
          
          return violations;
        },
        remediation: 'Use parameterized queries, prepared statements, or ORM frameworks'
      },
      {
        id: 'xss-vulnerability',
        name: 'Cross-Site Scripting (XSS)',
        description: 'Detects potential XSS vulnerabilities',
        severity: 'high',
        category: 'xss',
        cwe: 'CWE-79',
        check: (file) => {
          const violations: SecurityViolation[] = [];
          const lines = file.content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for direct innerHTML usage with user input
            if (/innerHTML\s*=.*\$\{/i.test(line)) {
              violations.push({
                line: i + 1,
                message: 'Potential XSS vulnerability in innerHTML usage',
                severity: 'high',
                category: 'xss',
                cwe: 'CWE-79',
                evidence: line.trim(),
                remediation: 'Use textContent or proper escaping for user input'
              });
            }
          }
          
          return violations;
        },
        remediation: 'Sanitize user input and use safe DOM manipulation methods'
      },
      {
        id: 'insecure-random',
        name: 'Insecure Random Number Generation',
        description: 'Detects use of insecure random number generators',
        severity: 'medium',
        category: 'cryptography',
        cwe: 'CWE-338',
        check: (file) => {
          const violations: SecurityViolation[] = [];
          const lines = file.content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/Math\.random\(\)/.test(line) && /password|token|salt|key/i.test(line)) {
              violations.push({
                line: i + 1,
                message: 'Insecure random number generation for security-sensitive value',
                severity: 'medium',
                category: 'cryptography',
                cwe: 'CWE-338',
                evidence: line.trim(),
                remediation: 'Use crypto.randomBytes() for cryptographically secure random values'
              });
            }
          }
          
          return violations;
        },
        remediation: 'Use cryptographically secure random number generators'
      }
    ];
  }

  private getFileType(filePath: string): FileContent['type'] {
    const filename = path.basename(filePath).toLowerCase();
    
    if (filename === 'package.json' || filename === 'dockerfile' || filename.endsWith('.yml') || filename.endsWith('.yaml')) {
      return 'config';
    }
    
    if (filename.includes('build') || filename.includes('webpack') || filename.includes('rollup')) {
      return 'build';
    }
    
    if (filename === 'package-lock.json' || filename === 'yarn.lock') {
      return 'dependency';
    }
    
    return 'source';
  }

  private getLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c'
    };
    
    return languageMap[ext] || 'unknown';
  }

  private identifySecurityPatterns(hotspots: SecurityHotspot[]): SecurityPattern[] {
    const patterns: Map<string, SecurityPattern> = new Map();
    
    for (const hotspot of hotspots) {
      const key = `${hotspot.category}-${hotspot.severity}`;
      
      if (patterns.has(key)) {
        const pattern = patterns.get(key)!;
        pattern.occurrences++;
        pattern.files.push(hotspot.file);
      } else {
        patterns.set(key, {
          pattern: `${hotspot.category} vulnerabilities`,
          category: hotspot.category,
          occurrences: 1,
          files: [hotspot.file],
          severity: hotspot.severity
        });
      }
    }
    
    return Array.from(patterns.values()).sort((a, b) => b.occurrences - a.occurrences);
  }

  private generateCodeRecommendations(analysis: CodeSecurityAnalysis): string[] {
    const recommendations: string[] = [];
    
    if (analysis.vulnerableFiles > 0) {
      recommendations.push(
        `Review ${analysis.vulnerableFiles} files with security vulnerabilities`
      );
    }
    
    const criticalHotspots = analysis.hotspots.filter(h => h.severity === 'critical');
    if (criticalHotspots.length > 0) {
      recommendations.push(
        `Address ${criticalHotspots.length} critical security issues immediately`
      );
    }
    
    const injectionIssues = analysis.hotspots.filter(h => h.category === 'injection');
    if (injectionIssues.length > 0) {
      recommendations.push(
        'Implement input validation and parameterized queries to prevent injection attacks'
      );
    }
    
    const xssIssues = analysis.hotspots.filter(h => h.category === 'xss');
    if (xssIssues.length > 0) {
      recommendations.push(
        'Implement proper output encoding to prevent XSS vulnerabilities'
      );
    }
    
    return recommendations;
  }

  private async analyzeConfiguration(projectPath: string): Promise<ConfigurationAnalysis> {
    this.emit('analyze:config:start');

    const analysis: ConfigurationAnalysis = {
      files: [],
      issues: [],
      recommendations: []
    };

    try {
      // Find configuration files
      const configPatterns = [
        'package.json',
        'Dockerfile',
        '*.yml',
        '*.yaml',
        '.env*',
        'nginx.conf',
        'webpack.config.*',
        'tsconfig.json'
      ];

      const configFiles = await glob(configPatterns, {
        cwd: projectPath,
        absolute: true,
        ignore: this.config.excludePatterns
      });

      for (const file of configFiles) {
        const configFile = await this.analyzeConfigFile(file, projectPath);
        analysis.files.push(configFile);
        analysis.issues.push(...configFile.issues);
      }

      analysis.recommendations = this.generateConfigRecommendations(analysis);

    } catch (error: any) {
      this.emit('config:error', error);
    }

    return analysis;
  }

  private async analyzeConfigFile(filePath: string, projectPath: string): Promise<ConfigFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(projectPath, filePath);
    
    const configFile: ConfigFile = {
      path: relativePath,
      type: this.getConfigFileType(filePath),
      issues: [],
      securityScore: 100
    };

    // Analyze based on file type
    switch (configFile.type) {
      case 'package.json':
        configFile.issues = this.analyzePackageJson(content, relativePath);
        break;
      case 'dockerfile':
        configFile.issues = this.analyzeDockerfile(content, relativePath);
        break;
      case 'env':
        configFile.issues = this.analyzeEnvFile(content, relativePath);
        break;
      default:
        configFile.issues = this.analyzeGenericConfig(content, relativePath);
    }

    // Calculate security score
    const criticalIssues = configFile.issues.filter(i => i.severity === 'critical').length;
    const highIssues = configFile.issues.filter(i => i.severity === 'high').length;
    const mediumIssues = configFile.issues.filter(i => i.severity === 'medium').length;

    configFile.securityScore = Math.max(0, 100 - (criticalIssues * 30 + highIssues * 20 + mediumIssues * 10));

    return configFile;
  }

  private getConfigFileType(filePath: string): ConfigFile['type'] {
    const filename = path.basename(filePath).toLowerCase();
    
    if (filename === 'package.json') return 'package.json';
    if (filename === 'dockerfile' || filename.startsWith('dockerfile.')) return 'dockerfile';
    if (filename.startsWith('.env')) return 'env';
    if (filename.includes('nginx')) return 'nginx';
    if (filename.includes('ci') || filename.includes('workflow')) return 'ci';
    
    return 'other';
  }

  private analyzePackageJson(content: string, filePath: string): ConfigurationIssue[] {
    const issues: ConfigurationIssue[] = [];
    
    try {
      const packageJson = JSON.parse(content);
      
      // Check for dependencies with known vulnerabilities
      if (packageJson.dependencies) {
        for (const [dep, version] of Object.entries(packageJson.dependencies)) {
          if (typeof version === 'string' && version.includes('*')) {
            issues.push({
              file: filePath,
              setting: `dependencies.${dep}`,
              issue: 'Wildcard version dependency',
              severity: 'medium',
              remediation: 'Use specific version ranges to avoid unexpected updates'
            });
          }
        }
      }
      
      // Check scripts for potentially dangerous commands
      if (packageJson.scripts) {
        for (const [script, command] of Object.entries(packageJson.scripts)) {
          if (typeof command === 'string' && /rm\s+-rf|sudo|curl.*\|/.test(command)) {
            issues.push({
              file: filePath,
              setting: `scripts.${script}`,
              issue: 'Potentially dangerous script command',
              severity: 'high',
              remediation: 'Review script for security implications'
            });
          }
        }
      }
      
    } catch (error) {
      issues.push({
        file: filePath,
        setting: 'JSON syntax',
        issue: 'Invalid JSON format',
        severity: 'medium',
        remediation: 'Fix JSON syntax errors'
      });
    }
    
    return issues;
  }

  private analyzeDockerfile(content: string, filePath: string): ConfigurationIssue[] {
    const issues: ConfigurationIssue[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      
      // Check for running as root
      if (/^USER\s+root$/i.test(line)) {
        issues.push({
          file: filePath,
          line: lineNum,
          setting: 'USER',
          issue: 'Running container as root user',
          severity: 'high',
          remediation: 'Create and use a non-root user'
        });
      }
      
      // Check for --privileged flag
      if (/--privileged/.test(line)) {
        issues.push({
          file: filePath,
          line: lineNum,
          setting: 'privileged',
          issue: 'Using privileged mode',
          severity: 'critical',
          remediation: 'Avoid privileged mode unless absolutely necessary'
        });
      }
      
      // Check for ADD with remote URLs
      if (/^ADD\s+https?:\/\//.test(line)) {
        issues.push({
          file: filePath,
          line: lineNum,
          setting: 'ADD',
          issue: 'Using ADD with remote URL',
          severity: 'medium',
          remediation: 'Use COPY for local files or RUN with curl for remote content'
        });
      }
    }
    
    return issues;
  }

  private analyzeEnvFile(content: string, filePath: string): ConfigurationIssue[] {
    const issues: ConfigurationIssue[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      
      // Check for hardcoded secrets
      if (/(?:password|secret|key|token)\s*=.*[^=\s]/i.test(line)) {
        issues.push({
          file: filePath,
          line: lineNum,
          setting: 'environment variable',
          issue: 'Potential hardcoded secret in environment file',
          severity: 'high',
          remediation: 'Use placeholder values and set real secrets at runtime'
        });
      }
    }
    
    return issues;
  }

  private analyzeGenericConfig(content: string, filePath: string): ConfigurationIssue[] {
    const issues: ConfigurationIssue[] = [];
    
    // Basic checks for any configuration file
    if (/password\s*[:=]\s*[^#\s]/i.test(content)) {
      issues.push({
        file: filePath,
        setting: 'configuration',
        issue: 'Potential hardcoded password',
        severity: 'high',
        remediation: 'Use external configuration or environment variables'
      });
    }
    
    return issues;
  }

  private generateConfigRecommendations(analysis: ConfigurationAnalysis): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(
        `Fix ${criticalIssues.length} critical configuration security issues`
      );
    }
    
    const dockerIssues = analysis.issues.filter(i => i.file.toLowerCase().includes('dockerfile'));
    if (dockerIssues.length > 0) {
      recommendations.push(
        'Review Docker configuration for security best practices'
      );
    }
    
    const envIssues = analysis.issues.filter(i => i.file.includes('.env'));
    if (envIssues.length > 0) {
      recommendations.push(
        'Review environment files for hardcoded secrets'
      );
    }
    
    return recommendations;
  }

  private async runScanner(
    scanner: SecurityScannerConfig,
    projectPath: string
  ): Promise<ScannerResult> {
    this.emit('scanner:start', { name: scanner.name });

    const result: ScannerResult = {
      scanner: scanner.name,
      success: false,
      duration: 0,
      vulnerabilities: 0,
      errors: []
    };

    const startTime = Date.now();

    try {
      switch (scanner.name) {
        case 'npm-audit':
          await this.runNpmAudit(projectPath, result);
          break;
        case 'snyk':
          await this.runSnyk(projectPath, result);
          break;
        case 'semgrep':
          await this.runSemgrep(projectPath, result);
          break;
        case 'eslint-security':
          await this.runESLintSecurity(projectPath, result);
          break;
        default:
          result.errors = [`Unknown scanner: ${scanner.name}`];
      }

      result.success = result.errors?.length === 0;
      result.duration = Date.now() - startTime;

    } catch (error: any) {
      result.errors = [error.message];
      result.duration = Date.now() - startTime;
    }

    this.emit('scanner:complete', result);
    return result;
  }

  private async runNpmAudit(projectPath: string, result: ScannerResult): Promise<void> {
    try {
      const output = execSync('npm audit --json', {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const auditData = JSON.parse(output);
      result.vulnerabilities = Object.keys(auditData.vulnerabilities || {}).length;
      result.rawOutput = output;

    } catch (error: any) {
      if (error.stdout) {
        try {
          const auditData = JSON.parse(error.stdout);
          result.vulnerabilities = Object.keys(auditData.vulnerabilities || {}).length;
          result.rawOutput = error.stdout;
        } catch {
          result.errors = ['Failed to parse npm audit output'];
        }
      } else {
        result.errors = ['npm audit command failed'];
      }
    }
  }

  private async runSnyk(projectPath: string, result: ScannerResult): Promise<void> {
    try {
      const output = execSync('snyk test --json', {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const snykData = JSON.parse(output);
      result.vulnerabilities = snykData.vulnerabilities?.length || 0;
      result.rawOutput = output;

    } catch (error: any) {
      result.errors = ['Snyk not available or authentication required'];
    }
  }

  private async runSemgrep(projectPath: string, result: ScannerResult): Promise<void> {
    try {
      const output = execSync('semgrep --config=auto --json', {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const semgrepData = JSON.parse(output);
      result.vulnerabilities = semgrepData.results?.length || 0;
      result.rawOutput = output;

    } catch (error: any) {
      result.errors = ['Semgrep not available'];
    }
  }

  private async runESLintSecurity(projectPath: string, result: ScannerResult): Promise<void> {
    try {
      const output = execSync('npx eslint . --ext .js,.ts,.jsx,.tsx --format json', {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const eslintData = JSON.parse(output);
      let securityIssues = 0;
      
      for (const file of eslintData) {
        for (const message of file.messages) {
          if (message.ruleId && message.ruleId.includes('security')) {
            securityIssues++;
          }
        }
      }

      result.vulnerabilities = securityIssues;
      result.rawOutput = output;

    } catch (error: any) {
      if (error.stdout) {
        result.rawOutput = error.stdout;
      }
      // ESLint returns non-zero exit code when issues found
    }
  }

  private async aggregateVulnerabilities(scanResult: SecurityScanResult): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    
    // Convert code analysis hotspots to vulnerabilities
    for (const hotspot of scanResult.codeAnalysis.hotspots) {
      vulnerabilities.push({
        id: `code-${vulnerabilities.length}`,
        title: hotspot.description,
        description: hotspot.description,
        severity: hotspot.severity,
        category: hotspot.category,
        affected: [{
          type: 'code',
          name: hotspot.file,
          path: hotspot.file
        }],
        discovered: new Date(),
        source: 'static-analysis',
        references: [],
        remediation: {
          priority: hotspot.severity === 'critical' ? 'immediate' : 
                    hotspot.severity === 'high' ? 'high' : 'medium',
          effort: '1-2h',
          steps: [hotspot.remediation],
          automatedFix: false
        }
      });
    }
    
    // Convert configuration issues to vulnerabilities
    for (const issue of scanResult.configurationAnalysis.issues) {
      if (issue.severity === 'critical' || issue.severity === 'high') {
        vulnerabilities.push({
          id: `config-${vulnerabilities.length}`,
          title: issue.issue,
          description: issue.issue,
          severity: issue.severity,
          category: 'configuration',
          affected: [{
            type: 'configuration',
            name: issue.file,
            path: issue.file
          }],
          discovered: new Date(),
          source: 'config-analysis',
          references: [],
          remediation: {
            priority: issue.severity === 'critical' ? 'immediate' : 'high',
            effort: '30min',
            steps: [issue.remediation],
            automatedFix: false
          }
        });
      }
    }

    return vulnerabilities;
  }

  private calculateSecurityMetrics(scanResult: SecurityScanResult): SecurityMetrics {
    const vulnerabilities = scanResult.vulnerabilities;
    
    const riskDistribution: Record<SecuritySeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    const categoryDistribution: Record<SecurityCategory, number> = {
      injection: 0,
      authentication: 0,
      authorization: 0,
      cryptography: 0,
      configuration: 0,
      'sensitive-data': 0,
      dependency: 0,
      xss: 0,
      csrf: 0,
      xxe: 0,
      deserialization: 0,
      other: 0
    };

    for (const vuln of vulnerabilities) {
      riskDistribution[vuln.severity]++;
      categoryDistribution[vuln.category]++;
    }

    return {
      riskDistribution,
      categoryDistribution,
      coverageMetrics: {
        codeScanned: scanResult.codeAnalysis.totalFiles,
        dependenciesScanned: scanResult.dependencies.totalDependencies,
        configurationScanned: scanResult.configurationAnalysis.files.length,
        totalCoverage: 85 // Mock coverage percentage
      },
      complianceMetrics: {
        owasp: {
          top10Coverage: this.calculateOWASPCoverage(vulnerabilities),
          issuesFound: this.getOWASPIssues(vulnerabilities)
        },
        cwe: {
          top25Coverage: this.calculateCWECoverage(vulnerabilities),
          issuesFound: this.getCWEIssues(vulnerabilities)
        },
        pci: vulnerabilities.filter(v => v.category === 'sensitive-data').length === 0,
        hipaa: vulnerabilities.filter(v => v.category === 'sensitive-data').length === 0,
        gdpr: vulnerabilities.filter(v => v.category === 'sensitive-data').length === 0
      }
    };
  }

  private calculateOWASPCoverage(vulnerabilities: SecurityVulnerability[]): number {
    const owaspCategories = ['injection', 'authentication', 'sensitive-data', 'xxe', 'authorization', 'configuration', 'xss', 'deserialization', 'dependency'];
    const foundCategories = new Set(vulnerabilities.map(v => v.category));
    const coveredCategories = owaspCategories.filter(cat => foundCategories.has(cat as SecurityCategory));
    return (coveredCategories.length / owaspCategories.length) * 100;
  }

  private getOWASPIssues(vulnerabilities: SecurityVulnerability[]): Array<{ category: string; count: number }> {
    const owaspMap: Record<string, string> = {
      injection: 'A03:2021 - Injection',
      authentication: 'A07:2021 - Identification and Authentication Failures',
      'sensitive-data': 'A02:2021 - Cryptographic Failures',
      xss: 'A03:2021 - Injection',
      authorization: 'A01:2021 - Broken Access Control',
      configuration: 'A05:2021 - Security Misconfiguration'
    };

    const issues: Record<string, number> = {};
    
    for (const vuln of vulnerabilities) {
      const owaspCategory = owaspMap[vuln.category];
      if (owaspCategory) {
        issues[owaspCategory] = (issues[owaspCategory] || 0) + 1;
      }
    }

    return Object.entries(issues).map(([category, count]) => ({ category, count }));
  }

  private calculateCWECoverage(vulnerabilities: SecurityVulnerability[]): number {
    const cweCount = vulnerabilities.filter(v => v.cwe).length;
    return vulnerabilities.length > 0 ? (cweCount / vulnerabilities.length) * 100 : 0;
  }

  private getCWEIssues(vulnerabilities: SecurityVulnerability[]): Array<{ cwe: string; count: number }> {
    const cweMap: Record<string, number> = {};
    
    for (const vuln of vulnerabilities) {
      if (vuln.cwe) {
        cweMap[vuln.cwe] = (cweMap[vuln.cwe] || 0) + 1;
      }
    }

    return Object.entries(cweMap).map(([cwe, count]) => ({ cwe, count }));
  }

  private generateSummary(scanResult: SecurityScanResult): SecuritySummary {
    const vulnerabilities = scanResult.vulnerabilities;
    
    const summary: SecuritySummary = {
      totalVulnerabilities: vulnerabilities.length,
      criticalCount: vulnerabilities.filter(v => v.severity === 'critical').length,
      highCount: vulnerabilities.filter(v => v.severity === 'high').length,
      mediumCount: vulnerabilities.filter(v => v.severity === 'medium').length,
      lowCount: vulnerabilities.filter(v => v.severity === 'low').length,
      riskScore: this.calculateRiskScore(vulnerabilities),
      complianceScore: this.calculateComplianceScore(scanResult.metrics),
      recommendations: this.generateSummaryRecommendations(scanResult)
    };

    return summary;
  }

  private calculateRiskScore(vulnerabilities: SecurityVulnerability[]): number {
    let score = 0;
    
    for (const vuln of vulnerabilities) {
      switch (vuln.severity) {
        case 'critical': score += 10; break;
        case 'high': score += 7; break;
        case 'medium': score += 4; break;
        case 'low': score += 1; break;
      }
    }
    
    // Normalize to 0-100 scale (100 being highest risk)
    return Math.min(100, score);
  }

  private calculateComplianceScore(metrics: SecurityMetrics): number {
    let score = 100;
    
    // Deduct points for compliance failures
    if (!metrics.complianceMetrics.pci) score -= 20;
    if (!metrics.complianceMetrics.hipaa) score -= 15;
    if (!metrics.complianceMetrics.gdpr) score -= 15;
    
    // Deduct points based on OWASP coverage
    if (metrics.complianceMetrics.owasp.top10Coverage < 80) {
      score -= (80 - metrics.complianceMetrics.owasp.top10Coverage) / 2;
    }
    
    return Math.max(0, score);
  }

  private generateSummaryRecommendations(scanResult: SecurityScanResult): string[] {
    const recommendations: string[] = [];
    
    if (scanResult.summary.criticalCount > 0) {
      recommendations.push(`Address ${scanResult.summary.criticalCount} critical vulnerabilities immediately`);
    }
    
    if (scanResult.dependencies.vulnerableDependencies > 0) {
      recommendations.push(`Update ${scanResult.dependencies.vulnerableDependencies} vulnerable dependencies`);
    }
    
    if (scanResult.codeAnalysis.vulnerableFiles > 0) {
      recommendations.push(`Review ${scanResult.codeAnalysis.vulnerableFiles} files with security issues`);
    }
    
    const configIssues = scanResult.configurationAnalysis.issues.filter(i => 
      i.severity === 'critical' || i.severity === 'high'
    );
    if (configIssues.length > 0) {
      recommendations.push(`Fix ${configIssues.length} configuration security issues`);
    }
    
    return recommendations;
  }

  private async calculateTrends(scanResult: SecurityScanResult): Promise<SecurityTrend[]> {
    // Load historical data and calculate trends
    // This would typically involve comparing with previous scan results
    return [];
  }

  async generateReport(scanResult: SecurityScanResult): Promise<SecurityReport> {
    const actionPlan = this.generateActionPlan(scanResult);
    const compliance = this.generateComplianceReport(scanResult);
    const trends = this.generateTrendAnalysis(scanResult);
    
    const summary: SecurityReportSummary = {
      riskLevel: this.determineRiskLevel(scanResult.summary.riskScore),
      totalVulnerabilities: scanResult.summary.totalVulnerabilities,
      criticalIssues: scanResult.summary.criticalCount,
      complianceScore: scanResult.summary.complianceScore,
      trend: 'stable',
      lastScan: scanResult.timestamp
    };

    const report: SecurityReport = {
      summary,
      scan: scanResult,
      actionPlan,
      compliance,
      trends,
      timestamp: new Date()
    };

    if (this.config.generateReport) {
      await this.saveReport(report);
    }

    return report;
  }

  private determineRiskLevel(riskScore: number): SecurityReportSummary['riskLevel'] {
    if (riskScore >= 70) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  private generateActionPlan(scanResult: SecurityScanResult): SecurityActionItem[] {
    const actionItems: SecurityActionItem[] = [];
    
    // Critical vulnerabilities first
    const criticalVulns = scanResult.vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      actionItems.push({
        priority: 'critical',
        category: 'other',
        title: 'Fix Critical Vulnerabilities',
        description: `Address ${criticalVulns.length} critical security vulnerabilities`,
        effort: '1-2d',
        impact: 'High',
        vulnerabilities: criticalVulns.map(v => v.id),
        automatedFix: false
      });
    }
    
    // Dependency vulnerabilities
    if (scanResult.dependencies.vulnerableDependencies > 0) {
      actionItems.push({
        priority: 'high',
        category: 'dependency',
        title: 'Update Vulnerable Dependencies',
        description: `Update ${scanResult.dependencies.vulnerableDependencies} dependencies with known vulnerabilities`,
        effort: '4-8h',
        impact: 'Medium',
        vulnerabilities: [],
        automatedFix: true
      });
    }
    
    // Configuration issues
    const configIssues = scanResult.configurationAnalysis.issues.filter(i => 
      i.severity === 'critical' || i.severity === 'high'
    );
    if (configIssues.length > 0) {
      actionItems.push({
        priority: 'medium',
        category: 'configuration',
        title: 'Fix Configuration Issues',
        description: `Address ${configIssues.length} security configuration issues`,
        effort: '2-4h',
        impact: 'Medium',
        vulnerabilities: [],
        automatedFix: false
      });
    }
    
    return actionItems;
  }

  private generateComplianceReport(scanResult: SecurityScanResult): ComplianceReport {
    const frameworks: ComplianceFramework[] = [
      {
        name: 'OWASP Top 10',
        score: scanResult.metrics.complianceMetrics.owasp.top10Coverage,
        requirements: this.generateOWASPRequirements(scanResult)
      },
      {
        name: 'CWE Top 25',
        score: scanResult.metrics.complianceMetrics.cwe.top25Coverage,
        requirements: this.generateCWERequirements(scanResult)
      }
    ];

    const overallScore = frameworks.reduce((sum, f) => sum + f.score, 0) / frameworks.length;
    
    return {
      frameworks,
      overallScore,
      gaps: this.identifyComplianceGaps(scanResult)
    };
  }

  private generateOWASPRequirements(scanResult: SecurityScanResult): ComplianceRequirement[] {
    const requirements: ComplianceRequirement[] = [
      {
        id: 'A01',
        description: 'Broken Access Control',
        status: scanResult.vulnerabilities.some(v => v.category === 'authorization') ? 'non-compliant' : 'compliant',
        issues: []
      },
      {
        id: 'A02',
        description: 'Cryptographic Failures',
        status: scanResult.vulnerabilities.some(v => v.category === 'cryptography') ? 'non-compliant' : 'compliant',
        issues: []
      },
      {
        id: 'A03',
        description: 'Injection',
        status: scanResult.vulnerabilities.some(v => v.category === 'injection') ? 'non-compliant' : 'compliant',
        issues: []
      }
    ];

    return requirements;
  }

  private generateCWERequirements(scanResult: SecurityScanResult): ComplianceRequirement[] {
    // Simplified CWE requirements
    return [
      {
        id: 'CWE-79',
        description: 'Cross-site Scripting',
        status: scanResult.vulnerabilities.some(v => v.cwe === 'CWE-79') ? 'non-compliant' : 'compliant',
        issues: []
      },
      {
        id: 'CWE-89',
        description: 'SQL Injection',
        status: scanResult.vulnerabilities.some(v => v.cwe === 'CWE-89') ? 'non-compliant' : 'compliant',
        issues: []
      }
    ];
  }

  private identifyComplianceGaps(scanResult: SecurityScanResult): ComplianceGap[] {
    const gaps: ComplianceGap[] = [];
    
    // Check for common compliance gaps
    const injectionVulns = scanResult.vulnerabilities.filter(v => v.category === 'injection');
    if (injectionVulns.length > 0) {
      gaps.push({
        framework: 'OWASP Top 10',
        requirement: 'A03:2021 - Injection',
        severity: 'high',
        description: 'Application vulnerable to injection attacks',
        remediation: 'Implement input validation and parameterized queries'
      });
    }
    
    return gaps;
  }

  private generateTrendAnalysis(scanResult: SecurityScanResult): SecurityTrendAnalysis {
    return {
      historical: scanResult.trends || [],
      predictions: [],
      patterns: []
    };
  }

  private async saveReport(report: SecurityReport): Promise<void> {
    await fs.ensureDir(this.config.outputPath!);

    // Save JSON report
    const jsonPath = path.join(this.config.outputPath!, 'security-report.json');
    await fs.writeJson(jsonPath, report, { spaces: 2 });

    // Save HTML report
    const htmlPath = path.join(this.config.outputPath!, 'security-report.html');
    const html = this.generateHtmlReport(report);
    await fs.writeFile(htmlPath, html);

    this.emit('report:saved', { json: jsonPath, html: htmlPath });
  }

  private generateHtmlReport(report: SecurityReport): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f44336; color: white; padding: 20px; border-radius: 5px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        .critical { color: #d32f2f; font-weight: bold; }
        .high { color: #f57c00; font-weight: bold; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .action-item { margin: 10px 0; padding: 15px; border-left: 4px solid #f44336; background: #fff3e0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Scan Report</h1>
        <p>Risk Level: <strong>${report.summary.riskLevel.toUpperCase()}</strong></p>
    </div>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <div class="metric">
            <strong>Total Vulnerabilities:</strong> ${report.summary.totalVulnerabilities}
        </div>
        <div class="metric">
            <strong>Critical Issues:</strong> 
            <span class="critical">${report.summary.criticalIssues}</span>
        </div>
        <div class="metric">
            <strong>Compliance Score:</strong> ${report.summary.complianceScore.toFixed(1)}%
        </div>
        <div class="metric">
            <strong>Risk Score:</strong> ${report.scan.summary.riskScore}/100
        </div>
    </div>

    <h2>Vulnerabilities by Severity</h2>
    <table>
        <tr>
            <th>Severity</th>
            <th>Count</th>
            <th>Percentage</th>
        </tr>
        ${Object.entries(report.scan.metrics.riskDistribution).map(([severity, count]) => `
            <tr>
                <td><span class="${severity}">${severity.toUpperCase()}</span></td>
                <td>${count}</td>
                <td>${report.summary.totalVulnerabilities > 0 ? 
                    ((count / report.summary.totalVulnerabilities) * 100).toFixed(1) : 0}%</td>
            </tr>
        `).join('')}
    </table>

    <h2>Action Plan</h2>
    ${report.actionPlan.map(item => `
        <div class="action-item">
            <h4>${item.title} (${item.priority} priority)</h4>
            <p>${item.description}</p>
            <p><strong>Effort:</strong> ${item.effort} | <strong>Impact:</strong> ${item.impact}</p>
            ${item.automatedFix ? '<p>✅ Automated fix available</p>' : ''}
        </div>
    `).join('')}

    <h2>Top Vulnerabilities</h2>
    <table>
        <thead>
            <tr>
                <th>Title</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Component</th>
            </tr>
        </thead>
        <tbody>
            ${report.scan.vulnerabilities.slice(0, 10).map(vuln => `
                <tr>
                    <td>${vuln.title}</td>
                    <td><span class="${vuln.severity}">${vuln.severity.toUpperCase()}</span></td>
                    <td>${vuln.category}</td>
                    <td>${vuln.affected[0]?.name || 'N/A'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <footer>
        <p>Generated on ${report.timestamp.toISOString()}</p>
        <p>Scan completed on ${report.scan.timestamp.toISOString()}</p>
    </footer>
</body>
</html>`;
  }

  private createEmptySummary(): SecuritySummary {
    return {
      totalVulnerabilities: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      riskScore: 0,
      complianceScore: 100,
      recommendations: []
    };
  }

  private createEmptyDependencyAnalysis(): DependencyAnalysis {
    return {
      totalDependencies: 0,
      vulnerableDependencies: 0,
      outdatedDependencies: 0,
      licenseIssues: [],
      dependencyTree: [],
      recommendations: []
    };
  }

  private createEmptyCodeAnalysis(): CodeSecurityAnalysis {
    return {
      totalFiles: 0,
      vulnerableFiles: 0,
      patterns: [],
      hotspots: [],
      recommendations: []
    };
  }

  private createEmptyConfigAnalysis(): ConfigurationAnalysis {
    return {
      files: [],
      issues: [],
      recommendations: []
    };
  }

  private createEmptyMetrics(): SecurityMetrics {
    return {
      riskDistribution: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      },
      categoryDistribution: {
        injection: 0,
        authentication: 0,
        authorization: 0,
        cryptography: 0,
        configuration: 0,
        'sensitive-data': 0,
        dependency: 0,
        xss: 0,
        csrf: 0,
        xxe: 0,
        deserialization: 0,
        other: 0
      },
      coverageMetrics: {
        codeScanned: 0,
        dependenciesScanned: 0,
        configurationScanned: 0,
        totalCoverage: 0
      },
      complianceMetrics: {
        owasp: {
          top10Coverage: 0,
          issuesFound: []
        },
        cwe: {
          top25Coverage: 0,
          issuesFound: []
        },
        pci: true,
        hipaa: true,
        gdpr: true
      }
    };
  }
}

// Export utility functions
export function createSecurityRule(
  id: string,
  name: string,
  check: (file: FileContent) => SecurityViolation[]
): SecurityRule {
  return {
    id,
    name,
    description: name,
    severity: 'medium',
    category: 'other',
    check
  };
}

export async function scanSecurity(
  projectPath: string,
  config?: Partial<SecurityScanConfig>
): Promise<SecurityReport> {
  const defaultConfig: SecurityScanConfig = {
    scanners: [
      { name: 'npm-audit', enabled: true },
      { name: 'eslint-security', enabled: true }
    ],
    generateReport: true,
    outputPath: './security-reports',
    includePatterns: ['**/*.{js,ts,jsx,tsx,json,yml,yaml,dockerfile}'],
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    thresholds: {
      critical: 0,
      high: 0,
      medium: 5,
      low: 10,
      total: 20
    },
    ...config
  };
  
  const scanner = new SecurityScanner(defaultConfig);
  const scanResult = await scanner.scan(projectPath);
  return scanner.generateReport(scanResult);
}