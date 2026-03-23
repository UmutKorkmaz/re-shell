import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import {
  WorkspaceHealthChecker,
  WorkspaceHealthReport,
  HealthCheckResult,
  HealthCheckCategory,
  TopologyValidation,
  createWorkspaceHealthChecker,
  performQuickHealthCheck
} from '../utils/workspace-health';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceHealthCommandOptions {
  check?: boolean;
  topology?: boolean;
  quick?: boolean;
  watch?: boolean;
  fix?: boolean;
  interactive?: boolean;
  
  // File options
  file?: string;
  output?: string;
  
  // Check options
  category?: string;
  severity?: string;
  detailed?: boolean;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceHealth(options: WorkspaceHealthCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.check) {
      await performFullHealthCheck(options, spinner);
      return;
    }

    if (options.topology) {
      await validateWorkspaceTopology(options, spinner);
      return;
    }

    if (options.quick) {
      await performQuickCheck(options, spinner);
      return;
    }

    if (options.watch) {
      await watchWorkspaceHealth(options, spinner);
      return;
    }

    if (options.fix) {
      await fixHealthIssues(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveHealthManagement(options, spinner);
      return;
    }

    // Default: show health status
    await showHealthStatus(options, spinner);

  } catch (error) {
    if (error instanceof ValidationError) {
      if (spinner) spinner.stop();
      console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
      console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
      process.exit(1);
    }
    if (spinner) spinner.fail(chalk.red('Workspace health operation failed'));
    throw error;
  }
}

async function performFullHealthCheck(options: WorkspaceHealthCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Performing comprehensive health check: ${inputFile}`);

  try {
    const checker = await createWorkspaceHealthChecker(inputPath, path.dirname(inputPath));
    const report = await checker.performHealthCheck();

    if (spinner) spinner.stop();

    if (options.output) {
      // Save report to file
      const outputPath = path.resolve(options.output);
      await fs.writeJson(outputPath, report, { spaces: 2 });
      console.log(chalk.green(`Health report saved to: ${options.output}`));
    }

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    displayHealthReport(report, inputFile, options.detailed || false, options.category);

    // Exit with error code if unhealthy
    if (report.overall.status === 'unhealthy') {
      process.exit(1);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Health check failed'));
    throw error;
  }
}

async function validateWorkspaceTopology(options: WorkspaceHealthCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Validating workspace topology: ${inputFile}`);

  try {
    const checker = await createWorkspaceHealthChecker(inputPath, path.dirname(inputPath));
    const validation = await checker.validateTopology();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(validation, null, 2));
      return;
    }

    displayTopologyValidation(validation, inputFile);

    if (!validation.isValid) {
      process.exit(1);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Topology validation failed'));
    throw error;
  }
}

async function performQuickCheck(options: WorkspaceHealthCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Quick health check: ${inputFile}`);

  try {
    const result = await performQuickHealthCheck(inputPath, path.dirname(inputPath));

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    displayQuickHealthResult(result, inputFile);

    if (result.status === 'unhealthy') {
      process.exit(1);
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Quick health check failed'));
    throw error;
  }
}

async function watchWorkspaceHealth(options: WorkspaceHealthCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  
  if (spinner) spinner.setText('Starting health monitoring...');

  console.log(chalk.cyan('🔍 Workspace Health Monitor'));
  console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));

  try {
    // Initial health check
    await performQuickCheck(options);
    
    console.log(chalk.cyan('\n👀 Monitoring workspace health...'));
    console.log(chalk.gray('Health checks will run every 30 seconds\n'));

    // Set up periodic health checks
    const interval = setInterval(async () => {
      try {
        console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Running health check...`));
        const result = await performQuickHealthCheck(inputFile);
        
        const statusIcon = result.status === 'healthy' ? '✅' : 
                          result.status === 'degraded' ? '⚠️' : '❌';
        const statusColor = result.status === 'healthy' ? chalk.green : 
                           result.status === 'degraded' ? chalk.yellow : chalk.red;
        
        console.log(`${statusIcon} ${statusColor(result.status.toUpperCase())} - Score: ${result.score}%`);
        
        if (result.criticalIssues > 0) {
          console.log(chalk.red(`🚨 ${result.criticalIssues} critical issue(s) detected`));
        }
        
      } catch (error) {
        console.log(chalk.red(`❌ Health check failed: ${(error as Error).message}`));
      }
    }, 30000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.yellow('\n🛑 Health monitoring stopped'));
      process.exit(0);
    });

    // Keep the process running
    await new Promise(() => { /* run indefinitely */ });

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Health monitoring failed'));
    throw error;
  }
}

async function fixHealthIssues(options: WorkspaceHealthCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (!(await fs.pathExists(inputPath))) {
    if (spinner) spinner.stop();
    console.log(chalk.yellow('\n⚠️  No workspace definition found.'));
    console.log(chalk.gray(`Expected: ${inputFile}`));
    console.log(chalk.cyan('\nRun \'re-shell workspace-def init\' to initialize your workspace.'));
    return;
  }

  if (spinner) spinner.setText(`Analyzing health issues for auto-fix: ${inputFile}`);

  try {
    const checker = await createWorkspaceHealthChecker(inputPath, path.dirname(inputPath));
    const report = await checker.performHealthCheck();

    if (spinner) spinner.stop();

    // Find fixable issues
    const fixableIssues = report.categories
      .flatMap(cat => cat.checks)
      .filter(check => check.status === 'fail' && check.suggestions && check.suggestions.length > 0);

    if (fixableIssues.length === 0) {
      console.log(chalk.green('✅ No auto-fixable issues found'));
      return;
    }

    console.log(chalk.cyan(`\n🔧 Auto-Fix Analysis`));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`\nFound ${fixableIssues.length} potentially fixable issue(s):`);
    
    for (let i = 0; i < fixableIssues.length; i++) {
      const issue = fixableIssues[i];
      console.log(`\n${i + 1}. ${issue.name}`);
      console.log(`   Issue: ${issue.message}`);
      console.log(`   Suggestions:`);
      for (const suggestion of issue.suggestions!) {
        console.log(`     • ${suggestion}`);
      }
    }

    console.log(chalk.yellow('\n⚠️  Auto-fix implementation coming in next update'));
    console.log(chalk.gray('For now, please apply fixes manually based on suggestions above.'));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Health fix analysis failed'));
    throw error;
  }
}

async function showHealthStatus(options: WorkspaceHealthCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);

  if (spinner) spinner.setText('Checking workspace health status...');

  try {
    if (!(await fs.pathExists(inputPath))) {
      if (spinner) spinner.stop();
      
      console.log(chalk.yellow('\n⚠️  No workspace definition found'));
      console.log(chalk.gray(`Expected: ${inputFile}`));
      console.log(chalk.cyan('\n🚀 Quick start:'));
      console.log('  re-shell workspace-def init');
      return;
    }

    const result = await performQuickHealthCheck(inputPath, path.dirname(inputPath));

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🏥 Workspace Health Status'));
    console.log(chalk.gray('═'.repeat(50)));

    const statusIcon = result.status === 'healthy' ? '✅' : 
                      result.status === 'degraded' ? '⚠️' : '❌';
    const statusColor = result.status === 'healthy' ? chalk.green : 
                       result.status === 'degraded' ? chalk.yellow : chalk.red;

    console.log(`\nOverall Status: ${statusIcon} ${statusColor(result.status.toUpperCase())}`);
    console.log(`Health Score: ${getScoreColor(result.score)(`${result.score}%`)}`);
    
    if (result.criticalIssues > 0) {
      console.log(`Critical Issues: ${chalk.red(result.criticalIssues)}`);
    } else {
      console.log(`Critical Issues: ${chalk.green('None')}`);
    }

    console.log(chalk.cyan('\n🛠️  Available Commands:'));
    console.log('  • re-shell workspace-health check --detailed');
    console.log('  • re-shell workspace-health topology');
    console.log('  • re-shell workspace-health watch');
    console.log('  • re-shell workspace-health interactive');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Health status check failed'));
    throw error;
  }
}

async function interactiveHealthManagement(options: WorkspaceHealthCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const inputFile = options.file || DEFAULT_WORKSPACE_FILE;
  const inputPath = path.resolve(inputFile);
  const exists = await fs.pathExists(inputPath);

  if (!exists) {
    console.log(chalk.yellow('\n⚠️  No workspace definition found'));
    console.log(chalk.gray('Create one first with: re-shell workspace-def init'));
    return;
  }

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '🏥 Full health check', value: 'check' },
        { title: '⚡ Quick health check', value: 'quick' },
        { title: '🏗️  Validate topology', value: 'topology' },
        { title: '👀 Monitor health', value: 'watch' },
        { title: '🔧 Analyze fixable issues', value: 'fix' },
        { title: '📊 Show status', value: 'status' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'check':
      await performFullHealthCheck({ ...options, interactive: false });
      break;
    case 'quick':
      await performQuickCheck({ ...options, interactive: false });
      break;
    case 'topology':
      await validateWorkspaceTopology({ ...options, interactive: false });
      break;
    case 'watch':
      await watchWorkspaceHealth({ ...options, interactive: false });
      break;
    case 'fix':
      await fixHealthIssues({ ...options, interactive: false });
      break;
    case 'status':
      await showHealthStatus({ ...options, interactive: false });
      break;
  }
}

// Display functions
function displayHealthReport(
  report: WorkspaceHealthReport,
  fileName: string,
  detailed: boolean,
  categoryFilter?: string
): void {
  console.log(chalk.cyan('\n🏥 Workspace Health Report'));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray(`Generated: ${new Date(report.timestamp).toLocaleString()}`));
  console.log(chalk.gray('═'.repeat(60)));

  // Overall status
  const statusIcon = report.overall.status === 'healthy' ? '✅' : 
                    report.overall.status === 'degraded' ? '⚠️' : '❌';
  const statusColor = report.overall.status === 'healthy' ? chalk.green : 
                     report.overall.status === 'degraded' ? chalk.yellow : chalk.red;

  console.log(`\n${statusIcon} Overall: ${statusColor(report.overall.status.toUpperCase())}`);
  console.log(`📊 Health Score: ${getScoreColor(report.overall.score)(`${report.overall.score}%`)}`);
  console.log(`⏱️  Duration: ${report.duration}ms`);
  console.log(`💬 ${report.overall.summary}`);

  // Metrics
  console.log(`\n📈 Metrics:`);
  console.log(`  Workspaces: ${report.metrics.workspaceCount}`);
  console.log(`  Dependencies: ${report.metrics.dependencyCount}`);
  console.log(`  Cycles: ${report.metrics.cycleCount}`);
  console.log(`  Orphaned: ${report.metrics.orphanedCount}`);
  console.log(`  Coverage: ${report.metrics.coverageScore}%`);

  // Categories
  const categoriesToShow = categoryFilter 
    ? report.categories.filter(cat => cat.id === categoryFilter)
    : report.categories;

  for (const category of categoriesToShow) {
    displayHealthCategory(category, detailed);
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log(chalk.cyan(`\n💡 Recommendations:`));
    for (let i = 0; i < Math.min(report.recommendations.length, 5); i++) {
      console.log(`  ${i + 1}. ${report.recommendations[i]}`);
    }
    
    if (report.recommendations.length > 5) {
      console.log(`  ... and ${report.recommendations.length - 5} more`);
    }
  }
}

function displayHealthCategory(category: HealthCheckCategory, detailed: boolean): void {
  const categoryIcon = getCategoryIcon(category.id);
  const scoreColor = getScoreColor(category.summary.score);
  
  console.log(`\n${categoryIcon} ${chalk.cyan(category.name)} - ${scoreColor(`${category.summary.score}%`)}`);
  console.log(`   ${chalk.gray(category.description)}`);
  
  if (category.summary.failed > 0) {
    console.log(`   ❌ Failed: ${chalk.red(category.summary.failed)}`);
  }
  if (category.summary.warnings > 0) {
    console.log(`   ⚠️  Warnings: ${chalk.yellow(category.summary.warnings)}`);
  }
  if (category.summary.passed > 0) {
    console.log(`   ✅ Passed: ${chalk.green(category.summary.passed)}`);
  }

  if (detailed) {
    for (const check of category.checks) {
      if (check.status === 'fail' || check.status === 'warning') {
        displayHealthCheck(check);
      }
    }
  }
}

function displayHealthCheck(check: HealthCheckResult): void {
  const statusIcon = check.status === 'pass' ? '✅' : 
                    check.status === 'fail' ? '❌' : 
                    check.status === 'warning' ? '⚠️' : 'ℹ️';
  
  console.log(`\n     ${statusIcon} ${check.name}`);
  console.log(`        ${check.message}`);
  
  if (check.suggestions && check.suggestions.length > 0) {
    console.log(`        Suggestions:`);
    for (const suggestion of check.suggestions) {
      console.log(`          • ${suggestion}`);
    }
  }
}

function displayTopologyValidation(validation: TopologyValidation, fileName: string): void {
  console.log(chalk.cyan('\n🏗️  Workspace Topology Validation'));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray('═'.repeat(60)));

  const statusIcon = validation.isValid ? '✅' : '❌';
  const statusColor = validation.isValid ? chalk.green : chalk.red;
  
  console.log(`\n${statusIcon} Topology: ${statusColor(validation.isValid ? 'VALID' : 'INVALID')}`);

  // Structure metrics
  console.log(`\n📊 Structure Metrics:`);
  console.log(`  Depth: ${validation.structure.depth}`);
  console.log(`  Breadth: ${validation.structure.breadth}`);
  console.log(`  Complexity: ${validation.structure.complexity.toFixed(2)}`);
  console.log(`  Balance: ${(validation.structure.balance * 100).toFixed(1)}%`);

  // Errors
  if (validation.errors.length > 0) {
    console.log(chalk.red(`\n❌ Errors (${validation.errors.length}):`));
    for (const error of validation.errors) {
      console.log(`  • ${error.message}`);
    }
  }

  // Warnings
  if (validation.warnings.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Warnings (${validation.warnings.length}):`));
    for (const warning of validation.warnings) {
      console.log(`  • ${warning}`);
    }
  }

  // Suggestions
  if (validation.suggestions.length > 0) {
    console.log(chalk.cyan(`\n💡 Suggestions (${validation.suggestions.length}):`));
    for (const suggestion of validation.suggestions) {
      console.log(`  • ${suggestion}`);
    }
  }
}

function displayQuickHealthResult(result: any, fileName: string): void {
  console.log(chalk.cyan('\n⚡ Quick Health Check'));
  console.log(chalk.gray(`File: ${fileName}`));
  console.log(chalk.gray('═'.repeat(40)));

  const statusIcon = result.status === 'healthy' ? '✅' : 
                    result.status === 'degraded' ? '⚠️' : '❌';
  const statusColor = result.status === 'healthy' ? chalk.green : 
                     result.status === 'degraded' ? chalk.yellow : chalk.red;

  console.log(`\n${statusIcon} Status: ${statusColor(result.status.toUpperCase())}`);
  console.log(`📊 Score: ${getScoreColor(result.score)(`${result.score}%`)}`);
  
  if (result.criticalIssues > 0) {
    console.log(`🚨 Critical Issues: ${chalk.red(result.criticalIssues)}`);
  } else {
    console.log(`🚨 Critical Issues: ${chalk.green('None')}`);
  }

  console.log(chalk.cyan('\n💡 Run detailed check:'));
  console.log('  re-shell workspace-health check --detailed');
}

// Utility functions
function getScoreColor(score: number): typeof chalk.green {
  if (score >= 90) return chalk.green;
  if (score >= 70) return chalk.yellow;
  return chalk.red;
}

function getCategoryIcon(categoryId: string): string {
  const icons = {
    structure: '🏗️',
    dependencies: '🔗',
    build: '⚙️',
    filesystem: '📁',
    'package-json': '📦',
    typescript: '🔷',
    security: '🔒'
  };
  
  return icons[categoryId as keyof typeof icons] || '📋';
}
