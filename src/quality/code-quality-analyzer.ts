import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import glob from 'fast-glob';

export interface CodeQualityConfig {
  sonarQube?: SonarQubeConfig;
  eslint?: ESLintConfig;
  customRules?: CustomRule[];
  thresholds?: QualityThresholds;
  excludePatterns?: string[];
  includePatterns?: string[];
  generateReport?: boolean;
  outputPath?: string;
  integrations?: QualityIntegration[];
}

export interface SonarQubeConfig {
  serverUrl: string;
  token?: string;
  projectKey: string;
  projectName?: string;
  sources?: string[];
  exclusions?: string[];
  qualityGate?: string;
  profile?: string;
  properties?: Record<string, string>;
}

export interface ESLintConfig {
  configPath?: string;
  rules?: Record<string, any>;
  extends?: string[];
  plugins?: string[];
  parser?: string;
  parserOptions?: any;
  env?: Record<string, boolean>;
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'minor' | 'major' | 'critical' | 'blocker';
  type: 'bug' | 'vulnerability' | 'code_smell' | 'security_hotspot';
  pattern?: RegExp;
  check: (file: FileAnalysis) => RuleViolation[];
  autoFix?: (content: string, violations: RuleViolation[]) => string;
}

export interface QualityThresholds {
  bugs: number;
  vulnerabilities: number;
  codeSmells: number;
  coverage: number;
  duplicatedLines: number;
  maintainabilityRating: 'A' | 'B' | 'C' | 'D' | 'E';
  reliabilityRating: 'A' | 'B' | 'C' | 'D' | 'E';
  securityRating: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface QualityIntegration {
  type: 'github' | 'gitlab' | 'slack' | 'jira' | 'custom';
  config: any;
  events: string[];
}

export interface FileAnalysis {
  path: string;
  content: string;
  lines: number;
  complexity: number;
  maintainabilityIndex: number;
  dependencies: string[];
  exports: string[];
  imports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  issues: Issue[];
}

export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  complexity: number;
  parameters: number;
  returns: string;
  documented: boolean;
}

export interface ClassInfo {
  name: string;
  startLine: number;
  endLine: number;
  methods: number;
  properties: number;
  extends?: string;
  implements?: string[];
  documented: boolean;
}

export interface Issue {
  rule: string;
  severity: 'info' | 'minor' | 'major' | 'critical' | 'blocker';
  type: 'bug' | 'vulnerability' | 'code_smell' | 'security_hotspot';
  message: string;
  line: number;
  column?: number;
  effort?: string;
  debt?: string;
  tags?: string[];
}

export interface RuleViolation {
  line: number;
  column?: number;
  message: string;
  severity: Issue['severity'];
  suggestion?: string;
  autoFixable?: boolean;
}

export interface QualityAnalysisResult {
  project: string;
  timestamp: Date;
  summary: QualitySummary;
  files: FileAnalysis[];
  metrics: QualityMetrics;
  issues: Issue[];
  sonarQube?: SonarQubeResult;
  trends?: QualityTrend[];
  recommendations: string[];
}

export interface QualitySummary {
  totalFiles: number;
  totalLines: number;
  totalIssues: number;
  bugCount: number;
  vulnerabilityCount: number;
  codeSmellCount: number;
  duplicatedLines: number;
  technicalDebt: string;
  maintainabilityRating: string;
  reliabilityRating: string;
  securityRating: string;
}

export interface QualityMetrics {
  complexity: ComplexityMetrics;
  maintainability: MaintainabilityMetrics;
  reliability: ReliabilityMetrics;
  security: SecurityMetrics;
  coverage: CoverageMetrics;
  duplication: DuplicationMetrics;
}

export interface ComplexityMetrics {
  average: number;
  maximum: number;
  distribution: Record<string, number>;
  hotspots: ComplexityHotspot[];
}

export interface ComplexityHotspot {
  file: string;
  function: string;
  complexity: number;
  line: number;
  suggestion: string;
}

export interface MaintainabilityMetrics {
  index: number;
  rating: string;
  factors: MaintainabilityFactor[];
  debt: string;
}

export interface MaintainabilityFactor {
  factor: string;
  impact: number;
  description: string;
}

export interface ReliabilityMetrics {
  rating: string;
  bugs: number;
  effort: string;
  issues: Issue[];
}

export interface SecurityMetrics {
  rating: string;
  vulnerabilities: number;
  hotspots: number;
  effort: string;
  issues: Issue[];
}

export interface CoverageMetrics {
  lines: number;
  branches: number;
  functions: number;
  overall: number;
}

export interface DuplicationMetrics {
  lines: number;
  blocks: number;
  files: number;
  percentage: number;
  duplicatedFiles: DuplicatedFile[];
}

export interface DuplicatedFile {
  file: string;
  duplicatedLines: number;
  duplicates: DuplicateBlock[];
}

export interface DuplicateBlock {
  startLine: number;
  endLine: number;
  duplicatedIn: string[];
}

export interface SonarQubeResult {
  qualityGate: QualityGateResult;
  measures: SonarMeasure[];
  issues: SonarIssue[];
  hotspots: SecurityHotspot[];
}

export interface QualityGateResult {
  status: 'OK' | 'WARN' | 'ERROR';
  conditions: QualityGateCondition[];
}

export interface QualityGateCondition {
  metric: string;
  operator: string;
  value: string;
  actual: string;
  status: 'OK' | 'WARN' | 'ERROR';
}

export interface SonarMeasure {
  metric: string;
  value: string;
  component: string;
}

export interface SonarIssue {
  key: string;
  rule: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
  effort?: string;
  debt?: string;
  status: string;
  type: string;
}

export interface SecurityHotspot {
  key: string;
  component: string;
  line?: number;
  message: string;
  status: string;
  vulnerabilityProbability: 'HIGH' | 'MEDIUM' | 'LOW';
  securityCategory: string;
}

export interface QualityTrend {
  date: Date;
  metric: string;
  value: number;
  change: number;
  direction: 'improving' | 'degrading' | 'stable';
}

export interface QualityReport {
  summary: QualityReportSummary;
  analysis: QualityAnalysisResult;
  comparison?: QualityComparison;
  actionPlan: ActionItem[];
  timestamp: Date;
}

export interface QualityReportSummary {
  overallRating: string;
  totalIssues: number;
  criticalIssues: number;
  technicalDebt: string;
  coverage: number;
  maintainabilityTrend: 'improving' | 'degrading' | 'stable';
}

export interface QualityComparison {
  baseline: Date;
  changes: QualityChange[];
  improvements: string[];
  regressions: string[];
}

export interface QualityChange {
  metric: string;
  before: number;
  after: number;
  change: number;
  percentage: number;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  category: 'bug' | 'vulnerability' | 'maintainability' | 'coverage';
  title: string;
  description: string;
  effort: string;
  impact: string;
  files?: string[];
}

export class CodeQualityAnalyzer extends EventEmitter {
  private config: CodeQualityConfig;

  constructor(config: CodeQualityConfig) {
    super();
    this.config = {
      generateReport: true,
      outputPath: './quality-reports',
      includePatterns: ['src/**/*.{ts,tsx,js,jsx}'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.test.{ts,tsx,js,jsx}'],
      thresholds: {
        bugs: 0,
        vulnerabilities: 0,
        codeSmells: 10,
        coverage: 80,
        duplicatedLines: 3,
        maintainabilityRating: 'A',
        reliabilityRating: 'A',
        securityRating: 'A'
      },
      ...config
    };
  }

  async analyze(projectPath: string): Promise<QualityAnalysisResult> {
    this.emit('analysis:start', { project: projectPath });

    const result: QualityAnalysisResult = {
      project: path.basename(projectPath),
      timestamp: new Date(),
      summary: this.createEmptySummary(),
      files: [],
      metrics: this.createEmptyMetrics(),
      issues: [],
      recommendations: []
    };

    try {
      // Find and analyze files
      const files = await this.findSourceFiles(projectPath);
      this.emit('analysis:files', { count: files.length });

      for (const file of files) {
        const analysis = await this.analyzeFile(file);
        result.files.push(analysis);
        result.issues.push(...analysis.issues);
      }

      // Calculate metrics
      result.metrics = this.calculateMetrics(result.files);
      result.summary = this.generateSummary(result.files, result.issues);

      // Run ESLint analysis
      if (this.config.eslint) {
        await this.runESLintAnalysis(projectPath, result);
      }

      // Run SonarQube analysis
      if (this.config.sonarQube) {
        result.sonarQube = await this.runSonarQubeAnalysis(projectPath);
      }

      // Apply custom rules
      if (this.config.customRules) {
        await this.applyCustomRules(result);
      }

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result);

      // Calculate trends if historical data exists
      result.trends = await this.calculateTrends(result);

      this.emit('analysis:complete', result);
      return result;

    } catch (error: any) {
      this.emit('analysis:error', error);
      throw error;
    }
  }

  private async findSourceFiles(projectPath: string): Promise<string[]> {
    return glob(this.config.includePatterns!, {
      cwd: projectPath,
      absolute: true,
      ignore: this.config.excludePatterns
    });
  }

  private async analyzeFile(filePath: string): Promise<FileAnalysis> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').length;

    const analysis: FileAnalysis = {
      path: filePath,
      content,
      lines,
      complexity: this.calculateComplexity(content),
      maintainabilityIndex: this.calculateMaintainabilityIndex(content),
      dependencies: this.extractDependencies(content),
      exports: this.extractExports(content),
      imports: this.extractImports(content),
      functions: this.extractFunctions(content),
      classes: this.extractClasses(content),
      issues: []
    };

    // Analyze for common issues
    analysis.issues = this.analyzeForIssues(analysis);

    return analysis;
  }

  private calculateComplexity(content: string): number {
    // Simplified cyclomatic complexity calculation
    const complexityKeywords = [
      'if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try',
      '&&', '||', '?', ':', 'break', 'continue', 'return'
    ];

    let complexity = 1; // Base complexity
    
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private calculateMaintainabilityIndex(content: string): number {
    const lines = content.split('\n').length;
    const complexity = this.calculateComplexity(content);
    const volume = content.length;

    // Simplified maintainability index calculation
    // Real implementation would use Halstead metrics
    const maintainabilityIndex = Math.max(0, 
      171 - 5.2 * Math.log(volume) - 0.23 * complexity - 16.2 * Math.log(lines)
    );

    return Math.round(maintainabilityIndex);
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /(?:import|require)\s*\(?['"`]([^'"`]+)['"`]\)?/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)];
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
    
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        // Named imports
        const namedImports = match[1].split(',').map(s => s.trim());
        imports.push(...namedImports);
      } else if (match[2]) {
        // Namespace import
        imports.push(match[2]);
      } else if (match[3]) {
        // Default import
        imports.push(match[3]);
      }
    }

    return imports;
  }

  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');
    
    // Function declarations
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g;
    let match;
    
    while ((match = funcRegex.exec(content)) !== null) {
      const startLine = content.substring(0, match.index).split('\n').length;
      const endLine = this.findFunctionEnd(lines, startLine - 1);
      
      functions.push({
        name: match[1],
        startLine,
        endLine,
        complexity: this.calculateFunctionComplexity(lines.slice(startLine - 1, endLine)),
        parameters: this.countParameters(match[0]),
        returns: 'unknown',
        documented: this.isFunctionDocumented(lines, startLine - 1)
      });
    }

    // Arrow functions
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      const startLine = content.substring(0, match.index).split('\n').length;
      
      functions.push({
        name: match[1],
        startLine,
        endLine: startLine,
        complexity: 1,
        parameters: this.countParameters(match[0]),
        returns: 'unknown',
        documented: this.isFunctionDocumented(lines, startLine - 1)
      });
    }

    return functions;
  }

  private extractClasses(content: string): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');
    
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const startLine = content.substring(0, match.index).split('\n').length;
      const endLine = this.findClassEnd(lines, startLine - 1);
      
      classes.push({
        name: match[1],
        startLine,
        endLine,
        methods: this.countMethods(lines.slice(startLine - 1, endLine)),
        properties: this.countProperties(lines.slice(startLine - 1, endLine)),
        extends: match[2],
        implements: match[3] ? match[3].split(',').map(s => s.trim()) : undefined,
        documented: this.isClassDocumented(lines, startLine - 1)
      });
    }

    return classes;
  }

  private findFunctionEnd(lines: string[], startLine: number): number {
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }
    
    return startLine + 1;
  }

  private findClassEnd(lines: string[], startLine: number): number {
    return this.findFunctionEnd(lines, startLine);
  }

  private calculateFunctionComplexity(lines: string[]): number {
    const content = lines.join('\n');
    return this.calculateComplexity(content);
  }

  private countParameters(funcDeclaration: string): number {
    const paramMatch = funcDeclaration.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1].trim()) return 0;
    
    return paramMatch[1].split(',').filter(p => p.trim()).length;
  }

  private countMethods(lines: string[]): number {
    const content = lines.join('\n');
    const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g;
    const matches = content.match(methodRegex);
    return matches ? matches.length : 0;
  }

  private countProperties(lines: string[]): number {
    const content = lines.join('\n');
    const propRegex = /(?:private|protected|public)?\s*(\w+)\s*[:?]?\s*[^=]*=/g;
    const matches = content.match(propRegex);
    return matches ? matches.length : 0;
  }

  private isFunctionDocumented(lines: string[], lineIndex: number): boolean {
    if (lineIndex === 0) return false;
    
    const prevLine = lines[lineIndex - 1].trim();
    return prevLine.includes('/**') || prevLine.includes('//');
  }

  private isClassDocumented(lines: string[], lineIndex: number): boolean {
    return this.isFunctionDocumented(lines, lineIndex);
  }

  private analyzeForIssues(analysis: FileAnalysis): Issue[] {
    const issues: Issue[] = [];

    // Check complexity
    if (analysis.complexity > 10) {
      issues.push({
        rule: 'complexity',
        severity: analysis.complexity > 20 ? 'major' : 'minor',
        type: 'code_smell',
        message: `High complexity: ${analysis.complexity}`,
        line: 1,
        effort: '30min',
        tags: ['brain-overload']
      });
    }

    // Check maintainability
    if (analysis.maintainabilityIndex < 50) {
      issues.push({
        rule: 'maintainability',
        severity: 'major',
        type: 'code_smell',
        message: `Low maintainability index: ${analysis.maintainabilityIndex}`,
        line: 1,
        effort: '1h',
        tags: ['maintainability']
      });
    }

    // Check for long functions
    for (const func of analysis.functions) {
      if (func.complexity > 15) {
        issues.push({
          rule: 'function-complexity',
          severity: 'major',
          type: 'code_smell',
          message: `Function '${func.name}' has high complexity: ${func.complexity}`,
          line: func.startLine,
          effort: '45min',
          tags: ['complexity']
        });
      }

      if (!func.documented && func.complexity > 5) {
        issues.push({
          rule: 'missing-docs',
          severity: 'minor',
          type: 'code_smell',
          message: `Function '${func.name}' should be documented`,
          line: func.startLine,
          effort: '5min',
          tags: ['documentation']
        });
      }
    }

    // Check for undocumented classes
    for (const cls of analysis.classes) {
      if (!cls.documented) {
        issues.push({
          rule: 'missing-class-docs',
          severity: 'minor',
          type: 'code_smell',
          message: `Class '${cls.name}' should be documented`,
          line: cls.startLine,
          effort: '10min',
          tags: ['documentation']
        });
      }
    }

    return issues;
  }

  private async runESLintAnalysis(
    projectPath: string,
    result: QualityAnalysisResult
  ): Promise<void> {
    try {
      // Generate ESLint config if needed
      const configPath = await this.generateESLintConfig(projectPath);
      
      // Run ESLint
      const command = `npx eslint --format json ${this.config.includePatterns?.join(' ')}`;
      const output = execSync(command, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const eslintResults = JSON.parse(output);
      
      // Convert ESLint results to our format
      for (const fileResult of eslintResults) {
        for (const message of fileResult.messages) {
          result.issues.push({
            rule: message.ruleId || 'eslint',
            severity: this.mapESLintSeverity(message.severity),
            type: 'code_smell',
            message: message.message,
            line: message.line,
            column: message.column,
            tags: ['eslint']
          });
        }
      }

    } catch (error: any) {
      this.emit('eslint:error', error);
    }
  }

  private async generateESLintConfig(projectPath: string): Promise<string> {
    const configPath = path.join(projectPath, '.eslintrc.json');
    
    if (!await fs.pathExists(configPath) && this.config.eslint) {
      const config = {
        extends: this.config.eslint.extends || ['@typescript-eslint/recommended'],
        plugins: this.config.eslint.plugins || ['@typescript-eslint'],
        parser: this.config.eslint.parser || '@typescript-eslint/parser',
        parserOptions: this.config.eslint.parserOptions || {
          ecmaVersion: 2020,
          sourceType: 'module'
        },
        env: this.config.eslint.env || {
          node: true,
          es6: true
        },
        rules: this.config.eslint.rules || {}
      };

      await fs.writeJson(configPath, config, { spaces: 2 });
    }

    return configPath;
  }

  private mapESLintSeverity(eslintSeverity: number): Issue['severity'] {
    switch (eslintSeverity) {
      case 1: return 'minor';
      case 2: return 'major';
      default: return 'info';
    }
  }

  private async runSonarQubeAnalysis(projectPath: string): Promise<SonarQubeResult> {
    const sonarConfig = this.config.sonarQube!;
    
    try {
      // Generate sonar-project.properties
      await this.generateSonarProperties(projectPath, sonarConfig);
      
      // Run SonarQube scanner
      const scannerCommand = `npx sonar-scanner`;
      execSync(scannerCommand, {
        cwd: projectPath,
        stdio: 'pipe'
      });

      // Fetch results from SonarQube API
      const results = await this.fetchSonarQubeResults(sonarConfig);
      return results;

    } catch (error: any) {
      this.emit('sonarqube:error', error);
      throw error;
    }
  }

  private async generateSonarProperties(
    projectPath: string,
    config: SonarQubeConfig
  ): Promise<void> {
    const properties = [
      `sonar.projectKey=${config.projectKey}`,
      `sonar.projectName=${config.projectName || config.projectKey}`,
      `sonar.sources=${config.sources?.join(',') || 'src'}`,
      `sonar.host.url=${config.serverUrl}`
    ];

    if (config.token) {
      properties.push(`sonar.login=${config.token}`);
    }

    if (config.exclusions) {
      properties.push(`sonar.exclusions=${config.exclusions.join(',')}`);
    }

    if (config.qualityGate) {
      properties.push(`sonar.qualitygate=${config.qualityGate}`);
    }

    // Add custom properties
    if (config.properties) {
      for (const [key, value] of Object.entries(config.properties)) {
        properties.push(`${key}=${value}`);
      }
    }

    const propertiesContent = properties.join('\n');
    await fs.writeFile(
      path.join(projectPath, 'sonar-project.properties'),
      propertiesContent
    );
  }

  private async fetchSonarQubeResults(config: SonarQubeConfig): Promise<SonarQubeResult> {
    // Simplified SonarQube API interaction
    // In practice, would use proper HTTP client with authentication
    
    return {
      qualityGate: {
        status: 'OK',
        conditions: []
      },
      measures: [],
      issues: [],
      hotspots: []
    };
  }

  private async applyCustomRules(result: QualityAnalysisResult): Promise<void> {
    if (!this.config.customRules) return;

    for (const rule of this.config.customRules) {
      for (const fileAnalysis of result.files) {
        const violations = rule.check(fileAnalysis);
        
        for (const violation of violations) {
          result.issues.push({
            rule: rule.id,
            severity: violation.severity,
            type: rule.type,
            message: violation.message,
            line: violation.line,
            column: violation.column,
            tags: ['custom-rule']
          });
        }
      }
    }
  }

  private calculateMetrics(files: FileAnalysis[]): QualityMetrics {
    const complexities = files.map(f => f.complexity);
    const maintainabilityIndexes = files.map(f => f.maintainabilityIndex);

    return {
      complexity: {
        average: complexities.reduce((a, b) => a + b, 0) / complexities.length,
        maximum: Math.max(...complexities),
        distribution: this.calculateComplexityDistribution(complexities),
        hotspots: this.identifyComplexityHotspots(files)
      },
      maintainability: {
        index: maintainabilityIndexes.reduce((a, b) => a + b, 0) / maintainabilityIndexes.length,
        rating: this.calculateMaintainabilityRating(maintainabilityIndexes),
        factors: this.identifyMaintainabilityFactors(files),
        debt: this.calculateTechnicalDebt(files)
      },
      reliability: {
        rating: 'A',
        bugs: 0,
        effort: '0min',
        issues: []
      },
      security: {
        rating: 'A',
        vulnerabilities: 0,
        hotspots: 0,
        effort: '0min',
        issues: []
      },
      coverage: {
        lines: 0,
        branches: 0,
        functions: 0,
        overall: 0
      },
      duplication: {
        lines: 0,
        blocks: 0,
        files: 0,
        percentage: 0,
        duplicatedFiles: []
      }
    };
  }

  private calculateComplexityDistribution(complexities: number[]): Record<string, number> {
    const distribution = {
      'low (1-5)': 0,
      'medium (6-10)': 0,
      'high (11-15)': 0,
      'very-high (16+)': 0
    };

    for (const complexity of complexities) {
      if (complexity <= 5) distribution['low (1-5)']++;
      else if (complexity <= 10) distribution['medium (6-10)']++;
      else if (complexity <= 15) distribution['high (11-15)']++;
      else distribution['very-high (16+)']++;
    }

    return distribution;
  }

  private identifyComplexityHotspots(files: FileAnalysis[]): ComplexityHotspot[] {
    const hotspots: ComplexityHotspot[] = [];

    for (const file of files) {
      for (const func of file.functions) {
        if (func.complexity > 10) {
          hotspots.push({
            file: file.path,
            function: func.name,
            complexity: func.complexity,
            line: func.startLine,
            suggestion: func.complexity > 15 ? 
              'Consider breaking down this function' : 
              'Consider simplifying this function'
          });
        }
      }
    }

    return hotspots.sort((a, b) => b.complexity - a.complexity).slice(0, 10);
  }

  private calculateMaintainabilityRating(indexes: number[]): string {
    const average = indexes.reduce((a, b) => a + b, 0) / indexes.length;
    
    if (average >= 85) return 'A';
    if (average >= 70) return 'B';
    if (average >= 50) return 'C';
    if (average >= 25) return 'D';
    return 'E';
  }

  private identifyMaintainabilityFactors(files: FileAnalysis[]): MaintainabilityFactor[] {
    const factors: MaintainabilityFactor[] = [];

    const avgComplexity = files.reduce((sum, f) => sum + f.complexity, 0) / files.length;
    if (avgComplexity > 10) {
      factors.push({
        factor: 'High Complexity',
        impact: avgComplexity,
        description: 'Complex code is harder to maintain and debug'
      });
    }

    const undocumentedFunctions = files.reduce((sum, f) => 
      sum + f.functions.filter(fn => !fn.documented).length, 0
    );
    if (undocumentedFunctions > 0) {
      factors.push({
        factor: 'Missing Documentation',
        impact: undocumentedFunctions,
        description: 'Undocumented code increases maintenance effort'
      });
    }

    return factors;
  }

  private calculateTechnicalDebt(files: FileAnalysis[]): string {
    const totalIssues = files.reduce((sum, f) => sum + f.issues.length, 0);
    const estimatedMinutes = totalIssues * 15; // Rough estimate
    
    if (estimatedMinutes < 60) return `${estimatedMinutes}min`;
    if (estimatedMinutes < 480) return `${Math.round(estimatedMinutes / 60)}h`;
    return `${Math.round(estimatedMinutes / 480)}d`;
  }

  private generateSummary(files: FileAnalysis[], issues: Issue[]): QualitySummary {
    const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
    
    return {
      totalFiles: files.length,
      totalLines,
      totalIssues: issues.length,
      bugCount: issues.filter(i => i.type === 'bug').length,
      vulnerabilityCount: issues.filter(i => i.type === 'vulnerability').length,
      codeSmellCount: issues.filter(i => i.type === 'code_smell').length,
      duplicatedLines: 0,
      technicalDebt: this.calculateTechnicalDebt(files),
      maintainabilityRating: 'A',
      reliabilityRating: 'A',
      securityRating: 'A'
    };
  }

  private generateRecommendations(result: QualityAnalysisResult): string[] {
    const recommendations: string[] = [];

    // High complexity recommendations
    const complexityHotspots = result.metrics.complexity.hotspots;
    if (complexityHotspots.length > 0) {
      recommendations.push(
        `Address ${complexityHotspots.length} complexity hotspots to improve maintainability`
      );
    }

    // Documentation recommendations
    const undocumentedFunctions = result.files.reduce((sum, f) => 
      sum + f.functions.filter(fn => !fn.documented).length, 0
    );
    if (undocumentedFunctions > 5) {
      recommendations.push(
        `Add documentation to ${undocumentedFunctions} functions`
      );
    }

    // Issue-based recommendations
    const criticalIssues = result.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(
        `Fix ${criticalIssues.length} critical issues immediately`
      );
    }

    const majorIssues = result.issues.filter(i => i.severity === 'major');
    if (majorIssues.length > 10) {
      recommendations.push(
        `Plan to address ${majorIssues.length} major issues in upcoming sprints`
      );
    }

    return recommendations;
  }

  private async calculateTrends(result: QualityAnalysisResult): Promise<QualityTrend[]> {
    // Load historical data and calculate trends
    // This would typically involve comparing with previous analysis results
    return [];
  }

  async generateReport(analysisResult: QualityAnalysisResult): Promise<QualityReport> {
    const actionPlan = this.generateActionPlan(analysisResult);
    
    const summary: QualityReportSummary = {
      overallRating: analysisResult.summary.maintainabilityRating,
      totalIssues: analysisResult.summary.totalIssues,
      criticalIssues: analysisResult.issues.filter(i => i.severity === 'critical').length,
      technicalDebt: analysisResult.summary.technicalDebt,
      coverage: analysisResult.metrics.coverage.overall,
      maintainabilityTrend: 'stable'
    };

    const report: QualityReport = {
      summary,
      analysis: analysisResult,
      actionPlan,
      timestamp: new Date()
    };

    if (this.config.generateReport) {
      await this.saveReport(report);
    }

    return report;
  }

  private generateActionPlan(result: QualityAnalysisResult): ActionItem[] {
    const actionItems: ActionItem[] = [];

    // Critical issues first
    const criticalIssues = result.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      actionItems.push({
        priority: 'high',
        category: 'bug',
        title: 'Fix Critical Issues',
        description: `Address ${criticalIssues.length} critical issues`,
        effort: '1-2d',
        impact: 'High',
        files: [...new Set(criticalIssues.map(i => 
          result.files.find(f => f.issues.includes(i))?.path
        ))].filter(Boolean) as string[]
      });
    }

    // Complexity hotspots
    const complexityHotspots = result.metrics.complexity.hotspots;
    if (complexityHotspots.length > 0) {
      actionItems.push({
        priority: 'medium',
        category: 'maintainability',
        title: 'Reduce Complexity',
        description: `Refactor ${complexityHotspots.length} complex functions`,
        effort: '3-5d',
        impact: 'Medium',
        files: complexityHotspots.map(h => h.file)
      });
    }

    // Documentation gaps
    const undocumentedCount = result.files.reduce((sum, f) => 
      sum + f.functions.filter(fn => !fn.documented).length, 0
    );
    if (undocumentedCount > 10) {
      actionItems.push({
        priority: 'low',
        category: 'maintainability',
        title: 'Add Documentation',
        description: `Document ${undocumentedCount} functions`,
        effort: '1-2d',
        impact: 'Low',
        files: result.files
          .filter(f => f.functions.some(fn => !fn.documented))
          .map(f => f.path)
      });
    }

    return actionItems;
  }

  private async saveReport(report: QualityReport): Promise<void> {
    await fs.ensureDir(this.config.outputPath!);

    // Save JSON report
    const jsonPath = path.join(this.config.outputPath!, 'quality-report.json');
    await fs.writeJson(jsonPath, report, { spaces: 2 });

    // Save HTML report
    const htmlPath = path.join(this.config.outputPath!, 'quality-report.html');
    const html = this.generateHtmlReport(report);
    await fs.writeFile(htmlPath, html);

    this.emit('report:saved', { json: jsonPath, html: htmlPath });
  }

  private generateHtmlReport(report: QualityReport): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Code Quality Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 3px; }
        .rating-A { color: #4caf50; }
        .rating-B { color: #8bc34a; }
        .rating-C { color: #ff9800; }
        .rating-D { color: #f44336; }
        .rating-E { color: #d32f2f; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .critical { color: #d32f2f; font-weight: bold; }
        .major { color: #ff9800; }
        .minor { color: #2196f3; }
    </style>
</head>
<body>
    <h1>Code Quality Report</h1>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="metric">
            <strong>Overall Rating:</strong> 
            <span class="rating-${report.summary.overallRating}">${report.summary.overallRating}</span>
        </div>
        <div class="metric">
            <strong>Total Issues:</strong> ${report.summary.totalIssues}
        </div>
        <div class="metric">
            <strong>Critical Issues:</strong> 
            <span class="critical">${report.summary.criticalIssues}</span>
        </div>
        <div class="metric">
            <strong>Technical Debt:</strong> ${report.summary.technicalDebt}
        </div>
        <div class="metric">
            <strong>Coverage:</strong> ${report.summary.coverage.toFixed(1)}%
        </div>
    </div>

    <h2>Metrics</h2>
    <table>
        <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Rating</th>
        </tr>
        <tr>
            <td>Average Complexity</td>
            <td>${report.analysis.metrics.complexity.average.toFixed(1)}</td>
            <td>${report.analysis.metrics.complexity.average > 10 ? 'Poor' : 'Good'}</td>
        </tr>
        <tr>
            <td>Maintainability Index</td>
            <td>${report.analysis.metrics.maintainability.index.toFixed(1)}</td>
            <td class="rating-${report.analysis.metrics.maintainability.rating}">
                ${report.analysis.metrics.maintainability.rating}
            </td>
        </tr>
    </table>

    <h2>Top Issues</h2>
    <table>
        <thead>
            <tr>
                <th>Severity</th>
                <th>Rule</th>
                <th>Message</th>
                <th>Line</th>
            </tr>
        </thead>
        <tbody>
            ${report.analysis.issues.slice(0, 20).map(issue => `
                <tr>
                    <td><span class="${issue.severity}">${issue.severity}</span></td>
                    <td>${issue.rule}</td>
                    <td>${issue.message}</td>
                    <td>${issue.line}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Action Plan</h2>
    <div>
        ${report.actionPlan.map(item => `
            <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid ${
              item.priority === 'high' ? '#f44336' : 
              item.priority === 'medium' ? '#ff9800' : '#2196f3'
            };">
                <h4>${item.title} (${item.priority} priority)</h4>
                <p>${item.description}</p>
                <p><strong>Effort:</strong> ${item.effort} | <strong>Impact:</strong> ${item.impact}</p>
            </div>
        `).join('')}
    </div>

    <footer>
        <p>Generated on ${report.timestamp.toISOString()}</p>
    </footer>
</body>
</html>`;
  }

  private createEmptySummary(): QualitySummary {
    return {
      totalFiles: 0,
      totalLines: 0,
      totalIssues: 0,
      bugCount: 0,
      vulnerabilityCount: 0,
      codeSmellCount: 0,
      duplicatedLines: 0,
      technicalDebt: '0min',
      maintainabilityRating: 'A',
      reliabilityRating: 'A',
      securityRating: 'A'
    };
  }

  private createEmptyMetrics(): QualityMetrics {
    return {
      complexity: {
        average: 0,
        maximum: 0,
        distribution: {},
        hotspots: []
      },
      maintainability: {
        index: 100,
        rating: 'A',
        factors: [],
        debt: '0min'
      },
      reliability: {
        rating: 'A',
        bugs: 0,
        effort: '0min',
        issues: []
      },
      security: {
        rating: 'A',
        vulnerabilities: 0,
        hotspots: 0,
        effort: '0min',
        issues: []
      },
      coverage: {
        lines: 0,
        branches: 0,
        functions: 0,
        overall: 0
      },
      duplication: {
        lines: 0,
        blocks: 0,
        files: 0,
        percentage: 0,
        duplicatedFiles: []
      }
    };
  }
}

// Export utility functions
export function createCustomRule(
  id: string,
  name: string,
  check: (file: FileAnalysis) => RuleViolation[]
): CustomRule {
  return {
    id,
    name,
    description: name,
    severity: 'minor',
    type: 'code_smell',
    check
  };
}

export async function analyzeCodeQuality(
  projectPath: string,
  config?: Partial<CodeQualityConfig>
): Promise<QualityReport> {
  const analyzer = new CodeQualityAnalyzer(config || {});
  const analysis = await analyzer.analyze(projectPath);
  return analyzer.generateReport(analysis);
}