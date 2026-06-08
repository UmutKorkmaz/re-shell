import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `security code-security` subcommand.
 * Extracted verbatim from the former monolithic security.group.ts.
 */
export function registerCodeSecurity(security: Command): void {
  security
  .command('code-security')
  .description('Generate code security analysis with SonarQube and AI enhancement')
  .argument('<name>', 'Name of the code security project')
  .option('--frequency <frequency>', 'Analysis frequency (on-commit, on-push, scheduled, manual)', 'scheduled')
  .option('--languages <languages>', 'Comma-separated languages to analyze', 'typescript,javascript,python')
  .option('--severity-threshold <threshold>', 'Severity threshold (blocker, critical, major, minor, info)', 'major')
  .option('--ai-enhanced', 'Enable AI-enhanced analysis')
  .option('--scan-tests', 'Include test files in analysis')
  .option('--analyze-complexity', 'Analyze code complexity')
  .option('--analyze-duplication', 'Analyze code duplication')
  .option('--analyze-hotspots', 'Analyze security hotspots')
  .option('--custom-rules', 'Enable custom rules')
  .option('--auto-fix', 'Enable automatic fixing of issues')
  .option('--parallel-analysis', 'Enable parallel analysis')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './code-security-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { codeSecurityAnalysis, writeFiles, displayConfig } = await import('../../utils/code-security-analysis.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    if (providers.length === 0) {
      providers.push('aws', 'azure', 'gcp');
    }

    const languages = options.languages.split(',') as ('typescript' | 'javascript' | 'python' | 'java' | 'go' | 'csharp' | 'cpp' | 'ruby' | 'php' | 'rust' | 'swift')[];

    const config = {
      projectName: name,
      providers,
      analysisSettings: {
        enabled: true,
        frequency: options.frequency as 'on-commit' | 'on-push' | 'scheduled' | 'manual',
        languages,
        severityThreshold: options.severityThreshold as 'blocker' | 'critical' | 'major' | 'minor' | 'info',
        failOnThreshold: options.severityThreshold as 'blocker' | 'critical' | 'major' | 'minor' | 'info',
        scanTests: options.scanTests || false,
        scanTestCoverage: false,
        analyzeComplexity: options.analyzeComplexity || false,
        analyzeDuplication: options.analyzeDuplication || false,
        analyzeSecurityHotspots: options.analyzeHotspots || false,
        customRulesEnabled: options.customRules || false,
        aiEnhancedAnalysis: options.aiEnhanced || false,
        autoFix: options.autoFix || false,
        parallelAnalysis: options.parallelAnalysis || false,
        maxAnalysisTime: 60,
      },
      codebases: [
        {
          id: 'codebase-001',
          name: 'web-application',
          language: 'typescript' as const,
          path: '/src',
          branch: 'main',
          lastCommitSha: 'abc123def456',
          lastScanned: new Date(Date.now() - 1 * 60 * 60 * 1000),
          totalFiles: 125,
          totalLines: 15420,
          codeLines: 11850,
          testLines: 3570,
          coverage: 78.5,
          complexity: 45,
          duplication: 3.2,
          securityRating: 'B' as const,
          reliabilityRating: 'A' as const,
          maintainabilityRating: 'B' as const,
          technicalDebt: 120,
          issues: [],
          hotspots: [],
          metrics: {
            files: [],
            functions: [],
            classes: [],
            complexity: [],
            coverage: [],
            duplication: [],
          },
        },
      ],
      issues: [
        {
          id: 'issue-001',
          ruleId: 'typescript:S2755',
          title: 'Debug statements should not be used in production code',
          description: 'Debug statements should be removed or disabled before deployment to production.',
          severity: 'major' as const,
          type: 'code-smell' as const,
          language: 'typescript' as const,
          file: 'src/app.ts',
          line: 42,
          endLine: 42,
          column: 8,
          endColumn: 18,
          effort: '5min',
          debt: '5',
          status: 'open' as const,
          author: 'John Doe',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          assignee: 'Jane Smith',
          rule: {} as any,
          codeSnippet: 'console.log("Debug info");',
          suggestedFix: '// Remove or use proper logging library',
          aiDetected: false,
          aiConfidence: 0,
          references: [],
          cwe: [],
          owasp: [],
        },
        {
          id: 'issue-002',
          ruleId: 'typescript:S2068',
          title: 'Potential SQL injection vulnerability',
          description: 'Using user input directly in SQL queries can lead to SQL injection attacks. Use parameterized queries instead.',
          severity: 'critical' as const,
          type: 'vulnerability' as const,
          language: 'typescript' as const,
          file: 'src/database.ts',
          line: 15,
          endLine: 15,
          column: 20,
          endColumn: 50,
          effort: '30min',
          debt: '30',
          status: 'open' as const,
          author: 'John Doe',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          assignee: 'Security Team',
          rule: {} as any,
          codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${userId}`;',
          suggestedFix: 'Use parameterized query: db.query("SELECT * FROM users WHERE id = ?", [userId])',
          aiDetected: true,
          aiConfidence: 0.92,
          references: [
            {
              type: 'cwe' as const,
              url: 'https://cwe.mitre.org/data/definitions/89.html',
              title: 'CWE-89: SQL Injection',
            },
            {
              type: 'owasp' as const,
              url: 'https://owasp.org/www-community/attacks/SQL_Injection',
              title: 'OWASP SQL Injection',
            },
          ],
          cwe: ['CWE-89'],
          owasp: ['A1: Injection'],
        },
      ],
      rules: [
        {
          id: 'rule-001',
          key: 'typescript:S2755',
          name: 'Debug statements should not be used in production code',
          type: 'code-smell' as const,
          severity: 'major' as const,
          language: 'typescript' as const,
          description: 'Debug statements should be removed or disabled before deployment.',
          htmlDescription: '<p>Debug statements should be removed...</p>',
          status: 'active' as const,
          tags: ['debug', 'production'],
          params: [],
          isActive: true,
          isTemplate: false,
          isCustom: false,
          createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          author: 'SonarSource',
          aiGenerated: false,
        },
      ],
      qualityGates: [
        {
          id: 'gate-001',
          name: 'Security Quality Gate',
          description: 'Ensure code meets security standards before merge',
          conditions: [
            {
              id: 'condition-001',
              metric: 'vulnerability',
              operator: 'lt' as const,
              threshold: 0,
              status: 'error' as const,
              actualValue: 1,
            },
            {
              id: 'condition-002',
              metric: 'coverage',
              operator: 'gt' as const,
              threshold: 75,
              status: 'ok' as const,
              actualValue: 78.5,
            },
          ],
          status: 'failed' as const,
          lastEvaluation: new Date(),
          evaluatedBy: 'CI/CD Pipeline',
        },
      ],
      aiModels: [
        {
          id: 'model-001',
          name: 'Vulnerability Detection Model',
          type: 'issue-detection' as const,
          language: 'typescript' as const,
          model: 'gpt-4',
          version: '1.0.0',
          accuracy: 0.92,
          precision: 0.89,
          recall: 0.94,
          f1Score: 0.915,
          trainingDataSize: 50000,
          lastTrained: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          status: 'deployed' as const,
          features: ['ast-patterns', 'code-context', 'semantic-analysis'],
          config: { temperature: 0.3, maxTokens: 2000 },
        },
      ],
      integrations: [
        {
          tool: 'sonarqube' as const,
          enabled: true,
          url: 'https://sonarqube.example.com',
          apiKey: 'sk-***',
          organization: 'my-org',
          projectKey: 'web-application',
          lastSync: new Date(Date.now() - 5 * 60 * 1000),
          status: 'connected' as const,
        },
      ],
      reports: [],
    };

    const finalConfig = codeSecurityAnalysis(config);
    displayConfig(finalConfig);

    await writeFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: code-security-${providers.join('.tf, code-security-')}.tf`));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'code-security-manager.ts' : 'code_security_manager.py'}`));
    console.log(chalk.green(`✅ Generated: CODE_SECURITY_ANALYSIS.md`));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green(`✅ Generated: code-security-config.json\n`));

    console.log(chalk.green('✓ Code security analysis project configured successfully!'));
  }));

}
