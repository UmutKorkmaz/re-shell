import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';
import glob from 'fast-glob';

export interface TroubleshootingConfig {
  outputPath?: string;
  includeAutoDiagnostics?: boolean;
  includeSystemInfo?: boolean;
  includeNetworkTests?: boolean;
  includeFileSystemChecks?: boolean;
  includeEnvironmentChecks?: boolean;
  includeDependencyAnalysis?: boolean;
  includePerformanceTests?: boolean;
  includeSecurityChecks?: boolean;
  customChecks?: CustomCheck[];
  generateInteractiveGuide?: boolean;
  exportFormats?: ExportFormat[];
}

export interface CustomCheck {
  id: string;
  name: string;
  description: string;
  category: CheckCategory;
  command?: string;
  script?: string;
  validator?: (result: any) => CheckResult;
  autoFix?: AutoFixConfig;
}

export interface AutoFixConfig {
  command?: string;
  script?: string;
  requiresConfirmation?: boolean;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export type CheckCategory = 
  | 'system'
  | 'network'
  | 'filesystem'
  | 'environment'
  | 'dependencies'
  | 'performance'
  | 'security'
  | 'configuration'
  | 'integration';

export type ExportFormat = 'html' | 'pdf' | 'markdown' | 'json' | 'interactive';

export interface CheckResult {
  status: 'pass' | 'warning' | 'fail' | 'info';
  message: string;
  details?: any;
  suggestion?: string;
  autoFixAvailable?: boolean;
  documentation?: string;
}

export interface DiagnosticCheck {
  id: string;
  name: string;
  category: CheckCategory;
  description: string;
  run: () => Promise<CheckResult>;
  autoFix?: () => Promise<boolean>;
}

export interface TroubleshootingGuide {
  id: string;
  title: string;
  description: string;
  symptoms: string[];
  causes: TroubleCause[];
  solutions: TroubleSolution[];
  diagnostics: DiagnosticCheck[];
  relatedGuides?: string[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface TroubleCause {
  id: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  checkCommand?: string;
  diagnosticId?: string;
}

export interface TroubleSolution {
  id: string;
  description: string;
  steps: SolutionStep[];
  effectiveness: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  timeEstimate: string;
  prerequisites?: string[];
}

export interface SolutionStep {
  order: number;
  description: string;
  command?: string;
  code?: string;
  verification?: string;
  screenshot?: string;
  video?: string;
}

export interface DiagnosticReport {
  timestamp: Date;
  systemInfo: SystemInfo;
  diagnosticResults: DiagnosticResult[];
  recommendations: Recommendation[];
  autoFixesAvailable: AutoFix[];
  exportPath?: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  npmVersion: string;
  cliVersion: string;
  memory: MemoryInfo;
  cpu: CPUInfo;
  network: NetworkInfo;
  disk: DiskInfo;
}

export interface MemoryInfo {
  total: number;
  free: number;
  used: number;
  percentage: number;
}

export interface CPUInfo {
  model: string;
  cores: number;
  speed: number;
  loadAverage: number[];
}

export interface NetworkInfo {
  interfaces: NetworkInterface[];
  connectivity: boolean;
  latency?: number;
  dns: string[];
}

export interface NetworkInterface {
  name: string;
  address: string;
  netmask: string;
  family: string;
  internal: boolean;
}

export interface DiskInfo {
  total: number;
  free: number;
  used: number;
  percentage: number;
  path: string;
}

export interface DiagnosticResult {
  checkId: string;
  checkName: string;
  category: CheckCategory;
  result: CheckResult;
  duration: number;
  timestamp: Date;
}

export interface Recommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actions: string[];
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface AutoFix {
  diagnosticId: string;
  title: string;
  description: string;
  command: string;
  riskLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

export interface TroubleshootingGenerationResult {
  guidesGenerated: number;
  diagnosticsCreated: number;
  autoFixesConfigured: number;
  outputPath: string;
  formats: string[];
  report?: DiagnosticReport;
}

export class TroubleshootingGuideGenerator extends EventEmitter {
  private config: TroubleshootingConfig;
  private diagnostics: Map<string, DiagnosticCheck> = new Map();
  private guides: Map<string, TroubleshootingGuide> = new Map();
  private customChecks: Map<string, CustomCheck> = new Map();

  constructor(config: TroubleshootingConfig = {}) {
    super();
    this.config = {
      outputPath: './troubleshooting',
      includeAutoDiagnostics: true,
      includeSystemInfo: true,
      includeNetworkTests: true,
      includeFileSystemChecks: true,
      includeEnvironmentChecks: true,
      includeDependencyAnalysis: true,
      includePerformanceTests: true,
      includeSecurityChecks: true,
      generateInteractiveGuide: true,
      exportFormats: ['html', 'markdown'],
      ...config
    };

    this.initializeBuiltInDiagnostics();
    this.initializeBuiltInGuides();
    
    if (config.customChecks) {
      config.customChecks.forEach(check => {
        this.customChecks.set(check.id, check);
      });
    }
  }

  async generateTroubleshootingGuides(): Promise<TroubleshootingGenerationResult> {
    this.emit('generation:start');

    try {
      // Create output directory
      await fs.ensureDir(this.config.outputPath!);

      // Run diagnostics if enabled
      let report: DiagnosticReport | undefined;
      if (this.config.includeAutoDiagnostics) {
        this.emit('diagnostics:start');
        report = await this.runDiagnostics();
        this.emit('diagnostics:complete', report);
      }

      // Generate guides for each category
      const categories = this.getUniqueCategories();
      for (const category of categories) {
        this.emit('category:start', category);
        await this.generateCategoryGuides(category);
        this.emit('category:complete', category);
      }

      // Generate index and navigation
      await this.generateIndex();
      await this.generateNavigation();

      // Export in requested formats
      for (const format of this.config.exportFormats || []) {
        this.emit('export:start', format);
        await this.exportGuides(format, report);
        this.emit('export:complete', format);
      }

      // Generate interactive guide if enabled
      if (this.config.generateInteractiveGuide) {
        await this.generateInteractiveGuide();
      }

      const result: TroubleshootingGenerationResult = {
        guidesGenerated: this.guides.size,
        diagnosticsCreated: this.diagnostics.size,
        autoFixesConfigured: this.countAutoFixes(),
        outputPath: this.config.outputPath!,
        formats: this.config.exportFormats || [],
        report
      };

      this.emit('generation:complete', result);
      return result;

    } catch (error) {
      this.emit('generation:error', error);
      throw error;
    }
  }

  private initializeBuiltInDiagnostics(): void {
    // System diagnostics
    this.addDiagnostic({
      id: 'node-version',
      name: 'Node.js Version Check',
      category: 'system',
      description: 'Checks if Node.js version meets requirements',
      run: async () => {
        const version = process.version;
        const major = parseInt(version.split('.')[0].substring(1));
        if (major < 16) {
          return {
            status: 'fail',
            message: `Node.js ${version} is below minimum required version 16.x`,
            suggestion: 'Update Node.js to version 16.x or higher'
          };
        }
        return {
          status: 'pass',
          message: `Node.js ${version} meets requirements`
        };
      }
    });

    // Network diagnostics
    this.addDiagnostic({
      id: 'network-connectivity',
      name: 'Network Connectivity Check',
      category: 'network',
      description: 'Checks internet connectivity',
      run: async () => {
        try {
          execSync('ping -c 1 google.com', { stdio: 'ignore' });
          return {
            status: 'pass',
            message: 'Network connectivity is working'
          };
        } catch {
          return {
            status: 'fail',
            message: 'No internet connectivity detected',
            suggestion: 'Check your network connection and firewall settings'
          };
        }
      }
    });

    // File system diagnostics
    this.addDiagnostic({
      id: 'disk-space',
      name: 'Disk Space Check',
      category: 'filesystem',
      description: 'Checks available disk space',
      run: async () => {
        const diskInfo = await this.getDiskInfo();
        if (diskInfo.percentage > 90) {
          return {
            status: 'warning',
            message: `Disk usage is at ${diskInfo.percentage}%`,
            suggestion: 'Consider freeing up disk space',
            details: diskInfo
          };
        }
        return {
          status: 'pass',
          message: `Sufficient disk space available (${diskInfo.free} GB free)`
        };
      }
    });

    // Environment diagnostics
    this.addDiagnostic({
      id: 'env-path',
      name: 'PATH Environment Check',
      category: 'environment',
      description: 'Checks if required tools are in PATH',
      run: async () => {
        const requiredTools = ['node', 'npm', 'git'];
        const missing: string[] = [];

        for (const tool of requiredTools) {
          try {
            execSync(`which ${tool}`, { stdio: 'ignore' });
          } catch {
            missing.push(tool);
          }
        }

        if (missing.length > 0) {
          return {
            status: 'fail',
            message: `Missing tools in PATH: ${missing.join(', ')}`,
            suggestion: 'Install missing tools or add them to your PATH'
          };
        }

        return {
          status: 'pass',
          message: 'All required tools found in PATH'
        };
      }
    });

    // Dependency diagnostics
    this.addDiagnostic({
      id: 'npm-registry',
      name: 'NPM Registry Access',
      category: 'dependencies',
      description: 'Checks access to NPM registry',
      run: async () => {
        try {
          execSync('npm ping', { stdio: 'ignore' });
          return {
            status: 'pass',
            message: 'NPM registry is accessible'
          };
        } catch {
          return {
            status: 'fail',
            message: 'Cannot access NPM registry',
            suggestion: 'Check network settings or NPM configuration'
          };
        }
      }
    });

    // Performance diagnostics
    this.addDiagnostic({
      id: 'cpu-usage',
      name: 'CPU Usage Check',
      category: 'performance',
      description: 'Checks current CPU usage',
      run: async () => {
        const loadAvg = os.loadavg()[0];
        const cpuCount = os.cpus().length;
        const usage = (loadAvg / cpuCount) * 100;

        if (usage > 80) {
          return {
            status: 'warning',
            message: `High CPU usage detected (${usage.toFixed(1)}%)`,
            suggestion: 'Close unnecessary applications to improve performance'
          };
        }

        return {
          status: 'pass',
          message: `CPU usage is normal (${usage.toFixed(1)}%)`
        };
      }
    });

    // Security diagnostics
    this.addDiagnostic({
      id: 'npm-audit',
      name: 'Security Vulnerability Check',
      category: 'security',
      description: 'Checks for known vulnerabilities',
      run: async () => {
        try {
          const result = execSync('npm audit --json', { encoding: 'utf8' });
          const audit = JSON.parse(result);
          
          if (audit.metadata.vulnerabilities.total > 0) {
            return {
              status: 'warning',
              message: `Found ${audit.metadata.vulnerabilities.total} vulnerabilities`,
              suggestion: 'Run "npm audit fix" to resolve vulnerabilities',
              details: audit.metadata.vulnerabilities
            };
          }

          return {
            status: 'pass',
            message: 'No known vulnerabilities found'
          };
        } catch {
          return {
            status: 'info',
            message: 'Unable to check for vulnerabilities',
            suggestion: 'Ensure npm audit is available'
          };
        }
      },
      autoFix: async () => {
        try {
          execSync('npm audit fix');
          return true;
        } catch {
          return false;
        }
      }
    });

    // Configuration diagnostics
    this.addDiagnostic({
      id: 'config-validation',
      name: 'Configuration File Validation',
      category: 'configuration',
      description: 'Validates Re-Shell configuration files',
      run: async () => {
        const configPaths = [
          path.join(process.cwd(), 're-shell.config.json'),
          path.join(process.cwd(), '.re-shell', 'config.yaml')
        ];

        for (const configPath of configPaths) {
          if (await fs.pathExists(configPath)) {
            try {
              const content = await fs.readFile(configPath, 'utf8');
              JSON.parse(content); // Basic validation
              return {
                status: 'pass',
                message: 'Configuration files are valid'
              };
            } catch (error) {
              return {
                status: 'fail',
                message: `Invalid configuration file: ${configPath}`,
                suggestion: 'Check configuration file syntax',
                details: error
              };
            }
          }
        }

        return {
          status: 'info',
          message: 'No configuration files found',
          suggestion: 'Run "re-shell init" to create configuration'
        };
      }
    });
  }

  private initializeBuiltInGuides(): void {
    // Installation issues
    this.addGuide({
      id: 'installation-issues',
      title: 'Installation Issues',
      description: 'Common problems during Re-Shell installation',
      symptoms: [
        'Installation fails with permission errors',
        'Dependencies cannot be resolved',
        'Post-install scripts fail'
      ],
      causes: [
        {
          id: 'permissions',
          description: 'Insufficient permissions for global installation',
          probability: 'high',
          checkCommand: 'npm config get prefix',
          diagnosticId: 'env-path'
        },
        {
          id: 'network',
          description: 'Network connectivity issues',
          probability: 'medium',
          diagnosticId: 'network-connectivity'
        }
      ],
      solutions: [
        {
          id: 'use-npx',
          description: 'Use npx instead of global installation',
          steps: [
            {
              order: 1,
              description: 'Run Re-Shell using npx',
              command: 'npx @umutkorkmaz/re-shell-cli init my-project'
            }
          ],
          effectiveness: 'high',
          riskLevel: 'low',
          timeEstimate: '1 minute'
        },
        {
          id: 'fix-permissions',
          description: 'Fix npm permissions',
          steps: [
            {
              order: 1,
              description: 'Change npm prefix to user directory',
              command: 'npm config set prefix ~/.npm-global'
            },
            {
              order: 2,
              description: 'Add to PATH in ~/.bashrc or ~/.zshrc',
              code: 'export PATH=~/.npm-global/bin:$PATH'
            },
            {
              order: 3,
              description: 'Reload shell configuration',
              command: 'source ~/.bashrc'
            }
          ],
          effectiveness: 'high',
          riskLevel: 'low',
          timeEstimate: '5 minutes'
        }
      ],
      diagnostics: [
        this.diagnostics.get('env-path')!,
        this.diagnostics.get('network-connectivity')!,
        this.diagnostics.get('npm-registry')!
      ],
      tags: ['installation', 'setup', 'permissions'],
      difficulty: 'beginner'
    });

    // Build failures
    this.addGuide({
      id: 'build-failures',
      title: 'Build Failures',
      description: 'Troubleshooting build and compilation errors',
      symptoms: [
        'Build process fails with errors',
        'TypeScript compilation errors',
        'Module resolution failures'
      ],
      causes: [
        {
          id: 'missing-deps',
          description: 'Missing or incompatible dependencies',
          probability: 'high',
          diagnosticId: 'npm-audit'
        },
        {
          id: 'node-version',
          description: 'Incompatible Node.js version',
          probability: 'medium',
          diagnosticId: 'node-version'
        }
      ],
      solutions: [
        {
          id: 'clean-install',
          description: 'Clean install dependencies',
          steps: [
            {
              order: 1,
              description: 'Remove node_modules and lock file',
              command: 'rm -rf node_modules package-lock.json'
            },
            {
              order: 2,
              description: 'Clear npm cache',
              command: 'npm cache clean --force'
            },
            {
              order: 3,
              description: 'Install dependencies fresh',
              command: 'npm install'
            }
          ],
          effectiveness: 'high',
          riskLevel: 'low',
          timeEstimate: '5-10 minutes'
        }
      ],
      diagnostics: [
        this.diagnostics.get('node-version')!,
        this.diagnostics.get('disk-space')!
      ],
      tags: ['build', 'compilation', 'typescript'],
      difficulty: 'intermediate'
    });

    // Performance issues
    this.addGuide({
      id: 'performance-issues',
      title: 'Performance Issues',
      description: 'Resolving slow performance and high resource usage',
      symptoms: [
        'Commands run slowly',
        'High CPU or memory usage',
        'System becomes unresponsive'
      ],
      causes: [
        {
          id: 'large-workspace',
          description: 'Large number of workspace apps',
          probability: 'high'
        },
        {
          id: 'insufficient-resources',
          description: 'Insufficient system resources',
          probability: 'medium',
          diagnosticId: 'cpu-usage'
        }
      ],
      solutions: [
        {
          id: 'optimize-workspace',
          description: 'Optimize workspace configuration',
          steps: [
            {
              order: 1,
              description: 'Enable workspace caching',
              command: 're-shell config set cache.enabled true'
            },
            {
              order: 2,
              description: 'Increase cache size limit',
              command: 're-shell config set cache.maxSize 1GB'
            },
            {
              order: 3,
              description: 'Enable parallel processing',
              command: 're-shell config set build.parallel true'
            }
          ],
          effectiveness: 'high',
          riskLevel: 'low',
          timeEstimate: '2 minutes'
        }
      ],
      diagnostics: [
        this.diagnostics.get('cpu-usage')!,
        this.diagnostics.get('disk-space')!
      ],
      tags: ['performance', 'optimization', 'resources'],
      difficulty: 'advanced'
    });
  }

  private addDiagnostic(diagnostic: DiagnosticCheck): void {
    this.diagnostics.set(diagnostic.id, diagnostic);
  }

  private addGuide(guide: TroubleshootingGuide): void {
    this.guides.set(guide.id, guide);
  }

  private async runDiagnostics(): Promise<DiagnosticReport> {
    const results: DiagnosticResult[] = [];
    const recommendations: Recommendation[] = [];
    const autoFixes: AutoFix[] = [];

    // Collect system info
    const systemInfo = await this.collectSystemInfo();

    // Run all diagnostics
    for (const [id, diagnostic] of this.diagnostics) {
      this.emit('diagnostic:start', id);
      const startTime = Date.now();

      try {
        const result = await diagnostic.run();
        const duration = Date.now() - startTime;

        results.push({
          checkId: id,
          checkName: diagnostic.name,
          category: diagnostic.category,
          result,
          duration,
          timestamp: new Date()
        });

        // Generate recommendations based on results
        if (result.status === 'fail' || result.status === 'warning') {
          recommendations.push({
            id: `rec-${id}`,
            priority: result.status === 'fail' ? 'high' : 'medium',
            title: diagnostic.name,
            description: result.message,
            actions: result.suggestion ? [result.suggestion] : [],
            impact: 'Resolves ' + diagnostic.name,
            effort: 'low'
          });

          // Check for auto-fix
          if (diagnostic.autoFix && result.autoFixAvailable !== false) {
            autoFixes.push({
              diagnosticId: id,
              title: `Auto-fix: ${diagnostic.name}`,
              description: result.suggestion || 'Automatic fix available',
              command: 'auto-fix command',
              riskLevel: 'low',
              requiresConfirmation: true
            });
          }
        }

        this.emit('diagnostic:complete', id, result);
      } catch (error) {
        this.emit('diagnostic:error', id, error);
        results.push({
          checkId: id,
          checkName: diagnostic.name,
          category: diagnostic.category,
          result: {
            status: 'fail',
            message: `Diagnostic failed: ${error}`
          },
          duration: Date.now() - startTime,
          timestamp: new Date()
        });
      }
    }

    // Run custom checks
    for (const [id, check] of this.customChecks) {
      const result = await this.runCustomCheck(check);
      results.push({
        checkId: id,
        checkName: check.name,
        category: check.category,
        result,
        duration: 0,
        timestamp: new Date()
      });
    }

    // Sort recommendations by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const report: DiagnosticReport = {
      timestamp: new Date(),
      systemInfo,
      diagnosticResults: results,
      recommendations,
      autoFixesAvailable: autoFixes
    };

    // Save report
    await this.saveReport(report);

    return report;
  }

  private async collectSystemInfo(): Promise<SystemInfo> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const diskInfo = await this.getDiskInfo();

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      npmVersion: this.getNpmVersion(),
      cliVersion: this.getCliVersion(),
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
        percentage: ((totalMem - freeMem) / totalMem) * 100
      },
      cpu: {
        model: cpus[0].model,
        cores: cpus.length,
        speed: cpus[0].speed,
        loadAverage: os.loadavg()
      },
      network: {
        interfaces: this.getNetworkInterfaces(),
        connectivity: await this.checkConnectivity(),
        dns: this.getDnsServers()
      },
      disk: diskInfo
    };
  }

  private getNpmVersion(): string {
    try {
      return execSync('npm --version', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getCliVersion(): string {
    try {
      const packagePath = path.join(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }

  private async getDiskInfo(): Promise<DiskInfo> {
    try {
      const platform = os.platform();
      let command: string;
      
      if (platform === 'darwin' || platform === 'linux') {
        command = 'df -k /';
      } else if (platform === 'win32') {
        command = 'wmic logicaldisk get size,freespace,caption';
      } else {
        throw new Error('Unsupported platform');
      }

      const output = execSync(command, { encoding: 'utf8' });
      
      // Parse output based on platform
      if (platform === 'darwin' || platform === 'linux') {
        const lines = output.trim().split('\n');
        const data = lines[1].split(/\s+/);
        const total = parseInt(data[1]) * 1024;
        const used = parseInt(data[2]) * 1024;
        const free = parseInt(data[3]) * 1024;
        
        return {
          total,
          used,
          free,
          percentage: (used / total) * 100,
          path: '/'
        };
      } else {
        // Windows parsing would go here
        return {
          total: 0,
          used: 0,
          free: 0,
          percentage: 0,
          path: 'C:\\'
        };
      }
    } catch {
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
        path: '/'
      };
    }
  }

  private getNetworkInterfaces(): NetworkInterface[] {
    const interfaces = os.networkInterfaces();
    const result: NetworkInterface[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs) {
        for (const addr of addrs) {
          result.push({
            name,
            address: addr.address,
            netmask: addr.netmask,
            family: addr.family,
            internal: addr.internal
          });
        }
      }
    }

    return result;
  }

  private async checkConnectivity(): Promise<boolean> {
    try {
      execSync('ping -c 1 google.com', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private getDnsServers(): string[] {
    try {
      if (os.platform() === 'darwin' || os.platform() === 'linux') {
        const output = execSync('cat /etc/resolv.conf', { encoding: 'utf8' });
        const servers = output
          .split('\n')
          .filter(line => line.startsWith('nameserver'))
          .map(line => line.split(' ')[1]);
        return servers;
      }
      return [];
    } catch {
      return [];
    }
  }

  private async runCustomCheck(check: CustomCheck): Promise<CheckResult> {
    try {
      if (check.command) {
        const output = execSync(check.command, { encoding: 'utf8' });
        if (check.validator) {
          return check.validator(output);
        }
        return {
          status: 'info',
          message: output.trim()
        };
      } else if (check.script) {
        // Execute custom script
        const result = eval(check.script);
        if (check.validator) {
          return check.validator(result);
        }
        return {
          status: 'info',
          message: String(result)
        };
      }
      return {
        status: 'info',
        message: 'Check completed'
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Check failed: ${error}`
      };
    }
  }

  private getUniqueCategories(): CheckCategory[] {
    const categories = new Set<CheckCategory>();
    
    for (const diagnostic of this.diagnostics.values()) {
      categories.add(diagnostic.category);
    }
    
    for (const check of this.customChecks.values()) {
      categories.add(check.category);
    }
    
    return Array.from(categories);
  }

  private async generateCategoryGuides(category: CheckCategory): Promise<void> {
    const categoryPath = path.join(this.config.outputPath!, category);
    await fs.ensureDir(categoryPath);

    // Generate guide for each troubleshooting guide in this category
    const categoryGuides = Array.from(this.guides.values()).filter(guide => 
      guide.diagnostics.some(d => d.category === category)
    );

    for (const guide of categoryGuides) {
      await this.generateGuideFile(guide, categoryPath);
    }

    // Generate category index
    await this.generateCategoryIndex(category, categoryGuides, categoryPath);
  }

  private async generateGuideFile(guide: TroubleshootingGuide, outputPath: string): Promise<void> {
    const guidePath = path.join(outputPath, `${guide.id}.md`);
    
    let content = `# ${guide.title}\n\n`;
    content += `${guide.description}\n\n`;
    
    content += `## Symptoms\n\n`;
    for (const symptom of guide.symptoms) {
      content += `- ${symptom}\n`;
    }
    content += '\n';
    
    content += `## Possible Causes\n\n`;
    for (const cause of guide.causes) {
      content += `### ${cause.description}\n`;
      content += `- **Probability**: ${cause.probability}\n`;
      if (cause.checkCommand) {
        content += `- **Check command**: \`${cause.checkCommand}\`\n`;
      }
      content += '\n';
    }
    
    content += `## Solutions\n\n`;
    for (const solution of guide.solutions) {
      content += `### ${solution.description}\n`;
      content += `- **Effectiveness**: ${solution.effectiveness}\n`;
      content += `- **Risk Level**: ${solution.riskLevel}\n`;
      content += `- **Time Estimate**: ${solution.timeEstimate}\n`;
      
      if (solution.prerequisites) {
        content += `\n**Prerequisites**:\n`;
        for (const prereq of solution.prerequisites) {
          content += `- ${prereq}\n`;
        }
      }
      
      content += `\n**Steps**:\n`;
      for (const step of solution.steps) {
        content += `\n${step.order}. ${step.description}\n`;
        if (step.command) {
          content += `   \`\`\`bash\n   ${step.command}\n   \`\`\`\n`;
        }
        if (step.code) {
          content += `   \`\`\`\n   ${step.code}\n   \`\`\`\n`;
        }
        if (step.verification) {
          content += `   **Verify**: ${step.verification}\n`;
        }
      }
      content += '\n';
    }
    
    if (guide.relatedGuides) {
      content += `## Related Guides\n\n`;
      for (const relatedId of guide.relatedGuides) {
        const related = this.guides.get(relatedId);
        if (related) {
          content += `- [${related.title}](./${relatedId}.md)\n`;
        }
      }
      content += '\n';
    }
    
    content += `## Tags\n\n`;
    content += guide.tags.map(tag => `\`${tag}\``).join(', ') + '\n\n';
    
    content += `**Difficulty**: ${guide.difficulty}\n`;
    
    await fs.writeFile(guidePath, content);
  }

  private async generateCategoryIndex(
    category: CheckCategory, 
    guides: TroubleshootingGuide[], 
    outputPath: string
  ): Promise<void> {
    const indexPath = path.join(outputPath, 'index.md');
    
    let content = `# ${category.charAt(0).toUpperCase() + category.slice(1)} Troubleshooting\n\n`;
    content += `This section contains troubleshooting guides for ${category}-related issues.\n\n`;
    
    content += `## Available Guides\n\n`;
    for (const guide of guides) {
      content += `### [${guide.title}](./${guide.id}.md)\n`;
      content += `${guide.description}\n\n`;
      content += `**Symptoms**:\n`;
      for (const symptom of guide.symptoms.slice(0, 3)) {
        content += `- ${symptom}\n`;
      }
      if (guide.symptoms.length > 3) {
        content += `- ...and ${guide.symptoms.length - 3} more\n`;
      }
      content += '\n';
    }
    
    await fs.writeFile(indexPath, content);
  }

  private async generateIndex(): Promise<void> {
    const indexPath = path.join(this.config.outputPath!, 'index.md');
    
    let content = `# Re-Shell Troubleshooting Guide\n\n`;
    content += `Welcome to the Re-Shell troubleshooting guide. This guide helps you diagnose and resolve common issues.\n\n`;
    
    content += `## Quick Diagnostics\n\n`;
    content += `Run the following command to perform automatic diagnostics:\n\n`;
    content += `\`\`\`bash\nre-shell diagnose\n\`\`\`\n\n`;
    
    content += `## Categories\n\n`;
    const categories = this.getUniqueCategories();
    for (const category of categories) {
      const guides = Array.from(this.guides.values()).filter(g => 
        g.diagnostics.some(d => d.category === category)
      );
      content += `- [${category.charAt(0).toUpperCase() + category.slice(1)}](./${category}/index.md) (${guides.length} guides)\n`;
    }
    content += '\n';
    
    content += `## Common Issues\n\n`;
    const commonGuides = Array.from(this.guides.values())
      .filter(g => g.difficulty === 'beginner')
      .slice(0, 5);
    
    for (const guide of commonGuides) {
      content += `- [${guide.title}](./${guide.diagnostics[0].category}/${guide.id}.md)\n`;
    }
    
    await fs.writeFile(indexPath, content);
  }

  private async generateNavigation(): Promise<void> {
    const navPath = path.join(this.config.outputPath!, 'navigation.json');
    
    const navigation = {
      sections: this.getUniqueCategories().map(category => ({
        title: category.charAt(0).toUpperCase() + category.slice(1),
        path: `./${category}/index.md`,
        items: Array.from(this.guides.values())
          .filter(g => g.diagnostics.some(d => d.category === category))
          .map(g => ({
            title: g.title,
            path: `./${category}/${g.id}.md`,
            difficulty: g.difficulty
          }))
      }))
    };
    
    await fs.writeJson(navPath, navigation, { spaces: 2 });
  }

  private async exportGuides(format: ExportFormat, report?: DiagnosticReport): Promise<void> {
    switch (format) {
      case 'html':
        await this.exportToHtml(report);
        break;
      case 'pdf':
        await this.exportToPdf();
        break;
      case 'markdown':
        // Already in markdown format
        break;
      case 'json':
        await this.exportToJson(report);
        break;
      case 'interactive':
        await this.generateInteractiveGuide();
        break;
    }
  }

  private async exportToHtml(report?: DiagnosticReport): Promise<void> {
    const htmlPath = path.join(this.config.outputPath!, 'html');
    await fs.ensureDir(htmlPath);

    // Generate main HTML page
    const mainHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Re-Shell Troubleshooting Guide</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 250px;
            height: 100vh;
            overflow-y: auto;
            background: #f5f5f5;
            padding: 20px;
        }
        .content {
            margin-left: 290px;
        }
        .diagnostic-result {
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
        }
        .pass { background: #d4edda; color: #155724; }
        .warning { background: #fff3cd; color: #856404; }
        .fail { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        pre {
            background: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        code {
            background: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2>Navigation</h2>
        <ul>
            <li><a href="#diagnostics">Diagnostics Report</a></li>
            <li><a href="#guides">Troubleshooting Guides</a></li>
            <li><a href="#recommendations">Recommendations</a></li>
        </ul>
    </div>
    <div class="content">
        <h1>Re-Shell Troubleshooting Guide</h1>
        ${report ? this.generateDiagnosticsHtml(report) : ''}
        ${this.generateGuidesHtml()}
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(htmlPath, 'index.html'), mainHtml);
  }

  private generateDiagnosticsHtml(report: DiagnosticReport): string {
    let html = '<section id="diagnostics">\n';
    html += '<h2>Diagnostics Report</h2>\n';
    html += `<p>Generated: ${report.timestamp.toLocaleString()}</p>\n`;
    
    html += '<h3>System Information</h3>\n';
    html += '<ul>\n';
    html += `<li>Platform: ${report.systemInfo.platform} (${report.systemInfo.arch})</li>\n`;
    html += `<li>Node.js: ${report.systemInfo.nodeVersion}</li>\n`;
    html += `<li>NPM: ${report.systemInfo.npmVersion}</li>\n`;
    html += `<li>Memory: ${Math.round(report.systemInfo.memory.used / 1024 / 1024 / 1024)}GB / ${Math.round(report.systemInfo.memory.total / 1024 / 1024 / 1024)}GB</li>\n`;
    html += `<li>CPU: ${report.systemInfo.cpu.model} (${report.systemInfo.cpu.cores} cores)</li>\n`;
    html += '</ul>\n';
    
    html += '<h3>Diagnostic Results</h3>\n';
    for (const result of report.diagnosticResults) {
      html += `<div class="diagnostic-result ${result.result.status}">\n`;
      html += `<h4>${result.checkName}</h4>\n`;
      html += `<p>${result.result.message}</p>\n`;
      if (result.result.suggestion) {
        html += `<p><strong>Suggestion:</strong> ${result.result.suggestion}</p>\n`;
      }
      html += '</div>\n';
    }
    
    html += '</section>\n';
    return html;
  }

  private generateGuidesHtml(): string {
    let html = '<section id="guides">\n';
    html += '<h2>Troubleshooting Guides</h2>\n';
    
    for (const guide of this.guides.values()) {
      html += `<div class="guide">\n`;
      html += `<h3>${guide.title}</h3>\n`;
      html += `<p>${guide.description}</p>\n`;
      html += '<h4>Symptoms</h4>\n';
      html += '<ul>\n';
      for (const symptom of guide.symptoms) {
        html += `<li>${symptom}</li>\n`;
      }
      html += '</ul>\n';
      html += '</div>\n';
    }
    
    html += '</section>\n';
    return html;
  }

  private async exportToPdf(): Promise<void> {
    // PDF export would require a library like puppeteer
    // For now, we'll create a placeholder
    const pdfPath = path.join(this.config.outputPath!, 'troubleshooting-guide.pdf');
    await fs.writeFile(pdfPath, 'PDF export not implemented yet');
  }

  private async exportToJson(report?: DiagnosticReport): Promise<void> {
    const jsonPath = path.join(this.config.outputPath!, 'troubleshooting.json');
    
    const data = {
      generated: new Date().toISOString(),
      guides: Array.from(this.guides.values()),
      diagnostics: Array.from(this.diagnostics.values()).map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        description: d.description
      })),
      report
    };
    
    await fs.writeJson(jsonPath, data, { spaces: 2 });
  }

  private async generateInteractiveGuide(): Promise<void> {
    const interactivePath = path.join(this.config.outputPath!, 'interactive');
    await fs.ensureDir(interactivePath);

    // Generate interactive troubleshooting wizard
    const wizardHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Re-Shell Interactive Troubleshooting</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .wizard-step {
            display: none;
            animation: fadeIn 0.3s;
        }
        .wizard-step.active {
            display: block;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .symptom-list {
            list-style: none;
            padding: 0;
        }
        .symptom-item {
            padding: 10px;
            margin: 5px 0;
            background: #f5f5f5;
            border-radius: 5px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .symptom-item:hover {
            background: #e0e0e0;
        }
        .symptom-item.selected {
            background: #007bff;
            color: white;
        }
        .diagnostic-running {
            padding: 20px;
            text-align: center;
            background: #f0f8ff;
            border-radius: 5px;
        }
        .solution {
            background: #f9f9f9;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #28a745;
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background: #0056b3;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #007bff;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <h1>Re-Shell Interactive Troubleshooting</h1>
    
    <div id="step1" class="wizard-step active">
        <h2>What issue are you experiencing?</h2>
        <ul class="symptom-list">
            ${this.generateSymptomsList()}
        </ul>
        <button onclick="nextStep()">Next</button>
    </div>
    
    <div id="step2" class="wizard-step">
        <h2>Running Diagnostics</h2>
        <div class="diagnostic-running">
            <div class="spinner"></div>
            <p>Analyzing your system...</p>
        </div>
    </div>
    
    <div id="step3" class="wizard-step">
        <h2>Recommended Solutions</h2>
        <div id="solutions"></div>
        <button onclick="runAutoFix()">Run Auto-Fix</button>
        <button onclick="startOver()">Start Over</button>
    </div>
    
    <script>
        let currentStep = 1;
        let selectedSymptoms = [];
        
        function selectSymptom(element, symptom) {
            element.classList.toggle('selected');
            if (selectedSymptoms.includes(symptom)) {
                selectedSymptoms = selectedSymptoms.filter(s => s !== symptom);
            } else {
                selectedSymptoms.push(symptom);
            }
        }
        
        function nextStep() {
            if (selectedSymptoms.length === 0) {
                alert('Please select at least one symptom');
                return;
            }
            
            document.getElementById('step1').classList.remove('active');
            document.getElementById('step2').classList.add('active');
            
            // Simulate diagnostics
            setTimeout(() => {
                showSolutions();
            }, 3000);
        }
        
        function showSolutions() {
            document.getElementById('step2').classList.remove('active');
            document.getElementById('step3').classList.add('active');
            
            // Generate solutions based on symptoms
            const solutionsDiv = document.getElementById('solutions');
            solutionsDiv.innerHTML = generateSolutions(selectedSymptoms);
        }
        
        function generateSolutions(symptoms) {
            // This would be dynamically generated based on the selected symptoms
            return \`
                <div class="solution">
                    <h3>Clean Install Dependencies</h3>
                    <p>Remove node_modules and reinstall all dependencies</p>
                    <pre>rm -rf node_modules package-lock.json
npm install</pre>
                </div>
                <div class="solution">
                    <h3>Clear Cache</h3>
                    <p>Clear npm and Re-Shell cache</p>
                    <pre>npm cache clean --force
re-shell cache clear</pre>
                </div>
            \`;
        }
        
        function runAutoFix() {
            alert('Auto-fix would run here. For safety, please run the commands manually.');
        }
        
        function startOver() {
            currentStep = 1;
            selectedSymptoms = [];
            document.querySelectorAll('.wizard-step').forEach(step => {
                step.classList.remove('active');
            });
            document.getElementById('step1').classList.add('active');
            document.querySelectorAll('.symptom-item').forEach(item => {
                item.classList.remove('selected');
            });
        }
    </script>
</body>
</html>`;

    await fs.writeFile(path.join(interactivePath, 'index.html'), wizardHtml);
  }

  private generateSymptomsList(): string {
    const allSymptoms = new Set<string>();
    for (const guide of this.guides.values()) {
      guide.symptoms.forEach(s => allSymptoms.add(s));
    }
    
    return Array.from(allSymptoms)
      .map(symptom => `<li class="symptom-item" onclick="selectSymptom(this, '${symptom}')">${symptom}</li>`)
      .join('\n');
  }

  private async saveReport(report: DiagnosticReport): Promise<void> {
    const reportPath = path.join(this.config.outputPath!, 'diagnostic-report.json');
    await fs.writeJson(reportPath, report, { spaces: 2 });
    report.exportPath = reportPath;
  }

  private countAutoFixes(): number {
    let count = 0;
    for (const diagnostic of this.diagnostics.values()) {
      if (diagnostic.autoFix) {
        count++;
      }
    }
    for (const check of this.customChecks.values()) {
      if (check.autoFix) {
        count++;
      }
    }
    return count;
  }

  async runDiagnostic(diagnosticId: string): Promise<CheckResult> {
    const diagnostic = this.diagnostics.get(diagnosticId);
    if (!diagnostic) {
      throw new Error(`Diagnostic ${diagnosticId} not found`);
    }
    return diagnostic.run();
  }

  async runAutoFix(diagnosticId: string): Promise<boolean> {
    const diagnostic = this.diagnostics.get(diagnosticId);
    if (!diagnostic || !diagnostic.autoFix) {
      throw new Error(`Auto-fix not available for ${diagnosticId}`);
    }
    return diagnostic.autoFix();
  }

  async searchGuides(query: string): Promise<TroubleshootingGuide[]> {
    const results: TroubleshootingGuide[] = [];
    const searchTerms = query.toLowerCase().split(' ');
    
    for (const guide of this.guides.values()) {
      const searchableText = [
        guide.title,
        guide.description,
        ...guide.symptoms,
        ...guide.tags
      ].join(' ').toLowerCase();
      
      if (searchTerms.every(term => searchableText.includes(term))) {
        results.push(guide);
      }
    }
    
    return results;
  }
}