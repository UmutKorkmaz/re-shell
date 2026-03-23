/**
 * Cross-Language Code Review Tools with Polyglot Best Practices
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type ReviewLanguage = 'typescript' | 'python';

export interface ReviewConfig {
  projectName: string;
  language: ReviewLanguage;
  outputDir: string;
  enableBestPractices: boolean;
  enableStyleChecks: boolean;
  enableSecurityChecks: boolean;
  enablePerformanceChecks: boolean;
}

// TypeScript Code Review (Simplified)
export function generateTypeScriptReview(config: ReviewConfig): string {
  let code = '// Auto-generated Code Review Tools for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface ReviewIssue {\n';
  code += '  file: string;\n';
  code += '  line: number;\n';
  code += '  column: number;\n';
  code += '  severity: \'error\' | \'warning\' | \'info\';\n';
  code += '  category: string;\n';
  code += '  message: string;\n';
  code += '  suggestion?: string;\n';
  code += '}\n\n';

  code += 'interface ReviewReport {\n';
  code += '  timestamp: string;\n';
  code += '  totalIssues: number;\n';
  code += '  errors: number;\n';
  code += '  warnings: number;\n';
  code += '  info: number;\n';
  code += '  issues: ReviewIssue[];\n';
  code += '  summary: Record<string, number>;\n';
  code += '}\n\n';

  code += 'class CodeReviewer {\n';
  code += '  private enableBestPractices: boolean;\n';
  code += '  private enableStyleChecks: boolean;\n';
  code += '  private enableSecurityChecks: boolean;\n';
  code += '  private enablePerformanceChecks: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.enableBestPractices = options.enableBestPractices !== false;\n';
  code += '    this.enableStyleChecks = options.enableStyleChecks !== false;\n';
  code += '    this.enableSecurityChecks = options.enableSecurityChecks !== false;\n';
  code += '    this.enablePerformanceChecks = options.enablePerformanceChecks !== false;\n';
  code += '  }\n\n';

  code += '  reviewFile(filePath: string): ReviewIssue[] {\n';
  code += '    const issues: ReviewIssue[] = [];\n';
  code += '    const content = fs.readFileSync(filePath, \'utf-8\');\n';
  code += '    const lines = content.split(\'\\n\');\n\n';

  code += '    for (let i = 0; i < lines.length; i++) {\n';
  code += '      const line = lines[i];\n';
  code += '      const lineNum = i + 1;\n\n';

  code += '      // Best practices checks\n';
  code += '      if (this.enableBestPractices) {\n';
  code += '        issues.push(...this.checkBestPractices(filePath, lineNum, line));\n';
  code += '      }\n\n';

  code += '      // Style checks\n';
  code += '      if (this.enableStyleChecks) {\n';
  code += '        issues.push(...this.checkStyle(filePath, lineNum, line));\n';
  code += '      }\n\n';

  code += '      // Security checks\n';
  code += '      if (this.enableSecurityChecks) {\n';
  code += '        issues.push(...this.checkSecurity(filePath, lineNum, line));\n';
  code += '      }\n\n';

  code += '      // Performance checks\n';
  code += '      if (this.enablePerformanceChecks) {\n';
  code += '        issues.push(...this.checkPerformance(filePath, lineNum, line));\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  private checkBestPractices(file: string, line: number, content: string): ReviewIssue[] {\n';
  code += '    const issues: ReviewIssue[] = [];\n\n';

  code += '    // Check for any types\n';
  code += '    if (content.includes(\': any\')) {\n';
  code += '      issues.push({\n';
  code += '        file,\n';
  code += '        line,\n';
  code += '        column: content.indexOf(\': any\'),\n';
  code += '        severity: \'warning\',\n';
  code += '        category: \'Best Practices\',\n';
  code += '        message: \'Avoid using "any" type\',\n';
  code += '        suggestion: \'Use specific types instead of any\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    // Check for console.log in production\n';
  code += '    if (content.includes(\'console.log\')) {\n';
  code += '      issues.push({\n';
  code += '        file,\n';
  code += '        line,\n';
  code += '        column: content.indexOf(\'console.log\'),\n';
  code += '        severity: \'info\',\n';
  code += '        category: \'Best Practices\',\n';
  code += '        message: \'console.log statement found\',\n';
  code += '        suggestion: \'Use proper logging library\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  private checkStyle(file: string, line: number, content: string): ReviewIssue[] {\n';
  code += '    const issues: ReviewIssue[] = [];\n\n';

  code += '    // Check line length\n';
  code += '    if (content.length > 100) {\n';
  code += '      issues.push({\n';
  code += '        file,\n';
  code += '        line,\n';
  code += '        column: 100,\n';
  code += '        severity: \'warning\',\n';
  code += '        category: \'Style\',\n';
  code += '        message: \'Line too long (\' + content.length + \' characters)\',\n';
  code += '        suggestion: \'Break line into multiple lines\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  private checkSecurity(file: string, line: number, content: string): ReviewIssue[] {\n';
  code += '    const issues: ReviewIssue[] = [];\n\n';

  code += '    // Check for eval\n';
  code += '    if (content.includes(\'eval(\')) {\n';
  code += '      issues.push({\n';
  code += '        file,\n';
  code += '        line,\n';
  code += '        column: content.indexOf(\'eval(\'),\n';
  code += '        severity: \'error\',\n';
  code += '        category: \'Security\',\n';
  code += '        message: \'Use of eval() is dangerous\',\n';
  code += '        suggestion: \'Avoid eval() - use safer alternatives\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  private checkPerformance(file: string, line: number, content: string): ReviewIssue[] {\n';
  code += '    const issues: ReviewIssue[] = [];\n\n';

  code += '    // Check for nested loops\n';
  code += '    if ((content.match(/fors*\\(/g) || []).length > 1) {\n';
  code += '      issues.push({\n';
  code += '        file,\n';
  code += '        line,\n';
  code += '        column: 0,\n';
  code += '        severity: \'warning\',\n';
  code += '        category: \'Performance\',\n';
  code += '        message: \'Multiple loops on same line\',\n';
  code += '        suggestion: \'Consider refactoring nested loops\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  generateReport(issues: ReviewIssue[]): ReviewReport {\n';
  code += '    const summary: Record<string, number> = {};\n';
  code += '    for (const issue of issues) {\n';
  code += '      summary[issue.category] = (summary[issue.category] || 0) + 1;\n';
  code += '    }\n\n';

  code += '    return {\n';
  code += '      timestamp: new Date().toISOString(),\n';
  code += '      totalIssues: issues.length,\n';
  code += '      errors: issues.filter(i => i.severity === \'error\').length,\n';
  code += '      warnings: issues.filter(i => i.severity === \'warning\').length,\n';
  code += '      info: issues.filter(i => i.severity === \'info\').length,\n';
  code += '      issues,\n';
  code += '      summary,\n';
  code += '    };\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const reviewer = new CodeReviewer({\n';
  code += '  enableBestPractices: ' + config.enableBestPractices + ',\n';
  code += '  enableStyleChecks: ' + config.enableStyleChecks + ',\n';
  code += '  enableSecurityChecks: ' + config.enableSecurityChecks + ',\n';
  code += '  enablePerformanceChecks: ' + config.enablePerformanceChecks + ',\n';
  code += '});\n\n';

  code += 'export default reviewer;\n';
  code += 'export { CodeReviewer, ReviewIssue, ReviewReport };\n';

  return code;
}

// Python Code Review (Simplified)
export function generatePythonReview(config: ReviewConfig): string {
  let code = '# Auto-generated Code Review Tools for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import os\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class ReviewIssue:\n';
  code += '    file: str\n';
  code += '    line: int\n';
  code += '    column: int\n';
  code += '    severity: str  # "error", "warning", "info"\n';
  code += '    category: str\n';
  code += '    message: str\n';
  code += '    suggestion: Optional[str] = None\n\n';

  code += '@dataclass\n';
  code += 'class ReviewReport:\n';
  code += '    timestamp: str\n';
  code += '    total_issues: int\n';
  code += '    errors: int\n';
  code += '    warnings: int\n';
  code += '    info: int\n';
  code += '    issues: List[ReviewIssue]\n';
  code += '    summary: Dict[str, int]\n\n';

  code += 'class CodeReviewer:\n';
  code += '    def __init__(self, enable_best_practices: bool = True, enable_style_checks: bool = True, enable_security_checks: bool = True, enable_performance_checks: bool = True):\n';
  code += '        self.enable_best_practices = enable_best_practices\n';
  code += '        self.enable_style_checks = enable_style_checks\n';
  code += '        self.enable_security_checks = enable_security_checks\n';
  code += '        self.enable_performance_checks = enable_performance_checks\n\n';

  code += '    def review_file(self, file_path: str) -> List[ReviewIssue]:\n';
  code += '        issues = []\n';
  code += '        with open(file_path, \'r\') as f:\n';
  code += '            lines = f.readlines()\n\n';

  code += '        for i, line in enumerate(lines):\n';
  code += '            line_num = i + 1\n';
  code += '            content = line.rstrip()\n\n';

  code += '            if self.enable_best_practices:\n';
  code += '                issues.extend(self.check_best_practices(file_path, line_num, content))\n\n';

  code += '            if self.enable_style_checks:\n';
  code += '                issues.extend(self.check_style(file_path, line_num, content))\n\n';

  code += '            if self.enable_security_checks:\n';
  code += '                issues.extend(self.check_security(file_path, line_num, content))\n\n';

  code += '            if self.enable_performance_checks:\n';
  code += '                issues.extend(self.check_performance(file_path, line_num, content))\n\n';

  code += '        return issues\n\n';

  code += '    def check_best_practices(self, file: str, line: int, content: str) -> List[ReviewIssue]:\n';
  code += '        issues = []\n\n';

  code += '        # Check for print statements\n';
  code += '        if \'print(\' in content:\n';
  code += '            issues.append(ReviewIssue(\n';
  code += '                file=file,\n';
  code += '                line=line,\n';
  code += '                column=content.index(\'print(\'),\n';
  code += '                severity=\'info\',\n';
  code += '                category=\'Best Practices\',\n';
  code += '                message=\'Print statement found\',\n';
  code += '                suggestion=\'Use proper logging library\',\n';
  code += '            ))\n\n';

  code += '        return issues\n\n';

  code += '    def check_style(self, file: str, line: int, content: str) -> List[ReviewIssue]:\n';
  code += '        issues = []\n\n';

  code += '        # Check line length\n';
  code += '        if len(content) > 88:\n';
  code += '            issues.append(ReviewIssue(\n';
  code += '                file=file,\n';
  code += '                line=line,\n';
  code += '                column=88,\n';
  code += '                severity=\'warning\',\n';
  code += '                category=\'Style\',\n';
  code += '                message=f\'Line too long ({len(content)} characters)\',\n';
  code += '                suggestion=\'Break line into multiple lines\',\n';
  code += '            ))\n\n';

  code += '        return issues\n\n';

  code += '    def check_security(self, file: str, line: int, content: str) -> List[ReviewIssue]:\n';
  code += '        issues = []\n\n';

  code += '        # Check for eval\n';
  code += '        if \'eval(\' in content:\n';
  code += '            issues.append(ReviewIssue(\n';
  code += '                file=file,\n';
  code += '                line=line,\n';
  code += '                column=content.index(\'eval(\'),\n';
  code += '                severity=\'error\',\n';
  code += '                category=\'Security\',\n';
  code += '                message=\'Use of eval() is dangerous\',\n';
  code += '                suggestion=\'Avoid eval() - use safer alternatives\',\n';
  code += '            ))\n\n';

  code += '        return issues\n\n';

  code += '    def check_performance(self, file: str, line: int, content: str) -> List[ReviewIssue]:\n';
  code += '        issues = []\n';

  code += '        # Check for nested loops\n';
  code += '        if content.count(\'for \') > 1:\n';
  code += '            issues.append(ReviewIssue(\n';
  code += '                file=file,\n';
  code += '                line=line,\n';
  code += '                column=0,\n';
  code += '                severity=\'warning\',\n';
  code += '                category=\'Performance\',\n';
  code += '                message=\'Multiple loops on same line\',\n';
  code += '                suggestion=\'Consider refactoring nested loops\',\n';
  code += '            ))\n\n';

  code += '        return issues\n\n';

  code += '    def generate_report(self, issues: List[ReviewIssue]) -> ReviewReport:\n';
  code += '        summary = {}\n';
  code += '        for issue in issues:\n';
  code += '            summary[issue.category] = summary.get(issue.category, 0) + 1\n\n';

  code += '        return ReviewReport(\n';
  code += '            timestamp=str(datetime.now()),\n';
  code += '            total_issues=len(issues),\n';
  code += '            errors=len([i for i in issues if i.severity == \'error\']),\n';
  code += '            warnings=len([i for i in issues if i.severity == \'warning\']),\n';
  code += '            info=len([i for i in issues if i.severity == \'info\']),\n';
  code += '            issues=issues,\n';
  code += '            summary=summary,\n';
  code += '        )\n\n';

  code += 'from datetime import datetime\n\n';

  code += 'reviewer = CodeReviewer(\n';
  code += '    enable_best_practices=' + (config.enableBestPractices ? 'True' : 'False') + ',\n';
  code += '    enable_style_checks=' + (config.enableStyleChecks ? 'True' : 'False') + ',\n';
  code += '    enable_security_checks=' + (config.enableSecurityChecks ? 'True' : 'False') + ',\n';
  code += '    enable_performance_checks=' + (config.enablePerformanceChecks ? 'True' : 'False') + ',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displayReviewConfig(config: ReviewConfig): void {
  console.log(chalk.cyan('\n✨ Cross-Language Code Review with Polyglot Best Practices\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Best Practices:'), chalk.white(config.enableBestPractices ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Style Checks:'), chalk.white(config.enableStyleChecks ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Security Checks:'), chalk.white(config.enableSecurityChecks ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Performance Checks:'), chalk.white(config.enablePerformanceChecks ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Cross-language code review',
    'Polyglot best practices enforcement',
    'Style and formatting checks',
    'Security vulnerability detection',
    'Performance optimization suggestions',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: ReviewConfig): string {
  let content = '# Cross-Language Code Review for ' + config.projectName + '\n\n';
  content += 'Cross-language code review tools with polyglot best practices for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Best Practices**: ' + (config.enableBestPractices ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Style Checks**: ' + (config.enableStyleChecks ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Security Checks**: ' + (config.enableSecurityChecks ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Performance Checks**: ' + (config.enablePerformanceChecks ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import reviewer from \'./code-review\';\n\n';
  content += '// Review a file\n';
  content += 'const issues = reviewer.reviewFile(\'src/index.ts\');\n';
  content += 'console.log(issues);\n\n';
  content += '// Generate report\n';
  content += 'const report = reviewer.generateReport(issues);\n';
  content += 'console.log(report);\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from code_review import reviewer\n\n';
  content += '# Review a file\n';
  content += 'issues = reviewer.review_file(\'src/main.py\')\n';
  content += 'print(issues)\n\n';
  content += '# Generate report\n';
  content += 'report = reviewer.generate_report(issues)\n';
  content += 'print(report)\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **Best Practices**: Enforces language-specific best practices\n';
  content += '- **Style Checks**: Ensures consistent code formatting\n';
  content += '- **Security**: Detects common security vulnerabilities\n';
  content += '- **Performance**: Identifies performance bottlenecks\n';
  content += '- **Multi-Language**: Support for TypeScript, Python, and more\n\n';

  return content;
}

// Write files
export async function writeReviewFiles(
  config: ReviewConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'code-review.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptReview(config);
  } else if (config.language === 'python') {
    content = generatePythonReview(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  const buildMD = generateBuildMD(config);
  await fs.writeFile(path.join(output, 'BUILD.md'), buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  if (config.language === 'typescript') {
    const packageJson = {
      name: config.projectName.toLowerCase() + '-code-review',
      version: '1.0.0',
      description: 'Code review tools for ' + config.projectName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    await fs.writeFile(
      path.join(output, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    console.log(chalk.green('✅ Generated: package.json'));
  }

  if (config.language === 'python') {
    const requirements = [];

    await fs.writeFile(path.join(output, 'requirements.txt'), requirements.join('\n') || '# No dependencies\n');
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  const reviewConfig = {
    projectName: config.projectName,
    language: config.language,
    enableBestPractices: config.enableBestPractices,
    enableStyleChecks: config.enableStyleChecks,
    enableSecurityChecks: config.enableSecurityChecks,
    enablePerformanceChecks: config.enablePerformanceChecks,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'review-config.json'),
    JSON.stringify(reviewConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: review-config.json'));
}
